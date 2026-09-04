---
title: "The traps"
sidebar_label: "14 · The traps"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Architecture*,
> *Authorize HTTP Requests*, *Method Security* and *CORS*
> (docs.spring.io/spring-security/reference/) — and against the Spring Boot
> reference for the error-handling interaction. Spring Boot 4.1.1, Spring
> Security 7.x, JDK 25.

**Every trap in this chunk is a case where Spring Security does exactly what it
was told and the result is not what was meant. None of them throw at startup,
most of them produce a plausible status code, and two of them are silent
security holes rather than outages. They are collected here because the pattern
is worth seeing all at once: the failures cluster around the boundary between
the filter chain and everything else.**

## 1. 🔴 A rule in a chain that never matched

**Symptom.** `permitAll` on a path and it is still 401. Or a `hasRole` rule that
denies an obviously entitled user.
**Cause.** The request was handled by a *different* `SecurityFilterChain`. Only
the first matching chain runs and rules never merge, so a rule in a chain that
did not win is invisible.
**Fix.** Debug the routing before the rules. Every non-final chain gets a narrow
`securityMatcher` and an explicit `@Order`; the last chain is the only catch-all
([chunk 6](06-matchers-and-multiple-chains.md)).

**Why it is first on the list.** Almost every "the configuration is ignored"
report is this, and nothing in the framework tells you which chain served a
request. It is the one question worth asking before any other.

## 2. 🔴 Ordering `anyRequest()` before a specific matcher

**Symptom.** In the same chain, a specific rule appears to do nothing.
**Cause.** Rules are first-match in declaration order and `anyRequest()` matches
everything.
**Fix.** `anyRequest()` last, always. Spring Security refuses to start for this
exact case — but the general version, two overlapping path patterns in the wrong
order, fails silently:

```java
.requestMatchers("/api/**").authenticated()          // ⛔ swallows the next line
.requestMatchers("/api/public/**").permitAll()       // ⛔ unreachable
```

Narrow before broad. Always.

## 3. 🔴 `hasRole("ROLE_ADMIN")`

**Symptom.** An endpoint 403s for everyone, admins included.
**Cause.** `hasRole` prepends `ROLE_`, so this checks for `ROLE_ROLE_ADMIN`.
**Fix.** `hasRole("ADMIN")` or `hasAuthority("ROLE_ADMIN")`. Pick one style for
the whole codebase — mixing them is how the mistake gets in, because the same
string is right in one call and wrong in the other.

The producing side matters equally: a resource server emits `SCOPE_`-prefixed
authorities by default, so `hasRole` can never match anything unless a converter
was configured ([chunk 10](10-claims-to-authorities.md)).

## 4. Static resources returning 403

**Symptom.** The login page renders unstyled; the SPA shell fails to boot.
**Cause.** `anyRequest().authenticated()` covers `/css/**` and `/js/**` too.
**Fix.**

```java
.requestMatchers("/css/**", "/js/**", "/images/**", "/favicon.ico").permitAll()
```

inside the chain — not `WebSecurity#ignoring()`, which removes those paths from
the filter chain entirely and so also removes their security headers and the
`HttpFirewall`.

## 5. 🔴 `@PreAuthorize` silently doing nothing

**Symptom.** None. The method runs for everybody.
**Cause.** No `@EnableMethodSecurity` — "Spring Boot Starter Security does not
activate method-level authorization by default."
**Fix.** Add it. And treat this as the reason method security is never the only
layer: unannotated methods are unsecured, so the URL layer's
`anyRequest().authenticated()` is what makes the unknown case safe
([chunk 8](08-method-vs-url-security.md)).

## 6. 🔴 Method security bypassed by an internal call

**Symptom.** A method is protected from other beans and not from its own class;
extracting a helper "for readability" quietly removed a check.
**Cause.** It is Spring AOP: a call through `this` never touches the proxy.
**Fix.** Put the protected method on a different bean and inject it. Private and
final methods cannot be advised at all.

## 7. 🔴 Security errors never reaching your `@ControllerAdvice`

