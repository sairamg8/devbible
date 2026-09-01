---
title: "A production-shaped image, item by item — every line justified by a chunk of this topic, every silent failure mode paired with the CI assertion that catches it, and an explicit list of the decisions that cannot be made from a checklist"
sidebar_label: "10 · The checklist"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 — every item below is argued and sourced in the chunk it links to; the
> primary documents are the **Spring Boot reference** packaging pages
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html)), the
> **JDK 25 `java`, `jlink` and `jdeps` tool references**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)), the
> **Kubernetes API reference** ([kubernetes.io](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/pod-v1/)),
> and **JEPs 220, 386, 483, 514 and 515** ([openjdk.org](https://openjdk.org/jeps/483)).
> 🔴 **No sandbox** — nothing on this page was built, run or measured. JDK 25 · Spring Boot 4.1.0 /
> Spring Framework 7.0.8.

**A checklist is only useful if every item names the failure it prevents. This one does, and it ends
with the decisions a checklist cannot make for you — because the recurring theme of this topic is
that the dangerous failures here are silent, and a list of ticks is exactly the instrument that
misses them.**

## The reference Dockerfile

Every line below is argued elsewhere in the topic; this is the assembly.

```dockerfile
# ---------- build stage ----------
FROM bellsoft/liberica-openjdk-debian:25 AS builder
WORKDIR /builder

ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} application.jar

# Extract: required for the AOT cache to have any effect, and the basis of layering
RUN java -Djarmode=tools -jar application.jar extract --layers --destination extracted

# Train the AOT cache against the application you will actually ship
WORKDIR /builder/extracted/application
RUN java -XX:AOTCacheOutput=app.aot \
         -Dspring.aot.enabled=true \
         -Dspring.context.exit=onRefresh \
         -jar application.jar

# ---------- runtime stage ----------
FROM gcr.io/distroless/java25-debian13:nonroot
WORKDIR /application

COPY --from=builder /builder/extracted/dependencies/          ./
COPY --from=builder /builder/extracted/spring-boot-loader/    ./
COPY --from=builder /builder/extracted/snapshot-dependencies/ ./
COPY --from=builder /builder/extracted/application/           ./
COPY --from=builder /builder/extracted/application/app.aot    ./app.aot

ENTRYPOINT ["java", \
  "-XX:AOTCache=app.aot", \
  "-Xlog:aot", \
  "-Dspring.aot.enabled=true", \
  "-XX:MaxRAMPercentage=75", \
  "-XX:+HeapDumpOnOutOfMemoryError", \
  "-XX:HeapDumpPath=/dumps/java_pid%p.hprof", \
  "-XX:ErrorFile=/dumps/hs_err_pid%p.log", \
  "-jar", "application.jar"]
```

⚠️ **The `ENTRYPOINT` overrides distroless' built-in `["/usr/bin/java", "-jar"]`**, which is
mandatory the moment you need a single JVM flag ([03d](03d-distroless.md)). The alternative is
`JDK_JAVA_OPTIONS`, which is less visible.

⚠️ **This is a shape, not a prescription.** A distroless base with no `jcmd`, a JDK 25 AOT cache and
Spring AOT processing are three independent decisions, each of which has a chunk arguing both sides.
Copying this file without making those decisions is precisely the mistake the last section is about.

## The build

- [ ] **The jar is extracted before anything else touches it** — `-Djarmode=tools … extract`, not
      `layertools`. Running the uber jar in production pays a nested-jar cost the Boot reference calls
      *"a small startup cost"*, and it makes every cache a silent no-op.
      → [01](01-the-fat-jar.md), [02b](02b-extracting-layers-and-the-image-cache.md)
- [ ] **`COPY` order follows `layers.idx` order** — dependencies, loader, snapshot dependencies,
      application. The index is prescriptive; the order is the cache-hit rate.
      → [02](02-layered-jars.md), [02c](02c-a-real-layered-dockerfile.md)
- [ ] **The training run happens in the image build**, after the jar is copied in, so the cache
      cannot go stale without a rebuild. → [05c](05c-the-training-run.md)
- [ ] **The training run and the production run agree on every flag that changes the start-up
      path** — most importantly `spring.aot.enabled`. → [06b](06b-enabling-spring-aot-on-the-jvm.md)
- [ ] **No secret enters a layer or a build argument.** Build arguments are *"visible in the
      `docker history` command"* and in provenance attestations. Use `RUN --mount=type=secret`.
      → [08](08-configuration-at-deploy-time.md)
- [ ] **The base image is pinned**, including the buildpack `builder` if you use one — its default is
      a `:latest` tag. → [07](07-buildpacks.md)
- [ ] **The training run is regenerated every build**, never restored from a CI cache. Its bindings
      are classpath, JDK release and OS/CPU; no ordinary cache key covers all three.
      → [05f](05f-when-the-cache-helps.md)

## The runtime image

- [ ] **You can say what the base image contains** — `java --list-modules`, `ls "$JAVA_HOME/bin"`,
      `cat "$JAVA_HOME/release"`. A `jre` tag has no specification behind it.
      → [03](03-base-images.md), [03b](03b-alpine-and-musl.md)
- [ ] **The diagnostic decision is explicit.** Either the tools are in the image, or there is a
      rehearsed ephemeral-container procedure, or there is an out-of-process diagnostic path (JFR to a
      volume, dumps to a mount, metrics and traces). Not "we'll work it out".
      → [03](03-base-images.md)
- [ ] **If Alpine: you accepted a libc change** and ran the full integration suite on it.
      → [03b](03b-alpine-and-musl.md), [03c](03c-musl-runtime-differences.md)
- [ ] **If `jlink`: someone owns rebuilding on JDK security releases.** *"Developers are responsible
      for updating their custom runtime images."* → [04](04-jlink.md)
- [ ] **If `jlink`: the module set was validated by running the integration suite on the linked
      runtime**, not by `jdeps` alone. → [04b](04b-jdeps-and-the-module-set.md)
- [ ] **A numeric `USER`**, so `runAsNonRoot`'s UID-0 check has something to validate.
      → [03e](03e-non-root-and-filesystem.md)
- [ ] **`ENTRYPOINT` is in vector form.** Shell form puts a shell at PID 1 which does not forward
      `SIGTERM`; on distroless it simply fails. → [03d](03d-distroless.md)

## The deployment

- [ ] **`readOnlyRootFilesystem: true`, with a writable `/tmp` mount** — needed by the JFR
      repository, `java.io.tmpdir`, `hsperfdata`, and Temurin's CA-truststore entrypoint script.
      → [03e](03e-non-root-and-filesystem.md)
- [ ] **A separate, sized dumps volume**, with `-XX:HeapDumpPath` and `-XX:ErrorFile` pointing at it
      and `%p` in both filenames. The heap dump has **no documented fallback** when its directory is
      unwritable. → [03e](03e-non-root-and-filesystem.md)
- [ ] **`fsGroup` set**, or a mounted volume is not writable by your UID.
      → [03e](03e-non-root-and-filesystem.md)
- [ ] **`runAsNonRoot`, `runAsUser`, `allowPrivilegeEscalation: false`** — three settings, three
      different jobs. → [03e](03e-non-root-and-filesystem.md)
- [ ] **Heap sizing is owned by exactly one mechanism** — `-XX:MaxRAMPercentage`, or a buildpack's
      memory calculator, never both. → topic 03, [07b](07b-what-paketo-decides.md)
- [ ] **Secrets arrive as a mounted config tree**, not environment variables.
      `spring.config.import=optional:configtree:/etc/config/`. → [08](08-configuration-at-deploy-time.md)
- [ ] **Pod-spec write access is treated as configuration write access**, because relaxed binding
      makes every Spring property reachable from an environment variable.
      → [08](08-configuration-at-deploy-time.md)

## 🔴 The CI assertions — the most important section

Every optimisation in this topic fails **silently**. These are the checks that convert silence into a
red build, and a pipeline without them is running on faith.

- [ ] **The AOT cache loads.** Start the built image with `-Xlog:aot` and assert. The tool reference
      recommends `-XX:AOTMode=auto -Xlog:aot` precisely for this. Never `-XX:AOTMode=on` in
      production. → [05e](05e-aot-modes-and-diagnosis.md)
- [ ] **If using CDS instead: an application class loads from the archive.** `-Xlog:class+load`, and
      grep for `source: shared objects file` against an *application* class — matching a `java.lang`
      class only proves the default archive exists. → [05c](05c-the-training-run.md)
- [ ] **Spring AOT is active.** Grep the start-up log for the documented `AOT-processed`. This is a
      *different* assertion from the cache one and passing either says nothing about the other.
      → [06b](06b-enabling-spring-aot-on-the-jvm.md)
- [ ] **The image runs as the expected UID** and the entrypoint is the one you wrote.
- [ ] **The application starts with the read-only filesystem and the mounts it will have in
      production**, not with a permissive local configuration.
- [ ] **If `jlink` or a trimmed module set: the integration suite runs against the shipped runtime.**
      → [04b](04b-jdeps-and-the-module-set.md)
- [ ] **If Spring AOT: the tests run against the AOT-processed artefact.** Conditions were evaluated
      at build time, so it is a different application. → [06c](06c-what-aot-processing-gives-up.md)
- [ ] **A start-up measurement is recorded per build** in a container with production's CPU and
      memory limits, so a regression is visible before a customer finds it.
      → [09](09-image-size-and-startup.md)

## The decisions a checklist cannot make

Five questions with no default answer. If your team has not answered them, the ticks above are
decoration.

1. **What are you optimising — stored size, transfer size, or start-up?** They have almost no levers
   in common, and the argument cannot converge until someone says which.
   → [09](09-image-size-and-startup.md)
2. **What happens at 03:00?** Whether the image contains `jcmd` is downstream of this, not upstream.
   → [03](03-base-images.md)
3. **Who owns the runtime's security patching?** A published base image is patched by its publisher.
   A `jlink`ed runtime is patched by you. → [04](04-jlink.md)
4. **One artefact for all environments, or one per profile?** Spring AOT processing forces this
   question, and the good answer — express environment differences as configuration values, not bean
   presence — is a refactor, not a flag. → [06c](06c-what-aot-processing-gives-up.md)
5. **Dockerfile or buildpack?** Equivalently: should these decisions be visible in a reviewed file,
   or delegated to a builder image? Both answers are defensible; only one of them is usually made
   deliberately. → [07](07-buildpacks.md), [07b](07b-what-paketo-decides.md)

## Gotchas

**★ A checklist cannot detect a silent no-op.** Every item in the CI section exists because the
corresponding failure produces a working application with no warning. Ticking "we use the AOT cache"
is not evidence that it loads.

**★ Copying the reference Dockerfile without the decisions is the failure this topic warns about.**
It embeds a distroless base with no diagnostic tools, an AOT cache, Spring AOT processing and a
read-only-friendly dump path. Each is a decision with a chunk arguing both sides.

**★ `-Xlog:aot` and `AOT-processed` are different assertions.** One is the JVM's cache, the other is
Spring's generated code. Teams commonly implement one and believe they have covered both.

**★ Heap sizing has exactly one owner.** `-XX:MaxRAMPercentage` in your entrypoint *and* a
buildpack memory calculator is a configuration nobody can reason about afterwards.

**★ A dumps volume with no `sizeLimit` can get the pod evicted mid-incident.** The dump is the size
of the live heap, and node ephemeral storage is finite.

**★ The training run must use the production start-up path.** Different `spring.aot.enabled`, a
different profile, a different set of active conditions — any of these trains a cache for an
application you do not run, and it will still load.

**★ "It builds" proves nothing about a trimmed runtime.** A `jlink`ed image with a missing module
links, starts and fails on the request that touches a reflective dependency. Only the integration
suite on the shipped runtime is evidence.

**★ Pinning is not just the base image.** A buildpack `builder` defaults to a floating `:latest` tag,
which is the same exposure through a different door.

**★ Every optimisation here has a bill.** Build time, image bytes, a libc change, a closed-world
assumption, a runtime you now patch yourself. Adopting one without naming its bill is how a team
ends up with all of them and no measurement.

**★ Re-run this checklist after a dependency upgrade, not only at design time.** A new library can
introduce a reflective path into a trimmed module, a new `@ConditionalOnProperty` into an AOT build,
or a native dependency into an Alpine image.

## Interview questions

**★ Walk me through the Dockerfile you would write for a Spring Boot service on JDK 25.**
Multi-stage. Builder: copy the jar, `java -Djarmode=tools -jar app.jar extract --layers`, then a
training run with `-XX:AOTCacheOutput` and `-Dspring.context.exit=onRefresh` in the extracted
directory. Runtime: a deliberately chosen base, four `COPY` lines in `layers.idx` order, a numeric
`USER`, and a vector-form `ENTRYPOINT` carrying `-XX:AOTCache`, container-aware heap sizing and dump
paths pointing at a mounted volume. Then the part most answers omit: the CI assertions that prove the
cache loads and the AOT code is active.

**★ Which single item on this checklist would you keep if you could keep only one?**
The extraction step, because three other things depend on it: the layering that makes deploys fast,
the start-up cost the Boot reference attributes to nested jars, and the AOT cache — which Spring Boot
documents as having *"no effect"* unless used with the extracted form. It is one line and it unlocks
everything else.

**★ Why is the CI section the most important part of this checklist?**
Because every optimisation here fails silently. A misconfigured AOT cache, an inactive Spring AOT
build, an archive used against an uber jar, a `jlink`ed runtime missing a reflective dependency — all
of them produce a working application. Without assertions, the only signal is the absence of an
improvement nobody is measuring.

**★ A team hands you an image and says it is production-ready. What three questions do you ask?**
What happens at 03:00 when it is wedged — which is really "what is in the base image and have you
rehearsed reaching it". Who rebuilds it when a JDK security release lands. And what you are
optimising, because if nobody can name the number, none of the trade-offs in it were chosen.

**★ Where does this topic stop and the next one begin?**
This topic ends at "the image starts correctly and can be diagnosed". Topic 11 replaces the JVM
entirely with a native image, and topic 12 owns stopping without dropping work. The AOT cache here is
deliberately the cheap answer to start-up; native image is the expensive one, and you should be able
to say why you did not need it before reaching for it.

**★ What is the one habit that makes all of this stick?**
Measure, attribute, act on the largest term, then re-measure. It is the same discipline the phase
gate asks for on a latency regression, applied to build artefacts. Every failure mode in this topic
is a version of acting on the easiest term instead of the largest one.

{/* FOOTER */}
