---
title: "MockMvc: the DispatcherServlet runs for real and the container does not exist, so a controller test is only as honest as its answer to three questions — whose security rules ran, where the error body came from, and what would have to break for this to go red"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 → 2026-08-30 against the **Spring Framework 7.0.x** reference
> (`testing/mockmvc/*`, cross-checked against the asciidoc at tag `v7.0.9`), the
> **Spring Boot 4.1.1** reference and how-to guides, the **Spring Security 7.1.1** reference
> (`servlet/test/mockmvc/*`), and the `spring-framework` / `spring-boot` / `spring-security`
> sources at those tags — named per chunk on each page's own `> Verified:` line.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, AssertJ 3.27.7, Spring Security 7.1.1.
> **No sandbox, no Docker, no test run** — these pages carry Java source and library source
> only. Where a claim is a derivation from source rather than a documented statement, the page
> says so in those words.

**A `MockMvc` test occupies a strange position: everything above the `DispatcherServlet` is your
real application — real handler mapping, real binding, real message conversion, real validation,
your real `ObjectMapper` — and everything below it does not exist at all. There is no socket, no
connector, and only ever one dispatch. Almost every defect in this topic comes from losing track
of which side of that line something is on.**

The three that cost the most, and all three are green tests:

1. **The security chain you are testing is not the one you wrote.** A `@Configuration` class that
   *declares* a `SecurityFilterChain` bean is not *assignable to* `SecurityFilterChain`, so
   `@WebMvcTest`'s type-exclude filter drops it and Boot's default chain runs instead. Boot's
   how-to states this outright and prescribes `@Import`
   ([02](02-webmvctest.md), [08e](08e-the-chain-you-are-not-testing.md)).
2. **The error body you assert on may be produced by nothing at all.** `DefaultHandlerExceptionResolver`
   calls `response.sendError(...)`, which commits the mock response without writing a body, and
   `MockMvc` performs no error dispatch — so Boot's `/error` controller never runs
   ([06](06-validation-errors.md), [07e](07e-what-the-handler-produces.md)).
3. **`401` versus `302` is decided by content negotiation, not by your rules.** A bare request
   sends no `Accept` header, resolves to `*/*`, and matches HTTP Basic's entry point. Add
   `.accept(TEXT_HTML)` and the identical request becomes a redirect — which is why the assertion
   should be about protection, not the challenge
   ([08b](08b-the-401-and-the-302.md), [08c](08c-asserting-protection-not-the-challenge.md)).

**34 chunks, ~9,800 lines.** Read in order; each chunk links to the next. The review checklist is
[10 · The checklist](10-the-checklist.md).

## What runs, and what does not

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[No socket, no server](01-no-socket-no-server.md)** | <span className="db-tier t-understand">Understand</span> | What `MockMvc` actually invokes, and what it therefore cannot catch |
| 2 | **[The blank request](01b-the-blank-request.md)** | <span className="db-tier t-understand">Understand</span> | No context path, no `jsessionid`, no forward/error/async dispatch |
| 3 | **[The `@WebMvcTest` slice](02-webmvctest.md)** | <span className="db-tier t-understand">Understand</span> | Which beans exist, which do not, and why your `SecurityConfig` is not one of them |
| 4 | **[Narrowing, and what it costs](02b-narrowing-and-what-it-costs.md)** | <span className="db-tier t-understand">Understand</span> | Restricting the slice, and the context-cache price of not doing it |

## The two APIs

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 5 | **[MockMvcTester](03-mockmvctester.md)** | <span className="db-tier t-understand">Understand</span> | The AssertJ front end Boot's own examples now use |
| 6 | **[The classic API](03b-the-classic-api.md)** | <span className="db-tier t-understand">Understand</span> | `perform`/`andExpect`, kept because every codebase has it |
| 7 | **[Resolved and unresolved failures](03c-resolved-and-unresolved-failures.md)** | <span className="db-tier t-understand">Understand</span> | The distinction that decides whether your test throws or asserts |
| 8 | **[Async and streaming](03d-async-and-streaming.md)** | <span className="db-tier t-understand">Understand</span> | Why the classic API needs a second dispatch and the AssertJ one does not |

## Building the request

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 9 | **[Building a request](04-building-a-request.md)** | <span className="db-tier t-understand">Understand</span> | Path variables, params, headers, content type, body |
| 10 | **[The Servlet environment](04b-the-servlet-environment.md)** | <span className="db-tier t-understand">Understand</span> | Session, cookies, context path — what you must set yourself |
| 11 | **[Multipart and post-processors](04c-multipart-and-request-postprocessors.md)** | <span className="db-tier t-understand">Understand</span> | File uploads, and the hook every other feature is built on |

## Asserting the response

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 12 | **[Asserting the response](05-asserting-the-response.md)** | <span className="db-tier t-understand">Understand</span> | Status, headers, and why asserting the whole body is brittle |
| 13 | **[JSON assertions](05b-json-assertions.md)** | <span className="db-tier t-understand">Understand</span> | Comparing JSON structurally rather than as a string |
| 14 | **[JSONPath in the classic API](05c-jsonpath-in-the-classic-api.md)** | <span className="db-tier t-understand">Understand</span> | Selecting by field, and the index that breaks on reorder |

