---
title: "trust proxy"
sidebar_label: "01 · trust proxy"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Without `trust proxy`, `req.ip` is the load balancer. Rate limits and secure cookies misbehave.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html) and the
> [application settings table](https://expressjs.com/en/5x/api/application/): `trust proxy`
> defaults to **`false`**, under which the client IP comes from
> `req.socket.remoteAddress`. Set to **`true`**, *"the client's IP address is understood as
> the left-most entry in the `X-Forwarded-For` header"* — and the docs attach a warning:
> ensure *"the last trusted reverse proxy removes/overwrites"* `X-Forwarded-For`,
> `X-Forwarded-Host` and `X-Forwarded-Proto`, **to prevent client spoofing**.
> A **number** means "the address `n` hops away", counted **right to left**, with
> `req.socket.remoteAddress` as the first hop. Named subnets are `loopback`
> (`127.0.0.1/8`, `::1/128`), `linklocal` (`169.254.0.0/16`, `fe80::/10`) and
> `uniquelocal` (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`). A function
> `(ip) => boolean` is also accepted.
> `req.ips` is *"an array of IP addresses specified in the `X-Forwarded-For` header"* when
> trust is enabled, and an **empty array** otherwise
> ([request reference](https://expressjs.com/en/5x/api/request/)).

```js
// one hop of reverse proxy you control
app.set('trust proxy', 1);
```

Never set `true` on an open internet edge without understanding spoofed
`X-Forwarded-For`. Nginx syllabus covers termination in depth.

## 🔴 `trust proxy: true` makes `req.ip` client-controlled

This is the most consequential sentence in the phase, and it is rarely connected to
its downstream effect.

`X-Forwarded-For` is an ordinary request header. **Anyone can send one.** With
`trust proxy: true`, Express takes the **left-most** entry as the client IP — and
the left-most entry is whatever the client put there, unless a trusted proxy
overwrote it.

```http
GET /api/login HTTP/1.1
X-Forwarded-For: 1.2.3.4
```

With `true` and no proxy sanitising the header, `req.ip` is `1.2.3.4`. Change it
per request and you have a **new identity every time** — which means:

| Control keyed on `req.ip` | What the bypass does |
|---|---|
| **Rate limiting** | Unlimited requests: every attempt looks like a different client |
| **Brute-force protection on `/login`** | Removed entirely — the counter never accumulates |
| IP allow-lists | Trivially satisfied by claiming an allowed address |
| Audit logs | Filled with attacker-chosen addresses |

The failure is worse than having no rate limiter, because the dashboard shows the
limiter working. Nothing errors; the counts are simply spread across fabricated
addresses.

**The rule:** `trust proxy: true` is only safe when a proxy you control is
guaranteed to overwrite `X-Forwarded-For` — which is exactly what the Express docs
say. If a request can reach Node without passing that proxy, `true` is a
vulnerability.

## Choose the narrowest value that describes your topology

```js
app.set('trust proxy', false);                      // no proxy — the default
app.set('trust proxy', 1);                          // exactly one proxy you control
app.set('trust proxy', 'loopback');                 // proxy on the same host
app.set('trust proxy', ['loopback', '10.0.0.0/8']); // known internal proxies
app.set('trust proxy', true);                       // ⚠️ only with a sanitising edge
```

**Prefer the hop count or the subnet list.** They describe reality, and they degrade
safely: a spoofed header from an untrusted source is ignored rather than believed.

The number is counted **right to left**, so `1` means "the entry immediately left of
the connection I actually received" — one proxy. Two proxies (a CDN in front of a
load balancer) is `2`. Getting the count wrong in either direction is a bug: too
high trusts attacker-supplied entries, too low gives you the proxy's address again.

**And the count must be consistent.** If some traffic arrives through the CDN and
some directly, no single number is correct — which is what the docs mean by
"ensure consistent path lengths to the app".

## What it changes besides `req.ip`

`trust proxy` is not only about addresses. It is what makes Express believe the
`X-Forwarded-*` family at all:

| Property | Without trust | With trust |
|---|---|---|
| `req.ip` | The proxy's address | Client per `X-Forwarded-For` |
| `req.ips` | **`[]`** | The full chain from the header |
| `req.protocol` | `'http'` — the proxy's hop | `'https'` per `X-Forwarded-Proto` |
| `req.secure` | **`false`** behind TLS termination | `true` |
| `req.hostname` | The internal host | Per `X-Forwarded-Host` |

`req.secure` is the one that produces the confusing bug: a `secure: true` cookie is
never sent to the browser because Express thinks the connection is plain HTTP
([Phase 8](../phase-8-validation-authz/05-cookies-sessions-wireup.md)). The
symptom — "login works locally, does nothing in production" — points nowhere near
this setting.

## Trade-off

Enabling trust gets you the real client IP, working `secure` cookies, and correct
redirect protocols behind a load balancer. Every production deployment behind a
proxy needs it, so the question is never *whether* but *how tightly*.

The tightness is the trade. `true` is one line and works in every topology,
including the ones where it is a vulnerability. A hop count or subnet list requires
knowing your infrastructure and must be revisited when a CDN is added — friction
that is doing its job, because that CDN also changes the header chain.

**Encode the topology, not the convenience.** And if you inherit `trust proxy: true`,
verifying that the edge overwrites `X-Forwarded-For` is a five-minute check with a
`curl -H 'X-Forwarded-For: 1.2.3.4'` against a staging endpoint that echoes `req.ip`.

## Gotchas

**Symptom:** Rate limiting never triggers, or triggers for the wrong people  
**Cause:** With trust off every request shares the proxy's IP; with `true` and an
unsanitised edge, the attacker picks a fresh IP per request  
**Fix:** A hop count or subnet list matching the real topology — and verify the edge
overwrites the header

**Symptom:** `secure` cookies are never set in production  
**Cause:** `req.secure` is false because TLS terminated at the proxy and trust is off  
**Fix:** Set `trust proxy` so `X-Forwarded-Proto` is believed

**Symptom:** Every log line shows one IP — the load balancer's  
**Cause:** Trust off  
**Fix:** Same setting; and log `req.ips` when a chain matters

**Symptom:** `req.ips` is always empty  
**Cause:** Documented behaviour when trust does not evaluate to true  
**Fix:** Nothing to fix — it is the tell that trust is off

**Symptom:** Redirects send users to `http://` from an `https://` site  
**Cause:** `req.protocol` is the proxy's hop  
**Fix:** `trust proxy`, or build absolute URLs from configured public base URL

**Symptom:** The hop count works for some requests and not others  
**Cause:** Mixed paths — some traffic through the CDN, some direct  
**Fix:** Make the path uniform, or trust by proxy address rather than by count

## Interview questions

**★ Why does rate limiting ban everyone as one IP?**  
All traffic appears as the proxy when trust is off.

**★ How does `trust proxy: true` turn into a rate-limit bypass?**  
`X-Forwarded-For` is a client-supplied header, and `true` makes Express believe its
left-most entry. Unless a trusted proxy overwrites it, an attacker sends a different
value per request, gets a different `req.ip` each time, and the limiter counts each
as a new client. The limiter appears to work — nothing errors.

**★ When is `true` actually safe?**  
Only when every request necessarily passes a proxy you control that overwrites
`X-Forwarded-For` — which is precisely the condition the Express docs attach to it. If
Node is reachable directly, it is a vulnerability.

**What does the number value mean, and which direction is it counted?**  
The address `n` hops away, counted **right to left**, with the socket address as the
first hop. One proxy is `1`; a CDN in front of a load balancer is `2`. It requires a
consistent path length for every request.

**Name something other than `req.ip` that this setting changes.**  
`req.secure` and `req.protocol` — behind TLS termination they are wrong without it,
which is why `secure` cookies silently never reach the browser. Also `req.ips` (empty
when trust is off) and `req.hostname`.


---

← Index: [Phase 9](README.md) · Next → [CORS](02-cors.md)
