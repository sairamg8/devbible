---
name: version-coverage-java-spring
description: java-spring (Boot/Framework/Security/Data/Cloud + JUnit/Mockito/Testcontainers/Flyway/jOOQ) · applies up to Spring Boot 4.1.1 / Framework 7.0.9 / Security 7.1.1 (floor Boot 4.0; phase 10 effectively 4.1) · lines compared Boot 3.5 (de-facto LTS) → 4.0 → 4.1 (pin) → shipped-beyond-pins → 4.2.0-M1 · 214 changes — 77 covered / 33 partial / 84 missing / 7 contradicted / 13 planned · 18 stale claims · report continues in java-spring-02/03/04.md
metadata:
  type: project
---
# Java — Spring Boot, Spring Framework and the library stack — version coverage vs LTS (2026-09-24)

Unit dirs (read-only, under `/mnt/Storage/Backup/Knowledge/devbible`): `docs/java/pages/phase-9-spring-boot` ·
`phase-10-data-access` · `phase-11-testing` · `phase-13-oauth2-oidc` · `phase-14-microservice-architecture` ·
`phase-15-messaging-event-driven` · `phase-16-resilience-operations` · `docs/java/syllabus`.
1,561 `.md` files. Continued in `java-spring-02.md` (§3 part 1), `java-spring-03.md` (§3 part 2),
`java-spring-04.md` (§4 + §5).

## §1 · Upstream release lines

**Spring has no "LTS" label.** The published policy (spring.io/support-policy, fetched 2026-09-24): a Boot minor
gets ≥13 months OSS support; **only the last minor of a major (2.7, 3.5) gets an extra five years of enterprise
support**. That makes **3.5.x the de-facto LTS line** and the oldest line this audit compares from. endoflife.date
reports `lts: false` for every Boot/Framework/Security cycle. Boot's wiki *Supported-Versions*: a new major or
minor every six months (May and November).

### Spring Boot (the spine every other row hangs off)

| Line | Status on 2026-09-24 | GA | OSS support ends | Enterprise ends | Latest patch | Manages |
|---|---|---|---|---|---|---|
| **4.2.x** | **next** — milestones only: 4.2.0-M1 2026-08-20; 4.2.0-M2 milestone due 2026-09-24, **not published** at fetch time | Nov 2026 (generation date 2026-11-30) | 2027-12-31 | 2028-12-31 | 4.2.0-M1 | Framework 7.1.0-M1, Security 7.2.0-M1, Data 2026.1.0-M1, JUnit 6.1.3, Flyway 12.11.0 |
| **4.1.x** | **latest stable** ("current" in the spring.io API) | 2026-06-10 (GitHub `v4.1.0`) | 2027-07-31 | 2028-07-31 | **4.1.1** (2026-08-20) | Framework 7.0.9, Security 7.1.1, Data 2026.0.1, Hibernate 7.4.5.Final, JUnit 6.0.3, Mockito 5.23.0, Testcontainers 2.0.5, Flyway 12.4.0, jOOQ 3.21.7, Spring Kafka 4.1.1, Kafka client 4.2.1 |
| **4.0.x** | active (OSS) | 2025-11-20 | 2026-12-31 | 2027-12-31 | 4.0.8 (2026-08-21) | Framework 7.0.9, Security 7.0.7, Data 2025.1.7, Hibernate 7.2.24, JUnit 6.0.3, Mockito 5.20.0, Testcontainers 2.0.5, Flyway 11.14.1, jOOQ 3.19.37 |
| **3.5.x** | **de-facto LTS** — OSS ended 2026-06-30, enterprise to 2032 | 2025-05-22 | 2026-06-30 (ended) | **2032-06-30** | 3.5.16 (2026-06-25) | Framework 6.2.19, Security 6.5.11, Data 2025.0.13, Hibernate 6.6.53, JUnit 5.12.2, Mockito 5.17.0, Testcontainers 1.21.4, Flyway 11.7.2, jOOQ 3.19.35, Authorization Server 1.5.8 |
| 3.4.x | enterprise only | 2024-11 | 2025-12-31 | 2026-12-31 | 3.4.13 | — |
| 2.7.x | enterprise only (last of 2.x) | 2022-05 | 2023-06-30 | 2029-06-30 | 2.7.18 | — |

