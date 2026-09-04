---
title: "Native image solves exactly one problem — the cost of starting and holding a JVM — and it solves it by moving the JVM's work to build time, which is why it is not a faster JVM and not the same thing as the AOT cache or CRaC"
sidebar_label: "01 · What problem it solves"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Native Image"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/)) and "Native Image Basics"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/basics/)); the **Spring Boot reference**,
> "Packaging → GraalVM Native Images → Introducing GraalVM Native Images"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/native-image/introducing-graalvm-native-images.html)).
> Doc text checked against the `release/graal-vm/25.3` branch of `oracle/graal`.
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8**.
> Documentation-validated; **no sandbox run** — every figure on this page is quoted from documentation and attributed.

**A JVM process spends its first second or two doing work that is identical on every run: loading and verifying classes, linking them, running static initialisers, parsing annotations, evaluating conditions, generating proxies, and interpreting bytecode until the JIT catches up. GraalVM Native Image does that work once, at build time, and ships the result as a native executable with no JVM inside it. That is the whole value proposition, and it buys exactly two things — start-up latency and process footprint. It costs you the dynamic runtime that made all of it possible, and this topic is mostly about that bill.**

## What the tool is, in the documentation's own words

The reference manual opens with a one-sentence definition worth memorising, because it settles what kind of artefact you get:

> *"Native Image is a technology to compile Java code ahead-of-time to a binary—a native executable."*

and immediately says what is inside it:

> *"A native executable includes only the code required at run time, that is the application classes, standard-library classes, the language runtime, and statically-linked native code from the JDK."*

Read the second sentence twice. **"Only the code required at run time"** is the source of every benefit and every problem in this topic. And **"the language runtime"** is the thing people miss: a native executable is not "Java without a runtime". It still contains a garbage collector, a thread implementation, an exception mechanism and a monitor implementation — Substrate VM — statically linked into the binary. What it does not contain is a bytecode interpreter for arbitrary new classes, a JIT compiler, or a class loader that can materialise code it has never seen.

The build itself is two phases:

> *"First, the `native-image` tool performs static analysis of your code to determine the classes and methods that are **reachable** when your application runs. Second, it compiles classes, methods, and resources into a binary."*

And the vocabulary that the rest of this topic depends on:

> *"This entire process is called **build time** to clearly distinguish it from the compilation of Java source code to bytecode."*

🔴 **"Build time" in this topic never means `javac`.** It means *"while `native-image` is running"* — a phase during which your own code can execute. [04](04-build-time-vs-run-time-initialisation.md) is entirely about the consequences of that.

## The advantages, quoted rather than measured

The reference manual lists five claims for an executable produced by Native Image. They are quoted here verbatim because they are the honest version — none of them is a number:

> *"- Uses a fraction of the resources required by the Java Virtual Machine, so is cheaper to run*
> *- Starts in milliseconds*
> *- Delivers peak performance immediately, with no warmup*
> *- Can be packaged into a lightweight container image for fast and efficient deployment*
> *- Presents a reduced attack surface"*

⚠️ **"Delivers peak performance immediately, with no warmup" is not the same claim as "delivers a warmed JVM's peak performance."** It says the binary reaches *its own* ceiling at once. Whether that ceiling is above or below a warmed HotSpot depends on the workload and on which GraalVM distribution you built with — [07c · Getting throughput back](07c-getting-throughput-back.md) is the honest version of that sentence and it is the single most over-read line in GraalVM's documentation.

Spring Boot's reference frames the same thing from the deployment side:

> *"Compared to the Java Virtual Machine, native images can run with a smaller memory footprint and with much faster startup times."*

> *"They are well suited to applications that are deployed using container images and are especially interesting when combined with "Function as a service" (FaaS) platforms."*

> *"A GraalVM Native Image is a complete, platform-specific executable. You do not need to ship a Java Virtual Machine in order to run a native image."*

**The only start-up figure that appears in either reference** is in Boot's own worked example, where the sample application's log line reads `Started MyApplication in 0.08 seconds (process running for 0.095)`. The documentation attaches its own caveat immediately: *"The startup time differs from machine to machine, but it should be much faster than a Spring Boot application running on a JVM."* Quote it that way or not at all. **Do not carry a number from a conference slide into a capacity plan.**

## Where the win is real, and where it is not

The benefit is proportional to **how often you pay start-up** and **how many copies of the process you run**. That gives a short list where native image is genuinely the right answer:

