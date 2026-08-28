---
title: "Constructing the system under test with new in the test body costs four words and buys back everything @InjectMocks takes away — a compile error when the constructor changes, wiring a reader can see, no null collaborator, no ambiguity rules to memorise, and the ability to pass a fake for one dependency and a mock for another, which the annotation cannot do at all"
sidebar_label: "09e · The case against @InjectMocks"
sidebar_position: 40
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) — the
> [`@InjectMocks`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/InjectMocks.java)
> javadoc, and
> [`MockitoExtension`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-extensions/mockito-junit-jupiter/src/main/java/org/mockito/junit/jupiter/MockitoExtension.java)
> — `public class MockitoExtension implements BeforeEachCallback, AfterEachCallback,
> ParameterResolver`, whose `beforeEach` calls `mockitoSession().initMocks(...).startMocking()`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source, never
> a fabricated test run.

**Four chunks of mechanism have now been spent on an annotation whose entire job is to save you
from typing a constructor call. This is the argument that you should mostly type the constructor
call. It is not a stylistic preference — every failure mode in
[09](09-injectmocks.md)–[09d](09d-the-candidate-filters.md) disappears, and one capability that
the annotation structurally cannot provide appears.**

## The whole argument, in two listings

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repository;
    @Mock PricingPolicy   pricing;
    @Mock PaymentGateway  gateway;
    @Mock Notifier        notifier;

    @InjectMocks OrderService service;      // reflection, three strategies, several silent failures
}
```

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repository;
    @Mock PricingPolicy   pricing;
    @Mock PaymentGateway  gateway;
    @Mock Notifier        notifier;

    OrderService service;

    @BeforeEach
    void setUp() {
        service = new OrderService(repository, pricing, gateway, notifier);
    }
}
```

Four words and a `@BeforeEach`. What that buys:

**A compile error when the constructor changes.** Add a fifth collaborator to `OrderService` and
the second listing stops compiling, in every test that constructs it, naming the file and the
line. The first listing compiles, runs, and passes `null` — *"If arguments can not be found, then
null is passed"* — until something dereferences it, possibly in a different test class.

**Wiring a reader can see.** The second listing states which object goes where. The first requires
the reader to know the biggest-constructor rule, the mockable-parameter tie-break, the
`final`-fields filter and the name filter to predict what happens.

**No ambiguity rules.** Two collaborators of the same type is an ordinary constructor call in the
second listing and a coin toss or a thrown `moreThanOneMockCandidate` in the first, depending on
which strategy ran ([09b](09b-constructor-injection.md), [09d](09d-the-candidate-filters.md)).

**No coupling to private field names.** `moreThanOneMockCandidate`'s own advice is to *"consider
naming the @Mock fields identically to the respective class under test's fields"* — that is, to
make the test depend on the SUT's **private field names**. A constructor call depends on the
constructor, which is public API.

## 🔴 The capability the annotation cannot have

`@InjectMocks` injects mocks and spies. That is its definition. So the moment one collaborator
should be something else, the annotation is out:

```java
@Mock PricingPolicy  pricing;                 // stateless function: a mock is right
@Mock PaymentGateway gateway;                 // needs to throw a timeout: a mock is right

OrderRepository repository = new InMemoryOrderRepository();   // stateful store: a fake is right
Clock clock = Clock.fixed(INSTANT, UTC);                      // a real object is right

@BeforeEach
void setUp() {
    service = new OrderService(repository, pricing, gateway, notifier, clock);
}
```

This is the shape [12 · Mocks vs fakes](12-mocks-vs-fakes.md) argues for — stub a function, fake a
store — and it is unreachable from `@InjectMocks`, because neither the fake nor the fixed `Clock`
is a candidate. Teams that standardise on `@InjectMocks` therefore drift towards mocking
everything, not because they decided to, but because the annotation only knows one kind of double.
The same applies to a real `ObjectMapper`, a real value object, or the anti-corruption adapter's
real implementation from [10e](10e-the-anti-corruption-adapter.md).

## 🔴 Construct in `@BeforeEach`, not in a field initialiser

The obvious tidy-up is wrong and it is worth knowing why:

```java
@Mock OrderRepository repository;

// BROKEN: repository is still null here
OrderService service = new OrderService(repository, pricing, gateway, notifier);
```

`MockitoExtension` is declared `implements BeforeEachCallback, AfterEachCallback,
ParameterResolver` — **not** `TestInstancePostProcessor`. Its `beforeEach` is what calls
`mockitoSession().initMocks(...).startMocking()`, and JUnit constructs the test instance, running
every field initialiser, *before* it invokes `beforeEach` callbacks
([03 · The lifecycle](../01-junit-5/03-the-lifecycle.md)). So a field initialiser captures the
`null`s that the `@Mock` fields hold at construction time, and — because it captured references
rather than reading them later — it keeps them after Mockito assigns the real mocks.

The symptom is an NPE on the first collaborator call and a debugger showing a perfectly good mock
in the test's own field. `@BeforeEach` runs after the extension callback, so it sees the mocks.
This is the one real ergonomic advantage `@InjectMocks` has: it cannot be written in the broken
place.

## What you give up, honestly

