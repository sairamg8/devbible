---
title: "Configuration classes and `@Bean`"
sidebar_label: "9 · Configuration classes"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *Java-based
> Container Configuration → Basic Concepts: `@Bean` and `@Configuration`* and
> *Using the `@Configuration` annotation*
> (docs.spring.io/spring-framework/reference/core/beans/java/ — full versus lite
> mode, `proxyBeanMethods`, CGLIB subclassing of `@Configuration` classes,
> inter-bean references, the restriction on `final` classes), and the Framework
> 7.0.8 Javadoc for `org.springframework.context.annotation.Configuration` and
> `Bean`. Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**`@Configuration` does something that looks impossible in Java: it makes
calling a method twice return the same object. A `@Bean` method called from
another `@Bean` method does not run a second time — it returns the singleton
the container already holds. Spring achieves this by generating a CGLIB
subclass of your configuration class and intercepting the calls, and the moment
you know that, three things follow that otherwise look arbitrary: why a
`@Configuration` class cannot be `final`, why `proxyBeanMethods = false` exists
and what it costs you, and why a `@Bean` method in a plain `@Component` behaves
completely differently from the identical method in a `@Configuration`.**

## Full mode: `@Configuration` with the proxy

```java
@Configuration                              // full mode: proxyBeanMethods = true
public class PersistenceConfig {

    @Bean
    DataSource dataSource() {
        return new HikariDataSource(hikariConfig());
    }

    @Bean
    OrderRepository orderRepository() {
        return new JdbcOrderRepository(dataSource());   // ← intercepted
    }

    HikariConfig hikariConfig() { /* ... */ return new HikariConfig(); }
}
```

`orderRepository()` calls `dataSource()` directly. In plain Java that
constructs a **second** `HikariDataSource` — a second connection pool, with the
first one still open and now shared by nobody. In full mode it does not: the
CGLIB subclass intercepts the call, sees the container already has a
`dataSource` singleton, and returns it.

The documentation calls this *"cross-method references get redirected to the
container's lifecycle management"*, and it is the whole reason `@Configuration`
exists as a distinct annotation.

## Lite mode: no proxy, no interception

You get lite mode two ways: a `@Bean` method on a class that is **not**
`@Configuration` (a `@Component`, say), or `@Configuration(proxyBeanMethods = false)`.

```java
@Configuration(proxyBeanMethods = false)    // lite mode: no CGLIB subclass
public class ClientConfig {

    @Bean
    ObjectMapper objectMapper() { return JsonMapper.builder().build(); }

    @Bean
    OrderClient orderClient(ObjectMapper mapper) {   // ✅ inject, don't call
        return new OrderClient(mapper);
    }
}
```

In lite mode the container does **not** subclass the class, so a direct call to
`objectMapper()` from another `@Bean` method would be an ordinary Java call and
would build a second mapper. The documentation is explicit that lite-mode
`@Bean` methods *"are not meant to declare inter-bean dependencies at all"* —
they are expected to receive collaborators as **method parameters**, which the
container resolves from the context.

That parameter form works in full mode too, and it is the better habit
regardless: it makes the dependency explicit and removes any question about
which mode you are in.

| | Full (`@Configuration`) | Lite (`proxyBeanMethods = false`, or `@Component`) |
|---|---|---|
| CGLIB subclass generated | ✅ | ❌ |
| Inter-bean method call returns the singleton | ✅ | ❌ — a new object every call |
| Class may be `final` | ❌ | ✅ |
| Startup cost and footprint | higher | lower |
| Native-image friendliness | worse | better |

## Why Spring Boot's own configurations use lite mode

Look at Spring Boot's auto-configuration classes and you will find
`proxyBeanMethods = false` almost everywhere. That is deliberate: with dozens
or hundreds of auto-configuration classes, avoiding a generated subclass for
each one measurably reduces startup time and memory, and it plays better with
AOT and GraalVM native images, where runtime subclass generation is exactly
what you are trying to eliminate.

