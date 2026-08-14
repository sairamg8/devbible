---
title: "What Express is"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Express is not a language and not an application architecture. It is a
programmable layer of routing and middleware on top of Node's `http.Server`.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. Mechanism claims are
> read from the installed `express@5.2.1` and `router@2.2.0` source in
> `sandbox/express-verify/node_modules/`, cited per chunk by file and function;
> public API behaviour is cross-checked against
> [expressjs.com](https://expressjs.com/en/5x/api.html) and the `node:http`
> [documentation](https://nodejs.org/api/http.html). **Reading source is not a
> run.** The single console block in this topic (chunk 02) is re-used unchanged
> from the earlier authorised `sandbox/express-verify` run and is
> **sandbox-measured**; nothing was executed for this rewrite.

The first Master topic, and the one every later phase quietly assumes. Three
questions, in order: what problem Express exists to solve, what it mechanically
*is* once you read the source, and where it stops.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The mapping problem](01-the-mapping-problem.md)** | What `node:http` gives you, the dispatcher you write without a framework, and the two halves — dispatch and composition — that every Node framework answers |
| 02 | **[The app is a function](02-the-app-is-a-function.md)** | From source: `express()` returns a request listener, `app.listen` is eight lines, and `app.handle` re-parents `req`/`res` prototypes rather than wrapping them |
| 03 | **[What Express delegates](03-what-express-delegates.md)** | Routing, body parsing and static files are separate packages; the lazy router getter that reads `strict` exactly once; how big Express really is; and the settings it sets before you do |
| 04 | **[Where Express stops](04-the-boundary.md)** | What Express is not, the Node/Express boundary test this bible uses, the five things Express is assumed to do and does not, and the trade-off against schema-first frameworks |

**Split on concept boundaries at the 300-line mark.** Chunk 01 is the problem,
02 is the machine, 03 is what the machine hands to somebody else, 04 is the edge
of the machine. The topic runs ~950 lines in total; the cap decided where the
files break and nothing else.

## Phase gate

You can explain, without looking: why `app` can be passed to
`http.createServer`, what `app.handle` does to `req` before your first middleware
runs, and which of a given list of questions belong to Express rather than Node.

## Where this connects

- **→ [02 · app, Router and `http.Server`](../02-app-router-server/README.md)** — the
  three objects separately, and which one owns `close`.
- **→ [03 · The request lifecycle](../03-request-lifecycle/README.md)** — the same
  `app.handle` walk-through, from the request's point of view.
- **→ [05 · Application settings](../05-application-settings.md)** — the full
  settings table, including the `undefined`-not-`false` correction that chunk 03's
  `defaultConfiguration` reading explains.
- **→ [06 · Express 5 vs 4](../06-express-5-vs-4.md)** — what moved, including the
  router extraction chunk 03 describes.
- **→ [07 · When not to use Express](../07-when-not-to-use-express.md)** — the
  decision chunk 04 deliberately stops short of.
- **→ [Phase 10 · 01 · The app factory](../../phase-10-app-factory/01-create-app/README.md)**
  — why an app that never calls `listen` is the useful one.
- **← [Node Phase 5 · HTTP and processes](/docs/nodejs/pages/phase-5-http-processes/)**
  — the substrate. Express hides none of it.

---

← Index: [Phase 0](../README.md) · Start → [The mapping problem](01-the-mapping-problem.md)
