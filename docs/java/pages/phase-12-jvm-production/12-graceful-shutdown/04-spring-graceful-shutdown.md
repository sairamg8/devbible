---
title: "Graceful shutdown is on by default in Spring Boot 4.1, which means the property most tutorials tell you to set now exists to turn it off — and the timeout that actually governs it has a different name entirely"
sidebar_label: "04 · Spring's graceful shutdown"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1 reference**, "Web → Graceful Shutdown"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)),
> and the **Spring Boot application-properties appendix**, which lists `server.shutdown` with
> default **`graceful`** and `spring.lifecycle.timeout-per-shutdown-phase` with default
> **`30s`**. Version spine: Spring Boot 4.1.0 / Spring Framework 7.0.8, JDK 25.
> 🔴 **No sandbox** — no application was started or stopped for this page.

**Two properties, one of which is not the one you think, and a default that changed.**

## What is on by default

> *"Graceful shutdown is enabled by default with all three embedded web servers (Jetty, Reactor
> Netty, and Tomcat) and with both reactive and servlet-based web applications."*

🔴 **Note the list: Jetty, Reactor Netty, Tomcat.** Undertow is not in it. If you have inherited
advice that names four servers, it predates this documentation — check what your application
actually runs before assuming behaviour.

And the appendix confirms the default: `server.shutdown` — *"Type of shutdown that the server
will support"* — **`graceful`**.

⚠️ **Almost every article about Spring graceful shutdown tells you to set
`server.shutdown=graceful`.** On Boot 4.1 that is a no-op restating the default. The property is
now useful mainly for the opposite:

> *"To disable graceful shutdown, configure the `server.shutdown` property"* — `server.shutdown=immediate`.

## Where it happens in the lifecycle

> *"It occurs as part of closing the application context and is performed in the earliest phase
> of stopping SmartLifecycle beans."*

🔴 **"Earliest phase of stopping" is the design.** Spring stops `SmartLifecycle` beans in
descending phase order, and the web server's drain runs first — so the server stops taking new
work before anything it depends on is torn down. That is the ordering guarantee
[05](05-the-order-of-teardown.md) builds on, and it is why your own beans need to declare their
phase rather than hope ([05b](05b-smartlifecycle-and-phases.md)).

## The timeout is not a server property

> *"This stop processing uses a timeout which provides a grace period during which existing
> requests will be allowed to complete but no new requests will be permitted. To configure the
> timeout period, configure the `spring.lifecycle.timeout-per-shutdown-phase` property"*

```properties
spring.lifecycle.timeout-per-shutdown-phase=20s
```

The appendix defines it as the *"Timeout for the shutdown of any phase (group of SmartLifecycle
beans with the same 'phase' value)"*, default **`30s`**.

🔴 **Read "per phase" literally — this is the single most consequential detail on this page.**
It is not a total shutdown budget. Every phase gets its own timeout, so an application with
beans in several phases can, in the worst case, take that timeout multiplied by the number of
phases.

⚠️ **And the default is exactly Kubernetes' default `terminationGracePeriodSeconds`**
([02](02-signals.md)). Two 30-second budgets that must nest, with the outer one also covering the
preStop hook and everything else. 🔴 **Set the Spring timeout comfortably below the Kubernetes
grace period** — otherwise `SIGKILL` arrives while Spring is still politely waiting.

## What "no new requests" means concretely

> *"The exact way in which new requests are not permitted varies depending on the web server
> that is being used. Implementations may stop accepting requests at the network layer, or they
> may return a response with a specific HTTP status code or HTTP header. The use of persistent
> connections can also change the way that requests stop being accepted."*

with the specific answer for the three supported servers:

> *"Jetty, Reactor Netty, and Tomcat will stop accepting new requests at the network layer."*

🔴 **Stopping at the network layer means a connection refused or reset, not a tidy 503.** For a
client this is indistinguishable from a crash — which is exactly why the readiness handshake in
**08** *(not written yet)* matters: nothing should still be *sending* by the
time this happens.

