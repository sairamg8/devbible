---
title: "Spring Boot ships structured logging as two properties and three formats with no extra dependency and no Jackson involved, which makes the encoder libraries people reach for by habit an explicit choice rather than the default one"
sidebar_label: "05b · Wiring JSON in Spring Boot"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1 reference, "Structured Logging"**, for every
> property name and format id below
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)), the
> **Spring Boot how-to, "Logging"**, for the provided Logback include files
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/logging.html)), the Boot 4.1.0
> javadoc for `StructuredLogFormatter` and `StructuredLoggingJsonMembersCustomizer`
> ([docs.spring.io](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/logging/structured/StructuredLogFormatter.html)),
> and the Boot 4.1.0 sources for `defaults.xml`, `structured-console-appender.xml` and
> `StructuredLogFormatterFactory`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/v4.1.0)).
> 🔴 **No sandbox.** No output on this page is captured; field lists are read from source.
> JDK 25 · Spring Boot 4.1.1 · SLF4J 2.0.18 · Logback 1.5.34.

**Structured logging in Boot is one property per destination. There is no encoder dependency to
add, no `logback-spring.xml` to write, and — unlike every third-party JSON encoder — no Jackson on
the path: Boot serialises through its own `org.springframework.boot.json.JsonWriter`. Knowing that
changes the default answer to "how do we get JSON logs" from "add logstash-logback-encoder" to "set
one property", and makes the encoder a decision you justify rather than assume.**

## The two properties

```properties
logging.structured.format.console=ecs
logging.structured.format.file=ecs
```

They are independent, which is the whole ergonomics of the feature: a container writes JSON to
stdout while a local developer keeps the pattern layout, decided per profile.

**Three built-in format ids**, per the reference:

| Id | Format |
|---|---|
| `ecs` | Elastic Common Schema |
| `gelf` | Graylog Extended Log Format |
| `logstash` | Logstash JSON |

The corresponding system properties, which is how they reach a hand-written Logback configuration,
are `CONSOLE_LOG_STRUCTURED_FORMAT` and `FILE_LOG_STRUCTURED_FORMAT`.

## Identifying the service

ECS and GELF each take service metadata, with defaults that mean you usually set nothing:

```properties
logging.structured.ecs.service.name=MyService
logging.structured.ecs.service.version=1.0
logging.structured.ecs.service.environment=Production
logging.structured.ecs.service.node-name=Primary
```

> *"`logging.structured.ecs.service.name` defaults to `spring.application.name`"* and
> *"`logging.structured.ecs.service.version` defaults to `spring.application.version`"*.

GELF is the same shape with `logging.structured.gelf.host` (defaulting to
`spring.application.name`) and `logging.structured.gelf.service.version`.

🔴 **Set `spring.application.name` and you have named your service in every log line, every metric
and every trace at once.** It is the single highest-leverage property in an observability setup and
it is routinely left unset.

## Reshaping the JSON without writing a formatter

Boot exposes three operations on the emitted object, and between them they cover most schema
disagreements with a downstream system:

```properties
logging.structured.json.exclude=log.level
logging.structured.json.rename.process.id=procid
logging.structured.json.add.corpname=mycorp
```

**`exclude`** drops a member. **`rename`** changes a key without changing the producer.
**`add`** injects a constant — a deployment id, a region, a cost centre.

⚠️ **`add` takes constants, not expressions.** Anything that varies per event belongs in MDC
([06](06-mdc.md)) or in a key-value pair ([04b](04b-the-fluent-api.md)), not here.

## Stack traces get their own property block

This is the part of the feature people miss, and it is where the cost of exceptions in JSON is
actually controlled:

```properties
logging.structured.json.stacktrace.root=first
logging.structured.json.stacktrace.max-length=1024
logging.structured.json.stacktrace.max-throwable-depth=
logging.structured.json.stacktrace.include-common-frames=true
logging.structured.json.stacktrace.include-hashes=true
logging.structured.json.stacktrace.printer=
```

- **`root=first`** prints the root cause first rather than Java's outermost-first order — which is
  usually what you want, because the root cause is what you are looking for.
- **`max-length`** truncates. A deep reactive or proxy-heavy stack can be enormous, and this is the
  one knob that bounds it ([09b](09b-stack-traces-that-cost-you.md)).
- **`include-common-frames`** controls whether repeated frames in a cause chain are re-printed.
- **`printer`** takes `logging-system` or a custom `StackTracePrinter` implementation.

