---
title: "What belongs in each probe"
sidebar_label: "6 · What belongs in each probe"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.0 reference — *Actuator ·
> Endpoints · Health · Kubernetes Probes*
> (docs.spring.io/spring-boot/reference/actuator/endpoints.html: the default
> composition of the liveness and readiness groups, the
> `management.endpoint.health.group.readiness.include` example, and
> `AvailabilityChangeEvent` / `LivenessState` / `ReadinessState` in the
> `org.springframework.boot.availability` package). Spring Boot 4.1.0, Spring
> Framework 7.0.x, JDK 25.

**The single most expensive mistake in this whole topic is wiring a database
check into liveness, because a thirty-second database blip then becomes an
orchestrator restarting every instance of your service simultaneously — none of
which can start, because the database is still blipping. This chunk is that
argument in full, and the much narrower rule that follows from it.**

## 🔴 Why a database check must not be in liveness

The argument only lands when you follow the sequence, so here it is. Suppose
`/actuator/health/liveness` includes a `db` check, and the liveness probe is
configured with a three-failure threshold at ten-second intervals — an entirely
ordinary configuration.

1. The database has a thirty-second interruption: a failover, a network
   partition, a connection storm, an unlucky maintenance window.
2. Every instance of your service reports liveness `DOWN` within thirty seconds.
   Not some of them — **all of them**, because they all depend on the same
   database and they all fail together.
3. The orchestrator does exactly what a failing liveness probe means and kills
   every instance.
4. Every instance restarts. Startup needs the database: connection pool
   initialisation, schema validation, a warm-up query. Startup fails or hangs.
5. The restarts add load. A fleet's worth of simultaneous connection attempts
   arrives at a database that was already struggling, so the interruption that
   would have ended after thirty seconds is now sustained by your own recovery
   attempts.
6. Liveness is still failing, so the orchestrator kills them again.

You have converted a **transient dependency blip into a self-sustaining restart
storm across the entire fleet**, and you have destroyed every piece of in-memory
state — caches, connection pools, JIT-compiled code — that would have made
recovery fast. The correct behaviour was to do nothing at all and let requests
fail for thirty seconds.

**The rule that falls out of it:** liveness answers "is this process's internal
state unrecoverable", and no external dependency can answer that question. A
database being down does not make your process broken; it makes it unable to do
useful work, which is a readiness concern at most and frequently not even that.

Boot's default is already right — the liveness group contains only
`livenessState` — so this failure is always something a team *added*. It gets
added because "liveness sounds like health", and because the health endpoint
with everything in it was the one the team already had.

## What actually belongs in liveness

Very little, which is the point. Something belongs in liveness only if it is
both **internal to the process** and **genuinely unrecoverable without a
restart**:

- a background thread pool that has died and cannot be recreated;
- a corrupted in-memory state machine with no code path to reset it;
- a partial initialisation that left the application unable to serve and that
  nothing will retry.

The mechanism for saying so is an event, not a health indicator:

```java
import org.springframework.boot.availability.AvailabilityChangeEvent;
import org.springframework.boot.availability.LivenessState;

@Component
public class EventProcessorSupervisor {

    private final ApplicationEventPublisher events;

    public EventProcessorSupervisor(ApplicationEventPublisher events) {
        this.events = events;
    }

    public void onUnrecoverableFailure(Throwable cause) {
        AvailabilityChangeEvent.publish(this.events, cause, LivenessState.BROKEN);
    }
}
```

That publishes a state change the `livenessState` indicator reflects, so the
liveness group turns `DOWN` without any dependency check being added to it. The
distinction is worth stating precisely: **you are not checking whether something
is broken, you are recording that you already know it is** — which is why
liveness evaluation stays instantaneous and cannot itself fail.

And the configuration that keeps it that way, written explicitly rather than
relied on as a default:

```properties
management.endpoint.health.group.liveness.include=livenessState
```

Writing it down matters because the failure mode is additive. Nobody sets out to
put the database in liveness; somebody adds a check to "the health group" during
an incident and the group they reach for is whichever one they can see.

## What belongs in readiness

Readiness is where a dependency check can legitimately go, and even here the
test is narrower than people expect:

> **Include a dependency only if an instance without it should stop receiving
> traffic *while other instances keep receiving it*.**

