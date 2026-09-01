---
title: "\"As an authenticated user with role X\" has five different mechanisms in Spring Security's test module and they do not do the same thing — one populates a holder for the whole test method, the others decorate a single request, and knowing which is which decides whether your method-security test runs at all"
sidebar_label: "06 · Security in a test"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against **Spring Security 7.1.0** (the version managed by
> `spring-boot-dependencies:4.1.0`) — the servlet test reference
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/test/method.html),
> [mockmvc/setup](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/setup.html),
> [mockmvc/oauth2](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/oauth2.html))
> and the 7.1.0 sources of `WithMockUser`, `WithMockUserSecurityContextFactory`,
> `SecurityMockMvcConfigurer` and `SecurityMockMvcRequestPostProcessors`
> ([github.com/spring-projects/spring-security](https://github.com/spring-projects/spring-security/tree/7.1.0/test/src/main/java/org/springframework/security/test)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, Spring Security 7.1.0, JUnit Jupiter 6.0.3, Mockito 5.23.0.
> ⚠️ **No sandbox and no test runs on this machine** — this page carries Java source and
> documented behaviour, never console output.

**Every team writes the "an admin can delete an order" test. Almost none writes the three
that matter more: that an anonymous caller gets 401, that a logged-in non-admin gets 403,
and that in neither case did the service method run. This page is about how to authenticate
a test — there are five mechanisms and they operate at two different scopes — and then about
the negative tests, which are the only ones that can fail when someone writes `permitAll()`
by mistake.**

## Two scopes, five mechanisms

The single most useful thing to understand is that Spring Security's test support has two
completely different entry points, and they reach different code.

**Scope 1 — the `SecurityContextHolder`, for the whole test method.** The
`@With…` annotations live in `org.springframework.security.test.context.support` and work
through a `TestExecutionListener` that populates a `TestSecurityContextHolder` before the
test method runs. They are the only thing that works when there is no HTTP request at all —
a plain service test of a `@PreAuthorize` method.

| Annotation | What it builds |
|---|---|
| `@WithMockUser` | a `UsernamePasswordAuthenticationToken` over a `User` principal, from literal attributes |
| `@WithUserDetails` | loads the principal through your real `UserDetailsService` bean |
| `@WithAnonymousUser` | an `AnonymousAuthenticationToken` |
| `@WithSecurityContext` | delegates to a `WithSecurityContextFactory` you write — the escape hatch for custom principals |

**Scope 2 — the request, for one `MockMvc` call.** The post-processors live in
`org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors`
and attach a `SecurityContext` to a single `MockHttpServletRequest`: `user(…)`,
`authentication(…)`, `securityContext(…)`, `anonymous()`, `jwt()`, `opaqueToken()`,
`oauth2Login()`, `oidcLogin()`, `oauth2Client(…)`, `x509(…)`, `httpBasic(…)`, `digest()`,
`csrf()` and `testSecurityContext()`.

The bridge between the two is `testSecurityContext()`, and it is applied for you. The
reference says of the MockMvc setup:

> *"`SecurityMockMvcConfigurers.springSecurity()` will perform all of the initial setup we
> need to integrate Spring Security with Spring MVC Test"*

and the configurer's own javadoc says it *"will also ensure that the
`TestSecurityContextHolder` is leveraged for each request"*. In a Boot slice —
`@WebMvcTest`, or `@SpringBootTest` with `@AutoConfigureMockMvc` — Boot applies
`springSecurity()` itself, which is why `@WithMockUser` "just works" on a MockMvc test
without you wiring anything.

## Which one to reach for

```java
// 1 · Simplest thing that authenticates a slice request.
@Test
@WithMockUser(roles = "ADMIN")
void anAdminCanCancelAnOrder() { ... }

// 2 · Varying the identity inside one test, or authenticating some requests and not others.
@Test
void onlyTheOwnerSeesTheOrder() {
    assertThat(mvc.get().uri("/orders/42").with(user("owner").roles("USER")))
            .hasStatusOk();
    assertThat(mvc.get().uri("/orders/42").with(user("someone-else").roles("USER")))
            .hasStatus(HttpStatus.FORBIDDEN);
}

// 3 · A resource server. No login, a bearer token's claims are the identity.
@Test
void aTokenWithTheOrdersWriteScopeMayCancel() {
    assertThat(mvc.post().uri("/orders/42/cancel")
                    .with(jwt().jwt(j -> j.claim("scope", "orders:write"))))
            .hasStatusOk();
}

// 4 · The principal is your own type and the code reads fields off it.
@Test
@WithTenantUser(tenant = "acme", roles = "ADMIN")   // your @WithSecurityContext
void anAdminOfOneTenantCannotSeeAnother() { ... }
```

The decision rule is short. **One identity for the whole test method and no need for real
user data → `@WithMockUser`.** **More than one identity in a test, or a request that must
be anonymous → the post-processors.** **Your code calls
`((AppUser) authentication.getPrincipal()).tenantId()` → `@WithSecurityContext` with your
own factory**, because `@WithMockUser` always builds Spring's `User` and a cast to your type
will throw. **An OAuth2 resource server → `jwt()`**, not `@WithMockUser`, because the thing
under test is claim-to-authority conversion and `@WithMockUser` bypasses it entirely.

## What `@WithMockUser` actually constructs

Reading `WithMockUserSecurityContextFactory` in Security 7.1.0 removes three recurring
arguments at once. The factory:

- takes the username from `username()` if set, otherwise `value()`, defaulting to `"user"`;
- builds `SimpleGrantedAuthority` for each entry of `authorities()` **first**;
- **only if `authorities()` was empty** falls back to `roles()`, prefixing each with
  `"ROLE_"`, and asserting `!role.startsWith("ROLE_")`;
- throws `IllegalStateException` if `authorities()` is set *and* `roles()` differs from the
  default `{"USER"}`;
- wraps the result in a Spring Security `User` and a `UsernamePasswordAuthenticationToken`,
  with password defaulting to `"password"`.

Two direct consequences. `@WithMockUser(roles = "ROLE_ADMIN")` fails with *"roles cannot
start with ROLE_"* — the prefix is added for you. And `@WithMockUser(roles = "ADMIN",
authorities = "orders:write")` fails with *"You cannot define roles attribute … with
authorities attribute …"* — pick one vocabulary per annotation.

## `jwt()` and the default that makes a test pass for free

The reference states that the `jwt()` post-processor by default produces a token with
`{"alg":"none"}`, claims `sub=user` and `scope=read`, and

> *"a `Collection` of authorities with just one authority, `SCOPE_read`"*

which is a genuinely dangerous default, because an endpoint guarded by
`hasAuthority("SCOPE_read")` passes with a bare `jwt()` and the test proves nothing about
your token-to-authority conversion. Set the claim you actually mean:

```java
.with(jwt().jwt(j -> j.claim("scope", "orders:read orders:write")))
```

⚠️ And know that `jwt().authorities(…)` is a *different* switch: the reference presents it
as the way to *"override the default `scope` and `scp` claim processing by providing
explicit `GrantedAuthority` instances"*. Using it skips the converter under test. Use
`.jwt(j -> j.claim("scope", …))` when the conversion is the thing you want covered, and
`.authorities(…)` only when it is not.

## Where this connects

- **Topic 06 · MockMvc** owns security *inside the web slice*: the 401 versus the 302, CSRF
  in a slice, asserting protection rather than the challenge, method security as a blunt
  instrument, and the post-processors as request builders. This page assumes all of it.
- The negative tests — 401, 403, and proving the service never ran — plus method security
  on a service with no HTTP at all, are
  [06b · The tests nobody writes](06b-the-401-and-the-tests-nobody-writes.md).
- The slice boundary that makes security apply at all — `SecurityFilterChain` is on
  `@WebMvcTest`'s scan list — is
  [05 · Testing a controller, end-to-end-ish](05-testing-a-controller-end-to-end-ish.md).
- **Topic 05 · The test pyramid** owns `@SpringBootTest` versus slices, which decides
  whether your `@EnableMethodSecurity` configuration is even loaded.

## Gotchas

**★ `@WithMockUser(roles = "ROLE_ADMIN")` throws; the prefix is added for you.**
`WithMockUserSecurityContextFactory` asserts `!role.startsWith("ROLE_")` and fails with
*"roles cannot start with ROLE_ Got ROLE_ADMIN"*. This trips people migrating from a
codebase that spells authorities out. The mental model that fixes it permanently: `roles`
is a convenience that prepends `ROLE_`; `authorities` is the literal string. `hasRole("ADMIN")`
and `hasAuthority("ROLE_ADMIN")` are the same check written two ways.

**★ Setting both `roles` and `authorities` on `@WithMockUser` is an `IllegalStateException`,
not a merge.**
The factory throws *"You cannot define roles attribute … with authorities attribute …"* the
moment `authorities()` is non-empty and `roles()` is anything other than the default
`{"USER"}`. There is no combining. If a user genuinely needs both a role and a scope-style
authority, spell both out in `authorities`: `authorities = {"ROLE_ADMIN", "orders:write"}`.

**★ A bare `jwt()` grants exactly `SCOPE_read`, so a `hasAuthority("SCOPE_read")` rule
passes without your converter ever being exercised.**
The documented default claims are `sub=user`, `scope=read`, producing *"a `Collection` of
authorities with just one authority, `SCOPE_read`"*. If your endpoint happens to require
that authority, the test is green and tells you nothing — not whether the `scope` claim is
parsed, not whether a custom `JwtAuthenticationConverter` is wired, not whether a
multi-scope token splits correctly. Always set the claim explicitly, even when the default
would pass.

**★ `jwt().authorities(…)` bypasses the claim-to-authority conversion you probably wanted to
test.**
The reference describes it as overriding *"the default `scope` and `scp` claim
processing"*. So a test using `.authorities(new SimpleGrantedAuthority("SCOPE_messages"))`
is a test of your *authorization rules* with the conversion stubbed out. That is a
legitimate test — but if your production incident was "the token had `scp` not `scope` and
everybody got 403", this form of the test could never have caught it.

**★ An explicit request post-processor silently overrides `@WithMockUser` on the same test.**
`TestSecurityContextHolderPostProcessor`'s own source carries the comment
*"TestSecurityContextHolder is only a default value"* and returns the request untouched if a
context is already attached; and MockMvc merges the builder's default post-processors ahead
of the per-request ones (`postProcessors.addAll(0, parentBuilder.postProcessors)` in
`AbstractMockHttpServletRequestBuilder`), so an explicit `.with(user("bob"))` runs last and
wins either way. This is usually what you want — but a test annotated `@WithMockUser(roles =
"ADMIN")` whose request says `.with(user("bob"))` runs as a plain `ROLE_USER` bob, and the
annotation sitting three lines above is a lie a reviewer will believe. Use one mechanism per
test.

**★ `@WithMockUser` builds Spring's `User`, so a cast to your own principal type throws.**
If your controller does `(AppUser) auth.getPrincipal()` — or your `@AuthenticationPrincipal`
parameter is typed to your class — `@WithMockUser` produces a `ClassCastException` or a null
argument, and the test failure looks like a bug in the controller. The fix is a custom
annotation backed by `@WithSecurityContext` and a `WithSecurityContextFactory` that builds
*your* principal, which is roughly fifteen lines and is reusable across the whole suite.
`@WithUserDetails` is the other route when your `UserDetailsService` already returns the
right type.

**★ `@WithUserDetails` needs the user to exist when the listener runs, which is before
`@BeforeEach` by default.**
`setupBefore` defaults to `TestExecutionEvent.TEST_METHOD`, which the enum's javadoc ties to
`TestExecutionListener.beforeTestMethod` — earlier than your `@BeforeEach` that inserts the
fixture user. The result is a `UsernameNotFoundException` during setup, before a line of
your test runs. The documented switch is `setupBefore = TestExecutionEvent.TEST_EXECUTION`,
associated with `beforeTestExecution`, which runs *after* `@BeforeEach`. This one costs
people an afternoon roughly once per career.

**★ `@WithMockUser` on a test class is inherited by every method including the ones meant to
be anonymous.**
The annotation is `@Inherited` and applies at `TYPE` level, so a class-level
`@WithMockUser(roles = "ADMIN")` quietly authenticates the test you wrote to prove
unauthenticated access is refused — and it passes for a completely different reason than you
think, or fails confusingly. Override with `@WithAnonymousUser` on the specific method, or
put the anonymous tests in a separate `@Nested` class.

**★ Security only applies in a slice if the filter chain is in the slice, and "it returned
200" is ambiguous evidence.**
`@WebMvcTest`'s scan list includes `SecurityFilterChain`, so a chain declared as a bean is
picked up — but a chain built inside a `@Configuration` that is not on the scan list is not,
and then *every* request is unauthenticated-and-allowed. A green happy-path test cannot
distinguish "security allowed it" from "security was never loaded". The only test that
distinguishes them is the unauthenticated-gets-401 test, which is
[06b](06b-the-401-and-the-tests-nobody-writes.md)'s entire subject.

## Interview questions

**★ What is the difference between `@WithMockUser` and the `user()` request
post-processor, and when does the difference bite?**
Scope. `@WithMockUser` is a `TestExecutionListener` that populates the
`TestSecurityContextHolder` for the whole test method, so it reaches code that reads
`SecurityContextHolder` directly — a `@PreAuthorize` on a service, an auditing component,
anything with no HTTP request involved. `user()` attaches a `SecurityContext` to one
`MockHttpServletRequest`, so it only exists for that request and only works through MockMvc.
The difference bites in two places: a service-layer method-security test *must* use the
annotation, because there is no request; and a test that needs two different identities must
use the post-processor, because an annotation applies to the whole method. There is a
bridge — `springSecurity()` installs `testSecurityContext()`, which copies the holder's
context onto each request — which is why the annotation works for MockMvc tests too.

**★ You need to authenticate as a principal of your own class. What are your options?**
Three, in increasing order of fidelity. `@WithSecurityContext` with a small
`WithSecurityContextFactory` that constructs your principal is the usual answer: you write a
meta-annotation like `@WithTenantUser(tenant = "acme")`, the factory builds the
`Authentication`, and it reads well at the call site. `@WithUserDetails` is better when your
`UserDetailsService` already returns your type and the user data genuinely exists — it
exercises the real loading path, at the cost of needing the row. And the post-processor
`authentication(myToken)` is the bluntest, for a one-off. What you cannot do is
`@WithMockUser`, because its factory hardcodes Spring's own `User` class, so any cast to
your type throws.

**★ Your resource-server test uses `jwt()` and passes. Why might that be worthless?**
Because the default token already carries `scope=read`, and the documented behaviour is that
the post-processor grants *"a `Collection` of authorities with just one authority,
`SCOPE_read`"*. If the endpoint requires `SCOPE_read`, the assertion passes without
exercising anything you wrote — not the converter, not the scope-claim name, not multi-scope
splitting, not a custom authority prefix. Worse, if the test used `jwt().authorities(…)`, it
has explicitly replaced the conversion under test with a literal. The test that is worth
having sets the claim (`.jwt(j -> j.claim("scope", "orders:write"))`) and asserts both that
the right scope is admitted and that a token with a different scope is refused.

**★ How does `@WithMockUser` end up affecting a MockMvc request at all, given that it sets a
static holder and MockMvc builds its own request?**
Through `springSecurity()`. The configurer adds the `springSecurityFilterChain` as a servlet
filter and returns `testSecurityContext()` as a default request post-processor; that
post-processor copies the `TestSecurityContextHolder`'s context onto the request — but only
if the request does not already have one, as its own source comment says: *"TestSecurityContextHolder
is only a default value"*. Boot applies `springSecurity()` for you under `@WebMvcTest` and
`@AutoConfigureMockMvc`. If you hand-build `MockMvc` with `MockMvcBuilders.webAppContextSetup(context)`
and forget `.apply(springSecurity())`, neither the filter chain nor the annotation has any
effect, and every test passes because nothing is protected.

{/* FOOTER */}
