---
title: "The Paketo Java buildpack configures your JVM by writing JAVA_TOOL_OPTIONS, which means a memory calculator you did not configure is choosing your heap size — and that is the single most important thing to know before running a buildpack image in production"
sidebar_label: "07b · What Paketo decides"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Paketo Buildpacks Java how-to documentation**
> ([paketo.io](https://paketo.io/docs/howto/java/)); the **Spring Boot Maven plugin** reference,
> "Packaging OCI Images" ([docs.spring.io](https://docs.spring.io/spring-boot/maven-plugin/build-image.html));
> and the **JDK 25 `java` tool reference** for `JAVA_TOOL_OPTIONS` and `JDK_JAVA_OPTIONS`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> 🔴 **No sandbox** — no image was built or run, and no heap size, image size or flag value below is
> a measurement. JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[07](07-buildpacks.md) covered the goal and its parameters. This chunk is the part a review should
actually be about: the buildpack does not merely build your image, it configures your JVM at every
start, and it does so through an environment variable that overrides nothing you can see. If you
adopt buildpacks, this is the page to keep.**

## The JVM is configured by `JAVA_TOOL_OPTIONS`

The Paketo documentation is unambiguous:

> *"The Java Buildpack configures the JVM by setting `JAVA_TOOL_OPTIONS` in the JVM environment."*

> *"The runtime JVM can be configured in two ways: Buildpack-provided runtime components including
> the Memory Calculator accept semantically named environment variables which are then used to derive
> `JAVA_TOOL_OPTIONS` flags. Examples include: `BPL_JVM_HEAD_ROOM`, `BPL_JVM_LOADED_CLASS_COUNT`,
> `BPL_JVM_THREAD_COUNT`, `BPL_JVM_CLASS_ADJUSTMENT`. Flags can be set directly at runtime with the
> `JAVA_TOOL_OPTIONS` environment variable. User-provided flags will be appended to buildpack-provided
> flags. If the user and a buildpack set the same flag, user-provided flags take precedence."*

🔴 **Three separate facts to extract.**

1. **A Memory Calculator computes JVM sizing at container start** and expresses it as flags. You did
   not write those flags and they are not in your Dockerfile, because there is no Dockerfile.
2. **Its inputs are `BPL_*` environment variables** — head room, expected loaded class count, thread
   count. The defaults are the calculator's, not yours.
3. **Your own `JAVA_TOOL_OPTIONS` is appended, and on a conflict yours wins.** So you *can* override
   the calculator, and the mechanism for doing so is the same variable it uses.

⚠️ **This is the "mysterious flags" scenario from [03e](03e-non-root-and-filesystem.md), as a
designed feature rather than an accident.** When a buildpack-built JVM is behaving as though it was
started with sizing flags nobody wrote, it was. Print the environment and the effective flags from
inside the container — `java -XX:+PrintFlagsFinal -version` is topic 13's tool — before assuming a
configuration error.

## What this means for heap sizing

Topic 03 owns heap sizing, and its central rule is that `-Xmx` in an image is a bug: the JVM is
container-aware and `-XX:MaxRAMPercentage` scales one image across every memory limit.

A buildpack image takes a different route to the same goal: it **recomputes** sizing at each start
from the container's limits and the `BPL_*` inputs, and emits explicit flags. That is not the
anti-pattern topic 03 warns about — a hard-coded `-Xmx` baked into a Dockerfile — because the
computation happens fresh in the running container. It is, however, a **different** mechanism with
different failure modes, and the two do not compose intuitively:

- The calculator's model includes an allowance for classes and threads. `BPL_JVM_LOADED_CLASS_COUNT`
  and `BPL_JVM_THREAD_COUNT` exist because those are estimates, and estimates can be wrong for an
  application with an unusual thread pool or an unusually large classpath.
- `BPL_JVM_HEAD_ROOM` is the explicit knob for "leave more room for native memory" — which is the
  phase's fact 6, *heap is not the process*, made configurable.
- If you set your own `-Xmx` through `JAVA_TOOL_OPTIONS`, yours wins, and you are now back to a fixed
  heap that does not scale with the limit.

🔴 **Decide which mechanism owns sizing and use only that one.** A `-Xmx` handed to a memory
calculator produces an image whose sizing model half applies, and nobody will be able to reconstruct
which half.

## Which JVM you get

**Version:**

> *"`BP_JVM_VERSION` … Configures a specific JDK or JRE version (specify only the major version).
> Example: Given `BP_JVM_VERSION=8` or `BP_JVM_VERSION=8.*` the buildpack will install the latest
> patch releases of the Java 8 JDK and JRE."*

⚠️ The Paketo documentation's stated default is a specific older major version *"at the time of
release"*, with an explicitly conservative promotion policy:

> *"The Paketo buildpack will change the default version of Java once the most recently released LTS
> version of Java is at least one year old."*

🔴 **But you normally never see that default**, because the Spring Boot plugin overrides it: *"The
plugin detects the target Java compatibility of the project… When using the default Paketo builder
and buildpacks, the plugin instructs the buildpacks to install the same Java version."* **Your
`maven.compiler.target` is what actually picks the JRE**, and `BP_JVM_VERSION` through the plugin's
`env` parameter is how you override that. On a JDK 25 version spine, check this explicitly — a
project compiling for an older target gets an older runtime and none of this phase's JDK 25 features.

**JDK or JRE:**

> *"`BP_JVM_TYPE` … Defaults to `JRE` - a JDK will be used at build-time and a JRE will be used at
> runtime. If no JRE dependency is found, a `JDK` will be installed for use as the JRE. If `JDK` is
> specified, the buildpack will attempt to install a JDK for use at runtime. The security
> implications of using a JDK at runtime should be considered."*

🔴 **That is [03](03-base-images.md)'s decision, made for you, with the JRE as the default.** So a
buildpack image has no `jcmd`, `jstack` or `jmap` unless you set `BP_JVM_TYPE=JDK` — and the Paketo
documentation itself flags the security trade-off in the same sentence. This is the single most
important thing to establish before your first incident on a buildpack image.

**A `jlink`ed runtime, if you want one:**

> *"`BP_JVM_JLINK_ENABLED` - this defaults to `false`, set to `true` to enable JLink."*

> *"This will run JLink with the following default arguments: `--no-man-pages` … `--no-header-files`
> … `--strip-debug` … `--compress=1` … The JRE generated by default will include only Java modules
> prefixed with `java.*`."*

> *"`BP_JVM_JLINK_ARGS` - not set by default - if any value(s) are specified here, none of the
> defaults listed above will be set."*

⚠️ **"Only Java modules prefixed with `java.*`" excludes every `jdk.*` module** — which is
[04b](04b-jdeps-and-the-module-set.md)'s entire subject arriving as a default. No `jdk.jcmd`, no
`jdk.jfr`, no `jdk.charsets`, no `jdk.localedata`. And note the second quote: supplying
`BP_JVM_JLINK_ARGS` replaces the defaults entirely, so a custom argument list must re-state
`--strip-debug` and friends if you still want them.

## Where buildpacks are the right answer

- **You do not want to own a Dockerfile.** The maintenance you avoid is real: base-image bumps, CVE
  response on the OS layer, non-root setup, layering. Someone else does it and publishes a new
  builder.
- **Many similar services.** Consistency across a fleet is worth more than per-service optimisation,
  and a builder is a much better consistency mechanism than a copied Dockerfile.
- **You have a Docker daemon in CI** ([07](07-buildpacks.md)).

## Where a Dockerfile wins

- **You need a specific base image** — distroless, a hardened internal base, a specific
  vendor JDK ([03d](03d-distroless.md)).
- **You need control over what the runtime contains** — a `jlink` module set chosen from
  [04b](04b-jdeps-and-the-module-set.md), not `java.*` only.
- **You need the AOT-cache training run in the image build** ([05c](05c-the-training-run.md)) with
  flags you control. Spring Boot documents a separate how-to for AOT cache with buildpacks; a
  Dockerfile makes the step explicit and reviewable.
- **Daemonless CI.**
- **You want every decision in this topic to be visible in a file that goes through code review.**
  That is the real argument, and it is a cultural one: a Dockerfile makes the decisions legible; a
  builder makes them somebody else's.

## Gotchas

**★ The buildpack sets `JAVA_TOOL_OPTIONS`, so your JVM has flags you never wrote.** Documented, not
accidental. Any investigation of JVM behaviour on a buildpack image starts by printing the effective
command line and environment.

**★ A memory calculator is sizing your heap.** Its inputs are `BPL_JVM_HEAD_ROOM`,
`BPL_JVM_LOADED_CLASS_COUNT`, `BPL_JVM_THREAD_COUNT` and `BPL_JVM_CLASS_ADJUSTMENT`. If your
application has an unusual thread count or classpath size, the estimate is wrong and these are the
knobs.

**★ Setting your own `-Xmx` overrides the calculator and reintroduces a fixed heap.** *"If the user
and a buildpack set the same flag, user-provided flags take precedence."* Pick one owner for sizing.

**★ The default runtime is a JRE, so there is no `jcmd`.** `BP_JVM_TYPE` defaults to `JRE`. This is
[03](03-base-images.md)'s trade made by default, and the Paketo docs note the security implications
of the alternative in the same breath.

**★ `maven.compiler.target` selects your production JRE version.** The Boot plugin instructs the
buildpack to install the same version it detects. On a JDK 25 spine with an older compile target you
silently get an older runtime — and none of the AOT-cache material in this topic applies.

**★ Paketo's own default Java version lags deliberately.** *"The Paketo buildpack will change the
default version of Java once the most recently released LTS version of Java is at least one year
old."* You usually do not see it because the plugin overrides it — but you will if you use `pack`
directly.

**★ `BP_JVM_JLINK_ENABLED=true` gives you `java.*` modules only.** No `jdk.jcmd`, `jdk.jfr`,
`jdk.charsets` or `jdk.localedata`. This is the smallest-runtime option and the least diagnosable
one, and it can break locale and charset behaviour silently ([04b](04b-jdeps-and-the-module-set.md)).

**★ `BP_JVM_JLINK_ARGS` replaces the defaults rather than adding to them.** *"if any value(s) are
specified here, none of the defaults listed above will be set."* Re-state `--strip-debug`,
`--no-man-pages` and `--no-header-files` if you still want them.

**★ Buildpack images are non-root by default.** The Boot plugin states *"For security reasons, images
build and run as non-root users."* Good — and it means everything in
[03e](03e-non-root-and-filesystem.md) about writable paths for dumps and `/tmp` applies, with the
extra difficulty that you cannot add a `VOLUME` or a `USER` line to a file you do not have.

**★ You cannot inspect the decisions by reading a file in your repository.** There is no Dockerfile
to review. The equivalent is reading the builder's documentation and inspecting the produced image
— which is more work, done less often, by fewer people.

**★ Configuring the JVM now happens in two places.** Deployment-time environment variables
(`BPL_*`, `JAVA_TOOL_OPTIONS`) and build-time ones (`BP_*`, via the plugin's `env` parameter). A flag
in the wrong category is silently ignored, because `BP_*` is meaningless at run time and `BPL_*` is
meaningless at build time.

## Interview questions

**★ How does a Paketo-built image configure the JVM?**
Through `JAVA_TOOL_OPTIONS`, which the buildpack sets in the container's environment. A memory
calculator derives sizing flags from `BPL_*` variables at start-up, and any `JAVA_TOOL_OPTIONS` you
supply is appended — with user-provided flags taking precedence on a conflict. The practical
consequence is that a buildpack JVM always has flags that appear in no file in your repository.

**★ Does that conflict with topic 03's rule that `-Xmx` in an image is a bug?**
No, but it is a different mechanism. The rule targets a *hard-coded* `-Xmx` that cannot scale with
the container limit. The buildpack recomputes sizing at each container start from the actual limits,
so one image still works at every memory size. What you must not do is mix them — setting `-Xmx`
through `JAVA_TOOL_OPTIONS` overrides the calculator and reintroduces exactly the fixed heap the rule
warns about.

**★ Can you take a thread dump inside a buildpack-built image?**
Not by default. `BP_JVM_TYPE` defaults to `JRE`, so the `jdk.jcmd` tools are absent — the same trade
as any JRE base image. You either set `BP_JVM_TYPE=JDK` at build time, accepting the security
implications the Paketo documentation notes, or you plan an out-of-process diagnostic path as in
[03](03-base-images.md).

**★ Which Java version does a buildpack image get?**
The one the Spring Boot plugin detects from your compile configuration: it *"instructs the buildpacks
to install the same Java version"* as your `maven.compiler.target`. Paketo's own default is
deliberately conservative and you normally never see it. Override with `BP_JVM_VERSION` through the
plugin's `env` parameter.

**★ What does `BP_JVM_JLINK_ENABLED` do and what is the catch?**
It runs `jlink` to produce a minimal JRE with `--no-man-pages`, `--no-header-files`, `--strip-debug`
and `--compress=1`. The catch is the module set: only modules *"prefixed with `java.*`"*, so every
`jdk.*` module is dropped — diagnostics, JFR, extra charsets and locale data. And
`BP_JVM_JLINK_ARGS` replaces the defaults rather than extending them.

**★ When would you choose a Dockerfile over buildpacks for a Spring Boot service?**
When you need a specific base image such as distroless, when you need control over the runtime's
module set, when the AOT-cache training run must be an explicit reviewable step, when your CI has no
Docker daemon, or when the organisation's position is that every deployment decision should be
visible in a reviewed file. Otherwise buildpacks are a good trade, particularly across many similar
services.

**★ What is the difference between `BP_*` and `BPL_*` variables?**
`BP_*` are build-time inputs to the buildpack — the JVM version and type, whether to run `jlink`.
`BPL_*` are runtime inputs to the buildpack-provided launch components, principally the memory
calculator. Setting one where the other is expected does nothing at all, silently, which makes it a
common and frustrating configuration mistake.

{/* FOOTER */}
