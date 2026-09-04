---
title: "The classic perform/andExpect API is still what most of the Framework's own MockMvc documentation is written in, and its single most consequential detail is one sentence in that documentation — andExpect stops at the first failure, andExpectAll does not — which decides whether a failing test tells you one thing about the response or everything that is wrong with it"
sidebar_label: "03b · The classic API"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "Hamcrest
> Integration", "Static Imports", "Defining Expectations", "Setup Features" and "Setup"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest.html))
> — read as asciidoc source at tag `v7.0.9`, with every listing below taken from those pages;
> plus the `spring-test` 7.0.9 javadoc for `MockMvc`, `ResultActions` and `MvcResult`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9 (docs read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7, Hamcrest 3.0.
> **No sandbox** — this page carries Java source, never a fabricated test run.

**[03](03-mockmvctester.md) covers the AssertJ front end and the reason a Boot 4 codebase will
default to it. This is the other one, and it is not a legacy chapter: it is what the majority of
the Framework's MockMvc documentation is written in, what every existing test suite contains, and
what Spring Security's own testing documentation uses throughout. It also has one behaviour with
no equivalent in the fluent API. Where the two front ends genuinely diverge — unhandled
exceptions, and asynchronous handlers — is
[03c · Resolved and unresolved failures](03c-resolved-and-unresolved-failures.md).**

## The four static imports, and why they are a design cost

The reference lists them:

> *"When using MockMvc directly to perform requests, you'll need static imports for:
> `MockMvcBuilders.*` · `MockMvcRequestBuilders.*` · `MockMvcResultMatchers.*` ·
> `MockMvcResultHandlers.*`. An easy way to remember that is search for `MockMvc*`."*

That advice — "search for `MockMvc*`" — is the honest measure of the problem. Nothing in
`mockMvc.perform(get("/accounts/1")).andExpect(status().isOk())` tells an IDE where `get`,
`status` or `isOk` come from until the imports exist, so code completion is unhelpful on a blank
file and a mistyped matcher looks like a missing method. Removing that is the first of
[03](03-mockmvctester.md)'s three stated reasons for the AssertJ API.

It is worth knowing the same page's aside, because it is a third option people forget:

> *"When using MockMvc through the WebTestClient you do not need static imports. The
> `WebTestClient` provides a fluent API without static imports."*

`WebTestClient` with `MockMvc` plugged in as the server is a real third front end, and it is the
one that also runs unchanged against a live server —
[09 · What MockMvc cannot test](09-what-mockmvc-cannot-test.md).

## The shape

```java
// static import of MockMvcRequestBuilders.* and MockMvcResultMatchers.*

mockMvc.perform(get("/accounts/1")).andExpect(status().isOk());
```

`perform(RequestBuilder)` executes immediately and returns `ResultActions`, which offers
`andExpect`, `andExpectAll`, `andDo` and `andReturn`. Unlike `MockMvcTester`, there is no
deferred exchange: the request is sent by `perform`, full stop —
[03](03-mockmvctester.md)'s "a builder you never wrapped never ran" failure mode does not exist
here.

## 🔴 `andExpect` stops at the first failure; `andExpectAll` does not

This is the sentence to memorise, and both halves are verbatim:

> *"You can define expectations by appending one or more `andExpect(..)` calls after performing a
> request… **As soon as one expectation fails, no other expectations will be asserted.**"*
>
> *"You can define multiple expectations by appending `andExpectAll(..)`… In contrast to
> `andExpect(..)`, `andExpectAll(..)` guarantees that **all** supplied expectations will be
> asserted and that **all** failures will be tracked and reported."*

```java
// Fails on status, and never tells you the content type was also wrong
mockMvc.perform(get("/accounts/1"))
    .andExpect(status().isOk())
    .andExpect(content().contentType("application/json;charset=UTF-8"));

// Reports both
mockMvc.perform(get("/accounts/1")).andExpectAll(
    status().isOk(),
    content().contentType("application/json;charset=UTF-8"));
```

A chain of `andExpect` calls is a fail-fast assertion sequence, so a 500 response tells you the
status is wrong and nothing about the body — which is exactly the information you needed to
diagnose the 500. `andExpectAll` is the classic API's soft assertion, and it is the direct
equivalent of AssertJ's `SoftAssertions`
([06 · Soft assertions](../02-assertj/06-soft-assertions.md)). Prefer it whenever you have more
than one expectation, which is almost always.

## The two categories of expectation, and which one to use

The reference divides them and states a preference:

> *"Expectations fall in two general categories. The first category of assertions verifies
> properties of the response (for example, the response status, headers, and content). **These
> are the most important results to assert.** The second category of assertions goes beyond the
> response. These assertions let you inspect Spring MVC specific aspects, such as which
> controller method processed the request, whether an exception was raised and handled, what the
> content of the model is, what view was selected, what flash attributes were added, and so on.
> They also let you inspect Servlet specific aspects, such as request and session attributes."*

The second category is the server-side privilege from [01b](01b-the-blank-request.md), and it
carries the same warning: it is available, it is occasionally the only way to see what happened,
and it couples the test to internals a client cannot observe. Its most defensible use is the one
the reference itself demonstrates — binding and validation failure, where the model *is* the
observable outcome for a form controller:

```java
mockMvc.perform(post("/persons"))
    .andExpect(status().isOk())
    .andExpect(model().attributeHasErrors("person"));
```

For a JSON API the equivalent belongs in the response body, and that is
[06 · Validation errors](06-validation-errors.md).

## `andDo(print())` — what it prints and when it does not

```java
mockMvc.perform(post("/persons"))
    .andDo(print())
    .andExpect(status().isOk())
    .andExpect(model().attributeHasErrors("person"));
```

> *"As long as request processing does not cause an unhandled exception, the `print()` method
> prints all the available result data to `System.out`. There is also a `log()` method and two
> additional variants of the `print()` method, one that accepts an `OutputStream` and one that
> accepts a `Writer`… If you want to have the result data logged instead of printed, you can
> invoke the `log()` method, which logs the result data as a single `DEBUG` message under the
> `org.springframework.test.web.servlet.result` logging category."*

Two things to take from that. **`print()` is silent exactly when you need it most** — an
unhandled exception is the case where you most want the dump, and it is the documented exception
to "prints all the available result data". And `log()` exists, which is the better choice in CI:
one DEBUG message under a named category is greppable and can be switched on without editing test
code.

In a Boot slice you do not need `andDo(print())` at all, because `@AutoConfigureMockMvc` already
prints — and by default only on failure, which is what you wanted anyway
([02b](02b-narrowing-and-what-it-costs.md)).

## `andReturn()`, and the honest reason to use it

> *"In some cases, you may want to get direct access to the result and verify something that
> cannot be verified otherwise. This can be achieved by appending `.andReturn()` after all other
> expectations."*

```java
MvcResult mvcResult = mockMvc.perform(post("/persons"))
        .andExpect(status().isOk())
        .andReturn();
String body = mvcResult.getResponse().getContentAsString();
```

Note *"after all other expectations"*. `andReturn()` ends the chain; anything you assert on the
`MvcResult` afterwards is ordinary JUnit or AssertJ code, which is a perfectly good place to be —
it is also how you reach the async dispatch, and that is
[03c · Resolved and unresolved failures](03c-resolved-and-unresolved-failures.md).

## Setup features that apply to every request

```java
// static import of MockMvcBuilders.standaloneSetup

MockMvc mockMvc = standaloneSetup(new MusicController())
    .defaultRequest(get("/").accept(MediaType.APPLICATION_JSON))
    .alwaysExpect(status().isOk())
    .alwaysExpect(content().contentType("application/json;charset=UTF-8"))
    .build();
```

`defaultRequest` supplies properties every request inherits — the reference notes that *"if the
same property is also specified on a given request, it overrides the default value"*, and that
the method and URI in the default request are irrelevant since both must be given per request.

⚠️ `alwaysExpect` has a sharper edge, and the reference says so:

> *"Note that common expectations are always applied and cannot be overridden without creating a
> separate `MockMvc` instance."*

So `alwaysExpect(status().isOk())` makes it **impossible** to write a test in that class for a 404
or a 400. The error-path test then has to build a second `MockMvc`, which nobody does, so the
error paths quietly go untested. It is a tidy-looking setting with a large blast radius.

There is also `MockMvcConfigurer`, which third parties use to pre-package setup — the Framework's
own is `sharedHttpSession()`:

```java
// static import of SharedHttpSessionConfigurer.sharedHttpSession

MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
        .apply(sharedHttpSession())
        .build();
```

That mechanism is how Spring Security's `springSecurity()` is applied outside Boot —
[08 · Security in a slice](08-security-in-a-slice.md).

## JSONPath and XPath

```java
mockMvc.perform(get("/people").accept(MediaType.APPLICATION_JSON))
    .andExpect(jsonPath("$.links[?(@.rel == 'self')].href").value("http://localhost:8080/people"));
```

```java
Map<String, String> ns = Collections.singletonMap("ns", "http://www.w3.org/2005/Atom");
mockMvc.perform(get("/handle").accept(MediaType.APPLICATION_XML))
    .andExpect(xpath("/person/ns:link[@rel='self']/@href", ns).string("http://localhost:8080/people"));
```

Both listings are the reference's, and JSONPath is the shared ground between the two APIs —
`jsonPath(...)` here, `bodyJson().extractingPath(...)` there. The expression language is the same
and its traps are the same: [05b · JSON assertions](05b-json-assertions.md).

## Gotchas

**★ A chain of `andExpect` calls when you wanted all the failures.**
*"As soon as one expectation fails, no other expectations will be asserted."* A wrong status hides
a wrong content type and a wrong body. Use `andExpectAll(...)`, which *"guarantees that all
supplied expectations will be asserted and that all failures will be tracked and reported."*

**★ `alwaysExpect(status().isOk())` in the builder.**
Common expectations *"cannot be overridden without creating a separate `MockMvc` instance"*, so
every error-path test in that class is now unwritable. The 400s and 404s silently never get
tested.

**★ Expecting `andDo(print())` to show you the unhandled exception.**
It prints *"as long as request processing does not cause an unhandled exception"* — the one case
you most wanted it for. Assert on the exception instead, or use `andReturn().getResolvedException()`.

**★ Adding `andDo(print())` in a Boot slice.**
`@AutoConfigureMockMvc` already prints, and by default only on failure. Adding `print()`
unconditionally turns a quiet passing suite into a noisy one.

**★ Putting `andReturn()` in the middle of the chain.**
It ends the chain — the reference says to append it *"after all other expectations"*. It returns
`MvcResult`, not `ResultActions`, so it does not compile in the middle; the real mistake is
reaching for it early and doing in plain Java what a matcher would have said better.

**★ Forgetting a static import and concluding the method does not exist.**
`status()`, `content()`, `jsonPath()`, `get()`, `print()` are all static members of four
`MockMvc*` classes. The reference's own advice is to add them as IDE favourites, which is a
workaround for an API shape, not a feature.


**★ Assuming the second category of assertions is the powerful one.**
The reference is explicit that response assertions *"are the most important results to assert"*.
Handler, model and view assertions describe internals; they are worth reaching for when the
response genuinely cannot answer the question, and not before.

**★ Mixing `andExpect` and `andExpectAll` in one chain.**
Legal and confusing: the `andExpect` calls stay fail-fast while the `andExpectAll` group is not,
so which failures you see depends on the order you wrote them in. Pick one per test.

## Interview questions

**★ What is the difference between `andExpect` and `andExpectAll`?**
`andExpect` is fail-fast — *"as soon as one expectation fails, no other expectations will be
asserted"* — so a failing status hides everything after it. `andExpectAll` *"guarantees that all
supplied expectations will be asserted and that all failures will be tracked and reported"*. It is
the classic API's soft assertion and it should be the default whenever there is more than one
expectation.

**★ Why does the classic API need four static imports?**
Because requests, matchers, handlers and builders are all static factory methods on separate
classes — `MockMvcBuilders`, `MockMvcRequestBuilders`, `MockMvcResultMatchers`,
`MockMvcResultHandlers`. The reference's advice is literally to search for `MockMvc*` and to add
them as IDE favourites. Eliminating that is the first of the three reasons the AssertJ front end
exists.

**★ When is `andDo(print())` unhelpful?**
When request processing caused an unhandled exception — the reference qualifies the whole feature
with *"as long as request processing does not cause an unhandled exception"*, and that is the case
you most wanted a dump for. In CI, `log()` is usually the better tool anyway: one DEBUG message
under `org.springframework.test.web.servlet.result`, switchable without editing the test.

**★ What is wrong with `alwaysExpect(status().isOk())`?**
Common expectations cannot be overridden per request — *"cannot be overridden without creating a
separate `MockMvc` instance"* — so no test using that instance can assert a 400, 404 or 500. The
happy path gets tidier and the error paths become unwritable, which is the opposite of the trade
you want.

**★ Would you migrate an existing suite from `perform`/`andExpect` to `MockMvcTester`?**
Not wholesale. Neither API is deprecated, the Framework reference documents the classic one most
fully, and Spring Security's testing documentation is written in it. `MockMvcTester.create(mockMvc)`
lets both run against one configured instance, so new tests can use the fluent API while existing
ones stay put.

{/* FOOTER */}
