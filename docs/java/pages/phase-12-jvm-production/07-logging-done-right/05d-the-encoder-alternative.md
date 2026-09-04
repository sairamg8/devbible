---
title: "logstash-logback-encoder is still the right answer for the cases Boot's built-in structured logging deliberately does not cover — masking, disruptor-based async, per-event custom fields — and choosing it means taking on a second Jackson dependency and a second async model on purpose"
sidebar_label: "05d · The encoder alternative"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **logstash-logback-encoder 9.0 README**, source of the version
> requirements, ring-buffer behaviour and masking configuration quoted below
> ([github.com/logfellow](https://github.com/logfellow/logstash-logback-encoder/blob/logstash-logback-encoder-9.0/README.md)),
> its **published 9.0 pom** (`tools.jackson.core:jackson-databind` 3.0.1, `logback-classic` 1.5.20)
> ([repo1.maven.org](https://repo1.maven.org/maven2/net/logstash/logback/logstash-logback-encoder/9.0/logstash-logback-encoder-9.0.pom)),
> the **`spring-boot-dependencies:4.1.1` pom** for the Jackson 2 / Jackson 3 split
> ([repo1.maven.org](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom)),
> and the **Spring Boot 4.1 reference, "Structured Logging"**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)).
> 🔴 **No sandbox.** No throughput, latency or drop figures on this page are measurements; the
> behaviour described is quoted from the projects' own documentation.
> JDK 25 · Spring Boot 4.1.1 · Logback 1.5.34 · logstash-logback-encoder 9.0.

**Before Spring Boot 3.4 there was no built-in JSON logging, so "add logstash-logback-encoder" was
the answer to every structured-logging question and the habit stuck. In Boot 4.1 the built-in
support handles the common case with two properties and no dependency
([05b](05b-wiring-json-in-spring-boot.md)), which means the encoder is now a considered choice.
This chunk is what it still does better, and what it costs.**

## What the encoder has that Boot's built-in support does not

**1 · Masking.** `MaskingJsonGeneratorDecorator` masks by JSON *path* and by *value*, at
serialisation time, for everything including nested structures:

```xml
<encoder class="net.logstash.logback.encoder.LogstashEncoder">
  <decorator class="net.logstash.logback.mask.MaskingJsonGeneratorDecorator">
    <defaultMask>****</defaultMask>
    <path>singleFieldName</path>
    <path>/absolute/path/to/mask</path>
    <path>partial/path/with/*/wildcard</path>
    <pathMask>
      <paths>anotherFieldName,anotherFieldName2</paths>
      <mask>**anotherCustomMask**</mask>
    </pathMask>
  </decorator>
</encoder>
```

This is the single strongest reason to reach for the library — [08b](08b-masking-and-the-audit-trail.md)
argues where a mechanism like this belongs in a redaction strategy and where it does not.

**2 · A different async model.** The `*AsyncDisruptorAppender` family, per the README:

> *"The `*AsyncDisruptorAppender` appenders are similar to logback's `AsyncAppender`, except that a
> LMAX Disruptor RingBuffer is used as the queuing mechanism, as opposed to a `BlockingQueue`."*

with a fixed `ringBufferSize` defaulting to **8192**, and an explicit choice about what happens when
it fills:

> *"The async appenders will by default never block the logging thread. If the RingBuffer is full
> (e.g. due to slow network, etc), then events will be dropped."*

controlled by `appendTimeout`: negative *"disable timeout and wait until space is available"*, `0`
*"no timeout, give up immediately and drop event (this is the default)"*, positive *"retry during
the specified amount of time"*. Dropped events are reported: a status message every
`droppedWarnFrequency` consecutive drops (default 1000, `0` disables), plus one when the drop period
ends reporting the total.

🔴 **Contrast that with Logback's `AsyncAppender`, which by default drops TRACE/DEBUG/INFO at 80%
full and blocks on a full queue** ([10b](10b-async-appender.md)). The two libraries make opposite
default choices — one never blocks and drops, the other blocks rather than lose a WARN. Neither is
wrong; running both without knowing which is which is.

**3 · Per-event custom fields and structured arguments.** `StructuredArguments` and `Markers` let a
single statement contribute arbitrary nested JSON, which the SLF4J key-value API cannot express —
its values are scalars.

**4 · Network appenders with real semantics.** TCP and UDP appenders with keep-alive, multiple
destinations, reconnection delay, connection and write timeouts, and SSL. If you genuinely must
ship from the JVM rather than from the platform, this is a far better implementation than Logback's
own socket appender — though [10](10-appenders-and-async.md) argues you usually should not.

**5 · Deep stack-trace control.** Truncate after a regex, exclude frames by regex, omit throwable
messages, maximum depth per throwable, maximum trace size in bytes, class-name shortening, root
cause first, stack hashes. Boot's `logging.structured.json.stacktrace.*` covers the common subset;
this covers the rest.

## What it costs

**A Jackson dependency, and a specific one.** The 9.0 pom depends on
`tools.jackson.core:jackson-databind` **3.0.1** — Jackson 3. The README is explicit:

> *"Support for jackson versions prior to 3.0.0 was removed in logstash-logback-encoder 9.0."*

⚠️ **That version alignment is load-bearing on Boot 4.** Boot 4.1.0 manages **both** Jackson lines —
`jackson-bom.version` 3.1.4 (`tools.jackson`) and `jackson-2-bom.version` 2.21.4
(`com.fasterxml.jackson`, shipped in deprecated form) — so an *older* encoder (8.x, which depends on
`com.fasterxml.jackson.core`) drags the deprecated line into your runtime image for logging alone.
Encoder 9.0 on Boot 4.1 is aligned; encoder 8.x on Boot 4.1 is a second serialisation stack.

**A minimum Java version.** The README's table: 9.x requires **Java 17**, 8.x requires 11. Not a
constraint on JDK 25, but it is a constraint if a build target lags.

**A version you own.** The encoder is not in Boot's managed dependencies, so its version, its
Logback floor (*"logback-core >= 1.5.0"*, *"logback-classic >= 1.5.0"*) and its security cadence are
yours. The README warns about exactly this:

> *"If you are using logstash-logback-encoder in a project (such as spring-boot) that also declares
> dependencies on any of the above libraries, you might need to tell maven explicitly which versions
> to use to avoid conflict"*

**XML you have to maintain.** The encoder is configured in `logback-spring.xml`, so you leave
Boot's property-driven configuration and take on a file that must be kept in step with Boot's own
defaults across upgrades.

**A second async model in the same process.** If any part of your configuration also uses Logback's
`AsyncAppender`, you now have two queues with opposite full-queue policies and different shutdown
semantics, which is a genuinely confusing thing to debug under load.

## Wiring it, if you choose it

```xml
<configuration>
  <include resource="org/springframework/boot/logging/logback/defaults.xml"/>

  <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
    <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
  </appender>

  <springProfile name="!local">
    <root level="INFO"><appender-ref ref="JSON"/></root>
  </springProfile>
  <springProfile name="local">
    <include resource="org/springframework/boot/logging/logback/console-appender.xml"/>
    <root level="INFO"><appender-ref ref="CONSOLE"/></root>
  </springProfile>
</configuration>
```

⚠️ **Logback 1.3 and later forbid nesting an `<appender>` inside another `<appender>`** — the
encoder's README flags this, referencing LOGBACK-1674. Nested appender declarations that worked
years ago must be hoisted out and referenced by `<appender-ref>`. This is the most common failure
when copying an old configuration into a current application.

## The decision

**Use Boot's built-in structured logging when** you want ECS, GELF or Logstash JSON, per-event
context from MDC and key-value pairs, and reasonable stack-trace control — which is most services.
Zero dependencies, two properties, and it upgrades with Boot.

**Use logstash-logback-encoder when** you need serialisation-time masking, a never-block async
model with reporting, nested per-event JSON structures, or its stack-trace filtering. Take it
deliberately, pin 9.x on Boot 4, and write down why in the XML.

🔴 **Do not run both.** Two JSON producers in one process means two schemas, and the format your
collector sees depends on which appender the event reached. If you migrate, migrate fully and
delete the loser.

## Gotchas

**★ Adding the encoder out of habit now costs a dependency Boot does not need.**
Boot 4.1 ships ECS, GELF and Logstash formats with no extra artifact. "How do we get JSON logs" no
longer has "add an encoder" as its default answer.

**★ Encoder 8.x on Boot 4 pulls in the deprecated Jackson 2 line.**
8.x depends on `com.fasterxml.jackson.core`; 9.0 moved to `tools.jackson.core` 3.x. Boot 4.1
manages both, so the mismatch does not fail — it just quietly adds a second serialisation stack for
logging.

**★ Its async appender drops by default; Logback's blocks by default.**
`appendTimeout` defaults to `0`, described as *"give up immediately and drop event"*. Logback's
`AsyncAppender` blocks on a full queue instead. Opposite defaults, same problem space — know which
one is in front of your file appender.

**★ Dropped events are only visible in Logback's status messages.**
The encoder emits a status warning every `droppedWarnFrequency` drops (1000 by default). If nothing
surfaces Logback's status output, silent loss is exactly that.

**★ Nesting `<appender>` inside `<appender>` stopped working in Logback 1.3.**
Old configurations copied forward fail to configure. The nested appender must be declared at top
level and referenced with `<appender-ref>`.

**★ The encoder's version is yours to manage.**
It is not in Boot's managed dependencies, so version conflicts with Boot's Logback and Jackson are
resolved by Maven's rules rather than by a BOM — and the README explicitly tells you that you may
have to pin versions by hand.

**★ Choosing the encoder means leaving property-based logging configuration.**
`logging.structured.*` no longer drives anything; the XML does. That file must then be maintained
across Boot upgrades, including keeping `defaults.xml` included so Boot's conversion words and
system properties still resolve.

**★ Running the encoder and Boot's structured logging simultaneously produces two schemas.**
Each appender emits its own shape. Downstream, whether an event is ECS or Logstash JSON depends on
which appender handled it, which is not a property anyone wants to reason about.

## Interview questions

**★ Spring Boot has built-in structured logging. When is logstash-logback-encoder still the right
call?**
When you need something the built-in support deliberately does not do: masking at serialisation
time by JSON path or value, a disruptor-backed async appender that never blocks the application
thread and reports its drops, arbitrary nested per-event JSON rather than scalar key-value pairs,
or fine-grained stack-trace filtering such as truncate-after-regex and exclude-frames-by-regex. For
"emit ECS to stdout with MDC context", the built-in support is two properties and no dependency,
and it upgrades with Boot.

**★ What does adding logstash-logback-encoder to a Boot 4 application actually pull in?**
Version 9.0 depends on Jackson 3 — `tools.jackson.core:jackson-databind` — and requires Java 17 and
Logback 1.5 or later. That aligns with Boot 4, which manages Jackson 3 as its primary line. Version
8.x depends on Jackson 2, which Boot 4 still manages but in deprecated form, so an 8.x encoder adds
a second serialisation stack to the runtime image purely for logging. Either way the encoder's own
version is not managed by Boot's BOM, so conflicts with Boot's Logback are resolved by Maven's
mediation rules rather than by a curated set.

**★ How do the two async appenders differ in their default behaviour under pressure?**
Opposite defaults. Logback's `AsyncAppender` uses a `BlockingQueue`, discards TRACE/DEBUG/INFO once
the queue is 80% full, and *blocks* the application thread when it is completely full. The
encoder's `AsyncDisruptorAppender` uses a fixed ring buffer of 8192 and, with the default
`appendTimeout` of zero, never blocks — it drops the event immediately and emits a status warning
every thousand drops. So one trades latency for completeness and the other trades completeness for
latency, and having both in one configuration is a good way to be surprised.

**★ Why can't you just run both the encoder and Boot's structured logging?**
Because each appender applies its own encoder, so the format of an event depends on which appender
handled it. Downstream you would need a collector that accepts two schemas from one service and
some way to tell them apart — and every dashboard and query would have to handle both field sets.
If you migrate between them, migrate fully and delete the other configuration; a half-migrated
state is worse than either end state.

**★ You copy an old `logback.xml` into a current application and logging silently misconfigures.
What is the most likely cause?**
An `<appender>` declared inside another `<appender>`. Logback 1.3 removed support for that
nesting — the encoder's own README calls it out — and the nested appender must be hoisted to top
level and referenced by `<appender-ref>`. Older configurations built around wrapping a file appender
in an async appender inline are exactly the ones that break, and the failure is at configuration
time rather than at the first log statement.

**★ What is the strongest single argument for the encoder over the built-in support?**
Masking. `MaskingJsonGeneratorDecorator` operates at serialisation time on paths and values, which
means it catches sensitive data regardless of which statement produced it or how deeply nested it
sits — a property no call-site discipline can offer. That is a genuinely different capability, not
a convenience, and it is the reason a regulated environment might take the dependency even when
everything else about the built-in support fits.

{/* FOOTER */}
