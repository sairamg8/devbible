---
title: "Aggregation, details and status codes"
sidebar_label: "4 · Aggregation and details"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.0 reference — *Actuator ·
> Endpoints · Health* (docs.spring.io/spring-boot/reference/actuator/endpoints.html:
> `StatusAggregator`, `HttpCodeStatusMapper`, the default status-to-HTTP
> mapping table, `management.endpoint.health.status.order`,
> `management.endpoint.health.show-details`, `.show-components`, `.roles`, and
> the per-group `status.http-mapping` properties) and the Spring Boot 4.1.0 API
> javadoc (`org.springframework.boot.health.actuate.endpoint.StatusAggregator`,
> `HttpCodeStatusMapper`). Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**The second question an aggregate raises is *how disagreement is resolved*, and
the answer is two pluggable steps most teams never look at: a `StatusAggregator`
picks the most severe reported status, and a `HttpCodeStatusMapper` turns that
into an HTTP code. A load balancer does not read your JSON — it reads the status
line — so the second of those is the one that decides whether traffic keeps
arriving.**

## Severity is a configured order, not a hierarchy

Every contributor returns a `Status`. The aggregate is decided by sorting the
reported statuses by a configured order and taking the most severe:

```properties
management.endpoint.health.status.order=fatal,down,out-of-service,unknown,up
```

The consequence people trip over is blunt: **one `DOWN` contributor makes the
whole endpoint `DOWN`**, however unimportant that contributor is. A mail server
used for a nightly report is, by default, able to make your service's health
endpoint say `DOWN` — and if a readiness probe reads that endpoint, to take the
service out of rotation.

There is no notion of a "warning" or a "non-critical" contributor built into the
aggregation. Severity is a total order over status names, and every contributor
gets the same vote. If you want a check that is visible but not decisive, the
mechanism is not a gentler status — it is a
[health group](06-groups-probes-and-shutdown.md) that excludes it.

`Status` is not a closed enum; you can register your own. But a custom status
that no aggregator ordering and no HTTP mapping knows about has no defined
severity and no defined code, which is a quiet way to make a check useless.
Registering `DEGRADED` means naming it in **both** places:

```properties
management.endpoint.health.status.order=fatal,down,degraded,out-of-service,unknown,up
management.endpoint.health.status.http-mapping.degraded=200
```

## The HTTP mapping is the part that has consequences

A `HttpCodeStatusMapper` turns the aggregate status into a response code:

| Status | HTTP |
|---|---|
| `UP` | 200 |
| `UNKNOWN` | 200 |
| `DOWN` | 503 |
| `OUT_OF_SERVICE` | 503 |

Two things follow that are worth stating plainly.

**The status code, not the body, is what routing infrastructure reads.** Load
balancers, orchestrator probes and ingress health checks are almost always
configured as "2xx means healthy". Your careful JSON with its per-component
breakdown is invisible to them. That is why the mapping is configurable per
group — you can decide that in the readiness group a particular status should
still be 200.

**A 503 is a correct response, not an error.** Monitoring that alerts on "5xx
rate" will alert on a health endpoint doing exactly its job, and an access-log
dashboard will show a spike of 503s that is a symptom rather than a cause.
Excluding the management path from those aggregations is a small piece of setup
that saves a recurring false alarm — and is much easier if actuator is on its
[own port](02-exposure-access-and-ports.md).

Per-group overrides look like this:

```properties
management.endpoint.health.group.readiness.status.http-mapping.out-of-service=503
management.endpoint.health.group.diagnostics.status.http-mapping.down=200
```

The second line is not perverse: a diagnostics group meant for humans and
dashboards has no business returning 503 to a scraper that treats it as an
outage.

## `show-details`, and why the default is `never`

```properties
management.endpoint.health.show-details=never          # the default
management.endpoint.health.show-components=when-authorized
management.endpoint.health.roles=ops
```

`show-details` takes `never`, `when-authorized` or `always`. The default is
`never`, and it is a deliberate choice rather than caution: **details are
written by contributors that have no idea who is reading them.** A datasource
indicator's details describe your database; a third-party starter's indicator
may name a broker address; your own indicator contains whatever you found useful
at 3am. `never` means the endpoint answers `UP` or `DOWN` and nothing else —
exactly the right amount of information for a load balancer, and exactly the
wrong amount for a human, which is why the pull towards `always` is constant and
why `always` keeps ending up in production.

`when-authorized` is the setting to reach for: full details for an authenticated
principal in the roles named by `management.endpoint.health.roles`, a bare
status for everyone else. It requires that you have a security configuration
that authenticates actuator requests, which is
[the other half of the topic](10-locking-it-down.md).

`show-components` is the same idea one level up: it controls whether the
contributor *names* are listed at all. It is worth restricting separately,
because the list is itself information — knowing a service has `redis`, `mongo`
and `rabbit` components describes your architecture even with every detail
redacted.

Both properties can be set per group, which is the usual reason to bother:

```properties
management.endpoint.health.group.readiness.show-details=never
management.endpoint.health.group.diagnostics.show-details=when-authorized
management.endpoint.health.group.diagnostics.roles=ops
```

## The trade-off

Detail and safety are genuinely opposed here and no setting resolves it. `never`
means an on-call engineer looking at a `DOWN` service has to go to the logs to
find out which component failed, which costs minutes at exactly the wrong time.
`always` means the same information is available to anyone who can reach the
endpoint, and health is the one endpoint that is exposed by default.

