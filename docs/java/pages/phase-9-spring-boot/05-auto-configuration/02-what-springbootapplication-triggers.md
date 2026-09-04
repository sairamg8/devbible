---
title: "What @SpringBootApplication triggers"
sidebar_label: "2 · What @SpringBootApplication triggers"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot reference *Using Spring Boot ·
> Auto-configuration* and *Using Spring Boot · Structuring Your Code*
> (docs.spring.io/spring-boot/reference), *Creating Your Own Auto-configuration*
> (the `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
> path, `@AutoConfiguration` and its `before`/`after`/`beforeName`/`afterName`
> attributes, `@AutoConfigureOrder` and its ordering caveat), and the Spring
> Boot 4.0 Migration Guide (package relocations under the modularization).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**`@SpringBootApplication` is three annotations in a trench coat, and only one
of them is interesting. It expands to `@SpringBootConfiguration` +
`@ComponentScan` + `@EnableAutoConfiguration`, and the last of those does
something the other two never do: it imports configuration classes that you did
not write, from jars you did not open, listed in a text file inside those jars.
Auto-configuration is not magic and it is not reflection over your code — it is
a plain list of class names, read from the classpath, whose entries are ordinary
`@Configuration` classes guarded by conditions.**

## The three annotations

```java
@SpringBootApplication          // == the three below
public class InvoiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(InvoiceApplication.class, args);
    }
}
```

| Meta-annotation | What it does |
|---|---|
| `@SpringBootConfiguration` | A `@Configuration` with a marker identity. Boot's test slices search *upwards* from a test class for exactly one of these to find "the application", which is why there must be only one |
| `@ComponentScan` | Scans **the package of the annotated class and everything below it** for stereotypes. It does not scan the whole classpath |
| `@EnableAutoConfiguration` | The subject of this chunk: pull in configuration classes contributed by libraries on the classpath |

The `@ComponentScan` half is why the reference documentation is insistent about
putting your application class in a **root package above everything else**. Put
`InvoiceApplication` in `com.acme.invoice.web` and your `com.acme.invoice.domain`
services are simply never scanned — and the failure is a
`NoSuchBeanDefinitionException` at startup that says nothing about packages.

The reference is equally clear that you should have **only one**
`@SpringBootApplication` or `@EnableAutoConfiguration` in the application.

## How auto-configuration classes are found

Every jar that contributes auto-configuration ships one text file at an exact,
unforgiving path:

```
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

One fully-qualified class name per line, `#` for comments, `$` for a nested
class:

```
com.acme.libx.autoconfigure.LibXAutoConfiguration
com.acme.libx.autoconfigure.LibXWebAutoConfiguration
# disabled for now
# com.acme.libx.autoconfigure.LibXMetricsAutoConfiguration
com.acme.libx.autoconfigure.Outer$NestedAutoConfiguration
```

`@EnableAutoConfiguration` reads every copy of that file across the classpath
and imports the union. That is the whole discovery mechanism. There is no
scanning, no annotation index, no classpath walk — which is why it is fast, and
why a typo in that filename produces an auto-configuration that is simply never
loaded, with no error anywhere.

The documentation is explicit on the corollary: **auto-configurations must be
loaded only by being named in the imports file, and must never be picked up by
component scanning.** Put an `@AutoConfiguration` class inside your scanned
package tree and it loads twice, under two different sets of rules, and its
conditions evaluate at the wrong moment.

### ⚠️ This replaced `spring.factories`

Before Spring Boot 2.7, auto-configurations were registered under the
`EnableAutoConfiguration` key in `META-INF/spring.factories`. That mechanism was
deprecated in 2.7 and **removed in 3.0**. Any blog post, StackOverflow answer or
internal starter still using `spring.factories` for auto-configuration
registration is silently contributing nothing on Boot 3 or 4 — the file is read
for other Spring factory types, so there is no error, just an auto-configuration
that never runs. It is one of the quietest failures in the ecosystem.

## `@AutoConfiguration`, not `@Configuration`

An auto-configuration class is annotated `@AutoConfiguration`, which is itself
meta-annotated with `@Configuration` — so it *is* a configuration class, with a
distinct identity Boot can order and report on.

```java
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
public class LibXAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    LibXClient libXClient(DataSource dataSource) {
        return new LibXClient(dataSource);
    }
}
```

