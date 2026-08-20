---
title: "Why field injection is flagged in review"
sidebar_label: "4 · Field injection"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Using
> `@Autowired`* (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
> — field injection, and the note that `@Autowired`/`@Value`/`@Inject`/`@Resource`
> are handled by `BeanPostProcessor` implementations and therefore cannot be
> used inside `BeanPostProcessor` or `BeanFactoryPostProcessor` types) and
> *Constructor-based or setter-based DI*
> (docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html
> — the constructor-argument code smell). Spring Boot 4.1.0, Spring Framework
> 7.0.x, JDK 25.

**`@Autowired` on a private field is the shortest thing to type and the only
injection style that removes a guarantee rather than adding one. It is flagged
in review not because it is ugly, and not because "the docs say so" — the
reference documents it without editorialising — but because it converts four
separate compile-time or design-time checks into a single runtime one, and does
so invisibly. Every argument below is one of those four checks.**

```java
@Service
public class InvoiceService {

    @Autowired private PricingClient pricing;          // ← the thing under discussion
    @Autowired private InvoiceRepository repository;
}
```

Six characters shorter per dependency than the constructor form. Here is what
those six characters cost.

## 1. The class is no longer constructible

This is the load-bearing one and everything else is secondary to it.

```java
var service = new InvoiceService();   // compiles. Both fields are null.
service.raise(orderId);               // NullPointerException
```

There is **no legal Java expression that produces a usable `InvoiceService`.**
The fields are private and there are no setters, so the only ways in are:

- start a Spring context in the test — slow, and now your unit test is an
  integration test;
- `ReflectionTestUtils.setField(service, "pricing", stub)` — which compiles
  against a *string*, so renaming the field silently breaks the test's intent
  while leaving it green until it runs;
- make the fields package-private so the test in the same package can assign
  them — which weakens the class's encapsulation to serve the test, and is a
  concession that the design was wrong.

Compare the constructor version: `new InvoiceService(stub, inMemoryRepo)`. One
line, no framework, no reflection, checked by the compiler. **The entire
argument for DI from chunk 1 is this line, and field injection is the one style
that does not deliver it.**

## 2. It hides the signal that the class does too much

A constructor with nine parameters is unpleasant to look at, and that is the
feature. The reference calls a large number of constructor arguments *"a bad
code smell, implying that the class likely has too many responsibilities."*

Nine `@Autowired` fields are not unpleasant to look at. They are a tidy column.
The class is exactly as overloaded either way, but only one of the two forms
tells you so, and only one of them makes adding a tenth feel like a decision.

This is why field injection tends to *correlate* with god classes rather than
merely permit them: the growth is painless, so it happens.

## 3. `final` becomes impossible

```java
@Autowired private final PricingClient pricing;   // will not compile
```

A `final` field must be definitely assigned by the end of every constructor, and
field injection assigns it afterwards by reflection. So the field is mutable for
the life of the object.

The practical loss is the JMM guarantee described in
[chunk 2](02-constructor-injection.md): a `final` field written in the
constructor is visible, fully initialised, to every thread that sees the object,
with no synchronisation. A Spring singleton is shared by every request thread
simultaneously, so this is not a theoretical concern
([the Java memory model](../../phase-6-concurrency/05-java-memory-model/README.md)).
It is also simply a mutable field on a shared object, which anything in the
process can reassign.

## 4. Null-safety analysis has nothing to work with

Framework 7 moved the portfolio to **JSpecify** annotations for null-safety,
which lets tooling reason about nullness including generics, arrays and
varargs. That analysis works on *declarations it can see the assignment for*.

With a constructor parameter, a checker can prove the field is non-null after
construction: the parameter is non-null, it is assigned once, the field is
final. With a field written by reflection after the object exists, there is no
assignment in the source for a checker to follow — the field is declared, never
assigned, and then mysteriously not null at runtime. Static analysis either
warns about it forever or is configured to ignore the whole pattern.

## The window where the fields are genuinely null

Worth stating precisely, because it produces a recurring confusion:

1. Spring instantiates the bean — the constructor runs.
2. A `BeanPostProcessor` populates `@Autowired` fields.
3. `@PostConstruct` runs.

During step 1 the fields are null, and they are null *inside your constructor*.
So this fails, always:

