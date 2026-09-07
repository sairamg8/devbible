---
title: "`handleHotUpdate` is not a notification — its return value replaces the set of modules Vite was about to update, so returning nothing, a narrowed array, and an empty array are three different instructions"
sidebar_label: "`handleHotUpdate`"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `handleHotUpdate`](https://vite.dev/guide/api-plugin) (Type/Kind/Scope, the `HmrContext` interface and the three documented choices) and [HMR API](https://vite.dev/guide/api-hmr). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `handleHotUpdate`

The hook fires when a watched file changes, and what it returns decides what the HMR client is told
to do. Most plugins that use it are trying to make an update *narrower*; the ones that get it wrong
usually did not realise the return value was an instruction rather than a formality. What the return value
means is [The `handleHotUpdate` Return Contract](01oa-hmr-return-contract.md); the other two
documented choices are [HMR: Full Reload & Invalidation](01ob-hmr-full-reload-and-invalidation.md)
and [HMR: Custom Events](01od-hmr-custom-events.md).

---

## 1. Under-The-Hood Mechanics

### The signature block, verbatim

> *"**Type:** `(ctx: HmrContext) => Array<ModuleNode> | void | Promise<Array<ModuleNode> | void>`"*
> *"**Kind:** `async`, `sequential`"*
> *"**See also:** [HMR API](https://vite.dev/guide/api-hmr)"*
> *"**Scope:** [Per-environment](https://vite.dev/guide/api-environment-plugins#per-environment-hooks-and-global-hooks)"*

Three facts are packed into those four lines. It may return a promise, so `read()` can be awaited.
It is `sequential`, so plugins run one after another rather than concurrently. And it is
per-environment, so in a client-plus-SSR project it is called for each environment.

### The context

> *"Perform custom HMR update handling. The hook receives a context object with the following
> signature:"*

```ts
interface HmrContext {
  file: string
  timestamp: number
  modules: Array<ModuleNode>
  read: () => string | Promise<string>
  server: ViteDevServer
}
```

Five fields, and every one of them exists to answer a question the hook cannot answer for itself:
*what changed* (`file`), *when* (`timestamp`, which the invalidation API needs), *what Vite thinks
is affected* (`modules`), *what the file now contains* (`read`), and *how to talk to the client*
(`server`).

### Why `modules` is an array

> *"`modules` is an array of modules that are affected by the changed file. It's an array because a
> single file may map to multiple served modules (e.g. Vue SFCs)."*

One `.vue` file becomes a script module, a template module and one module per `<style>` block. A
hook that assumes `modules[0]` is "the module for this file" is correct for a plain `.ts` file and
wrong for every single-file component — and the failure is a style block that stops hot-updating
while the script keeps working, which reads like a CSS problem.

### Why `read` exists — and why `fs.readFile` is a bug here

> *"`read` is an async read function that returns the content of the file. This is provided because
> on some systems, the file change callback may fire too fast before the editor finishes updating
> the file and direct `fs.readFile` will return empty content. The read function passed in
> normalizes this behavior."*

That is a race between the editor's write and the watcher's notification, and it is
system-dependent — which is the worst kind, because it does not reproduce on the machine of whoever
wrote the plugin. The symptom is an HMR update that intermittently behaves as though the file were
empty: no matched pattern, no detected export, a "nothing changed" branch taken on a change.

Use `await ctx.read()`. Never `fs.readFile(ctx.file)`.

---

## 2. Real-World Engineering Scenario

**An HMR handler that worked on macOS and flickered on Linux.**

A plugin owned `.i18n.json` locale files. On change it read the file, compared the parsed keys with
the previous version, and updated only the modules importing a changed key:

```ts
handleHotUpdate(ctx) {
  const next = JSON.parse(fs.readFileSync(ctx.file, 'utf8'));   // ⛔
  const changed = diffKeys(previous, next);
  previous = next;
  return ctx.modules.filter((m) => usesAnyKey(m, changed));
}
```

On the author's machine it was perfect. On CI containers and on two developers' Linux laptops,
roughly one save in five did nothing at all: `readFileSync` returned an empty string, `JSON.parse`
threw, the hook rejected, and the update was lost. When the parse happened to succeed on a
half-written file, `diffKeys` reported *every* key as changed and the filter returned everything —
so the same bug also produced occasional full-page-sized updates.

The documented cause is exactly this: *"the file change callback may fire too fast before the editor
finishes updating the file and direct `fs.readFile` will return empty content"*. The fix is
`await ctx.read()`, which *"normalizes this behavior"*.

**The second defect, found in the same review.** The filter also dropped every module whose id
ended in `.css`, on the theory that a locale change cannot affect styles. In a Vue project the
`<style>` blocks of a component are separate served modules of the *same file*, so the filter was
silently discarding update targets for components that did use the changed keys. `modules` is an
array *"because a single file may map to multiple served modules"* — filtering it by file extension
is filtering by an assumption the array exists to contradict.

**The transferable point:** both bugs come from treating `ctx` as advisory. It is the hook's only
reliable source of truth about what changed and what Vite intends to do about it.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Narrowing done correctly: read via ctx.read(), never guess the module set.
import type { Plugin, HmrContext, ModuleNode } from 'vite';

export function localeHmr(): Plugin {
  let previous: Record<string, string> = {};

  return {
    name: 'locale-hmr',

    async handleHotUpdate(ctx: HmrContext): Promise<ModuleNode[] | void> {
      if (!ctx.file.endsWith('.i18n.json')) return;   // not ours — let Vite proceed

      // The documented reason this exists: fs.readFile can return empty content
      // because the watcher can fire before the editor has finished writing.
      const source = await ctx.read();

      let next: Record<string, string>;
      try {
        next = JSON.parse(source);
      } catch {
        // A partially written file is not a reason to lose the update.
        return;                                       // undefined = proceed normally
      }

      const changedKeys = Object.keys(next).filter((k) => next[k] !== previous[k]);
      previous = next;

      if (changedKeys.length === 0) {
        return [];                                    // nothing to update — see the caveat below
      }

      // Narrow, but never by file extension: one source file can map to several
      // served modules, and they are all legitimate update targets.
      return ctx.modules.filter((mod) => moduleUsesAnyKey(mod, changedKeys));
    },
  };
}
```

```typescript
// ⛔ The anti-pattern, with every defect labelled.
handleHotUpdate(ctx) {
  const src = fs.readFileSync(ctx.file, 'utf8');      // 1. can be empty — use ctx.read()
  const mod = ctx.modules[0];                         // 2. an SFC has several modules
  if (!src.includes('export default')) return [];     // 3. [] with no send = silent no-op
  return [mod];
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — `fs.readFile` instead of `ctx.read()`

Documented to return empty content on some systems because the watcher can fire before the editor
finishes writing. It is intermittent and platform-dependent, so it survives review and reproduces on
someone else's machine.

### ⚠️ Pitfall 2 — Treating `modules[0]` as "the module"

*"a single file may map to multiple served modules (e.g. Vue SFCs)"*. Indexing the array works until
the first single-file component and then loses style or template updates.

### ⚠️ Pitfall 3 — Filtering `ctx.modules` by file extension

The array is heterogeneous by design. Filter by what the module *imports* or *is*, using the module
graph, not by the shape of its id.

### ⚠️ Pitfall 4 — Letting the hook reject

An exception inside `handleHotUpdate` is an update the developer never receives. Any parsing of file
content belongs in a `try`/`catch` whose fallback is `return` (proceed normally), not `return []`.

### ⚠️ Pitfall 5 — Handling files the plugin does not own

The hook fires for **every** changed file, not only the ones matching your plugin. The first line
should be a cheap guard on `ctx.file`; without it a plugin is making decisions about other plugins'
modules.

---

## Gotchas

**★ Symptom: HMR intermittently does nothing on save, only on some machines.** Cause: `fs.readFile`/`readFileSync` returned empty content because *"the file change callback may fire too fast before the editor finishes updating the file"*. Fix: `const source = await ctx.read();`.

**★ Symptom: a save occasionally triggers a far larger update than it should.** Cause: the same race — a truncated read made a diff report everything as changed. Fix: `ctx.read()`, plus a `try`/`catch` that returns `undefined` on a parse failure.

**★ Symptom: script changes hot-update in a `.vue` file but style changes stop working.** Cause: the hook returned `[ctx.modules[0]]`. Fix: return the filtered array, never an index — *"a single file may map to multiple served modules (e.g. Vue SFCs)"*.

**★ Symptom: HMR breaks for unrelated file types after installing a plugin.** Cause: the hook had no `ctx.file` guard and returned a narrowed list for every change. Fix: `if (!ctx.file.endsWith('.i18n.json')) return;` as the first statement.

**★ Symptom: one bad save leaves the dev server unable to update that file again.** Cause: an exception in the hook, plus module-level state left half-updated (`previous` assigned before the parse succeeded). Fix: assign state only after the parse succeeds, and catch.

**★ Symptom: a CSS module stops updating after a plugin filters `ctx.modules` by extension.** Cause: the array is heterogeneous by design. Fix: filter on the module graph, not on the id's suffix.

**★ Symptom: `await ctx.read()` returns content that differs from what the editor shows.** Cause: a second save landed while the first invocation was awaiting. Fix: use `ctx.timestamp` to decide whether the result is still current before acting on it, and never cache the read across invocations.

---

## Interview questions

**★ Why is `modules` an array rather than a single module?**
Because the mapping from files to served modules is not one-to-one: *"a single file may map to
multiple served modules (e.g. Vue SFCs)"*. A `.vue` file is compiled into a script module, a
template module and a module per style block, all served separately, and a change to the file can
affect any subset of them. A plugin that indexes `modules[0]` is therefore correct for plain
JavaScript and TypeScript files and quietly wrong for every single-file component — the usual
symptom being that script edits hot-update while style edits stop arriving, which sends people
looking at their CSS pipeline. The same reasoning rules out filtering the array by file extension,
since the different modules for one file do not share a suffix.

**★ Why does `HmrContext` provide `read` when Node already has `fs.readFile`?**
Because the file-change callback races the editor's write: *"on some systems, the file change
callback may fire too fast before the editor finishes updating the file and direct `fs.readFile`
will return empty content. The read function passed in normalizes this behavior."* The failure mode
is the nastiest kind — intermittent, platform-dependent and invisible to whoever wrote the plugin,
because it depends on the editor, the filesystem and the machine. It also has two distinct symptoms
rather than one: an empty read makes a content check fail, so the update is dropped, and a truncated
read can make a diff report far more change than occurred, so the update is oversized. `ctx.read()`
is not a convenience wrapper, it is the correct API.

---

← [The `transformIndexHtml` Context](01nd-html-transform-context.md) · [Vite overview](../../README.md) · Next → [The `handleHotUpdate` Return Contract](01oa-hmr-return-contract.md)
