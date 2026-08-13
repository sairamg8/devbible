---
title: "Audit and history tables"
sidebar_label: "19 · Audit and history"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex46-views-triggers.mjs`
> (trigger timing, cost and firing order, over 300 000 orders).

**"Who changed this row, when, and what did it look like before?" is a product
requirement long before it is a compliance one. A trigger-written audit table answers
it for every writer — including the ones that bypass your application.**

## Why a trigger, and not application code

Application-level auditing records what your code did. It misses the migration, the
psql session, the admin script and the second service — exactly the writes you most
want a record of. A trigger is attached to the table, so there is no path around it.

The cost is real but small. Measured, the same `UPDATE` workload with each trigger
arm built on a **fresh** table:

```console
$ node ex46-views-triggers.mjs
no trigger        455.3 ms
statement         447.9 ms      (free, within noise)
row               563.0 ms      (1.24×)
row + WHEN        486.0 ms      (0.86× of the row trigger)
```

**A row trigger costs about 24%.** That is the price of the audit trail, and for most
tables it is worth paying. The `WHEN` line is the lever — more on it below.

## `AFTER`, not `BEFORE` — and why

An audit trigger reacts; it does not change the row. Use `AFTER`, and note what
happens if you confuse the two:

```console
an AFTER trigger's assignment to NEW is silently discarded — the column stayed null
```

No error. The assignment simply does nothing, which is the worst way for a mistake to
behave. The rule is: **`BEFORE` to change the row, `AFTER` to react to it.**

The mirror-image trap on the `BEFORE` side is just as quiet:

```console
RETURN NULL in a BEFORE trigger silently drops the row: 10 submitted, 5 stored,
rowCount reported 5
```

Five rows vanished and `rowCount` agreed with the loss, so nothing downstream could
detect it.

## The table and the trigger

```sql
CREATE TABLE orders_audit (
  audit_id    bigserial PRIMARY KEY,
  order_id    bigint      NOT NULL,
  action      text        NOT NULL,
  old_row     jsonb,
  new_row     jsonb,
  changed_by  text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON orders_audit (order_id, changed_at DESC);
```

```sql
CREATE FUNCTION audit_orders() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO orders_audit (order_id, action, old_row, new_row, changed_by)
  VALUES (COALESCE(NEW.id, OLD.id), TG_OP,
          to_jsonb(OLD), to_jsonb(NEW),
          current_setting('app.user_id', true));
  RETURN NULL;                      -- AFTER triggers ignore the return value
END $$;

CREATE TRIGGER a_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW
  WHEN (TG_OP <> 'UPDATE' OR OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION audit_orders();
```

`to_jsonb(OLD)` and `to_jsonb(NEW)` capture the whole row without naming columns, so
the trigger survives schema changes. `TG_OP` distinguishes the three actions in one
function.

## `WHEN` is where the performance is

The measured `0.86×` above is the whole reason to care about `WHEN`: the condition is
evaluated **before** PostgreSQL enters the `plpgsql` function, so a no-op update never
pays for the call.

```sql
WHEN (OLD.* IS DISTINCT FROM NEW.*)
```

**Move `IF … THEN RETURN NEW` out of the function body and into `WHEN`.** Same logic,
measurably cheaper, because the body never runs.

`IS DISTINCT FROM` rather than `<>` matters here — `<>` is NULL when either side is
NULL, so a column going from `NULL` to a value would not register as a change.

## Statement triggers cannot audit rows

```console
one UPDATE over 1000 rows: row trigger fired 1000×, statement trigger 1×
a statement trigger also fires when the statement matched 0 rows
```

A statement trigger is effectively free, but it fires once per statement with no
access to individual rows. It is the right tool for "something changed in this table",
and the wrong one for a per-row audit trail. It also fires on statements that matched
nothing, so a naive statement-level "changed" flag reports changes that never happened.

## Firing order is alphabetical

```console
firing order is alphabetical by trigger name, not creation order
(created zebra/alpha/middle → fired alpha, middle, zebra)
```

If an audit trigger must observe the state another trigger produces, **name it so it
sorts after** — which is why the trigger above is `a_audit_orders` only if it should
run first. This is a naming decision with behavioural consequences, and it is invisible
in the schema unless you know to look.

## Through your ORM or platform

- **Prisma / Drizzle** — neither manages triggers. Add them in a raw SQL migration and
  keep them in version control; `prisma migrate diff` will not see them, and a
  `db push` against a shadow database can drop them.
- **`current_setting('app.user_id', true)`** is how the trigger learns who is acting,
  and it is set per-transaction with `SET LOCAL`. Behind a transaction pooler a plain
  `SET` lands on whichever backend you get next — measured on the
  [PgBouncer page](../phase-13-ops/07-pgbouncer.md). **Always `SET LOCAL`**, inside the
  same transaction as the write.
- **Supabase** — `auth.uid()` gives you the acting user directly inside the trigger,
  which removes the `SET LOCAL` problem entirely.
- The second argument `true` to `current_setting` means "return NULL if unset" instead
  of raising `42704`. Without it, every write from a context that forgot to set the
  variable fails.

## Trade-off

An audit table doubles the write volume on the audited table and grows without bound,
in exchange for a record no application bug can bypass. Budget for partitioning it by
month ([Partitioning](14-partitioning.md)) or archiving old rows, decide retention
deliberately, and audit the tables that need it rather than all of them — the 1.24×
applies to every write on every audited table.

For "what did this row look like on 3 March", a full history table (one row per
version) is a different and heavier design than an audit log; start with the log unless
point-in-time reconstruction is an actual requirement.

## Gotchas

**Symptom:** The audit trigger sets a column and it stays `NULL`
**Cause:** Assigning to `NEW` in an `AFTER` trigger — measured, silently discarded.
**Fix:** `BEFORE` to change the row, `AFTER` to react.

**Symptom:** Rows disappear on insert and `rowCount` agrees with the loss
**Cause:** `RETURN NULL` in a `BEFORE` trigger — measured, 10 submitted, 5 stored.
**Fix:** `RETURN NEW`. Only return `NULL` when suppression is the intent.

**Symptom:** Audit rows appear for updates that changed nothing
**Cause:** No `WHEN` clause, so every `UPDATE` writes an audit row.
**Fix:** `WHEN (OLD.* IS DISTINCT FROM NEW.*)` — and it is measurably cheaper (0.86×).

**Symptom:** A column going from `NULL` to a value is not audited
**Cause:** `WHEN (OLD.col <> NEW.col)` is NULL, not true, when either side is NULL.
**Fix:** `IS DISTINCT FROM`.

**Symptom:** `changed_by` is always `NULL`
**Cause:** The app never set `app.user_id`, or set it with plain `SET` behind a
transaction pooler so it landed on another backend.
**Fix:** `SET LOCAL app.user_id = $1` inside the same transaction as the write.

**Symptom:** `42704 unrecognized configuration parameter "app.user_id"`
**Cause:** `current_setting` without the `true` second argument, on a connection that
never set it.
**Fix:** `current_setting('app.user_id', true)`.

**Symptom:** Triggers vanished after a migration
**Cause:** The ORM's schema tooling does not know about them.
**Fix:** Raw SQL migrations, checked in, and a test that asserts the trigger exists.

## Interview questions

**★ Why audit with a trigger instead of in application code?**
Because the trigger is attached to the table, so migrations, psql sessions, admin
scripts and other services cannot bypass it — and those are precisely the writes worth
recording. Measured cost is about **1.24×** on the audited table's writes.

**★ Why must an audit trigger be `AFTER` rather than `BEFORE`?**
`AFTER` reacts to the committed shape of the row. Assigning to `NEW` in an `AFTER`
trigger is **silently discarded** — measured, the column stayed `NULL` with no error —
and `RETURN NULL` in a `BEFORE` trigger silently drops the row.

**How do you make an audit trigger cheaper?**
Put the change test in the `WHEN` clause rather than the function body: `WHEN (OLD.*
IS DISTINCT FROM NEW.*)`. `WHEN` is evaluated before the `plpgsql` call, measured at
**0.86×** the cost of the unconditional row trigger.

**Why not a statement trigger?**
It fires once per statement, not once per row — measured, 1× against a row trigger's
1000× over the same `UPDATE` — and it also fires when the statement matched zero rows.
Fine for "this table changed", useless for a per-row trail.

**How does the trigger know which user made the change?**
`current_setting('app.user_id', true)`, set by the application with `SET LOCAL` in the
same transaction. Plain `SET` is unsafe behind a transaction pooler.

---

← [The transactional outbox](18-transactional-outbox.md) · [Phase 12 index](README.md)
