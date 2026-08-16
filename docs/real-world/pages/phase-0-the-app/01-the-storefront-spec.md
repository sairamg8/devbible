---
title: "The storefront spec"
sidebar_label: "01 · The storefront spec"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. Design page — the feature set is fixed here and every later
> chapter implements against it. Target stack: Node 24 LTS · PostgreSQL 17 ·
> Express 5 · React 19 · TypeScript 5.x (MongoDB 8 in the mirror phase).

Every chapter in this track builds a piece of the same application. This page is
the agreement on what that application *is*, so no chapter has to re-negotiate
it. When a later page says "the catalog" or "checkout", it means exactly what is
written here.

## The product in one paragraph

A storefront selling physical products. Visitors browse and search a catalog,
collect items in a cart, and check out against real inventory. Customers create
accounts, see their orders, and leave reviews with photos. Admins manage
products, stock and orders from a dashboard. Orders trigger emails and notify an
external fulfilment partner by webhook.

Deliberately ordinary. The point of this track is not a novel product — it is
that every mechanism a production PERN or MERN app needs shows up naturally:
auth, transactions, uploads, background work, caching, search, pagination.

## Roles

| Role | Can | Cannot |
|---|---|---|
| **Guest** | Browse, search, hold a cart, start checkout (which forces signup or login) | See any account data |
| **Customer** | Everything a guest can, plus: complete checkout, see **their own** orders, write reviews for products **they bought**, manage their profile | See anyone else's orders or reviews-in-moderation |
| **Admin** | Manage products, categories and stock; see and update **all** orders; moderate reviews | Nothing — but every admin action is authorized server-side, never by hiding buttons |

Two rules the security chapters will keep returning to:

1. **Ownership is a server-side check.** "My orders" means `orders.user_id`
   matches the authenticated user — enforced in the endpoint, not the UI.
2. **Role is coarse, ownership is fine.** RBAC answers "may customers do this
   kind of thing?"; ownership answers "may *this* customer touch *this* row?".
   Both run on every request that needs them.

## The entities

| Entity | What it holds | Owned by |
|---|---|---|
| **User** | Email, password hash, role, profile | The auth chapters |
| **Product** | Name, slug, description, price, attributes, images, stock | Catalog + admin |
| **Category** | Name, slug, a one-level tree | Catalog |
| **Cart** | Line items with quantities; belongs to a user **or** an anonymous session | Cart chapters |
| **Order** | Immutable snapshot of a paid cart: line items with **the price at purchase time**, address, status | Checkout + orders |
| **Review** | Rating, text, photos; only from verified purchasers; moderated | Reviews + uploads |

The one modelling decision fixed at spec level, because chapters in three
different phases depend on it: **an order stores its own prices.** Products
change price; orders do not. `order_items.unit_price` is copied at checkout,
never joined back to `products.price`. The database chapter implements it, the
checkout endpoint relies on it, and the React order-history screen renders it
without a product join.

## The flows

**Browse → cart → checkout → order → review** is the spine:

1. **Browse.** Paginated catalog, filterable by category and price, sortable by
   price and recency, searchable by text. Product page shows images, stock
   state and reviews.
2. **Cart.** Add, change quantity, remove. A guest cart lives against an
   anonymous session and **merges into the account cart on login** — the cart
   must survive authentication.
3. **Checkout.** Address in, payment authorized (a payment provider is *mocked
   behind an interface* — this track does not integrate a real one), stock
   decremented, order created. **Replaying the same checkout must not create a
   second order** — an idempotency key travels with the request.
4. **Order.** Confirmation email sent, fulfilment partner notified by webhook —
   both *after* the transaction commits, both surviving a crash between commit
   and send. Status walks `pending → paid → shipped → delivered`
   (or `→ cancelled`).
5. **Review.** A customer who bought the product may leave one review with up
   to three photos. Reviews await moderation before appearing.

Alongside the spine: **auth** (signup, login, logout, session expiry mid-action
without losing the cart) and **admin** (product CRUD, stock updates, order
status changes, review moderation).

## Non-functional requirements

These force the interesting engineering, so they are spec, not nice-to-haves:

| Requirement | Which chapters it forces |
|---|---|
| Checkout is **idempotent** and survives concurrent stock races | DB transaction chapter, checkout endpoint chapter |
| Order side-effects (email, webhook) are **at-least-once, never lost** | The outbox and worker chapters |
| Catalog stays fast at 100k products | Keyset pagination, indexes, caching chapters |
| Images are uploaded by users and **cannot be trusted** | Upload service and uploads endpoint chapters |
| A session can expire at any moment **without losing client state** | React auth and persisted-cart chapters |
| The API contract is **typed end to end** | The whole TypeScript phase |

## What is out of scope

Payments beyond a mocked provider interface · shipping-rate calculation ·
multi-currency and tax rules · warehousing/multi-location stock · recommendation
engines · analytics pipelines. Each would be a real project's concern; none
teaches a stack mechanism this track doesn't already cover.

## Gotchas

- **Symptom:** two chapters seem to disagree about a behaviour. **Cause:** one
  of them drifted from this spec. **Fix:** this page wins; the drifting chapter
  has a bug — treat it exactly like a failing test.
- **Symptom:** a feature looks missing (wishlists, coupons, address books).
  **Cause:** scope was cut on purpose to keep the track finishable. **Fix:**
  build it as an exercise — every one composes mechanisms the track does teach.
- **Symptom:** the price on an old order changed after a product price update.
  **Cause:** the order was joined back to `products` instead of storing its own
  snapshot. **Fix:** `order_items.unit_price` at checkout time — the rule fixed
  above, and the first thing to check in any order-total bug.

## Interview questions

1. **★ Why does an order store its own prices instead of joining to the
   products table?** Because an order is a record of a transaction that already
   happened. Joining back to `products.price` makes history mutable: a price
   update would silently rewrite every past order's total. Copying
   `unit_price` at checkout makes orders immutable and audit-safe, at the cost
   of denormalized data — a cost you want here.
2. **★ Why must checkout be idempotent?** Networks fail after the server acts
   but before the client hears about it. The client's only safe move is to
   retry — and without idempotency, a retry means a second order and a second
   charge. An idempotency key lets the server recognize the retry and return
   the original result.
3. **Why does the guest cart merge on login rather than being replaced?** The
   cart is the user's accumulated intent — discarding either side loses items
   the user chose. Merging (sum quantities, keep both sets) is the only option
   that never throws work away; the cart chapter implements the rules.
4. **Why are role checks and ownership checks both needed?** RBAC alone lets
   any customer read any customer's orders — role answers only "can customers
   read orders at all?". Ownership alone can't express admin-only actions.
   They answer different questions and compose.
5. **Why is the payment provider mocked behind an interface rather than
   integrated?** The stack mechanisms — idempotency, webhooks, the outbox —
   are identical whichever provider sits behind the interface, and a real
   integration would chain this track to one vendor's SDK churn. The interface
   is the teachable part.

---

Next → [Architecture and the data model](02-architecture-and-data-model.md)