```java
@Service
public class ReportService {

    @Autowired private ReportRepository repository;

    public ReportService() {
        this.count = repository.count();   // NPE — step 2 has not happened
    }
}
```

The fix people reach for is `@PostConstruct`, which does work. The fix that
removes the problem is a constructor parameter, after which there is no step 2
to wait for. Lifecycle ordering is
**[Topic 04 — Bean scopes and lifecycle](../04-bean-scopes-lifecycle/README.md)**.

## The one place field injection is not a choice

The documentation notes that `@Autowired`, `@Value`, `@Inject` and `@Resource`
are themselves processed by `BeanPostProcessor` implementations, and therefore
**cannot be used inside a class that is itself a `BeanPostProcessor` or
`BeanFactoryPostProcessor`** — those must be wired explicitly through `@Bean`
methods, because they are created before the machinery that would inject them.
This is a genuine bootstrapping constraint rather than a style preference, and
it is worth knowing because the failure mode is a post-processor that silently
does not get its dependencies.

Beyond that, the honest exceptions are narrow: `@Autowired` on a field in a
test class is fine, because a test *is* constructed by the framework and there
is nobody downstream to protect.

## The arguments people make for it, and why they do not hold

**"It's less code."** True, and it is the only true one. It saves a signature
and one assignment per dependency, at the cost of section 1. Lombok's
`@RequiredArgsConstructor` recovers the brevity without the cost.

**"Constructor injection makes constructors huge."** The constructor is huge
because the class is huge. Field injection makes the file shorter, not the
class smaller.

**"We can test with `@MockitoBean` anyway."** You can, and Boot 4 renamed
`@MockBean` to `@MockitoBean` for exactly this workflow — but that starts a
context. It is the right tool for testing wiring and web layers, and the wrong
tool for a pure unit test of a service's logic, which should not need a context
at all. **Phase 11 — Testing** *(not written yet)* covers the split.

**"Circular dependencies are easier to deal with."** This is true and it is an
indictment, not a defence — see [the circular dependency chunk](09-circular-dependencies.md).

## Gotchas

**Symptom:** a unit test uses `ReflectionTestUtils.setField(svc, "pricing", stub)`, a
field is renamed, and the test still passes while testing nothing useful
**Cause:** the field name is a string, so the compiler cannot check it; depending on
the helper the mismatch throws at runtime or the stub is simply never installed
**Fix:** constructor-inject and pass the stub as an argument, so the compiler enforces
the wiring the test depends on

**Symptom:** a bean's `@Autowired` field is null inside its own constructor
**Cause:** field population happens in a `BeanPostProcessor` after instantiation —
the constructor genuinely runs before it
**Fix:** take it as a constructor parameter. `@PostConstruct` also works but only
moves the code; the parameter removes the ordering question

**Symptom:** a custom `BeanPostProcessor` has `@Autowired` fields that are never
populated, and nothing complains
**Cause:** post-processors are instantiated before the annotation-processing
infrastructure that would inject them — the docs state these annotations cannot be
used inside `BeanPostProcessor`/`BeanFactoryPostProcessor` types
**Fix:** declare it as a `@Bean` method and pass the dependencies as method
parameters, or inject lazily via `ObjectProvider` obtained from the `BeanFactory`

**Symptom:** static analysis reports "field is never assigned" across dozens of beans,
so the rule gets disabled repository-wide
**Cause:** reflection-assigned fields have no assignment in source for a checker to
follow, and Framework 7's JSpecify-based null-safety analysis has nothing to anchor on
**Fix:** constructor injection gives the analysis a real assignment to reason about;
disabling the rule instead loses it everywhere, including where it would have caught
a genuine bug

**Symptom:** a `@Service` accumulates a tenth `@Autowired` field and nobody objects in
review
**Cause:** each addition is a one-line diff in a tidy column, so there is no moment at
which the growth looks like a decision
**Fix:** convert to constructor injection and let the signature carry the count — the
reference explicitly treats that count as the smell to act on

**Symptom:** an `@Autowired` static field is null and startup reported nothing
**Cause:** injection targets instances; static fields are never populated, and there is
no unsatisfied-dependency error to raise
**Fix:** make the consumer a bean and inject normally. Assigning a static from an
instance setter works but leaves a race between construction and first static read

