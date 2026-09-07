---
title: "A layer-4 balancer spreads connections and never reads a byte of HTTP; a layer-7 balancer reads the request and can route on it — and the choice decides where TLS ends, whether stickiness is possible, and how a deploy drains; the algorithm matters less than the health check and the drain"
sidebar_label: "02 · Load balancing, layer 4 vs layer 7"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method and common practice — the layer-4/layer-7 distinction, the
> algorithms, health checks and connection draining are described as every major balancer
> (cloud network and application balancers, NGINX, HAProxy, Envoy) implements them, without
> vendor claims or defaults. The one protocol fact — HTTP/2 carrying many exchanges on one
> connection — is [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html) (verbatim below), and
> it is what makes layer-4 balancing of HTTP/2 uneven. **No sandbox run.**

**A load balancer is two different things depending on which layer it works at, and most
balancer questions in a round are really "which one, and why".** A layer-4 balancer sees TCP
connections: it picks a backend when the connection opens and forwards packets both ways
without reading them, which makes it fast, protocol-agnostic and blind — it cannot route on a
URL, cannot terminate TLS, and treats a single HTTP/2 connection carrying a thousand requests as
one unit of load. A layer-7 balancer terminates the connection, reads each HTTP request, and
picks a backend per request: it can route `/api` and `/static` differently, hash on a cookie for
stickiness, retry an idempotent request on another backend, and rewrite headers — at the cost of
parsing every request and holding TLS keys. The algorithm — round robin, least connections,
weighted, hash — is the part candidates recite and the part that matters least; the health
check and the connection drain are what decide whether a deploy is invisible or an outage. This
page is the two layers and what each can and cannot do, the algorithms with the one situation
each is for, health checks and draining, the balancer as a box on the failure walk, and the
storefront's choice.

## Layer 4 and layer 7

| | Layer 4 (transport) | Layer 7 (application) |
|---|---|---|
| Unit of balancing | a TCP (or UDP) connection | an HTTP request |
| Reads the payload | never — forwards packets | yes — parses each request |
| TLS | passes through; the backend terminates | terminates (holds the certificate), or re-encrypts to the backend |
| Can route on | source and destination address and port | path, host, headers, cookies, method |
| Stickiness | by source address | by cookie, header or a hash of anything in the request |
| Retries | none — it does not know a request failed | can retry an idempotent request on another backend |
| Cost per request | near zero — kernel or hardware forwarding | a parse, a TLS decryption, a new upstream connection or a pooled one |
| Protocols | anything over TCP/UDP — databases, gRPC, WebSockets, custom | HTTP, and protocols the balancer understands (gRPC, WebSocket upgrade) |
| Sees per-request load | no — see the HTTP/2 note | yes |
| Typical name | network load balancer, NLB, `mode tcp` | application load balancer, ALB, reverse proxy, ingress |

The HTTP/2 note is the one that turns a textbook table into a design point. HTTP/2 puts many
exchanges on one connection:

> *"HTTP/2 enables a more efficient use of network resources and a reduced latency by
> introducing field compression and allowing multiple concurrent exchanges on the same
> connection."* — RFC 9113

So a layer-4 balancer that hands a client's connection to one backend has handed *every*
request that client sends for the life of the connection to that backend; two clients with very
different request rates look identical at layer 4. Balancing HTTP/2 or gRPC evenly needs a
layer-7 balancer that distributes streams, or clients that open several connections. This is
the standing "why is one pod hot" answer for gRPC services behind a network balancer.

## When a network balancer is enough

- The backends are **interchangeable and stateless**, and no routing on the request is needed:
  the same service on every pod, every request acceptable anywhere.
- The protocol is **not HTTP** — a database proxy, a message broker's port, a custom TCP
  protocol — or is HTTP that the backends must terminate themselves (end-to-end TLS to the pod
  for compliance).
- **Throughput** is the constraint: a layer-4 path forwards at line rate with no parsing.
- **Long-lived connections** where per-connection balancing is the right unit anyway —
  WebSockets are balanced when they open (**06 · Long-lived connections** *(not written yet)*).

And when request routing is needed — different paths to different services, canary by header,
cookie stickiness, retries, TLS at the edge — it is layer 7, and in most product systems the
answer is both: a network balancer at the front for resilience and throughput, feeding a
layer-7 tier (the gateway of **03** *(not written yet)*) that routes.

## The algorithms, and the one situation each is for

