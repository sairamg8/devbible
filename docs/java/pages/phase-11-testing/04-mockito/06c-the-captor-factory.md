---
title: "ArgumentCaptor.captor() takes a varargs parameter you are forbidden to pass, because the parameter exists only to force javac to allocate an array of the inferred type — which is the one place left in an erased language where a generic type survives to runtime"
sidebar_label: "06c · The captor() factory"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the `captor(U...)` and `forClass(Class)` declarations and javadoc in
> [`ArgumentCaptor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentCaptor.java),
> and Mockito's own
> [`ArgumentCaptorTest`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/test/java/org/mockito/ArgumentCaptorTest.java)
> (`captor_calls_forClass_with_the_inferred_argument`,
> `captor_called_with_explicit_varargs_is_invalid`).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[06b · Captors and generics](06b-captors-and-generics.md) covered the two answers that need an
annotation. This chunk is the two that do not: `ArgumentCaptor.captor()`, added in 5.7.0, and the
explicit cast that `forClass` still requires when nothing else will do. `captor()` is worth
understanding rather than copying, because the same reified-varargs trick appears in
`Mockito.mock()`, `Mockito.spy()` and `MockedStatic` inference, and once you see it you stop
being surprised by a method that throws if you pass it anything.**

## `ArgumentCaptor.captor()`, since 5.7.0

```java
ArgumentCaptor<Map<String, User>> captor = ArgumentCaptor.captor();
```

No annotation, no extension, no cast, no `@SuppressWarnings`. It works in a JUnit 4 test, in a
helper method, in a lambda — anywhere there is a target type to infer from.

```java
@SafeVarargs
@SuppressWarnings({"varargs", "unchecked"})
public static <U> ArgumentCaptor<U> captor(U... reified) {
    if (reified == null || reified.length > 0) {
        throw new IllegalArgumentException("Do not provide any arguments to the 'captor' call");
    }
    return forClass((Class<U>) reified.getClass().getComponentType());
}
```

### Why the parameter has to be there

`U...` compiles to a `U[]` parameter. At every call site javac must *allocate* that array, and to
allocate an array it must pick a concrete component type — the inferred `U`, which comes from the
assignment target. Arrays, unlike generic classes, are **reified**: the array object records its
component type in the JVM. So `reified.getClass().getComponentType()` reads back the very type
argument that erasure was supposed to have thrown away.

The javadoc says so:

> *"@param reified do not pass any value here. This is used to trick the compiler into reifying
> the return type without needing casts."*

and states the whole point of the factory:

> *"This enables inferring the generic type of an argument captor without providing a raw class
> reference, which enables working around generic limitations of the Java compiler **without
> producing compile-time warnings unlike `forClass` which would require explicit casting or
> warning suppression**."*

### What it recovers is still the erasure

The component type of a `Map<String, Object>[]` is `Map`, not `Map<String, Object>` — array
covariance is reified only one level deep. Mockito's own test pins it:

```java
@Test
public void captor_calls_forClass_with_the_inferred_argument() throws Exception {
    ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.captor();
    assertThat(captor.getCaptorType()).isEqualTo(Map.class);
}
```

`Map.class`. So `captor()` buys you the *compile-time* type without a cast — exactly the same
runtime behaviour as `@Captor`, and exactly the same erasure-level check described in
[06d · Captor type checking](06d-captor-type-checking.md).

### The guard is not advisory

```java
if (reified == null || reified.length > 0) {
    throw new IllegalArgumentException("Do not provide any arguments to the 'captor' call");
}
```

Mockito tests all three ways of getting this wrong:

```java
assertThatThrownBy(() -> ArgumentCaptor.captor(1234L))
        .isInstanceOf(IllegalArgumentException.class);
assertThatThrownBy(() -> ArgumentCaptor.captor("this shouldn't", "be here"))
        .isInstanceOf(IllegalArgumentException.class);
assertThatThrownBy(() -> ArgumentCaptor.<String>captor((String[]) null))
        .isInstanceOf(IllegalArgumentException.class);
```

The parameter is not a seed value, a default, or a hint about what to capture. It is a compiler
lever. Passing an explicit `null` array is rejected too, because a `null` array has no runtime
component type to read.

## 🔴 `captor()` needs a target type, so `var` breaks it

```java
var captor = ArgumentCaptor.captor();               // ArgumentCaptor<Object>
ArgumentCaptor<Order> captor = ArgumentCaptor.captor();  // ArgumentCaptor<Order>
```

`U` is inferred from context. `var` supplies no context, so `U` resolves to its bound, `Object`,
and you get an `Object` captor that matches everything and forces a cast at `getValue()`. It
compiles cleanly, which is the problem. The same applies to passing `captor()` straight into a
method whose parameter is `ArgumentCaptor<?>`.

This is the one place `@Captor` is more robust: a field or parameter declaration always supplies
the type.

## `forClass` with the cast, when there is no other option

Sometimes there is no field, no parameter and no target type — a factory method that returns a
captor is the usual case, and there the return type *is* the target, so `captor()` still works:

```java
static ArgumentCaptor<List<String>> listCaptor() {
    return ArgumentCaptor.captor();   // target type = the return type. Fine.
}
```

The genuinely stuck case is one where you have a `Class` object in hand and no static type at
all — reflective test infrastructure, a parameterized test that captures a type supplied as an
argument. Then:

```java
@SuppressWarnings("unchecked")
static ArgumentCaptor<List<String>> listCaptor() {
    return ArgumentCaptor.forClass((Class<List<String>>) (Class<?>) List.class);
}
```

The double cast through `Class<?>` is not superstition. `Class<List>` and `Class<List<String>>`
have no subtype relation in **either** direction — `Class` is invariant in its type parameter —
so a direct cast is a compile error and you must widen to the wildcard first. The
`@SuppressWarnings("unchecked")` is the *"warning suppression"* the javadoc names.

⚠️ Note what the cast buys and what it does not: the captor's compile-time type becomes
`ArgumentCaptor<List<String>>`, and its runtime `clazz` is `List.class` — identical to what
`@Captor` and `captor()` produce. All four routes converge on the same object. The only
difference is how much noise the declaration carries.

## The four routes side by side

| Route | Needs | Cast / warning | Available where |
|---|---|---|---|
| `@Captor` field | annotation processing (`MockitoExtension`, runner, rule, `openMocks`) | none | anywhere annotations are processed |
| `@Captor` parameter | `MockitoExtension` | none | JUnit Jupiter only |
| `ArgumentCaptor.captor()` | a target type | none | anywhere, since 5.7.0 |
| `forClass` + double cast | nothing | `@SuppressWarnings("unchecked")` | anywhere |
| `forClass(Person.class)` | nothing | none | non-generic types only |

## Gotchas

**★ `ArgumentCaptor.forClass(List.class)` assigned to an `ArgumentCaptor<List<String>>`.**
A class literal has no type arguments; `Class<List>` is not `Class<List<String>>` and never
converts to it. Mockito's own javadoc says `forClass` here *"would require explicit casting or
warning suppression"*. Reach for `captor()` or `@Captor` instead — both produce an identical
captor with no cast at all.

**★ `ArgumentCaptor.captor(something)` throws `IllegalArgumentException`.**
`if (reified == null || reified.length > 0) throw …`. The varargs parameter exists only so javac
allocates a typed array; it is never read as data. Even `ArgumentCaptor.<String>captor((String[])
null)` is rejected, because a null array carries no component type.

**★ `var captor = ArgumentCaptor.captor();` silently gives you `ArgumentCaptor<Object>`.**
`captor()`'s type variable is inferred from the target type, and `var` provides none, so `U`
falls back to `Object`. The captor then matches every argument — the 5.0.0 type check becomes a
no-op — and `getValue()` returns `Object`. Write the type out:
`ArgumentCaptor<Order> captor = ArgumentCaptor.captor();`.

**★ Passing `captor()` directly as an argument infers from the *parameter*, not from what you
meant.**
`verify(mock).save(ArgumentCaptor.captor().capture())` has nothing sensible to infer from and is
unreadable besides. Always assign the captor to a named, explicitly typed local first — you need
the reference afterwards to call `getValue()` anyway.

**★ A single cast `(Class<List<String>>) List.class` does not compile.**
`Class` is invariant, so `Class<List>` and `Class<List<String>>` are unrelated and the cast is
rejected outright, not merely warned about. You have to go through `(Class<?>)` first. If you
find yourself writing this, check whether the return type or the assignment target could have
supplied the inference to `captor()` instead.

**★ `captor()` does not exist before Mockito 5.7.0.**
It is `@since 5.7.0`. A project on an older 5.x or on 4.x has only `@Captor` and the cast. Boot
4.1.0 manages 5.23.0, so this is a problem only for a module that pins Mockito itself — check
`mvn dependency:tree` before assuming.

**★ Neither `captor()` nor `@Captor` makes the runtime check any tighter.**
All four routes end at `new ArgumentCaptor<>(clazz)` with an erased `clazz`. They differ in
compile-time ergonomics and nothing else. If you thought `captor()` gave you element-type
checking, see [06d · Captor type checking](06d-captor-type-checking.md).

## Interview questions

**★ What does `ArgumentCaptor.captor()` do, and why does it take a varargs parameter you must not
pass?**
`captor(U... reified)` compiles to a method with a `U[]` parameter, so at every call site javac
has to allocate an array whose component type is the inferred `U` — inferred from the assignment
target. Arrays are reified, so that component type survives into the JVM, and the method reads it
back with `reified.getClass().getComponentType()` before delegating to `forClass`. The parameter
is a compiler lever, not data; the method throws `IllegalArgumentException` if you pass anything,
including an explicit null array. It exists to avoid the *"explicit casting or warning
suppression"* the javadoc says `forClass` needs for generic types.

**★ Why does `var captor = ArgumentCaptor.captor();` behave differently from
`ArgumentCaptor<Order> captor = ArgumentCaptor.captor();`?**
Because the whole mechanism depends on a target type. With an explicit declared type, `U` is
inferred as `Order`, javac allocates an `Order[]`, and the captor's runtime class is
`Order.class`. With `var` there is nothing to infer from, so `U` resolves to `Object`, javac
allocates an `Object[]`, and the captor's class is `Object.class` — it matches every argument and
the type check does nothing. The code compiles either way, which is why this is a review comment
rather than a compiler error.

**★ Why does `(Class<List<String>>) List.class` need a cast through `Class<?>`?**
`Class` is invariant in its type parameter, so `Class<List>` is neither a subtype nor a supertype
of `Class<List<String>>` and the direct cast is rejected at compile time, not merely warned
about. Casting to the wildcard `Class<?>` first erases the relationship, and the second cast is
then an unchecked one that the compiler permits with a warning — which is what
`@SuppressWarnings("unchecked")` is silencing.

**★ Given four ways to build a generic captor, which do you use and when?**
`@Captor` parameter when a single JUnit 5 test needs it — narrowest scope. `@Captor` field when
several tests in the class share the type. `ArgumentCaptor.captor()` everywhere else, including
JUnit 4 and helper methods, as long as there is a target type. The `forClass` double cast only
when you genuinely have a `Class` object and no static type — reflective test infrastructure. All
four produce an identical runtime object, so the choice is purely about how much noise sits in
the declaration.

{/* FOOTER */}