That test excludes most shared dependencies immediately. If every instance
shares the database, taking every instance out of rotation does not route
traffic anywhere better — it replaces "requests fail with a 500" with "no
healthy upstream", which is strictly worse:

- the endpoints that did **not** need the database stop working too;
- your service disappears from the request path, so your logs, your metrics and
  your error responses — the things you would use to diagnose the outage — go
  with it;
- the load balancer's failure page replaces your error handling, so clients get
  something your API contract never described.

Where readiness genuinely earns its place is **per-instance** state:

- this instance's connection pool is exhausted while others are fine;
- this instance is still warming a large local cache after start;
- this instance holds a shard or partition assignment it has not finished
  loading;
- this instance is draining before a planned shutdown.

The configuration is additive to the default group:

```properties
management.endpoint.health.group.readiness.include=readinessState,localCacheWarmup
```

## A worked shape: warm-up without blocking startup

The common real requirement — "do not send traffic until the local cache is
loaded" — is where teams reach for a blocking `@PostConstruct` and accidentally
create the "readiness never becomes ready" failure. The shape that works keeps
initialisation fast and manages the state explicitly:

```java
@Component
public class CacheWarmup implements ApplicationRunner {

    private final ApplicationEventPublisher events;
    private final ReferenceDataCache cache;
    private final Executor executor;

    // constructor omitted

    @Override
    public void run(ApplicationArguments args) {
        AvailabilityChangeEvent.publish(this.events, this, ReadinessState.REFUSING_TRAFFIC);
        CompletableFuture
                .runAsync(this.cache::load, this.executor)
                .whenComplete((ignored, failure) -> {
                    if (failure == null) {
                        AvailabilityChangeEvent.publish(this.events, this,
                                ReadinessState.ACCEPTING_TRAFFIC);
                    }
                    // on failure, stay REFUSING_TRAFFIC and let the retry loop
                    // publish ACCEPTING_TRAFFIC when it eventually succeeds
                });
    }
}
```

The application starts, the server binds, liveness is `CORRECT` — so nothing
kills it — and readiness stays refusing until the cache is genuinely usable. A
blocking load in a
[`@PostConstruct`](../04-bean-scopes-lifecycle/04-lifecycle-callbacks.md) gets
none of that: the context never finishes refreshing, readiness is never
published at all, and from the outside it is indistinguishable from a hang.

## The trade-off

Splitting the probes properly costs you a configuration you have to think about,
and it guarantees that some failure modes are invisible to the orchestrator. An
instance whose database is unreachable stays in rotation and returns errors
rather than being quietly removed, which feels worse than a self-healing system.

It is not worse, because the alternative is not "the orchestrator fixes it" —
the orchestrator cannot fix a database. The honest framing is that **an
orchestrator can do exactly two things: restart a process, and stop routing to
it.** Neither repairs a dependency. Handing it a dependency failure is asking
for the wrong remedy to be applied enthusiastically, repeatedly, and to every
instance at once.

The second cost is cultural rather than technical: "our health check does not
check the database" sounds negligent in a review, and it takes the argument
above to defend. Writing the group definitions down explicitly, with a comment,
is what stops the next incident from quietly undoing it.

## Gotchas

**Symptom:** during a database failover every instance restarts at once and the outage lasts far longer than the failover did
**Cause:** a `db` check was added to the liveness group, so a shared dependency failure became a fleet-wide restart signal
**Fix:** take it out and pin the group so it cannot drift back:
```properties
management.endpoint.health.group.liveness.include=livenessState
```

**Symptom:** readiness never becomes `ACCEPTING_TRAFFIC` and the instance is never routed to
**Cause:** the ready state is published after the context has fully refreshed, so anything blocking initialisation holds it open — a `@PostConstruct` making a network call with no timeout, an `ApplicationRunner` waiting on a queue, an eager bean retrying forever
**Fix:** move blocking warm-up out of initialisation and manage readiness around the asynchronous version, as shown above

**Symptom:** taking the database out of readiness meant an outage where every request returned 500 instead of the instances being removed
**Cause:** this is the intended behaviour, and the objection is really that the errors were not handled well
**Fix:** the answer is not to put the database back in readiness — it is to return a meaningful error for the endpoints that need the database while continuing to serve the ones that do not, which is **[topic 09 — Error handling](../09-error-handling/README.md)**'s job, not the probe's

