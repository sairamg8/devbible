---
title: "A first column of prose and a column of dashes are two symptoms of the same disease — the rows have stopped being interchangeable examples of one rule and become separate rules sharing a signature"
sidebar_label: "09b · When the table stops being data"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Customizing Display Names",
> "`@MethodSource`" and "`@CsvSource`"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)).
> The documented behaviour quoted here is JUnit's; the design argument built on it is a review
> standard, not a rule the framework enforces.
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**[09](09-when-not-to-parameterize.md) covered the two cases where a column openly steers the
method body. These two are subtler: the table still looks like a table, but one has acquired a
column of prose and the other a column of absences — and in both, a piece of the test's meaning
has moved somewhere the failure report cannot reach.**

## Case (c) — rows whose names have to explain *why* they differ

```java
@ParameterizedTest(name = "{0}")
@CsvSource({
    "'a plain address is accepted',                     'a@b.com',    true",
    "'we allow plus-addressing because Gmail does',     'a+x@b.com',  true",
    "'we reject a trailing dot because RFC 5321 does',  'a@b.com.',   false",
    "'uppercase is fine, the domain is case-insensitive', 'A@B.com',  true"
})
void validates(String why, String input, boolean expected) {
    assertThat(validator.isValid(input)).isEqualTo(expected);
}
```

**The symptom in the diff.** A first column exists whose only job is prose, and the prose is
getting longer. Somebody added `why` because `[3] a@b.com., false` was not self-explanatory, and
now three of the four sentences are policy statements.

**Why it hurts.** A table is the right format when the rows are *interchangeable examples of one
rule*. The moment each row needs a sentence, the rows are not examples of one rule — they are four
rules. And a data column is the worst available place to keep a rule: it is not compiled, it is
not linked to the requirement, it does not appear in the IDE's test tree as a behaviour, and a
developer grepping for `plus-addressing` finds a CSV string rather than a test they can run.

**The rewrite.** Rules become methods; examples stay in tables.

```java
@ParameterizedTest(name = "{0} is a valid address")
@ValueSource(strings = { "a@b.com", "first.last@b.co.uk", "x@b.io" })
void acceptsOrdinaryAddresses(String input) {
    assertThat(validator.isValid(input)).isTrue();
}

@Test
void acceptsPlusAddressing_becauseGmailUsesItForFiltering() {
    assertThat(validator.isValid("a+newsletter@b.com")).isTrue();
}

@Test
void rejectsATrailingDotInTheDomain_perRfc5321() {
    assertThat(validator.isValid("a@b.com.")).isFalse();
}

@ParameterizedTest(name = "{0} is accepted regardless of case")
@ValueSource(strings = { "A@B.com", "a@B.COM", "A@b.com" })
void treatsTheDomainAsCaseInsensitive(String input) {
    assertThat(validator.isValid(input)).isTrue();
}
```

Two of the four became `@Test` methods whose names carry the reason. Two stayed parameterized
because they genuinely had interchangeable examples — and one of those *gained* rows, because
once "case-insensitivity" was its own method it was obvious that one example was not enough.

🔴 **The question is never "how many cases?" It is "do these rows differ in their *inputs* or in
their *justification*?"** Differing inputs are a table. Differing justification is a set of
methods.

⚠️ There is a real feature that looks like the anti-pattern and is not: **named argument sets**
([07c](07c-naming-arguments.md)), where `argumentSet("…", …)` labels a row and the label is
rendered through `{argumentSetName}`. The distinction is what the label says.
`argumentSet("empty local part", "@b.com")` names the *input* and is good, whereas
`argumentSet("we reject this because RFC 5321 says so", …)` states a *rule* and belongs in a
method name.

## Case (d) — the table that is half `null`

```java
@ParameterizedTest
@CsvSource(nullValues = "-", value = {
    "SAVE10, -,     -,   10",
    "-,      GOLD,  -,   15",
    "-,      -,     50,  20",
    "SAVE10, GOLD,  -,   22"
})
void computesDiscount(String coupon, Tier tier, Integer bulkQuantity, int expectedPercent) {
    Cart cart = new Cart();
    if (coupon != null)       cart.apply(coupon);
    if (tier != null)         cart.setMemberTier(tier);
    if (bulkQuantity != null) cart.addItems(bulkQuantity);

    assertThat(pricing.discountFor(cart)).isEqualTo(expectedPercent);
}
```

**The symptom in the diff.** A column of dashes. Three parameters and four rows, and no row uses
more than two of them; each row's meaning is *which columns are populated*, not what is in them.
Note that the `if (x != null)` scaffolding in the body is case (a) from
[09](09-when-not-to-parameterize.md) wearing a different hat — three branches, one per absent
column.

**Why it hurts.** Three reasons, and the third is the one that bites.

1. **The columns are not a schema.** A table works because every row means the same thing in
   every column. Here `null` means "this rule does not apply to this row", which is metadata about
   the *test*, not a value of the *domain*.
