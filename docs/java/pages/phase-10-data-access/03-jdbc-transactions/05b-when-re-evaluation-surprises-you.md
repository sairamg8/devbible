---
title: "The same re-evaluation that makes a single UPDATE safe makes a set-based DELETE miss rows that match"
sidebar_label: "5b · The inconsistent snapshot"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2.1 *Read Committed
> Isolation Level*, including the `website.hits` example and the "inconsistent
> snapshot" paragraph
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18. No sandbox: no console output, no timings.

**[Chunk 5](05-read-committed-in-practice.md) used per-row re-evaluation as the
thing that makes `SET balance = balance - 30` correct. This chunk is the bill for
that. Re-evaluation happens **per row, on the rows the command touched**, and not
across the rest of the table — so a command whose `WHERE` clause selects a *set*
can see a world that is partly current and partly stale. The manual states it
without hedging: *"it is possible for an updating command to see an inconsistent
snapshot."* The result is a `DELETE` that matches nothing while a matching row
exists both before and after the concurrent update.**

## The manual's own example, and it is worth memorising

`website` is a two-row table. `hits` is 9 in one row and 10 in the other.

```sql
-- session 1
BEGIN;
UPDATE website SET hits = hits + 1;
-- session 2, concurrently:  DELETE FROM website WHERE hits = 10;
COMMIT;
```

**The `DELETE` deletes nothing.** The manual explains why: *"the pre-update row
value `9` is skipped, and when the `UPDATE` completes and `DELETE` obtains a lock,
the new row value is no longer `10` but `11`, which no longer matches the
criteria."*

Walk it row by row, because the asymmetry is the whole lesson.

| Row | `DELETE`'s snapshot sees | What happens |
|---|---|---|
| the `hits = 9` row | 9 — does not match `hits = 10` | **skipped immediately**, never locked, never re-evaluated |
| the `hits = 10` row | 10 — matches | waits for session 1, re-evaluates against the new version, finds **11**, skips it |

There was a row with `hits = 10` before the update. There is a row with
`hits = 10` after it. The `DELETE` missed both, and it missed them for two
*different* reasons.

🔴 **Re-evaluation only applies to rows the command already decided to touch.** A
row that did not match under the command's own snapshot is never revisited, no
matter what happens to it afterwards. That is the asymmetry, and it is the source
of every surprise on this page.

## The general statement

> Because of the above rules, it is possible for an updating command to see an
> inconsistent snapshot: it can see the effects of concurrent updating commands on
> the same rows it is trying to update, but it does not see effects of those
> commands on other rows in the database. This behavior makes Read Committed mode
> unsuitable for commands that involve complex search conditions; however, it is
> just right for simpler cases.

Two categories fall out of that, and the boundary between them is the practical
rule to carry:

- **Simple** — the command targets *predetermined rows*: `WHERE id = ?`,
  `WHERE order_id = ANY(?)`. Which rows are affected is decided by data the
  concurrent transaction is not changing. Read Committed is exactly right.
- **Complex** — the command's `WHERE` clause selects a *set* whose membership
  other transactions are changing: `WHERE status = 'pending'`,
  `WHERE hits = 10`, `WHERE expires_at < now()`. Read Committed can silently
  produce a set that is neither the "before" set nor the "after" set.

## What this looks like in a real service

The archetype is a sweeper — a job that finds work by predicate and processes it.

```java
// ⚠️ 'pending' is a moving set. Other requests are inserting and updating it.
try (PreparedStatement ps = c.prepareStatement(
        "UPDATE jobs SET status = 'running', worker = ? " +
        "WHERE status = 'pending' AND scheduled_at <= now()")) {
    ps.setString(1, workerId);
    int claimed = ps.executeUpdate();
}
```

`claimed` is not "the number of jobs that were pending". It is "the number of rows
that matched under this statement's snapshot **and** still matched after waiting
for whoever held them". A job that became pending a millisecond ago is not
included; a job whose `scheduled_at` was pushed forward by a concurrent update is
locked, re-evaluated and dropped.

For a sweeper that is usually fine — it runs again in a minute. It is not fine
when the count is used as an answer: "we processed every pending job" is a claim
this statement cannot support.

⚠️ **The failure mode of the sweeper shape is not usually missed rows. It is
several workers colliding on the same rows and serialising behind each other's
locks.** The idiom that fixes that is `FOR UPDATE SKIP LOCKED`, which is
[chunk 12](12-locking-and-select-for-update.md).

