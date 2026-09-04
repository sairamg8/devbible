---
title: "@DynamicPropertySource registers Suppliers rather than values, runs during context customization rather than when the container starts, and requires a static method for a reason that has nothing to do with container readiness"
sidebar_label: "04c · @DynamicPropertySource"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.9** reference —
> [Context Configuration with Dynamic Property Sources](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/testcontext-framework/ctx-management/dynamic-property-sources.adoc),
> [`@DynamicPropertySource`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/annotations/integration-spring/annotation-dynamicpropertysource.adoc)
> and [Context Caching](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/testcontext-framework/ctx-management/caching.adoc) —
> plus the `spring-test` sources at the same tag
> ([`DynamicPropertyRegistry`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-test/src/main/java/org/springframework/test/context/DynamicPropertyRegistry.java),
> [`DynamicPropertyRegistrar`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-test/src/main/java/org/springframework/test/context/DynamicPropertyRegistrar.java),
> `DynamicPropertiesContextCustomizer`, `DynamicPropertiesContextCustomizerFactory`), and the
> **Spring Boot 4.1.1** reference at `v4.1.0` for the Testcontainers sample.
> Version spine: JDK 25, Spring Boot 4.1.1 / Spring Framework 7.0.9, **Testcontainers 2.0.5**,
> JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**[04](04-serviceconnection.md) through [04b6](04b6-importing-and-development-time.md) covered the
mechanism you should reach for first. This chunk is the one you reach for second — and you will
reach for it, because [04b3](04b3-the-supported-services.md)'s catalogue is finite and your
dependencies are not. `@DynamicPropertySource` predates `@ServiceConnection` by two years and was
not deprecated by it; Boot's own documentation calls it *"a slightly more verbose but also more
flexible alternative"*. This page is the mechanism: the shape of the method, why its value is a
`Supplier`, when it runs, and the real reason it has to be `static` — which is not the reason
everybody gives. [04c2](04c2-precedence-and-when-to-use-it.md) is when to choose it over
`@ServiceConnection`; [04c3](04c3-the-registrar.md) is the modern
`DynamicPropertyRegistrar` form and the context-cache trap.**

## The shape

```java
@Testcontainers
@SpringBootTest
class MyIntegrationTests {

    @Container
    static Neo4jContainer neo4j = new Neo4jContainer("neo4j:5");

    @DynamicPropertySource
    static void neo4jProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.neo4j.uri", neo4j::getBoltUrl);
    }

    @Test
    void myTest() {
        // ...
    }
}
```

That is Boot's own sample, verbatim. The Framework's rule for the method is exact and it is
enforced at runtime, not by the compiler:

> *"Methods in integration test classes that are annotated with `@DynamicPropertySource` must be
> `static` and must accept a single `DynamicPropertyRegistry` argument."*

`DynamicPropertyRegistry` is a one-method interface:

```java
public interface DynamicPropertyRegistry {

    /**
     * Add a {@link Supplier} for the given property name to this registry.
     * @param name the name of the property for which the supplier should be added
     * @param valueSupplier a supplier that will provide the property value on demand
     */
    void add(String name, Supplier<Object> valueSupplier);
}
```

## 🔴 The value is a `Supplier`, and that is the whole design

> *"A `DynamicPropertyRegistry` is used to add name-value pairs to the `Environment`. Values are
> dynamic and provided via a `Supplier` **which is only invoked when the property is resolved**.
> Typically, method references are used to supply values."*

This is why the samples all use method references — `neo4j::getBoltUrl`, not
`neo4j.getBoltUrl()`. Passing the *call* would evaluate it while registering, which is far too
early. Passing the *reference* defers it to whenever some bean actually asks for
`spring.neo4j.uri`.

```java
registry.add("spring.neo4j.uri", neo4j::getBoltUrl);     // ✅ deferred
registry.add("spring.neo4j.uri", () -> neo4j.getBoltUrl());  // ✅ identical, more typing
registry.add("spring.neo4j.uri", neo4j.getBoltUrl());        // ❌ evaluated now
```

The third line does not even compile against `Supplier<Object>` unless the expression happens to be
a `Supplier`, which is a small mercy — but the same mistake made inside a lambda that captures a
computed `String` is legal and wrong.

## When it runs, and the ordering people get backwards

The method body is invoked by `DynamicPropertiesContextCustomizer.customizeContext`, during context
customization, before the bean factory is populated:

```java
@Override
public void customizeContext(ConfigurableApplicationContext context, MergedContextConfiguration mergedConfig) {
    // ... registers DynamicPropertyRegistrarBeanInitializer ...
    if (!this.methods.isEmpty()) {
        ConfigurableEnvironment environment = context.getEnvironment();
        DynamicValuesPropertySource propertySource = DynamicValuesPropertySource.getOrCreate(environment);
        DynamicPropertyRegistry registry = propertySource.dynamicPropertyRegistry;
        this.methods.forEach(method -> {
            ReflectionUtils.makeAccessible(method);
            ReflectionUtils.invokeMethod(method, null, registry);
        });
    }
}
```

