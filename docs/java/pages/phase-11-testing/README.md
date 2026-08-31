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

🚧 **9 of 12 closed, 349 chunks and ~84,300 lines on disk.** ✅ **09 · Coverage with JaCoCo CLOSED 2026-08-31 — 22 chunks + index, 5,306 lines, 304 ★**, positions contiguous 0–22, 0 over the cap, 0 dangling links, **one proven split** (324 lines/16 ★ → 407/23, both totals up, nothing trimmed). 🔴 **Six documented facts, each verified against jacoco.org rather than a blog, carry the topic**: *"exception handling is not considered as branches in the context of this counter definition"* and *"try/catch blocks will also not increase complexity"* — so a branch-coverage gate is **exactly as satisfied by code with no error handling as by thorough error handling**; an unspecified `check` limit defaults to `BUNDLE`/`INSTRUCTION`/`COVEREDRATIO`, so the ubiquitous bare `<minimum>0.80</minimum>` is instruction coverage, not the line coverage everyone believes they configured; **`jakarta.annotation.Generated` is `@Retention(SOURCE)`**, so JaCoCo's `@*Generated` filter (which needs RUNTIME or CLASS retention) cannot see the standard annotation for marking generated code; **Lombok does not add `@lombok.Generated` by default** — it is opt-in via `lombok.addLombokGeneratedAnnotation`, so every "JaCoCo ignores Lombok" claim is conditional; excluding at the **agent** makes a number *worse*, because per JaCoCo's FAQ the report *"cannot distinguish whether the class was excluded from instrumentation or not executed"*; and Gradle's own manual states that `jacocoTestReport` *"does not depend on the `test` task"* and that the verification task *"is not a task dependency of the `check` task"* — which is how configured coverage gates silently never run. ⚠️ Three claims documentation could **not** settle are flagged in-page rather than filled from a blog. Corrections made mid-run: 0.8.15 is the current **release** (`0.8.16.202608270545` is a snapshot), and `prepare-agent-integration` sets **`argLine`**, not a `failsafeArgLine`. ✅ **07 · Testcontainers CLOSED 2026-08-31 — 50 chunks + index, ~11,900 lines, 657 ★**, the phase's third-largest topic, built by **four agents inside the one topic** on disjoint `sidebar_position` bands after the user raised the ceiling (*"along with you deploy 3 more agents"*). It began at 3 chunks and 3 `draft: true` stubs; **all three stubs are gone**. 🔴 **Sixteen splits, every one proven** by recording `wc -l` and `grep -c '^**★'` before and demanding both after — 1,277→2,221 lines (41→128 ★), 490→1,339 (22→77), 650→892 (30→46), 565→835 (21→46), 487→701 (21→40) and eleven more; **no gotcha or question was lost anywhere**. 🔴 **Four claims in the coordinator's own briefs and in the banked research were contradicted by the sources, and every one was caught by an author told to verify rather than comply**: dynamic property *values* are not in the context cache key (`DynamicPropertiesContextCustomizer` keys on `Set<Method>`, so subclasses sharing an inherited `@DynamicPropertySource` share a context); Ryuk is **0.14.0**, not the research file's 0.13.0; H2 uses SQLState **23505** exactly as PostgreSQL does, so the brief's example was backwards (the real divergences are `23513` vs `23514` and H2's `40001` where PostgreSQL splits `40001`/`40P01`); and **the already-committed `01b` wrongly listed `SKIP LOCKED` and `DISTINCT ON` as constructs H2 cannot parse** — H2 2.4.240 parses both, verified against its own grammar, and the correction made the page's argument stronger because a construct H2 *accepts and approximates* costs a green build where one it rejects costs a red one. ✅ **06 · MockMvc CLOSED 2026-08-30 — 34 chunks + index, ~8,000 lines, 406 interview questions and gotchas**, the second-largest topic in the phase: a 15-line stub for security became nine chunks and a 14-line stub for exception handlers became six. Closing it also repaired a 314-line cap violation left behind in `06-validation-errors.md` (split, not trimmed) and upgraded an under-claiming hedge in `02-webmvctest.md` to a Boot how-to citation. ✅ **04 · Mockito CLOSED — 57 chunks + index, ~14,100 lines, 758 interview questions**, and ✅ **05 · The test pyramid CLOSED — 22 chunks + index, ~4,950 lines**. ✅ **01 · JUnit 5 CLOSED — 62 chunks + index**, the largest topic in the Java corpus. 02 · AssertJ (24) and 03 · Parameterized tests (37) were already closed. ✅ **08 · Test data patterns CLOSED 2026-08-31 — 34 chunks + `README.md` index, ~8,999 lines, 450 ★**, built by three authors in the one topic on disjoint `sidebar_position` bands, renumbered contiguously 1–33 at close. **Eleven splits, every one proven** by recording `wc -l` and `grep -c` before and demanding both after. 🔴 Three documented facts corrected the briefs: `@AutoConfigureTestDatabase.replace` defaults to **`NON_TEST`**, not `ANY`, so the universal "`replace = Replace.NONE` next to a container" advice is stale on Boot 4.1; Boot 4 **moved** the slice annotations (`TestEntityManager` is in `org.springframework.boot.jpa.test.autoconfigure`, *not* `data.jpa`); and Lombok's `@Builder` **ignores field initializers** unless annotated `@Builder.Default`. **09 · JaCoCo, 10 · jqwik and 11 · PIT have `_plan.md` outlines and no chunks.** 🔴 **12 · Real-world testing scenarios was added 2026-08-31 on the user's instruction** — a task-shaped chapter for the situations that make up most real work (mocking a class, mocking an API response, testing a controller, an async job, a consumer), deliberately mirroring how JavaScript and React testing treat their everyday scenarios; it reuses topics 04–08 rather than re-teaching them.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[JUnit 5](01-junit-5/README.md)** *(62 chunks)* | <span className="db-tier t-master">Master</span> | Lifecycle, assertions, `assertThrows` — tests that document behaviour |
| 02 | **[AssertJ](02-assertj/README.md)** | <span className="db-tier t-understand">Understand</span> | Fluent assertions whose failures do the debugging |
| 03 | **[Parameterized tests](03-parameterized-tests/README.md)** | <span className="db-tier t-understand">Understand</span> | One test, every edge of the tax calculation |
| 04 | **[Mockito](04-mockito/README.md)** *(57 chunks)* | <span className="db-tier t-master">Master</span> | Mock boundaries, never the class under test |
| 05 | **[The test pyramid in Spring](05-the-test-pyramid/README.md)** *(22 chunks)* | <span className="db-tier t-understand">Understand</span> | Unit vs slices vs `@SpringBootTest` — and the 20-minute suite |
| 06 | **[Web-layer tests with `MockMvc`](06-mockmvc/README.md)** *(34 chunks + index, ~8,000 lines)* | <span className="db-tier t-understand">Understand</span> | ✅ **CLOSED** — the slice, both APIs, JSON, validation, `@ControllerAdvice`, security, and where the boundary is |
| 07 | **[Testcontainers](07-testcontainers/README.md)** *(✅ 50 chunks, 657 ★)* | <span className="db-tier t-understand">Understand</span> | A real PostgreSQL per suite — the end of "passed on H2" |
| 08 | **[Test data patterns](08-test-data-patterns/README.md)** *(✅ 34 chunks, 450 ★)* | <span className="db-tier t-understand">Understand</span> | ✅ **CLOSED** — builders, object mothers, `@Sql` fixtures, cleanup, order-dependence, clocks and generated data |
| 09 | **[Coverage with JaCoCo](09-jacoco/README.md)** | <span className="db-tier t-know">Know</span> | ✅ **CLOSED — 22 chunks + index, 5,306 lines, 304 ★.** A floor, not a target — and `try`/`catch` is not a branch, so the gate cannot see your error handling |
| 10 | **Property-based testing** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | jqwik — generating the inputs you didn't think of |
| 11 | **Mutation testing** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | PIT — testing the tests |
| 12 | **Real-world testing scenarios** *(not written yet)* | <span className="db-tier t-master">Master</span> | 🔴 Task-shaped: mock a class, mock an API response, test the controller, the async job, the consumer — with the JS/React → Java map |

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
