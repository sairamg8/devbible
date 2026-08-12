---
title: "Property-based and mutation testing"
sidebar_label: "17 · Property and mutation"
sidebar_position: 17
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** — `fast-check` 4.9.0, `@stryker-mutator/core`
> 9.6.1.

**Two techniques that attack the same blind spot from opposite ends.** Property-based
testing asks *are there inputs you did not think of?* Mutation testing asks *do your
tests actually check anything?* Neither is a daily tool; both are worth a day when you
have a component that must be right.

## Property-based testing

You state a rule that should hold for **all** inputs; the library generates them, and
shrinks any failure to the smallest case that still fails.

```js
import fc from 'fast-check';
import {slugify} from '../src/slugify.mjs';

test('a slug never starts or ends with a dash', () => {
  fc.assert(fc.property(fc.string({minLength: 8, maxLength: 40}), (s) => {
    const out = slugify(s);
    return !out.startsWith('-') && !out.endsWith('-');
  }));
});

test('slugify is idempotent', () => {
  fc.assert(fc.property(fc.string({minLength: 8, maxLength: 40}),
    (s) => slugify(slugify(s)) === slugify(s)));
});
```

### The bug it found

Version 1 passes both properties. Then a 12-character cap is added for a database
column — a realistic later change:

```js
export function slugify(title) {
  return title.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);              // added later
}
```

The example-based tests still pass:

```console
slugify('Hello World')  →  "hello-world"
slugify('  Trim Me  ')  →  "trim-me"
```

The properties do not:

```console
Error: Property failed after 6 tests
Counterexample: ["0 0 00 A AA    0"]
Shrunk 35 time(s)
```

`slice` runs **after** the dash-stripping, so it can cut mid-separator and leave a
trailing dash — and it breaks idempotence at the same time. The counterexample is
minimal and reproducible; the seed is printed so the exact case can be re-run.

### Choosing generator ranges

The first attempt found nothing: `fc.string()` defaults are short enough that a
12-character cap was never reached. **Widening the range to `{minLength: 8, maxLength:
40}` found the bug on the sixth case.** If a property finds nothing, question the
generator before concluding the code is correct.

### Properties worth writing

| Property | Applies to |
|---|---|
| **Round-trip** — `decode(encode(x)) === x` | serialisers, encoders, tokens |
| **Idempotence** — `f(f(x)) === f(x)` | normalisers, slugs, sanitisers, migrations |
| **Invariant** — output always satisfies a rule | validators, formatters, id generators |
| **Oracle** — matches a slow, obviously-correct version | optimised implementations |
| **Commutativity** — order does not change the result | merges, set operations |

Round-trip is the highest-value one in a backend: encoders, JWT handling, query-string
builders and money formatting all have an inverse, and the failures are silent.

### Where it fits

For parsers, formatters, encoders, permission logic and money arithmetic — code whose
input space is large and whose failures are quiet. Not for orchestration code, where
"all inputs" is not a meaningful idea.

## Mutation testing

It changes your source — `>=` to `>`, `+` to `-`, a return to `null` — and reruns the
suite. If tests still pass, the mutant **survived**: nothing was checking that line's
behaviour.

```json
// stryker.config.json
{
  "packageManager": "npm",
  "testRunner": "command",
  "commandRunner": {"command": "node --test test/*.test.mjs"},
  "mutate": ["src/*.mjs"],
  "coverageAnalysis": "off",
  "concurrency": 2
}
```

Note the glob. `node --test test/` **fails** — a directory positional is resolved as a
module ([page 01](./01-node-test-runner.md)) — and Stryker reports it as
`There were failed tests in the initial test run`, which does not point at the cause.

### What it found

The same `discount()` from [page 11](./11-coverage.md), whose suite has **100% line
coverage**:

```console
Instrumented 1 source file(s) with 15 mutant(s)

[Survived] ConditionalExpression   src/discount.mjs:3:33
-  return total >= 10 ? total - 10 : total;
+  return true ? total - 10 : total;

[Survived] EqualityOperator        src/discount.mjs:3:33
-  return total >= 10 ? total - 10 : total;
+  return total > 10 ? total - 10 : total;

File          | % Mutation score | # killed | # survived |
discount.mjs  |      86.67       |    13    |     2      |
```

