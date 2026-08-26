---
title: "@Version is one field on your entity, and adding it changes the SQL of every update and delete that entity will ever produce — which is why it belongs in the mapping chapter and not in a chapter about locking"
sidebar_label: "16 · @Version and optimistic locking"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 `@Version` and
> `OptimisticLockException` javadocs and specification §3.4 *Optimistic Locking and
> Concurrency*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Hibernate ORM 7.4 *User Guide* §11.1 *Optimistic* and §11.1.1 *Mapping optimistic
> locking*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Hibernate ORM 7.4 *Introduction* §3.8 *Version attributes* and §5.3
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Optimistic locking is not an API you call. It is a column you map. Put `@Version` on a
field and every `UPDATE` and `DELETE` Hibernate generates for that entity gains
`and version = ?` in its `WHERE` clause and `version = ?` in its `SET` clause — for ever,
on every code path, whether or not that path knows about concurrency. Nothing else in JPA
changes so much from so small an annotation, and that is why it is a mapping decision.**

## The mapping

```java
@Entity
class Order {
    @Id @GeneratedValue Long id;
    Status status;
    BigDecimal total;

    @Version
    long version;          // that is the entire feature
}
```

No getter is required by the feature, no service code changes, no annotation on any method.

The *Introduction* is direct about how widely it should be applied:

> **Almost every entity which is frequently updated should have a version attribute.**

## What it does to the SQL

Every update becomes conditional on the version the entity was loaded with. Conceptually:

```sql
update "order"
   set status = ?, total = ?, version = ?     -- the new version
 where id = ?
   and version = ?                            -- the version we loaded
```

The *Introduction* states the mechanism and the failure in one passage:

> A version check is included in the where clause of every SQL update or delete statement
> for a versioned entity. If a version check fails — that is, if no rows are updated —
> Hibernate infers that the entity was updated in some other unit of work and throws an
> `OptimisticLockException` to indicate that the current session is working with stale
> data.

Two things follow that people find counter-intuitive.

**The database does not detect anything.** It executes an `UPDATE` whose `WHERE` clause
matches no rows and reports zero rows affected. That is not an error at the SQL level. The
detection is Hibernate comparing the affected-row count against the number of rows it
expected to write.

**Deletes are checked too.** A `DELETE` on a versioned entity carries the version
predicate, so removing a row someone else has modified fails the same way.

## When the check happens

At flush — which means [15 · Flush](15-flush.md) decides *when*. The
`OptimisticLockException` javadoc allows all three moments:

> Thrown by the persistence provider when an optimistic locking conflict occurs. This
> exception may be thrown as part of an API call, a flush or at commit time. **The current
> transaction, if one is active, will be marked for rollback.**

The exception carries the offending instance — `getEntity()` "returns the entity that caused
this exception" — which is the only reliable way to report *which* record conflicted when a
flush wrote several.

And once it is thrown, the persistence context is finished. The *Introduction*: "a session
is considered to be unusable after any of its methods throws an exception", and on this
exception specifically, "this loss of synchronization between the persistence context and
the database means that we must discard the current session." Retrying inside the same
transaction is not an option; retrying means a new transaction and a fresh read.

## The permitted types — and a contradiction worth knowing about

The Jakarta Persistence 3.2 `@Version` javadoc:

> The version attribute must be of one of the following basic types: `int`, `Integer`,
> `short`, `Short`, `long`, `Long`, `java.sql.Timestamp`, `Instant`, `LocalDateTime`.

plus two rules that are easy to violate by accident: "An entity class should have at most
one `Version` field or property", and "The `Version` field or property should be mapped to
the primary table of the entity" — so a versioned entity using `@SecondaryTable` must keep
the version column on the main one.

🔴 **The Hibernate 7.4 User Guide's list is out of date relative to the spec it cites.**
§11.1.1 says "According to Jakarta Persistence, the valid types for these attributes are
limited to: `int` or `Integer`, `short` or `Short`, `long` or `Long`,
`java.sql.Timestamp`. However, Hibernate allows you to use even Java 8 Date/Time types,
such as `Instant`." The 3.2 javadoc above already permits `Instant` and `LocalDateTime`.
The *Introduction*'s own list is wider still — "`Integer`, `Short`, `Long`,
`LocalDateTime`, `OffsetDateTime`, `ZonedDateTime`, or `Instant`". Use a numeric type and
the disagreement never affects you.

