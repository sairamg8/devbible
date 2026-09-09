---
title: "A threshold is a string parsed by one regex, `kb` means 1000 bytes, and anything the regex rejects becomes `NaN` — a limit that can never be crossed, reported by nothing"
sidebar_label: "08d · Threshold strings"
sidebar_position: 8.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `BYTES_IN_KILOBYTE`, `calculateBytes` and
> the `warning` branch of `calculateThresholds` quoted verbatim from
> [`packages/angular/build/src/utils/bundle-calculator.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/bundle-calculator.ts)
> at tag `v22.1.7`; the unit table and the baseline example quoted verbatim from
> [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build#configuring-size-budgets).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every threshold in `angular.json` is a string, and one twenty-line function decides what it
means.** That function has three behaviours that catch people: kilobytes are 1000 bytes and not
1024, an unparseable string produces `NaN` rather than an error, and a percentage without a
`baseline` evaluates to zero. All three are silent. This page reads the parser, the unit table and
the two-sided `warning`/`error` forms. The types those thresholds attach to are
[08 · Budgets](08-budgets-the-seven-types.md).

## The parser

```ts
export const BYTES_IN_KILOBYTE = 1000;
```

```ts
function calculateBytes(input: string, baseline?: string, factor: 1 | -1 = 1): number {
  const matches = input.trim().match(/^(\d+(?:\.\d+)?)[ \t]*(%|[kmg]?b)?$/i);
  if (!matches) {
    return NaN;
  }

  const baselineBytes = (baseline && calculateBytes(baseline)) || 0;

  let value = Number(matches[1]);
  switch (matches[2] && matches[2].toLowerCase()) {
    case '%':  value = (baselineBytes * value) / 100; break;
    case 'kb': value *= BYTES_IN_KILOBYTE; break;
    case 'mb': value *= BYTES_IN_KILOBYTE * BYTES_IN_KILOBYTE; break;
    case 'gb': value *= BYTES_IN_KILOBYTE * BYTES_IN_KILOBYTE * BYTES_IN_KILOBYTE; break;
  }

  if (baselineBytes === 0) {
    return value;
  }

  return baselineBytes + value * factor;
}
```

### 1 · `kb` is 1000 bytes

🔴 **`BYTES_IN_KILOBYTE = 1000`.** A `500kB` budget is 500 000 bytes, not 512 000. `mb` and `gb`
are powers of the same 1000. If you have been mentally converting to 1024-based units, every budget
you have set is about 2.4% tighter than you thought at kilobyte scale and about 4.9% at megabyte
scale.

### 2 · What the regex accepts

`/^(\d+(?:\.\d+)?)[ \t]*(%|[kmg]?b)?$/i` — a number, optional decimal part, optional spaces or
tabs, and an optional unit, case-insensitively, anchored at both ends after a `trim()`.

| Written | Parses as |
|---|---|
| `500` | 500 bytes — the unit is optional and no unit means bytes |
| `500b` | 500 bytes |
| `500kb` · `500KB` · `500kB` | 500 000 bytes |
| `500 kb` | 500 000 bytes — internal spaces and tabs are allowed |
| `1.5mb` | 1 500 000 bytes — a decimal part is allowed |
| `2gb` | 2 000 000 000 bytes — `gb` parses, though the documentation's unit table omits it |
| `10%` | relative to `baseline`, see below |

and the documented table, verbatim:

> *"| `123` or `123b` | Size in bytes. |"*
> *"| `123kb` | Size in kilobytes. |"*
> *"| `123mb` | Size in megabytes. |"*
> *"| `12%` | Percentage of size relative to baseline. (Not valid for baseline values.) |"*

### 3 · Anything else is `NaN`, and nothing reports it

🔴 **`if (!matches) { return NaN; }`.** There is no validation message, no warning and no build
failure. `"500 kilobytes"`, `"500k"`, `"1,000kb"`, `"~500kb"` and `"500 kb "`-with-a-trailing-tab
inside quotes all produce a limit of `NaN`, and every comparison against `NaN` is false — so the
threshold **can never fire.**

This is the second of the two ways a budget goes silently inert, the first being a `bundle` budget
with no `name` ([08b](08b-what-each-type-sums.md)). Both produce a budget that is present,
schema-valid and useless.

### 4 · A percentage with no baseline is zero

Follow the code with `{"maximumError": "10%"}` and no `baseline`:

- `baselineBytes = (baseline && calculateBytes(baseline)) || 0` → **0**
- `case '%': value = (baselineBytes * value) / 100` → `(0 * 10) / 100` → **0**
- `if (baselineBytes === 0) { return value; }` → returns **0**

🔴 **The limit is zero bytes.** A percentage threshold without a baseline is not "ignored" and does
not fall back to an absolute value — it evaluates to a limit no output can satisfy. The
documentation's own note says a percentage is *"(Not valid for baseline values.)"*, which is about
the `baseline` property itself; what it does not say is what happens when the baseline is absent
entirely.

## `baseline` and the percentage form

With a baseline, the final line does the work: `baselineBytes + value * factor`. The documented
example:

```json
{
  "type": "bundle",
  "name": "main",
  "baseline": "200kb",
  "maximumWarning": "10%",
  "maximumError": "20%"
}
```

> *"In this example, the builder warns when the bundle grows beyond `220kb` and errors when it grows
> beyond `240kb`."*

Ten percent of 200 kB is 20 kB; the maximum threshold uses `factor: 1`, so the limit is
200 000 + 20 000 = 220 000 bytes. The percentage is of the baseline, not of the measured size, and
the baseline itself must be an absolute value.

## `warning` and `error` are two-sided

The single-word forms are not shorthand for the maximum forms. From `calculateThresholds`:

```ts
if (budget.warning) {
  yield { limit: calculateBytes(budget.warning, budget.baseline, -1), type: ThresholdType.Min, severity: ThresholdSeverity.Warning };
  yield { limit: calculateBytes(budget.warning, budget.baseline,  1), type: ThresholdType.Max, severity: ThresholdSeverity.Warning };
}
```

**One key, two thresholds — a Min and a Max.** With `{"baseline": "200kb", "warning": "10%"}` the
Min limit is 200 000 − 20 000 = 180 000 and the Max is 220 000, so the budget is a *band*: it
complains when the bundle grows past 220 kB **and** when it unexpectedly shrinks below 180 kB. That
second half is a genuinely useful signal — a bundle that suddenly halved usually means something
stopped being included — and almost nobody knows the mechanism exists. `error` works identically at
error severity.

⚠️ **Without a `baseline`, the band collapses.** `calculateBytes` returns early when
`baselineBytes === 0`, before the `factor` is applied, so both the Min and the Max are computed to
the same number. `{"warning": "500kb"}` with no baseline is therefore not a band around anything —
the two thresholds land on one point. If you want an upper limit, `maximumWarning` is the key that
means that.

## Gotchas

**★ Symptom: a `"512kb"` budget behaves as if it were smaller than you expected.** Cause: `kb` is
1000 bytes, so `512kb` is 512 000 and not 524 288. Fix: write the number you actually mean in
base-1000 units:

```json
{ "type": "initial", "maximumError": "524kb" }
```

**★ Symptom: a budget is configured and CI has never failed, even on an obvious regression.**
Cause: an unparseable threshold string produced `NaN`, and no comparison against `NaN` is ever
true. Nothing reports it. Fix: use the exact grammar — digits, optional decimal, optional
whitespace, then one of `b`, `kb`, `mb`, `gb`:

```json
{ "type": "initial", "maximumError": "1MB" }
```

**★ Symptom: `"maximumError": "10%"` fails every build immediately.** Cause: with no `baseline` the
percentage evaluates to zero bytes, and a zero-byte limit cannot be met. Fix: add the baseline the
percentage is relative to, or use an absolute value:

```json
{ "type": "bundle", "name": "main", "baseline": "200kb", "maximumError": "20%" }
```

**★ Symptom: a budget warns that a bundle is *too small*.** Cause: `warning` and `error` — as
opposed to `maximumWarning` and `maximumError` — each yield a Min threshold as well as a Max one.
Fix: if you only want an upper bound, name it:

```json
{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
```

**★ Symptom: `"500k"` or `"500 kilobytes"` is accepted by the schema and never enforced.** Cause:
the schema types every threshold as a plain `string`, so the only validation is the parser's regex,
and its failure mode is `NaN` rather than an error. Fix: the unit is `kb`, not `k`:

```json
{ "type": "allScript", "maximumError": "1500kb" }
```

**Symptom: `"1,000kb"` never fires.** Cause: the regex accepts a decimal point, not a thousands
separator, so the comma makes the whole string unmatchable. Fix: drop the separator, or move up a
unit:

```json
{ "type": "allScript", "maximumError": "1mb" }
```

**Symptom: someone writes `"2gb"` and a reviewer says gigabytes are unsupported.** Cause: the
documentation's unit table lists bytes, kilobytes and megabytes only, but the parser's switch has a
`gb` case. Fix: it parses — though a gigabyte budget on a browser bundle is a sign the threshold is
not doing any work:

```json
{ "type": "all", "maximumError": "2mb" }
```

**Symptom: a percentage threshold is set on the `baseline` property itself.** Cause: the
documentation notes a percentage is *"(Not valid for baseline values.)"* — the baseline is the
absolute figure everything else is relative to. Fix: give the baseline a real size:

```json
{ "type": "bundle", "name": "main", "baseline": "200kb", "maximumWarning": "10%" }
```

**Symptom: a budget written as a number rather than a string is rejected.** Cause: every threshold
property is declared `"type": "string"` in the schema, because the value carries a unit. Fix: quote
it — and remember an unquoted-looking `"500"` is 500 *bytes*, not 500 kB:

```json
{ "type": "initial", "maximumError": "500kb" }
```

## Interview questions

**★ Is a kilobyte 1000 or 1024 bytes in an Angular budget?**
1000. The constant is literally `export const BYTES_IN_KILOBYTE = 1000;`, and `mb` and `gb` are
powers of it. So `500kB` is 500 000 bytes. It matters more than it sounds: anyone converting
mentally from 1024-based units is setting budgets a few percent tighter than intended, and the
discrepancy grows with the unit — about 2.4% at kilobyte scale and about 4.9% at megabyte scale.

**★ What happens if a threshold string is malformed?**
It becomes `NaN`, silently. `calculateBytes` returns `NaN` when its regex does not match, there is
no validation message, and every comparison against `NaN` is false — so the threshold can never
fire. A budget with `"500 kilobytes"` or `"500k"` is present in the file, valid against the schema,
and completely inert. Together with a `bundle` budget missing its `name`, this is one of the two
ways a budget silently does nothing, and both are worth checking explicitly when someone reports
that CI never catches size regressions.

**★ What is the difference between `warning` and `maximumWarning`?**
`maximumWarning` produces one threshold, an upper bound. `warning` produces **two** — a Min and a
Max — because the generator yields once with `factor: -1` and once with `factor: 1`. With a
baseline that gives a band either side of it, so the budget also complains when the bundle
unexpectedly *shrinks*, which is a useful signal that something stopped being bundled. Without a
baseline the early return in `calculateBytes` fires before the factor is applied and both
thresholds collapse onto the same number, which is not what anyone intends. Use `maximumWarning`
for an upper limit and reserve `warning` for a baseline-relative band.

**★ What does a percentage threshold mean without a `baseline`?**
Zero bytes. `baselineBytes` defaults to `0`, the percentage branch computes `(0 * value) / 100`,
and the early return hands that back — so `"maximumError": "10%"` with no baseline is a zero-byte
limit that no build can satisfy. It is one of the rare budget mistakes that fails loudly rather
than silently, which is fortunate, but the error will look like a size problem rather than a
configuration one.

**How would you express "this bundle must not grow more than 10% over the last release"?**
Set `baseline` to the last release's measured size as an absolute value, and `maximumWarning` or
`maximumError` to `"10%"`. The percentage is computed against the baseline, not against the current
measurement, and the resulting limit is `baseline + baseline × 10%`. The documentation's own
example makes the arithmetic explicit: a `200kb` baseline with `10%`/`20%` warns beyond `220kb` and
errors beyond `240kb`. The baseline is a number you have to update deliberately, which is the
point — it makes the growth allowance a reviewed decision rather than a ratchet.

**Why is there no validation error for a bad threshold string?**
Because the schema types every threshold as a plain `string` — a unit-carrying value cannot be
expressed as a JSON number — and no pattern is attached to it. The only parsing happens inside
`calculateBytes` at build time, and its failure path returns `NaN` rather than raising. It is a
genuine gap: this is one of the few places in `angular.json` where a mistake is neither caught by
the schema nor reported at runtime, which is why it is worth a review habit rather than a tool.

{/* FOOTER */}
