---
title: "AdditionalAnswers turns the four Answers everyone hand-writes into one token each, and its delegatesTo is the documented alternative to a spy for objects a spy cannot wrap — with the same when-calls-the-real-method hazard and one crucial difference about self-calls"
sidebar_label: "03d · AdditionalAnswers"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class and method javadoc of
> [`AdditionalAnswers`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/AdditionalAnswers.java)
> (`returnsFirstArg`, `returnsSecondArg`, `returnsLastArg`, `returnsArgAt`,
> `returnsElementsOf`, `answersWithDelay`, `delegatesTo`, `answer`, `answerVoid`) and
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> sections 27 (*"Delegate calls to real instance"*) and 37.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Most hand-written `Answer` lambdas are one of four things: return an argument, return a
sequence, forward to something real, or adapt a typed lambda. `AdditionalAnswers` has all
four, and using them instead of a lambda removes the casts, the index arithmetic and the
unchecked `Answer<?>` that [03c · Answers](03c-answers.md) warned about. This chunk is the
inventory, plus the one member that is really a different tool wearing an `Answer`'s clothes —
`delegatesTo`.**

## The inventory

> *"Additional answers provides factory methods for answers. Currently offer answers that can
> return the parameter of an invocation at a certain position, along with answers that draw on
> a strongly typed interface to provide a neater way to write custom answers that either
> return a value or are void."*

| Factory | What it does |
|---|---|
| `returnsFirstArg()` | returns argument 0 |
| `returnsSecondArg()` | returns argument 1 |
| `returnsLastArg()` | returns the final argument |
| `returnsArgAt(int)` | returns the argument at a position |
| `returnsElementsOf(Collection)` | *"Returns elements of the collection. Keeps returning the last element forever."* |
| `answersWithDelay(long, Answer)` | *"Returns an answer after a delay with a defined length"* (milliseconds) |
| `delegatesTo(Object)` | forwards every call to another object |
| `answer(Answer1…6)` / `answerVoid(VoidAnswer1…6)` | typed lambda answers |

## `returnsFirstArg()` — the one you will use every week

A repository `save` that has to hand the entity back so the caller can read a generated field:

```java
when(repository.save(any(Order.class))).then(returnsFirstArg());
```

The javadoc's own example uses the BDD alias and shows both stubbing styles:

```java
given(carKeyFob.authenticate(carKey)).will(returnsFirstArg());
doAnswer(returnsFirstArg()).when(carKeyFob).authenticate(carKey);
```

This beats `thenReturn(someHandBuiltOrder)` for a reason worth stating: the echo **cannot
drift from what the code actually passed**. A hand-built return value is a second copy of the
object that the test author has to keep in step with the argument, and when it falls out of
step the test passes on a lie.

⚠️ **It has a documented varargs subtlety.** *"This methods works with varargs as well, mockito
will expand the vararg to return the argument at the given position"*:

```java
interface Person {
    Dream remember(Dream... dreams);
}

// returns dream1
given(person.remember(dream1, dream2, dream3, dream4)).will(returnsFirstArg());
```

but:

> *"Mockito will return the vararg array if the first argument is a vararg in the method and if
> the return type has the same type as the vararg array."*

```java
interface Person {
    Dream[] remember(Dream... otherDreams);
}

// returns otherDreams (happens to be a 4 elements array)
given(person.remember(dream1, dream2, dream3, dream4)).will(returnsFirstArg());
```

Two signatures one character apart, opposite results.

## `returnsElementsOf` — deliberately redundant

The javadoc says so itself:

> *"`when(mock.foo()).thenReturn(1, 2, 3);` is equivalent to:
> `when(mock.foo()).thenAnswer(AdditionalAnswers.returnsElementsOf(Arrays.asList(1, 2, 3)));`"*

So reach for it only when the collection is **computed** rather than literal — a list built by
a test-data helper, or one shared across parameterised cases. Otherwise use consecutive
stubbing, which reads better: [03b · Consecutive stubbing](03b-consecutive-stubbing.md). Note
it inherits the same end-of-sequence behaviour — *"Keeps returning the last element forever."*

## `answersWithDelay` — almost always the wrong tool

