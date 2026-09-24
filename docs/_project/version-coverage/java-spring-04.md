---
name: version-coverage-java-spring-04
description: java-spring version coverage §4–§5 — per-LTS-line summary (214 changes, 77 covered / 33 partial / 84 missing / 7 contradicted / 13 planned) and the hand-off list with tiers, beside-pages and pins.js proposals
metadata:
  type: project
---
# Java — Spring stack version coverage — §4 summary and §5 hand-off (2026-09-24)

Continues `java-spring-03.md`. Row ids (`L1-…` to `L5-…`) are the `#` column of the §3 tables in `java-spring-02.md`
and `java-spring-03.md`. Paths use the §3 shorthand (`p9` = `docs/java/pages/phase-9-spring-boot`, and so on).

## §4 · Summary by LTS line

Spring has no LTS label; 3.5.x is the de-facto LTS (the last 3.x minor, enterprise support to 2032-06-30). 4.1.x is
the latest stable line and the corpus pin.

| Line | Changes | COVERED | PARTIAL | MISSING | CONTRADICTED | PLANNED | Verdict |
|---|---|---|---|---|---|---|---|
| **L1 · Boot 3.5 / FW 6.2 / Sec 6.5 / Data 2025.0 / JUnit 5.12–5.13** (de-facto LTS) | 47 | 16 | 10 | 18 | 1 | 2 | The 3.5-era features the 4.x stack still uses are taught: `MockMvcTester`, `@MockitoBean`, `@Fallback`, the heapdump lockdown. The Framework 6.2 container and web additions are missing (background init, placeholder escaping, URL parsers, fragments, SpEL limits), and so are most Boot 3.5 observability and config items. The `RestClient` bare-`retrieve()` rule is taught in its pre-6.2 shape |
| **L2 · Boot 4.0 / FW 7.0 / Sec 7.0 / Data 2025.1 / JUnit 6.0 / TC 2.0** | 108 | 52 | 13 | 32 | 5 | 6 | The unit's strongest line: starters, Jackson 3, the test-infrastructure removals, JUnit 6 and Testcontainers 2 are thorough. The gaps cluster in Framework 7.0 internals (`BeanRegistrar`, SpEL, `HttpHeaders`, proxy defaults), the Security 7.0 authorization APIs and Data 2025.1 (AOT repositories, vector search, `QueryEnhancerSelector`). Five spots teach removed or wrong behaviour as current |
| **L3 · Boot 4.1 / Sec 7.1 / Data 2026.0 / Kafka 4.1 / Flyway 12 / jOOQ 3.21** (latest stable = pin) | 32 | 7 | 8 | 14 | 1 | 2 | Every page names Boot 4.1.1, yet only 7 of the line's 32 changes are taught. OpenTelemetry properties, Data 2026.0 (type-safe property paths, JDBC upsert, `@RedisListener`), Security 7.1 and Mockito 5.21 are missing, and the new `Optional` binding is contradicted |
| **L4 · Shipped beyond the pins** (JUnit 6.1, Mockito 5.24, Flyway 13, R4j 2.4, Cloud 2025.1.3) | 17 | 2 | 1 | 12 | 0 | 2 | Nothing past the pins is taught except the JUnit 6.1 extensions (as a known gap). The Flyway 13 module split (L4-14) is the concrete cost of the open sweep-or-freeze decision |
| **L5 · Toward next** (Boot 4.2.0-M1 / FW 7.1.0-M1 / Data 2026.1.0-M1, GA Nov 2026) | 10 | 0 | 1 | 8 | 0 | 1 | Only the "`RestTemplate` is on its way out" framing exists. HTTP `QUERY`, the multipart converter, the `ForwardedHeaderFilter` choice and the `disallowedFields` deprecation are all ahead |
| **Total** | **214** | **77** | **33** | **84** | **7** | **13** | covered: 36% overall · 34% L1 · 48% L2 · 22% L3 |

**By product.** Each row is classified by the first product named in its *Since* cell, so the split is approximate:

