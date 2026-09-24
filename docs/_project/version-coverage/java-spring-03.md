---
name: version-coverage-java-spring-03
description: java-spring version coverage §3 part 2 — delta table for the Boot 4.1 line (the pin), releases shipped beyond the pins, and Boot 4.2 / Framework 7.1 milestones
metadata:
  type: project
---
# Java — Spring stack version coverage — §3 part 2 (2026-09-24)

Continues `java-spring-02.md`, which holds the path shorthand, the source keys and the scope exclusions. §4–§5 are
in `java-spring-04.md`.

### L3 · Boot 4.1 / Security 7.1 / Data 2026.0 / Spring Kafka 4.1 / Flyway 12 / jOOQ 3.21 / Mockito 5.21–5.23 — latest stable (the pin)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| L3-01 | Boot 4.1 / Spring gRPC 1.1 | Boot supports gRPC servers and clients through Spring gRPC 1.1 (a 1.0 → 1.1 migration guide exists) | new | PLANNED | p14/README.md:34 row 06; syl/05-distributed.md:64. The phase spine still says 1.0.3 (§2c S3) | B41, GRPC |
| L3-02 | Boot 4.1 | `spring.jackson.read.*`/`write.*` return for format-agnostic features; `spring.jackson.factory.*`; `JsonFactoryBuilderCustomizer` | new | PARTIAL | p9/05-auto-configuration/01-what-a-starter-is.md:214 teaches only the 4.0 move to `spring.jackson.json.*`; the 4.1 keys and customizers have 0 hits | B41 |
| L3-03 | Boot 4.1 | `spring.config.import=…[encoding=utf-8]` | new | COVERED | p9/06-configuration-and-profiles/02-config-data-files-and-imports.md:106,228 | B41 |
| L3-04 | Boot 4.1 | HTTP-client cookie handling (`spring.http.clients.cookie-handling`, `withCookieHandling`) | new/default | PARTIAL | a single table cell, p14/04-sync-vs-async/04c-timeouts-in-spring.md:37 | B41 |
| L3-05 | Boot 4.1 | `InetAddressFilter` SSRF mitigation for HTTP clients | security | COVERED | p9/12-outbound-http/08-pinning-the-factory-tls-proxy.md:130-134,260 | B41 |
| L3-06 | Boot 4.1 | `@Async` context propagation, opt-in through `spring.task.execution.propagate-context` | new | COVERED | p9/13-actuator/15-observation-conventions-and-propagation.md:136-137,201 | B41, B41-OBS |
| L3-07 | Boot 4.1 | Observation conventions auto-applied to Kafka/Rabbit templates and listeners, and to JVM meters | new | PARTIAL | `ObservationConvention` beans are taught for HTTP (p9/10-the-request-pipeline/07-observability-and-correlation.md:34,117); the 4.1 auto-application is not | B41 |
| L3-08 | Boot 4.1 | `management.opentelemetry.enabled`, sampler, span/log limits, OTEL environment variables, OTLP exemplars and compression | new | MISSING | `management.opentelemetry`, `OTEL_` | B41 |
| L3-09 | Boot 4.1 | Resource server `jwt.authorities-claim-expressions` (SpEL) and `authority-prefix` | new | PARTIAL | named in a property list at p13/08-spring-security-resource-server/01-what-the-starter-gives-you.md:145-146; the SpEL mapping is never taught (the Keycloak converter is hand-written) | B41 |
| L3-10 | Boot 4.1 | `spring.datasource.connection-fetch=lazy` wraps the pool in `LazyConnectionDataSourceProxy` | new | PARTIAL | the proxy is wired by hand (p10/04-spring-transactional/07b-getting-the-connection-safely.md:258); the property has 0 hits | B41 |
| L3-11 | Boot 4.1 | `spring.data.jpa.repositories.bootstrap-mode` refined (`deferred` now needs an `AsyncTaskExecutor`); async `spring.jpa.bootstrap` | default/new | MISSING | `bootstrap-mode`, `spring.jpa.bootstrap` (the one hit is Spring Modulith's bootstrap mode) | B41 |
| L3-12 | Boot 4.1 / Data Redis 4.1 | `@RedisListener` / `@EnableRedisListeners` annotation-driven pub/sub | new | MISSING | `@RedisListener`, `@EnableRedisListeners` | B41, D260 |
| L3-13 | Boot 4.1 | Info endpoint `process.*` fields (uptime, startTime, timezone, locale, workingDirectory) | new | PARTIAL | the `process` contributor is listed (p9/13-actuator/16-info-and-the-catalogue.md:37); the new fields are not | B41 |
| L3-14 | Boot 4.1 | Constructor-bound `Optional` properties bind `Optional.empty()`, not `null` | default | **CONTRADICTED** | p9/06-configuration-and-profiles/06-defaults-and-validation.md:66-67 ("binds to `null` rather than to `Optional.empty()`") and 209. The 4.1 reference says an empty `Optional` is bound | B41, B41-EXT |
| L3-15 | Boot 4.1 | `layertools` jar mode removed → `tools` | removed | COVERED | p9/16-the-alternatives/07-choosing.md:55,176 | B41 |
| L3-16 | Boot 4.1 | `-DskipTests` no longer skips test AOT processing (use `maven.test.skip`) | tooling | MISSING | `maven.test.skip`, "skipTests…AOT" | B41 |
| L3-17 | Boot 4.1 / FW 7.1 | Derby integration deprecated (Apache Derby retired) | deprecated | MISSING | "Derby…deprecat" (Derby appears only in jOOQ edition lists) | B41, F71 |
| L3-18 | Boot 4.1 | Test additions: `@AutoConfigureWebServer`; `FailureAnalyzedException` | new | MISSING | `@AutoConfigureWebServer`, `FailureAnalyzedException` | B41 |
| L3-19 | Security 7.1 | `InetAddressMatcher`; `ConditionalAuthorizationManager`; programmatic MFA `when` conditions; `PreFlightRequestFilter` | new | MISSING | `InetAddressMatcher`, `ConditionalAuthorizationManager`, `PreFlightRequestFilter` | S71 |
| L3-20 | Security 7.1 | `RestClientOpaqueTokenIntrospector` | new | PARTIAL | opaque-token introspection auto-config is named (p13/08-…/01-what-the-starter-gives-you.md:97); its own chunk is still "*(not written yet)*" (p13/08-…/06-the-default-validators.md:139) | S71 |
| L3-21 | Data 2026.0 | Type-safe property paths (`PropertyPath.of(Person::getName)`, `Sort.by(Person::getFirstName)`) | new | MISSING | `PropertyPath.of`, `Sort.by(X::`, `PropertyReference` (only `PropertyReferenceException` hits) | D260 |
| L3-22 | Data 2026.0 | `@ProjectedPayload` now required on web projection parameters | removed | MISSING | `@ProjectedPayload` | D260, D251 |
| L3-23 | Data 2026.0 | Spring Data JDBC/R2DBC single-statement `upsert` | new | MISSING | `upsert(` in a JDBC context (every hit is MongoDB `upsert`) | D260 |
| L3-24 | Data 2026.0 | MongoDB `bulkWrite(Bulk)` across collections (needs MongoDB 8) | new | PARTIAL | `BulkOperations` is taught (p10/14-spring-data-other/03c-fluent-api-and-bulk-writes.md:92-169); the 5.1 `bulkWrite` API is not | D260 |
| L3-25 | Data 2026.0 | Redis compare-and-set for `SET`/`DEL`; `FLUSHDB` for `RedisCacheManager.resetCaches()` | new | MISSING | "CAS", `FLUSHDB`, `resetCaches` | D260 |
| L3-26 | Spring Kafka 4.1 | `@KafkaListener(ackMode = …)`; retry-topic default becomes `SINGLE_TOPIC`; Kafka Streams DLQ | new/default | PLANNED | p15/README.md:27 row 06; syl/05-distributed.md:92 | SK41 |
| L3-27 | Boot 4.1 | Flyway 11 → 12 (Boot 4.0 manages 11.14.1; 4.1 manages 12.4.0) | default | COVERED | the p10/11-flyway-migrations/ pages are verified on 12.4.0 (12-the-checklist.md:10) | BOM, FWY |
| L3-28 | Flyway 12.5 | `initSql` deprecated → `afterConnect` callback | deprecated | COVERED | p10/11-flyway-migrations/08b2-seeing-it-and-bounding-it.md:137-139 | FWY |
| L3-29 | jOOQ 3.21 | `Query::executeLarge`, `countLarge()` | new | MISSING | `executeLarge`, `countLarge` (the hits are JDBC's `executeLargeBatch`) | JQ321 |
| L3-30 | Mockito 5.21 | `mockStatic()` / `mockConstruction()` infer the class to mock | new | MISSING | `mockStatic()`, `mockConstruction()` (no-arg forms) | M5.21 |
| L3-31 | Mockito 5.21 | Unstubbed `Future`/`CompletionStage` methods return completed futures | default | MISSING | "completed future", "unstubbed…Future" | M5.21 |
| L3-32 | Mockito 5.22 | `mockSingleton` core API (Kotlin objects and singletons) | new | COVERED | p11/12-real-world-scenarios/02b-when-the-collaborator-is-hard-to-mock.md:13; 02e-the-agent-tax-and-the-decision-table.md:35,176 | M5.22 |

### L4 · Shipped beyond Boot 4.1's managed versions (JUnit 6.1, Mockito 5.24, Flyway 13, Resilience4j 2.4, Spring Cloud 2025.1.3)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| L4-01 | JUnit 6.1 | `@SetSystemProperty` / `@ClearSystemProperty` / `@RestoreSystemProperties` | new | COVERED | p11/01-junit-5/14i-process-globals-and-drift.md:56-91, framed as "not on the 6.0.3 spine" | J61 |
| L4-02 | JUnit 6.1 | `@DefaultLocale` / `@DefaultTimeZone` | new | COVERED | p11/01-junit-5/14i-process-globals-and-drift.md:93-95,204-206 | J61 |
| L4-03 | JUnit 6.1 | `@TempDir` deletion strategy (ignore deletion failures) | new | MISSING | "deletion strategy", `IGNORE_FAILURES` | J61 |
| L4-04 | JUnit 6.1 | `org.junit.start` module for compact source files | new | MISSING | `org.junit.start`, "compact source" | J61 |
| L4-05 | JUnit 6.1 | `ExecutionMode` for dynamic tests and containers (`dynamicTest(Consumer)`) | new | MISSING | `dynamicTest(` + `Consumer`, "ExecutionMode…dynamic" | J61 |
| L4-06 | JUnit 6.1 | Worker-thread-pool parallel executor (`junit.jupiter.execution.parallel.config.executor-service`) | new | MISSING | `WorkerThreadPool`, `executor-service`. Parallel execution is taught on the ForkJoin model at p11/01-junit-5/12-parallel-execution.md | J61 |
| L4-07 | JUnit 6.1 | `org.junit.jupiter.api.Constants` (the engine `Constants` class deprecated) | deprecated | MISSING | `org.junit.jupiter.api.Constants`, `engine.Constants` | J61 |
| L4-08 | JUnit 6.1 | `Arguments.of(Iterable)`, `argumentSetFrom`, `@EmptySource(type)` | new | MISSING | `Arguments.of(` + `Iterable`, `argumentSetFrom` (only `argumentSet(` hits) | J61 |
| L4-09 | JUnit 6.1 | `JRE.OTHER` deprecated → int `versions`/`min`/`max` attributes | deprecated | PARTIAL | the numeric attributes are mentioned at p11/01-junit-5/02b-what-junit-6-changed.md:195 | J61 |
| L4-10 | JUnit 6.1 | Experimental memory-cleanup mode; assertion stack-trace pruning (`AssertionFailureBuilder.trimStacktrace`) | new | MISSING | `memory.cleanup`, `trimStacktrace` | J61 |
| L4-11 | Mockito 5.24 | `spyStatic` | new | MISSING | `spyStatic` | M5.24 |
| L4-12 | Mockito 5.24 | `@Spy(mockMaker = …)` | new | MISSING | `@Spy(mockMaker` (only `@Mock(mockMaker = …)`, at p11/12-real-world-scenarios/02e-…:132) | M5.24 |
| L4-13 | Mockito 5.24 | Static-initialiser suppression through the agent (global and per package) | new | MISSING | "suppress…static", `clinit`. p11/12-real-world-scenarios/02b-when-the-collaborator-is-hard-to-mock.md:209 ("no mock can undo it") holds on the 5.23 pin, not on 5.24 with the agent | M5.24 |
| L4-14 | Flyway 13.4–13.5 | JSON and TOML support moved from `flyway-core` to `flyway-core-utilities`; `jackson-databind` becomes optional | removed | MISSING | `flyway-core-utilities`, "flyway…jackson", "flyway…TOML" | FWY |
| L4-15 | Flyway 13.2 | CockroachDB moved to its own module; report timestamps become `OffsetDateTime` | removed | MISSING | "CockroachDB" (jOOQ context only), `OffsetDateTime` + flyway | FWY |
| L4-16 | Resilience4j 2.4.0 | Spring Boot 4 / Spring Cloud 5 support; JDK 21 baseline | new/default | PLANNED | p16/README.md:24 row 03; syl/05-distributed.md:120. The phase target line still says Boot 3.x (§2c S1) | R4J |
| L4-17 | Spring Cloud 2025.1.3 | 17 CVE fixes: Config Server (4), Gateway gRPC SSRF, Function (6), Stream (5), Commons writable-env endpoint | security | PLANNED | syl/05-distributed.md:65,67; `CVE-2026` 0 hits | SC2513 |

### L5 · Toward the next line — Boot 4.2.0-M1 / Framework 7.1.0-M1 / Data 2026.1.0-M1 (GA November 2026)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| L5-01 | FW 7.1-M1 / Boot 4.2-M1 | `RestTemplate` formally `@Deprecated` (removal "scheduled for Spring Framework 8.0"); Boot deprecates `RestTemplateBuilder`, `TestRestTemplate` and the `MockRestServiceServer` auto-config | deprecated | PARTIAL | the "RestTemplate is deprecated" framing is present (p9/14-openapi-springdoc/03-generated-or-authored.md:128; p9/15-webflux-reactive/07-functional-endpoints-and-webclient.md:14). `@RestClientTest` + `MockRestServiceServer` is still taught with no 4.2 heads-up (p9/12-outbound-http/17-testing-outbound-calls.md) | F71, B42M1 |
| L5-02 | FW 7.1-M1 | HTTP `QUERY` method (RFC 10008) | new | MISSING | `RequestMethod.QUERY`, "RFC 10008" | F71 |
| L5-03 | FW 7.1-M1 | `MultipartHttpMessageConverter` reads and writes multipart; `AllEncompassingFormHttpMessageConverter` deprecated | new/deprecated | MISSING | `MultipartHttpMessageConverter`, `FormHttpMessageConverter` | F71 |
| L5-04 | FW 7.1-M1 | JAXB converter no longer auto-detected for server applications | default | MISSING | `JAXB`, `Jaxb2RootElement` | F71 |
| L5-05 | FW 7.1-M1 / Boot 4.2-M1 | `ForwardedHeaderFilter` must choose `Forwarded` or `X-Forwarded` (the default constructor is deprecated) | deprecated | MISSING | the filter is taught (p9/10-the-request-pipeline/06-what-spring-gives-you.md:128-142) without the choice | F71, B42M1 |
| L5-06 | FW 7.1-M1 | `DataBinder.disallowedFields` deprecated → `allowedFields` or constructor binding | deprecated | MISSING | p9/09-error-handling/05-controlleradvice.md:34 recommends `setDisallowedFields`, still valid on 7.0 | F71 |
| L5-07 | FW 7.1-M1 | `HandlerMappingIntrospector` removed, and with it the `CorsConfigurationSource` it implemented | removed | MISSING | `HandlerMappingIntrospector` | F71, F70 |
| L5-08 | Boot 4.2-M1 | AMQP 1.0 support; `spring-boot-starter-amqp` → `spring-boot-starter-rabbitmq` / `-amqp-rabbitmq` | new/removed | PLANNED | p15/README.md:23 row 02; syl/05-distributed.md:88 | B42M1 |
| L5-09 | Data 2026.1-M1 | Named repository queries validated at startup (`@Query(name/countName)`) | default | MISSING | `countName`, `@NamedQuery` | D261 |
| L5-10 | Data Redis 4.2 (2026.1-M1) | Redis JSON (`RedisJsonTemplate`) | new | MISSING | `RedisJsonTemplate`, "Redis JSON" | D261 |

Security 7.2.0-M1 has no row: no 7.2 *What's New* page was fetched this session. Boot 4.2.0-M2's preview notes
exist on the wiki, but the milestone was not published at fetch time, so they are not rowed.
