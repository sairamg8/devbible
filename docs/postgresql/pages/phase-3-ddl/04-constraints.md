---
title: "NOT NULL, DEFAULT, UNIQUE, CHECK"
sidebar_label: "04 · Constraints"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex13-constraints-rel.mjs`.

**A constraint is an invariant the database will not let you break, no matter which
client connects or what bug ships. Application validation is a user-experience
feature; constraints are the correctness layer, and they are not interchangeable.**

## `CHECK` does not reject NULL

This is the one that surprises people, and it follows from SQL's three-valued logic.

```sql
CREATE TABLE ck_t (id int, age int CHECK (age >= 18));
```

```console
$ node ex13-constraints-rel.mjs
=== 1. does a CHECK constraint reject NULL? ===
age = 20   → accepted
age = 10   → 23514 ck_t_age_check
age = NULL → accepted   ← CHECK passes on NULL (unknown is not false)
rows now: 2
```

`NULL >= 18` evaluates to **unknown**, not false — and a `CHECK` only rejects a row
when the expression is *false*. So the constraint that was supposed to guarantee
"at least 18" happily stores a row with no age at all.

The same applies across columns:

```console
=== 2. a CHECK across two columns ===
(2026-01-01, 2026-02-01) → accepted
(2026-02-01, 2026-01-01) → 23514 ck2_check
(null, 2026-01-01) → accepted
```

A date range with a NULL start passes `CHECK (ends > starts)`.

**`CHECK` and `NOT NULL` are different jobs and you almost always need both:**

```sql
age int NOT NULL CHECK (age >= 18)
```

If NULL is legitimately allowed, say so explicitly so the reader knows it was a
decision: `CHECK (age IS NULL OR age >= 18)`.

## `DEFAULT` is evaluated at transaction start, not statement time

```console
=== 3. when is a DEFAULT evaluated? ===
two inserts 150ms apart in ONE transaction:
  id 1 2026-08-12T03:36:00.220Z
  id 2 2026-08-12T03:36:00.220Z
