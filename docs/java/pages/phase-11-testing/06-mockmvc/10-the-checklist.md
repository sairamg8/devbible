---
title: "Reviewing a controller test means asking what the slice actually ran before asking whether the assertions are good, because the three most expensive defects in this topic — an empty error body, a security chain that is not yours, and an assertion on the challenge instead of the protection — all produce a green test that proves the opposite of what its name claims"
sidebar_label: "10 · The checklist"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 — this page introduces no claim of its own. Every line links to the chunk
> that argues and sources it, against the Spring Framework 7.0.x, Spring Boot 4.1.1 and Spring
> Security 7.1.1 references and sources as cited there.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — no suite was run.

**The closing chunk of the topic, meant to be used rather than read. A controller test has a
property that ordinary code review does not prepare you for: the expensive failures are not
wrong assertions, they are assertions with nothing behind them. A test that asserts 401 on a
chain you never loaded, or asserts an error body that a `@ControllerAdvice` happens to produce,
or asserts a redirect to a login page instead of the fact that the endpoint is protected — each
of those is green, plausible, and load-bearing in the worst way. Every box below links to the
chunk that argues it.**

## The four questions, if you only have two minutes

1. **Whose security chain ran?** Almost certainly Boot's default, not yours — a
   `@Configuration` class that *declares* a `SecurityFilterChain` bean is not *assignable to*
   one, so the slice filters it out. Boot's how-to says so and prescribes `@Import`
   ([02](02-webmvctest.md), [08e](08e-the-chain-you-are-not-testing.md)).
2. **Where is the error body coming from?** A bare slice returns the status and **no body** —
   `sendError` commits the response and `MockMvc` performs no error dispatch. If the test
   asserts a body, something is supplying it, and the test must say what
   ([06](06-validation-errors.md), [07](07-exception-handlers.md)).
3. **Is this assertion about the protection or the challenge?** `401` versus `302` is decided by
   content negotiation, so it changes when someone adds an `Accept` header — and it is not what
   you meant to assert ([08b](08b-the-401-and-the-302.md), [08c](08c-asserting-protection-not-the-challenge.md)).
4. **Could this test still fail?** A missing `@Valid`, a swallowed exception, an advice that
   never ran — each leaves an assertion that passes for the wrong reason
   ([06b](06b-asserting-the-error-contract.md), [07d](07d-tests-that-pin-the-handler.md)).

## Is it the right test at all?

- ☐ The claim needs the web layer. If it is about a computed value, it is a constructor call and
  no Spring ([01](01-no-socket-no-server.md))
- ☐ It is a `@WebMvcTest`, not a `@SpringBootTest` with a mocked service — the slice exists for
  this ([02](02-webmvctest.md))
- ☐ The slice is **narrowed** to the controller under test, and the cost of not narrowing is
  understood ([02b](02b-narrowing-and-what-it-costs.md))
- ☐ It is not asserting something structurally invisible to `MockMvc` — connector behaviour,
  container limits, a followed redirect ([09](09-what-mockmvc-cannot-test.md))
- ☐ If it genuinely needs a socket, it is `RANDOM_PORT` and the extra context is accepted
  knowingly ([09b](09b-crossing-to-a-real-port.md))
- ☐ It is not `standaloneSetup` masquerading as integration coverage — that loads no Spring
  configuration ([09](09-what-mockmvc-cannot-test.md))

## The request

- ☐ Content type is set on any request with a body — a missing one is a 415, not a 400
  ([04](04-building-a-request.md))
- ☐ Path variables and params are built through the API, not concatenated into the URI
  ([04](04-building-a-request.md))
- ☐ Nothing depends on a context path, a session or a `jsessionid` that the blank request does
  not have ([01b](01b-the-blank-request.md), [04b](04b-the-servlet-environment.md))
- ☐ Multipart requests use the multipart builder, not a hand-rolled body
  ([04c](04c-multipart-and-request-postprocessors.md))
- ☐ An `Accept` header is set deliberately if the assertion depends on it — and the reviewer
  knows it flips 401 to 302 ([08b](08b-the-401-and-the-302.md))

## The assertions

- ☐ Status is asserted, and it is the *specific* 4xx — five different failures all produce 400
  ([06](06-validation-errors.md))
- ☐ The body is asserted structurally, not as a whole-string equality
  ([05](05-asserting-the-response.md), [05b](05b-json-assertions.md))
- ☐ JSONPath selects by field, not by index — violation order is promised by nobody
  ([05c](05c-jsonpath-in-the-classic-api.md), [06b](06b-asserting-the-error-contract.md))
