---
title: "You can turn DEBUG on for one class in a running production service with a single POST, get the twenty lines you needed, and turn it off again — and the reason this is not routine practice is that the endpoint is not exposed by default, it changes only the instance you happened to reach, and nothing anywhere reverts it if you forget"
sidebar_label: "12 · Changing levels at runtime"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1 Actuator API documentation** for the
> `loggers` endpoint — the `GET /actuator/loggers` response shape (`levels`, `loggers`, `groups`,
> `configuredLevel`, `effectiveLevel`), the built-in `web` and `sql` groups and their listed
> members, `POST /actuator/loggers/{name}` with `{"configuredLevel":"debug"}`, and the documented
> note that `configuredLevel` *"May be omitted to clear the level"* with `{}` clearing it
> ([docs.spring.io](https://docs.spring.io/spring-boot/api/rest/actuator/loggers.html)); and the
> **Spring Boot 4.1** Actuator reference for endpoint exposure defaults
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)).
> Responses carry `Content-Type: application/vnd.spring-boot.actuator.v3+json`.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The alternative to changing a log level at runtime is a deploy — which means the diagnostic
information you wanted describes a process that no longer exists, in a state you have just
destroyed. That is the argument for this endpoint, and it is strong enough that the reasons people
do not use it are worth examining one at a time, because most of them are solvable and one of them
is real.**

## The endpoint

`GET /actuator/loggers` returns every logger the application knows about, the levels the logging
system supports, and the configured logger groups:

```json
{
  "levels" : [ "OFF", "FATAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE" ],
  "loggers" : {
    "ROOT" : { "configuredLevel" : "INFO", "effectiveLevel" : "INFO" },
    "com.example" : { "configuredLevel" : "DEBUG", "effectiveLevel" : "DEBUG" }
  },
  "groups" : {
    "web" : { "members" : [ "org.springframework.core.codec", "org.springframework.http",
                            "org.springframework.web", "…" ] },
    "sql" : { "members" : [ "org.springframework.jdbc.core", "org.hibernate.SQL",
                            "org.jooq.tools.LoggerListener" ] }
  }
}
```

Setting a level is a POST:

```bash
curl 'http://localhost:8080/actuator/loggers/com.example' -i -X POST \
  -H 'Content-Type: application/json' \
  -d '{"configuredLevel":"debug"}'
```

And clearing it — returning the logger to inheriting from its parent — is a POST with an empty
object, which is the part people do not know:

```bash
curl 'http://localhost:8080/actuator/loggers/com.example' -i -X POST \
  -H 'Content-Type: application/json' \
  -d '{}'
```

The documentation states it plainly: `configuredLevel` *"May be omitted to clear the level."*
🔴 **Clearing is not the same as setting the level back to what you think it was.** Setting
`INFO` explicitly pins that logger at INFO forever, which means a later change to the root level
will not reach it. Clearing restores inheritance. Almost everyone does the first.

## `configuredLevel` versus `effectiveLevel`

The response gives both, and the distinction is the single most useful thing this endpoint
provides — more useful, day to day, than changing anything:

- **`configuredLevel`** is what has been set on that logger specifically. It is frequently `null`.
- **`effectiveLevel`** is what actually applies, after inheritance from ancestor loggers up to
  ROOT.

A logger with `configuredLevel: null` and `effectiveLevel: DEBUG` is inheriting DEBUG from
somewhere above it. **That state appears nowhere in any configuration file**, and it is the usual
explanation for the volume problem in [11](11-rolling-retention-and-cost.md): somebody set DEBUG
on a broad package, and every logger beneath it inherited. Reading the configuration will never
find it; querying the running application takes a second.

**Audit effective levels, not configured ones.** It is worth making that a periodic check rather
than an incident activity, because the failure it detects is silent and expensive.

## Logger groups

Boot ships two groups — `web` and `sql` — and their membership is documented. `sql` is the
practically valuable one: it covers `org.springframework.jdbc.core`, `org.hibernate.SQL` and
`org.jooq.tools.LoggerListener`, so one POST to `/actuator/loggers/sql` turns on SQL logging
across whichever of those the application actually uses, without needing to know which. Custom
groups are defined with `logging.group.*`, which is worth doing for the two or three diagnostic
bundles a team reaches for repeatedly.

## Why this is not routine, and which objections are real

**"It is not exposed."** Correct, and deliberate: Boot's default web exposure is minimal, so
`loggers` is not reachable until `management.endpoints.web.exposure.include` names it. This is a
solvable problem and the solution is not to expose everything.

