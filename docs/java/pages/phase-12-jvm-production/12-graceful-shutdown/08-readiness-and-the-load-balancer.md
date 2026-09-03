---
title: "Nothing tells the load balancer you are shutting down — it finds out by polling a probe, on its own schedule, and the platform removes you from the endpoint list concurrently with sending SIGTERM, so the graceful shutdown you configured begins during the window in which traffic is still arriving"
sidebar_label: "08 · Readiness and the load balancer"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the **Spring Boot 4.1** reference — *Graceful Shutdown* for what the
> servers do to new requests
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)),
> *Application Availability* for `LivenessState`/`ReadinessState`, `AvailabilityChangeEvent` and the
> startup transitions
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/spring-application.html)),
> *Actuator · Kubernetes Probes* for the health groups and
> `management.endpoint.health.probes.add-additional-paths`
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)), and the
> **Kubernetes Container Lifecycle** how-to for the concurrency statement and the `preStop` guidance
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/deployment/cloud.html)); plus the
> **Kubernetes** *Pod Lifecycle* documentation for the termination flow and the 30-second default
> ([kubernetes.io](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)).
> 🔴 **No sandbox.** No cluster was run, no pod was deleted and no probe was polled. JDK 25 ·
> Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every page in this topic so far has been about what your process does after it receives SIGTERM.
This one is about the fact that by the time SIGTERM arrives, it is already too late to tell anyone.
The load balancer does not receive an event. It polls a probe, on an interval it chose, and the
platform removes you from its endpoint list at the same time as it signals you — not before.**

Boot's own deployment guide states the problem more plainly than most platform documentation does:

> *"When Kubernetes deletes an application instance, the shutdown process involves several
> subsystems concurrently: shutdown hooks, unregistering the service, removing the instance from
> the load-balancer…​ Because this shutdown processing happens in parallel (and due to the nature
> of distributed systems), there is a window during which traffic can be routed to a pod that has
> also begun its shutdown processing."*

**★ "Concurrently" is the whole page.** The mental model most people carry — deregister, then
drain, then exit — describes a sequence the platform does not perform. Removal from the endpoint
list and delivery of SIGTERM are two independent things happening at once, and neither waits for
the other.

## Why the window is worse than it looks

Two servers still make it worse, because of what Boot's graceful shutdown actually does to a new
request during the grace period:

> *"Jetty, Reactor Netty, and Tomcat … will stop accepting new requests at the network layer."*

**★ There is no polite 503 phase.** A request that arrives after the drain begins is not answered
with a status code you can retry on semantics; the connection is refused or reset at the socket.
The client sees a transport error. Every layer above — a service mesh, a client-side load balancer,
a browser — has to guess whether it is safe to retry, and a `POST` is exactly the case where
guessing is expensive.

This is why the order has to be **fail readiness first, stop accepting second**, and why the
platform's own ordering does not give you that for free.

## What Boot already does

Boot models availability as two independent states, and exposes both as health groups.

| State | Values | Health group |
|---|---|---|
| `LivenessState` | `CORRECT`, `BROKEN` | `/actuator/health/liveness` |
| `ReadinessState` | `ACCEPTING_TRAFFIC`, `REFUSING_TRAFFIC` | `/actuator/health/readiness` |

The transitions are event-driven and documented:

- `ApplicationStartedEvent` → *"An `AvailabilityChangeEvent` is sent right after with
  `LivenessState.CORRECT` to indicate that the application is considered as live."*
- `ApplicationReadyEvent` → *"An `AvailabilityChangeEvent` is sent right after with
  `ReadinessState.ACCEPTING_TRAFFIC` to indicate that the application is ready to service
  requests."*
- On shutdown, readiness moves to `REFUSING_TRAFFIC`, so the readiness group starts failing.

**★ Liveness and readiness are not two strengths of the same check — they have opposite
consequences.** A failing readiness removes you from the load balancer. A failing liveness
*restarts your container*. Pointing a liveness probe at a check that also covers a downstream
dependency is how one slow database restarts an entire fleet. Readiness is the one that belongs in
a shutdown discussion; liveness must keep returning `CORRECT` right up until the process exits.

Enable the probes and, if your load balancer cannot reach the management port, put them on the main
one:

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true
        add-additional-paths: true   # also serves /livez and /readyz on the server port
