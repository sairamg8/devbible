---
title: "Rate limiting"
sidebar_label: "04 · Rate limiting"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Limit by IP or user. Skip liveness probes. Keys must use the real client IP (`trust proxy`).**

> Verified: 2026-08-14 — **no sandbox run**. Express has **no rate limiter**;
> `express-rate-limit` is a third-party package
> ([Resources → Middleware](https://expressjs.com/en/resources/middleware/)). What Express
> supplies is the key material, and its correctness is entirely a `trust proxy` question:
> `req.ip` is *"derived from the left-most entry in the `X-Forwarded-For` header"* whenever
> `trust proxy` does not evaluate to false, and comes from the socket otherwise
> ([request reference](https://expressjs.com/en/5x/api/request/),
> [behind proxies](https://expressjs.com/en/guide/behind-proxies.html)).
> **Both misconfigurations break the limiter, in opposite directions** — see below; the
> mechanism is [page 01](01-trust-proxy.md).
> `429 Too Many Requests` and the `Retry-After` header are
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) /
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html); `RateLimit-*` headers are an
> IETF draft, not a standard.

```js
import rateLimit from 'express-rate-limit';
app.use('/api', rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
}));
```

Brute-force protection on `/login` is tighter than global API limits.

## 🔴 The key is the whole security property

A rate limiter is only as good as the thing it counts against, and `req.ip` has two
failure modes that are mirror images:

| `trust proxy` | `req.ip` becomes | Result |
|---|---|---|
| **Off**, behind a proxy | The proxy's address | **Everyone shares one bucket.** One noisy client locks out all users |
| **`true`**, with an unsanitised edge | The client's own `X-Forwarded-For` | **No limit at all.** A new header value per request is a new identity |

The second is the dangerous one, because it *looks* like it works: the middleware
is mounted, headers are returned, the dashboard shows counts. They are simply
counts of fabricated addresses, and the brute-force protection on `/login` is
inert.

**Verify the key, not the configuration.** A single request with a forged header
against a staging endpoint that echoes `req.ip` settles it in a minute — and it is
the only check that distinguishes a working limiter from a decorative one.

## Key by identity where you have one

IP is a poor identifier: users share NATs and mobile carriers, and an attacker
with a botnet or a proxy pool has as many addresses as they want.

```js
keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req),
```

- **Authenticated traffic → key by user id.** Precise, and unaffected by whatever
  the network does.
- **Unauthenticated traffic → IP, and accept the imprecision**, because there is
  nothing better.
- **Login specifically → key by *both* IP and the submitted username.** Keying only
  on IP misses distributed credential stuffing; keying only on the username lets an
  attacker lock out any account they can name — a denial-of-service dressed as a
  security control.

That last pairing is the one worth remembering: **per-username limits must fail
towards letting the real user in**, so treat them as a signal for step-up
verification rather than a hard block.

## Limits are per process unless the store is shared

The default memory store counts in **one process**. Two consequences that surprise
people at exactly the wrong moment:

- **Horizontal scaling multiplies your limit.** Four instances with `max: 100`
  permit 400 — silently, the day autoscaling adds a pod.
- **A deploy resets every counter.** Restart the process and the attacker's budget
  is refreshed.

For anything that matters, back it with a shared store (Redis, in the Redis track).
Until then, **write the effective limit down as `max × instances`** so nobody
believes a number that is not true.

## What to exempt, and what never to

```js
skip: (req) => req.path === '/health' || req.path === '/ready',
```

Health and readiness probes must be exempt — a limiter that starts 429ing your
orchestrator's probes causes the outage it was meant to prevent.

**Never exempt by a header the client controls.** `skip: (req) => req.get('X-Internal')`
is bypassable by anyone who reads it in your source or guesses it. Exempt by path,
by authenticated service identity, or by source address you actually trust.

## Answer honestly when you refuse

```js
res.status(429)
   .set('Retry-After', '60')
   .json({error: {code: 'RATE_LIMITED', message: 'Too many requests'}});
```

`Retry-After` turns "try later" into something a client can act on, and a
well-behaved client backs off instead of hammering. The same error envelope as
every other failure ([Phase 5](../phase-5-errors/03-error-contract/README.md)) means a
client parses one shape.

## Trade-off

Application-layer limiting sees things a proxy cannot — the authenticated user, the
route's cost, the difference between a login attempt and a health check. That
context is why it belongs here.

It also spends your resources to reject: the request already crossed the network,
occupied a connection, and ran every middleware ahead of the limiter. Under a
volumetric attack that is exactly the wrong place to defend, which is why an edge
or CDN limiter handles crude floods and the app handles precision.

**Both layers, different jobs.** And a limiter tuned too tightly is itself an
availability risk — a burst of legitimate traffic that trips it looks identical to
an outage from the user's side.

## Gotchas

**Symptom:** One user's activity rate-limits everybody  
**Cause:** `trust proxy` off, so every request shares the proxy's IP  
**Fix:** Configure `trust proxy` to match the topology ([page 01](01-trust-proxy.md))

**Symptom:** The limiter never triggers under attack  
**Cause:** `trust proxy: true` with an edge that does not overwrite `X-Forwarded-For` —
the attacker supplies a fresh IP per request  
**Fix:** Trust by hop count or proxy address, and verify with a forged header

**Symptom:** Limits appear four times too generous  
**Cause:** In-memory store, four instances  
**Fix:** A shared store, or state the effective limit as `max × instances`

**Symptom:** Health checks start failing under load and the orchestrator restarts pods  
**Cause:** Probes counted against the limit  
**Fix:** `skip` for `/health` and `/ready`

**Symptom:** An attacker locks a specific user out of their account  
**Cause:** Login limits keyed only on username  
**Fix:** Key on IP *and* username; treat username-level limits as a signal for step-up,
not a hard block

**Symptom:** Counters reset on every deploy  
**Cause:** Memory store  
**Fix:** Shared store — otherwise a deploy is a free reset for whoever is being limited

## Interview questions

**★ Where should login rate limits sit?**  
On the auth routes, stricter than general API limits.

**★ What are the two ways `trust proxy` breaks a rate limiter?**  
Off behind a proxy: every request shares the proxy's IP, so one client locks out
everyone. Set to `true` without a sanitising edge: `req.ip` comes from a
client-controlled header, so an attacker gets a fresh identity per request and the
limiter counts fabricated addresses while appearing to work.

**★ How would you key a login rate limiter?**  
On IP **and** the submitted username. IP alone misses distributed credential stuffing;
username alone lets an attacker lock out any account they can name. And a
username-keyed limit should trigger step-up verification rather than a hard block, so
it cannot be used as a denial of service.

**Why can a rate limiter be four times more permissive than configured?**  
The default store counts per process. Four instances with `max: 100` allow 400 in
aggregate, and a deploy resets every counter. A shared store is the fix.

**What must never be used to exempt a request from limiting?**  
A client-supplied header. Anyone who reads your source — or guesses — bypasses the
limiter entirely. Exempt by path or by an identity you actually verified.

**Why keep rate limiting at the edge as well as in the app?**  
The app can only reject after the request has crossed the network and run the
middleware ahead of the limiter, which is the wrong economics for a volumetric flood.
The edge handles volume; the app handles precision — user identity, route cost, login
attempts.


---

← Prev: [Helmet](03-helmet.md) · Next → [CSRF and injection surfaces](05-csrf-and-injection.md)
