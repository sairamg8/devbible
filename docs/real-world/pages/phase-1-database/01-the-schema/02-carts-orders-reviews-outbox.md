---
title: "Carts, orders, reviews and the outbox"
sidebar_label: "2 · Carts, orders & outbox"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span> · Chapter 2 of
[The schema](README.md)

> Verified: 2026-08 against PostgreSQL 17 documentation — check constraints,
> partial and composite unique indexes, enum types, foreign key actions.

## The problem

The transactional half of the schema carries the spec's hardest promises:
a cart belongs to a session *or* a user, never both; replaying a checkout
cannot create a second order; an order's prices never change after purchase;
only verified buyers review, once; and a committed order's side-effects are
never lost. Each promise becomes a constraint here, so no later chapter has to
re-earn it in application code.

## The DDL

```sql
create table carts (
  id         bigint generated always as identity primary key,
  session_id bigint references sessions (id) on delete cascade,
  user_id    bigint references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- exactly one owner: a guest cart or an account cart, never both, never neither
  check (num_nonnulls(session_id, user_id) = 1)
);

-- one live cart per owner
create unique index carts_one_per_session on carts (session_id)
  where session_id is not null;
create unique index carts_one_per_user on carts (user_id)
  where user_id is not null;

create table cart_items (
  cart_id    bigint not null references carts (id) on delete cascade,
  product_id bigint not null references products (id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  primary key (cart_id, product_id)
);

create type order_status as enum
  ('pending', 'paid', 'shipped', 'delivered', 'cancelled');

create table orders (
  id              bigint generated always as identity primary key,
  user_id         bigint not null references users (id) on delete restrict,
  status          order_status not null default 'pending',
  address         jsonb not null,
  total_cents     bigint not null check (total_cents >= 0),
  idempotency_key text not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table order_items (
  order_id         bigint not null references orders (id) on delete cascade,
  product_id       bigint not null references products (id) on delete restrict,
  quantity         integer not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  primary key (order_id, product_id)
);

create type review_status as enum ('pending', 'approved', 'rejected');

create table reviews (
  id         bigint generated always as identity primary key,
  product_id bigint not null references products (id) on delete cascade,
  user_id    bigint not null references users (id) on delete cascade,
  order_id   bigint not null references orders (id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  body       text not null default '',
  status     review_status not null default 'pending',
  created_at timestamptz not null default now(),
  -- one review per product per order — "verified purchase" as a key
  unique (order_id, product_id)
);

create table review_images (
  id         bigint generated always as identity primary key,
  review_id  bigint not null references reviews (id) on delete cascade,
  object_key text not null,
  position   integer not null check (position between 0 and 2),
  unique (review_id, position)
);

create table outbox (
  id           bigint generated always as identity primary key,
  topic        text  not null,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);
```

## The constraints that carry the spec

**`num_nonnulls(session_id, user_id) = 1`** is the either-or rule as one
expression — clearer than the equivalent `(a is null) <> (b is null)` and it
generalizes. With the two partial unique indexes, "one live cart per owner"
holds even under concurrent inserts; the merge-on-login logic (Phase 3) can
`insert … on conflict` against them instead of racing a select.

