---
title: "Authentication and authorization"
sidebar_label: "3 · Authentication vs authorization"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Servlet
> Authentication Architecture*
> (docs.spring.io/spring-security/reference/servlet/authentication/architecture.html
> — `SecurityContextHolder` and its strategy modes, `SecurityContext`,
> `Authentication`, `GrantedAuthority`, `AuthenticationManager`,
> `ProviderManager`, `AuthenticationProvider`, `AbstractAuthenticationProcessingFilter`).
> Spring Boot 4.1.1, Spring Security 7.x, JDK 25.

**Authentication answers "who is calling"; authorization answers "may they do
this". Spring Security keeps them in different objects, different filters and
different failure modes — and the reason it can afford to separate them so
cleanly is that the answer to the first question is stashed somewhere everything
downstream can read without being handed it. This chunk is the five objects that
answer the first question; [chunk 4](04-the-threadlocal-caveat.md) is the cost
of where the answer is kept.**

## `SecurityContextHolder`

> The `SecurityContextHolder` is where Spring Security stores the details of who
> is authenticated.

It holds a `SecurityContext`, by default in a `ThreadLocal`. Three documented
strategies:

| Mode | Behaviour |
|---|---|
| `MODE_THREADLOCAL` | default — context visible to the current thread only |
| `MODE_INHERITABLETHREADLOCAL` | child threads inherit the identity at creation |
| `MODE_GLOBAL` | every thread in the JVM shares one context |

`MODE_GLOBAL` is for standalone desktop-style applications and is actively wrong
in a server — one user's login would become everyone's.
`MODE_INHERITABLETHREADLOCAL` looks like the answer to a problem it does not
actually solve, which is [chunk 4](04-the-threadlocal-caveat.md)'s subject.

The reference warns against mutating the existing context:

> You should create a new `SecurityContext` instance instead of using
> `SecurityContextHolder.getContext().setAuthentication(authentication)` to
> avoid race conditions across multiple threads.

So the correct shape is always create-then-set:

```java
SecurityContext context = SecurityContextHolder.createEmptyContext();
context.setAuthentication(authentication);
SecurityContextHolder.setContext(context);
```

Better still, inject the strategy rather than reaching for the static:

```java
private final SecurityContextHolderStrategy strategy =
        SecurityContextHolder.getContextHolderStrategy();
```

That indirection makes the code testable and lets the strategy be swapped
without every call site knowing.

## `SecurityContext` and `Authentication`

`SecurityContext` is a thin wrapper holding one `Authentication`.
`Authentication` has two jobs, and this dual role is a genuine source of
confusion:

1. **Input** to `AuthenticationManager` — a credential to be checked, with
   `isAuthenticated()` returning `false`.
2. **Output** — the established identity stored in the `SecurityContext`.

It carries three things: `principal` (who — often a `UserDetails`),
`credentials` (the password, "typically cleared after authentication"), and
`authorities`.

The dual role is exactly why hand-built tokens go wrong. The two-argument
`new UsernamePasswordAuthenticationToken(principal, credentials)` constructor
deliberately produces an **unauthenticated** token with no authorities — it is
the *input* form. The three-argument version, or the explicit
`UsernamePasswordAuthenticationToken.authenticated(principal, credentials,
authorities)` factory, produces the *output* form.

## `GrantedAuthority`

> High-level permissions the user is granted. Two examples are roles and scopes.

They are strings, application-wide, and *not* domain-object permissions.
`ROLE_ADMIN` is an authority; `SCOPE_orders.read` is an authority. "May edit
invoice 4711" is not — that is a `@PostAuthorize` expression or a
`PermissionEvaluator`, covered in [chunk 7](07-method-security.md).

The reference is explicit that these are "application-wide permissions" and not
domain-object-specific, and holding that line is worth real effort: authorities
that encode object identity (`EDIT_INVOICE_4711`) turn into an unbounded set
that has to be loaded on every request and cannot be reasoned about.

## `AuthenticationManager`, `ProviderManager`, `AuthenticationProvider`

