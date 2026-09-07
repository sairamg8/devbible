---
title: "Path Normalization and `createFilter`: the Windows Bug Nobody on Your Team Can Reproduce"
sidebar_label: "Path Normalization & Filters"
sidebar_position: 42
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Path Normalization](https://vite.dev/guide/api-plugin), [§ Filtering, include/exclude pattern](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings, and no Windows machine was used** — the platform behaviour below is quoted from the documentation, not observed.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Path Normalization and `createFilter`

A plugin that compares a path against a module id is correct on macOS, correct on Linux, correct in
CI, and wrong on Windows. **The bug is invisible to everyone who could diagnose it**, which is what
makes it worth a page.

---

## 1. Under-The-Hood Mechanics

### The two conventions

> *"Vite normalizes paths while resolving ids to use POSIX separators ( / ) while preserving the volume in Windows. On the other hand, Rollup keeps resolved paths untouched by default, so resolved ids have win32 separators ( \ ) in Windows."*

```
                        macOS / Linux          Windows
Vite resolved id        /src/main.ts           C:/src/main.ts     ← POSIX, volume kept
Rollup resolved id      /src/main.ts           C:\src\main.ts     ← win32
path.join(root,'src')   /repo/src              C:\repo\src        ← win32, ALWAYS
```

On every macOS and Linux machine the three forms coincide. On Windows the third disagrees with the
first, and `id.includes(prefix)` is false for every module.

### Why third-party plugins mostly survive it

> *"Rollup plugins use a [`normalizePath` utility function](https://github.com/rollup/plugins/tree/master/packages/pluginutils#normalizepath) from `@rollup/pluginutils` internally, which converts separators to POSIX before performing comparisons. This means that when these plugins are used in Vite, the `include` and `exclude` config pattern and other similar paths against resolved ids comparisons work correctly."*

So you are not being held to a higher standard than the ecosystem — you are simply missing a utility
that everyone else imported. Vite exports the equivalent:

> *"So, for Vite plugins, when comparing paths against resolved ids it is important to first normalize the paths to use POSIX separators. An equivalent `normalizePath` utility function is exported from the `vite` module."*

```js
import { normalizePath } from 'vite'

normalizePath('foo\\bar') // 'foo/bar'
normalizePath('foo/bar')  // 'foo/bar'
```

### 🔴 Normalize the value you built, not the id

Vite already normalized the id. What has *not* been normalized is whatever came out of `path.join`,
`__dirname`, or a user's config option:

```
id                    ← already POSIX. normalizePath(id) is a no-op.
path.join(root,'src') ← win32 on Windows. THIS is the one to normalize.
```

Calling `normalizePath` on the id is harmless and leaves the bug in place, which makes it a
particularly convincing wrong fix.

### `createFilter`, for user-facing scope

> *"Vite exposes [`@rollup/pluginutils`'s `createFilter`](https://github.com/rollup/plugins/tree/master/packages/pluginutils#createfilter) function to encourage Vite specific plugins and integrations to use the standard include/exclude filtering pattern, which is also used in Vite core itself."*

It is the config-facing sibling of the [hook filters](01r-hook-filters.md), and they solve different
problems:

| | Purpose | Declared |
|---|---|---|
| **hook filter** | avoid crossing the Rust↔JS boundary at all | on the hook, by the plugin author |
| **`createFilter`** | honour the user's `include`/`exclude` options | inside the handler, from user config |

Most real plugins want both — a hook filter for the file types the plugin could ever handle, and
`createFilter` for the subset this user asked for.

---

## 2. Real-World Engineering Scenario

**One contractor, one Windows laptop, three weeks of "cannot reproduce".**

A team's plugin instrumented files under a source directory:

```ts
transform(code, id) {
  if (!id.includes(path.join(config.root, 'src'))) return null;
  return instrument(code);
}
```

Correct on macOS and Linux, where `path.join` produces `/repo/src` and the resolved id contains it.
The whole team was on macOS; CI was Linux.

Then a contractor joined on Windows. Nothing was instrumented — no error, no warning, just a feature
that silently did not apply. Three separate calls were spent trying to reproduce it. The working
theory became a corrupted `node_modules`, then a bad Node install, then — inevitably — the
contractor's machine.

The cause is two sentences in the docs. Vite's resolved id was `C:/repo/src/main.ts`: POSIX
separators, volume preserved. `path.join(config.root, 'src')` on Windows produced `C:\repo\src`. The
`includes` check compared a POSIX string against a win32 string and was false for every file.

The fix is one import.

**Two lessons.** The technical one: any string you compare against a resolved id must be normalized,
because Vite already normalized the id and your string came from somewhere else. The other is about
the failure's *shape* — a defect invisible to the entire team and to CI, and visible only to the
person with the least standing to insist it is real, will be attributed to that person's machine
unless someone knows this class exists.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Path comparison that works on every platform.
import path from 'node:path';
import { normalizePath } from 'vite';
import type { Plugin, ResolvedConfig } from 'vite';

export function instrumentSrc(): Plugin {
  let config: ResolvedConfig;
  let prefix: string;

  return {
    name: 'instrument-src',
    configResolved(c) {
      config = c;
      // 🔴 Normalize the value you BUILT. Vite already normalized the ids.
      prefix = normalizePath(path.join(config.root, 'src'));
    },
    transform(code, id) {
      // `id` is already POSIX with the volume preserved: C:/repo/src/main.ts
      return id.includes(prefix) ? instrument(code) : null;
    },
  };
}
```

```typescript
// ⛔ The bug. Identical behaviour on macOS and Linux; false for every module on Windows.
transform(code, id) {
  if (!id.includes(path.join(config.root, 'src'))) return null;   // C:\repo\src
  return instrument(code);
}

// ⛔ The convincing WRONG fix — normalizing the side that was already normalized.
// if (!normalizePath(id).includes(path.join(config.root, 'src'))) return null;
```

```typescript
// ✅ `createFilter` — the conventional shape for user-facing include/exclude options.
import { createFilter, normalizePath } from 'vite';

export function myPlugin(options: { include?: string[]; exclude?: string[] } = {}): Plugin {
  const filter = createFilter(options.include, options.exclude);
  return {
    name: 'my-plugin',
    transform: {
      // Hook filter: the Rust<->JS boundary optimisation (chunk 1r).
      filter: { id: /\.[jt]sx?$/ },
      handler(code, id) {
        // createFilter: the user's include/exclude option. Most plugins want BOTH.
        if (!filter(id)) return null;
        return { code: transformCode(code), map: null };
      },
    },
  };
}
```

```bash
# The audit. Any of these compared against a module id is a latent Windows bug.
grep -rn "path.join\|__dirname\|path.resolve" src/plugins/ | grep -v normalizePath
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Comparing an unnormalized path against a resolved id

Vite normalizes ids to POSIX separators with the Windows volume preserved. Anything built with
`path.join`, `__dirname` or a config value has not been normalized, and the mismatch is invisible off
Windows.

### ⚠️ Pitfall 2 — Normalizing the id instead of your string

The id is already normalized, so this changes nothing and looks like a fix. It is the most
convincing wrong answer available.

### ⚠️ Pitfall 3 — Using only a hook filter, or only `createFilter`

They solve different problems: hook filters are the Rust↔JS boundary optimisation, `createFilter` is
the user-facing include/exclude convention. A plugin with configurable scope wants both.

### ⚠️ Pitfall 4 — Concluding "works on my machine" is a machine problem

A path-separator defect is invisible to every macOS and Linux developer and to CI, and visible only
on Windows. The absence of a reproduction across the team is *consistent with* the bug, not evidence
against it.

### ⚠️ Pitfall 5 — Assuming a POSIX id means no volume

Vite preserves the volume — `C:/repo/src/main.ts`, not `/repo/src/main.ts`. A check anchored on a
leading `/` fails on Windows even after normalization.

### ⚠️ Pitfall 6 — Comparing against a literal or `__dirname` rather than `config.root`

A prefix baked from `__dirname` also breaks in containers and monorepos, where the layout differs.
Derive prefixes from the resolved `config.root` in `configResolved`.

---

## Gotchas

**★ Symptom: a plugin does nothing for one developer, and only on Windows.** Cause: a path comparison against an unnormalized string — Vite resolves ids to POSIX separators with the volume preserved, `path.join` on Windows produces backslashes. Fix: normalize the value you built.

```ts
import { normalizePath } from 'vite';
const prefix = normalizePath(path.join(config.root, 'src'));
```

**★ Symptom: `normalizePath` was added and nothing changed.** Cause: it was applied to the id, which Vite had already normalized — exactly what `normalizePath('foo/bar') // 'foo/bar'` documents. Fix: apply it to the other side of the comparison.

**★ Symptom: an `include`/`exclude` option a user passed has no effect.** Cause: the option was accepted and never applied — a hook filter constrains the hook, not the user's patterns. Fix: `createFilter(include, exclude)` and call it inside the handler; the two mechanisms are complementary.

**★ Symptom: a check like `id.startsWith('/src/')` fails on Windows after normalization.** Cause: normalization converts separators, it does not remove the volume — the id is `C:/repo/src/main.ts`. Fix: compare against a normalized absolute prefix derived from `config.root`, never against a leading-slash literal.

**★ Symptom: a third-party Rollup plugin handles Windows correctly and yours does not.** Cause: it uses `@rollup/pluginutils`'s `normalizePath` internally, which the docs note is why *"the `include` and `exclude` config pattern … work correctly"*. Fix: use Vite's exported equivalent — you are missing a utility, not a standard.

**★ Symptom: a path check works locally and fails in a container.** Cause: usually not separators — the container's `root` differs, so an absolute prefix baked from `__dirname` or a literal does not match. Fix: derive prefixes from `config.root` in `configResolved`.

**★ Symptom: a glob passed to `createFilter` matches nothing on Windows.** Cause: the pattern was built by joining paths, so it contains backslashes, which glob syntax treats as escapes rather than separators. Fix: normalize the pattern before passing it, exactly as for a comparison prefix.

**★ Symptom: a Windows-only bug is reported, dismissed, and reappears months later.** Cause: nobody on the team can reproduce it, so it is closed as unreproducible. Fix: treat "only on Windows, in a path comparison" as a specific, known class with a one-line fix — and add the `grep` audit above to review, since the defect is trivially detectable statically and effectively undetectable dynamically.

**★ Symptom: two plugins disagree about whether a file is in scope.** Cause: one normalizes and one does not. Fix: this is the same bug wearing a different symptom, and it is worth checking before assuming an ordering problem — divergent *scope* looks a lot like divergent *order*.

---

## Interview questions

**★ Why is a path-separator bug so hard to diagnose?**
Because it is invisible to everyone who could diagnose it. Vite normalizes resolved ids to POSIX
separators while preserving the Windows volume, so an id is `C:/repo/src/main.ts`; a prefix built
with `path.join` on the same machine is `C:\repo\src`. On macOS and Linux the two forms coincide, so
the check passes for the whole team and for CI, and fails only on Windows — typically for the newest
person, who has the least standing to insist it is not their machine. The fix is one import, and the
diagnostic lesson is that *absence of a reproduction across the team* is consistent with this class
of bug rather than evidence against it.

**★ Which side of the comparison do you normalize?**
The one you built. Vite has already normalized the resolved id, so calling `normalizePath` on it is
a no-op that hides the real problem; the unnormalized value is whatever came out of `path.join`,
`__dirname`, or a user's config option. The docs put it as an instruction — *"when comparing paths
against resolved ids it is important to first normalize the paths"* — and the reason third-party
Rollup plugins mostly escape this is that `@rollup/pluginutils` normalizes internally, which is why
their `include`/`exclude` patterns work in Vite unchanged. The wrong fix is unusually convincing
here, because it compiles, reads correctly, and changes nothing.

**★ What is the difference between a hook filter and `createFilter`?**
Different layers, and most real plugins want both. A hook filter is declared on the hook —
`transform: { filter: { id }, handler }` — and exists to reduce the Rust↔JS boundary crossings, so it
is about not invoking the handler at all. `createFilter` is the conventional shape for a user-facing
`include`/`exclude` **option**, which Vite exposes from `@rollup/pluginutils` *"to encourage Vite
specific plugins and integrations to use the standard include/exclude filtering pattern, which is
also used in Vite core itself."* One is your plugin's own scope, fixed by you; the other is scope
your users configure.

**★ Does normalizing a path make it platform-independent?**
Not entirely, and the gap catches people who think they have fixed it. Normalization converts
separators; it does not remove the **volume**, which the docs say Vite deliberately preserves. So a
normalized Windows id is `C:/repo/src/main.ts`, and a check anchored on a leading `/` — `startsWith('/src/')`
— still fails. The reliable pattern is to compare against a normalized absolute prefix derived from
`config.root`, which is correct on every platform and additionally survives containers and
monorepos, where a prefix baked from `__dirname` would not.

**★ How would you find this class of bug proactively?**
Statically, because dynamically you cannot: `grep -rn "path.join\|__dirname\|path.resolve" src/plugins/ | grep -v normalizePath`
lists every place a path was constructed without normalization. That is a five-second check and it is
strictly better than testing, since no test on a macOS or Linux runner can distinguish the correct
code from the broken code. It is a good general illustration too — when a defect is invisible on the
platforms you run CI on, the control has to be a lint rather than a test, because tests can only see
what the runner can reproduce.

---

← [Rolldown Compatibility](01t-rolldown-compatibility-and-paths.md) · [Vite overview](../../README.md) · Next → [CSS Handling](../09-css-handling/01-styling-pipeline.md)
