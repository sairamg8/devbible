---
title: "The sizing fields on a codeSplitting group can discard it entirely, split it in two, or exclude modules one at a time — and entriesAware defaults to false, so your lightest entry pays for your heaviest one's dependencies"
sidebar_label: "01ea · Group sizing and entry awareness"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Rolldown reference — [`CodeSplittingGroup`](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup), [`output.codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting), [Manual Code Splitting](https://rolldown.rs/in-depth/manual-code-splitting) — reached from the Vite [Migration from v7](https://vite.dev/guide/migration) guide. Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+** (`rolldown ~1.2.4`).
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Group Sizing and Entry Awareness

**Five of a group's fields decide size and scope, and four of them default to a value that makes them a no-op — which is why they get set without effect and then blamed.** `minShareCount` defaults to `1`, so a "shared code" group captures anything referenced by a single entry. `entriesAware` defaults to `false`, so one vendor chunk is the union of every entry's dependencies and the lightest page pays for the heaviest. `includeDependenciesRecursively` defaults to `true` and drags a whole subtree along with each capture. And `minSize` does not shrink a group that falls under it — it discards the group entirely. [01e](01e-tuning-codesplitting-groups.md) covers matching and priority; this is what happens after a module has been matched.

## 1. Under-The-Hood Mechanics

### The size fields do two different jobs

**Group-level**, tested against the *accumulated* size of everything captured:

> `minSize` — *"Minimum size in bytes of the desired chunk. If the accumulated size of the captured modules by this group is smaller than this value, it will be ignored. Modules in this group will fall back to the `automatic chunking` if they are not captured by any other group."* — default `0`

> `maxSize` — *"If the accumulated size in bytes of the captured modules by this group is larger than this value, this group will be split into multiple groups that each has size close to this value."* — default `Infinity`

**Module-level**, gating whether an individual module is eligible at all:

> `minModuleSize` — *"Controls whether a module can only be captured if its size in bytes is larger than or equal to this value."* — default `0`

> `maxModuleSize` — *"Controls whether a module can only be captured if its size in bytes is smaller than or equal to this value."* — default `Infinity`

```text
                candidate modules
                       │
      minModuleSize / maxModuleSize   ← per-module gate: drops individuals
                       │
                  captured set
                       │
         accumulated size < minSize?  ── yes ─► GROUP DISCARDED, modules fall
                       │                        back to automatic chunking
                       no
                       │
         accumulated size > maxSize?  ── yes ─► group split into several of
                       │                        approximately maxSize each
                       ▼
                  emitted chunk(s)
```

🔴 `minSize` is not a hint. A group under it does not shrink, warn, or emit a small chunk — it stops existing, and its modules go wherever automatic chunking puts them.

### `minShareCount` — a graph property, not a size

> *"Controls if a module should be captured based on how many entry chunks reference it."* — default `1`

Default `1` means "referenced by at least one entry chunk", which every reachable module satisfies. As a filter it is off. A group that genuinely means *shared between routes* needs `minShareCount: 2`, and the option's name reads like a threshold while its default makes it inert — a combination that produces a "shared" chunk containing code used by exactly one page.

### `entriesAware` — the multi-entry correction

> *"When `false` (default), all matching modules are merged into a single chunk. Every entry that uses any of these modules must load the entire chunk — even modules it doesn't need."*
> *"When `true`, matching modules are grouped by which entries actually import them. Modules shared by the same set of entries go into the same chunk, while modules shared by a different set go into a separate chunk. This way, each entry only loads the code it actually uses."*

with the reference's own worked example, quoted:

> *"Example: entries A, B, C all match a `\"vendor\"` group. `moduleX` is used by A, B, C. `moduleY` is used by A, B only. With `entriesAware: false` → one `vendor.js` chunk with both modules; C loads `moduleY` unnecessarily. With `entriesAware: true` → `vendor.js` (moduleX, loaded by all) + `vendor2.js` (moduleY, loaded by A and B only)."*

Subdividing by entry-set can produce a long tail of very small chunks, which is what the companion option bounds:

> `entriesAwareMergeThreshold` — *"Size threshold in bytes for merging small `entriesAware` subgroups into the closest neighboring subgroup. This option only works when [`entriesAware`](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup#entriesaware) is `true`. Set to `0` to disable subgroup merging."* — default `0`

⚠️ Default `0` means merging is **off**. Turning on `entriesAware` without a threshold gives you the full subdivision, however fine it turns out to be.

### `includeDependenciesRecursively` — on by default, and load-bearing

> *"Whether to include captured modules' dependencies. Enabling this option reduces the chance of generating circular chunks."* — default `true`

> *"If you want to disable this behavior, it's recommended to both set [`preserveEntrySignatures`](https://rolldown.rs/reference/Interface.InputOptions#preserveentrysignatures): `false | 'allow-extension'` and [`strictExecutionOrder`](https://rolldown.rs/reference/Interface.OutputOptions#strictexecutionorder): `true` to avoid generating invalid chunks."*

Read that literally: turning it off risks **invalid** chunks, not merely suboptimal ones, and the mitigation is two further options that each carry their own cost. This is not a size knob and should not be reached for as one.

### `tags` and the `'$initial'` filter

> *"Filter modules by tags. Only modules that have **all** specified tags are captured by this group. Combines with `test` and other filters — a module must match all criteria."*

> Built-in tag: *"`'$initial'` (module is statically imported by a user-defined entry or part of its dependency chain)."*

The reference's own example, quoted:

```js
{ name: 'initial-deps', tags: ['$initial'], maxSize: 1048576 }
```

`'$initial'` is the critical-path selector: everything reachable by static import from an entry, which is exactly the set the browser must have before the app can run. Combining it with `maxSize` is how you express "cap the critical path and let the bundler split it", without touching anything that is only reachable through a dynamic `import()`.

### The chunk you did not ask for

> *"tl;dr: If you used manual code splitting with groups, rolldown will forcefully generate a `runtime.js` chunk to ensure that the runtime code is always executed before any other chunks."*
> *"The `runtime.js` chunk is a special chunk that **only** contains the runtime code necessary for loading and executing your application."* — [Manual Code Splitting](https://rolldown.rs/in-depth/manual-code-splitting)

The moment you add your first group, the emitted file list gains an entry no group produced.

---

## 2. Real-World Engineering Scenario

**Scenario**: a multi-entry admin console where splitting made the smallest page heavier.

The app has three HTML entries — a public login page, the main console, and a reporting tool. A single `vendor` group captured everything in `node_modules`, which is the textbook answer and was wrong here: the reporting tool's charting and PDF libraries are large, used by exactly one entry, and were now in the chunk the login page also had to load. Before the change, automatic chunking had kept them apart; the manual group merged them.

`entriesAware: true` is the documented correction. The group is subdivided by *which set of entries* imports each module, so modules used by all three stay together and the reporting-only libraries move into a subgroup only the reporting entry loads. Because that subdivision can produce a long tail of tiny chunks, `entriesAwareMergeThreshold` folds subgroups under a floor back into their nearest neighbour — and it has to be set explicitly, because its default of `0` disables merging.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — the sizing and scoping fields, each with its reason.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Global fallbacks: any group that does not state these inherits them.
          minSize: 20_000,
          maxSize: 400_000,

          groups: [
            {
              // Cap the critical path. '$initial' selects only modules statically
              // reachable from an entry; maxSize then splits that set.
              name: 'initial-deps',
              tags: ['$initial'],
              test: /node_modules/,
              maxSize: 1_048_576,
              priority: 30,
            },
            {
              name: 'charts',
              test: /node_modules[\\/](echarts|d3-.*)[\\/]/,
              priority: 20,
              // Large, and only one entry uses it: subdivide by entry set so the
              // login page does not pay for the reporting tool's dependencies.
              entriesAware: true,
              // Default is 0, which DISABLES merging. Set it, or accept the tail.
              entriesAwareMergeThreshold: 30_000,
            },
            {
              // Genuine shared code. minShareCount defaults to 1, which captures
              // everything; 2 is the first value that actually filters.
              name: 'shared',
              minShareCount: 2,
              minSize: 10_000,
              priority: 10,
            },
            {
              // Exclude single modules that are individually enormous — a bundled
              // WASM blob or a generated locale table — so they chunk on their own
              // rather than dragging this group over maxSize.
              name: 'vendor',
              test: /node_modules/,
              maxModuleSize: 250_000,
              priority: 0,
            },
          ],
        },
      },
    },
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: reading `minSize` as "make the chunk at least this big"

