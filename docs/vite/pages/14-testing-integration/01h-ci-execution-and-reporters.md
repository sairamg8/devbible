---
title: "Vitest decides watch-versus-run by checking process.env.CI and whether stdin is a TTY, forks is the default process pool (not threads), and Vitest 5 stopped printing json/junit reporters to stdout"
sidebar_label: "01h · CI, pool, and reporters"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vitest documentation — [CLI reference](https://vitest.dev/guide/cli.html), [`watch`](https://vitest.dev/config/watch), [`pool`](https://vitest.dev/config/pool), [`reporters`](https://vitest.dev/config/reporters), [Vitest 5.0 migration guide](https://vitest.dev/guide/migration.html). Documentation-validated; **no sandbox run, no timings**. Target: **Vitest 5.0.0 · Vite 8.2.2**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Running `vitest` and `vitest run` are not the same command by accident

**Bare `vitest` enters watch mode locally and exits after one run in CI, and that switch is not magic — it is one documented boolean expression checked at startup.** The same "it just knows" design shows up in the process pool default (`forks`, not the lighter-sounding `threads`) and in a Vitest 5 change to what the `json`/`junit` reporters do with their output that breaks a script piping test results to another tool.

## The watch/run decision is `!process.env.CI && process.stdin.isTTY`

> Default for `watch`: `!process.env.CI && process.stdin.isTTY`. CLI: `-w, --watch, --watch=false`. — [`watch`](https://vitest.dev/config/watch)

> *"enter the watch mode in development environment and run mode in CI (or non-interactive terminal) automatically."* — [CLI reference](https://vitest.dev/guide/cli.html)

> `--watch`: *"Will fallback to `vitest run` in CI or when stdin is not a TTY (non-interactive environment)."*

Two independent conditions both have to hold for watch mode to activate: `CI` must be unset (or falsy), **and** stdin must be a TTY — an interactive terminal. A CI runner almost always sets `CI=true` itself, so the first condition alone typically settles it there. The second condition is what protects a local script or a piped invocation (`vitest 2>&1 | tee out.log`, or invoked from another process that does not attach a real TTY) from hanging in watch mode even outside CI, since piping a command's stdout does not make stdin non-interactive by itself, but launching it from certain automation contexts does.

```bash
# package.json scripts
"test": "vitest",        # watch mode locally, run-once automatically in CI
"test:run": "vitest run" # explicit, unconditional single run — the CI script should use THIS
```

The reliable pattern for a CI script is `vitest run` explicitly, not bare `vitest`, precisely because the CI-detection fallback depends on `CI` and TTY state that some CI providers or wrapper scripts do not set the way Vitest expects — an explicit `run` never depends on environment detection at all.

## `pool` — the default is `forks`, not `threads`

> Default: `'forks'`. — [`pool`](https://vitest.dev/config/pool)

| Pool | Mechanism | Trade-off |
|---|---|---|
| `threads` | `worker_threads` | *"Enable multi-threading"* — but process-level APIs like `process.chdir()` are unavailable inside a worker thread |
| `forks` (default) | `child_process` | *"Similar as `threads` pool but uses `child_process` instead of `worker_threads`"* — slightly slower inter-process communication, full process API access |
| `vmThreads` | `worker_threads` + VM context | *"executes tests using VM context (inside a sandboxed environment) in a `threads` pool"* — faster, but prone to memory leaks, needing periodic worker restarts |
| `vmForks` | `child_process` + VM context | *"Similar as `vmThreads` pool but uses `child_process` instead of `worker_threads`"* — cheaper worker recycling for large suites, *"usually noticeably faster than `vmThreads`"* because the OS reclaims memory rather than relying on Node's garbage collector |

```typescript
// vite.config.ts — explicit pool selection
export default defineConfig({
  test: {
    pool: 'forks', // the default; explicit here for clarity
  },
});
```

`forks` being the default rather than `threads` is itself informative: it means Vitest ships favoring full process-API compatibility (code that calls `process.chdir()`, sets `process.env` in ways that should not leak between test files, or otherwise behaves like a full Node process) over the marginally cheaper `worker_threads` model — correctness and isolation over the last bit of speed, as a default.

## Reporters — the default, the built-ins, and a Vitest 5 output change

> Default reporter: `'default'`. — [`reporters`](https://vitest.dev/config/reporters)

> Built-in names: `default`, `verbose`, `tree`, `dot`, `junit`, `json`, `html`, `tap`, `tap-flat`, `hanging-process`, `github-actions`, `minimal` (aliased as `agent`), `blob`.

```typescript
// vite.config.ts — combining reporters, common for "human output locally, machine output for CI tooling"
export default defineConfig({
  test: {
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: './test-results/junit.xml' },
  },
});
```

> *"json and junit reporters now write to a file by default instead of printing to stdout"* — [Vitest 5.0 migration guide](https://vitest.dev/guide/migration.html)

A CI pipeline built before Vitest 5 that captured `junit` or `json` reporter output by piping stdout to a file (`vitest run --reporter=junit > results.xml`) breaks silently on upgrade — stdout no longer carries that content, so the captured file is empty or contains something else entirely, and the pipeline step that consumes it fails downstream without an obviously related error. The fix is `outputFile`, naming the destination explicitly, which is the same option the reporter now uses internally to decide where to write.

## Gotchas

**★ Symptom: a CI job hangs indefinitely on a step running `vitest` with no arguments.** Cause: the watch/run auto-detection (`!process.env.CI && process.stdin.isTTY`) depends on `CI` being set and stdin's TTY status being correctly reported — some CI providers, containerized runners, or wrapper scripts do not set `CI=true`, or attach a pseudo-TTY that reports as interactive when it should not. Fix: never rely on the auto-detection in a CI script; call `vitest run` explicitly, which never enters watch mode regardless of environment.
```bash
vitest run
```

**★ Symptom: a script that pipes Vitest's `junit` reporter output to a file (`vitest run --reporter=junit > results.xml`) produces an empty or wrong file after upgrading to Vitest 5.** Cause: `json` and `junit` reporters now write to a file by default rather than stdout — the shell redirect is capturing whatever the reporter *does* still print (which may be little or nothing), not the report itself. Fix: use `outputFile` to name the destination explicitly, and read from that path instead of the redirected stdout.
```typescript
test: { reporters: ['junit'], outputFile: { junit: './results.xml' } }
```

**★ Symptom: `process.chdir()` (or another `process`-level mutation) throws inside a test running under the `threads` pool.** Cause: `worker_threads` — the mechanism behind `threads` and `vmThreads` — does not support process-level APIs the way a real child process does; `process.chdir()` specifically is a documented gap. Fix: switch that project (or the whole suite) to `forks` or `vmForks`, both of which use `child_process` and support the full process API surface.
```typescript
test: { pool: 'forks' }
```

**★ Symptom: a large test suite under `vmThreads` gradually consumes more memory over a long CI run, occasionally OOM-killing the runner.** Cause: `vmThreads` runs tests inside a VM context for speed, and the documented trade-off is memory-leak proneness requiring periodic worker restarts — the VM sandboxing does not clean up as thoroughly as a fresh OS process would between test files. Fix: switch to `vmForks`, which keeps the VM-context speed benefit but recycles workers via `child_process`, letting the OS reclaim memory on worker restart rather than relying on Node's own garbage collector inside a long-lived thread.

**★ Symptom: a developer runs `vitest` locally from an automation tool (a task runner, an editor's integrated terminal invoked non-interactively) and the process exits after one run instead of watching, unlike running it from a normal terminal.** Cause: the watch/run decision also checks `process.stdin.isTTY`, not just `CI` — a non-interactive invocation, even outside a CI environment, fails that half of the condition and falls back to run-once. Fix: pass `--watch` explicitly when watch mode is genuinely wanted from a context where stdin is not a real TTY; the auto-detection is a convenience default, not a hard requirement, and it is always overridable.

## Interview questions

**★ Why does bare `vitest` behave differently on a developer's laptop than in CI, with no flag changed between the two?**
Because the `watch` option's default is not a fixed boolean — it is the expression `!process.env.CI && process.stdin.isTTY`, evaluated fresh at startup. A local terminal session typically has `CI` unset and a real TTY attached, so watch mode activates; a CI runner typically sets `CI=true` (and often lacks a TTY entirely), so the same invocation falls back to a single run. Nothing in the Vitest binary itself changes — the environment it is invoked in changes what the default expression evaluates to.

**★ Why is `forks` the default process pool instead of `threads`, given `threads` sounds cheaper?**
Because `threads`/`vmThreads` run on `worker_threads`, which does not give test code the same process-level API surface a real Node process has — `process.chdir()` is the named example. Defaulting to `forks`, backed by `child_process`, trades a small amount of inter-process-communication overhead for full process-API compatibility and stronger isolation between test files (each fork is a genuinely separate OS process, not a thread sharing the same process-level state). That is a deliberate correctness-over-speed choice for the default, with the faster pools available as an explicit opt-in for suites that don't need the process API and want the extra speed.

**★ A CI pipeline that has captured `junit` reporter output via shell redirection for over a year suddenly breaks after a routine `vitest` bump. What actually changed, and what's the correct fix?**
Vitest 5.0 changed the `json` and `junit` reporters to write to a file by default instead of printing to stdout — a behavior the old pipeline's redirect (`vitest run --reporter=junit > results.xml`) silently depended on. The correct fix is not reverting the Vitest version; it is switching the pipeline to use the `outputFile` config option, which is the mechanism these reporters now use internally to write their report, and pointing the downstream tooling at that path instead of the redirected stdout.

**★ When would `vmForks` be the right pool choice over the default `forks`?**
For a large test suite where per-file overhead from spinning up and tearing down VM contexts under `vmThreads` would be worth the speed, but `vmThreads`'s own known memory-leak proneness over a long run is unacceptable — `vmForks` gets the VM-context execution speed while still using `child_process` for worker isolation, so the OS reclaims memory on worker recycling instead of leaving it to accumulate inside long-lived `worker_threads`. It is a choice made for large, long-running suites specifically, not a general-purpose default; for most projects `forks` remains the right starting point and `vmForks` is a measured optimization, not a blind swap.

---

← [01g · In-source testing](01g-in-source-testing.md) · [Vite overview](../../README.md) · Next → [01i · Migrating from Jest](01i-migrating-from-jest.md)
