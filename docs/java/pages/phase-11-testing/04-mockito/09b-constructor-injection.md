---
title: "Constructor injection picks the constructor with the most parameters, breaks a tie by counting which parameter types Mockito thinks are mockable, resolves each one by pulling the first assignable element out of an unordered HashSet, and hands the constructor null for anything it could not find — so the object is built, the test runs, and one collaborator is null"
sidebar_label: "09b · Constructor injection"
sidebar_position: 37
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the [`@InjectMocks`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/InjectMocks.java)
> javadoc and the bodies of `ConstructorInjection`, `ConstructorInjection.SimpleArgumentResolver`,
> `FieldInitializer`, `FieldInitializer.ParameterizedConstructorInstantiator` and `Reporter` under
> `mockito-core/src/main/java/org/mockito/internal/`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — every exception string on this page
> is assembled from `Reporter`'s own source, and every behavioural claim is read from the library
> source, never from a console.

**[09](09-injectmocks.md) sets out the engine and which failures are loud. This is strategy 1 in
detail, because it is the one that runs for well-designed code — a class with a single explicit
constructor never reaches strategy 2 — and because two of its four rules are in the source and
not in the javadoc.**

## Constructor injection, exactly

The strategy is `ConstructorInjection`, and it delegates the hard part to
`FieldInitializer.ParameterizedConstructorInstantiator`. Four rules, all read from source.

**1 · The biggest constructor wins, with a tie-break nobody documents.**

```java
int argLengths = constructorB.getParameterTypes().length
               - constructorA.getParameterTypes().length;
if (argLengths == 0) {
    return countMockableParams(constructorB) - countMockableParams(constructorA);
}
return argLengths;
```

Sort descending by parameter count; on a tie, descending by **how many of the parameter types
Mockito considers mockable**. The javadoc says only *"the biggest constructor is chosen"*. So a
class with `Svc(A a, B b)` and `Svc(A a, String s)` prefers the first, because `String` is not
mockable — which is usually what you wanted, and is not something you could have predicted from
the documentation.

⚠️ The list being sorted is `Arrays.asList(clazz.getDeclaredConstructors())`, and the JVM does not
specify the order `getDeclaredConstructors()` returns. `Collections.sort` is stable, so a tie on
*both* keys resolves to declaration-reflection order, which is unspecified. Two constructors with
the same arity and the same mockable count is genuinely arbitrary.

**2 · If the biggest constructor has no parameters, the strategy declines.**

```java
if (constructor.getParameterTypes().length == 0) {
    throw new MockitoException("the field " + field.getName() + " of type "
            + field.getType() + " has no parameterized constructor");
}
```

`ConstructorInjection.processInjection` catches that `MockitoException` and returns `false`, so a
class with only a default constructor falls straight through to property/field injection. This is
why field injection works at all.

**3 · Each parameter is matched by taking the first assignable mock out of a `Set`.**

```java
private Object objectThatIsAssignableFrom(Class<?> argType) {
    for (Object object : objects) {
        if (argType.isAssignableFrom(object.getClass())) {
            return object;
        }
    }
    return null;
}
```

Three things follow, and all three surprise people:

- **Names are ignored entirely.** Constructor injection is type-only. The name matching in the
  javadoc belongs to strategy 2.
- **`objects` is `newMockSafeHashSet(...)` — an unordered `HashSet`.** With two `@Mock` fields of
  the same type, *"the first assignable one"* is whichever the hash order yields. It is
  deterministic per run but it is not the declaration order and you cannot rely on it.
- **No match returns `null`, and `null` is passed to the constructor.** The javadoc states this
  and people still miss it: *"If arguments can not be found, then null is passed."*

**4 · A primitive parameter with no match aborts the whole strategy.**
Passing `null` for an `int` makes `Constructor.newInstance` throw `IllegalArgumentException`,
which `FieldInitializer` wraps and `ConstructorInjection` catches:

```java
} catch (MockitoException e) {
    if (e.getCause() instanceof InvocationTargetException) {
        Throwable realCause = e.getCause().getCause();
        throw fieldInitialisationThrewException(field, realCause);   // your constructor threw
    }
    return false;                                                     // everything else: fall through
}
```

This is the javadoc's *"If non-mockable types are wanted, then constructor injection won't
happen"* — and it holds for **primitives**, not for reference types. A `String`, a `Duration` or a
`Clock` parameter is a perfectly legal `null`; an `int` or a `boolean` is not. State it that way
round or the note reads as if `null` is never passed at all.

