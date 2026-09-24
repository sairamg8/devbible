---
name: research-java-p11-t12-verified-quotes
description: Banked primary-source quotes for Java phase 11 topic 12 (real-world testing scenarios) — Spring cache internals, MockRestServiceServer matchers, Mockito inline mock maker, JDK HttpClient timeout types, RFC 9110 retry rules, Stripe idempotency. Plus a Boot 4.1 documentation bug worth knowing before writing any Boot 4 slice page.
metadata:
  type: reference
---

# Java · Phase 11 topic 12 — verified quotes, banked 2026-09-01

Collected by fork B of the 2026-09-01 run ([[progress-java-p11-run-20260901]]) while writing
`02d`–`02e`, `03d`–`03f2` and the `09` caching/idempotency band. **Every line here was read from
the primary source at a pinned version**, not from a blog. Reuse rather than re-deriving.

## 🔴 A Boot 4.1 documentation bug — check this before writing any Boot 4 slice page

**Boot 4.1.0's own reference contradicts its own source on `@AutoConfigureCache`.**
`reference/pages/io/caching.adoc` @ `v4.1.0` writes the prose macro as
`org.springframework.boot.test.autoconfigure.core.AutoConfigureCache`, while the compiled code
sample it includes imports `org.springframework.boot.cache.test.autoconfigure.AutoConfigureCache`
— which matches the real source path
`module/spring-boot-cache-test/src/main/java/org/springframework/boot/cache/test/autoconfigure/AutoConfigureCache.java`.
**The prose macro is the stale Boot 3 location; the code sample is right.** This is the same
class of trap as the `@MockBean` → `@MockitoBean` move: Boot 4 relocated test autoconfiguration
into per-module packages, and the reference prose has not caught up everywhere. Write the package
from the source tree, not from the prose.

## Spring cache — `v7.0.8` source and reference

- `NoOpCacheManager`: *"This implementation will simply accept any items into the cache, not
  actually storing them."*
- Reference, *cache/strategies.adoc*: *"This approach works only for methods that are guaranteed
  to return the same output (result) for a given input (or arguments) no matter how many times
  they are invoked."* — and, on `sync = false`: *"No locks are applied, and several threads may
  try to load the same item concurrently."*
- Reference, *cache/annotations.adoc*, the default key generator: *"If only one parameter is
  given, return that instance."* 🔴 **This is the source of the two-methods-one-cache-name key
  collision** — two single-argument methods sharing a cache name share a key space.
- `Cache.get(Object)`: *"A straight `null` being returned means that the cache contains no
  mapping for this key."*

## `MockRestServiceServer` matchers — Framework 7.0.x

- `ContentRequestMatchers.json(String)` is *"…with a lenient checking (extensible, and non-strict
  array ordering)."* `json(String, boolean)` is **deprecated since 6.2**.
- `JsonCompareMode` has exactly **two** constants, `STRICT` and `LENIENT` (verified in the javadoc
  *and* in `spring-test/.../test/json/JsonCompareMode.java` @ `v7.0.8`).
- 🔴 **The JSON null-vs-absent problem in four method names**, from `JsonPathRequestMatchers`:
  `exists()` = *"a **non-null** value exists"*; `hasJsonPath()` = *"a value, **possibly null**,
  exists"*; `doesNotHaveJsonPath()` = *"a value, including null values, does not exist"*.
- `ResponseCreator` is `ClientHttpResponse createResponse(ClientHttpRequest) throws IOException`,
  and `DefaultRestClient` does `catch (IOException ex) → createResourceAccessException(...)` —
  which is what makes **in-process fault injection legitimate and source-verified** rather than a
  trick.

## Mockito 5.23.0 — `Mockito.java` javadoc sections

- §32: *"Please note that in most scenarios a mock returning a mock is wrong."*
- §47: *"inline mocking causes memory leaks. There is no clean way to mitigate this problem
  completely."*
- §50: `mock-maker-proxy` *"limits mocking to interfaces"*.
- §53: `@Mock(mockMaker = MockMakers.SUBCLASS)` for opting one mock out of inline.
- `InlineDelegateByteBuddyMockMaker` **source strings** (not console output): static mocking is
  already registered in the current thread → the existing static mock registration must be
  deregistered. This is the thread-locality of `mockStatic` made concrete.
- ⚠️ **The javadoc quantifies no timing for the inline mock maker.** Fork B wrote the cost
  itemised mechanically (agent flag, thread-locality, documented leak, review invisibility) with a
  banner saying there are no timings because none could be measured or cited. Keep that honesty.
- **PowerMock is effectively dead**: newest Maven Central release of `org.powermock:powermock-core`
  is **2.0.9, 2020-11-01** (queried via the Solr API).

## JDK 25 HttpClient — the never-sent / maybe-processed distinction

