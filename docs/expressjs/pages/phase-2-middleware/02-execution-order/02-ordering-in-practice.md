---
title: "Ordering in practice"
sidebar_label: "02 · Ordering in practice"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Order is invisible, unenforced and un-introspectable. The techniques below are
the only ways to find out what actually runs — and the only ways to stop it
drifting.**

> Verified: 2026-08-14. The `DEBUG` namespaces are those the packages register
> with `debug` — `express:application`, `express:router` (via `router`) and
> `router:layer`, read from the `require('debug')('…')` calls in `express@5.2.1`
> and `router@2.2.0` in `sandbox/express-verify/node_modules/`. `router.stack`,
> `layer.name` and `layer.route` are the internal shapes described in
> [Phase 0 · 02 · chunk 02](../../phase-0-express-basics/02-app-router-server/02-a-router-is-a-function-too.md).
> **No sandbox run backs this page and it carries no console block** — the
> commands below are given as things to run, not as output to trust. The
> structural advice is this bible's guidance; Express provides no ordering
> introspection of any kind.

## Finding out what actually runs

**1 · Turn on the debug output.** Both packages use `debug`, so the namespaces
are already there:

```bash
DEBUG=express:*,router:*   node server.js     # everything
DEBUG=router               node server.js     # dispatch decisions only
DEBUG=router:layer         node server.js     # per-layer matching
```

`router` logs `dispatching <METHOD> <url>` and, per matched layer,
`<layer.name> <layerPath> : <originalUrl>` — which is where a **named** function
pays for itself. A trace of `<anonymous>` twelve times tells you nothing;
`requestId`, `jsonParser`, `requireAuth` tells you exactly where the request got
to and where it stopped.

**2 · Add a trace middleware while debugging**, top and bottom of the suspect
range:

```js
const mark = label => (req, res, next) => {
  (req.trace ??= []).push(label);
  next();
};
```

Attach `res.on('finish', () => logger.debug({trace: req.trace}))` once, at the
top, and every request reports the path it took. This is the technique that finds
the hang, because a hung request's trace has an entry with no matching exit.

**3 · Print the stack, accepting that it is an internal.**

```js
// diagnostic only — router.stack is NOT public API
for (const layer of app.router.stack) {
  console.log(layer.name, layer.route ? Object.keys(layer.route.methods) : '(use)');
}
```

⚠️ **Do not ship this.** `router.stack`, `layer.route` and `layer.methods` are
internals; the router package has already changed shape once across a major
version, and `app.router` itself was reworked in Express 5. It is a fine thing to
run in a REPL and a bad thing to build a route-listing endpoint on.

## Stopping order from drifting

The failure this prevents is specific and common: **the same six middleware
mounted across five files, in an order determined by import order.** Nothing
breaks loudly. CORS starts failing for one route after someone runs an import
sorter.

**Assemble in one factory.** One function, all the mounting, numbered comments,
nothing outside it calling `app.use`. That single decision converts "order is an
emergent property of the module graph" into "order is twelve lines you can
review". [Phase 10 · 01](../../phase-10-app-factory/01-create-app.md).

**Assert preconditions loudly.** A middleware that needs another to have run
should say so at the first request rather than producing `undefined` three layers
later:

```js
export function auditLog(logger) {
  return function auditLog(req, res, next) {
    if (!req.id) {
      return next(new Error('auditLog requires requestId middleware to be mounted first'));
    }
    // …
  };
}
```

**Test the order, not just the behaviour.** The one test that catches a
reordering is a request that exercises the *interaction*: a preflight `OPTIONS`
to a protected route asserts CORS-before-authn; a `POST` with a body asserts
parser-before-route; a request with a forged `X-Forwarded-For` asserts
`trust proxy` is doing what you think
([Phase 9 · 01](../../phase-9-hardening/01-trust-proxy/README.md)).

## The cost of a layer

Every global middleware runs for every request that reaches the app — health
probes, scanner 404s, preflights included. The cost of a layer is not the
function call; it is what the function does:

| Layer | Cost per request | Verdict |
|---|---|---|
| a `req.id` assignment | negligible | global, always |
| Helmet setting headers | negligible | global, always |
| `express.json()` | reads and buffers the body **only when the content type matches**; otherwise it is a type check and a `next()` | global is fine |
| a signature or JWT verification | real CPU | on the routes that need identity |
| a database lookup to hydrate `req.user` | a query, on **every** request | never global — this is what breaks health probes |
| deep body logging | log volume proportional to traffic, and bodies contain secrets | never global |

