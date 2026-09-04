---
title: "The endpoint catalogue: what each one is for"
sidebar_label: "17 · The endpoint catalogue"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1.1 reference — *Actuator ·
> Endpoints* (docs.spring.io/spring-boot/reference/actuator/endpoints.html: the
> table of built-in endpoint IDs and descriptions — `auditevents`, `beans`,
> `caches`, `conditions`, `configprops`, `env`, `flyway`, `health`,
> `httpexchanges`, `info`, `integrationgraph`, `loggers`, `liquibase`,
> `metrics`, `mappings`, `quartz`, `scheduledtasks`, `sessions`, `shutdown`,
> `startup`, `threaddump`, and the web-only `heapdump`, `logfile` and
> `prometheus`; `loggers` described as showing *and modifying* logger
> configuration; `httpexchanges` displaying by default the last 100 exchanges
> and requiring an `HttpExchangeRepository` bean; `auditevents` requiring an
> `AuditEventRepository` bean; `heapdump` returning HPROF on HotSpot and PHD on
> OpenJ9; `shutdown` being disabled by default; and the discovery page available
> at `/actuator`). Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Around twenty endpoints ship and one is exposed. The catalogue is worth
learning the way a runbook is worth reading before an outage: not so you can
enable all of it, but so that at three in the morning you already know which
endpoint answers the question in front of you, instead of discovering afterwards
that there was one. And the same reading tells you which half of the catalogue
has no business being reachable from production at all.**

## The catalogue

| ID | What it is genuinely for | Worth knowing |
|---|---|---|
| `loggers` | Raising a log level on a live process | The only one you routinely **write** to — see below |
| `threaddump` | "What is every thread doing right now" | First stop for a hang or pool exhaustion; costs nothing to take |
| `heapdump` | A memory leak you cannot reproduce | HPROF on HotSpot, PHD on OpenJ9. Hands over everything in memory — [chunk 18](18-locking-it-down.md) |
| `env` | "What did this property actually resolve to" | Settles precedence questions from [configuration](../06-configuration-and-profiles/01-the-environment-and-precedence.md). Values are sanitised by default |
| `configprops` | The same, for bound `@ConfigurationProperties` objects | Shows the object your code sees, after binding and conversion |
| `beans` | The object graph the container built | Mostly a development tool; occasionally settles "is that bean even there" |
| `conditions` | Why an auto-configuration did or did not apply | The endpoint form of the [conditions report](../05-auto-configuration/07-the-conditions-report.md) |
| `mappings` | Every request mapping the application registered | The fastest answer to "why is this URL a 404" |
| `scheduledtasks` | What is scheduled, and with what trigger | Confirms a cron expression parsed the way you meant it |
| `caches` | Which caches exist, and clearing them | The `DELETE` is a live production operation, not an inspection |
| `httpexchanges` | The last N request/response exchanges | Needs a repository bean; **not** an access log — see below |
| `startup` | Where startup time went | Needs a buffering startup set before `run` — see below |
| `metrics` / `prometheus` | The metric families of [chunk 09](09-what-boot-measures.md) | `prometheus` needs the registry dependency *and* exposure |
| `flyway` / `liquibase` | Which migrations have been applied | Answers "did the migration run on this instance" without a database session |
| `quartz` / `sessions` / `integrationgraph` | Scheduler jobs, user sessions, the integration graph | Present when the corresponding feature is |
| `auditevents` | Published audit events | Needs an `AuditEventRepository` bean |
| `logfile` | The log file's contents over HTTP | Only when `logging.file.name` is configured |
| `shutdown` | Ending the process on request | Not unrestricted by default, and rarely the right tool — [graceful shutdown](07-groups-and-graceful-shutdown.md) is |
| `health` / `info` | Covered in chunks [03](03-health-properly.md)–[07](07-groups-and-graceful-shutdown.md) and [16](16-info-and-the-catalogue.md) | The only two most deployments should expose |

There is also a **discovery page at `/actuator`**, listing links to everything
exposed. Convenient in development, and a complete inventory of your management
surface for anyone else who finds it.

## `loggers`: the one that changes an incident

```
GET  /actuator/loggers/com.example.payments
POST /actuator/loggers/com.example.payments   {"configuredLevel":"DEBUG"}
POST /actuator/loggers/com.example.payments   {"configuredLevel":null}
```

