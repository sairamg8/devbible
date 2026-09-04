---
title: "assertThat(Optional) exists so that a test never calls get() on an empty Optional and reports NoSuchElementException instead of an assertion failure, and the family divides cleanly into presence, value, and navigation"
sidebar_label: "08 · Optional assertions"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `assertj-core` **3.27.7** sources on GitHub
> (tag `assertj-build-3.27.7`) — the javadoc and implementations of
> `isPresent`, `isNotEmpty`, `isEmpty`, `isNotPresent`, `contains`, `hasValue`,
> `containsSame`, `containsInstanceOf`, `hasValueSatisfying`, `get`, `map`,
> `usingValueComparator` and `usingRecursiveComparison` on
> [`AbstractOptionalAssert`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/AbstractOptionalAssert.java).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**Every repository method that might not find a row returns one, so `Optional` shows up in
tests constantly, and the reflex — `assertThat(result.get()).isEqualTo(expected)` — is
exactly wrong. When the `Optional` is empty, `get()` throws `NoSuchElementException` before
AssertJ sees anything, and the report is a Java error rather than a sentence saying the row
was not found. The whole `Optional` assertion family exists to keep the failure inside the
assertion.**

## Presence, and its four names

```java
assertThat(Optional.of("something")).isPresent();
assertThat(Optional.empty()).isEmpty();
```

Four methods, two meanings — the source declares `isNotEmpty()` as *"an alias of
`isPresent()`"*, and `isNotPresent()` is the alias of `isEmpty()`:

| Present | Empty |
|---|---|
| `isPresent()` | `isEmpty()` |
| `isNotEmpty()` | `isNotPresent()` |

Pick one pair per codebase. `isPresent` / `isEmpty` matches `Optional`'s own vocabulary and
is the better default; having all four in one suite means a reader has to check that
`isNotEmpty` on an `Optional` is not the collection assertion of the same name.

⚠️ `isPresent()` alone is a weak assertion — it says a row was found and nothing about
which. It is the right assertion only when existence genuinely is the behaviour under test.

## The value

```java
assertThat(Optional.of("something")).contains("something");
assertThat(Optional.of(10)).contains(10);

assertThat(Optional.of("something")).hasValue("something");
```

`hasValue` is literally `return contains(expectedValue);` in the source — an alias, no
behavioural difference. `contains` reads better on a collection-shaped mental model,
`hasValue` reads better in English. Again: pick one.

**Both assert presence and value in a single call**, which is the point. `contains(x)` on an
empty `Optional` fails with "expecting Optional to contain x but was empty" — an assertion
failure, with a useful message, and no exception from `get()`.

### Equality, identity and type

```java
// equal by equals
assertThat(Optional.of(someString)).contains("something");

// the same instance
String someString = "something";
assertThat(Optional.of(someString)).containsSame(someString);

// equal but NOT the same — this FAILS
assertThat(Optional.of(new String("something"))).containsSame(new String("something"));

// the value's type
assertThat(Optional.of("something")).containsInstanceOf(String.class)
                                    .containsInstanceOf(Object.class);
```

`containsSame` is a `!=` check in the source. The javadoc's own examples are worth reading
closely — it notes that `assertThat(Optional.of(10)).containsSame(10)` passes *"[because]
Java will create the same 'Integer' instance when boxing small ints"*, which is the
`Integer` cache and not a guarantee about your value. Everything
[02c · Equality vs identity](02c-equality-identity-and-comparators.md) says applies here.

`containsInstanceOf` is an `isInstance` check, so it passes for supertypes — the javadoc
example chains `String.class` and `Object.class` on the same value.

### A custom comparison for the value

```java
assertThat(maybeOrder).usingValueComparator(byReference).contains(expectedOrder);
```

and, for the field-by-field question, the `Optional` assert carries
`usingRecursiveComparison()` directly — so
[04 · Recursive comparison](04-recursive-comparison.md) works on the contained value without
unwrapping it.

