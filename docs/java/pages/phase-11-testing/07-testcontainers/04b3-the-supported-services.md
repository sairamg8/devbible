---
title: "The Boot 4.1 service-connection catalogue, read as rules rather than a list — three entries share one base class, one is third-party code you must add yourself, one is opt-in, and one works but is missing from the table"
sidebar_label: "04b3 · What is supported"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.0** reference at tag `v4.1.0`
> ([`testing/testcontainers.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/testcontainers.adoc)),
> transcribed from its "service connection factories" table, and cross-checked against the module
> sources and `META-INF/spring.factories` files in the same tree — specifically
> [`RedisContainerConnectionDetailsFactory`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-data-redis/src/main/java/org/springframework/boot/data/redis/testcontainers/RedisContainerConnectionDetailsFactory.java)
> and
> [`spring-boot-hazelcast/src/main/resources/META-INF/spring.factories`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-hazelcast/src/main/resources/META-INF/spring.factories).
> Version spine: JDK 25, Spring Boot 4.1.0, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**A catalogue is boring to read and useless to memorise, so this chunk is organised around the four
entries that are not what they look like. [04b](04b-how-the-match-is-made.md) explained that
matching happens on container type, on image name, or on both; the table below says which, and the
sections after it explain the five rows where knowing "which" changes what you write.**

## The catalogue

Every row is from Boot 4.1.0's own table. `ConnectionDetails` types are given by simple name — in
Boot 4.1 they live in per-module packages such as `org.springframework.boot.jdbc.autoconfigure`,
not in one shared package.

| Connection details | Matched on |
|---|---|
| `ActiveMQConnectionDetails` | image named `symptoma/activemq`, or `org.testcontainers.activemq.ActiveMQContainer` |
| `ArtemisConnectionDetails` | `org.testcontainers.activemq.ArtemisContainer` |
| `CassandraConnectionDetails` | `org.testcontainers.cassandra.CassandraContainer` |
| `CouchbaseConnectionDetails` | `org.testcontainers.couchbase.CouchbaseContainer` |
| `ElasticsearchConnectionDetails` | `org.testcontainers.elasticsearch.ElasticsearchContainer` |
| `FlywayConnectionDetails` | `org.testcontainers.containers.JdbcDatabaseContainer` |
| `JdbcConnectionDetails` | `org.testcontainers.containers.JdbcDatabaseContainer` |
| `KafkaConnectionDetails` | `org.testcontainers.kafka.KafkaContainer`, `kafka.ConfluentKafkaContainer` or `redpanda.RedpandaContainer` |
| `LdapConnectionDetails` | image named `osixia/openldap`, or `org.testcontainers.ldap.LLdapContainer` |
| `LiquibaseConnectionDetails` | `org.testcontainers.containers.JdbcDatabaseContainer` |
| `MongoConnectionDetails` | `org.testcontainers.mongodb.MongoDBContainer` or `mongodb.MongoDBAtlasLocalContainer` |
| `Neo4jConnectionDetails` | `org.testcontainers.neo4j.Neo4jContainer` |
| `OtlpLoggingConnectionDetails` | image named `otel/opentelemetry-collector-contrib`, or `org.testcontainers.grafana.LgtmStackContainer` |
| `OtlpMetricsConnectionDetails` | same as OTLP logging |
| `OtlpTracingConnectionDetails` | same as OTLP logging |
| `PulsarConnectionDetails` | `org.testcontainers.pulsar.PulsarContainer` |
| `R2dbcConnectionDetails` | `clickhouse.ClickHouseContainer`, `mariadb.MariaDBContainer`, `mssqlserver.MSSQLServerContainer`, `mysql.MySQLContainer`, `oracle.OracleContainer` (free), `containers.OracleContainer` (XE) or `postgresql.PostgreSQLContainer` |
| `RabbitConnectionDetails` | `org.testcontainers.rabbitmq.RabbitMQContainer` |
| `RabbitStreamConnectionDetails` | `rabbitmq.RabbitMQContainer` **when `type` includes `RabbitStreamConnectionDetails`** |
| `DataRedisConnectionDetails` | `com.redis.testcontainers.RedisContainer` or `RedisStackContainer`, **or** an image named `redis`, `redis/redis-stack` or `redis/redis-stack-server` |
| `ZipkinConnectionDetails` | image named `openzipkin/zipkin` |

## 🔴 Three rows share one base class, and that is the most useful fact here

Flyway, JDBC and Liquibase are all matched on
**`org.testcontainers.containers.JdbcDatabaseContainer`** — not on `PostgreSQLContainer`, not on
`MySQLContainer`, on the abstract base that every SQL module's container extends.

Three consequences, and they are the reason to notice:

1. **One annotation wires three subsystems.** A single `@ServiceConnection` on a Postgres container
   gives the application's `DataSource`, Flyway's migration run and Liquibase's changelog run the
   same URL, user and password. You do not annotate the container three times and you do not set
   `spring.flyway.url` — which is exactly the trap
   [Flyway · 11c](../../phase-10-data-access/11-flyway-migrations/11c-the-slice-that-skips-your-migrations.md)
   is about, from the other side.
2. **Every SQL engine Testcontainers supports is covered, including ones with no row of their own.**
   There is no "Db2" row, but `Db2Container extends JdbcDatabaseContainer`, so it matches. The
   catalogue understates SQL coverage substantially.
3. **`JdbcDatabaseContainer` is one of the classes 2.0 did *not* move.** It is still
   `org.testcontainers.containers.JdbcDatabaseContainer` and still generic, while
   `PostgreSQLContainer` relocated to `org.testcontainers.postgresql` and lost its self-type
   parameter — see [02](02-what-testcontainers-is.md). So the *matching* base class survived the
   2.0 reshuffle unchanged even though the classes you instantiate did not.

```java
@Container
@ServiceConnection
static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");
// -> JdbcConnectionDetails, R2dbcConnectionDetails, FlywayConnectionDetails,
//    LiquibaseConnectionDetails — whichever of those modules are on the classpath.
```

## 🔴 Redis is third-party code, and that is why it catches people

Redis is the only entry in the table whose *typed* match is on classes Spring does not ship and
Testcontainers does not ship either: `com.redis.testcontainers.RedisContainer` and
`com.redis.testcontainers.RedisStackContainer` come from the community `testcontainers-redis`
project. The factory handles both worlds:

```java
class RedisContainerConnectionDetailsFactory
        extends ContainerConnectionDetailsFactory<Container<?>, DataRedisConnectionDetails> {

    private static final List<String> REDIS_IMAGE_NAMES =
            List.of("redis", "redis/redis-stack", "redis/redis-stack-server");

    RedisContainerConnectionDetailsFactory() {
        super(REDIS_IMAGE_NAMES);
    }

    @Override
    protected boolean sourceAccepts(ContainerConnectionSource<Container<?>> source,
            Class<?> requiredContainerType, Class<?> requiredConnectionDetailsType) {
        return super.sourceAccepts(source, requiredContainerType, requiredConnectionDetailsType)
                || source.accepts(ANY_CONNECTION_NAME, RedisContainer.class, requiredConnectionDetailsType)
                || source.accepts(ANY_CONNECTION_NAME, RedisStackContainer.class, requiredConnectionDetailsType);
    }
}
```

So **you do not need the third-party library at all** if you use a `GenericContainer` and let the
image name do the work — which is what Boot's own sample does:

```java
@Container
@ServiceConnection                       // matched on the image repository "redis"
static GenericContainer<?> redis =
        new GenericContainer<>("redis:7").withExposedPorts(6379);
```

Two things this arrangement implies. First, if the `com.redis` classes are absent, the two
`source.accepts` calls referencing them would raise `NoClassDefFoundError` — which
`ContainerConnectionDetailsFactory.getConnectionDetails` catches and ignores, leaving image-name
matching intact. That is the swallowed error from [04b](04b-how-the-match-is-made.md) doing useful
work. Second, on a `@Bean` method returning `GenericContainer` there is no image name and no useful
type, so `name = "redis"` is mandatory — the case
[04b2](04b2-the-bean-method-and-narrowing.md) is built around.

⚠️ The type is called **`DataRedisConnectionDetails`** in Boot 4.1. There is no
`RedisConnectionDetails` class anywhere in the 4.1.0 tree, so a `type = RedisConnectionDetails.class`
copied from older material does not compile.

## RabbitMQ Streams: the one opt-in row

> *"By default, with the exception of `RabbitStreamConnectionDetails`, all applicable connection
> details beans will be created for a given `Container`."*
>
> *"To create a `RabbitStreamConnectionDetails` bean from a `RabbitMQContainer`, you must opt in
> using the `type` attribute of `@ServiceConnection`. The container must also expose port 5552, the
> RabbitMQ streams port."*

Both halves are required, and neither reports the absence of the other:

```java
@Container
@ServiceConnection(type = { RabbitConnectionDetails.class, RabbitStreamConnectionDetails.class })
static RabbitMQContainer rabbit = new RabbitMQContainer("rabbitmq:4-management")
        .withExposedPorts(5672, 5552);
```

Note that once you set `type` at all it becomes a restriction, so listing only
`RabbitStreamConnectionDetails` **suppresses** the ordinary `RabbitConnectionDetails` you probably
still want. List both.

## Kafka is three container classes, and Redpanda is one of them

`KafkaConnectionDetails` matches `org.testcontainers.kafka.KafkaContainer` (Apache Kafka in KRaft
mode), `org.testcontainers.kafka.ConfluentKafkaContainer` (the Confluent Platform image) and
`org.testcontainers.redpanda.RedpandaContainer`. Boot registers a separate factory class for each —
`ApacheKafkaContainerConnectionDetailsFactory`, `ConfluentKafkaContainerConnectionDetailsFactory`,
`RedpandaContainerConnectionDetailsFactory` — so swapping one for another is a change of container
class and its Testcontainers artifact, and nothing else.

## ⚠️ Hazelcast works and is missing from the table

`module/spring-boot-hazelcast/src/main/resources/META-INF/spring.factories` at `v4.1.0` registers:

```
org.springframework.boot.autoconfigure.service.connection.ConnectionDetailsFactory=\
org.springframework.boot.hazelcast.docker.compose.HazelcastDockerComposeConnectionDetailsFactory,\
org.springframework.boot.hazelcast.testcontainers.HazelcastContainerConnectionDetailsFactory
```

and that second factory is constructed
`super("hazelcast/hazelcast", "com.hazelcast.client.config.ClientConfig")` — image-name matching on
`hazelcast/hazelcast`, guarded by the Hazelcast client class being present. **The reference's
Testcontainers table does not list it**; Hazelcast appears only in the Docker Compose table on the
dev-services page.

So: the source says a `@ServiceConnection`-annotated container named `hazelcast/hazelcast` produces
a `HazelcastConnectionDetails` bean. I could not confirm this from the reference documentation
because the documentation omits the row. Treat it as working-but-undocumented, and prefer the
documented rows when a reviewer is going to ask.

## Gotchas

**★ The SQL coverage is much wider than the table implies.**
Three rows say `JdbcDatabaseContainer`, which every SQL module's container extends. If Testcontainers
has a module for your engine, `@ServiceConnection` almost certainly wires its `DataSource`, Flyway
and Liquibase — even though the engine has no row.

**★ `type = RedisConnectionDetails.class` does not compile on Boot 4.1.**
The type is `DataRedisConnectionDetails`, in `org.springframework.boot.data.redis.autoconfigure`.
No class named `RedisConnectionDetails` exists in the 4.1.0 source tree.

**★ Setting `type` for RabbitMQ Streams silently switches off ordinary RabbitMQ.**
`type` is a restriction over the whole set. `type = RabbitStreamConnectionDetails.class` alone
means "only that one". List `RabbitConnectionDetails` as well.

**★ Exposing 5552 without setting `type` gets you nothing, and so does the reverse.**
The two requirements are independent and neither failure mentions the other. You need both.

**★ `redis:7-alpine` matches; `bitnami/redis:7` does not.**
The tag is stripped, the path is not. Only `redis`, `redis/redis-stack` and
`redis/redis-stack-server` are in the name list — every other Redis image needs
`@ServiceConnection(name = "redis")`.

**★ The `com.redis.testcontainers` classes are not a Testcontainers artifact.**
They are a separate community project. If you copy a sample that imports
`com.redis.testcontainers.RedisContainer`, you are adding a third-party dependency, and you do not
have to: a `GenericContainer` on the `redis` image is matched by image name and is what Boot's own
documentation uses.

**★ Hazelcast is supported in code but absent from the reference table.**
The factory is registered in `spring.factories` and matches the `hazelcast/hazelcast` image. If a
reviewer asks for a documentation link, there is not one for Testcontainers — only for Docker
Compose.

**★ OTLP is three rows, not one.**
Logging, metrics and tracing each have their own `ConnectionDetails` type. They all match the same
two things — an `otel/opentelemetry-collector-contrib` image or an `LgtmStackContainer` — so one
container feeds all three, but `type` narrowing operates on them individually.

## Interview questions

**★ Why are Flyway, JDBC and Liquibase all matched on `JdbcDatabaseContainer`?**
Because none of the three needs anything engine-specific — they need a URL, a username and a
password, and `JdbcDatabaseContainer` is the abstract base that exposes exactly those for every SQL
module. Matching there rather than on `PostgreSQLContainer` means one annotation wires the
application's `DataSource` and both migration tools, and that every SQL engine Testcontainers
supports is covered without Boot enumerating it.

**★ Does `@ServiceConnection` set `spring.flyway.url` for you?**
No — it registers a `FlywayConnectionDetails` bean, which Flyway's auto-configuration prefers over
the properties. The practical effect is what people want from `spring.flyway.url`, but the mechanism
is a bean, so setting `spring.flyway.url` alongside it does nothing.

**★ Is Redis supported out of the box?**
Yes, in two ways. By image name — `redis`, `redis/redis-stack`, `redis/redis-stack-server` — which
works with a plain `GenericContainer` and no extra dependency, and is what Boot's own sample uses.
And by type, on `com.redis.testcontainers.RedisContainer` or `RedisStackContainer`, which are
third-party classes from the community `testcontainers-redis` project, not from Testcontainers or
Spring. The factory tries the name list first and then those two types.

**★ What is special about RabbitMQ Streams in the catalogue?**
It is the single exception to "all applicable connection details beans are created". You have to
opt in by listing `RabbitStreamConnectionDetails` in the annotation's `type` attribute, and the
container must expose port 5552. And because `type` is a restriction, opting in without also
listing `RabbitConnectionDetails` turns the ordinary AMQP wiring off.

**★ Your engine is not in the table. Is it unsupported?**
Not necessarily, and for SQL engines almost certainly not — if the container class extends
`JdbcDatabaseContainer` it matches the JDBC, Flyway and Liquibase factories regardless of whether
its name appears anywhere. For non-SQL services the table is the answer, and the fallback is
`@DynamicPropertySource` or a `DynamicPropertyRegistrar`, which
[04c](04c-dynamicpropertysource.md) covers.

**★ How does the fallback to properties actually work when there is no container?**
Each module ships a properties-backed implementation of its `ConnectionDetails` interface —
`PropertiesJdbcConnectionDetails`, `PropertiesDataRedisConnectionDetails` and so on — registered
only when no other bean of that type exists. So "connection details take precedence over
properties" is not a precedence rule at all; the properties path is itself a `ConnectionDetails`
bean, and it is the one that backs off.

{/* FOOTER */}
