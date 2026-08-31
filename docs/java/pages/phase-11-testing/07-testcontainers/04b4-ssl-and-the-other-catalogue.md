---
title: "The SSL annotations that sit beside @ServiceConnection configure your client and never the containerised server, and Boot's Docker Compose support reuses the same ConnectionDetails interfaces with a completely different matching rule and a different list of services"
sidebar_label: "04b4 · SSL, and the other catalogue"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.0** reference at tag `v4.1.0` —
> [`testing/testcontainers.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/testcontainers.adoc)
> (the "SSL with Service Connections" section and its `include-code` samples) and
> [`features/dev-services.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/features/dev-services.adoc)
> (the Docker Compose service-connection table and SSL labels).
> Version spine: JDK 25, Spring Boot 4.1.0, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**[04b3](04b3-the-supported-services.md) is the catalogue. This chunk is the two things sitting
next to it that get mistaken for parts of it: a set of SSL annotations that only ever configure the
*client*, and a second, differently-matched catalogue belonging to Boot's Docker Compose support
which people copy rows out of on the assumption that the two lists agree. They do not.**

## The SSL annotations, and their much shorter list

A separate list, and a shorter one. Boot ships `@Ssl`, `@JksKeyStore`, `@JksTrustStore`,
`@PemKeyStore` and `@PemTrustStore` to sit alongside `@ServiceConnection`, supported for
**Cassandra, Couchbase, Elasticsearch, Kafka, MongoDB, RabbitMQ, RabbitMQ Streams and Redis** — and
nothing else. The documentation is careful about what they do:

> *"Please note that you still have to enable SSL on the service which is running inside the
> Testcontainer yourself, the annotations only configure SSL on the client side in your
> application."*

`ElasticsearchContainer` is the exception that needs less work:

> *"The `ElasticsearchContainer` additionally supports automatic detection of server side SSL. To
> use this feature, annotate the container with `@Ssl`, and Spring Boot takes care of the client
> side SSL configuration for you."*

## The Docker Compose catalogue is a different catalogue

Boot's `spring-boot-docker-compose` support uses the same `ConnectionDetails` abstraction but
**matches only on image name**, because there is no Java container object to inspect. The lists
therefore diverge: Docker Compose has a Hazelcast row and matches JDBC on the literal image names
`postgres`, `mysql`, `mariadb`, `mssql/server`, `clickhouse/clickhouse-server`, `gvenzl/oracle-free`
and `gvenzl/oracle-xe`, where Testcontainers matches on `JdbcDatabaseContainer` and covers engines
no image list names. Do not read one table and assume the other.


## What the annotations look like in use

Boot's own PEM sample, verbatim from the reference's `include-code`:

```java
@Testcontainers
@SpringBootTest
class MyRedisWithSslIntegrationTests {

    @Container
    @ServiceConnection
    @PemKeyStore(certificate = "classpath:client.crt", privateKey = "classpath:client.key")
    @PemTrustStore("classpath:ca.crt")
    static RedisContainer redis = new SecureRedisContainer("redis:latest");

    @Autowired
    private RedisOperations<Object, Object> operations;

    @Test
    void testRedis() {
        // ...
    }
}
```

Three things to read out of that. The keystore annotation loads the **client** certificate and key;
the truststore annotation loads the CA that validates the **server**'s certificate — the reference
spells that division out explicitly. The paths are ordinary Spring resource locations, so
`classpath:` works. And `SecureRedisContainer` is not a Boot or Testcontainers class:

> *"The `SecureRedisContainer` in this example is a custom subclass of `RedisContainer` which copies
> certificates to the correct places and invokes `redis-server` with commandline parameters enabling
> SSL."*

That subclass is the whole "you still have to enable SSL on the service yourself" clause made
concrete. There is no annotation that makes the container serve TLS.

Elasticsearch is the exception, and its sample is correspondingly short:

