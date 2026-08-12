---
title: "Issuing DDL through the driver"
sidebar_label: "01 · Issuing DDL"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex1-ddl-from-node.mjs`,
> `ex2-ddl-edges.mjs`, `ex7-ddl-locks.mjs`.

**Chapter 1 of [Creating tables from Node](README.md).** The mechanics: what comes
back, what cannot be a parameter, and what PostgreSQL will undo for you.

## A DDL statement is an ordinary query

There is no special API. `CREATE TABLE` goes through `client.query` like a
`SELECT`, and the only difference is in what comes back.

```js
const res = await client.query(`
  CREATE TABLE ddl_demo (
    id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email  text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'active'
  )
`);
console.log('command:', res.command, '| rowCount:', res.rowCount, '| fields:', res.fields.length);
```

```console
$ node ex1-ddl-from-node.mjs
=== 1. CREATE TABLE via client.query ===
command: CREATE | rowCount: null | fields: 0
```

`rowCount` is `null` and `fields` is empty — DDL returns no tuples. Code that
checks `res.rowCount` to decide whether a statement "worked" is wrong on every
`CREATE`, `ALTER` and `DROP`. **Success is the absence of a thrown error**; if you
want a positive signal, compare `res.command` against `'CREATE'`.

## Identifiers cannot be parameters

This is the first wall everyone hits. `$1` is a *value* placeholder: it is bound to
an already-parsed statement, so it cannot become a table name, a column name, or a
keyword.

```js
await pool.query('CREATE TABLE $1 (id int)', ['nope_demo']);
```

```console
=== 2. parameterised identifier in DDL ===
code: 42601 | message: syntax error at or near "$1"
position: 14 | severity: ERROR
```

`42601` is `syntax_error`, raised at parse time — before the parameter is ever
looked at. No configuration relaxes this, and that is the point: a parameter that
could become an identifier would be a parameter that could become arbitrary SQL.

When an identifier genuinely has to be dynamic, it has to be built as text and made
safe another way — `format('%I', …)`, `quote_ident()`, or `pg.escapeIdentifier` —
always behind an allowlist. The place that actually bites is sorting, covered in
[Sort and filter allowlists](../../phase-9-api-crud/allowlists/), where the
same mistake silently succeeds instead of erroring.

## Transactional DDL — the thing PostgreSQL gives you for free

Most engines commit each DDL statement implicitly. A migration that dies halfway
leaves half a schema behind and you repair it by hand. PostgreSQL does not: DDL
participates in transactions like anything else.

```js
try {
  await client.query('BEGIN');
  await client.query('CREATE TABLE tx_demo_a (id int)');
  await client.query('CREATE TABLE tx_demo_b (id int)');
  await client.query('CREATE TABLE tx_demo_a (id int)'); // deliberate failure
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  console.log('failed on:', err.code, err.message);
}
```

```console
=== 3. transactional DDL — rollback after a good CREATE ===
failed on: 42P07 relation "tx_demo_a" already exists
tables surviving the rollback: (none)
```

`tx_demo_b` was created successfully and still vanished. That is the property the
whole migration story rests on: wrap a file in one `BEGIN`/`COMMIT` and it becomes
all-or-nothing, with no compensating statements to write and no half-applied state
to detect. [Wrapping a migration in `BEGIN`/`COMMIT`](../06-tx-migration.md) builds
on this directly.

**The exceptions worth knowing**, because they are the ones that break the
guarantee: `CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY`, `VACUUM`, and
`CREATE DATABASE` cannot run inside a transaction block. A migration runner that
wraps everything in `BEGIN` will fail on those with
`25001 CREATE INDEX CONCURRENTLY cannot run inside a transaction block` — which is
why real runners let a file opt out of the wrapper.

## One `query()` call, several statements

`pg` picks its wire protocol based on whether you passed parameters, and the two
protocols disagree about how many statements a single call may contain.

```js
await pool.query('CREATE TABLE multi_a (id int); CREATE TABLE multi_b (id int);');
await pool.query('CREATE TABLE multi_c (id int); CREATE TABLE multi_d (id int);', []);
await pool.query('CREATE TABLE multi_e (id int); CREATE TABLE multi_f (id int);', ['x']);
```

```console
=== 4. several statements in one query() call ===
returned: array of 2

