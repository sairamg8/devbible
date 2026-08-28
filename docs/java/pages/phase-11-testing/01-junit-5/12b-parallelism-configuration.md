---
title: "The default parallelism is one thread per core and the pool underneath is a ForkJoinPool that will spawn extra threads to stay busy, so the number you configure is a target rather than a ceiling — and the ceiling is a different parameter that almost nobody sets"
sidebar_label: "12b · Parallelism configuration"
sidebar_position: 42
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Parallel Execution"
> ([writing-tests/parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html))
> and "Capturing Standard Output/Error"
> ([running-tests/capturing-standard-output-error](https://docs.junit.org/6.0.3/running-tests/capturing-standard-output-error.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**[12](12-parallel-execution.md) decides *what* runs concurrently. This decides *how many* run
at once — and the answer is more subtle than the parameter names suggest, because parallelism
and maximum thread count are two different things and the documentation says so explicitly.**

## The three strategies

> *"Properties such as the desired parallelism and the maximum pool size can be configured
> using a `ParallelExecutionConfigurationStrategy`. The JUnit Platform provides two
> implementations out of the box: `dynamic` and `fixed`. Alternatively, you may implement a
> custom strategy."*

Selected with `junit.jupiter.execution.parallel.config.strategy`:

> *"`dynamic` — Computes the desired parallelism based on the number of available
> processors/cores multiplied by the `junit.jupiter.execution.parallel.config.dynamic.factor`
> configuration parameter (defaults to 1). The optional
> `junit.jupiter.execution.parallel.config.dynamic.max-pool-size-factor` configuration
> parameter can be used to limit the maximum number of threads."*

> *"`fixed` — Uses the mandatory `junit.jupiter.execution.parallel.config.fixed.parallelism`
> configuration parameter as the desired parallelism. The optional
> `junit.jupiter.execution.parallel.config.fixed.max-pool-size` configuration parameter can be
> used to limit the maximum number of threads."*

> *"`custom` — Allows you to specify a custom `ParallelExecutionConfigurationStrategy`
> implementation via the mandatory `junit.jupiter.execution.parallel.config.custom.class`
> configuration parameter to determine the desired configuration."*

And the default:

> *"If no configuration strategy is set, JUnit Jupiter uses the `dynamic` configuration
> strategy with a factor of 1. Consequently, the desired parallelism will be equal to the
> number of available processors/cores."*

**One thread per core, by default.** On a CI agent with two cores that is a parallelism of two;
on a developer's sixteen-core laptop it is sixteen. That difference alone explains a large
fraction of "it passed locally" reports — the local run explores far more interleavings than
the agent does, or far fewer, and neither is the configuration the other saw.

🔴 **Pin the strategy in CI.** `fixed` with an explicit `parallelism` gives every agent, every
laptop and every rerun the same degree of concurrency, which is the precondition for a failure
being reproducible at all:

```properties
junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.classes.default = concurrent
junit.jupiter.execution.parallel.config.strategy = fixed
junit.jupiter.execution.parallel.config.fixed.parallelism = 4
```

Note `fixed.parallelism` is described as **mandatory** for the `fixed` strategy, and
`custom.class` as mandatory for `custom`. Selecting the strategy without its required parameter
is a misconfiguration, not a fallback.

## 🔴 Parallelism is a target, not a ceiling

This is the paragraph that surprises people, and the guide gives it its own callout:

> *"By default JUnit Jupiter does not guarantee that the number of concurrently executing tests
> will not exceed the configured parallelism. For example, when using one of the
> synchronization mechanisms described in the next section, the `ForkJoinPool` that is used
> behind the scenes may spawn additional threads to ensure execution continues with sufficient
> parallelism. If you require such guarantees, it is possible to limit the maximum number of
> concurrent threads by controlling the maximum pool size of the `dynamic`, `fixed` and
> `custom` strategies."*

Two facts to take away.

**The pool is a `ForkJoinPool`.** When a task blocks — and a `@ResourceLock`
([12c](12c-resource-locks.md)) makes tasks block — the pool compensates by starting another
thread, so that the *available* parallelism stays at the target. That is correct fork-join
behaviour and it is the opposite of what "parallelism = 4" reads like.

**If you need a hard ceiling, set the max pool size.** Which parameter depends on the strategy:

| Strategy | Ceiling parameter | Documented default |
|---|---|---|
| `dynamic` | `junit.jupiter.execution.parallel.config.dynamic.max-pool-size-factor` | *"256 + the value of `junit.jupiter.execution.parallel.config.dynamic.factor` multiplied by the number of available processors/cores"* |
| `fixed` | `junit.jupiter.execution.parallel.config.fixed.max-pool-size` | *"256 + the value of `junit.jupiter.execution.parallel.config.fixed.parallelism`"* |

**256 plus.** That is the real ceiling in a default configuration, and it is why a suite with
many locked tests can end up with far more live threads than the parallelism number implies.
If each of those threads holds a database connection, the pool that runs out first is not
Jupiter's.

The `dynamic` ceiling parameter is a *factor*: *"a positive decimal number, must be greater
than or equal to 1.0"*, multiplied by cores and by `dynamic.factor`. The `fixed` one is an
absolute count: *"a positive integer, must be greater than or equal to
`junit.jupiter.execution.parallel.config.fixed.parallelism`"*.

## Saturation

Both strategies expose a third knob:

> *"`junit.jupiter.execution.parallel.config.dynamic.saturate` — Disable saturation of the
> underlying fork-join pool for the dynamic configuration strategy … Supported values `true`,
> `false`, default `true`."*

with `junit.jupiter.execution.parallel.config.fixed.saturate` the equivalent for `fixed`.
Saturation is what permits the pool to exceed its target parallelism in order to keep making
progress; setting it to `false` makes the pool refuse rather than grow. **The documentation
describes the parameter but does not spell out the failure behaviour when a non-saturating pool
cannot accept more work, so I am not going to guess at it** — if you need a hard cap, the
max-pool-size parameters are the documented lever and are described in terms of what they do.

## The complete parameter list

Everything on this page, in the guide's own table, with defaults:

| Property | Default |
|---|---|
| `junit.jupiter.execution.parallel.enabled` | `false` |
| `junit.jupiter.execution.parallel.mode.default` | `same_thread` |
| `junit.jupiter.execution.parallel.mode.classes.default` | `same_thread` |
| `junit.jupiter.execution.parallel.config.strategy` | `dynamic` |
| `junit.jupiter.execution.parallel.config.dynamic.factor` | `1.0` |
| `junit.jupiter.execution.parallel.config.dynamic.max-pool-size-factor` | 256 + factor × cores |
| `junit.jupiter.execution.parallel.config.dynamic.saturate` | `true` |
| `junit.jupiter.execution.parallel.config.fixed.parallelism` | *"no default value"* |
| `junit.jupiter.execution.parallel.config.fixed.max-pool-size` | 256 + parallelism |
| `junit.jupiter.execution.parallel.config.fixed.saturate` | `true` |
| `junit.jupiter.execution.parallel.config.custom.class` | *"no default value"* |

Every default in that table is `same_thread`, `false` or `dynamic` — which restates the point
from [12](12-parallel-execution.md): out of the box, nothing is parallel.

## Output capture, which you need before you need any of this

> *"The JUnit Platform provides opt-in support for capturing output printed to `System.out` and
> `System.err`. To enable it, set the `junit.platform.output.capture.stdout` and/or
> `junit.platform.output.capture.stderr` configuration parameter to `true`. In addition, you
> may configure the maximum number of buffered bytes to be used per executed test or container
> using `junit.platform.output.capture.maxBuffer`."*

> *"If enabled, the JUnit Platform captures the corresponding output and publishes it as a
> report entry using the `stdout` or `stderr` keys to all registered `TestExecutionListener`
> instances immediately before reporting the test or container as finished."*

⚠️ And the limit, which is the part that matters under parallelism:

> *"Please note that the captured output will only contain output emitted by the thread that
> was used to execute a container or test. Any output by other threads will be omitted because
> particularly when executing tests in parallel it would be impossible to attribute it to a
> specific test or container."*

**Only the executing thread's output is captured.** Anything your code logs from a worker
thread, an async callback, a scheduler or a connection pool is dropped from the report entry —
not misattributed, omitted. So capture makes concurrent output readable for the common case and
silently loses exactly the output that a multi-threaded failure is most likely to produce. Know
both halves before you rely on it.

## Gotchas

**★ Reading `parallelism` as a maximum thread count.**
It is a target. The `ForkJoinPool` beneath *"may spawn additional threads to ensure execution
continues with sufficient parallelism"*, particularly when resource locks make tasks block. The
maximum is the max-pool-size parameter, whose default is 256 plus your parallelism.

**★ Leaving the strategy at `dynamic` in CI.**
Parallelism then equals the agent's core count, which differs from your laptop's and may differ
between agents. A concurrency failure that depends on the degree of concurrency is then
unreproducible by construction. Pin `fixed` with an explicit `parallelism` for any suite you
intend to debug.

**★ Selecting `fixed` without `fixed.parallelism`.**
The parameter is documented as mandatory for that strategy, and there is no documented default
to fall back on. Same for `custom` without `custom.class`.

**★ Sizing the connection pool for `parallelism` rather than for the pool ceiling.**
With locks in play the live thread count can exceed the parallelism target, and each thread may
want a connection. The default ceiling is 256 + parallelism, so a pool of four connections and
a parallelism of four is not the safe pairing it looks like.

**★ Setting `dynamic.factor` above 1 for I/O-bound tests without measuring.**
More threads than cores is a reasonable idea for tests that mostly wait — and it is exactly the
kind of change that produces a faster suite on one machine and a slower, flakier one on
another. Measure on the machine that matters, which is CI.

**★ Assuming output capture attributes everything.**
Only the thread executing the test is captured. Logs from worker threads, async callbacks and
pools are omitted entirely, which is a real problem for diagnosing precisely the failures
parallelism creates.

**★ Forgetting `junit.platform.output.capture.maxBuffer`.**
Capture buffers per test or container. A test that produces a lot of output silently loses the
tail beyond the buffer, and the tail is usually the part with the failure in it.

**★ Tuning parallelism before eliminating shared state.**
The strategy parameters change how fast a correct suite runs and how often an incorrect one
fails. Fixing the second problem with the first knob does not work
([12d](12d-shared-state-under-parallelism.md)).

**★ Writing a custom strategy as the first move.**
`custom.class` exists, and the two built-ins cover essentially every ordinary need. A custom
`ParallelExecutionConfigurationStrategy` is a piece of infrastructure you now own, in a place
nobody looks when the build is slow.

## Interview questions

**★ What is the default parallelism if you enable parallel execution and configure nothing
else?**
The `dynamic` strategy with a factor of `1.0`, giving a desired parallelism equal to the number
of available processors or cores. That means the degree of concurrency differs between your
laptop and a CI agent, which is a common reason a concurrency failure reproduces in one place
and not the other.

**★ Does setting parallelism to 4 mean at most four threads?**
No. The guide is explicit that Jupiter does not guarantee the number of concurrently executing
tests will stay within the configured parallelism — the `ForkJoinPool` underneath may spawn
extra threads to keep making progress, especially when resource locks cause blocking. A hard
ceiling requires the max-pool-size parameter, whose default is 256 plus the parallelism.

**★ Which strategy would you use in CI, and why?**
`fixed`, with an explicit `fixed.parallelism`. `dynamic` ties the degree of concurrency to the
hardware, so the same commit explores different interleavings on different agents and a failure
may be irreproducible. A fixed number makes the concurrency part of the configuration rather
than part of the environment.

**★ You enabled parallelism and your logs became unreadable. What do you turn on, and what will
still be missing?**
`junit.platform.output.capture.stdout` and `junit.platform.output.capture.stderr`, which publish
per-test report entries instead of one interleaved stream, plus `maxBuffer` if your tests are
chatty. What is still missing is anything printed from a thread other than the one executing the
test — worker threads, async callbacks, pools — because the Platform omits it rather than
misattribute it.

**★ Your parallel suite starts failing with connection-pool timeouts. Where do you look first?**
At the relationship between the pool ceiling and the connection pool size. Parallelism is a
target, not a cap; with resource locks in play the live thread count can exceed it, and the
documented default maximum pool size is 256 plus the parallelism. Either raise the connection
pool, or set an explicit max pool size so the two numbers are actually related.

{/* FOOTER */}
