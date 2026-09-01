---
title: "You cannot safely change code you cannot test and you cannot test this code without changing it, and the way out is not courage — it is a characterization test that records what the thing currently does, bugs included, written before you touch a line"
sidebar_label: "11 · The legacy class with no seams"
sidebar_position: 47
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Java Language Specification, Java SE 25** §12.4.1
> *When Initialization Occurs*
> ([docs.oracle.com](https://docs.oracle.com/javase/specs/jls/se25/html/jls-12.html)) and
> §13.1 on constant variables
> ([docs.oracle.com](https://docs.oracle.com/javase/specs/jls/se25/html/jls-13.html)); the
> **Mockito 5.23.0** javadoc §48 *static mocking*
> ([site.mockito.org](https://site.mockito.org/javadoc/current/org/mockito/Mockito.html));
> and the **Spring Framework 7.0.x** `AbstractJsonContentAssert` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/json/AbstractJsonContentAssert.html)).
> The refactoring vocabulary — *seam*, *characterization test*, *sprout method*, *extract and
> override* — is Michael Feathers', from *Working Effectively with Legacy Code* (2004),
> paraphrased rather than quoted.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**Every other chunk in this topic assumed you get to design the seam. This one is the honest
chapter: a ticket, a 900-line class with a static call in the middle of a method, no tests,
and a deadline. The order of operations matters more than any technique — you write a test
that records what the code does *today*, including behaviour you are fairly sure is a bug,
and only then do you introduce the smallest seam that lets you make the change you were
actually sent to make.**

## The dilemma, stated plainly

Changing untested code is unsafe. Testing this code requires changing it — extracting a
method, adding a constructor, making something non-static. So the first change is made
without the safety net that the change was supposed to buy. That is the trap, and the way
through it is to notice that the two changes are *different in kind*:

- **A behaviour change** — the thing the ticket asked for. Risky. Needs a test.
- **A structural change** — extract a method, add an overload, widen a visibility. Verified by
  the compiler, mechanically reversible, and provably behaviour-preserving if you do nothing
  else in the same step.

So the sequence is: characterize what you can reach → make the structural change alone → run
the characterization → make the behaviour change → run it again. Two commits minimum, and
the discipline that makes it work is that the two are never in the same one.

## A characterization test is not a specification

It records what the code does, not what it should do. That is a genuinely different activity
and it changes how you write the test.

```java
/**
 * Characterization tests for LegacyPricingEngine.
 *
 * These assert CURRENT behaviour, not correct behaviour. Several of them
 * encode bugs on purpose — see the test names. Do not "fix" a failing
 * assertion here without deciding, deliberately, that the behaviour change
 * is intended.
 */
class LegacyPricingEngineCharacterizationTest {

    @Test
    void appliesTenPercentToOrdersOverFiftyPounds() {
        assertThat(engine.priceFor(order(pounds(60)))).isEqualTo(pounds(54));
    }

    @Test
    void currentlyRoundsHalfDown_probablyWrong_see_PRICE_4412() {
        // £10.005 → £10.00. Almost certainly a bug; out of scope for this ticket.
        assertThat(engine.priceFor(order(pence(1001), discount(0.5))))
                .isEqualTo(pence(1000));
    }

    @Test
    void currentlyReturnsZeroForANullCustomer_ratherThanThrowing() {
        assertThat(engine.priceFor(orderWithNoCustomer())).isEqualTo(ZERO);
    }
}
```

Three things that are unusual compared to every other test in this topic:

- **The names describe the present tense**, not a requirement. `currentlyRoundsHalfDown` is
  better documentation than `roundsHalfDown` because it tells the next reader the assertion
  is evidence, not intent.
- **Known bugs are pinned deliberately**, with a ticket reference. A characterization test
  that "fixes" behaviour on the way past is not a safety net — it is a behaviour change
  hiding in a test file.
- **The comment at the top is part of the artefact.** Without it, someone six months later
  reads these as the specification and propagates the rounding bug into a rewrite.

## How you find out what it currently does, without a debugger

The mechanical technique: write the assertion with a value you know is wrong, run it, and let
the failure message tell you the actual. AssertJ's failure output names the actual value, so
one run per unknown converts a question into a fact. Then paste the real value in and confirm
it passes.

Two rules that keep this honest. **Do not assert on a value you have not looked at** — if the
actual is `-1` and you paste it in without asking why, you have pinned nonsense. And **do not
pin more precision than you understand**: if the method returns a 40-field object and you
only care about three fields, assert three fields. A characterization test that pins
everything will fail on the next unrelated change and be deleted by whoever is unlucky enough
to hit it.

For output too wide to hand-assert — a generated document, a big JSON response, a report —
the golden-master form of this is exactly the pinned-payload technique from
[10b](10b-volatile-fields-and-the-review-workflow.md), with one difference in intent that is
worth saying out loud in the test: those expected values may well encode bugs, and their
purpose is only to prove the refactor changed nothing.

## Characterize *narrowly*, and only where you are about to cut

The instinct is to characterize the whole class. Resist it: a 900-line class has hundreds of
behaviours, most of which you will never touch, and pinning them all costs days and buys
nothing except a large body of tests that will need updating by someone else.

Characterize:

1. **The behaviour you are about to change** — so you can prove you changed it.
2. **The behaviours that share state or code with it** — the ones that could break as
   collateral. Usually the other methods that touch the same field.
3. **The one path production most depends on** — the smoke test that says the class still
   basically works.

That is typically five to fifteen tests, not two hundred.

There is a tool for making that judgement instead of guessing. Run the characterization suite
under coverage and look at whether the lines you are about to edit are executed — that is
**topic 09 · JaCoCo**'s branch-versus-line distinction used for its one genuinely diagnostic
purpose. And if you want to know whether the assertions actually *constrain* those lines
rather than merely running them, that is **topic 11 · Mutation testing**: change the code
under the characterization suite and see whether anything fails. A characterization test that
survives mutation is a characterization test that will not catch your regression either.

## Where to attach the test when the class itself is untestable

Sometimes the class cannot be constructed at all in a test — it opens a connection in its
constructor, or reads a file, or needs a `ServletContext`. Before touching it, look one level
out. The pin does not have to be on the class; it has to be somewhere the behaviour is
observable and the setup is affordable:

| Where you pin | When it is the right level | Cost |
|---|---|---|
| The class's public method | it can be constructed | lowest |
| The service that calls it | the class is constructible only inside Spring | a slice test |
| The HTTP endpoint | the class is buried and the behaviour is user-visible | `@SpringBootTest` + [10](10-json-contracts-and-approval-tests.md)'s pinned payload |
| The database or file output | the behaviour is a side effect, not a return value | a container; **topic 07** |

Pinning further out is a weaker test — it constrains less and runs slower — but a weak
characterization test written today beats a strong one written after you have already broken
production. Take the outermost affordable pin, make the change, and tighten inwards once the
seam exists.

## Where this connects

- Three of the four seam problems — a static call, `new` inside a method and a god
  constructor — each with its smallest safe move:
  [11b · Three seams for a collaborator](11b-three-seams-for-a-collaborator.md).
- The fourth — configuration read at class-init — and the argument for when *not* to refactor
  at all: [11c · Class-init config and the fifth answer](11c-class-init-config-and-the-fifth-answer.md).
- The pinned-payload technique used as a golden master:
  [10b · Volatile fields and the review workflow](10b-volatile-fields-and-the-review-workflow.md).
- Collaborators that are hard to mock, and the refactors that remove the need for a trick:
  [02b · When the collaborator is hard to mock](02b-when-the-collaborator-is-hard-to-mock.md)
  and [02c · Construction and final classes](02c-construction-and-final-classes.md).
- Coverage as a diagnostic rather than a target: **topic 09**,
  [../09-jacoco/README.md](../09-jacoco/README.md).
- Whether the characterization assertions actually constrain anything: **topic 11 ·
  Mutation testing** *(index not written yet)*.
- Builders and object mothers that make constructing the legacy inputs bearable: **topic 08**,
  [../08-test-data-patterns/README.md](../08-test-data-patterns/README.md).

## Gotchas

**★ Fixing a bug you discovered while characterizing destroys the safety net you were building.**
The whole value of the suite is that it fails when behaviour changes. If your baseline already contains a change, then a subsequent failure cannot be attributed, and worse, the "fix" shipped without anyone deciding it should. Pin the bug, name the test so the next reader knows, raise a ticket, and fix it in its own commit afterwards — at which point the characterization test is exactly the thing that proves what you changed.

**★ A characterization test named like a specification will be read as one.**
`roundsHalfDown()` says "this is the rule". `currentlyRoundsHalfDown_probablyWrong_see_PRICE_4412()` says "this is the evidence". Six months later a rewrite team will read whichever you wrote and reproduce the behaviour accordingly. The naming is not cosmetic.

**★ Characterizing the whole class is the most common way this technique gets abandoned.**
Two hundred tests take days, most of them pin behaviour nobody will ever change, and the resulting suite fails constantly for reasons unrelated to anyone's ticket. Pin the change region, its state-sharing neighbours, and one smoke path. Everything else is speculative work priced as safety.

**★ Pasting a value from a failure message without understanding it pins nonsense as a contract.**
The mechanical loop — assert wrong, read the actual, paste it in — is efficient and it is also how a `null`, a `-1` or a truncated string becomes the documented expected behaviour of the system. Every pinned value needs a moment of "does that make sense", and the ones that do not need a comment saying so.

**★ Pinning every field of a wide return value guarantees the test fails for reasons that are not yours.**
Over-specification in a characterization test is worse than elsewhere, because the person who hits the failure will be someone with no context, and their cheapest resolution is deletion. Assert the fields relevant to the change region.

**★ Coverage of the change region is the question, and the overall coverage number cannot answer it.**
"The class is at 62%" tells you nothing about whether the eleven lines you are about to edit are among them. Run the characterization suite alone, with coverage, and look at those lines specifically. That is one of the few uses where the tool is genuinely diagnostic rather than a scoreboard.

**★ A characterization suite that passes under mutation is not protecting you.**
If the code can be changed without any test failing, the suite is executing the lines rather than constraining them — which is exactly the state a hastily-written characterization suite tends to be in, because it was written to record output rather than to pin behaviour. Mutation testing on the change region only is a bounded, affordable check.

**★ Structural and behavioural changes in one commit make the characterization test unattributable.**
If the extract-method and the logic change land together and something breaks, you cannot bisect the two. Worse, a reviewer cannot tell which lines are supposed to be behaviour-preserving. Two commits, always, and say which is which in the messages.

**★ The outermost pin can be so slow that it stops being run.**
An `@SpringBootTest` characterization suite that takes four minutes is a suite people skip locally and eventually tag out of CI. Take it as the temporary scaffold it is: pin outside, introduce the seam, move the tests inwards, delete the slow ones. Leaving them is how a suite acquires its permanent slow tail.

**★ Legacy code that has no tests often has no *stable* behaviour either.**
It may already depend on wall-clock time, on the default locale, on map iteration order, or on a database's arbitrary row order. The first characterization run is where you find that out, and the finding is not "the test is flaky" — it is that production behaviour is nondeterministic, which is usually more important than the ticket you came in with.

## Interview questions

**★ You are asked to change one behaviour in a 900-line untested class. What do you do first?**
Nothing to the class. First I find the smallest place the behaviour I have been asked to change is observable and affordable to test — ideally the class's own public method, but if the constructor opens a connection then the calling service, and if that is impossible then the HTTP endpoint. I write characterization tests there: assertions that record what the code does *today*, not what it should do, including anything I strongly suspect is a bug, with names that say "currently" and a comment at the top of the file explaining that these are evidence rather than specification. I check with coverage that those tests actually execute the lines I am about to edit, because "the class is at 60%" says nothing about my eleven lines. Only then do I make a structural change — an extracted method, an added constructor — as its own commit with no behaviour change in it, run the characterization suite to prove nothing moved, and finally make the change the ticket asked for as a second commit, where the suite tells me exactly what I altered.

**★ You find a bug while writing characterization tests. Do you fix it?**
Not in that commit, and usually not in that ticket. The characterization suite's only value is that a later failure means "you changed something"; if I bake a fix into the baseline, that property is gone and I have also shipped a behaviour change nobody asked for or reviewed. So I pin the buggy behaviour, name the test so it is unmistakable — `currentlyRoundsHalfDown_probablyWrong_see_PRICE_4412` — raise the ticket, and move on with what I was sent to do. The payoff comes later: when someone does fix it, the characterization test fails, and that failure is a precise, reviewable statement of what changed, which is the best possible situation to be in. The only case where I would fix immediately is a security or data-corruption issue, and then it is its own change with its own review, not a side effect of a test-writing session.

**★ How do you decide how much of a legacy class to characterize?**
By the blast radius of the change, not by the size of the class. Three concentric things get pinned: the behaviour I am about to change, so I can prove I changed it; whatever shares mutable state or code paths with it, because that is where collateral damage lands; and one representative end-to-end path, as a smoke test that the class still basically works. That is usually five to fifteen tests. Characterizing everything is the failure mode — it takes days, it pins hundreds of behaviours nobody will ever touch, and the suite then fails constantly for reasons unrelated to anyone's work, which is how it ends up deleted. If I want evidence rather than instinct about whether I have covered enough, I run the characterization suite under coverage and look specifically at the lines in the change region, and if I want to know whether the assertions actually constrain those lines rather than just executing them, I run mutation testing over just that region.

**★ What is the difference between a characterization test and a regression test?**
Intent, and it shows up in how you treat a failure. A regression test asserts required behaviour: if it fails, the code is wrong. A characterization test asserts observed behaviour: if it fails, *something changed*, and whether that is good or bad is a judgement call the failure is asking you to make. That difference has consequences. Characterization tests are allowed — required, even — to encode bugs, because their job is fidelity to the present, not correctness. Their names should be in the present tense so nobody mistakes them for requirements. They are scaffolding with a lifespan: once the seam exists and real unit tests are in place, most of them should be deleted or rewritten as specifications, and a codebase that has accumulated characterization tests it never converted has quietly turned "what it did in 2019" into "what it must do forever".

{/* FOOTER */}
