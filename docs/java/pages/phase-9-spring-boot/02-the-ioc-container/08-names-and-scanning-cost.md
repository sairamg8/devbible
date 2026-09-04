---
title: "Bean names and the cost of scanning"
sidebar_label: "8 · Names and scanning cost"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *Classpath
> Scanning and Managed Components → Naming Autodetected Components*
> (docs.spring.io/spring-framework/reference/core/beans/classpath-scanning.html
> — `AnnotationBeanNameGenerator`, `FullyQualifiedAnnotationBeanNameGenerator`,
> and the `FullyQualifiedConfigurationBeanNameGenerator` added in 7.0),
> spring-projects/spring-framework issue #30431 (`spring-context-indexer`
> deprecated in 6.1 in favour of AOT), and the Framework 7.0.9 Javadoc
> deprecation list for `org.springframework.context.index`.
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Every bean has a name whether you chose one or not, and that name is part of
your application's contract in ways that are easy to miss — it is what
`@Qualifier` matches, what keys a `Map` injection, and what a
`ConflictingBeanDefinitionException` is complaining about. Meanwhile the
scanning that produces those names is the largest single component of Spring's
startup cost, and the tool Spring once shipped to remove it has been deprecated
for two major versions in favour of something entirely different. Both halves
of this chunk are about consequences of scanning that only show up later —
at a rename, or at a cold start.**

## Bean names

`AnnotationBeanNameGenerator` is the default. It uses the annotation's `value`
if you gave one, otherwise the **uncapitalised simple class name** —
`JdbcOrderRepository` becomes `jdbcOrderRepository`. Two classes with the same
simple name in different packages therefore collide, which is what
`FullyQualifiedAnnotationBeanNameGenerator` exists to solve. **Spring Framework
7.0 added `FullyQualifiedConfigurationBeanNameGenerator`** for the equivalent
problem with `@Bean` methods in `@Configuration` classes.

```java
@ComponentScan(basePackageClasses = Marker.class,
               nameGenerator = FullyQualifiedAnnotationBeanNameGenerator.class)
```

Bean names matter more than they look. They are what `@Qualifier` matches, what
keys a `Map<String, T>` injection, and what appears in a
`ConflictingBeanDefinitionException` — so a codebase that lets the default
generator produce collisions is one refactor away from a startup failure.

⚠️ **Convention-based attribute naming in custom stereotypes is deprecated.**
Since Framework 6.1 a custom stereotype should declare its alias explicitly:

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Component
public @interface DomainService {
    @AliasFor(annotation = Component.class, attribute = "value")   // ✅ explicit
    String name() default "";
}
```

## Scanning's cost — and why the indexer is not the answer any more

Scanning reads class metadata for every candidate on the classpath at startup.
For a large application that is measurable, and Spring once shipped
`spring-context-indexer`, an annotation processor generating a build-time
`META-INF/spring.components` index.

🔴 **Do not reach for it. `CandidateComponentsIndex`, its loader and the
indexer were deprecated in Spring Framework 6.1** (issue #30431) in favour of
the AOT engine. The indexer had a fatal design flaw: it was an all-or-nothing
switch — once any `spring.components` file was present, every jar had to have
been processed with the tool or its beans were simply not found. Spring 6's AOT
processing covers the same ground far more broadly, and is what a GraalVM
native image uses.

The modern answers to slow startup are: keep the scan root tight, use AOT
processing, and build a native image if startup genuinely dominates.

## Gotchas

### Two classes with the same simple name

**Symptom.** `ConflictingBeanDefinitionException` at startup, naming two classes
in different packages.

**Cause.** The default name generator uses the uncapitalised *simple* class
name, so `com.acme.order.Validator` and `com.acme.billing.Validator` both want
`validator`.

**Fix.** Name one explicitly, which is clearer than changing the global
generator:

```java
@Component("orderValidator")            // ✅ explicit, local, obvious
public class Validator { /* ... */ }
```

Switching the whole application to
`FullyQualifiedAnnotationBeanNameGenerator` also works and is appropriate when
the collision is systemic rather than accidental.

### A `@Qualifier` that silently stops matching after a class rename

**Symptom.** After renaming a class, an injection point that used
`@Qualifier("emailNotifier")` fails with "no qualifying bean" — or worse, binds
to a different implementation.

**Cause.** The qualifier was matching the *generated* bean name, which came
from the old class name. Renaming the class renamed the bean, and no compiler
checks a string.

**Fix.** Either name the bean explicitly so it does not track the class name,
or use a typed qualifier annotation, which the compiler does check:

```java
@Qualifier                                     // ✅ a real annotation, not a string
@Retention(RetentionPolicy.RUNTIME)
public @interface Email {}