**Verbosity, proportional to the constructor.** For a SUT with seven collaborators the manual call
is a wide line repeated in each test class. Note what that is actually telling you — seven
constructor parameters is the signal, and
[10c · The refactor that removes the need](10c-the-refactor-that-removes-the-need.md) is where it
leads. The annotation makes the smell painless, which is not the same as fixing it.

**A little duplication across test classes.** Three test classes for the same SUT each write the
same construction. A private factory method or a test-data builder — **08 · Test data patterns**
*(not written yet)* — removes it without reintroducing reflection, and keeps the compiler in the
loop.

**Legacy classes with field injection and no constructor.** A class whose collaborators are set by
a framework and have no constructor path genuinely needs field injection, and `@InjectMocks` is
the tool for it. That is the case the annotation was designed for, and it is
[09c](09c-property-and-field-injection.md)'s strategy 2.

## When `@InjectMocks` is the right call

Three cases, and they are narrower than the annotation's popularity suggests.

1. **The SUT has no usable constructor.** Legacy field injection, a framework-managed object, a
   class you cannot change today. There is nothing to type.
2. **A large uniform suite where the SUT's constructor is stable**, and the team accepts that a new
   parameter surfaces as a `null` rather than a compile error. Make that trade deliberately, and
   put `Objects.requireNonNull` in the constructor so the trade has a floor
   ([09b](09b-constructor-injection.md)).
3. **A record or a class with all-`final` fields.** Only constructor injection can wire it, so the
   two silent strategies never run and the failure surface shrinks to
   [09b](09b-constructor-injection.md)'s rules alone.

Everywhere else, the annotation buys keystrokes and sells the compiler.

## Gotchas

**★ Constructing the SUT in a field initialiser after removing `@InjectMocks`.**
The `@Mock` fields are still `null` at that point, because `MockitoExtension` is a
`BeforeEachCallback` and the test instance is built first. Construct in `@BeforeEach`.

**★ Removing `@InjectMocks` but keeping a `@Spy` on the SUT.**
The spy is the bigger problem, not the injection —
[10 · Never mock the class under test](10-never-mock-the-class-under-test.md). Removing the
annotation makes the spy visible, which is an improvement, but it is not the fix.

**★ Replacing `@InjectMocks` with a helper that reflects over the constructor.**
That is `@InjectMocks` with fewer users and no documentation. If the constructor is too long to
type, shorten the constructor.

**★ Keeping `@InjectMocks` and adding a fake for one collaborator.**
It cannot be injected — only mocks and spies are candidates — so it stays `null` or, worse, is
overwritten by a matching mock if the field is non-final
([09c](09c-property-and-field-injection.md)). Drop the annotation for that test class.

**★ Treating "the test now knows the constructor signature" as a cost.**
It is the benefit. The test is a caller; callers depend on constructors. What you do not want is a
test depending on private *field* names, which is exactly what `moreThanOneMockCandidate`'s advice
asks for.

**★ Migrating a whole suite in one commit.**
The change is per test class and each one either compiles or does not. Do it where you are already
editing; a mass rewrite converts a silent-null problem into a large diff nobody reviews.

**★ Assuming the manual construction is slower.**
It is one `new`. `@InjectMocks` is annotation scanning over the test class hierarchy, a strategy
chain, a constructor search, a field sort and a three-filter matcher, per test method.

## Interview questions

**★ Why would you not use `@InjectMocks`?**
Because a plain constructor call gives you a compile error when the SUT's constructor changes,
whereas `@InjectMocks` passes `null` and reports nothing; because the wiring becomes visible
instead of being the output of four resolution rules; because ambiguity between two same-typed
mocks is a non-issue rather than a coin toss or an exception; and because a constructor call can
take a fake, a real object or a fixed `Clock`, none of which `@InjectMocks` can inject.

**★ What is the strongest single argument for it?**
A SUT with no usable constructor — legacy field injection or a framework-managed object — where
there is nothing to type and strategy 2 is the only route. That is the case the annotation was
written for, and Mockito's own framing agrees: *"Mockito is not an dependency injection framework,
don't expect this shorthand utility to inject a complex graph of objects."*

**★ You delete `@InjectMocks` and initialise the SUT at its declaration. What breaks?**
Every collaborator is `null`. `MockitoExtension` implements `BeforeEachCallback`, not
`TestInstancePostProcessor`, so the `@Mock` fields are assigned after the test instance — and all
its field initialisers — have already been constructed. The initialiser captured `null` references
and keeps them. Move the construction into `@BeforeEach`.

**★ Your SUT takes seven collaborators and the manual construction is unwieldy. What now?**
Notice what the annotation was hiding. Seven collaborators is the design signal, and the answer is
to extract a cohesive group of them into one collaborator, which is the same refactor
[10c](10c-the-refactor-that-removes-the-need.md) applies to a stubbed self-call. Until then, a
private factory method in the test class costs one line per test class and keeps the compiler
involved.

**★ Can `@InjectMocks` inject an in-memory fake?**
No. The candidate set is mocks and spies — either annotated, or fields already holding something
`MockUtil.isMock` recognises. A hand-written fake is neither, so it is invisible to injection, and
if the corresponding SUT field is non-final a matching mock may be written over it instead. Mixing
doubles of different kinds requires constructing the SUT yourself, which is exactly what
[12](12-mocks-vs-fakes.md) asks you to do.

{/* FOOTER */}
