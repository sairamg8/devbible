---
title: "Excluding it and writing your own"
sidebar_label: "8 · Excluding it and writing your own"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot reference *Using Spring Boot ·
> Auto-configuration* (`exclude`, `excludeName`, the
> `spring.autoconfigure.exclude` property, and the "gradually replace
> auto-configuration" guidance) and *Creating Your Own Auto-configuration* (the
> `…autoconfigure` package separation, `@AutoConfiguration`, the
> `AutoConfiguration.imports` registration file, `ApplicationContextRunner`,
> `WebApplicationContextRunner`, `ReactiveWebApplicationContextRunner`,
> `FilteredClassLoader`, and the native-image limitation), plus the Spring Boot
> 4.0 Migration Guide for the auto-configuration package relocations.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**There are two ways to change what auto-configuration does, and choosing wrong
is the most common self-inflicted wound in a Boot codebase. Defining your own
bean removes exactly one thing, because `@ConditionalOnMissingBean` is designed
for it. Excluding an auto-configuration class removes everything that class
contributes — and it typically contributes five or six beans that are wired to
each other. The reference's own word for the recommended route is "gradually
replace"; exclusion is the blunt instrument you reach for only when the whole
class should never run.**

## Turning auto-configuration off

Three mechanisms, and the choice matters more than it looks.

**Typed, on the annotation** — the compiler checks it:

```java
@SpringBootApplication(exclude = { DataSourceAutoConfiguration.class })
public class InvoiceApplication { … }
```

**By name, when the class is not on the classpath** — you cannot write a class
literal for something absent:

```java
@SpringBootApplication(
    excludeName = "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration")
```

**By property, when the decision genuinely varies per environment:**

```properties
spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration
```

Both `exclude` and `excludeName` are available on `@EnableAutoConfiguration` as
well, and the reference notes you can define exclusions at the annotation level
and through the property at the same time.

⚠️ **Prefer the typed form.** As
[chunk 2](02-what-springbootapplication-triggers.md) showed, Boot 4's
modularization renamed these packages. A typed exclusion becomes a compile
error; a string one becomes a startup failure, in whichever environment happens
to set it.

## Why exclusion is usually the wrong answer

The reference frames auto-configuration as non-invasive and tells you to replace
parts of it by defining your own beans — the back-off contract from
[chunk 4](04-bean-conditions-and-back-off.md) exists precisely to make that work.

Exclusion is the right call in one shape of situation: the auto-configuration
should not run **at all**. A service with a JDBC driver on the classpath because
a library needs it, but which manages no `DataSource` of its own, genuinely
wants `DataSourceAutoConfiguration` gone — otherwise Boot fails at startup
demanding a URL for a database the service does not have.

## Writing your own

The shape of an internal starter, for a shared client library:

```java
package com.acme.libx.autoconfigure;      // NOT under any app's scanned packages

@AutoConfiguration
@ConditionalOnClass(LibXClient.class)
@EnableConfigurationProperties(LibXProperties.class)
public class LibXAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean                          // back off if they defined one
    @ConditionalOnProperty(prefix = "acme.libx", name = "enabled", matchIfMissing = true)
    LibXClient libXClient(LibXProperties properties) {
        return new LibXClient(properties.url(), properties.timeout());
    }
}
```

with one line in
`src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`:

```
com.acme.libx.autoconfigure.LibXAutoConfiguration
```

Four rules, all of them earned earlier in this topic:

1. **Separate the library from its auto-configuration.** `com.acme.libx` holds
   the client; `com.acme.libx.autoconfigure` holds the wiring. Consumers who
   want manual control depend on the first and exclude the second.
2. **Never let it be component-scanned** — the back-off contract depends on it
   loading last.
3. **Guard on the class**, so the auto-configuration is inert for anyone who
   receives the starter transitively but does not use the feature.
4. **Bind configuration through `@ConfigurationProperties`**, not `@Value`, so
   it is typed and validatable — **Phase 9 topic 06 — Configuration and
   profiles** *(not written yet)*.

### Publishing it

The artifact is an ordinary jar. If you also publish a `-starter` POM alongside
it, follow the naming convention from
[chunk 1](01-what-a-starter-is.md): `acme-libx-spring-boot-starter`, never
`spring-boot-starter-libx`, because that prefix is reserved for artifacts the
Spring team publishes.

