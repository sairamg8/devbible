---
title: "Triggers — BEFORE/AFTER, row versus statement"
sidebar_label: "08 · Triggers"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex46-views-triggers.mjs`.

**A trigger runs code the application cannot see, cannot skip and did not ask
for.** That is exactly why it is right for invariants that must hold no matter
who writes — and why it is the wrong place for business logic.

## BEFORE can change the row; AFTER cannot

```js
// both functions do the same thing: NEW.note = '...'; RETURN NEW;
CREATE TRIGGER t1 BEFORE INSERT ON t_rows FOR EACH ROW EXECUTE FUNCTION t_before();
CREATE TRIGGER t2 AFTER  INSERT ON t_rows FOR EACH ROW EXECUTE FUNCTION t_after();
```

```console
$ node ex46-views-triggers.mjs
=== 6. BEFORE can change the row; AFTER cannot ===
after a BEFORE trigger: { note: 'set by BEFORE' }
after an AFTER trigger : { note: null }
↑ the AFTER trigger assigned NEW.note and it was discarded — the row is already written
```

**The `AFTER` trigger assigned `NEW.note` and nothing happened.** No error, no
warning — the row was already written, so its return value is ignored.

That is the whole distinction:

| | `BEFORE` | `AFTER` |
|---|---|---|
| Can modify `NEW` | **yes** | no — assignment is silently discarded |
| Can cancel the row | **yes**, `RETURN NULL` | no |
| Sees the final row | not necessarily | **yes**, including generated values |
| Use for | defaults, normalisation, validation | auditing, notifications, cascades |

The rule: **`BEFORE` to change the row, `AFTER` to react to it.** A stamp like
`updated_at` must be `BEFORE` — measured in
[created_at/updated_at](../phase-9-api-crud/17-timestamps-trigger.md), where the
trigger's whole value is that it fires on writes the application never made.

## Row versus statement

```console
=== 7. FOR EACH ROW vs FOR EACH STATEMENT ===
┌─────────┬────────────────────┬──────┐
│ (index) │ what               │ c    │
├─────────┼────────────────────┼──────┤
│ 0       │ 't_row/ROW'        │ 1000 │
│ 1       │ 't_stmt/STATEMENT' │ 1    │
└─────────┴────────────────────┴──────┘
↑ one UPDATE touching 1000 rows: the row trigger fired 1000 times, the statement trigger once
after an UPDATE matching 0 rows: [ { what: 't_stmt/STATEMENT', c: 1 } ]
```

One `UPDATE` over 1000 rows: **1000 row-level firings, 1 statement-level firing.**

And the line below it is the one that catches people: an `UPDATE` matching **zero
rows still fired the statement trigger**. A statement trigger fires per statement
regardless of how many rows were affected — including none. An audit trigger
written at statement level will log operations that changed nothing.

Statement triggers get the affected rows through **transition tables**, which is
what makes them usable for bulk auditing:

```sql
CREATE TRIGGER audit_changes
AFTER UPDATE ON orders
REFERENCING OLD TABLE AS before NEW TABLE AS after
FOR EACH STATEMENT EXECUTE FUNCTION log_changes();
```

Inside the function, `before` and `after` are queryable relations. One insert of
1000 audit rows instead of 1000 separate inserts.

## What each level costs

Each arm below runs against a **freshly built table**, because re-updating one
table across arms leaves dead tuples behind and the later arms would look slower
from bloat rather than from triggers. 50 000 rows, one `UPDATE`:

```console
=== 8. cost of the two levels ===
no trigger            455.3 ms
statement trigger     447.9 ms
row trigger           563.0 ms
row + WHEN clause     486.0 ms

