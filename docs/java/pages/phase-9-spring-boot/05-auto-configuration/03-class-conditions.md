---
title: "Class conditions"
sidebar_label: "3 · Class conditions"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot reference *Creating Your Own
> Auto-configuration · Condition Annotations* (docs.spring.io/spring-boot/reference
> — the class, bean, property, resource, web-application, SpEL and platform
> condition families, and the nested-`@Configuration` pattern used in its own
> examples) and the `@ConditionalOnMissingClass` API javadoc (String class
> names). Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Auto-configuration would be unusable without conditions, because every
auto-configuration class in every jar on the classpath is imported — all of
them, always. What makes that survivable is that each is wrapped in a guard that
usually evaluates to false, and the outermost guard is nearly always a class
condition: "is this library even here?" It is answered without loading the class
it names, by reading byte-code rather than resolving types, and understanding
that trick explains an error message that otherwise makes no sense at all.**

## The families

| Family | Annotations | Asks |
|---|---|---|
| Class | `@ConditionalOnClass`, `@ConditionalOnMissingClass` | Is this type on the classpath? |
| Bean | `@ConditionalOnBean`, `@ConditionalOnMissingBean`, `@ConditionalOnSingleCandidate` | What is in the bean registry *so far*? |
| Property | `@ConditionalOnProperty`, `@ConditionalOnBooleanProperty` | What does the `Environment` say? |
| Resource | `@ConditionalOnResource` | Does this file or classpath resource exist? |
| Web | `@ConditionalOnWebApplication`, `@ConditionalOnNotWebApplication`, `@ConditionalOnWarDeployment`, `@ConditionalOnNotWarDeployment` | What kind of application is this? |
| SpEL | `@ConditionalOnExpression` | Whatever you want, evaluated as an expression |
| Platform | `@ConditionalOnJava`, `@ConditionalOnCloudPlatform`, `@ConditionalOnJndi`, `@ConditionalOnThreading` | What is the runtime? |

They divide by *what they interrogate*, and that division decides how they fail:

- **Class conditions** — this chunk — ask about the classpath, which is fixed at
  build time and visible in the dependency tree.
- **Bean conditions** — [chunk 4](04-bean-conditions-and-back-off.md) — ask
  about the registry as it stands *at that instant*, which makes ordering part
  of their semantics.
- **Everything else** — [chunk 6](06-property-and-environment-conditions.md) —
  asks about the environment, and fails silently from a typo nothing validates.

## `@ConditionalOnClass` and the trick that makes it possible

```java
@AutoConfiguration
@ConditionalOnClass(LibXClient.class)
public class LibXAutoConfiguration {
    // ...
}
```

There is something apparently impossible here: the annotation *references* a
class that may not be on the classpath, inside a class that is being loaded. If
`LibXClient` is absent, how does this class load at all?

It works because annotation values are stored in the class file as **metadata**,
and Spring reads them by parsing the byte-code with **ASM** rather than by
resolving the type through a classloader. The name `com.acme.libx.LibXClient` is
just a string in the constant pool until somebody asks the JVM to link it, and
evaluating the condition never does.

### Where the trick stops working

The guarantee holds only while the reference stays *inside the annotation*. The
moment the risky type appears in a **method signature, a field type, or a
superclass** on the same class, the JVM must resolve it, and you get
`NoClassDefFoundError` — thrown while trying to process the very class whose
condition was supposed to prevent this.

This is why the reference documentation's own examples put the conditional beans
in a **nested static `@Configuration` class**:

```java
@AutoConfiguration
public class LibXAutoConfiguration {

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(LibXClient.class)      // guard lives on the nested class
    static class LibXClientConfiguration {

        @Bean
        @ConditionalOnMissingBean
        LibXClient libXClient() {              // return type only resolved if this
            return new LibXClient();           // nested class is actually processed
        }
    }
}
```

The nesting is not stylistic and it is not organisation. It is the mechanism
that keeps the risky type reference behind the guard: the outer class mentions
`LibXClient` nowhere except in an annotation on the nested class, and the nested
class is only processed if that annotation matched.

