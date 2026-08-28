---
title: "Phase 11 — Testing"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: JUnit 5 · Mockito · AssertJ · Testcontainers, on Java 25.**
> Documentation-validated — every page names its sources on a `> Verified:`
> line (the JUnit 5 user guide, Mockito and AssertJ docs, the Spring Boot
> testing reference, java.testcontainers.org). No sandbox: pages carry test
> code, never fabricated test-run output.

Java's testing stack is mature and opinionated. The skill gap in real teams is
not "can you write a test" — it is slice choice, mock discipline, and tests
that hit a real database instead of an in-memory impostor.

🚧 **5 of 11 closed, 2 more in flight — 209 chunks and ~50,000 lines on disk.** ✅ **04 · Mockito CLOSED — 57 chunks + index, ~14,100 lines, 758 interview questions**, and ✅ **05 · The test pyramid CLOSED — 22 chunks + index, ~4,950 lines**, written in parallel by a fork and the coordinator sharing this phase. 04's positions were renumbered contiguous 1–57 without renaming a single file, since two forks had shared the directory with reserved bands. ✅ **01 · JUnit 5 CLOSED — 62 chunks + index**, the largest topic in the Java corpus; closing it repaired four live 404s in topics 02 and 03. 02 · AssertJ (24) and 03 · Parameterized tests (37) were already closed. 06 · MockMvc (4 chunks) is in flight; 07 · Testcontainers stands at 2.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[JUnit 5](01-junit-5/README.md)** *(62 chunks)* | <span className="db-tier t-master">Master</span> | Lifecycle, assertions, `assertThrows` — tests that document behaviour |
| 02 | **[AssertJ](02-assertj/README.md)** | <span className="db-tier t-understand">Understand</span> | Fluent assertions whose failures do the debugging |
| 03 | **[Parameterized tests](03-parameterized-tests/README.md)** | <span className="db-tier t-understand">Understand</span> | One test, every edge of the tax calculation |
| 04 | **[Mockito](04-mockito/README.md)** *(57 chunks)* | <span className="db-tier t-master">Master</span> | Mock boundaries, never the class under test |
| 05 | **[The test pyramid in Spring](05-the-test-pyramid/README.md)** *(22 chunks)* | <span className="db-tier t-understand">Understand</span> | Unit vs slices vs `@SpringBootTest` — and the 20-minute suite |
| 06 | **Web-layer tests with `MockMvc`** *(4 chunks, in flight)* | <span className="db-tier t-understand">Understand</span> | Status, JSON body, validation errors — no server socket |
| 07 | **Testcontainers** *(2 chunks, in flight)* | <span className="db-tier t-understand">Understand</span> | A real PostgreSQL per suite — the end of "passed on H2" |
| 08 | **Test data patterns** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Builders and object mothers vs the 40-line setup block |
| 09 | **Coverage with JaCoCo** *(not written yet)* | <span className="db-tier t-know">Know</span> | A floor, not a target — what the number can't say |
| 10 | **Property-based testing** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | jqwik — generating the inputs you didn't think of |
| 11 | **Mutation testing** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | PIT — testing the tests |

## Phase gate

**Deliverable:** the Phase 9/10 service covered three ways — controller slice
with `MockMvc`, repository test on Testcontainers Postgres, pure unit tests
for the domain — and the whole suite still runs in seconds.

## Where this connects

- **[Phase 9](../phase-9-spring-boot/README.md)** and
  **[Phase 10](../phase-10-data-access/README.md)** built the service these
  pages test.
- **Phase 14 — Microservice architecture** adds consumer-driven contract
  tests on top of this stack.