`HttpConnectTimeoutException` is *"Thrown when a connection … is not successfully established"*;
`HttpTimeoutException` is *"Thrown when a response is not received"*. 🔴 **The trap is the
hierarchy**: `HttpConnectTimeoutException extends HttpTimeoutException extends IOException`, so
catching the general one first swallows the specific one — and the two mean opposite things for
whether a retry is safe.

## Retry and idempotency — RFC 9110 §9.2.2 and Stripe

- RFC 9110 §9.2.2: *"A client SHOULD NOT automatically retry a request with a non-idempotent
  method unless it has some means to know that the request semantics are actually idempotent…"*
  and *"A proxy MUST NOT automatically retry non-idempotent requests. A client SHOULD NOT
  automatically retry a failed automatic retry."*
- Stripe's idempotency documentation (the de-facto reference implementation): it saves *"the
  resulting status code and body of the first request … Subsequent requests with the same key
  return the same result, including 500 errors"*; it *"compares incoming parameters to those of
  the original request and errors if they're not the same"*; *"We save results only after the
  execution of an endpoint begins."* Keys are pruned after 24 hours.
- ⚠️ **`Idempotency-Key` is convention, not standard.** The IETF draft is **expired**, version 07,
  2025-10-15.

## Jakarta Persistence 3.2 — why catching a duplicate key inside the transaction fails

> *"All instances of `PersistenceException`, except for instances of `NoResultException`,
> `NonUniqueResultException`, `LockTimeoutException`, and `QueryTimeoutException`, cause the
> current transaction, if one is active and if the persistence context has been joined to it, to
> be marked for rollback."*

🔴 This is why the insert-first idempotency pattern cannot catch its own duplicate-key violation
inside the same transaction and carry on — the transaction is already rollback-only.

## Fork C's bank — async, scheduling, messaging, JSON contracts, legacy seams

- 🔴 **Same assertion, opposite defaults.** `ContentResultMatchers.json(String)`: *"Parse the
  expected and actual strings as JSON and assert the two are 'similar' … with a lenient checking
  (extensible, and non-strict array ordering). Use of this matcher requires the JSONassert
  library."* — but `AbstractJsonContentAssert.isEqualTo(CharSequence)`: *"Verify that the actual
  value is strictly equal to the given JSON."* Two Spring JSON assertions, opposite strictness.
- **JSONassert `JSONCompareMode`**: *"Each mode encapsulates two underlying behaviors:
  extensibility and strict ordering."* Four modes exist; Spring's `JsonCompareMode` exposes only
  `STRICT`/`LENIENT`, so `NON_EXTENSIBLE` needs `JsonAssert.comparator(JSONCompareMode)`.
- 🔴 **Spring and the JDK disagree on what a throwing repeated task does.**
  `TaskUtils.LOG_AND_SUPPRESS_ERROR_HANDLER`: *"This will suppress the error so that subsequent
  executions of the task will not be prevented."* JDK `scheduleAtFixedRate`: *"Subsequent
  executions are suppressed."* Spring's handler wins for `@Scheduled`.
- **Awaitility `pollInSameThread()`**: *"Instructs Awaitility to execute the polling of the
  condition from the same as the test"* — i.e. **the default polls on another thread**, which is
  why a condition touching a thread-bound resource can fail confusingly.
- **`ApplicationEvents`**: *"cannot be accessed outside the lifecycle of a test method and cannot
  be `@Autowired` into the constructor of a test class."*
- **Jakarta Messaging 3.1 `getJMSRedelivered`**: *"it is likely, but not guaranteed, that this
  message was delivered earlier"* — so it is a hint, never a correctness signal.
- **Spring AMQP**: *"by default, a message that is rejected or rolled back because of a business
  exception can be redelivered endlessly"*, and `defaultRequeueRejected=false` *"causes all failed
  messages to be discarded"*. Two defaults, both wrong for most systems.
- **Spring Kafka**: `DefaultErrorHandler`'s default back-off is `FixedBackOff(0L, 9)`.
- **Framework 7 Resilience**: *"total attempts = 1 initial attempt + `maxRetries` attempts"*,
  defaults 3 retries / 1 s, and `@Retryable` requires `@EnableResilientMethods`.
- **JLS SE25 §13.1**: *"If such a field is `static`, then no reference to the field should be
  present in the code in a binary file"* — why reflection cannot change a `static final` constant.

## 🔴 Two summariser errors caught by reading raw sources — a standing warning

Both were produced by a documentation summariser and both were wrong. **Fetch summaries are a
lead, never a citation.**

