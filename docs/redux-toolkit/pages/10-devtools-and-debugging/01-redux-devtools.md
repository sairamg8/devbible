---
title: "Redux DevTools: Time-Travel, Action Replay & Trace Mode"
sidebar_label: "Redux DevTools"
sidebar_position: 1
---

# 📦 Redux DevTools: Time-Travel, Action Replay & Trace Mode

## 1. Under-The-Hood Mechanics

`configureStore` auto-wires the store to the Redux DevTools browser extension in development (`devTools: true` is the default when `NODE_ENV !== 'production'`). The extension works by subscribing to every dispatched action and snapshotting the resulting state, building an in-memory **action log**.

```
dispatch(action) ──► reducer produces newState ──► DevTools extension records { action, newState }
                                                              │
                                                              ▼
                                        Action Log: [ { action: A, state: S1 }, { action: B, state: S2 }, ... ]
```

### Time-Travel Debugging
Because every recorded entry pairs an action with the **exact** resulting state snapshot, DevTools can jump the live store back to any historical entry by dispatching `@@INIT` internally and replaying actions up to the selected index — this is only possible because reducers are pure functions and state is immutable (both guaranteed by Immer + the invariant-check middleware in dev).

### Action Diffing
Selecting any entry in the log shows a structural diff between that state and the previous entry — invaluable for spotting an unintended mutation (a diff appearing somewhere the reducer shouldn't have touched signals a bug immediately).

### Trace Mode
`devTools: { trace: true, traceLimit: 25 }` captures a JS stack trace at the moment each action is dispatched, letting DevTools show **exactly which line of code** called `dispatch()` — critical in a large codebase where the same action type might be dispatched from a dozen different call sites.

---

## 2. Real-World Engineering Scenario

**Scenario**: Reproducing a Rare Race-Condition Bug Reported by QA.
QA reports that a cart total is occasionally wrong after rapidly clicking "add to cart" while a coupon is being applied. Rather than adding console.logs and guessing, an engineer reproduces the sequence live, then uses DevTools' time-travel slider to step through the exact action sequence that triggered the bug, diffing state at each step until the exact reducer responsible for the incorrect total is identified — turning a "sometimes happens" bug into a deterministic, one-command repro (`DevTools → Export` produces a JSON action log a teammate can re-import and replay exactly).

---

## 3. Production-Grade Code Example

```typescript
import { configureStore } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: { /* ... */ },
  devTools: process.env.NODE_ENV !== 'production' && {
    name: 'MyApp',
    trace: true,           // capture stack traces for every dispatched action
    traceLimit: 25,          // cap trace depth to avoid noisy/huge traces
    actionsDenylist: ['analytics/pageViewed'], // hide high-frequency, low-value actions from the log
    // actionSanitizer / stateSanitizer can redact sensitive fields (tokens, PII) before they hit the extension
    actionSanitizer: (action) =>
      action.type === 'auth/loginSucceeded'
        ? { ...action, payload: { ...action.payload, token: '<redacted>' } }
        : action,
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Shipping `devTools: true` (or Leaving It Unset) to Production
```typescript
// ❌ RISKY: DevTools defaults to enabled based on NODE_ENV, but a misconfigured build pipeline
// (e.g. NODE_ENV accidentally 'development' in a prod deploy) exposes the entire action/state log,
// including any unredacted auth tokens or PII passed through actions, to anyone with the browser extension.
devTools: true,

// ✅ CORRECT: explicitly gate on environment, and sanitize sensitive fields regardless
devTools: process.env.NODE_ENV !== 'production' && { actionSanitizer, stateSanitizer },
```

### ⚠️ Pitfall 2: High-Frequency Actions Bloating the DevTools Log
Actions dispatched on every scroll/mousemove/keystroke (without throttling) can balloon the DevTools action log to tens of thousands of entries within seconds, making the extension itself sluggish or crash the tab. Use `actionsDenylist`/`actionsAllowlist` to exclude noisy, low-value action types from being recorded at all.

### ⚠️ Pitfall 3: Relying on Time-Travel With Non-Serializable or Impure State
Time-travel replay only works correctly if reducers are pure and state is fully serializable — a reducer that reads `Date.now()` or `Math.random()` internally (instead of receiving them via the action payload) will **not** reproduce the same state on replay, because re-running that reducer during a time-travel jump calls `Date.now()`/`Math.random()` again with a different result. Keep all non-determinism in the action payload, never inside the reducer body.