## 🔴 The javadoc example that does not behave as described

The `@InjectMocks` javadoc closes with a case it labels *"And finally, no injection will happen on
the type in this case"*:

```java
public class ArticleManager {
    private ArticleDatabase database;
    private ArticleCalculator calculator;

    ArticleManager(ArticleObserver observer, boolean flag) {
        // observer is not declared in the test above.
        // flag is not mockable anyway
    }
}
```

Trace it. `ArticleManager` has one constructor, so it is the biggest. `observer` resolves to
`null` (no matching mock), `flag` resolves to `null` (nothing is assignable to `boolean`).
`newInstance` rejects `null` for a primitive, `ConstructorInjection` returns `false`, and
`PropertyAndSetterInjection` takes over — whose first act is to instantiate the field with a
**no-arg** constructor, of which this class has none.

So on the code path as written, this example does not quietly do nothing; it reaches
`Reporter.cannotInitializeForInjectMocksAnnotation`, which assembles:

```text
Cannot instantiate @InjectMocks field named 'manager'! Cause: the type 'ArticleManager' has no default constructor
You haven't provided the instance at field declaration so I tried to construct the instance.
Examples of correct usage of @InjectMocks:
   @InjectMocks Service service = new Service();
   @InjectMocks Service service;
   //and... don't forget about some @Mocks for injection :)
```

⚠️ **Stated with its provenance:** those sentences are `Reporter`'s, verbatim, and the trace is
read from `ConstructorInjection`, `FieldInitializer` and `PropertyAndSetterInjection` at
v5.23.0 — **not** from a test run, because there is no sandbox for this page. What is certain is
that the two code paths exist and that the javadoc's *"no injection will happen"* describes the
outcome for a class that also has a no-arg constructor, not for the class it prints. If you meet
this in practice and the exception does not appear, the discrepancy is worth reporting upstream
rather than assuming the documentation.

## Two shapes that change which strategy runs

**A record, or any class whose fields are all `final`.** Constructor injection is the *only*
strategy that can work: `PropertyAndSetterInjection` skips `final` and `static` fields outright —
the javadoc says so, *"However fields that are static or final will be ignored"* — so if the
canonical constructor cannot be satisfied, nothing else can. That is a feature. A record SUT
either gets a complete set of collaborators or fails visibly at first use, with no half-wired
middle state.

**An `@InjectMocks` field you initialised yourself.**

```java
@InjectMocks OrderService service = new OrderService(realPricing, repository);
```

`FieldInitializer.acquireFieldInstance` short-circuits when the field is already non-null:

```java
Object fieldInstance = accessor.get(field, fieldOwner);
if (fieldInstance != null) {
    return new FieldInitializationReport(fieldInstance, false, false);
}
```

`fieldWasInitializedUsingContructorArgs()` is that third `false`, so `ConstructorInjection` returns
`false` and the chain **relays to strategy 2 anyway**. Mockito does not re-construct your object —
and it does then walk its fields and overwrite any it can match against a mock. If you built the
object deliberately with a real collaborator, that collaborator can be replaced.
[09c · Property and field injection](09c-property-and-field-injection.md) has the mechanism; the
short version is that `@InjectMocks` with an initialiser is not the escape hatch it looks like.

⚠️ One more source detail worth knowing because it changes the error you see: `FieldInitializer`'s
constructor runs its "can this type be handled" checks — not local, not a non-static inner class,
not an interface, not an enum, not abstract — **only when the field is currently null**. An
initialised field of an otherwise unhandleable type therefore never trips them.

## When your constructor throws, Mockito does report it

The one loud failure inside strategy 1. `ConstructorInjection` re-raises rather than swallowing
when the cause is an `InvocationTargetException`, and `Reporter.fieldInitialisationThrewException`
assembles an `InjectMocksException`:

```text
Cannot instantiate @InjectMocks field named 'service' of type 'class com.example.OrderService'.
You haven't provided the instance at field declaration so I tried to construct the instance.
However the constructor or the initialization block threw an exception : <the cause's message>
```

So a constructor that validates its arguments — `Objects.requireNonNull(pricing)` — converts the
silent-null problem into an immediate, named failure. **That is a design lever, not a workaround:**
a SUT whose constructor rejects nulls cannot be half-wired by `@InjectMocks`, and the exception
names the field and the cause.

## Gotchas

