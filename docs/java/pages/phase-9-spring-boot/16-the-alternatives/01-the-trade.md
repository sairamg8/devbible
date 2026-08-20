---
title: "The work Spring does at startup, and what it buys"
sidebar_label: "1 · The trade"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the Spring Framework reference *Core / IoC
> Container* and the Spring Boot reference *Ahead-of-Time Processing* and
> *Native Image* sections (docs.spring.io/spring-boot/reference/packaging/),
> the Quarkus *Writing your own extension* guide
> (quarkus.io/guides/writing-extensions), and the Micronaut user guide's
> *Inversion of Control* chapter (docs.micronaut.io/latest/guide/). Spring
> Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Every framework in this topic solves the same problem — turning annotated
classes into a wired-up application — and they differ on exactly one axis:
*when* that work happens. Spring does it when the process starts, using
classpath scanning, reflection and generated proxies. Quarkus and Micronaut do
it when the code is compiled, using annotation processors that emit ordinary
bytecode. That single choice explains every difference downstream: startup
time, resident memory, native-image friendliness, how libraries integrate, what
you can change with a config flag, and how hard it is to debug. If you can
state the trade in one sentence you can evaluate any of these frameworks
without reading a benchmark — and the sentence is: you are exchanging runtime
flexibility for startup time and footprint.**

## What Spring actually does between `main()` and the first request

This is not a vague "framework overhead". It is four concrete pieces of work,
each of which you have already met in this phase:

| Work | Where it is covered | Why it is inherently a runtime cost |
|---|---|---|
| **Component scanning** | [Topic 02 — The IoC container](../02-the-ioc-container/07-component-scanning.md) | The container reads class metadata for every candidate under your base packages, because it cannot know what is on the classpath until there *is* a classpath |
| **Condition evaluation** | [Topic 05 — Auto-configuration](../05-auto-configuration/03-class-conditions.md) | Every `@ConditionalOnClass`, `@ConditionalOnMissingBean` and `@ConditionalOnProperty` is a decision made at refresh, in order, against the live `Environment` |
| **Reflective injection** | [Topic 03 — Dependency injection](../03-dependency-injection/02-constructor-injection.md) | Constructors and fields are located and invoked reflectively; parameter names come from `-parameters` metadata read at runtime |
| **Proxy generation** | [Topic 02 — Proxies and self-invocation](../02-the-ioc-container/05-proxies-and-self-invocation.md) | `@Transactional`, `@Async`, `@Cacheable` and scoped beans are implemented by classes that do not exist until the JVM writes them |

Notice what these have in common. None of them is *waste*. Each is the direct
mechanical cost of a feature you use deliberately. Auto-configuration backing
off when you define your own bean is the single most useful thing Spring Boot
does, and it is only possible because the decision is deferred until the
container can see what beans exist. You cannot delete the cost without deleting
the feature.

## What "build-time DI" moves, and how

Quarkus and Micronaut run the *same* analysis, but they run it inside
`javac`, as an annotation processor, and write the answer out as source or
bytecode that becomes part of your artifact.

Concretely, where Spring reflects over a constructor at refresh time, Micronaut
generates a `BeanDefinition` class at compile time that calls the constructor
directly:

```java
// You write this.
@Singleton
public class OrderService {
    private final OrderRepository repository;
    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }
}
```

The annotation processor emits a companion class — a generated
`BeanDefinition` implementation — whose instantiate method is an ordinary
`new OrderService(...)` call with the dependency looked up from a precomputed
index. At runtime there is no scan, no reflective `Constructor.newInstance`,
and nothing to cache. The Micronaut guide states the design goals directly:
*"Use reflection as a last resort"*, *"Avoid runtime-generated proxies"*,
*"No runtime bytecode generation"*.

Quarkus does the same thing from the other end. Its build phase is called
**augmentation**, and the documentation names three phases: **augmentation**
(build-step processors scan annotations and descriptors and generate
bytecode), **static init** (code run from a static initializer — in a native
build this executes during compilation and the resulting state is serialised
into the executable), and **runtime init** (code run from the application's
main method at startup). The whole point of the design is to push as much as
possible from the third phase into the first.

## The trade, stated precisely

You are not trading "magic" for "no magic" — both models generate code you did
not write; one does it in `target/`, the other in the heap. What you actually
trade is **when a decision can be made**.

**What you give up by deciding at build time:**

