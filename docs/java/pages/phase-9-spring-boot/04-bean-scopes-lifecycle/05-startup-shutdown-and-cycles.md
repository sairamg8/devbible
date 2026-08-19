---
title: "Startup, shutdown, and reading the cycle error"
sidebar_label: "5 · Startup and shutdown"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Startup and
> Shutdown Callbacks*
> (docs.spring.io/spring-framework/reference/core/beans/factory-nature.html —
> `Lifecycle`/`SmartLifecycle`, phase ordering, the 30-second default timeout on
> the `lifecycleProcessor`) — the Spring Boot reference *SpringApplication*
> (docs.spring.io/spring-boot/reference/features/spring-application.html —
> `spring.main.lazy-initialization`, its documented downsides, `@Lazy(false)`,
> `ApplicationRunner`/`CommandLineRunner` ordering and `ApplicationReadyEvent`,
> and the `LivenessState`/`ReadinessState` definitions) — *Graceful Shutdown*
> (docs.spring.io/spring-boot/reference/web/graceful-shutdown.html — enabled by
> default, `server.shutdown=immediate` to disable,
> `spring.lifecycle.timeout-per-shutdown-phase`; graceful shutdown became the
> default in **Spring Boot 3.4**) — and the **Spring Boot 2.6 release notes**
> for circular references being prohibited by default. Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**Startup and shutdown are the two moments when the scope and lifecycle
machinery of the previous four chunks stops being theory. Startup is where every
non-lazy singleton is constructed and where a wiring mistake becomes a failed
deploy instead of a failed request. Shutdown is where the ordering you never
specified decides whether in-flight requests finish or get their database
connection closed underneath them. Both are configurable, and both defaults are
chosen to fail early rather than conveniently.**

## `Lifecycle` and `SmartLifecycle` — start and stop, not create and destroy

A different axis: `Lifecycle` (`start()`, `stop()`, `isRunning()`) is about a
component that *runs* — a message listener, a poller, a scheduler — rather than
one that merely exists. `SmartLifecycle` adds `isAutoStartup()` (start on
context refresh without an explicit call), `stop(Runnable)` for asynchronous
shutdown, and `getPhase()`.

Phases decide order, and the rule is symmetric:

- **lower phase values start first and stop last**;
- default phase for non-`SmartLifecycle` objects is `0`;
- `Integer.MIN_VALUE` starts first and stops last; `Integer.MAX_VALUE` starts
  last and stops first.

The symmetry is the point: infrastructure that everything depends on gets a low
phase, so it is up before its users and still up while they drain. The
documented default shutdown timeout per phase is **30 seconds**, configurable on
the `lifecycleProcessor` bean.

The docs also note that a `depends-on` relationship is respected: *"the
dependent side starts after its dependency, and it stops before its dependency."*

## Lazy initialization: faster start, later failure

By default every singleton is created eagerly at startup. Setting
`spring.main.lazy-initialization=true` defers each bean until something first
needs it.

```yaml
spring:
  main:
    lazy-initialization: true
```

It genuinely reduces startup time. The reference names the costs plainly, and
they are not small:

- **Misconfigured beans no longer fail at startup.** The failure surfaces the
  first time that bean is initialised — which may be in production, on the code
  path nobody exercises in staging. This throws away the property that makes DI
  wiring safe in the first place.
- **The heap must still accommodate every bean**, so it is not a memory
  optimisation; it only moves *when* the allocation happens.
- It is not the default precisely because of these risks.

Individual beans opt out with `@Lazy(false)`:

```java
@Component
@Lazy(false)                 // eagerly created even when lazy-init is global
public class SchemaValidator { }
```

**The honest use is local development**, where restart latency dominates and a
late failure costs nothing. Treating it as a production startup optimisation
trades a class of deploy-time failures for a class of runtime failures, and the
second class is far more expensive. If startup time is a production problem, the
answers are usually elsewhere — fewer beans, less eager warming, or AOT/native
compilation.

## Runners, readiness, and what "up" means

Boot distinguishes two states, and they map onto container probes:

| State | Meaning | Reached when |
|---|---|---|
| `LivenessState.CORRECT` | the application's internal state is sound; if broken, restart it | the `ApplicationContext` has been refreshed |
| `ReadinessState.ACCEPTING_TRAFFIC` | ready to serve; if refusing, route traffic elsewhere | after all `ApplicationRunner`/`CommandLineRunner` beans have run |

