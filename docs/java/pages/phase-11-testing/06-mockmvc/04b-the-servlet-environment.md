---
title: "Everything the mock request carries besides the HTTP message — session, cookies, locale, principal, flash and request attributes, the scheme and the API version — is set through the same builder, and the defaults are the ones that bite: isSecure() is false, getUserPrincipal() is not a SecurityContext, and cookies are always added rather than replaced"
sidebar_label: "04b · The Servlet environment"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "Performing Requests"
> ([hamcrest](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/requests.html),
> [assertj](https://docs.spring.io/spring-framework/reference/testing/mockmvc/assertj/requests.html))
> and "Setup Features" — read as asciidoc source at tag `v7.0.9` — and the `spring-test` 7.0.9
> sources for `AbstractMockHttpServletRequestBuilder`,
> `AbstractMockMultipartHttpServletRequestBuilder`, `MockMultipartFile` and `RequestPostProcessor`,
> from which every javadoc sentence and code excerpt below is taken.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8 (docs and sources read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[04](04-building-a-request.md) covers the HTTP message. A Servlet request is more than its
message: it has a session, cookies, a locale, a principal, attribute maps, a scheme, a remote
address and — in Spring Framework 7 — an API version. All of it is blank until the test supplies
it ([01b](01b-the-blank-request.md)) and all of it is on the same builder. Multipart requests and
the `RequestPostProcessor` extension point everything else plugs into are
[04c · Multipart and request post-processors](04c-multipart-and-request-postprocessors.md).**

## Session, and the attribute maps

```java
.session(existingMockHttpSession)          // reuse a session across requests
.sessionAttr("cart", cart)                 // one attribute into (a new or the given) session
.sessionAttrs(Map.of("cart", cart, "step", 2))
.requestAttr("tenant", "acme")             // request scope, gone after this request
.flashAttr("message", "Saved")             // flash scope, survives one redirect
.flashAttrs(Map.of("message", "Saved"))
```

The `session(...)` javadoc contains the precedence rule people get wrong:

> *"Set the HTTP session to use, possibly re-used across requests. **Individual attributes provided
> via `sessionAttr(String, Object)` override the content of the session provided here.**"*

So a shared session plus a per-request `sessionAttr` is a legitimate pattern: the session is the
background, the attribute is this test's variation.

For a multi-request flow — log in, then act — you either thread a `MockHttpSession` through by
hand:

```java
MockHttpSession session = (MockHttpSession) mvc.post().uri("/login")
        .param("username", "alice").param("password", "s3cret")
        .exchange().getRequest().getSession();

assertThat(mvc.get().uri("/account").session(session)).hasStatusOk();
```

or apply the Framework's own configurer once, which the reference documents under Setup Features:

```java
// static import of SharedHttpSessionConfigurer.sharedHttpSession

MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
        .apply(sharedHttpSession())
        .build();
```

⚠️ `sharedHttpSession()` makes the tests in that class stateful and therefore order-sensitive —
the same hazard as any shared fixture
([12e · Shared state](../01-junit-5/12e-shared-state-under-parallelism.md)). It earns its place
for a genuine multi-step flow and is a liability everywhere else.

**Flash attributes** are the redirect mechanism: a controller puts them in
`RedirectAttributes`, they survive exactly one redirect, and they are gone. Setting one on the
request simulates *arriving after* such a redirect — which is how you test the page that displays
the message without also testing the action that produced it.

## Cookies, locale, principal, scheme and address

```java
.cookie(new Cookie("session-hint", "dark-mode"))
.locale(Locale.FRANCE)                       // or locale(Locale...) for an ordered list
.principal(() -> "alice")                    // a java.security.Principal
.secure(true)                                // request.isSecure(), and getScheme() == "https"
.remoteAddress("203.0.113.7")
```

`cookie`'s javadoc is one line and it is the useful one: *"Add the given cookies to the request.
**Cookies are always added.**"* — there is no replace semantic, so calling it twice with the same
name gives the request two cookies of that name, which is legal HTTP and usually not what you
meant.

`principal(...)` is the low-level way to give the request a user. It sets
`request.getUserPrincipal()` and nothing else — no `SecurityContext`, no authorities, no
`@PreAuthorize` support. When Spring Security is in play the tools you want are
`SecurityMockMvcRequestPostProcessors.user(...)` and `@WithMockUser`, and they are
[08 · Security in a slice](08-security-in-a-slice.md). Use `principal(...)` when the controller
takes a `Principal` parameter and there is no Security on the classpath at all.

`secure(true)` matters more than it looks: `RequestContextHolder`-based URI building, cookie
`Secure` flags, and any `requiresSecure()` rule all read it, and it defaults to `false`, so a test
of an HTTPS-only path fails for a reason the test never mentions.

## `contextPath`, `servletPath`, `pathInfo`

```java
mockMvc.perform(get("/app/main/hotels/{id}", 42).contextPath("/app").servletPath("/main"));
```

The javadoc adds a constraint the reference does not state:

> *"The context path, if specified, **must match to the start of the request URI**… If specified
> here, the context path **must start with a "/" and must not end with a "/"**."*

so `contextPath("/app/")` is rejected, and `contextPath("/app")` with a URI of `/orders/42` is
rejected too. The reference's advice remains the one to follow — *"In most cases, it is preferable
to leave the context path and the Servlet path out of the request URI"* — and when you cannot,
`defaultRequest(...)` ([04](04-building-a-request.md)) is where they belong.

## API versioning, new in Framework 7

```java
.apiVersion("1.2")
.apiVersionInserter(ApiVersionInserter.useHeader("X-API-Version"))
```

> *"Set an API version for the request. The version is inserted into the request by the configured
> `ApiVersionInserter`."* — `@since 7.0`
>
> *"An inserter may typically be set once (more centrally) via
> `ConfigurableMockMvcBuilder#defaultRequest(RequestBuilder)`, or
> `ConfigurableMockMvcBuilder#apiVersionInserter(ApiVersionInserter)`."*

The point of the indirection is that the *test* says "version 1.2" and the *inserter* decides
whether that becomes a header, a query parameter, a path segment or a media-type parameter — so
changing the versioning strategy does not rewrite every test. That strategy decision belongs to
[12 · API versioning](../../phase-9-spring-boot/07-rest-controllers/12-api-versioning.md) and
[13 · Versioning strategy](../../phase-9-spring-boot/07-rest-controllers/13-versioning-strategy.md);
setting the inserter once on the builder is the testing half of it.

## Gotchas

**★ `principal(...)` in a Spring Security application.**
It sets `getUserPrincipal()` and nothing else — no `SecurityContext`, no authorities. Every
`@PreAuthorize`, every `authenticated()` rule and every `Authentication` injection still sees an
anonymous request. Use `@WithMockUser` or `user(...)`.

**★ Calling `.cookie(...)` twice with the same name expecting a replace.**
*"Cookies are always added."* You get two cookies with that name and whichever one the code reads
first wins.

**★ Forgetting `secure(true)` for an HTTPS-only path.**
`isSecure()` defaults to `false` and `getScheme()` to `http`, so a `requiresSecure()` rule or a
`Secure`-flagged cookie behaves differently from production, and nothing in the test names the
scheme.

**★ A `contextPath` that ends with a slash, or does not prefix the URI.**
Both are rejected — *"must start with a "/" and must not end with a "/""*, and *"must match to the
start of the request URI"*. The resulting `IllegalArgumentException` at build time is clearer than
the 404 you would otherwise chase.

**★ `sharedHttpSession()` on a class whose tests are independent.**
It makes every test in the class share state, so they become order-dependent and a failure in one
shows up in another. Reserve it for a genuine multi-step flow and thread a `MockHttpSession`
explicitly everywhere else.

**★ Using `flashAttr` to test the controller that *sets* the flash attribute.**
`flashAttr` simulates arriving *after* a redirect that set it. To test the controller that
produces one, assert on the result's flash map — `flash().attribute(...)` or `.flash()` — not on
the request you built.

## Interview questions

**★ How do you carry a session across two MockMvc requests?**
Either take the `MockHttpSession` out of the first result — `result.getRequest().getSession()` —
and pass it to the next request with `.session(session)`, or apply
`SharedHttpSessionConfigurer.sharedHttpSession()` to the builder so every request through that
instance shares one. The first is explicit and keeps tests independent; the second is convenient
and makes the class order-dependent.

**★ What is the difference between `sessionAttr` and `session`?**
`session(...)` supplies a whole `MockHttpSession`, possibly reused; `sessionAttr(...)` sets one
attribute. When both are used the javadoc gives precedence to the attribute: *"Individual
attributes provided via `sessionAttr(String, Object)` override the content of the session provided
here."*

**★ Is `principal(...)` enough to test a secured endpoint?**
No. It populates `HttpServletRequest#getUserPrincipal()` only. Spring Security reads the
`SecurityContext`, so authorization rules, `@PreAuthorize` and `Authentication` method parameters
are all unaffected. The right tools are `@WithMockUser`, `@WithUserDetails` or the
`SecurityMockMvcRequestPostProcessors`.


{/* FOOTER */}
