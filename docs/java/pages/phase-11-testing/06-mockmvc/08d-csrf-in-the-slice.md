---
title: "Every non-safe request in a @WebMvcTest is 403 before authorization is even consulted, because HttpSecurityConfiguration applies csrf(withDefaults()) to the prototype HttpSecurity as its FIRST call — so the fix is a RequestPostProcessor, and the test nobody writes is csrf().useInvalidToken()"
sidebar_label: "08d · CSRF in the slice"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Security 7.1.1** sources —
> [`HttpSecurityConfiguration`](https://github.com/spring-projects/spring-security/blob/7.1.1/config/src/main/java/org/springframework/security/config/annotation/web/configuration/HttpSecurityConfiguration.java),
> [`CsrfFilter`](https://github.com/spring-projects/spring-security/blob/7.1.1/web/src/main/java/org/springframework/security/web/csrf/CsrfFilter.java)
> and
> [`SecurityMockMvcRequestPostProcessors.CsrfRequestPostProcessor`](https://github.com/spring-projects/spring-security/blob/7.1.1/test/src/main/java/org/springframework/security/test/web/servlet/request/SecurityMockMvcRequestPostProcessors.java)
> — plus the Security reference
> [Testing with CSRF Protection](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/csrf.html)
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/csrf.html)),
> read as asciidoc at tag `7.1.1`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Spring Security 7.1.1, AssertJ 3.27.7.
> **No sandbox** — this page carries Java and library source, never a fabricated test run.

**The 401 on a `GET` at least looks like a security failure. The 403 on a `POST` does not:
the test has a perfectly good `@WithMockUser`, the user has the right role, the body is
valid, and the response is 403 — so everybody goes looking for a missing authority. It is
not authorization at all. CSRF is applied to the prototype `HttpSecurity` bean before any
chain-specific configuration runs, so `CsrfFilter` is in Boot's default chain too, and it
rejects the request before the authorization filter is ever reached.**

## CSRF is the first thing configured, on every chain

`HttpSecurityConfiguration.httpSecurity()` is the prototype-scoped `@Bean` that every
`SecurityFilterChain` is built from — Boot's default and yours alike. Before your lambda
touches it, it already looks like this:

```java
@Bean(HTTPSECURITY_BEAN_NAME)
@Scope("prototype")
HttpSecurity httpSecurity() {
    ...
    http
        .csrf(withDefaults())
        .addFilter(webAsyncManagerIntegrationFilter)
        .exceptionHandling(withDefaults())
        .headers(withDefaults())
        .sessionManagement(withDefaults())
        .securityContext(withDefaults())
        .requestCache(withDefaults())
        .anonymous(withDefaults())
        .servletApi(withDefaults())
        .with(new DefaultLoginPageConfigurer<>());
    http.logout(withDefaults());
    ...
}
```

`csrf(withDefaults())` is the **first** call. Nothing in `@WebMvcTest` removes it, and
Boot's `defaultSecurityFilterChain` does not disable it. So a bare slice has CSRF on.

Which requests it applies to is `CsrfFilter.DEFAULT_CSRF_MATCHER`:

```java
private static final class DefaultRequiresCsrfMatcher implements RequestMatcher {

    private final HashSet<String> allowedMethods =
            new HashSet<>(Arrays.asList("GET", "HEAD", "TRACE", "OPTIONS"));

    @Override
    public boolean matches(HttpServletRequest request) {
        return !this.allowedMethods.contains(request.getMethod());
    }
}
```

Four safe methods, everything else protected. That is why `GET` tests pass and `POST`,
`PUT`, `PATCH` and `DELETE` tests all fail together the moment security enters the slice —
a signature worth recognising, because "all my write tests broke at once" points straight
here rather than at your rules.

## Why 403 and not 401

`CsrfFilter` does not throw into the entry-point machinery. It calls an
`AccessDeniedHandler` directly:

```java
AccessDeniedException exception = (!missingToken) ? new InvalidCsrfTokenException(csrfToken, actualToken)
        : new MissingCsrfTokenException(actualToken);
this.accessDeniedHandler.handle(request, response, exception);
return;
```

with `private AccessDeniedHandler accessDeniedHandler = new AccessDeniedHandlerImpl();`,
which sends 403. And `CsrfFilter` sits **before** the authorization filter, so the request
never reaches an authorization decision at all. Two consequences: the status is 403 even
for a completely anonymous request, and the content-negotiation dance of
[08b](08b-the-401-and-the-302.md) does not apply — there is no entry point involved.

The two exception types are worth knowing apart: `MissingCsrfTokenException` means no token
was presented, `InvalidCsrfTokenException` means one was presented and did not match. Both
render as 403.

## The fix: a `RequestPostProcessor`

Spring Security's reference is unambiguous:

> *"When testing any non-safe HTTP methods and using Spring Security's CSRF protection, you
> must include a valid CSRF Token in the request."*

```java
import static org.springframework.security.test.web.servlet.request
        .SecurityMockMvcRequestPostProcessors.csrf;

assertThat(mvc.post().uri("/orders").with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(body))
    .hasStatus(HttpStatus.CREATED);
```

`with(RequestPostProcessor)` is the request builder's documented extension point
([04c](04c-multipart-and-request-postprocessors.md)); `csrf()` is one of Spring Security's
implementations of it.

Three documented forms, and they are not interchangeable:

| Call | What it does | Use it for |
|---|---|---|
| `csrf()` | valid token as a **request parameter** | form posts |
| `csrf().asHeader()` | valid token in the **header** | JSON/XHR clients — what your SPA does |
| `csrf().useInvalidToken()` | a token that will be rejected | proving protection is still on |

The implementation makes the difference concrete:

```java
String tokenValue = this.useInvalidToken ? INVALID_TOKEN_VALUE : token.getToken();
if (this.asHeader) {
    request.addHeader(token.getHeaderName(), tokenValue);
}
else {
    request.setParameter(token.getParameterName(), tokenValue);
}
```

Note what happens *before* those lines: the post-processor asks `WebTestUtils` for the
chain's `CsrfTokenRepository` and `CsrfTokenRequestHandler`, wraps the repository in a
`TestCsrfTokenRepository`, generates a deferred token and lets the *real* handler write it.
So `csrf()` is not a "skip CSRF" switch — it produces a token through your configured
handler, which is why it keeps working when you customise
`XorCsrfTokenRequestAttributeHandler` and why it fails loudly if no handler is found
(`Assert.isTrue(handler != null, "No CsrfTokenRequestHandler found")`).

## The test nobody writes

```java
@Test
void a_post_without_a_valid_csrf_token_is_rejected() {
    assertThat(mvc.post().uri("/orders").with(csrf().useInvalidToken())
            .contentType(MediaType.APPLICATION_JSON).content(body))
        .hasStatus(HttpStatus.FORBIDDEN);
    verifyNoInteractions(orders);
}
```

This is the one that earns its keep. The positive `csrf()` test stays green whether
protection is on or off; only the negative one turns red the day somebody adds
`csrf(AbstractHttpConfigurer::disable)` to make a build pass. If CSRF is part of your threat
model, it needs a test that can fail. When it is *correct* to disable it — a stateless
token-authenticated API with no cookie-borne session — is
[13 · CSRF decisions](../../phase-9-spring-boot/11-spring-security/13-csrf-decisions.md).

## Gotchas

**★ A `POST` failing 403 and being read as an authorization problem.**
CSRF is applied by `HttpSecurityConfiguration.httpSecurity()` before any chain-specific
configuration, so it is on in Boot's default chain too. 403 with a perfectly good
`@WithMockUser` is `CsrfFilter`, not a missing authority. Add `.with(csrf())`.

**★ Reading the 403 as "wrong role" and adding roles until it passes.**
It will never pass, because the request is rejected before authorization runs. The
diagnostic is the method: if every `GET` in the class is green and every write is 403, it is
CSRF, not authorities. `CsrfFilter`'s safe list is exactly `GET`, `HEAD`, `TRACE`, `OPTIONS`.

**★ Disabling CSRF in the test to make the `POST` pass.**
If production has CSRF on, a test with it off exercises a pipeline that does not ship, and a
genuine CSRF regression can never fail a test. Use `csrf()` to satisfy it and
`csrf().useInvalidToken()` to prove it is still enforced.

**★ Using `csrf()` when your client sends the token as a header.**
`csrf()` puts the token in a *request parameter*; `csrf().asHeader()` puts it in the header.
Both pass `CsrfFilter`, so the test is green either way — but only one exercises the path
your SPA takes, and a `CsrfTokenRequestHandler` misconfiguration that breaks the header path
is invisible to the parameter form.

**★ Writing only the positive CSRF test.**
`csrf()` on every write test makes them green and makes CSRF untested. The suite then has no
opinion about whether protection exists, which is the state most codebases are actually in.

**★ Adding `.with(csrf())` to a `GET` "for consistency".**
Harmless but misleading: `GET` is on the safe list, so the token is never checked and the
call documents a requirement that does not exist. A reader will assume `GET` is protected.

**★ Expecting CSRF to be off because the endpoint is JSON-only.**
`CsrfFilter` keys on the HTTP method, not on the content type. `POST /api/orders` with
`Content-Type: application/json` is protected exactly as much as a form post. Statelessness
does not disable it either — only configuration does.

**★ Forgetting that a `multipart` upload is a `POST`.**
`mvc.post().uri("/files")` with a `MockMultipartFile` needs `.with(csrf())` like any other
write, and the failure looks nothing like a multipart problem —
[04c](04c-multipart-and-request-postprocessors.md).

**★ Assuming the 403 body is your error contract.**
`AccessDeniedHandlerImpl` writes the status from inside the filter chain, before
`DispatcherServlet`. No `@ControllerAdvice` of yours runs, no `ProblemDetail` is produced,
and `MockMvc` performs no error dispatch to `/error` — the parallel case to
[06 · Validation errors](06-validation-errors.md). If your API promises RFC 9457 for every
failure, CSRF rejections are among the ones that will not honour it unless you supplied an
`AccessDeniedHandler`.

**★ Chaining `csrf()` with another `with(...)` and expecting order not to matter.**
`csrf()` reads the chain's token repository and handler off the request when it runs. A
post-processor that replaces the request object, or one that must run first to establish a
session, can change what `csrf()` sees. Apply authentication first, then `csrf()`.

## Interview questions

**★ Your test sends `@WithMockUser` and the `POST` still returns 403. Why?**
CSRF. `HttpSecurityConfiguration.httpSecurity()` applies `.csrf(withDefaults())` to the
prototype `HttpSecurity` as its first call, before any chain configuration, so it is on in
Boot's default chain too. `CsrfFilter` rejects a non-safe method with no valid token by
calling `AccessDeniedHandlerImpl` directly — 403, before authorization is consulted, which
is exactly why the status is 403 and not 401. Add
`SecurityMockMvcRequestPostProcessors.csrf()` through `.with(csrf())`.

**★ Which HTTP methods does that affect, and how do you recognise the symptom?**
Everything except `GET`, `HEAD`, `TRACE` and `OPTIONS` —
`CsrfFilter.DEFAULT_CSRF_MATCHER` is a `HashSet` of exactly those four and matches the
complement. The signature is that every read test in the class passes and every write test
fails at once, with the same status, regardless of which endpoint or which user.

**★ How would you write a test that fails if someone disables CSRF?**
`mvc.post().uri("/orders").with(csrf().useInvalidToken())` asserted 403. It is green while
protection is on and turns red the moment the chain stops checking tokens. The positive
`csrf()` test cannot do this — it stays green either way, which is why a suite full of
`with(csrf())` and nothing else has no opinion about CSRF at all.

**★ What is `csrf()` actually doing to the request — is it bypassing the filter?**
No. It looks up the chain's `CsrfTokenRepository` and `CsrfTokenRequestHandler` through
`WebTestUtils`, wraps the repository so the token lives on the request rather than the
session, loads a deferred token, and lets the real handler produce the value — then writes
it as a parameter or a header. The filter runs normally and validates a genuine token. That
is why the post-processor keeps working when you customise the token handler, and why it
asserts loudly if no handler is present.

**★ Why does the 403 body not match your API's error format?**
Because `AccessDeniedHandlerImpl` writes it from inside the servlet filter chain, before
`DispatcherServlet` is reached. Your `@ControllerAdvice` and `ProblemDetail` support live in
MVC and are never consulted, and `MockMvc` performs no error dispatch to `/error`, so the
body is empty rather than merely wrong. Shaping it means supplying an `AccessDeniedHandler`
in production code.

Next: the reason the rules being enforced are Boot's rather than yours —
[08e · The chain you are not testing](08e-the-chain-you-are-not-testing.md).

{/* FOOTER */}