🔴 **These apply to structured output only.** The pattern-layout equivalent is
`logging.exception-conversion-word` plus Logback's `%ex{depth}` — a different mechanism with
different syntax, which is a real source of "we configured that and nothing changed".

## Boot does not use Jackson for this

`StructuredLogFormatter` implementations are built on `org.springframework.boot.json.JsonWriter`.
That has three consequences worth knowing:

1. **No Jackson dependency is required** to emit JSON logs. Log output does not go through the same
   serialisation stack as your HTTP responses, so a Jackson module, a mixin or a custom serialiser
   configured for your API has **no effect** on log output.
2. **It sidesteps the Jackson 2/3 split.** Boot 4 moves to Jackson 3 (`tools.jackson`) while
   managing Jackson 2 (`com.fasterxml.jackson`) in deprecated form — a genuine migration hazard for
   anything that serialises, and one the logging path simply does not have.
3. **No object mapping.** You cannot hand it a POJO and have it serialised into the event. Fields
   are strings and primitives via MDC and key-value pairs. If you want an object in the log, you
   serialise it yourself and pass the result — which is a constraint worth respecting rather than
   working around.

## Custom fields for every event: the customizer

For a field on every line that is not a constant and not per-request, the extension point is
`StructuredLoggingJsonMembersCustomizer`. Its javadoc:

> *"Customizer that can be injected into `StructuredLogFormatter` implementations to customize
> `JsonWriter` `JsonWriter.Members`."*

and on registration:

> *"An implementation may be provided using the `logging.structured.json.customizer` property.
> Alternatively, implementations can be registered in `META-INF/spring.factories` under the key
> `org.springframework.boot.logging.structured.StructuredLoggingJsonMembersCustomizer`."*

⚠️ **`spring.factories`, not a `@Bean`.** Logging is initialised before the application context
exists, so the customizer cannot be a Spring bean and cannot be injected with one. That is a
recurring shape in this feature and the source of most "why is my bean null" confusion.

## A whole custom format

`StructuredLogFormatterFactory`'s javadoc says it creates a formatter *"for either a
`CommonStructuredLogFormat#getId() common format` or a fully-qualified class name"* — so
`logging.structured.format.console` accepts your own class:

```properties
logging.structured.format.console=com.example.logging.OurHouseFormat
```

The interface is minimal:

```java
public class OurHouseFormat implements StructuredLogFormatter<ILoggingEvent> {
    @Override public String format(ILoggingEvent event) { /* ... */ }
}
```

and the javadoc enumerates exactly what the constructor may ask for:

> *"Implementing classes can declare the following parameter types in the constructor: `Environment`,
> `StructuredLoggingJsonMembersCustomizer`, `StructuredLoggingJsonMembersCustomizer.Builder`,
> `StackTracePrinter` (may be `null`), `ContextPairs`"* — and, under Logback, also
> `ch.qos.logback.classic.pattern.ThrowableProxyConverter`.

🔴 **The failure handling is worth knowing before you debug it.** `StructuredLogFormatterFactory`
treats a `ClassNotFoundException` during instantiation as a soft failure and rethrows anything else
as `IllegalArgumentException`. A typo in the class name therefore does not behave the same way as a
constructor that throws.

## Hand-written Logback configuration

If you already have a `logback-spring.xml`, Boot ships includes that wire the same thing:

```xml
<configuration>
  <include resource="org/springframework/boot/logging/logback/defaults.xml"/>
  <include resource="org/springframework/boot/logging/logback/structured-console-appender.xml"/>
  <root level="INFO">
    <appender-ref ref="CONSOLE"/>
  </root>
</configuration>
```

`structured-console-appender.xml` is a `ConsoleAppender` with a `ThresholdFilter` on
`CONSOLE_LOG_THRESHOLD` and Boot's `StructuredLogEncoder` reading `CONSOLE_LOG_STRUCTURED_FORMAT`.

⚠️ **Including `structured-console-appender.xml` without `defaults.xml` gives you an appender whose
format property is undefined**, and the `<root>` element is yours to supply — omit it and you
inherit Logback's DEBUG root ([03](03-levels.md)).

## Gotchas

**★ `logging.structured.format.console` and `.file` are separate and neither implies the other.**
Setting only the console property leaves a configured file appender emitting the pattern layout —
two formats from one process, which the collector will not be expecting.

**★ Boot's structured logging does not use Jackson, so your Jackson configuration does nothing to
it.**
Custom serialisers, mixins and modules configured for your API do not affect log output; Boot uses
its own `JsonWriter`. The upside is that logging is immune to the Boot 4 Jackson 2/3 split.

