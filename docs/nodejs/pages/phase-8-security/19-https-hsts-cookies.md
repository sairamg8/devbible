---
title: "HTTPS, HSTS and cookie flags"
sidebar_label: "19 · HTTPS, HSTS, cookies"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**, OpenSSL 3.5.7 — every output below is from
> `sandbox/p8-security/ex18-https-cookies.mjs`.

Three controls that only work together. TLS encrypts the connection; **HSTS stops the
downgrade that skips TLS entirely**; the cookie flags decide what is still true if either
of the first two fails. [Phase 5, page 09](../phase-5-http-processes/09-https-and-tls.md)
covers the mechanics of running a TLS server — this page is what to set and why.

## Node's TLS defaults are already sensible

```console
tls.DEFAULT_MIN_VERSION -> TLSv1.2
tls.DEFAULT_MAX_VERSION -> TLSv1.3
default ciphers         -> TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:… 
tls.rootCertificates    -> 120 certificates bundled
```

TLS 1.0 and 1.1 are already off. Hand-tuning `ciphers` is how people accidentally make
this worse; the defaults track OpenSSL, and the honest reason to touch `minVersion` is to
raise it to `TLSv1.3`, not to lower it for an old client.

**The handshake is the cost, not the encryption:**

```console
TLSv1.2 -> 135.0 ms / 20 = 6.75 ms per connection
TLSv1.3 -> 111.5 ms / 20 = 5.58 ms per connection
resumed -> 76.3 ms / 20 = 3.82 ms per connection
```

One round trip saved by TLS 1.3, and a third off again by resumption. Bulk encryption
after that is hardware-accelerated and does not show up. This is why keep-alive matters
more for TLS than for plaintext ([phase 5, page 07](../phase-5-http-processes/07-keep-alive-and-agents.md)).

**Resumption has a trap on TLS 1.3.** The ticket arrives *after* the handshake, so
`getSession()` inside the connect callback gives you something that looks like a session
and does not resume:

```console
getSession() in the callback -> 889 bytes  -> reused: false
ticket from the 'session' event -> 1229 bytes -> reused: true
```

Listen for `'session'` and cache that. Silent non-resumption is the kind of bug that
shows up as a latency regression nobody can explain.

## HSTS: the header that closes the first request

TLS does nothing about a user typing `example.com`. That first request goes out in
plaintext and is redirected — and the redirect is exactly what an attacker on the network
rewrites. HSTS makes the browser refuse to try:

```console
max-age=0                                      removes the pin — the only way back
max-age=31536000                               one year, this host only
max-age=31536000; includeSubDomains            every subdomain, including forgotten ones
max-age=31536000; includeSubDomains; preload   baked into browsers; removal takes months
```

Node sends none of it. A default `node:http` response carries four headers, and no
security header of any kind:

```console
{"connection":"keep-alive","date":"…","keep-alive":"timeout=5","transfer-encoding":"chunked"}
Strict-Transport-Security -> null
```

**HSTS on a plaintext response is ignored**, by specification — a header delivered over
the channel it is meant to protect could have been added by the attacker. So the plain
HTTP listener's only job is the redirect, and the header does its work on the HTTPS side:

```js
// port 80: redirect only
http.createServer((req, res) => {
  res.writeHead(301, { location: `https://${req.headers.host}${req.url}` }).end();
});
```

Two directives deserve a decision rather than a copy-paste.
**`includeSubDomains`** covers every subdomain, including the internal tool on
`legacy.example.com` that has no certificate — it will become unreachable, not
plaintext-reachable. **`preload`** ships your domain inside browser binaries; removal
takes months of release cycles. Start at `max-age=300`, confirm nothing broke, then raise
it.

## Behind a proxy, `req.socket.encrypted` is the truth and the header is not

In production TLS usually terminates at a load balancer, so Node sees plaintext and has to
be told. The mechanism everyone uses is forgeable:

```console
direct TLS        -> {"encrypted":true,"protocol":"TLSv1.3","xForwardedProto":null}
client-set header -> {"encrypted":true,"protocol":"TLSv1.3","xForwardedProto":"https"}
```

The client set `X-Forwarded-Proto: https` itself. On a plaintext hop, any caller can, and
a naive `if (req.headers['x-forwarded-proto'] !== 'https') redirect()` is then trivially
bypassed — along with any "we're secure, set the cookie" logic hanging off it.

The header is only meaningful if a proxy you control **overwrites** it on every request
and Node is not otherwise reachable. That is a deployment property, not a code property —
[phase 11, page 06](../phase-11-deployment/06-reverse-proxy.md) owns it. In code, trust
`req.socket.encrypted` when you terminate TLS yourself, and trust the header only from a
known proxy address.

## Cookie flags

Each flag closes one door, and the defaults close none of them:

```console
sid=abc                                      readable by JS, sent over http, sent cross-site
sid=abc; HttpOnly                            XSS cannot read it
sid=abc; HttpOnly; Secure                    never sent over plain http
sid=abc; HttpOnly; Secure; SameSite=Lax      not sent on cross-site POST — the CSRF default
sid=abc; HttpOnly; Secure; SameSite=Strict   not sent on any cross-site navigation
sid=abc; HttpOnly; SameSite=None             REJECTED: None requires Secure
__Host-sid=abc; Secure; Path=/               no Domain -> subdomains cannot set or overwrite it
```

`HttpOnly` and `SameSite` are the pair covered from the attack side on
[page 03](./03-token-storage.md) and [page 11](./11-csrf.md). `Secure` is the one people
forget in staging and never revisit, and **`__Host-` is the flag almost nobody sets**: the
prefix makes the browser enforce `Secure`, `Path=/` and *no* `Domain`, which is the only
way to stop a compromised subdomain from writing a cookie your main domain will honour.
That subdomain-overwrite is precisely the hole in unsigned double-submit CSRF tokens.

**Node validates none of it:**

```console
server accepted and sent ->
   a=1; SameSite=None                 (invalid without Secure)
   __Host-b=2; Domain=example.com     (invalid: __Host- forbids Domain)
   c=3; Secure                        (sent over plain http; browser will drop it)
   d=4; Max-Age=notanumber