@Component @Email
class EmailNotifier implements Notifier {}

@Service
class Alerts {
    Alerts(@Email Notifier notifier) { /* ✅ rename-safe */ }
}
```

### Adding `spring-context-indexer` to speed up startup

**Symptom.** After adding the indexer, some beans from a dependency are no
longer found, with no error from the indexer itself.

**Cause.** The index is all-or-nothing: once any `META-INF/spring.components`
file is on the classpath, Spring uses index lookups, and every jar that was not
processed by the indexer contributes nothing. It is also deprecated as of
Framework 6.1.

**Fix.** Remove it. Use Spring's AOT processing instead, which is the supported
successor and is what a native image build already runs:

```xml
<plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>
  <executions>
    <execution><goals><goal>process-aot</goal></goals></execution>   <!-- ✅ -->
  </executions>
</plugin>
```

## Interview questions

**★ How are bean names generated, and when does that bite?**
`AnnotationBeanNameGenerator` uses the value supplied on the stereotype if
there is one, otherwise the uncapitalised simple class name — so
`JdbcOrderRepository` becomes `jdbcOrderRepository`. It bites when two classes
in different packages share a simple name, producing a
`ConflictingBeanDefinitionException` at startup. The local fix is to name one
explicitly in its annotation; the systemic fix is
`FullyQualifiedAnnotationBeanNameGenerator`, and Framework 7.0 added
`FullyQualifiedConfigurationBeanNameGenerator` for the same collision among
`@Bean` methods in configuration classes.

**★ Why do bean names matter beyond appearing in error messages?**
Because several mechanisms key off them. `@Qualifier("orderValidator")` matches
by bean name when no custom qualifier annotation is present; injecting a
`Map<String, Handler>` gives you every implementation keyed by bean name, which
is a common dispatch pattern; and `@DependsOn` names beans as strings. A name
generated implicitly from a class name is therefore part of your application's
contract in a way that is easy to miss — renaming a class can break a
`@Qualifier` or change a map key, with no compiler help. Naming beans
explicitly wherever they are referenced by name avoids that.
**★ What is the cost of component scanning, and what is the current answer to it?**
Scanning reads class-level metadata for every candidate on the classpath during
phase one of startup, which is measurable on large applications and matters
most for short-lived processes. Spring's old answer,
`spring-context-indexer`, generated a build-time `META-INF/spring.components`
index — but it was **deprecated in Framework 6.1** in favour of AOT, because it
behaved as an all-or-nothing switch: once any index file was present, every jar
had to have been processed or its beans went missing. The current answers are
to keep the scan root tight, use Spring's AOT processing to move the work to
build time, and compile a GraalVM native image where startup genuinely
dominates.

**★ What is the difference between qualifying by bean name and by a custom qualifier annotation?**
`@Qualifier("someName")` matches the bean's name, which for a scanned component
is usually derived from its class name — so it is a string the compiler never
checks, and a class rename breaks it silently. A custom qualifier is an
annotation meta-annotated with `@Qualifier` (`@Email`, `@Primary`-style marker
types) applied both to the bean and to the injection point; the compiler
verifies the annotation exists and refactoring tools track it. For anything
beyond a one-off, the typed qualifier is the better tool, and it also documents
intent at the injection point better than a string does.

**★ Why is AOT processing a better answer than the component indexer was?**
The indexer solved one narrow problem — the cost of reading class metadata
during scanning — with a mechanism that failed unsafely: the index was
all-or-nothing across the whole classpath, so a single unprocessed jar meant
missing beans with no diagnostic. AOT processing instead evaluates the
configuration at *build* time — running the definition phase, resolving
conditions, and emitting generated Java source that registers the beans
directly — so it removes reflection and condition evaluation as well as
scanning, and it degrades safely because anything it cannot handle still works
at runtime. It is also the prerequisite for GraalVM native images, which is
where the startup cost actually matters.

---

← Prev: [Component scanning](07-component-scanning.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Configuration classes and `@Bean`](09-configuration-classes.md)
