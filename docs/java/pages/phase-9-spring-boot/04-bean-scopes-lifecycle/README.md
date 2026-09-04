---
title: "Bean scopes and lifecycle"
sidebar_label: "04 · Bean scopes and lifecycle"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Bean Scopes*
> and *Lifecycle Callbacks*
> (docs.spring.io/spring-framework/reference/core/beans/) — the Spring Boot
> reference *SpringApplication* and *Graceful Shutdown*
> (docs.spring.io/spring-boot/reference/) — and the Spring Boot **2.6** release
> notes (circular references prohibited by default) and **3.4** release notes
> (graceful shutdown enabled by default). Framework 7.0 removed
> `javax.annotation` support. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Every bean you write is one object, shared by every request thread at once,
and that single fact generates most of what this topic contains. It is why
Spring beans must be stateless; it is why a `prototype` or `request` scope
injected into a singleton silently does nothing useful; and it is why the
callbacks exist at all, since a constructor runs before the object is proxied,
before the context is complete, and — with field injection — before its own
fields are populated.**

This topic runs to five files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Singleton by default, therefore stateless](01-singleton-and-statelessness.md)** | Why Spring's singleton is not the Gang of Four one, what "shared by every request thread" costs, the rule for which fields are safe, and where per-request state actually belongs |
| 2 | **[Prototype scope and the singleton trap](02-prototype-and-the-trap.md)** | "The sole instance that is ever supplied", why destruction callbacks never run for prototypes, and the three fixes — `ObjectProvider`, JSR-330 `Provider`, `@Lookup` — with what each costs |
| 3 | **[Web scopes and scoped proxies](03-web-scopes-and-proxies.md)** | `request`/`session`/`application`/`websocket`, why the injected field holds a permanent proxy rather than the bean, `TARGET_CLASS` vs `INTERFACES`, and what breaks off the request thread |
| 4 | **[Lifecycle callbacks](04-lifecycle-callbacks.md)** | The three init and three destroy mechanisms and their order, why `jakarta.annotation` matters now that Framework 7 removed `javax`, why not the constructor, and the hooks that fire later than `@PostConstruct` |
| 5 | **[Startup, shutdown and the cycle error](05-startup-shutdown-and-cycles.md)** | `SmartLifecycle` phases, lazy initialization's real trade, runners and the liveness/readiness split, graceful shutdown and the orchestrator trap, and how to read a circular-dependency report |

## Why this runs to five files

- **Scope and lifecycle are two different questions that share a chapter.**
  Scope asks *how many of this object exist and for how long*; lifecycle asks
  *what runs when one is created and destroyed*. Chunks 1–3 answer the first,
  4–5 the second, and keeping them apart stops "singleton" and "`@PostConstruct`"
  from blurring into one vague idea of "bean management".
- **The prototype trap and the request-scope trap are the same bug and need
  separate demonstrations.** Both are a short-lived bean resolved once into a
  long-lived one. They get separate chunks because the fixes are genuinely
  different — a provider you call versus a proxy Spring hands you — and because
  the web scopes bring their own failure mode when touched off the request
  thread.
- **Startup and shutdown are where the rest of it becomes observable.** Lazy
  init, readiness, graceful drain and the cycle report are all consequences of
  the earlier chunks, and they are the parts that show up in an incident rather
  than in a code review.

## Where this connects

- **[Topic 03 — Dependency injection](../03-dependency-injection/README.md)** — injection decides
  what a bean receives; scope decides how many of it there are. The
  `ObjectProvider` used here to escape the prototype trap is introduced there,
  and the circular-dependency mechanism this topic only reads the report for is
  argued out there in full.
- **[Topic 05 — Boot auto-configuration](../05-auto-configuration/README.md)** — conditional beans
  are still beans, with these scopes and these callbacks.
- **[Race conditions](../../phase-6-concurrency/03-race-conditions/README.md)**
  and **[the immutability-first strategy](../../phase-6-concurrency/15-immutability-first-strategy/README.md)**
  — chunk 1 is a Spring-shaped restatement of these; a mutable field on a
  `@Service` is the everyday form the general problem takes.
- **[`ThreadLocal` and `ScopedValue`](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)**
  — the alternative to request-scoped beans for cross-cutting per-request
  context, and the reason `ScopedValue` behaves better than `ThreadLocal` under
  virtual threads.
- **[Try-with-resources](../../phase-5-exceptions/03-try-with-resources/README.md)**
  — what to reach for given that a prototype bean never receives `@PreDestroy`.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Singleton by default](01-singleton-and-statelessness.md)
