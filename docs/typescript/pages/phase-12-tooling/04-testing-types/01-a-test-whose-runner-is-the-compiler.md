---
title: "A test whose runner is the compiler"
sidebar_label: "01 · The compiler is the runner"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **Vitest's** *Testing Types* documentation for
> `expectTypeOf` and `assertType`, the **`tsd`** documentation, and the
> **TypeScript handbook** for `@ts-expect-error`. ⚠️ **Neither Vitest nor `tsd` is
> installed in this repository**, so every tool claim is documentation-attributed
> and **there is no console block**. The `@ts-expect-error` mechanics and `TS2578`
> are [phase 10 · 08](../../phase-10-strictness/08-suppression-directives/README.md)'s
> and are linked rather than restated. **No sandbox run.**

A type test asserts something about **what the compiler concludes**, not about what
the program computes. That makes it a genuinely different kind of test, and two
consequences follow immediately:

> 🔴 **Its runner is `tsc`, not the test runner.** A type test does not need to
> execute — it passes or fails when the file is *checked*. So a type-testing
> library's `expectTypeOf` call typically does nothing at runtime; the assertion
> already happened.

## 🔴 Which means: a type test outside the program is not a test

The consequence people get bitten by, and it follows straight from
[topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md):

**If the file is not in the checked program, nothing evaluates the assertions.** No
error is reported, nothing fails, and the suite reports success — because a type
test that is never checked has no way to fail.

⚠️ **And the most common config in the world puts them there**: tests excluded from
the build `tsconfig` so the published output stays clean. **That is exactly the
directory type tests live in.**

📌 **So the first thing to verify about a type-test suite is not that it passes —
it is that it is being checked**, with `--explainFiles`
([topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md)).
🔴 **The check is: break one on purpose and confirm the type-check step goes red.**
Same discipline as testing the gate itself, and for the same reason.

## The two directions, and only one of them is load-bearing

| Assertion | Spelling | Value |
|---|---|---|
| *"this has this type"* | `expectTypeOf<X>().toEqualTypeOf<Y>()`, `assertType<T>(v)` | ⚪ **often redundant** |
| 🔴 *"this must NOT compile"* | **`@ts-expect-error`** above the bad call | 🔴 **irreplaceable** |

**Why the positive direction is usually redundant:** if a function's return type were
wrong, the real call sites would already fail to compile. Your application *is* a
type test for the types it uses. Asserting it separately re-states what the rest of
the codebase already enforces.

🔴 **Why the negative direction is not:** nothing anywhere checks that wrong usage is
*rejected*. A signature that quietly widens — a parameter that becomes `any`, a
generic constraint that is dropped, an overload that starts accepting `undefined` —
**breaks nothing.** Every existing call still compiles. The library gets less safe
and every test stays green.

> **That is the gap type testing exists to close, and `@ts-expect-error` is the tool
> that closes it.**

## `@ts-expect-error` as an assertion

Put it above a call that *should* be an error:

```ts
// @ts-expect-error – id must be a string
findUser(42)
```

**If the call ever starts compiling, the directive becomes unused and the compiler
reports `TS2578`** — so the test fails at exactly the moment the guarantee is lost.

🔴 **This is [phase 10 · 08](../../phase-10-strictness/08-suppression-directives/README.md)'s
finding put to work:** `TS2578` is the only diagnostic in TypeScript that reports a
problem which has *stopped* existing. **The property that makes `@ts-expect-error`
uncomfortable as a suppression — it breaks the build when the error goes away — is
exactly what makes it a test.**

⚠️ **Its weakness carries over too, and it matters more here.** The directive
absorbs *whatever* error is on the next line. So a test asserting "this is rejected
because the argument is the wrong type" keeps passing if the line starts failing for
an unrelated reason — a renamed function, a missing import. 📌 **The written
description is what makes the mismatch noticeable**, which is the real argument for
the convention, and in a type test it is doing more work than in a suppression.

## Where they earn their place

