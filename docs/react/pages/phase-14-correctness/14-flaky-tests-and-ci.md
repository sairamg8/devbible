---
title: "Flaky tests, fake timers and CI"
sidebar_label: "14 · Flaky tests and CI"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **Jest 30.x**, **Vitest 3.x**, **RTL 16.x**,
> **`user-event` 14.x** and **MSW 2.x**, from documentation —
> [Jest · Timer mocks](https://jestjs.io/docs/timer-mocks),
> [Jest · Configuration](https://jestjs.io/docs/configuration) (`setupFilesAfterEnv`),
> [user-event · Options](https://testing-library.com/docs/user-event/options)
> (`advanceTimers` — *"When using fake timers it is necessary to set this option to your test
> runner's time advancement function"*),
> [dom-testing-library · Async APIs](https://testing-library.com/docs/dom-testing-library/api-async)
> (the 1000 ms default timeout) and
> [MSW · `setupServer`](https://mswjs.io/docs/api/setup-server) (`resetHandlers`).
> No sandbox script backs this page; claims are cited, not measured.

**A flaky test is worse than no test.** A suite that fails sometimes trains everyone to rerun
it, and once rerunning is the reflex, a genuine regression is indistinguishable from noise —
you have paid for a suite and lost the thing it was for.

Nearly all flakiness in a React suite comes from four causes. They are diagnosable.

## Cause 1 · Time the test does not control

A test that passes on a fast laptop and fails on a loaded CI machine is waiting on wall-clock
time.

- **A fixed sleep.** `await new Promise(r => setTimeout(r, 500))` is a bet on machine speed.
  Replace it with `findBy` or `waitFor`, which return as soon as the condition holds
  ([topic 05](05-async-testing-and-act/README.md)).
- **A synchronous `getBy` on something asynchronous.** Passes locally because the mocked
  response resolved in time; fails when it does not. Use `findBy`.
- **Raising the timeout.** Converts a fast failure into a slow one. Fix the cause.

## Cause 2 · State leaking between tests

The signature is unmistakable: **passes alone, fails in a suite** — or passes in one order and
fails in another.

| Leak | Fix |
|---|---|
| MSW `server.use()` override | `afterEach(() => server.resetHandlers())` ([topic 06](06-mocking-the-api/README.md)) |
| shared query client or store | construct a fresh one per test in the render helper ([topic 10](10-wrappers-and-providers.md)) |
| module-level mutable state | reset it, or make it a factory |
| `localStorage` / `sessionStorage` | clear in `afterEach` |
| mock call history | `clearMocks` / `restoreMocks` in the runner config |
| a rendered tree that was never unmounted | automatic cleanup — confirm it is running |
| fake timers left installed | `afterEach(() => jest.useRealTimers())` |

**Diagnose it by running the suite in a random order.** Both runners can do this, and an
order-dependent failure that appears immediately is a leak, not a coincidence.

## Cause 3 · Fake timers, used carelessly

Fake timers are the right tool for debounce, throttle, polling and retry backoff — anything
where the *point* is that time passes. They are also a rich source of hangs.

```jsx
test("searches 300ms after typing stops", async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });   // ← required

  render(<SearchBox />);
  await user.type(screen.getByRole("searchbox"), "ada");

  await act(async () => { jest.advanceTimersByTime(300); });

  expect(await screen.findByRole("listitem", { name: /Ada/ })).toBeInTheDocument();
  jest.useRealTimers();
});
```

Four rules that prevent nearly every fake-timer problem:

1. **Pass `advanceTimers` to `userEvent.setup()`.** `user-event` delays between some inputs
   with `setTimeout`; under fake timers those never fire and every interaction hangs until the
   test times out. The documentation states the option *"is necessary"* here.
2. **Wrap advancement in `act`.** Advancing triggers state updates that nothing else wraps
   ([topic 05](05-async-testing-and-act/README.md)).
3. **Restore real timers in `afterEach`.** Otherwise the next test inherits frozen time,
   which is one of the nastiest leaks to diagnose.
4. **Do not reach for them by default.** If the component's timing is not the subject, real
   timers plus `findBy` is simpler and less fragile.

## Cause 4 · Environment differences

CI is not your laptop, and the differences are enumerable: fewer cores and heavy parallelism
(so everything is slower under load), a different timezone and locale, no network egress
(which is why an unmocked request hangs there and works locally), a different Node version,
and a cold cache on the first run.

Two fixes are worth doing once, in setup:

- **Pin timezone and locale** — `TZ=UTC` and an explicit locale — so date formatting is
  identical everywhere. Locale-sensitive `toLocaleString` output is a classic
  passes-locally-fails-in-CI failure.
- **Make unhandled requests fail loudly** — `server.listen({ onUnhandledRequest: 'error' })`
  — so a request that would hang in CI fails immediately and by name
  ([topic 06](06-mocking-the-api/README.md)).

## Diagnosing a flaky test

In order, because each step is cheaper than the next:

1. **Run it alone.** Passes alone, fails in the suite → a leak (cause 2).
2. **Run the suite in random order, repeatedly.** Reproduces → confirmed leak, and the
   ordering tells you which test poisons which.
3. **Look for waits.** Any `setTimeout`, any bare `getBy` after an interaction, any raised
   timeout → cause 1.
4. **Check timer state.** Fake timers without `advanceTimers`, or never restored → cause 3.
5. **Compare environments.** Only fails in CI → timezone, locale, network or load → cause 4.

⚠️ **Do not "fix" flakiness with a retry flag.** Automatic retries hide the failure and let a
genuinely broken feature ship green. Retries are a last-resort mitigation for a known
infrastructure problem, announced as such, never a substitute for diagnosis.

## Keeping a suite fast

Speed and reliability are related — a slow suite gets run less, and timeouts bite under load.

- **Mock the network.** Real requests are the single biggest cost and the biggest source of
  nondeterminism.
- **Render the smallest thing that answers the question.** A whole-page render for one
  button's behaviour costs that render in every run.
- **Watch `getByRole` on very large trees** — the docs call the accessibility-tree
  computation expensive ([topic 03](03-the-query-families/README.md)). A real lever, but
  measure before trading it away.
- **Profile before optimising.** Both runners report per-file timings; the cost is usually
  concentrated in a handful of files, and often it is module transforms rather than the tests.

## Gotchas

**Symptom:** every interaction test times out after fake timers were introduced.
**Cause:** `user-event`'s internal delays never fire.
**Fix:** `userEvent.setup({ advanceTimers: jest.advanceTimersByTime })`.

**Symptom:** a test passes alone and fails in the suite.
**Cause:** leaked state — an un-reset MSW handler, a shared client, storage, or fake timers.
**Fix:** work through the leak table; confirm with a random-order run.

**Symptom:** a date assertion fails only in CI.
**Cause:** a different timezone or locale.
**Fix:** pin `TZ` and the locale in the test environment.

**Symptom:** a test hangs in CI and passes locally.
**Cause:** an unhandled request being performed for real, with no network egress on CI.
**Fix:** `onUnhandledRequest: 'error'`.

**Symptom:** the team added `retries: 2` and the failures stopped.
**Cause:** they did not stop; they became invisible.
**Fix:** remove the retries and diagnose. A test that needs a retry is reporting something.

**Symptom:** the suite slows down steadily over months.
**Cause:** accumulated whole-page renders and un-mocked work.
**Fix:** profile per file; the cost is usually in a few files and often in transforms rather
than the tests themselves.

## Interview questions

**★ A test passes locally and fails in CI. How do you diagnose it?**
Run it alone first — passing alone but failing in the suite means leaked state, which a
random-order run confirms and localises. If it fails in isolation too, look for
time-dependence: a fixed sleep, a synchronous query on something asynchronous, an inflated
timeout. If it only ever fails in CI, compare environments: timezone, locale, absent network
egress, and load-induced slowness are the usual four.

**★ What breaks when you enable fake timers in a suite using `user-event`?**
Every interaction hangs. `user-event` inserts `setTimeout`-based delays between some inputs
and fake timers stop them firing, so the call never resolves. The documented fix is to pass
the runner's advancement function as `advanceTimers` to `userEvent.setup()`. Also wrap
`advanceTimersByTime` in `act`, and restore real timers afterwards so the next test does not
inherit frozen time.

**★ Why are automatic retries a bad answer to flakiness?**
Because they hide the signal. A flaky test is reporting real nondeterminism — leaked state, an
uncontrolled clock, a race — and any of those can also be a production bug. Retrying makes the
suite green while leaving the cause in place, and it trains the team to distrust failures,
which is the thing that makes a suite worthless.

**★ What are the most common sources of leaked state between tests?**
Un-reset MSW handlers, a shared query client or store, module-level mutable state, storage,
mock call history, and fake timers left installed. The fixes are all "construct it per test or
reset it in `afterEach`", and the diagnosis is a random-order run.

**How do you keep a suite fast without making it fragile?**
Mock the network, render the smallest thing that answers the question, and profile before
optimising — the cost is usually concentrated in a few files and often in module transforms.
Trading away robustness for speed, such as weakening role queries on large trees, is a real
option but should follow a measurement, not a hunch.

**Why pin the timezone in the test environment?**
Because locale- and timezone-sensitive formatting differs between a developer machine and CI,
and that produces failures that look mysterious and are trivially explained. `TZ=UTC` plus an
explicit locale removes the whole class.

---

← Prev: [Testing Server Components](13-testing-server-components.md) ·
Index: [Phase 14](README.md) ·
Next → [React — Explanations](../README.md)
