---
title: "Service discovery answers \"where is the inventory service right now\" for callers whose targets are ephemeral — by a DNS name, by a registry the instances heartbeat into, or by a platform's stable virtual address in front of a changing set of pods — and the second question is whether the caller or a proxy does the choosing"
sidebar_label: "12 · Service discovery"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Kubernetes documentation on
> [Services](https://kubernetes.io/docs/concepts/services-networking/service/) — the definition,
> *"Pods are ephemeral resources"*, and the EndpointSlices sentence — verbatim below. Cluster
> DNS naming and ClusterIP as the default type are described from that documentation without
> quoting (the fetch did not return those sentences). Registry-based discovery, heartbeats and
> client-side balancing are common practice, stated as such. The Java-side implementation is
> the [Java track's microservice phase](../../../java/pages/phase-14-microservice-architecture/README.md).
> **No sandbox run.**

**Inside the platform, a service is not an address — it is a changing set of instances, each
with an address that lasts as long as the instance does, which on an orchestrator is minutes to
days and during a deploy is seconds.** A caller that hard-codes an address is wrong within the
hour; a caller that resolves a name once at startup is wrong at the first deploy. Service
discovery is the mechanism that keeps callers pointed at live instances, and it comes in three
shapes: **DNS-based**, where the name resolves to the current instances and the caller's own
TTL discipline decides freshness; **registry-based**, where instances register themselves and
heartbeat, and callers query the registry; and **platform-based**, where the orchestrator
maintains a stable virtual address and the endpoint set behind it, so callers use one name and
never see the churn. Behind any of the three sits the second question — who chooses among the
instances: the caller, which knows its own load and can retry elsewhere, or a proxy, which is
simpler for the caller and sees the whole picture. This page is the three mechanisms with
their failure modes, client-side against server-side balancing, the health of an entry and the
staleness every mechanism has, and the storefront's choice.

## The premise, from the platform

> A Service is *"a method for exposing a network application that is running as one or more
> Pods in your cluster."* — *"Pods are ephemeral resources (you should not expect that an
> individual Pod is reliable and durable)"* … *"how do the frontends find out and keep track of
> which IP address to connect to"* — Kubernetes, *Service*

That is the whole problem statement: the backends' addresses change, and the frontends must
find and keep finding them. The platform's answer is to maintain the set on the callers' behalf:

> *"Kubernetes updates the EndpointSlices for a Service whenever the set of Pods in a Service
> changes"* — Kubernetes, *Service*

So the caller addresses the Service, and the platform keeps the Service's endpoint set current
as pods start, pass readiness, fail, and stop.

## The three mechanisms

| | DNS-based | Registry-based | Platform-based (Kubernetes Service) |
|---|---|---|---|
| The caller asks | a resolver, for `inventory.internal` | a registry (Consul, Eureka, ZooKeeper-style), for "inventory" | nothing new — it uses the Service's stable name and virtual address |
| Who maintains the set | whatever writes the records — the platform, a registrar sidecar, a script | the instances themselves: register on start, heartbeat, deregister on stop; the registry expires the silent | the orchestrator, from pod lifecycle and readiness |
| Freshness | the TTL, and the caller's DNS cache discipline | the heartbeat interval and expiry; the caller's cache of the registry's answer | readiness-driven; the endpoint set changes within seconds of a pod's state |
| Failure of the mechanism | resolver down → cached names keep working until TTL, then nothing | registry down → callers keep their last answer; new instances cannot register | cluster DNS or the control plane down → existing connections work; new resolutions may fail |
| Balancing | the caller picks among the returned addresses, or the resolver rotates them | the caller picks (client-side), with the registry's metadata (zone, weight, health) | the platform's virtual address spreads new connections across endpoints; or a proxy/mesh does it |
| Health | none in DNS itself — entries are as fresh as whoever writes them | heartbeat-based; a stalled instance that still heartbeats stays listed | readiness probes — the pod says whether it can serve |
| Best for | simple environments; cross-platform names; anything that speaks only DNS | rich metadata and client-side decisions; multi-platform fleets | inside one cluster — the default, with the least to build |

The default inside a cluster is the platform's Service: a stable name resolved by the cluster's
DNS to a virtual address (the ClusterIP type, the default), behind which the endpoint set is
kept current from readiness. A caller writes `http://inventory` and never learns a pod address.
Registries earn their place when callers need metadata — zone, version, weight — to make their
own choice, or when the fleet spans platforms; plain DNS is what you use when the caller is
something that only speaks DNS.

## The staleness every mechanism has

No mechanism is instantaneous, and the design has to say what a caller does with a stale
answer:

- **DNS** — the record changed; the caller cached it. The runtime trap of
  [09](09-dns-as-a-component.md): a client that resolved once at startup never sees the change.
  The fix is re-resolving on new connections, bounded by the TTL, and a connection pool that
  retires connections so re-resolution happens (**14 · Connection pooling** *(not written yet)*).
- **Registry** — an instance died without deregistering; it stays listed until the heartbeat
  expires (seconds to tens of seconds). Callers hit it, fail, and must *try another* — which is
  the argument for client-side retry across instances.
- **Platform** — a pod failed readiness; the endpoint set updates within seconds, but
  connections already open to that pod stay open. Existing connections are not rerouted by any
  discovery mechanism; they are closed by the pod's drain
  ([02](02-load-balancing-layer-4-vs-layer-7.md)).

So every caller needs the same three behaviours regardless of mechanism: refresh the answer,
retry an idempotent call on a different instance when one fails, and let connections expire
so that refreshed answers take effect. Discovery gives the list; the caller's discipline makes
it useful.

## Client-side against server-side balancing

Once the caller has the list, someone chooses an instance per connection or per request:

| | Client-side | Server-side (a proxy, the platform's virtual address, a mesh sidecar) |
|---|---|---|
| Who chooses | the caller, from the discovered list | a proxy the caller sends everything to |
| The caller knows | the instances, their zones and health; it can prefer its own zone, retry on another instance, hedge slow calls | one address |
| The caller must implement | discovery refresh, the algorithm, health tracking, retries — in every language the fleet uses | nothing beyond an HTTP client |
| Extra hop | none — direct to the instance | one, through the proxy (sub-millisecond in-region; zero with a sidecar on the same host) |
| Consistency of policy | per client library — five languages, five behaviours | one place — the proxy's configuration |
| Sees the whole picture | no — each caller sees its own connections | yes — a proxy sees all callers' load |
| The failure it adds | a bug in the client library is in every service | the proxy is a box on the failure walk |

The historical answer in Java shops was client-side — a discovery client and a balancing
library in every service, which is the shape the [Java track's microservice phase](../../../java/pages/phase-14-microservice-architecture/README.md)
implements — and its cost is the library in every service in every language. The platform's
answer is server-side by default — the Service's virtual address — with a mesh sidecar
(**16 · Service mesh** *(not written yet)*) when zone-awareness, retries and mutual TLS are
wanted without a client library. The trade-off sentence: *"client-side gives the caller
zone-preference and retry-elsewhere at the cost of a library per language; server-side gives
one policy point at the cost of a hop and a box — and the sidecar is the way to have both."*

The one case that stays client-side by nature is gRPC or HTTP/2 to a Service's virtual
address: the caller opens one long-lived connection to one pod and every request goes there
([02](02-load-balancing-layer-4-vs-layer-7.md)'s hot-pod problem), so either the client
balances across the endpoint set itself — resolving to pod addresses rather than the virtual
one — or a layer-7 proxy distributes streams.

## Health: who says an instance is alive

Discovery lists instances; something must say which are *serving*:

- **Readiness, platform-driven** — the pod reports ready when it can serve; the endpoint set
  includes only ready pods. The cheapest and most accurate, because the instance decides.
- **Heartbeat, registry-driven** — the instance says "still here" every few seconds; silence
  past a threshold removes it. Detects death, not sickness: an instance that is deadlocked but
  heartbeating stays listed. Pair it with the caller's own error tracking.
- **Caller-observed** — the caller tracks failures per instance and stops sending to one that
  fails, for a cooling period (the per-instance circuit breaker of [08](08-timeouts-retries-and-budgets.md)).
  This is the layer that catches what readiness and heartbeats miss, and it is why client-side
  balancing keeps a health table.

The design says which two of the three it uses; one alone is not enough — readiness misses a
pod that passes its probe and fails real requests, heartbeats miss sickness, and
caller-observed health alone is slow to learn about new instances.

## The storefront

Inside the cluster, every service is a Kubernetes Service with a stable name — `catalogue`,
`cart`, `orders`, `inventory`, `payment-adapter` — resolved by cluster DNS; readiness probes
gate the endpoint sets; the Node services' HTTP clients re-resolve per new connection and keep
pools that retire connections after a few minutes so drained pods fall out. Service-to-service
calls are HTTP/1.1 from pools, so the virtual address's per-connection spread is adequate; the
one gRPC call — orders to inventory on the hot path — resolves to pod endpoints and balances
client-side, or goes through the mesh sidecar once the mesh is adopted. The payment provider
and the email gateway are external names resolved through public DNS with the TTL honoured.
No registry: the platform's discovery is enough at this size, and a registry would be a second
source of truth to keep in sync.

## Gotchas

**★ Symptom: after a deploy, calls go to pods that no longer exist.** Cause: the caller
resolved once at startup, or holds connections to drained pods. Fix: re-resolve per new
connection, bound the client's DNS cache to the TTL, retire pooled connections after minutes;
rely on readiness to update the endpoint set.

**★ Symptom: one inventory pod takes all the orders service's gRPC traffic.** Cause: HTTP/2 to
the Service's virtual address — one connection, one pod. Fix: client-side balancing across pod
endpoints, or a layer-7 proxy or sidecar distributing streams.

**★ Symptom: a deadlocked instance stays in the registry and callers keep failing on it.**
Cause: heartbeat-based health detects death, not sickness. Fix: caller-observed health — a
per-instance breaker — alongside readiness or heartbeats.

**Symptom: discovery logic differs between the Node and Java services.** Cause: client-side
balancing with a library per language. Fix: server-side — the platform's Service, or a sidecar
— so the policy is in one place.

**Symptom: the registry went down and no new instance could join during an incident.** Cause:
a registry as a single source of truth with no platform fallback. Fix: the platform's own
discovery as the base; a registry only for metadata it adds.

**Symptom: readiness passes but real requests fail.** Cause: the probe tests less than a
request needs. Fix: a probe that touches the real dependency cheaply
([02](02-load-balancing-layer-4-vs-layer-7.md)), plus caller-observed health.

**Symptom: cross-zone traffic bills from service-to-service calls.** Cause: the virtual
address spreads connections across zones. Fix: zone-aware routing — client-side preference, or
a sidecar with locality, or the platform's topology-aware routing where available.

**Symptom: an external dependency's failover missed because our client pinned its address.**
Cause: resolution at startup for external names too. Fix: the same re-resolve rule for
external DNS, with the provider's TTL.

**Symptom: "we'll add a service registry" for a five-service system in one cluster.** Cause:
a mechanism chosen from a diagram rather than a need. Fix: the platform's Service is discovery;
add a registry when callers need metadata the platform cannot express.

## Interview questions

**★ How does a service find another service inside the cluster, and what keeps it current?**
By a stable name — a Kubernetes Service — resolved by cluster DNS to a virtual address, behind
which the platform maintains the set of ready pod endpoints; the documentation says it updates
the EndpointSlices whenever the set of pods changes, and pods are explicitly ephemeral. The
caller writes the name and never learns a pod address. What keeps it current is readiness
probes on the platform side and, on the caller's side, re-resolving per new connection and
retiring pooled connections, because no discovery mechanism reroutes a connection that is
already open.

**★ Client-side or server-side balancing — what is the trade?**
Client-side: the caller holds the discovered list and chooses per call, so it can prefer its
own zone, retry an idempotent call on another instance and hedge slow ones — at the cost of
discovery, balancing and health logic in a library for every language in the fleet, and a bug
in that library everywhere. Server-side: the caller sends everything to one address — the
platform's virtual address or a proxy — and gets one policy point at the cost of a hop and a
box on the failure walk. A sidecar gives client-side behaviour without the library, which is
the mesh's argument.

**★ What are the three mechanisms, and how does each go stale?**
DNS-based — the name resolves to the current instances, and stale means the caller's cache
outlived a change; fixed by re-resolving with the TTL. Registry-based — instances register and
heartbeat, and stale means an instance died without deregistering and stays listed until its
heartbeat expires; fixed by callers retrying on another instance. Platform-based — the
orchestrator maintains the endpoint set from readiness, and stale means connections already
open to a pod that just failed readiness; fixed by the pod's drain closing them. Every caller
needs the same discipline: refresh, retry elsewhere, let connections expire.

**Why does gRPC need special handling with a Kubernetes Service?**
Because gRPC runs on HTTP/2, which multiplexes every request on one long-lived connection, and
the Service's virtual address balances connections, not requests: the caller opens one
connection to one pod and every call goes there. The fix is client-side balancing that resolves
to the individual pod endpoints and spreads streams across them, or a layer-7 proxy or sidecar
that distributes streams — the same hot-pod problem as a network balancer in front of HTTP/2.

**What does "healthy" mean in discovery, and why is one signal not enough?**
Three signals with three blind spots: readiness, where the pod says it can serve, misses a
probe that tests less than a real request; a registry heartbeat detects death but not sickness,
so a deadlocked instance stays listed; caller-observed health — a per-instance breaker on
failures — catches both but learns about new instances slowly. A design uses at least two:
readiness or heartbeats for the list, caller-observed health for what the list gets wrong.

**When would you add a registry on top of the platform's discovery?**
When callers need metadata the platform cannot express in an endpoint set — version, weight,
custom health, cross-cluster or cross-platform membership — and make their own choices from it,
or when the fleet spans environments that share no orchestrator. Not for a handful of services
in one cluster: the platform's Service is discovery, and a registry there is a second source of
truth to keep consistent and a second thing to fail.

---

← Prev: [11 · HTTP/1.1, HTTP/2 and HTTP/3](11-http-1-1-http-2-and-http-3.md) · Index: [Phase 2 — The request path](README.md) · Next → [13 · Serialization on the wire](13-serialization-on-the-wire.md)
