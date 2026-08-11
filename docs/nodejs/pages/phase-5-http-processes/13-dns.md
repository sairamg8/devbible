---
title: "node:dns"
sidebar_label: "13 · node:dns"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`dns.lookup` and `dns.resolve` sound like the same thing and are not.
`lookup` calls the operating system's resolver on a libuv thread pool thread;
`resolve` speaks DNS over the network without touching the pool. Every HTTP
client in Node uses `lookup`, which is why name resolution can be blocked by
something entirely unrelated.**

## The measurement

Four `pbkdf2` calls saturate the default four-thread pool, then both resolvers run:

```console
$ node dnsdemo.mjs
default result order: verbatim | UV_THREADPOOL_SIZE: 4 (default)
localhost resolves to: ::1 (IPv6), 127.0.0.1 (IPv4)

   15 ms dns.resolve4 -> 172.66.147.243,104.20.23.154   (c-ares, no thread pool)
 1058 ms pbkdf2 3 done
 1059 ms pbkdf2 2 done
 1066 ms dns.lookup   -> 172.66.147.243   (libuv thread pool)
 1089 ms pbkdf2 4 done
 1107 ms pbkdf2 1 done
```

15 ms against 1066 ms for the identical name. `resolve4` was never queued;
`lookup` waited for a thread. The same thing happens when the pool is busy with
`fs` reads, `zlib` compression or `crypto`
([Phase 0](../phase-0-runtime-model/04-libuv-thread-pool.md)) — so an
image-processing endpoint can make every outbound HTTP call slow, with no
connection between them in any dashboard.

| | `dns.lookup` | `dns.resolve*` |
|---|---|---|
| Implementation | `getaddrinfo(3)` — the OS resolver | c-ares, DNS on the wire |
| Blocking | **libuv thread pool** | Non-blocking network I/O |
| Reads `/etc/hosts`, mDNS, NSS | ✅ | ❌ |
| Honours the OS DNS cache | ✅ | ❌ |
| Returns | one address (or all with `{ all: true }`) | records: `resolve4`, `resolveMx`, `resolveTxt`, `resolveSrv` |
| Used by | `http`, `https`, `net`, `fetch` | only when you call it |

Neither caches in Node itself. `lookup` benefits from whatever the OS or a
sidecar caches; `resolve` re-queries every time.

## Two practical consequences

**Raise the thread pool, or move the work off it.** If the service does heavy
`fs`/`zlib`/`crypto` work, `UV_THREADPOOL_SIZE=16` (set before the process starts;
it is read once) buys headroom. The better fix is usually to stop doing CPU work
on the pool at all ([Phase 2, page 22](../phase-2-async/22-cpu-bound-work.md)).

**Node does not cache DNS.** Every new connection resolves again. With keep-alive
that is rare, but a service making many short-lived connections issues a lookup
per connection. Where it hurts, add a caching layer that respects TTL — undici's
dispatcher accepts a custom `lookup`, and `cacheable-lookup` is the usual choice.
Do not cache forever: DNS is how failover and blue/green deploys move traffic, and
a process that pinned an address at boot keeps talking to a decommissioned host.

## `verbatim` and the IPv6 localhost trap

```console
localhost resolves to: ::1 (IPv6), 127.0.0.1 (IPv4)
```

Since Node 17 the default result order is **`verbatim`** — addresses are returned
in the order the resolver gave them, rather than IPv4 first. On a host where
`localhost` resolves to `::1` before `127.0.0.1`, Node connects over IPv6. If your
database or dev server is listening only on `127.0.0.1`, the connection is
refused, and the symptom is `ECONNREFUSED` against a service you can see running.

```js
import { setDefaultResultOrder } from 'node:dns';
setDefaultResultOrder('ipv4first');      // or --dns-result-order=ipv4first
```

Prefer fixing the address — connect to `127.0.0.1` explicitly, or make the service
listen on both — over flipping the global order.

## Where you actually call `dns` directly