## Reading the same thing twice

The other everyday consequence of per-statement snapshots needs no concurrency
subtlety at all:

```java
// ⚠️ these two reads are not guaranteed to agree, inside one transaction
int before = countPendingOrders(c);
doSomeWork();
int after  = countPendingOrders(c);
// after - before is not "work I did". It is "work I did, plus everyone else's".
```

This is the nonrepeatable read and the phantom arriving together. If the number
matters — a report, a total, an invariant check, an audit trail — Read Committed
cannot give a coherent answer across statements, and no amount of care in the Java
changes that. The fix is a level that takes one snapshot per transaction:
[chunk 6](06-repeatable-read.md).

## The four ways out, and when each is right

| Approach | Use when | Cost |
|---|---|---|
| One statement over a predetermined row (`SET n = n + 1 WHERE id = ?`) | the change is an expression over that row's current value | none — prefer this always |
| `SELECT ... FOR UPDATE` then compute in Java | the computation genuinely cannot be SQL — a rules engine, an external rate, branching logic | the row is locked from the `SELECT` until commit; other writers wait |
| Repeatable Read | the answer must be consistent across several statements, or the invariant spans rows | `40001` on write conflicts; you need a retry loop |
| Serializable | the invariant is over a *set* that concurrent transactions are also reading and writing | `40001` from dependency cycles you cannot see in one transaction |

Notice that the first two solve the *lost update* and do nothing for the
*inconsistent set*. A row lock protects the row you locked; it cannot protect you
from a row that arrived after your snapshot. Only a transaction-wide snapshot can.

## The trade-off

Read Committed is the default for good reasons, and it is worth naming them rather
than treating the level as a defect.

**What you get.** The manual calls it *"fast and simple to use"*. No serialization
failures on write conflicts — the second writer waits and re-evaluates rather than
aborting, so no retry machinery is needed anywhere. No snapshot pinned for the
duration of a long transaction, so superseded row versions can be cleaned up
promptly. And a very short critical section: locks are held only from the moment
a statement touches a row until commit, not from the start of the transaction.

**What you pay.** The burden of correctness moves into your SQL. Every
read-modify-write must be a single statement, a locked read, or a higher level.
Every set-based command over mutable criteria is approximate. And the level will
never tell you when you got it wrong — a lost update is an `UPDATE` that
succeeded, and a missed row is a `DELETE` that reported zero.

The manual's own summary: *"the partial transaction isolation provided by Read
Committed mode is adequate for many applications, and this mode is fast and simple
to use; however, it is not sufficient for all cases."*

## Gotchas

**⚠️ Trusting the update count from a set-based command**
**Symptom:** "we archived 412 expired sessions" in a log, and 415 were expired.
**Cause:** the count reflects rows matching this statement's snapshot that still
matched after any waiting. Rows that became eligible mid-statement are not
included.
**Fix:** treat the count as "rows I claimed", never as "rows that qualified".
Re-run, or make the sweep idempotent and repeated.

**⚠️ A `DELETE` or `UPDATE` whose `WHERE` names a column another transaction is
incrementing**
**Symptom:** rows that visibly match the condition survive a delete, and nobody
can reproduce it by hand.
**Cause:** the `website.hits` case exactly — the matching row's value moved past
the criterion, and the row that moved *into* the criterion was skipped before it
did.
**Fix:** match on a stable key. Select the ids under the criterion first, then act
on those ids — accepting that the id set is a snapshot, which at least makes the
staleness explicit and bounded.

**⚠️ Two aggregate reads in one transaction compared against each other**
**Symptom:** a nightly reconciliation that disagrees with itself by small amounts
under load and reconciles perfectly when the system is idle.
**Cause:** each `SELECT` took a fresh snapshot; concurrent commits landed in
between.
**Fix:** Repeatable Read for the reporting transaction, or compute the whole thing
in one statement.

**⚠️ Assuming a row lock fixes a set problem**
**Symptom:** `SELECT ... FOR UPDATE` is added to a check-then-insert, and
duplicates still appear.
**Cause:** you can only lock rows that exist. If the check is "does a row matching
this condition exist?", locking the zero rows you found locks nothing, and a
concurrent transaction inserting a matching row is unaffected.
**Fix:** a unique constraint (which turns the race into a catchable integrity
violation), or Serializable, whose predicate locks cover the *condition* rather
than the rows.