⚠️ `usingFieldByFieldValueComparator()` also exists on this class. It is the old
first-level-only comparison; `usingRecursiveComparison()` is the one to use.

## Navigating into the value

Two ways, and the difference matters.

### `hasValueSatisfying` — assertions on the value

```java
assertThat(maybeOrder).hasValueSatisfying(order -> {
    assertThat(order.status()).isEqualTo(CONFIRMED);
    assertThat(order.total()).isEqualByComparingTo("42.00");
});
```

There is also a `Condition` overload — `hasValueSatisfying(Condition<? super VALUE>)` — which
pairs with [07 · Custom assertions](07-custom-assertions.md).

### `get()` — move the chain onto the value

> *"Verifies that the actual `Optional` is not `null` and not empty and returns an Object
> assertion that allows chaining (object) assertions on the optional value."*
>
> *"Note that it is only possible to return Object assertions after calling this method due
> to java generics limitations."*

```java
TolkienCharacter frodo = new TolkienCharacter("Frodo", 33, HOBBIT);

// assertion succeeds since all frodo's fields are set
assertThat(Optional.of(frodo)).get().hasNoNullFieldsOrProperties();
```

**This `get()` is not `Optional::get`.** It asserts non-emptiness first and then navigates —
so it fails as an assertion where the JDK method throws. But note the javadoc's warning: it
returns an `AbstractObjectAssert`, so you land on `ObjectAssert` and lose the type-specific
API, exactly as `first()` does in
[03f · Navigating to elements](03f-navigating-to-elements.md). The fix is the same:

```java
assertThat(maybeName).get(as(STRING)).startsWith("Fro");
```

### `map` — transform, staying inside the Optional

```java
assertThat(maybeOrder).map(Order::reference).contains("ORD-1");
```

`map` delegates to `Optional.map` and re-wraps, so an empty input stays empty and
`contains` then reports the emptiness. Useful for asserting one field without unwrapping.

## The rule this page exists for

```java
// 🔴 don't
assertThat(repository.findById(id).get().status()).isEqualTo(CONFIRMED);

// ✅ do
assertThat(repository.findById(id))
    .get()
    .extracting(Order::status)
    .isEqualTo(CONFIRMED);

// ✅ or, when only the value matters
assertThat(repository.findById(id)).contains(expectedOrder);
```

The first line, when the row is missing, throws `NoSuchElementException: No value present`
from `Optional.get()` — a stack trace pointing at the JDK, with nothing saying which id was
not found. The others fail with an assertion that names what was expected.

## Gotchas

**★ `Optional::get` inside `assertThat(...)`.**
The whole reason this API exists. An empty `Optional` throws `NoSuchElementException` before
any assertion runs, so the report is a Java error rather than a failure message. Use
`contains`, `hasValueSatisfying`, or AssertJ's own `get()` — which asserts first.

**★ AssertJ's `get()` and `Optional`'s `get()` are different methods with the same name.**
`assertThat(opt).get()` asserts non-emptiness and navigates; `opt.get()` throws. In a chain
they look nearly identical. The one after `assertThat(` is the safe one.

**★ `isPresent()` as the only assertion.**
It says a row exists and nothing about its contents. Legitimate when existence is the
behaviour; a weak assertion the rest of the time — the pattern
[02b · Assertions that assert nothing](02b-assertions-that-assert-nothing.md) is about.

**★ `get()` returns `ObjectAssert` and drops the type-specific API.**
The javadoc says so explicitly — *"only possible to return Object assertions … due to java
generics limitations"*. `get(as(STRING))` keeps the `StringAssert`.

**★ `containsSame` passing for boxed small integers.**
The javadoc's own example notes that `assertThat(Optional.of(10)).containsSame(10)` passes
because of `Integer` caching. A test relying on that is relying on the cache range, not on
your code's identity semantics.

