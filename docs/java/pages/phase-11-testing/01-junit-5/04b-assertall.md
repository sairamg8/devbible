---
title: "assertAll executes every supplied executable even after one has thrown, aggregates the failures into a MultipleFailuresError and attaches them as suppressed exceptions — which turns five build cycles into one, and has exactly one exception to the rule"
sidebar_label: "04b · assertAll"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Assertions"
> ([assertions](https://docs.junit.org/6.0.3/writing-tests/assertions.html)); the
> `Assertions.assertAll(String, Stream)` javadoc, which carries the exception-handling
> contract for the whole family
> ([Assertions](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Assertions.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Sequential assertions stop at the first failure. If a response object has six fields and
three are wrong, you learn about one per run, and each run is a full build. `assertAll`
exists to collapse that into a single report — and its contract is precisely specified,
including what happens when one of the executables throws something that is not an
assertion failure at all.**

## The mechanism

```java
@Test
void mapsTheOrderToItsResponse() {
    OrderResponse response = mapper.toResponse(order);

    assertAll("order response",
        () -> assertEquals("A-1", response.id()),
        () -> assertEquals(Money.of("42.00"), response.total()),
        () -> assertEquals(Status.PLACED, response.status()),
        () -> assertEquals(3, response.lineCount())
    );
}
```

The javadoc's contract, verbatim:

> *"Assert that all supplied `executables` do not throw exceptions. If any supplied
> `Executable` throws an exception (i.e., a `Throwable` or any subclass thereof), all
> remaining executables will still be executed, and all exceptions will be aggregated and
> reported in a `MultipleFailuresError`. In addition, all aggregated exceptions will be
> added as suppressed exceptions to the `MultipleFailuresError`. The supplied `heading`
> will be included in the message string for the `MultipleFailuresError`."*

Three things in that paragraph are load-bearing:

- **"a `Throwable` or any subclass thereof"** — not just `AssertionError`. A
  `NullPointerException` inside the third lambda is caught, aggregated, and reported
  alongside the assertion failures. `assertAll` is a *fault barrier*, not merely an
  assertion aggregator.
- **"added as suppressed exceptions"** — so the stack trace of each individual failure
  survives. IDEs and CI reporters that walk `getSuppressed()` show you every one.
- **the heading** — `assertAll("order response", …)` puts a label on the aggregate. On a
  test with two `assertAll` blocks it is the only thing distinguishing them in the report.

## 🔴 The one exception to "all remaining executables will still be executed"

> *"However, if one of the executables throws an **unrecoverable** exception — for example,
> an `OutOfMemoryError` — execution will halt immediately, and the unrecoverable exception
> will be rethrown as is but masked as an unchecked exception."*

`assertAll` does not swallow `OutOfMemoryError` in order to keep asserting. That is
correct — continuing after the heap is gone produces noise, not information — and it is
worth knowing because it means a test that dies inside `assertAll` with a single
unrecoverable error is telling you the truth about what happened, not hiding four other
failures behind it.

## Nesting, and the dependent-assertion pattern

The guide's own example shows the pattern that makes `assertAll` genuinely useful rather
than merely tidy:

```java
assertAll("properties",
    () -> {
        String firstName = person.getFirstName();
        assertNotNull(firstName);

        // Executed only if the previous assertion is valid.
        assertAll("first name",
            () -> assertTrue(firstName.startsWith("J")),
            () -> assertTrue(firstName.endsWith("e"))
        );
    },
    () -> {
        String lastName = person.getLastName();
        assertNotNull(lastName);

        assertAll("last name",
            () -> assertTrue(lastName.startsWith("D")),
            () -> assertTrue(lastName.endsWith("e"))
        );
    }
);
```

The guide's comment on this is the rule:

> *"Within a code block, if an assertion fails the subsequent code in the same block will
> be skipped."*

So the structure encodes the dependency. Inside one lambda, assertions are sequential and
short-circuit — you do not check `startsWith` on a `null` name. Across lambdas, they are
independent — a broken first name does not hide a broken last name. **`assertAll` groups
what is independent; a block groups what is dependent.** That is the whole design.

## The other overloads

Six of them, and two are worth knowing beyond the varargs form:

```java
assertAll(Collection<Executable> executables)
assertAll(String heading, Collection<Executable> executables)
assertAll(Stream<Executable> executables)
assertAll(String heading, Stream<Executable> executables)
```

The `Stream` form lets you assert over a generated set of cases:

```java
assertAll("every line is priced",
    order.lines().stream()
        .map(line -> () -> assertNotNull(line.unitPrice(), () -> "line " + line.sku())));
```

⚠️ **That is not a substitute for `@ParameterizedTest`.** The stream form produces one
test node with many aggregated failures; a parameterized test produces one node per case,
each individually named, re-runnable and visible in the report. Use the stream form when
the cases are properties of *one* object; use **topic 03 · parameterized tests** *(not
written yet)* when they are separate scenarios.

## What `assertAll` is not

**It is not a substitute for splitting a test.** Four assertions about four unrelated
behaviours grouped in an `assertAll` is still four tests wearing one name. The question is
whether the assertions describe one claim from several angles — the shape of a mapped
response, the fields of a parsed record — or several independent claims.

**It is not soft assertions as AssertJ means them.** AssertJ's `SoftAssertions` collects
across a whole method with no lambda-per-assertion ceremony, and AssertJ's
`assertThat(response).satisfies(…)` and `extracting(…)` express object-shape assertions
more directly. That comparison belongs to **topic 02 · AssertJ** *(not written yet)*; this
page's job is that you know what the Jupiter primitive guarantees.

## Gotchas

**★ Reaching for `assertAll` to make an over-broad test pass more informatively.**
Aggregating four unrelated failures produces a report that says four things broke and does
not say the test is testing four things. Split it first; group what is left.

**★ Assuming only `AssertionError` is aggregated.**
The javadoc says *"a `Throwable` or any subclass thereof"*. An NPE in one lambda is caught
and reported with the assertion failures — which is usually what you want, and is
occasionally confusing when a genuine bug shows up in the middle of an assertion list.

**★ Forgetting the heading.**
With two `assertAll` blocks in one test, an unlabelled `MultipleFailuresError` gives you no
clue which group failed. The heading is one string literal and it is the difference.

**★ Putting dependent assertions in sibling lambdas.**
`() -> assertNotNull(name)` and `() -> assertTrue(name.startsWith("J"))` as siblings means
the second runs even when the first failed — and you get an NPE aggregated next to the real
failure. Dependent assertions go in the *same* lambda; the guide's example is explicit
about this.

**★ Expecting `assertAll` to keep going after an `OutOfMemoryError`.**
It halts and rethrows. The javadoc calls that class of exception "unrecoverable" and makes
an explicit exception to the aggregation rule.

**★ Using `assertAll` with side-effecting lambdas.**
Each executable runs, including after an earlier one failed. If lambda two mutates state
that lambda three reads, you have written an ordered program inside an unordered construct.

**★ Wrapping the *act* step inside `assertAll`.**
`assertAll(() -> { Response r = call(); assertEquals(…, r.id()); }, …)` calls the system
under test inside the aggregation, sometimes more than once. Act first, assign to a local,
then assert.

**★ Reaching for the `Stream` overload when you wanted parameterized tests.**
One aggregated node instead of N named nodes: no per-case re-run, no per-case display
name, no per-case skip. If each element is a scenario rather than a property, it is a
`@ParameterizedTest`.

**★ Assuming a `MultipleFailuresError` prints every cause in every tool.**
The individual failures are attached as *suppressed* exceptions. Well-behaved reporters
walk them; a naive `printStackTrace` in a custom listener may not. If your CI shows one
failure where you expect four, that is where to look.

## Interview questions

**★ What does `assertAll` guarantee?**
That every supplied `Executable` is executed even if an earlier one throws, and that all
thrown exceptions — any `Throwable`, not only `AssertionError` — are aggregated into a
`MultipleFailuresError` with each one attached as a suppressed exception. The optional
heading goes into that error's message.

**★ Is there anything that stops it mid-way?**
Yes. An unrecoverable exception such as `OutOfMemoryError` halts execution immediately and
is rethrown as-is, masked as unchecked. Nothing else short-circuits the group.

**★ How do you express "check this only if that passed" inside an `assertAll`?**
Put both assertions in the *same* lambda. Within one block, assertions are ordinary
sequential code and the first failure skips the rest of that block; separate lambdas are
independent by construction. The guide's nested example is built exactly this way.

**★ When is `assertAll` the wrong tool?**
When the assertions are about different behaviours rather than different aspects of one
result — that is a test doing too much — and when each item is a distinct input scenario,
which is what `@ParameterizedTest` is for.

**★ How does `assertAll` compare with AssertJ soft assertions?**
Both report multiple failures from one test. `assertAll` requires a lambda per assertion
and produces a `MultipleFailuresError`; AssertJ's `SoftAssertions` collects plain fluent
assertions and reports on close, and AssertJ additionally has object-shape assertions that
often remove the need for grouping altogether. The Jupiter primitive is what you get with
no extra dependency.

**★ Why does `assertAll` catch `Throwable` rather than only `AssertionError`?**
Because an executable is arbitrary code, and a bug in the code under test is exactly as
interesting as a failed expectation. Catching only `AssertionError` would let an NPE in
one lambda abort the group and hide the remaining failures — the problem `assertAll` was
built to solve.

{/* FOOTER */}