| Product | Rows | COV | PART | MISS | CONTR | PLAN |
|---|---|---|---|---|---|---|
| Spring Boot | 63 | 26 | 13 | 17 | 4 | 3 |
| Spring Framework | 57 | 20 | 8 | 27 | 2 | 0 |
| JUnit | 23 | 13 | 1 | 9 | 0 | 0 |
| Spring Security | 22 | 6 | 7 | 6 | 1 | 2 |
| Spring Data | 18 | 4 | 2 | 12 | 0 | 0 |
| Mockito | 9 | 2 | 0 | 7 | 0 | 0 |
| Spring Cloud / Kafka / R4j | 11 | 1 | 1 | 1 | 0 | 8 |
| jOOQ / Testcontainers / Flyway | 11 | 5 | 1 | 5 | 0 | 0 |

**One-line verdict:** complete for no line. Strongest on 4.0 (48% covered, 60% with partials). **18 missing from
the 3.5 LTS line, 32 from 4.0, 14 from the 4.1 pin, 12 already shipped past the pins, 8 in the November 2026
milestones. 7 are contradicted, 4 of them at Master tier.**

## §5 · Hand-off to the owning lane (the Java track)

### 5a · CONTRADICTED — live pages teaching the wrong thing (fix first)

| Row | Tier | Page(s) to fix (ls-verified) | What to change |
|---|---|---|---|
| L2-41 | Master | p9/07-rest-controllers/01-the-controller-and-the-pipeline.md:173-177, 260-262 | Framework 7.0 allows `**` and `{*path}` at the **start** too (`/**/info`, `{*path}/resources`). Only mid-pattern use and a second multi-segment wildcard stay invalid, so `/files/**/download` still fails. Rewrite "only at the end" |
| L2-63 | Master | syl/05-distributed.md:35; p13/08-spring-security-resource-server/01-what-the-starter-gives-you.md:219-220 | Replace `oauth2ResourceServer().jwt()` with `oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))` |
| L2-04 | Master | p13/08-spring-security-resource-server/01-what-the-starter-gives-you.md:69,179,215; p13/02-the-four-roles/06-mapping-onto-your-stack.md:128-130 | Use `spring-boot-starter-security-oauth2-resource-server` / `-client`, and say the old ids are deprecated since Boot 4.0 |
| L3-14 | Master | p9/06-configuration-and-profiles/06-defaults-and-validation.md:66-67, 209 | On Boot 4.1 a constructor-bound `Optional` gets `Optional.empty()`. The null rule was 4.0. "Not recommended" still stands |
| L1-14 | Understand | p9/12-outbound-http/09-the-pool-is-the-real-limit.md:102-117, 129-134 | Since Framework 6.2 a bare `retrieve()` is a no-op: nothing is sent and nothing leaks. The bug is a silently skipped DELETE; the `toBodilessEntity()` fix stays |
| L2-02 | Understand | p9/01-why-frameworks-servlet-model/04-the-embedded-container.md:130-133; p9/12-outbound-http/02-wiring-it-in-boot-4.md:41-43; p9/15-webflux-reactive/06-annotated-controllers.md:42 | `spring-boot-starter-web` still resolves on 4.x (deprecated; 4.1.1 is on Central). Align with p9/05-auto-configuration/01-what-a-starter-is.md:120-123, which is right. Only `spring-boot-starter-aop` truly vanished |
| L2-28 | Know | p10/05-sql-first-access/06b-the-translator-chain.md:135-138 | The property is `spring.persistence.exceptiontranslation.enabled` since Boot 4.0, and the auto-config moved to `org.springframework.boot.persistence` |

### 5b · MISSING, by version — tier and the existing page each would sit beside (all paths ls-verified)

