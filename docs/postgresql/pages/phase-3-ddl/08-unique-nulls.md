---
title: "Unique constraints vs unique indexes, and NULLs"
sidebar_label: "08 · Unique and NULLs"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex11-ddl-alter.mjs`,
> `ex4-soft-delete.mjs`.

**A unique column accepts unlimited NULLs by default.** Two NULLs are not equal —
they are both "unknown", and two unknowns cannot be shown to be the same — so the
uniqueness rule you thought you declared does not apply to them.

## The default behaviour

```sql
CREATE UNIQUE INDEX uq_default ON uq_t (a);
INSERT INTO uq_t (a) VALUES (NULL), (NULL), (NULL);
```

```console
$ node ex11-ddl-alter.mjs
=== 5. NULLs in a unique column ===
default UNIQUE: 3 NULLs inserted → 3 rows
```

Three NULLs in a unique column, no error. This is SQL-standard behaviour, not a
PostgreSQL quirk, and it is usually what you want: a nullable `phone_number` that is
unique when present should still allow many users to have no phone number.

It stops being what you want when NULL means "not set yet" and you wanted at most
one such row.

## `NULLS NOT DISTINCT` (PostgreSQL 15+)

```sql
CREATE UNIQUE INDEX uq_nnd ON uq_t (a) NULLS NOT DISTINCT;
```

```console
NULLS NOT DISTINCT: second NULL → 23505 uq_nnd
```

Now NULLs are compared as equal to each other, so only one is allowed. It works on
both the index and the constraint form:

```sql
ALTER TABLE uq_t ADD CONSTRAINT uq_a UNIQUE NULLS NOT DISTINCT (a);
```

Before PostgreSQL 15 the workaround was a unique index on `COALESCE(a, '')` — which
only works when a sentinel value exists that the column can never legitimately hold.
`NULLS NOT DISTINCT` needs no sentinel.

## Constraint or index?

They create the same underlying btree. The differences are all about what you can do
around them:

| | `UNIQUE` constraint | Unique index |
|---|---|---|
| Appears in `\d` as | a constraint | an index |
| Can be a foreign key target | **yes** | no |
| Can be partial (`WHERE …`) | no | **yes** |
| Can be on an expression | no | **yes** |
| Can be built `CONCURRENTLY` | not directly | **yes** |
| `ON CONFLICT (col)` works | yes | yes |

Two of those decide most cases:

**A foreign key can only reference a constraint**, not a bare unique index. If
another table will reference these columns, you need the constraint form.

**Only an index can be partial**, which is what soft delete requires — from
[delete hard vs soft](../phase-9-api-crud/09-delete-soft-hard.md):

```console
plain unique index → 23505 sd_users_email_key | Key (email)=(dup@x.com) already exists.
partial unique index → re-registration ok: { id: '5', email: 'dup@x.com' }
```

```sql
CREATE UNIQUE INDEX sd_users_live_email_key ON sd_users (email) WHERE deleted_at IS NULL;
```

Unique among live rows only — impossible with a constraint.

**Only an index can be built `CONCURRENTLY`**, which matters on a live table. The
usual production sequence is to build the index concurrently, then attach it as a
constraint if a foreign key needs one:

```sql
CREATE UNIQUE INDEX CONCURRENTLY users_email_key ON users (email);
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE USING INDEX users_email_key;
```

The `ALTER` is a catalog change over an already-built index, so its `ACCESS
EXCLUSIVE` window is brief.

## Case sensitivity is a separate problem

`UNIQUE (email)` treats `Alice@x.com` and `alice@x.com` as different. Almost no
application wants that. Two fixes:

```sql
-- expression index: only an index can do this
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- or a case-insensitive collation (PostgreSQL 12+)
CREATE COLLATION ci (provider = icu, locale = 'und-u-ks-level2', deterministic = false);
ALTER TABLE users ALTER COLUMN email TYPE text COLLATE ci;
```

Measured in [`ORDER BY`](../phase-4-crud/10-order-by.md): under that collation
`'Apple' = 'apple'` is **true**, against **false** under the default. The collation
route also makes ordinary `WHERE email = $1` case-insensitive, which the expression
index does not — with the expression index you must write
`WHERE lower(email) = lower($1)` for the index to be used at all.

Non-deterministic collations disable some optimisations and forbid `LIKE` on the
column, so apply them per column, never database-wide.

## Trade-off

Declaring uniqueness in the database is the only way to get it under concurrency —
an application check has a window between reading and writing, measured in
[Seeding](../phase-8-schema-from-node/03-seeding.md) as 20 duplicate rows from 20
workers with no errors.

The cost is a btree that every insert and update must maintain, and a schema
decision that is awkward to reverse. The related cost is error handling: a unique
violation surfaces as `23505` at write time rather than as a validation message, so
the application must map it — and it must, because pre-checking cannot be correct.

## Gotchas

**Symptom:** Several rows have NULL in a "unique" column
**Cause:** NULLs are distinct from each other by default — measured, 3 NULLs
accepted.
**Fix:** `NULLS NOT DISTINCT` (PostgreSQL 15+), or a unique index on
`COALESCE(col, sentinel)` before that.

**Symptom:** A foreign key cannot reference a column that clearly has a unique index
**Cause:** Foreign keys require a *constraint*, not a bare index.
**Fix:** `ADD CONSTRAINT … UNIQUE USING INDEX existing_index`.

**Symptom:** Users register twice with the same email in different cases
**Cause:** `UNIQUE (email)` is case-sensitive.
**Fix:** A unique index on `lower(email)`, or a non-deterministic ICU collation.

**Symptom:** The `lower(email)` index is never used
**Cause:** The query says `WHERE email = $1`, which does not match the expression.
**Fix:** `WHERE lower(email) = lower($1)`, or use the collation approach instead.

**Symptom:** A soft-deleted row blocks re-registration
**Cause:** A full unique index counts tombstoned rows.
**Fix:** A partial unique index `WHERE deleted_at IS NULL` — constraints cannot be
partial.

**Symptom:** `CREATE UNIQUE INDEX` locked the table
**Cause:** Non-concurrent build.
**Fix:** `CONCURRENTLY`, then attach as a constraint if needed.

**Symptom:** `23505` reaches the client as a 500
**Cause:** Unique violations are runtime errors, not validation errors.
**Fix:** Map `23505` to 409 and use `err.constraint` to say which rule was broken.

## Interview questions

**★ How many NULLs can a unique column hold?**
Unlimited, by default — measured, three NULLs accepted. Two NULLs are not equal
under SQL's three-valued logic, so uniqueness does not constrain them.
`NULLS NOT DISTINCT` (PostgreSQL 15+) changes that, and the second NULL then fails
with `23505`.

**★ Unique constraint or unique index — when does the difference matter?**
Both build the same btree. A foreign key can only reference a *constraint*. Only an
*index* can be partial, on an expression, or built `CONCURRENTLY`. The production
pattern is to build the index concurrently and then attach it with
`ADD CONSTRAINT … UNIQUE USING INDEX`.

**★ How do you make an email column unique case-insensitively?**
A unique index on `lower(email)` — but then queries must say
`WHERE lower(email) = lower($1)` or the index is unused. Alternatively a
non-deterministic ICU collation, which also makes plain equality case-insensitive;
measured, `'Apple' = 'apple'` becomes true. Collations disable `LIKE` on the column,
so scope them per column.

**★ Why can't you pre-check uniqueness in application code?**
There is a window between the `SELECT` and the `INSERT`. Measured with 20 concurrent
workers: all checked, all saw nothing, all inserted, 20 duplicates and no errors.
The constraint is the only thing that sees all the attempts.

**How do you allow re-use of a value after a soft delete?**
A partial unique index — `CREATE UNIQUE INDEX … ON t (email) WHERE deleted_at IS
NULL` — so the tombstoned row no longer occupies the value. Constraints cannot be
partial, so this must be an index.

---

← [DDL is transactional](07-transactional-ddl.md) · Next → [Adding a `NOT NULL` column safely](09-add-not-null.md)