⚠️ **Persistent connections complicate it.** A keep-alive connection already established may
carry another request into a server that is draining; how that is handled is server-specific,
and the documentation points at each server's `shutDownGracefully` API documentation for the
details.

## A working configuration

```properties
# Spring: how long a shutdown phase may take (default 30s)
spring.lifecycle.timeout-per-shutdown-phase=20s

# Explicit rather than implicit — graceful is already the default on 4.1
server.shutdown=graceful
```

```yaml
# Kubernetes: the outer budget, which must exceed everything above
terminationGracePeriodSeconds: 45
```

⚠️ **The numbers must nest**: preStop wait + Spring's phases + exit, all inside
`terminationGracePeriodSeconds`. Deriving them is **08b** *(not written yet)*.

## Gotchas

🔴 **`spring.lifecycle.timeout-per-shutdown-phase` is per phase, not per shutdown.** An
application with beans spread across several phases can take a multiple of it.

🔴 **The Spring timeout defaults to 30s and Kubernetes' grace period defaults to 30s.** Left
alone, they collide — the pod is killed exactly as the last phase times out.

⚠️ **Setting `server.shutdown=graceful` on 4.1 changes nothing.** It is already the default;
harmless as documentation, useless as a fix.

⚠️ **Undertow is not in the documented list of servers with graceful shutdown by default.**
Verify rather than assume.

⚠️ **Graceful shutdown covers the *web server*, not your background work.** Schedulers,
executors and message consumers are separate ([06](06-executors-and-schedulers.md),
**06b** *(not written yet)*).

⚠️ **New requests are refused at the network layer**, so a client that has not yet been steered
away sees a connection error, not a graceful status code.

⚠️ **A request that runs longer than the phase timeout is cut off anyway.** Graceful means
bounded, not unlimited — know your slowest legitimate request
([04b](04b-what-graceful-actually-drains.md)).

⚠️ **Shutdown from an IDE may not exercise any of this**, because the IDE may not send a proper
`SIGTERM` — the documentation says so explicitly.

## Interview questions

**★ Is graceful shutdown enabled by default in Spring Boot 4.1?**
Yes — for Jetty, Reactor Netty and Tomcat, in both servlet and reactive applications. The
`server.shutdown` property's documented default is `graceful`, and setting it to `immediate` is
how you turn the feature off.

**★ Which property controls the drain timeout?**
`spring.lifecycle.timeout-per-shutdown-phase`, default `30s`. Not `server.shutdown`, which
selects the *type* of shutdown.

**★ Why does "per phase" matter?**
Because the timeout applies to each group of `SmartLifecycle` beans sharing a phase value, not
to the shutdown as a whole. An application with several phases can take that timeout multiplied
by the number of phases — which can exceed the container's grace period.

**★ Where in the lifecycle does the web server drain?**
In the earliest phase of stopping `SmartLifecycle` beans, as part of closing the application
context — so it stops accepting before the beans it depends on are torn down.

**★ How do the supported servers reject new requests during the grace period?**
Jetty, Reactor Netty and Tomcat stop accepting at the network layer. Other implementations may
instead return a specific status code or header, and persistent connections can change the
behaviour.

**★ What is the danger of leaving both defaults at 30 seconds?**
The Spring phase timeout and Kubernetes' `terminationGracePeriodSeconds` are then equal, so the
pod can be `SIGKILL`ed at the exact moment Spring is still waiting for a phase to finish. The
inner budget must be comfortably smaller than the outer one.

**★ Does Spring's graceful shutdown drain your `@Scheduled` tasks and message listeners?**
No. It governs the web server's request draining. Background executors, schedulers and message
consumers have their own lifecycles and their own failure modes.

Next: [What graceful actually drains](04b-what-graceful-actually-drains.md).

{/* FOOTER */}