```

`res.setHeader('Set-Cookie', …)` is a string. Every one of those went out with a 200. The
browser silently drops them, and your logs show a successful response and a user who
cannot stay logged in. Test the flags with a browser or a real cookie jar, not by reading
the handler.

**There is a size wall too:**

```console
Set-Cookie length sent -> 5004 bytes
```

Node sent it happily; browsers cap a cookie near 4096 bytes and discard the excess without
telling anyone. This is the practical ceiling that makes a fat JWT in a cookie fail in
production and nowhere else ([page 02](./02-sessions-vs-jwt.md)).

## The shape that is actually correct

```js
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
res.setHeader('Set-Cookie',
  `__Host-sid=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}`);
```

One caveat on `__Host-`: it forbids `Domain`, so a cookie shared across `app.example.com`
and `api.example.com` cannot use it. That is the point — if you need the cookie on two
hosts, you have accepted that either host can set it.

## Gotchas

**Symptom:** Users are still hitting plain HTTP even though everything redirects
**Cause:** No HSTS, so every first request of every session starts in plaintext and is redirectable.
**Fix:** `Strict-Transport-Security` on the HTTPS responses. The header is ignored on a plaintext response — verified.

**Symptom:** An internal subdomain became unreachable after an HSTS change
**Cause:** `includeSubDomains` covers hosts with no certificate; browsers refuse rather than downgrade.
**Fix:** Inventory subdomains first, and ramp `max-age` from 300 upward before adding the directive.

**Symptom:** The HTTPS redirect can be bypassed
**Cause:** The check trusts a client-settable `X-Forwarded-Proto` — verified, the client set it directly.
**Fix:** Have the proxy overwrite the header, block direct access to the origin, or use `req.socket.encrypted`.

**Symptom:** Login works locally but the session is lost in production
**Cause:** `Secure` on a cookie served over http, `SameSite=None` without `Secure`, or `__Host-` with a `Domain` — all sent successfully by Node and dropped by the browser.
**Fix:** Test with a browser. Node validates no cookie attribute; nothing in the response indicates a problem.

**Symptom:** Sessions break only for users with a lot of state
**Cause:** The cookie exceeded ~4096 bytes. Node sent 5004 bytes without complaint — verified.
**Fix:** Store an id, not the state. This is the sessions-vs-JWT trade in practice.

**Symptom:** TLS latency rose after a client-library change, connections look fine
**Cause:** Session tickets are not being reused — on TLS 1.3, `getSession()` in the connect callback returns a value that does not resume.
**Fix:** Cache the session from the `'session'` event. Measured 3.82 ms resumed vs 5.95 ms full.

## Interview questions

**★ Why is HSTS needed if you already redirect HTTP to HTTPS?**
Because the redirect itself travels in plaintext on the first request and can be rewritten
by anyone on the path. HSTS makes the browser refuse to make that request at all. It only
counts when delivered over HTTPS — the same header on a plaintext response is ignored, so
port 80's only job is the redirect.

**★ What do `includeSubDomains` and `preload` actually commit you to?**
`includeSubDomains` forces HTTPS on every subdomain, so anything without a certificate
becomes unreachable rather than plaintext-reachable. `preload` embeds the domain in
browser binaries — removal takes months. Ramp `max-age` from a small value first.

**★ Behind a load balancer, how do you know the request was HTTPS?**
`req.socket.encrypted` is the truth only when Node terminates TLS. Otherwise it is
`X-Forwarded-Proto`, which is a client-settable header — verified, a client sent
`https` itself. It is trustworthy only if the proxy overwrites it and the origin is not
reachable directly.

**★ Walk through the flags on a session cookie.**
`HttpOnly` so XSS cannot read it, `Secure` so it never crosses plaintext, `SameSite=Lax`
so it is not attached to cross-site POSTs, `Path=/`, an explicit `Max-Age`, and the
`__Host-` prefix, which makes the browser enforce `Secure` and `Path=/` and forbid
`Domain` — the only way to stop a compromised subdomain overwriting it.

**What happens if you set a cookie wrong in Node?**
Nothing, on the server. Node performs no validation — `SameSite=None` without `Secure`,
`__Host-` with a `Domain`, and a 5004-byte cookie all went out with a 200. The browser
drops them silently, so the symptom is a user who cannot log in and a clean server log.

**Is TLS expensive?**
The handshake is; the encryption is not. Measured 6.75 ms per fresh TLS 1.2 connection,
5.58 ms on 1.3, and 3.82 ms resumed. That is an argument for keep-alive and session
reuse, never against TLS.

---

← Prev: [Secrets handling](./18-secrets.md) · Next → [`node:crypto`](./20-node-crypto.md)
