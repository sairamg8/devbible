---
title: "The reuse contract forbids the JUnit integration outright, refuses any container class that overrides containerIsCreated, and defines *the same configuration* as a SHA-1 over the entire serialised create command — so changing one environment variable silently gives you a second container instead of the one you meant to reuse"
sidebar_label: "05b2 · The contract and the hash"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 source tarball**
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)) —
> `docs/features/reuse.md` (also at
> [java.testcontainers.org/features/reuse](https://java.testcontainers.org/features/reuse/)), from
> which the contract sentence is quoted verbatim, and the implementation in
> `core/src/main/java/org/testcontainers/containers/GenericContainer.java` and
> `core/src/main/java/org/testcontainers/DockerClientFactory.java`, read directly.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine** — nothing below is a container log, a timing or a
> test run.

**[05b](05b-reuse.md) covered the opt-in that has to happen on the machine. This chunk is the other
two requirements the documentation states in the same paragraph: start the container yourself and
never stop it, and keep the configuration identical. The first rules out `@Container` entirely. The
second is enforced by a hash you cannot see, which is why a reuse that has quietly stopped working
gives you no error at all.**

## 🔴 Requirement two: `start()` by hand, and never `stop()`

> *"start the container manually by calling `start()` method, do not call `stop()` method directly
> or indirectly via `try-with-resources` or `JUnit integration`"*

**Reuse and `@Container` are mutually exclusive.** The JUnit integration exists to call `stop()` for
you — that is the whole of `StoreAdapter.close()` in
[05](05-the-singleton-pattern.md) — and the reuse contract forbids exactly that call. Nor can the
container be an `AutoCloseable` in a try-with-resources, for the same reason. What you are left with
is the singleton shape:

```java
public final class Containers {

    public static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:18-alpine")
                    .withDatabaseName("app")
                    .withUsername("app")
                    .withPassword("app")
                    .withReuse(true);          // eligibility, not a command

    static {
        POSTGRES.start();                      // the manual start the contract requires
    }

    private Containers() {}
}
```

No `@Testcontainers`, no `@Container`, no `stop()`, no try-with-resources. The documentation's own
sample is the same shape with a `GenericContainer`:

> ```java
> GenericContainer container = new GenericContainer("redis:6-alpine")
>     .withExposedPorts(6379)
>     .withReuse(true)
> ```

⚠️ Note that sample uses the **raw type** `GenericContainer`. Unlike the module container classes,
`GenericContainer<SELF>` did *not* lose its generic in 2.x ([02](02-what-testcontainers-is.md)), so
copying that line as written gives you unchecked-warning code; type your own declarations.

### The classes that cannot be reused at all

`withReuse(true)` can fail loudly, and the check is worth knowing because the reason is
non-obvious:

```java
protected boolean canBeReused() {
    for (Class<?> type = getClass(); type != GenericContainer.class; type = type.getSuperclass()) {
        try {
            Method method = type.getDeclaredMethod("containerIsCreated", String.class);
            if (method.getDeclaringClass() != GenericContainer.class) {
                logger().warn("{} can't be reused because it overrides {}", getClass(), method.getName());
                return false;
            }
        } catch (NoSuchMethodException | NoClassDefFoundError e) {
            // ignore
        }
    }
    return true;
}
```

and in `tryStart()`:

```java
if (!canBeReused()) {
    throw new IllegalStateException("This container does not support reuse");
}
```

The rule is: **a container class that overrides `containerIsCreated(String)` cannot be reused**,
because that hook is the one place a container does work between *creation* and *start*, and a
reused container is never created. Across the shipped modules at 2.0.5 the only class that overrides
it is `org.testcontainers.containers.DockerMcpGatewayContainer`; `PostgreSQLContainer`,
`MySQLContainer`, `MongoDBContainer`, `KafkaContainer`, `LocalStackContainer` and
`JdbcDatabaseContainer` do not. **Your own `GenericContainer` subclass might**, and this is the
error you will get.

## 🔴 Requirement three: "the container configuration must be the same"

This is the trap that makes people conclude reuse is broken, because a mismatch is silent. "The
same" is not a judgement call — it is a SHA-1:

```java
final String hash(CreateContainerCmd createCommand) {
    DefaultDockerClientConfig dockerClientConfig = DefaultDockerClientConfig.createDefaultConfigBuilder().build();
    byte[] commandJson = dockerClientConfig.getObjectMapper().copy()
        .enable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
        .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
        .writeValueAsBytes(createCommand);
    // TODO add Testcontainers' version to the hash
    return Hashing.sha1().hashBytes(commandJson).toString();
}
```

**The hash is over the entire serialised `CreateContainerCmd`** — image name and tag, environment
variables, exposed ports, command, entrypoint, labels, host config, volumes, everything. Properties
and map entries are sorted first so that ordering does not perturb it. The container that gets
created is then labelled `org.testcontainers.hash = <that hash>`, and the lookup is:

```java
Optional<String> findContainerForReuse(String hash) {
    // TODO locking
    return dockerClient.listContainersCmd()
        .withLabelFilter(ImmutableMap.of(HASH_LABEL, hash))
        .withLimit(1)
        .withStatusFilter(Arrays.asList("running"))
        .exec()
        .stream().findAny().map(it -> it.getId());
}
```

So: **any difference in the create command produces a different hash, no match, and a brand new
container — silently.** The old one keeps running, because nothing ever stops a reusable container.
Things that change the hash:

- the image tag — `postgres:18-alpine` to `postgres:18.1-alpine`;
- any environment variable, including the ones the module derives from
  `withDatabaseName` / `withUsername` / `withPassword`;
- an added or removed exposed port;
- a label you added with `withLabel`;
- **a copied file's contents.** Before hashing, `tryStart` puts a checksum of everything you queued
  with `withCopyFileToContainer` into a label:

  ```java
  createCommand.getLabels().put(COPIED_FILES_HASH_LABEL, Long.toHexString(hashCopiedFiles().getValue()));
  ```

  `hashCopiedFiles()` folds each destination path *and* the file's content into an `Adler32`
  checksum, sorted by destination path. So editing an init script that gets copied in changes the
  label, which changes the hash, which gives you a new container — which is the behaviour you want,
  and is worth knowing before it confuses you;
- **upgrading Testcontainers.** `DEFAULT_LABELS` — which includes
  `org.testcontainers.version` — is merged into the create command *before* the hash is computed, so
  a version bump changes it. The `// TODO add Testcontainers' version to the hash` comment above
  suggests the maintainers do not consider this a designed guarantee, so do not depend on it either
  way; just expect a fresh container after an upgrade.

Two things that deliberately do **not** enter the hash: the `org.testcontainers.sessionId` label,
because a reusable container is never registered with the reaper and so never receives it, and the
randomly-assigned host port, which is an outcome of starting rather than an input to creating.

⚠️ **`withStatusFilter(["running"])`.** If you stopped the container by hand — `docker stop`, a
reboot, Docker Desktop quitting — it is no longer *running*, so it is not a reuse candidate and a
new one is created beside it. The stopped one stays on disk until you remove it.

⚠️ **`// TODO locking`.** There is no lock around find-then-create. Two JVMs starting the same
reusable container at the same moment — two IDE runs, or a Gradle build and a test you launched by
hand — can both miss and both create one. After that you have two containers with the same hash
label and `withLimit(1)` picks whichever the daemon lists first.

## Where this goes next

What the reused container actually contains — and the local-passes/CI-fails failure it produces — is
[05b3](05b3-what-reuse-leaks.md).

## Gotchas

**★ Combining `withReuse(true)` with `@Container`.**
The contract forbids calling `stop()` "directly or indirectly via … `JUnit integration`", and the
JUnit integration's entire job is calling `stop()`. Use the singleton shape instead.

**★ Combining `withReuse(true)` with try-with-resources.**
`GenericContainer` implements `AutoCloseable`, so a try-with-resources block closes and stops it.
Same violation, harder to spot, because there is no annotation to notice.

**★ Changing anything about the container and wondering why reuse stopped working.**
The hash covers the whole serialised create command. A new tag, a renamed database, an extra
environment variable, an added port, an added label, an edited copied file — each produces a
different hash, no match, and a new container, with no message. The old one is still running.

**★ Expecting a stopped container to be reused.**
`findContainerForReuse` filters on `withStatusFilter(["running"])`. After a reboot, or after Docker
Desktop restarts, yesterday's container exists but is not running, so a new one is created and the
old one stays on disk. Reuse accumulates stopped containers unless you prune them.

**★ Two builds racing to create the same reusable container.**
There is a literal `// TODO locking` above `findContainerForReuse`. Two JVMs can both fail to find
one and both create one; afterwards `withLimit(1)` picks arbitrarily between them, so which
container your test talks to is not stable.

**★ Reusing a container after upgrading Testcontainers.**
`org.testcontainers.version` is one of the default labels merged into the create command before the
hash is taken, so a version bump changes the hash and you get a new container. The old one keeps
running. This is fine — just do not be surprised, and do not build a workflow that assumes the hash
is stable across upgrades, given the `// TODO` next to it.

**★ Calling `withReuse(true)` on a container class that overrides `containerIsCreated`.**
`canBeReused()` returns false and `tryStart()` throws `IllegalStateException("This container does
not support reuse")`. In the shipped modules only `DockerMcpGatewayContainer` does this — but your
own `GenericContainer` subclass easily might.

**★ Copying the documentation's `GenericContainer` sample verbatim.**
It uses the raw type. `GenericContainer<SELF>` is still generic in 2.x even though the module
container classes are not, so the sample compiles with unchecked warnings. Type your declarations.

## Interview questions

**★ Why are reuse and `@Container` mutually exclusive?**
Because the reuse contract says to start the container manually and never to call `stop()`,
"directly or indirectly via `try-with-resources` or `JUnit integration`" — and calling `stop()` is
precisely what the JUnit integration does when the test class's extension context closes. The
compatible shape is the singleton: a static field, started in a static initialiser, never stopped.

**★ What does "the container configuration must be the same" actually mean?**
That the SHA-1 of the serialised `CreateContainerCmd` — image and tag, environment, ports, command,
labels, host config, plus a checksum label covering the contents of any files queued for copying —
matches the `org.testcontainers.hash` label on a **running** container. Any difference at all
produces a different hash, no match, and a new container, with no error. That silence is why people
believe reuse is broken.

**★ Can two builds race to create the same reusable container?**
Yes. `findContainerForReuse` carries a `// TODO locking` comment and there is no lock between the
lookup and the create, so two JVMs starting concurrently can both find nothing and both create a
container with the same hash label. Afterwards the `withLimit(1)` lookup picks arbitrarily between
them.

**★ Why can some containers not be reused at all?**
`canBeReused()` walks the class hierarchy looking for an override of `containerIsCreated(String)`,
and returns false if it finds one — that hook runs between creation and start, and a reused
container is never created. `withReuse(true)` on such a class makes `tryStart()` throw
`IllegalStateException("This container does not support reuse")`. In the shipped 2.0.5 modules only
`DockerMcpGatewayContainer` overrides it, but a custom subclass can.

{/* FOOTER */}

{/* FOOTER */}
