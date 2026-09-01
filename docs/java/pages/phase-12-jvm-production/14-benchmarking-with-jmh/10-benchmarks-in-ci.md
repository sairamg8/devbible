---
title: "A benchmark suite in CI is a regression detector built on the noisiest signal in your pipeline, so the engineering is not in running it — it is in deciding what counts as a change and refusing to alert on everything else"
sidebar_label: "10 · Benchmarks in CI"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH `CommandLineOptions` source** on `master`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-core/src/main/java/org/openjdk/jmh/runner/options/CommandLineOptions.java)),
> which defines every flag quoted here with its own help text, and the JMH `README.md`.
> JMH 1.37, JDK 25. 🔴 **No sandbox** — no pipeline was built or run for this page.

**The temptation is to run the benchmark suite on every pull request and fail the build on a
regression. That design fails in a specific and predictable way: the noise floor of shared CI
hardware is larger than the effects you are trying to catch, so the gate either flaps or is
set so loose it catches nothing.**

## The flags a pipeline actually needs

From the option parser's own help text:

| Flag | JMH's description |
|---|---|
| `-rf <type>` | *"Format type for machine-readable results … See the list of available result formats with `-lrf`."* |
| `-rff <file>` | *"Write machine-readable results to a given file. The file format is controlled by `-rf` option."* |
| `-o <file>` | *"Redirect human-readable output to a given file."* |
| `-foe <bool>` | *"Should JMH fail immediately if any benchmark had experienced an unrecoverable error? This helps to make quick sanity tests for benchmark suites, as well as make the automated runs with checking error codes."* |
| `-to <time>` | *"Timeout for benchmark iteration. After reaching this timeout, JMH will try to interrupt the running tasks. Non-cooperating benchmarks may ignore this timeout."* |
| `-e <regexp>` | *"Benchmarks to exclude from the run."* |
| `-p name=v1,v2` | *"Benchmark parameters … Parameter name and parameter values should be separated with equals sign."* |
| `-t <int>` | *"Number of worker threads … `'max'` means the maximum number of hardware threads available on the machine … `'halfmax'` means `'max/2'`"* |
| `-l` / `-lp` / `-lrf` / `-lprof` | list benchmarks / with parameters / result formats / profilers, and exit |

🔴 **`-foe true` is the flag most CI setups are missing.** By default a benchmark that throws
is dropped from the results and the run continues ([03](03-what-jmh-is.md)) — so a suite can
quietly shrink from forty benchmarks to thirty-one and still exit zero. `-foe true` makes that
an error code.

⚠️ **`-t max` is a portability trap, not a convenience.** It resolves to the hardware thread
count of whatever agent picked up the job, so the same command is a different experiment on a
different runner. Pin thread counts explicitly.

## Two noise-suppression flags, and their costs

```
-si <bool>   Should JMH synchronize iterations? This would significantly lower the noise
             in multithreaded tests, by making sure the measured part happens only when
             all workers are running.

-gc <bool>   Should JMH force GC between iterations? Forcing the GC may help to lower the
             noise in GC-heavy benchmarks, at the expense of jeopardizing GC ergonomics
             decisions. Use with care.
```

🔴 **Read `-gc`'s own warning.** Forcing collection between iterations lowers variance and
*changes what you are measuring*: the collector's ergonomics no longer see a realistic
allocation history. It buys stability with representativeness, which is occasionally the right
trade and never a free one.

## What makes a benchmark gate flake

1. **Shared, virtualised runners.** Noisy neighbours, variable CPU frequency, unknown NUMA
   placement. The variance between two runs on two agents can exceed the regression you want to
   catch.
2. **Too few forks.** A single fork gives precision without accuracy
   ([07b](07b-reading-the-error-bars.md)); the run-to-run variance you did not measure becomes
   the flake you cannot explain.
3. **Comparing across configurations.** Different JDK build, different JMH version, different
   blackhole mode ([06b](06b-compiler-blackholes.md)), different thread count — each changes
   the number without any code change.
4. **Thresholds chosen after seeing the data.** A gate tuned until it stops firing is a gate
   that no longer detects anything.

## A design that works

- **Dedicated hardware for the benchmark job.** One machine, fixed CPU governor, nothing else
  scheduled on it, the same JDK build every time. If that is impossible, do not gate — track.
- **Not on every pull request.** Run nightly, or on merge to the main branch. The suite takes
  hours if it is honest ([07](07-forks-and-warmup.md)), and PR feedback wants minutes.
