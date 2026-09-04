---
title: "thenAnswer is the only stubbing that sees the arguments, which makes it the only way to echo a saved entity back or fire a callback — and it is also the escape hatch through which a whole unnamed, untested implementation gets smuggled into a lambda"
sidebar_label: "03c · Answers"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> sections 11 (*"Stubbing with callbacks"*), 24 (*"One-liner stubs"*) and 37 (*"Java 8 Custom
> Answer Support"*), plus
> [`InvocationOnMock`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/invocation/InvocationOnMock.java),
> [`OngoingStubbing`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/stubbing/OngoingStubbing.java)
> and
> [`AdditionalAnswers`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/AdditionalAnswers.java).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**`thenReturn` is type-checked and static; it cannot look at what it was called with. When
the answer has to depend on the argument — echo back a saved entity, invoke a callback the
caller passed in, fail for one input and succeed for another — you need an `Answer`. Mockito
ships the feature while openly discouraging it, and the reason is worth taking seriously: an
`Answer` is arbitrary code with no type checking, and it is where tests quietly grow a second
implementation of the interface. This chunk continues [03 · Stubbing](03-stubbing.md).**

## The API, and the warning attached to it

Section 11 opens by discouraging its own feature:

> *"Yet another controversial feature which was not included in Mockito originally. We
> recommend simply stubbing with `thenReturn()` or `thenThrow()`, which should be enough to
> test/test-drive any clean and simple code. However, if you do have a need to stub with the
> generic Answer interface, here is an example:"*

```java
when(mock.someMethod(anyString())).thenAnswer(
    new Answer() {
        public Object answer(InvocationOnMock invocation) {
            Object[] args = invocation.getArguments();
            Object mock = invocation.getMock();
            return "called with arguments: " + Arrays.toString(args);
        }
});
```

`then(Answer)` is a pure alias for `thenAnswer(Answer)` — the javadoc says so and offers
`when(mock.foo()).then(returnCoolValue())` as the readability case. `doAnswer(...)` is the
same thing for `void` methods and for spies, in
[03g · Stubbing voids](03g-stubbing-voids.md).

🔴 **`thenAnswer` takes `Answer<?>`, not `Answer<T>`.** Nothing checks that what your lambda
returns is assignable to the method's return type. A mismatch surfaces at *invocation* time,
as a `ClassCastException` thrown from inside Mockito's own frames, at whatever line of
production code happened to call the mock. That is a materially worse failure than
`thenReturn`'s compile error, and it is the strongest practical reason to prefer `thenReturn`.

## What `InvocationOnMock` gives you

| Method | Returns |
|---|---|
| `getArgument(int)` | the argument at that index, cast to the target type — the readable form |
| `getArgument(int, Class<T>)` | the same, with an explicit class, *"necessary to circumvent issues when dealing with generics"* |
| `getArguments()` | all arguments as `Object[]` — *"Vararg are expanded in this array"* |
| `getRawArguments()` | *"unprocessed arguments, exactly as provided to this invocation"* (since 4.7.0) — varargs **not** expanded |
| `getMock()` | the mock the call landed on |
| `getMethod()` | the reflective `Method` |
| `callRealMethod()` | runs the real implementation; *"depending on the real implementation it might throw exceptions"* |

The `getArguments()` / `getRawArguments()` split is the one that bites. On
`void log(String fmt, Object... args)`, a call `log("x", a, b)` gives `getArguments()` three
elements and `getRawArguments()` two — the second being an `Object[]`. Index-based answers
written against one and run against the other read the wrong slot.

`getArgument(int, Class<T>)` exists for exactly two situations, per the javadoc:

> - *"You want to directly invoke a method on the result of `getArgument(int)`."*
> - *"You want to directly pass the result of the invocation into a function that accepts a
>   generic parameter."*

Otherwise prefer `getArgument(int)` and, if the compiler complains, assign to a typed local
first. `getArgument(int)` is an unchecked cast to whatever the assignment target demands, so
it silently succeeds at the call and blows up later — the typed local at least fails on the
line that names the type.

## The lambda forms

Since `Answer` is a single-method interface, section 37 shows the short version:

```java
// answer by returning 12 every time
doAnswer(invocation -> 12).when(mock).doSomething();

// answer by using one of the parameters - converting into the right
// type as your go - in this case, returning the length of the second string parameter
// as the answer. This gets long-winded quickly, with casting of parameters.
doAnswer(invocation -> ((String) invocation.getArgument(1)).length())
    .when(mock).doSomething(anyString(), anyString(), anyString());
```

*"This gets long-winded quickly, with casting of parameters"* is the javadoc's own assessment,
and it is the reason `AdditionalAnswers` exists:

```java
// Java 8 - style 2 - assuming static import of AdditionalAnswers
doAnswer(answerVoid((String operand, Callback callback) -> callback.receive("dummy")))
    .when(mock).execute(anyString(), any(Callback.class));
```

> *"The methods `AdditionalAnswers#answer(Answer1)` and `AdditionalAnswers#answerVoid(VoidAnswer1)`
> can be used to create the answer. They rely on the related answer interfaces in
> org.mockito.stubbing that support answers up to 5 parameters."*

⚠️ **That sentence is out of date in 5.23.0.** `AdditionalAnswers` declares
`answer(Answer6<…>)` and `answerVoid(VoidAnswer6<…>)` in the source, so the ceiling is six
parameters, not five. The prose in section 37 was not updated. Beyond six you are back to the
raw `Answer` and manual casts — which is also a hint that the method has too many parameters.
The pre-built answers themselves are [03d · AdditionalAnswers](03d-additional-answers.md).

## When an `Answer` is legitimate, and when it is a fake trying to escape

Legitimate:

- **Return one of the arguments.** A `save` that echoes back what it was given, so the code
  under test can read a generated field. `returnsFirstArg()` says it in one token —
  [03d · AdditionalAnswers](03d-additional-answers.md).
- **Invoke a callback.** The `answerVoid` example above is the canonical case: the code under
  test passes a `Callback` and depends on it firing.
- **Throw conditionally on the argument** — succeed for one input, fail for another, in a
  single stubbing.

Not legitimate: an `Answer` with branches, a `Map` inside it, or accumulated state. At that
point you have written an implementation of the interface inside a lambda, with no name, no
type, and no tests. Write it as a class that implements the interface instead — that is a
fake, and it is [12 · Mocks vs fakes](12-mocks-vs-fakes.md).

```java
// The smell — an implementation hiding in a lambda
Map<OrderId, Order> store = new HashMap<>();
when(repository.save(any())).thenAnswer(inv -> {
    Order o = inv.getArgument(0);
    store.put(o.id(), o);
    return o;
});
when(repository.findById(any())).thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0))));

// The same thing, named, typed and reusable
OrderRepository repository = new InMemoryOrderRepository();
```

## `thenCallRealMethod` and the partial-mock warning

```java
when(mock.someMethod()).thenCallRealMethod();
```

The javadoc attaches its standard warning and one specific caveat:

> *"someMethod() must be safe (e.g. doesn't throw, doesn't have dependencies to the object
> state, etc.) if it isn't safe then you will have trouble stubbing it using this api. Use
> `Mockito.doCallRealMethod()` instead."*

