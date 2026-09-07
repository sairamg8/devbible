---
title: "Vite 8 removed the object form of manualChunks and deprecated the function form, and the replacement is not a rename — codeSplitting is a declarative group system with priorities, not a per-module callback"
sidebar_label: "01d · Chunk splitting after manualChunks"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Migration from v7](https://vite.dev/guide/migration), [Build Options](https://vite.dev/config/build-options) — and the Rolldown reference — [`output.codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting), [Manual Code Splitting](https://rolldown.rs/in-depth/manual-code-splitting). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Chunk Splitting After `manualChunks`

**A chunk boundary is a cache boundary, and Vite 8 took away the two most common ways of drawing one.** The object form of `output.manualChunks` — the `{ 'react-vendor': ['react', 'react-dom'] }` shape that appears in thousands of configs — is gone. The function form still runs and is deprecated. The named replacement is Rolldown's `codeSplitting`, and it is a genuinely different model: instead of one callback returning a chunk name per module, you declare a list of groups with match predicates, priorities and size constraints, and the bundler resolves them. Porting is a design exercise because the old form encoded a *list of packages* while the new one encodes a *policy*.

## 1. Under-The-Hood Mechanics

### What v8 removed

The migration guide's heading is *"Removed object form `build.rollupOptions.output.manualChunks` and deprecate function form one"*, and the body is one paragraph:

> *"The object form `output.manualChunks` option is not supported anymore. The function form `output.manualChunks` is deprecated. Rolldown has the more flexible [`codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting) option. See Rolldown's docs for more details about `codeSplitting`: [Manual Code Splitting - Rolldown](https://rolldown.rs/in-depth/manual-code-splitting)."* — [Migration from v7](https://vite.dev/guide/migration)

| Form | Status on Vite 8 | Use it? |
|---|---|---|
| `output.manualChunks: { 'react-vendor': ['react'] }` | **not supported anymore** | ⛔ no — it must be ported |
| `output.manualChunks: (id) => …` | **deprecated**, still shipped | ⚠️ migration stopgap only |
| `output.codeSplitting: { groups: [...] }` | the named replacement | ✅ the destination |

⚠️ **The migration guide does not state whether Vite errors on the object form or ignores it.** Do not rely on a build failure to tell you the port is needed — diff the `dist/` file list across the upgrade.

### What `codeSplitting` is

> *"Controls how code splitting is performed."*
> * *"`true`: Default behavior, automatic code splitting. **(default)**"*
> * *"`false`: Inline all dynamic imports into a single bundle (equivalent to deprecated `inlineDynamicImports: true`)."*
> * *"`object`: Advanced manual code splitting configuration."*
> — [Rolldown, `output.codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting)

Manual and automatic splitting coexist:

> *"Automatic code splitting and manual code splitting are not contradictory. Using manual code splitting does not mean disabling automatic code splitting. A module will be either captured by automatic code splitting or manual code splitting depending on your configuration, but not both. If a module is not captured by manual code splitting, it will still be put into a chunk which is created by automatic code splitting"* — [Manual Code Splitting](https://rolldown.rs/in-depth/manual-code-splitting)

So a `groups` list is not a partition of your module graph. It is a set of claims over it, and everything unclaimed falls through to the automatic algorithm.

### Why you would override the automatic algorithm at all

> *"The automatic code splitting doesn't take loading performance or cache invalidation into account. It simply groups modules based on their static imports. This can lead to suboptimal chunking, where large chunks are created that may not be performant for loading or cause cache invalidation for every deployment."* — [Manual Code Splitting](https://rolldown.rs/in-depth/manual-code-splitting)

That is the entire argument, and it is a *caching* argument, not a size argument. The in-depth guide walks it: with no manual grouping, application code and library code land in the same output file, so changing one line of `App.jsx` changes that file's hash and the browser re-downloads the libraries with it. Pulling `node_modules` into its own group means the library chunk's hash is unchanged across that deploy and the browser reuses it.

```text
BEFORE  output-hash0.js   [ react + react-dom + ui-lib + App + index ]
        edit App  ──►  output-hash1.js   ← entire file re-downloaded

AFTER   output-hash0.js   [ App + index ]      libs-hash0.js  [ react + react-dom + ui-lib ]
        edit App  ──►  output-hash1.js         libs-hash0.js  ← unchanged, served from cache
```

### The shape, quoted from the reference

```js
export default defineConfig({
  output: {
    codeSplitting: {
      minSize: 20000,
      groups: [
        {
          name: 'vendor',
          test: /node_modules/,
        },
      ],
    },
  },
});
```

⚠️ **That example is a *Rolldown* config, quoted as printed.** The Vite documentation does not carry a `codeSplitting` example of its own. The Vite placement is `build.rolldownOptions.output.codeSplitting`, which follows from the build reference's description of the option — *"Directly customize the underlying Rolldown bundle. This is the same as options that can be exported from a Rolldown config file and will be merged with Vite's internal Rolldown options."* — but I am naming that as a derivation from the two documents, not as something either one shows.

### 🔴 The warning that makes this more than a config change

> *"Be aware that manual code splitting can change the behavior of the application if side effects are triggered before the corresponding modules are actually used. You can change the chunking configuration to keep order-sensitive modules together, or you can use the [`output.strictExecutionOrder`](https://rolldown.rs/reference/OutputOptions.strictExecutionOrder) option to preserve source execution order. The option wraps modules so their bodies run in source order, at a bundle-size cost; `experimental.onDemandWrapping` replaces wrap-all with a conservative plan derived from predicted chunk execution hazards."* — [Rolldown, `output.codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting)

Chunking rewrites module *execution order*, not just file layout. Any module with a top-level side effect — a polyfill, a CSS-in-JS registration, an i18n `init()`, a global patch — can now run at a different time relative to the code that depends on it. This is the failure mode people describe as "it works in dev and breaks in prod after we added vendor chunks", and it is the single strongest argument for treating a chunking change as a change that needs testing rather than a config tweak.

---

## 2. Real-World Engineering Scenario

**Scenario**: a Vite 7 → 8 upgrade in which the vendor chunks silently disappear.

The config had the canonical object form. After the upgrade the app still built, still passed tests, and still deployed — but every returning visitor started re-downloading React on every release, because the vendor grouping was no longer being applied and everything fell through to automatic splitting. Nothing failed; a caching property was quietly withdrawn.

The port is not mechanical, because the two forms encode different things. `{ 'react-vendor': ['react', 'react-dom'] }` is a list of package names decided when the config was written. A `codeSplitting` group is a predicate plus constraints evaluated against every module id. Restating the intent — *"these two libraries change on a different cadence from our app code, so they should share a cache lifetime"* — is what makes the new form correct, and it is also what surfaces the fact that the original list had drifted: `@tanstack/react-query` had been added to the app two years earlier and was never added to the vendor list.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — porting the object form to codeSplitting.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // v8 name. `build.rollupOptions` is a deprecated alias of this.
    rolldownOptions: {
      output: {
        // ⛔ WHAT THIS REPLACES, AND WHY IT CANNOT STAY:
        //    manualChunks: { 'react-vendor': ['react', 'react-dom'] }
        //    "The object form output.manualChunks option is not supported anymore."
        codeSplitting: {
          // Global floor: a group whose captured modules total less than this is
          // ignored and its modules fall back to automatic chunking.
          minSize: 20_000,
          groups: [
            {
              name: 'react-vendor',
              // '[\\/]' rather than '/' — the Rolldown docs recommend it so the
              // pattern also matches on Windows path separators.
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: 'data-vendor',
              test: /node_modules[\\/]@tanstack[\\/]/,
              priority: 15,
            },
            {
              // Catch-all for everything else in node_modules. LOWER priority, so
              // the two specific groups above claim their modules first.
              name: 'vendor',
              test: /node_modules/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
```

```typescript
// vite.config.ts — the deprecated stopgap, for a migration you cannot finish today.
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        // ⚠️ "The function form output.manualChunks is deprecated." It still runs.
        // Ship it to unblock an upgrade; do not treat it as the destination.
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'react-vendor';
          if (id.includes('node_modules/@tanstack')) return 'data-vendor';
          // Return nothing and let automatic splitting decide.
        },
      },
    },
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: translating the package list literally

```typescript
// ❌ A faithful translation of the old object form — and it reproduces its bug.
// The list was written once and never revisited; four libraries added since are
// still landing in whatever chunk automatic splitting puts them in.
groups: [{ name: 'react-vendor', test: /node_modules[\\/](react|react-dom)[\\/]/ }],

// ✅ Restate the INTENT as a policy: everything from node_modules changes on the
// dependency-upgrade cadence, not the deploy cadence, so it shares a cache lifetime.
groups: [{ name: 'vendor', test: /node_modules/, minSize: 20_000 }],
```

### ⚠️ Pitfall 2: forgetting that groups do not partition the graph

Modules not captured by any group are still chunked, by the automatic algorithm. A `groups` list is therefore never "complete", and adding a group changes the input to automatic splitting for everything else — which is why chunk names and hashes for *unrelated* code can move when you add one group.

### ⚠️ Pitfall 3: `/node_modules/react/` on Windows

> *"When using regular expression, it's recommended to use `[\\/]` to match the path separator instead of `/` to avoid potential issues on Windows."* — with `/node_modules[\\/]react/` marked ✅ Recommended and `/node_modules/react/` marked ❌ Not recommended. — [`CodeSplittingGroup.test`](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup)

A regex that only matches forward slashes produces a *different chunk graph* on a Windows developer's machine than in Linux CI. Nothing errors; the outputs simply differ.

---

## Gotchas

**★ Symptom: after upgrading to Vite 8 the vendor chunks vanish and everything lands in automatically-named chunks.** Cause: *"The object form `output.manualChunks` option is not supported anymore."* Fix: port to `codeSplitting` groups. Because the migration guide does not say whether the object form errors or is ignored, verify by diffing the emitted file list across the upgrade rather than waiting for a build failure.

**★ Symptom: the app throws on first paint in production only, immediately after a chunking change.** Cause: chunking changes execution order — *"manual code splitting can change the behavior of the application if side effects are triggered before the corresponding modules are actually used."* Fix: either keep the order-sensitive modules in one group, or set `output.strictExecutionOrder: true`, which the reference says *"wraps modules so their bodies run in source order, at a bundle-size cost"*. Reach for the grouping fix first; the wrapper is a global cost for a local problem.

**★ Symptom: chunk hashes differ between a Windows dev machine and Linux CI.** Cause: a `test` regex written with `/` instead of `[\\/]`, so it matches on one platform and not the other. Fix: `test: /node_modules[\\/]react/`. This one is dangerous because both builds succeed — you get two different cache-key universes for the same commit.

**★ Symptom: you added one vendor group and unrelated chunk names changed too.** Cause: captured modules are removed from the pool the automatic algorithm sees, so its output changes for everything else as well. Fix: expected behaviour, not a defect — but it does mean chunk names are not a stable contract. Anything referencing an emitted filename directly should read `build.manifest` instead of hardcoding a name.

**★ Symptom: a group you defined produced no chunk at all.** Cause: `minSize` — the accumulated size of the captured modules was under the floor. The reference: *"If the accumulated size of the captured modules by this group is smaller than this value, it will be ignored. Modules in this group will fall back to the `automatic chunking` if they are not captured by any other group."* Fix: lower `minSize` for that group, or accept the fallback. A group that never fires is not an error and will not warn you.

**★ Symptom: the function form of `manualChunks` emits a deprecation notice.** Cause: it is deprecated as of v8. Fix: it still runs, so ship it to unblock an upgrade — but book the real port. The two forms are not interchangeable at the design level: a callback answers "which chunk" per module with arbitrary logic, while `groups` answers it with declarative predicates the bundler can reason about, which is what lets it apply size constraints and priorities.

**★ Symptom: someone sets `codeSplitting: false` to "simplify the output" and the initial bundle balloons.** Cause: `false` means *"Inline all dynamic imports into a single bundle"* — every `import()` in the app is flattened into the entry. Fix: that value is for library and single-file output targets, not for applications. If the goal was fewer chunks, use `groups` with a `minSize` floor.

## Interview questions

**★ Why did removing the object form of `manualChunks` break configs quietly rather than loudly?**
Because chunking is an optimisation, not a correctness requirement. If the grouping instruction is not applied, the bundler still produces a working application — it just produces a different chunk graph, with different cache behaviour. Nothing throws, no test fails, and the only visible symptom is that returning visitors re-download code they used to have cached, which shows up in field metrics weeks later rather than in CI. That is why the recommended verification is a diff of the emitted file list across the upgrade rather than waiting for an error.

**★ What is the conceptual difference between `manualChunks` and `codeSplitting.groups`?**
`manualChunks` in its object form is a *lookup table*: chunk name to package list, decided when the config was written. Its function form is an *arbitrary callback*: given a module id, return a name. `codeSplitting.groups` is a *declarative rule set*: each group has a match predicate, a priority, and size constraints, and the bundler resolves conflicts between them. The practical difference is that the bundler can reason about a declarative rule — it can decide that a group is too small to be worth emitting, split one that is too large, or capture a module into the highest-priority group that claims it — none of which is possible when the answer arrives as an opaque function return.

**★ Chunking is described as a caching tool rather than a performance tool. Defend that.**
Splitting a fixed amount of JavaScript into more files does not reduce how much JavaScript the browser must download on a cold visit; it can make it worse, because each chunk is a request and chunks that import each other must be fetched in dependency order. What splitting changes is what happens on the *second* visit, after a deploy. Everything in a chunk is invalidated together, so putting daily-changing app code in the same chunk as annually-changing library code means every deploy invalidates the library too. Rolldown's own documentation frames it this way — automatic splitting *"doesn't take loading performance or cache invalidation into account"* — and the worked example in the in-depth guide is entirely about a hash that does or does not change.

**★ Why can a chunking change break an application that has no other change?**
Because a chunk determines when a module's top-level code runs. Bundling into one file preserves an execution order derived from the import graph; splitting into several changes which module bodies have already executed by the time a given chunk evaluates. Any module whose top level has a side effect — installing a polyfill, registering a locale, patching a global, initialising a client — can now run after something that assumed it had already run. Rolldown warns about exactly this and offers `strictExecutionOrder` as the blunt fix, noting it costs bundle size because it wraps module bodies. The nuanced fix is to keep order-sensitive modules in the same group.

**★ What does it mean that manual and automatic splitting "are not contradictory"?**
That `groups` is a set of claims over the module graph, not a partition of it. Every module is captured by at most one group; everything uncaptured is chunked by the automatic algorithm as before. Two things follow. First, you never have to enumerate your whole graph — declaring one vendor group is a complete, valid configuration. Second, adding a group perturbs the automatic algorithm's input for everything else, so unrelated chunk names and hashes can move. That second consequence is the one people are surprised by, and it is why emitted filenames should be read from the manifest rather than assumed.

---

← [01c · optimizeDeps include/exclude](01c-optimizedeps-include-and-exclude.md) · [Vite overview](../../README.md) · Next → [01e · codeSplitting: matching and priority](01e-tuning-codesplitting-groups.md)