`AuthenticationManager` is the one-method API the filters call.
`ProviderManager` is the usual implementation: it holds a list of
`AuthenticationProvider`s, asks each whether it `supports` the token type, and
delegates until one succeeds. `ProviderNotFoundException` if none can.

Two behaviours worth knowing:

- A `ProviderManager` can have a **parent**, so a global set of providers is
  shared across several chains without duplication.
- It **erases credentials after a successful authentication** by default. The
  reference flags the consequence: if the `Authentication` references a cached
  object such as a `UserDetails` "and this has its credentials removed, it is no
  longer possible to authenticate against the cached value". That is the real
  cause of "the second login for the same user fails" when a
  `UserDetailsService` caches its objects.

`AuthenticationProvider` is where a mechanism lives:
`DaoAuthenticationProvider` for username/password against a `UserDetailsService`
plus a `PasswordEncoder` ([chunk 11](11-password-encoding.md)),
`JwtAuthenticationProvider` for a bearer token
([chunk 9](09-jwt-resource-server.md)).

## `AbstractAuthenticationProcessingFilter` — the shape every login shares

Every credential-processing filter follows the same documented sequence, and
knowing it tells you where to hook in:

1. Build an `Authentication` from the `HttpServletRequest` —
   `UsernamePasswordAuthenticationFilter` builds a
   `UsernamePasswordAuthenticationToken`.
2. Pass it to the `AuthenticationManager`.
3. **On failure:** clear the `SecurityContextHolder`, notify
   `RememberMeServices.loginFail()`, invoke the `AuthenticationFailureHandler`.
4. **On success:** notify the `SessionAuthenticationStrategy`, merge in the
   authorities of any existing authenticated `Authentication`, set the result on
   the `SecurityContextHolder`, notify `RememberMeServices.loginSuccess()`,
   publish an `InteractiveAuthenticationSuccessEvent`, invoke the
   `AuthenticationSuccessHandler`.

Two useful facts fall out of that list. The `InteractiveAuthenticationSuccessEvent`
is a plain Spring application event, so audit logging of logins needs no filter
of your own — just an `@EventListener`. And the `SessionAuthenticationStrategy`
step is what performs session fixation protection (a new session id on login),
which is why disabling session management wholesale removes a protection people
did not know they had.

## Where the identity comes from, per style

| Style | Filter | Provider | Identity source |
|---|---|---|---|
| Form login | `UsernamePasswordAuthenticationFilter` | `DaoAuthenticationProvider` | your `UserDetailsService` + `PasswordEncoder` |
| HTTP Basic | `BasicAuthenticationFilter` | same | same |
| JWT resource server | `BearerTokenAuthenticationFilter` | `JwtAuthenticationProvider` | the token's signed claims |
| Session replay | `SecurityContextHolderFilter` | — | a previously saved `SecurityContext` |

Note the fourth row: **on most requests in a session-based app, nothing
authenticates at all.** The identity is restored, not re-established. That
distinction matters as soon as you ask "where do I check whether this account is
still active" — the answer is not the authentication provider, because on the
overwhelming majority of requests it does not run.

The JWT row has the mirror-image property: there is no server-side state, so the
identity *is* re-derived on every request from the token — but only from the
token, so a revoked account remains valid until the token expires. Both styles
have a staleness window; they are just in different places.

## The trade-off

Splitting identity from permission means the same authorization rules work
unchanged whether users arrive by form login, Basic, or a bearer token — which
is why you can add a machine-to-machine chain to an existing app without
rewriting a single rule. The cost is indirection: a failing request has to be
traced through two independent subsystems before you learn whether it failed
because Spring did not know who you were or because it did and said no. The 401
versus 403 distinction is the only free signal you get, and it is worth reading
carefully rather than lumping both together as "auth is broken".

## Gotchas

**Symptom:** The second login for a user fails with bad credentials; the first
worked.
**Cause:** `ProviderManager` erased the credentials on a cached `UserDetails`
instance.
**Fix:** Have the `UserDetailsService` return a fresh instance per call, or set
`eraseCredentialsAfterAuthentication(false)` on the `ProviderManager` and accept
that the password hash stays reachable in memory for longer.

