---
title: "A read timeout bounds the wait for bytes and nothing else, so DNS, the TCP connect, the TLS handshake and the wait for a free pooled connection are all time your request can spend outside every timeout you configured"
sidebar_label: "15 · The timeout that is not a timeout"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Marc Brooker, "Timeouts, retries, and backoff with jitter",
> Amazon Builders' Library
> ([aws.amazon.com](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)),
> the Spring Boot **4.1** reference "Calling REST Services"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/io/rest-client.html)) and the
> Boot 4.1 properties appendix, and the Spring Framework 7.0.x reference "REST Clients"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)).
> 🔴 **No sandbox.** No timing, log or measurement appears here. Version spine: JDK 25 ·
> Spring Boot 4.1.1 / Spring Framework 7.0.9.

**"We set a two-second timeout" is a sentence that means less than the person saying it
thinks. Boot exposes two knobs, `connect-timeout` and `read-timeout`, and between them they
leave at least four distinct waits unbounded. Every one of those waits is longest exactly when
the system is in trouble, which is when your timeout was supposed to help. This chunk
enumerates the gaps, because the gap you do not know about is where your request threads go
during an incident.**

## Brooker names the problem in one sentence

The Amazon Builders' Library article lists it among the pitfalls of choosing timeouts:

> *"There are also implementations where the timeout doesn't cover all remote calls, like DNS
> or TLS handshakes."*

and follows it with the advice that matters:

> *"In general, we prefer to use the timeouts built into well-tested clients. If we implement
> our own timeouts, we pay careful attention to the exact meaning of the timeout socket
> options, and what work is being done."*

The article also gives a first-hand account of exactly this class of bug, which is worth
having because it explains why the symptom is intermittent and correlated with deploys:

> *"In one system that I worked on at Amazon, we saw a small number of timeouts talking to a
> dependency immediately following deployments. The timeout was set very low, to around 20
> milliseconds. Outside of deployments, even with this low timeout value, we did not see
> timeouts happening regularly. Digging in, I found that the timer included establishing a new
> secure connection, which was reused on subsequent requests. Because connection establishment
> took longer than 20 milliseconds, we saw a small number of requests time out when a new
> server went into service after deployments."*

Note the resolution he describes: they eventually *"improved the system by establishing these
connections when a process started up, but before receiving traffic"* — connection warm-up as
a latency-budget technique, not as a micro-optimisation.

## The phases of one HTTP call, and what bounds each

| Phase | What happens | Bounded by |
|---|---|---|
| 1 · Pool acquisition | wait for a free connection from the client's pool | a **separate** limit on most clients; frequently unset |
| 2 · DNS resolution | hostname to address | the resolver's own timeout — **not** your connect timeout on most stacks |
| 3 · TCP connect | SYN / SYN-ACK / ACK | `connect-timeout` |
| 4 · TLS handshake | certificate exchange, key agreement | client-dependent; sometimes inside connect, often not |
| 5 · Request write | sending headers and body | usually nothing, unless the client has a write timeout |
| 6 · Server think time | the callee doing work | `read-timeout` (as the wait for the *first* byte) |
| 7 · Response read | streaming the body back | `read-timeout` **per read**, not for the whole body |

Rows 1, 2, 5 and 7 are the ones that surprise people, and row 7 is the one that surprises them
most.

## Row 7: a read timeout is per read, not per response

On the common socket-based clients, a read timeout is the maximum time to wait for *some*
data, not for *all* the data. A server that sends one byte every 1.9 seconds against a
two-second read timeout keeps the connection alive indefinitely and never trips it. The
request has no bound at all.

That is not a hypothetical: chunked responses, streaming endpoints and any proxy that flushes
periodically all produce this shape. The defences:

- **Bound the operation, not just the socket.** A whole-request deadline — a scope timeout as
  in [08 · Fanning out in Java](03c2-fanning-out-in-java.md), or a propagated deadline as in
  [12](04b-deadline-propagation.md) — is the only thing that bounds total elapsed time.
