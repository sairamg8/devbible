---
title: "Twelve topics, and one argument running through all of them: a test is worth what its assertion is worth, and almost everything that makes a suite slow, flaky or useless is a consequence of getting one of four decisions wrong — the level, the isolation, the fidelity of the dependencies, and whether anything would notice if the code were wrong"
sidebar_label: "07 · What this phase taught"
sidebar_position: 38
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01. **This chunk makes no new technical claims.** It is the closing argument
> for phase 11 and every fact it refers to is verified on the topic page it points at — against
> the JUnit 6 user guide, the Mockito 5.23.0 javadoc, the AssertJ, Testcontainers, JaCoCo, jqwik
> and pitest documentation, and the Spring Framework 7.0.x / Boot 4.1 references, as cited there.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, **JUnit Jupiter 6.0.3**, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5.
> ⚠️ **No sandbox, no Docker and no build on this machine.** Nothing in this phase reports the
> output of a run.

**This is the last page of the phase. Twelve topics is a lot of API, and API is the part you can
look up — so what follows is the part you cannot: the four decisions that every test in a real
codebase turns on, what this phase established about each, and the shape of the argument you
should be able to make in a review two years from now when the specific annotations have all been
renamed again.**

## 1 · The level is a decision, and it is the expensive one

Nothing determines the cost of a test more than what it boots. A plain unit test constructs a
class. A slice starts a filtered application context. `@SpringBootTest` starts the whole thing. A
container test starts a database. Those differ by orders of magnitude, and the difference is paid
on every run, forever.

The phase's position, argued in [05 · The test pyramid](../05-the-test-pyramid/README.md), is
that the level should be chosen from **what the test needs to prove**, not from what is
convenient to write. The context cache is what makes slices affordable, and the number of
*distinct* context configurations — not the number of tests — is what governs suite runtime,
which is why a stray `@MockitoBean` or `@TestPropertySource` on one class can slow a whole build.

The corollary, from [06 · MockMvc](../06-mockmvc/README.md): a slice proves what is inside the
slice. `@WebMvcTest` genuinely exercises routing, binding, validation, content negotiation and
your exception handlers. It does not exercise your service, your SQL, or the filters you excluded
— and a test that reads like an end-to-end test while proving a slice is worse than one that
admits its boundary.

## 2 · Isolation is a design property, not a test setting

[04 · Mockito](../04-mockito/README.md) taught the mechanics and one rule that outlives them:
**mock at a boundary you own, never the class under test, never a value object.** Everything
awkward in test setup is information. A `final` class, a static call, `new` inside a method — the
difficulty of isolating the thing is telling you about its coupling, and
[12 · Real-world testing scenarios](../12-real-world-scenarios/README.md) spends a whole band
establishing that the five-line refactor is almost always cheaper than the machinery that avoids
it.

The version-specific corollary that will trip you up on every blog post you read:
🔴 **Boot 4 removed `@MockBean` and `@SpyBean`.** They are `@MockitoBean` and `@MockitoSpyBean`,
and they live in Spring Framework now, not Boot. Every stale answer on the internet is stale on
exactly this point.

## 3 · Fidelity: test against the real thing where the real thing has behaviour

[07 · Testcontainers](../07-testcontainers/README.md) exists to kill one sentence: *"it passed on
H2."* An in-memory approximation of a database agrees with the real one exactly until you use the
part you were actually worried about — a dialect-specific function, a locking mode, a constraint's
error code, a transaction isolation level.

But fidelity is bought, not free, and the phase is equally clear about the other direction:
[08 · Test data patterns](../08-test-data-patterns/README.md) exists because most tests do not
need a database at all, only a well-built object; and topic 12 argues that a property or a
mapping test at the pure layer beats an integration test that proves the same thing more slowly.
**Real dependencies where behaviour lives; no dependencies where it does not.**

## 4 · An assertion that cannot fail is not a test

This is the argument the phase builds to, and it takes three topics to make honestly.

[09 · Coverage with JaCoCo](../09-jacoco/README.md) establishes the limit: a probe records that
an instruction executed. **0% is a fact — nothing reached that code. 100% is a claim about
execution and never about checking.** A test with no assertions drives coverage to 100%.

[10 · Property-based testing](../10-property-based/README.md) attacks the gap from the input
side: the examples in your suite are the cases someone thought of, so the bugs live in the cases
nobody did. And it is honest about its own failure mode, which is the same failure mode in a new
costume — **a property whose assertion restates the implementation can never fail**, costs a
thousand executions per build, and shows as covered.

**This topic** attacks the gap from the other side. Change the code; see whether a test notices.
It is the only tool in the phase that answers *"do my assertions assert anything"* directly, and
it is the most expensive one in it, which is why [06 · The cost](06-the-cost.md) argues for
running it over a diff rather than a codebase.

## The three questions, in order, for any test you are about to write

