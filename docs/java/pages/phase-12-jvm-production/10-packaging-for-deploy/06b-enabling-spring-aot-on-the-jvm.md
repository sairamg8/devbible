---
title: "Enabling Spring AOT on the JVM takes a Maven profile called native that has nothing to do with native images and a system property that must match it, and neither half warns you if the other is missing — so the only safe adoption asserts on the documented start-up line"
sidebar_label: "06b · Enabling Spring AOT"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference**, "Packaging → Ahead-of-Time Processing
> With the JVM" ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot.html))
> and "Packaging → AOT Cache"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot-cache.html)); and the
> **Spring Framework reference**, "Core Technologies → Ahead of Time Optimizations"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/aot.html)). Documented at
> Spring Boot 4.1.x / Spring Framework 7.0.x. 🔴 **No sandbox** — the one log fragment below is
> **quoted from the Spring Boot reference**; nothing here was built or run. JDK 25 · Spring Boot
> 4.1.0 / Spring Framework 7.0.9.

**[06](06-spring-boot-aot-processing.md) explained what the AOT engine generates. This chunk is the
two-line operation of switching it on for a JVM deployment, why those two lines are dangerous
independently of each other, and how Spring's AOT processing layers with the JVM's AOT cache rather
than competing with it.**

## The two halves

**Build with the code generated.** For Maven:

```bash
mvn -Pnative package
```

> *"For Maven, this means that you should build with `-Pnative` to activate the `native` profile"*

> *"For Gradle, you need to ensure that your build includes the `org.springframework.boot.aot`
> plugin."*

Underneath, the profile is running a plugin goal. The Spring Boot Maven plugin documentation names
it and, importantly, lists everything else the profile turns on:

> *"To configure your application to use this feature, add an execution for the `process-aot` goal"*

> *"If you use `spring-boot-starter-parent` as the `parent` of your project, a `native` profile can
> be used to streamline the steps required to build a native image. The `native` profile configures
> the following: Execution of `process-aot` when the Spring Boot Maven Plugin is applied on a
> project. Suitable settings so that `build-image` generates a native image."*

🔴 **Read the second bullet.** `-Pnative` does not only enable AOT processing — it also reconfigures
`build-image` to produce a **native image**. If your pipeline runs `spring-boot:build-image`
([07](07-buildpacks.md)), adding `-Pnative` for the JVM benefit silently changes
what that goal builds. Configure the `process-aot` execution directly if you want AOT processing
without the rest of the profile.

🔴 **Yes, the Maven profile is called `native` even when you are not building a native image.** It is
the profile that turns on AOT processing, and the name is a historical artefact of the engine having
arrived for GraalVM first. Expect a reviewer to challenge the line in your `Dockerfile` or CI
config; the answer is that this is what the reference documents.

**Run with the property set.**

```bash
java -Dspring.aot.enabled=true -jar myapplication.jar
```

> *"When the JAR has been built, run it with `spring.aot.enabled` system property set to `true`."*

## The failure mode: two silent halves

⚠️ **Neither half warns you about the other.**

- Generated code that is never activated is dead weight in your jar. The build takes longer, the
  artefact is larger, and the application starts exactly as it did before.
- The property set on a jar built *without* `-Pnative` has nothing to activate. The application
  starts exactly as it did before.

Both mistakes produce a working application with no improvement and no diagnostic. This is the same
class of silent no-op as the AOT cache used against an un-extracted jar
([05c](05c-the-training-run.md)), and it deserves the same treatment: an automated assertion.

The reference gives you the string to assert on:

> *"`........ Starting AOT-processed MyApplication ...`"*

🔴 **Grep the start-up log for `AOT-processed` in CI.** Start the built image, assert the substring
appears, fail the build otherwise. One container start per build, and it is the difference between
an optimisation and a superstition.

⚠️ Note the shape of the check: the two silent no-ops in this topic — Spring AOT and the AOT cache —
have *different* log evidence. `AOT-processed` proves Spring's generated context initializer ran;
`-Xlog:aot` ([05e](05e-aot-modes-and-diagnosis.md)) proves the JVM loaded a cache. **Asserting on
one tells you nothing about the other.**

