---
title: "The two relations that cover the most code are the ones you find by reading a signature rather than a name: something about the output that the input already determines, and the fact that two arguments could have arrived in either order — and the second is the one people assert without checking that the specification promised it"
sidebar_label: "04b · Invariants and order-independence"
sidebar_position: 15
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Constraining Default
> Generation* (`@Size`, `@IntRange`, `@BigRange`, `@Scale`, `@UniqueElements`), *Assumptions*
> and *Failure Reporting* ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); the
> **AssertJ 3.27.7** API for `containsExactlyInAnyOrderElementsOf`, `isSorted` and
> `isEqualByComparingTo`; and the **JDK 25 javadoc** for `java.math.BigDecimal.equals` and
> `compareTo`.
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine** — Java source only, never its output.

**[04](04-finding-properties.md) covered the two relations you can find by looking at method
names. These two you find by looking at a signature. A preserved invariant asks what the
output must satisfy given only what the input told you — its size, its sum, its multiset of
elements, its range — and it is the widest net in the catalogue, because you never have to
know the answer. Order-independence asks whether two arguments could have arrived the other
way round, and it is the sharpest, because it finds merge and concurrency defects that
example tests structurally cannot reach. It is also the one people assert without first
checking that the domain actually promised it, which produces a red build that is the test's
fault.**

## Relation 3 — a preserved invariant: something about the output the input already told you

This is the widest of the four and the one to reach for when nothing else fits. You do not
have to know what the output *is*; you only have to know something it must satisfy.

```java
@Property
void sortingPreservesSizeAndContents(@ForAll List<Integer> input) {
    List<Integer> sorted = new ArrayList<>(input);   // never mutate a generated value
    Collections.sort(sorted);

    assertThat(sorted).hasSameSizeAs(input);          // nothing lost, nothing invented
    assertThat(sorted).containsExactlyInAnyOrderElementsOf(input);
    assertThat(sorted).isSorted();                    // and the point of the exercise
}

@Property
void splittingABillNeverLosesOrInventsMoney(
        @ForAll @BigRange(min = "0.00", max = "1000000.00") @Scale(2) BigDecimal total,
        @ForAll @IntRange(min = 1, max = 500) int ways) {

    List<BigDecimal> shares = Bill.split(total, ways);

    assertThat(shares).hasSize(ways);
    assertThat(shares.stream().reduce(BigDecimal.ZERO, BigDecimal::add))
            .isEqualByComparingTo(total);
}

@Property
void paginationCoversEveryRowExactlyOnce(
        @ForAll @Size(max = 200) @UniqueElements List<String> rows,
        @ForAll @IntRange(min = 1, max = 50) int pageSize) {

    List<String> reassembled = Pages.of(rows, pageSize).stream()
            .flatMap(List::stream)
            .toList();

    assertThat(reassembled).containsExactlyElementsOf(rows);
}
```

The three invariant shapes worth memorising, because between them they express most
business rules:

- **Conservation.** The sum, the count or the multiset of elements is unchanged. Money,
  inventory, ledger entries, rows in a page split, characters in a text transformation.
- **Bounds.** The output is always in a range the input implies: a percentage in `[0, 100]`,
  a truncated string no longer than the limit, a retry delay never above the configured cap,
  a discount never larger than the price.
- **Structure.** The output is well-formed by its own rules: sorted, non-null, no duplicate
  keys, every id present in the index, a valid slug matching `^[a-z0-9-]*$`, a `Set` whose
  `size()` matches the number of distinct inputs.

## Relation 4 — order-independence: two routes, same destination

Commutativity, associativity and "the order the caller happened to use does not matter" are
the same property in three costumes, and they are the ones that find concurrency-adjacent and
merge-adjacent defects.

```java
@Property
void applyingDiscountsInEitherOrderGivesTheSamePrice(
        @ForAll("prices") Money price,
        @ForAll("discounts") Discount first,
        @ForAll("discounts") Discount second) {

    assertThat(second.applyTo(first.applyTo(price)))
            .isEqualTo(first.applyTo(second.applyTo(price)));
}

@Property
void mergingConfigurationIsAssociative(
        @ForAll("configs") Config a, @ForAll("configs") Config b, @ForAll("configs") Config c) {

    assertThat(a.merge(b).merge(c)).isEqualTo(a.merge(b.merge(c)));
}

@Property
void addingThenRemovingLeavesTheSetUnchanged(@ForAll Set<String> tags, @ForAll String tag) {
    Assume.that(!tags.contains(tag));

    Set<String> working = new LinkedHashSet<>(tags);
    working.add(tag);
    working.remove(tag);

    assertThat(working).isEqualTo(tags);
}
```