```java
when(client.fetch(id)).thenAnswer(answersWithDelay(200, invocation -> RESULT));
```

It sleeps the calling thread for real. Two consequences: every run of that test costs the
delay, and it only proves anything about a timeout if the timeout under test is also real
wall-clock time — which makes it a slow, flaky integration test wearing a unit test's clothes.
Its honest use is exercising a `verify(mock, timeout(…))` or an async pipeline where the
ordering, not the duration, is the point. See
[05 · Verification](05-verification.md) for `timeout`/`after`.

## `answer` and `answerVoid` — typed lambdas

These are the adapters section 37 recommends over raw `Answer` casting:

```java
// returning a value
doAnswer(answer((String input1, String input2) -> input1.equals(input2)))
    .when(mock).isSameString(anyString(), anyString());

// firing a callback
doAnswer(answerVoid((String operand, Callback callback) -> callback.receive("dummy")))
    .when(mock).execute(anyString(), any(Callback.class));
```

The parameters are typed, so no casts, and the arity is checked by the compiler.
`Answer1`…`Answer6` and `VoidAnswer1`…`VoidAnswer6` exist in 5.23.0 — note that section 37's
prose still says *"up to 5 parameters"*, which the source contradicts. Beyond six you are back
to the raw `Answer`, which is also a hint the method has too many parameters.

## `delegatesTo` and how it differs from a spy

`delegatesTo` builds a mock that forwards to a real object. It is *"Useful for spies or
partial mocks of objects that are difficult to mock or spy using the usual spy API"* — the
javadoc names three cases: *"Final classes but with an interface"*, *"Already custom proxied
object"*, and *"Special objects with a finalize method, i.e. to avoid executing it 2 times"*.

The difference from `spy(...)`, verbatim, is the part worth memorising, because it also
explains a spy's most surprising behaviour:

> *"The regular spy (`Mockito#spy(Object)`) contains **all** state from the spied instance and
> the methods are invoked on the spy. The spied instance is only used at mock creation to copy
> the state from. If you call a method on a regular spy and it internally calls other methods
> on this spy, those calls are remembered for verifications, and they can be effectively
> stubbed."*
>
> *"The mock that delegates simply delegates all methods to the delegate. The delegate is used
> all the time as methods are delegated onto it. If you call a method on a mock that delegates
> and it internally calls other methods on this mock, those calls are **not** remembered for
> verifications, stubbing does not have effect on them, too. Mock that delegates is less
> powerful than the regular spy but it is useful when the regular spy cannot be created."*

```java
final class DontYouDareToMockMe implements list { ... }

DontYouDareToMockMe awesomeList = new DontYouDareToMockMe();

List mock = mock(List.class, delegatesTo(awesomeList));
```

And it inherits the spy's stubbing hazard exactly:

> *"This feature suffers from the same drawback as the spy. The mock will call the delegate if
> you use regular `when().then()` stubbing style. Since the real implementation is called this
> might have some side effects. Therefore, you should use the
> `doReturn|Throw|Answer|CallRealMethod` stubbing style."*

```java
List listWithDelegate = mock(List.class, AdditionalAnswers.delegatesTo(awesomeList));

// Impossible: real method is called so listWithDelegate.get(0) throws
// IndexOutOfBoundsException (the list is yet empty)
when(listWithDelegate.get(0)).thenReturn("foo");

// You have to use doReturn() for stubbing
doReturn("foo").when(listWithDelegate).get(0);
```

The delegate does not have to be the same type: *"The only requirement is that the instance
should have compatible method signatures including the return values. Only the methods that
were actually executed on the mock need to be present on the delegate type."* That last
sentence is the escape hatch — the delegate can be a small hand-written object that implements
only the three methods your test path touches.

## Gotchas

**★ `returnsFirstArg()` on a varargs method.**
Documented behaviour: it returns the vararg *array* if the first parameter is the vararg and
the return type matches the array type, otherwise the first element. Two nearly identical
signatures give opposite results, and nothing warns you.

**★ Hand-building the return value for `save` instead of echoing it.**
`thenReturn(new Order(...))` creates a second object the test must keep in step with the
argument. When it drifts, the test asserts on a value the code never produced.
`then(returnsFirstArg())` cannot drift.