## Where this sits relative to everything else

| Mechanism | When the work happens | What it removes |
|---|---|---|
| **Spring AOT processing** | Build time | The *discovery* work: scanning, `@Configuration` parsing, condition evaluation, proxy generation |
| **AOT cache** ([05d](05d-the-aot-cache.md)) | Build-time training run | Class loading and linking, plus heap objects and (JDK 25) method profiles |
| **CDS** ([05](05-class-data-sharing.md)) | Build-time training run | Class parsing only. Superseded on JDK 25 |
| **GraalVM native image** (topic 11) | Build time | All of the above, plus the JVM itself — for a closed-world assumption |

Spring Boot states the composition explicitly:

> *"AOT cache and Spring's AOT can be combined to further improve startup time."*

🔴 **These are layers, not alternatives.** They act on different work: one removes the decisions, the
other caches the class loading. A production image can reasonably do both.

## The combined recipe, in order

The ordering matters, because the AOT cache must be trained on the application you are actually
going to ship:

```dockerfile
FROM bellsoft/liberica-openjre-debian:25-cds AS builder
WORKDIR /builder
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} application.jar

# 1. Extract — required for the cache to have any effect at all
RUN java -Djarmode=tools -jar application.jar extract --layers --destination extracted

# 2. Train the AOT cache against the AOT-PROCESSED application
WORKDIR /builder/extracted/application
RUN java -XX:AOTCacheOutput=app.aot \
         -Dspring.aot.enabled=true \
         -Dspring.context.exit=onRefresh \
         -jar application.jar
```

Three things about that sequence:

1. **The jar was built with `-Pnative`.** Nothing in the Dockerfile can generate the AOT sources;
   that happened in the Maven build that produced `${JAR_FILE}`.
2. **`-Dspring.aot.enabled=true` is on the *training* run.** Without it, you train the cache against
   the non-AOT start-up path, and the production run — which *does* set the property — takes a
   different path through different classes. The cache is then a recording of the wrong application.
3. **`-Dspring.context.exit=onRefresh` still does the same job.** The cache is written at the end of
   the training run, so the process must end.

And the runtime side must set the property too:

```dockerfile
ENTRYPOINT ["java", "-XX:AOTCache=app.aot", "-Dspring.aot.enabled=true", "-jar", "application.jar"]
```

⚠️ **If the two command lines disagree about `spring.aot.enabled`, you have quietly built a cache
for an application you are not running.** It will still load — the classpath, JDK and architecture
all match — and it will simply contain the wrong classes.

## An honest note on scope

Spring Framework's own reference still says:

> *"At the moment, AOT is focused on allowing Spring applications to be deployed as native images
> using GraalVM. We intend to support more JVM-based use cases in future generations."*

while Spring Boot's packaging reference documents the JVM path above and opens with *"It's beneficial
for the startup time to run your application using the AOT generated initialization code."*

These are not contradictory — the framework is describing where the investment is aimed, Boot is
documenting a supported way to use it today. But **adopt the JVM path knowing that GraalVM drives its
roadmap**, and that the restrictions in [06c](06c-what-aot-processing-gives-up.md) exist because they
are native image's restrictions, not because a JVM deployment needs them.

## Gotchas

**★ The Maven profile is called `native` for a JVM deployment.** `mvn -Pnative package` is what the
reference documents. The name is misleading; the flag is correct. Put a comment next to it.

**★ Both halves are required and neither complains.** `-Pnative` generates the code,
`-Dspring.aot.enabled=true` uses it. One without the other is a working application with no
improvement and no warning.