**Symptom:** a deployment drops requests even though readiness is configured
**Cause:** readiness flipping to `REFUSING_TRAFFIC` is not instantaneous from the load balancer's point of view — it takes at least one probe interval for the change to be observed
**Fix:** graceful shutdown plus a pre-stop delay covering the probe interval; see [health groups and graceful shutdown](07-groups-and-graceful-shutdown.md)

**Symptom:** an instance whose thread pool has died keeps receiving traffic and failing every request
**Cause:** nothing published a state change — the process is running, so both probes are satisfied
**Fix:** publish it, because this is the case liveness exists for:
```java
AvailabilityChangeEvent.publish(events, cause, LivenessState.BROKEN);
```

**Symptom:** somebody adds a check to "the health group" during an incident and liveness changes behaviour as a side effect
**Cause:** the groups were left at their defaults, so their composition was invisible and there was nothing in the configuration to make the addition look wrong
**Fix:** define both groups explicitly in `application.yaml` even where the definition matches the default — a configuration that states its intent is much harder to break by accident than one that relies on a default nobody has read

## Interview questions

**★ Why is putting a database check in the liveness probe so dangerous?**
Because every instance shares the database, so a transient database failure
makes every instance report liveness failure simultaneously, and the
orchestrator does what liveness failure means: it kills all of them. They then
restart, startup requires the database, and a fleet's worth of simultaneous
reconnection attempts lands on a database that was already struggling — so the
restarts sustain the outage that caused them. A thirty-second blip becomes an
extended fleet-wide outage with every cache and connection pool destroyed. The
correct response was to do nothing and let requests fail for thirty seconds.

**★ So what does belong in liveness?**
Only conditions that are internal to the process and genuinely unrecoverable
without a restart: a dead background thread pool that cannot be recreated, a
corrupted in-memory state machine with no reset path, a partial initialisation
nothing will retry. And the mechanism is a published
`AvailabilityChangeEvent` carrying `LivenessState.BROKEN`, not a health
indicator — you are recording a failure you already know about rather than
checking for one, which is why evaluating liveness is instantaneous and cannot
itself fail.

**★ Should a readiness probe check the database?**
Almost never for a shared database. The test is: should an instance failing this
check stop receiving traffic *while other instances keep receiving it*? If every
instance shares the dependency the answer is no — removing all of them replaces
"some requests fail with a 500" with "no healthy upstream", which also kills the
endpoints that never needed the database and takes your logs, metrics and error
responses out of the request path exactly when you need them. Readiness earns
its place on per-instance conditions: a warming local cache, an unloaded shard
assignment, an exhausted pool on this instance, a deliberate drain.

**★ "But then nothing reacts when the database goes down." Is that acceptable?**
Yes, because the reactions available are restarting the process and removing it
from rotation, and neither repairs a database. What should react is your error
handling — endpoints that need the database return a meaningful failure, endpoints
that do not keep working — and your alerting, which should be watching the
database. Confusing "something should alert" with "the orchestrator should act"
is what produces restart storms.

**★ How do you implement "do not take traffic until the local cache is warm" without breaking startup?**
Publish `ReadinessState.REFUSING_TRAFFIC`, load the cache asynchronously from an
`ApplicationRunner`, and publish `ACCEPTING_TRAFFIC` when it completes. The
application then starts normally, the server binds, liveness is `CORRECT` so
nothing kills it, and readiness stays refusing until the cache is genuinely
usable. Doing the load synchronously in a `@PostConstruct` instead means the
context never finishes refreshing, so readiness is never published at all and
the instance is indistinguishable from a hang — which is the classic "readiness
never becomes ready" bug.

**★ Your team's health group definitions are all defaults. Why write them out anyway?**
Because the failure mode here is additive and social rather than technical.
Nobody decides to put the database in liveness; during an incident somebody adds
a check to "the health group" and the group they can see is whichever one is in
the file. A configuration that states both group definitions explicitly — even
where they match the defaults — makes that addition look wrong in a diff, which
is the only place it is going to be caught before it is deployed.

---

← Prev: [Liveness vs readiness](05-liveness-and-readiness.md) · Index: [Actuator](README.md) · Next → [Health groups and graceful shutdown](07-groups-and-graceful-shutdown.md)
