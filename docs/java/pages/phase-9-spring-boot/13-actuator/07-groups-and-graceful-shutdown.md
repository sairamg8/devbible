---
title: "Health groups and graceful shutdown"
sidebar_label: "7 · Groups and graceful shutdown"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.0 reference — *Actuator ·
> Endpoints · Health · Health Groups*
> (docs.spring.io/spring-boot/reference/actuator/endpoints.html:
> `management.endpoint.health.group.<name>.include` / `.exclude`, the
> composite-component path form, `validate-group-membership`, the per-group
> `show-details` / `roles` / `status.order` / `status.http-mapping` properties,
> and `additional-path` with its `server:` and `management:` prefixes) and
> *Web · Graceful Shutdown*
> (docs.spring.io/spring-boot/reference/web/graceful-shutdown.html: `server.shutdown`,
> `spring.lifecycle.timeout-per-shutdown-phase`, the supported servers, and the
> `SmartLifecycle` ordering). Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A health group is a named subset of the contributor tree with its own status
mapping and its own display rules, and it is the mechanism that resolves the
tension the last four chunks have been building: one endpoint cannot serve both
a load balancer and a human. Graceful shutdown is the same idea in the time
dimension — a sequence in which readiness stops first and the server stops
last, so that a deployment does not drop requests.**

## Groups are the answer to "who is asking"

```yaml
management:
  endpoint:
    health:
      group:
        liveness:
          include: "livenessState"
          show-details: never
        readiness:
          include: "readinessState,localCacheWarmup"
          show-details: never
        diagnostics:
          include: "*"
          show-details: when-authorized
          roles: "ops"
          status:
            http-mapping:
              down: 200
```

Three groups, three audiences, one contributor tree:

- **`liveness`** — the orchestrator's restart decision. Nothing external.
- **`readiness`** — the load balancer's routing decision. Per-instance state
  only.
- **`diagnostics`** — a human or a dashboard. Everything, with details for an
  authenticated operator, and mapped to 200 so a scraper does not read a
  peripheral `DOWN` as an outage of the endpoint itself.

Each group is reachable at `/actuator/health/<name>`, and each carries its own
`show-details`, `show-components`, `roles`, `status.order` and
`status.http-mapping`. That per-group configurability is the whole value: the
same `DOWN` from the same contributor can be a 503 in one group and a 200 in
another, because the two consumers should do different things about it.

### Including part of a composite

A contributor that is a `CompositeHealthContributor` can be addressed by path,
which matters for things like a routing `DataSource` with several targets:

```properties
management.endpoint.health.group.readiness.include=db/primary
management.endpoint.health.group.readiness.exclude=db/primary/replica2
```

### The typo guard

```properties
management.endpoint.health.validate-group-membership=false
```

By default Boot **validates** that every name in a group's include list is a
real contributor and fails startup if one is not. That default is right: a
mistyped contributor name would otherwise produce a group that silently checks
less than you think, and a readiness group that checks nothing always reports
`UP`. Turning validation off is only for the case where a contributor is
genuinely conditional on a profile — and even then, prefer profile-specific
group definitions.

### Additional paths for infrastructure that cannot be told about `/actuator`

```properties
management.endpoint.health.group.liveness.additional-path=server:/healthz
management.endpoint.health.group.readiness.additional-path=server:/readyz
```

The prefix is mandatory and names which server publishes the path: `server:`
for the main application port, `management:` for the management port. This is
how you satisfy a platform that insists on a fixed path at the root while
keeping the rest of actuator on its own port.

## Graceful shutdown, and why readiness goes first

```properties
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=30s
```

The 4.1 reference documents graceful shutdown as **enabled by default** with
all supported embedded servers — Tomcat, Jetty and Reactor Netty (Undertow
support was removed in Framework 7) — for both servlet and reactive
applications. ⚠️ On Boot 3.x it had to be turned on, so an application whose
configuration explicitly sets `server.shutdown=graceful` is not doing anything
wrong; it is carrying a line that used to be necessary. The value to set if you
*want* the old behaviour is `immediate`.

During the grace period, existing requests are allowed to complete and new ones
are refused **at the network layer** — the server stops accepting, rather than
accepting and returning an error. `spring.lifecycle.timeout-per-shutdown-phase`
bounds how long that lasts, after which shutdown proceeds regardless.

