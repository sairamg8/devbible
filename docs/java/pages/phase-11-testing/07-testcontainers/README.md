---
title: "Testcontainers: the test that passed on H2 proved your SQL works on H2, and the whole topic is the distance between that sentence and a test worth having"
sidebar_label: "07 · Testcontainers"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5** sources and documentation
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5),
> [java.testcontainers.org](https://java.testcontainers.org/)), the **Spring Boot 4.1.1**
> reference at [tag `v4.1.0`](https://github.com/spring-projects/spring-boot/tree/v4.1.0), the
> **Spring Framework 7.0.9** testing reference, **H2 2.4.240**'s own grammar and `ErrorCode`
> javadoc, and the **PostgreSQL 18** manual.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3, Flyway 12.4.0, H2 2.4.240, PostgreSQL JDBC 42.7.11.
> ⚠️ **No Docker, no container runtime and no sandbox on this machine.** Every page carries Java
> source and documented configuration — never a container log, a timing, a benchmark or a test run.

**A repository test that passes on H2 has proved that your SQL works on H2. H2 is not the database
you deploy, the substitution happens without anyone typing a line to cause it, and it fails in both
directions — a false red that wastes an afternoon, and a false green that ships. This topic is the
argument for running the real engine, the catalogue of what actually differs, and then the whole
mechanical business of doing it: wiring, lifetime, schema, isolation and cost.**

The failure mode running through all 50 chunks is the same one: **a test that goes green while
proving nothing.** It has many shapes here — a schema Hibernate invented because `@DataJpaTest`
imports no Flyway auto-configuration; a `@Transactional` test that never commits, so the
`AFTER_COMMIT` listener it asserts on never runs; a count over another test's leftover rows; a
container the JUnit extension stopped while Spring's context cache kept using it; an emulator
standing in for IAM. None of them show up in a build. All of them are in
[50 · The checklist](10-the-checklist.md).

**50 chunks, ~11,906 lines, 657 gotchas and interview questions.** Read in order; each chunk links to
the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[01 · Passed on H2 proves nothing](01-passed-on-h2-proves-nothing.md)** | <span className="db-tier t-understand">Understand</span> | A repository test that passes on H2 has proved that your SQL works on H2, and H2 is not the… |
| 2 | **[01b · Where the line is](01b-where-the-line-is.md)** | <span className="db-tier t-understand">Understand</span> | The conclusion is not that every test needs a container |
| 3 | **[01c · What H2 gets wrong (scope)](01c-what-h2-gets-wrong.md)** | <span className="db-tier t-understand">Understand</span> | Before the catalogue: what MODE=PostgreSQL actually promises, and the one divergence that is… |
| 4 | **[01d · Types you query with](01d-the-types-you-query-with.md)** | <span className="db-tier t-understand">Understand</span> | The types you reach for when the column holds an object |
| 5 | **[01e · Text, numbers, ordering](01e-text-numbers-and-ordering.md)** | <span className="db-tier t-understand">Understand</span> | Text, numbers, the types H2 simply does not have, and the sort-order defaults that are exact… |
| 6 | **[01f · Functions and the dialect](01f-functions-and-the-dialect.md)** | <span className="db-tier t-understand">Understand</span> | The statement-level dialect |
| 7 | **[01f2 · Pattern matching and search](01f2-pattern-matching-and-search.md)** | <span className="db-tier t-understand">Understand</span> | Pattern matching and search |
| 8 | **[01g · Transactional DDL, and which schema](01g-transactional-ddl-and-which-schema.md)** | <span className="db-tier t-understand">Understand</span> | DDL is part of a transaction on PostgreSQL and commits one on H2 |
| 9 | **[01h · Isolation and locking](01h-isolation-and-locking.md)** | <span className="db-tier t-understand">Understand</span> | Two engines, one set of isolation level names, and opposite answers |
| 10 | **[01h2 · What a violation raises](01h2-what-a-violation-raises.md)** | <span className="db-tier t-understand">Understand</span> | The three SQLStates everyone expects to be portable are portable |
| 11 | **[01i · The planner and indexes](01i-the-planner-and-indexes.md)** | <span className="db-tier t-understand">Understand</span> | H2's CREATE INDEX has no USING, no expression, no WHERE and no CONCURRENTLY |
| 12 | **[02 · What Testcontainers is](02-what-testcontainers-is.md)** | <span className="db-tier t-understand">Understand</span> | Testcontainers 2.0 removed the self-type generic from every module container class, so the… |
| 13 | **[03 · The JUnit integration](03-the-junit-integration.md)** | <span className="db-tier t-understand">Understand</span> | The Testcontainers JUnit 5 extension is a separate artifact, one @ExtendWith annotation and… |
| 14 | **[03b · static vs instance](03b-static-versus-instance.md)** | <span className="db-tier t-understand">Understand</span> | Whether a @Container field is static decides whether you start one container for the whole… |
| 15 | **[03c · The Store and the messages](03c-the-store-and-the-messages.md)** | <span className="db-tier t-understand">Understand</span> | The extension never stops a container in afterAll |
| 16 | **[03d · The lifecycle argument](03d-the-lifecycle-argument.md)** | <span className="db-tier t-understand">Understand</span> | Spring Boot 4.1 now tells you, in the reference documentation, to stop declaring containers… |
| 17 | **[03e · Ordering and the Docker switch](03e-the-switches-and-the-limits.md)** | <span className="db-tier t-understand">Understand</span> | One attribute on @Testcontainers will let a CI build report success having run none of your… |
| 18 | **[03f · Parallelism and @Nested](03f-parallelism-and-nested.md)** | <span className="db-tier t-understand">Understand</span> | @Testcontainers(parallel = true) starts several containers concurrently inside one test… |
| 19 | **[04 · @ServiceConnection](04-serviceconnection.md)** | <span className="db-tier t-understand">Understand</span> | @ServiceConnection never writes a property |
| 20 | **[04b · How the match is made](04b-how-the-match-is-made.md)** | <span className="db-tier t-understand">Understand</span> | Nothing configures which container maps to which ConnectionDetails |
| 21 | **[04b2 · The @Bean rule and narrowing](04b2-the-bean-method-and-narrowing.md)** | <span className="db-tier t-understand">Understand</span> | A @Bean method is matched on its return type and a static field is matched on its image… |
| 22 | **[04b3 · What is supported](04b3-the-supported-services.md)** | <span className="db-tier t-understand">Understand</span> | The Boot 4.1 service-connection catalogue, read as rules rather than a list |
| 23 | **[04b4 · SSL, and the other catalogue](04b4-ssl-and-the-other-catalogue.md)** | <span className="db-tier t-understand">Understand</span> | The SSL annotations that sit beside @ServiceConnection configure your client and never the… |
| 24 | **[04b5 · Containers as Spring beans](04b5-containers-as-beans.md)** | <span className="db-tier t-understand">Understand</span> | Boot 4.1 now tells you to stop declaring containers with the JUnit extension and declare… |
| 25 | **[04b6 · Importing, and dev time](04b6-importing-and-development-time.md)** | <span className="db-tier t-understand">Understand</span> | @ImportTestcontainers lifts container declarations you already have into a Spring context,… |
| 26 | **[04c · @DynamicPropertySource](04c-dynamicpropertysource.md)** | <span className="db-tier t-understand">Understand</span> | @DynamicPropertySource registers Suppliers rather than values, runs during context… |
| 27 | **[04c2 · Precedence, and choosing](04c2-precedence-and-when-to-use-it.md)** | <span className="db-tier t-understand">Understand</span> | A dynamic property outranks @TestPropertySource, the OS environment and system properties,… |
| 28 | **[04c3 · DynamicPropertyRegistrar](04c3-the-registrar.md)** | <span className="db-tier t-understand">Understand</span> | DynamicPropertyRegistrar is the bean-shaped form of @DynamicPropertySource, and it exists… |
| 29 | **[04c4 · Dynamic properties and the cache](04c4-dynamic-properties-and-the-cache.md)** | <span className="db-tier t-understand">Understand</span> | The context cache keys @DynamicPropertySource on the SET OF METHODS rather than on the… |
| 30 | **[05 · The singleton pattern](05-the-singleton-pattern.md)** | <span className="db-tier t-understand">Understand</span> | The JUnit extension stops a static @Container when the test class ends and an instance… |
| 31 | **[05a · Holders, interfaces, wiring](05a-holders-interfaces-and-wiring.md)** | <span className="db-tier t-understand">Understand</span> | The abstract base class is one of three shapes a singleton container can take, and the two… |
| 32 | **[05a2 · Ryuk and cleanup](05a2-ryuk-and-cleanup.md)** | <span className="db-tier t-understand">Understand</span> | A singleton container is never stopped by anything in your code, which is only safe because… |
| 33 | **[05a3 · The cost of sharing](05a3-the-cost-of-sharing.md)** | <span className="db-tier t-understand">Understand</span> | Sharing one container across the suite buys you startup time and sells you two things in… |
| 34 | **[05a4 · Parallel execution](05a4-parallel-execution.md)** | <span className="db-tier t-understand">Understand</span> | Containers are safe to run concurrently because every exposed port is published to a random… |
| 35 | **[05b · Reuse: the opt-in](05b-reuse.md)** | <span className="db-tier t-understand">Understand</span> | withReuse(true) is a declaration that a container is eligible for reuse, not a command to… |
| 36 | **[05b2 · The contract and the hash](05b2-the-contract-and-the-hash.md)** | <span className="db-tier t-understand">Understand</span> | The reuse contract forbids the JUnit integration outright, refuses any container class that… |
| 37 | **[05b3 · What reuse leaks](05b3-what-reuse-leaks.md)** | <span className="db-tier t-understand">Understand</span> | A reusable container is never registered with Ryuk, which is both why it can outlive your… |
| 38 | **[05b4 · JDBC URLs and the singleton](05b4-jdbc-urls-and-the-singleton.md)** | <span className="db-tier t-understand">Understand</span> | Testcontainers' JDBC URL scheme carries its own reuse switch |
| 39 | **[06 · Schema and data](06-schema-and-data.md)** | <span className="db-tier t-understand">Understand</span> | A container starts empty, and there are five different mechanisms that can put a schema in it |
| 40 | **[06b · The defaults that silently stop](06b-the-defaults-that-silently-stop.md)** | <span className="db-tier t-understand">Understand</span> | Two of Boot's five schema mechanisms are conditional on the database being embedded, so the… |
| 41 | **[06c · Keeping tests independent](06c-keeping-tests-independent.md)** | <span className="db-tier t-understand">Understand</span> | The container outlives the test class by design, so every test after the first one runs… |
| 42 | **[06d · The rollback strategy](06d-the-rollback-strategy.md)** | <span className="db-tier t-understand">Understand</span> | Wrapping a Testcontainers test in @Transactional buys isolation by never committing, and the… |
| 43 | **[06e · Truncating between tests](06e-truncating-between-tests.md)** | <span className="db-tier t-understand">Understand</span> | The general answer to a shared container is one statement run before every test |
| 44 | **[06f · @Sql scripts and unique data](06f-sql-scripts-and-unique-data.md)** | <span className="db-tier t-understand">Understand</span> | @Sql runs fixture and cleanup scripts around a test without any plumbing, and exactly one of… |
| 45 | **[07 · Beyond PostgreSQL](07-beyond-postgres.md)** | <span className="db-tier t-understand">Understand</span> | Everything the topic has argued about PostgreSQL applies unchanged to Kafka, MongoDB,… |
| 46 | **[07b · GenericContainer and waiting](07b-genericcontainer-and-waiting.md)** | <span className="db-tier t-understand">Understand</span> | GenericContainer gives you any image at all, and hands you back the one problem every module… |
| 47 | **[07c · Networks and image names](07c-networks-and-image-names.md)** | <span className="db-tier t-understand">Understand</span> | The random host port that makes parallel test runs safe is the one thing another container… |
| 48 | **[09 · The cost](09-the-cost.md)** | <span className="db-tier t-understand">Understand</span> | Testcontainers costs you a container runtime on every machine that runs the suite, an image… |
| 49 | **[09b · CI and alternative runtimes](09b-ci-and-alternative-runtimes.md)** | <span className="db-tier t-understand">Understand</span> | The recommended way to run Testcontainers in CI is to hand your build container the host's… |
| 50 | **[10 · The checklist](10-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | Reviewing a Testcontainers test |
## The six things this topic is really about

1. **An in-memory impostor is a different database.** Not a smaller one — a different one, with
   opposite identifier folding, opposite `NULL` ordering, a different check-constraint SQLState and
   a `REPEATABLE READ` that means something else.
2. 🔴 **"H2 will not parse it" is the weaker half of the argument.** A construct H2 *rejects* costs
   a red build you cannot ignore. A construct H2 *accepts and approximates* — `DISTINCT ON`,
   `FOR UPDATE … SKIP LOCKED` — costs a **green** one.
3. **Two of Boot's five schema mechanisms are conditional on the database being embedded**, so they
   stop the instant you switch to a container, and neither logs that it declined.
4. **Isolation bought by never committing is isolation bought by not testing.** The commit is where
   deferred constraints, `AFTER` triggers, `AFTER_COMMIT` listeners and every other connection's
   view of the world actually happen.
5. **The container outlives the test class by design**, and Boot says so. What you choose is not
   whether state is shared but how each test gets back to a known start.
6. **The dominant cost is how many tests need a container**, not how fast one starts —
   Testcontainers' own docs say to *"have as few tests that hit the database as possible"*.

## Where this connects

- **[01 · JUnit 5](../01-junit-5/README.md)** owns the engine and the extension model this topic's
  `@Testcontainers` plugs into.
- **[05 · The test pyramid](../05-the-test-pyramid/README.md)** owns slice choice, `@SpringBootTest`
  and the **context cache** — which is the single biggest lever on container cost, and why most
  "Testcontainers is slow" complaints are really cache-fragmentation complaints.
- **[06 · MockMvc](../06-mockmvc/README.md)** owns the web layer. Most tests that reach for a
  container belong there instead.
- **[Phase 10 · 11 · Flyway migrations](../../phase-10-data-access/11-flyway-migrations/README.md)**
  owns migration testing, and this topic links to it rather than repeating it —
  especially [11c · The slice that skips your migrations](../../phase-10-data-access/11-flyway-migrations/11c-the-slice-that-skips-your-migrations.md).
- **08 · Test data patterns** *(not written yet)* owns the *shape* of fixtures — builders, object
  mothers. This topic owns only *when state is removed*.

{/* FOOTER */}
