---
title: "Redux DevTools: Time-Travel, Action Replay & Trace Mode"
sidebar_label: "Redux DevTools"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`configureStore`](https://redux-toolkit.js.org/api/configureStore) (the `devTools` option) and the
> [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools) README.
> Documentation-validated; **no sandbox run** — no extension session was recorded to produce the
> behaviour described here.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

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

## Gotchas

### Shipping the DevTools connection to production
**Symptom.** Anyone with the browser extension can read your entire action log and state tree on the
live site — including whatever tokens or PII travelled through an action payload.
**Cause.** `devTools` defaults to enabled based on `NODE_ENV`, and a build pipeline that fails to set it
correctly leaves the connection live.
**Fix.** Gate explicitly rather than relying on the default, and sanitize regardless.
```typescript
// ❌ RISKY: DevTools defaults to enabled based on NODE_ENV, but a misconfigured build pipeline
// exposes the entire action/state log to anyone with the browser extension.
devTools: true,

// ✅ CORRECT: explicitly gate on environment, and sanitize sensitive fields regardless
devTools: process.env.NODE_ENV !== 'production' && { actionSanitizer, stateSanitizer },
```

### High-frequency actions drowning the log
**Symptom.** The extension becomes unusable within seconds, or the tab crashes.
**Cause.** Actions dispatched per scroll, mousemove or keystroke, each with a state snapshot.
**Fix.** `actionsDenylist` / `actionsAllowlist` keep them out of the recording entirely — cheaper than
recording and filtering.

### Relying on time-travel with an impure reducer
**Symptom.** Replaying to step 12 produces different state than the live run did.
**Cause.** Time-travel re-runs reducers. A reducer calling `Date.now()` or `Math.random()` computes new
values on replay, so the "same" sequence yields different results.
**Fix.** All non-determinism belongs in the action payload, generated at dispatch time — which is
exactly what `prepare` is for. Keep reducers pure and replay is exact.

### A `trace` limit left uncapped
**Symptom.** The extension slows noticeably, and each action carries an enormous stack.
**Cause.** `trace: true` captures a stack per dispatch. Without `traceLimit` the whole stack is kept.
**Fix.** `{ trace: true, traceLimit: 25 }`. Enough to identify the call site, bounded enough to stay
usable — and remember tracing has a real cost even in development.

### Sanitizers that mutate the action
**Symptom.** Redacted values appear in the app itself, not merely in the extension.
**Cause.** `actionSanitizer`/`stateSanitizer` run on the values you hand them; mutating rather than
copying changes what the app sees.
**Fix.** Always return a new object — `{ ...action, payload: { ...action.payload, token: '<redacted>' } }`
— never assign into the original.

### Expecting the extension to show RTK Query cache internals usefully
**Symptom.** The action log fills with `api/executeQuery/...` entries that obscure application actions.
**Cause.** RTK Query is implemented in terms of ordinary actions, so all of its internal traffic is
recorded.
**Fix.** Denylist the pattern while debugging app logic, and remember the RTK Query cache is inspectable
as ordinary state under its `reducerPath` — often more useful than reading its actions.

## Interview questions

**★ How does time-travel debugging actually work?**
The extension records every dispatched action together with the state that resulted. Jumping to an
earlier point replays the recorded action sequence from the initial state up to the selected index. That
is only sound because Redux guarantees the two properties it depends on: reducers are pure functions, so
replaying the same actions produces the same states, and state is immutable, so a snapshot cannot be
altered after the fact.

**★ What breaks time-travel, and how do you avoid it?**
Impurity in reducers. A reducer that reads `Date.now()`, `Math.random()` or anything ambient computes
fresh values on replay, so the recorded sequence no longer reproduces the recorded states. The discipline
is to generate all non-determinism at dispatch time and carry it in the payload — which is precisely what
`prepare` exists for. Non-serializable values in state break it for a related reason: the extension
cannot snapshot what it cannot serialize.

**★ What would you configure before letting a team use DevTools on a real product?**
Three things. An explicit environment gate rather than the `NODE_ENV` default, because a misconfigured
build otherwise exposes the whole action log to anyone with the extension. `actionSanitizer` and
`stateSanitizer` to redact tokens and PII, returning copies rather than mutating. And an
`actionsDenylist` for high-frequency noise, so the log stays readable and the tab stays alive.

**What does `trace: true` give you, and what does it cost?**
A JavaScript stack captured at each dispatch, so the extension can show which line called `dispatch` —
genuinely valuable when the same action type is dispatched from a dozen places. It costs a stack capture
per action, so pair it with `traceLimit` to bound the depth and treat it as a development-only tool.

**Your action log is full of `api/executeQuery` entries. What is happening?**
RTK Query is built on ordinary Redux actions, so every cache subscription, fetch and invalidation shows
up in the log. It is not a misconfiguration. Denylist the pattern while debugging application logic, and
inspect the cache as state under its `reducerPath` instead — the state view answers "what is cached"
better than the action log does.

---

← [TypeScript integration](../09-typescript-integration/01-type-inference-patterns.md) · [Topic index](../README.md) · Next → [Code splitting](../11-code-splitting/01-dynamic-reducer-injection.md)
