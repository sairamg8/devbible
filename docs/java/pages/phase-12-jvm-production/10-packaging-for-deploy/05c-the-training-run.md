---
title: "The training run belongs in the image build and nowhere else, because that is the only place where the application and the JDK are both frozen — and once it is there, the remaining risk is that the archive is silently doing nothing, which only a log assertion can rule out"
sidebar_label: "05c · The training run"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference**, "Packaging → AOT Cache"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot-cache.html),
> documented at 4.1.x) and "Packaging → Efficient Deployments"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html)); and
> the **JDK 25 `java` tool reference** for `-Xshare` and the class-load logging example
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> 🔴 **No sandbox** — the one line of log output shown below is **quoted from the `java` tool
> reference's own example** and is attributed as such; nothing here was executed. JDK 25 · Spring
> Boot 4.1.0 / Spring Framework 7.0.9.

**[05b](05b-creating-a-cds-archive.md) established that every archive comes from a trial run. This
chunk answers the two questions that decide whether that trial run is an asset or a liability:
where it happens, and how you know the resulting archive is being used. The second question matters
more than it should, because the failure is completely silent — Spring Boot's documentation says a
misused cache file has *"no effect"*, and that is exactly what it looks like from the outside.**

## Where the training run happens

There are three candidate places and only one of them survives review.

| Where | What goes wrong |
|---|---|
| A developer's machine, archive committed to the repository | The archive is tied to a JDK build and a class list. Nobody regenerates it after a dependency bump, and nothing tells you. It rots in place |
| At container start, before the real start | You pay the training run on every single start — which is the cost you were trying to remove — and you need a writable path |
| **In the image build, after the jar is copied in** | **Nothing.** This is the answer |

The usual argument for the third row is "don't pay it at runtime". The **better** argument is
validity. Spring Boot states the reuse condition for the archive as being good *"as long as the
application is not updated"* — and for the AOT cache, *"as long as the application is not updated and
the same Java version is used."*

🔴 **An in-image training run satisfies that condition by construction.** Inside the build, the
application jar and the JDK are both already fixed; neither can change without producing a different
image. The archive therefore cannot go stale while the image exists. That is a structural guarantee,
not a process you have to remember to follow — which is why [02d](02d-the-cache-variants-of-the-dockerfile.md)
puts a `RUN` line between the `COPY` and the `ENTRYPOINT` rather than a note in a README.

## Spring Boot's training run, line by line

```bash
java -Djarmode=tools -jar my-app.jar extract --destination application
cd application
java -XX:ArchiveClassesAtExit=application.jsa -Dspring.context.exit=onRefresh -jar my-app.jar
```

and then, in production:

```bash
java -XX:SharedArchiveFile=application.jsa -jar my-app.jar
```

Each line is doing precise work:

1. **`extract` first.** This is a requirement, not an optimisation — see the next section. It is the
   same `tools` jar mode from [02b](02b-extracting-layers-and-the-image-cache.md), and it produces
   the layout the Boot reference calls *"AOT cache (and CDS) friendly"*.
2. **`cd application`.** The run happens *in* the extracted directory, against the extracted jar,
   not against the uber jar you started with.
3. **`-Dspring.context.exit=onRefresh`** stops the application the moment the Spring context has
   refreshed. That captures the class loading of context creation — auto-configuration, bean
   definitions, proxy generation, the servlet container's own initialisation — which is where the
   overwhelming majority of a Boot application's start-up class loading is. Crucially, it gets you
   there **without** serving a request, binding a listener socket, or requiring a database to exist
   in your build environment.
4. **`-XX:ArchiveClassesAtExit`** writes on exit, which is precisely why step 3 has to make the
   process exit at all. The two flags are a pair.

⚠️ **What the training run does *not* capture is anything initialised lazily on first request.** A
subsystem that only wakes up when a particular endpoint is called contributes nothing to the
archive. If a large chunk of your start-up cost is deferred to the first request, consider whether
`onRefresh` is the right exit point for you — and measure, rather than assuming the default
recipe is optimal for an unusual application.

