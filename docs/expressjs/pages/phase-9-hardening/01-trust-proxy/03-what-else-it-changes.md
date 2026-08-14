---
title: "What else it changes"
sidebar_label: "03 · What else it changes"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**`trust proxy` is not only about addresses. It decides whether Express believes
the protocol and host too — which is why a forgotten setting shows up as "login
works locally and does nothing in production".**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block.** From the
> [request reference](https://expressjs.com/en/5x/api/request/): `req.protocol`
> is derived from `X-Forwarded-Proto` when `trust proxy` does not evaluate to
> false; `req.secure` is a shorthand for `req.protocol === 'https'`;
> `req.hostname` is derived from `X-Forwarded-Host` under the same condition; and
> `req.ips` is the `X-Forwarded-For` chain, empty otherwise. The
> [behind proxies guide](https://expressjs.com/en/guide/behind-proxies.html)
> carries the overwrite warning quoted in
> [chunk 02](02-when-true-is-a-bypass.md). `express-session` documents a `proxy`
> option for trusting `X-Forwarded-Proto` when setting a secure cookie
> ([Express middleware](https://expressjs.com/en/resources/middleware.html)).
> **The debugging order, the checklist and the trade-off are this bible's.**

## The full surface

| Property | Without trust | With trust |
|---|---|---|
| `req.ip` | the proxy's address | the client, per `X-Forwarded-For` |
| `req.ips` | **`[]`** | the full chain from the header |
| `req.protocol` | `'http'` — the proxy's hop to Node | `'https'` per `X-Forwarded-Proto` |
| `req.secure` | **`false`** behind TLS termination | `true` |
| `req.hostname` | the internal host (`internal-app:3000`) | the public host per `X-Forwarded-Host` |

One setting, five properties — which is why the symptoms are so scattered and so
rarely connected back to it.

## The bug this actually produces

🔴 **A `secure: true` cookie is never sent to the browser, and nothing errors.**

TLS terminates at the proxy, so the hop Node sees is plain HTTP. Without trust,
`req.secure` is `false`. A session or cookie layer that respects `secure` then
declines to set the cookie on what it believes is an insecure connection — and
declining is not an error, so there is no log line, no stack trace, and a 200
response with no `Set-Cookie`:

```js
res.cookie('sid', value, {httpOnly: true, secure: true, sameSite: 'lax'});
// behind TLS termination with trust proxy off: silently not delivered
```

The reported symptom is **"login works locally, does nothing in production"** —
which points at authentication, at the session store, at the cookie flags, at
CORS, at anything except an application setting nobody remembers setting
([Phase 8 · 05](../../phase-8-validation-authz/05-cookies-sessions-wireup.md),
[Phase 4 · 07](../../phase-4-responses/07-cookies-out.md)).

⚠️ **`express-session` has its own switch.** It documents a `proxy` option
controlling whether `X-Forwarded-Proto` is trusted when setting a secure cookie;
left unset it follows the app's `trust proxy`. If cookies still fail after the app
setting is correct, that option is the second place to look.

**Debug it in this order** — cheapest first, and each step rules out the next:

1. `req.ips` — empty means trust is off, and everything below follows from that.
2. `req.protocol` / `req.secure` — wrong means the proto header is not believed.
3. The response's `Set-Cookie` — absent means the cookie layer declined.
4. Only then the session store, the flags, and the client.

## Redirects and absolute URLs

Anything that builds an absolute URL from the request inherits the same mistake:

```js
// ⚠️ 'http' behind TLS termination without trust proxy
res.redirect(`${req.protocol}://${req.hostname}/orders`);
```

A user on `https://` is bounced to `http://`, which at best costs a redirect and
at worst downgrades the request before the edge upgrades it again — and any
cookie marked `secure` will not accompany that intermediate hop.

**Prefer a configured public base URL** for anything canonical — emails,
webhooks, OAuth callbacks, absolute links in responses:

```js
// ✅ deployment truth, not request-derived guesswork
res.redirect(`${config.publicBaseUrl}/orders`);
```

`req.hostname` and `req.protocol` describe *how this request arrived*, which is
not the same question as *what URL should I publish*, and the difference matters
the moment a second hostname points at the same app.

## Platforms, containers and the paths you forget

**Managed platforms terminate TLS for you** and forward with `X-Forwarded-*`. The
number of hops is then the platform's business and can change without your
deployment changing — which makes a hard-coded hop count a fragile choice there.
Read the platform's documentation for what it guarantees about
`X-Forwarded-For`; if it documents that it overwrites the header at its edge,
`true` is defensible on that platform and nowhere else.

**The paths that skip the edge are the ones to enumerate**, because each one
breaks the consistency the hop count depends on:

- **Health checks** from the load balancer, arriving on the internal address.
- **Internal service-to-service calls** that address the container directly.
- **Webhook receivers** allowed through a separate ingress.
- **Debug or admin ports** published in a compose file and forgotten.

Each of those arrives with a different chain length. Trusting by **proxy address**
rather than by count survives all of them; a number does not
([chunk 01](01-the-setting-and-the-header.md)).

## Trade-off

Enabling trust gets you the real client IP, working `secure` cookies, and correct
protocols behind a load balancer. Every production deployment behind a proxy needs
it, so the question is never *whether* but *how tightly*.

**The tightness is the trade.** `true` is one line and works in every topology,
including the ones where it is a vulnerability. A hop count or subnet list
requires knowing your infrastructure and must be revisited when a CDN is added —
friction that is doing its job, because that CDN also changes the header chain.

**Encode the topology, not the convenience.** And if you inherit `trust proxy:
true`, the verification in [chunk 02](02-when-true-is-a-bypass.md) is five
minutes and settles it.

## The checklist

Run it when deploying behind a new edge, and when an edge is added or removed:

1. **What is the real chain?** Client → CDN? → load balancer → Node. Count the
   hops you control.
2. **Does the edge overwrite `X-Forwarded-For`, or append?** Appending is not
   sanitising.
3. **Can Node be reached without passing the edge?** If yes, fix that before
   touching the setting.
4. **Is the setting driven by config**, `false` in tests, and set on every app
   instance including mounted sub-apps?
5. **Does `req.ip` show a real client address** in production logs — and does
   `curl -H 'X-Forwarded-For: 1.2.3.4'` fail to change it?
6. **Are `req.secure` and `req.protocol` right**, and does the login cookie
   actually arrive?
7. **Are the exceptional paths enumerated** — health checks, internal calls,
   webhooks — and does the chosen value hold for each?

## Gotchas

**Symptom:** `secure` cookies are never set in production, with no error
**Cause:** `req.secure` is false because TLS terminated at the proxy and trust is
off
**Fix:** Set `trust proxy` so `X-Forwarded-Proto` is believed; check
`express-session`'s `proxy` option if it persists

**Symptom:** Redirects send users to `http://` from an `https://` site
**Cause:** An absolute URL built from `req.protocol`
**Fix:** `trust proxy`, and prefer a configured public base URL for canonical
links

**Symptom:** OAuth callbacks or emailed links point at an internal hostname
**Cause:** `req.hostname` is the internal host without trust
**Fix:** Build published URLs from configuration, not from the request

**Symptom:** Everything works after adding a CDN except the client IP
**Cause:** The chain grew by one and the hop count did not
**Fix:** Re-count, or switch to trusting by proxy address

**Symptom:** Health checks appear in logs as real user traffic
**Cause:** They arrive on the internal path with no forwarding header
**Fix:** Expected — identify them by path and address rather than treating the
absence as an anomaly

**Symptom:** A staging environment behaves differently from production
**Cause:** Different numbers of proxies in front of each
**Fix:** Configuration per environment, verified per environment

## Interview questions

**★ Name something other than `req.ip` that this setting changes.**
`req.secure` and `req.protocol` — behind TLS termination they are wrong without
it, which is why `secure` cookies silently never reach the browser. Also
`req.hostname`, which becomes the internal host, and `req.ips`, which is empty.

**★ Why is the secure-cookie failure so hard to diagnose?**
Because nothing errors. The cookie layer declines to set a `secure` cookie on
what it believes is a plain-HTTP connection, so the response is a 200 with no
`Set-Cookie`. The symptom — works locally, silent in production — points at
authentication rather than at an application setting.

**★ How should absolute URLs be built behind a proxy?**
From configuration, not from the request. `req.protocol` and `req.hostname`
describe how *this* request arrived, which is a different question from what URL
the application should publish — and they diverge as soon as a second hostname
points at the same app.

**★ What breaks a hop count over time?**
Anything that changes the chain: adding a CDN, moving to a managed platform, or
any path that skips the edge — health checks, internal calls, webhooks. Trusting
by proxy address survives all of them.

**Why is `true` defensible on some managed platforms?**
Because the platform documents that its edge overwrites `X-Forwarded-For` and
that every request passes it. That is the same condition the Express docs state;
it is just being guaranteed by someone else. It does not transfer to a
self-managed deployment.

**What is the first thing to check when `req.ip` looks wrong?**
`req.ips`. Empty means trust is off, and every other symptom — protocol, secure,
hostname — follows from that one fact.

---

← Prev: [When `true` is a bypass](02-when-true-is-a-bypass.md) · Index: [trust proxy](README.md) · Next → [CORS](../02-cors.md)
