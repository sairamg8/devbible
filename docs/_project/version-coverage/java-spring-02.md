---
name: version-coverage-java-spring-02
description: java-spring version coverage §3 part 1 — delta table for the Boot 3.5 LTS line and the Boot 4.0 / Framework 7.0 / Security 7.0 line
metadata:
  type: project
---
# Java — Spring stack version coverage — §3 part 1 (2026-09-24)

Continues `java-spring.md` (§1–§2). §3 continues in `java-spring-03.md`; §4–§5 are in `java-spring-04.md`.

## §3 · The delta table

**Path shorthand** (all under `docs/java/`): `p9` = `pages/phase-9-spring-boot`, `p10` = `pages/phase-10-data-access`,
`p11` = `pages/phase-11-testing`, `p13` = `pages/phase-13-oauth2-oidc`, `p14` = `pages/phase-14-microservice-architecture`,
`p15` = `pages/phase-15-messaging-event-driven`, `p16` = `pages/phase-16-resilience-operations`, `syl` = `syllabus`.
Every MISSING row lists the grep terms tried, case-insensitive, over all eight unit dirs.

**Sources** (every one fetched 2026-09-24):

| Key | Source |
|---|---|
| B35 · B40 · B40M · B40C · B41 · B42M1 | Boot wiki: *Spring-Boot-3.5-Release-Notes*, *-4.0-Release-Notes*, *-4.0-Migration-Guide*, *-4.0-Configuration-Changelog*, *-4.1-Release-Notes*, *-4.2.0-M1-Release-Notes* |
| B41-EXT · B41-OBS | docs.spring.io/spring-boot/4.1/reference/features/external-config.html (vs the 4.0 page) · …/4.1/reference/actuator/observability.html |
| F62 · F70 · F71 · FW-REF | Framework wiki *Spring-Framework-6.2/7.0/7.1-Release-Notes* (7.1 is a preview page) · docs.spring.io/spring-framework/reference/7.0/web/webmvc/mvc-controller/ann-requestmapping.html |
| S65 · S70 · S71 · S70M · SEC-JD | docs.spring.io/spring-security/reference/{6.5,7.0,7.1}/whats-new.html · 7.0 migration pages (index, servlet/oauth2, servlet/authorization) · the current `HttpSecurity` javadoc |
| D250 · D251 · D260 · D261 | spring-data-commons wiki *Spring-Data-2025.0/2025.1/2026.0/2026.1-Release-Notes* |
| J512 · J513 · J60 · J61 | docs.junit.org/{5.12.0,5.13.0,6.0.0,current}/release-notes/ |
| M5.19 … M5.24 | GitHub `mockito/mockito` releases v5.19.0–v5.24.0 |
| TC20 · TC-REL | GitHub `testcontainers-java` release 2.0.0 · releases 2.0.1–2.0.5 |
| FWY · JQ320 · JQ321 | Redgate *Release notes for Flyway Engine* · GitHub `jOOQ` release bodies version-3.20.0 / version-3.21.0 |
| SC250 · SC251 · SC2513 · FEIGN | GitHub `spring-cloud-release` v2025.0.0 · wiki *Spring-Cloud-2025.1-Release-Notes* · GitHub v2025.1.3 · docs.spring.io/spring-cloud-openfeign/reference/ |
| SK40 · SK41 · R4J · GRPC | Spring Kafka reference 4.0/4.1 *What's new* · GitHub `resilience4j` v2.4.0 · GitHub `spring-grpc` releases + api.spring.io/projects/spring-grpc |
| BOM · MC | `spring-boot-dependencies` 3.5.16/4.0.8/4.1.1 POMs · Maven Central starter POMs at 4.1.1 |

**Out of scope** — the unit has no page and no plan for these, so their changes are not rows: Kotlin-only changes,
GraalVM hints, Spring Batch, Spring Session, Pulsar, Couchbase/Cassandra/Neo4j/Elasticsearch/LDAP, SAML/Kerberos,
GraphQL, Buildpacks and build-plugin changes, Log4j/Logback, Quartz, JMS listener containers, Spock. The Spring
Cloud Netflix/Contract/Config specifics that `p14/_PHASE-NOTES.md` lists are **not** rowed individually: the 2025.1
release notes fetched here do not itemise them, so they stay unverified. Only the train-level change is a row.