This earns its own section because of what it lets you avoid. The alternative to
raising a log level at runtime is redeploying with the level changed — which
restarts the process, discards the state that produced the bug, empties the
caches and connection pools involved, and hands you a clean instance that may not
reproduce the problem for hours. `loggers` keeps the broken process and turns the
lights on inside it.

Two behaviours to know. Posting `configuredLevel: null` **resets** the logger to
its configured default rather than setting a null level, which is how you undo
the change. And the change is **not persisted** — the next restart returns to
your configuration file. That is mostly a feature, because a forgotten `DEBUG` on
a busy package heals itself at the next deploy instead of quietly filling a disk
for a year; it is occasionally a trap, because a level set during an
investigation vanishes when the pod is rescheduled mid-investigation.

⚠️ A `POST` to `loggers` is a state-changing request, so with Spring Security on
the classpath it meets CSRF protection like anything else. That is covered in
[chunk 02](02-exposure-access-and-ports.md), and the fix belongs in the actuator's
own filter chain rather than in a global setting.

## Three that need something before they work

**`httpexchanges` needs a repository bean**, and there is none by default, so the
endpoint returns an empty list rather than an error:

```java
@Bean
InMemoryHttpExchangeRepository httpExchangeRepository() {
    return new InMemoryHttpExchangeRepository();
}
```

It keeps the last 100 exchanges by default. That makes it a debugging aid on one
instance during one investigation — it is per-instance, bounded, lost on restart,
and it holds request and response metadata in the heap of a production process.
It is not an access log and cannot become one.

**`startup` needs a buffering `ApplicationStartup` set before the context
exists**, which is why it cannot be contributed as a bean:

```java
public static void main(String[] args) {
    SpringApplication app = new SpringApplication(Application.class);
    app.setApplicationStartup(new BufferingApplicationStartup(2048));
    app.run(args);
}
```

**`auditevents` needs an `AuditEventRepository` bean**, for the same
present-but-empty reason.

The pattern across all three is worth naming: **an actuator endpoint that returns
nothing is far more often missing a collaborator than misconfigured.** Boot
registers the endpoint because the classes are there and leaves the storage
decision to you, because storing this data has costs it is not entitled to impose.

## Incident tools and development tools

The catalogue divides cleanly, and knowing which side an endpoint falls on tells
you where it should be reachable from.

**During an incident:** `health` — is this instance in rotation and why not;
`loggers` — see more without losing the process; `threaddump` — what is
everything blocked on; `metrics` or `prometheus` — what changed and when; and
`heapdump` as a genuine last resort with a security conversation attached.

**During development:** `beans`, `conditions`, `configprops`, `mappings`,
`startup`. Every one of these answers a question about how the application was
*assembled*, which is a question you have on your own machine far more often than
in production — and which, answered over the network, describes your architecture
to whoever asked.

That split is the practical form of [chunk 18](18-locking-it-down.md)'s argument.
The development half is not dangerous because of what it lets someone *do*; it is
dangerous because of what it *tells* them.

## Gotchas

**Symptom:** `/actuator/httpexchanges` returns an empty list on a busy service
**Cause:** no `HttpExchangeRepository` bean exists, so nothing is recording exchanges
**Fix:** register `InMemoryHttpExchangeRepository` — and do not treat the result as an access log, because it is per-instance, capped at a hundred entries and lost on restart

**Symptom:** `/actuator/startup` is exposed and reports nothing useful
**Cause:** a `BufferingApplicationStartup` must be set on the `SpringApplication` before `run(...)`, which is earlier than any bean can exist
**Fix:** set it in `main`, as shown above — and remember it buffers, so it costs memory in exchange for the data

**Symptom:** a `DEBUG` level set through `loggers` disappears part-way through an investigation
**Cause:** the change lives in the running process only; the pod restarted or was rescheduled
**Fix:** expect it and re-apply. The same non-persistence is what stops a forgotten `DEBUG` surviving forever, so it is not worth engineering around

**Symptom:** `POST /actuator/loggers/...` returns 403 once Spring Security is on the classpath
**Cause:** it is a state-changing request and meets CSRF protection like any other
**Fix:** handle CSRF within the actuator's own chain — see [chunk 02](02-exposure-access-and-ports.md). Disabling CSRF globally so one call works is a regression, not a fix

