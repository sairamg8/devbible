---
title: "Four-arg error middleware"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Error middleware has four parameters. Express detects it by arity. Mount it
last.**

> Verified: 2026-08-14 on **Express 5.2.1**. The arity gate and the forward-only
> walk are read from **`router@2.2.0`** (`lib/layer.js`, `index.js`); the default
> handler is **`finalhandler@2.1.1`**, quoted by function; `logerror` is
> `express@5.2.1`'s `lib/application.js` — all in
> `sandbox/express-verify/node_modules/`, cited per chunk. Cross-checked against
> the [error-handling guide](https://expressjs.com/en/guide/error-handling.html),
> which states both the four-argument rule and the "defined last" rule verbatim.
> **Reading source is not a run.** The single console block (chunk 01) is re-used
> unchanged from the earlier authorised `sandbox/express-verify` run and is
> **sandbox-measured**; nothing was executed for this rewrite. The handler design
> in chunk 03 is this bible's guidance, stated as such.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Arity and placement](01-arity-and-placement.md)** | Why `fn.length === 4` is the entire detection mechanism, why an error handler is reachable only from below, and why chaining a logger before a responder is the shape to use |
| 02 | **[The default handler](02-the-default-handler.md)** | `finalhandler` in full: the same call that makes every 404, which `err.status` values it believes, the stack in the body outside production, and the socket destroy |
| 03 | **[Designing the handler](03-designing-the-handler.md)** | The whole handler, line by line: the `headersSent` guard first, 4xx vs 5xx as different events, a mapping table with a 500 default, and why the design question is what goes *on an error* |

**Split on concept boundaries at the 300-line mark.** 01 is the mechanism, 02 is
what happens if you write nothing, 03 is what to write.

## Phase gate

You can explain why `(err, req, res)` is dangerous rather than merely wrong, say
what the default handler puts in the body outside production, and give the first
line of an error handler and the reason for it.

## Where this connects

- **← [Phase 0 · 02 · chunk 03](../../phase-0-express-basics/02-app-router-server/03-inside-router-handle.md)**
  — the `if (layerError) { match = false; continue }` that puts the walk in error
  mode.
- **← [Phase 0 · 03 · chunk 02](../../phase-0-express-basics/03-request-lifecycle/02-how-a-handler-is-invoked.md)**
  — `Layer.handleError`, where the arity gate lives.
- **← [Phase 2 · 03 · chunk 03](../../phase-2-middleware/03-next-semantics/03-double-send-and-guards.md)**
  — the double-send the `headersSent` guard prevents.
- **→ [02 · Async errors](../02-async-errors/README.md)** — the four things Express 5
  still does not forward here.
- **→ [03 · Error contract](../03-error-contract.md)** — the envelope chunk 03
  sketches, in full.
- **→ [04 · Mapping to HTTP](../04-mapping-to-http.md)** — the status table.
- **→ [06 · 404 and process errors](../06-not-found-and-process.md)** — the other
  half of `finalhandler`, and the two process listeners.
- **→ [07 · Error logging](../07-error-logging.md)** — why `req.originalUrl` and
  why `Error` properties are non-enumerable.
- **→ [Phase 4 · 02 · chunk 01](../../phase-4-responses/02-status-and-headers/01-status-as-contract.md)**
  — `res.status`'s two throws, which the mapping table exists to avoid.

---

← Index: [Phase 5](../README.md) · Start → [Arity and placement](01-arity-and-placement.md)
