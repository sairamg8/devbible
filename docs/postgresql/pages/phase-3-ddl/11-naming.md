---
title: "Naming conventions that survive"
sidebar_label: "11 · Naming conventions"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Folding, `max_identifier_length` and the `user`
> keyword run directly in `psql`; generated constraint names observed across
> `sandbox/pg-api/ex4`, `ex11`, `ex12`, `ex13`.

**PostgreSQL folds unquoted identifiers to lower case. That one rule decides the
whole convention: use `snake_case`, never quote identifiers, and never rely on
capitalisation to carry meaning.**

## The folding rule

```console
$ psql -c 'CREATE TABLE "UserAccounts" (id int);'
CREATE TABLE
$ psql -c 'SELECT * FROM UserAccounts;'
ERROR:  relation "useraccounts" does not exist
LINE 1: SELECT * FROM UserAccounts;
```

The table exists. The unquoted reference was folded to `useraccounts` and did not
find it. Only `SELECT * FROM "UserAccounts"` works — and will, forever.

An unquoted identifier is lower-cased before lookup. A quoted one is stored
verbatim. Create a table with quotes and capitals and **every reference to it must be
quoted for the rest of its life** — in application SQL, in migrations, in `psql`, in
every ad-hoc query someone writes during an incident.

That is the entire argument for `snake_case`: it is what unquoted identifiers become
anyway, so quoting never becomes necessary.

## The conventions worth adopting

| Object | Convention | Example |
|---|---|---|
| Table | plural `snake_case` | `orders`, `order_items` |
| Column | singular `snake_case` | `user_id`, `created_at` |
| Foreign key column | `<referenced_singular>_id` | `user_id` referencing `users(id)` |
| Join table | both, alphabetical — or a domain name | `post_tags`, better `memberships` |
| Primary key constraint | `<table>_pkey` (PostgreSQL default) | `orders_pkey` |
| Unique constraint | `<table>_<cols>_key` | `users_email_key` |
| Foreign key | `<table>_<col>_fkey` | `orders_user_id_fkey` |
| Check | `<table>_<col>_check` | `orders_status_check` |
| Index | `<table>_<cols>_idx` | `orders_user_id_idx` |
| Partial index | `<table>_<cols>_<condition>_idx` | `users_email_live_idx` |

**Plural tables, singular columns** is a genuine convention argument with no
technical winner. What matters is picking one and never mixing — `orders.user_id`
joining `users.id` reads consistently; `order.users_id` does not.

These match PostgreSQL's own generated names, which is the practical reason to use
them: your hand-written names and the auto-generated ones look the same, so nothing
in an error message looks out of place.

## Constraint names are an API

They arrive in your application in `err.constraint`, and that is how a database
error becomes a useful message:

```js
catch (err) {
  if (err.code === '23505' && err.constraint === 'users_email_key')
    return res.status(409).json({field: 'email', error: 'already registered'});
  if (err.code === '23514' && err.constraint === 'orders_status_check')
    return res.status(422).json({field: 'status', error: 'invalid status'});
  throw err;
}
```

Measured constraint names from the sandbox — `sd_users_email_key` (`23505`),
`ck_t_age_check` (`23514`), `fk_child_parent_id_fkey` (`23503`) — all follow the
generated pattern.

**The catch:** auto-generated names change if you rename the column, silently
breaking the mapping above. Name constraints explicitly when the application depends
on them:

```sql
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
```

Same name PostgreSQL would have chosen, but now it is yours and stable.

## The 63-character limit

```console
$ psql -c 'SHOW max_identifier_length;'
 max_identifier_length
-----------------------
 63
```

Identifiers are truncated to **63 bytes** — silently, with only a notice. Long
generated names collide:

```
NOTICE:  identifier "very_long_table_name_with_a_long_column_name_and_more_idx" will be truncated
```

Two indexes on the same long table whose names differ only after byte 63 become the
same name, and the second `CREATE INDEX` fails as a duplicate. It is rare, and when
it happens the error points nowhere useful. Keep table names short enough that
`<table>_<cols>_idx` fits.

Note it is 63 *bytes*, not characters — non-ASCII identifiers hit it sooner.

## Words to avoid

Reserved words require quoting forever, which reintroduces the problem `snake_case`
solves. The common offenders in application schemas: `user`, `order`, `group`,
`table`, `column`, `check`, `default`, `references`, `limit`, `offset`, `desc`,
`end`, `time`.

