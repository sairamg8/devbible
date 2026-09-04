---
title: "@DynamicPropertySource exists because a container's port is not known until the container starts, and its method contract is unusually strict — static, one DynamicPropertyRegistry argument, values supplied lazily — while the newer DynamicPropertyRegistrar bean covers the case the annotation structurally cannot: a value that has to come from another bean"
sidebar_label: "07b · Profiles and dynamic properties"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Context Management → Context Configuration with Dynamic Property Sources*
> ([dynamic-property-sources](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/dynamic-property-sources.html))
> and *Context Configuration with Environment Profiles*
> ([env-profiles](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/env-profiles.html));
> the method contract, the `Supplier` semantics, the precedence claim and the
> `DynamicPropertyRegistrar` behaviour are read from the first of those.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> **No sandbox** — Java source only; no container was started.

**[07](07-test-properties-and-profiles.md) covered properties whose values you know when you
write the test. This chunk is the other two cases: properties whose values do not exist until
something starts, and the profile switch that selects whole configurations rather than individual
values.**

## `@ActiveProfiles` — selecting a configuration, not a value

```java
@SpringBootTest
@ActiveProfiles("test")
class OrderFlowTest { }
```

This activates the `test` profile for the context, which in Boot means `application-test.yml` (or
`.properties`) is loaded on top of `application.yml`, and any `@Profile("test")` beans are
included.

Two things worth knowing:

- **`activeProfiles` is a cache-key component** ([05](05-the-context-cache.md)). Some classes with
  `@ActiveProfiles("test")` and some without is two contexts. Applying it uniformly — usually on a
  shared base class — costs one context and buys consistency.
- **The profiles are treated as a set**, so declaring the same profiles in a different order does
  not fragment the cache. That is a small mercy the property mechanism does not extend to inlined
  strings.

Profiles are the right lever for *"the whole test environment is configured differently"*. A
per-value override is `@TestPropertySource`. Reaching for a profile to change one property means
every test using that profile now shares an entire configuration you changed for one reason.

## `@DynamicPropertySource` — values that do not exist yet

The problem it solves is concrete. A Testcontainers PostgreSQL binds a *random* host port, and
nothing can know it before the container starts — so `spring.datasource.url` cannot be written in
a file or an annotation. The reference is explicit about the origin:

> *"The dynamic property source infrastructure was originally designed to expose properties from
> Testcontainers-based tests, but can be used with any external resource whose lifecycle is managed
> outside the test's `ApplicationContext`."*

That last clause is the general rule: **anything started outside the context, whose coordinates the
context needs.**

### The method contract

> *"Methods in integration test classes that are annotated with `@DynamicPropertySource` must be
> `static` and must accept a single `DynamicPropertyRegistry` argument."*

```java
@SpringJUnitConfig(/* ... */)
@Testcontainers
class ExampleIntegrationTests {

    @Container
    static GenericContainer redis =
        new GenericContainer("redis:5.0.3-alpine").withExposedPorts(6379);

    @DynamicPropertySource
    static void redisProperties(DynamicPropertyRegistry registry) {
        registry.add("redis.host", redis::getHost);
        registry.add("redis.port", redis::getFirstMappedPort);
    }
}
```

🔴 **Note what is registered: a `Supplier`, not a value.** *"The `Supplier` is only invoked when
the property is resolved."* That is the whole reason method references are the idiom here —
`redis::getFirstMappedPort` is not called at registration time, when the container may not have
started, but later when something asks for the property. Writing
`registry.add("redis.port", redis.getFirstMappedPort())` instead would evaluate immediately and is
the standard way this goes wrong.

The `static` requirement follows from ordering: the properties must exist before the context is
built, so there is no test instance yet.

### Precedence — it wins over everything

Dynamic properties sit at the top of the order from [07](07-test-properties-and-profiles.md),
above `@TestPropertySource`, OS environment variables, system properties, and anything the
application declared. So they *"can selectively override properties from all other sources"* —
which is what makes them able to redirect a datasource that `application.yml` has already
configured.

### 🔴 And they are a cache-key component

`@DynamicPropertySource` methods are named explicitly in the `contextCustomizers` bullet of the
cache key ([05](05-the-context-cache.md), [06b](06b-overriding-changes-the-cache-key.md)). A test
class with its own `@DynamicPropertySource` method has **its own application context**.

This is the single strongest practical argument for the singleton-container pattern and for Boot's
`@ServiceConnection`: put the wiring in one shared place rather than repeating the method on every
test class. Topic 07 owns that argument in full —
[07 · Passed on H2 proves nothing](../07-testcontainers/01-passed-on-h2-proves-nothing.md).

## `DynamicPropertyRegistrar` — the case the annotation cannot reach

A `@DynamicPropertySource` method is `static`, so it cannot see beans. When the value has to come
*from a bean*, the newer alternative applies: implement `DynamicPropertyRegistrar` as a bean.

