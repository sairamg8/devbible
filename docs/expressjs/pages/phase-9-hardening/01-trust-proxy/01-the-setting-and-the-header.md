---
title: "The setting and the header"
sidebar_label: "01 · The setting and the header"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`trust proxy` is one application setting that decides whether Express believes
a family of client-supplied headers. Its value should describe your topology —
not your convenience.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block.**
> [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html) and
> the [application settings table](https://expressjs.com/en/5x/api/application/):
> `trust proxy` defaults to **`false`**, under which the client IP comes from
> `req.socket.remoteAddress`. Set to **`true`**, *"the client's IP address is
> understood as the left-most entry in the `X-Forwarded-For` header"* — with the
> documented warning to ensure *"the last trusted reverse proxy removes/overwrites"*
> `X-Forwarded-For`, `X-Forwarded-Host` and `X-Forwarded-Proto`, **to prevent
> client spoofing**. A **number** trusts the *n*th hop from the front-facing proxy
> as the client, counted **right to left** with `req.socket.remoteAddress` as the
> first hop. Named subnets are `loopback` (`127.0.0.1/8`, `::1/128`), `linklocal`
> (`169.254.0.0/16`, `fe80::/10`) and `uniquelocal` (`10.0.0.0/8`,
> `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`); a function `(ip) => boolean` is
> also accepted. `req.ips` is *"an array of IP addresses specified in the
> `X-Forwarded-For` header"* when trust is enabled, and an **empty array**
> otherwise ([request reference](https://expressjs.com/en/5x/api/request/)).
> **The topology guidance is this bible's.**

## What the setting actually decides

Behind a reverse proxy, the TCP connection Node accepts comes **from the proxy**.
Everything Node knows from the socket describes the proxy: its address, and the
fact that its hop to Node was probably plain HTTP. The client's real details
survive only as headers the proxy added:

```http
GET /orders HTTP/1.1
Host: internal-app:3000
X-Forwarded-For: 203.0.113.7
X-Forwarded-Proto: https
X-Forwarded-Host: api.example.com
```

`trust proxy` is the one switch that decides **whether Express believes those
headers**. It is not a security feature that filters anything; it is a statement
of trust, and the whole page turns on the fact that headers are client-supplied
until something guarantees otherwise
([chunk 02](02-when-true-is-a-bypass.md)).

```js
// one hop of reverse proxy you control
app.set('trust proxy', 1);
```

## The values, from narrowest to widest

```js
app.set('trust proxy', false);                      // no proxy — the default
app.set('trust proxy', 'loopback');                 // proxy on the same host
app.set('trust proxy', 1);                          // exactly one proxy you control
app.set('trust proxy', ['loopback', '10.0.0.0/8']); // known internal proxies
app.set('trust proxy', (ip) => ip === '10.0.0.5');  // custom, rarely needed
app.set('trust proxy', true);                       // ⚠️ only with a sanitising edge
```

| Value | Means | Use when |
|---|---|---|
| `false` | trust nothing; `req.ip` is the socket peer | no proxy at all — local dev, a directly-exposed Node |
| `'loopback'` | trust `127.0.0.1/8`, `::1/128` | the proxy runs on the same host |
| `n` (number) | trust *n* hops back from the socket | a fixed, known number of proxies you control |
| address / CIDR list | trust these specific sources | proxies with stable addresses or a known internal range |
| function | your own predicate | nothing else expresses the topology |
| `true` | trust every hop; take the left-most `X-Forwarded-For` entry | **only** when a proxy you control overwrites the header |

**Prefer the hop count or the subnet list.** They describe reality, and they
degrade safely: a spoofed header from an untrusted source is ignored rather than
believed.

## The number, and which direction it counts

The number is counted **right to left**, with the socket address as the first
hop — so it answers "how many proxies of mine sit between the client and Node?"

```
client ──▶ CDN ──▶ load balancer ──▶ Node
                                     socket peer = LB
X-Forwarded-For: 203.0.113.7, 198.51.100.9
                 └ client        └ CDN's view

trust proxy: 2      →  req.ip = 203.0.113.7    ✅
trust proxy: 1      →  req.ip = 198.51.100.9   ⛔ the CDN, not the client
trust proxy: 3      →  req.ip = whatever the client wrote  ⛔
```

🔴 **Getting the count wrong is a bug in both directions.** Too low and `req.ip`
is one of your own proxies — every client shares an identity. Too high and you
have stepped past the entries your infrastructure wrote into the ones the *client*
supplied, which is the bypass in [chunk 02](02-when-true-is-a-bypass.md).

**And the count must be consistent.** If some traffic arrives through the CDN and
some directly — a health check, an internal service, a webhook allowed to skip the
edge — then **no single number is correct**, and the value that is right for the
common path is wrong for the other. That is what the documentation means by
ensuring consistent path lengths to the app. When paths genuinely differ, trust by
**proxy address** rather than by count: an address list is true regardless of how
many hops a particular request took.

## The header is a list, and `req.ips` is how you read it

`X-Forwarded-For` accumulates: each proxy appends the address it received the
connection from, so the header reads left to right as **client, then each proxy in
order**.

| | With trust enabled | Without |
|---|---|---|
| `req.ip` | the client per the trusted portion of the chain | the socket peer — your proxy |
| `req.ips` | the addresses from `X-Forwarded-For` | **`[]`** |

An empty `req.ips` in an environment that definitely has a proxy is therefore a
**diagnostic**: it says trust is off, before you go looking anywhere else.

⚠️ **`trust proxy` reads `X-Forwarded-*`.** The standardized `Forwarded` header
(RFC 7239, `Forwarded: for=…;proto=…`) is a different header with a different
syntax, and it is not what this setting parses — if your edge emits only
`Forwarded`, Express sees no forwarding information at all. Configure the edge to
emit `X-Forwarded-For`, or read and validate `Forwarded` yourself.

## Where the setting belongs

In the app factory, next to the other environment-dependent settings, and driven
by configuration rather than hard-coded:

```js
// ✅ topology is deployment-specific, so it comes from config
export function createApp({config}) {
  const app = express();
  app.set('trust proxy', config.trustProxy);   // 1 in prod, false in tests
  …
}
```

Two reasons this matters more than it looks
([Phase 10 · 01](../../phase-10-app-factory/01-create-app/README.md)):

- **Tests should run with `false`.** A test suite that sets `true` will happily
  accept `X-Forwarded-For` from a request builder, which hides exactly the
  misconfiguration you want a test to catch.
- **The value differs per environment**, and a hard-coded `1` becomes wrong the
  day a CDN is added — silently, because nothing errors.

## Gotchas

**Symptom:** Every log line shows one IP — the load balancer's
**Cause:** Trust is off, so `req.ip` is the socket peer
**Fix:** Set `trust proxy` to match the topology; log `req.ips` when the chain
matters

**Symptom:** `req.ips` is always empty
**Cause:** Documented behaviour when trust does not evaluate to true
**Fix:** Nothing to fix — it is the tell that trust is off

**Symptom:** `req.ip` is the CDN's address rather than the client's
**Cause:** The hop count is one too low for a two-proxy path
**Fix:** Count the proxies between client and Node — CDN plus load balancer is `2`

**Symptom:** The hop count works for some requests and not others
**Cause:** Mixed paths — some traffic through the CDN, some direct
**Fix:** Make the path uniform, or trust by proxy address rather than by count

**Symptom:** No forwarding information at all despite a proxy being present
**Cause:** The edge emits only the RFC 7239 `Forwarded` header, which `trust
proxy` does not parse
**Fix:** Emit `X-Forwarded-For` at the edge, or parse `Forwarded` yourself

**Symptom:** A staging fix for `req.ip` does nothing in production
**Cause:** The setting is hard-coded rather than configured per environment
**Fix:** Drive it from config in the app factory

## Interview questions

**★ What does `trust proxy` actually do?**
It decides whether Express believes the `X-Forwarded-*` headers. Behind a proxy
the socket describes the proxy, so the client's address, protocol and host
survive only as headers — and those headers are client-supplied unless a proxy
overwrites them. The setting is a statement of trust, not a filter.

**★ Which direction is the number counted, and what does it mean?**
Right to left, with the socket peer as the first hop: it says how many proxies of
yours sit between the client and Node. A CDN in front of a load balancer is `2`.
Too low and `req.ip` is your own proxy; too high and you have stepped into
entries the client wrote.

**★ Why prefer a hop count or subnet list over `true`?**
Because they describe the real topology and degrade safely — a forged header from
an untrusted source is ignored rather than believed. `true` works in every
topology, including the ones where it is a vulnerability.

**★ What does an empty `req.ips` tell you?**
That trust is off. It is documented behaviour rather than a bug, and it is the
fastest diagnostic when `req.ip` looks wrong.

**Why must the number of hops be consistent for every request?**
Because one number cannot describe two path lengths. If some traffic skips the
CDN — health checks, internal callers, webhooks — the value that is right for the
main path is wrong for the other. Trust by proxy address instead.

**Does `trust proxy` understand the `Forwarded` header from RFC 7239?**
No — it is defined over `X-Forwarded-*`. An edge that emits only `Forwarded`
leaves Express with no forwarding information, and the fix is at the edge or in
your own parsing code.

---

Index: [trust proxy](README.md) · Next → [When `true` is a bypass](02-when-true-is-a-bypass.md)
