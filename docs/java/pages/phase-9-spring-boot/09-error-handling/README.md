---
title: "Error handling"
sidebar_label: "09 · Error handling"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 / 2026-08-20 against the Spring Framework reference —
> *Exceptions*, *Error Responses*, *Interception* and *Asynchronous Requests*
> (docs.spring.io/spring-framework/reference/web/webmvc/) — the Spring Boot
> reference *Servlet Web Applications · Error Handling*
> (docs.spring.io/spring-boot/reference/web/servlet.html), the Spring Boot 4.0
> Configuration Changelog for the `server.error.*` → `spring.web.error.*`
> renames, the Jakarta Servlet 6.1 javadoc, RFC 9457, and the javadoc for
> `ProblemDetail`, `ErrorResponse`, `ResponseStatusException`,
> `ResponseEntityExceptionHandler`, `DefaultHandlerExceptionResolver`,
> `AsyncRequestTimeoutException` and `AsyncRequestNotUsableException`. Four
> behaviours the reference does not state are cited from the Framework
> **source** and are marked as such on the pages that use them. Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Every response your service can produce is part of its published interface,
including the ones it produces when something goes wrong — and a client writes
code against your 404 exactly as much as against your 200. The whole of this
topic is one move and its consequences: decide the error shape once, in one
place, and make it impossible for an endpoint to invent its own. The first half
builds that place — the resolver chain, `@ControllerAdvice`, `ProblemDetail`,
and the status decisions you will live with for years. The second half is the
part that separates people who have run this in production from people who have
read about it: the precise window in which that one place has authority, and
what happens on either side of it.**

This topic runs to twenty files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The error shape is part of your API](01-the-error-shape-is-a-contract.md)** | What a stock Boot application returns today, why the `/error` dispatch is a second request, and the four independent reasons per-endpoint `try`/`catch` is the thing to delete |
| 2 | **[The resolver chain](02-the-resolver-chain.md)** | `HandlerExceptionResolver` as an interface in an ordered chain, its three-valued contract, and choosing deliberately between `@ResponseStatus`, `ResponseStatusException` and `@ExceptionHandler` |
| 3 | **[Which handler wins](03-matching-which-handler-wins.md)** | Annotation value versus parameter type, cause-level matching, priority beating specificity across advices, and rethrowing to back out of the chain |
| 4 | **[Handler signatures](04-handler-signatures.md)** | What an `@ExceptionHandler` may accept and return, the three ways to set the status, `produces` on a handler, and when a controller-local handler is right |
| 5 | **[@ControllerAdvice](05-controlleradvice.md)** | What an advice hosts, `@RestControllerAdvice`, the three selectors, ordering several advices, and why local handlers win but the highest-priority advice does |
| 6 | **[ProblemDetail and RFC 9457](06-problemdetail-and-rfc-9457.md)** | The five standard fields and what each is actually for, why the media type is part of the contract, and whether to adopt it at all |
| 7 | **[Extension members](07-extension-members.md)** | The `properties` map versus subclassing, why members render flat, how a client decodes them, and why adding one is compatible and renaming one is not |
| 8 | **[ErrorResponse](08-errorresponse.md)** | The contract that lets an exception carry its own status, headers and body — and the load-bearing fact that every Spring MVC exception implements it |
| 9 | **[Message codes and i18n](09-message-codes-and-i18n.md)** | Retitling and translating Spring's own messages from a properties file, the precondition that makes it silently do nothing, and what must never be localised |
| 10 | **[ResponseEntityExceptionHandler](10-responseentityexceptionhandler.md)** | The base class, its overridable surface, the three override points, and how it compares with `spring.mvc.problemdetails.enabled` |
| 11 | **[Mapping domain exceptions](11-mapping-domain-exceptions.md)** | How many exception types a domain should have, the status table with its reasoning, and the four arguments — 404/422, 400/422, 409/422, 403/404 — settled once |
| 12 | **[Validation and foreign exceptions](12-validation-and-foreign-exceptions.md)** | The two validation exceptions and why they differ, a structured body for field errors, Boot 4's non-transitive validation, and translating exceptions you do not own |
| 13 | **[What must never reach the client](13-never-reaches-the-client.md)** | Stack traces, framework messages and rejected values as a security surface; the Boot 4 property names; and why properties are a seatbelt rather than the design |
| 14 | **[Correlation ids and logging](14-correlation-ids-and-logging.md)** | The filter, the five details in it that are each a bug if omitted, log level by status, and why handled exceptions stop being recorded as errors by observations |
| 15 | **[The gaps](15-the-gaps.md)** | The exact window `@ControllerAdvice` covers, why a servlet `Filter` is outside it, and three fixes with the cost of each — including the one that passes a `null` handler |
| 16 | **[The /error floor](16-the-error-floor.md)** | The four routes to `/error`, `ErrorAttributes` versus a custom `ErrorController`, why the fallback is `application/json` and not `problem+json`, and what happens when your own handler throws |
| 17 | **[Async requests](17-async-requests.md)** | The two async mechanisms behind four return types, what the container thread does, how the exception is dispatched back, and the plumbing that must be right for it to work |
| 18 | **[Timeouts and @Async](18-timeouts-and-async.md)** | Why the timeout is a response and not a cancellation, how to cancel properly and when you cannot, idempotency as the honest fallback, and why `@Async` is not this |
| 19 | **[Committed responses](19-committed-responses.md)** | What "committed" means precisely, which calls throw and which fail silently, `AsyncRequestNotUsableException`, why `ProblemDetail` cannot help once bytes have left, and why `postHandle` and `afterCompletion` are the same problem |
| 20 | **[Designing for unreportable failures](20-designing-for-unreportable-failures.md)** | Buffered or streamed decided per endpoint, materialising before writing, in-band failure contracts for SSE and NDJSON, and making truncation visible when nothing else can |

