---
title: "A Browser Calling Seven Services Directly Pays Seven DNS Lookups, Seven TLS Handshakes, Seven Preflights and Seven Copies of the Auth-Token Problem — No Bundler Option Fixes Any of It"
sidebar_label: "01a · The BFF and browser fan-out"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [Vite — Server Options](https://vite.dev/config/server-options.md)
> (`server.proxy`, `server.cors`, `server.origin`). Documentation-validated; **no sandbox run, no
> timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**A frontend that talks directly to seven backend services pays for that decision on every
page load — a fresh DNS lookup, a fresh TLS handshake and a CORS preflight per origin, before
a single byte of real data arrives — and there is no `vite.config.ts` option that makes any of
that cheaper, because it is a property of how many origins the browser is asked to trust, not
of how the frontend is bundled. The fix that actually works is architectural: put one backend
for that frontend (a BFF) behind a single origin, and let the frontend treat the seven
services as the BFF's problem.** This chunk is about why the fan-out is expensive, why
`server.proxy` hides the expense only in dev, and what a BFF actually costs so the trade-off
is made with eyes open rather than assumed to be free.

## The waterfall, and why HTTP/2 multiplexing does not save you here

HTTP/2 (and HTTP/3) multiplexing lets a browser send many concurrent requests over **one**
already-open connection instead of queueing them behind a small per-host connection limit.
This genuinely removes head-of-line blocking for requests to the *same origin*. It does
nothing for requests to *different origins*, because multiplexing shares a connection, and a
connection is scoped to one origin (scheme + host + port). Seven backend services on seven
different hosts — `users.api.example.com`, `orders.api.example.com`,
`payments.api.example.com`, and so on — are seven separate connections no matter what HTTP
version is in play. Each one independently pays:

- a DNS lookup (unless a resolver has it cached),
- a TCP handshake,
- a TLS handshake (unless the connection can be resumed),
- and, for a non-simple cross-origin request, a CORS preflight — a full extra `OPTIONS`
  round trip **before** the real request is even sent.

None of this is bundler-observable. Vite has no config surface for "reduce the number of
origins a component talks to" because that is a decision made in application code (`fetch()`
call sites) and infrastructure (DNS, TLS termination), not in the build pipeline.

## The CORS preflight tax, and why `server.proxy` hides it in dev

A cross-origin request that is not "simple" — has a JSON body, a custom header, a method
other than `GET`/`HEAD`/`POST` with a simple content type — triggers a preflighted `OPTIONS`
request the browser sends automatically before the real one, and the server must answer it
correctly (`Access-Control-Allow-Origin`, `-Methods`, `-Headers`) or the real request never
fires. Seven services means the browser is doing this dance, and each service's team owning
its own CORS config, seven times.

In **development**, `server.proxy` makes this invisible, and that invisibility is exactly why
teams are frequently surprised in production:

```ts
// vite.config.ts — dev only
export default {
  server: {
    proxy: {
      '/api/users': 'http://localhost:4001',
      '/api/orders': { target: 'http://localhost:4002', changeOrigin: true },
    },
  },
}
```

Per the docs, `server.proxy` is:
> *"Configure custom proxy rules for the dev server. Expects an object of `{ key: options }`
> pairs."*

and it:
> *"Extends [`http-proxy-3`](https://github.com/sagemathinc/http-proxy-3#options)."*

Because the browser now talks only to Vite's dev server (one origin) and Vite's Node process
forwards the request server-to-server, there is no cross-origin browser request and therefore
no preflight at all during development — the browser never learns that seven different
origins exist. The moment the app is deployed as static files with no dev server in front of
it, that forwarding disappears, and if nothing replaced it in production, the fan-out and its
preflight tax reappear in full. This is the single most common way a team discovers the cost
late: it was real the whole time, just hidden by the tool they were developing with. The
proxy-mechanics chunk that covers `changeOrigin`, `rewrite`, and the security caveats around
proxied websockets is **not written yet**.

`server.cors` is the mirror image — Vite's own dev server, not a backend, deciding whether to
answer cross-origin requests *made to it*:
> *"Pass an [options object](https://github.com/expressjs/cors#configuration-options) to fine
> tune the behavior or `true` to allow any origin."*
Setting it to `true` is flagged as a security risk in the docs, for the same reason it is a
risk on any server: it tells every origin on the internet the response is fair game to read.

