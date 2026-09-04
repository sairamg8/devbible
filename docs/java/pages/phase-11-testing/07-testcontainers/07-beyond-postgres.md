---
title: "Everything the topic has argued about PostgreSQL applies unchanged to Kafka, MongoDB, Elasticsearch and the rest — but the module you need may not exist, may not be maintained by Testcontainers at all, or may be a plain GenericContainer, and 2.0 renamed and relocated every one of them"
sidebar_label: "07 · Beyond PostgreSQL"
sidebar_position: 45
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5** module sources and docs at tag `2.0.5`
> ([github.com/testcontainers](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)),
> the **2.0.0 release notes**, and Spring Boot 4.1's **Testcontainers** reference
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Testcontainers 2.0.5, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries Java source and documented configuration only.

**[01](01-passed-on-h2-proves-nothing.md) made the argument with a database because that is where
the substitution is most tempting and most wrong. The argument does not depend on it being a
database. An embedded Kafka is not Kafka, an in-memory `Map` is not Redis, and a stubbed S3 client
is not S3 — each of them agrees with the real thing right up to the behaviour you were testing for.
What changes as you move off PostgreSQL is not the reasoning; it is the *supply*. Some services
have a first-party module, some have a third-party one Testcontainers does not maintain, and some
have nothing at all and are a `GenericContainer` you configure yourself — which is
[07b](07b-genericcontainer-and-waiting.md).**

## 🔴 First: every module was renamed and relocated in 2.0

Before any of the per-service detail, the thing that will break your build. From the 2.0.0 release
notes:

> *"All modules are now prefixed with `testcontainers-`. For example, `org.testcontainers:mysql` is
> now `org.testcontainers:testcontainers-mysql`"*

> *"Container classes relocated to `org.testcontainers.<module-name>` package."*

So a dependency **and** an import changed for every service simultaneously:

```groovy
// 1.x — will not resolve on 2.x
testImplementation "org.testcontainers:kafka"
testImplementation "org.testcontainers:mongodb"

// 2.x
testImplementation "org.testcontainers:testcontainers-kafka"
testImplementation "org.testcontainers:testcontainers-mongodb"
```

```java
// 1.x — org.testcontainers.containers.* for everything
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.containers.MongoDBContainer;

// 2.x — one package per module
import org.testcontainers.kafka.KafkaContainer;
import org.testcontainers.mongodb.MongoDBContainer;
```

🔴 The core artifact keeps its name, and `GenericContainer` and `JdbcDatabaseContainer` **stay in
`org.testcontainers.containers`** — which is why a half-migrated build can compile some imports and
not others. [02](02-what-testcontainers-is.md) has the rest of what 2.0 broke, including the
self-type generic that vanished from every module container class.

## The three tiers of support, and telling them apart matters

| Tier | What you get | Example |
|---|---|---|
| **First-party module** | a class with the service's own API, sane defaults and a wait strategy that knows what "ready" means for that service | `KafkaContainer`, `MongoDBContainer`, `Neo4jContainer` |
| **Third-party module** | a container class maintained by somebody else, in their group id | 🔴 **Redis** — `com.redis.testcontainers.RedisContainer` |
| **No module** | `GenericContainer`, and the wait strategy is your problem | anything niche or internal — [07b](07b-genericcontainer-and-waiting.md) |

**The tier decides how much you have to know.** A first-party module has already answered "when is
this actually ready", which [02](02-what-testcontainers-is.md) argued is most of the value. A
`GenericContainer` has not, and the default — wait for the first mapped port to listen — is
frequently wrong.

## 🔴 Redis is the one that catches everyone

There is no `org.testcontainers:testcontainers-redis`. Redis support comes from **Redis's own
project**, in a different group id, with a different class:

```groovy
testImplementation "com.redis:testcontainers-redis:<version>"
```

```java
import com.redis.testcontainers.RedisContainer;

@Container
@ServiceConnection
static RedisContainer redis = new RedisContainer("redis:7-alpine");
```

Boot knows about it anyway. Its service-connection support matches
`com.redis.testcontainers.RedisContainer` and `RedisStackContainer` by type, **and** matches by
image name for containers called `redis`, `redis/redis-stack` and `redis/redis-stack-server` — so a
plain `GenericContainer` on one of those images is also recognised. That image-name fallback is the
reason the `@ServiceConnection(name = "redis")` hint exists for the `@Bean` case, covered in
[04 · `@ServiceConnection`](04-serviceconnection.md).

⚠️ Because it is third-party, its version is **not** managed by `spring-boot-dependencies`. You pin
it yourself, and it moves on its own schedule — which is exactly the kind of thing that quietly
lags a major Testcontainers release.

