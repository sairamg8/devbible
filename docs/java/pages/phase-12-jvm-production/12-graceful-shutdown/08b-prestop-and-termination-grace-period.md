---
title: "The termination grace period starts counting before the preStop hook runs, so the sleep that buys you the propagation window is spent out of the same thirty seconds as the drain, the lifecycle stops and the pool close — and Kubernetes prints the worked example where that arithmetic gets a container killed"
sidebar_label: "08b · preStop and the grace period"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the **Kubernetes** documentation · *Container Lifecycle Hooks* — the
> `PreStop` description, the grace-period countdown statement with its worked example, the three
> handler types and the at-least-once delivery guarantee
> ([kubernetes.io](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/)) and
> *Pod Lifecycle* for the termination flow and the 30-second default
> ([kubernetes.io](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)); and the
> **Spring Boot 4.1** *Kubernetes Container Lifecycle* how-to for both `preStop` YAML forms, the
> sizing rule and the `terminationGracePeriodSeconds` guidance
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/deployment/cloud.html)).
> 🔴 **No sandbox.** No pod was deleted and no hook was executed. Every number here is a documented
> default or a documented example, attributed. JDK 25 · Spring Boot 4.1.0.

**[08](08-readiness-and-the-load-balancer.md) established that the fix for the propagation window
is a delay before SIGTERM rather than a longer drain. This page is that delay: what it looks like,
and the single fact that decides whether it helps or hurts — the grace-period countdown starts
before the hook runs, so every second of sleep is a second the rest of your shutdown no longer
has.**

## The hook

Two forms, and which one you can use depends on the cluster version rather than on preference.

```yaml
# Kubernetes 1.32+: the native Sleep handler
spec:
  containers:
  - name: "example-container"
    image: "example-image"
    lifecycle:
      preStop:
        sleep:
          seconds: 10
```

```yaml
# earlier clusters: exec a shell
spec:
  containers:
  - name: "example-container"
    image: "example-image"
    lifecycle:
      preStop:
        exec:
          command: ["sh", "-c", "sleep 10"]
```

**★ Prefer the native `sleep` handler for a reason that has nothing to do with elegance: the
`exec` form needs a shell and a `sleep` binary inside your image, and the images
[10 · Packaging for deploy](../10-packaging-for-deploy/README.md) recommends may have neither.** A
distroless or JRE-only base image can fail this hook, and the failure is quiet — you get the
propagation window you thought you had bought only if the command actually ran.

Kubernetes lists three handler types — *"Exec"*, *"HTTP"* and *"Sleep"* — and the `Sleep` one
exists precisely because this pattern is so common that shelling out for it was absurd.

## The fact that decides everything

> *"The Pod's termination grace period countdown begins before the `PreStop` hook is executed, so
> regardless of the outcome of the handler, the container will eventually terminate within the
> Pod's termination grace period."*

**★ The sleep is not free time. It is time taken from the drain.** Almost every write-up of this
pattern presents `preStop` as something that happens "before the clock starts". It is the exact
opposite: the clock is already running.

Kubernetes then prints the failure case itself, which is worth quoting in full because it is the
whole argument:

> *"If, for example, `terminationGracePeriodSeconds` is 60, and the hook takes 55 seconds to
> complete, and the Container takes 10 seconds to stop normally after receiving the signal, then
> the Container will be killed before it can stop normally, since `terminationGracePeriodSeconds`
> is less than the total time (55+10) it takes for these two things to happen."*

55 + 10 > 60, so the container is SIGKILLed five seconds into a ten-second shutdown it would have
completed. **Adding a `preStop` sleep to a service whose grace period was already about right is a
reliable way to start dropping the requests you were trying to save.**

## The budget, added up properly

Everything in this topic lands in one inequality:

```
preStop sleep
  + web server drain                                (04, 04b)
  + listener container stops   Kafka 10s / AMQP 5s  (06b)
  + executor awaitTermination                       (06, 06a)
  + bean destruction: pools ≤ 10s, clients          (07)
  + JVM exit
< terminationGracePeriodSeconds        (default 30s)
```

**★ Only the right-hand side is a total. Every term on the left is a separate per-thing timeout,
and none of them knows about any of the others.** `spring.lifecycle.timeout-per-shutdown-phase`
defaults to 30s and is applied **per phase**; Kubernetes' 30s covers the entire left-hand side.
Two identical-looking defaults, measuring completely different things, is the collision at the
centre of this topic.