=== A. multi-statement with an empty params array ===
empty array → array of 2
created: multi_c, multi_d
non-empty array → 42601 | cannot insert multiple commands into a prepared statement
after non-empty: multi_c, multi_d
```

Three things worth keeping:

- **No parameters — or an empty array — takes the simple query protocol.** Several
  statements run, and `query()` resolves to an **array** of result objects rather
  than one result. Reading `.rows` off that array gives `undefined`.
- **One parameter switches to the extended protocol**, which permits exactly one
  statement: `42601 cannot insert multiple commands into a prepared statement`.
- **`[]` is not "some parameters".** It behaves exactly like passing nothing.

That last point is the mechanism behind stacked-statement injection: a concatenated
query with no parameter array is on the simple protocol, so a smuggled
`; DROP TABLE …` is a second statement and it executes. See Node
[Phase 6 · Parameterized queries](/docs/nodejs/pages/phase-6-data-access/parameterized-queries)
for that in full, and chunk 2 of this topic for the DDL-flavoured version.

The array-versus-object difference is a live bug source in migration runners:
loading a `.sql` file containing three statements returns an array, and a runner
written against `res.rows` reads `undefined` without complaining.

## `ALTER TABLE` from Node, and whether it rewrites the table

Adding a column is the most common migration there is, and the question that
matters at scale is whether PostgreSQL has to rewrite every row. Since PostgreSQL
11 it does not, even with a `NOT NULL DEFAULT` — the default is stored as catalog
metadata and materialised lazily.

```js
const relfile = async () =>
  (await q(`SELECT relfilenode FROM pg_class WHERE relname='lk_items'`)).rows[0].relfilenode;