`when-authorized` is the compromise and it has a real cost too: it only works if
you have authentication in front of actuator, which is a piece of infrastructure
many teams do not have at the point where they first want health details. The
honest sequence is to put actuator behind a management port and authentication
*first*, and then turn details on — not to turn details on because it is one
property and the security work is a ticket.

## Gotchas

**Symptom:** health is `DOWN` in production and nobody can tell which contributor caused it
**Cause:** `show-details` defaults to `never`, which is right for the endpoint's probe role and unhelpful for a human
**Fix:** authorise humans rather than opening the endpoint:
```properties
management.endpoint.health.show-details=when-authorized
management.endpoint.health.roles=ops
```

**Symptom:** the health response contains a JDBC URL, a broker host or a bucket name, readable by anyone who can reach the endpoint
**Cause:** somebody set `show-details=always`, and contributors write whatever details they find useful with no view on the audience
**Fix:** move to `when-authorized`, and separately audit your own indicators' `withDetail` calls — a detail map is a response body, not a log line

**Symptom:** the service is pulled from rotation whenever a peripheral system has a slow patch
**Cause:** an indicator for a non-critical dependency is in the group the probe reads, and a single `DOWN` aggregates to `DOWN`
**Fix:** stop aggregating things with different consequences — give the probe a group containing only decisive checks, as [health groups](06-groups-probes-and-shutdown.md) sets out

**Symptom:** a custom `Status` you registered is treated as healthy when you meant it as a failure
**Cause:** severity comes from the configured order and a status not named there has no defined severity; the HTTP mapping is a separate lookup that can also miss
**Fix:** name it in both places, as shown above — order *and* `http-mapping`

**Symptom:** your 5xx alert fires every time a dependency blips, pointing at your own service
**Cause:** the health endpoint returning 503 is a correct response, and it is being counted in an aggregate error rate alongside real failures
**Fix:** exclude the management path from error-rate aggregation, which is trivial if actuator is on `management.server.port` and fiddly if it is not

**Symptom:** the `diskSpace` component makes the readiness group `DOWN`, and setting `show-details=never` did not help
**Cause:** `show-details` controls what is *printed*, not what is *aggregated* — hiding a component does not remove its vote
**Fix:** exclude it from the group, or disable the indicator; visibility and severity are separate concerns and only one of them is a display setting

**Symptom:** a dashboard that parsed the health JSON breaks after you enable a health group
**Cause:** a group endpoint's response contains only that group's components, and per-group `show-details` may differ from the top-level setting
**Fix:** point the dashboard at the group you intend it to read and set that group's display properties explicitly, rather than inheriting whatever the top level happens to be

## Interview questions

**★ How is the aggregate health status decided when contributors disagree?**
A `StatusAggregator` sorts the reported statuses by a configured severity order
— by default `DOWN` outranks `OUT_OF_SERVICE`, which outranks `UNKNOWN`, which
outranks `UP` — and the most severe wins. So a single `DOWN` contributor makes
the endpoint `DOWN` irrespective of how peripheral it is. There is no built-in
notion of a non-critical contributor: every contributor gets the same vote, and
the way to make a check visible but not decisive is to keep it out of the group
that anything acts on.

**★ What does `HttpCodeStatusMapper` do and why does it matter more than the JSON?**
It maps the aggregate `Status` to an HTTP status code — 503 for `DOWN` and
`OUT_OF_SERVICE`, 200 for `UP` and `UNKNOWN` by default. It matters more than
the body because routing infrastructure reads status lines, not JSON: load
balancers, orchestrator probes and ingress checks are configured as "2xx means
healthy" and never parse the response. It is configurable per health group,
which is how you say "in the diagnostics group, `DOWN` should still be a 200"
without changing what the readiness group does.

**★ Why does `management.endpoint.health.show-details` default to `never`?**
Because details are produced by contributors that have no notion of who is
reading the response, and health is the one endpoint exposed over HTTP by
default. A datasource indicator describes your database, a third-party
starter's indicator can name a broker, and your own indicators contain whatever
was useful while debugging. The endpoint's primary consumer is a probe that
needs a status code and nothing more, so `never` is the correct default and
`when-authorized` is the correct production setting once you have authentication
in front of the endpoint.

**★ What is the practical difference between `show-details` and `show-components`?**
`show-details` governs the per-contributor detail maps; `show-components`
governs whether the contributors are listed at all. They are separate because
the list is itself information — a component list tells an attacker your
architecture even with every detail redacted — so you may want to publish a bare
status publicly while restricting even the inventory. Neither affects
aggregation: hiding a component does not stop it voting on the overall status.

**★ You want a health check that shows up but never takes the service out of rotation. How?**
Not with a custom status, and not by hiding it. Put the indicator in the full
`/actuator/health` and keep it out of the health group that the readiness probe
reads, so it is visible to humans and invisible to routing. If you do want a
distinct status name for dashboards, register one and name it in both
`management.endpoint.health.status.order` and a `status.http-mapping` entry —
otherwise it has neither a defined severity nor a defined response code.

**★ Your alerting fires on 5xx rate and the health endpoint's 503s are polluting it. What now?**
Recognise that the 503 is correct behaviour and the alert is measuring the wrong
population. Separate the management traffic from application traffic in the
aggregation, which is straightforward when actuator is on its own
`management.server.port` because the port is already a dimension in your metrics
and access logs, and awkward when it shares the application port because you are
reduced to filtering on a path prefix that somebody can change with a property.

---

← Prev: [Health contributors](03-health-properly.md) · Index: [Actuator](README.md) · Next → [Liveness vs readiness](05-liveness-and-readiness.md)