## The silent no-op

This is the single most valuable sentence in the entire CDS and AOT-cache story, and it appears in
Spring Boot's documentation for both mechanisms:

> *"You have to use the cache file with the extracted form of the application, otherwise it has no
> effect."*

🔴 **No effect. Not an error. Not a warning. Not a log line.** Point `-XX:SharedArchiveFile` at a
perfectly good archive while launching the uber jar and every command succeeds, the application
starts normally, start-up time is unchanged, and there is nothing anywhere to tell you.

The mechanism behind it is [01](01-the-fat-jar.md)'s: in an uber jar the classes are loaded from
nested entries by Boot's own loader, and the archive was built against the extracted layout's
classpath. Different classpath, no match, nothing shared.

This is why extraction and archiving are **one design decision**, not two independent optimisations
that happen to appear in the same Dockerfile. A team that adopts the archive without the extraction
has added a build step, an image artefact and a flag, and changed nothing about their service.

## Proving the archive is used

The tool reference gives both the command and, in its own example, the output to look for:

```bash
java -XX:SharedArchiveFile=hello.jsa -cp hello.jar -Xlog:class+load test.Hello
```

> *"The output of this command should contain the following text:*
> *`[info][class,load] test.Hello source: shared objects file`"*

🔴 **`source: shared objects file` is the string that proves it.** Because the failure mode is
silent, an automated assertion is the only real defence:

1. In CI, start the built image with `-Xlog:class+load` added via `JDK_JAVA_OPTIONS`
   ([03d](03d-distroless.md)) so you do not have to modify the entrypoint.
2. Assert that at least one **application** class — not just a JDK class, which the default archive
   would cover anyway — reports `source: shared objects file`.
3. Fail the build if it does not.

That check costs one container start per build and it is the difference between an archive that
works and an archive that has been decorative since the second sprint.

⚠️ **Do not implement this check with `-Xshare:on`.** The instinct is right — make it loud — but the
tool reference explicitly rules that flag out of production: *"This option is used for testing
purposes only… should not be used in production environments."* Loudness belongs in CI; production
stays on `auto` and relies on the CI gate having already run.

## Regenerate unconditionally

The training run costs **build** time, not runtime. Making it conditional — "only regenerate when
dependencies change" — is an optimisation of the cheap thing that eventually ships a stale archive,
and a stale archive is not slower, it is *silently absent*, which is worse than slower because
nobody investigates.

The same argument applies to caching the archive between CI runs. If the cache key is wrong in a way
nobody notices, the failure is invisible. Rebuild it every time; the training run for a Boot
application is a context refresh, not a load test.

## Gotchas

**★ Using the archive with the uber jar is a silent no-op.** *"You have to use the cache file with
the extracted form of the application, otherwise it has no effect."* Extract, train in the extracted
directory, run the extracted jar. All three, or none.

**★ An archive built on a laptop and committed to the repository will rot.** It is tied to a JDK
build and a class list, nobody regenerates it after a dependency bump, and its uselessness is
invisible. Build it in the image build or do not build it.

**★ A training run at container start defeats the purpose.** You pay the trial run every time, and
you need a writable path in an image you have just made read-only
([03e](03e-non-root-and-filesystem.md)).

**★ `-Dspring.context.exit=onRefresh` archives context creation, not request handling.** Anything
that initialises lazily on first request is not in the archive. Usually fine; worth knowing before
you conclude the archive "did not help".

**★ `-XX:ArchiveClassesAtExit` and an exit trigger are a pair.** Without something making the
process exit, nothing is written. Without the archive flag, the exit is pointless. Neither is useful
alone, and a Dockerfile that has one and not the other produces no archive and no error.