const before = await relfile();
await q(`ALTER TABLE lk_items ADD COLUMN flag boolean NOT NULL DEFAULT false`);
const after = await relfile();
```

```console
$ node ex7-ddl-locks.mjs
=== 2. ADD COLUMN ... DEFAULT — rewrite or not? ===
relfilenode before: 17531 → after: 17531
no table rewrite
```

`relfilenode` unchanged means the physical file was not replaced — no rewrite, so
the statement is O(1) rather than O(rows). This is worth verifying per statement
rather than assuming: changing a column *type* generally does rewrite, and on a
large table that turns a "quick migration" into a multi-minute exclusive lock. The
lock consequences are chunk 2.

## Reading the schema back

Whatever created the table, `information_schema` is how you assert it is the shape
you think it is. This query is the basis of the drift check in
[Schema drift](../13-schema-drift.md).

```js
const {rows} = await pool.query(
  `select column_name, data_type, is_nullable, column_default
     from information_schema.columns
    where table_name = 'ddl_demo'
    order by ordinal_position`,
);
console.table(rows);
```

```console
=== 7. reading the schema back ===
┌─────────┬─────────────┬───────────┬─────────────┬──────────────────┐
│ (index) │ column_name │ data_type │ is_nullable │ column_default   │
├─────────┼─────────────┼───────────┼─────────────┼──────────────────┤
│ 0       │ 'id'        │ 'bigint'  │ 'NO'        │ null             │
│ 1       │ 'email'     │ 'text'    │ 'NO'        │ null             │
│ 2       │ 'status'    │ 'text'    │ 'NO'        │ "'active'::text" │
└─────────┴─────────────┴───────────┴─────────────┴──────────────────┘
```

Two details that catch drift checks out:

- **`id` reports `column_default: null`.** An identity column is not a default — it
  is a separate catalog property, `is_identity`. A check that compares only
  defaults will not notice `GENERATED ALWAYS AS IDENTITY` being dropped.
- **`data_type` is the SQL standard name**, so `text` stays `text` but a
  `numeric(12,2)` reports as `numeric` with the precision in separate columns
  (`numeric_precision`, `numeric_scale`), and `bigserial` reports as `bigint`.
  Comparing `data_type` alone will miss a precision change that silently truncates
  money.

`information_schema` only shows objects the current role can see. A drift check
running as a restricted application role can report a column "missing" when it
exists but is not visible — query `pg_catalog.pg_attribute` if you need the truth
regardless of privileges.

## Gotchas

**Symptom:** `res.rowCount` is `null` after a successful `CREATE TABLE`
**Cause:** DDL returns no tuples; `rowCount` is only meaningful for DML.
**Fix:** Treat "no error thrown" as success, or check `res.command === 'CREATE'`.

**Symptom:** `syntax error at or near "$1"` on a statement you are sure is correct
**Cause:** A placeholder in an identifier or keyword position — table name, column
name, `ORDER BY` target, `ASC`/`DESC`.
**Fix:** Build the identifier as text through an allowlist, or `format('%I', …)`.

**Symptom:** `cannot insert multiple commands into a prepared statement`
**Cause:** A multi-statement string passed with a non-empty parameter array, which
forces the extended protocol.
**Fix:** Split the statements, or send the file with no parameters — then read the
**array** of results, not `.rows`.

**Symptom:** A migration runner reads `res.rows` and gets `undefined`
**Cause:** The `.sql` file had more than one statement, so `query()` resolved to an
array of results.
**Fix:** Detect `Array.isArray(res)` and take the element you need.

**Symptom:** `25001 … cannot run inside a transaction block`
**Cause:** The runner wrapped every file in `BEGIN`/`COMMIT`, and this one contains
`CREATE INDEX CONCURRENTLY`, `VACUUM` or `CREATE DATABASE`.
**Fix:** Let a migration file opt out of the transaction wrapper.

**Symptom:** A migration failed and left the schema half-changed
**Cause:** The runner executed statements outside a transaction, or autocommitted
between them.
**Fix:** One `BEGIN`/`COMMIT` around the whole file — PostgreSQL rolls DDL back.

**Symptom:** A drift check passes but a column's precision silently changed
**Cause:** Comparing `information_schema.data_type` only, which reports `numeric`
for every `numeric(p,s)`.
**Fix:** Compare `numeric_precision` and `numeric_scale` too, and `is_identity` for
identity columns.

## Interview questions

**★ Can you create a table from `pg`? Should you?**
Yes — `client.query('CREATE TABLE …')` is an ordinary query returning
`command: 'CREATE'` and `rowCount: null`. Whether you *should* depends entirely on
where it lives: inside a numbered, recorded, transactional migration it is the
normal way; inside a request handler or an `ensureSchema()` at boot it is both a
concurrency bug and an unversioned schema.

**★ Why can't you write `CREATE TABLE $1`?**
`$1` is bound as a value after the statement is parsed, and an identifier must be
known at parse time. PostgreSQL rejects it with `42601 syntax error at or near
"$1"`. Dynamic identifiers need `format('%I')`/`quote_ident` **plus** an
allowlist — escaping alone still lets an attacker name any table they can reach.

**★ What does PostgreSQL's transactional DDL change about migrations?**
A migration wrapped in `BEGIN`/`COMMIT` becomes atomic: a failure on statement five
rolls back statements one to four, so there is no half-applied state and nothing to
repair by hand. Measured — `tx_demo_b` was created and vanished with the rollback.
Most other engines commit DDL implicitly and cannot offer this.

**★ Which DDL statements break that guarantee?**
Anything that cannot run in a transaction block: `CREATE INDEX CONCURRENTLY`,
`DROP INDEX CONCURRENTLY`, `VACUUM`, `CREATE DATABASE`. They fail with `25001`
inside `BEGIN`, which is why migration runners need a per-file opt-out.

**★ Why does `pool.query(sql)` sometimes resolve to an array?**
With no parameters — or an empty array — `pg` uses the simple query protocol, which
permits several statements and returns one result object per statement. Add a
single parameter and it switches to the extended protocol, which allows exactly one
statement. The same switch is why a concatenated query with no parameters can
execute a stacked `; DROP TABLE …`.

**Does `ALTER TABLE … ADD COLUMN … DEFAULT` rewrite the table?**
Not since PostgreSQL 11 — the default is stored in the catalog and applied on read,
so `relfilenode` is unchanged and the statement is O(1). Measured on 18.4:
`17531 → 17531`. Changing a column's *type* is a different matter and usually does
rewrite, holding an exclusive lock for the duration.

---

← [Topic index](README.md) · Next → [Locks, concurrency and where DDL belongs](02-locks-and-blocking.md)
