---
title: "Nothing configures which container maps to which ConnectionDetails — the rule is three gates in one method, and the container type Boot matches on is recovered by reflecting on a factory's own generic parameters"
sidebar_label: "04b · How the match is made"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.1** reference at tag `v4.1.0`
> ([`testing/testcontainers.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/testcontainers.adoc))
> and the `spring-boot-testcontainers` sources at the same tag —
> [`ContainerConnectionSource`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot-testcontainers/src/main/java/org/springframework/boot/testcontainers/service/connection/ContainerConnectionSource.java)
> and
> [`ContainerConnectionDetailsFactory`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot-testcontainers/src/main/java/org/springframework/boot/testcontainers/service/connection/ContainerConnectionDetailsFactory.java),
> read directly.
> Version spine: JDK 25, Spring Boot 4.1.1, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**[04](04-serviceconnection.md) established that `@ServiceConnection` registers `ConnectionDetails`
beans rather than properties. This chunk answers the question that immediately follows: *which*
beans, and decided how? There is no registry file mapping images to services, no annotation
attribute that selects a technology, and no convention over the field name. There is one method
with three `if` statements, and a piece of reflection that turns a factory's generic signature into
its matching rule. Read those and the feature has no remaining mystery — including its failures.**

## 🔴 How the match is actually made

The reference gives the shape:

> *"Service connection annotations are processed by `ContainerConnectionDetailsFactory` classes
> registered with `spring.factories`. A `ContainerConnectionDetailsFactory` can create a
> `ConnectionDetails` bean based on a specific `Container` subclass, or the Docker image name."*

The detail is in `ContainerConnectionSource.accepts(...)`, and it is three independent gates. All
three must pass:

```java
public boolean accepts(@Nullable String requiredConnectionName, Class<?> requiredContainerType,
        Class<?> requiredConnectionDetailsType) {
    if (StringUtils.hasText(requiredConnectionName)
            && !requiredConnectionName.equalsIgnoreCase(this.connectionName)) {
        return false;                                              // (1) name gate
    }
    if (!requiredContainerType.isAssignableFrom(this.containerType)) {
        return false;                                              // (2) container-type gate
    }
    if (!this.connectionDetailsTypes.isEmpty() && this.connectionDetailsTypes.stream()
            .noneMatch((candidate) -> candidate.isAssignableFrom(requiredConnectionDetailsType))) {
        return false;                                              // (3) type= gate
    }
    return true;
}
```

1. **The name gate only fires if the factory asks for a name.** A factory constructed with
   `ANY_CONNECTION_NAME` — which is a `protected static final` constant equal to `null` — skips it
   entirely. That is why a `PostgreSQLContainer` matches regardless of what image you gave it.
   Note `equalsIgnoreCase`: the name comparison is **case-insensitive**.
2. **The container-type gate is where "matched on container type" lives.** The
   `requiredContainerType` is not configured anywhere — it is recovered by reflecting on the
   factory's own generic signature:
   ```java
   private @Nullable Class<?>[] resolveGenerics() {
       return ResolvableType.forClass(ContainerConnectionDetailsFactory.class, getClass())
               .resolveGenerics();
   }
   ```
   A factory declared `extends ContainerConnectionDetailsFactory<Neo4jContainer, Neo4jConnectionDetails>`
   *is* the statement "I match `Neo4jContainer`". Nothing else declares it.
3. **The `type=` gate is the only one you control from the annotation**, and note the direction:
   each class you listed must be `isAssignableFrom` the type the factory wants. Listing an
   interface admits its implementations, not the other way round.

Two more filters sit in front of all three, in `getConnectionDetails`:

```java
if (!hasRequiredClasses()) {
    return null;
}
try {
    // ... resolveGenerics(), sourceAccepts(), getContainerConnectionDetails() ...
}
catch (NoClassDefFoundError ex) {
    // Ignore
}
```

A factory that names required classes (Hazelcast's names `com.hazelcast.client.config.ClientConfig`)
**disappears silently when they are absent**, and a `NoClassDefFoundError` raised while resolving
a factory's own generics is swallowed. Both are deliberate — they are how optional third-party
container types stay optional — and both mean "a missing test dependency looks exactly like a
missing feature".

## Where the name comes from when you do not give one

> *"By default `Container.getDockerImageName().getRepository()` is used to obtain the name used to
> find connection details. The repository portion of the Docker image name ignores any registry
> and the version. This works as long as Spring Boot is able to get the instance of the
> `Container`, which is the case when using a `static` field like in the example above."*

In source, `ContainerConnectionSource` resolves it once at construction:

```java
private static @Nullable String getOrDeduceConnectionName(@Nullable String connectionName,
        @Nullable String containerImageName) {
    if (StringUtils.hasText(connectionName)) {
        return connectionName;
    }
    if (StringUtils.hasText(containerImageName)) {
        DockerImageName imageName = DockerImageName.parse(containerImageName);
        imageName.assertValid();
        return imageName.getRepository();
    }
    return null;
}
```

So `ghcr.io/example/redis:7.4-alpine` yields the connection name `example/redis` — registry and
tag stripped, **path kept**. That is not `redis`, and nothing named `example/redis` is in the
catalogue, so the match fails. The fix is the `name` attribute, and the reference says so for
exactly this case:

> *"You can also use the `name` attribute of `@ServiceConnection` to override which connection
> detail will be used, for example when using custom images. If you are using the Docker image
> `registry.mycompany.com/mirror/myredis`, you'd use `@ServiceConnection(name="redis")` to ensure
> `DataRedisConnectionDetails` are created."*

```java
@Container
@ServiceConnection(name = "redis")
static GenericContainer<?> redis =
        new GenericContainer<>("registry.mycompany.com/mirror/myredis:7")
                .withExposedPorts(6379);
```


## The whole rule, in one paragraph

A factory declares what it matches by *being* a particular parameterised subclass, and optionally
by passing connection names and required class names to its superclass constructor. A source
declares what it is by its container type, its image repository, and whatever you put in `name` and
`type`. Boot pairs every source with every factory and keeps the pairs that survive all three
gates. That is the entire feature.

## Gotchas

**★ A private-registry or forked image name breaks the name match.**
`getRepository()` strips the registry and the tag but **keeps the path**, so
`ghcr.io/example/redis:7.4-alpine` becomes `example/redis`, which appears in no factory's name
list. Nothing in the failure will mention the registry. The fix is
`@ServiceConnection(name = "redis")`.

**★ A factory with missing required classes vanishes rather than failing.**
`hasRequiredClasses()` makes `getConnectionDetails` return `null` when a named class is absent from
the classpath, and a `NoClassDefFoundError` raised while resolving a factory's generics is caught
and ignored. A missing optional test dependency is therefore indistinguishable from an unsupported
service — unless you turn on TRACE logging, which
[04b2](04b2-the-bean-method-and-narrowing.md) shows how to do.

**★ Connection-name matching is case-insensitive, and that is an implementation detail.**
`accepts` uses `equalsIgnoreCase`, so `@ServiceConnection(name = "Redis")` currently matches. The
reference documents no such tolerance. Write the name exactly as the catalogue spells it.

**★ The `type` gate's assignability runs in the direction people do not expect.**
The check is `candidate.isAssignableFrom(requiredConnectionDetailsType)` — each class you listed
must be assignable *from* the type the factory produces. Listing an interface admits its
implementations; listing an implementation does not admit the interface.

**★ `type` on its own cannot make an unsupported container match.**
It is a restriction applied *after* the name and container-type gates, not an override that forces
a factory to accept a source. If the container type is wrong, adding `type` changes nothing.

**★ An image tag never participates in the match.**
`DockerImageName.parse(...).getRepository()` drops it. `postgres:14` and `postgres:18-alpine` are
the same connection name, which is why you can bump an image version without touching the
annotation — and why pinning a version in the annotation is not a thing you can do.

**★ `imageName.assertValid()` runs during name derivation.**
A malformed image string fails while Boot is deducing the connection name, not when the container
starts. The failure therefore surfaces earlier and in a less obvious place than "bad image name".

## Interview questions

**★ How does Boot decide which `ConnectionDetails` to create from a given container?**
Three gates in `ContainerConnectionSource.accepts`, all of which must pass. The connection name
must match if the factory demands one, compared case-insensitively. The factory's required
container type must be assignable from the container's declared type. And if you set `type` on the
annotation, one of the classes you listed must be assignable from the type the factory produces.
Every registered factory is offered every source, and each accepted pair produces one bean.

**★ Where does a factory's "required container type" come from? It is not in a config file.**
It comes from the factory's own generic signature.
`ContainerConnectionDetailsFactory.resolveGenerics()` calls
`ResolvableType.forClass(ContainerConnectionDetailsFactory.class, getClass()).resolveGenerics()`,
so a class declared `extends ContainerConnectionDetailsFactory<Neo4jContainer, Neo4jConnectionDetails>`
*is* the statement "I match `Neo4jContainer` and produce `Neo4jConnectionDetails`". Nothing else
declares it, which is why the documentation can describe the whole feature as "matched on container
type".

**★ Where does the connection name come from if you do not supply one?**
From `Container.getDockerImageName().getRepository()` — the repository portion, which drops the
registry and the tag but keeps any path segment. That requires the container *instance* to exist at
matching time, which is true for a `static` field and false for a `@Bean` method.

**★ What does `ANY_CONNECTION_NAME` mean?**
It is a `protected static final String` on `ContainerConnectionDetailsFactory` whose value is
`null`, passed by the no-argument constructor. A factory constructed with it skips the name gate
entirely and relies purely on container type — which is what the great majority of factories do,
and why `PostgreSQLContainer` matches no matter what image you gave it.

**★ Can one factory match on both a type and an image name?**
Yes, and the Redis factory does exactly that. It passes the image-name list
`"redis"`, `"redis/redis-stack"`, `"redis/redis-stack-server"` to the superclass constructor, then
overrides `sourceAccepts` to additionally accept `com.redis.testcontainers.RedisContainer` and
`RedisStackContainer` with `ANY_CONNECTION_NAME`. `sourceAccepts` is `protected` precisely so a
factory can widen the default rule.

**★ Why is a `NoClassDefFoundError` caught and ignored inside `getConnectionDetails`?**
Because factories reference container classes that may not be on the test classpath — resolving a
factory's generics can load a type that is not there. Swallowing it lets Boot ship one long list of
factories in `spring.factories` while only the ones whose dependencies are present take effect. The
cost is that a genuinely missing dependency looks like silence.

**★ How would you write your own service connection?**
Extend `ContainerConnectionDetailsFactory` with the container type and the details type as its two
generic parameters, implement `getContainerConnectionDetails(ContainerConnectionSource)`, and
register the class in `META-INF/spring.factories` under
`org.springframework.boot.autoconfigure.service.connection.ConnectionDetailsFactory`. The generic
parameters are the matching rule. If you also want image-name matching, pass the names — and any
class names that must be present — to the superclass constructor.

{/* FOOTER */}