⚠️ Order-independence is the relation people most often assert without checking whether it is
actually part of the specification. Percentage discounts commute; a percentage discount and a
flat "£5 off" do not, and asserting that they do produces a red build that is the *test's*
fault. When a property in this family fails, the first question is always "is the law true?"
before "is the code wrong?" — which is a question example tests never make you ask, and one of
the quieter benefits of the technique.
## Where this connects

- Round-trip and idempotence, the two relations you find by name, are
  [04 · Finding properties](04-finding-properties.md).
- What to do when none of the four fits is
  [04c · When no law is obvious](04c-when-no-law-is-obvious.md); comparing against a model is
  [04d · Models and oracles](04d-models-and-oracles.md), and relating two runs to each other is
  [04e · Metamorphic relations and contract tests](04e-metamorphic-and-contract-tests.md).
- The `@Size`, `@IntRange`, `@BigRange`, `@Scale` and `@UniqueElements` annotations used above
  are [05b · Constraining generation](05b-constraining-generation.md); `Assume.that` and why it
  is a last resort are on the same page.
- The default container size of 0 to 255, and why an unconstrained `List` property is slower
  than you expect, is [05 · Generators](05-generators.md) and
  [12 · The cost](12-the-cost.md).
- Why the report shows a mutated input rather than the generated one is
  [03b · Reading the failure report](03b-reading-the-failure-report.md).

## Gotchas

**★ An invariant property that only asserts the size is green for an implementation that returns the wrong elements.**
`assertThat(sorted).hasSameSizeAs(input)` passes for a `sort` that returns `input.size()`
copies of the first element. Conservation properties need the multiset, not the count:
`containsExactlyInAnyOrderElementsOf`. The cheap assertion is the one people write, and it is
the one that leaves the defect in.

**★ `isEqualTo` on `BigDecimal` compares scale as well as value, so an arithmetically correct conservation property fails on `10.0` versus `10.00`.**
`BigDecimal.equals` is documented to consider two values unequal when their scales differ,
while `compareTo` ignores scale. A money-splitting function that returns shares at scale 2,
summed and compared against a total the generator produced at scale 1, falsifies a property
that is true. AssertJ's `isEqualByComparingTo` routes through `compareTo` and is the assertion
you want in every money property. The failure looks like a real defect, costs half an hour, and
recurs in every codebase that has ever generated `BigDecimal` values.

**★ Mutating the `@ForAll` parameter breaks the failure report as well as the test.**
`Collections.sort(input)` on a generated list mutates a value the framework owns, and the guide
is explicit that *"the samples are reported after their use in the property method"* — so the
report shows you the sorted list, which does not reproduce the failure. Copy first. Invariant
properties are usually about collections, which is why this trap lives here rather than
anywhere else in the topic.

**★ Asserting commutativity that the specification never promised produces a red build that is the test's fault, and people fix the code.**
The dangerous version is a genuinely-wrong "fix": someone makes flat and percentage discounts
commute by reordering them internally, changing production behaviour to satisfy a property
nobody validated against the business rule. When an order-independence property fails, go and
read the rule before touching the code. This is the one relation in the catalogue where the
test is more often wrong than the code.

**★ `Assume.that(!tags.contains(tag))` in the set property above is a discard, and discards are capped at a ratio of 5 by default.**
The documented default `maxDiscardRatio` is 5, and *"if the ratio is exceeded jqwik will report
this property as a failure"* — as an exhausted property, not a falsified one, which reads like a
tool malfunction. On a generated `Set<String>` and a generated `String` the assumption almost
always passes, so this particular use is safe; the same idiom over a small domain (a `Set` of
enum constants and a generated constant) discards most of the time and blows the ratio. When you
write an assumption, read `checks` against `tries` on the next run. Details in
[05b](05b-constraining-generation.md).

**★ An associativity property over three generated values costs three generators and three times the shrinking surface, and it is still worth it.**
`a.merge(b).merge(c)` versus `a.merge(b.merge(c))` needs three `@ForAll` parameters, so the
shrunk sample has three components and the search space for shrinking is larger. People drop
the third parameter and assert only commutativity, which is a strictly weaker law: a merge that
takes the last-written value is commutative in pairs and not associative in triples, and the
defect only shows up when three config sources are involved — which is precisely the production
case.

