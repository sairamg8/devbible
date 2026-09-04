---
title: "Read, then act: do the slow part with no transaction open, then take a short one for the write — and put the retry above the boundary, restarting it whole"
sidebar_label: "21b · Shaping the work"
sidebar_position: 65
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html))
> and *Declarative transaction management*
> ([.../transaction/declarative.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html)),
> the PostgreSQL 18 manual *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html))
> and *Client Connection Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)).
> JDK 25, Spring Framework 7.0.9, PostgreSQL 18.

**Two structural rules follow from
[21](21-what-belongs-in-a-transaction.md), and between them they cover most real
services. Do the reading and the deciding with no transaction open, then take a
short one for the writing. And put the retry *above* the transaction boundary, so
a failed attempt restarts the whole transaction rather than trying to continue a
dead one.**

## Read, then act

The instinct is to wrap the whole operation in one transaction because that is
where the data is. The better shape separates gathering from writing:

```java
// no transaction: read, call out, compute
public CheckoutResult checkout(long cartId) {
    CartView cart = cartQueries.load(cartId);          // read-only, short transaction inside
    Quote quote = pricing.quote(cart);                 // possibly a remote call
    validate(cart, quote);                             // pure computation

    return orderWriter.write(cartId, quote);           // ← the only write transaction
}

@Transactional
public CheckoutResult write(long cartId, Quote quote) {
    Order order = orderRepository.save(Order.from(cartId, quote));
    inventory.reserve(order);
    return CheckoutResult.of(order);
}
```

The write transaction now lasts as long as two statements take, regardless of how
slow pricing is. A degraded pricing service makes checkout slow; it no longer
makes the whole application fail.

What you give up is that the data you read is no longer guaranteed to still be
true when you write. Between the read and the write, someone else may have changed
it. That is not a flaw introduced by the restructuring — it is the truth being made
visible. The answer is to make the write itself check:

```java
@Transactional
public CheckoutResult write(long cartId, Quote quote) {
    int updated = inventoryRepository.decrementIfAvailable(quote.sku(), quote.qty());
    if (updated == 0) throw new InsufficientStockException(quote.sku());
    ...
}
```

A conditional write — `UPDATE … WHERE quantity >= ?`, or an optimistic-locking
version column — makes the check and the change one atomic statement. That is
almost always better than holding a long transaction to keep a read valid, and it
is the technique that lets the transaction be short.

## Where the retry goes

Some failures are meant to be retried. On PostgreSQL, `SERIALIZABLE` and
`REPEATABLE READ` transactions can be aborted by the server, and the manual says
applications "must be prepared to retry". A deadlock is the same shape.

The retry must sit **outside** the boundary:

```java
// wrong: the transaction is already dead
@Transactional
public void transfer(...) {
    for (int i = 0; i < 3; i++) {
        try { doTransfer(); return; }
        catch (CannotAcquireLockException ex) { /* retry */ }
    }
}
```

Once a statement in a PostgreSQL transaction fails, the transaction is in an
aborted state and every subsequent statement in it is rejected until it is rolled
back. The retry cannot work — it is retrying inside a transaction that can no
longer do anything. And the sleeps, if any, hold the connection.

```java
// right: each attempt is a whole new transaction
public void transfer(...) {                     // NOT @Transactional
    for (int attempt = 1; ; attempt++) {
        try { transferService.doTransfer(...); return; }   // ← different bean, @Transactional
        catch (TransientDataAccessException ex) {
            if (attempt == 3) throw ex;
        }
    }
}
```

Three properties make this correct. The transaction is fully rolled back before
the next attempt starts, so the database is in a clean state. Each attempt gets a
fresh snapshot, which is the entire point — retrying with the old snapshot would
fail identically. And the connection is returned between attempts, so a backoff
does not hold pool resources.

The same structural rule as everywhere in this topic applies: `transferService`
must be a **different bean**, or the call is a self-invocation and no transaction
starts at all.

Spring Retry's `@Retryable` composes the same way — it must be the outer advice, on
a method that is not itself the transaction boundary.

