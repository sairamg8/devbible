---
title: "`maximumError` fails the build and `maximumWarning` does not — that single distinction is the whole reason budgets are worth configuring, and it is the one most workspaces get wrong"
sidebar_label: "09 · When a budget fails"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the message templates and the
> `checkComponentStyles` filter quoted verbatim from
> [`packages/angular/build/src/utils/bundle-calculator.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/bundle-calculator.ts),
> `formatSize` from
> [`packages/angular/build/src/utils/format-bytes.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/format-bytes.ts),
> and the severity handling from
> [`packages/angular/build/src/builders/application/execute-build.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/execute-build.ts),
> all at tag `v22.1.7`.
> Documentation-validated; **no sandbox run** — no build output is reproduced on this page; the
> message *templates* below are source code.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A budget's severity is not a log level — it is a build outcome.** An `error`-severity budget calls
`addError` on the execution result and the build fails; a `warning`-severity budget calls
`addWarning` and the build succeeds. That is the entire value proposition of budgets: they are the
only mechanism in the default Angular toolchain that turns a size regression into a red CI job. A
workspace that sets only `maximumWarning` has a guard nobody will ever act on. This page is what
happens at the moment a threshold is crossed; [09b](09b-raw-bytes-and-the-defaults-discrepancy.md)
covers what the numbers mean and where the documented defaults disagree with the generated ones.

## The severity handling

From the `application` builder's `execute-build.ts` at `v22.1.7`:

```ts
// Analyze files for bundle budget failures if present
let budgetFailures: BudgetCalculatorResult[] | undefined;
if (options.budgets) {
  const compatStats = generateBudgetStats(metafile, outputFiles, initialFiles);
  budgetFailures = [...checkBudgets(options.budgets, compatStats, true)];
  for (const { message, severity } of budgetFailures) {
    if (severity === 'error') {
      executionResult.addError(message);
    } else {
      executionResult.addWarning(message);
    }
  }
}
```

🔴 **`maximumError` makes `ng build` fail.** `maximumWarning` prints and continues. If the point of
the budget is to stop a regression reaching production, the error threshold is the one that does
it — a warning threshold on its own produces a line in a log that a busy team scrolls past for
months.

The corollary matters too: **set both.** The warning gives you a runway (the size is climbing) and
the error is the wall (it stopped here). A budget with only an error threshold turns a gradual
regression into a sudden broken build with no earlier signal.

## The two message templates

There are exactly two, both from `bundle-calculator.ts`, and both are source code rather than
captured output:

```ts
message: `${label} exceeded maximum budget. Budget ${formatSize(threshold.limit)} was not met by ${sizeDifference} with a total of ${formatSize(size)}.`
```

```ts
message: `${label} failed to meet minimum budget. Budget ${formatSize(threshold.limit)} was not met by ${sizeDifference} with a total of ${formatSize(size)}.`
```

The first is emitted for a Max threshold, the second for a Min one — which is how a `warning` or
`error` key (both two-sided, see [08d](08d-threshold-strings-and-the-baseline.md)) can produce a
failure saying something is *too small*.

Note the shared phrase `was not met by` in both templates: it reads naturally for a minimum and
awkwardly for a maximum. It is not a sign you are reading the wrong message.

## The `label` tells you which budget failed

`label` is produced by the calculator, so it identifies the entry in your `budgets` array:

| Budget type | `label` |
|---|---|
| `initial` | `bundle initial` |
| `bundle` | the budget's own `name` |
| `allScript` | `total scripts` |
| `all` | `total` |
| `any` · `anyScript` · `anyComponentStyle` | the asset filename |

🔴 **`bundle initial` is a label, not a bundle.** Searching your output directory for a file called
that will find nothing — the string is hard-coded in `InitialCalculator`
([08b](08b-what-each-type-sums.md)).

## The units in the message

`formatSize` decides how every number in those templates is rendered:

```ts
export function formatSize(size: number): string {
  if (size <= 0) {
    return '0 bytes';
  }

  const abbreviations = ['bytes', 'kB', 'MB', 'GB'];
  const index = Math.floor(Math.log(size) / Math.log(1000));
  const roundedSize = size / Math.pow(1000, index);
  // bytes don't have a fraction
  const fractionDigits = index === 0 ? 0 : 2;

  return `${roundedSize.toFixed(fractionDigits)} ${abbreviations[index]}`;
}
```

So the units are `bytes`, `kB`, `MB` and `GB`; the scale is **base 1000**, matching
`BYTES_IN_KILOBYTE`; and everything above bytes carries two decimal places. A size of zero or less
renders as `0 bytes` rather than `0.00 kB`.

That is enough to read a budget message precisely, and to know why a figure in it will not match a
file size your operating system reports in 1024-based units.

## Component-style budgets are checked here, not elsewhere

`checkBudgets` takes a third argument, and the `application` builder passes `true`:

```ts
// Ignore AnyComponentStyle budgets as these are handled in `AnyComponentStyleBudgetChecker` unless requested
const computableBudgets = checkComponentStyles
  ? budgets
  : budgets.filter((budget) => budget.type !== BudgetType.AnyComponentStyle);
```

The default excludes `anyComponentStyle`, because a separate checker handles it on the legacy
webpack path. Under `@angular/build:application` the argument is `true`, so component-style budgets
are evaluated in the same pass as every other type. If you find a comment or an answer implying
that `anyComponentStyle` is handled by some other component, it is describing the older builder.

## Gotchas

**★ Symptom: budgets are configured, the log shows them being exceeded, and CI stays green.**
Cause: only `maximumWarning` is set, so the failure is routed to `addWarning` and the build
succeeds. Fix: set the error threshold — that is the one that fails the build:

```json
{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
```

**★ Symptom: a failure names `bundle initial` and you cannot find a bundle with that name.**
Cause: it is the hard-coded label of the `initial` calculator, not a filename. Fix: nothing to
find — the message is telling you the sum of initial chunks crossed a threshold:

```json
{ "type": "initial", "maximumError": "1MB" }
```

**★ Symptom: a message says a budget `failed to meet minimum budget` when you only meant to cap the
size.** Cause: you used `warning` or `error` rather than `maximumWarning` or `maximumError`, and
those keys produce a Min threshold as well as a Max one. Fix: name the direction you want:

```json
{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
```

**★ Symptom: a size in a budget message does not match what your file manager reports.** Cause:
`formatSize` uses base 1000 with two decimals, while most operating systems display base 1024. Fix:
nothing to change — convert deliberately, and remember thresholds are parsed in base 1000 too:

```json
{ "type": "allScript", "maximumError": "1500kb" }
```

**★ Symptom: one regression produces five failure messages.** Cause: the per-item budget types
(`any`, `anyScript`, `anyComponentStyle`) return one result per asset, and each becomes its own
error or warning. Fix: expected — if you want one number, use the summing type:

```json
{ "type": "allScript", "maximumError": "1.5MB" }
```

**★ Symptom: a build fails with a budget error and no other diagnostic, and someone assumes the
compiler broke.** Cause: `executionResult.addError(message)` makes the budget failure a build
error, indistinguishable in outcome from a compilation error. Fix: nothing is broken — read the
message; it names the label, the limit and the total:

```json
{ "type": "bundle", "name": "admin", "maximumError": "300kb" }
```

**Symptom: a message reports `0 bytes`.** Cause: `formatSize` returns the literal string
`0 bytes` for any size of zero or less, rather than formatting it. Fix: a zero measurement usually
means the budget matched nothing — check a `bundle` budget's `name` against the chunk names:

```json
{ "type": "bundle", "name": "admin", "maximumError": "300kb" }
```

**Symptom: a comment or answer says `anyComponentStyle` is handled by a separate checker, and you
cannot find one.** Cause: that is the webpack path. `checkBudgets` excludes the type by default and
the `application` builder passes `true` to include it, so under this builder it is evaluated in the
main pass. Fix: budget it like any other type:

```json
{ "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
```

## Interview questions

**★ Why is `maximumError` the threshold that matters?**
Because severity is a build outcome, not a log level. The builder routes an `error`-severity budget
failure to `executionResult.addError(message)`, which fails the build, and a `warning`-severity one
to `addWarning`, which does not. Budgets are the only mechanism in the default toolchain that turns
a size regression into a failed CI job, and that mechanism is entirely contained in the error
threshold. A workspace with only `maximumWarning` has documentation, not a guard. The complete
answer adds the corollary: set both, so you get a runway before you hit the wall.

**★ How do you identify which budget failed from the message alone?**
By the label at the start of it. `bundle initial` is the `initial` type, `total scripts` is
`allScript`, `total` is `all`, a bare name is a `bundle` budget with that `name`, and a filename is
one of the three per-item types. That mapping is what makes a CI log actionable when the build
artefacts are gone. The trap is `bundle initial`: it looks like a filename and there is no such
file — the string is hard-coded in the calculator.

**★ What units does a budget message use, and why do they not match my file manager?**
`bytes`, `kB`, `MB`, `GB`, chosen by `Math.floor(Math.log(size) / Math.log(1000))` — base 1000, with
two decimal places above bytes and none for bytes. Most operating systems display base-1024 units,
so the same file reads differently in the two places. It is the same 1000 used by
`BYTES_IN_KILOBYTE` when parsing your threshold, so at least the budget and its message agree with
each other.

**Can a budget failure say something is too small?**
Yes, and the message is `failed to meet minimum budget`. It comes from a Min threshold, which you
get from `minimumWarning`/`minimumError` deliberately, or from `warning`/`error` accidentally —
those two keys yield both a Min and a Max threshold from one value. A shrinking bundle is a real
signal worth catching: it usually means something stopped being included in the build.

**Is `anyComponentStyle` evaluated by the `application` builder?**
Yes. `checkBudgets` filters the type out by default, because the legacy webpack path had a separate
`AnyComponentStyleBudgetChecker`, but the `application` builder passes `true` as the third argument
so the type is included in the main pass. Answers and comments that describe a separate checker are
describing the older builder — under `@angular/build:application` there is one pass and it covers
all seven types.

**Both message templates contain the phrase `was not met by`. Why does that read oddly for a
maximum?**
Because the two templates share the phrasing and only their opening clause differs — one says
`exceeded maximum budget`, the other `failed to meet minimum budget`. For a minimum the whole
sentence is natural; for a maximum, "budget X was not met by Y" is describing the size of the
overshoot rather than a shortfall. It is worth recognising because the wording makes people wonder
whether they are reading the wrong message; the clause to trust is the first one.

{/* FOOTER */}
