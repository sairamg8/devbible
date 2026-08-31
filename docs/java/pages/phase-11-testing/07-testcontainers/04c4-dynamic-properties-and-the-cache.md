---
title: "The context cache keys @DynamicPropertySource on the SET OF METHODS rather than on the values they register, which is why two subclasses of one base class silently share a context pointed at the first subclass's container"
sidebar_label: "04c4 · Dynamic properties and the cache"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.8** reference —
> [Context Caching](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/testcontext-framework/ctx-management/caching.adoc)
> (the cache-key component list, quoted verbatim) and
> [Context Configuration with Dynamic Property Sources](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/testcontext-framework/ctx-management/dynamic-property-sources.adoc)
> (the `@DirtiesContext` tip) — plus the `spring-test` sources at the same tag,
> [`DynamicPropertiesContextCustomizer`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-test/src/main/java/org/springframework/test/context/support/DynamicPropertiesContextCustomizer.java)
> and `DynamicPropertiesContextCustomizerFactory`, read directly for the equality and search rules.
> Version spine: JDK 25, Spring Boot 4.1.0 / Spring Framework 7.0.8, **Testcontainers 2.0.5**,
> JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**This is the chunk that closes the topic's `@DynamicPropertySource` thread, and it is the one with
the trap in it. The Spring TestContext framework caches application contexts, and dynamic properties
participate in the cache key — but not in the way almost everybody assumes. The key includes the
**set of methods**, not the values those methods register. A shared base class therefore hands every
subclass one context and one set of values, and the resulting failure looks like a data problem
rather than a caching problem. The cache itself belongs to
[05 · The test pyramid](../05-the-test-pyramid/05-the-context-cache.md); this page claims only the
part that is specific to dynamic properties.**

## 🔴 The context cache keys on methods, not on values

The Framework lists what builds the cache key, and dynamic properties are in there — but read the
parenthetical carefully:

> *"`contextCustomizers` (from `ContextCustomizerFactory`) – this includes `@DynamicPropertySource`
> methods, bean overrides (such as `@TestBean`, `@MockitoBean`, `@MockitoSpyBean` etc.), as well as
> various features from Spring Boot's testing support."*

The customizer's equality is the whole story:

```java
class DynamicPropertiesContextCustomizer implements ContextCustomizer {

    private final Set<Method> methods;

    @Override
    public boolean equals(@Nullable Object other) {
        return (this == other || (other instanceof DynamicPropertiesContextCustomizer that &&
                this.methods.equals(that.methods)));
    }

    @Override
    public int hashCode() {
        return this.methods.hashCode();
    }
}
```

**`Set<Method>`.** Not the property names. Not the values. Not the suppliers. The identity of the
reflected methods.

Two consequences, and they pull in opposite directions:

- **Two unrelated test classes each declaring their own `@DynamicPropertySource` method get
  different customizers**, because the `Method` objects differ, so they get different contexts and
  each starts its own container. That is usually what you want and it is also a reason a suite
  builds more contexts than its author expected.
- **A base class with one `@DynamicPropertySource` method, extended by two subclasses, yields the
  *same* `Method` object both times** — the same customizer, the same cache key, and therefore
  **the same cached context**. The second subclass never runs its own registration; it inherits the
  values the first one registered.

That second case is documented, as a workaround rather than as a mechanism:

> *"If you use `@DynamicPropertySource` in a base class and discover that tests in subclasses fail
> because the dynamic properties change between subclasses, you may need to annotate your base class
> with `@DirtiesContext` to ensure that each subclass gets its own `ApplicationContext` with the
> correct dynamic properties."*

```java
@DirtiesContext                      // each subclass gets its own context and its own values
abstract class AbstractContainerTest {

    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
    }
}
```

⚠️ `@DirtiesContext` is a blunt instrument — it closes the context, so you pay a full context build
per subclass. It is the documented fix, but the better fix is usually to stop varying the values in
the first place: one shared container in the base class, no per-subclass difference, no need to
dirty anything. The cache itself is [05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md)
and [05b · What evicts it](../05-the-test-pyramid/05b-what-evicts-it.md); this page only claims the
part that is specific to dynamic properties.

## Registrar beans and the cache key

Registrars are not in the customizer's `Set<Method>` at all, so they contribute to the cache key the
ordinary way — through the configuration class that declares them, which is part of `classes`.
Practically: two test classes importing the same `@TestConfiguration` share a context and share its
containers; importing a different configuration gives you a different context. That is the same rule
as any other bean, which is one more argument for the bean form — there is no special case to
remember.

## `@Nested` classes, and a comment worth reading

`DynamicPropertiesContextCustomizerFactory` searches enclosing classes before the class itself:

```java
private void findMethods(Class<?> testClass, Set<Method> methods) {
    // Beginning with Java 16, inner classes may contain static members.
    // We therefore need to search for @DynamicPropertySource methods in the
    // current class after searching enclosing classes so that a local
    // @DynamicPropertySource method can override properties registered in
    // an enclosing class.
    if (TestContextAnnotationUtils.searchEnclosingClass(testClass)) {
        findMethods(testClass.getEnclosingClass(), methods);
    }
    methods.addAll(MethodIntrospector.selectMethods(testClass, this::isAnnotated));
}
```

