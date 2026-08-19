---
title: "Exposure, access and where endpoints live"
sidebar_label: "2 · Exposure, access and ports"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.0 reference — *Actuator ·
> Endpoints* (docs.spring.io/spring-boot/reference/actuator/endpoints.html: the
> full endpoint catalogue with its "requires a bean" notes, the exposure
> defaults table showing `management.endpoints.web.exposure.include` defaulting
> to `health`, and the access properties
> `management.endpoint.<id>.access`, `management.endpoints.access.default` and
> `management.endpoints.access.max-permitted`) and *How-to · Actuator*
> (docs.spring.io/spring-boot/how-to/actuator.html for `management.server.port`
> and `management.server.address`). Spring Boot 4.1.0, Spring Framework 7.0.x,
> JDK 25.

**Three independent gates stand between an endpoint existing and you being able
to call it: whether the endpoint is *present* at all, what *access* it permits,
and whether it is *exposed* over the technology you are calling. The words
"enabled", "exposed" and "accessible" sound like synonyms and are not, and
almost every Actuator support question in existence is somebody applying the
wrong one of the three.**

## Gate 1 — does the endpoint exist?

Several endpoints only auto-configure when something else is present, and no
property will conjure one that is not:

| Endpoint | Needs |
|---|---|
| `flyway` / `liquibase` | one or more `Flyway` / `Liquibase` beans |
| `httpexchanges` | an `HttpExchangeRepository` bean — Boot does **not** create one |
| `auditevents` | an `AuditEventRepository` bean |
| `integrationgraph` | `spring-integration-core` on the classpath |
| `prometheus` | `micrometer-registry-prometheus` on the classpath |
| `startup` | the `SpringApplication` configured with a `BufferingApplicationStartup` |
| `sessions` | a servlet application using Spring Session |
| `quartz` | Quartz Scheduler |

This is the gate people check last and should check first, because its symptom
— a 404 — is identical to the symptom of the other two.

## Gate 2 — what access does the endpoint permit?

```properties
management.endpoints.access.default=none
management.endpoint.health.access=read-only
management.endpoint.loggers.access=unrestricted
management.endpoints.access.max-permitted=read-only
```

Access has three values and three levels of resolution:

- **Values.** `none` (deny everything), `read-only` (permit `@ReadOperation`
  only), `unrestricted` (permit everything).
- **`management.endpoints.access.default`** sets the baseline for every
  endpoint that does not name itself.
- **`management.endpoint.<id>.access`** overrides the baseline for one endpoint.
- **`management.endpoints.access.max-permitted`** is an application-wide
  **ceiling**, applied after everything else.

The ceiling is the property worth knowing about, because it turns a convention
into a guarantee. Per-endpoint properties are easy to override from a later
property source — an environment variable, a config server, a profile somebody
added last quarter — whereas `max-permitted=read-only` means no write or delete
operation can be invoked in that environment regardless of what any other
property says. In an environment where
[configuration is assembled from several sources](../06-configuration-and-profiles/01-the-environment-and-precedence.md),
that is the difference between "we intend not to expose writes" and "writes
cannot happen".

Access is also how `shutdown` is kept harmless: it ships denied, and turning it
on is a deliberate `management.endpoint.shutdown.access=unrestricted` that shows
up in a configuration review.

⚠️ **Older material uses `management.endpoint.<id>.enabled=true`.** The 4.1
reference documents the `access` properties for this job, and that is what to
write. If you inherit a configuration using `enabled`, check it against the
current configuration-properties appendix rather than assuming it still has an
effect. Note that `management.health.<key>.enabled` and
`management.info.<id>.enabled` are *different* properties governing
*contributors* rather than endpoints — both of those are current and are covered
in [health](03-health-properly.md) and
[`/info` and the catalogue](09-info-and-the-catalogue.md).

## Gate 3 — is it exposed over the technology you are calling?

```properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoints.web.exposure.exclude=env,beans
management.endpoints.jmx.exposure.include=health,info
```

🔴 **The default for `management.endpoints.web.exposure.include` is `health`,
and nothing else.** That single default explains why a fresh Boot application
answers `/actuator/health` and 404s on everything else, and it is the reason
Actuator is safe to add to a project without a security review — the endpoints
that would leak your configuration or your memory are present in the process
and unreachable over HTTP until somebody opts in.

