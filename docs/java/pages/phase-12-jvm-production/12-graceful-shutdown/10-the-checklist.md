---
title: "A zero-drop rolling deploy, step by step: what to change, in the order that each change makes the next one measurable, ending with the arithmetic that decides whether the whole sequence fits inside the one number that is a total"
sidebar_label: "10 · The checklist"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 — this page assembles conclusions established and sourced in the preceding
> chunks of this topic rather than introducing new claims; each step links to the page carrying its
> evidence. The underlying sources are the **Spring Boot 4.1** reference and its Kubernetes
> Container Lifecycle how-to ([docs.spring.io](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)),
> the **Kubernetes** *Pod Lifecycle* and *Container Lifecycle Hooks* documentation
> ([kubernetes.io](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/)), the
> **Spring for Apache Kafka** and **Spring AMQP** container references, the **HikariCP** sources,
> and the **JDK 25** API documentation. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Somebody says "we drop a few requests on every deploy". This is the order in which to change
things about that sentence. The ordering is not arbitrary: each step either makes the next one
measurable or is a precondition for it being safe, and the last step is the only one that requires
agreement with whoever owns the deployment manifest.**

**★ The most common outcome of running this properly is discovering that the process was fine and
the platform was routing traffic to it after it had stopped accepting.** Steps 0 and 1 catch that
before anybody tunes a timeout.

## Step 0 — Establish that shutdown is what is happening

Before anything else, correlate. Plot the errors against deploy times and against pod deletion
timestamps. If they do not line up, stop: the causes that look like shutdown are a failing
dependency, connection-pool exhaustion, and a client with an aggressive timeout.

If they do line up, look at *what the client saw*. A transport error — a reset, a refused
connection — points at the acceptance window ([08](08-readiness-and-the-load-balancer.md)). A 5xx
that the application generated points at teardown ordering. Duplicated work rather than errors
points at consumers ([06b](06b-message-consumers.md)).

Cost: minutes, no change. **This step eliminates more investigations than every step below it.**

## Step 1 — Make sure SIGTERM reaches the JVM at all

Nothing else matters if the signal never arrives. Two failures, both from
[02](02-signals.md) and [02b](02b-the-shell-that-swallowed-sigterm.md):

- **A shell entrypoint that does not `exec`.** The shell is PID 1, the JVM is its child, and the
  shell neither handles nor forwards SIGTERM. The container runs for the full grace period and is
  SIGKILLed every time.
- **The JVM as PID 1 with no signal handling** in whatever wrapper you use.

**Verify it, do not assume it:** `kill -TERM` the container locally and watch for your shutdown
log line. If shutdown takes exactly `terminationGracePeriodSeconds` every time, this is almost
certainly the reason.

## Step 2 — Confirm graceful shutdown is on and know what it drains

On Boot 4.1 `server.shutdown` is **already** `graceful`; the property now exists to set
`immediate`. What needs a decision is not whether it is on but what it covers
([04](04-spring-graceful-shutdown.md), [04b](04b-what-graceful-actually-drains.md)): ordinary
requests, yes; long polls, SSE and WebSockets are a decision you make, not a behaviour you get.

**★ Advice on the internet to "enable graceful shutdown" is pre-4.x.** If a change to
`server.shutdown` appears to fix something, check that it was not previously set to `immediate` by
a config you inherited.

## Step 3 — Insert the `preStop` sleep

This is the step that fixes the common case, and it is a manifest change rather than a code change.

```yaml
lifecycle:
  preStop:
    sleep:
      seconds: 10        # Kubernetes 1.32+; use exec sh -c "sleep 10" below that
```

Sizing: *"at least as long as the longest time it takes to process an in-flight request"*,
cross-checked against the readiness probe's `periodSeconds × failureThreshold`, which is usually
the larger term ([08](08-readiness-and-the-load-balancer.md),
[08b](08b-prestop-and-termination-grace-period.md)).

**★ Check the image can run it.** The `exec` form needs a shell and a `sleep` binary, which a
distroless or JRE-only image may not have, and the failure is silent.

## Step 4 — Point the probes at the right endpoints

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true
        add-additional-paths: true
```

Readiness at `/actuator/health/readiness` (or `/readyz`), **liveness kept shallow** — a liveness
probe that checks a database restarts the fleet when the database slows down
([08](08-readiness-and-the-load-balancer.md)).

## Step 5 — Bound the things that stop slowly

Now the process gets a fair chance, so find what takes the longest.

| Component | The knob | Default | Page |
|---|---|---|---|
| Kafka listener container | `stopImmediate` | **`false`** — finishes the whole poll batch | [06b](06b-message-consumers.md) |
| Kafka listener container | `shutdownTimeout` | 10s | [06b](06b-message-consumers.md) |
| AMQP listener container | `shutdownTimeout` | 5s | [06b](06b-message-consumers.md) |
| Executors and schedulers | `spring.task.execution.shutdown.*` | interrupt, no wait | [06a](06a-spring-executors-on-context-close.md) |
| Connection pool | nothing — aborts, ≤10s hard-coded | — | [07](07-connection-pools.md) |
| Your own long jobs | a statement/transaction timeout | none | [07](07-connection-pools.md) |

**★ `stopImmediate=false` is the term that most often dominates everything else.** At a default
`max.poll.records` of 500 it can be minutes.

## Step 6 — Make the repeat safe

Steps 0–5 shrink the window. They do not close it, and the retry lands on a *different* instance,
so in-process deduplication cannot work ([09](09-idempotency-as-the-backstop.md)). The dedup key
goes in the same durable store, in the same transaction, as the effect.

**★ This step is the only one that is about correctness rather than about rate.** Skip it and every
number above becomes a probability of corruption rather than a probability of a retry.

## Step 7 — Add it up, then set the grace period

```
preStop sleep + drain + container stops + executor waits + pool close + JVM exit
  < terminationGracePeriodSeconds
