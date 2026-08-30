---
title: "@PreAuthorize is enforced in production and completely inert in a bare @WebMvcTest — because Boot ships no method-security auto-configuration and the class carrying @EnableMethodSecurity is excluded by the same scan filter — and addFilters = false, the thing people reach for next, deletes every filter rather than the security one"
sidebar_label: "08f · Method security and the blunt instrument"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Boot 4.1.1** repository tree at tag `v4.1.1` —
> the absence of any method-security auto-configuration (the only files matching
> `MethodSecurity` are under `smoke-test/spring-boot-smoke-test-web-method-security`),
> [`AutoConfigureMockMvc`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/AutoConfigureMockMvc.java),
> [`SpringBootMockMvcBuilderCustomizer`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/SpringBootMockMvcBuilderCustomizer.java)
> and `AnnotationCustomizableTypeExcludeFilter`; plus the **Spring Security 7.1.1**
> `@EnableMethodSecurity` javadoc.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Spring Security 7.1.1, AssertJ 3.27.7.
> ⚠️ The claim that Boot auto-configures no method security is **verified by absence** —
> a search of the 4.1.1 tree finds no such auto-configuration class and no `.imports` entry
> for one. No documentation sentence states it either way; if you need certainty for a
> specific version, grep that version's `AutoConfiguration.imports`.
> **No sandbox** — this page carries Java and library source, never a fabricated test run.

**[08e](08e-the-chain-you-are-not-testing.md) showed that the component-scan filter excludes
your `@Configuration class SecurityConfig`. That exclusion has a second victim nobody
notices, and it is worse than the first: `@PreAuthorize` on a handler method is enforced in
production and does *nothing at all* in a bare slice, so the only method-security test that
can exist is one that passes. And when the resulting confusion sends people looking for a
switch, the one they find — `addFilters = false` — removes every filter in the application
rather than the security one.**

## Method security is not auto-configured, by anyone

Two facts combine.

**One:** `@PreAuthorize`, `@PostAuthorize`, `@Secured` and `@RolesAllowed` do nothing unless
a `@Configuration` class in the context is annotated `@EnableMethodSecurity`. The annotation
is what registers the advisors that create the proxies; without it the annotations are inert
metadata.

**Two:** Spring Boot 4.1 auto-configures none of it. A search of the `v4.1.1` tree for
`MethodSecurity` returns exactly two files, both under
`smoke-test/spring-boot-smoke-test-web-method-security` — a sample application and its test.
There is no `MethodSecurityAutoConfiguration`, so nothing puts `@EnableMethodSecurity` into
your context but you.

Therefore `@EnableMethodSecurity` lives on a class of yours — almost always the same
`SecurityConfig` that declares the chain — and that class is excluded from a `@WebMvcTest`
scan by `isTypeOrAnnotated` for exactly the reason in [08e](08e-the-chain-you-are-not-testing.md):
it is a `@Configuration` class, not a `SecurityFilterChain`.

Net effect on a handler like this:

```java
@GetMapping("/orders/{id}/audit")
@PreAuthorize("hasRole('ADMIN')")
AuditView audit(@PathVariable String id) { … }
```

In production the method is proxied and a non-admin is rejected. In a bare
`@WebMvcTest` there is no advisor, no proxy, and the annotation is decoration. Boot's own
`SecurityTestApplication` for the slice is the same shape — its controller carries
`@Secured("ROLE_USER")` and nothing in the test application enables method security, so the
401 that its test asserts comes from `anyRequest().authenticated()` in the URL rules, not
from the annotation.

## Why that produces a test that cannot fail

The test people write is the positive one:

```java
@Test
@WithMockUser(roles = "ADMIN")
void an_admin_can_read_the_audit_trail() {
    assertThat(mvc.get().uri("/orders/42/audit")).hasStatusOk();
}
```

Green — with method security enforced, and equally green with it absent. The test that would
have caught the gap is the negative one, and it is the one that is usually missing:

```java
@Test
@WithMockUser(roles = "USER")
void a_plain_user_cannot_read_the_audit_trail() {
    assertThat(mvc.get().uri("/orders/42/audit")).hasStatus(HttpStatus.FORBIDDEN);
}
```

In a bare slice that second test **fails**, and the failure is honest: the slice really does
let a non-admin through. The usual response — deleting the test, or adding
`@EnableMethodSecurity` to the test class — is where the damage happens.

## The two fixes, and why one of them is a lie

**Import the real configuration.** The annotation stays where production has it, so deleting
it from production breaks the test:

```java
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)          // carries @EnableWebSecurity AND @EnableMethodSecurity
class OrderAuditTests { … }
```

**Or test method security where it lives.** Method security is not a web concern; it is an
AOP concern on a bean. A test that autowires the secured bean and calls it under
`@WithMockUser` exercises the advisor directly, without `MockMvc`, without a slice, and
without any of this page's traps — see
[07 · Method security](../../phase-9-spring-boot/11-spring-security/07-method-security.md)
and [08 · Method vs URL security](../../phase-9-spring-boot/11-spring-security/08-method-vs-url-security.md).

**What not to do** is put `@EnableMethodSecurity` on the *test*. It makes the test green and
severs the link to production: the test now enables a feature the application might have
stopped enabling, and no test anywhere will notice.

## `addFilters = false` is a hammer, not a fix

When the 401s and 403s get tiring, this is what people find:

```java
@WebMvcTest(OrderController.class)
@AutoConfigureMockMvc(addFilters = false)   // ⚠️ removes EVERY filter
class OrderControllerTests { … }
```

The javadoc is honest about what the flag means — *"If filters from the application context
should be registered with MockMVC. Defaults to `true`."* — and the implementation is one
branch:

