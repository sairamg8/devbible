---
title: "\\errverbose and SQLSTATE"
sidebar_label: "14 · \\errverbose and SQLSTATE"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**, **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex32-psql-io.sh`.

**The default error message hides the field your application code actually branches on.
`\errverbose` reveals the five-character SQLSTATE — the same string `pg` gives you as
`err.code` — which is what turns "an error happened" into "this email is already taken".**

## The same error, twice

```console
$ ./ex32-psql-io.sh
=== 14a. the default error, then the same error verbosely ===
ERROR:  duplicate key value violates unique constraint "p1_import_pkey"
DETAIL:  Key (id)=(1) already exists.

ERROR:  23505: duplicate key value violates unique constraint "p1_import_pkey"
DETAIL:  Key (id)=(1) already exists.
SCHEMA NAME:  public
TABLE NAME:  p1_import
CONSTRAINT NAME:  p1_import_pkey
LOCATION:  _bt_check_unique, nbtinsert.c:666
```

`\errverbose` re-prints the **last** error at maximum verbosity. Four fields appear that the
default hides:

- **`23505`** — the SQLSTATE, the stable identifier. Message text is translated and can
  change between versions; the code does not.
- **`SCHEMA NAME` / `TABLE NAME` / `CONSTRAINT NAME`** — machine-readable, so your handler
  can distinguish "duplicate email" from "duplicate username" without parsing prose.
- **`LOCATION`** — the C function and source line. Only useful when reporting a bug, but it
  tells you the check was `_bt_check_unique`, i.e. a B-tree uniqueness check.

To get this on every error rather than on demand:

```sql
\set VERBOSITY verbose
```

```console
=== 14b. VERBOSITY verbose shows SQLSTATE inline on every error ===
ERROR:  22P02: invalid input syntax for type numeric: "not-a-number"
LINE 1: ...TO p1_import (id, name, amount) VALUES (999, 'x', 'not-a-num...
                                                             ^
LOCATION:  numeric_in, numeric.c:803
```

`VERBOSITY` takes `terse`, `default`, `verbose`, and `sqlstate` (PostgreSQL 12+, which
prints just the code). `verbose` in [`.psqlrc`](13-psqlrc.md) is a reasonable default —
the extra lines are the ones you need when something fails.

## The codes, each produced by causing the error

```console
=== 14c. every code below was produced by actually causing the error ===
INSERT a duplicate primary key                           -> 23505
INSERT violating the CHECK                               -> 23514
INSERT a NULL into a NOT NULL column                     -> 23502
INSERT referencing a missing parent                      -> 23503
text where a number belongs                              -> 22P02
SELECT from a table that is not there                    -> 42P01
SELECT a column that is not there                        -> 42703
divide by zero                                           -> 22012
a statement psql cannot parse                            -> 42601
```

The class — the first two characters — carries most of the meaning:

| Class | Meaning | Handle it by |
|---|---|---|
| `23` | integrity constraint violation | mapping to a user-facing validation error |
| `22` | data exception (bad value, division by zero) | validating input before the query |
| `42` | syntax error or access rule violation | fixing the code; never a runtime condition |
| `40` | transaction rollback (`40001`, `40P01`) | **retrying** — see [isolation levels](../phase-11-mvcc/06-isolation-levels.md) |
| `08` | connection exception | reconnect / fail the request |
| `53` | insufficient resources (disk, memory, connections) | alerting; it is an operational problem |
| `57` | operator intervention (`57014` query cancelled) | timeouts, cancellation |

**The `23` and `40` classes are the two your application code must handle deliberately.**
`23` maps to user-visible validation; `40` means retry. Everything in `42` is a bug in your
SQL and should never be caught and swallowed.

## The same error from Node

```console
=== 14d. the same violation as psql shows it vs as node/pg reports it ===
ERROR:  duplicate key value violates unique constraint "p1_import_pkey"
DETAIL:  Key (id)=(1) already exists.
{"code":"23505","constraint":"p1_import_pkey","detail":"Key (id)=(1) already exists.","table":"p1_import"}
```

**The fields line up exactly.** psql's `SQLSTATE` is `err.code`; `CONSTRAINT NAME` is
`err.constraint`; `TABLE NAME` is `err.table`; `DETAIL:` is `err.detail`. That is what makes
psql a debugging tool for application errors: reproduce the failure in psql with
`VERBOSITY verbose`, and you are reading the same object your `catch` block receives.

```js
try {
  await pool.query('INSERT INTO users (email) VALUES ($1)', [email]);
} catch (e) {
  if (e.code === '23505' && e.constraint === 'users_email_key') {
    throw new ValidationError('That email is already registered');
  }
  if (e.code === '23503') throw new ValidationError('Referenced record does not exist');
  if (e.code === '40001' || e.code === '40P01') return retry();
  throw e;
}
```

Two rules this encodes:

- **Branch on `e.code`, never on `e.message`.** Message text is localised and changes
  between releases; the code is part of the SQL standard.
- **Branch on `e.constraint` for a specific column.** Two unique constraints on one table
  both raise `23505`; only the constraint name distinguishes them — which is a strong
  argument for naming constraints explicitly rather than accepting generated names.

More on the `pg` error object in [errors from Node](../phase-7-pg-driver/05-errors.md).

## Reading the rest of an error

```
ERROR:  22P02: invalid input syntax for type numeric: "not-a-number"
LINE 1: ...TO p1_import (id, name, amount) VALUES (999, 'x', 'not-a-num...
                                                             ^
CONTEXT:  COPY p1_import, line 3, column amount: "not-a-number"
```

- **`LINE n` with a caret** — the exact position in your statement. On a long generated
  query this is the fastest way to find the problem.
- **`DETAIL:`** — the specific values involved (`Key (id)=(1) already exists`).
- **`CONTEXT:`** — where it happened during execution: a `COPY` line number, or the PL/pgSQL
  call stack inside a function.
- **`HINT:`** — PostgreSQL's suggestion. It is often right; the
  [`\copy` hint](09-copy.md) is a good example.

## Trade-off

**Verbose errors are noise until the moment they are the only thing that helps.** Turning
`VERBOSITY verbose` on globally makes routine mistakes print six lines instead of two, and
`LOCATION` is meaningless unless you read PostgreSQL's source. The pragmatic setting is
`default` with `\errverbose` in reach — one command re-prints the last error in full,
without making every error verbose. In scripts, prefer capturing `:SQLSTATE` directly rather
than parsing any of this text.

## Gotchas

**Symptom:** Application code matches on error message text and breaks after an upgrade
**Cause:** Message text is version-dependent and translatable
**Fix:** Branch on `e.code` (the SQLSTATE)

**Symptom:** Two different unique constraints are indistinguishable in the handler
**Cause:** Both raise `23505`
**Fix:** Use `e.constraint`, and name constraints explicitly in the schema

**Symptom:** `\errverbose` says there is no error
**Cause:** It re-prints the *last* error; a successful statement clears it
**Fix:** Run it immediately after the failure

**Symptom:** A retry loop retries errors it should not
**Cause:** Catching everything instead of the `40` class
**Fix:** Retry only `40001` and `40P01`; let `23` and `42` propagate

**Symptom:** A `42`-class error reaches production
**Cause:** It is a bug in the SQL, not a runtime condition
**Fix:** Never handle `42*` at runtime — fix the query

**Symptom:** A `COPY` failure gives no useful location
**Cause:** The `CONTEXT:` line was not read
**Fix:** It names the file line, column and offending value

## Interview questions

**★ What is a SQLSTATE and why use it?**
The five-character standard error code (`23505`, `40001`). It is stable across versions and
locales, unlike message text, which makes it the only safe thing to branch on.

**★ How do you see it in psql?**
`\errverbose` after the failure, or `\set VERBOSITY verbose` to include it in every error.
Measured: `ERROR: 23505: duplicate key value violates …`.

**★ Which codes must application code handle?**
Class `23` (constraint violations → user-facing validation) and class `40` (`40001`
serialization failure, `40P01` deadlock → retry). Class `42` is a code bug and should never
be caught.

**★ How do psql's error fields map to `pg`'s error object?**
Directly: `SQLSTATE`→`e.code`, `CONSTRAINT NAME`→`e.constraint`, `TABLE NAME`→`e.table`,
`DETAIL:`→`e.detail`. Measured side by side on the same violation.

**★ Two unique constraints on a table both raise `23505`. How do you tell them apart?**
`e.constraint` — which is why constraints should be named explicitly rather than left to
PostgreSQL's generated names.

**What do `LINE`, `DETAIL`, `CONTEXT` and `HINT` add?**
`LINE` plus a caret points at the position in the statement; `DETAIL` gives the specific
values; `CONTEXT` gives the execution location (COPY line, PL/pgSQL stack); `HINT` is
PostgreSQL's suggested fix.

**How do you capture the code in a psql script?**
The `:SQLSTATE` variable after a statement, alongside `:ERROR` and `:LAST_ERROR_MESSAGE`.

---

← [.psqlrc and prompt](13-psqlrc.md) · Next → [Piping psql](15-piping.md)
