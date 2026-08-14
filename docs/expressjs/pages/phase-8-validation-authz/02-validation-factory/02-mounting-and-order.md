---
title: "Mounting and order"
sidebar_label: "02 · Mounting and order"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Authenticate, authorize, then validate. Every inversion of that order either
leaks information to anonymous callers or spends work on requests you were going
to refuse — and webhooks are the one documented exception.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** The ordering
> mechanism is registration order as an array walk, read from `router@2.2.0`'s
> `Router.prototype.handle` in `sandbox/express-verify/node_modules/`
> ([Phase 2 · 02 · chunk 01](../../phase-2-middleware/02-execution-order/01-the-four-levels.md)).
> The webhook exception rests on `express.raw()`'s default `type` of
> `application/octet-stream` and the already-consumed gate in `body-parser@2.3.0`'s
> `lib/read.js`, both cited in
> [Phase 3 · 02 · chunk 01](../../phase-3-requests/02-json-and-urlencoded/01-the-four-gates.md).
> **The ordering recommendation is this bible's guidance** — Express enforces no
> order and warns about none.

## The chain

```js
router.post(
  '/orders',
  authenticate,                  // 401 before spending effort on the body
  authorize('orders:create'),    // 403 before parsing
  validate({body: createOrder}), // 400
  handler,
);
```

Two reasons for that order, and the second is the one people miss:

**1 · Do not spend work on a request you will refuse.** Parsing and validating a
body for a caller who is about to get a 401 is wasted CPU, and on a public
endpoint it is CPU an attacker chooses to spend for you.

🔴 **2 · Validation errors describe your schema.** A 400 saying *"body.role: must
be one of `admin`, `auditor`, `member`"* is a useful message and a small
information leak. **Anonymous callers do not need it.** Authenticating first means
schema detail is only ever shown to someone who has already proved who they are.

The same argument extends to authorization: a caller who lacks
`orders:create` should get a 403 without learning the shape of an order.

## The webhook exception

Signature verification runs over the **raw bytes**, so it must precede any
parsing at all:

```js
router.post('/webhooks/stripe',
  express.raw({type: 'application/json'}),   // raw bytes, not JSON
  verifySignature,                           // authenticity — before anything else
  handler,
);
```

Three things this depends on, all mechanical:

- **`express.raw()` defaults to `application/octet-stream`**, and providers send
  `application/json` — so without the explicit `type`, `req.body` is never
  populated and the signature check fails on every delivery.
- **It must be above any global `express.json()`** for that path, or JSON consumes
  the stream first and the already-finished gate makes the raw parser bail.
- **A re-serialised object is not the original bytes.** Key order, whitespace and
  number formatting all change; the signature is over what was sent.

The alternative shape, when you want both the raw bytes and a parsed body, is the
`verify` hook — which produces a **403 `entity.verify.failed`** on throw, exactly
the right status for a failed authenticity check
([Phase 3 · 02 · chunk 02](../../phase-3-requests/02-json-and-urlencoded/02-the-parsers-and-their-options.md)).

## Per route, not globally

`validate` is per route by construction — the schemas differ per operation — but
it is worth naming why the pattern is right, because the same logic decides where
`authenticate` goes:

| | Global `app.use` | Per route |
|---|---|---|
| A route missing it | silently inherits, or is silently unprotected | **visible in the route line, and greppable** |
| A route added *above* the `use` | unprotected, and identical to look at | impossible |
| Different rules per route | needs branching inside the middleware | natural |
| Review | you must know the mount order | one line shows the whole chain |

🔴 **Opt-in beats opt-out for anything that decides access.** A route added above
`router.use(authenticate)` is public and looks exactly like every protected route
in the file. Per-route auth appears in the diff.

Infrastructure that genuinely applies to everything — request id, logging,
Helmet, CORS, body parsing — is the opposite case and belongs global, at the top
of the factory
([Phase 2 · 02 · chunk 01](../../phase-2-middleware/02-execution-order/01-the-four-levels.md)).

## What runs before all of it

The chain above sits inside a larger order, and two entries above it matter to
validation:

```js
app.set('trust proxy', 1);          // before anything reads req.ip
app.use(express.json({limit}));     // before validate can see a body
// …
app.use('/api/v1', v1Router);       // where the chain above lives
```

