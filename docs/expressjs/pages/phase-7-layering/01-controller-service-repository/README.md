---
title: "Controller → service → repository"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Controllers translate HTTP. Services own rules. Repositories own queries.
Driver types do not leak upward.**

> Verified: 2026-08-14 — **no sandbox run, no console block in any chunk, and
> none of this is an Express feature.** Express has no notion of a controller, a
> service or a repository; it has middleware and handlers, and everything here is
> a convention you impose on them. There is no framework support to lean on, so
> the boundaries hold only while someone enforces them in review. The two Express
> facts the pattern rests on *are* documented — a router is *"a complete
> middleware and routing system … often referred to as a 'mini-app'"*
> ([routing guide](https://expressjs.com/en/guide/routing.html)), and middleware
> may *"modify the request and response objects"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)) — and
> the Express 5 rejection forwarding the thin controller depends on is read from
> `router@2.2.0` in `sandbox/express-verify/node_modules/`. Repository and
> transaction mechanics are
> [Node Phase 6](../../../../nodejs/pages/phase-6-data-access/README.md).
> **The thresholds in chunk 03 are this bible's judgement**, not measurement.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The three layers](01-the-three-layers.md)** | Responsibilities, the one question that says whether the boundary is real, the two leaks (and which is more expensive), and where the ownership check has to land |
| 02 | **[Wiring it in Express](02-wiring-it-in-express.md)** | The three-line controller and the five things it is *not* doing; the composition root; where the transaction boundary goes; and why there are four shapes, not one |
| 03 | **[When to adopt it](03-when-to-adopt.md)** | What layers buy and what they do not, the signals, when *not* to, how to adopt incrementally, and vertical slices as the underrated alternative |

**Split on concept boundaries at the 300-line mark.** 01 is the model, 02 is the
code, 03 is whether you should.

## Phase gate

You can give the test that distinguishes real layers from folder names, say where
the transaction boundary belongs and why not in middleware, and name a situation
where this pattern is the wrong choice.

## Where this connects

- **← [Phase 0 · 01 · chunk 04](../../phase-0-express-basics/01-what-express-is/04-the-boundary.md)**
  — Express ships no architecture and validates none.
- **← [Phase 1 · 03 · chunk 03](../../phase-1-routing/03-router-composition/03-composition-at-scale.md)**
  — a router per resource, taking its dependencies as arguments.
- **← [Phase 2 · 01 · chunk 03](../../phase-2-middleware/01-middleware-contract/03-what-middleware-must-not-do.md)**
  — the authorization question middleware structurally cannot answer.
- **→ [02 · Domain vs transport](../02-domain-vs-transport.md)** — the four shapes,
  in full.
- **→ [03 · Fat controllers](../03-fat-controllers.md)** — the symptom this pattern
  treats.
- **→ [04 · DI without a framework](../04-di-without-framework.md)** — the
  composition root, and why nothing may happen at import time.
- **→ [05 · Jobs from routes](../05-jobs-from-routes.md)** — 202, and enqueueing
  after the commit.
- **→ [07 · Transaction middleware](../07-transaction-middleware.md)** — the three
  things wrong with the version chunk 02 warns about.
- **→ [Phase 5 · 04 · Mapping to HTTP](../../phase-5-errors/04-mapping-to-http.md)**
  — the translation layer that lets services throw domain errors.
- **→ [Phase 8 · 07 · Ownership](../../phase-8-validation-authz/07-ownership/README.md)** —
  the scoped query, in full.
- **→ [Phase 10 · 03 · Supertest](../../phase-10-app-factory/03-supertest.md)** —
  why a throwaway app proves less than it looks.

---

← Index: [Phase 7](../README.md) · Start → [The three layers](01-the-three-layers.md)