- **Store the machine-readable output.** `-rf json -rff results.json` plus the commit hash, the
  JDK version and the full option line. A score without its configuration is not comparable to
  anything.
- **Compare against a trend, not the previous run.** A rolling baseline over N runs absorbs
  single-run noise; a diff against yesterday alerts on it.
- **Gate on effect size *and* significance.** Non-overlapping 99.9% intervals establish that
  something changed; your own threshold decides whether it matters
  ([07b](07b-reading-the-error-bars.md)).
- **Gate on `gc.alloc.rate.norm` too, and preferably first.** Allocation per operation is
  nearly noise-free compared with timing ([08](08-profilers-in-jmh.md)), which makes it the
  best regression signal a shared runner can give you.
- **Keep a canary benchmark.** An empty method whose score is expected to be stable; when it
  moves, the machine moved, not your code.
- **`-foe true` and an exit-code check**, so a suite that fails to run fails the job.
- **`-to` a timeout**, remembering the caveat: *"Non-cooperating benchmarks may ignore this
  timeout."*

## Warm-up helpers worth knowing

Two options exist specifically for suites:

- `-wm <mode>` — the warm-up mode for warming up selected benchmarks.
- `-wmb <regexp>` — *"Warmup benchmarks to include in the run in addition to already selected
  by the primary filters. Harness will not measure these benchmarks, but only use them for the
  warmup."*

⚠️ **`-wmb` deliberately shares a JVM's profile across benchmarks**, which is the thing forking
exists to prevent. It is for situations where you *want* shared warm-up; it is not a general
speed-up.

## Gotchas

🔴 **Without `-foe true`, a benchmark that throws disappears silently** and the suite still
passes. Check the number of results, not just the exit code.

🔴 **Alerting on every statistically significant change trains everyone to ignore the alert.**
Significance is cheap at large sample sizes; pick a practical threshold in advance.

⚠️ **`-gc true` changes GC ergonomics** by its own documentation. Do not adopt it as a default
to make numbers prettier.

⚠️ **`-t max` and `-t halfmax` mean different things on different runners.** So does an
unpinned container CPU quota.

⚠️ **Storing only the score loses the experiment.** Persist the JMH version, JDK build, options
line, host identity and profiler output alongside it.

⚠️ **Benchmarks rot.** A benchmark whose `@State` no longer reflects the code, or which
benchmarks a method nothing calls any more, will keep producing green numbers indefinitely.
Review the suite like tests.

⚠️ **A suite that takes six hours will be disabled the first time it blocks a release.** Size
it to the value it provides, and make the expensive configuration a scheduled job rather than a
gate.

## Interview questions

**★ How do you get machine-readable output from JMH?**
`-rf <type>` selects the format (list them with `-lrf`) and `-rff <file>` writes it; `-o`
redirects the human-readable log separately. Persist both alongside the commit and the option
line.

**★ Why is `-foe true` important in CI?**
Because by default a benchmark that throws is dropped and the run continues, so a suite can
lose benchmarks and still exit successfully. `-foe true` turns an unrecoverable benchmark
error into a failed job.

**★ What does `-gc true` do and why is it not a default?**
It forces a collection between iterations, lowering noise in GC-heavy benchmarks. JMH's own
help says it does this *"at the expense of jeopardizing GC ergonomics decisions"* — the
collector no longer sees a realistic allocation history.

**★ Why is `-t max` risky in a pipeline?**
Because it resolves to the runner's hardware thread count, so the same command runs a
different experiment on a different agent. Pin thread counts to make results comparable.

**★ What is the most robust signal to gate on, and why?**
Allocation per operation (`gc.alloc.rate.norm`). It is normalised and largely immune to machine
noise, so it detects real changes on hardware where timing alone would flap.

**★ Should benchmarks run on every pull request?**
Generally no. An honest suite — adequate warm-up, several forks — takes far longer than PR
feedback allows, and shared PR runners are the noisiest environment available. Run nightly or
on merge, on dedicated hardware.

**★ How do you decide whether a change is a regression?**
Two independent tests: statistical — the confidence intervals do not overlap — and practical —
the effect exceeds a threshold you chose before looking. Compare against a rolling baseline
rather than a single previous run.

**★ What is a canary benchmark and what is it for?**
A trivial benchmark whose score should not change. When it moves, the environment moved —
different agent, different JDK, throttled CPU — which distinguishes machine drift from a code
regression.

Next: [The checklist](11-the-checklist.md).

{/* FOOTER */}
