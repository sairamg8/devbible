---
title: "spy(Class) and the no-initialiser @Spy are not the same tool as spy(instance) — they build the object themselves, one through a real constructor and one through a zero-argument constructor even if it is private, which is why they can spy an abstract class and why they fail loudly in cases spy(instance) never reaches"
sidebar_label: "08c · Creating a spy without an instance"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §23 (*"Automatic instantiation"*) and §30 (*"Spying or mocking abstract classes"*), the
> javadoc and bodies of `Mockito.spy(Class)` and `Mockito.spy(T...)`,
> [`Spy`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Spy.java),
> [`MockSettings.useConstructor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/MockSettings.java),
> and `Reporter.cannotInitializeForSpyAnnotation` under
> `mockito-core/src/main/java/org/mockito/internal/exceptions/`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — every exception string on this page
> is assembled from `Reporter`'s own source, never from a console.

**[08](08-spies.md) is about `spy(someObject)`, where you built the object and Mockito copied
it. Three other forms build the object for you — `@Spy` with no initialiser, `spy(Class)`, and
the argument-less `spy()` — and they are a genuinely different mechanism: there is no instance
to copy, so a constructor runs instead. That is what makes them the only way to spy an abstract
class, and it is why they can fail at points `spy(instance)` never reaches.**

## `@Spy` without an instance

`@Spy PricingRules rules;` with no initialiser makes Mockito construct the object for you. The
annotation's javadoc states the rule and its limits:

> *"A field annotated with @Spy can be initialized explicitly at declaration point.
> Alternatively, if you don't provide the instance Mockito will try to find zero argument
> constructor (even private) and create an instance for you. **But Mockito cannot instantiate
> inner classes, local classes, abstract classes and interfaces.**"*

The javadoc's own example is worth keeping, because it surprises people that a **private**
constructor is enough:

```java
public class Bar {
   private Bar() {}
   public Bar(String publicConstructorWithOneArg) {}
}
```

When it cannot, the failure is loud, not silent — `Reporter.cannotInitializeForSpyAnnotation`
assembles:

```text
Cannot instantiate a @Spy for 'rules' field.
You haven't provided the instance for spying at field declaration so I tried to construct the instance.
However, I failed because: <the cause>
Examples of correct usage of @Spy:
   @Spy List mock = new LinkedList();
   @Spy Foo foo; //only if Foo has parameterless constructor
   //also, don't forget about MockitoAnnotations.openMocks();
```

Those sentences are the library's, verbatim; the field name and cause are the placeholders it
fills in. Compare with [09 · @InjectMocks](09-injectmocks.md), where the equivalent failure is
mostly **not** reported.

## `spy(Class)` runs a real constructor — `spy(instance)` does not

The one-argument overload that takes a `Class` looks like a convenience for the instance form.
It is not the same thing at all. Its body:

```java
public static <T> T spy(Class<T> classToSpy) {
    return MOCKITO_CORE.mock(
            classToSpy, withSettings().useConstructor().defaultAnswer(CALLS_REAL_METHODS));
}
```

`useConstructor()` with no arguments means *"a parameter-less constructor will be called"*, per
`MockSettings.useConstructor`'s `@param` text. So:

| | Instance built by | Constructor runs | Fields |
|---|---|---|---|
| `spy(obj)` | you | yours already did | copied from `obj` |
| `spy(Foo.class)` | Mockito, via `useConstructor()` | **yes, the real no-arg one** | whatever that constructor set |
| `mock(Foo.class, CALLS_REAL_METHODS)` | Mockito, via Objenesis / native | **no** | all defaults |

That middle row is the whole reason `spy(Class)` exists, and the third row is the trap it
avoids. `mock(Foo.class, CALLS_REAL_METHODS)` gives you an object whose real methods run against
an object that was never constructed — every field `null` or zero. §16 warns about it directly:
*"Be sure the real implementation is 'safe'. If real implementation throws exceptions or depends
on specific state of the object then you're in trouble."* And `doCallRealMethod`'s javadoc gives
the recommendation this table is an argument for:

> *"**Mockito.spy() is a recommended way of creating partial mocks.** The reason is it guarantees
> real methods are called against correctly constructed object because you're responsible for
> constructing the object passed to spy() method."*

⚠️ The corollary nobody expects: **`spy(Foo.class)` can throw whatever `Foo`'s constructor
throws**, and it can do real work — open a connection, read a file, start a thread — before your
test has stubbed a thing. `spy(new Foo(...))` cannot surprise you that way, because you wrote
the construction.

## `spy(Class)` is how you spy an abstract class

This is the legitimate use, and §30 is where Mockito documents it:

> *"It is now possible to conveniently spy on abstract classes. Note that overusing spies hints
> at code design smells… Previously, spying was only possible on instances of objects. New API
> makes it possible to use constructor when creating an instance of the mock. This is
> particularly useful for mocking abstract classes because the user is no longer required to
> provide an instance of the abstract class."*

```java
//convenience API, new overloaded spy() method:
SomeAbstract spy = spy(SomeAbstract.class);

//Mocking abstract methods, spying default methods of an interface (only available since 2.7.13)
Function<Foo, Bar> function = spy(Function.class);

//Robust API, via settings builder:
OtherAbstract spy = mock(OtherAbstract.class, withSettings()
   .useConstructor().defaultAnswer(CALLS_REAL_METHODS));

//Mocking an abstract class with constructor arguments (only available since 2.7.14)
SomeAbstract spy = mock(SomeAbstract.class, withSettings()
  .useConstructor("arg1", 123).defaultAnswer(CALLS_REAL_METHODS));

//Mocking a non-static inner abstract class:
InnerAbstract spy = mock(InnerAbstract.class, withSettings()
   .useConstructor().outerInstance(outerInstance).defaultAnswer(CALLS_REAL_METHODS));
```

That listing is the javadoc's own, and it is worth keeping whole because each line answers a
different question. Three things to read out of it:

- **`spy(Class)` itself is no-arg only.** Constructor arguments require the settings builder:
  `withSettings().useConstructor("arg1", 123)`. §30 says so explicitly — *"At the moment, only
  parameter-less constructor is supported, let us know if it is not enough"* — and the
  `useConstructor(Object... args)` overload is the escape hatch, `@since 2.7.14`.
- **A non-static inner class needs `outerInstance(...)`**, because it has an implicit outer
  reference the constructor demands.
- **Interface default methods can be spied** since 2.7.13. The abstract methods return type
  defaults ([08b](08b-what-a-spy-can-intercept.md)); the `default` bodies actually run.

## `spy()` with no arguments is `spy(Class)`, not `spy(instance)`

Since 4.10.0 there is an argument-less form using the same reified-varargs trick as
`mock()` and `captor()`:

```java
Bar bar = Mockito.spy();
```

Its body is `return spy(getClassOf(reified));` — so it lands on **`spy(Class)`**, with
`useConstructor()` and a real constructor call. It is not a shorthand for spying an instance,
and there is no instance for it to copy. The type inference has the same limits as `mock()`,
which [02c · Choosing a mock maker](02c-choosing-a-mock-maker.md) sets out: it works *"only if
you assign result of `mock()` or `spy()` to a variable or field with an explicit type"*, so
`var bar = spy();` cannot work.

The overload also guards its own misuse:

```java
if (reified.length > 0) {
    throw new IllegalArgumentException(
            "Please don't pass any values here. Java will detect class automagically.");
}
```

🔴 That guard matters more for `spy` than for `mock`, because `spy(someObject)` is a *valid,
completely different* method. `spy(x)` binds to `spy(T object)` and copies `x`; `spy()` binds to
the varargs form and constructs. One character of difference, two mechanisms.

## The `@Spy` initialisation order trap

`Spy`'s javadoc closes with a warning that applies to `@Mock` and `@InjectMocks` equally, and it
is the kind of thing that produces a `null` field with no explanation:

> *"**One last warning:** if you call `MockitoAnnotations.openMocks(this)` in a super class
> **constructor** then this will not work. It is because fields in subclass are only
> instantiated after super class constructor has returned. It's better to use @Before."*

Under JUnit 5 you would normally be on `MockitoExtension` and never call `openMocks` yourself —
[02 · Creating mocks](02-creating-mocks.md) — but base classes that predate the extension still
carry this pattern, and the symptom (an initialised `@Spy` field that is somehow `null`) reads
like a Mockito bug rather than a JLS initialisation-order fact.

## Gotchas

**★ Reaching for `spy(Foo.class)` when you meant `spy(new Foo())`.**
`spy(Class)` calls a real no-argument constructor. If `Foo()` opens a connection, reads
configuration or starts a thread, that happens during test setup, before you have stubbed
anything, and any exception it throws surfaces at the `spy(...)` line.

**★ Assuming `spy(Foo.class)` and `mock(Foo.class, CALLS_REAL_METHODS)` are the same.**
They differ in exactly the way that matters: `spy(Class)` adds `useConstructor()`, so the object
is constructed. The `CALLS_REAL_METHODS` form is not, so real methods execute against an object
whose every field is `null` or zero.

**★ Expecting `spy(Class)` to accept constructor arguments.**
It does not — §30: *"At the moment, only parameter-less constructor is supported."* Use
`mock(Foo.class, withSettings().useConstructor(arg1, arg2).defaultAnswer(CALLS_REAL_METHODS))`.

**★ Spying a non-static inner class without `outerInstance(...)`.**
The implicit outer reference is a constructor parameter Mockito cannot invent. The settings
builder has `outerInstance(...)` for exactly this; `spy(Class)` has no way to express it.

**★ `@Spy` on a field whose type has no zero-argument constructor.**
Mockito tries to build it and reports *"Cannot instantiate a @Spy for '…' field."* Give the
field an initialiser — `@Spy Foo foo = new Foo(dependency);` — which is what the javadoc's first
example does.

**★ `@Spy` on an interface, an abstract class, an inner class or a local class, with no
initialiser.** The javadoc rules them out: *"Mockito cannot instantiate inner classes, local
classes, abstract classes and interfaces."* For an abstract class the answer is `spy(Class)` or
`withSettings().useConstructor()`, not `@Spy`.

**★ Writing `spy()` and expecting it to spy something.**
The argument-less form routes to `spy(Class)` and constructs a fresh object. There is nothing to
copy. If you wanted the instance form you have to pass the instance.

**★ `var thing = spy();`**
There is no target type, so the reified trick cannot infer anything. The same restriction
applies to passing `spy()` directly as a method argument. Declare the variable with its explicit
type.

**★ `openMocks(this)` in a superclass constructor.**
Subclass fields are not initialised yet, so a `@Spy` field with an initialiser is still `null`
when Mockito looks at it. Move the call to `@BeforeEach`, or use `MockitoExtension`.

**★ Spying an abstract class and forgetting the abstract methods are not implemented.**
`CALLS_REAL_METHODS` returns the type default for abstract methods rather than calling anything
— [08b](08b-what-a-spy-can-intercept.md). The concrete template method you wanted to exercise
runs against `null`s unless you stub each hook.

## Interview questions

**★ When Mockito constructs a `@Spy` field for you, what constructor does it use, and what
happens when it cannot?**
A zero-argument constructor, *"even private"*. It cannot instantiate inner classes, local
classes, abstract classes or interfaces. Failure is loud: `cannotInitializeForSpyAnnotation`
produces *"Cannot instantiate a @Spy for 'rules' field. You haven't provided the instance for
spying at field declaration so I tried to construct the instance. However, I failed because:
…"*, followed by the three usage examples. That is the exact opposite of `@InjectMocks`, whose
equivalent failure is mostly **not** reported at all — [09 · @InjectMocks](09-injectmocks.md).

**★ What is the difference between `spy(Foo.class)` and `spy(new Foo())`?**
`spy(new Foo())` copies the fields of an object you constructed into a new instance; no
constructor of yours runs during mock creation. `spy(Foo.class)` is
`mock(Foo.class, withSettings().useConstructor().defaultAnswer(CALLS_REAL_METHODS))` — Mockito
constructs the object itself by calling the real parameter-less constructor. So `spy(Class)` can
execute your constructor's side effects and throw your constructor's exceptions at the moment
the spy is created, and it is the only form that can spy an abstract class.

**★ How do you spy an abstract class, and what do its abstract methods do?**
`spy(SomeAbstract.class)`, or `mock(SomeAbstract.class, withSettings().useConstructor(args)
.defaultAnswer(CALLS_REAL_METHODS))` when the constructor takes arguments. The concrete methods
run for real. The abstract ones return the type default, because `CallsRealMethods` checks
`Modifier.isAbstract` and delegates to `RETURNS_DEFAULTS` — so a template method executed on
such a spy sees `null` from every hook you have not stubbed.

**★ Why is `spy(Foo.class)` recommended over `mock(Foo.class, CALLS_REAL_METHODS)`?**
Because of construction. Mockito's own javadoc for `doCallRealMethod` says
*"Mockito.spy() is a recommended way of creating partial mocks. The reason is it guarantees real
methods are called against correctly constructed object."* `mock(..., CALLS_REAL_METHODS)`
instantiates without running any constructor, so the real code executes against an object whose
fields are all `null` or zero — §16's *"Be sure the real implementation is 'safe'"* warning.

**★ What does the no-argument `Mockito.spy()` do?**
It is the reified-varargs form added in 4.10.0 and it delegates to **`spy(Class)`**, not to the
instance form: it constructs a fresh object via the real no-arg constructor. It requires an
explicit target type — an assignment to a typed variable or field — so `var x = spy();` cannot
compile to anything useful, and passing a value to it throws
`IllegalArgumentException("Please don't pass any values here. Java will detect class
automagically.")`.

**★ A `@Spy` field is initialised at its declaration and is still `null` in the test. What
would you look at first?**
Whether `MockitoAnnotations.openMocks(this)` is being called from a **superclass constructor**.
Subclass field initialisers run after the superclass constructor returns, so Mockito scans the
fields before they exist. The javadoc calls this out: *"It's better to use @Before."* Under
JUnit 5, use `MockitoExtension` and delete the manual call entirely.

{/* FOOTER */}
