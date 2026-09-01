---
title: "Adding a startup cache to the layered Dockerfile is two instructions, and both of their positions are forced — the training run must come after the extraction because a cache built against a non-extracted application silently has no effect"
sidebar_label: "02d · The cache variants"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference documentation** — "Packaging → Container
> Images → Dockerfiles"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/container-images/dockerfiles.html)),
> "Packaging → Efficient Deployments"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html))
> and "Packaging → AOT cache"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot-cache.html)).
> 🔴 **No sandbox** — no image was built and no startup timing below is a measurement. Both
> Dockerfile fragments are quoted from the documentation, not composed.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[02c](02c-a-real-layered-dockerfile.md) is the plain layered Dockerfile. This page adds a startup
cache to it, which the documentation does with exactly two extra instructions. The interesting part
is not the flags — `05-class-data-sharing.md` and `05b-the-aot-cache.md` *(neither written yet)* own
those — but that both instructions have a forced position, and putting either in the wrong place
produces an image that builds, runs, and delivers nothing.**


## The same skeleton, two more instructions

**The base file gains a training run and a flag.** Both variants are quoted from the same
documentation page and differ from the base file only in the last two instructions.

**AOT cache — Java 25 and above**, which the documentation recommends over CDS:

```dockerfile
# Execute the AOT cache training run
RUN java -XX:AOTCacheOutput=app.aot -Dspring.context.exit=onRefresh -jar application.jar

ENTRYPOINT ["java", "-XX:AOTCache=app.aot", "-jar", "application.jar"]
```

**CDS — Java 24 and above**, for when you are not on 25 yet:

```dockerfile
# Execute the CDS training run
RUN java -XX:ArchiveClassesAtExit=application.jsa -Dspring.context.exit=onRefresh -jar application.jar

ENTRYPOINT ["java", "-XX:SharedArchiveFile=application.jsa", "-jar", "application.jar"]
```

🔴 **Note where the training `RUN` sits: after all four `COPY` lines.** It has to, because the
documentation is explicit that a cache *"has to be used with the extracted form of the application,
otherwise it has no effect"* — the extraction you did for layering is the precondition for the cache
you are about to build. **One structure, three benefits**, exactly as
[02b](02b-extracting-layers-and-the-image-cache.md) argued.

⚠️ **`-Dspring.context.exit=onRefresh` is what makes a training run terminate.** It starts the
application far enough to load and link the classes a real start would, then exits instead of
serving traffic. Without it the `RUN` would never finish.

🔴 **The training run adds a fifth image layer, and it is invalidated by the `application` layer** —
so it is rebuilt on every commit. That is correct and intended: a cache trained against different
application classes would be stale. *(What "stale" costs, and when the cache does not help at all,
is `05c-when-aot-helps-and-when-it-does-not.md`* **not written yet**.*)*

**The flags themselves belong to later chunks** — `05-class-data-sharing.md` and
`05b-the-aot-cache.md` *(neither written yet)*. What this page claims is only that the Dockerfile
shape is unchanged: extract, copy in order, train, run with the cache.

## Which one, and the version gate

The documentation states the rule plainly:

> *"Spring Boot supports the AOT cache for Java 25 and above. If you're using an earlier version of
> Java, you have to use CDS instead."*

and its preference:

> *"we recommend using the AOT cache whenever possible."*

🔴 **So this is a version question, not a taste question.** On JDK 25 — the version this phase pins —
the AOT cache variant is the documented recommendation and CDS is the fallback for anyone still on
24. There is no scenario where you evaluate both against your workload and pick; the newer mechanism
supersedes the older one.

⚠️ **The base image tag in the documented file is `25-cds`**, and the name is now a little
misleading: it long predates the AOT cache and marks an image prepared for class-data sharing. It is
the tag the documentation uses for the AOT variant too.

## When the cache stops being valid

The cache is not permanent, and the condition is narrower than people assume:

> *"as long as the application is not updated and the same Java version is used"*

**Both halves matter, and both are satisfied automatically by building the cache inside the image.**
The application cannot be updated without rebuilding the image, and the Java version cannot change
without changing the base image — so an in-image training run can never produce a stale cache.

🔴 **That is the strongest argument for doing the training run as a build step rather than an
entrypoint step**, and it is easy to miss because the obvious argument — "don't pay it at every
start" — is the weaker one. **Building the cache in the image makes staleness structurally
impossible.** A cache produced or refreshed at container start has to be reasoned about instead.

## Why the training run is a `RUN` and not part of the entrypoint

**A training run starts the application.** That is what makes it useful — the classes it loads and
links are the ones a real start would — and it is also what makes it something you do not want in
the startup path.

⚠️ **It also means the training run executes your application's initialisation inside the image
build.** Anything that happens on context refresh happens here: bean construction, configuration
binding, and any eager component that reaches out to a database or a message broker.
`-Dspring.context.exit=onRefresh` stops it *at* refresh rather than after, which bounds this — but a
component that connects during refresh will still try to connect, in a build environment that
probably has no such service.

🔴 **That is the practical failure mode of adding a cache to a working Dockerfile:** the build starts
failing in a stage that previously did nothing but copy files, with a stack trace from your own
application. The fix belongs to configuration — a build-time profile — which is
`08-configuration-at-deploy-time.md`'s subject *(not written yet)*.

## Gotchas

