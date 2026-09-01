---
title: "When a method has no inverse, is not idempotent, preserves nothing obvious and takes one argument, there are still four weaker properties worth writing — and the weakest of them, that it simply never throws anything undocumented, finds more production defects than any other single line in this topic"
sidebar_label: "04c · When no law is obvious"
sidebar_position: 16
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Creating a
> Property*, *Assertions* and *Constraining Default Generation* — including the documented
> character-set behaviour that *"when generating Strings … Unicode 'noncharacters' and
> 'private use characters' will not be generated unless you explicitly include them using
> `@Chars` or `@CharRange`"* ([jqwik.net](https://jqwik.net/docs/current/user-guide.html));
> and the **AssertJ 3.27.7** API.
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine** — Java source only, never its output.

**Round-trip, idempotence, invariants and order-independence cover most code and not all of
it. Sooner or later you hit a method with one argument, no inverse and no obvious conserved
quantity, and the temptation is to give up and write an example test — which is fine, and is
often correct. Before you do, there are four weaker moves, and the weakest of them is the one
worth the most: a property whose entire body is a call and a catch, asserting nothing except
that the function is *total* over its input type. That property has no assertion, looks like a
mistake in review, and finds `StringIndexOutOfBoundsException` in production parsers with
depressing regularity.**

## The four weaker moves

Sometimes the function genuinely has no inverse, is not idempotent, preserves nothing obvious
and takes one argument. Four things still work, in descending order of strength.

**Compare against a simpler implementation.** The slow, obviously-correct version is a test
oracle. This deserves its own treatment — [04d · Models and oracles](04d-models-and-oracles.md).

**Assert only that it does not blow up.** A property whose body is a single call and no
assertion still asserts something: *this function is total over its declared input type*.
That is a real claim, it is violated constantly by unchecked `substring`, `charAt`,
`Integer.parseInt` and `get(0)` calls, and it costs one line.

```java
@Property
void theParserNeverThrowsAnythingButParseException(@ForAll String anyInput) {
    try {
        Query.parse(anyInput);
    } catch (ParseException expected) {
        // the documented failure mode
    }
    // any other exception escapes and falsifies the property
}
```

**Assert the postcondition you would have written as a `@Test` — but for all inputs.** Take
your best example test, look at what it asserts, and ask which part of the assertion was about
*this* input and which part was about the function. The second part is a property. A test
asserting `discount(100, GOLD) == 90` contains a property: the output is never larger than the
input.

**Assert consistency between two public methods.** `list.contains(x)` must agree with
`list.indexOf(x) >= 0`; `repository.count()` must agree with `repository.findAll().size()`;
`isValid()` must agree with `validate()` throwing. Any two methods that overlap in meaning are
a property, and this one finds real defects because the two methods usually have separate
implementations that drift.

## A checklist you can run over a class in five minutes

Ask these in order. Stop at the first yes.

1. Is there a method on this class, or nearby, that undoes this one? → round-trip.
2. Would calling it twice be expected to change nothing? → idempotence.
3. Does the output have a size, sum, set of elements or range that the input determines? →
   invariant.
4. Does it take two or more things that could be supplied in either order? →
   order-independence.
5. Is there an obviously-correct slow way to compute the same answer? → model comparison
   ([04d](04d-models-and-oracles.md)).
6. Is there a second method whose result must agree with this one? → consistency.
7. Is it a parser, a formatter, or anything taking a `String` from outside? → totality: it
   must not throw anything undocumented, for any input.
8. None of the above? → this may be a business rule with no law, and
   [11 · Where it does not pay](11-where-it-does-not-pay.md) is the honest answer rather
   than a forced property.

## Where this connects

- The four strong relations are [04 · Finding properties](04-finding-properties.md) and
  [04b · Invariants and order-independence](04b-invariants-and-order-independence.md).
- Model comparison, which is step 5 of the checklist, is
  [04d · Models and oracles](04d-models-and-oracles.md); relating two runs to each other when
  there is no model at all is
  [04e · Metamorphic relations and contract tests](04e-metamorphic-and-contract-tests.md).
- Generating the arbitrary `String` that makes the totality property work — and widening its
  alphabet beyond jqwik's default — is [05 · Generators](05-generators.md) and
  [05b · Constraining generation](05b-constraining-generation.md).
- Checking that the generator really produced the awkward inputs is
  [09 · Statistics](09-statistics.md).
- The honest answer to step 8 is [11 · Where it does not pay](11-where-it-does-not-pay.md).
- Whether a property that survives all this is actually testing anything is
  [12 · The cost](12-the-cost.md), and the way to measure it rather than argue about it is
  **topic 11 · Mutation testing**.

## Gotchas

**★ "It doesn't throw" looks like a test with no assertion, and reviewers delete it.**
A property with a bare call and no `assertThat` will be flagged in code review as pointless. It
is not: it asserts totality over the whole generated domain, which is a claim no example test
makes. Write the intent into the method name — `parserIsTotalOverArbitraryInput` — and, if the
code has a documented failure mode, catch exactly that exception and let everything else escape.
A comment saying *"no assertion is deliberate: any escaping exception falsifies"* costs one line
and saves the property.

**★ A totality property that catches `Exception` catches the thing it was written to find.**
`catch (Exception e) { }` around the call turns the property into a no-op that passes for every
input, including the ones that crash. This is the single most common way this pattern is broken,
and it is broken by someone making the build green rather than by the original author. Catch the
one documented type by name, never a supertype, and never `Throwable`.

