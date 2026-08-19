---
title: "Why frameworks: the servlet model"
sidebar_label: "01 · Why frameworks: the servlet model"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Jakarta Servlet 6.1 specification, the
> Spring Framework 7.0 reference *Web on Servlet Stack*
> (docs.spring.io/spring-framework/reference/web/), the Spring Boot reference
> *Servlet Web Applications* (docs.spring.io/spring-boot/reference/web/servlet.html),
> the Spring Boot 4.0 Migration Guide, JEP 444 and JEP 491.
> Spring Boot 4.1.0, Spring Framework 7.0.x, Jakarta EE 11, JDK 25.

**Spring MVC is not a web server and it does not speak HTTP. Underneath it sits
a servlet container — a socket, a parser, a thread pool and a mapping table —
whose entire contract is "here is a request, on a thread, call this object".
Every capability you associate with Spring, from `@GetMapping` to
`ProblemDetail`, is built in the gap between that contract and an application.
This topic is the floor the rest of Phase 9 stands on: what the container
actually guarantees, what Spring adds on top, why Boot embedded the container
instead of deploying into one, and why the threading model — the one thing that
seemed permanently settled — changed in JDK 21.**

This topic runs to six files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The servlet contract](01-the-servlet-contract.md)** | The `Servlet` interface and `HttpServlet`; `javax` → `jakarta`; the one-instance-many-threads lifecycle and why every Spring bean is stateless |
| 2 | **[The container's own extension points](02-filters-and-the-container.md)** | `ServletContext`; filters and `FilterChain`; registration and ordering; dispatcher types; the request body you can only read once |
| 3 | **[DispatcherServlet, the front controller](03-dispatcherservlet.md)** | The dispatch algorithm; the eight special beans; the root/servlet context hierarchy; argument resolvers; why `@EnableWebMvc` switches Boot off |
| 4 | **[The embedded container](04-the-embedded-container.md)** | Container-as-library; `ServletWebServerApplicationContext`; the Boot 4 starter renames; switching and tuning; Undertow's removal |
| 5 | **[Thread per request](05-thread-per-request.md)** | The pool-size ceiling and why CPU does not fix it; async servlets; reactive vs virtual threads as the two answers |
| 6 | **[Living with virtual threads](06-living-with-virtual-threads.md)** | What `spring.threads.virtual.enabled` does *not* do; the backpressure you lose; pooling, pinning and thread-locals |

## Why this runs to six files

- **The container and the framework are genuinely separate systems.** Chunks 1
  and 2 are the Jakarta Servlet specification — true of any Java web stack,
  Spring or not. Chunks 3 onward are Spring's response to it. Collapsing them
  is how people end up unable to say which layer a bug is in.
- **Deployment is a third, independent concern.** Whether the container is
  embedded (chunk 4) is orthogonal to how requests are dispatched (chunk 3) —
  it changes who owns the server's version and lifecycle, not what happens to a
  request.
- **The threading story has a before and an after.** Chunk 5 is the model and
  the argument that shaped a decade of Java web architecture; chunk 6 is what
  actually changes when you flip the switch on JDK 21+, including the
  backpressure loss that the one-line summary hides.

## Where this connects

- **[Phase 6 · Platform vs virtual threads](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)**
  — the mechanism chunks 5 and 6 apply. Read it first if "mount", "unmount" and
  "carrier thread" are not yet concrete.
- **[Phase 6 · ThreadLocal and ScopedValue](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)**
  — pooled request threads are the reason `finally { remove(); }` is mandatory
  in a filter, and `ScopedValue` is the JDK 25 answer.
- **[Phase 6 · Race conditions](../../phase-6-concurrency/03-race-conditions/README.md)**
  — one servlet instance serving concurrent threads is the origin of the
  "stateless singleton" rule that governs every bean in Phase 9.
- **[Phase 8 · Dependency scopes](../../phase-8-build-dependencies/02-dependency-scopes/README.md)**
  — `provided` exists for exactly the container-supplied APIs this topic
  describes, and Boot's fat jar deliberately disagrees about it.
- **[Phase 8 · Versioning, updates and CVEs](../../phase-8-build-dependencies/07-versioning-updates-cve/README.md)**
  — embedding the server means a Tomcat CVE is now your dependency bump.
- **Topic 10 — The request pipeline** *(not written yet)* — filters are one of
  three interception points; that topic is where you choose between them.
- **Topic 15 — WebFlux and reactive** *(not written yet)* — chunk 5 sets up the
  argument that topic settles.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The servlet contract](01-the-servlet-contract.md)
