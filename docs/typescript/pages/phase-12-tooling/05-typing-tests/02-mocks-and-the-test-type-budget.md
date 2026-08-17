---
title: "Mocks, spies, and the test directory's type budget"
sidebar_label: "02 · Mocks and the type budget"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** for `Parameters`,
> `ReturnType` and `Awaited`. ⚠️ **No test framework is installed in this
> repository**, so anything about a specific runner's mock API is
> documentation-attributed and deliberately kept general; **the arguments below are
> about the *types*, which are framework-independent.** The assertion-counting
> policy is
> [phase 10 · 12 · chunk 05](../../phase-10-strictness/12-assertion-discipline/05-a-policy-that-works.md)'s.
> **No sandbox run, no console block.**

[Chunk 01](./01-fixtures-that-cannot-lie.md) was about the data. This is about the
doubles — and about whether any of it is enforced at all.

## 🔴 An untyped mock makes your assertions meaningless

The failure is quieter than the fixture one and has the same shape:

```ts
const send = someMockFn()                       // typed loosely
send('hello', 42)
expect(send).toHaveBeenCalledWith('hello', 42)  // ✅ passes
```

**Now the real `send` takes `(to: string, body: string)`.** The test still passes.
It asserts a call **that could never happen**, against a function **that does not
exist in that shape**.

🔴 **A loosely-typed mock does not merely fail to help — it actively certifies a
call signature the codebase does not have.** And because the assertion *passes*,
nothing ever surfaces it.

**The fix is to derive the mock's type from the real thing** rather than restating
it:

```ts
type Send = typeof realSend
const send = someMockFn<Parameters<Send>, ReturnType<Send>>()
```

📌 **The rule is the one this corpus keeps arriving at: derive, do not restate.**
A hand-written mock signature is a second copy of a contract with nothing keeping it
in sync — the same defect as a bare enum literal
([phase 10 · 11 · chunk 09](../../phase-10-strictness/11-typescript-eslint/09-the-five-that-share-a-prefix.md))
and the same fix.

