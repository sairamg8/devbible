---
title: "A parameterized test is a loop over data, so the moment a column starts selecting which behaviour the test performs you have written a switch statement disguised as a table — and the failure report stops being able to say what broke"
sidebar_label: "09 · When not to parameterize"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Parameterized Classes and Tests"
> and "Customizing Display Names"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)).
> The documented behaviour quoted here is JUnit's; the design argument built on it is a review
> standard, not a rule the framework enforces.
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**The user guide's own one-line definition is the whole test for whether a table belongs:
*"Parameterized tests make it possible to run a test method multiple times with different
arguments."* Different **arguments** — not different behaviour, not different setup, not
different assertions. Every case below is a table that quietly crossed that line, and in every
one of them the price is paid at the same moment: when a row goes red and the report cannot tell
you what it was testing.**

## Why the report is the thing you are trading away

By default:

> *"the display name of a parameterized class or test invocation contains the invocation index and
> a comma-separated list of the `String` representations of all arguments for that specific
> invocation."*

That is a strong report *as long as the arguments are the case*. `[3] "user@", false` tells you
what was tried and what was expected, and a reviewer can reconstruct the intent from the failure
line alone ([07](07-display-names.md)). But the display name can only show the arguments. It
cannot show which branch of the method body ran, which `if` in the source was taken, or which of
three different setups was applied. Every time a column starts steering the *method* rather than
feeding it, some part of what the test means moves out of the report and into code the reader has
to open.

Three questions settle almost every case:

1. **Does every row take the same path through the method body?** If a row skips an assertion or
   takes a different branch, they are not the same test.
2. **Can you predict the assertion from the row alone?** If not, the row is not the case; the
   method body is.
3. **Would you delete one row and lose a *behaviour*, or lose an *example*?** Losing a behaviour
   means it was a separate test.

## Case (a) — the boolean that selects which branch of the *test* runs

```java
@ParameterizedTest
@CsvSource({
    "true,  ADMIN, true",
    "true,  USER,  false",
    "false, ADMIN, false",
    "false, USER,  false"
})
void checksAccess(boolean featureEnabled, Role role, boolean expected) {
    if (featureEnabled) {
        features.enable(ADVANCED_REPORTS);
        assertThat(service.canAccess(role, ADVANCED_REPORTS)).isEqualTo(expected);
    }
    else {
        assertThat(service.canAccess(role, ADVANCED_REPORTS)).isFalse();
        verify(auditLog).featureDisabled(ADVANCED_REPORTS);
    }
}
```

**The symptom in the diff.** A parameter is read by an `if` at the top of the method, and the two
halves assert different things. Nothing in the table says so — `false, USER, false` and
`true, USER, false` look like neighbours and are not.

**Why it hurts.** The last column is a lie for two of the four rows: when `featureEnabled` is
`false` the `expected` value is never used, and someone can change it to `true` without the suite
noticing. The report shows `[3] false, ADMIN, false` for a row that never evaluated `ADMIN` and
never consulted `expected`. And the `verify` in the second branch is invisible to anyone reading
the table.

**The rewrite.** Two tests, one table:

```java
@ParameterizedTest(name = "{0} may access advanced reports: {1}")
@CsvSource({ "ADMIN, true", "USER, false" })
void whenFeatureEnabled_accessFollowsRole(Role role, boolean expected) {
    features.enable(ADVANCED_REPORTS);
    assertThat(service.canAccess(role, ADVANCED_REPORTS)).isEqualTo(expected);
}

@ParameterizedTest(name = "{0} is refused while the feature is off")
@EnumSource(Role.class)
void whenFeatureDisabled_nobodyHasAccess(Role role) {
    assertThat(service.canAccess(role, ADVANCED_REPORTS)).isFalse();
    verify(auditLog).featureDisabled(ADVANCED_REPORTS);
}
```

The second method got *better*, not just separate: it is now `@EnumSource(Role.class)`, so it
covers every role that exists and will pick up the next one somebody adds
([05](05-enumsource.md)). The four-row table could not do that, because two of its columns were
entangled.

🔴 **The general rule: a parameter that appears in an `if` in the test body is a test name, not a
value.** Promote it to a method.

## Case (b) — the `expected` column that is really "and this one throws"

```java
@ParameterizedTest
@CsvSource({
    "10, 2, 5",
    "9,  3, 3",
    "1,  0, null"          // ← this row means "throws ArithmeticException"
})
void divides(int a, int b, String expected) {
    if ("null".equals(expected)) {
        assertThrows(ArithmeticException.class, () -> calculator.divide(a, b));
    }
    else {
        assertThat(calculator.divide(a, b)).isEqualTo(Integer.parseInt(expected));
    }
}
```

**The symptom in the diff.** The `expected` column's type widened to `String` so that one row
could carry a sentinel — `null`, `-1`, `"ERROR"`, `""`. Then a branch appeared to decode it.

**Why it hurts.** The column has stopped meaning one thing. Its type is now `String` for every
row including the eight that are integers, so a typo like `"3 "` or `"O"` becomes a parse failure
rather than a compile error. The exception type is only in the method body, so a reviewer reading
the table cannot tell *which* exception `1, 0` expects, and the failure report reads
`[3] 1, 0, null`, which does not mention exceptions at all. Worst: if `divide` starts returning
`0` instead
of throwing, the `else` branch is not the one that runs — the test fails, but only after the
reader works out that the sentinel row went the wrong way.