**Symptom:** converting a class from field to constructor injection suddenly produces a
circular-dependency failure at startup
**Cause:** the cycle was always there — field injection allowed it by separating
construction from wiring, so nothing ever reported it
**Fix:** treat it as the finding it is and break the cycle
([Breaking the cycle](10-breaking-the-cycle.md)); do not restore field injection to make
the message go away

## Interview questions

**★ Why is field injection considered a code smell?**
Chiefly because the class stops being constructible: with private fields and no
constructor parameters there is no legal way to build a usable instance in a
test without a Spring context or reflection, which discards the main benefit of
dependency injection. Secondarily it makes `final` impossible, so a
container-shared singleton holds mutable fields and loses the final-field
visibility guarantee; it hides the dependency count that the docs treat as a
design signal; and it leaves null-safety analysis with no assignment to follow.

**★ Is field injection ever correct?**
In test classes, yes — the framework constructs them and there is no downstream
consumer to protect. Everywhere else the honest answer is that it is a
convenience, not a design choice. There is also a hard constraint worth knowing
in the other direction: `@Autowired` and friends are processed by
`BeanPostProcessor`s, so they cannot be used *inside* a `BeanPostProcessor` or
`BeanFactoryPostProcessor` — those must be wired through explicit `@Bean`
methods.

**★ Why is an `@Autowired` field null inside the bean's own constructor?**
Because population is a separate, later step. Spring instantiates the bean
first — running your constructor — and only then does a `BeanPostProcessor`
write the annotated fields, with `@PostConstruct` after that. So during the
constructor the fields are genuinely still null. `@PostConstruct` is the usual
workaround, but the real fix is a constructor parameter, which eliminates the
ordering question rather than scheduling around it.

**★ A colleague says field injection is fine because they test with `@MockitoBean`. Respond.**
`@MockitoBean` (the Boot 4 rename of `@MockBean`) is a good tool, but it works
by starting an application context and replacing a bean in it. That is the right
approach for testing wiring, controllers and slices, and the wrong one for a
service whose logic could be tested in milliseconds with `new` and two stubs.
Relying on it universally means every test pays context-startup cost, so the
suite gets slow enough that people stop running it — which is the real damage.

**★ How does field injection interact with `final` and with concurrency?**
It rules `final` out entirely, since a final field must be definitely assigned by
the end of the constructor and reflection writes it afterwards. That costs the
final-field freeze guarantee from the memory model, which says a safely
constructed object's final fields are visible fully initialised to every thread
without synchronisation. Spring beans are singletons shared across all request
threads, so this is a real property to give up, and what you get in its place is
a mutable field on a shared object.

**★ `@Autowired` on a `static` field — what happens?**
Nothing, silently. Spring injects into instances, so a static field is simply
never written and stays null, with no warning at startup because there is no
injection point the container considers unsatisfied. This is a particularly nasty
variant of the field-injection problem: the usual startup-time safety net does not
catch it, and the failure is a `NullPointerException` at first use. If a value is
genuinely needed statically, the consumer should have been a bean.

**★ How would you migrate a large codebase from field injection to constructor injection?**
Incrementally, and class by class rather than with a bulk rewrite, because the
migration surfaces real design problems you will want to handle deliberately —
classes with a dozen dependencies, and cycles that only worked because field
injection permitted them. A practical order is: convert the class, let the
constructor reveal the dependency count, and split anything that is obviously
overloaded; expect the cycles to appear as startup failures and treat each as a
finding rather than something to suppress with
`spring.main.allow-circular-references`. `@RequiredArgsConstructor` makes the
mechanical part cheap, so the effort goes where it belongs.

**★ Does Lombok's `@RequiredArgsConstructor` count as constructor injection?**
Yes, genuinely — it generates a real constructor over the `final` fields, so the
class is constructible with `new` in a test, the fields are final, and the
compiler enforces the arguments. The only thing it costs is that adding a
dependency becomes a one-line diff instead of a visible change to a signature,
so the "how many dependencies does this class have" signal is quieter. That is a
much smaller problem than the one field injection creates.

---

← Prev: [Setters, `@Value` and records](03-setters-values-records.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Resolving ambiguity](05-resolving-ambiguity.md)
