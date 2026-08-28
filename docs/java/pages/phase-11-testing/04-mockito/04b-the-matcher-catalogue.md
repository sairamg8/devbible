---
title: "any() matches null and anyString() does not, any(Class) stopped being an alias of any() in Mockito 2 and started matching varargs in Mockito 5, and every one of those changes silently turns a stubbing that used to match into one that quietly does not"
sidebar_label: "04b · The matcher catalogue"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc and every method javadoc and body in
> [`ArgumentMatchers`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentMatchers.java)
> (`any`, `any(Class)`, `isA`, the `anyX` family, `eq`, `refEq`, `same`, `isNull`, `notNull`,
> `isNotNull`, `nullable`, `contains`, `matches`, `startsWith`, `endsWith`).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[04 · Argument matchers](04-argument-matchers.md) explained why matchers behave the way they
do. This chunk is what each one actually matches — and it matters far more than a reference
table usually does, because the differences here fail *silently*. A matcher that does not match
does not throw: the stubbing simply never applies, the mock returns its default, and the test
fails three layers downstream with a `null`.**

## The type-check rule you will hit within a week

From the `ArgumentMatchers` class javadoc:

> *"Since Mockito `any(Class)` and `anyInt` family matchers perform a type check, thus they
> won't match `null` arguments. Instead use the `isNull` matcher."*

```java
// stubbing using anyBoolean() argument matcher
when(mock.dryRun(anyBoolean())).thenReturn("state");

// below the stub won't match, and won't return "state"
mock.dryRun(null);

// either change the stub
when(mock.dryRun(isNull())).thenReturn("state");
mock.dryRun(null); // ok

// or fix the code ;)
when(mock.dryRun(anyBoolean())).thenReturn("state");
mock.dryRun(true); // ok
```

🔴 **`any()` matches `null`. `anyString()`, `anyInt()`, `any(String.class)` do not.** The
distinction is documented on `any()` itself — *"Matches **anything**, including nulls"*.

The failure mode is silent: the stubbing simply does not match, so the mock falls back to its
default answer, and the test fails somewhere downstream with a `null` or a `0` rather than
with "your stubbing did not match". Under `STRICT_STUBS` you get much better news — a
`PotentialStubbingProblem` naming both the stubbed arguments and the actual ones. That is one
of strictness's strongest arguments, and it is [07 · Strictness](07-strictness.md).

## 🔴 `any()` versus `any(Class)` — three behaviour changes across versions

These two look like the same matcher with an optional type argument. They have not been the
same thing since 2016, and the difference changed again in Mockito 5.

From `any()`'s javadoc:

> *"Matches **anything**, including nulls."*
> - *"For primitive types use `anyChar()` family or `isA(Class)` or `any(Class)`."*
> - *"Since Mockito 2.1.0 `any(Class)` is not anymore an alias of this method."*
> - *"Since Mockito 5.0.0 this no longer matches varargs. Use `any(Class)` instead."*

From `any(Class)`'s javadoc:

> *"Matches any object of given type, excluding nulls. … This matcher will perform a type check
> with the given type, thus excluding values. This is an alias of: `isA(Class)`"*
> - *"Since Mockito 2.1.0, only allow non-null instance of, thus `null` is not anymore a valid
>   value. As reference are nullable, the suggested API to **match** `null` would be
>   `isNull()`. We felt this change would make test harnesses much safer than they were with
>   Mockito 1.x."*
> - *"Since Mockito 5.0.0 this method can match varargs if the array type is specified, for
>   example `any(String[].class)`."*

| | `any()` | `any(Class)` / `isA(Class)` |
|---|---|---|
| Matches `null` | **yes** | **no** |
| Type check | none | `instanceof` the given type |
| Varargs | 🔴 **no**, since 5.0.0 | yes, if you name the array type — `any(String[].class)` |
| Return value | `null` | `Primitives.defaultValue(type)` |

**The Mockito 5 varargs change is the one that breaks working tests on upgrade.** A stubbing
written as `when(mock.log(anyString(), any()))` against `void log(String fmt, Object... args)`
matched the whole varargs array under Mockito 4 and does not under Mockito 5. The stubbing
still compiles, still looks right, and silently stops matching. The documented replacement is
`any(Object[].class)`.

## Nulls, precisely

| Matcher | Matches |
|---|---|
| `isNull()` | only `null` |
| `isNull(Class<T>)` | only `null`, typed to avoid a cast |
| `notNull()` / `isNotNull()` | anything except `null` (`isNotNull` is an alias) |
| `notNull(Class<T>)` / `isNotNull(Class<T>)` | the same, typed |
| `nullable(Class<T>)` | `null` **or** an instance of the type |
| `any()` | everything, `null` included |
| `any(Class)` / `isA(Class)` / `anyX()` | instances only, never `null` |

`nullable` is implemented as exactly what it says:

```java
public static <T> T nullable(Class<T> clazz) {
    AdditionalMatchers.or(isNull(), isA(clazz));
    return Primitives.defaultValue(clazz);
}
```

— an `or` of `isNull()` and `isA(clazz)`, built from [04d · AdditionalMatchers](04d-additional-matchers.md).
It is the right matcher for a parameter that is genuinely optional, and it is a bad matcher for
one that should never be `null`, because it hides the case you would want to catch.

## The `anyX` family

All of them are `InstanceOf` checks and all of them reject `null`, with the standard note:

> *"Since Mockito 2.1.0, only allow non-null … As this is a nullable reference, the suggested
> API to **match** `null` wrapper would be `isNull()`. We felt this change would make test
> harnesses much safer than they were with Mockito 1.x."*

| Matcher | Matches | Returns |
|---|---|---|
| `anyBoolean()` | `boolean` or non-null `Boolean` | `false` |
| `anyByte()`, `anyShort()`, `anyInt()`, `anyLong()` | the primitive or its non-null wrapper | `0` |
| `anyFloat()`, `anyDouble()` | the primitive or its non-null wrapper | `0` |
| `anyChar()` | `char` or non-null `Character` | the null character |
| `anyString()` | non-null `String` | `""` |
| `anyList()` | non-null `List` | empty `ArrayList` |
| `anySet()` | non-null `Set` | empty `HashSet` |
| `anyMap()` | non-null `Map` | empty `HashMap` |
| `anyCollection()` | non-null `Collection` | empty `ArrayList` |
| `anyIterable()` | non-null `Iterable` (since 2.1.0) | empty `ArrayList` |

⚠️ **The wrapper types are covered by the primitive matcher.** `anyInt()` matches an `Integer`
parameter as well as an `int` one — but only a non-null `Integer`. For a nullable `Integer`
parameter, `nullable(Integer.class)` is the honest matcher.

⚠️ **`anyList()` checks `List`, not the element type.** Generics are erased; nothing checks that
it is a `List<Order>`. If the element type matters, `argThat` or a captor —
[04c · Custom matchers](04c-custom-matchers.md) and
[06 · Argument captors](06-argument-captors.md).

## Equality: `eq`, `same`, `refEq`

```java
public static <T> T eq(T value) {
    reportMatcher(new Equals(value));
    if (value == null) return null;
    return (T) Primitives.defaultValue(value.getClass());
}

public static <T> T same(T value) {
    reportMatcher(new Same(value));
    ...
}
```

- **`eq(value)`** — `equals()` comparison. There are primitive overloads (`eq(int)`,
  `eq(boolean)`, …) so the boxing does not surprise you. This is the same comparison Mockito
  uses when no matchers are present at all, so `eq` is only *needed* to satisfy the
  all-or-nothing rule.
- **`same(value)`** — reference identity, `==`. Use it when two equal-but-distinct objects would
  both pass `eq` and you need the exact instance — a listener registration, a cached object, a
  singleton.
- **`refEq(value, excludeFields...)`** — reflection-based field comparison, for types with no
  `equals`:

> *"This matcher can be used when equals() is not implemented on compared objects. Matcher uses
> java reflection API to compare fields of wanted and actual object. Works similarly to
> `EqualsBuilder.reflectionEquals(this, other, excludeFields)` from apache commons library."*
>
> ***Warning*** *The equality check is shallow!*

🔴 **"Shallow" is doing real work in that warning.** `refEq` compares the *top-level fields* by
reflection; a nested object is compared with its own `equals`, which is exactly the thing you
were trying to avoid. On a DTO with a nested address, `refEq` gives you identity comparison on
the address and a green test that proves nothing about it. And `excludeFields` fails open:
*"if field does not exist it is ignored"*, so a renamed field silently stops being excluded — or
silently stops being compared, depending on which side you renamed.

Prefer giving the type an `equals` (a `record` gets one), or capture the argument and use
AssertJ's recursive comparison — [../02-assertj/04-recursive-comparison.md](../02-assertj/04-recursive-comparison.md),
which at least reports which field differed.

## String matchers

| Matcher | Matches | Returns |
|---|---|---|
| `contains(String)` | a `String` containing the substring | `""` |
| `startsWith(String)` | a `String` with that prefix | `""` |
| `endsWith(String)` | a `String` with that suffix | `""` |
| `matches(String regex)` | a `String` the regex matches | `""` |
| `matches(Pattern)` | the same, pre-compiled | `""` |

⚠️ `matches` is a *full* match in the `String.matches` sense. For "contains something matching
this regex", `AdditionalMatchers.find(regex)` is the one you want:
*"String argument that contains a substring that matches the given regular expression."*

All of these reject `null` for the same reason the `anyX` family does — they are type checks
first.

## Gotchas

