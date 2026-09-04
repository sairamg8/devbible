---
title: "Property-based testing does not pay evenly across a codebase — it pays enormously in a handful of places and barely at all in most, and the places it pays share one feature: the code claims a law that holds for every input, which means a counter-example is a bug rather than a matter of opinion"
sidebar_label: "10 · Where it pays"
sidebar_position: 37
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **JDK 25 javadoc** for `java.util.Comparator`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Comparator.html)),
> `java.util.List.sort`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html))
> and `java.math.BigDecimal`; and the **jqwik 1.10.1 user guide**
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)) for the API used in the examples.
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** The bugs described below are the documented
> or well-established failure modes of the constructs shown; none of them was reproduced here,
> and there is no run output on this page.

**[04](04-finding-properties.md) and its siblings covered how to *find* a property once you have
decided to write one. This page is the prior question: given a real codebase with four hundred
classes, which of them are worth the effort? The answer is not "the important ones" and it is not
"the complicated ones". It is the ones whose correctness is a law rather than a policy — where
you can finish the sentence "for every input, …" without lying. This page is a catalogue of where
those live in ordinary Java systems, with the property and the specific bug it catches.**

## The test: can you finish the sentence?

> *For every X, `f` satisfies …*

If the sentence needs an exception list to be true, the code is a business rule and belongs in
[11 · Where it does not pay](11-where-it-does-not-pay.md). If it stands unqualified, you have a
property. The domains below are the ones where that sentence is routinely completable — not
because the code is clever, but because it implements something with a definition outside your
codebase: a format, a specification, an algebra, an RFC.

## 1 · Parsers, serialisers and anything with a round trip

The highest-yield target in almost every codebase, because the law is free: **parse ∘ render =
identity**.

```java
@Property
void renderThenParseIsIdentity(@ForAll("invoices") Invoice original) {
    String json = mapper.writeValueAsString(original);
    Invoice roundTripped = mapper.readValue(json, Invoice.class);

    assertThat(roundTripped).isEqualTo(original);
}
```

What it catches that examples do not: a field that serialises but has no deserialisation path
(the reverse mapping was never exercised because every test built the object directly); a
`BigDecimal` whose scale survives rendering and is lost on read; a string containing the
delimiter, a quote, a newline, a lone surrogate; an `Optional.empty()` that round-trips as
`null`; a `Map` with an empty-string key. Every one of those is a real production incident and
none of them is on the list of examples anyone writes by hand.

⚠️ **The direction matters.** `parse ∘ render` (start from an object) is easy and tests the
half you control. `render ∘ parse` (start from a string) is harder because you need a generator
of *valid documents*, and it is the half that catches a parser accepting input your renderer
would never produce. Write the first; know that the second is where the interesting bugs are.

## 2 · Money

Money is the domain where property testing has the highest ratio of bugs-found to effort,
because rounding is where laws and arithmetic disagree.

```java
@Property
void allocationLosesNothing(
        @ForAll @BigRange(min = "0.01", max = "100000.00") @Scale(2) BigDecimal total,
        @ForAll @IntRange(min = 1, max = 12) int ways) {

    List<BigDecimal> parts = Money.allocate(total, ways);

    assertThat(parts).hasSize(ways);
    assertThat(parts.stream().reduce(BigDecimal.ZERO, BigDecimal::add))
            .isEqualByComparingTo(total);          // not a penny created or destroyed
}
```

The laws worth stating: **the parts sum to the whole**; **no part is negative**; **the largest and
smallest part differ by at most one minor unit**; and, for a split of a split, **the result does
not depend on the order the splits were applied**. The bug they catch is the same bug every
time — a division that rounds each part independently, so ten pence split three ways becomes
3+3+3 and a penny evaporates, or 4+4+4 and a penny is invented. It survives example-based tests
because the examples people choose divide evenly.

⚠️ Use `isEqualByComparingTo`, not `isEqualTo`: `BigDecimal.equals` compares scale as well as
value, so `2.50` and `2.5` are not equal. That distinction is itself worth a property.

## 3 · Dates, times and anything with a zone

Every date bug is a case someone did not think of, which is the exact shape property testing
exists for.

```java
@Property
void addingThenSubtractingTheSameDurationReturnsTheStart(
        @ForAll("instants") Instant start,
        @ForAll("zones") ZoneId zone,
        @ForAll @IntRange(min = -500, max = 500) int days) {

    ZonedDateTime from = start.atZone(zone);
    assertThat(from.plusDays(days).minusDays(days)).isEqualTo(from);
}
```

⚠️ **And that property is false**, which is the point of writing it. Around a DST transition,
`plusDays` works in local terms and the round trip does not return to the start — the standard
library is behaving correctly and the naive law is wrong. A property that fails teaches you the
domain: the true law is about `Instant` arithmetic, not local arithmetic, and discovering *which*
is exactly the confusion that produces off-by-an-hour bugs in production. Generators that draw
zones from the full `ZoneId.getAvailableZoneIds()` set and instants across several years will
find transitions your examples never sit on: the hour that happens twice, the hour that does not
exist, the historical zone whose offset was not a whole number of hours, the leap day.

## 4 · Encoding, escaping and injection boundaries

Any function whose job is "make this string safe for that context" is a property in disguise, and
it is a security-relevant one.

```java
@Property
void escapedOutputContainsNoUnescapedDelimiter(@ForAll String raw) {
    String escaped = CsvField.escape(raw);

    assertThat(CsvField.parse(escaped)).isEqualTo(raw);          // round trip
    assertThat(escaped).satisfies(CsvField::hasNoBareDelimiter); // and the safety law
}
```