`user` is the one that bites everybody:

```console
$ psql -c 'SELECT * FROM user;'
   user
----------
 devbible
(1 row)
```

No table involved — `user` resolved to `current_user`. Use `users`; plural
conventions dodge this and most other reserved-word collisions for free.

```sql
SELECT * FROM pg_get_keywords() WHERE catcode IN ('R','T');
```

## Consistency with the application layer

The database convention is `snake_case`; JavaScript is `camelCase`. Do the mapping
**in exactly one place** — the repository layer — rather than aliasing in every
query:

```sql
-- ✗ aliasing in every query: verbose, and easy to get inconsistent
SELECT id, user_id AS "userId", created_at AS "createdAt" FROM orders;
```

Note those aliases need double quotes precisely because of the folding rule — an
unquoted `AS userId` comes back as `userid`. That is the folding rule biting from the
other direction, and it is why aliasing everywhere is a maintenance problem.

Convert once, centrally
([Mapping `snake_case` to `camelCase`](../phase-9-api-crud/18-snake-camel.md)).

## Trade-off

A naming convention costs nothing to follow and cannot be retrofitted cheaply —
renaming a table is instant in the catalog but changes every query, every migration
reference, and every constraint name derived from it.

The one real tension is with ORMs and code generators that default to `camelCase` or
`PascalCase` table names, which forces quoted identifiers throughout. If a tool
insists, configure it to `snake_case` rather than accepting quoted identifiers — the
cost lands on everyone who ever writes SQL against that database by hand, which
eventually includes you at 3 a.m.

## Gotchas

**Symptom:** `42P01 relation "useraccounts" does not exist` for a table you can see
**Cause:** It was created quoted with capitals; unquoted references fold to lower
case.
**Fix:** Quote every reference, or rename to `snake_case` — the latter, once.

**Symptom:** `SELECT * FROM user` returns a username
**Cause:** `user` is a reserved word resolving to `current_user`.
**Fix:** Name the table `users`.

**Symptom:** A column alias comes back lower-cased
**Cause:** `AS userId` unquoted is folded to `userid`.
**Fix:** `AS "userId"`, or map centrally in the repository layer instead.

**Symptom:** `CREATE INDEX` fails as a duplicate on differently-named indexes
**Cause:** Both names exceeded 63 bytes and truncated to the same string.
**Fix:** Shorter table and column names.

**Symptom:** Error handling that matched `err.constraint` stopped working
**Cause:** A column rename regenerated the auto-generated constraint name.
**Fix:** Name constraints explicitly in migrations.

**Symptom:** Mixed `camelCase` and `snake_case` columns in one schema
**Cause:** An ORM created some tables and hand-written migrations created others.
**Fix:** Configure the tool for `snake_case`; renaming columns is a catalog change
but touches every query.

## Interview questions

**★ Why `snake_case` in PostgreSQL specifically?**
Because unquoted identifiers are folded to lower case. A table created as
`"UserAccounts"` is stored verbatim and must be quoted in *every* future reference —
application SQL, migrations, ad-hoc `psql`. `snake_case` is what unquoted identifiers
become anyway, so quoting is never required.

**★ Why do constraint names matter to the application?**
They arrive as `err.constraint` alongside the SQLSTATE, and together they turn a
generic database error into a field-level message — `23505` +
`users_email_key` → "email already registered". Auto-generated names change when
columns are renamed, so name them explicitly when the application depends on them.

**★ What is the identifier length limit and how does it fail?**
63 bytes, truncated silently with a notice. Two long index names differing only past
byte 63 truncate to the same string, and the second `CREATE INDEX` fails as a
duplicate with an error that does not mention truncation.

**★ Why is a table named `user` a problem?**
`user` is reserved and resolves to `current_user`, so `SELECT * FROM user` returns a
username rather than your rows. It must be quoted forever otherwise. Plural table
names avoid this and most other reserved-word collisions for free.

**★ Where should `snake_case`→`camelCase` conversion happen?**
Once, in the repository layer. Aliasing in every query requires quoted aliases —
unquoted `AS userId` folds to `userid` — and drifts out of sync as queries multiply.

---

← [Schemas as namespaces](10-schemas-tenancy.md) · Next → [Normalization to 3NF](12-normalization.md)