"Manages" columns come from the `spring-boot-dependencies` POMs for 4.1.1, 4.0.8 and 3.5.16 on Maven Central, and
the 4.2.0-M1 release notes. endoflife.date gives 4.1's release date as 2026-06-30 — the spring.io generation's
month-end date, not the GitHub publish date.

### The rest of the Spring portfolio

| Product | Next | Latest stable | Still supported | Ended / enterprise-only | Sources |
|---|---|---|---|---|---|
| **Spring Framework** | 7.1.x — 7.1.0-M1 2026-08-20, GA "scheduled for November 2026" | **7.0.9** (2026-08-20; OSS to 2027-07-31) | — | 6.2.x: OSS ended 2026-06-30, commercial to 2032-06-30 (6.2.19); 5.3.x commercial to 2029-06-30 | eol, api.spring.io, GitHub releases, wiki *Spring-Framework-Versions* |
| **Spring Security** | 7.2.x — 7.2.0-M1 2026-08-20 | **7.1.1** (2026-08-20; 7.1.0 GA 2026-06-09) | 7.0.x → 7.0.7 (OSS to 2026-12-31) | 6.5.x: OSS ended 2026-06-30, commercial to 2032-06-30 (6.5.11) | eol, GitHub releases |
| **Spring Data** (release train) | 2026.1 — 2026.1.0-M1 | **2026.0.1** (JPA 4.1.1, 2026-08-21) | 2025.1.x → 2025.1.7 (OSS to 2026-12-31) | 2025.0.x: OSS ended 2026-06-30, commercial to 2032-06-30 | api.spring.io, GitHub `spring-data-jpa` releases |
| **Spring Cloud** (release train) | 2026.0.0 — SNAPSHOT only, no milestone | **2025.1.3 "Oakwood"** (2026-08-20; 17 CVE fixes across 5 modules) | 2025.1.x supports **Boot 4.0.x and 4.1.x "(Starting with 2025.1.2)"** per spring.io/projects/spring-cloud; the wiki *Supported-Versions* table still says 4.0.x only (stale) | 2025.0.x "Northfields" (Boot 3.5.x): OSS ended 2026-06-30, commercial to 2032-06-30 | spring.io/projects/spring-cloud, wiki *Supported-Versions*, eol, GitHub `v2025.1.3` |
| **Spring Authorization Server** | — | merged into Spring Security 7.0 | — | 1.5.x (last standalone, 1.5.8): OSS ended 2026-06-30 | api.spring.io, Security 7.0 what's new |
| **Spring for Apache Kafka** | 4.2.0-M1 | **4.1.1** | 4.0.x (4.0.7) | 3.3.x (Boot 3.5): OSS ended 2026-06-30 | api.spring.io |

### The test and data library stack (no LTS concept — support = the newest line)

| Library | Latest stable (date) | Previous line still getting patches | What each Boot line manages | Sources |
|---|---|---|---|---|
| **JUnit** | **6.1.3** (2026-08-07); 6.1.0 GA 2026-05-19 | 6.0.3 (2026-02-15); **5.14.4** (2026-04-26) | 3.5 → 5.12.2 · 4.0/4.1 → 6.0.3 · 4.2-M1 → 6.1.3 | GitHub `junit-team/junit-framework`, docs.junit.org release notes |
| **Mockito** | **5.24.0** (2026-09-23) | — (single line) | 3.5 → 5.17.0 · 4.0 → 5.20.0 · 4.1 → 5.23.0 | GitHub `mockito/mockito` |
| **Testcontainers** | **2.0.5** (2026-04-20) | 1.21.4 (2025-12-15, last 1.x) | 3.5 → 1.21.4 · 4.x → 2.0.5 | GitHub `testcontainers-java` |
| **Flyway** | **13.7.0** (2026-09-15); 13.0.0 2026-07-20 | 12.11.0 (2026-07-09, last 12.x) | 3.5 → 11.7.2 · 4.0 → 11.14.1 · 4.1 → 12.4.0 · 4.2-M1 → 12.11.0 | GitHub `flyway/flyway`, Redgate release notes |
| **jOOQ** | **3.21.8** (2026-09-04) | 3.20.19 and 3.19.38 (both 2026-09-04) | 3.5 → 3.19.35 · 4.0 → 3.19.37 · 4.1 → 3.21.7 | GitHub `jOOQ/jOOQ` |
| Hibernate ORM | 7.4.10 (2026-09-20); **8.0.0.Beta2** (2026-09-23) | 7.3.13 | 3.5 → 6.6.53 · 4.0 → 7.2.24 · 4.1 → **7.4.5** | GitHub `hibernate-orm` |
| Resilience4j | **2.4.0** (2026-03-14) — adds Boot 4 / Spring Cloud 5 support, JDK 21 baseline | 2.3.0 (2025-01-03) | not Boot-managed | GitHub `resilience4j` |
| springdoc-openapi | **3.1.1** (Boot 4.x) and 2.9.1 (Boot 3.5), both 2026-09-06 | 3.0.3 | not Boot-managed | GitHub `springdoc-openapi` |
| Apache Kafka (broker/client) | 4.3.1 (4.3 GA 2026-05-20) | 4.2, 4.1, 4.0 | 4.1.1 → client 4.2.1 | eol `apache-kafka` |
| RabbitMQ | 4.3.6 (4.3 GA 2026-04-23) | 4.2 EOL 2026-07-31 | — | eol `rabbitmq` |

