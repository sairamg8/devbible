---
title: "ArgumentCaptor.forClass(List.class) cannot produce a captor for a List of String because a class literal has no type arguments, and the @Captor annotation solves it not by magic but by reading the field or parameter's generic signature back out of the class file — which is also why the type it recovers is only the erasure"
sidebar_label: "06b · Captors and generics"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> [`ArgumentCaptor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentCaptor.java)
> (`forClass`, `captor`, class javadoc),
> [`Captor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Captor.java),
> [`CaptorAnnotationProcessor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/configuration/CaptorAnnotationProcessor.java),
> [`GenericMaster`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/util/reflection/GenericMaster.java),
> [`CapturingMatcher`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/matchers/CapturingMatcher.java),
> [`CaptorParameterResolver`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-extensions/mockito-junit-jupiter/src/main/java/org/mockito/junit/jupiter/resolver/CaptorParameterResolver.java),
> section 21 of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> and Mockito's own tests `ArgumentCaptorTest` and `CaptorAnnotationTest`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[06 · Argument captors](06-argument-captors.md) showed the captor as a matcher that records.
This chunk is the one thing about captors that costs people an afternoon: you cannot hand
`forClass` a class literal for a generic type, because `List<String>.class` is not a thing you
can write. The two annotation-driven answers — `@Captor` on a field and `@Captor` on a test
method parameter — both work the same way, by recovering the type argument from a place where
the compiler still writes it down. The two code-driven answers, `ArgumentCaptor.captor()` and
the explicit cast, are [06c · The captor() factory](06c-the-captor-factory.md); what the
resulting captor then checks at runtime is
[06d · Captor type checking](06d-captor-type-checking.md); and multiplicity, varargs and the
empty captor are [06e · Captors and multiplicity](06e-captors-and-multiplicity.md).**

## Why the obvious thing does not work

You want to capture the `List<String>` that was passed to `notify`:

```java
// what you want to write
ArgumentCaptor<List<String>> captor = ArgumentCaptor.forClass(List<String>.class);
```

`List<String>.class` is not valid Java. A class literal names a *class*, and there is exactly
one `List` class at runtime; generics are erased. So the only literal available is
`List.class`, whose static type is `Class<List>` — with the **raw** `List`, not `List<String>`.

Mockito's factory at 5.23.0 is declared like this:

```java
public static <U, S extends U> ArgumentCaptor<U> forClass(Class<S> clazz) {
    return new ArgumentCaptor<>(clazz);
}
```

Two type variables, not one. `U` is the type the captor exposes (inferred from the assignment
target); `S` is the type the `Class` literal names, constrained to be a subtype of `U`. That
two-variable shape landed with the 5.0.0 type-checking change — the older single-variable
`forClass(Class<T>)` made `ArgumentCaptor<List<String>> c = forClass(List.class)` an outright
incompatible-types error, because `Class<List>` is not `Class<List<String>>`.

Mockito states the consequence itself, in the `captor()` javadoc:

> *"This enables inferring the generic type of an argument captor without providing a raw class
> reference, which enables working around generic limitations of the Java compiler **without
> producing compile-time warnings unlike `forClass` which would require explicit casting or
> warning suppression**."*

⚠️ **What I could not confirm from the documentation:** the exact javac diagnostic
`ArgumentCaptor<List<String>> c = ArgumentCaptor.forClass(List.class);` produces under the
5.x two-variable signature — whether it is an unchecked warning or a hard inference error
depends on how the compiler reduces the bound `S <: U` when `S` is the raw `List`. There is no
sandbox here and I will not invent a compiler transcript. What the javadoc *does* settle is
that `forClass` for a generic type needs *"explicit casting or warning suppression"* and that
the other three routes need neither. Use one of them and the question never arises.

## Answer 1 — `@Captor` on a field

```java
@ExtendWith(MockitoExtension.class)
class NotifierTest {

    @Mock Channel channel;
    @Captor ArgumentCaptor<List<String>> recipients;

    @Test
    void notifies_every_subscriber() {
        new Notifier(channel).notifyAll(Set.of("a@x", "b@x"));

        verify(channel).send(recipients.capture());

        assertThat(recipients.getValue()).containsExactlyInAnyOrder("a@x", "b@x");
    }
}
```

No cast, no `@SuppressWarnings`. Section 21 of the `Mockito` javadoc says exactly why the
annotation exists:

> *"`@Captor` simplifies creation of `ArgumentCaptor` — useful when the argument to capture is a
> nasty generic class and you want to avoid compiler warnings"*

and the `Captor` javadoc repeats it:

> *"One of the advantages of using `@Captor` annotation is that you can avoid warnings related
> capturing complex generic types."*

### How it recovers the type

A field's generic signature survives into the class file, so reflection can read it back. That
is the whole trick:

```java
// CaptorAnnotationProcessor
public Object process(Captor annotation, Field field) {
    Class<?> type = field.getType();
    if (!ArgumentCaptor.class.isAssignableFrom(type)) {
        throw new MockitoException("@Captor field must be of the type ArgumentCaptor. …");
    }
    Class<?> cls = new GenericMaster().getGenericType(field);
    return ArgumentCaptor.forClass(cls);
}
```

```java
// GenericMaster — "Finds the generic type (parametrized type) of the field.
//                  If the field is not generic it returns Object.class."
private Class<?> getaClass(Type generic) {
    if (generic instanceof ParameterizedType) {
        Type actual = ((ParameterizedType) generic).getActualTypeArguments()[0];
        if (actual instanceof Class) {
            return (Class<?>) actual;
        } else if (actual instanceof ParameterizedType) {
            // in case of nested generics we don't go deep
            return (Class<?>) ((ParameterizedType) actual).getRawType();
        }
    }
    return Object.class;
}
```

🔴 Read the three branches, because they decide what the captor actually checks at runtime:

| Field declaration | `clazz` the captor is built with |
|---|---|
| `ArgumentCaptor<Person>` | `Person.class` |
| `ArgumentCaptor<List<String>>` | `List.class` — *"in case of nested generics we don't go deep"* |
| `ArgumentCaptor<List<List<String>>>` | `List.class` |
| `ArgumentCaptor` (raw) | `Object.class` — *"If the field is not generic it returns `Object.class`"* |
| `ArgumentCaptor<T>` in a generic base class | `Object.class` (a `TypeVariable` is neither branch) |

So `@Captor` gives you a compile-time-typed handle and an **erasure-level** runtime check. The
element type of the list is never checked by Mockito, and it cannot be — nothing in the JVM
knows it.

Mockito's own `CaptorAnnotationTest` declares
`@Captor ArgumentCaptor<List<List<String>>> genericsCaptor;` for precisely this case.

### What `@Captor` rejects

- **A field that is not an `ArgumentCaptor`.** `@Captor List<?> wrongType;` throws
  `MockitoException` with *"@Captor field must be of the type ArgumentCaptor."*
- **Two Mockito annotations on one field.** `@Captor @Mock ArgumentCaptor<List> f;` fails with a
  message containing *"multiple Mockito annotations"*.
- Fields in **superclasses are scanned**, so a captor declared in an abstract test base is
  initialised for the subclass.

## Answer 2 — `@Captor` on a test-method parameter

With `MockitoExtension`, a captor can be a parameter. `CaptorParameterResolver` supports any
parameter annotated `@Captor` and runs the same `CaptorAnnotationProcessor` over
`Parameter#getParameterizedType()`:

```java
@ExtendWith(MockitoExtension.class)
class NotifierTest {

    @Mock Channel channel;

    @Test
    void notifies_every_subscriber(@Captor ArgumentCaptor<List<String>> recipients) {
        new Notifier(channel).notifyAll(Set.of("a@x", "b@x"));

        verify(channel).send(recipients.capture());
        assertThat(recipients.getValue()).containsExactlyInAnyOrder("a@x", "b@x");
    }
}
```

This is strictly better than the field when only one test uses the captor: the captor's
lifetime is the method, not the class, so it cannot be accidentally shared, and the reader sees
its declaration next to its use. It is a JUnit 5 parameter resolver
([../01-junit-5/10c-resolving-parameters.md](../01-junit-5/10c-resolving-parameters.md)), so it
does not exist under the JUnit 4 runner or rule.



## Gotchas

**★ `@Captor` on a raw `ArgumentCaptor` field silently becomes `Object.class`.**
`GenericMaster` returns `Object.class` when the field is not parameterized. The captor then
matches every argument, including ones of a completely different type, so a `verify` that should
have failed on the wrong overload passes. Always parameterize the field:

```java
@Captor ArgumentCaptor          loose;         // clazz = Object.class — matches anything
@Captor ArgumentCaptor<Person>  precise;       // clazz = Person.class
```

**★ `@Captor ArgumentCaptor<T>` in a generic test base class also becomes `Object.class`.**
The field's actual type argument is a `TypeVariable`, which is neither of `GenericMaster`'s two
handled branches, so it falls through to `Object.class`. Declare the captor in the concrete
subclass with the concrete type, or build it in the test method with
[`ArgumentCaptor.captor()`](06c-the-captor-factory.md), where the compiler knows what `T` is at
the call site.

**★ `@Captor ArgumentCaptor<List<String>>` gives you `List.class`, not "a list of strings".**
`GenericMaster` says so in a comment — *"in case of nested generics we don't go deep"* — and
returns the raw type of the nested `ParameterizedType`. The compile-time API is precise; the
runtime check is not, and it cannot be. Anything about the element type has to be asserted
after the capture.

**★ `@Captor` on a field that is not an `ArgumentCaptor`.**
`CaptorAnnotationProcessor` throws `MockitoException` with *"@Captor field must be of the type
ArgumentCaptor."* — the annotation cannot create anything else. This bites when someone
annotates the `List<String>` they intended to assert on rather than the captor that produces it.

**★ `@Captor` combined with `@Mock` on one field.**
Rejected during scanning with a message containing *"multiple Mockito annotations"*. The two do
opposite things: one creates a mock, the other creates a matcher. Mockito's own
`CaptorAnnotationTest` pins this with `@Captor @Mock ArgumentCaptor<List> missingGenericsField;`.

**★ A `@Captor` parameter does not work under the JUnit 4 runner or rule.**
`CaptorParameterResolver` is a JUnit Jupiter `ParameterResolver` shipped in
`mockito-junit-jupiter`. On JUnit 4 the only options are the field annotation,
[`captor()`](06c-the-captor-factory.md) or `forClass`.

**★ A `@Captor` field is shared by every test in the class, and it is not the annotation's
fault.**
`MockitoExtension` re-initialises annotated fields before each test, so the captor itself is
fresh — but if you declare it as a field when only one test uses it, the next person adds a
second test, reuses it, and now two verifications accumulate into one `getAllValues()`. The
parameter form makes that impossible. See
[06e · Captors and multiplicity](06e-captors-and-multiplicity.md).

**★ `@Captor` on a field in a superclass is initialised — including one you did not know was
there.**
Mockito scans the whole type hierarchy (`shouldLookForAnnotatedCaptorsInSuperClasses` in its own
test suite). An abstract test base that declares `@Captor ArgumentCaptor<Event> events;` gives
every subclass a captor whether it wants one or not.

## Interview questions

**★ Why can't you write `ArgumentCaptor.forClass(List<String>.class)`?**
Because that is not valid Java. Class literals name classes, and generics are erased, so there
is exactly one `List` class object at runtime. The only literal available is `List.class`, whose
static type is `Class<List>` with the raw `List`. `forClass` needs the type argument, and the
literal cannot carry it — which is why every workaround is really "find somewhere else the
compiler recorded the type argument, and read it from there".

**★ How does `@Captor` know the generic type when `forClass` cannot?**
A field's generic signature is written into the class file and survives to runtime, so
reflection can read it back. `CaptorAnnotationProcessor` calls
`GenericMaster.getGenericType(field)`, which pulls the first actual type argument off the field's
`ParameterizedType` and hands the resulting `Class` to `forClass`. The compile-time type of the
field gives you the typed API; reflection gives Mockito the runtime class. Note that what it
recovers is the *erasure*: for `ArgumentCaptor<List<String>>` it recovers `List.class`, because
the code comments *"in case of nested generics we don't go deep"* and returns the raw type.

**★ What does `@Captor` do when the field's type argument is a type variable?**
Nothing useful: `GenericMaster` handles a `Class` and a nested `ParameterizedType` and returns
`Object.class` for everything else, and a `TypeVariable` is everything else. So a captor declared
`ArgumentCaptor<T>` in a generic base class is an `Object` captor — it matches every argument and
never rejects one. That is a silent loss of the 5.0.0 type check, not an error.

**★ Would you declare a captor as a field or as a parameter, and why?**
Parameter, when only one test needs it. A `@Captor` parameter is resolved by
`CaptorParameterResolver` for that invocation only, so its lifetime is the method: it cannot be
reused across two verifications by accident, and the reader sees the declaration next to the
`capture()` call. A field earns its place when several tests in the class capture the same type
and the duplication would be real.

{/* FOOTER */}
