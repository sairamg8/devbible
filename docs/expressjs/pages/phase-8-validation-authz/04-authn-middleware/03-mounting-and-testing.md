---
title: "Mounting and testing"
sidebar_label: "03 · Mounting and testing"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Where you mount authentication decides what happens when someone forgets it —
and forgetting is the failure mode that actually occurs. Everything else on this
page is about making the forgetting loud.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** Path-prefix
> mounting (`app.use('/api', fn)` runs for *any* path beginning with `/api`) and
> router-level middleware are
> [using middleware](https://expressjs.com/en/guide/using-middleware.html) and the
> [app reference](https://expressjs.com/en/5x/api/app.html#app.use); ordering is
> "the order in which they are added". CORS preflight is an `OPTIONS` request that
> browsers send **without** the author's credentials or `Authorization` header
> ([MDN · Preflighted requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflighted_requests)),
> and `cors` is a separate package
> ([Express middleware](https://expressjs.com/en/resources/middleware.html)).
> `router.stack` is **undocumented internal state** — used below only in a test,
> and flagged as such. Test mechanics live in
> [Phase 10 · 03](../../phase-10-app-factory/03-supertest.md) and
> [Phase 10 · 04](../../phase-10-app-factory/04-auth-in-tests.md).
> **The design guidance is this bible's.**

## Two ways to mount, and one asymmetry

**Opt-in** — each protected route asks for it:

```js
router.get('/orders', requireAuth, listOrders);
router.get('/health', healthCheck);              // public, and says nothing
```

**Opt-out** — the router protects everything, and public routes are declared
before it:

```js
router.get('/health', healthCheck);              // public, deliberately first
router.use(requireAuth);                         // everything below is protected
router.get('/orders', listOrders);
```

Both work. They are not symmetric, because they fail differently:

| Someone forgets… | Opt-in | Opt-out |
|---|---|---|
| to protect a new route | route is **silently public** | route is protected — nothing to forget |
| to make a route public | — | route **401s**, immediately and visibly |

🔴 **One failure is silent and reaches production; the other is loud and reaches
the developer.** That asymmetry is the whole argument, and it is why this bible
recommends **opt-out at the router that owns the resource** — not app-wide, where
the public surface (health, docs, static, webhooks) piles up into an allowlist
nobody maintains
([Phase 10 · 05](../../phase-10-app-factory/05-health-and-boot.md)).

⚠️ **The counter-argument is real and worth stating.** Opt-in is *greppable*:
`grep -rn requireAuth routes/` lists every protected route, and a reviewer reading
one route file sees its protection without knowing what ran above it. Opt-out
makes protection **positional** — the truth is the `router.use` line and the
order of everything after it
([Phase 2 · 02](../../phase-2-middleware/02-execution-order/README.md)).

The way to keep both is to make **the public routes** the greppable thing. There
are few of them, they change rarely, and each one is a decision worth a comment:

```js
// PUBLIC — no authentication below this line is an accident
router.post('/webhooks/stripe', verifyWebhookSignature, handleStripe);
router.get('/health', healthCheck);

router.use(requireAuth);   // ── everything past here requires a caller ──
```

## Prefix mounting is a prefix, not a route

```js
app.use('/api', requireAuth);        // ⚠️ /api, /api/anything, /api/x/y/z
```

`app.use(path, …)` matches **any path that begins with** `path`, which is what
makes this concise and what makes it easy to misjudge. Two consequences worth
holding:

- `/apidocs` does **not** match `/api` as a prefix segment — but reasoning about
  it from memory is how mistakes happen. If a path's protection matters, mount on
  the router that owns it rather than on a string
  ([Phase 1 · 05](../../phase-1-routing/05-path-matching-express5.md)).
- A request to an unmatched path under the prefix still runs `requireAuth`, so an
  unauthenticated request to a URL that does not exist gets **401, not 404**.
  That is usually correct — a 404 would tell an anonymous caller which routes
  exist — but it should be a choice, not a surprise
  ([Phase 5 · 06](../../phase-5-errors/06-not-found-and-process.md)).

## Order: what must come before authentication

```js
app.use(requestId);          // 1 · so every log line, including the 401, has one
app.use(logger);             // 2 · log the request that failed to authenticate
app.use(cors(corsOptions));  // 3 · 🔴 before authn — see below
app.use(rateLimit);          // 4 · cheap rejection before signature work
app.use('/api', requireAuth);// 5
app.use(express.json());     // 6 · parse only for callers who exist
app.use('/api', routes);
app.use(errorHandler);       // last, always
```

🔴 **CORS before authentication, always.** A preflight is an `OPTIONS` request
the browser sends **without** the `Authorization` header. If `requireAuth` runs
first, the preflight 401s, the browser never sends the real request, and the
error the developer sees is a **CORS error** — pointing at the one piece of
configuration that is correct. Hours disappear here
([Phase 9 · 02](../../phase-9-hardening/02-cors.md)).

**Rate limiting before authentication** so that a flood of forged tokens is
rejected before any signature is verified
([Phase 9 · 04](../../phase-9-hardening/04-rate-limiting.md)).

**Body parsing after authentication** for protected routes: there is no reason to
buffer and parse a megabyte of JSON for a caller you are about to reject
([Phase 3 · 03](../../phase-3-requests/03-size-limits/README.md)). ⚠️ The
exception is anything that must verify a **signature over the raw body** — Stripe
and GitHub webhooks — which needs `express.raw` and must therefore sit before, and
outside, the authenticated router
([Phase 3 · 06](../../phase-3-requests/06-raw-and-text.md)).

**Request id and logging first**, so the 401 you are debugging has a correlatable
line ([Phase 10 · 02](../../phase-10-app-factory/02-request-id.md)).

## Test the deny paths, not the allow path

The allow path gets tested by accident — every other test needs a logged-in
caller, so a broken `requireAuth` breaks the whole suite loudly. **The deny paths
are the ones nobody writes**, and they are where the bugs from
[chunk 01](01-one-question-only.md) live:

```js
describe('requireAuth', () => {
  const cases = [
    ['no header',        undefined],
    ['wrong scheme',     'Basic abc'],
    ['bearer, no token', 'Bearer'],
    ['garbage token',    'Bearer not-a-token'],
    ['expired token',    `Bearer ${expiredToken}`],
    ['tampered token',   `Bearer ${tamperedToken}`],
  ];

  for (const [name, header] of cases) {
    it(`401s: ${name}`, async () => {
      const req = request(app).get('/api/orders');
      if (header) req.set('Authorization', header);
      const res = await req;

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');   // identical, always
      expect(res.headers['www-authenticate']).toBe('Bearer');
    });
  }
});
```

Two assertions carry the weight. **`res.status` is 401** catches the
fall-through-as-anonymous bug: if the middleware calls `next()` on a bad token,
this returns 200 and the test fails on the exact line that matters. **The
identical `error.code`** is what keeps "expired" and "invalid" indistinguishable
as the code changes — a property no reviewer will re-check by eye
([Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md)).

⚠️ **A test that mocks `verifyToken` to return a user proves nothing about
authentication.** It proves the handler works. Verification failures must be
tested against the real verifier, with a real expired token and a real tampered
one — those are the branches with the security consequences
([Phase 10 · 04](../../phase-10-app-factory/04-auth-in-tests.md)).

## The test that catches the route someone forgot

Opt-out mounting makes forgetting loud at runtime. A **coverage test** makes it
loud at commit time — enumerate the routes, subtract the declared public ones,
and assert that everything remaining 401s anonymously:

```js
const PUBLIC = new Set(['/health', '/webhooks/stripe']);

it('every non-public route rejects an anonymous caller', async () => {
  for (const path of routeInventory().filter(p => !PUBLIC.has(p))) {
    const res = await request(app).get(path);
    expect(res.status).not.toBe(200);
  }
});
```

Keeping `PUBLIC` in the test rather than in the app is deliberate: **adding a
public route then requires editing a file called "public routes"**, which is a
review prompt. The list is the point; how `routeInventory()` gets its paths is
not.

🔴 **Do not build that inventory from `router.stack`.** It is undocumented
internal state — Express publishes no route-listing API — so a version bump can
change its shape without warning. Derive the list from your own route
definitions, or from a table the routers are built from, and you get a test that
does not depend on internals
([Phase 1 · 03](../../phase-1-routing/03-router-composition/README.md)).

## Gotchas

**Symptom:** A new endpoint shipped without authentication and nobody noticed
**Cause:** Opt-in mounting — forgetting `requireAuth` fails silently and publicly
**Fix:** Opt-out on the router that owns the resource, plus the route-coverage
test

**Symptom:** The browser reports a CORS error on an endpoint whose CORS config is
correct
**Cause:** `requireAuth` runs before `cors`, so the credential-free preflight
`OPTIONS` 401s
**Fix:** Mount CORS before authentication

**Symptom:** A webhook signature check fails once authentication is added
**Cause:** The route needs the raw body and now sits behind JSON parsing, or
behind authn it can never satisfy
**Fix:** Webhooks are public routes with their own signature verification,
mounted before the authenticated router with `express.raw`

**Symptom:** Unauthenticated requests to a misspelled URL return 401
**Cause:** Prefix mounting runs authentication before routing decides there is no
route
**Fix:** Usually correct — it hides your route table from anonymous callers — but
make it a decision

**Symptom:** Large uploads are parsed and then rejected with 401
**Cause:** `express.json()` mounted before authentication
**Fix:** Parse after authenticating, except where a raw body must be verified

**Symptom:** The auth tests pass while production 401s everything
**Cause:** The tests mock `verifyToken`, so the real verifier is never exercised
**Fix:** Test deny paths against the real verifier with real expired and tampered
tokens

**Symptom:** A route-listing test breaks on an Express upgrade
**Cause:** It read `router.stack`, which is internal and undocumented
**Fix:** Build the inventory from your own route definitions

## Interview questions

**★ Should authentication be opt-in per route or opt-out per router?**
Opt-out, because the failure modes are not symmetric: forgetting to protect a
route under opt-in is silent and reaches production, while forgetting to exempt a
public route under opt-out is a 401 the developer sees immediately. The cost is
that protection becomes positional, so the public routes must be the greppable,
commented list.

**★ Why must CORS be mounted before authentication?**
Because a preflight is an `OPTIONS` request sent without credentials. Behind
authentication it 401s, the browser never sends the real request, and the
symptom is a CORS error pointing at configuration that is already correct.

**★ Which authentication cases actually need tests?**
The deny paths — missing header, wrong scheme, malformed, expired, tampered —
asserting both the 401 and that every one of them returns an identical body. The
allow path is exercised by every other test in the suite.

**★ How do you prove no route shipped unprotected?**
A test that enumerates the routes, subtracts a `PUBLIC` set kept in the test
file, and asserts the rest reject an anonymous caller. Keeping the list in the
test means adding a public route requires an edit that a reviewer will see.

**Where should body parsing sit relative to authentication?**
After it, so bodies are not buffered and parsed for callers about to be rejected
— with the exception of routes that verify a signature over the raw body, which
must be mounted before and outside the authenticated router.

**Why not enumerate routes from `router.stack`?**
It is undocumented internal state; Express exposes no route-listing API, so its
shape can change on a version bump. Build the inventory from your own route
definitions instead.

---

← Prev: [Tokens, sessions and cost](02-tokens-sessions-and-cost.md) · Index: [Authn middleware](README.md) · Next → [Cookies and sessions wire-up](../05-cookies-sessions-wireup.md)
