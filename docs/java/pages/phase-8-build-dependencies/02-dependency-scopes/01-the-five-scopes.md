---
title: "The five classpath scopes"
sidebar_label: "1 · The five scopes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Maven guide *Introduction to the Dependency
> Mechanism* (maven.apache.org — the scope definitions and the `system` scope
> warning), the maven-war-plugin FAQ, and the Spring Boot Maven plugin
> *Packaging Executable Archives* documentation (`includeSystemScope`).
> Maven 3.9.16, JDK 25 target.

**Six words are legal in `<scope>`, but only five of them put a jar on a
classpath. Each one is shorthand for four independent answers — compile
classpath, test classpath, runtime classpath, and whether the dependency
propagates to consumers — and the default, `compile`, answers "yes" to all
four. Every scope other than `compile` is you narrowing one of those answers
on purpose.**

## The six scopes, as four answers

| Scope | Compile CP | Test CP | Runtime CP | In the packaged artifact | Transitive to consumers |
|---|---|---|---|---|---|
| `compile` (default) | ✅ | ✅ | ✅ | ✅ | ✅ — as `compile` |
| `provided` | ✅ | ✅ | ❌ | ❌ (war/jar) — ⚠️ **yes** in a Boot fat jar | ❌ |
| `runtime` | ❌ | ✅ | ✅ | ✅ | ✅ — as `runtime` |
| `test` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `system` | ✅ | ✅ | ✅ (your JVM's, not packaged) | ❌ | ❌ in practice |
| `import` | — | — | — | — | — |

`import` is the odd one out and it is not a classpath scope at all: it is only
legal on a `<dependency>` of `<type>pom</type>` **inside
`<dependencyManagement>`**, where it means *splice this POM's
`dependencyManagement` in here*. It contributes no jar to anything. That is the
BOM mechanism, and it belongs to
[topic 03](../03-transitive-and-mediation/README.md).

The ⚠️ in the `provided` row is the surprise of the whole topic and is worked
through in [chunk 2](02-transitivity-and-what-ships.md).

## `compile` — the default, and the one to justify

Write no `<scope>` and you get `compile`: on every classpath, in the artifact,
and propagated to everyone downstream. It is the right answer for anything
whose types appear in your own `src/main/java`. It is the wrong answer by
default for everything else, and "I didn't think about it" is how most bad
classpaths get built — because the widest possible answer is what you get for
free.

For a published library, every `compile` dependency is a constraint you impose
on strangers who never chose it, and you cannot take it back without a breaking
change.

## `provided` — you promise something else supplies it

```xml
<dependency>
  <groupId>jakarta.servlet</groupId>
  <artifactId>jakarta.servlet-api</artifactId>
  <version>6.1.0</version>
  <scope>provided</scope>
</dependency>
```

Compile against it, test against it, **do not ship it**. The classic case is a
container API — servlet, JSP, a JCA connector, a driver the app server manages
— where the container has its own copy and a second one in `WEB-INF/lib`
produces one class defined twice by two different loaders. Lombok is the other
common one: a compile-time annotation processor with nothing to contribute at
runtime.

The word *provided* is a claim about the deployment environment, and **nothing
verifies it**. Deploy that war into a container without a servlet API, or run
it with `java -jar`, and you get `NoClassDefFoundError` on the first request.
The build was green; the promise was false. That is the trade: you have
converted a build-time guarantee into an environment assumption, and you only
find out in the environment.

⚠️ **The war plugin's FAQ recommends `provided` as the way to keep a transitive
subtree out of the war.** It works — nothing `provided` is ever transitive or
packaged — but it is a lie about intent. Six months later nobody can tell "the
container supplies this" from "we used scope as an exclusion". Prefer a real
`<exclusion>` (topic 03) and keep `provided` meaning what it says.

## `runtime` — needed to run, not to compile

The archetype is a JDBC driver:

```xml
<dependency>
  <groupId>org.postgresql</groupId>
  <artifactId>postgresql</artifactId>
  <version>42.7.4</version>
  <scope>runtime</scope>
</dependency>
```

This is a *design* control, not a size optimisation. With `runtime`, nobody on
the team can `import org.postgresql.*` — it is not on the compile classpath, so
the attempt fails at build time rather than in code review. Your code compiles
against `java.sql` only, and swapping to H2 for tests becomes a dependency
change instead of a refactor. Since JDBC 4.0 the driver registers itself
through `ServiceLoader`, so no `Class.forName` call is needed to wire it up.

The same shape covers SLF4J bindings — `slf4j-api` at `compile` because you
call it, `logback-classic` at `runtime` because you must never call it — and
any implementation of an API you own.

## `test` — the whole point of scopes

```xml
<dependency>
  <groupId>org.junit.jupiter</groupId>
  <artifactId>junit-jupiter</artifactId>
  <version>5.11.3</version>
  <scope>test</scope>
</dependency>
```

Visible to `src/test/java` only, not packaged, not transitive. **This is the
leak that matters.** Forget the scope and JUnit sits on the compile classpath,
which means three things at once:

1. Someone writes `assertNotNull(...)` or a Mockito stub in `src/main/java` and
   it compiles. That code now ships to production.
2. Because `compile` *is* transitive, every downstream consumer inherits JUnit,
   Mockito, Byte Buddy, Objenesis and Hamcrest — and one of those will collide
   with a version they chose deliberately.
3. Your artifact grows by megabytes of test infrastructure that a scanner will
   later report CVEs against, in code nothing can reach.

The failure is silent in both directions: nothing warns you on the way in, and
by the time a consumer files the bug, fixing it is a breaking change for
anyone who started compiling against the leaked types.

The same discipline extends to test-only *non*-test libraries: Commons IO used
to build a fixture, Testcontainers, WireMock, AssertJ. If it is only touched
from `src/test/java`, it is `test`.

## `system` — the one to delete

`system` is `provided` plus an absolute file path: `<systemPath>` names a jar on
the local disk, and Maven never downloads or resolves it. The Maven guide is
unambiguous — *"While the `system` scope is supported, its usage is **not
recommended**"* — because it binds the build to one machine's filesystem. CI
does not have that path. The new laptop does not have that path. The jar is in
no repository, so nothing can checksum, audit or CVE-scan it, and dependency
mediation cannot see it at all.

The documented replacement is to publish the jar to an internal repository
(Nexus, Artifactory) under real GAV coordinates and depend on it normally. If
that is genuinely impossible, a repository-shaped directory committed to the
repo and declared as a `<repository>` is still better, because at least
resolution treats it as a real artifact.

Spring Boot's repackager will not even place a `system`-scoped jar in your fat
jar unless you set `includeSystemScope` to `true` — a good signal for how the
ecosystem regards it.

## Gotchas

**Symptom:** consumers of your library report `NoSuchMethodError` inside Mockito, in an application that does not use Mockito
**Cause:** the library declared Mockito without `<scope>test</scope>`; `compile` is transitive, so Mockito and its Byte Buddy dependency were pushed onto every consumer and collided with a version they had chosen deliberately
**Fix:** add `<scope>test</scope>`, and treat it as a breaking change in the release notes — consumers may already be compiling against the leaked types

**Symptom:** production code compiles fine calling `assertThat(...)`, then fails to load in production with `NoClassDefFoundError: org/assertj/core/api/Assertions`
**Cause:** AssertJ was on the compile classpath but is absent at runtime — it was `provided`, or the deployment strips it. Compilation only ever proves the class was on the *compile* classpath
**Fix:** scope test libraries `test` so `src/main/java` cannot see them at all; the compiler becomes the guard instead of code review

**Symptom:** a war deploys to Tomcat in staging and throws `NoClassDefFoundError: jakarta/servlet/http/HttpServlet` on the first request in production
**Cause:** the servlet API is `provided`, and the production runtime is a bare JVM or a container without it. `provided` is an unverified promise about the deployment environment
**Fix:** match packaging to deployment — a Boot fat jar for `java -jar`, a war plus a real container for `provided` — and assert it once in CI by starting the built artifact, not by reading the POM

**Symptom:** the same servlet API is `provided`, deployed into a container that *does* have it, and now you get `LinkageError` or a `ClassCastException` between two identical-looking types
**Cause:** somebody "fixed" the previous gotcha by widening the scope to `compile`, so `WEB-INF/lib` gained a second copy and the container's loader and the webapp's loader each defined the class
**Fix:** revert to `provided`. Two copies of an API class in two loaders are two different types — see [Classloaders and the two errors](../../phase-0-platform-jvm/05-packages-classpath/03-classloaders-and-the-two-errors.md)

**Symptom:** CI fails with a resolution error naming a path like `/home/dave/libs/vendor-sdk.jar`
**Cause:** a `system`-scoped dependency whose `<systemPath>` points at one developer's machine; Maven never downloads it, it simply expects the file to exist
**Fix:** publish the jar to the internal repository under real coordinates and depend on it normally. This is exactly the failure the guide's "not recommended" refers to

## Interview questions

**★ Name the six scopes and say what `provided` actually means.**
`compile`, `provided`, `runtime`, `test`, `system`, `import`. Only the first
five are classpath scopes — `import` is legal solely on a `pom`-type dependency
inside `<dependencyManagement>` and splices that POM's managed versions in.
`provided` means: on the compile and test classpaths, off the runtime
classpath, not packaged, not propagated — because you are asserting that the
JDK or the container supplies it at runtime. Nothing checks that assertion,
which is why a mismatched deployment surfaces as `NoClassDefFoundError` rather
than a build failure.

**★ Why scope a JDBC driver `runtime` when `compile` would behave identically at runtime?**
Because `runtime` turns the API boundary into a compile error instead of a
convention. Nobody can `import org.postgresql.*` from `src/main/java` — the
classes are not on the compile classpath — so production code compiles against
`java.sql` only and the driver is genuinely swappable. It also keeps the driver
out of the transitive *compile* surface you impose on consumers. The cost is
that bytecode-based tooling calls it unused, because `ServiceLoader` discovery
is invisible to it.

**★ You inherit a POM where JUnit has no `<scope>`. What is actually broken, and is fixing it a breaking change?**
Three things are broken: production code can compile against test APIs and
therefore may already do so; the whole JUnit/Mockito transitive graph is being
pushed onto every consumer at `compile` scope; and all of it is being packaged,
so CVE scanners will report on unreachable code. Adding `<scope>test</scope>`
is a **breaking change for consumers** who started relying on the leaked
transitive jars, so it goes in the release notes rather than a patch release
you say nothing about.

**★ `provided` versus simply not declaring the dependency at all — what does `provided` buy?**
Compile-time and test-time visibility. Not declaring it means you cannot
compile against the API; `provided` means you compile and test against exactly
the API the container will supply, then ship nothing. The whole value is that
the compiler checks you against the real interface while the runtime keeps a
single copy of it — which is the only way to avoid the two-loaders-two-types
problem in a container deployment.

**★ Why is `system` documented as "not recommended", and what replaces it?**
Because `<systemPath>` is an absolute path on one machine. The artifact is
never downloaded, never resolved, never checksummed, invisible to dependency
mediation and invisible to any scanner — so the build works on the laptop that
created it and nowhere else. The replacement is to publish the jar to an
internal repository (Nexus, Artifactory) under real GAV coordinates and depend
on it like anything else; a committed repository-shaped directory declared as a
`<repository>` is the acceptable fallback.

---

← Prev: [Dependency scopes](README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Transitivity, `optional`, and what actually ships](02-transitivity-and-what-ships.md)
