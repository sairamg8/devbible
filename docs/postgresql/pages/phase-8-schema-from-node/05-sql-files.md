---
title: "SQL in .sql files, not template literals"
sidebar_label: "05 · SQL in .sql files"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex10-migrations.mjs`,
> `ex2-ddl-edges.mjs`.

**SQL embedded in template literals is invisible to every tool that understands
SQL — no syntax highlighting, no formatter, no linter, and no way to paste it into
`psql` without editing it first.** Moving it into `.sql` files costs a loader
function and gets all of that back.

## Loading a file

```js
import {readFile} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const SQL_DIR = join(dirname(fileURLToPath(import.meta.url)), 'sql');
const cache = new Map();

export async function sql(name) {
  if (!cache.has(name)) {
    cache.set(name, await readFile(join(SQL_DIR, `${name}.sql`), 'utf8'));
  }
  return cache.get(name);
}

// usage
const {rows} = await pool.query(await sql('list-active-users'), [limit]);
```

`import.meta.url` rather than `process.cwd()` — the directory the process was
started from is not the directory the module lives in, and that difference is what
makes the code work in tests and fail in production.

**Cache the reads.** Without the `Map`, every request hits the filesystem. With it,
each file is read once per process. In development you may prefer to skip the cache
so edits take effect without a restart:

```js
const shouldCache = process.env.NODE_ENV === 'production';
```

## The multi-statement trap

A `.sql` file with several statements has to be sent with no parameters, and then
`query()` resolves to an **array**:

```console
$ node ex2-ddl-edges.mjs
=== A. multi-statement with an empty params array ===
empty array → array of 2
created: multi_c, multi_d
non-empty array → 42601 | cannot insert multiple commands into a prepared statement
```

Two consequences for a loader:

- A migration file (many statements, no parameters) resolves to an array; reading
  `res.rows` gives `undefined`. This is the bug that catches homegrown runners —
  see [Writing a minimal migration runner](08-minimal-runner.md).
- A query file (one statement, with parameters) resolves to a normal result. **Keep
  application query files to one statement each**, so they always behave the same
  way.

The full protocol explanation is in
[Issuing DDL through the driver](./01-ddl-from-node/01-issuing-ddl.md).

## Named parameters, if you want them

`$1, $2, $3` in a file you cannot see the call site of is genuinely worse than a
template literal — you lose the correspondence between name and position. Two ways
back:

**A comment header**, which costs nothing and helps most of the time:

```sql
-- list-active-users.sql
-- $1 :: text  status
-- $2 :: int   limit
SELECT id, email FROM users
 WHERE status = $1 AND deleted_at IS NULL
 ORDER BY created_at DESC, id
 LIMIT $2;
```

**Or a named-parameter shim**, translating `:name` into positional parameters at
load time:

```js
export function named(text, params) {
  const order = [];
  const compiled = text.replace(/:([a-z_][a-z0-9_]*)/gi, (_, key) => {
    if (!(key in params)) throw new Error(`missing SQL parameter :${key}`);
    order.push(params[key]);
    return `$${order.length}`;
  });
  return [compiled, order];
}

