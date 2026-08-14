---
title: "The twelve getters"
sidebar_label: "02 · The twelve getters"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Six of the twelve read `trust proxy` before answering. Get that setting wrong
and `req.ip`, `req.protocol`, `req.secure` and `req.hostname` all become
client-controlled — quietly, and all at once.**

> Verified: 2026-08-14. Every getter below is read from `express@5.2.1`'s
> `lib/request.js` in `sandbox/express-verify/node_modules/`, by name. **Reading
> source is not a run: nothing was executed for this page and it carries no
> console block.** Cross-checked against the
> [request reference](https://expressjs.com/en/5x/api/request.html), which states
> that `req.ip` is *"derived from the left-most entry in the `X-Forwarded-For`
> header"* whenever `trust proxy` does not evaluate to false, and that `req.ips`
> is otherwise *"an empty array"*. `req.fresh`'s conditions cite
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §13 on conditional
> requests.

## The twelve, and what each one reads

| Getter | Computed from | Reads `trust proxy`? |
|---|---|---|
| `query` | `req.url`'s query string, via the configured parser | no |
| `path` | `parseurl(req).pathname` — the **rewritten** `req.url` | no |
| `protocol` | `socket.encrypted`, then `X-Forwarded-Proto` | ✅ |
| `secure` | `protocol === 'https'` | ✅ (via `protocol`) |
| `ip` | `proxy-addr(req, trustFn)` | ✅ |
| `ips` | `proxy-addr.all(req, trustFn)`, reversed, socket address removed | ✅ |
| `host` | `X-Forwarded-Host` if trusted, else `Host` | ✅ |
| `hostname` | `host` with the port stripped (IPv6-literal aware) | ✅ (via `host`) |
| `subdomains` | `hostname` split by `subdomain offset` | ✅ (via `hostname`) |
| `fresh` | method, status, `ETag`/`Last-Modified` vs the request's validators | no |
| `stale` | `!fresh` | no |
| `xhr` | `X-Requested-With` equals `xmlhttprequest`, case-insensitively | no |

🔴 **Six of them depend on `trust proxy`**, and they fail *together*. That is why
`trust proxy` is the single highest-consequence Express setting and gets its own
Master topic ([Phase 9 · 01](../../phase-9-hardening/01-trust-proxy/README.md)).

## `protocol` and `secure`

```js
// express/lib/request.js
var proto = this.socket.encrypted ? 'https' : 'http';
var trust = this.app.get('trust proxy fn');

if (!trust(this.socket.remoteAddress, 0)) return proto;

var header = this.get('X-Forwarded-Proto') || proto
var index = header.indexOf(',')
return index !== -1 ? header.substring(0, index).trim() : header.trim()
```

Read it for the failure it explains: **with TLS terminated at a proxy and
`trust proxy` unset, `req.protocol` is `'http'` and `req.secure` is `false`.**
Which means:

- `res.cookie(..., {secure: true})` sets a cookie the browser will send only over
  HTTPS — and Express thinks the connection is HTTP, so a redirect-to-HTTPS guard
  built on `req.secure` loops forever.
- The classic symptom is **"the session cookie disappears in production and works
  locally"**, because locally there is no proxy and `socket.encrypted` is honest.

Note also that it takes the **first** comma-separated value, and the source
comments that `X-Forwarded-Proto` *"is normally only ever a single value, but this
is to be safe"*. First value = closest to the client = the one an attacker sets
if the proxy does not overwrite it.

## `ip` and `ips`

```js
defineGetter(req, 'ip',  function () { return proxyaddr(this, this.app.get('trust proxy fn')); });
defineGetter(req, 'ips', function () {
  var addrs = proxyaddr.all(this, this.app.get('trust proxy fn'));
  addrs.reverse().pop()            // farthest → closest, socket address dropped
  return addrs
});
```

- **`req.ip` with `trust proxy` off** is the socket address — i.e. your load
  balancer, identically, for every client. A rate limiter keyed on it gives every
  user one shared bucket, so one noisy client locks out everyone.
- **`req.ip` with `trust proxy: true`** is the left-most `X-Forwarded-For` entry,
  which is an ordinary request header. **A client can set it to anything.** A rate
  limiter now counts fabricated addresses and *appears* to work.
- **`req.ips` is `[]` when trust is off** — documented — so code branching on
  `req.ips.length` silently takes the wrong path.

The two mirror failures are the point: trust off behind a proxy is a shared
bucket; `trust: true` unsanitised is no limit at all. **Verify with a forged
header, not by reading the config.**

## `host`, `hostname`, `subdomains`

`host` prefers `X-Forwarded-Host` when the socket peer is trusted, falls back to
`Host`, and takes the first comma-separated value. `hostname` strips the port,
with an IPv6-literal branch that skips to after the `]`.

Both are **request headers**, so both are attacker-controlled unless a trusted
proxy overwrites them. Anything built on `req.hostname` — multi-tenant routing by
subdomain, absolute URLs in emails, password-reset links — is a host-header
injection surface. Validate the hostname against an allow-list before using it to
construct a link someone will click.

`subdomains` splits `hostname` and drops the last `subdomain offset` labels
(default **2**). For `api.eu.example.com` that gives `['eu', 'api']` — **reversed**,
which surprises people. It is wrong for any two-part public suffix
(`example.co.uk`) unless you adjust the offset.

## `fresh` and `stale`

```js
if ('GET' !== method && 'HEAD' !== method) return false;

if ((status >= 200 && status < 300) || 304 === status) {
  return fresh(this.headers, {
    'etag': res.get('ETag'),
    'last-modified': res.get('Last-Modified')
  })
}
return false;
```

Three conditions, and the first two are the interesting ones:

- 🔴 **`req.fresh` is always `false` for POST, PUT, PATCH and DELETE.** It only
  ever evaluates `If-None-Match` / `If-Modified-Since`, which are the *read*
  validators. **Express does not evaluate `If-Match` at all** — the write-side
  precondition is entirely your handler's job, and this is the mechanism behind
  the corrected claim on
  [Phase 6 · 07](../../phase-6-rest-surface/07-etag-and-cache.md).
- **It reads the response's `ETag`/`Last-Modified`**, so it is only meaningful
  *after* you have set them. Checking `req.fresh` at the top of a handler, before
  the ETag exists, always says stale.
- Status outside 2xx/304 is `false`, so an error response is never "fresh".

## `xhr`

`req.get('X-Requested-With')?.toLowerCase() === 'xmlhttprequest'`. It is a
convention from the jQuery era, `fetch` does not set it, and it is trivially
forgeable. **Never branch security on it.** For content negotiation use
`req.accepts`; for CSRF defence use an `Origin` check and a token
([Phase 9 · 05](../../phase-9-hardening/05-csrf-and-injection.md)).

## Gotchas

**Symptom:** `secure: true` cookies never reach the browser in production, and
everything works locally
**Cause:** TLS is terminated at a proxy, `trust proxy` is unset, so
`socket.encrypted` is false and `req.protocol` is `'http'`
**Fix:** Set `trust proxy` to the hop count or the proxy's subnet —
[Phase 9 · 01](../../phase-9-hardening/01-trust-proxy/README.md)

**Symptom:** A redirect-to-HTTPS guard loops forever behind a load balancer
**Cause:** Same root cause — `req.secure` is `false` on an already-HTTPS request
**Fix:** Same fix. Do not special-case the loop; fix the setting

**Symptom:** The rate limiter blocks everyone at once, or never blocks anyone
**Cause:** Trust off behind a proxy gives every client the same `req.ip`; trust
`true` lets a client choose its own via `X-Forwarded-For`
**Fix:** Hop count or subnet list, and **verify with a forged header** rather than
by reading the config

**Symptom:** `req.subdomains` is backwards, or wrong for a `.co.uk` domain
**Cause:** It is reversed by design, and `subdomain offset` defaults to 2
**Fix:** Adjust `subdomain offset`, or parse the hostname with a public-suffix
list if you need correctness across TLDs

**Symptom:** `req.fresh` is always `false` on a PUT
**Cause:** The getter returns early for any method that is not GET or HEAD
**Fix:** Expected. Write-side preconditions (`If-Match`) are yours to evaluate —
Express never does

**Symptom:** A password-reset link points at an attacker's domain
**Cause:** The link was built from `req.hostname`, which comes from the `Host`
header and is attacker-controlled
**Fix:** Build absolute URLs from configuration, or validate the host against an
allow-list first

## Interview questions

**★ Which `req` properties depend on `trust proxy`?**
Six: `ip`, `ips`, `protocol`, `secure`, `host` and `hostname` — plus `subdomains`
downstream of `hostname`. They fail together, which is why one misconfigured
setting breaks rate limiting, secure cookies and HTTPS redirects simultaneously.

**★ Why do `secure` cookies vanish in production but work locally?**
Because TLS terminates at the proxy. Without `trust proxy`, `socket.encrypted` is
false, so `req.protocol` is `'http'` and `req.secure` is `false` — and anything
gated on that behaves as if the connection were insecure.

**★ What is `req.ip` when `trust proxy` is `true`, and why is that dangerous?**
The left-most `X-Forwarded-For` entry, which is an ordinary request header the
client can set. Rate limiting, brute-force protection and IP allow-lists all
collapse — and the limiter still *looks* like it is working, because it is
counting fabricated addresses.

**★ Why is `req.fresh` always false on a POST?**
The getter returns early unless the method is GET or HEAD. It evaluates only the
read-side validators, `If-None-Match` and `If-Modified-Since`. Express never
evaluates `If-Match`, so write-side preconditions are the handler's job.

**Are Express's request getters cached?**
No — all twelve are recomputed on access. `req.query` re-parses and returns a new
object each time; `req.ip` re-runs the proxy resolution. Destructure once in hot
paths.

**Is `req.xhr` safe to branch on?**
Not for anything security-relevant. It only checks
`X-Requested-With: XMLHttpRequest`, which `fetch` does not send and any client can
forge. Use `req.accepts` for negotiation and a token plus an `Origin` check for
CSRF.

---

← Prev: [Two objects in one](01-two-objects-in-one.md) · Index: [req anatomy](README.md) · Next → [Reading headers and content](03-reading-headers-and-content.md)
