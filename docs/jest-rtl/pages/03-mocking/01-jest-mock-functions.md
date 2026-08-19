---
title: "Mocking: jest.fn, jest.spyOn, Module Hoisting & Fake Timers"
sidebar_label: "Mocking"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against Jest 29.7 / 30.x documentation — [Mock Functions](https://jestjs.io/docs/mock-functions) and [Timer Mocks](https://jestjs.io/docs/timer-mocks).

Jest provides deterministic isolation through standalone mock spies (`jest.fn`), existing method interception (`jest.spyOn`), hoisted module replacements (`jest.mock`), and controllable event loop timers (`jest.useFakeTimers`).

---

## 1. Under-The-Hood Mechanics

Jest's mocking ecosystem operates across three distinct scopes of abstraction:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ 1. Standalone Function (`jest.fn()`)                                      │
│    Creates an isolated mock function with no original implementation.     │
│    Tracks `.mock.calls`, `.mock.results`, `.mock.instances`.              │
└───────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ 2. Method Spy (`jest.spyOn(targetObject, 'methodName')`)                 │
│    Wraps an existing method. By default, calls through to REAL logic.     │
│    Replaced with `.mockImplementation()`, reversible via `.mockRestore()`.│
└───────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ 3. Module Replacement (`jest.mock('./modulePath', factoryFn)`)            │
│    Hoisted by Babel/SWC to the TOP of the file (before imports execute).  │
│    Replaces entire module exports across all importing files in suite.    │
└───────────────────────────────────────────────────────────────────────────┘
```

### Mock Lifecycle Management: Clear vs Reset vs Restore
Understanding mock cleanup prevents state leakage between tests:

| Method | Clears Call History? | Resets Return Values / Implementations? | Restores Original Real Method? |
|---|---|---|---|
| `jest.clearAllMocks()` | ✅ Yes (`.mock.calls = []`) | ❌ No (keeps `mockReturnValue`) | ❌ No |
| `jest.resetAllMocks()` | ✅ Yes | ✅ Yes (reverts to empty `jest.fn()`) | ❌ No |
| `jest.restoreAllMocks()`| ✅ Yes | ✅ Yes | ✅ Yes (restores original `spyOn` implementation) |

### Module Hoisting Mechanics
When `jest.mock('./api')` is called, Jest's transform pipeline (Babel / SWC / ts-jest) hoists the call to the very top of the compiled file, before any `import` statement. Variables defined outside the factory function cannot be referenced inside `jest.mock()` unless prefixed with `mock` (e.g. `const mockUser = ...`).

---

## 2. Real-World Engineering Scenario

**Scenario**: Testing a debounced typeahead search service that queries an external analytics SDK and caches results.

A search input debounces user keystrokes by 300ms, calls an external analytics tracker, and persists query results. If tested with real wall-clock timers and network calls, the test suite would be slow and flaky. `jest.useFakeTimers()` fast-forwards debounce timers synchronously in 0ms, while `jest.spyOn()` tracks analytics calls without making real HTTP requests.

---

## 3. Production-Grade Code Example

```typescript
// searchService.test.ts
import { searchService } from './searchService';
import { analytics } from './analytics';

// Partial module mock: preserve real module except for specific exports
jest.mock('./apiClient', () => {
  const actual = jest.requireActual('./apiClient');
  return {
    ...actual,
    fetchSearchResults: jest.fn(),
  };
});

import { fetchSearchResults } from './apiClient';

describe('Search Service & Timer Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('debounces search queries and logs analytics call', async () => {
    const analyticsSpy = jest.spyOn(analytics, 'trackSearch');
    const mockedFetch = fetchSearchResults as jest.MockedFunction<typeof fetchSearchResults>;
    mockedFetch.mockResolvedValue([{ id: '1', title: 'React Guide' }]);

    // Trigger rapid typing
    searchService.handleQueryChange('r');
    searchService.handleQueryChange('re');
    searchService.handleQueryChange('react');

    // Fast-forward 299ms: timer has not elapsed, fetch should NOT have fired
    jest.advanceTimersByTime(299);
    expect(mockedFetch).not.toHaveBeenCalled();

    // Fast-forward 1ms more (300ms total): timer fires
    jest.advanceTimersByTime(1);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith('react');

    // Verify spy tracked method call
    expect(analyticsSpy).toHaveBeenCalledWith({
      query: 'react',
      timestamp: expect.any(Number),
    });

    analyticsSpy.mockRestore();
  });
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: `ReferenceError: Cannot access 'variable' before initialization` inside `jest.mock()`
- **Cause**: Babel/SWC hoists `jest.mock()` above top-level `const` definitions. Variables declared outside the factory cannot be accessed inside it.
- **Fix**: Define mock data inline inside the `jest.mock()` factory, or prefix variable names with `mock` (e.g. `const mockUserData = ...`), which Jest's transform allows through hoisting boundaries.