- **Configuration that changes behaviour cannot be changed after the build.**
  Quarkus is explicit about this: build-time fixed properties are marked with a
  lock icon in its configuration reference, and *"it is not possible to change
  it at runtime"*. Starting a built artifact with different values produces a
  warning by default, controlled by
  `quarkus.config.build-time-mismatch-at-runtime`, which can be set to `fail`.
- **A library the framework does not know about is a much bigger problem.** In
  Spring, a library is just classes on the classpath; you write an
  `@Configuration` class and you are done. In Quarkus a library that needs
  build-time processing needs an *extension*, and one may not exist.
- **Profiles and conditions get weaker.** Spring's own native-image
  documentation says the quiet part out loud: under the closed-world
  assumption, *"beans defined in your application cannot change at runtime"*,
  `@Profile` has limitations, and properties that affect bean creation — the
  documentation names `@ConditionalOnProperty` and `.enabled` properties — are
  unsupported. That restriction is Spring adopting the build-time model, and it
  is exactly the restriction Quarkus and Micronaut live with permanently.

**What you get:**

- Startup measured in a fraction of the JVM-scanning equivalent, because the
  scanning already happened.
- Materially smaller resident memory, because the metadata structures the
  container would have built and held are not there.
- A codebase that GraalVM's static analysis can actually reason about — which
  is the real reason these frameworks are "native-image friendly". It is not
  that they added native support; it is that they never depended on the things
  native image forbids.

🔴 **Every one of those benefits is directional, not a number.** The size of
the win depends entirely on your dependency set, your bean count, your JDK,
your CPU and whether you are on a native image or a JVM. Anyone quoting you a
single startup figure for "Spring vs Quarkus" is quoting a benchmark of an
application that is not yours.

## The question the reader should actually be asking

Not "which framework is faster" but **"does my workload spend a meaningful
fraction of its life starting up?"** Three honest shapes:

- **A service that starts on Tuesday and is still running in March.** Startup
  cost is amortised to nothing. Footprint still matters if you run many
  replicas, but a few seconds of boot does not.
- **A function that scales to zero and is billed per invocation.** Cold start
  *is* the product. Here the build-time model is not an optimisation, it is a
  requirement — a user-facing request waiting on a container boot is a
  latency budget you cannot recover.
- **A deployment with a very high instance count.** Nobody notices the startup,
  but resident memory per instance multiplied by instance count is a line on an
  invoice. This is the case people forget, and it is the one where footprint
  wins on its own merits.

Chunk 6 turns this into an actual decision. The rest of the topic is what you
need to know about each option before you can make it.

## Gotchas

**⚠️ Treating "build-time DI" as a synonym for "native image"**
**Symptom:** A team concludes it cannot use Quarkus because it is not ready to
ship native binaries.
**Cause:** The two are correlated, not the same. Build-time augmentation makes
native image *possible*; it is not conditional on it.
**Fix:** Run Quarkus or Micronaut on the JVM. You keep the startup and
footprint benefit of having done the wiring at compile time, keep ordinary
debugging and JFR, and skip native image entirely. This is the default and it
is a perfectly good end state — see chunk 5 before assuming otherwise.

**⚠️ Assuming Spring's runtime work is fixable by configuration**
**Symptom:** Someone narrows `@ComponentScan` base packages and expects the
startup profile to change shape.
**Cause:** Scanning is real work and narrowing it does help, but condition
evaluation, reflective injection and proxy generation are proportional to the
number of *beans you actually create*, not to the scan surface.
**Fix:** Measure before optimising — use the conditions report
([Topic 05 chunk 7](../05-auto-configuration/07-the-conditions-report.md)) to
see how many auto-configurations are being evaluated, and exclude the
auto-configuration classes you genuinely do not use rather than trimming the
scan and hoping.

**⚠️ Reading "no reflection" as an absolute**
**Symptom:** A reader believes a Micronaut application contains zero reflective
calls anywhere.
**Cause:** The claim is about the *framework's own wiring*, not about your
dependencies. Jackson, JPA providers and logging frameworks reflect, and the
JDK reflects internally.
**Fix:** Read it as "the DI container does not need reflection to wire your
beans", which is the claim being made and the one that matters for both
startup and native-image analysis.

