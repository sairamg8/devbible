---
title: "Pools and isolation"
sidebar_label: "02 · Pools and isolation"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the [Vitest config reference](https://vitest.dev/config/)
> — `pool`, `poolOptions`, `isolate`, `fileParallelism`, `sequence`, `retry`,
> `testTimeout`, `maxConcurrency`, `bail` — and the
> [Vitest improving performance guide](https://vitest.dev/guide/improving-performance).
> **No sandbox, no console blocks.**

**Jest gives you one isolation model: a process per test file.** Vitest exposes the
choice, which is where its speed comes from and where its sharpest footgun lives.

---

## `pool`

| Option | Default |
|---|---|
| `test.pool` | `'forks'` |

| Pool | What it is | Isolation | Speed |
|---|---|---|---|
| `'forks'` | Child processes (`node:child_process`) | Strongest — a real process each | Slowest to start |
| `'threads'` | Worker threads (`node:worker_threads`) | Strong; shares the process | Faster |
| `'vmThreads'` | Worker threads plus a VM context per file | Weakest | Fastest |

⚠️ **The default moved to `forks` for compatibility reasons.** Some native modules and
some code touching `process` misbehave under worker threads. If you switch to `threads`
for speed, re-run the whole suite — a native dependency failing under threads produces a
confusing crash rather than a clear message.

🔴 **`vmThreads` runs files in a VM context that does not fully match Node's.** It is the
fastest option and the one most likely to produce a difference between "passes in tests"
and "works in production" — instance checks across realms, and globals that are not the
ones your code expects. Treat it as an optimisation to reach for last, with the suite
re-run to confirm.

---

## `poolOptions`

```ts
test: {
  pool: 'forks',
  poolOptions: {
    forks: { minForks: 1, maxForks: 4, singleFork: false },
    threads: { minThreads: 1, maxThreads: 4, useAtomics: true },
  },
},
```

**Same CI caution as Jest's `maxWorkers`** — the default derives from the machine's CPU
count, and a container is often told the host's. State the maximum explicitly in CI
([02 · chunk 06](../02-jest-config-reference/06-workers-and-projects.md)).

`singleFork: true` is Vitest's `--runInBand`: one process, all files, in order. Same use —
a diagnostic that proves a failure is a parallelism artefact.

---

## 🔴 `isolate`

| Option | Default |
|---|---|
| `test.isolate` | `true` |

With isolation on, each test **file** gets a fresh environment and module registry — the
guarantee Jest gives unconditionally.

```ts
test: { isolate: false },   // 🔴 read the rest of this section first
```

`isolate: false` is the largest single speed win Vitest offers, and it is genuinely safe
for a suite of pure functions with no module-level state.

**It is not safe when any of these are true**, and most React suites hit at least one:

- A module holds state at import scope — a client, a cache, a counter.
- The DOM is not fully reset between files.
- Mocks are registered at module scope rather than per test.
- A setup file mutates globals.

⚠️ **The failure mode is the worst kind: order-dependence.** The suite passes locally,
passes on a rerun, and fails on CI where files are distributed differently. **Turn it off
only with `sequence.shuffle` enabled for a while**, so order-dependence surfaces
immediately rather than three weeks later.

`fileParallelism: false` is the narrower tool: files run one at a time but each still gets
a fresh environment — slower than `isolate: false`, and without the correctness risk.

---

## `sequence`, `retry`, `bail`

```ts
test: {
  sequence: {
    shuffle: true,        // randomise file and test order
    concurrent: false,    // tests in a file run serially unless marked
    hooks: 'stack',       // afterEach order relative to beforeEach
  },
  retry: 0,               // 🔴 keep at 0 — see below
  bail: 0,                // stop after N failures
  testTimeout: 5000,
  maxConcurrency: 5,      // cap for test.concurrent within a file
},
```

### `shuffle` is a correctness tool

Randomised order does not make tests better; it **reveals** tests that were always
order-dependent. Enable it after any change to isolation, and expect the first run to find
something real.

### 🔴 `retry` is not a fix

```ts
retry: 2,   // 🔴 a flaky test now passes, and nobody investigates
```

Retrying converts a reproducible signal into an intermittent one, and the underlying
race — an unawaited promise, a real timer, a shared fixture — stays in the codebase and
eventually causes something worse.

**Defensible use:** a short-lived retry on a suite with a *known* external dependency,
with a ticket open. **Not defensible:** `retry` in the config as a general setting, which
is how a suite stops being trusted.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| A native module crashes under `threads` | Not thread-safe | Use `forks` (the default) |
| Passes in tests, wrong in production, only under `vmThreads` | VM realm differs from Node's | Move off `vmThreads` |
| Fails in CI, passes locally, after `isolate: false` | Order-dependence from shared module state | Re-enable isolation, or fix the state |
| Everything slow in CI, machine idle | Pool sized from the host's CPUs | Set `maxForks`/`maxThreads` explicitly |
| Passes with `singleFork`, fails parallel | Shared resource — port, file, DB row | Isolate the resource per worker |
| New failures after enabling `shuffle` | Pre-existing order-dependence, now visible | Fix the tests; the flag found a real bug |
| Flakiness "fixed" by `retry` | The race is still there | Remove the retry and fix the cause |
| `test.concurrent` tests interfere | They share the file's module state | Cap with `maxConcurrency`, or make them serial |
| CI reports fewer failures than exist | `bail` stopped the run early | Set `bail: 0` in CI |

---

## Interview questions

**Q. What are Vitest's three pools?**
`forks` (child processes, strongest isolation, the default), `threads` (worker threads,
faster), and `vmThreads` (worker threads plus a VM context per file, fastest and weakest).

**Q. Why is `forks` the default rather than the faster `threads`?**
Compatibility. Native modules and code touching `process` can misbehave under worker
threads, and a crash there is confusing to diagnose.

**Q. What is the specific risk of `vmThreads`?**
Its VM context does not fully match Node's, so cross-realm instance checks and globals can
differ — passing tests over behaviour that differs in production.

**Q. What does `isolate: false` do, and when is it safe?**
Reuses the environment and module registry across files. Safe for pure functions with no
module-scope state; unsafe for most React suites.

**Q. Why is order-dependence the worst failure mode here?**
It is not reproducible on demand. The suite passes locally and fails on CI where files are
distributed differently, so the bisect points at innocent commits.

**Q. How do you make order-dependence visible deliberately?**
`sequence.shuffle: true`. It does not improve tests; it surfaces ones that were always
order-dependent.

**Q. Difference between `isolate: false` and `fileParallelism: false`?**
The first shares the environment between files — fast, risky. The second runs files one at
a time but each still gets a fresh environment — slower, and no correctness risk.

**Q. Why is `retry` in the config a bad default?**
It hides a race behind an intermittent pass. The cause stays in the codebase, and the
suite's signal is degraded for everything else.

**Q. Vitest's equivalent of `--runInBand`?**
`poolOptions.forks.singleFork: true`, used the same way — as a diagnostic that proves a
failure is a parallelism artefact.

---

← **Prev:** [01 · Environment and globals](./01-environment-and-globals.md) ·
**Next:** [03 · Deps, coverage and projects](./03-deps-coverage-and-projects.md)
