---
title: "Health: the contributor tree"
sidebar_label: "3 · Health contributors"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.0 reference — *Actuator ·
> Endpoints · Health* (docs.spring.io/spring-boot/reference/actuator/endpoints.html:
> `HealthContributorRegistry`, `HealthIndicator`, `CompositeHealthContributor`,
> the auto-configured indicator table and its keys,
> `management.health.defaults.enabled`,
> `management.endpoint.health.logging.slow-indicator-threshold`, and the
> reactive variants) and the Spring Boot 4.1.0 API javadoc package paths
> (`org.springframework.boot.health.contributor`,
> `org.springframework.boot.health.registry`). The SSL `expiringChains` change
> is from the *Spring Boot 4.0 Release Notes* (github.com/spring-projects/spring-boot/wiki).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**`/actuator/health` is an aggregate, and the first of the two questions it
raises is *who contributes*. Every contributor you accept is a coupling: your
service's reported health now depends on another system's availability, and
whether that is correct or catastrophic depends entirely on what reads the
endpoint.**

## The contributor tree

Health is collected from a `HealthContributorRegistry`. A contributor is one of
two things:

- a **`HealthIndicator`**, which produces a `Health` — a `Status` plus an
  optional map of details;
- a **`CompositeHealthContributor`**, which contains other contributors, so the
  registry holds a tree rather than a flat list. A single `DataSource`
  contributes one node; a routing `DataSource` contributes a composite with one
  child per target.

```java
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;

@Component
public class PaymentGatewayHealthIndicator implements HealthIndicator {

    private final PaymentGatewayClient client;

    public PaymentGatewayHealthIndicator(PaymentGatewayClient client) {
        this.client = client;
    }

    @Override
    public Health health() {
        try {
            var result = this.client.ping();
            return Health.up()
                    .withDetail("endpoint", this.client.baseUrl())
                    .withDetail("latencyMillis", result.millis())
                    .build();
        }
        catch (GatewayUnavailableException ex) {
            return Health.down()
                    .withDetail("endpoint", this.client.baseUrl())
                    .withException(ex)
                    .build();
        }
    }
}
```

The bean name minus the `HealthIndicator` suffix becomes the key in the
response, so that class contributes under `paymentGateway`. Rename the class and
you rename a field in a JSON document that somebody's dashboard is parsing —
worth knowing before a tidy-up commit.

🔴 **The package moved in Boot 4.** `HealthIndicator`, `Health`, `Status` and
`HealthContributor` now live under `org.springframework.boot.health.contributor`
rather than `org.springframework.boot.actuate.health`, and the registry types
under `org.springframework.boot.health.registry`. A Boot 3 application with a
custom indicator therefore fails to compile on Boot 4 with an import error and
nothing else to change. That is a far better failure than the silent kind, but
it does mean "the starter name did not change" is not the same as "nothing
changed".

For a reactive application there are `ReactiveHealthIndicator` and
`ReactiveHealthContributor`, plus `ReactiveHealthContributor.adapt(...)` to
wrap a blocking contributor. Use them if your application is reactive — a
blocking indicator inside a reactive stack is a blocked event-loop thread, which
is a much more expensive mistake than a blocked
[platform thread](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)
would be.

## What Spring already contributes

Auto-configured indicators arrive with the relevant starter, keyed as:

`cassandra` · `couchbase` · `db` · `diskspace` · `elasticsearch` · `hazelcast` ·
`jms` · `ldap` · `mail` · `mongo` · `neo4j` · `ping` · `rabbit` · `redis` ·
`ssl` · `livenessstate` · `readinessstate`

Each is switched with `management.health.<key>.enabled`, and the whole set with:

```properties
management.health.defaults.enabled=false
management.health.db.enabled=true
```

That pair is the shape to reach for once you have decided which checks belong
in your health response, rather than accepting whatever your classpath implies.
The direction matters for the same reason it does with
[endpoint exposure](02-exposure-access-and-ports.md): the auto-configured set
grows with your dependencies, so a denylist silently acquires new members and
an allowlist does not.

