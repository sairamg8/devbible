---
title: "@InjectMocks documents three injection strategies but the engine chains only two objects, and the first of them — constructor injection — picks the biggest constructor, resolves each parameter by taking the first assignable element out of an unordered HashSet, and passes null when it finds nothing, which is how a test ends up with a fully-built object holding a null collaborator and no warning of any kind"
sidebar_label: "09 · @InjectMocks"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the [`@InjectMocks`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/InjectMocks.java)
> javadoc, [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §21 and §23, and the bodies of `DefaultInjectionEngine`, `MockInjection`,
> `MockInjectionStrategy`, `ConstructorInjection`, `FieldInitializer` and `Reporter` under
> `mockito-core/src/main/java/org/mockito/internal/`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — every exception string on this page
> is assembled from `Reporter`'s own source, never from a console.

**`@InjectMocks` is four lines of chained strategies wrapped in an annotation that reads like
dependency injection. It is not dependency injection, its documentation says so, and the gap
between what its javadoc describes and what its code does is where the time goes. This chunk is
the engine and its reporting contract: what a candidate actually is, what gets scanned, which
failures are loud and which are silent. Strategy 1 in full is
[09b · Constructor injection](09b-constructor-injection.md); strategy 2 is
[09c · Property and field injection](09c-property-and-field-injection.md) with its matching rules
in [09d · The candidate filters](09d-the-candidate-filters.md); and
[09e · The case against @InjectMocks](09e-the-case-against-injectmocks.md) is the argument that
four words in the test body beat all of it.**

## What it is, in code

`DefaultInjectionEngine` is the whole thing:

```java
public void injectMocksOnFields(
        Set<Field> needingInjection, Set<Object> mocks, Object testClassInstance) {
    MockInjection.onFields(needingInjection, testClassInstance)
            .withMocks(mocks)
            .tryConstructorInjection()
            .tryPropertyOrFieldInjection()
            .handleSpyAnnotation()
            .apply();
}
```

🔴 **The javadoc lists three strategies; the engine chains two.** `@InjectMocks`'s javadoc
enumerates *"Constructor injection"*, *"Property setter injection"* and *"Field injection"* as
items 1, 2 and 3. The code has `ConstructorInjection` and `PropertyAndSetterInjection`, and the
second one does setters-then-fields internally — its own class comment is *"Inject mocks using
first setters then fields, if no setters available"*. Both descriptions are accurate; they just
count differently, and knowing there are two objects rather than three explains the fall-through
behaviour in [09c](09c-property-and-field-injection.md).

`MockInjectionStrategy.process` is a plain chain of responsibility:

```java
public boolean process(Field onField, Object fieldOwnedBy, Set<Object> mockCandidates) {
    if (processInjection(onField, fieldOwnedBy, mockCandidates)) {
        return true;                       // this strategy claimed it; stop
    }
    return relayProcessToNextStrategy(onField, fieldOwnedBy, mockCandidates);
}
```

`handleSpyAnnotation()` is registered separately as a **post**-injection strategy, so it runs
after whichever of the two succeeded — see [09c](09c-property-and-field-injection.md).

## The headline quote, and what it actually covers

> *"Mockito will try to inject mocks only either by constructor injection, property injection or
> setter injection in order and as described below. **If any of the following strategy fail, then
> Mockito won't report failure**; i.e. you will have to provide dependencies yourself."*

That sentence is true and it is also the most over-generalised sentence in the javadoc. Read
literally it suggests nothing ever throws. The source says otherwise. **Silent** means: a
strategy that cannot resolve a dependency gives up and lets the next one try, and the last one
leaves the field as it found it. **Loud** covers five specific failures, and it is worth knowing
which is which, because a stack trace you did get tells you something quite different from a
`null` you did not:

| Situation | Reported? | Where from |
|---|---|---|
| No mock matches a constructor parameter | **no** — `null` is passed | `ConstructorInjection` |
| The chosen constructor takes a primitive with no match | **no** — falls through to strategy 2 | `ConstructorInjection` catches |
| The class has only a no-arg constructor and no mock matches a field | **no** — field stays `null` | `PropertyAndSetterInjection` |
| `@InjectMocks` combined with `@Mock` or `@Captor` | **yes** | `InjectMocksScanner` |
| The `@InjectMocks` type cannot be instantiated at all | **yes** | `cannotInitializeForInjectMocksAnnotation` |
| Your constructor or initialiser block throws | **yes** | `fieldInitialisationThrewException` |
| Two mocks match one field and names do not disambiguate | **yes** | `moreThanOneMockCandidate` |
| A matching mock cannot be written to the field | **yes** | `cannotInjectDependency` |

The first three rows are the ones that cost an afternoon. Everything below the line produces a
`MockitoException` before your test method runs. The bottom three belong to strategy 2 and are
[09c](09c-property-and-field-injection.md)'s.


## 🔴 What counts as a candidate — the javadoc is narrower than the code

> *"Again, note that @InjectMocks will only inject mocks/spies created using the @Spy or @Mock
> annotation."*

That is the documented rule, and `MockScanner.preparedMock` is more generous than it:

```java
private Object preparedMock(Object instance, Field field) {
    if (isAnnotatedByMockOrSpy(field)) {
        return instance;
    }
    if (isMockOrSpy(instance)) {                                  // <- not in the javadoc
        MockUtil.maybeRedefineMockName(instance, field.getName());
        return instance;
    }
    return null;
}
```

A field with **no annotation at all** is a candidate if the value it already holds is a mock or a
spy — and Mockito then renames that mock after the field, which matters for the name-based
matching in [09c · Property and field injection](09c-property-and-field-injection.md). So this
works, despite the javadoc:

```java
private final PricingPolicy pricing = mock(PricingPolicy.class);   // field initialiser: a candidate
@InjectMocks OrderService service;
```

and this does not:

```java
private PricingPolicy pricing;
@BeforeEach void setUp() { pricing = mock(PricingPolicy.class); }   // too late
@InjectMocks OrderService service;
```

The difference is **timing, not annotation**. `MockitoExtension` implements JUnit's
`BeforeEachCallback`, and extension callbacks run before the user's `@BeforeEach` methods
([03 · The lifecycle](../01-junit-5/03-the-lifecycle.md)) — while field initialisers have already
run, because they are part of constructing the test instance. Scanning happens once, at that
moment. Reassigning a `@Mock` field later in the test does not re-inject anything: the object
already holds the reference it was given.

Not candidates under any circumstances: a real object you constructed, a `@Captor`, a Spring bean.

## The whole test-class hierarchy is scanned, in one pass

`InjectingAnnotationEngine.injectCloseableMocks` walks up from the test class:

```java
while (clazz != Object.class) {
    new InjectMocksScanner(clazz).addTo(mockDependentFields);
    new MockScanner(testClassInstance, clazz).addPreparedMocks(mocks);
    clazz = clazz.getSuperclass();
}
new DefaultInjectionEngine().injectMocksOnFields(mockDependentFields, mocks, testClassInstance);
```

Three consequences:

- **A `@Mock` declared in an abstract test base class is a candidate for an `@InjectMocks` field
  in the subclass**, and vice versa. That is usually what you wanted and it is also how a base
  class silently supplies a collaborator nobody reading the subclass can see.
- **Every `@InjectMocks` field gets the complete candidate set.** Injection is a single pass over
  `mockDependentFields` with the same `mocks` set; the per-class copies that get consumed live
  inside `PropertyAndSetterInjection`, so two `@InjectMocks` fields do not compete.
- **`mockDependentFields` is a `HashSet<Field>`**, so with more than one `@InjectMocks` field the
  processing order is unspecified. It does not usually matter — but it means you cannot rely on
  one `@InjectMocks` object being built before another.

## The one annotation combination that is rejected outright

`InjectMocksScanner` refuses two pairings at scan time:

```java
if (null != field.getAnnotation(InjectMocks.class)) {
    assertNoAnnotations(field, Mock.class, Captor.class);
    mockDependentFields.add(field);
}
```

producing:

```text
This combination of annotations is not permitted on a single field:
@Mock and @InjectMocks
```

`@Mock @InjectMocks` is contradictory — "mock this and also build it out of mocks" — and
`@Captor @InjectMocks` is nonsense. **`@Spy @InjectMocks` is not on the list and is explicitly
supported**, via the `handleSpyAnnotation()` post-strategy: it is the shape
[10 · Never mock the class under test](10-never-mock-the-class-under-test.md) exists to argue
against, and §21 attaches its own warning — *"This complexity is another good reason why you
should only use partial mocks as a last resort."*

And the class-level constraint, verbatim:

> *"the field `ArticleManager` annotated with `@InjectMocks` can have a parameterized constructor
> only or a no-arg constructor only, or both. All these constructors can be package protected,
> protected or private, however **Mockito cannot instantiate inner classes, local classes,
> abstract classes and of course interfaces. Beware of private nested static classes too.**"*

Finally, the sentence that should end most arguments about how far to push it:

> *"Mockito is not an dependency injection framework, don't expect this shorthand utility to
> inject a complex graph of objects be it mocks/spies or real objects."*

## Gotchas

**★ Forgetting `@Mock` on one collaborator.**
Same symptom, and it is the single most common cause. The field is not in the candidate set, so
its constructor parameter gets `null`. Compare with plain `new Sut(a, b, c)`, where the compiler
tells you immediately.

**★ Reading *"Mockito won't report failure"* as *"Mockito never throws"*.**
Five distinct failures do throw, listed in the table above. A `MockitoException` mentioning
`@InjectMocks` means something quite different from a `null` field, and the two need different
fixes.

**★ Mocking a collaborator with `Mockito.mock(...)` in `@BeforeEach` and expecting injection.**
Not because it lacks an annotation — `MockScanner` accepts any field already holding a mock — but
because injection has already happened. `MockitoExtension` is a `BeforeEachCallback` and runs
before your `@BeforeEach`. Move it to a field initialiser and it becomes a candidate.

**★ Reassigning a `@Mock` field inside the test and expecting the SUT to see the new mock.**
Injection ran once, at scan time, and handed the SUT a reference. Replacing the test field's value
afterwards changes only the test field. Stub the existing mock instead.

**★ `@Mock @InjectMocks` on one field.**
Rejected at scan time: *"This combination of annotations is not permitted on a single field: @Mock
and @InjectMocks"*. The same applies to `@Captor`. `@Spy @InjectMocks` is *not* rejected, which is
precisely the problem [10](10-never-mock-the-class-under-test.md) describes.

**★ A `@Mock` inherited from an abstract test base class.**
It is a candidate, because the engine walks the test class hierarchy. Convenient, and it means a
collaborator can be supplied to your SUT by a file you are not reading.

**★ `@InjectMocks` on an interface, abstract class, inner class or private nested static class.**
The javadoc rules all of them out and names the last one explicitly — *"Beware of private nested
static classes too."*

**★ Expecting `@InjectMocks` to build a graph.**
*"Mockito is not an dependency injection framework."* It injects one level, into one object. A
collaborator that itself needs collaborators has to be constructed by you.

## Interview questions

**★ What does `@InjectMocks` actually do?**
It runs `DefaultInjectionEngine`, which chains two strategies over the annotated field:
`ConstructorInjection` first, then `PropertyAndSetterInjection`, then a post-strategy that
re-wraps the result if the field is also `@Spy`. The first strategy that returns `true` stops the
chain. Candidates are only the mocks and spies created from `@Mock` and `@Spy` fields.

**★ The javadoc lists three strategies. How many are there really?**
Three described, two objects. `ConstructorInjection` handles the constructor; `PropertyAndSetterInjection`
handles both setter and field injection, trying a bean property setter first and falling back to
direct field access — *"Inject mocks using first setters then fields, if no setters available."*

**★ Is `@InjectMocks` really silent about every failure?**
No, and the javadoc's blanket sentence causes this misunderstanding. Unresolvable dependencies
are silent — `null` is passed or the field is left alone. But combining `@InjectMocks` with
`@Mock` or `@Captor`, failing to instantiate the type at all, a constructor that throws, an
ambiguous field with two matching mocks, and a field that cannot be written to all raise a
`MockitoException` before the test body runs.

**★ Why does a class with only a no-arg constructor still get its fields injected?**
Because constructor injection declines rather than fails. `biggestConstructor` throws *"has no
parameterized constructor"* when the winner has zero parameters, `ConstructorInjection` catches it
and returns `false`, and the chain relays to `PropertyAndSetterInjection`, which instantiates via
the no-arg constructor and then injects fields and setters.

**★ Does a mock have to be annotated `@Mock` to be injected?**
The javadoc says yes — *"@InjectMocks will only inject mocks/spies created using the @Spy or @Mock
annotation"* — and `MockScanner` says no. Its `preparedMock` accepts any field whose current value
`MockUtil.isMock` or `isSpy` recognises, and renames the mock after the field. So a
`private final Foo foo = mock(Foo.class);` field initialiser is a candidate. What actually
disqualifies a programmatically created mock is assigning it in `@BeforeEach`, which runs after
`MockitoExtension`'s callback has already injected.

**★ Are `@Mock` fields on a test superclass visible to an `@InjectMocks` field on the subclass?**
Yes. `InjectingAnnotationEngine` walks `clazz.getSuperclass()` up to `Object`, collecting both
`@InjectMocks` fields and mock candidates from every level, and then runs one injection pass with
the combined sets. It is convenient and it is also how a shared base class supplies a collaborator
that nothing in the subclass mentions.

**★ Which annotation combinations does `@InjectMocks` reject?**
`@Mock` and `@Captor`, both at scan time, with *"This combination of annotations is not permitted
on a single field"*. `@Spy` is deliberately allowed and is handled by a post-injection strategy
that re-wraps the injected object as a spy — the combination §21 warns about and
[10](10-never-mock-the-class-under-test.md) argues against.

**★ You reassign a `@Mock` field halfway through a test. Does the SUT see the new mock?**
No. Injection happened once, before the test method, and the SUT is holding the reference it was
handed. Changing the test class's field afterwards changes only the test class's field. If you
need different behaviour, stub the mock you already injected.

{/* FOOTER */}
