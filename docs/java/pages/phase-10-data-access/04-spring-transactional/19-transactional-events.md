---
title: "@TransactionalEventListener delays a listener until a chosen phase of the transaction — and if there is no transaction it does not run at all"
sidebar_label: "19 · Transactional events"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Transaction Management → Transaction-bound events*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/event.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html))
> and the `TransactionSynchronization` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0.

**A plain `@EventListener` runs the moment the event is published — inside the
transaction, before anyone knows whether it will commit. `@TransactionalEventListener`
holds the call until a phase of the transaction you choose. It is the correct tool
for "do this only if the operation actually succeeded", and it has one behaviour
that catches everybody: with no transaction in progress, the listener is skipped
entirely.**

## The shape

```java
@Service
class OrderService {
    private final ApplicationEventPublisher events;

    @Transactional
    public void place(NewOrder cmd) {
        Order order = orderRepository.save(Order.from(cmd));
        events.publishEvent(new OrderPlaced(order.id()));   // published now
    }                                                       // committed here
}

@Component
class OrderPlacedListener {
    @TransactionalEventListener                              // runs after the commit
    void onOrderPlaced(OrderPlaced event) {
        mailer.sendConfirmation(event.orderId());
    }
}
```

The reference states the default:

> When you do so, the listener is bound to the commit phase of the transaction by
> default.

Publishing is synchronous and happens where you call it. What is deferred is the
*listener*, not the publish.

## The four phases

> The `@TransactionalEventListener` annotation exposes a `phase` attribute that
> lets you customize the phase of the transaction to which the listener should be
> bound. The valid phases are `BEFORE_COMMIT`, `AFTER_COMMIT` (default),
> `AFTER_ROLLBACK`, as well as `AFTER_COMPLETION` which aggregates the transaction
> completion (be it a commit or a rollback).

Underneath, these map onto `TransactionSynchronization` callbacks, and that
javadoc explains what each phase can and cannot do.

**`BEFORE_COMMIT`** — inside the transaction, before it commits. Writes here join
the transaction and are committed with it. And it can still stop the commit:

> Note that exceptions will get propagated to the commit caller and cause a
> rollback of the transaction.

The javadoc is also careful about what the phase means:

> This callback does *not* mean that the transaction will actually be committed. A
> rollback decision can still occur after this method has been called.

**`AFTER_COMMIT`** (the default) — the work is durable, so this is where you tell
the outside world. Confirmation emails, cache invalidation, publishing to a
broker. Exceptions from here are propagated to the caller, but the transaction has
already committed, so the propagation cannot undo anything.

**`AFTER_ROLLBACK`** — the compensating side. Cleaning up a file written outside
the transaction, releasing a reservation held elsewhere.

**`AFTER_COMPLETION`** — either outcome. Useful for recording that the attempt
finished at all. Exceptions here are *not* propagated:

> `RuntimeException` — in case of errors; will be **logged but not propagated**

## The rule that surprises everyone

> If no transaction is running, the listener is not invoked at all, since we
> cannot honor the required semantics. You can, however, override that behavior by
> setting the `fallbackExecution` attribute of the annotation to `true`.

Read it as written: **not deferred, not run immediately — not invoked**. The event
is published, nothing listens, and no warning appears.

Where this bites is tests, and it bites hard. A unit test that calls the service
method without a transaction publishes the event and never runs the listener, so
a test written to prove the listener fires passes for the wrong reason if it
asserts the wrong thing — and fails mysteriously if it asserts the right one. It
also bites in production wherever a publishing method is invoked from a
non-transactional path: a `@PostConstruct`, a health check, an admin endpoint that
skipped the service layer.

`fallbackExecution = true` makes the listener run immediately when there is no
transaction. That is the right setting when the listener's work is genuinely
useful either way, and the wrong one when the whole point was "only if it
committed" — in that case a listener firing without a transaction is worse than
one that does not fire.

## What the listener runs in

Two questions people get wrong: which thread, and which transaction.

**The thread is the same one.** Unless you also add `@Async`, the listener runs
synchronously on the thread that committed the transaction, before that thread
returns from the transactional method. So a slow listener makes the request slow,
and — for `BEFORE_COMMIT` — makes the transaction longer.

