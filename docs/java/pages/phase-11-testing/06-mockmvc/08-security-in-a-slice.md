---
title: "@WebMvcTest auto-configures Spring Security on purpose — a resource file in spring-boot-security-test pulls in five auto-configurations, addFilters registers the springSecurityFilterChain filter, and the chain that then guards every endpoint in your slice is Boot's anyRequest().authenticated() default"
sidebar_label: "08 · Security in a slice"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Boot 4.1.1** sources —
> [`WebMvcTest`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTest.java),
> [`AutoConfigureMockMvc`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/AutoConfigureMockMvc.java),
> [`ServletWebSecurityAutoConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-security/src/main/java/org/springframework/boot/security/autoconfigure/web/servlet/ServletWebSecurityAutoConfiguration.java),
> [`SecurityFilterAutoConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-security/src/main/java/org/springframework/boot/security/autoconfigure/web/servlet/SecurityFilterAutoConfiguration.java),
> [`UserDetailsServiceAutoConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-security/src/main/java/org/springframework/boot/security/autoconfigure/UserDetailsServiceAutoConfiguration.java),
> `SecurityProperties`, `SpringBootMockMvcBuilderCustomizer`, and
> `spring-boot-security-test`'s `META-INF/spring/….AutoConfigureMockMvc.imports`; plus the
> Boot reference
> ["Auto-configured Spring MVC Tests"](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)),
> read as asciidoc at tag `v4.1.1`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Spring Security 7.1.1, AssertJ 3.27.7.
> **No sandbox** — this page carries Java and library source, never a fabricated test run.

**Everyone meets this the same way: a working controller, a `@WebMvcTest`, and a 401 on a
`GET` that has no authentication in it anywhere. The instinct is that the slice turned
security on by accident. It did not — it turned it on deliberately, the javadoc says so in
its second paragraph, and there has been no switch to turn it off since Boot 2.1. This
chunk is the wiring: which auto-configurations arrive, how the filter reaches `MockMvc`,
and what Boot's default chain actually enforces. Why the status is 401 rather than 302 is
[08b](08b-the-401-and-the-302.md) and what to assert instead of it is
[08c](08c-asserting-protection-not-the-challenge.md); why your `POST` is 403 is
[08d](08d-csrf-in-the-slice.md); why the chain being enforced is not yours is
[08e](08e-the-chain-you-are-not-testing.md); and making the request *be* somebody starts at
[08g](08g-authenticating-the-test.md).**

## The javadoc says it in one sentence

`WebMvcTest` (Boot 4.1.1 — note the package is now
`org.springframework.boot.webmvc.test.autoconfigure`, moved in Boot 4, so imports copied
from a Boot 3 article will not compile):

> *"By default, tests annotated with `@WebMvcTest` will also auto-configure Spring
> Security and `MockMvc` (include support for HtmlUnit WebClient and Selenium WebDriver)."*

and the reference adds:

> *"If you have Spring Security on the classpath, `@WebMvcTest` will also scan
> `WebSecurityConfigurer` beans. Instead of disabling security completely for such tests,
> you can use Spring Security's test support."*

There is no off switch. Boot 2.1 removed the `@AutoConfigureMockMvc(secure = …)` attribute
and nothing replaced it; the annotation's attributes in 4.1 are `addFilters`, `print`,
`printOnlyOnFailure` and `htmlUnit`, and none of them means "no security".

## What is actually imported

`@WebMvcTest` is meta-annotated `@AutoConfigureMockMvc`, and a slice annotation's
auto-configurations come from `META-INF/spring/<annotation-fqn>.imports` files found across
the classpath — so a jar you did not think about can enlarge a slice. Two modules
contribute here. `spring-boot-webmvc-test` supplies the `MockMvc` half;
`spring-boot-security-test` supplies a file called
`org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc.imports` containing
exactly this:

```text
org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration
org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration
org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterAutoConfiguration
org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration
org.springframework.boot.security.test.autoconfigure.webmvc.SecurityMockMvcAutoConfiguration
```

Read left to right that is: the `AuthenticationEventPublisher`; an in-memory `user` with a
generated password; the `DelegatingFilterProxyRegistrationBean` that registers the servlet
filter named `springSecurityFilterChain`; the default `SecurityFilterChain`; and Spring
Security's `MockMvc` integration. Everything needed for a real, enforcing chain — because
that is the point. Security in the slice is a feature, not an oversight.

Note the **only** thing on that list that is test-specific is the last entry. The other four
are the same auto-configurations your application runs with, which is exactly why the slice
behaves like the real thing right up to the moment your own configuration would have
differed ([08e](08e-the-chain-you-are-not-testing.md)).

## How the filter gets onto the `MockMvc` builder

`SecurityFilterAutoConfiguration` does not add a filter to a chain — it publishes a
registration bean:

```java
@Bean
@ConditionalOnBean(name = DEFAULT_FILTER_NAME)          // "springSecurityFilterChain"
DelegatingFilterProxyRegistrationBean securityFilterChainRegistration(
        SecurityFilterProperties securityFilterProperties) {
    DelegatingFilterProxyRegistrationBean registration =
            new DelegatingFilterProxyRegistrationBean(DEFAULT_FILTER_NAME);
    registration.setOrder(securityFilterProperties.getOrder());
    registration.setDispatcherTypes(getDispatcherTypes(securityFilterProperties));
    return registration;
}
```

`SpringBootMockMvcBuilderCustomizer` then copies every enabled filter registration in the
context onto the builder, guarded by one flag whose javadoc is blunt:

> *"If filters from the application context should be registered with MockMVC. Defaults to
> `true`."*

```java
if (this.addFilters) {
    addFilters(builder);
}
```

That is the same `addFilters` mechanism that puts all your *other* filters in the slice
([02b](02b-narrowing-and-what-it-costs.md)). Security is one filter among them, ordered by
`SecurityFilterProperties`. Two consequences worth holding: a filter registered
`setEnabled(false)` is skipped, and `addFilters = false` removes the lot — the blunt
instrument dissected in [08f](08f-method-security-and-the-blunt-instrument.md).

## Boot's default chain, in full

`ServletWebSecurityAutoConfiguration` (Boot 4.1.1), guarded by
`@ConditionalOnDefaultWebSecurity`:

```java
@Bean
@Order(SecurityFilterProperties.BASIC_AUTH_ORDER)
SecurityFilterChain defaultSecurityFilterChain(HttpSecurity http) {
    http.authorizeHttpRequests((requests) -> requests.anyRequest().authenticated());
    http.formLogin(withDefaults());
    http.httpBasic(withDefaults());
    return http.build();
}
```

Its enclosing class's javadoc names both the mechanism [08b](08b-the-401-and-the-302.md) is
about and the back-off rule [08e](08e-the-chain-you-are-not-testing.md) turns on:

> *"The default configuration for web security. It relies on Spring Security's
> content-negotiation strategy to determine what sort of authentication to use. If the
> user specifies their own `SecurityFilterChain` bean, this will back-off completely and
> the users should specify all the bits that they want to configure as part of the custom
> security configuration."*

`anyRequest().authenticated()` is why **every** endpoint in the slice is protected —
including the ones your real configuration marks `permitAll()`. Two entry points are
registered, form login and HTTP Basic, and which of them answers an unauthenticated request
is decided by content negotiation, not by ordering: [08b](08b-the-401-and-the-302.md).

The same auto-configuration also adds `@EnableWebSecurity` if you have not, through a nested
class that is `@ConditionalOnMissingBean(name = BeanIds.SPRING_SECURITY_FILTER_CHAIN)` —
*"This will make sure that the annotation is present with default security auto-configuration
and also if the user adds custom security and forgets to add the annotation."* So the slice
gets a chain even when nothing in it is annotated.

## The user you were given, and why it is no use

`UserDetailsServiceAutoConfiguration` is in the imports list and is heavily conditional:

```java
@ConditionalOnMissingBean(value = { AuthenticationManager.class, AuthenticationProvider.class,
        UserDetailsService.class, AuthenticationManagerResolver.class },
        type = "org.springframework.security.oauth2.jwt.JwtDecoder")
```

None of those beans is normally in a `@WebMvcTest` — they live in the security
configuration the slice filtered out — so the condition passes and you get an
`InMemoryUserDetailsManager` built from `SecurityProperties.User`:

```java
private String name = "user";
private String password = UUID.randomUUID().toString();
private List<String> roles = new ArrayList<>();
```

A username you can guess, a password that is different for every application context, and
**no authorities at all**. You cannot hard-code that password into an `httpBasic(...)` call,
and the user fails every `hasRole` check. Either pin it —

```java
@WebMvcTest(properties = { "spring.security.user.name=alice",
                           "spring.security.user.password=s3cret",
                           "spring.security.user.roles=ADMIN" })
```

— or, far better, stop authenticating through the `AuthenticationManager` at all and use the
test-scoped support in [08g](08g-authenticating-the-test.md).

## Gotchas

**★ Assuming a slice test disables security because it is "just the web layer".**
`@WebMvcTest`'s javadoc says the opposite in its second paragraph, and the reference says it
again: *"Instead of disabling security completely for such tests, you can use Spring
Security's test support."* There has been no `secure = false` attribute since Boot 2.1, so
every article that shows one is at least seven years stale.

**★ Expecting a `permitAll()` endpoint to be reachable.**
The `permitAll()` lives in *your* chain, and your chain is almost certainly not loaded
([08e](08e-the-chain-you-are-not-testing.md)). Boot's is
`anyRequest().authenticated()` with no exceptions whatsoever. This is the most common false
failure in a security-aware slice test, and the fix is an `@Import`, not a `permitAll()`
bolted onto the test.

**★ Reading the 401 as "my `SecurityConfig` denies this".**
A 401 in a bare slice tells you nothing about your own rules. Before you debug an
authorization expression, confirm which `SecurityFilterChain` bean is in the context — if
you did not `@Import` anything, it is Boot's.

**★ Chasing the 401 into the controller.**
It never got there. The `springSecurityFilterChain` filter rejects before
`DispatcherServlet` runs, so no breakpoint in the handler is hit, and no `@ControllerAdvice`
of yours formats the body — that is `ExceptionTranslationFilter` invoking an
`AuthenticationEntryPoint` that writes to the response directly, outside MVC
([01 · One filter, three objects](../../phase-9-spring-boot/11-spring-security/01-one-filter-three-objects.md)).

**★ Hard-coding the generated password into an `httpBasic(...)` call.**
`SecurityProperties.User.password` is `UUID.randomUUID().toString()`, evaluated per
application context. A test that passed once will fail on the next context creation. Set
`spring.security.user.password` explicitly, or do not authenticate that way.

**★ Expecting the auto-configured `user` to satisfy `hasRole('USER')`.**
`SecurityProperties.User.roles` defaults to an **empty** list, not to `USER`. The
auto-configured principal is authenticated with zero authorities, so it clears
`authenticated()` and fails every role check — which produces a 403 where you expected a
200 and sends you looking for a bug in your rules.

**★ A dependency you did not think about enlarging the slice.**
Slice auto-configuration is assembled from `.imports` resources across the whole classpath.
Putting `spring-boot-starter-security` on `test` scope, or pulling in a library that depends
on it, switches security on for every `@WebMvcTest` in the module without a line of your
code changing. The symptom is a whole test class going red after a dependency bump.

**★ Assuming `@WebFluxTest` behaves the same way.**
It does not, and the difference is visible in the repository: `spring-boot-security-test`
ships a `WebMvcTest.includes` resource and no `WebFluxTest.includes`. Boot documents the
consequence explicitly — *"`@WebFluxTest` cannot detect custom security configuration
registered as a `@Bean` of type `SecurityWebFilterChain`"*. Do not carry conclusions from
one slice to the other.

## Interview questions

**★ Does `@WebMvcTest` turn Spring Security off?**
No — it turns it on. `spring-boot-security-test` contributes an
`AutoConfigureMockMvc.imports` file listing `SecurityAutoConfiguration`,
`UserDetailsServiceAutoConfiguration`, `SecurityFilterAutoConfiguration`,
`ServletWebSecurityAutoConfiguration` and `SecurityMockMvcAutoConfiguration`, so a full
enforcing chain is built; `addFilters`, defaulting to `true`, then registers the
`springSecurityFilterChain` filter with the `MockMvc` builder. The javadoc states it
outright: *"By default, tests annotated with `@WebMvcTest` will also auto-configure Spring
Security and `MockMvc`."*

**★ By what route does a servlet filter end up in a `MockMvc` that starts no server?**
`SecurityFilterAutoConfiguration` publishes a `DelegatingFilterProxyRegistrationBean` for the
bean named `springSecurityFilterChain`. `SpringBootMockMvcBuilderCustomizer` walks the
context's `FilterRegistrationBean` and `DelegatingFilterProxyRegistrationBean` beans, keeps
the enabled ones, and calls `builder.addFilter(...)` for each with its name, init parameters
and URL patterns. `MockMvc` then runs that filter chain in-process around
`DispatcherServlet` — no socket involved ([01](01-no-socket-no-server.md)).

**★ Where in the pipeline does the 401 come from, and why can you not catch it?**
From `ExceptionTranslationFilter`, which catches the `AuthenticationException` thrown
downstream and calls the resolved `AuthenticationEntryPoint`, which writes the status
itself. That is inside the servlet filter chain, before `DispatcherServlet` — so no
`@ControllerAdvice`, no `HandlerExceptionResolver` and no `ResponseEntityExceptionHandler`
of yours is consulted. Shaping that body means writing an `AuthenticationEntryPoint` in
production code, not an exception handler.

**★ Why does the default in-memory user not help you in a slice test?**
`UserDetailsServiceAutoConfiguration` builds an `InMemoryUserDetailsManager` from
`SecurityProperties.User`, whose password defaults to `UUID.randomUUID().toString()` and
whose roles default to an empty list. The password differs for every application context, so
you cannot hard-code it into `httpBasic(...)`, and the user has no authorities, so it fails
any `hasRole` check. Set `spring.security.user.*` through `@WebMvcTest(properties = …)` if
you really want it, or use the test-scoped authentication support instead.

**★ Under what condition does that in-memory user *not* appear?**
When the slice contains an `AuthenticationManager`, `AuthenticationProvider`,
`UserDetailsService`, `AuthenticationManagerResolver` or a `JwtDecoder` bean — the
`@ConditionalOnMissingBean` on `UserDetailsServiceAutoConfiguration` lists all five. So the
moment you `@Import` a configuration that declares a `UserDetailsService`, or add a
`@MockitoBean` of that type, Boot's fallback user silently disappears and any test relying
on it changes behaviour.

Next: why the status is 401 and not 302, and what makes it swap —
[08b · The 401 and the 302](08b-the-401-and-the-302.md).

{/* FOOTER */}