**⚠️ Expecting the build-time model to be free at build time**
**Symptom:** CI time goes up sharply after a migration and nobody accounted for
it.
**Cause:** The work did not disappear; it moved. Augmentation and annotation
processing happen on every compile, and a native compilation happens on every
release build.
**Fix:** Budget for it explicitly. Treat compile time as part of the trade —
you have moved a cost your users paid into a cost your developers pay, and
whether that is a good deal depends on how often each happens.

## Interview questions

**★ Why is Quarkus described as "native-image friendly" when Spring also supports GraalVM native image?**
Because friendliness here is about how much of the work GraalVM's closed-world
analysis has to be *told about* versus how much it can see for itself. Quarkus
and Micronaut resolve their wiring at build time into ordinary generated
bytecode, so a static analyser following calls from `main` reaches everything
naturally. Spring's classic model reaches the same beans through reflection and
generated proxies, which static analysis cannot follow, so Spring AOT has to
generate explicit bean-definition source plus JSON reachability hints to
reconstruct that picture. Both end up with a working native image; the
difference is that one is the framework's normal output and the other is a
substantial extra machinery layer that has to keep up with everything the
ecosystem does dynamically.

**★ What does Spring buy with all that runtime work — give a concrete feature that would be impossible without it.**
Auto-configuration back-off. `@ConditionalOnMissingBean` means a starter
provides a `DataSource` only if you have not defined one, and the decision has
to be made after the container knows every bean definition in the application,
which is inherently a runtime moment. The same machinery lets a single artifact
behave differently in three environments purely from properties, and lets you
drop a JAR on the classpath and have it configure itself. Every one of those is
a decision that depends on information that does not exist at compile time.

**★ If build-time DI is strictly better on startup and memory, why has Spring not simply adopted it?**
It partly has — Spring AOT does exactly this, generating bean definitions and
proxies at build time. But adopting it *by default* would mean adopting its
restrictions by default, and Spring's own native-image documentation lists them:
beans cannot change at runtime, `@Profile` is limited, and properties that
affect bean creation are unsupported. That is a breaking change to the
programming model for the entire ecosystem, to buy something most long-running
services do not need. Making it opt-in — you get it when you ask for AOT or a
native image — is the right shape for a framework with that much installed
base.

**★ A colleague says "we should move to Micronaut, our startup time is 8 seconds". What do you ask first?**
How often the service starts, and what that 8 seconds is actually made of. If
it restarts on deploy twice a week, 8 seconds costs nothing and a framework
migration costs months. And in my experience most of a large Spring service's
startup is not the container at all — it is connection pools warming, Flyway or
Liquibase running, caches priming, and a client doing service discovery. Those
costs move with you to any framework. I would want a startup profile before I
would want a migration plan.

**★ Where does the memory difference actually come from?**
Two places. The obvious one is the metadata the container builds and holds:
bean definitions, merged annotation metadata, the caches Spring keeps to avoid
re-reflecting. The less obvious one is class loading — a scan touches classes
that then stay loaded, and the framework's own infrastructure classes plus the
proxy classes generated per advised bean are all real footprint. A build-time
framework does not load a scanner it will never use again and does not generate
proxy classes at all, so both the transient peak and the steady-state floor are
lower.

**★ "Quarkus moves the work to build time" — is the work eliminated, or just moved?**
Moved, and it is worth being precise because the honest version of the pitch is
more persuasive than the marketing one. The analysis still has to happen; it
happens once, on a build machine, instead of on every process start. That is a
genuine win when a process starts thousands of times and a genuine loss when a
developer compiles fifty times a day and a release build now takes minutes.
Nothing about the physics changed — you moved a cost from your users' latency
budget into your team's feedback loop, and whether that is a good trade depends
entirely on which of those two events happens more often.

**★ Could a build-time framework implement auto-configuration back-off?**
Only in a weaker form, and the reason is structural rather than a matter of
effort. `@ConditionalOnMissingBean` needs to know the complete set of bean
definitions including everything the application itself contributed, which is
information that exists only once the container has been assembled. A build-time
framework can approximate it — Micronaut has `@Requires` and `@Replaces`, and
Quarkus resolves defaults during augmentation — because at build time it can see
your compiled sources and the classpath it was built against. What it cannot do
is defer the decision to something discovered after the artifact exists, and
that is exactly the case Spring's model is designed around.

---

← Index: [16 · The alternatives](README.md) · Next → [Quarkus: the build does the work](02-quarkus.md)
