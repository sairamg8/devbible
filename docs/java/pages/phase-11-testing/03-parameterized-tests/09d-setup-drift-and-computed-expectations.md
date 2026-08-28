---
title: "A column of lambdas and an expected value the test computes for itself are the last two ways a table stops being a table, and both arrive disguised as tidy deduplication"
sidebar_label: "09d · Setup drift and computed expectations"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Parameterized Classes and Tests",
> "Customizing Display Names" and "`@EnumSource`"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)).
> The documented behaviour quoted here is JUnit's; the design argument built on it is a review
> standard, not a rule the framework enforces.
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**Two shapes remain, and they are the two that look most like good engineering while they are
being written: the row that needs its own arrangement, which arrives as a column of lambdas, and
the row whose expected value the test works out for itself, which arrives as one less column to
maintain. Both are deduplication that removed the wrong duplicate.**

## Case (f) — one row needs different setup

```java
static Stream<Arguments> cases() {
    return Stream.of(
        arguments("plain user",  (Consumer<Fixture>) f -> f.withRole(USER),                    403),
        arguments("admin",       (Consumer<Fixture>) f -> f.withRole(ADMIN).withFeature(REPORTS), 200),
        arguments("locked out",  (Consumer<Fixture>) f -> f.withRole(ADMIN).lock(),            423)
    );
}

@ParameterizedTest(name = "{0}")
@MethodSource("cases")
void reportsEndpoint(String label, Consumer<Fixture> arrange, int expectedStatus) {
    Fixture fixture = new Fixture();
    arrange.accept(fixture);
    assertThat(fixture.get("/reports").status()).isEqualTo(expectedStatus);
}
```

**The symptom in the diff.** A column whose type is `Consumer`, `Runnable`, `Supplier` or
`Function`. Or, in the version that does not need `@MethodSource`, four lines of arrangement at the
top of the method wrapped in `if (scenario == …)`.

**Why it hurts.** A lambda column is *code in the data*, and it is the most complete form of the
disease in this topic: the arrangement, which is half of what each test means, is now inside an
object whose `toString` is something like a synthetic lambda name. The report shows `[2] admin`
and nothing about what "admin" arranged. Nobody can diff the three scenarios, because they are
three closures. And the three rows do not share a path through the method body in any meaningful
sense — the body is a two-line interpreter for whatever the column decided.

There is also a practical trap behind it. `@BeforeEach` on a `@ParameterizedTest` **cannot see the
invocation's arguments**, which is exactly why the arrangement got pushed into a column: there was
nowhere else uniform to put it. The lambda column is the workaround for a missing hook, not a
design.

**The rewrite.** Three tests, because there are three scenarios:

```java
@Test
void aPlainUserIsForbidden() {
    Fixture fixture = aFixture().withRole(USER).build();
    assertThat(fixture.get("/reports").status()).isEqualTo(403);
}

@Test
void anAdminWithTheFeatureEnabledGetsTheReport() {
    Fixture fixture = aFixture().withRole(ADMIN).withFeature(REPORTS).build();
    assertThat(fixture.get("/reports").status()).isEqualTo(200);
}

@Test
void aLockedAdminIsRefusedEvenWithTheRole() {
    Fixture fixture = aFixture().withRole(ADMIN).lock().build();
    assertThat(fixture.get("/reports").status()).isEqualTo(423);
}
```

More lines, and every one of them says something. The names now carry the scenarios, the
arrangement is visible next to its assertion, and a red test names the case without anyone opening
the file.

⚠️ **The legitimate version of "setup varies with the argument"** is
`@ParameterizedClass`: its lifecycle hooks *do* run per invocation and *do* see the injected
arguments ([08f](08f-parameterized-class-lifecycle.md),
[08g](08g-invocation-hook-ordering.md)). That is the right tool when the same setup step is applied
to every row with a different *value* — `@BeforeEach` calling `warehouse.stock(quantity)` for the
row's quantity. It is still the wrong tool when each row wants a *different* setup step.

## Case (g) — the expected value the test computes for itself

```java
@ParameterizedTest
@ValueSource(ints = { 0, 1, 99, 100, 12_345 })
void formatsCents(int cents) {
    String expected = (cents / 100) + "." + String.format("%02d", cents % 100);
    assertThat(Money.ofCents(cents).toString()).isEqualTo(expected);
}
```

**The symptom in the diff.** The right-hand side of the assertion is an *expression* containing the
parameter. The table has one column because the second column got replaced by arithmetic.

