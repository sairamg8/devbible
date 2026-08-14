---
title: "Where Express stops"
sidebar_label: "04 · Where Express stops"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

**Most "Express problems" are not Express problems. Knowing which layer owns a
question is the difference between fixing it and guessing at it.**

> Verified: 2026-08-14. The boundary rule below is **this bible's editorial
> decision**, not upstream guidance — Express documents no such split, and it is
> stated as ours rather than presented as fact. The claims about what Express does
> and does not implement are from the `express@5.2.1` source
> (`sandbox/express-verify/node_modules/express/`) and from
> [expressjs.com](https://expressjs.com/en/5x/api.html). The comparison table
> names each competing framework's own documented positioning and nothing more —
> **no benchmark was run and no performance number is claimed**.

## What Express is not

| Not this | Why people think it is |
|---|---|
| A language | It is JavaScript on V8, all the way down |
| A database or ORM layer | Every tutorial mounts one in the same file; Express ships neither and knows about neither |
| Auth as a product | You mount session or token middleware; the cryptography, the token format and the threat model are Node and security topics |
| A validation system | `req.body` is whatever a parser produced. Express never inspects its shape |
| A replacement for understanding `node:http` | Debugging hangs, truncated responses, timeouts and streams still happens at the substrate |
| An application architecture | There are no controllers, services, repositories or modules in Express — [Phase 7](../../phase-7-layering/01-controller-service-repository.md) is entirely a set of conventions |

The last one is worth dwelling on, because it is the most expensive
misunderstanding. Express has **no opinion** on how you organise code. A folder
called `controllers/` is a folder. The framework will not notice, will not
enforce a layering rule, and will not complain when a route handler opens a
database connection. Everything Phase 7 teaches is discipline the framework
cannot help you keep — which is why it is taught as discipline, explicitly.

## The boundary rule this bible uses

> **If the topic would still exist with the HTTP server removed, it belongs to
> Node — not Express.**

Apply the test and the split becomes mechanical rather than a matter of taste:

| Question | Owner | Why |
|---|---|---|
| How do I hash a password? | **Node** | No HTTP involved; `node:crypto` and argon2/bcrypt are the subject |
| How do I attach the hashed user to the request? | **Express** | `req.user`, middleware order, 401 vs 403 |
| Why is my process using 2 GB? | **Node** | Heap, streams, buffering — the server is incidental |
| Why does a 40 MB upload get a 413? | **Express** | `express.json`'s `limit` option and the parser gate |
| How do I retry a failed job? | **Node** | Queues and background work outlive the request |
| How do I return 202 and enqueue? | **Express** | Status semantics and the ordering against the commit |
| How do I open a Postgres pool? | **Node / PostgreSQL** | Connection lifecycle is not an HTTP concern |
| How do I scope a query to the caller's tenant? | **Express** | Identity comes from the request; [Phase 8 · 08](../../phase-8-validation-authz/08-tenant-and-logout.md) |

Two consequences of running the project this way:

- **Express pages cross-link to Node pages rather than restating them.** When an
  Express page needs `AbortSignal`, streams, timers or crypto, it links; it does
  not re-teach. That is deliberate and it is why the Express track is smaller than
  its reputation suggests.
- **A gap in Express knowledge is often a gap in Node knowledge.** "Express hangs"
  is almost always an unread request stream, a missing `next()`, or a response
  that was never ended — and only one of those three is an Express concept.

## Express does not do these, and the docs say so

Worth naming explicitly, because each is regularly assumed:

- **Preconditions.** Express computes an `ETag` for you but **never evaluates
  `If-Match`**. RFC 9110 puts precondition evaluation on the origin server, which
  is your handler. This one has bitten this corpus directly — see the labelled
  block on [Phase 6 · 07](../../phase-6-rest-surface/07-etag-and-cache.md).
- **Cancellation.** Nothing in Express or Node aborts a running handler when the
  client disconnects or a timeout fires. A timeout middleware stops the *waiting*;
  the query keeps its connection. Real cancellation lives at the resource —
  [Phase 9 · 06](../../phase-9-hardening/06-timeouts-and-secrets.md).
- **`Allow` on a 405.** Express answers **404**, not 405, when a path matches no
  route for that method, and there is no built-in `Allow` header anywhere —
  [Phase 1 · 01](../../phase-1-routing/01-http-methods.md).
- **Reading cookies.** `res.cookie` is built in; `req.cookies` and
  `req.signedCookies` exist only with `cookie-parser`. The asymmetry is
  documented on both sides and surprises everyone once.
- **Trusting proxies safely.** `trust proxy` decides *whether* to believe
  `X-Forwarded-For`; it cannot tell you whether the header was sanitised upstream.
  Getting that wrong turns rate limiting off without any symptom —
  [Phase 9 · 01](../../phase-9-hardening/01-trust-proxy.md).

## Trade-off

Express optimises for **ecosystem, familiarity and composability**, and pays for
it in **structure and introspection**.

**What you get.** The largest middleware ecosystem in Node, because the plug-in
contract is a plain function. Hiring familiarity — most Node developers can read
an Express app on day one. Stability: Express 5 is a small, slow-moving surface
over `node:http`, and the things it wraps are standards. And a genuinely small
framework — 2,755 lines in `lib/` — so when behaviour surprises you, reading the
source is a realistic afternoon rather than a project.

**What you pay.** Nothing is declared, so nothing can be introspected: no
generated OpenAPI from your routes, no compile-time guarantee that a route is
authenticated, no framework-level view of the pipeline. Types are bolted on
rather than inferred — `req.body` is `any` until you make it otherwise, which is
the entire subject of [Phase 8 ·
09](../../phase-8-validation-authz/09-type-inference.md). And the absence of
opinion means every team invents its own layering, error contract and validation
convention, which is why phases 5 through 10 of this track are mostly
*conventions* rather than APIs.

**Where the alternatives sit.** Fastify's pitch is schema-first: you declare
JSON Schema per route and get validation, serialisation and documentation from
the same declaration. Koa's is a smaller core with async middleware and no
built-in router. Hono's is Web-standard `Request`/`Response` objects that run on
runtimes other than Node. Each buys something Express refuses to charge for, and
each costs ecosystem size or familiarity. **None of that is a performance
argument here** — this bible makes no throughput claim, because it ran no
benchmark, and published framework benchmarks rarely survive contact with a real
handler that talks to a database.

For most MERN and PERN APIs, Express's trade is the right default, and the
decision of when it is not is [page 07](../07-when-not-to-use-express.md).

## Gotchas

**Symptom:** A question keeps getting answered with "that's just how Express is"
**Cause:** The question is a Node question — buffering, back-pressure, timers,
process lifetime — being asked at the wrong layer
**Fix:** Apply the boundary test: remove the HTTP server; if the question survives,
it is Node's, and [the Node track](/docs/nodejs/pages/README.md) owns it

**Symptom:** `document is not defined`, or a browser-only package fails on import
**Cause:** Treating Express as a universal host
**Fix:** Server code only, no DOM — the same host rule as Node

**Symptom:** A team argues about folder structure and cites "the Express way"
**Cause:** There isn't one. Express ships no architecture and validates none
**Fix:** Pick a convention deliberately and write it down —
[Phase 7](../../phase-7-layering/01-controller-service-repository.md) is the
argument, not the framework

**Symptom:** Choosing a framework on a benchmark chart
**Cause:** Micro-benchmarks measure a handler that returns a constant, which is
the one workload no production API has
**Fix:** Decide on ecosystem, team familiarity and what you need declared. If
throughput genuinely dominates, measure *your* handler, including the database

## Interview questions

**★ Where do you draw the line between Node and Express?**
If the topic survives removing the HTTP server, it is Node — hashing, queues,
streams, process lifetime, connection pools. If it only makes sense because a
request exists — status codes, middleware order, `req.user`, content negotiation
— it is Express. The line matters because most production incidents blamed on
Express are on the Node side of it.

**★ Name three things people assume Express does that it does not.**
Evaluate `If-Match` (it computes ETags but never checks preconditions), cancel a
running handler on timeout or disconnect, and answer 405 with an `Allow` header
for a known path with an unknown method. Reading cookies is a fourth — that needs
`cookie-parser`.

**★ Express or Fastify for a new API?**
The honest answer is what you need declared. Fastify's schema-per-route gives you
validation, fast serialisation and generated documentation from one declaration;
Express gives you the larger ecosystem and near-universal familiarity, and you
supply validation and documentation yourself. Neither answer should rest on a
benchmark chart.

**★ Why does Express have no opinion on project structure?**
Because its only extension point is a function of three arguments. It has no base
class to subclass, no module system to register with and no lifecycle to hook, so
there is nothing for an architecture to attach to. That is the source of both its
ecosystem and its lack of guard rails.

**Is Express required to build a Node HTTP API?**
No. Raw `node:http`, Fastify, Koa and Hono are all real options. Express is a
choice, not a platform requirement — and for a single-endpoint service, raw
`node:http` is a defensible one.

**Why is Express still the default for many APIs in 2026?**
Ecosystem size, hiring familiarity, and a stable surface over standards that
change slowly. Express 5 is a small framework whose source you can read, which
matters more in a long-lived codebase than a benchmark does.

---

← Prev: [What Express delegates](03-what-express-delegates.md) · Index: [What Express is](README.md) · Next topic → [app, Router, and http.Server](../02-app-router-server.md)