**Prefer a numeric version over a timestamp.** The User Guide's own assessment:
"Timestamps are a less reliable way of optimistic locking than version numbers." Two clocks,
limited resolution, and two updates inside the same millisecond are all real. A timestamp
version earns its place only when the column has to double as a business-visible
"last modified".

## Where the value comes from

- **Numeric** — Hibernate assigns it. "A version attribute is automatically assigned by
  Hibernate when an entity is made persistent, and automatically incremented or updated
  each time the entity is updated." The initial value is **0**; write
  `@Version int version = 1;` if you want it to start at 1.
- **Datetime** — generated in the JVM by default. To have the database generate it, combine
  the annotations: `@Version @CurrentTimestamp LocalDateTime version;` — or
  `@Generated(value = ALWAYS, sql = "current_timestamp")`. Hibernate then calls the
  database's current-timestamp function as part of the write.
- **Anything else** — possible, with a `UserVersionType`; and a trigger-generated version
  needs a custom `OnExecutionGenerator`.

🔴 **The application must never assign it.** The User Guide: "Your application is
**forbidden** from altering the version number set by Hibernate." If you need to force a
bump without changing anything, that is `LockModeType.OPTIMISTIC_FORCE_INCREMENT` —
[16c · Beyond `@Version`](16c-beyond-version.md).

There is a second reason not to touch it, and it is not about locking at all: Hibernate uses
the version to decide whether an instance is transient. "A version or timestamp property
**can never be null for a detached instance**. Hibernate detects any instance with a null
version or timestamp as transient, regardless of other unsaved-value strategies that you
specify." That heuristic — and how to break it — is
[12 · The four entity states](12-the-four-states.md), and its consequences for `merge` are
[16b · When the version check fails](16b-when-the-version-check-fails.md).

## What counts as "the entity was updated"

By default, everything. The User Guide: "By default, **every entity attribute
modification** is going to trigger a version incrementation." The `@OptimisticLock`
javadoc puts it from the other direction: "If this annotation is not present, mutating an
attribute *does* cause the version to be incremented."

That includes attributes you might not think of as part of the row — the annotation targets
fields and methods generally, so a mapped collection attribute is an attribute like any
other. Adding an element to a collection the entity owns bumps the owner's version, which
is how a parent detects that its children changed underneath it.

⚠️ I could not confirm from the 7.4 documentation whether mutating an **inverse**
(`mappedBy`) collection increments the owner's version, and the answer plausibly depends on
whether any owned state changed at all. Do not assume it; if the parent's version must move
when a child is added, make that explicit rather than relying on the collection.

Turning a specific attribute off is `@OptimisticLock(excluded = true)`, and it comes with a
documented cost — the User Guide's own example shows the resulting lost update — so it is
covered where that cost can be shown, in
[16b · When the version check fails](16b-when-the-version-check-fails.md).

## Optimistic is not pessimistic

Both are in the same chapter of the User Guide, and they are opposites:

> **Optimistic** locking assumes that multiple transactions can complete without affecting
> each other […] Before committing, each transaction verifies that no other transaction has
> modified its data.
>
> **Pessimistic** locking assumes that concurrent transactions will conflict with each
> other, and requires resources to be locked after they are read and only unlocked after
> the application has finished using the data.

`@Version` is entirely the first. It takes no database lock, blocks nobody, and its whole
cost is one column and one predicate. It detects a conflict *after the fact* and makes the
loser fail. Pessimistic locking prevents the conflict by making the second reader wait — and
that is a per-call decision (`LockModeType.PESSIMISTIC_WRITE`), not a mapping one. The line
between them, and the modes in between, is
[16c · Beyond `@Version`](16c-beyond-version.md).

The User Guide's note on where the locking actually happens is worth remembering: "Hibernate
always uses the locking mechanism of the database, and **never locks objects in memory**."

## Gotchas

**★ Adding `@Version` to an existing entity changes every write it produces.** Existing rows
need the column backfilled to a non-null value, or every update fails to match. This is a
migration, not an annotation.

