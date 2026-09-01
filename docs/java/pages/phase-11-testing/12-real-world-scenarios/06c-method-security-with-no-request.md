---
title: "When the rule lives on a service method rather than on the filter chain the test has no HTTP in it at all, and three separate mechanisms — a context without method security, a self-invocation, an unproxyable method — will each make the annotation do nothing while every positive test stays green"
sidebar_label: "06c · Method security, no request"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against **Spring Security 7.1.0** (managed by
> `spring-boot-dependencies:4.1.0`) — the 7.1.0 source of `AuthorizationDeniedException`
> ([github.com/spring-projects/spring-security](https://github.com/spring-projects/spring-security/blob/7.1.0/core/src/main/java/org/springframework/security/authorization/AuthorizationDeniedException.java)),
> whose javadoc reads *"An `AccessDeniedException` that contains the `AuthorizationResult`"*
> and whose `@since` is **6.3** — and the **Spring Framework 7.0.8** reference for
> proxy-mode interception semantics
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/aop.html)),
> which states that *"only external method calls coming in through the proxy are
> intercepted"*.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, Spring Security 7.1.0, JUnit Jupiter 6.0.3, Mockito 5.23.0.
> ⚠️ **No sandbox and no test runs on this machine** — this page carries Java source and
> documented behaviour, never console output.

**A `@PreAuthorize` on a service method is not tested by any of the web-layer tests in
[06b](06b-the-401-and-the-tests-nobody-writes.md) — in a controller slice the service is a
mock, so its annotations never run. It needs its own test, with no request in it, and three
distinct mechanisms will silently disable the annotation while leaving that test's positive
case green.**

## Method security, where there is no request at all

If the rule lives on the service — `@PreAuthorize("hasRole('ADMIN')")` — then the natural
test has no HTTP in it, and the `@With…` annotations are the only mechanism that works,
because there is no request for a post-processor to decorate.

```java
@SpringBootTest
class OrderServiceAuthorizationTest {

    @Autowired OrderService orders;

    @Test
    @WithMockUser(roles = "USER")
    void anOrdinaryUserCannotCancel() {
        assertThatThrownBy(() -> orders.cancel(new OrderId(42)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @WithAnonymousUser
    void anAnonymousCallerCannotCancel() {
        assertThatThrownBy(() -> orders.cancel(new OrderId(42)))
                .isInstanceOf(AccessDeniedException.class);
    }
}
```

Two things make or break this test.

**The context must have method security enabled.** `@EnableMethodSecurity` is not on by
default in Boot, and a slice that does not load your security `@Configuration` will not have
it — so the annotated method runs unguarded and `assertThatThrownBy` fails with "expected an
exception but none was thrown". That failure message is the good outcome; the bad outcome is
a test that asserts the *positive* case only, which passes with method security switched
off.

**Assert on `AccessDeniedException`, not on the concrete subtype.** Since Security 6.3 the
exception thrown is `AuthorizationDeniedException`, which the source confirms *"extends
`AccessDeniedException`"* and carries the `AuthorizationResult`. Asserting the supertype
keeps working across versions and across the pre- and post-authorize paths.

## Where this connects

- The filter-chain half of the same argument — the triad, CSRF, and asserting the invariant
  rather than the challenge — is
  [06b · The 401 nobody writes](06b-the-401-and-the-tests-nobody-writes.md).
- The five mechanisms for authenticating a test are
  [06 · Security in a test](06-security-in-a-test.md); only the `@With…` annotations work
  here, because there is no request.
- **Topic 06 · MockMvc** owns method security as it appears *in a slice*, which is a
  different and blunter thing.
- **Topic 05 · The test pyramid** owns which context you get and therefore whether
  `@EnableMethodSecurity` is present at all.
- The identical proxy-and-self-invocation trap for caching is
  [09 · Caching and idempotency](09-caching-and-idempotency.md), and for `@Async` it is
  [07 · Async, scheduled and eventual](07-async-scheduled-and-eventual.md). It is one rule
  with four names.

## Gotchas

**★ Method security is proxy-based, so a `@PreAuthorize` method called from inside the same
class is not checked, and no test through the public entry point will show you.**
The rule is the same one that governs `@Transactional`, `@Cacheable` and `@Async`: only
external calls through the proxy are intercepted. `OrderService.cancelAll()` calling
`this.cancel(id)` bypasses the check on `cancel`. A test that calls `cancel` directly passes
and proves the annotation works; a test that calls `cancelAll` passes and proves nothing,
because the check was never consulted. The only reliable detection is reading the call
graph, or a test that calls the *outer* method as an unauthorized user and expects a
refusal.

**★ `@PreAuthorize` on a method the proxy cannot override is silently ignored.**
With CGLIB proxying, a `private`, `static` or `final` method — or a `final` class — cannot be
intercepted. Spring will not fail startup for this; the annotation simply does nothing. The
test that catches it is the negative one; the test that does not is the positive one, again.
Kotlin's default-final classes make this a routine trap in mixed codebases.

**★ `@WebMvcTest` may not load `@EnableMethodSecurity`, so a service-layer rule is absent
from the slice.**
`SecurityFilterChain` is on the slice's scan list; an arbitrary `@Configuration` carrying
`@EnableMethodSecurity` is not. So a slice test of an endpoint whose protection lives on the
service sees no protection at all — and since the service is a `@MockitoBean` in that slice
anyway, its annotations were never going to run. Method-security rules need a context that
loads them, which in practice means `@SpringBootTest` or an explicit `@Import`.