1. **What must this prove?** Then pick the smallest level that can prove it.
2. **What is the boundary?** Mock what crosses one you own; let the rest run.
3. **Would this fail if the code were wrong?** If you cannot answer yes, the test is decoration —
   and the tools for checking your answer mechanically are topics 09, 10 and this one.

[12 · The checklist](../12-real-world-scenarios/12-the-checklist.md) is those three questions
turned into a routing table for the ticket actually in front of you.

## What the phase deliberately did not cover

Performance and load testing, contract testing between services with a broker in the middle,
UI-driven end-to-end testing, and chaos or fault-injection at the infrastructure layer. Some of
that belongs to later phases; the omission is a scope decision, not a claim that those do not
matter.

## Gotchas

**★ The phase's most durable advice is version-fragile, and the fragile parts are exactly the parts every tutorial gets wrong.**
`@MockBean` → `@MockitoBean` and the move into Spring Framework; JUnit resolving to **Jupiter 6**
under Boot 4.1 while every article says 5; `MockMvcTester` as the current idiom rather than plain
`MockMvc`. The reasoning in this phase outlives those renames, and the code samples will not.
When something does not compile, check what moved before concluding the argument is wrong.

**★ "We have 80% coverage" and "our tests are good" are different claims, and only one of them is measurable by the tool people quote.**
The coverage number is real and reads in exactly one direction. Teams that set an 80% target and
hit it have measured that 80% of instructions executed during a test run — which an assertion-free
test satisfies completely. If the team wants the other claim, the tools are mutation testing and,
for the input space, property-based testing, and both are more expensive precisely because they
answer the harder question.

**★ A green suite that nobody trusts is a worse position than a red one, and it is reached by adding tests without adding assertions.**
Every mechanism in this phase can be used to produce a test that passes and defends nothing: a
mock verified against itself, a slice that asserts a 200 and no body, a property that restates
the implementation, a container test whose assertion is `notNull`. The suite grows, the runtime
grows, the confidence does not, and eventually someone proposes deleting it. The defence is not
discipline, it is measurement — which is what this topic is for.

**★ The suite's runtime is dominated by context configurations, not by the number of tests, and this surprises people every time.**
A thousand tests sharing four application contexts are fast. Two hundred tests across forty
distinct context configurations are slow. Because the cache key is the configuration, a single
`@MockitoBean` added to one test class forks a new context for that class — so the change that
slows a build is often a one-line addition in a file nobody associates with performance.

## Interview questions

**★ You join a team whose test suite takes forty minutes and nobody trusts it. Where do you start?**
Not by adding tests, and not by deleting them either. First I would find out where the forty
minutes goes, and my prior is that it is context configurations rather than test count — a suite
where many classes each fork their own Spring context by adding one bean override or property
runs far slower than one where a thousand tests share four contexts. That is usually the largest
and least controversial win because it changes no assertions. Then the trust problem, which is a
different question: I would want to know whether the tests assert anything, and coverage cannot
tell me because an assertion-free test covers everything it touches. Mutation testing over a
recent diff answers it directly and cheaply enough to fit in a review, and what it finds is
usually concentrated — a few classes where every mutant survives, which are the ones to fix first.
The third thing is level: suites like that are typically full of tests that boot the whole
application to check something a plain unit test could prove, and moving those down is what makes
the runtime problem stop coming back.

**★ What is the single most important idea in this phase?**
That a test is worth what its assertion is worth, and that almost nothing else in the tooling can
compensate for a weak one. Everything else in the phase is downstream of it. The pyramid is about
paying the least to get an assertion that means something. Mocking is about isolating the thing
you are asserting on so the assertion is about it. Testcontainers is about making the assertion
true of the real database rather than an approximation. Coverage cannot see assertions at all,
which is why it reads in only one direction. Property-based testing widens the inputs the
assertion is checked against, and mutation testing is the only tool that checks the assertions
themselves. If I had to keep one habit from twelve topics, it would be asking "would this fail if
the code were wrong?" before writing the test, because that question is free and it eliminates
most of the ways a suite goes bad.

**★ How would you introduce mutation testing to a sceptical team?**
By scoping it so small that the objection cannot form. Not a whole-codebase run — that is the
version that takes hours, produces thousands of results and gets the tool banned. I would run it
over one recent pull request's changed classes, which pitest's own documentation recommends as the
most effective use, and bring the surviving mutants to the review as questions rather than as a
score: here is a change to this line that no test noticed, is that a case we care about? That
framing works because a surviving mutant is a concrete, falsifiable claim about a specific line,
which is much harder to dismiss than a percentage. I would keep it out of the build gate at first,
and if it ever became a gate it would be on the diff — no new surviving mutants in changed code —
rather than an absolute score, because the score is not stable enough to gate on: timeouts are
measured by comparing execution times, and pitest documents that the same mutant can time out on
one run and be killed on another.

{/* FOOTER */}
