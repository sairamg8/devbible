---
title: "Architecture and the data model"
sidebar_label: "02 · Architecture & data model"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. Design page — the process and table layout every chapter
> builds inside. Composes concepts from
> [Node — graceful shutdown](../../../nodejs/pages/phase-5-http-processes/17-graceful-shutdown.md),
> [Node — data access](../../../nodejs/pages/phase-6-data-access/README.md) and
> [PostgreSQL — Node + raw pg](../../../postgresql/syllabus/03-node-and-pg.md).

The [spec](01-the-storefront-spec.md) says what the app does. This page fixes
*where everything runs and where everything lives*, so a chapter can say "the
worker" or "the orders table" and mean one thing.

## The processes

Four long-running processes, two of them yours:

```text
                       ┌─────────────────────┐
   browser (React SPA) │  api — Express      │──── PostgreSQL
   ──── HTTP/JSON ────▶│  one process,       │      one database,
                       │  stateless          │      the only state
                       └─────────────────────┘        ▲
                                 │ outbox rows        │
                       ┌─────────────────────┐        │
                       │  worker — Node      │────────┘
                       │  emails, webhooks,  │──▶ SMTP / partner HTTP
                       │  scheduled jobs     │──▶ object storage (images)
                       └─────────────────────┘
```

| Process | What it is | What it must never do |
|---|---|---|
| **api** | One Express process serving JSON. Stateless: any instance can serve any request | Hold user state in memory; do slow work in the request path |
| **worker** | One Node process draining the outbox, sending email and webhooks, running schedules | Share a database transaction with the api; ack work it hasn't finished |
| **PostgreSQL** | The single source of truth — including the job queue (the outbox table) | — |
| **object storage** | Product and review images, behind an S3-shaped interface (a local-disk implementation in development) | Serve anything except images |

Two consequences the chapters lean on constantly:

1. **Stateless api ⇒ sessions and carts live in the database**, not in process
   memory. That is what makes "any instance can serve any request" true, and it
   is why a Redis session store can later replace the table without touching a
   route — the interface stays.
2. **The database is also the queue.** A dedicated broker earns its place at a
   scale this app doesn't have; an outbox table gives transactional enqueue for
   free — the whole argument is in the
   [Node outbox concept page](../../../nodejs/pages/phase-7-background-work/06-transactional-outbox.md),
   and the worker chapter implements the relay against it.

## The tables

Eleven tables. The database phase creates them migration by migration; this is
the map.

| Table | Key columns beyond `id` | Notes |
|---|---|---|
| `users` | `email` (unique, citext), `password_hash`, `role` | `role` is an enum: `customer`, `admin` |
| `sessions` | `user_id` FK, `token_hash`, `expires_at` | Anonymous rows have `user_id NULL` — that is the guest cart's anchor |
| `categories` | `name`, `slug` (unique), `parent_id` FK nullable | One level deep by spec |
| `products` | `name`, `slug` (unique), `description`, `price_cents`, `attributes jsonb`, `stock`, `search tsvector` | `price_cents` integer — the money chapter says why |
| `product_images` | `product_id` FK, `object_key`, `position` | The image bytes live in object storage; rows hold keys |
| `carts` | `session_id` FK **or** `user_id` FK | Exactly one is set — a CHECK enforces it |
| `cart_items` | `cart_id` FK, `product_id` FK, `quantity` | `UNIQUE (cart_id, product_id)` makes "add again" an upsert |
| `orders` | `user_id` FK, `status`, `address jsonb`, `total_cents`, `idempotency_key` (unique) | `status` enum walks the spec's lifecycle |
| `order_items` | `order_id` FK, `product_id` FK, `quantity`, `unit_price_cents` | The price snapshot — the spec's one fixed modelling rule |
| `reviews` | `product_id` FK, `user_id` FK, `order_id` FK, `rating`, `body`, `status` | `order_id` is the "verified purchaser" proof; `status` gates moderation |
| `outbox` | `topic`, `payload jsonb`, `created_at`, `processed_at` | Written inside business transactions; drained by the worker |

Three schema-wide conventions, argued once in the database phase and then just
used: **`bigint` identity keys**, **`timestamptz` for every timestamp**
(`created_at` everywhere, `updated_at` where rows mutate), and **money as
integer cents** — never floating point, never `numeric` strings parsed ad hoc.

## Who owns what

The track's no-duplication rule, applied to the architecture — each mechanism
has one home, and everyone else links to it:

| Mechanism | Implemented in | Concept home |
|---|---|---|
| Schema, queries, transactions | Phase 1 | PostgreSQL section |
| Boot, pool, shutdown, workers, uploads | Phase 2 | Node phases 3–7, 10–11 |
| Routes, validation, auth, errors | Phase 3 | Express section |
| Screens and hooks | Phase 4 | React phases 0–7 |
| Client-side functions | Phase 5 | JavaScript phase 17 |
| Types across all of it | Phase 6 | TypeScript section |
| Containers for this exact stack | — already written | [Docker phase 9](../../../docker/pages/phase-9-mern-pern-stack/README.md) |

## Gotchas

- **Symptom:** a feature works with one api instance and breaks with two.
  **Cause:** state crept into process memory — an in-process session map, a
  local upload path, an in-memory rate counter. **Fix:** the statelessness rule
  above; state goes to the database or object storage, and anything
  legitimately in-process (the cache chapter's TTL cache) must be correct when
  each instance has its own.
- **Symptom:** order emails vanish when the worker restarts at the wrong
  moment. **Cause:** the side-effect ran inside the request, or the outbox row
  was marked processed before the send. **Fix:** the outbox contract — written
  in the business transaction, marked processed only after the send succeeds.
  The worker chapter is built around this exact failure.
- **Symptom:** `carts` rows with both `user_id` and `session_id` set, and
  merge code that can't decide which wins. **Cause:** the either-or rule lived
  only in application code. **Fix:** the CHECK constraint in the schema
  chapter — invariants the database can hold, the database holds.

## Interview questions

1. **★ Why one api process and one worker process, rather than doing
   everything in the request?** The request path owes the user an answer in
   milliseconds; email and webhooks take seconds and fail independently.
   Splitting them means slow work retries without holding a socket open, and
   the api scales on traffic while the worker scales on queue depth.
2. **★ Why is the outbox table a real queue here, when "use the database as a
   queue" is usually an anti-pattern warning?** The warning is about
   *contention at scale* — thousands of consumers polling hot rows. This app
   has one worker, and what it needs is *transactional enqueue*: the job row
   commits or rolls back with the order. That property no external broker can
   give without two-phase writes; at this scale the trade is clearly won by
   the table.
3. **Why integer cents instead of `numeric` for money?** JavaScript numbers
   make `0.1 + 0.2` famous; `numeric` avoids that but arrives in Node as a
   string with parsing ambiguity at every boundary. Integer cents survive
   JSON, arithmetic and `pg`'s type mapping with no precision loss, and
   formatting is the display layer's job (the `Intl` chapter).
4. **Why does `reviews` carry an `order_id`, not just a `user_id`?** It is the
   verified-purchase proof *as a foreign key*: the review points at the exact
   order that entitles it, so the rule "one review per purchase, buyers only"
   is a uniqueness constraint instead of a query the app must remember to run.
5. **What breaks if session state moves to process memory "just for now"?**
   Login works until the second instance starts or the first restarts — then
   users are logged out at random, and the bug is invisible in development
   with one process. The stateless rule exists because this failure ships
   silently.

---

← Prev: [The storefront spec](01-the-storefront-spec.md) ·
Next → [How to read this track](03-how-to-read-this-track.md)
