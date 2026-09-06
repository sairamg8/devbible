---
title: "Middleware Stack & `listenerMiddleware`"
sidebar_label: "Middleware Stack & `listenerMiddleware`"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`getDefaultMiddleware`](https://redux-toolkit.js.org/api/getDefaultMiddleware),
> [`createListenerMiddleware`](https://redux-toolkit.js.org/api/createListenerMiddleware),
> [RTK 2.0 migration](https://redux-toolkit.js.org/usage/migrating-rtk-2).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 Middleware Stack & `listenerMiddleware`

## 1. Under-The-Hood Mechanics

Redux middleware sits between `dispatch(action)` and the reducer, forming a chain: `store => next => action => { ... next(action) ... }`. Each middleware can inspect, transform, delay, or short-circuit an action before it reaches the next link in the chain (and ultimately the reducer).

### The Default Stack (`getDefaultMiddleware()`)
```
dispatch(action)
   │
   ▼
actionCreatorInvariantMiddleware (dev only) ──► throws if an action CREATOR was dispatched uncalled
   │
   ▼
immutableStateInvariantMiddleware (dev only) ──► deeply COMPARES state, reports a detected mutation
   │
   ▼
thunk middleware ──► if action is a function, call it with (dispatch, getState) instead of forwarding
   │
   ▼
serializableStateInvariantMiddleware (dev only) ──► warns on non-serializable actions/state
   │
   ▼
your custom middleware (via .concat()/.prepend())
   │
   ▼
reducer
```
All three dev-only middlewares are stripped entirely in production builds — the production array is
just `[thunk]`. They exist purely as development-time guardrails and carry real runtime cost (a deep
state traversal on every dispatch), which is why disabling them for measured performance reasons
should only ever happen in dev, never by shipping them to prod (they already aren't).

🔴 **Note the order, because it is not the one most people assume:** thunk is *third*, not first. The
two checks that run ahead of it are unshifted to the front of the array precisely so they see the
action before a thunk can turn one dispatch into several.

### `listenerMiddleware`: Reactive Side Effects Without Sagas
`createListenerMiddleware()` provides an alternative to redux-saga/redux-observable for side-effect orchestration, using plain async/await instead of generators or Observables:

```typescript
listenerMiddleware.startListening({
  actionCreator: cartItemAdded,          // or `matcher`, or `predicate`
  effect: async (action, listenerApi) => {
    // listenerApi: dispatch, getState, condition(), take(), fork(), cancelActiveListeners(), signal
  },
});
```
Each `effect` runs in its own cancellable async task. `listenerApi.condition(predicate)` lets an effect **pause and wait** for a future action/state change (e.g. "wait until `auth.status === 'authenticated'` before continuing") — the closest RTK gets to a saga's `take()`.

### `createDynamicMiddleware` — adding middleware after the store exists
RTK 2.0 added a middleware you can extend at runtime, which is what code-split features need: a lazily
loaded module cannot be present in the `middleware` callback that ran at store construction.

```typescript
import { createDynamicMiddleware } from '@reduxjs/toolkit';

export const dynamicMiddleware = createDynamicMiddleware();

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(dynamicMiddleware.middleware),
});

// …later, inside a lazily-imported feature module
dynamicMiddleware.addMiddleware(analyticsMiddleware);
```
It pairs with `combineSlices` — see [code splitting](../11-code-splitting/01-dynamic-reducer-injection.md)
— so a feature can arrive with both its reducer and its middleware.

---

## 2. Real-World Engineering Scenario

**Scenario**: Debounced Auto-Save With Cancellation on Rapid Edits.
A rich-text editor dispatches `documentChanged` on every keystroke. Auto-saving on every single dispatch would flood the server. `listenerMiddleware` with `effect` calling `listenerApi.delay(800)` before saving, combined with `listenerApi.cancelActiveListeners()` at the top of the effect, implements debounce-with-cancellation in a few lines — the same pattern that traditionally required `redux-saga`'s `takeLatest` + `delay` combinator.

---

## 3. Production-Grade Code Example

```typescript
import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { documentChanged, saveDocumentToServer } from './editorSlice';
import type { RootState, AppDispatch } from '../../app/store';

export const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: documentChanged,
  effect: async (action, listenerApi) => {
    // Cancel any in-flight auto-save effect from a previous keystroke (debounce)
    listenerApi.cancelActiveListeners();

    // Wait 800ms of quiet before actually saving; if another documentChanged fires, this task is cancelled
    await listenerApi.delay(800);

    const state = listenerApi.getState() as RootState;
    await listenerApi.dispatch(
      saveDocumentToServer({ id: state.editor.docId, content: state.editor.content })
    );
  },
});
```

```typescript
// store.ts — wiring the listener middleware into configureStore
import { configureStore } from '@reduxjs/toolkit';
import { listenerMiddleware } from '../features/editor/editorListeners';

export const store = configureStore({
  reducer: { /* ... */ },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});
```

---

## Gotchas

### `.concat()` where `.prepend()` was wanted for a listener
**Symptom.** Listener effects observe actions later than expected, after every default check has run.
**Cause.** `.concat()` appends; the listener sits at the end of the chain.
**Fix.** RTK's own docs recommend prepending the listener middleware so effects run as early as possible.
```typescript
// ❌ SUBOPTIMAL: appended, so the whole default stack — including the dev-only deep state
// comparisons — runs before the listener ever sees the action
middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(listenerMiddleware.middleware),

// ✅ CORRECT: RTK's own docs recommend .prepend() so listener effects run as early as possible
middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware),
```

### Debouncing without `cancelActiveListeners()`
**Symptom.** One save per keystroke, all arriving at once 800ms after the user stops typing.
**Cause.** `startListening` starts a **new concurrent** task per matching action. Nothing cancels the
previous one, so ten keystrokes schedule ten independent timers that all eventually elapse.
**Fix.** Cancel the previous instances at the top of the effect, before the delay — that pairing is what
makes it `takeLatest` rather than `takeEvery`.
```typescript
effect: async (action, listenerApi) => {
  listenerApi.cancelActiveListeners();   // ← the line that turns this into a debounce
  await listenerApi.delay(800);
  // …save
}
```

### Forgetting that a cancelled effect resumes at the next `await`
**Symptom.** A cancelled auto-save still writes, or a "cancelled" effect logs after its cancellation.
**Cause.** Cancellation is cooperative. `listenerApi.delay()` and `listenerApi.pause()` throw when
cancelled, but ordinary code between awaits keeps running to the next suspension point.
**Fix.** Do the work through the cancellation-aware helpers, and check
`listenerApi.signal.aborted` before anything expensive or irreversible that follows a plain `await`.

### Heavy synchronous work inside middleware
**Symptom.** Dropped frames on dispatch; the profiler shows a long task inside `dispatch`.
**Cause.** Middleware runs on the dispatching thread, synchronously, before the reducer. Large JSON
parsing, deep cloning or crypto there blocks paint.
**Fix.** Middleware is an interception point, not a work queue. Move the work to a Web Worker, or defer
it — a listener `effect` is already async and is the right place for anything slow.

### Middleware that mutates the action instead of dispatching a new one
**Symptom.** DevTools shows an action whose payload does not match what was dispatched; time-travel
replays differently from the live run.
**Cause.** Rewriting `action.payload` in place breaks the assumption that the recorded action is what the
reducers saw.
**Fix.** Forward the original and dispatch a derived action, or build a new action object and pass
*that* to `next()`. Never edit in place.

### Assuming `next` and `dispatch` are interchangeable inside middleware
**Symptom.** An infinite loop, or a middleware earlier in the chain never seeing an action.
**Cause.** `next(action)` passes the action **onward** to the rest of the chain; `dispatch(action)`
restarts it at the top, including the middleware you are currently inside.
**Fix.** `next` to forward, `dispatch` to raise something genuinely new — and guard the latter so it
cannot re-trigger the same middleware branch.

### Adding a middleware for a code-split feature at store construction
**Symptom.** A feature's middleware is in the main bundle even though its reducer is lazily injected.
**Cause.** The `middleware` callback runs once, when the store is built. Anything named there is a static
import.
**Fix.** `createDynamicMiddleware`, prepended once, with the feature calling `addMiddleware` on import —
the middleware counterpart to `rootReducer.inject`.

## Interview questions

**★ What is the middleware signature, and what does each layer let you do?**
`store => next => action => { … }`. The outer function receives the store API (`dispatch`, `getState`),
the middle receives the next link in the chain, the inner receives each action. Because you decide
whether and when to call `next(action)`, a middleware can inspect, transform, delay, duplicate or
swallow an action before it ever reaches the reducer — which is how thunk works: it sees a function,
calls it, and never forwards.

**★ How does `redux-thunk` actually work?**
It checks whether the dispatched value is a function. If it is, it calls it with `(dispatch, getState,
extraArgument)` and returns whatever that call returns, **without** passing it down the chain — so no
reducer ever sees it. If it is not a function, it forwards to `next`. That is the entire library, and
it is why `createAsyncThunk` needs no additional middleware.

**★ How does `listenerMiddleware` compare with redux-saga?**
It covers the same ground — reactive side effects, cancellation, "wait for this action" — with plain
async/await instead of generators and an effect protocol. `listenerApi.condition()` is the analogue of
saga's `take`, `cancelActiveListeners()` gives `takeLatest`, and `fork` gives child tasks. What you give
up is saga's fully synchronous testability, since sagas yield descriptions of effects that a test can
assert on without running them. For most applications that trade is worth it; RTK ships the listener as
the default answer and does not bundle saga.

**★ Implement debounced auto-save with the listener middleware.**
Listen for the change action; at the top of the effect call `cancelActiveListeners()` to kill any
previous in-flight instance, `await listenerApi.delay(800)`, then read state and save. The
cancel-then-delay pairing is the whole trick: without the cancel it is `takeEvery` with a delay, so every
keystroke eventually saves.

**Why does RTK recommend prepending the listener middleware rather than appending it?**
So effects see actions as early as possible, before the rest of the default stack — including two dev-only
middlewares that each walk the entire state tree — has run. It is a positioning preference rather than a
correctness requirement: appended listeners still fire, just later in the chain.

**What is the difference between `next(action)` and `dispatch(action)` inside a middleware?**
`next` forwards to the remainder of the chain and then the reducer. `dispatch` re-enters the chain from
the top, so the action passes through every middleware again, including the current one — which is how
you write an accidental infinite loop. Use `next` to let something through, `dispatch` only to raise a
genuinely new action, and guard against re-entry when you do.

**When would you use `createDynamicMiddleware`?**
When the middleware cannot exist at store-construction time: a lazily loaded feature that brings its own
analytics or socket middleware. The `middleware` callback runs once, so anything referenced there is in
the initial bundle. Prepending a dynamic middleware and calling `addMiddleware` from the feature module
is the middleware half of what `rootReducer.inject` does for reducers.

---

← [`createEntityAdapter`](../05-selectors-and-normalization/02-create-entity-adapter.md) · [Topic index](../README.md) · Next → [React-Redux hooks](../07-react-redux-integration/01-hooks-api.md)
