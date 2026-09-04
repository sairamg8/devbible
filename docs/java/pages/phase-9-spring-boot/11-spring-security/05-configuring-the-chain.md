---
title: "Configuring the chain"
sidebar_label: "5 · Configuring the chain"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Authorize HTTP
> Requests*
> (docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html),
> *Architecture*
> (docs.spring.io/spring-security/reference/servlet/architecture.html) and
> *Session Management*
> (docs.spring.io/spring-security/reference/servlet/authentication/session-management.html),
> plus the Spring Security 7.0 configuration-migration notes on the removal of
> `and()`. Spring Boot 4.1.1, Spring Security 7.x, JDK 25.

**A `SecurityFilterChain` bean is the whole configuration surface. There is no
`WebSecurityConfigurerAdapter` any more, there is no `and()` any more, and in
Spring Security 7 the lambda DSL is not a style preference — it is the only DSL
that exists. Every sample you find online containing `http.csrf().disable()` is
dead syntax that will not compile.**

## 🔴 The DSL you will see online does not compile

Spring Security 7 **removed `and()`**. The chained style it enabled —

```java
// ⛔ Spring Security 5 era. Does not compile on 7.
http
    .csrf().disable()
    .authorizeRequests()
        .antMatchers("/public/**").permitAll()
        .anyRequest().authenticated()
    .and()
    .httpBasic();
```

— is gone in three separate ways, and it is worth naming all three because a
search result usually violates all of them at once:

1. **`and()` was removed.** The lambda DSL returns the `HttpSecurity` instance
   from each configurer method, so there is nothing to chain back from. (The
   related `HttpSecurity#apply(...)` was deprecated in 6.2 for the same reason
   and replaced by `with(...)`.)
2. **`authorizeRequests()` is gone**, replaced by `authorizeHttpRequests()`.
3. **`antMatchers()` / `mvcMatchers()` / `regexMatchers()` are gone**, replaced
   by the single `requestMatchers(...)`.

And separately, `WebSecurityConfigurerAdapter` — the class every pre-2022
tutorial extends — was removed in Spring Security 6. There is nothing to extend.

The current form:

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(CsrfConfigurer::disable)
            .cors(Customizer.withDefaults())
            .build();
    }
}
```

Read the indentation: it *is* the structure. That was the stated goal of the
lambda DSL — automatic indentation making the configuration readable, with no
`.and()` needed to climb back out of a nested section.

`@EnableWebSecurity` is optional under Spring Boot (the auto-configuration
applies it), but writing it makes the file's job obvious and is harmless.

## What each rule means

Inside `authorizeHttpRequests`, each line is **a matcher and an access rule**:

| Rule | Meaning |
|---|---|
| `permitAll()` | allowed for everyone, including anonymous |
| `denyAll()` | allowed for nobody, ever |
| `authenticated()` | any non-anonymous identity |
| `hasAuthority("SCOPE_orders.read")` | that exact authority string |
| `hasAnyAuthority(...)` | any one of them |
| `hasRole("ADMIN")` | shorthand for `hasAuthority("ROLE_ADMIN")` |
| `hasAnyRole(...)` | any one of them, each `ROLE_`-prefixed |
| `access(...)` | an `AuthorizationManager` — the general form |

`access(...)` is how the newer purpose-built managers are plugged in, for
example scope checks on a resource server:

```java
import static org.springframework.security.oauth2.core.authorization
        .OAuth2AuthorizationManagers.hasScope;

