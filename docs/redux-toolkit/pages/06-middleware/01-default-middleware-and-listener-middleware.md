---
title: "Middleware Stack & `listenerMiddleware`"
sidebar_label: "Middleware Stack & `listenerMiddleware`"
sidebar_position: 1
---

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: `.concat()` Instead of `.prepend()` for `listenerMiddleware`
```typescript
// ❌ SUBOPTIMAL: appended, so the whole default stack — including the dev-only deep state
// comparisons — runs before the listener ever sees the action
middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(listenerMiddleware.middleware),

// ✅ CORRECT: RTK's own docs recommend .prepend() so listener effects run as early as possible
middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware),
```

### ⚠️ Pitfall 2: Forgetting `cancelActiveListeners()` in Debounce Patterns
Without explicitly cancelling the previous effect instance, `listenerMiddleware.startListening` runs a **new concurrent** async task on every matching action rather than replacing the old one — for a debounced auto-save, this means every keystroke schedules its own independent 800ms timer, and you get one server save per keystroke once they all elapse, not one save after the user stops typing.

### ⚠️ Pitfall 3: Doing Heavy Synchronous Work Inside Middleware
Any middleware function (custom, or an `effect` doing synchronous work) runs on the **same thread as dispatch**, blocking the UI. Expensive synchronous work (large JSON parsing, deep cloning) belongs in a Web Worker or deferred via `requestIdleCallback`, not inline in middleware, which is meant to be a thin interception point.
