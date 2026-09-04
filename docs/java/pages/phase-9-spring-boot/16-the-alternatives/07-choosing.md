---
title: "Spring's answer, and how to choose without a benchmark"
sidebar_label: "7 · Choosing"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the Spring Boot reference *Ahead-of-Time
> Processing With the JVM*, *Class Data Sharing* and *AOT Cache*
> (docs.spring.io/spring-boot/reference/packaging/), **JEP 483 —
> Ahead-of-Time Class Loading & Linking** (JDK 24) and **JEP 515 —
> Ahead-of-Time Method Profiling** (JDK 25) at openjdk.org/jeps/, and the
> Spring Framework reference on virtual threads. Spring Boot 4.1.1, Spring
> Framework 7.0.x, JDK 25.

**The comparison articles stop before the interesting part. Yes, Spring's
runtime model costs startup and footprint, and yes, build-time DI removes much
of that cost — but Spring did not stand still, and the platform underneath it
moved further. Spring AOT reproduces most of the build-time model inside
Spring; CDS and the JDK's AOT cache recover a large fraction of the startup
cost *without asking you to give up anything at all*; and virtual threads
neutralise the other historical reason to leave. The honest 2026 answer is that
the gap is much narrower than the framing suggests, and that the deciding
factors are usually organisational rather than technical.**

## Spring's answer, in three parts

### 1. Spring AOT on the plain JVM

Spring AOT is not only for native image. The same generated bean definitions
run on a stock JVM:

```bash
mvn -Pnative package                          # produces the AOT-processed jar
java -Dspring.aot.enabled=true -jar myapplication.jar
```

🔴 **But it comes with the closed-world restrictions attached**, and that is the
crucial detail people miss. Spring's own documentation lists the same
limitations for AOT-on-the-JVM as for native image: the classpath is fixed at
build time, beans cannot change at runtime, `@Profile` is limited, and
properties that affect bean creation — `@ConditionalOnProperty`, `.enabled`
flags — are unsupported. You are opting into the build-time model. That is a
legitimate choice; it is just not a free one.

### 2. CDS and the AOT cache — the option with no restrictions

This is the one to reach for first, and it is dramatically underused. Both
work by doing a **training run** that exits as soon as the context refreshes,
then reusing the result:

```bash
# Extract first — both features need the application in extracted form
java -Djarmode=tools -jar my-app.jar extract --destination application
cd application

# CDS (pre-Java-25): produces a .jsa archive
java -XX:ArchiveClassesAtExit=application.jsa -Dspring.context.exit=onRefresh -jar my-app.jar
java -XX:SharedArchiveFile=application.jsa -jar my-app.jar

# AOT cache (Java 25+, JEP 483): produces a .aot cache
java -XX:AOTCacheOutput=app.aot -Dspring.context.exit=onRefresh -jar my-app.jar
java -XX:AOTCache=app.aot -jar my-app.jar
```

`-Dspring.context.exit=onRefresh` is the piece that makes this practical: the
training run initialises the context and stops, so it *"does not require
starting the beans or having access to the remote services for most use
cases"*. Spring Boot's position is explicit — it supports both and
**recommends the AOT cache whenever the JVM version allows it**.

The JDK side is Project Leyden's work: **JEP 483 (JDK 24)** caches classes in a
loaded and linked state; **JEP 515 (JDK 25)** extends that cache to carry method
profiles, so production runs both start faster *and* reach peak performance
sooner.

> 📊 **Quoted figures, attributed.** JEP 483's own text reports Spring
> PetClinic starting in **2.604 seconds on JDK 24** with an AOT cache, a **42%**
> improvement over JDK 23; JEP 515 reports a **19%** improvement on its example
> program, with the profile data adding about **250 KB (≈2.5%)** to the cache.
> These are the JEPs' measurements of their own benchmarks on their own
> hardware. They are quoted here to show the *order* of the effect, and they say
> nothing about your application.

🔴 **The reason this matters more than Spring AOT: the AOT cache imposes none of
the closed-world restrictions.** Your conditionals still work, profiles still
work, the classpath is still dynamic. You add two flags and a training step to
your image build and give up nothing. If someone opens a "should we move to
Quarkus for startup time" discussion, this is the first question — *have you
tried the AOT cache?* — and it is very often the last one too.

### 3. Virtual threads close the other door

The historical second reason to leave Spring was concurrency: thread-per-request
on platform threads did not scale, so teams went reactive or went elsewhere.
`spring.threads.virtual.enabled=true` removes that premise, and the full
argument is in
[Topic 15 chunk 11](../15-webflux-reactive/11-why-virtual-threads-changed-the-answer.md)
and
[Topic 01 chunk 6](../01-why-frameworks-servlet-model/06-living-with-virtual-threads.md).
It is also, as chunk 4 covered, the same bet Helidon 4 made — so on that axis
Spring and Helidon now agree, and the axis is no longer a differentiator.

