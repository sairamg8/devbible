---
title: "withReuse(true) is a declaration that a container is eligible for reuse, not a command to reuse it — the decision belongs to the machine running the tests, through an environment variable or the user's home-directory properties file and explicitly not through anything you can commit to the repository"
sidebar_label: "05b · Reuse: the opt-in"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 source tarball**
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)) — `docs/features/reuse.md`
> (also published at [java.testcontainers.org/features/reuse](https://java.testcontainers.org/features/reuse/),
> from which every quotation below is taken verbatim), plus the implementation in
> `core/src/main/java/org/testcontainers/containers/GenericContainer.java` and
> `core/src/main/java/org/testcontainers/utility/TestcontainersConfiguration.java`, read directly.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine** — nothing below is a container log, a timing or a
> test run.

**The singleton pattern of [05](05-the-singleton-pattern.md) gets you one container per JVM run.
Reuse is the next step and a categorically different one: it keeps the container alive *between*
runs, so the second `./gradlew test` of the morning attaches to the container the first one
started. It is a small API — one method — surrounded by an unusually large number of ways to be
confused, starting with the fact that calling the method is not enough.**

## What it is, in the documentation's words

> *"The *Reusable* feature keeps the containers running and next executions with the same container
> configuration will reuse it. To use it, start the container manually by calling `start()` method,
> do not call `stop()` method directly or indirectly via `try-with-resources` or `JUnit
> integration`, and enable it manually through an opt-in mechanism per environment. To reuse a
> container, the container configuration **must be the same**."*

Three requirements in one paragraph, and each is a section below: **an opt-in per environment**, **a
manual `start()` with no `stop()`**, and **an identical configuration**. Miss any one and you get a
fresh container with no error and no explanation.

## 🔴 Requirement one: the machine opts in, not the repository

This is the single most common confusion about the feature, and the documentation is precise about
it:

> *"Enable `Reusable Containers`*
> * *through environment variable `TESTCONTAINERS_REUSE_ENABLE=true`*
> * *through user property file `~/.testcontainers.properties`, by adding
>   `testcontainers.reuse.enable=true`*
> * ***not** through classpath properties file"*

The exclusion is not an oversight. The implementation enforces it — `environmentSupportsReuse()`
calls `getEnvVarOrUserProperty`, not `getEnvVarOrProperty`:

```java
@UnstableAPI
public boolean environmentSupportsReuse() {
    return Boolean.parseBoolean(getEnvVarOrUserProperty("testcontainers.reuse.enable", "false"));
}
```

and the two lookups differ in exactly one argument — which property sources they consult:

```java
public String getEnvVarOrProperty(String propertyName, String defaultValue) {
    return getConfigurable(propertyName, defaultValue, userProperties, classpathProperties);
}

public String getEnvVarOrUserProperty(String propertyName, String defaultValue) {
    return getConfigurable(propertyName, defaultValue, userProperties);   // <- no classpathProperties
}
```

The environment-variable name is derived rather than declared, in `getConfigurable`:

```java
String envVarName = propertyName.replaceAll("\\.", "_").toUpperCase();
if (!envVarName.startsWith("TESTCONTAINERS_") && !envVarName.startsWith("DOCKER_")) {
    envVarName = "TESTCONTAINERS_" + envVarName;
}
```

`testcontainers.reuse.enable` uppercases to `TESTCONTAINERS_REUSE_ENABLE`, which already carries the
prefix, so no second prefix is added. The environment variable wins over the file, and an
environment variable set to the **empty string** is skipped rather than treated as false.

### Why the classpath exclusion exists, and what it means for a team

A classpath `testcontainers.properties` is a file in your repository — it is committed, it ships to
every developer and to CI, and it applies to everyone who checks the project out. Reuse is a
**per-machine trade**: it exchanges isolation for speed, and it is only defensible when the person
making the trade is the one who will debug the stale container. The documentation's own note is that
reusable containers *"are not suited for CI usage"*, and a classpath property is precisely the
mechanism that would push the setting into CI along with everything else.

The practical consequence, and it is worth saying to your team out loud:

- **You cannot turn reuse on for the project.** There is no committable switch.
- **Each developer opts in individually**, by exporting `TESTCONTAINERS_REUSE_ENABLE=true` or adding
  one line to `~/.testcontainers.properties`.
- **`withReuse(true)` in the code is therefore safe to commit.** On a machine that has not opted in
  it is inert — which is the design: the code says "this container is *eligible* for reuse", the
  machine says whether reuse actually happens.

That last point is the one to internalise. `withReuse(true)` is a *declaration of eligibility*, not
a command.

### What happens when the code opts in and the machine does not

Nothing dramatic, which is why people think reuse is broken:

```java
if (TestcontainersConfiguration.getInstance().environmentSupportsReuse()) {
    …                                  // hash, look for an existing container, label it
    reusable = true;
} else {
    logger().warn(
        "Reuse was requested but the environment does not support the reuse of containers\n" +
        "To enable reuse of containers, you must set 'testcontainers.reuse.enable=true' in a file located at {}",
        Paths.get(System.getProperty("user.home"), ".testcontainers.properties"));
    reusable = false;
}
```

The run continues with an ordinary, Ryuk-registered, single-run container. The only signal is a
`WARN` line naming the exact file path — which is easy to miss in a build log and is the first thing
to look for when reuse "does not work".

## Where this goes next

The other two requirements — the manual `start()` with no `stop()`, and the identical configuration
that the hash enforces — are [05b2](05b2-the-contract-and-the-hash.md). What a reused container
actually costs you, which is the part worth deciding on, is
[05b3](05b3-what-reuse-leaks.md).

## Gotchas

**★ `withReuse(true)` alone does nothing, and says so only in a `WARN`.**
Without `TESTCONTAINERS_REUSE_ENABLE=true` or `testcontainers.reuse.enable=true` in
`~/.testcontainers.properties`, `environmentSupportsReuse()` is false and you get an ordinary
container. The only signal is one log line naming the file path it looked for.

**★ Putting `testcontainers.reuse.enable=true` in `src/test/resources/testcontainers.properties`.**
That is a classpath properties file, which the documentation excludes in bold and which the
implementation excludes by calling `getEnvVarOrUserProperty`. It will be silently ignored — and
because the file *does* work for other Testcontainers settings, the natural conclusion is that reuse
is broken rather than that this one setting is deliberately excluded.

**★ Enabling reuse globally and forgetting.**
`~/.testcontainers.properties` is one file in your home directory that affects **every** project you
build on that machine, including ones whose authors never considered reuse, and it also changes when
Ryuk starts ([05a2](05a2-ryuk-and-cleanup.md)). Prefer the environment variable scoped to a shell or
a run configuration when you can.

**★ Exporting the variable in your shell and running the tests from the IDE.**
The environment is read from the process that runs the tests. A variable exported in a terminal
profile does not reach an IDE launched from a desktop menu, and it does not reach a Gradle daemon
that was already running. Either put it in the run configuration or use
`~/.testcontainers.properties`, which every process on the machine reads.

**★ Setting the variable to the empty string.**
`getConfigurable` skips an environment variable whose value is empty and falls through to the
properties file — so `TESTCONTAINERS_REUSE_ENABLE=` is not "false", it is "unset". Setting it to
`false` explicitly is what actually overrides a `true` in the properties file.

**★ Assuming reuse is a project decision you can review in a pull request.**
There is nothing to review. `withReuse(true)` in committed code is inert until a human enables reuse
on their own machine, and that enabling is invisible to the repository. If a colleague reports a
failure you cannot reproduce, "do you have reuse enabled?" is a question the code cannot answer for
you.

## Interview questions

**★ What does `withReuse(true)` do on a machine that has not enabled reuse?**
Nothing, apart from logging a warning. `GenericContainer.tryStart()` checks
`TestcontainersConfiguration.environmentSupportsReuse()`; when it is false the container is created,
registered with Ryuk and stopped normally. This is deliberate: the code declares that a container is
*eligible* for reuse, and the machine decides whether reuse happens.

**★ Where can you enable reuse, and where can you deliberately not?**
Through the environment variable `TESTCONTAINERS_REUSE_ENABLE=true`, or through
`testcontainers.reuse.enable=true` in the user property file `~/.testcontainers.properties`.
Explicitly **not** through a classpath `testcontainers.properties`, and the implementation enforces
it by resolving this one setting with `getEnvVarOrUserProperty`, which does not consult classpath
properties. The point is that reuse cannot be committed into a repository and imposed on CI or on
other developers.

**★ Which wins if the environment variable and the properties file disagree?**
The environment variable, and only if it is non-empty. `getConfigurable` builds the variable name
from the property name, checks the process environment first, and falls through to the property
sources only when the variable is absent or empty. So `TESTCONTAINERS_REUSE_ENABLE=false` overrides
`testcontainers.reuse.enable=true` in `~/.testcontainers.properties`, but
`TESTCONTAINERS_REUSE_ENABLE=` does not.

**★ Why is reuse opt-in per environment rather than per project?**
Because it trades isolation for speed, and the person who should make that trade is the one who will
debug the stale container — not whoever committed a properties file two years ago. Putting the
switch in the environment or in the user's home directory also keeps it out of CI, where the
documentation says reusable containers do not belong.

{/* FOOTER */}