That second row is the practically important one: **runners execute inside the
not-ready window.** So a runner is exactly the right place for work that must
complete before the first request — warming a cache that touches several beans,
running a migration check, registering with a discovery service:

```java
@Component
@Order(10)
class WarmupRunner implements ApplicationRunner {

    private final PriceCache cache;

    WarmupRunner(PriceCache cache) { this.cache = cache; }

    @Override
    public void run(ApplicationArguments args) {
        cache.warm();                          // traffic is not routed here yet
    }
}
```

Runners are ordered by `Ordered` or `@Order`, and `ApplicationReadyEvent` is
published after all of them have been called. The docs are explicit that
liveness *"should not be based on external checks"* such as databases or
downstream APIs — a broken database means you are not *ready*, not that the JVM
should be killed and restarted, and conflating the two produces restart loops
that fix nothing.

## Graceful shutdown

**Graceful shutdown is enabled by default** — it became the default in **Spring
Boot 3.4** and remains so in 4.x. On `SIGTERM`, Jetty, Reactor Netty and Tomcat
stop accepting new requests at the network layer while in-flight requests are
allowed to complete.

```yaml
server:
  shutdown: immediate                      # disables it; the default is graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 20s        # the grace period per phase
```

`spring.lifecycle.timeout-per-shutdown-phase` is the grace period, and it is the
same per-phase timeout the `lifecycleProcessor` uses — 30 seconds by default.
When it expires, shutdown proceeds regardless and remaining requests are cut off.

⚠️ **Set it shorter than your orchestrator's termination grace period.** If
Kubernetes sends `SIGTERM` and then `SIGKILL` after 30 seconds while Spring is
still waiting out its own 30-second window, the process is killed mid-drain and
you have configured a graceful shutdown that never completes gracefully.

Destruction runs in reverse dependency order — a bean is destroyed before the
beans it depends on — which is what keeps a `DataSource` open while the services
using it are still finishing. That ordering is the reason `@PreDestroy` on a
service can still use its repository.

## Reading a circular-dependency failure

Circular references have been **prohibited by default since Spring Boot 2.6**,
so a cycle stops startup rather than being quietly resolved. Boot's failure
analysis renders the cycle as a list of beans with arrows from each to the next,
so the ring is readable directly off the report. Two things about using it:

- **The bean named first is where detection began, not the culprit.** Detection
  starts wherever bean creation happened to start, so the entry point is an
  artefact of ordering. Read the whole ring and ask which *edge* should not
  exist.
- **The cheapest edge to delete is rarely the right one.** The useful question
  is which bean in the ring is doing work that belongs to a third class.

The escape hatch, `spring.main.allow-circular-references=true`, restores the
2.5 behaviour of resolving cycles through setter injection. It is a migration
aid, not a setting — it disables detection globally, including for the next
cycle nobody has noticed. The mechanism and the real fixes belong to
**Topic 03 — Dependency injection**, chunks 8 and 9.

*(This page does not reproduce the report's exact rendering, since no
application was run to capture it.)*

## Gotchas

**Symptom:** `spring.main.lazy-initialization=true` is set in production and a
misconfigured bean brings down a single endpoint days after deploy
**Cause:** lazy init defers creation, so configuration errors surface at first use
rather than at startup — the documented downside
**Fix:** keep lazy init to local development. If specific beans must stay eager under
it, annotate them `@Lazy(false)`

**Symptom:** a message listener starts consuming before the caches it needs are warm
**Cause:** everything defaulted to phase `0`, so start order among lifecycle components
is unconstrained
**Fix:** implement `SmartLifecycle` and give the infrastructure a lower `getPhase()`
than the consumers, since lower phases start first and stop last

**Symptom:** shutdown hangs for roughly thirty seconds per phase
**Cause:** a `SmartLifecycle` component is not invoking the `Runnable` callback passed
to `stop(Runnable)`, so the processor waits out its timeout
**Fix:** invoke the callback once the component has genuinely stopped; raise the
timeout on the `lifecycleProcessor` bean only if the work legitimately takes longer

**Symptom:** graceful shutdown is configured and pods are still killed mid-request
**Cause:** the orchestrator's termination grace period is shorter than
`spring.lifecycle.timeout-per-shutdown-phase`, so `SIGKILL` arrives while Spring is
still draining
**Fix:** set the Spring timeout comfortably below the orchestrator's grace period so
the drain can actually finish

