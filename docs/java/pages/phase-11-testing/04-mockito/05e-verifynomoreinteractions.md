---
title: "verifyNoMoreInteractions is the one Mockito API whose own javadoc names the habit of using it and tells you to stop, because it asserts about every call the mock ever received including the ones your @BeforeEach made — and verifyNoInteractions, one word shorter, means something completely different and useful"
sidebar_label: "05e · verifyNoMoreInteractions"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> sections 7, 8 and 25 of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> and the method javadocs of `verifyNoMoreInteractions(Object...)`,
> `verifyNoInteractions(Object...)`, `never()` and `ignoreStubs(Object...)`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[05d · Verifying too much](05d-verifying-too-much.md) argued for fewer verifications. This
chunk is about the one call that makes a test assert on *all* of them at once —
`verifyNoMoreInteractions` — plus the two things people reach for when it becomes painful:
`ignoreStubs`, which is a warning sign, and `verifyNoInteractions`, which is a different and much
better assertion that is one word away in the autocomplete list.**

## `verifyNoInteractions` is not `verifyNoMoreInteractions`

They are not the same and the names are close enough to swap by accident.

```java
verifyNoInteractions(mockOne, mockTwo);        // nothing at all happened on these mocks
```

```java
//interactions
mock.doSomething();
mock.doSomethingUnexpected();

//verification
verify(mock).doSomething();

//following will fail because 'doSomethingUnexpected()' is unexpected
verifyNoMoreInteractions(mock);                // nothing happened BEYOND what you verified
```

- **`verifyNoInteractions(mocks…)`** (since 3.0.1) — the mock was never touched. This is a
  strong, clean claim and often exactly right: "the failure path must not call the gateway".
- **`verifyNoMoreInteractions(mocks…)`** — every recorded invocation must already have been
  verified. This is the over-specification engine.

Both carry the same warning about scope:

> *"This method will also detect unverified invocations that occurred before the test method, for
> example: in `setUp()`, `@Before` method or in constructor. Consider writing nice code that makes
> interactions only in test methods."*

That is a real trap. A `@BeforeEach` that primes a mock by calling it — not stubbing it, calling
it — makes `verifyNoMoreInteractions` fail in every test in the class, from a line that does not
mention the fixture.

Mockito's own verdict on `verifyNoMoreInteractions`, repeated in two places:

> *"Some users who did a lot of classic, expect-run-verify mocking tend to use
> `verifyNoMoreInteractions()` very often, even in every test method.
> `verifyNoMoreInteractions()` is not recommended to use in every test method.
> `verifyNoMoreInteractions()` is a handy assertion from the interaction testing toolkit. Use it
> only when it's relevant. Abusing it leads to **over-specified**, **less maintainable** tests."*

and the alternatives it names:

> *"If you want stubbed invocations automatically verified, check out `Strictness#STRICT_STUBS`
> feature introduced in Mockito 2.3.0. If you want to ignore stubs for verification, see
> `ignoreStubs(Object...)`."*
>
> *"See also `Mockito#never()` - it is more explicit and communicates the intent well."*

**`never()` on the specific call you care about beats `verifyNoMoreInteractions` almost every
time.** It says what you mean, it survives an unrelated new collaboration, and it fails with a
message about the call you named.

## `ignoreStubs`

```java
verify(mock).foo();
verify(mockTwo).bar();

//ignores all stubbed methods:
verifyNoMoreInteractions(ignoreStubs(mock, mockTwo));

//creates InOrder that will ignore stubbed
InOrder inOrder = inOrder(ignoreStubs(mock, mockTwo));
inOrder.verify(mock).foo();
inOrder.verify(mockTwo).bar();
inOrder.verifyNoMoreInteractions();
```

> *"Mockito will now allow to ignore stubbing for the sake of verification. Sometimes useful when
> coupled with `verifyNoMoreInteractions()` or verification `inOrder()`. Helps avoiding redundant
> verification of stubbed calls - typically we're not interested in verifying stubs."*
>
> ***Warning**, `ignoreStubs()` might lead to overuse of verifyNoMoreInteractions(ignoreStubs(...));
> Bear in mind that Mockito does not recommend bombarding every test with
> `verifyNoMoreInteractions()`.*

It marks stubbed invocations as verified so they do not trip `verifyNoMoreInteractions`. Useful,
and a sign you are fighting the tool: if you need `ignoreStubs` to make
`verifyNoMoreInteractions` bearable, the honest move is usually to delete the
`verifyNoMoreInteractions`.

## What to use instead, in order of preference

| Instead of | Use | Why |
|---|---|---|
| `verifyNoMoreInteractions(mock)` to catch unused stubs | `STRICT_STUBS` | the javadoc's own first alternative; it reports the stubbing, names it, and costs no line in the test |
| `verifyNoMoreInteractions(mock)` to say "and it must not do X" | `verify(mock, never()).x()` | names the call, so the failure message does too, and survives an unrelated new interaction |
| `verifyNoMoreInteractions(mock)` to say "it must not touch this at all" | `verifyNoInteractions(mock)` | a claim about behaviour rather than about the completeness of your verifications |
| `verifyNoMoreInteractions(ignoreStubs(mock))` | delete the assertion | if it only works with the stubs excluded, it was asserting about stubs |

The javadoc points at the first and second itself:

