---
title: "The bill for a mesh is two extra proxy traversals on every call, a proxy per pod whose configuration grows with the size of the mesh, a control plane that is now a dependency, a fleet-wide rolling restart every time the data plane is upgraded, and a debugging surface in which five different things can answer 503 and only one of them is your service"
sidebar_label: "16e · What a mesh costs"
sidebar_position: 16.4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. **Method and common practice** — proxy traversal cost, per-pod resource
> overhead, configuration scoping, control-plane and data-plane upgrade ordering, proxy access
> logs and response annotations, sidecar startup and shutdown ordering, and traffic exclusion by
> port or CIDR are described as meshes and layer-7 proxies generally implement them. **No vendor
> defaults, no version numbers, no benchmark figures and no latency measurements** — the research
> bank for this phase explicitly records that no proxy vendor documentation was fetched, so every
> statement here is mechanism, not a measured claim. Kubernetes' first-class sidecar container
> support is named as a direction without a version or a status claim; check the
> [Kubernetes documentation](https://kubernetes.io/docs/concepts/services-networking/service/) and
> [Part 7 of the syllabus](../../syllabus/07-cloud-kubernetes-and-iac.md) for its current state.
> **No sandbox run.**

**Every argument for a mesh on [16](16-service-mesh.md) through
[16d](16d-mesh-traffic-splitting-and-canaries.md) is real; this page is what you pay for them, in
the currency each cost is actually charged in.** Some of the bill is latency, some is memory, some
is a recurring operational task that never ends, and one item — the debugging surface — is paid
entirely in the middle of incidents, by whoever is on call, which is why it is the item most
consistently left out of the decision. Read this page before [16g](16g-when-a-mesh-earns-its-cost.md)
decides whether the trade is worth making, because the trade is not "some latency": it is a
standing operational commitment.

## The ledger

| Cost | The mechanism | What it means in practice |
|---|---|---|
| **Two extra proxy traversals per call** | the caller's sidecar and the callee's sidecar each accept a connection, parse the request and re-serialize it | paid on every call in both directions; small against a network round trip, and multiplied by fan-out |
| **CPU per pod** | a proxy process next to every application container | the proxy competes for the pod's CPU with its own application unless the limits account for two containers |
| **Memory per pod, growing with the mesh** | each proxy holds the configuration and endpoint lists for everything it may call | if that is "every service", per-pod config is O(services) and the fleet's memory is O(services × pods) |
| **The control plane as a dependency** | it issues certificates, pushes configuration, aggregates endpoints | capacity, monitoring, an on-call and a restore procedure, with a deadline set by the certificate lifetime ([16](16-service-mesh.md)) |
| **The upgrade treadmill** | control plane and data plane are separate components with a supported skew window | a data-plane upgrade restarts the proxy in every pod — a fleet-wide rolling restart, on a schedule, forever |
| **Configuration blast radius** | one control plane pushes to every proxy within seconds | the mirror image of "one place to change policy": one bad rule is every service at once |
| **A second configuration language** | routing, policy and subsets expressed in objects nobody wrote application code for | everyone who debugs production has to be able to read it, which is a training cost, not a one-time setup |
| **The debugging surface** | the proxy can answer a request the application never saw | five candidates for one 503, below |

**On the latency line, precisely and without numbers.** Each traversal is a loopback connection,
a parse and a re-serialize in userspace. Against a network round trip it is small; it is not zero,
it is paid twice per call, and two things make it land on the tail rather than the median. First,
the proxy shares the pod's CPU allocation with its application, so under load the proxy is
sometimes waiting for CPU exactly when the application is busiest. Second, a request that fans out
to ten services pays the cost ten times and is only as fast as the slowest of the ten, so
per-call overhead concentrates in the tail of any fan-out. The consequence for design is not
"meshes are slow" — it is that you measure p99 on a fan-out endpoint before and after, and you
reserve CPU for the proxy so it is not throttled behind its own application.

**On the memory line.** The default posture of "every proxy can call every service" is what makes
per-pod configuration grow with the size of the mesh, and it is also what makes a large mesh
expensive in a way that surprises people who sized it from a single pod. Every mesh has a
mechanism to scope a workload's configuration to the services it actually calls; using it is the
difference between memory that grows with your fleet and memory that grows with the *square* of
your growth.

## The 503 that came from the sidecar

With a mesh, one failed call has five possible authors, and only the last is your service:

1. **The caller's sidecar had no endpoint to send to** — the subset matched nothing, every endpoint
   was ejected ([16c](16c-mesh-retries-timeouts-and-circuit-breaking.md)), or the service is not in
   the mesh's view at all. The application never sent a byte.
2. **The caller's sidecar's timeout fired** — the caller sees a failure while the callee is still
   working on the request, and will keep working, holding a database connection while it does
   ([14](14-connection-pooling-and-keep-alive.md)).
3. **Mutual TLS failed** — the peer's certificate is not trusted, or strict mode is on and the
   caller is not in the mesh ([16b](16b-mesh-mtls-and-workload-identity.md)). The connection is
   refused before any HTTP exists.
4. **An authorization policy denied it** — a 403 the application never saw and cannot log.
5. **The callee's sidecar could not reach the application** — not listening yet, crashed, or
   listening on a port the proxy was not told about.

**The triage, in order.** It is the same three-step every time, and it works because the mesh added
observers rather than removing them:

1. **Find the same request in three logs** — the caller's proxy access log, the callee's proxy
   access log, the callee's application log — keyed on the request ID the gateway assigned
   ([03](03-reverse-proxies-and-api-gateways.md)). *Which log the request is missing from names the
   leg that failed.* Present at the caller's proxy and absent at the callee's proxy is a network,
   endpoint or mTLS problem; present at both proxies and absent in the application is case 5 or an
   authorization denial; present everywhere is your service.
2. **Read the proxy's own failure annotation.** Proxies record a reason for failures they generated
   themselves, in their access log and often as a response header. Find out where yours puts it,
   and what its codes mean, *before* an incident — this is a fifteen-minute task on a calm day and
   an hour of guessing on a bad one.
3. **Compare the same call measured at both ends.** A per-hop dashboard split by which proxy
   reported it shows whether the time went between the proxies (network, or the proxies themselves)
   or inside the application. This is the one genuinely new diagnostic a mesh gives you, and it is
   worth setting up while you are adding the cost anyway.

The prerequisites are unglamorous and non-optional: the request ID must be in the mesh's access-log
format *and* in the application's logs, and the trace context must be propagated by the
applications ([16](16-service-mesh.md)) or the three logs cannot be joined at all.

## Startup, shutdown, probes and the traffic that is not in the mesh

Two containers in one pod, with traffic redirected between them, produces a family of lifecycle
bugs that every mesh adopter meets:

- **The startup race.** The application container starts and immediately calls a dependency before
  the proxy has its configuration; the call fails, or leaves the pod before mTLS is in place. The
  platform now has a first-class notion of sidecar containers precisely to fix this ordering — its
  current status is a question for the Kubernetes documentation, not for this page — and the
  application should retry its startup dependencies with jittered backoff regardless, because that
  is correct behaviour with or without a mesh.
- **The shutdown race.** The proxy stops while the application is still finishing in-flight
  requests, so the last requests of every rolling deploy fail. The fix is the same ordering
  guarantee from the other end, plus the drain discipline of
  [02](02-load-balancing-layer-4-vs-layer-7.md): stop accepting, finish what is in flight, then let
  both containers exit.
- **Jobs that never finish.** A batch container's process exits, but the pod stays running because
  the proxy is still running, so the Job never completes and nothing downstream of it fires. Fix:
  the platform's sidecar lifecycle support where it is available, a call to the proxy's shutdown
  endpoint as the job's last step, or simply leaving batch workloads out of the mesh.
- **Probes arriving before the proxy is ready** — distinct from the strict-mTLS probe rejection of
  [16b](16b-mesh-mtls-and-workload-identity.md), and with the same symptom: a pod that never passes
  readiness, so the endpoint set is empty and the balancer has nowhere to send.
- **The traffic that is not in the mesh.** DNS, the metrics scrape, the database, the cache, every
  external provider. Each is either excluded from redirection by port or CIDR or handled explicitly
  as egress, and that exclusion list is configuration that drifts: a new dependency added without
  an egress rule is "why can nothing reach the payment provider" on the day it ships. Decide
  deliberately whether egress is default-allow or default-deny, and if it is default-deny, make the
  allowlist part of onboarding a dependency rather than part of the incident.

## The storefront

```text
per-call overhead     two proxy traversals on gateway→orders and on orders→inventory: four for one checkout,
                      each a loopback parse and re-serialize; measured on p99 of the checkout before and after
pod sizing            every pod's CPU and memory limits raised for a second container; the recommendations
                      service, which is small, roughly doubles in pod count cost terms
config scope          each service's proxy scoped to what it actually calls — catalogue calls Redis and the
                      replica, not the payment adapter — so per-pod config does not grow with the whole mesh
control plane         a new box on phase 1's failure walk, with the certificate lifetime as the restore deadline
upgrades              a fleet-wide rolling restart per data-plane upgrade, coordinated with the cluster's own
                      upgrades: a standing calendar item, not a project
egress                explicit rules for the payment provider, the email gateway, PostgreSQL and Redis; the
                      allowlist is part of onboarding any new external dependency
on call               proxy access-log format carries the gateway's request ID; the proxy's failure-reason codes
                      are documented in the runbook before the mesh handles production traffic
```

Nothing in that list is unaffordable. All of it is *permanent*, which is the actual decision
[16g](16g-when-a-mesh-earns-its-cost.md) is about.

## Gotchas

**★ Symptom: a 503 with no matching entry in the service's log.** Cause: the sidecar answered — no
healthy endpoint, every endpoint ejected, an mTLS refusal, an authorization deny, or the callee's
proxy unable to reach the application — and the application was never called. Fix: triage across
three logs (caller's proxy, callee's proxy, callee's application) keyed on the gateway's request ID,
and know where your proxy records its own failure reason *before* the incident. The request ID must
be in the proxy's access-log format for this to work at all.

**★ Symptom: one configuration change broke every service at once.** Cause: a single control plane
pushes to every proxy in seconds, which is the same property that makes uniform policy possible.
Fix: review, stage and progressively roll out mesh configuration exactly like code — it *is*
production behaviour — and prefer changes scoped to one namespace over fleet-wide ones.

**★ Symptom: a batch Job never completes and its downstream never runs.** Cause: the application
process exited but the proxy container keeps the pod alive. Fix: the platform's first-class sidecar
lifecycle where available, a call to the proxy's shutdown endpoint as the job's final step, or keep
batch workloads out of the mesh entirely.

**Symptom: services fail their first outbound calls for a few seconds after every deploy.** Cause:
the application container started before the proxy had configuration. Fix: sidecar-before-app
ordering where the platform provides it, and jittered-backoff retries on startup dependencies in
the application regardless.

**Symptom: pods started getting OOM-killed after mesh adoption, and cost rose more than expected.**
Cause: a proxy per pod, each holding configuration and endpoints for the entire mesh. Fix: scope
each workload's proxy configuration to the services it actually calls, and size pod limits for two
containers rather than one.

**Symptom: nothing can reach the payment provider after enabling the mesh.** Cause: outbound
traffic is captured by the redirect and, under a default-deny egress posture, denied. Fix: an
explicit egress rule per external dependency, with adding that rule written into the checklist for
onboarding a dependency — and a deliberate decision about default-allow versus default-deny rather
than an inherited one.

**Symptom: p99 on the product page rose noticeably while p50 barely moved.** Cause: per-call proxy
overhead is paid on every call of a fan-out, the response waits for the slowest of them, and the
proxy contends for CPU with its own application under a shared limit. Fix: measure p99 on fan-out
endpoints before and after, reserve CPU for the proxy, and reduce or parallelise fan-out — the mesh
made an existing tail-amplification problem visible rather than creating it.

**Symptom: an upgrade left some pods on an old proxy and broke a feature for exactly those.**
Cause: control plane and data plane are separate components with a supported skew window, and a
partial rolling restart leaves the fleet straddling it. Fix: treat the data-plane restart as a
planned fleet-wide rolling operation with a completion check, and know the skew window your mesh
supports before starting rather than during.

**Symptom: an incident took an hour to attribute because nobody could read the mesh's
configuration.** Cause: a second configuration language whose expertise sits with one person. Fix:
put the routing and policy objects in the runbook with worked examples, and make reading them part
of on-call onboarding — the training cost is part of the mesh's price, not an optional extra.

## Interview questions

**★ What does a service mesh cost?**
Seven things, in different currencies. Two extra proxy traversals on every call, each a loopback
parse and re-serialize — small against a network round trip, paid twice per call, and concentrated
in the tail because the proxy shares the pod's CPU with its application and because a fan-out pays
it once per branch. CPU and memory per pod, with the memory growing with the size of the mesh
unless each workload's configuration is scoped to what it actually calls. A control plane that is
now a dependency with capacity, monitoring, an on-call and a restore deadline set by the certificate
lifetime. An upgrade treadmill: two components with a supported skew window, and a data-plane
upgrade means restarting the proxy in every pod. A configuration blast radius that is the exact
mirror of "one place to change policy". A second configuration language everyone on call must read.
And a debugging surface where a 503 has five possible authors. The first six are budgetable; the
last is paid during incidents, which is why it is the one that gets left out of the decision.

**★ A call fails with 503 and the service's logs show nothing. Walk me through it.**
Assume the sidecar answered, because that is what "nothing in the service's log" means. Five
candidates: the caller's proxy had no endpoint — a subset matching nothing, or every endpoint
ejected by outlier detection; the caller's proxy timed out while the callee kept working; mutual
TLS was refused because the peer is untrusted or is outside a strict-mode mesh; an authorization
policy denied the call; or the callee's proxy could not reach its own application, because it is not
listening yet or is on a port the proxy was not told about. Triage by finding the same request ID in
three logs — the caller's proxy, the callee's proxy, the callee's application — because the log it
is missing from names the leg. Then read the proxy's own failure reason code, which you should have
learned on a calm day. Then compare the call as measured at both proxies to see whether the time
went between them or inside the application. The prerequisite is that the gateway's request ID is in
the proxies' access-log format and in the application's logs.

**★ What breaks at pod startup and shutdown once there is a sidecar?**
Ordering, in both directions. At startup the application container can begin calling dependencies
before the proxy has configuration, so the first calls after every deploy fail or leave the pod
before mTLS applies; the platform's first-class sidecar container support exists to fix exactly this
ordering, and the application should still retry startup dependencies with jittered backoff. At
shutdown the proxy can stop while the application is still finishing in-flight requests, so the last
requests of a rolling deploy fail — the fix is the same ordering guarantee plus proper draining:
stop accepting, finish what is in flight, then exit. The sharpest version is a batch Job whose
process exits while the proxy keeps running, so the pod never terminates and the Job never
completes; that needs the platform's sidecar lifecycle, an explicit call to the proxy's shutdown
endpoint, or keeping batch workloads out of the mesh. And probes are a third case: a probe arriving
before the proxy is ready fails readiness for the same reason a probe under strict mTLS does.

**Why does adding a mesh hurt the tail more than the median?**
Because the per-call overhead is small but is paid on every call, and two effects concentrate it.
The proxy shares the pod's CPU with its own application, so under load it is sometimes waiting for
CPU precisely when the application is busiest — which is a tail effect by construction. And a
request that fans out to several services pays the overhead on every branch while waiting for the
slowest branch, so per-call costs accumulate into the response's tail rather than averaging out. The
practical response is to measure p99 on fan-out endpoints specifically, before and after, to reserve
CPU for the proxy so it is not throttled behind its application, and to treat any large regression
as a signal about the fan-out itself — the mesh usually makes an existing tail-amplification problem
visible rather than creating one.

**What does upgrading a mesh actually involve?**
Two components with a supported version skew between them, upgraded in order: the control plane
first, then the data plane. Because the data plane is a proxy inside every pod, upgrading it means
restarting the proxy in every pod — in the sidecar model, a fleet-wide rolling restart, coordinated
with the platform's own upgrade schedule and with whatever deploy freezes exist. That is a standing
calendar item rather than a project, and the failure mode of skipping it is a fleet straddling the
skew window, where a feature works on some pods and not others. It is also why "who owns the mesh"
is a real question with a real answer required before adoption: an unowned mesh gets pinned on a
version that eventually stops being supported, and the recovery from that is worse than the upgrade
would have been.

**What has to be true about logging before a mesh helps rather than hinders debugging?**
The gateway's request ID has to appear in the proxies' access-log format and in every application's
logs, or the three logs a mesh gives you cannot be joined and you have three separate mysteries
instead of one triage. Trace context has to be propagated by the applications, because a sidecar
can emit a span but cannot connect an inbound request to the outbound calls it caused. And the
proxy's own failure-reason codes have to be documented in the runbook in advance, because the
question "did the sidecar answer this, or did the service?" is the first question of every mesh
incident and it should not be answered by reading vendor documentation at three in the morning.

← Prev: [16d · Mesh splitting and canaries](16d-mesh-traffic-splitting-and-canaries.md) · Index: [Phase 2 — The request path](README.md) · Next → [16f · North-south and east-west](16f-north-south-and-east-west.md)