const [text, values] = named(await sql('list-active-users'), {status: 'active', limit: 20});
const {rows} = await pool.query(text, values);
```

This is safe because it still produces real placeholders — the values never enter
the SQL text. The regex is the weak point: it will also rewrite a `:` inside a
string literal or a `::` cast. Guard the cast case (`::` should not match) and keep
literals out of the file, or use a library rather than this shim if your SQL is
full of casts.

## What you get back

- **Tooling.** `sqlfluff`, `pgformatter`, editor SQL modes and language servers all
  work on a `.sql` file and none of them work inside a JavaScript string.
- **`psql` round-trips.** `psql -f query.sql -v ...` runs the exact text the
  application runs. Debugging stops involving a copy-paste that strips escapes.
- **Reviewable diffs.** A changed query is a diff in a SQL file, not a reflowed
  template literal buried in a handler.
- **A boundary that discourages string building.** It is awkward to concatenate into
  a file, which is the point — dynamic parts belong in the
  [dynamic `WHERE` builder](../phase-9-api-crud/safe-dynamic-where/), not in the
  static text.

## Where it does not fit

Dynamic SQL is the honest exception. A list endpoint whose `WHERE` clause depends on
which filters arrived cannot live in a static file — the file would have to contain
every combination. The workable split:

- **Static files** for fixed queries: `findById`, `insert`, reports, migrations.
- **Builders in code** for genuinely dynamic shapes, using the parameter-array
  pattern.
- **Never** a file with `${}` interpolation reintroduced by the loader. That has all
  the downsides of both.

## Trade-off

Files buy tooling, reviewability and `psql` parity. They cost indirection: the query
is no longer next to the code that uses it, so understanding a handler means opening
two files, and a query used once is arguably worse off for the separation.

The pragmatic line most codebases settle on: **short single-purpose queries stay
inline; anything long, reused, performance-sensitive, or likely to be pasted into
`psql` moves to a file.** Migrations always move — they are `.sql` by nature and
their whole value is being reviewable artefacts.

## Gotchas

**Symptom:** `ENOENT` reading a `.sql` file, only in production
**Cause:** The path was resolved from `process.cwd()`, which differs from where the
module lives.
**Fix:** Resolve from `import.meta.url`.

**Symptom:** `res.rows` is `undefined` for a file that clearly returns rows
**Cause:** The file has several statements, so `query()` resolved to an array of
results.
**Fix:** One statement per query file; handle `Array.isArray(res)` in the migration
runner.

**Symptom:** `42601 cannot insert multiple commands into a prepared statement`
**Cause:** A multi-statement file sent with a non-empty parameter array.
**Fix:** Split the file, or send it with no parameters.

**Symptom:** Editing a `.sql` file has no effect until restart
**Cause:** The loader cache.
**Fix:** Only cache when `NODE_ENV === 'production'`.

**Symptom:** File reads show up in a profile under load
**Cause:** No cache — every request reads from disk.
**Fix:** Read once per process into a `Map`.

**Symptom:** A named-parameter shim mangles a cast
**Cause:** The regex matched the second colon of `::int`.
**Fix:** Exclude `::` in the pattern, or use a library.

**Symptom:** A query file grew `${}` interpolation
**Cause:** Someone needed a dynamic `WHERE` and reached for the nearest tool.
**Fix:** Build dynamic predicates in code with a parameter array; keep files static.

## Interview questions

**★ Why move SQL out of template literals?**
Every SQL tool — formatter, linter, language server, `psql` — works on a `.sql` file
and none work inside a JavaScript string. Files also round-trip to `psql` unchanged
for debugging, diff cleanly in review, and make it awkward to concatenate strings,
which is the habit you want discouraged.

**★ What breaks when a `.sql` file has more than one statement?**
`pg` must send it with no parameters (the simple protocol), and `query()` then
resolves to an *array* of results rather than one — so `res.rows` is `undefined`.
Sending it with a non-empty parameter array fails outright with `42601 cannot insert
multiple commands into a prepared statement`.

**★ How do you keep `$1, $2` readable in a file?**
A comment header naming and typing each parameter, or a shim that rewrites `:name`
into positional placeholders at load time. The shim stays safe because it produces
real placeholders — values never enter the SQL text — but its regex must not match
the `::` cast operator.

**★ Which SQL should not move into files?**
Genuinely dynamic SQL, such as a list endpoint whose `WHERE` clause depends on which
filters arrived. A static file cannot express that without containing every
combination. Build those in code with a parameter array, and never reintroduce
`${}` interpolation into a file.

**Why resolve paths from `import.meta.url` rather than `process.cwd()`?**
`cwd` is wherever the process was launched, which varies between local runs, tests
and containers. `import.meta.url` is the module's own location, so the path is
correct regardless of how the process started.

---

← [Bulk insert that scales](04-bulk-insert.md) · Next → [Wrapping a migration in `BEGIN`/`COMMIT`](06-tx-migration.md)
