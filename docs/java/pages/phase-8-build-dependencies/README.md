---
title: "Phase 8 — The build: Maven, Gradle and dependencies"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS) · Maven 3.9/4 · Gradle 8+.** Documentation-validated —
> every page names its sources on a `> Verified:` line (maven.apache.org,
> docs.gradle.org, the Maven POM reference). No sandbox: pages carry POM/build
> snippets and command syntax, never fabricated build output.

Nobody ships `javac` output by hand. The build tool is where dependency hell,
"works on my machine", and supply-chain risk all live. The Master topic is
Maven's core model because Spring Boot's starters, BOMs and plugins are all
Maven concepts wearing convenience clothing.

🚧 **0 of 12 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **Maven core** *(not written yet)* | <span className="db-tier t-master">Master</span> | POM, GAV coordinates, the lifecycle, plugins vs dependencies |
| 02 | **Dependency scopes** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `compile`/`test`/`provided`/`runtime` — and the leak that matters |
| 03 | **Transitive dependencies and mediation** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Nearest-wins, `dependency:tree`, exclusions, BOMs |
| 04 | **Gradle** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `build.gradle.kts`, incremental builds — vs Maven honestly |
| 05 | **Wrappers** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `./mvnw`, `./gradlew` — CI and the new laptop agree by construction |
| 06 | **Layout and multi-module projects** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `src/main/java`; one repo, `api`/`service`/`domain` modules |
| 07 | **Versioning, updates and CVE scanning** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Semver as practiced; the log4shell lesson institutionalized |
| 08 | **Jar anatomy** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `MANIFEST.MF`, fat jars, shading — two libraries colliding in one jar |
| 09 | **Annotation processing** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | How Lombok/MapStruct hook `javac`; Lombok's trade-offs plainly |
| 10 | **Artifact repositories** *(not written yet)* | <span className="db-tier t-know">Know</span> | Maven Central, Nexus/Artifactory proxies, publishing |
| 11 | **`javac` flags that matter** *(not written yet)* | <span className="db-tier t-know">Know</span> | `-parameters`, `--release`, `--enable-preview` |
| 12 | **Toolchains** *(not written yet)* | <span className="db-tier t-know">Know</span> | Building with a pinned JDK independent of the build tool's |

## Phase gate

Move on when: given "two versions of Jackson on the classpath, wrong one
wins", you reach for `dependency:tree`, name the mediation rule that chose it,
and fix it with a BOM or exclusion — not by deleting `~/.m2`.

## Where this connects

- **[Phase 0](../phase-0-platform-jvm/README.md)** topic 05's classpath is
  what the build tool assembles; `--release` continues topic 01's story.
- **Phase 9 — Spring Boot** is this phase applied: starters are curated
  dependency sets, the BOM pins hundreds of versions.
- **Phase 12** picks up layered jars for Docker.
