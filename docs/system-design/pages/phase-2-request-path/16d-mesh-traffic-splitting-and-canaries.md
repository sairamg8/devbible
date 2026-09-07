---
title: "Traffic splitting decouples the canary percentage from the replica count and makes a rollback a configuration push rather than a deploy — but a weighted split decides per request so one shopper sees both versions, a mirrored request is a real request that places a real order, and neither makes a schema migration safe because a split runs both versions against one database by design"
sidebar_label: "16d · Mesh splitting and canaries"
sidebar_position: 16.3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. **Method and common practice** — weighted splitting, subset routing by
> label, header and identity routing, and request mirroring are described as meshes and layer-7
> proxies generally implement them, with no vendor defaults, no version numbers, no benchmark
> figures and no measurements. The expand–migrate–contract constraint is
> [phase 1's evolution page](../phase-1-the-method/14-evolution-and-operations.md); the
> connection-lifetime behaviour that makes a rollback gradual is
> [14](14-connection-pooling-and-keep-alive.md) and [11](11-http-1-1-http-2-and-http-3.md). The
> sidecar mechanism is [16](16-service-mesh.md); resilience policy is
> [16c](16c-mesh-retries-timeouts-and-circuit-breaking.md). **No sandbox run.**

**The feature that sells a mesh to a delivery team is that "send one percent of traffic to the new
version" stops being a function of how many pods you run, and that rolling it back is a
configuration push rather than a redeploy.** Both of those are true and both are worth real money.
What the demo does not show is that a weighted split decides *per request*, so a shopper alternates
between versions inside one session; that mirroring copies requests including their side effects,
so a shadow of the checkout places orders and spends the payment provider's quota; and that a split
guarantees the thing a careful release tries to avoid — two versions running against one database
at the same time. This page is the three mechanisms, the four things splitting cannot make safe,
and how to canary a write path.

## Three different things, all called "canary"

| | What it does | What it is for | Where it bites |
|---|---|---|---|
| **Weighted split** | *n* % of requests for a service go to the v2 subset | a canary whose percentage is independent of replica counts — 1 % does not require a hundred pods | it decides per *request*, so one user sees both versions |
| **Header or identity routing** | requests carrying a header, or coming from a named caller, go to v2 | a zero-blast-radius canary for internal users, a test account, or one calling team | it only tests traffic you can label |
| **Mirroring (shadow)** | a copy of the request goes to v2; v2's response is discarded | exercising a new version against real traffic shapes before it serves anyone | **the copy is a real request with real side effects** |

The three compose: header-route to internal accounts first, then a weighted split for strangers,
with mirroring used earlier and only on reads.

## Weighted split: a percentage that is not a replica ratio

The pre-mesh canary is a replica ratio — deploy one pod of the new version alongside nineteen old
ones and the balancer's round robin gives you five percent
([02](02-load-balancing-layer-4-vs-layer-7.md)). It works, and it has two limits: the granularity
is `1/replicas`, so one percent needs a hundred pods; and changing the percentage means changing
replica counts, which is a scaling operation with its own timing and its own connection churn.

A mesh split is a routing weight over labelled *subsets* of the same service's endpoints, so the
percentage and the capacity are independent knobs. Three practicalities:

- **The subsets are label selectors, and a selector that matches nothing is a routing hole.** Point
  ten percent at a subset with no ready endpoints and ten percent of requests fail at the sidecar
  with no healthy upstream — a failure that looks nothing like a bad release and everything like
  [16e](16e-what-a-service-mesh-costs.md)'s "503 that never reached the service".
- **The weight is applied per request**, so with keep-alive and HTTP/2 the *connection* is not
  pinned to a version — which is the good case, since a pinned connection would make the
  percentage meaningless for a small number of long-lived callers
  ([11](11-http-1-1-http-2-and-http-3.md)).
- **A rollback to weight zero stops new requests, not in-flight ones**, and any behaviour the v2
  pods have already started — a background job, an outbox row, a write to a new column — has
  already happened. Rollback is fast, not retroactive.

## Header and identity routing: the canary with no blast radius

Route on something that identifies who is asking: a header your own app sets for staff accounts,
the caller's workload identity ([16b](16b-mesh-mtls-and-workload-identity.md)), a test account's
user ID. Nobody outside that set can be affected, which makes it the correct *first* stage for
anything that writes.

Its limits are real. It only exercises the traffic you can label, so it will not find the
performance cliff that only shows up under production volume, and it does not test the mix of
requests strangers actually send. It also needs the header to survive every hop — which means the
services must forward it, exactly like the trace context of [16](16-service-mesh.md), and a service
that drops unknown headers silently ends the canary two hops in.

## Mirroring: the copy is a real request

Mirroring sends a duplicate of a live request to the new version and discards the response, so the
caller's latency and correctness are untouched. It is the only mechanism that tests the new version
against the real request mix with zero risk *to the caller* — and the risk it does carry is all
downstream:

- **Side effects happen twice.** A mirrored `POST /orders` places a second order. A mirrored
  payment call spends the provider's quota, and the provider has no idea it is a shadow.
- **Load happens twice.** Even for pure reads, the mirrored version queries the same database and
  fills the same cache. Mirroring the catalogue doubles catalogue read load on a store that was
  sized for single load ([phase 1's load walk](../phase-1-the-method/11b-the-load-walk-and-the-price-of-redundancy.md)).
- **Rate limits count it.** Every downstream limiter, internal or external, sees the mirrored
  request as a request ([07](07-rate-limiting.md)).

Three fixes, in order of preference: mirror **reads only**; or give the mirrored version an
isolated data store and isolated external credentials so its writes go nowhere real; or mirror a
sampled fraction of traffic rather than all of it, so the doubling is bounded. Whichever you pick,
work out what the mirrored volume does to every downstream *before* turning it on, not from the
alerts afterwards.

## What splitting cannot make safe

1. **A schema migration.** A split runs both versions simultaneously *by design*, so the schema
   must be compatible with both at once — expand, migrate, contract, exactly as in
   [phase 1's evolution page](../phase-1-the-method/14-evolution-and-operations.md). A split does
   not let you avoid a breaking migration; it guarantees you run one against live traffic.
2. **A shared downstream.** If v2 makes two calls to inventory where v1 made one, a ten percent
   canary is a ten percent load increase on inventory that nobody planned.
3. **A release nobody watches.** A split with no per-version success-rate and latency comparison is
   not a canary, it is a slower rollout. The sidecars already emit those series labelled by
   destination version ([16](16-service-mesh.md)); the canary is the *comparison*, and the rollback
   condition should be written down before the weight is raised.
4. **A write path, by weight.** Splitting writes across two versions means two code paths writing
   the same rows in the same minutes, and a bug in v2 is a bug in real orders that v1 will later
   read. Canary a write path by *header* first, to accounts you control, and only then by weight —
   and keep the weight small enough that the damage is a support ticket rather than a reconciliation
   project.

## North-south splits belong to the gateway

Splitting inside the mesh is *east-west*: which version of `inventory` does `orders` reach. Deciding
that *this browser session* sees the new checkout is *north-south* — it is about a user, it needs to
be sticky for that user's whole session, and it is decided at the gateway
([03](03-reverse-proxies-and-api-gateways.md)) or the CDN ([05](05-cdns.md)), where the user's
cookie and identity live. Doing user-facing A/B at the mesh layer means every internal service has
to carry the user's bucket in a header for the routing to stay consistent, which is the trace-header
problem again. The distinction is [16f](16f-north-south-and-east-west.md)'s subject in full.

## The storefront

```text
catalogue v2          10 % by weight, hashed on the session cookie so a shopper does not flicker between
                      versions mid-visit; compared against v1 on success rate and p99 per version
checkout v2           NOT split by weight first: header-routed to internal staff accounts, then 1 % by weight
                      once the orders written by v2 have been read back and reconciled
mirroring             catalogue reads only, sampled, with the doubled read load costed against the replica and
                      the Redis cache before it is enabled — never POST /orders, never the payment adapter
subsets               version labels on the deployment; a subset selector that matches no ready pod sends its
                      share of traffic to a sidecar 503, which reads like an outage rather than a bad release
schema                expand-migrate-contract on the orders table, because the split means v1 and v2 write it
                      in the same minutes by design
rollback              weight 0 — a config push, not a deploy; but the orders v2 already wrote stay written, and
                      the outbox rows it produced are already in flight
user-facing A/B       at the gateway, sticky on the session, not in the mesh — the mesh splits service to
                      service, the gateway splits user to system
```

The rollback row is the honest one: a mesh makes stopping the bleeding fast, and makes nothing
retroactive.

## Gotchas

**★ Symptom: mirrored traffic placed duplicate orders and burned the payment provider's quota.**
Cause: mirroring copies real requests, side effects included, and the provider cannot tell a shadow
from a customer. Fix: mirror reads only, or give the mirrored version an isolated data store and
isolated external credentials; sample rather than mirroring everything; and count the mirrored
volume against every downstream limit before enabling it.

**★ Symptom: a shopper's session flickers between the old and the new checkout.** Cause: weighted
splitting decides per request, not per session. Fix: hash on a stable user or session header so one
user stays on one side for the whole visit, or keep the versions compatible enough that alternating
is invisible.

**★ Symptom: the canary "passed" and the release broke production.** Cause: a weighted split with
no per-version signal — the traffic moved and nobody compared the two versions. Fix: split *and*
watch success rate and latency labelled by destination version, with the rollback condition and the
observation window written down before the weight is raised.

**Symptom: ten percent of requests fail immediately after a split is configured, and the new
version's logs are empty.** Cause: the subset's label selector matches no ready pod, so the sidecar
has no healthy upstream for that share of traffic. Fix: verify the subset resolves to endpoints
before raising the weight, and recognise the signature — a failure proportional to the weight, with
nothing in the new version's logs.

**Symptom: inventory fell over during a ten percent catalogue canary.** Cause: v2 made more
downstream calls per request than v1, so ten percent of traffic was not ten percent of load. Fix:
count v2's downstream calls per request before the canary and size the shared dependency for the
worst case, not for the traffic share.

**Symptom: the mirrored environment doubled read load on the primary database.** Cause: mirroring
is free for the caller and not for anything the mirror talks to. Fix: point the mirror at a
replica or an isolated store, sample the mirrored fraction, and cost the doubling before turning it
on.

**Symptom: rolling back to weight zero did not undo the damage.** Cause: a rollback stops new
requests reaching v2; the rows v2 already wrote, the outbox entries it produced and the jobs it
started are already real. Fix: treat weight zero as stopping the bleeding, with the data repair as
a separate, planned step — and keep the canary percentage small enough that the repair is bounded.

**Symptom: the canary header stopped working two services deep.** Cause: a service in the middle
did not forward the header the routing rule matches on. Fix: forward canary and trace headers
explicitly in every service, the same discipline the trace context needs, and test the propagation
before relying on it for a release.

## Interview questions

**★ Weighted split, header routing, mirroring — what is each for, and when is each unsafe?**
A weighted split sends a percentage of requests to a new version, decoupled from replica counts, so
one percent does not require a hundred pods; it is unsafe when a session bounces between versions,
fixed by hashing on a stable user or session header. Header or identity routing sends only labelled
traffic — internal users, a test account, one calling team — which is the zero-blast-radius canary
and the correct first stage for anything that writes, but it only tests traffic you can label and
it depends on every service forwarding the header. Mirroring copies requests to the new version and
discards its responses, so the caller is unaffected; it is unsafe for anything with side effects,
because the copy is a real request that places a real order and spends a real provider quota, and
it doubles read load on shared downstreams even when the requests are pure reads. The three
compose: mirror reads, then header-route, then split by weight.

**★ Why is a traffic split not enough to make a release safe?**
Because it controls which version receives a request and nothing else. Both versions run against
the same database at the same time by design, so the schema must be compatible with both — expand,
migrate, contract — and a split guarantees you run any breaking migration against live traffic
rather than avoiding it. Both versions share every downstream, so if v2 makes two calls where v1
made one, a ten percent canary is a ten percent load increase somebody has to have planned for. A
split with no per-version success-rate and latency comparison is not a canary at all, only a slower
rollout. And the rollback is not retroactive: weight zero stops new requests, while the rows v2 has
already written stay written.

**★ How do you canary a write path?**
Not by weight, first. Start with header or identity routing to accounts you control — staff, a test
account, one internal caller — so the blast radius is people who can be told. Read back what v2
wrote and reconcile it against what v1 would have written; that check is the actual canary, not the
absence of 500s. Then a small weight for strangers, with the percentage chosen so that the worst
case is a support ticket rather than a reconciliation project, and with the two versions'
per-version error rate and latency compared. Throughout, the schema is expand–migrate–contract
because both versions are writing the same rows in the same minutes, and mirroring is not an option
for a write path unless the shadow has its own store and its own credentials. And say the rollback
plan out loud: weight zero stops the bleeding, and repairing what v2 wrote is a separate planned
step.

**What does a mesh canary give you that a replica-ratio canary does not?**
Granularity and independence. A replica-ratio canary's percentage is `1/replicas`, so a one percent
canary needs a hundred pods, and changing the percentage means a scaling operation with its own
timing and connection churn. A mesh weight is a routing decision over labelled subsets, so
percentage and capacity move independently, one percent is possible at any fleet size, and the
rollback is a configuration push rather than a redeploy or a rescale. It also brings the comparison
with it: the sidecars emit success rate and latency labelled by destination version, so the two
versions are measured on the same series with the same definitions. What it does not change is
everything downstream — one database, one set of dependencies, one schema.

**What is the failure signature of a split pointing at a subset with no endpoints?**
A share of requests fails immediately, proportional to the weight, with nothing at all in the new
version's logs — because no request ever reached it. The sidecar answers with a 503 for "no healthy
upstream", which is indistinguishable at the application layer from the service being down, and is
one of the reasons a mesh's proxy-level failure reasons have to be on a dashboard before an
incident rather than during one. The cause is almost always a subset defined by a label selector
that matches no ready pod: the version label was never applied, or the new deployment has not
passed readiness. The check is to confirm the subset resolves to endpoints before raising the
weight above zero.

← Prev: [16c · Mesh retries, timeouts, breakers](16c-mesh-retries-timeouts-and-circuit-breaking.md) · Index: [Phase 2 — The request path](README.md) · Next → [16e · What a mesh costs](16e-what-a-service-mesh-costs.md)
