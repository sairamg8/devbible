---
title: "When `true` is a bypass"
sidebar_label: "02 · When `true` is a bypass"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**`trust proxy: true` makes `req.ip` client-controlled. Every control keyed on it
— rate limits, brute-force counters, allow-lists, audit logs — becomes
attacker-selectable, and the dashboard keeps showing green.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block.** With `true`, *"the client's IP address is understood as the
> left-most entry in the `X-Forwarded-For` header"*, and the
> [behind proxies guide](https://expressjs.com/en/guide/behind-proxies.html)
> attaches the condition directly: ensure *"the last trusted reverse proxy
> removes/overwrites"* `X-Forwarded-For`, `X-Forwarded-Host` and
> `X-Forwarded-Proto`, **"to prevent client spoofing"**. `X-Forwarded-For` is an
> ordinary request header carried on `req.headers` like any other
> ([request reference](https://expressjs.com/en/5x/api/request/)); Express applies
> no authentication to it. **The attack framing, the keying guidance and the
> verification recipe are this bible's.**

## The mechanism, in three lines

`X-Forwarded-For` is an ordinary request header. **Anyone can send one.** With
`trust proxy: true`, Express takes the **left-most** entry as the client IP — and
the left-most entry is whatever the client put there, unless a trusted proxy
overwrote it.

```http
POST /api/login HTTP/1.1
X-Forwarded-For: 1.2.3.4
```

With `true` and no proxy sanitising the header, `req.ip` is `1.2.3.4`. Change it
per request and you have **a new identity every time**.

## What that buys an attacker

| Control keyed on `req.ip` | What the bypass does |
|---|---|
| **Rate limiting** | Unlimited requests — every attempt looks like a different client |
| **Brute-force protection on `/login`** | Removed entirely; the counter never accumulates |
| IP allow-lists | Trivially satisfied by claiming an allowed address |
| Geo or country rules | Selectable by picking an address |
| Audit logs and incident response | Filled with attacker-chosen addresses |
| Fraud and abuse scoring | Poisoned with fabricated distinct clients |

🔴 **This is worse than having no rate limiter at all.** Nothing errors. The
limiter's own metrics look healthy — requests are being counted, buckets are being
created, the block rate is low — because the counts are spread across thousands of
fabricated addresses. A missing limiter is visible in a design review; a bypassed
one is invisible until someone tries it
([Phase 9 · 04](../04-rate-limiting.md)).

⚠️ **The audit-log consequence outlives the incident.** After a breach, the
question is "where did this come from?", and the answer is a log full of addresses
the attacker chose. Nothing in the log says the values were untrusted.

## The rule, stated exactly

> **`trust proxy: true` is only safe when every request necessarily passes a
> proxy you control that overwrites `X-Forwarded-For`.**

That is precisely the condition the Express documentation attaches to it. Two
failure modes make it false in practice, and both are common:

**1 · Node is reachable directly.** A container port published on the host, a
security group that allows the app port from anywhere, a service mesh sidecar
bypass, a debugging tunnel left open. If a request can reach Node without passing
the edge, `true` is a vulnerability regardless of what the edge does.

**2 · The edge appends rather than overwrites.** Many proxies **append** to
`X-Forwarded-For` by default — which is the correct behaviour for a chain, and
means a client-supplied value ends up on the **left**, exactly where `true` reads
it. Appending is not sanitising. The edge must be configured to *replace* the
header with the connecting address, and that is a per-proxy configuration
question, not something Express can do for you.

## Verifying it, in five minutes

The check is cheap enough that there is no excuse for inheriting `true` without
running it. Expose a staging endpoint that echoes `req.ip`, then ask it a question
from outside the edge:

```bash
curl -s -H 'X-Forwarded-For: 1.2.3.4' https://staging.example.com/__whoami
```

- Response shows **your real address** → the edge overwrites. `true` is behaving.
- Response shows **`1.2.3.4`** → the header is believed as sent. `true` is a
  bypass, today.

Then repeat it **against the app's own address**, skipping the edge, if that is
reachable at all — because reaching Node directly is the failure mode the first
test cannot see. If the direct attempt connects, the topology, not the setting, is
the thing to fix.

⚠️ **Remove the echo endpoint, or authenticate it.** A public endpoint that
reflects header-derived values is a small information leak and an easy way to
confuse a later audit.

## Do not key security controls on the address alone

Even with `trust proxy` set correctly, an IP is a weak identity: mobile networks
and corporate NATs put thousands of users behind one address, and a determined
attacker rotates through many. The address is **one signal**, not the identity.

| Control | Key on |
|---|---|
| Login brute force | **the account** (plus the IP as a secondary limit) |
| Authenticated API limits | **the user or API key** — an authenticated identity is stronger than any address |
| Anonymous endpoint limits | IP, accepting that NAT over-blocks and rotation under-blocks |
| Expensive unauthenticated work | IP **plus** a proof-of-work or a challenge, because IP alone cannot carry it |

🔴 **Rate limiting a login route by IP alone protects nobody**: an attacker
spreads attempts across addresses, and a NAT'd office shares one bucket. Limit
**per account** so an attack on one user's password cannot be spread out, and keep
the IP limit as a second, coarser layer
([Phase 9 · 04](../04-rate-limiting.md)).

## The order it must run in

The limiter must see the corrected address, which means `trust proxy` — an
application setting, applied before any request is handled — is already in effect
by the time any middleware runs. What *does* depend on ordering is everything that
reads `req.ip`:

```js
app.set('trust proxy', config.trustProxy);   // 1 · a setting, not middleware
app.use(requestId);
app.use(logger);                             // 2 · logs the corrected req.ip
app.use(rateLimit);                          // 3 · counts the corrected req.ip
```

⚠️ **A limiter mounted in a sub-app or a separately-created `express()` instance
does not inherit the setting.** Settings live on the app they were set on; a
mounted sub-app has its own. If a limiter sits inside a sub-app, set `trust proxy`
there too, or mount the limiter on the parent
([Phase 0 · 02](../../phase-0-express-basics/02-app-router-server/README.md)).

## Gotchas

**Symptom:** Rate limiting never triggers, and the metrics look healthy
**Cause:** `trust proxy: true` with an edge that does not overwrite
`X-Forwarded-For` — every request is a new "client"
**Fix:** A hop count or subnet list matching the real topology, and verify the
edge overwrites the header

**Symptom:** Rate limiting bans everyone at once
**Cause:** Trust is off, so every request shares the proxy's address
**Fix:** The same setting, in the other direction

**Symptom:** The edge is configured correctly and the bypass still works
**Cause:** Node is reachable without passing the edge
**Fix:** Fix the topology — the setting cannot compensate for a reachable origin

**Symptom:** The proxy "already sets `X-Forwarded-For`", and spoofing still works
**Cause:** It **appends**; a client-supplied value stays left-most, where `true`
reads it
**Fix:** Configure the edge to replace the header with the connecting address

**Symptom:** Incident response cannot tell where requests came from
**Cause:** Audit logs recorded attacker-chosen addresses as fact
**Fix:** Correct the setting, and log `req.ips` so the chain is visible rather
than a single derived value

**Symptom:** A login endpoint is rate limited and still brute-forced
**Cause:** The limit is per IP, and attempts are spread across addresses
**Fix:** Limit per account first; keep the IP limit as a coarser second layer

**Symptom:** A limiter inside a mounted sub-app sees the proxy's address
**Cause:** `trust proxy` was set on the parent app only
**Fix:** Set it on the sub-app too, or mount the limiter on the parent

## Interview questions

**★ How does `trust proxy: true` turn into a rate-limit bypass?**
`X-Forwarded-For` is a client-supplied header, and `true` makes Express believe
its left-most entry. Unless a trusted proxy overwrites it, an attacker sends a
different value per request, gets a different `req.ip` each time, and the limiter
counts each as a new client. Nothing errors — the limiter appears to work.

**★ When is `true` actually safe?**
Only when every request necessarily passes a proxy you control that **overwrites**
`X-Forwarded-For` — the exact condition the Express docs attach to it. If Node is
reachable directly, or the edge merely appends, it is a vulnerability.

**★ Why is a bypassed limiter worse than no limiter?**
Because it is invisible. A missing limiter is caught in design review; a bypassed
one produces healthy-looking metrics — buckets created, low block rate — while the
counts are spread over fabricated addresses.

**★ How would you verify a production setting in five minutes?**
Send `curl -H 'X-Forwarded-For: 1.2.3.4'` at a staging endpoint that echoes
`req.ip`. Seeing your real address means the edge overwrites; seeing `1.2.3.4`
means it does not. Then try to reach the app directly, because a reachable origin
defeats the setting no matter how the edge is configured.

**Should a login endpoint be rate limited by IP?**
Not by IP alone. Limit per account so attempts against one password cannot be
spread across addresses, and keep an IP limit as a coarser second layer —
remembering that NAT puts many users on one address.

**Does `trust proxy` apply to a mounted sub-app?**
No. Settings belong to the app they were set on, so a sub-app has its own. A rate
limiter mounted inside one will see the proxy's address unless the setting is
repeated there.

---

← Prev: [The setting and the header](01-the-setting-and-the-header.md) · Index: [trust proxy](README.md) · Next → [What else it changes](03-what-else-it-changes.md)