**★ A conservation property over a `Set` silently changes what "conservation" means, because the input's duplicates are already gone.**
`@ForAll Set<String> tags` cannot express "the same tag twice", so a property asserting that
adding then removing leaves the collection unchanged never tests the duplicate case. If the
production input is a list that may contain duplicates, generate a `List` and be explicit about
the multiset semantics; if the production input really is a set, say so in the property name so
the next reader does not assume more coverage than exists.

**★ `@ForAll List<Integer>` with no `@Size` generates lists between 0 and 255 elements, and an `O(n²)` property over that is slower than the whole rest of your suite.**
The guide states that *"without any additional configuration, the size of generated containers
(lists, sets, arrays etc.) is between 0 and 255"*. A thousand tries over lists averaging tens of
elements is fine for a sort; it is not fine for anything quadratic, and it is not fine at all if
each element is itself a generated domain object with its own nested collections. Constrain the
size deliberately — the default is a generation default, not a considered test design.

**★ An order-independence property that passes may be passing because the generator never produced two *different* values.**
`@ForAll("discounts") Discount first, @ForAll("discounts") Discount second` will produce equal
discounts occasionally and different ones usually — but if the arbitrary has a small domain
skewed by edge cases, "both are the zero discount" can dominate, and the property is green
because both sides of the equation did nothing. `Statistics.collect(first.equals(second) ?
"same" : "different")` settles it in one line; see [09 · Statistics](09-statistics.md).

## Interview questions

**★ Give me an invariant for a function whose output you cannot predict at all — say, a scheduler that assigns jobs to workers.**
Several, and none of them needs to know the assignment. Every job appears exactly once across
all workers — conservation, and it catches both dropped and duplicated jobs. No worker is
assigned more than its capacity — a bound. The set of workers used is a subset of the workers
supplied — structure. If the input has fewer jobs than the smallest worker's capacity, exactly
one worker is used — a boundary rule. And a metamorphic one: adding a job never reduces the
number of workers used. That is five properties over an output nobody can predict, which is the
whole point — the technique does not require an oracle, only a relation.

**★ Why is "the shares sum to the total" a better property than "each share equals total divided by n"?**
Because the second is the implementation and the first is the requirement. `total / n` is not
even what a correct implementation does — money does not divide evenly, so a real splitter
distributes the remainder somewhere, and a property asserting exact division is either red for
correct code or forces the code to be wrong. The sum property, by contrast, is agnostic about
the distribution policy: it holds for round-half-up, for give-the-remainder-to-the-first-payer,
for banker's rounding, and it fails for every implementation that loses or invents a penny.
That is the shape you want — a property that constrains the outcome without dictating the
algorithm, so it survives a refactor and still catches the defect the refactor might introduce.

**★ A property asserts that applying two discounts commutes. It goes red. Walk me through what you do.**
I do not touch the production code first. I read the shrunk sample — with two discounts, jqwik
will have minimised toward the simplest pair that disagrees, which is usually "one percentage
and one fixed amount", and that is the answer sitting in the report. Then I go and check the
rule, because "10% off then £5 off" and "£5 off then 10% off" genuinely differ and the business
almost certainly has an opinion about which one the customer gets. Three outcomes: the rule says
they commute and the code is wrong, so I fix the code; the rule says they do not commute and the
property is wrong, so I narrow it to "two percentage discounts commute", which is a real law and
still worth testing; or nobody knows, which is the most valuable outcome, because a property has
just surfaced an unspecified case that is being decided by argument order in production today.

**★ How would you use an invariant property on code that writes to a database?**
By choosing an invariant that is expressible over the observable state rather than the return
value, and by being deliberate about the boundary. The conservation shape works well: after a
generated sequence of transfers between accounts, the sum of all balances equals the sum before
— a law that holds regardless of which transfers happened and that catches every partial-write
and rounding bug. The structural shape works too: every row written has a non-null tenant id,
every foreign key resolves. What makes this hard is not the property but the fixture — a
thousand tries against a real database is slow and needs rollback per try, which is
`@BeforeTry`/`@AfterTry` work from [03d](03d-the-jqwik-lifecycle.md) and a runtime conversation
from [12 · The cost](12-the-cost.md). My default is to extract the balance arithmetic from the
persistence and put the property on the arithmetic, which is faster, deterministic, and tests
the part that actually has a law.

{/* FOOTER */}
