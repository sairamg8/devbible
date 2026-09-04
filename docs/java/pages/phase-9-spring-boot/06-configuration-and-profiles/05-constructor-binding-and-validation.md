---
title: "Constructor binding and records"
sidebar_label: "5 · Constructor binding and records"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration · Type-safe Configuration Properties* (docs.spring.io/spring-boot/reference
> — JavaBean properties binding, constructor binding, the three documented
> opt-outs, the `@ConstructorBinding` rule for multiple constructors, the
> `-parameters` requirement, and records). Spring Boot 4.1.1, Spring
> Framework 7.0.x, JDK 25.

**Configuration is a value, not a mutable component, and the binder will treat
it as one if you let it. Give a `@ConfigurationProperties` type a single
parameterised constructor — or make it a record — and Spring populates it
through that constructor, once, at startup, with `final` fields and no setters
for anything else to call. The rules for when this happens are mechanical and
worth memorising, because the commonest failure in this area is a class that
looks immutable, silently falls back to JavaBean binding, and comes out with
every field null.**

## The two binding modes

The binder has exactly two ways to populate a configuration object, and it picks
between them by looking at the constructors.

**JavaBean binding** — the original mode. A no-argument constructor, and a
getter/setter pair per property:

```java
@ConfigurationProperties("my.service")
public class MyProperties {

    private boolean enabled;
    private InetAddress remoteAddress;
    private final Security security = new Security();

    public boolean isEnabled() { return this.enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public InetAddress getRemoteAddress() { return this.remoteAddress; }
    public void setRemoteAddress(InetAddress a) { this.remoteAddress = a; }

    public Security getSecurity() { return this.security; }   // no setter needed

    public static class Security {
        private String username;
        private List<String> roles = new ArrayList<>(List.of("USER"));
        // getters and setters
    }
}
```

Three rules govern it:

- **A default empty constructor is required**, and getters and setters are
  mandatory — *except* for pre-initialised nested objects and collections, which
  need only a getter, because the binder mutates the instance you supplied
  rather than replacing it.
- **A nested POJO that is not pre-initialised needs a setter**, so the binder
  can create it through its default constructor and hand it back.
- **Static properties are not bound.** Only standard Java Bean properties are
  considered.

**Constructor binding** — the mode to prefer:

```java
@ConfigurationProperties("my.service")
public class MyProperties {

    private final boolean enabled;
    private final InetAddress remoteAddress;
    private final Security security;

    public MyProperties(boolean enabled, InetAddress remoteAddress, Security security) {
        this.enabled = enabled;
        this.remoteAddress = remoteAddress;
        this.security = security;
    }
    // getters only
}
```

## The rule that decides which one you get

**The presence of a single parameterised constructor implies constructor
binding.** There is no annotation to switch it on and no property to set — the
shape of the class is the switch.

Which means the three documented ways to *opt out* are the things to watch for,
because each of them silently sends you back to JavaBean binding:

- annotating the parameterised constructor with `@Autowired`,
- making that constructor `private`,
- in Kotlin, declaring an empty primary constructor.

And when a class has **more than one** constructor, the binder cannot guess.
`@ConstructorBinding` on the constructor you want resolves it:

```java
@ConfigurationProperties("my.service")
public class MyProperties {

    private final String host;
    private final int port;

    @ConstructorBinding
    public MyProperties(String host, int port) {
        this.host = host;
        this.port = port;
    }

    public MyProperties(String host) {          // convenience constructor
        this(host, 8080);
    }
}
```

⚠️ **`@ConstructorBinding` goes on the constructor, not on the type.** It moved
there in Boot 3.0 and the type-level form no longer applies; an older sample
that annotates the class will not compile against the current annotation.

## Where constructor binding is not available

This is the restriction that produces the most confusing failures, so state it
plainly: **a constructor-bound type must be registered through
`@EnableConfigurationProperties` or `@ConfigurationPropertiesScan`.** It cannot
be created through `@Component`, `@Bean` or `@Import`.

The reason is ordinary Spring semantics. Those three routes make the container
responsible for constructing the object, and the container constructs beans by
*dependency injection* — it will try to find beans matching `String host` and
`int port` and fail. Constructor binding needs the `Binder` to be the thing
calling the constructor, and that only happens on the two registration paths
that exist for configuration properties. Registration is
[chunk 7](07-registering-and-structuring.md); the symptom to recognise here is a
`@Component`-annotated record whose components are all null or whose startup
fails asking for a `String` bean.

## The `-parameters` requirement

Constructor binding maps *property names* onto *parameter names*, and parameter
names only survive compilation if `javac` is given `-parameters`. Without it the
parameters are called `arg0`, `arg1` and nothing binds.

You almost certainly already have it: **`spring-boot-starter-parent` and the
Spring Boot Gradle plugin both add the flag.** The case where it bites is a
hand-rolled build, or a module that inherits neither — and the failure looks
like binding simply not happening, with no message pointing at the compiler.

## Records

A record is the shape constructor binding was waiting for: a single canonical
constructor, final components, no setters, and the accessors already written.

```java
@ConfigurationProperties("my.service")
public record MyProperties(boolean enabled, InetAddress remoteAddress, Security security) {

    public record Security(String username, String password, List<String> roles) {}
}
```

No `@ConstructorBinding` is needed — the record has one constructor, so the rule
above already applies. It is needed only if you have declared additional
constructors on the record.

**Nested members of a constructor-bound type are themselves bound through their
constructors**, which is why the nested `Security` record above works with no
extra annotation and no pre-initialisation.

## Immutability means no rebind

A constructor-bound object is created once and never mutated, so **changing a
property at runtime cannot change it.** With JavaBean binding, something holding
a reference to the properties object could in principle see a setter called
underneath it; with constructor binding it cannot.

