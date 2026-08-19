---
title: "Annotation processing"
sidebar_label: "09 · Annotation processing"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the JDK 25 `javax.annotation.processing`
> API documentation (`Processor`, `AbstractProcessor`, `RoundEnvironment`,
> `Filer`, `Messager`) and the JSR 269 model in `javax.lang.model`, the
> JDK 25 `javac` reference page (`-proc:none`/`-proc:only`/`-proc:full`,
> `-processor`, `--processor-path`, `-Xlint:processing`), the JDK 23
> release notes and the OpenJDK Quality Outreach note announcing that
> annotation processing is no longer implicitly enabled, the Apache Maven
> Compiler Plugin documentation for `<annotationProcessorPaths>`, the
> Gradle user guide on the `annotationProcessor` configuration, the
> MapStruct 1.6 reference guide and FAQ (including its Lombok section),
> and projectlombok.org's documentation, configuration reference and
> changelog (JDK support history, `lombok-mapstruct-binding`, `delombok`).

**An annotation processor is a plugin for `javac` that runs during
compilation, reads the program's declarations through a read-only model,
and writes *new* source or class files that the same compiler then
compiles. That is the whole contract, and MapStruct honours it: you get a
generated mapper you can open, read and step through. Lombok does not
honour it — it registers as a processor and then reaches through
`jdk.compiler`'s internal APIs to mutate the compiler's own syntax tree.
Everything people love and everything they curse about Lombok follows from
that one architectural decision.**

## The chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[How processors work](01-how-processors-work.md)** | JSR 269, `ServiceLoader` discovery, the `Element`/`Filer`/`Messager` triad, rounds and why generated code can generate more code, generate-not-modify, the `-proc:*` flags and the JDK 23 change, Maven `annotationProcessorPaths` vs the compile classpath, Gradle's `annotationProcessor` |
| 2 | **[MapStruct and Spring's processors](02-mapstruct-and-spring.md)** | The well-behaved example: compile-time mappers with no reflection, `unmappedTargetPolicy`, the Lombok ordering breakage and `lombok-mapstruct-binding`, and the Spring processors you use without noticing |
| 3 | **[Lombok, plainly](03-lombok-plainly.md)** | AST mutation through compiler internals, `--add-opens`, the JDK-upgrade coupling, why IDEs need a plugin, `delombok`, the honest trade-off, `@Data` on JPA entities, and exactly which parts of Lombok records replaced |

## Why this runs to three chunks

The mechanism is small — one interface, three helper types, a loop of
rounds — but it is the mechanism behind three things a Java developer
touches every day and rarely reads about: why Lombok breaks on JDK
upgrades, why MapStruct and Lombok fight, and why a build that moved to
JDK 23 silently stopped generating code. Chunk 1 is the model, chunk 2 is
what conforming to it looks like, and chunk 3 is what happens when a tool
does not.

## Where this connects

- **[Jar anatomy · the format](../08-jar-anatomy/01-the-format.md)** —
  processors are discovered by `ServiceLoader` from
  `META-INF/services/javax.annotation.processing.Processor`, the same
  convention as every other SPI.
- **[Phase 2 · equals and hashCode](../../phase-2-classes-objects/06-equals-hashcode/README.md)**
  — `@Data` generates the default answer to a question entities must
  answer differently.
- **[Phase 2 · Records](../../phase-2-classes-objects/08-records/README.md)**
  — the language feature that made a large share of Lombok unnecessary,
  and the precise list of what it did not cover.
- **[Phase 0 · The module system](../../phase-0-platform-jvm/11-module-system.md)**
  — strong encapsulation of `jdk.compiler` is why Lombok needs
  `--add-opens` at all.
- **Phase 9 · Spring Boot** *(not written yet)* — configuration metadata
  and the AOT engine are annotation processing at scale.
- **Phase 10 · Data access with JPA** *(not written yet)* — the entity
  equality and lazy-loading hazards `@Data` walks into.

---

← Prev: [Jar anatomy](../08-jar-anatomy/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [How processors work](01-how-processors-work.md)