- **Cap the response size** so an unbounded body cannot be read forever. For reactive clients
  Boot exposes `spring.http.codecs.max-in-memory-size`; for imperative clients this is
  usually a client-library setting.

## Row 1: pool acquisition is often the biggest term under load

When a dependency slows down, its connections stay checked out longer, the pool empties, and
new requests queue for a connection. That queue wait is **not** connect time and **not** read
time. On a pooled client it has its own bound, and if that bound is unset the wait is
unlimited.

This produces the most confusing incident shape in the whole band: your client-side latency
metric shows requests taking many multiples of the read timeout you configured, and every
individual socket operation was within its limit. The time went into a queue you did not know
existed.

It also produces a nasty amplification: the pool is a shared resource across all callers of
that host, so one slow endpoint on a dependency stalls every endpoint on that dependency.
Isolating pools per dependency — which HTTP Service groups give you naturally, since each group
gets its own client — bounds the blast radius. That is a bulkhead, and **phase 16 owns the
pattern**; see [Phase 16 · Resilience and
operations](../../phase-16-resilience-operations/README.md).

## Row 2: DNS is not covered, and its failure mode is a stall

A hostname lookup that hangs is not a connect timeout, because the connect has not started.
On the JVM the relevant controls are the security properties
`networkaddress.cache.ttl` and `networkaddress.cache.negative.ttl`, which govern *caching*
rather than lookup duration — the lookup timeout belongs to the platform resolver.

Two consequences worth knowing:

- **A DNS outage stalls calls rather than failing them.** With no bound on resolution, threads
  sit in `InetAddress.getByName` and no timeout you configured applies.
- **Aggressive negative caching turns a transient DNS failure into a long one.** On
  Kubernetes, where Services are resolved by name and pod churn is constant, the caching TTLs
  matter more than they do in a static environment. **08 · Service discovery**
  *(not written yet)* owns the platform side of this.

## Row 4: TLS is where the Brooker anecdote lands

Whether the handshake counts against `connect-timeout` depends on the client library.
Empirically this is the single most common cause of "timeouts that only happen after a
deploy": a fresh pod has an empty connection pool, every early request pays connect plus
handshake, and a timeout calibrated on warm connections trips.

The mitigations are the ones Brooker describes: allow enough budget for connection
establishment, and — better — establish connections at startup before the pod is marked ready,
so that the first real request finds a warm pool. On Boot that means an application-ready hook
that issues a cheap call to each dependency, and a readiness probe that does not report ready
until it has completed.

⚠️ Do **not** turn that warm-up into a readiness probe that checks the dependency's health on
every poll — see [10 · Hard and soft
dependencies](03e-hard-and-soft-dependencies.md) for why that converts a partial outage into a
total one. A one-shot warm-up at startup is a different thing from a continuous liveness
coupling.

## What to configure, concretely

```yaml
spring:
  http:
    clients:
      connect-timeout: 500ms         # phase 3, and on some clients phase 4
      read-timeout: 1s               # phase 6, and each individual read in phase 7
      imperative:
        factory: jdk                 # pin it; see 04c2
```

and then, because the above bounds four of seven phases:

- **A per-operation deadline**, enforced in the application — the only bound on total elapsed
  time.
- **A pool-acquisition timeout and a pool size**, set on the underlying client library.
- **A response size cap**, so an endless body cannot be read forever.
- **A startup warm-up**, so the first request does not pay handshake time inside a budget
  calibrated on warm connections.

Only the first block is expressible in `spring.http.clients` properties. That is the honest
summary of this chunk: **the framework's timeout properties are necessary and are not
sufficient.**

## Gotchas

**★ A read timeout does not bound the response, only the gap between reads.** A slow drip of
bytes never trips it. Streaming endpoints, chunked responses and flushing proxies all produce
this. Only an operation-level deadline bounds total elapsed time.

**★ Pool-acquisition wait is invisible in both configured timeouts and is largest exactly when
you need it smallest.** When the dependency slows, connections stay checked out, the pool
drains, and new requests queue. Set an explicit acquisition timeout on the underlying client
and treat "waited for a connection" as a distinct, alertable outcome from "the server was
slow" — they have different fixes.