The ordering attributes read exactly as they are written, which is worth saying
out loud because it inverts on you if you read them quickly:

- `after = X.class` — X is configured **before** this one.
- `before = X.class` — X is configured **after** this one.
- `afterName` / `beforeName` — string forms, for when X may not be on the
  classpath and you cannot reference the class without risking a
  `NoClassDefFoundError`.

`@AutoConfigureOrder` exists for the case where two auto-configurations must be
ordered but should not know about each other; it has the same semantics as
`@Order`.

### 🔴 The ordering caveat everyone trips over

The reference states it plainly: the order in which auto-configuration classes
are applied **only affects the order in which their bean definitions are
registered**. The order in which those beans are actually *created* is
unaffected — that is decided by each bean's dependencies and by any `@DependsOn`
relationships.

So `@AutoConfiguration(after = …)` is a tool for making *conditions* evaluate in
the right order. It is not a tool for making one bean's constructor run before
another's. Reaching for it to fix an initialisation-order bug will not work, and
the correct instrument is an injected dependency or `@DependsOn`.

## User beans always win, and here is why

The rule people quote — "define your own bean and Boot backs off" — is not a
special case in the framework. It falls out of two facts stacked together:

1. **Auto-configuration classes are imported last**, after component scanning
   and after your own `@Configuration` classes have contributed their bean
   definitions.
2. Auto-configured beans are guarded by `@ConditionalOnMissingBean`, which is
   evaluated against *what has been registered so far*.

Because your definitions are already in the registry when the condition runs,
the condition sees them and the auto-configured bean backs off. The mechanism
is examined in [chunk 3](03-class-conditions.md); the point here is that its
correctness depends entirely on auto-configuration being **last**, which is
exactly what `@EnableAutoConfiguration` guarantees and what component scanning
an auto-configuration class would destroy.

## ⚠️ Boot 4 moved the auto-configuration classes

The modularization relocated auto-configuration classes into their feature
modules, which changes their **package names**. The reference now documents, for
example:

```java
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
```

where Boot 3 had `org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration`.
The pattern inverted: the feature name moved *before* `autoconfigure`. That
matters because auto-configuration class names appear in two places you must
maintain by hand — `@SpringBootApplication(exclude = …)` and the
`spring.autoconfigure.exclude` property — and one of those is a **string**, so
a stale value fails at startup rather than at compile time.

Two other relocations from the same migration are worth knowing because they
appear in application code: `BootstrapRegistry` moved to
`org.springframework.boot.bootstrap`, and `@EntityScan` to
`org.springframework.boot.persistence.autoconfigure`.

## Gotchas

**Symptom:** `NoSuchBeanDefinitionException` for a `@Service` that is obviously annotated and obviously compiled
**Cause:** the class sits outside the package tree of the `@SpringBootApplication` class, so `@ComponentScan` never reached it — the default scan root is the annotated class's own package and its descendants
**Fix:** move the application class up to a root package (`com.acme.invoice`) so everything is below it. Only if that is genuinely impossible, widen the scan explicitly:
```java
@SpringBootApplication(scanBasePackages = "com.acme")
```

**Symptom:** an internal starter contributes nothing — its beans never appear, and no error is logged
**Cause:** it registers its auto-configuration in `META-INF/spring.factories`, which was deprecated in Boot 2.7 and removed for this purpose in 3.0. The file is still read for other factory types, so nothing complains
**Fix:** move the class name into `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`, one per line. The path is exact — a single wrong character means silent non-loading

**Symptom:** an auto-configured bean is created even though the application defines its own, or the two fight over the same role
**Cause:** the `@AutoConfiguration` class lives inside the component-scanned package tree, so it is registered as an ordinary configuration class alongside user beans instead of last, and its `@ConditionalOnMissingBean` evaluates before the user bean exists
**Fix:** move it out of the scanned tree — the documented layout is a separate `…autoconfigure` package that is *only* reachable through the imports file

**Symptom:** you set `@AutoConfiguration(after = X.class)` to fix an initialisation-order problem and nothing changes
**Cause:** auto-configuration ordering affects only the order bean *definitions* are registered, not the order beans are *instantiated*, which is driven by dependencies
**Fix:** express the real dependency — inject the bean you need, or use `@DependsOn("thatBean")` when the coupling is genuinely a side-effect rather than a value

