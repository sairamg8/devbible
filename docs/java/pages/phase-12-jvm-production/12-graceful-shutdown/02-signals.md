---
title: "SIGTERM is a request and SIGKILL is not — everything in this topic happens in the interval between them, which is a number in your pod spec that most teams have never set"
sidebar_label: "02 · Signals"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Kubernetes documentation** — "Pod Lifecycle → Termination
> of Pods" ([kubernetes.io](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)),
> which supplies the default grace period, the TERM-to-PID-1 behaviour, the container ordering
> statement and the forcible-shutdown wording quoted below.
> 🔴 **No sandbox** — no cluster or container was run for this page.

**Two signals matter and only one of them is negotiable. Everything a graceful shutdown does
happens inside the window between them.**

## `SIGTERM` — the polite one

`SIGTERM` (15) asks a process to terminate. It can be caught, and a JVM catches it by default:
the JVM's own handler starts shutdown-hook processing ([03](03-shutdown-hooks.md)), which is how
a Spring Boot application learns it is being stopped.

🔴 **`SIGTERM` is delivered to PID 1 inside the container**, which is the crux of the wrapper
problem:

> *"The kubelet triggers the container runtime to send a TERM signal to process 1 inside each
> container."*

If PID 1 is your JVM, it gets the signal. If PID 1 is a shell that launched your JVM, the shell
gets it — see [02b](02b-the-shell-that-swallowed-sigterm.md).

⚠️ **Containers in a Pod receive TERM at different times and in an arbitrary order**, per the
same document — *"the containers in the Pod receive the TERM signal at different times and in an
arbitrary order. If the order of shutdowns matters, consider using a preStop hook to synchronize
(or switch to using sidecar containers)."* An application that depends on its sidecar proxy
still being alive during drain is depending on something Kubernetes does not promise. Sidecar
containers (init containers with `Always` restart policy) are the documented exception: the
kubelet *"will delay sending the TERM signal to these sidecar containers until the last main
container has fully terminated."*

## `SIGKILL` — the one you cannot handle

`SIGKILL` (9) cannot be caught, blocked or ignored. The kernel destroys the process. No
shutdown hook runs, no `finally` block executes, no connection is closed politely, no message is
acknowledged.

> *"When the grace period expires, if there is still any container running in the Pod, the
> kubelet triggers forcible shutdown. The container runtime sends SIGKILL to any processes still
> running in any container in the Pod."*

🔴 **So the grace period is a hard budget for everything in this topic**, and the default is
smaller than most people assume:

> *"The default terminationGracePeriodSeconds setting is 30 seconds."*

⚠️ **Thirty seconds must cover the preStop hook, the readiness propagation wait, in-flight
request draining, background task completion and resource teardown — combined.** Kubernetes
spells out that the budget is shared: with a 60-second grace period, a 55-second hook and a
10-second stop, *"the Container will be killed before it can stop normally, since
terminationGracePeriodSeconds is less than the total time (55+10)"*.

## The other signals worth knowing

- **`SIGINT` (2)** — what Ctrl-C sends. The JVM treats it like `SIGTERM` for shutdown-hook
  purposes, which is why a local Ctrl-C exercises the same path.
- **`SIGQUIT` (3)** — 🔴 **not a shutdown signal for a JVM.** HotSpot uses it to print a thread
  dump to standard output and keeps running (topic 05 owns thread dumps). Sending `SIGQUIT`
  expecting a shutdown produces a large log entry and a still-running process.
- **`SIGHUP` (1)** — traditionally "reload"; the JVM treats it as a termination signal for
  shutdown-hook purposes, and it is what a closing terminal sends to its process group.
- **`StopSignal`** — Kubernetes documents a container lifecycle `StopSignal` that overrides
  which signal is sent when a container is stopped. If someone has set it, the signal your JVM
  receives may not be `SIGTERM` at all.

## Local, Docker and Kubernetes — the same signal, three delivery paths

