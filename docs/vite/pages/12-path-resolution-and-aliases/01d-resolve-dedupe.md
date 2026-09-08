---
title: "resolve.dedupe forces every listed import to resolve to one copy at the project root — it fixes the two-React-instances bug by controlling resolution, not by touching node_modules, and it cannot fix a genuine version incompatibility"
sidebar_label: "01d · resolve.dedupe"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the Vite documentation — [Shared Options](https://vite.dev/config/shared-options), [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ resolve.dedupe

**`resolve.dedupe` is a resolution rule, not a `node_modules` cleanup tool — the distinction is the whole content of this page.** When a monorepo or a hoisting-unfriendly dependency tree ends up with two physically separate copies of the same package on disk, every import of that package still needs to land on the *same* module instance for anything relying on shared internal state — React's hook dispatcher being the canonical example — to work. `resolve.dedupe` makes Vite's resolver answer every matching import with one specific copy, from one specific location, regardless of how many other copies physically exist. It changes what gets *chosen*; it never changes what gets *installed*.

## The mechanism, precisely

> *"If you have duplicated copies of the same dependency in your app (likely due to hoisting or linked packages in monorepos), use this option to force Vite to always resolve listed dependencies to the same copy (from project root)."* — [Shared Options](https://vite.dev/config/shared-options)

Type: `string[]`. Read the parenthetical literally — *"from project root"* is not incidental phrasing, it is the target location dedupe resolves to. Every matching import, no matter which package in the tree does the importing or how deeply nested that package is, is answered with the copy that exists at the project root's `node_modules`, not "whichever copy dedupe happens to see first."

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});
```

That single option is doing exactly one thing: every `import { useState } from 'react'`, from the app's own code and from every dependency's code, resolves to `<project-root>/node_modules/react`, full stop. Nothing on disk moved. Nothing was deleted, deduplicated in the literal sense, or reinstalled.

## The bug it exists to fix, and why the mechanism matches the symptom

A shared UI library that lists `react` as a real dependency (rather than strictly as a peer dependency) can end up with its *own* nested copy of `react` once a package manager's hoisting decides the versions don't unify cleanly enough to hoist to one place. The app then has two `react` packages on disk — one at the project root, one nested inside the library's own `node_modules`. Each copy has its own internal module-level state, including the hook dispatcher React attaches per-instance. A component from the library calls a hook using *its* copy of React's dispatcher; the app's own render tree is running on the *other* copy's dispatcher. The library's hook call throws, because from that copy's point of view, there is no active render happening — the active render is happening on the other instance entirely.

`resolve.dedupe: ['react', 'react-dom']` fixes this because the bug's actual cause is "two resolvers answer the same import differently," not "two files exist on disk." Forcing every resolution of `react`/`react-dom`, from anywhere in the graph, to the identical project-root copy means there is exactly one dispatcher in the running process, and the library's hook call and the app's render are now, by construction, using it.

```typescript
// vite.config.ts — the shared-library-with-its-own-react-copy scenario
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'], // force ONE instance across the whole resolved graph
  },
});
```

## What it cannot fix — the boundary the docs' own wording draws

Nothing in the quoted description claims dedupe reconciles *incompatible* versions — it forces one resolution target, and if the versions genuinely diverge in required API surface, forcing them together does not make the API surface converge; it just picks which mismatched copy everyone gets.

```typescript
// ❌ WRONG intuition: "dedupe fixes version conflicts"
// If ui-kit was built and tested against react@18 and the project root has react@19
// with genuinely incompatible internals, dedupe: ['react'] forces ui-kit onto
// react@19 anyway. This can convert a "two instances, hooks break" failure into a
// "one instance, but ui-kit calls an API react@19 changed or removed" failure —
// which may be quieter and harder to attribute back to the dedupe line.
resolve: { dedupe: ['react'] },