```java
if (this.addFilters) {
    addFilters(builder);
}
```

`addFilters(builder)` walks the context's `FilterRegistrationBean` and
`DelegatingFilterProxyRegistrationBean` beans, keeps the enabled ones and adds each to the
builder. Skipping it does not disable *security*; it disables the whole `Filter` layer. Your
correlation-ID filter, your request-logging wrapper, your tenant resolver, your
`CharacterEncodingFilter` all vanish
([02 · Filters](../../phase-9-spring-boot/10-the-request-pipeline/02-filters.md)), and the
pipeline you are now testing exists on no machine anywhere.

It is legitimate for one narrow purpose: a test whose subject is genuinely below the filter
layer — handler mapping, argument resolution, body binding, view name selection — where the
filters are noise and their absence changes nothing about the assertion. It is the wrong
answer to "my test returns 401", because the right answer is one annotation on the test
method ([08g](08g-authenticating-the-test.md)).

## Gotchas

**★ `@PreAuthorize` on the controller silently doing nothing.**
`@EnableMethodSecurity` lives on a `@Configuration` class the slice excludes, and Boot
auto-configures no method security. The annotation is enforced in production and inert in
the test, so a method-security test in a bare slice can only ever pass.

**★ Only writing the positive method-security test.**
"An admin can reach it" is green whether or not the rule is enforced. The negative test —
"a non-admin cannot" — is the one that carries information, and in a bare slice it fails,
which is exactly the signal you want.

**★ Making the negative test pass by adding `@EnableMethodSecurity` to the test class.**
The test goes green and stops tracking production. If someone removes the annotation from
the real configuration, the application loses method security and every test still passes.
Import the production configuration instead.

**★ Testing method security through `MockMvc` at all.**
It is an AOP concern on a bean, not a web concern. Testing it through the whole web stack
means a slice, a chain, an entry point and a CSRF token stand between you and the assertion.
Autowire the secured bean, annotate the test `@WithMockUser`, call the method.

**★ Assuming `@Secured` and `@PreAuthorize` are enabled by the same switch.**
`@EnableMethodSecurity` enables `@PreAuthorize`/`@PostAuthorize` by default; `@Secured` and
JSR-250's `@RolesAllowed` are behind separate attributes on that annotation. A configuration
that enables one style does not necessarily enable the other, so an inert annotation can also
mean "enabled, but not this dialect".

**★ Reaching for `addFilters = false` as the standard fix for a security failure.**
It removes every filter, not the security one. The slice then tests a request path that never
existed, and any bug living in a filter — encoding, correlation, wrapping — becomes invisible
for the whole class.

**★ Using `addFilters = false` and then writing a test about a filter.**
The combination appears in real codebases: a class-level `addFilters = false` added months
ago to silence security, and a later test asserting a correlation header that the filter
would have set. The assertion fails for a reason that is nowhere near the test.

**★ Expecting `addFilters = false` to change the context.**
It does not — the security beans are still created, `springSecurityFilterChain` still exists,
the auto-configurations still run. Only the `MockMvc` builder changes. So it does not speed
the context up, does not free the cache entry, and does not stop a broken chain from failing
context startup.

**★ Disabling filters instead of narrowing the test.**
If filters really are irrelevant to the assertion, that is usually a sign the test belongs
one level down — a plain unit test of the handler method, or a `standaloneSetup` `MockMvc`
with just the controller ([02b](02b-narrowing-and-what-it-costs.md)). Reaching for
`addFilters = false` inside a full slice keeps the slice's cost and drops its fidelity.

## Interview questions

**★ Is `@PreAuthorize` enforced in a `@WebMvcTest`?**
Not by default. It requires `@EnableMethodSecurity`, Spring Boot 4.1 ships no
auto-configuration for it — the only `MethodSecurity` files in the repository are smoke tests
— and the `@Configuration` class you put it on is excluded from the slice by the same
component-scan filter that drops `SecurityConfig`. So the annotation is live in production and
inert in the slice.

**★ Why is that more dangerous than the chain not being loaded?**
Because the chain's absence still produces *a* chain — Boot's — and therefore still rejects
anonymous requests. Method security's absence produces nothing: the rule simply is not
applied, and the only test most people write for it is the positive one, which passes either
way. A missing rule that no test can detect is strictly worse than a substituted rule.

**★ Where should method security be tested?**
On the bean, not through the web layer. `@PreAuthorize` is enforced by an AOP advisor around
the target method; a test that autowires the secured bean, runs under `@WithMockUser` and
calls the method directly asserts exactly that, with no `MockMvc`, no filter chain and no
CSRF token in the way. Test URL rules through `MockMvc`; test method rules on the method.

**★ What exactly does `@AutoConfigureMockMvc(addFilters = false)` remove?**
Every filter registration in the context, not the security one.
`SpringBootMockMvcBuilderCustomizer` skips its `addFilters(builder)` call entirely, so no
`FilterRegistrationBean` or `DelegatingFilterProxyRegistrationBean` is added to the `MockMvc`
builder — encoding, correlation, logging, tenant resolution and security alike. The beans
still exist in the context; only the `MockMvc` pipeline changes.

**★ When is it the right call?**
When the subject of the test is genuinely below the filter layer — handler mapping, argument
resolution, body binding, view name — and the filters' absence cannot change the assertion.
It is the wrong call for "make the 401 go away", and if filters are irrelevant to the test,
that is usually an argument for a smaller test rather than a de-filtered slice.

Next, and finally: how to make the request *be* somebody —
[08g · Authenticating the test](08g-authenticating-the-test.md).

{/* FOOTER */}
