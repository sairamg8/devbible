---
title: "A property that fails on one run in fifty is not flaky in the way a bad integration test is flaky — it is a property doing its job, and the seed printed in its report is the difference between a bug you can reproduce on demand and a rumour, provided you understand the one condition under which a seed stops reproducing anything"
sidebar_label: "07 · Reproducibility"
sidebar_position: 33
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Optional @Property
> Attributes* (`seed`, `whenFixedSeed`, `afterFailure`), *Failure Reporting*, *Rerunning
> Falsified Properties*, *jqwik Configuration* and *Using Arbitraries outside of Properties*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** The report header blocks below are
> reproduced from the guide's own published examples and labelled as such; no seed, timing or
> count here came from a run performed here.

**The objection to property-based testing that lands hardest in a review is "so the test does
something different every time?" — and the honest answer is yes. What makes that acceptable
rather than reckless is that every run prints the number needed to replay it exactly. jqwik's
reproducibility story is three mechanisms that people routinely confuse: the seed, which replays
a run; the failure database, which replays a *sample*; and a fixed `seed` attribute, which is a
different thing again and mostly a mistake to commit.**

## Every run tells you how to repeat it

The report header is printed on success as well as failure, and its last line is the whole
mechanism — quoted from the guide's own example output, not run here:

```text
tries = 1000                  | # of calls to property
checks = 1000                 | # of not rejected calls
generation = RANDOMIZED       | parameters are randomly generated
after-failure = PREVIOUS_SEED | use the previous seed
when-fixed-seed = ALLOW       | fixing the random seed is allowed
edge-cases#mode = MIXIN       | edge cases are generated first
edge-cases#total = 0          | # of all combined edge cases
edge-cases#tried = 0          | # of edge cases tried in current run
seed = 1685744359484719817    | random seed to reproduce generated values
```

> *"`String seed`: The random seed to use for generating values. If you do not specify a values
> jqwik will use a random random seed. The actual seed used is being reported by each run
> property."*

That is the contract: **a random seed by default, always reported.** So a CI failure that nobody
can reproduce locally is not an unreproducible failure — it is a failure whose seed was in the
log the whole time. Getting teams to *keep* full test output is a bigger obstacle than anything
technical here, and it is worth checking that your CI does before you need it.

## Replaying a run: the `seed` attribute

```java
@Property(seed = "1685744359484719817")
void theOneThatFailedInCi(@ForAll("orders") Order order) { ... }
```

The same seed regenerates the same sequence of parameter sets — with one condition the guide
states in passing and which is the single most important sentence on this page:

> *"Provided no arbitrary provider code has been changed, this will generate the same sequence of
> generated parameters as the previous test run."*

**A seed is not a value. It is an index into a generator.** Change the generator — widen a range,
add a `filter`, reorder the arguments of `Arbitraries.of`, change a `@Provide` method three
levels down — and the same seed produces a completely different sequence. This is not a defect;
it is what "integrated" means, and it follows from the generator pipeline being what shrinking
and generation both walk ([06 · Shrinking](06-shrinking.md)). But it means the workflow
"reproduce with the seed, then fix the generator, then re-run with the seed to confirm" is
incoherent: the second run is not testing the same thing. Confirm a fix by re-running the
property normally, or by pinning the actual failing value
([08 · Edge cases, exhaustive and data](08-edge-cases-exhaustive-and-data.md)).

## `FixedSeedMode` — the guard against committing a seed

A fixed seed is a debugging tool that looks exactly like a permanent test setting, and it is
committed by accident often enough that jqwik ships a control for it:

> - *"`FixedSeedMode.ALLOW`: Just use the seed."*
> - *"`FixedSeedMode.WARN`: Log a warning."*
> - *"`FixedSeedMode.FAIL`: Fail this property with an exception."*
>
> *"This can be useful to prevent accidental commits of fixed seeds into source control. The
> default is `ALLOW`, which can be overridden in `junit-platform.properties`."*

```properties
jqwik.seeds.whenfixed = FAIL
```

**This is the single highest-value line of jqwik configuration for a team.** A committed fixed
seed converts a property into an expensive example-based test that no longer explores anything,
and nothing about the code shows it: the `@Property` still reads as though it checks a thousand
cases, and the report still says `tries = 1000`. `WARN` for a codebase adopting jqwik, `FAIL` for
one that has adopted it.

