---
title: "Link map · Java · Part 4 (phases 9–10–11–12)"
sidebar_label: "04 · spring data testing jvm"
sidebar_position: 4
---

# Link map · Java · Part 4 (phases 9–10–11–12)

Covers every topic row in phase 9 (Spring Boot and the web, T09-01 to T09-16) and phase 10 (data access, T10-01 to T10-14) from `docs/java/syllabus/03-application.md`, and phase 11 (testing, T11-01 to T11-12) and phase 12 (the JVM in production, T12-01 to T12-15) from `docs/java/syllabus/04-production.md`. That is 57 rows, and all 57 have a written page of ours (each topic is a directory of chunk files; the header names the first chunk).

*read* = I read the passage that supports the claim; *headings only* = fetched, headings or size checked; *fetched, not read* = the URL returned 200 but I did not read the text; *not fetchable* = the server refused my fetch, so the page is not listed as a link. Third-party links carry a date only where the page shows one. No `#anchors` are given.

🔴 **Search coverage is incomplete, and the verification pass could not close the gap.** The researcher's web-search allowance ran out partway through: every row of phases 9 and 10 and T11-01 to T11-10 got at least one real search, but **T11-11, T11-12 and all of phase 12 (T12-01 to T12-15) were NOT searched**. The verification pass then found the shared search budget already spent, so it ran **no searches of its own**. Instead it fetched, by direct address, pages it knew by name; the ones that checked out were added (T09-12, T09-15, T11-06, T11-07, T11-08, T11-10, T11-11, T12-01, T12-09, T12-10, T12-11, T12-14), and every addition says what was and was not read. The blocks still marked `Search status` have **never had a real search**, and blocks with no Beyond line in phases 9 to 11 were searched only by the researcher, so a better non-official explanation may exist for any of them. Several well-known third-party sites (Baeldung, DZone, Medium) refused the researcher's fetches, so they are left out even where a search surfaced them.

🔴 **Version note.** Our syllabus targets **JDK 25 LTS** (`docs/java/README.md`) and, per the phase notes, **Spring Boot 4.1.1 / Spring Framework 7.0.9**. Official `docs.spring.io` links point at the current reference. Most third-party picks are older and predate Boot 3 and 4: Fowler on dependency injection (2004), the jdriven auto-configuration post (Boot 1.2.5, 2015), the Hibernate pieces by Vlad Mihalcea (2016 to 2020), the Reflectoring MockMvc post (2021, JUnit 5.2 era) and the JUnit 5 intro (2018). The JUnit user guide that `docs.junit.org/current` now serves documents **JUnit 6.1.3** (our phase notes pin 6.0.3); the topic names say JUnit 5 because that is the Jupiter model's own name. Concepts hold; annotations and property names may differ, so check against the official page.

---

## Phase 9 — Spring Boot and the web