## Credentials: where does the token end up?

Seven services each needing to verify the caller means one of a few shapes, all worse than
one:

- **One token, sent to all seven** — requires all seven services to share a trust root (same
  issuer, same signing key or a shared introspection endpoint) or the token verification logic
  is duplicated seven times, with seven chances to get expiry or scope checking wrong.
- **Seven separate tokens** — the browser (or a client-side auth library) now manages seven
  credentials, seven refresh cycles, and seven places a stale token silently starts failing
  requests instead of one.
- **A session cookie, sent everywhere** — cookies are scoped by domain, so seven services on
  seven different hostnames either share a parent domain (`*.api.example.com` with a
  `Domain=api.example.com` cookie) or each needs its own cookie, reintroducing the N-credential
  problem.

None of these is a build-tool decision, and Vite ships no help for any of them beyond exposing
whatever `fetch()` headers or cookies the application code sets. A single-origin BFF collapses
this to "one token, one place it is checked" — the BFF terminates the client-facing session and
makes whatever server-to-server calls it needs to the real services, using service-to-service
credentials the browser never sees at all.

## Over-fetching and the N+1-request shape

A page needing data from three services either makes three separate round trips (each paying
its own latency, each a separate loading state to coordinate) or the frontend is written to
tolerate partial data as each response lands — real complexity that has nothing to do with
what the page is trying to show. This is the same N+1 shape that motivates a GraphQL gateway
or a BFF endpoint that does the fan-out server-side, where the round trip to those seven
services happens over a fast, private network instead of the public internet, and the browser
makes exactly one request. The trade-off is not "avoid over-fetching" for free — it is moving
the fan-out to a place where its cost is an order of magnitude lower, not eliminating the
fan-out.

## What a BFF costs

The BFF is not free, and treating it as free is how a proposal gets waved through without the
real trade-off being weighed:

- **Another deploy unit.** One more service with its own build, its own runtime, its own
  on-call rotation and its own failure mode (if the BFF is down, so is every page that depends
  on it, even if all seven backend services are healthy).
- **Another team boundary.** Someone owns the BFF. If it is the frontend team, they now write
  and operate backend code; if it is a platform team, the frontend team has a new dependency
  in its critical path for shipping a UI change that needs a new field from an existing
  service.
- **A place for version skew.** The BFF's contract with the frontend and its contract with
  each backend service can drift independently — a backend service ships a breaking change,
  the BFF is not updated, and the frontend's working code starts failing against data it was
  never told changed.
- **A new latency floor.** Even on a fast private network, the BFF still makes real calls to
  real services; a poorly written BFF that fans out sequentially instead of concurrently can be
  slower than the direct multi-origin approach it replaced.

## What Vite's stake in this actually is

Restated plainly, because it is easy to over-credit the build tool: **Vite does not decide
whether to build a BFF.** That is entirely an application-architecture and team-topology
decision, made before `vite.config.ts` is opened. Vite's only stake is that once a single
origin exists — whether that is a BFF, a GraphQL gateway, or just one well-designed backend —
`base`, cookie scoping and CORS all become simple, because there is exactly one origin to
configure them against instead of N. The BFF-mechanics-and-pattern discussion itself belongs
in `docs/system-design/` and `docs/nodejs/`, not here.

## Gotchas

**★ Symptom: "the app is fast in dev, slow in prod" and nobody can find a bundle-size
regression.** Cause: dev's `server.proxy` hides the multi-origin fan-out entirely — every
request looks same-origin to the browser during development. Production has no proxy unless
one was deliberately deployed, so the DNS/TLS/preflight cost that was invisible the whole time
becomes visible for the first time in production. Fix: reproduce with a production build served
statically (no dev server in front of it) before trusting a dev-mode latency measurement for
anything involving multiple backend origins.

**★ Symptom: `server.cors: true` was added to "fix" a CORS error and the error went away.**
Cause: it does fix it, by telling Vite's dev server to answer any origin — but this is a
development convenience for the *dev server answering requests made to it*, not a statement
about what the real backend services should do in production, and the docs call it out as a
security risk if left on for a server that matters. Fix: use it, if at all, only for local
development, and solve the real cross-origin problem architecturally (BFF/gateway) rather than
by widening CORS on a production-facing service.