**Symptom.** Your API returns a neat `ProblemDetail` for domain errors and
Boot's default error body for 401 and 403.
**Cause.** `ExceptionTranslationFilter` catches `AuthenticationException` and
`AccessDeniedException` *inside the filter chain*, upstream of
`DispatcherServlet`. `@ControllerAdvice` is an MVC construct and only sees
exceptions from handler mapping and controller execution
([chunk 2](02-the-filters-that-matter.md)).
**Fix.** Supply the two handlers and have them write the same shape:

```java
@Component
class ProblemDetailAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper mapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException ex) throws IOException {
        write(response, HttpStatus.UNAUTHORIZED, "Authentication required", request);
    }

    static void write(HttpServletResponse response, HttpStatus status,
                      String detail, HttpServletRequest request) throws IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setInstance(URI.create(request.getRequestURI()));
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        // serialise `problem` to response.getOutputStream() with your ObjectMapper
    }
}

@Component
class ProblemDetailAccessDeniedHandler implements AccessDeniedHandler {
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException ex) throws IOException {
        ProblemDetailAuthenticationEntryPoint.write(
                response, HttpStatus.FORBIDDEN, "Access denied", request);
    }
}
```

wired into the chain:

```java
.exceptionHandling(ex -> ex
    .authenticationEntryPoint(entryPoint)
    .accessDeniedHandler(accessDeniedHandler))
```

The error-shape contract these are matching is
[Topic 09 — Error handling](../09-error-handling/06-problemdetail-and-rfc-9457.md).

⚠️ One asymmetry to know: an `AccessDeniedException` thrown by **method
security** is raised inside the controller call, so it can be caught by an
`@ExceptionHandler` before `ExceptionTranslationFilter` ever sees it. That means
the same logical failure can take either path depending on which layer denied
it — which is a good reason to handle `AccessDeniedException` in your advice
*as well as* configuring the handler, so both routes produce the same body.

## 8. 🔴 `SecurityContext` not propagating to another thread

**Symptom.** `@Async` work sees no authentication; a `@PreAuthorize` inside it
denies a legitimate user.
**Cause.** `ThreadLocal` does not cross a thread boundary.
**Fix.** `new DelegatingSecurityContextExecutor(delegate)` as the `@Async`
executor, and pass that executor explicitly to `CompletableFuture.supplyAsync`.
Not `MODE_INHERITABLETHREADLOCAL` ([chunk 4](04-the-threadlocal-caveat.md)).

## 9. Login "works" and the next request is anonymous

**Symptom.** A hand-rolled `/login` authenticates successfully, and nothing
sticks.
**Cause.** Since Spring Security 6, `SecurityContextHolderFilter` reads but does
not save.
**Fix.** `securityContextRepository.saveContext(context, request, response)` —
the full shape is in [chunk 2](02-the-filters-that-matter.md).

## 10. A preflight rejected as unauthenticated

**Symptom.** The browser reports a CORS error; the server log shows 401 on
`OPTIONS`.
**Cause.** CORS is not configured *in the security chain*, so the
credential-free preflight hit an `authenticated()` rule.
**Fix.** `http.cors(Customizer.withDefaults())` with a
`UrlBasedCorsConfigurationSource` bean. `@CrossOrigin` cannot help — MVC never
ran ([chunk 12](12-cors-for-an-spa.md)).

## 11. 🔴 `csrf.disable()` on a chain that still accepts cookies

**Symptom.** None, which is the problem.
**Cause.** CSRF disabled without `SessionCreationPolicy.STATELESS`, or with the
JWT stored in a cookie. The credential is still attached automatically.
**Fix.** Make the chain genuinely stateless, or keep CSRF. The two settings are
one decision ([chunk 13](13-csrf-decisions.md)).

## 12. An SPA sending the CSRF token and still getting 403

**Symptom.** Correct-looking configuration on both sides, every mutation 403s.
**Cause.** BREACH protection XOR-encodes the token; the cookie holds the raw
value.
**Fix.** `http.csrf(CsrfConfigurer::spa)`, which pairs the cookie repository with
the matching request handler.

## 13. Tests that pass because the security is not loaded

