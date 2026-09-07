---
title: "A codeSplitting group matches modules by predicate and claims them by priority, and because capture is exclusive and destructive a catch-all written above the specific groups silently empties all of them"
sidebar_label: "01e · codeSplitting: matching and priority"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Rolldown reference — [`output.codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting), [`CodeSplittingGroup`](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup) — reached from the Vite [Migration from v7](https://vite.dev/guide/migration) guide, which names `codeSplitting` as the replacement for `manualChunks`. Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+** (`rolldown ~1.2.4`).
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `codeSplitting` Groups: Matching and Priority

**Every field in a group has a default, and the defaults are what make a group that "does nothing" so hard to debug.** A group with no `test` matches every module. Capture is exclusive — a module claimed by one group is removed from every other group's candidate set — so priority, not array order, decides who wins, and a catch-all with the highest priority quietly empties the specific groups beneath it with no warning at all. This chunk covers matching, priority and naming; the size and scoping fields are in [01ea](01ea-group-sizing-and-entry-awareness.md).

## 1. Under-The-Hood Mechanics

### The fields, with defaults

| Field | Type | Default | What it decides |
|---|---|---|---|
| `name` | `string` or function | *required* | chunk name; fills the `[name]` placeholder in `output.chunkFileNames` |
| `test` | string, RegExp or `(id) => boolean` | — | which modules are candidates; **empty means every module** |
| `priority` | `number` | `0` | which group claims a module when several match |
| `minSize` | `number` (bytes) | `0` | floor for the whole group; under it, the group is **ignored** |
| `maxSize` | `number` (bytes) | `Infinity` | ceiling; over it, the group is split into several |
| `minModuleSize` | `number` (bytes) | `0` | per-module floor for capture |
| `maxModuleSize` | `number` (bytes) | `Infinity` | per-module ceiling for capture |
| `minShareCount` | `number` | `1` | how many entry chunks must reference a module |
| `entriesAware` | `boolean` | `false` | split the group by *which entries* use each module |
| `entriesAwareMergeThreshold` | `number` (bytes) | `0` | merge small `entriesAware` subgroups; `0` disables merging |
| `includeDependenciesRecursively` | `boolean` | `true` | also capture the captured modules' dependencies |
| `tags` | `BuiltinModuleTag[]` | — | filter by tag; `'$initial'` is the built-in |

Every size field also exists on the `codeSplitting` object itself as a *"Global fallback of `group.<field>`, if it's not specified in the group."* The bottom eight rows are covered in [01ea](01ea-group-sizing-and-entry-awareness.md).

### `test` — and the Windows trap

> *"If `test` is a string, the module whose id contains the string will be captured. If `test` is a regular expression, the module whose id matches the regular expression will be captured. If `test` is a function, modules for which `test(id)` returns `true` will be captured. **If `test` is empty, any module will be considered as matched.**"* — [`CodeSplittingGroup`](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup)

> *"When using regular expression, it's recommended to use `[\\/]` to match the path separator instead of `/` to avoid potential issues on Windows."* — ✅ `/node_modules[\\/]react/` · ❌ `/node_modules/react/`

### `priority` — the resolution rule

> *"Priority of the group. Group with higher priority will be chosen first to match modules and create chunks. When converting the group to a chunk, modules of that group will be removed from other groups."*
> *"If two groups have the same priority, the group whose index is smaller will be chosen."* — default `0`

The second sentence of the first quote is the one that matters: capture is **exclusive and destructive**. A module claimed by the highest-priority matching group is removed from every other group's candidate set, which is why a broad `test: /node_modules/` catch-all must sit at a *lower* priority than the specific groups above it. Written in the other order, the catch-all eats everything, the specific groups are empty, and being empty is not an error.

```text
module: /app/node_modules/react/index.js

  groups considered in PRIORITY order (not array order)
        │
        ├── priority 30  test /node_modules[\/]react/   ── MATCH ── claimed
        ├── priority 20  test /node_modules[\/]@tanstack/  never sees it
        └── priority  0  test /node_modules/               never sees it
```

### The evaluation order, which constrains how you write a `test` function

> *"Rolldown calls a function `test` once for each candidate module, in a deterministic order. It makes every `test` call of a group before it makes the first `name` call of that group. Rolldown processes the groups in the order that you declare them."*

and the corresponding warning on `name`:

> *"Rolldown calls a function `name` once for each captured module, in a deterministic order. It calls `test` for every candidate module of the group first. Do not read a \"current module\" variable that `test` wrote, because that variable holds the last module `test` saw. Store such state under the module id instead."*

That is a real, specific bug the docs are pre-empting: a `test` that records the current module in a closure variable for `name` to read will always give `name` the *last* module `test` saw, for every call.

### `name` — a string, or a function that multiplies your groups

> *"Name of the group. It will be also used as the name of the chunk and replace the `[name]` placeholder in the [`output.chunkFileNames`](https://rolldown.rs/reference/Interface.OutputOptions#chunkfilenames) option."*

> *"It's ok to have the same name for different groups. Rolldown will deduplicate the chunk names if necessary."*

> *"If `name` is a function, it will be called with the module id as the argument. The function should return a string or `null`. If it returns `null`, the module will be ignored by this group. Notice, each returned new name will be treated as a separate group."*

> *"Constraints like `minSize`, `maxSize`, etc. are applied separately for different names returned by the function."*

🔴 One group with a `name` function that returns fifty distinct strings is **fifty groups** for the purposes of `minSize` and `maxSize`. That is how "I set `minSize` and still got tiny chunks" happens.

---

## 2. Real-World Engineering Scenario

**Scenario**: three vendor groups are declared, one chunk is emitted, and CI is green.

The config listed the groups the way a human reads a rule set — general rule first, exceptions after — and gave the general rule the highest priority so it would "run first". It did run first, claimed every module under `node_modules`, and removed all of them from the two specific groups' candidate sets. Those groups matched nothing.

Nothing failed. The build succeeded, the app worked, and the only symptom was that the React chunk the team believed they had never existed, so every deploy invalidated React along with the app code. The tell is structural rather than diagnostic: there is no build-time signal for "this group captured zero modules", so the only way to find it is to look at the emitted file names and notice that a name you configured is not among them.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — matching and priority, with the ordering made explicit.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // v8 name; `build.rollupOptions` is a deprecated alias of this.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Highest priority claims first, and claimed modules are REMOVED
              // from every lower group's candidate set.
              name: 'framework',
              // '[\\/]' rather than '/' so the pattern also matches on Windows.
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'data',
              test: /node_modules[\\/]@tanstack[\\/]/,
              priority: 20,
            },
            {
              // Catch-all. LOWEST priority, or it eats the two groups above.
              name: 'vendor',
              test: /node_modules/,
              priority: 0,
            },
          ],
        },
      },
    },
  },
});
```

```typescript
// A dynamic `name`, written the way the reference requires.
// ⚠️ Each distinct string returned is treated as a SEPARATE group, and minSize /
//    maxSize are applied to each one independently.
const scopeOf = (id: string): string | null => {
  const m = /node_modules[\\/](@[^\\/]+)[\\/]/.exec(id);
  return m ? `vendor-${m[1].slice(1)}` : null; // null → this group ignores the module
};

const scopedVendors = {
  // ✅ Derive everything from the id argument. Do NOT stash state in `test` for
  //    `name` to read: "that variable holds the last module `test` saw."
  name: (moduleId: string) => scopeOf(moduleId),
  test: /node_modules[\\/]@/,
  minSize: 20_000,
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: priorities written in reading order

```typescript
// ❌ WRONG: the catch-all has the highest priority, so it claims every node_modules
// module first and removes them from the two specific groups, which emit nothing.
groups: [
  { name: 'vendor', test: /node_modules/,             priority: 30 },
  { name: 'react',  test: /node_modules[\\/]react/,   priority: 20 },
  { name: 'charts', test: /node_modules[\\/]echarts/, priority: 10 },
],

// ✅ CORRECT: specific groups get the HIGHER priority. Array position only breaks
// ties between equal priorities.
groups: [
  { name: 'react',  test: /node_modules[\\/]react/,   priority: 20 },
  { name: 'charts', test: /node_modules[\\/]echarts/, priority: 10 },
  { name: 'vendor', test: /node_modules/,             priority: 0  },
],
```

### ⚠️ Pitfall 2: a group with no `test`

```typescript
// ❌ This does not mean "no filter yet, I'll add one later". It means EVERY module.
{ name: 'misc', minSize: 50_000 },

// ✅ If you want a genuine catch-all, say so and give it the lowest priority.
{ name: 'misc', minSize: 50_000, priority: -10 },
```

### ⚠️ Pitfall 3: closure state between `test` and `name`

```typescript
// ❌ WRONG — `current` holds the LAST module `test` saw, for every `name` call,
// because all `test` calls of a group happen before the first `name` call.
let current = '';
const bad = {
  test: (id: string) => { current = id; return id.includes('node_modules'); },
  name: () => (current.includes('react') ? 'react' : 'vendor'),
};

// ✅ CORRECT — `name` receives the module id. Use it.
const good = {
  test: (id: string) => id.includes('node_modules'),
  name: (id: string) => (id.includes('react') ? 'react' : 'vendor'),
};
```

---

## Gotchas

**★ Symptom: specific vendor groups are empty and one catch-all holds everything.** Cause: the catch-all has an equal or higher `priority`, and *"When converting the group to a chunk, modules of that group will be removed from other groups."* Fix: give the catch-all the lowest priority. Array order is only the tiebreaker for equal priorities, so reordering the array without changing `priority` fixes nothing.

**★ Symptom: a group emits nothing and there is no warning.** Cause: one of four silent filters — every candidate was claimed by a higher-priority group, the group's accumulated size is under `minSize`, `minModuleSize`/`maxModuleSize` excluded the modules individually, or `minShareCount` exceeded the number of referencing entries. Fix: bisect by removing constraints one at a time. There is no build-time diagnostic for "this group matched zero modules"; the sizing half of the list is covered in [01ea](01ea-group-sizing-and-entry-awareness.md).

**★ Symptom: chunk hashes differ between a Windows dev machine and Linux CI.** Cause: a `test` regex written with `/` instead of `[\\/]`, so it matches on one platform and not the other. Fix: `test: /node_modules[\\/]react/`. Dangerous because both builds succeed — you get two different cache-key universes for the same commit.

**★ Symptom: a group you thought was "not configured yet" swallowed the whole app.** Cause: *"If `test` is empty, any module will be considered as matched."* An omitted `test` is a wildcard, not a placeholder. Fix: give it a `test`, or make the wildcard intent explicit with the lowest priority in the list.

**★ Symptom: `minSize` is set and tiny chunks still appear.** Cause: a `name` function — *"each returned new name will be treated as a separate group"* and the constraints *"are applied separately for different names returned by the function."* A function returning one name per package scope applies `minSize` to each scope, not to the union. Fix: return fewer distinct names, or raise `minSize` knowing it is per-name.

**★ Symptom: a `name` function's output is correct for one module and wrong for every other.** Cause: state written in `test` and read in `name`. All of a group's `test` calls run before its first `name` call, so the shared variable holds a single value by then. Fix: read the `id` argument `name` is given, or key your state in a `Map` by module id.

**★ Symptom: chunk filenames do not contain the group name you set.** Cause: `name` fills the `[name]` placeholder — *"It will be also used as the name of the chunk and replace the `[name]` placeholder in the `output.chunkFileNames` option."* A `chunkFileNames` pattern without `[name]` has nowhere to put it. Fix: include `[name]` in the pattern.

**★ Symptom: two groups produced one chunk.** Cause: they share a `name`. *"It's ok to have the same name for different groups. Rolldown will deduplicate the chunk names if necessary."* Fix: this is supported behaviour and is a legitimate way to say "these two predicates feed one cache lifetime". If it was unintentional, rename one.

**★ Symptom: adding one group changed chunk names for unrelated code.** Cause: captured modules are removed from the pool the automatic algorithm sees, so its output changes for everything else too. Fix: expected, not a defect — but it means emitted filenames are not a stable contract. Anything referencing an output file by name should read `build.manifest` instead.

## Interview questions

**★ Why must a catch-all `node_modules` group have the lowest priority?**
Because capture removes a module from every other group's candidate set — *"When converting the group to a chunk, modules of that group will be removed from other groups."* Priority decides who claims first, so a high-priority catch-all takes every `node_modules` module before any specific group is considered, and the specific groups then match nothing. The failure is silent: three groups declared, one chunk emitted, no warning. Declaration order does not save you either; it only breaks ties between equal priorities, which is exactly the detail that makes people think reordering the array fixed it.

**★ A colleague writes a group whose `test` records the module id in a closure so `name` can use it. What goes wrong?**
Every `name` call sees the same id — the last one `test` observed. Rolldown documents the ordering explicitly: it *"makes every `test` call of a group before it makes the first `name` call of that group"*, so the two callbacks are not interleaved per module and the closure variable is fully overwritten before `name` runs even once. All captured modules get whatever name that final id produces, silently and deterministically, which makes it look like a logic bug in the naming function rather than an ordering assumption. The fix is to stop treating them as a pair: `name` receives the module id as its argument, and genuinely per-module state belongs in a map keyed by id.

**★ What is the practical difference between a string `name` and a function `name`?**
A string declares one group. A function declares as many groups as it returns distinct strings, and the reference is explicit that *"each returned new name will be treated as a separate group"* and that size constraints *"are applied separately for different names returned by the function."* So a function that names chunks per package scope turns a single `minSize: 20000` into a per-scope floor, and small scopes will each fall under it independently and fall back to automatic chunking. A function is the right tool when you genuinely want a family of chunks with a shared rule; it is the wrong tool when you wanted one chunk and reached for a function to compute its contents.

**★ Why does a regex using `/` as the path separator produce a different build on Windows?**
Because `test` is matched against the module id, which contains real filesystem path separators — backslashes on Windows. `/node_modules/react/` matches a POSIX id and not a Windows one, so the group captures modules in Linux CI and captures nothing on a Windows developer's machine. Neither build errors; they simply produce different chunk graphs and therefore different hashes for the same commit. That is why the reference recommends `[\\/]`, and why this class of bug is usually found by someone comparing a local `dist/` to a CI artefact rather than by a test.

---

← [01d · Chunk splitting after manualChunks](01d-chunk-splitting-after-manualchunks.md) · [Vite overview](../../README.md) · Next → [01ea · Group sizing and entry awareness](01ea-group-sizing-and-entry-awareness.md)