Boot states the consequence directly: if the application takes longer than 30 seconds to shut
down — for instance because `spring.lifecycle.timeout-per-shutdown-phase` was increased — then
`terminationGracePeriodSeconds` must be increased in the pod spec to match.

**★ Raising a Spring timeout without raising the pod's grace period converts a slow shutdown into
a killed one.** The Spring side now waits longer; the platform side still kills at 30 seconds. The
change makes the outcome strictly worse, and it is the most common single mistake in this area.

## Choosing the numbers

There are only three decisions, in this order:

1. **The sleep.** Boot's rule: *"The delay should be at least as long as the longest time it takes
   to process an in-flight request."* Cross-check against the deployment's
   `periodSeconds × failureThreshold`, which is the readiness propagation term from
   [08](08-readiness-and-the-load-balancer.md) and is usually the larger of the two.
2. **The grace period.** Sum the left-hand side above with your real numbers, add margin, and set
   `terminationGracePeriodSeconds` to that. It is a field in the pod spec; there is no reason to
   leave it at 30 if 30 is wrong for your service.
3. **The Spring timeouts.** Only after the first two, and only downwards if the total does not fit
   — a shorter `spring.lifecycle.timeout-per-shutdown-phase` is a deliberate choice to abandon
   slow in-flight work rather than be killed mid-teardown.

**★ Shortening a timeout is a legitimate answer.** Being SIGKILLed at an arbitrary point is worse
than abandoning a known set of slow requests at a point you chose, because the first can happen
during pool destruction and the second cannot.

## When the grace period elapses

The container is sent **SIGKILL**. There is no handler, no shutdown hook, no `finally`, and no
flush. [03 · Shutdown hooks](03-shutdown-hooks.md) covered what a JVM does with SIGTERM; SIGKILL is
the case where none of that applies.

**★ A SIGKILL during bean destruction is the worst possible moment to be killed.** The web server
has stopped, so nothing is being served; the consumers have stopped without necessarily committing
([06b](06b-message-consumers.md)); the pool may be mid-abort ([07](07-connection-pools.md)). You
get the downtime of a shutdown with none of its benefits.

**★ If a `preStop` hook hangs, the pod sits in `Terminating` until the grace period expires** — the
documentation is explicit that the phase *"will be `Terminating` and remain there until the Pod is
killed after its `terminationGracePeriodSeconds` expires."* A hook that shells out to something
that can block is a way to guarantee every pod is SIGKILLed.

## Hooks are at-least-once

> *"Hook delivery is intended to be _at least once_, which means that a hook may be called multiple
> times for any given event, such as for `PostStart` or `PreStop`. It is up to the hook
> implementation to handle this correctly."*

**★ A sleep is idempotent, which is a large part of why the sleep is the recommended hook.** The
moment your `preStop` does something — deregisters from a discovery service, posts a notification,
writes a file — you have taken on a duplicate-execution problem in the one place where you have no
logs and no error handling. This is the third place in this topic where the answer is idempotency;
**09 · Idempotency as the backstop** *(not written yet)* is where it is finally addressed as a
subject rather than a footnote.

## Gotchas

**★ The countdown starts before the hook, not after it.** If you take one thing from this page,
that is it. `terminationGracePeriodSeconds` is a budget that includes the sleep.

**★ Kubernetes' 30s and `spring.lifecycle.timeout-per-shutdown-phase`'s 30s are not comparable
numbers.** One is a total for the pod; the other is per lifecycle phase, and a service can have
several. Seeing the same "30" in two places has convinced many teams the defaults were designed to
agree.

**★ The `exec` form needs a shell and `sleep` in the image.** Distroless and JRE-only images may
have neither, and the hook simply does not do what you think. On 1.32+ use the native `sleep`
handler and the question disappears.

**★ A `preStop` sleep does not help a pod that is being evicted for resource pressure the way it
helps a rolling deploy.** The hook still runs, but the reason for termination is usually urgent and
the grace period may be overridden. It is a deploy-safety mechanism first.

**★ `kubectl delete --force` skips all of this.** Grace period zero means no hook and no SIGTERM.
It is a fine tool for a stuck pod and a terrible habit in a runbook.