| Algorithm | Picks | The situation | The trap |
|---|---|---|---|
| **round robin** | the next backend in turn | equal backends, equal requests — the default | a slow backend gets the same share and its queue grows |
| **weighted round robin** | in proportion to weights | backends of different size, or a canary at 5 % | weights set once and never revisited |
| **least connections** | the backend with the fewest open connections | requests of uneven duration — a slow one should not keep receiving | at layer 4 with HTTP/2, "connections" is not load |
| **least response time / least load** | the backend answering fastest, or reporting least load | heterogeneous or noisy backends | needs measurement the balancer must gather; oscillates if it reacts too fast |
| **random, or power of two choices** | two at random, take the less loaded | very large pools where tracking every backend is costly; avoids herd effects | pure random without the second choice is worse than round robin |
| **hash — source IP** | the same client to the same backend | stickiness without cookies; layer 4 | many clients behind one NAT hash to one backend |
| **hash — cookie or header** | the same session to the same backend | sessions in process memory (a smell — **04** *(not written yet)*), caches warm per user | a backend's death loses every session pinned to it |
| **consistent hashing** | a key to a backend with minimal reshuffle when the pool changes | cache tiers, sharded stateful backends | hot keys land on one backend regardless |

The honest sentence in a round: *"round robin, and least-connections if request durations vary
— the algorithm is rarely the problem; the health check and the drain are."* Stickiness is
named as the thing you would rather not need: a backend that must see the same user again has
state, and the state should be in a store, not a pod.

## Health checks: the balancer's view of alive

A backend is in the pool because a health check says so, and the check's design is a design
decision:

- **Active checks** — the balancer probes an endpoint every few seconds and removes a backend
  after N failures, restores it after M successes. The thresholds set how fast a dead backend
  leaves (seconds of errors) and how long a flapping one stays out.
- **Passive checks** — the balancer watches real traffic: a burst of 5xx or connection resets
  ejects the backend. Faster to react, and prone to ejecting a backend that is returning
  legitimate 5xx for a dependency's failure — which then ejects the whole pool.