**The body parser must be above the route**, or `req.body` is `undefined` and the
schema rejects everything with a confusing message rather than the client's actual
mistake. That is registration order, and it is absolute — a route registered
before `express.json()` has no body, in the same app where every other route does
([Phase 2 · 02 · chunk 01](../../phase-2-middleware/02-execution-order/01-the-four-levels.md)).

**And the limit is the first line of defence.** `validate` runs *after* the body
has been read into memory, so a schema `.max()` bounds what travels onward but
not what was buffered. The `limit` bounds the buffer
([Phase 3 · 03](../../phase-3-requests/03-size-limits/README.md)).

## Testing the order, not just the layers

The one test that catches a reordering is a request that exercises the
*interaction*:

| Test | Catches |
|---|---|
| unauthenticated POST with a **deliberately invalid** body | 401, not 400 — proves authn runs before validate |
| authenticated POST with the wrong role and an invalid body | 403, not 400 — proves authz runs before validate |
| a webhook with a valid signature, after adding a global JSON parser | the signature still verifies |
| a POST to a route registered above the parser | catches the missing-body case |

The first two are the valuable ones, and they are almost never written — a test
suite that sends valid bodies with valid tokens cannot distinguish any of these
orderings.

## Gotchas

**Symptom:** Anonymous callers can enumerate your schema through error messages
**Cause:** `validate` mounted before `authenticate`
**Fix:** Authenticate first; validate after. Schema detail is for callers who have
identified themselves

**Symptom:** Webhook signatures fail once validation middleware is added globally
**Cause:** Body parsing ran before signature verification, so the raw bytes are
gone
**Fix:** Webhook routes take `express.raw({type: 'application/json'})` above any
global parser — or use the `verify` hook to capture the buffer

**Symptom:** One route's `req.body` is `undefined` while every other route works
**Cause:** It was registered above `express.json()`. Registration order is
absolute
**Fix:** Parsers before routes, in one factory where the order is visible

**Symptom:** A new route is publicly accessible and looks like every other route
**Cause:** `router.use(authenticate)` is opt-out, and the route was added above it
**Fix:** Per-route auth, so a missing guard is in the diff and greppable

**Symptom:** A large body is rejected by the schema but memory already spiked
**Cause:** `validate` runs after the body is buffered; `.max()` bounds what
travels on, not what was read
**Fix:** The `limit` on the parser is the control for the buffer

**Symptom:** Reordering middleware broke nothing in the tests and broke production
**Cause:** Every test sends a valid token and a valid body, so no test exercises
an interaction
**Fix:** Add the 401-with-an-invalid-body and 403-with-an-invalid-body cases

## Interview questions

**★ In what order do authentication, authorization and validation run?**
Authn, authz, then validation. Two reasons: do not spend parsing effort on a
request you are going to refuse, and — the one people miss — **validation errors
describe your schema**, which anonymous callers should not be shown.

**★ What is the exception, and why?**
Webhooks. Signature verification runs over the raw bytes, so it must precede any
parsing — a re-serialised object differs in key order, whitespace and number
formatting, and the signature was computed over what was sent.

**★ Why should authentication be per route rather than `router.use`?**
Because `use` is opt-out: a route added above the line is silently public and
looks identical to every protected route in the file. Per-route auth is visible
in the diff and greppable. Infrastructure that applies to everything is the
opposite case and belongs global.

**★ What single test catches a middleware reordering?**
One that exercises the interaction — an unauthenticated request with a
deliberately invalid body should return **401, not 400**. A suite that only sends
valid tokens and valid bodies cannot distinguish any ordering.

**Does the schema's `.max()` protect memory?**
No. `validate` runs after the body has been buffered, so a field limit bounds
what travels onward, not what was read. The parser's `limit` is the control for
the buffer.

**Why must the body parser be above the route?**
Because the stack is an array walked in registration order with no reordering. A
route registered before `express.json()` sees `req.body` as `undefined` — in the
same app where every route registered after it works fine.

---

← Prev: [The factory](01-the-factory.md) · Index: [Validation factory](README.md) · Next → [Schemas that hold up](03-schemas-that-hold-up.md)