**★ One connection pool shared across all of a host's endpoints means one slow endpoint stalls
all of them.** Separate clients per dependency — which HTTP Service groups give you by
construction — contain the damage. This is why "one `RestClient` bean for everything" is worse
than it looks.

**★ Timeouts calibrated on warm connections fail after every deploy.** New pods have empty
pools, so early requests pay DNS, connect and TLS. Brooker's team saw exactly this with a 20 ms
timeout that was fine in steady state. Either budget for cold connections or warm the pool
before accepting traffic.

**★ DNS failures stall rather than fail.** No timeout you set in the HTTP client covers name
resolution, so a resolver problem parks threads with nothing to time out. Know your JVM's DNS
caching properties and your platform's resolver behaviour before you need them at 3am.

**★ Negative DNS caching can extend a two-second failure into minutes.** The JVM caches
failed lookups too. In an environment where addresses change constantly — which is every
container platform — an over-long negative TTL keeps you failing after the problem is fixed.

**★ A timeout on the client does not stop the server.** The server keeps computing, keeps
holding its transaction and keeps consuming its database's capacity for a result nobody will
read. That is the *"you don't get credit for late assignments"* problem from
[11 · The latency budget](04-the-latency-budget.md), and the only fix is on the server side:
know the deadline and check it.

**★ Every retry re-pays every phase.** A retried request may do DNS, connect and TLS again if
the pool has no usable connection, so a retry is not "the read timeout again" — it can be much
more expensive than the original attempt. Budget retries against the operation's remaining
deadline, never against the per-hop timeout. See
[07b · Retries and amplification](07b-retries-and-amplification.md).

## Interview questions

**★ You set a two-second read timeout and observe requests taking far longer. Name three
explanations that do not involve the setting being ignored.**
The request queued for a connection from an exhausted pool, which is a separate wait with its
own limit; the response streamed slowly enough that no individual read exceeded two seconds
while the total did, because a read timeout bounds the gap between reads rather than the whole
response; or the time went into DNS resolution, TCP connect and the TLS handshake, which are
governed by the connect timeout at best and by nothing at all in the case of DNS.

**★ What does `connect-timeout` actually cover?**
The TCP connection establishment, and — depending on the client library — possibly the TLS
handshake. It does not cover DNS resolution, it does not cover waiting for a pooled connection,
and it does not cover anything after the connection exists. Whether TLS is inside it is
client-specific, which is precisely why Brooker's advice is to *"pay careful attention to the
exact meaning of the timeout socket options, and what work is being done"* rather than to
assume.

**★ Why do timeout-related incidents cluster immediately after deployments?**
Because a fresh process has an empty connection pool, so its first requests pay DNS, TCP
connect and TLS handshake costs that steady-state requests do not — connections are reused
afterwards. A timeout calibrated against warm-connection latency is therefore too tight for the
cold path. Brooker describes exactly this at Amazon with a 20 ms timeout, and the durable fix
they landed on was establishing connections at process startup before the process received
traffic.

**★ How do you bound the total elapsed time of an operation, given that per-hop timeouts do
not add up to one?**
With an operation-level deadline enforced in the application: a `StructuredTaskScope` timeout
around the whole assembly, or a propagated deadline that each stage checks before starting more
work — ideally both, since the first bounds your own tree and the second bounds what your
callees do on your behalf. Per-hop timeouts remain necessary because they protect the caller's
resources per socket; they are simply not a statement about the operation.

**★ Your service calls one dependency that exposes both a fast endpoint and a slow reporting
endpoint. What goes wrong with a single shared client, and what would you do?**
They share a connection pool, so when the reporting endpoint slows down it holds connections
and the fast endpoint's requests queue behind it — one dependency, two very different latency
profiles, one shared resource. Split them into separate clients with separate pools and
separate timeouts, which HTTP Service groups make natural since each group is configured
independently. That is a bulkhead in the resilience sense, and it costs a configuration block.

{/* FOOTER */}
