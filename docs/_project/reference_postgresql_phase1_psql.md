---
name: devbible-postgresql-phase1-psql
description: The measured dataset behind the 15 Phase 1 psql pages — the -c interpolation trap, \i vs \ir, COPY vs \copy, exit codes, and the two shell measurement scripts
metadata:
  type: reference
---

# PostgreSQL Phase 1 (psql) — measured findings

Landed session 5 (2026-08-12), immediately after Phase 11. All 15 pages rewritten from
stamps, 170–244 lines each. **First shell scripts in the sandbox**:
`ex31-psql-basics.sh` (pages 01–08) and `ex32-psql-io.sh` (pages 09–15).

Host `psql` is **18.4**, matching the server exactly — so pages show the realistic
developer setup (host client → `127.0.0.1:55432`), not `podman exec`.

Parent: [[devbible-postgresql-rewrite-handoff]]

## The results that contradicted the obvious expectation

- **`psql -c` does NOT interpolate `:variables`.** Same variable, same query:
  `-c` → `ERROR: syntax error at or near ":"`; stdin → `4`; `-f` → `4`. The error points
  at the colon and gives no hint the mechanism is simply off. This confounded another
  test before it was spotted.
- **An undefined psql variable is left as literal text, silently.** `\echo :nosuchvar`
  prints `:nosuchvar`; in SQL it reaches the server and fails as a syntax error. Guard
  with `\if :{?name}` + `\q 1`.
- **Without `ON_ERROR_STOP`, a failed script exits 0.** Measured: the file printed the
  error, carried on, inserted the following row, `exit=0`. With `ON_ERROR_STOP=1`:
  `exit=3`. Exit codes are 0 ok / 1 psql error / 2 connection / **3 SQL error, only ever
  with ON_ERROR_STOP**.
- **`\i` vs `\ir`**: identical files run from the script's own directory both work; run
  from `/`, `\i` fails `No such file or directory` and `\ir` works. Use `\ir` always.
- **A wrong username and a wrong password give the identical error** —
  `password authentication failed for user "…"` for both. Deliberate.
- **`HISTFILE` is unset by default** (prints unexpanded); psql falls back to
  `~/.psql_history`, and default `HISTSIZE` is only **500**.
- **`inet_server_port()` says 5432 while `\conninfo` says 55432** — server's own view vs
  the client's view of a published container port. Both correct.
- **`\watch` header time is CLIENT local time; the query's `now()` is the SERVER zone.**
  Measured `05:57:21 PM IST` header against `12:27:21` in the result (machine is
  Asia/Calcutta, server UTC). Do not compare the two columns.

## Numbers on the pages

- `\timing` **617.0 ms** vs `EXPLAIN ANALYZE` `Execution Time` **615.5 ms` on a local
  one-row result — they agree locally; the gap is transfer + rendering.
- `pg_sleep(0.25)` → `\timing` **251.352 ms** (≈1 ms round-trip floor).
- **`\copy` bad row aborts everything**: 3-row file, one bad numeric → **0 rows loaded**,
  and `CONTEXT: COPY p1_import, line 3, column amount: "not-a-number"` names line, column
  and value.
- Server-side `COPY` error carries PostgreSQL's own **HINT** recommending `\copy` — the
  whole page in one line.
- **SQLSTATEs, each produced by actually causing the error** (not a typed list):
  23505 dup key · 23514 check · 23502 not null · 23503 FK · 22P02 bad text · 42P01
  undefined table · 42703 undefined column · 22012 div by zero · 42601 syntax.
- **psql `\errverbose` fields map 1:1 to `pg`'s error object** — captured side by side:
  `SQLSTATE`→`e.code`, `CONSTRAINT NAME`→`e.constraint`, `TABLE NAME`→`e.table`,
  `DETAIL`→`e.detail`. Node printed
  `{"code":"23505","constraint":"p1_import_pkey","detail":"Key (id)=(1) already exists.","table":"p1_import"}`.
- **Pipelines swallow the exit code**: `psql … | cat` → `naive exit=0`; with
  `set -o pipefail` → `exit=1`.
- **`\dp` notation** `grantee=privileges/grantor`, e.g. `p1_reader=r/devbible`; letters
  r/w/a/d/D/x/t and **m = MAINTAIN (PG17+)**.
- **`.psqlrc` vs `-X` proved**: same query printed `(null)` with the file loaded and blank
  with `-X`.

## Traps hit while measuring

- `DROP OWNED BY <nonexistent role>` inside an `ON_ERROR_STOP=1` heredoc aborted the whole
  block, so the reader role was never created and all four privilege demos failed with
  auth errors. Guard cleanup statements outside the strict block.
- My first 14c section just `SELECT`ed a list of SQLSTATEs I had typed by hand and labelled
  it "straight from the server". Rewritten to trigger each error for real.
  [[devbible-verify-your-own-measurements]].
- `inet_server_addr()` is NULL over the unix socket, so a `||` concatenation produced empty
  output inside the container demo. Use `coalesce`.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-phase11-mvcc]] ·
[[devbible-verify-your-own-measurements]]