### The rule of thumb

**A type you are conditional on must not appear in the signature of anything on
the same class.** If you need it in a `@Bean` method, that method belongs in a
nested class carrying the guard. If you need it in a field, the same. The
compiler will not warn you, because at compile time the library *is* on your
classpath — it is only absent in the consumer's application, which is precisely
where you will not be watching.

## `@ConditionalOnMissingClass` takes strings

The mirror image has a signature difference that catches everyone once:

```java
@ConditionalOnMissingClass("com.acme.libx.LibXClient")
```

It takes `String` class names, not class literals — for the obvious reason that
writing `LibXClient.class` would require the type you are asserting is absent.
The cost is that nothing checks the spelling, and a misspelled name is
indistinguishable from a genuinely missing class: the condition matches, and the
configuration you meant to suppress is applied.

## Why class conditions are the *outer* guard

Ordering the guards matters for a practical reason. A class condition is cheap —
a lookup against the classpath — and it is the coarsest possible filter: if the
library is not present, nothing inside is worth evaluating, and none of the
types inside can be safely referenced anyway. Bean and property conditions are
finer-grained decisions that only make sense once you know the library exists.

So the idiomatic shape is a class condition on the class or nested class, and
bean and property conditions on the individual `@Bean` methods within it. Every
Boot auto-configuration you open is built this way.

## The trade-off

Class conditions make "add a jar, get the feature" work, which is the single
most-loved property of Spring Boot. The price is that **your dependency graph is
now your configuration**. A transitive dependency you never chose can switch
behaviour on in your application, and the change arrives through a version bump
of something unrelated. That is the mechanism behind an entire genre of
upgrade surprises: nothing in your code changed, a library's transitive set did,
and a new auto-configuration matched.

It also means the Boot 4 modularization from
[chunk 1](01-what-a-starter-is.md) is not a packaging detail. Splitting the
umbrella starters changed which classes are on the classpath, which changed
which class conditions match — which is exactly why features silently vanish on
upgrade.

## Gotchas

**Symptom:** an auto-configuration class throws `NoClassDefFoundError` for the very type its `@ConditionalOnClass` was supposed to guard
**Cause:** the guarded type also appears in a `@Bean` method's return type or parameter on the same class. The annotation is read via ASM without loading the type, but a method signature must be resolved
**Fix:** move the beans into a nested static `@Configuration` and put the guard on that nested class, which is the shape the reference documentation uses:
```java
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(LibXClient.class)
static class LibXClientConfiguration { @Bean LibXClient client() { … } }
```

**Symptom:** a starter works perfectly in its own test suite and throws `NoClassDefFoundError` in the first consuming application
**Cause:** the optional library is a normal test dependency, so the guarded branch was never exercised without it — the compiler and the tests both had the type available
**Fix:** test the absent case explicitly with `FilteredClassLoader`, shown in [chunk 8](08-excluding-and-writing-your-own.md); until you do, the guard is unverified

**Symptom:** you try to write `@ConditionalOnMissingClass(SomeAbsent.class)` and it will not compile
**Cause:** `@ConditionalOnMissingClass` takes `String` class names, not class literals — you cannot write a literal for a type you are asserting is absent
**Fix:** use the fully-qualified name as a string:
```java
@ConditionalOnMissingClass("com.acme.libx.LibXClient")
```

**Symptom:** a `@ConditionalOnMissingClass` guard never suppresses anything, in any environment
**Cause:** the class name string is misspelled or stale after a package rename, so the class is always "missing" and the condition always matches. Nothing validates the string
**Fix:** keep these names in step with refactors deliberately — an IDE rename will not touch a string literal — and prefer `@ConditionalOnClass` with a literal wherever you can invert the logic to use it

**Symptom:** upgrading an unrelated library switches on a feature nobody enabled
**Cause:** the upgrade changed a transitive dependency, putting a new class on the classpath, and some auto-configuration's `@ConditionalOnClass` started matching
**Fix:** treat the dependency tree as configuration — review it on upgrades with `mvn dependency:tree`, as covered in [transitive dependencies and mediation](../../phase-8-build-dependencies/03-transitive-and-mediation/README.md) — and read the conditions report's positive matches after a major upgrade

