---
title: "Four different exceptions can come out of one failed version check, one of them does not mean a concurrency conflict at all, and Spring classifies the whole family as retryable"
sidebar_label: "16b · When the check fails"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 `OptimisticLockException` javadoc
> and specification §3.3.7.1 *Merging Detached Entity State*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the `StaleStateException`, `StaleObjectStateException` and `OptimisticEntityLockException`
> sources in Hibernate ORM 7.4
> ([github.com/hibernate/hibernate-orm, branch 7.4](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/StaleObjectStateException.java)),
> the Hibernate ORM 7.4 *User Guide* §11.1 and §11.1.1
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> and the `TransientDataAccessException` and `ObjectOptimisticLockingFailureException`
> javadocs
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/orm/ObjectOptimisticLockingFailureException.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Hibernate ORM 7.4.1.

**The same event — an `UPDATE` that matched no rows — surfaces under four different type
names depending on which API you are holding. Knowing which one you will actually catch is
the difference between a retry that works and a `catch` block that never fires. And one of
those types has a second meaning that has nothing to do with concurrency at all.**

## The four types

| Type | Package | What it is |
|---|---|---|
| `OptimisticLockException` | `jakarta.persistence` | the specification's type; extends `PersistenceException`; carries `getEntity()` |
| `StaleStateException` | `org.hibernate` | Hibernate's version-check failure, and see the warning below |
| `StaleObjectStateException` | `org.hibernate` | a `StaleStateException` that also carries the entity name and identifier |
| `ObjectOptimisticLockingFailureException` | `org.springframework.orm` | what a Spring application actually catches |

Hibernate's own javadocs cross-reference the JPA type from both
`StaleStateException` and `OptimisticEntityLockException`, which is the clearest signal that
they are the same event seen from different layers.

`StaleObjectStateException` describes itself as "a specialized `StaleStateException` that
carries information about the particular entity instance that was the source of the
failure", and its default message is:

> `Row was already updated or deleted by another transaction`

🔴 **`StaleStateException` does not only mean a concurrency conflict.** Its javadoc:

> Thrown when a version number or timestamp check failed, indicating that the `Session`
> contained stale data (when using long transactions with versioning). **Also occurs on
> attempts to delete or update a row that does not exist.**

So a row that was legitimately deleted, or an entity that was never in the database at all —
a detached instance with an identifier for a row that no longer exists — produces the same
exception as a genuine lost-update race. Diagnosing every one of these as "concurrency" is
how teams end up adding retries to a bug that is not a race.

## What Spring gives you, and why the hierarchy matters

Spring translates all of the above into its own hierarchy:

```
DataAccessException
  └ TransientDataAccessException
     └ ConcurrencyFailureException
        └ OptimisticLockingFailureException          (org.springframework.dao)
           └ ObjectOptimisticLockingFailureException (org.springframework.orm)
```

The class you catch is `ObjectOptimisticLockingFailureException` — "Exception thrown on an
optimistic locking violation for a mapped object. Provides information about the persistent
class and the identifier."

The position in that tree is not decoration. `TransientDataAccessException` is defined as:

> Root of the hierarchy of data access exceptions that are considered transient — where a
> previously failed operation might be able to succeed **when the operation is retried
> without any intervention by application-level functionality**.

That is Spring stating, in the type system, that an optimistic lock failure is a *retryable*
error. Which is the right design — and is exactly why the retry has to happen at the right
place.

## Retrying: the only place it can go

The transaction is dead. The `OptimisticLockException` javadoc: "The current transaction, if
one is active, will be marked for rollback." And the persistence context is dead too —
"a session is considered to be unusable after any of its methods throws an exception".

So a retry cannot be a loop inside the method:

```java
@Transactional
public void applyDiscount(long id, int percent) {
    for (int attempt = 0; attempt < 3; attempt++) {          // ← does not work
        try { … } catch (ObjectOptimisticLockingFailureException e) { /* retry */ }
    }
}
```

