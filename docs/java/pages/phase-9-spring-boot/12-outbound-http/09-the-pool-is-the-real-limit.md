---
title: "Your concurrency limit is the connection pool, and its default is tiny"
sidebar_label: "9 · The pool is the real limit"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Apache HttpComponents Client 5.x API —
> `PoolingHttpClientConnectionManager` and its constant field values
> (hc.apache.org/httpcomponents-client-5.5.x/current/httpclient5/apidocs/) — the
> Spring Framework reference *REST Clients → Client Request Factories*, and the
> Spring Boot reference *Calling REST Services → HTTP Client Detection*. Spring
> Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A timeout tells you how long one call may wait for the remote host. It says
nothing about how long a call may wait for *a connection to make the call with*
— and under load that is the wait that dominates. Apache HttpComponents, the
library Boot prefers when it is on the classpath, defaults to *25 total
connections and 5 per route*. Five. That is not a typo, and it is not a bug: it
is a conservative default from an era when the client was usually a desktop
application. In a service fanning out to one downstream host, five is your
concurrency limit for that host, no matter how many threads you have. Virtual
threads make this worse rather than better, because they remove the thread pool
that used to accidentally bound your concurrency for you.**

## The pool is a semaphore you did not know you had

An HTTP client keeps a pool of established connections so that the TCP and TLS
handshakes are not repeated per request. Borrowing from an empty, fully-lent pool
means waiting. So the sequence of a request is really:

1. **Acquire a connection** — from the pool, or by opening a new one if the pool
   is below its limit, or by *waiting* if it is not.
2. **Connect** (only if a new connection was opened) — bounded by the connect
   timeout.
3. **Send, then wait for the response** — bounded by the read/response timeout.
4. **Return the connection to the pool** — which happens when the response body
   has been fully consumed or the response closed.

🔴 **Step 1 is the one nobody configures and step 4 is the one people get wrong.**
Both are invisible in the code; both are where saturation shows up.

## Apache's numbers, and why they are almost never right

`PoolingHttpClientConnectionManager` publishes its defaults as constants:

| Constant | Value |
|---|---|
| `DEFAULT_MAX_TOTAL_CONNECTIONS` | **25** |
| `DEFAULT_MAX_CONNECTIONS_PER_ROUTE` | **5** |

A *route* is essentially a target host (plus scheme, port and proxy). So a
service calling one downstream host gets five concurrent in-flight requests to
it, and the sixth caller waits — regardless of how many request-handling threads
you have.

```java
@Bean
ClientHttpRequestFactoryBuilder<?> apacheFactoryBuilder() {
    return ClientHttpRequestFactoryBuilder.httpComponents()
            .withConnectionManagerCustomizer(cm -> {
                cm.setMaxConnTotal(200);
                cm.setMaxConnPerRoute(100);
            });
}
```

⚠️ **I have not confirmed from the Boot reference whether Boot overrides these
defaults when it builds the Apache client for you**, so do not assume either way:
read the effective values at runtime — `PoolingHttpClientConnectionManager`
implements `ConnPoolControl`, which exposes `getMaxTotal()` and
`getDefaultMaxPerRoute()` — and set them deliberately. "It is probably fine" is
how a service discovers its pool size during an incident.

The other libraries differ in what they expose:

- **Jetty** and **Reactor Netty** both size their pools explicitly and have their
  own defaults; configure them through the corresponding builder.
- **The JDK client** pools connections but exposes **no public API to size the
  pool**. The knobs that exist are implementation-specific system properties
  under `jdk.httpclient.*` rather than part of the supported API. ⚠️ If pool
  sizing is something you need to control precisely, that is a genuine argument
  for choosing Apache or Jetty rather than accepting the JDK default — and it is
  a decision to make in [chunk 8](08-pinning-the-factory-tls-proxy.md), not
  during an outage.

## HTTP/2 changes the arithmetic

Under HTTP/1.1, one connection carries one request at a time, so pool size is
concurrency. Under HTTP/2, one connection multiplexes many concurrent streams, so
a single connection can carry far more concurrent requests and the limit moves to
the peer's `SETTINGS_MAX_CONCURRENT_STREAMS`.

Two practical consequences. A pool sized for HTTP/1.1 is usually far larger than
HTTP/2 needs, which is harmless. And a service that negotiated HTTP/2 in staging
but falls back to HTTP/1.1 in production — because a load balancer in between does
not support it — silently loses an order of magnitude of concurrency with no
configuration change anywhere. If your capacity numbers depend on multiplexing,
the negotiated protocol is something to assert, not assume.

## Returning the connection: the leak you cannot see

Step 4 above is where an ignored response becomes a resource leak. A response
whose body is never consumed and never closed holds its connection until
something else reclaims it.

```java
// ❌ the response is never completed
restClient.delete().uri("/carts/{id}", id).retrieve();

// ✅ consumes and completes the exchange
restClient.delete().uri("/carts/{id}", id).retrieve().toBodilessEntity();
```

This is the concrete reason [chunk 3](03-the-fluent-api.md) insists on a terminal
operation. The symptom is not an exception; it is a pool that gradually stops
handing out connections in a service whose call volume did not change.

## Gotchas