The rule of thumb that follows: **if your `@Bean` methods never call each
other, set `proxyBeanMethods = false`.** You lose nothing and you skip the
proxy. If they do call each other, either keep full mode or — better — convert
the calls to parameters.

## The restrictions the proxy imposes

Because full mode works by subclassing:

- **The class must not be `final`.** CGLIB cannot subclass it.
- **`@Bean` methods must not be `private` or `final`.** They cannot be
  overridden, so they cannot be intercepted.
- **The class needs a constructor the subclass can call.** A single
  parameterised constructor is supported (its arguments are autowired); a
  `private` constructor is not.
- **`static` `@Bean` methods are not intercepted** — which is precisely why
  `BeanFactoryPostProcessor` beans should be declared `static`, as
  [chunk 3](03-the-two-phases.md) argued.

## Gotchas

### The second connection pool

**Symptom.** The application opens twice the configured number of database
connections, or a supposedly shared cache behaves as though there are two.

**Cause.** A `@Bean` method calling another `@Bean` method in a class that is
**not** in full mode — either a `@Component` with `@Bean` methods, or
`@Configuration(proxyBeanMethods = false)` added later "for startup time"
without checking whether the methods call each other.

**Fix.** Pass the dependency as a parameter, which is correct in both modes:

```java
@Configuration(proxyBeanMethods = false)
class PersistenceConfig {
    @Bean DataSource dataSource() { return new HikariDataSource(); }

    @Bean
    OrderRepository orderRepository(DataSource ds) {   // ✅ parameter, not a call
        return new JdbcOrderRepository(ds);
    }
}
```

### `@Bean` methods on a `@Component`

**Symptom.** A class annotated `@Component` declares `@Bean` methods, and one
of them returns a fresh instance every time it is called internally.

**Cause.** `@Bean` methods are honoured on any bean class, but only
`@Configuration` gets the proxy. On a `@Component` you are in lite mode without
having asked for it.

**Fix.** If the methods are independent, this is fine and cheap — but say so
explicitly by moving them to a `@Configuration(proxyBeanMethods = false)` class
so the next reader is not guessing which mode applies.

### Making a `@Configuration` class `final`

**Symptom.** Startup fails with a CGLIB error about being unable to subclass
the configuration class.

**Cause.** Full mode requires a subclass. Kotlin developers hit this constantly
because Kotlin classes are `final` by default.

**Fix.** Drop `final`, or switch that class to
`@Configuration(proxyBeanMethods = false)` if its `@Bean` methods do not call
each other — in which case no subclass is needed and `final` is fine.

### Expecting `@Bean` to override a scanned bean of the same name

**Symptom.** `BeanDefinitionOverrideException` at startup, naming a bean
declared both by a `@Bean` method and by a stereotype annotation.

**Cause.** Spring Boot sets `spring.main.allow-bean-definition-overriding` to
`false` by default — a deliberate change made in Boot 2.1 so that accidental
duplicate definitions fail loudly instead of one silently winning.

**Fix.** Do not declare the same bean twice. Where you genuinely need to
replace one — usually in tests — the modern tools are `@MockitoBean` and
`@MockitoSpyBean` (Boot 4 removed `@MockBean`/`@SpyBean`), or
`@TestConfiguration`. Turning the property on globally to silence the error
re-hides exactly what it was introduced to reveal.

### A `@Bean` method returning a concrete type when you needed the interface

**Symptom.** A `@Bean` method declared as returning `HikariDataSource` prevents
another auto-configuration from backing off, or a `@ConditionalOnMissingBean`
check behaves unexpectedly.

**Cause.** The `BeanDefinition`'s type comes from the **method's declared
return type**, not from what it actually returns. A narrower return type is a
narrower registration.

**Fix.** Declare the broadest type callers need — usually the interface:

```java
@Bean
DataSource dataSource(DataSourceProperties props) {   // ✅ DataSource, not HikariDataSource
    return props.initializeDataSourceBuilder().build();
}
```

## Interview questions

