---
title: "Testcontainers 2.0 removed the self-type generic from every module container class, so the one line every tutorial opens with — new PostgreSQLContainer<>(image) — now compiles only against a deprecated shim, and that is before you reach the renamed artifacts and relocated packages"
sidebar_label: "02 · What Testcontainers is"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Testcontainers 2.0.5 source tarball**
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)) — the module
> sources and `build.gradle` were read directly — and the **2.0.0 release notes**, from which the
> four breaking-change bullets are quoted verbatim.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing on this page is a container log, a
> timing or a test run; the pages carry Java source and documented configuration only.

**[01](01-passed-on-h2-proves-nothing.md) argued that a test whose assertion depends on what the
SQL returned must run on the engine you deploy. Testcontainers is how. It is a Java library that
starts a container, waits until the thing inside it is actually ready, hands you its host and
mapped port, and tears it down afterwards — nothing more conceptual than that. The reason this
chunk is long is not the concept. It is that **2.0 broke almost every line of sample code in
existence**, and you will meet those samples before you meet the release notes.**

## What it actually does

Four jobs, and the third is the one you would otherwise write badly yourself:

1. **Start a container** from an image you name, with environment, ports and volumes you set in
   Java rather than in YAML.
2. **Wait until it is ready** — not until the container is *running*, which is much earlier than
   the database being able to answer. Testcontainers ships wait strategies per module, which is
   most of the value; a hand-rolled `Thread.sleep(5000)` is both slower and less reliable, and
   [topic 01 · 14c](../01-junit-5/14c-timing-and-concurrency.md) explains why sleeping is never
   the fix.
3. **Expose the mapping.** The container's port 5432 is published to a *random* host port, so
   nothing collides — which is the same fixed-port argument [04b · webEnvironment](../05-the-test-pyramid/04b-webenvironment.md)
   makes about `DEFINED_PORT`. You ask the container what it got.
4. **Clean up**, via a companion container (Ryuk) that removes what the run created even if the
   JVM dies.

It is not a Docker replacement, not a test framework, and not tied to JUnit — the JUnit
integration ([03 · The JUnit integration](03-the-junit-integration.md)) is one optional module.

## 🔴 What 2.0.0 broke — four bullets, quoted

From the 2.0.0 release notes:

- *"Removed JUnit 4 support"*
- *"All modules are now prefixed with `testcontainers-`. For example, `org.testcontainers:mysql`
  is now `org.testcontainers:testcontainers-mysql`"* — the core artifact keeps its name
- *"Container classes relocated to `org.testcontainers.<module-name>` package."*
- *"Drop module's default constructors"* — `new PostgreSQLContainer()` with no image is gone; you
  name the image

Each of those breaks copied code in a different way: a dependency that does not resolve, an import
that does not exist, a constructor that is not there.

## 🔴🔴 And the one that is not in a bullet: the self-type generic is gone

This is the one that will actually cost you time, because the error is confusing rather than
absent. In 2.0.5:

```java
public class PostgreSQLContainer extends JdbcDatabaseContainer<PostgreSQLContainer>
```

`org.testcontainers.postgresql.PostgreSQLContainer` is **not generic**. So:

```java
// 1.x — every tutorial, every blog post, every generated snippet
PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:18-alpine");

// 2.x
PostgreSQLContainer pg = new PostgreSQLContainer("postgres:18-alpine");
```

The old `org.testcontainers.containers.PostgreSQLContainer<SELF>` still exists, so the 1.x line
*can* compile — against a class marked `@Deprecated`, whose javadoc says to *"use
`org.testcontainers.postgresql.PostgreSQLContainer` instead"*. There are **35 such deprecated
shims** across the modules. Boot 4.1's own samples use the non-generic form.

⚠️ **Two things that did *not* change**, which is why the rule is not "drop all the generics":

- **`GenericContainer<SELF>`** in `org.testcontainers.containers` is unchanged and **still
  generic**.
- **`JdbcDatabaseContainer`** also stays in `org.testcontainers.containers` — which matters more
  than it looks, because `@ServiceConnection` matches Flyway, JDBC and Liquibase on exactly that
  type ([04 · @ServiceConnection](04-serviceconnection.md)).

## ⚠️ Where the documentation is stale

Two pages on the docs site still describe the removed JUnit 4 support: `docs/index.md` lists it
under Prerequisites, and `docs/test_framework_integration/junit_4.md` still ships. The source
tells the truth — there is no `org.junit.rules` anywhere in `core/src/main` on 2.0.5.

**Trust the sources over the docs site on this specific point.** It is a good general habit for
a library mid-major-version, and it is why this topic's `> Verified:` lines name the tag they
were read from.

## ⚠️ The minimum JDK — stated as uncertain, deliberately

The documentation's Prerequisites section lists only Docker and a JVM test framework. It **does
not state a minimum Java version.**

