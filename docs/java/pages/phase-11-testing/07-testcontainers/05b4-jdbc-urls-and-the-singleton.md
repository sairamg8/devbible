---
title: "Testcontainers' JDBC URL scheme carries its own reuse switch — ?TC_REUSABLE=true — which quietly also puts the driver into daemon mode so it stops closing the container when the last connection goes; and reuse and the singleton pattern are not competitors but different axes that compose into one container that outlives everything"
sidebar_label: "05b4 · JDBC URLs and the singleton"
sidebar_position: 48
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 source tarball**
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)) —
> `docs/features/reuse.md` (also at
> [java.testcontainers.org/features/reuse](https://java.testcontainers.org/features/reuse/)), quoted
> verbatim, and the implementation in
> `modules/jdbc/src/main/java/org/testcontainers/jdbc/{ConnectionUrl,ContainerDatabaseDriver}.java`,
> `modules/jdbc/src/main/java/org/testcontainers/containers/JdbcDatabaseContainerProvider.java` and
> `modules/r2dbc/src/main/java/org/testcontainers/r2dbc/R2DBCDatabaseContainerProvider.java`, read
> directly.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine** — nothing below is a container log, a timing or a
> test run.

**[05b3](05b3-what-reuse-leaks.md) argued about whether to use reuse at all. This chunk is the two
things left: the URL-parameter form, which is how you enable reuse where there is no Java code to
call `withReuse` on, and the relationship between reuse and the singleton pattern, which readers
routinely treat as alternatives and which are in fact orthogonal.**

## The JDBC URL form

Testcontainers' JDBC URL scheme has its own switch, and it is a URL parameter rather than a method
call:

> *"the URL **must** follow the pattern of `jdbc:tc:mysql:8.0.36:///databasename?TC_REUSABLE=true`.
> `TC_REUSABLE=true` is set as a parameter of the JDBC URL."*

This is useful precisely where there is no Java code to call `withReuse` on: a `spring.datasource.url`
in `application-test.yml`, a URL in a Liquibase or Flyway command-line invocation, a scratch
connection from a SQL client. The parameter is parsed in `ConnectionUrl`:

```java
reusable = Boolean.parseBoolean(containerParameters.get("TC_REUSABLE"));
```

and applied by the provider that builds the container:

```java
result.withReuse(url.isReusable());
```

There is a second consequence in `ContainerDatabaseDriver` that is easy to miss:

```java
final boolean isDaemon = connectionUrl.isInDaemonMode() || connectionUrl.isReusable();
```

Normally the JDBC driver stops the container when the **last connection closes**. `TC_REUSABLE=true`
implies daemon mode, so it does not — which is the same "never call `stop()`" contract, enforced for
you. The R2DBC module has the equivalent option: `Option.valueOf("TC_REUSABLE")` in
`R2DBCDatabaseContainerProvider`.

⚠️ The machine-level opt-in still applies. `TC_REUSABLE=true` in a URL on a machine without
`TESTCONTAINERS_REUSE_ENABLE` produces the same `WARN` and an ordinary container.

### The other parameters on that URL, and the cache behind them

`?TC_REUSABLE=true` is one of a small family parsed by `ConnectionUrl`:

| Parameter | Effect |
|---|---|
| `TC_REUSABLE=true` | `withReuse(true)` on the created container, **and** daemon mode |
| `TC_DAEMON=true` | daemon mode alone — the container is not stopped when the last connection closes |
| `TC_INITSCRIPT=…` | a classpath script run once per container id, per JVM |
| `TC_INITFUNCTION=…` | a static Java method run instead of a script |
| `TC_TMPFS=…` | tmpfs mounts for the container |

The driver keeps a static cache of containers keyed on the **exact connection string**:

```java
JdbcDatabaseContainer container = jdbcUrlContainerCache.get(connectionUrl.getUrl());
```

with the source comment *"If we already have a running container for this exact connection string,
we want to connect to that rather than create a new container"*. Two URLs differing by a single
query parameter are two cache entries and therefore two containers — the URL-scheme analogue of the
configuration hash in [05b2](05b2-the-contract-and-the-hash.md), and a second, independent reason
that a stray parameter costs you a container.

The init-script bookkeeping is also per-JVM:

```java
if (!initializedContainers.contains(container.getContainerId())) {
    …
    runInitScriptIfRequired(connectionUrl, databaseDelegate);
    runInitFunctionIfRequired(connectionUrl, connection);
    initializedContainers.add(container.getContainerId());
}
```

`initializedContainers` is a `static final Set<String>` in the driver class, so it is empty in every
new JVM. **A container reused from a previous run is therefore "not initialised" as far as the new
JVM is concerned, and `TC_INITSCRIPT` runs again** — the same trap as `withInitScript` in
[05b3](05b3-what-reuse-leaks.md), arriving by a different route. Idempotent scripts, again.

## Reuse and the singleton solve different problems

Readers conflate these constantly. They are orthogonal, and they compose:

| | Scope of sharing | Mechanism | Cleaned up by |
|---|---|---|---|
| **Singleton** ([05](05-the-singleton-pattern.md)) | every test class **within one JVM run** | a `static` field started in a class initialiser and never stopped | Ryuk, at JVM exit |
| **Reuse** | every JVM run **on that machine** | a hash label on a container that is never registered and never stopped | **you, by hand** |

- A singleton **without** reuse: one container per `./gradlew test`, removed when the run ends.
  Isolation between runs is perfect.
- Reuse **without** a singleton is nearly impossible to arrange sensibly — the contract forbids the
  JUnit integration, which leaves you starting the container manually somewhere, which is the
  singleton pattern by another name.
- A singleton **with** reuse: one container, ever, until you delete it. The static block's
  `start()` finds the existing container by hash and attaches to it instead of creating one.

So the honest way to describe reuse is **an extension of the singleton across process boundaries**,
paid for with the reaper. Note what you give up in the same breath: the singleton's safety net was
Ryuk, and reuse removes exactly that.

## Gotchas

**★ `TC_REUSABLE=true` in a URL still needs the machine-level opt-in.**
The URL parameter reaches `withReuse(true)`, and `withReuse(true)` is inert without
`TESTCONTAINERS_REUSE_ENABLE=true` or the user properties file ([05b](05b-reuse.md)). You get the
same `WARN` and an ordinary container.

**★ Confusing `TC_DAEMON` with `TC_REUSABLE`.**
`TC_DAEMON=true` stops the driver from shutting the container down when the last connection closes —
within one JVM. `TC_REUSABLE=true` implies daemon mode *and* asks for the container to be found
again by hash on the next run. Daemon mode alone gives you nothing across runs.

**★ Two URLs that differ by one parameter are two containers.**
`jdbcUrlContainerCache` is keyed on the full connection string. Adding `TC_INITSCRIPT` to one place
and not another, or reordering parameters, produces a second cache entry and a second container in
the same JVM.

**★ `TC_INITSCRIPT` re-runs against a reused container.**
The driver's `initializedContainers` set is a per-JVM static, so a container inherited from
yesterday's run has never been "initialised" in today's JVM. The script executes again against a
populated database.

**★ Trying to use reuse without something singleton-shaped.**
The contract forbids `stop()` and therefore forbids the JUnit integration and try-with-resources.
Whatever you build instead — a static field, a holder, the JDBC URL scheme's own static cache — is a
singleton by another name. There is no third option.

**★ Assuming a reused container is the one your teammate is using.**
The hash is computed from configuration, not from identity, and containers are found on the local
daemon only. Two developers with identical configuration each reuse their **own** container; nothing
is shared between machines.

**★ Expecting reuse to survive a Docker Desktop restart.**
The lookup filters on status `running`. A restarted daemon leaves the container present but stopped,
so the next run creates a new one and the old one lingers. Over weeks this is how a laptop
accumulates a dozen Postgres containers.

## Interview questions

**★ What is the JDBC-URL form of reuse, and what else does it change?**
`jdbc:tc:mysql:8.0.36:///databasename?TC_REUSABLE=true`. `ConnectionUrl` parses the parameter, the
`JdbcDatabaseContainerProvider` calls `withReuse(url.isReusable())` on the container it builds, and
`ContainerDatabaseDriver` treats a reusable URL as daemon mode — so the driver does not stop the
container when the last connection closes, which is the "never call `stop()`" contract enforced for
you. It is useful where there is no Java code to call `withReuse` on, such as a
`spring.datasource.url` in a YAML file.

**★ Distinguish reuse from the singleton pattern.**
The singleton shares one container across every test class **within one JVM run**, using a static
field that is never stopped, and Ryuk removes it when the JVM exits. Reuse shares one container
across **JVM runs on one machine**, by matching a configuration hash against a still-running
container that was never registered with Ryuk. They compose — a singleton with `withReuse(true)`
gives you one container that survives everything — and the composition is the only sane way to use
reuse, because the contract rules out the JUnit integration anyway.

**★ What is the difference between `TC_DAEMON=true` and `TC_REUSABLE=true`?**
`TC_DAEMON` only tells `ContainerDatabaseDriver` not to stop the container when the last connection
closes, which keeps it alive within the current JVM. `TC_REUSABLE` does that as well — the driver
computes `isDaemon = connectionUrl.isInDaemonMode() || connectionUrl.isReusable()` — and
additionally calls `withReuse(true)` on the container, so the *next* JVM can find it again by
configuration hash. Daemon mode is a within-run setting; reuse is a between-run one.

**★ Why can `TC_INITSCRIPT` run twice against a reused container?**
Because the driver tracks which containers it has initialised in a `static` set of container ids,
which lives in the JVM. A container reused from a previous run has an id that today's JVM has never
seen, so the script is executed again — against a database that already has everything the script
creates. Write it idempotently.

**★ Where is the JDBC-URL form of reuse actually useful?**
Anywhere there is no Java to call `withReuse` on: a `spring.datasource.url` in a test YAML file, a
Flyway or Liquibase command-line invocation, a scratch connection from a SQL client that you want
pointed at the same container your tests use. It is also the only form available when the container
type is chosen by the URL through the `JdbcDatabaseContainerProvider` service loader rather than
constructed by you.

**★ If reuse and the singleton pattern compose, is there any reason to use the singleton alone?**
Yes, and it is the default. The singleton alone gives one container per run and perfect isolation
between runs, because Ryuk removes it at JVM exit. Adding reuse trades that isolation for not paying
startup on the second run of the day, and hands you the container's lifetime to manage. Use the
singleton always; add reuse only on your own machine, and only when the four conditions in
[05b3](05b3-what-reuse-leaks.md) hold.

{/* FOOTER */}
