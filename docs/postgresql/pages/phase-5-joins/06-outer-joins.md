---
title: "RIGHT and FULL OUTER"
sidebar_label: "06 · OUTER"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**`RIGHT JOIN` is `LEFT JOIN` with the tables written in the other order — worth
recognising, rarely worth writing. `FULL OUTER JOIN` is the one with no substitute: it
keeps unmatched rows from *both* sides, which makes it the reconciliation tool.**

## RIGHT is LEFT with the operands swapped

```sql
SELECT c.name, o.id
FROM j_orders o
RIGHT JOIN j_customers c ON o.customer_id = c.id
ORDER BY c.id, o.id;
```

```console
$ node ex35-joins.mjs
=== 6. RIGHT and FULL OUTER ===
RIGHT JOIN               : [{"name":"Ann","id":10},{"name":"Ann","id":11},
                            {"name":"Bob","id":12},{"name":"Cid","id":13},
                            {"name":"Dee","id":null}]
```

Identical to the `LEFT JOIN` output on [page 02](left-join/) — same five rows, same
`Dee / null`. The only difference is which table is named first.

That is the entire argument against it: a reader scanning `FROM j_orders o RIGHT JOIN
j_customers c` has to hold the reversal in their head to see that customers is the
preserved side. Writing `FROM j_customers c LEFT JOIN j_orders o` says it in reading
order. Everything from page 02 transfers unchanged, with the sides swapped — including the
`WHERE`-versus-`ON` bug, which for a `RIGHT JOIN` means a condition on the **left** table
is the one that silently cancels it.

`RIGHT` earns its keep in one situation: the FROM order is fixed by something you do not
control — a generated query, a view you are extending, or a chain where the driving table
must come first for other joins to reference it. Then `RIGHT JOIN` preserves the table you
care about without restructuring the statement.

`LEFT OUTER JOIN`, `RIGHT OUTER JOIN` and `FULL OUTER JOIN` are the full spellings;
`OUTER` is optional in all three and universally dropped except for `FULL`.

## FULL OUTER: unmatched rows from both sides

```sql
SELECT c.name, o.id
FROM j_customers c
FULL OUTER JOIN j_orders o ON o.customer_id = c.id
WHERE c.id IS NULL OR o.id IS NULL
ORDER BY c.id NULLS LAST, o.id;
```

```console
FULL OUTER               : [{"name":"Dee","id":null},{"name":null,"id":14}]
  ^ only the unmatched rows from both sides: Dee has no order, order 14 has no customer
```

Two rows, and they are the two failures: **Dee is a customer with no order**, and **order
14 has no customer** (the NULL-FK row inserted back on
[page 03](semi-anti/)). Without the `WHERE` this returns all matched pairs as well;
with it you get a pure exception report.

That `WHERE c.id IS NULL OR o.id IS NULL` is the standard "symmetric difference" filter —
neither side matched the other. It is the only join shape that finds both directions in one
pass, which is why it is the tool for:

- **Reconciliation** — rows in the ledger with no bank line, and bank lines with no ledger
  row, in one query.
- **Migration verification** — old table full outer joined to new on the business key,
  filtered to unmatched, gives both "lost" and "unexpected" rows at once.
- **Diffing two snapshots** — extend the `WHERE` to
  `c.id IS NULL OR o.id IS NULL OR a.col IS DISTINCT FROM b.col` and you have added,
  removed, and changed.

Use `IS DISTINCT FROM` rather than `<>` for the changed case: with NULLs on either side,
`<>` yields NULL and the differing row is silently dropped
([NULL semantics](../phase-2-types/06-null.md)).

`FULL OUTER JOIN` requires a real join condition. `ON true` is legal but degenerates to a
cross join, and PostgreSQL rejects a full join whose condition it cannot use for a merge or
hash — an inequality condition raises `FULL JOIN is only supported with merge-joinable or
hash-joinable join conditions`.

### Why that restriction exists

A `LEFT JOIN` can always fall back to a nested loop: scan the left side, probe the right
for each row, and emit a NULL-extended row when no probe succeeds. Tracking "did this left
row match?" is free because the loop is driven by the left side.

A full join has to track unmatched rows on **both** sides, and the right side is not being
iterated in an order that makes that bookkeeping cheap. The hash and merge implementations
both give it for free — a hash join can mark hash-table entries as hit and sweep the
unhit ones afterwards; a merge join sees both sorted streams and knows when either side
skips. A nested loop has no equivalent, so PostgreSQL simply does not implement full joins
that way. Equality conditions are what make hashing and merging possible, hence the rule.

The practical consequence: if you need a full outer join on an inequality or a range
condition, you must emulate it.

### Emulating it

```sql
-- matched pairs plus left-only rows
SELECT c.name, o.id FROM j_customers c
LEFT JOIN j_orders o ON o.customer_id = c.id
UNION ALL
-- right-only rows
SELECT NULL, o.id FROM j_orders o
WHERE NOT EXISTS (SELECT 1 FROM j_customers c WHERE c.id = o.customer_id);
```

`UNION ALL`, never `UNION` — the branches are disjoint by construction, so deduplicating
would only cost the 3.5× measured on [set operations](11-set-ops.md). The cost against a
real full join is scanning the right side twice, which is why this is a fallback rather
than a style choice.

## Which side is NULL?

After a full outer join you cannot tell an unmatched row from a matched row whose column
happens to be NULL, unless you test a `NOT NULL` column — normally the primary key. That is
also how you write a coalesced key:

