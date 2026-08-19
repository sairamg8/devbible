---
title: "Transitive dependencies and mediation"
sidebar_label: "03 · Transitive and mediation"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Maven guide *Introduction to the Dependency
> Mechanism*, the Maven POM reference (version ranges, exclusions, optional),
> the maven-dependency-plugin **3.11.0** docs (`tree`, `analyze`, filtering),
> the maven-enforcer-plugin **3.6.3** rule pages (`dependencyConvergence`,
> `requireUpperBoundDeps`), the Gradle **9.7.0** user guide (dependency
> resolution, version conflict resolution, rich versions, platforms), and the
> Maven 4 *What's new* page. Maven **3.9.16** stable; Maven **4.0.0-rc-6**
> (2026-08-04) is named only where it differs.

**You declare a handful of dependencies and get several hundred. Maven then
flattens that graph to exactly one version per `groupId:artifactId` using a
rule most Java developers have never read — *nearest wins* — and Gradle
flattens the same graph with the opposite rule, *highest wins*. Neither
guarantees the version anyone intended, and neither will fail your build when
it chooses badly. The failure arrives later, at a call site, as
`NoSuchMethodError`.**

This topic runs to four files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The graph, and who wins](01-the-graph-and-who-wins.md)** | How the transitive graph is built and flattened, Maven's nearest-wins stated precisely with the equal-depth tiebreak, soft vs hard version requirements, Gradle's highest-wins and rich versions, and why a compile-clean build ships a runtime `NoSuchMethodError` |
| 2 | **[Reading the tree, and overriding it](02-reading-and-overriding.md)** | `mvn dependency:tree` with `-Dverbose`, `-Dincludes`, `-Dscope` as the first command in any wrong-version incident; the "omitted for conflict with" annotations; `<exclusions>` and when they are the wrong fix; version ranges and why nobody uses them; `<dependencyManagement>` as the deterministic override |
| 3 | **[BOMs and platforms](03-boms-and-platforms.md)** | BOMs via `<scope>import</scope>`, how `spring-boot-dependencies` pins hundreds of tested-together versions, the two ways to consume it and why overriding one entry differs between them, Maven 4's `bom` packaging, Gradle's `platform()` vs `enforcedPlatform()` |
| 4 | **[The guards that fail the build](04-the-guards.md)** | `dependency:analyze` (used-undeclared vs unused-declared, and its bytecode blind spots), Enforcer's `dependencyConvergence` and `requireUpperBoundDeps`, what each actually asserts, and the order to adopt them in |

## Why this runs to four files

- **Understanding the rule and diagnosing an incident are different skills.**
  You can recite nearest-wins and still not know that `-Dverbose` is what shows
  you the versions mediation *discarded*, which is the only information that
  explains a wrong choice.
- **Every fix has a wrong version of itself.** An `<exclusion>` where a managed
  version belonged, a version range where a BOM belonged, a `dependencyManagement`
  entry where an Enforcer rule belonged. Chunks 2 and 3 are the fixes, ranked by
  blast radius.
- **A policy is not a check.** Neither Maven nor Gradle fails a build over a
  version conflict, so nothing above notices when the policy is incomplete. The
  fourth chunk is the part that turns a one-off fix into something CI enforces.

## Phase gate

Given "two versions of Jackson on the classpath, wrong one wins": reach for
`dependency:tree`, name the mediation rule that chose it, and fix it with a BOM
or a managed version — not by deleting `~/.m2`.

## Where this connects

- **[Dependency scopes](../02-dependency-scopes/README.md)** — the previous
  question. Scope decides *whether* a transitive dependency reaches you and on
  which classpath; mediation decides *which version* does.
- **[The classpath](../../phase-0-platform-jvm/05-packages-classpath/02-the-classpath.md)**
  — mediation exists because the classpath is a flat, first-match-wins
  namespace with no room for two versions of a class.
- **[Classloaders and the two errors](../../phase-0-platform-jvm/05-packages-classpath/03-classloaders-and-the-two-errors.md)**
  — `NoSuchMethodError` as a distinct fact from a missing class; this topic is
  where that error comes from.
- **Phase 9 — Spring Boot** *(not written yet)* — `spring-boot-dependencies`
  is the BOM chunk 3 dissects, and Boot's starters are curated dependency sets
  built on everything here.

---

← Prev: [Dependency scopes](../02-dependency-scopes/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [The graph, and who wins](01-the-graph-and-who-wins.md)
