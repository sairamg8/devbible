---
title: "A Mockito spy is not a wrapper placed around your object, it is a copy of it — and that one sentence out of the spy() javadoc explains why the original never sees the calls, why the spy never sees what you do to the original afterwards, why self-calls inside the real code ARE stubbable, and why a field that could not be copied is silently left at its default"
sidebar_label: "08 · Spies"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §13 (*"Spying on real objects"*) and the javadoc of `Mockito.spy(Object)`,
> [`Spy`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Spy.java),
> [`MockSettings.spiedInstance`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/MockSettings.java),
> [`MockMaker.createSpy`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/plugins/MockMaker.java),
> [`AdditionalAnswers.delegatesTo`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/AdditionalAnswers.java),
> and the bodies of `MockUtil.createMock` and `LenientCopyTool` under
> `mockito-core/src/main/java/org/mockito/internal/`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source and
> library source; every exception string is read out of Mockito's own `Reporter` or `Mockito`,
> never out of a console.

**Almost every confusing thing a spy does follows from one design decision, and the javadoc
states it in a single sentence: `spy(x)` does not put a recording jacket on `x`, it builds a
new object of `x`'s class and copies `x`'s fields into it. Get that straight and the rest is
mechanical. This chunk is the object model: how the copy is made, what it copies, what it
silently fails to copy, and what that leaves you holding. Which calls the generated subclass
can actually intercept is
[08b · What a spy can intercept](08b-what-a-spy-can-intercept.md); creating a spy with no
instance to copy is
[08c · Creating a spy without an instance](08c-creating-a-spy-without-an-instance.md); the
`when` / `doReturn` asymmetry is [08d · Stubbing a spy](08d-stubbing-a-spy.md); and
[08e · Partial mocks](08e-partial-mocks.md) is the design argument Mockito's own documentation
makes against the whole feature.**

## What a spy is

A mock created by `mock(Foo.class)` has no behaviour: every method returns the type's default
until you stub it ([03e · Unstubbed defaults](03e-unstubbed-defaults.md)). A spy is the
inverse. §13:

> *"You can create spies of real objects. When you use the spy then the **real** methods are
> called (unless a method was stubbed)."*
>
> *"Real spies should be used **carefully and occasionally**, for example when dealing with
> legacy code."*

Two creation forms take a real instance:

```java
List<String> real = new LinkedList<>();
List<String> spy  = Mockito.spy(real);          // programmatic

@Spy List<String> spy = new LinkedList<>();     // annotation, instance supplied
@Spy PricingRules rules;                        // annotation, Mockito constructs it
```

`spy(T object)` is not a distinct code path at all. Its body is two lines:

```java
public static <T> T spy(T object) {
    if (MockUtil.isMock(object)) {
        throw new IllegalArgumentException(
                "Please don't pass mock here. Spy is not allowed on mock.");
    }
    return MOCKITO_CORE.mock(
            (Class<T>) object.getClass(),
            withSettings().spiedInstance(object).defaultAnswer(CALLS_REAL_METHODS));
}
```

So a spy is exactly **a mock with two settings**: `spiedInstance(object)` and a default answer
of `CALLS_REAL_METHODS`. Everything a mock can do — verification, argument matchers, captors,
`reset` — a spy can do, because it *is* one. `MockSettings.spiedInstance`'s javadoc says the
same from the other direction:

> *"`Foo foo = mock(Foo.class, withSettings().spiedInstance(fooInstance));` — Below does
> exactly the same: `Foo foo = spy(fooInstance);`"*

Note `object.getClass()`. The spy's type is the **runtime** class of what you passed, not the
static type of the variable. `spy(someList)` where `someList` is a `LinkedList` produces a
`LinkedList` spy; where it is an anonymous class or a lambda, it produces a spy of that
synthetic class, with all the surprises that implies.

## 🔴 The copy — the sentence the whole page hangs on

From gotcha 2 of the `spy(Object)` javadoc, verbatim:

> *"Mockito **\*does not\*** delegate calls to the passed real instance, instead it actually
> creates a copy of it. So if you keep the real instance and interact with it, don't expect the
> spied to be aware of those interaction and their effect on real instance state. The corollary
> is that when an **\*un-stubbed\*** method is called **\*on the spy\*** but **\*not on the real
> instance\***, you won't see any effects on the real instance."*

And `spiedInstance`, blunter still: *"Sets the instance that will be spied. **Actually copies
the internal fields of the passed instance to the mock.**"*

The copying is done in `MockUtil.createMock`, and it has two paths:

```java
Object spiedInstance = settings.getSpiedInstance();
if (spiedInstance != null) {
    mock = mockMaker
            .createSpy(settings, mockHandler, (T) spiedInstance)      // path 1
            .orElseGet(() -> {
                T instance = mockMaker.createMock(settings, mockHandler);
                new LenientCopyTool().copyToMock(spiedInstance, instance);   // path 2
                return instance;
            });
}
```

**Path 1** is the mock maker's own spy support, and `MockMaker.createSpy`'s javadoc says why it
exists:

> *"a mock maker can optionally support the creation of spies where all fields are set within a
> constructor. This avoids problems when creating spies of classes that declare effectively
> final instance fields where setting field values from outside the constructor is
> prohibited."*

**Path 2** is `LenientCopyTool`, and its loop is worth reading because its failure mode is
invisible:

```java
private <T> void copy(T from, T to, Class<?> fromClazz) {
    while (fromClazz != Object.class) {         // walks the whole hierarchy
        copyValues(from, to, fromClazz);
        fromClazz = fromClazz.getSuperclass();
    }
}
// inside copyValues, per field:
if (Modifier.isStatic(field.getModifiers())) { continue; }   // static fields skipped
try {
    accessor.set(field, mock, accessor.get(field, from));
} catch (Throwable t) {
    // Ignore - be lenient - if some field cannot be copied then let's be it
}
```

Read the catch block again. **Every copy failure is swallowed, with no log and no exception.**
A field the accessor cannot write is left at the new object's default — `null`, `0`, `false` —
and the first symptom is a `NullPointerException` inside a real method that "obviously" has
that field set, because you can see it set on the object you passed to `spy()`.

Either path, the conclusion is identical and it is the thing to memorise: **there are now two
objects.**

## What "two objects" costs you, in code

```java
Basket real = new Basket();
Basket spy  = spy(real);

spy.add("apple");
real.add("pear");

// spy sees only "apple" — real.add() went to the other object
// real sees only "pear"  — spy.add() went to the copy
```

Three practical consequences:

1. **A reference you captured before `spy()` is not the spy.** If you built the object, handed
   it to a factory or a registry, and *then* spied it, production code is still holding the
   original and none of its calls will be recorded.
2. **The copy is shallow.** `LenientCopyTool` copies field *values*, so a `Map` field is the
   **same `Map` instance** in both objects. Mutating it through the original does show up in
   the spy — not because the spy delegates, but because they share the mutable object. That
   makes the "two objects" rule feel intermittent, which is why it is worth stating explicitly.
3. **Constructors are not re-run.** Path 2 creates the instance via the mock maker (Objenesis
   or the inline maker's native instantiation), so no constructor of yours executes; the state
   the object has is exactly what was copied. `spy(Class)` is the exception — it calls a real
   constructor — and it is [08c](08c-creating-a-spy-without-an-instance.md).

## Gotchas

**★ Spying an object you have already handed to production code.**
`spy()` builds a second object. The collaborator, factory or registry that received the
original is still holding the original, so nothing it does is recorded and nothing you stub
affects it. Spy first, then wire.

**★ Setting up the real object after calling `spy()`.**
`Basket real = new Basket(); Basket spy = spy(real); real.load(items);` — the load went into
the object nobody is testing. Finish the arrangement, then spy.

**★ Expecting the spy to see a field that could not be copied.**
`LenientCopyTool` swallows every copy failure with the comment *"Ignore - be lenient - if some
field cannot be copied then let's be it"*. The field is left at its default and the first
symptom is an NPE deep inside a real method. If a spy behaves as though it were freshly
constructed, this is why.

**★ Assuming `static` state travels with the spy.**
The copier explicitly skips static fields (`if (Modifier.isStatic(...)) continue;`). A class
with static caches or counters shares them with every other instance anyway — which is a
[11b · static-mocking design signal](11b-static-mocking-as-a-design-signal.md), not something
the spy can fix.

**★ Assuming the copy is deep.**
Field *values* are copied, so a `Map`, `List` or builder held in a field is the same object in
both. Mutation through the original is visible through the spy, which makes the "two objects"
rule look inconsistent unless you know it is reference copying.

**★ `spy(mock(Foo.class))`.**
`spy(Object)` starts with an explicit guard and throws
`IllegalArgumentException("Please don't pass mock here. Spy is not allowed on mock.")`. If you
want a mock that runs real methods, that is `mock(Foo.class, CALLS_REAL_METHODS)` — and it is a
different, more dangerous thing, covered in [08e](08e-partial-mocks.md).

**★ Spying an object with a `final` field under the fallback path.**
Path 1 (the mock maker's `createSpy`) sets fields in the constructor precisely to *"avoid
problems when creating spies of classes that declare effectively final instance fields"*. When
that path is not available and `LenientCopyTool` runs instead, a field it cannot write is
skipped silently. I could not settle from the documentation exactly which class shapes fall
back to path 2 on JDK 25 — what is documented is that a fallback exists and that its failures
are ignored.

## Interview questions

**★ What is a Mockito spy, mechanically?**
A mock with two settings: `spiedInstance(theObject)` and a default answer of
`CALLS_REAL_METHODS`. `Mockito.spy(obj)` is literally
`mock(obj.getClass(), withSettings().spiedInstance(obj).defaultAnswer(CALLS_REAL_METHODS))`.
Everything a mock supports — verification, matchers, captors, `reset` — a spy supports, because
it is one.

**★ Does a spy wrap the object you pass it?**
No. The javadoc is explicit: *"Mockito does not delegate calls to the passed real instance,
instead it actually creates a copy of it."* There are two objects afterwards. Calls on the
original are invisible to the spy, calls on the spy have no effect on the original, and the
copy happens once, at creation.

**★ Your spy NPEs on a field you can see is populated on the object you passed to `spy()`.
What happened?**
The field was not copied. `LenientCopyTool` walks the hierarchy, skips statics, and catches
`Throwable` around every single field write with the comment *"be lenient - if some field
cannot be copied then let's be it"*. Nothing is logged. The field sits at its default in the
copy. The inline mock maker's constructor-based spy path exists specifically to avoid this for
effectively-final fields, but where it does not apply, the silent skip is the behaviour.

**★ Why does `spy(new Foo())` refuse a mock argument?**
Because the result would be meaningless — a mock has no real state to copy and no real methods
to call — so `spy(Object)` guards on `MockUtil.isMock` and throws
`IllegalArgumentException("Please don't pass mock here. Spy is not allowed on mock.")`. If you
want real methods on an unconstructed object, that is `CALLS_REAL_METHODS`, and its own javadoc
warns the object was never constructed.

{/* FOOTER */}
