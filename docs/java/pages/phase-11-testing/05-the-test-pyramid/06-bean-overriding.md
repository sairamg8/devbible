---
title: "@MockBean and @SpyBean no longer exist, their replacements live in Spring Framework rather than Boot, and the whole mechanism is now a general one with three strategies — which means every Spring testing article you have ever read is wrong about this exact page"
sidebar_label: "06 · Bean overriding"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Bean Overriding in Tests*
> ([bean-overriding](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/bean-overriding.html))
> and *Testing → Annotations → `@MockitoBean` and `@MockitoSpyBean`*
> ([annotation-mockitobean](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html));
> attribute defaults read from the Framework 7.0.x javadoc for `MockitoBean`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Spring Framework 7.0.8**, Mockito 5.23.0, JUnit Jupiter 6.0.3.
> **No sandbox** — Java source only.

**🔴 `@MockBean` and `@SpyBean` are gone. Not deprecated — removed. Their replacements are
`@MockitoBean` and `@MockitoSpyBean`, and they are no longer Boot annotations at all: bean
overriding was generalised and moved into Spring Framework, where it is now one mechanism with
three strategies and Mockito is merely its best-known consumer. This is the single highest-density
patch of stale information in the Spring testing ecosystem, and no amount of "it worked last
year" survives contact with it.**

## Where everything lives now

| Annotation | Package |
|---|---|
| `@MockitoBean` | `org.springframework.test.context.bean.override.mockito` |
| `@MockitoSpyBean` | `org.springframework.test.context.bean.override.mockito` |
| `@TestBean` | `org.springframework.test.context.bean.override.convention` |
| `MockReset` | `org.springframework.test.context.bean.override.mockito` |

Note `org.springframework.test`, not `org.springframework.boot.test`. The mechanism is a
Framework feature; Boot contributes nothing to it any more. That also means it works in a plain
Spring TestContext test with no Boot at all.

## The three strategies — the concept under all of it

Bean overriding is one mechanism with three documented strategies, quoted:

| Strategy | Definition |
|---|---|
| `REPLACE` | *"Replaces the bean. Throws an exception if a corresponding bean does not exist."* |
| `REPLACE_OR_CREATE` | *"Replaces the bean if it exists. Creates a new bean if a corresponding bean does not exist."* |
| `WRAP` | *"Retrieves the original bean and wraps it."* |

And which annotation uses which:

- **`@MockitoBean`** → `REPLACE_OR_CREATE`
- **`@TestBean`** → `REPLACE_OR_CREATE`
- **`@MockitoSpyBean`** → `WRAP`

🔴 That mapping explains the two behaviours people find surprising, before you meet either as a
bug:

1. **`@MockitoBean` will happily invent a bean that does not exist.** Misspell the type, or mock
   something your slice never had, and you get a mock rather than an error. Your test passes and
   proves nothing about the application. The cure is `enforceOverride` — see below.
2. **`@MockitoSpyBean` cannot invent one.** It wraps, so it needs exactly one existing candidate.
   No bean means an exception, which is the friendlier failure of the two.

