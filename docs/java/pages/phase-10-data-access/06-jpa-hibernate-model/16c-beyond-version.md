---
title: "When a version column is not enough or not possible: versionless strategies, forced increments, and the point at which optimistic locking is the wrong answer"
sidebar_label: "16c · Beyond @Version"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §11.1.1 *Versionless
> optimistic locking*, §11.2 *Pessimistic*, §11.3 *LockMode and LockModeType* and §11.4
> *Jakarta Persistence locking query hints*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the `OptimisticLockType`, `OptimisticLocking` and `OptimisticLock` sources in Hibernate
> ORM 7.4
> ([github.com/hibernate/hibernate-orm, branch 7.4](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/annotations/OptimisticLockType.java)),
> the Hibernate ORM 7.4 and 6.6 javadoc indexes
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/annotations/OptimisticLocking.html))
> and the Jakarta Persistence 3.2 `LockModeType` javadoc
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**A version column is the right answer often enough that everything else on this page is an
exception. But three situations defeat it — a legacy schema you cannot alter, a row whose
concurrent edits genuinely do not conflict, and a conflict rate high enough that retrying is
worse than waiting — and each has a different mechanism, sitting at a different level of the
stack.**

## Versionless optimistic locking

Hibernate can run the same check against the *data* instead of against a version column. The
User Guide:

> Hibernate supports a form of optimistic locking that does not require a dedicated "version
> attribute". This is also useful for use with modeling legacy schemas. The idea is that you
> can get Hibernate to perform "version checks" using either all of the entity's attributes
> or just the attributes that have changed.

The annotation is `@OptimisticLocking(type = …)`, and the `OptimisticLockType` javadoc
defines all four values precisely:

| Value | The `WHERE` clause of every update/delete gets |
|---|---|
| `NONE` | nothing — "No optimistic locking" |
| `VERSION` | "the primary key and current version" — the default |
| `DIRTY` | "every dirty field of the entity instance" |
| `ALL` | "every field of the entity" |

`VERSION` is described in the javadoc as "the usual strategy", and the mechanism spelled out
there is the same one [16](16-version-and-optimistic-locking.md) argued: "If no rows are
updated, this is interpreted as a lock checking failure."

⚠️ **`NONE` disables optimistic locking even when `@Version` is mapped.** The User Guide's
wording: "optimistic locking is disabled **even if there is a `@Version` annotation
present**". That is a way to have the column, the increments and none of the protection.

### `ALL`

Every column goes into the `WHERE` clause, so any concurrent change to any column fails the
statement. It is the closest versionless equivalent to `VERSION`, and the User Guide is
explicit that it needs a companion annotation:

> When using `OptimisticLockType.ALL`, you should also use `@DynamicUpdate` because the
> `UPDATE` statement must take into consideration all the entity property values.

When the check fails: "there won't be any match, and a `StaleStateException` or an
`OptimisticEntityLockException` is going to be thrown."

### `DIRTY`

Only the columns *you* changed go into the `WHERE` clause. The consequence is the interesting
one:

> The main advantage of `OptimisticLockType.DIRTY` over `OptimisticLockType.ALL` and the
> default `OptimisticLockType.VERSION` used implicitly along with the `@Version` mapping, is
> that **it allows you to minimize the risk of `OptimisticEntityLockException` across
> non-overlapping entity property changes**.

Two users editing different fields of the same row both succeed, because neither one's
`WHERE` clause mentions the other's column. That is genuinely better behaviour for, say, a
profile record where one process updates the address and another updates a preference.

It is also strictly weaker. Nothing detects that the row as a whole is now a mixture of two
edits, and the "non-overlapping" judgement is yours to make correctly.

🔴 **The User Guide's `DIRTY` advice cites an annotation that no longer exists.** It says to
"also use the `@SelectBeforeUpdate` annotation so that detached entities are properly handled
by the `Session#update(entity)` operation". `org.hibernate.annotations.SelectBeforeUpdate` is
present in the Hibernate 6.6 javadocs and **absent from the 7.4 javadocs**, and
`Session#update` was removed along with the rest of the pre-7 save/update API — the
*Introduction* notes plainly that "there's no `update()` operation for a stateful session".
Treat that sentence as documentation that outlived its API. What replaces it is `merge`,
which performs its own select before applying your state.

### Costs to weigh before choosing versionless

