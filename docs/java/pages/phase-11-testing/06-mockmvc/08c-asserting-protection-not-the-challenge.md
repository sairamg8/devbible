---
title: "Because the status of a rejected request is chosen by a media-type matcher, hasStatus(401) is an assertion about your Accept header rather than about your security — the durable claim is that the handler was never reached, and the third status nobody expects is the 403 a chain with no entry point returns"
sidebar_label: "08c · Asserting protection"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Security 7.1.1** sources —
> [`ExceptionHandlingConfigurer`](https://github.com/spring-projects/spring-security/blob/7.1.1/config/src/main/java/org/springframework/security/config/annotation/web/configurers/ExceptionHandlingConfigurer.java)
> (`getAuthenticationEntryPoint`, `createDefaultEntryPoint`),
> `Http403ForbiddenEntryPoint`, `LoginUrlAuthenticationEntryPoint`,
> `BasicAuthenticationEntryPoint`; the **Spring Framework 7.0.9**
> [`MvcTestResultAssert`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-test/src/main/java/org/springframework/test/web/servlet/assertj/MvcTestResultAssert.java);
> and the **Spring Boot 4.1.1** `ServletWebSecurityAutoConfiguration`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Spring Security 7.1.1, Mockito 5.23.0,
> AssertJ 3.27.7.
> **No sandbox** — this page carries library source and derives behaviour from it; it does
> not report a test run.

**[08b](08b-the-401-and-the-302.md) showed that the status of a rejected request is a
function of the `Accept` header. The consequence for your test suite is uncomfortable:
`hasStatus(401)` is not an assertion about security, it is an assertion about content
negotiation that happens to be true today. This chunk is what to assert instead — the claim
that survives a header edit, a chain rewrite and a move from Basic to bearer tokens — and
the third status, 403, that a chain configuring no entry point at all returns.**

## Assert the effect, not the challenge

What you actually care about is that the endpoint is not served to strangers. That is
observable directly: the collaborator you mocked was never called.

```java
@WebMvcTest(OrderController.class)
class OrderProtectionTests {

    @Autowired MockMvcTester mvc;
    @MockitoBean OrderService orders;

    @Test
    void an_anonymous_request_never_reaches_the_controller() {
        assertThat(mvc.get().uri("/orders")).hasStatus4xxClientError();
        verifyNoInteractions(orders);
    }
}
```

`verifyNoInteractions(orders)` is the durable half. It is true whether the entry point
returns 401, 302 or 403; it is true after you swap Basic for a bearer token; and it fails
loudly the day somebody adds a `permitAll()` to the wrong matcher, which is the regression
this test exists to catch. The status assertion is deliberately loose — it says "rejected",
which is all the status can honestly tell you.

This works because the security filter runs *before* `DispatcherServlet`, so a rejected
request produces no handler invocation at all. It is the same fact that makes the 401
uncatchable by a `@ControllerAdvice` ([08](08-security-in-a-slice.md)).

## When the challenge itself is the contract

Sometimes the challenge *is* published — a client library depends on
`WWW-Authenticate: Bearer`, or a browser flow depends on the redirect target. Then pin it,
but state the assumption the test depends on by setting the `Accept` header explicitly
rather than inheriting `*/*` by accident:

```java
assertThat(mvc.get().uri("/orders").accept(MediaType.APPLICATION_JSON))
    .hasStatus(HttpStatus.UNAUTHORIZED)
    .headers().containsKey(HttpHeaders.WWW_AUTHENTICATE);
```

and for the browser branch, pin the destination rather than the bare 302 — a 302 to the
wrong place is not a passing test:

```java
assertThat(mvc.get().uri("/orders").accept(MediaType.TEXT_HTML))
    .hasStatus(HttpStatus.FOUND)
    .hasRedirectedUrl("/login");
```

🔴 `"/login"`, not `"http://localhost/login"`. `LoginUrlAuthenticationEntryPoint` gained a
`favorRelativeUris` flag in Security **6.5** and it defaults to `true`:

```java
private boolean favorRelativeUris = true;
...
return this.favorRelativeUris ? loginForm : absoluteUri(request, loginForm).getUrl();
```

`DefaultRedirectStrategy.calculateRedirectUrl` then prepends the context path, which is
empty on a `MockHttpServletRequest`. Every article older than Security 6.5 shows the
absolute form, because that is what the entry point used to produce.

Two tests, two explicit `Accept` headers, two named expectations. Compare that with a single
`hasStatus(401)` on a bare request, which asserts one of those branches without saying which
and without saying why.

⚠️ Both of these are assertions about **Boot's default chain** unless you imported your own
([08e](08e-the-chain-you-are-not-testing.md)). Pinning `WWW-Authenticate: Basic`
against a service that ships as a JWT resource server pins a fiction that no client will ever
see.

## The third status: 403 from a chain with no entry point

Everyone learns "401 unauthenticated, 302 browser login". There is a third case, and it is
common in exactly the API-only chains people write today. If a custom chain calls only
`authorizeHttpRequests(...)` and never `formLogin()` or `httpBasic()`, no preferred entry
point is registered, and `ExceptionHandlingConfigurer` falls all the way through:

```java
AuthenticationEntryPoint getAuthenticationEntryPoint(H http) {
    AuthenticationEntryPoint entryPoint = this.authenticationEntryPoint;
    if (entryPoint == null) {
        entryPoint = createDefaultEntryPoint(http);
    }
    return entryPoint;
}

private AuthenticationEntryPoint createDefaultEntryPoint(H http) {
    if (this.defaultEntryPoint == null) {
        return new Http403ForbiddenEntryPoint();
    }
    return this.defaultEntryPoint.build();
}
```

`Http403ForbiddenEntryPoint` sends **403** for an unauthenticated request. So the folk rule
"401 means unauthenticated, 403 means unauthorised" is a statement about *your*
configuration, not about Spring Security, and a test that asserts 401 against a chain like
this fails for a reason that has nothing to do with the endpoint being open.

Three chains, three statuses, one unauthenticated `GET`:

| Chain | Unauthenticated `GET` (no `Accept`) |
|---|---|
| Boot default (`formLogin` + `httpBasic`) | 401, `WWW-Authenticate: Basic` |
| custom, `httpBasic()` only | 401, `WWW-Authenticate: Basic` |
| custom, `authorizeHttpRequests` only | 403, no challenge header |

That table is the argument for `verifyNoInteractions` in one picture: the middle column moves
whenever the chain moves, and the thing you meant to assert does not.

## Bridging to the classic security matchers

Spring Security ships `SecurityMockMvcResultMatchers` — `authenticated()`,
`unauthenticated()` — as `ResultMatcher` implementations, and there is **no** AssertJ-native
equivalent in Security 7.1.1 (the `org.springframework.security.test.web.servlet` package
contains request builders, request post-processors, result handlers and result matchers, and
nothing AssertJ-shaped). You do not need one: `MvcTestResultAssert` has an explicit bridge.

```java
public MvcTestResultAssert matches(ResultMatcher resultMatcher) { … }
public MvcTestResultAssert apply(ResultHandler resultHandler) { … }
```

so a `MockMvcTester` test can still make an authentication assertion:

```java
import static org.springframework.security.test.web.servlet.response
        .SecurityMockMvcResultMatchers.unauthenticated;

assertThat(mvc.get().uri("/orders")).matches(unauthenticated());
```

That is a genuinely different claim from a status: it says the `SecurityContext` associated
with the result holds no authenticated principal. Use it when the *authentication outcome*
is the subject — a bad-password login, a rejected token — and keep
`verifyNoInteractions` for "the handler did not run". The authenticated form and its
`withUsername` / `withRoles` / `withAuthentication` refinements are in
[08g](08g-authenticating-the-test.md).

## Gotchas

**★ Asserting `hasStatus(401)` as your "this endpoint is protected" test.**
The status is a function of the `Accept` header, so the assertion is coupled to something
with nothing to do with protection. A later `.accept(TEXT_HTML)` turns it into 302 and the
test fails while the protection is intact; a chain change to a token-only setup turns it
into 403 and the test fails again. Neither failure is about the endpoint.

**★ Loosening the failing assertion to `hasStatus4xxClientError()` and stopping there.**
A 302 is not 4xx, so that loosening does not even cover the redirect branch — and on its own
it no longer distinguishes "rejected by security" from "400 because the request was
malformed" or "404 because the mapping is wrong". It is only safe *paired* with
`verifyNoInteractions`, which is what makes the claim specific.

**★ Believing `WWW-Authenticate: Basic` proves your API uses HTTP Basic.**
In a bare slice it proves only that `BasicAuthenticationEntryPoint` won the matcher race in
*Boot's default* chain. If your production chain is a JWT resource server
([09 · JWT resource server](../../phase-9-spring-boot/11-spring-security/09-jwt-resource-server.md)),
the slice is advertising a scheme your application does not implement.

**★ Asserting `hasStatus(302)` without asserting where.**
A redirect to `/login` and a redirect to `/error` are both 302. `hasRedirectedUrl(...)` is
the assertion that carries meaning.

**★ Copying `hasRedirectedUrl("http://localhost/login")` out of an older article.**
`LoginUrlAuthenticationEntryPoint.favorRelativeUris` was added in Security 6.5 and defaults
to `true`, so `buildRedirectUrlToLoginPage` now returns the bare `/login` and
`DefaultRedirectStrategy` prepends only the (empty) context path. The absolute form was
correct up to 6.4 and is wrong on 7.1.1 — a genuinely passing behaviour with a failing
assertion.

**★ Assuming the redirect target is absolute because a `Location` header "must be".**
RFC 7231 has permitted relative `Location` values since 2014, and `MockHttpServletResponse`
records exactly what was written. The assertion has to match the string the entry point
produced, not the string a browser would resolve it to.

**★ Trying to fix the 302 by adding a `/login` handler to the slice.**
The redirect is not a missing route; it is the wrong entry point being selected because the
request said `text/html`. Adding a login controller makes the redirect resolve and hides the
fact that the test never authenticated anything.

**★ Expecting 401 from a token-only chain.**
With no `formLogin()` and no `httpBasic()`, `createDefaultEntryPoint` returns
`Http403ForbiddenEntryPoint` and unauthenticated requests are 403. A resource-server chain
usually re-adds a 401 through `oauth2ResourceServer(...)`, which registers its own entry
point — so the status depends on which DSL method you called, and that is the thing your
test is really pinned to.

**★ Writing the protection test in the same class as the happy-path test with a class-level
`@WithMockUser`.**
The class-level annotation applies to every method, so the "anonymous" test is not anonymous
and quietly asserts the authenticated behaviour. Either move it to a separate class or
override with `@WithAnonymousUser` on the method ([08g](08g-authenticating-the-test.md)).

**★ Using `verifyNoInteractions` on a collaborator the controller would not call anyway.**
If the handler consults a different bean on the anonymous path — or the path under test is a
`GET` that reads from a second repository — the verification passes for both the protected
and the unprotected case and proves nothing. Verify the collaborator that the *happy path*
test asserts was called; the two tests should name the same mock.

**★ Forgetting that these statuses are produced without your error contract.**
There is no `ProblemDetail`, no `@ControllerAdvice` body and no `/error` dispatch behind a
401 or 403 from the filter chain ([06](06-validation-errors.md) has the parallel case for
validation). If your API promises RFC 9457 for every failure, the security failures are the
ones that will not honour it unless you wrote an `AuthenticationEntryPoint` and an
`AccessDeniedHandler` that do.

## Interview questions

**★ What is wrong with `hasStatus(401)` as a security assertion?**
It asserts the *challenge*, and the challenge is chosen by a media-type matcher from the
`Accept` header rather than by anything to do with authorisation. The same protected
endpoint answers 401 for `*/*` and `application/json`, 302 for `text/html`, and 403 in a
chain that registers no entry point. The claim you meant to make is that the request did not
reach the handler, and that is what to assert.

**★ How do you assert "this endpoint is protected" in a way that survives a chain rewrite?**
Assert that the mocked collaborator was never interacted with, alongside a loose "was
rejected" status check. `verifyNoInteractions(orders)` is true for every rejection mechanism
— entry point, access-denied handler, filter — and false the moment a mis-scoped
`permitAll()` lets the request through, which is the regression the test exists for.

**★ Your unauthenticated request returns 403 and you expected 401. What changed?**
Someone removed `formLogin()` and `httpBasic()` from the chain, or you are looking at a
custom chain that never had them.
`ExceptionHandlingConfigurer.createDefaultEntryPoint` returns `new Http403ForbiddenEntryPoint()`
when no preferred entry point was registered, so an unauthenticated request is answered 403
with no challenge header. "401 unauthenticated, 403 unauthorised" is a convention your
configuration either implements or does not.

**★ You are using `MockMvcTester` and want Spring Security's `authenticated()` matcher. Can
you?**
Yes. Security 7.1.1 ships `SecurityMockMvcResultMatchers` as `ResultMatcher` implementations
and no AssertJ-native equivalent, but `MvcTestResultAssert.matches(ResultMatcher)` accepts
one directly — `assertThat(mvc.get().uri("/")).matches(unauthenticated())`. There is a
companion `apply(ResultHandler)` for `SecurityMockMvcResultHandlers.exportTestSecurityContext()`.

**★ When is asserting the exact challenge the right thing to do?**
When it is part of the published contract — a client library that keys off
`WWW-Authenticate: Bearer`, or a browser flow whose redirect target is documented. Then set
the `Accept` header explicitly in the test so the test declares the branch it is exercising,
and assert the status together with the header or the redirect URL. What you should not do
is let a bare request pick a branch for you and then pin whatever it produced.

Next: why the `POST` is 403 even when the user is authenticated —
[08d · CSRF in the slice](08d-csrf-in-the-slice.md).

{/* FOOTER */}
