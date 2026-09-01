---
title: "A log level is not a measure of how interesting a line is — it is a routed instruction to a specific human, and once you define each level by who has to do something about it, almost every argument about what level to use answers itself"
sidebar_label: "03 · Levels"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback manual, "Architecture"**, for level inheritance and
> the basic selection rule ([logback.qos.ch](https://logback.qos.ch/manual/architecture.html)),
> the **SLF4J FAQ** on the absence of a FATAL level
> ([slf4j.org](https://www.slf4j.org/faq.html)), and the **Spring Boot 4.1 reference, "Logging"**
> for `logging.level.*`, log groups and the supported level names
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)).
> 🔴 **No sandbox.** JDK 25 · Spring Boot 4.1.0 · SLF4J 2.0.18 · Logback 1.5.34.

**Five levels, and teams argue about them forever because they are usually defined by *severity* —
a subjective scale on which everything drifts upward. Define them instead by **who is expected to
act and how quickly**, and the ambiguity mostly disappears: a level is a routing instruction, and
an ERROR that nobody is meant to respond to is a mislabelled INFO.**

## The mechanism, so the policy has something to stand on

Logback's rule, verbatim:

> *"A log request of level `p` issued to a logger having an effective level `q`, is enabled if
> `p >= q`."*

with the ordering *"TRACE `<` DEBUG `<` INFO `<` WARN `<` ERROR"*, and the effective level defined
as:

> *"The effective level for a given logger L, is equal to the first non-null level in its
> hierarchy, starting at L itself and proceeding upwards in the hierarchy towards the root
> logger."*

Logger names are dotted and hierarchical, so `com.example.order.OrderService` inherits from
`com.example.order`, then `com.example`, then `com`, then `root`. Nothing is registered in advance:
the hierarchy is implied by the names, which is why the class-literal idiom in
[02](02-the-facade-and-the-backend.md) matters — the name *is* the configuration key.

In Spring Boot that configuration is properties rather than XML:

```properties
logging.level.root=INFO
logging.level.com.example.order=DEBUG
logging.level.org.hibernate.SQL=DEBUG
```

Boot accepts **TRACE, DEBUG, INFO, WARN, ERROR, FATAL, OFF** as level names. FATAL is mapped for
compatibility — SLF4J itself has no `fatal` method, and the FAQ explains why:

> *"The Marker interface, part of the `org.slf4j` package, renders the FATAL level largely
> redundant. If a given error requires attention beyond that allocated for ordinary errors, simply
> mark the logging statement with a specially designated marker."*

⚠️ **Boot's root default is INFO, but Logback's own root default is DEBUG.** A hand-written
`logback.xml` with no `<root level>` and no `<include>` of Boot's `defaults.xml` gives you a
DEBUG root — which is how a service starts emitting every framework's internal chatter after
someone "took control of the logging configuration".

## The definitions, by who acts

**ERROR — a human must look, and the system cannot fix it itself.**
Work was lost or corrupted, and no automatic recovery will retrieve it. A failed payment
capture with no retry left. A message that exhausted its redelivery attempts and went to the
dead-letter queue. A configuration value that is required and absent.

🔴 **The test: if this fires a hundred times, is that a hundred things a person must investigate?**
If the honest answer is "no, it self-heals" or "we ignore those", it is not ERROR.

**WARN — the system handled it, but the fact that it happened is diagnostic.**
A retry succeeded on the third attempt. A circuit breaker opened. A deprecated endpoint was
called. A cache miss rate crossed a threshold. Nothing is broken *now*; something is trending, or
a degraded path was taken.

🔴 **The test: does this line change what someone would investigate if the service later
misbehaves?** If not, it is INFO. [03b](03b-the-warn-that-nobody-acts-on.md) is entirely about
what happens when this test is skipped.

**INFO — the audit trail of what the service did, at business granularity.**
One or two lines per unit of work: what was requested, what was decided, what was produced. Plus
lifecycle events — started, configuration profile active, shutting down, connected to X.

🔴 **The test: could you reconstruct what the service did for a given request from INFO alone?**
If yes, and without more than a handful of lines per request, the level is right. INFO is the
level that is *on* in production, so it is the level where the cost discipline of
[11](11-rolling-retention-and-cost.md) actually bites.

**DEBUG — what a developer needs to understand *how* the code reached its conclusion.**
Intermediate values, branch decisions, the query that was built, the response that was parsed.
Off in production by default, turned on for one logger for ten minutes during an investigation
([12](12-changing-levels-at-runtime.md)).

🔴 **The test: is this useful only if you have the source open?** Then it is DEBUG, not INFO.

**TRACE — DEBUG is not verbose enough and you are debugging the framework.**
Per-element loop bodies, protocol frames, wire dumps. Almost always someone else's code. Turning
TRACE on for `org.springframework.web` for one class of request is a legitimate and occasional
move; leaving it on is not.

## The one that is actually hard: WARN or ERROR?

Most level disputes reduce to this pair, and the deciding question is **whether the outcome is
final**.

| Situation | Level | Why |
|---|---|---|
| Retry 1 of 3 failed | DEBUG or WARN | Not final; the operation may still succeed |
| All retries exhausted, request failed | **ERROR** | Final, work was lost |
| Circuit breaker opened | **WARN** | Deliberate degradation, self-healing by design |
| Circuit breaker still open after N minutes | **ERROR** | No longer self-healing |
| Validation rejected a client's malformed request | **INFO** (or DEBUG) | The system behaved correctly; the client is wrong |
| Validation rejected an *internal* caller's request | **ERROR** | Your own code sent something invalid |
| Optimistic-lock conflict, retried and succeeded | DEBUG | Expected under concurrency |
| Optimistic-lock conflict, gave up | **ERROR** | Work lost |

🔴 **The client-error line is the one teams get wrong most often, and in the expensive direction.**
A 400 response to a malformed request is the API working. Logging it at ERROR means your error
rate — and any alert built on it — is driven by *other people's* bugs and by scanners, which
trains everyone to ignore ERROR. The status code already carries this; a metric counts it
properly.

## Levels are not a filter you apply after the fact

A common instinct is to log everything at INFO and "filter later in the aggregator". This fails
for three reasons worth naming:

1. **You pay ingestion for everything you emit**, and ingestion is where the bill is
   ([11](11-rolling-retention-and-cost.md)).
2. **The level is the only signal of intent the author can leave.** A downstream filter has to
   re-derive from message text what the author already knew.
3. **You lose the runtime knob.** The entire point of DEBUG being *off* is that you can turn it
   *on* for one logger during an incident. If everything is INFO, there is nothing to turn on.

## Log groups: levels for a subsystem, not a package

Boot lets you name a set of loggers and set them together:

```properties
logging.group.payments=com.example.payments,com.stripe,org.springframework.web.client
logging.level.payments=DEBUG
```

Boot pre-defines two: **`web`** (`org.springframework.core.codec`, `org.springframework.http`,
`org.springframework.web`, `org.springframework.boot.actuate.endpoint.web`,
`org.springframework.boot.web.servlet.ServletContextInitializerBeans`) and **`sql`**
(`org.springframework.jdbc.core`, `org.hibernate.SQL`, `LoggerListener`).

🔴 **This is the feature that makes runtime level changes usable.** A real investigation almost
never wants one class — it wants "the payment path", which spans your code, a client library and
Spring's HTTP layer. Defining that group in advance turns a five-property change under pressure
into one call to the `loggers` endpoint ([12](12-changing-levels-at-runtime.md)), and groups are
addressable there by name.

## The environment-variable form, which you will need in a container

Boot's relaxed binding maps `logging.level.org.springframework.web` to
`LOGGING_LEVEL_ORG_SPRINGFRAMEWORK_WEB`. That is how a level gets set in a Kubernetes manifest
without rebuilding an image, and it is worth knowing before an incident rather than during one.

⚠️ **Dots become underscores and case is lost**, so a logger name containing an underscore or
mixed-case package segment cannot be addressed this way. That is rare in Java and worth
remembering when it bites.

## Gotchas

**★ ERROR that nobody investigates trains everyone to ignore ERROR.**
The level is a routing instruction. Once a fraction of ERRORs are known-noise, the whole level
loses its meaning and the real one is missed. This is the same failure as
[03b](03b-the-warn-that-nobody-acts-on.md), one level up, and worse because ERROR is usually what
alerts fire on.

**★ Logging client errors — 400s, validation failures, malformed input — at ERROR.**
The system behaved correctly. Doing this makes your error rate a function of other people's bugs
and of internet background scanning. It belongs at INFO or DEBUG, with a counter for the rate.

**★ Logback's root default is DEBUG; Boot's is INFO.**
A hand-written `logback.xml` that omits `<root level>` and does not `<include>` Boot's
`defaults.xml` silently switches the whole application to DEBUG, including every framework.

**★ A hard-coded logger name breaks level configuration after a package move.**
`logging.level.com.example.order` matches on the logger's *name*. A logger created with a string
literal keeps its old name forever, so the configuration silently stops applying — with no error
anywhere.

**★ Setting a level on a class rather than a package usually misses the interesting output.**
The framework code doing the work is in another package. `logging.level.com.example.OrderService`
turns up your own three statements and none of the client library's. Groups exist for this.

**★ `logging.level.root=DEBUG` in a container is a self-inflicted incident.**
Every framework on the classpath starts narrating. On a busy service this can multiply log volume
by orders of magnitude, saturate the appender ([10c](10c-the-log-that-became-the-bottleneck.md))
and produce an ingestion bill nobody budgeted for.

**★ FATAL is not an SLF4J level.**
`org.slf4j.Logger` has no `fatal` method. Boot accepts the name in configuration for
compatibility, and Logback maps it, but in code the SLF4J answer is a Marker on an ERROR
statement — which is also what makes it routable by a filter.

**★ "Log everything at INFO and filter downstream" moves the cost to the most expensive place.**
Ingestion is billed on what you emit, not on what you keep. It also discards the author's own
judgement about importance and removes the runtime DEBUG knob entirely.

**★ Level checks are per-logger, and a logger you never named inherits from `root`.**
A new package added in a refactor silently picks up the root level. If that root is DEBUG in a
non-production profile and the profile leaks, so does the volume.

## Interview questions

**★ Define each of the five levels without using the words "important" or "severe".**
TRACE: framework-internal detail, on for minutes at most. DEBUG: what a developer needs to see how
the code reached its conclusion — useful only with the source open, off in production by default.
INFO: the audit trail of what the service did at business granularity, on in production, a
handful of lines per unit of work. WARN: the system handled it, but the fact it happened changes
what someone would investigate later. ERROR: work was lost or corrupted and no automatic recovery
will retrieve it — a human must look. Each definition is about who acts and when, which is what
makes it decidable.

**★ Should a validation failure on an inbound HTTP request be logged at ERROR?**
Normally no. A 400 for a malformed request means the API worked as designed; the caller is wrong.
Logging it at ERROR makes your error rate track other people's bugs and internet scanning traffic,
and it dilutes ERROR until nobody trusts it. INFO or DEBUG plus a counter is right. The exception
is when the caller is an internal system you own — then an invalid request is your own bug and
ERROR is honest.

**★ How does Logback decide whether a given statement produces output?**
By the basic selection rule: a request of level `p` on a logger with effective level `q` is
enabled if `p >= q`, with the ordering TRACE `<` DEBUG `<` INFO `<` WARN `<` ERROR. The effective
level is the first non-null level walking up the dotted logger-name hierarchy from the logger
itself to root, which always has one assigned. Nothing is registered in advance — the hierarchy
is implied entirely by the names, which is why the logger name and the configuration key must
agree.

**★ Why do log groups exist when you can already set a level per package?**
Because a real investigation follows a *path*, not a package. Diagnosing a payment failure needs
your payment code, the payment client library and Spring's HTTP client turned up together — three
or four unrelated package prefixes. A group names that set once, so under pressure it is a single
change, and Boot's `loggers` actuator endpoint accepts a group name directly, which makes it a
one-call operation during an incident rather than four.

**★ Someone proposes logging everything at INFO and filtering in the aggregator. Argue against
it.**
Three counts. Cost: ingestion is billed on emitted volume, so filtering downstream saves nothing
where the money is. Information: the level is the author's own judgement about who should act, and
a downstream filter has to re-derive that from message text it does not understand. Operability:
the value of DEBUG being off is that you can turn it on for one logger for ten minutes during an
incident — if everything is already INFO there is no knob left, and you have traded a precise
diagnostic tool for a permanent bill.

**★ What is the difference between Logback's default root level and Spring Boot's, and when does
it bite?**
Logback's root logger defaults to DEBUG; Spring Boot configures INFO. It bites when someone adds a
hand-written `logback.xml` — perhaps to add one appender — without a `<root level>` element and
without including Boot's `defaults.xml`. Boot's property-based configuration is bypassed, the root
falls back to Logback's DEBUG, and every framework in the application starts narrating. The
symptom is an enormous jump in log volume immediately after a change that looked purely additive.

**★ SLF4J has no FATAL level. Is that a limitation?**
Not in practice. The SLF4J FAQ's position is that Markers make FATAL redundant: you log at ERROR
and attach a marker, then route on the marker in the backend. That is strictly more flexible than
a sixth level, because you can define as many markers as you have escalation paths — a "PAGE"
marker, an "AUDIT" marker — and filter on each independently, rather than trying to encode all
escalation semantics into a single ordered scale.

{/* FOOTER */}