- **Wide `WHERE` clauses** on every write, which the database must evaluate.
- **Columns that compare badly.** A `float`, a timestamp with different precision in Java and
  in the column, or a value whose Java round-trip is lossy will fail to match for reasons
  that have nothing to do with concurrency.
- **`@Lob` and lazily-fetched columns** cannot sensibly be part of a `WHERE` clause.
- **`@DynamicUpdate` is mandatory**, so its costs — statement variety and lost batching —
  come with it. [14d · The shape of the UPDATE](14d-the-shape-of-the-update.md).

A version column costs one small integer and one predicate. Prefer it whenever the schema is
yours to change.

## Forcing a version increment

`@Version` moves only when something changes. Two lock modes move it deliberately:

| Mode | What it does |
|---|---|
| `OPTIMISTIC` (`READ`) | "The entity version is checked towards the end of the currently running transaction" |
| `OPTIMISTIC_FORCE_INCREMENT` (`WRITE`) | "The entity version is incremented automatically **even if the entity has not changed**" |
| `PESSIMISTIC_FORCE_INCREMENT` | locks the row pessimistically *and* increments the version |

```java
Order order = entityManager.find(Order.class, id, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
order.getLines().add(newLine);   // the child changed; the parent's version moves anyway
```

The forced increment is the answer to a real modelling problem: a change that logically
invalidates the aggregate but does not touch the aggregate root's own columns. Bumping the
root's version makes concurrent readers of the root fail, which is what you wanted.

`OPTIMISTIC` — plain — is the other half: it asks for the version of an entity you only
*read* to be checked at the end of the transaction, so a decision made from a row you did not
modify still fails if that row moved underneath you.

## Where pessimistic locking starts

Optimistic locking detects; pessimistic locking prevents. The User Guide's framing:
pessimistic locking "assumes that concurrent transactions will conflict with each other, and
requires resources to be locked after they are read and only unlocked after the application
has finished using the data" — and, crucially, "Hibernate always uses the locking mechanism
of the database, and **never locks objects in memory**."

The modes, and what they mean on the database:

| `LockModeType` | Effect |
|---|---|
| `PESSIMISTIC_READ` | a shared lock if the database supports one, otherwise an explicit lock |
| `PESSIMISTIC_WRITE` | an explicit lock — `select … for update` |
| `PESSIMISTIC_WRITE` + `jakarta.persistence.lock.timeout` = `0` | Hibernate's `UPGRADE_NOWAIT`: "fails fast if the row is already locked" |
| `PESSIMISTIC_WRITE` + timeout `-2` | `UPGRADE_SKIPLOCKED`: "skips the already locked rows" — `select … for update skip locked` on PostgreSQL |

```java
Order order = entityManager.find(Order.class, id, LockModeType.PESSIMISTIC_WRITE);
```

`skip locked` is the one worth knowing by name: it is how a work-queue table is drained by
several workers without any of them blocking. On PostgreSQL 18 that is
`select … for update skip locked`, and the User Guide names both PostgreSQL and Oracle as
supporting it.

Two portability notes from §11.4 and §11.3: "Not all JDBC database drivers support setting a
timeout value for a locking request. If not supported, the Hibernate dialect ignores this
query hint"; and "If the requested lock mode is not supported by the database, Hibernate uses
an appropriate alternate mode instead of throwing an exception. This ensures that
applications are portable." Both mean a lock request can be quietly weaker than you asked
for.

⚠️ **`jakarta.persistence.lock.scope` is not implemented.** §11.4: "The
`jakarta.persistence.lock.scope` is not yet supported as specified by the Jakarta Persistence
standard."

Pessimistic locking is a *transaction* concern rather than a mapping one, and the isolation
levels it interacts with are
[topic 04 · 16 · Isolation](../04-spring-transactional/16-isolation.md).

## Choosing

| Situation | Use |
|---|---|
| ordinary entity you can add a column to | `@Version` |
| legacy schema, no column available | `@OptimisticLocking(type = ALL)` + `@DynamicUpdate` |
| concurrent edits to disjoint columns are genuinely fine | `@OptimisticLocking(type = DIRTY)` + `@DynamicUpdate` |
| the aggregate changed but the root's columns did not | `OPTIMISTIC_FORCE_INCREMENT` |
| a decision made from a row you only read must be validated | `OPTIMISTIC` |
| contention high enough that retries thrash | `PESSIMISTIC_WRITE` |
| several workers draining a queue table | `PESSIMISTIC_WRITE` + timeout `-2` (`skip locked`) |

