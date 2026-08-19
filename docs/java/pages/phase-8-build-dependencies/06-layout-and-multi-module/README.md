---
title: "Layout and multi-module projects"
sidebar_label: "06 · Layout & multi-module"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Apache Maven "Introduction to the Standard
> Directory Layout", the Maven POM reference (`<modules>`, `<parent>`,
> `<packaging>`), "Guide to Working with Multiple Modules", the Maven CLI
> reference (`-pl`, `-am`, `-amd`, `-rf`), the maven-resources-plugin
> "Filtering" and "Binaries Filtering" pages, "What's new in Maven 4"
> (model 4.1.0, `<subprojects>`), and the Gradle 9.7 user manual
> (`settings.gradle(.kts)` `include`, composite builds via `includeBuild`).
> Maven's GA line at the time of writing is **3.9.16**; Maven **4.0.0 is
> still release-candidate (4.0.0-rc-6)**, so every Maven 4 behaviour below is
> flagged as such.

**Maven's directory layout is not a style preference — it is *input*. The
super POM declares `src/main/java` as the source root and every plugin binds
its defaults to that tree, so the layout is the contract between you and a
hundred plugins you never configured. The same idea scales up: in a
multi-module build the `<modules>` list is not the build order, it is only the
membership list. The order comes from the *reactor*, which topologically
sorts modules by the dependencies they declare on each other — which is why
adding a dependency can silently reorder your build, and why a cycle stops it
dead before a single module compiles.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The standard layout and resources](01-the-standard-layout.md)** | The directory table and why deviating is expensive, `target/` as disposable output, test sources never shipped, resource filtering and the binary-corruption trap, the `${...}` / `@...@` delimiter collision with Spring, test resources shadowing main ones whole-file |
| 2 | **[Aggregator, parent and the reactor](02-multi-module-and-the-reactor.md)** | Aggregator vs parent as two different jobs, `dependencyManagement` vs `dependencies`, the reactor's DAG and the four relationships that feed it, cycles, parallelism, and `-pl`/`-am`/`-amd`/`-rf`/`-fae` |
| 3 | **[Splitting a tree: api, service, domain](03-splitting-a-tree.md)** | The worked split with the arrow pointing inward, transitive `compile` scope leaking the boundary, Maven modules vs JPMS modules, Gradle's `include` / `api` vs `implementation` / composite builds, and the honest cost of splitting |

## Why this topic is chunked

Three genuinely separate skills wear one name. The first is *conventional
layout* — a single-module concern that decides what ends up in your jar and
which files silently get rewritten on the way there. The second is *the
reactor* — a graph algorithm whose behaviour explains almost every confusing
multi-module build failure. The third is the *design* question of where to cut
the tree, which is an architecture decision the build tool only enforces.
Reading them as one page hides that the traps in each have nothing to do with
the traps in the others.

## Where this connects

- **[Packages and the classpath](../../phase-0-platform-jvm/05-packages-classpath/README.md)**
  — what the build tool is assembling when it lays out `target/classes` and
  `target/test-classes`.
- **[The module system (JPMS)](../../phase-0-platform-jvm/11-module-system.md)**
  — the *other* thing called a module, and the one that actually enforces
  package-level encapsulation. Chunk 3 draws the line between them.
- **[Encapsulation and access modifiers](../../phase-2-classes-objects/02-encapsulation-access/README.md)**
  — a module split is the same argument as `private`, made one level up and
  enforced by the compile classpath instead of by review.
- **Phase 9 — Spring Boot** *(not written yet)* — `spring-boot-starter-parent`
  is the canonical published parent that aggregates nothing, and it is where
  the `@...@` filtering delimiter comes from.

---

← Prev: [Wrappers](../05-wrappers/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [The standard layout and resources](01-the-standard-layout.md)
