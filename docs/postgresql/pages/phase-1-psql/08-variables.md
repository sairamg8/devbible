---
title: "psql variables and the interpolation traps"
sidebar_label: "08 · Variables"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex31-psql-basics.sh`.

**psql variables are textual substitution performed by the client before the SQL is sent.
They are not parameters. That single fact explains all three traps on this page,
including the one where `-c` ignores them entirely.**

## Setting and using

```console
$ ./ex31-psql-basics.sh
=== 08a. \set and the three interpolation forms ===
 paid_over
-----------
         3
(1 row)
```

```sql
\set tbl p1_orders
\set wanted 'paid'
\set num 300
SELECT count(*) AS paid_over FROM :tbl WHERE status = :'wanted' AND total_cents > :num;
```

Three reference forms, and picking the right one is the whole skill:

| Form | Produces | Use for |
|---|---|---|
| `:var` | the raw text, unquoted | table and column names, numbers, SQL fragments |
| `:'var'` | a **quoted string literal**, escaped | values |
| `:"var"` | a **quoted identifier**, escaped | table/column names that need quoting |

```console
=== 08b. :'x' quotes as a literal, :"x" quotes as an identifier ===
 as_literal | as_identifier
------------+---------------
 status     | paid
(1 row)
```

The same variable `col` (value `status`) produced the *string* `'status'` with `:'col'`
and the *column reference* `status` — evaluating to `paid` — with `:"col"`. That is the
distinction in one line.

## Trap 1: `-c` does not interpolate at all

```console
=== 08d. -v sets variables from the shell — but -c does NOT interpolate them ===
--- with -c (fails) ---
ERROR:  syntax error at or near ":"
LINE 1: SELECT count(*) FROM p1_orders WHERE status = :'status'
                                                      ^
--- same variable, same query, fed on stdin (works) ---
4
--- and via -f (works) ---
4
```

**Identical variable, identical query — a syntax error via `-c` and the right answer via
stdin or `-f`.** `-c` sends its string to the server essentially as typed; variable
interpolation happens only for input read as a script.

```bash
# broken
psql -v status=shipped -c "SELECT count(*) FROM p1_orders WHERE status = :'status'"

# works
psql -v status=shipped -f query.sql
psql -v status=shipped <<'SQL'
SELECT count(*) FROM p1_orders WHERE status = :'status';
SQL
```

This is worth memorising because the error message — `syntax error at or near ":"` —
points at the colon and gives no hint that the mechanism is simply switched off.

## Trap 2: an unset variable is left as literal text

```console
=== 08f. what an UNSET variable does (on stdin, where interpolation is live) ===
bare   : :nosuchvar
ERROR:  syntax error at or near ":"
LINE 1: SELECT 'quoted: ' || :'nosuchvar' AS quoted_form;
                             ^
```

There is **no error for an undefined variable**. `\echo` printed the literal text
`:nosuchvar`, and in SQL the un-substituted `:'nosuchvar'` reached the server and failed as
a syntax error. A typo in a variable name is therefore either a confusing syntax error or —
worse, in a `WHERE` clause that happens to still parse — silently wrong SQL.

Guard the ones that matter:

```sql
\if :{?target_schema}
  \echo 'using' :target_schema
\else
  \echo 'ERROR: set -v target_schema=...'
  \q 1