## Gotchas

**★ `OptimisticLockType.NONE` silently disables the check even with `@Version` mapped.** The
column still exists and still increments; nothing is verified.

**★ Versionless locking without `@DynamicUpdate` does not work as documented.** The guide
requires it for both `ALL` and `DIRTY`, because the `WHERE` clause has to be built from the
relevant property values.

**★ The `@SelectBeforeUpdate` advice in the 7.4 User Guide is stale.** The annotation is gone
from the 7.4 javadocs and the `Session#update` operation it served no longer exists.

**★ Floating-point and imprecise timestamp columns break `ALL`.** The `WHERE` clause compares
values that may not round-trip identically, producing "conflicts" with no concurrent writer.

**★ `DIRTY` narrows the check to what you changed, which is exactly as safe as your claim
that the columns are independent.** Nothing verifies that claim.

**★ A forced increment still fails if someone else got there first.** It is not a way to win
a conflict, only a way to declare that one occurred.

**★ A lock mode you asked for may not be the one you got.** Hibernate substitutes a supported
mode rather than throwing, and drivers may ignore the timeout hint entirely.

**★ `lock.scope = EXTENDED` is documented as not supported.** Code relying on it to lock
joined-inheritance tables or element collections is relying on nothing.

**★ Pessimistic locks are held until the transaction ends.** A `PESSIMISTIC_WRITE` inside a
long method blocks every other writer for the whole method, including the parts that do no
database work at all.

**★ Reaching for a pessimistic lock to fix an intermittent optimistic failure usually
converts a rare exception into a permanent throughput ceiling.** Measure the conflict rate
first; a retry that succeeds on the second attempt is cheaper than serialising every request.

## Interview questions

**★ How do you do optimistic locking without a version column?**
`@OptimisticLocking(type = ALL)` puts every column in the `WHERE` clause of each update and
delete; `type = DIRTY` puts only the changed ones there. Both require `@DynamicUpdate`.
Failure surfaces as a `StaleStateException` or `OptimisticEntityLockException`, exactly as
with a version.

**★ What is the advantage of `DIRTY` over `ALL` and over `VERSION`?**
It minimises conflicts between non-overlapping changes: two transactions editing different
columns of the same row can both succeed, because neither one's check mentions the other's
column. The cost is that nothing detects the row is now a blend of two edits.

**★ Why does versionless locking need `@DynamicUpdate`?**
Because the statement has to be built from the relevant property values, which means the
statement text depends on which properties those are. A fixed all-columns statement cannot
express it.

**★ When does a version column need to be incremented even though nothing on the entity
changed?**
When a change elsewhere in the aggregate invalidates decisions made from the root — a line
added to an order, a child added to a parent. `LockModeType.OPTIMISTIC_FORCE_INCREMENT` bumps
the root's version deliberately so concurrent readers of the root fail.

**★ What does plain `LockModeType.OPTIMISTIC` do?**
It asks for the entity's version to be checked towards the end of the transaction even though
you did not modify it. It protects a decision made from a row you only read.

**★ Where is the boundary between optimistic and pessimistic locking?**
Optimistic locking takes no lock and detects a conflict at write time; pessimistic locking
takes a database lock at read time and makes the second reader wait. Optimistic is a mapping
decision, pessimistic is a per-operation one, and Hibernate always delegates the actual lock
to the database.

**★ What is `skip locked` for?**
Draining a work-queue table with several workers. Each worker's `select … for update skip
locked` takes the rows nobody else holds instead of blocking, so throughput scales with
workers. In JPA it is `PESSIMISTIC_WRITE` with a `jakarta.persistence.lock.timeout` of `-2`.

**★ Can you rely on a requested lock mode being honoured?**
No. The User Guide says Hibernate substitutes an appropriate alternate mode when the database
does not support the one you asked for, rather than throwing, and that unsupported timeout
hints are ignored by the dialect. Both are portability features and both mean silent
weakening.

**★ Optimistic lock failures are frequent on one hot row. What now?**
Either reduce the contention — split the row, move the counter out, or use `DIRTY` if the
edits are genuinely disjoint — or accept that the row is contended and take a pessimistic
lock. Retrying into a high conflict rate wastes work and can starve.

---

← Prev: [16b · When the check fails](16b-when-the-version-check-fails.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [17 · ddl-auto](17-ddl-auto.md)
