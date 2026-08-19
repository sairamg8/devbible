---
title: "The IoC container"
sidebar_label: "02 · The IoC container"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *The IoC
> Container*, *Container Overview*, *Bean Overview*, *Container Extension
> Points*, *Classpath Scanning and Managed Components* and *Java-based
> Container Configuration*
> (docs.spring.io/spring-framework/reference/core/beans/) — plus the Framework
> 6.1 deprecation of `CandidateComponentsIndex` and the Framework 7.0 addition
> of `FullyQualifiedConfigurationBeanNameGenerator`. Spring Boot 4.1.0, Spring
> Framework 7.0.x, JDK 25.

**Spring's container is a two-pass program that runs before your first request:
it reads metadata into `BeanDefinition` objects, lets you rewrite that metadata,
then instantiates the graph and lets you wrap each object on the way out. Almost
every question a Spring developer actually has — why is my bean null, why did my
`@Transactional` method not open a transaction, why does `@Value` see the wrong
value, why does the app start in nine seconds — is a question about *which pass
you are in* and *what the container handed you instead of your object*. The
annotations are learnable in an afternoon. This model is what makes them
debuggable.**

This topic runs to nine files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The inversion](01-the-inversion.md)** | What a bean actually is, the problem inversion of control solves stated without jargon, why a Spring codebase is shaped the way it is, and where the inversion stops paying for itself |
| 2 | **[The container and its metadata](02-the-container-and-metadata.md)** | `BeanFactory` vs `ApplicationContext` and which one you use, the three configuration dialects that produce one model, and the costs that belong to the container rather than to your code |
| 3 | **[Two phases: definition, then instantiation](03-the-two-phases.md)** | The single most useful fact about the container — what a `BeanDefinition` holds, `BeanFactoryPostProcessor` as phase one's hook, and why the split is exactly what makes auto-configuration possible |
| 4 | **[Instantiation and post-processors](04-instantiation-and-post-processors.md)** | `BeanPostProcessor`, the one extension point that explains proxies, and the initialisation callbacks in their documented order |
| 5 | **[Proxies and self-invocation](05-proxies-and-self-invocation.md)** | Why the injected reference is frequently not your object, JDK interface proxies vs CGLIB subclasses, and the one rule that explains every "my annotation did nothing" report |
| 6 | **[The stereotype annotations](06-the-stereotypes.md)** | `@Component`, `@Service`, `@Repository`, `@Controller` — what each really does beyond documentation value, meta-annotation as the useful part, and how to choose |
| 7 | **[Component scanning](07-component-scanning.md)** | The one rule scanning follows, how Boot's default scan root is derived, and the include/exclude filters |
| 8 | **[Bean names and the cost of scanning](08-names-and-scanning-cost.md)** | The default name generator and the collisions it produces, why bean names are part of your public surface, and why the classpath indexer is deprecated rather than the answer to slow startup |
| 9 | **[Configuration classes and `@Bean`](09-configuration-classes.md)** | Full mode vs lite mode, the interception that makes an inter-bean method call return the singleton, why Boot's own configurations use lite mode, and the restrictions the proxy imposes |

## Why this runs to nine files

- **The two-phase model is the load-bearing idea and everything else is a
  consequence of it.** Definitions, then instances. Post-processors get a chunk
  each because they hook different passes and confusing them is the source of
  the classic "my `BeanPostProcessor` is not being applied to that bean"
  problem.
- **Proxies deserve their own chunk because they are the number-one surprise.**
  The container hands you something that is not your object, and every AOP-based
  feature in Spring — transactions, caching, security, retry, async — inherits
  the same self-invocation limit. Teaching it once, precisely, means five later
  topics can point here instead of re-explaining it.
- **Declaring a bean and finding a bean are different subjects.** The
  stereotypes are about what you write; scanning, names and their costs are
  about what the container does with the classpath at startup. Splitting them
  keeps the startup-performance material from crowding out the design material.
- **`@Configuration` is genuinely strange Java** — a method call that does not
  execute its method body — and the full/lite distinction is invisible until it
  bites. It earns a chunk on its own.

## Where this connects

- **[Topic 03 — Dependency injection](../03-dependency-injection/README.md)** —
  this topic is the machinery that reads declarations and builds the graph; that
  one is about the declarations themselves and which injection style to use.
- **[Topic 04 — Bean scopes and lifecycle](../04-bean-scopes-lifecycle/README.md)**
  — chunk 4's initialisation callbacks are the front half of a bean's life;
  scope decides how many instances exist and when the callbacks fire.
- **[Topic 05 — Boot auto-configuration](../05-auto-configuration/README.md)** —
  auto-configuration is `BeanDefinition` metadata evaluated conditionally in
  phase one. Chunk 3 is the prerequisite for it making any sense.
- **[Topic 01 — Why frameworks: the servlet model](../01-why-frameworks-servlet-model/README.md)**
  — the container is built once at startup, before the first request reaches
  `DispatcherServlet`.
- **[Polymorphism and dispatch](../../phase-2-classes-objects/04-polymorphism-dispatch/README.md)**
  and **[Nested classes](../../phase-2-classes-objects/11-nested-classes.md)** —
  a CGLIB proxy is a generated subclass, so everything you know about
  overriding, `final` and virtual dispatch applies directly to why proxies fail
  on `final` and `private` methods.
- **[Annotation processing](../../phase-8-build-dependencies/09-annotation-processing/README.md)**
  — the contrast that makes Spring's model clear: Spring resolves at runtime,
  build-time DI frameworks resolve at compile time. Chunk 8's indexer story is
  the version of that argument Spring itself abandoned.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The inversion](01-the-inversion.md)
