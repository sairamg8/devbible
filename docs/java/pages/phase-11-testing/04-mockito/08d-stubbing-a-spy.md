---
title: "when(spy.foo()) runs foo() for real before Mockito has been told anything, because when() takes a value and Java evaluates arguments first — which is why every spy example in Mockito's own javadoc uses doReturn, and why the library's wrong-return-type error message names this exact mistake as reason number two"
sidebar_label: "08d · Stubbing a spy"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §13 gotcha 1, §17 (*"Resetting mocks"*), the javadoc of `Mockito.spy(Object)`,
> `Mockito.doReturn`, `Mockito.doCallRealMethod` and
> [`MockSettings.spiedInstance`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/MockSettings.java),
> the `Answers.CALLS_REAL_METHODS` javadoc, and `Reporter.wrongTypeOfReturnValue` and
> `Reporter.missingMethodInvocation` under
> `mockito-core/src/main/java/org/mockito/internal/exceptions/`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — every exception string on this page
> is assembled from `Reporter`'s own source, never from a console.

**On a plain mock, `when(mock.foo())` and `doReturn(x).when(mock).foo()` do the same thing and
choosing between them is a style question — [03h](03h-choosing-a-stubbing-vocabulary.md). On a
spy they are not equivalent and it is not a style question: one of them executes the method you
are trying to replace. This chunk is why, what it costs, what `doReturn` costs in exchange, and
what strict stubbing makes of the result.**

## The mechanism, in one paragraph

`when` is an ordinary Java method taking an ordinary Java argument:

```java
public static <T> OngoingStubbing<T> when(T methodCall)
```

Java evaluates arguments before the call. So `when(spy.get(0))` is:

1. **call `spy.get(0)`** — the spy's default answer is `CALLS_REAL_METHODS`, so the real
   `LinkedList.get(0)` executes;
2. hand its *return value* to `when`, which then looks at the thread-local record of the last
   invocation to work out what you meant.

Step 1 is the whole problem. On a plain mock, step 1 is harmless — the method body never runs
and you get `null`. On a spy, step 1 is the real method, with its real side effects and its real
exceptions, running before you have told Mockito anything. [03 · Stubbing](03-stubbing.md) sets
out the same two-step mechanism for mocks; this is what it does to a spy.

`doReturn(...)` has no such step. `doReturn("foo").when(spy).get(0)` calls `when(spy)` — which
puts the spy into stubbing mode — and *then* calls `get(0)` on a spy that is already primed to
record rather than execute. Nothing real runs.

## The javadoc's example, verbatim

Gotcha 1 of `spy(Object)`, and the identical text on `@Spy` and on `MockSettings.spiedInstance`:

> *"Sometimes it's impossible or impractical to use `Mockito#when(Object)` for stubbing spies.
> Therefore for spies it is recommended to always use `doReturn`|`Answer`|`Throw()`|
> `CallRealMethod` family of methods for stubbing."*

```java
List list = new LinkedList();
List spy = spy(list);

//Impossible: real method is called so spy.get(0) throws IndexOutOfBoundsException (the list is yet empty)
when(spy.get(0)).thenReturn("foo");

//You have to use doReturn() for stubbing
doReturn("foo").when(spy).get(0);
```

Note the word Mockito chose: **"always"**. Not "prefer", not "consider". `spiedInstance` states
the rule as a property of the object rather than a recommendation:

> *"About stubbing for a partial mock, as it is a spy it will always call the real method, unless
> you use the `doReturn`|`Throw`|`Answer`|`CallRealMethod` stubbing style."*

## 🔴 The failure you get is usually not an exception

The `get(0)` example is the *lucky* case: it throws, so you find out. The dangerous case is a
real method that succeeds.

```java
@Spy OrderRepository repository = new JdbcOrderRepository(dataSource);

// This INSERTS. Then it stubs.
when(repository.save(order)).thenReturn(order.withId(ID));
```

The row is written. The counter is incremented. The e-mail is sent. The file is deleted. Then
Mockito records the stubbing, the test passes, and the side effect stays in whatever the spy is
talking to. The stub you wrote is doing its job perfectly — it is the setup line that had a
second, invisible job.

Three shapes of this that reach code review unnoticed:

- **The method mutates the spy's own state.** `when(spy.next()).thenReturn(x)` advances the
  iterator; the later assertion then reads position 2 and nobody can see why.
- **The method is idempotent-looking but counts.** `when(spy.acquire()).thenReturn(lease)`
  takes a permit from a semaphore that is never released.
- **The method logs or audits.** A test asserting "exactly one audit entry" fails by one, and
  the extra entry was written by the stubbing line.

## The other side: what `doReturn` costs

`doReturn` is not free, and pretending otherwise is how the other half of the bugs happen. Its
signature is:

```java
public static Stubber doReturn(Object toBeReturned)
```