```java
@Testcontainers
@DataElasticsearchTest
class MyElasticsearchWithSslIntegrationTests {

    @Ssl
    @Container
    @ServiceConnection
    static ElasticsearchContainer elasticsearch = new ElasticsearchContainer(
            "docker.elastic.co/elasticsearch/elasticsearch:8.17.2");

    @Autowired
    private ElasticsearchTemplate elasticsearchTemplate;

    @Test
    void testElasticsearch() {
        // ...
    }
}
```

Note the image: `docker.elastic.co/elasticsearch/elasticsearch:8.17.2`, a registry-qualified name
whose repository is `elasticsearch/elasticsearch`. That would fail a *name*-based match — but
Elasticsearch is matched on the `ElasticsearchContainer` **type**, so the image name never
participates. It is a good illustration of why [04b](04b-how-the-match-is-made.md)'s distinction
between the two matching modes is worth holding on to.

Also note the slice: `@DataElasticsearchTest`, not `@SpringBootTest`. Service connections work
inside slices — the annotation registers a bean, and a slice that includes the relevant
auto-configuration will consume it. Which slice to choose is
[05 · The test pyramid](../05-the-test-pyramid/03-the-slices.md)'s subject, not this topic's.

## How Docker Compose does the same job differently

The two supports share `ConnectionDetails` and share nothing else about matching:

| | Testcontainers | Docker Compose |
|---|---|---|
| What is matched | container **type**, or image name | image name **only** |
| Why | a Java `Container` object exists to inspect | there is no Java object — Boot reads `compose.yml` and the running containers |
| Custom images | `@ServiceConnection(name = "redis")` | a `org.springframework.boot.service-connection` label |
| Excluding one | remove the annotation | a `org.springframework.boot.ignore` label |
| SSL configuration | `@Ssl` / `@PemKeyStore` / `@JksKeyStore` etc. on the field | `org.springframework.boot.sslbundle.pem.*` / `.jks.*` container labels |
| Readiness | Testcontainers wait strategies | a `healthcheck` in `compose.yml`, plus Boot's own TCP check |
| In tests | the point of the feature | **disabled by default** |

The label form, for a custom image, is the direct analogue of `@ServiceConnection(name = "redis")`:

```yaml
services:
  redis:
    image: 'mycompany/mycustomredis:7.0'
    ports:
      - '6379'
    labels:
      org.springframework.boot.service-connection: redis
```

And the SSL analogue of `@PemKeyStore` is a set of labels rather than an annotation:

```yaml
    labels:
      - 'org.springframework.boot.sslbundle.pem.keystore.certificate=client.crt'
      - 'org.springframework.boot.sslbundle.pem.keystore.private-key=client.key'
      - 'org.springframework.boot.sslbundle.pem.truststore.certificate=ca.crt'
```

The Docker Compose SSL list is also *shorter* than the Testcontainers one: Cassandra,
Elasticsearch, MongoDB, RabbitMQ, RabbitMQ Streams and Redis — **no Couchbase and no Kafka**, both
of which the Testcontainers annotations do support.

## Docker Compose in tests is off unless you turn it on

> *"By default, Spring Boot's Docker Compose support is disabled when running tests. To enable
> Docker Compose support in tests, set `spring.docker.compose.skip.in-tests` to `false`."*

On Gradle there is a second half:

> *"When using Gradle, you also need to change the configuration of the `spring-boot-docker-compose`
> dependency from `developmentOnly` to `testAndDevelopmentOnly`."*

This is the sharpest practical difference between the two features. Docker Compose support is a
*development-time* convenience that happens to be usable in tests; Testcontainers service
connections are a *test* feature that happens to be usable at development time
([04b6](04b6-importing-and-development-time.md)). Reaching for the wrong one produces a suite
whose containers are shared, long-lived and outside the build's control — which is a different
argument, made in **09 · The cost** *(not written yet)*.

## Gotchas

**★ The SSL annotations configure the client, not the server.**
Boot says so explicitly. You still have to make the containerised service speak TLS — in its own
sample that means a hand-written `SecureRedisContainer` subclass that copies certificates in and
passes TLS flags to `redis-server`. Elasticsearch is the one case where `@Ssl` alone is enough,
because Boot can detect server-side SSL.