**The rewrite.** Success is a table; failure is a test.

```java
@ParameterizedTest(name = "{0} / {1} = {2}")
@CsvSource({ "10, 2, 5", "9, 3, 3", "-9, 3, -3" })
void divides(int a, int b, int expected) {
    assertThat(calculator.divide(a, b)).isEqualTo(expected);
}

@Test
void dividingByZeroThrows() {
    assertThatThrownBy(() -> calculator.divide(1, 0))
        .isInstanceOf(ArithmeticException.class)
        .hasMessageContaining("/ by zero");
}
```

The `expected` column went back to `int`, so the compiler checks it. And the throwing case gained
something the table could never carry: an assertion on the *message*. That is not a coincidence —
error cases have richer expectations than success cases, which is precisely why they do not fit
in a column.

⚠️ If you genuinely have *many* throwing cases, they are their own table with their own shape —
input plus expected exception type plus message fragment — not extra rows in the success table:

```java
@ParameterizedTest(name = "{0} is rejected as {1}")
@CsvSource({
    "'',            'must not be blank'",
    "'  ',          'must not be blank'",
    "'no-at-sign',  'must contain @'"
})
void rejects(String input, String messageFragment) {
    assertThatThrownBy(() -> EmailAddress.parse(input))
        .isInstanceOf(InvalidEmailException.class)
        .hasMessageContaining(messageFragment);
}
```

Every row there takes the same path. That is a legitimate table of failures — and note that it is
a *separate* method from the one testing valid addresses.

## Where this continues

Four more shapes follow. Rows whose names have to justify themselves and the table that is half
`null` are [09b](09b-when-the-table-stops-being-data.md); the argument source that grew its own
logic is [09c](09c-the-source-that-grew-logic.md); the row that needs its own setup and the
expectation the test computes for itself are
[09d](09d-setup-drift-and-computed-expectations.md). The honest counter-case — when a large table
*is* right, and the four questions that tell you so — is
[09e](09e-when-a-big-table-is-right.md).

## Gotchas

**★ A parameter used only inside an `if` in the test body.** That parameter is a test name. The
report will show its value but not the branch it selected, so a red row cannot tell you which of
the two behaviours broke.

**★ An `expected` column that is `String` when every real value is a number.** The widening
happened so one row could carry a sentinel. You have traded compile-time checking of every row for
the convenience of one, and the sentinel's meaning lives in the method body.

**★ Rows that are unreachable for some inputs.** In case (a), two of four rows never read
`expected`. Nothing fails if those cells are wrong, so they will eventually be wrong — dead data
inside a green test.

**★ Using `assertThrows` inside a parameterized test that also asserts on return values.** The two
halves are different tests sharing a signature. Splitting them lets the throwing test assert on
the message too, which the column form cannot express.

**★ Reaching for a table because two tests share three lines of setup.** Shared setup is what
`@BeforeEach`, a helper method or a builder is for (**topic 08 · test data patterns** *(not written yet)*).
Merging two behaviours into one method to avoid duplicating arrangement code trades a real cost
(an unreadable report) for a small one.

**★ Counting rows instead of paths.** Twelve rows through one code path is a good table. Four rows
through three code paths is three tests. The number of rows is not the metric.

**★ Losing an `@EnumSource` opportunity by entangling columns.** In case (a), splitting the test
let one half become `@EnumSource(Role.class)` and therefore self-extending when a role is added.
Entangled tables are almost always *narrower* than the tests they replaced.

## Interview questions

**★ What is the single test for whether something should be a parameterized test?**
Whether every row takes the same path through the method body. The user guide's definition is
*"run a test method multiple times with different arguments"* — arguments, not behaviour. If a
parameter is consumed by an `if`, or a row skips an assertion, or a row needs different setup, the
rows are not different arguments to one test; they are different tests.

**★ Why is a boolean parameter that selects a branch so bad?**
Because the branch is the only thing that distinguishes the two behaviours, and the branch is
invisible to the report. The default display name shows the arguments and nothing else, so a red
row tells you the values but not which of the two behaviours it was exercising. It also produces
dead columns — cells that no row reads — which drift wrong without anything failing.

**★ How do you handle a table where one input is supposed to throw?**
Take it out. Success cases stay in the table with a properly typed `expected` column; the throwing
case becomes its own test, which lets you assert the exception type *and* its message — richer than
a column could ever be. If there are many throwing cases, they get their own table with their own
columns (input, exception type, message fragment), still separate from the success table.

**★ Is there a row count above which a table is wrong?**
No. A hundred rows through one path is fine and is often exactly what property-style thinking
produces. Four rows through three paths is wrong. The metric is paths through the method body and
uniformity of meaning, never the number of rows.

**★ Two tests share five lines of arrangement. Should they become one parameterized test?**
No — that is the wrong tool for the problem. Shared arrangement is what `@BeforeEach`, a private
helper or a test-data builder exists for. Merging distinct behaviours into one parameterized method
to deduplicate setup buys a few lines and costs the report's ability to say which behaviour failed.

{/* FOOTER */}
