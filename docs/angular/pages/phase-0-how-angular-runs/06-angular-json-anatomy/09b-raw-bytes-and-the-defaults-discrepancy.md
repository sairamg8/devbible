---
title: "Budgets count raw bytes, there is no built-in budget when the key is absent, and the `anyComponentStyle` defaults angular.dev documents are not the ones `ng new` writes into your file"
sidebar_label: "09b · Raw bytes and the defaults"
sidebar_position: 9.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the budget-stats construction and the
> transfer-size calculation read from
> [`packages/angular/build/src/tools/esbuild/budget-stats.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/budget-stats.ts)
> and
> [`packages/angular/build/src/builders/application/execute-build.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/execute-build.ts);
> the generated budget values quoted verbatim from
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts);
> the schema default for `budgets` from
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> — all at tag `v22.1.7` — and the documented defaults from
> [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build#configuring-size-budgets).
> 🔴 **The last two sources disagree; this page states both and does not reconcile them.**
> Documentation-validated; **no sandbox run**; **no measurements** — no compression ratio is
> asserted anywhere on this page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Three facts about budgets are widely believed and all three are wrong: that they measure what the
browser downloads, that Angular applies sensible ones when you have not set any, and that the
numbers in your file match the ones on angular.dev.** They measure raw bytes, they apply nothing at
all when the key is absent, and the `anyComponentStyle` pair in a generated file is not the pair
angular.dev documents. This page settles each in turn. What happens *when* a budget fails is
[09 · When a budget fails](09-when-a-budget-fails.md).

## Budgets count raw bytes

Two independent readings of the source agree.

**First**, the stats the checker receives are built from the output files' own sizes — the loop in
`generateBudgetStats` pushes each surviving file's `size` straight through
([08c](08c-what-reaches-the-calculator.md)). Nothing compresses, estimates or adjusts.

**Second**, an estimated transfer size *is* computed by the same builder, but separately and
afterwards, and it is never handed to the budget checker:

```ts
// Calculate estimated transfer size if scripts are optimized
let estimatedTransferSizes;
if (optimizationOptions.scripts || optimizationOptions.styles.minify) {
  estimatedTransferSizes = await calculateEstimatedTransferSizes(executionResult.outputFiles);
}
```

🔴 **So a `500kB` `initial` budget is 500 000 raw bytes on disk.** The transfer size the builder
reports separately is a different, smaller number, and the two are not interchangeable. This page
does not put a ratio on that difference: it depends entirely on the content of your bundle and
there is no measurement here to support one.

The practical rule: **set budget values from the sizes budgets measure.** Reading a compressed
figure out of a network panel and using it as a threshold produces a budget several times tighter
than intended, which fails immediately and then gets raised until it means nothing.

## There is no built-in budget

The `budgets` option's schema default is `[]`. The generated `angular.json` puts two entries into
`configurations.production` and none anywhere else. Put those together and the conclusion is
unambiguous: **if your file has no budgets, nothing is enforced.**

The guard in the builder is `if (options.budgets)`, which does not skip an empty array — `[]` is
truthy in JavaScript, so the block runs, `checkBudgets` iterates zero budgets and yields zero
results. Absent key and empty array behave identically: no thresholds, no messages, no enforcement.

⚠️ **This is what makes the word "defaults" in angular.dev's budget table ambiguous.** It means
*"what `ng new` writes into your file"*, not *"what the builder applies when `budgets` is absent"*.
Nothing is applied when the key is absent.

## The generated values

Verbatim from the application schematic, immediately above the project object it inserts:

```ts
let budgets: { type: string; maximumWarning: string; maximumError: string }[];
if (options.strict) {
  budgets = [
    { type: 'initial',           maximumWarning: '500kB', maximumError: '1MB' },
    { type: 'anyComponentStyle', maximumWarning: '4kB',   maximumError: '8kB' },
  ];
} else {
  budgets = [
    { type: 'initial',           maximumWarning: '2MB',   maximumError: '5MB' },
    { type: 'anyComponentStyle', maximumWarning: '6kB',   maximumError: '10kB' },
  ];
}
```

`strict` defaults to `true`, so a default `ng new` at 22.1.7 gives you **`500kB`/`1MB`** for
`initial` and **`4kB`/`8kB`** for `anyComponentStyle`. A workspace generated with `--no-strict`
gets budgets four to five times looser on `initial` — worth checking before concluding that a
project simply has no size discipline.

## 🔴 The discrepancy, stated and not resolved

| Source | `initial` | `anyComponentStyle` |
|---|---|---|
| angular.dev, *"Defaults to…"* | warning `500kb`, error `1mb` | warning **`2kb`**, error **`4kb`** |
| `ng new` (strict — the default) | warning `500kB`, error `1MB` | warning **`4kB`**, error **`8kB`** |
| `ng new --no-strict` | warning `2MB`, error `5MB` | warning `6kB`, error `10kB` |

The `initial` row agrees. **The `anyComponentStyle` row does not agree with either generated
pair.** angular.dev's size-budgets table says the type *"Defaults to warning at 2kb and erroring at
4kb"*; the CLI's application schematic at `v22.1.7` writes `4kB`/`8kB` under the default
`strict: true`, and `6kB`/`10kB` with `--no-strict`.

**This page states the generated values, because they are what your file actually contains**, and
records that the published table says something different. No source was found that settles which
is intended, and neither is presented here as the correct one.

## Why CI does not fail on a size regression

Four causes, in rough order of likelihood. Every one of them leaves a budget that looks configured:

1. **Only `maximumWarning` is set.** Warning severity does not fail the build
   ([09](09-when-a-budget-fails.md)).
2. **The budgets live in `configurations.production` and CI builds something else.** A
   configuration replaces the value of every key it names, and a configuration that does not name
   `budgets` inherits the `options` value — which in a generated file is absent, so `[]`.
3. **A `bundle` budget has no `name`.** Its calculator returns an empty array, silently
   ([08b](08b-what-each-type-sums.md)).
4. **A threshold string does not parse.** It becomes `NaN`, and no comparison against `NaN` is ever
   true ([08d](08d-threshold-strings-and-the-baseline.md)).

The configuration whose budgets are worth checking first is the one CI actually runs.

## Gotchas

**★ Symptom: budgets are set from figures read off a browser network panel and the build fails
immediately.** Cause: those figures are transfer sizes; budgets measure raw output bytes, which are
larger. Fix: set thresholds from the sizes the build itself reports, then tighten:

```json
{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
```

**★ Symptom: a project has no `budgets` key and someone assumes Angular is applying the documented
defaults.** Cause: the schema default is `[]` and nothing is applied when the key is absent — the
documented "defaults" are what `ng new` writes, not a builder fallback. Fix: write them:

```json
{
  "budgets": [
    { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
    { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
  ]
}
```

**★ Symptom: angular.dev says `anyComponentStyle` defaults to `2kb`/`4kb` and your file says
`4kB`/`8kB`.** Cause: the published table and the schematic disagree at 22.1.7, and no source was
found that settles it. Fix: treat your file as the authority for what is enforced, and set the
value you actually want rather than inheriting an ambiguous one:

```json
{ "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
```

**★ Symptom: CI has never failed on bundle growth although budgets are configured.** Cause: one of
four — warning-only thresholds, budgets in a configuration CI does not build, a `bundle` budget
without a `name`, or an unparseable threshold. Fix: check them in that order, and make CI name the
configuration it means:

```bash
ng build --configuration production
```

**★ Symptom: a workspace generated with `--no-strict` has an `initial` error threshold of `5MB` and
nobody noticed.** Cause: the schematic writes a different budget pair when `strict` is false. Fix:
the value is yours to set — the generated one only records which flag was passed months ago:

```json
{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
```

**Symptom: `"budgets": []` is added to disable enforcement and someone later argues it should be
`null` or the key removed.** Cause: all three are equivalent — an absent key, an empty array and a
`[]` default all produce zero thresholds, and `if (options.budgets)` does not skip an empty array
because `[]` is truthy. Fix: pick the explicit form and move on:

```json
{ "budgets": [] }
```

**Symptom: the transfer-size figure the build reports and the budget figure disagree, and someone
files a bug.** Cause: they are two different measurements computed at two different points, and the
transfer size is never handed to the budget checker. Fix: expected — compare like with like:

```json
{ "type": "allScript", "maximumError": "1.5MB" }
```

**Symptom: budgets were "made realistic" by raising them after each failure and now sit far above
current size.** Cause: a threshold set from the wrong measurement fails on day one, and the
recovery is usually to raise it rather than to re-derive it. Fix: reset from what the build
measures, with a warning below the error so there is a signal before the wall:

```json
{ "type": "initial", "maximumWarning": "600kB", "maximumError": "750kB" }
```

## Interview questions

**★ Do budgets measure the compressed size a user downloads?**
No — they measure raw output bytes. Two independent readings of the source agree: the stats handed
to the checker carry each output file's own size with nothing applied to it, and the estimated
transfer size is computed separately, later, and never passed to the budget checker at all. So a
`500kB` `initial` budget is 500 000 bytes on disk. The consequence is practical: setting a
threshold from a compressed figure produces a budget several times tighter than intended, which
fails immediately and then gets raised until it stops meaning anything.

**★ If `angular.json` has no `budgets` key, what does Angular enforce?**
Nothing. The schema default for `budgets` is `[]`, and an empty array yields no thresholds — the
guard `if (options.budgets)` does not even skip it, because `[]` is truthy in JavaScript, so the
checker runs over zero budgets and produces zero results. The word "defaults" in the published
budget table means "what `ng new` writes into your file", not "what the builder applies when the
option is missing". A project with no budgets has no size enforcement of any kind.

**★ angular.dev says `anyComponentStyle` defaults to 2kb and 4kb; your generated file says 4kB and
8kB. Which is right?**
Both statements are accurate about their own subject and they do not agree. The published table
says the type *"Defaults to warning at 2kb and erroring at 4kb"*; the CLI's application schematic at
`v22.1.7` writes `4kB`/`8kB` under the default `strict: true` and `6kB`/`10kB` with `--no-strict`.
No source was found that settles which is intended. The correct engineering answer is to treat the
file as the authority for what is actually enforced — it is what the builder reads — and to set the
value you want explicitly rather than inheriting one that two sources describe differently. Note
also that the `initial` row *does* agree, so this is a specific discrepancy rather than a general
staleness.

**★ Name the four reasons a configured budget never fails CI.**
Only `maximumWarning` is set, so the severity is a warning and the build succeeds. The budgets live
in `configurations.production` while CI builds a different configuration, and because a
configuration replaces rather than merges, the array in force is the absent `options` one. A
`bundle` budget has no `name`, so its calculator returns an empty array silently. Or a threshold
string does not parse and becomes `NaN`, against which no comparison is ever true. All four leave a
budget that looks correct in review.

**Why does `--no-strict` change the budgets?**
Because the schematic branches on `options.strict` when it builds the array it writes into
`configurations.production` — the strict branch writes `500kB`/`1MB` and `4kB`/`8kB`, the
non-strict branch `2MB`/`5MB` and `6kB`/`10kB`. It is a generation-time decision with no runtime
component, so the only trace of it is the numbers in your file. That is worth knowing when
inheriting a workspace whose `initial` error threshold is `5MB`: it may be a deliberate choice, or
it may be a flag someone passed once.

**Why is it worth stating a documentation discrepancy on a reference page rather than picking the
likelier value?**
Because a reader who trusts the wrong one has no way to discover the mistake — both sources look
authoritative and neither mentions the other. Naming the disagreement, with the version and the
file, turns an invisible trap into a decision the reader can make. It also protects the page: if
one of the two changes, the page is still true, whereas a page that silently picked a side would
have become wrong without anyone noticing.

{/* FOOTER */}