Both survivors are the `>= 10` boundary. **No test uses `total = 10` or below**, so the
comparison could be anything. Coverage said 100%; the mutation score says 86.67% and
points at the exact line and the exact missing case.

The fix is one test:

```js
test('TENOFF does not apply below the minimum', () => {
  assert.equal(discount(9, 'TENOFF'), 9);
  assert.equal(discount(10, 'TENOFF'), 0);
});
```

### Reading the score

Not a target to chase. Read the **surviving mutants**, and for each ask whether killing
it would be a real test. Some survivors are worthless — mutating a log message, or
equivalent mutants where the change genuinely cannot alter behaviour. A score of 100%
is as suspect as 100% coverage.

### Cost

It runs the suite once per mutant. Fifteen mutants over a tiny file took **2 seconds**;
a real module is minutes, a codebase is hours. So:

- Run it on **one module at a time**, chosen because it matters — pricing, permissions,
  tax, retry logic.
- Run it **occasionally**, not per commit. Nightly on a critical directory at most.
- Use `coverageAnalysis: "perTest"` on a large suite to skip tests that cannot reach the
  mutant.

## Which to reach for

| Question | Tool |
|---|---|
| "Are there inputs I did not consider?" | property-based |
| "Do my existing tests check anything?" | mutation |
| "Is this function correct for all valid input?" | property-based |
| "Is 90% coverage meaningful?" | mutation |

They compose well: mutation testing points at an untested boundary, and a property is
often the tightest way to cover it.

## Gotchas

**Symptom:** A property passes and you conclude the code is correct
**Cause:** The generator never produced relevant input. Reproduced — default
`fc.string()` never reached a 12-character cap.
**Fix:** Widen ranges; check the property fails when you deliberately break the code.

**Symptom:** A property fails and the counterexample is unreadable
**Cause:** Not shrunk, or too complex a generator.
**Fix:** fast-check shrinks automatically — the measured case reduced 35 times. Use the
printed seed to reproduce, and narrow the generator.

**Symptom:** `There were failed tests in the initial test run` from Stryker
**Cause:** The configured command fails on its own — for `node --test test/`, because a
directory positional is not searched.
**Fix:** Run the command by hand first; use a glob.

**Symptom:** Mutation testing takes hours
**Cause:** It runs the suite per mutant across the whole codebase.
**Fix:** Scope `mutate` to one directory; `coverageAnalysis: "perTest"`; run nightly.

**Symptom:** Surviving mutants that cannot matter
**Cause:** Equivalent mutants, or mutations of logging.
**Fix:** Exclude those files; judge survivors individually rather than chasing a score.

**Symptom:** A property-based test is intermittently slow
**Cause:** A high run count with expensive generators.
**Fix:** `fc.assert(prop, {numRuns: 100})` and cheaper generators.

## Interview questions

**★ What does property-based testing find that example tests do not?**
Inputs you did not think of. Measured: three example tests passed against a `slugify`
whose 12-character truncation left a trailing dash; the property found it on the sixth
generated case and shrank it 35 times to
`"0 0 00 A AA    0"`.

**★ What is a good property?**
One that holds for all valid inputs: round-trip (`decode(encode(x)) === x`),
idempotence (`f(f(x)) === f(x)`), an invariant on the output, or agreement with a slow
obviously-correct oracle. Round-trip is the highest-value one in a backend.

**★ What does mutation testing measure that coverage cannot?**
Whether tests assert. Measured on a suite with **100% line coverage**: 13 mutants
killed, **2 survived**, both at the `total >= 10` boundary — the line executed but the
comparison was never checked.

**★ Why not run mutation testing in CI on every commit?**
It runs the whole suite once per mutant. Fifteen mutants on a trivial file took 2
seconds; a real codebase is hours. Scope it to a module that matters and run it
occasionally.

**A property passed — does that prove the code is correct?**
No. It proves no generated input violated it. If a property never fails, check the
generator's range and confirm the property fails when you break the code deliberately.

**Should you aim for a 100% mutation score?**
No. Equivalent mutants cannot be killed, and mutations of logging are not worth
killing. Read the survivors and ask whether killing each would be a real test.

---

← Prev: [16 · ESLint, Prettier and Biome](./16-lint-and-format.md) ·
Next → [18 · Load testing](./18-load-testing.md)