**Next LTS-equivalent:** the next *last-minor-of-a-major* has not been announced. The next scheduled lines are
Boot **4.2 / Framework 7.1 / Security 7.2 / Data 2026.1** in **November 2026**. Framework 7.1 formally
deprecates `RestTemplate` (removal "scheduled for Spring Framework 8.0 (not yet scheduled)").

### Sources fetched this session (2026-09-24)

- `https://endoflife.date/api/{spring-boot,spring-framework,spring-security,spring-cloud,apache-kafka,rabbitmq,keycloak}.json`
- `https://api.spring.io/projects/{spring-boot,spring-framework,spring-security,spring-data,spring-cloud,spring-authorization-server,spring-kafka}/{generations,releases}`
- `https://spring.io/support-policy` · Boot wiki `Supported-Versions` · Framework wiki `Spring-Framework-Versions`
- `gh api repos/<owner>/<repo>/releases` for spring-boot, spring-framework, spring-security, spring-data-jpa,
  junit-framework, mockito, testcontainers-java, flyway, jOOQ, hibernate-orm, resilience4j, springdoc-openapi,
  spring-cloud-release; `gh api repos/spring-projects/spring-boot/milestones` (4.2.0-M2 due 2026-09-24)
- `https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/{4.1.1,4.0.8,3.5.16}/…pom`
- Spring Cloud wiki `Supported-Versions`, `Spring-Cloud-2025.1-Release-Notes`

**Fetch failures (recorded, not filled from memory):** `endoflife.date/api/spring-data.json` → 404;
`endoflife.date/api/hibernate.json` → non-JSON; `raw.githubusercontent.com/wiki/…` URLs → 404 (the wikis were
cloned with `git clone --depth 1 …wiki.git` instead); `docs.spring.io/spring-security/reference/7.0/migration/servlet/config.html`
→ 404; GitHub release `v4.2.0-M2` → 404 (not yet published). No Redgate/Flyway or JUnit support-policy page was
fetched, so neither product's EOL dates are stated.
Also fetched later in the session for §2/§3: the Boot, Framework and Spring Data wikis (release notes 3.5, 4.0 +
migration guide, 4.1, 4.2.0-M1; Framework 6.2, 7.0, 7.1; Data 2025.0–2026.1); Security *What's New* 6.5/7.0/7.1 and
the 7.0 migration pages; `docs.junit.org/{5.12.0,5.13.0,5.14.0,6.0.0,current}/release-notes/`; Spring Kafka 4.0/4.1
*What's new*; spring.io/projects/spring-cloud; Boot 4.0/4.1 *Externalized Configuration* and 4.1 *Observability*
references; the Framework 7.0 *Request Mapping* reference; the Security `HttpSecurity` javadoc; Maven Central POMs
for individual 4.1.1 starters; GitHub releases of spring-grpc, spring-modulith, helidon, quarkus, pitest, junit-pioneer.

## §2 · Content baseline — "applies up to"

### a · What the pages say they were verified against

