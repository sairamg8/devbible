---
title: "14 · Testing JavaScript"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the Vitest docs — [API § `vi`](https://vitest.dev/api/vi.html), [Guide § Mocking](https://vitest.dev/guide/mocking.html), [Guide § Coverage](https://vitest.dev/guide/coverage.html) — Jest [Timer Mocks](https://jestjs.io/docs/timer-mocks), Node.js [Test runner](https://nodejs.org/api/test.html), [MSW documentation](https://mswjs.io/docs/), and MDN [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random). Documentation-validated; **no test runs, no timings, no coverage numbers, no console blocks** — every code sample is illustrative, not transcribed output.

The syllabus row is *Vitest/Jest shape, mocking time, network and modules, and what is worth
testing*.

🔴 **One idea holds the three chunks together: a test is only as good as the inputs it controls.**
Everything the test does not control — the clock, the network, module state, the order tests run in
— is a way for it to pass when the code is broken or fail when it is not. The tools below exist to
take those inputs away from the environment and give them to you.

⚠️ **This is the last Understand topic of phase 8**, and it is deliberately tool-agnostic: Vitest,
Jest and Node's `node:test` share the vocabulary, so the pages teach the vocabulary and name each
tool's spelling where it differs.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The shape of a test](./01-the-shape-of-a-test.md)** | Arrange–act–assert and the test name as specification; 🔴 **the async test that silently passes**, and `await expect(p).rejects.toThrow()`; why `expect(fn())` must be `expect(() => fn())`; asserting on a `code` or class rather than a message; choosing the matcher for the failure message you want (`toBe` vs `toEqual` vs `toMatchObject`); setup, teardown and the cleanup rule; **isolation is per file, not per test**; and what the runner actually does — find, transform, environment, isolate |
| 02 | **[Faking time, network and modules](./02-faking-time-network-modules.md)** | The three things a test cannot wait for, and the order to reach for them; what `useFakeTimers` replaces (**including `Date`**); `advanceTimersByTime` vs `runAllTimers` vs `runOnlyPendingTimers`, and the recursive-timer abort; 🔴 **advancing the clock does not flush microtasks**; `setSystemTime` not resetting itself; **intercepting the network instead of stubbing `fetch`**, and failing on unhandled requests; `vi.mock` hoisting, why its factory cannot see outer variables, `vi.hoisted` / `vi.doMock`, and partial mocks via `importOriginal`; and restoring everything between tests |
| 03 | **[What is worth testing](./03-what-is-worth-testing.md)** | Testing the promise rather than how it was kept; the two lists — what earns a test and what does not; **error paths as the code you rely on most and exercise least**; the seven sources of flakiness and the fix for each; 🔴 **"wait 50 ms then assert" as a race condition in test clothing**; coverage as a diagnostic and never a target; and the pragmatic shape of a suite, where speed is itself a correctness feature |

## Five facts worth carrying out of this topic

- **An unawaited promise makes a test pass silently.** Await it, including the `expect(...).rejects`
  chain.
- **Isolation is per file.** Two tests in one file share the module graph — so restore what you
  change.
- **Fake timers move tasks, not microtasks.** An awaited continuation needs the async advancing API.
- **`vi.mock` is hoisted**, which is exactly why its factory cannot use variables defined outside it.
- **Coverage measures execution, not assertion.** Use it to find untested branches; never as a
  target.

## Phase gate

You can write a test whose name states the behaviour and whose assertions survive a refactor; make a
time-dependent or network-dependent test deterministic without adding a sleep; explain why a test
passes alone and fails in the suite; and say which of two failures a given test would and would not
have caught.

## Where this connects

- [09 · Validate at the boundary](../09-failing-well/01-validate-at-the-boundary.md) — the error
  paths that most deserve a test
- [08 · Designing the taxonomy](../08-custom-error-classes/01-designing-the-taxonomy.md) — why an
  assertion belongs on a `code` or a class, not a message
- [02 · Singletons and strict mode](../02-module-semantics/01-singletons-and-strict.md) — the shared
  module state behind pass-alone-fail-together
- [13 · What a bundler does](../13-bundlers-and-the-build/01-what-a-bundler-does.md) — the runner's
  transform pipeline is the same machinery, with the same dev-versus-build trap
- [Phase 7 · 12 · Drift and repeating work](../../phase-7-async/12-timers/03-drift-and-repeating-work.md)
  — the recursive timer that `runAllTimers` can never exhaust
- [Phase 7 · 18 · Choosing a deferral](../../phase-7-async/18-queuemicrotask/01-choosing-a-deferral.md)
  — tasks versus microtasks, which is why advancing the clock is not enough
- [Phase 7 · 17 · The stale response](../../phase-7-async/17-race-conditions-ui/01-the-stale-response.md)
  — the race a fixed sleep in a test reproduces rather than removes

---

Start → [01 · The shape of a test](./01-the-shape-of-a-test.md)
