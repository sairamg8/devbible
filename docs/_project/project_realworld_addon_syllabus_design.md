---
name: project-realworld-addon-syllabus-design
description: Real-world addon syllabus — DESIGN (awaiting approval) · session 08ab5390
metadata:
  type: project
---

# Real-world addon syllabus — DESIGN (awaiting approval) · session 08ab5390

**User instruction (2026-08-16):** design new real-world-scenario syllabus addons to the
existing language docs — custom hooks for React, request handling for Node/Express, custom
JS functions, etc. — everything usable for near-future development. **Raw `pg` + Node or
Express is the chosen stack for now** (no ORM). Design mode first; content only after
approval. Fullstack focus: each language contributes its share of one full app.

## The concept — one app, each language its share

**Running scenario: a storefront** (catalog → cart → checkout → orders → auth → reviews
with uploads → admin dashboard → search → notifications). Chosen because it matches the
user's real project (eKommerce, PERN) and JS phase 18 already uses a storefront theme.
Every addon chapter implements that language's share of the SAME app, and cross-links the
neighbouring layers, so the whole track composes into a working fullstack implementation.

## Structure convention (per language)

- New syllabus part: `docs/<lang>/syllabus/NN-real-world.md` (next free part number),
  one new phase: "Phase N — Real-world: <its share of the storefront>".
- Pages later at `docs/<lang>/pages/phase-N-real-world/`, one chapter per topic,
  standard page contract (runnable code, gotchas symptom→cause→fix, interview Qs),
  300-line file cap → chunk dirs, tier badges as usual.
- Chapter shape: problem → design choices (name the trade-off) → full implementation →
  usage in the app → gotchas. Rule 8: doc-validated, NO invented console output.
- Exact phase numbers fixed at write time (some languages have in-flight phases).

## Priority order (user: raw pg + node/express first)

**Wave 1 — the backend spine: PostgreSQL → Node.js → Express**
**Wave 2 — the frontend: React → JavaScript → TypeScript**
**Wave 3 — stack completion: CSS · MongoDB (MERN mirror) · fold-ins (Redis, Nginx)**

## Wave 1 syllabi

### PostgreSQL — "The store's database (raw SQL + pg)" ~12 topics
1 Schema design: users/products/categories/carts/orders/order_items — keys, constraints,
  generated columns [Master]
2 Migrations as plain SQL + a raw runner (no ORM) [Master]
3 Seed data and realistic fixtures [Understand]
4 The catalog query: filtering, sorting, keyset pagination [Master]
5 Full-text product search: tsvector, GIN, ranking [Understand]
6 Checkout transaction: stock decrement, SELECT FOR UPDATE, serialization retry [Master]
7 Money and time: numeric, timestamptz, price snapshots in order_items [Master]
8 JSONB for product attributes — when it earns it vs columns [Understand]
9 Dashboard queries: aggregates + window functions [Understand]
10 Indexes for the app's real queries; reading EXPLAIN ANALYZE [Master]
11 Soft delete, audit columns, updated_at triggers [Know]
12 LISTEN/NOTIFY for order events and cache invalidation [Know]

### Node.js — "Real-world services" ~10 topics (phase 13)
1 API boot assembled for real: env schema → pg pool → server → readiness [Master]
2 The data layer over raw pg: query modules, withTransaction helper, typed rows [Master]
3 Upload service: stream to disk/S3-shaped sink, limits, cleanup on every path [Master]
4 Outbox relay + email worker — correct at-least-once (fixes reviewed bug) [Master]
5 Scheduled jobs: abandoned-cart sweep, reconciliation, drift-safe [Understand]
6 Webhook dispatcher: signing, retries, backoff, dead-letter [Understand]
7 Search indexer job feeding PG full-text [Know]
8 Cache layer: in-process TTL + Redis-shaped interface, stampede-safe [Understand]
9 Health + metrics kit shared by API and workers [Understand]
10 Ops CLI with util.parseArgs: seed, migrate, requeue [Know]