row trigger vs no trigger        : 1.24x
WHEN clause vs unconditional row : 0.86x
```

**A statement trigger is free** — 447.9 ms against a 455.3 ms baseline, i.e.
identical within noise. It fires once.

**A row trigger costs about 24%**, even doing nothing but `RETURN NULL`. That is
50 000 `plpgsql` invocations.

**A `WHEN` clause recovers a good part of it** — 486.0 ms, 0.86× the
unconditional row trigger:

```sql
CREATE TRIGGER p_row_when AFTER UPDATE ON t_perf FOR EACH ROW
  WHEN (OLD.v IS DISTINCT FROM NEW.v AND NEW.v % 1000 = 0)
  EXECUTE FUNCTION t_noop();
```

The condition is evaluated by the executor *before* the function call, so
non-matching rows never enter `plpgsql`. **If a row trigger starts with `IF ...
THEN RETURN NEW; END IF;`, move that condition into a `WHEN` clause** — same
semantics, and the common case skips the function entirely.

`WHEN` cannot be used on `INSTEAD OF` triggers, and cannot reference `OLD` on
`INSERT` or `NEW` on `DELETE`.

## `RETURN NULL` cancels the row — silently

```console
=== 9. RETURN NULL in a BEFORE trigger cancels the row ===
inserted 10 rows, rowCount reported: 5
rows actually present: 5
↑ RETURN NULL silently drops the row and rowCount does not reflect it
```

A `BEFORE` trigger returning `NULL` skips the row. Ten rows were submitted, five
stored — and `rowCount` reported **5**, not 10.

That is better than it could be: the count does tell the truth about what was
written. But nothing tells the *caller* that half its input was dropped, and an
application checking `rowCount === rows.length` is the only thing standing
between a silent filter and a data-loss bug. If a trigger can veto rows, the
application needs to know that and check.

For a hard rejection, raise instead — `RAISE EXCEPTION USING ERRCODE = '23514'`
gives the caller an error to map, which is what
[errors to HTTP](../phase-9-api-crud/01-repository/03-errors-to-http.md) is about.

## Firing order is alphabetical

```console
=== 10. firing order is alphabetical by trigger name ===
created zebra, alpha, middle — fired in this order:
   alpha/ROW → middle/ROW → zebra/ROW