**Symptom:** after moving to Boot 4, a feature that needed no configuration has silently stopped working
**Cause:** the modularization removed a jar from a starter's transitive set, so the class condition that used to match no longer does. Nothing errors, because a non-matching condition is the normal case
**Fix:** add the specific starter the feature now needs; `spring-boot-starter-validation` is the usual first casualty, and [chunk 1](01-what-a-starter-is.md) lists the rest

## Interview questions

**★ Why does auto-configuration need conditions at all?**
Because `@EnableAutoConfiguration` imports *every* auto-configuration class
named by *every* jar on the classpath — there is no filtering step before that.
Without guards, adding a library would unconditionally create its beans, and a
service with twenty dependencies would start with hundreds of beans nobody asked
for. Conditions turn that unconditional import into a set of questions about the
classpath, the environment and the bean registry, so the overwhelming majority
evaluate to false and contribute nothing at all.

**★ How can `@ConditionalOnClass` reference a class that is not on the classpath?**
Annotation values live in the class file as metadata, and Spring reads them by
parsing the byte-code with ASM rather than by resolving the referenced type
through a classloader — so the type is never loaded to evaluate the condition.
The class name is only a string in the constant pool until something asks the
JVM to link it, and condition evaluation never does.

**★ Where does that trick stop working, and what is the documented workaround?**
At the annotation boundary. If the guarded type appears in a `@Bean` method's
return type or parameters, in a field type, or in a superclass on the same
class, the JVM must resolve it and you get `NoClassDefFoundError` — thrown while
processing the class whose condition was meant to prevent exactly this. The
documented workaround, used throughout Boot's own auto-configurations, is to put
those beans in a nested static `@Configuration` class and hang the
`@ConditionalOnClass` on the nested class, so the risky reference sits behind
the guard.

**★ Why does `@ConditionalOnMissingClass` take strings when `@ConditionalOnClass` takes class literals?**
Because a class literal requires the type to be resolvable, and the whole point
of `@ConditionalOnMissingClass` is to assert that it is not there. A literal
would be self-defeating. The consequence is that the name is an unvalidated
string: misspell it or leave it stale after a package rename and the class is
always "missing", so the condition always matches and never suppresses anything
— a failure with no symptom until someone notices the wrong configuration is
active.

**★ Why are class conditions usually the outermost guard?**
Because they are the coarsest and cheapest filter, and because of the resolution
problem. If the library is not on the classpath there is nothing inside worth
evaluating, and none of the types inside could be referenced safely anyway.
Bean and property conditions are finer decisions that only become meaningful
once the library is known to exist, so the idiomatic shape is a class condition
on the (possibly nested) configuration class and bean or property conditions on
the individual `@Bean` methods.

**★ What does "the dependency graph is your configuration" mean in practice?**
That a transitive dependency you never chose can change your application's
behaviour, because class conditions make the presence of a type the trigger for
wiring. Bump an unrelated library, inherit a new transitive jar, and an
auto-configuration somewhere starts matching — with no change in your own code
and nothing in the diff to point at. It is the mechanism behind a whole genre of
upgrade surprises, and the reason reviewing `mvn dependency:tree` on major
upgrades is a real practice rather than pedantry.

**★ Why did Boot 4's modularization break working applications?**
Because splitting the umbrella starters changed which jars arrive transitively,
which changed which classes are on the classpath, which changed which class
conditions match. Nothing errors when a condition stops matching — that is the
normal case for hundreds of conditions on every startup — so the feature simply
is not there. `@Valid` silently doing nothing because no Bean Validation
provider arrives with `spring-boot-starter-webmvc` any more is the canonical
example.

---

← Prev: [What `@SpringBootApplication` triggers](02-what-springbootapplication-triggers.md) · Index: [Boot auto-configuration](README.md) · Next → [The back-off contract](04-bean-conditions-and-back-off.md)
