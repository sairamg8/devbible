---
title: "HTTPS, TLS and mTLS"
sidebar_label: "09 · HTTPS and TLS"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span> · mTLS is <span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS), OpenSSL-generated certs.

**In production Node almost never terminates TLS — Nginx, an ALB or the ingress
does. What you do need is the client side: why a certificate fails to verify, how
to trust a private CA without disabling verification, and what SNI is.**

## Terminating TLS in Node

```js
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';

const server = createServer(
  { key: readFileSync('server.key'), cert: readFileSync('server.crt') },
  (req, res) => {
    const s = req.socket;
    console.log('protocol', s.getProtocol(), '| cipher', s.getCipher().name, '| SNI', s.servername);
    res.end('secure');
  });
```

```console
$ node tlsdemo2.mjs
  server: protocol TLSv1.3 | cipher TLS_AES_256_GCM_SHA384 | SNI servername: "localhost"
```

`node:https` is `node:http` plus a TLS context — same request and response
objects, same handler. `cert` is the server certificate **plus any intermediates**,
concatenated in order; a chain missing its intermediate is the single most common
"works in curl, fails in Java" bug, because some clients fetch the missing link
and others do not.

Reasons to let a proxy do this instead: certificate renewal without a restart,
OCSP stapling, HTTP/2 and HTTP/3 termination, and CPU spent on handshakes outside
your event loop.

## The certificate chain

A certificate says "this public key belongs to this name", signed by an issuer.
Verification walks the chain from the leaf up to something in the local trust
store. Node's store is Mozilla's bundle, compiled in — **not** the operating
system's, which is why a certificate your browser accepts can still fail here.

```console
$ node tlsdemo2.mjs
global fetch, default trust   -> FAILED: UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

| Error code | Means |
|---|---|
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | The chain does not reach a trusted root — usually a missing intermediate |
| `DEPTH_ZERO_SELF_SIGNED_CERT` | A bare self-signed certificate |
| `SELF_SIGNED_CERT_IN_CHAIN` | A private root, or a TLS-inspecting corporate proxy |
| `CERT_HAS_EXPIRED` | Exactly that. Check the clock too |
| `ERR_TLS_CERT_ALTNAME_INVALID` | Chain is fine, the hostname is not in the SAN |
| `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` | Issuer unknown locally |

**A hostname mismatch is not a chain problem.** Modern certificates are matched
against the Subject Alternative Name extension; the `CN` field is ignored. A cert
issued for `localhost` with `subjectAltName=DNS:localhost,IP:127.0.0.1` works for
both, and fails for anything else.

## Trusting a private CA — three options, one of them wrong

```console
$ node tlsenv.mjs
-> FAILED: UNABLE_TO_VERIFY_LEAF_SIGNATURE

$ NODE_EXTRA_CA_CERTS=tls/ca.crt node tlsenv.mjs
-> 200 secure
```

1. **`NODE_EXTRA_CA_CERTS=/path/ca.pem`** — *appends* to the default store, process
   wide, no code change. The right answer for a corporate proxy or an internal CA.
2. **Per-client `ca`** — scoped to the one client that needs it, which is better
   when only one dependency uses the private CA:

   ```js
   import { Agent, fetch } from 'undici';
   const internal = new Agent({ connect: { ca: readFileSync('ca.crt') } });
   await fetch(url, { dispatcher: internal });          // 200
   ```

3. **`rejectUnauthorized: false`** — ❌ turns verification off entirely, which
   means any machine on the path can impersonate the server. The same goes for
   `NODE_TLS_REJECT_UNAUTHORIZED=0`, which prints a process warning and disables
   it globally. It is never the fix; it is the thing you find in an incident
   review.

## SNI

One IP, many certificates. The client sends the hostname it wants **in the
clear** during the handshake, and the server picks a certificate for it — which
is why `s.servername` above is `"localhost"`.

```js
createServer({ key, cert, SNICallback: (servername, cb) => {
  const ctx = contexts.get(servername);
  cb(ctx ? null : new Error(`unknown host ${servername}`), ctx);
} }, handler);
```

Consequence worth knowing: an IP-address URL sends no SNI at all, so a virtual-
hosted server has nothing to select on and answers with its default certificate —
which then fails the hostname check.

## Mutual TLS

Normal TLS authenticates the *server*. mTLS also authenticates the *client*, with
a certificate instead of a bearer token. Use it for service-to-service inside a
trust boundary, or where a partner requires it.

```js
const server = createServer(
  { key, cert, ca: readFileSync('ca.crt'), requestCert: true, rejectUnauthorized: true },
  (req, res) => {
    const peer = req.socket.getPeerCertificate();
    console.log('authorized =', req.socket.authorized, '| client CN =', peer.subject?.CN);
    res.end(`hello ${peer.subject?.CN}`);
  });