**★ jqwik's default `String` arbitrary deliberately excludes noncharacters and private-use characters, so "arbitrary input" is narrower than what arrives from a socket.**
The guide states it explicitly. For a parser whose input comes from the network or from user
uploads, the default alphabet is not the production alphabet — no lone surrogates, no
`U+FFFE`, no private-use planes. If those matter, widen the generator with `@Chars`/`@CharRange`
or generate `byte[]` and decode. A totality property is only total over what the generator can
produce.

**★ A consistency property between two methods is green when both are wrong in the same way, and that is common because one usually calls the other.**
`repository.count()` agreeing with `repository.findAll().size()` proves nothing if `count()` is
implemented as `findAll().size()`. Before writing a consistency property, check that the two
implementations are actually independent; if one delegates to the other, the property is a
tautology with extra steps. Where they *are* independent — a hand-written `count` query and a
fetch-all — the property is excellent, because that is exactly the pair that drifts when
somebody adds a soft-delete flag to one of them.

**★ A property over a domain object is only as good as the generator, and a generator you wrote yourself inherits your blind spots.**
If `@Provide Arbitrary<Order> orders()` never produces an order with zero line items, no
property over `Order` will ever test that case, and the property's green is the generator's
green. This is the point [01b](01b-what-a-table-cannot-contain.md) makes about coarse-grained
imagination, arriving one level down. The tool for checking it is
[09 · Statistics](09-statistics.md), not intuition.

**★ Finding no property for a method with one argument usually means the method is doing two things.**
When nothing in the checklist fits, the frequent cause is a method that computes something *and*
formats it, or validates *and* transforms. Split it, and each half acquires a law: the
computation has an invariant, the formatter has a round-trip. This is the same design pressure
that made the separate properties module in [02c](02c-what-to-do-about-it.md) require separable
domain code, arriving from a different direction.

**★ Two properties that assert the same relation from opposite ends are one property, and reviewers count them as two.**
`sortingProducesASortedList` and `theOutputIsNeverUnsorted` are the same claim. Property suites
grow this way, because each relation reads like a new idea when you write it, and the suite's
runtime grows with the count while its strength does not. The number that matters is the number
of *distinct relations* over a class; four good ones will usually exhaust an ordinary domain
object.

**★ Generalising an example test's postcondition can silently widen the domain past what the code promises.**
`discount(100, GOLD) == 90` generalises to "the output is never larger than the input" — true.
It does not generalise to "the output is never larger than the input, for any customer tier and
any amount", because the amount is now generated and may be negative, and a refund was never in
scope. The generalisation step is where you must go back to the specification: widen the
assertion and the generator together, or constrain the generator to the domain the code actually
claims.

## Interview questions

**★ Defend a property with no assertions in code review.**
It has an assertion; it is just not written with `assertThat`. The claim is that the method is
total over its declared input type — that for every `String` the type system allows, `parse`
either returns or throws the one exception it documents. That claim is violated constantly, by
`substring` with an unchecked index, by `charAt(0)` on an empty string, by `Integer.parseInt` on
something that came off a queue, and every one of those reaches production as a 500 rather than
a 400. An example-based suite cannot make this claim, because it only ever names inputs somebody
thought of, and the failing inputs are by definition the ones nobody thought of. I would make it
explicit in review by naming the method for the claim and catching the documented exception by
its exact type — never a supertype, because catching `Exception` is how this property gets
quietly disabled.

**★ You are asked to add properties to a legacy service class with a hundred methods and no tests. Where do you start?**
Not with the hundred. I run the checklist over the class's public surface looking for the two
cheapest wins: anything with an inverse nearby, and anything taking a `String` from outside the
process. The first gives me round-trip properties that are three lines each and immediately
valuable; the second gives me totality properties that are one line each and, on legacy code
with no tests, tend to go red on the first run. Both are safe to add to code I do not understand
yet, because neither requires me to know what the right answer is — which is the situation I am
actually in. Everything else waits until I have read enough of the class to state a law, and
some of it will never get a property, because a method that dispatches on a config flag and
calls three collaborators has no law, only behaviour. That is
[11 · Where it does not pay](11-where-it-does-not-pay.md), and saying so is better than forcing
a property that restates the code.

**★ What does it mean when you cannot find a single property for a class, and what would you do about it?**
Usually one of three things, and they have different responses. It may be that the class is
pure orchestration — fetch, map, call, return — in which case there is genuinely no law and the
right tests are a slice test and a couple of examples; forcing a property here produces the
implementation-restating tautology that [12 · The cost](12-the-cost.md) warns about. It may be
that the class mixes computation with I/O, in which case the property exists but is unreachable,
and the fix is an extraction that I would have wanted anyway. Or it may be that the domain rules
themselves are unstated — nobody can tell me whether two discounts commute — in which case the
inability to write a property is a finding about the specification rather than about the code,
and it is worth raising as one. The failure mode I want to avoid is the fourth response:
inventing a law that sounds plausible, asserting it, and encoding a guess about the domain as a
build gate.

**★ How is a totality property different from fuzzing?**
In scale, integration and intent rather than in kind. A fuzzer runs for hours, mutates a corpus,
is guided by coverage feedback, and is looking for crashes and memory-safety failures in code
that parses hostile input. A totality property runs for a second inside your unit suite, uses a
structured generator rather than a mutation engine, and is looking for the same class of failure
at a much shallower depth. The property is not a substitute — if you are parsing untrusted
binary formats, you want a real fuzzer and a corpus. But the property costs one line, runs on
every commit, and shrinks its failing input to something you can read, which a fuzzer's
thousand-byte crash case does not. For ordinary business code taking strings from a web form,
the property is the right size of tool.

{/* FOOTER */}