### L1 · Boot 3.5 / Framework 6.2 / Security 6.5 / Data 2025.0 / JUnit 5.12–5.13 / jOOQ 3.20 — the de-facto LTS line

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| L1-01 | FW 6.2 | `@Fallback` beans, the companion to `@Primary` | new | COVERED | p9/03-dependency-injection/06-primary-fallback-and-custom-qualifiers.md:2,17 | F62 |
| L1-02 | FW 6.2 / Boot 3.5 | Background bean initialisation `@Bean(bootstrap = BACKGROUND)`; Boot 3.5 auto-configures `bootstrapExecutor` | new | MISSING | `Bean\(bootstrap`, `BACKGROUND`, `bootstrapExecutor`, "background initiali[sz]ation" | F62, B35 |
| L1-03 | FW 6.2 | Placeholder parser rewritten: `\${…}` escaping; keys containing `:` must be escaped | new/default | MISSING | "escape…placeholder", `\\${`, "escape character" (hits are Spring Data `LIKE` escaping only) | F62 |
| L1-04 | FW 6.2 | Autowiring: parameter-name and `@Qualifier` matches now beat `@Priority`; deeper generic matching; `void` and `@Autowired` `@Bean` methods rejected | default | PARTIAL | `@Priority` is taught as ordering only (p9/03-dependency-injection/06-primary-fallback-and-custom-qualifiers.md:83,182-183). The 6.2 precedence flip and the strict `@Configuration` validation are not stated | F62 |
| L1-05 | FW 6.2 | Bean-definition overriding is now logged at INFO and discouraged | default | PARTIAL | Boot's `allow-bean-definition-overriding=false` is taught (p9/02-the-ioc-container/09-configuration-classes.md:180,253); the Framework's INFO log is not named | F62 |
| L1-06 | FW 6.2 | `MockMvcTester` — AssertJ-based MockMvc | new | COVERED | p11/06-mockmvc/03-mockmvctester.md; used in 39 files | F62 |
| L1-07 | FW 6.2 / Boot 3.4 | Test bean overriding moves into Framework: `@MockitoBean`, `@MockitoSpyBean`, `@TestBean` (Boot's `@MockBean` removed in 4.0) | new/deprecated | COVERED | p11/05-the-test-pyramid/06-bean-overriding.md:19-30,155-170. Nuance: p9/03-dependency-injection/04-field-injection.md:163,252 call it "the Boot 4 rename", hiding that it has existed since 6.2 | F62, B40M |
| L1-08 | FW 6.2 | `DynamicPropertyRegistrar` beans | new | COVERED | p11/05-the-test-pyramid/07b-profiles-and-dynamic-properties.md:2,15 | F62 |
| L1-09 | FW 6.2 | Constructor binding to `List`/`Map`/arrays; header values bound to `@ModelAttribute` | new | MISSING | "constructor binding…List/Map", "@ModelAttribute…header" | F62 |
| L1-10 | FW 6.2 | HTML fragment rendering (htmx, Turbo) | new | MISSING | `FragmentsRendering`, "fragment rendering", "htmx" | F62 |
| L1-11 | FW 6.2 | `@ExceptionHandler(produces = …)` content negotiation | new | COVERED | p9/09-error-handling/04-handler-signatures.md:148-154 | F62 |
| L1-12 | FW 6.2 | RFC 3986 and WHATWG URL parsers (`UriComponentsBuilder.fromUriString(uri, ParserType)`) replace the regex parser behind CVE-2024-22262 | security | MISSING | `ParserType`, `WHAT_WG`, "RFC 3986 parser" | F62 |
| L1-13 | FW 6.2 | `UrlHandlerFilter` for the trailing-slash transition | new | PARTIAL | a single table row at p9/10-the-request-pipeline/06-what-spring-gives-you.md:132; the trailing-slash gotcha (p9/07-rest-controllers/01-the-controller-and-the-pipeline.md:190-193) does not point to it | F62 |
| L1-14 | FW 6.2 | `RestClient`: `retrieve()` with no terminal operation is now a **no-op** (it used to fire the request) | default | **CONTRADICTED** | p9/12-outbound-http/09-the-pool-is-the-real-limit.md:102-117,129-134 presents the bare `retrieve()` as a connection leak ("the response is never completed"). On 6.2+/7.0 the request is never sent | F62 |
| L1-15 | FW 6.2 | `@Scheduled` and `@DurationFormat` accept simple durations ("30s", "2h30m") | new | MISSING | `@Scheduled(fixed…="30s")`, `DurationFormat`, "simple duration". `@Scheduled` is taught with `cron` only (p9/06-configuration-and-profiles/08-typed-properties-vs-value.md:116-122) | F62 |
| L1-16 | FW 6.2 / Boot 3.5 | `TaskDecorator` also applies to scheduled tasks and the auto-configured `taskScheduler` | new | PARTIAL | taught for executors only (p9/10-the-request-pipeline/10-threads-scope-and-async.md:91-100) | F62, B35 |
| L1-17 | FW 6.2.19 / 7.0.8 | SpEL evaluation capped at 10,000 operations by default (`maxOperations`) | security | MISSING | `maxOperations`, "SpEL…limit", "10,000" | F62, F70 |
| L1-18 | Boot 3.5 | Actuator `heapdump` defaults to `access=NONE` | security | COVERED | p9/13-actuator/18-locking-it-down.md:22,48 | B35 |
| L1-19 | Boot 3.5 | `.enabled` properties must be `true`/`false`; profile names validated | default | PARTIAL | profile validation is taught (p9/06-configuration-and-profiles/11-profiles.md:153-156); the boolean tightening is missing ("true or false", `.enabled` must be) | B35 |
| L1-20 | Boot 3.5 | Only the `applicationTaskExecutor` bean name is published (the `taskExecutor` alias is gone) | removed | PARTIAL | the right name is used (p9/10-the-request-pipeline/10-threads-scope-and-async.md:97; p11/12-real-world-scenarios/07a-waiting-without-sleeping.md:43) but the removed alias is never mentioned | B35 |
| L1-21 | Boot 3.5 | `@ServletRegistration` / `@FilterRegistration` annotations | new | COVERED | p9/10-the-request-pipeline/08-registration-and-ordering.md:82 | B35 |
| L1-22 | Boot 3.5 | `spring.config.import=env:VAR` loads many properties from one env var | new | COVERED | p9/06-configuration-and-profiles/02-config-data-files-and-imports.md:107,229 | B35 |
| L1-23 | Boot 3.5 | Structured-logging stack-trace customisation `logging.structured.json.stacktrace.*`; ECS nested JSON | new | MISSING | `logging.structured`, "structured logging" (2 passing mentions). Structured logging itself is in phase 12, outside the unit (p12/07-logging-done-right/08-what-never-to-log.md:135) | B35 |
| L1-24 | Boot 3.5 | `ClientHttpConnectorBuilder` and global properties for `WebClient`; redirects now followed | new/default | PARTIAL | the builder is named (p9/12-outbound-http/08-pinning-the-factory-tls-proxy.md:94); the reactive-client properties and the redirect default are not | B35 |
| L1-25 | Boot 3.5 | Client SSL for service connections (`@Ssl`, `@PemKeyStore`… on Testcontainers/Compose) | new | PARTIAL | the annotations are named for Elasticsearch only (p11/07-testcontainers/07-beyond-postgres.md:149-150) | B35 |
| L1-26 | Boot 3.5 | `spring.task.execution.mode=force` keeps the auto-configured executor when a user `Executor` exists | new | MISSING | `spring.task.execution.mode`, "mode=force" | B35 |
| L1-27 | Boot 3.5 | `OTEL_SERVICE_NAME` / `OTEL_RESOURCE_ATTRIBUTES`; `service.namespace` from `spring.application.group` | new | MISSING | `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` | B35 |
| L1-28 | Boot 3.5 | OAuth2 client auto-configuration split (servlet/reactive, non-web) | new | PLANNED | p13/README.md:37 row 09 "Spring as OAuth2 client"; syl/05-distributed.md:36 | B35 |
| L1-29 | Boot 3.5 | `@ConditionalOnBooleanProperty`; `@ConditionalOnProperty` is repeatable | new | COVERED | p9/05-auto-configuration/06-property-and-environment-conditions.md:58-63 | B35 |
| L1-30 | Boot 3.5 | Bean conditions match generic `@Bean` return types | default | MISSING | "ConditionalOnMissingBean…generic", "generic…ConditionalOnMissingBean" | B35 |
| L1-31 | Boot 3.5 | `MethodValidationResult` errors in `ErrorAttributes`; `spring.validation.method.adapt-constraint-violations` | new | MISSING | `MethodValidationResult`, `adapt-constraint-violations` | B35 |
| L1-32 | Boot 3.5 | `spring.jooq.config` points at an external jOOQ `Settings` file | new | COVERED | p10/13-jooq/07-transactions-and-spring.md:43,174 | B35 |
| L1-33 | Boot 3.5 | `spring.data.redis.url` decides the database; `spring.data.redis.database` is ignored next to it | default | MISSING | `spring.data.redis.url`, `spring.data.redis.database` | B35 |
| L1-34 | Security 6.5 | DPoP-bound access tokens (resource server and client) | new/security | PARTIAL | DPoP is named as sender-constraining (p13/06-jwt-anatomy-and-validation/01-encoded-not-encrypted.md:194; 03d-kid-cty-and-crit.md:145), but no Spring configuration is shown | S65 |
| L1-35 | Security 6.5 | PKCE for confidential clients (`requireProofKey`) | security | PLANNED | the protocol is taught in p13/03-authorization-code-pkce/; the client configuration is p13/README.md:37 row 09 | S65 |
| L1-36 | Security 6.5 | One-time-token login; WebAuthn/passkeys with JDBC persistence | new | MISSING | `oneTimeTokenLogin`, "one-time token", `webAuthn`. Passkeys appear only as a concept (p13/01-why-oauth2-exists/01-the-password-anti-pattern.md:76-77) | S65 |
| L1-37 | Data 2025.0 | JPA: a string `@Query` is rewritten to a constructor expression for DTO projections | new | COVERED | p10/08-the-n-plus-1-problem/12c2-dto-projections-in-spring-data.md:2,20-21,74-88 | D250 |
| L1-38 | Data 2025.0 / 2025.1 | `Vector` type and vector search (JPA `search…Near`, `SearchResults`, `Score`, `Similarity`; Mongo `$vectorSearch`) | new | MISSING | `Vector.of`, `SearchResults<`, "vector search", `pgvector` | D250, D251 |
| L1-39 | JUnit 5.12 | Test output-file attachments (`TestReporter` files) | new | MISSING | `publishFile`, "file attachment" | J512 |
| L1-40 | JUnit 5.12 | Thread dump on timeout | new | COVERED | p11/01-junit-5/13c-timeout-configuration.md:122-129 | J512 |
| L1-41 | JUnit 5.13 | `@ParameterizedClass` / `@ClassTemplate` | new | COVERED | p11/03-parameterized-tests/08c-parameterized-classes.md (+31 files) | J513 |
| L1-42 | JUnit 5.13 | `@SentenceFragment` for `IndicativeSentences` | new | COVERED | p11/01-junit-5/06-naming-and-display-names.md:87-90 | J513 |
| L1-43 | JUnit 5.13 / 6.0 | Engines report discovery issues; invalid declarations can fail discovery | new | MISSING | "discovery issue", `junit.platform.discovery.issue` | J513, J60 |
| L1-44 | Mockito 5 on JDK 21+ | The inline mock maker's self-attach is restricted (JEP 451); configure Mockito as `-javaagent` | tooling | COVERED | p11/12-real-world-scenarios/02e-the-agent-tax-and-the-decision-table.md:54-64,217-220 | M5.24 (agent docs #3864/#3866/#3823) |
| L1-45 | jOOQ 3.20 / Boot 4.1 | The Open Source Edition's baseline is JDK 21; Boot 4.1 requires jOOQ 3.20+ | default | COVERED | p10/13-jooq/01b-the-licence-question.md:46,164; 08-jooq-vs-jpa.md:130 | JQ320, B41 |
| L1-46 | jOOQ 3.20 | JPA-annotation mapping in `DefaultRecordMapper` moved to `jOOQ-jpa-extensions`; `@ConstructorProperties` to `jOOQ-beans-extensions` | removed | MISSING | `jooq-jpa-extensions`, `jpa-extensions`, `DefaultRecordMapper` | JQ320 |
| L1-47 | jOOQ 3.20 | Dirty tracking can switch from "touched" to "modified" semantics | new | PARTIAL | changed flags are taught (p10/13-jooq/05b-updatable-records.md:55-67); the 3.20 `Settings` switch is not | JQ320 |

### L2 · Boot 4.0 / Framework 7.0 / Security 7.0 / Data 2025.1 / JUnit 6.0 / Testcontainers 2.0 / Cloud 2025.x / Kafka 4.0

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| L2-01 | Boot 4.0 | Modularised starters: `web`→`webmvc`, `web-services`→`webservices` (the old names are deprecated but still published) | deprecated | COVERED | p9/05-auto-configuration/01-what-a-starter-is.md:103-124 | B40M, MC |
| L2-02 | Boot 4.0 | The same rename, taught elsewhere as "`spring-boot-starter-web` does not resolve" | deprecated | **CONTRADICTED** | p9/01-why-frameworks-servlet-model/04-the-embedded-container.md:130-133 ("does not resolve on Boot 4"); p9/12-outbound-http/02-wiring-it-in-boot-4.md:41-43 ("no longer resolves"); p9/15-webflux-reactive/06-annotated-controllers.md:42 ("will not resolve"). `spring-boot-starter-web:4.1.1` is on Central, marked deprecated | B40M, MC |
| L2-03 | Boot 4.0 | `spring-boot-starter-aop` renamed `spring-boot-starter-aspectj`; no 4.x `aop` artifact exists | removed | COVERED | p9/10-the-request-pipeline/04-aop-at-the-web-boundary.md:13-14; p9/05-…/01-what-a-starter-is.md:114. Nuance: 01:120-123 groups it with starters that "still exist" (`spring-boot-starter-aop:4.1.1` is a 404) | B40M, MC |
| L2-04 | Boot 4.0 | OAuth2 starters renamed `spring-boot-starter-security-oauth2-{resource-server,client,authorization-server}` | deprecated | **CONTRADICTED** | p13/08-spring-security-resource-server/01-what-the-starter-gives-you.md:69,179,215 and p13/02-the-four-roles/06-mapping-onto-your-stack.md:128-130 teach the deprecated names as *the* starter. The new names appear nowhere (grep 0) | B40M |
| L2-05 | Boot 4.0 | "Classic" starters (`spring-boot-starter-classic`, `-test-classic`) as an upgrade bridge | new | COVERED | p9/05-…/01-what-a-starter-is.md:138-139 | B40M |
| L2-06 | Boot 4.0 | Per-technology test starters `spring-boot-starter-<tech>-test`; `@WithMockUser` needs `spring-boot-starter-security-test` | new | PARTIAL | the moved slice packages are covered (p11/05-the-test-pyramid/03c-the-slice-catalogue.md:27-70), and `restclient-test` is named (p9/05-…/01:203-207). But p11's "what you write in a Boot 4.1 project" is `spring-boot-starter-test` alone (p11/01-junit-5/02-the-architecture.md:93-101), and `webmvc-test`, `data-jpa-test` and `security-test` are never shown | B40M |
| L2-07 | Boot 4.0 | Third-party-only integrations now need a starter (`spring-boot-starter-flyway`, `-liquibase`) | new | COVERED | p10/11-flyway-migrations/07-boot-integration.md:27-36,166 | B40M |
| L2-08 | Boot 4.0 | Bean Validation no longer arrives transitively → `spring-boot-starter-validation` | default | COVERED | p9/08-validation/02-the-constraints.md:140; p9/05-…/01:134,174 | B40M |
| L2-09 | Boot 4.0 / FW 7.0 | Jackson 3 (`tools.jackson`, `JsonMapper`, `@JacksonComponent`/`@JacksonMixin`, `spring.jackson.json.*`, `use-jackson2-defaults`, `spring-boot-jackson2`) | new/removed | COVERED | p9/07-rest-controllers/09-jackson-3-what-changed.md:22,98; 10-shaping-the-json.md; 11-customising-serialisation.md | B40M, F70 |
| L2-10 | Boot 4.0 / FW 7.0 | JSpecify null-safety replaces `org.springframework.lang` | new/deprecated | COVERED | p9/03-dependency-injection/04-field-injection.md:98,197; 08-optional-and-deferred.md:14 | F70, B40M |
| L2-11 | Boot 4.0 / FW 7.0 | HTTP service clients auto-configured; `@ImportHttpServices` groups | new | COVERED | p9/12-outbound-http/04-http-interfaces.md; 05-http-service-groups.md | B40, F70 |
| L2-12 | FW 7.0 | API versioning (`ApiVersionConfigurer`, parser, deprecation handler) | new | COVERED | p9/07-rest-controllers/12-api-versioning.md:14-44; 13-versioning-strategy.md | F70 |
| L2-13 | Boot 4.0 | API-versioning auto-configuration via `spring.mvc.apiversion.*` / `spring.webflux.apiversion.*` | new | PARTIAL | the page configures versioning through `WebMvcConfigurer` only; `spring.mvc.apiversion` appears nowhere | B40 |
| L2-14 | FW 7.0 / Boot 4.0 | `RestTestClient` (+ `@AutoConfigureRestTestClient`) | new | COVERED | p11/05-the-test-pyramid/04b-webenvironment.md:84,134; p11/12-real-world-scenarios/05b-the-three-assertions-and-the-hedge.md:83,211 | F70, B40 |
| L2-15 | Boot 4.0 | `@SpringBootTest` no longer provides MockMvc, `TestRestTemplate` or `WebTestClient` (`@AutoConfigureMockMvc`, `@AutoConfigureTestRestTemplate`) | removed | COVERED | p9/12-outbound-http/17-testing-outbound-calls.md:133-137,209-213; p9/05-…/01:201-207 | B40M |
| L2-16 | Boot 4.0 | `@MockBean` / `@SpyBean` removed | removed | COVERED | p11/05-the-test-pyramid/06-bean-overriding.md:19,155-170 (+20 files) | B40M |
| L2-17 | Boot 4.0 | `MockitoTestExecutionListener` removed → `MockitoExtension` | removed | COVERED | p9/12-outbound-http/17-testing-outbound-calls.md:133,160,209 | B40M |
| L2-18 | Boot 4.0 / FW 7.0 | Undertow removed (Servlet 6.1 baseline) | removed | COVERED | p9/01-why-frameworks-servlet-model/04-the-embedded-container.md:103-109 | B40M, F70 |
| L2-19 | Boot 4.0 | Liveness and readiness probes on by default | default | COVERED | p9/13-actuator/05-liveness-and-readiness.md:15-16; p9/01-…/04:180 | B40M |
| L2-20 | Boot 4.0 | SSL health reports `expiringChains`; `WILL_EXPIRE_SOON` retired | default | COVERED | p9/13-actuator/03-health-properly.md:122-124 | B40 |
| L2-21 | Boot 4.0 | `@ConfigurationPropertiesSource` for properties types in other modules | new | COVERED | p9/06-configuration-and-profiles/07-registering-and-structuring.md:157-161 | B40 |
| L2-22 | Boot 4.0 | Several `TaskDecorator` beans compose into a `CompositeTaskDecorator` | new | MISSING | `CompositeTaskDecorator`, "multiple TaskDecorator" | B40 |
| L2-23 | Boot 4.0 | `spring-boot-starter-opentelemetry` | new | MISSING | `spring-boot-starter-opentelemetry`, `management.opentelemetry`. Phase 12, outside the unit, covers only the OTLP Micrometer registry | B40 |
| L2-24 | Boot 4.0 / FW 7.0 | `JmsClient` API and auto-configuration | new | MISSING | `JmsClient` — one unexplained code line (p9/12-outbound-http/14-retries-and-resilience.md:39) | B40, F70 |
| L2-25 | Boot 4.0 / FW 7.0 | Boot's `HttpMessageConverters` deprecated → `Client`/`ServerHttpMessageConvertersCustomizer`; Framework `configureMessageConverters(HttpMessageConverters.ServerBuilder)` | deprecated/new | MISSING | `ServerHttpMessageConvertersCustomizer`, `configureMessageConverters`, `HttpMessageConverters.ServerBuilder` | B40M, F70 |
| L2-26 | Boot 4.0 / 4.1 | DevTools LiveReload off by default (4.0), deprecated (4.1) | default/deprecated | MISSING | `livereload` (0 hits; devtools appears only as a property source) | B40M, B41 |
| L2-27 | Boot 4.0 | Optional dependencies left out of uber jars; `CLASSIC` loader and launch scripts removed | removed | MISSING | `includeOptional`, "launch script", `loaderImplementation`. Packaging is phase 12's, outside the unit | B40M |
| L2-28 | Boot 4.0 | `spring.dao.exceptiontranslation.enabled` → `spring.persistence.exceptiontranslation.enabled` | removed | **CONTRADICTED** | p10/05-sql-first-access/06b-the-translator-chain.md:135-138: "registers the post-processor under `spring.dao.exceptiontranslation.enabled`" | B40, B40M |
| L2-29 | Boot 4.0 | `@EntityScan` moves to `org.springframework.boot.persistence.autoconfigure` | removed | COVERED | p9/05-auto-configuration/02-what-springbootapplication-triggers.md:177 | B40M |
| L2-30 | Boot 4.0 | MongoDB properties `spring.data.mongodb.*` → `spring.mongodb.*`; UUID/`BigDecimal` defaults removed | removed/default | COVERED | p10/14-spring-data-other/01-one-idiom-many-stores.md:168-169; 02e-the-class-discriminator.md:166-229 | B40M, D251 |
| L2-31 | Boot 4.0 | `hibernate-jpamodelgen` → `hibernate-processor` | removed | MISSING | `jpamodelgen`, `hibernate-processor`. The static metamodel is used (p10/08-the-n-plus-1-problem/09-entity-graph.md:55) but its generation is never shown | B40M |
| L2-32 | Boot 4.0 | `management.tracing.enabled` → `management.tracing.export.enabled` | removed | MISSING | both property names 0 hits; tracing properties are taught at p9/10-the-request-pipeline/07-observability-and-correlation.md:143-165 | B40 |
| L2-33 | Boot 4.0 | `server.forward-headers-strategy` ignored for war deployments; a war needs `spring-boot-starter-tomcat-runtime` | default | PARTIAL | the strategy is taught (p9/10-the-request-pipeline/06-what-spring-gives-you.md:128-142,200-203) without the war caveat; `tomcat-runtime` 0 hits | B40M |
| L2-34 | Boot 4.0 | `spring-boot-properties-migrator` for the renames | tooling | COVERED | p9/12-outbound-http/07-configuring-timeouts-in-boot.md:62; 05-http-service-groups.md:131 | B40M |
| L2-35 | Boot 4.0 | `spring.http.client.*` → `spring.http.clients.*` | removed | COVERED | p9/12-outbound-http/07-configuring-timeouts-in-boot.md; 08-pinning-the-factory-tls-proxy.md:29,120 | B40C |
| L2-36 | Boot 4.0 | `EnvironmentPostProcessor` moved to `org.springframework.boot`; `PropertyMapper.always()` | removed | MISSING | `EnvironmentPostProcessor`, `PropertyMapper` | B40M |
| L2-37 | Boot 4.0 | Auto-configured JDK `HttpClient` uses virtual threads when `spring.threads.virtual.enabled` | default | COVERED | p9/15-webflux-reactive/11-why-virtual-threads-changed-the-answer.md:52 | B40 |
| L2-38 | FW 7.0 | Baselines: JDK 17 (25 recommended); Jakarta EE 11 — Servlet 6.1, JPA 3.2, Bean Validation 3.1; Hibernate 7.1/7.2 | default | COVERED | p9/01-why-frameworks-servlet-model/01-the-servlet-contract.md; p10/README.md:7-10 | F70 |
| L2-39 | FW 7.0 | `javax.annotation` / `javax.inject` support removed | removed | COVERED | p9/04-bean-scopes-lifecycle/04-lifecycle-callbacks.md:114-122,202 | F70 |
| L2-40 | FW 7.0 | Path-matching options removed: trailing-slash match, suffix-pattern match, path-extension content negotiation | removed | PARTIAL | trailing slash is covered (p9/07-rest-controllers/01-the-controller-and-the-pipeline.md:190-193); `suffixPatternMatch` and `favorPathExtension` 0 hits | F70 |
| L2-41 | FW 7.0 | `PathPattern` now allows `**` / `{*path}` at the **start** of a pattern (`/**/info`); `AntPathMatcher` deprecated for MVC | new/deprecated | **CONTRADICTED** | p9/07-rest-controllers/01-the-controller-and-the-pipeline.md:173-177 (`**` "permitted **only at the end**"; `{*path}` "must be the final segment") and 260-262 ("legal only as the final segment") | F70, FW-REF |
| L2-42 | FW 7.0 | `ListenableFuture` removed (use `CompletableFuture`, including Spring Data `@Async` query methods) | removed | MISSING | `ListenableFuture` (0 hits; nothing uses it) | F70, D251 |
| L2-43 | FW 7.0 | `HttpHeaders` no longer implements `MultiValueMap` | removed | MISSING | "HttpHeaders…MultiValueMap" | F70 |
| L2-44 | FW 7.0.9 | `SimpleEvaluationContext` no longer compiles SpEL by default | security | MISSING | `SimpleEvaluationContext`, `withCompilationSupported` | F70 |
| L2-45 | FW 7.0 | `SpringExtension` uses a test-method-scoped `ExtensionContext`; `@SpringExtensionConfig`; DI across `@Nested` hierarchies | default | MISSING | `SpringExtensionConfig`, `useTestClassScopedExtensionContext` (the `@Nested` hits are JUnit-internal) | F70 |
| L2-46 | FW 7.0 | `RestTemplate` deprecated in the reference (the formal `@Deprecated` lands in 7.1) | deprecated | COVERED | p9/15-webflux-reactive/07-functional-endpoints-and-webclient.md:14; p9/14-openapi-springdoc/03-generated-or-authored.md:128 | F70 |
| L2-47 | FW 7.0 | JUnit 4 support in the TestContext framework deprecated | deprecated | PARTIAL | `SpringJUnit4ClassRunner` is named as legacy (p11/01-junit-5/10-extensions.md:45); the 7.0 deprecation is not stated | F70 |
| L2-48 | FW 7.0 | Jackson 2 support deprecated (auto-detection off in 7.1) | deprecated | COVERED | p9/07-rest-controllers/09-jackson-3-what-changed.md:98 | F70 |
| L2-49 | FW 7.0 | `BeanRegistrar` programmatic bean registration | new | MISSING | `BeanRegistrar` | F70 |
| L2-50 | FW 7.0 | SpEL null-safe and Elvis operators on `Optional` | new | MISSING | "Optional…SpEL", "Elvis…Optional" | F70 |
| L2-51 | FW 7.0 | The CGLIB default applies to every proxy processor (including `@Async`); `@Proxyable` opts out | default | MISSING | `@Proxyable`, `DEFAULT_PROXY_CONFIG`. CGLIB is taught for `@Transactional` and security in 25 files, without the 7.0 unification | F70 |
| L2-52 | FW 7.0 | Core resilience: `RetryTemplate`, `@Retryable`, `@ConcurrencyLimit`, `@EnableResilientMethods` | new | COVERED | p9/12-outbound-http/14-retries-and-resilience.md; 15-retrying-safely.md:72-118; p9/15-webflux-reactive/04-errors-retries-cancellation.md:78 | F70 |
| L2-53 | FW 7.0 / Boot 4.0 | Spring Retry no longer managed; Kafka and AMQP retries move to the core retry | removed | COVERED | p9/12-outbound-http/README.md:81; 17-testing-outbound-calls.md:231 | B40M, F70 |
| L2-54 | FW 7.0 | JPA 3.2: `EntityManager`/`EntityManagerFactory` injectable with `@Autowired` plus qualifiers; `PersistenceConfiguration` | new | PARTIAL | shared-proxy injection through `@PersistenceContext` is taught (p10/06-jpa-hibernate-model/11-the-persistence-context.md:101,205-208); the 7.0 `@Autowired` path is not named | F70 |
| L2-55 | FW 7.0 | `orm.hibernate5` retired → `orm.jpa.hibernate`; injectable `StatelessSession` | removed/new | MISSING | `orm.hibernate5`, `orm.jpa.hibernate`, `LocalSessionFactoryBean` | F70 |
| L2-56 | FW 7.0 | `JdbcClient` statement settings (fetch size, max rows, query timeout) | new | COVERED | p10/05-sql-first-access/04-jdbcclient.md:140-141; 04b-the-result-specs.md:117 | F70 |
| L2-57 | FW 7.0 | HTTP interface clients stream `InputStream`/`OutputStream` bodies | new | MISSING | `StreamingHttpOutputMessage`, "InputStream…@GetExchange" | F70 |
| L2-58 | FW 7.0 | Test application-context pausing | new | COVERED | p11/05-the-test-pyramid/05c-context-pausing.md:2,148 | F70 |
| L2-59 | FW 7.0 | Bean overrides allowed on non-singleton beans | new | COVERED | p11/05-the-test-pyramid/06-bean-overriding.md:146 | F70 |
| L2-60 | FW 7.0 | CORS pre-flight no longer rejected when the CORS configuration is empty | default | MISSING | "pre-flight…empty"; CORS is taught at p9/11-spring-security/12-cors-for-an-spa.md without it | F70 |
| L2-61 | FW 7.0 | Reactor `WebClient` picks up the `https.proxyHost`/`https.proxyPort` system properties | default | MISSING | `https.proxyHost`, `proxyWithSystemProperties`. Proxy config is taught at p9/12-outbound-http/08-pinning-the-factory-tls-proxy.md without this default | F70, B41 |
| L2-62 | Security 7.0 | Lambda-only DSL: `and()` and `authorizeRequests()` removed | removed | COVERED | p9/11-spring-security/05-configuring-the-chain.md:24-52 | S70 |
| L2-63 | Security 7.0 | The no-arg configurer methods are gone: `oauth2ResourceServer().jwt()` does not compile | removed | **CONTRADICTED** | syl/05-distributed.md:35 lists "`oauth2ResourceServer().jwt()`" as the Master-tier skill; `HttpSecurity` has only the `Customizer` overload. The same form appears in prose at p13/08-spring-security-resource-server/01-what-the-starter-gives-you.md:219-220 | S70, SEC-JD |
| L2-64 | Security 7.0 | `AntPathRequestMatcher` / `MvcRequestMatcher` removed → `PathPatternRequestMatcher` | removed | PARTIAL | `requestMatchers(...)` is taught (p9/11-spring-security/05-configuring-the-chain.md:47-48); `PathPatternRequestMatcher` 0 hits | S70 |
| L2-65 | Security 7.0 | Multi-factor authentication (`@EnableMultiFactorAuthentication`, `FactorGrantedAuthority`) | new | PARTIAL | only the `FACTOR_BEARER` side effect on resource servers (p13/08-spring-security-resource-server/05d-step-7-surprises-and-the-debug-table.md:16,54,122-123,179-183) | S70 |
| L2-66 | Security 7.0 | `AuthorizationManager#check` removed → `authorize` returning `AuthorizationResult`; `AuthorizationManagerFactory`; `AllAuthoritiesAuthorizationManager` / `hasAllAuthorities` | removed/new | MISSING | `AuthorizationManagerFactory`, `hasAllAuthorities`, `AllAuthoritiesAuthorizationManager`, `.authorize(` | S70 |
| L2-67 | Security 7.0 | Access API (`AccessDecisionManager`/`Voter`) moved to `spring-security-access` | removed | MISSING | `spring-security-access`, `AccessDecisionManager` (nothing uses it, so there is no contradiction) | S70M |
| L2-68 | Security 7.0 | `csrf.spa()` | new | COVERED | p9/11-spring-security/13-csrf-decisions.md:148-151,199,260 | S70 |
| L2-69 | Security 7.0 | Password4j-backed password encoders | new | COVERED | p9/11-spring-security/11-password-encoding.md:101-102 | S70 |
| L2-70 | Security 7.0 | Password-grant support removed | removed | COVERED | p13/03-authorization-code-pkce/README.md:99-101 (the protocol-level MUST NOT) | S70 |
| L2-71 | Security 7.0 | OAuth2 for HTTP service clients; type-level `@ClientRegistrationId` | new | PARTIAL | one mention at p9/12-outbound-http/05-http-service-groups.md:150; the full client story is planned (p13/README.md:37 row 09) | S70 |
| L2-72 | Security 7.0 | `NimbusJwtEncoder` builder; custom `JwkSource` for `NimbusJwtDecoder` | new | PARTIAL | a custom `JWSKeySelector` over `JWKSource` is shown (p13/06-jwt-anatomy-and-validation/03-the-jose-header.md:96-105); the new builder APIs are not | S70 |
| L2-73 | Security 7.0 | Authorization Server folded into Spring Security (versioned by `spring-security.version`); PKCE on by default; Dynamic Client Registration | new/default | PLANNED | p13/README.md:38 row 11 "Running vs buying the AS"; syl/05-distributed.md:38 | S70, B40M |
| L2-74 | Security 7.0 | `JwtTypeValidator` joins the default validators (`validateTypes`) | default | COVERED | p13/06-jwt-anatomy-and-validation/03c-the-spring-7-typ-collision.md; p13/08-…/06-the-default-validators.md:35-58,180 | S70M |
| L2-75 | Security 7.0 | `BearerTokenAuthenticationFilter` resolver setters deprecated → `BearerTokenAuthenticationConverter` | deprecated | PARTIAL | `BearerTokenResolver` is taught through the DSL (p13/08-…/04-the-filter-chain.md:188; 05b-bearer-token-resolution.md); the converter has 0 hits | S70M |
| L2-76 | Security 7.0 | Jackson 3 `SecurityJacksonModules` | new | MISSING | `SecurityJacksonModules`, `SecurityJackson2Modules` | S70M |
| L2-77 | Security 6.5 → 7.0 | `LoginUrlAuthenticationEntryPoint` favours relative redirects | default | COVERED | p11/06-mockmvc/08c-asserting-protection-not-the-challenge.md:197 | S70 |
| L2-78 | Security 7.0 | `SecurityMockMvcResultMatchers.withAuthorities(…)` | new | MISSING | `withAuthorities` | S70 |
| L2-79 | Data 2025.1 | AOT repositories (generated query-method code, on by default in AOT mode) | new | MISSING | "AOT repositor", `spring.aot.repositories` | D251 |
| L2-80 | Data 2025.1 | JPA 3.2 baseline: `getSingleResultOrNull`; nulls precedence in `Sort` through Criteria | new | MISSING | "nulls precedence", `NullHandling`, `nullsFirst` | D251 |
| L2-81 | Data 2025.1 | Derived queries generated as JPQL rather than `CriteriaQuery` | default | COVERED | p10/09-spring-data-jpa/02-derived-queries.md:2 ("compiles into JPQL at startup") | D251 |
| L2-82 | Data 2025.1 | `PredicateSpecification`, `UpdateSpecification`, `DeleteSpecification` | new | COVERED | p10/09-spring-data-jpa/07-specifications-and-criteria.md:47-54 | D251 |
| L2-83 | Data 2025.1 | Fluent `findBy(…)` returns a `Slice` without a count; `JpaSort.unsafe` works with Specifications | new | PARTIAL | the fluent query (p10/09-…/07c-executing-specifications-and-examples.md:35) and `JpaSort.unsafe` (05c-sort-is-not-free.md:48-64) are taught; the 4.0 slice and sort-with-spec additions are not | D251 |
| L2-84 | Data 2025.1 | `QueryEnhancerSelector` replaces `spring.data.jpa.query.native.parser` | removed | MISSING | `QueryEnhancerSelector`, `query.native.parser`. JSqlParser is taught as the count-query helper (p10/09-…/03g-native-queries.md:56) | D251 |
| L2-85 | Data 2025.1 | `@PersistenceConstructor` removed → `@PersistenceCreator` | removed | COVERED | p10/14-spring-data-other/02d-naming-indexes-and-construction.md:107-157 | D251 |
| L2-86 | Data 2025.1 | Spring Data JDBC composite ids; `DbActionExecutionException` removed; R2DBC quotes identifiers by default | new/removed/default | MISSING | `DbActionExecutionException`, `forceQuote`. Spring Data JDBC appears only in the slice catalogue (p11/05-…/03c:51) | D251 |
| L2-87 | JUnit 6.0 | Java 17 baseline; one version number for Platform, Jupiter and Vintage; JSpecify | default | COVERED | p11/01-junit-5/02b-what-junit-6-changed.md:35-51,142 | J60 |
| L2-88 | JUnit 6.0 | Deterministic `@Nested` order; `MethodOrderer.Default` / `ClassOrderer.Default`; `@TestMethodOrder` inherited | default/new | COVERED | p11/01-junit-5/11-execution-order.md; 11c-class-order.md | J60 |
| L2-89 | JUnit 6.0 | FastCSV behind `@CsvSource`; `lineSeparator` removed; stricter quoting | removed/default | COVERED | p11/03-parameterized-tests/03c-csvfilesource.md:143-153; 03-csvsource.md:168 | J60 |
| L2-90 | JUnit 6.0 | Argument text quoted in display names; `name = value` style | default | COVERED | p11/03-parameterized-tests/07b-quoted-arguments.md | J60 |
| L2-91 | JUnit 6.0 | `junit-platform-runner` removed; Vintage and `migrationsupport` deprecated; `MethodOrderer.Alphanumeric` removed; Surefire/Failsafe < 3.0 unsupported | removed/deprecated | COVERED | p11/01-junit-5/02b-what-junit-6-changed.md:80-96,174,189,202 | J60 |
| L2-92 | JUnit 6.0 | `JRE.JAVA_8…16` deprecated; `@EnabledForJreRange` min defaults to 17 | deprecated | COVERED | p11/01-junit-5/02b-what-junit-6-changed.md:35-43 | J60 |
| L2-93 | JUnit 6.0 | `Store.getOrComputeIfAbsent` → `computeIfAbsent` | deprecated | COVERED | p11/01-junit-5/02b-what-junit-6-changed.md:148-149,197 | J60 |
| L2-94 | JUnit 6.0 | `--fail-fast` on the ConsoleLauncher; `CancellationToken` | new | COVERED | p11/01-junit-5/02b-what-junit-6-changed.md:146-147 | J60 |
| L2-95 | Mockito 5.19 | JDK 21 sequenced collections get empty defaults (`ReturnsEmptyValues`) | default | MISSING | `SequencedCollection`, `ReturnsEmptyValues` (only `RETURNS_DEFAULTS` hits) | M5.19 |
| L2-96 | Mockito 5.20 | `mockConstruction` of generic types | new | MISSING | "generic…mockConstruction". `mockConstruction` itself is taught at p11/12-real-world-scenarios/02c-construction-and-final-classes.md | M5.20 |
| L2-97 | TC 2.0 | Modules renamed `testcontainers-*`; classes relocated to `org.testcontainers.<module>`; containers no longer generic | removed | COVERED | p11/07-testcontainers/02-what-testcontainers-is.md:78,179; p10/11-flyway-migrations/11b-wiring-the-container.md:42 | TC20 |
| L2-98 | TC 2.0 | JUnit 4 support removed (`@Rule` / `@ClassRule`) | removed | COVERED | p11/07-testcontainers/03c-the-store-and-the-messages.md:142-155 | TC20 |
| L2-99 | TC 2.0 | Module default constructors dropped — the image name is required | removed | COVERED | p11/07-testcontainers/02-what-testcontainers-is.md:53; 06-schema-and-data.md:219,266 | TC20 |
| L2-100 | TC 2.0.2 / 2.0.3 | Default Docker API version 1.44, falling back to 1.32 for older engines | default | MISSING | `api.version`, "Docker API", `1.44` | TC-REL |
| L2-101 | Cloud 2025.0 → 2025.1 | Gateway artifacts split (`spring-cloud-starter-gateway-server-webflux` / `-webmvc`, proxyexchange); the old names removed in 2025.1; prefixes become `spring.cloud.gateway.server.webflux.*` | removed | PLANNED | p14/README.md:36 row 07; syl/05-distributed.md:65; p14/07-api-gateway/_plan.md:16 | SC250 |
| L2-102 | Cloud 2025.0 | Gateway `X-Forwarded-*` / `Forwarded` handling off by default → `trusted-proxies` | security | PLANNED | syl/05-distributed.md:65; `trusted-proxies` 0 hits | SC250 |
| L2-103 | Cloud 2025.1 | Breaking train for Jackson 3, JSpecify and Boot 4; `spring-cloud-starter-parent` removed (import the BOM) | removed | PLANNED | syl/05-distributed.md:65-67; p14/_PHASE-NOTES.md:45-47 | SC251 |
| L2-104 | Cloud (since 2022.0) | OpenFeign is feature-complete; HTTP service clients are the recommendation | deprecated | PARTIAL | the comparison table is at p9/12-outbound-http/04-http-interfaces.md:110-120; the "feature-complete" status is not stated | FEIGN |
| L2-105 | Spring Kafka 4.0 | Kafka 4 client; KRaft-only `@EmbeddedKafka`; `EmbeddedKafkaRule` removed | removed | COVERED | p11/12-real-world-scenarios/08a-the-payload-and-the-boundary.md:94-97 | SK40 |
| L2-106 | Spring Kafka 4.0 | KIP-848 consumer rebalance protocol | new | PLANNED | p15/README.md:26 row 05; syl/05-distributed.md:91 | SK40 |
| L2-107 | Spring Kafka 4.0 / 4.1 | Kafka Queues — share consumers (KIP-932) | new | MISSING | `KIP-932`, "share consumer", "Kafka Queues". The planned framing "Kafka is a log, not a queue" (p15/README.md:24 row 03; syl/05-distributed.md:89) needs revising for it | SK40, SK41 |
| L2-108 | Spring Kafka 4.0 / Boot 4.0 | Spring Retry dropped → Framework retry plus Kafka's own `@BackOff`; `spring.kafka.retry.topic.backoff.random` → `.jitter` | removed | PLANNED | p15/README.md:27 row 06; syl/05-distributed.md:92 | SK40, B40M |