### Express — "The storefront API" ~12 topics (phase 11)
1 Project structure: app factory, routers/controllers/services/data [Master]
2 Validation boundary with zod: params/query/body, typed handlers [Master]
3 Auth: signup/login, sessions, and the JWT+refresh variant [Master]
4 Authorization: RBAC + ownership (my orders vs admin) [Master]
5 Catalog endpoints: the pagination/filter/sort contract [Master]
6 Cart endpoints: guest carts, merge on login [Understand]
7 Checkout: idempotency keys, orchestrating the PG transaction [Master]
8 Uploads endpoint: busboy/multer → Node upload service [Understand]
9 Error contract: error classes → problem-details bodies, central handler [Master]
10 Rate limiting login and checkout [Understand]
11 Inbound webhooks: payment-provider signature verification [Understand]
12 OpenAPI generated from the zod schemas [Know]

## Wave 2 syllabi

### React — "The storefront UI + custom hooks" ~12 topics
1 Hook foundry: useAsync/useFetch with abort + race safety [Master]
2 useDebounce + the search box [Master]
3 useIntersectionObserver + infinite product list [Master]
4 useForm (validation, dirty, submit states) + checkout form [Master]
5 useLocalStorage + persisted cart [Understand]
6 Cart state: context + reducer + optimistic updates [Master]
7 Modal/portal/focus-trap + useOutsideClick (product gallery) [Understand]
8 Upload with progress + review form [Understand]
9 Client auth: protected routes, refresh, session-expiry UX [Master]
10 Admin data table: server-driven sort/page [Understand]
11 Error boundaries + retry UX [Understand]
12 When to swap hand-rolled hooks for TanStack Query (link its docs) [Know]

### JavaScript — "Custom functions for the app" ~10 topics (⚠ number AFTER phase 18
closes; phases 13–16 parked/dropped, 18 held by other sessions — do not collide)
1 fetch wrapper: retry, abort, timeout, dedupe in-flight [Master]
2 TTL cache with stale-while-revalidate [Master]
3 Concurrency-limited task queue [Master]
4 Event bus / pub-sub [Understand]
5 Form validation engine (rules → errors map) [Understand]
6 Intl money/date formatters for the storefront [Master]
7 Slug/search-normalization utils [Know]
8 Feature flags with local override [Know]
9 Optimistic-update helpers (apply/rollback) [Understand]
10 Applied debounce/throttle — links phase 17 implementations, no re-implementation [Know]

### TypeScript — "Typing the stack" ~8 topics
1 Shared types package for api+client [Master]
2 zod schemas → inferred types end to end [Master]
3 Typing raw pg results per query module (no ORM types) [Master]
4 Discriminated unions: order status state machine [Master]
5 Typed Express handlers and middleware [Understand]
6 Typing the custom React hooks [Understand]
7 Typed API client from the OpenAPI/zod source [Understand]
8 Utility types in app code (Pick/Omit/satisfies in anger) [Know]

## Wave 3

- **CSS — "Storefront UI recipes" ~6:** product grid (grid + container queries);
  responsive header/nav; checkout form styling + focus states; skeleton loaders;
  dark-mode tokens; toast/modal layer. [mostly Understand]
- **MongoDB — "The store on MongoDB (MERN mirror)" ~6:** document modeling for
  catalog/cart/orders; embedded vs referenced; checkout with transactions; aggregation
  dashboard; indexes; change streams. Explicitly AFTER the PERN track (user chose raw pg).
- **Redis — FOLD-IN, not addon:** 0 pages exist; when Redis is written, its syllabus
  gains the storefront topics (cart/session store, cache-aside, rate limiter, queue)
  inside the main phases.
- **Nginx — FOLD-IN:** serve the React build + proxy the API + TLS, inside its unwritten
  phases (48/210 done).
- **Docker — NO addon:** phase 9 already IS the MERN/PERN stack.
- **Git, tooling libs (vite, jest-rtl, playwright, redux-toolkit, tanstack-query…):**
  no separate addons; referenced from chapters where they appear (e.g. React ch.12).

## Totals

~76 new topics: Wave 1 = 34 (PG 12, Node 10, Express 12) · Wave 2 = 30 (React 12,
JS 10, TS 8) · Wave 3 = 12 (CSS 6, Mongo 6) + fold-ins. Tier mix ≈ 45% Master by
design — justified: an implementations track is the "use with no docs open" material.

## Status

- [ ] Design approved by user? (presented 2026-08-16, awaiting answer)
- [ ] On approval: write syllabus part files first (one per language, Wave 1 first),
      wire sidebars/progress, THEN chapters one at a time per rule 5.
- Interlock: Node.js gaps worklist (progress_nodejs_improve_review.md) should land
  BEFORE the Node/Express addon chapters — chapter 4 of Node addon depends on the
  corrected outbox page.
