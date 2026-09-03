---
title: "The 503s during a rolling update are not a load-balancer problem, a Kubernetes problem or a flaky-client problem — they are a shutdown problem, and they are invisible because every component involved reports success"
sidebar_label: "01 · The deploy that dropped requests"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Kubernetes documentation** — "Pod Lifecycle → Termination of
> Pods" ([kubernetes.io](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)) and
> "Container Lifecycle Hooks" — and the **Spring Boot 4.1** reference "Graceful Shutdown"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.
> 🔴 **No sandbox** — no cluster was run and no log line below is a capture; the sequences are
> derived from the documented behaviour and are labelled as such.

**Every deploy, a handful of requests fail. Not enough to page anyone, enough to sit in the
error budget forever. The application logs show a clean shutdown. The new pods start fine. The
load balancer reports healthy targets. Nothing is broken, and requests are still being
dropped.**

## The shape of the failure

A rolling update replaces pods one at a time. For each replacement there is a window in which
the cluster believes an instance can serve traffic and the instance has already decided it
cannot. Requests that arrive in that window fail — as connection resets, as 502s from the
proxy, or as 503s if the application answered at all.

🔴 **The window exists because two things happen concurrently, not in sequence.** Kubernetes
documents them as simultaneous:

> *"At the same time as the kubelet is starting graceful shutdown of the Pod, the control plane
> evaluates whether to remove that shutting-down Pod from EndpointSlice objects"*

The kubelet sends `SIGTERM` **while** the control plane is still propagating the endpoint
removal outward — to every kube-proxy, every ingress controller, every service mesh sidecar and
every cloud load balancer. The signal arrives in microseconds; the propagation takes as long as
it takes. Anything holding a stale endpoint keeps sending during that gap.

⚠️ **This is not a bug and it cannot be configured away.** Distributed routing state is
eventually consistent by nature. The application's job is to keep serving through the gap, and
that is the whole design principle of this topic.

## Five independent causes, one symptom

The same handful of failed requests can come from any of these, and real deployments usually
have more than one:

1. **The process dies instantly on `SIGTERM`** because nothing installed a handler, or because
   the signal never reached the JVM at all — the shell-wrapper problem in
   [02b](02b-the-shell-that-swallowed-sigterm.md).
2. **The application stops accepting before the routing layer stops sending**
   (**08** *(not written yet)*) — the propagation gap above.
3. **In-flight requests are cut off** because the server does not drain, or drains for less
   time than the slowest request takes ([04](04-spring-graceful-shutdown.md)).
4. **Something below the web layer closes first** — the connection pool, the cache client, a
   thread pool — so requests that are still being served fail on a dependency that has already
   gone ([05](05-the-order-of-teardown.md)).
5. **The grace period expires and `SIGKILL` arrives** mid-request. Kubernetes: *"When the grace
   period expires, if there is still any container running in the Pod, the kubelet triggers
   forcible shutdown"*, sending `SIGKILL` to every remaining process.

🔴 **Cause 4 is the one that survives the first round of fixes**, because enabling graceful
shutdown solves 1 and 3, makes 2 visible, and does nothing for teardown ordering.

## Why nobody attributes it to shutdown

- **The dying instance's logs look perfect.** It received a signal, it shut down, it exited 0.
  The requests it never answered were never logged, because they never arrived at a handler.
- **The proxy logs show the failure but not the cause** — an upstream reset is
  indistinguishable from a crash.
- **The client retried and succeeded**, so the user saw nothing, so nobody investigated.
- **It correlates with deploys, and deploys change the code**, so the change is blamed first.
- **It is a small percentage.** A rolling update of ten pods with a 1-second gap and 100 rps is
  a few hundred failures — invisible in a daily error rate, fatal to a strict SLO.

⚠️ **The tell is the correlation, not the volume**: errors that cluster tightly around every
deployment, every scale-in, and every node drain — and nowhere else.

## What "graceful" actually has to mean

Shutting down without dropping work requires all of the following, in this order, and each has
its own page in this topic:

1. **Receive the signal** — `SIGTERM` reaches the JVM, not a shell ([02](02-signals.md)).
2. **Fail readiness first**, and keep serving, so the routing layer removes you before you stop
   accepting (**08** *(not written yet)*).
