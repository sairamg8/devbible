---
title: "AdditionalMatchers exists for EasyMock compatibility and Mockito tells you to use it judiciously, but and/or/not and the comparison matchers are the only way to express a constraint that argThat would otherwise turn into an unreadable boolean — and its logical operators have an argument-order trap that no compiler will catch"
sidebar_label: "04d · AdditionalMatchers"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc and method javadocs of
> [`AdditionalMatchers`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/AdditionalMatchers.java)
> (`geq`, `leq`, `gt`, `lt`, `cmpEq`, `find`, `aryEq`, `and`, `or`, `not`, `eq(double,double)`),
> the `nullable` implementation in
> [`ArgumentMatchers`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentMatchers.java),
> and the 2.1.0 migration guide in
> [`ArgumentMatcher`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentMatcher.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**`ArgumentMatchers` covers types and equality. `AdditionalMatchers` covers everything else —
ordering, arrays, regex substrings, and the logical combinators that let two matchers apply to
one argument. Mockito is lukewarm about the whole class, and for most of it that is right. But
`and`/`or`/`not` are load-bearing: they are how `nullable()` itself is built, and they are the
difference between a readable constraint and an `argThat` lambda that nobody will read twice.**

## What Mockito says about it

> *"AdditionalMatchers provides rarely used matchers, kept only for somewhat compatibility with
> EasyMock. Use additional matchers very judiciously because they may impact readability of a
> test. It is recommended to use matchers from `ArgumentMatchers` and keep stubbing and
> verification simple."*

Take that as a real constraint on the ordering and array matchers. Take it less literally for
`and`/`or`/`not`, which have no equivalent in `ArgumentMatchers` and which Mockito uses
internally: `nullable(Class)` is implemented as

```java
public static <T> T nullable(Class<T> clazz) {
    AdditionalMatchers.or(isNull(), isA(clazz));
    return Primitives.defaultValue(clazz);
}
```

## The logical combinators

The class javadoc's own examples:

```java
//anything but not "ejb"
mock.someMethod(not(eq("ejb")));

//not "ejb" and not "michael jackson"
mock.someMethod(and(not(eq("ejb")), not(eq("michael jackson"))));

//1 or 10
mock.someMethod(or(eq(1), eq(10)));
```

Each of `and`, `or` and `not` has an overload per primitive type plus a generic `<T>` one, for
the same reason the `anyX` family does — the placeholder returned has to be assignable to the
parameter slot.

### 🔴 The trap: the operands are *statements*, and order matters

`and(not(eq("ejb")), not(eq("michael jackson")))` reads like a function applied to two values.
It is not. Every one of those five calls pushes a matcher onto the thread-local stack described
in [04 · Argument matchers](04-argument-matchers.md), and `and` pops the last two and pushes a
combined one. The nesting works because Java evaluates arguments left to right and inside out.

Two consequences:

- **You cannot hoist an operand into a variable.**
  `var notEjb = not(eq("ejb")); mock.someMethod(and(notEjb, notMichael));` pushes four matchers
  at the wrong times and combines the wrong pair. Same rule as everywhere else: matchers are
  expressions evaluated in place, never values.
- **You cannot mix a raw value into a combinator.** `and(gt(5), 10)` is the all-or-nothing rule
  applied one level down, and it fails in the same confusing way.

## The ordering matchers

| Matcher | Matches |
|---|---|
| `geq(value)` | argument ≥ value |
| `leq(value)` | argument ≤ value |
| `gt(value)` | argument > value |
| `lt(value)` | argument < value |
| `cmpEq(value)` | `compareTo` returns 0 |

Each exists as a generic `<T extends Comparable<T>>` plus overloads for `byte`, `short`, `int`,
`long`, `float` and `double`.

**`cmpEq` is the interesting one.** It compares with `compareTo`, not `equals`, so
`cmpEq(new BigDecimal("1.0"))` matches `new BigDecimal("1.00")` and `eq(...)` does not —
`BigDecimal.equals` includes scale. If your domain passes `BigDecimal` amounts around, this is
the difference between a green test and a baffling failure.

⚠️ Ordering matchers are a smell in a *verification*. "The service called `charge` with some
amount over 100" is a weaker claim than "the service called `charge` with 149.99", and the weaker
claim is usually not the one you meant to make. They earn their place in *stubbing*, where they
express a branch: `when(limits.check(gt(1000))).thenReturn(REJECTED)`.

## `aryEq` — arrays, because `eq` cannot do it

> *"Object array argument that is equal to the given array, i.e. it has to have the same type,
> length, and each element has to be equal."*

There is an overload for every primitive array type plus `T[]`. This exists because array
`equals` is reference identity, so `eq(new String[]{"a"})` can never match a different array
object with the same contents. Any test verifying a method that takes an array needs `aryEq`.

⚠️ And note the interaction with varargs from [04b](04b-the-matcher-catalogue.md): a varargs
parameter *is* an array. `aryEq` is often what you want where `any()` stopped working in
Mockito 5.

## `find` — the substring regex

> *"String argument that contains a substring that matches the given regular expression."*

This is the counterpart to `ArgumentMatchers.matches(regex)`, which is a *whole-string* match.
`find("order-\\d+")` matches `"processing order-1234 now"`; `matches("order-\\d+")` does not.
Confusing the two produces a stubbing that silently never fires.

## `eq(double, double)` and `eq(float, float)` — equality with a tolerance

```java
public static double eq(double value, double delta) { ... }
public static float  eq(float  value, float  delta) { ... }
```

The floating-point comparison you should be using instead of exact `eq` on a `double`. Same
argument as AssertJ's `within` — see
[../02-assertj/02d-numbers-and-offsets.md](../02-assertj/02d-numbers-and-offsets.md).

⚠️ It is `eq`, overloaded on arity, and it lives in `AdditionalMatchers` rather than
`ArgumentMatchers`. With both classes statically imported, `eq(1.0, 0.01)` resolves to the
tolerance matcher and `eq(1.0)` to the plain one — which is what you want, but it means a
one-token edit changes which class you are calling.

## Hamcrest, if you already have the matchers

`Mockito.argThat` takes an `org.mockito.ArgumentMatcher`, not an `org.hamcrest.Matcher` — the
two were decoupled in 2.1.0:

> *"This API was changed in Mockito 2.1.0 in an effort to decouple Mockito from Hamcrest and
> reduce the risk of version incompatibility."*

The migration guide gives two routes:

> - *"a) Refactor the hamcrest matcher to Mockito matcher: Use "implements ArgumentMatcher"
>   instead of "extends ArgumentMatcher". Then refactor `describeTo()` method into `toString()`
>   method."*
> - *"b) Use `org.mockito.hamcrest.MockitoHamcrest.argThat()` instead of `Mockito.argThat()`.
>   Ensure that there is hamcrest dependency on classpath (Mockito does not depend on hamcrest
>   any more)."*

And the guidance on choosing:

> *"If you don't mind having a compile-time dependency for Hamcrest, then the second option is
> probably right for you. Your choice should not have a big impact and is fully reversible - you
> can choose different option in future (and refactor the code)!"*

⚠️ Boot 4.1 still manages Hamcrest (3.0), so the dependency is usually already on the test
classpath. That is not a reason to use it in a new test — the `describeTo` → `toString` rename is
the only real difference in what you write, and staying inside Mockito's own types keeps one
fewer matcher vocabulary in the file.

## Gotchas

**★ Hoisting a combinator's operand into a variable.**
`var notEjb = not(eq("ejb"))` pushes two matchers immediately and stores a placeholder. The
later `and(notEjb, …)` then combines the wrong entries. Combinator operands are expressions
evaluated in place, exactly like every other matcher.

**★ Mixing a raw value into `and`/`or`/`not`.**
`and(gt(5), 10)` breaks the all-or-nothing rule one level down. Every operand has to be a
matcher, so the literal needs `eq(10)`.

**★ `eq` on a `BigDecimal` where scale differs.**
`BigDecimal.equals` compares scale, so `eq(new BigDecimal("1.0"))` does not match
`new BigDecimal("1.00")`. `cmpEq` uses `compareTo` and does. This bites in money code
specifically, which is where it is most expensive.

**★ `eq(someArray)` in a verification.**
Array `equals` is identity, so it can only match the very same array object. Use `aryEq`, which
compares *"the same type, length, and each element"*.

**★ `matches(regex)` where `find(regex)` was meant.**
`ArgumentMatchers.matches` anchors to the whole string; `AdditionalMatchers.find` looks for a
substring match. The wrong one produces a stubbing that never fires and a test that fails on a
default value.

**★ Ordering matchers in a verification.**
`verify(gateway).charge(gt(100))` asserts something weaker than the test almost certainly means.
It passes for 101 and for 10 000. In a verification, prefer the exact value or a captor; in a
stubbing, ordering matchers are legitimate because they describe a branch.

**★ Exact `eq` on a `double`.**
Floating-point arithmetic rarely lands on the literal you wrote. `eq(value, delta)` from
`AdditionalMatchers` is the tolerance form, and it is the same argument AssertJ makes with
`within`.

**★ Static-importing both matcher classes and losing track of which `eq` you called.**
`ArgumentMatchers.eq(double)` and `AdditionalMatchers.eq(double, double)` are different methods
in different classes, distinguished only by arity. Deleting the delta argument silently switches
you to exact comparison.

**★ `Mockito.argThat` handed a Hamcrest matcher.**
It will not compile: the two APIs were decoupled in 2.1.0. Either reimplement it as an
`ArgumentMatcher` (with `describeTo` becoming `toString`) or use
`org.mockito.hamcrest.MockitoHamcrest.argThat`.

**★ Reaching for `AdditionalMatchers` before `ArgumentMatchers`.**
Mockito's own framing: *"rarely used matchers, kept only for somewhat compatibility with
EasyMock. Use additional matchers very judiciously because they may impact readability of a
test."* `and`/`or`/`not`, `cmpEq`, `aryEq` and the tolerance `eq` all earn their keep; the
ordering matchers in a verification usually do not.

## Interview questions

**★ Why can't you extract `not(eq("x"))` into a local variable and pass it to `and`?**
Because it is not a value. `eq("x")` pushes a matcher onto the thread-local stack and returns a
placeholder; `not(...)` pops one and pushes its negation. Assigning the placeholder to a variable
stores the throwaway value while the matchers stay on the stack in the wrong order, so `and`
combines the wrong pair. The whole `AdditionalMatchers` API is statements, not expressions in the
usual sense.

**★ What is the difference between `eq` and `cmpEq`?**
`eq` uses `equals`; `cmpEq` uses `compareTo` and matches when it returns 0. They differ wherever
a type's `equals` is stricter than its ordering — `BigDecimal` is the classic case, where
`1.0` and `1.00` are `compareTo`-equal and not `equals`-equal.

**★ How do you verify a call that takes an array?**
`aryEq`. `eq` on an array compares references, so it only matches the identical array object. The
javadoc's definition of `aryEq` is *"the same type, length, and each element has to be equal"*.
This also applies to varargs parameters, which are arrays.

**★ `matches` versus `find` — what is the difference?**
`ArgumentMatchers.matches(regex)` requires the whole argument to match the pattern;
`AdditionalMatchers.find(regex)` requires only that the argument *contains* a substring matching
it. Using `matches` when you meant `find` produces a stubbing that quietly never applies.

**★ Would you use `gt(100)` in a verification?**
Rarely. It asserts far less than the test usually intends — it is satisfied by any value above
the bound — so a wrong amount can still pass. In a *stubbing* it is useful, because it describes
a branch of the collaborator's behaviour rather than an expectation about the code under test.

**★ Can you pass a Hamcrest matcher to `Mockito.argThat`?**
No — Mockito decoupled from Hamcrest in 2.1.0 *"to reduce the risk of version incompatibility"*.
Use `org.mockito.hamcrest.MockitoHamcrest.argThat` with Hamcrest on the classpath, or port the
matcher: implement `ArgumentMatcher` and turn `describeTo` into `toString`.

**★ How is `nullable(Foo.class)` implemented?**
As `AdditionalMatchers.or(isNull(), isA(clazz))`. That is worth knowing for two reasons: it shows
the combinators are load-bearing rather than legacy, and it explains exactly what `nullable`
matches — `null`, or an instance of the type, and nothing else.

{/* FOOTER */}
