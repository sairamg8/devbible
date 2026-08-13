---
title: "Data-modifying CTEs"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**A CTE can write, not just read. `WITH moved AS (DELETE … RETURNING *) INSERT INTO archive
SELECT * FROM moved` moves rows between tables in one atomic statement with no transaction
and no half-done state. The feature is small; the rules about what each part of the
statement can *see* are where it goes wrong, and they cost a silent lost update if you get
them wrong.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[One statement, several writes](01-one-statement-many-writes.md)** | the archive pattern, `RETURNING` as the pipeline, upsert-plus-audit, and why an unreferenced write CTE still runs |
| 02 | **[The snapshot rule](02-the-snapshot-rule.md)** | why a sibling `SELECT` cannot see the write, two CTEs updating one row losing one silently, and when to use a transaction instead |

## The three rules

1. **A write CTE always runs**, referenced or not — it is a promised side effect, not dead
   code the planner may discard.
2. **Its effect is visible only through its own `RETURNING`.** Re-reading the table gives
   the pre-statement snapshot.
3. **Execution order is not specified**, so two writes touching the same row are a bug that
   no error will report.

## Phase gate

You are done when you can write the archive pattern from memory, say what a sibling
`SELECT` sees, and explain why no isolation level fixes two CTEs updating the same row.

## Where this connects

- **[CTEs (WITH)](../09-ctes/README.md)** — the read-only form, and the inlining rule that data-modifying
  CTEs are permanently excluded from
- **[ON CONFLICT](../../phase-4-crud/06-on-conflict.md)** — the upsert, and `xmax = 0` for
  telling insert from update
- **[DELETE](../../phase-4-crud/11-delete.md)** — why `DELETE` needs a CTE to get a `LIMIT`
- **[UPDATE … FROM](../../phase-4-crud/07-update.md)** — the duplicate-source problem
  `MERGE` reports and this one does not
- **[Lost updates](../../phase-11-mvcc/04-lost-update.md)** — the concurrent cousin, and the
  four fixes that work there but not here
- **[Transactions](../../phase-11-mvcc/README.md)** — where to go when a later step must read an
  earlier one's write

---

← [Phase index](../README.md) · Start → [One statement, several writes](01-one-statement-many-writes.md)
