---
title: "The snapshot rule"
sidebar_label: "02 · The snapshot rule"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**Every part of one statement — including every CTE in it — sees the same snapshot of the
database, taken before the statement began. Writes made by one CTE are therefore invisible
to its siblings, no matter what order they appear in. This is not a quirk to work around;
it is what makes the statement's result independent of an execution order you do not
control. It also means two CTEs writing the same row lose one of the writes, silently.**

## A sibling `SELECT` does not see the write

```sql
WITH ins AS (
  INSERT INTO agg_audit (what, order_id) VALUES ('probe', 10) RETURNING id
)
SELECT (SELECT count(*)::int FROM agg_audit) AS visible_to_sibling,
       (SELECT count(*)::int FROM ins)       AS visible_via_returning;
```

```console
the snapshot rule — a sibling SELECT does NOT see the CTE write:
   [{"visible_to_sibling":0,"visible_via_returning":1}]
  after the statement   : [{"audit_rows":1}]
```

Read those three numbers carefully, because they are the whole topic:

| | Value | Meaning |
|---|---|---|
| `visible_to_sibling` | **0** | reading `agg_audit` directly sees the pre-statement snapshot |
| `visible_via_returning` | **1** | reading the CTE's `RETURNING` output sees the row |
| after the statement | **1** | the write is real and committed as normal |

**The row was written, and a sibling `SELECT` on the table could not see it.** The only
window onto a write made in the same statement is that write's own `RETURNING`. Query the
table again and you get the world as it was before the statement started.

So the rule is:

> A data-modifying CTE's effect is visible to the rest of the statement **only** through
> its `RETURNING` rows — never by re-reading the table.

## Why it works that way

All sub-statements share one snapshot, so none of them can observe another's changes. That
is what makes the outcome independent of execution order — and the order genuinely is not
specified. PostgreSQL does not promise to run the CTEs in the order written, or to finish
one before starting another. If a sibling `SELECT` *could* see a sibling's write, the
result would depend on scheduling, and the same statement could return different answers on
different runs.

The rule buys determinism. The cost is that a pipeline reading top-to-bottom like a script
does not behave like one, and the trap below is what that costs when you forget.

## Two CTEs writing the same row: one write is lost

```sql
WITH a AS (UPDATE agg_orders SET total = 1 WHERE id = 10 RETURNING id),
     b AS (UPDATE agg_orders SET total = 2 WHERE id = 10 RETURNING id)
SELECT (SELECT count(*) FROM a) AS a, (SELECT count(*) FROM b) AS b;
```

```console
two CTEs writing the same row                ok  rows=1 [{"a":"1","b":"0"}]
  value now             : [{"id":10,"total":1}]
  ^ both UPDATEs ran against the same snapshot; one of them silently lost
```

**No error. No warning.** `a` updated one row, `b` updated **zero**, and the surviving
value is `1`. Which one wins is not something the statement lets you choose or predict —
swap the CTE order and there is no guarantee the answer swaps with it.

The mechanism follows from the snapshot rule. Both `UPDATE`s target the row as it existed
before the statement. One of them gets there first and produces a new row version; the
other, still matching against the old snapshot, finds that the row it wanted has already
been updated *by the same command* and skips it — reporting 0 rows rather than raising a
conflict.

This is a close relative of the classic lost update, but it is worse in one specific way:
the usual lost update needs two concurrent transactions and can be prevented with row locks
or a higher isolation level ([phase 11](../../phase-11-mvcc/04-lost-update.md) measures all
four fixes). **Here both writes are inside one statement, so there is no second transaction
to lock against and no isolation level that helps.** `SERIALIZABLE` does not detect it —
there is only one transaction.

The fix is not a lock. It is not writing the statement:

- **Merge the logic into one write.** `SET total = CASE WHEN … THEN 1 ELSE 2 END`, or one
  `UPDATE` whose `WHERE` selects disjoint row sets.
- **Make the sets provably disjoint** if two writes really are needed — different `WHERE`
  clauses that cannot match the same row.
- **Use separate statements in a transaction** when the second write must see the first.
  That is the one thing a single statement fundamentally cannot do.

> **`MERGE` catches the analogous mistake, and this does not.** Feeding a duplicate source
> row into `MERGE` raises `21000 MERGE command cannot affect row a second time`, while
> `UPDATE … FROM` with the same duplicate silently picks one
> ([measured in phase 4](../../phase-4-crud/07-update.md)). Two write CTEs behave like
> the silent one.

## What this means for ordering

Three consequences worth stating plainly:

1. **You cannot sequence writes within a statement.** If step two must observe step one's
   effect, they are two statements, in a transaction.
2. **Constraints are still enforced** — uniqueness, foreign keys, checks. The snapshot rule
   governs visibility, not integrity. A write CTE that violates a constraint fails the
   whole statement, and the atomicity from
   [the previous chunk](01-one-statement-many-writes.md) means every other part is rolled
   back with it.
