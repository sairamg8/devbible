---
title: "Liveness vs readiness: two states, two questions"
sidebar_label: "5 · Liveness vs readiness"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.0 reference — *Actuator ·
> Endpoints · Health · Kubernetes Probes*
> (docs.spring.io/spring-boot/reference/actuator/endpoints.html: the
> `ApplicationAvailability` interface, `LivenessState` and `ReadinessState`, the
> `LivenessStateHealthIndicator` / `ReadinessStateHealthIndicator` keys, the
> `/actuator/health/liveness` and `/actuator/health/readiness` paths,
> `management.endpoint.health.probes.enabled`,
> `management.endpoint.health.probes.add-additional-paths`, and the application
> lifecycle state table) and *How-to · Deploying to the Cloud*
> (docs.spring.io/spring-boot/how-to/deployment/cloud.html) plus the
> `CloudPlatform` javadoc for `*_SERVICE_HOST` / `*_SERVICE_PORT` detection and
> `spring.main.cloud-platform`. Spring Boot 4.1.0, Spring Framework 7.0.x,
> JDK 25.

**A failing liveness probe means "kill this process and start a new one". A
failing readiness probe means "stop sending me traffic; I may recover". They
are answers to different questions with different remedies, and Spring models
them as process state that you *push*, not as a dependency check that gets
*polled* — which is the design decision that makes the distinction survive
contact with production.**

## Two states, and Spring models them directly

Availability is maintained independently of any health indicator, in a bean you
can inject:

```java
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.LivenessState;
import org.springframework.boot.availability.ReadinessState;

@Component
public class AvailabilityReporter {

    private final ApplicationAvailability availability;

    public AvailabilityReporter(ApplicationAvailability availability) {
        this.availability = availability;
    }

    public boolean isBroken() {
        return this.availability.getLivenessState() == LivenessState.BROKEN;
    }

    public boolean isTakingTraffic() {
        return this.availability.getReadinessState() == ReadinessState.ACCEPTING_TRAFFIC;
    }
}
```

- **`LivenessState`** is `CORRECT` or `BROKEN`. `BROKEN` means the application's
  internal state is such that it cannot recover — the only remedy is a restart.
- **`ReadinessState`** is `ACCEPTING_TRAFFIC` or `REFUSING_TRAFFIC`.
  `REFUSING_TRAFFIC` means the instance is alive but should not receive requests
  right now.

Note what is *not* in either type: any mention of a dependency. Availability is
a statement about **this process**, and that framing is the whole argument that
[the next chunk](06-what-belongs-in-each-probe.md) makes.

Note also that these are *values*, not checks. Reading `LivenessState` cannot be
slow, cannot time out and cannot make a network call — which is exactly what you
want from something an orchestrator polls every few seconds and acts on
destructively.

## The two indicators and the two endpoints

Turn the probes on and Boot registers two health indicators — keyed
`livenessState` and `readinessState` — and two health groups reachable at:

- `/actuator/health/liveness`
- `/actuator/health/readiness`

```properties
management.endpoint.health.probes.enabled=true
```

**They auto-enable when Boot believes it is running on Kubernetes.** Detection
is environmental: the presence of `*_SERVICE_HOST` and `*_SERVICE_PORT`
variables, which Kubernetes injects for every service in the namespace. You can
force the answer:

```properties
spring.main.cloud-platform=kubernetes    # behave as if deployed to Kubernetes
```

That auto-detection is convenient and is also a quiet trap: the probe endpoints
exist in your cluster and do not exist on your laptop, so a mistake in the group
definitions is invisible until it is deployed. Setting
`management.endpoint.health.probes.enabled=true` explicitly, in every
environment, costs one line and removes the difference. Nothing about the two
states is Kubernetes-specific — the concepts apply to any load balancer with a
health check and any supervisor that can restart a process — so there is no good
reason to let a platform detection decide whether they are available.