## Testing it without starting an application

`ApplicationContextRunner` builds a context in-process from a defined set of
auto-configurations, so every conditional branch becomes testable. This is the
tool that makes conditional wiring verifiable at all:

```java
private final ApplicationContextRunner runner = new ApplicationContextRunner()
    .withConfiguration(AutoConfigurations.of(LibXAutoConfiguration.class));

@Test
void createsClientByDefault() {
    runner.run(context -> assertThat(context).hasSingleBean(LibXClient.class));
}

@Test
void backsOffWhenUserDefinesOwn() {
    runner.withUserConfiguration(UserConfiguration.class)
          .run(context -> assertThat(context).getBean(LibXClient.class)
                                             .isSameAs(context.getBean("myClient")));
}

@Test
void respectsTheDisableFlag() {
    runner.withPropertyValues("acme.libx.enabled=false")
          .run(context -> assertThat(context).doesNotHaveBean(LibXClient.class));
}

@Test
void backsOffWhenLibraryIsAbsent() {
    runner.withClassLoader(new FilteredClassLoader(LibXClient.class))
          .run(context -> assertThat(context).doesNotHaveBean(LibXClient.class));
}
```

`FilteredClassLoader` is the piece worth remembering: it simulates a missing
library so the `@ConditionalOnClass` branch is reachable without a second Maven
module. `WebApplicationContextRunner` and `ReactiveWebApplicationContextRunner`
are the web-context variants.

⚠️ The reference notes `ApplicationContextRunner` does **not** work when running
tests in a native image.

## The trade-off

Shipping an auto-configuration means shipping behaviour that activates without
anyone asking for it. That is a real gift to twenty teams who would otherwise
each write the same four beans — and a real hazard, because a consumer who
inherits your starter transitively gets your wiring with no line in their code
to grep for. The mitigation is discipline about guards: a class condition so it
stays inert without the library, `@ConditionalOnMissingBean` so it never fights
a deliberate choice, and a property so it can be switched off without an
exclusion.

## Gotchas

**Symptom:** a `spring.autoconfigure.exclude` entry that worked on Boot 3 fails at startup on Boot 4
**Cause:** the property holds a fully-qualified class name as a string, and the modularization moved auto-configuration classes into feature-module packages, so the name no longer resolves
**Fix:** update the name and move the exclusion to the typed form where the class is on the classpath, so the next rename is a compile error:
```java
@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
```

**Symptom:** excluding an auto-configuration to get rid of one bean breaks half a dozen unrelated things
**Cause:** an auto-configuration class usually contributes several interdependent beans; excluding it removes all of them, not the one that was in the way
**Fix:** define your own bean of the offending type and let `@ConditionalOnMissingBean` back the default off — the documented "gradually replace" route — and keep exclusion for classes that should not run at all

**Symptom:** an internal starter works in the module that owns it and does nothing in consuming applications
**Cause:** its `@AutoConfiguration` class sits inside a package the owning application component-scans, so locally it was picked up as an ordinary configuration class rather than through the imports file
**Fix:** move it to a dedicated `…autoconfigure` package outside any scanned tree and register it in the imports file — that is the only supported loading route, and the local success was an accident

**Symptom:** the `@ConditionalOnClass` branch of a starter has never been tested, because writing a test without the library on the classpath seemed impossible
**Cause:** the test module has the library as a normal dependency, so the guarded branch is unreachable from there
**Fix:** simulate the absence in-process instead of restructuring the build:
```java
runner.withClassLoader(new FilteredClassLoader(LibXClient.class))
      .run(context -> assertThat(context).doesNotHaveBean(LibXClient.class));
```

**Symptom:** a service that does not use a database fails at startup demanding a datasource URL
**Cause:** a library brought a JDBC driver onto the classpath, `@ConditionalOnClass` matched, and `DataSourceAutoConfiguration` tried to build a data source with nothing to configure it from
**Fix:** this is the legitimate exclusion case — the auto-configuration should not run at all:
```java
@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
```