| Row | Tier | Beside | | Row | Tier | Beside |
|---|---|---|---|---|---|---|
| L1-02 | Know | p9/04-bean-scopes-lifecycle/05-startup-shutdown-and-cycles.md | | L1-03 | Understand | p9/06-configuration-and-profiles/08-typed-properties-vs-value.md |
| L1-09 | Know | p9/07-rest-controllers/03-the-named-inputs.md | | L1-10 | When Needed | p9/07-rest-controllers/07-the-response.md |
| L1-12 | Know | p9/12-outbound-http/03-the-fluent-api.md | | L1-15 | Know | p9/06-configuration-and-profiles/10-conversion-and-units.md |
| L1-17 | Know | p9/06-configuration-and-profiles/08-typed-properties-vs-value.md | | L1-23 | Know | p12/07-logging-done-right/08-what-never-to-log.md (phase 12, java-jdk lane) |
| L1-26 | Know | p9/10-the-request-pipeline/10-threads-scope-and-async.md | | L1-27 | Know | p9/10-the-request-pipeline/07-observability-and-correlation.md |
| L1-30 | Know | p9/05-auto-configuration/04-bean-conditions-and-back-off.md | | L1-31 | Understand | p9/08-validation/07-the-failure.md |
| L1-33 | When Needed | p10/14-spring-data-other/06-redistemplate.md | | L1-36 | Know | p9/11-spring-security/11-password-encoding.md |
| L1-38 | Know | p10/14-spring-data-other/01-one-idiom-many-stores.md | | L1-39 | When Needed | p11/01-junit-5/10c-resolving-parameters.md |
| L1-43 | Know | p11/01-junit-5/02b-what-junit-6-changed.md | | L1-46 | Know | p10/13-jooq/04c-record-mappers-and-converters.md |
| L2-22 | Know | p9/10-the-request-pipeline/10-threads-scope-and-async.md | | L2-23 | Understand | p9/10-the-request-pipeline/07-observability-and-correlation.md |
| L2-24 | When Needed | p9/12-outbound-http/01-the-client-you-should-reach-for.md | | L2-25 | Understand | p9/07-rest-controllers/10-shaping-the-json.md |
| L2-26 | When Needed | p9/06-configuration-and-profiles/01-the-environment-and-precedence.md | | L2-27 | Know | p9/16-the-alternatives/07-choosing.md |
| L2-31 | Know | p10/09-spring-data-jpa/07-specifications-and-criteria.md | | L2-32 | Know | p9/10-the-request-pipeline/07-observability-and-correlation.md |
| L2-36 | When Needed | p9/05-auto-configuration/08-excluding-and-writing-your-own.md | | L2-42 | Know | p9/10-the-request-pipeline/10-threads-scope-and-async.md |
| L2-43 | Know | p9/07-rest-controllers/07-the-response.md | | L2-44 | When Needed | p9/06-configuration-and-profiles/08-typed-properties-vs-value.md |
| L2-45 | Understand | p11/01-junit-5/10-extensions.md | | L2-49 | Understand | p9/02-the-ioc-container/09-configuration-classes.md |
| L2-50 | When Needed | p9/06-configuration-and-profiles/08-typed-properties-vs-value.md | | L2-51 | Understand | p9/10-the-request-pipeline/04-aop-at-the-web-boundary.md |
| L2-55 | When Needed | p10/06-jpa-hibernate-model/11-the-persistence-context.md | | L2-57 | Know | p9/12-outbound-http/04-http-interfaces.md |
| L2-60 | Know | p9/11-spring-security/12-cors-for-an-spa.md | | L2-61 | Know | p9/12-outbound-http/08-pinning-the-factory-tls-proxy.md |
| L2-66 | Understand | p9/11-spring-security/08-method-vs-url-security.md | | L2-67 | Know | p9/11-spring-security/05-configuring-the-chain.md |
| L2-76 | When Needed | p9/07-rest-controllers/09-jackson-3-what-changed.md | | L2-78 | Know | p11/06-mockmvc/08i-post-processors-and-asserting-identity.md |
| L2-79 | Know | p10/09-spring-data-jpa/03f-what-is-checked-and-when.md | | L2-80 | Know | p10/09-spring-data-jpa/05c-sort-is-not-free.md |
| L2-84 | Know | p10/09-spring-data-jpa/03g-native-queries.md | | L2-86 | When Needed | p10/14-spring-data-other/01-one-idiom-many-stores.md |
| L2-95 | When Needed | p11/04-mockito/03e-unstubbed-defaults.md | | L2-96 | When Needed | p11/04-mockito/11c-mocking-construction.md |
| L2-100 | Know | p11/07-testcontainers/02-what-testcontainers-is.md | | L2-107 | Understand | p15/README.md (row 03 must absorb Kafka share groups) |
| L3-08 | Know | p9/10-the-request-pipeline/07-observability-and-correlation.md | | L3-11 | Know | p10/09-spring-data-jpa/03f-what-is-checked-and-when.md |
| L3-12 | Know | p10/14-spring-data-other/06-redistemplate.md | | L3-16 | When Needed | p9/16-the-alternatives/07-choosing.md |
| L3-17 | When Needed | p10/05-sql-first-access/12d-the-jdbctest-slice.md | | L3-18 | When Needed | p11/05-the-test-pyramid/04b-webenvironment.md |
| L3-19 | Know | p9/11-spring-security/06-matchers-and-multiple-chains.md | | L3-21 | Understand | p10/09-spring-data-jpa/02d-property-paths-and-ambiguity.md |
| L3-22 | When Needed | p10/08-the-n-plus-1-problem/12c2-dto-projections-in-spring-data.md | | L3-23 | Know | p10/14-spring-data-other/01-one-idiom-many-stores.md |
| L3-25 | When Needed | p10/12-caching/05c-expiry-and-eviction.md | | L3-29 | When Needed | p10/13-jooq/05-writes.md |
| L3-30 | Know | p11/04-mockito/11-static-and-final.md | | L3-31 | Know | p11/04-mockito/03e-unstubbed-defaults.md |
| L4-03 | Know | p11/01-junit-5/09b-tempdir-cleanup.md | | L4-04 | When Needed | p11/01-junit-5/02b-what-junit-6-changed.md |
| L4-05 | When Needed | p11/01-junit-5/12-parallel-execution.md | | L4-06 | Know | p11/01-junit-5/12-parallel-execution.md |
| L4-07 | When Needed | p11/01-junit-5/02b-what-junit-6-changed.md | | L4-08 | Know | p11/03-parameterized-tests/04-methodsource.md |
| L4-10 | When Needed | p11/01-junit-5/02b-what-junit-6-changed.md | | L4-11 | Know | p11/04-mockito/11-static-and-final.md |
| L4-12 | When Needed | p11/04-mockito/02c-choosing-a-mock-maker.md | | L4-13 | Know | p11/04-mockito/11-static-and-final.md |
| L4-14 | Understand | p10/11-flyway-migrations/07-boot-integration.md | | L4-15 | When Needed | p10/11-flyway-migrations/07-boot-integration.md |
| L5-02 | Know | p9/07-rest-controllers/02-narrowing-the-match.md | | L5-03 | Know | p9/07-rest-controllers/04-binding-the-body.md |
| L5-04 | When Needed | p9/07-rest-controllers/10-shaping-the-json.md | | L5-05 | Understand | p9/10-the-request-pipeline/06-what-spring-gives-you.md |
| L5-06 | Know | p9/09-error-handling/05-controlleradvice.md | | L5-07 | When Needed | p9/11-spring-security/12-cors-for-an-spa.md |
| L5-09 | Know | p10/09-spring-data-jpa/03-at-query-jpql.md | | L5-10 | When Needed | p10/14-spring-data-other/06-redistemplate.md |