Web and JMX are configured **separately**. An endpoint exposed over HTTP is not
thereby visible in JConsole, and vice versa. `exclude` wins over `include`, so
`include=*` with `exclude=env,heapdump` is a legitimate shape — though
[locking it down](10-locking-it-down.md) argues that starting from `*` is the
wrong direction to approach the problem from, because an allowlist and a
denylist have opposite failure modes when the endpoint catalogue grows.

## Where the endpoints live: base path and port

The base path is `/actuator` and moves with one property:

```properties
management.endpoints.web.base-path=/manage
management.endpoints.web.path-mapping.health=healthcheck
```

That serves the health endpoint at `/manage/healthcheck`. Renaming the base
path is mild obscurity rather than security, but it does free `/actuator` if
something else in your infrastructure already claims that prefix, and it stops
the most naive internet-wide scans.

The genuinely important control is the **port**:

```properties
management.server.port=9001
management.server.address=127.0.0.1
```

Set `management.server.port` and Boot starts a **second** web server dedicated
to management endpoints, leaving your application's server serving only
application traffic. `management.server.address` narrows the interface it binds
to. There is also `management.server.base-path`, which is the base path *within*
the management server and is a separate knob from
`management.endpoints.web.base-path`.

This matters because it changes what your ingress can reach rather than what
your application chooses to answer, and that is a much stronger kind of control
— [locking it down](10-locking-it-down.md) makes the full argument.

⚠️ Setting a management port has a consequence people forget: **the management
server is a different server**, so it does not inherit your application
server's TLS configuration, its context path, its filters or its
[servlet-level](../01-why-frameworks-servlet-model/02-filters-and-the-container.md)
customisations. Anything you configured under `server.*` for the application
has a `management.server.*` equivalent that you have not set.

## The trade-off

Actuator's cost is that it is *reflective*: several endpoints exist to describe
your application to you, and describing an application accurately means being
able to read its configuration, its beans, its mappings and its memory. There
is no version of `env` that is useful for debugging and useless to an attacker,
because both want the same information for the same reason. You cannot tune
that away; you can only decide who is allowed to ask, which is why the three
gates exist at all.

The second cost is that Actuator's usefulness comes from things being on by
default, and "on by default" and "safe by default" pull in opposite directions.
Spring resolved that by exposing only `health` over HTTP and shipping the
dangerous operations denied — a conservative default that a single
`include=*` undoes completely, usually during an incident, usually
permanently.

## Gotchas

**Symptom:** `/actuator/metrics` returns 404 while `/actuator/health` works, and the starter is definitely present
**Cause:** gate 3 — web exposure defaults to `health` only
**Fix:** name the endpoints you want:
```properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus
```

**Symptom:** the exposure include list is correct and the endpoint is *still* 404
**Cause:** gate 2, not gate 3 — the endpoint's access resolved to `none`, usually because somebody set `management.endpoints.access.default=none` and did not grant this one
**Fix:** grant it explicitly, and check that `max-permitted` is not overruling you:
```properties
management.endpoint.metrics.access=read-only
```

**Symptom:** `/actuator/httpexchanges` is 404 no matter what the exposure list says
**Cause:** gate 1 — the endpoint requires an `HttpExchangeRepository` bean and Boot does not auto-configure one
**Fix:** declare one; the in-memory implementation is bounded and is the intended default:
```java
@Bean
InMemoryHttpExchangeRepository httpExchangeRepository() {
    return new InMemoryHttpExchangeRepository();
}
```

**Symptom:** `management.endpoints.web.exposure.include: *` in YAML fails to parse
**Cause:** a bare `*` is a YAML alias indicator and is not valid unquoted
**Fix:** quote it:
```yaml
management:
  endpoints:
    web:
      exposure:
        include: "*"
```

**Symptom:** `POST /actuator/loggers/com.example` returns 403 as soon as Spring Security is on the classpath
**Cause:** Boot inherits Spring Security's defaults, so CSRF protection is on, and the `POST` and `DELETE` actuator operations are ordinary state-changing requests as far as it is concerned
**Fix:** exclude the actuator paths from CSRF in the actuator's own filter chain, or use a token scheme that does not rely on cookie sessions — see [locking it down](10-locking-it-down.md). Disabling CSRF globally so that one `loggers` call works is not a fix, it is a regression in your application's security