**★ `@PemKeyStore` and `@PemTrustStore` are not interchangeable halves of one thing.**
The keystore carries *your* certificate and private key, authenticating the client to the server.
The truststore carries the CA that validates the *server's* certificate. Putting the CA in the
keystore annotation configures mutual TLS with the wrong material.

**★ Only eight services support the SSL annotations, and the list is not the catalogue.**
Cassandra, Couchbase, Elasticsearch, Kafka, MongoDB, RabbitMQ, RabbitMQ Streams and Redis. Every
other row in [04b3](04b3-the-supported-services.md) — including all the JDBC ones — has no
service-connection SSL support at all.

**★ Docker Compose and Testcontainers do not support the same set of services.**
Same `ConnectionDetails` interfaces, different matching and different tables. Docker Compose has a
documented Hazelcast row where Testcontainers does not; Testcontainers covers SQL engines by base
class that no Docker Compose image list names. A row you found in one does not license the other.

**★ The two SSL lists differ too.**
Docker Compose SSL covers Cassandra, Elasticsearch, MongoDB, RabbitMQ, RabbitMQ Streams and Redis —
Couchbase and Kafka are in the Testcontainers list and not in this one.

**★ Docker Compose support does nothing in a test run unless you flip a property.**
`spring.docker.compose.skip.in-tests` defaults to skipping. On Gradle the dependency also has to
move from `developmentOnly` to `testAndDevelopmentOnly`, and doing only one of the two leaves you
with a silently inert feature.

**★ A registry-qualified image is fine when the match is type-based.**
Boot's own Elasticsearch sample uses `docker.elastic.co/elasticsearch/elasticsearch:8.17.2`, whose
repository is `elasticsearch/elasticsearch` and would match no name list. It works because
Elasticsearch is matched on the container type. The registry only hurts you on the name-matched
rows.

## Interview questions

**★ Which services support SSL through the service-connection annotations?**
Cassandra, Couchbase, Elasticsearch, Kafka, MongoDB, RabbitMQ, RabbitMQ Streams and Redis, via
`@Ssl`, `@JksKeyStore`, `@JksTrustStore`, `@PemKeyStore` and `@PemTrustStore`. They configure the
client side only — you still have to make the service inside the container serve TLS — except for
`ElasticsearchContainer`, where `@Ssl` alone triggers automatic detection of server-side SSL.

**★ What is the difference between `@PemKeyStore` and `@PemTrustStore` here?**
The keystore annotation loads the client certificate and private key, so the server can authenticate
your application. The truststore annotation loads the CA certificate, so your application can verify
that the server's certificate is valid and trusted. Boot's sample uses both together, which is
mutual TLS.

**★ If the annotations only configure the client, how does the container end up serving TLS?**
You make it. Boot's Redis sample uses a `SecureRedisContainer`, described as *"a custom subclass of
`RedisContainer` which copies certificates to the correct places and invokes `redis-server` with
commandline parameters enabling SSL"*. That is a container subclass you write, or an image you
build. Nothing in the service-connection feature changes what runs inside the container.

**★ Boot's Docker Compose support and Testcontainers both create `ConnectionDetails` beans. When would you use each?**
Docker Compose support is a development-time convenience over a `compose.yml` you already maintain,
and it is disabled in tests by default. Testcontainers service connections are a test feature whose
containers are declared in Java, started per application context and torn down by the build. Use
Docker Compose to run the app locally against real services; use Testcontainers to make the test
suite self-contained.

**★ Why can Docker Compose only match on image name?**
Because there is no Java container object to inspect. Boot reads the compose file and the running
containers, so all it has is an image name and a set of labels — the container-type gate that does
most of the work on the Testcontainers side has no input. That is also why the custom-image escape
hatch is a label, `org.springframework.boot.service-connection`, rather than an annotation
attribute.

**★ How do you exclude one container in a `compose.yml` from service connections?**
Label it `org.springframework.boot.ignore: true`. There is no Testcontainers equivalent because
there does not need to be — you simply do not annotate the field.

{/* FOOTER */}
