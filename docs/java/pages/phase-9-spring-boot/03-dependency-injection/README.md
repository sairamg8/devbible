---
title: "Dependency injection"
sidebar_label: "03 · Dependency injection"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Dependency
> Injection* and *Constructor-based or setter-based DI*, *Using `@Autowired`*,
> *Fine-tuning Annotation-based Autowiring with Qualifiers* and *Bean Scopes*
> (docs.spring.io/spring-framework/reference/core/beans/) — and the **Spring
> Boot 2.6 release notes** for the prohibition of circular references by
> default. `@Fallback` is Framework 6.2+. Spring Boot 4.1.0, Spring Framework
> 7.0.x, JDK 25.

**Dependency injection is a plain-Java design constraint — a class never
constructs its own collaborators — and Spring is only the thing that honours it
at the one edge where somebody finally has to. The whole payoff is a single
line: `new InvoiceService(stub, inMemoryRepo)` in a test, with no container and
no framework on the classpath. Every argument in this topic, including the
famous one about field injection, reduces to whether a given style still lets
you write that line.**

This topic runs to ten files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What DI buys](01-what-di-buys.md)** | The constraint stated without a framework, what "inversion of control" inverts, the composition root, why wiring mistakes become startup failures, and what DI actually costs |
| 2 | **[Constructor injection is the default](02-constructor-injection.md)** | Why `@Autowired` is unnecessary on a sole constructor and required with several, and the Spring team's three claims — immutable components, non-null requirements, fully initialised on return — argued separately |
| 3 | **[Setters, `@Value` and records](03-setters-values-records.md)** | Setter injection's one documented use (optional *with a default*) and the JMX re-injection case, `@Value` and why it is not configuration, records as beans, and the verbosity trade |
| 4 | **[Why field injection is flagged](04-field-injection.md)** | The four checks it removes — constructibility, the dependency-count signal, `final`, null-safety analysis — the window where fields are genuinely null, the one place it is forced, and the arguments people make for it |
| 5 | **[Resolving ambiguity: narrowing the type match](05-resolving-ambiguity.md)** | `NoUniqueBeanDefinitionException`, `@Qualifier` as *narrowing not naming*, the bean-name fallback and its `-parameters` requirement, and generic type arguments as the one implicit qualifier the compiler checks |
| 6 | **[`@Primary`, `@Fallback` and custom qualifiers](06-primary-fallback-and-custom-qualifiers.md)** | Moving the choice to the definition: `@Primary` as a real default rather than a way to silence an error, `@Fallback` and the library-override problem it fixes, why `@Priority` is not available on `@Bean` methods, and compiler-checked qualifier annotations |
| 7 | **[Collections, ordering and self-injection](07-collections-and-ordering.md)** | `List`/`Set`/`Map<String,T>` injection, qualifiers as filters, `Ordered` vs `@Order` vs `@Priority`, the fact that `@Order` does **not** affect creation order, and self-injection as the documented last resort |
| 8 | **[Optional, plural and deferred](08-optional-and-deferred.md)** | The four ways to say "might not be there" and how they really differ, JSpecify `@Nullable`, and `ObjectProvider` — `getIfAvailable` vs `getIfUnique`, `stream` vs `orderedStream` — as the reason `getBean()` never belongs in your code |
| 9 | **[Circular dependencies](09-circular-dependencies.md)** | Why constructor injection makes a cycle logically impossible rather than merely discouraged, what setter injection pays to allow it, Boot's prohibit-by-default since 2.6, and why `@Lazy` is not a fix |
| 10 | **[Breaking the cycle](10-breaking-the-cycle.md)** | The three real moves — extract the shared collaborator, invert with an application event, defer with `ObjectProvider` — the `@Configuration`-to-`@Configuration` case, and how to locate the offending edge when the ring is large |

## Why this runs to ten files

- **The recommendation and the argument for it are different lengths.** "Use
  constructor injection" is one sentence; *why* it is the only style that uses
  the type system takes a chunk, and *why field injection is flagged* takes
  another, because each of the four things it costs is a separate mechanism —
  constructibility, the design signal, `final` and the memory model, and
  static analysis.
- **Ambiguity and plurality are opposite readings of the same situation.** Two
  beans of one type is an error when you asked for one and the answer when you
  asked for all of them, and `@Qualifier` behaves differently in each case
  because it narrows rather than names. Splitting them keeps that distinction
  visible instead of burying it in a list of annotations.
- **Narrowing at the injection point and choosing a default at the definition
  are different decisions.** Chunk 5 is about a consumer saying which one it
  wants; chunk 6 is about a bean declaring what everyone gets by default. They
  are frequently taught as one list of annotations, which is how `@Primary`
  ends up being used to silence an ambiguity error nobody read — the error was
  the last chance to ask which implementation each consumer meant.
- **Circular dependencies are a design topic wearing an error message.** One
  chunk establishes that the failure is genuine and not a container policy;
  the other is entirely about what to do, because "extract the third class" is
  the actual answer and it deserves more room than the `@Lazy` workaround it
  replaces.

## Where this connects

- **[Topic 02 — The IoC container](../02-the-ioc-container/README.md)** — this
  topic is about the *declarations*; that one is about the machinery that reads
  them and builds the graph.
- **[Topic 04 — Bean scopes and lifecycle](../04-bean-scopes-lifecycle/README.md)**
  — injection decides what a bean receives, scope decides how many of it there
  are and when the callbacks run. The prototype-into-singleton trap lives there
  and is the main reason `ObjectProvider` exists.
- **[Topic 06 — Configuration and profiles](../06-configuration-and-profiles/01-the-environment-and-precedence.md)**
  — where `@Value` stops being adequate and typed `@ConfigurationProperties`
  takes over.
- **[Immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)**
  and **[the Java memory model](../../phase-6-concurrency/05-java-memory-model/README.md)**
  — the `final`-field argument in chunk 2 is not aesthetic; singletons are shared
  across every request thread, so the freeze guarantee is doing real work.
- **[Polymorphism and dispatch](../../phase-2-classes-objects/04-polymorphism-dispatch/README.md)**
  — after startup an injected collaborator is an ordinary reference and a call
  through it is an ordinary virtual call.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [What DI buys](01-what-di-buys.md)
