---
title: "jqwik keeps a file next to your build that remembers which properties failed and what they failed on, and that file is why a failing property sticks locally until you fix it and why the same property behaves like a fresh random run in CI — a difference nobody configures deliberately and almost everybody is surprised by"
sidebar_label: "07b · The failure database"
sidebar_position: 34
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Rerunning Falsified
> Properties*, *Optional @Property Attributes* (`afterFailure`) and *jqwik Configuration*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** The configuration block is reproduced from
> the guide's documented defaults; nothing below is the output of a run performed here.

**[07](07-reproducibility.md) covered the seed — the mechanism for replaying a run you choose to
replay. This page is about the replay that happens whether you ask for it or not. jqwik records
test-run results in a file, and on the next run a previously failed property does not start from
a fresh random seed: it starts from what broke it last time. That behaviour is the reason
property-based tests feel stable during a debugging session, and the reason they feel like a
different tool on a CI agent.**

## The file

```properties
jqwik.database = .jqwik-database    # The database file in which to store data of previous runs.
                                    # Set to empty to fully disable test run recording.
jqwik.failures.runfirst = false     # Set to true if you want to run the failing tests from the
                                    # previous run first
```

`.jqwik-database` sits in the working directory of the test run. It is build output, not source:
**add it to `.gitignore`.** Committing it means sharing one developer's failure history with the
team and, worse, with CI — where it will make a previously failing property start from a sample
that may no longer exist in the current generator.

`jqwik.failures.runfirst = true` is the underused half of this feature. During a debugging session
on a large suite it puts the properties that failed last time at the front of the run, so you find
out whether your fix worked in seconds rather than after the full suite.

## What happens on the run after a failure

> *"When you rerun properties after they failed, they will - by default - use the previous random
> seed so that the next run will generate the exact same sequence of parameter data and thereby
> expose the same failing behaviour. This simplifies debugging and regression testing since it
> makes a property's falsification stick until the problem has been fixed."*

That last clause is the design goal, and it is a good one: **a property that has failed keeps
failing until fixed**, rather than passing on the next run because the dice fell differently. The
four modes:

> - *"`AfterFailureMode.PREVIOUS_SEED`: Choose the same seed that provoked the failure in the
>   first place. Provided no arbitrary provider code has been changed, this will generate the same
>   sequence of generated parameters as the previous test run."*
> - *"`AfterFailureMode.RANDOM_SEED`: Choose a new random seed even after failure in the previous
>   run."* — with the warning: *"This might lead to a 'flaky' property that sometimes fails and
>   sometimes succeeds."*
> - *"`AfterFailureMode.SAMPLE_ONLY`: Only run the property with just the last falsified (and
>   shrunk) generated sample set of parameters."*
> - *"`AfterFailureMode.SAMPLE_FIRST`: Same as `SAMPLE_ONLY` but generate additional examples if
>   the property no longer fails with the previous sample."*

`SAMPLE_FIRST` is the one you want and the one you have: *"`AfterFailureMode.SAMPLE_FIRST` is the
default."* It gives the fastest possible feedback — the known-bad input runs first, so a still-broken
fix fails in one try — and then continues exploring, so a fix that only handles the pinned case
does not get a clean bill of health.

```java
@Property(afterFailure = AfterFailureMode.RANDOM_SEED)
void deliberatelyNotSticky(@ForAll("orders") Order order) { ... }
```

Project-wide, the key is `jqwik.failures.after.default`.

## ⚠️ A documented inconsistency about the default

The prose in *Rerunning Falsified Properties* says the default is to *"use the previous random
seed"*, and one of the guide's published report headers shows
`after-failure = PREVIOUS_SEED | use the previous seed`. The `@Property` attribute reference, the
configuration file's documented default (`jqwik.failures.after.default = SAMPLE_FIRST`) and
another published header (`after-failure = SAMPLE_FIRST | try previously failed sample, then
previous seed`) all say `SAMPLE_FIRST`.

