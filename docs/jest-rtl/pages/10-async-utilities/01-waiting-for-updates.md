---
title: "Async Utilities: `waitFor()`, `findBy` Queries & `act()` Warnings"
sidebar_label: "Async Utilities"
sidebar_position: 1
---

# 🧪 Async Utilities: `waitFor()`, `findBy` Queries & `act()` Warnings

## 1. Under-The-Hood Mechanics

Testing a component whose state updates asynchronously (after a fetch, a timer, a debounced effect) requires explicitly waiting for that update — RTL provides two closely related mechanisms, plus an automatic safety wrapper around renders/events that most engineers never need to invoke manually.

```
waitFor(callback)
        │
        ▼
Repeatedly RE-RUNS the callback (polling, with a default interval) until it either:
   - passes without throwing  ──► waitFor resolves
   - the timeout elapses         ──► waitFor rejects with the LAST error the callback threw

findBy* queries = getBy* + waitFor(), COMBINED into one call — the standard, more concise
                     way to wait for an element to APPEAR, rather than hand-writing
                     waitFor(() => expect(screen.getByText(...)).toBeInTheDocument())
```

### `act()`: Why RTL Wraps Renders/Events Automatically
React's `act()` ensures all state updates and their resulting DOM effects are fully flushed and applied **before** a test's subsequent assertions run — without it, an assertion could run against a DOM that's mid-update, seeing a stale or partially-applied state. RTL's `render()` and its fired events (via `fireEvent`/`user-event`) are **already wrapped in `act()` internally** — this is precisely why most RTL tests never need to call `act()` manually at all; the "act() warning" that occasionally appears is a signal that **something outside** RTL's automatic wrapping (an unawaited async state update, a manually-scheduled `setTimeout` callback updating state) is happening un-wrapped.

### Why `waitFor` Polls Instead of Just `await`-ing Once
A component's async update might not be a single, directly-awaitable Promise from the test's perspective (e.g. an internal `useEffect` kicking off a fetch whose completion the test has no direct handle to) — `waitFor`'s polling approach lets a test assert "eventually, this becomes true" without needing access to the actual underlying async operation's Promise at all.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Recurring "act() Warning" in CI Traced to an Un-Awaited State Update From a Timer.
A component's `useEffect` set a `setTimeout` that updated state after 500ms — a test exercising this component consistently logged an "An update to Component inside a test was not wrapped in act(...)" warning, even though the test itself appeared to pass. The warning was correctly signaling a real gap: the test wasn't waiting for that timer-driven state update to settle before finishing, meaning the assertion (while happening to pass) wasn't actually verifying the POST-timer state reliably — a genuinely flaky test waiting to happen under different timing conditions. Wrapping the relevant assertion in `waitFor()` (letting RTL poll until the timer-driven update had actually applied) eliminated both the warning and the underlying reliability gap.

---

## 3. Production-Grade Code Example

```tsx
// waitFor — polling for an assertion to eventually pass, without a direct handle to the underlying async work
import { render, screen, waitFor } from '@testing-library/react';

test('shows a success message after a debounced save completes', async () => {
  render(<AutoSaveNote />);

  await userEvent.type(screen.getByRole('textbox'), 'New note content');

  // The component's internal debounce/save logic isn't directly awaitable from the test —
  // waitFor polls until the eventually-appearing text shows up, or times out
  await waitFor(() => {
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });
});
```

```tsx
// findBy* — the concise, preferred shorthand for the common "wait for element to appear" case
test('shows user data after the fetch resolves', async () => {
  render(<UserProfile userId="1" />);

  // Equivalent to: await waitFor(() => expect(screen.getByText('Alex')).toBeInTheDocument())
  expect(await screen.findByText('Alex')).toBeInTheDocument();
});
```

```tsx
// Diagnosing and fixing a real act() warning from an un-awaited timer-driven update
function AutoSaveNote() {
  const [status, setStatus] = useState('idle');
  function handleChange(value) {
    setTimeout(() => setStatus('saved'), 500); // fires OUTSIDE RTL's automatic act() wrapping
  }
  return <div>{status === 'saved' && <span>Saved</span>}</div>;
}

test('correctly waits for the timer-driven update, avoiding the act() warning', async () => {
  render(<AutoSaveNote />);
  await userEvent.type(screen.getByRole('textbox'), 'x');

  // Explicitly waiting here means the timer's state update has GENUINELY settled
  // before the test finishes — eliminating both the warning and the underlying flakiness risk
  await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument(), { timeout: 1000 });
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Ignoring `act()` Warnings as Harmless Console Noise
```
❌ RISKY: an act() warning is a genuine signal that a state update happened outside RTL's
automatic flush-and-wait wrapping — dismissing it as noise means a test may be passing
"by luck" under current timing conditions, while genuinely flaky under different
(slower CI machine, different Node version) conditions

✅ CORRECT: treat every act() warning as worth investigating — usually resolved by
wrapping the relevant assertion in waitFor()/findBy*, ensuring the async update is
GENUINELY settled before the test proceeds
```

### ⚠️ Pitfall 2: Putting Side Effects Inside a `waitFor()` Callback
```tsx
// ❌ WRONG: waitFor's callback may be RE-RUN MULTIPLE TIMES during polling — a side effect
// (like clicking a button) inside it fires MULTIPLE TIMES, not once, as the callback retries
await waitFor(() => {
  fireEvent.click(retryButton); // ❌ fires on EVERY poll attempt until the assertion passes!
  expect(screen.getByText('Success')).toBeInTheDocument();
});

// ✅ CORRECT: side effects happen ONCE, outside waitFor; only the ASSERTION goes inside it
fireEvent.click(retryButton);
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

### ⚠️ Pitfall 3: Using a Fixed `setTimeout`-Based Delay Instead of `waitFor`/`findBy`
```tsx
// ❌ FLAKY AND SLOW: an arbitrary fixed delay either isn't long enough (flaky failures under
// load) or is needlessly longer than necessary (slowing down the whole test suite for no benefit)
await new Promise((resolve) => setTimeout(resolve, 1000));
expect(screen.getByText('Saved')).toBeInTheDocument();

// ✅ CORRECT: waitFor/findBy poll and resolve THE MOMENT the condition is actually true,
// both faster in the common case and more reliable under variable timing/load
expect(await screen.findByText('Saved')).toBeInTheDocument();
```
