---
title: "There are seven budget types and only `type` is required, which means a budget object can be syntactically perfect, schema-valid, and enforce absolutely nothing"
sidebar_label: "08 · Budgets: the seven types"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `definitions.budget` read from
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> and the calculators from
> [`packages/angular/build/src/utils/bundle-calculator.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/bundle-calculator.ts),
> both at tag `v22.1.7`; the type descriptions quoted verbatim from
> [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build#configuring-size-budgets).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A budget is the only thing in the default Angular toolchain that turns a size regression into a
failed build — and it is unusually easy to write one that does nothing at all.** The schema
requires a single property, so `{"type": "bundle"}` validates, ships, and never produces a
threshold. This page is the field: the nine properties, the seven types, and the two ways a budget
goes silently inert. [08b](08b-what-each-type-sums.md) reads the calculator behind each type,
[08c](08c-what-reaches-the-calculator.md) covers which files ever reach them,
[08d](08d-threshold-strings-and-the-baseline.md) covers the threshold strings, and
[09](09-when-a-budget-fails.md) covers what happens when one is exceeded.

Choosing budget *values* — analysing a bundle, finding the fat dependency — belongs to the
performance phase. This topic owns the field and its failure modes.

## The schema

Verbatim from `definitions.budget` at `v22.1.7`:

```json
{
  "budget": {
    "type": "object",
    "properties": {
      "type": {
        "type": "string",
        "description": "The type of budget.",
        "enum": ["all", "allScript", "any", "anyScript", "anyComponentStyle", "bundle", "initial"]
      },
      "name":           { "type": "string", "description": "The name of the bundle." },
      "baseline":       { "type": "string", "description": "The baseline size for comparison." },
      "maximumWarning": { "type": "string", "description": "The maximum threshold for warning relative to the baseline." },
      "maximumError":   { "type": "string", "description": "The maximum threshold for error relative to the baseline." },
      "minimumWarning": { "type": "string", "description": "The minimum threshold for warning relative to the baseline." },
      "minimumError":   { "type": "string", "description": "The minimum threshold for error relative to the baseline." },
      "warning":        { "type": "string", "description": "The threshold for warning relative to the baseline (min & max)." },
      "error":          { "type": "string", "description": "The threshold for error relative to the baseline (min & max)." }
    },
    "additionalProperties": false,
    "required": ["type"]
  }
}
```

and the array that holds them is described as *"Budget thresholds to ensure parts of your
application stay within boundaries which you set."*, with `"default": []`.

🔴 **Only `type` is required.** Six of the nine properties are thresholds and every one of them is
optional, so a budget with a type and nothing else is valid JSON, valid against the schema, and
produces **no thresholds** — the threshold generator yields one entry per threshold key you set,
and yields nothing for an object that sets none.

That is the first of two ways a budget can be silently inert. The second — a `bundle` budget with
no `name`, which makes its calculator return an empty array — is
[08b](08b-what-each-type-sums.md).

## The seven types, as documented

Verbatim from angular.dev's size-budgets table:

> *"| `bundle` | The size of a specific bundle. Use this type together with `name` to budget a
> specific bundle, including a lazy-loaded bundle. |"*
> *"| `initial` | The size of JavaScript and CSS needed for bootstrapping the application. This
> corresponds to the `Initial Total` value shown in the build output summary. Defaults to warning at
> 500kb and erroring at 1mb. |"*
> *"| `allScript` | The size of all scripts. |"*
> *"| `all` | The size of the entire application. |"*
> *"| `anyComponentStyle` | This size of any one component stylesheet. Defaults to warning at 2kb and
> erroring at 4kb. |"*
> *"| `anyScript` | The size of any one script. |"*
> *"| `any` | The size of any file. |"*

⚠️ **Two of those descriptions do not survive contact with the source.** The `anyComponentStyle`
default quoted above (`2kb`/`4kb`) is not what `ng new` writes — see
[09b](09b-raw-bytes-and-the-defaults-discrepancy.md). And *"the size of the entire application"* and
*"the size of any file"* are broader than what the builder actually measures — see
[08c](08c-what-reaches-the-calculator.md).

## Gotchas

**★ Symptom: a budget object with only `type` passes validation and enforces nothing.** Cause: the
schema requires only `type`, and the threshold generator emits one threshold per threshold key that
is set — none set, none emitted. Fix: always pair a type with at least one threshold, and prefer
the error form if you want it to matter:

```json
{ "type": "initial", "maximumError": "1MB" }
```

**★ Symptom: you wanted "no single script over 200 kB" and used `allScript`, so one huge file
passes because the total is under.** Cause: `allScript` sums; `anyScript` applies the threshold to
each asset independently. Fix: use the per-item type:

```json
{ "type": "anyScript", "maximumError": "200kb" }
```

**★ Symptom: an unknown budget type is rejected rather than ignored.** Cause: `type` is an `enum`
of exactly seven values and the definition is `additionalProperties: false`. Fix: the seven are
`all`, `allScript`, `any`, `anyScript`, `anyComponentStyle`, `bundle`, `initial` — there is no
`lazy`, no `vendor` and no `styles`:

```json
{ "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
```

**Symptom: `name` is set on an `initial` budget and appears to do nothing.** Cause: only the
`bundle` calculator reads `budget.name`; every other type ignores it. It is schema-valid and inert.
Fix: drop it, or switch the type to `bundle` if a named chunk is what you meant:

```json
{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
```

**Symptom: `minimumWarning` is set and has never once fired.** Cause: the minimum thresholds fire
when the measured size is **below** the limit — they exist to catch output that unexpectedly
shrank or emptied, not output that grew. Fix: if you meant "must not exceed", the key is
`maximumWarning`; if you meant "something is wrong if this bundle almost disappears", keep the
minimum and pick a value that only an empty build could hit:

```json
{ "type": "initial", "minimumError": "10kb", "maximumError": "1MB" }
```

**Symptom: a `"comment"` or `"note"` key added to a budget entry fails validation.** Cause: the
definition is `additionalProperties: false` with exactly nine allowed properties. Fix: keep the
rationale out of the entry — a budget object holds thresholds and nothing else:

```json
{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
```

**Symptom: `budgets` written as an object keyed by type is rejected.** Cause: it is an array of
budget objects, each carrying its own `type`. Fix: write the array form, which is also what makes
several budgets of the same type possible:

```json
{
  "budgets": [
    { "type": "initial", "maximumError": "1MB" },
    { "type": "anyComponentStyle", "maximumError": "8kB" }
  ]
}
```

**Symptom: two `initial` budgets with different limits are both reported.** Cause: `budgets` is a
list and every entry is evaluated independently — nothing deduplicates by type, so the stricter one
does not shadow the looser one. Fix: keep one entry per intent:

```json
{ "budgets": [{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }] }
```

## Interview questions

**★ How can a budget be schema-valid and enforce nothing?**
Two ways, both common. First, the schema requires only `type`, and every threshold property is
optional — a budget that sets no threshold produces no thresholds to check, because the generator
emits one per key you set. Second, a `bundle` budget with no `name` makes `BundleCalculator` return
an empty array, so the budget is skipped without any message at all. Both objects look configured:
they are in the right place, they validate, and they are silent. The reviewable habit that catches
both is to require every budget entry to name a `maximumError`, and every `bundle` entry to name a
`name`.

**★ What is the difference between `allScript` and `anyScript`?**
Aggregation. `allScript` sums the sizes of every `.js` asset and checks the threshold once against
that total; `anyScript` applies the same threshold independently to each `.js` asset and reports
per file. The same relationship holds between `all` and `any`. Choosing wrongly is a silent
failure: an `allScript` budget lets one enormous lazy chunk through as long as the total is under,
which is usually the opposite of the intent.

**Why are there both `initial` and `all`?**
Because they answer different questions. `initial` sums only the chunks marked initial — what the
browser must download before the application boots, which is the number that correlates with
time-to-interactive. `all` sums everything the build emitted, which is a repository-health number:
it grows when a lazy route is added even though no user pays for it up front. A project that only
budgets `all` will not notice the initial bundle doubling as long as something else shrank.

**What happens if you set `name` on a non-`bundle` budget?**
Nothing. Only `BundleCalculator` reads `budget.name`; the other calculators ignore it, and the
schema permits it because `name` is declared at the definition level rather than per type. It is
schema-valid, inert, and misleading to the next reader — which makes it worth removing rather than
leaving as documentation of intent.

**What are `minimumWarning` and `minimumError` for?**
They fire when the measured size falls **below** the limit rather than above it. The use case is
detecting output that has unexpectedly collapsed — a lazy chunk that stopped being emitted because
an import was removed, a stylesheet that silently became empty, a build that produced far less than
it should have. They are rare in practice and almost never what someone means when they add a
budget, which is why writing `minimumWarning` where `maximumWarning` was intended produces a guard
that can never fire.

**Why does the budget definition set `additionalProperties: false`?**
For the same reason the builder schema does: so a misspelled or invented key fails loudly instead
of sitting in the file being ignored. A budget is a guard, and a guard that silently did nothing
because someone wrote `maxError` instead of `maximumError` would be worse than no guard at all —
it would be a guard everybody believed in. The nine allowed properties are the whole surface, and
anything else stops the build.

{/* FOOTER */}