**I could not settle from the documentation which statement is current** — the most likely reading
is that the prose describes older behaviour, since `SAMPLE_FIRST` falls back to the previous seed
anyway and the two descriptions are not in conflict about *outcome*. The way to find out for your
project is not to reason about it: **read the `after-failure` line in your own run's report
header**, which prints the effective value. That line exists for exactly this purpose, and it is
the reason the header is worth reading on green runs too
([03b · Reading the failure report](03b-reading-the-failure-report.md)).

## The CI difference

`SAMPLE_ONLY` carries a caveat that turns out to be the practical key to the whole feature:

> *"This only works if generation and shrinking will still lead to the same results as in the
> previous failing run. If the previous sample cannot be reproduced the property will restart with
> the previous run's random seed."*

Two conditions have to hold for after-failure behaviour to do anything: **there has to be a
database file from a previous run, and the sample in it has to still be reproducible.** On a CI
agent with a fresh workspace, neither holds. There is no `.jqwik-database`, so there is no
previous failure, so every property starts from a fresh random seed on every build.

That is the correct behaviour for CI — you want the pipeline exploring new inputs, not replaying
one developer's old failure — but it explains a pattern that otherwise looks like flakiness:

- **Locally**, a failing property fails again immediately and keeps failing until fixed.
- **In CI**, the same property may pass on the next build and fail again three builds later.

Nothing is flaky. The local behaviour is the database doing its job, and the CI behaviour is a
thousand fresh tries finding a bug that lives in a region of the input space it does not always
visit. The fix for the CI case is not to make the run sticky — it is to pin the failing value as a
permanent case ([08 · Edge cases, exhaustive and data](08-edge-cases-exhaustive-and-data.md)), so
it is checked on every build by construction rather than by memory.

## Where this connects

- The seed itself, fixing it deliberately, and `FixedSeedMode` are
  [07 · Reproducibility](07-reproducibility.md).
- The `after-failure` line in the report header — how to read the effective value rather than
  reason about it — is [03b · Reading the failure report](03b-reading-the-failure-report.md).
- Turning a remembered failure into a permanent, committed regression case is
  [08 · Edge cases, exhaustive and data](08-edge-cases-exhaustive-and-data.md).
- Why the "shrunk sample" this file stores may not be reproducible after a generator change is
  [06 · Shrinking](06-shrinking.md).

## Gotchas

**★ `.jqwik-database` is build output and belongs in `.gitignore`; committing it exports one developer's failure history to everyone else's build.**
It is created silently in the working directory, so it turns up in `git status` at an unrelated
moment and gets swept into a commit with everything else. The consequence is not cosmetic: another
developer's checkout, and CI, will then start previously-failed properties from a stored sample
rather than from fresh generation, and the samples may not even be reproducible under their
version of the generator. The failure mode is a build behaving differently for reasons that are
not in any source file anyone reads.

**★ A property that "keeps failing no matter what I change" may be replaying a stored sample from before your fix.**
`SAMPLE_FIRST` runs the last shrunk input first. If your change did not address that specific
input, the very first try fails — instantly, before any new generation happens — which reads as
"my fix did nothing" even when the fix is correct for every other case. Distinguish the two by
looking at whether the reported sample is byte-identical to the previous run's. Deleting
`.jqwik-database` is the blunt way to check; it also throws away every other property's history,
so prefer reading the report first.

**★ Conversely, a property that goes green after a fix has only proven itself against the stored sample if the run stopped there — and `SAMPLE_ONLY` is exactly that trap.**
`SAMPLE_ONLY` runs *only* the previously failing input. Green means "this one case is fixed", not
"the property holds", and the report's `tries` count is the tell — a handful rather than a
thousand. `SAMPLE_FIRST` exists to avoid precisely this and is the default for that reason.
`SAMPLE_ONLY` is defensible while iterating on a hard fix and is not something to leave in place.