## Validation errors

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 15 | **[Validation errors](06-validation-errors.md)** | <span className="db-tier t-understand">Understand</span> | Which exception, why a bare slice sends an empty 400, where a body would come from |
| 16 | **[Asserting the contract](06b-asserting-the-error-contract.md)** | <span className="db-tier t-understand">Understand</span> | Codes not messages, no ordering, and the form controller that answers with 200 |

## Exception handlers

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 17 | **[Exception handlers](07-exception-handlers.md)** | <span className="db-tier t-understand">Understand</span> | Which advice is consulted, and Boot's `@Order(0)` advice outranking yours |
| 18 | **[Which advice applies](07b-which-advice-applies.md)** | <span className="db-tier t-understand">Understand</span> | `HandlerTypePredicate`, and why narrowing the slice does not narrow the advices |
| 19 | **[Which method matches](07c-which-method-matches.md)** | <span className="db-tier t-understand">Understand</span> | Most specific wins, cause matching, and the ambiguous match that throws |
| 20 | **[Tests that pin the handler](07d-tests-that-pin-the-handler.md)** | <span className="db-tier t-understand">Understand</span> | Proving *which* handler won, not merely that something handled it |
| 21 | **[What the handler produces](07e-what-the-handler-produces.md)** | <span className="db-tier t-understand">Understand</span> | Four ways to attach a status, and the `sendError` they share |
| 22 | **[ResponseEntityExceptionHandler](07f-responseentityexceptionhandler.md)** | <span className="db-tier t-understand">Understand</span> | What extending it gives you, and what it backs off |

## Security in a slice

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 23 | **[Security in a slice](08-security-in-a-slice.md)** | <span className="db-tier t-understand">Understand</span> | `@WebMvcTest` auto-configures Spring Security, and nobody expects it |
| 24 | **[The 401 and the 302](08b-the-401-and-the-302.md)** | <span className="db-tier t-understand">Understand</span> | Content negotiation decides which entry point answers |
| 25 | **[Asserting protection](08c-asserting-protection-not-the-challenge.md)** | <span className="db-tier t-understand">Understand</span> | Assert that it refuses, not which refusal it chose |
| 26 | **[CSRF in the slice](08d-csrf-in-the-slice.md)** | <span className="db-tier t-understand">Understand</span> | The 403 on every `POST`, and `with(csrf())` |
| 27 | **[The chain you are not testing](08e-the-chain-you-are-not-testing.md)** | <span className="db-tier t-understand">Understand</span> | Why your `SecurityConfig` is filtered out, and `@Import` as the fix |
| 28 | **[Method security](08f-method-security-and-the-blunt-instrument.md)** | <span className="db-tier t-understand">Understand</span> | Boot auto-configures none of it, and what that means for a slice |
| 29 | **[@WithMockUser](08g-authenticating-the-test.md)** | <span className="db-tier t-understand">Understand</span> | The `ROLE_` trap, and roles-versus-authorities throwing |
| 30 | **[The other three annotations](08h-the-other-three-annotations.md)** | <span className="db-tier t-understand">Understand</span> | `@WithUserDetails`, `@WithAnonymousUser`, `@WithSecurityContext` |
| 31 | **[Post-processors and identity](08i-post-processors-and-asserting-identity.md)** | <span className="db-tier t-understand">Understand</span> | Authenticating the request itself, and asserting who was authenticated |

## The boundary, and crossing it

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 32 | **[What MockMvc cannot test](09-what-mockmvc-cannot-test.md)** | <span className="db-tier t-understand">Understand</span> | Where the line is: JSP, the container, filter mapping, `standaloneSetup` |
| 33 | **[Crossing to a real port](09b-crossing-to-a-real-port.md)** | <span className="db-tier t-understand">Understand</span> | `webEnvironment`, the two clients, and `@WithMockUser` going inert |
| 34 | **[The checklist](10-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | Reviewing a controller test someone else wrote |

## Where this topic hands off

- The controllers themselves — [Phase 9 · REST controllers](../../phase-9-spring-boot/07-rest-controllers/01-the-controller-and-the-pipeline.md)
- The pipeline `MockMvc` replicates — [Phase 9 · The request pipeline](../../phase-9-spring-boot/10-the-request-pipeline/01-the-full-path.md)
- The error shape as a published contract — [Phase 9 · Error handling](../../phase-9-spring-boot/09-error-handling/01-the-error-shape-is-a-contract.md)
- Choosing this level over another — [05 · The test pyramid](../05-the-test-pyramid/10-choosing-a-level.md)
- Real dependencies rather than mocks — [07 · Testcontainers](../07-testcontainers/01-passed-on-h2-proves-nothing.md)

{/* FOOTER */}