- **Functions and scale-to-zero.** A platform that cold-starts a process per burst of traffic pays start-up on the critical path, per invocation. This is the case native image was designed for.
- **CLI tools.** A command that runs for 200 ms and exits can never amortise JIT warm-up. The JVM's whole design — profile, then optimise — is a bet on the process living long enough to collect the winnings.
- **Short-lived batch and jobs.** Same argument: a per-run fixed cost, multiplied by the number of runs.
- **High-density deployments.** Footprint per process is the constraint when you run hundreds of small services on the same nodes. Fewer megabytes resident per pod is a real, bankable saving.
- **Aggressive horizontal autoscaling.** If your HPA adds capacity on a 30-second horizon and the pod takes 25 seconds to be ready, scaling is not actually reactive. Native image can move that number into a range where it is.

And the list where it is not:

- **A long-lived service under sustained load.** It starts once a week. Start-up is not on anyone's critical path, and you traded a warmed JIT for a compiler's static guess. See **09 · When it pays** *(not written yet)*.
- **A service whose start-up is dominated by I/O.** Connection pools, schema migrations, remote configuration fetches and cache warming still happen at run time in a native image, exactly as they do on a JVM. Native image removes *class loading and initialisation*; it does not remove *your* initialisation. If half your start-up budget is Flyway, you will halve at best.
- **A service with a large dynamic surface.** Heavy reflection, bytecode generation, plugin class loading, or a dependency that does any of these without shipping metadata. The cost lands as build failures and, worse, as run-time failures that do not reproduce on the JVM ([03](03-what-breaks.md)).
- **Anything where the fix is "make start-up smaller".** Deferring work off the start-up path, dropping unused auto-configuration and not eagerly opening pools are free, reversible and often bigger. Try them first.

## 🔴 The boundary: three technologies, three different problems

This is the most-confused trio in the phase and the confusion is understandable, because two of them are named "AOT". State the boundary out loud before any design discussion:

| | **AOT cache** (topic 10) | **Native image** (this topic) | **CRaC** (topic 15) |
|---|---|---|---|
| What it is | A JVM feature: a file of pre-loaded, pre-linked classes and heap objects (and, from JDK 25, method profiles) | An ahead-of-time compiler producing a standalone binary | A checkpoint of a *running* process, restored later |
| Runtime | Stock JDK 25 | None — there is no JVM in the artefact | A CRaC-enabled JDK with CRIU privileges |
| Removes | Repeated class-loading and linking work | Class loading, linking, initialisation, JIT — the whole dynamic runtime | Initialisation **and** JIT warm-up |
| Dynamic Java | Unchanged | 🔴 Constrained; needs reachability metadata | Unchanged |
| Reversible | Delete the file | No — it is a different artefact and a different build | Delete the image |

- **Topic 10** ([`10-packaging-for-deploy/05d-the-aot-cache.md`](../10-packaging-for-deploy/05d-the-aot-cache.md)) owns the AOT cache. It is a **JVM** feature. It does not compile anything ahead of time in the native-image sense.
- **Topic 10** also owns **Spring's AOT processing** ([`06-spring-boot-aot-processing.md`](../10-packaging-for-deploy/06-spring-boot-aot-processing.md)) — a third thing called AOT, which is a build-time *source generator*, works fine on a plain JVM, and is a **prerequisite** for the Spring path into native image rather than a synonym for it. [05](05-spring-boot-aot.md) picks it up from there.
- **Topic 15** ([`15-checkpoint-restore-crac/README.md`](../15-checkpoint-restore-crac/README.md)) owns CRaC, and already carries the three-way comparison table at [`07-crac-vs-native-image-vs-aot-cache.md`](../15-checkpoint-restore-crac/07-crac-vs-native-image-vs-aot-cache.md). Read it before proposing either.
- **This topic** owns ahead-of-time compilation to a native executable, the closed-world assumption, and the bill that comes with it. It does **not** re-teach packaging — layers, base images, `jlink`, non-root and image size are all topic 10.

## What you are actually deciding

Not "is native image faster". The decision is: **are you willing to convert a class of run-time flexibility into a class of build-time configuration, permanently, for this artefact?** Everything in [02](02-the-closed-world-assumption.md) onward is a consequence of answering yes.

## Gotchas

**★ Symptom: someone says "we'll turn on native image" as if it were a JVM flag.** Cause: the AOT-cache and Spring-AOT features genuinely *are* close to flags, and the vocabulary collides. Fix: name the artefact. `--enable-preview` is a flag; a native executable is a different build, a different base image, a different test pipeline and a different debugging story. Ask which of the three technologies in the table above the speaker means before agreeing to anything.

