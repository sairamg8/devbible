---
title: "An unstubbed method does not return null — it returns whatever ReturnsEmptyValues has a case for, which means Optional is empty, Integer is 0, List is a fresh mutable LinkedList and String is still null, and the difference between those four decides whether a test fails loudly or passes for the wrong reason"
sidebar_label: "03e · Unstubbed defaults"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> [`ReturnsEmptyValues`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/stubbing/defaultanswers/ReturnsEmptyValues.java)
> (the class javadoc and the body of `returnValueFor`),
> [`ReturnsMoreEmptyValues`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/stubbing/defaultanswers/ReturnsMoreEmptyValues.java),
> [`Primitives`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/util/Primitives.java),
> the `RETURNS_DEFAULTS` field javadoc and section 2 of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> [`ObjectMethodsGuru`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/util/ObjectMethodsGuru.java),
> and the `missingMethodInvocation`, `unfinishedVerificationException` and
> `invalidUseOfMatchers` messages in
> [`Reporter`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/exceptions/Reporter.java).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source and
> the library's own lookup table, never a fabricated test run.

**[03 · Stubbing](03-stubbing.md) quoted the javadoc's summary — a mock returns *"either null,
a primitive/primitive wrapper value, or an empty collection, as appropriate"*. "As appropriate"
is doing an enormous amount of work in that sentence. The actual behaviour is a chain of
`if`s in one class, `ReturnsEmptyValues`, and knowing which branch your return type lands in
is the difference between a test that fails with an NPE on the line you expect and a test that
sails through an empty list you never intended to create.**

## The default answer is an `Answer`

Every mock has a default answer, and it is just another `Answer`:

```java
public static final Answer<Object> RETURNS_DEFAULTS = Answers.RETURNS_DEFAULTS;
```

> *"The default `Answer` of every mock **if** the mock was not stubbed. Typically, it just
> returns some empty value. … This implementation first tries the global configuration and if
> there is no global configuration then it will use a default answer that returns zeros, empty
> collections, nulls, etc."*

That default answer is `ReturnsEmptyValues`, whose own class javadoc is the authoritative
summary:

> - *"Returns appropriate primitive for primitive-returning methods"*
> - *"Returns consistent values for primitive wrapper classes (e.g. int-returning method
>   returns 0 **and** Integer-returning method returns 0, too)"*
> - *"Returns empty collection for collection-returning methods (works for most commonly used
>   collection types)"*
> - *"Returns empty sequenced collections for Java 21+ SequencedCollection, SequencedSet, and
>   SequencedMap interfaces"*
> - *"Returns description of mock for toString() method"*
> - *"Returns zero if references are equals otherwise non-zero for Comparable#compareTo(T
>   other) method (see issue 184)"*
> - *"Returns an `java.util.Optional#empty() empty Optional` for Optional. Similarly for
>   primitive optional variants."*
> - *"Returns an `java.util.stream.Stream#empty() empty Stream` for Stream. Similarly for
>   primitive stream variants."*
> - *"Returns an `java.time.Duration.ZERO zero Duration` for empty Duration and
>   `java.time.Period.ZERO zero Period` for empty Period."*
> - ***"Returns null for everything else"***

The last bullet is the one to hold on to.

## The table, read off the source

`ReturnsEmptyValues.returnValueFor(Class)` is a chain of exact-type comparisons. This is what
it actually contains in 5.23.0:

| Declared return type | Unstubbed result |
|---|---|
| `boolean` / `Boolean` | `false` |
| `char` / `Character` | the null character, `'\u0000'` |
| `byte`, `short`, `int`, `long` and their wrappers | `0` (boxed for wrappers) |
| `float` / `Float`, `double` / `Double` | `0F` / `0D` |
| `Optional`, `OptionalInt`, `OptionalLong`, `OptionalDouble` | the corresponding `empty()` |
| `Stream`, `IntStream`, `LongStream`, `DoubleStream` | the corresponding `empty()` |
| `Duration` / `Period` | `Duration.ZERO` / `Period.ZERO` |
| `CompletableFuture`, `CompletionStage`, `Future` | `CompletableFuture.completedFuture(null)` |
| `Iterable` | `new ArrayList<>(0)` |
| `Collection`, `List`, `LinkedList` | `new LinkedList<>()` |
| `ArrayList` | `new ArrayList<>()` |
| `Set`, `HashSet` | `new HashSet<>()` |
| `SortedSet`, `TreeSet` | `new TreeSet<>()` |
| `LinkedHashSet` | `new LinkedHashSet<>()` |
| `Map`, `HashMap` | `new HashMap<>()` |
| `SortedMap`, `TreeMap` | `new TreeMap<>()` |
| `LinkedHashMap` | `new LinkedHashMap<>()` |
| `SequencedCollection` / `SequencedSet` / `SequencedMap` (Java 21+) | `ArrayList` / `LinkedHashSet` / `LinkedHashMap` |
| `toString()` | `"Mock for <Type>, hashCode: <n>"`, or the mock's name if it has one |
| `compareTo(T)` on a `Comparable` | `0` if the argument is the same reference, otherwise `1` |
| 🔴 **`String`** | **`null`** |
| 🔴 **any array type** | **`null`** |
| 🔴 **`Iterator`, `Deque`, `Queue`, `NavigableMap`, guava/third-party collections** | **`null`** |
| 🔴 **any other reference type** | **`null`** |

Four traps live in that table.

