---
title: "Java — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

Status board for the Java explanation pages — one page per syllabus topic, with
code, gotchas and interview questions.

**Writing in progress** — approved 2026-08-17, written phase by phase in
reading order. The [syllabus](../README.md) is complete: 232 topics, 17 phases.

import Progress from '@site/src/components/Progress';

<Progress lang="java" />

| Phase | Topics | State |
|---|---|---|
| 0 · The platform and the JVM | 13 | ✅ 13/13 |
| 1 · Language core | 16 | ✅ 16/16 |
| 2 · Classes and objects | 15 | ✅ 15/15 |
| 3 · Generics and collections | 16 | ✅ 16/16 |
| 4 · Lambdas, streams and `Optional` | 13 | ✅ 13/13 |
| 5 · Exceptions and failure design | 8 | ✅ 8/8 |
| 6 · Concurrency | 17 | ✅ 17/17 |
| 7 · I/O, time and the everyday stdlib | 13 | ✅ 13/13 |
| 8 · The build: Maven, Gradle, dependencies | 12 | ✅ 12/12 |
| 9 · Spring Boot and the web | 16 | ✅ 16/16 — complete |
| 10 · Data access | 14 | ✅ **CLOSED 14/14** — topics 01–08 complete (**335 chunks, ~88,000 lines**): JDBC · connection pooling · JDBC transactions · Spring `@Transactional` · SQL-first access · the JPA/Hibernate model · relationships and fetch types · the N+1 problem. **09 · Spring Data JPA (49 chunks), 13 · jOOQ (33) and 14 · Spring Data Mongo/Redis (26) closed 2026-08-27** with their indexes. **The last three closed 2026-08-27**: 12 · Caching (35 chunks), 10 · Lazy-loading pitfalls (35) and 11 · Migrations with Flyway (44), each with its index. The phase is **569 files / ~141,700 lines**, **0 over the 300-line cap, 0 dangling links, 0 MDX hazards**, all 14 topics indexed. Two chunks that committed pages linked to by name but nobody had written — Flyway's `10c` and caching's `07d` — were found by resolving every link target against the filesystem and have been authored |
| 11 · Testing | 11 | 🚧 **IN PROGRESS 2/11** (session `96c650f6`, 2026-08-28). ✅ **02 · AssertJ CLOSED — 24 chunks + index, ~5,600 lines**, sourced mostly from the `assertj-core` 3.27.7 **class javadocs** at tag `assertj-build-3.27.7`, because the doc site truncates before soft assertions, custom assertions, `Optional`, temporal assertions and descriptions. ✅ **03 · Parameterized tests CLOSED — 37 chunks + index, ~8,950 lines**, 0 over the cap, 0 MDX hazards, `sidebar_position` 0–37 contiguous; two oversized drafts were **split on concept boundaries, not trimmed** (`08l` 398→four chunks, `09` 318→five, the counter-case getting its own chunk so the honest half carries equal weight), and five claims the JUnit docs cannot settle are stated as uncertain in place rather than guessed. **01 · JUnit 5** (29 chunks so far) and **04 · Mockito** (3) are in flight under two forks. 🔴 18 stale chunk links across topics 01 and 03 were repointed first — earlier forks renamed chunks *after* linking them, a failure `fixlinks.py` passes silently because it resolves `NN-topic.md` against a directory `NN-topic/`. 🔴 A stale claim in `01/03b` was corrected: a `@Nested` class **can** declare `@BeforeAll` on JUnit 6, because the inner-class `static`-member restriction expired at Java SE 16 (JLS SE 25 §8.1.3) and JUnit 6 baselines Java 17 |
| 12 · The JVM in production | 15 | Planned |
| 13 · OAuth2, OIDC and service security | 14 | Planned |
| 14 · Microservice architecture | 12 | Planned |
| 15 · Messaging and event-driven | 14 | Planned |
| 16 · Resilience and operating the fleet | 13 | Planned |