🔴 **The line that matters is not performance, it is blast radius.** A global
database lookup means a database blip fails your liveness probe on every instance
at once, the orchestrator kills them all, and they restart into the same
struggling database. That is a restart storm, and it is caused by a middleware
mounted one line too high
([Phase 10 · 05](../../phase-10-app-factory/05-health-and-boot.md)).

## Trade-off

**Global middleware is easy and it is paid for on every request forever**,
including the ones you did not think about. Narrow mounting is more lines and
more places to forget.

The position this bible takes:

- **Global** — anything genuinely true of every request and cheap: request id,
  logging, security headers, CORS, body parsing, the rate limiter.
- **Per subtree** — anything true of a product area: API-key checks on `/api`,
  a different limiter on `/auth`.
- **Per route** — anything that decides *who may do this*, so a missing one is
  visible in the diff rather than silently inherited
  ([Phase 8 · 04](../../phase-8-validation-authz/04-authn-middleware/README.md)).
- **Above everything** — health probes, so they answer when the rest is failing.

## Gotchas

**Symptom:** Middleware order differs between two deploys with no code change to
the middleware
**Cause:** Mounting is spread across modules, so the effective order follows
import order — which an import sorter or a new import can change
**Fix:** One factory that does all the mounting; modules export routers and mount
nothing

**Symptom:** `DEBUG=router` output is a wall of `<anonymous>`
**Cause:** Arrow functions returned from factories. `Layer` records
`fn.name || '<anonymous>'`
**Fix:** Return **named** function expressions

**Symptom:** A route-listing endpoint broke after an Express upgrade
**Cause:** It read `app.router.stack` / `layer.route`, which are internals — the
router was extracted to its own package and `app.router` reworked in Express 5
**Fix:** Keep stack inspection to a REPL. If you need a published route list,
generate it from the same definitions the routes are built from —
[Phase 6 · 08](../../phase-6-rest-surface/08-openapi.md)

**Symptom:** A request hangs and the trace array has an entry with no exit
**Cause:** That layer neither responded nor called `next()`. This is exactly what
the trace technique is for
**Fix:** Audit that layer's branches, especially `catch` blocks and early returns

**Symptom:** Every instance restarts when the database has a brief blip
**Cause:** A global middleware performs a database lookup, so `/livez` depends on
the database
**Fix:** Move it off the global stack. Liveness must check nothing; dependencies
belong in readiness only

## Interview questions

**★ How do you find out what middleware actually runs for a request?**
`DEBUG=express:*,router:*`, which logs the dispatch and each matched layer by
`layer.name` — so named functions matter. For a persistent view, a trace
middleware that pushes a label onto `req.trace` and logs it on `res.on('finish')`,
which also finds hangs, because a hung request has an entry with no exit.

**★ Is `app.router.stack` a reasonable way to list routes?**
For a REPL, yes. For shipped code, no — it is an internal that has already
changed shape across a major version, and `app.router` itself was reworked in
Express 5. A published route list should be generated from the definitions the
routes are built from.

**★ What stops middleware order from drifting?**
Assembling everything in one factory, so the order is twelve reviewable lines
rather than an emergent property of the module import graph. Plus loud
preconditions in any middleware that depends on another, and tests that exercise
the *interaction* rather than each layer alone.

**★ How do you decide whether a middleware should be global?**
By blast radius, not by speed. Global means it runs for health probes, scanner
404s and preflights. Anything cheap and universally true is fine; a database
lookup is not, because it makes your liveness probe depend on the database and
turns a brief outage into a fleet-wide restart storm.

**What test catches a middleware reordering?**
One that exercises the interaction: a preflight `OPTIONS` to a protected route
(CORS before authn), a `POST` with a body (parser before route), a request with a
forged `X-Forwarded-For` (`trust proxy` behaving as configured). Testing each
layer in isolation cannot catch an ordering bug.

**Why is `express.json()` acceptable as global middleware when a JWT check is
not?**
Because it is gated on the content type: for a request with no matching
`Content-Type` it is a type check and a `next()`. A JWT verification is real CPU
on every request including the ones with no identity, and a JWKS fetch adds a
network round trip.

---

← Prev: [The four levels](01-the-four-levels.md) · Index: [Execution order](README.md) · Next topic → [`next` semantics](../03-next-semantics/README.md)