**Symptom:** Authorization behaves as though the user has no roles, though login
clearly succeeded.
**Cause:** The `Authentication` was rebuilt with the two-argument
`UsernamePasswordAuthenticationToken` constructor, which yields an
unauthenticated token with no authorities.
**Fix:** Use `UsernamePasswordAuthenticationToken.authenticated(principal,
credentials, authorities)`.

**Symptom:** Race conditions or cross-talk after code calls
`SecurityContextHolder.getContext().setAuthentication(...)`.
**Cause:** Mutating a shared context object instead of replacing it.
**Fix:** `createEmptyContext()`, set the authentication on the new object, then
`setContext(...)`.

**Symptom:** A disabled account keeps working until its session expires.
**Cause:** On session-based requests nothing re-authenticates; the context is
restored from the session.
**Fix:** Check account state where it matters — a filter, an interceptor, or the
service itself — or move to short-lived tokens so the identity is re-derived on
every call.

**Symptom:** `ProviderNotFoundException` after adding a custom token type.
**Cause:** No registered `AuthenticationProvider` returns `true` from
`supports(...)` for that token class.
**Fix:** Implement `supports(Class<?>)` on the provider to accept the exact token
type, and register the provider on the `AuthenticationManager` used by that chain
— it is per-chain, not global, unless you wired a parent.

**Symptom:** Authorities are correct in the login response and gone on subsequent
requests.
**Cause:** A custom `Authentication` implementation that is not serialisable, or
whose authorities field does not survive being stored in and read back from the
session.
**Fix:** Keep the stored principal small and serialisable; if it must be rich,
store an id and load the rest per request.

## Interview questions

**★ Authentication vs authorization, in Spring Security's own terms?**
Authentication produces an `Authentication` object and stores it in the
`SecurityContext`; it is performed by authentication filters delegating to
`AuthenticationManager`. Authorization consumes that object and decides access;
it is performed by `AuthorizationFilter` and by method-security interceptors.
They also fail differently — 401 via the entry point, 403 via the access-denied
handler — so the status code tells you which half failed.

**★ Why is `Authentication` used both as input and output?**
Because an attempt and an established identity carry the same data — principal,
credentials, authorities — differing only in whether it has been verified, which
`isAuthenticated()` records. It keeps `AuthenticationManager` to a single type.
The cost is that a hand-built token is silently unauthenticated if you pick the
input-form constructor.

**★ What is a `GrantedAuthority`, and what is it not?**
A coarse, application-wide permission string such as `ROLE_ADMIN` or
`SCOPE_orders.read`. It is not a per-object permission: "this user may edit that
specific invoice" cannot be expressed as an authority and belongs in a
`@PostAuthorize` expression or a `PermissionEvaluator`.

**★ What does `ProviderManager` add over a single `AuthenticationProvider`?**
It lets several mechanisms coexist — each provider declares the token types it
supports and the manager delegates until one succeeds. It also supports a parent
manager so chains can share providers, and it erases credentials on success by
default.

**★ In a session-based application, how often does authentication actually run?**
Once, at login. Every subsequent request is `SecurityContextHolderFilter`
restoring a saved context — no provider runs, no credentials are checked. This
is why account deactivation does not take effect until the session ends unless
you check for it explicitly.

**★ Where would you hook in to audit every successful login?**
An `@EventListener` for `InteractiveAuthenticationSuccessEvent`, published by
`AbstractAuthenticationProcessingFilter` on success. Custom filters are
unnecessary, and the event carries the resulting `Authentication`, so the
principal and authorities are available.

**★ What is `SessionAuthenticationStrategy` for, and why should you care before disabling session management?**
It is notified on successful authentication and is where session fixation
protection lives — the session id is changed on login so an id an attacker
planted beforehand becomes useless. Turning session management off wholesale to
"go stateless" removes that protection; for a genuinely stateless API there is
no session to fixate and that is fine, but the reasoning has to be that, not
convenience.

---

← Prev: [The filters that matter](02-the-filters-that-matter.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The thread-local caveat](04-the-threadlocal-caveat.md)