```typescript
// ❌ MISREAD: this does not pad a chunk up to 50 KB. If the captured modules total
// less than 50 KB, the group is DISCARDED and they fall back to automatic chunking.
{ name: 'icons', test: /node_modules[\\/]@acme[\\/]icons/, minSize: 50_000 },

// ✅ If you want the chunk regardless of size, do not set a floor.
{ name: 'icons', test: /node_modules[\\/]@acme[\\/]icons/ },
```

### ⚠️ Pitfall 2: `entriesAwareMergeThreshold` without `entriesAware`

```typescript
// ❌ Inert. "This option only works when entriesAware is true." Nothing warns.
{ name: 'vendor', test: /node_modules/, entriesAwareMergeThreshold: 30_000 },

// ✅ Both, or neither.
{ name: 'vendor', test: /node_modules/, entriesAware: true, entriesAwareMergeThreshold: 30_000 },
```

### ⚠️ Pitfall 3: disabling `includeDependenciesRecursively` to make chunks smaller

It is on by default because it *"reduces the chance of generating circular chunks"*, and the reference's advice for turning it off is to set two other options to avoid *"generating invalid chunks"*. Shrinking a chunk is not worth an invalid one — use `maxSize`, which splits a group rather than changing what it captures.

### ⚠️ Pitfall 4: treating `maxSize` as a guarantee