\endif
```

`:{?name}` tests whether a variable is defined, and `\q 1` exits with a failing status.

## Trap 3: substitution is textual, so it is injectable

```console
=== 08c. the trap — a bare :var is textual substitution, not a parameter ===
the value is: 1; DROP TABLE p1_orders_would_be_gone; --
```

```sql
\set danger '1; DROP TABLE something; --'
SELECT * FROM t WHERE id = :danger;    -- becomes: WHERE id = 1; DROP TABLE something; --
```

A bare `:var` is pasted straight into the SQL text. If the value came from anywhere
untrusted — a CI parameter, a filename, a shell argument — this is SQL injection, in your
admin script rather than your application.

The mitigations:

- **`:'var'`** for values — it quotes and escapes, so the same payload becomes a harmless
  string literal.
- **`:"var"`** for identifiers — it quotes and escapes as an identifier.
- **A bare `:var` only for values you wrote yourself** in the same file.

`psql` has no server-side parameter binding for these; `:'var'` client-side quoting is the
strongest tool available. For anything genuinely untrusted, do the work from application
code with real parameters — see
[parameterized queries](/docs/nodejs/pages/phase-6-data-access/parameterized-queries).

## Built-in variables

```console
=== 08e. built-in variables and \unset ===
server 18.4 db devbible user devbible port 55432
hello
:myvar
```

```sql
\echo 'server' :SERVER_VERSION_NAME 'db' :DBNAME 'user' :USER 'port' :PORT
```

Note the last line of the output: after `\unset myvar`, referencing it printed
`:myvar` — the same "unset means literal text" behaviour as above.

Useful built-ins: `DBNAME`, `USER`, `HOST`, `PORT`, `SERVER_VERSION_NAME`,
`VERSION_NUM`, `ROW_COUNT` (rows affected by the last statement), `ERROR` (boolean, did the
last statement fail), `SQLSTATE`, `LAST_ERROR_MESSAGE`. The behavioural ones —
`ON_ERROR_STOP`, `AUTOCOMMIT`, `VERBOSITY`, `ON_ERROR_ROLLBACK` — are set the same way and
listed by `\? variables`.

`ROW_COUNT` and `ERROR` make scripts able to react:

```sql
DELETE FROM sessions WHERE expires_at < now();
\if :ERROR
  \echo 'cleanup failed:' :LAST_ERROR_MESSAGE
  \q 1
\endif
\echo 'deleted' :ROW_COUNT 'sessions'
```

## Trade-off

**Variables make psql scripts parameterisable, at the cost of a substitution model with no
type safety.** `:'var'` covers quoting correctly, but there is no equivalent of a bound
parameter: everything is text assembled before the server sees it, undefined names fail
silently, and `-c` does not participate at all. That is acceptable for migrations and
operational scripts you control end to end. It is not a basis for anything taking outside
input — that belongs in application code with real placeholders.

## Gotchas

**Symptom:** `syntax error at or near ":"` in a `-c` command
**Cause:** `-c` does not interpolate psql variables — measured
**Fix:** Use `-f`, stdin or a heredoc

**Symptom:** A typo'd variable name produces a confusing syntax error
**Cause:** Undefined variables are left as literal text, not reported
**Fix:** Guard with `\if :{?name}` and `\q 1`

**Symptom:** A value with a quote or semicolon breaks or alters the script
**Cause:** A bare `:var` is textual substitution
**Fix:** `:'var'` for values, `:"var"` for identifiers

**Symptom:** `:'var'` produced a quoted string where a table name was needed
**Cause:** Wrong form — `:'…'` makes a literal
**Fix:** `:"var"` for identifiers, bare `:var` for SQL fragments

**Symptom:** A variable set in one psql call is missing in the next
**Cause:** Variables are per-session
**Fix:** Pass with `-v` on each invocation, or keep the work in one session

**Symptom:** `\set x = 5` gives a variable containing `=`
**Cause:** `\set` takes name and value with no equals sign
**Fix:** `\set x 5`

## Interview questions

**★ Are psql variables the same as query parameters?**
No. They are client-side textual substitution performed before the SQL is sent. There is no
binding and no type checking, which is why a bare `:var` is injectable.

**★ What are the three interpolation forms?**
`:var` raw text, `:'var'` a quoted and escaped string literal, `:"var"` a quoted and
escaped identifier. Measured: the same variable produced the literal `status` and the
column value `paid` respectively.

**★ Why does `:'var'` fail with `-c`?**
`-c` does not perform variable interpolation. The same query on stdin or via `-f` works —
measured, syntax error versus the correct answer `4`.

**★ What happens when you reference an undefined variable?**
Nothing is reported; the text is left as-is. In SQL that usually surfaces as
`syntax error at or near ":"`. Guard with `\if :{?name}`.

**★ How do you make a psql script react to a failure?**
`:ERROR`, `:SQLSTATE` and `:LAST_ERROR_MESSAGE` after a statement, combined with
`\if … \endif` and `\q 1` to exit non-zero.

**How do you pass a value from the shell?**
`psql -v name=value`, then reference it — but only from a file or stdin, not `-c`.

**How do you check the number of rows a statement affected?**
The `:ROW_COUNT` variable, set after each statement.

---

← [Query buffer and editor](07-query-buffer.md) · Next → [\copy vs COPY](09-copy.md)