3. **Stop accepting new work** at the network layer, while continuing to finish what is in
   flight ([04](04-spring-graceful-shutdown.md)).
4. **Finish in-flight requests** inside a bounded grace period
   ([04b](04b-what-graceful-actually-drains.md)).
5. **Stop background work** — schedulers, executors, message consumers — without abandoning a
   half-completed unit ([06](06-executors-and-schedulers.md), **06b** *(not written yet)*).
6. **Close resources last** — pools, clients, files (**07** *(not written yet)*).
7. **Exit before the grace period expires**, or be killed (**08b** *(not written yet)*).

🔴 **And accept that it is best-effort.** A node can vanish; a `SIGKILL` can arrive; a network
partition can strand an in-flight request. Graceful shutdown reduces the number of failures it
is possible to prevent — it does not make the system exactly-once
(**09** *(not written yet)*).

## The good news about Spring Boot 4.1

The single most common historical cause of this failure — graceful shutdown being off by
default — is gone:

> *"Graceful shutdown is enabled by default with all three embedded web servers (Jetty, Reactor
> Netty, and Tomcat) and with both reactive and servlet-based web applications."*

⚠️ **That is a change from older Boot versions, where `server.shutdown` defaulted to
`immediate`** and every blog post told you to turn it on. On 4.1 the property exists to turn it
*off*. Most of the remaining work is the ordering and the readiness handshake, which no default
can do for you.

## Gotchas

🔴 **The gap between "endpoint removed" and "nothing routes here any more" is unbounded in
principle.** Design for it by continuing to serve after failing readiness, not by guessing a
number — though a number is what you will eventually configure.

🔴 **A clean shutdown log proves the process exited tidily, not that no requests were lost.**
The dropped ones are not in your logs at all.

⚠️ **Client retries hide the problem and shift the cost.** An idempotent GET retried
transparently is invisible; a non-idempotent POST retried is a duplicate
(**09** *(not written yet)*).

⚠️ **Scale-in has the same failure mode as a deploy** and is often more frequent. So does a
node drain, a spot-instance reclaim and an eviction.

⚠️ **`kubectl delete --grace-period=0 --force` skips all of this.** Kubernetes warns that the
API server does not wait for the kubelet's confirmation — the resource *"may continue to run on
the cluster indefinitely"*.

⚠️ **Every layer reports success**, which is why this is diagnosed by correlation with deploy
timestamps rather than by reading an error message.

## Interview questions

**★ Why do requests fail during a rolling update even when the application shuts down cleanly?**
Because endpoint removal and `SIGTERM` happen concurrently — Kubernetes documents the control
plane evaluating EndpointSlice removal *at the same time* as the kubelet begins shutdown. Until
that removal propagates to every proxy and load balancer, traffic keeps arriving at an instance
that has already begun stopping.

**★ Name the independent causes that produce the same symptom.**
No signal handling (or a signal that never reached the JVM), stopping accepting before the
routing layer stops sending, cutting off in-flight requests, closing dependencies before the
requests using them finish, and `SIGKILL` at the end of the grace period.

**★ Which of those does enabling graceful shutdown fix?**
Cutting off in-flight requests, and — given a working signal path — instant death on `SIGTERM`.
It does not fix the readiness propagation gap and it does not fix teardown ordering.

**★ Why is this failure so rarely attributed to shutdown?**
The dying instance's logs look clean, the dropped requests were never handled so they are not
logged, proxies report a generic upstream failure, clients often retried successfully, and the
volume is small — it is found by correlating errors with deploy times.

**★ What changed in Spring Boot 4.1 relative to older advice?**
Graceful shutdown is enabled by default for Jetty, Reactor Netty and Tomcat, in both servlet
and reactive applications. Older guidance to set `server.shutdown=graceful` describes versions
where `immediate` was the default.

**★ Can the routing propagation gap be eliminated by configuration?**
No. It is inherent to eventually-consistent distributed routing state. The application must
keep serving through it — fail readiness first, keep accepting for a while, then stop.

Next: [Signals](02-signals.md).

{/* FOOTER */}