The reference says a group over `maxSize` *"will be split into multiple groups that each has size close to this value"* — *close to*, not *at most*. A single module larger than `maxSize` cannot be split at all, because a module is the atomic unit. If one module is the problem, `maxModuleSize` excludes it from the group; `maxSize` cannot help.

---

## Gotchas

**★ Symptom: a group you configured produced no chunk, and the build is green.** Cause: the accumulated size fell under `minSize`, so *"it will be ignored. Modules in this group will fall back to the `automatic chunking` if they are not captured by any other group."* Fix: lower or remove `minSize` for that group. Nothing warns, so the only signal is a name you configured being absent from `dist/`.

**★ Symptom: a `shared` group captures modules used by exactly one route.** Cause: `minShareCount` defaults to `1`, meaning "referenced by at least one entry chunk" — no filtering at all. Fix: `minShareCount: 2`. The option name reads like a threshold; the default value makes it a no-op.

**★ Symptom: a small entry page loads a large chunk it never uses.** Cause: `entriesAware` is `false` by default, so *"Every entry that uses any of these modules must load the entire chunk — even modules it doesn't need."* Fix: `entriesAware: true` on that group, and set `entriesAwareMergeThreshold` if the subdivision produces too many small files.

**★ Symptom: `entriesAwareMergeThreshold` appears to do nothing.** Cause: *"This option only works when `entriesAware` is `true."* On its own the threshold is inert, and nothing says so at build time. Fix: set both fields together.

**★ Symptom: turning on `entriesAware` produced a dozen chunks where there was one.** Cause: that is the mechanism — one subgroup per distinct set of referencing entries. Fix: set `entriesAwareMergeThreshold` to a floor below which subgroups are folded into their neighbour. Its default of `0` means "no merging", which is the opposite of what the number `0` suggests.

**★ Symptom: a group blows past `maxSize` anyway.** Cause: a single module bigger than the limit. Splitting happens between modules, so a module is the atomic unit and the resulting chunks are only *"close to"* the target. Fix: exclude the offender with `maxModuleSize` so it chunks separately, or address the module itself — a 400 KB generated locale table or an inlined WASM binary is usually the real finding.

**★ Symptom: after disabling `includeDependenciesRecursively`, chunks load in a broken order or the app throws on a circular import.** Cause: the option exists to prevent that — *"Enabling this option reduces the chance of generating circular chunks."* Fix: turn it back on. If it must stay off, the reference prescribes `preserveEntrySignatures: false | 'allow-extension'` **and** `strictExecutionOrder: true` together, and the second wraps module bodies at a bundle-size cost.

