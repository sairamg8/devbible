---
title: "A service mesh is a proxy deployed beside every service with the pod's traffic transparently redirected into it, plus a control plane off the request path that configures every proxy and issues each workload an identity — which moves the mechanical half of network resilience out of every language's code, and leaves behind, stubbornly, everything that requires knowing what a request means"
sidebar_label: "16 · Service mesh"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07 against the Istio documentation on
> [architecture](https://istio.io/latest/docs/ops/deployment/architecture/) — the data plane, what
> the sidecar proxies do, and the control plane, all verbatim below; the fetch returned real
> documentation content, not a navigation shell. The endpoint-set mechanism is the Kubernetes
> [Service](https://kubernetes.io/docs/concepts/services-networking/service/) documentation,
> quoted in full on [12](12-service-discovery.md). Traffic redirection into the sidecar, the
> control plane's failure behaviour and the division of labour between proxy and application are
> **common practice and mechanism**, stated as such: no vendor defaults, no version numbers, no
> benchmark figures, no measurements. **No sandbox run.**

**A service mesh is the decision to stop asking every service to implement the network correctly,
and to put a proxy next to each one instead.** Everything the last eight pages made an
application's responsibility — retry only idempotent things, with jitter, from a budget
([08](08-timeouts-retries-and-budgets.md)); balance per request, not per connection
([12](12-service-discovery.md)); encrypt inside the network too
([10](10-tls-termination-and-where-it-lives.md)); emit the same latency and error series as
everyone else — is code, and code is written once per language, kept in step across versions, and
remembered by every new service. A mesh moves that work into a proxy deployed beside each service
and configures every proxy from one control plane, so the policy is written once and enforced
identically whether the service is Node, Java or Go. That is the pitch, and it is a real one. This
page is the mechanism: what the sidecar intercepts, the two planes and what a control-plane outage
actually does, what genuinely moves out of application code and what does not, and why the mesh
consumes service discovery rather than replacing it. The rest of the topic is
[16b](16b-mesh-mtls-and-workload-identity.md) (mTLS and workload identity),
[16c](16c-mesh-retries-timeouts-and-circuit-breaking.md) (resilience policy),
[16d](16d-mesh-traffic-splitting-and-canaries.md) (splitting and canaries),
[16e](16e-what-a-service-mesh-costs.md) (the bill),
[16f](16f-north-south-and-east-west.md) (a gateway is not a mesh) and
[16g](16g-when-a-mesh-earns-its-cost.md) (whether you should).

## The sidecar, and what it intercepts

A sidecar is a second container in the same pod as the application, sharing the pod's network
namespace — so the two containers share one set of interfaces and one loopback. On injection, the
pod's traffic is *redirected* into the proxy: rules installed in the pod's own packet filtering (by
a short-lived init container) or an equivalent eBPF program send inbound connections to the proxy's
port rather than the application's, and capture the application's outbound connections before they
leave the pod. The application's socket code is unchanged and, crucially, unaware — it still dials
`http://inventory`, and something else makes the real connection.

> The *"data plane is composed of a set of intelligent proxies (Envoy) deployed as sidecars."* —
> *"These proxies mediate and control all network communication between microservices. They also
> collect and report telemetry on all mesh traffic."* — Istio, *Architecture*

"Mediate and control **all** network communication" is the load-bearing phrase, and it cuts both
ways: it is why the mesh can enforce anything, and why a mesh misconfiguration can break everything
a pod does on a socket.

**What the proxy can see.** The application-to-proxy leg is loopback, so the proxy holds the request
in plaintext and can parse it. For protocols it understands — HTTP/1.1, HTTP/2 and therefore gRPC
([11](11-http-1-1-http-2-and-http-3.md)) — it acts per *request*: method, path, headers, status
code, whether a response is retryable, how long it took. That per-request view is what every L7
feature is built from.

**What it cannot see.** A protocol it cannot parse degrades to plain TCP: you keep mutual TLS and
byte counts, and lose retries, per-request balancing and request-level metrics. A payload the
application itself encrypted is opaque. And business meaning is invisible — a `200 OK` carrying
`{"error": "insufficient stock"}` is a success to the proxy, which is why the mesh's success rate
is never your service-level indicator.

**The shape of a call.** Every service-to-service call now traverses four proxy legs, two of them
hops that did not exist before:

```text
orders (app) → orders' sidecar → [ mTLS over the network ] → inventory's sidecar → inventory (app)
   loopback         proxy out              the real hop            proxy in          loopback
```

The middle hop was always there. The two loopback legs and two proxy traversals are the mesh's
price, paid on every call in both directions — the first line of [16e](16e-what-a-service-mesh-costs.md)'s
ledger.

## Data plane and control plane

| | Data plane | Control plane |
|---|---|---|
| What it is | the proxies themselves, one per workload | a service, usually a few replicas, that configures them |
| Where it sits | **on** the request path, in every pod | **off** the request path |
| What it does | terminates and originates mTLS, balances, retries, times out, ejects bad endpoints, counts everything | turns routing and policy objects into proxy configuration and pushes it; issues and rotates workload certificates; aggregates the platform's endpoint sets |
| Its failure | that pod's traffic stops | no request fails immediately — see below |
| Scales with | pods | services, endpoints, and the rate of change |

> *"The control plane manages and configures the proxies to route traffic."* — *"Istiod converts
> high level routing rules that control traffic behavior into Envoy-specific configurations, and
> propagates them to the sidecars at runtime."* — Istio, *Architecture*

The design intent is that a control-plane outage is survivable, because the proxies keep serving on
their last-known configuration. That is true, and it is not the whole answer — four things degrade
on a clock, and the fourth ends the incident badly:

1. **New pods cannot start serving.** They get no configuration and no certificate, so they never
   pass readiness — a deploy, a scale-up or a node replacement during the outage quietly stops
   working.
2. **Endpoint changes stop propagating.** Proxies keep the endpoint list they had, so they keep
   sending to pods that are gone; retries and outlier ejection are what carries you.
3. **Policy changes are impossible.** You cannot shed, split or reroute your way out of the
   incident, which is exactly when you want to.
4. **Certificates stop rotating.** Workload certificates are deliberately short-lived; with no
   issuer to renew them, they expire, and when they do, mutual TLS fails everywhere at once.
   **The certificate lifetime is the deadline for restoring the control plane** — an operational
   number worth knowing before you need it, and a box on the failure walk of
   [phase 1](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md).

## What moves out of the application — and what stubbornly does not

| Moves into the mesh | Why it moves cleanly |
|---|---|
| **Mutual TLS and certificate rotation** | pure transport; nothing in the request needs to know ([16b](16b-mesh-mtls-and-workload-identity.md)) |
| **Per-request L7 balancing, with locality preference** | the proxy has the endpoint set and sees every request boundary |
| **Retries on transport failures and named status codes** | mechanical, and uniform across languages ([16c](16c-mesh-retries-timeouts-and-circuit-breaking.md)) |
| **Per-route timeouts and per-upstream concurrency caps** | a ceiling and a bulkhead, expressed as configuration |
| **Outlier ejection** | the proxy already counts failures per endpoint |
| **Request metrics and access logs with identical labels everywhere** | one emitter, one schema, every language |
| **Coarse authorization: identity A may call identity B, this method, this path prefix** | a property of the connection and the request line |
| **Traffic shifting, header routing and mirroring** | routing is the proxy's job by definition ([16d](16d-mesh-traffic-splitting-and-canaries.md)) |

And the list that matters more, because it is the one people are surprised by:

| Stays in the application | Why the proxy cannot do it |
|---|---|
| **Trace context propagation** | a sidecar can *emit* a span for a hop, but cannot know that the outbound call your service is making belongs to the inbound request it just received. Only your code can copy the trace headers from in to out. Without that you get one disconnected span per hop and no trace. |
| **Deadline propagation** | a mesh timeout is a fixed number per route; [08](08-timeouts-retries-and-budgets.md)'s deadline is the *remaining* budget, computed per request and shrinking. The proxy has no idea how much is left. |
| **Knowing which retries are safe** | only the application knows whether this `POST` carries an idempotency key ([phase 1's API sketch](../phase-1-the-method/05-the-api-sketch.md)). |
| **The retry budget across the whole path** | the mesh bounds one hop's proxy; client, gateway and mesh together are still a multiplication. |
| **Business errors and partial success** | "insufficient stock", an empty result, a wrong price — all `200` to the proxy. |
| **User-level authorization** | the mesh authorizes *workloads*. "Buyer 42 may read order 7" is yours, forever. |
| **Caching semantics** | cache keys, `Vary`, invalidation and staleness ([05](05-cdns.md)) are application decisions. |
| **Load shedding by cost** | the proxy caps concurrent requests by count; it cannot know that one of them is a report over a year of orders. |
| **The database client** | pool sizing, transaction discipline, and not holding a connection across a slow call ([14](14-connection-pooling-and-keep-alive.md)) — and the database is usually outside the mesh entirely. |
| **Graceful shutdown** | stop accepting, finish in flight, then exit ([02](02-load-balancing-layer-4-vs-layer-7.md)). |

Read the second table as the answer to "so the mesh does resilience for us": it does the mechanical
half, and the half that requires knowing what a request *means* is still yours.

## The mesh does not replace discovery — it consumes it

The Service is still a Service and cluster DNS still resolves the name. What changes is *who
chooses*: the control plane watches the platform's endpoint sets — Kubernetes *"updates the
EndpointSlices for a Service whenever the set of Pods in a Service changes"*, quoted in full on
[12](12-service-discovery.md) — and pushes the resulting endpoint list into every proxy that calls
that service. The sidecar then picks an endpoint **per request**, and can prefer endpoints in its
own zone, spilling over when they are unhealthy.

Two consequences. First, this is the fix for [12](12-service-discovery.md)'s gRPC hot-pod problem —
one long-lived HTTP/2 connection pinning a caller to one pod — without a balancing library in every
language, and zone preference is a cost lever as much as a latency one
([phase 1 on cost](../phase-1-the-method/13-designing-for-cost.md)). Second, discovery staleness
does not disappear; it *moves*. The proxy's list is exactly as fresh as the control plane's watch,
so [12](12-service-discovery.md)'s disciplines still apply — the mesh has centralised them, not
abolished them. Kubernetes' own mechanics are
[Part 7 of the syllabus](../../syllabus/07-cloud-kubernetes-and-iac.md).

## The storefront

```text
what gets intercepted    gateway→catalogue, gateway→orders, orders→inventory, orders→cart: every internal
                         HTTP and gRPC hop, captured at both ends without a line of service code changing
what is parsed as L7     all of it — the services speak HTTP/1.1 and one gRPC hop, so the proxies see method,
                         path, status and can act per request
what degrades to L4      PostgreSQL and Redis, if they are put in the mesh at all: mTLS and byte counts, no
                         request-level anything. In practice they stay outside it
what the app still does  copies the trace headers from inbound to outbound; computes and passes the remaining
                         deadline; holds the idempotency key; decides that "insufficient stock" is an error
                         even though it is a 200; sizes the PostgreSQL pool; drains on shutdown
discovery                unchanged — the catalogue, orders and inventory Services still exist; the control
                         plane reads their endpoint sets and the sidecars balance per request across them
control plane down       the storefront keeps serving; new pods do not start, endpoint changes freeze, and the
                         certificate lifetime is the clock on the whole thing
```

The "what the app still does" row is the one to memorise: six responsibilities the mesh does not
take, on a page about what the mesh takes.

## Gotchas

**★ Symptom: every service emits spans and none of them join into a trace.** Cause: a sidecar can
emit a span for the hop it handled, but cannot know which inbound request caused the outbound call
your service made — only your code can copy the trace headers across. Fix: propagate trace context
in every service, with an SDK or middleware. This is application work the mesh does not remove, and
it is the most common disappointment of a mesh bought for observability.

**★ Symptom: the mesh dashboard shows near-perfect success while customers report failures.**
Cause: the proxy sees HTTP status; a `200` carrying an error body, an empty result or a wrong price
is a success to it. Fix: application-level SLIs alongside the mesh's — the mesh's success rate is a
transport signal, not a product one
([Part 8 of the syllabus](../../syllabus/08-reliability-and-observability.md)).

**★ Symptom: the control plane was down for hours and then the whole mesh failed at once.** Cause:
short-lived workload certificates expiring with no issuer to renew them — the outage's fourth stage,
after new pods stop starting, endpoint updates freeze and policy changes become impossible. Fix:
know your certificate lifetime, because it is the deadline for restoring the control plane; make
control-plane availability and its restore procedure a first-class operational concern rather than
an assumption.

**Symptom: a non-HTTP dependency in the mesh lost its per-request metrics and retries.** Cause: the
proxy could not parse the protocol and fell back to plain TCP, which keeps mTLS and byte counts and
nothing else. Fix: expect L4-only behaviour for opaque streams, declare the port's protocol wherever
the mesh lets you, and do not plan request-level policy for protocols the proxy cannot read.

**Symptom: the mesh changed nothing about the database's connection problems.** Cause: the data
layer is usually outside the mesh, and pool sizing and transaction discipline are application
concerns regardless. Fix: [14](14-connection-pooling-and-keep-alive.md) still applies in full — a
mesh does not size a pool or shorten a transaction.

**Symptom: one service's calls ignore every routing rule written for it.** Cause: it dials a pod IP
or an address directly rather than the Service name, so the traffic is captured but matches no
route; or the pod runs on the host network and was never in the mesh at all. Fix: call services by
their Service name, and check that every workload you believe is meshed actually has a proxy — the
absence is silent, because everything keeps working.

**Symptom: every request now appears to come from the same local address, and per-IP logic in the
service stopped working.** Cause: the application's peer is its own sidecar over loopback, not the
original caller, so anything keyed on the remote address — an audit log, a per-IP counter, an
allowlist — sees the proxy. Fix: read the forwarded client address from the headers the edge and
the proxies set, exactly as behind any reverse proxy
([03](03-reverse-proxies-and-api-gateways.md)), and move per-IP decisions to the gateway where the
real client address exists ([07](07-rate-limiting.md)).

**Symptom: a team spent a week debugging a socket problem that turned out to be the redirect
rules.** Cause: "the application is unaware" is the mesh's design goal and its debugging cost —
every network symptom now has a second possible cause the application cannot see. Fix: make "is
this pod meshed, and what did its proxy log?" the first question of any network incident
([16e](16e-what-a-service-mesh-costs.md)), not the last.

## Interview questions

**★ What is a service mesh, and what is the sidecar actually doing?**
A proxy deployed beside every service — in the same pod, sharing its network namespace — with the
pod's traffic transparently redirected into it, so inbound connections reach the proxy before the
application and outbound connections leave through the proxy. Istio's documentation puts it as
proxies that *"mediate and control all network communication between microservices"* and *"collect
and report telemetry on all mesh traffic"*. Those proxies are the data plane, on the request path; a
control plane off the request path configures them and issues their identities. Because the
application-to-proxy leg is loopback, the proxy holds the request in plaintext and can act per
request for protocols it understands — HTTP/1.1, HTTP/2 and gRPC — and degrades to plain TCP for
anything else. The application's code does not change, which is both the appeal and the reason a
mesh misconfiguration can break everything a pod does on a socket.

**★ What moves out of application code when a mesh arrives, and what does not?**
Out: mutual TLS and certificate rotation, per-request balancing with zone preference, retries on
transport failures and named status codes, per-route timeouts, per-upstream concurrency caps,
outlier ejection, uniform request metrics and access logs, coarse workload-to-workload
authorization, and traffic shifting. What stubbornly stays: trace context propagation, because only
the application knows which inbound request caused an outbound call; deadline propagation, because a
mesh timeout is a fixed number per route rather than the remaining budget; knowing which retries are
safe, because the idempotency key is the application's; the retry budget across the whole path;
business errors, since a `200` with an error body is a success to the proxy; user-level
authorization; caching semantics; shedding by cost rather than count; the database client's pooling
and transaction discipline; and graceful shutdown. The mesh does the mechanical half of resilience
and leaves the half that requires knowing what a request means.

**★ The control plane goes down. What happens?**
Nothing fails at that instant, which is the design intent: the proxies keep serving on their
last-known configuration. Then four things degrade. New pods get no configuration and no
certificate, so they never pass readiness and deploys, scale-ups and node replacements stop working.
Endpoint updates stop propagating, so proxies keep sending to pods that are gone and retries and
outlier ejection carry the difference. Policy changes become impossible, exactly when you want to
shed or reroute. And certificates stop rotating — they are deliberately short-lived, so when they
expire, mutual TLS fails everywhere at once. The certificate lifetime is therefore the deadline for
restoring the control plane, and knowing that number is part of putting the mesh on the failure
walk.

**Which protocols does a mesh actually help with, and what happens to the ones it cannot parse?**
It helps most with HTTP/1.1, HTTP/2 and therefore gRPC, because the proxy can find request
boundaries: that is what makes per-request balancing, retries on a status code, per-route timeouts,
request-level metrics and path-based authorization possible at all. Anything it cannot parse — a
database wire protocol, a custom binary stream, an application-encrypted payload — degrades to plain
TCP, where you still get mutual TLS, connection-level authorization and byte counts, and lose
everything request-shaped. That matters when planning: a design that assumes the mesh will retry or
balance calls to a non-HTTP dependency is assuming a capability that does not exist for that
protocol. Most meshes let you declare a port's protocol, and getting that declaration wrong is a
quiet way to lose L7 behaviour you thought you had.

**Does a mesh replace service discovery?**
No — it consumes it. The Service still exists and cluster DNS still resolves the name; the control
plane watches the platform's endpoint sets, which Kubernetes updates whenever the set of pods
changes, and pushes the endpoint list into every proxy that calls that service. What changes is who
chooses: instead of the platform's virtual address spreading *connections*, the sidecar holds the
whole list and picks per *request*, with zone preference. That is exactly the fix for the gRPC
hot-pod problem — one long-lived HTTP/2 connection pinning a caller to one pod — without a balancing
library in every language. What does not change is staleness: the proxy's list is only as fresh as
the control plane's watch, so discovery's disciplines are centralised, not abolished.

← Prev: [15 · The path in the storefront](15-the-path-in-the-storefront.md) · Index: [Phase 2 — The request path](README.md) · Next → [16b · Mesh mTLS and workload identity](16b-mesh-mtls-and-workload-identity.md)