1,966 `> Verified:` / `> Target:` / `> Version spine:` blockquotes across 1,514 of the 1,561 files. The 47 files
without one are 42 internal `_plan.md` / `_PHASE-NOTES.md` files and the 5 syllabus pages. Counts are blockquotes
naming the version (one blockquote can name several products):

| Product | Versions named (count of blockquotes) |
|---|---|
| Spring Boot | **4.1.1 ×1378**, `spring-boot-dependencies:4.1.1` ×303, 4.1 ×125, 4.1.0 ×31, 4.0 ×30 (all "4.0 migration guide/release notes" citations), 4.0.0 ×2, 2.6 ×4 / 3.4 ×3 / 3.5 ×1 / 3.5.16 ×1 (history citations) |
| Spring Framework | **7.0.9 ×650**, 7.0.x ×276, 7.0 ×160, 7.0.8 ×22; 6.2 ×2, 6.1 ×4, 6.0 ×1, 5.0.0 ×2 (history) |
| Spring Security | **7.x ×117**, 7.1.1 ×18, 7.1.0 ×6, 7.0.x ×5, 7.0 ×3, 7.1.x ×1 |
| Spring Data | JPA **4.1.0 ×109** / 4.1 ×86; MongoDB 5.1.0 ×17 / 5.1 ×15 (no train name used) |
| Hibernate ORM | **7.4.1 ×243**, 7.4 ×174, 7.0 ×3 |
| JUnit | **6.0.3 ×495**, 6.0.0 ×4, 6.0 ×2 |
| Mockito | **5.23.0 ×217** (5.0.0 ×1, a "since" citation) |
| Testcontainers | **2.0.5 ×114** (2.0.0 ×1) |
| Flyway | **12.4.0 ×51**, 12 ×27 |
| jOOQ | **3.21 ×31** |
| Spring Cloud | **2025.1.x ×81** ("Oakwood", components 5.0.x) |
| JDK | **25 ×1517** (24/23/21/20/17 = JEP or history citations) |

Per phase: 1,350 of the 1,518 published pages name **Spring Boot 4.1.x** in that blockquote. The other 168 name no Boot
version. 160 of those are phase-10 JDBC/Hibernate pages that cite only JDK 25, Hibernate 7.4 or Framework 7.0. No
published page targets Boot 4.0 or 3.x, **except `phase-16-resilience-operations/README.md:7` ("Spring Boot 3.x")**.
Phases 15 and 16 are README-only (0 of 14 and 0 of 13 written). Phase 14 has 164 files in topics 01, 02 and 04; the
other nine topics are `_plan.md` only.

**Spine drift against what Boot 4.1.1 actually manages** (Maven Central BOM): Hibernate **7.4.5.Final**, not 7.4.1
(×243). Spring Data **2026.0.1** / JPA 4.1.1, not 4.1.0. Framework 7.0.8 ×22 is one patch behind 7.0.9. JUnit 6.0.3,
Mockito 5.23.0, Testcontainers 2.0.5, Flyway 12.4.0, jOOQ 3.21.x and Security 7.1.1 all match.

### b · Feature probes — the headline features of each line, grepped (≥2 terms each, case-insensitive)

