---
title: "@WithAnonymousUser is not the absence of authentication, @WithUserDetails requires the user to exist in a UserDetailsService the slice has probably excluded, and @WithSecurityContext is the only one of the three that can produce a principal of your own type"
sidebar_label: "08h · The other three annotations"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Security 7.1.1** sources —
> [`WithUserDetails`](https://github.com/spring-projects/spring-security/blob/7.1.1/test/src/main/java/org/springframework/security/test/context/support/WithUserDetails.java),
> `WithAnonymousUser`, `WithSecurityContext`, `WithUserDetailsSecurityContextFactory` — and
> the Security reference
> [Testing Method Security](https://docs.spring.io/spring-security/reference/servlet/test/method.html)
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/test/method.html)),
> read as asciidoc at tag `7.1.1`; plus the **Spring Boot 4.1.1**
> `UserDetailsServiceAutoConfiguration`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Spring Security 7.1.1, AssertJ 3.27.7.
> **No sandbox** — this page carries Java and library source, never a fabricated test run.

**`@WithMockUser` ([08g](08g-authenticating-the-test.md)) covers the common case and cannot
express three things: an unauthenticated-looking request, a principal that came from your own
`UserDetailsService`, and a principal that is not a `UserDetails` at all. Each has its own
annotation, and each has a trap — the anonymous one is not actually anonymous, the
`UserDetails` one needs a bean the slice has almost certainly excluded, and the custom one is
the only escape from `@AuthenticationPrincipal` returning `null`.**

## `@WithAnonymousUser` — populated, not empty

**`@WithAnonymousUser`** populates an anonymous authentication —
*"especially convenient when you wish to run most of your tests with a specific user but want
to run a few tests as an anonymous user"*, i.e. the override for a class-level
`@WithMockUser`. It is *not* the same as no annotation at all: an `AnonymousAuthenticationToken`
is present, so `isAuthenticated()` is true and only `authenticated()`/`hasRole` fail.

## `@WithUserDetails` — the user has to exist

**`@WithUserDetails`** goes through your real `UserDetailsService`, which is the point:

> *"some applications expect the `Authentication` principal to be of a specific type. …The
> custom principal is often returned by a custom `UserDetailsService` that returns an object
> that implements both `UserDetails` and the custom type."*

```java
@WithUserDetails("alice@example.com")
@WithUserDetails(value = "alice", userDetailsServiceBeanName = "myUserDetailsService")
```

with `value() default "user"` and, since Security 4.1, a bean-name attribute whose javadoc
says: *"If this is not provided, then the lookup is done by type and expects only a single
`UserDetailsService` bean to be exposed."* And the hard constraint the docs state plainly:

> *"unlike `@WithMockUser`, `@WithUserDetails` requires the user to exist."*

In a `@WebMvcTest` that is the sticking point. Your real `UserDetailsService` is a
`@Service` or a `@Bean` on an excluded configuration class, so it is not in the slice — and
if nothing else supplies one, Boot's `UserDetailsServiceAutoConfiguration` supplies an
`InMemoryUserDetailsManager` holding only `user` with no authorities
([08](08-security-in-a-slice.md)). `@WithUserDetails("alice")` then fails to find the user.
Supply one deliberately:

```java
@WebMvcTest(OrderController.class)
@Import({ SecurityConfig.class, TestUsers.class })
class OrderTests {

    @TestConfiguration
    static class TestUsers {
        @Bean UserDetailsService users() {
            return new InMemoryUserDetailsManager(
                    User.withUsername("alice").password("{noop}x").roles("ADMIN").build());
        }
    }
}
```

⚠️ Note the side effect: adding a `UserDetailsService` bean makes
`UserDetailsServiceAutoConfiguration` back off, so Boot's generated `user` disappears at the
same moment. If another test in the class relied on it, that test changes behaviour.

## `@WithSecurityContext` — anything else

**`@WithSecurityContext`** is the escape hatch for a principal neither of the others can
build — a custom `Authentication` type, extra claims, a tenant on the token. You write a
meta-annotation and a `WithSecurityContextFactory`, and the docs note that the factory *"can
be annotated with standard Spring annotations"* (`WithUserDetailsSecurityContextFactory`
uses `@Autowired` to get the `UserDetailsService`), so the factory can pull collaborators out
of the test context.


A worked `@WithSecurityContext` looks like this — one meta-annotation, one factory:

```java
@Retention(RetentionPolicy.RUNTIME)
@WithSecurityContext(factory = WithMockTenantUserSecurityContextFactory.class)
public @interface WithMockTenantUser {
    String username() default "alice";
    String tenant() default "acme";
}

final class WithMockTenantUserSecurityContextFactory
        implements WithSecurityContextFactory<WithMockTenantUser> {

    @Override
    public SecurityContext createSecurityContext(WithMockTenantUser annotation) {
        TenantPrincipal principal = new TenantPrincipal(annotation.username(), annotation.tenant());
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(
                principal, null, AuthorityUtils.createAuthorityList("ROLE_USER"));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        return context;
    }
}
```

`@AuthenticationPrincipal TenantPrincipal me` now resolves, because the principal is your
type. All three annotations share `setupBefore`, class-level placement and meta-annotation
support with `@WithMockUser`, and all three are cleared after the test by the same listener.

The docs also point out the meta-annotation trick applies across the family: *"Meta
annotations work with any of the testing annotations described above. For example, this means
we could create a meta annotation for `@WithUserDetails("admin")` as well."*

## Gotchas

**★ Treating `@WithAnonymousUser` as "no authentication".**
It installs an `AnonymousAuthenticationToken`, so the `SecurityContext` is populated and
`Authentication#isAuthenticated()` is `true`. Expressions like `isAnonymous()` and
`permitAll()` behave differently from a request with no context at all — which is what a real
unauthenticated request produces, and what your protection tests actually want.

