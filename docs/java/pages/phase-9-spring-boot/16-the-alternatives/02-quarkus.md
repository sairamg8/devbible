---
title: "Quarkus: the build does the work"
sidebar_label: "2 · Quarkus"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the Quarkus guides *Writing your own extension*
> (quarkus.io/guides/writing-extensions), *Configuration Reference*
> (quarkus.io/guides/config-reference), *Quarkus Extension for Spring DI API*
> (quarkus.io/guides/spring-di), the Quarkus release page
> (quarkus.io/releases/) and the Quarkus 3.33 LTS announcement
> (quarkus.io/blog/quarkus-3-33-released/). Spring Boot 4.1.1 is the comparison
> baseline; JDK 25.

**Quarkus is not "Spring but faster" — it is a build tool that happens to
produce a running application. Its central invention is *augmentation*: a
compile-time phase in which extension code inspects your classes and your
dependencies and writes out bytecode that does at build time what a
conventional framework would do at boot. Everything a reader needs to
recognise about Quarkus follows from that: why it needs an extension per
library, why some configuration is frozen into the artifact, why its dev mode
can hot-reload so aggressively, and why native image is a first-class target
rather than a bolt-on.**

## Augmentation, and the three phases

The Quarkus documentation names three phases, and the names are worth learning
because the community uses them precisely:

| Phase | When it runs | What lives here |
|---|---|---|
| **Augmentation** | During the build, in the deployment module | Build-step processors scan annotations and descriptors and **generate bytecode** |
| **Static init** | From a static initializer. In a native build this runs *during compilation* and the resulting state is serialised into the executable | Things that can be fully computed without the deployment environment |
| **Runtime init** | From the application's main method at startup | Anything that must see the actual environment — open sockets, read secrets, connect |

A **build step** is a method annotated `@BuildStep` that consumes and produces
**build items**, which are the typed units of information extensions pass
between each other. A **recorder** is the bridge between build time and
runtime: it captures a method invocation made during augmentation and generates
bytecode that replays it later, so an extension author writes ordinary Java
instead of emitting bytecode by hand. In the documentation's words,
*"invocations made at deployment time get deferred until runtime."*

The consequence to internalise: **anything Quarkus can compute at build time,
it does, and the result is baked into the artifact.**

## The extension model, and the library with no extension

A Quarkus extension is two modules — a `deployment` module that runs at
augmentation time and a `runtime` module that ships with your application. This
is the piece that most often surprises a Spring developer, because it changes
what "adding a library" means.

In Spring, integrating a library is your problem and it is a small one: put it
on the classpath, write an `@Configuration` class, done. In Quarkus, a library
that needs any build-time processing — annotation scanning, reflective access,
proxying, resource registration — needs someone to have written build steps for
it.

