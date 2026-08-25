---
title: "SKIP LOCKED turns a table into a work queue by deliberately returning an inconsistent view of it"
sidebar_label: "12b · NOWAIT, SKIP LOCKED, scope"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 `SELECT` reference page's *The
> Locking Clause*, including the Caution about `ORDER BY`
> ([postgresql.org/docs/18/sql-select.html](https://www.postgresql.org/docs/18/sql-select.html)),
> §13.3.2 *Row-Level Locks*
> ([postgresql.org/docs/18/explicit-locking.html](https://www.postgresql.org/docs/18/explicit-locking.html)),
> and Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**By default a locking `SELECT` waits — indefinitely — for whoever holds the row.
Two options change that, and they are not variations on a theme.
`NOWAIT` fails fast: *"the statement reports an error, rather than waiting, if a
selected row cannot be locked immediately."* `SKIP LOCKED` quietly hands you a
different set of rows: *"any selected rows that cannot be immediately locked are
skipped."* The manual is unusually direct about what that costs — *"skipping locked
rows provides an inconsistent view of the data, so this is not suitable for general
purpose work"* — and equally direct about the one case where the inconsistency is
the feature: a queue-like table with several consumers.**

## The full form of the clause

```
FOR { UPDATE | NO KEY UPDATE | SHARE | KEY SHARE }
    [ OF from_reference [, ...] ]
    [ NOWAIT | SKIP LOCKED ]
```

`NOWAIT` and `SKIP LOCKED` are mutually exclusive, and they apply to the row locks
only. The manual: *"note that `NOWAIT` and `SKIP LOCKED` apply only to the
row-level lock(s) — the required `ROW SHARE` table-level lock is still taken in the
ordinary way."* So neither one makes the statement completely non-blocking; it can
still wait on the table-level lock, and the manual points at `LOCK ... NOWAIT` if
you need that too.

## The queue worker

This is the idiom, and it is the reason `SKIP LOCKED` exists:

```java
// ✅ N workers, no contention, no duplicate delivery
c.setAutoCommit(false);

List<Long> jobIds = new ArrayList<>();
try (PreparedStatement ps = c.prepareStatement("""
        SELECT id FROM jobs
        WHERE status = 'pending'
        ORDER BY scheduled_at
        LIMIT ?
        FOR UPDATE SKIP LOCKED
        """)) {
    ps.setInt(1, batchSize);
    try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) jobIds.add(rs.getLong(1));
    }
}
markRunning(c, jobIds);
c.commit();          // ← locks released; the rows are now marked, not locked
```

Without `SKIP LOCKED`, every worker's query matches the same first rows, and they
all queue behind worker one — throughput collapses to a single worker plus
overhead. With it, each worker takes the first `batchSize` rows nobody else has,
and they never touch each other.

⚠️ **`ORDER BY` plus `LIMIT` plus `SKIP LOCKED` is the shape**, and the `LIMIT`
matters more than it looks: the manual says *"if a `LIMIT` is used, locking stops
once enough rows have been returned to satisfy the limit"*. Without it, each worker
locks every unlocked pending row in the table.

🔴 **And note the `OFFSET` trap in the same sentence: "rows skipped over by `OFFSET`
will get locked".** Paginating a locking query with `OFFSET` locks everything you
paged past. Do not paginate a `FOR UPDATE` with `OFFSET`.

## `NOWAIT`, and the error it raises

`NOWAIT` is for the opposite situation: you would rather fail than queue. A user
clicking "edit" on a record that someone else is editing should get an immediate
"somebody else has this" rather than a spinner that resolves in ninety seconds.

The failure is SQLSTATE **`55P03`, `lock_not_available`**, class 55 — Object Not In
Prerequisite State.

```java
catch (SQLException e) {
    if ("55P03".equals(e.getSQLState())) {
        throw new RecordBusy(recordId);   // a 409, not a 500
    }
    throw e;
}
```

⚠️ **`55P03` is not retryable in the class-40 sense.** Retrying immediately just
asks the same question again. It is a signal to tell the user, or to back off on a
human timescale — not something for an automatic retry loop
([chunk 14](14-retrying-safely.md)).

## Scope: what a locking clause actually reaches

This is where locking queries surprise people, and every rule here is from the
`SELECT` reference page.

**No table list means everything.** *"A locking clause without a table list affects
all tables used in the statement."* Add `FOR UPDATE` to a three-table join and rows
from all three are locked — including reference tables the query only reads. Name
the table instead: `FOR UPDATE OF orders`.

**Views and sub-queries are transparent.** *"If a locking clause is applied to a
view or sub-query, it affects all tables used in the view or sub-query."*

**`WITH` queries are not.** *"However, these clauses do not apply to `WITH` queries
referenced by the primary query. If you want row locking to occur within a `WITH`
query, specify a locking clause within the `WITH` query."*

**Multiple clauses resolve to the strongest.** *"If the same table is mentioned (or
implicitly affected) by more than one locking clause, then it is processed as if it
was only specified by the strongest one."* And `NOWAIT` wins over `SKIP LOCKED` if
both appear.

**Aggregates are refused.** *"The locking clauses cannot be used in contexts where
returned rows cannot be clearly identified with individual table rows; for example
they cannot be used with aggregation."*

**A sub-`SELECT`'s locking is narrowed by the outer query.** The manual's example:

```sql
SELECT * FROM (SELECT * FROM mytable FOR UPDATE) ss WHERE col1 = 5;
```

*"will lock only rows having `col1 = 5`, even though that condition is not
textually within the sub-query."*

**And rows can be locked without being returned.** *"In addition, rows that
satisfied the query conditions as of the query snapshot will be locked, although
they will not be returned if they were updated after the snapshot and no longer
satisfy the query conditions."*

## The `ORDER BY` caution, which is genuinely startling

> It is possible for a `SELECT` command running at the `READ COMMITTED` transaction
> isolation level and using `ORDER BY` and a locking clause to return rows out of
> order. This is because `ORDER BY` is applied first. The command sorts the result,
> but might then block trying to obtain a lock on one or more of the rows. Once the
> `SELECT` unblocks, some of the ordering column values might have been modified,
> leading to those rows appearing to be out of order.

🔴 **A sorted query returning unsorted rows.** The sort happened, then the lock
wait happened, then the values changed. The manual's workaround is to push the
locking into a sub-query:

```sql
SELECT * FROM (SELECT * FROM mytable FOR UPDATE) ss ORDER BY column1;
```

and it immediately warns about the cost: *"note that this will result in locking
all rows of `mytable`, whereas `FOR UPDATE` at the top level would lock only the
actually returned rows. This can make for a significant performance difference,
particularly if the `ORDER BY` is combined with `LIMIT`."* Its own recommendation is
to use the technique *"only if concurrent updates of the ordering columns are
expected and a strictly sorted result is required."*

⚠️ **This cannot happen at Repeatable Read or Serializable** — the manual says so:
at those levels the changed row would cause a `40001` instead, "so there is no
possibility of receiving rows out of order under these isolation levels".

## The trade-off

| Option | Use when | Cost |
|---|---|---|
| (default: wait) | the row is genuinely needed and contention is rare | an unbounded wait; needs `lock_timeout` to be safe |
| `NOWAIT` | a human is waiting and "busy" is a valid answer | `55P03` to handle, and no progress on contention |
| `SKIP LOCKED` | rows are interchangeable units of work | a deliberately inconsistent view — wrong for anything else |

## Gotchas

**⚠️ `SKIP LOCKED` on a query that is not a queue**
**Symptom:** a report or a batch silently omits rows, non-deterministically, under
load.
**Cause:** the manual's own warning — skipping locked rows "provides an
inconsistent view of the data, so this is not suitable for general purpose work".
**Fix:** restrict it to interchangeable work items. If which rows you get matters,
it is the wrong tool.

**⚠️ `SKIP LOCKED` without a `LIMIT`**
**Symptom:** the first worker to arrive locks every available row and the others
find nothing.
**Cause:** without a limit the query locks every matching unlocked row. `LIMIT` is
what makes locking stop early.
**Fix:** `ORDER BY ... LIMIT n FOR UPDATE SKIP LOCKED`, with `n` sized to one
worker's batch.

**⚠️ Paginating a locking query with `OFFSET`**
**Symptom:** page 10 of an editable list locks the 900 rows on pages 1–9.
**Cause:** the reference page is explicit that "rows skipped over by `OFFSET` will
get locked".
**Fix:** paginate with a keyset (`WHERE id > ?`), or do not lock while paging —
lock the single row the user actually edits.

**⚠️ Locking more rows than you meant to**
**Symptom:** a `SELECT ... FOR UPDATE` with a join or a view causes blocking on
tables the query merely reads.
**Cause:** a locking clause with no table list affects all tables used in the
statement, and inside a view or sub-query it reaches everything.
**Fix:** name the table — `FOR UPDATE OF orders`.

**⚠️ Retrying `55P03` in the class-40 retry loop**
**Symptom:** a `NOWAIT` query is retried three times in fifty milliseconds and
fails all three, having achieved nothing.
**Cause:** `lock_not_available` means somebody holds the lock right now. An
immediate retry asks the same question.
**Fix:** surface it to the caller as a conflict. If a retry is right at all, it is
on a human timescale, not an automatic backoff.

**⚠️ Expecting a locking clause inside a `WITH` to lock anything**
**Symptom:** a CTE-based query that appears to lock rows does not.
**Cause:** locking clauses on the primary query do not reach `WITH` queries.
**Fix:** put the locking clause inside the `WITH` query itself.

## Interview questions

**★ What is the difference between `NOWAIT` and `SKIP LOCKED`?**
Both stop a locking `SELECT` from waiting, and that is where the similarity ends.
`NOWAIT` raises an error — SQLSTATE `55P03`, `lock_not_available` — if any selected
row cannot be locked immediately, so the statement either gets everything it asked
for or fails. `SKIP LOCKED` succeeds but returns fewer rows, silently omitting the
ones it could not lock. `NOWAIT` is for interactive work where "somebody else has
this record" is a valid answer to give a user. `SKIP LOCKED` is for queues, where
the rows are interchangeable and getting a *different* set is fine. Neither affects
the table-level `ROW SHARE` lock, which is still taken normally.

**★ Why is `SKIP LOCKED` described as giving an inconsistent view?**
Because the rows you get depend on what other transactions happen to hold at that
instant, so the same query run twice returns different sets for reasons unrelated
to the data. The manual states it plainly and follows it with the scope: "this is
not suitable for general purpose work, but can be used to avoid lock contention
with multiple consumers accessing a queue-like table". The inconsistency is exactly
what makes the queue work — each worker wants *some* available jobs, not *the*
jobs — and exactly what makes it wrong for a report, a reconciliation or anything
where the omitted rows matter.

**★ Write a safe multi-worker job claim.**
Open a transaction, then
`SELECT id FROM jobs WHERE status = 'pending' ORDER BY scheduled_at LIMIT ? FOR
UPDATE SKIP LOCKED`, mark those rows as running, and commit. The `SKIP LOCKED` is
what stops the workers queueing behind each other; the `LIMIT` is what stops the
first worker locking the entire pending set, since locking stops once the limit is
satisfied; and the commit is what releases the locks, at which point the rows are
protected by their `status` rather than by a lock. The work itself happens after
the commit, never inside the transaction — otherwise every job's duration is lock
duration.

**★ How can a `SELECT ... ORDER BY ... FOR UPDATE` return rows out of order?**
Because the sort runs before the locking. At Read Committed the command sorts its
result, then blocks trying to lock one of those rows; while it waits, the ordering
column of that row can be changed by the transaction it is waiting for. When it
unblocks it returns the row with its new value, which may no longer be in sorted
position. The manual's workaround is to move the locking clause into a sub-query
and sort outside it, but it warns that this locks every row of the table rather
than only the returned ones, and recommends it only when concurrent updates of the
ordering columns are expected and strict ordering is required. It cannot happen at
Repeatable Read or Serializable, where the changed row produces a `40001` instead.

**★ You add `FOR UPDATE` to a `SELECT` that joins three tables. What gets locked?**
All rows from all three tables that contribute to the returned join rows, because a
locking clause with no table list affects all tables used in the statement. That is
almost never what is wanted — it can block work on lookup or reference tables the
query only reads. Name the table you mean, `FOR UPDATE OF orders`, and the others
are read normally. The same reach applies inside views and sub-queries, but *not*
into `WITH` queries, which need their own locking clause. And if the same table is
covered by more than one locking clause, the strongest one wins.

**★ Does `SKIP LOCKED` guarantee a job is never processed twice?**
Not by itself — it guarantees no two workers hold the same row's lock at the same
time, which is a narrower claim. Once your transaction commits, the lock is gone,
so the protection has to have been transferred to something durable: the `status`
column you set inside the same transaction. That is why the claim and the status
update must be in one transaction and the actual work must be after it. If the
worker crashes after committing the claim, the row is marked running with nobody
running it, which is a separate problem needing a lease or a heartbeat — not
something the locking clause addresses.

---

← Prev: [12 · Row locks and FOR UPDATE](12-locking-and-select-for-update.md) · Index: [Transactions at the JDBC level](README.md) · Next → [13 · Deadlocks](13-deadlocks-and-timeouts.md)