3. **Triggers see their own row normally.** The snapshot rule is about what the
   *statement's other parts* can read, not about what a trigger fired by a write observes.

## When to use a transaction instead

Reach for `BEGIN`/`COMMIT` and separate statements when:

- a later step must **read** what an earlier step wrote;
- the steps must be **conditional** on each other's results in application code;
- the same rows are written more than once;
- the work is large enough that you want it in batches rather than one long statement
  holding its locks for the duration.

Use the single-statement form when the steps form a straight pipeline — each consuming the
previous step's `RETURNING` — and none of them re-reads what another wrote.

## In Node

```js
// Needs a transaction: the second write depends on reading the first.
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const {rows: [order]} = await client.query(
    `UPDATE agg_orders SET status = 'paid' WHERE id = $1 RETURNING id, total`,
    [id],
  );
  await client.query(
    `INSERT INTO agg_audit (what, order_id) VALUES ($1, $2)`,
    [order.total > 100 ? 'large-payment' : 'payment', order.id],
  );
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

That decision is only needed because JavaScript inspects `order.total` between the two
writes. If the branch can be expressed in SQL, the single-statement CTE version from
[chunk 01](01-one-statement-many-writes.md) is better: atomic, one round trip, no
connection held across awaits.

**`release()` in `finally`, always** — and note that a client returned to the pool carries
its session state with it, which is its own measured trap
([phase 11](../../phase-11-mvcc/15-advisory-locks.md)).

## Trade-off

One snapshot for the whole statement is what makes a multi-write statement deterministic
despite an unspecified execution order — a genuinely good bargain, and the reason these
statements are safe to use at all. The price is that the pipeline does not compose the way
a script does: no step can read another's writes, so the pattern only fits straight
pipelines. Push past that fit and the failure is silent rather than loud — a lost update
that no error, no isolation level and no lock will surface.

## Gotchas

**Symptom:** a `SELECT` in the same statement does not see rows a CTE just inserted
**Cause:** every part of the statement shares one pre-statement snapshot
**Fix:** read the write's `RETURNING` output instead of re-reading the table. Measured:
`visible_to_sibling: 0`, `visible_via_returning: 1`, and 1 row present afterwards

**Symptom:** two `UPDATE` CTEs on the same row, and one update vanished
**Cause:** both matched the same snapshot; the second found the row already updated by the
same command and skipped it, reporting 0 rows
**Fix:** merge into one `UPDATE`, or make the row sets disjoint. Measured: `a: 1`, `b: 0`,
final value 1, no error

**Symptom:** the lost update persists under `SERIALIZABLE`
**Cause:** there is only one transaction — isolation levels govern concurrency between
transactions, not two writes inside one statement
**Fix:** restructure the statement. No isolation level or lock helps here

**Symptom:** reordering the CTEs did not change which write won
**Cause:** CTE execution order is not specified; textual order is not execution order
**Fix:** do not encode ordering in CTE position. Use separate statements when order matters

**Symptom:** a conditional second write needs a value the first produced
**Cause:** a single statement cannot branch on its own intermediate writes in application
code
**Fix:** either express the condition in SQL (`CASE`, a `WHERE` on the `RETURNING` set), or
split into two statements inside a transaction

## Interview questions

**★ Can a `SELECT` in the same statement see rows written by a data-modifying CTE?**
No. All parts of a statement share one snapshot taken before it ran, so the write is
invisible to siblings. The only view of it is the write's own `RETURNING`. Measured: a
sibling `SELECT` counted 0 while `RETURNING` counted 1, and the row was there afterwards.

**★ Why is the snapshot shared rather than each CTE seeing the previous one's writes?**
Because CTE execution order is unspecified. If siblings could observe each other's writes,
the result would depend on scheduling and the same statement could return different answers
on different runs. One snapshot makes the outcome deterministic.

**★ What happens if two CTEs update the same row?**
One update is silently lost — no error. Measured: `a` reported 1 row, `b` reported 0, and
the final value came from `a`. The second `UPDATE` matched the old snapshot, found the row
already updated by the same command, and skipped it.

**★ Can `SERIALIZABLE` or `SELECT FOR UPDATE` prevent that?**
No. Both address conflicts *between transactions*, and here both writes are in one
statement in one transaction. The only fix is to restructure — one `UPDATE`, disjoint row
sets, or separate statements in a transaction.

**★ When do you use a transaction instead of one multi-CTE statement?**
When a later step must read what an earlier one wrote, when the branch is decided in
application code, when the same rows are written twice, or when the work should be batched
rather than held in one long statement.

**Does the snapshot rule mean constraints are not checked until the end?**
No — visibility and integrity are separate. Unique, foreign-key and check constraints are
enforced as the writes happen, and a violation fails the whole statement, rolling back
every part of it.

---

← [One statement, several writes](01-one-statement-many-writes.md) · Next topic → [Subqueries](../subqueries/)