```

```console
$ node mtls.mjs
no client cert   -> FAILED: UND_ERR_SOCKET
  server: authorized = true | client CN = orders-service | issuer = Dev Root CA
with client cert -> 200 hello orders-service
```

The identity arrives as `peer.subject.CN` — `orders-service` here — which is what
you authorise against. Note the failure mode: a rejected client gets a **socket
error**, not an HTTP status, because the rejection happens during the handshake
before any request exists. That makes mTLS failures invisible in HTTP logs and is
why people spend an afternoon on them.

`requestCert: true` with `rejectUnauthorized: false` is a useful middle setting:
the handshake succeeds either way and you check `socket.authorized` yourself, so
you can return a real 401 instead of a dead connection.

The cost is certificate lifecycle — issuing, distributing, rotating and revoking
one per service. Without automation (SPIFFE, a service mesh, cert-manager) that
becomes the outage: every certificate expires on the same day a year later.

## Gotchas

**Symptom:** Works in the browser, `UNABLE_TO_VERIFY_LEAF_SIGNATURE` in Node
**Cause:** A missing intermediate. Browsers often fetch it; Node does not. Node
also uses its own bundled roots, not the OS store.
**Fix:** Serve the full chain — leaf, then intermediates — in `cert`.

**Symptom:** `ERR_TLS_CERT_ALTNAME_INVALID`
**Cause:** The hostname is not in the certificate's SAN list. `CN` is not consulted.
**Fix:** Reissue with the right SAN, or connect by a name that is in it.

**Symptom:** TLS fails only on the corporate network
**Cause:** An inspecting proxy re-signs traffic with its own root —
`SELF_SIGNED_CERT_IN_CHAIN`.
**Fix:** `NODE_EXTRA_CA_CERTS` pointing at the proxy's root.

**Symptom:** `rejectUnauthorized: false` in production code
**Cause:** It made the error go away.
**Fix:** Trust the CA properly. This one disables the entire point of TLS.

**Symptom:** mTLS clients fail with a socket error and nothing is logged
**Cause:** Rejection happens in the handshake; there is no request to log.
**Fix:** Listen for `tlsClientError` on the server, or use
`rejectUnauthorized: false` plus an explicit `socket.authorized` check.

**Symptom:** Everything breaks exactly one year after launch
**Cause:** Manually issued certificates with no rotation.
**Fix:** Automate issuance and alert on expiry well ahead.

## Interview questions

**★ A certificate works in the browser and fails in Node. Why?**
Two common causes. The server is not sending its intermediate certificate —
browsers often chase the missing link, Node does not. Or the certificate is
trusted by the OS store, which Node ignores in favour of its own compiled-in
Mozilla bundle. `NODE_EXTRA_CA_CERTS` fixes the second.

**★ What is SNI and why does it exist?**
The client sends the target hostname in plaintext during the handshake so a server
hosting many domains on one IP can select the right certificate. Without it,
virtual hosting over TLS would need an IP per certificate. It also means the
hostname you connect to is visible to anyone on the path.

**★ Why is `rejectUnauthorized: false` unacceptable?**
It disables chain and hostname verification, so any party able to intercept the
connection can present any certificate and be believed. The encryption remains,
the authentication is gone — which is the part that stops a man in the middle.

**★ What does mTLS add, and what does it cost?**
The server authenticates the client with a certificate rather than a shared
secret, so the identity is bound to a key the client cannot leak by copy-pasting
a token. The cost is lifecycle: issuing, rotating and revoking one certificate per
service, and failures that show up as socket errors with nothing in the HTTP log.

**Is `CN` used for hostname matching?**
No. Matching uses the Subject Alternative Name extension; `CN` has been ignored by
current clients for years. A certificate with the right `CN` and no SAN fails.

**Should Node terminate TLS in production?**
Usually not. A proxy handles renewal without restarting the app, staples OCSP,
terminates HTTP/2 and HTTP/3, and keeps handshake CPU off the event loop.

---

← Prev: [Outbound client discipline](08-outbound-client-discipline.md) · Next → [Streaming responses and SSE](10-streaming-and-sse.md)
