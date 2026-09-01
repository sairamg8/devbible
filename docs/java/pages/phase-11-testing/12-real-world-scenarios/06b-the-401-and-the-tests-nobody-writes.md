---
title: "The \"an admin can delete an order\" test passes just as happily on an endpoint with no security at all, so the only tests that can detect a missing rule are the negative ones — and on a POST they routinely pass for the wrong reason because CSRF, not authorization, produced the 403"
sidebar_label: "06b · The 401 nobody writes"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against **Spring Security 7.1.0** (managed by
> `spring-boot-dependencies:4.1.0`) — the servlet test reference
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/authentication.html))
> and the 7.1.0 source of `AuthorizationDeniedException`
> ([github.com/spring-projects/spring-security](https://github.com/spring-projects/spring-security/blob/7.1.0/core/src/main/java/org/springframework/security/authorization/AuthorizationDeniedException.java)),
> which *"extends `AccessDeniedException`"* and is **since 6.3**.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, Spring Security 7.1.0, JUnit Jupiter 6.0.3, Mockito 5.23.0.
> ⚠️ **No sandbox and no test runs on this machine** — this page carries Java source and
> documented behaviour, never console output.

**Delete every line of security configuration from your application and run the suite. If
it stays green, your security tests test nothing — and for most codebases it stays green,
because the only security test anyone wrote was the happy path, and an unprotected endpoint
serves the happy path beautifully. This page is the three tests per protected endpoint, the
assertion that must accompany the status code, and the CSRF trap that makes a negative test
pass for a reason unrelated to authorization.**

## Why the positive test is worthless on its own

```java
@Test
@WithMockUser(roles = "ADMIN")
void anAdminCanCancelAnOrder() {
    assertThat(mvc.post().uri("/orders/42/cancel").with(csrf())).hasStatusOk();
}
```

This test passes if the endpoint requires `ROLE_ADMIN`. It also passes if the endpoint
requires nothing at all, if the security chain was never loaded into the slice, if someone
changed `hasRole("ADMIN")` to `permitAll()`, and if the `@PreAuthorize` annotation was
deleted. It is not a security test. It is a routing test wearing a costume.

The property you are trying to pin is *exclusion*, and only a test that expects a refusal
can observe it.

## The triad, per protected endpoint

```java
@Test
void anonymousCannotCancel() {
    assertThat(mvc.post().uri("/orders/42/cancel").with(csrf()))
            .hasStatus(HttpStatus.UNAUTHORIZED);
    verifyNoInteractions(orderService);
}

@Test
@WithMockUser(roles = "USER")
void anOrdinaryUserCannotCancel() {
    assertThat(mvc.post().uri("/orders/42/cancel").with(csrf()))
            .hasStatus(HttpStatus.FORBIDDEN);
    verifyNoInteractions(orderService);
}

@Test
@WithMockUser(roles = "ADMIN")
void anAdminCanCancel() {
    assertThat(mvc.post().uri("/orders/42/cancel").with(csrf())).hasStatusOk();
    verify(orderService).cancel(new OrderId(42));
}
```

Three tests, and the two that can fail on a configuration mistake are the first two.

**`verifyNoInteractions` is not decoration.** A status code tells you what the client saw;
it does not tell you what the server did. An `AccessDeniedException` raised by method
security on the *service* produces the same 403 as a filter-chain refusal — but by then the
controller has already run, has already loaded the order, may already have written an audit
row or incremented a counter, and in a badly-layered controller may already have performed
the side effect before a second, protected call failed. The interaction assertion is what
distinguishes "refused at the door" from "refused on the way out", and only the first is
what your security design claims.

## The CSRF trap, which is the reason this page exists

Spring Security refuses a state-changing request without a valid CSRF token with **403**.
Your "an ordinary user cannot cancel" test also expects **403**. So:

```java
@Test
@WithMockUser(roles = "USER")
void anOrdinaryUserCannotCancel() {
    // no .with(csrf())
    assertThat(mvc.post().uri("/orders/42/cancel")).hasStatus(HttpStatus.FORBIDDEN);
}
```

**This test passes even if `ROLE_USER` is fully authorized to cancel orders.** It passes
because CSRF rejected it, and it would keep passing after somebody widened the rule to
`permitAll()`. It is a negative test that cannot go red, which is the worst possible
artefact to have in a suite, because its presence is evidence that somebody thought about
the case.

The discipline is mechanical: **every state-changing request in a test that is about
authorization carries `.with(csrf())`**, and CSRF gets exactly one test of its own, whose
name says so.

```java
@Test
@WithMockUser(roles = "ADMIN")
void aStateChangingRequestWithoutACsrfTokenIsRejected() {
    assertThat(mvc.post().uri("/orders/42/cancel")).hasStatus(HttpStatus.FORBIDDEN);
    verifyNoInteractions(orderService);
}
```

**Topic 06 · MockMvc** owns CSRF in a slice as a mechanism; the point here is the
interference pattern between CSRF and authorization assertions, which is a scenario-level
mistake rather than an API one.

## 401, 403 and 302 — assert the invariant, not the challenge

What an unauthenticated request receives depends on your entry point. A bearer-token
resource server answers 401. A form-login application answers **302** with a redirect to
`/login`. A chain with no entry point at all may answer 403. All three mean "refused"; only
one of them matches whatever literal you wrote first.

Two failure modes follow, and they are opposites.

- **Too specific.** You assert 401; someone adds form login for the admin UI; the test goes
  red; the "fix" is to change the expectation to 302 — and now the test cannot detect the
  chain being removed, because a redirect to an error page is also a 302.
- **Too loose.** You assert `is4xxClientError()`. A typo in the URL produces 404, which is
  4xx, so the test passes on an endpoint that does not exist. This is extremely common and
  extremely quiet.

The invariant that survives both is **"the handler did not run"**, expressed as the
interaction assertion, paired with a status assertion that is exact for the chain you
actually have. **Topic 06 · MockMvc**'s *asserting protection, not the challenge* chunk
makes this argument in full.

## Where this connects

- The five mechanisms for authenticating a test, and which scope each operates at, are
  [06 · Security in a test](06-security-in-a-test.md).
- The same argument for rules that live on a *service method* rather than on the filter
  chain — where there is no request at all — is
  [06c · Method security, with no request](06c-method-security-with-no-request.md).
- **Topic 06 · MockMvc** owns the 401-versus-302 argument, CSRF in a slice, asserting
  protection rather than the challenge, and the chain you are *not* testing in a slice.
- **Topic 04 · Mockito** owns `verifyNoInteractions`, `verify` and strictness.
- **Topic 03 · Parameterized tests** is the right shape for the who-can-do-what matrix once
  you have more than two roles.
- The slice boundary that decides whether the filter chain is loaded at all is
  [05 · Testing a controller, end-to-end-ish](05-testing-a-controller-end-to-end-ish.md).

## Gotchas

**★ A negative test on a `POST` without `.with(csrf())` passes because of CSRF, not because
of your authorization rule.**
Both produce 403 and the test cannot tell them apart. The consequence is a green test that
would stay green if the endpoint were opened to everyone. Add `.with(csrf())` to every
state-changing request in every authorization test, and write one separate test whose name
is about CSRF. If you inherit a suite, the fastest audit is to grep for `post(` and `put(`
and `delete(` in test sources and check each one has a `csrf()` next to it.

**★ `is4xxClientError()` passes on a 404, so a mistyped URL turns a security test green.**
This is the most common way a security suite becomes decorative. `/orders/42/cancle` is not
protected because it does not exist, the request 404s, the assertion is satisfied, and
nobody looks again. Assert the exact status the chain produces, and pair it with a positive
test in the same class that hits the *same* URL and gets a 2xx — if the URL is wrong, that
one fails and tells you.

**★ Expecting a 302 is barely stronger than expecting 4xx, because a redirect to anywhere
satisfies it.**
Under form login an unauthenticated request redirects to `/login`, so people assert
`is3xxRedirection()`. That also passes on a redirect to an error page, to a trailing-slash
canonicalisation, or to any other location. If the challenge is a redirect, assert the
*target* — `redirectedUrlPattern("**/login")` — and keep the interaction assertion, which is
the part that does not depend on the entry point at all.

**★ Asserting only the status cannot distinguish "denied at the filter" from "denied after
the work was done".**
A 403 produced by method security on the service arrives after the controller has run. If
the controller did anything before that call — loaded an entity, wrote an audit record,
published an event — that side effect happened despite the 403. `verifyNoInteractions` on
the mocked service (in a slice) or an assertion that the database is unchanged (in an
integration test) is what pins the difference. This is not paranoia: "the audit row exists
for a request that was refused" is a real class of finding.

**★ An unauthenticated test under a class-level `@WithMockUser` is not unauthenticated.**
`@WithMockUser` is `@Inherited` and valid at type level, so a class annotation applies to
every method including the one you named `anonymousCannotCancel`. The test then asserts that
an authenticated user is refused, which may be true for a different reason, or it fails and
you spend an hour on the controller. Use `@WithAnonymousUser` explicitly on those methods —
it exists precisely for this — or keep them in a separate class.

**★ "No authentication annotation" and `.with(anonymous())` are not equivalent, and the
difference is exactly the case above.**
With neither, the request is anonymous *unless* something else populated the
`TestSecurityContextHolder` — a class-level annotation, a `@BeforeEach` that authenticates, a
custom listener. `.with(anonymous())` installs an `AnonymousAuthenticationToken` on the
request explicitly, and because per-request post-processors run after the default
`testSecurityContext()` one, it wins. In a test whose entire point is that the caller is not
logged in, say so explicitly rather than relying on the absence of something.

**★ A green suite after deleting the security configuration is a measurable property, and
you should measure it.**
Comment out the `SecurityFilterChain` bean locally and run the tests. Every test that still
passes is a test that does not depend on security. If *all* of them pass, you have no
security tests, whatever the file names say. This takes two minutes and is more informative
than any coverage number about the one part of the system where the failure mode is a breach
rather than a bug.

## Interview questions

**★ Why is "an admin can delete an order" a weak security test?**
Because it passes under every configuration you are worried about. It passes when the
endpoint requires `ROLE_ADMIN`, when it requires nothing, when the filter chain was not
loaded into the test's context, and after someone replaces the rule with `permitAll()`. It
asserts that an authorized action succeeds, and success is the behaviour of an unprotected
endpoint too. The property you actually want to pin is exclusion, and exclusion is only
observable through a request that should be refused — so the minimum viable set is three
tests: anonymous refused, wrong-authority refused, right-authority allowed, with the first
two carrying an assertion that the handler never ran.

**★ Your `@WithMockUser(roles="USER")` POST test expects 403 and passes. What is the first
thing you check?**
Whether the request carried a CSRF token. Spring Security answers a state-changing request
with no valid token with 403 — the same status as an authorization failure — so the test may
be green for a reason that has nothing to do with roles, and would stay green if the rule
were removed entirely. Add `.with(csrf())` and re-run: if it now returns 200, the
authorization rule does not exist and the test was lying. This is the highest-yield single
check on a Spring Security test suite you did not write.

**★ You inherit a service with a security test suite. How do you find out in ten minutes
whether it is real?**
Delete the security configuration and run the suite. Anything still green does not depend on
security. Then grep the test sources for state-changing requests and check each has a
`csrf()` — the ones that do not are candidates for passing on the wrong 403. Then look for
`is4xxClientError` and `is3xxRedirection`, which are almost always assertions that a 404 or
an unrelated redirect satisfies. What you are looking for is not coverage but *tests that
can go red*, and in most inherited suites the honest count is close to zero.

**★ Should the security tests live in the controller's test class or in their own?**
Their own, for a reason that is about failure diagnosis rather than tidiness. A security
test class can carry a class-level `@WithAnonymousUser` or none at all, while the functional
test class carries the authenticated identity every one of its tests needs — and mixing the
two is exactly how a class-level annotation ends up silently authenticating an "anonymous"
test. Separating them also makes the delete-the-config audit trivial: one file should turn
entirely red. The cost is a second Spring context only if the two classes use different
overrides, which is another reason to keep the `@MockitoBean` set identical between them.

{/* FOOTER */}