// ✅ CORRECT fix for a genuine version mismatch: align the declared ranges so a
// package manager can hoist to one copy on its own, which is the state dedupe is
// standing in for rather than replacing.
```

```json
// package.json — the actual fix for a true incompatibility: align ranges, or make
// react a peerDependency in the shared package so it never ships its own copy
{
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

The old seed content on this topic put it plainly, and it holds: for genuinely incompatible version requirements, the correct fix is aligning the declared version ranges across the monorepo — `dedupe` is the tool for a *resolution* ambiguity between compatible copies, not a substitute for that alignment.

## Interaction with dependency pre-bundling

`resolve.dedupe` runs at the resolver level, and dependency pre-bundling — the Rolldown-driven step covered in **[Dependency pre-bundling](../11-optimization-and-performance/01a-dependency-pre-bundling.md)** — consumes whatever the resolver hands it. That ordering matters: if `react` resolves to one project-root copy before the optimizer ever scans for entry points, the optimizer sees one `react` to pre-bundle, not two. Without `dedupe`, an unlucky dependency graph could have the scanner discover two physically distinct `react` packages as two separate bare-import targets, and pre-bundle each independently — which reproduces the two-instance bug at the optimized-dependency layer instead of fixing it.

The pre-bundle cache's own documented key is a further, separate reason changing `resolve.dedupe` matters operationally, not just architecturally. **[The pre-bundle cache](../11-optimization-and-performance/01b-the-pre-bundle-cache.md)** documents the cache in `node_modules/.vite` as keyed on, among other things, *"Relevant fields in your `vite.config.js`, if present."* The documentation does not enumerate which fields count as "relevant," so treat `resolve.dedupe` as a config field the cache key is reasonably expected to track rather than as a confirmed-by-name entry — and if a `dedupe` change is not picked up, `vite --force` (or deleting `node_modules/.vite`) is the documented, unconditional escape hatch regardless of whether that specific field is tracked.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // if a dedupe change doesn't seem to take effect on the next dev start,
    // force a re-bundle explicitly rather than assuming the cache tracked it
    force: false, // flip to true for one run, or use `vite --force` on the CLI
  },
});
```

## The SSR caveat

`resolve.dedupe` is not universally applied across every build target — the documentation names one output shape where it explicitly does not apply:

> *"For SSR builds, deduplication does not work for ESM build outputs configured from `build.rolldownOptions.output`."* — [Shared Options](https://vite.dev/config/shared-options)

An app hitting the two-instances symptom specifically in its SSR bundle, while the client bundle is fine, should treat this as the first thing to check rather than assuming `dedupe` is simply not working — it may not be operating on that output at all.

## Gotchas

**★ Symptom: "Invalid hook call" errors from components inside a shared internal package, but not from the app's own components.** Cause: the shared package ships its own nested copy of `react` (often because it lists `react` as a real dependency rather than a peer dependency), and hoisting left two physically separate copies on disk with two separate hook dispatchers. Fix:
```typescript
resolve: { dedupe: ['react', 'react-dom'] },
```

**★ Symptom: after adding `resolve.dedupe: ['some-lib']`, the app still crashes, but with a *different* error — a missing export or an API the dependency's older copy didn't have.** Cause: the versions were never merely duplicated, they were genuinely incompatible; dedupe forced everyone onto one copy, and the code written against the other copy's API surface is now calling something that copy doesn't provide. Fix: this is not a dedupe problem — align the declared version ranges (or make the dependency a `peerDependency` in the package that shouldn't own its own copy) so the mismatch is resolved at the dependency-graph level, not papered over at the resolver level.

**★ Symptom: `resolve.dedupe` is set, and the client bundle is fine, but the exact same "two instances" symptom appears only in server-rendered output.** Cause: documented exception — *"For SSR builds, deduplication does not work for ESM build outputs configured from `build.rolldownOptions.output`"*. Fix: treat the SSR output as a separate resolution surface that this option does not cover for that output shape; do not assume the client-side fix necessarily carries over.

**★ Symptom: `resolve.dedupe: ['react']` was added, and a package that only ever depended on `react` transitively (never listing it directly) now fails to resolve it at all.** Cause: dedupe resolves to the copy *"from project root"* — if the project root's own `node_modules` genuinely has no `react` installed (only a nested copy exists, and nothing at the top level ever declared it), there is nothing at the root for dedupe to point at. Fix: add the package as an explicit dependency at the project root (even if only to pin the version) so a root copy actually exists for dedupe to resolve to.

**★ Symptom: a `resolve.dedupe` entry was added mid-project, and the dev server keeps behaving as if it wasn't — the two-instance bug persists across a restart.** Cause: the pre-bundle cache in `node_modules/.vite` may not have picked up the config change; the documentation names "Relevant fields in your `vite.config.js`" as one of the cache's inputs but does not enumerate which fields qualify. Fix: force a re-bundle explicitly rather than assuming the cache tracked the change — `vite --force` on the CLI, or `optimizeDeps.force: true` for one run.

## Interview questions

**★ Why does `resolve.dedupe` fix "Invalid hook call" without touching `node_modules` at all?**
Because the actual defect is a resolution-time ambiguity, not a filesystem-layout problem. Two physically separate copies of React each carry their own internal state — including the hook dispatcher a component's hook calls read from — and the bug occurs when a component ends up calling into a *different* copy's dispatcher than the one running the current render. `resolve.dedupe` doesn't merge or delete either copy; it makes every matching import resolve to the one copy at the project root, so there is exactly one dispatcher instance in the running process regardless of how many `react` folders physically exist on disk.

**★ A colleague adds `dedupe: ['some-lib']` and the crash changes shape rather than disappearing. What does that tell you?**
That the two copies were never simply duplicates of the same working version — they were genuinely divergent, and forcing one resolution target didn't remove the divergence, it just committed the whole graph to one specific copy's API surface. Code elsewhere that was written against the *other* copy's surface now fails differently. This is the tell that the real fix is aligning declared version ranges (or converting the dependency to a peer dependency in whichever package shouldn't own its own copy), not tuning `dedupe` further.

**★ What does "from project root" in the `resolve.dedupe` documentation actually constrain, and what happens if there's nothing there to resolve to?**
It names the specific copy dedupe resolves every matching import to — the project root's own `node_modules`, not "the first copy found" or "the newest copy." That has a precondition baked in: a copy of the package must actually exist at the project root for dedupe to point at. If the root has never declared the package directly and only a nested copy exists somewhere deep in the tree, adding it to `dedupe` has nothing at the root to resolve to, and the fix is to add it as a real dependency at the root first — even a version-pinning-only entry — before dedupe can do anything.

**★ Why might `resolve.dedupe` appear to have no effect immediately after being added to `vite.config.ts`?**
Because dependency pre-bundling caches its output in `node_modules/.vite`, keyed on inputs the documentation lists only generally as "relevant fields" in the config file, without naming which specific fields qualify. If the cache doesn't treat a `dedupe` change as invalidating, the dev server can keep serving a pre-bundle produced under the old resolution rules. The unconditional fix, regardless of whether the field is tracked, is a forced re-bundle — `vite --force` or deleting `node_modules/.vite` — rather than assuming the config change alone is sufficient.

---

← [01c · resolve.extensions](01c-resolve-extensions.md) · [Vite overview](../../README.md) · Next → [01e · preserveSymlinks & linked packages](01e-preserve-symlinks-and-linked-packages.md)
