---
title: "Fixtures that cannot lie"
sidebar_label: "01 · Fixtures that cannot lie"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** for `satisfies`, `Partial`
> and `as const`. ⚠️ **`satisfies` in full is
> [phase 2 · 10](../../phase-2-narrowing/10-satisfies/README.md)'s** and the cost of
> an asserted test double is
> [phase 10 · 12 · chunk 02](../../phase-10-strictness/12-assertion-discipline/02-what-an-as-is-standing-in-for.md)'s
> — both are **used here, not re-derived**. No test framework is installed in this
> repository. **No sandbox run, no console block.**

⚠️ **This topic is not [topic 04](../04-testing-types/README.md).** That one tests
*your types*. This one is about **keeping test code honestly typed** — a different
problem with a much higher failure rate.

The intuition everyone has about test code is half right:

> *"Tests are not production code. A fixture does not need production-grade design."*

**True.** And the half that is not true is the expensive one:

> 🔴 **A mistyped fixture makes a test pass for the wrong reason — which is strictly
> worse than a failing test, because a failing test tells you something.**

## 🔴 The specific failure: a double that outlives the contract

[Phase 10 · 12](../../phase-10-strictness/12-assertion-discipline/README.md)
identified the test double as the one honest use of `as`, and costed it. Here is
that cost in full, because it is the thing this topic exists to prevent:

```ts
const user = { id: '1' } as User    // today: User has id and name
```

**Tomorrow `User` gains a required `email`.** Production code fails to compile
everywhere — good. **This line does not.** The assertion says *trust me*, so the
test carries on exercising a `User` that no longer exists.

⚠️ **The test does not fail. It does not warn. It quietly tests an older version of
your contract**, and it will keep doing so for as long as the file survives.

## The fix, and why it is one line of design

**A factory, typed so that overrides are partial and the result is complete:**

```ts
const makeUser = (overrides: Partial<User> = {}): User => ({
  id: '1',
  name: 'Ada',
  ...overrides,
})

makeUser()                       // a real User
makeUser({ name: 'Grace' })      // still a real User
```

🔴 **What this buys is not tidiness — it is that the breakage is concentrated into
one compile error.** When `User` gains a required field, **the factory stops
compiling and nothing else does.** One place to fix, and it is the place that knows
what a valid `User` looks like.

📌 **Compare the asserted-literal version: zero compile errors and an unknown number
of tests now asserting against a stale shape.** The factory converts a silent,
distributed problem into a loud, local one, which is the same trade every good
boundary makes.

⚠️ **Do not annotate the overrides parameter as `User`** — then callers must supply
everything and the factory is pointless. `Partial<User>` is doing real work in that
signature.

## `satisfies` for fixture data

For table-driven tests, the pattern that keeps both properties you want:

```ts
const cases = [
  { name: 'empty',   input: '',    expected: 0 },
  { name: 'oneItem', input: 'a',   expected: 1 },
] as const satisfies ReadonlyArray<Case>
```

- **`satisfies Case`** checks each row against the shape — 🔴 including catching a
  **typo in a key**, which an unannotated array silently accepts as a new property.
- **`as const`** keeps the literal types, so `cases[number]['name']` is
  `'empty' | 'oneItem'` rather than `string`.

🔴 **An annotation would have given you the check and destroyed the literals**;
`satisfies` gives you both, which is exactly the argument
[phase 10 · 09](../../phase-10-strictness/09-excess-property-checks/README.md) makes
about freshness. 📌 **In a test table the literals are worth more than usual**,
because they are what lets an exhaustiveness check catch a case you forgot to
handle.

## `Partial<T>` is fine until the code dereferences

**Typing a fixture `Partial<User>` is honest when the code under test genuinely only
reads some fields.** ⚠️ **It stops being honest the moment the code reads a field
your fixture omitted** — then you have moved the lie from the type to the data, and
the failure is a runtime `undefined` inside the test rather than a compile error.

📌 **The tell: a test that fails with `Cannot read properties of undefined` rather
than an assertion mismatch.** That is not a bug in the code under test; it is a
fixture that promised less than the code needs.

## When `as` is still the answer

