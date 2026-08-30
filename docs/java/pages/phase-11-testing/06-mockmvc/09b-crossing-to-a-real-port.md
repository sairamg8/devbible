---
title: "Crossing to a real port: RANDOM_PORT buys you a connector and costs you an ApplicationContext, TestRestTemplate and WebTestClient both ride on it — and @WithMockUser goes silently inert the moment the request is handled on a different thread"
sidebar_label: "09b · Crossing to a real port"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Boot 4.1.1** reference
> [`testing/spring-boot-applications`](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)
> for the four `webEnvironment` values, `@AutoConfigureTestRestTemplate` and
> `@AutoConfigureWebTestClient`; and the **Spring Security 7.1.x** reference
> (`servlet/test/mockmvc`) for the test-thread limitation of `@WithMockUser`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and quoted documentation, never a fabricated
> test run.

**[09](09-what-mockmvc-cannot-test.md) drew the line: above the `DispatcherServlet` everything in
a `MockMvc` test is real, below it there is no container at all. This chunk is what you do when
the thing you need to test lives below that line. The move is not "use a better client" — it is
starting an actual server, which changes the client, the cost model and, most expensively, the
way authentication works. The last of those is silent: nothing fails, nothing warns, the request
simply arrives anonymous.**

## What to reach for instead, and what it costs

`@SpringBootTest`'s `webEnvironment` is the dial. Verbatim from the Boot reference:

| Value | What it does |
|---|---|
| `MOCK` (default) | *"Loads a web `ApplicationContext` and provides a mock web environment. Embedded servers are not started when using this annotation."* Combine with `@AutoConfigureMockMvc`. |
| `RANDOM_PORT` | *"Loads a `WebServerApplicationContext` and provides a real web environment. Embedded servers are started and listen on a random port."* |
| `DEFINED_PORT` | *"…Embedded servers are started and listen on a defined port (from your `application.properties`) or on the default port of `8080`."* |
| `NONE` | *"Loads an `ApplicationContext` by using `SpringApplication` but does not provide any web environment (mock or otherwise)."* |

`RANDOM_PORT` is the answer to everything in the ❌ column, because now there is a real
connector. Prefer it to `DEFINED_PORT`, which cannot run twice concurrently and collides with
anything already on 8080. `webEnvironment` in depth is
[04b](../05-the-test-pyramid/04b-webenvironment.md).

Two clients ride on a real port:

- **`TestRestTemplate`** — from the `spring-boot-resttestclient` module, available via
  `@AutoConfigureTestRestTemplate`. It is the blunt, familiar one; it does not throw on 4xx/5xx,
  which is what you want when the error response *is* the assertion.
- **`WebTestClient`** — *"If you have `spring-webflux` on the classpath, you can also autowire a
  `WebTestClient` by annotating the test class with `@AutoConfigureWebTestClient`."* Note the
  condition: **`spring-webflux` on the classpath**, on a Spring MVC application. That is not a
  mistake and it is not a migration to WebFlux — the client is reactive, the server stays
  servlet-based.

⚠️ And `WebTestClient` is **not** exclusively an end-to-end tool: *"`WebTestClient` can also be
used with a mock environment, removing the need for a running server, by annotating your test
class with `@AutoConfigureWebTestClient` from `spring-boot-webflux-test`."* So "we use
WebTestClient" tells you nothing about whether a server is running. Read the `webEnvironment`.

**The cost is a context and a server**, not just milliseconds. A `RANDOM_PORT` test has a
different context cache key from your `MOCK` slices, so it is an additional context held for
the whole suite — [05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md) and
[06b · Overriding changes the cache key](../05-the-test-pyramid/06b-overriding-changes-the-cache-key.md).
Which level to pick is [10 · Choosing a level](../05-the-test-pyramid/10-choosing-a-level.md).

## The authentication trap when you cross the boundary

The single most expensive surprise in moving a test from `MockMvc` to `RANDOM_PORT`, from
Spring Security's own documentation:

> *"`@WithMockUser`, `@WithUserDetails`, and `@WithSecurityContext` populate the
> `SecurityContextHolder` for the test thread. This cannot apply to full HTTP requests a test
> makes to a running server since those requests are handled by a different thread. For
> end-to-end HTTP tests, authenticate the request itself."*

`@WithMockUser` does not fail loudly against a real port — it populates a `SecurityContextHolder`
on a thread the server never consults, and the request arrives unauthenticated. The symptom is
a 401 on a test that "only changed `webEnvironment`". Authenticate the request: a real basic-auth
header, a real token, or a real login round-trip. The slice-side story is
[08](08-security-in-a-slice.md).


## Gotchas

**★ Switching to `RANDOM_PORT` and keeping `@WithMockUser`.**
It populates the `SecurityContextHolder` on the test thread; the server handles the request on a
different one. The annotation is silently inert and the request is anonymous.

**★ Reaching for `RANDOM_PORT` because of the empty error body.**
That is [06](06-validation-errors.md)'s missing error dispatch, and the right fix is a
`@ControllerAdvice` in the slice or the problem-details property — not a server. Spinning up a
container to get an error body you could have configured is the most common overcorrection in
this topic.

**★ Assuming `WebTestClient` means a real server is involved.**
It runs bound to a mock environment too. The `webEnvironment` decides, not the client type.

**★ Adding `spring-webflux` for `WebTestClient` and concluding the app is now reactive.**
The dependency is there for the *client*. The server remains Spring MVC on a servlet container.

**★ Using `DEFINED_PORT` in CI.**
It binds a fixed port, so two modules cannot run concurrently and anything already on 8080
breaks the build. `RANDOM_PORT` exists for this.

## Interview questions

**★ You move a passing controller test to `@SpringBootTest(webEnvironment = RANDOM_PORT)` and it
returns 401. Nothing else changed. Why?**
`@WithMockUser` populated the `SecurityContextHolder` on the test thread, and the running server
handles the request on a different thread, so the context is never seen. Against a real port you
must authenticate the request itself — a real header, token, or login exchange.

**★ When is `RANDOM_PORT` the right answer, and when is it an overcorrection?**
Right when the thing under test lives below the `DispatcherServlet`: the connector, TLS, HTTP/2,
container limits, filter *mapping*, real client behaviour like following redirects, or full
end-to-end wiring. An overcorrection when you are chasing an empty error body — that is the
missing error dispatch, fixed with a `@ControllerAdvice` in the slice — or when you just want a
different assertion style. The real cost is an extra `ApplicationContext` with its own cache key
held for the whole suite, not the server's startup time.

**★ A colleague adds `spring-webflux` to a Spring MVC project's test scope. Has the application
become reactive?**
No. `WebTestClient` is a reactive *client* and needs `spring-webflux` on the classpath to be
autowired via `@AutoConfigureWebTestClient`; the server stays servlet-based Spring MVC. It is also
not proof that a server is running — `WebTestClient` binds to a mock environment as well.

{/* FOOTER */}