**"It is a security risk."** Partly real. The endpoint is *write* access to application behaviour:
enabling `DEBUG` on a framework package can cause headers, bound SQL parameters and payloads to be
logged, which is [08 · What never to log](08-what-never-to-log.md) triggered remotely by whoever
can reach the endpoint. It needs authentication and authorisation like any other administrative
operation. The correct response is a management port bound separately with auth, not leaving the
capability off.

**"It only changes one instance."** 🔴 **This is the real objection, and it has no clean answer.**
The POST reaches whichever replica the load balancer chose. With ten replicas you have changed one
and you do not know which, and the request you are trying to observe will probably land on a
different one. The workarounds are all awkward: address pods directly, script the change across
all of them, or use a configuration mechanism that propagates. It is genuinely easier on a
single-instance service, and this is the reason the technique is more common in support of a
specific reproducible request than as a general debugging tool.

**"We will forget to turn it off."** Also real, and it is the same failure as
[08](08-what-never-to-log.md)'s temporary DEBUG: nothing fails when you forget, so nothing reminds
you. Because the change is not persisted, a restart clears it — which means the problem
self-corrects on the next deploy and persists indefinitely on a service that is not being
deployed. The mitigations are procedural: a scheduled audit of effective levels, or a script that
sets the level with a timer and clears it.

## Not persisted, and what that means both ways

A runtime level change lives in memory. It survives no restart, and it is not written to any
configuration file.

That cuts both ways, and both are worth holding. **Good:** the change is inherently temporary and
carries no risk of accidentally becoming permanent configuration; the blast radius is one process
until it restarts. **Bad:** a change you *wanted* to keep vanishes at the next deploy, and a
diagnostic session that was working stops working with no notification. If a level change should
be durable, it belongs in configuration and in the deploy, not in this endpoint.

## Gotchas

**★ The endpoint is not exposed by default, and exposing everything is the wrong fix.**
Boot's default web exposure is minimal. Add `loggers` deliberately, behind authentication, ideally
on a separate management port.

**★ It is write access to application behaviour, so it needs authorisation.**
Enabling DEBUG on a framework package can start logging headers, SQL parameters and payloads.
Anyone who can reach the endpoint can cause that.

**★ `{}` clears a level; setting `INFO` pins it.**
Clearing restores inheritance from the parent. Explicitly setting what you believe the old value
was permanently detaches that logger from the hierarchy, so a later root-level change will not
reach it — and nobody notices for years.

**★ `effectiveLevel` is the number that matters and `configuredLevel` is the one in the file.**
A logger with a null `configuredLevel` and an effective DEBUG is inheriting from an ancestor, a
state invisible in any configuration file. This is usually where a mystery volume problem lives.

**★ The POST changes one replica, chosen by the load balancer.**
With several instances you have changed an unknown one, and the request you want to observe will
probably be served by a different one. This is the genuine limitation of the technique.

**★ Nothing reverts the change, and nothing fails if you forget.**
It behaves exactly like the temporary DEBUG of [08](08-what-never-to-log.md): silent, costly, and
self-correcting only on restart — which means it self-corrects on an actively deployed service and
never on a stable one.

**★ The change is not persisted, so a restart silently ends your diagnostic session.**
Useful as a safety property, and surprising in the middle of an investigation when a pod is
rescheduled and the logging you enabled quietly stops.

**★ Boot's `sql` group covers Spring JDBC, Hibernate and jOOQ in one call.**
`POST /actuator/loggers/sql` enables SQL logging without needing to know which of the three the
application uses. It is the most useful built-in group and is widely unknown.

**★ Turning on DEBUG for a busy package can be the incident.**
An order-of-magnitude volume increase on a running service can saturate the appender's lock
([10c](10c-the-log-that-became-the-bottleneck.md)) or fill the async queue
([10b](10b-async-appender.md)). Change the narrowest logger that answers the question, not the
package above it.

**★ `jcmd VM.log` is the JVM-level analogue and is often forgotten.**
For JVM diagnostics — GC, safepoints — the equivalent runtime control is `jcmd <pid> VM.log`,
which needs no endpoint, no exposure and no authentication beyond shell access.

**★ Auditing effective levels belongs on a schedule, not in an incident.**
The failure it detects — an inherited DEBUG nobody remembers — is silent and expensive, and by
definition nobody is going to notice it spontaneously.

## Interview questions

