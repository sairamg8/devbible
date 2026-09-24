---
name: research-postgresql-p3-fk-syntax
description: Banked verbatim PostgreSQL 18 quotes on REFERENCES vs FOREIGN KEY, MATCH types, FK targets and SET NULL/SET DEFAULT column subsets — do not re-derive
metadata:
  type: reference
---

# research — postgresql phase-3 DDL, FK syntax (banked 2026-09-08)

🔴 **Do not re-derive.** Two fetches, PostgreSQL 18 docs. Every load-bearing sentence
in `03b-references-and-foreign-key.md` and `03c-match-and-column-subsets.md` traces to
a quote below.

Sources:
- CREATE TABLE — https://www.postgresql.org/docs/18/sql-createtable.html
- Constraints (tutorial) — https://www.postgresql.org/docs/18/ddl-constraints.html

## Grammar (CREATE TABLE)

Column constraint:
`REFERENCES reftable [ ( refcolumn ) ] [ MATCH matchtype ] [ ON DELETE referential_action ] [ ON UPDATE referential_action ]`

Table constraint:
`FOREIGN KEY ( column_name [, ... ] [, PERIOD column_name ] ) REFERENCES reftable [ ( refcolumn [, ... ] [, PERIOD refcolumn ] ) ] [ MATCH matchtype ] [ ON DELETE referential_action ] [ ON UPDATE referential_action ]`

## Verbatim

> "If the `refcolumn` list is omitted, the primary key of the `reftable` is used."

> "Otherwise, the `refcolumn` list must refer to the columns of a non-deferrable unique
> or primary key constraint or be the columns of a non-partial unique index."

> "There are three match types: `MATCH FULL`, `MATCH PARTIAL`, and `MATCH SIMPLE`
> (which is the default). `MATCH FULL` will not allow one column of a multicolumn
> foreign key to be null unless all foreign key columns are null; if they are all null,
> the row is not required to have a match in the referenced table. `MATCH SIMPLE`
> allows any of the foreign key columns to be null; if any of them are null, the row is
> not required to have a match in the referenced table. `MATCH PARTIAL` is not yet
> implemented."

> "Set all of the referencing columns, or a specified subset of the referencing
> columns, to null."  (`SET NULL [ ( column_name [, ...] ) ]`)

> "Set all of the referencing columns, or a specified subset of the referencing
> columns, to their default values."  (`SET DEFAULT [ ( column_name [, ...] ) ]`)

> "A subset of columns can only be specified for `ON DELETE` actions."

From the Constraints tutorial:

> "Column constraints can also be written as table constraints, while the reverse is
> not necessarily possible, since a column constraint is supposed to refer to only the
> column it is attached to."

> "because in absence of a column list the primary key of the referenced table is used
> as the referenced column(s)."

> "A foreign key can also constrain and reference a group of columns. As usual, it then
> needs to be written in table constraint form."

> "Since a `DELETE` of a row from the referenced table or an `UPDATE` of a referenced
> column will require a scan of the referencing table for rows matching the old value,
> it is often a good idea to index the referencing columns too. Because this is not
> always needed, and there are many choices available on how to index, the declaration
> of a foreign key constraint does not automatically create an index on the referencing
> columns."

## Not settled by the docs, and written as such on the pages

- **No sentence states that the two spellings produce an identical catalog entry.** The
  pages assert equivalence only as far as the quote above licenses it ("column
  constraints can also be written as table constraints"), and never claim `pg_constraint`
  is byte-identical.
- **No rationale is given** for why a column subset is legal on `ON DELETE` but not
  `ON UPDATE`. `03c` says so explicitly rather than inventing one.
- The PostgreSQL version that introduced the `SET NULL (col)` subset was **not checked**
  — the pages pin PG 18 and make no "since version N" claim.

Related: [[project-postgresql-syllabus]]