```

Created `zebra`, `alpha`, `middle`; fired **alphabetically**, not in creation
order. When two triggers on the same table both modify `NEW`, the name decides
who wins.

This is why you see triggers named `01_normalise`, `02_validate`, `03_stamp` in
codebases that depend on ordering. Relying on it implicitly is a bug waiting for
someone to add a trigger called `audit`.

Within one table the full order is: all `BEFORE STATEMENT`, then per row all
`BEFORE ROW`, the operation, all `AFTER ROW`, then all `AFTER STATEMENT`.

## What triggers are right for

**Yes:** invariants that must hold regardless of who writes — `updated_at`, audit
trails, denormalised counters, `tsvector` maintenance (though a
[generated column](05-full-text/02-indexing-and-ranking.md) is better where it
fits), and enforcing rules a `CHECK` constraint cannot express.

**No:** anything a reader of the application code needs to know about. A trigger
that sends email, calls an external service, or implements a business rule makes
the application's behaviour unexplainable from the application's source. The
classic symptom is a developer unable to work out why a row changed.

**Never:** anything with a side effect outside the database. A trigger runs inside
the transaction, so an HTTP call from one holds the transaction open for its
duration ([transaction duration](../phase-9-api-crud/05-transactions-request/02-savepoints-and-duration.md))
and cannot be rolled back if the transaction aborts. Use
[LISTEN/NOTIFY](13-listen-notify.md) or an
outbox table and do the work outside.

## Trade-off

A trigger's strength and its weakness are the same property: **it is invisible
from the application.** That is what makes `updated_at` trustworthy — the
migration and the `psql` fix-up cannot skip it — and what makes a business rule
in a trigger a maintenance problem, because nothing in the application's source
explains the behaviour.

The cost is also real but small for statement-level work and moderate for
row-level: measured, 1.24× on a bulk update for a trigger doing nothing at all.

The line worth holding: triggers maintain *data* — stamps, audit rows, derived
columns, counters. Application code decides *behaviour*. When you find yourself
writing a condition about a business process inside a trigger, that is the signal
it belongs in the service layer.

## Gotchas

**Symptom:** An `AFTER` trigger's changes to `NEW` do not appear
**Cause:** The row is already written; an `AFTER` trigger's return value is
ignored. Measured: the column stayed `null`.
**Fix:** `BEFORE` for anything that modifies the row.

**Symptom:** An audit trigger logs operations that changed nothing
**Cause:** A statement trigger fires even when the statement matched zero rows —
measured, it fired on an `UPDATE ... WHERE id = -1`.
**Fix:** Row-level, or check the transition table before logging.

**Symptom:** A bulk update is much slower than expected
**Cause:** A row-level trigger runs `plpgsql` once per row. Measured 1.24× for a
trigger whose body is `RETURN NULL`.
**Fix:** Statement-level with transition tables, or a `WHEN` clause to skip
non-matching rows — measured 0.86× of the unconditional version.

**Symptom:** Rows silently missing after an insert
**Cause:** A `BEFORE` trigger returned `NULL`. Measured: 10 submitted, 5 stored,
`rowCount` reported 5.
**Fix:** Check `rowCount` against what you sent, or `RAISE EXCEPTION` so the
caller gets an error instead of a silent drop.

**Symptom:** Two triggers interact differently after one is renamed
**Cause:** Firing order is alphabetical by trigger name, not creation order.
**Fix:** Name them with an explicit numeric prefix if order matters.

**Symptom:** A transaction hangs or holds connections
**Cause:** A trigger performing an external call inside the transaction.
**Fix:** Write to an outbox table; do the external work outside.

**Symptom:** Infinite recursion
**Cause:** A trigger updating the table it fires on.
**Fix:** Guard with `pg_trigger_depth() = 1`, or a `WHEN` clause that stops the
second pass.

## Interview questions

**★ What is the difference between a `BEFORE` and an `AFTER` trigger?**
`BEFORE` runs before the row is written, so it can modify `NEW` and can cancel the
row by returning `NULL`. `AFTER` runs once the row exists — measured, an `AFTER`
trigger assigning `NEW.note` had no effect at all and the column stayed `null`.
Use `BEFORE` to change data, `AFTER` to react to it.

**★ Row-level or statement-level?**
A row trigger fires once per affected row, a statement trigger once per
statement — measured, 1000 and 1 for the same `UPDATE`. The statement trigger also
fires when the statement matched **zero** rows. Statement level with `REFERENCING
OLD TABLE / NEW TABLE` is how you audit bulk changes in one insert.

**★ What do triggers cost?**
Measured on a 50 000-row update against a freshly built table: statement trigger
447.9 ms vs a 455.3 ms baseline — free, within noise. A row trigger doing nothing
but `RETURN NULL` cost 1.24×. A `WHEN` clause brought that to 0.86× of the
unconditional row trigger, because the condition is checked before the `plpgsql`
call.

**★ What does `RETURN NULL` in a `BEFORE` trigger do?**
It silently skips the row. Measured: 10 rows submitted, 5 stored. `rowCount`
reported 5, so the count is honest, but nothing tells the caller its input was
filtered. Prefer `RAISE EXCEPTION` when the caller should know.

**In what order do multiple triggers on one table fire?**
Alphabetically by trigger name — measured, `zebra`, `alpha`, `middle` fired as
alpha, middle, zebra regardless of creation order. Name them with numeric
prefixes if the order matters.

**When should logic NOT be in a trigger?**
When it is business behaviour rather than data maintenance, because nothing in the
application's source explains it. And never anything with an external side
effect — a trigger runs inside the transaction, so an HTTP call holds the
transaction open and cannot be rolled back. Use an outbox or `LISTEN`/`NOTIFY`.

---

← [Views](07-views.md) · Next → [Extensions](09-extensions.md)