**★ CI has no failure history, so "it passed on retry" means something completely different there than locally — and treating it as flakiness is how a real bug gets closed.**
A fresh agent has no `.jqwik-database`, so a re-run is a genuinely new set of a thousand inputs. A
property that failed and then passed on retry has not been "fixed by the retry"; it has explored a
different region. The instinct trained by flaky integration tests — retry, green, move on — is
exactly wrong here, and it is worth saying explicitly to a team adopting jqwik, because the retry
button is right there and the seed in the failed build's log is the thing that will still be true
tomorrow.

**★ `RANDOM_SEED` is documented as producing a property that "sometimes fails and sometimes succeeds", which is a description of what you are opting into, not a caveat to work around.**
There is a legitimate use — a long-running exploratory suite where you *want* independent runs
rather than a property stuck on one input — but it removes the property's ability to hold a
failure. If someone reaches for it because a failing property is "annoying during the sprint",
that is the tool being asked to forget a bug, and the mode's own documentation says so in plain
words.

**★ A fixed `seed` attribute overrides all of this, silently.**
The attribute reference is explicit: *"If the seed for this property has been fixed, the fixed
seed will always be used."* So a property left with a debugging seed does not merely stop
exploring — it also stops participating in the after-failure mechanism entirely, including the
`SAMPLE_FIRST` fast feedback that the rest of the suite gets. Two behaviours lost for one
forgotten attribute, which is the argument for `jqwik.seeds.whenfixed` covered in
[07 · Reproducibility](07-reproducibility.md).

**★ `jqwik.failures.runfirst` defaults to `false`, so the most useful half of the database is off until someone turns it on.**
The database already knows which properties failed last time; `runfirst` is what makes it reorder
the suite to run those first. On a suite where the properties are spread across many classes, that
is the difference between a five-second answer and a full run before you learn whether your fix
worked. It costs nothing when nothing has failed, and it is a one-line addition to
`junit-platform.properties`.

## Interview questions

**★ Why does a failing jqwik property keep failing locally, but seem intermittent in CI?**
Because jqwik records run results in a `.jqwik-database` file in the working directory, and the
default after-failure behaviour replays the last shrunk failing sample before generating anything
new. Locally that file persists between runs, so a failure sticks until it is genuinely fixed —
which the guide names as the design goal, that it *"makes a property's falsification stick until
the problem has been fixed"*. A CI agent starts with a clean workspace, so there is no database,
no stored sample, and every build is a fresh thousand tries against a fresh seed. The property
that fails one build in five is not flaky; it is finding a bug in a region of the input space that
a thousand random draws do not always reach. The right response is not to make CI sticky — you
want the pipeline exploring — but to take the shrunk sample from the failing build and pin it as an
explicit case, so from then on it is checked deterministically on every run rather than
rediscovered by luck.

**★ What is the difference between `SAMPLE_FIRST` and `SAMPLE_ONLY`, and why is the default the one it is?**
Both start from the last shrunk failing input, which gives you the fastest possible signal on
whether a fix worked — one try rather than a thousand. `SAMPLE_ONLY` stops there. `SAMPLE_FIRST`
carries on generating new inputs once the stored sample passes, which is the whole difference:
`SAMPLE_ONLY` can tell you that one specific input is fixed and nothing more, and a green run
under it looks identical in a CI dashboard to a green run of a full property. `SAMPLE_FIRST` is
the default because it is the only one of the two that both gives fast feedback and preserves
what the property is for. Both share a documented limitation worth knowing: the stored sample has
to still be reproducible under the current generator, and if it is not, jqwik falls back to the
previous run's seed rather than failing — so a generator change quietly degrades this mechanism
from "replay the exact input" to "replay the sequence", which is the weaker guarantee.

**★ Should `.jqwik-database` be committed?**
No — it is build output, like a coverage report or a compiled class, and it belongs in
`.gitignore`. Committing it publishes one machine's failure history to every checkout and to CI,
where properties would then start from stored samples that may not be reproducible under whatever
the generator looks like on that branch. The behaviour of the build then depends on a binary file
nobody reads, which is the specific kind of surprise that costs a morning. If a failing case is
important enough to travel with the code, the way to travel with the code is an explicit pinned
example in the test source, where it is reviewable — not a cache that happens to remember it.

{/* FOOTER */}