**A large third-party interface you use three methods of** — mocking a database
client, a cloud SDK, a framework request object. Building a complete one is
genuinely not worth it.

**Then do it deliberately:**

- 🔴 **Put the assertion in one shared helper, not in every test.** Same reasoning as
  the factory: one place to update, one place to review.
- **Type the helper's return as the real interface** so call sites are checked even
  though its construction was not.
- ⚠️ **Write down what it is standing in for** — the review question from
  [phase 10 · 12 · chunk 02](../../phase-10-strictness/12-assertion-discipline/02-what-an-as-is-standing-in-for.md)
  applies here as much as anywhere.

## Gotchas

**Symptom:** a required field was added to a type and no test failed.
**Cause:** the fixtures are asserted literals, so they were never checked against
the type.
**Fix:** 🔴 a factory. The point is not style — it is that the breakage arrives as
**one** compile error instead of none.

**Symptom:** a test fails with `Cannot read properties of undefined`.
**Cause:** a `Partial<T>` fixture omitted a field the code actually reads.
**Fix:** supply it, or use the factory so completeness is the default. ⚠️ Read this
error as a fixture problem, not a code problem.

**Symptom:** a typo'd key in a test table is silently ignored.
**Cause:** the array has no contextual type, so the extra property is just a
property.
**Fix:** `satisfies`. 📌 This is excess property checking doing its job, and it only
runs when there is something to check against.

**Symptom:** annotating the test table fixed the typo problem and broke an
exhaustiveness check.
**Cause:** the annotation widened the literals to `string`.
**Fix:** `as const satisfies` — check without widening. **That combination is the
whole reason `satisfies` exists.**

**Symptom:** every test file has its own `as SomeClient` mock.
**Cause:** the assertion was written where it was needed rather than once.
**Fix:** one shared helper returning the real interface type. ⚠️ Distributed
assertions are distributed decisions, and no one reviews twenty of them.

**Symptom:** the fixture factory is annotated to require every field.
**Cause:** `overrides: User` instead of `Partial<User>`.
**Fix:** the whole value of the pattern is in that one word.

**Symptom:** the team argues typing the fixtures is over-engineering.
**Cause:** it is being compared to production design work.
**Fix:** 📌 the rule is narrower than that: **the fixture must be a real value of
the real type.** That is one factory function, not architecture — and the payoff is
that a contract change cannot pass silently.

## Interview questions

**Why does a mistyped fixture matter more than untidy test code?**
Because it makes a test pass for the wrong reason, and a passing test reports
nothing. An asserted literal fixture stops matching its type the moment the type
gains a required field — production code fails everywhere, the fixture does not, and
the test carries on exercising a contract that no longer exists.

**What does a fixture factory actually buy?**
Concentration. When the type gains a required field the factory stops compiling and
nothing else does — one error, in the place that knows what a valid value looks
like. The asserted-literal alternative produces zero errors and an unknown number of
tests asserting against a stale shape.

**Why `as const satisfies` for a test table?**
Because you want both properties and each alone gives you one. `satisfies` checks
every row against the shape — catching a typo'd key that an unannotated array would
accept as a new property — and `as const` keeps the literal types, so the case names
stay a union rather than widening to `string`, which is what lets an exhaustiveness
check work.

**When is `Partial<T>` the right fixture type?**
When the code under test genuinely only reads some fields. It stops being honest as
soon as the code reads one you omitted, and then the failure is a runtime
`Cannot read properties of undefined` inside the test rather than a compile error —
which is a fixture problem being reported as though it were a code problem.

**Is `as` ever right in a test?**
Yes — a large third-party interface you use three methods of. Do it once in a shared
helper whose return type is the real interface, so the call sites are still checked
even though the construction was not, and write down what it stands in for. The cost
is that the double claims a contract it does not honour, so it keeps passing when
the real interface grows.

**Is this not over-engineering test code?**
The rule is narrower than it sounds: the fixture must be a real value of the real
type. That is one factory function, not architecture, and it is the difference
between a contract change being caught at compile time and being silently absorbed
by tests that keep passing.

---

[Topic index](./README.md) · Next → **02 · Mocks, spies, and the test directory's type budget** *(not written yet)*
