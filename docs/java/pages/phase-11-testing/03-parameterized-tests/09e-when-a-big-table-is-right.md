---
title: "Four chunks of reasons not to parameterize are worth nothing without the other half, because a reviewer armed only with the smells will split the two-hundred-row conformance table that was the best test in the codebase"
sidebar_label: "09e · When a big table is right"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Parameterized Classes and Tests",
> "`@EnumSource`", "`@CsvFileSource`" and "Customizing Display Names"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)).
> The documented behaviour quoted here is JUnit's; the review standard built on it is an argument,
> not a rule the framework enforces.
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**[09](09-when-not-to-parameterize.md) through [09d](09d-setup-drift-and-computed-expectations.md)
described six ways a table stops being data. None of them is an argument against large tables, and
a reviewer who has absorbed the smells and not this chunk will do real damage — splitting a
conformance suite into eighty near-identical methods because it "looked like too much in one
test". This is the counter-case, and it is the more common situation.**

## The four questions

A table is right — and a two-hundred-row table can be right — when all four of these hold. They
are the positive form of everything in the previous four chunks.

**1 · Every row takes the same path through the method body.** No branch on a parameter, no
optional column, no row that skips an assertion, no arrangement that differs. This is the
load-bearing one: if it holds, most of the other smells cannot occur.

**2 · The expectation was written down, not derived.** Every expected value came from a human, a
specification, or a captured observation — never from an expression that recomputes it from the
input ([09d](09d-setup-drift-and-computed-expectations.md)).

**3 · Deleting a row loses an *example*, not a *behaviour*.** If removing one row means some rule
is no longer tested at all, that row was a test wearing a row's clothes.

**4 · The table reads as the specification.** Someone who knows the domain but not the code can
read the rows and say whether they are correct. That is a property no set of `@Test` methods has,
and it is the reason tables exist.

If all four hold, length is not evidence of anything. Twelve rows and twelve hundred rows are the
same shape.

## Five situations where a long table is the right answer

### (i) One rule, many examples

```java
@ParameterizedTest(name = "{0} normalises to {1}")
@CsvSource({
    "Straße,    strasse",
    "İstanbul,  istanbul",
    "ǅ,         ǆ",
    "ΣΣ,        σσ",
    "ﬁle,       file"
})
void normalisesForSearch(String input, String expected) {
    assertThat(SearchKey.of(input).toString()).isEqualTo(expected);
}
```

Parsers, formatters, validators, normalisers, slug generators, phone-number cleaners. One rule,
and the only honest way to specify it is by example. Each row is interchangeable with the others;
none of them is a different behaviour.

### (ii) The table *is* an external specification

```java
@ParameterizedTest(name = "IBAN {0} is valid: {1}")
@CsvFileSource(resources = "/iso-13616-test-vectors.csv", numLinesToSkip = 1)
void matchesTheIsoTestVectors(String iban, boolean valid) {
    assertThat(Iban.isValid(iban)).isEqualTo(valid);
}
```

Conformance vectors from an RFC, an ISO annex, a payment scheme's certification pack, a tax
authority's worked examples. The file is the requirement, checked in and diffable
([03c](03c-csvfilesource.md)); the test method is a two-line adapter. Splitting this into methods
would replace a document you can compare against the standard with code you cannot.

🔴 The `@CsvFileSource` form is what makes this defensible: the data is a file in the repository,
reviewable on its own, updated by replacing it when the standard is revised. That is the opposite
of [09c](09c-the-source-that-grew-logic.md)'s generated source — the rows are fixed and external,
not computed.

### (iii) A boundary sweep

```java
@ParameterizedTest
@ValueSource(ints = { Integer.MIN_VALUE, -1, 0, 1, 99, 100, 101, Integer.MAX_VALUE })
void neverThrowsForAnyBoundaryValue(int input) {
    assertThatCode(() -> Percentage.clamp(input)).doesNotThrowAnyException();
}
```

One column, one invariant, and the point is the edges. This is a legitimate one-column table —
distinct from the one-column table of [09d](09d-setup-drift-and-computed-expectations.md), where
the second column had been replaced by arithmetic. Here there is no expected value to write down,
because the assertion is a property that holds for every input.

### (iv) A regression corpus

```java
@ParameterizedTest(name = "{0}")
@MethodSource("everyInputThatHasEverBrokenThisParser")
void stillParses(String input) {
    assertThatCode(() -> parser.parse(input)).doesNotThrowAnyException();
}

static Stream<Arguments> everyInputThatHasEverBrokenThisParser() {
    return Stream.of(
        argumentSet("PROJ-4821 · trailing dot in the domain", "a@b.com."),
        argumentSet("PROJ-5033 · BOM at the start of the file", "\uFEFFname,value"),
        argumentSet("PROJ-6110 · CRLF inside a quoted cell", "\"a\r\nb\",c")
    );
}
```

One row per bug that once escaped. This *looks* like the prose-column anti-pattern of
[09b](09b-when-the-table-stops-being-data.md) because every row carries a label — but the label
names an **input** and a ticket, not a rule, and every row asserts the same single thing. Same
path, written-down expectation, and deleting a row loses an example. It is a table, and it should
only ever grow.