The probe endpoints normally live wherever actuator lives, which for a
well-configured service is the
[management port](02-exposure-access-and-ports.md). If your orchestrator cannot
reach that port, Boot will also publish them on the main server port under
fixed conventional paths:

```properties
management.endpoint.health.probes.add-additional-paths=true   # /livez and /readyz on the main port
```

Those paths are deliberately outside the actuator base path, so they do not
change if somebody moves `management.endpoints.web.base-path`, and they do not
require exposing anything else.

## The lifecycle: what the states are during startup and shutdown

This table is the part most people have never seen, and it explains behaviour
that otherwise looks arbitrary:

| Phase | `LivenessState` | `ReadinessState` | HTTP server |
|---|---|---|---|
| Starting | `BROKEN` | `REFUSING_TRAFFIC` | not started |
| Started | `CORRECT` | `REFUSING_TRAFFIC` | refuses requests |
| Ready | `CORRECT` | `ACCEPTING_TRAFFIC` | accepts requests |
| Shutting down | `CORRECT` | `REFUSING_TRAFFIC` | no longer accepts requests |

Three readings worth taking from it:

1. **Liveness is `BROKEN` during startup**, which is correct — the application
   cannot serve anything yet — and is why a liveness probe needs a startup grace
   period or a dedicated startup probe. Without one, a slow-starting application
   is killed before it can finish starting, forever.
2. **There is a window where the server exists and readiness still refuses.**
   Readiness is not "the port is open"; it is a state published after the
   context has fully refreshed. Anything that blocks refresh holds that window
   open indefinitely.
3. **Readiness flips to `REFUSING_TRAFFIC` first on shutdown**, before the
   server stops accepting connections. That ordering is what makes a
   zero-downtime deployment possible, and it is the subject of
   [health groups and graceful shutdown](07-groups-and-graceful-shutdown.md).

## Changing the state yourself

Availability is pushed, and the push is an application event:

```java
import org.springframework.boot.availability.AvailabilityChangeEvent;
import org.springframework.boot.availability.ReadinessState;

@Component
public class DrainController {

    private final ApplicationEventPublisher events;

    public DrainController(ApplicationEventPublisher events) {
        this.events = events;
    }

    public void startDraining() {
        AvailabilityChangeEvent.publish(this.events, this, ReadinessState.REFUSING_TRAFFIC);
    }

    public void resume() {
        AvailabilityChangeEvent.publish(this.events, this, ReadinessState.ACCEPTING_TRAFFIC);
    }
}
```

This is the supported way to take one instance out of rotation while leaving it
running — during a long migration, while a local cache warms, while you drain
in-flight work — and it is much better than the alternatives people reach for,
which usually involve a health indicator that lies.

You can observe the changes too, which is how you get an audit trail of why an
instance left rotation:

```java
@EventListener
public void onReadinessChange(AvailabilityChangeEvent<ReadinessState> event) {
    log.info("readiness is now {}", event.getState());
}
```

## Gotchas

**Symptom:** `/actuator/health/liveness` returns 404 locally but works in the cluster
**Cause:** probes auto-enable on Kubernetes detection, driven by `*_SERVICE_HOST` / `*_SERVICE_PORT` environment variables that do not exist on your machine
**Fix:** enable them everywhere so the environments agree:
```properties
management.endpoint.health.probes.enabled=true
```

**Symptom:** a slow-starting application is killed and restarted forever and never reaches ready
**Cause:** liveness is `BROKEN` during the starting phase by design, and the liveness probe has no startup allowance
**Fix:** give the probe an initial delay or use a dedicated startup probe on the orchestrator side. The application is behaving correctly here; the probe configuration is what is wrong

**Symptom:** the orchestrator cannot reach the probe endpoints after actuator moved to a management port
**Cause:** the probes moved with actuator and the probe definitions still name the application port
**Fix:** point the probes at the management port, or publish the conventional paths on the main port:
```properties
management.endpoint.health.probes.add-additional-paths=true
```