## `@MockitoBean` in use

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired MockMvcTester mvc;

    @MockitoBean OrderService orderService;      // Mockito mock, put into the context

    @Test
    void returnsTheOrder() {
        given(orderService.find(42L)).willReturn(new Order(42L, "SHIPPED"));
        // ...
    }
}
```

The mock **is** the bean the context injects into your controller, so the controller under test
uses it exactly as it would use the real service.

### How the bean to override is selected

By **type**, from the field's declared type. When that is ambiguous:

- `@Qualifier` disambiguates, and
- *"In the absence of a `@Qualifier` annotation, the name of the annotated field will be used as
  a fallback qualifier."*

That fallback is convenient and it has a consequence you should read now rather than discover
later: **field names participate in the context cache key**. Two classes mocking the same bean
into differently named fields get two contexts. That is
[06b · Overriding changes the cache key](06b-overriding-changes-the-cache-key.md), and it is the
most expensive thing in this chunk.

### The attributes worth knowing

| Attribute | Default | What it is for |
|---|---|---|
| `value` / `name` | `""` | Name the bean explicitly instead of matching by type |
| `types` | `{}` | The types to mock — *"Types must be omitted when the annotation is used on a field"* |
| `contextName` | `""` | Target a specific context in a hierarchy |
| `extraInterfaces` | `{}` | Additional interfaces the mock should implement |
| `answers` | `RETURNS_DEFAULTS` | The default answer, as with plain Mockito |
| `serializable` | `false` | Make the mock serializable |
| 🔴 `reset` | **`MockReset.AFTER`** | When the mock is reset |
| 🔴 `enforceOverride` | **`false`** | Fail instead of creating a bean that did not exist |

**`reset = MockReset.AFTER` is a default worth internalising.** Your mocks are reset after every
test method already. Stubbing does not leak between tests, and *"my mock remembered the previous
test"* is not a thing that happens with `@MockitoBean` — so it is never a reason to reach for
`@DirtiesContext` ([05b](05b-what-evicts-it.md)).

**`enforceOverride = true` is the one to reach for deliberately.** With the default `false`,
`REPLACE_OR_CREATE` silently mints a new bean when nothing matched — which is exactly what happens
when you mock a type your slice does not contain, or when a refactor renames the bean you were
overriding. The test still passes. Setting `enforceOverride = true` turns that silence into a
failure:

```java
@MockitoBean(enforceOverride = true) OrderService orderService;
```

🔴 **A `@MockitoBean` that silently creates rather than replaces is a green test asserting on a
mock nobody uses.** If you take one habit from this chunk, take this one.

## `@MockitoBean` on a class, and on a field

Field declaration is the common form. The class-level form exists for cases where you want the
override without a field to hold it:

```java
@SpringBootTest
@MockitoBean(types = ExternalPaymentGateway.class)
class OrderFlowTest { }
```

Hence the `types` rule above: *"Types must be omitted when the annotation is used on a field"*,
because on a field the type is the field's own.

## The scope rules that catch people

- **Any override converts a non-singleton to a singleton.** A prototype- or request-scoped bean
  that you override becomes one instance for the context.
- 🔴 **An override registers a bare object as a manual singleton and is therefore not AOP
  proxied.** `@Transactional`, `@Cacheable`, `@Retryable` and method security do **not** apply to
  it. This is a large enough trap to get its own chunk:
  [06e · Overrides and AOP proxies](06e-overrides-and-aop-proxies.md).
- **`@MockitoSpyBean` cannot spy a scoped proxy** (`@Scope(proxyMode = TARGET_CLASS)`) — it
  throws. See [06c · @MockitoSpyBean](06c-mockitospybean.md).

## Migrating from `@MockBean`

| Boot 3 | Boot 4 |
|---|---|
| `@MockBean` | `@MockitoBean` |
| `@SpyBean` | `@MockitoSpyBean` |
| `org.springframework.boot.test.mock.mockito` | `org.springframework.test.context.bean.override.mockito` |
| `@MockBean(reset = MockReset.NONE)` | `@MockitoBean(reset = MockReset.NONE)` |

Mostly mechanical. The two things that are not mechanical: `enforceOverride` is new and worth
turning on as you go, and the AOP-proxy behaviour is now documented explicitly, which may explain
a test you previously worked around without understanding.

## Gotchas and pitfalls

**★ Following any article, answer or generated snippet that uses `@MockBean`.**
It does not compile on Boot 4. The annotation was removed, not deprecated, and its replacement is
in a different project's package.

**★ Importing `@MockitoBean` from a Boot package.**
There isn't one. It is `org.springframework.test.context.bean.override.mockito`. Bean overriding
is a Framework feature now.

**★ Letting `REPLACE_OR_CREATE` create a bean you thought you were replacing.**
The default `enforceOverride = false` means a typo, a rename, or mocking a type your slice never
had, all produce a green test that exercises a mock nothing uses. Turn `enforceOverride` on.

**★ Adding `@DirtiesContext` because "the mock kept its stubbing".**
It did not. `reset` defaults to `MockReset.AFTER`, so every `@MockitoBean` is reset after each
test method.

**★ Mocking the same bean into differently named fields across classes.**
Field names act as fallback qualifiers and participate in the cache key, so you get two contexts
for one logical configuration. Standardise the field name. [06b](06b-overriding-changes-the-cache-key.md).

**★ Expecting `@Transactional` or `@Cacheable` to work on an overridden bean.**
It will not — the override is a bare manual singleton with no proxy around it. [06e](06e-overrides-and-aop-proxies.md).

**★ Using `@MockitoBean` where a slice would have done.**
Mocking six collaborators inside a `@SpringBootTest` to keep it fast is six cache-key components
and a full application context. A slice excludes those beans for free and shares its context with
every other test using the same slice.

**★ Overriding a prototype-scoped bean and expecting prototype semantics.**
Any override makes it a singleton for that context.

## Interview questions

**★ What replaced `@MockBean` in Spring Boot 4?**
`@MockitoBean`, and `@SpyBean` became `@MockitoSpyBean`. Both moved out of Boot into Spring
Framework, at `org.springframework.test.context.bean.override.mockito`, as part of a general bean
overriding mechanism that also provides `@TestBean`. They were removed, not deprecated, so old
code does not compile.

**★ What are the three bean override strategies?**
`REPLACE` — replace the bean, throwing if none exists. `REPLACE_OR_CREATE` — replace if it
exists, create if it does not. `WRAP` — retrieve the original bean and wrap it. `@MockitoBean` and
`@TestBean` use `REPLACE_OR_CREATE`; `@MockitoSpyBean` uses `WRAP`.

**★ Why can `@MockitoBean` hide a mistake that `@MockitoSpyBean` cannot?**
Because `REPLACE_OR_CREATE` will create a bean when nothing matched, so a typo or a bean that your
slice never contained yields a mock and a passing test that proves nothing. `WRAP` has to find
exactly one existing bean to wrap, so the same mistake fails loudly. `enforceOverride = true`
gives `@MockitoBean` the same strictness.

**★ How is the bean to be overridden selected?**
By the field's declared type. On ambiguity, a `@Qualifier` disambiguates, and in its absence *the
name of the annotated field is used as a fallback qualifier*. That fallback is why field names
end up affecting the context cache key.

**★ Do you need to reset your `@MockitoBean` mocks between tests?**
No. The `reset` attribute defaults to `MockReset.AFTER`, so each mock is reset after every test
method. Stubbing does not leak.

**★ What is `enforceOverride` and why would you turn it on?**
It makes the override fail rather than silently create a bean when nothing matched. Default is
`false`. Turning it on converts the most dangerous failure mode of `@MockitoBean` — a green test
against a mock the application never uses — from silence into an error.

**★ What happens to a request-scoped bean that you override?**
It becomes a singleton for that context. Any bean override converts a non-singleton to a
singleton, so scope-dependent behaviour is not observable in a test that overrides the bean.

**★ Does `@Transactional` still apply to a bean you replaced with `@MockitoBean`?**
No. `REPLACE` and `REPLACE_OR_CREATE` register the override directly as a manual singleton,
bypassing normal bean post-processing, so no AOP advice wraps it — no `@Transactional`, no
`@Cacheable`, no method security. `WRAP` is different, and the whole subject is
[06e](06e-overrides-and-aop-proxies.md).

{/* FOOTER */}