That is a feature almost everywhere. A component that read `timeout` at startup
and one that reads it per call now agree, which they did not before. The cost is
real if you genuinely wanted dynamic reconfiguration — that needs a mechanism
built for it (Spring Cloud's refresh scope, or your own re-read from a source),
not a mutable properties bean that happens to be re-bindable by accident.

## The trade-off

Constructor binding gives you a configuration object with the same guarantees as
any other well-written value type: `final` fields, no partially-constructed
state, safe publication across the request threads that all share the singleton,
and a compiler error rather than a null when you add a required setting.

What you give up is any ability to poke at it after startup, and a little
ceremony in the two places the binder is fussy — the registration route and
`-parameters`. Both are one-time costs paid per project rather than per class,
which is what makes the trade so lopsided in favour of immutability.

## Gotchas

**Symptom:** a `@Component @ConfigurationProperties` record fails at startup asking for a `String` bean
**Cause:** `@Component` makes the container construct the bean by dependency injection, and constructor binding is not available on that path
**Fix:** register it the way configuration properties are meant to be registered:
```java
@ConfigurationPropertiesScan
@SpringBootApplication
public class MyApplication { }
```

**Symptom:** a class with `final` fields and one constructor binds nothing, and every field is null
**Cause:** something opted the class out of constructor binding — most often an `@Autowired` left on the constructor out of habit, or a `private` constructor
**Fix:** remove the annotation and make the constructor public; the single parameterised constructor is the whole switch

**Symptom:** adding a convenience constructor breaks binding on a class that worked
**Cause:** with more than one constructor the binder no longer has an unambiguous choice
**Fix:** mark the one to bind through:
```java
@ConstructorBinding
public MyProperties(String host, int port) { … }
```

**Symptom:** binding fails in one module of a multi-module build and works everywhere else
**Cause:** that module does not inherit `spring-boot-starter-parent` or the Boot Gradle plugin, so `javac` was not given `-parameters` and the constructor parameters are named `arg0`, `arg1`
**Fix:** add the compiler argument in that module's build, or inherit the parent that already sets it

**Symptom:** a JavaBean-bound nested POJO stays null even though its properties are set
**Cause:** the nested field was neither pre-initialised nor given a setter, so the binder had no way to supply an instance
**Fix:** pre-initialise it (`private final Security security = new Security();`) and expose a getter, or add a setter — or move the class to constructor binding, where the question does not arise

**Symptom:** a static field on a properties class is never populated
**Cause:** only standard Java Bean properties are bound; static properties are excluded
**Fix:** make it an instance property. If it genuinely needs to be static, it is not configuration — it is a constant

**Symptom:** an old sample annotating the *class* with `@ConstructorBinding` does not compile
**Cause:** in Boot 3.0 the annotation moved to constructor targets only
**Fix:** move it onto the constructor, and delete it entirely if the class has just one

## Interview questions

**★ How does Spring Boot decide between JavaBean and constructor binding?**
By the shape of the class, not by an annotation. The presence of a single
parameterised constructor implies constructor binding; anything else falls back
to JavaBean binding through a default constructor plus setters. The three
documented ways to opt out of constructor binding are annotating the constructor
`@Autowired`, making it private, or — in Kotlin — declaring an empty primary
constructor. That is worth knowing precisely, because each of them turns an
apparently immutable class back into a JavaBean silently.

**★ When is `@ConstructorBinding` actually required?**
Only when the class has more than one constructor, to say which one the binder
should use. A record, or a class with exactly one parameterised constructor,
needs nothing. It also has to sit on the constructor rather than the type — it
was moved to constructor targets in Boot 3.0 — so older samples that annotate
the class no longer compile.

**★ Why can't a `@Component`-annotated class use constructor binding?**
Because `@Component`, `@Bean` and `@Import` all make the *container* responsible
for constructing the object, and the container constructs beans by dependency
injection: it would look for beans of type `String` and `int` and fail.
Constructor binding requires the `Binder` to be the caller, which happens only
on the two registration routes designed for it — `@EnableConfigurationProperties`
and `@ConfigurationPropertiesScan`. If you need `@Component`, you are choosing
JavaBean binding.

**★ What does `-parameters` have to do with configuration?**
Constructor binding matches property names to constructor *parameter names*, and
parameter names are only retained in the class file when `javac` is given
`-parameters`. Without it every parameter is `arg0`, `arg1`, and binding
produces nothing with no diagnostic pointing at the compiler.
`spring-boot-starter-parent` and the Boot Gradle plugin both add the flag, so
the failure shows up in hand-rolled builds and in modules that inherit neither.

**★ What do you lose by making configuration immutable?**
The ability to change it in a running process. A constructor-bound object is
built once and never mutated, so no amount of editing a file or setting a
variable will alter it without a restart. In practice that is the point: it
removes the class of bug where one component read a value at startup and another
reads it per call and the two disagree. If dynamic reconfiguration is a genuine
requirement it needs a mechanism built for it, not a mutable properties bean
that happens to be re-bindable by accident.

**★ In a JavaBean-bound class, which properties can skip their setter?**
Pre-initialised nested objects and pre-initialised mutable collections and maps.
The binder mutates the instance the field already holds rather than replacing
it, so a getter is enough. Anything not pre-initialised needs a setter, because
the binder has to construct the value and hand it back — a nested POJO left
null with no setter simply stays null. Static properties are never bound at all.

---

← Prev: [Relaxed binding and environment variables](04-relaxed-binding-and-env-vars.md) · Index: [Configuration and profiles](README.md) · Next → [Defaults, absence and validation](06-defaults-and-validation.md)