**🔴 `String` is `null`, not `""`.** People assume the "empty value" rule extends to strings. It
does not — the default answer has no `String` branch. (`ReturnsMoreEmptyValues`, which *does*
return `""`, is used only by `RETURNS_SMART_NULLS`; its own javadoc says *"Currently **used
only** by `Mockito#RETURNS_SMART_NULLS`"*.)

**🔴 The comparisons are `type == X.class`, exact.** `List` is matched; `Deque` is not.
`HashMap` is matched; `ConcurrentHashMap` is not. `Set` is matched; `ImmutableSet` is not. A
method declared to return `Iterator<T>` — a very common shape — returns `null`, despite
`Iterable` returning an empty `ArrayList`. Subtypes and interfaces the chain does not name
fall through to `null`. Changing the default answer is one way out —
[03f · Default answers](03f-default-answers.md) — but usually the honest fix is to stub the
call the code actually makes.

**🔴 The wrapper types return `0`, not `null`.** This is deliberate — *"Returns consistent
values for primitive wrapper classes"* — and it is the single most dangerous entry in the
table, because `Integer getCount()` returning `0` from an unstubbed mock looks like a real
answer. A `null` would have failed loudly at the first unboxing. `0` propagates silently into
an arithmetic result, and the test asserts on a number the code computed from nothing.

**🔴 The collections are fresh mutable instances, on purpose.** The source carries the reason
inline:

> *"new instances are used instead of Collections.emptyList(), etc. to avoid
> UnsupportedOperationException if code under test modifies returned collection"*

So the code under test can add to the list it got back, and nothing complains. A method that
fetches a collection, mutates it and relies on the mutation being visible elsewhere will pass
its test and fail in production — the mock handed out a throwaway list, not a view of
anything.

### `toString` and `compareTo` are special-cased before the type lookup

`ReturnsEmptyValues.answer` checks `isToStringMethod` and `isCompareToMethod` first. Two
consequences: a mock in a log line or a failure message renders as
`Mock for OrderRepository, hashCode: …` rather than `null`, and sorting a list of mocks does
not throw — every mock compares as "greater than" every other mock, and equal to itself. That
last one produces a stable but meaningless order, which is exactly the kind of thing a test
can accidentally depend on.

### 🔴 `equals` and `hashCode` cannot be stubbed at all

Mockito's own error text says so, in three separate messages:

> *"you stub either of: final/private/native/equals()/hashCode() methods. Those methods
> **cannot** be stubbed/verified."*

> *"Following methods **cannot** be stubbed/verified: final/private/equals()/hashCode()."*

They are how Mockito identifies mocks internally, so they are off limits. A mock's `equals` is
reference identity. If a test needs a collaborator whose `equals` matters, you need a real
object or a fake, not a mock.

## Gotchas

**★ Assuming an unstubbed `String` method returns `""`.**
It returns `null`. `ReturnsEmptyValues` has no `String` branch — only `ReturnsMoreEmptyValues`
does, and that class is used exclusively by `RETURNS_SMART_NULLS`.

**★ An unstubbed `Integer`-returning method silently returning `0`.**
By design: *"Returns consistent values for primitive wrapper classes."* Unlike `null`, `0` does
not fail — it flows into arithmetic and the test asserts on a number derived from a call you
forgot to stub. This is the most common way a mock-based test passes for the wrong reason.

**★ Expecting `Deque`, `Queue`, `Iterator` or a third-party collection to come back empty.**
The chain compares exact classes. Only the types it names get an empty instance; everything
else is `null`. `Iterator` in particular is *not* in the list, though `Iterable` is.

**★ Mutating the collection returned by an unstubbed method and expecting it to matter.**
Mockito deliberately hands out fresh mutable instances *"to avoid UnsupportedOperationException
if code under test modifies returned collection"*. The mutation goes into a throwaway object
that nothing else can see.

**★ Sorting or comparing mocks.**
`compareTo` is special-cased: `0` for the same reference, `1` otherwise. Sorting a list of mocks
therefore produces a stable but entirely meaningless order, and a test can come to depend on it.

**★ Trying to stub `equals` or `hashCode`.**
Mockito's own message: those methods *"cannot be stubbed/verified"*. They are how it identifies
mocks. A mock's `equals` is identity, so a mock will never be `equals` to a real object with the
same field values.

## Interview questions

**★ What does an unstubbed method on a mock return?**
Whatever `ReturnsEmptyValues` has a branch for: the zero value for primitives *and their
wrappers*, an empty `Optional`/`Stream`/`Duration`/`Period`, a fresh mutable empty instance for
the common collection interfaces and classes, a completed `CompletableFuture` holding `null`, a
description string for `toString()`, and `null` for everything else — including `String` and
every array type.

**★ Does an unstubbed method returning `Integer` give you `null` or `0`?**
`0`. The class javadoc calls this consistency: *"e.g. int-returning method returns 0 **and**
Integer-returning method returns 0, too"*. It is also the most dangerous default, because
`null` would have failed at the first unboxing whereas `0` quietly participates in the
computation the test then asserts on.

**★ Why does an unstubbed method returning `List` give a `LinkedList` rather than
`Collections.emptyList()`?**
Because the code under test might modify it. The source comment says so: new instances are used
*"to avoid UnsupportedOperationException if code under test modifies returned collection"*. The
consequence is that the mutation is invisible to everything else.

**★ Your service calls `repo.findAll()` — unstubbed — and the test passes. Explain.**
`List` is one of the types `ReturnsEmptyValues` handles, so the call returned an empty
`LinkedList` instead of `null`. Every "no results" branch in the service then behaved
correctly, and the test proved that path rather than the one you meant to test. Strict stubs
would not catch this either — there was no stubbing to be unused.

**★ Can you stub `equals()` on a mock?**
No. Mockito reports that `final/private/native/equals()/hashCode()` methods *"cannot be
stubbed/verified"* — it uses them internally to identify mocks. A mock's `equals` is reference
identity, which is also why a mock never equals a real object with identical fields.

{/* FOOTER */}