⚠️ Note the interaction with the after-failure behaviour, stated in the same reference:
*"If the seed for this property has been fixed, the fixed seed will always be used."* A fixed
seed overrides everything else on this page.

## Arbitraries outside a property

Reproducibility also applies to generator code used from ordinary tests — building a fixture,
for instance. That path has its own lifecycle, and the guide flags a resource problem with using
arbitraries naked:

> *"some generators are expensive to create and will therefore be cached. Other generators require
> some data persistence across generation iterations to work as expected. All this data will fill
> up your heap space and never be released, because jqwik cannot know, if you're done with using
> a specific generator or not."*

The remedy is `JqwikSession`, described as *"an experimental API that allows you to simulate a
small part of jqwik's property lifecycle"*, and it carries the seed control you need:

```java
JqwikSession.run("42", () -> {
    Order order = orders().sample();      // reproducible fixture
    // … an ordinary JUnit test that happens to use a generator
});
```

`JqwikSession.start(String randomSeed)` and `JqwikSession.run(String randomSeed, Runnable)` fix
the seed for the session; `finish()` releases the caches. ⚠️ The API is **experimental**, and it
has three documented limits: *"there's currently no way to use nested sessions, spread the same
session across threads or use more than one session concurrently."*

## Where this connects

- What happens to a property on the run *after* it failed — the failure database, the four
  `AfterFailureMode` values, and why CI behaves differently from your laptop — is
  [07b · The failure database](07b-the-failure-database.md).
- The report header these values are printed in, line by line, is
  [03b · Reading the failure report](03b-reading-the-failure-report.md).
- The other `@Property` attributes and their project-wide defaults are
  [03c · Attributes and defaults](03c-attributes-and-defaults.md).
- Turning one reproduced failure into a permanent regression case is
  [08 · Edge cases, exhaustive and data](08-edge-cases-exhaustive-and-data.md).
- Why changing a generator invalidates a seed follows from integrated shrinking and generation
  sharing a pipeline — [06 · Shrinking](06-shrinking.md).

## Gotchas

**★ A seed reproduces a run only while the generator is untouched, so the "reproduce, fix, re-verify with the same seed" loop verifies nothing after the first edit to a `@Provide` method.**
The guide's condition is *"Provided no arbitrary provider code has been changed"*, and it is
easy to violate without noticing — the change might be in a shared provider used by twenty
properties, or in a domain class whose constructor a generator calls. The failure mode is
comfortable rather than loud: the property passes, you conclude the bug is fixed, and it is
simply not being generated any more. Verify a fix against the pinned failing *value*, not
against the seed.

**★ A committed fixed seed silently converts a property into a single example, and the report still says `tries = 1000`.**
Every one of those thousand tries is the same sequence, every run, forever. The property still
looks like it explores; the header even prints `when-fixed-seed = ALLOW` as though that were
reassurance. Nothing fails, nothing warns, and the test's value quietly drops to that of one
hand-written case — with a thousand times the runtime. `jqwik.seeds.whenfixed = FAIL` is the
only reliable defence, because code review does not catch a one-word annotation attribute
reliably.

**★ `seed` is a `String`, not a `long`, and pasting a negative seed from a report is where people slip.**
Reports print values like `seed = -2370223836245802816`. The attribute takes them as text —
`@Property(seed = "-2370223836245802816")` — so the minus sign and the quoting both have to
survive the copy. A truncated or mistyped seed does not error; it is simply a different seed,
and you get a different run that does not reproduce the failure, which reads as "the seed
doesn't work" rather than "I mistyped it".

**★ The seed is printed on passing runs too, and CI configurations that suppress successful-test output throw away the only thing that would have let you replay an intermittent failure's neighbourhood.**
The header block is not a failure artefact. Teams that configure their build to print only
failures lose the seeds of the runs that passed — which matters when you are chasing something
that fails one run in fifty and want to know what the other forty-nine explored. On Gradle the
guide notes you need `--info` to see jqwik's reports at all.

**★ Seeds do not survive a change of jqwik version any more reliably than a change of generator, and nothing warns you.**
The guarantee documented is about *your* provider code, not about jqwik's internals. Generation
strategy, edge-case injection and the random-value pipeline are implementation, and a seed is an
index into that implementation. A seed pinned in a comment ("fails on seed X") is therefore a
note with an expiry date nobody records. Pin the value, keep the seed as a hint.

