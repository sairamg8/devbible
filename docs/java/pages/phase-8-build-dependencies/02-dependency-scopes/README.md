---
title: "Dependency scopes"
sidebar_label: "02 · Dependency scopes"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Maven guide *Introduction to the Dependency
> Mechanism* (maven.apache.org — scope definitions, the scope-transitivity
> table, optional dependencies), the maven-dependency-plugin `analyze` and
> `tree` mojo pages, the maven-war-plugin FAQ, and the Spring Boot Maven plugin
> *Packaging Executable Archives* documentation. Maven **3.9.16** (current
> stable, released 2026-05-13); Maven **4.0.0** is still at **rc-6**
> (2026-08-04) and is named only where it differs. JDK 25 target.

**A scope is not a category — it is an answer to four separate questions at
once: is this jar on the compile classpath, on the test classpath, on the
runtime classpath, and does it reach anyone who depends on *me*. Getting the
scope wrong never fails at the moment you get it wrong. It fails when a test
library turns up in production bytecode, when a container does not supply an
API you promised it would, or when a consumer of your library inherits three
hundred jars it never asked for.**

This topic runs to two files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The five classpath scopes](01-the-five-scopes.md)** | The four-answers table, `compile` as the unjustified default, `provided` as an unverified promise, `runtime` as a design control, `test` and the leak that matters, why `system` is documented as not recommended |
| 2 | **[Transitivity, `optional`, and what actually ships](02-transitivity-and-what-ships.md)** | The scope-rewriting table for transitive dependencies and how to read it, `import` scope, `<optional>` as an orthogonal flag, how Spring Boot's repackager changes the `provided` answer, the commands that tell you what is really in the archive |

## Why this runs to two files

- **The scopes and the transitivity table are two different mechanisms.** You
  can know every scope definition by heart and still not be able to answer
  "why can't I `import` a class that `dependency:tree` clearly shows me" —
  that answer is entirely in the rewriting table, which is a separate rule
  operating on top of the scopes.
- **What *ships* is a third thing again.** The scope decides the classpath;
  the packaging plugin decides the archive, and `spring-boot-maven-plugin`
  deliberately disagrees with the war plugin about `provided`. Reasoning about
  deployment from scopes alone is how people ship what they meant to exclude.

## Where this connects

- **[The classpath](../../phase-0-platform-jvm/05-packages-classpath/02-the-classpath.md)**
  — scopes exist to build four different classpaths out of one dependency
  graph; this is what they are building.
- **[Classloaders and the two errors](../../phase-0-platform-jvm/05-packages-classpath/03-classloaders-and-the-two-errors.md)**
  — the `NoClassDefFoundError` a broken `provided` promise produces, and why
  two copies of one API class are two different types.
- **[Transitive dependencies and mediation](../03-transitive-and-mediation/README.md)**
  — the next question after "what scope": which *version* wins when the graph
  offers several, and how BOMs (via `import` scope) settle it.
- **Phase 9 — Spring Boot** *(not written yet)* — starters are curated
  dependency sets, and the repackager's scope handling is what puts them in
  the fat jar.

---

← Prev: [Maven core](../01-maven-core/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [The five classpath scopes](01-the-five-scopes.md)