**⚠️ Reading "just right for simpler cases" as "good enough everywhere"**
**Symptom:** a policy of "we use the default level" applied to a batch job that
computes balances across a hundred thousand rows.
**Cause:** the manual's endorsement is scoped to commands affecting predetermined
rows. A long analytical transaction is precisely the complex case.
**Fix:** decide the level per transaction, not per application —
[chunk 8](08-setting-the-level-from-java.md).

## Interview questions

**★ Can two `SELECT`s in the same transaction return different results at Read
Committed?**
Yes, and the manual states it explicitly. Each statement takes a new snapshot that
includes everything committed up to the instant that statement began, so a
transaction committing between your first and second `SELECT` is visible to the
second one. This is the nonrepeatable read and, for a query returning a set, the
phantom. It matters most for anything that compares two reads — a reconciliation,
a before/after count, an invariant check. Repeatable Read is the fix: one snapshot
taken at the first statement and held for the whole transaction.

**★ Walk through the `website.hits` example and explain why the `DELETE` deletes
nothing.**
The table has rows with `hits` of 9 and 10. A concurrent transaction runs
`UPDATE website SET hits = hits + 1`, and `DELETE FROM website WHERE hits = 10`
runs against it. The `DELETE` evaluates its condition under its own snapshot: the
9-row does not match, so it is skipped outright and never looked at again. The
10-row matches, so the `DELETE` tries to lock it — but the `UPDATE` holds it, so
the `DELETE` waits. When the `UPDATE` commits, the `DELETE` re-evaluates its
`WHERE` clause against the new version, sees 11, and skips it. Both candidate rows
are gone for different reasons, and a row with `hits = 10` exists both before and
after. The lesson is that re-evaluation applies only to rows the command already
decided to touch, never to rows that did not match under its snapshot.

**★ What does the manual mean by an "inconsistent snapshot" for an updating
command?**
That the command can see two different points in time at once. For the rows it is
actually updating, it waits for concurrent writers and then sees their committed
changes. For every other row in the database it still sees its own original
snapshot. So the set of rows it acted on corresponds to no single moment — it is
partly "before" and partly "after". This is why the manual says Read Committed is
unsuitable for commands with complex search conditions and just right for simpler
cases: if the affected rows are predetermined, the inconsistency has nothing to
attach to.

**★ When is Read Committed the right choice, and when is it not?**
It is right — and it is the default — when every unit of work either touches
predetermined rows or expresses its change as a single statement over the row's
current value. You get no serialization failures on write conflicts, so no retry
machinery, and no long-lived snapshot pinning old row versions. It is wrong when
an invariant spans several rows or tables, when a command's search condition is
over data other transactions are changing, or when two reads in one transaction
have to agree with each other. Those are the cases for Repeatable Read or
Serializable, and the price is that you must be prepared to retry.

**★ Does `SELECT ... FOR UPDATE` solve the inconsistent-set problem?**
No, and the distinction matters. A row lock protects the rows you locked, which
fixes the lost update — nobody else can change those rows until you commit. It
cannot protect you from a row that did not exist, or did not match, when you took
your snapshot, because there was nothing to lock. Check-then-insert is the clearest
case: locking the zero rows your check returned locks nothing at all, and a
concurrent insert sails past. The fixes there are a unique constraint, which turns
the race into a catchable integrity violation, or Serializable, whose predicate
locks are taken on the *condition* rather than on rows.

**★ A sweeper claims `UPDATE jobs SET status='running' WHERE status='pending'`
processed every pending job. Is that claim true?**
No. The update count is the number of rows that matched under that statement's
snapshot *and* still matched after waiting for any concurrent holder. A job that
became pending after the snapshot is not included, and a job whose criteria a
concurrent transaction changed is locked, re-evaluated and dropped. For a sweeper
that runs repeatedly this is usually harmless — the missed rows are picked up next
time — but the count cannot be used as evidence of completeness. If completeness
matters, the shape has to change: a stable id set selected first, or a level that
gives the whole transaction one snapshot.

---

← Prev: [5 · Read Committed](05-read-committed-in-practice.md) · Index: [Transactions at the JDBC level](README.md) · Next → [6 · Repeatable Read](06-repeatable-read.md)