- **What the check tests** — a process that answers `200` while its database connection is dead
  is a backend that will fail every real request; the check should touch a real dependency
  cheaply, as [phase 1's evolution page](../phase-1-the-method/14-evolution-and-operations.md)
  said — *and* it must not itself be expensive, or a hundred balancers probing every second
  become load.
- **Readiness against liveness** — a backend that is starting, warming a cache or draining is
  not *ready* and should not receive traffic, but it is *alive* and should not be restarted;
  two checks, two meanings, and conflating them restarts pods that were merely busy.

The failure mode to name: a health check that tests too much fails the whole pool at once when a
shared dependency hiccups, and the balancer with no healthy backends does one of two things —
returns errors for everything, or *fails open* and sends traffic to all backends regardless.
Know which your balancer does.

## Connection draining: the deploy that nobody notices

When a backend is taken out — a deploy, a scale-down — its open connections and in-flight
requests are the difference between a clean rollout and a burst of errors:

1. The backend is marked **not ready**; the balancer stops sending *new* connections and
   requests to it.
2. In-flight requests finish; keep-alive connections are closed politely (a `Connection:
   close` on the next response, a GOAWAY on HTTP/2) so clients reconnect elsewhere.
3. After a **drain timeout** — long enough for the slowest legitimate request, short enough
   not to stall the deploy — remaining connections are cut.
4. Only then is the process stopped.

Skipping step 1 sends new requests to a process that is about to exit; skipping the timeout
resets long requests mid-flight; a drain timeout shorter than a long-poll or a WebSocket's life
turns every deploy into a reconnection storm (**06** *(not written yet)*). Rolling deploys of
[phase 1](../phase-1-the-method/14-evolution-and-operations.md) are this sequence, one backend at
a time.

## The balancer on the failure walk

The balancer is by construction a single entry point, so [phase 1's failure walk](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md)
has a row for it. Managed balancers are replicated across zones underneath a single address;
a self-run pair uses a floating address with failover; either way the sentence is "replicated by
the provider, or an active-passive pair with a floating address — and the state I keep out of it
is admission, which lives in a store". A layer-7 balancer additionally holds certificates and
routing configuration, which is deployed like code and can be wrong like code — a routing rule
that sends `/api/orders` to the catalogue service is an outage the health checks will not see.

## The storefront

A managed network balancer at the front — replicated, one address, no request parsing —
feeding the API gateway tier, which is the layer-7 balancer: terminates TLS, routes
`/api/catalogue` and `/api/orders` to their services, checks tokens, applies rate limits, and
retries idempotent `GET`s on another replica. Round robin to the stateless service replicas;
readiness checks that touch the database with a cheap query; a thirty-second drain on deploy.
No stickiness — sessions are a signed cookie or Redis, uploads go to object storage, and
nothing on a pod needs the same user back (**04** *(not written yet)*). The gRPC calls between
services, if any, go through a layer-7 proxy or client-side balancing, never a network balancer
alone, because one connection would carry everything.

## Gotchas

**★ Symptom: one pod hot behind a network balancer, the rest idle — gRPC or HTTP/2.** Cause:
layer 4 balances connections, and HTTP/2 carries every request on one. Fix: a layer-7 balancer
that distributes streams, or client-side balancing with several connections.

**★ Symptom: a deploy produces a burst of 502s.** Cause: no drain — new requests sent to a
stopping process, or in-flight ones cut. Fix: mark not-ready first, finish in-flight, close
keep-alives politely, a drain timeout longer than the slowest request, then stop.

**★ Symptom: the whole pool ejected at once when the database blipped.** Cause: a health check
that tests the dependency too aggressively, or passive checks reacting to legitimate 5xx. Fix:
a cheap check with thresholds, readiness separate from liveness, and knowledge of whether the
balancer fails open with no healthy backends.

**Symptom: sticky sessions requested "so the cache is warm".** Cause: state on the pod. Fix:
state in a store; if stickiness is still wanted for a cache, consistent hashing on the key, with
the failure named — a pod's death loses its pinned users.

**Symptom: all users behind a corporate NAT on one backend.** Cause: source-IP hashing. Fix:
cookie or header hashing at layer 7, or no stickiness at all.

**Symptom: least-connections chosen at layer 4 for HTTP/2 traffic.** Cause: connections
mistaken for load. Fix: layer 7, where per-request load is visible.

**Symptom: "the balancer is a single point of failure" with no answer.** Cause: the box named,
its redundancy not. Fix: provider-replicated across zones, or an active-passive pair with a
floating address; admission state kept outside it.

**Symptom: health check returns 200 while the database is unreachable.** Cause: it tests the
process, not a dependency. Fix: a cheap real query in the readiness check; liveness stays
process-only.

**Symptom: a routing rule sent the orders API to the wrong service and nothing alerted.** Cause:
layer-7 configuration treated as infrastructure rather than code. Fix: routing config reviewed,
versioned and canaried like a deploy; a synthetic check per route.

**Symptom: end-to-end TLS required by compliance, and a layer-7 balancer terminating it.**
Cause: the layers' TLS behaviour unknown. Fix: layer 4 passthrough with termination in the pod,
or layer 7 with re-encryption to the backend — and say which the requirement permits.

## Interview questions

**★ Layer 4 or layer 7 — how do you choose, and what does each cost?**
Layer 4 balances TCP connections without reading them: fast, protocol-agnostic, blind — no
routing on the request, no TLS termination, no retries, and it sees an HTTP/2 connection as one
unit of load however many requests it carries. Layer 7 terminates and parses each request: it
routes on path, host and headers, hashes on cookies, retries idempotent requests, and holds the
certificates — at the cost of parsing and TLS per request. Choose layer 4 for non-HTTP
protocols, interchangeable backends and raw throughput; layer 7 whenever the request decides
the destination. Most systems use both — a network balancer in front of a layer-7 gateway tier.

**★ Why is one backend hot behind a network balancer when the service uses gRPC?**
Because gRPC runs on HTTP/2, which RFC 9113 describes as allowing multiple concurrent exchanges
on the same connection — so a layer-4 balancer that assigned a client's single connection to one
backend assigned all of that client's requests to it. A few clients with long-lived connections
can pin most of the load to a few backends. The fix is a layer-7 proxy that balances streams,
or client-side balancing that opens connections to several backends.

**★ Walk through a zero-error deploy of one backend.**
Mark it not ready, so the balancer stops sending new connections and requests; let in-flight
requests finish; close keep-alive connections politely — `Connection: close` on the next
response, GOAWAY on HTTP/2 — so clients reconnect to other backends; wait a drain timeout longer
than the slowest legitimate request; stop the process; deploy; wait for readiness to pass;
return it to the pool. Repeat one backend at a time. Skipping the not-ready step or the drain
timeout is where the 502s come from.

**Which balancing algorithm would you use, and does it matter?**
Round robin for equal backends and requests; least connections when request durations vary,
so a slow backend is not fed at the same rate; weighted for a canary or mixed instance sizes;
power-of-two-choices for very large pools; consistent hashing when a key should land on the same
backend with minimal reshuffling. It matters less than candidates expect: the health check and
the drain decide whether deploys and failures are visible, and stickiness — the algorithm most
often asked for — is usually a sign that state is on the pod when it should be in a store.

**What is the difference between readiness and liveness, and why have both?**
Readiness says "send me traffic": false while starting, warming, or draining. Liveness says "I
am functioning": false only when the process should be restarted. A backend that is busy or
draining is alive but not ready; conflating the two either restarts healthy pods under load or
keeps sending traffic to pods that are shutting down. The readiness check touches a cheap real
dependency; the liveness check does not, so a dependency's outage does not restart the fleet.

**The balancer has no healthy backends. What happens?**
One of two things, and you must know which your balancer does: it returns errors for every
request — the honest failure — or it fails open and sends traffic to all backends regardless,
on the theory that a check that fails everywhere is more likely wrong than every backend. The
scenario usually comes from a health check that tests a shared dependency, so the design answer
is a cheaper check, thresholds, and readiness separated from liveness — and then the choice of
fail-open or fail-closed made deliberately.

---

← Prev: [01 · From the tap to the first byte](01-from-the-tap-to-the-first-byte.md) · Index: [Phase 2 — The request path](README.md) · Next → [03 · Reverse proxies and API gateways](03-reverse-proxies-and-api-gateways.md)
