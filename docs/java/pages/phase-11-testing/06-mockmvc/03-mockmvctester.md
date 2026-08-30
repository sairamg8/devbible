---
title: "MockMvcTester is not the Framework reference's declared successor to MockMvc — the reference presents both as front ends on the same engine and lists Hamcrest first — but Boot 4.1 has switched every one of its own examples to it, and the mechanical difference that matters is that building a request does nothing until assertThat() performs it"
sidebar_label: "03 · MockMvcTester"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "MockMvc",
> "Overview", "AssertJ Integration", "Configuring MockMvcTester", "Performing Requests" and
> "Defining Expectations"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc.html),
> [assertj](https://docs.spring.io/spring-framework/reference/testing/mockmvc/assertj.html)) —
> read as asciidoc source at tag `v7.0.9`, with the code listings read from the reference's own
> `framework-docs` sources; the `spring-test` 7.0.9 sources for
> `org.springframework.test.web.servlet.assertj.MockMvcTester`, `MvcTestResult` and
> `MvcTestResultAssert`; and the **Spring Boot 4.1** reference "Testing Spring Boot Applications"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8 (docs and sources read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**There are two front ends on `MockMvc` and choosing between them is a real decision, so it is
worth knowing exactly what the documentation says rather than what the internet says. The short
version: the Framework reference documents them as peers and puts Hamcrest first; Spring Boot's
reference has rewritten all of its MockMvc examples in `MockMvcTester`; neither deprecates the
other; they share one engine. This chunk is `MockMvcTester` — what it is, the three problems it
was built to solve, and the one mechanical surprise in its design.
[03b · The classic API](03b-the-classic-api.md) is the other one, and
[03c · Resolved and unresolved failures](03c-resolved-and-unresolved-failures.md) is where the two genuinely behave
differently.**

## 🔴 What the two references actually say — they do not agree on emphasis

The Framework reference's opening sentence names both, in this order:

> *"MockMvc can be used on its own to perform requests and verify responses using Hamcrest or
> through `MockMvcTester` which provides a fluent API using AssertJ."*

and the Overview page repeats it almost word for word. There is no deprecation notice, no
"prefer", no migration guide. The documentation tree matches that neutrality and, if anything,
leans the other way: under `testing/mockmvc/` there is a `hamcrest/` section with eight pages and
an `assertj/` section with four.

Spring Boot's reference tells a different story. Every MockMvc example in Boot 4.1's testing
chapter and its testing how-to is written with `MockMvcTester` and `assertThat(...)`. Boot also
auto-configures it without being asked — `@AutoConfigureMockMvc`'s javadoc:

> *"Annotation that can be applied to a test class to enable and configure auto-configuration of
> `MockMvc`. **If AssertJ is available a `MockMvcTester` is auto-configured as well.**"*

**The reconciliation to state out loud, because a reader on Boot 4.1 will see both:** the
Framework team documents two supported front ends and does not pick one; the Boot team has picked
one for its own examples. `MockMvcTester` is the newer API — `@since 6.2` — and it is the one a
new Boot 4 codebase will be shown. The classic API is not going anywhere: it is what the majority
of the Framework's own MockMvc documentation is written in, and it is what every existing codebase
contains.

Do not repeat "the reference says `MockMvcTester` is current". It does not.

## The three problems it was built to solve

The AssertJ Integration page states them, and they are the honest case for the API:

> *"There is no need to use static imports as both the requests and assertions can be crafted
> using a fluent API."*
>
> *"Unresolved exceptions are handled consistently so that your tests do not need to throw (or
> catch) `Exception`."*
>
> *"By default, the result to assert is complete whether the processing is asynchronous or not.
> In other words, there is no need for special handling for Async requests."*

The first is ergonomics — the classic API needs `MockMvcRequestBuilders.get`,
`MockMvcResultMatchers.status`, `jsonPath`, `content` and often `MockMvcResultHandlers.print` all
statically imported, and an IDE that has not been told about them offers nothing. The second and
third are behavioural and they are the real content; both are
[03c · Resolved and unresolved failures](03c-resolved-and-unresolved-failures.md).

## Creating one

Three factory methods, and they are not interchangeable:

```java
// 1. Standalone — you supply the controllers, Spring MVC infrastructure is built programmatically
MockMvcTester mvc = MockMvcTester.of(new PersonController());

// 2. From a context — your actual MVC configuration
MockMvcTester mvc = MockMvcTester.from(applicationContext);
MockMvcTester mvc = MockMvcTester.from(applicationContext, builder -> builder.addFilters(filter).build());

// 3. From a MockMvc you already have
MockMvcTester mvc = MockMvcTester.create(mockMvc);
```

Note the naming: **`of(...)` takes controllers, `from(...)` takes a context.** They are the two
setup options from [01](01-no-socket-no-server.md) with different names, and the trade between
them is unchanged. The third exists for the migration case — the reference: *"if you have a
`MockMvc` instance handy, you can create a `MockMvcTester` by providing the `MockMvc` instance to
use using the `create` factory method."* That is the low-risk way to introduce the new API into a
codebase full of the old one: one shared `MockMvc`, two front ends.

In a Boot slice you create nothing:

```java
@WebMvcTest(OrderController.class)
class OrderControllerTests {
    @Autowired MockMvcTester mvc;          // and @Autowired MockMvc also works, from the same context
    @MockitoBean OrderService orders;
}
```

## 🔴 The mechanical surprise: `assertThat()` is what performs the request

The reference states it plainly and it is easy to read past:

> *"The builder that is returned is AssertJ-aware so that wrapping it in the regular
> `assertThat()` factory method triggers the exchange and provides access to a dedicated Assert
> object for `MvcTestResult`."*

So this line does not perform a request:

```java
var request = mvc.post().uri("/orders").content(body);   // nothing has happened
```

and this one does:

```java
assertThat(mvc.post().uri("/orders").content(body)).hasStatus(HttpStatus.CREATED);
```

Two consequences follow directly.

**A builder you never wrap in `assertThat()` never runs.** A test that arranges a `POST` and then
only asserts on a mock — `verify(orders).create(any())` — silently never sent the request, and the
verification failure looks like a controller bug. In the classic API `perform(...)` executes
immediately, so this failure mode does not exist there.

**Do not reuse a builder for two assertions.** Each `assertThat(builder)` triggers an exchange, so
two `assertThat` calls on the same builder are two requests against a controller that may not be
idempotent. When you want several assertions on one response, that is what `exchange()` is for:

```java
MvcTestResult result = mvc.post().uri("/hotels/{id}", 42)
        .accept(MediaType.APPLICATION_JSON).exchange();

assertThat(result).hasStatus(HttpStatus.CREATED);
assertThat(result).body().isEmpty();
```

That listing is the reference's own shape, and the guidance with it is explicit: *"Rather than
having a single statement as in the case above, you can use `.exchange()` to return a
`MvcTestResult` that can be used in multiple `assertThat` statements."*

## The assertion surface

The reference's own example, verbatim from its sources:

```java
assertThat(mockMvc.get().uri("/hotels/{id}", 42))
        .hasStatusOk()
        .hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON)
        .bodyJson().isLenientlyEqualTo("sample/hotel-42.json");
```

`MvcTestResultAssert` exposes dedicated assert objects for each part of the exchange —
`.body()`, `.bodyJson()`, `.headers()`, `.cookies()`, `.request()`, `.model()`, `.handler()`,
`.flash()`, `.failure()` — each returning an AssertJ assert type, so completion is useful and the
failure messages are AssertJ's. Status has both generic and named forms (`hasStatus(int)`,
`hasStatus(HttpStatus)`, `hasStatusOk()`, `hasStatus5xxServerError()`).

