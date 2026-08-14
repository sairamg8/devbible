---
title: "req anatomy"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**`req` is Node's `IncomingMessage` plus Express fields. Some properties exist
only after middleware runs. `req.cookies` is not free.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. The prototype
> splice, the twelve getters and `req.get`/`req.is`/`req.accepts` are read from
> `express@5.2.1`'s `lib/application.js` and `lib/request.js` in
> `sandbox/express-verify/node_modules/`, cited per chunk by name; behaviour is
> cross-checked against the
> [request reference](https://expressjs.com/en/5x/api/request.html) and the Node
> [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)
> docs. **Reading source is not a run.** The single console block in this topic
> (chunk 03) is re-used unchanged from the earlier authorised
> `sandbox/express-verify` run and **carries a known error, flagged in place** —
> `body: undefined` cannot survive `res.json`, because `JSON.stringify` omits
> undefined properties. It is not rewritten from imagination.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Two objects in one](01-two-objects-in-one.md)** | The prototype chain and what each layer contributes; which properties always exist, which are computed on access, and which are undeclared dependencies on a middleware |
| 02 | **[The twelve getters](02-the-twelve-getters.md)** | All twelve from the source, the six that read `trust proxy` and fail together, why `secure` cookies vanish in production, and why `req.fresh` is always false on a PUT |
| 03 | **[Reading headers and content](03-reading-headers-and-content.md)** | `req.get`'s case-insensitivity and its `referer` alias, why `req.is('json')` beats a `===` comparison, and negotiation with `req.accepts` |

**Split on concept boundaries at the 300-line mark.** 01 is what `req` *is*, 02
is what Express computes from it, 03 is how to read it correctly.

## Phase gate

You can say which `req` properties break when `trust proxy` is wrong, why
`req.headers['Content-Type']` is `undefined`, and what `req.body` is before any
parser runs.

## Where this connects

- **← [Phase 0 · 01 · chunk 02](../../phase-0-express-basics/01-what-express-is/02-the-app-is-a-function.md)**
  — the `setPrototypeOf` that makes `req` two objects at once.
- **← [Phase 1 · 02 · chunk 02](../../phase-1-routing/02-params-and-query/02-the-query-parser.md)**
  — `req.query`, the getter that re-parses.
- **→ [02 · JSON and urlencoded](../02-json-and-urlencoded/README.md)** — how `req.body`
  comes to exist, and the content-type gate.
- **→ [04 · Query parser](../04-query-parser.md)** — the parser setting, from the
  request side.
- **→ [08 · Cookies and helpers](../08-cookies-and-helpers.md)** — `cookie-parser`,
  and the asymmetry with `res.cookie`.
- **→ [Phase 4 · 09 · Content negotiation](../../phase-4-responses/09-content-negotiation.md)**
  — `res.format`, and the `Vary` header `req.accepts` obliges you to send.
- **→ [Phase 6 · 07 · ETag and cache](../../phase-6-rest-surface/07-etag-and-cache.md)**
  — why `req.fresh` cannot help you with `If-Match`.
- **→ [Phase 9 · 01 · `trust proxy`](../../phase-9-hardening/01-trust-proxy/README.md)** —
  the setting six of the twelve getters depend on.

---

← Index: [Phase 3](../README.md) · Start → [Two objects in one](01-two-objects-in-one.md)