```

You can also react to the state yourself, which is the hook for load balancers that read something
other than HTTP:

```java
@Component
class ReadinessExporter {
  @EventListener
  void onStateChange(AvailabilityChangeEvent<ReadinessState> event) {
    switch (event.getState()) {
      case ACCEPTING_TRAFFIC -> { /* create /tmp/healthy */ }
      case REFUSING_TRAFFIC  -> { /* remove /tmp/healthy */ }
    }
  }
}
```

## Why that is still not enough

**★ Boot flipping readiness to `REFUSING_TRAFFIC` does not remove you from anything. It changes
what a probe would say if someone asked.** The removal happens only after:

1. the load balancer's **next** probe poll — up to `periodSeconds` away, and
2. `failureThreshold` consecutive failures, and
3. the endpoint change **propagating** to whatever actually routes packets.

A conventional readiness probe of `periodSeconds: 10`, `failureThreshold: 3` is up to **thirty
seconds** of continued traffic *before* propagation, which is the entire default grace period. And
the flip happens as part of context close — the same context close that is simultaneously draining
the server. The two are not separated by anything.

Boot's guide is direct about the conclusion:

> *"You should not rely on the Spring Boot graceful shutdown period alone, as the platform will not
> be getting any liveness data in the period that the app is shutting down."*

## The fix is a delay before SIGTERM, not a longer drain

The only place to insert time *before* your process starts refusing connections is the `preStop`
hook, which runs before the signal is delivered. That is **08b** *(not written yet)* in full; the
part that belongs here is why it is a `preStop` sleep and not a bigger
`spring.lifecycle.timeout-per-shutdown-phase`:

- A longer **drain** extends the period during which in-flight requests may finish. It does not
  extend the period during which *new* requests are still accepted — the server has already
  stopped accepting.
- A `preStop` **sleep** delays the moment the server stops accepting at all, which is precisely the
  window the propagation delay needs.

> *"The delay should be at least as long as the longest time it takes to process an in-flight
> request."*

**★ Note whose number that is.** It is not "as long as endpoint propagation takes", which you
cannot measure from inside the pod. Boot's guidance is to bound it by your own request duration,
which you can measure — see [08 · Percentiles](../08-metrics-with-micrometer/08-percentiles.md) in
topic 08 for getting a defensible number rather than a guessed one.

## The order that actually works

1. **`preStop` fires.** The process is untouched and still serving. Traffic continues, correctly.
2. **Concurrently, the platform removes the pod from its endpoint list** and that change propagates.
3. **The sleep ends. SIGTERM is delivered.**
4. **Readiness flips to `REFUSING_TRAFFIC`** and the drain begins: no new requests accepted,
   in-flight ones finish ([04](04-spring-graceful-shutdown.md),
   [04b](04b-what-graceful-actually-drains.md)).
5. Lifecycle beans stop in descending phase — containers ([06b](06b-message-consumers.md)),
   executors ([06a](06a-spring-executors-on-context-close.md)).
6. Beans are destroyed: pools and clients close ([07](07-connection-pools.md)).
7. The process exits **before** `terminationGracePeriodSeconds` elapses, or it is SIGKILLed.

**★ Steps 1 and 2 overlap on purpose, and that overlap is the entire mechanism.** You are not
coordinating with the platform; you are buying enough wall-clock time that its asynchronous
bookkeeping finishes before you do anything visible.

## Gotchas

**★ Readiness flipping and the drain starting are the same event.** Both are part of context close.
There is no configuration that makes Boot fail readiness first and wait — that separation has to
come from outside the process, which is what `preStop` is for.

**★ A liveness probe that checks a dependency turns a database blip into a rolling restart.**
Liveness answers "should this container be killed and recreated", and the answer is almost never
"yes, because Postgres is slow". Keep liveness shallow; put dependency checks in readiness, where
the consequence is removal from routing rather than a restart.

**★ Readiness must not fail *permanently* the moment the app is busy.** `REFUSING_TRAFFIC` is also
the state the reference suggests for *"any time if the application decides that it is too busy for
additional traffic"*, which is a load-shedding tool. Used carelessly it produces a fleet that
removes every instance from the load balancer at the same moment.

**★ The management port is a common reason probes silently do nothing.** If actuator is on a
separate port that the load balancer cannot reach, the probe never observes the state change.
`add-additional-paths: true` puts `/livez` and `/readyz` on the main server port for exactly this.

**★ `periodSeconds × failureThreshold` is the number that matters, and it is not yours.** It lives
in the deployment manifest, usually owned by a platform team, and it is the dominant term in the
propagation delay. Read it before you size the `preStop` sleep.

**★ Persistent connections outlive endpoint removal.** Removing a pod from an endpoint list stops
*new* connections being routed there. An HTTP/1.1 keep-alive connection or an HTTP/2 connection a
client or mesh sidecar already holds keeps sending requests down the same socket. The Boot
reference notes persistent connections as a factor in how requests stop being accepted, and this is
the case where a `preStop` sleep helps least.

**★ "It works in staging" usually means staging has one replica and no real traffic.** The window
is a race, and a race with no concurrent requests is invisible. The signature in production is a
small, steady count of connection resets that correlates exactly with deploys and with nothing
else.

**★ Nothing here is Kubernetes-specific except the vocabulary.** Any load balancer that learns
health by polling has the same propagation delay — a cloud target group, an nginx upstream with
health checks, a service mesh. The names change; the ordering problem does not.

**★ A readiness probe pointed at `/actuator/health` rather than `/actuator/health/readiness` fails
for the wrong reasons.** The grouped endpoint aggregates every health indicator, so a degraded
optional dependency can remove a perfectly serviceable instance from the load balancer. The groups
exist to give the probe a narrow, deliberate definition.

## Interview questions

**★ Why isn't graceful shutdown on its own enough to avoid dropped requests during a deploy?**
Because the platform removes the instance from the load balancer and sends SIGTERM concurrently,
not in sequence. Boot's own deployment guide says the shutdown processing *"happens in parallel"*
and that there is *"a window during which traffic can be routed to a pod that has also begun its
shutdown processing."* Graceful shutdown governs what happens to requests already in flight; it
does nothing about requests that arrive after the server stopped accepting.

**★ What does a client actually see if it hits an instance that has started draining?**
A transport error, not a 503. Jetty, Reactor Netty and Tomcat *"stop accepting new requests at the
network layer"*, so the connection is refused or reset. That matters because a status code carries
retry semantics and a socket reset does not — the caller has to decide whether the request was
idempotent, which is exactly the judgement you do not want made by a generic retry policy.

**★ What is the difference between the liveness and readiness probes, in consequences?**
A failing readiness removes the instance from routing; a failing liveness restarts the container.
They are not two strengths of the same signal. The classic incident is a liveness probe that checks
a database: when the database slows down, every instance fails liveness at once and the platform
restarts the entire fleet, turning a dependency blip into an outage.

**★ Where does Spring Boot flip readiness during shutdown, and why does that not solve the
problem?**
As part of context close, an `AvailabilityChangeEvent` moves `ReadinessState` to
`REFUSING_TRAFFIC`, so `/actuator/health/readiness` starts failing. It does not remove you from
anything — it changes what a probe *would* report. The load balancer still has to poll
(`periodSeconds`), still needs `failureThreshold` consecutive failures, and the endpoint change
still has to propagate. Meanwhile the same context close is already draining the server.

**★ How do you size a `preStop` sleep?**
Boot's guidance is that *"the delay should be at least as long as the longest time it takes to
process an in-flight request"* — a number you can measure from your own latency distribution rather
than guess. Cross-check it against the deployment's `periodSeconds × failureThreshold`, and check
the total against `terminationGracePeriodSeconds`, because the sleep is spent before SIGTERM is even
delivered and comes out of the same 30-second default.

**★ Why a `preStop` sleep rather than a larger `spring.lifecycle.timeout-per-shutdown-phase`?**
Because they act on different windows. The lifecycle timeout extends how long in-flight requests
may take to finish — after the server has already stopped accepting. The `preStop` sleep delays the
moment it stops accepting at all, which is the window the propagation delay actually occupies.
Raising the drain timeout to fix a propagation race makes shutdown longer and fixes nothing.

**★ Your readiness probe is on the management port and the load balancer cannot reach it. What
now?**
`management.endpoint.health.probes.add-additional-paths=true`, which serves the liveness and
readiness groups as `/livez` and `/readyz` on the main server port. It exists precisely for
deployments where the probe consumer only has access to the application port.

**★ You still see resets on every deploy after adding a `preStop` sleep. What is left?**
Most likely persistent connections. Endpoint removal stops *new* connections being routed to the
pod; a client, sidecar or mesh proxy holding an established keep-alive or HTTP/2 connection keeps
using it, and no amount of endpoint bookkeeping affects that. After that, check whether the sleep
is actually longer than `periodSeconds × failureThreshold`, and whether the process is exiting
before the grace period rather than being SIGKILLed mid-drain.

{/* FOOTER */}
