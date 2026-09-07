---
title: "A Virtual Module Has No File, and Everything That Normally Follows From Having One — Type Resolution, Watcher Mapping, a Unique Path — You Now Owe It Yourself"
sidebar_label: "Shipping a Virtual Module"
sidebar_position: 40
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Importing a Virtual File](https://vite.dev/guide/api-plugin), [§ `handleHotUpdate`](https://vite.dev/guide/api-plugin), [§ Conventions](https://vite.dev/guide/api-plugin); the naming convention is quoted from [Rolldown § Virtual Modules](https://rolldown.rs/apis/plugin-api#virtual-modules). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Shipping a Virtual Module

**[The convention](01s-virtual-modules.md) gets a virtual module resolving and loading. Everything
after that is the consequence of the one property that makes it virtual: there is no file. No file
means TypeScript has nothing to resolve, the watcher has nothing to map a change onto, and the
filesystem is not enforcing uniqueness of the name. Each of those is a defect report you will
receive from someone else, and each has a small, boring fix that belongs in the plugin rather than
in the consuming app.**

---

## 1. Under-The-Hood Mechanics

### TypeScript is a separate resolver, and Vite's answer is invisible to it

Vite resolves `virtual:build-info` through your `resolveId` hook, at bundle time. TypeScript
resolves module specifiers through its own algorithm, against the filesystem, before Vite is
involved at all. Nothing connects the two, so the specifier is unresolvable to `tsc` no matter how
correct the plugin is. The fix is an ambient module declaration — a `.d.ts` file that asserts the
shape of a module TypeScript will never find:

```ts
// src/virtual-build-info.d.ts
declare module 'virtual:build-info' {
  export const commit: string
  export const builtAt: string
}
```

Ship this **from the plugin package** where you can, and document the import in the README, so a
consumer's editor understands the module without them writing declarations for your API.

### The name is not protected by anything

A file path is unique because a filesystem enforces it. A virtual specifier is a string, and two
plugins can pick the same one; resolution goes to whichever plugin's `resolveId` answers first,
which is plugin order. Rolldown's convention exists to make that collision unlikely:

> *"Virtual modules in Rolldown are prefixed with `virtual:` for the user-facing path by
> convention. If possible the plugin name should be used as a namespace to avoid collisions with
> other plugins in the ecosystem."*

So `virtual:my-plugin/config`, not `virtual:config`. ⚠️ Note what the convention does **not** give
you: there is no registry, no warning on collision, and no documented way to detect that another
plugin already claimed a specifier.

### No file means no watcher mapping

Vite's HMR starts from a changed file and asks which modules that file affects — the
`handleHotUpdate` context is *"an array of modules that are affected by the changed file"*. A
virtual module is affected by a file only in your plugin's head; nothing in the graph records that
`virtual:build-info` was built from `flags.json`. So when the JSON changes, `modules` does not
contain your virtual module, and nothing invalidates it.

You close the loop yourself in `handleHotUpdate`, which receives the changed `file`. The documented
options for the hook include:

> *"Return an empty array and perform a full reload"*

⚠️ **What the Plugin API page does not document.** Invalidating *only* the virtual module needs a
module-graph lookup by id. The page shows `server.moduleGraph.invalidateModule(mod, invalidatedModules, timestamp, true)`
operating on modules the hook was **already handed** — it does not document a lookup-by-id call, and
I could not confirm one from this page. If you want a narrower invalidation than a full reload,
verify it against the JavaScript API documentation first; the reload is the option the Plugin API
page actually sanctions.

---

## 2. Real-World Engineering Scenario

A team ships `virtual:flags`, generated from a `flags.json` a product manager edits. Two reports
arrive in the first week.

The first is from an engineer: editing `flags.json` does nothing until the dev server is restarted.
That is the missing watcher mapping — correct behaviour for a module with no file, and invisible in
the plugin's own tests because a fresh dev server always reads the current JSON.

The second is from a consumer of the published package: `tsc --noEmit` fails in their CI with
`Cannot find module 'virtual:flags'`, although the app builds and runs. That is the missing ambient
declaration. Their build works because Vite resolves it; their type-check fails because TypeScript
never sees Vite's answer. The plugin author's instinct — "it works, so their tsconfig is wrong" — is
the wrong diagnosis, and telling a user to write declarations for *your* module's API is the wrong
fix.

Both are one-time costs paid in the plugin, and both are permanent bugs if paid nowhere.

---

## 3. Production-Grade Code Example

The plugin from [Virtual Modules](01s-virtual-modules.md), extended with the two things a shipped
version needs: freshness, and types.

```js
// vite-plugin-flags/index.js
import fs from 'node:fs'
import path from 'node:path'
import { exactRegex } from '@rolldown/pluginutils'

const VIRTUAL_ID = 'virtual:vite-plugin-flags/flags'
const RESOLVED_ID = '\0' + VIRTUAL_ID

export default function flags({ file = 'flags.json' } = {}) {
  let absoluteFile

  return {
    name: 'vite-plugin-flags',

    configResolved(config) {
      // Resolve against the project root, not __dirname or cwd.
      absoluteFile = path.resolve(config.root, file)
    },

    resolveId: {
      filter: { id: exactRegex(VIRTUAL_ID) },
      handler(id) {
        if (id !== VIRTUAL_ID) return null // backward compatibility
        return RESOLVED_ID
      },
    },

    load: {
      filter: { id: exactRegex(RESOLVED_ID) },
      handler(id) {
        if (id !== RESOLVED_ID) return null // backward compatibility
        const json = JSON.parse(fs.readFileSync(absoluteFile, 'utf8'))
        return `export default ${JSON.stringify(json)}`
      },
    },

    // No file backs the virtual module, so map the change ourselves.
    handleHotUpdate({ file: changed, server }) {
      if (changed !== absoluteFile) return
      server.ws.send({ type: 'full-reload' })
      return []
    },
  }
}
```

Shipped alongside it, referenced from the package's `types` or documented for the consumer to add
to their `include`:

```ts
// vite-plugin-flags/client.d.ts
declare module 'virtual:vite-plugin-flags/flags' {
  const flags: Record<string, boolean>
  export default flags
}
```

Three details that matter: the specifier is namespaced with the plugin name; `absoluteFile` is
derived from `config.root` in `configResolved` rather than from `__dirname`, so it is correct in a
monorepo and in a container; and the `handleHotUpdate` comparison is against that same resolved
absolute path, because the hook's `file` is absolute.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Assuming a virtual module participates in HMR for free
It participates as a module, but nothing links it to the *data* it was built from. Every virtual module derived from a file needs an explicit `handleHotUpdate`, or it is only as fresh as the last server start.

### ⚠️ Pitfall 2 — Shipping no type declaration
The plugin author has the types; the consumer has the error. A `.d.ts` in the package costs one file and removes a class of issue that otherwise reaches your tracker as "does not work with TypeScript".

### ⚠️ Pitfall 3 — A `.d.ts` outside the consumer's `include`
An ambient declaration only applies if TypeScript loads the file. Dropping it somewhere `tsconfig.json` does not cover produces exactly the same error as having no declaration at all, which is why "I added the d.ts" is not the end of the diagnosis.

### ⚠️ Pitfall 4 — An unnamespaced specifier
`virtual:config` is a name two plugins will pick. Resolution then goes to whichever `resolveId` answers first — decided by plugin order, silently, with no warning that a collision happened.

### ⚠️ Pitfall 5 — Resolving the data file from `__dirname` or `process.cwd()`
Both are wrong in a monorepo and in a container. `configResolved` hands you `config.root`; resolve against it once and store the absolute path.

### ⚠️ Pitfall 6 — Reaching for a narrower invalidation you have not verified
Invalidating one virtual module instead of reloading the page is attractive, but the Plugin API page documents `invalidateModule` only against modules the hook was already given. Check the JavaScript API docs before writing a lookup-by-id; a full reload is the documented option here.

---

## Gotchas

**★ Symptom: `Cannot find module 'virtual:build-info' or its corresponding type declarations`, while the app builds and runs.** Cause: Vite resolves the specifier through your plugin; TypeScript resolves against the filesystem and never sees that answer. Fix: an ambient declaration, shipped with the plugin.

```ts
declare module 'virtual:build-info' {
  export const commit: string
}
```

**★ Symptom: the declaration was added and the error persists.** Cause: the `.d.ts` is not inside the consumer's `tsconfig.json` `include`, so TypeScript never loads it. Fix: put it under an included directory, or reference the plugin's own types entry — an ambient declaration in an unloaded file has no effect.

**★ Symptom: editing the JSON that feeds a virtual module changes nothing until the server restarts.** Cause: the virtual module has no file, so `handleHotUpdate`'s `modules` — *"an array of modules that are affected by the changed file"* — never contains it. Fix: map the file to a reload yourself.

```js
handleHotUpdate({ file, server }) {
  if (file !== absoluteFile) return
  server.ws.send({ type: 'full-reload' })
  return []
}
```

**★ Symptom: the `handleHotUpdate` check never fires although the file is clearly saved.** Cause: the comparison used a relative path or a suffix test while the hook's `file` is absolute. Fix: compare against a path resolved from `config.root` in `configResolved`.

**★ Symptom: two plugins both provide `virtual:config` and one silently wins.** Cause: the first `resolveId` to return a value ends resolution, so the winner is plugin order. Fix: namespace with the plugin name, as the convention advises — `virtual:my-plugin/config`.

**★ Symptom: the plugin works in the app repo and reads the wrong file in a monorepo.** Cause: the data file was resolved from `__dirname` or `process.cwd()`, neither of which is the Vite project root. Fix: `path.resolve(config.root, file)` inside `configResolved`.

**★ Symptom: a stale value survives an edit even after a manual browser refresh.** Cause: the reload was never sent, so nothing invalidated the module — a refresh alone does not force the dev server to re-run `load` for a module the graph still considers current. Fix: the `handleHotUpdate` above; and if you need finer invalidation than a reload, verify the API against the JavaScript API docs first, because the Plugin API page does not document a lookup by id.

---

## Interview questions

**★ Why does TypeScript fail on a virtual module that Vite resolves perfectly well?**
Because they are two independent resolvers. Vite answers the specifier at bundle time through your
plugin's `resolveId` hook; TypeScript answers it before that, with its own algorithm, against the
filesystem — and there is no file. Nothing communicates the plugin's answer to `tsc`, so the fix is
an ambient `declare module` block that asserts the module's shape. The detail that trips people
twice is that the declaration must be in a file TypeScript actually loads: a `.d.ts` outside the
consumer's `include` produces the identical error and looks like the fix did not work.

**★ A virtual module is generated from a JSON file. Why does editing the JSON do nothing in dev?**
Because HMR is file-driven and your module has no file. `handleHotUpdate` is handed *"an array of
modules that are affected by the changed file"*, and the relationship between `flags.json` and
`virtual:flags` exists only inside your plugin — nothing in the module graph records it, so the
array does not contain the virtual module and nothing is invalidated. You close the loop yourself:
compare the hook's `file` against the path you resolved, then take the documented option — *"Return
an empty array and perform a full reload"*. A narrower invalidation may be possible, but the Plugin
API page does not document a module-graph lookup by id, so I would verify it before relying on it.

**★ How do you avoid two plugins claiming the same virtual specifier?**
By namespacing, which is what the convention is for: *"If possible the plugin name should be used
as a namespace to avoid collisions with other plugins in the ecosystem."* So `virtual:my-plugin/config`
rather than `virtual:config`. It matters more than it looks, because a collision has no failure
mode that announces itself — the first `resolveId` to return a value wins, so the outcome depends
on plugin order, and the losing plugin simply appears not to work. There is no registry and no
documented collision warning, so the naming discipline is the entire defence.

**★ Where should a plugin resolve a data file from, and why not `__dirname`?**
From `config.root`, captured in `configResolved`. `__dirname` is where the plugin's own code lives —
inside `node_modules` for a published plugin — and `process.cwd()` is wherever the command happened
to be run, which differs between a monorepo package script, a CI job and a container. `config.root`
is the project root Vite itself resolved, so a path derived from it is the same path Vite is using.
The symptom of getting this wrong is a plugin that works in the repo it was developed in and reads
the wrong file, or no file, everywhere else.

**★ What is the cost of answering a data-file change with a full page reload?**
You lose client state, which is the thing HMR exists to preserve, and in a large app the reload is
the slowest possible response. It is still the right default here for two reasons: it is the option
the documentation sanctions for this hook, and for build-time data the value is baked into the
module's source, so a partial update would have to re-run `load` and re-evaluate every importer
anyway. The honest framing for a review is that a reload is correct and coarse; anything narrower
is an optimisation you should verify against the JavaScript API docs before shipping.

---

← [Virtual Modules](01s-virtual-modules.md) · [Vite overview](../../README.md) · Next → [Rolldown Compatibility](01t-rolldown-compatibility-and-paths.md)
