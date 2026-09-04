---
title: "A test that verifies every call is a test that fails on every refactor, and the distinction that saves you is command versus query — verifying a command asserts the observable effect, verifying a query asserts your own implementation back to you"
sidebar_label: "05d · Verifying too much"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> sections 2 and 8 of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> and the method javadocs of `verify`, `never()` and `verifyNoInteractions(Object...)`.
> The command/query separation is Bertrand Meyer's, named here as the origin of the terms rather
> than as a Mockito API reference.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Every verification you write is a line of the implementation copied into the test. One or two
of those are the point of the test. Twelve of them are a second copy of the method body,
maintained by hand, that goes red whenever anyone touches the first copy — without ever catching
a bug. This chunk is the argument for writing fewer verifications, the one rule that tells you
which ones to keep, and the rewrite. `verifyNoMoreInteractions`, the single API that causes most
of this, gets its own chunk: [05e · verifyNoMoreInteractions](05e-verifynomoreinteractions.md).**

## The failure mode, concretely

```java
@Test
void confirming_an_order_charges_and_notifies() {
    when(repository.findById(ORDER_ID)).thenReturn(Optional.of(order));
    when(gateway.charge(order)).thenReturn(APPROVED);

    service.confirm(ORDER_ID);

    verify(repository).findById(ORDER_ID);
    verify(pricing).totalFor(order);
    verify(gateway).charge(order);
    verify(repository).save(order);
    verify(notifier).orderConfirmed(order);
    verify(auditLog).record(any());
    verifyNoMoreInteractions(repository, pricing, gateway, notifier, auditLog);
}
```

Count what this test can catch and what it cannot.

**It cannot catch:** a wrong total, a charge for the wrong amount, an order left in the wrong
state, a notification with the wrong content. Not one assertion looks at a value.

**It will break on:** caching the pricing lookup, moving the audit record into an aspect, reading
the order once instead of twice, adding a metrics counter, reordering two independent calls.
None of those is a behaviour change.

That is the trade a test makes when it verifies everything: **it maximises the number of
implementation changes that turn it red, and minimises the number of behaviour changes it can
detect.** It is the exact inverse of what a test is for.

## 🔴 Command versus query — the rule that decides

Split every call the code under test makes into two kinds.

- A **query** returns something and changes nothing observable: `repository.findById`,
  `pricing.totalFor`, `clock.instant`, `config.maxRetries`. The test can see its effect
  *through the result*.
- A **command** changes something outside the object and returns nothing useful:
  `repository.save`, `notifier.orderConfirmed`, `gateway.charge`, `publisher.publish`. There is
  no result to look at; the call **is** the observable behaviour.

**Verify commands. Stub queries. Never verify a query.**

The reason a query must not be verified is that the assertion is already made elsewhere and more
strongly. If `pricing.totalFor(order)` was not called, the total in the result is wrong, and the
assertion on the total fails — with a message about a number instead of a message about a call.
Verifying it as well adds nothing except a second thing to update when the pricing collaboration
changes.

This is exactly Mockito's own argument for not verifying a stubbed call:

> *"Although it is possible to verify a stubbed invocation, usually **it's just redundant**. If
> your code cares what `get(0)` returns, then something else breaks (often even before `verify()`
> gets executed). If your code doesn't care what `get(0)` returns, then it should not be
> stubbed."*

### The awkward middle: `save`

`repository.save(order)` looks like a command and often is one — but only if nothing else in the
test can observe the persistence. If the test uses an in-memory fake repository, the save is
observable as state (`repository.findById(id)` afterwards) and the verification becomes
unnecessary. That is one of the strongest practical arguments for a fake over a mock:
[12 · Mocks vs fakes](12-mocks-vs-fakes.md).

## The rewrite

```java
@Test
void confirming_an_order_charges_the_total_and_notifies_the_customer() {
    when(repository.findById(ORDER_ID)).thenReturn(Optional.of(order));
    when(pricing.totalFor(order)).thenReturn(Money.of("42.50"));
    when(gateway.charge(any(), any())).thenReturn(APPROVED);

    ConfirmationResult result = service.confirm(ORDER_ID);

    // state: what the caller sees
    assertThat(result.status()).isEqualTo(CONFIRMED);
    assertThat(result.chargedAmount()).isEqualTo(Money.of("42.50"));

    // commands: the two effects outside this object
    verify(gateway).charge(order, Money.of("42.50"));
    verify(notifier).orderConfirmed(assertArg(n ->
        assertThat(n.orderId()).isEqualTo(ORDER_ID)));
}
```

What changed, and what each change bought:

| Removed | Why |
|---|---|
| `verify(repository).findById(...)` | a query — the stub plus the result assertion already prove it |
| `verify(pricing).totalFor(...)` | a query — proven by `chargedAmount` being 42.50 |
| `verify(repository).save(...)` | 🔴 only if persistence is observable another way; otherwise keep it, it is a command |
| `verify(auditLog).record(any())` | `any()` asserted nothing about the record; either assert its content or drop it |
| `verifyNoMoreInteractions(...)` | asserts about calls the test has no opinion on |

| Added | Why |
|---|---|
| `assertThat(result.chargedAmount())` | the actual behaviour, and it can go red for a real reason |
| `charge(order, Money.of("42.50"))` | the amount, not `any()` — this is where a pricing bug surfaces |
| `assertArg` on the notification | asserts content with a real failure message |

The rewritten test is **shorter, catches more bugs, and survives every refactor the first one
broke on.** That combination is the whole argument.

## When more verification *is* right

The argument is against verifying indiscriminately, not against verifying.

- **A security or money invariant.** *"The failure path must not charge the card"* is worth
  `verify(gateway, never()).charge(any(), any())`, and it is worth `verifyNoInteractions(gateway)`
  if nothing on that path should touch it at all. Here the completeness *is* the requirement.
- **A legal or audit requirement.** "Every state change is recorded" is a claim about all calls,
  so asserting on all calls is honest.
- **An adapter whose only job is to translate.** A class whose entire behaviour is "call the
  client with these arguments" has no state to assert on; interaction verification is all there
  is. That is also a hint the class should be thin enough that the test is short.
- **A characterisation test around legacy code you are about to change.** Here you *want* to pin
  the current behaviour including its shape, temporarily, so the refactor's diff is visible.
  Delete it afterwards.

## A reviewer's heuristic

For each `verify` in a test, ask: **if I deleted this line, what bug could now ship?**

- "None — the assertion on the result already covers it" → delete it. It was a query.
- "A customer would not be told their order was confirmed" → keep it. It is a command.
- "I do not know" → it is not carrying its weight; the test does not know what it is claiming.

And for `verifyNoMoreInteractions`: **what behaviour change would this catch that the other
assertions would not?** If the answer is "an extra call to something", ask whether an extra call
is actually a defect. Usually it is a performance question, and a test is the wrong place to
assert it. That argument in full is
[05e · verifyNoMoreInteractions](05e-verifynomoreinteractions.md).

## Gotchas

**★ Verifying a getter on a collaborator.**
A query has a return value; assert on what the code did with it. Verifying `repository.findById`
asserts that your implementation looks things up in a particular way rather than that it produced
the right answer.

**★ Verifying every collaborator call in a service test.**
Each verification is a line of the implementation copied into the test by hand. A dozen of them
is a second copy of the method body that breaks on every refactor and catches no value bug,
because none of them looks at a value.

**★ `verify(auditLog).record(any())`.**
`any()` asserts that *something* was recorded, which is almost never the requirement. Either
assert the content — `assertArg`, or a captor — or accept that the line is decoration and remove
it.

**★ Verifying a query because the stubbing "might not be used".**
That is what `STRICT_STUBS` is for: an unused stubbing fails the test on its own, with a better
message and no extra line in the test. See [07 · Strictness](07-strictness.md).

**★ A test with verifications and no assertions.**
If nothing in the test looks at a returned value or a piece of state, it is testing the shape of
the code. Ask what the caller of this method actually observes, and assert on that first.

## Interview questions

**★ How do you decide which interactions to verify?**
Split the collaborations into queries and commands. A query returns something, so its effect is
already visible in the result — stub it and assert on the outcome; verifying it as well is
redundant and couples the test to the implementation. A command returns nothing useful and its
whole point is the side effect, so the call is the only observable evidence and verifying it is
the assertion.

**★ Why is `verify(repository).findById(id)` usually a bad line?**
Because `findById` is a query. If the code had not called it, the stubbed order would not have
reached the result, and the assertion on the result would already have failed — earlier, and with
a message about a value rather than about a call. The verification adds a second place to update
whenever the lookup changes, and catches nothing the rest of the test misses.

**★ What is the cost of a test that verifies everything?**
It maximises the number of implementation changes that break it and minimises the number of
behaviour changes it can detect. Caching a lookup, moving an audit call into an aspect, or adding
a metrics counter all turn it red without changing what anyone observes — while a wrong total or
a wrong recipient sails through, because no line looks at a value.

**★ When is `verifyNoInteractions` the right assertion?**
When "nothing happened" *is* the requirement — a failure path that must not charge a card, a
guard clause that must not touch the database, a feature flag that must leave the collaborator
alone. It is a claim about behaviour, not about the completeness of your own verifications, which
is what makes it different from `verifyNoMoreInteractions`.


{/* FOOTER */}