| Line | Headline features probed | Taught | Result |
|---|---|---|---|
| **Boot 3.5 / Framework 6.2 / Security 6.5 / JUnit 5.12–5.14** (the de-facto LTS) | `@Fallback`, background bean init, `MockMvcTester`, `@MockitoBean`/`@TestBean`, `DynamicPropertyRegistrar`, `@ExceptionHandler(produces)`, fragment rendering, RFC/WHATWG URL parsers, `@FilterRegistration`/`@ServletRegistration`, `env:` config import, structured-log stack traces, heapdump `access=NONE`, `@ConditionalOnBooleanProperty`, DPoP, `@ParameterizedClass` | 10 of 15 (+1 partial) | missing: background init, fragments, URL parsers, structured-log config, DPoP config |
| **Boot 4.0 / Framework 7.0 / Security 7.0 / Data 2025.1 / JUnit 6.0 / Testcontainers 2.0** | modular starters, Jackson 3, JSpecify, HTTP service groups, API versioning, `RestTestClient`, `@MockBean` removal, core `@Retryable`/`@ConcurrencyLimit`, `BeanRegistrar`, context pausing, `PathPattern` `**` rules, lambda-only Security DSL, MFA, AOT repositories, JUnit 6 changes, Testcontainers 2 packages, `JmsClient`, OpenTelemetry starter | 13 of 18 | missing: `BeanRegistrar`, AOT repositories, `JmsClient`, OTel starter; MFA partial; **`PathPattern` contradicted** |
| **Boot 4.1 / Security 7.1 / Data 2026.0** (latest stable, the pin) | Spring gRPC in Boot, `spring.jackson.read/write` return, `[encoding=]` imports, cookie handling, `InetAddressFilter`, `propagate-context`, `management.opentelemetry.*`, `authorities-claim-expressions`, `spring.datasource.connection-fetch`, `@RedisListener`, `Optional` binding, type-safe `PropertyPath`, JDBC `upsert`, Security 7.1 `InetAddressMatcher`, jOOQ 3.20 needs Java 21 | 5 of 15 (+3 partial, 1 planned) | missing: OTel props, `connection-fetch`, `@RedisListener`, property paths, upsert, 7.1 matchers; **`Optional` binding contradicted** |
| **Shipped beyond the pins** (JUnit 6.1, Mockito 5.24, Flyway 13, Resilience4j 2.4, Spring gRPC 1.1) | JUnit 6.1 system-property/locale extensions, `@TempDir` deletion strategy, `org.junit.start`; `spyStatic`; Flyway 13 module split; R4j Boot 4 support | 1 of 6 | only the JUnit 6.1 extensions are taught (as a "not on your spine yet" gap, 14i) |
| **Toward next** (Boot 4.2.0-M1 / Framework 7.1.0-M1) | `RestTemplate` formally deprecated, HTTP `QUERY`, `MultipartHttpMessageConverter`, JAXB not auto-detected, `ForwardedHeaderFilter` choice, AMQP 1.0 / starter split | 1 of 6 | only the "RestTemplate is on its way out" framing |

**Floor.** Boot 3.5 fails outright: pages rely on Boot-4-only packages (`org.springframework.boot.webmvc.test.autoconfigure`,
`tools.jackson`), starters (`webmvc`, `aspectj`, `flyway`), removed APIs (`@MockBean`) and the Security 7 DSL. Boot
**4.0** holds for phases 9, 11 and 13, apart from the flagged 4.1 extras. Phase 10 is effectively **4.1**-only: it
teaches Flyway 12, jOOQ 3.21 and Hibernate 7.4, and Boot 4.0.8 manages Flyway 11.14, jOOQ 3.19 and Hibernate 7.2.

### c · Stale claims — false (or expiring) today

