---
title: "Rolldown's codeSplitting Option Has a Real, Documented Shape — groups, test, priority, minSize — and It Is the Actual Destination Topic 17 Named Without Reading"
sidebar_label: "01l · splitChunks → codeSplitting"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the Vite documentation — [Migration from v7](https://vite.dev/guide/migration) — and the Rolldown documentation — [`codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting), [`advancedChunks`](https://rolldown.rs/reference/OutputOptions.advancedChunks) — cross-checked against the `CodeSplittingGroup` type definition in the Rolldown source, [`packages/rolldown/src/options/output-options.ts`](https://github.com/rolldown/rolldown/blob/df2ec37cc664906329fd5a16782d1a66cc35aebb/packages/rolldown/src/options/output-options.ts). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · webpack 5.110.3**.
> ⚠️ The `CodeSplittingGroup` field list is read from the linked source commit, not a hosted reference page with a stable URL — treat field names as current as of that commit and re-check before depending on this for a production config, since Rolldown's own reference page for the type was not reachable at fetch time.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `splitChunks` → Rolldown's `codeSplitting`

**[Topic 17](../17-the-2026-toolchain-landscape/02a-the-four-that-do-not-transfer.md) already
made the argument that `splitChunks` has no direct equivalent and that porting it is a design
task, not a translation — read that first, this chunk does not repeat it.** What that chunk
explicitly declined to do is describe `codeSplitting`'s actual shape, because its own author
had not read the reference at the time of writing. This chunk has, and gives you the option
to write real config against, not just the name of where to look.

## The rename and the removal, restated only as a checklist

- `output.manualChunks` (object form): **removed**, not deprecated — it does not run at all.
- `output.manualChunks` (function form): **deprecated**, still works, still the immediate
  stopgap `require.context`-style migrations reach for.
- The named replacement: `output.codeSplitting`, accessed under Vite's `build.rolldownOptions.output`.

For *why* this is hard and what it costs in practice, see topic 17's chunks
[02a](../17-the-2026-toolchain-landscape/02a-the-four-that-do-not-transfer.md) and
[02b](../17-the-2026-toolchain-landscape/02b-loaders-become-plugins.md). This chunk is the
"and here is the option itself" that they intentionally left out.

## `codeSplitting`'s actual shape

```typescript
type CodeSplittingOptions = boolean | {
  groups?: CodeSplittingGroup[];
  // Every field below is a GLOBAL FALLBACK, used only where a group omits it.
  minSize?: number;
  maxSize?: number;
  minModuleSize?: number;
  maxModuleSize?: number;
  minShareCount?: number;
  includeDependenciesRecursively?: boolean;
};
```

`true` (the default) is automatic code splitting with no manual groups — Rolldown decides.
`false` inlines every dynamic import into a single bundle, equivalent to the older, now
deprecated `inlineDynamicImports: true`. The object form is where a ported `splitChunks`
config's intent actually lands.

### `CodeSplittingGroup` — the field that replaces `cacheGroups`

Read from the Rolldown source directly, since no hosted reference page for the type itself
was reachable at fetch time:

```typescript
type CodeSplittingGroup = {
  name: string | ((moduleId: string) => string);
  test?: string | RegExp | ((moduleId: string) => boolean);
  priority?: number;        // default 0 — higher wins; equal priority, smaller index wins
  minSize?: number;         // default 0 — group is dropped if smaller than this
  maxSize?: number;         // default Infinity — group SPLITS further above this
  minShareCount?: number;   // default 1 — how many entry chunks must reference a module
  minModuleSize?: number;   // default 0
  maxModuleSize?: number;   // default Infinity
  entriesAware?: boolean;   // default false — group by WHICH entries import a module
  entriesAwareMergeThreshold?: number; // default 0
};
```

> *"Controls which modules are captured in this group. If `test` is a string, modules whose
> id contains the string are captured. If `test` is a regex, modules whose id matches are
> captured. If `test` is a function, modules where `test(id)` returns `true` are captured."*
> — `CodeSplittingGroup.test`, [Rolldown source](https://github.com/rolldown/rolldown/blob/df2ec37cc664906329fd5a16782d1a66cc35aebb/packages/rolldown/src/options/output-options.ts)

That is, field for field, close enough to webpack's `cacheGroups` that a `splitChunks` config
can be **restated**, not merely referenced against — `test` plays the role of `cacheGroups.*.test`,
`priority` and `minSize`/`maxSize` behave the same way they did in webpack, and `minShareCount`
is a direct read of webpack's `minChunks` concept (how many chunks must share a module before
it earns its own bundle).

### A real `cacheGroups` config, restated as `codeSplitting` groups

```javascript
// BEFORE — webpack.config.js, a typical hand-tuned vendor/common split.
module.exports = {
  optimization: {
    splitChunks: {
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          priority: 20,
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          priority: 10,
          minChunks: 2, // shared by at least 2 chunks before it earns its own bundle
        },
      },
    },
  },
};
```

```typescript
// AFTER — vite.config.ts. Restated, not translated — same INTENT, real Rolldown option.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              minShareCount: 2, // webpack's minChunks, same concept
            },
          ],
        },
      },
    },
  },
});
```

`priority` resolves overlaps the same way it did under webpack — `react` (priority 20) wins
over `vendor` (priority 10) for any module both patterns would otherwise match, so a React
module never gets pulled into the generic vendor bundle it would land in if the groups had
equal priority and array order decided instead.

### The one genuinely new capability: `entriesAware`

Nothing in webpack's `cacheGroups` corresponds to this field directly. `entriesAware: true`
groups matching modules by **which entry chunks import them**, rather than lumping every
match into one named group regardless of which page needed it — useful for a multi-entry app
where "shared by pages A and B" and "shared by pages C and D" should not become one
undifferentiated vendor chunk just because both sets matched the same `test`.

```typescript
{
  name: (id) => `shared-${id}`, // name can be a function of the module id
  test: /[\/]node_modules[\/]/,
  entriesAware: true,
  entriesAwareMergeThreshold: 20_000, // merge subgroups smaller than ~20KB
}
```

## `advancedChunks` is the name you will find in older blog posts — it is already deprecated

> *"If `advancedChunks` and `codeSplitting` are both specified, `advancedChunks` option will
> be ignored."* — [Rolldown, `advancedChunks`](https://rolldown.rs/reference/OutputOptions.advancedChunks)

`advancedChunks` was Rolldown's earlier name for this mechanism, predates its stabilisation as
`codeSplitting`, and is now itself deprecated in favour of the option this chunk describes.
Any material referencing `advancedChunks` — including a search result that ranks above the
current reference page — is describing a superseded name for the same underlying idea; do
not configure both, since the deprecated one is silently ignored when the current one is
present.

---

## Gotchas

**★ Symptom: a restated `codeSplitting` config produces a *worse* chunk graph than the deprecated `manualChunks` stopgap did.** Cause: `codeSplitting`'s groups are matched with `priority` deciding overlaps, not array order — a config that assumed "first matching group wins," as some `manualChunks` function implementations did, needs explicit `priority` values, not just an ordered array. Fix: assign `priority` deliberately on every group whose match could overlap another's, exactly as you would have needed to in webpack once `cacheGroups` grew past two entries.

**★ Symptom: `minShareCount` is set to `1` (the default) and a module that should be code-split into `vendor` ends up duplicated into multiple route chunks instead.** Cause: `minShareCount: 1` means "captured even if only one entry chunk references it," which is the correct default for most apps but is not what webpack's `minChunks: 2`-style configs usually meant — a webpack config that relied on `minChunks` to *prevent* single-use dependencies from being pulled into a shared bundle needs the equivalent `minShareCount` value carried over explicitly, not left at Rolldown's default. Fix: set `minShareCount` to whatever the old `cacheGroups.*.minChunks` value was; the two options mean the same thing but do not share a default.

**★ Symptom: `advancedChunks` is configured (copied from an article predating the option's stabilisation) alongside `codeSplitting`, and only one of the two configs seems to have any effect.** Cause: per the docs, when both are specified `advancedChunks` is silently ignored — there is no warning. Fix: delete the `advancedChunks` block entirely once `codeSplitting` is configured; keeping both "just in case" is not neutral, it is dead configuration that will mislead the next person who edits it.

**★ Symptom: the migrated config groups every `node_modules` module into one `vendor` chunk, and it turns out two unrelated pages now share a cache-busting deploy whenever either changes.** Cause: a single `test: /node_modules/` group with no `entriesAware` captures every dependency into one chunk regardless of which page actually uses it, which is a real regression from a webpack config that had separate `cacheGroups` per route bundle. Fix: `entriesAware: true` on that group, so modules are grouped by which entry chunks actually import them rather than by matching one broad regex.

---

## Interview questions

**★ Topic 17 said `splitChunks` "cannot be estimated by counting" and declined to show `codeSplitting`'s shape. Now that the shape is known, does that change the estimate?**
No, and that is worth being explicit about. Knowing `codeSplitting`'s fields — `groups`,
`test`, `priority`, `minSize`, `minShareCount`, `entriesAware` — tells you the *vocabulary*
you will restate the old config in; it does not tell you what the old config's `cacheGroups`
entries were actually *for*, which is the real work topic 17 was pointing at. A team with a
six-year-old `splitChunks` config still has to work out which rules encode a live caching
decision and which encode a dependency that was removed in 2024, and no option reference
does that for them. What the shape *does* change is the destination: rather than treating the
deprecated `manualChunks` function as a permanent home, you now know exactly which
`codeSplitting` fields the restated intent should land in, which turns "some day, restate
this properly" into a concrete, schedulable task.

**★ Why does `codeSplitting`'s `test` field support a string, a `RegExp`, and a function, when webpack's `cacheGroups.test` was effectively always a `RegExp`?**
Because the three forms trade off cost against expressiveness, and Rolldown exposes the
cheapest one that fits rather than forcing every case through the most expensive. A string
match (`id.includes(...)`) is the fastest test and covers the enormous majority of real
`cacheGroups` rules, which are almost always "this module id contains `node_modules/react`."
A `RegExp` covers the pattern-matching cases webpack's `test` was actually built for. A
function is the escape hatch for logic no pattern can express — checking a module's size, its
importer, or metadata unavailable to a plain string test. webpack effectively only offered
the middle tier; Rolldown's three-tier design lets a straightforward port stay cheap while
still supporting the genuinely custom cases.

**★ A ported `codeSplitting` config sets `priority` on every group but the resulting chunk graph still does not match what `cacheGroups` used to produce. What do you check first?**
Whether `minShareCount` was left at its default. It is the field most likely to silently
change behaviour during a port, because webpack's `minChunks` had no universal default that
every `cacheGroups` entry inherited the same way — some configs set it explicitly, some
relied on webpack's own per-preset defaults, and both get flattened by a migration that only
copies `test`/`name`/`priority` and treats `minShareCount` as an afterthought. Checking it
first is cheap and, in practice, resolves more "the chunk graph looks wrong" reports than
re-deriving the `test` patterns from scratch does.

---

← [01k · loaders, define & mode](01k-loaders-define-and-mode.md) · [Vite overview](../../README.md) · Next → [01m · noParse & externals](01m-webpack-only-config-with-no-equivalent.md)