## Kafka — three container classes, and they are not interchangeable

| Class | Image family |
|---|---|
| `org.testcontainers.kafka.KafkaContainer` | Apache Kafka |
| `org.testcontainers.kafka.ConfluentKafkaContainer` | Confluent Platform |
| `org.testcontainers.redpanda.RedpandaContainer` | Redpanda |

All three are recognised by `@ServiceConnection`, so from Spring's side they are equivalent — the
choice is about which broker's behaviour you want to test against. The reason this matters more
than it looks: the thing people usually reach for instead is an **embedded broker**, and the whole
of [01](01-passed-on-h2-proves-nothing.md)'s argument applies to it. An embedded broker's
partition assignment, rebalance timing, offset commit semantics and `min.insync.replicas`
behaviour are approximations. If your test asserts on any of those, it needs the real broker.

```java
@Container
@ServiceConnection
static KafkaContainer kafka = new KafkaContainer("apache/kafka:3.9.0");
```

🔴 **A Kafka test is not a database test and does not get isolation from a transaction.** Nothing
in [06d](06d-the-rollback-strategy.md) applies: an offset committed is committed, a topic created
persists for the life of the container, and consumer group state survives your test class. The
practical equivalents of truncation are a **unique topic name per test** — the unique-data strategy
from [06f](06f-sql-scripts-and-unique-data.md), and by far the simplest — or a unique consumer
group id, or deleting topics in a teardown.

## MongoDB, Elasticsearch, Neo4j, Cassandra — the same shape

```java
import org.testcontainers.mongodb.MongoDBContainer;

@Bean
MongoDBContainer mongoDbContainer() {
    return new MongoDBContainer(DockerImageName.parse("mongo:5.0"));
}
```

All are first-party, all are matched by `@ServiceConnection` on container type. Two things worth
knowing across the set:

- **`MongoDBAtlasLocalContainer` exists** alongside `MongoDBContainer` and is also recognised —
  useful when the production target is Atlas rather than a plain replica set.
- **Elasticsearch has an SSL story the others do not.** Boot ships `@Ssl`, `@JksKeyStore`,
  `@JksTrustStore`, `@PemKeyStore` and `@PemTrustStore` to configure a service connection's client
  side, and `ElasticsearchContainer` additionally supports automatic detection of server-side SSL
  when annotated `@Ssl`. Boot is explicit that these are client-side only: *"you still have to
  enable SSL on the service which is running inside the Testcontainer yourself, the annotations
  only configure SSL on the client side in your application."*

## LocalStack — testing against AWS without AWS

`LocalStackContainer` runs an emulator for the AWS APIs, which puts it in an interesting position
relative to this topic's central argument: **it is itself a substitute.** It is not S3; it is a
reimplementation of S3's API.

That is not a reason to avoid it — the alternative is usually a hand-written mock of your own S3
client, which is a *worse* substitute because it agrees with your assumptions rather than with a
serious attempt at the real API. But it does mean the honest claim is narrower than for PostgreSQL:

- ✅ **What it does prove:** your client is configured correctly, your bucket and key naming is
  right, your request shapes and multipart handling are valid, your error handling for a 404 or an
  access-denied works, and your code path executes end to end.
- ❌ **What it does not prove:** eventual-consistency behaviour, real IAM policy evaluation, S3's
  actual durability and versioning semantics, request throttling, or anything about a service's
  performance envelope.

Say that out loud in the test's name or a comment. A `LocalStack` test that claims to prove IAM is
the same false green [01](01-passed-on-h2-proves-nothing.md) is about, one layer up.

## When a service has no module at all

Then it is a `GenericContainer`, you name the image, you expose the ports, and — the part that
actually matters — **you decide what "ready" means**, because the default is to wait for the first
mapped port to be listening and that is often true well before the service can answer. That is
[07b · `GenericContainer` and waiting](07b-genericcontainer-and-waiting.md), along with the
mapped-port and network mechanics every one of the modules above is built on.

## Gotchas

**★ Every module's artifact id and package changed in 2.0, at the same time.**
`org.testcontainers:mysql` became `org.testcontainers:testcontainers-mysql`, and container classes
*"relocated to `org.testcontainers.<module-name>` package"*. Both a dependency and an import must
change per service — and because core, `GenericContainer` and `JdbcDatabaseContainer` kept their
old home, a half-migrated build compiles partially and confuses everyone.

**★ There is no first-party Redis module.**
It is `com.redis:testcontainers-redis`, in a different group id, with `RedisContainer` in
`com.redis.testcontainers`. Searching for `org.testcontainers:redis` finds nothing and people
conclude Redis is unsupported.

