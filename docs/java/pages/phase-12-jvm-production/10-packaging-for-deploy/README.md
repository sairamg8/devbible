---
title: "Packaging for deploy: a Spring Boot jar is a build output, not a deployable — turning it into an image that starts fast, runs as nobody, can still be diagnosed at 03:00 and does not silently discard the caches you paid for is a chain of decisions, and every one of them fails quietly when it fails"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **Spring Boot 4.1 reference** — "Packaging → Efficient
> Deployments", "Container Images → Efficient Container Images / Dockerfiles / Cloud Native
> Buildpacks", "AOT Cache" and "Ahead-of-Time Processing With the JVM"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html)); the
> **Spring Boot executable-jar specification**
> ([docs.spring.io](https://docs.spring.io/spring-boot/specification/executable-jar/nested-jars.html));
> the **Spring Framework 7.0 reference**, "Ahead of Time Optimizations"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/aot.html)); the **Apache
> Maven Shade Plugin** documentation; the **JDK 25 tool references** for
> [`java`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html),
> [`jlink`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jlink.html) and
> [`jdeps`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jdeps.html); **JEPs 220, 386,
> 400, 483, 514 and 515** ([openjdk.org](https://openjdk.org/jeps/483)); the **musl libc wiki**; the
> **GoogleContainerTools/distroless** repository; the **Paketo Buildpacks Java** documentation
> ([paketo.io](https://paketo.io/docs/howto/java/)); the **Eclipse Temurin official-image**
> documentation; and the **Kubernetes API reference** for `SecurityContext`. Each chunk names the
> pages it actually quotes.
> 🔴 **No sandbox** — nothing in this topic was built, pulled, linked or run. Every size figure and
> every line of log output is quoted from a specification or JEP and attributed where it appears.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**The `.jar` that `mvn package` produces is the *start* of deployment, not the end. Between it
and a pod that serves traffic sit a dozen decisions — nested or shaded, extracted or not, which
layers, which base image, which C library, which user, which filesystem, which startup cache,
which flavour of AOT, whose Dockerfile — and the recurring property of this topic is that the
wrong answer to almost every one of them *still builds, still starts and still serves
requests*. The cost shows up as a re-pushed 60 MB layer on every deploy, a heap dump that was
never written, an AOT cache that silently declined to load, a heap size chosen by a memory
calculator nobody configured, or a `@Profile` that was baked into the artefact at build time.
This topic is the chain of those decisions in the order you meet them, with the CI assertion
that catches each silent failure.**

Phase 8 owns the build that produces the jar. **11 · GraalVM native image** *(not written yet)* owns the other way to make a binary.
[03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md) owns how much memory
the thing gets, and **12 · Graceful shutdown** *(not written yet)* owns how it
stops. This topic owns everything in between.

**29 chunks.** Read in order; each links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The fat jar](01-the-fat-jar.md)** | <span className="db-tier t-understand">Understand</span> | A nested archive with a launcher, not a merged one — and one you extract rather than run in production |
| 2 | **[Why not shading](01b-why-not-shading.md)** | <span className="db-tier t-understand">Understand</span> | Service files overwrite each other, signatures stop verifying, duplicates pick a winner silently |
| 3 | **[The collision catalogue](01c-the-collision-catalogue.md)** | <span className="db-tier t-understand">Understand</span> | Fifteen resource transformers read as the incident log they are |
| 4 | **[Minimize, relocate, choose](01d-minimizing-relocating-and-choosing.md)** | <span className="db-tier t-understand">Understand</span> | Relocation is what shading can do that nesting cannot; `minimizeJar` is what pages you; library vs application decides |
| 5 | **[Layered jars](02-layered-jars.md)** | <span className="db-tier t-understand">Understand</span> | `layers.idx` cuts one file into four along the rate-of-change axis so recompiling you does not re-push Spring |
| 6 | **[Extracting layers](02b-extracting-layers-and-the-image-cache.md)** | <span className="db-tier t-understand">Understand</span> | `-Djarmode=tools extract --layers`; the `COPY` order must match the index, and nothing enforces it |
| 7 | **[A real layered Dockerfile](02c-a-real-layered-dockerfile.md)** | <span className="db-tier t-understand">Understand</span> | Two stages, four `COPY` lines in index order, an `ENTRYPOINT` that runs the extracted jar |
| 8 | **[The cache variants](02d-the-cache-variants-of-the-dockerfile.md)** | <span className="db-tier t-understand">Understand</span> | Two more instructions, both positions forced — a training run before extraction caches nothing |
| 9 | **[Base images](03-base-images.md)** | <span className="db-tier t-understand">Understand</span> | The JRE stopped existing in Java 9; a `jre` tag deletes `jcmd`, `jstack` and JFR from the one box you need them on |
| 10 | **[Alpine and the musl port](03b-alpine-and-musl.md)** | <span className="db-tier t-understand">Understand</span> | JEP 386 is a real port with a stated scope, a lost diagnostic, and arithmetic showing the base was never the cost |
| 11 | **[What musl changes at runtime](03c-musl-runtime-differences.md)** | <span className="db-tier t-understand">Understand</span> | 128 KB default thread stacks, parallel DNS, the `ndots` rule and JEP 400's residue |
| 12 | **[Distroless](03d-distroless.md)** | <span className="db-tier t-understand">Understand</span> | glibc kept, shell and package manager gone — and it ships a JRE, fixes the `ENTRYPOINT`, cannot be exec'd into |
| 13 | **[Non-root and the filesystem](03e-non-root-and-filesystem.md)** | <span className="db-tier t-understand">Understand</span> | Two lines of YAML silently disable the heap dump, the error log, the JFR repository and `jps` |
| 14 | **[jlink](04-jlink.md)** | <span className="db-tier t-understand">Understand</span> | Links the JDK, not your application; `--bind-services` undoes the exercise; the man page hands you the bill |
| 15 | **[jdeps and the module set](04b-jdeps-and-the-module-set.md)** | <span className="db-tier t-understand">Understand</span> | Class files give a lower bound; reflective dependencies are invisible; widen deliberately, prove by tests |
| 16 | **[Class Data Sharing](05-class-data-sharing.md)** | <span className="db-tier t-understand">Understand</span> | Already on — a default archive of core classes loads every start; "enabling CDS" means extending it |
| 17 | **[Creating an archive](05b-creating-a-cds-archive.md)** | <span className="db-tier t-understand">Understand</span> | Four documented methods share one sentence; what distinguishes them is which survive a container |
| 18 | **[The training run](05c-the-training-run.md)** | <span className="db-tier t-understand">Understand</span> | Belongs in the image build and nowhere else; the silent no-op only a log assertion rules out |
| 19 | **[The AOT cache](05d-the-aot-cache.md)** | <span className="db-tier t-understand">Understand</span> | JDK 25 collapses training and assembly into one flag; it needs twice your heap and is bound to classpath, JDK and CPU |
| 20 | **[AOT modes and diagnosis](05e-aot-modes-and-diagnosis.md)** | <span className="db-tier t-understand">Understand</span> | Five `-XX:AOTMode` values, `auto` in production, `on` to debug, and `-Xlog:aot` as the only proof |
| 21 | **[When the cache helps](05f-when-the-cache-helps.md)** | <span className="db-tier t-understand">Understand</span> | Start-up and warm-up move; peak does not; JEP 515's cached profiles that the man page missed |
| 22 | **[Spring AOT processing](06-spring-boot-aot-processing.md)** | <span className="db-tier t-understand">Understand</span> | Bean definitions generated as Java source at build time, on a plain JVM, composing with the JVM cache |
| 23 | **[Enabling Spring AOT](06b-enabling-spring-aot-on-the-jvm.md)** | <span className="db-tier t-understand">Understand</span> | A profile called `native` plus a system property, and neither warns when the other is missing |
| 24 | **[What AOT gives up](06c-what-aot-processing-gives-up.md)** | <span className="db-tier t-understand">Understand</span> | Conditions evaluated at build time: `@Profile` baked in, `@ConditionalOnProperty` deaf, build-once-deploy-everywhere over |
| 25 | **[Buildpacks](07-buildpacks.md)** | <span className="db-tier t-understand">Understand</span> | A production-shaped OCI image with no Dockerfile, at the price of a builder making every decision above for you |
| 26 | **[What Paketo decides](07b-what-paketo-decides.md)** | <span className="db-tier t-understand">Understand</span> | The JVM is configured through `JAVA_TOOL_OPTIONS`, and a memory calculator you did not configure picks the heap |
| 27 | **[Configuration at deploy time](08-configuration-at-deploy-time.md)** | <span className="db-tier t-understand">Understand</span> | A secret in a layer is permanent, any `SPRING_` variable is live, and Spring AOT revokes half the arrangement |
| 28 | **[Size and startup](09-image-size-and-startup.md)** | <span className="db-tier t-understand">Understand</span> | Three numbers hide behind "image size"; measure, attribute, then change the largest term rather than the easiest |
| 29 | **[The checklist](10-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | A production-shaped image item by item, each silent failure paired with the CI assertion that catches it |

## The eight things this topic is really about

**1 · The Boot jar is nested, not merged — and you still do not run it as-is.** Boot keeps every
dependency whole inside the archive and ships a launcher that can read them, which is exactly why
it avoids the three silent failures of shading: `META-INF/services` files overwriting one another,
jar signatures that stop verifying, and duplicate resources resolved by whichever came first. But
Boot's own reference says the nested jar is not what you run in production: you extract it, and
the extracted layout is what every Dockerfile in this topic launches.

**2 · A layer is a unit of cache invalidation, and nothing enforces the order.** `layers.idx`
splits the jar along the rate-of-change axis — dependencies, Spring's own loader, snapshots, your
code — so that a recompile re-pushes kilobytes rather than the whole dependency set. The index is
*instructions for your Dockerfile*: `extract --layers` is not the default, the `COPY` lines must
follow the index order, and getting either wrong builds, runs and quietly costs the entire benefit.

**3 · "Smaller" is three numbers, and the base image is rarely the largest term.** Compressed
registry size, on-disk size and the delta pushed per deploy respond to different levers. The
musl port's own arithmetic shows the OS layer is a rounding error next to the JDK and the
dependencies; a `jre` tag deletes `jcmd`, `jstack`, `jmap` and JFR from the machine where you will
need them; and `jlink` is the one lever that works from the inside — at the cost of a module set
that `jdeps` can only lower-bound.

**4 · Hardening deletes what the JVM writes for you.** `runAsNonRoot` and
`readOnlyRootFilesystem` are two lines of YAML. They silently disable the heap dump on
`OutOfMemoryError`, the fatal error log, the JFR repository and the perf-data file that `jps`
depends on — unless every one of those paths was decided in advance and points at a writable
volume.

**5 · CDS is already on; the AOT cache is its successor; both are bound to exact inputs.** The
JVM loads a default CDS archive on every start, so "enabling CDS" is really about extending it
to your classes. JDK 25's AOT cache collapses the training-and-assembly workflow into one flag,
needs roughly twice the heap in that one-step form, and is tied to the classpath, the JDK release
and the CPU architecture that produced it. The training run belongs in the image build because
that is the only place all of those are frozen, and `-Xlog:aot` is the only honest proof that the
cache loaded rather than declined.

**6 · Two different things are called AOT, and they compose rather than compete.** Spring's AOT
processing generates bean definitions as Java source at build time and works on a plain JVM; the
JDK's AOT cache stores loaded-and-linked classes and method profiles. You turn on the first with a
Maven profile confusingly named `native` plus a matching system property, and the price is that
`@Profile` and `@ConditionalOnProperty` are evaluated at build time — the artefact now encodes its
environment, and one-image-per-environment quietly ends.

**7 · Buildpacks make every decision above for you, including the heap.** `spring-boot:build-image`
produces a production-shaped image with no Dockerfile, and Paketo configures the JVM by writing
`JAVA_TOOL_OPTIONS` — which means a memory calculator you never saw is choosing `-Xmx`. That is a
good trade for many teams and a silent one for the rest; the topic's job is to make it visible.

**8 · Every failure here is silent, so the instrument is a CI assertion.** A cache that did not
load, a layer order that did not cache, a heap dump path that cannot be written, a profile that
was baked in — none of them produce an error. The checklist pairs each with the assertion that
would have caught it: a `-Xlog:aot` grep, a layer-size diff, a write probe on the dump directory,
a startup-line grep for the AOT-generated context.

## The phase gate this topic serves

For *"p99 latency doubled after the deploy"*, this topic supplies the question that comes before
the metrics: **what actually changed in the image?** A new base tag that moved from glibc to musl
brings 128 KB thread stacks and a different resolver; a buildpack rebuild that picked up a new
memory calculator changed the heap; an AOT cache invalidated by a dependency bump means every pod
is now warming up from nothing; a Spring AOT build baked in the wrong profile. And when the
investigation reaches "take a thread dump", this topic is the reason the tools are — or are not —
in the image at all.

{/* FOOTER */}
