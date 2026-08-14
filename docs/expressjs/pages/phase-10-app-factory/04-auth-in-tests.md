---
title: "Auth in tests"
sidebar_label: "04 · Auth in tests"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Test helpers mint sessions or JWTs without copying production crypto pages.**

> Verified: 2026-08-14 — **no sandbox run**, and **not an Express topic at the mechanism
> level**: Express has no authentication, so what a test mints depends entirely on what
> [Phase 8](../phase-8-validation-authz/04-authn-middleware/README.md)'s middleware verifies.
> The Express-side facts are the ones that decide *how* a test presents a credential:
> `req.get()` reads headers case-insensitively, and `req.cookies` requires cookie-parser
> ([request reference](https://expressjs.com/en/5x/api/request/)) — so a cookie-session
> app needs the test to send a `Cookie` header, not an `Authorization` one.
> Token signing, hashing and session storage are
> [Node Phase 8](../../../nodejs/pages/phase-8-security/README.md); the testing
> curriculum is [Node Phase 9](../../../nodejs/pages/phase-9-testing/README.md).

```js
function authed(agent) {
  return agent.set('Authorization', `Bearer ${testTokenFor('admin')}`);
}
```

Keep secrets for tests local and deterministic.

## Mint a real credential — do not bypass the middleware

There are two ways to get an authenticated request in a test, and only one of them
tests anything:

```js
// ✅ mint a real token the real middleware verifies
const app = createApp(deps);
await request(app).get('/api/orders')
  .set('Authorization', `Bearer ${signTestToken({sub: 'u1', role: 'admin'})}`)
  .expect(200);

// ⛔ stub the middleware away — now auth is untested everywhere
const app = createApp({...deps, requireAuth: (req, res, next) => {
  req.user = {id: 'u1', role: 'admin'};
  next();
}});
```

The second is tempting because it is one line and always works. It also means **no
test ever exercises token verification, expiry handling, the 401 path, or the
mounting order** — and the missing-guard bugs from
[Phase 8](../phase-8-validation-authz/04-authn-middleware/README.md) become invisible to
the suite. A route that forgot `requireAuth` entirely passes identically.

Sign a real token with a test secret. The middleware runs, the failure paths are
reachable, and the helper is three lines.

For cookie sessions, the equivalent is presenting a real session cookie —
Supertest's agent persists cookies across requests, so logging in once through the
real login route and reusing the agent is both realistic and simple.

## Test the deny paths, or you have tested nothing

The helper exists so that these are cheap to write, and they are the point:

```js
it('401s with no token',        () => request(app).get('/api/orders').expect(401));
it('401s with an expired token', () => authed(app, expiredToken).expect(401));
it('401s with a forged signature', () => authed(app, forgedToken).expect(401));
it('403s for the wrong role',   () => authed(app, memberToken).delete('/api/orders/7').expect(403));
it('404s for another user\'s order', () => authed(app, otherUser).get('/api/orders/7').expect(404));
```

The last two are the ones that catch real vulnerabilities — the RBAC and ownership
gaps from [Phase 8](../phase-8-validation-authz/07-ownership.md). **Write the 404
test for someone else's record on every resource**; it is the only automated defence
against the IDOR class, and it is a one-line test once the helper exists.

## Keep test secrets out of production reach

A test signing key is a credential. Two rules:

- **Different value, always.** A test secret that also works in production means
  anyone reading the repository can mint valid tokens.
- **Injected, not hard-coded in the app.** The secret comes from the test's config
  ([Phase 9](../phase-9-hardening/06-timeouts-and-secrets.md)), so production
  boot fails without a real one rather than falling back to the test value.

Deterministic is fine and desirable — a fixed test key makes failures reproducible.
It just must never be a key that unlocks anything real.

## Trade-off

Minting real credentials keeps the middleware in the test path, which is the whole
value — auth is exercised on every request the suite makes. It costs a small helper
that must track the production token format: change the claims and the helper needs
updating, or every test fails at once.

Stubbing the middleware removes that coupling and removes the coverage with it. The
honest middle ground for a large suite is **one shared helper**, so a format change
is one edit, and a handful of tests that go through the real login route end to end
to prove the helper still matches reality.

## Gotchas

**Symptom:** Auth is never tested despite every test being authenticated  
**Cause:** The middleware was stubbed  
**Fix:** Mint a real token and let the real middleware verify it

**Symptom:** A route missing `requireAuth` passes all tests  
**Cause:** Same — the stub set `req.user` regardless of the chain  
**Fix:** Real credentials, plus an explicit 401-without-token test per protected route

**Symptom:** Cookie-session tests fail with a token that works in the API  
**Cause:** The app authenticates from a cookie; the test sent an `Authorization` header  
**Fix:** Use Supertest's agent and a real session cookie

**Symptom:** Tests pass locally, fail in CI with 401s  
**Cause:** The signing secret differs between environments  
**Fix:** Inject it from test config; do not read production env in tests

**Symptom:** A token minted in a test works against staging  
**Cause:** Shared signing key  
**Fix:** Test keys must be distinct and worthless outside the suite

**Symptom:** Expiry handling has never been exercised  
**Cause:** Every test token is freshly issued  
**Fix:** Mint one with a past `exp` and assert 401 — an injected clock
([Phase 7](../phase-7-layering/04-di-without-framework.md)) makes this trivial

## Interview questions

**★ Why not hit the real IdP in unit/integration route tests?**  
Slow, flaky, and out of process — contract tests can cover IdP separately.

**★ Why is stubbing out the auth middleware in tests a bad idea?**  
Because nothing then exercises token verification, expiry, the 401 path, or whether the
guard is even mounted. A route that forgot `requireAuth` passes exactly like one that
did not.

**★ Which authentication tests are worth the most?**  
The deny paths: no token, expired token, forged signature, wrong role, and **another
user's record returning 404**. The last is the only automated defence against the IDOR
class.

**How do you authenticate a test against a cookie-session app?**  
Present a real session cookie — Supertest's agent persists cookies, so logging in once
through the real route and reusing the agent works and stays realistic. An
`Authorization` header is not what the middleware reads.

**What rules apply to a test signing secret?**  
Distinct from production and injected from test config. Deterministic is good — it makes
failures reproducible — but it must unlock nothing real, and production must fail to boot
without its own value.


---

← Prev: [Supertest](03-supertest.md) · Next → [Health and boot](05-health-and-boot.md)
