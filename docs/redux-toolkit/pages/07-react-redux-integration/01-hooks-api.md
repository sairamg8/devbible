---
title: "React-Redux Hooks: `useSelector`, `useDispatch` & Typed Wrappers"
sidebar_label: "React-Redux Hooks"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the React-Redux documentation for **react-redux 9.3.0**, the version
> that travels with **@reduxjs/toolkit 2.12.0** —
> [hooks API](https://react-redux.js.org/api/hooks),
> [`Provider`](https://react-redux.js.org/api/provider).
> Documentation-validated; **no sandbox run**. ⚠️ The hooks page does **not** document `useSelector`'s
> internals, so no claim is made here about `useSyncExternalStore` or context propagation.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 React-Redux Hooks: `useSelector`, `useDispatch` & Typed Wrappers

## 1. Under-The-Hood Mechanics

`<Provider store={store}>` puts the store instance onto React Context. Every hook below reads from that context — there is no prop drilling, and (critically) no Context re-render cascade the way a naive `useContext` value would cause, because `useSelector` does **not** subscribe via Context value changes.

### `useSelector`: What the Documentation Actually Guarantees
`useSelector(selectorFn)` subscribes the component to the store and re-renders it when the selected
value changes. The documented behaviour, and the part you can rely on:

1. The selector runs **whenever the component renders**, and **whenever an action is dispatched**.
2. After a dispatch, the new result is compared with the previous one using **strict `===` reference
   equality** — *"not shallow equality"*, as the docs put it — or with the `equalityFn` you pass as the
   second argument.
3. The component re-renders only if that comparison fails.

The consequence that costs the most performance in practice: *"Returning a new object every time will
always force a re-render by default."* An inline
`useSelector(state => ({ a: state.a, b: state.b }))` builds a fresh object literal on every call, which
is never `===` to the previous one, so the component re-renders on **every dispatch in the application**
whether or not `a` or `b` changed.

⚠️ **On the internals, this page deliberately says nothing.** You will read that `useSelector` "calls
`store.subscribe()` directly and bypasses React context entirely" — the React-Redux hooks documentation
does not state that, and it is not a claim this corpus is willing to make without a primary source. What
matters for using it correctly is above: per-component subscription, `===` by default, and re-render
only on a failed comparison.

### `useDispatch` & `useStore`
`useDispatch()` returns the store's `dispatch` function, stable across renders — safe to omit from dependency arrays. `useStore()` returns the raw store instance for rare imperative use (e.g. reading state inside an event handler without subscribing to updates) — reaching for it in place of `useSelector` skips the reactive re-render subscription entirely, so it's the wrong tool for anything that should update the UI.

### Typed Hooks Pattern
Plain `useSelector`/`useDispatch` are untyped against your specific `RootState`/`AppDispatch`. The idiomatic TypeScript pattern pre-binds the generics **once** into project-local hooks, so every call site gets full autocomplete without repeating `<RootState>` everywhere:

```typescript
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

---

## 2. Real-World Engineering Scenario

**Scenario**: Large Dashboard With Dozens of Independently-Updating Widgets.
A dashboard renders 40 widgets, each subscribed via `useAppSelector` to its own narrow slice of state (`selectWidgetById(id)`). Because each `useSelector` call subscribes independently and compares only its own slice's output, updating one widget's data (a single dispatch changing `state.widgets.byId['w_12']`) only re-renders that one widget's component — not all 40 — despite all of them technically reading from the same global store.

---

## 3. Production-Grade Code Example

```typescript
// app/hooks.ts — the ONE place typed hooks are defined; imported everywhere else, never plain react-redux hooks
import { useDispatch, useSelector, useStore } from 'react-redux';
import type { RootState, AppDispatch, AppStore } from './store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
```

```tsx
import { shallowEqual } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { widgetRefreshed } from './dashboardSlice';

function Widget({ widgetId }: { widgetId: string }) {
  const dispatch = useAppDispatch();

  // Selecting a derived object: MUST pass shallowEqual, or this re-renders on every dispatch
  const { title, value, trend } = useAppSelector(
    (state) => ({
      title: state.widgets.byId[widgetId].title,
      value: state.widgets.byId[widgetId].value,
      trend: state.widgets.byId[widgetId].trend,
    }),
    shallowEqual
  );

  return (
    <div className="widget">
      <h3>{title}</h3>
      <span>{value} ({trend})</span>
      <button onClick={() => dispatch(widgetRefreshed(widgetId))}>Refresh</button>
    </div>
  );
}
```

```tsx
// Provider setup — root of the app
import { Provider } from 'react-redux';
import { store } from './app/store';

function Root() {
  return (
    <Provider store={store}>
      <Dashboard />
    </Provider>
  );
}
```

---

## Gotchas

### Returning a new object literal without an equality function
**Symptom.** A component re-renders on every dispatch anywhere in the app, including actions that touch
nothing it reads.
**Cause.** The default comparison is `===`, and an object literal is a new reference every call. The
comparison can never succeed.
**Fix.** Separate primitive selections, or `shallowEqual`.
```tsx
// ❌ WRONG: object literal is a new reference every render — re-renders on EVERY dispatch, even unrelated ones
const { title, value } = useSelector((state) => ({ title: state.a.title, value: state.a.value }));

// ✅ CORRECT: either destructure into separate primitive useSelector calls, or pass shallowEqual
const { title, value } = useSelector(
  (state) => ({ title: state.a.title, value: state.a.value }),
  shallowEqual
);
```

### `shallowEqual` on a nested object
**Symptom.** Adding `shallowEqual` fixes nothing; the component still re-renders constantly.
**Cause.** Shallow means one level. If a selected field is itself a freshly-built object or array, its
reference differs and the shallow comparison fails just as `===` did.
**Fix.** Select primitives, or memoize the derived value with `createSelector` so the reference is
stable — see [`createSelector`](../05-selectors-and-normalization/01-create-selector-and-reselect.md).

### `useStore()` where `useSelector()` was needed
**Symptom.** A value that renders correctly once and then never updates — the component looks frozen.
**Cause.** `useStore` returns the store instance without subscribing. Reading `getState()` during render
gives a snapshot with no reactivity.
**Fix.** `useStore` is for imperative reads inside event handlers, where subscribing would be wrong.
```tsx
// ❌ WRONG: reads a value once but never re-renders when it changes — appears "stuck"
const store = useStore();
const value = store.getState().counter.value;

// ✅ CORRECT: useSelector actively subscribes and re-renders on change
const value = useSelector((state) => state.counter.value);
```

### A selector that throws while data is loading
**Symptom.** A crash on first render, or during logout, in a selector that "obviously" works.
**Cause.** The selector runs on every render **and** every dispatch — including renders before data
arrives and the dispatch that clears state on logout. `state.user.profile.name` throws the moment
`profile` is null.
**Fix.** Optional chaining and a default in the selector itself, not at the call site:
`useSelector(state => state.user.profile?.name ?? '')`.

### Importing the plain hooks in feature code
**Symptom.** `state` is `unknown` or `any` at hundreds of call sites; a slice reshape produces no
compile errors where it should.
**Cause.** `useSelector`/`useDispatch` imported straight from `react-redux` know nothing about your
`RootState` or your middleware-extended dispatch.
**Fix.** Define typed hooks once and ban the direct import with a lint rule.
```typescript
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
```

### Putting `dispatch` in a dependency array and worrying about it
**Symptom.** Effects re-running, or reviewers arguing about whether `dispatch` belongs in the deps.
**Cause.** Uncertainty about its identity.
**Fix.** `useDispatch()` returns the store's `dispatch`, which is stable for the lifetime of the store.
Including it is harmless and satisfies the lint rule; it will not cause the effect to re-run.

### Selecting the whole state
**Symptom.** `useSelector(state => state)` — every component re-renders on every action.
**Cause.** The root reference changes on any change anywhere, so the `===` check fails universally.
**Fix.** Select the narrowest thing the component actually needs. This is the pathological case of the
first gotcha and it appears surprisingly often in code written in a hurry.

## Interview questions

**★ How does `useSelector` decide whether to re-render?**
It runs the selector whenever the component renders and whenever an action is dispatched, then compares
the result with the previous one using strict `===` by default — explicitly *not* shallow equality — or
with the `equalityFn` passed as the second argument. The component re-renders only when that comparison
fails. Everything about `useSelector` performance follows from that one sentence.

**★ Why does returning an object from a selector cause re-renders on unrelated dispatches?**
Because the default comparison is by reference and an object literal is a new reference every time the
selector runs. The docs put it directly: returning a new object every time will always force a re-render.
The selector runs after every dispatch, so the component re-renders after every dispatch in the whole
application. Fix it with separate primitive selections, `shallowEqual`, or a memoized selector.

**★ Why are typed hooks the standard pattern rather than annotating each call?**
Because it puts the store's contract in one place. Plain `useSelector` does not know `RootState`, and
plain `useDispatch` returns Redux's base `Dispatch`, which does not know your middleware exists — so
`dispatch(someThunk())` is a type error. `useDispatch.withTypes<AppDispatch>()` and
`useSelector.withTypes<RootState>()` bind both once; every call site then gets inference for free, and a
slice reshape surfaces as errors exactly where the shape is read.

**★ Forty widgets subscribe to the same store. Why doesn't one dispatch re-render all forty?**
Each `useSelector` call maintains its own subscription and its own previous result, and compares only its
own slice of the output. A dispatch that changes `widgets.byId['w_12']` produces an unchanged — and so
reference-equal — result for the other thirty-nine selectors, and they do not re-render. Sharing one
store does not mean sharing one re-render boundary.

**When is `useStore` the right hook?**
When you need to read state imperatively at a moment in time and specifically do **not** want a
subscription — most often inside an event handler or callback that fires rarely and reads a lot. Using it
in the render path is the classic misuse: the value is correct once and then never updates, which
presents as a frozen component rather than an error.

**Is `dispatch` stable across renders?**
Yes. It is the store's own `dispatch`, and the store outlives the component, so its identity does not
change. That makes it safe to omit from dependency arrays, though including it is harmless and keeps the
exhaustive-deps lint rule quiet.

**A selector crashes during logout. Why, and how do you make it robust?**
Because selectors run on every dispatch, including the one that resets state to its initial shape. A
selector reaching through `state.user.profile.name` runs against the cleared state before the component
unmounts and throws. Guard inside the selector with optional chaining and a default rather than at the
call site, so every consumer inherits the safety.

---

← [Middleware stack & `listenerMiddleware`](../06-middleware/01-default-middleware-and-listener-middleware.md) · [Topic index](../README.md) · Next → [Immer internals](../08-immutability-and-immer/01-immer-internals.md)