Checking MX records before accepting an email address, SRV-based service
discovery, verifying domain ownership through a TXT record, and reverse lookups
for logging:

```js
import { promises as dns } from 'node:dns';

const mx = await dns.resolveMx('example.com');            // [{ exchange, priority }]
const txt = await dns.resolveTxt('_acme-challenge.example.com');
const names = await dns.reverse('8.8.8.8');
```

Every one of these is a network call to an untrusted-ish system: wrap them in a
timeout and expect `ENOTFOUND`, `ENODATA`, `SERVFAIL` and `ETIMEOUT` as ordinary
outcomes rather than exceptions worth crashing on.

One security note: resolving a user-supplied hostname is a step in SSRF. Checking
that the resolved address is not private and *then* connecting is a TOCTOU race —
DNS can return a different answer the second time (DNS rebinding). The reliable
fix is to pin the checked address for the connection, or to egress through a
proxy that enforces the policy.

## Gotchas

**Symptom:** Outbound HTTP latency spikes whenever the service does image or
compression work
**Cause:** `dns.lookup` is queued behind CPU tasks on the libuv thread pool.
**Fix:** Move the CPU work to a worker, raise `UV_THREADPOOL_SIZE`, or cache DNS.

**Symptom:** `ECONNREFUSED` connecting to `localhost` in development
**Cause:** `verbatim` ordering resolved `::1` first; the service listens on
`127.0.0.1` only.
**Fix:** Use `127.0.0.1`, or listen on both, or `--dns-result-order=ipv4first`.

**Symptom:** Traffic keeps going to a decommissioned host after a DNS change
**Cause:** A cache with no TTL respect, or long-lived pooled connections.
**Fix:** Honour TTL; bound connection lifetime ([page 07](07-keep-alive-and-agents.md)).

**Symptom:** `dns.resolve` cannot see an entry in `/etc/hosts`
**Cause:** It queries DNS servers directly and never consults the OS resolver.
**Fix:** `dns.lookup` for anything that must respect host files or container DNS.

**Symptom:** A DNS failure crashes the process
**Cause:** `ENOTFOUND` / `ENODATA` treated as unexpected.
**Fix:** Handle them as normal results, with a timeout around the call.

**Symptom:** An SSRF allow-list is bypassed
**Cause:** The name was validated, then resolved again at connect time.
**Fix:** Validate the resolved address and connect to that address.

## Interview questions

**★ What is the difference between `dns.lookup` and `dns.resolve`?**
`lookup` calls the OS resolver via `getaddrinfo`, so it respects `/etc/hosts`, NSS
and the system cache — and it runs on the libuv thread pool. `resolve` speaks DNS
directly through c-ares as non-blocking network I/O, ignoring host files. HTTP
clients use `lookup`.

**★ Why can DNS resolution be slow in a healthy service?**
Because `lookup` competes for the four default thread pool threads with `fs`,
`zlib` and `crypto`. Measured above: with the pool saturated, `lookup` took
1066 ms while `resolve4` answered the same name in 15 ms.

**★ Does Node cache DNS results?**
No. Each resolution goes to the OS (`lookup`) or to the network (`resolve`). Under
keep-alive that is unnoticeable; with many short-lived connections it is a
per-connection cost, and a TTL-respecting cache such as `cacheable-lookup` is the
fix.

**★ Why does connecting to `localhost` sometimes fail while `127.0.0.1` works?**
Node 17 changed the default result order to `verbatim`, so `::1` is often tried
first. A service bound only to `127.0.0.1` refuses that connection.

**Why is caching DNS forever a bad idea?**
DNS is the mechanism behind failover and traffic migration. A process that pinned
an address at boot keeps sending traffic to a host that has been taken away.

**How does DNS relate to SSRF?**
Validating a hostname and then connecting resolves twice, and the second answer
can differ — DNS rebinding. Resolve once, validate the address, connect to that
address.

---

← Prev: [node:net and node:dgram](12-net-and-dgram.md) · Next → [node:http2](14-http2.md)