### T09-01 · Servlet model, embedded Tomcat, a thread per request — Understand · ✅ written `docs/java/pages/phase-9-spring-boot/01-why-frameworks-servlet-model/01-the-servlet-contract.md`
- **Read this:** [DispatcherServlet](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet.html) · Spring Framework reference · the front controller that Spring MVC hangs off the servlet container (*fetched, not read*) · covers our angle: **partial** — the thread-per-request model is the container's, not stated here · fetched 2026-10-13
- **Also good:** [Embracing Virtual Threads](https://spring.io/blog/2022/10/11/embracing-virtual-threads) · Mark Paluch, Spring blog, 2022-10-11 · virtual threads mainly help I/O-intensive applications that make blocking calls, which is the thread-per-request cost story; also warns that `synchronized` blocks can pin the carrier thread (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Inside a Spring Boot Request](https://www.codingshuttle.com/blogs/inside-a-spring-boot-request-threads-security-transactions-memory-and-system-limits) · Shreyash Gurav, Coding Shuttle, 2026-03-15 · walks the Tomcat pool settings (`threads.max`, `accept-count`) and what happens when the pool fills, then DispatcherServlet routing; filter coverage is shorter · fetched 2026-10-13 (*read*)
- **Our delta:** one servlet instance shared by many threads, so beans must be stateless; the container, not Spring, owns the thread.

### T09-02 · The IoC container — Master · ✅ written `docs/java/pages/phase-9-spring-boot/02-the-ioc-container/01-the-inversion.md`
- **Read this:** [Introduction to the Spring IoC Container and Beans](https://docs.spring.io/spring-framework/reference/core/beans/introduction.html) · Spring Framework reference · the container, `BeanFactory` and `ApplicationContext`, what a bean is (*fetched, not read*) · covers our angle: **partial** — a reference, not a story of why you stop calling `new` · fetched 2026-10-13
- **Beyond the docs:** [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) · Martin Fowler, 2004-01-23 · where the term dependency injection comes from; compares constructor, setter and service locator, and states a preference for constructor injection (*read*) · predates annotations, so the code is XML-era · fetched 2026-10-13
- **Our delta:** component scanning and `@Bean` methods as one object graph you declare rather than build.

### T09-03 · Dependency injection, constructor first — Master · ✅ written `docs/java/pages/phase-9-spring-boot/03-dependency-injection/01-what-di-buys.md`
- **Read this:** [Dependency Injection](https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html) · Spring Framework reference · constructor-based versus setter-based injection and the team's recommendation (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Why field injection is evil](https://odrotbohm.de/2013/11/why-field-injection-is-evil/) · Oliver Drotbohm (Spring team member), 2013-11-22 · field injection allows an invalid object, hides dependencies, and forces reflection in tests; constructor injection fixes all three (*read*) · fetched 2026-10-13
- **Our delta:** `final` fields and no proxy needed; field `@Autowired` as the reviewer smell.

### T09-04 · Bean scopes, lifecycle, circular dependencies — Understand · ✅ written `docs/java/pages/phase-9-spring-boot/04-bean-scopes-lifecycle/01-singleton-and-statelessness.md`
- **Read this:** [Bean Scopes](https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html) · Spring Framework reference · singleton as the default, prototype and the web scopes (*fetched, not read*) · covers our angle: **partial** — nothing on circular-dependency errors · fetched 2026-10-13
- **Also good:** [Customizing the Nature of a Bean](https://docs.spring.io/spring-framework/reference/core/beans/factory-nature.html) · Spring Framework reference · lifecycle callbacks including `@PostConstruct` (*fetched, not read*) · fetched 2026-10-13
- **Our delta:** why a singleton default forces stateless beans, and reading the circular-dependency stack trace.

### T09-05 · Spring Boot starters and auto-configuration — Understand · ✅ written `docs/java/pages/phase-9-spring-boot/05-auto-configuration/01-what-a-starter-is.md`
- **Read this:** [Auto-configuration](https://docs.spring.io/spring-boot/reference/using/auto-configuration.html) · Spring Boot reference · how it works, replacing it, and the `--debug` report (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Creating Your Own Auto-configuration](https://docs.spring.io/spring-boot/reference/features/developing-auto-configuration.html) · Spring Boot reference · the `@Conditional` annotations and how a candidate is chosen (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [Spicy Spring: Report applied auto-configuration](https://jdriven.com/blog/2015/09/spicy-spring-report-applied-auto-configuration-spring-boot) · Hubert Klein Ikkink, JDriven, 2015-09-24 · shows `--debug` printing positive and negative condition matches; a Boot 1.x post, so the output format has changed (*read*) · fetched 2026-10-13
- **Our delta:** reading a negative match to learn why a bean did not load.

### T09-06 · Configuration, `@ConfigurationProperties`, profiles — Master · ✅ written `docs/java/pages/phase-9-spring-boot/06-configuration-and-profiles/01-the-environment-and-precedence.md`
- **Read this:** [Externalized Configuration](https://docs.spring.io/spring-boot/reference/features/external-config.html) · Spring Boot reference · the property-source order, binding, `@ConfigurationProperties` (*fetched, not read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Profiles](https://docs.spring.io/spring-boot/reference/features/profiles.html) · Spring Boot reference (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [Configuration Properties in Spring Boot](https://reflectoring.io/spring-boot-configuration-properties/) · Tom Hombergs, Reflectoring, 2019-03-18 · type-safe binding, activating the class, unknown or unconvertible properties, validation at startup; does not cover profiles or constructor binding (*read*) · fetched 2026-10-13
- **Our delta:** profiles and env-var overrides as the 12-factor pattern.

### T09-07 · REST controllers — Master · ✅ written `docs/java/pages/phase-9-spring-boot/07-rest-controllers/01-the-controller-and-the-pipeline.md`
- **Read this:** [Annotated Controllers](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller.html) · Spring Framework reference · `@RestController`, mappings, `@RequestBody`, `ResponseEntity` (*fetched, not read*) · covers our angle: **partial** — a reference, with no guidance on choosing status codes · fetched 2026-10-13
- **Our delta:** status codes chosen on purpose, and records as request bodies. A search for a third-party explainer found only pages I could not fetch or that were thin listicles.

### T09-08 · Validation at the edge — Understand · ✅ written `docs/java/pages/phase-9-spring-boot/08-validation/01-why-validate-at-the-edge.md`
- **Read this:** [Java Bean Validation](https://docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html) · Spring Framework reference · wiring Bean Validation into Spring (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Validation with Spring Boot — the Complete Guide](https://reflectoring.io/bean-validation-with-spring-boot/) · Tom Hombergs, Reflectoring, updated 2021-08-05 · `@Valid` versus `@Validated`, a custom validator, and handling validation errors in controllers (*read*) · fetched 2026-10-13
- **Our delta:** reject at the controller, keep the domain clean.

### T09-09 · Error handling and `ProblemDetail` — Master · ✅ written `docs/java/pages/phase-9-spring-boot/09-error-handling/01-the-error-shape-is-a-contract.md`
- **Read this:** [Error Responses](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html) · Spring Framework reference · `ProblemDetail`, `ErrorResponse`, `ResponseEntityExceptionHandler` with `@ControllerAdvice` (*fetched, not read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457) · IETF · the standard behind the JSON shape (*fetched, not read*) · fetched 2026-10-13
- **Our delta:** one error shape for the whole API and no stack traces to clients.

### T09-10 · Request pipeline: filters, interceptors, AOP — Understand · ✅ written `docs/java/pages/phase-9-spring-boot/10-the-request-pipeline/01-the-full-path.md`
- **Read this:** [Interceptors](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-config/interceptors.html) · Spring Framework reference · `HandlerInterceptor` registration and its place after the DispatcherServlet (*fetched, not read*) · covers our angle: **partial** — nothing comparing it to servlet filters or AOP · fetched 2026-10-13
- **Our delta:** which layer owns auth, logging and metrics. A search found a clear third-party comparison (Baeldung), but it refused my fetch, so it is not listed.

### T09-11 · Spring Security, the working subset — Understand · ✅ written `docs/java/pages/phase-9-spring-boot/11-spring-security/01-one-filter-three-objects.md`
- **Read this:** [Servlet Security: The Big Picture](https://docs.spring.io/spring-security/reference/servlet/architecture.html) · Spring Security reference · `DelegatingFilterProxy`, `FilterChainProxy`, `SecurityFilterChain` (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [OAuth 2.0 Resource Server JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html) · Spring Security reference · the stateless JWT resource-server setup (*fetched, not read*) · [Spring Security without the WebSecurityConfigurerAdapter](https://spring.io/blog/2022/02/21/spring-security-without-the-websecurityconfigureradapter) · Spring blog, 2022-02-21 · the bean-based configuration style (*fetched, not read*) · fetched 2026-10-13
- **Our delta:** CORS and CSRF decisions for an SPA plus API. OAuth2 and OIDC proper are phase 13.

### T09-12 · Outbound HTTP: `RestClient`, `WebClient` — Understand · ✅ written `docs/java/pages/phase-9-spring-boot/12-outbound-http/01-the-client-you-should-reach-for.md`
- **Read this:** [REST Clients](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html) · Spring Framework reference · `RestClient`, `WebClient`, `RestTemplate` and the declarative HTTP interfaces (*fetched, not read*) · covers our angle: **partial** — timeouts are set on the underlying request factory, not stated up front · fetched 2026-10-13
- **Also good:** [The state of HTTP clients in Spring](https://spring.io/blog/2025/09/30/the-state-of-http-clients-in-spring/) · Brian Clozel, Spring blog, 2025-09-30 · RestClient for most cases, WebClient when you need reactive or streaming, and RestTemplate on a deprecation path; says nothing about timeouts (*read*) · fetched 2026-10-13
- **Our delta:** per-call timeouts and error mapping. The third-party timeout article the researcher's search found (DZone) refused a fetch; the verifier's direct-fetch pass found nothing that covers timeouts.

### T09-13 · Actuator: health, metrics, locking it down — Understand · ✅ written `docs/java/pages/phase-9-spring-boot/13-actuator/01-what-actuator-is.md`
- **Read this:** [Endpoints](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html) · Spring Boot reference · exposing, securing and the endpoint list (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Liveness and Readiness Probes with Spring Boot](https://spring.io/blog/2020/03/25/liveness-and-readiness-probes-with-spring-boot/) · Brian Clozel, Spring blog, 2020-03-25 (updated for 2.3.0.RC1) · a failed liveness check should mean restart, and external dependencies in probes need careful thought (*read*) · fetched 2026-10-13
- **Our delta:** locking down `heapdump` and `env` before they leak.

### T09-14 · OpenAPI with springdoc — Know · ✅ written `docs/java/pages/phase-9-spring-boot/14-openapi-springdoc/01-what-openapi-is.md`
- **Read this:** [springdoc-openapi](https://springdoc.org/) · springdoc project · the starter, properties and annotations (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Spring Boot 3 OpenAPI Docs with Springdoc and Swagger](https://howtodoinjava.com/spring-boot/springdoc-openapi-rest-documentation) · Lokesh Gupta, HowToDoInJava, 2026-10-06 · uses springdoc 3.1.1 with Spring Boot 4.1.1, our target; covers security schemes, disabling the docs in production, and fixing Swagger UI 404s (*read*) · fetched 2026-10-13
- **Our delta:** the generated spec as the contract the frontend consumes.

### T09-15 · WebFlux and reactive — Know · ✅ written `docs/java/pages/phase-9-spring-boot/15-webflux-reactive/01-the-problem-reactive-solved.md`
- **Read this:** [Overview (Spring WebFlux)](https://docs.spring.io/spring-framework/reference/web/webflux/new-framework.html) · Spring Framework reference · why WebFlux was created, including the case against blocking threads (*fetched, not read*) · covers our angle: **partial** — written before virtual threads · fetched 2026-10-13
- **Also good:** [Embracing Virtual Threads](https://spring.io/blog/2022/10/11/embracing-virtual-threads) · Mark Paluch, Spring blog, 2022-10-11 · virtual threads reduce the need for async code while reactive stays good for composing streams (*read*) · [JEP 444: Virtual Threads](https://openjdk.org/jeps/444) · OpenJDK (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [What Color is Your Function?](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/) · Bob Nystrom, 2015-02-01 · why async functions split a codebase into two kinds that spread up the call chain, and why thread-based languages avoid it; not about Java or Spring, so it explains the idea behind our "colored functions" point and nothing else (*read*) · fetched 2026-10-13
- **Our delta:** the cost of reactive (colored functions) and why blocking MVC became the default answer again.

### T09-16 · Quarkus, Micronaut, Helidon — Know · ✅ written `docs/java/pages/phase-9-spring-boot/16-the-alternatives/01-the-trade.md`
- **Read this:** [Contexts and Dependency Injection](https://quarkus.io/guides/cdi-reference) · Quarkus guide · build-time DI in Quarkus (*fetched, not read*) · covers our angle: **partial** · [Micronaut](https://micronaut.io/) · project home page (*fetched, not read*) · fetched 2026-10-13
- **Our delta:** build-time DI and native-image friendliness as the trade. The comparison articles a search found were benchmark-heavy and conflicted on numbers, so none is listed.

---

## Phase 10 — Data access

### T10-01 · JDBC, `PreparedStatement`, try-with-resources — Master · ✅ written `docs/java/pages/phase-10-data-access/01-jdbc/01-what-jdbc-actually-is.md`
- **Read this:** [JDBC Basics](https://docs.oracle.com/javase/tutorial/jdbc/basics/index.html) · Oracle Java Tutorials · connections, statements, result sets (*fetched, not read*) · covers our angle: **partial** — older tutorial, long on legacy style · fetched 2026-10-13
- **Also good:** [SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) · OWASP · parameterized queries as the primary defence (*fetched, not read*) · fetched 2026-10-13
- **Our delta:** parameterized always, and `ResultSet` mapping by hand.

### T10-02 · Connection pooling with HikariCP — Understand · ✅ written `docs/java/pages/phase-10-data-access/02-connection-pooling/01-what-the-pool-hands-you.md`
- **Read this:** [About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) · HikariCP wiki · the formula `core_count * 2 + effective_spindle_count`, and the Oracle example of 2048 connections cut to 96 with response time falling from about 100 ms to 2 ms (*read*, from the wiki's raw markdown: the github.com address itself answers 403 to automated fetches, so it was not confirmed as 200) · covers our angle: **partial** — nothing on leak detection or the "not available" error; the formula is credited there to the PostgreSQL project, whose own wiki (the next line) says the same · fetched 2026-10-13
- **Also good:** [Number Of Database Connections](https://wiki.postgresql.org/wiki/Number_Of_Database_Connections) · PostgreSQL wiki · throughput rises with connections only until resources saturate; use an external pool; the same core-count formula as a starting point to tune on your own system (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The best way to determine the optimal connection pool size](https://vladmihalcea.com/optimal-connection-pool-size/) · Vlad Mihalcea, 2024-11-07 · gives no fixed formula; ties size to the database's throughput peak and recommends measuring, growing the pool on demand with FlexyPool to find the number · fetched 2026-10-13 (*read*)
- **Our delta:** small pools, leak detection, and reading "connection is not available" under load.

### T10-03 · JDBC transactions and isolation anomalies — Understand · ✅ written `docs/java/pages/phase-10-data-access/03-jdbc-transactions/01-autocommit-is-a-transaction-you-did-not-choose.md`
- **Read this:** [Using Transactions](https://docs.oracle.com/javase/tutorial/jdbc/basics/transactions.html) · Oracle Java Tutorials · `setAutoCommit(false)`, commit, rollback (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) · PostgreSQL documentation · the real anomalies per level in Postgres (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [Postgres transaction isolation levels](https://malisper.me/postgres-transaction-isolation-levels/) · malisper, 2017-06-21 (updated 2019-04-20) · Repeatable Read prevents lost updates by aborting one of two conflicting UPDATEs; suggests `SELECT ... FOR UPDATE` under Read Committed instead · fetched 2026-10-13 (*read*)
- **Our delta:** lost update and non-repeatable read tied to code you can write.

### T10-04 · Spring `@Transactional` — Master · ✅ written `docs/java/pages/phase-10-data-access/04-spring-transactional/01-not-a-language-feature.md`
- **Read this:** [Using @Transactional](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html) · Spring Framework reference · in proxy mode only external calls are intercepted, so self-invocation gives no transaction; method visibility rules; `aspectj` mode as the escape (*read*) · covers our angle: **partial** — the page states the default (RuntimeException and Error roll back, checked exceptions do not) and lists `rollbackFor`, but the full rollback semantics sit on a linked page · fetched 2026-10-13
- **Also good:** [Proxying Mechanisms](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html) · Spring Framework reference (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [Spring Transaction Management: @Transactional In-Depth](https://www.marcobehler.com/guides/spring-transaction-management-transactional-in-depth) · Marco Behler, last updated 2022-06-03 · proxy types, the self-invocation pitfall and all seven propagation modes; the rollback section is a placeholder ("will be handled in the next revision") and `readOnly` appears only in a comment reply, so neither of those two points of our delta is covered · fetched 2026-10-13 (*read*)
- **Our delta:** unchecked-only rollback by default, and `readOnly`.

### T10-05 · SQL-first: `JdbcTemplate` and `JdbcClient` — Understand · ✅ written `docs/java/pages/phase-10-data-access/05-sql-first-access/01-why-sql-first-exists.md`
- **Read this:** [Data Access with JDBC](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html) · Spring Framework reference · `JdbcTemplate`, `NamedParameterJdbcTemplate`, `JdbcClient` (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Our delta:** when a typed query beats an entity graph. The Baeldung `JdbcClient` guide a search found refused my fetch.

### T10-06 · The JPA/Hibernate model and persistence context — Understand · ✅ written `docs/java/pages/phase-10-data-access/06-jpa-hibernate-model/01-what-an-entity-is.md`
- **Read this:** [Hibernate ORM User Guide](https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html) · Hibernate project · entities, identifiers, the persistence context (*fetched, not read*; one very large page) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [The anatomy of Hibernate dirty checking](https://vladmihalcea.com/the-anatomy-of-hibernate-dirty-checking/) · Vlad Mihalcea (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [The JPA and Hibernate first-level cache](https://vladmihalcea.com/jpa-hibernate-first-level-cache/) · Vlad Mihalcea, 2020-10-27 · the persistence context is the first-level cache, bound to one thread, returning the same managed instance per id · fetched 2026-10-13 (*read*)
- **Our delta:** why a setter call turned into an UPDATE you never wrote.

### T10-07 · Relationships, owning side, fetch types — Understand · ✅ written `docs/java/pages/phase-10-data-access/07-relationships-fetch/01-two-models-one-foreign-key.md`
- **Read this:** [Hibernate ORM User Guide](https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html) · Hibernate project · associations and fetching sections (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Eager fetching is a code smell](https://vladmihalcea.com/eager-fetching-is-a-code-smell/) · Vlad Mihalcea (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [The best way to map a @OneToMany relationship](https://vladmihalcea.com/the-best-way-to-map-a-onetomany-association-with-jpa-and-hibernate/) · Vlad Mihalcea, 2017-03-29 · the child's `@ManyToOne` side controls the association, the parent's collection is `mappedBy`, and helper methods keep both sides in sync · fetched 2026-10-13 (*read*)
- **Our delta:** `EAGER` on a collection as the time bomb.

### T10-08 · The N+1 problem — Master · ✅ written `docs/java/pages/phase-10-data-access/08-the-n-plus-1-problem/01-one-hundred-and-one-queries.md`
- **Read this:** [Hibernate ORM User Guide](https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html) · Hibernate project · fetching strategies (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [N+1 query problem with JPA and Hibernate](https://vladmihalcea.com/n-plus-1-query-problem/) · Vlad Mihalcea, 2020-03-17 · the extra statements each run fast and evade slow-query logs; fix by fetching everything in the original query with `JOIN FETCH` · fetched 2026-10-13 (*read*)
- **Our delta:** seeing it in the SQL log, and `@EntityGraph` or batch size as the other fixes.

### T10-09 · Spring Data JPA: derived queries, paging, projections — Understand · ✅ written `docs/java/pages/phase-10-data-access/09-spring-data-jpa/01-what-a-repository-is.md`
- **Read this:** [Spring Data JPA reference](https://docs.spring.io/spring-data/jpa/reference/) · Spring Data project · repositories, derived queries, `@Query` (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Projections](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html) · Spring Data JPA reference (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [Offset and Keyset Pagination with Spring Data JPA](https://thorben-janssen.com/offset-and-keyset-pagination-with-spring-data-jpa/) · Thorben Janssen · offset slows as the offset grows because skipped rows are still processed; keyset uses a predicate instead; page shows no date. It says Spring Data JPA has no keyset support out of the box and builds one on Hibernate's native API, which predates the Scroll API in current Spring Data (check the Spring Data reference before copying the code) · fetched 2026-10-13 (*read*)
- **Our delta:** DTOs instead of returning entities from controllers.

### T10-10 · Lazy loading and open-session-in-view — Understand · ✅ written `docs/java/pages/phase-10-data-access/10-lazy-loading/01-what-a-proxy-actually-is.md`
- **Read this:** [SQL Databases (Spring Boot)](https://docs.spring.io/spring-boot/reference/data/sql.html) · Spring Boot reference · JPA section, including open-in-view (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [The Open Session In View Anti-Pattern](https://vladmihalcea.com/the-open-session-in-view-anti-pattern/) · Vlad Mihalcea, 2016-05-30 · UI-phase statements run in auto-commit, layers blur, N+1 gets harder to control, connections are held longer; DTO projections as the alternative · fetched 2026-10-13 (*read*)
- **Our delta:** `LazyInitializationException` as the symptom, and turning Boot's default off.

### T10-11 · Migrations with Flyway — Understand · ✅ written `docs/java/pages/phase-10-data-access/11-flyway-migrations/01-why-schema-is-code.md`
- **Read this:** [Database Initialization](https://docs.spring.io/spring-boot/how-to/data-initialization.html) · Spring Boot how-to · Flyway and Liquibase support at startup (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Database Migration with Spring Boot and Flyway](https://reflectoring.io/database-migration-spring-boot-flyway/) · Petromir Dzhunev, Reflectoring, 2020-02-21 · why versioned migrations, SQL and Java scripts, repeatable and undo migrations, placeholders, running in a Jenkins pipeline; names no Boot version and uses Flyway 6.2.3, so treat setup details as dated · fetched 2026-10-13 (*read*)
- **Our delta:** never `ddl-auto: update` in production.

### T10-12 · Caching: Hibernate L2 and `@Cacheable` — Know · ✅ written `docs/java/pages/phase-10-data-access/12-caching/01-caching-is-a-decision.md`
- **Read this:** [Cache Abstraction](https://docs.spring.io/spring-framework/reference/integration/cache.html) · Spring Framework reference · `@Cacheable`, `@CacheEvict` (*fetched, not read*) · covers our angle: **partial** — little on invalidation cost · fetched 2026-10-13
- **Beyond the docs:** [Using a cache](https://www.jhipster.tech/using-cache) · JHipster docs · do not use Spring Cache and the Hibernate second-level cache for the same objects; Spring Cache for aggregates or DTOs, Hibernate for entities; page shows "Last updated on Feb 10, 2017" · fetched 2026-10-13 (*read*)
- **Our delta:** invalidation cost makes it a decision, not a reflex.

### T10-13 · jOOQ — Know · ✅ written `docs/java/pages/phase-10-data-access/13-jooq/01-what-jooq-is.md`
- **Read this:** [jOOQ manual](https://www.jooq.org/doc/latest/manual/) · jOOQ project (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [jOOQ vs. Hibernate: When to choose which](https://blog.jooq.org/jooq-vs-hibernate-when-to-choose-which/) · Lukas Eder (jOOQ's creator), 2015 (the page shows two March 2015 dates) · chooses by whether the data model or the application drives design, and complex reads versus complex object-graph writes; vendor view (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Why jOOQ matters](https://leanpub.com/read/high-performance-Java-persistence/leanpub-auto-why-jooq-matters) · Vlad Mihalcea, High-Performance Java Persistence (free sample chapter on Leanpub) · an independent view: entity queries for read-write transactions, jOOQ for dynamic native SQL and database-specific syntax · fetched 2026-10-13 (*read*)
- **Our delta:** reporting and complex joins as the case for typed SQL.

### T10-14 · Spring Data for MongoDB and Redis — Know · ✅ written `docs/java/pages/phase-10-data-access/14-spring-data-other/01-one-idiom-many-stores.md`
- **Read this:** [Redis Repositories](https://docs.spring.io/spring-data/redis/reference/repositories.html) · Spring Data Redis reference (*fetched, not read*) · covers our angle: **partial** · [MongoDB Repositories](https://docs.spring.io/spring-data/mongodb/reference/repositories.html) · Spring Data MongoDB reference (*fetched, not read*) · fetched 2026-10-13
- **Our delta:** the same repository idiom over other stores. A search found no combined third-party tutorial worth listing.

---

## Phase 11 — Testing

### T11-01 · JUnit 5 — Master · ✅ written `docs/java/pages/phase-11-testing/01-junit-5/01-what-a-test-is-for.md`
- **Read this:** [JUnit User Guide](https://docs.junit.org/6.1.3/overview.html) · JUnit project · annotations, lifecycle, assertions; the current guide documents JUnit 6.1.3, and the address `docs.junit.org/current/user-guide/` redirects here (*fetched, not read*; very large) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [JUnit 5 Basics](https://nipafx.dev/junit-5-basics/) · Nicolai Parlog, 2018-08-05 · a new test instance per method by default, so `@BeforeAll` must be static in that default mode; `assertThrows` returns the exception for further checks. The page does not spell out the `PER_CLASS` exception, and it is a JUnit 5.x-era post · fetched 2026-10-13 (*read*)
- **Our delta:** a test that documents behaviour.

### T11-02 · AssertJ — Understand · ✅ written `docs/java/pages/phase-11-testing/02-assertj/01-why-fluent-assertions.md`
- **Read this:** [AssertJ documentation](https://assertj.github.io/doc/) · AssertJ project (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Asserting Lists with AssertJ](https://reflectoring.io/assertj-lists/) · Mateo Stjepanović, Reflectoring, 2021-10-04 · `extracting()` for properties, `tuple()` for several, `hasSize()` after filtering (*read*) · fetched 2026-10-13
- **Our delta:** failure messages that do the debugging.

### T11-03 · Parameterized tests — Understand · ✅ written `docs/java/pages/phase-11-testing/03-parameterized-tests/01-one-test-many-cases.md`
- **Read this:** [Parameterized Classes and Tests](https://docs.junit.org/6.1.3/writing-tests/parameterized-classes-and-tests.html) · JUnit User Guide 6.1.3 · the `@ParameterizedTest` sources and argument conversion (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [JUnit 5 Parameterized Tests](https://reflectoring.io/tutorial-JUnit5-parameterized-tests/) · Pralhad Hadimani, Reflectoring, 2023-01-29 · inline `@CsvSource` and factory-method `@MethodSource` side by side (*read*) · fetched 2026-10-13
- **Our delta:** every edge of the tax calculation in one test.

### T11-04 · Mockito — Master · ✅ written `docs/java/pages/phase-11-testing/04-mockito/01-what-a-mock-is-for.md`
- **Read this:** [Mockito API](https://javadoc.io/doc/org.mockito/mockito-core/latest/org/mockito/Mockito.html) · Mockito project · the class Javadoc doubles as the manual; the address redirects to the Javadoc index of the latest release (5.24.0 when checked), so open the `Mockito` class from there (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Stubs vs Mocks](https://enterprisecraftsmanship.com/posts/stubs-vs-mocks/) · Enterprise Craftsmanship (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) · Martin Fowler, 2007-01-02 · the five test doubles (dummy, fake, stub, spy, mock) and classical versus mockist TDD (*read*) · fetched 2026-10-13
- **Our delta:** mock boundaries only, never the class under test or value objects.

### T11-05 · The test pyramid in Spring — Understand · ✅ written `docs/java/pages/phase-11-testing/05-the-test-pyramid/01-the-pyramid-and-the-honest-version.md`
- **Read this:** [Testing Spring Boot Applications](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html) · Spring Boot reference · `@SpringBootTest`, the slice annotations, context caching (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Mastering Testing Efficiency in Spring Boot](https://engineering.zalando.com/posts/2023/11/mastering-testing-efficiency-in-spring-boot-optimization-strategies-and-best-practices.html) · Hassan Elseoudy, Zalando Engineering, 2023-11-14 · reusing cached contexts and slices cut a suite from 10 min 7 s to 4 min 15 s (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) · Ham Vocke, martinfowler.com, 2018-02-26 · many small unit tests, fewer integration tests, very few end-to-end; warns against the "test ice-cream cone" (*read*) · fetched 2026-10-13
- **Our delta:** the Spring-specific slice ladder and its build-time cost.

### T11-06 · MockMvc web-layer tests — Understand · ✅ written `docs/java/pages/phase-11-testing/06-mockmvc/01-no-socket-no-server.md`
- **Read this:** [MockMvc](https://docs.spring.io/spring-framework/reference/testing/mockmvc.html) · Spring Framework reference · setup, requests, assertions (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Unit Testing Spring MVC Controllers with @WebMvcTest](https://reflectoring.io/spring-boot-web-controller-test/) · Tom Hombergs, Reflectoring, 2021-12-16 · asserts the status, compares the JSON body with a custom matcher and checks a named field error, with no server; names no Boot version and pins JUnit Jupiter 5.2.0, so the dependency setup is dated (*read*) · fetched 2026-10-13
- **Our delta:** asserting status, JSON body and validation errors with no socket. The researcher's search returned only thin or machine-generated pages; the verifier found the Reflectoring post above by direct fetch.

### T11-07 · Testcontainers — Understand · ✅ written `docs/java/pages/phase-11-testing/07-testcontainers/01-passed-on-h2-proves-nothing.md`
- **Read this:** [PostgreSQL module](https://java.testcontainers.org/modules/databases/postgres/) · Testcontainers for Java (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Testcontainers support (Spring Boot)](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html) · Spring Boot reference · `@ServiceConnection` (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [Testcontainers with Spring Boot: setup with as little overhead as possible](https://maciejwalkowiak.com/blog/testcontainers-spring-boot-setup/) · Maciej Walkowiak, 2023-02-22 · compares `@DynamicPropertySource`, an initializer and a composed annotation, and shows starting containers once and in parallel to avoid per-class startup cost; does not cover `@ServiceConnection` or the Testcontainers reuse feature, and the Boot version is not stated (*read*) · fetched 2026-10-13
- **Our delta:** reuse and startup-cost control. The Rabobank write-up the researcher's search found refused a fetch.

### T11-08 · Test data: builders and object mothers — Understand · ✅ written `docs/java/pages/phase-11-testing/08-test-data-patterns/01-the-forty-line-setup.md`
- **Read this:** [Object Mother](https://martinfowler.com/bliki/ObjectMother.html) · Martin Fowler, 2006-10-24 · a factory for standard example objects; names the coupling cost of many tests sharing exact data (*read*) · covers our angle: **partial** — nothing on builders · fetched 2026-10-13
- **Beyond the docs:** [Test Data Builders: an alternative to the Object Mother pattern](http://www.natpryce.com/articles/000714.html) · Nat Pryce, 2007-08-27 (the date is in the page source) · the Object Mother grows a method per variation; a builder with safe defaults and chainable overrides lets a test state only the values it cares about (*read*) · plain http address (the https address resets the connection) · fetched 2026-10-13
- **Our delta:** builders for aggregates alongside mothers. The researcher's fetch of the Pryce article returned 503; it fetched fine in the verification pass.

### T11-09 · Coverage with JaCoCo — Know · ✅ written `docs/java/pages/phase-11-testing/09-jacoco/01-what-coverage-measures.md`
- **Read this:** [Coverage Counters](https://www.jacoco.org/jacoco/trunk/doc/counters.html) · JaCoCo project (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Test Coverage](https://martinfowler.com/bliki/TestCoverage.html) · Martin Fowler, 2012-04-17 · high numbers are easy to reach with low-quality tests; coverage finds untested code, not good tests (*read*) · fetched 2026-10-13
- **Our delta:** a floor, not a target.

### T11-10 · Property-based testing with jqwik — When Needed · ✅ written `docs/java/pages/phase-11-testing/10-property-based/01-the-case-you-did-not-think-of.md`
- **Read this:** [jqwik User Guide](https://jqwik.net/docs/current/user-guide.html) · jqwik project · documents jqwik 1.10.2; covers `@Property` with `@ForAll` parameter generation, edge cases and result shrinking, where the shrinking mode runs until no smaller failing value is found (*read* the opening 100000 of 278903 characters; the rest is unread) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Property-Based Testing in Java: Introduction](https://blog.johanneslink.net/2018/03/24/property-based-testing-in-java-introduction/) · Johannes Link (jqwik's author), 2018-03-24 · why he took up property-based testing and how properties differ from example-based unit tests; motivation only, it does not teach generators or shrinking and links to later parts of the series for those; examples are for jqwik 1.1.6 (*read*) · fetched 2026-10-13
- **Our delta:** generating the inputs you did not think of. The researcher's Baeldung pick refused a fetch. (The user guide page contained a notice aimed at AI agents; it was ignored.)

### T11-11 · Mutation testing with PIT — When Needed · ✅ written `docs/java/pages/phase-11-testing/11-mutation-testing/01-testing-the-tests.md`
- **Read this:** [PIT mutation testing](https://pitest.org/) · pitest project · injects faults and measures the share your tests catch, which line coverage cannot show (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [State of Mutation Testing at Google](https://research.google/pubs/state-of-mutation-testing-at-google/) · Goran Petrovic and Marko Ivankovic, Google, ICSE-SEIP 2018 (the page lists it as 2017, to appear) · mutation testing made affordable by mutating only changed, covered lines and showing the surviving mutants during code review, at Google scale; abstract page only, not the paper body (*read* the abstract) · fetched 2026-10-13
- **Search status:** NOT searched by the researcher (allowance exhausted) and not searched in verification either; the Google pick was fetched by direct address. The Google Testing Blog post "Mutation Testing" (2021-04-12, Goran Petrovic) returned 200 but its body did not come through my fetch, so it is not listed.

### T11-12 · Real-world testing scenarios — Master · ✅ written `docs/java/pages/phase-11-testing/12-real-world-scenarios/01-what-to-mock-and-what-to-let-run.md`
- **Read this:** [Test Doubles (Software Engineering at Google, ch. 13)](https://abseil.io/resources/swe-book/html/ch13.html) · Andrew Trenk and Dillon Bly, edited by Tom Manshreck · early mocking-framework enthusiasm produced costly, bug-poor tests; prefer real implementations when fast and deterministic, and fakes over stubbing (*read*) · covers our angle: **partial** — language-neutral, no Spring specifics · fetched 2026-10-13
- **Also good:** [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) · Martin Fowler, 2007-01-02 (*read*) · fetched 2026-10-13
- **Search status:** NOT searched (allowance exhausted for both the researcher and the verifier); the picks above were chosen from known pages and then fetched. The Google chapter's claims were re-checked in verification and hold.
- **Our delta:** the four failure modes of mocking and the owned-class versus vendor-client split.

---

## Phase 12 — The JVM in production

🔴 Every block in this phase is **unsearched** (the researcher's allowance ran out, and the verification pass found the budget already spent). Picks were chosen from known pages and fetched, and a few were added in verification by direct fetch; a better non-official explanation may exist for every block.

### T12-01 · Memory layout: heap, metaspace, stacks — Understand · ✅ written `docs/java/pages/phase-12-jvm-production/01-memory-layout/01-heap-is-not-the-process.md`
- **Read this:** [Troubleshooting Guide for JDK 25](https://docs.oracle.com/en/java/javase/25/troubleshoot/) · Oracle · diagnosing memory problems and native memory (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [JVM Anatomy Quark #12: Native Memory Tracking](https://shipilev.net/jvm/anatomy-quarks/12-native-memory-tracking/) · Aleksey Shipilëv, last updated 2019-09-03 · turns on `-XX:NativeMemoryTracking=summary` for a tiny-heap Hello World and shows the rest of the process split into GC, class (metaspace), thread, code and internal memory, and what shrinking each one costs; a JDK 12 to 13 era post, so check numbers on JDK 25 (*read*) · fetched 2026-10-13
- **Also good:** [JVM Anatomy Quarks](https://shipilev.net/jvm/anatomy-quarks/) · Aleksey Shipilëv · the series index of 30 entries; others cover TLAB allocation and GC design (judged from titles only, *headings only*) · fetched 2026-10-13
- **Search status:** not searched.
- **Our delta:** the heap is not the process.

### T12-02 · GC in practice: G1, ZGC — Understand · ✅ written `docs/java/pages/phase-12-jvm-production/02-gc-in-practice/01-what-a-collector-actually-promises.md`
- **Read this:** [HotSpot Virtual Machine Garbage Collection Tuning Guide (JDK 25)](https://docs.oracle.com/en/java/javase/25/gctuning/) · Oracle (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [JEP 474: ZGC: Generational Mode by Default](https://openjdk.org/jeps/474) · OpenJDK (*fetched, not read*) · [JEP 439: Generational ZGC](https://openjdk.org/jeps/439) · OpenJDK (*fetched, not read*) · fetched 2026-10-13
- **Search status:** not searched.

### T12-03 · Heap sizing in containers — Understand · ✅ written `docs/java/pages/phase-12-jvm-production/03-heap-sizing-in-containers/01-the-oomkilled-loop.md`
- **Read this:** [Containerize your Java Applications](https://learn.microsoft.com/en-us/azure/developer/java/containers/overview) · Microsoft Learn (Java on Azure), page updated 2026-06-24 · do not set max heap equal to container memory; `-XX:MaxRAMPercentage=75` as a starting point, default max heap is 25 percent of memory above 512 MB (*read*) · covers our angle: **partial** — it recommends ParallelGC as a microservice starting point, a vendor choice our page need not follow · fetched 2026-10-13
- **Search status:** not searched.
- **Our delta:** the OOMKilled loop, and why the JVM needs memory beyond the heap.

### T12-04 · `OutOfMemoryError` and heap dumps — Understand · ✅ written `docs/java/pages/phase-12-jvm-production/04-out-of-memory-error/01-it-is-an-error-not-an-exception.md`
- **Read this:** [Eclipse Memory Analyzer (MAT)](https://eclipse.dev/mat/) · Eclipse project · the heap-dump analyzer: retained sizes, an automatic leak-suspects report, and who keeps objects from being collected; the front page does not mention the dominator tree (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Search status:** not searched.

### T12-05 · Thread dumps — Understand · ✅ written `docs/java/pages/phase-12-jvm-production/05-thread-dumps/01-the-service-that-stopped-responding.md`
- **Read this:** [Troubleshooting Guide for JDK 25](https://docs.oracle.com/en/java/javase/25/troubleshoot/) · Oracle · diagnostic tools including `jcmd` (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Search status:** not searched. Baeldung's thread-dump article refused my fetch.

### T12-06 · JFR, Mission Control and profiling — Understand · ✅ written `docs/java/pages/phase-12-jvm-production/06-jfr-and-profiling/01-the-regex-that-ate-a-core.md`
- **Read this:** [JDK Flight Recorder (dev.java)](https://dev.java/learn/jvm/jfr/) · dev.java, Oracle · what JFR records and how to start it (*fetched, unverified*: the page is script-rendered, my fetcher returned no body text, so the description is the researcher's and was not checked) · covers our angle: **partial** — async-profiler is not covered; its GitHub page refused my fetch, so it is unlinked here · fetched 2026-10-13
- **Beyond the docs:** [Flame Graphs](https://www.brendangregg.com/flamegraphs.html) · Brendan Gregg, who created them · the x-axis is stack population sorted alphabetically, not time, so a wider frame appeared in more samples; y-axis is stack depth (*read*) · fetched 2026-10-13
- **Search status:** not searched.
- **Our delta:** finding the hot method from a flame graph.

### T12-07 · Logging done right — Master · ✅ written `docs/java/pages/phase-12-jvm-production/07-logging-done-right/01-what-a-log-line-is-for.md`
- **Read this:** [SLF4J user manual](https://www.slf4j.org/manual.html) · SLF4J project · parameterized messages (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Logging (Spring Boot)](https://docs.spring.io/spring-boot/reference/features/logging.html) · Spring Boot reference (*fetched, not read*) · [Logback manual](https://logback.qos.ch/manual/) · Logback project (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [Fast and flexible observability with canonical log lines](https://stripe.com/blog/canonical-log-lines) · Brandur Leach, Stripe, 2019-07-30 · one long log line per request at its end, gathering key telemetry so cross-request queries are simple · fetched 2026-10-13 (*read*)
- **Search status:** not searched.

### T12-08 · Metrics with Micrometer and Prometheus — Understand · ✅ written `docs/java/pages/phase-12-jvm-production/08-metrics-with-micrometer/01-the-average-that-lied.md`
- **Read this:** [Micrometer reference](https://docs.micrometer.io/micrometer/reference/) · Micrometer project (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Metrics (Spring Boot Actuator)](https://docs.spring.io/spring-boot/reference/actuator/metrics.html) · Spring Boot reference (*fetched, not read*) · [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) · Google SRE book (*fetched, not read*) · fetched 2026-10-13
- **Beyond the docs:** [The RED Method](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/) · Julie Dam, Grafana blog, 2018-08-03, summarising Tom Wilkie's talk · request rate, failed share and duration per service (*read*) · fetched 2026-10-13
- **Search status:** not searched.

### T12-09 · Distributed tracing with OpenTelemetry — Know · ✅ written `docs/java/pages/phase-12-jvm-production/09-distributed-tracing/01-the-request-that-vanished.md`
- **Read this:** [Traces](https://opentelemetry.io/docs/concepts/signals/traces/) · OpenTelemetry project · spans, span context (trace id, span id), parent and child spans, and context propagation across services (*read*) · covers our angle: **partial** — nothing on Java auto-instrumentation or the database and queue hops · fetched 2026-10-13
- **Also good:** [OpenTelemetry Java](https://opentelemetry.io/docs/languages/java/) · OpenTelemetry project · a hub page that points to the API, SDK, configuration and instrumentation pages and reports traces, metrics and logs as stable; it does not explain tracing itself (*read*) · [Dapper, a Large-Scale Distributed Systems Tracing Infrastructure](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/) · Google Research · the paper behind modern tracing (*fetched, not read*) · fetched 2026-10-13
- **Search status:** not searched.

### T12-10 · Packaging for deploy — Understand · ✅ written `docs/java/pages/phase-12-jvm-production/10-packaging-for-deploy/01-the-fat-jar.md`
- **Read this:** [Efficient Container Images (Spring Boot)](https://docs.spring.io/spring-boot/reference/packaging/container-images/efficient-images.html) · Spring Boot reference · layered jars (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [JEP 483: Ahead-of-Time Class Loading and Linking](https://openjdk.org/jeps/483) · OpenJDK (*fetched, not read*) · [Creating Docker images with Spring Boot 2.3.0.M1](https://spring.io/blog/2020/01/27/creating-docker-images-with-spring-boot-2-3-0-m1/) · Phil Webb, Spring blog, 2020-01-27 · a fat jar is one layer that rebuilds on every code change, while layers ordered by change rate let Docker reuse cached dependency layers; uses JRE base images in its example but does not discuss a non-root user, and its flags are from Boot 2.3 (*read*) · fetched 2026-10-13
- **Search status:** not searched. A Snyk container-practices article I had in mind returned 404.

### T12-11 · GraalVM native image — Know · ✅ written `docs/java/pages/phase-12-jvm-production/11-graalvm-native-image/01-what-problem-it-solves.md`
- **Read this:** [Native Image reference](https://www.graalvm.org/latest/reference-manual/native-image/) · GraalVM (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Introducing GraalVM Native Images (Spring Boot)](https://docs.spring.io/spring-boot/reference/packaging/native-image/introducing-graalvm-native-images.html) · Spring Boot reference (*fetched, not read*) · [Runtime efficiency with Spring](https://spring.io/blog/2023/10/16/runtime-efficiency-with-spring/) · Sebastien Deleuze, Spring blog, 2023-10-16 · AOT, native images that start in milliseconds, and their costs (longer builds, reflection metadata, a frozen classpath and bean configuration), alongside virtual threads and CRaC (*read*) · fetched 2026-10-13
- **Search status:** not searched.

### T12-12 · Graceful shutdown — Understand · ✅ written `docs/java/pages/phase-12-jvm-production/12-graceful-shutdown/01-the-deploy-that-dropped-requests.md`
- **Read this:** [Graceful Shutdown (Spring Boot)](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html) · Spring Boot reference · graceful shutdown is on by default for Tomcat, Jetty and Reactor Netty; the grace period is `spring.lifecycle.timeout-per-shutdown-phase`; `server.shutdown=immediate` turns it off (*read*) · covers our angle: **partial** — nothing on the load balancer side · fetched 2026-10-13
- **Beyond the docs:** [Graceful shutdown in Kubernetes](https://learnkube.com/graceful-shutdown) · Daniele Polencic, learnk8s, April 2024 · endpoint removal and Pod deletion start in parallel, so traffic can still reach a Pod that is going away; delay in the app or a `preStop` hook (*read*) · the old learnk8s.io address redirects here · fetched 2026-10-13
- **Search status:** not searched.
- **Our delta:** the SIGTERM, stop-accepting, drain, close-pools order. Note the Boot page says graceful is already the default, so our page should not tell readers to set `server.shutdown=graceful` as a required step.

### T12-13 · JVM flags that matter — Know · ✅ written `docs/java/pages/phase-12-jvm-production/13-jvm-flags-that-matter/01-the-flags-you-inherited.md`
- **Read this:** [The java command (JDK 25)](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html) · Oracle · the options reference (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Search status:** not searched. A flags-explorer site I had in mind returned 404.

### T12-14 · Benchmarking honestly with JMH — Know · ✅ written `docs/java/pages/phase-12-jvm-production/14-benchmarking-with-jmh/01-the-benchmark-that-measured-nothing.md`
- **Read this:** [JMHSample_08_DeadCode](https://raw.githubusercontent.com/openjdk/jmh/master/jmh-samples/src/main/java/org/openjdk/jmh/samples/JMHSample_08_DeadCode.java) · OpenJDK JMH samples (source file) · `measureWrong()` discards its result so the compiler can remove the work and the benchmark reports an impossibly fast time; `measureRight()` returns the value; a `baseline()` measures harness overhead (*read*) · covers our angle: **partial** — dead-code elimination only, not warmup; this is the raw file because the github.com address answers 403 to automated fetches · fetched 2026-10-13
- **Also good:** [Nanotrusting the Nanotime](https://shipilev.net/blog/2014/nanotrusting-nanotime/) · Aleksey Shipilëv (JMH author), last updated 2014-09-28 · `System.nanoTime()` costs about 15 to 30 ns per call, is coarse, and is a scalability bottleneck under contention; the experiments use JMH (*read*) · about timer cost, not dead-code elimination or warmup · fetched 2026-10-13
- **Beyond the docs:** [Java Microbenchmark Harness (JMH) Tutorial](https://jenkov.com/tutorials/java-performance/jmh.html) · Jakob Jenkov, last updated 2023-11-27 · thorough on dead-code elimination, `Blackhole` and the `@State` scopes; thin on why warmup matters and silent on `System.nanoTime` loops (*read*) · fetched 2026-10-13
- **Search status:** not searched.

### T12-15 · Checkpoint/restore (CRaC) — When Needed · ✅ written `docs/java/pages/phase-12-jvm-production/15-checkpoint-restore-crac/01-the-cold-start-problem.md`
- **Read this:** [OpenJDK CRaC project](https://openjdk.org/projects/crac/) · OpenJDK (*fetched, not read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Checkpoint/Restore (Spring Framework)](https://docs.spring.io/spring-framework/reference/integration/checkpoint-restore.html) · Spring Framework reference (*fetched, not read*) · [Coordinated Restore at Checkpoint (CRaC) Documentation](https://docs.azul.com/crac/) · Azul docs (the old `core/crac/crac-introduction` address now redirects here) · a snapshot of a warmed-up process starts many JVMs; resources must be closed before the checkpoint and reopened by callbacks after restore (*read*) · fetched 2026-10-13
- **Search status:** not searched.