**★ The database reports success.** A failed version check is an `UPDATE` that matched zero
rows — perfectly valid SQL. The error exists only because Hibernate counts.

**★ `DELETE` is version-checked too.** Removing an entity someone else modified throws, which
surprises people who think of `@Version` as protecting updates.

**★ A `null` version on a detached instance makes Hibernate treat it as transient.** Which
means `merge` will try to insert it. Never map a version as a nullable wrapper and then let
code construct instances with it unset.

**★ Assigning to the version field yourself corrupts the mechanism.** It is forbidden by the
documentation, and it also defeats the transient/detached heuristic.

**★ A timestamp version can collide.** Two updates within the clock's resolution produce the
same value and the check passes when it should not. Numeric versions do not have this
failure mode.

**★ Only one `@Version` per entity, on the primary table.** With `@SecondaryTable`, putting
it on the secondary table is invalid.

**★ Bulk `update` statements do not increment it.** Optimistic locking is bypassed entirely
for rows changed that way —
[15d · Reading your own writes](15d-reading-your-own-writes.md).

**★ `@Version` does not protect a read-then-decide-then-write across two transactions unless
the entity is carried across.** The check compares the version you *loaded* with the version
in the row. If the second transaction re-reads the row, it loads the new version and the
check trivially passes. Optimistic locking across a user's thinking time requires sending the
version to the client and back — [16b](16b-when-the-version-check-fails.md).

**★ The persistence context is unusable after the exception.** Catching
`OptimisticLockException` and continuing with the same `EntityManager` is not a retry. The
transaction is marked for rollback regardless.

**★ It gives you no ordering guarantee, only conflict detection.** Two transactions writing
disjoint fields of the same row still conflict under the default `VERSION` strategy — one of
them loses, even though nothing was actually contended.

## Interview questions

**★ Why is `@Version` described as a mapping concern rather than a locking API?**
Because you do not call anything. Placing the annotation changes the generated SQL for every
update and delete of that entity, permanently and on every code path. It is a property of
the mapping, like a column type, not a per-operation decision.

**★ How does the version check actually work?**
The loaded version is added to the `WHERE` clause of the `UPDATE` or `DELETE`, and the new
version to the `SET` clause. If another transaction has already changed the row, its version
no longer matches, the statement affects zero rows, and Hibernate — noticing the count is
lower than expected — throws `OptimisticLockException`.

**★ Does the database detect the conflict?**
No. From the database's point of view the statement succeeded and matched nothing. The
detection is entirely on Hibernate's side, from the affected-row count.

**★ When is the exception thrown?**
At flush — which may be at commit, at an explicit `flush()`, or before an overlapping query.
The javadoc allows all three, and states the active transaction will be marked for rollback.

**★ Which types can a version be?**
Per the 3.2 javadoc: `int`/`Integer`, `short`/`Short`, `long`/`Long`, `java.sql.Timestamp`,
`Instant` and `LocalDateTime`. Hibernate accepts more. A numeric type is the right default;
the documentation itself calls timestamps "a less reliable way of optimistic locking".

**★ Can the application set the version?**
No — the User Guide forbids it. Beyond breaking the check, a manually assigned or null
version defeats the heuristic Hibernate uses to tell a transient instance from a detached
one.

**★ What is the difference between optimistic and pessimistic locking here?**
Optimistic locking takes no lock: it assumes conflicts are rare, and verifies at write time
that nothing changed underneath. Pessimistic locking takes a database lock at read time and
makes the other reader wait. The first is a mapping; the second is a per-call
`LockModeType`.

**★ You added `@Version` and every update to existing rows started failing. Why?**
The existing rows almost certainly have `null` in the new column, so `version = ?` never
matches — and a null version also makes Hibernate treat detached instances as transient.
The column has to be backfilled as part of the migration that adds it.

**★ Two transactions update different columns of the same row. Under `@Version`, what
happens?**
One of them fails. The default strategy versions the whole row, not individual columns, so
non-overlapping edits still conflict. Reducing that is what the versionless `DIRTY` strategy
is for — [16c · Beyond `@Version`](16c-beyond-version.md).

---

← Prev: [15d · Reading your own writes](15d-reading-your-own-writes.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [16b · When the check fails](16b-when-the-version-check-fails.md)