> *"If you want stubbed invocations automatically verified, check out `Strictness#STRICT_STUBS`
> feature introduced in Mockito 2.3.0."*
>
> *"See also `Mockito#never()` - it is more explicit and communicates the intent well."*

## The one shape where it genuinely helps

A **characterisation test** around code you are about to change. You do not know what the class
does; you want a net that catches any change at all, temporarily, so the refactor's diff is
visible. `verifyNoMoreInteractions` is exactly the right level of paranoia for that, and exactly
the wrong level for a test that will live in the suite afterwards.

Write it, do the refactor, then delete it and replace it with the two or three assertions the
behaviour actually needs. A characterisation test that is never deleted becomes the
over-specified test the javadoc is warning about — it just arrived by a respectable route.

## Gotchas

**★ Confusing `verifyNoInteractions` with `verifyNoMoreInteractions`.**
The first says the mock was never touched. The second says nothing happened beyond what you already
verified. Swapping them turns a precise claim into an over-specified one, or vice versa, and both
compile.

**★ `verifyNoMoreInteractions` failing because of `@BeforeEach`.**
Documented: *"This method will also detect unverified invocations that occurred before the test
method, for example: in `setUp()`, `@Before` method or in constructor."* A fixture that *calls* a
mock rather than stubbing it poisons every test in the class.

**★ `verifyNoMoreInteractions` in every test method.**
Mockito names this pattern and rejects it: *"Abusing it leads to over-specified, less maintainable
tests."* Prefer `never()` on the specific call, or `STRICT_STUBS`.

**★ Reaching for `ignoreStubs` to make `verifyNoMoreInteractions` pass.**
The javadoc's own warning: it *"might lead to overuse of verifyNoMoreInteractions(ignoreStubs(...))"*.
If the assertion only works with the stubs excluded, ask whether the assertion is earning its place.

**★ `only()` used as a lighter `verifyNoMoreInteractions`.**
It is not lighter — it is `verify(mock).someMethod()` plus `verifyNoMoreInteractions(mock)` in one
token. Its brevity hides how strong the claim is.

**★ `verifyNoMoreInteractions` on a mock that a `toString()` touched.**
Anything that renders the mock — a logging statement, a debugger's variable view during a
breakpoint, an AssertJ failure message built earlier in the test — invokes `toString()`, which is
a recorded interaction. Mockito special-cases `toString` in its default answer, but the call is
still an invocation on the mock.

**★ Adding `verifyNoMoreInteractions` to catch a bug you already found.**
It will catch that one, and then it will fail every time anyone adds an unrelated collaboration
for the next three years. A `never()` on the specific call catches the same bug and nothing else.

**★ `inOrder.verifyNoMoreInteractions()` used where the static form was meant, or the reverse.**
They ask different questions — "anything after my cursor?" versus "anything unverified at all?" —
and the javadoc's own example has one passing and the other failing on the same mock. See
[05b · InOrder](05b-inorder.md).

## Interview questions

**★ `never()` or `verifyNoMoreInteractions()` — which and why?**
`never()`, almost always. It names the call you care about, so the failure message is specific, and
it keeps working when the code acquires an unrelated new interaction. `verifyNoMoreInteractions`
asserts something about *every* call, so any new collaboration breaks it. Mockito's own javadoc
points at `never()`: *"it is more explicit and communicates the intent well."*

**★ What is the difference between `verifyNoInteractions` and `verifyNoMoreInteractions`?**
`verifyNoInteractions(mock)` asserts the mock was never touched at all. `verifyNoMoreInteractions(mock)`
asserts that everything the mock recorded has already been verified in this test. The first is a
clean statement about behaviour; the second is a statement about the completeness of your own
verifications.

**★ Why would `verifyNoMoreInteractions` fail on a test that looks correct?**
Because it also counts invocations from outside the test method — the javadoc names `setUp()`,
`@Before` and the constructor. A fixture that calls a mock, rather than only stubbing it, leaves an
unverified invocation that every test in the class then trips over.

**★ A colleague adds `verifyNoMoreInteractions` to every test in a class. What do you say?**
That Mockito's own javadoc names this exact habit and rejects it: *"not recommended to use in
every test method … Abusing it leads to over-specified, less maintainable tests."* If the concern
is unused stubbings, `STRICT_STUBS` already reports them; if the concern is a specific call that
must not happen, `never()` says so precisely and keeps working when the class acquires an
unrelated new collaboration.

{/* FOOTER */}

**★ Is there any situation where `verifyNoMoreInteractions` is the right tool?**
A characterisation test around legacy code you are about to refactor, where you deliberately want
to pin the current shape so that any change shows up. It earns its place because it is temporary —
you delete it once the refactor lands and replace it with assertions about the behaviour. Left in
the suite permanently, it becomes exactly the over-specified test the javadoc warns about.

**★ What does `ignoreStubs` do and why is needing it a warning sign?**
It marks stubbed invocations as already verified so they do not trip `verifyNoMoreInteractions` or
an in-order verification. The javadoc supplies its own warning — it *"might lead to overuse of
verifyNoMoreInteractions(ignoreStubs(...))"* — and recommends `STRICT_STUBS` instead. If an
assertion only passes once the stubs are excluded from it, the assertion was making a claim about
stubs rather than about behaviour.

{/* FOOTER */}
