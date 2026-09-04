---
title: "\"It passed locally\" is not an excuse for a concurrency failure, it is a diagnosis — three specific differences between a laptop and a CI agent explain it, and each one tells you what to change before you can reproduce anything"
sidebar_label: "12f · Diagnosing a parallel failure"
sidebar_position: 46
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Parallel Execution"
> ([writing-tests/parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html))
> and "Capturing Standard Output/Error"
> ([running-tests/capturing-standard-output-error](https://docs.junit.org/6.0.3/running-tests/capturing-standard-output-error.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**A concurrency failure that will not reproduce is not a mystery — it is a configuration
mismatch, and there are only three of them. This chunk is how to make the failure reproducible,
and then the order to fix things in, which is not the order people reach for.**

The catalogue of what breaks is [12e](12e-shared-state-under-parallelism.md).

## Why "it passed locally" is the signature failure

Three independent reasons, all pointing the same way.

**Different parallelism.** The default `dynamic` strategy sets the desired parallelism to the
number of available cores ([12b](12b-parallelism-configuration.md)). A sixteen-core laptop and a
two-core CI agent explore completely different interleavings, and neither set is a subset of the
other — more concurrency is not strictly "more coverage", because some races only appear at
exactly two threads.

**Different speed.** A race is won by whoever is faster. Faster disks, a warm page cache, a
local database with no network hop: all of them shift which side of a race wins, and they shift
it *consistently*. That is why a race can be reliably invisible locally and reliably visible in
CI — it is not "random", it is a different machine reproducibly choosing the other branch.

**Different selection.** Running one test class from an IDE runs it alone. There is no other
class to conflict with, so every cross-class shared-state failure in
[12e](12e-shared-state-under-parallelism.md) — the shared row, the fixed port, the mutated
static, the dirtied Spring context — is structurally unreachable from the way developers
normally run tests.

## Making it reproducible

In order, because each step removes one of the three differences:

**1 · Pin the parallelism.** Switch off `dynamic` and match the agent:

```properties
junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.classes.default = concurrent
junit.jupiter.execution.parallel.config.strategy = fixed
junit.jupiter.execution.parallel.config.fixed.parallelism = 2
```

Two is often more revealing than sixteen: with a small pool, tests that would have run alone now
run against exactly one other, and the same pairs recur.

**2 · Run the whole suite, not the class.** The failing class is where the symptom appeared, not
necessarily where the cause lives.

**3 · Turn on output capture** so the interleaved logs become per-test report entries:

```properties
junit.platform.output.capture.stdout = true
junit.platform.output.capture.stderr = true
```

⚠️ Remembering the documented limit: *"the captured output will only contain output emitted by
the thread that was used to execute a container or test. Any output by other threads will be
omitted"*. If the failure involves an async callback or a pool thread, capture will not show you
its output at all, and you need a logging appender that records the thread name instead.

**4 · If it still will not reproduce, that is data.** It means the difference you have not
matched is timing — disk, network latency, CPU contention from other jobs on the agent — and the
next lever is to make the suspected shared state *impossible* rather than to keep hunting the
interleaving. Delete the sharing and see whether the CI failure stops.

## Bisecting once it does reproduce

The pair, not the test. A concurrency failure is a statement about two nodes, so the useful
questions are:

- **Which other class was in flight?** With `fixed.parallelism = 2` there are few candidates,
  and the thread name in a captured log or a stack trace usually names the pool worker.
- **Does it survive `@Execution(SAME_THREAD)` on the failing class?** If yes, the conflict is
  between methods of that class. If no, it is cross-class.
- **Does it survive `@Isolated` on the failing class?** If it now passes, something else in the
  suite is the other half of the pair — and you have converted an unreproducible flake into a
  concrete search over the classes that were running.

`@Isolated` here is a **diagnostic**, not the fix ([12d](12d-dynamic-locks-and-isolation.md)).
Leaving it in place ships the defect with a performance penalty attached.

## The order to fix them in

1. **Delete the sharing** — instance fields instead of `static`, unique data instead of shared
   rows, `@TempDir` instead of fixed paths, port `0` instead of `8080`.
2. **Inject the global** — a `Clock`, a `Locale`, a `PrintStream`, a configuration object. Now
   there is no global left to contend for.
3. **Lock what remains** — `@ResourceLock` with the narrowest name and the weakest mode that is
   correct ([12c](12c-resource-locks.md)).
4. **Isolate what cannot be named** — `@Isolated`, sparingly, with the reason written down.

**Steps 1 and 2 make the suite faster.** They remove work and remove coordination. **Steps 3 and
4 make it slower** and are the price of not having done 1 and 2. Every team that starts at step 3
ends up with a parallel configuration that buys nothing: locks on everything, parallelism on
paper, and the same wall-clock time as before.

The test for whether you are at the right step: **if the fix is a lock, ask what the lock is
protecting and whether that thing had to be shared at all.** A lock on a temp file, a lock on a
port, a lock on a `static` cache — all three are step-1 problems wearing step-3 clothes.

## Gotchas

**★ Turning parallelism back off when it exposes a failure.**
The failure was there before; concurrency only removed the accidental serialisation hiding it.
Turning it off restores the hiding, and the defect ships — and it will resurface under random
ordering ([11b](11b-random-order.md)), on a different machine, or in production.

**★ Debugging a CI concurrency failure with the local parallelism.**
The default strategy ties parallelism to core count, so your laptop is running a different
experiment entirely. Pin `fixed.parallelism` to the CI value before concluding anything at all.

**★ Running one test class in the IDE and calling it reproduced.**
Running a class alone eliminates every cross-class interaction, which is where most parallel
failures live. The reproduction has to be the whole suite.

**★ Reaching for `@ResourceLock` before trying to delete the sharing.**
A lock is a scheduling constraint you pay for on every future run. Most categories — `static`
fields, fixed paths, fixed ports, shared rows — have a fix that costs nothing and makes the suite
faster.

**★ Locking the database as a whole.**
`@ResourceLock("database")` on every data test is a correct and completely self-defeating
configuration: it serialises the slowest half of the suite. Lock the table or the schema, or
better, give each test its own data.

**★ Leaving the diagnostic `@Isolated` in place as the fix.**
It made the failure go away by not running the other half of the pair concurrently. The pair is
still there, the defect is still there, and now the suite is slower.

**★ Raising `fixed.parallelism` to reproduce faster.**
More threads is not more likely to hit a two-party race; often it is less, because each test is
competing with more different partners and the specific pair recurs less. Two is a better
diagnostic setting than sixteen.

**★ Trusting output capture to show you everything.**
Only the executing thread's output is captured; anything from an async callback, a worker or a
pool is omitted. For those, log the thread name and read the raw stream.

**★ Concluding "not reproducible, therefore not real".**
An intermittent CI failure with a stack trace is evidence. Not reproducing locally tells you the
timing differs, which is exactly what a concurrency defect implies. Retrying past it
([14 · flaky tests](14-flaky-tests.md)) is how a known defect becomes an unknown one.

## Interview questions

**★ Does enabling parallel execution create new bugs?**
No — it removes the accidental serialisation that was concealing existing ones. Every category
that fails under concurrency was already a latent defect: shared `static` state, fixed paths,
fixed ports, a real clock, mutated globals. The right response is to fix the sharing, not to turn
concurrency off, because the same defects also fail under reordering, on different hardware, and
eventually in production.

**★ Why does a concurrency failure so often pass locally?**
Three compounding reasons. The default `dynamic` strategy sets parallelism to the core count, so
a laptop and a CI agent run different degrees of concurrency. Local hardware is faster, and a
race is decided by which side is faster — consistently, not randomly. And developers run a single
class from an IDE, which removes every cross-class interaction. Reproducing requires the CI
parallelism, pinned with the `fixed` strategy, and the whole suite.

**★ Walk me through reproducing an intermittent parallel failure.**
Pin the strategy to `fixed` at the agent's parallelism — often just two, which makes the same
pairs recur. Run the entire suite rather than the failing class. Enable stdout and stderr
capture, remembering it only records the executing thread. Then bisect the *pair*: try
`@Execution(SAME_THREAD)` on the failing class to test whether the conflict is intra-class, and
`@Isolated` to test whether it is cross-class — as diagnostics, not as fixes.

**★ In what order should you fix shared state?**
Delete the sharing first, inject the global second, lock what remains third, isolate the
unnameable last. The first two make the suite faster as well as correct; the last two cost
wall-clock time on every run and exist only for what genuinely cannot be made per-test. Teams
that start with locks end up with a parallel configuration that buys nothing.

**★ Your team locks `"database"` across every data test and the parallel suite is no faster.
Why?**
Because a single lock name shared by the slowest half of the suite serialises the slowest half of
the suite. Resource locks only help when the contended set is small. The fix is to narrow the
resource to a table or schema, or to remove the contention entirely with unique per-test data or
a rolled-back transaction.

**★ Is `@Isolated` a legitimate way to fix a parallel failure?**
As a diagnostic, yes — if isolating a class makes the failure stop, you have proved the conflict
is cross-class and narrowed the search to whatever else was running. As a fix, only when the
resource genuinely cannot be named. Otherwise it ships the defect with a permanent
parallelism penalty, and the underlying sharing will show up again the first time somebody runs
those classes in a different order.

{/* FOOTER */}