From the build at tag 2.0.5: the root `build.gradle` sets `options.release.set(8)` for all
subprojects, with `release 17` applied only to `core`'s *test* compilation and to the
`weaviate`/`openfga` (17) and `hivemq` (11) modules. **So core is still Java 8 bytecode and
Testcontainers imposes no Java 17 floor of its own.**

On this stack the floor comes from elsewhere — JUnit Jupiter 6 and Spring Boot 4 both require
Java 17. That is the honest statement, and it is different from "Testcontainers requires 17",
which is what you will read elsewhere.

## Where the container runtime comes from

Testcontainers talks to a Docker-API-compatible daemon. Docker Engine and Docker Desktop are the
tested path. **Podman works and is explicitly second-class**, in the project's own words:

> *"Alternative container runtimes are not actively tested in the main development workflow, so
> not all Testcontainers features might be available."*

The Podman wiring, including the rootless case, is [09 · The cost](09-the-cost.md) — along with
the question that matters more than any of this: whether your CI can run containers at all.

## Gotchas and pitfalls

**★ Copying any Testcontainers sample written before 2026.**
Four separate things changed: the artifact name gained a `testcontainers-` prefix, the package
moved to `org.testcontainers.<module>`, the no-image constructor was removed, and the container
class lost its self-type generic. A sample can fail on all four.

**★ `new PostgreSQLContainer<>("postgres:18-alpine")` compiling and looking fine.**
It resolved the **deprecated** `org.testcontainers.containers` shim, not the current class. It
works today and it is one of 35 shims on a deprecation path.

**★ Dropping the generic from `GenericContainer` too.**
`GenericContainer<SELF>` is unchanged and still generic. The de-generification applies to *module*
container classes, not to everything.

**★ Believing the docs site about JUnit 4.**
Two pages still document it; the source has no `org.junit.rules` in `core/src/main` on 2.0.5. It
is removed.

**★ Repeating "Testcontainers requires Java 17".**
The documentation states no minimum, and core still compiles to Java 8 bytecode. The Java 17 floor
on this stack comes from JUnit Jupiter 6 and Boot 4.

**★ Waiting for the container instead of the service.**
A running container is not a ready database. The module wait strategies are much of what you are
paying for; replacing one with a sleep makes the suite slower *and* flakier.

**★ Assuming a fixed host port.**
Ports are published to random host ports precisely so parallel builds do not collide. Ask the
container what it got — the same lesson as binding port zero in
[topic 01 · 14h](../01-junit-5/14h-ports-network-and-the-database.md).

**★ Treating Podman as a drop-in.**
It works, and the project says not all features might be available since alternative runtimes are
not actively tested. Rootless Podman additionally needs Ryuk disabled — [09](09-the-cost.md).

## Interview questions

**★ What does Testcontainers actually do for you?**
Starts a container from an image you name, waits until the *service* inside is ready rather than
merely until the container is running, exposes the randomly-mapped host port so parallel runs
cannot collide, and cleans up afterwards via a companion container that survives the JVM dying.
The wait strategies are most of the value.

**★ What broke in Testcontainers 2.0?**
JUnit 4 support was removed; every module artifact gained a `testcontainers-` prefix; container
classes relocated to `org.testcontainers.<module-name>`; module default constructors were dropped
so you must name the image. And, not stated as a headline bullet, module container classes lost
their self-type generic parameter.

**★ Why does `new PostgreSQLContainer<>(image)` still compile then?**
Because the old generic class in `org.testcontainers.containers` still exists as one of 35
`@Deprecated` shims, whose javadoc tells you to use `org.testcontainers.postgresql.PostgreSQLContainer`
instead. The current class is not generic, and Boot 4.1's own samples use the non-generic form.

**★ Did `GenericContainer` lose its generic too?**
No. `GenericContainer<SELF>` in `org.testcontainers.containers` is unchanged, as is
`JdbcDatabaseContainer` — which matters because `@ServiceConnection` matches Flyway, JDBC and
Liquibase on `JdbcDatabaseContainer` specifically.

**★ What is Testcontainers' minimum Java version?**
The documentation does not state one, and core still compiles to Java 8 bytecode at 2.0.5 — only
a few modules and core's own tests target 17. The Java 17 floor on a Boot 4 / Jupiter 6 stack
comes from those, not from Testcontainers.

**★ Can you use Podman?**
Yes, and the project states that alternative container runtimes are not actively tested in the
main development workflow so not all features might be available. It needs `DOCKER_HOST` pointed
at the Podman socket, and rootless Podman additionally requires Ryuk to be disabled.

**★ Why should you not trust the Testcontainers docs site on JUnit 4?**
Because two pages — the index's Prerequisites and the JUnit 4 integration page — still describe
support that 2.0.0's release notes removed and that does not exist in `core/src/main` at 2.0.5.
Mid-major-version, the source is the authority.

{/* FOOTER */}
