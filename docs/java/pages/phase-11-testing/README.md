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

🚧 **2 of 11 closed, 5 more in flight — 173 chunks and ~40,900 lines on disk.** 02 · AssertJ (25 chunks) and 03 · Parameterized tests (38) are closed. 01 · JUnit 5 (62 chunks, ~14,500 lines) and 04 · Mockito (42, ~10,500) are written but **not yet closed — each still needs its `README.md` index**. 05 · The test pyramid, 06 · MockMvc and 07 · Testcontainers have opened at 2 chunks each.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **JUnit 5** *(62 chunks, index pending)* | <span className="db-tier t-master">Master</span> | Lifecycle, assertions, `assertThrows` — tests that document behaviour |
| 02 | **[AssertJ](02-assertj/README.md)** | <span className="db-tier t-understand">Understand</span> | Fluent assertions whose failures do the debugging |
| 03 | **[Parameterized tests](03-parameterized-tests/README.md)** | <span className="db-tier t-understand">Understand</span> | One test, every edge of the tax calculation |
| 04 | **Mockito** *(42 chunks, index pending)* | <span className="db-tier t-master">Master</span> | Mock boundaries, never the class under test |
| 05 | **The test pyramid in Spring** *(2 chunks, in flight)* | <span className="db-tier t-understand">Understand</span> | Unit vs slices vs `@SpringBootTest` — and the 20-minute suite |
| 06 | **Web-layer tests with `MockMvc`** *(2 chunks, in flight)* | <span className="db-tier t-understand">Understand</span> | Status, JSON body, validation errors — no server socket |
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