**★ Assert on `AOT-processed` in the start-up log.** *"`........ Starting AOT-processed
MyApplication ...`"* is the documented evidence. It is a CI check, not a production flag, and it
costs one container start.

**★ The AOT-cache check and the Spring-AOT check are different checks.** `-Xlog:aot` proves the JVM
loaded a cache; `AOT-processed` proves Spring's generated initializer ran. Passing one says nothing
about the other, and it is entirely possible to have exactly one of the two working.

**★ Train the AOT cache with `spring.aot.enabled=true` if you will run with it.** Otherwise the cache
records the classes of the non-AOT start-up path, loads happily in production, and accelerates code
you are not executing.

**★ The generated sources come from the Maven or Gradle build, not from the Dockerfile.** A
multi-stage build that compiles inside the image must pass `-Pnative` there; a build that copies a
pre-built jar in inherits whatever the CI build decided. Check which shape you have.

**★ `spring.aot.enabled` is a system property, so it can be set from `JAVA_TOOL_OPTIONS` too.** That
makes it something a platform layer can turn on for an image that was never built for it — producing
an application that tries to use generated code that does not exist. Prefer setting it explicitly in
the `ENTRYPOINT`.

**★ `-Pnative` also reconfigures `build-image` to produce a native image.** Documented in the Maven
plugin reference. If your pipeline builds images with the plugin rather than a Dockerfile, the
profile changes the output artefact type. Add the `process-aot` execution explicitly instead.

**★ AOT processing lengthens the build.** Your build now starts an `ApplicationContext` to the point
of bean definitions and writes source for every one of them. On a large application this is not
free, and it happens on every build.

**★ Spring's roadmap statement points at GraalVM, not the JVM.** *"At the moment, AOT is focused on
allowing Spring applications to be deployed as native images using GraalVM."* The JVM path is
documented and supported; it is not the primary target. Weigh that before building process around
it.

**★ Adopting this changes what your artefact *is*.** After `-Pnative`, the jar contains generated
bean definitions matching one evaluation of your conditions. That is the subject of
[06c](06c-what-aot-processing-gives-up.md), and it is the reason this is a deployment decision rather
than a build tweak.

## Interview questions

**★ How do you enable Spring AOT processing for a JVM deployment?**
Two steps. Build with the AOT sources generated — `mvn -Pnative package`, or the
`org.springframework.boot.aot` plugin for Gradle. Then run with `-Dspring.aot.enabled=true`. The
profile name is `native` even though no native image is involved; that is what the reference
documents.

**★ How do you know at runtime that AOT-processed code is actually being used?**
The documented start-up line: `........ Starting AOT-processed MyApplication ...`. Assert on the
`AOT-processed` substring in CI, because the build half and the runtime half are independently
omittable and neither produces a warning when the other is missing.

**★ Your team wants both the AOT cache and Spring AOT processing. Is that reasonable, and what is the
ordering?**
Yes — Spring Boot says they *"can be combined to further improve startup time."* The ordering is:
build the jar with `-Pnative`, extract it, run the training run with **both**
`-Dspring.aot.enabled=true` and `-XX:AOTCacheOutput`, and run production with both
`-XX:AOTCache` and `-Dspring.aot.enabled=true`. The training run must set the property, or the cache
records the classes of a start-up path you will not take.

**★ What goes wrong if the training run and the production run disagree about
`spring.aot.enabled`?**
The cache still loads — the classpath, JDK release and architecture all match — but it contains
classes and heap objects from the wrong start-up path. Nothing fails; you simply lose most of the
benefit while everything reports success. It is the most subtle version of this topic's recurring
failure shape.

**★ Is Spring AOT processing only for native images?**
No. Spring Boot documents the JVM path and calls it *"beneficial for the startup time"*. But it is
honest to add that Spring Framework's reference still describes AOT as *"focused on allowing Spring
applications to be deployed as native images using GraalVM"* — so the JVM use case is supported,
while GraalVM drives the roadmap and is the reason the restrictions exist.

**★ Why should `spring.aot.enabled` be in the `ENTRYPOINT` rather than in an environment variable?**
Because as a system property it can also arrive via `JAVA_TOOL_OPTIONS` or `JDK_JAVA_OPTIONS`, which
means a platform layer can enable it for an image that was never built with `-Pnative`. Setting it
explicitly alongside the flags it must agree with keeps the build and the runtime in one place a
reviewer can read.

{/* FOOTER */}
