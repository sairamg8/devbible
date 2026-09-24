---
name: research-java-p11-t07-testcontainers
description: Verified Testcontainers 2.0.5 / Boot 4.1 research for devbible Java Phase 11 topic 07 — what 2.x broke, @ServiceConnection coverage, reuse opt-in, Podman, and the non-generic container classes that make every copied 1.x sample fail to compile. Read before writing topic 07 chunks 02-10.
metadata:
  type: project
---

# Java P11 T07 · Testcontainers research — verified 2026-08-28 from the 2.0.5 sources

Gathered by an authoring fork before it was wound down at the 3-agent ceiling. **Chunks 02–10
and the index are UNWRITTEN; this is their source material.** On disk:
`01-passed-on-h2-proves-nothing` (233) and `01b-where-the-line-is` (209).

🔴 **Naming: the split sibling took the `01b` slot**, so the plan's divergence catalogue is
**`01c-what-h2-gets-wrong.md` at position 3** and everything after shifts by one. Both forward
references are already plain bold *(not written yet)*, unlinked — nothing dangles.

## 🔴🔴 The finding that invalidates committed work elsewhere in this repo

**Testcontainers 2.x module container classes LOST their self-type generic parameter.** In
2.0.5, `org.testcontainers.postgresql.PostgreSQLContainer` is
`public class PostgreSQLContainer extends JdbcDatabaseContainer<PostgreSQLContainer>` — **not
generic**. The old `org.testcontainers.containers.PostgreSQLContainer<SELF>` still exists but
is `@Deprecated` (*"use `org.testcontainers.postgresql.PostgreSQLContainer` instead"*), one of
**35 deprecated shims** across the modules.

So the universal 1.x idiom compiles only against the deprecated class:
```java
PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:18-alpine");  // 1.x
PostgreSQLContainer  pg = new PostgreSQLContainer("postgres:18-alpine");      // 2.x
```
Boot 4.1's own samples use the non-generic form. **`GenericContainer<SELF>` in
`org.testcontainers.containers` is unchanged and still generic**; `JdbcDatabaseContainer` also
stays in `org.testcontainers.containers`.

⚠️ **Existing devbible page affected:**
`docs/java/pages/phase-10-data-access/05-sql-first-access/12g-testcontainers-and-serviceconnection.md`
is written against 1.x and **no longer compiles on 2.0.5**. Topic 07 must link to it (rather
than repeat it) *and* the phase-10 page needs a correction pass. Not this session's lock to
fix silently — record it, raise it.

## What 2.0.0 broke — verbatim from the release notes

- *"Removed JUnit 4 support"* — confirmed: no `org.junit.rules` in `core/src/main`.
  ⚠️ **The docs site is stale**: `docs/index.md` still lists JUnit 4 under Prerequisites and
  `docs/test_framework_integration/junit_4.md` still ships. Do not trust those two pages.
- *"All modules are now prefixed with `testcontainers-`. For example, `org.testcontainers:mysql`
  is now `org.testcontainers:testcontainers-mysql`"* — core keeps its name.
- *"Container classes relocated to `org.testcontainers.<module-name>` package."*
- **"Drop module's default constructors"** — `new PostgreSQLContainer()` is gone; name the image.

## `@ServiceConnection` coverage on Boot 4.1 — matched on CONTAINER TYPE unless noted

ActiveMQ (`activemq.ActiveMQContainer`, or images named `symptoma/activemq`) · Artemis
(`activemq.ArtemisContainer`) · Cassandra · Couchbase · Elasticsearch · **Flyway, JDBC and
Liquibase all matched on `org.testcontainers.containers.JdbcDatabaseContainer`** · Kafka
(`kafka.KafkaContainer`, `kafka.ConfluentKafkaContainer`, `redpanda.RedpandaContainer`) · LDAP
(`ldap.LLdapContainer`, or named `osixia/openldap`) · MongoDB (`MongoDBContainer`,
`MongoDBAtlasLocalContainer`) · Neo4j · OTLP logging/metrics/tracing (named
`otel/opentelemetry-collector-contrib`, or `grafana.LgtmStackContainer`) · Pulsar · **R2DBC**
(ClickHouse, MariaDB, MSSQLServer, MySQL, Oracle free, Oracle XE, PostgreSQL) · RabbitMQ ·
RabbitMQ Streams (**opt-in via `type`**, container must expose 5552) · **Redis —
`com.redis.testcontainers.RedisContainer`/`RedisStackContainer` (third-party), or images named
`redis`, `redis/redis-stack`, `redis/redis-stack-server`** · Zipkin (named `openzipkin/zipkin`).

Behaviours to write up: *"By default `Container.getDockerImageName().getRepository()` is used
to obtain the name used to find connection details"* · a `@Bean` method is matched on **return
type**, not image, *"because this would cause eager initialization issues"* — which is why a
`GenericContainer` `@Bean` needs `@ServiceConnection(name = "redis")` · one container creates
**all** applicable details beans (a `PostgreSQLContainer` yields both `JdbcConnectionDetails`
and `R2dbcConnectionDetails`) unless narrowed with `type`.

## 🔴 Boot 4.1 changed its `@Container` recommendation — contradicts Boot 3.1-era material

> *"When using the JUnit extension, container instances are stopped after the test class has
> run (for static fields) or after each test method (for non-static fields). This can cause
> issues when used with Spring Boot tests, as Spring's TestContext Framework may cache the
> ApplicationContext beyond that point… For this reason, you should prefer managing containers
> as Spring beans or importing container declarations when the application context should
> remain usable for as long as it is cached."*