**Symptom:** a liveness probe fails whenever the database is down, and the orchestrator
restarts every pod in a loop
**Cause:** liveness was wired to an external dependency; the docs say it should not be —
a broken database is a readiness condition, not a reason to kill the JVM
**Fix:** keep liveness to internal state and put the database check behind readiness, so
traffic stops being routed without the process being restarted

**Symptom:** initialization work in an `ApplicationRunner` throws and the container
starts serving anyway
**Cause:** the assumption that a failing runner necessarily halts the application —
behaviour here is worth confirming for your Boot version rather than assumed
**Fix:** make readiness reflect the work explicitly: have the runner publish an
`AvailabilityChangeEvent` with `ReadinessState.REFUSING_TRAFFIC` on failure, so the
platform stops routing regardless

**Symptom:** startup is slow and someone proposes lazy init to fix it
**Cause:** eager creation of every singleton is real work, and it is visible
**Fix:** attack the cause rather than deferring it — fewer beans, less eager warming, or
AOT processing. Lazy init makes startup faster by making failures later, which is a
different thing from making the application faster

## Interview questions

**★ What is the difference between `@PostConstruct` and `SmartLifecycle`?**
They answer different questions. `@PostConstruct` is "this object has been
created and wired" — a one-time initialization hook tied to bean creation.
`Lifecycle`/`SmartLifecycle` is about components that *run*: `start()`, `stop()`
and `isRunning()`, for pollers, listeners and schedulers you want started and
stopped with the context. `SmartLifecycle` adds auto-start, an asynchronous stop
callback, and a phase that orders it against other lifecycle components.

**★ How do phases work in `SmartLifecycle`?**
Lower phase values start first and stop last; higher values start last and stop
first, with `0` as the default for anything that is not a `SmartLifecycle`. The
symmetry is deliberate — infrastructure with a low phase is up before its
consumers and still up while they drain. Each phase gets a default shutdown
timeout of thirty seconds, configurable on the `lifecycleProcessor` bean, and
`depends-on` relationships are honoured on top of phases.

**★ Would you enable `spring.main.lazy-initialization` in production?**
No, and the reference's own reasoning is why: with lazy init a misconfigured
bean no longer fails at startup, so the failure moves to first use — potentially
in production, on a rarely-taken path. It is also not a memory saving, since the
heap must still accommodate every bean. It is a good local-development setting
where restart latency dominates and a late failure is free. In production it
trades deploy-time failures for runtime failures, which is the wrong direction.

**★ What is the difference between liveness and readiness, and where do runners sit?**
Liveness says the application's internal state is sound; if it is broken the
platform should restart the process. Readiness says the application can serve
traffic; if it is refusing, the platform should route elsewhere without
restarting. The application becomes live once the context is refreshed, and
becomes ready once all `ApplicationRunner` and `CommandLineRunner` beans have
completed — so runners execute inside the not-ready window, which is exactly why
they are the right place for warm-up work. The docs also warn that liveness must
not be based on external checks, because tying it to a database produces restart
loops that fix nothing.

**★ How does graceful shutdown work, and what is the trap in configuring it?**
It has been enabled by default since Spring Boot 3.4: on `SIGTERM` the embedded
server stops accepting new requests at the network layer while in-flight requests
finish, with `spring.lifecycle.timeout-per-shutdown-phase` as the grace period
and `server.shutdown=immediate` to disable it. The trap is the interaction with
the orchestrator: if Kubernetes sends `SIGKILL` after 30 seconds while Spring is
still waiting out its own 30-second window, the drain never completes. The Spring
timeout must sit comfortably below the platform's termination grace period.

**★ In what order are beans destroyed, and why does it matter?**
In reverse dependency order — a bean is destroyed before the beans it depends
on. That is what allows a service's `@PreDestroy` to still use its repository and
what keeps the `DataSource` open while the components using it are draining. It
is the same principle as `SmartLifecycle` phases, where lower phases stop last:
the things everything else depends on must outlive their users during shutdown.

**★ A cycle stops startup. How do you read the report, and what is the trap?**
Boot renders the ring as a list of beans with arrows from each to the next, so
the cycle is directly readable. The trap is assuming the bean named first is the
culprit — detection begins wherever creation happened to begin, so that entry is
an artefact of ordering rather than a diagnosis. Read the whole ring and identify
which edge should not exist; typically one of the beans is doing work that
belongs to a third class that does not exist yet.

---

← Prev: [Lifecycle callbacks](04-lifecycle-callbacks.md) · Index: [Phase 9 — Spring Boot and the web](../README.md)
