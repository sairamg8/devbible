---
title: "hasContentType is an equality check on the whole media type including its charset parameter, hasContentTypeCompatibleWith is not, and choosing the wrong one produces a failure that reads like a serialisation bug — which is the small version of this page's argument that a response assertion should name the promise it is checking rather than the bytes that happened to come back"
sidebar_label: "05 · Asserting the response"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "Defining Expectations"
> ([hamcrest](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/expectations.html),
> [assertj](https://docs.spring.io/spring-framework/reference/testing/mockmvc/assertj/assertions.html))
> and "MockMvc vs End-to-End Tests" — read as asciidoc source at tag `v7.0.9` — and the
> `spring-test` 7.0.9 sources for `MvcTestResultAssert`, `AbstractHttpServletResponseAssert`,
> `AbstractMockHttpServletResponseAssert` and `MockMvcResultMatchers`, from which every javadoc
> sentence and code excerpt below is taken.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9 (docs and sources read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7,
> Hamcrest 3.0.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**The reference's own advice about MockMvc assertions is one sentence — *"it is important not to
lose sight of the fact that the response is the most important thing to check"* — and this chunk
is what "checking the response" should mean. Status, content type, headers, redirects and the
body, in both APIs, plus the two ways a response assertion goes wrong: checking a family when you
meant a code, and checking the whole body when you meant three fields. JSON gets its own chunk,
[05b · JSON assertions](05b-json-assertions.md).**

## Status

```java
// AssertJ
assertThat(mvc.get().uri("/orders/42")).hasStatusOk();
assertThat(mvc.post().uri("/orders")).hasStatus(HttpStatus.CREATED);
assertThat(mvc.get().uri("/orders/0")).hasStatus(404);
assertThat(mvc.get().uri("/boom")).hasStatus5xxServerError();
```

```java
// classic
mockMvc.perform(get("/orders/42")).andExpect(status().isOk());
mockMvc.perform(post("/orders")).andExpect(status().isCreated());
mockMvc.perform(get("/orders/0")).andExpect(status().is(404));
mockMvc.perform(get("/boom")).andExpect(status().is5xxServerError());
```

The AssertJ surface is `hasStatus(int)`, `hasStatus(HttpStatus)`, `hasStatusOk()` and the five
family shortcuts — `hasStatus1xxInformational`, `hasStatus2xxSuccessful`, `hasStatus3xxRedirection`,
`hasStatus4xxClientError`, `hasStatus5xxServerError`.

🔴 **A family assertion is almost never what you want.** `hasStatus2xxSuccessful()` passes for 200
and for 201, and the difference between them is a published contract: a `POST` that creates
something is specified to return 201 with a `Location` header, and a client that follows the spec
behaves differently. The family shortcuts earn their place in exactly one situation — asserting
that *something* went wrong when the specific code is not yours to promise, as in
`hasStatus4xxClientError()` on a malformed request that several validators could reject
differently. Everywhere else, name the code.

## Content type: the difference that costs an afternoon

```java
public SELF hasContentType(String contentType) {
    contentType().isEqualTo(contentType);              // EQUALITY, parameters included
    return this.myself;
}

public SELF hasContentTypeCompatibleWith(String contentType) {
    contentType().isCompatibleWith(contentType);       // MediaType#isCompatibleWith
    return this.myself;
}
```

A Spring MVC JSON response is commonly `application/json` on Boot 4, and historically
`application/json;charset=UTF-8`. `hasContentType("application/json")` is an **equality** check
including the parameters, so against a charset-carrying response it fails with a message about
media types that reads like a serialisation problem. `hasContentTypeCompatibleWith(...)` uses
`MediaType.isCompatibleWith`, which ignores parameters and honours wildcards, so
`application/json` is compatible with `application/json;charset=UTF-8` and with
`application/*+json`-style expectations.

**Use `hasContentTypeCompatibleWith` unless the exact media type, parameters and all, is the thing
you are asserting** — a `application/vnd.acme.order+json;version=2` contract, for instance, where
the parameter *is* the promise.

The classic equivalents split the same way: `content().contentType(...)` is equality,
`content().contentTypeCompatibleWith(...)` is compatibility.

## Headers, cookies, redirects and forwards

```java
assertThat(result).containsHeader("Location");
assertThat(result).doesNotContainHeader("Set-Cookie");
assertThat(result).hasHeader("Cache-Control", "no-store");
assertThat(result).headers().hasEntrySatisfying("ETag", v -> assertThat(v).startsWith("\""));

assertThat(result).cookies().containsCookie("SESSION");

assertThat(result).hasRedirectedUrl("/orders/42");
assertThat(result).redirectedUrl().matchPattern("/orders/*");
assertThat(result).hasForwardedUrl("/WEB-INF/views/order.jsp");
```

`headers()` returns an `HttpHeadersAssert`, `cookies()` a `CookieMapAssert`, and
`redirectedUrl()`/`forwardedUrl()` return a `UriAssert` — the javadoc's own steer is *"If a simple
equality check is required, consider using `hasRedirectedUrl(String)` instead"*, so the
`UriAssert` form is for patterns and partial matches.

Remember what a redirect and a forward *are* in a MockMvc test: [01b](01b-the-blank-request.md)
established that they are recorded on the response and never executed. `hasRedirectedUrl("/login")`
asserts that the controller asked for a redirect. It does not assert anything about `/login`,
because nothing fetched it.

## The body

```java
assertThat(result).bodyText().isEqualTo("Hello World");
assertThat(result).bodyText().contains("ORD-42");
assertThat(result).body().hasSize(1024);                 // byte[] assertions
assertThat(result).bodyJson().extractingPath("$.reference").isEqualTo("ORD-42");
```

Three accessors: `body()` is `byte[]`, `bodyText()` is a `String`, `bodyJson()` is JSON with
JSONPath support. The classic equivalents are `content().string(...)`,
`content().bytes(...)` and `jsonPath(...)`.

## 🔴 Why asserting the whole body is brittle

```java
// Don't
assertThat(result).bodyText().isEqualTo(
    "{\"id\":42,\"reference\":\"ORD-42\",\"status\":\"CONFIRMED\",\"total\":42.50}");
```

That assertion fails when any of five unrelated things change, and only one of them is a contract
violation:

1. **A new field is added.** Adding an optional field to a response is a backwards-compatible
   change under every API-evolution guideline, and this test says it is not.
2. **Field order changes.** Jackson's ordering follows declaration order, so reordering the record
   components — a pure refactor — breaks it.
3. **Whitespace or pretty-printing changes.** One property
   (`spring.jackson.serialization.indent-output`) breaks every such assertion in the suite.
4. **A number's representation changes.** `42.50` versus `42.5` is the same JSON number and a
   different string.
5. **The actual contract breaks.** The one case you wanted.

So a whole-body string equality has a false-failure rate of four to one, and each false failure
costs a developer the time to prove it is false. Worse, the fix is usually to paste the new body
in — which means the assertion has stopped being a specification and become a snapshot of whatever
the code currently does.

**Assert the promises.** The reference's framing is that response assertions are the important
ones; the corollary is that they should be as specific as the promise and no more:

```java
assertThat(result)
    .hasStatus(HttpStatus.CREATED)
    .hasHeader("Location", "/orders/42")
    .bodyJson().extractingPath("$.reference").isEqualTo("ORD-42");
```

Structural JSON comparison — where you *do* want the whole document but on the document's terms
rather than the string's — is the subject of [05b · JSON assertions](05b-json-assertions.md), and
it is the right answer whenever "the whole body" genuinely is the contract.

## Bridging to classic matchers from AssertJ

Two methods on `MvcTestResultAssert` make the classic matcher library available inside a fluent
chain:

```java
public MvcTestResultAssert matches(ResultMatcher resultMatcher) { … }
public MvcTestResultAssert apply(ResultHandler resultHandler) { … }
```

which means anything written as a `ResultMatcher` works from the AssertJ API — including matcher
libraries that have no AssertJ equivalent:

```java
assertThat(mvc.get().uri("/account"))
        .matches(SecurityMockMvcResultMatchers.authenticated().withUsername("alice"))
        .hasStatusOk();
```

That is how Spring Security's result matchers reach the new API
([08 · Security in a slice](08-security-in-a-slice.md)), and it is worth knowing before you
conclude a library "does not support `MockMvcTester`".

## `debug()` — and the ordering rule in its javadoc

```java
assertThat(result).debug().hasStatusOk();     // prints, then asserts
```

> *"Print `MvcResult` details to `System.out`. **You must call it before calling the assertion**
> otherwise it is ignored as the failing assertion breaks the chained call by throwing an
> `AssertionError`."*

That is the AssertJ counterpart of `andDo(print())`, with the same variants —
`debug(OutputStream)` and `debug(Writer)` — implemented by delegating to
`MockMvcResultHandlers.print(...)`. The ordering rule is the part to remember: `.hasStatusOk()
.debug()` prints nothing on the run where you needed it, because the assertion threw first.

In a Boot slice you rarely need either: `@AutoConfigureMockMvc` prints on failure already
([02b](02b-narrowing-and-what-it-costs.md)).

## Gotchas

**★ `hasStatus2xxSuccessful()` on a `POST` that is specified to return 201.**
It passes for 200 too, so a regression from 201 to 200 — which changes what a spec-following
client does — is invisible. Assert the code.

**★ `hasContentType("application/json")` against a response carrying a charset.**
`hasContentType` is equality including parameters. Use `hasContentTypeCompatibleWith`, which is
`MediaType.isCompatibleWith` and ignores parameters, unless the parameter is part of the contract.

**★ Asserting the entire response body as a string.**
It fails on added fields, reordered fields, formatting changes and equivalent number
representations — four ways to fail that are not contract violations. Assert the fields you
promised, or compare structurally.

**★ Pasting the new body in when a whole-body assertion fails.**
At that point the test records what the code does rather than what it should do, and it will never
catch a regression again. If the whole body really is the contract, use a structural comparison
against a checked-in file so the diff is reviewable.

**★ `assertThat(result).hasStatusOk().debug()`.**
`debug()` after the assertion prints nothing when the assertion fails — *"you must call it before
calling the assertion"*. Put it first, or remove it and rely on the slice's failure printing.

**★ Asserting the forwarded or redirected URL and believing you tested the target.**
Nothing is fetched. The response records where the controller asked to go; there is no second
dispatch ([01b](01b-the-blank-request.md)). A test of the destination is a separate request.

**★ Concluding a matcher library "does not support the AssertJ API".**
`matches(ResultMatcher)` and `apply(ResultHandler)` bridge every classic matcher and handler into
the fluent chain.

**★ Chaining response assertions with `andExpect` in the classic API when you want them all.**
`andExpect` is fail-fast; a wrong status hides a wrong content type and a wrong body — exactly the
three things you wanted to see together. `andExpectAll(...)` reports all of them
([03b](03b-the-classic-api.md)).

**★ Asserting `handler()` or `model()` for a JSON API.**
They are server-side internals a client cannot observe, and the reference is explicit that the
response matters most. Use them to diagnose, then delete them or turn them into a response
assertion.

## Interview questions

**★ What is the difference between `hasContentType` and `hasContentTypeCompatibleWith`?**
Equality versus compatibility. `hasContentType` delegates to `isEqualTo` on the whole `MediaType`,
so `application/json` does not equal `application/json;charset=UTF-8`.
`hasContentTypeCompatibleWith` delegates to `MediaType.isCompatibleWith`, which ignores parameters
and honours wildcards. Use compatibility unless the parameters are themselves part of the
published contract.

**★ Why is asserting the whole response body as a string a bad default?**
Because four of the five ways it can fail are not contract violations: a new optional field,
reordered fields, a formatting change, or a different textual representation of the same number.
The fifth is the real regression. A test with that ratio trains its readers to fix it by pasting
in the new body, at which point it no longer specifies anything.

**★ When is a status-family assertion appropriate?**
When the specific code genuinely is not part of the promise — for example asserting
`hasStatus4xxClientError()` for a malformed request that more than one validator could reject with
different codes. For anything you published — 200, 201, 204, 404, 409 — assert the code, because
the code is the contract.

**★ How do you use a Spring Security result matcher from `MockMvcTester`?**
`assertThat(...).matches(SecurityMockMvcResultMatchers.authenticated().withUsername("alice"))`.
`MvcTestResultAssert.matches(ResultMatcher)` and `apply(ResultHandler)` run any classic matcher or
handler against the underlying `MvcResult` inside the AssertJ chain.

**★ Your `debug()` call printed nothing on the run that failed. Why?**
Because it was after the failing assertion. Its javadoc says *"You must call it before calling the
assertion otherwise it is ignored as the failing assertion breaks the chained call by throwing an
`AssertionError`."* Move it to the front of the chain.

**★ A `MockMvc` test asserts `hasRedirectedUrl("/login")`. What has it proved?**
That the controller — or a filter — set a redirect to `/login` on the response. Nothing about
`/login` itself: MockMvc performs no second dispatch, and the redirect is recorded rather than
followed. Testing the destination is another request.

{/* FOOTER */}