**`Object`.** There is no compile-time relationship between what you pass and what the method
returns. `when(spy.size()).thenReturn("nope")` does not compile; `doReturn("nope").when(spy).size()`
compiles perfectly and fails at run time. Mockito's `wrongTypeOfReturnValue` message is built
for exactly this moment, and its reason 2 names the spy case explicitly:

```text
String cannot be returned by size()
size() should return int
***
If you're unsure why you're getting above error read on.
Due to the nature of the syntax above problem might occur because:
1. This exception *might* occur in wrongly written multi-threaded tests.
   Please refer to Mockito FAQ on limitations of concurrency testing.
2. A spy is stubbed using when(spy.foo()).then() syntax. It is safer to stub spies -
   - with doReturn|Throw() family of methods. More in javadocs for Mockito.spy() method.
```

The sentences are `Reporter`'s; the type names are the placeholders it fills. Read the message
carefully the next time you see it: it fires both when you used `when` on a spy **and** when you
used `doReturn` with the wrong type, which is why it lists both causes.

So the trade is real: `when` gives you type safety and executes the method; `doReturn` skips
execution and gives up type safety. On a spy there is no third option, and the javadoc has
already decided for you.

## The whole `do…` family applies

Everything with a `do` prefix takes the same form, and [03g · Stubbing voids](03g-stubbing-voids.md)
covers the family. The spy-specific readings:

```java
doReturn(cached).when(spy).load(KEY);          // replace a return value
doThrow(new IOException()).when(spy).flush();  // replace with a failure
doNothing().when(spy).clear();                 // silence a void side effect
doAnswer(inv -> compute(inv)).when(spy).map(any());
doCallRealMethod().when(spy).validate(any());  // restore the real one, explicitly
```

`doNothing()` is the one that only makes sense on a spy or a partial mock — on a plain mock,
void methods already do nothing. §13's second worked example in the javadoc is precisely
`doNothing().when(spy).clear();`.

`doCallRealMethod()` looks redundant on a spy, since real is the default. It is not: it is how
you **un-stub** a method for one interaction sequence — for example after
`doReturn(a).doCallRealMethod().when(spy).next()` — and it is the only way to make a
`mock(..., CALLS_REAL_METHODS)`-free plain mock run one real method. Its javadoc carries the
partial-mock warning and the recommendation that sends you back to `spy()`:

> *"**Mockito.spy() is a recommended way of creating partial mocks.** The reason is it guarantees
> real methods are called against correctly constructed object."*

⚠️ On an **abstract** method `doCallRealMethod()` throws — *"Cannot call abstract real method on
java object!"* — while the spy's own default answer silently returns a type default for the same
method. [08b](08b-what-a-spy-can-intercept.md) has that asymmetry in full.

## Strict stubbing sees spies exactly as it sees mocks

A spy is a mock ([08](08-spies.md)), so everything in [07 · Strictness](07-strictness.md)
applies unchanged: a stub on a spy that no test uses is an `UnnecessaryStubbingException`, and an
argument mismatch between the stubbed call and the production call is a
`PotentialStubbingProblem`.

🔴 The interaction that surprises people is the **combination** with `when`-on-a-spy. Consider:

```java
when(spy.rateFor(GOLD)).thenReturn(RATE);   // 1. runs rateFor(GOLD) for real
// ... production code calls spy.rateFor(SILVER)
```

Under `STRICT_STUBS` the mismatch is flagged, and the flagged invocation may be the one **your
own stubbing line made**, not the one production made — because line 1 genuinely invoked
`rateFor(GOLD)` on the spy before the stubbing existed. `doReturn(RATE).when(spy).rateFor(GOLD)`
does not create that phantom invocation at all. This is one more reason the two forms are not
interchangeable on a spy: they differ in the *invocation record*, not only in side effects.

## `reset` on a spy resets less than you think

§17 is unambiguous about `reset` being a smell — *"Using this method could be an indication of
poor testing. Normally, you don't need to reset your mocks, just create new mocks for each test
method."* — and on a spy there is a second reason to avoid it.

`MockUtil.resetMock` builds a new `MockHandler` and hands it to the mock maker. What that clears
is Mockito's bookkeeping: stubbings and recorded invocations, exactly as §17 says — *"at this
point the mock forgot any interactions and stubbing"*. What it does **not** touch is the object's
own fields, which on a spy are real state copied from the instance you passed and then mutated by
every real method that has run since. So `reset(spy)` gives you a clean stubbing slate over a
dirty object. Build a new spy from a new instance instead.

## Gotchas

**★ `when(spy.foo())` — the whole of this page.**
The real `foo()` runs before Mockito is told anything, with its real side effects. Use
`doReturn(...).when(spy).foo()`. Mockito's own javadoc says *"always"*.

**★ Assuming it is safe because the method "just returns a field".**
Today it does. The point of a spy is that the body is real code you do not control from the test,
and the next commit can add a lazy-load, a cache write or a metric to it. The `do…` form is
immune to that change; the `when` form silently starts doing it.

