---
title: "Behind a reverse proxy — X-Forwarded-*, trust proxy, TLS"
sidebar_label: "06 · Reverse proxy"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** HTTP basics; proxy header trust is an
> application contract with Nginx / the mesh in front.

**TLS usually terminates at the load balancer. Your Node process sees plain HTTP and
must trust hop-by-hop headers only from that proxy — or attackers forge client IPs and
proto and break rate limits, redirects, and cookies.**

## What the proxy adds

| Header | Meaning |
|---|---|
| `X-Forwarded-For` | Client IP chain (left-most or right-most depending on convention) |
| `X-Forwarded-Proto` | `https` if the client used TLS to the edge |
| `X-Forwarded-Host` | Original Host |
| `Forwarded` | Standardized form (RFC 7239) — prefer when available |

```js
// without trust: req.socket.remoteAddress is the proxy, not the user
// with a single trusted proxy hop:
function clientIp(req) {
  const raw = req.headers['x-forwarded-for'];
  if (typeof raw === 'string' && raw.length) {
    return raw.split(',')[0].trim(); // careful: only if you trust the proxy
  }
  return req.socket.remoteAddress;
}
```

**Only trust these headers if the socket peer is your proxy.** If Node is reachable
directly from the internet, anyone can send `X-Forwarded-For: 1.2.3.4`.

## trust proxy (frameworks)

Express and similar expose `trust proxy` so `req.ip` and secure-cookie logic use
forwarded values. Set it to the number of proxy hops or a subnet allow-list — not
blind `true` in multi-tenant setups without understanding the hop count.

## TLS termination

```
Client --HTTPS--> Nginx/ALB --HTTP--> Node :3000
```

Implications:

- Node may not need certs in the pod (platform handles them)  
- Redirects to HTTPS must use `X-Forwarded-Proto`, not `req.socket.encrypted`  
- Secure cookies need `secure: true` when the *client* connection is HTTPS  

```js
function isHttps(req) {
  return req.headers['x-forwarded-proto'] === 'https';
}
```

## Gotchas

**Symptom:** All users share one IP for rate limits
**Cause:** Using proxy address; ignoring `X-Forwarded-For`
**Fix:** Parse client IP from trusted hop only

**Symptom:** Rate limit bypass / fake IP
**Cause:** Trusting `X-Forwarded-For` without restricting who can connect
**Fix:** NetworkPolicy so only the proxy reaches Node; strip client-supplied headers at the edge

**Symptom:** Infinite redirect loops to HTTPS
**Cause:** App redirects to HTTPS while already HTTPS at edge but sees HTTP internally
**Fix:** Honour `X-Forwarded-Proto`

**Symptom:** Cookies not set in production
**Cause:** `Secure` cookies over HTTP-as-Node-sees-it without trust
**Fix:** Configure trust proxy / secure detection correctly

## Interview questions

**★ Why is blindly trusting X-Forwarded-For dangerous?**
Clients can spoof it if they can hit the app directly, forging IPs for auth and limits.

**Where should TLS terminate for a typical Node API?**
At the load balancer or ingress; Node often speaks HTTP on a private network.

**What is trust proxy for?**
Telling the framework how many hops of forwarded headers to trust when computing IP
and protocol.

**How do secure cookies work behind a terminating proxy?**
The app must know the client used HTTPS via forwarded proto, not via a local TLS socket.

**Who strips untrusted forwarded headers?**
The edge proxy should overwrite/set them; the app should only accept connections from
that edge.

---

← Prev: [Environment parity](./05-environment-parity.md) · Next → [Zero-downtime deploys](./07-zero-downtime-deploys.md)