Response assertions are [05 · Asserting the response](05-asserting-the-response.md) and the JSON
support is [05b · JSON assertions](05b-json-assertions.md); the point here is only that the
surface is AssertJ's, so `as(...)`, `satisfies(...)`, `extracting(...)` and soft assertions
([06 · Soft assertions](../02-assertj/06-soft-assertions.md)) all apply.

## The bridge back to the classic builders

`MockMvcTester` can drive the old request builders:

```java
assertThat(mvc.perform(get("/hi")))
        .hasStatusOk().hasBodyTextEqualTo("Hello");
```

The javadoc explains when to use it, and attaches a warning that is easy to miss:

> *"Use this approach if you have a custom `RequestBuilder` implementation that you'd like to
> integrate here. **This approach is also invoking `MockMvc` without any additional processing of
> asynchronous requests.**"*

So `perform(...)` gives you AssertJ assertions but **not** the automatic async completion that is
one of the three reasons the API exists. Use it for a custom `RequestBuilder` — a
`SecurityMockMvcRequestBuilders` form, say — and not as a general migration shortcut.

## Gotchas

**★ Saying "the reference presents `MockMvcTester` as the current idiom".**
It does not. The Framework reference names Hamcrest first, documents both as front ends on the
same engine, and gives Hamcrest twice as many pages. What is true is that **Boot 4.1** writes all
of its own examples with `MockMvcTester`.