## The decision, by workload

| Your situation | The answer, and why |
|---|---|
| Long-running service, restarts on deploy | **Spring.** Startup amortises to nothing. Add the AOT cache if you want the boot faster anyway |
| Serverless / scale-to-zero / billed per invocation | **Build-time DI is a real requirement**, and native image likely too. Cold start is user-visible latency you cannot recover |
| Very high instance count, footprint × instances is a budget line | **Worth measuring seriously.** Footprint stands on its own; try the AOT cache first, then evaluate Quarkus or Micronaut on the JVM before native |
| A CLI tool | **Native image**, easily. Almost every cost in [chunk 6](06-what-native-image-costs.md) evaporates for a short-lived process |
| Startup is 30s and everyone is unhappy | **Profile it first.** Most large-service startup is pools warming, migrations running and caches priming — costs that travel with you to any framework |
| Existing Jakarta EE / MicroProfile investment | **Quarkus or Helidon MP.** The CDI and MicroProfile model is what the team already knows; Spring would be the retraining cost, not the other way round |
| Team is entirely Spring, with internal starters | **Spring**, and this is a real reason — see below |

## The organisational argument, which engineering comparisons omit

🔴 **"Everyone we hire knows Spring" is a legitimate technical argument, not a
cop-out.** So is "we have fourteen internal starters, a shared security
configuration and a platform team that supports Spring". Framework choice is a
decision about the whole cost of running software, and that cost includes:

- **The hiring pool.** Spring experience is close to a default for Java
  developers; the others are a smaller pool and a longer ramp.
- **Internal libraries.** An organisation's own auto-configuration, shared
  starters and conventions are usually its largest undocumented asset, and they
  do not port.
- **The long tail of answers.** Fifteen years of Stack Overflow, books and blog
  posts is a real operational advantage at 03:00.
- **Support and procurement.** Commercial support arrangements and approved
  vendor lists decide more architecture than architects do.
- **The blast radius of being wrong.** Being an unusual shop in a mainstream
  ecosystem is cheap to reverse; being the only team on an unusual stack is not.

None of this says "never change". It says the change has to buy something
proportionate, and "startup is 4 seconds instead of 1" for a service that
starts weekly is not proportionate.

## How to argue this without a benchmark

Because you will not have a trustworthy one, and neither will they.

1. **Ask what the workload actually is.** Restart frequency, instance count,
   whether a user ever waits on a boot. Two of those three questions usually
   end the discussion.
2. **Argue from mechanism, not from numbers.** "Scanning and reflective wiring
   happen at startup, so removing them makes startup faster" is unarguable.
   "Framework X starts in 0.3 seconds" is a fact about someone else's laptop.
3. **Name the cost side explicitly.** Build-time-fixed configuration,
   extension availability, a JDK 25 baseline, closed-world restrictions, a
   second CI target. A comparison that lists only benefits is marketing.
4. **Reach for the cheap option first.** The AOT cache costs two flags and a
   training step and imposes no restrictions. Exhaust that before proposing a
   rewrite.
5. **If you must have a number, generate it from your own service**, on your own
   hardware, with your own dependency set — and say plainly that it is not
   transferable to anyone else's.

## Gotchas

**⚠️ Enabling `spring.aot.enabled=true` and being surprised by broken conditionals**
**Symptom:** A property-driven feature flag stops removing a bean, on the plain
JVM, with no native image anywhere in sight.
**Cause:** AOT-on-the-JVM carries the *same* documented restrictions as native:
fixed classpath, beans fixed at build time, `@Profile` limited,
`@ConditionalOnProperty` unsupported.
**Fix:** Use the AOT cache instead if what you wanted was startup — it has none
of those restrictions — and only enable `spring.aot.enabled` when you have
actually audited your conditionals.

**⚠️ Building the CDS or AOT archive from the un-extracted jar**
**Symptom:** The archive is produced but startup does not improve.
**Cause:** Spring Boot's documentation states the cache must be created and used
with the application in **extracted** form to be effective.
**Fix:** Run `java -Djarmode=tools -jar my-app.jar extract --destination
application` first, and do both the training run and the production run from
there.

**⚠️ A stale archive after a deploy**
**Symptom:** Startup regresses quietly, or the JVM ignores the archive.
**Cause:** The archive is only valid while the application is unchanged, and the
AOT cache additionally requires the same Java version.
**Fix:** Generate the archive as a step in the image build so it is rebuilt with
every artifact — never as a one-off produced by hand and copied forward.