**★ `doReturn` with a value of the wrong type.**
It compiles, because the parameter is `Object`. It fails at run time with *"X cannot be returned
by method()"*. This is the price of the safe form and there is no way to buy both.

**★ Reading `wrongTypeOfReturnValue` as proof you used `doReturn` wrongly.**
Its reason 2 is *"A spy is stubbed using when(spy.foo()).then() syntax"* — the same message
covers the opposite mistake. Check which form you actually used before "fixing" it.

**★ Stubbing a spy inside `when()` and then wondering where the extra invocation came from.**
The stubbing line really did invoke the method on the spy. Under `verifyNoMoreInteractions` or
`times(n)` the count includes it, and under `STRICT_STUBS` it can be the invocation reported in a
mismatch.

**★ Using `doNothing()` on a plain mock.**
Void methods on a mock already do nothing; the line is noise. It earns its place only on a spy or
a `CALLS_REAL_METHODS` partial mock, which is exactly how §13 uses it.

**★ `doCallRealMethod()` on an abstract method.**
Throws *"Cannot call abstract real method on java object!"*. The default answer would have
returned a type default for the same call without complaint.

**★ `reset(spy)` between phases of a test.**
It clears the stubbings and the invocation record and leaves the real field state exactly as the
previous phase left it. §17 calls `reset()` in the middle of a test method a code smell in
general; on a spy it is also incomplete.

**★ Mixing `when` and `doReturn` on the same spy in one class.**
A reader has to check each line for whether it executed anything. Pick `do…` for the whole class
once a spy is involved, and let [03h](03h-choosing-a-stubbing-vocabulary.md)'s argument about
house style apply to the rest of the suite.

**★ Assuming BDD aliases change the mechanism.**
`given(spy.foo()).willReturn(x)` is `when(...)` with a different name and evaluates its argument
identically. The safe BDD form is `willReturn(x).given(spy).foo()`.

## Interview questions

**★ Why does `when(spy.getBalance()).thenReturn(TEN)` call the real `getBalance()`?**
Because `when` is a normal method whose parameter is the *value* of the call, and Java evaluates
arguments before invoking a method. `spy.getBalance()` is therefore executed first; only
afterwards does `when` consult the thread-local record of that invocation to build the stubbing.
On a plain mock the executed method is an empty generated one, so nothing happens; on a spy it is
the real body, with real side effects.

**★ What is the fix, and what does it cost?**
`doReturn(TEN).when(spy).getBalance()`. `when(spy)` puts the spy into stubbing mode *first*, so
the subsequent `getBalance()` is recorded rather than executed. The cost is type safety:
`doReturn` takes `Object`, so a wrong-typed value compiles and fails at run time with
`wrongTypeOfReturnValue`. Mockito accepts that trade for spies explicitly — *"for spies it is
recommended to always use doReturn|Answer|Throw()|CallRealMethod"*.

**★ Your spy-based test passes but a row appears in the database. Where would you look?**
At the stubbing lines. `when(spy.save(order)).thenReturn(saved)` executes `save` for real before
it stubs anything, so the setup line performs the insert the test was written to avoid. Convert
every stubbing on the spy to the `do…` form and the row disappears.

**★ Does strict stubbing behave differently for spies?**
The rules are the same, because a spy is a mock. What differs is the input: `when`-style stubbing
on a spy creates a genuine invocation on that spy at setup time, so the invocation record
contains a call production code never made. That extra call can be the one reported in a
`PotentialStubbingProblem`, and it counts towards `times(n)` and `verifyNoMoreInteractions`. The
`do…` form creates no such invocation.

**★ When is `doCallRealMethod()` useful on a spy, given real is already the default?**
Two cases. To restore real behaviour for part of a consecutive stubbing —
`doReturn(cached).doCallRealMethod().when(spy).load(key)` — and to make a *plain* mock run one
real method without giving it `CALLS_REAL_METHODS` wholesale. Its javadoc still points you back
at `spy()` as the safer route, because a plain mock's object was never constructed.

**★ Is `reset(spy)` a way to reuse a spy between test phases?**
Not really. It clears Mockito's stubbings and invocation record — §17: *"at this point the mock
forgot any interactions and stubbing"* — but the object's own fields are real state that every
real method has been mutating, and `reset` does not restore them. Build a fresh spy from a fresh
instance. §17's broader advice is that needing `reset` at all usually means the test is doing
too much.

**★ Why does `doNothing()` exist if void methods already do nothing?**
Because on a spy or a `CALLS_REAL_METHODS` partial mock they do not — the real void body runs.
`doNothing().when(spy).clear()` is the documented way to silence a real side effect, and it is
one of the two worked examples in §13. On a plain mock the call is redundant.

{/* FOOTER */}
