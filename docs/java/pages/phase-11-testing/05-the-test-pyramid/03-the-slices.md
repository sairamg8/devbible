---
title: "A slice annotation is not a feature, it is five meta-annotations that switch auto-configuration off and then name a short list to switch back on — and once you can read those five, every surprising thing a slice does stops being surprising"
sidebar_label: "03 · The slices"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Boot 4.1.1 reference *Testing → Testing Spring Boot
> Applications → Auto-configured Tests*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html))
> and the *Test Auto-configuration Annotations* appendix
> ([appendix](https://docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html)),
> with the composition read from the Boot 4.1.0 javadoc for `WebMvcTest`, `DataJpaTest`,
> `JdbcTest` and `OverrideAutoConfiguration`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0.
> **No sandbox** — Java source only, no test-run output.

**[02](02-a-unit-test-needs-no-spring.md) got you the tests that need no container at all. This
chunk is the next level up: a test that does start an `ApplicationContext`, but a deliberately
small one. A slice is not a special kind of test and not a special kind of context — it is an
ordinary Spring context in which Boot has been told *"auto-configure nothing, except these
eleven things"* and *"component-scan nothing, except these stereotypes"*. Everything people find
surprising about slices — the bean that is missing, the `@Component` that is ignored, the fact
that you cannot combine two of them — is a direct reading of those two instructions.**

## What `@WebMvcTest` actually expands to

Strip the annotation down and there are five meta-annotations doing the work. Every slice in
Boot is built from the same five, and only the arguments differ:

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@BootstrapWith(WebMvcTestContextBootstrapper.class)
@ExtendWith(SpringExtension.class)
@OverrideAutoConfiguration(enabled = false)
@TypeExcludeFilters(WebMvcTypeExcludeFilter.class)
@AutoConfigureCache
@AutoConfigureWebMvc
@AutoConfigureMockMvc
@ImportAutoConfiguration
public @interface WebMvcTest { /* ... */ }
```

Read in order:

1. **`@BootstrapWith(...TestContextBootstrapper.class)`** — hands the TestContext framework a
   bootstrapper that knows how to assemble *this* kind of context. This is the hook that lets a
   slice differ from `@SpringBootTest` at all.
2. **`@ExtendWith(SpringExtension.class)`** — the JUnit Jupiter integration. This is why you do
   not write it yourself: every `@…Test` slice already carries it, and so does `@SpringBootTest`.
3. 🔴 **`@OverrideAutoConfiguration(enabled = false)`** — the load-bearing one. Boot's normal
   behaviour is to apply *every* auto-configuration on the classpath that its conditions permit.
   This switches the whole mechanism off. On its own, it would leave you with a context that
   auto-configures nothing at all.
4. **`@ImportAutoConfiguration`** plus the `@AutoConfigure…` annotations — the short list that
   comes back on. Each `@AutoConfigureX` is itself a marker that resolves to a named set of
   auto-configuration classes, so `@WebMvcTest` gets MVC infrastructure, Jackson, `MockMvc` and
   the cache abstraction, and gets no `DataSource`, no JPA and no `RestClient`.
5. **`@TypeExcludeFilters(...TypeExcludeFilter.class)`** — narrows *component scanning*, which is
   a separate axis from auto-configuration and the one that catches people out. It is the subject
   of [03b · What a slice excludes](03b-what-a-slice-excludes.md).

**Nothing here is magic and nothing here is a runner.** A slice is `@SpringBootTest`'s
configuration discovery with a different set of switches, which is why they share the context
cache, the bean-override mechanism and the property support described in the rest of this topic.

## The two axes, and why keeping them apart saves you

| | Controlled by | Failure when it excludes something you needed |
|---|---|---|
| **Auto-configuration** (infrastructure Boot creates for you) | `@OverrideAutoConfiguration` + the `@AutoConfigure…` list | A missing `DataSource`, `ObjectMapper`, `RestClient.Builder` — the type is not in the context at all |
| **Component scanning** (your own annotated classes) | `@TypeExcludeFilters` | Your `@Service` is not a bean; the controller that needs it fails to start |

Both produce a `NoSuchBeanDefinitionException` at context startup, which is why they get
diagnosed as the same problem and fixed with the same wrong reflex — widening the test until it
works. They are not the same problem, and the fixes differ: a missing auto-configuration is
supplied with the matching `@AutoConfigure…` annotation or `@ImportAutoConfiguration`, a missing
component with `@MockitoBean` (see [06 · Bean overriding](06-bean-overriding.md)) or an explicit
`@Import`.

## Which of your classes a slice scans

The `@WebMvcTest` javadoc is explicit about its own list. It scans:

- `@Controller` and `@ControllerAdvice`
- `@JacksonComponent`
- implementations of `Converter`, `GenericConverter`, `Filter`, `HandlerInterceptor`,
  `HttpMessageConverter`, `SecurityFilterChain` and `WebMvcConfigurer`

and, in the reference's own words:

> *"Regular `@Component` and `@ConfigurationProperties` beans are not scanned when slice test
> annotations are used."*

That sentence is the one to remember. **Your `@Service` is not in a `@WebMvcTest` context.** This
is deliberate — it is the whole point of the slice — and the intended reply is to supply the
collaborator as a mock. The javadoc names `@MockitoBean` as the mechanism.

`@DataJpaTest` inverts the same idea: it scans `@Entity` classes and Spring Data repositories,
and not your controllers.

## 🔴 One slice per test — this is stated, not merely unsupported in practice

> *"Including multiple 'slices' by using several `@…Test` annotations in one test is not
> supported."*

There is no combining `@WebMvcTest` with `@DataJpaTest` to get "a controller and a real
database". If you genuinely need both ends, that is `@SpringBootTest`
([04 · @SpringBootTest](04-springboottest.md)) — and the honest reason is usually that the test
is an integration test wearing a slice's clothing.

The supported way to *add* to a slice is different and much narrower: `@AutoConfigure…`
annotations, `@ImportAutoConfiguration`, or `@Import` of a specific configuration class. Each of
those adds a named thing. Stacking two slices would mean two bootstrappers and two type-exclude
filters, which is why it is not a supported combination rather than merely a discouraged one.

## 🔴 Two slices carry `@Transactional`, and you did not ask for it

`@DataJpaTest` and `@JdbcTest` are composed with **`@Transactional`** and
**`@AutoConfigureTestDatabase`** in addition to the five above. That has consequences most people
meet as a mystery rather than as a documented behaviour:

- **Every test method runs in a transaction that rolls back at the end.** Your inserts are never
  visible to anything outside the test. [08 · Transactions in tests](08-transactions-in-tests.md)
  owns what that hides and how to opt out.
- **The persistence context is not flushed** unless something forces it, so a constraint
  violation or a generated ID may not appear where you expect. Phase 10 topic 04 covers the ORM
  mechanics; this topic owns the test-level decision.

`@AutoConfigureTestDatabase` is the second surprise, and Boot 4 changed the advice about it —
see [03c · The slice catalogue](03c-the-slice-catalogue.md), which carries the `Replace` default
and the Testcontainers consequence.

## What it buys you, stated as the number that matters

A slice is worth using for exactly one reason: **a smaller context starts faster and is cached
separately**. A `@WebMvcTest` context has no connection pool to open, no Hibernate
`SessionFactory` to build and no `EntityManagerFactory` metadata to scan. The saving is real and
it compounds across a suite.

But the saving is *per distinct context*, not per test, and a suite that uses five slice types
carelessly can end up starting more contexts than a suite that used `@SpringBootTest` once. That
trade-off is [05 · The context cache](05-the-context-cache.md), and it is the single biggest
lever on suite runtime in this whole topic.

## Gotchas and pitfalls

**★ "It works in `@SpringBootTest` but not in the slice", answered wrongly.**
The reflex fix is to add `@Import(EverythingConfig.class)` or to swap the slice for
`@SpringBootTest`. Both work, and both throw away the reason you used a slice. Read the failure:
if it names a bean of *your* type, supply it as a mock; if it names infrastructure, add the one
`@AutoConfigure…` for it.

**★ Adding `@ComponentScan` to a slice test.**
It re-enables scanning that the `@TypeExcludeFilters` was there to prevent, and quietly turns
the slice into a slow near-`@SpringBootTest` that still lacks auto-configuration. The result is
the worst of both: full startup cost, half the infrastructure.

**★ Assuming `@SpringBootTest` and a slice differ in "how much of the app runs".**
They differ in *what is configured*, not in how much executes. A `@WebMvcTest` runs your real
controller, your real argument resolvers and your real message converters. Nothing is stubbed
unless you stub it.

**★ Expecting `@ConfigurationProperties` binding inside a slice.**
It is in the excluded list above. If the controller reads a properties bean, it is not there.
`@EnableConfigurationProperties(MyProps.class)` on the test brings back exactly the one you need.

**★ Reading a blog's import statement.**
🔴 In Boot 4 the slice annotations **moved into per-module artifacts and their packages
changed** — `@WebMvcTest` is now in `org.springframework.boot.webmvc.test.autoconfigure`. Every
sample written against Boot 3 has an import that does not resolve. The full mapping is in
[03c](03c-the-slice-catalogue.md).

**★ Treating a slice as a security test.**
`@WebMvcTest` scans `SecurityFilterChain`, so your filter chain *is* applied — which surprises
people in both directions: unauthenticated requests get 401 where they expected 200, and people
conclude security is untested when it is the thing failing them. Topic 06 owns this
(`06 · MockMvc`).

## Interview questions

**★ What is a test slice, mechanically?**
A composed annotation that sets `@OverrideAutoConfiguration(enabled = false)` to switch off all
auto-configuration, then re-enables a named subset via `@ImportAutoConfiguration` and
`@AutoConfigure…` markers, and restricts component scanning with a `@TypeExcludeFilters`. It also
supplies a `TestContextBootstrapper` and `SpringExtension`. It is not a runner and not a mode —
it is configuration.

**★ Why is your `@Service` not available in a `@WebMvcTest`?**
Because slice scanning is restricted by a type-exclude filter to controllers, advices, converters
and a short list of web infrastructure types. The reference states that regular `@Component` and
`@ConfigurationProperties` beans are not scanned in a slice. The intended answer is to supply the
service as a `@MockitoBean`, which is what the `@WebMvcTest` javadoc itself recommends.

**★ Can you combine `@WebMvcTest` and `@DataJpaTest`?**
No — the reference says combining slices is not supported. Each brings its own bootstrapper and
type-exclude filter. If you need the controller and a real database in one test, that is
`@SpringBootTest`, and you should be clear with yourself that you are writing an integration
test rather than a slice test.

**★ What is the difference between auto-configuration exclusion and component-scan exclusion?**
Auto-configuration decides what infrastructure Boot builds for you — `DataSource`,
`ObjectMapper`, `MockMvc`. Component scanning decides which of *your* annotated classes become
beans. A slice restricts both, through different mechanisms, and both surface as a missing bean
at startup. The fix differs: an `@AutoConfigure…` annotation for the first, a mock or an
`@Import` for the second.

**★ Why do `@DataJpaTest` tests roll back, and did you ask for that?**
You did not: `@DataJpaTest` is meta-annotated `@Transactional`, so the TestContext framework runs
each test in a transaction and rolls it back at the end. It is convenient and it hides real
behaviour — flush timing, constraint violations, and anything a second connection would see.
Covered in [08](08-transactions-in-tests.md).

**★ Is a slice faster than `@SpringBootTest` because it runs less code?**
No — it is faster because it *configures* less. Your real controller still executes in full. The
saving is startup: no connection pool, no `EntityManagerFactory`, no server. And the saving only
materialises if the slice's context is cached and reused, which is a separate concern from
choosing the slice.

{/* FOOTER */}