**★ Verify with `-Xlog:class+load`, never with `-Xshare:on`.** Grep for
`source: shared objects file`. The tool reference forbids `-Xshare:on` in production; a CI-only
assertion satisfies the same instinct without the production risk.

**★ Assert on an *application* class, not any class.** The default archive already covers about 1300
core library classes ([05](05-class-data-sharing.md)), so a grep that matches a `java.lang` class
proves only that CDS is on — which it was before you did anything.

**★ Conditional regeneration is a false economy.** The training run costs build time. A stale archive
costs a silent regression. Regenerate on every build.

**★ The archive must not be writable at runtime.** [05](05-class-data-sharing.md) quotes the tool
reference: archives *"cannot be modified without proper authorization."* Build-time creation plus a
read-only root filesystem gives you that for free — one of the rare cases where two hardening
measures reinforce rather than fight each other.

**★ A training run needs the application to start, which means it needs its configuration.** A Boot
application whose context cannot refresh without a database URL, a config server or a secret will
fail the training run inside the build. `onRefresh` avoids needing a *live* database, but it does
not avoid needing the properties. Plan a build-time profile with inert values rather than
disabling the training run.

**★ If start-up is dominated by something other than class loading, no archive helps.** Connection
pool warm-up, schema validation, remote configuration fetches and TLS handshakes are unaffected by
any archive. Measure where the time goes before optimising it — [05f](05f-when-the-cache-helps.md).

## Interview questions

**★ Where should a CDS or AOT-cache training run happen, and why is that not merely about speed?**
In the image build, after the application jar is copied in. The speed argument is that you do not
pay the trial run at container start. The stronger argument is validity: Spring Boot documents the
archive as reusable *"as long as the application is not updated and the same Java version is used"*,
and inside an image build neither can change without producing a new image — so the archive cannot
silently go stale. It is a structural guarantee rather than a process discipline.

**★ What does `-Dspring.context.exit=onRefresh` do and why is it necessary?**
It exits the application as soon as the Spring context has refreshed. It is necessary for two
reasons. `-XX:ArchiveClassesAtExit` writes the archive at exit, so the process must exit. And you
want the class loading of context creation without needing a bound port, a live database or a real
request in your build environment.

**★ A colleague reports that their CDS archive produces no improvement. What do you check, in
order?**
First, whether it is used at all: run with `-Xlog:class+load` and look for the documented
`source: shared objects file` against an application class. The most common cause is launching the
uber jar rather than the extracted form, which Boot documents as having *"no effect"* — silently.
Second, whether the training run covered the expensive paths. Third, whether class loading is
actually the dominant start-up cost; often it is not.

**★ Why not simply use `-Xshare:on` so a broken archive fails loudly?**
Because the tool reference says it is *"used for testing purposes only"* and *"should not be used in
production environments"* — the archive can become unusable for benign reasons and this flag turns
that into a start-up crash. The right shape is a CI gate that asserts on `-Xlog:class+load` output,
with production left on `auto`.

**★ Why is extraction a requirement rather than an optimisation once you use an archive?**
Because the archive is built against the extracted layout's classpath, and in an uber jar the
classes are loaded from nested entries by Boot's loader. The classpaths do not match, so the archive
is not used. Spring Boot states it flatly: it *"has no effect"*. Extraction and archiving are one
design decision.

**★ Should the archive be regenerated on every build?**
Yes. It costs build time, not runtime, and the training run for a Boot application is a context
refresh rather than a load test. Conditional regeneration optimises the cheap thing and risks
shipping a stale archive whose only symptom is the absence of an improvement nobody is measuring.

**★ Your training run fails in CI because the application cannot connect to the database. What is the
right fix?**
A build-time Spring profile with inert configuration, so the context can refresh without external
dependencies — not disabling the training run, and not standing up a database in the image build.
`onRefresh` already avoids needing a live database for most applications; what it does not avoid is
needing valid *properties*, and that is a configuration-management problem, which is
[08](08-configuration-at-deploy-time.md).

{/* FOOTER */}