The second attempt runs in the same, already-rolled-back transaction with the same, already
poisoned persistence context. The retry has to wrap the *whole transaction*, from outside:

```java
public void applyDiscountWithRetry(long id, int percent) {
    for (int attempt = 0; ; attempt++) {
        try {
            service.applyDiscount(id, percent);              // a new transaction each time
            return;
        }
        catch (ObjectOptimisticLockingFailureException e) {
            if (attempt >= MAX_ATTEMPTS) throw e;
        }
    }
}
```

Two conditions make a retry correct rather than merely convenient: the operation must
**re-read** inside the new transaction (it will, since the persistence context is new), and
it must be **idempotent in effect** — recomputing "set the discount to 10%" is fine,
recomputing "add 10% to the discount" compounds.

⚠️ If the conflict is frequent enough that retries fail repeatedly, optimistic locking is
the wrong strategy for that row and a pessimistic lock is the honest answer —
[16c · Beyond `@Version`](16c-beyond-version.md).

## The detached case: what `@Version` is actually for

The single-transaction conflict is the easy one. `@Version`'s real purpose is the case the
User Guide calls a *conversation*: several database transactions, with user think time
between them, where "these multiple database accesses can only be atomic as a whole if only
one of these database transactions (typically the last one) stores the updated data".

The mechanism is that the version travels with the data:

1. Read the entity, send the client its fields **and its version**.
2. The user edits. Minutes pass. Nothing is locked, nothing is held open.
3. The client sends everything back, version included.
4. Build a detached instance with that version and `merge` it.

The specification requires the check on that path: version columns are checked during
merge. If someone else saved in between, the row's version has moved, the check fails, and
the second editor is told rather than silently overwriting the first.

```java
@Transactional
public void save(OrderForm form) {
    Order detached = new Order();
    detached.setId(form.id());
    detached.setVersion(form.version());     // ← the whole conversation depends on this line
    detached.setStatus(form.status());
    orderRepository.save(detached);          // merge → version-checked update
}
```

⚠️ **Drop the version from the DTO and the feature silently stops working.** Nothing throws;
you simply get last-write-wins with a version column that increments. This is the most
common way an application "has optimistic locking" and does not.

⚠️ **And a `null` version makes it worse than nothing.** Hibernate reads a null version as
*transient* — "Hibernate detects any instance with a null version or timestamp as transient,
regardless of other unsaved-value strategies that you specify" — so `merge` may attempt an
insert instead of an update.

## Excluding an attribute, and the lost update it buys

`@OptimisticLock(excluded = true)` stops one attribute from bumping the version:

```java
@Entity
class Phone {
    @Id Long id;
    @Column(name = "`number`") String number;

    @OptimisticLock(excluded = true)
    long callCount;                 // incrementing this does not move the version

    @Version Long version;
}
```

The User Guide's worked example then shows precisely what you have bought. Bob increments
`callCount`; the version stays at 0. Alice — who loaded before Bob — changes the number; her
version check against 0 passes, and her `UPDATE` writes **every** column, including
`callCount = 0`. The guide's own conclusion:

> Although there is no conflict between Bob and Alice, Alice's `UPDATE` overrides Bob's
> change to the `callCount` attribute. **For this reason, you should only use this feature
> if you can accommodate lost updates on the excluded entity properties.**

That is a real trade for a counter nobody audits. It is not a free way to reduce contention.
Note also that the lost update comes from the *all-columns* `UPDATE`; the interaction with
`@DynamicUpdate` is [14d · The shape of the UPDATE](14d-the-shape-of-the-update.md).

## Gotchas

**★ A `StaleStateException` can mean the row does not exist, not that someone else changed
it.** The javadoc names both causes. Retrying the second cause forever is a common
production incident.

