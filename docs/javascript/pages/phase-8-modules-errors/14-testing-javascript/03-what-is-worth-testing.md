---
title: "03 · What is worth testing"
sidebar_label: "03 · What is worth testing"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the Vitest docs — [Guide § Coverage](https://vitest.dev/guide/coverage.html), [Guide § Mocking](https://vitest.dev/guide/mocking.html) — Jest [Timer Mocks](https://jestjs.io/docs/timer-mocks), Node.js [Test runner](https://nodejs.org/api/test.html), MDN [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random). Documentation-validated; **no test runs, no coverage numbers, no timings, no console blocks**.

⚠️ **This page is more judgement than API.** The tool behaviour it rests on is documented — fake
timers, request interception, coverage instrumentation — but *what deserves a test* is an argument,
made here as one. Vitest's coverage guide documents how coverage is collected and takes no position
on using it as a target; the position below is this page's, not the documentation's.

## Test the promise you made, not the way you kept it

A test is a statement about a contract. The useful question before writing one is *what did I
promise a caller* — and everything else in this page follows from it.

```js
// ⛔ tests the implementation: renaming a private helper breaks it
expect(cart._recalculateInternal).toHaveBeenCalled();

// ✅ tests the promise: the total is right
expect(cart.add(item, 2).total).toBe(2400);
```

🔴 **The test that knows how the code works must be rewritten whenever the code is rewritten**,
which inverts the point of having it — you wanted freedom to refactor, and you bought a second copy
of the implementation instead. A suite full of these makes people afraid to improve anything, and
it fails loudly on changes that broke nothing.

**The practical rule: assert on what a caller can observe.** The returned value, the state
afterwards, the request that was made, the error that came out. Not which internal function ran, in
what order, how many times.

## What earns a test

| Worth a test | Why |
|---|---|
| **Pure logic with branches** — pricing, parsing, validation, permissions | cheap to test, expensive to get wrong, and the branches are the specification |
| **Every error path you wrote deliberately** | the code you exercise least and rely on most |
| **A bug you just fixed** | the only test guaranteed to be about something that really happens |
| **A boundary you own** — the module's public API, the request your client makes | it is what other people depend on |
| **Anything subtle enough that you had to think** | your reasoning, written down where it will be checked |

| Not worth it | Why |
|---|---|
| **Getters, setters, one-line pass-throughs** | asserts that assignment works |
| **The framework or the library** | someone else tests it, and better |
| **Private helpers, directly** | they should be covered through the public path, and stay free to change |
| **Exact copy and layout** | it changes for reasons that have nothing to do with correctness |
| **Anything you would delete rather than fix when it fails** | that is the definition of noise |

⚠️ **The error paths deserve their own line here.** You wrote a `catch`, a validation branch, a
retry ([Phase 7 · 15](../../phase-7-async/15-timeouts-retries-backoff/01-what-is-safe-to-retry.md))
— that code runs on the worst day, and nothing else exercises it. Testing the failure is testing
the part where failure was already happening
([09 · Validate at the boundary](../09-failing-well/01-validate-at-the-boundary.md)).

## The one thing that destroys a suite: flakiness

A test that fails one run in twenty is worse than no test. People re-run it, then they ignore it,
and then they ignore the real failure standing next to it. Every source is removable, and every one
is something the code depends on that the test did not control:

| Source | The tell | The fix |
|---|---|---|
| **Real time** | passes locally, fails on a loaded machine | fake timers ([02](./02-faking-time-network-modules.md)) |
| **The clock's value** | fails at month end, or after midnight UTC | pin the system time per test |
| **The time zone / locale** | fails on a colleague's machine or in CI | set them explicitly; `Intl` formatters follow the environment's default when you do not |
| **Randomness** | fails rarely and never twice the same way | inject the generator, or stub `Math.random` |
| **Test order and shared state** | passes alone, fails in the suite | per-test fixtures; restore mocks ([01](./01-the-shape-of-a-test.md)) |
| **The real network** | fails when something else is down | intercept, and fail on unhandled requests |
| **A fixed `setTimeout` "to let it settle"** | fails on slow CI, wastes time on fast CI | wait for the condition, not for a duration |

🔴 **"Wait 50 ms and then assert" is the single most common flaky pattern in JavaScript tests**, and
it is a race condition in test clothing ([Phase 7 · 17](../../phase-7-async/17-race-conditions-ui/01-the-stale-response.md)).
Await the promise the code returns, or wait for the observable condition. A duration is a guess
about someone else's machine.

## Coverage is a diagnostic, never a target

Coverage tells you what the suite **executed**. It cannot tell you what the suite **asserted** —
a test with no expectations at all still colours its lines green.

- **Read it to find what is untested**, especially an error branch nobody exercised. That is a
  genuinely useful signal and the reason to collect it.
- **Do not read it as quality.** 100% coverage with weak assertions is a suite that proves nothing
  and takes an afternoon to maintain.
- ⚠️ **A percentage target changes behaviour, and not in the direction you wanted** — it rewards
  tests over getters and pass-throughs, because they are the cheapest lines to colour.

**The honest version of the metric is a question, not a number:** which branches of this module
have never run in a test, and is any of them the one that handles failure?

## The pragmatic shape of a suite

- **Most tests over pure logic**, because they are fast, stable and precise about what broke.
- **A smaller number that integrate real pieces** — the module with its collaborators, the client
  against intercepted requests — because whole classes of bug live in the seams and nowhere else.
- **A handful end to end**, over the journeys that actually earn money, accepting that they are the
  slowest and the most fragile.

🔴 **Speed is a correctness feature.** A suite that runs in seconds gets run before every commit; a
suite that takes twenty minutes gets run by CI after the fact and skipped by a person in a hurry.
The value of a test is what it prevents, and it prevents nothing when nobody waits for it.

**Write the test at the level the mistake lives at.** A pricing bug is a unit test; a wiring bug —
wrong URL, wrong header, wrong order — is only ever caught where the pieces meet.

## Gotchas

**Symptom: refactoring broke fifty tests and no behaviour.**
Cause — the tests assert on implementation: private calls, call counts, internal names.
Fix — assert on observable results; delete the tests that only restate the code.

**Symptom: a test fails only in CI.**
Cause — an uncontrolled environment: time zone, locale, machine speed, real network.
Fix — pin the environment explicitly and fake what the test does not own.

**Symptom: a test fails at month end.**
Cause — the current date leaked into the assertion.
Fix — set the system time per test and assert against that fixed instant.

**Symptom: coverage is high and bugs still ship.**
Cause — lines executed without meaningful assertions.
Fix — use coverage to find unexercised branches; judge the suite by what it asserts.

**Symptom: everyone re-runs the pipeline until it goes green.**
Cause — an accepted flaky test.
Fix — treat a flaky test as a failing test: quarantine it and remove the uncontrolled input.

**Symptom: nobody runs the tests locally.**
Cause — the suite is too slow, usually from real waiting and real I/O.
Fix — fake the clock, intercept the network, and keep the slow end-to-end set small.

**Symptom: a hand-written mock drifted from the real thing.**
Cause — the test asserts against a fiction that was true once.
Fix — mock at the boundary you do not own and let the real code run up to it.

## Interview questions

**★ What makes a test valuable?**
It asserts a promise a caller depends on, fails only when that promise is broken, and tells you what
broke from its name.

**★ Why avoid asserting on internals?**
Because it couples the test to the implementation: every refactor breaks tests without breaking
behaviour, which is the opposite of what you wanted the suite for.

**★ Which parts of the code most need tests?**
Branching logic and the error paths — the code you exercise least by hand and depend on most when
things go wrong.

**★ Why is a flaky test worse than no test?**
It trains people to ignore failures, so it takes the real failures with it.

**★ Where does flakiness come from?**
Uncontrolled inputs: real time, the clock, time zone and locale, randomness, shared state, the
network, and fixed sleeps. Every one can be controlled.

**★ Is high coverage a good goal?**
No. Coverage shows execution, not assertion, and a percentage target rewards testing trivia. Use it
to find unexercised branches.

**★ How do you decide unit versus integration?**
By where the mistake can live. Calculation bugs are unit-level; wiring bugs between pieces are only
visible where the pieces meet.

**Why does suite speed matter for correctness?**
Because a slow suite stops being run before the change lands, and a test that runs after the fact
prevents nothing.

---

← Prev: [02 · Faking time, network and modules](./02-faking-time-network-modules.md)
