---
title: "One attribute on @Testcontainers will let a CI build report success having run none of your integration tests, because the Docker probe catches Throwable and cannot tell a laptop without Docker from a pipeline whose socket permissions are wrong"
sidebar_label: "03e · Ordering and the Docker switch"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 sources** at
> [tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5) —
> [`Testcontainers`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/Testcontainers.java),
> [`TestcontainersExtension`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/TestcontainersExtension.java),
> [`EnabledIfDockerAvailable`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/EnabledIfDockerAvailable.java),
> `EnabledIfDockerAvailableCondition` and `DockerAvailableDetector`; the **JUnit 6.0.3 user guide**
> ([Registering Extensions](https://docs.junit.org/6.0.3/extensions/registering-extensions.html),
> [Relative Execution Order](https://docs.junit.org/6.0.3/extensions/relative-execution-order-of-user-code-and-extensions.html));
> and the **Spring Framework 7.0.8** reference
> [`dynamic-property-sources.adoc`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/testcontext-framework/ctx-management/dynamic-property-sources.adoc).
> Version spine: JDK 25, Spring Boot 4.1.0, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — only source that was read and documentation that was quoted.

**[03d](03d-the-lifecycle-argument.md) settled when to use the extension at all. This chunk is where
container startup sits relative to your own lifecycle methods — including the part I could not
confirm and will not guess at — and the one attribute on `@Testcontainers` that can quietly delete
your integration suite from a passing build. The parallelism attribute and the `@Nested` limitation
are [03f](03f-parallelism-and-nested.md).**

## Ordering — what is documented, and what I could not confirm

Two things about ordering **are** documented and you can rely on them.

**One: extension callbacks run before user lifecycle methods.** The user guide's step table lists
`BeforeAllCallback` as step 1 and `@BeforeAll` as step 2, `BeforeEachCallback` as step 5 and
`@BeforeEach` as step 6. A static container is up before your `@BeforeAll`; an instance container is
up before your `@BeforeEach`.

**Two: extensions wrap each other in registration order**, verbatim:

> *"Extensions registered declaratively via `@ExtendWith` at the class level, method level, or
> parameter level will be executed in the order in which they are declared in the source code."*

> *"given two extensions Extension1 and Extension2 with Extension1 registered before Extension2, any
> 'before' callbacks implemented by Extension1 are guaranteed to execute before any 'before'
> callbacks implemented by Extension2. Similarly … any 'after' callbacks implemented by Extension1
> are guaranteed to execute after any 'after' callbacks implemented by Extension2."*

⚠️ **What I could not confirm from the documentation is the exact point at which Spring's TestContext
framework loads the `ApplicationContext` relative to `TestcontainersExtension.beforeAll`.** Both
`@Testcontainers` and `@SpringBootTest` register their extensions as class-level meta-annotations,
so "the order in which they are declared in the source code" depends on the order you wrote two
annotations in — and neither the Boot nor the Framework reference states where context loading sits
in that sequence. **Do not build a mental model that depends on it.** If you find yourself reasoning
"the container must be up because the extension is listed first", you are one annotation reorder away
from a failure you will not diagnose.

What *is* documented, and is the thing to rely on instead, is that dynamic property values are lazy:

> *"Values are dynamic and provided via a `Supplier` which is only invoked when the property is
> resolved."*

A supplier that reads `postgres::getJdbcUrl` is therefore called during property resolution, not at
registration time — which is why `@DynamicPropertySource`
([04c](04c-dynamicpropertysource.md)) and `@ServiceConnection` ([04](04-serviceconnection.md)) work
without you knowing the interleaving. **Use them and let the ordering be somebody else's problem.**

## `disabledWithoutDocker` — a green build that ran nothing

```java
@Testcontainers(disabledWithoutDocker = true)
class OrderRepositoryTests { /* ... */ }
```

The extension implements `ExecutionCondition`, and the evaluation is four lines:

```java
private ConditionEvaluationResult evaluate(Testcontainers testcontainers) {
    if (testcontainers.disabledWithoutDocker()) {
        if (isDockerAvailable()) {
            return ConditionEvaluationResult.enabled("Docker is available");
        }
        return ConditionEvaluationResult.disabled("disabledWithoutDocker is true and Docker is not available");
    }
    return ConditionEvaluationResult.enabled("disabledWithoutDocker is false");
}
```

with availability decided by a probe that swallows everything:

```java
class DockerAvailableDetector {
    public boolean isDockerAvailable() {
        try {
            DockerClientFactory.instance().client();
            return true;
        } catch (Throwable ex) {
            return false;
        }
    }
}
```

🔴 **Read that `catch (Throwable)` carefully, because it is the whole hazard.** Anything at all that
prevents a Docker client being constructed — no daemon, a wrong `DOCKER_HOST`, a socket permission
problem, a rootless Podman misconfiguration, an expired credential helper — is indistinguishable from
"we are on a laptop with no Docker". With `disabledWithoutDocker = true` the class is **skipped**, the
build is **green**, and nothing in the exit code says your entire integration suite did not run.

**What has to be true for this to be safe.** All three, not one of them:

1. **Some job in the pipeline runs those tests without the flag**, and its failure blocks the merge.
   A skip that is never compensated anywhere is a deleted test with extra steps.
2. **The skip is visible.** JUnit records the reason string
   `"disabledWithoutDocker is true and Docker is not available"`; your CI report has to surface skip
   counts, and somebody has to look at them. A build summary that shows only failures hides this
   perfectly.
3. **The pipeline that is *supposed* to have Docker does not carry the flag.** The moment
   `disabledWithoutDocker = true` is on the class rather than on a profile, the guarantee is gone
   everywhere at once.

If you cannot commit to all three, the honest configuration is no flag at all: let the build fail
loudly on a machine without Docker. The operational side of that — what CI actually needs, and the
alternative runtimes — is [09 · The cost](09-the-cost.md) and
[09b · CI and alternative runtimes](09b-ci-and-alternative-runtimes.md).

## `@EnabledIfDockerAvailable` — the sibling the docs never mention

2.0.5 also ships a standalone condition that the JUnit 5 documentation page does not describe:

```java
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
@Documented
@ExtendWith(EnabledIfDockerAvailableCondition.class)
public @interface EnabledIfDockerAvailable {
}
```

It uses the same `DockerAvailableDetector` and returns `disabled("Docker is not available")`. Two
things distinguish it from the attribute:

- **It does not require `@Testcontainers`.** You can gate a test that uses Docker through some other
  route — a `docker compose` invocation, a client library — without registering the container
  extension at all.
- **It is the more honest annotation when skipping is what you mean.** `disabledWithoutDocker = true`
  reads as a Testcontainers setting; `@EnabledIfDockerAvailable` reads as "this test needs Docker",
  which is the actual claim.

⚠️ **One caution I could not resolve without running it.** The annotation's `@Target` includes
`METHOD`, but `EnabledIfDockerAvailableCondition.findAnnotation` searches only
`current.get().getRequiredTestClass()` while walking the extension-context parent chain — it never
inspects the test *method*. Reading the source, a method-level `@EnabledIfDockerAvailable` therefore
looks as though it would fail the lookup and throw
`ExtensionConfigurationException("@EnabledIfDockerAvailable not found")` rather than gate the method.
**I have not run it and the documentation does not cover it.** Put the annotation on the class until
someone has verified otherwise.

## Gotchas

**★ `disabledWithoutDocker = true` turns "the environment is broken" into "the build passed".**
The detector catches `Throwable`, so a wrong `DOCKER_HOST`, a socket permission error and a laptop
with no Docker are the same outcome: the class is silently skipped. Unless another pipeline runs the
same tests without the flag and blocks the merge on failure, you have deleted your integration suite
in a way that no red build will ever tell you about.

**★ A skipped class does not show up in a failure-only CI summary.**
JUnit records `"disabledWithoutDocker is true and Docker is not available"` as the skip reason, which
is genuinely helpful — if anything in your pipeline reports skip counts. Most build summaries do not.

**★ `@EnabledIfDockerAvailable` on a method may not work despite `@Target(METHOD)`.**
The condition's lookup walks the extension-context chain calling `getRequiredTestClass()` and never
looks at the method, so from the source it appears a method-level use would throw
`@EnabledIfDockerAvailable not found`. Unverified — I could not run it. Use it at class level.

**★ Reasoning about "which extension runs first" is a trap even though the ordering rule is documented.**
The rule is real — registration order determines callback order — but the input to it is the order of
two annotations on your test class, which nobody treats as load-bearing and every IDE will happily
reorder. Depend on lazy dynamic properties instead.

## Interview questions

**★ What does `@Testcontainers(disabledWithoutDocker = true)` actually do, and what does it cost you?**
It makes the extension's `ExecutionCondition` return `disabled` instead of letting the class fail when
a Docker client cannot be constructed. The probe catches `Throwable`, so a misconfigured
`DOCKER_HOST`, a permissions problem and a machine with no Docker all look identical. The cost is
that a build can report success having executed none of your integration tests. It is only safe if
another job runs the same tests without the flag and blocks on failure, and if your reporting makes
skip counts visible.

**★ Is there a better way to skip when Docker is missing?**
Often, yes: `@EnabledIfDockerAvailable`, which ships in 2.0.5 but is not on the JUnit 5 documentation
page. It uses the same `DockerAvailableDetector`, does not require `@Testcontainers` at all, and
reads as what it is — "this test needs Docker" — rather than as a Testcontainers setting. Keep it at
class level; the condition only searches test classes even though the annotation targets methods too.

**★ Is the container guaranteed to be started before Spring loads the application context?**
The documentation does not say, and you should not build on it. What *is* documented is that JUnit
runs `BeforeAllCallback` extensions before user `@BeforeAll` code, and that extensions wrap each
other in the order they are registered — which for `@Testcontainers` and `@SpringBootTest` is the
order two annotations appear on your class. The reliable route is to avoid needing the answer:
`@ServiceConnection` and `@DynamicPropertySource` both resolve values through a `Supplier` that
Spring's reference says is *"only invoked when the property is resolved"*, so the container is read
at context-refresh time rather than at registration time.
**★ Where does container startup happen relative to `@BeforeAll` and `@BeforeEach`?**
Before both. JUnit's documented sixteen-step order lists `BeforeAllCallback` as step 1 and
`@BeforeAll` as step 2, and `BeforeEachCallback` as step 5 with `@BeforeEach` as step 6. The
extension implements both callbacks, so a `static` container is up before your `@BeforeAll` and an
instance container is up before your `@BeforeEach`. The corollary is that you cannot *create* the
container in `@BeforeAll` — the extension has already read the field and found `null`.

**★ Two extensions both implement `BeforeAllCallback`. Which runs first?**
Whichever was registered first, and registration order is source order:
*"Extensions registered declaratively via `@ExtendWith` … will be executed in the order in which they
are declared in the source code."* JUnit then guarantees wrapping — the first-registered extension's
"before" callbacks run first and its "after" callbacks run last. With `@Testcontainers` and
`@SpringBootTest` that means the order of two annotations on your class, which is a fragile thing to
depend on.

{/* FOOTER */}