Note `invokeMethod(method, null, registry)` — the `null` target is the static invocation, and it is
the *only* thing the framework can do, because the method is required to be static.

So the sequence is: **the method runs early and registers suppliers; the suppliers run late, when a
bean resolves the property.** The container therefore does not have to be started when the
`@DynamicPropertySource` method executes — it has to be started when the *first bean that needs the
property* is created. In a `@Testcontainers` test that is satisfied because the extension starts
static containers in `beforeAll`, before the context is used.

⚠️ I could not confirm from the documentation the exact interleaving of the Testcontainers JUnit
extension's `beforeAll` against Spring's context loading in every configuration, so do not build a
mental model that depends on it. Build one on the two facts that *are* documented: the method runs
at customization time, and the value is fetched on resolution.

## 🔴 Why the method must be `static` — the real reason

The usual explanation is "because the container has to be started already". That is not it. The
requirement is enforced unconditionally in `DynamicPropertiesContextCustomizer`, whether or not a
container is involved:

```java
private static void assertValid(Method method) {
    Assert.state(Modifier.isStatic(method.getModifiers()),
            () -> "@DynamicPropertySource method '" + method.getName() + "' must be static");
    Class<?>[] types = method.getParameterTypes();
    Assert.state(types.length == 1 && types[0] == DynamicPropertyRegistry.class,
            () -> "@DynamicPropertySource method '" + method.getName() +
                    "' must accept a single DynamicPropertyRegistry argument");
}
```

The method is invoked with a `null` target during context customization, at which point **no test
instance exists** — Jupiter has not constructed one, and with the default per-method lifecycle it
would construct a different one for each test anyway. There is nothing for a non-static method to
be invoked on.

The knock-on effect is what people actually feel: because the method is static, it can only
reference static state, so the container field has to be static too. The `static` on the container
is a *consequence* of the `static` on the method, not an independent requirement. And it is exactly
that staticness — one container field per class, shared across every instance — that puts this
mechanism on a collision course with the context cache, which
[04c4](04c4-dynamic-properties-and-the-cache.md) is about.

Note also the second assertion's strictness: `types[0] == DynamicPropertyRegistry.class`, an
identity check. A method taking a subtype or a wider type fails.

## Gotchas

**★ The `static` requirement is about the *method*, not about container readiness.**
The framework invokes it with a `null` target during context customization, when no test instance
exists. The container field ends up static because a static method can only see static state — that
is a consequence, not an independent rule.

**★ `registry.add("k", container.getHost())` and `registry.add("k", container::getHost)` are not the same.**
The first evaluates immediately; the second defers to property resolution. The straightforward form
usually will not compile, but the same eager evaluation hidden inside a lambda that captured an
already-computed `String` compiles fine and reads a value from a container that may not be running.

**★ The parameter type check is an identity check.**
`types[0] == DynamicPropertyRegistry.class`. A method declaring a subinterface, or `Object`, fails
with *"must accept a single DynamicPropertyRegistry argument"* — it is not a normal assignability
test.

**★ A `@DynamicPropertySource` method with a return value is fine; one with two parameters is not.**
Only arity and the single parameter type are checked. Nothing stops you returning something; nothing
reads it.

## Interview questions

**★ What is `@DynamicPropertySource` and what is its exact contract?**
An annotation for a `static` method in an integration test class that accepts exactly one
`DynamicPropertyRegistry` argument and registers property names against `Supplier` values. Both
constraints are asserted at runtime by `DynamicPropertiesContextCustomizer`, with the parameter
check being an identity comparison against `DynamicPropertyRegistry.class`. It exists so that
properties whose values are not known until something outside the context has started — a container,
a mock server, an embedded broker — can still reach the `Environment`.

**★ Why is the value a `Supplier` rather than a `String`?**
Because the method runs during context customization, long before anything has asked for the
property, and in a Testcontainers test possibly before the value exists. The Framework documents
that the supplier *"is only invoked when the property is resolved"*, so the container's host and
mapped port are read at the moment a bean needs them. Method references are the idiomatic form for
exactly this reason.

**★ Why must the method be static?**
Because the framework invokes it reflectively with a `null` target during context customization, at
which point no test instance exists — and under Jupiter's default per-method lifecycle there would
be a different instance per test anyway. The often-repeated explanation, that the container must
already be started, is not the mechanism; the container field is static only because a static
method cannot see anything else.

**★ Is `@DynamicPropertySource` deprecated?**
No. Boot 4.1 describes it as *"a slightly more verbose but also more flexible alternative to service
connections"* and still ships it in its reference. What has changed is that for containers in the
catalogue it is the wrong default, and that for `@Bean`-managed containers there is now a better
form of the same idea — `DynamicPropertyRegistrar`, in [04c3](04c3-the-registrar.md).

{/* FOOTER */}