## Making a transaction shorter, in order of effect

1. **Move external calls out.** Biggest effect, almost always available.
2. **Move computation before the boundary.** Read what you need, compute, then
   open the transaction.
3. **Replace read-then-write with a conditional write.** Removes the reason the
   transaction was long.
4. **Split a batch into per-item transactions** — where partial success is
   acceptable; see [14b · Three honest options](14b-three-honest-options.md).
5. **Narrow the boundary itself.** A `@Transactional` on a controller method, or on
   a class where only two methods write, is a transaction longer than it needs to
   be.

Point 5 is worth dwelling on. The reference notes that declarative transaction
management "works at method granularity around a thread of execution. It cannot be
used on arbitrary code blocks", so the only tool for narrowing a boundary is to
extract a method — usually onto another bean. That is not a limitation to work
around; it is a design nudge, and the method you extract is normally the unit of
work you should have named anyway. Where you genuinely need a sub-method boundary,
`TransactionTemplate` gives it programmatically.

## The trade-off

Short transactions cost you guarantees across the gap. Reading in one transaction
and writing in another means the world can change in between, so the write has to
defend itself with a conditional update, a version column, or a uniqueness
constraint. That is more code and it requires thinking about conflict rather than
assuming isolation will handle it.

The compensation is that the system degrades instead of failing. A slow dependency
makes requests slow rather than exhausting the pool; a conflicting write produces a
clean, retryable error rather than a lock queue; and a burst of load queues on the
pool briefly instead of deadlocking on held rows. Long transactions trade a small
amount of code for a failure mode that takes the whole application down.

## Gotchas

**⚠️ The retry inside the transaction**
**Symptom:** every retry fails immediately with a different error than the first
attempt.
**Cause:** on PostgreSQL the transaction is aborted after the first failure and
rejects everything until rolled back.
**Fix:** retry around the boundary, on a method that is not itself transactional.

**⚠️ `@Retryable` and `@Transactional` on the same method**
**Symptom:** the retries happen but always fail the same way.
**Cause:** the ordering puts the retry inside the transaction, so each attempt runs
in the same dead transaction.
**Fix:** put them on separate beans — retry on the outer, transaction on the inner
— so a retry genuinely restarts the transaction.

**⚠️ The retry calling `this.doTransfer()`**
**Symptom:** no transaction at all, and the retries appear to work while writing
non-atomically.
**Cause:** a self-invocation bypasses the proxy — see **[03 · The self-invocation trap](03-the-self-invocation-trap.md)**.
**Fix:** inject the transactional bean and call it through the injected reference.

**⚠️ Assuming a shorter transaction preserved the read's guarantees**
**Symptom:** overselling, double-booking, or a lost update after the restructuring.
**Cause:** the read and the write are now in different transactions, so the world
could change in between. The restructuring exposed a race that the long
transaction had been masking.
**Fix:** a conditional write — `UPDATE … WHERE quantity >= ?` and check the row
count, or a version column. Never assume; check at write time.

**⚠️ A backoff `sleep` between attempts, inside the boundary**
**Symptom:** pool exhaustion under contention, precisely when load is highest.
**Cause:** the connection is held for the whole backoff.
**Fix:** the sleep goes in the outer loop, after the transaction has been rolled
back and the connection returned.

**⚠️ `@Transactional` on a controller method**
**Symptom:** the transaction spans request parsing, validation, serialisation and
sometimes view rendering.
**Cause:** the boundary was put at the outermost layer rather than around the unit
of work.
**Fix:** move it to the service method. The controller's job is translation, not
atomicity.

**⚠️ Class-level `@Transactional` on a service that mostly reads**
**Symptom:** every method, including trivial lookups, opens a read-write
transaction.
**Cause:** the annotation applies to every method that does not redeclare it.
**Fix:** the Spring Data pattern — `readOnly = true` at class level, explicit
read-write declarations on the methods that write. See
[15b](15b-where-read-only-pays.md).