```sql
SELECT coalesce(a.business_key, b.business_key) AS key,
       CASE WHEN b.business_key IS NULL THEN 'only_in_a'
            WHEN a.business_key IS NULL THEN 'only_in_b'
            ELSE 'both' END AS side
FROM old_snapshot a
FULL OUTER JOIN new_snapshot b ON b.business_key = a.business_key;
```

### `USING` with a full join does the coalesce for you

```sql
SELECT id, a.val AS a_val, b.val AS b_val
FROM snapshot_a a FULL OUTER JOIN snapshot_b b USING (id);
```

With `USING`, the merged join column holds `coalesce(a.id, b.id)` automatically — so `id`
is never NULL for a row that exists on either side. That removes the most tedious part of
writing a diff query, and it is the one place `USING` is clearly better than `ON` rather
than merely shorter ([ON vs USING vs NATURAL](08-on-using-natural.md)).

## From Node

```js
const {rows} = await pool.query(
  `SELECT coalesce(l.ref, b.ref) AS ref, l.amount AS ledger, b.amount AS bank
   FROM ledger l
   FULL OUTER JOIN bank_lines b ON b.ref = l.ref
   WHERE l.ref IS NULL OR b.ref IS NULL OR l.amount IS DISTINCT FROM b.amount
   ORDER BY 1`,
);
rows.forEach(r => {
  if (r.ledger === null) console.log(`unmatched bank line ${r.ref}`);
  else if (r.bank === null) console.log(`unmatched ledger row ${r.ref}`);
  else console.log(`amount mismatch on ${r.ref}: ${r.ledger} vs ${r.bank}`);
});
```

Every branch keys off a `null` the join manufactured — which is safe here only because
`ref` is `NOT NULL` in both tables.

## Trade-off

`FULL OUTER JOIN` does in one pass what otherwise takes two anti-joins plus a `UNION ALL`,
and it reads as the single question it is. The costs are real though: the planner can only
use merge or hash strategies for it, so an unindexed or non-equality condition is a hard
failure rather than a slow plan; and the result carries NULLs from both sides, so every
downstream expression needs `coalesce` or `IS DISTINCT FROM`. For `RIGHT JOIN` the
trade-off is one-sided — you gain nothing over `LEFT` except when the FROM order is not
yours to choose, and you pay in reviewer attention.

## Gotchas

**Symptom:** A `RIGHT JOIN` returns only matched rows
**Cause:** A condition on the **left** table sits in `WHERE` — the mirror of the LEFT JOIN
bug
**Fix:** Move it into `ON`, or rewrite as a `LEFT JOIN` with the tables swapped

**Symptom:** `ERROR: FULL JOIN is only supported with merge-joinable or hash-joinable
join conditions`
**Cause:** An inequality or otherwise non-equijoin `ON` condition
**Fix:** Rewrite as two anti-joins plus `UNION ALL`, or reduce the condition to equality
and filter afterwards

**Symptom:** A diff query misses rows that clearly changed
**Cause:** `a.col <> b.col` is NULL when either side is NULL, so the row is dropped
**Fix:** `a.col IS DISTINCT FROM b.col`

**Symptom:** After a full outer join, "which side is missing" logic misfires
**Cause:** Testing a nullable column, so a stored NULL looks like an unmatched row
**Fix:** Test the primary key or another `NOT NULL` column

## Interview questions

**★ What is the difference between `LEFT` and `RIGHT JOIN`?**
Only which table's rows are preserved, and they are the same query with the operands
swapped — the measurement above produced byte-identical output. Prefer `LEFT` so the
preserved table is the one you read first.

**★ When do you actually need `FULL OUTER JOIN`?**
When unmatched rows on *both* sides matter: reconciliation, migration verification,
snapshot diffing. Filtered with `WHERE a.pk IS NULL OR b.pk IS NULL` it returns exactly
the exceptions — on the fixture, the customer with no order and the order with no
customer.

**★ Why can a `FULL OUTER JOIN` fail with an error a `LEFT JOIN` accepts?**
It is only implemented for merge- and hash-joinable conditions. A `LEFT JOIN` can fall
back to a nested loop with an arbitrary condition; a full join cannot.

**How do you tell an unmatched row from a matched row with a NULL column?**
Test a `NOT NULL` column — usually the primary key. There is no other signal; the join
manufactures NULLs indistinguishable from stored ones.

**Can you emulate `FULL OUTER JOIN` without it?**
Yes: `LEFT JOIN` plus the reverse anti-join, combined with `UNION ALL`. The branches are
disjoint so `UNION ALL` is correct and avoids the deduplication cost. That is the fallback
when the condition is not hash- or merge-joinable, and it scans the right side twice.

**Why is `FULL OUTER JOIN` restricted to hash- and merge-joinable conditions?**
It must track unmatched rows on both sides. Hash joins can mark hit entries and sweep the
rest; merge joins see both sorted streams. A nested loop, which is what an arbitrary
condition would require, has no cheap way to know which right-hand rows were never matched,
so PostgreSQL does not implement it.

**What does `USING` add to a full outer join specifically?**
The merged column is `coalesce(left.col, right.col)`, so the key is non-NULL for any row
present on either side — exactly what a diff or reconciliation query needs, without writing
the `coalesce` yourself.

---

← [Reading N-N relationships](05-nn-join-table.md) · Next → [CROSS JOIN](07-cross-join.md)