2. **The report degrades.** The default display name is *"the invocation index and a
   comma-separated list of the `String` representations of all arguments"*, so a failing row reads
   `[3] null, null, 50, 20` — three quarters noise.
3. 🔴 **`null` becomes ambiguous.** In this table `-` means "not applicable". But `null` is also a
   legitimate *value* to test — "what happens when a coupon code is `null`?" is a real question
   ([02b](02b-null-and-empty.md)). Once `null` means "skip this column", you have lost the ability
   to write the row that tests a `null` coupon, and nobody notices the gap.

**The rewrite.** One test per rule, plus a table for the combination the rules actually have:

```java
@ParameterizedTest(name = "coupon {0} gives {1}%")
@CsvSource({ "SAVE10, 10", "SAVE20, 20" })
void couponDiscount(String coupon, int expected) {
    Cart cart = aCart().withCoupon(coupon).build();
    assertThat(pricing.discountFor(cart)).isEqualTo(expected);
}

@ParameterizedTest(name = "{0} members get {1}%")
@CsvSource({ "SILVER, 5", "GOLD, 15" })
void memberDiscount(Tier tier, int expected) {
    assertThat(pricing.discountFor(aCart().withTier(tier).build())).isEqualTo(expected);
}

@Test
void couponAndMembershipCompound_ratherThanAdd() {
    Cart cart = aCart().withCoupon("SAVE10").withTier(GOLD).build();
    assertThat(pricing.discountFor(cart)).isEqualTo(22);   // 1 - 0.9 * 0.85
}
```

The fourth row of the original table was the only interesting one — it encoded *compounding
rather than addition*, `22` and not `25` — and in the table nothing said so. As a named test with
a comment it is the most valuable assertion in the file. A builder
(**topic 08 · test data patterns** *(not written yet)*) is what makes the "absent" columns
disappear: `aCart().withCoupon(…)` simply does not mention a tier.

## Where this continues

The third shape in this family — the argument source that has grown a loop, a filter and a
computed expectation — is [09c](09c-the-source-that-grew-logic.md). The row that needs its own
setup and the expectation the test computes for itself are
[09d](09d-setup-drift-and-computed-expectations.md), and the honest counter-case for when a large
table really is right is [09e](09e-when-a-big-table-is-right.md).

## Gotchas

**★ A `why` or `description` first column.** Prose in data is a rule that has not been promoted to
a method name. It is invisible to grep-by-behaviour, absent from the IDE test tree as a behaviour,
and unlinked to the requirement it paraphrases.

**★ A table whose display-name pattern is just `{0}`, where `{0}` is a sentence.** If the most
informative thing you can render is a hand-written description, the arguments have stopped
describing the case — which is precisely the signal that they are no longer the case.

**★ Confusing a `why` column with a named argument set.** `argumentSet` labels
([07c](07c-naming-arguments.md)) are the right tool when the label names the *input*
(`"empty local part"`). They become the same anti-pattern when the label states a *rule*.

**★ A column that is `null` for most rows.** `null` there means "not applicable", which is
metadata about the test rather than a value in the domain. Each row is exercising a different
rule, and the table is a Cartesian product nobody intended.

**★ Losing the ability to test a real `null`.** Once `null` means "skip this column", the row that
asks "what does the code do when this input actually is `null`?" cannot be written. That gap is
invisible — no test fails to record its absence.

**★ `if (param != null)` scaffolding in the test body.** It is the branch-selecting parameter of
[09](09-when-not-to-parameterize.md) in disguise, one branch per optional column, and the report
shows none of it.

## Interview questions

**★ A colleague adds a `description` column so the report reads better. What do you say?**
That the report reading badly is a symptom, not the problem. If the arguments do not identify the
case, either the display-name pattern needs work ([07](07-display-names.md)) or — far more often —
the rows differ in justification rather than in input, which makes them separate tests whose names
should carry that justification. A method name is greppable, shows in the IDE tree, and survives a
refactor. A CSV string is none of those.

**★ When is labelling a row acceptable, then?**
When the label names the input rather than the rule. `argumentSet("empty local part", "@b.com")`
tells you which case `[3]` was without asserting anything about policy, and JUnit renders it
through `{argumentSetName}` ([07c](07c-naming-arguments.md)). The line is crossed when the label
starts with "because".

**★ What is wrong with a table where many cells are `null`?**
`null` has been overloaded to mean "this column does not apply to this row", so the table is no
longer a schema — each row is a different rule sharing a signature. It forces `if (x != null)`
branching into the test body, it fills the report with `null, null,` noise, and it destroys the
ability to test a genuinely `null` input, because that row would be indistinguishable from an
inapplicable one.

**★ How do you rewrite a sparse table?**
One test per rule, using a builder so that "absent" is expressed by not calling a method rather
than by a `null` cell — and then a separate, named test for each *interaction* between rules. In
practice the interaction rows are the valuable ones and the table was hiding them: a row reading
`SAVE10, GOLD, -, 22` says nothing about why the answer is 22 and not 25.

{/* FOOTER */}