**Published or widely-consumed APIs**, where you cannot see the call sites, and
**generic helpers whose whole value is inference**. ⚠️ **Not ordinary application
code** — there, the application already exercises the types, and a type test is a
second copy of a check you are getting free.

📌 **A useful trigger: write a type test the first time a type bug reaches a
consumer.** That is evidence the internal call sites do not cover the surface, which
is the precondition for these tests being worth their cost.

## Gotchas

**Symptom:** the type-test suite has never failed.
**Cause:** possibly correctness; more often the files are not in the checked
program.
**Fix:** 🔴 break one deliberately and confirm the check goes red. ⚠️ Tests are
routinely excluded from the build config, and that is precisely where type tests
live.

**Symptom:** the type tests "run" fast and report nothing.
**Cause:** they do not run at all — the assertions were evaluated at check time, and
the runtime call is inert.
**Fix:** that is normal. **The failure signal is a type error, so look at the
type-check step, not at the test output.**

**Symptom:** a `@ts-expect-error` test keeps passing after the bug it guarded
against was reintroduced.
**Cause:** the line is failing for a different reason now — a rename, a missing
import — and the directive absorbed that instead.
**Fix:** ⚠️ the written description is the only defence. Read it against the actual
error when a nearby refactor lands.

**Symptom:** a library's types regressed to `any` and every test still passed.
**Cause:** nothing tests that wrong usage is rejected — every existing call still
compiles, because `any` accepts them.
**Fix:** 🔴 negative tests. This is the exact failure the positive direction cannot
see, and it is the reason the topic exists.

**Symptom:** type tests were written for every exported function and they feel like
busywork.
**Cause:** the positive direction was applied to code the application already
exercises.
**Fix:** keep them for the published surface and for generic helpers; drop the rest.
📌 Your application is already a type test for the types it consumes.

**Symptom:** a `@ts-expect-error` was added to make a type test file compile.
**Cause:** it is being used as a suppression inside a suite where it is supposed to
be an assertion.
**Fix:** ⚠️ in a type-test file the directive has a *meaning*. Using it to silence
an unrelated problem makes every other one in the file harder to trust.

## Interview questions

**What runs a type test?**
The compiler. The assertions are evaluated when the file is type-checked, not when
the test executes — so a type-testing helper typically does nothing at runtime, and
the failure signal is a type error rather than a failed assertion in the runner's
output.

**What is the trap that follows from that?**
A type test outside the checked program cannot fail. If the file is excluded from the
`tsconfig` the gate uses — which is exactly what happens when tests are excluded to
keep the build output clean — the assertions are never evaluated and the suite
reports success. The first thing to verify is that the files are checked, by breaking
one on purpose.

**Which is more valuable: asserting a type is correct, or asserting a call is
rejected?**
Rejection, by a wide margin. If a return type were wrong, the real call sites would
already fail to compile — the application is a type test for the types it uses. But
nothing checks that wrong usage is *refused*, so a signature that quietly widens
breaks nothing: every existing call still compiles and every test stays green.

**How does `@ts-expect-error` work as an assertion?**
You put it above a call that should be an error. If the call ever starts compiling,
the directive is unused and the compiler reports `TS2578` — so the test fails exactly
when the guarantee is lost. It is the only diagnostic that reports a problem which has
stopped existing, and the property that makes it awkward as a suppression is what
makes it a test.

**What is its weakness in this role?**
It absorbs whatever error is on the next line, so a test asserting rejection for one
reason keeps passing when the line starts failing for another — a rename, a missing
import. The written description is the only thing that makes the mismatch noticeable,
which is why the convention matters more in a type test than in a suppression.

**When are type tests not worth writing?**
For ordinary application code, where the application itself exercises the types and a
type test is a second copy of a check you already get. They earn their place on
published or widely-consumed APIs, where you cannot see the call sites, and on generic
helpers whose value is inference — and a good trigger is the first time a type bug
reaches a consumer.

---

[Topic index](./README.md) · Next → [02 · Exactness, `any`, and choosing a tool](./02-exactness-any-and-choosing-a-tool.md)
