---
title: "Component scanning"
sidebar_label: "7 · Component scanning"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *Classpath
> Scanning and Managed Components*
> (docs.spring.io/spring-framework/reference/core/beans/classpath-scanning.html
> — `@ComponentScan` attributes and filter types, `AnnotationBeanNameGenerator`,
> `FullyQualifiedAnnotationBeanNameGenerator`, and the
> `FullyQualifiedConfigurationBeanNameGenerator` added in 7.0), the Spring Boot
> reference *Structuring Your Code* (the default-package warning and the
> `@SpringBootApplication` scan root), and spring-projects/spring-framework
> issue #30431 (`spring-context-indexer` deprecated in 6.1 in favour of AOT).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Component scanning has exactly one rule and it explains almost every problem
people have with it: `@ComponentScan` starts at the package of the class that
carries it and goes downwards, and nothing else is ever considered. Not sibling
packages, not the jars you depend on, not a package you named in a string that
an IDE refactor silently invalidated. Getting this one rule wrong produces both
of the classic failures — a bean that is annotated and still not found, and a
startup that mysteriously triples in time because the scan root was widened
until it swallowed the classpath.**

## How scanning finds them

```java
@SpringBootApplication          // = @SpringBootConfiguration + @EnableAutoConfiguration
public class OrderServiceApplication { }        //   + @ComponentScan
```

`@ComponentScan` with no attributes scans **the package of the annotated class
and everything below it**. That is the entire rule, and it produces the most
common beginner failure in Spring: a class in a sibling package is never found,
because it is not below the main class.

```
com.acme
 ├── OrderServiceApplication.java     ← scan root
 ├── order/          ✅ scanned
 ├── billing/        ✅ scanned
com.other
 └── shared/         ⛔ never scanned
```

Explicit control when you need it:

```java
@ComponentScan(
    basePackages = "com.acme",
    basePackageClasses = Marker.class,           // ✅ refactor-safe: a type, not a string
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE, classes = LegacyImporter.class))
```

Prefer `basePackageClasses` over `basePackages` — a string package name is not
updated when you rename a package, and the failure is a silently empty scan
that surfaces much later as a missing dependency somewhere unrelated. The
convention is an empty marker interface that exists only to be referenced:

```java
package com.acme.shared;
public interface SharedMarker {}          // ✅ the compiler keeps this honest
```

⚠️ **Never put classes in the default package.** The Boot documentation is
explicit: a class with no `package` declaration makes `@ComponentScan`,
`@ConfigurationPropertiesScan`, `@EntityScan` and `@SpringBootApplication` scan
*every class from every jar on the classpath*.

### Filters

`includeFilters` and `excludeFilters` take a `FilterType`:
`ANNOTATION`, `ASSIGNABLE_TYPE`, `ASPECTJ`, `REGEX` and `CUSTOM` (a
`TypeFilter` implementation). `useDefaultFilters = false` stops the stereotype
annotations being picked up at all, which is how you build a scan that finds
only your own custom annotation.

## Gotchas

### The bean outside the scan root

**Symptom.** `NoSuchBeanDefinitionException` for a class that is plainly
annotated `@Service`.

**Cause.** The class is not in or below the package of the
`@SpringBootApplication` class, so scanning never saw it. Common with shared
library modules that use a different root package.

**Fix.** Either move the main class up to a common parent package — the
Boot-recommended layout — or add the package explicitly:

```java
@SpringBootApplication
@ComponentScan(basePackageClasses = {OrderServiceApplication.class, SharedMarker.class})
public class OrderServiceApplication { }
```

Better still, have the library expose an auto-configuration rather than
expecting consumers to widen their scan.

### Widening the scan root to `com` or the default package

**Symptom.** Startup slows dramatically, or unrelated beans from third-party
jars appear in the context and start failing.

**Cause.** `@ComponentScan("com")` — or a main class in the default package —
scans every jar under that prefix. Third-party libraries contain annotated
classes that were never meant to be your beans.

**Fix.** Scan your own root only, and add specific extra packages by marker
class as above. This is one of the few Spring problems whose symptom is a
startup-time slowdown, so it is worth checking when startup regresses after a
dependency change.

### Expecting `@ComponentScan` to find a class from a jar without one

**Symptom.** A shared library's `@Service` classes are not registered even
after adding the dependency.

**Cause.** Scanning is driven by *your* configuration, not by the jar. A jar
does not opt itself in.

**Fix.** The library should register itself through auto-configuration —
an entry in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
— rather than relying on every consumer to widen a scan. That mechanism is
**[Topic 05 — Boot auto-configuration](../05-auto-configuration/README.md)**.

## Interview questions

**★ Where does `@SpringBootApplication` scan from, and what goes wrong when people get this wrong?**
From the package of the annotated class, downwards, because
`@SpringBootApplication` includes a `@ComponentScan` with no explicit base
packages. Anything in a sibling or unrelated package is never discovered, which
produces `NoSuchBeanDefinitionException` on a class that is visibly annotated —
the most common beginner failure in Spring. The recommended layout is therefore
to put the main class in a root package above everything else. The opposite
error is worse: a main class in the default package makes the scan cover every
class in every jar on the classpath, which the Boot documentation explicitly
warns against.

**★ How would you scan for only your own custom annotation and nothing else?**
Set `useDefaultFilters = false` to switch off detection of the built-in
stereotypes, then add an `includeFilters` entry of type
`FilterType.ANNOTATION` naming your annotation. The filter types available are
`ANNOTATION`, `ASSIGNABLE_TYPE`, `ASPECTJ`, `REGEX` and `CUSTOM` — the last
taking a `TypeFilter` implementation for anything the others cannot express.
This is how framework and library authors build a scan that picks up their own
marker without accidentally registering the application's beans.

**★ Why should you prefer `basePackageClasses` over `basePackages`?**
Because `basePackages` takes strings, and a string package name is not updated
by an IDE refactor. Rename or move a package and the scan silently stops
finding anything in it — there is no error, just missing beans at some later
injection point. `basePackageClasses` takes `Class` literals and uses each
one's package as a root, so the compiler and the refactoring tools keep it
correct. The convention is to create an empty marker interface in the package
you want to anchor, purely so it can be referenced safely.

**★ A shared library's `@Service` classes are not being picked up. What is the right fix?**
Not widening the consuming application's `@ComponentScan` — that couples every
consumer to the library's package layout and invites the accidental scanning of
unrelated jars. The library should register its own beans via
auto-configuration: an `@AutoConfiguration` class listed in
`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`,
guarded by `@ConditionalOnClass` and `@ConditionalOnMissingBean` so consumers
can override anything. That is exactly how every Spring Boot starter works, and
it keeps the library's internal packaging its own business.

---

← Prev: [The stereotype annotations](06-the-stereotypes.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Bean names and the cost of scanning](08-names-and-scanning-cost.md)