**★ `answersWithDelay` used to "test" a timeout.**
It sleeps the calling thread for real. It makes the suite slower on every run, and it proves a
timeout only if the timeout is also real wall-clock time. Prefer injecting the timeout value
and asserting on the decision, not the duration.

**★ `returnsElementsOf` where `thenReturn(a, b, c)` would do.**
The javadoc calls the two equivalent. The collection form is only worth it when the collection
is computed; otherwise it is a longer way to say the same thing, and it hides the values behind
a variable.

**★ `delegatesTo` stubbed with `when(...)`.**
The javadoc is explicit that it *"suffers from the same drawback as the spy"* — `when` calls
the delegate for real, side effects and all. Use `doReturn(...).when(mock).method()`.

**★ Expecting a `delegatesTo` mock to record self-calls.**
It does not. *"If you call a method on a mock that delegates and it internally calls other
methods on this mock, those calls are **not** remembered for verifications, stubbing does not
have effect on them, too."* A regular spy does record them — that is the one functional
difference between the two, and it is what makes `delegatesTo` *"less powerful"*.

**★ Assuming the typed-answer ceiling is five.**
Section 37's prose says five; the source declares `Answer6` and `VoidAnswer6`. The javadoc
prose was not updated. If you need seven, the problem is the method signature.

**★ Static-importing `answer` into a test that also uses AssertJ or a domain `answer`.**
`AdditionalAnswers.answer` is a very common name. A collision resolves to whichever import
wins and produces an error about lambda shapes rather than about names. Import the class and
qualify when the test file is crowded.

## Interview questions

**★ What is `AdditionalAnswers` for?**
Two things. Pre-built answers — `returnsFirstArg`, `returnsSecondArg`, `returnsLastArg`,
`returnsArgAt`, `returnsElementsOf`, `delegatesTo`, `answersWithDelay` — and typed lambda
adapters: `answer(...)` and `answerVoid(...)` wrap `Answer1`…`Answer6` and
`VoidAnswer1`…`VoidAnswer6`, so you write `(String operand, Callback cb) -> cb.receive("dummy")`
instead of casting out of `invocation.getArgument(1)`.

**★ Your repository mock's `save` returns null and the service NPEs on the returned entity.
Fix it in one line.**
`when(repository.save(any())).then(returnsFirstArg());` — the saved object is handed straight
back. This is the single most common legitimate use of an answer, and it beats stubbing a
hand-built return value because the echo cannot drift from what the code actually passed.

**★ What is the difference between `spy(obj)` and `mock(Type.class, delegatesTo(obj))`?**
A spy copies the state of the object into a new instance and runs methods *on the spy*, so
internal self-calls are recorded and can be stubbed. A delegating mock forwards each call to
the original object, which then runs its own internals normally — those self-calls are not
recorded and cannot be stubbed. The javadoc calls the delegating form *"less powerful than the
regular spy but … useful when the regular spy cannot be created"*, for example a final class
that implements an interface.

**★ Why does `when(delegatingMock.get(0)).thenReturn("foo")` fail?**
Because `when`'s argument is evaluated first, so `get(0)` is delegated to the real object for
real — on an empty list that throws before Mockito ever sees the stubbing. The documentation's
own example shows exactly this, and the fix is `doReturn("foo").when(mock).get(0)`.

**★ When is `delegatesTo` the right answer rather than a spy?**
When the object cannot be spied: a final class that happens to implement an interface, an
object already wrapped in a custom proxy, or one with a `finalize` method you do not want run
twice — the javadoc's three named cases. It is also useful when you want a *partial* real
object whose delegate only implements the handful of methods the test path touches, since
*"Only the methods that were actually executed on the mock need to be present on the delegate
type."*

**★ A colleague writes `thenAnswer(inv -> inv.getArgument(0))`. What is the review comment?**
That `then(returnsFirstArg())` says the same thing with no cast, no index and no unchecked
`Answer<?>`, and that it handles the varargs case according to a documented rule instead of
whatever the raw index happens to produce.

{/* FOOTER */}
