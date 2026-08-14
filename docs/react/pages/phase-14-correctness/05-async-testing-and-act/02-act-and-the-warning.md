---
title: "act(), and what the warning means"
sidebar_label: "02 · act() and the warning"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **React 19.2** and **RTL 16.x**, from documentation —
> [react.dev · `act`](https://react.dev/reference/react/act): *"a test helper to apply
> pending React updates before making assertions"*, the `await act(async actFn)` form and
> the recommendation to prefer it (*"the sync version … doesn't work in all cases … we will
> deprecate and remove the sync version in the future"*), the
> `global.IS_REACT_ACT_ENVIRONMENT = true` requirement and the
> *"The current testing environment is not configured to support act(...)"* error, and the
> caveat that dispatching DOM events requires the container to be in the document.
> No sandbox script backs this page; claims are cited, not measured.

## What `act` is

React batches work. A state update does not immediately produce new DOM — it schedules
render work, which React performs later, and effects run after that. In a browser this is
invisible because the next paint comes after the work. In a test, "later" can easily be
*after your assertion*.

`act` closes that gap. The documentation describes it as **a test helper to apply pending
React updates before making assertions**, making the test *"run closer to how React works in
the browser"* by ensuring updates related to a unit of interaction have been processed and
applied to the DOM before you look.

```js
await act(async () => {
  root.render(<TestComponent />);
});
// the DOM is now up to date
```

Two requirements come with it:

- **`global.IS_REACT_ACT_ENVIRONMENT = true`.** Without it React emits *"The current testing
  environment is not configured to support act(...)"*. Jest and Vitest with RTL set this up
  for you; you meet it when running React outside a configured test environment.
- **Prefer the async form.** The docs recommend `act` with `await` and an async function,
  because *"the sync version works in many cases, it doesn't work in all cases"* and *"we
  will deprecate and remove the sync version in the future"*. Write `await act(async () =>
  …)` and never think about it again.

Also documented, and easy to trip over outside RTL: **dispatching DOM events only works when
the container is in the document** — which is precisely what RTL's `render` does for you
([topic 02](../02-the-rtl-model/README.md)).

## Why you will almost never call it

RTL already wraps the things that produce updates: `render`, `rerender`, `unmount`,
`fireEvent`, and every `user-event` call. The async utilities — `findBy`, `waitFor`,
`waitForElementToBeRemoved` — flush pending work as they retry.

**So a test written in the ordinary way needs no `act` at all:**

```jsx
const user = userEvent.setup();
render(<Counter />);
await user.click(screen.getByRole("button", { name: /increment/i }));
expect(screen.getByText("Count: 1")).toBeInTheDocument();
```

If you find yourself reaching for `act`, that is worth a moment's suspicion: usually the
real answer is an `await` you left off, or a wait you have not written yet.

The genuine exceptions are narrow — driving a hook or a store outside React's own event
handling, advancing fake timers that trigger updates, or testing a low-level integration
without RTL:

```jsx
await act(async () => {
  jest.advanceTimersByTime(300);      // a debounce fires and sets state
});
expect(screen.getByText(/3 results/i)).toBeInTheDocument();
```

## The warning, and what it is actually telling you

> **An update to X inside a test was not wrapped in act(...)**

Read it as: **something updated component state at a moment the test was not waiting for.**
It is not asking you to add ceremony — it is reporting that the test and the component
disagree about when work happens. There are four common causes and they need different
fixes.

### 1 · A missing `await` on an interaction or query

The most common by far.

```jsx
user.click(button);                     // ❌ not awaited
screen.findByText("Saved");             // ❌ not awaited
```

The interaction's updates land after the test has moved on — often after it has *finished*,
which is why the warning frequently names a component from a *previous* test. **Fix:** await
every `user-event` call and every `find*` query, and enable
`eslint-plugin-testing-library`'s `await-async-queries` and `await-async-events` rules.

### 2 · An async update after the test ended

A fetch resolves, an effect's `setState` runs, and by then the test is over and the tree is
unmounted.

```jsx
// component
useEffect(() => {
  fetchUser().then(setUser);            // resolves whenever it resolves
}, []);
```

**Fix:** wait for the consequence before the test ends — `await screen.findByText(user.name)`
— so the update happens inside the test rather than after it. This is also why mocking the
network deterministically matters ([topic 06](../06-mocking-the-api/README.md)): a request that
never resolves guarantees an update after teardown.

### 3 · Timers firing outside the test's control

A debounce, a poll, an animation timeout. With fake timers the update comes from your own
`advanceTimersByTime` call, and *that* is a legitimate `act` case:

```jsx
await act(async () => { jest.advanceTimersByTime(500); });
```

With real timers the fix is to wait for the visible result instead
([topic 14](../14-flaky-tests-and-ci.md) covers the choice).

### 4 · Updates from outside React's knowledge

A store subscription, a WebSocket message, an event listener on `window`, a callback from a
non-React library. React sees state change with no scheduled unit of work around it. **Fix:**
drive it through the app's own path if there is one; otherwise wrap the trigger in
`await act(async () => …)`, which is exactly the case `act` exists for.

## Why silencing it is the wrong fix

Two "fixes" circulate and both are worse than the warning.

**Wrapping the assertion in `act`** to make the message go away:

```jsx
// ❌ moves the deckchairs
await act(async () => {
  expect(screen.getByText("Saved")).toBeInTheDocument();
});
```

The update still happens at an uncontrolled moment. The test now passes or fails depending
on machine speed, which is the definition of flaky.

**Filtering the console.** Muting `console.error` for this message hides the one signal that
tells you a component is updating state after unmount — a real memory-leak and
double-render class of bug, and the reason CI logs fill with warnings nobody reads.

**The right posture:** treat the warning as a failing test. Find which of the four causes
applies, fix that, and the warning disappears on its own. In a suite where every interaction
and query is awaited and the network is mocked, `act` warnings are rare enough to be worth
investigating each time.

## Gotchas

**Symptom:** an `act` warning names a component that the *currently failing* test does not
render.
**Cause:** an un-awaited interaction or query in an *earlier* test, whose update landed after
that test finished.
**Fix:** look at the previous test, not the failing one. Await everything there.

**Symptom:** "The current testing environment is not configured to support act(...)".
**Cause:** `global.IS_REACT_ACT_ENVIRONMENT` is not `true` — React is running outside a
configured test environment.
**Fix:** set it in the runner's setup file. With Jest/Vitest plus RTL this is normally
already done.

**Symptom:** `act(() => …)` behaves inconsistently between tests.
**Cause:** the synchronous form, which the docs say does not work in all cases and is slated
for removal.
**Fix:** always `await act(async () => …)`.

**Symptom:** warnings appear only when fake timers are enabled.
**Cause:** advancing timers triggers state updates outside any awaited unit of work.
**Fix:** wrap the advancement: `await act(async () => { jest.advanceTimersByTime(n); })`.
Also pass `advanceTimers` to `userEvent.setup()`
([topic 04](../04-user-event-over-fireevent/README.md)).

**Symptom:** the team added a console filter and the warnings stopped.
**Cause:** the signal was muted, not the bug.
**Fix:** remove the filter and fix the causes. Updates after unmount are worth knowing about.

## Interview questions

**★ What does `act()` do?**
It applies pending React updates before your assertions run — React batches renders and
defers effects, so without it a test can inspect the DOM before the work it triggered has
been performed. The docs describe it as making the test run closer to how React behaves in a
browser for a unit of interaction. It requires `IS_REACT_ACT_ENVIRONMENT` to be true, and the
`await act(async () => …)` form is the recommended one because the synchronous version does
not cover every case and will be removed.

**★ Why do you rarely call `act()` directly in an RTL test?**
Because RTL already wraps everything that schedules work — `render`, `rerender`, `unmount`,
`fireEvent`, every `user-event` call — and the async utilities flush pending work while they
retry. A test that awaits its interactions and waits for its results needs no explicit `act`.

**★ You see "An update to Foo inside a test was not wrapped in act(...)". How do you
diagnose it?**
Treat it as "state changed at a moment the test was not waiting for", then check four
causes in order: a missing `await` on an interaction or `findBy`; an async update landing
after the test ended, usually an unresolved or unmocked request; a timer firing outside the
test's control; or an update from outside React — a store, a socket, a window listener. Each
has a different fix, and the warning is a real signal, not noise.

**★ Why is wrapping the assertion in `act()` or filtering the console the wrong fix?**
Neither changes when the update happens. The test still races the component, so it passes or
fails by machine speed, and filtering additionally hides updates-after-unmount — a genuine
bug class. The warning should be treated like a failing test.

**When is calling `act()` yourself genuinely correct?**
When you drive an update from outside React's own handling: advancing fake timers that cause
state changes, pushing a value through a store or socket by hand, or testing a low-level
integration without RTL. Those are exactly the cases nothing else wraps.

**Why does the `act` warning often name a component from a different test?**
Because the update escaped the test that caused it — an un-awaited interaction leaves work
scheduled, which completes after that test has finished, so the warning surfaces during
whichever test happens to be running. Fix the earlier test.

---

← Prev: [The three waiting tools](01-the-waiting-tools.md) ·
Index: [Async testing and what `act()` means](README.md) ·
Next → [Mocking the API with MSW](../06-mocking-the-api/README.md)
