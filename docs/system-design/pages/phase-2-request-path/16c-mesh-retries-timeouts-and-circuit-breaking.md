---
title: "Retries, timeouts, concurrency limits and circuit breaking become reviewable configuration once a mesh exists — but the mesh's retries multiply with the application's rather than replacing them, its timeout is a fixed ceiling and never the shrinking deadline the path needs, and its circuit breaker counts the 503 a service correctly returns while shedding as sickness"
sidebar_label: "16c · Mesh retries, timeouts, breakers"
sidebar_position: 16.2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. **Method and common practice** — retry and timeout configuration, outlier
> ejection and per-upstream concurrency limits are described as meshes and layer-7 proxies
> generally implement them, with no vendor defaults, no version numbers, no benchmark figures and
> no measurements. The retry-multiplication arithmetic extends
> [08](08-timeouts-retries-and-budgets.md)'s worked example with the two layers a mesh adds: it is
> arithmetic on illustrative counts, not an observation. Idempotency and the safety of automatic
> retry are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2.2 and the `503` semantics
> §15.6.4, both quoted in full on [08](08-timeouts-retries-and-budgets.md) and
> [03](03-reverse-proxies-and-api-gateways.md). The sidecar mechanism is [16](16-service-mesh.md);
> traffic splitting is [16d](16d-mesh-traffic-splitting-and-canaries.md). **No sandbox run.**

**A mesh turns [08](08-timeouts-retries-and-budgets.md)'s rules from an argument in every code
review into an object you can review, diff and roll back — and that is worth a great deal, right
up to the moment someone enables it without deleting what it was supposed to replace.** The
mesh's retry policy does not override the application's; it stacks on top of it, and on top of the
gateway's, and on top of whatever the HTTP client does by default. Its timeout is a static number
per route and cannot be the shrinking deadline the path actually needs. Its retry conditions are a
safety decision dressed as a tuning knob. And its circuit breaker counts your legitimate errors as
sickness. This page is those four plus the bulkhead that comes with them, with the arithmetic that
decides each and the fix that is not "turn it off".

## Policy as an object, not an argument

```yaml
# the SHAPE of a mesh route policy — illustrative, not any product's schema
route:
  to: inventory
  timeout: 1s                 # a CEILING for this hop, not a propagated deadline
  retries:
    attempts: 2               # total attempts, or extra ones? read your mesh's own definition
    perTryTimeout: 400ms      # attempts x perTryTimeout MUST fit inside the route timeout
    retryOn: [connect-failure, refused-stream, 503]   # never on 4xx; never blindly on 500
  outlierDetection:
    consecutiveErrors: 5      # eject an endpoint after this many
    baseEjectionTime: 30s     # for at least this long
    maxEjectionPercent: 30    # never eject more than this share of the endpoint set
  connectionPool:
    maxConnections: 100       # per upstream, per proxy — a bulkhead
    maxPendingRequests: 50    # queue depth before the proxy sheds
```

The genuine wins: it is the same in every language, it is reviewable, and changing it is a
configuration push rather than a deploy of five services. The traps below are all consequences of
one thing — the file describes *transport* behaviour, and three of the decisions it appears to make
are actually about *meaning*.

## The multiplication a mesh adds

Nothing about installing a mesh deletes the retry loop in your HTTP client, and some clients and
generated stubs retry without being asked. One checkout through the storefront, with modest counts
at each layer:

```text
browser client library            x2 attempts
  gateway retry policy            x2   -> 4 requests entering the mesh
    gateway sidecar retry         x2   -> 8 arriving at orders
      orders' own HTTP client     x3   -> 24 calls leaving orders for inventory
        orders' sidecar retry     x2   -> 48 requests at inventory, for ONE checkout
```

Forty-eight, arriving precisely when inventory is already slow — which is why it was slow. This is
[08](08-timeouts-retries-and-budgets.md)'s twenty-seven with two more layers added by the thing
that was supposed to fix retries, and the shape is worse than the number: the mesh's layers are
invisible in the application's code, so a reviewer reading the service sees `x3` and believes it.

The rule does not change: **retry at exactly one layer per hop.** Adopting the mesh's retries
therefore *includes deleting the application's*, and that deletion is the work:

1. **Audit every service's client configuration** — the code that sets retry counts.
2. **Audit every client library's documented defaults**, because a retry nobody asked for is still
   a retry, and this is the half that gets skipped.