**★ A `@MockitoBean` is never wrapped in a Spring AOP proxy, so mocking the service also
removes its method security.**
The `@MockitoBean` javadoc states the mock *"is never wrapped in a Spring AOP proxy"*. That
is usually what you want — but it means any test that overrides a `@PreAuthorize`-annotated
bean has, as a side effect, deleted every rule on it. If a test's purpose includes "the
service refuses unauthorized callers", the service cannot be the mock.

**★ `@PostAuthorize` and `@PostFilter` run *after* the method body, so the work already
happened.**
`@PostAuthorize("returnObject.owner == authentication.name")` is a fine way to stop a caller
*seeing* data, and no way at all to stop the method *doing* something. If the method writes,
sends or charges before returning, a `@PostAuthorize` denial arrives too late — the
exception rolls back a transaction if there is one and rolls back nothing if there is not.
The test that reveals this asserts on the side effect, not on the exception: expect the
`AccessDeniedException` *and* assert the row was not written.

**★ `@PostFilter` removing elements is invisible to an `isNotEmpty()` assertion.**
A filtered collection that silently drops the two rows the caller was not allowed to see
still passes `assertThat(result).isNotEmpty()`, and passes `hasSizeGreaterThan(0)`, and
passes every assertion short of an exact size or content check. Assert the exact expected
elements for each identity you test, or the filter can degrade to "removes everything" or
"removes nothing" without a single test going red.

**★ Testing that a user cannot see *another tenant's* data needs data, not just a role.**
`hasRole("USER")` is not the rule; "the order belongs to you" is. Those tests cannot be
written with `@WithMockUser` alone, because the principal has no tenant, and they cannot be
written in a slice with a mocked service, because the mocked service is where the ownership
check lives. They belong in a context-loading test with two real users and two real orders —
which is more expensive and is the reason they are usually missing, and also the reason
horizontal-privilege bugs are common.

**★ SpEL in `@PreAuthorize` is a string, so a typo is a runtime failure at best and a
permanent allow at worst.**
`@PreAuthorize("hasRole('ADMIN')")` and `@PreAuthorize("hasRole('ADMNI')")` both compile.
The second denies everybody, which at least fails loudly the first time an admin tries. The
dangerous typos are the ones in a custom bean reference — `@PreAuthorize("@orderOwner.check(#id)")`
where the bean name is wrong throws at evaluation time, and where the *method* silently
returns a truthy default does not. Expression strings are code with no compiler; each one
needs a test that expects a denial, or nothing checks it at all.

**★ An `AccessDeniedException` thrown inside a `@Transactional` method rolls the
transaction back, which can mask the very side effect you were testing for.**
When you are asserting "the denial happened *and* nothing was written", check whether the
absence of the write is due to the authorization check or due to the rollback. They look
identical from outside. Test the side effect with the method called in a non-transactional
path, or assert on a mocked collaborator's interactions rather than on the database, so you
observe the call that was or was not made rather than its committed effect.

## Interview questions

**★ How do you test a `@PreAuthorize` on a service method, and what will silently stop it
working?**
With `@WithMockUser` (or `@WithAnonymousUser`) on a test whose context has
`@EnableMethodSecurity`, asserting `assertThatThrownBy(...).isInstanceOf(AccessDeniedException.class)` —
the supertype, because since Security 6.3 the concrete throwable is
`AuthorizationDeniedException`. Three things silently stop it working. The context may not
load the configuration that enables method security, in which case the method runs
unguarded. The method may be reached by self-invocation from another method of the same
class, in which case the proxy is bypassed. And the method may be `private`, `static` or
`final` under CGLIB, in which case it cannot be intercepted at all. All three fail *open*,
and all three are invisible to a positive test.

**★ You need to prove a user cannot read another tenant's order. What shape does that test
take, and why is it usually missing?**
It needs real data on both sides: two users, two orders, and a context in which the
ownership check actually executes — so a `@SpringBootTest` with a real repository, or at
minimum a service test with a real ownership predicate. It is usually missing for exactly
that reason: the controller slice mocks the service, so the check is stubbed away, and the
service unit test mocks the repository, so the ownership data is whatever the stub returned.
Horizontal privilege escalation lives in the gap between those two mocks, which is why it is
one of the most common findings in a security review of an otherwise well-tested codebase.
The fix is one deliberately expensive test per resource type, not a general policy of
integration testing.

**★ When does an authorization rule belong on the filter chain and when on the method?**
On the chain when the rule is a property of the *route* — "everything under `/admin` needs
`ROLE_ADMIN`", "`/actuator/health` is public". On the method when the rule is a property of
the *domain object* — "you may cancel an order you placed", "a manager may approve up to
their limit". The testing consequence follows directly: chain rules are testable in a
controller slice with no data, because they are decided before the handler runs; method
rules are not testable there at all, because the service is mocked and its annotations never
execute. A team that puts domain rules on the chain ends up encoding ownership in URL
patterns, and a team that puts route rules on methods ends up with `@PreAuthorize` on
ninety controllers. Both are testable; only one of each is cheap.

**★ Why is `@PostAuthorize` a weaker guarantee than `@PreAuthorize`, and how does that show
up in a test?**
Because it runs after the method body, so it can prevent a *result* being returned but not
work being done. If the method charged a card, sent an email or wrote a row before
returning, the denial is a message to the caller and nothing else — and if the method is not
transactional, the effect is permanent. In a test this shows up as an assertion that passes
for the wrong reason: `assertThatThrownBy(...)` is satisfied, everyone concludes the rule
works, and nobody asserts that the row is absent. The complete test for a `@PostAuthorize`
method always has two assertions: the exception, and the absence of the side effect. If the
second one fails, the rule is on the wrong annotation.

{/* FOOTER */}