**Symptom:** `env` shows `******` for the value you are trying to debug
**Cause:** sanitisation is on by default and is doing its job
**Fix:** `management.endpoint.env.show-values=when-authorized` with a real authentication story behind it — never `always` on anything reachable. The argument is in [chunk 18](18-locking-it-down.md)

**Symptom:** someone clears a production cache while "just looking at the caches endpoint"
**Cause:** `caches` supports `DELETE`, and a tool or a curious click can issue one
**Fix:** treat it as a write endpoint, not an inspection endpoint — restrict it with `management.endpoint.caches.access=read-only` if you want the listing without the eviction

**Symptom:** `/actuator/prometheus` 404s with the dependency plainly in the build
**Cause:** the dependency registers the endpoint; exposure is a separate gate
**Fix:** expose it explicitly. This particular confusion is durable because the symptom — a 404 — looks like a missing dependency rather than a missing property

**Symptom:** `/actuator` itself lists every endpoint you have
**Cause:** the discovery page is there by default and enumerates the exposed set
**Fix:** it is only as sensitive as the endpoints it lists, so the real fix is the exposure list — but on a public port the page itself is a free inventory and worth switching off

## Interview questions

**★ Production hang. Which endpoint first, and why that one?**
`threaddump`. It is free to take, needs no prior setup, and answers the question
a hang actually poses: what is every thread blocked on. Thread names usually
identify the pool, and a wall of threads parked on the same monitor or the same
connection-pool acquire is the diagnosis rather than a clue toward it. `heapdump`
answers a different question — memory rather than liveness — and brings a much
larger security conversation with it.

**★ Why is `loggers` disproportionately valuable?**
Because it is the one you write to, and because the alternative destroys the
evidence. Raising a package to `DEBUG` normally means a redeploy, which restarts
the process, discards the state that produced the bug and empties the caches and
pools involved — you get a healthy instance and no reproduction. `loggers` keeps
the broken process and increases what it tells you. Posting
`{"configuredLevel":null}` resets to the configured default, and nothing
persists, so a restart returns to your configuration file.

**★ Can `httpexchanges` serve as an access log?**
No, and it is worth being firm about why. It needs an `HttpExchangeRepository`
bean that does not exist by default; the supplied implementation keeps the last
hundred exchanges; the data is per-instance and lost on restart; and it holds
request and response metadata in the heap of a production process. It is a
debugging aid for one instance during one investigation. An access log is the
server's or the proxy's job, and the difference is durability and completeness.

**★ Why do `env` and `configprops` both exist?**
They answer different halves of the same question. `env` shows the
`Environment` — the raw property sources and their precedence — which is what you
want when arguing about *which* source won. `configprops` shows the bound
`@ConfigurationProperties` objects, which is what your code actually reads, after
relaxed binding, conversion and defaults have been applied. A value can look
correct in `env` and be wrong in `configprops` because of a binding mistake, and
that gap is exactly what the pair is for.

**★ An endpoint is exposed and returns an empty body. What is your first hypothesis?**
That it is missing a collaborator rather than misconfigured. `httpexchanges`
needs an `HttpExchangeRepository`, `auditevents` needs an `AuditEventRepository`,
`startup` needs a `BufferingApplicationStartup` set before the context is built,
and `info` needs contributors and their files. Boot registers the endpoint
because the classes are on the classpath and leaves the storage decision to you,
because keeping this data has a cost it is not entitled to impose on every
application.

**★ Someone proposes `include: "*"` so everything is there when it is needed. Your response?**
That the catalogue splits into incident tools and development tools, and the
development half — `beans`, `conditions`, `configprops`, `mappings`, `env` — is a
description of your architecture that is almost never needed from production.
Enabling everything to save a configuration change during a hypothetical future
incident trades a permanent exposure for a possible minute. The better answer is a
deliberate list on a management port, which is the next chunk's subject.

**★ Which endpoints would you expose on a public-facing port, and why so few?**
`health`, and usually only a group of it — often not even `info`. Everything else
goes on the management port. The reasoning is that the public port's audience is
the internet and a load balancer, and the only thing either legitimately needs to
ask is whether this instance should receive traffic. Every additional endpoint on
that port is answering a question nobody on that side of the network is entitled
to ask.

---

← Prev: [`/info` and build metadata](16-info-and-the-catalogue.md) · Index: [Actuator](README.md) · Next → [Locking Actuator down](18-locking-it-down.md)