**Symptom.** Green tests, and the protection is absent in production — or the
reverse, security failing only in tests.
**Cause.** A `@WebMvcTest` slice does not load your `@EnableMethodSecurity`
configuration or the beans it advises, and a slice may load a *default* security
configuration rather than yours.
**Fix.** Import the security configuration into the slice explicitly, and test
authorization with `spring-security-test` — `@WithMockUser`,
`@WithMockUser(authorities = "SCOPE_orders.read")`, or
`SecurityMockMvcRequestPostProcessors.jwt()` for a resource server. A test that
asserts a 403 is worth more than a test that asserts a 200, because the 200 also
passes when the rule is missing.

## 14. Actuator exposed by accident

**Symptom.** `/actuator/env` or `/actuator/heapdump` reachable.
**Cause.** A chain whose `securityMatcher` does not cover `/actuator/**`, or a
`permitAll` written for `/actuator/health` with a `**` that reached further than
intended.
**Fix.** Permit exactly the liveness and readiness paths and require
authentication for the rest. The endpoints themselves are **[Topic 13 —
Actuator](../13-actuator/README.md)**; the matcher is a security decision and belongs
in the chain.

## The pattern behind all of them

Look at where they cluster. Traps 1, 2 and 3 are **rules that never fire** —
declarative configuration whose non-application is indistinguishable from
success. Traps 5, 6, 8 and 11 are **checks that silently do not run**. Traps 7,
9 and 10 are the **boundary between the filter chain and Spring MVC**, in three
different disguises.

Which suggests the two habits that actually help:

- **Test the denial, not just the success.** A test asserting 403 for a user
  without the role fails when the rule stops applying. A test asserting 200 for
  an admin passes whether the rule is enforced or absent.
- **When something is "ignored", ask about routing before configuration.** Which
  chain served this request, and did the filter that should have acted even run?

## Interview questions

**★ A `permitAll` rule appears to be ignored. Walk through your diagnosis.**
First, which chain served the request — only the first matching
`SecurityFilterChain` runs and rules do not merge, so a rule in a losing chain is
invisible. Second, rule order within that chain, since first-match means a
broader earlier rule shadows a narrower later one. Only third do I look at the
matcher's syntax. Configuration is the last suspect, not the first.

**★ Why can a 401 not be handled by your `@ControllerAdvice`, and how do you unify the response body?**
Because `ExceptionTranslationFilter` catches it inside the filter chain,
upstream of `DispatcherServlet`, which is the only place `@ControllerAdvice`
applies. Unify it by supplying an `AuthenticationEntryPoint` and an
`AccessDeniedHandler` that serialise the same `ProblemDetail`, wired through
`exceptionHandling(...)` — and by also handling `AccessDeniedException` in the
advice, because a denial from method security takes the MVC path instead.

**★ Which of these traps are outages and which are vulnerabilities?**
Most are outages — visible, annoying, quickly fixed. Three are vulnerabilities
and are silent: `@PreAuthorize` with no `@EnableMethodSecurity`, method security
bypassed by self-invocation, and `csrf.disable()` on a chain that still accepts
session cookies. All three look exactly like working code.

**★ Why is `WebSecurity#ignoring()` a worse way to make static resources public than `permitAll`?**
Because it removes those paths from the security filter chain entirely: no
security headers are written and the `HttpFirewall` never inspects them.
`permitAll` reaches the same access outcome with the rest of the protections
still applied.

**★ How do you write a test that would catch trap 5?**
Assert the denial. A test that calls the protected operation as a user without
the required authority and expects 403 fails the moment
`@EnableMethodSecurity` is missing. A test that calls it as an admin and expects
200 passes in both worlds, which is why success-only test suites give no signal
about authorization at all.

**★ What single question resolves the largest share of Spring Security debugging?**
"Which filter chain handled this request, and did the filter I am reasoning
about actually run?" Nearly every ignored rule, unexpected 401 and misleading
CORS error resolves to a routing answer rather than a configuration one.

---

← Prev: [CSRF decisions](13-csrf-decisions.md) · Index: [Spring Security, the working subset](README.md) · Index: [Phase 9 — Spring Boot and the web](../README.md)