> *"Any bean implementing `DynamicPropertyRegistrar` will be automatically detected"*, such beans
> are *"eagerly initialized before the singleton pre-instantiation phase"*, and the `accept()`
> method is invoked with a `DynamicPropertyRegistry`.

```java
@Configuration
class TestConfig {

    @Bean
    ApiServer apiServer() {
        return new ApiServer();
    }

    @Bean
    DynamicPropertyRegistrar apiPropertiesRegistrar(ApiServer apiServer) {
        return registry -> registry.add("api.url", apiServer::getUrl);
    }
}
```

The eager initialisation is the load-bearing detail: the registrar runs before the ordinary
singletons, so the properties it registers are available to every bean that needs them.

**When to prefer it:** the value comes from a bean; or you want the wiring in a shared
`@TestConfiguration` rather than repeated on each test class — which, being one shared
configuration, is also better for the context cache.

## Gotchas and pitfalls

**★ Calling the getter instead of passing a method reference.**
`registry.add("redis.port", redis.getFirstMappedPort())` evaluates immediately, before the
container has a port. `registry.add("redis.port", redis::getFirstMappedPort)` supplies it lazily,
when the property is resolved. The signature accepts a `Supplier` for exactly this reason.

**★ A non-`static` `@DynamicPropertySource` method.**
Required to be `static`. The properties must be in place before the context is built, so there is
no test instance to call an instance method on.

**★ Repeating the same `@DynamicPropertySource` method on every test class.**
Each one is a `contextCustomizer` and therefore a distinct cache key, so every class gets its own
context. Hoist it into a shared base class, a singleton container, or `@ServiceConnection`.

**★ Using `@ActiveProfiles` to change one property.**
It selects an entire configuration. Every class using that profile now shares a change made for
one test's reason. A single value is `@TestPropertySource`.

**★ Mixing `@ActiveProfiles` unevenly across a suite.**
It is a cache-key component, so some classes with and some without means two contexts. Put it on a
shared base class.

**★ Expecting `@DynamicPropertySource` to be overridable by an inlined property.**
It is not — dynamic properties have the highest precedence of all. If a value you inlined is being
ignored, look for a dynamic registration.

**★ Wanting a dynamic value that depends on a bean, and forcing it into a static method.**
That is what `DynamicPropertyRegistrar` is for. A static method structurally cannot see the
context.

**★ Assuming profile ordering matters for the cache.**
It does not — profiles are treated as a set. This is one of the few places the cache key is
forgiving, unlike inlined property strings.

## Interview questions

**★ Why does `@DynamicPropertySource` exist at all?**
Because some configuration values do not exist until something outside the `ApplicationContext`
starts — the canonical case being a Testcontainers container's randomly mapped host port. The
reference says the infrastructure was originally designed for exactly that, and generalises to
*"any external resource whose lifecycle is managed outside the test's `ApplicationContext`"*.

**★ What is the contract for a `@DynamicPropertySource` method?**
It must be `static` and must accept a single `DynamicPropertyRegistry` argument. Static because the
properties have to be registered before the context is built, when there is no test instance yet.

**★ Why do you register a method reference rather than a value?**
Because `DynamicPropertyRegistry.add` takes a `Supplier`, and *"the `Supplier` is only invoked when
the property is resolved"*. Passing `redis.getFirstMappedPort()` evaluates at registration time —
potentially before the container has started — while `redis::getFirstMappedPort` defers until the
property is actually needed.

**★ Where do dynamic properties sit in the precedence order?**
At the top. They override `@TestPropertySource`, OS environment variables, Java system properties
and the application's own property sources, which is what allows them to redirect a datasource
that `application.yml` has already configured.

**★ What do dynamic properties cost?**
A context. `@DynamicPropertySource` methods are explicitly part of the `contextCustomizers` cache
key component, so a class declaring one gets its own `ApplicationContext` — the same cost as a
bean override. That is the argument for a shared singleton container or `@ServiceConnection` over
a per-class method.

**★ What is `DynamicPropertyRegistrar` and when would you use it?**
A bean-based alternative to the annotation. Any bean implementing it is detected automatically and
eagerly initialised before the singleton pre-instantiation phase, and its `accept()` method
receives a `DynamicPropertyRegistry`. Use it when the dynamic value has to come from another bean —
which a `static` method structurally cannot reach — or when you want the wiring in one shared
`@TestConfiguration` rather than on every test class.

**★ How do `@ActiveProfiles` and `@TestPropertySource` differ, beyond syntax?**
A profile selects an entire configuration — a properties file and a set of `@Profile` beans —
while `@TestPropertySource` overrides individual values. Both are cache-key components, but
profiles are compared as a *set*, so ordering does not fragment the cache, whereas inlined property
strings are compared character by character.

{/* FOOTER */}