.requestMatchers("/messages/**").access(hasScope("messages"))
```

## 🔴 The `ROLE_` prefix trap

`hasRole("ADMIN")` prepends `ROLE_` for you. `hasAuthority("ADMIN")` does not.
So:

```java
.requestMatchers("/admin/**").hasRole("ROLE_ADMIN")   // ⛔ looks for ROLE_ROLE_ADMIN
.requestMatchers("/admin/**").hasRole("ADMIN")        // ✅ looks for ROLE_ADMIN
.requestMatchers("/admin/**").hasAuthority("ROLE_ADMIN")  // ✅ same thing, spelled out
```

The double-prefixed version fails **silently and always** — nobody has
`ROLE_ROLE_ADMIN`, so the endpoint 403s for every caller including real admins,
with no error, no warning and no startup failure.

The rule that keeps it straight: **`hasRole` takes the role without the prefix;
`hasAuthority` takes the authority string exactly as stored.** Pick one style
per codebase. Mixing them across a large configuration is how the mistake gets
in, because the same string is correct in one call and wrong in the other.

The same trap exists on the producing side. If your `UserDetailsService` or JWT
converter emits authorities that are *not* `ROLE_`-prefixed, `hasRole` can never
match them — see [chunk 9](09-jwt-resource-server.md) for the converter, where
the default prefix is `SCOPE_` rather than `ROLE_`.

## 🔴 Order is first-match, top to bottom

Rules are evaluated in declaration order and **the first matching rule wins**.
Everything after a matching line is ignored for that request.

```java
.authorizeHttpRequests(auth -> auth
    .anyRequest().authenticated()                 // ⛔ matches everything
    .requestMatchers("/public/**").permitAll()    // ⛔ unreachable
)
```

`anyRequest()` is a matcher like any other; put it anywhere but last and every
rule below it is dead. Spring Security detects this particular case at
configuration time and refuses to start rather than shipping a silently broken
policy — one of the few places you get a startup failure instead of a runtime
surprise.

**`anyRequest()` should be the last line of every chain, and it should be
restrictive.** `anyRequest().permitAll()` is a default-open policy: every
endpoint anyone adds in future is public until somebody remembers to write a
rule. `anyRequest().authenticated()` (or `denyAll()`) is default-closed, and the
failure mode of forgetting a rule becomes "the new endpoint 403s in staging"
rather than "the new endpoint was public for four months".

## `sessionManagement` and what `STATELESS` actually does

| Policy | Behaviour |
|---|---|
| `ALWAYS` | eagerly creates a session for every request |
| `IF_REQUIRED` | creates one only when needed — the default |
| `NEVER` | never creates one, but will use an existing one |
| `STATELESS` | never creates one, and prevents request caching |

`STATELESS` is not a magic word meaning "I use JWTs". Concretely it installs a
`NullSecurityContextRepository`, so no context is persisted and every request
re-authenticates from whatever credential it carries; and it stops the
saved-request machinery that exists to replay a request after login.

Note `NEVER` versus `STATELESS`: `NEVER` still *reads* an existing session, so a
session created by something else in the application still authenticates
requests. For an API that genuinely must not accept cookie-based identity,
`STATELESS` is the one that means it.

## The trade-off

Configuration-as-a-bean is a real improvement over the adapter class it
replaced: the chain is an object you can build conditionally, test, and have
several of. The cost is that **the DSL's power is invisible** — nothing about
`.csrf(CsrfConfigurer::disable)` tells you what it turned off, `permitAll` does
not say what else on that path is still enforced, and a rule that never matches
looks exactly like a rule that always passes. The configuration reads as a short
declarative block and behaves like a program.

## Gotchas

**Symptom:** Every online sample you copy fails to compile.
**Cause:** Spring Security 7 removed `and()`, `authorizeRequests()`,
`antMatchers()` and (in 6) `WebSecurityConfigurerAdapter`.
**Fix:** Lambda DSL, `authorizeHttpRequests`, `requestMatchers`, a
`SecurityFilterChain` `@Bean`. Check the publication date on anything you find.

**Symptom:** An admin user gets 403 on every admin endpoint.
**Cause:** `hasRole("ROLE_ADMIN")` — double prefix.
**Fix:** `hasRole("ADMIN")` or `hasAuthority("ROLE_ADMIN")`.

**Symptom:** The application refuses to start, complaining about a matcher after
`anyRequest()`.
**Cause:** `anyRequest()` was not last, so later rules are unreachable.
**Fix:** Move `anyRequest()` to the bottom. This is the good case — the same
mistake with two overlapping path patterns fails silently instead.

**Symptom:** A path rule with a wildcard matches less than you expect.
**Cause:** `/api/*` matches one path segment; `/api/**` matches any number.
**Fix:** Use `**` when you mean "and everything below".

**Symptom:** `POST /api/orders` is public although you only wrote
`permitAll` for `GET`.
**Cause:** `requestMatchers("/api/orders")` with no method argument matches all
methods.
**Fix:** `requestMatchers(HttpMethod.GET, "/api/orders")`.

**Symptom:** A session is still created for a JWT API.
**Cause:** `SessionCreationPolicy` left at the `IF_REQUIRED` default, or
something else in the app touched `HttpSession`.
**Fix:** `STATELESS`, and check that nothing (including error handling and
Spring MVC flash attributes) is creating a session behind you.

**Symptom:** After switching to `STATELESS`, form login stops working.
**Cause:** It is supposed to — with no `SecurityContextRepository` there is
nowhere to keep the logged-in identity between requests.
**Fix:** Do not mix them in one chain. Put the browser-facing endpoints on a
session-based chain and the API on a stateless one
([chunk 6](06-matchers-and-multiple-chains.md)).

## Interview questions

**★ What replaced `WebSecurityConfigurerAdapter`, and why was it removed?**
A `SecurityFilterChain` `@Bean` built from an injected `HttpSecurity`. It was
removed because inheritance-based configuration made composition awkward — you
could not easily have two configurations, ordering was tied to class hierarchy,
and overriding a method gave you no signal about what the default had been.
Beans compose; adapters did not.

**★ Why does Spring Security 7 not accept `http.csrf().disable()`?**
Because `and()` and the chained configurer style were removed in favour of the
lambda DSL; the configurer methods now take a `Customizer` and return
`HttpSecurity`. The equivalent is `http.csrf(CsrfConfigurer::disable)` — or
`http.csrf(csrf -> csrf.disable())`, which is the same thing.

**★ `hasRole("ADMIN")` versus `hasAuthority("ADMIN")` — what is the difference and how does it fail?**
`hasRole` prefixes `ROLE_` and so checks for `ROLE_ADMIN`; `hasAuthority` checks
the literal string `ADMIN`. Writing `hasRole("ROLE_ADMIN")` checks for
`ROLE_ROLE_ADMIN`, which nobody has, so the endpoint denies everyone silently
with no startup error.

**★ Why must `anyRequest()` be last?**
Because rules are first-match in declaration order, and `anyRequest()` matches
everything, so anything after it is unreachable. Spring Security catches this
specific case at startup, but the general principle — put narrow rules before
broad ones — is yours to enforce.

**★ Should `anyRequest()` be `permitAll()` or `authenticated()`?**
`authenticated()` (or `denyAll()`) in almost every case, because it makes the
policy default-closed. With `permitAll()` as the fallback, every endpoint anyone
adds later is public by default and nothing tells you.

**★ What does `SessionCreationPolicy.STATELESS` actually change?**
It installs a `NullSecurityContextRepository` so no `SecurityContext` is
persisted between requests, and it disables the saved-request mechanism used to
replay a request after login. Every request must therefore carry its own
credential. It is not a statement about JWTs specifically; it is a statement
about server-side state.

**★ What is the difference between `NEVER` and `STATELESS`?**
`NEVER` will not create a session but will happily use one that already exists,
so cookie-based identity still works. `STATELESS` refuses to persist anything.
For an API that must not accept a session cookie as proof of identity, only
`STATELESS` expresses that.

**★ How do you express a rule the built-in methods cannot?**
`access(AuthorizationManager)`. Everything else — `permitAll`, `hasRole`,
`authenticated` — is a convenience over that one method, and purpose-built
managers such as `OAuth2AuthorizationManagers.hasScope(...)` plug in the same
way.

---

← Prev: [The thread-local caveat](04-the-threadlocal-caveat.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Matchers and multiple chains](06-matchers-and-multiple-chains.md)
