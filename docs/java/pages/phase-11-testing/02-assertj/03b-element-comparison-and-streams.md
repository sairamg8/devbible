---
title: "A collection assertion is only as meaningful as its notion of element equality, and the two ways to change that notion cost you either correctness or your failure message"
sidebar_label: "03b · Element comparison and streams"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — "Comparing elements with a
> specific comparator" and "Recursive comparison for iterable assertions"
> ([assertj.github.io/doc](https://assertj.github.io/doc/#assertj-core-group-comparator)) —
> and the `assertj-core` 3.27.7 sources
> (`AbstractIterableAssert.usingElementComparator`,
> `usingRecursiveFieldByFieldElementComparator`, the deprecated
> `usingFieldByFieldElementComparator`, `Assertions.assertThat(Stream)`).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**`contains`, `containsExactly` and every other membership assertion ask "is this element
in there?" — and "is" means whatever `equals` means for your element type. When `equals` is
identity-based, as it is on a typical JPA entity, every one of those assertions silently
becomes a reference check. AssertJ gives you two escape routes and they are not
interchangeable: a `Comparator` you write yourself, which is powerful enough to make
nonsense assertions pass, and a recursive field-by-field element comparator, which is
correct and throws away the detailed failure report. A `Stream` adds a third wrinkle: it is
converted to a `List` on first inspection and is then gone.**

## The default is `equals`, and that is usually the bug

```java
List<Order> found = repository.findByCustomer(customerId);
assertThat(found).contains(expectedOrder);
```

If `Order` is a JPA entity with no `equals` override, this asserts that `found` contains the
*same instance* as `expectedOrder`. Across a repository round trip it never will, so the
test fails and someone "fixes" it by adding an id-based `equals` to the entity — after
which the assertion passes for an order whose every other field is wrong.

Both outcomes are bad and both are the same root cause: the assertion delegated the
interesting question to a method written for a different purpose.

## Route one — `usingElementComparator`

```java
assertThat(orders).usingElementComparator(comparing(Order::reference))
                  .contains(expectedOrder);
```

The documentation's own example shows how far this can be pushed:

```java
// ... but if we compare only races, Sauron is in fellowshipOfTheRing since he's a Maia like Gandalf
assertThat(fellowshipOfTheRing).usingElementComparator((t1, t2) -> t1.getRace().compareTo(t2.getRace()))
                               .contains(sauron);
```

That assertion passes and is nonsense as a domain statement. A comparator that inspects one
field turns `contains` into "contains something with the same value in that field" — which
is true of the villain and the wizard alike.

Three properties worth internalising:

- **It applies to the whole chain, not one call.** It replaces the element comparison
  strategy on the assert object. `usingDefaultElementComparator()` restores it.
- **The comparator's *sign* is irrelevant; only zero matters.** Membership assertions ask
  `compare(a, b) == 0`. A comparator that returns a consistent ordering is not required, and
  a badly written one that returns `0` too often silently widens every assertion.
- **It is invisible five lines later.** A reader scanning `contains(expectedOrder)` has no
  reason to look up the chain for a comparator. This is the strongest argument for
  preferring `extracting` — see [03c · extracting](03c-extracting.md) — which puts the
  narrowing *in* the assertion.

## Route two — the recursive element comparator

`usingRecursiveFieldByFieldElementComparator(RecursiveComparisonConfiguration)` compares
elements field by field, using the same engine as
[04 · The recursive comparison](04-recursive-comparison.md), but usable inside `contains`,
`containsExactly` and the rest. You configure it with a builder rather than a fluent chain:

```java
RecursiveComparisonConfiguration configuration = RecursiveComparisonConfiguration.builder()
                                                                                 .withIgnoredFields("hasPhd")
                                                                                 .build();

assertThat(doctors).usingRecursiveFieldByFieldElementComparator(configuration)
                   .contains(sheldon);
```

The documentation is explicit about what this costs, and it is the reason you do not use it
for everything:

> *"usingRecursiveFieldByFieldElementComparator(RecursiveComparisonConfiguration) enables
> the recursive comparison for any iterable assertion as opposed to usingRecursiveComparison()
> which only allows isEqualTo and isNotEqualTo, the main difference between both isEqualTo
> assertions is that the usingRecursiveComparison one will give a detailed differences
> report while the usingRecursiveFieldByFieldElementComparator one will give a generic error
> message without details."*

So: correct comparison, generic message. For a single object, `usingRecursiveComparison()`
gives you the field-path diff. For a collection, you get "element not found" and then you go
and find out why yourself. That is a real trade and it is worth knowing which side of it you
are on before the test fails.

⚠️ The older `usingFieldByFieldElementComparator()` is **deprecated in 3.27.7**, and its
javadoc names the replacements: `usingRecursiveFieldByFieldElementComparator(RecursiveComparisonConfiguration)`
or `usingRecursiveComparison()`. The family of `usingComparatorForElementFieldsWithNames` /
`...WithType` methods that configured it is deprecated with it. Code you find online that
uses them is pre-3.x-era and should not be copied forward.

## Route three — do not change the comparison at all

Most of the time the right answer is neither: assert on the data you care about rather than
teaching AssertJ a new definition of equality.

```java
assertThat(orders).extracting(Order::reference, Order::status)
                  .containsExactly(tuple("ORD-1", CONFIRMED),
                                   tuple("ORD-2", PENDING));
```

This is the same narrowing a comparator would do, except it is visible at the point of the
assertion, and the failure message lists the tuples rather than saying an element was not
found. See [03c · extracting](03c-extracting.md).

## Streams: converted once, then gone

`assertThat(Stream<...>)` returns a `ListAssert`. The javadoc is emphatic, and the emphasis
is its own:

> *"**Be aware that the `Stream` under test will be converted to a `List` when an assertion
> requires to inspect its content. Once this is done the `Stream` can't be reused as it has
> already been consumed.**"*

> *"Calling multiple methods on the returned `ListAssert` is safe as it only interacts with
> the `List` built from the `Stream`."*

Chaining is therefore fine. What is not fine is one specific assertion:

```java
// FAIL: the Stream under test is converted to a List and compared to a Stream
// but a List is not a Stream.
assertThat(Stream.of(1, 2, 3)).isEqualTo(Stream.of(1, 2, 3));
```

`isEqualTo` and `isSameAs` are reference checks and do **not** trigger the conversion, which
produces the paradox the javadoc spells out: comparing a stream to *itself* succeeds, while
comparing it to an identical stream fails.

```java
Stream<Integer> stream = Stream.of(1, 2, 3);
assertThat(stream).isEqualTo(stream)
                  .isSameAs(stream);   // both succeed
```

The same one-shot reasoning applies to `Iterator` and to anything backed by an open resource
— a `Files.lines` stream, a JDBC-backed stream from a Spring Data `Stream` query method. If
production code needs the sequence after the assertion, collect it into a `List` first and
assert on that.

## Gotchas

**★ On an entity with no `equals` override, every membership assertion is a reference
check.**
`contains`, `containsExactly`, `containsOnly` — all of them. A repository round trip
guarantees a different instance, so the assertion fails for a reason that has nothing to do
with the data.

**★ Adding `equals` to a production entity to make a test pass changes production
behaviour.**
Entity equality affects `HashSet` membership, Hibernate's collection handling and every
`distinct()` in the codebase. If the only consumer is a test, use a recursive element
comparator or `extracting` instead.

**★ `usingElementComparator` silently reinterprets every element assertion after it.**
A one-field comparator turns `contains` into "contains something similar in that field",
which passes for objects that are entirely wrong. Scope it as tightly as you can, and reset
with `usingDefaultElementComparator()` if the chain continues.

**★ Only `compare(a, b) == 0` matters, so a sloppy comparator widens assertions rather than
breaking them.**
A comparator that returns `0` for two unequal objects does not cause an error anywhere —
it just makes every membership assertion pass more often. There is no failure to
investigate.

**★ `usingRecursiveFieldByFieldElementComparator` gives you a generic message.**
The docs say so. You trade the field-path diff for the ability to use recursive comparison
inside a collection assertion. When a single element is the subject, prefer
`singleElement().usingRecursiveComparison()` and keep the diff.

**★ `usingFieldByFieldElementComparator` and `usingComparatorForElementFieldsWithNames` are
deprecated in 3.27.7.**
Their javadoc names the replacements. Most blog examples predate the deprecation.

**★ `assertThat(someStream).isEqualTo(anotherStream)` fails even when the streams are
equivalent.**
The actual is converted to a `List` for content assertions, but `isEqualTo` is a reference
check against a `Stream`, and a list is not a stream. Assert contents, not stream identity.

**★ A stream asserted once is consumed.**
You cannot assert on it and then use it — the JDK throws on the second terminal operation.
Collect first if you need both.

**★ A `Stream` from a Spring Data query method holds a database cursor open.**
Consuming it inside an assertion means the assertion is doing I/O, and if the assertion
fails midway the stream is not closed. Collect inside the transaction and assert outside it.

**★ Comparing an `Iterable` with `isEqualTo` compares the container, not the contents.**
`assertThat(someArrayList).isEqualTo(someLinkedList)` depends on `List.equals`, which is
defined across `List` implementations — but `assertThat(someHashSet).isEqualTo(someList)` is
false regardless of contents, because `Set.equals` requires the other object to be a `Set`.
Use a content assertion and the question disappears.

**★ `usingComparator` and `usingElementComparator` are different methods with similar
names.**
The first changes how the *collection itself* is compared (for `isEqualTo`); the second
changes how its *elements* are compared (for `contains` and friends). Autocomplete offers
both.

## Interview questions

**★ Why does `assertThat(ordersFromRepository).contains(expectedOrder)` fail even though the
data is right?**
Because the assertion uses `equals` on the element type, and a typical JPA entity inherits
`Object.equals`, which is identity. The order that came back from the repository is a
different instance from the one you built in the test, so no amount of matching field values
helps. The three ways out are a recursive element comparator, `extracting` the fields you
care about, or comparing a DTO/projection whose equality is value-based.

**★ Why is adding `equals` to the entity the wrong fix?**
Because entity equality is production behaviour, not test scaffolding. It determines
`HashSet` and `HashMap` semantics, `distinct()` results, and how Hibernate manages
collections — and an id-based `equals` on an entity whose id is generated on flush changes
meaning between the transient and persistent states. Changing it to satisfy an assertion
puts a subtle production risk in place to save four characters in a test.

**★ What do you give up by using `usingRecursiveFieldByFieldElementComparator`?**
The detailed failure report. The documentation states that `usingRecursiveComparison`
produces a detailed differences report while the element-comparator form produces a generic
error message. You get correct field-by-field comparison inside collection assertions and a
message that only tells you an element was not found. If the collection has one interesting
element, `singleElement()` followed by `usingRecursiveComparison()` keeps both.

**★ Explain why `assertThat(Stream.of(1,2,3)).isEqualTo(Stream.of(1,2,3))` fails while
`assertThat(stream).isEqualTo(stream)` succeeds.**
`assertThat(Stream)` returns a `ListAssert` and the stream is converted to a `List` only
when an assertion needs to inspect its content. `isEqualTo` does not inspect content — it is
a reference/`equals` check — so the actual is compared as a converted `List` against an
expected `Stream`, and a list is never equal to a stream. Comparing the stream to itself
succeeds because that is a reference check that happens to hold. The lesson is that content
assertions and identity assertions take different paths through the same `ListAssert`.

**★ You need to assert on a `Stream` returned by a Spring Data query method inside a
transactional test. What do you have to be careful about?**
Two things. The stream is one-shot, so the first content assertion consumes it and nothing
downstream can reuse it. And it is backed by an open cursor, so it must be consumed and
closed inside the transaction that opened it — an assertion failure part way through leaves
the resource dangling unless the stream is in a try-with-resources. Collect it to a `List`
inside the transaction and assert on the list.

**★ When would you accept `usingElementComparator` in a code review?**
When the element type's equality is genuinely unusable and the comparison you want is not
expressible by extracting fields — for example comparing elements up to a floating-point
tolerance, or up to a normalisation (case, whitespace, canonical ordering) that would be
noisy to apply to every expected value. Even then, ask for it to be immediately adjacent to
the assertion it modifies, and for `usingDefaultElementComparator()` if the chain continues.

{/* FOOTER */}