**Symptom:** you set `management.server.port` and every actuator call now fails TLS verification, or 404s under a path that used to work
**Cause:** the management server is a separate server that does not inherit `server.ssl.*`, `server.servlet.context-path` or your servlet filters
**Fix:** configure the management server's own properties:
```properties
management.server.port=9001
management.server.ssl.enabled=true
management.server.base-path=/manage
```

**Symptom:** an endpoint you never heard of appears in production after a routine dependency upgrade
**Cause:** gate 1 is classpath-driven, and your exposure setting is `*`, so a newly auto-configured endpoint is immediately reachable
**Fix:** use an allowlist for `include` rather than `*` plus an `exclude` denylist, so a new endpoint is invisible until somebody decides otherwise

**Symptom:** the health endpoint works in a browser but the operations team's JMX console shows nothing
**Cause:** JMX exposure is its own property and defaults are not shared with web
**Fix:** set the JMX list explicitly, and remember JMX is a separate attack surface with its own network considerations:
```properties
management.endpoints.jmx.exposure.include=health,info
```

## Interview questions

**★ What is the difference between an endpoint being enabled, exposed and accessible?**
Three separate gates. *Existence* is decided by auto-configuration and the
classpath — `httpexchanges` does not exist without an `HttpExchangeRepository`
bean. *Access* (`management.endpoint.<id>.access`, with
`management.endpoints.access.default` as a baseline and
`management.endpoints.access.max-permitted` as a hard ceiling) decides which
operation kinds may be invoked at all, over any technology. *Exposure*
(`management.endpoints.web.exposure.include`/`.exclude` and the JMX pair)
decides whether the endpoint is published over that particular technology. An
endpoint can exist, be `unrestricted`, and still 404 over HTTP because nobody
put it in the web exposure list.

**★ Which endpoints are exposed over HTTP by default, and why does that default matter?**
Only `health`. It matters because it is what makes Actuator safe to add without
a security conversation: `env`, `configprops`, `beans`, `heapdump` and
`threaddump` all exist in the process and are simply unreachable over HTTP. It
also explains the single most common Actuator question, which is not a bug —
`/actuator/metrics` returning 404 on a fresh application is the intended
behaviour.

**★ What does `management.endpoints.access.max-permitted` buy you over per-endpoint access?**
It is a ceiling applied after all other access resolution, so it converts an
intention into a guarantee. Individual `management.endpoint.<id>.access` values
can be overridden by any higher-precedence property source — an environment
variable in a deployment manifest, a config server, a profile — but
`max-permitted=read-only` cannot be exceeded by any of them. It is the right
control for a production profile where you want to be certain no write
operation is reachable, independent of how the rest of the configuration was
assembled.

**★ A colleague sets `management.endpoints.web.exposure.include=*` during an incident. What is your objection?**
Two, and the second is the important one. Immediately, `*` includes `env`,
`configprops`, `heapdump`, `threaddump` and `beans`, which between them hand
over your configuration and the contents of your process memory. Structurally,
`*` is a commitment about the *future* as well as the present: endpoint
presence is classpath-driven, so a dependency added six months later can publish
an endpoint nobody reviewed and it is live the moment it deploys. An allowlist
has the opposite failure mode — a new endpoint is invisible until somebody asks
for it — and that is the failure mode you want on the side of production.

**★ Why is a separate `management.server.port` stronger than securing the endpoints in the application?**
Because it changes what is *reachable* rather than what is *answered*. With
everything on one port, your protection is a filter chain inside the
application: correct today, and one misconfigured `securityMatcher`, one
ordering mistake or one framework upgrade away from being wrong, with the
public internet on the other side of it. With a separate management port bound
to an internal interface, the request never arrives — your ingress, service
definition and network policy simply do not route to that port. The two are
complements rather than alternatives, but only one of them keeps working when
the application's security configuration is wrong.

**★ What breaks when you move actuator to its own port, and how do you find out?**
The management server is a genuinely separate server, so it inherits nothing
from `server.*`. TLS (`server.ssl.*`), the servlet context path, and any
servlet filters or customisers you registered against the application server
are not applied to it, and each has a `management.server.*` counterpart you have
not configured. The way this surfaces is a monitoring probe that used to work
now failing on scheme or path rather than on the endpoint itself, so the
diagnostic question is "is this request reaching a different server than I
think" before "is this endpoint exposed".

---

← Prev: [What Actuator is](01-what-actuator-is.md) · Index: [Actuator](README.md) · Next → [Health, properly](03-health-properly.md)
