---
title: "02 · Faking time, network and modules"
sidebar_label: "02 · Faking time, network, modules"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the Vitest docs — [API § `vi`](https://vitest.dev/api/vi.html), [Guide § Mocking](https://vitest.dev/guide/mocking.html) — Jest [Timer Mocks](https://jestjs.io/docs/timer-mocks), Node.js [Test runner](https://nodejs.org/api/test.html) (`mock.timers`, `mock.module`), and [MSW documentation](https://mswjs.io/docs/). Documentation-validated; **no test runs, no timings, no console blocks**.

## Three things a test cannot wait for

A test that takes real time, makes a real request, or depends on a real module is slow, flaky, or
both. Each has its own replacement, and they are not interchangeable:

| The problem | The replacement | Reach for it |
|---|---|---|
| the code waits | **fake timers** — you control the clock | always, for anything time-based |
| the code fetches | **request interception** — MSW or the runner's fetch stub | for anything crossing the network |
| the code imports something unfaithful | **a module mock** | last, and reluctantly |

🔴 **The order is the recommendation.** Faking the clock changes nothing about your code's design.
A module mock is a claim that a dependency is untestable as written, and it is usually a design
problem wearing a testing costume.

## Fake timers: own the clock

```js
import { vi, beforeEach, afterEach, test, expect } from 'vitest';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('debounced handler fires once', () => {
  const spy = vi.fn();
  const run = debounce(spy, 300);
  run(); run(); run();
  vi.advanceTimersByTime(300);
  expect(spy).toHaveBeenCalledTimes(1);
});
```

**What gets replaced.** Vitest's `vi.useFakeTimers` documents replacing `setTimeout`,
`setInterval`, `clearTimeout`, `clearInterval`, `setImmediate`, `clearImmediate` **and `Date`** —
so "now" stops moving too. Jest's equivalent swaps the timer functions in the same way and is
restored with `jest.useRealTimers()`. Node's own runner has the same idea under
`mock.timers.enable({ apis: [...] })` with `tick()` to advance.

**Three ways to move time, and they answer different questions:**

| Call | What it does |
|---|---|
| `advanceTimersByTime(ms)` | runs the timers due within that window — the precise one |
| `runAllTimers()` | Vitest: *"invoke every initiated timer until the timer queue is empty"* |
| `runOnlyPendingTimers()` (Jest) | runs what is queued **now**, not what those callbacks schedule |

🔴 **`runAllTimers` on a self-rescheduling timer never finishes**, and Jest guards against it
rather than hanging — it aborts with *"Aborting after running 100000 timers, assuming an infinite
loop!"*, and its documentation points at `runOnlyPendingTimers()` as the fix. A polling loop
written with a recursive `setTimeout`
([Phase 7 · 12 · Drift and repeating work](../../phase-7-async/12-timers/03-drift-and-repeating-work.md))
is exactly this case.

⚠️ **Advancing the clock does not flush promises.** Timers are tasks and `.then` callbacks are
microtasks ([Phase 7 · 18 · Choosing a deferral](../../phase-7-async/18-queuemicrotask/01-choosing-a-deferral.md)),
so code that awaits *after* a timeout needs the microtask queue to drain as well. That is what
Vitest's **`advanceTimersByTimeAsync`** family is for; the synchronous version leaves the awaited
continuation unrun, which shows up as an assertion that "should have happened by now".

**For a fixed date, set the clock rather than mocking `Date`.** Vitest's mocking guide names
`vi.setSystemTime` for this, and warns that the value **does not reset itself between tests** —
which is the entire failure mode: one test pins the clock, and every later test in the file
inherits it.

## Network: intercept the network, not your client

The tempting move is to replace `fetch` with a stub. It works, and it quietly changes what you are
testing — your code now talks to a function you wrote rather than to the platform, so a wrong URL,
a missing header or a mishandled status is invisible.

**MSW's stated design is the alternative**: intercept at the network level — a Service Worker in
the browser, class extension rather than module patching in Node — explicitly to avoid *"patching
`fetch` and meddling with your application's integrity"*, keeping the environment as close to
production as possible.

```js
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/users/:id', ({ params }) =>
    params.id === 'u_1'
      ? HttpResponse.json({ id: 'u_1', name: 'Ada' })
      : new HttpResponse(null, { status: 404 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Three things this shape buys, and each is a real bug it catches:

- **The failure paths are testable at all.** A 404, a 500 and a network error are three different
  code paths in your caller ([15 · timeouts and retries](../../phase-7-async/15-timeouts-retries-backoff/01-what-is-safe-to-retry.md)),
  and `fetch` only rejects on the last one.
- **Unhandled requests can fail the test** rather than escaping to the real internet.
- **One set of handlers serves tests, the dev server and demos** — MSW's own framing is API mocking
  as a standalone layer, *"a single source of truth for your network behavior"*.

⚠️ **Reset handlers between tests.** A per-test override that survives is the network equivalent of
a leaked fixture, and it produces the pass-alone-fail-together failure from
[01](./01-the-shape-of-a-test.md).

## Module mocks: powerful, hoisted, and the last resort

```js
vi.mock('./mailer.js', () => ({ send: vi.fn() }));
```

**Three facts about `vi.mock`, and every confusing error comes from one of them:**

1. 🔴 **The call is hoisted.** Vitest documents it plainly — *"The call to `vi.mock` is hoisted, so
   it doesn't matter where you call it"* — because the mock must be registered before the module
   graph is imported.
2. 🔴 **Therefore the factory cannot use outer variables** — *"you cannot use any variables inside
   the factory that are defined outside the factory"*. The fix Vitest documents is **`vi.hoisted()`**
   for values the factory needs, or **`vi.doMock`** when you want a non-hoisted, later registration.
3. **A whole-module mock replaces everything.** For one export, take the rest from the original —
   the guide's `importOriginal` partial-mock shape:

```js
vi.mock('./config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  IS_PROD: true,
}));
```

**Prefer a spy or an injected dependency where you can.** `vi.spyOn(obj, 'method')` replaces one
method on an object you already have, and passing a collaborator in as an argument needs no mocking
machinery at all. Node's runner exposes the same three levels — `mock.fn`, `mock.method`, and
`mock.module` — and the ordering advice is identical: the narrower tool first.

🔴 **Restore everything.** Vitest's guide states it as a rule — *"Always remember to clear or
restore mocks before or after each test run to undo mock state changes between runs"* — with
`restoreAllMocks` for spies, `unstubAllGlobals` for `stubGlobal`, and `restoreMocks`/`unstubGlobals`
in configuration to make it automatic. Node's context-scoped `t.mock.*` cleans up on its own, which
is a good reason to prefer it there.

## Gotchas

**Symptom: `vi.mock` factory throws "cannot access before initialization".**
Cause — hoisting; the factory ran before the outer variable existed.
Fix — `vi.hoisted()` for the value, or `vi.doMock` for a non-hoisted registration.

**Symptom: the real module ran anyway.**
Cause — the mock was registered after the import, or the specifier does not match the one the code
imports.
Fix — mock the exact specifier; remember the hoisting is what makes the top-of-file position work.

**Symptom: mocking one export lost all the others.**
Cause — a factory replaces the whole module.
Fix — spread `await importOriginal()` and override the single export.

**Symptom: the assertion after `advanceTimersByTime` has not happened yet.**
Cause — the continuation was a microtask; advancing the clock runs timers, not `.then` callbacks.
Fix — use the async advancing API, or await the promise the code under test returns.

**Symptom: `runAllTimers` hangs or aborts with a timer-limit error.**
Cause — a self-rescheduling timer, so the queue never empties.
Fix — `runOnlyPendingTimers()`, or advance by a bounded amount.

**Symptom: a later test sees the wrong date.**
Cause — `setSystemTime` does not reset between tests.
Fix — restore real timers in `afterEach` and set the time per test that needs it.

**Symptom: tests hit the real API.**
Cause — no interception, or a request no handler matched.
Fix — intercept at the network level and configure unhandled requests to fail the test.

**Symptom: a test passes with a mocked `fetch` and the feature is broken in production.**
Cause — the stub answered a shape your code never actually requests, so URL, method and status
handling were never exercised.
Fix — intercept requests instead of replacing the client.

## Interview questions

**★ Why fake timers instead of waiting?**
Because a test that waits is slow and flaky. Fake timers replace the timer functions and `Date`, so
you decide when time passes and the test is deterministic.

**★ Why did the assertion after `advanceTimersByTime` fail?**
Advancing the clock runs timer tasks; awaited continuations are microtasks and have not run. Use the
async advancing API or await the promise directly.

**★ What breaks with `runAllTimers`?**
A recursive timer that schedules another timer — the queue never empties. Jest aborts with a
timer-limit error and documents `runOnlyPendingTimers()` as the answer.

**★ Why is `vi.mock`'s factory unable to see your variables?**
Because the call is hoisted above the imports, so the factory can run before those variables exist.
`vi.hoisted()` or `vi.doMock` are the documented ways round it.

**★ Why intercept the network rather than stub `fetch`?**
Stubbing the client removes URL, method, header and status handling from the test. Interception
keeps the real client and lets you exercise 404s, 500s and network failures — which are three
different code paths.

**★ What should be reset between tests, and how?**
Mocks, spies, stubbed globals, fake timers and request handlers. Vitest's guide requires clearing or
restoring mocks between runs, and offers configuration to do it automatically.

**★ When is a module mock the wrong tool?**
When you could inject the dependency or spy on a single method. A whole-module mock is the widest
possible replacement and hides design problems that dependency injection would surface.

---

← Prev: [01 · The shape of a test](./01-the-shape-of-a-test.md) ·
[Topic index](./README.md) ·
Next → [03 · What is worth testing](./03-what-is-worth-testing.md)