**★ `logging.structured.json.add.*` takes constants only.**
It is for deployment id, region, cost centre. Anything varying per event has to come from MDC or a
key-value pair; there is no expression support here.

**★ The stack-trace properties apply only to structured output.**
Configuring `logging.structured.json.stacktrace.*` and then wondering why the console pattern is
unchanged is the common version of this. The pattern layout uses
`logging.exception-conversion-word` and Logback's `%ex` options instead.

**★ A `StructuredLoggingJsonMembersCustomizer` cannot be a Spring bean.**
Logging initialises before the context, so it is registered via `spring.factories` or the
`logging.structured.json.customizer` property, and it cannot have Spring dependencies injected. The
same constraint applies to a custom `StructuredLogFormatter`.

**★ `rename` moves a key without telling anyone downstream.**
It is exactly the right tool for matching a mandated schema and exactly the wrong tool for a quiet
local preference — every saved query, dashboard and alert keyed on the old name breaks silently
([05c](05c-schema-and-field-naming.md)).

**★ A custom formatter class name that does not resolve is treated differently from one that
throws.**
`StructuredLogFormatterFactory` swallows `ClassNotFoundException` as a soft failure and rethrows
other failures as `IllegalArgumentException`. A typo and a broken constructor produce different
symptoms.

**★ Including Boot's structured appender file without `defaults.xml` leaves the format property
unset.**
The appender exists, the encoder has no format, and the result is not what you configured. The
includes are designed to be used together.

**★ ECS pins `ecs.version` to a value the formatter hard-codes.**
Boot 4.1.0's ECS formatter writes `"8.11"`. If your Elasticsearch pipeline validates against a
different ECS version, that is a conversation with the pipeline, not a property you can set.

## Interview questions

**★ What is the minimum change to get JSON logs out of a Spring Boot 4.1 service?**
One property per destination: `logging.structured.format.console=ecs`, and
`logging.structured.format.file=ecs` if you also write a file. No dependency, no XML, no encoder.
Setting `spring.application.name` as well is worth doing in the same change, because ECS and GELF
default their service name to it, and the same property names the service in metrics and traces.

**★ Does Boot use Jackson to write structured logs?**
No — it uses `org.springframework.boot.json.JsonWriter`. Two practical consequences: your Jackson
configuration, including custom serialisers and mixins, has no effect on log output; and logging is
untouched by Boot 4's Jackson 2 to Jackson 3 migration, which is a real hazard elsewhere in the
application. The trade-off is that there is no object mapping — you cannot hand it a POJO and have
it serialised into the event.

**★ You need a `deployment_id` field on every log line. How do you add it?**
If it is fixed for the life of the process, `logging.structured.json.add.deployment_id=...`, which
takes a constant. If it varies per request, it belongs in MDC and Boot's formatters emit the MDC
map automatically. If it needs computing at formatter-construction time, implement
`StructuredLoggingJsonMembersCustomizer` and register it via `spring.factories` or the
`logging.structured.json.customizer` property — not as a `@Bean`, because logging initialises
before the application context exists.

**★ Why can't a structured-logging customizer be a Spring bean?**
Because the logging system is initialised very early — before the `ApplicationContext` is
available — so there is nothing to inject and nothing to look the bean up from. Boot therefore uses
`SpringFactoriesLoader` and a property, and the constructor parameters a formatter may declare are
an explicit, documented list: `Environment`, the customizer and its builder, a `StackTracePrinter`
that may be null, `ContextPairs`, and under Logback a `ThrowableProxyConverter`. Anything outside
that list is not available to you.

**★ Your structured stack traces are enormous. What are the knobs?**
`logging.structured.json.stacktrace.max-length` truncates, `max-throwable-depth` limits the cause
chain, `include-common-frames=false` stops re-printing frames repeated between a cause and its
wrapper, and `root=first` puts the root cause at the top so a truncated trace still contains the
useful part. All of these apply to structured output only — the pattern layout is configured
separately through `logging.exception-conversion-word` and Logback's `%ex` options.

**★ When would you write a custom `StructuredLogFormatter` instead of customising ECS?**
When the target schema is not a reshaping of ECS but a genuinely different document — a
company-mandated envelope, a format a legacy pipeline requires, or an output that is not JSON at
all, since the interface returns a `String`. If the requirement is "ECS but rename two fields, drop
one and add a constant", the `exclude`/`rename`/`add` properties already do it with no code and no
class to maintain across Boot upgrades.

{/* FOOTER */}