Two laws, and you want both: the round trip proves you did not destroy data, and the structural
law proves you did not leave the hazard in. An escaper that simply doubles quotes passes the
round trip and fails the second law on an input containing a newline. Generate unrestricted
strings here — this is the one place where the default alphabet is too *narrow*, and control
characters, combining marks and surrogate pairs are the inputs that matter
([05a](05a-the-defaults-you-inherit.md)).## Where this connects

- Ordering, structure and state — comparators, caches and collections, state machines, and an
  optimised implementation against a reference — are
  [10b · Where it pays: ordering and state](10b-where-it-pays-ordering-and-state.md).
- Where the sentence cannot be finished, and forcing it produces a test that restates the code,
  is [11 · Where it does not pay](11-where-it-does-not-pay.md).
- The runtime bill for all of this is [12 · The cost](12-the-cost.md).
- How to find a law once you have picked a target is
  [04 · Finding properties](04-finding-properties.md), and the model-and-oracle technique is
  [04d · Models and oracles](04d-models-and-oracles.md).
- Generating the values these properties need is [05 · Generators](05-generators.md).

## Gotchas

**★ The round-trip property people write is the easy direction, and the bugs live in the other one.**
`object → render → parse → object` only ever exercises documents your renderer can produce, which
is a strict subset of the documents your parser will meet in production. The valuable direction —
generate a *document*, parse it, render it, compare — needs a generator of valid syntax, which is
real work ([05c6](05c6-recursive-arbitraries.md)). Most teams write the easy one, which is still
worth having; the mistake is believing it covers the parser.

**★ A money property that asserts `isEqualTo` instead of `isEqualByComparingTo` fails on scale, not on value, and the failure looks like a rounding bug.**
`BigDecimal.equals` is documented as comparing scale as well as unscaled value, so `2.50` and
`2.5` are unequal objects and equal amounts. A shrunk counter-example of `0.10` versus `0.1`
sends people looking for a lost penny that was never lost. Decide which you mean —
`isEqualByComparingTo` for amounts, `isEqualTo` when the scale is part of the contract — and
consider making scale its own explicit property rather than an accident of the assertion.

**★ Generating dates within one year finds none of the bugs that make date code famous.**
A generator bounded to "recent, plausible" instants never draws a leap day, never lands in the
ambiguous hour of a DST fall-back, never sees a zone whose historical offset was not a whole
number of hours, and never crosses a year boundary in a week-numbering calculation. The generator
that finds date bugs is deliberately wide — several years, the full zone set — and it is the one
people trim first because the failures it produces look unrealistic. They are not unrealistic;
they are annual.

**★ Escaping properties written only as round trips miss the entire security point.**
`unescape(escape(s)) == s` is satisfied by the identity function. If the reason the escaper
exists is that its output is embedded in CSV, HTML or a shell command, then the property that
matters is structural — *the output contains no bare delimiter*, *the output parses as exactly
one field* — and it has to be written separately. A round trip proves you did not lose data; it
says nothing about whether you removed the hazard.

**★ "It has a specification" is the strongest possible signal, and people look for complexity instead.**
Teams pick their most complicated class to try property testing on, and the most complicated
class is usually the one full of business policy — the worst possible target
([11](11-where-it-does-not-pay.md)). The best first target is often something small and boring
whose behaviour is defined elsewhere: a comparator, a slug generator, a CSV escaper, a money
splitter, a retry-delay calculator. The rule is not "where is the risk" but "where is the law".

## Interview questions

**★ How do you decide which code in a codebase is worth property-testing?**
I try to finish the sentence "for every input, this satisfies…" without adding exceptions. If it
finishes cleanly, there is a property; if the honest version needs "except for corporate
customers in their first month", it is business policy and property testing will produce a test
that restates the implementation. In practice that test selects for code whose definition lives
outside my codebase — a format, an RFC, an algebra, a javadoc contract — because then the law is
something I can transcribe rather than invent, and a counter-example is unambiguously a bug
rather than a disagreement about requirements. Concretely that means parsers and serialisers,
money arithmetic, date and zone handling, escaping and encoding, comparators, caches, and any
optimised implementation that has a slow obvious version to check against. It is worth saying
what this rules out: the sprawling service class everyone is afraid of is usually the *worst*
first target, even though it is where the fear is.

**★ Give me a concrete example of a bug that property testing finds and example-based testing does not.**
Money allocation. Splitting £10.00 three ways: the naive implementation divides and rounds each
part, and the parts sum to £9.99 or £10.01 depending on the rounding mode. Every hand-written
test divides evenly — £10 two ways, £9 three ways — because those are the examples a person
thinks of, so the bug ships. The property is one line and unarguable: the parts sum to the whole.
The second thing the property gives you is the minimal case, because shrinking drives to the
smallest amount and fewest parts that still breaks it, which is usually a penny or two split
three ways — and that is a bug report a reviewer can verify by hand in ten seconds. The same
shape recurs everywhere rounding meets addition: percentage allocations, tax lines, prorated
subscriptions.

**★ A colleague says "we already have 90% coverage on the parser, why would we add property tests?"**
Because coverage says the lines ran, not that anything would have noticed them being wrong — the
argument [11 · Mutation testing](../11-mutation-testing/README.md) makes in full. On a parser
specifically, the gap is concrete and easy to name: those examples are all documents that *we*
produced, so the code paths for input we would never emit are either uncovered or covered by an
example someone wrote to hit the branch rather than to assert anything interesting. A round-trip
property adds inputs nobody chose — the field containing the delimiter, the empty string, the
lone surrogate, the number with trailing zeros — and it adds them for free, permanently, on every
build. I would not present it as replacing the example tests either; the examples document the
intended shapes and read as specification, and the property covers the space between them.

{/* FOOTER */}
