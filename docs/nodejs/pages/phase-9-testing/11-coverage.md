---
title: "Coverage — and why 100% is a bad target"
sidebar_label: "11 · Coverage"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**.

**Coverage measures which lines executed. It says nothing about whether anything was
checked.** That single sentence is the whole page — the rest is the evidence and what to
do instead.

## Running it

```bash
node --experimental-test-coverage --test
```

```console
ℹ start of coverage report
ℹ -------------------------------------------------------------
ℹ file         | line % | branch % | funcs % | uncovered lines
ℹ -------------------------------------------------------------
ℹ discount.mjs |  81.82 |    85.71 |   50.00 | 10-11
ℹ -------------------------------------------------------------
ℹ all files    |  81.82 |    85.71 |   50.00 |
ℹ -------------------------------------------------------------
ℹ end of coverage report
```

Built in — no `nyc`, no `c8`, no instrumentation step. The `uncovered lines` column is
the useful part; the percentages are the part that gets abused.

Scope it, because `node_modules` and test files skew everything:

```bash
node --experimental-test-coverage \
     --test-coverage-include='src/**' \
     --test-coverage-exclude='src/**/*.test.mjs' \
     --test
```

Thresholds fail the run:

```bash
node --experimental-test-coverage --test-coverage-lines=80 --test
```

```console
ℹ Error: 81.82% line coverage does not meet threshold of 90%.
$ echo $?
1
```

Also `--test-coverage-branches` and `--test-coverage-functions`. For a report tools can
read: `--test-reporter=lcov --test-reporter-destination=lcov.info`.

## The demonstration

A function, and a test that gives it **100% of everything**:

```js
// vat.mjs
export function withVat(net) {
  return net * 1.2;
}
```

```js
test('adds VAT', () => assert.equal(withVat(100), 120));
```

```console
ℹ file      | line % | branch % | funcs % | uncovered lines
ℹ vat.mjs   | 100.00 |   100.00 |  100.00 |
```

Perfect score. And:

```console
$ node -e "import('./vat.mjs').then(m => console.log(m.withVat(19.99)))"
23.987999999999996
```

**A float-money bug, in a fully covered function, shipping green.** Coverage cannot see
it, because the line executed. It was never going to see it.

## The other direction: covered but unasserted

```js
// TENOFF has a boundary at 10
export function discount(total, code) {
  if (code === 'TENOFF') return total >= 10 ? total - 10 : total;
  return total;
}
```

A three-test suite reports **100% line coverage**. Mutation testing on the same suite —
[page 17](./17-property-and-mutation.md) — reports:

```console
13 killed, 2 survived, mutation score 86.67 %

[Survived] ConditionalExpression   total >= 10  →  true
[Survived] EqualityOperator        total >= 10  →  total > 10
```

Both survivors are the boundary. **No test uses `total = 10` or below**, so the
comparison can be changed to anything and every test still passes. The line was
covered; the behaviour was not tested.

## What the number is good for

Coverage is a **finder of untested regions**, not a measure of quality.

The `uncovered lines` column is genuinely useful: it points at the error branch nobody
exercised, the `catch` that has never run, the function that was left behind by a
refactor. Read the column, not the percentage.

A threshold has one legitimate job: **stopping a slide**. Set it a little below where
you are (`--test-coverage-lines=80` when you are at 84) so it fails when a large
untested addition lands, and do not ratchet it toward 100.

## Why 100% is actively harmful

- **It rewards the wrong tests.** The cheapest way to raise the number is to call
  functions without asserting anything — which is exactly what mutation testing
  exposes.
- **It makes defensive code a liability.** An unreachable `default:` case or an
  `if (!config) throw` you can never trigger becomes something to delete or to fake a
  test for.
- **It ends in `/* istanbul ignore */` comments**, at which point the number measures
  how many ignore comments you have written.
- **It buys confidence that is not there.** 100% covered code containing
  `net * 1.2` is the whole argument.

Aim instead for: **every branch that changes an outcome has a test that would fail if
the branch were wrong.** That is not measurable by execution — which is why it is a
review question, not a CI gate.

## Reading it well

| Signal | What it usually means |
|---|---|
| Line 100%, **branch much lower** | A conditional whose other side never runs |
| Function % low | Whole exported functions with no test |
| Uncovered lines in a `catch` | Error paths never exercised — often the real gap |
| Coverage rises, mutation score flat | Tests that execute but do not assert |

The last row is the one worth internalising: a rising percentage with no new assertions
is not progress.

## Gotchas

**Symptom:** Coverage says 100% and a bug ships
**Cause:** Coverage records execution, not assertions.
**Fix:** Use it to find untested *regions*; use mutation testing to judge assertion
strength.

**Symptom:** The report is dominated by `node_modules` or test files
**Cause:** No include/exclude.
**Fix:** `--test-coverage-include='src/**'` plus an exclude for tests.

**Symptom:** Coverage drops sharply after adding integration tests
**Cause:** They run in a separate process or run, and reports are per-run.
**Fix:** Merge lcov reports, or track the two suites separately.

**Symptom:** Line coverage 100%, branch coverage well below
**Cause:** A ternary or short-circuit whose other side never executes.
**Fix:** Test the boundary — that is precisely where the surviving mutants were.

**Symptom:** The team games the threshold
**Cause:** The number is a target rather than a signal.
**Fix:** Fix the threshold below the current value as a ratchet against regression, and
review assertions rather than percentages.

## Interview questions

**★ Why is 100% coverage a bad target?**
Because coverage measures execution, not verification. Measured here: a one-line
function `withVat` that multiplies by `1.2`, with one passing test, reports 100%
line, branch and function coverage — and returns `23.987999999999996` for `19.99`.
Chasing the number rewards tests that call code without asserting on it.

**★ What is coverage genuinely useful for?**
The `uncovered lines` column — finding error branches, `catch` blocks and whole
functions that no test reaches. Those are real gaps. The percentage is a weak summary
of that list.

**★ How do you know your tests actually assert anything?**
Mutation testing. On a suite with 100% line coverage, Stryker reported 13 mutants
killed and **2 survived**, both at the `total >= 10` boundary — proof that the tests
executed the line without testing the comparison.

**★ How should a coverage threshold be set?**
Slightly below the current level, as a ratchet against a large untested addition. Not
as a goal to raise toward 100, which pushes people to write assertion-free tests and
`ignore` comments.

**What does high line coverage with much lower branch coverage tell you?**
That conditionals are being executed on one side only — usually a ternary or a
short-circuit. It is the most common shape of "covered but untested".

**Do you need `c8` or `nyc` on Node 24?**
No. `--experimental-test-coverage` is built in, with include/exclude, per-metric
thresholds and lcov output.

---

← Prev: [10 · Fixtures and factories](./10-fixtures-and-factories.md) ·
Next → [12 · Vitest and Jest](./12-vitest-and-jest.md)
