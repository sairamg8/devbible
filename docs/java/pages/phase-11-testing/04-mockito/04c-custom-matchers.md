---
title: "argThat takes a lambda and gives you a boolean, which means the failure message is 'no matching invocation' and nothing about which field was wrong — so Mockito's own documentation lists five alternatives to writing one, and assertArg exists to turn the boolean back into an assertion"
sidebar_label: "04c · Custom matchers"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`ArgumentMatcher`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentMatcher.java),
> the `argThat`, `assertArg` and `charThat`/`intThat`/… javadocs in
> [`ArgumentMatchers`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentMatchers.java),
> and section 36 (*"Java 8 Lambda Matcher Support"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**`argThat(order -> order.total().equals(TOTAL))` is the obvious move when the built-in matchers
in [04b](04b-the-matcher-catalogue.md) are not specific enough. It is also the move that
produces the worst failure message in the whole library, because a matcher returns `boolean` and
a `boolean` cannot explain itself. Mockito's own documentation opens the `ArgumentMatcher`
javadoc with a list of six options and puts "write a custom matcher" fifth. This chunk is that
list, the two ways to make a custom matcher readable when you do need one, and the primitive
trap that has its own paragraph in the javadoc.**

## Six options, in Mockito's own words

The `ArgumentMatcher` class javadoc opens with this, verbatim — *"For non-trivial method
arguments used in stubbing or verification, you have the following options (in no particular
order)"*:

> - *"refactor the code so that the interactions with collaborators are easier to test with
>   mocks. Perhaps it is possible to pass a different argument to the method so that mocking is
>   easier? If stuff is hard to test it usually indicates the design could be better, so do
>   refactor for testability!"*
> - *"don't match the argument strictly, just use one of the lenient argument matchers like
>   `Mockito#notNull()`. Some times it is better to have a simple test that works than a
>   complicated test that seem to work."*
> - *"implement equals() method in the objects that are used as arguments to mocks. Mockito
>   naturally uses equals() for argument matching. Many times, this is option is clean and
>   simple."*
> - *"use `ArgumentCaptor` to capture the arguments and perform assertions on their state.
>   Useful when you need to verify the arguments. **Captor is not useful if you need argument
>   matching for stubbing.** Many times, this option leads to clean and readable tests with
>   fine-grained validation of arguments."*
> - *"use customized argument matchers by implementing `ArgumentMatcher` interface and passing
>   the implementation to the `Mockito#argThat` method. This option is useful if custom matcher
>   is needed **for stubbing** and can be reused a lot."*
> - *"use an instance of hamcrest matcher and pass it to
>   `MockitoHamcrest#argThat(org.hamcrest.Matcher)`. Useful if you already have a hamcrest
>   matcher. Reuse and win!"*

Two sentences in there decide the whole captor-versus-matcher question, and they are worth
lifting out:

- **A captor is for verification.** *"Captor is not useful if you need argument matching for
  stubbing."*
- **A custom matcher is for stubbing, and for reuse.** *"This option is useful if custom matcher
  is needed for stubbing and can be reused a lot."*

That is the rule. If you are *verifying*, capture and assert — the failure message then shows
the actual object. If you are *stubbing*, you have no choice but a matcher, because there is no
invocation to capture yet. Full argument in
[06 · Argument captors](06-argument-captors.md).

## Writing one

Three forms, from least to most readable.

**A lambda** — `ArgumentMatcher` is `@FunctionalInterface`:

```java
verify(list, times(2)).add(argThat(string -> string.length() < 5));
```

**A named class**, which is how you get a failure message:

```java
class ListOfTwoElements implements ArgumentMatcher<List> {
    public boolean matches(List list) {
        return list.size() == 2;
    }
    public String toString() {
        //printed in verification errors
        return "[list of 2 elements]";
    }
}

List mock = mock(List.class);

when(mock.addAll(argThat(new ListOfTwoElements()))).thenReturn(true);

mock.addAll(Arrays.asList("one", "two"));

verify(mock).addAll(argThat(new ListOfTwoElements()));
```

> *"Implementations of this interface can be used with `ArgumentMatchers#argThat` method. Use
> `toString()` method for description of the matcher - it is printed in verification errors."*

🔴 **That `toString()` is not decoration — it is the only thing standing between you and a
failure message that says nothing.** A lambda has a synthetic `toString`, so a failed
verification with a lambda matcher reports the lambda's class name. A named matcher reports
`[list of 2 elements]`.

**Extracted to a factory method**, which is what the javadoc recommends for readability:

```java
verify(mock).addAll(argThat(new ListOfTwoElements()));
//becomes
verify(mock).addAll(listOfTwoElements());
```

⚠️ Note what `listOfTwoElements()` must be: a method that *calls* `argThat(...)` and returns its
placeholder. It cannot be a method that returns the matcher, because — per
[04 · Argument matchers](04-argument-matchers.md) — `argThat` is what pushes onto the stack, and
it has to happen inside the verified call.

### One rule for `matches`

> *"The method should **never** assert if the argument doesn't match. It should only return
> false."*

A matcher that throws instead of returning `false` breaks Mockito's matching loop — it is called
against *every* recorded invocation while Mockito looks for one that fits, including invocations
of other methods with other argument types. An assertion inside `matches` will fire on an
unrelated invocation and report a failure that has nothing to do with your test.

`assertArg` is the sanctioned way to have it both ways; see below.

## `assertArg` — assertions inside a matcher, deliberately

```java
public static <T> T assertArg(Consumer<T> consumer) {
    return argThat(
            argument -> {
                consumer.accept(argument);
                return true;
            });
}
```

> *"Allows creating custom argument matchers where matching is considered successful when the
> consumer given by parameter does not throw an exception. Typically used with
> `Mockito#verify(Object)` to execute assertions on parameters passed to the verified method
> invocation."*

```java
verify(publisher).publish(assertArg(event -> {
    assertThat(event.orderId()).isEqualTo(ORDER_ID);
    assertThat(event.status()).isEqualTo(CONFIRMED);
}));
```

This is the answer to the "matchers have terrible failure messages" problem in the verification
case: the AssertJ failure propagates with its own message instead of being flattened to `false`.
There is also a `ThrowingConsumer` overload — *"Consumer is allowed to throw exception other
than RuntimeException"* — so a consumer that calls something declaring a checked exception still
compiles.

🔴 **`assertArg` always returns `true`**, which has a consequence the javadoc does not spell out:
it matches *every* invocation of that method. With `verify(mock).publish(assertArg(...))` on a
mock that received two `publish` calls, the assertions run against invocations that were never
meant to satisfy them, and `verify` still demands exactly one match. Use it where there is one
call, or combine it with a count. For several calls, a captor's `getAllValues()` is cleaner —
[06 · Argument captors](06-argument-captors.md).

⚠️ And do not use `assertArg` for *stubbing*. It returns `true` for everything, so as a stubbing
matcher it is `any()` with side effects — assertions running during the exercise phase, from
inside the code under test's call stack.

## 🔴 The primitive auto-unboxing trap

`argThat` returns `null`. Feed it into an `int` parameter and Java unboxes `null`.

> *"**NullPointerException** auto-unboxing caveat. In rare cases when matching primitive
> parameter types you ***must*** use relevant intThat(), floatThat(), etc. method. This way you
> will avoid `NullPointerException` during auto-unboxing. Due to how java works we don't really
> have a clean way of detecting this scenario and protecting the user from this problem.
> Hopefully, the javadoc describes the problem and solution well."*

The typed alternatives, each returning a primitive rather than `null`:

| Method | For parameter type |
|---|---|
| `charThat(ArgumentMatcher<Character>)` | `char` |
| `booleanThat(ArgumentMatcher<Boolean>)` | `boolean` |
| `byteThat(ArgumentMatcher<Byte>)` | `byte` |
| `shortThat(ArgumentMatcher<Short>)` | `short` |
| `intThat(ArgumentMatcher<Integer>)` | `int` |
| `longThat(ArgumentMatcher<Long>)` | `long` |
| `floatThat(ArgumentMatcher<Float>)` | `float` |
| `doubleThat(ArgumentMatcher<Double>)` | `double` |

And remember from [04](04-argument-matchers.md) that the NPE is only half the damage: the
matcher `argThat` pushed is still on the thread-local stack when the exception unwinds, so the
*next* interaction in the test gets an `InvalidUseOfMatchersException` too.

Combining matchers logically — and reusing a Hamcrest matcher you already have — is
[04d · AdditionalMatchers and Hamcrest](04d-additional-matchers.md).

## Gotchas

**★ A lambda matcher in a verification that fails.**
The message names the lambda's synthetic class, not what it was checking. Either give the
matcher a class with a `toString()` — *"it is printed in verification errors"* — or stop
matching and start capturing.

**★ An assertion inside `ArgumentMatcher.matches`.**
The javadoc: *"The method should **never** assert if the argument doesn't match. It should only
return false."* Mockito calls `matches` against every recorded invocation while searching, so an
assertion fires on unrelated calls. `assertArg` is the supported way to assert.

**★ `argThat` on a primitive parameter.**
It returns `null`, which unboxes to an NPE before the mock is invoked — and leaves the matcher on
the stack to poison the next interaction. Use `intThat`, `longThat`, `doubleThat` and friends.

**★ A helper method that *returns* a matcher instead of calling `argThat`.**
`ArgumentMatcher<Order> validOrder() { return o -> …; }` used as
`verify(m).save(validOrder())` does not compile, and if you make it compile by casting you have
pushed nothing onto the stack. The helper has to be
`Order validOrder() { return argThat(o -> …); }` and has to be called inside the verified
invocation.

**★ `assertArg` used for stubbing.**
It returns `true` unconditionally, so as a stubbing matcher it matches everything — `any()` with
assertions that run inside the code under test's call stack, at exercise time rather than at
verification time.

**★ `assertArg` against a method that was called more than once.**
The consumer runs for every recorded invocation Mockito examines, so assertions fire on calls
that were never the target. Prefer a captor and `getAllValues()` when there are several calls.

**★ A custom matcher with side effects or state.**
`matches` is called an unspecified number of times, against invocations you did not intend, in
an order you do not control. A counter inside a matcher counts something other than what you
think.

**★ Writing a custom matcher when the type could just have an `equals`.**
Mockito's own list puts *"implement equals() method in the objects that are used as arguments to
mocks"* above writing a matcher, and calls it *"clean and simple"*. A `record` argument gives you
`eq(expected)` and a diff-style failure message for free.

**★ Writing a custom matcher for a one-off verification.**
The javadoc's condition for the matcher option is that it *"can be reused a lot"*. For a single
verification, a captor gives a better message with less code.

## Interview questions

**★ When is a custom matcher the right tool, and when is a captor?**
Mockito's own documentation splits them: a captor is *"Useful when you need to verify the
arguments"* but *"not useful if you need argument matching for stubbing"*; a custom matcher is
*"useful if custom matcher is needed for stubbing and can be reused a lot"*. So — stubbing must
use a matcher because there is no invocation to capture yet; verification should prefer a captor
because the assertion then produces a real failure message.

**★ Why does a failed verification with `argThat(o -> o.total() > 100)` tell you so little?**
Because a matcher returns `boolean`. Mockito knows only that nothing matched, so it reports the
matcher's `toString()` — which for a lambda is a synthetic class name — and the invocations it
saw. A named `ArgumentMatcher` with a meaningful `toString()` fixes the description; a captor
fixes the whole problem by letting an assertion library do the comparison.

**★ Why must `ArgumentMatcher.matches` never assert?**
Because Mockito calls it while scanning recorded invocations for a match, including invocations
of other methods and of other tests' arguments in the same mock. An assertion inside it fires on
calls that were never candidates and produces a failure unrelated to the test's intent. The
javadoc states the rule outright: *"It should only return false."*

**★ What is `assertArg` for?**
It wraps a `Consumer` in a matcher that returns `true` unless the consumer throws — so AssertJ or
JUnit assertions inside it propagate with their own messages instead of collapsing to `false`. It
is designed for `verify`, and it is wrong for stubbing, because it matches every invocation.

**★ Why does `argThat` blow up on an `int` parameter?**
It returns `null`, and Java auto-unboxes `null` to a `NullPointerException` at the call site,
before Mockito is ever invoked. The javadoc says you *"must use relevant intThat(), floatThat(),
etc. method"*, which return primitives. As a bonus problem, the NPE unwinds with the matcher
still on the thread-local stack, so the next interaction fails too.

**★ Your reviewer says "this custom matcher should be an `equals`". Are they right?**
Usually yes, if the argument is a domain value type. Mockito matches by `equals` naturally, so a
proper `equals` — free on a `record` — turns the whole matcher into `eq(expected)`, gives a
failure message showing both objects, and works for stubbing and verification alike. The matcher
stays justified when the check is genuinely partial ("any order over £100") rather than an
equality you were avoiding writing.

{/* FOOTER */}
