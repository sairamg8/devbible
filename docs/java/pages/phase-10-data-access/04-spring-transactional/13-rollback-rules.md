---
title: "An unchecked exception rolls the transaction back and a checked exception commits it — Spring's default is the opposite of what almost everyone assumes"
sidebar_label: "13 · Rollback rules"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Transaction Management → Rolling back a declarative transaction*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)),
> *Using `@Transactional`*
> ([.../declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and the `@Transactional` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**Spring does not roll back because your method failed. It rolls back because the
exception that escaped your method matched a *rollback rule* — and the default
rule matches only `RuntimeException` and `Error`. A checked exception leaves the
method, the interceptor looks at it, decides it is not a rollback trigger, and
commits everything you wrote before the failure.**

## The two-line difference that changes the outcome

Here is a service method that fails halfway. Read it and decide what is in the
database afterwards.

```java
@Transactional
public void placeOrder(NewOrder cmd) throws InsufficientStockException {
    Order order = orderRepository.save(Order.from(cmd));   // row written
    inventory.reserve(cmd.sku(), cmd.quantity());          // throws
    payments.charge(order);                                // never runs
}
```

```java
public class InsufficientStockException extends Exception {
    public InsufficientStockException(String sku) { super(sku); }
}
```

The order row is **committed**. There is no payment, no reservation, and a row in
`orders` that no other part of the system will ever finish. The method threw; the
transaction committed anyway.

Now change one word:

```java
public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(String sku) { super(sku); }
}
```

Nothing else in the application changes — same annotation, same call site, same
transaction manager, same database. Now the order row is rolled back. The
difference between a correct system and a corrupt one was `extends Exception`
versus `extends RuntimeException`.

## What the reference actually says

This is not folklore. It is written down, three times, in plain words.

From *Rolling back a declarative transaction*:

> In its default configuration, the Spring Framework's transaction infrastructure
> code marks a transaction for rollback only in the case of runtime, unchecked
> exceptions… (`Error` instances also, by default, result in a rollback.)

and, in the same section:

> Checked exceptions that are thrown from a transactional method do not result in
> a rollback in the default configuration.

From *Using `@Transactional`*, listing the defaults that apply when you write a
bare `@Transactional`:

> Any `RuntimeException` or `Error` triggers rollback, and any checked `Exception`
> does not.

The `@Transactional` javadoc says the same thing from the other end, while
describing what `rollbackFor` is for:

> By default, a transaction will be rolled back on `RuntimeException` and `Error`
> but not on checked exceptions (business exceptions).

Note the parenthetical: **business exceptions**. That is the whole justification,
and it is worth understanding rather than just memorising.

## Where the rule comes from, and why it is not stupid

The convention is inherited from EJB, and in EJB it had a coherent meaning. A
checked exception is one the compiler forces the caller to acknowledge. The
argument goes: if the caller is *required* to handle it, then it is not a crash —
it is a documented outcome of the operation, one of the answers the method is
allowed to give. And an operation that returns one of its documented answers
should be allowed to keep whatever it wrote.

An unchecked exception, by contrast, is something nobody planned for. Nothing in
the signature warned the caller. The safe assumption is that the object is in an
unknown state, and the safe response is to undo everything.

That reasoning holds up for a design where checked exceptions really are
alternative return values — `AccountClosedException` meaning "no, and here is
why", with a caller that catches it and shows a message.

It falls apart the moment a checked exception is used the way most Java code
actually uses one: as a plumbing failure that was too awkward to wrap.
`IOException` from a file read, `SQLException` from a driver call,
`GeneralSecurityException` from a signature check, `TimeoutException` from a
`Future`, and every checked exception a generated client throws at you. None of
those is a business answer. All of them commit by default.

## Two things this page is not about

The rule is evaluated on **the exception that escapes the transactional method**.
Two consequences that get confused with it, each covered elsewhere:

- If you **catch** the exception inside the method, no exception escapes, so no
  rule is consulted and the transaction commits regardless of type. That is
  [14 · The caught exception](14-the-caught-exception.md).
- If your method was *participating* in a caller's transaction rather than
  starting its own, "roll back" means setting a flag on the shared physical
  transaction — see **[09 · Marked rollback-only](09-marked-rollback-only.md)**.

How to change the rule is [13b · Changing the rule](13b-changing-the-rule.md);
how a configured rule is *matched* against a thrown exception, which has a real
footgun in it, is [13c · How a rule is matched](13c-how-a-rule-is-matched.md).

## The trade-off

Leaving the default in place buys you EJB semantics: a method can fail with a
documented business outcome *and* keep the work it did. If your domain genuinely
wants that — "record the rejected attempt, then throw" — the default is doing
something useful for free.

What it costs is that the rule cannot tell your deliberate business exceptions
apart from the accidental ones. It keys on `extends Exception`, which is a
statement about the type hierarchy, not about intent. The first time someone adds
a call to a library that throws `IOException`, that method quietly starts
committing half-finished work, with nothing in the code or the logs to say so.

## Gotchas

**⚠️ A checked exception commits a half-written aggregate**
**Symptom:** a parent row exists with no children, or an order with no payment,
and the logs clearly show the operation failed.
**Cause:** the checked exception matched no rollback rule, so the interceptor
committed on the way out.
**Fix:** add a rule (13b). Confirm the diagnosis by reading the exception's
supertype, not by reading the log — the log looks identical either way.

**⚠️ `Error` rolls back, and people forget it is in the rule**
**Symptom:** an `OutOfMemoryError` or `StackOverflowError` produces a rolled-back
transaction rather than partial data, which is correct but surprises anyone who
learned the rule as "only `RuntimeException`".
**Cause:** the default rule is `RuntimeException` **or** `Error`, and `Error` is
not a subclass of `Exception`.
**Fix:** none needed — but do not describe the rule as "unchecked exceptions"
without saying `Error` out loud. The half of the rule people drop is the half
that catches `OutOfMemoryError`, and dropping it in conversation is where the
widespread belief comes from that `rollbackFor = RuntimeException.class` narrows
the default. It does not — [13d](13d-the-matching-algorithm.md) shows why — but
the belief is common enough that the words are worth getting right.

**⚠️ Wrapping a checked exception in an unchecked one — but *after* the boundary**
**Symptom:** the service throws a `RuntimeException`, the caller sees it, and the
data still committed.
**Cause:** the wrapping happened in the controller or an `@ControllerAdvice`,
which is outside the transactional method. The interceptor had already seen the
checked exception and already committed.
**Fix:** wrap **inside** the transactional method. What matters is the type of
the exception at the instant it crosses the proxy, not what it becomes later.

**⚠️ Assuming the rule cares where the exception was thrown**
**Symptom:** "but the exception came from the repository, not from my method".
**Cause:** it does not matter. The rule is evaluated on the exception that
escapes the transactional method, regardless of origin or how many frames it
passed through on the way out.
**Fix:** trace outward to the boundary and ask what type arrives there.

**⚠️ A checked exception thrown out of a lifecycle callback or a plain listener**
**Symptom:** rollback rules appear not to apply at all, in either direction.
**Cause:** those calls frequently never went through the proxy, so there is no
interceptor, no transaction and no rule — see **[05 · Annotations that do nothing](05-annotations-that-do-nothing.md)**.
**Fix:** establish that a transaction exists *before* debugging which rule
matched. "The annotation never ran" and "the annotation ran and chose to commit"
look identical from the database's side.

**⚠️ A repository call outside any service transaction uses the repository's rules**
**Symptom:** you reason about your service's rollback behaviour and the observed
behaviour comes from somewhere else.
**Cause:** Spring Data's `SimpleJpaRepository` carries its own `@Transactional`
declarations. When a repository method joins your transaction, your outer
boundary decides the outcome; when it is called with no surrounding transaction,
it *is* the boundary and its own attributes decide.
**Fix:** put the boundary in your service so the rule that decides is one you
wrote. A repository call should not be a transaction boundary you are reasoning
about.

**⚠️ `throws Exception` on a helper widens the hole silently**
**Symptom:** a method that used to roll back reliably starts committing on
failure after an unrelated refactor.
**Cause:** somebody declared a broad `throws Exception`, and a checked exception
now propagates out of the transactional method where previously it was wrapped.
**Fix:** this is the strongest practical argument for the global switch in 13b.
The default rule is sensitive to a change in a `throws` clause three call frames
away, which is not a property you want correctness to depend on.

## Interview questions

**★ What does Spring roll back on by default, and why that rule?**
`RuntimeException` and `Error` roll the transaction back; any checked `Exception`
does not — the transaction commits. The rule is inherited from EJB, where a
checked exception was understood as a *business exception*: a documented,
compiler-enforced outcome the caller must acknowledge, and therefore not a reason
to discard work already done. An unchecked exception is an unplanned failure, so
the safe response is to undo everything. The convention is coherent for
domain-modelled checked exceptions and actively harmful for the far more common
case where a checked exception is just plumbing — `IOException`, `SQLException`,
a generated client's checked type. Those commit by default.

**★ Does throwing an exception roll the transaction back, or mark it for
rollback? Does the distinction matter?**
It marks it, and the distinction matters a great deal. The interceptor catches
the exception, consults the rules, and if one matches it rolls back the
transaction it started — *if* it started one. If the method was participating in
a caller's transaction, there is no separate transaction to roll back; the inner
boundary sets the rollback-only flag on the shared physical transaction and
rethrows, and the outer boundary performs the actual rollback. That is why an
exception the caller catches and swallows can still doom the whole operation, and
why the caller can end up with `UnexpectedRollbackException` at commit time.

**★ Your team says "we throw checked exceptions for expected failures and
unchecked for bugs; the Spring default fits us perfectly." Do you agree?**
It fits *if* the checked exceptions are genuinely commit-worthy — if, when
`AccountClosedException` is thrown, you actually want the audit row written just
before it to survive. That is a real design and the default serves it. The
problem is that the rule cannot distinguish deliberate business exceptions from
accidental ones. The first time somebody calls a client that throws
`IOException`, or declares `throws Exception` on a helper, that method silently
commits partial work with no diagnostic anywhere. The robust arrangement is to
invert it: switch the global default to roll back on everything and mark the
handful of genuine business exceptions explicitly. Then the deliberate cases are
visible in the code and the accidental ones are safe, rather than the reverse.

**★ Where would you look first if a failed operation left committed data?**
At the type of the exception that crossed the transactional boundary, and at
whether anything caught it before it got there. Those two account for most such
incidents: a checked exception that matched no rule, or a `try`/`catch` inside
the method that meant nothing ever reached the interceptor. Only after ruling
both out would I ask whether there was a transaction at all — self-invocation, an
unproxied bean, a call from a thread the transaction is not bound to — because
"no transaction" and "a transaction that chose to commit" produce identical
evidence in the database.

**★ Is `@Transactional(rollbackFor = RuntimeException.class)` equivalent to the
default?**
In behaviour, yes — and the popular answer, "no, it is narrower because it drops
`Error`", is wrong. It is worth being able to say why, because the reasoning
behind the wrong answer is half right. The default really is `RuntimeException`
**or** `Error`, and a rule naming only `RuntimeException` really does not match an
`Error`. What the wrong answer misses is what Spring does when *no* rule matches:
`RuleBasedTransactionAttribute.rollbackOn` falls through to
`DefaultTransactionAttribute.rollbackOn`, which is exactly
`ex instanceof RuntimeException || ex instanceof Error`. So the `Error` is not
covered by your rule, finds no other rule either, and is rolled back by the
default anyway. Explicit rules **add to** the default rather than replacing it —
the mechanism is in [13d](13d-the-matching-algorithm.md), and it also settles the
more useful version of this question, which is whether
`rollbackFor = SomeCheckedException.class` stops runtime exceptions rolling back.
It does not. What `rollbackFor = RuntimeException.class` actually costs is
clarity: it looks like it means something, so the next reader assumes it does.

**★ How would you prove, in a code review, that a service method rolls back
correctly?**
By checking three things, in this order. First, that the exception thrown on the
failure path is unchecked or is named in a rollback rule. Second, that nothing
between the throw site and the boundary catches it — a `try`/`catch` in the
middle of the method is the most common cause of a silently committing method.
Third, that the method is actually a boundary: called from outside the bean,
non-private, non-final, on a proxied Spring bean. A test proves it better than a
review, but it has to be a test that goes through the container and reads the
database after the transaction closed, not one that asserts on the exception.

---

← Prev: [12c · The empty transaction](12c-the-empty-transaction.md) · Index: [Spring @Transactional](README.md) · Next → [13b · Changing the rule](13b-changing-the-rule.md)
