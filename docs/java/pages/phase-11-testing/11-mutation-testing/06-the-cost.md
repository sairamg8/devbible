---
title: "Mutation testing runs your test suite once per surviving mutant, which makes it the most expensive tool in this phase by an order of magnitude — and the honest verdict is not that it is too slow to use, but that it is too slow to use the way people first try to use it, which is across the whole codebase on every push"
sidebar_label: "06 · The cost"
sidebar_position: 37
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against **pitest's own documentation** — the
> [FAQ](https://pitest.org/faq/) (the *"PIT is taking forever to run"*, *"How does PIT choose
> which tests to run?"*, *"I'm seeing a lot of timeouts"* and determinism entries) and the
> [Maven quick start](https://pitest.org/quickstart/maven/).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** There are **no timings, no mutation scores and
> no run durations** on this page. Every quantitative statement below is either quoted from
> pitest's documentation or is arithmetic over the mechanism it describes.

**Every other tool in this phase costs you one test run. This one costs you a test run per
mutant, and a real class produces dozens of mutants. That is the whole objection, pitest states
it without flinching, and the answer is not a faster machine — it is running it over less code,
less often, and in the one place where it repays the wait.**

## Why it is expensive, stated by its own documentation

> *"Mutation testing is a computationally expensive process and can take quite some time
> depending on the size of your codebase and the quality and speed of your test suite. PIT is
> fast compared to other mutation testing systems, but that can still mean that things will take
> a while."*

The mechanism makes the cost unavoidable. For each mutant, the tests that cover the mutated line
must actually run — a mutant is only *killed* by a test failing. So the bill is roughly

> **(number of mutants) × (runtime of the covering tests for each)**

and the first factor grows with the size of the code while the second grows with the slowness of
your suite. **Both multiply, and slow tests are punished twice**: once in the ordinary suite, and
again for every mutant they cover.

## The four things pitest already does to make it survivable

None of these need configuring — knowing they exist stops you optimising the wrong thing.

**Mutants are inserted without restarting the JVM.**

> *"Pitest inserts mutants into a jvm by re-writing the class after it has loaded. This is orders
> of magnitude faster than starting a new jvm or creating a new classloader"*

⚠️ With a documented consequence that is a correctness caveat, not a performance one: *"code in
static initializer blocks is not re-run so the mutants have no effect."*

**Uncovered code is nearly free.**

> *"Due to the way PIT picks which tests to run, there is little or no execution time cost for
> mutations on lines that have no test coverage."*

So the fear that pitest wastes hours on untested legacy code is misplaced. It is the
*well-covered* code that costs, which is the opposite of most people's intuition.

**Only the covering tests run, ordered fastest-first.**

> *"Per test case line coverage information is first gathered and all tests that do not exercise
> the mutated line of code are discarded. The remaining tests are then ordered by increasing
> execution time"*

Ordering matters because the run stops at the first kill: a fast test that kills the mutant means
the slow ones never execute.

**Naming conventions are used as a heuristic.**

> *"test cases that belong to a class that is identified as a unit test for the mutated class are
> however weighted above other tests"* — a class matching *"the standard JUnit naming convention
> of `FooTest` or `TestFoo`"*.

> *"PIT does not require that your tests follow this naming convention in order for it to work.
> Test names are used only as part of a heuristic to optimise run order."*

So `FooTest` is not required and is worth having anyway: it is free ordering information.

## The levers, in the order pitest itself lists them

> *"You may be able to speed things up by … Using the Arcmutate accelerator plugin · Using more
> threads. The optimum number will vary, but will generally be between 1 and the number of CPUs
> on your machine. · Limit the number of mutations per class. This will give you a less complete
> picture however. · Use filters to target only those packages or classes that are currently of
> interest"*

And then the sentence that is really the answer:

> *"The most effective way to use mutation testing is usually to limit analysis to the code that
> you are changing."*

**That is the verdict of this chunk.** Mutation testing over a whole codebase on every push is a
misuse of it. Mutation testing over the diff, in a pull request, is a tool that fits inside a
normal review cycle — and pitest notes that *"Tooling is available to integrate pitest into pull
requests."* The scoping mechanics are **the incremental and scoping chunk of this topic**.

## The trap that wastes hours before a single mutant runs

> *"One thing to watch out for that can slow PIT down are tests on the classpath that are not
> normally run. Some teams have very slow exhaustive tests or performance tests that are not run
> by their build scripts. As PIT examines the entire classpath it will try to run these so may
> not even start running mutations for several hours. These tests can be excluded using the
> `excludedClasses` option."*

🔴 **Read that twice before concluding pitest is unusably slow on your project.** The symptom —
a run that appears to hang before producing any output — looks like the tool being slow and is
actually the tool running tests your build never runs. It is the single highest-value
configuration change on a legacy codebase.

## Timeouts: a cost that also costs you accuracy

Pitest detects infinite-loop mutants by timing:

> *"In order to detect infinite loops PIT measures the normal execution time of each test without
> any mutations present. When the test is run in the presence of a mutation PIT checks that the
> test doesn't run for any longer than `normal time * x + y`"*

And is candid that the model is imperfect:

> *"Test times can vary due to the order in which the tests are run. The first test in a class may
> have an execution time much higher than the others as the JVM will need to load the classes
> required for that test … PIT may therefore incorrectly flag the mutation as causing an infinite
> loop."*

The remedy is documented — *"try increasing `y` … to a large value with `--timeoutConst`
(`timeoutConstant` in maven)"* — and the reason this belongs on a cost page is that timeouts are
**expensive twice**: the mutant burns the full timeout window, and *"these require starting a new
jvm."*

## What this does to determinism

> *"Given the same input Pitest will always generate the same mutants, and (with a couple of
> caveats) will always produce the same results."*

The caveats are both cost-shaped. Timeout measurements *"can be affected by external factors
(other processes on the machine etc), so a mutant may be detected as timed out on one run, but
killed or surviving on another"*, and static initialisers can produce small run-to-run
differences. 🔴 **So a mutation score is not a stable number, and a build gate on an exact
threshold will flap** — which is the argument made in the thresholds chunk of this topic.

## Where this connects

- What the numbers in the report actually mean is
  [04 · Reading a report](04-reading-a-report.md), and the mutants that can never be killed are
  [04b · Equivalent mutants](04b-equivalent-mutants.md).
- Scoping a run to changed code — the lever that decides whether this tool is usable — is **the
  incremental analysis and scoping chunk of this topic**.
- Why coverage could not answer the question in the first place is
  [09 · Coverage with JaCoCo](../09-jacoco/README.md).
- The other technique for finding what your tests do not check, from the input side, is
  [10 · Property-based testing](../10-property-based/README.md) — and its own cost argument, which
  has the same shape at a smaller scale, is
  [12 · The cost](../10-property-based/12-the-cost.md).

## Gotchas

**★ A pitest run that seems to hang before producing output is usually running tests your build never runs.**
Pitest examines the whole classpath, so an exhaustive or performance test class that your build
script quietly excludes will be found and executed — and pitest says such a run *"may not even
start running mutations for several hours"*. The fix is `excludedClasses`, and the diagnosis is
to look at what is on the test classpath rather than at pitest's settings. Teams abandon the tool
at this exact point, having concluded it is too slow, when it never got as far as mutating
anything.

**★ Well-covered code is what costs, not legacy code with no tests — which is the reverse of what everyone assumes.**
Because mutations on uncovered lines have *"little or no execution time cost"*, pointing pitest
at a neglected package is cheap and produces a wall of `NO_COVERAGE` that tells you nothing you
did not know. Pointing it at your best-tested service is expensive and is the only place it can
tell you something new. Budget accordingly, and do not use "we'll try it on the legacy module
first" as the pilot — it is the cheapest run and the least informative.

**★ Slow tests are charged twice, and mutation testing is the first tool that makes that visible.**
An integration test that takes two seconds costs two seconds in the ordinary suite and two
seconds again for every mutant on every line it covers. The practical consequence is that pitest
is a very expensive way to discover that your unit tests are secretly integration tests. If a
mutation run is intolerable, the finding is usually about the suite rather than about pitest, and
fixing it improves the ordinary build too.

**★ The mutation score is not deterministic, so an exact-threshold build gate will flap.**
Pitest states that it *"works hard to be fully deterministic"* and then names two caveats, and
timeouts are the one that bites: the same mutant *"may be detected as timed out on one run, but
killed or surviving on another"*, because the measurement is affected by other processes on the
machine. A CI gate at a precise number will therefore fail occasionally for no code reason, which
teaches the team to re-run red builds — the worst habit a suite can teach.

**★ `--timeoutConst` is a correctness lever disguised as a performance one.**
Raising it makes the run slower in the worst case and makes the results *right*, because the
false timeouts it removes were being reported as though they were findings. If a report shows
many `TIMED_OUT` mutants, treat that as a measurement problem to fix before reading anything else
in the report, not as a property of the code.

**★ "Limit the number of mutations per class" buys speed by making the report lie by omission.**
Pitest offers the lever and immediately qualifies it: *"This will give you a less complete
picture however."* A capped run produces a score that is not comparable with an uncapped one and
not comparable between classes, so it is a debugging convenience rather than a metric. If you cap
it, do not put the resulting number on a dashboard.

**★ Threads help up to the core count and not beyond, and the optimum is not the core count.**
The documentation is deliberately vague — *"The optimum number will vary, but will generally be
between 1 and the number of CPUs on your machine"* — because mutation runs are memory- and
classloading-bound as well as CPU-bound. Setting threads to the core count on a CI agent that is
already sharing a machine is a reliable way to make the run slower and the timeouts less
accurate at the same time.

## Interview questions

**★ Mutation testing sounds great in principle. Why doesn't everyone run it?**
Cost, and it is inherent rather than an implementation flaw. Killing a mutant means running the
tests that cover the mutated line and seeing one fail, so the bill is the number of mutants times
the runtime of their covering tests — and a real class produces dozens of mutants. Pitest is
honest about this and does a lot to soften it: mutants are inserted by rewriting the loaded class
rather than starting a new JVM, which it calls orders of magnitude faster; only the covering tests
run; those are ordered fastest-first so the run stops at the first kill; and mutations on
uncovered lines are nearly free. Even with all that, a whole-codebase run on every push is not
viable for most projects, and pitest's own FAQ says the most effective use is to limit analysis
to the code you are changing. So the answer to "why doesn't everyone run it" is that the people
who succeed with it do not run it the way everyone first tries to — they run it over a diff, in a
pull request, where the wait fits inside a review.

**★ A team says pitest hangs on their project and produces nothing. What do you check first?**
The test classpath, not the pitest configuration. Pitest examines the whole classpath and will
run tests your build script quietly skips — exhaustive suites, performance tests — and its FAQ
says such a run may not start mutating for several hours. That presents exactly as a hang. The
fix is `excludedClasses` for those classes. I would check that before anything else because it is
the one failure mode where the tool looks broken and the cause is entirely outside it. After
that, I would scope the run to a package or to changed classes rather than the whole codebase,
and only then look at threads — and I would be cautious there, because the documented optimum is
somewhere between one and the core count, and over-threading on a shared CI agent makes the
timeout heuristic less accurate as well as the run slower.

**★ Would you gate a build on mutation score?**
Not on an exact threshold, because the number is not stable enough to carry that weight. Pitest
says it works hard to be deterministic and then names timeouts as a caveat: the same mutant can
be timed out on one run and killed or surviving on the next, because the detection compares
execution times and those are affected by other processes on the machine. A gate at a precise
figure will therefore fail sometimes for no code reason, and the lesson the team learns is to
re-run red builds, which is corrosive. What I would gate on instead is the diff: no new surviving
mutants in the code this pull request changed. That is a question with a stable answer, it scopes
the run to something that finishes inside a review cycle, and it targets the moment when the
information is actually actionable — while the author still remembers why the code is the way it
is.

{/* FOOTER */}