**★ A third-party module's version is not managed by `spring-boot-dependencies`.**
You pin Redis's yourself. It can lag a Testcontainers major release, which is precisely the
situation where a stale version is most likely to break.

**★ An embedded Kafka is the same mistake as H2, one layer up.**
Rebalance timing, partition assignment, offset-commit semantics and `min.insync.replicas` are
approximated. A test asserting on any of them proves something about the embedded broker.

**★ Nothing about transactional rollback helps a Kafka test.**
Committed offsets, created topics and consumer-group state all survive the test method and the test
class. Use a unique topic or group id per test — the unique-data strategy — rather than looking for
an isolation mechanism that does not exist here.

**★ LocalStack is a substitute, and pretending otherwise repeats the H2 error.**
It proves wiring, request shapes and error handling. It does not prove IAM evaluation, consistency
semantics or throttling. Name the test for what it actually covers.

**★ Boot's SSL annotations configure the client, not the server.**
*"you still have to enable SSL on the service which is running inside the Testcontainer yourself,
the annotations only configure SSL on the client side in your application."* A test that adds
`@PemKeyStore` and expects the container to start serving TLS will fail confusingly.

**★ Three different Kafka container classes exist and they are not interchangeable.**
`KafkaContainer`, `ConfluentKafkaContainer` and `RedpandaContainer` each target a different broker
image family. Boot recognises all three, so the compiler and the wiring will not tell you that you
picked the one that does not match production.

**★ `GenericContainer` on a recognised image name still gets a service connection.**
Boot matches Redis on images named `redis`, `redis/redis-stack` or `redis/redis-stack-server`, and
several other services by image name — so a container you thought was unconfigured may in fact be
contributing connection details, and one you thought would be matched is not because you renamed
the image.

**★ Picking a module does not remove the wait-strategy question, it answers it for you.**
That is most of what a first-party module is worth. The moment you drop to `GenericContainer`, the
question comes back and the default answer is usually wrong.

## Interview questions

**★ Does the "H2 proves nothing" argument apply to anything other than databases?**
Yes, unchanged. An embedded Kafka approximates rebalance and offset semantics; an in-memory map
approximates Redis's eviction and expiry; a hand-written fake approximates whatever its author
assumed. Every one of them agrees with the real service until precisely the behaviour under test.

**★ What broke about module dependencies in Testcontainers 2.0?**
Every module artifact gained a `testcontainers-` prefix and every container class moved to
`org.testcontainers.<module-name>`. Core kept its artifact name, and `GenericContainer` and
`JdbcDatabaseContainer` stayed in `org.testcontainers.containers` — so a partial migration compiles
in places and not others.

**★ How do you get a Redis container, and why is the answer surprising?**
From `com.redis:testcontainers-redis`, not from `org.testcontainers`. It is a third-party module in
its own group id, so its version is not managed by Boot's BOM. Boot's service connection still
recognises it, by type and also by image name for `redis`, `redis/redis-stack` and
`redis/redis-stack-server`.

**★ Your Kafka test is flaky because a previous test's messages are still on the topic. What is the
fix?**
Give each test its own topic name, or its own consumer group id. There is no transactional rollback
for a broker — committed offsets and created topics outlive the test — so the right strategy is the
unique-data one rather than a cleanup one.

**★ Which Kafka container class should you use?**
Whichever matches the broker you deploy: `KafkaContainer` for Apache Kafka,
`ConfluentKafkaContainer` for Confluent Platform, `RedpandaContainer` for Redpanda. `@ServiceConnection`
recognises all three, so nothing in the wiring will warn you if you chose the wrong one.

**★ Is LocalStack an exception to this topic's argument?**
It is a knowing compromise. LocalStack is itself an emulator, so it cannot prove IAM evaluation,
consistency semantics or throttling — but it is a far better substitute than a hand-written mock of
your own client, because it is an independent attempt at the real API rather than a restatement of
your assumptions. Scope the claim in the test's name.

**★ What does Boot's `@Ssl` family actually configure?**
The client side of the service connection — key stores and trust stores for your application. The
service inside the container still has to be serving TLS, which you arrange yourself.
`ElasticsearchContainer` additionally supports automatic detection of server-side SSL when
annotated with `@Ssl`.

**★ When do you drop to `GenericContainer`, and what do you take on?**
When no first-party or third-party module exists. You take on naming the image, exposing the ports,
and — the real cost — defining what "ready" means, because the default wait is for the first mapped
port to listen and services routinely accept connections before they can serve them.

{/* FOOTER */}