**`cart_items` and `order_items` use composite primary keys.** The row *is*
the pair — a surrogate `id` would add a column no query ever uses and permit
duplicate pairs unless a unique constraint re-stated the key anyway. The
`primary key (cart_id, product_id)` is also what makes "add to cart again" an
upsert target (chapter 04's queries use it).

**`orders.idempotency_key` is `unique` — checkout replay safety lives here.**
The endpoint (Phase 3) generates nothing: the client sends the key, and a retry
of the same checkout collides on this index instead of inserting a second
order. The checkout transaction chapter (06) shows the `on conflict` path that
turns the collision into "return the original order".

**`reviews.unique (order_id, product_id)`** is the verified-purchase rule as a
key: the review points at the order that entitles it, and a second review from
the same purchase is a constraint violation, not a moderation problem.
`review_images.position between 0 and 2` is the spec's three-photo cap.

**`on delete restrict` wherever history must survive.** Users with orders
(`orders.user_id`) and products that were ever sold (`order_items.product_id`)
cannot be hard-deleted — the restriction *documents* that deletion here means
soft delete (chapter 11), and makes the wrong kind fail loudly.

**The `outbox` has no delivery state machine — `processed_at` is it.** A row
with `processed_at null` is due; the worker (Phase 2) claims batches with
`for update skip locked` and stamps them only after the send succeeds. Written
in the same transaction as the order, it commits or vanishes with it — the
[dual-write problem](../../../../nodejs/pages/phase-7-background-work/06-transactional-outbox.md)
never starts.

## Using it in the app

Chapter 06 runs the checkout transaction across `carts` → `orders` →
`order_items` → `products.stock` → `outbox`. Phase 2's worker drains `outbox`;
Phase 3's endpoints own everything else. Nothing outside Phase 1 issues DDL.

## Gotchas

- **Symptom:** checkout retries return *duplicate key value violates unique
  constraint "orders_idempotency_key_key"* to the user. **Cause:** the
  constraint did its job but the endpoint treated the collision as an error
  instead of a replay. **Fix:** chapter 06's pattern — catch the conflict,
  fetch the existing order by key, return it with the original status code.
- **Symptom:** a user's guest cart disappears on login instead of merging.
  **Cause:** the login path inserted an account cart, hit
  `carts_one_per_user`, and dropped the guest rows on the floor. **Fix:** the
  merge is item-level — upsert each `cart_items` row into the account cart,
  then delete the guest cart. Phase 3's cart chapter implements it.
- **Symptom:** the outbox grows forever. **Cause:** `processed_at` marks rows
  done but nothing deletes them. **Fix:** deliberate — processed rows are an
  audit trail first, then a retention job (Phase 2's scheduled-jobs chapter)
  prunes them after 30 days. Deleting on ack would destroy the replay story.
- **Symptom:** *update or delete on table "products" violates foreign key
  constraint* when an admin removes a product. **Cause:** the product was
  sold — `order_items` restricts. **Fix:** working as designed; the admin path
  soft-deletes (chapter 11) and the catalog queries filter it out.

## Interview questions

1. **★ Why does the idempotency key live as a unique column instead of a
   check in application code?** An application check is read-then-write:
   two concurrent replays both read "no such key" and both insert. The unique
   index makes one of them lose *atomically*, whatever the timing — and the
   loser's error is catchable and convertible into "return the first result".
   Uniqueness under concurrency is a database problem; this is the database
   solving it.
2. **★ Why `for update skip locked` for outbox draining rather than plain
   `select`?** Plain select lets two workers claim the same rows; `for update`
   alone makes the second worker queue behind the first, serializing the whole
   drain. `skip locked` gives each worker the unclaimed remainder —
   contention-free parallel consumption with no coordinator. The
   [cursors and locking material](../../../../postgresql/README.md) covers the
   mechanics.
3. **Why composite primary keys on the item tables?** The pair is the natural
   identity: one row per product per cart/order. A surrogate key would allow
   duplicates (until a unique constraint restated the pair) and add eight
   bytes per row that no join ever touches. Surrogates earn their place when
   rows need external references — nothing references a cart item.
4. **Why is the outbox in the same database as the orders, not a queue
   service?** Because the enqueue must be atomic with the order insert —
   commit both or neither. A separate broker reintroduces the dual-write
   problem the outbox exists to kill. The trade-off (polling, table growth)
   is real and priced in at this app's scale; the architecture page carries
   the full argument.
5. **What stops two `pending` reviews for the same product from one buyer who
   ordered it twice?** Nothing — and that is correct. The spec's rule is one
   review *per purchase*, and each order is a purchase. The unique key
   encodes the actual rule instead of an over-strict "one per user" that the
   spec never asked for.

---

← Prev: [Conventions, identity and catalog](01-conventions-identity-catalog.md) ·
Topic index: [The schema](README.md) · Next chapter → **Migrations as plain
SQL** *(not written yet)*
