---
title: "Part 3 — Application layer"
sidebar_label: "3 · Application"
sidebar_position: 3
---

> Phases 7–10 · The standard library at work, the build, Spring Boot, and data access

This is where Java stops being a language exercise and becomes a running
service: real I/O, a real build, a real framework, a real database.

---

## Phase 7 — I/O, time and the everyday standard library

The APIs you touch in every service, tiered by how often they bite.

| Topic | Tier |
|---|---|
| **`java.time`**: `Instant` (store this), `LocalDate`/`LocalDateTime` (no zone — know what that means), `ZonedDateTime`, `Duration`/`Period`, `DateTimeFormatter` — and why `Date`/`Calendar` are read-only legacy. The "meeting moved an hour after DST" bug, prevented | <span className="db-tier t-master">Master</span> |
| **`Path` and `Files`**: read/write/copy/move, `Files.lines` (close it — it's a stream over an open file), `walk`, temp files — modern file work without `File` | <span className="db-tier t-master">Master</span> |
| Byte vs char streams, buffering, and charsets — UTF-8 is the default everywhere since 18; the mojibake bug that mostly died with it | <span className="db-tier t-understand">Understand</span> |
| **`java.net.http.HttpClient`**: sync and async, **timeouts on every call** (the default is *no* request timeout), status handling, JSON bodies — calling another service without a library | <span className="db-tier t-master">Master</span> |
| **JSON with Jackson**: `ObjectMapper` (create once, share — it's expensive and thread-safe), records as DTOs, `@JsonProperty`, unknown-field policy, the `LocalDate` module registration everyone forgets once | <span className="db-tier t-master">Master</span> |
| Regex: `Pattern` (compile once) / `Matcher`, groups, and the catastrophic-backtracking input that hangs a thread | <span className="db-tier t-understand">Understand</span> |
| `UUID` for ids, and `SecureRandom` vs `Random` vs `ThreadLocalRandom` — which one for tokens (only one is safe) | <span className="db-tier t-understand">Understand</span> |
| **Java serialization** (`Serializable`) — why it's a deserialization-attack liability and a versioning trap: recognize it, avoid it, use JSON or protobuf at boundaries | <span className="db-tier t-know">Know</span> |
| `Locale`, `ResourceBundle`, number/date localization — enough to not hardcode `en_US` assumptions | <span className="db-tier t-know">Know</span> |
| `ProcessBuilder` — shelling out safely: argument lists (never string concat), stream draining so the child doesn't block | <span className="db-tier t-know">Know</span> |
| Console I/O and `Scanner` — fine for exercises, absent from services | <span className="db-tier t-know">Know</span> |
| NIO channels and selectors — the layer under Netty; framework territory | <span className="db-tier t-when">When Needed</span> |
| Foreign Function & Memory API (final in 22) — calling native libraries without JNI | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can fetch JSON from an API with `HttpClient`,
deserialize into records, and store the timestamp correctly — `Instant` in the
data, zone conversion only at the edge for display.

---

## Phase 8 — The build: Maven, Gradle and dependencies

Nobody ships `javac` output by hand. The build tool is where dependency hell,
"works on my machine", and supply-chain risk all live.

| Topic | Tier |
|---|---|
| **Maven core**: the POM, coordinates (GAV), the lifecycle (`compile` → `test` → `package` → `install`), plugins vs dependencies | <span className="db-tier t-master">Master</span> |
| Dependency **scopes** (`compile`, `test`, `provided`, `runtime`) — why a test library leaking into `compile` scope matters | <span className="db-tier t-master">Master</span> |
| **Transitive dependencies and conflict mediation**: nearest-wins, `dependency:tree` (the first command in any "wrong version on the classpath" incident), exclusions, and **BOMs / `dependencyManagement`** — how Spring Boot pins hundreds of versions for you | <span className="db-tier t-understand">Understand</span> |
| **Gradle**: `build.gradle.kts`, tasks, incremental builds and caching — vs Maven honestly: convention and stability vs speed and flexibility | <span className="db-tier t-understand">Understand</span> |
| **Wrappers** (`./mvnw`, `./gradlew`) — the build pinned to a version, so CI and the new laptop agree by construction | <span className="db-tier t-master">Master</span> |
| Standard layout (`src/main/java`, `src/test/java`, `src/main/resources`) and multi-module projects — one repo, `api`/`service`/`domain` modules | <span className="db-tier t-understand">Understand</span> |
| Versioning and updates: semver as practiced (loosely) on the JVM, `versions` plugins, and **CVE scanning** (OWASP dependency-check, Dependabot) — the log4shell lesson institutionalized | <span className="db-tier t-understand">Understand</span> |
| Jar anatomy: `META-INF/MANIFEST.MF`, `Main-Class`, fat/uber jars and shading — why two libraries can collide inside one jar | <span className="db-tier t-understand">Understand</span> |
| **Annotation processing**: how Lombok, MapStruct and Spring's processors hook `javac` — Lombok's trade-offs stated plainly (magic vs boilerplate; records ate half its use cases) | <span className="db-tier t-understand">Understand</span> |
| Artifact repositories: Maven Central, internal proxies (Nexus/Artifactory), publishing basics | <span className="db-tier t-know">Know</span> |
| `javac` flags that matter: `-parameters` (Spring needs it for arg names), `--release`, `--enable-preview` | <span className="db-tier t-know">Know</span> |
| Toolchains — building with a pinned JDK independent of the one running the build tool | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** given "two versions of Jackson on the classpath, wrong
one wins", you reach for `dependency:tree`, name the mediation rule that chose
it, and fix it with a BOM or exclusion — not by deleting `~/.m2`.

---

## Phase 9 — Spring Boot and the web

The framework nearly every Java job means when it says "Java". The syllabus
teaches the machinery — DI, auto-configuration, the request pipeline — because
the annotations are learnable in a day but debuggable only with the model.

| Topic | Tier |
|---|---|
| Why frameworks: the servlet model, Tomcat/Jetty embedded, one servlet thread (or virtual thread) per request — what Spring MVC actually sits on | <span className="db-tier t-understand">Understand</span> |
| **The IoC container**: beans, `@Component`/`@Service`/`@Repository`, `@Bean` methods, component scanning — the object graph Spring builds so you don't `new` your way through layers | <span className="db-tier t-master">Master</span> |
| **Dependency injection**: constructor injection as the only default (testable, final fields, no proxies needed) — field `@Autowired` as the smell reviewers flag | <span className="db-tier t-master">Master</span> |
| Bean scopes and lifecycle: singleton (the default — hence stateless beans), `@PostConstruct`, lazy init, and the circular-dependency error read correctly | <span className="db-tier t-understand">Understand</span> |
| **Spring Boot**: starters, **auto-configuration** — what `@SpringBootApplication` actually triggers, conditional beans, and how to see why a bean did or didn't load (`--debug` conditions report) | <span className="db-tier t-master">Master</span> |
| **Configuration**: `application.yml`, `@ConfigurationProperties` (typed, validated config over `@Value` sprinkle), **profiles** (`dev`/`prod`), env-var overrides — the 12-factor pattern as Boot implements it | <span className="db-tier t-master">Master</span> |
| **REST controllers**: `@RestController`, `@GetMapping`/`@PostMapping`, path variables, query params, `@RequestBody` with records, `ResponseEntity`, status codes chosen on purpose | <span className="db-tier t-master">Master</span> |
| **Validation**: Bean Validation (`@NotNull`, `@Size`, `@Email`), `@Valid` at the controller boundary, custom validators — reject at the edge, keep the domain clean | <span className="db-tier t-master">Master</span> |
| **Error handling**: `@ControllerAdvice` + `@ExceptionHandler`, **`ProblemDetail` (RFC 9457)** — one JSON error shape for the whole API, no stack traces to clients | <span className="db-tier t-master">Master</span> |
| The request pipeline: filters (servlet level) vs interceptors (MVC level) vs AOP — where auth, logging and metrics each belong | <span className="db-tier t-understand">Understand</span> |
| **Spring Security**, the working subset: the filter chain, authentication vs authorization, stateless JWT resource server config, password encoding, CORS and CSRF decisions for an SPA + API | <span className="db-tier t-understand">Understand</span> |
| Outbound HTTP: `RestClient` (the modern sync choice), `WebClient`, per-call timeouts and error mapping — your service is someone else's flaky dependency | <span className="db-tier t-understand">Understand</span> |
| **Actuator**: `/health` (liveness vs readiness), `/metrics`, `/info` — and locking the rest down before it leaks heap dumps to the internet | <span className="db-tier t-understand">Understand</span> |
| OpenAPI with springdoc — the contract your frontend consumes, generated | <span className="db-tier t-know">Know</span> |
| WebFlux and reactive — what it is, the cost (colored functions everywhere), and why virtual threads moved the default answer back to blocking MVC | <span className="db-tier t-know">Know</span> |
| The alternatives: Quarkus, Micronaut, Helidon — recognize the trade-offs (build-time DI, native-image friendliness) | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a small Boot service with one resource: validated POST,
typed config via `@ConfigurationProperties`, a `@ControllerAdvice` returning
`ProblemDetail`, and health/readiness split for a container orchestrator.

---

## Phase 10 — Data access

The layer where Java meets PostgreSQL — and where the worst performance bugs in
typical services live. JPA is taught *after* JDBC on purpose: you cannot debug
an abstraction you've never seen under.

| Topic | Tier |
|---|---|
| **JDBC**: `DataSource`, `Connection`, **`PreparedStatement`** (parameterized always — SQL injection dies here), `ResultSet` mapping, resource handling with try-with-resources | <span className="db-tier t-master">Master</span> |
| **Connection pooling with HikariCP**: why pools exist, sizing (small — the pool-size formula, not 100), leak detection, and what "connection is not available" actually means under load | <span className="db-tier t-master">Master</span> |
| Transactions at the JDBC level: autocommit off, commit/rollback, isolation levels mapped to real anomalies (lost update, non-repeatable read) | <span className="db-tier t-understand">Understand</span> |
| **Spring `@Transactional`**: proxy mechanics, propagation, rollback rules (unchecked only, by default!), `readOnly`, and the **self-invocation trap** — the annotation that silently does nothing when called from inside the same class | <span className="db-tier t-master">Master</span> |
| SQL-first access: `JdbcTemplate` / `JdbcClient` — when a typed query beats an entity graph | <span className="db-tier t-understand">Understand</span> |
| **JPA/Hibernate model**: entities, `@Id` generation strategies, the **persistence context** (dirty checking, first-level cache) — why a setter call became an UPDATE you never wrote | <span className="db-tier t-understand">Understand</span> |
| Relationships: `@OneToMany`/`@ManyToOne`, the **owning side**, `mappedBy`, fetch types — and why `EAGER` on a collection is a time bomb | <span className="db-tier t-understand">Understand</span> |
| **The N+1 problem**: seeing it in the SQL log (the only place it's visible), fixing it with fetch joins, `@EntityGraph`, or batch size — the single most common Java performance bug in the wild | <span className="db-tier t-master">Master</span> |
| **Spring Data JPA**: derived queries (`findByEmailAndStatus`), `@Query`, pagination (`Pageable` — and offset pagination's cost at depth), projections/DTOs instead of returning entities from controllers | <span className="db-tier t-understand">Understand</span> |
| Lazy-loading pitfalls: `LazyInitializationException` (the session closed before the JSON serializer walked the graph), open-session-in-view and why Boot's default deserves turning off | <span className="db-tier t-understand">Understand</span> |
| **Migrations with Flyway** (or Liquibase): versioned SQL in the repo, run on startup — schema changes reviewed like code, never `ddl-auto: update` in production | <span className="db-tier t-master">Master</span> |
| Caching: Hibernate second-level, Spring `@Cacheable` with Redis — and the invalidation cost that makes "just cache it" a decision, not a reflex | <span className="db-tier t-know">Know</span> |
| jOOQ — typed SQL as the JPA alternative: where code-generated queries beat entities (reporting, complex joins) | <span className="db-tier t-know">Know</span> |
| Spring Data for MongoDB / Redis — the same repository idiom over the other stores in this bible | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** with SQL logging on, you can point at the N+1 a naive
`findAll` + getter loop produces, fix it with a fetch join, and explain why
`@Transactional` on a private method never worked.

---

← Prev: [Part 2 — The core library](02-core-library.md) · Next → [Part 4 — Production](04-production.md)