| # | file:line | Claim (≤15 words) | Why it is false on 2026-09-24 |
|---|---|---|---|
| S1 | `phase-16-resilience-operations/README.md:7` | "Target: Resilience4j 2.x · Spring Boot 3.x · Kubernetes." | Boot 3.x OSS support ended 2026-06-30. The rest of the track targets 4.1.1, and Resilience4j supports Boot 4 only from **2.4.0** (2026-03-14) |
| S2 | `phase-14-microservice-architecture/README.md:25` | "0 of 12 written." | topics 01 (40 files), 02 (78) and 04 (35) exist |
| S3 | `phase-14-…/04-sync-vs-async/04b-deadline-propagation.md:17`; `_PHASE-NOTES.md:18,71,127` | "Spring gRPC 1.0.3 — supports Boot 4.1.x" | Boot 4.1.0 moved to **Spring gRPC 1.1.0**, with a 1.0→1.1 migration guide. The 4.1.1 BOM manages 1.1.1, and 1.1.1 is current (2026-08-21) |
| S4 | `phase-9-spring-boot/14-openapi-springdoc/04-adding-springdoc.md:34` | "Current release \| 3.1.0, published 2026-08-01" | springdoc **v3.1.1** was published 2026-09-06 |
| S5 | `phase-9-spring-boot/16-the-alternatives/04-helidon-and-the-rest.md:109,114` | "The current line is 4.5.x" / "maintained majors are 3 and 4" | **Helidon 27.0.0** went GA on 2026-09-22 (a feature release; Helidon 4 is now the LTS) |
| S6 | `phase-9-spring-boot/03-dependency-injection/04-field-injection.md:166` | "Phase 11 — Testing (not written yet)" | Phase 11 is complete (12 of 12 closed) |
| S7 | `phase-10-data-access/11-flyway-migrations/11c-the-slice-that-skips-your-migrations.md:162` | "Phase 11 · The test pyramid (not written yet)" | `phase-11-testing/05-the-test-pyramid/` exists |
| S8 | `syllabus/04-production.md:22` | "JUnit 5: @Test, lifecycle…" | the phase teaches JUnit **6.0.3**, and **6.1.3** is current |
| S9 | `syllabus/05-distributed.md:35` | "`oauth2ResourceServer().jwt()`, `issuer-uri` autoconfiguration" | the no-arg DSL is gone in Security 7. `HttpSecurity` has only the `Customizer` overload (javadoc) → **CONTRADICTED** in §3 |
| S10 | `phase-9-spring-boot/06-configuration-and-profiles/06-defaults-and-validation.md:66-67, 209` | "a missing property binds to `null` rather than to `Optional.empty()`" | the Boot **4.1** reference says an empty `Optional` is bound; the null rule was 4.0 → **CONTRADICTED** |
| S11 | `phase-9-…/01-why-frameworks-servlet-model/04-the-embedded-container.md:130-133`; `12-outbound-http/02-wiring-it-in-boot-4.md:41-43`; `15-webflux-reactive/06-annotated-controllers.md:42` | "`spring-boot-starter-web` does not resolve on Boot 4" | `spring-boot-starter-web:4.1.1` is on Maven Central, described as deprecated in favour of `webmvc` → **CONTRADICTED** |
| S12 | `phase-10-data-access/05-sql-first-access/06b-the-translator-chain.md:135-138` | "under `spring.dao.exceptiontranslation.enabled` … stable since 1.5" | Boot 4.0 renamed it to `spring.persistence.exceptiontranslation.enabled` → **CONTRADICTED** |
| S13 | `phase-9-…/07-rest-controllers/01-the-controller-and-the-pipeline.md:174-177, 260-262` | "`**` … permitted only at the end of a pattern" | the Framework 7.0 reference shows `"/**/info"` and `"{*path}/resources"` as valid → **CONTRADICTED** |
| S14 | `phase-13-oauth2-oidc/08-…/01-what-the-starter-gives-you.md:69,179,215`; `02-the-four-roles/06-mapping-onto-your-stack.md:128-130` | "`spring-boot-starter-oauth2-resource-server`" used as the starter | deprecated in Boot 4.0 for `spring-boot-starter-security-oauth2-resource-server` / `-client` → **CONTRADICTED** |
| S15 | `phase-10-data-access/README.md:7-9` (+243 Verified lines) | "Hibernate ORM 7.4.1 · Spring Data JPA 4.1.0" | the Boot 4.1.1 BOM manages 7.4.5.Final and Data 2026.0.1 (patch drift; low severity) |
| S16 | `phase-10-data-access/13-jooq/_plan.md:3` (internal) | "Target: jOOQ 3.20.x" | the Boot 4.1.1 BOM manages jOOQ 3.21.7, which the pages themselves use |
| S17 | `phase-9-…/16-the-alternatives/02-quarkus.md:190` | "3.27 LTS … supported until 24 September 2026" | **expires today**. Not false yet (3.27.5.3 shipped 2026-09-22), but due for the next sweep |
| S18 | `phase-9-spring-boot/12-outbound-http/09-the-pool-is-the-real-limit.md:102-117, 129-134` | "the response is never completed" → pool leak from a bare `retrieve()` | Framework 6.2+ made a bare `retrieve()` a **no-op**: no request is sent, so nothing leaks. The real bug is a silently skipped call (found during §3) → **CONTRADICTED** |

**Verdict: content applies up to Spring Boot 4.1.1 / Framework 7.0.9 / Security 7.1.1 (floor Boot 4.0.x; phase 10
effectively 4.1).** Almost every page is verified against the 4.1.1 spine, and the 4.0 migration is taught thoroughly.
But only 7 of the 32 changes on the 4.1 line are taught. §3 found 7 contradicted changes across 10 files (S9–S14, S18),
each presenting pre-4.x or wrong behaviour as current.
