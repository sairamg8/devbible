---
title: "app, Router, and http.Server"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Three different objects. Confusing them is how "my middleware never runs" and
"the server won't shut down" both start.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. Mechanism claims
> are read from the installed `express@5.2.1` (`lib/application.js`) and
> `router@2.2.0` (`index.js`) source in `sandbox/express-verify/node_modules/`,
> cited per chunk by function name; public behaviour is cross-checked against
> [expressjs.com](https://expressjs.com/en/5x/api/application.html) and the Node
> [`http.Server`](https://nodejs.org/api/http.html#class-httpserver) docs.
> **Reading source is not a run.** The single console block in this topic
> (chunk 01) is re-used unchanged from the earlier authorised
> `sandbox/express-verify` run and is **sandbox-measured**; nothing was executed
> for this rewrite.

The object graph, and then the machine underneath it. Roughly a third of the
"why did Express do *that*" questions in the rest of this track are answered by
chunks 03 and 04.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The three objects](01-the-three-objects.md)** | The graph, the fourth object nobody names (`Route`), the ownership table, and why `app.listen` is the wrong default in real code |
| 02 | **[A Router is a function too](02-a-router-is-a-function-too.md)** | `Router.prototype` is literally a function; the stack is an array of `Layer`s; `use` hard-codes `strict:false, end:false` and registers no methods |
| 03 | **[Inside `router.handle`](03-inside-router-handle.md)** | The dispatch walk: `restore`, the 100-layer stack break, why an error makes every remaining route stop matching, and the `HEAD` fall-through |
| 04 | **[URL rewriting and OPTIONS](04-url-rewriting-and-options.md)** | `trimPrefix`, the four URL properties and which one to log, and the `Allow` header Express does build — for `OPTIONS` only, never 405 |
| 05 | **[Sub-apps and the server](05-sub-apps-and-the-server.md)** | The `handle && set` duck test, everything a sub-app gets that a router does not, `mountpath` vs `req.baseUrl`, and what only the server can do |

**Split on concept boundaries at the 300-line mark.** 01 is the map, 02 is what
the pieces are, 03 and 04 are what happens per request, 05 is the two edges —
mounting a whole app, and the server that wraps all of it. The topic runs ~1,130
lines; the cap decided where the files break and nothing else.

## Phase gate

You can **draw the object graph** and point to where a request is lost if nobody
calls `next` and nobody writes a response; say which object owns `close`; and
explain why an error skips your remaining routes but still reaches error
middleware.

## Where this connects

- **← [01 · What Express is](../01-what-express-is/README.md)** — `createApplication`
  and the app-is-a-function mechanism this topic extends to routers.
- **→ [03 · The request lifecycle](../03-request-lifecycle/README.md)** — the same journey
  end to end, including body parsing and the response. Chunks 03 and 04 here are
  only the router's part of it.
- **→ [Phase 1 · 03 · Router composition](../../phase-1-routing/03-router-composition.md)**
  — `mergeParams` and nesting, which chunk 03's `restore` and chunk 04's
  `trimPrefix` explain between them.
- **→ [Phase 1 · 07 · `app.route` and hosts](../../phase-1-routing/07-app-route-and-hosts.md)**
  — where the `router.mountpath` error was corrected.
- **→ [Phase 2 · 02 · Execution order](../../phase-2-middleware/02-execution-order.md)**
  — registration order as an array walk, applied.
- **→ [Phase 5 · 01 · Error middleware](../../phase-5-errors/01-error-middleware.md)**
  — the arity check that chunk 03's error mode reaches.
- **→ [Phase 10 · 06 · Shutdown](../../phase-10-app-factory/06-shutdown-and-entrypoint.md)**
  — everything hanging off the server object.
- **← [Node Phase 5 · HTTP and processes](/docs/nodejs/pages/phase-5-http-processes/)**
  — sockets, timeouts and signals.

---

← Prev topic: [What Express is](../01-what-express-is/README.md) · Start → [The three objects](01-the-three-objects.md)
