---
title: "Constructor injection is the default"
sidebar_label: "2 · Constructor injection"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Constructor-based
> or setter-based DI*
> (docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html)
> for the Spring team's recommendation and the setter-injection guidance, and
> *Using `@Autowired`*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html)
> for the single-constructor rule and the multiple-constructor requirement.
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Constructor injection is not the recommended style — it is the only one that
uses the type system. The other two ask the container to enforce, at startup, a
guarantee the compiler was standing right there ready to enforce at build time.
Everything constructor injection is praised for — `final` fields, no nulls,
thread-safe publication, a class that is fully valid the instant it exists —
is a restatement of that one fact: the dependency is a constructor parameter,
and Java already knows what to do with those.**

## The shape, and the annotation you do not write

```java
@Service
public class InvoiceService {

    private final PricingClient pricing;
    private final InvoiceRepository repository;

    // no @Autowired — this class has exactly one constructor
    public InvoiceService(PricingClient pricing, InvoiceRepository repository) {
        this.pricing = pricing;
        this.repository = repository;
    }
}
```

The reference documentation is explicit that the annotation is redundant here:
*"An `@Autowired` annotation on such a constructor is not necessary if the
target bean defines only one constructor."* This has been true since Spring 4.3
and it is worth internalising, because `@Autowired` on a sole constructor is
the single most common piece of noise in Spring codebases and reviewers who
have not read this line keep asking for it back.

The rule flips the moment there is a second constructor:

```java
@Service
public class ReportService {

    private final ReportRepository repository;
    private final Clock clock;

    @Autowired                                   // ← now REQUIRED
    public ReportService(ReportRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    // a convenience constructor for tests and for callers who don't care about time
    public ReportService(ReportRepository repository) {
        this(repository, Clock.systemUTC());
    }
}
```

The docs' wording: *"If several constructors are available and there is no
primary or default constructor, at least one must be annotated with
`@Autowired`."* Miss it and the container cannot choose, and you get a startup
failure rather than a silent wrong pick — which is the container behaving well.

## What the Spring team actually says, and why

Quoted in full, because it settles most arguments on its own:

> *"The Spring team generally advocates constructor injection, as it lets you
> implement application components as immutable objects and ensures that
> required dependencies are not `null`. Furthermore, constructor-injected
> components are always returned to the client (calling) code in a fully
> initialized state."*

Three separate claims. They are worth separating because people quote the
sentence and then only defend the first third of it.

### 1. Immutable components

`final` is only assignable in a constructor. That is a language rule, not a
Spring rule, and it means **the choice of injection style decides whether
`final` is available to you at all**:

```java
private final PricingClient pricing;   // constructor injection — legal
@Autowired private PricingClient p2;   // field injection — cannot be final
```

Why it matters beyond tidiness: a `final` field written in the constructor gets
the JMM's final-field freeze guarantee, so once the object is safely
constructed, every thread that sees the object sees the field fully
initialised — without any synchronisation
([the Java memory model](../../phase-6-concurrency/05-java-memory-model/README.md),
[immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)).
Since Spring beans are singletons shared across every concurrent request
(topic 04), that guarantee is doing real work, not decorating.

### 2. Required dependencies are not null

A constructor parameter cannot be skipped. The compiler will not let a caller
omit it, and no reflection path can construct the object without supplying
something. Compare with field injection, where the field is `null` between
`new` and the container's post-processing pass — a window that exists, that
your constructor runs inside, and that is the cause of the classic "it's null
in the constructor" confusion.

### 3. Fully initialized when returned

There is no moment at which a constructor-injected bean exists in a
half-configured state. It is invalid, then it is valid; there is no in-between.
This is why constructor injection needs no proxies to be correct, and it is
also — as chunk 6 shows — precisely why circular dependencies become impossible
rather than merely discouraged.

## Gotchas

**Symptom:** a reviewer insists `@Autowired` be added back to a single constructor
**Cause:** the rule that it is unnecessary for a sole constructor arrived in Spring
4.3 and a lot of learning material predates it
**Fix:** point at the reference: *"not necessary if the target bean defines only one
constructor."* Adding it is harmless but it is noise, and noise on every class adds up

