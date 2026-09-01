---
title: "Image size and startup time are two problems with almost no levers in common, and there are actually three numbers hiding behind the first one — so the only honest method is to measure the one you care about, attribute it, and then change the largest term rather than the easiest"
sidebar_label: "09 · Size and startup"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 386 · Alpine Linux Port** ([openjdk.org](https://openjdk.org/jeps/386))
> and the **distroless** README ([github.com](https://github.com/GoogleContainerTools/distroless))
> for the only size figures quoted here; the **JDK 25 `java` tool reference** for the CDS archive
> size ratio and `-Xlog` ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> the **Spring Boot reference**, "Actuator → Endpoints"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)) and
> "Packaging → Efficient Deployments"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html)); and
> **JEP 515** ([openjdk.org](https://openjdk.org/jeps/515)).
> 🔴 **No sandbox** — nothing was built, pulled or timed. **Every number on this page is quoted from a
> named document and attributed inline**; there are no measurements of a Spring Boot image here,
> because producing one would require running a build. JDK 25 · Spring Boot 4.1.0 / Spring
> Framework 7.0.8.

**This chunk exists because the previous twenty-odd chunks each claimed to improve "size" or
"startup", and a reader is entitled to ask which of them to do first. The honest answer is that
nobody can tell you without measuring your image — and that "image size" is three different numbers
that respond to different levers. This page is the method, not a league table.**

## Three numbers, not one

| Number | What it is | Who feels it |
|---|---|---|
| **Stored size** | Total bytes of all layers | Registry storage cost; node disk |
| **Transfer size** | Bytes actually pulled for a *new version* — only the layers that changed | Deploy latency, autoscaling latency, egress bills |
| **Startup time** | Process start to ready | Request latency on cold start; rollout and rollback speed |

🔴 **[02](02-layered-jars.md)'s layering work moves the second number and not the first.** Splitting a
jar into four layers does not remove a byte from the image; it means a code-only change re-pushes and
re-pulls only the application layer. Teams routinely measure stored size, see no improvement, and
conclude layering "did nothing" — while their deploy time fell.

⚠️ **Different tools report different numbers, and they are not interchangeable.** The size your
local daemon reports for an image, the size of the compressed blobs a registry stores, and the bytes
a particular node has to fetch given what it already has cached are three genuinely different
quantities. **State which one you are optimising before you start**, because an argument in which one
person means registry storage and the other means deploy latency cannot converge.

## Measuring size, per layer

```bash
# What the daemon says the whole image weighs
docker image inspect myapp:1.0 --format '{{.Size}}'

# Where those bytes are: one row per layer, with the instruction that created it
docker history --no-trunc myapp:1.0

# What a registry actually holds: the manifest lists each layer blob and its size
docker manifest inspect myapp:1.0
```

🔴 **`docker history` is the whole technique.** It attributes bytes to instructions, which converts
"the image is too big" into "this `COPY` is the big one" — and in a
[02c](02c-a-real-layered-dockerfile.md)-shaped Dockerfile the four `COPY` lines line up exactly with
the four layers, so you can see immediately whether your dependencies or your code dominate.

## The size levers, and what is actually documented about each

Only two independent documents in this topic put numbers on anything, and both are quoted rather than
measured.

**The base image.** The distroless README: *"The smallest distroless image,
`gcr.io/distroless/static-debian13`, is around 2 MiB. That's about 50% of the size of `alpine`
(~5 MiB), and less than 2% of the size of `debian` (124 MiB)."* So base images range over roughly two
orders of magnitude — but the top of that range, full `debian`, is 124 MiB, which bounds how much
this lever can ever be worth.

**The Java runtime.** JEP 386: a `java.base`-only runtime with the server VM *"fits in 38 MB"* on a
5.6 MB Alpine base. 🔴 **That is the ratio to keep in your head: in the smallest possible Java image
the runtime is roughly seven times the distribution.** A full JDK is larger still. This is why
[04](04-jlink.md) — trimming the runtime — has more headroom than [03b](03b-alpine-and-musl.md) —
trimming the distribution.

**Your dependencies.** No document can quantify this for you, and in a real Spring application it is
usually the largest single term. `docker history` will tell you in one command whether your
dependency layer dwarfs everything else. If it does, the lever is dependency hygiene, not base
images.

**The archive or cache you added.** The `java` tool reference: *"Classes in the CDS archive are
stored in an optimized format that's about 2 to 5 times larger than classes stored in JAR files or
the JDK runtime image."* 🔴 **A start-up optimisation makes the image bigger**, and if you cache
indiscriminately it makes it much bigger. JEP 515 adds that profiles are cheap on top of an existing
cache — *"about 2.5% more than the AOT cache without profiles"* on its own example — but the cache
itself is not.

**The order to consider them**, which is a reasoning order and not a measured one:

1. Run `docker history`. Find the largest layer. Everything else is speculation until you have.
2. If dependencies dominate — the common case for Spring — reduce dependencies. Nothing about base
   images will help.
3. If the runtime dominates, `jlink` ([04](04-jlink.md)) with the caveats in
   [04b](04b-jdeps-and-the-module-set.md).
4. If the distribution dominates — unusual — distroless or Alpine
   ([03d](03d-distroless.md), [03b](03b-alpine-and-musl.md)).
5. If it is transfer size you care about, layering ([02](02-layered-jars.md)) is the whole answer and
   none of the above is.

## Measuring startup, and attributing it

Spring Boot ships the attribution tool:

> *"`startup` — Shows the startup steps data collected by the `ApplicationStartup`. Requires the
> `SpringApplication` to be configured with a `BufferingApplicationStartup`."*

🔴 **That endpoint is the equivalent of `docker history` for start-up**: it turns "we start in several
seconds" into a list of steps with durations, which is the only basis on which the rest of this topic
can be prioritised. Enable it in a staging build, look once, and you will usually find that the
answer was not what anyone guessed.

Three complementary measurements:

- **`-Xlog:class+load`** ([05c](05c-the-training-run.md)) — how many classes are loaded, and whether
  they came from an archive. If class loading is not a large share, no cache will help.
- **JFR from the first instant** (topic 06) — a recording started with the JVM covers the part of
  start-up that happens before Spring exists at all.
- **The container's own view.** Time from container start to the readiness probe passing, which
  includes image pull on a cold node and is what an autoscaler actually experiences.

## The startup levers, mapped to what they remove

| Lever | Removes | Chunk |
|---|---|---|
| Run the **extracted** jar | Nested-jar reading cost, *"a small startup cost"* per the Boot reference | [01](01-the-fat-jar.md), [02b](02b-extracting-layers-and-the-image-cache.md) |
| **AOT cache** | Class loading and linking; heap objects; (JDK 25) profile collection | [05d](05d-the-aot-cache.md) |
| **Spring AOT processing** | Classpath scanning, `@Configuration` parsing, condition evaluation | [06](06-spring-boot-aot-processing.md) |
| Fewer dependencies | Everything above, proportionally | — |
| Deferring I/O work | Pool creation, migrations, remote config fetches | Application design |

⚠️ **Nothing in the first three rows touches the last one.** Connection pool warm-up, Flyway,
secrets-manager round trips and TLS handshakes are unaffected by any archive or generated code
([05f](05f-when-the-cache-helps.md)). If the `startup` endpoint says half your time is in a
`DataSource` initialisation, the entire cache apparatus addresses the other half.

## The failure mode this page exists to prevent

**Optimising the easiest thing to change rather than the largest term.** Base images are easy to
change — one line — so they get changed. Dependencies are hard to change, so they do not. The result
is a team that switched to Alpine, accepted a libc change and a testing burden
([03c](03c-musl-runtime-differences.md)), and moved the smallest number in the sum.

The discipline is the same one the phase gate asks for on a latency regression: **measure, attribute,
then act on the largest attributable term** — and re-measure afterwards, because the next largest
term is now the one that matters.

## Gotchas

**★ Layering does not reduce image size.** It reduces the bytes transferred when a *new version* is
pulled. If you measure stored size after adopting layering you will find no improvement and draw the
wrong conclusion.

**★ "Image size" is at least three numbers.** Bytes the daemon reports, bytes a registry stores as
compressed blobs, and bytes a specific node must fetch given its cache. Decide which one you are
optimising before the conversation starts.

**★ The runtime is bigger than the distribution.** JEP 386's own example: 5.6 MB base, 38 MB minimal
runtime. Trimming the base image is the smallest available win in a Java image, and it is the one
everyone does first.

**★ Adding an AOT cache or CDS archive makes the image larger.** *"about 2 to 5 times larger than
classes stored in JAR files"*. You are buying start-up with bytes. On a scale-to-zero workload that
is an excellent trade; on a service that starts monthly it is not.

**★ A start-up measurement on a workstation is not a measurement.** Production pods run with CPU
limits, cold page caches and a network that has to be traversed. Measure in a container with
production's limits.

**★ Cold-start latency includes the image pull.** For an autoscaler adding a pod to a node that has
never seen your image, transfer size *is* start-up time. This is the case where layering and start-up
optimisation are the same project.

**★ The Actuator `startup` endpoint needs `BufferingApplicationStartup` configured.** It is not on by
default — the reference says it *"Requires the `SpringApplication` to be configured with a
`BufferingApplicationStartup`"*. Wire it in a staging profile, not in production, since it buffers
data for the life of the process.

**★ Class-loading share decides whether caches can help at all.** `-Xlog:class+load` first. If the
answer is "we load few classes and spend our time on I/O", the entire AOT chapter is irrelevant to
your service and you should say so rather than adopting it because it is current.

**★ Beware improvements measured on a warm daemon.** A second `docker run` of the same image reads a
warm page cache and reports a startup time no production cold start will reproduce.

**★ Re-measure after each change.** Removing the largest term promotes a different one. An
optimisation plan written once and executed to completion optimises three things that stopped
mattering after the first.

**★ Do not import numbers from documentation into a design document.** JEP 515's 19%, the man page's
23M and 36M, distroless' 2 MiB — all are quoted here because they are attributable, and none of them
predicts anything about your image. This is the rule the whole phase runs on.

## Interview questions

**★ Your image is 900 MB. What do you do first?**
`docker history --no-trunc`, to find which layer holds the bytes. Everything else is guessing. In a
Spring application the answer is usually the dependency layer, in which case base-image changes are
irrelevant and dependency hygiene is the lever. Only if the runtime layer dominates does `jlink` come
into it, and only if the distribution dominates — rare — is distroless or Alpine the answer.

**★ Someone says layering reduced their image size. Are they right?**
No, and the misunderstanding is worth correcting carefully. Layering splits the same bytes across
more layers; the total is unchanged. What it reduces is the bytes pushed and pulled when a new
version differs only in application code. That is usually the number they actually care about, so the
conclusion is right and the reasoning is wrong — which matters, because the wrong reasoning leads to
measuring the wrong thing next time.

**★ How do you find out where a Spring Boot application's start-up time goes?**
Actuator's `startup` endpoint, backed by `BufferingApplicationStartup`, which reports the startup
steps and their durations. Alongside it, `-Xlog:class+load` for the class-loading share and a JFR
recording started with the JVM for everything before Spring exists. Then attribute: class loading and
context creation respond to the AOT cache and Spring AOT; connection pools, migrations and remote
configuration do not.

**★ Why is the base image the least productive size lever in a Java image?**
Because the runtime dwarfs it. JEP 386's example puts a `java.base`-only runtime plus the server VM
at 38 MB on a 5.6 MB Alpine base — and that is the most favourable case, with no application and one
module. In a real image the JDK and your dependencies dominate, so the distribution is a small term
that happens to be a one-line change.

**★ Does adding an AOT cache have a cost?**
Yes: image size. The `java` tool reference says archived classes are *"about 2 to 5 times larger than
classes stored in JAR files"*. You trade bytes for start-up. Whether that is a good trade is entirely
a question of how often the process starts, which is [05f](05f-when-the-cache-helps.md).

**★ When are image size and startup time the same problem?**
On a cold node, where the pull is part of the time to first request — which is exactly the
scale-to-zero and rapid-autoscaling case where start-up matters most. There, layering, a smaller
image and a faster JVM start are one project, and transfer size deserves as much attention as the
JVM.

**★ What would make you refuse to adopt an optimisation from this topic?**
Not having measured. Every technique here has a cost — build time, image bytes, a libc change, a
closed-world assumption, a runtime you now have to patch yourself — and the only justification for
paying one is an attributed measurement showing the term it addresses is the largest one. "It is
best practice" is not a measurement.

{/* FOOTER */}
