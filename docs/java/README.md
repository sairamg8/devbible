---
title: "Java — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against the JDK 25 documentation, openjdk.org/projects/jdk/26
> and /27, and the Oracle Java SE support roadmap.

The complete topic inventory for Java, tiered for **mastery in backend service
development**. 17 phases, split into 5 parts to stay under the 300-line file cap.

Java sits outside this bible's MERN/PERN core — it is here as the second backend
language, taught toward the same job: a production API in front of PostgreSQL.
Where a concept already lives elsewhere in the bible (SQL itself, HTTP, Docker),
the Java pages will link there rather than reteach it.

## Version facts

| | |
|---|---|
| Current LTS | **Java 25** — shipped September 2025; the build target |
| Latest release | **JDK 26** (26.0.2) — GA **17 Mar 2026**, non-LTS, support ends Sept 2026 |
| Next release | **JDK 27** — GA **15 Sept 2026**, non-LTS |
| LTS cadence | Every **2 years**: 17 → 21 → 25 → 29 |
| Release model | One major every 6 months; most teams move LTS-to-LTS |
| Build on today | **Java 25 LTS** in production · read the 26/27 notes to see what's coming |

"Which Java are you on?" is a real interview question because the ecosystem
spans 8 to 26 in production. This syllabus assumes **25** and marks features by
the release that finalized them (records 16, sealed types 17, virtual threads
21, ScopedValue 25) so you can tell what exists on an older JDK you inherit.

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[Foundations](syllabus/01-foundations.md)** | The platform and JVM, language core, classes and objects | 0–2 |
| 2 | **[Core library](syllabus/02-core-library.md)** | Generics, collections, streams, exceptions, concurrency | 3–6 |
| 3 | **[Application layer](syllabus/03-application.md)** | Everyday stdlib, Maven/Gradle, Spring Boot, data access | 7–10 |
| 4 | **[Production](syllabus/04-production.md)** | Testing, the JVM under load, observability, deployment | 11–12 |
| 5 | **[Distributed Java](syllabus/05-distributed.md)** | OAuth2/OIDC, microservices, Kafka/RabbitMQ, resilience | 13–16 |

## Explanations

Not started — the syllabus comes first, the explanation pages follow once it is
approved. Status lives in **[Explanations](./pages/README.md)**.

import Progress from '@site/src/components/Progress';

<Progress lang="java" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up signatures freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 68 | 29% |
| <span className="db-tier t-understand">Understand</span> | 111 | 48% |
| <span className="db-tier t-know">Know</span> | 46 | 20% |
| <span className="db-tier t-when">When Needed</span> | 7 | 3% |
| **Total** | **232** | |

By part: Foundations 44 · Core library 54 · Application 55 · Production 26 ·
Distributed 53.

If you only ever finish the <span className="db-tier t-master">Master</span>
set, you can build, test and debug a Spring Boot service. The rest is range —
and range is what the JVM rewards.

## Prerequisites

Programming in at least one language (this bible's JavaScript track more than
qualifies), and SQL through joins — the data-access phase leans on the
PostgreSQL section rather than reteaching it.

## Reading order

Phases are sequential and the order is load-bearing. Three rules:

1. **Do not skip Phase 0.** Warm-up, classpath errors and container memory
   limits all trace back to the platform model.
2. **Do not start Spring (Phase 9) before Phases 2 and 5.** Spring is objects,
   proxies and exceptions all the way down; learning the annotations without
   the mechanics means never debugging them well.
3. **JPA comes after JDBC** inside Phase 10 — you cannot reason about an ORM
   you've never seen under.

Phases 11–12 can run alongside whatever you're building from Phase 9 onward.
Part 5 (phases 13–16) assumes Phases 9–12 — its OAuth2 phase extends Phase 9's
Spring Security row, and its messaging phase leans on Phase 10's transactions.

## Sources

- [JDK 25 documentation](https://docs.oracle.com/en/java/javase/25/) · [Java Language Specification](https://docs.oracle.com/javase/specs/)
- [openjdk.org/projects/jdk/26](https://openjdk.org/projects/jdk/26/) · [/27](https://openjdk.org/projects/jdk/27/) — feature lists per release
- [Oracle Java SE support roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html) · [endoflife.date/oracle-jdk](https://endoflife.date/oracle-jdk)
- [Spring Boot reference](https://docs.spring.io/spring-boot/index.html) · [Hibernate ORM docs](https://hibernate.org/orm/documentation/)
- [JUnit 5 user guide](https://junit.org/junit5/docs/current/user-guide/) · [Testcontainers for Java](https://java.testcontainers.org/)
- [Spring Security reference](https://docs.spring.io/spring-security/reference/index.html) · [Spring Cloud](https://spring.io/projects/spring-cloud) · [Resilience4j docs](https://resilience4j.readme.io/)
- [Apache Kafka documentation](https://kafka.apache.org/documentation/) · [Spring for Apache Kafka](https://docs.spring.io/spring-kafka/reference/) · [RabbitMQ docs](https://www.rabbitmq.com/docs)
