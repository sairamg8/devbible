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
| 11 · Testing | 11 | 🚧 **IN PROGRESS — 3/11 closed, 4 in flight** (session `eb985f67`, 2026-08-28 17:32). **174 chunks, ~41,000 lines on disk.** ✅ **01 · JUnit 5 CLOSED — 62 chunks + index, ~14,500 lines**, the largest topic in the Java corpus. Closing it repaired **four live 404s inside the already-closed topics 02 and 03**, which had been shipping links to an index nobody had written; a fifth dangling link (to the unwritten topic 08) was converted to plain text rather than left pointing at nothing. ✅ **02 · AssertJ CLOSED — 25 chunks + index**, sourced mostly from the `assertj-core` 3.27.7 **class javadocs** at tag `assertj-build-3.27.7`, because the doc site truncates before soft assertions, custom assertions, `Optional`, temporal assertions and descriptions. ✅ **03 · Parameterized tests CLOSED — 38 chunks + index**. 🔴 **04 · Mockito (44 chunks) is written but NOT closed** — it still owes `08-spies`, `09-injectmocks`, `12c-contract-testing-a-fake`, a contiguous renumber (positions run 1–30 then jump to 50–63) and its `README.md` index. 05 · The test pyramid, 06 · MockMvc and 07 · Testcontainers opened at 2 chunks each before their forks were wound down at a 3-agent ceiling; their documentation research is banked in the store (`research_java_p11_t0{4,5,6,7}_*.md`) so it is not re-derived. 🔴 The recurring defect in this phase is a fork answering "split this file" by **deleting** content instead: it happened three times, was caught each time only by comparing line and ★ counts before and after, and one file (`04/06e`) had to be restored from a fork's context because git had never seen it. A trim passes the cap, MDX and link checks and looks identical to a split in a file listing |
| 12 · The JVM in production | 15 | Planned |
| 13 · OAuth2, OIDC and service security | 14 | Planned |
| 14 · Microservice architecture | 12 | Planned |
| 15 · Messaging and event-driven | 14 | Planned |
| 16 · Resilience and operating the fleet | 13 | Planned |
