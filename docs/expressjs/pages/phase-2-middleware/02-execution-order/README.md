---
title: "Execution order"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**First registered runs first. Application middleware runs before router
middleware for that mount — because it was registered first, not because of any
rule about levels.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. The levels and
> *"in the order they are defined"* are from
> [using middleware](https://expressjs.com/en/guide/using-middleware.html); *"the
> order of `router.use()` definitions is critical"* from the
> [router reference](https://expressjs.com/en/5x/api/router.html). The array-walk
> mechanism and the `debug` namespaces are read from `router@2.2.0` and
> `express@5.2.1` in `sandbox/express-verify/node_modules/`. **Reading source is
> not a run.** The single console block in this topic (chunk 01) is re-used
> unchanged from the earlier authorised `sandbox/express-verify` run and is
> **sandbox-measured**; nothing was executed for this rewrite.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The four levels](01-the-four-levels.md)** | One mechanism, not four; why the familiar ordering flips if you mount the router first; and the twelve-line order that every constraint in this track depends on |
| 02 | **[Ordering in practice](02-ordering-in-practice.md)** | `DEBUG=router`, the trace-array technique that finds hangs, why `router.stack` is a REPL tool and not an API, and how to stop order drifting with the import graph |

**Split on a concept boundary at the 300-line mark.** 01 is what the order *is*,
02 is how to see it and keep it.

## Phase gate

You can explain why `app.use(log)` after `app.use('/api', api)` never runs for
`/api/*`, name three ordering constraints and what each breaks, and say how you
would find out what actually ran for a request that hung.

## Where this connects

- **← [Phase 0 · 02 · chunk 03](../../phase-0-express-basics/02-app-router-server/03-inside-router-handle.md)**
  — the walk itself, from the source.
- **← [01 · The middleware contract](../01-middleware-contract/README.md)** — what
  each layer in that order is allowed to do.
- **→ [03 · `next` semantics](../03-next-semantics.md)** — how a layer hands to the
  next one, and the ways that goes wrong.
- **→ [05 · Must run first, must run last](../05-first-and-last.md)** — the ordering
  rules as a checklist.
- **→ [Phase 1 · 04 · Route ordering](../../phase-1-routing/04-route-ordering.md)** —
  the same fact applied to two routes that could both match.
- **→ [Phase 5 · 01 · Error middleware](../../phase-5-errors/01-error-middleware.md)**
  — why an error handler is reachable only from below it.
- **→ [Phase 9 · 01 · `trust proxy`](../../phase-9-hardening/01-trust-proxy.md)** and
  **[· 02 · CORS](../../phase-9-hardening/02-cors.md)** — the two ordering mistakes
  with security consequences.
- **→ [Phase 10 · 01 · The app factory](../../phase-10-app-factory/01-create-app.md)**
  — where the order becomes a readable document.
- **→ [Phase 10 · 05 · Health and boot](../../phase-10-app-factory/05-health-and-boot.md)**
  — probes above everything, and the restart storm if they are not.

---

← Prev topic: [The middleware contract](../01-middleware-contract/README.md) · Start → [The four levels](01-the-four-levels.md)
