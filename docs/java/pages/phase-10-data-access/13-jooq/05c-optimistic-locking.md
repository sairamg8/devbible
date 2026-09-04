---
title: "jOOQ's optimistic locking is off by default and, without a version or timestamp column, it works by issuing a SELECT FOR UPDATE first — which is a pessimistic lock wearing an optimistic name"
sidebar_label: "05c · Optimistic locking"
sidebar_position: 20
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Optimistic locking*
> ([crud-with-updatablerecords/optimistic-locking](https://www.jooq.org/doc/latest/manual/sql-execution/crud-with-updatablerecords/optimistic-locking/))
> and *CRUD with UpdatableRecords*
> ([crud-with-updatablerecords](https://www.jooq.org/doc/latest/manual/sql-execution/crud-with-updatablerecords/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**Two users open the same order, both edit it, both save. Without a mechanism the second save wins
silently and the first user's change is gone with no error anywhere. JPA solves this with
`@Version`. jOOQ solves it with a `Settings` flag — and the interesting part is what that flag
does when you have not given it a version column, because the default mechanism is not what the
name suggests.**

## The flag

Optimistic locking in jOOQ is the **`executeWithOptimisticLocking`** setting on the
`Configuration`'s `Settings`. It is off unless you turn it on, and it applies to the
`UpdatableRecord` API from **[05b · UpdatableRecords](05b-updatable-records.md)** — not to the
statement API, where the check is yours to write.

🔴 **`INSERT` statements are not affected by this flag.** Only `UPDATE` and `DELETE`, which is the
right scope: there is no prior version of a row you are creating.

## Mechanism 1 — the default, and read it carefully

With the flag on and **no version or timestamp column configured**, the manual describes what
jOOQ does: *"jOOQ will run a `SELECT .. FOR UPDATE` statement, pessimistically locking the record
for the subsequent UPDATE / DELETE"*, and then *"the data fetched with the previous SELECT will be
compared against the data in the record being stored or deleted"*.

**So the default mechanism is:**

1. `SELECT … FOR UPDATE` the row — a real, row-level, pessimistic lock.
2. Compare every column against what your record held when you fetched it.
3. If they differ, throw. If not, run the `UPDATE` or `DELETE`.

⚠️ **That is two statements and a held lock per store, and it is not optimistic in the usual
sense.** Optimistic concurrency normally means *no* lock — detect the conflict at write time and
retry. What jOOQ does here is take the lock and then verify. It is correct, and it costs a lock
held for the duration of your transaction, which is the thing optimistic locking exists to avoid.

## Mechanism 2 — a version or timestamp column, which is what you want

Configure a `VERSION` or `TIMESTAMP` field in the code generator, and jOOQ stops issuing the extra
`SELECT`:

- **A `TIMESTAMP` field:** jOOQ *"adds a `WHERE`-clause to the `UPDATE` or `DELETE` statement,
  checking for TIMESTAMP's integrity"* — one statement, no lock, and a row count of zero means
  somebody else got there first.
- **A `VERSION` field:** a numeric counter *"incremented by jOOQ upon `store()` calls"*, with the
  same `WHERE`-clause check.

🔴 **This is the mechanism to configure, and the reason is in the previous section.** With a
version column you get genuine optimistic concurrency: one statement, no lock, conflict detected
by the write itself. Without one you get a lock you did not ask for, on every single-row save.

**The version column is a schema change**, which means it belongs in a migration —
[Topic 11 · Migrations with Flyway](../11-flyway-migrations/README.md) — and then in the generator
configuration, alongside everything else in
**[02c · Shaping the generated API](02c-shaping-the-generated-api.md)**.

## The exception

*"An `org.jooq.exception.DataChangedException` is thrown if the record had been modified or
deleted in the meantime, or if optimistic locking is performed on an unversioned record that
hasn't been fetched from the database."*

Two distinct causes in one sentence, and they mean very different things:

- **A genuine conflict** — somebody changed or deleted the row. Handle it: reload, re-present,
  retry, or tell the user.
- **A usage error** — you enabled optimistic locking and then tried to store a record you built in
  memory rather than fetched. There is nothing to compare against, so jOOQ refuses.

⚠️ **Catching `DataChangedException` and retrying blindly conflates those two.** The second cause
retries forever, because building the record in memory is not something a retry changes.

## Where this sits next to JPA

JPA's `@Version` is the same idea with three differences worth naming: it is per-entity rather than
per-`Configuration`, it is on by default once the annotation exists, and it throws
`OptimisticLockException`. And JPA has no equivalent of jOOQ's unversioned mode — there is no
"compare every column" fallback, because there is a persistence context holding the original state
already.

**Neither replaces a database constraint.** Optimistic locking protects a read-modify-write cycle;
it does not make an invariant true. A uniqueness rule belongs in a unique index, and a state
machine belongs in a conditional `UPDATE` — **[05 · Writes](05-writes.md)**.

## Gotchas

**★ It is off by default, so a codebase using `store()` has last-writer-wins until somebody turns
it on.** Nothing warns you. The symptom is a support ticket about an edit that vanished.

**★ The default mechanism issues a `SELECT … FOR UPDATE`.** That is a pessimistic row lock held for
the rest of your transaction, on every single-row save. On a hot row it serialises your users, and
the setting's name gives no hint of it.

**★ Column-comparison locking compares *every* column.** A row whose `last_seen_at` was touched by
an unrelated background job conflicts with your edit, even though nothing you care about changed.
A version column does not have that problem.

**★ `INSERT` is unaffected, and people expect otherwise.** Optimistic locking cannot protect
against a concurrent insert of the same logical row. That is a unique constraint's job.

**★ Storing an in-memory record with locking enabled throws.** The same exception as a real
conflict, for a completely different reason, which makes the log misleading.

**★ A blind retry loop around `DataChangedException` can spin forever.** Distinguish "the row
changed" from "this record was never fetched" before deciding to retry.

**★ Version columns must be excluded from anything that writes rows outside jOOQ.** A migration, a
bulk `UPDATE`, an admin script — any of them can change a row without bumping the version, and
then jOOQ's check passes when it should not.

**★ The setting is per-`Configuration`, so it is all or nothing.** Turning it on affects every
`UpdatableRecord` store in the application. Deriving a `Configuration` for a specific operation is
the way to vary it, not a per-record flag.

**★ Optimistic locking does nothing for the statement API.** `create.update(ORDER)…` is unaffected;
if you want a conditional write there, put the condition in the `WHERE` clause and check the row
count.

**★ Timestamp-based locking inherits your timestamp's resolution.** Two updates inside the same
clock tick can compare equal. A monotonic version counter has no such window.

**★ A retry must re-fetch, not re-store.** Retrying with the same stale record hits the same
conflict. The loop is: catch, reload, re-apply the user's intent, store again — and re-applying
the intent is a domain decision, not a framework one.

**★ Optimistic locking is not a substitute for a transaction.** It detects a conflicting write; it
does not make your read and write atomic, and it does not give you isolation —
**[Topic 03 · JDBC transactions](../03-jdbc-transactions/README.md)** does.

## Interview questions

**★ How do you enable optimistic locking in jOOQ?** The `executeWithOptimisticLocking` flag in the
`Configuration`'s `Settings`. It is off by default and applies to `UpdatableRecord` stores and
deletes, not to the statement API.

**★ Which statements does it affect?** `UPDATE` and `DELETE` only — the manual states that
`INSERT` statements are not affected by the flag.

**★ What does jOOQ actually do when the flag is on and there is no version column?** It runs a
`SELECT … FOR UPDATE` to lock the row, compares the fetched data against the data in your record,
and only then issues the `UPDATE` or `DELETE`.

**★ Why is that a surprising implementation of "optimistic" locking?** Because it takes a
pessimistic row lock. Optimistic concurrency normally means no lock at all, with the conflict
detected by the write. Two statements and a held lock per save is a materially different cost
profile.

**★ How do you get the cheap version?** Configure a `VERSION` or `TIMESTAMP` field in the code
generator. jOOQ then adds the check to the `WHERE` clause of the `UPDATE` or `DELETE` — one
statement, no lock — and increments the version on `store()`.

**★ What exception is thrown on conflict?** `org.jooq.exception.DataChangedException` — thrown
both when the row was modified or deleted in the meantime, and when locking is attempted on an
unversioned record that was never fetched from the database.

**★ Why does that second cause matter?** Because it is a usage error, not a concurrency event, and
a retry loop that treats it as a conflict never terminates. The two need distinguishing before
you decide what to do.

**★ What is wrong with comparing every column instead of a version?** Any unrelated change to the
row — a background job touching a `last_seen_at` — counts as a conflict. It is over-sensitive in
exactly the way that trains people to ignore the exception.

**★ How does this compare with JPA's `@Version`?** Same idea, three differences: JPA's is
per-entity rather than global, it is active as soon as the annotation exists, and it throws
`OptimisticLockException`. JPA has no unversioned fallback because the persistence context already
holds the original state.

**★ Does optimistic locking replace a unique constraint?** No. It protects a read-modify-write
cycle on an existing row. Two concurrent inserts of the same logical row are a constraint's
problem, and no locking mode on the update path sees them.

**★ How do you retry correctly after a `DataChangedException`?** Re-fetch the row, re-apply the
change the user intended, and store again. Retrying with the same stale record reproduces the
conflict every time, and deciding how to re-apply the intent is a domain question rather than a
framework one.

**★ Someone updated rows with a migration script and jOOQ's locking stopped catching conflicts.
Why?** The script changed rows without incrementing the version column, so the versions in the
database no longer reflect the number of modifications. Anything writing outside jOOQ has to
maintain the version too.

{/* FOOTER */}