**★ What is the difference between full and lite `@Bean` mode?**
Full mode applies to `@Bean` methods in a `@Configuration` class with the
default `proxyBeanMethods = true`: Spring generates a CGLIB subclass and
intercepts inter-bean method calls, so calling one `@Bean` method from another
returns the container's existing singleton rather than constructing a new
object. Lite mode applies to `@Bean` methods on a non-`@Configuration` class or
when `proxyBeanMethods = false`: no subclass is generated, so an inter-bean
method call is an ordinary Java call that constructs a new instance every time.
The documentation is explicit that lite-mode `@Bean` methods are not intended to
declare inter-bean dependencies — they should take collaborators as method
parameters instead.

**★ What does `proxyBeanMethods = false` buy you, and when is it safe?**
It skips the CGLIB subclass, reducing startup time and memory footprint and
behaving much better under AOT processing and GraalVM native image compilation,
where runtime bytecode generation is what you are trying to avoid. It is safe
exactly when no `@Bean` method in that class calls another `@Bean` method
directly — which is why Spring Boot's own auto-configuration classes use it
almost universally. If methods do reference each other, either leave full mode
on or convert the calls into method parameters, which is the better fix because
it works identically in both modes.

**★ Why can a `@Configuration` class not be `final`, and why can its `@Bean` methods not be `private`?**
Because full mode is implemented by generating a CGLIB subclass and overriding
the `@Bean` methods to intercept calls. A `final` class cannot be subclassed and
a `final` or `private` method cannot be overridden, so neither can be
intercepted. Kotlin users meet the class restriction immediately because Kotlin
classes are `final` by default. The escape hatch is `proxyBeanMethods = false`:
with no subclass required, `final` becomes legal again — at the cost of losing
inter-bean call interception, which you should not have been relying on anyway.

**★ What actually happens when one `@Bean` method calls another in full mode?**
The call does not reach your method body on the second and subsequent
invocations. The CGLIB subclass overrides the method, and its implementation
asks the container for the bean by that name; if the singleton already exists it
is returned, and only if it does not does the original method body run to create
it. This is why a configuration class can express dependencies as ordinary
method calls and still produce exactly one `DataSource`. It is also the reason
the interception has to be a subclass rather than a wrapper — the calls it needs
to intercept originate inside the object itself, which no delegating wrapper
could see.

**★ Why does Spring Boot default `spring.main.allow-bean-definition-overriding` to false?**
Because silent overriding hid real bugs. Before Boot 2.1, two definitions with
the same bean name meant one quietly replaced the other, with the winner
depending on registration order — so a name collision introduced by a new
dependency could change behaviour with no signal at all. Failing fast with
`BeanDefinitionOverrideException` surfaces the duplicate at startup. Setting it
back to `true` to make an error go away restores exactly the silent behaviour
the default was introduced to eliminate; the right responses are to rename one
bean, remove the duplicate declaration, or — in tests — use `@MockitoBean`,
`@MockitoSpyBean` or `@TestConfiguration`.

**★ Why does the declared return type of a `@Bean` method matter?**
Because the resulting `BeanDefinition`'s type is taken from the method
signature, not from the runtime class of the object returned. Declaring
`HikariDataSource` rather than `DataSource` registers a narrower type, which
changes which injection points match it and — more subtly — how
`@ConditionalOnMissingBean` checks in auto-configuration evaluate, since they
match on type. The habit is to declare the broadest interface that callers
need. The mirror-image problem is declaring too broad a type when a
`FactoryBean` or generic type parameter carries information the container needs
for matching.

**★ When would you deliberately use a `@Bean` method instead of a stereotype, even for a class you own?**
When construction is not a simple `new` — a builder, values pulled from
`Environment`, an object that needs conditional wiring — because a constructor
annotation cannot express that. When you need several beans of the same type
configured differently, since a class can carry only one stereotype. When the
bean's type should be an interface the class does not obviously advertise. And
when you want the configuration for a subsystem visible in one file rather than
scattered across the classes it configures, which is a legitimate readability
argument for anything with more than a couple of moving parts.

---

← Prev: [Bean names and the cost of scanning](08-names-and-scanning-cost.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next topic → [Dependency injection](../03-dependency-injection/README.md)