**★ Using `@WithAnonymousUser` where simply omitting the annotation would do.**
On a method in a class with no class-level `@WithMockUser`, the annotation adds an anonymous
token that would not otherwise be there. Its purpose is *overriding* a class-level user, and
using it elsewhere quietly changes what the chain sees.

**★ `@WithUserDetails` failing in a slice because the user does not exist.**
The docs are explicit: *"unlike `@WithMockUser`, `@WithUserDetails` requires the user to
exist."* Your real `UserDetailsService` is a `@Service` or a `@Bean` on an excluded
configuration class ([08e](08e-the-chain-you-are-not-testing.md)), so the slice has either
Boot's `user`-only in-memory manager or nothing at all.

**★ Adding a `UserDetailsService` for `@WithUserDetails` and breaking another test.**
`UserDetailsServiceAutoConfiguration` is `@ConditionalOnMissingBean` of
`UserDetailsService` among others. The moment you supply one, Boot's generated `user`
vanishes — so any test relying on `spring.security.user.*` or on `httpBasic("user", …)`
changes behaviour in the same commit.

**★ Two `UserDetailsService` beans and no `userDetailsServiceBeanName`.**
The javadoc says the lookup *"is done by type and expects only a single `UserDetailsService`
bean to be exposed"*. Two beans — a real one and a test one, say — and resolution fails. Name
the one you mean; the attribute exists since Security 4.1.

**★ Expecting `@WithUserDetails` to authenticate credentials.**
It does not. It loads the `UserDetails` and wraps it in an already-authenticated
`UsernamePasswordAuthenticationToken`; the password is never checked and an account with a
wrong or absent password still works. It is a shortcut past authentication, not a test of it.

**★ Expecting `@WithUserDetails` to respect account flags.**
Because no `AuthenticationProvider` runs, none of `isEnabled`, `isAccountNonLocked` or
`isAccountNonExpired` is evaluated. A disabled user authenticates perfectly well in the test
and is rejected in production — a divergence that only a real authentication test will catch.

**★ Writing a `WithSecurityContextFactory` that reads a bean via `SecurityContextHolder`.**
The factory runs before the context is populated, by definition. Inject what you need —
the docs point out factories *"can be annotated with standard Spring annotations"*, and
`WithUserDetailsSecurityContextFactory` uses `@Autowired` for exactly this.

**★ Building a custom `SecurityContext` and forgetting the authorities.**
A hand-built `UsernamePasswordAuthenticationToken` with an empty authority list is
authenticated but has no roles, so it clears `authenticated()` and fails every `hasRole` —
the same shape as Boot's default in-memory user ([08](08-security-in-a-slice.md)) and the
same confusing 403.

**★ Using the two-argument `UsernamePasswordAuthenticationToken` constructor in a factory.**
The two-argument form produces an *unauthenticated* token; only
`UsernamePasswordAuthenticationToken.authenticated(...)` (or the three-argument constructor)
sets `authenticated = true`. A factory that gets this wrong produces a context that looks
populated and behaves as anonymous.

## Interview questions

**★ Is `@WithAnonymousUser` the same as running with no annotation?**
No. It populates the `SecurityContextHolder` with an `AnonymousAuthenticationToken`, so
there *is* an `Authentication` and `isAuthenticated()` returns true. Its purpose is to
override a class-level `@WithMockUser` for one method — *"especially convenient when you wish
to run most of your tests with a specific user but want to run a few tests as an anonymous
user"*. A genuinely unauthenticated request has no context at all, and the two can differ
under `isAnonymous()` and under a custom `AuthenticationEntryPoint`.

**★ What does `@WithUserDetails` require that `@WithMockUser` does not?**
That the user exists. It resolves the username through a `UserDetailsService` bean — by type
unless you pass `userDetailsServiceBeanName`, and by type it requires exactly one such bean —
and the docs state plainly that *"unlike `@WithMockUser`, `@WithUserDetails` requires the user
to exist."* In a `@WebMvcTest` your real service is usually excluded from the slice, so you
supply a `@TestConfiguration` one, which in turn makes Boot's auto-configured in-memory user
back off.

**★ Does `@WithUserDetails` test your authentication?**
No, and mistaking it for that is the trap. It loads the `UserDetails` and hands you an
already-authenticated token; passwords are not checked and the `isEnabled` /
`isAccountNonLocked` / `isAccountNonExpired` flags are never consulted, because no
`AuthenticationProvider` runs. It tests what happens *after* authentication with a realistic
principal — which is exactly what it is for.

**★ When do you need `@WithSecurityContext`?**
When neither of the others can produce the principal your code expects: a custom
`Authentication` implementation, a principal that is not a `UserDetails`, a token carrying
claims or a tenant. You write a meta-annotation pointing at a `WithSecurityContextFactory`
and build the `SecurityContext` yourself. The factory is a Spring bean-like object — it can
be `@Autowired` — so it can reach into the test context for collaborators, which is how
`WithUserDetailsSecurityContextFactory` gets its `UserDetailsService`.

**★ Your `@AuthenticationPrincipal CustomUser` is `null` in every test. Which annotation fixes
it?**
`@WithUserDetails`, if your `UserDetailsService` returns an object implementing both
`UserDetails` and `CustomUser` and you can put that service in the slice; otherwise
`@WithSecurityContext` with a factory that constructs the principal directly.
`@WithMockUser` cannot, because its factory always builds Spring Security's own `User`.

Next: the request-scoped alternative to all of these, and how to assert who ended up
authenticated — [08i · Post-processors and asserting identity](08i-post-processors-and-asserting-identity.md).

{/* FOOTER */}
