---
title: "The filters that matter"
sidebar_label: "2 · The filters that matter"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Architecture*
> (docs.spring.io/spring-security/reference/servlet/architecture.html — the
> security-filter ordering, the `FilterOrderRegistration` pointer, and the
> `ExceptionTranslationFilter` pseudocode), *CORS*
> (docs.spring.io/spring-security/reference/servlet/integrations/cors.html) and
> *Session Management*
> (docs.spring.io/spring-security/reference/servlet/authentication/session-management.html
> — `SecurityContextHolderFilter` and explicit saving). Spring Boot 4.1.1,
> Spring Security 7.x, JDK 25.

**Inside the winning chain there is a fixed, non-negotiable order, and you do not
choose it — `FilterOrderRegistration` does. Six of the filters explain nearly
every symptom you will ever debug, and the last of the six,
`ExceptionTranslationFilter`, is the one almost nobody has heard of and the one
that decides whether the caller sees 401 or 403.**

## Why there is an order at all

The reference states the reason plainly: the filters are "executed in a specific
order to guarantee that they are invoked at the right time, for example, the
`Filter` that performs authentication should be invoked before the `Filter` that
performs authorization."

Each DSL method you call (`csrf`, `httpBasic`, `formLogin`,
`authorizeHttpRequests`, `oauth2ResourceServer`) inserts its filter at the
position `FilterOrderRegistration` assigns. Calling them in a different order in
your configuration method changes nothing about the runtime order — the DSL is
declarative, not sequential, and that surprises people who reorder their
configuration hoping to fix a symptom.

The names the reference lists, in order:

`DisableEncodeUrlFilter` · `WebAsyncManagerIntegrationFilter` ·
`SecurityContextHolderFilter` · `HeaderWriterFilter` · `CsrfFilter` ·
`LogoutFilter` · `UsernamePasswordAuthenticationFilter` ·
`DefaultLoginPageGeneratingFilter` · `DefaultLogoutPageGeneratingFilter` ·
`BasicAuthenticationFilter` · `RequestCacheAwareFilter` ·
`SecurityContextHolderAwareRequestFilter` · `AnonymousAuthenticationFilter` ·
`ExceptionTranslationFilter` · `AuthorizationFilter`

Note the shape of that list, because it is the model in miniature: **load the
identity, write protective headers, reject forgeries, authenticate, then — right
at the end — authorize, with the exception translator wrapped around the
authorization step.**

## `SecurityContextHolderFilter`

Loads a previously saved `SecurityContext` and puts it into the
`SecurityContextHolder` for the duration of the request. It sits near the front
because everything after it asks "who is this?".

Since Spring Security 6 this filter **reads but does not automatically write.**
Its predecessor `SecurityContextPersistenceFilter` saved the context back into
the session at the end of every request. `SecurityContextHolderFilter` does not;
if you authenticate a user yourself — a `/login` controller calling
`AuthenticationManager` — you must save it explicitly:

```java
@PostMapping("/login")
public void login(@RequestBody LoginRequest req,
                  HttpServletRequest request, HttpServletResponse response) {

    Authentication authentication = this.authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(
                    req.username(), req.password()));

    SecurityContext context = this.securityContextHolderStrategy.createEmptyContext();
    context.setAuthentication(authentication);
    this.securityContextHolderStrategy.setContext(context);

    this.securityContextRepository.saveContext(context, request, response);  // ← required
}
```

Drop that last line and the login "works" — the response is 200, the
`Authentication` is correct for the rest of *this* request — and the next
request is anonymous again. It is the single most common Spring Security 5→6
migration failure, and it is silent.

The documented benefits of the change are real: no unnecessary `HttpSession`
writes, and no ambiguity about when persistence happens. The cost is that the
one place it matters is a place beginners reach quickly.

## The CORS handling

When you configure `cors(...)`, CORS is handled early — deliberately ahead of
authentication. The reference gives the reason without hedging:

> CORS must be processed before Spring Security, because the pre-flight request
> does not contain any cookies (that is, the `JSESSIONID`). If the request does
> not contain any cookies and Spring Security is first, the request determines
> that the user is not authenticated (since there are no cookies in the request)
> and rejects it.

A preflight is an `OPTIONS` request the browser sends on its own, carrying no
credentials by design. If authentication saw it first it would reject it, the
browser would never send the real request, and you would debug a "CORS error"
that is actually a 401 on an `OPTIONS` you never wrote. That whole failure mode
is [chunk 12](12-cors-for-an-spa.md).