```

The right-hand side is the only total; every left-hand term is a per-thing bound, and
`spring.lifecycle.timeout-per-shutdown-phase` is **per phase** despite also defaulting to 30s
([08b](08b-prestop-and-termination-grace-period.md)).

**★ Raising a Spring timeout without raising the pod's grace period makes things strictly worse.**
The application waits longer; the platform kills at the same moment, now more likely mid-teardown.

## The audit for a service that already exists

| Question | Where the answer is | The bad answer |
|---|---|---|
| Does SIGTERM reach the JVM? | `kill -TERM` locally, watch the log | "Shutdown always takes 30 seconds" |
| Is there a `preStop` hook? | the deployment manifest | none, or shorter than the probe interval |
| What is `periodSeconds × failureThreshold`? | the manifest | nobody on the team knows |
| Is `stopImmediate` set? | container factory config | unset, with a large `max.poll.records` |
| Does the total fit the grace period? | add it up | never added up |
| Is the handler idempotent? | the schema — a unique constraint | a `SELECT` before an `INSERT` |
| Which probe checks a dependency? | the manifest and the health config | the liveness one |

## Gotchas

**★ Doing step 5 first is the default failure.** Tuning timeouts is the part that feels like
engineering. It is also the part that changes nothing when the real problem is that SIGTERM never
arrived (step 1) or that traffic was still being routed (step 3).

**★ Every step is verifiable and none of them is verifiable in staging with one replica.** The
window is a race; a race with no concurrent traffic is invisible. Verify under load, or verify by
correlating production errors with deploys.

**★ A checklist run once is not a control.** These values drift: `max.poll.records` changes, a new
listener is added, someone edits the manifest. The durable artefacts are the idempotent handler and
the written-down arithmetic, not a one-off tuning session.

**★ "Zero-drop" is achievable for requests and not for duplicates.** Steps 0–5 can genuinely take
dropped requests to zero in steady state. They cannot take duplicated work to zero, because a
broker rebalance produces it with no shutdown involved at all. Promising both is over-promising.

**★ The manifest is usually owned by someone else.** Steps 3, 4 and 7 are changes to a deployment
spec. Budget for that conversation, and bring the arithmetic to it rather than a request for a
bigger number.

**★ Sidecars can undo the whole sequence.** A mesh proxy that exits on its own signal removes your
network mid-drain. Where ordered sidecar shutdown is supported, use it; otherwise the sidecar needs
a `preStop` at least as long as yours ([08b](08b-prestop-and-termination-grace-period.md)).

**★ Nothing on this list helps a SIGKILL.** `kubectl delete --force`, an OOM kill and a node
failure all skip every step here. That is the argument for step 6 standing on its own: it is the
only step that survives the process not running at all.

## Interview questions

**★ A service drops a handful of requests on every deploy. Where do you start?**
By correlating, and then by looking at what the client saw. A transport error — a reset or a
refused connection — means traffic arrived after the server stopped accepting, which is the
platform's asynchronous endpoint removal, not a shutdown-code problem. A 5xx the application
produced means teardown ordering. Duplicated work rather than errors means consumers. Those three
symptoms lead to three different halves of this topic, and guessing between them wastes the most
time.

**★ Which single change fixes the most cases?**
A `preStop` sleep, because the most common cause is not the process misbehaving — it is traffic
still being routed to a process that has correctly stopped accepting. It is also a manifest change
rather than a code change, which usually makes it the fastest thing to ship.

**★ Why check that SIGTERM arrives before tuning anything?**
Because a shell entrypoint that does not `exec` makes every other setting irrelevant: the shell is
PID 1, it neither handles nor forwards the signal, and the container is SIGKILLed at the end of the
grace period every single time. The signature is that shutdown always takes exactly
`terminationGracePeriodSeconds`, and it is a one-line fix that no amount of timeout tuning
substitutes for.

**★ You have done everything and there are still duplicates. Is the checklist wrong?**
No — duplicates are not fully preventable by anything in it. A Kafka rebalance reassigns partitions
on any group-membership change, and a client retries on any timeout, both with no shutdown
involved. Steps 0–5 reduce the rate; step 6 is what makes the remaining duplicates harmless. If the
duplicates are causing damage, the gap is in the handler, not in the shutdown configuration.

**★ Where would you look first if shutdown consistently takes the full grace period?**
Two candidates, and they are distinguishable. If nothing is logged at all, SIGTERM is not reaching
the JVM — the entrypoint. If shutdown logs appear and then stall, find the dominant term: usually a
Kafka container working through a full poll batch because `stopImmediate` is `false`, a scheduled
job with no timeout, or a leaked connection making the pool spend its full hard-coded ten seconds
every time.

**★ What do you bring to the platform team when you need a bigger grace period?**
The sum, itemised: the preStop sleep, the drain, each container's `shutdownTimeout`, the executor
waits, the pool close, with the measured numbers rather than the defaults. The ask is then a
specific value derived from evidence rather than "can we make it 300", and it comes with the note
that the same number applies to evictions and node drains, not only to deploys.

**★ Which step would you refuse to skip under time pressure?**
Step 6. Everything else changes how often something bad happens; step 6 changes whether it matters.
It is also the only step that still holds when the process is SIGKILLed, OOM-killed or the node
disappears — none of which run any shutdown code at all.

{/* FOOTER */}
