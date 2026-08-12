---
title: "Table inheritance, and why partitioning replaced it"
sidebar_label: "19 · Inheritance"
sidebar_position: 19
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex12-ddl-rest.mjs`.

**Table inheritance is a PostgreSQL feature that predates declarative partitioning
and was the way to partition before PostgreSQL 10. Its fatal flaw is that
constraints are not inherited — so the parent's primary key does not constrain the
children at all.**

You need this page for two reasons: reading an older schema, and understanding why
partitioning is not "inheritance with nicer syntax".

## The flaw, measured

```sql
CREATE TABLE inh_parent (id int PRIMARY KEY, region text);
CREATE TABLE inh_child (CHECK (region = 'eu')) INHERITS (inh_parent);
INSERT INTO inh_child VALUES (1, 'eu');
INSERT INTO inh_child VALUES (1, 'eu');   -- same id, again
```

```console
$ node ex12-ddl-rest.mjs
=== 8. table inheritance vs declarative partitioning ===
inheritance: duplicate id in child accepted → 2 rows — parent PK is not inherited
SELECT from parent sees children: 2 rows
```

**Two rows with id 1**, in a hierarchy whose parent declares `id` a primary key.
The parent's index covers only the parent's own rows; each child would need its own
`PRIMARY KEY`, and even then nothing enforces uniqueness *across* children.

`NOT NULL` and `CHECK` constraints are inherited. **Primary keys, unique constraints
and foreign keys are not.** So an inherited hierarchy cannot guarantee a unique id,
and no other table can reliably reference it — a foreign key pointing at the parent
does not see rows stored in children.

Querying the parent does return children's rows (2 rows above), which is the part
that works and the reason the feature looked like partitioning.

## Declarative partitioning enforces the key

```sql
CREATE TABLE part_t (id int, region text, PRIMARY KEY (id, region))
  PARTITION BY LIST (region);
CREATE TABLE part_eu PARTITION OF part_t FOR VALUES IN ('eu');
```

```console
partitioning: duplicate → 23505 — the key IS enforced
no matching partition → 23514 no partition of relation "part_t" found for row
```

Two differences that matter:

- **The primary key is enforced across partitions** — the duplicate raises `23505`.
- **A row with no matching partition is rejected** with `23514`, rather than being
  silently accepted into the parent as inheritance would allow.

The catch is in the declaration: **the partition key must be part of every unique
constraint.** That is why the key above is `(id, region)` and not `(id)`. PostgreSQL
cannot enforce global uniqueness on `id` alone, because it would have to check every
partition on every insert. If you need a globally unique `id` *and* partitioning, the
id has to be generated centrally (a sequence or UUID) and its uniqueness accepted on
trust rather than enforced.

That constraint is the single biggest surprise when adopting partitioning, and it
frequently changes the schema design.

## Choosing

**Use declarative partitioning** when a table is large enough that you want to drop
old data by detaching a partition (instant, versus a `DELETE` that must be
vacuumed), or when queries reliably filter on the partition key so the planner can
prune.

**Use neither** for most tables. Partitioning adds planning overhead, a constraint on
your keys, and operational work — creating next month's partition is now a recurring
job. Below tens of millions of rows, a good index almost always beats it.

**Use inheritance** essentially never for new work. Its remaining niche is modelling
genuine type hierarchies where you want `SELECT` on the parent to span children and
you do not need cross-table key enforcement — and even then, a shared table with a
discriminator column or separate tables joined to a common one is usually clearer.

## Reading an inherited schema

```sql
-- children of a table
SELECT c.relname FROM pg_inherits i
  JOIN pg_class c ON c.oid = i.inhrelid
  JOIN pg_class p ON p.oid = i.inhparent
 WHERE p.relname = 'inh_parent';

SELECT * FROM ONLY inh_parent;   -- exclude children
```

`ONLY` is the keyword to know: without it, `SELECT`, `UPDATE` and `DELETE` on the
parent all include the children. A `DELETE FROM parent` that the author believed was
scoped to the parent's own rows will remove children's rows too — an easy way to lose
data in an inherited schema.

`pg_inherits` also backs declarative partitioning, so its presence does not tell you
which feature is in use; check `relkind = 'p'` on the parent for a partitioned table.

## Trade-off

Inheritance offers a flexible hierarchy at the cost of the guarantees that make a
relational database worth using — no cross-table uniqueness, no usable foreign keys.
That trade is almost never worth it, which is why declarative partitioning exists.

Partitioning restores the guarantees and takes flexibility away instead: your unique
keys must include the partition key, and partition management becomes an operational
task. Those are real costs, paid for real benefits (instant bulk deletion, pruning) —
which is why partitioning is a decision about data volume and lifecycle, not a
default.

## Gotchas

**Symptom:** Duplicate primary-key values in an inherited hierarchy
**Cause:** Primary keys are not inherited — measured, two rows with id 1.
**Fix:** Declarative partitioning, which enforces the key across partitions.

**Symptom:** A foreign key referencing an inherited parent misses rows
**Cause:** Foreign keys see only the parent's own rows, not children's.
**Fix:** Do not reference inherited hierarchies; restructure.

**Symptom:** `DELETE FROM parent` removed rows from child tables
**Cause:** Statements on a parent include children unless you write `ONLY`.
**Fix:** `DELETE FROM ONLY parent`.

**Symptom:** `23514 no partition of relation … found for row`
**Cause:** The value falls outside every defined partition.
**Fix:** Create the partition, or add a `DEFAULT` partition — and monitor it, since
rows landing there are usually a missing-partition bug.

**Symptom:** `unique constraint on partitioned table must include all partitioning
columns`
**Cause:** A unique key that does not contain the partition key.
**Fix:** Add the partition key to the constraint, or generate ids centrally and give
up enforced global uniqueness.

**Symptom:** Partitioned queries are slower than expected
**Cause:** The query does not filter on the partition key, so every partition is
scanned.
**Fix:** Filter on the partition key, or reconsider whether partitioning helps this
access pattern.

## Interview questions

**★ Why did declarative partitioning replace table inheritance?**
Because constraints are not inherited. Measured: a parent declaring `id` as primary
key accepted two child rows with id 1. Unique constraints and foreign keys do not
span an inherited hierarchy, so the schema cannot guarantee identity or be
referenced. Partitioning enforces the key across partitions — the duplicate raises
`23505`.

**★ What is the biggest constraint when adopting partitioning?**
Every unique constraint must include the partition key. A globally unique `id` alone
is not enforceable, because that would mean checking every partition on every
insert. Schemas often have to change to accommodate it.

**★ What happens to a row that matches no partition?**
`23514 no partition of relation … found for row` — it is rejected. A `DEFAULT`
partition can catch them, but rows arriving there usually indicate a partition that
should have been created.

**★ What does `ONLY` do?**
Restricts a statement to the named table, excluding children or partitions. Without
it, `SELECT`, `UPDATE` and `DELETE` on a parent include everything beneath it —
which is how a `DELETE` intended for the parent deletes children's rows.

**★ When is partitioning actually worth it?**
When you need to drop old data by detaching a partition instead of a `DELETE` that
must then be vacuumed, or when queries reliably filter on the partition key so the
planner can prune. Below tens of millions of rows a good index usually wins, and
partitioning adds planning overhead plus the recurring job of creating partitions.

---

← [Deferrable constraints](18-deferrable.md) · Next → [Phase 4 · CRUD and DML](../phase-4-crud/)