**★ Symptom: the native build is adopted to fix a start-up problem, and start-up barely moves.** Cause: the start-up budget was dominated by I/O — pool creation, migrations, remote config — not by class loading. Native image removes *class loading and initialisation of the framework*, not your own work at run time. Fix: measure the budget first. Time from process start to "Spring context refreshed" versus context-refreshed to "ready" tells you which half you are attacking; only the first half is native image's to take.

**★ Symptom: "peak performance immediately, with no warmup" is read as "faster than a warmed JVM".** Cause: the sentence is about *warm-up curve shape*, not about the ceiling. Fix: read it as "the curve is flat from t=0", then ask separately how high the flat line is — which is [07c · Getting throughput back](07c-getting-throughput-back.md), and which depends on the distribution you built with.

**★ Symptom: a native binary built on a developer laptop will not run on the deployment host.** Cause: *"A GraalVM Native Image is a complete, platform-specific executable"*, and Spring Boot's reference notes that `native-image` **does not support cross-compilation**. Fix: build in a container that matches the target OS, architecture and libc, or use buildpacks, which do exactly that for you — see [06](06-building-one.md).

**★ Symptom: the team expects to keep one artefact for every environment.** Cause: a native executable is per-platform *and*, because Spring evaluates conditions at build time, per-configuration. Fix: accept one build per target platform, and read [05b](05b-what-spring-gives-up.md) before promising "build once, deploy everywhere" to anyone.

**★ Symptom: the fastest-start technology is chosen without asking how long the process lives.** Cause: start-up is the only axis on the slide. Fix: use the three-way table above. If the process lives for days under load, the interesting axis is peak throughput and the interesting technology is probably neither — or CRaC, which is the only one of the three that restores a *warm* JIT.

## Interview questions

**★ What does a GraalVM native executable actually contain, and what does it not?**
The reference manual's answer: *"the application classes, standard-library classes, the language runtime, and statically-linked native code from the JDK"* — and only the parts of those that static analysis found reachable. It contains a garbage collector, threading, exception handling and monitors, because those are the language runtime. It does not contain a JIT compiler, a bytecode interpreter for new classes, or a class loader that can define classes from bytes it has not seen at build time. That last absence is the closed-world assumption, and it is what makes reflection and dynamic proxies a configuration problem rather than a free feature.

**★ Why is "native image" not simply "a faster JVM"?**
Because it removes the JVM. A JVM is an adaptive system: it observes what your program actually does and re-optimises accordingly, including de-optimising back to the interpreter when an assumption is invalidated. A native executable has no observation phase and nothing to de-optimise into. It trades adaptivity for a fixed, immediately-available machine-code implementation. That is a straight win when the process is short-lived and a real cost when it is not.

**★ Your service starts in nine seconds and the platform team wants three. What do you check before proposing native image?**
Split the nine seconds. How much is JVM start plus class loading plus Spring context refresh, and how much is your own initialisation — pools, migrations, remote config, cache warming, first-request lazy work? Native image can attack the first part; nothing in it touches the second. Then check the dynamic surface: how many dependencies do reflection, bytecode generation or dynamic class loading, and do they ship reachability metadata. If the answer is "most of the nine seconds is Flyway and Kafka consumer group joins", native image is the wrong tool and the honest answer is to defer that work off the readiness path.

**★ Someone in a design review says "we already use AOT, so we're most of the way to native." What has gone wrong?**
Three different things are called AOT in this stack and the sentence does not say which. The **AOT cache** is a JDK 25 feature that stores loaded and linked classes, heap objects and method profiles from a training run; it is a JVM optimisation with no relationship to native image. **Spring AOT processing** generates bean definitions as Java source at build time; it runs on a plain JVM and is a prerequisite for the Spring native path but not the same thing. **Native image** is ahead-of-time compilation to a standalone binary. Having the first two on does mean the *Spring* half of the work is done; it says nothing about whether your dependencies survive the closed world.

**★ Why does native image help more at high pod density than at high request throughput?**
Because the win is per-process, not per-request. Footprint and start-up are paid once per process; throughput is paid per request. Running four hundred small services means four hundred copies of the fixed cost, and reducing it is multiplied by four hundred. Running one service at forty thousand requests per second means the fixed cost is amortised to nothing and the only number that matters is the one native image is *weakest* on relative to a warmed JVM.

**★ Where does native image explicitly *not* belong in this phase's material?**
Packaging. Layered jars, `jarmode`, JRE base images, distroless, `jlink`, non-root users and image size are topic 10's, and a native build changes almost none of that reasoning — you still need a base image, you still should not run as root, and image size still matters. The only packaging fact that is native-image-specific is that the runtime layer disappears, which is why the Paketo native builder can use a `-tiny` run image with no JVM in it.

{/* FOOTER */}