**★ Assuming `anyString()` matches `null`.**
It does not — it is an `InstanceOf(String.class)` check. `any()` does, `nullable(String.class)`
does, `isNull()` matches only `null`. A stubbing that silently fails to match returns the
default value, not an error.

**★ Upgrading to Mockito 5 with `any()` in a varargs position.**
*"Since Mockito 5.0.0 this no longer matches varargs. Use `any(Class)` instead."* The stubbing
compiles, stops matching, and the test fails on a default value far from the stubbing. Change it
to `any(Object[].class)` or the specific array type.

**★ Treating `any(Foo.class)` as "any Foo, including null".**
It is an alias of `isA(Foo.class)` and rejects `null` — a deliberate 2.1.0 change, *"to make
test harnesses much safer"*. `nullable(Foo.class)` is the "or null" version.

**★ `any()` on a primitive parameter.**
`any()` returns `null`, so it auto-unboxes to an NPE at the call site. The javadoc says: *"For
primitive types use `anyChar()` family or `isA(Class)` or `any(Class)`."*

**★ `anyInt()` on a nullable `Integer` parameter.**
It matches an `Integer` but not a `null` one. A test that passes `null` for "not provided"
silently misses the stub. Use `nullable(Integer.class)`.

**★ `anyList()` believed to check the element type.**
It checks `List` and nothing else — generics are erased before the matcher ever sees the
argument. `List<String>` and `List<Order>` are indistinguishable to it.

**★ `refEq` on an object with nested objects.**
The javadoc's warning is one line and easy to skim: *"The equality check is shallow!"* Nested
objects fall back to their own `equals`, which for a plain class is identity. The test passes
without comparing what you thought it compared.

**★ `refEq`'s `excludeFields` with a typo or a renamed field.**
*"if field does not exist it is ignored"* — no error. A rename on either side quietly changes
what is compared, in whichever direction is worse for you.

**★ `same()` where `eq()` was meant, on value objects.**
`same` is `==`. Two equal `Money` objects fail it. Conversely, `eq` on a mutable object compares
it *as it is at verification time*, not as it was when passed — if the code mutated it after the
call, `eq` sees the mutated state.

**★ `matches(regex)` used as "contains".**
`matches` is anchored to the whole string. `AdditionalMatchers.find(regex)` is the substring
version, and the difference produces a stubbing that never fires.

**★ Reaching for `refEq` instead of writing `equals`.**
Mockito's own guidance in `ArgumentMatcher` lists *"implement equals() method in the objects
that are used as arguments to mocks"* as an option, and calls it *"clean and simple"*. A
`record` gives you one for nothing and a far better failure message than a reflection matcher.

## Interview questions

**★ Does `anyString()` match a `null` argument?**
No. Since Mockito 2.1.0 the `anyX` family performs a type check and rejects `null`; the
documented alternative is `isNull()`, or `nullable(String.class)` for "null or a String". Only
bare `any()` matches everything including nulls.

**★ What is the difference between `any()` and `any(String.class)`?**
`any()` matches anything, including `null`, and performs no type check. `any(String.class)` is
an alias of `isA(String.class)`: it performs an `instanceof` check and therefore rejects `null`.
They were aliases in Mockito 1.x and stopped being so in 2.1.0. They also differ on varargs —
since 5.0.0 `any()` does *not* match varargs and `any(Class)` does, if you name the array type.

**★ A test that passed on Mockito 4 fails after upgrading to 5, on a method with varargs. Why?**
`any()` stopped matching varargs in 5.0.0. The stubbing still compiles but no longer applies, so
the mock returns its default and the failure appears wherever that default is used. The fix is
`any(Object[].class)`, or the concrete array type of the vararg.

**★ When would you use `same()` rather than `eq()`?**
When identity is what the behaviour depends on: registering and later deregistering the same
listener instance, returning a cached object, passing a singleton through. `eq` uses `equals`,
so two distinct but equal objects both satisfy it — which is usually what you want and
occasionally hides the bug.

**★ What is wrong with `refEq`?**
Two things the javadoc states outright. The comparison is *shallow*, so nested objects fall back
to their own `equals` — normally identity — and the test silently stops checking them. And
`excludeFields` ignores names that do not exist, so a typo or a rename changes what is compared
with no warning. It exists for types you cannot give an `equals`; where you can, give it one.

**★ Which matcher covers "null or a value"?**
`nullable(Class)`. It is literally `or(isNull(), isA(clazz))` in the source. It is right for a
genuinely optional parameter and wrong as a way of silencing a stubbing that will not match,
because it removes the ability to notice `null` arriving where it should not.

**★ How would you match a `List<Order>` specifically?**
You cannot, with `anyList()` — erasure means the matcher only sees `List`. Use
`argThat(list -> …)` with a check on the elements, or capture the argument and assert on it,
which gives a real failure message instead of "no matching invocation".

{/* FOOTER */}
