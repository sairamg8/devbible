---
title: "Mocking: `jest.fn()`, `jest.spyOn()`, `jest.mock()` & Fake Timers"
sidebar_label: "Mocking"
sidebar_position: 1
---

# 🧪 Mocking: `jest.fn()`, `jest.spyOn()`, `jest.mock()` & Fake Timers

## 1. Under-The-Hood Mechanics

Jest's mocking tools each replace a different **scope** of real behavior — a standalone function, one method on an otherwise-real object, or an entire module — and picking the wrong scope either under-isolates a test (real dependencies still run) or over-isolates it (mocking away behavior the test actually needed to exercise).

```
jest.fn()           ──► a brand-new mock function, with NO prior implementation, tracking every call
jest.spyOn(obj, 'method')  ──► WRAPS an EXISTING method — by default still calls through to the REAL
                                  implementation, tracking calls, UNLESS you also call .mockImplementation()
jest.mock('./module')        ──► replaces an ENTIRE module's exports — auto-mocked (every export becomes
                                    a jest.fn()) unless a factory function or a __mocks__ file provides
                                    a specific manual mock shape
```

### `jest.fn()`: Configuring Return Behavior
```javascript
const mockFn = jest.fn();
mockFn.mockReturnValue(42);              // every call returns 42
mockFn.mockImplementation((a, b) => a + b); // full custom logic per call
mockFn.mockResolvedValue({ id: 1 });        // returns a Promise resolving to this value — for mocking async functions
mockFn.mockRejectedValueOnce(new Error());     // the NEXT call only rejects; subsequent calls use the default behavior
```

### `jest.spyOn()`: Preserving Real Behavior by Default
Unlike `jest.fn()` (starts with no implementation at all), `jest.spyOn(console, 'error')` **still calls the real `console.error`** by default — it only adds call-tracking. This matters when a test wants to assert "was this called" WITHOUT changing the actual behavior (e.g. verifying an error was logged, while still letting the real logging happen) — calling `.mockImplementation()` on a spy is what actually replaces the real behavior, an explicit opt-in step, not the default.

### `jest.mock()`: Auto-Mock vs Factory vs Manual `__mocks__`
- **Auto-mock** (`jest.mock('./api')` with no factory) — every export becomes an empty `jest.fn()` automatically; useful when the test will configure each function's behavior itself per-test.
- **Factory function** (`jest.mock('./api', () => ({ fetchUser: jest.fn() }))`) — explicit control over the mock's exact shape, inline in the test file.
- **Manual `__mocks__` directory** — a sibling `__mocks__/api.js` file provides a reusable, shared mock implementation for a given module, automatically picked up by `jest.mock('./api')` with no factory needed, ideal for a mock shape reused across many test files.

### Fake Timers: Controlling Time Deterministically
`jest.useFakeTimers()` replaces the real `setTimeout`/`setInterval`/`Date` with controllable fake equivalents — `jest.advanceTimersByTime(1000)` synchronously fast-forwards fake time, letting a test verify debounce/throttle/retry-delay logic **instantly**, without actually waiting for real wall-clock time to pass.

---

## 2. Real-World Engineering Scenario

**Scenario**: Testing a Debounced Search Input Without the Test Actually Waiting 300ms.
A search input's debounce logic waits 300ms after the last keystroke before firing an API call — testing this naively (with real timers) would mean the test suite actually pauses for 300ms per test, and testing edge cases (multiple rapid keystrokes resetting the timer) would require carefully-timed real delays, making tests slow and flaky. `jest.useFakeTimers()` combined with `jest.advanceTimersByTime(300)` let the test simulate "300ms has passed" **instantly and deterministically**, verifying the debounce fired exactly once (not once per keystroke) with zero actual wall-clock delay and zero timing-related flakiness.

---

## 3. Production-Grade Code Example

```javascript
// jest.fn() — configuring mock return behavior for a dependency-injected function
test('processes items and reports success', async () => {
  const mockSave = jest.fn().mockResolvedValue({ success: true });
  const result = await processAndSave(['item1', 'item2'], mockSave);

  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave).toHaveBeenNthCalledWith(1, 'item1');
  expect(result.success).toBe(true);
});
```

```javascript
// jest.spyOn() — preserving real behavior while asserting a call happened
test('logs an error when validation fails, without swallowing the real log output', () => {
  const errorSpy = jest.spyOn(console, 'error'); // real console.error STILL runs, just also tracked

  validateInput(''); // internally calls console.error('Invalid input')

  expect(errorSpy).toHaveBeenCalledWith('Invalid input');
  errorSpy.mockRestore(); // restores the ORIGINAL, un-spied console.error afterward
});
```

```javascript
// jest.mock() with a manual __mocks__ file — reused across many test files
// __mocks__/analytics.js
export const trackEvent = jest.fn();

// someComponent.test.js
jest.mock('../lib/analytics'); // automatically picks up __mocks__/analytics.js — no factory needed here
import { trackEvent } from '../lib/analytics';

test('tracks a click event', () => {
  renderAndClickButton();
  expect(trackEvent).toHaveBeenCalledWith('button_clicked');
});
```

```javascript
// Fake timers — testing debounce logic without real wall-clock delay
jest.useFakeTimers();

test('debounces rapid calls into a single execution', () => {
  const mockSearch = jest.fn();
  const debouncedSearch = debounce(mockSearch, 300);

  debouncedSearch('a');
  debouncedSearch('ab');
  debouncedSearch('abc'); // rapid calls — should only actually fire ONCE, for the LAST value

  jest.advanceTimersByTime(300); // instantly simulates 300ms passing, no real delay

  expect(mockSearch).toHaveBeenCalledTimes(1);
  expect(mockSearch).toHaveBeenCalledWith('abc');
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `jest.spyOn()` Still Calls the Real Implementation by Default
```javascript
// ❌ SURPRISING: without .mockImplementation(), a spy on a function that makes a REAL network
// call still makes that REAL call — spyOn alone does NOT isolate the test from real side effects
const fetchSpy = jest.spyOn(apiClient, 'fetchUser'); // still hits the REAL API unless further configured!

// ✅ CORRECT: explicitly override the implementation if the test needs to avoid the real behavior
const fetchSpy = jest.spyOn(apiClient, 'fetchUser').mockResolvedValue({ id: 1, name: 'Alex' });
```

### ⚠️ Pitfall 2: Forgetting to Reset Mocks Between Tests, Leaking Call History
```javascript
// ❌ RISKY: without resetting, a mock's accumulated call count/history from a PREVIOUS test
// leaks into the next test — `toHaveBeenCalledTimes(1)` might unexpectedly see 2, from a prior test
test('A', () => { mockFn(); expect(mockFn).toHaveBeenCalledTimes(1); });
test('B', () => { mockFn(); expect(mockFn).toHaveBeenCalledTimes(1); }); // ❌ actually 2, if not reset!

// ✅ CORRECT: reset mock state between tests, typically via a global beforeEach
beforeEach(() => { jest.clearAllMocks(); }); // or configure clearMocks:true in jest.config.js globally
```

### ⚠️ Pitfall 3: Forgetting to Restore Real Timers After `useFakeTimers()`
```javascript
// ❌ RISKY: leaving fake timers active across test files (if not properly scoped/restored)
// can cause OTHER, unrelated tests relying on real setTimeout/Date behavior to hang or misbehave
jest.useFakeTimers();
// ... test using fake timers ...
// missing jest.useRealTimers() afterward

// ✅ CORRECT: always restore real timers after a test/suite that used fake ones
afterEach(() => { jest.useRealTimers(); });
```