Tier totals for the 84 MISSING rows: **Understand 12 · Know 44 · When Needed 28 · Master 0**. No Master-tier
feature is missing; the Master-tier problems are all in 5a. L4 and L5 rows sit past the pin, so they need a
version guard ("from JUnit 6.1", "from Framework 7.1") until the pins move.

### 5c · PARTIAL — extend in place (the evidence page is the page to extend)

Understand: L1-04, L1-13, L1-16, L2-06, L2-54, L2-64, L2-65, L2-83, L3-02, L3-07, L3-09, L3-10, L5-01 ·
Know: L1-05, L1-19, L1-20, L1-24, L1-25, L1-34, L1-47, L2-13, L2-33, L2-40, L2-47, L2-71, L2-72, L2-75, L2-104,
L3-04, L3-13, L3-20, L3-24, L4-09 (33 rows).
Highest value: **L2-06**, the Boot 4 per-technology test starters. Phase 11 tells readers `spring-boot-starter-test`
"is the whole thing", which leaves `@WebMvcTest` and `@WithMockUser` unresolved on a Boot 4 classpath. Next is
**L2-65**, the Security 7 MFA model.

### 5d · Stale claims that are not table rows (from §2c)

Fix in the same pass: S1 `p16/README.md:7` (target Boot 3.x → 4.1.1; Resilience4j ≥ 2.4.0) · S2 `p14/README.md:25`
("0 of 12 written") · S3 Spring gRPC 1.0.3 → 1.1.x in `p14/04-sync-vs-async/04b-deadline-propagation.md:17` and
`p14/_PHASE-NOTES.md:18,71,127` · S4 springdoc 3.1.0 → 3.1.1 · S5 Helidon 27.0.0 GA · S6/S7 "Phase 11 (not written
yet)" links · S8 syllabus "JUnit 5" → JUnit 6 · S15 Hibernate 7.4.1 → the BOM's 7.4.5.Final across 243 Verified
lines (patch drift; a sweep, not a rewrite) · S17 Quarkus 3.27 LTS support ends today.