**★ Symptom: a token refresh works for the primary API but silently stops working for a
second service the frontend also calls directly.** Cause: N direct origins usually means N
independently-implemented auth flows, and only one of them got updated when the refresh logic
changed. Fix: this is exactly the failure mode a BFF removes — one token, refreshed in one
place, because the browser has one origin to be authenticated against.

**★ Symptom: a page needing data from three services shows a layout shift as each section
pops in at a different time.** Cause: three independent round trips with three independent
completion times, and no BFF or gateway aggregating them into one response. Fix: either
coordinate loading states deliberately in the frontend (skeleton states sized for the slowest
call) or move the aggregation server-side — a BFF endpoint that awaits all three concurrently
and returns one payload.

**★ Symptom: `changeOrigin: true` is copied into every `server.proxy` entry "to be safe."**
Cause: `changeOrigin` rewrites the `Host` header on the proxied request to match the target,
which some backends require (virtual-hosting, or origin checks) and others do not; it is not
universally necessary and is dev-only regardless. Fix: set it per-target based on what that
specific backend actually needs, and remember none of it exists once the dev server is gone —
this belongs in the not-yet-written proxy-mechanics chunk in full.

**★ Symptom: cookies set by one of the seven services are missing on requests to another.**
Cause: cookies are scoped to the domain and path that set them; seven services on seven
hostnames each set cookies only that hostname can read back, unless they deliberately share a
parent domain. Fix: the documentation available here (`http-proxy-3`'s options via
`server.proxy`) documents changing the *origin header*, not `Set-Cookie` domain rewriting —
whether or how a dev proxy rewrites cookie domains is not settled by the source consulted for
this page, and is left as an open question rather than asserted either way.

## Interview questions

**★ Why doesn't HTTP/2's multiplexing solve the cost of calling seven backend services
directly from the browser?**
Multiplexing removes head-of-line blocking for multiple requests on the *same* connection, and
a connection is scoped to one origin. Seven services on seven origins are seven separate
connections regardless of HTTP version, so each independently pays its own DNS lookup, TCP/TLS
handshake and, for non-simple requests, its own CORS preflight. Multiplexing is a same-origin
optimization; the fan-out problem is a cross-origin one, and the two do not overlap.

**★ Why does a CORS problem that "doesn't happen in dev" reappear in production, and what
does that tell you about `server.proxy`?**
`server.proxy` runs inside Vite's own dev-server process and forwards requests server-to-server,
so the browser only ever talks to one origin (the dev server) during development — it never
issues the cross-origin request that would trigger a preflight or a CORS check in the first
place. That forwarding is a dev-only feature with no build output; nothing in `dist/` replaces
it. If a production deployment has no equivalent (reverse proxy, gateway, BFF) sitting in front
of the real services, the cross-origin requests the dev server was quietly absorbing become
real cross-origin requests again, complete with preflights and CORS checks that must now be
answered by the actual backend services.

**★ What problem does a BFF actually solve, and what does it cost?**
It collapses N backend origins into one origin as far as the browser is concerned, which
directly removes the per-origin DNS/TLS/preflight tax, gives the frontend exactly one place to
manage credentials instead of N, and lets it move a multi-service data-aggregation problem
(the N+1-request shape) from the public internet into a fast, private network hop. It costs a
new deployable service with its own on-call surface, a new team-ownership question, a new
place for the frontend's and backend's contracts to drift independently (version skew), and it
adds a real (if smaller) latency floor of its own — a BFF that fans out sequentially can still
be slow.

**★ Is choosing to build a BFF a Vite decision? What is Vite's actual stake in it?**
No — it is an application-architecture and team-topology decision made upstream of the build
tool entirely, the same way the number of backend services is. Vite's only stake is downstream
of that decision: once there is a single origin (BFF, gateway, or otherwise), `base`, cookie
scoping and CORS configuration all become simple to reason about, because there is one origin
to configure them against instead of N independently-owned ones. Vite does not participate in
choosing whether that single origin exists.

**★ Why is "N direct services, N auth flows" a real operational risk rather than a
theoretical one?**
Because each service team can independently change its own auth requirements — a token
lifetime, a required scope, a rotation schedule — without coordinating with the frontend or
with the other services' teams. The frontend ends up maintaining N separate pieces of
credential-handling logic that drift out of sync at different rates, so an outage shows up as
"login works for most of the app but silently fails for one section," which is far harder to
diagnose than a single auth flow failing outright.

---

{/* FOOTER */}
