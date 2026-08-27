---
title: "Adding a column, a CHECK constraint or a foreign key to a live table each have a safe form and an obvious form, and they are never the same statement — PostgreSQL 18's NOT VALID clause now covers NOT NULL as well, which removes the last common excuse for the long scan"
sidebar_label: "08a · Adding columns and constraints safely"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's `ALTER TABLE`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-altertable.html)),
> `CREATE INDEX`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-createindex.html)),
> the PostgreSQL 18 release notes
> ([postgresql.org](https://www.postgresql.org/docs/18/release-18.html))
> and Flyway 12's `PostgreSQLParser`
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/tree/main/flyway-database/flyway-database-postgresql)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[08](08-migrating-a-live-service.md) gave the rule. This is the catalogue for the additive half —
columns, `CHECK` constraints and foreign keys, which is to say everything `NOT VALID` makes cheap.
Every entry has the same shape: the statement everybody writes, which takes a lock and scans or
rewrites the table, and the statement that does the same thing in two cheap steps. PostgreSQL 18
changed one of them: `NOT NULL` constraints can now be `NOT VALID`, which is genuinely new and
removes the workaround most existing advice still teaches. Indexes and enum values get none of this
and are in [08a2](08a2-adding-indexes-and-enum-values.md).**

## Add a nullable column — safe, one deployment

```sql
ALTER TABLE customers ADD COLUMN full_name text;
```

PostgreSQL is explicit that this needs no rewrite, and neither does adding a column with a
**non-volatile** default:

> *"In neither case is a rewrite of the table required."*

So `ADD COLUMN status text NOT NULL DEFAULT 'pending'` is also cheap — the default is stored as
metadata and materialised as rows are read. That is the modern behaviour and it is worth knowing,
because a lot of advice still says to add the column, backfill and then set the default.

⚠️ **The exceptions all rewrite the entire table and its indexes**, quoted:

> *"will cause the entire table and its indexes to be rewritten"* — a **volatile** default, a
> **stored** generated column, an identity column, or a domain type with constraints.

`DEFAULT now()` and `DEFAULT gen_random_uuid()` are volatile. That is the single most common way an
"instant" migration becomes a table rewrite.

✅ **PostgreSQL 18 default:** *"Adding a virtual generated column never requires a rewrite"* — and
virtual is now the default kind of generated column, so a generated column is cheap unless you ask
for `STORED`.

## Add a `NOT NULL` column to a populated table

The obvious statement fails, because the existing rows are `NULL`. The traditional sequence is four
steps; PostgreSQL 18 makes it cheaper.

**Deploy 1** — add it nullable, and start writing it:

```sql
ALTER TABLE customers ADD COLUMN region text;
```

**Deploy 2** — backfill, then constrain **without the scan**:

```sql
UPDATE customers SET region = 'unknown' WHERE region IS NULL;   -- in batches on a big table

ALTER TABLE customers ADD CONSTRAINT customers_region_nn
    NOT NULL region NOT VALID;
```

🔴 **`NOT VALID` on a `NOT NULL` constraint is new in PostgreSQL 18.** The release notes list
*"Allow ALTER TABLE to set the `NOT VALID` attribute of `NOT NULL` constraints"*, and `NOT VALID` is
documented as *"currently only allowed for foreign-key, `CHECK`, and not-null constraints"*. Before
18 the only way to avoid the scan was the `CHECK`-constraint trick below.

**Deploy 3** — validate, under a much weaker lock:

```sql
ALTER TABLE customers VALIDATE CONSTRAINT customers_region_nn;
```

> *"This command acquires a `SHARE UPDATE EXCLUSIVE` lock."*

`SHARE UPDATE EXCLUSIVE` does not block reads or writes, which is the whole point of splitting it.

⚠️ **`SET NOT NULL` on its own scans the table** unless you say otherwise:

> *"Ordinarily this is checked during the `ALTER TABLE` by scanning the entire table, unless `NOT
> VALID` is specified; however, if a valid `CHECK` constraint exists (and is not dropped in the same
> command) which proves no `NULL` can exist, then the table scan is skipped."*

That second clause is the pre-18 workaround, and it still works: add `CHECK (region IS NOT NULL)
NOT VALID`, validate it, then `SET NOT NULL` skips the scan. On 18 the direct form is simpler.

## Add a `CHECK` constraint

Same two-step, same reason:

```sql
ALTER TABLE orders ADD CONSTRAINT orders_total_positive
    CHECK (total >= 0) NOT VALID;

-- separately, later
ALTER TABLE orders VALIDATE CONSTRAINT orders_total_positive;
```

> *"Normally, this form will cause a scan of the table to verify that all existing rows in the table
> satisfy the new constraint. But if the `NOT VALID` option is used, this potentially-lengthy scan is
> skipped. The constraint will still be applied against subsequent inserts or updates."*

So `NOT VALID` is not "unenforced" — new and modified rows are checked from the moment it exists.
What is deferred is the assertion about *existing* rows.

⚠️ **A `NOT VALID` constraint that is never validated is a permanent half-measure.** The planner
cannot use it for constraint exclusion, and nothing reminds you. Put the `VALIDATE` in the next
migration, not on a wiki page.

## Add a foreign key

The lock is already weaker than most `ALTER TABLE` forms — the documentation notes `ADD FOREIGN KEY`
takes `SHARE ROW EXCLUSIVE` rather than the usual `ACCESS EXCLUSIVE` — but the *scan* is still
there, so the same split applies:

```sql
ALTER TABLE orders ADD CONSTRAINT orders_customer_fk
    FOREIGN KEY (customer_id) REFERENCES customers (id) NOT VALID;

-- separately
ALTER TABLE orders VALIDATE CONSTRAINT orders_customer_fk;
```

⚠️ **The referenced column needs a unique index**, and creating that index is its own problem —
[08a2](08a2-adding-indexes-and-enum-values.md).

## Gotchas

**★ Adding a column with a non-volatile default is cheap; with a volatile one it rewrites the whole
table.** `DEFAULT 'pending'` is metadata. `DEFAULT now()` or `DEFAULT gen_random_uuid()` is a
rewrite of the table and every index on it.

**★ A `STORED` generated column rewrites the table; a virtual one does not** — and virtual is the
default in PostgreSQL 18.

**★ `NOT NULL` constraints can be `NOT VALID` from PostgreSQL 18.** Most advice online predates
this and teaches the `CHECK`-constraint workaround, which still works but is now the longer route.

**★ `SET NOT NULL` scans the whole table** unless `NOT VALID` is given or a valid `CHECK` already
proves no `NULL` can exist.

**★ `VALIDATE CONSTRAINT` takes `SHARE UPDATE EXCLUSIVE`**, which does not block reads or writes.
That is the entire reason for splitting the operation.

**★ `NOT VALID` does not mean unenforced.** New and updated rows are checked immediately; only the
claim about existing rows is deferred.

**★ A `NOT VALID` constraint nobody validates is a permanent half-measure.** The planner will not
rely on it and nothing reminds you. Schedule the `VALIDATE` as its own migration.

**★ The backfill is the part that needs batching, not the `ALTER`.** Once the constraint is
`NOT VALID` the expensive statement left in the sequence is the `UPDATE`, and a single `UPDATE` over
millions of rows holds one long transaction — which is also what stalls a concurrent index build in
[08a2](08a2-adding-indexes-and-enum-values.md).

**★ `ADD FOREIGN KEY` takes a weaker lock than most `ALTER TABLE` forms** — `SHARE ROW EXCLUSIVE` —
but it still scans, so it still wants `NOT VALID`. The weaker lock is not permission to skip the
split.

## Interview questions

**★ Is adding a column with a default safe on a large table?**
It depends entirely on whether the default is volatile. A constant default is stored as metadata and
requires no rewrite; `now()` or `gen_random_uuid()` has to be evaluated per row, so the table and
all its indexes are rewritten.

**★ How do you add a `NOT NULL` column to a populated table without a long lock?**
Add it nullable, start writing it, backfill the existing rows, add the `NOT NULL` constraint as
`NOT VALID`, and validate it separately. On PostgreSQL 18 `NOT NULL` accepts `NOT VALID` directly;
before 18 you had to add a `NOT VALID` `CHECK`, validate that, and then `SET NOT NULL`, which skips
its scan when a proving `CHECK` exists.

**★ What does `NOT VALID` actually mean?**
That the table is not scanned to prove existing rows satisfy the constraint. New and updated rows
are still checked from the moment the constraint exists — it defers verification of history, not
enforcement.

**★ Why is `VALIDATE CONSTRAINT` cheaper than adding the constraint validated?**
Because it takes a `SHARE UPDATE EXCLUSIVE` lock, which does not block readers or writers. The scan
still happens; it just stops being a blocking one.

**★ What is the risk of leaving a constraint `NOT VALID`?**
It works for enforcement but the planner will not rely on it, so it cannot be used for constraint
exclusion, and nothing will ever tell you it is still pending. It has to be scheduled as its own
migration.

**★ Which constraint types accept `NOT VALID`?**
Foreign-key, `CHECK` and — from PostgreSQL 18 — not-null constraints. Unique and primary-key
constraints do not, which is why the unique case needs the index-first recipe in
[08a2](08a2-adding-indexes-and-enum-values.md) instead.

{/* FOOTER */}