**★ Catching `OptimisticLockException` in a Spring application usually catches nothing.**
Spring translates it; the type that arrives is
`ObjectOptimisticLockingFailureException`. Catch the Spring type, or catch
`OptimisticLockingFailureException` to cover both ORM providers.

**★ A retry inside the transactional method cannot work.** The transaction is marked for
rollback and the persistence context is unusable. The retry must start a new transaction.

**★ Retrying a non-idempotent operation compounds the change.** "Set the value" is safe to
retry; "add to the value" is not, unless the delta is recomputed from a fresh read.

**★ Omitting the version from your DTO turns optimistic locking off silently.** The column
still increments and the check still runs — against a version you supplied from the same
read, so it always passes.

**★ A null version means "transient", so `merge` may insert.** Mapping the version as `Long`
rather than `long` makes this reachable from ordinary code.

**★ `@OptimisticLock(excluded = true)` is a decision to accept lost updates on that
attribute.** The documentation says so in as many words.

**★ Exception messages name the entity and identifier only on `StaleObjectStateException`
and the Spring type.** A bare `StaleStateException` tells you a row was stale and nothing
about which one, which is a reason to log `getEntity()` from the JPA exception when you have
it.

**★ Several dirty entities in one flush means the exception names whichever failed first.**
Other conflicts in the same flush are never reached, so a "one conflict" report can be
hiding several.

**★ An optimistic lock failure inside a `@Transactional(readOnly = true)` method is a sign
of something else entirely.** Read-only transactions run with `FlushMode.MANUAL` and do not
write, so if one throws this, work is being done somewhere you did not expect.

## Interview questions

**★ Which exception does an optimistic lock failure actually throw?**
It depends on the layer. Hibernate raises `StaleObjectStateException` (a
`StaleStateException`), JPA defines `OptimisticLockException`, and Spring translates the
whole family to `ObjectOptimisticLockingFailureException`. In a Spring application, catch the
Spring type.

**★ What does it mean that Spring puts it under `TransientDataAccessException`?**
That Spring classifies it as an error where "a previously failed operation might be able to
succeed when the operation is retried without any intervention by application-level
functionality" — in other words, retryable by definition.

**★ Why can't you retry inside the same `@Transactional` method?**
Because the exception marks the transaction for rollback and leaves the persistence context
unusable. A second attempt in the same transaction is operating on a session Hibernate has
already declared dead. The retry has to wrap a new transaction.

**★ What has to be true for a retry to be safe?**
The retried transaction must re-read the current state — which it does, having a fresh
persistence context — and the operation must produce the same end state when recomputed
from that fresh read. Absolute assignments are safe; relative ones are only safe if the
delta is recomputed.

**★ Is a `StaleStateException` always a concurrency conflict?**
No. The javadoc says it also occurs on an attempt to update or delete a row that does not
exist — a row someone legitimately deleted, or a detached instance whose identifier is stale.

**★ How does optimistic locking work across a user editing a form for ten minutes?**
The version is sent to the client with the data and returned with the submission. The
detached instance carries it into `merge`, whose update is version-checked against the
current row. No connection, transaction or lock is held during the think time.

**★ What happens if the DTO does not carry the version?**
Nothing visible, which is the problem. The entity is loaded fresh, gets the current version,
and the check passes. You have the column and the SQL and none of the protection.

**★ What does `@OptimisticLock(excluded = true)` cost?**
Lost updates on that attribute. Because the default `UPDATE` writes every column, a
transaction whose version check passes will write its own stale value for the excluded
attribute over someone else's change. The User Guide says to use it only if you can
accommodate that.

**★ You see an optimistic lock failure on an entity nobody else edits. Where do you look?**
At whether the row exists, at whether something detached is being merged with a stale or
null version, and at whether a bulk `update` changed the row without moving the version.

---

← Prev: [16 · @Version and optimistic locking](16-version-and-optimistic-locking.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [16c · Beyond @Version](16c-beyond-version.md)