**Symptom:** consuming applications cannot switch a starter's feature off without excluding the whole auto-configuration
**Cause:** the beans were guarded only by `@ConditionalOnClass` and `@ConditionalOnMissingBean`, so the only lever available is exclusion
**Fix:** add a property condition when you author the starter, so there is an in-band off switch:
```java
@ConditionalOnProperty(prefix = "acme.libx", name = "enabled", matchIfMissing = true)
```

**Symptom:** auto-configuration tests pass on the JVM and fail when the project moves to a native image
**Cause:** `ApplicationContextRunner` is documented as not working under native-image test execution
**Fix:** keep the conditional-wiring tests on the JVM and cover the native build with an integration test that starts the real application; do not try to make the runner work there

## Interview questions

**★ Three ways exist to exclude an auto-configuration. Which do you choose?**
`exclude` on `@SpringBootApplication` or `@EnableAutoConfiguration` when the
class is on the classpath, because it is typed and a rename becomes a compile
error. `excludeName` when the class is not on the classpath and no literal can
be written. The `spring.autoconfigure.exclude` property when the decision
genuinely varies per environment. Prefer the typed form wherever possible —
Boot 4's modularization renamed these packages, and the string forms fail at
startup in whichever environment set them rather than at build time.

**★ Why is excluding an auto-configuration usually the wrong fix?**
Because an auto-configuration class typically contributes several beans wired to
each other, and exclusion removes all of them — so "I did not want that
`DataSource`" turns into a missing transaction manager and a missing
`JdbcTemplate` as well. The documented route is to gradually replace
auto-configuration by defining your own bean and letting `@ConditionalOnMissingBean`
step the default aside, which removes exactly one thing and leaves the rest of
the wiring intact.

**★ When *is* exclusion the right answer?**
When the auto-configuration should not run at all, rather than run differently.
The canonical case is a service that has a JDBC driver on the classpath because
some library needs it but manages no data source of its own: `@ConditionalOnClass`
matches, `DataSourceAutoConfiguration` tries to build a data source, and startup
fails demanding a URL for a database that does not exist. There is no bean you
could define that expresses "do nothing here", so excluding the class is the
correct instrument.

**★ Walk me through building an internal starter.**
Put the library in one package and its wiring in a separate `…autoconfigure`
package that no application will component-scan. Annotate the wiring class
`@AutoConfiguration`, guard it with `@ConditionalOnClass` on a type from the
library so it stays inert for consumers who do not use the feature, bind
settings through an `@ConfigurationProperties` class enabled with
`@EnableConfigurationProperties`, mark each `@Bean` `@ConditionalOnMissingBean`
so applications can override, and add a property condition with
`matchIfMissing = true` so it can be switched off without an exclusion. Then
register the class — one line, fully-qualified — in
`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`,
which is the only supported way for it to load.

**★ Why does the reference insist on a separate `…autoconfigure` package?**
Two reasons that both bite in practice. It keeps the auto-configuration outside
any application's component-scan tree, which is what preserves the guarantee
that it loads last and therefore that `@ConditionalOnMissingBean` means what it
says. And it separates the two artifacts conceptually, so a consumer who wants
to wire the library by hand can depend on the library package and exclude the
wiring, instead of being forced to take both together.

**★ How do you test an auto-configuration?**
With `ApplicationContextRunner`, which builds a context in-process from a chosen
set of auto-configurations, so each conditional branch gets a test without
starting an application. `withPropertyValues(...)` exercises property
conditions, `withUserConfiguration(...)` proves the back-off contract by
asserting the user's bean is the one in the context, and `FilteredClassLoader`
simulates a missing library to reach the `@ConditionalOnClass` branch that is
otherwise unreachable from a module which depends on it.
`WebApplicationContextRunner` and `ReactiveWebApplicationContextRunner` cover
web contexts. The documented limitation is that it does not work inside a native
image.

**★ What responsibility do you take on by shipping an auto-configuration?**
You are shipping behaviour that activates in someone else's application without
a line of their code requesting it — possibly in an application that received
your starter transitively and does not know it exists. That makes the guards
part of the contract rather than an implementation detail: a class condition so
nothing happens without the library, `@ConditionalOnMissingBean` so a deliberate
choice always wins, and a property so the feature can be disabled without
resorting to excluding the whole class.

---

← Prev: [The conditions report](07-the-conditions-report.md) · Index: [Boot auto-configuration](README.md)
