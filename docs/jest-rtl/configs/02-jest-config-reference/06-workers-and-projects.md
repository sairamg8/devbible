---
title: "Workers and projects"
sidebar_label: "06 · Workers and projects"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration)
> (`maxWorkers`, `workerIdleMemoryLimit`, `testTimeout`, `randomize`, `slowTestThreshold`,
> `projects`, `reporters`, `globalSetup`, `globalTeardown`) and
> [Jest CLI options](https://jestjs.io/docs/cli) (`--runInBand`, `--shard`, `--maxWorkers`).
> **No sandbox, no console blocks.**

Jest runs test **files** in parallel across worker processes. Each worker is a real Node
process with its own module registry — which is what makes tests in different files
independent, and what makes memory the constraint that eventually bites.

---

## Workers

| Option | Default | Note |
|---|---|---|
| `maxWorkers` | CPUs − 1 | A number, or a percentage string like `"50%"` |
| `workerIdleMemoryLimit` | *(unset)* | Restart a worker that exceeds it. Accepts `"512MB"` |
| `testTimeout` | `5000` | Per test, in ms |
| `slowTestThreshold` | `5` | Seconds before a test is reported as slow |
| `randomize` | `false` | Shuffle test order within a file |

### 🔴 The CI default is usually wrong

Jest counts the **machine's** CPUs. A container limited to 2 cores on a 64-core host is
frequently reported the host's count, so Jest starts dozens of workers on two cores — and
the result is slower than running serially, with memory exhaustion on top.

```bash
# CI — state it, never infer it
npx jest --maxWorkers=2         # or 50% of the container's real allocation
```

⚠️ **`--runInBand` (no workers, all in the main process) is a diagnostic, not a
performance setting.** It is the fastest way to prove a failure is a parallelism artefact:
if the suite passes in-band and fails parallel, you have shared state — a port, a file, a
database row, a fixture directory. On tiny suites it can genuinely be quicker, because
worker startup dominates.

### `workerIdleMemoryLimit` treats the symptom

```js
workerIdleMemoryLimit: '512MB',
```

This restarts leaking workers so CI stops dying with an OOM. **It does not fix the leak** —
and the usual causes are worth checking first: jsdom instances not cleaned up, timers
never restored, module-level caches growing across files, or listeners added and never
removed. Reach for the limit to keep the pipeline green while you find the cause.

---

## Sharding — the CLI's job, not the config's

```bash
npx jest --shard=1/4     # in four parallel CI jobs
```

Each job runs a disjoint quarter of the files. Points that matter:

- **Coverage must be merged.** Four shards produce four partial reports, and a threshold
  evaluated on one shard is meaningless. Collect the `lcov` files and merge them in a
  final job.
- **Sharding splits by file, not by duration.** One pathological file makes its shard the
  critical path — check the slowest shard, not the average.
- **Combine with `--maxWorkers`.** Four jobs each spawning unbounded workers reproduces
  the original problem four times over.

---

## `projects` — several configurations, one command

The structural answer to a repo needing more than one environment:

```js
// jest.config.ts
export default {
  projects: [
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
    },
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/**/*.test.ts'],
    },
  ],
};
```

🔴 **Options beside `projects` do not apply to the runs.** A `setupFilesAfterEnv` at the
top level is silently ignored — every project needs its own. This is the number-one
`projects` bug, and it presents as *"my jest-dom matchers disappeared"*.

What you gain over two commands: one invocation, one shared worker pool, **one merged
coverage report** — so thresholds see the whole repo instead of half of it. `displayName`
labels each result line, which is the difference between a readable failure and guessing.

⚠️ **Coverage config belongs at the top level**, alongside `projects`, not inside each —
otherwise you are back to partial reports.

---

## `globalSetup` / `globalTeardown`

| Option | Runs |
|---|---|
| `globalSetup` | **Once**, before all suites, in its own process |
| `globalTeardown` | **Once**, after all suites |

For starting a container or seeding a database. **They are not `setupFiles`** — a
different process entirely, so nothing they define is visible to your tests except through
the outside world or `globalThis`. The full ordering is
**03 · The setup lifecycle** *(not written yet)*.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| CI far slower than a laptop with more work | Workers sized from the host's CPUs, not the container's | Set `--maxWorkers` explicitly |
| `JavaScript heap out of memory` in CI | Too many workers, or a per-worker leak | Lower `maxWorkers`; add `workerIdleMemoryLimit` while finding the leak |
| Passes with `--runInBand`, fails parallel | Shared state — port, file, DB row, fixture dir | Isolate the resource per worker |
| A threshold fails on a sharded build | Each shard reports only its own files | Merge the lcov files before evaluating |
| One shard takes twice as long | Split is by file count, not duration | Rebalance, or split the slow file |
| jest-dom matchers missing under `projects` | Top-level `setupFilesAfterEnv` ignored | Put it inside every project |
| Coverage halves after adopting `projects` | Coverage config placed inside a project | Move it beside `projects` |
| Cannot tell which project failed | No `displayName` | Add one per project |
| `globalSetup` variables undefined in tests | It runs in a separate process | Pass through env vars or `globalThis` |
| Random ordering failures after enabling `randomize` | Real inter-test dependencies were being masked | Fix the dependency — the flag exposed a bug |

---

## Interview questions

**Q. What is Jest's unit of parallelism?**
The test **file**. Each worker is a separate Node process with its own module registry, so
files are isolated but tests within a file share it.

**Q. Why is the default `maxWorkers` often wrong in CI?**
It derives from the machine's CPU count, and a container is commonly reported the host's.
Jest then oversubscribes a two-core box with dozens of workers.

**Q. When is `--runInBand` right?**
As a diagnostic. Passing in-band and failing in parallel proves shared state. It can also
be faster for very small suites where worker startup dominates.

**Q. Does `workerIdleMemoryLimit` fix a memory leak?**
No — it restarts workers that exceed the limit so the pipeline survives. The leak is still
there; look at jsdom cleanup, unrestored timers, module-level caches and stray listeners.

**Q. What must you do differently for coverage when sharding?**
Merge the per-shard reports before evaluating thresholds. A threshold on one shard is
measuring a quarter of the codebase.

**Q. Why does sharding sometimes save less than expected?**
The split is by file count, so one slow file pins its shard and the job is only as fast as
the worst shard.

**Q. Biggest gotcha with `projects`?**
Top-level options beside `projects` do not apply to the project runs. A shared
`setupFilesAfterEnv` silently does nothing, which shows up as missing matchers.

**Q. What does `projects` buy over two Jest commands?**
One invocation, one worker pool, and one merged coverage report — so thresholds see the
whole repo. Plus `displayName` labelling in the output.

**Q. How do `globalSetup` and `setupFiles` differ?**
`globalSetup` runs once in its own process before everything. `setupFiles` runs per test
file inside the test's environment. Nothing `globalSetup` defines is visible to a test
except via the environment or the outside world.

**Q. Your suite passes today and fails with `randomize: true`. Whose bug?**
Yours. Order-dependence between tests was always a defect; the flag only made it visible.

---

← **Prev:** [05 · Coverage](./05-coverage.md) ·
**Next:** 03 · The setup lifecycle *(not written yet)*