**★ How do you enable DEBUG for one class in production without a restart?**
A POST to Actuator's `loggers` endpoint: `POST /actuator/loggers/com.example.PaymentService` with
`{"configuredLevel":"debug"}`. The endpoint has to be exposed first — Boot's default web exposure
is minimal and deliberately does not include it — and it should be behind authentication on a
management port, because it is write access to application behaviour: enabling DEBUG on a
framework package can start logging headers, bound SQL parameters and payloads, which is a
disclosure triggered remotely. When you are done, POST `{}` to the same path, which clears the
configured level and restores inheritance from the parent. That last detail is the one people get
wrong — setting `INFO` explicitly instead of clearing pins the logger at INFO permanently and
detaches it from the hierarchy, so a later root-level change will silently not apply to it. The
important caveat is that the change affects only the instance the load balancer routed you to,
which is the real reason the technique is used less than it should be.

**★ What is the difference between `configuredLevel` and `effectiveLevel`, and why does it
matter?**
`configuredLevel` is what has been set on that specific logger — frequently null — while
`effectiveLevel` is what actually applies after inheritance from ancestor loggers up to ROOT. It
matters because the level that generates volume and controls output is the effective one, and the
effective one can be set by something that appears nowhere near the logger in question. A logger
with `configuredLevel: null` and `effectiveLevel: DEBUG` is inheriting DEBUG from an ancestor
package, which is invisible in every configuration file and is the usual explanation for a
mysterious tenfold log volume. So auditing configuration is the wrong instrument: you have to ask
the running application. It is worth doing periodically rather than during an incident, because
the condition is silent — nothing fails, the invoice just grows — and nobody discovers it
spontaneously.

**★ What is the strongest argument against using this endpoint, and how do you mitigate it?**
That it changes exactly one replica, and you do not control which. The POST goes through the load
balancer to some instance, and the requests you are trying to observe are distributed across all
of them, so with ten replicas you have a one-in-ten chance of watching the right process — and no
indication when you are not. Every mitigation is awkward: address the pods directly, which needs
network access and pod names; script the change across every replica, which multiplies the volume
risk and the chance of forgetting one when reverting; or push the change through a configuration
mechanism that propagates, which is heavier and slower than the thing you were trying to avoid.
The technique is genuinely strongest in two situations — a single-instance service, and a case
where you can pin a specific reproducible request to a specific instance. As a general debugging
tool at scale it is weaker than its reputation, and it is worth saying so rather than presenting
it as a clean solution.

**★ Why is "we will just set it back to INFO afterwards" not the right way to revert?**
Because setting a level explicitly is not the inverse of setting one; it is another act of
configuration. If the logger previously had no configured level of its own — which is the normal
case — it was inheriting from an ancestor, and setting it to INFO detaches it from that
inheritance permanently. Everything looks correct immediately afterwards, because INFO is probably
what it was resolving to anyway. The damage appears later, when someone changes the root or the
package level and this one logger silently does not follow, and nobody connects that to a
debugging session months earlier. The correct revert is a POST with `{}`, which the documentation
describes as omitting `configuredLevel` to clear the level, restoring inheritance. It is a small
detail with a long tail, and it is a good example of a general principle: reverting a change means
restoring the previous *state*, not applying a value that resembles it.

**★ Could enabling DEBUG at runtime cause an outage?**
Yes, and it is worth treating as a real operational risk rather than a theoretical one. Raising a
busy package to DEBUG can increase log volume by an order of magnitude instantly, on a running
system, with no deploy and no gradual ramp. That volume hits the appender's single write lock, so
you can saturate the serialisation point described in
[10c](10c-the-log-that-became-the-bottleneck.md) and cap the application's throughput; if an async
appender is in front of it, you fill a 256-event queue and start either discarding or blocking
application threads depending on `neverBlock`. It can also fill a disk, if anything is writing
files. The mitigations are to change the narrowest logger that could answer the question rather
than the package above it, to do it on one instance rather than all of them, and to know in
advance what the revert command is — which is `{}`, not INFO.

**★ What is the JVM-level equivalent for diagnostics that are not application logging?**
`jcmd <pid> VM.log`, which adds and removes `-Xlog` output on a running JVM. It covers the
diagnostics that Actuator's `loggers` endpoint cannot reach — GC logging, safepoint logging, class
loading, JIT — and it has three practical advantages over the HTTP endpoint: it needs no endpoint
exposure and no authentication beyond shell access to the container, it applies to the specific
process you have chosen rather than to whichever replica a load balancer picked, and it works on
any JVM regardless of framework. The pairing is worth knowing as a pair, because the two halves of
"turn on more detail without restarting" live in completely different places: application logging
through Actuator, JVM internals through `jcmd`. Someone who knows only the first will conclude
that GC or safepoint logging requires a restart, which it does not.

{/* FOOTER */}
