---
title: "\"Test this private method\" is the one request in this whole topic that has no testing answer at all — Mockito cannot express it, the library that could has not shipped since 2020, and every route that works is a statement about the design rather than about the test"
sidebar_label: "02d2 · The private method"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Mockito 5.23.0** sources on GitHub, tag `v5.23.0` —
> [`Mockito.java`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §39 and §48 for what the mock makers intercept; the **Spring Framework 7.0.8** source of
> [`ReflectionTestUtils`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-test/src/main/java/org/springframework/test/util/ReflectionTestUtils.java),
> whose class javadoc is quoted below; and **Maven Central**'s release list for
> `org.powermock:powermock-core`
> ([search.maven.org](https://search.maven.org/artifact/org.powermock/powermock-core)),
> whose newest version is **2.0.9, published 2020-11-01**.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[02d](02d-vendor-clients-and-private-methods.md) finished the vendor client. This is the
fifth shape and the odd one out, because unlike the other four it is not a limitation of a
mocking library — it is a request that does not have a well-formed answer. There is no
Mockito API for a private method: `when(mock.somePrivateThing())` does not compile, and no
mock maker changes that, because the stubbing DSL works by recording an invocation you made
in Java source and Java source cannot make that call. Everything below is therefore about
which of four different situations you are actually in, because "test the private method"
means something different in each, and only one of them is a testing problem.**

## Why there is no trick to show you

Both mock makers work at the point of *dispatch*. §39 describes the inline maker as
*"a combination of both Java instrumentation API and sub-classing"*, and §48 describes static
mocking as intercepting *"static method invocations within the current thread and a
user-defined scope"*. A `private` method is invoked with `invokespecial` against a known
target and is not overridable, so subclassing cannot reach it — and more decisively, the
Mockito API takes the invocation *from your test's own bytecode*:

```java
when(service.privateHelper(arg))   // ⛔ does not compile: privateHelper is not visible
```

There is nothing for the framework to intercept because you cannot write the call. This is
the one place in these four chunks where "use the trick when you cannot change the code" has
no trick on the other side of it. **The library that did offer one was PowerMock**, whose
`PowerMockito.when(spy, "helper", args)` took the method name as a string. Its newest
artifact on Maven Central is `2.0.9`, published **2020-11-01** — five JDK LTS releases ago.
Reaching for it on JDK 25 is not a testing decision, it is a load-bearing dependency on an
unreleased-in-six-years bytecode manipulator.

## The four situations, and which one you are in

### 1 · The private method is reachable from a public one — test it there

This is the overwhelming majority, and the honest answer is that there is nothing to do.

```java
public class PricingService {

    public Money quote(Basket basket) {
        Money subtotal = subtotal(basket);
        return subtotal.plus(vat(subtotal, basket.country()));
    }

    private Money subtotal(Basket basket) { /* … */ }
    private Money vat(Money net, Country country) { /* … */ }
}
```

`vat` is a private method with real branching — zero-rated countries, reverse charge,
rounding. Every one of those branches is reachable by choosing a `Basket` and calling
`quote`. The test is a table of baskets and expected quotes, and it is a *better* test than
one that pokes at `vat` directly, because it survives the day somebody moves the VAT
calculation into a different private method. **Topic 03 · Parameterized tests** owns the
table form.

The usual objection is coverage: "I cannot get to the reverse-charge branch through
`quote`." Sometimes true, and then it is diagnostic — a branch you cannot reach from the
public API of the class is either dead code or evidence that the class is doing two jobs,
which is situation 2.

### 2 · The private method is a second responsibility — extract a class

The tell is that the private method has parameters unrelated to the object's fields, or a
name from a different vocabulary, or its own set of edge cases nobody else cares about.

```java
public final class VatCalculator {
    public Money vat(Money net, Country country) { /* … */ }
}
```

```java
public class PricingService {

    private final VatCalculator vat;

    public PricingService(VatCalculator vat) { this.vat = vat; }

    public Money quote(Basket basket) {
        Money subtotal = subtotal(basket);
        return subtotal.plus(vat.vat(subtotal, basket.country()));
    }
}
```

Now `VatCalculator` has its own test class with twenty cases and no mocks in it at all,
because it is a pure function. And 🔴 **`PricingService`'s test should still use the real
`VatCalculator`, not a mock of it** — it is a value-shaped collaborator with no I/O, and
mocking it would be [01a](01a-the-four-failure-modes.md)'s wrong-altitude failure. The point
of the extraction was testability of the *branches*, not the introduction of a seam.

The reason this is not "adding a class to make the test pass" is that the request itself was
the design feedback. A method that somebody wants to test in isolation is a method with
enough behaviour to deserve a name and a type. That is the same argument
[02b](02b-when-the-collaborator-is-hard-to-mock.md) makes about static utilities, arriving
from the other direction.

### 3 · The method is private for no reason — widen it deliberately

Some methods are private out of habit. If the method is a coherent operation of the class and
callers outside the package have no business calling it, package-private plus a comment is a
defensible, boring answer:

```java
// package-private for test; not part of the public contract
Money vat(Money net, Country country) { … }
```

Two honest caveats. First, this only works when the test lives in the **same package** —
which is the standard Maven and Gradle layout, `src/test/java` mirroring
`src/main/java`, so it usually costs nothing. Second, **it does not work across a JPMS module
boundary or when the test source set is in a different package**, and teams that hit that
discover it late. There is no `@VisibleForTesting` in the JDK; Guava's is documentation only
and enforces nothing, and writing your own annotation is fine as long as everyone understands
it is a comment with a compiler-visible name.

### 4 · You genuinely cannot change the class — reflection, and what it costs

Legacy code you do not own, generated code, a third-party class. Spring ships the tool, and
its class javadoc is explicit about the scenarios it is for:

> *"`ReflectionTestUtils` is a collection of reflection-based utility methods for use in unit
> and integration testing scenarios."*

> *"There are often times when it would be beneficial to be able to set a non-`public` field,
> invoke a non-`public` setter method, or invoke a non-`public` configuration or lifecycle
> callback method when testing code involving, for example: ORM frameworks such as JPA and
> Hibernate which condone the usage of `private` or `protected` field access…"*

```java
Money vat = ReflectionTestUtils.invokeMethod(service, "vat", Money.of("100.00"), Country.DE);
```

Read the javadoc's own list of use cases: JPA field access, `@Autowired` private fields,
`@PostConstruct` callbacks. It is a tool for reaching *framework-imposed* non-public members,
not a blessing for testing your own private logic. What it costs you:

- **The method name is a string.** Rename the method and the test compiles and fails at
  runtime, with a message about a missing method rather than about the behaviour.
- **The parameter types are resolved from the runtime classes of the arguments**, so an
  overload or a `null` argument can select a different method than you meant, or none.
- **The test now asserts on an implementation detail by name**, which means any refactor of
  the private structure — the thing privates exist to permit — breaks a test that is not
  about the change.

Use it to get a characterization test around code you are about to change, then delete it
once the seam exists. That sequencing is [11 · The legacy class with no seams](11-the-legacy-class-with-no-seams.md) in
this topic.

## The one case that is genuinely about mocking: a protected hook

A `protected` method is not private, and the difference matters, because `protected` *is*
reachable by subclassing and therefore by a partial mock:

```java
@Test
void usesTheHook() {
    PricingService service = spy(new PricingService());
    doReturn(Money.of("7.00")).when(service).vat(any(), any());   // protected, so this works
    // …
}
```

It compiles, and [02c](02c-construction-and-final-classes.md)'s warning about
`mockConstruction` applies here in a sharper form: you have mocked part of the class under
test, which [01](01-what-to-mock-and-what-to-let-run.md) rules out except in narrow legacy
cases. **Topic 04 · Mockito** owns spies and partial mocks in full — see
[`../04-mockito/08e-partial-mocks.md`](../04-mockito/08e-partial-mocks.md). The reason to
mention it here is that people generalise from "you can do this with `protected`" to
"therefore private is just a visibility problem", and it is not: the `protected` version
works because the method is overridable, and private methods are not.

## Where this connects

- The vendor client, and the other four shapes:
  [02d](02d-vendor-clients-and-private-methods.md),
  [02b](02b-when-the-collaborator-is-hard-to-mock.md),
  [02c](02c-construction-and-final-classes.md).
- The table that decides trick-versus-refactor for all five shapes, and what the tricks cost:
  [02e · The agent tax and the decision table](02e-the-agent-tax-and-the-decision-table.md).
- Why mocking part of the class under test is a failure mode with its own symptoms:
  [01a · The four failure modes](01a-the-four-failure-modes.md).
- Characterization tests around code with no seams at all, which is where
  `ReflectionTestUtils` legitimately earns a temporary place, is [11 · The legacy class
  with no seams](11-the-legacy-class-with-no-seams.md) in this topic.
- Spies, partial mocks and `doReturn(...).when(spy)` belong to **topic 04 · Mockito** —
  [`../04-mockito/08-spies.md`](../04-mockito/08-spies.md) and
  [`../04-mockito/08e-partial-mocks.md`](../04-mockito/08e-partial-mocks.md).

## Gotchas

**★ There is no Mockito API for a private method, and looking for one wastes an afternoon.**
The stubbing DSL records a call you wrote in your test's source, so if the call does not compile there is nothing to record. No mock maker, no `MockSettings`, no `@Mock(mockMaker = ...)` changes this — it is a property of how the API works, not of what the bytecode engine can reach. The search results that promise otherwise are all PowerMock, whose newest release on Maven Central is 2.0.9 from 2020-11-01.

**★ `ReflectionTestUtils.invokeMethod` takes the method name as a `String`, so a rename produces a runtime failure in a test that still compiles.**
This is the specific cost that makes reflection unsuitable as a standing technique. Your IDE's rename refactoring will not touch the string, the compiler will not complain, and CI reports a missing-method error on a test whose name says it is about VAT. It is acceptable as scaffolding around a change you are about to make and unacceptable as the way a team tests its own logic.

**★ Reflection resolves the overload from the runtime types of the arguments you passed, which can pick a different method or none.**
Pass a `null`, or pass a subclass where the private method is declared against an interface, and the lookup can fail or select an overload you did not intend. The failure message is about method resolution, several steps away from the behaviour under test. A direct call has none of this because the compiler did the resolution.

**★ "I cannot reach that branch through the public API" is a finding, not an obstacle.**
It means one of two things and both are worth knowing: the branch is unreachable, in which case it is dead code and deleting it is the fix; or the class has a responsibility whose inputs the public API does not expose, in which case that responsibility wants its own type. Reaching in with reflection converts a design signal into a green test and loses the information.

**★ Making a method package-private for the test silently stops working across a JPMS module or a differently-packaged test source set.**
The technique depends on the test class living in the same package, which the standard `src/test/java` layout gives you for free — until a module descriptor, a shaded jar, or a test source set organised by feature rather than by package moves it. The failure is a compile error in the test only, so it shows up as "the test does not compile any more" long after the decision was made.

**★ A `@VisibleForTesting` annotation enforces nothing, and people treat it as if it did.**
Guava's version, and any you write yourself, is documentation: the compiler does not restrict callers to test code. Production code will eventually call the widened method, and the annotation will still be sitting there. If that matters, the enforcement has to come from an architecture test, not from the annotation.

**★ Extracting the private method into a class and then *mocking* the new class throws away everything the extraction bought.**
The extraction exists so the logic can be tested directly with real inputs. If the caller's test then stubs `given(vat.vat(any(), any())).willReturn(...)`, the caller's test no longer exercises any pricing at all, and you have paid for a class in order to make a test weaker. A pure calculator is a value-shaped collaborator — [01](01-what-to-mock-and-what-to-let-run.md) says let it run.

**★ The `protected` case works and teaches the wrong lesson.**
`doReturn(x).when(spy).protectedMethod()` compiles and does what you expect, because `protected` methods are overridable and the spy subclasses. Generalising that to private methods fails, and generalising it to "partial mocks are fine" fails differently — you are now mocking the class under test, so the test asserts against behaviour you supplied. Both generalisations start from a technique that happened to work once.

## Interview questions

**★ A colleague asks you how to unit-test a private method. What do you say?**
That I want to see the method first, because the request means four different things. Usually it means the method has branching that is reachable from a public entry point and nobody has written the table of inputs that reaches it — so the answer is a parameterized test on the public method, which is also more durable, because it does not break when the private structure changes. Sometimes the method turns out to be a second responsibility with its own vocabulary and edge cases, and then the answer is to extract it into a class with its own test, which is the design telling us something rather than a testing workaround. Occasionally the method is private out of habit and package-private is fine. And rarely it is legacy code I cannot change, where I would use `ReflectionTestUtils.invokeMethod` as temporary scaffolding while I build a seam, knowing the method name is a string and the test will not survive a rename. What I would not do is reach for PowerMock: its last release was 2.0.9 in November 2020, and adding a six-year-dormant bytecode library to a JDK 25 build to avoid a refactor is a bad trade.

**★ Why can Mockito mock a final class but not a private method?**
Because they are different obstacles. Finality is a bytecode restriction the inline mock maker gets around with instrumentation plus subclassing — the method still exists as a dispatchable member, Mockito just needed a way to intervene at the dispatch. A private method is not a dispatch problem at all: it is not overridable, and, more importantly, Mockito's API works by observing a call that *your test made*, and your test cannot make that call because it does not compile. So the barrier is at the language level, in your source, before any mock maker is involved. That is also why no configuration flag exists for it and why the libraries that offered it did so with a string method name and their own bytecode engine.

**★ When is `ReflectionTestUtils` legitimate?**
When the non-public member is imposed by a framework rather than by my design, and when it is temporary. Its own javadoc names the cases: a JPA entity with private field access and no setters, an `@Autowired` private field, a `@PostConstruct` callback — places where the framework's conventions, not mine, made the member non-public. The other legitimate use is characterization: I have been sent to change a legacy class with no seams, I need a test that pins current behaviour before I touch it, and reflection is the cheapest way to get one. In that case I write the characterization test, make the change, introduce a seam, and delete the reflection. What makes it illegitimate is standing use on code I own, because it converts every private method into a name-based public contract and blocks exactly the refactoring that privacy exists to allow.

**★ You extract a private calculation into its own class. Should the original class's test now mock it?**
No, and this is the mistake that most often follows the refactor. The calculator is a pure function of its inputs with no I/O, no time, no randomness and no shared state, so it is value-shaped, and mocking a value replaces real behaviour with my description of it while making the caller's test blind to the interaction between the two. The caller's test should construct the real calculator and assert on the composed result, and the calculator's own test carries the twenty branch cases. The only thing that would change my answer is the calculator acquiring something slow or non-deterministic — a network call, a clock, a database — at which point it is no longer a calculator and the seam is genuine.

{/* FOOTER */}
