---
title: "The field names in your log events are a public API with more consumers than your HTTP endpoints, and unlike an HTTP endpoint there is no version negotiation, no deprecation window and no compiler — so renaming a field is a breaking change that fails silently in someone else's dashboard"
sidebar_label: "05c · Schema and field naming"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Elastic Common Schema guidelines**, source of the naming rules
> quoted below
> ([elastic.co](https://www.elastic.co/guide/en/ecs/current/ecs-guidelines.html)), the
> **OpenTelemetry logs data model**
> ([opentelemetry.io](https://opentelemetry.io/docs/specs/otel/logs/data-model/)), the **Spring
> Boot 4.1 reference, "Structured Logging"**, for `logging.structured.json.rename`/`exclude`/`add`
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)), the
> **Spring Boot 4.1 configuration-properties appendix** for `logging.structured.json.context.*`
> ([docs.spring.io](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> and the **Spring Boot 4.1.1 source** for `ElasticCommonSchemaStructuredLogFormatter`, which flattens MDC
> entries and key-value pairs into one region
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot/src/main/java/org/springframework/boot/logging/logback/ElasticCommonSchemaStructuredLogFormatter.java)).
> 🔴 **No sandbox.** JDK 25 · Spring Boot 4.1.1 · Logback 1.5.34.

**Once logs are structured, the field names become a contract. Dashboards, saved searches, alert
rules, index mappings and retention policies all key on them, and every one of those consumers
lives outside your repository. A rename does not fail the build, does not fail a test, and does not
fail at runtime — it produces a dashboard that draws an empty graph and an alert that never fires.
Choosing the names once, from an existing convention, is much cheaper than choosing them twice.**

## Adopt a convention rather than inventing one

Two exist, they are both fine, and the value is almost entirely in *having* one.

**Elastic Common Schema (ECS)** is what Boot's `ecs` format emits. Its naming guidelines, verbatim:

> *"Field names must be lower case"* · *"Combine words using underscore"* · *"No special characters
> except underscore"* · *"Nest fields inside a field set with dots"* · *"Use singular and plural
> names properly to reflect the field content"* · *"Avoid repetition or stuttering of words. If
> part of the field name is already in the name of the field set, avoid repeating it. Example:
> `host.host_ip` should be `host.ip`."*

**OpenTelemetry's log data model** defines a `LogRecord` with `Timestamp`, `ObservedTimestamp`,
`TraceId`, `SpanId`, `TraceFlags`, `SeverityText`, `SeverityNumber`, `Body`, `Resource`,
`InstrumentationScope`, `Attributes` and `EventName`. Its split between `Resource` and `Attributes`
is the useful idea to steal even if you never emit OTLP:

> *"Additional information about the specific event occurrence. Unlike the `Resource` field, which
> is fixed for a particular source, `Attributes` can vary for each occurrence of the event coming
> from the same source."*

🔴 **That is exactly Boot's `logging.structured.json.add.*` versus MDC.** Fixed-for-the-process
values are resource-shaped and belong in `add`; per-event values are attribute-shaped and belong in
MDC or key-value pairs ([05b](05b-wiring-json-in-spring-boot.md)). Getting that split right is more
valuable than which of the two vocabularies you pick.

**Also worth stealing from OTel: `SeverityNumber`.** It normalises levels to numeric ranges — TRACE
1–4, DEBUG 5–8, INFO 9–12, WARN 13–16, ERROR 17–20, FATAL 21–24 — so "at least WARN" is a numeric
comparison rather than a set membership test against strings whose spelling varies by producer.

## Namespace your own fields, because the namespace is shared

Boot's ECS formatter flattens **MDC entries and SLF4J key-value pairs into the same region of the
object**. That means:

- Your MDC key `traceId` and a key-value pair named `traceId` collide.
- Your field named `message` or `tags` collides with an ECS member.
- A library that writes to MDC — and several do — occupies the same namespace as you.

The remedy is a prefix, and Boot has one built in:

```properties
logging.structured.json.context.prefix=app
```

Boot's configuration-properties appendix documents both members of that pair:
**`logging.structured.json.context.prefix`** — *"The prefix to use when inserting context data"* —
and **`logging.structured.json.context.include`** — *"Whether context data should be included in
the JSON"*. The second is the escape hatch when a downstream schema forbids unknown members
outright. Boot 4.1.0's `StructuredLogFormatterFactory` defaults them to include-everything with no
prefix, so the prefix is opt-in.

Even without the built-in mechanism, prefixing at the source costs nothing:

```java
MDC.put("app.tenantId", tenantId);
log.atInfo().addKeyValue("app.orderId", orderId).log();
```

## Types are part of the name

A structured log field's type is decided by the first document the index sees, and after that it is
enforced. Two rules follow.

**1 · Never send the same field name with two types.** `durationMs` as a number in one statement
and `"1.5s"` in another means one of them is rejected or silently reinterpreted. In Elasticsearch
the second document is dropped with a mapping conflict — **the event disappears entirely**, which is
the worst possible failure for a log.

**2 · Encode the unit in the name.** `duration` is ambiguous forever. `durationMs` is not.
`amount` is a bug waiting for a currency; `amountMinor` plus `currency` is not. This is free at
write time and impossible to fix later.

```java
// Bad: units and type both implicit.
.addKeyValue("duration", elapsed)          // a Duration? a String? seconds?
.addKeyValue("amount", order.total())      // BigDecimal? which currency?

// Good: type stable, unit explicit.
.addKeyValue("durationMs", elapsed.toMillis())
.addKeyValue("amountMinor", order.totalMinorUnits())
.addKeyValue("currency", order.currencyCode())
```

## Field explosion is a real outage, not a tidiness concern

Every distinct field name in an Elasticsearch-style index creates a mapping entry, and mappings
are per-index, cluster-state-resident and capped. Code that generates field *names* from data —
rather than putting the data in a value — grows the mapping without bound:

```java
// Every distinct customer creates a new field. The mapping grows forever.
log.atInfo().addKeyValue("customer_" + customerId + "_status", status).log();

// One field, unbounded values. Values are cheap; names are not.
log.atInfo().addKeyValue("customerId", customerId).addKeyValue("status", status).log();
```

🔴 **This is the log-side twin of metric cardinality explosion**, and it is worse, because a metrics
backend usually degrades while an index that hits its field limit starts *rejecting documents*.
**08 · Metrics with Micrometer** *(not written yet)* owns the metric side.

## Renaming: the operation with no safe version

Boot makes renaming trivially easy, which is the problem:

```properties
logging.structured.json.rename.process.id=procid
```

**Nothing downstream is told.** Every saved query, dashboard panel, alert rule and index template
keyed on the old name keeps working syntactically and returns nothing. An alert that never fires
looks exactly like a healthy system.

**If you must rename, the only safe procedure is dual-emit:**

1. Emit **both** names for a period longer than your longest dashboard-review cycle — a customizer
   or an `add` entry can duplicate the value.
2. Find and migrate consumers. The producer cannot enumerate them, so this step is social, not
   technical.
3. Remove the old name, in its own change, so a revert is one commit.

⚠️ **Budget for step 2 taking weeks.** The consumers you know about are the ones in version control;
the ones that matter are the saved searches in someone's browser.

## A minimum house schema

A short list that costs nothing to standardise on day one and is expensive to retrofit:

| Field | Why |
|---|---|
| `service.name`, `service.version`, `service.environment` | From `spring.application.name` etc. Identifies the emitter without parsing a pod name |
| `traceId`, `spanId` | Joins logs to traces; Boot populates the MDC when tracing is on ([07](07-correlation-ids.md)) |
| `event.action` or equivalent | The stable name of *what happened*, independent of message wording |
| `outcome` | `success` / `failure` — the single most queried dimension in practice |
| `durationMs` | Numeric, unit in the name |
| `error.type` | The exception class; ECS's formatter already emits this |

🔴 **`event.action` plus `outcome` is the pair that repays itself fastest.** It makes "how often does
this operation fail" answerable without matching on message text, which means the message stays
free to be reworded for humans.

## Gotchas

**★ MDC keys and key-value pair keys share one namespace in Boot's structured output.**
The ECS formatter flattens both into the same region of the object. A key-value pair and an MDC
entry with the same name collide, and so does either with a top-level ECS member such as `message`
or `tags`.

**★ Libraries write to MDC too.**
You do not own the MDC namespace. Prefixing your own keys is the only way to be sure a dependency's
addition does not shadow yours — or vice versa, which is worse because it corrupts *their*
diagnostics.

**★ Sending one field name with two types drops events.**
An index maps a field on first sight. A later document with an incompatible type for that field is
rejected — the whole event vanishes, not just the field. This is the most damaging schema bug
available and it has no local symptom.

**★ Units left out of names cannot be added later.**
`duration` becomes `durationMs` only by a rename, which is the operation with no safe version. Put
the unit in on the first day.

**★ Generating field *names* from data explodes the index mapping.**
Names are expensive and bounded; values are cheap and unbounded. `customer_1234_status` as a field
name is the log-side equivalent of an unbounded metric tag, and the failure mode is document
rejection.

**★ `logging.structured.json.rename` breaks consumers silently.**
Queries keyed on the old name stay syntactically valid and return nothing, so a broken alert is
indistinguishable from a healthy system. Dual-emit for longer than your dashboard-review cycle.

**★ Level as a free-text string makes "at least WARN" awkward.**
Different producers spell it `WARN`, `WARNING`, `warn`. OTel's `SeverityNumber` ranges exist for
exactly this and are worth emitting alongside the text even in a non-OTel pipeline.

**★ Inventing a house schema from scratch costs more than adopting one.**
ECS and OTel both come with published field sets, tooling and downstream support. A bespoke schema
means every integration is bespoke too, and the naming arguments get relitigated per team.

**★ "Fixed for the process" and "varies per event" are different kinds of field.**
OTel separates `Resource` from `Attributes` for a reason. Putting a per-request value into
`logging.structured.json.add` is impossible (it takes constants) and putting a constant into MDC
means paying to carry it on every thread for no reason.

## Interview questions

**★ Why is a log field name harder to change than a REST field name?**
Because the consumers are invisible and unversioned. A REST client is a piece of code you can find,
a schema you can version, and a call that fails loudly when the contract breaks. A log field's
consumers are dashboards, saved searches, alert rules and index templates spread across tools and
people; a rename leaves every one of them syntactically valid and semantically empty. Nothing
fails — the graph is just flat and the alert just never fires, which is indistinguishable from
good news.

**★ How do you avoid collisions between your fields and the framework's?**
Prefix your own. Boot's ECS formatter flattens MDC entries and SLF4J key-value pairs into the same
region of the object as ECS's own members, so `message`, `tags` and any library's MDC key are all
in your namespace. Boot exposes a context prefix for contextual pairs, and failing that, prefixing
at the call site — `app.orderId` rather than `orderId` — costs nothing and is unambiguous.

**★ What is field explosion and why is it worse than metric cardinality explosion?**
Field explosion is generating field *names* from data — `customer_1234_status` — so the index
mapping grows with your data rather than with your code. It is worse than the metric equivalent
because a metrics backend under cardinality pressure usually degrades or drops series, whereas a
search index that hits its field limit starts rejecting whole documents. You lose the events, not
just the dimension. The fix is always the same shape: the varying thing is a value, not a name.

**★ Why does encoding the unit in the field name matter so much?**
Because the alternative is a rename, and renames have no safe version. `duration` is ambiguous
between milliseconds, seconds and a serialised `Duration`, and the ambiguity is only resolved by
reading the producer's source — which the person querying does not have. `durationMs` resolves it
permanently at zero cost, and the same argument gives you `amountMinor` plus `currency` instead of
`amount`.

**★ How would you safely rename a log field that dashboards depend on?**
Dual-emit. Publish both names for longer than your longest dashboard-review cycle so every consumer
has an opportunity to migrate on a working system, then hunt consumers — which is a social task,
because the producer cannot enumerate saved searches in people's browsers — and only then remove
the old name, in its own change so it can be reverted alone. Anything faster is a silent breakage
with a long tail.

**★ What is the value in OTel's split between `Resource` and `Attributes` if you are not using
OTLP?**
It gives you a rule for where a field belongs. `Resource` is fixed for the source — service name,
version, environment, region — and should be attached once at configuration time, which in Boot is
`logging.structured.json.add` or the `service.*` properties. `Attributes` vary per occurrence and
belong in MDC or key-value pairs. Getting that split right means you are not paying to carry
constants on every thread, and not trying to express a per-request value with a property that only
accepts constants.

{/* FOOTER */}