🔴 **This is the real Quarkus adoption risk, and it is not about performance at
all.** The question to ask before a migration is not "is Quarkus fast" but
**"does every library we depend on have an extension, and is it maintained?"**
Check [the Quarkus extension registry](https://quarkus.io/extensions/) against
your actual dependency list before anything else. A library with no extension
is not necessarily unusable — plain JVM mode is forgiving, and a library that
does nothing dynamic often just works — but it will not be optimised, it may
need hand-written reachability metadata for native image, and you own that
maintenance forever.

## The DI model is CDI, not Spring's

Quarkus's container is **ArC**, and its programming model is **Jakarta CDI**
(the Spring DI guide records it as based on CDI 4.1). That means the
annotations and the semantics are Jakarta's:

```java
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class OrderService {

    private final OrderRepository repository;

    @Inject                       // constructor injection; the annotation is
    public OrderService(OrderRepository repository) {   // optional on a sole constructor
        this.repository = repository;
    }
}
```

Two differences from Spring that bite immediately:

- **Scopes are the vocabulary.** `@ApplicationScoped` is the workhorse, not
  `@Component`. `@Singleton` exists and is *not* the same thing —
  `@ApplicationScoped` beans are client proxies and are created lazily,
  `@Singleton` beans are not proxied.
- **Unused beans are removed at build time.** ArC deletes beans it can prove
  nothing injects. This is a build-time optimisation with a runtime
  consequence: a bean you only look up dynamically can vanish, and the fix is to
  mark it `@Unremovable`.

## Configuration that is frozen into the artifact

This is the sharpest edge in the whole framework and it follows directly from
augmentation. The configuration reference says *"some Quarkus configurations
only take effect during build time (compile), meaning it is not possible to
change it at runtime"*, and that such properties are **marked with a lock icon
(🔒)** in the options list.

They are still *readable* at runtime; they simply have no effect. If the values
present at startup differ from the ones the artifact was built with, Quarkus
reacts according to `quarkus.config.build-time-mismatch-at-runtime`:

```properties
# "warn" (the default) logs at start up; "fail" refuses to start
quarkus.config.build-time-mismatch-at-runtime=fail
```

The documentation also notes that native tests using
`@io.quarkus.test.junit.TestProfile` always run with that set to `fail`.

🔴 **Set it to `fail` in any environment you care about.** The default warns,
and a warning in a container log at 03:00 is a message nobody reads. A
build-time property that silently does nothing is the single most confusing
failure mode Quarkus has, because the property is present, correct-looking and
inert.

## Dev mode, and why it is genuinely different

`quarkus dev` (or `./mvnw quarkus:dev`) starts the application with live
reload: you change a source file, refresh the browser, and the change is there
without a restart. It works because Quarkus already owns the compile step —
augmentation reruns on the changed classes rather than the JVM reloading a
class it cannot redefine.

Two features that come with it and that Spring has no exact equivalent for:

- **Dev Services** — when Quarkus detects a datasource, broker or cache
  extension with no configured URL in dev or test, it starts a container for
  you. No `docker-compose.yml`, no test configuration.
- **Continuous testing** — tests re-run against the affected code as you type.

This matters to the argument more than it looks. A large part of the day-to-day
appeal of Quarkus is not the production numbers at all; it is the inner loop.

## Native image is the default target, not a mode

Quarkus was designed around GraalVM, so the closed-world restrictions that
Spring has to work around with AOT hints are restrictions Quarkus's extensions
were written under from the start. Producing a native binary is a build
property:

```bash
./mvnw package -Dnative
```

That does not make native image cheap — chunk 5 is the honest accounting — but
it does mean the framework and its extensions are not the part that breaks.

## The Spring compatibility layers are a bridge, not a destination

Quarkus ships extensions that accept Spring annotations —
`quarkus-spring-di`, `quarkus-spring-web`, `quarkus-spring-data-jpa` and
others. It is important to read what they actually claim. The guide states that
*"Spring classes and annotations are only used for reading metadata and / or
are used as user code method return types or parameter types."* There is no
`ApplicationContext`; nothing of Spring's infrastructure runs. ArC reads the
annotations and does its own thing.

The documented limitations make the boundary concrete: fallback bean-name
matching is not supported, only `List<Bean>` injection works (not `Set` or
`Map`), `@Autowired(required=false)` optional injection is unavailable, and
**`@Conditional` is ignored entirely** because DI is resolved at build time.

🔴 **That last one is the tell.** The compatibility layer cannot support
conditions, because conditions are the runtime-decision feature the whole
architecture exists to avoid. Treat these extensions as what the project says
they are: a way to move existing Spring code across without a rewrite on day
one. A codebase that stays on them permanently gets Spring's syntax with none
of Spring's semantics, which is the worst of both.

## Quarkus versions, as of writing

| | |
|---|---|
| Current LTS | **Quarkus 3.33 LTS**, released **25 March 2026**, supported until **25 March 2027** |
| Previous LTS | **3.27 LTS**, released **24 September 2025**, supported until **24 September 2026** |
| Cadence | LTS every **6 months**, maintained **12 months**; minor releases every **4–6 weeks** |

The 3.33 announcement describes it as bugfixes on top of 3.32 and points at the
3.28–3.32 line for features, where it records full Java 25 support and Project
Leyden integration arriving. ⚠️ Quarkus's minimum JDK is not stated on the
pages checked here — confirm it against the current *Getting Started* guide
rather than assuming it matches the JDK the release notes mention.

## Gotchas

**⚠️ A build-time property changed in the deployment manifest and nothing happened**
**Symptom:** You set a `quarkus.*` property in Kubernetes and the behaviour is
identical to before.
**Cause:** The property is fixed at build time (🔒 in the reference). It was
baked into the artifact during augmentation.
**Fix:** Rebuild with the value, and make the failure loud everywhere else:
`quarkus.config.build-time-mismatch-at-runtime=fail`.

**⚠️ A bean disappears in the built artifact but exists in your source**
**Symptom:** `UnsatisfiedResolutionException`, or a dynamically looked-up bean
is missing, only after packaging.
**Cause:** ArC's unused-bean removal proved nothing injects it.
**Fix:** Annotate it `@io.quarkus.arc.Unremovable`, or inject it somewhere
statically so the analysis can see the reference.

**⚠️ Porting a Spring service by adding the Spring extensions and expecting parity**
**Symptom:** `@Conditional` classes silently activate, `@Autowired(required=false)`
does not compile the way you expect, a `Map<String, Handler>` injection point
fails to resolve.
**Cause:** All three are on the documented unsupported list.
**Fix:** Read the compatibility guide's limitations section *before* estimating
the migration, and plan to convert to CDI annotations rather than to stay on
the bridge.

**⚠️ Confusing `@Singleton` with `@ApplicationScoped`**
**Symptom:** Injection of a bean into a component with a wider lifecycle behaves
unexpectedly, or a bean is created earlier than you wanted.
**Cause:** `@ApplicationScoped` uses a client proxy and creates lazily;
`@Singleton` does not and is eager relative to it.
**Fix:** Default to `@ApplicationScoped` and reach for `@Singleton` only when
you have a specific reason to avoid the proxy.

**⚠️ Assuming Dev Services behaviour in production**
**Symptom:** The application works locally with no database configuration and
fails in a deployed environment.
**Cause:** Dev Services only start containers in dev and test modes, precisely
when no URL is configured.
**Fix:** Configure the real datasource properties for the production profile —
the absence of configuration is a *feature* of dev mode, not a default.

## Interview questions

**★ Explain Quarkus's augmentation phase to someone who only knows Spring.**
It is the framework doing at compile time what Spring's `refresh()` does at
startup. Extension code — build steps — reads your annotated classes and your
dependencies during the Maven or Gradle build and generates bytecode that
already encodes the answers: which beans exist, how they wire together, what
needs reflection. At runtime there is far less to do, because the analysis is
already an artifact. The knock-on is that decisions made during augmentation
cannot be revisited later, which is why some configuration is fixed at build
time.

**★ Why does Quarkus need an "extension" for a library when Spring just needs the JAR on the classpath?**
Because Spring integrates a library at runtime, where it can reflect over it,
and Quarkus integrates it at build time, where somebody has to have written the
code that inspects it and generates the wiring. That code is the extension. The
practical consequence is that library support is a curated set rather than an
emergent property of the classpath, which is a strength for the libraries that
have extensions — they are optimised and native-ready — and a real constraint
for the ones that do not. It is the first thing I would check before proposing
Quarkus for an existing codebase.

**★ What is `quarkus.config.build-time-mismatch-at-runtime` and why would you change its default?**
It controls what Quarkus does when the build-time-fixed configuration present
at startup differs from the values the artifact was built with. The default is
`warn`, which logs and carries on. I would set it to `fail` in every deployed
environment, because the alternative is an application running with silently
inert configuration — the property is there, it looks correct, and it does
nothing. A start-up failure is a five-minute diagnosis; a warning nobody reads
is a week.

**★ Someone proposes adopting `quarkus-spring-di` so the team can keep writing Spring code. What is your view?**
It is a good migration aid and a bad destination. The extension reads Spring
annotations as metadata — no `ApplicationContext` exists and no Spring
infrastructure runs — so you get the annotation syntax with CDI semantics
underneath, and the gaps are documented: no `@Conditional`, no
`required=false`, no `Map` or `Set` injection, no bean-name fallback matching.
Those gaps are not oversights, they are consequences of build-time resolution.
So I would use it to get a large codebase compiling quickly, then plan the
conversion to CDI annotations as real work, because a team that stops halfway
has to know both models and can rely on neither.

**★ Is the dev-mode experience actually relevant to a framework choice, or is it a nice-to-have?**
I think it is genuinely relevant and usually undersold. Live reload without a
restart, plus Dev Services starting your database container automatically, plus
continuous testing, changes the length of the edit-test loop, and that loop is
where developer time actually goes. It is not a *production* argument, so it
should not be presented as one — but if two frameworks are otherwise close for
a greenfield service, the inner loop is a legitimate tiebreaker and a more
honest one than a startup benchmark.

---

← Prev: [The trade](01-the-trade.md) · Index: [16 · The alternatives](README.md) · Next → [Micronaut](03-micronaut.md)
