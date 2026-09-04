---
title: "Reviewing the code around the entity — the questions that have no answer in the mapping, because a persistence context is a property of the calling code"
sidebar_label: "19b · Reviewing the unit of work"
sidebar_position: 42
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — every item summarises a claim argued and sourced in the chunk it links
> to. Underlying sources: the Hibernate ORM 7.4 *User Guide* and *Introduction*
> ([docs.hibernate.org/orm/7.4/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)),
> the Jakarta Persistence 3.2 specification
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Spring Framework 7.0 and Spring Boot 4.1 references and sources
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/data/sql.html)) and the
> Spring Data JPA 4.1 javadocs
> ([docs.spring.io/spring-data/jpa/docs/current/api/](https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/Modifying.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, Hibernate ORM 7.4.1,
> Spring Data JPA 4.1.0.

**[19 · The checklist](19-the-checklist.md) reviews a class. This one reviews a method — and
these are the questions that produce the reports that start "the code ran and the database did
not change", which no amount of reading the entity will explain.**

## Is the entity managed when it is modified?

**1 · Was it loaded inside this transaction?**
Dirty checking only applies to managed instances. An entity that arrived from a cache, a
message, an HTTP request body or a previous transaction is detached, and mutating it does
nothing at all.
→ [12 · The four entity states](12-the-four-states.md)

**2 · If `merge` is called, is the return value used?**
`entityManager.merge(order);` as a bare statement discards the only managed instance. The
object you passed in is still detached.
→ [13b · merge returns a copy](13b-merge-returns-a-copy.md)

**3 · Is the method `@Transactional(readOnly = true)` and does it write?**
Spring sets `FlushMode.MANUAL` for read-only transactions. The write is suppressed and nothing
complains.
→ [14f · Turning it off](14f-turning-dirty-checking-off.md)

**4 · Is there a `clear()` or a `@Modifying(clearAutomatically = true)` between the load and
the modification?**
Both detach everything the caller was holding, mid-method.
→ [15d · Reading your own writes](15d-reading-your-own-writes.md)

## Is anything being written that nobody asked for?

**5 · Does a read-only-looking method modify an entity?**
Any managed entity that differs from its snapshot at flush produces an `UPDATE`. There is no
syntactic marker in the method saying so.
→ [14 · Dirty checking](14-dirty-checking.md)

**6 · Does a helper, a mapper or a callback assign to a mapped field?**
Normalising a string, computing a total onto a mapped field, touching an audit column — each
makes every read a write.
→ [14c · What counts as a change](14c-what-counts-as-a-change.md)

**7 · Does a bulk statement run while entities are loaded?**
The context is not synchronised with it, and dirty checking can write the stale in-memory
values back over the bulk change.
→ [15d · Reading your own writes](15d-reading-your-own-writes.md)

## Ordering and flushing

**8 · Does the method delete rows and then insert replacements?**
The `ActionQueue` runs entity deletes last. Without a flush between them, the inserts hit the
old rows and violate the constraint.
→ [15c · Flush operation order](15c-flush-operation-order.md)

**9 · Is there a native query or a `JdbcClient` call in the middle of the method?**
A native query under the `EntityManager` API flushes everything; a `JdbcClient` call flushes
nothing and reads stale data.
→ [15b · What triggers a flush](15b-what-triggers-a-flush.md),
[topic 05 · 11b · The flush trap](../05-sql-first-access/11b-the-flush-ordering-trap.md)

**10 · Is `flush()` being called defensively?**
It does not commit and it does not clear. The legitimate uses are ordering, getting a
database-generated value early, and batching loops.
→ [15 · Flush](15-flush.md)

**11 · Is an exception being caught and the method allowed to continue?**
The persistence context is unusable after any exception from it, and a swallowed exception in
a `@Transactional` method commits whatever was already dirty.
→ [15 · Flush](15-flush.md),
[topic 04 · 14 · The caught exception](../04-spring-transactional/14-the-caught-exception.md)

## How much is in the context

**12 · How many entities does this method load?**
Every flush walks all of them, and there is more than one flush.
→ [14e · What dirty checking costs](14e-what-dirty-checking-costs.md)

**13 · Is there a loop that queries?**
Each overlapping query forces a flush, and each flush walks the whole context.
→ [15b · What triggers a flush](15b-what-triggers-a-flush.md)

**14 · Is there a batching loop without `clear()`?**
`flush()` alone writes but does not shrink the context.
→ [14e · What dirty checking costs](14e-what-dirty-checking-costs.md)

**15 · Could this method use a projection instead?**
The cheapest entity is one never loaded.
→ [topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md)

## Concurrency

**16 · Is an optimistic lock failure handled, and where?**
The transaction is marked for rollback and the persistence context is unusable, so a retry
inside the method cannot work. It must wrap a new transaction.
→ [16b · When the check fails](16b-when-the-version-check-fails.md)

**17 · Is the retried operation idempotent in effect?**
Absolute assignments retry safely; relative ones compound unless the delta is recomputed from
the fresh read.
→ [16b · When the check fails](16b-when-the-version-check-fails.md)

**18 · Is the exception being caught by the right type?**
Spring translates; the type that arrives is `ObjectOptimisticLockingFailureException`, not
`OptimisticLockException`.
→ [16b · When the check fails](16b-when-the-version-check-fails.md)

## Configuration that changes all of the above

**19 · Is `spring.jpa.open-in-view` set explicitly?**
It defaults to `true`, which extends the persistence context across the whole request and
weakens `readOnly = true`.
→ [18c · `open-in-view`](18c-open-in-view.md)

**20 · Can anyone on the team see what the persistence context is doing?**
`hibernate.generate_statistics` and the `org.hibernate.SQL` logger are the difference between
diagnosing this list and guessing at it.
→ [18 · Seeing what Hibernate does](18-seeing-what-hibernate-does.md),
[18b · The statistics you read](18b-the-statistics-you-actually-read.md)

## The four reports, and where each one comes from

| Report | Look at |
|---|---|
| "the code ran and the database did not change" | items 1, 2, 3, 4 |
| "an `UPDATE` appeared that nobody wrote" | items 5, 6, 7 |
| "a unique constraint fails and the code is obviously right" | item 8 |
| "it is slow and there is no slow query" | items 12, 13, 14, 19 |

## Gotchas

**★ The three most common causes of "it did not save" are all in the first four items.** A
detached entity, an ignored `merge` result, and a read-only transaction. None of them throws.

**★ A method can be correct in a service and wrong in a listener.** `open-in-view` applies to
web requests only, so the same code has a different persistence-context lifetime in a message
consumer or a scheduled job.

**★ Reordering two repository calls can move where an exception is thrown.** Because it moves
the flush. This makes "innocuous refactor" changes genuinely risky in methods that write.

**★ A retry loop inside a `@Transactional` method is worse than no retry.** It looks like
resilience and it operates on a rolled-back transaction and a poisoned session.

**★ `saveAndFlush` in a loop is a flush per iteration over the whole context.** It is not a
targeted write of one entity.

**★ Adding `@Modifying` without its two attributes leaves both protections off.** The defaults
are `false`, which is not what the annotation's presence suggests.

**★ Nothing in this list is visible in the entity class.** Which is why a review that reads
only the mapping approves all of it.

**★ Statistics answer "does this happen"; they do not answer "where".** Pair them with the SQL
log or a bracketed test to reach a call site.

**★ The same method reviewed with `open-in-view` on and off has different answers to items 3,
12 and 19.** Establish the setting before reviewing anything else.

## Interview questions

**★ A method modifies an entity and nothing is written. What are the possibilities, in
order?**
The entity is detached; a `merge` result was ignored; the transaction is `readOnly = true` and
therefore `FlushMode.MANUAL`; the persistence context was cleared between the load and the
modification; or there was no transaction at all. None of these throws.

**★ An `UPDATE` appears that no code requested. How do you find its cause?**
Establish that the entity is managed, then find what makes it differ from its snapshot: an
assignment during load, a mutation in place of a mutable value, a converter that does not
round-trip, or a bulk statement whose change is being written back by dirty checking.

**★ Why can reordering two repository calls break a method?**
Because auto-flush happens before an overlapping query, so moving a query moves the flush,
which moves both the statements and any constraint violation they cause.

**★ Where does a retry for an optimistic lock failure belong?**
Outside the transaction. The exception marks the transaction for rollback and leaves the
persistence context unusable, so the retry has to start a fresh transaction with a fresh
context — and the operation has to be idempotent in effect.

**★ How does `open-in-view` change how you review a method?**
It extends the persistence context to the whole request, so entities loaded by earlier calls
are still managed, the dirty-check walk is larger, changes made outside a transaction remain
detectable, and `readOnly = true` loses its snapshot-skipping half.

**★ What single instrument would you add to a project that has none of this visibility?**
`hibernate.generate_statistics`, read as the ratio of flush count to write counts. It costs
something, and it is the one measurement that distinguishes "the queries are slow" from "the
persistence context is too full".

**★ How do you review a batching loop?**
Check that it flushes *and* clears at an interval, that the identifier generator is not
`IDENTITY` (which disables batching), and that `hibernate.jdbc.batch_size` is actually set —
the documented sizing advice is between 10 and 50.

**★ What question would you ask before any of the others?**
Whether this method needs entities at all. If it only reads, a projection removes the identity
map, the snapshot, the flush cost and most of this list at once.

---

← Prev: [19 · The checklist](19-the-checklist.md) · Index: [06 · The JPA/Hibernate model](README.md)
