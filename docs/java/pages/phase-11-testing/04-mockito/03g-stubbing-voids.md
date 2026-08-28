---
title: "The do-family exists because a void expression cannot be passed to when, and the order flips for a mechanical reason — doReturn(x).when(spy).foo() never calls foo(), while when(spy.foo()) always does, which is the single most consequential difference in the whole API"
sidebar_label: "03g · Stubbing voids"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> sections 5 (*"Stubbing void methods with exceptions"*) and 12 (the `do…` family) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> and the method javadocs of
> [`doThrow`, `doAnswer`, `doNothing`, `doReturn` and `doCallRealMethod`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java#L3113)
> on the same class.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[03 · Stubbing](03-stubbing.md) showed that `when(mock.foo())` works by *calling* `foo()` and
catching the invocation afterwards. That mechanism has two things it cannot do: it cannot
handle a `void` method, because there is nothing to pass to `when`; and it is unsafe on a spy,
because the call it makes is real. The `do…` family inverts the order so that Mockito is
already in stubbing mode before the method is named — nothing is ever invoked for real. That
is the whole story, and everything else on this page follows from it.**

## Why the order flips

Section 12 says it in one sentence:

> *"Stubbing void methods requires a different approach from `Mockito#when(Object)` because the
> compiler does not like void methods inside brackets..."*

```java
doThrow(new RuntimeException()).when(mockedList).clear();

// following throws RuntimeException:
mockedList.clear();
```

Read the two syntaxes side by side:

| | What runs first | Is the method actually invoked? |
|---|---|---|
| `when(mock.foo()).thenReturn(x)` | `mock.foo()` | **Yes** — on a mock it returns a default; on a spy it runs the real body |
| `doReturn(x).when(mock).foo()` | `doReturn(x)` | **No** — `when(mock)` puts the mock into stubbing mode, and `.foo()` is only recorded |

`doReturn(x)` returns a `Stubber`. `Stubber.when(mock)` hands back an object of the mock's type
that is armed to record the *next* call instead of answering it. So by the time `.foo()` is
written, Mockito already knows what the answer will be and never needs to execute anything.
This is why the argument to `when` in the second form is the **mock**, not a call on it.

## The family, and the three cases where it is required

> *"You can use `doThrow()`, `doAnswer()`, `doNothing()`, `doReturn()` and `doCallRealMethod()`
> in place of the corresponding call with `when()`, for any method. It is necessary when you*
> - *stub void methods*
> - *stub methods on spy objects (see below)*
> - *stub the same method more than once, to change the behaviour of a mock in the middle of a
>   test.*
>
> *but you may prefer to use these methods in place of the alternative with `when()`, for all
> of your stubbing calls."*

That last clause is a real endorsement of consistency, and it is worth taking. In a class that
uses a spy at all, using `do…` everywhere removes the question "is this one safe?" from every
review.

| `when` form | `do…` form |
|---|---|
| `when(m.f()).thenReturn(x)` | `doReturn(x).when(m).f()` |
| `when(m.f()).thenThrow(e)` | `doThrow(e).when(m).f()` |
| `when(m.f()).thenThrow(E.class)` | `doThrow(E.class).when(m).f()` |
| `when(m.f()).thenAnswer(a)` | `doAnswer(a).when(m).f()` |
| `when(m.f()).thenCallRealMethod()` | `doCallRealMethod().when(m).f()` |
| — (impossible for `void`) | `doNothing().when(m).f()` |

`doThrow` has the same three overloads as `thenThrow` — `doThrow(Throwable...)`,
`doThrow(Class)` and `doThrow(Class, Class...)` — and the same checked-exception validity rule
applies. Consecutive stubbing works by chaining `Stubber`s:

```java
doNothing()
  .doThrow(new RuntimeException())
  .when(mock).someVoidMethod();
```

## `doNothing()` — and why you rarely need it

The javadoc opens with the warning:

> *"Use `doNothing()` for setting void methods to do nothing. **Beware that void methods on
> mocks do nothing by default!** However, there are rare situations when doNothing() comes
> handy:"*

Exactly two, and they are both quoted in full because they are the only two:

**1. Consecutive calls on a void method:**

```java
doNothing().
doThrow(new RuntimeException())
.when(mock).someVoidMethod();

//does nothing the first time:
mock.someVoidMethod();

//throws RuntimeException the next time:
mock.someVoidMethod();
```

**2. Silencing a void method on a spy:**

```java
List list = new LinkedList();
List spy = spy(list);

//let's make clear() do nothing
doNothing().when(spy).clear();

spy.add("one");

//clear() does nothing, so the list still contains "one"
spy.clear();
```

Outside those two, `doNothing().when(mock).send(email)` is a no-op that says nothing the reader
did not already know — and under `STRICT_STUBS` it is an unnecessary stubbing that will fail the
test. Delete it.

## `doReturn()` — powerful, and not type-safe

The javadoc is unusually direct about the trade-off:

> *"Use `doReturn()` in those rare occasions when you cannot use `Mockito#when(Object)`.
> **Beware that `Mockito#when(Object)` is always recommended for stubbing because it is argument
> type-safe and more readable** (especially when stubbing consecutive calls)."*

The signature is `doReturn(Object)`. Nothing checks that the value fits the method's return
type:

```java
// compiles happily; fails at invocation time inside the code under test
doReturn("not an Optional").when(repository).findById(id);
```

`when(repository.findById(id)).thenReturn(...)` would not have compiled. That is the cost you
pay for the inverted order, and it is why `when`/`thenReturn` stays the default for plain mocks.

The two documented occasions where you have no choice, both quoted verbatim:

**1. Spying real objects where calling the real method has side effects:**

```java
List list = new LinkedList();
List spy = spy(list);

//Impossible: real method is called so spy.get(0) throws IndexOutOfBoundsException (the list is yet empty)
when(spy.get(0)).thenReturn("foo");

//You have to use doReturn() for stubbing:
doReturn("foo").when(spy).get(0);
```

**2. Overriding a previous exception-stubbing:**

```java
when(mock.foo()).thenThrow(new RuntimeException());

//Impossible: the exception-stubbed foo() method is called so RuntimeException is thrown.
when(mock.foo()).thenReturn("bar");

//You have to use doReturn() for stubbing:
doReturn("bar").when(mock).foo();
```

The second is a beautiful demonstration of the mechanism: re-stubbing with `when` invokes the
method, and the method is already stubbed to throw, so the *stubbing statement itself* throws.

Mockito's own assessment of both:

> *"Above scenarios shows a tradeoff of Mockito's elegant syntax. Note that the scenarios are
> very rare, though. Spying should be sporadic and overriding exception-stubbing is very rare.
> Not to mention that in general overriding stubbing is a potential code smell that points out
> too much stubbing."*

## `doCallRealMethod()`

```java
Foo mock = mock(Foo.class);
doCallRealMethod().when(mock).someVoidMethod();

// this will call the real implementation of Foo.someVoidMethod()
mock.someVoidMethod();
```

Same partial-mock warning as everywhere else in the API — *"Partial mock usually means that the
complexity has been moved to a different method on the same object. In most cases, this is not
the way you want to design your application."* — and the same recommendation:

> *"**Mockito.spy() is a recommended way of creating partial mocks.** The reason is it
> guarantees real methods are called against correctly constructed object because you're
> responsible for constructing the object passed to spy() method."*

Note this is `mock(Foo.class)`, not `spy(...)`: the object was never constructed, so its fields
are `null`. The real method runs against an empty object. See
[08e · Partial mocks](08e-partial-mocks.md).

Whether to adopt `do…` as the house style — and the BDD `given`/`will` vocabulary that shadows
both forms — is [03h · Choosing a stubbing vocabulary](03h-choosing-a-stubbing-vocabulary.md).

## Gotchas

**★ `doNothing()` on a plain mock's void method.**
Void methods on mocks already do nothing — the javadoc shouts it: *"**Beware that void methods
on mocks do nothing by default!**"* The stubbing adds no behaviour, and under `STRICT_STUBS` an
unused one fails the test.

**★ `doReturn(...)` silently accepting the wrong type.**
The parameter is `Object`. `doReturn("x").when(repo).findById(id)` compiles even though
`findById` returns `Optional<Order>`, and fails later inside the code under test. This is the
documented trade-off: *"`when(Object)` is always recommended for stubbing because it is argument
type-safe and more readable."*

**★ Writing `when(mock).foo()` instead of `doX().when(mock).foo()`.**
`Mockito.when` takes the *result* of a call; `Stubber.when` takes the *mock*. Calling
`when(mock)` on its own compiles (the mock is an `Object`) and then produces an error about a
missing method call, which does not name the real mistake.

**★ Forgetting the trailing method call after `when(mock)`.**
`doReturn(x).when(mock);` leaves the mock permanently armed for stubbing. The next interaction
with it — often in a completely different test — is swallowed as a stubbing, and Mockito reports
an unfinished-stubbing error from somewhere unrelated.

**★ Re-stubbing a method that is currently stubbed to throw, using `when`.**
The stubbing statement itself throws, because `when`'s argument is evaluated. The documented fix
is `doReturn("bar").when(mock).foo()`.

**★ Assuming `doThrow` escapes the checked-exception rule.**
It does not. `doThrow(Throwable...)` and `doThrow(Class)` apply the same validity check as
`thenThrow`: a checked exception must appear in the stubbed method's `throws` clause.

**★ `doCallRealMethod()` on a `mock(...)` rather than a `spy(...)`.**
`mock()` never runs a constructor, so the real method executes against an object whose fields
are all `null`. The javadoc recommends `spy()` *"because you're responsible for constructing the
object passed to spy() method"*.

## Interview questions

**★ Why can't you write `when(mock.someVoidMethod()).thenThrow(e)`?**
Because `when` takes a value and a `void` expression produces none — the javadoc says *"the
compiler does not like void methods inside brackets"*. The `do…` family reverses the order so the
method is named after Mockito is already in stubbing mode: `doThrow(e).when(mock).someVoidMethod()`.

**★ Explain the difference between `when(spy.foo()).thenReturn(x)` and `doReturn(x).when(spy).foo()`.**
The first evaluates `spy.foo()` before `when` runs, so the real method executes with all its side
effects — on an empty list, `spy.get(0)` throws `IndexOutOfBoundsException` before any stubbing
happens. The second calls `doReturn(x)` first, which returns a `Stubber`; `when(spy)` arms the
spy to record rather than answer, so `.foo()` is never really invoked.

**★ When is `do…` not merely optional?**
Three documented cases: stubbing `void` methods, stubbing methods on spies, and stubbing the same
method a second time to change behaviour mid-test — particularly when the existing stubbing
throws, since re-stubbing with `when` would trigger that throw.

**★ Is `doNothing()` ever necessary?**
Rarely. Void methods on mocks already do nothing. It earns its place in exactly two situations
the javadoc names: as the first element of a consecutive chain
(`doNothing().doThrow(e).when(mock).f()`), and to silence a void method on a *spy*, where the
real implementation would otherwise run.

**★ What do you lose by using `doReturn` instead of `when`/`thenReturn`?**
Compile-time type safety. `doReturn` takes `Object`, so a value of the wrong type is accepted at
compile time and blows up at invocation. The javadoc calls `when` *"argument type-safe and more
readable"* and recommends it whenever it is usable.

**★ Someone has `doReturn(x).when(mock);` with no method call after it. What happens?**
The mock stays in stubbing mode. The next call made on it anywhere in the test is consumed as the
target of that stubbing rather than being executed or recorded, and Mockito eventually reports an
unfinished stubbing — usually against a line that has nothing to do with the mistake. It is the
`do…` family's equivalent of a dangling `verify(mock)`.

{/* FOOTER */}