| Context | What sends `SIGTERM` | Common failure |
|---|---|---|
| Terminal | Ctrl-C (`SIGINT`), `kill <pid>` | None — but an IDE may not send a proper signal at all |
| `docker stop` | Docker, to PID 1, then `SIGKILL` after its own timeout | Shell as PID 1 swallows it |
| Kubernetes | kubelet, to PID 1 in each container, after the preStop hook starts | Same, plus the grace-period budget |

⚠️ **Spring Boot's own documentation flags the IDE case**: *"Shutdown in your IDE may be
immediate rather than graceful if it does not send a proper SIGTERM signal."* A graceful
shutdown that "does not work locally" is often the IDE, not the code.

## What the JVM does with it

The JVM's default `SIGTERM` handling starts the shutdown sequence: registered shutdown hooks run
concurrently, and when they finish the JVM exits. That is the *only* hook the operating system
gives you, and it is why Spring's shutdown, the web server's drain and your `@PreDestroy` methods
all ultimately hang off it.

🔴 **`Runtime.halt` bypasses it entirely** — no hooks, immediate exit
([03](03-shutdown-hooks.md)). A library or framework calling `halt` during shutdown is
functionally a self-inflicted `SIGKILL`.

## Gotchas

🔴 **If PID 1 is not the JVM, nothing else in this topic matters.** Verify with a real signal,
not by reading the Dockerfile.

🔴 **The grace period is a shared budget, not a per-step allowance.** preStop plus drain plus
teardown must fit inside it, or `SIGKILL` lands mid-request.

⚠️ **30 seconds is the Kubernetes default, and it is a *default*, not a recommendation.** A
service whose slowest legitimate request takes 25 seconds cannot drain within it.

⚠️ **`SIGQUIT` prints a thread dump; it does not stop a JVM.** Do not wire it into a stop script.

⚠️ **Container TERM ordering within a Pod is arbitrary** unless you use sidecar containers or a
preStop hook to synchronise. An app that needs its proxy alive while draining must arrange that.

⚠️ **`docker stop` has its own timeout** (its default differs from Kubernetes'), so behaviour
that looks fine locally can be cut short in the cluster, or vice versa.

⚠️ **A `StopSignal` set on the container changes which signal arrives.** If shutdown behaviour
looks inexplicable, check whether the signal is the one you assumed.

## Interview questions

**★ What is the difference between `SIGTERM` and `SIGKILL` for a JVM?**
`SIGTERM` can be caught; the JVM's handler begins shutdown-hook processing, so the application
can drain. `SIGKILL` cannot be caught or handled — the process is destroyed immediately, with no
hooks, no `finally` blocks and no clean closes.

**★ Which process receives the signal in a container, and why does it matter?**
PID 1. If PID 1 is a shell wrapping the JVM, the shell receives the signal and the JVM may never
see it — the application then dies only when the grace period expires and `SIGKILL` arrives.

**★ What is the default `terminationGracePeriodSeconds`, and what must fit inside it?**
30 seconds, and it covers everything: the preStop hook, any readiness-propagation wait, request
draining, background work and resource teardown. Kubernetes states explicitly that the hook and
the container stop share the same budget.

**★ What does `SIGQUIT` do to a JVM?**
It triggers a thread dump to standard output; the JVM keeps running. It is a diagnostic signal,
not a shutdown signal.

**★ In what order do containers in a Pod receive `SIGTERM`?**
An arbitrary order, at different times — Kubernetes says so and recommends a preStop hook or
sidecar containers if ordering matters. Sidecar containers are the documented exception: their
TERM is delayed until the last main container has terminated.

**★ Why might graceful shutdown appear not to work when run from an IDE?**
Because the IDE may not send a proper `SIGTERM` — Spring Boot's documentation notes shutdown
there *"may be immediate rather than graceful"*. Test with a real signal to the process.

**★ What is the relationship between `SIGTERM` handling and shutdown hooks?**
The JVM's `SIGTERM` handler starts shutdown-hook processing, and that is the only operating
system hook available. Everything the framework does on shutdown ultimately hangs off it — which
is also why `Runtime.halt`, which skips hooks, is so destructive.

Next: [The shell that swallowed SIGTERM](02b-the-shell-that-swallowed-sigterm.md).

{/* FOOTER */}