That caveat is the `when` mechanism restated: `when(mock.someMethod())` calls `someMethod()`
before you have told Mockito what to do with it. On a plain mock the method body does not run,
so it is safe; on a mock created with `CALLS_REAL_METHODS`, or on a spy, it does run. And:

> *"**Mockito.spy() is a recommended way of creating partial mocks.** The reason is it
> guarantees real methods are called against correctly constructed object because you're
> responsible for constructing the object passed to spy() method."*

## One-liner stubs

`OngoingStubbing.getMock()` closes the loop so a stub can be built in a field initialiser
(section 24):

```java
public class CarTest {
  Car boringStubbedCar = when(mock(Car.class).shiftGear()).thenThrow(EngineNotStarted.class).getMock();

  @Test public void should... {}
}
```

⚠️ Useful for a genuinely boring collaborator. It also hides the mock's type behind inference
and puts a stubbing outside any lifecycle method, so under `STRICT_STUBS` an unused one is
harder to trace back. Use it sparingly.

## Gotchas

**★ Reaching for `thenAnswer` when `thenReturn` would do.**
`thenReturn` is checked against the method's return type at compile time; `thenAnswer` takes
`Answer<?>` and fails at runtime with a `ClassCastException` thrown from inside Mockito, at
whatever production line called the mock. Mockito's own documentation recommends
`thenReturn`/`thenThrow` first.

**★ Index confusion between `getArguments()` and `getRawArguments()` on a varargs method.**
`getArguments()` expands varargs; `getRawArguments()` does not. An `Answer` written for one
reads a different slot when run against the other, and the mismatch shows up as a cast failure
rather than as a wrong index.

**★ `getArgument(int)` assigned straight into a call.**
It is an unchecked cast driven by the target type, so `inv.getArgument(0).toString()` compiles
against `Object` and a wrong index fails somewhere else. Assign to a typed local — the failure
then names the type on the line that declared it.

**★ An `Answer` that has grown branches and state.**
Once the lambda has an `if`, a `Map` and a counter, it is an unnamed, untested implementation
of the interface. Promote it to a real class — a fake — where it can be read, named and
reused.

**★ Expecting `thenCallRealMethod()` to be safe on an abstract or unconstructed mock.**
A plain `mock(...)` is not constructed the way the class expects; fields are null. The
javadoc's requirement is that the method *"doesn't have dependencies to the object state"*.
`spy(new RealThing(...))` is the recommended route because you build the object yourself.

**★ A one-liner stub in a field initialiser under `STRICT_STUBS`.**
It is a stubbing that belongs to no test method. If no test uses it, strictness reports it
against the class, and the field initialiser is an awkward place to trace back from.

## Interview questions

**★ When would you use `thenAnswer` rather than `thenReturn`?**
When the return value depends on the arguments: echoing back a saved entity so the caller can
read a generated id, invoking a callback the code under test passed in, or throwing for one
input and succeeding for another. Mockito's own documentation calls the feature controversial
and recommends `thenReturn`/`thenThrow` first, because `thenReturn` is type-checked at compile
time and an `Answer` is not.

**★ How would you test that a service invokes a callback it was passed?**
Stub the collaborator with `doAnswer(answerVoid((String op, Callback cb) -> cb.receive("dummy")))`
so the callback actually fires, then assert on whatever the callback caused. This is one of the
cases `thenReturn` cannot express, because the effect is the invocation of an argument rather
than a return value.

**★ You see a `thenAnswer` lambda with a `HashMap` and three `if` branches. What do you say in
review?**
That it is an implementation of the interface with no name and no type, living inside a test
method. Extract it into a class implementing that interface — an in-memory fake — where it can
be read, reused across tests and, if it is worth it, contract-tested against the real thing.

{/* FOOTER */}