Two of the defaults deserve a specific opinion:

- **`diskspace`** reports `DOWN` when free space on a path falls below a
  threshold. In a container that is usually a statement about the host or the
  image layer rather than about your service, and it is a common cause of a
  fleet going unhealthy for a reason that has nothing to do with the fleet.
- **`ssl`** reports on certificate validity in your configured SSL bundles, and
  it changed in Boot 4: an expiring chain is now listed in an `expiringChains`
  entry while the certificate's own status stays `VALID`, and the
  `WILL_EXPIRE_SOON` status is no longer used. Alerting built on that status
  string stops firing on upgrade without anything failing.

## The latency problem nobody plans for

`/actuator/health` calls its contributors. The endpoint's response time is
therefore at least the slowest contributor's response time, and contributors are
usually network calls to other systems.

The effect compounds rather than adds. Suppose the endpoint queries the
database, pings Redis and checks a mail server, and a readiness probe hits it
every five seconds with a two-second timeout. When the mail server becomes
**slow — not down, slow** — the endpoint exceeds the probe timeout, the probe
fails, and the orchestrator removes the instance from rotation. Nothing was
wrong with your service, and because every instance shares the same slow
dependency, it happens to all of them within one probe period. This is the
mechanism behind a large share of "the whole fleet went unhealthy at once"
incidents, and it is why [liveness and readiness](05-liveness-and-readiness.md)
insists on being deliberate about which checks belong in which group.

Boot will at least tell you:

```properties
management.endpoint.health.logging.slow-indicator-threshold=10s
```

A contributor exceeding that threshold is logged. It is a **diagnostic, not a
timeout** — nothing cancels a slow indicator, so a contributor blocked
indefinitely blocks the endpoint indefinitely. If a check calls a remote system,
the timeout has to live in your client, not in the health machinery.

## The trade-off

Every indicator you add buys you a more honest picture of your dependencies and
sells a piece of your independence. A health endpoint that checks everything is
excellent documentation of your architecture and a bad thing to point a probe
at. A health endpoint that checks nothing is a perfect probe target and tells
you nothing.

Boot's answer is not to pick one but to let you have several, which is what
[health groups](06-groups-probes-and-shutdown.md) are for. The question to ask
of every proposed indicator is not "is this dependency important" but "when
this dependency fails, should traffic stop arriving at this instance" — and for
most peripheral systems the answer is no.

## Gotchas

**Symptom:** a custom indicator throws and health is `DOWN` forever, with the component showing an exception rather than a status you wrote
**Cause:** an exception escaping `health()` is treated as a failure; if the underlying condition is a startup problem rather than a transient one, nothing ever clears it
**Fix:** catch inside the indicator and decide what the exception *means* — an unreachable optional dependency is often not `DOWN`:
```java
catch (GatewayUnavailableException ex) {
    return Health.status(Status.UNKNOWN).withException(ex).build();
}
```

**Symptom:** in a container, health reports `DOWN` with a `diskSpace` component while the application is fine
**Cause:** `DiskSpaceHealthIndicator` measures free space on a path against a threshold, and in a container that measurement usually belongs to the host
**Fix:** disable it deliberately, or raise the threshold if the path really is yours:
```properties
management.health.diskspace.enabled=false
```

**Symptom:** an alert built on the SSL health status stops firing after the Boot 4 upgrade
**Cause:** `WILL_EXPIRE_SOON` is no longer emitted — an expiring chain appears in an `expiringChains` entry and the certificate status stays `VALID`
**Fix:** alert on the presence of `expiringChains`, and take the opportunity to move certificate-expiry alerting into your monitoring system, where a warning does not have to travel through a status enum

**Symptom:** the health endpoint hangs indefinitely during an incident
**Cause:** an indicator is blocked on a remote call with no client-side timeout; `slow-indicator-threshold` logs it and cancels nothing
**Fix:** set connect and read timeouts on the client the indicator uses, and treat "this health check has no timeout" as a bug in the indicator rather than a configuration gap