**★ 🔴 The training `RUN` must come after all four `COPY` lines.**
A cache *"has to be used with the extracted form of the application, otherwise it has no effect."*
Training before the copies would train against nothing, and the failure is silent rather than loud.

**★ `-Dspring.context.exit=onRefresh` is what lets the training run exit.**
It starts the context far enough to load and link classes, then terminates. Without it the `RUN`
instruction never returns and the image build hangs rather than fails — which reads as a broken
builder, not as a missing flag.

**★ The training run executes your application's startup inside the image build.**
Anything eager enough to run during context refresh runs here, in a build environment with no
database and no broker. A cache added to a previously-working Dockerfile can start failing the build
with a stack trace from your own beans.

**★ The training run's layer is invalidated by every commit.**
It sits after the `application` layer, so a code change rebuilds it. That is intended — a cache
trained against different classes would be stale — but it does mean the cache variants have a larger
per-commit rebuild than the plain file.

**★ 🔴 AOT cache versus CDS is a version gate, not a preference.**
*"Spring Boot supports the AOT cache for Java 25 and above. If you're using an earlier version of
Java, you have to use CDS instead."* On JDK 25 the answer is the AOT cache, and the docs add that
they *"recommend using the AOT cache whenever possible."*

**★ The cache is valid only while the application and the Java version are unchanged.**
*"as long as the application is not updated and the same Java version is used."* Building it inside
the image satisfies both conditions by construction — neither can change without a rebuild.

**★ 🔴 Building the cache in the image makes staleness structurally impossible.**
This is a better reason for the build-time training run than "don't pay it at startup", and it is
the one people miss. A cache created or refreshed at container start has to be reasoned about
instead.

**★ The `-cds` base-image tag predates the AOT cache and is used for both variants.**
`bellsoft/liberica-openjre-debian:25-cds` is the tag the documentation uses even in the AOT example.
The name marks an image prepared for class-data sharing; do not read it as excluding AOT.

**★ The two variants differ only in their last two instructions.**
Everything through the four `COPY` lines is identical to the plain file. If a Dockerfile claiming to
add a cache differs anywhere above that, something else changed too.

**★ The cache flags belong to two different mechanisms with different file extensions.**
`-XX:AOTCacheOutput` / `-XX:AOTCache` with an `.aot` file, versus `-XX:ArchiveClassesAtExit` /
`-XX:SharedArchiveFile` with a `.jsa` file. Mixing a flag from one with a file from the other is a
plausible-looking configuration that cannot work.

**★ Adding the cache does not change what the `ENTRYPOINT` runs.**
It is still the extracted `application.jar`, with one flag added. If someone "simplified" the
entrypoint back to the uber jar while adding a cache, the cache silently has no effect — both
mistakes at once, neither visible.

## Interview questions

**★ Where does the cache training run go in the Dockerfile, and why exactly there?**
After all four `COPY` lines. The cache has to be built against the extracted form of the application
— the documentation says a cache used with a non-extracted application has no effect — so the
extraction that gave you layer caching is also the precondition for training. Its output becomes a
fifth layer, invalidated whenever the `application` layer changes.

**★ What does `-Dspring.context.exit=onRefresh` do, and what happens without it?**
It makes the application start far enough to load and link the classes a real startup would, then
exit rather than begin serving. Without it the `RUN` instruction never returns and the image build
hangs — which presents as a stuck builder rather than as a missing flag, so it is easy to
misdiagnose.

**★ AOT cache or CDS — how do you choose?**
You do not, really; the Java version chooses. Spring Boot supports the AOT cache on Java 25 and
above, and says that on earlier versions you have to use CDS instead. It also recommends the AOT
cache whenever possible. On JDK 25 the answer is the AOT cache, and CDS is what you use if you are
still on 24.

**★ How long is the cache valid, and why does building it in the image matter?**
The documentation says it is valid as long as the application is not updated and the same Java
version is used. Both conditions are automatically satisfied when the cache is created during the
image build: the application cannot change without a rebuild, and the Java version cannot change
without changing the base image. So an in-image cache can never be stale — which is a stronger
argument for the build-time training run than merely avoiding the cost at startup.

**★ You add a cache training run to a Dockerfile that has been working for a year, and the build
starts failing. What is the likely cause?**
The training run starts your application, so anything eager enough to execute during context refresh
now executes inside the image build — typically a component connecting to a database or a broker
that does not exist in the build environment. `-Dspring.context.exit=onRefresh` bounds how far it
goes but does not stop a refresh-time connection attempt. The fix is a build-time configuration
profile, not a change to the packaging.

**★ Someone shows you `-XX:AOTCache=app.jsa`. What is wrong?**
It mixes the two mechanisms. The AOT cache uses `-XX:AOTCacheOutput` to create and `-XX:AOTCache` to
consume, with an `.aot` file; CDS uses `-XX:ArchiveClassesAtExit` and `-XX:SharedArchiveFile` with a
`.jsa` archive. The combination looks plausible in review because both are startup caches with
similar-sounding flags, and neither name tells you which family it belongs to.

**★ Does adding a cache change anything above the training run?**
No. The two variants are identical to the plain layered Dockerfile through the four `COPY` lines and
differ only in the last two instructions. That is a useful review heuristic: if a "cache-enabled"
Dockerfile differs higher up, something else was changed at the same time and should be justified
separately.

{/* FOOTER */}