Graceful shutdown happens as part of closing the application context, in the
earliest phase of stopping `SmartLifecycle` beans — which is what puts it
*before* your own beans are destroyed, so a request still in flight still has a
working datasource and a working thread pool underneath it.

### The full drain sequence

Put the pieces together and the ordering is the point:

1. The orchestrator sends `SIGTERM`.
2. Boot begins closing the context. **Readiness flips to `REFUSING_TRAFFIC`
   first**, so `/actuator/health/readiness` starts returning 503.
3. The load balancer's next readiness probe observes that and stops routing new
   requests to this instance.
4. The web server stops accepting new connections at the network layer.
5. In-flight requests run to completion, up to
   `spring.lifecycle.timeout-per-shutdown-phase`.
6. The rest of the context closes: `@PreDestroy` callbacks, pools, executors.
7. The process exits.

🔴 **Step 3 is a race and the framework cannot win it for you.** Between
readiness going `REFUSING_TRAFFIC` and the load balancer noticing, there is at
least one probe interval during which traffic is still being routed to a server
that has stopped accepting connections — and those requests fail, which is
exactly the dropped-request symptom people blame on graceful shutdown not
working.

The fix is not in Spring. It is a **pre-stop delay** in the deployment: instruct
the platform to wait, before sending `SIGTERM`, for longer than the readiness
probe interval plus its failure threshold. The application publishes
`REFUSING_TRAFFIC` on shutdown; the platform must be told to give the load
balancer time to see it. Getting this wrong is the single most common reason a
"zero-downtime" deployment drops a handful of requests every release, and it is
invisible in any environment where you do not measure it.

### Terminating the JVM is not the same as closing the context

Graceful shutdown runs when the context closes, which happens on `SIGTERM`
through the shutdown hook. It does **not** happen on `SIGKILL`, which is what
your orchestrator sends when the termination grace period expires — so a
termination grace period shorter than
`spring.lifecycle.timeout-per-shutdown-phase` plus the pre-stop delay means the
platform kills you in the middle of the drain you configured. The three numbers
have to be consistent, and they live in three different files owned by two
different teams, which is why they usually are not.

⚠️ Shutdown from an IDE may be immediate rather than graceful if the IDE does
not send a proper `SIGTERM`, so "it did not drain locally" is not evidence of a
misconfiguration.

## The trade-off

Groups cost you configuration surface: three group definitions, each with its
own display and mapping rules, is more to read and more to get wrong than one
endpoint. The alternative is a single endpoint whose semantics are a compromise
between a load balancer and a human, which in practice means it is wrong for
both — too detailed to be safe, too aggregated to be useful.

Graceful shutdown costs you deployment time. Every rolling replacement now takes
at least the pre-stop delay plus the drain per instance, and a fleet of fifty
instances with a thirty-second drain is a materially slower deploy. That is the
actual reason teams set the timeout too low, and it is a bad trade — the time
you save is paid for in failed requests during every release.

## Gotchas

**Symptom:** a group you defined returns `UP` even when the contributor it names is failing
**Cause:** the contributor name is misspelled, and `validate-group-membership` was turned off, so the group contains nothing and an empty group is healthy
**Fix:** leave validation on so the mistake fails startup rather than passing quietly:
```properties
management.endpoint.health.validate-group-membership=true
```

**Symptom:** startup fails with a complaint about a health group's membership after adding a profile-specific dependency
**Cause:** the group names a contributor that only exists under some profiles, and membership validation is checking it in all of them
**Fix:** define the group per profile rather than disabling validation globally — a
[profile-specific document](../06-configuration-and-profiles/03-multi-document-and-yaml-traps.md) with its own include list keeps the guard everywhere else

**Symptom:** requests are dropped during every deployment despite graceful shutdown being configured
**Cause:** the load balancer had not observed `REFUSING_TRAFFIC` before the server stopped accepting connections — a probe-interval race that graceful shutdown does not and cannot cover
**Fix:** add a pre-stop delay longer than the readiness probe interval times its failure threshold, so the platform waits before sending `SIGTERM`

**Symptom:** in-flight requests are killed mid-way despite `spring.lifecycle.timeout-per-shutdown-phase=60s`
**Cause:** the platform's termination grace period is shorter, so `SIGKILL` arrives before the drain finishes
**Fix:** make the platform's grace period exceed the pre-stop delay plus the shutdown timeout; the two numbers are in different files and nothing validates them against each other

