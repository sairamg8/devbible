---
title: "Procedures versus functions"
sidebar_label: "15 · Procedures"
sidebar_position: 15
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex47-functions.mjs`.

**A procedure exists for one reason: it can `COMMIT` in the middle of its own
body.** With Node, Python or Java in front of the database you control transactions
from the application, so this is a tool you will probably never reach for — which
is exactly why it is tiered *Learn When Needed*.

## The one real difference

```sql
CREATE PROCEDURE f_proc() AS $$
BEGIN
  INSERT INTO f_batch VALUES (1);
  COMMIT;
  INSERT INTO f_batch VALUES (2);
  COMMIT;
END $$ LANGUAGE plpgsql;
```

```console
$ node ex47-functions.mjs
=== 4. procedures vs functions — COMMIT inside the body ===
CALL a procedure that COMMITs                → OK
  rows after the CALL: 2
the same COMMIT inside a FUNCTION            → 2D000 invalid transaction termination
```

The procedure committed twice mid-body. **The identical code in a function raises
`2D000 invalid transaction termination`** — a function runs inside the caller's
transaction and may not end it.

| | Function | Procedure |
|---|---|---|
| Invoked with | `SELECT f()` | **`CALL p()`** |
| Returns | a value or a set | nothing (or `INOUT` parameters) |
| Can `COMMIT` / `ROLLBACK` | **no** — `2D000` | **yes**, when not already in a transaction |
| Usable in a query | yes | no |

Two errors worth recognising:

```console
SELECT a procedure instead of CALLing it     → 42809 f_proc() is a procedure
```

`42809` is what you get for using the wrong invocation form — procedures cannot
appear in a `SELECT` because they return no rows to select.

## The catch that removes most of the use case

```console
CALL inside an explicit transaction           → 2D000 invalid transaction termination
```

**A procedure cannot commit if the caller already opened a transaction.** It only
gets transaction control when it is called with no transaction in progress.

That matters directly for application code: the moment you use the
[transaction wrapper](../phase-9-api-crud/05-transactions-request/01-the-wrapper.md)
this corpus recommends — `BEGIN`, work, `COMMIT` on one checked-out client — any
procedure you `CALL` inside it is back to being a function with extra steps. The
committing behaviour only appears when the procedure is the *outermost* unit of
work.

So a procedure is useful when the database is driving: a scheduled batch job, a
maintenance routine, a data migration run from `psql`. Not when an application
server owns the transaction.

## When it is genuinely the right tool

The honest list, for a stack with an application server:

- **A long batch that must commit in chunks** — process a million rows in
  batches of ten thousand so one failure does not lose the whole run and the
  transaction never grows enormous. Doing this from the application means a round
  trip per batch; a procedure keeps the loop next to the data.
- **A maintenance routine run by a scheduler** (`pg_cron`, a cron job invoking
  `psql`), where there is no application in the path at all.

That is close to the whole list. A "business operation" that must be atomic wants a
transaction, not a procedure — and the application already has one.

## Trade-off

Everything in [PL/pgSQL](12-plpgsql.md) applies, plus one addition: a procedure's
mid-body commits mean **a failure leaves the work partly done**. That is the point —
chunked batches are resumable — but it makes the procedure responsible for its own
restart logic. It must record progress somewhere durable and be safe to re-run from
where it stopped, which is real design work, not a keyword.

Compare it honestly against the application-side alternative: a loop in Node or
Python issuing one batch per iteration, each in its own transaction. That costs a
round trip per batch and gets you normal logging, normal error handling, normal
deployment and normal testing. For most batch sizes the round trip is irrelevant
next to the work, which is why this stays a *When Needed* topic.

## Gotchas

**Symptom:** `2D000 invalid transaction termination`
**Cause:** Either `COMMIT` inside a **function**, or `CALL` of a committing
procedure **inside an explicit transaction**. Measured: both.
**Fix:** Use a procedure, and call it with no transaction open.

**Symptom:** `42809 ... is a procedure`
**Cause:** `SELECT p()` instead of `CALL p()`.
**Fix:** `CALL`. Procedures return no rows and cannot appear in a query.

**Symptom:** A procedure's commits do nothing inside the application's transaction
**Cause:** The application's `withTransaction` wrapper already opened one, so the
procedure has no transaction control.
**Fix:** Call it outside the wrapper, or accept that it is one atomic unit.

**Symptom:** A chunked batch left the data half-processed after a failure
**Cause:** Working as designed — mid-body commits are not rolled back.
**Fix:** Record progress durably and make the procedure resumable.

## Interview questions

**★ What can a procedure do that a function cannot?**
Commit or roll back inside its own body. Measured: a procedure with two `COMMIT`s
ran and left both rows; the same code in a function raised `2D000 invalid
transaction termination`, because a function runs inside the caller's transaction
and may not end it.

**★ How do you invoke each?**
`SELECT f()` for a function, `CALL p()` for a procedure. Using the wrong one gives
`42809`. A procedure returns no rows, so it cannot appear in a query.

**★ What is the catch with a procedure's transaction control?**
It only has it when no transaction is already open. Measured: `CALL` inside an
explicit transaction raised `2D000`. So inside an application that wraps requests
in `BEGIN`/`COMMIT`, a procedure behaves like a function.

**When is a procedure actually the right tool?**
A long batch that must commit in chunks so a failure does not lose the whole run,
or a maintenance routine driven by a scheduler with no application in the path. If
an application server owns the transaction, it is almost never the right tool —
which is why this sits at *Learn When Needed*.

---

← [Partitioning](14-partitioning.md) · Next → [Foreign data wrappers](16-fdw.md)