## Why this runs to twenty files

- **The mechanism and the policy are different subjects, and both are deep.**
  Chunks 2–5 are entirely about *how Spring decides which code runs*: an ordered
  chain, a matching algorithm, a signature contract, an advice model. Chunks
  11–13 contain almost no Spring at all — they are about which status a
  situation deserves and what a client may be told. Merging them produces pages
  where a reader looking for "why is my handler ignored" wades through an
  argument about 409 versus 422.
- **RFC 9457 is four chunks because it is a contract, not a class.** The five
  fields, the extension mechanism, the `ErrorResponse` interface that makes
  Spring's own exceptions participate, and the message-code layer are four
  independent decisions with four different blast radii. `setProperty` is one
  method call and "adding a member is compatible, renaming one is not" is a
  commitment measured in years.
- **The status arguments deserve to be settled once, with reasons.** 400 versus
  422, 409 versus 422, and the deliberate 404-instead-of-403 are re-litigated in
  every code review that has not read a page like chunk 11. Writing them as a
  table with the reasoning attached is what stops the argument recurring.
- **Six chunks are about where the model stops working, and that is the point.**
  Everything in chunks 1–14 is true inside one window — the stretch the
  `DispatcherServlet` wraps in a `try`. Chunks 15–20 map the boundary of that
  window: filters outside it, `/error` underneath it, async threads beside it,
  and commitment after it. This is the material that separates a working
  implementation from one that works until the first incident, and it is
  genuinely six chunks' worth: the filter gap alone has three fixes with
  different costs, and commitment has no fix at all, only design.
- **The last chunk exists because the honest answer is "you cannot report
  this".** Every other page ends with a fix. Chunk 20 ends with a decision —
  buffer or stream, per endpoint — and a detection strategy, because a truncated
  `200 OK` that nobody notices is worse than a 500 and no amount of error
  handling will change it after the fact.
- **Section counts vary because topics vary.** Chunk 11 needs four status
  arguments; chunk 8 needs five questions and no code beyond an interface;
  chunk 19 needs eight questions because almost every one of them is a real
  incident someone has had. A uniform shape across twenty pages would have meant
  none of them was written to its own material.

## Where this connects

- **[Topic 07 — REST controllers](../07-rest-controllers/README.md)** — chunk 7
  of that topic chooses the status codes for the happy path; this topic owns the
  single error shape every failure returns. The
  [records-as-DTOs](../07-rest-controllers/05-records-as-dtos.md) rule turns out
  to have an error-handling justification too, and
  [pagination](../07-rest-controllers/08-collections-and-hypermedia.md) is what
  keeps a response small enough for its error path to work.
- **[Topic 08 — Validation](../08-validation/README.md)** — that topic owns the
  constraint set and the custom validators; chunk 12 here owns what the failure
  looks like on the wire, and the two exceptions it can arrive as.
- **[Topic 10 — The request pipeline](../10-the-request-pipeline/README.md)** —
  filters, interceptors, dispatcher types and ordering. Chunks 15–17 depend on
  that picture; that topic owns the registration mechanics this one only names.
- **[Topic 11 — Spring Security](../11-spring-security/README.md)** — the
  worked example of chunk 15's gap: `AccessDeniedException` and
  `AuthenticationException` are handled inside the filter chain, so your advice
  never sees them.
- **[Topic 13 — Actuator](../13-actuator/README.md)** — where health probes
  belong instead of `/error`, and where the per-`type` counters chunks 14 and 20
  recommend are exposed.
- **[Phase 5 — Exceptions](../../phase-5-exceptions/README.md)** — the language
  layer underneath all of this: the
  [checked/unchecked hierarchy](../../phase-5-exceptions/01-hierarchy-checked-unchecked/README.md),
  [custom exceptions and translation](../../phase-5-exceptions/04-custom-exceptions-translation.md),
  and [reading stack traces](../../phase-5-exceptions/05-reading-stack-traces/README.md),
  which is what you do with the detail chunk 13 keeps out of the response.
- **[ThreadLocal and ScopedValue](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)**
  — why the MDC must be cleared in a `finally`, why that clearing is exactly
  what loses the correlation id on the `ERROR` dispatch, and why the same
  problem returns on every executor in chunk 17.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The error shape is a contract](01-the-error-shape-is-a-contract.md)