### Symptom: `jest.spyOn(obj, 'method')` causes tests to execute real network/database calls
- **Cause**: `jest.spyOn()` wraps the existing method but calls through to the original implementation by default.
- **Fix**: Chain `.mockImplementation(() => ...)` or `.mockResolvedValue(...)` immediately to override real execution.

### Symptom: `jest.advanceTimersByTime()` causes infinite event loop freeze
- **Cause**: The component code contains `setInterval` or recursive `setTimeout` without an exit condition. Advancing time indefinitely keeps triggering synchronous iterations.
- **Fix**: Use `jest.runOnlyPendingTimers()` or advance by an exact, finite millisecond interval.

---

## 5. Interview Questions & Deep Dives

### ★ 1. What is the difference between `jest.clearAllMocks()`, `jest.resetAllMocks()`, and `jest.restoreAllMocks()`?
**Answer**:
- `clearAllMocks`: Resets call counts, arguments, and recorded instances (`.mock.calls = []`), but retains mock implementations and return values.
- `resetAllMocks`: Clears call history AND resets mock implementations back to `() => undefined`.
- `restoreAllMocks`: Clears call history, resets implementations, AND restores original un-spied methods for spies created with `jest.spyOn()`.

### ★ 2. Why does Jest hoist `jest.mock()` to the top of the file, and how do you mock only one export while keeping the rest real?
**Answer**: Jest hoists `jest.mock()` so that the mock is registered in the module registry before any ES module `import` executes. To perform partial mocking, use `jest.requireActual('./modulePath')` inside the mock factory:
```typescript
jest.mock('./module', () => ({
  ...jest.requireActual('./module'),
  mockedExport: jest.fn(),
}));
```

### 3. How do modern fake timers differ from legacy fake timers in Jest?
**Answer**: Legacy fake timers mocked global `setTimeout`/`clearTimeout` objects directly in JavaScript. Modern fake timers (based on `@sinonjs/fake-timers`) mock the underlying Node.js `process.hrtime`, `performance.now()`, microtasks queue, and `Date` object, ensuring seamless support for Promises, async microtasks, and system clock advances.

### 4. What happens if you spy on a method on an imported ES module namespace (`import * as api from './api'`)?
**Answer**: In strict ESM, module namespace objects are immutable (sealed and frozen). Spying on `api.method` will throw `TypeError: Cannot assign to read only property`. In Babel/Jest CommonJS emulation, this works because namespaces are transpiled to plain objects, but under native ESM (`--experimental-vm-modules`), module mocking must be done via `jest.unstable_mockModule()` or dependency injection.

---

## Where this connects

- **Previous**: [02 · Assertions & Matchers](../02-assertions-and-matchers/01-the-expect-api.md) — Assertion API and `.mock.calls` inspection.
- **Next**: [04 · Async Testing](../04-async-testing/01-handling-asynchrony.md) — Handling Promises, async/await, and microtask queues.
- **Modern MSW Alternative**: [12 · Mocking Network Requests](../12-mocking-network-requests/01-api-level-mocking.md) — Intercepting network requests at the transport layer instead of function mocking.