**The transaction is subtler, and the javadoc is emphatic about it.** For
`afterCommit`:

> **NOTE:** The transaction will have been committed already, but the
> transactional resources might still be active and accessible. As a consequence,
> any data access code triggered at this point will still "participate" in the
> original transaction, allowing to perform some cleanup (with no commit following
> anymore!), unless it explicitly declares that it needs to run in a separate
> transaction. Hence: **Use `PROPAGATION_REQUIRES_NEW` for any transactional
> operation that is called from here.**

The same note appears verbatim on `afterCompletion`. The parenthetical is the
whole problem: *with no commit following anymore*. A repository call in an
`AFTER_COMMIT` listener will appear to work — it joins the committed transaction's
resources, the statement runs, nothing throws — and then nothing ever commits it.
The write silently vanishes.

So any listener that writes to the database needs its own transaction:

```java
@Component
class ProjectionUpdater {
    @TransactionalEventListener                                   // AFTER_COMMIT
    @Transactional(propagation = Propagation.REQUIRES_NEW)        // its own transaction
    void onOrderPlaced(OrderPlaced event) {
        projectionRepository.save(Projection.of(event));
    }
}
```

Note the consequence: that inner transaction takes a second connection. The
pool-sizing warning that comes with `REQUIRES_NEW` applies here as much as
anywhere — see **[10 · REQUIRES\_NEW](10-requires-new.md)**.

## The 6.1 note, and the reactive asymmetry

> As of 6.1, `@TransactionalEventListener` can work with thread-bound transactions
> managed by `PlatformTransactionManager` as well as reactive transactions managed
> by `ReactiveTransactionManager`. For the former, listeners are guaranteed to see
> the current thread-bound transaction. Since the latter uses the Reactor context
> instead of thread-local variables, the transaction context needs to be included
> in the published event instance as the event source.

That asymmetry is the whole of
[18b · Reactive and virtual threads](18b-reactive-and-virtual-threads.md) in one
paragraph: the imperative side can find the transaction on the thread, and the
reactive side cannot, so the context has to travel with the event itself.

## The trade-off

Transactional events buy you decoupling *and* correct ordering at once: the
service that places an order does not need to know about email, and the email
cannot be sent for an order that was never committed. That is a genuinely good
deal, and it is the standard answer to "how do I do X only if this succeeded".

What it costs is a control flow you cannot see at the call site. `publishEvent`
gives no indication of what will run, when, on which thread, or in which
transaction; the answer is spread across every `@TransactionalEventListener` in
the application. Add the "silently does not run without a transaction" rule and
the "writes silently do not commit without `REQUIRES_NEW`" rule, and you have a
mechanism with two distinct silent failure modes. It is worth it — but it needs to
be used deliberately and documented, not sprinkled.

## Gotchas

**⚠️ The listener does not run, and nothing says why**
**Symptom:** an event that is published and apparently ignored.
**Cause:** there was no transaction in progress — "the listener is not invoked at
all". Common in tests and on any path that bypassed the transactional service.
**Fix:** run the publishing code inside a transaction, or set
`fallbackExecution = true` if running without one is genuinely acceptable.

**⚠️ A write in an `AFTER_COMMIT` listener that never appears**
**Symptom:** the code runs, no exception, no row.
**Cause:** the javadoc's note — data access at this point participates in the
already-committed transaction, "with no commit following anymore!".
**Fix:** `@Transactional(propagation = Propagation.REQUIRES_NEW)` on the listener.
This is the single most common mistake with this feature.

**⚠️ Assuming the listener is asynchronous**
**Symptom:** the request gets slower after adding a listener that calls an
external service.
**Cause:** the listener runs synchronously on the committing thread by default.
**Fix:** add `@Async` if the work should not block the response — accepting that
it then loses the transaction and its exceptions, per
[18 · Threads and `@Async`](18-threads-and-async.md).

**⚠️ Throwing from an `AFTER_COMMIT` listener to "cancel" the operation**
**Symptom:** an exception reaches the caller and the data is still committed.
**Cause:** the commit has already happened. Exceptions from `afterCommit` are
propagated to the caller but there is nothing left to undo.
**Fix:** if the check can fail the operation, it belongs in `BEFORE_COMMIT`, where
"exceptions will get propagated to the commit caller and cause a rollback".