**★ Symptom: a `tags: ['$initial']` group misses code you expected it to catch.** Cause: `'$initial'` is *"module is statically imported by a user-defined entry or part of its dependency chain"* — anything reachable only through a dynamic `import()` is excluded by design, and *"Only modules that have **all** specified tags are captured"* combines with `test` as an AND. Fix: this is the intended selector for the critical path. If you wanted lazily-loaded code too, do not filter by tag.

**★ Symptom: a `dist/` assertion in CI fails on a file nobody configured.** Cause: `runtime.js` — *"rolldown will forcefully generate a `runtime.js` chunk to ensure that the runtime code is always executed before any other chunks."* Fix: expect it. Any test that asserts an exact set of emitted chunks must account for the runtime chunk once manual grouping is in use.

## Interview questions

**★ What does `minSize` actually do when a group falls under it?**
The group is discarded, not shrunk. The modules it would have captured *"fall back to the `automatic chunking` if they are not captured by any other group"*. That makes `minSize` a guard against emitting a chunk too small to be worth its own request, and it also makes it a common cause of "my group does nothing" — the group is behaving exactly as specified, the specification just says "not worth it". The subtlety worth naming is that the fallback is to automatic chunking, so those modules do not vanish; they end up somewhere you did not choose and whose hash you do not control.

**★ When is `entriesAware` the right answer, and when is it noise?**
It is right when you have multiple entries with genuinely different dependency profiles — a marketing page and an authenticated app, or a console and a reporting tool. Without it, one `vendor` chunk is the union of everything every entry needs, and the lightest entry pays for the heaviest one's libraries; the reference states it plainly, that every entry *"must load the entire chunk — even modules it doesn't need."* It is noise in a single-entry SPA, where every module is used by the one entry and there is nothing to subdivide on. The cost when it is right is chunk count, which is what `entriesAwareMergeThreshold` exists to bound — and that has to be set explicitly, because its default disables merging.

**★ Why does Rolldown emit a `runtime.js` chunk once you use manual grouping?**
Because the module-level helper code the bundler injects — ESM interop shims, export machinery — would otherwise have to live inside one arbitrary chunk that every other chunk then depends on, which can create a cycle among chunks. Hoisting it into a dedicated chunk guarantees it is loaded and executed before anything that needs it, with no cycle. The practical consequence is that the emitted file list changes shape the moment you add your first group, so any tooling that enumerates `dist/` — a size budget script, an integrity manifest, a snapshot test — has to be told.

**★ Why is `includeDependenciesRecursively` not a size knob?**
Because what it prevents is structural, not cosmetic. Capturing a module without its dependencies means the chunk references modules that live elsewhere, and when those elsewhere-chunks also reference back, you get a cycle between chunks rather than between modules — which the loader cannot always resolve. The reference frames the default as reducing *"the chance of generating circular chunks"* and, for anyone turning it off, prescribes two additional options to avoid *"generating invalid chunks"*. Reaching for it because a chunk is too large is trading a correctness property for a size property; `maxSize` gives you the size property without the trade.

**★ Three of these fields default to a value that makes them inert. Which, and why does that matter?**
`minShareCount` defaults to `1`, which every reachable module satisfies. `entriesAwareMergeThreshold` defaults to `0`, which the reference defines as disabling merging. `minModuleSize` defaults to `0` and `maxModuleSize` to `Infinity`, so neither gates anything. It matters because the failure mode is not an error — it is a config that reads as if it expresses an intent and does not enforce it. A "shared" group with the default `minShareCount` is not shared, and an `entriesAware` group with the default threshold will emit whatever tail the subdivision produces. In review, the useful habit is to read every sizing field as "what happens if this is absent", because absent and default are the same thing here.

---

← [01e · codeSplitting: matching and priority](01e-tuning-codesplitting-groups.md) · [Vite overview](../../README.md) · Next → [01f · Chunk-size warnings and size reporting](01f-chunk-size-warnings-and-size-reporting.md)
