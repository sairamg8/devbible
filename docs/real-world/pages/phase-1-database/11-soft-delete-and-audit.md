---
title: "Soft delete and audit columns"
sidebar_label: "11 · Soft delete & audit"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against PostgreSQL 17 documentation — triggers, partial
> unique indexes. Concept home:
> [PostgreSQL — DDL](../../../postgresql/pages/phase-3-ddl/README.md).

## The problem

The [schema](01-the-schema/02-carts-orders-reviews-outbox.md) restricts
deleting products that were sold and users that ordered — deliberately. So
"delete" in the admin UI has to mean something else. This chapter defines
that something, narrowly, and wires the `updated_at` convention the schema
promised.

## Soft delete — for exactly one table

```sql
-- 017_soft_delete.sql
alter table products add column deleted_at timestamptz;
```

A product with `deleted_at` set is retired: invisible to the catalog and
search (chapters 04–05 filter `deleted_at is null` from day one, and chapter
10's partial indexes encode it), still present for old orders' item rows and
the admin's history view. `null` means live; the timestamp doubles as "when".

**Why only products.** Soft delete is a *domain* state — "retired from sale" —
not a general safety net:

- **Users** are the opposite case: "delete my account" legally means *erase*,
  not hide. The account path anonymizes — email replaced with a tombstone
  hash, password cleared, sessions cascade-deleted — while orders survive
  with their FK intact (restrict allowed it because the user row remains).
- **Orders** are never deleted at all — `cancelled` is a status, and history
  is the point of the table.
- **Reviews** are moderated (`status = 'rejected'`), which already *is* their
  hidden state; a second hiding mechanism would mean two sources of truth.

The general "soft-delete everything" pattern buys undo at the price of every
query in the system carrying the filter forever, unique constraints needing
partial rewrites, and FKs pointing at rows that pretend not to exist. One
table, one domain meaning, is the honest version.

**The unique-constraint interaction** — the one sharp edge worth pre-empting:
`products.slug` is unique, and a retired product still holds its slug. This
app keeps it that way on purpose (old links and old order pages resolve to
the retired product's page). If relaunching a slug ever becomes a
requirement, the unique constraint becomes a partial index —
`create unique index … on products (slug) where deleted_at is null` — and
the retired rows' slugs get suffixed at delete time. Named now, done never,
unless the requirement arrives.

## `updated_at` — a trigger, not a promise

Every mutable table has `updated_at`, and no application code can be trusted
to remember it. One trigger function, attached where it belongs:

```sql
-- 018_updated_at.sql
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger users_touch    before update on users
  for each row execute function touch_updated_at();
create trigger products_touch before update on products
  for each row execute function touch_updated_at();
create trigger carts_touch    before update on carts
  for each row execute function touch_updated_at();
create trigger orders_touch   before update on orders
  for each row execute function touch_updated_at();
```

This is the app's *only* trigger, and that is a policy: triggers are invisible
control flow, and every one after the first makes the system harder to reason
about. `touch_updated_at` earns its exception by being total (every update),
trivial (one assignment), and impossible to do reliably anywhere else.
Business logic — stock math, outbox writes — stays in
[transactions the code can read](06-the-checkout-transaction/01-the-transaction.md).

**Who reads `updated_at`:** the abandoned-cart sweep (`carts.updated_at <
now() - interval '3 days'`, Phase 2), the admin "recently edited" sort, and —
the quiet one — debugging ("did anything touch this row after the
incident?"). It is an audit *column*, not an audit *log*: who changed what to
what is the audit-logging concept
([Node — audit logging](../../../nodejs/pages/phase-8-security/27-audit-logging.md)),
out of scope here and named as such.

## Using it in the app

Admin "delete product" (Phase 3) is `update products set deleted_at = now()
where id = $1` behind the admin gate; "restore" is the null-ing mirror. The
storefront never sees either — its queries were born filtered.

## Gotchas

- **Symptom:** retired products still appear in search. **Cause:** a new
  query path skipped the `deleted_at is null` filter — the risk soft delete
  carries by design. **Fix:** the data-layer rule (Phase 2): catalog reads go
  through `db/products.js`, which owns the filter; ad-hoc SQL in endpoints
  is the reviewable smell.
- **Symptom:** `updated_at` equals `created_at` on rows you know were edited.
  **Cause:** the edit ran as `insert … on conflict do update` — the trigger
  fires (it is an update), but only if the migration attached it *before*
  the backfill script ran; a missed table in 018 is the likelier cause.
  **Fix:** the trigger list in 018 is reviewed against "tables with
  `updated_at`" — a one-line check in the migration's PR.
- **Symptom:** the seed "un-retires" products on re-run. **Cause:** chapter
  03's upsert sets columns unconditionally, and `deleted_at` isn't in its
  column list — so it *doesn't* touch it. If someone adds it there, retired
  demo products resurrect. **Fix:** leave `deleted_at` out of seed upserts;
  retirement state belongs to the admin flow even in dev.

## Interview questions

1. **★ Why not soft-delete every table?** Because it taxes every query,
   complicates every unique constraint, and turns FKs into references to
   ghosts — for an undo feature most tables never need. Soft delete is right
   where "hidden but present" is a *domain state* (retired products); erasure
   requirements (users) and status machines (orders, reviews) already have
   better-fitting tools.
2. **★ Why is `updated_at` a trigger when the app could set it?** Because
   "the app" is many code paths — endpoints, the worker, migrations, a psql
   session in an incident — and the column is only useful if it is *always*
   right. A `before update` trigger is the one place that sees every write.
   The discipline is keeping triggers at exactly this level of triviality.
3. **How does a retired product's page still render on an old order?** The
   order page joins `order_items → products` with no `deleted_at` filter —
   deliberately. The filter belongs to *discovery* surfaces (catalog,
   search), not to *history* surfaces. Knowing which filter belongs where is
   the whole skill of soft delete.

---

← Prev: [Indexes for this app's queries](10-indexes.md) ·
Next → [LISTEN/NOTIFY](12-listen-notify.md)