That is the context-cache interaction, stated by Boot itself — pair it with
[[research-java-p11-t05-spring-test-context]]. Also: *"Container beans are created and started
before all other beans"* / *"stopped after the destruction of all other beans"* / *"A single
test container instance can, and often is, retained across execution of tests from multiple
test classes."*

## Reuse — YES, it needs machine-level opt-in as well as `withReuse(true)`

> *"Enable `Reusable Containers` — through environment variable `TESTCONTAINERS_REUSE_ENABLE=true`
> — through user property file `~/.testcontainers.properties`, by adding
> `testcontainers.reuse.enable=true` — **not** through classpath properties file"*

and *"start the container manually by calling `start()`, do not call `stop()` directly or
indirectly via `try-with-resources` or `JUnit integration`… To reuse a container, the container
configuration **must be the same**."* Two warnings to quote: *"still an experimental feature and
the behavior can change. Those containers won't stop after all tests are finished."* and *"not
suited for CI usage and as an experimental feature not all Testcontainers features are fully
working (e.g., resource cleanup or networking)."* JDBC-URL form: `?TC_REUSABLE=true`.

## Minimum JDK — ⚠️ the documentation does not state one

`docs/index.md` Prerequisites lists only Docker and a JVM test framework. From the build at tag
2.0.5: root `build.gradle` sets `options.release.set(8)` for all subprojects, with `release 17`
only for `core`'s **test** compilation and the `weaviate`/`openfga` (17) and `hivemq` (11)
modules. **Core is still Java 8 bytecode; Testcontainers imposes no Java 17 floor** — the floor
on this stack comes from JUnit Jupiter 6 and Boot 4. State it that way; do not claim a
documented minimum. (Aside: `modules/junit-jupiter/build.gradle` compiles against
`org.junit:junit-bom:5.14.3` while Boot 4.1 resolves Jupiter **6.0.3** at runtime.)

## Podman — supported, explicitly second-class

> *"Alternative container runtimes are not actively tested in the main development workflow, so
> not all Testcontainers features might be available."*

Linux: `export DOCKER_HOST=unix://${XDG_RUNTIME_DIR}/podman/podman.sock`. macOS also needs
`TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock` with `DOCKER_HOST` from
`podman machine inspect`. **Rootless Podman requires `export TESTCONTAINERS_RYUK_DISABLED=true`.**
*"Previous to version 1.19.0, `export TESTCONTAINERS_RYUK_PRIVILEGED=true` was required for
rootful mode. Starting with 1.19.0, this is no longer required."* Ryuk 0.13.0 in 2.0.x.

## Other banked facts

`@Testcontainers` has `disabledWithoutDocker()` and `parallel()`, both default `false`. The
extension throws `ExtensionConfigurationException` with literal messages
`"Container " + field.getName() + " needs to be initialized"`,
`"FieldName: %s does not implement Startable"`, `"@Testcontainers not found"`.

⚠️ The JUnit 5 integration doc still repeats the pre-Java-16 claim that *"nested test classes
have to be defined non-static and can't therefore have static fields"*. **That stated reason
expired at Java SE 16** and `_PHASE-NOTES.md` forbids reintroducing it — treat the limitation
as "unverified whether the extension still has it", never repeat the rationale.

Boot dev-time story: `SpringApplication.from(MyApplication::main).with(MyContainersConfiguration.class).run(args)`
· `spring.testcontainers.beans.startup` = `sequential`|`parallel` · `@ImportTestcontainers` ·
`@RestartScope` · **`DynamicPropertyRegistrar` as the `@Bean`-friendly replacement for
`@DynamicPropertySource`** · Maven `spring-boot:test-run` / Gradle `bootTestRun`.

BOM versions confirmed from Boot 4.1.0: Testcontainers 2.0.5, H2 2.4.240, PostgreSQL JDBC
42.7.11, Flyway 12.4.0, Jupiter 6.0.3, AssertJ 3.27.7, Mockito 5.23.0.

## Phase-10 links resolved with `ls` — use these exact paths

- `../../phase-10-data-access/05-sql-first-access/12g-testcontainers-and-serviceconnection.md`
  (link instead of repeating — but see the 1.x defect above)
- `../../phase-10-data-access/11-flyway-migrations/README.md`, and specifically
  `11-testing-migrations.md`, `11b-wiring-the-container.md`, `11b2-making-it-fast.md`,
  `11c-the-slice-that-skips-your-migrations.md`

## A citation banked for the divergence chunk

PostgreSQL's transactional DDL was **not** asserted on the page because no single quotable
sentence was found stating it directly. The usable pairing is PostgreSQL
`sql-createindex.html` — *"a regular `CREATE INDEX` command can be performed within a
transaction block, but `CREATE INDEX CONCURRENTLY` cannot"* — against H2's flat *"most data
definition language (DDL) statements, such as 'create table', commit the current transaction"*.

## Sources read

The **2.0.5 source tarball** (`github.com/testcontainers/testcontainers-java/archive/refs/tags/2.0.5.tar.gz`
— `docs/`, `build.gradle`, module sources) · the **2.0.0 release notes** via the GitHub API ·
`java.testcontainers.org` `/features/reuse/`, `/supported_docker_environment/`,
`/modules/databases/`, `/test_framework_integration/junit_5/` · the **Boot 4.1.0** reference
source at tag `v4.1.0` (`reference/pages/testing/testcontainers.adoc`,
`features/dev-services.adoc`) and its `include-code` Java samples.