3. **Decide which layer owns retries per hop and write it down** — usually the mesh for
   service-to-service, the client for the browser hop, and the gateway for neither once the mesh
   has it.
4. **Require the retry to pick a *different* endpoint.** A sidecar retry that reuses the endpoint
   that just failed reproduces the failure and is strictly worse than no retry; retrying elsewhere
   is the whole reason the retry belongs at the proxy, which holds the endpoint list.
5. **Keep a budget across the path** — retries capped as a fraction of live traffic
   ([08](08-timeouts-retries-and-budgets.md)) — because a per-hop attempt count does not bound the
   product across hops. Some meshes express retries as a budget rather than a count; if yours does,
   prefer it, and if it does not, the budget remains an application-level concern.

## A timeout is not a deadline

The mesh's timeout is a fixed number attached to a route. The deadline of
[08](08-timeouts-retries-and-budgets.md) is the *remaining* time, computed per request and
shrinking along the path. They are not the same object, and the mesh cannot compute the second
because it does not know what the client was promised.

If the mesh's timeout is the only timeout on the path, every hop waits its own full number: a
two-second client budget is spent by the third hop while the deeper hops keep computing an answer
nobody will read — the abandoned work that turned a two-second client timeout into a fourteen-second
database outage on [08](08-timeouts-retries-and-budgets.md). So:

- **The application keeps propagating the deadline** as a header or gRPC metadata, and each hop
  sets its own timeout from what remains.
- **The mesh's timeout is a ceiling**, sized above the largest legitimate deadline for that route.
  Its job is to stop a hung request holding a proxy connection open indefinitely, not to decide
  when the client gives up.
- **`attempts × perTryTimeout ≤ timeout`.** Two attempts at 400 ms can occupy 800 ms inside a hop
  whose caller allotted one second; violate this and the caller times out mid-retry while the retry
  runs on.

## Retrying the wrong thing: `retryOn` is a safety decision

A retry policy attaches to a route, and a route carries whatever methods that path serves. Point
one at `POST /orders` with a permissive condition list and the mesh retries a request the
application is not prepared to see twice — RFC 9110's rule, quoted in full on
[08](08-timeouts-retries-and-budgets.md), is that automatic retry is for *idempotent* methods.

| Condition | Safe to retry? | Why |
|---|---|---|
| connect failure, refused stream | yes | the request never reached the application |
| connection reset mid-response | **only if idempotent** | the server may have completed the work |
| `503` | usually | it conventionally means "not handled" (RFC 9110 §15.6.4, quoted on [03](03-reverse-proxies-and-api-gateways.md)) |
| `500` | no, by default | it frequently means "I did half of it" |
| `429` | not before the `Retry-After` | retrying a rate limit immediately is the definition of making it worse ([07](07-rate-limiting.md)) |
| any other `4xx` | no | the request is wrong; repeating it does not fix it |