**Symptom:** renaming a health indicator class breaks a dashboard
**Cause:** the component key is derived from the bean name with the `HealthIndicator` suffix stripped, so the class name is part of a published JSON contract
**Fix:** if the key matters, pin it rather than depending on the class name:
```java
@Component("paymentGateway")
public class PaymentGatewayCheck implements HealthIndicator { /* ... */ }
```

**Symptom:** a blocking health indicator in a WebFlux application causes intermittent latency across unrelated endpoints
**Cause:** a `HealthIndicator` runs on the calling thread, and in a reactive stack that is an event-loop thread serving every other request
**Fix:** implement `ReactiveHealthIndicator`, or adapt an existing blocking contributor with `ReactiveHealthContributor.adapt(...)` so it is scheduled off the event loop

## Interview questions

**★ What is the difference between a `HealthIndicator` and a `HealthContributor`?**
`HealthContributor` is the general type held in the registry;
`HealthIndicator` is the leaf form that actually produces a `Health`, and
`CompositeHealthContributor` is the branch form that contains other
contributors. The tree shape exists because some dependencies are naturally
plural — a routing `DataSource` contributes one node per target — and because
health groups can include or exclude a specific path within a composite rather
than the whole thing.

**★ A colleague adds a health indicator for the third-party email provider. What do you say?**
Ask what should happen when the email provider is down. If the answer is
"nothing about our service should change", then the indicator must not be in
any group a probe reads, because the aggregator will turn its `DOWN` into the
service's `DOWN` and something upstream will act on it. The indicator may still
be worth having in the full endpoint for a human. The general point is that a
health check is not free observability — each one adds a latency dependency and
a route by which somebody else's outage becomes yours.

**★ Your health endpoint is slow. What is happening and what fixes it?**
The endpoint invokes its contributors, most of which are network calls, so its
latency is at least the slowest one's. Nothing in the health machinery imposes a
timeout: `management.endpoint.health.logging.slow-indicator-threshold` logs a
slow contributor but does not cancel it, so an indicator blocked on an
unresponsive dependency blocks the endpoint for as long as its client allows.
The fix has two halves — real timeouts on the clients the indicators use, and a
probe that reads a health *group* containing only the checks whose failure
should change routing, rather than the full endpoint.

**★ How do you take control of which checks Spring contributes?**
Turn the defaults off and opt back in:
`management.health.defaults.enabled=false`, then
`management.health.<key>.enabled=true` per check you want. Doing it in that
direction rather than disabling the ones you dislike matters because the
auto-configured set is classpath-driven and grows — a new starter can add an
indicator that starts influencing your aggregate status without anyone deciding
it should.

**★ What changed about health in Spring Boot 4 that will break an upgrade?**
The contributor types moved packages: `HealthIndicator`, `Health`, `Status` and
`HealthContributor` are under `org.springframework.boot.health.contributor`, the
registries under `org.springframework.boot.health.registry`, rather than the old
`org.springframework.boot.actuate.health`. Every custom indicator fails to
compile until the imports change. Separately and more insidiously, the SSL
indicator stopped emitting `WILL_EXPIRE_SOON`, so monitoring built on that string
silently stops working while everything still compiles and runs.

**★ Should a health indicator ever return `UNKNOWN`?**
Yes, and it is under-used. `UNKNOWN` is the honest answer when a check could not
be *performed*, as distinct from being performed and failing — a dependency you
cannot currently reach that is not required to serve traffic, or a cached result
that has gone stale. It maps to HTTP 200 by default, so it does not remove you
from rotation, while remaining visibly different from `UP` to a human. Returning
`DOWN` for "I could not check" is precisely how a diagnostic gap turns into an
outage.

---

← Prev: [Exposure, access and ports](02-exposure-access-and-ports.md) · Index: [Actuator](README.md) · Next → [Aggregation, details and status codes](04-health-aggregation-and-details.md)
