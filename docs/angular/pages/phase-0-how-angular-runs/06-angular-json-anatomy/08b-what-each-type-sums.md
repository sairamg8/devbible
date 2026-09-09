---
title: "Each budget type is four lines of source, and reading them settles every argument about what a budget measures — including the one where a `bundle` budget with no `name` is skipped in total silence"
sidebar_label: "08b · What each type sums"
sidebar_position: 8.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — every calculator quoted verbatim from
> [`packages/angular/build/src/utils/bundle-calculator.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/bundle-calculator.ts)
> at tag `v22.1.7`; the `bundle`/`name` guidance quoted verbatim from
> [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build#configuring-size-budgets).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular's budget documentation gives you one sentence per type; the source gives you four lines,
and the four lines answer questions the sentence cannot.** Does `all` include source maps? Does
`initial` include CSS? What exactly does `bundle` match on? Each type maps to a small calculator
class, and this page reads them. The field itself is [08 · Budgets](08-budgets-the-seven-types.md);
which files ever reach these calculators is [08c](08c-what-reaches-the-calculator.md).

## `initial` — the sum of chunks marked initial

```ts
/** The sum of all initial chunks (marked as initial). */
class InitialCalculator extends Calculator {
  calculate() {
    return [{
      label: `bundle initial`,
      size: this.chunks.filter((chunk) => chunk.initial)
        .map((chunk) => this.calculateChunkSize(chunk))
        .reduce((l, r) => l + r, 0),
    }];
  }
}
```

It filters on a flag the build sets, not on a filename or an extension, and returns exactly one
entry labelled `bundle initial`. This is the budget that corresponds to what a user waits for before
the application boots.

## `allScript` — the sum of every `.js` asset

```ts
/** The sum of all the scripts portions. */
class AllScriptCalculator extends Calculator {
  calculate() {
    const size = this.assets.filter((asset) => asset.name.endsWith('.js'))
      .map((asset) => this.getAssetSize(asset))
      .reduce((total: number, size: number) => total + size, 0);

    return [{ size, label: 'total scripts' }];
  }
}
```

One entry, labelled `total scripts`, filtered purely on the `.js` suffix — so lazy chunks are
included and stylesheets are not.

## `all` — everything except source maps and component styles

```ts
/** All scripts and assets added together. */
class AllCalculator extends Calculator {
  calculate() {
    const size = this.assets
      .filter((asset) => !asset.name.endsWith('.map') && !asset.componentStyle)
      .map((asset) => this.getAssetSize(asset))
      .reduce((total: number, size: number) => total + size, 0);

    return [{ size, label: 'total' }];
  }
}
```

Two exclusions, both deliberate. Source maps are development artefacts that no user downloads as
part of the application, and component styles are excluded because `anyComponentStyle` budgets them
separately — counting them twice would make a per-component threshold and a global one interfere.

## `bundle` — chunks whose `names` include your `name`

```ts
/** A named bundle. */
class BundleCalculator extends Calculator {
  calculate() {
    const budgetName = this.budget.name;
    if (!budgetName) {
      return [];
    }

    const size = this.chunks
      .filter((chunk) => chunk?.names?.includes(budgetName))
      .map((chunk) => this.calculateChunkSize(chunk))
      .reduce((l, r) => l + r, 0);

    return [{ size, label: this.budget.name }];
  }
}
```

🔴 **`return []` on a missing `name` is a silent no-op.** No error, no warning, no threshold — the
budget is skipped and the build says nothing. It is the most dangerous budget mistake there is,
because the object *looks* configured: it has a type, it has thresholds, it validates, and it sits
in the file where budgets go.

The documentation gives the correct form and one caveat about the value:

> *"To configure a budget for a lazy-loaded bundle, use `type: "bundle"` and set `name` to that
> bundle's name."*

> *"The `name` field matches the bundle name, not the emitted filename, so it does not use wildcard
> or regular expression patterns such as `admin.*.js`."*

```json
{
  "budgets": [
    {
      "type": "bundle",
      "name": "admin",
      "maximumWarning": "250kb",
      "maximumError": "300kb"
    }
  ]
}
```

Note the filter is `chunk?.names?.includes(budgetName)` — a chunk carries a *list* of names, so one
budget can legitimately sum several chunks that share a name.

## The three per-item types

`anyScript` and `any` apply the same filters as `allScript` and `all`, but return **one entry per
asset** instead of a single sum. `anyComponentStyle` returns one entry per asset whose
`componentStyle` flag is set.

That is the whole difference between *"the size of all scripts"* and *"the size of any one
script"*: a threshold checked once against a total, or the same threshold checked independently
against every file.

| Type | Aggregation | Label in a failure message |
|---|---|---|
| `initial` | sum of initial chunks | `bundle initial` |
| `bundle` | sum of chunks matching `name` | the budget's `name` |
| `allScript` | sum of `.js` assets | `total scripts` |
| `all` | sum of assets minus `.map` and component styles | `total` |
| `anyScript` | per `.js` asset | the asset filename |
| `any` | per asset | the asset filename |
| `anyComponentStyle` | per component-style asset | the asset filename |

That last column is worth memorising: it is how you identify which budget failed from the message
alone ([09](09-when-a-budget-fails.md)).

## Gotchas

**★ Symptom: a `bundle` budget is in the file and nothing is ever checked.** Cause: no `name`, so
the calculator returns an empty array and the budget is skipped without a message. Fix: name the
bundle — the value is the chunk name, not a filename and not a glob:

```json
{ "type": "bundle", "name": "admin", "maximumWarning": "250kb", "maximumError": "300kb" }
```

**★ Symptom: `"name": "admin.*.js"` matches nothing.** Cause: the documentation states that `name`
matches the bundle name and not the emitted filename, with no wildcard or regular-expression
support — and the filter is a plain `includes` on a list of names. Fix: use the bundle name:

```json
{ "type": "bundle", "name": "admin", "maximumError": "300kb" }
```

**★ Symptom: an `all` budget and an `allScript` budget set to the same value behave differently.**
Cause: `allScript` counts `.js` only; `all` counts every asset except `.map` files and component
styles. They are different sums over the same build. Fix: expect the difference and pick the one
that expresses the intent:

```json
{
  "budgets": [
    { "type": "allScript", "maximumError": "1.5MB" },
    { "type": "all", "maximumError": "2MB" }
  ]
}
```

**★ Symptom: component styles are expected to count towards `all` and do not.** Cause:
`AllCalculator` filters out any asset whose `componentStyle` flag is set, alongside `.map` files,
so that a per-component budget and a global one do not interfere. Fix: budget them with the type
built for them:

```json
{ "type": "anyComponentStyle", "maximumError": "8kB" }
```

**★ Symptom: an `initial` budget does not change when a large lazy route is added.** Cause:
`InitialCalculator` filters on the chunk's `initial` flag, and a lazy chunk is not initial by
definition. Fix: budget the lazy route by name, or use `all` if repository-wide growth is what you
want to catch:

```json
{
  "budgets": [
    { "type": "initial", "maximumError": "1MB" },
    { "type": "bundle", "name": "admin", "maximumError": "300kb" }
  ]
}
```

**Symptom: source maps make an `all` budget fail in a configuration that emits them.** They do not
— `AllCalculator` excludes `.map` files explicitly. If an `all` budget fails only in the
configuration that emits source maps, the cause is something else that configuration changes.
Fix: compare the configurations rather than the map setting:

```json
{ "configurations": { "development": { "sourceMap": true, "optimization": false } } }
```

**Symptom: one `bundle` budget appears to cover more than one chunk.** Cause: the filter is
`chunk?.names?.includes(budgetName)` — a chunk carries a list of names, so several chunks can match
one budget and their sizes are summed. Fix: expected; if you need per-chunk thresholds, use
`anyScript` or a budget per name:

```json
{
  "budgets": [
    { "type": "bundle", "name": "admin", "maximumError": "300kb" },
    { "type": "bundle", "name": "reports", "maximumError": "200kb" }
  ]
}
```

**Symptom: `anyScript` reports several failures for one regression.** Cause: it returns one entry
per asset, so every `.js` file over the threshold produces its own message. Fix: expected — if you
want a single number, that is `allScript`:

```json
{ "type": "allScript", "maximumError": "1.5MB" }
```

## Interview questions

**★ Why does `bundle` need a `name` when no other type does?**
Because it is the only type that selects a *subset* of chunks rather than a category of them.
`initial` filters on a flag the build sets, `allScript` and `any` filter on file extension, but a
named bundle can only be identified by its name — the calculator filters chunks whose `names` list
includes the value. With no name there is nothing to filter on, so the calculator returns an empty
array rather than guessing, and returns it silently. The value is the bundle name, not the emitted
filename, and the documentation says explicitly that no wildcard or regular-expression form is
supported.

**★ Which budget type catches a lazy route growing?**
`bundle`, with `name` set to that route's chunk name. It is the only type that isolates one
lazy-loaded bundle. `initial` will never see it, because a lazy chunk is by definition not initial.
`anyScript` would apply the same threshold to every script including the main bundle, and
`allScript` would only notice once the whole application crossed a line. The documentation names
lazy bundles as the reason `bundle` exists.

**★ Does an `all` budget include source maps?**
No. `AllCalculator` filters out any asset whose name ends in `.map`, and separately any asset
flagged as a component style. Both exclusions are deliberate: a source map is not something a user
downloads as part of the application, and component styles have their own budget type, so counting
them in `all` as well would make two independent thresholds interfere.

**What does the label in a budget failure message tell you?**
Which budget failed and, for the per-item types, which file. `initial` produces `bundle initial`,
`allScript` produces `total scripts`, `all` produces `total`, a `bundle` budget produces the name
you gave it, and `any`, `anyScript` and `anyComponentStyle` produce the asset filename. That is
enough to identify the entry in your `budgets` array from the message alone, which matters when a
build fails in CI and the only artefact you have is the log.

**Why are `all` and `any` two types rather than one option?**
Because they are different questions with the same filter. `all` sums and asks "is the total too
big"; `any` applies the threshold to each asset and asks "is any single file too big". Expressing
that as an option on one type would mean a threshold value whose meaning changed depending on
another key, which is exactly the kind of configuration that gets misread. Two names make the
intent unambiguous at the point of reading.

**Can one `bundle` budget match several chunks?**
Yes. The filter is `includes` on the chunk's list of names, and chunks can share a name, so the
budget sums every match and reports one figure under the name you supplied. That is usually what
you want for a feature area split across chunks, and it is worth knowing when a `bundle` budget
reports a number larger than any single file you can find in the output.

{/* FOOTER */}