same timestamp? true ← now() is transaction start time, not statement time
```

Two inserts 150 ms apart inside one transaction got the **identical**
`created` timestamp. `now()` is transaction-scoped by design — it is an alias for
`transaction_timestamp()`.

That is usually what you want: every row written by one transaction shares a
consistent timestamp. It is wrong when you are measuring durations inside a long
transaction, or ordering rows by insertion within one. The alternatives:

| Function | Returns |
|---|---|
| `now()` / `transaction_timestamp()` | Start of the transaction — constant within it |
| `statement_timestamp()` | Start of the current statement |
| `clock_timestamp()` | Actual wall clock, advances during a statement |

### Explicit `NULL` bypasses the default

```console
=== 4. inserting NULL explicitly does not use the DEFAULT ===
┌─────────┬────┬───────┐
│ (index) │ id │ tag   │
├─────────┼────┼───────┤
│ 0       │ 1  │ 'new' │
│ 1       │ 2  │ null  │
└─────────┴────┴───────┘
```

`VALUES (1, DEFAULT)` used the default; `VALUES (2, NULL)` stored NULL. A default
applies only when the column is **omitted** or explicitly `DEFAULT`.

This bites through ORMs and hand-built inserts alike: code that builds a full column
list and sends `undefined`/`null` for unset fields overrides every default in the
table. The fix is to omit the column, not to send NULL — which is why the
[dynamic builder](../phase-9-api-crud/safe-dynamic-where/) pattern of only including
fields that are present matters for writes too.

## `NOT NULL`

The cheapest and most valuable constraint. It is a column property rather than a
table constraint, which has two consequences: it cannot be `DEFERRABLE`
([Deferrable constraints](18-deferrable.md)), and adding it to an existing column
requires a verification scan — see
[Adding a `NOT NULL` column safely](09-add-not-null.md) for the `NOT VALID` sequence
that avoids the long lock.

Default to `NOT NULL` and justify nullability, not the other way round. Every
nullable column is a branch in every query that reads it, and three-valued logic
means `WHERE status != 'archived'` silently excludes rows where `status` is NULL.

## `UNIQUE`

Covered in full in [Unique constraints vs unique indexes](08-unique-nulls.md). The
two things to carry here:

- **A unique column accepts unlimited NULLs** by default — measured, three NULLs
  accepted — unless declared `NULLS NOT DISTINCT`.
- Uniqueness cannot be enforced from application code. Measured in
  [Seeding](../phase-8-schema-from-node/03-seeding.md): 20 concurrent workers all
  checked, all saw nothing, all inserted, 20 duplicates, zero errors.

## Naming constraints, and why it pays

PostgreSQL generates names like `ck_t_age_check` and `sd_users_email_key`. They are
parseable but they change if you rename the column, and they are what your API sees:

```js
catch (err) {
  if (err.code === '23505' && err.constraint === 'users_email_key')
    return res.status(409).json({field: 'email', error: 'already registered'});
  if (err.code === '23514' && err.constraint === 'users_age_check')
    return res.status(422).json({field: 'age', error: 'must be 18 or older'});
  throw err;
}
```

`err.constraint` is how you turn a database error into a field-level message.
Name constraints deliberately so that mapping is stable
([Naming conventions](11-naming.md)).

The SQLSTATEs worth memorising:

| Code | Meaning | Typical HTTP |
|---|---|---|
| `23502` | `not_null_violation` | 422 |
| `23503` | `foreign_key_violation` | 409 |
| `23505` | `unique_violation` | 409 |
| `23514` | `check_violation` | 422 |
| `23001` | `restrict_violation` | 409 |

## Trade-off

Constraints move validation into the one place that sees every write, and make whole
classes of bad data impossible rather than unlikely. They cost write performance
(every insert is checked), schema rigidity (changing a rule means a migration, and
`ADD CONSTRAINT` scans the table), and a different error-handling style — failures
arrive as SQLSTATEs at write time rather than as a validation result you can collect.

That last point is the real objection: an API wanting to return *all* validation
errors at once cannot get that from constraints, which fail on the first violation.
The resolution is both layers — application validation for the user experience,
constraints for correctness — with the understanding that the application layer is
advisory and the database layer is the truth.

## Gotchas

**Symptom:** A `CHECK (age >= 18)` column contains rows with no age
**Cause:** `NULL >= 18` is unknown, not false, and `CHECK` only rejects false —
measured, NULL accepted.
**Fix:** Add `NOT NULL`, or write `CHECK (age IS NULL OR age >= 18)` to show it was
deliberate.

**Symptom:** Every row in a transaction has the same `created_at`
**Cause:** `now()` is transaction start time — measured, two inserts 150 ms apart
got identical timestamps.
**Fix:** `clock_timestamp()` if you need real wall-clock time per row.

**Symptom:** A column default never applies
**Cause:** The insert sends an explicit `NULL` rather than omitting the column.
**Fix:** Omit the column, or send `DEFAULT`.

**Symptom:** `WHERE status != 'archived'` misses rows
**Cause:** `NULL != 'archived'` is unknown, so NULL rows are excluded.
**Fix:** `NOT NULL` on the column, or `WHERE status IS DISTINCT FROM 'archived'`.

**Symptom:** `23514` reaches the client as a generic 500
**Cause:** Check violations are runtime errors.
**Fix:** Map SQLSTATE plus `err.constraint` to a field-level message.

**Symptom:** `ADD CONSTRAINT` locked a large table
**Cause:** It scans every row to validate while holding `ACCESS EXCLUSIVE` —
measured 25 ms at 200k rows, linear thereafter.
**Fix:** `NOT VALID`, then `VALIDATE CONSTRAINT` under a weaker lock.

**Symptom:** An error message names a constraint that no longer exists
**Cause:** Auto-generated names change when columns are renamed.
**Fix:** Name constraints explicitly.

## Interview questions

**★ Does a `CHECK` constraint reject NULL?**
No. `NULL >= 18` is *unknown*, and `CHECK` rejects only when the expression is
*false* — measured, a NULL age was accepted by `CHECK (age >= 18)`. You need
`NOT NULL` as well, or an explicit `CHECK (col IS NULL OR …)` to show the choice was
intentional.

**★ When is `DEFAULT now()` evaluated?**
At transaction start, not statement time — `now()` is `transaction_timestamp()`.
Measured: two inserts 150 ms apart in one transaction received identical timestamps.
Use `statement_timestamp()` or `clock_timestamp()` when you need finer resolution.

**★ Why did a column default not apply?**
Because the insert supplied an explicit `NULL`. Defaults apply only when the column
is omitted or given `DEFAULT` — measured. Code that builds a full column list and
sends null for unset fields overrides every default in the table.

**★ Why not do all validation in the application?**
Because application checks are not atomic with the write. Measured with 20 concurrent
workers doing check-then-insert: 20 duplicate rows and no errors. Application
validation is for user experience — collecting all errors, good messages —
constraints are for correctness.

**★ How do you turn a constraint violation into a useful API response?**
Match on SQLSTATE and `err.constraint`: `23505` unique → 409, `23503` foreign key →
409, `23514` check → 422, `23502` not-null → 422. Name constraints explicitly so
the mapping does not break when a column is renamed.

**Why default to `NOT NULL`?**
Every nullable column adds a three-valued-logic branch to every query reading it —
`WHERE status != 'archived'` silently excludes NULL rows. Nullability should be a
justified decision rather than the default.

---

← [Foreign keys](03-foreign-keys.md) · Next → [`ALTER TABLE`](05-alter-table.md)