**⚠️ Writing a file inside the transaction**
**Symptom:** orphaned files after a rollback, or a hung request on a network mount.
**Cause:** the filesystem is not a transactional resource and, on NFS, not a
bounded one either.
**Fix:** write after the commit, and make the cleanup of orphans a scheduled job
rather than a promise.

**⚠️ Retrying an operation that is not idempotent**
**Symptom:** duplicated effects after a retry — two charges, two emails, two rows.
**Cause:** the first attempt may have partially succeeded outside the transaction,
or succeeded entirely and failed only on the response.
**Fix:** retry only work that is safe to repeat. Anything with an external side
effect needs an idempotency key before it can be retried at all.

## Interview questions

**★ What is the read-then-act shape and why does it matter?**
Do the reading, the remote calls and the computation with no transaction open,
then take a short transaction that performs only the write. It matters because the
transaction's duration is what costs you — a held connection, held locks, a
snapshot that blocks vacuum — and in the naive shape that duration is decided by
whatever the slowest step happens to be, often a dependency you do not control. In
the read-then-act shape, a slow dependency makes the request slow and nothing
else.

**★ What does that restructuring give up, and how do you handle it?**
The read is no longer guaranteed to still be true when the write happens, because
they are in different transactions now. The honest framing is that it exposes a
race the long transaction was masking rather than creating a new one. The fix is to
make the write check for itself: a conditional update such as
`UPDATE inventory SET qty = qty - ? WHERE sku = ? AND qty >= ?` with a row-count
check, or an optimistic-locking version column. Both make the check and the change
one atomic statement, which is what allows the transaction to be short.

**★ Where does a retry belong, and why not inside the transaction?**
Above the boundary, on a method that is not itself transactional, calling the
transactional method on a different bean. Retrying inside does not work: on
PostgreSQL a transaction is aborted after its first failed statement and rejects
everything until it is rolled back, so every retry fails immediately. Even where a
database tolerated it, the retry would run against the same snapshot and fail the
same way, and any backoff would be holding the connection. Retrying above the
boundary rolls back cleanly, returns the connection, and starts a fresh transaction
with a fresh snapshot.

**★ How do you narrow a transaction to less than a whole method?**
You cannot, declaratively — the reference notes that declarative transaction
management "works at method granularity around a thread of execution. It cannot be
used on arbitrary code blocks". The tool is to extract the narrower unit into its
own method, normally on another bean so the proxy is in play. That constraint is
usually a benefit: the method you are forced to extract is the unit of work that
should have had a name. Where a sub-method boundary is genuinely required,
`TransactionTemplate` provides it programmatically.

**★ Rank the ways of making a transaction shorter.**
Moving external calls out first — it is almost always available and has the largest
effect, because it removes a duration you do not control. Then moving computation
before the boundary. Then replacing a read-then-write with a conditional write,
which removes the reason the transaction had to span both. Then splitting batch work
into per-item transactions where partial success is acceptable. And finally
narrowing the boundary itself: an annotation on a controller, or at class level on a
service where two methods write, is a transaction longer than the work it protects.

**★ `@Retryable` and `@Transactional` on the same method — what happens?**
The retries run inside the transaction rather than around it, so each attempt
executes in the same transaction the previous attempt already broke, and on
PostgreSQL every one of them fails immediately. It is a common arrangement precisely
because it looks right. The correct structure separates them onto different beans:
retry advice on the outer method, the transaction on the inner one, so that "retry"
means "start a new transaction" rather than "try again in the dead one".

**★ Is retrying always safe once the structure is right?**
Only for work that is idempotent. A retried transaction that only touches the
database is usually fine — it was rolled back, so there is nothing to duplicate.
Retrying anything with an external side effect is not: the first attempt may have
sent the request and failed only on the response, so a retry charges twice. That is
why external calls being outside the boundary matters here too — it makes the
retryable part exactly the part that is safe to repeat, and forces an explicit
decision, usually an idempotency key, for the part that is not.

---

← Prev: [21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md) · Index: [04 · Spring @Transactional](README.md) · Next → [22 · The debugging order](22-the-checklist.md)
