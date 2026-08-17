---
title: "Part 4 — Production"
sidebar_label: "4 · Production"
sidebar_position: 4
---

> Phases 11–12 · Testing that earns trust, and the JVM under real load

Everything before this part makes the service work. This part makes it stay
working — and makes 3am debuggable.

---

## Phase 11 — Testing

Java's testing stack is mature and opinionated. The skill gap in real teams is
not "can you write a test" — it is slice choice, mock discipline, and tests that
hit a real database instead of an in-memory impostor.

| Topic | Tier |
|---|---|
| **JUnit 5**: `@Test`, lifecycle (`@BeforeEach` — a fresh instance per test, unlike JUnit 4), assertions, `assertThrows`, display names — the anatomy of a test that documents behaviour | <span className="db-tier t-master">Master</span> |
| **AssertJ**: `assertThat(order.items()).hasSize(2).extracting(Item::sku).contains(...)` — fluent assertions whose failure messages do the debugging for you | <span className="db-tier t-understand">Understand</span> |
| Parameterized tests: `@ParameterizedTest`, `@CsvSource`, `@MethodSource` — one test, every edge of the tax calculation | <span className="db-tier t-understand">Understand</span> |
| **Mockito**: mocks vs stubs vs spies, `when`/`verify`, argument captors, `@Mock`/`@InjectMocks` — and the discipline: mock *boundaries* (repos, HTTP clients), never the class under test, never value objects | <span className="db-tier t-master">Master</span> |
| **The test pyramid in Spring**: pure unit tests (no context — milliseconds) vs slices (`@WebMvcTest`, `@DataJpaTest`) vs `@SpringBootTest` — why booting the full context for everything makes the suite a 20-minute build | <span className="db-tier t-understand">Understand</span> |
| Web-layer tests: `MockMvc` — asserting status, JSON body and validation errors without a server socket | <span className="db-tier t-understand">Understand</span> |
| **Testcontainers**: a real PostgreSQL in Docker per suite — the end of "passed on H2, failed on Postgres"; reuse and startup-cost control | <span className="db-tier t-understand">Understand</span> |
| Test data: builder pattern for aggregates, object mothers — fighting the 40-line setup block that makes tests unreadable | <span className="db-tier t-understand">Understand</span> |
| Coverage with JaCoCo — what the number means, what it can't (asserting nothing still counts), and coverage as a floor, not a target | <span className="db-tier t-know">Know</span> |
| Property-based testing (jqwik) — generating the inputs you didn't think of | <span className="db-tier t-when">When Needed</span> |
| Mutation testing (PIT) — testing the tests | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** the Phase 9/10 service covered three ways — controller
slice with `MockMvc`, repository test on Testcontainers Postgres, pure unit
tests for the domain — and the whole suite still runs in seconds.

---

## Phase 12 — The JVM in production

The payoff of Phase 0's mental model: memory, GC, and the observability tools
that come *with* the JVM. This is the phase that turns "the service is slow" from
a mystery into a flame graph.

| Topic | Tier |
|---|---|
| Memory layout: heap (young/old generations), metaspace, thread stacks — where an allocation lives and why "the heap is fine but the process grew" is still possible (native, metaspace, threads) | <span className="db-tier t-understand">Understand</span> |
| **GC in practice**: G1 (the default) vs generational ZGC (sub-millisecond pauses) vs Serial/Parallel — choosing by heap size and latency target, and reading a GC log without fear | <span className="db-tier t-understand">Understand</span> |
| **Heap sizing in containers**: `-Xmx`/`-Xms`, `MaxRAMPercentage`, container awareness — the OOMKilled loop caused by ignoring that the JVM is not the only thing in the cgroup | <span className="db-tier t-understand">Understand</span> |
| **`OutOfMemoryError`**: `HeapDumpOnOutOfMemoryError`, reading a dump in Eclipse MAT, dominator trees — and the usual suspects (unbounded caches, `ThreadLocal` in pools, listener leaks) | <span className="db-tier t-understand">Understand</span> |
| Thread dumps: `jstack`/`jcmd`, reading `BLOCKED`/`WAITING` states — the deadlock and the exhausted pool, diagnosed in two minutes | <span className="db-tier t-understand">Understand</span> |
| **JDK Flight Recorder + Mission Control**: always-on production profiling at ~1% overhead, and **async-profiler** flame graphs — finding the regex that ate a core | <span className="db-tier t-understand">Understand</span> |
| **Logging done right**: SLF4J façade over Logback, parameterized messages (`log.info("order {}", id)` — never string concat), **structured JSON logs**, **MDC** for request/trace ids on every line, levels used with intent | <span className="db-tier t-master">Master</span> |
| Metrics: **Micrometer** → Prometheus — RED metrics (rate, errors, duration) per endpoint, JVM metrics free from Actuator, and the histogram-vs-average lesson | <span className="db-tier t-understand">Understand</span> |
| Distributed tracing: OpenTelemetry auto-instrumentation — the request followed across service, database and queue | <span className="db-tier t-know">Know</span> |
| **Packaging for deploy**: layered Boot jars for Docker cache hits, `eclipse-temurin` JRE base images, non-root user, **AOT class loading/CDS (JEP 483, Project Leyden)** cutting startup | <span className="db-tier t-understand">Understand</span> |
| GraalVM **native image**: instant startup and low RSS vs closed-world limits (reflection config) and peak-throughput loss — where it pays (CLI tools, scale-to-zero) and where it doesn't | <span className="db-tier t-know">Know</span> |
| **Graceful shutdown**: SIGTERM → stop taking traffic → drain in-flight requests → close pools; Boot's `server.shutdown=graceful` and readiness-probe interplay | <span className="db-tier t-understand">Understand</span> |
| JVM flags that matter in 2026 — and the ones that stopped mattering (ergonomics got good); reading `-XX:+PrintFlagsFinal` when you must | <span className="db-tier t-know">Know</span> |
| Benchmarking honestly with **JMH** — why `System.nanoTime` around a loop measures the JIT, not your code (dead-code elimination, warmup) | <span className="db-tier t-know">Know</span> |
| Checkpoint/restore (CRaC) — startup in milliseconds by restoring a snapshot | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** for "p99 latency doubled after the deploy", you have an
ordered plan — metrics first, then GC log, then a flame graph, then a thread
dump — and can say what each would show if it were the culprit.

---

← Prev: [Part 3 — Application layer](03-application.md) · Next → [Part 5 — Distributed Java](05-distributed.md)
