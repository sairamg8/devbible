---
title: "Part 2 — HTTP surface"
sidebar_label: "2 · HTTP surface"
sidebar_position: 2
---

> Phases 3–5 · Request parsing, responses & static files, error handling

The bytes on the wire. Node taught you that bodies are streams and that
`http.Server` is real. This part is how Express packages that into `req` / `res`
and a single error channel.

**Cross-link, do not re-teach:** stream backpressure, raw `IncomingMessage`,
TLS termination, and process-level `uncaughtException` — Node Phases 3–5 and 10.

---

## Phase 3 — Requests and body parsing

Everything clients send, and the limits that keep one request from taking the
process down.

📖 **Explanation written:** [Phase 3 — Requests](../pages/phase-3-requests/)

| Topic | Tier |
|---|---|
| **`req` anatomy** — `params`, `query`, `body`, `headers`, `ip`, `path`, `method`, and what is populated only after middleware (`req.cookies` is **not** built-in — see cookie-parser row) | <span className="db-tier t-master">Master</span> |
| **Body parsers** — `express.json()` and `express.urlencoded()`, content-type gates, and empty-body behaviour | <span className="db-tier t-master">Master</span> |
| **Body size limits** — default limits, per-route overrides, and size-limit as a DoS control | <span className="db-tier t-master">Master</span> |
| **`query parser` — `simple` vs `extended`** — Express 5 default is `simple` (was `extended` in 4); nested `a[b]=1` breaks on upgrade; opt-in nesting; pollution angle | <span className="db-tier t-understand">Understand</span> |
| Malformed JSON / bad urlencoded payloads — status codes, error middleware path, and not leaking parse internals | <span className="db-tier t-understand">Understand</span> |
| `express.raw()` and `express.text()` — webhooks, signatures over raw bytes, and when JSON parsing destroys the payload | <span className="db-tier t-understand">Understand</span> |
| Headers and content-type discipline — charset, `Content-Type` mismatches, and case-insensitivity | <span className="db-tier t-understand">Understand</span> |
| Client IP and protocol — `req.ip`, `req.ips`, `X-Forwarded-*` (pair with `trust proxy` in Phase 9) | <span className="db-tier t-understand">Understand</span> |
| **Multipart uploads** — Multer 2.x (or equivalent) for Express 5, memory vs disk storage, field limits | <span className="db-tier t-understand">Understand</span> |
| Upload validation — MIME allow-lists, size caps, filename sanitization, and the storage boundary (local vs object store) | <span className="db-tier t-understand">Understand</span> |
| **Reading cookies** — `cookie-parser` (and signed cookies); asymmetry with built-in `res.cookie` | <span className="db-tier t-know">Know</span> |
| `req` helpers you should not reinvent — `accepts`, `is`, `range` (awareness) | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can mount JSON parsing with a hard size limit,
handle a deliberately huge body without hanging the process, and receive a
multipart file without trusting `Content-Type` alone.

---

## Phase 4 — Responses, static files, and cookies on the way out

What leaves the process. Status, body shape, headers, and files.

📖 **Explanation written:** [Phase 4 — Responses](../pages/phase-4-responses/)

| Topic | Tier |
|---|---|
| **`res` methods with discipline** — `status`, `json`, `send`, `end`, `redirect`, and picking one terminal call | <span className="db-tier t-master">Master</span> |
| **Status and header discipline** — set status before body, immutable headers after send, useful error statuses | <span className="db-tier t-master">Master</span> |
| Response **shape conventions** — envelope vs bare resource, consistent field names, and when not to wrap | <span className="db-tier t-understand">Understand</span> |
| Content negotiation — `Accept`, `res.format`, and defaulting sensibly for APIs | <span className="db-tier t-understand">Understand</span> |
| **Headers already sent** — causes, symptoms, and never double-sending | <span className="db-tier t-understand">Understand</span> |
| Streaming a response from a handler — piping a readable, error cleanup mid-stream | <span className="db-tier t-understand">Understand</span> |
| `res.sendFile` / `res.download` — path safety, `root` option, and not reinventing static | <span className="db-tier t-know">Know</span> |
| **`express.static`** — mount path, `index`, fallthrough, and Express 5 dotfile defaults | <span className="db-tier t-understand">Understand</span> |
| **Serving a built SPA from Express** — `express.static` plus history fallback; why `app.get('*')` **throws** on Express 5; use `/*splat` (or equivalent) instead | <span className="db-tier t-understand">Understand</span> |
| Cache headers on **static** assets — `max-age`, `etag` option, immutable hashed filenames | <span className="db-tier t-know">Know</span> |
| Setting cookies on the response — `res.cookie` / `res.clearCookie` flags (`httpOnly`, `Secure`, `SameSite`, `path`) — built-in; reading needs cookie-parser (Phase 3) | <span className="db-tier t-understand">Understand</span> |
| Compression middleware — when it helps, when the reverse proxy should own it | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** every success and error path from a sample router ends
in exactly one response, with a deliberate status and a consistent JSON shape.

---

## Phase 5 — Error handling and propagation

One funnel for failures. Express 5 changes the async story for the better —
still easy to get wrong.

📖 **Explanation written:** [Phase 5 — Errors](../pages/phase-5-errors/)

| Topic | Tier |
|---|---|
| **Four-argument error middleware** — `(err, req, res, next)`, must be registered last, signature is load-bearing | <span className="db-tier t-master">Master</span> |
| **Express 5 async errors** — rejected promises from async handlers forward to `next(err)` automatically; what still needs try/catch | <span className="db-tier t-master">Master</span> |
| **Error response contract** — stable JSON error body (`code`, `message`, `details`), no stack in production | <span className="db-tier t-master">Master</span> |
| Mapping operational failures to HTTP — 400 / 401 / 403 / 404 / 409 / 422 / 429 / 503 without a class zoo | <span className="db-tier t-understand">Understand</span> |
| A thin typed error helper — `statusCode` + `code` + `expose`; **not** a deep inheritance tree (cross-link Node error design) | <span className="db-tier t-understand">Understand</span> |
| Programmer vs operational at the HTTP edge — log one, hide the other, never continue after unknown errors | <span className="db-tier t-understand">Understand</span> |
| 404 handler — final non-error middleware that runs when nothing matched | <span className="db-tier t-know">Know</span> |
| Process-level `uncaughtException` / `unhandledRejection` — **cross-link Node only**; not an Express re-lesson | <span className="db-tier t-know">Know</span> |
| Error logging at the edge — what to log (method, path, status, request id) and what never to log | <span className="db-tier t-know">Know</span> |
| **Every error that can reach the handler** — driver, network, library and programmer errors, and where each is translated before it arrives | <span className="db-tier t-master">Master</span> |

**Gate — move on when:** a thrown error in an async route, a `next(err)` from
middleware, and a malformed JSON body all produce the same error envelope and
never leak a stack trace with `NODE_ENV=production`.

---

## Counts (this part)

| Tier | Count |
|---|---|
| Master | 8 |
| Understand | 17 |
| Know | 8 |
| When Needed | 0 |
| **Total** | **33** |

---

← Prev: [Part 1 — Foundations](01-foundations.md) · Next → [Part 3 — API product](03-api-product.md)