**★ An `@InjectMocks` field arrives fully constructed with one collaborator `null`.**
Constructor injection passed `null` for the parameter it could not match, and the javadoc says it
will: *"If arguments can not be found, then null is passed."* Nothing is reported. The failure
surfaces as an NPE inside production code, in whichever test happens to reach that collaborator
first — possibly not the one you just wrote.


**★ Two `@Mock` fields of the same type going into a constructor.**
Resolution is *"the first assignable element"* of an unordered `HashSet`, with no name matching at
all in this strategy. Which mock lands in which parameter is arbitrary. If both are stubbed
identically you may never notice; if not, you get a failure that moves when you add a third mock.


**★ Assuming the parameter name matters.**
It does not, in constructor injection. `SimpleArgumentResolver` sees only `Class<?> argType`.
Name matching exists only in strategy 2, and only when more than one candidate survives the type
filter.


**★ Adding a second constructor and changing which one Mockito uses.**
"Biggest" is by parameter count, tie-broken by count of mockable parameter types. Adding a
convenience constructor with one more parameter silently reroutes injection through it.


**★ A primitive or `enum` constructor parameter.**
`null` cannot be passed for a primitive, so the whole constructor strategy aborts and falls
through to property/field injection — which, if there is no no-arg constructor, then throws. The
javadoc's *"If non-mockable types are wanted, then constructor injection won't happen"* is about
this case.


**★ An `@InjectMocks` field with an initialiser, expecting Mockito to leave it alone.**
It does not re-construct it, but it does fall through to field injection and can overwrite fields
you set deliberately. If you want full control, drop `@InjectMocks` and construct the SUT in the
test body.

**★ A SUT whose constructor does no validation.**
`Objects.requireNonNull` in the constructor turns the silent `null` into
`fieldInitialisationThrewException`, naming the field and the cause, before any test method runs.
Without it the `null` travels until something dereferences it.

**★ A `record` SUT that will not wire.**
Constructor injection is the only strategy available, because every component field is `final` and
strategy 2 skips final fields. Fix the mock set, not the annotation — there is no fallback to
rescue you.

**★ Assuming the `@InjectMocks` type checks (interface, abstract, inner, enum) always apply.**
`FieldInitializer` runs them only when the field is null. An initialised field of such a type
slips past them and produces a different failure later.

## Interview questions

**★ Which constructor does Mockito choose?**
The one with the most parameters. On a tie, the one with the most parameter types Mockito
considers mockable — that tie-break is in the source and not in the javadoc. A tie on both keys
falls back to the order `getDeclaredConstructors()` happened to return, which the JVM does not
specify.


**★ Your `@InjectMocks` service has a `null` repository and the test fails with an NPE somewhere
deep in production code. What happened?**
Constructor injection could not find a mock assignable to that parameter, so it passed `null` —
*"If arguments can not be found, then null is passed"* — and reported nothing, because
*"if any of the following strategy fail, then Mockito won't report failure."* Usually the cause
is a missing `@Mock` annotation, a collaborator created with `Mockito.mock(...)` instead, or a
type that does not match after a refactor.


**★ You have two mocks of the same type and one constructor taking both. Can you control which
goes where?** Not in constructor injection. The resolver returns the first element of an
unordered `HashSet` that is assignable to the parameter type, and it never looks at names. Field
or setter injection *does* consult names — but only when more than one candidate survives the
type filter. If the distinction matters, construct the object yourself.


**★ How do you make `@InjectMocks` fail loudly instead of leaving a `null`?**
Validate in the constructor. `Objects.requireNonNull(repository)` turns the unresolved parameter
into an `InvocationTargetException`, which `ConstructorInjection` deliberately re-raises as
`fieldInitialisationThrewException` — *"Cannot instantiate @InjectMocks field named 'service'…
However the constructor or the initialization block threw an exception"* — naming the field before
any test runs. It is the only mechanism inside strategy 1 that converts silence into a failure.

**★ Can `@InjectMocks` wire a record?**
Only through the canonical constructor. Every component field is `final`, and property/field
injection explicitly ignores `final` and `static` fields, so there is no second chance. In
practice that makes records the safest `@InjectMocks` target: either all parameters resolve or the
object is not usable, with no partially-wired state.

**★ You wrote `@InjectMocks Svc svc = new Svc(realThing);` and `realThing` was replaced by a mock.
Why?** Because an already-initialised field makes `ConstructorInjection` report *"not initialised
using constructor args"* and return `false`, so the chain relays to property and field injection —
which walks the object's fields and writes a matching mock into any non-final, non-static one,
whether or not you had already set it. If you want to control construction, do it in the test body
without the annotation.

{/* FOOTER */}
