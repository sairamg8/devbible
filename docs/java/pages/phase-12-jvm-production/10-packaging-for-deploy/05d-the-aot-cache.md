---
title: "The AOT cache is CDS's successor with a better workflow — JDK 25 collapses training and assembly into one flag — and the two facts nobody tells you are that the one-step form needs twice your heap and that the cache is bound to the exact classpath, JDK release and CPU architecture that produced it"
sidebar_label: "05d · The AOT cache"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference**, "Ahead-of-Time Cache" and the
> `-XX:AOTCache`, `-XX:AOTCacheOutput` and `-XX:AOTConfiguration` entries
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> **JEP 483 · Ahead-of-Time Class Loading & Linking** ([openjdk.org](https://openjdk.org/jeps/483),
> JDK 24); **JEP 514 · Ahead-of-Time Command-Line Ergonomics**
> ([openjdk.org](https://openjdk.org/jeps/514), JDK 25); and the **Spring Boot reference**,
> "Packaging → AOT Cache"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot-cache.html),
> documented at 4.1.x). 🔴 **No sandbox** — nothing was trained, assembled or run. JDK 25 · Spring
> Boot 4.1.0 / Spring Framework 7.0.9.

**[05](05-class-data-sharing.md) ended with the JDK's own tool reference telling you to *"consider
using the AOT cache"* instead of CDS, and Spring Boot saying *"we recommend using the AOT cache
whenever possible."* This is that mechanism. It keeps CDS's central idea — a training run produces
an artefact that a production run maps instead of computing — and improves two things: what goes in
the artefact, and how many commands it takes to make one.**

## What the cache is

> *"The Ahead-of-Time Cache (AOT cache) is a container introduced in JDK 24 for storing artifacts
> produced by AOT optimizations. The AOT cache currently contains Java classes and heap objects."*

🔴 **"And heap objects" is the part that distinguishes it from CDS.** A CDS archive stores parsed
classes. The AOT cache also stores the *objects* produced by the work that class initialisation
does — which matters enormously for a framework whose start-up is dominated by building object
graphs. JEP 483's motivation names the case directly:

> *"If, additionally, the application uses a framework, e.g., the Spring Framework, then the
> framework's startup-time discovery of `@Bean`, `@Configuration`, and related annotations will
> trigger yet more work."*

and states the strategy in one sentence:

> *"The key to improving startup time is to try to do at least some of this work eagerly, ahead of
> time, rather than just in time."*

## What the cache is bound to

This is the list to memorise, because every "why is the cache not being used" question resolves to
it:

> *"An AOT cache is specific to a combination of the following:*
> - *A particular application (as expressed by `-classpath`, `-jar`, or `--module-path`.)*
> - *A particular JDK release.*
> - *A particular OS and CPU architecture.*
>
> *If any of the above changes, you must recreate the AOT cache."*

🔴 **All three are satisfied automatically by an in-image training run and by nothing else.** Build
the cache in the image, after the jar is copied in ([05c](05c-the-training-run.md)), and the
classpath, the JDK and the architecture are all frozen by the image itself. Build it anywhere else
and you have taken on the job of noticing when one of the three changed — including the third one,
which changes silently the day someone adds an arm64 node to the cluster.

Spring Boot states the same condition in application terms: the cache is reusable *"as long as the
application is not updated and the same Java version is used."*

## The three phases

> *"Training: We execute the application with a representative work-load to gather statistical data
> that tell us what artifacts should be included into the AOT cache. The data are saved in an AOT
> Configuration file."*
> *"Assembly: We use the AOT Configuration file to produce an AOT cache."*
> *"Production: We execute the application with the AOT cache for better start-up and warm-up
> performance."*

Note that **assembly does not run your application**: the tool reference says of `AOTMode=create`
that *"the application itself is not executed in this phase."* Training and assembly are two
different JVM invocations doing two different jobs, and JDK 25's contribution is to hide that.

## The JDK 24 workflow: two steps, three flags

```bash
# Training
java -XX:AOTMode=record -XX:AOTConfiguration=app.aotconf -cp app.jar com.example.App

# Assembly (does not run the application)
java -XX:AOTMode=create -XX:AOTConfiguration=app.aotconf -XX:AOTCache=app.aot -cp app.jar

# Production
java -XX:AOTCache=app.aot -cp app.jar com.example.App
```

JEP 514 describes exactly why this was worth improving:

> *"It is inconvenient to have to run `java` twice in order to create an AOT cache. It is also
> inconvenient to have the AOT configuration file left over — it is just a temporary file, not
> required for production runs, and can be deleted."*

## The JDK 25 workflow: one flag

> *"We extend the `java` launcher with a new command-line option, `AOTCacheOutput`, that specifies
> an AOT cache output file. When used alone, with no other AOT options, this option causes the
> launcher to, in effect, split its invocation into two sub-invocations: The first does a training
> run (`AOTMode=record`) and then the second creates the AOT cache (`AOTMode=create`)."*

> *"As a convenience, when operating in this way the JVM creates a temporary file for the AOT
> configuration and deletes the file when finished."*

```bash
java -XX:AOTCacheOutput=app.aot -cp app.jar com.example.App
java -XX:AOTCache=app.aot   -cp app.jar com.example.App
```

Two flags, two commands, no intermediate file to clean up. ⚠️ Note that `-XX:AOTCache` and
`-XX:AOTCacheOutput` are mutually exclusive — the tool reference says of each that it *"cannot be
used together with"* the other — so a command line carrying both is a mistake, not a shortcut.

There is also a way to pass options to only the assembly sub-invocation:

> *"A new environment variable, `JDK_AOT_VM_OPTIONS`, can be used to pass command-line options that
> apply specifically to the sub-invocation which performs cache creation, without affecting the
> sub-invocation which performs the training run."*

## 🔴 The one-step form needs twice your heap

This is the caveat that turns a green CI pipeline red for reasons nobody can explain, and it is
stated plainly in JEP 514:

> *"In addition, the one-step workflow may not operate as expected in resource-constrained
> environments. The sub-invocation that creates the AOT cache uses its own Java heap with the same
> size as the heap used for the training run. As a result, the memory needed to complete the
> one-step workflow is double the heap size specified on the command line. For example, if the
> one-step workflow `java -XX:AOTCacheOutput=...` is accompanied by `-Xms4g -Xmx4g`, specifying a
> 4GB heap, then the environment needs 8GB to complete the workflow. Users in resource-constrained
> environments should use the two-step workflow if the one-step workflow does not complete
> successfully."*

**Two sub-invocations, two heaps, at the same time.** A CI runner with a memory limit — which is
every CI runner — can fail an image build for this reason with no obvious connection to the flag
that caused it. The documented remedy is the explicit two-step workflow, which runs one JVM at a
time.

JEP 514 also documents a second reason to keep the two-step form, which is a genuinely clever
production technique:

> *"if you intend to deploy an application to small instances in a cloud then you could do the
> training run on a small instance but create the AOT cache on a large instance. That way the
> training run reflects the deployment environment, but the creation of the AOT cache can leverage
> the additional CPU cores and memory of the large instance."*

## Spring Boot's version of it

```bash
java -Djarmode=tools -jar my-app.jar extract --destination application
cd application
java -XX:AOTCacheOutput=app.aot -Dspring.context.exit=onRefresh -jar my-app.jar
```

and in production:

```bash
java -XX:AOTCache=app.aot -jar my-app.jar
```

with the version gate stated as a rule rather than a preference:

> *"Spring Boot supports the AOT cache for Java 25 and above. If you're using an earlier version of
> Java, you have to use CDS instead."*

and the same silent failure as CDS:

> *"You have to use the cache file with the extracted form of the application, otherwise it has no
> effect."*

🔴 **Everything [05c](05c-the-training-run.md) said about the training run applies here unchanged**
— extract first, exit on refresh, do it in the image build. The only differences are the flag and
that the one-step form removes the intermediate configuration file.

## Gotchas

**★ The cache is bound to classpath, JDK release and OS/CPU architecture.** *"If any of the above
changes, you must recreate the AOT cache."* A multi-architecture image build must train per
architecture; a cache trained on amd64 does nothing on an arm64 node.

**★ Using the cache with the uber jar is a silent no-op.** Same sentence as CDS: it *"has no
effect."* No error, no warning. Extract, train extracted, run extracted.

**★ The one-step workflow needs double the heap.** JEP 514: *"the memory needed to complete the
one-step workflow is double the heap size specified on the command line."* If your image build sets
`-Xmx` and your CI runner is memory-limited, this is the failure you will not diagnose. Use the
explicit two-step workflow there.

**★ `-XX:AOTCache` and `-XX:AOTCacheOutput` cannot be used together.** Both entries in the tool
reference say so explicitly. One reads, one writes.

**★ Assembly does not execute your application.** *"the application itself is not executed in this
phase."* If you were expecting the `create` step to catch a configuration error, it will not — the
training run is the only step that runs your code.

**★ `JDK_AOT_VM_OPTIONS` applies only to the assembly sub-invocation.** It exists so the one-step
form can still be used when the two phases need different options. It is also, like every
`JAVA_TOOL_OPTIONS`-shaped variable, something that can alter a build's behaviour from outside the
Dockerfile.

**★ A cache trained on a different heap size may still be valid, but the training run's heap shapes
the archived objects.** The cache stores *"Java classes and heap objects"*. Train with the flags you
will deploy with rather than with a developer's defaults, so the cached object graph corresponds to
the production configuration.

**★ Spring Boot's version rule is a gate, not a preference.** *"Spring Boot supports the AOT cache
for Java 25 and above. If you're using an earlier version of Java, you have to use CDS instead."*
There is no fallback and no compatibility shim; the build has to know which JDK it targets.

**★ `-Dspring.context.exit=onRefresh` is still required.** The one-step form removes the
configuration file, not the need for the training run to terminate. Without an exit trigger the
training run does not end and neither does your image build.

**★ Do not commit an AOT cache to the repository.** It is bound to three things that a repository
does not track, and its uselessness is silent. Build it in the image build every time.

**★ Train on the target architecture.** In a `docker buildx` multi-arch build, the training `RUN`
executes per platform — which is correct, and also means it is emulated on the non-native platform
and therefore slow. Budget for that rather than being surprised by it.

## Interview questions

**★ What does the AOT cache store that a CDS archive does not?**
Heap objects. The tool reference says the cache *"currently contains Java classes and heap objects"*,
where CDS stores parsed classes. That difference is what makes it interesting for a framework:
JEP 483 explicitly names the Spring Framework's *"startup-time discovery of `@Bean`,
`@Configuration`, and related annotations"* as work done at start-up, and object state produced by
that work can be cached rather than recomputed.

**★ What invalidates an AOT cache?**
Three things, per the tool reference: a change to the application as expressed by `-classpath`,
`-jar` or `--module-path`; a different JDK release; a different OS or CPU architecture. All three
are frozen by an in-image training run, which is the main structural argument for doing it there.

**★ What did JEP 514 change, and why does the old two-step workflow still exist?**
It added `-XX:AOTCacheOutput`, which makes the launcher perform the training run and the cache
creation as two sub-invocations of one command and clean up the temporary configuration file. The
two-step form survives for two documented reasons: the one-step form needs double the heap, because
both sub-invocations size their heap from your command line; and you may deliberately want to train
on a small instance that resembles production while assembling on a large one with more cores.

**★ Your image build starts failing after adding `-XX:AOTCacheOutput`, with no clear error. What is
your first hypothesis?**
Memory. JEP 514: *"the memory needed to complete the one-step workflow is double the heap size
specified on the command line."* If the training run specifies `-Xmx4g`, the build environment needs
8 GB. The documented fix is the explicit two-step workflow, which runs one JVM at a time.

**★ Why must the training run happen against the extracted application?**
Because the cache is keyed on the application as expressed by the classpath, and a Boot uber jar
loads its classes from nested entries through Boot's own loader rather than from the classpath the
cache was built against. Spring Boot documents the result as having *"no effect"* — silently — which
makes extraction a requirement rather than an optimisation.

**★ Is the AOT cache the same thing as Spring's AOT processing?**
No, and the name collision is the single most common confusion in this area. The AOT *cache* is a
JVM feature that stores classes and heap objects from a training run. Spring's AOT *processing* is
a build-time step that generates bean-definition code. They are complementary and independent —
[06](06-spring-boot-aot-processing.md) is the other one, and topic 11 is a third
thing again.

**★ How does this relate to GraalVM native image?**
It is the same goal reached without giving anything up. The AOT cache speeds start-up and warm-up
while keeping the JVM, the JIT, reflection, dynamic class loading and every diagnostic tool. Native
image goes much further on start-up and footprint and imposes a closed-world assumption in return —
topic 11's whole subject. Try the cache first; it costs a build step and no behavioural change.

{/* FOOTER */}