**★ Sidecar containers change the arithmetic.** A service mesh proxy that exits when it is signalled
can remove your network before your drain finishes, so your in-flight requests fail during the very
window you extended. Where the platform supports ordered sidecar shutdown, use it; otherwise the
sidecar needs a `preStop` at least as long as yours.

**★ Nothing in the pod spec knows what your application does.** The grace period is a number a
human wrote in a manifest, usually copied from another manifest. It is the only total in the whole
system, and it is the least likely value to have been derived from measurement.

**★ Bean destruction has no timeout of its own.** Everything in the lifecycle step is bounded by a
Spring property; the destruction step in [07](07-connection-pools.md) is bounded only by the
library's own internals — Hikari's hard-coded ten seconds, and whatever your other clients do. That
tail is the part of the budget people forget to include.

## Interview questions

**★ Does the `preStop` hook run before or inside the termination grace period?**
Inside. The documentation is explicit: *"The Pod's termination grace period countdown begins before
the `PreStop` hook is executed."* So a 10-second sleep on a 30-second grace period leaves 20
seconds for everything else — the drain, the listener containers, the executors, the pool close and
the JVM exit.

**★ Reproduce the worked example Kubernetes gives for getting this wrong.**
`terminationGracePeriodSeconds: 60`, a hook that takes 55 seconds, and a container that needs 10
seconds to stop after SIGTERM. 55 + 10 = 65 > 60, so the container is SIGKILLed. The documentation
states it exactly that way, and the shape generalises: adding a `preStop` sleep to a service whose
grace period was already only just sufficient makes it worse, not better.

**★ Someone raises `spring.lifecycle.timeout-per-shutdown-phase` to 60s to stop requests being cut
off. What have they actually done?**
Made it worse, unless they also raised `terminationGracePeriodSeconds`. Boot's guidance says as
much: if the application now takes longer than 30 seconds to shut down, the pod's grace period must
be increased to match. Otherwise the application waits longer and the platform kills it at the same
moment as before — now more likely to be mid-teardown, during bean destruction, which is the worst
point to be killed.

**★ How many timeouts are involved in one shutdown, and which is the total?**
The `preStop` sleep, the web server drain, each listener container's `shutdownTimeout` (Kafka 10s,
AMQP 5s), the executors' `awaitTermination`, and the pools' own close behaviour (Hikari's
hard-coded 10s) — plus `spring.lifecycle.timeout-per-shutdown-phase`, which applies **per phase**.
`terminationGracePeriodSeconds` is the only total. Everything else is a per-thing bound that knows
nothing about its neighbours.

**★ Why is a sleep the recommended `preStop` action rather than something more useful, like
deregistering from service discovery?**
Because hook delivery is *"at least once"* and *"it is up to the hook implementation to handle this
correctly"*. A sleep is idempotent; a deregistration or a notification is not, and it runs in a
context with no logging, no error handling and no retry policy of your own. If you need
deregistration, do it from inside the application on the readiness event, where you can observe it.

**★ What happens if the `preStop` hook hangs?**
The pod stays in `Terminating` until the grace period expires and is then killed. The application
never receives SIGTERM at all, so nothing you built in this topic runs — no drain, no orderly
teardown. A hook that can block is strictly worse than no hook.

**★ Your service is SIGKILLed on every deploy. Walk through the diagnosis.**
Add up the left-hand side against `terminationGracePeriodSeconds` with real numbers, in order:
sleep, drain, container stops, executor waits, pool close. The usual finding is one term dominating
everything else — a Kafka container working through a full poll batch because `stopImmediate` is
false ([06b](06b-message-consumers.md)), a scheduled job with no timeout, or a leaked connection
making the pool take its full ten seconds every time
([07](07-connection-pools.md)). Fix the dominant term first; raise the grace period only when the
remaining total genuinely needs it.

**★ You are on Kubernetes 1.30 with a distroless image. What is the catch with `preStop`?**
The native `sleep` handler is not available, so you need the `exec` form — and a distroless image
has no shell and no `sleep` binary for it to run. Either use a base image that has them, ship a
tiny static sleep binary, or accept that the propagation window has to be covered another way.
Writing the `exec` form and assuming it worked is the failure that is hardest to notice, because
everything else about the deploy looks normal.

{/* FOOTER */}
