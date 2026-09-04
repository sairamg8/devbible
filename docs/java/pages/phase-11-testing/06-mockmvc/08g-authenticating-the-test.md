---
title: "You do NOT need .apply(springSecurity()) in a Boot slice because SecurityMockMvcAutoConfiguration already applies testSecurityContext() — and @WithMockUser builds Spring Security's own User from twenty lines of factory code, which is why roles and authorities cannot be combined and why @AuthenticationPrincipal of your own type comes back null"
sidebar_label: "08g · @WithMockUser"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Boot 4.1.1**
> [`SecurityMockMvcAutoConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-security-test/src/main/java/org/springframework/boot/security/test/autoconfigure/webmvc/SecurityMockMvcAutoConfiguration.java);
> the **Spring Security 7.1.1** sources —
> [`WithMockUser`](https://github.com/spring-projects/spring-security/blob/7.1.1/test/src/main/java/org/springframework/security/test/context/support/WithMockUser.java),
> `WithMockUserSecurityContextFactory`,
> [`WithUserDetails`](https://github.com/spring-projects/spring-security/blob/7.1.1/test/src/main/java/org/springframework/security/test/context/support/WithUserDetails.java),
> [`SecurityMockMvcRequestPostProcessors`](https://github.com/spring-projects/spring-security/blob/7.1.1/test/src/main/java/org/springframework/security/test/web/servlet/request/SecurityMockMvcRequestPostProcessors.java);
> and the Security reference
> [Testing Method Security](https://docs.spring.io/spring-security/reference/servlet/test/method.html),
> [Setting Up MockMvc and Spring Security](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/setup.html)
> and [Running a Test as a User in Spring MVC Test](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/authentication.html)
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/test/method.html)),
> read as asciidoc at tag `7.1.1`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Spring Security 7.1.1, AssertJ 3.27.7.
> **No sandbox** — this page carries Java and library source, never a fabricated test run.

**Everything so far has been about why the slice says no. This is how to make it say yes.
There are two families — annotations that populate the `SecurityContextHolder` for the test
thread ([08h](08h-the-other-three-annotations.md) covers the rest of them) and
`RequestPostProcessor`s that attach a principal to the request
([08i](08i-post-processors-and-asserting-identity.md)) — plus one piece of setup that Spring
Security's own documentation tells you to write and Boot has already written for you. This
chunk is that setup and `@WithMockUser`, whose twenty-line factory explains four separate
surprises.**

## 🔴 You do not need `.apply(springSecurity())`

Spring Security's reference shows this, and people copy it into Boot tests:

> *"To use Spring Security with Spring MVC Test, add the Spring Security `FilterChainProxy`
> as a `Filter`. You also need to add Spring Security's
> `TestSecurityContextHolderPostProcessor` to support Running as a User in Spring MVC Test
> with Annotations. To do so, use Spring Security's
> `SecurityMockMvcConfigurers.springSecurity()`."*

```java
mvc = MockMvcBuilders.webAppContextSetup(context)
        .apply(springSecurity())          // for plain spring-test, NOT for a Boot slice
        .build();
```

That page is written for a hand-built `MockMvc` with `@ContextConfiguration` and
`@WebAppConfiguration` — no Boot. In a Boot slice both halves are already done. The filter
arrives through `addFilters` ([08](08-security-in-a-slice.md)); the context integration
arrives through `SecurityMockMvcAutoConfiguration`:

```java
@Bean
@ConditionalOnBean(name = DEFAULT_SECURITY_FILTER_NAME)   // "springSecurityFilterChain"
SecurityMockMvcBuilderCustomizer securityMockMvcBuilderCustomizer() {
    return new SecurityMockMvcBuilderCustomizer();
}

static class SecurityMockMvcBuilderCustomizer implements MockMvcBuilderCustomizer {

    @Override
    public void customize(ConfigurableMockMvcBuilder<?> builder) {
        builder.apply(new MockMvcConfigurerAdapter() {

            @Override
            public RequestPostProcessor beforeMockMvcCreated(ConfigurableMockMvcBuilder<?> builder,
                    WebApplicationContext context) {
                return SecurityMockMvcRequestPostProcessors.testSecurityContext();
            }

        });
    }
}
```

`testSecurityContext()` is exactly what makes `@WithMockUser` reach the request. Writing
`.apply(springSecurity())` yourself in a slice means abandoning the auto-configured
`MockMvc`/`MockMvcTester` bean and hand-building one — more code, one more thing to keep in
sync, and no behaviour gained.

## `@WithMockUser` — what it actually builds

The annotation's defaults are on the annotation:

```java
String value() default "user";
String username() default "";
String[] roles() default { "USER" };
String[] authorities() default {};
String password() default "password";
TestExecutionEvent setupBefore() default TestExecutionEvent.TEST_METHOD;
```

and the factory is short enough to read whole:

```java
String username = StringUtils.hasLength(withUser.username()) ? withUser.username() : withUser.value();
List<GrantedAuthority> grantedAuthorities = new ArrayList<>();
for (String authority : withUser.authorities()) {
    grantedAuthorities.add(new SimpleGrantedAuthority(authority));
}
if (grantedAuthorities.isEmpty()) {
    for (String role : withUser.roles()) {
        Assert.isTrue(!role.startsWith("ROLE_"), () -> "roles cannot start with ROLE_ Got " + role);
        grantedAuthorities.add(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
else if (!(withUser.roles().length == 1 && "USER".equals(withUser.roles()[0]))) {
    throw new IllegalStateException("You cannot define roles attribute " + Arrays.asList(withUser.roles())
            + " with authorities attribute " + Arrays.asList(withUser.authorities()));
}
User principal = new User(username, withUser.password(), true, true, true, true, grantedAuthorities);
Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(principal,
        principal.getPassword(), principal.getAuthorities());
```

Four things fall out of those twenty lines, and each of them is a bug report someone has
filed:

1. **The user does not have to exist.** No `UserDetailsService` is consulted. The docs say
   so: *"The user with a username of `user` does not have to exist, since we mock the user
   object."*
2. **`roles` are prefixed, `authorities` are not.** *"If we do not want the value to
   automatically be prefixed with `ROLE_` we can use the `authorities` attribute."* So
   `roles = "ADMIN"` gives `ROLE_ADMIN`, and `authorities = "ADMIN"` gives `ADMIN`.
3. **`roles = "ROLE_ADMIN"` throws.** `Assert.isTrue(!role.startsWith("ROLE_"))` — you get
   `roles cannot start with ROLE_ Got ROLE_ADMIN`, not a silent `ROLE_ROLE_ADMIN`.
4. **`roles` and `authorities` together throw** unless `roles` is left at its exact default
   `{"USER"}` — `IllegalStateException`. There is no merge.

The principal is Spring Security's own `User` and the token is a
`UsernamePasswordAuthenticationToken`. If your controller does
`@AuthenticationPrincipal CustomUser me`, that resolves to `null` and the test fails
somewhere far from the cause — which is what `@WithUserDetails` and `@WithSecurityContext`
exist to fix.

## Placement: method, class, `@Nested`, and `setupBefore`

Method-level and class-level both work, class-level applying to every test:

```java
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)
@WithMockUser(username = "admin", roles = { "USER", "ADMIN" })
class OrderAdminTests {

    @Test @WithAnonymousUser
    void anonymous_is_rejected() { … }        // method-level overrides the class
}
```

> *"If you use JUnit 5's `@Nested` test support, you can also place the annotation on the
> enclosing class to apply to all nested classes."*

and timing is adjustable:

> *"By default, the `SecurityContext` is set during the
> `TestExecutionListener.beforeTestMethod` event. This is the equivalent of happening before
> JUnit's `@Before`. You can change this to happen during the
> `TestExecutionListener.beforeTestExecution` event, which is after JUnit's `@Before` but
> before the test method is invoked."*

```java
@WithMockUser(setupBefore = TestExecutionEvent.TEST_EXECUTION)
```

That matters when a `@BeforeEach` seeds data *as* a user, or clears the context: with the
default the context is already populated when `@BeforeEach` runs; with `TEST_EXECUTION` it
is not.

The listener that does the work is named in the docs, and is worth knowing because its
absence is the usual cause of "the annotation does nothing":

> *"Spring Security hooks into Spring Test support through the
> `WithSecurityContextTestExecutionListener`, which ensures that our tests are run with the
> correct user. It does this by populating the `SecurityContextHolder` prior to running our
> tests. … After the test is done, it clears out the `SecurityContextHolder`."*

That covers the common case. The three annotations for everything `@WithMockUser` cannot
express are [08h](08h-the-other-three-annotations.md); the request-scoped alternative and
the assertions are [08i](08i-post-processors-and-asserting-identity.md).

## Gotchas

**★ Copying `.apply(springSecurity())` into a Boot slice.**
`SecurityMockMvcAutoConfiguration` already registers a `MockMvcBuilderCustomizer` applying
`testSecurityContext()`. Doing it yourself means hand-building a `MockMvc` and abandoning the
auto-configured `MockMvc`/`MockMvcTester` bean, for no behaviour gain. The docs page that
shows it is written for plain `spring-test` with `@ContextConfiguration` and
`@WebAppConfiguration`, not for a Boot slice.

**★ `@WithMockUser(roles = "ROLE_ADMIN")`.**
`Assert.isTrue(!role.startsWith("ROLE_"))` fails the test with *"roles cannot start with
ROLE_"*. Use `roles = "ADMIN"`, or `authorities = "ROLE_ADMIN"` if you genuinely want the raw
authority string. It is a hard failure rather than a silent `ROLE_ROLE_ADMIN`, which is the
kinder design.

**★ Setting `roles` and `authorities` on the same `@WithMockUser`.**
Unless `roles` is left at exactly its default `{"USER"}`, the factory throws
`IllegalStateException` naming both lists. They are alternatives, not a union — the surprise
lands when someone *adds* `authorities` to an annotation that already had `roles` and the
test fails for a reason unrelated to security.

**★ Expecting `authorities = "ADMIN"` to satisfy `hasRole('ADMIN')`.**
`hasRole` prepends `ROLE_`; the `authorities` attribute does not. `authorities = "ADMIN"`
satisfies `hasAuthority('ADMIN')` and fails `hasRole('ADMIN')`. This is the single most
common authority bug in Spring Security tests
([10 · Claims to authorities](../../phase-9-spring-boot/11-spring-security/10-claims-to-authorities.md)).

**★ `@AuthenticationPrincipal CustomUser` resolving to `null` under `@WithMockUser`.**
The factory always builds Spring Security's own `User`, so an argument resolver looking for
your type gets nothing and the handler fails on a `NullPointerException` far from the cause.
`@WithMockUser` cannot express a custom principal — that is what
[08h](08h-the-other-three-annotations.md) is for.

**★ `@WithMockUser` without `@Import`ing your chain.**
The annotation authenticates the request, and the rules being applied are still Boot's
`anyRequest().authenticated()` ([08e](08e-the-chain-you-are-not-testing.md)). Any user at all
satisfies that, so a `@WithMockUser(roles = "USER")` test passes against an endpoint your
production chain restricts to admins.

**★ A class-level `@WithMockUser` silently authenticating your "anonymous" test.**
The annotation applies to every method, including the one whose whole point is to be
unauthenticated. Override with `@WithAnonymousUser` on the method, or keep protection tests
in their own class.

**★ A `@BeforeEach` that reads the `SecurityContextHolder` and finds it already populated.**
Default `setupBefore` is `TEST_METHOD`, which fires *before* `@BeforeEach`. Setup code that
seeds data as the current user works; setup code that expects an empty context does not.
`setupBefore = TestExecutionEvent.TEST_EXECUTION` moves it after `@BeforeEach`.

**★ The annotation appearing to do nothing at all.**
`WithSecurityContextTestExecutionListener` is what populates the holder, and it arrives with
the Spring TestContext framework's default listeners. A test class that declares
`@TestExecutionListeners` without `mergeMode = MERGE_WITH_DEFAULTS` replaces the defaults and
silently drops it. The docs offer `@SecurityTestExecutionListeners` when you need only the
security ones.

**★ Assuming the context leaks into the next test.**
It does not: *"After the test is done, it clears out the `SecurityContextHolder`."* Which
also means any assertion you make *after* the test method — in an `@AfterEach`, say — sees an
empty context, and `SecurityMockMvcResultHandlers.exportTestSecurityContext()` exists
precisely to move it where you can still read it.

**★ Using `@WithMockUser` on a test whose subject is the login flow.**
It fabricates an already-authenticated context, so a test of "wrong password is rejected"
starts from the wrong state. Authentication flows need real credentials —
`formLogin()`/`httpBasic(...)` in [08i](08i-post-processors-and-asserting-identity.md).

## Interview questions

**★ Do you need `.apply(springSecurity())` in a `@WebMvcTest`?**
No. `SecurityMockMvcAutoConfiguration` contributes a `MockMvcBuilderCustomizer`, conditional
on a bean named `springSecurityFilterChain`, that applies
`SecurityMockMvcRequestPostProcessors.testSecurityContext()` to the builder — which is the
half of `springSecurity()` that lets `@WithMockUser` reach the request; the `FilterChainProxy`
itself arrives through `addFilters`. The documentation page showing `.apply(springSecurity())`
is written for a hand-built `MockMvc` without Boot, and copying it into a slice means giving
up the auto-configured bean.

**★ What does `@WithMockUser` actually put in the context?**
A `UsernamePasswordAuthenticationToken` whose principal is Spring Security's own `User`,
built directly from the annotation's attributes without consulting any `UserDetailsService` —
the user need not exist anywhere. `roles` entries are prefixed with `ROLE_` (and rejected if
you prefix them yourself); `authorities` entries are used verbatim; supplying both throws
`IllegalStateException` unless `roles` is left at its default.

**★ Why can `roles` and `authorities` not be combined?**
Because the factory treats them as alternatives: it fills the authority list from
`authorities()` first, and only falls back to prefixing `roles()` if that list came out
empty. If `authorities` is non-empty *and* `roles` differs from its default, the two
instructions conflict and there is no defined merge, so it throws rather than guessing which
one you meant.

**★ When is `@WithMockUser` not good enough?**
When the application depends on the principal's *type* — `@AuthenticationPrincipal CustomUser`,
or code that casts `authentication.getPrincipal()`. `@WithMockUser` always builds `User`. It
is also wrong for testing the authentication step itself, since it starts from an
already-authenticated context.

**★ What is the difference between `setupBefore = TEST_METHOD` and `TEST_EXECUTION`?**
`TEST_METHOD`, the default, populates the `SecurityContextHolder` in
`TestExecutionListener.beforeTestMethod` — before JUnit's `@BeforeEach`. `TEST_EXECUTION`
moves it to `beforeTestExecution`, after `@BeforeEach` but before the test body. It matters
whenever setup code either needs the user (keep the default) or needs the context empty
(switch it).

**★ What makes the annotation work at all, and how can it stop working?**
`WithSecurityContextTestExecutionListener`, one of the TestContext framework's default
listeners, populates the holder before the test and clears it after. Declaring
`@TestExecutionListeners` on a class without `mergeMode = MERGE_WITH_DEFAULTS` replaces the
default set and drops it — at which point every `@WithMockUser` in that class becomes a
no-op and every test fails as unauthenticated.

{/* FOOTER */}