Two things follow. A `@Nested` class inherits its outer class's `@DynamicPropertySource` methods.
And because the outer methods are added to the `LinkedHashSet` first and invoked in order, a
same-named property registered by a nested class's own method **overrides** the outer one — the
ordering is deliberate and the comment says so.

Note also what the comment does *not* say: it does not claim inner classes cannot have static
members. That restriction ended at Java SE 16 and the framework's own source is written on the
assumption that it did.

## Migrating a codebase full of `@DynamicPropertySource`

Not a rewrite. Three passes, in this order:

**1 · Delete the ones that are pure connection details.** If the method registers only
`spring.datasource.*`, `spring.data.mongodb.*`, `spring.neo4j.*` or similar for a container that is
in [04b3](04b3-the-supported-services.md)'s catalogue, replace the whole method with
`@ServiceConnection` on the container field. This is the highest-value change: you delete code, you
stop owning property names across Boot upgrades, and for a `JdbcDatabaseContainer` you pick up
Flyway and Liquibase wiring you were not getting.

**2 · Convert the ones attached to `@Bean` containers.** If a base class holds a static container
only so a `@DynamicPropertySource` method can see it, that is the shape
[04b5](04b5-containers-as-beans.md) argues against. Move the container to a `@Bean` in a
`@TestConfiguration` and the registration to a `DynamicPropertyRegistrar` bean that takes the
container as a parameter.

**3 · Leave the rest alone.** A `@DynamicPropertySource` registering `app.aws.endpoint` from a
LocalStack container, or a computed value, or a property your own code reads, is correct as written.
There is no upgrade for it and converting it to a registrar buys nothing if the container is already
a static field.

And one thing not to do: do not add `@DirtiesContext` to base classes prophylactically. Add it only
when the values genuinely differ per subclass, and prefer removing the variation.

## Gotchas

**★ The context cache key uses the set of `@DynamicPropertySource` *methods*, not the values.**
`DynamicPropertiesContextCustomizer.equals` compares `Set<Method>`. Two classes with different
methods get different contexts; two subclasses inheriting one method from a base class get the
**same** context, and the second inherits the first's registered values.

**★ Which means the classic "shared base class with a container" pattern is a trap.**
It looks like the DRY thing to do, and it is — right up to the point where two subclasses need
different values. Then they silently share, and the failure looks like a data problem rather than a
caching problem.

**★ `@DirtiesContext` fixes it by making the suite slower.**
It is the documented answer and it works by closing the context so each subclass builds its own.
That is a full context build per subclass. Fixing the variation is almost always better than paying
for it.

**★ A `@Nested` class inherits its outer class's `@DynamicPropertySource` methods.**
The factory searches enclosing classes. That is usually convenient and occasionally a surprise —
a nested class you thought was isolated is registering the outer class's properties.

**★ A nested class's own method overrides a same-named outer property, and the ordering is why.**
Enclosing-class methods go into the `LinkedHashSet` first and are invoked first, so a later
registration of the same key wins. Relying on this makes a test's configuration depend on class
nesting order, which is hard to read.

## Interview questions

**★ Do `@DynamicPropertySource` methods affect the context cache key?**
Yes — they are part of `contextCustomizers`, which the Framework lists as one of the key's
components. But the equality is on the **set of `Method` objects**, not on the properties or values
registered. So two test classes with distinct methods get distinct contexts, and two subclasses
inheriting the same method from a base class get the *same* context.

**★ You have a base class with a container and a `@DynamicPropertySource`, and a subclass's test sees the wrong database. Explain it.**
Both subclasses resolve to the same inherited `Method`, so the customizers compare equal, so the
cache key is identical and the second subclass reuses the first's context — including the properties
the first registration produced. The documented remedy is `@DirtiesContext` on the base class, which
forces each subclass to build its own context. The better remedy is usually to stop the values
varying between subclasses.

**★ Where do dynamic properties end up in the `Environment`, and when are the methods run?**
`DynamicPropertiesContextCustomizer.customizeContext` gets or creates a `DynamicValuesPropertySource`
on the context's environment and invokes each `@DynamicPropertySource` method reflectively with a
`null` target, passing that source's registry. So the methods run at context-customization time,
before beans are created, and register suppliers that are only called when a property is resolved.

**★ How do `@Nested` test classes interact with `@DynamicPropertySource`?**
The factory searches enclosing classes first and then the class itself, so a nested class inherits
its outer class's methods, and a same-named property registered by the nested class's own method
overrides the outer one because it is invoked later. The source comment gives the reason explicitly:
*"Beginning with Java 16, inner classes may contain static members."*

**★ You inherit a codebase with fifty `@DynamicPropertySource` methods. What do you change?**
Delete the ones that register only connection properties for containers in Boot's catalogue,
replacing them with `@ServiceConnection` — that is a straight deletion and it also picks up Flyway
and Liquibase wiring for any `JdbcDatabaseContainer`. Convert the ones whose containers should be
`@Bean` methods into `DynamicPropertyRegistrar` beans. Leave everything else: computed values, your
own property names and unsupported services are what the annotation is for.

{/* FOOTER */}
