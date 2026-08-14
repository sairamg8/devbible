---
title: "React-Redux Hooks: `useSelector`, `useDispatch` & Typed Wrappers"
sidebar_label: "React-Redux Hooks"
sidebar_position: 1
---

# 📦 React-Redux Hooks: `useSelector`, `useDispatch` & Typed Wrappers

## 1. Under-The-Hood Mechanics

`<Provider store={store}>` puts the store instance onto React Context. Every hook below reads from that context — there is no prop drilling, and (critically) no Context re-render cascade the way a naive `useContext` value would cause, because `useSelector` does **not** subscribe via Context value changes.

### `useSelector`: Direct Store Subscription, Not Context
`useSelector(selectorFn)` calls `store.subscribe()` directly (bypassing React Context propagation entirely) and forces a **local** re-render of just that one component when:
1. The store notifies of a dispatch, **and**
2. `selectorFn(newState)` is not reference-equal (or not `shallowEqual`, if that comparator is passed as the second argument) to the previous result.

This is why passing an inline selector that returns a new object/array every call (`useSelector(state => ({ a: state.a, b: state.b }))`) causes a re-render on **every single dispatch**, regardless of whether `a`/`b` changed — the default comparator is `===`, and a fresh object literal is never `===` to the last one.

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Returning a New Object Literal Without `shallowEqual`
```tsx
// ❌ WRONG: object literal is a new reference every render — re-renders on EVERY dispatch, even unrelated ones
const { title, value } = useSelector((state) => ({ title: state.a.title, value: state.a.value }));

// ✅ CORRECT: either destructure into separate primitive useSelector calls, or pass shallowEqual
const { title, value } = useSelector(
  (state) => ({ title: state.a.title, value: state.a.value }),
  shallowEqual
);
```

### ⚠️ Pitfall 2: Calling `useStore()` Where `useSelector()` Was Needed
```tsx
// ❌ WRONG: reads a value once but never re-renders when it changes — appears "stuck"
const store = useStore();
const value = store.getState().counter.value;

// ✅ CORRECT: useSelector actively subscribes and re-renders on change
const value = useSelector((state) => state.counter.value);
```

### ⚠️ Pitfall 3: Skipping the Typed Hooks Wrapper in a Growing Codebase
Importing plain `useSelector`/`useDispatch` from `react-redux` directly in feature files means every call site needs its own `<RootState>` annotation, and a later `RootState` shape change requires touching every file. Centralizing `useAppSelector`/`useAppDispatch` once in `app/hooks.ts` (and lint-banning direct `react-redux` hook imports elsewhere) keeps a single source of truth for the app's typed store contract.