**Why it hurts.** This is [09c](09c-the-source-that-grew-logic.md)'s computed-expectation defect,
moved from the factory into the body, and it is more common there because it looks like tidy
deduplication. The test now contains a second implementation of `Money.toString()`. Every
assumption the production version makes, the test makes too: that cents are non-negative (try
`-5`), that the fraction is always two digits, that the decimal separator is a `.` regardless of
locale. A bug in any of those is invisible, because both sides are wrong together.

It is also the reason the table looks thin. Five inputs and no expectations means nobody ever had
to sit down and decide what `-5` should render as — and that decision is the test.

**The rewrite.** Write the answers down.

```java
@ParameterizedTest(name = "{0} cents renders as {1}")
@CsvSource({
    "0,      '0.00'",
    "1,      '0.01'",
    "99,     '0.99'",
    "100,    '1.00'",
    "12345,  '123.45'",
    "-5,     '-0.05'",      // nobody had decided this until the column existed
    "-100,   '-1.00'"
})
void formatsCents(int cents, String expected) {
    assertThat(Money.ofCents(cents).toString()).isEqualTo(expected);
}
```

Two rows longer, and the two new rows are the ones that find bugs. Writing the expected column by
hand is what forced the negative cases into existence — which is the strongest practical argument
in this whole chunk.

🔴 **A test that can derive its expectation from its input is asserting that the code agrees with
itself.** The exception is an *invariant* — `parse(format(x)).equals(x)`,
`sort(sort(x)).equals(sort(x))`, "never throws" — which is true by construction rather than by
re-implementation, and is
the one form of computed assertion worth having.

## Where this goes next

That is the last of the six shapes. The other half of the argument — the cases where a long table
is not a smell but the best test in the file, and the four questions that tell you which one you
are looking at — is [09e](09e-when-a-big-table-is-right.md).

## Gotchas

**★ A column whose type is `Consumer`, `Runnable`, `Supplier` or `Function`.** That is arrangement
smuggled into data. It does not render usefully in the report, it cannot be diffed, and the method
body has become an interpreter for it.

**★ Arrangement guarded by `if (scenario == …)` at the top of a parameterized method.** Same defect
without the lambda. Each guarded block is a different test that has not been given a name.

**★ Expecting `@BeforeEach` to see a `@ParameterizedTest`'s arguments.** It cannot, which is why
per-row setup ends up in a column or in a branch. If the setup genuinely varies per row, that is
what `@ParameterizedClass` and its per-invocation lifecycle hooks are for
([08f](08f-parameterized-class-lifecycle.md)).

**★ Using `@ParameterizedClass` to legitimise per-row *different* setup.** Its hooks see the
arguments, so the same step can use a different value per row. That is not the same as each row
performing a different step, which is still several tests.

**★ An assertion whose expected side is an expression containing the parameter.** The test has
re-implemented the code. Both copies share every assumption, so a wrong assumption is invisible.

**★ A one-column table.** Not always wrong — a boundary sweep or an invariant check is one column
by design — but if the second column got replaced by arithmetic in the body, the missing column is
the test.

**★ Deduplicating an expected value that "obviously follows from" the input.** That obviousness is
the bug. Writing `-5 → '-0.05'` by hand is what makes someone ask whether it should be `'-0.05'`
at all.

## Interview questions

**★ You see a `Consumer<Fixture>` column in a `@MethodSource`. What is wrong?**
The arrangement — half of what each case means — has been moved into the data, where the report
cannot render it and a reviewer cannot diff it. The method body is reduced to running whatever the
lambda says, so the rows do not share a meaningful path. Each row is a scenario, and scenarios want
names: three `@Test` methods whose names state what was arranged and what was expected.

**★ Why does that pattern appear so often?**
Because `@BeforeEach` on a `@ParameterizedTest` cannot see the invocation's arguments, so there is
no uniform place to put per-row setup. The lambda column is a workaround for a missing hook. When
the setup really does vary by row in a uniform way — the same step with a different value —
`@ParameterizedClass` is the supported answer, because its lifecycle hooks do see the arguments.

**★ What is wrong with computing the expected value inside the test?**
The test becomes a second implementation of the code under test, and the two share every
assumption. In the cents example, both sides assume non-negative input and a two-digit fraction, so
neither can catch the other being wrong. It also keeps the hard cases out of the file: nobody has to
decide what `-5` renders as until there is a column to write it in.

**★ Is a computed assertion ever acceptable?**
Yes, when it is an invariant rather than a re-implementation: `parse(format(x)).equals(x)`,
idempotence, "never throws", "always within bounds". Those are true by construction rather than by
copying the algorithm, so no shared assumption can make them pass wrongly. That is exactly the shape
property-based testing formalises.

{/* FOOTER */}