**Symptom:** both probes are pointed at `/actuator/health` and somebody reports that the probes are configured
**Cause:** pointing both at the aggregate endpoint means both see the same status, so every readiness-shaped failure also triggers a restart — the split exists only if the paths differ
**Fix:** use the group paths `/actuator/health/liveness` and `/actuator/health/readiness`, and verify they differ by making a peripheral dependency fail and watching only one of them change

**Symptom:** you publish `LivenessState.BROKEN` in a test and later tests behave oddly
**Cause:** availability lives in the application context, and the test context is cached and shared across test classes
**Fix:** publish `CORRECT` again in a teardown, or mark the class so the context is not reused — availability is process state, not per-test state

**Symptom:** `/livez` and `/readyz` return 404 even with `add-additional-paths=true`
**Cause:** the additional paths are published on the **main server port**, and you are calling the management port where the group paths already live
**Fix:** call `/actuator/health/liveness` on the management port, or `/livez` on the application port — the property adds paths, it does not move them

## Interview questions

**★ What is the difference between a liveness probe and a readiness probe?**
They ask different questions and have different remedies. Liveness asks "is this
process in an unrecoverable state", and its remedy is to kill and restart the
process. Readiness asks "should this instance receive traffic right now", and
its remedy is to stop routing to it while leaving it running. The consequence is
structural: liveness must depend only on the process's own internal state,
while readiness may depend on conditions that make this particular instance
temporarily unsuitable.

**★ How does Spring model availability, and how does it differ from a health indicator?**
Through the `ApplicationAvailability` bean, holding a `LivenessState`
(`CORRECT` / `BROKEN`) and a `ReadinessState` (`ACCEPTING_TRAFFIC` /
`REFUSING_TRAFFIC`). It differs from a health indicator in being *pushed* rather
than *polled*: you change it by publishing an `AvailabilityChangeEvent`, and the
`livenessState` and `readinessState` indicators simply report the current value.
That matters for two reasons — reading it cannot be slow or time out, which is
what you want from something polled every few seconds and acted on
destructively; and the state persists independently of whether any dependency
check is currently running.

**★ When do the liveness and readiness endpoints exist, and why is that a trap?**
They are controlled by `management.endpoint.health.probes.enabled`, which
auto-enables when Boot detects Kubernetes — detection being the presence of
`*_SERVICE_HOST` and `*_SERVICE_PORT` environment variables, overridable with
`spring.main.cloud-platform`. The trap is that the endpoints therefore exist in
the cluster and not on a developer machine, so a mistake in the group
definitions cannot be reproduced locally and is discovered by deploying. Setting
the property explicitly in every environment removes the divergence for one line.

**★ Walk through the availability states from startup to shutdown.**
While starting, liveness is `BROKEN` and readiness is `REFUSING_TRAFFIC`, and
the HTTP server has not started. Once started, liveness becomes `CORRECT` while
readiness is still `REFUSING_TRAFFIC` and the server refuses requests. On ready,
readiness becomes `ACCEPTING_TRAFFIC` and requests are served. On shutdown,
readiness flips back to `REFUSING_TRAFFIC` **before** the server stops accepting
connections — that ordering is what makes a zero-downtime deployment possible,
because the load balancer sees the instance leave rotation while it can still
finish the requests it already holds.

**★ How do you deliberately take one instance out of rotation without stopping it?**
Publish an availability change:
`AvailabilityChangeEvent.publish(events, this, ReadinessState.REFUSING_TRAFFIC)`.
The `readinessState` indicator reflects it immediately, the readiness group goes
`DOWN`, the load balancer stops routing, and the process keeps running and
finishes what it has. Publishing `ACCEPTING_TRAFFIC` puts it back. It is the
right mechanism for a long migration, a cache warm-up or a controlled drain, and
it leaves an event you can log rather than a health check you have to explain.

---

← Prev: [Aggregation and details](04-health-aggregation-and-details.md) · Index: [Actuator](README.md) · Next → [What belongs in each probe](06-what-belongs-in-each-probe.md)