### 5e · `src/data/pins.js` — proposed corrections (report only, not edited)

| Pin | Now | Evidence | Proposal |
|---|---|---|---|
| `flyway` | `'12'`, policy `latest` | 13.7.0 is latest, but Boot 4.1.1 manages **12.4.0** and even 4.2.0-M1 manages **12.11.0** | **Freeze at 12** for the open 2026-09-06 decision, and set the policy to follow Boot's BOM. Sweeping to 13 would teach a version no Boot line manages yet, and L4-14 (module split) must land first |
| `junit` | `6.0.3`, `latest` | 6.1.3 is latest; Boot 4.1.1 manages 6.0.3; 4.2.0-M1 moves to 6.1.3. The corpus deliberately teaches the Boot-managed version (p11/01-junit-5/02b-what-junit-6-changed.md:237-239) | Keep 6.0.3, but switch the policy to "Boot-managed" so the currency job stops flagging a drift the pages argue against. Bump with Boot 4.2 GA |
| `mockito` | `5.23.0`, `latest` | 5.24.0 released 2026-09-23; Boot 4.1.1 manages 5.23.0 | same as junit — Boot-managed |
| `jooq` | `'3.21'` | latest 3.21.8; BOM 7 → 3.21.7 | no change |
| `testcontainers`, `springBoot`, `springFramework` | 2.0.5 / 4.1.1 / 7.0.9 | all current, all match the BOM | no change |
| *(missing)* `springSecurity` · `springData` · `springCloud` · `hibernate` · `springGrpc` · `resilience4j` · `springdoc` · `springModulith` | — | pages name 7.1.1 · JPA 4.1.0 · 2025.1.x · 7.4.1 · 1.0.3 · 2.x · 3.1.0 · 2.1.1. Current: 7.1.1 · 2026.0.1 · 2025.1.3 · 7.4.5.Final (BOM) · 1.1.1 · 2.4.0 · 3.1.1 · 2.1.1 | **Add them.** S3, S4 and S15 went unnoticed because nothing pins these; `hibernate` and `springGrpc` would have caught two stale spines |

**Environment note (2026-09-24 13:08):** during this run the store's `devbible/` directory became a symlink to
`/mnt/Storage/Backup/Knowledge/devbible/docs/_project` (per the updated `store-commit.sh` header, "user's order").
These four report files therefore physically live in the devbible repo, under `docs/_project/version-coverage/`.
`store-commit.sh` committed them there, and no corpus page was touched. Docusaurus skips `_`-prefixed directories,
so the files do not enter the site build (`docusaurus.config.js:141-143` keeps `'**/_*/**'` in `exclude`).
