---
title: "any() and eq() do not return matchers — they push a matcher onto a thread-local stack and hand back a dummy value, and once you know that, every rule about mixing matchers with raw values, and every error that fires on the wrong line, stops being arbitrary"
sidebar_label: "04 · Argument matchers"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> section 3 (*"Argument matchers"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> the class javadoc and method bodies of
> [`ArgumentMatchers`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentMatchers.java),
> and the `invalidUseOfMatchers` / `missingMethodInvocation` messages in
> [`Reporter`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/exceptions/Reporter.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Everyone learns the rule — "if you use one matcher you must use matchers for every
argument" — and most people learn it from an error message. The rule is not a style
preference and it is not arbitrary. It falls directly out of how matchers are implemented,
and the implementation also explains the much nastier failure mode: a matcher used in the
wrong place does not fail where you wrote it. It corrupts the *next* interaction, and the
error appears somewhere else entirely. This chunk is the mechanism; the catalogue of matchers
is [04b](04b-the-matcher-catalogue.md).**

## The mechanism

Mockito states it plainly, in both section 3 and the `ArgumentMatchers` class javadoc:

> *"Matcher methods like `any()`, `eq()` **do not** return matchers. Internally, they record a
> matcher on a stack and return a dummy value (usually null). This implementation is due to
> static type safety imposed by the java compiler. The consequence is that you cannot use
> `any()`, `eq()` methods outside of verified/stubbed method."*

The source confirms it, method by method:

```java
public static <T> T any() {
    reportMatcher(Any.ANY);
    return null;
}

public static String anyString() {
    reportMatcher(new InstanceOf(String.class, "<any string>"));
    return "";
}

public static <T> T eq(T value) {
    reportMatcher(new Equals(value));
    if (value == null) return null;
    return (T) Primitives.defaultValue(value.getClass());
}
```

Each one does two unrelated things: it **pushes a matcher** onto Mockito's thread-local
matcher stack (`ThreadSafeMockingProgress`), and it **returns a placeholder** of the right
static type so that the surrounding expression compiles.

### Why it has to work this way

`verify(mock).charge(anyString())` has to type-check. `charge` takes a `String`, so whatever
sits in that position must *be* a `String` at compile time. A matcher object is not a
`String`. Java has no way to say "a value or a description of values" in one parameter slot,
so Mockito puts the description in a side channel and satisfies the compiler with a throwaway
value.

Note the return values are not all `null`. `anyString()` returns `""`, `anyList()` returns an
empty `ArrayList`, `anyInt()` returns `0`, `eq(value)` returns the *default value of the
value's class*. They are chosen to be harmless if something reads them — but they are never
what the matcher will actually match.

### What the mock does with the stack

When the method is finally invoked — `mock.charge(<placeholder>)` — Mockito's handler looks at
the thread-local stack. If it is empty, it matches the recorded arguments by `equals()`. If it
has entries, it pops them and uses them, one per argument, and clears the stack.

That single sentence explains all three rules below.

## 🔴 Rule 1: all arguments or none

```java
verify(mock).someMethod(anyInt(), anyString(), eq("third argument"));
// above is correct - eq() is also an argument matcher

verify(mock).someMethod(anyInt(), anyString(), "third argument");
// above is incorrect - exception will be thrown because third argument is given without an argument matcher.
```

> *"If you are using argument matchers, **all arguments** have to be provided by matchers."*

**Why:** the stack has two entries and the invocation has three arguments. Mockito cannot know
which two of the three the matchers were meant for — the raw `"third argument"` left no trace
anywhere. Rather than guess, it throws `InvalidUseOfMatchersException`.

The fix is `eq("third argument")`, which is a matcher like any other; it pushes an `Equals`
matcher and returns a placeholder.

**And this is why `eq()` exists at all.** It looks redundant — of course you want equality —
until you see that its job is to put an entry on the stack so the counts line up.

## 🔴 Rule 2: a matcher outside a stub or verify poisons the next interaction

This is the one that costs an afternoon.

```java
// Somewhere in a helper, or a leftover line:
String ignored = anyString();          // ← pushes a matcher, returns ""

// ...much later, an unrelated interaction:
verify(gateway).charge(order);         // ← 1 argument, 1 stale matcher on the stack
```

The matcher pushed by the first line is still there. The `verify` on the second consumes it
and matches `order` against `<any string>` — or, if the counts do not line up, throws
`InvalidUseOfMatchersException` **at the second line**, naming a call that is perfectly
correct.

Mockito's own message tries to help, and it is worth reading in full because it lists the
three real causes:

> *"Invalid use of argument matchers!"* … *"This message may appear after an
> NullPointerException if the last matcher is returning an object like any() but the stubbed
> method signature expect a primitive argument, in this case, use primitive alternatives.*
> *`when(mock.get(any())); // bad use, will raise NPE`*
> *`when(mock.get(anyInt())); // correct usage use`"*
>
> *"Also, this error might show up because you use argument matchers with methods that cannot
> be mocked. Following methods **cannot** be stubbed/verified:
> final/private/equals()/hashCode()."*

Three distinct causes with one message:

1. **Counts mismatched** — some arguments are raw values.
2. **A matcher returning `null` fed into a primitive parameter** — auto-unboxing NPEs before
   Mockito ever sees the call, and the stale matcher then surfaces at the *next* interaction.
3. **A matcher used on a method Mockito cannot intercept** — `equals`, `hashCode`, `final`,
   `private`. The call runs for real, the matcher stays on the stack, and the next interaction
   pays for it.

**The practical consequence:** when you get `InvalidUseOfMatchersException`, the line it names
is frequently *not* the line with the bug. Look at the interaction *before* it.

### Where the stale matcher usually comes from

- A matcher extracted into a variable or a helper method:
  `private String anyOrderId() { return anyString(); }` called outside a `verify`.
- A matcher inside an `assertThat(...)` or a log statement.
- A matcher passed to a method on a **final** or **private** method of the mock — the
  interception never happened.
- A matcher used on a real object by mistake.
- 🔴 A matcher inside the argument list of a *stubbing that threw* — the exception unwound
  before Mockito consumed the stack.

## 🔴 Rule 3: it is thread-local, so it is per-test-thread

`ThreadSafeMockingProgress` is the class name, and thread-local is how the thread safety is
achieved: each thread has its own matcher stack and its own ongoing-stubbing slot. Two
consequences:

- **Parallel tests do not corrupt each other's matchers** — the stack is not shared.
- **A stubbing or verification issued from a different thread than the one that set up the
  matchers will not see them.** Stubbing inside an executor, a `CompletableFuture` callback,
  or a parallel stream is a different matcher stack. This is a real hazard with
  `@Execution(CONCURRENT)` at method level in JUnit — see
  **01 · JUnit 5 · Parallel execution** *(not written yet)*.

🔴 One more rule falls out of the same design and is common enough to have its own chunk:
**`any()` matches `null` and `anyString()` does not.** That, and every other matcher in the
library, is [04b · The matcher catalogue](04b-the-matcher-catalogue.md).

## When not to use a matcher at all

Mockito's advice, verbatim from section 3:

> *"Be reasonable with using complicated argument matching. The natural matching style using
> `equals()` with occasional `anyX()` matchers tend to give clean and simple tests. Sometimes
> it's just better to refactor the code to allow `equals()` matching or even implement
> `equals()` method to help out with testing."*

That last clause is worth taking literally. A domain type with a proper `equals` — a `record`
gets one for free — turns `argThat(o -> o.id().equals(ID) && o.total().equals(TOTAL))` into
`eq(expectedOrder)`, with a failure message that shows both objects instead of "argument
matcher did not match".

**A matcher is a claim about what you do *not* care about.** `any()` on the third parameter
says "this test does not depend on that value". If the test *does* depend on it, use `eq` — or
better, capture it and assert on it: [06 · Argument captors](06-argument-captors.md).

## Gotchas

**★ Mixing a raw value with a matcher in one call.**
`verify(mock).someMethod(anyInt(), "x")` throws `InvalidUseOfMatchersException` because the
stack has one entry and the invocation has two arguments. Wrap the raw value: `eq("x")`.

**★ Reading the exception's line number as the location of the bug.**
The stale matcher was pushed by an *earlier* statement. The interaction that reports the error
is often correct. Look backwards for a matcher outside a `when`/`verify`.

**★ Extracting a matcher into a helper method or a constant.**
`private static final String ANY_ID = anyString();` pushes a matcher at class-initialisation
time, long before any test runs. So does a helper called from anywhere except inside the
stubbed/verified call. Matchers are statements, not values.

**★ `any()` on a primitive parameter.**
`any()` returns `null`, which auto-unboxes to an NPE at the call site before Mockito sees
anything. The javadoc's own fix: *"in this case, use primitive alternatives"* — `anyInt()`,
`anyBoolean()`, and so on.

**★ A matcher on `equals()`, `hashCode()`, a `final` method or a `private` method.**
Those calls are never intercepted, so the matcher stays on the stack and detonates on the next
interaction. The error text lists this cause explicitly, which is the only clue you get.

**★ A stubbing that throws with matchers half-consumed.**
If the stubbing expression itself throws — a previously stubbed exception, or an NPE from a
primitive placeholder — the matchers pushed so far are never consumed. The next interaction
inherits them.

**★ Stubbing from a different thread than the one running the assertions.**
The matcher stack and the ongoing stubbing live in a `ThreadLocal`. Setting up a stubbing
inside an executor task and verifying on the test thread does not work, and the symptom is a
missing stub rather than an error.

**★ Reaching for `argThat` when the type just needs an `equals`.**
Mockito's own advice: *"Sometimes it's just better to refactor the code to allow `equals()`
matching or even implement `equals()` method to help out with testing."* A `record` argument
gives you `eq(expected)` and a readable failure for free.

**★ Using `any()` for a value the test actually depends on.**
A matcher is a declaration that the argument does not matter. If the test's whole point is
that the right order id was passed, `any()` deletes the assertion while leaving the test green.

## Interview questions

**★ Why must you use matchers for every argument once you use one?**
Because matchers are not values. Each matcher call pushes an entry onto a thread-local stack
and returns a dummy placeholder; the raw value leaves no entry. When the invocation arrives,
Mockito sees *n* arguments and *m* stack entries, and with `m < n` it cannot tell which
arguments the matchers were for. It refuses to guess and throws
`InvalidUseOfMatchersException`. Wrapping the raw value in `eq(...)` makes the counts line up.

**★ What does `anyString()` actually return?**
The empty string. `any()` returns `null`, `anyInt()` returns `0`, `anyList()` returns an empty
`ArrayList`, and `eq(v)` returns the default value of `v`'s class. The return value exists only
to satisfy the compiler; the real work is the matcher pushed onto the thread-local stack. The
javadoc says so: *"they record a matcher on a stack and return a dummy value (usually null)"*.

**★ You get `InvalidUseOfMatchersException` on a line that looks perfectly correct. What is
going on?**
A matcher was pushed somewhere it was never consumed — in a helper method, a field
initialiser, an assertion, or a call on a `final`/`private`/`equals`/`hashCode` method that
Mockito could not intercept — and it is still on the stack when your line runs. The reported
line is the victim, not the culprit. Look at the statements before it.

**★ Why is `any()` dangerous on a primitive parameter?**
`any()` returns `null`. Passing it where an `int` is expected forces auto-unboxing, which
throws `NullPointerException` before the mock is ever invoked — and leaves the matcher on the
stack to break the next interaction too. Mockito's own error text names this case and points at
`anyInt()`.

**★ Why does `eq()` exist when Mockito already compares with `equals()` by default?**
Because the all-or-nothing rule counts stack entries. Once any argument in a call uses a
matcher, every argument must push one, and `eq(value)` is how a plain value does that. It is
not about equality semantics — the default comparison is already `equals()`.

**★ Is the matcher stack shared between threads?**
No — it lives in a `ThreadLocal` (`ThreadSafeMockingProgress`), which is what makes parallel
test execution safe. The flip side is that a stubbing or verification issued on a different
thread from where the matchers were created will not see them, so setting up mocks inside an
executor or a parallel stream does not work.

**★ When should you not use a matcher?**
When the value matters. A matcher declares that the test does not depend on the argument, so
`any()` on something the test is really about silently removes an assertion. Mockito's own
advice is to prefer natural `equals()` matching and, if the argument type makes that awkward,
to give it an `equals` — a `record` does it for free — rather than to write a clever
`argThat`.

{/* FOOTER */}