**★ Building a request and never wrapping it in `assertThat()`.**
Nothing is sent. `assertThat()` triggers the exchange. A test that then verifies a mock
interaction fails with a message about the mock, and the cause is a request that never happened.

**★ Reusing one builder across two `assertThat()` calls.**
That is two requests. For a `POST` that creates something, the second one creates it again. Call
`exchange()` once and assert on the resulting `MvcTestResult`.

**★ Assuming `mvc.perform(...)` is just the fluent API with old builders.**
It also opts out of the automatic async handling — *"without any additional processing of
asynchronous requests"*. If the handler returns a `CompletableFuture` or a `DeferredResult`, the
result you assert on is the one from the initial dispatch.

**★ Using `MockMvcTester.of(SomeController.class)` in a Boot slice.**
In a Boot test you should be `@Autowired`-ing the auto-configured instance, which is built from
your context. Constructing a standalone tester inside a `@WebMvcTest` throws away the context you
just paid to build and silently loses your `@ControllerAdvice`, converters and filters.

**★ Confusing `of` and `from`.**
`of(...)` is standalone and takes controller instances or types; `from(...)` takes a
`WebApplicationContext`. They produce quite different tests — [01](01-no-socket-no-server.md) —
and the names give you no help remembering which.

**★ Adding `MockMvcTester` to a codebase by rewriting every test at once.**
`MockMvcTester.create(existingMockMvc)` exists so both front ends can run against one configured
`MockMvc`. Migrate a test class at a time and leave the setup alone.

**★ Expecting AssertJ to be optional.**
Boot's auto-configuration of `MockMvcTester` is conditional on AssertJ being available. In a Boot
test that is guaranteed by `spring-boot-starter-test`; in a plain `spring-test` project it is not,
and there `MockMvcTester` simply is not usable.

## Interview questions

**★ Is `MockMvcTester` the replacement for `MockMvc`?**
No, and it is worth being precise. It is a front end onto the same `MockMvc` engine, added in
Framework 6.2, that returns AssertJ-compatible results. The Framework reference documents it and
the Hamcrest API as peers — *"MockMvc can be used on its own to perform requests and verify
responses using Hamcrest or through `MockMvcTester` which provides a fluent API using AssertJ"* —
and lists Hamcrest first with more pages. Spring Boot 4.1 has switched all of its own examples to
`MockMvcTester` and auto-configures it whenever AssertJ is present, so a new Boot codebase will
default to it.

**★ What three problems does the AssertJ integration claim to solve?**
No static imports, because requests and assertions are both fluent; consistent handling of
unresolved exceptions, so tests do not have to declare or catch `Exception`; and completion of
asynchronous requests by default, so async needs no special handling. The first is ergonomics; the
other two change behaviour.

**★ In `assertThat(mvc.get().uri("/orders/1")).hasStatusOk()`, when is the request performed?**
Inside `assertThat()`. The builder is AssertJ-aware and wrapping it *"triggers the exchange"*. A
builder that is never wrapped never performs a request, and wrapping the same builder twice
performs two.

**★ You need five assertions about one response. How do you write it?**
Call `.exchange()` to get an `MvcTestResult` and assert on that value repeatedly. Chaining five
assertions off one `assertThat(builder)` also works, but assigning the result is the reference's
own recommendation for multi-assertion cases and it makes it impossible to accidentally perform
the request twice.

**★ What is `mvc.perform(...)` for, and what does it cost?**
It lets `MockMvcTester` drive a classic `RequestBuilder`, which is the way to use a custom builder
— Spring Security's, for instance — with AssertJ assertions. The cost is in its javadoc: it
invokes `MockMvc` *"without any additional processing of asynchronous requests"*, so you lose the
automatic waiting that is one of the API's three selling points.

**★ How would you introduce `MockMvcTester` into a codebase full of `perform(...).andExpect(...)`
tests?** `MockMvcTester.create(existingMockMvc)` wraps the `MockMvc` you already configure, so both
styles work against one setup. Convert a class at a time; there is no deprecation pressure and the
Framework reference still documents the classic API most fully.

{/* FOOTER */}