**Symptom:** a second constructor is added for convenience and the context now fails
to start with a message about no qualifying constructor
**Cause:** with several constructors and no default one, Spring will not guess — the
docs require `@Autowired` on the one to use
**Fix:** annotate the intended constructor. Do not add a no-arg constructor to "fix"
it — that makes Spring pick the empty one and every field stays null

**Symptom:** a dependency is `null` inside the constructor of a field-injected bean
**Cause:** fields are populated by a `BeanPostProcessor` *after* construction, so
during the constructor they are genuinely still null
**Fix:** take the dependency as a constructor parameter. If the work truly must
happen after full initialisation, that is what `@PostConstruct` is for — see
**[Topic 04 — Bean scopes and lifecycle](../04-bean-scopes-lifecycle/README.md)**

**Symptom:** the context fails at startup with a `BeanCreationException` wrapping an
exception thrown from a bean's constructor
**Cause:** the constructor is doing real work — a lookup, a connection, a validation —
and that work failed
**Fix:** this is usually the system behaving correctly, so fix the cause. If the work
should not block startup, move it to `@PostConstruct` or an `ApplicationRunner` and
decide deliberately whether failure there should stop the deploy

**Symptom:** a Kotlin or Lombok-generated class works, but the equivalent hand-written
class with two constructors fails to start
**Cause:** the generated class has exactly one constructor, so Spring selects it
implicitly; the hand-written one has several and none annotated
**Fix:** annotate the intended constructor with `@Autowired`, and avoid adding a
convenience no-arg constructor, which would be selected silently

## Interview questions

**★ When do you need `@Autowired` on a constructor, and when is it noise?**
It is unnecessary — and the docs say so explicitly — when the class defines
exactly one constructor; Spring uses it automatically. It becomes *required*
when several constructors exist and none is a default constructor, because the
container will not choose for you; at least one must be annotated. So the rule
is: one constructor, no annotation; several constructors, annotate the one you
mean.

**★ Give the three distinct benefits the Spring team's own recommendation claims for constructor injection.**
Immutable components, non-null required dependencies, and objects returned to
callers fully initialised. They are separate claims: `final` is only assignable
in a constructor, so the injection style decides whether immutability is even
available; a constructor parameter cannot be omitted, so "required" is enforced
by the compiler rather than by a startup check; and there is no window in which
the object exists but is not yet configured, which is why no proxy is needed for
correctness.

**★ Why does `final` on an injected field matter for a web application specifically?**
Because Spring beans are singletons by default and are therefore shared across
every concurrent request. A `final` field assigned in the constructor gets the
memory model's final-field freeze guarantee: any thread that obtains a reference
to a safely-constructed object sees that field fully initialised, with no
synchronisation. Field injection cannot use `final` at all, so you give up that
guarantee on an object that is by definition touched by many threads at once.

**★ What changes if one of several constructors is a no-arg default constructor?**
The requirement to annotate goes away, and that is a trap rather than a
convenience. The docs' rule is that `@Autowired` is needed when several
constructors exist *and there is no primary or default constructor* — so adding a
no-arg constructor makes the container stop complaining and quietly pick the
empty one. Every dependency is then null, and the failure appears at first use
rather than at startup. If you add a no-arg constructor to silence a
constructor-selection error, you have converted a clear startup failure into a
`NullPointerException` later.

**★ Should a constructor do any work beyond assigning fields?**
Almost never. Anything a constructor does becomes startup work and a startup
failure mode, so a constructor that opens a connection or calls a downstream
service makes your application's boot depend on that service's availability —
usually not what was intended. There is a subtler reason too: the AOP proxy is
applied after construction, so `@Transactional` or `@Cacheable` behaviour is
absent during the constructor, and publishing `this` from a constructor lets
other threads see a half-built object. Assign fields in the constructor and put
real initialisation in `@PostConstruct`.

**★ What does "fully initialized state" buy you that a startup-time null check would not?**
It removes the state entirely rather than detecting it. A container check can
only tell you, at startup, that a field was populated; it cannot stop the object
from having existed in a half-built form in between, which is why constructor
order, `@PostConstruct` and proxying all become things you have to reason about
in the other styles. With a constructor there is no in-between: the object is
invalid, then it is valid. That is also the mechanical reason a constructor-injected
graph cannot contain a cycle, which is the subject of the last chunk.

---

← Prev: [What DI buys](01-what-di-buys.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Setters, `@Value` and records](03-setters-values-records.md)