**★ `JqwikSession` is experimental and single-threaded, so using generators inside a parallel test suite is outside what the API supports.**
The three documented limits — no nesting, no sharing across threads, no concurrent sessions —
line up badly with JUnit's parallel execution, which is exactly what a team reaching for
generator-built fixtures at scale is likely to have turned on. There is no compile-time signal.
If you use generators outside properties in a parallel suite, keep each session strictly inside
one test method's thread, and treat the arrangement as provisional given the API's own status.

**★ Without a session, generators used outside properties leak — and the symptom is a slow heap climb across a long test run, not an error.**
The guide is explicit that cached generators and cross-iteration persistence *"will fill up your
heap space and never be released"*, because jqwik cannot know when you are finished with a
generator. In a suite of a hundred tests each building a fixture from an arbitrary, that is a
hundred retained generator caches. It presents as the test JVM needing more memory over time,
which gets diagnosed as anything but the fixture builder.

## Interview questions

**★ Someone objects that property-based tests are non-deterministic and therefore unsuitable for CI. How do you answer?**
I would agree with the premise and reject the conclusion. The generation *is* random by design —
that is the entire value, because a fixed set of examples only ever finds the bugs someone
already thought of. What makes it suitable for CI is that the randomness is seeded and the seed
is reported on every run, pass or fail, so any failure is replayable exactly. So the property is
non-deterministic across runs and perfectly deterministic given a seed. Two practical conditions
have to hold for that promise to be real, and both are about process rather than the library.
The build has to preserve full test output, or the seed goes in the bin with it — on Gradle that
can mean running with `--info`. And the team has to understand that a property failing on one run
and not the next is the tool working, not flakiness: it has found a bug in a region of the input
space it does not visit every time. The wrong response to that is fixing the seed, which trades
the tool's entire value for the appearance of stability.

**★ A property failed in CI. Walk me through reproducing it locally.**
First I take the seed from the report header, because that replays the whole run. I put it on the
property temporarily — `@Property(seed = "…")`, the attribute is a `String` so a negative value
keeps its sign — and run it locally, and I expect the same sequence of generated values and the
same failure. Then I take the shrunk sample from the report, because that is the actual minimal
input and it is what I will debug against and, later, pin as a regression case. The important
caveat is that the seed only holds while the provider code is unchanged, which the guide states
directly, so the seed is good for the reproduction step and worthless for the verification step.
Once I have edited anything in the generation path I confirm the fix against the pinned value and
by running the property normally, not by re-running with the seed — a green run under a stale
seed proves nothing. And the seed comes off before the commit, which is what
`jqwik.seeds.whenfixed` is there to enforce when someone forgets.

**★ Why would you set `jqwik.seeds.whenfixed = FAIL` on a project?**
Because a fixed seed is invisible in every place a reviewer looks. The annotation attribute is one
short word inside a line that already exists, the property still reads as though it explores a
thousand inputs, and the run report still prints `tries = 1000`. Meanwhile the test has become a
single example executed a thousand times — strictly worse than the hand-written test it replaced,
since it costs a thousand times as much and covers the same one case. The guide says the mode
exists *"to prevent accidental commits of fixed seeds into source control"*, which is exactly the
failure: nobody sets a permanent fixed seed on purpose, they set it while debugging and forget it.
`FAIL` turns a silent loss of coverage into a build error at the moment of the commit. I would
start a team on `WARN` while people are still learning the workflow and move to `FAIL` once the
habit of removing seeds is established.

**★ You need reproducible test data in an ordinary JUnit test and you want to reuse a jqwik generator to build it. What do you need to know?**
Two things, and one of them is a resource leak rather than a correctness issue. The seed control
is `JqwikSession.run(String randomSeed, Runnable)` or `JqwikSession.start(String randomSeed)`,
which fixes generation for that session so the fixture is the same every run. The leak is the
reason the API exists at all: outside a property there is no lifecycle telling jqwik when you are
done, so cached and stateful generators are retained — the guide says they *"will fill up your
heap space and never be released"* — and `finish()` is what releases them. Beyond that I would
flag its status honestly in review, because the guide calls it experimental and documents three
limits that matter in a modern suite: no nested sessions, no sharing across threads, no
concurrent sessions. In a parallel test suite that is a real constraint, and I would keep each
session inside a single test method rather than sharing one from a fixture class.

{/* FOOTER */}