**★ Four names for two assertions.**
`isPresent`/`isNotEmpty` and `isEmpty`/`isNotPresent` are aliases. Mixing them in one suite
costs the reader a moment every time, and `isNotEmpty` collides mentally with the collection
assertion of the same name.

**★ `contains(null)`.**
The source calls `checkNotNull(expectedValue)` on the expected value, so a `null` expected
value is rejected rather than compared. `Optional` cannot hold `null` anyway — if the
question is "is it empty", use `isEmpty()`.

**★ Asserting on an `Optional` field of an entity.**
`Optional` as a field type is discouraged in JPA entities, and an `Optional` returned from a
getter each call is a new instance — so `containsSame` on it is meaningless. Assert the
value.

**★ `usingFieldByFieldValueComparator()` instead of `usingRecursiveComparison()`.**
The former compares only the first level of fields. The `Optional` assert exposes
`usingRecursiveComparison()` directly; use it.

**★ `hasValueSatisfying` swallowing nothing.**
Unlike `filteredOnAssertions` in [03e](03e-filtering-and-navigating.md), assertions inside
`hasValueSatisfying` are real assertions and a failure fails the test. The two look similar
and behave oppositely, which is worth checking when you meet either.

**★ `map(...)` on an empty `Optional` reports the wrong thing first.**
`assertThat(empty).map(Order::reference).contains("ORD-1")` fails saying the `Optional` was
empty — correct, but the reader is looking for a reference mismatch. Assert `isPresent()`
first when emptiness and value are separate concerns.

## Interview questions

**★ Why not write `assertThat(repo.findById(id).get())…`?**
Because when the row is missing, `Optional.get()` throws `NoSuchElementException` before the
assertion runs. The failure is a JDK stack trace instead of a message naming what was
expected, and it does not say which id was looked up. `contains(...)` or AssertJ's `get()`
assert presence first and fail with a real message.

**★ What is the difference between AssertJ's `get()` and `Optional::get`?**
AssertJ's `get()` is an assertion: it verifies the `Optional` is not null and not empty, then
returns an `AbstractObjectAssert` on the value so the chain continues. `Optional::get` throws
if empty. Same name, opposite failure behaviour.

**★ `contains` or `hasValue`?**
They are the same method — the source implements `hasValue` as `return
contains(expectedValue);`. Pick one for the codebase. Both assert presence *and* value in a
single call, which is why either beats `isPresent()` followed by a separate value check.

**★ What does `containsSame` check, and what is the trap in the docs' own example?**
Reference identity — the implementation is `actual.get() != expectedValue`. The trap is that
`assertThat(Optional.of(10)).containsSame(10)` passes, which the javadoc explains as Java
reusing the same `Integer` instance for small ints. That is the `Integer` cache, not a
property of your code, and it does not hold above 127.

**★ You call `assertThat(maybeName).get().startsWith("Fro")` and it does not compile. Why?**
Because `get()` returns an `AbstractObjectAssert` — the javadoc notes this is a Java generics
limitation — so `startsWith` is not available. `get(as(STRING))` passes an
`InstanceOfAssertFactory` and gives you a `StringAssert`, which is the same fix as `first(as(STRING))`
on a collection.

**★ When is `isPresent()` on its own a good assertion?**
When existence is the behaviour under test — "after deleting, findById returns empty", "an
audit entry was created". As a preamble to checking the value it is redundant, because
`contains`/`hasValueSatisfying` already assert presence; and as the only assertion in a test
that cares about the value, it is a test that passes on the wrong row.

**★ How would you assert that an `Optional` holds an object equal field-by-field to an
expected one?**
`assertThat(maybeOrder).usingRecursiveComparison().isEqualTo(expectedOrder)` — the
`Optional` assert exposes the recursive comparison directly, so there is no need to unwrap.
Not `usingFieldByFieldValueComparator()`, which only compares the first level of fields.

{/* FOOTER */}
