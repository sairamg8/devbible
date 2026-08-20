---
title: "The alternatives"
sidebar_label: "16 · The alternatives"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the Quarkus guides (*Writing your own
> extension*, *Configuration Reference*, *Spring DI API extension*) and the
> Quarkus release page; the Micronaut user guide (*Inversion of Control*,
> *Bean Introspection*, *AOP*) and the Micronaut Framework 5.0.0 / 5.1.0
> release announcements; the Helidon 4 documentation and project site, and the
> MicroProfile 7.1 release; the GraalVM Native Image reference (*Reachability
> Metadata*, the GDB and JFR guides) and the GraalVM release calendar; and the
> Spring Boot reference *Ahead-of-Time Processing With the JVM*, *Class Data
> Sharing*, *AOT Cache* and *Native Image* sections, plus JEP 483 and JEP 515.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Every framework in this topic solves the same problem as Spring — turning
annotated classes into a running application — and differs on exactly one axis:
*when* that work happens. Spring does it at startup, with classpath scanning,
reflection, dynamic proxies and conditions evaluated against the live
environment. Quarkus and Micronaut do it during compilation, with annotation
processors that emit ordinary bytecode. That single choice explains everything
downstream: startup time, resident memory, why they are native-image friendly,
why a library needs an extension, and why some configuration is frozen into the
artifact. The trade is runtime flexibility for startup and footprint — and the
question that actually decides it is whether your workload cares. This topic is
written so you can answer that, argue it in either direction, and recognise
each option when you meet it, without ever quoting a benchmark you did not
run.**

This topic runs to seven files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The trade](01-the-trade.md)** | The four pieces of runtime work Spring actually does, what build-time DI moves and how, the trade stated precisely — including what flexibility you lose — and the three workload shapes that decide it |
| 2 | **[Quarkus](02-quarkus.md)** | Augmentation / static init / runtime init, build steps and recorders, the extension model and the library that has none, ArC and Jakarta CDI, build-time-fixed configuration, dev mode and Dev Services, and the Spring compatibility layers as a bridge |
| 3 | **[Micronaut](03-micronaut.md)** | Compile-time DI via annotation processors, generated `BeanDefinition`s, `@Introspected` and reflection-free introspection, compile-time AOP proxies, and why rhyming with Spring is both the selling point and the trap |
| 4 | **[Helidon and the rest](04-helidon-and-the-rest.md)** | SE versus MP as genuinely different products, Níma and the virtual-thread bet, MicroProfile mapped onto what you already know — plus Jakarta EE servers, Vert.x, Ktor and Dropwizard in a line each |
| 5 | **[The closed world](05-the-closed-world.md)** | 🔴 What native image forbids, the restrictions Spring adds on top, reachability metadata and the errors it prevents, the tracing agent's structural flaw, and what Spring AOT generates and where |
| 6 | **[What native image costs](06-what-native-image-costs.md)** | 🔴 The honest bill — build minutes, GDB instead of your debugger, agents that cannot instrument, a second CI target, permanent per-dependency risk — and the three cases where it genuinely pays |
| 7 | **[Choosing](07-choosing.md)** | 🔴 Spring's answer — AOT on the JVM, CDS and the JEP 483/515 AOT cache, virtual threads — the decision by workload, the organisational argument, and how to argue it without a benchmark |

## Why this runs to seven files

- **The argument needs both sides established before it can be made.** Chunk 7's
  claim — that the gap is much narrower than the framing suggests and the
  deciding factors are usually organisational — is worthless unless the reader
  already knows exactly what build-time DI buys (chunk 1), what it actually
  looks like in practice (chunks 2 and 3), and what the native-image endpoint
  costs (chunks 5 and 6). Compressed into a comparison table, the conclusion
  would be an assertion instead of a conclusion.
- **Quarkus and Micronaut are only superficially the same choice.** They agree
  on build-time DI and agree on almost nothing else: one is CDI with an
  extension ecosystem and a build-time-frozen configuration model, the other is
  a Spring-shaped API with an annotation processor and a JDK 25 baseline. A
  reader given one merged chunk would learn a slogan, not either framework.
- **Helidon does not belong in that group at all**, which is exactly why it
  needs its own place. Its distinguishing bet is virtual threads, not build-time
  wiring, and it ships as two products that share a name and little else. That
  is a correction to the standard framing, and corrections need room.
- **Native image split because exhausting it exceeded the file cap, not because
  it is two topics.** Chunk 5 is the mechanism — what the closed world forbids
  and what you must declare — and chunk 6 is the bill and the narrow case where
  it is worth paying. The break falls on that boundary because a reader can stop
  after 5 with a complete mental model and still make the decision in 6.
- **Spring's counter-argument is the part every comparison article omits**, and
  it is two genuinely different mechanisms — Spring AOT, which brings
  restrictions, and the JDK's own AOT cache, which brings none. Merging them
  into "Spring got faster too" loses the only practically useful distinction
  in the whole topic.

## Where this connects

- **[Topic 02 — The IoC container](../02-the-ioc-container/README.md)** and
  **[Topic 03 — Dependency injection](../03-dependency-injection/README.md)** —
  the runtime work chunk 1 is accounting for. Scanning, reflective injection and
  proxy generation are the exact costs the alternatives move to build time.
- **[Topic 05 — Auto-configuration](../05-auto-configuration/README.md)** — the
  conditional evaluation that is Spring's greatest strength and the first
  casualty of the closed-world assumption. Chunks 5 and 7 both come back to it.
- **[Topic 01 — Why frameworks: the servlet model](../01-why-frameworks-servlet-model/README.md)**
  — thread-per-request and the virtual-thread update, which is the model Helidon
  4 rebuilt its server around.
- **[Topic 15 — WebFlux and reactive](../15-webflux-reactive/README.md)** — the
  same argument on the concurrency axis. Chunk 4 and chunk 7 both lean on its
  conclusion that virtual threads removed the reason most teams went reactive.
- **[Phase 6 — Concurrency](../../phase-6-concurrency/README.md)** — virtual
  threads themselves, independent of any framework.
- **[Phase 8 — Build and dependencies](../../phase-8-build-dependencies/README.md)**
  — annotation processing is the mechanism behind compile-time DI, and
  dependency review is where "is this library native-ready" belongs.
- **[Phase 12 — The JVM in production](../../phase-12-jvm-production/README.md)**
  — picks up AOT/CDS and native image from the operations side.
- **[Topic 13 — Actuator](../13-actuator/README.md)** — the observability surface chunk
  6 warns you may lose when an APM agent has no bytecode to instrument.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The trade](01-the-trade.md)