## `CsrfFilter`

Validates the CSRF token on unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`).
It runs **before** the authentication filters, which is why a rejected token
produces a 403 that has nothing to do with whether you were logged in — and why
"but I *am* authenticated" is not a useful observation when debugging it.

The ordering is not arbitrary. CSRF is about the *request* being forged, not
about who the user is; a forged request carries the victim's real session cookie
and would authenticate perfectly. Checking the token first means the forgery is
rejected regardless of how convincing the credentials look.
[Chunk 13](13-csrf-decisions.md).

## The authentication filters

Three you will meet:

| Filter | Added by | Reads |
|---|---|---|
| `UsernamePasswordAuthenticationFilter` | `formLogin` | form POST to `/login` |
| `BasicAuthenticationFilter` | `httpBasic` | `Authorization: Basic …` |
| `BearerTokenAuthenticationFilter` | `oauth2ResourceServer` | `Authorization: Bearer …` |

Each turns a *credential in the request* into an `Authentication` in the
`SecurityContextHolder`, then gets out of the way.

**An authentication filter that finds no credential of its kind does not reject
the request.** It does nothing and passes it on. This is the design decision
that lets one chain serve both public and protected paths: rejection is a
separate concern, decided later, by somebody who knows the rules.

`AnonymousAuthenticationFilter` then fills the gap — if nothing authenticated,
it installs an `AnonymousAuthenticationToken` so that downstream code always has
*an* `Authentication` rather than `null`. That is why
`SecurityContextHolder.getContext().getAuthentication()` inside a `permitAll`
endpoint returns an object whose name is `anonymousUser` rather than returning
`null`, and why a null check is the wrong way to ask "is anyone logged in".

## `AuthorizationFilter`

The last filter, added by `authorizeHttpRequests`. It evaluates your rules and
throws `AccessDeniedException` when they fail. Being last is the ordering
guarantee the reference described: every authentication filter has already had
its chance, so the decision is made against the final identity.

## `ExceptionTranslationFilter`

The one that produces the status code. It wraps the rest of the chain:

```java
try {
    filterChain.doFilter(request, response);           // everything downstream
} catch (AccessDeniedException | AuthenticationException ex) {
    if (!authenticated || ex instanceof AuthenticationException) {
        startAuthentication();                         // → AuthenticationEntryPoint
    } else {
        accessDenied();                                // → AccessDeniedHandler
    }
}
```

- **No usable authentication** → the `AuthenticationEntryPoint` runs. It "might
  perform a redirect to a log in page, respond with an `WWW-Authenticate`
  header, or take other action". For a bearer-token API that means **401**.
  Before it runs, the reference notes two steps: the `SecurityContextHolder` is
  cleared, and the request is saved so it can be replayed after a successful
  login — which is how a form-login app returns you to the page you wanted.
- **Authenticated but not permitted** → the `AccessDeniedHandler` runs: **403**.

Read the placement of that `try` once more. **The catch is inside the filter
chain, outside your controller.** `@ControllerAdvice` is a Spring MVC construct
living inside `DispatcherServlet`, and `DispatcherServlet` is downstream of
every filter here. A security rejection therefore never reaches it. That is the
number one "my global error handler does not work" report, and the fix is in
[chunk 14](14-the-traps.md).

## The trade-off

A fixed filter order means you cannot get the sequencing wrong, and the sequence
encodes real security reasoning (forgery before identity, identity before
permission). What it costs is **inspectability**: the order is a property of a
class in Spring Security, not of your code, so reading your configuration tells
you *which* filters exist and not *when* they run. Learning the list once is
cheaper than repeatedly guessing.

## Gotchas

**Symptom:** Login succeeds, the next request is anonymous.
**Cause:** `SecurityContextHolderFilter` does not save; you authenticated
manually and never called `saveContext`.
**Fix:** The explicit `securityContextRepository.saveContext(context, request,
response)` call shown above, with an `HttpSessionSecurityContextRepository`.

**Symptom:** You reordered `http.csrf(...)` and `http.httpBasic(...)` in your
configuration and nothing changed.
**Cause:** The DSL is declarative. Runtime order comes from
`FilterOrderRegistration`.
**Fix:** Stop trying to reorder — the symptom has another cause. If you
genuinely need a filter at a different position, add your own with
`addFilterBefore` / `addFilterAfter` naming the reference filter class.

**Symptom:** `getAuthentication()` returns a non-null object on a `permitAll`
endpoint, so a null check never fires.
**Cause:** `AnonymousAuthenticationFilter` installed an
`AnonymousAuthenticationToken`.
**Fix:** Test the right thing:
`!(auth instanceof AnonymousAuthenticationToken) && auth.isAuthenticated()`, or
inject `@AuthenticationPrincipal` and let it be `null` for anonymous callers.

**Symptom:** Your custom filter runs but `SecurityContextHolder.getContext()`
is empty inside it.
**Cause:** You registered it as an ordinary servlet filter (a `Filter` `@Bean`,
or via `FilterRegistrationBean`), so it runs *outside* `FilterChainProxy` and
therefore before `SecurityContextHolderFilter`.
**Fix:** Register it inside the chain, positioned against a named filter:

```java
http.addFilterAfter(new TenantFilter(), SecurityContextHolderFilter.class);
```

**Symptom:** CSRF 403s on requests where the user is definitely logged in.
**Cause:** `CsrfFilter` runs before authentication and does not care.
**Fix:** Supply the token, or make the deliberate decision in
[chunk 13](13-csrf-decisions.md).

**Symptom:** A 401 body is Boot's default error shape, not the `ProblemDetail`
your `@ControllerAdvice` produces.
**Cause:** `ExceptionTranslationFilter` handled it upstream of MVC.
**Fix:** Supply an `AuthenticationEntryPoint` and `AccessDeniedHandler` that
write the same shape — shown in [chunk 14](14-the-traps.md).

## Interview questions

**★ Why does `CsrfFilter` run before the authentication filters?**
Because CSRF is about the request being forged, not about the user's identity. A
forged request carries the victim's genuine session cookie, so it would
authenticate successfully; validating the token first rejects it before the
identity question is even asked.

**★ Why doesn't an authentication filter reject a request when it finds no credentials?**
Because "no credentials" is not necessarily an error — the endpoint may be
public. Separating "establish identity" from "decide access" is what lets a
single chain serve both public and protected paths, and it puts the rejection
decision in the one component that actually knows the rules,
`AuthorizationFilter`.

**★ What changed with `SecurityContextHolderFilter` in Spring Security 6, and what breaks?**
The context is no longer saved automatically at the end of the request; saving
became explicit. What breaks is any code that authenticated a user manually and
relied on the old filter to persist it — the login appears to work and the next
request is anonymous. The fix is an explicit
`securityContextRepository.saveContext(...)`.

**★ Difference between `AuthenticationEntryPoint` and `AccessDeniedHandler`?**
`AuthenticationEntryPoint` runs when there is no usable authentication and asks
for credentials — 401, or a redirect to a login page. `AccessDeniedHandler` runs
when the caller is authenticated but lacks the authority — 403.
`ExceptionTranslationFilter` chooses between them by exception type and by
whether the current `Authentication` is authenticated.

**★ You return `ProblemDetail` from a `@ControllerAdvice`. Why is your 403 a different shape?**
Because the 403 was produced by `ExceptionTranslationFilter` in the filter
chain, upstream of `DispatcherServlet`. `@ControllerAdvice` only sees exceptions
from handler mapping and controller execution. To unify the shape you implement
`AuthenticationEntryPoint` and `AccessDeniedHandler` and have them serialise the
same `ProblemDetail`.

**★ Why does `ExceptionTranslationFilter` save the request before starting authentication?**
So the original request can be replayed after login. `RequestCacheAwareFilter`
restores it on the way back through, which is why a form-login application sends
you to the page you were trying to reach rather than to a generic landing page.
For a stateless bearer-token API this machinery is inert and is one of several
reasons `SessionCreationPolicy.STATELESS` is the right setting there.

**★ Where would you insert a filter that reads a tenant header and must see the authenticated user?**
After `SecurityContextHolderFilter` at the earliest, and realistically after the
authentication filter that establishes identity — for a bearer-token API,
`addFilterAfter(tenantFilter, BearerTokenAuthenticationFilter.class)`. Position
it relative to a named security filter, never as a plain servlet filter, or it
runs outside `FilterChainProxy` where no security state exists.

---

← Prev: [One filter, three objects](01-one-filter-three-objects.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Authentication and authorization](03-authentication-and-authorization.md)
