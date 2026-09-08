---
title: "REFERENCES and FOREIGN KEY are one constraint with two spellings, and the number of columns decides which spelling you are allowed"
sidebar_label: "03b · REFERENCES vs FOREIGN KEY"
sidebar_position: 3.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the **PostgreSQL 18** documentation —
> [CREATE TABLE](https://www.postgresql.org/docs/18/sql-createtable.html) and
> [Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).
> Documentation-validated; **no sandbox run**.

**`REFERENCES` is not a lighter alternative to `FOREIGN KEY`. It is the same constraint
written beside one column instead of underneath several, and the grammar only lets you
choose while the key is a single column.** Everything else people believe decides the
spelling — wanting to name it, wanting cascades, wanting it to be deferrable — decides
nothing.

## The two spellings

Both clauses come from the same `CREATE TABLE` grammar. The column form:

```text
REFERENCES reftable [ ( refcolumn ) ] [ MATCH matchtype ]
    [ ON DELETE referential_action ] [ ON UPDATE referential_action ]
```

The table form, which adds a list of the *referencing* columns at the front:

```text
FOREIGN KEY ( column_name [, ... ] ) REFERENCES reftable [ ( refcolumn [, ... ] ) ]
    [ MATCH matchtype ] [ ON DELETE referential_action ] [ ON UPDATE referential_action ]
```

Everything from `REFERENCES` onward is identical. These two tables are the same schema:

```sql
-- column constraint: the key is one column, so it can sit on that column
CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers (id) ON DELETE RESTRICT
);

-- table constraint: the same constraint, written separately
CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT
);
```

The equivalence runs one way only, and the documentation says so:

> *"Column constraints can also be written as table constraints, while the reverse is
> not necessarily possible, since a column constraint is supposed to refer to only the
> column it is attached to."*

So the table form is the general one and the column form is the convenience. Reading a
schema, `REFERENCES` on a column tells you the key is single-column without your having
to check — which is worth something, and is the only real argument for preferring it.

## Dropping the column list entirely

The `refcolumn` list is optional in both forms:

```sql
product_no integer REFERENCES products
```

> *"If the `refcolumn` list is omitted, the primary key of the `reftable` is used."*

Convenient, and it is what most ORMs emit. It also means the schema no longer states
what it points at — a reader has to open the parent table to find out, and a parent with
no primary key makes the statement fail rather than fall back to a unique constraint.
**Write the column list in schema files you expect humans to read.** The saving is four
tokens; the cost is that `git blame` on a schema stops being self-contained.

## What the parent side has to be

Not any column will do:

> *"the `refcolumn` list must refer to the columns of a non-deferrable unique or primary
> key constraint or be the columns of a non-partial unique index."*

Three things follow, and each one surprises somebody:

- A plain `CREATE INDEX` on the parent is **not** enough. It must be `UNIQUE`. An index
  makes the lookup fast; only uniqueness makes the reference *meaningful*, because a
  non-unique target could match several parent rows and there would be no answer to
  "which one does this child belong to".
- A **partial** unique index cannot be a foreign key target. This is the one that bites
  soft-delete schemas, where the natural key is `UNIQUE (email) WHERE deleted_at IS NULL`
  — nothing can reference it, and the fix is to reference the surrogate key instead.
- A `DEFERRABLE` unique constraint on the parent cannot be referenced either, even
  though the *foreign key* itself is allowed to be deferrable
  ([Deferrable constraints](18-deferrable.md)). The two `DEFERRABLE`s are on different
  constraints and only one of them is permitted.

## A composite key forces the table form

This is the actual rule behind "which spelling am I allowed":

> *"A foreign key can also constrain and reference a group of columns. As usual, it then
> needs to be written in table constraint form."*

```sql
-- ✗ impossible: a column constraint can only speak for its own column
CREATE TABLE invoice_lines (
  invoice_id bigint,
  currency   char(3) REFERENCES invoices (id, currency)   -- nonsense
);

-- ✓ the table form names both referencing columns
CREATE TABLE invoice_lines (
  invoice_id bigint  NOT NULL,
  currency   char(3) NOT NULL,
  FOREIGN KEY (invoice_id, currency) REFERENCES invoices (id, currency)
);
```

The number and type of the constrained columns must match the referenced ones. This
shape is not academic — it is how you stop a line item drifting to a different currency
than its invoice, and the corpus uses it exactly there
([Storing money](../phase-2-types/17-modelling-money/01-storing-money.md)).

Going composite also switches on a rule that does not exist for single-column keys:
`MATCH`, and its default lets rows through. That is
[the next page](03c-match-and-column-subsets.md), and it is the part people get wrong.

## Naming is not a reason to reach for the table form

A common belief is that you must use `FOREIGN KEY` to name a constraint. You do not —
`CONSTRAINT` prefixes a column constraint just as well:

```sql
customer_id bigint NOT NULL
  CONSTRAINT orders_customer_fk REFERENCES customers (id) ON DELETE RESTRICT
```

Without it you get PostgreSQL's generated `orders_customer_id_fkey`, which is at least
parseable in `err.constraint` ([Naming conventions](11-naming.md)).

What *does* force the table form, besides a composite key, is `ALTER TABLE`: it adds
table constraints, so every foreign key added to a table that already exists is written
the long way.

```sql
ALTER TABLE orders
  ADD CONSTRAINT orders_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id);
```

That is the whole reason migration files and initial schema files look different — same
constraint, same catalog entry, no significance to the change of spelling. It is also
why the safe-migration sequence in
[Expand and contract](../phase-13-ops/12-zero-downtime-ddl/02-expand-and-contract.md)
is written the long way throughout: it has no other option.

## Which spelling to use

- **Single-column key, written in `CREATE TABLE`** → the column form. It puts the fact
  next to the column it constrains, and its shortness carries information: this key is
  one column.
- **Composite key** → the table form. You have no choice, and you now also owe a
  decision about `MATCH`.
- **Anything added later** → the table form via `ALTER TABLE ADD CONSTRAINT`, with a
  name you chose.
- **Always write the referenced column list**, even where the primary key shorthand
  would work. One extra clause, and the schema stops requiring a second file to read.

## Trade-off

The column form is denser and self-documenting about arity; the table form is uniform,
so a schema written entirely in it diffs cleanly and never has to be rewritten when a
key gains a second column. Mixed is normal and fine — what is not fine is believing the
two mean different things, because that belief produces migrations that "convert" a
constraint from one spelling to the other, taking a lock and changing nothing.

## Gotchas

**Symptom:** `REFERENCES other (a, b)` on a single column is rejected
**Cause:** A column constraint can only constrain the column it is attached to.
**Fix:** Rewrite as `FOREIGN KEY (a, b) REFERENCES other (a, b)` under the columns.

**Symptom:** `there is no unique constraint matching given keys for referenced table`
**Cause:** The parent columns are indexed but not unique, or unique only through a
*partial* index, or through a `DEFERRABLE` unique constraint.
**Fix:** Add a non-deferrable `UNIQUE` or `PRIMARY KEY` on the parent, or a non-partial
unique index. A soft-delete `UNIQUE (email) WHERE deleted_at IS NULL` can never be
referenced — point the child at the surrogate key instead.

**Symptom:** `REFERENCES products` fails on a table that clearly has the rows
**Cause:** The shorthand resolves to the parent's *primary key*, and the parent has
none. There is no fallback to a unique constraint.
**Fix:** Name the columns: `REFERENCES products (sku)` — and give the parent a primary
key while you are there.

**Symptom:** The same foreign key looks different in the schema file and the migration
**Cause:** `ALTER TABLE` adds table constraints, so it can only be written the long way.
**Fix:** Nothing. They are the same constraint; do not write a migration to "normalise"
one into the other.

**Symptom:** Two developers disagree about whether a schema has a foreign key, both
looking at the same file
**Cause:** The column form hides at the end of a long column definition, past the type,
`NOT NULL` and a default.
**Fix:** Put referential actions on their own line, or use the table form for keys that
matter enough to argue about.

**Symptom:** An ORM-generated schema has foreign keys you cannot find by grepping for
`FOREIGN KEY`
**Cause:** Most emit the column form with no column list — `REFERENCES products`.
**Fix:** Grep for `REFERENCES` instead, or read them out of the catalog with `\d
tablename`, which prints every constraint in the long form regardless of how it was
written.

**Symptom:** A column is dropped and a foreign key silently disappears with it
**Cause:** Dropping a column drops the column constraints attached to it. A composite
table constraint would have blocked the drop instead.
**Fix:** Expect it — the constraint was scoped to that column. Check `\d` after any
`DROP COLUMN` on a table that participates in relationships.

## Interview questions

**★ What is the difference between `REFERENCES` and `FOREIGN KEY`?**
None, as constraints. `REFERENCES` is the column-constraint spelling and
`FOREIGN KEY (...) REFERENCES ...` is the table-constraint spelling of the same thing;
everything after the `REFERENCES` keyword — the parent table, the column list, `MATCH`,
`ON DELETE`, `ON UPDATE` — is identical grammar, and both produce the same catalog
entry. The column form is only available when the key is a single column, because a
column constraint may refer only to the column it is attached to.

**★ When are you forced to use the table form?**
When the key spans more than one column, and when you are adding the constraint with
`ALTER TABLE`, which takes table constraints. Naming is *not* a reason:
`CONSTRAINT name REFERENCES ...` is legal on a column, and so are `ON DELETE`,
`ON UPDATE`, `MATCH` and `DEFERRABLE`.

**★ What does `REFERENCES products` with no column list do?**
It references the primary key of `products`. If `products` has no primary key the
statement fails — it does not fall back to a unique constraint. Write the column list
anyway: the shorthand makes the schema unreadable without opening the parent.

**★ What can a foreign key point at?**
The columns of a non-deferrable unique or primary key constraint, or the columns of a
non-partial unique index. A plain index is not enough — uniqueness is what makes the
reference resolve to exactly one parent row — and a partial unique index, the usual
soft-delete pattern, cannot be referenced at all.

**Why do the schema file and the migration spell the same foreign key differently?**
`CREATE TABLE` can attach the constraint to a column; `ALTER TABLE ADD CONSTRAINT` adds
a table constraint and has no column to attach to. Same constraint, different statement.

**If both spellings are the same, why does the corpus prefer the column form in
`CREATE TABLE`?**
Because the spelling carries information for free: seeing `REFERENCES` on a column tells
a reader the key is single-column, without reading the rest of the table. That is the
only advantage, and it disappears the moment the key goes composite.

---

← [Foreign keys](03-foreign-keys.md) · Next → [`MATCH` and column subsets](03c-match-and-column-subsets.md)
