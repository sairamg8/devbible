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
| 10 · Data access | 14 | 🚧 **11/14 closed** — topics 01–08 complete (**335 chunks, ~88,000 lines**): JDBC · connection pooling · JDBC transactions · Spring `@Transactional` · SQL-first access · the JPA/Hibernate model · relationships and fetch types · the N+1 problem. **09 · Spring Data JPA (49 chunks), 13 · jOOQ (33) and 14 · Spring Data Mongo/Redis (26) closed 2026-08-27** with their indexes. Topics **10, 11 and 12 are part-written — 86 chunks on disk, no index yet** (10·27 11·33 12·26); each resumes from the chunk plan in its own directory. 2026-08-27: topic 10's uncommitted 379-line `08-lazy-basic-attributes.md` was salvaged and split at the cap into **08** and **08b · The `@Lob` reflex and the lazy group** |
| 11 · Testing | 11 | Planned |
| 12 · The JVM in production | 15 | Planned |
| 13 · OAuth2, OIDC and service security | 14 | Planned |
| 14 · Microservice architecture | 12 | Planned |
| 15 · Messaging and event-driven | 14 | Planned |
| 16 · Resilience and operating the fleet | 13 | Planned |