**Symptom:** `/actuator/health/diagnostics` returns 503 and a scraper treats the service as down
**Cause:** the group inherited the default status mapping, so a peripheral `DOWN` produced a 503 on an endpoint that exists for reading, not for routing
**Fix:** map it per group:
```properties
management.endpoint.health.group.diagnostics.status.http-mapping.down=200
```

**Symptom:** `additional-path` is rejected at startup
**Cause:** the value needs a `server:` or `management:` prefix naming which server publishes it
**Fix:** `management.endpoint.health.group.liveness.additional-path=server:/healthz`

**Symptom:** a `@PreDestroy` that flushes a buffer runs but its writes fail
**Cause:** it depends on a bean already destroyed, or on a request-scoped resource that no longer exists — destruction order is not the reverse of everything you assume
**Fix:** treat shutdown work that must succeed as a `SmartLifecycle` with an explicit phase rather than a `@PreDestroy`, which is [lifecycle callbacks](../04-bean-scopes-lifecycle/05-startup-shutdown-and-cycles.md)' material

**Symptom:** the application drains correctly in production and not on a developer machine
**Cause:** the IDE may terminate the process without sending a proper `SIGTERM`, so the shutdown hook never runs
**Fix:** nothing — this is an IDE behaviour, and testing drain behaviour requires a real signal, not a stop button

## Interview questions

**★ What problem do health groups solve?**
That one endpoint cannot serve two consumers with different needs. A load
balancer wants a status code and nothing else, and wants only the checks whose
failure should change routing. A human wants every check, with details, and does
not want a peripheral failure to look like an outage. A group is a named subset
of the contributor tree with its own `show-details`, `roles`, severity order and
HTTP mapping, so the same contributor's `DOWN` can be a 503 in the readiness
group and a 200 in a diagnostics group — which is correct, because the two
consumers should do different things about it.

**★ Why does Boot validate group membership by default, and when would you turn it off?**
Because a mistyped contributor name would otherwise produce a group that checks
less than intended, and an empty group reports `UP` — so a readiness probe could
be permanently green while checking nothing. Failing startup is the right
response to that. The only reasonable case for disabling it is a contributor
that genuinely exists in some profiles and not others, and even then the better
fix is a profile-specific group definition, which keeps the guard everywhere
else.

**★ Describe the graceful shutdown sequence and where a request can still be lost.**
On `SIGTERM` the context begins closing; readiness flips to `REFUSING_TRAFFIC`
first, the web server then stops accepting connections at the network layer,
in-flight requests complete within
`spring.lifecycle.timeout-per-shutdown-phase`, and the remaining beans are
destroyed. Requests are lost in the gap between readiness changing and the load
balancer *observing* it — at least one probe interval during which traffic is
still routed to a server that is no longer accepting. Spring cannot close that
gap; it is closed by a pre-stop delay in the deployment that holds off `SIGTERM`
until the probe has had time to fail.

**★ What changed about graceful shutdown in Boot 4?**
The 4.1 reference documents it as enabled by default across the supported
embedded servers — Tomcat, Jetty and Reactor Netty, Undertow support having been
removed in Framework 7 — for both servlet and reactive applications. On 3.x it
was opt-in via `server.shutdown=graceful`, so a configuration carrying that line
is harmless but no longer load-bearing, and `immediate` is now the value you set
if you want the old behaviour.

**★ Why does graceful shutdown run in the earliest `SmartLifecycle` stop phase?**
Because a request that is still executing needs everything underneath it to
still work — the datasource, the thread pools, the caches, the outbound clients.
Stopping the server first and destroying beans afterwards means an in-flight
request finishes against a fully functional application. Reverse the order and
"graceful" shutdown produces requests that fail halfway through with resources
disappearing under them, which is worse than refusing them outright.

**★ Your deployment still drops requests. Name the three numbers that have to agree.**
The readiness probe interval times its failure threshold (how long the load
balancer takes to notice), the pre-stop delay (how long the platform waits
before `SIGTERM`), and `spring.lifecycle.timeout-per-shutdown-phase` (how long
the drain may take) — all of which must fit inside the platform's termination
grace period, or `SIGKILL` interrupts the drain. They live in an application
config file and a deployment manifest, owned by different people, and nothing
validates them against each other, which is why "we configured graceful
shutdown" and "we do not drop requests on deploy" are so often different facts.

---

← Prev: [What belongs in each probe](06-what-belongs-in-each-probe.md) · Index: [Actuator](README.md) · Next → [Metrics with Micrometer](08-metrics.md)
