# Phase 11 · Testing — notes every fork in this phase must read

Target stack: **JUnit (Jupiter) · Mockito · AssertJ · Testcontainers**, on **JDK 25**,
**Spring Boot 4.1.1 / Spring Framework 7.0.9**.

## 🔴 THE VERSION SPINE — verified, do not re-derive and do not quote a project's front page

Read straight out of `spring-boot-dependencies:4.1.0`'s POM on Maven Central, 2026-08-27:

| | Managed by Boot 4.1.0 |
|---|---|
| **JUnit (Jupiter)** | 🔴 **6.0.3** — `org.junit:junit-bom:6.0.3` |
| Mockito | 5.23.0 |
| AssertJ | 3.27.7 |
| Testcontainers | 2.0.5 |
| Hamcrest · JSONassert · XMLUnit · Awaitility | 3.0 · 1.5.3 · 2.11.0 · 4.3.0 |

🔴🔴 **JUnit is at 6, not 5.** Topic 01's directory is `01-junit-5` and the phase README says
"JUnit 5"; **do not rename either** — the names are the ecosystem's own for the Jupiter
programming model and inbound links point at them. But **verify content against the JUnit 6
user guide and javadocs**, check which version any page you quote documents, and state the
reconciliation in topic 01's prose: a reader on Boot 4.1 resolves Jupiter 6 while every
tutorial says 5. Anything that is 5.x-only or was removed in 6 gets said explicitly, not
dropped silently.

## 🔴 The three facts that make most online samples wrong on this phase

1. 🔴 **Boot 4 removed `@MockBean` and `@SpyBean`.** They are `@MockitoBean` and
   `@MockitoSpyBean`, and they moved into Spring Framework itself
   (`org.springframework.test.context.bean.override.mockito`). **Every blog post and
   Stack Overflow answer about Spring test slices is stale on exactly this point.**
   Verify the package and behaviour against the Framework 7.0.x reference before writing
   a line of slice code. The wider bean-override mechanism (`@TestBean`) belongs here too.
2. 🔴 **There is NO Docker on this machine and NO sandbox.** Topic 07 · Testcontainers is
   documentation-validated like everything else: **no test-run output, no container logs,
   no timings, ever.** Java source code carries the pages.
3. ⚠️ **The phase README uses the tier class `t-when`** for topics 10 and 11, where the
   rest of devbible uses `t-when-needed`. **Match the phase README. Do not "fix" it
   mid-run** — it is a whole-corpus rename, not a phase-11 job.

## Boundaries inside the phase (fixed — a fork that crosses one duplicates another's work)

- **01 JUnit 5** owns the engine: lifecycle, assertions, `assertThrows`, nested/tagged
  tests, `@TempDir`, extensions, execution order and parallelism.
- **02 AssertJ** owns assertion *style* and failure messages. It does not re-teach JUnit.
- **03 Parameterized** owns `@ParameterizedTest` and every source. 01 names it and hands off.
- **04 Mockito** owns mocking: stubbing, verification, argument captors, strictness,
  `@Mock`/`@InjectMocks`, and the "never mock the class under test" argument.
  🔴 **`@MockitoBean` in a Spring slice belongs to 05**, not 04 — 04 is plain Mockito.
- **05 The pyramid** owns slice choice: unit vs `@…Test` slices vs `@SpringBootTest`, the
  context cache, `@DirtiesContext`, `@MockitoBean`/`@TestBean`, and suite runtime.
- **06 MockMvc** owns the web layer: `@WebMvcTest`, `MockMvcTester`/`MockMvc`, JSON
  assertions, validation errors, security in a slice. ⚠️ Verify what Boot 4.1 recommends —
  `MockMvcTester` (AssertJ-based) landed in Framework 6.2 and is the current idiom.
- **07 Testcontainers** owns real dependencies in tests: `@ServiceConnection`, the
  singleton pattern, reuse, `@DynamicPropertySource` (what it replaced), and the
  "passed on H2" argument. Links to Phase 10 topic 05's testing chunk rather than
  repeating it — `ls ../phase-10-data-access/05-sql-first-access/` first.
- **08 Test data** owns builders, object mothers, fixtures and `@Sql`.
- **09 JaCoCo** owns coverage as a floor, not a target; the Maven/Gradle wiring; branch vs
  line coverage; and what the number cannot say.
- **10 jqwik** owns property-based testing. **11 PIT** owns mutation testing — and 11 is
  the honest answer to 09's "what the number cannot say".

## Phase gate (from the README — the phase must actually deliver this)

The Phase 9/10 service covered three ways — controller slice with `MockMvc`, repository
test on Testcontainers PostgreSQL, pure unit tests for the domain — and the whole suite
still runs in seconds.