⚠️ **`Parameters<T>` has a known limitation worth remembering here: it sees only the
last overload, and it drops `this`.** For an overloaded function, mock the shape you
are actually exercising and say so — **phase 5 · 10 · Deriving one function's type
from another** *(lane A's topic)* has the full argument.

## Async doubles and the `Awaited` mistake

A mock of an async function must return a promise of the **resolved** type:

```ts
type Fetch = typeof realFetchUser
// the return type is already Promise<User> — do not wrap it again
const fetchUser = someMockFn<Parameters<Fetch>, ReturnType<Fetch>>()
```

⚠️ **The common error is `Promise<ReturnType<Fetch>>`**, which is
`Promise<Promise<User>>` — a type that cannot be produced and whose error message
appears at the *use* site rather than at the mock. 📌 Where you genuinely need the
resolved type, that is `Awaited<ReturnType<Fetch>>`.

## 🔴 None of this matters if the test directory is not checked

Everything above, and everything in [chunk 01](./01-fixtures-that-cannot-lie.md),
assumes the compiler is looking at these files. **Very often it is not** — tests are
excluded from the build `tsconfig` so the published output stays clean, and then
nothing else checks them
([topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md)).

⚠️ **An unchecked test directory hides three things at once:**

1. **The type errors** in the tests themselves.
2. 🔴 **The assertions** — `as any` accumulates fastest in tests, and an unchecked
   directory means it never appears in any count
   ([phase 10 · 12 · chunk 05](../../phase-10-strictness/12-assertion-discipline/05-a-policy-that-works.md)).
3. 🔴 **Your type tests**, if you have any — which
   [topic 04](../04-testing-types/README.md) shows cannot fail when they are not
   checked.

**So the first question about typing tests is not which pattern to use. It is
whether the directory is in the program at all** — and `--explainFiles` answers it
in one command.

## The budget, stated honestly

**Tests get a different allowance from production code, and that is correct** — but
it should be a stated allowance rather than an unexamined one:

| | Position |
|---|---|
| **Checked by the gate** | 🔴 **yes** — in their own config if the build config must stay clean |
| **Fixtures** | real values of real types ([chunk 01](./01-fixtures-that-cannot-lie.md)) |
| **Mock signatures** | derived from the real function, not restated |
| **`as` on a large third-party interface** | ✅ allowed, once, in a shared helper |
| **`as any` scattered per test** | ⛔ the thing this topic exists to prevent |

📌 **And when you count assertions, count the test directory separately rather than
exempting it.** ⚠️ [Phase 10 · 12 · chunk 05](../../phase-10-strictness/12-assertion-discipline/05-a-policy-that-works.md)
warns against spending review effort arguing about test assertions — **that stands.
Counting is not arguing.** A separate number tells you whether the allowance is
being used as intended, without turning every test review into a debate.

## Gotchas

**Symptom:** a `toHaveBeenCalledWith` assertion passes for a call the real function
could never receive.
**Cause:** the mock is loosely typed, so any argument list satisfies it.
**Fix:** 🔴 derive the mock's type from the real function. An untyped mock does not
just fail to help — it certifies a signature that does not exist.

**Symptom:** the mock's type was updated by hand after the real signature changed.
**Cause:** the signature was restated rather than derived.
**Fix:** `typeof realFn` and `Parameters` / `ReturnType`. ⚠️ Anything hand-copied
will eventually be out of date, and the test will keep passing while it is.

**Symptom:** a mocked async function produces confusing errors at every call site.
**Cause:** `Promise<ReturnType<F>>` where the return type was already a promise.
**Fix:** use `ReturnType<F>` directly, or `Awaited<ReturnType<F>>` for the resolved
type. 📌 The error appearing at the use site rather than the mock is the diagnostic.

**Symptom:** `Parameters<typeof f>` produced the wrong argument types.
**Cause:** `f` is overloaded, and `Parameters` sees only the last overload.
**Fix:** mock the overload you are exercising and say so in a comment. It also drops
`this`, which matters for method doubles.

**Symptom:** the fixtures and mocks are carefully typed and a type change still
slipped through.
**Cause:** the test directory is not in the checked program.
**Fix:** 🔴 check it. **This is the precondition for every other pattern in this
topic**, and `--explainFiles` settles it in one command.

**Symptom:** the `as any` count looks healthy and the codebase feels untyped.
**Cause:** the count excludes tests, where they accumulate fastest.
**Fix:** count the test directory as its own number. ⚠️ Exempting it from the count
is different from exempting it from review, and only the second is defensible.

**Symptom:** typing the mocks is resisted as ceremony.
**Cause:** the benefit is invisible while everything is in sync.
**Fix:** the concrete version: an untyped mock lets an assertion pass for a call
shape that cannot occur. That is not ceremony being skipped — it is a test that is
not testing.

## Interview questions

**What is wrong with a loosely-typed mock?**
It certifies a call signature the codebase does not have. `toHaveBeenCalledWith`
against an untyped mock accepts any argument list, so when the real function's
signature changes the assertion keeps passing while describing a call that could
never happen. The test is not merely weaker — it is actively wrong and silent.

**How should a mock be typed?**
Derived from the real function — `typeof realFn` with `Parameters` and `ReturnType`
— rather than restated by hand, because a hand-copied signature is a second copy of
a contract with nothing keeping it in sync. The caveats are that `Parameters` sees
only the last overload and drops `this`.

**What goes wrong when mocking an async function?**
Writing `Promise<ReturnType<F>>` when the return type is already `Promise<User>`,
which produces `Promise<Promise<User>>` — a type nothing can satisfy, whose errors
appear at the call sites rather than at the mock. `Awaited<ReturnType<F>>` is the
resolved type if that is what you meant.

**What is the precondition for any of this to matter?**
That the test directory is in the checked program. Tests are routinely excluded from
the build config, and an unchecked directory hides three things at once: the type
errors in the tests, the `as any` population that accumulates there fastest, and any
type tests you wrote — which cannot fail when they are not checked.

**Should test assertions count toward an assertion metric?**
Yes, as their own number. Tests legitimately get a different allowance, but an
allowance should be stated and measured rather than assumed — and counting is not
the same as arguing about them in review, which is the thing worth avoiding.

**Is typing test doubles worth the effort?**
The concrete answer rather than the principled one: an untyped mock lets an
assertion pass for a call shape that cannot occur. That is a test which reports
success while testing nothing, which is the most expensive kind to own — and the fix
is deriving one type instead of writing one.

---

← [01 · Fixtures that cannot lie](./01-fixtures-that-cannot-lie.md) · [Topic index](./README.md) · [Phase 12 index](../README.md)
