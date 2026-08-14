---
title: "HTTP methods"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**A route is method + path. Register the methods you mean. A mismatch is a 404 by
default — not a 405.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. Mechanism claims
> are read from `express@5.2.1`'s `lib/application.js` and `router@2.2.0`'s
> `lib/route.js` and `index.js` in `sandbox/express-verify/node_modules/`, cited
> per chunk by function; behaviour is cross-checked against the Express
> [routing guide](https://expressjs.com/en/guide/routing.html), the
> [FAQ](https://expressjs.com/en/starter/faq.html) on 404s, and
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) for method semantics and
> the 405 `Allow` requirement. **Reading source is not a run.** The single console
> block in this topic (chunk 01) is re-used unchanged from the earlier authorised
> `sandbox/express-verify` run and is **sandbox-measured**; nothing was executed
> for this rewrite.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The verb table](01-the-verb-table.md)** | All 35 helpers and where they come from, the `app.get(setting)` overload that silently swallows a route, and why `app.all` and `route.all` are not the same thing |
| 02 | **[HEAD and OPTIONS](02-head-and-options.md)** | The HEAD→GET rewrite and how registering `app.head` takes HEAD *away*; the `Allow` header Express does build; why `use` middleware contributes nothing to it |
| 03 | **[405 and method semantics](03-405-and-method-semantics.md)** | Why the answer is 404, when 405 is worth writing and how to write it per route, and the RFC 9110 contracts Express enforces none of |

**Split on concept boundaries at the 300-line mark.** 01 is registration, 02 is
the two methods Express answers for you, 03 is what it refuses to answer and what
the verbs actually promise.

## Phase gate

You can say what `app.get('/health')` does with no second argument, explain why
registering `app.head` can break monitoring, and name which common methods a
client is entitled to retry after a timeout.

## Where this connects

- **← [Phase 0 · 02 · chunk 03](../../phase-0-express-basics/02-app-router-server/03-inside-router-handle.md)**
  — the matching loop where `_handlesMethod` and the HEAD conditional are read.
- **← [Phase 0 · 02 · chunk 04](../../phase-0-express-basics/02-app-router-server/04-url-rewriting-and-options.md)**
  — the `OPTIONS` responder, from the router's side.
- **→ [02 · Params and query](../02-params-and-query/README.md)** — the other half of a
  route: what the path captures.
- **→ [07 · `app.route` and hosts](../07-app-route-and-hosts.md)** — the chaining
  form chunks 01 and 03 both lean on.
- **→ [Phase 6 · 02 · Status mapping](../../phase-6-rest-surface/02-status-mapping/README.md)**
  — CRUD to status codes, once the verbs are settled.
- **→ [Phase 6 · 06 · Idempotency keys](../../phase-6-rest-surface/06-idempotency-keys.md)**
  — the mechanism POST needs because it is the one non-idempotent verb.
- **→ [Phase 9 · 02 · CORS](../../phase-9-hardening/02-cors.md)** — preflight, and
  why the built-in `OPTIONS` answer is not enough for a browser.

---

← Index: [Phase 1](../README.md) · Start → [The verb table](01-the-verb-table.md)