So the retry policy belongs *per route*, matched to what that route carries, and for anything
non-idempotent the idempotency key of
[phase 1's API sketch](../phase-1-the-method/05-the-api-sketch.md) is what makes a retry correct.
The mesh cannot supply that key and cannot know whether one exists.

## Outlier ejection: the circuit breaker you get for free

A proxy that sees an endpoint return consecutive failures stops sending to it for a cooling period,
then tries it again. This is exactly [12](12-service-discovery.md)'s caller-observed health — the
layer that catches a pod which passes its readiness probe and still fails real requests — now
uniform across every language with no library. Two sharp edges:

- **Ejection on 5xx counts your application's legitimate errors as sickness.** A service correctly
  returning `503` while shedding ([07](07-rate-limiting.md)) will eject itself from its callers.
  Prefer connection-level failures as the trigger where the protocol allows it, or separate the
  "shedding" status from the "broken" one so the two are distinguishable.
- **A small endpoint set can be ejected down to nothing.** Three replicas and a bad deploy means
  all three eject and the caller has nowhere to send. That is what a maximum ejection percentage is
  for, and it should be set on purpose rather than left wherever it came from.

Ejection is *per proxy*: each caller learns independently, which is correct — one caller's network
problem is not global truth — but it means callers' dashboards will disagree, and that is not a bug.

## Concurrency limits: the bulkhead

The last resilience control is the least discussed and often the most useful: a cap on how many
connections and how many queued requests one proxy will hold toward one upstream. Beyond the cap
the proxy fails fast rather than queueing without limit.

That is a **bulkhead**: without it, one slow dependency absorbs every worker, every socket and
every scrap of concurrency in the caller, and a service that depends on five things becomes
unavailable because one of them is slow — the failure walk of
[phase 1](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md), arriving through a
dependency rather than through the service itself. With it, calls to the slow dependency fail
quickly and predictably while everything else in the caller keeps working, which is what makes the
degraded-mode design of [04](04-stateless-services-and-where-the-state-went.md) actually reachable.

Two cautions. The cap is *per proxy*, so the fleet's total toward an upstream is replicas × cap —
the same arithmetic as pool sizing on [14](14-connection-pooling-and-keep-alive.md), and it must be
sized the same way, from concurrency rather than from a number that felt safe. And a cap set too
low is indistinguishable in the logs from the upstream being down, which is a good reason for the
proxy's own rejection reason to be on a dashboard before it is needed.

## The storefront

```text
orders → inventory        route timeout 1 s as a ceiling; the propagated deadline still decides; sidecar retries
                          x2 on connect-failure and 503 — enabled only after the Node service's own client
                          retries were deleted and its library's defaults checked
orders → payment adapter  no mesh retry at all: the route carries a non-idempotent write, and the client's retry
                          with the same idempotency key is the safe one (08)
catalogue                 outlier ejection on 5 consecutive connection failures, max 30 % of endpoints ejected,
                          so a bad deploy cannot eject all three replicas at once
recommendations           concurrency cap toward it, low: the product page must render without it, so calls
                          should fail fast rather than consume the catalogue service's workers
budget                    retries capped at 10 % of live traffic, still enforced in the application, because a
                          per-hop attempt count does not bound the product across hops
what did not change       the PostgreSQL pool, its acquire timeout and the rule about never holding a connection
                          across the provider call — the database is outside the mesh and 14 still owns it
```

The recommendations row is the clearest small win: a limit expressed once in configuration does
what a bulkhead library would otherwise have to do in every language.

## Gotchas

**★ Symptom: enabling mesh retries turned a slow dependency into a full outage.** Cause: the
mesh's retries multiplied with the application's, which nobody removed — and with the gateway's,
and with whatever the HTTP client does by default. Fix: retry at exactly one layer per hop; audit
every service's client configuration *and* each client library's documented defaults, delete the
application-level retries as part of turning the mesh's on, and keep a budget across the path
because a per-hop count does not bound the product.

**★ Symptom: the checkout's deadline is exhausted by the third hop.** Cause: mesh timeouts are
fixed per route rather than the remaining budget, and `attempts × perTryTimeout` was allowed to
exceed the route timeout, so one hop can spend more than its caller allotted. Fix: keep deadline
propagation in the application as the real control, set the mesh timeout as a ceiling above the
largest legitimate deadline, and make the retry arithmetic fit inside it.

**★ Symptom: duplicate orders appeared after a routine retry-policy change.** Cause: a retry
condition list applied to a route carrying non-idempotent writes, retrying a request the
application had already partly processed — RFC 9110 permits automatic retry for idempotent methods,
and `POST` is not one. Fix: retry policy per route, matched to that route's methods; retry on
connect failures and refused streams where the request never arrived; require an idempotency key
for anything else and leave that retry to the client that holds the key.

**Symptom: outlier detection ejected almost every endpoint during an incident.** Cause: ejection
triggered on 5xx counts the application's legitimate errors — including the `503` it correctly
returns while shedding — as sickness, and a small endpoint set can be ejected to nothing. Fix: set
a maximum ejection percentage deliberately, prefer connection-level failures as the trigger where
the protocol allows, and treat one proxy's ejections as one caller's opinion.

**Symptom: a retry storm reappeared months after the retry audit.** Cause: a new service arrived
with its client library's default retries, and the "one layer per hop" decision lived in someone's
memory. Fix: write the decision into the service-onboarding checklist and, where the platform
allows, assert it — a check that fails a deployment whose client configuration sets retries on a
hop the mesh already retries.

**Symptom: calls to one upstream fail instantly with no sign of trouble at that upstream.** Cause:
a per-proxy concurrency or pending-request cap set too low, rejecting before the upstream is even
tried. Fix: size the cap from concurrency the way a pool is sized on
[14](14-connection-pooling-and-keep-alive.md), remember the fleet total is replicas × cap, and put
the proxy's own rejection reason on a dashboard so the cap is distinguishable from an outage.

**Symptom: one slow dependency made the whole service unavailable, mesh and all.** Cause: no
concurrency cap toward it, so its slowness absorbed every worker in the caller. Fix: a bulkhead —
a per-upstream connection and pending-request limit — so calls to the slow thing fail fast and the
rest of the service keeps serving, which is what makes a degraded mode reachable at all.

**Symptom: a service that shed load correctly was ejected by every caller and never recovered.**
Cause: shedding returns `503`, ejection triggers on 5xx, and the ejection removed the capacity that
would have let it recover. Fix: distinguish shedding from failure — a separate status or a
connection-level trigger — and pair ejection with a cooling period short enough to re-probe a
recovering endpoint.

## Interview questions

**★ Why can turning on mesh retries make an outage worse, and what do you do about it?**
Because they multiply rather than replace. The client library, the gateway, the gateway's sidecar,
the service's own HTTP client and the service's sidecar can each retry, and modest counts through
five layers turn one checkout into dozens of requests at the deepest service — arriving exactly
when it is already failing for lack of capacity. Worse, the mesh's layers are invisible in the
application's code, so a reviewer reading the service believes the number they can see. The rule is
retry at exactly one layer per hop, which means adopting the mesh's retries includes deleting the
application's, and the audit has to cover each client library's documented defaults, not only the
code that configures them. Then three constraints: attempts times the per-attempt timeout must fit
inside the route timeout; the retry condition must match what the route actually carries; and the
path still needs a budget as a fraction of live traffic, because a per-hop cap does not bound the
product.

**★ How do you set a mesh timeout without breaking deadline discipline?**
Treat the mesh timeout as a ceiling and the application's propagated deadline as the control. The
mesh number is static per route and knows nothing about how much of the client's budget is left, so
if it is the only timeout on the path then every hop waits its own full number and the budget is
gone before the deepest hop answers — exactly how a two-second client timeout becomes a
fourteen-second database outage. The application keeps computing the remaining time and passing it
down; the mesh's timeout exists so a hung request cannot hold a proxy connection open forever, and
it is sized above the largest legitimate deadline for that route. Inside it, attempts times the
per-attempt timeout must fit, or the caller gives up mid-retry while the retry runs on.

**★ Which failures should a mesh retry, and which should it never?**
Retry what provably never reached the application: connect failures and refused streams. Retry a
`503`, which conventionally means the request was not handled. Never retry a `4xx` — the request is
wrong and repeating it changes nothing — and never retry a `429` before its `Retry-After`, which is
the definition of making a rate limit worse. Do not retry a `500` by default, because it frequently
means the server did half the work. A connection reset mid-response is retryable only if the method
is idempotent, since the server may have completed the work before the connection died. And because
the policy attaches to a route that carries whatever methods that path serves, it has to be written
per route with those methods in mind; anything non-idempotent needs an idempotency key the mesh
cannot supply.

**What does outlier ejection give you that readiness probes do not, and how does it go wrong?**
It catches the pod that passes its probe and still fails real requests — the gap named on
[12](12-service-discovery.md) — because the proxy counts actual responses per endpoint from the
caller's own point of view, and getting that in every language for free is one of the better parts
of a mesh. It goes wrong in two ways. Ejecting on 5xx treats legitimate application errors as
sickness, so a service correctly shedding with `503` ejects itself from its callers and loses the
capacity it needed to recover. And on a small endpoint set, aggressive ejection removes every
endpoint there is, which is what a maximum ejection percentage prevents. It is per proxy by design,
so callers will disagree about which endpoints are bad — correct behaviour, not a bug.

**What is a bulkhead in a mesh, and why does it matter more than the retry policy?**
It is the per-upstream cap on connections and queued requests: beyond it, the proxy fails fast
rather than queueing. It matters because the common way a service dies is not its own failure but
one slow dependency absorbing all of its concurrency — every worker blocked on the same call, so a
service that depends on five things is unavailable because one is slow. A cap converts that into
fast, contained failures on one route while the rest of the service keeps serving, which is the
precondition for any degraded mode. Two cautions: the cap is per proxy, so the fleet's total toward
an upstream is replicas times the cap and it should be sized from concurrency exactly as a
connection pool is; and a cap set too low looks in the logs like the upstream being down, so the
proxy's rejection reason needs to be visible before it is needed.

← Prev: [16b · Mesh mTLS and workload identity](16b-mesh-mtls-and-workload-identity.md) · Index: [Phase 2 — The request path](README.md) · Next → [16d · Mesh splitting and canaries](16d-mesh-traffic-splitting-and-canaries.md)