1. *"`@EnableAsync`/`@EnableScheduling` are NOT required — Spring Boot auto-configures the
   infrastructure automatically."* **False.** The Boot page ties the auto-configured executor to
   *"execution of asynchronous tasks using `@EnableAsync`"* and says *"a scheduler can also be
   auto-configured if it needs to be associated with scheduled task execution (using
   `@EnableScheduling` for instance)"*.
2. The Kafka dead-letter suffix, conflating `@RetryableTopic`'s with
   `DeadLetterPublishingRecoverer`'s. The current `DeadLetterPublishingRecoverer` javadoc says
   `"-dlt"`. The suffix is a default that has not always been the same string — configure it
   explicitly.

## Three claims deliberately left unresolved in-page

1. **Redirect-loop behaviour** — no single Spring-level exception type covers redirect exhaustion
   across Apache / Jetty / Reactor Netty / JDK clients. `03f2` says so and tells the reader to
   assert termination plus their own failure type, bounded with `@Timeout`, never a cause class.
2. **Inline mock maker cost** — no documented numbers; see above.
3. **`sync = true`** — a two-thread test asserts a scheduling outcome and can pass with the
   annotation deleted, so `09a2` declines to write one and routes it to configuration review or a
   load test instead.

See [[progress-java-p11-run-20260901]] for the run, [[java-board]] for claim state.

---

# Phase 11 topic 11 (pitest) — fork A's banked facts, 2026-09-01

Read from pitest 1.30.0 **source at a version tag** and from its own documentation, not
paraphrased. Reuse rather than re-deriving.

- 🔴 **`PercentageCalculator.getPercentage` caps integer percentages at 99** —
  `Math.min(99, Math.round(...))` — unless `total == actual`, and returns **100 when
  `total == 0`**. So a reported 100 means *every* mutant was detected, and **a scope containing
  zero mutants also scores 100**. That second case is how an empty or mis-globbed scope passes a
  gate.
- **`maxSurviving` counts `NO_COVERAGE` mutants as survivors** —
  `getTotalSurvivingMutations()` is total minus detected. It is **undocumented on both quick-start
  pages** (it exists on `PitMojo` with `defaultValue = "-1"`).
- **The four gates fire in a fixed order** — test strength, mutation score, `maxSurviving`,
  coverage — and each throws, so **only the first failure is ever reported**. A percentage
  threshold of `0` disables that gate; `maxSurviving = 0` is the strictest gate available.
- 🔴 **Pitest's own docs argue against their own default.** The *integer threshold blind spot*
  section works through four numbered cases and concludes *"up to ~100 lines of coverage can
  silently drift"*. `thresholdPrecision` fixes it on Maven — and **the Gradle plugin has no
  `thresholdPrecision` at all**; all three thresholds are `Property<Integer>`.
- **`numberOfTestsRun` appears in the XML report only** — not CSV, not HTML.
- **Incremental analysis** — *"With the exception of 4), all these optimisations introduce a
  degree of potential error into the analysis"*, and *"If `withHistory` is true, the history input
  and output file location parameters are ignored."*
- ⚠️ **`gradle-pitest-plugin` pins `DEFAULT_PITEST_VERSION = '1.22.1'`** against engine 1.30.0 —
  predating the JaCoCo (1.25.7), Quarkus (1.25.6), timeout (1.25.5) and Java 25 `BigInteger`
  (1.25.8) fixes. **Set the pitest version explicitly on Gradle.**
- **`NULLFINALS`** — `Feature.named("NULLFINALS").withOnByDefault(true)`, *"Filters equivalent
  mutations to null final field assignments"*, in `build/intercept/equivalent`.
  `NullFinalFieldAssignmentFilter` matches, **inside `<init>`/`<clinit>` only**, an `ACONST_NULL`
  followed by a `PUTFIELD`/`PUTSTATIC` on a `final` field. It is the **fourth** equivalence filter
  and was missing from the filter inventory chunk until 2026-09-01.

## Three claims stated as uncertain rather than guessed

1. **`EQUIVALENT` has no assigning code path** findable in the 1.30.0 open-source engine —
   `MutationStatusMap` sets only `NOT_STARTED`/`NO_COVERAGE`. The commercial-plugin hypothesis is
   named in-page **as a hypothesis**.
2. **`DisableJacocoTransformer`'s scope** — it matches exactly `org/jacoco/core/instr/Instrumenter`,
   while the JaCoCo agent's classes are relocated to `org.jacoco.agent.rt.internal_*`. The pages
   say what the source does and decline to claim it covers every JaCoCo deployment shape.
3. **Adapter behaviour on JUnit Platform 6.0.3** — classpath *resolution* provably works
   (`autoAddJUnitPlatformArtifact` resolves the launcher at the version it finds engine/commons
   at, and JUnit 6 publishes all Platform artifacts at 6.0.3, verified on Central). The pages say
   plainly that this does not prove *behaviour*, and point at `dryRun`.