- ☐ Error assertions pin a **stable code and field name**, never Spring's interpolated message
  text ([06b](06b-asserting-the-error-contract.md))
- ☐ A validation test also proves the collaborator was **not** called — otherwise a missing
  `@Valid` passes ([06b](06b-asserting-the-error-contract.md))
- ☐ A form-controller validation failure expects **200** with model errors, not 400
  ([06b](06b-asserting-the-error-contract.md))
- ☐ Async endpoints are asserted on the completed result, not the `Callable`
  ([03d](03d-async-and-streaming.md))
- ☐ An expected failure is distinguished from an unexpected one — resolved versus unresolved
  ([03c](03c-resolved-and-unresolved-failures.md))

## Exception handling

- ☐ The test knows **which** advice handled the exception, and ideally proves it
  ([07d](07d-tests-that-pin-the-handler.md))
- ☐ Advice ordering is not left to chance — unordered ties are undefined, and Boot's
  `@Order(0)` advice outranks yours when problem details are on
  ([07](07-exception-handlers.md), [07b](07b-which-advice-applies.md))
- ☐ Handler-method selection is understood: most specific wins, cause matching applies, and an
  ambiguous match throws ([07c](07c-which-method-matches.md))
- ☐ `@ResponseStatus` on an exception class is not expected to produce a body — it lands on the
  same `sendError` as `@Valid` ([07e](07e-what-the-handler-produces.md))
- ☐ If the project extends `ResponseEntityExceptionHandler`, the test knows it backs off Boot's
  problem-details handler entirely ([07f](07f-responseentityexceptionhandler.md))
- ☐ `spring.mvc.problemdetails.enabled` matches production — it defaults to **false**
  ([06](06-validation-errors.md))

## Security — the section that catches the most

- ☐ 🔴 The production `SecurityConfig` is `@Import`ed. Without it the test is exercising Boot's
  default chain, and every security assertion in the file is about the wrong rules
  ([08e](08e-the-chain-you-are-not-testing.md))
- ☐ The test asserts **protection**, not the **challenge** — that the endpoint refuses an
  anonymous caller, not that it returns one particular status
  ([08c](08c-asserting-protection-not-the-challenge.md))
- ☐ A `POST`/`PUT`/`DELETE` uses `with(csrf())`, or the 403 is understood and intended
  ([08d](08d-csrf-in-the-slice.md))
- ☐ `@WithMockUser`'s roles do **not** carry a `ROLE_` prefix, and `roles` and `authorities` are
  not both set ([08g](08g-authenticating-the-test.md))
- ☐ `@WithUserDetails` has a real `UserDetailsService` bean to resolve against
  ([08h](08h-the-other-three-annotations.md))
- ☐ Identity is asserted where it matters, via the post-processors rather than by inspecting the
  controller ([08i](08i-post-processors-and-asserting-identity.md))
- ☐ Method security is not assumed to be on — Boot auto-configures none of it
  ([08f](08f-method-security-and-the-blunt-instrument.md))
- ☐ `addFilters = false` is **not** used just to silence security — it removes every filter,
  including correlation-id and logging ([09](09-what-mockmvc-cannot-test.md))
- ☐ No assertion on `hasRedirectedUrl("http://localhost/login")` — since 6.5 the redirect is a
  bare `/login` ([08b](08b-the-401-and-the-302.md))
- ☐ 🔴 If this test was moved to `RANDOM_PORT`, `@WithMockUser` was replaced with a real
  credential — it is silently inert against a running server
  ([09b](09b-crossing-to-a-real-port.md))

## Style and maintenance

- ☐ One API style per file — `MockMvcTester` or classic — not both interleaved
  ([03](03-mockmvctester.md), [03b](03b-the-classic-api.md))
- ☐ Twelve near-identical validation tests are a parameterized test
  ([06b](06b-asserting-the-error-contract.md))
- ☐ The mocked collaborator is `@MockitoBean`, not the removed `@MockBean`
  ([02](02-webmvctest.md))
- ☐ Imports are the Boot 4 packages — `org.springframework.boot.webmvc.test.autoconfigure`
  ([02](02-webmvctest.md))

## The report this topic is for

If you can answer these three about a controller test you did not write, the test is doing its
job: **which rules ran**, **where the body came from**, and **what would have to break for this
to go red**. A test that cannot answer the third question is decoration
([07d](07d-tests-that-pin-the-handler.md), [09](09-what-mockmvc-cannot-test.md)).

{/* FOOTER */}
