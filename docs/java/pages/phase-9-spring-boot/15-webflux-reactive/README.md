---
title: "WebFlux and reactive"
sidebar_label: "15 · WebFlux and reactive"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Spring Framework reference *Web on Reactive
> Stack* (Overview, Applicability, Performance, Concurrency Model, Annotated
> Controllers, Functional Endpoints, WebClient), the Reactor 3 reference guide
> (Core Features, Schedulers, Handling Errors, Debugging, Testing, Context and
> Context-Propagation Support), the Spring Boot reference *Reactive Web
> Applications* and `spring.threads.virtual.enabled`, the Spring Boot 4.0
> migration guide (starter renames, `@MockBean` removal), Spring Security's
> reactive reference, and JEP 444 / JEP 491. Spring Boot 4.1.0, Spring
> Framework 7.0.x, JDK 25.

**Reactive web frameworks solved a real problem — a platform thread parked on
I/O was too expensive to waste, so thread-per-request ran out of threads long
before it ran out of CPU — and they solved it at a price: colour propagates
through your whole codebase, stack traces stop describing the call, and every
`ThreadLocal`-based mechanism in the ecosystem needs a reactive counterpart.
JDK 21 removed the premise. Virtual threads give the scalability of the event
loop with the readability, debuggability and library ecosystem of blocking
code, so the reason to choose WebFlux is no longer "we need to handle many
concurrent requests". This topic is the argument, made honestly in both
directions, so you can read reactive code, judge an existing reactive service,
and defend a choice either way.**

This topic runs to twelve files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The problem reactive solved](01-the-problem-reactive-solved.md)** | Thread-per-request with platform threads, the latency × pool-size ceiling, the event-loop answer, and the three separate things the word "reactive" names |
| 2 | **[Mono, Flux and laziness](02-mono-flux-and-laziness.md)** | The two types, the signal contract, "nothing happens until you subscribe", assembly time versus subscription time, cold and hot publishers |
| 3 | **[The operator vocabulary](03-the-operator-vocabulary.md)** | The imperative-construct-to-operator map, `map`/`flatMap`/`concatMap`, `zip`, `switchIfEmpty`, the `doOn*` hooks, `log()`, and reading a real chain |
| 4 | **[Errors, retries and cancellation](04-errors-retries-cancellation.md)** | Errors as signals, `onErrorResume`/`onErrorMap`, `retryWhen` and why it re-runs the upstream, `timeout`, and cancellation — the one thing blocking code has no equivalent for |
| 5 | **[Schedulers and threading](05-schedulers-and-threading.md)** | Reactor's concurrency-agnostic default, `boundedElastic` (cores × 10) versus `parallel`, and the `subscribeOn`/`publishOn` distinction |
| 6 | **[Annotated controllers](06-annotated-controllers.md)** | The starter (and the Boot 4 rename asymmetry), publisher return types, what a `Flux` return actually renders as, SSE, and the servlet API's absence |
| 7 | **[Functional endpoints and WebClient](07-functional-endpoints-and-webclient.md)** | `RouterFunction`/`HandlerFunction`, why anyone picks them, `WebClient` from MVC, and `RestClient` as the non-reactive answer to a deprecated `RestTemplate` |
| 8 | **[The colour of your functions](08-the-colour-of-functions.md)** | 🔴 The central cost: colour propagating upward, what must be reactive, R2DBC versus JPA, the `boundedElastic` escape hatch and what it concedes, and the blocking you did not know you had |
| 9 | **[Debugging and testing](09-debugging-and-testing.md)** | Why the stack trace is useless, `log()`/`checkpoint()`/`ReactorDebugAgent`/`Hooks.onOperatorDebug()`, what a debugger can and cannot do, `StepVerifier`, virtual time, `WebTestClient` and `@MockitoBean` |
| 10 | **[Context and ThreadLocals](10-context-and-threadlocals.md)** | Why `ThreadLocal` breaks, the Reactor `Context` and its bottom-up propagation, the context-propagation library, and the MDC / `ReactiveSecurityContextHolder` / reactive-transaction trio |
| 11 | **[Why virtual threads changed it](11-why-virtual-threads-changed-the-answer.md)** | 🔴 The argument: JEP 444, `spring.threads.virtual.enabled`, the row-by-row comparison, what WebFlux still genuinely wins, and what virtual threads do not fix |
| 12 | **[Choosing](12-choosing.md)** | The decision by situation, the reactive-controller-over-blocking-repository failure mode, the one legitimate blend, and how to argue it without a benchmark |

## Why this runs to twelve files

- **The argument is the content, and an argument needs both sides established
  before it can be made.** Chunk 11's claim — that virtual threads removed the
  reason most teams adopted WebFlux — is worthless unless the reader already
  knows exactly what the reactive model buys (chunk 1) and exactly what it
  costs (chunks 8, 9 and 10). Compressing the costs into a bullet list would
  make the conclusion an assertion instead of a conclusion.
- **"You must be able to read someone else's reactive code" is a real
  requirement with a real surface.** The operators, the laziness, the error
  and cancellation signals, and the threading operators are four separate
  mental models, and a reader who has three of them still cannot read the
  code.
- **The costs are not one cost.** Colour propagation is an architectural
  constraint, the missing stack trace is a daily workflow problem, and the
  broken `ThreadLocal` is an ecosystem problem with a different replacement
  for each mechanism. They have different fixes, different symptoms and
  different people who care about them, so they get separate chunks.
- **The two programming models and the two clients are the part most likely to
  be met in someone else's codebase**, and the Boot 4 version details attached
  to them — the starter rename asymmetry, `@MockitoBean`, the deprecation of
  `RestTemplate` — are exactly what makes every pre-2026 sample misleading.

## Where this connects

- **[Topic 01 · Why frameworks: the servlet model](../01-why-frameworks-servlet-model/README.md)**
  — the blocking stack this topic is the alternative to, including
  [thread-per-request](../01-why-frameworks-servlet-model/05-thread-per-request.md)
  and
  [living with virtual threads](../01-why-frameworks-servlet-model/06-living-with-virtual-threads.md),
  which is where the "you have removed your accidental backpressure" argument
  is made in full.
- **[Topic 07 · REST controllers](../07-rest-controllers/01-the-controller-and-the-pipeline.md)**
  — everything about mappings, binding and content negotiation carries over
  unchanged to an annotated WebFlux controller; only the return types differ.
- **[Phase 6 · Platform vs virtual threads](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)**
  and **[Structured concurrency](../../phase-6-concurrency/08-structured-concurrency.md)**
  — the mechanism behind chunk 11, and the blocking answer to the fan-out
  problem chunk 11 credits WebFlux with.
- **[Phase 6 · ThreadLocal and ScopedValue](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)**
  — the ambient-state mechanism chunk 10 is about losing, and its modern
  blocking replacement.
- **[Phase 6 · CompletableFuture](../../phase-6-concurrency/07-completablefuture/README.md)**
  — the JDK's own asynchronous composition API, which is where most reactive
  pipelines adapt pre-existing async code from.
- **[Phase 8 · Transitive dependencies and mediation](../../phase-8-build-dependencies/03-transitive-and-mediation/README.md)**
  — how the MVC starter arrives in a project that thought it was reactive.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The problem reactive solved](01-the-problem-reactive-solved.md)
