---
title: "CORS in Express"
sidebar_label: "02 · CORS"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

**Browsers enforce CORS, not servers alone. Credentials + wildcard origins do not mix.**

> Verified: 2026-08-14 — **no sandbox run**. CORS is a **browser** mechanism defined by the
> [WHATWG Fetch standard](https://fetch.spec.whatwg.org/#http-cors-protocol), not an
> Express feature: Express ships no CORS middleware, and the `cors` package is one of the
> third-party modules listed under
> [Resources → Middleware](https://expressjs.com/en/resources/middleware/).
> Two normative points the page depends on: a response to a **credentialed** request must
> name a concrete origin — `Access-Control-Allow-Origin: *` is not permitted with
> credentials — and a preflight is an **`OPTIONS`** request the browser sends before
> non-simple requests. Express's own contribution is only routing: an unhandled `OPTIONS`
> falls through to your 404, which is why mount order matters.
> That CORS is not a server-side access control follows directly from it being enforced by
> the browser — a non-browser client ignores it entirely.

```js
import cors from 'cors';
app.use(cors({
  origin: ['https://app.example.com'],
  credentials: true,
}));
```

Dynamic origin reflection must allow-list — reflecting any `Origin` with credentials is a bug.

## CORS is not access control

The single most common misconception, and it changes what you use it for.

CORS **relaxes** a browser restriction. It does not add a server-side check. A
request from curl, Postman, a mobile app or another server ignores CORS entirely —
the headers are advisory to browsers and invisible to everything else.

So:

- **A locked-down CORS policy protects nothing on its own.** Authentication and
  authorisation are what protect the endpoint
  ([Phase 8](../phase-8-validation-authz/README.md)).
- **What CORS *does* protect** is your users' browsers from other origins reading
  responses using their ambient credentials. That is a real and valuable
  protection — and it is the only one on offer.

Stating it plainly because the mistake is expensive in both directions: teams add
CORS believing they secured an endpoint, and teams disable it believing they have
opened a hole that was already open.

## Reflecting the origin is where it goes wrong

The dangerous configuration looks like a convenience:

```js
// ⛔ reflects ANY origin, with credentials — every site can read authenticated responses
app.use(cors({origin: true, credentials: true}));

// ⛔ same bug, hand-rolled
res.set('Access-Control-Allow-Origin', req.get('Origin'));
res.set('Access-Control-Allow-Credentials', 'true');
```

Reflection defeats the rule against `*` with credentials by naming a concrete
origin — the attacker's. A victim visiting `evil.example` now has their browser
issue credentialed requests to your API and read the responses.

Allow-list instead, and be careful how you match:

```js
const ALLOWED = new Set(['https://app.example.com', 'https://admin.example.com']);

app.use(cors({
  origin: (origin, cb) =>
    !origin || ALLOWED.has(origin)      // no Origin = same-origin or non-browser
      ? cb(null, true)
      : cb(null, false),                // reject by NOT setting the header
  credentials: true,
}));
```

**Match exactly.** `origin.endsWith('example.com')` also matches
`evil-example.com` and `example.com.attacker.net` — a prefix/suffix check is a
recurring real-world CORS bypass. Compare whole strings, and remember that scheme
and port are part of an origin: `https://app.example.com` and
`http://app.example.com:3000` are different origins.

## The preflight, and why it must not 404

For anything beyond a "simple" request — a custom header like `Authorization`, a
`Content-Type: application/json`, a `PUT`/`DELETE` — the browser first sends an
`OPTIONS` request and only proceeds if the response permits it.

Two Express-specific consequences:

1. **Mount CORS before your routes and before authentication.** A preflight carries
   no credentials, so an auth middleware in front of it answers 401 and the browser
   reports a CORS failure. The cause and the message have nothing in common.
2. **An unhandled `OPTIONS` becomes a 404.** Express does not answer preflights for
   you, and a 404 to a preflight surfaces to the developer as "blocked by CORS
   policy" with no mention of the route.

`Access-Control-Max-Age` lets the browser cache the preflight result, which removes
a round trip per request in hot paths — worth setting once the policy is stable.

## Trade-off

A tight allow-list is correct and inconvenient: every new front-end origin —
staging, preview deployments, a partner's domain — is a configuration change and a
deploy. Teams reach for reflection precisely to escape that friction, and it is
the one shortcut here that converts a policy into a vulnerability.

**Make the list configuration, not code.** An environment variable of comma-separated
origins keeps the friction at deploy time rather than release time, and preview
environments can have their own value without anyone editing a matcher.

If you find yourself wanting `origin: true` with `credentials: true`, the honest
alternatives are: use bearer tokens instead of cookies (no ambient credentials, so
the risk changes shape), or put the front end on the same origin behind a proxy and
delete the CORS configuration entirely.

## Gotchas

**Symptom:** "Blocked by CORS policy" but the server logs show a 401  
**Cause:** Authentication middleware mounted before CORS — the preflight has no
credentials  
**Fix:** Mount `cors()` before authn, and before your routes

**Symptom:** Preflights return 404  
**Cause:** Nothing handles `OPTIONS`; it falls through to the 404 handler  
**Fix:** Mount the CORS middleware app-wide, above the router

**Symptom:** Cookies are not sent on cross-origin requests  
**Cause:** `credentials: true` set on the server but the client did not send
`credentials: 'include'` — both sides are required  
**Fix:** Set it in both places; and the cookie itself needs `SameSite=None; Secure`
([Phase 8](../phase-8-validation-authz/05-cookies-sessions-wireup.md))

**Symptom:** An attacker's site can read authenticated responses  
**Cause:** Origin reflection with credentials  
**Fix:** Exact-match allow-list. Never reflect

**Symptom:** `evil-example.com` passes the origin check  
**Cause:** `endsWith('example.com')` — suffix matching  
**Fix:** Whole-string comparison against a set

**Symptom:** CORS "works" from Postman but fails in the browser  
**Cause:** Postman is not a browser and does not enforce CORS at all  
**Fix:** Nothing is broken — but it is the reminder that CORS protects users, not the API

## Interview questions

**★ Can you use `Access-Control-Allow-Origin: *` with cookies?**  
No — browsers forbid credentialed requests with `*`.

**★ Does CORS protect your API?**  
No. It is enforced by browsers and ignored by every non-browser client. It protects
your *users* from other origins reading responses with their ambient credentials.
Authentication and authorisation are what protect the endpoint.

**★ Why is reflecting the `Origin` header with credentials dangerous?**  
It sidesteps the rule against `*` by naming a concrete origin — the attacker's. Any
site the victim visits can then make credentialed requests to your API and read the
responses. Allow-list with exact matching instead.

**★ Why do CORS failures often show up as a 401 in your logs?**  
The preflight `OPTIONS` request carries no credentials. If authentication is mounted
before CORS, it answers 401, and the browser reports it as a CORS error with no
mention of auth.

**What makes a request "non-simple", and what happens then?**  
A custom header such as `Authorization`, a JSON content type, or a method like PUT or
DELETE. The browser sends a preflight `OPTIONS` first and only proceeds if the
response permits it — so an unhandled `OPTIONS` becomes a 404 and looks like a CORS
policy failure.

**Why is `endsWith('example.com')` a bug?**  
It matches `evil-example.com` and `example.com.attacker.net`. Origins are compared as
whole strings, including scheme and port.


---

← Prev: [trust proxy](01-trust-proxy.md) · Next → [Helmet](03-helmet.md)