**⚠️ Expecting `BEFORE_COMMIT` to mean the commit is certain**
**Symptom:** side effects performed in `BEFORE_COMMIT` that outlive a rollback.
**Cause:** the javadoc says the callback "does not mean that the transaction will
actually be committed. A rollback decision can still occur after this method has
been called."
**Fix:** `BEFORE_COMMIT` is for work that must be part of the transaction, not for
work that must only happen on success. That is `AFTER_COMMIT`.

**⚠️ Relying on an exception from `AFTER_COMPLETION` being visible**
**Symptom:** a failing cleanup listener that produces nothing but a log line.
**Cause:** exceptions there are "logged but not propagated", unlike the two commit
phases.
**Fix:** if the failure matters, record it explicitly rather than relying on the
exception surfacing.

## Interview questions

**★ What does `@TransactionalEventListener` do that `@EventListener` does not?**
It defers the listener until a chosen phase of the surrounding transaction rather
than running it at publish time. A plain `@EventListener` runs immediately, inside
the transaction, before anything is known about the outcome — so a confirmation
email sent from one goes out even if the transaction later rolls back. The
transactional variant binds to `AFTER_COMMIT` by default, which is the phase where
"only if it actually succeeded" is true.

**★ What are the four phases and when would you use each?**
`BEFORE_COMMIT` runs inside the transaction just before it commits — for work that
must be part of the unit, and it can still veto the commit because exceptions
propagate and cause a rollback. `AFTER_COMMIT`, the default, runs once the work is
durable — external notifications, cache invalidation, publishing. `AFTER_ROLLBACK`
is the compensating side, for undoing things the transaction could not.
`AFTER_COMPLETION` aggregates both outcomes and is for recording that the attempt
finished; note its exceptions are logged rather than propagated.

**★ What happens if the event is published with no transaction in progress?**
The listener is not invoked at all. The reference is explicit: "If no transaction
is running, the listener is not invoked at all, since we cannot honor the required
semantics." Not deferred, not run immediately — skipped, silently. Setting
`fallbackExecution = true` makes it run anyway. This shows up most often in tests
that call the service without a transaction, and the right fix there is usually to
give the test a transaction rather than to set the flag.

**★ Why does a database write inside an `AFTER_COMMIT` listener often disappear?**
Because the transactional resources are still bound even though the transaction
has committed. The `TransactionSynchronization` javadoc warns that "any data
access code triggered at this point will still 'participate' in the original
transaction… (with no commit following anymore!), unless it explicitly declares
that it needs to run in a separate transaction", and it gives the instruction
directly: "Use `PROPAGATION_REQUIRES_NEW` for any transactional operation that is
called from here." Without it, the statement executes, nothing throws, and nothing
is ever committed.

**★ Is the listener asynchronous?**
No, not by default. It runs synchronously on the same thread that committed the
transaction, before that thread returns from the transactional method — so a slow
listener directly lengthens the request, and a `BEFORE_COMMIT` listener lengthens
the transaction. Adding `@Async` makes it asynchronous, at the cost of everything
in the threading chapter: it will be on a different thread with no transaction of
its own, and a `void` async method's exceptions are merely logged.

**★ Can a transactional event listener stop the transaction?**
Only from `BEFORE_COMMIT`. Its javadoc says exceptions "will get propagated to the
commit caller and cause a rollback of the transaction", so a validation that must
be able to fail the operation belongs there. From `AFTER_COMMIT` an exception is
still propagated to the caller, but the commit has already happened, so the caller
sees a failure for an operation that succeeded — arguably the worst of both. From
`AFTER_COMPLETION` the exception is not even propagated, only logged.

**★ Why does the reactive case need the transaction context in the event itself?**
Because there is no thread to find it on. The reference notes that as of 6.1 the
listener works with both managers, but "since the latter uses the Reactor context
instead of thread-local variables, the transaction context needs to be included in
the published event instance as the event source". The imperative path can look
the transaction up on the current thread; the reactive path has no such lookup, so
the context has to be carried explicitly with the event.

---

← Prev: [18b · Reactive and virtual threads](18b-reactive-and-virtual-threads.md) · Index: [Spring @Transactional](README.md) · Next → [19b · After-commit is not durable](19b-after-commit-is-not-durable.md)
