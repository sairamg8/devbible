---
title: "Testing Hooks: `renderHook()`, `result.current` & `rerender()`"
sidebar_label: "Testing Hooks"
sidebar_position: 1
---

# 🧪 Testing Hooks: `renderHook()`, `result.current` & `rerender()`

## 1. Under-The-Hood Mechanics

Custom hooks can't be called directly outside a component (React enforces the Rules of Hooks) — `renderHook()` solves this by mounting the hook inside a minimal, invisible **test host component** automatically, giving the test direct access to the hook's return value without needing to author a throwaway component by hand for every hook test.

```
renderHook(() => useCounter(0))
        │
        ▼
Internally renders a hidden host component that calls useCounter(0) and exposes its result
        │
        ▼
{ result, rerender, unmount } = renderHook(...)
        │
        ├── result.current   ──► the hook's CURRENT return value — re-read after each act()-wrapped update
        ├── rerender(newArgs)  ──► re-invokes the hook with NEW arguments/props, simulating a parent re-render
        └── unmount()             ──► triggers the hook's cleanup (e.g. a useEffect's return function)
```

### `act()` Wrapping for State-Updating Calls
Just as with component testing, any call that triggers a state update inside the hook (calling a function the hook returned, like `result.current.increment()`) needs to happen inside `act()` (or a `user-event` call, which already wraps it) so React fully flushes the update before `result.current` is read again — reading `result.current` immediately after an un-wrapped update risks seeing a stale value.

### `rerender()`: Testing a Hook's Reactivity to Changing Inputs
A hook that behaves differently based on its arguments (e.g. `useDebounce(value, delay)`) needs its reactivity to **changing** arguments tested, not just its initial behavior — `rerender(newProps)` simulates the hook's host component receiving new props/arguments, exactly as a real consuming component's re-render would.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Custom `useLocalStorage` Hook's Reactivity to a Changing Key Prop Going Untested Until a Real Bug Surfaced.
A `useLocalStorage(key)` hook was only ever tested with a single, fixed key — its initial-load behavior was well covered, but nothing verified what happened if the `key` argument itself changed after the hook was already mounted (a real scenario: a user switching between different saved drafts, each with its own storage key). A production bug emerged where changing the key didn't correctly re-read from the new key's storage value. Adding a `renderHook` test using `rerender({ key: 'draft-2' })` after an initial render with `{ key: 'draft-1' }` reproduced the exact bug in isolation — the hook's dependency array was missing `key`, so it never re-ran its read logic when the key prop itself changed.

---

## 3. Production-Grade Code Example

```typescript
// useCounter.ts — the hook under test
import { useState, useCallback } from 'react';

export function useCounter(initialValue: number) {
  const [count, setCount] = useState(initialValue);
  const increment = useCallback(() => setCount((c) => c + 1), []);
  const reset = useCallback(() => setCount(initialValue), [initialValue]);
  return { count, increment, reset };
}
```

```typescript
// useCounter.test.ts
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

test('increments the count', () => {
  const { result } = renderHook(() => useCounter(0));

  act(() => {
    result.current.increment(); // a state-updating call — MUST be wrapped in act()
  });

  expect(result.current.count).toBe(1); // re-read AFTER the act()-wrapped update has flushed
});

test('reset returns to the CURRENT initialValue, reflecting prop changes via rerender', () => {
  const { result, rerender } = renderHook(({ initialValue }) => useCounter(initialValue), {
    initialProps: { initialValue: 0 },
  });

  act(() => { result.current.increment(); });
  expect(result.current.count).toBe(1);

  rerender({ initialValue: 10 }); // simulates the CONSUMING component re-rendering with a new prop
  act(() => { result.current.reset(); });
  expect(result.current.count).toBe(10); // reset correctly used the NEW initialValue, not the original 0
});
```

```typescript
// Testing a hook's cleanup logic via unmount()
test('cleans up an event listener on unmount', () => {
  const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
  const { unmount } = renderHook(() => useWindowResize());

  unmount();

  expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting to Wrap a State-Updating Call in `act()`
```typescript
// ❌ WRONG: calling a state-updating function without act() risks reading result.current
// BEFORE React has fully flushed the update — can produce a stale value or an act() warning
result.current.increment();
expect(result.current.count).toBe(1); // may read the OLD value, or trigger a warning

// ✅ CORRECT: wrap state-updating calls in act()
act(() => { result.current.increment(); });
expect(result.current.count).toBe(1);
```

### ⚠️ Pitfall 2: Testing Only a Hook's Initial Behavior, Never Its Reactivity to Changing Args
```typescript
// ❌ INCOMPLETE: only ever calling renderHook() ONCE with fixed initial arguments misses
// bugs in how the hook responds to those arguments CHANGING later — exactly the class of
// bug in the useLocalStorage scenario above
const { result } = renderHook(() => useLocalStorage('draft-1'));
// no rerender() with a different key ever tested

// ✅ CORRECT: use rerender() to verify the hook behaves correctly when its inputs change,
// not just on its very first render
const { result, rerender } = renderHook(({ key }) => useLocalStorage(key), { initialProps: { key: 'draft-1' } });
rerender({ key: 'draft-2' }); // verifies REACTIVITY, not just initial mount behavior
```

### ⚠️ Pitfall 3: Forgetting `unmount()` When Testing Cleanup-Dependent Hooks
A hook registering a subscription, event listener, or timer in a `useEffect` needs its **cleanup function** (the effect's return value) verified too — a test that never calls `unmount()` never actually exercises that cleanup path at all, potentially missing a genuine memory-leak bug (a listener that's registered but never correctly removed) that would only surface as a real production issue after many mount/unmount cycles.