**⚠️ Sizing the thread pool and never sizing the connection pool**
**Symptom:** adding request-handling capacity produces no throughput improvement
at all.
**Cause:** the bottleneck is five connections per route, not threads.
**Fix:** size the connection pool for the concurrency you actually want to that
host, and set a bounded acquisition timeout so exhaustion fails fast.

**⚠️ A fire-and-forget call with no terminal operation**
**Symptom:** connection-pool exhaustion that correlates with uptime rather than
with load.
**Cause:** the exchange was never completed, so the connection was never
returned.
**Fix:** `.toBodilessEntity()`.

**⚠️ One `RestClient` shared across two downstream hosts, with a total-pool
limit**
**Symptom:** a slow dependency starves an unrelated fast one.
**Cause:** they share `maxTotal`, so the slow host's held connections consume the
budget the fast one needed. Per-route limits do not help once the total is hit.
**Fix:** a client per downstream service, each with its own pool. This is the
bulkhead pattern, implemented by not sharing.

**⚠️ Sizing the pool from average latency**
**Symptom:** the pool is correct in steady state and exhausted during exactly the
incident it was meant to survive.
**Cause:** concurrency is arrival rate times *latency*, and the latency that
matters is the degraded one, not the average.
**Fix:** size for the tail, and pair it with an acquisition timeout so that when
the tail is exceeded you shed load instead of queueing.

**⚠️ Carrying an HTTP/1.1-era pool size into an HTTP/2 world and concluding
pooling does not matter**
**Symptom:** a service with a generous pool shows no acquisition waits, so the
pool is declared a non-issue — until a load balancer downgrades the connection to
HTTP/1.1.
**Cause:** multiplexing was doing the work, not the pool size.
**Fix:** know which protocol you actually negotiate in production, and treat a
downgrade as a capacity event.

**⚠️ Assuming Boot has already raised the Apache defaults for you**
**Symptom:** a pool of five in production, in a service whose team believed the
framework picked a sensible number.
**Cause:** an assumption nobody checked.
**Fix:** read `getMaxTotal()` and `getDefaultMaxPerRoute()` off the connection
manager at startup and log them, or set them explicitly. Either way the number
becomes a decision rather than an inheritance.

**⚠️ Relying on the server-side timer to explain client latency**
**Symptom:** your service's p99 is up, the dependency's own dashboard says it is
healthy, and the argument goes in circles.
**Cause:** the dependency measures from when *it* received the request. Your
client timer includes DNS, connection acquisition, the network, and queueing —
none of which appear on their graph.
**Fix:** compare the client timer with their server timer. A gap between them is
the network and your own pool, and it is exactly the evidence that ends the
argument.

## Interview questions

**★ A service calls one downstream host through Apache HttpComponents with
default settings. How many concurrent requests can it have in flight to that
host?**
Five. `PoolingHttpClientConnectionManager` defaults to
`DEFAULT_MAX_CONNECTIONS_PER_ROUTE` of 5 and `DEFAULT_MAX_TOTAL_CONNECTIONS` of
25, and a route is effectively a target host. So the sixth concurrent caller
waits for a connection to be returned, regardless of how many threads the service
has. Those defaults are not wrong for what they were designed for — a client
library used from a desktop application — but for a server fanning out to a
dependency they are two orders of magnitude below what you want, and they are the
single most common invisible bottleneck in a Spring service.

**★ Why is one `RestClient` per downstream service better than one shared
client?**
Isolation, in three dimensions. The connection pool is not shared, so a slow
dependency cannot consume the connection budget an unrelated fast one needed —
that is the bulkhead pattern, implemented by not sharing. Timeouts can differ,
because "slow" means something different per dependency. And observability
separates cleanly, since the `client.name` tag on the observation derives from
the request host anyway. The counter-argument is that it is more beans, which is
true and is a small price for not having a partner API's outage take out your
session lookups.

**★ How does HTTP/2 change how you think about the pool?**
Under HTTP/1.1 a connection carries one request at a time, so pool size *is* your
concurrency ceiling. Under HTTP/2 a connection multiplexes many concurrent
streams, so the ceiling moves to the peer's advertised maximum concurrent streams
and a much smaller pool suffices. The practical trap is the transition: a service
that negotiates HTTP/2 in staging but is downgraded to HTTP/1.1 in production by
an intermediary loses an order of magnitude of concurrency with no configuration
change anywhere, and the symptom is pool exhaustion in an environment that was
tested and found fine. If capacity depends on multiplexing, the negotiated
protocol belongs in your assertions, not your assumptions.

**★ How would you size a connection pool?**
Concurrency is arrival rate times latency, so the pool needs to cover the arrival
rate multiplied by the latency you must survive — which is the degraded tail, not
the average, because the pool exists for the bad case. Then add the piece people
skip: whatever number you pick will eventually be exceeded, so pair it with a
bounded acquisition timeout so the excess is shed rather than queued. And measure
rather than reason — the pool exposes leased, pending and available counts, and
pending consistently above zero is the signal that the number is too small,
whereas a large pool with no pending is only telling you the ceiling is not
binding today.

---

← Prev: [Pinning the factory](08-pinning-the-factory-tls-proxy.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Deadlines, not timeouts](11-deadlines-not-timeouts.md)