**Symptom:** after upgrading to Boot 4, startup fails on a `spring.autoconfigure.exclude` entry that used to be fine
**Cause:** the modularization renamed the auto-configuration packages — `org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration` became `org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration` — and the property holds a string, so nothing checked it at compile time
**Fix:** update the fully-qualified names. Prefer the typed form where the class is on the classpath, so the compiler catches the next rename:
```java
@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
```

**Symptom:** a `@WebMvcTest` or `@DataJpaTest` slice fails with a complaint about being unable to find a `@SpringBootConfiguration`
**Cause:** test slices search upwards from the test's package for exactly one `@SpringBootConfiguration`; the test sits outside the application class's package tree, or the project has more than one such class
**Fix:** mirror the main package structure in `src/test/java` so the search finds it, and keep exactly one `@SpringBootApplication` in the application

## Interview questions

**★ What does `@SpringBootApplication` expand to?**
`@SpringBootConfiguration`, `@ComponentScan` and `@EnableAutoConfiguration`.
The first marks the class as *the* application configuration — Boot's test
slices search upward for it, which is why there must be exactly one. The second
scans the annotated class's own package and everything beneath it, not the
whole classpath. The third is the one that does something you cannot do
yourself: it imports configuration classes contributed by libraries on the
classpath.

**★ How does Spring Boot discover auto-configuration classes?**
It reads every copy of `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
on the classpath — a plain text file, one fully-qualified class name per line,
`#` for comments — and imports the union. There is no scanning and no
annotation index, which is why startup is fast and why a typo in that path
produces an auto-configuration that is silently never loaded.

**★ What replaced `spring.factories`, and why does the old form fail so quietly?**
Registration under the `EnableAutoConfiguration` key in
`META-INF/spring.factories` was deprecated in Boot 2.7 and removed in 3.0, in
favour of the dedicated `AutoConfiguration.imports` file. It fails quietly
because `spring.factories` is still a valid file that Spring reads for other
factory types — so nothing is malformed, nothing errors, and the only symptom
is beans that never appear. It is the classic breakage in an internal starter
that has not been touched since Boot 2.

**★ Why must an auto-configuration class never be component-scanned?**
Because the entire back-off contract depends on auto-configuration being
processed *last*. `@ConditionalOnMissingBean` is evaluated against the bean
definitions registered so far; auto-configurations are imported after component
scanning and after user `@Configuration` classes, so by the time the condition
runs the user's bean is already there and the default backs off. Component-scan
an auto-configuration and it is registered alongside user beans instead, its
conditions evaluate too early, and you get a default that should have stepped
aside — or two beans competing for one role.

**★ `@AutoConfiguration(after = X.class)` — what exactly does it order?**
Only the order in which bean *definitions* are registered, which is what makes
conditions evaluate in a sensible sequence. The reference is explicit that the
order beans are subsequently *created* is unaffected and is determined by each
bean's dependencies and any `@DependsOn` relationships. So it is the right tool
for "my condition needs to see whether X already registered a bean" and the
wrong tool for "my bean's constructor must run after X's".

**★ Why does the reference insist the application class live in a root package?**
Because `@ComponentScan` with no attributes uses the annotated class's package
as the scan root and descends from there. If the application class sits in
`com.acme.invoice.web`, then `com.acme.invoice.domain` is not below it and is
never scanned — and the failure arrives as a `NoSuchBeanDefinitionException`
that names a bean type and says nothing at all about packages, which is why it
costs people an afternoon. Putting the class at `com.acme.invoice` makes the
whole application a descendant and the problem cannot occur.

**★ Boot 4 changed auto-configuration package names. Where does that actually bite?**
In the two places you name auto-configuration classes by hand: the `exclude`
attribute of `@SpringBootApplication`/`@EnableAutoConfiguration`, and the
`spring.autoconfigure.exclude` property. The annotation form is typed, so a
rename shows up as a compile error; the property form is a string, so it
survives the upgrade and fails at startup instead. Under the modularization the
feature segment moved ahead of `autoconfigure` — `…boot.autoconfigure.jdbc.
DataSourceAutoConfiguration` became `…boot.jdbc.autoconfigure.DataSourceAutoConfiguration`.

---

← Prev: [What a starter actually is](01-what-a-starter-is.md) · Index: [Boot auto-configuration](README.md) · Next → [Class conditions](03-class-conditions.md)