Note that the labels are `argumentSet` names ([07c](07c-naming-arguments.md)) rendered through
`{argumentSetName}`, not a description column — so the ticket number appears in the report without
occupying a parameter.

### (v) Exhaustiveness over an enum

```java
@ParameterizedTest
@EnumSource(OrderState.class)
void everyStateRendersALabel(OrderState state) {
    assertThat(labels.forState(state)).isNotBlank();
}
```

This is the mirror image of everything in the previous four chunks: the value of the test is
precisely that it *cannot* be written as a fixed list ([05](05-enumsource.md)). Add a constant and
it fails immediately, in the same commit, without anyone remembering to add a case. No collection
of `@Test` methods can buy that, because the person adding the constant is exactly the person who
will forget to add the method.

## The asymmetry worth remembering

The six smells all have the same shape: *something that varies between rows is not a value*. The
five good cases all have the same shape too: *the only thing that varies between rows is a value*.
That is one sentence, and it is the entire topic.

Which means the review question is never "is this table too long?" It is **"what varies between
these rows, and is all of it data?"** A hundred rows that vary only in data are a specification. A
four-row table where one of the things that varies is a branch is four tests.

Turning that question, and everything in this topic, into something you can apply to somebody
else's pull request in two minutes is [10](10-the-checklist.md).

## Gotchas

**★ Splitting a table because it is long.** Length is not a symptom of anything. Two hundred rows
through one path with human-written expectations is a specification, and breaking it into methods
makes it strictly worse — the rows stop being comparable and the file stops being reviewable
against the standard it encodes.

**★ Splitting a regression corpus because every row has a label.** Labels that name an input and a
ticket are not the prose-column anti-pattern. The test is what the rows assert: if every row
asserts the same single thing, it is a table.

**★ Replacing an `@EnumSource` with a fixed list "for clarity".** That removes the only property
the test had — failing when a constant is added. Exhaustiveness *is* the assertion.

**★ Inlining a `@CsvFileSource` back into `@CsvSource` to keep everything in one file.** For
conformance vectors that is a downgrade: the data stops being diffable against the source document
and starts being Java string literals someone will reformat.

**★ Treating a one-column boundary sweep as the "missing expected column" smell.** They look
identical and are opposites. The question is whether the assertion is an invariant (fine) or
whether an expected value is being recomputed in the body
([09d](09d-setup-drift-and-computed-expectations.md)).

**★ Adding a row to a conformance table by hand.** If the table encodes an external specification,
rows come from the specification. A hand-added row is an assertion about what you believe, mixed
into a file whose value is that it is *not* about what you believe — keep those in a separate
method.

**★ Letting a regression corpus lose its ticket labels in a refactor.** The label is the only link
between the row and the incident. Once `argumentSet("PROJ-4821 · trailing dot", …)` becomes a bare
string literal, nobody can tell whether the row still matters, and eventually someone deletes it.

**★ Applying any of this to a property-based test.** Generated inputs plus an invariant are a
different discipline: "the expectation is computed" is not a defect there because there is no
expectation, only a property that must hold. (**topic 10 · property-based testing**
*(not written yet)*.)

**★ Using the four questions as a checklist without the first one.** "Every row takes the same
path" does most of the work. A table can satisfy the other three and still be wrong if one
parameter is read by an `if`.

## Interview questions

**★ When is a two-hundred-row table the right answer?**
When every row takes the same path through the method body, every expectation was written down
rather than derived, deleting a row costs an example rather than a behaviour, and the table reads
as the specification to someone who knows the domain. Conformance vectors, a normaliser's cases, a
boundary sweep and a regression corpus all satisfy that, and splitting any of them would be
actively harmful.

**★ How is a regression corpus different from the "prose column" anti-pattern?**
By what the label says and by what the rows assert. In a corpus every row asserts the same single
thing — it still parses — and the label names an input and a ticket. In the anti-pattern each label
states a different *rule*, which means the rows are different tests. Labels beginning "because…"
are the tell. Using `argumentSet` names rather than a description parameter also keeps the label
out of the method signature, where it would otherwise be a column nothing reads.

**★ A reviewer asks you to split a long `@EnumSource` test into one test per constant. Do you?**
No — this is the case where splitting destroys the test's value. The point of `@EnumSource` is that
the case set is derived from the enum, so adding a constant fails it immediately. A hand-written
list of methods has to be maintained by whoever adds the constant, which is precisely the person
who will not.

**★ Why keep conformance vectors in a `@CsvFileSource` rather than a `@CsvSource`?**
Because the file is the artefact. It can be diffed against the published document, replaced
wholesale when the standard is revised, reviewed by someone who does not read Java, and it does not
suffer reformatting by an IDE. Inlining it converts a reviewable document into string literals.

**★ Summarise the whole "when not to parameterize" argument in one sentence.**
A parameterized test is a loop over data, so anything that varies the *behaviour* — a branch, a
lambda, an absent column, a different setup, a computed expectation — belongs in a method name
rather than in a row; and anything that varies only the *values* belongs in a table, however long
that table becomes.

**★ What is the one question to ask when reviewing a parameterized test?**
"What varies between these rows, and is all of it data?" Not "how many rows?", not "is this too
long?". If the only thing that varies is data, the table is right at any size. If something else
varies — a path, a setup, a justification, an applicability — that thing wants a method name.

{/* FOOTER */}