**⚠️ Comparing a native binary against a cold JVM and calling it a framework result**
**Symptom:** A decision justified by a comparison that measures two different
things.
**Cause:** JVM startup, class loading, container refresh and JIT warmup are
separate costs, and a native-versus-JVM chart bundles them all into the
framework's column.
**Fix:** Compare like with like — Spring with the AOT cache against Quarkus on
the JVM, or Spring native against Quarkus native — and state which pair you
measured.

**⚠️ Treating "we should use X" as a technical question only**
**Symptom:** A migration that is technically sound and organisationally
impossible.
**Cause:** Hiring, internal libraries, platform-team support and vendor
contracts were not counted.
**Fix:** Put them in the comparison explicitly and give them weight. A framework
nobody on the team can operate at 03:00 is slower than a slow one.

## Interview questions

**★ Has Spring closed the startup gap with Quarkus and Micronaut?**
Substantially, and by two different mechanisms that are worth separating.
Spring AOT reproduces the build-time model — generated bean definitions,
generated proxies — and can run on a plain JVM with `spring.aot.enabled=true`,
but it brings the closed-world restrictions with it, so you pay in flexibility.
The AOT cache is the more interesting one, because it is a JVM feature rather
than a Spring feature: a training run caches classes loaded and linked, JDK 25
adds method profiles on top, and you keep every dynamic capability you had. So
the gap is narrower and, more importantly, part of the improvement is now
available without adopting anyone's restrictions.

**★ What is `-Dspring.context.exit=onRefresh` and why does it exist?**
It tells a Spring Boot application to exit as soon as the application context
has refreshed. It exists to make CDS and AOT-cache training runs practical: you
want the JVM to load and link the classes an ordinary startup would, but you do
not want to open listening sockets, connect to a database or reach a remote
service just to produce an archive. Spring's documentation says this
specifically — the training run does not require starting the beans or having
access to remote services in most cases — which is what lets the archive be
generated inside a container image build.

**★ When would you actually recommend leaving Spring?**
When cold start is the product. Serverless, scale-to-zero, per-invocation
billing — anywhere a real user request waits on a process boot, the build-time
model is a requirement rather than an optimisation, and I would take Quarkus or
Micronaut, probably natively compiled. I would also recommend it where the
organisation is already a Jakarta EE or MicroProfile shop, because then Spring
is the retraining cost. And I would recommend it for a CLI, where native image
wins on distribution as well as speed. For a long-running HTTP service in a
Spring shop, almost never.

**★ Your CTO read that Quarkus starts in a fraction of the time and wants a migration plan. How do you respond?**
By agreeing with the fact and questioning the inference. The startup difference
is real and it comes from a real mechanism — the wiring happens at compile time
instead of at boot. Then I would ask three things: how often does the service
restart, does a user ever wait for a boot, and how many instances do we run.
For a service that restarts on deploy, the startup saving has no user and no
cost attached to it, and I would offer the AOT cache as the ten-minute version
of what he actually wants. If footprint across a large fleet turns out to be
the real driver, that is a legitimate case and I would measure it — but I would
measure Quarkus on the JVM first, because that gets most of the benefit without
native image's costs.

**★ Is "our team only knows Spring" a good reason to stay on Spring?**
Yes, and I would not apologise for it. Framework choice is a decision about the
total cost of building and operating software, and the ability to hire, the
internal starters and shared configuration a platform team has built, the depth
of available answers when something breaks at 03:00, and support arrangements
are all real components of that cost. What it is not is a reason to avoid the
analysis — if the workload is serverless and cold start is user-visible, the
organisational argument loses, and it should. The failure mode is using it to
avoid ever looking, not using it as one input among several.

**★ Someone shows you a chart where a native binary starts 50 times faster than a Spring Boot jar. What is wrong with the chart?**
Probably not the measurement, but certainly the conclusion. It bundles JVM
startup, class loading, container refresh and JIT warmup into one bar and
attributes the whole difference to the framework, so it cannot tell you how much
of the gap a JDK feature such as the AOT cache would close on its own. It also
tells you nothing about steady-state throughput, where a JIT-compiled JVM has
advantages a statically compiled binary does not. The chart answers "how fast
does this process reach its first request", which is the right question for a
serverless function and close to irrelevant for a service that has been running
since Tuesday.

## Where this leaves you

You should now be able to state the trade in one sentence — build-time wiring
buys startup and footprint by giving up runtime flexibility — name what each
framework actually does differently, describe honestly what native image costs,
and know that the JVM's own AOT cache is the cheapest answer to the problem most
people are trying to solve. That is enough to hold the conversation, and enough
to know when it is not worth having.

Phase 9 ends here.
[Phase 12 — The JVM in production](../../phase-12-jvm-production/README.md)
picks up the AOT/CDS and native-image threads from the operations side.

---

← Prev: [What native image costs](06-what-native-image-costs.md) · Index: [16 · The alternatives](README.md)
