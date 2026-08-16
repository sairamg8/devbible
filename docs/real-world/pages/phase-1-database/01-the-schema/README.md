---
title: "The schema"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against PostgreSQL 17 documentation (DDL, constraints,
> identity columns, enum types) and the
> [PostgreSQL section](../../../../postgresql/README.md)'s DDL and types phases.

The eleven tables from the
[architecture page](../../phase-0-the-app/02-architecture-and-data-model.md),
as DDL you can run. The chapter's argument: **every invariant the database can
hold, the database holds** — the app enforces politeness, the schema enforces
truth.

Two chapters, split where the domain splits:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Conventions, identity and catalog](01-conventions-identity-catalog.md)** | The three schema-wide conventions, then `users`, `sessions`, `categories`, `products`, `product_images` |
| 2 | **[Carts, orders, reviews and the outbox](02-carts-orders-reviews-outbox.md)** | The transactional half: `carts`, `cart_items`, `orders`, `order_items`, `reviews`, `outbox` — and the constraints that carry the spec's rules |

## Where this connects

Every table here is created by [chapter 02's migrations](../README.md) and
queried by every later phase. The concept material — why constraints beat
application checks, how identity columns work, enum trade-offs — is the
PostgreSQL section's [DDL phase](../../../../postgresql/pages/phase-3-ddl/README.md).
