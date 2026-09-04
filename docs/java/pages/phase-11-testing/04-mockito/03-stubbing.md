---
title: "when(mock.get(0)) works by actually calling the method and catching the invocation on a thread-local, which explains every strange rule about stubbing — why void methods cannot use it, why the last stubbing wins, and why the same syntax is a landmine on a spy"
sidebar_label: "03 · Stubbing"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> (section 2, stubbing) and the javadoc of
> [`OngoingStubbing`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/stubbing/OngoingStubbing.java)
> — `thenReturn`, `thenThrow(Throwable...)`, `thenThrow(Class)` — and of
> [`Mockito.when`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java#L2915).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**`when(mock.get(0)).thenReturn("first")` looks like it passes a method *call* to `when`. It
cannot — Java evaluates arguments before invoking a method, so by the time `when` runs,
`mock.get(0)` has already executed and returned `null`. What `when` actually receives is that
`null`. The stubbing works because the mock recorded the invocation on a thread-local as a
side effect, and `when` picks it up from there. Every rule in this chunk falls out of that
one mechanism, and so does the whole `do…` family in
[03g · Stubbing voids](03g-stubbing-voids.md).**

## The mechanism, before the API

```java
when(mockedList.get(0)).thenReturn("first");
```

Reading it the way the JVM does:

1. `mockedList.get(0)` is invoked **for real** on the mock. The mock's handler records the
   invocation — mock, method, arguments — and returns the default value for `String`, which
   is `null`. It also parks that invocation as the *ongoing stubbing* on a thread-local
   inside Mockito.
2. `when(null)` is called. Its argument is worthless; Mockito ignores it entirely and reads
   the parked invocation instead.
3. `when` returns an `OngoingStubbing<String>` typed from the *declared return type* of
   `get`, which is where the compile-time safety of `thenReturn` comes from.
4. `.thenReturn("first")` attaches the answer to the recorded invocation and un-parks it.

Four consequences you will hit:

- **`void` methods cannot be stubbed this way.** There is no value to pass to `when`, so the
  expression does not compile. That is the entire reason the `do…` family exists.
- **On a spy, step 1 runs the real method.** A mock returns `null` harmlessly; a spy executes
  the body, with whatever side effects and exceptions it has. See
  [08d · Stubbing a spy](08d-stubbing-a-spy.md).
- **Argument matchers are also recorded on a thread-local**, in step 1, which is why mixing a
  matcher and a raw value in one call breaks — [04 · Argument matchers](04-argument-matchers.md).
- **The `OngoingStubbing` is transient state, not a handle.** The javadoc for `when` is blunt:

> *"@return OngoingStubbing object used to stub fluently. **Do not** create a reference to
> this returned object."*

Assigning it to a field or a variable and using it later stubs whatever invocation is parked
at that moment, which is usually not the one you meant.

## `thenReturn`, and the four rules the javadoc states

Mockito's own example, section 2:

```java
// You can mock concrete classes, not just interfaces
LinkedList mockedList = mock(LinkedList.class);

// stubbing
when(mockedList.get(0)).thenReturn("first");
when(mockedList.get(1)).thenThrow(new RuntimeException());

// following prints "first"
System.out.println(mockedList.get(0));

// following throws runtime exception
System.out.println(mockedList.get(1));

// following prints "null" because get(999) was not stubbed
System.out.println(mockedList.get(999));
```

The four bullets under it are the whole contract:

> - *"By default, for all methods that return a value, a mock will return either null, a
>   primitive/primitive wrapper value, or an empty collection, as appropriate. For example 0
>   for an int/Integer and false for a boolean/Boolean."*
> - *"Stubbing can be overridden: for example common stubbing can go to fixture setup but the
>   test methods can override it. Please note that overriding stubbing is a potential code
>   smell that points out too much stubbing."*
> - *"Once stubbed, the method will always return a stubbed value, regardless of how many
>   times it is called."*
> - *"Last stubbing is more important - when you stubbed the same method with the same
>   arguments many times. Other words: **the order of stubbing matters** but it is only
>   meaningful rarely."*

The first bullet gets a chunk of its own — the "as appropriate" hides a lookup table with
sharp edges. See [03e · What an unstubbed method returns](03e-unstubbed-defaults.md).

The second is worth arguing about. A `@BeforeEach` that stubs a repository, and three test
methods that each re-stub the same call with different values, means the fixture stubbing is
dead in three of four tests — and under `STRICT_STUBS` a fixture stubbing unused by *any*
test in the class is a failure. See [07 · Strictness](07-strictness.md).

### It is type-checked, and that is not an accident

`OngoingStubbing<T>` is parameterised by the stubbed method's return type:

```java
OngoingStubbing<T> thenReturn(@Nullable T value);
```

So `when(repository.findById(id)).thenReturn("nope")` does not compile — `findById` returns
`Optional<Order>`. This is one of the few places Mockito is statically safe, and it is why
`thenReturn` should be your default over `thenAnswer`, which is typed `Answer<?>` and checks
nothing until runtime — see [03c · Answers](03c-answers.md).

## `thenThrow`, and the checked-exception rule

Two overloads matter.

```java
when(gateway.charge(order)).thenThrow(new GatewayTimeoutException("t/o"));  // instance
when(gateway.charge(order)).thenThrow(GatewayTimeoutException.class);       // type
```

The validity rule, verbatim from `OngoingStubbing`:

> *"If throwables contain a checked exception then it has to match one of the checked
> exceptions of method signature."*

and for the `Class` form:

> *"If the throwable class is a checked exception then it has to match one of the checked
> exceptions of the stubbed method signature."*

So Mockito enforces at stubbing time what the compiler would enforce on a real call: you
cannot make a method throw a checked exception it does not declare. Unchecked exceptions and
`Error`s are always allowed. A test that stubs `IOException` on a method whose signature has
no `throws` clause fails at the `thenThrow` line, not at the call site — which is confusing
until you know the rule, because nothing on that line mentions the signature.

### Two smaller facts about the two forms

**The `Class` form constructs a fresh instance per invocation.**

> *"Each throwable class will be instantiated for each method invocation."*

The instance form reuses one object. That matters if you assert on identity, and it matters
more if the exception carries mutable state — the same instance is rethrown from every call,
so a suppressed-exception list or a mutated field accumulates across calls.

**The `Class` form may have no usable stack trace.**

> *"Note depending on the JVM, stack trace information may not be available in the generated
> throwable instance. If you require stack trace information, use
> `OngoingStubbing#thenThrow(Throwable...)` instead."*

If the thing you are testing logs the stack trace, or your assertion inspects it, use the
instance form.

**Null is rejected.** *"If throwable is null then exception will be thrown."* — Mockito throws
rather than stubbing "throw nothing".

Consecutive throwing works the same way as consecutive returning, and both are
[03b · Consecutive stubbing](03b-consecutive-stubbing.md):

```java
when(mock.someMethod("some arg")).thenThrow(new RuntimeException(), new NullPointerException());
```

## Gotchas

**★ `when(spy.foo())` executes `foo()`.**
The argument to `when` must be evaluated first, and on a spy that means the real body runs —
with its side effects, and possibly its exception, before Mockito ever sees the stubbing.
`doReturn(x).when(spy).foo()` is the form that does not.

**★ Trying to `when` a `void` method.**
It does not compile, and the error message is about types, not about stubbing. There is
nothing to hand `when`; use `doNothing()`, `doThrow()` or `doAnswer()`.

**★ Storing the `OngoingStubbing` in a variable.**
The javadoc says *"Do not create a reference to this returned object."* It is a handle on
thread-local state that has already moved on. Using it later stubs the wrong invocation.

**★ Stubbing a checked exception the method does not declare.**
Mockito rejects it at the `thenThrow` line — the checked exception *"has to match one of the
checked exceptions of method signature"*. The error points at the stubbing, not at the
signature, which is where the confusion comes from.

**★ `thenThrow(SomeException.class)` and then asserting on the stack trace.**
*"depending on the JVM, stack trace information may not be available in the generated
throwable instance."* If the assertion or the production logging reads the trace, pass an
instance instead.

**★ Reusing one exception instance across many calls.**
`thenThrow(instance)` rethrows the *same* object every time. Anything that mutates it —
`addSuppressed`, `initCause`, a fillInStackTrace-less custom exception with a mutable field —
accumulates across invocations. The `Class` form constructs a fresh one per call.

**★ Fixture stubbing in `@BeforeEach` that every test overrides.**
The javadoc calls overriding *"a potential code smell that points out too much stubbing"*,
and under `STRICT_STUBS` an entirely unused fixture stubbing fails the class. If each test
needs its own value, stub in each test.

**★ Stubbing a method and then verifying the same call.**
Section 2: *"Although it is possible to verify a stubbed invocation, usually **it's just
redundant**. If your code cares what `get(0)` returns, then something else breaks (often even
before `verify()` gets executed). If your code doesn't care what `get(0)` returns, then it
should not be stubbed."*

## Interview questions

**★ How can `when(mock.get(0))` possibly work, given Java evaluates arguments first?**
It does not receive the call — it receives the call's *result*, which is the mock's default
value. The real work happens as a side effect: invoking `get(0)` on the mock records the
invocation on a thread-local as the ongoing stubbing, and `when` reads it from there, ignoring
its own argument. That is why the mechanism cannot work for `void`, why it is dangerous on a
spy, and why argument matchers have to be recorded the same way.

**★ Why can't you stub a `void` method with `when`?**
Because `when` needs a value to be passed to it, and a `void` expression has none — it does
not compile. The `do…` family inverts the order so the method call happens after Mockito is
already in stubbing mode: `doNothing().when(mock).foo()`.

**★ Can you make a mock throw a checked exception?**
Only one the method's signature declares. Mockito applies the same rule the compiler applies
to a real call, and rejects the stubbing otherwise — *"it has to match one of the checked
exceptions of method signature."* Unchecked exceptions and errors are unrestricted.

**★ What is the difference between `thenThrow(new Foo())` and `thenThrow(Foo.class)`?**
The instance form rethrows the same object on every invocation and has a real stack trace. The
class form instantiates a fresh exception per invocation — which avoids shared mutable state —
but the javadoc warns that stack trace information may not be available in the generated
instance, depending on the JVM.

**★ Why does the javadoc say not to keep a reference to the `OngoingStubbing`?**
Because it is a view onto Mockito's current thread-local stubbing state, not a durable handle
on a particular stub. By the time you use a stored reference, the parked invocation is a
different one, and you stub something you did not intend.

**★ Your `@BeforeEach` stubs the repository and every test overrides that stubbing. What is
the review comment?**
Two. The javadoc calls overriding stubbing *"a potential code smell that points out too much
stubbing"* — if the value differs per test, it belongs in the test. And under the default
`STRICT_STUBS` a fixture stubbing that no test actually uses fails the whole class, which is
the framework making the same point.

**★ You stubbed `repository.findById` and you also `verify` it. Is that useful?**
No — it is the redundancy Mockito's own documentation names. If the code depends on the
return value, the assertion on the outcome already proves the call happened; if it does not
depend on the value, the stubbing should not be there. The verification only adds a second
place to update when the collaboration changes.

{/* FOOTER */}
