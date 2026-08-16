---
title: "Conventions, identity and catalog"
sidebar_label: "1 · Conventions & catalog"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span> · Chapter 1 of
[The schema](README.md)

> Verified: 2026-08 against PostgreSQL 17 documentation — identity columns,
> `citext`, enum types, generated columns, `tsvector`.

## The problem

The [spec](../../phase-0-the-app/01-the-storefront-spec.md) fixes rules the
data must never violate: emails are unique, a product's slug identifies it
publicly, prices are exact. The first half of the schema holds who people are
and what is for sale.

## Three conventions, argued once

**Keys are `bigint` identity columns.**
`GENERATED ALWAYS AS IDENTITY` is the standard-SQL successor to `serial` — it
rejects accidental manual inserts into the key and doesn't leave a separately
owned sequence behind. `bigint` because `int` overflows at 2.1 billion rows,
and the cost of being wrong is a migration on your hottest tables. UUIDs are
the right call when keys are generated client-side or across services; this
app generates every key in one database, so the smaller, ordered, index-friendly
`bigint` wins. Trade-off: keys are guessable, so **nothing authorizes by key
possession** — ownership checks (Phase 3) do that.

**Every timestamp is `timestamptz`.**
Plain `timestamp` stores a wall-clock reading with no zone; `timestamptz`
stores an instant. Servers, workers and the browser all convert at the edge.
The [Node time page](../../../../nodejs/pages/phase-7-background-work/10-time-on-the-server.md)
carries the bug class this prevents.

**Money is integer cents.**
`price_cents bigint` survives JSON, JavaScript arithmetic and `pg`'s type
mapping exactly. `numeric` is Postgres-exact but arrives in Node as a *string*
(the [pg type-mapping page](../../../../postgresql/pages/phase-7-pg-driver/README.md)
explains why), pushing parsing to every call site. Chapter 07 completes the
argument; the schema commits to it.

## The DDL

```sql
-- 001_extensions.sql
create extension if not exists citext;

-- roles as an enum: two values today, alterable tomorrow
create type user_role as enum ('customer', 'admin');

create table users (
  id            bigint generated always as identity primary key,
  email         citext not null unique,
  password_hash text   not null,
  role          user_role not null default 'customer',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table sessions (
  id         bigint generated always as identity primary key,
  user_id    bigint references users (id) on delete cascade,  -- NULL = guest
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table categories (
  id        bigint generated always as identity primary key,
  name      text not null,
  slug      text not null unique,
  parent_id bigint references categories (id) on delete restrict,
  -- spec: one level deep — a child may not itself be a parent's child
  check (parent_id is distinct from id)
);

create table products (
  id          bigint generated always as identity primary key,
  category_id bigint not null references categories (id) on delete restrict,
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  price_cents bigint not null check (price_cents >= 0),
  attributes  jsonb not null default '{}'::jsonb,
  stock       integer not null default 0 check (stock >= 0),
  search      tsvector generated always as (
                to_tsvector('english', name || ' ' || description)
              ) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table product_images (
  id         bigint generated always as identity primary key,
  product_id bigint not null references products (id) on delete cascade,
  object_key text not null,
  position   integer not null default 0,
  unique (product_id, position)
);
```

## The choices worth defending

**`citext` for email.** Case-insensitive uniqueness at the type level —
`Ana@x.com` and `ana@x.com` are one account. The alternative, `unique (lower(email))`,
works but every lookup must remember `lower()`; the type makes forgetting
impossible. Cost: an extension dependency, declared in the first migration.

**`sessions.user_id` is nullable — that is the guest.** The
[architecture page](../../phase-0-the-app/02-architecture-and-data-model.md)
anchors guest carts to sessions; a session row with `user_id null` *is* an
anonymous visitor. `on delete cascade` means deleting a user logs them out
everywhere — a security property, not housekeeping.

**`stock` has `check (stock >= 0)`.** Overselling becomes a database error
instead of a data bug. The checkout chapter (06) leans on this: its
`update … set stock = stock - $1` cannot race its way below zero, because the
constraint is checked on the row the update actually sees.

**`search` is a stored generated column.** The alternative — a trigger keeping
a `tsvector` in sync — is the pre-Postgres-12 pattern and one more moving part.
Generated-always means the search column *cannot* drift from the text. Chapter
05 builds on it; the GIN index arrives in chapter 10 with the rest.

**`on delete restrict` for category → product.** Deleting a category with
products should fail loudly and make a human decide. `cascade` here would let
an admin typo delete half the catalog.

## Using it in the app

These five tables are what Phase 3's auth endpoints (`users`, `sessions`) and
catalog endpoints (`categories`, `products`, `product_images`) query. Nothing
writes `products.search` — it maintains itself.

## Gotchas

- **Symptom:** `insert into users (id, …)` fails with *cannot insert a non-DEFAULT
  value into column "id"*. **Cause:** `generated always` rejects manual keys.
  **Fix:** that is the feature. Seeds (chapter 03) use `overriding system value`
  in the one place restoring fixed IDs is legitimate.
- **Symptom:** product updates slow down after adding a long description.
  **Cause:** the stored `tsvector` re-computes on every update of `name` or
  `description` — that is its contract. **Fix:** expected and fine at this
  app's write rate; if writes ever dominate, the trigger pattern trades
  consistency-by-construction for cheaper writes. Name the trade before making
  it.
- **Symptom:** `citext` works locally, fails in CI with *type "citext" does not
  exist*. **Cause:** the extension migration didn't run in that database.
  **Fix:** extensions are migration 001 and migrations run everywhere — the
  ordering rule chapter 02 enforces.

## Interview questions

1. **★ Why `generated always as identity` over `serial`?** `serial` is a
   pre-SQL-standard shorthand: it creates a sequence the table doesn't own and
   happily accepts manual inserts that desync it. Identity columns are
   standard SQL, own their sequence, and `always` makes bypassing them a
   deliberate act (`overriding system value`) instead of an accident.
2. **★ Why does `check (stock >= 0)` matter when the app also checks stock?**
   The app's check reads then writes — two statements, raceable. The
   constraint is evaluated atomically against the row the write actually
   lands on. The app check gives users a friendly error; the constraint makes
   the invariant true. Belt and braces, and the braces are load-bearing.
3. **Why is the category tree restricted to one level in the schema, not just
   the docs?** `check (parent_id is distinct from id)` blocks self-reference,
   and one-level depth is enforced by the insert path refusing parents that
   themselves have parents. What the schema can express cheaply it expresses;
   what needs a recursive check stays in code — with the reasoning written
   next to it.
4. **Why do images live in a separate table instead of a `jsonb` array on
   products?** Position needs uniqueness per product (`unique (product_id,
   position)`), rows can cascade-delete with the product, and the upload
   service (Phase 2) inserts them independently. A jsonb array gives none of
   that structure — chapter 08 draws the jsonb line in detail.
5. **What breaks if `sessions` cascade-deletes are changed to `set null`?**
   Deleted users would leave live anonymous sessions holding their old
   carts — a privacy leak wearing a convenience costume. Cascade makes
   account deletion mean *logged out everywhere, cart gone*.

---

Next → [Carts, orders, reviews and the outbox](02-carts-orders-reviews-outbox.md) ·
Topic index: [The schema](README.md)
