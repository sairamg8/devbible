---
title: "Migrating From Classic Redux to RTK"
sidebar_label: "Migrating From Classic Redux to RTK"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [migrating to modern Redux](https://redux.js.org/usage/migrating-to-modern-redux),
> [RTK 2.0 migration](https://redux-toolkit.js.org/usage/migrating-rtk-2),
> and the [redux-thunk](https://github.com/reduxjs/redux-thunk) README.
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 Migrating From Classic Redux to RTK

## 1. Under-The-Hood Mechanics

RTK is not a different state model from classic Redux — the store, `dispatch`, `subscribe`, and the reducer-pure-function contract are unchanged. RTK is a set of code-generation and ergonomics layers **on top of** the exact same primitives, which is precisely what makes incremental migration possible instead of requiring a rewrite.

### `configureStore` Replaces Hand-Assembled `createStore`
```typescript
// Classic Redux — manual composition
import { createStore, combineReducers, applyMiddleware, compose } from 'redux';
// ⚠️ redux-thunk 2.x had a DEFAULT export (`import thunk from 'redux-thunk'`). 3.x — the version
// that ships alongside RTK 2.0 — is a NAMED export. Copying the old line against current deps
// hands `applyMiddleware` an `undefined`.
import { thunk } from 'redux-thunk';

const rootReducer = combineReducers({ cart: cartReducer, users: usersReducer });
const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const store = createStore(rootReducer, composeEnhancers(applyMiddleware(thunk)));
```
⚠️ **Two things in that "before" snippet are themselves out of date on the pinned versions**, and both
bite people who copy an old tutorial into a current codebase:

- **`createStore` is deprecated.** Redux 5 shows it struck through in editors. It "will continue to work
  indefinitely, and will *not* ever be removed" — the deprecation is a signpost toward `configureStore`,
  not a removal notice. If you genuinely need the old constructor without the warning, import
  `legacy_createStore`.
- **`redux-thunk` 3.x is a named export.** The default import above is the 2.x form.

`configureStore({ reducer: { cart: cartReducer, users: usersReducer } })` produces a **functionally equivalent** store — `combineReducers`, `redux-thunk`, and DevTools wiring are all handled internally — meaning the migration for this layer is often a pure deletion of boilerplate with no reducer logic changes at all.

### Migrating Switch-Statement Reducers to `createSlice`
A classic `switch (action.type) { case 'ADD_ITEM': return {...state, ...} }` reducer and its hand-written action creators/type constants can be ported to `createSlice` incrementally, **one slice at a time**, because `createSlice`'s output (`reducer`, `actions`) plugs into an existing `combineReducers`/`configureStore` tree exactly like the old reducer did — other untouched slices don't need to change in the same PR.

### Interop With Existing `redux-saga`/`redux-observable` Middleware
`configureStore`'s `middleware` callback accepts arbitrary additional middleware via `.concat()`, so an existing saga/observable middleware stack keeps running unmodified alongside RTK's default stack during an incremental migration — sagas don't need to be ported in the same effort as slices do.

---

## 2. Real-World Engineering Scenario

**Scenario**: 3-Year-Old Codebase With 25 Hand-Written Reducers, Migrating Incrementally Over Several Sprints.
A team cannot justify a big-bang rewrite of a production app's entire state layer. The migration path: (1) swap `createStore(...)` for `configureStore(...)` in one PR — a behavior-preserving change verified by the existing test suite passing unchanged; (2) convert reducers to `createSlice` one feature at a time, in isolation, since `combineReducers` doesn't care whether a given reducer function was hand-written or `createSlice`-generated; (3) leave `redux-saga` running untouched for the handful of complex sequential-effect flows it already handles well, while new features use `createAsyncThunk`/`listenerMiddleware` going forward.

---

## 3. Production-Grade Code Example

```typescript
// STEP 1: Store setup migration — behavior-preserving, no reducer changes needed yet
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { rootSaga } from './sagas/rootSaga';
import { legacyCartReducer } from '../features/cart/legacyCartReducer'; // untouched classic reducer
import { usersSlice } from '../features/users/usersSlice';                 // already migrated to RTK

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: {
    cart: legacyCartReducer,          // still a hand-written switch-statement reducer — untouched
    users: usersSlice.reducer,          // migrated slice — coexists fine in the same tree
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware), // keep sagas driving effects for now
});

sagaMiddleware.run(rootSaga);
```

```typescript
// STEP 2 (a later sprint): converting the legacy cart reducer to createSlice, in isolation
// BEFORE:
function legacyCartReducer(state = initialState, action: any) {
  switch (action.type) {
    case 'cart/ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'cart/REMOVE_ITEM':
      return { ...state, items: state.items.filter((i: any) => i.id !== action.payload) };
    default:
      return state;
  }
}

// AFTER: same external action type strings preserved intentionally, so any saga still
// listening for 'cart/ADD_ITEM' via `take('cart/ADD_ITEM')` keeps working unmodified
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    ADD_ITEM: (state, action) => { state.items.push(action.payload); },
    REMOVE_ITEM: (state, action) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
  },
});
```

---

## Gotchas

### Renaming action types in the same PR that converts the reducer
**Symptom.** A saga stops firing, an analytics dashboard goes flat, or replayed action logs no longer
match — all at once, in a change that "only" converted a reducer.
**Cause.** `createSlice` generates `` `${name}/${key}` ``, so accepting the default names rewrites every
type string. Anything matching on those strings — `take('cart/ADD_ITEM')`, middleware, persisted logs —
is coupled to them.
**Fix.** Keep the old strings during the conversion, even where they look unidiomatic, and rename in a
separate, clearly-scoped change afterwards.
```typescript
// Same external action type strings preserved intentionally, so any saga still
// listening for 'cart/ADD_ITEM' via `take('cart/ADD_ITEM')` keeps working unmodified
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    ADD_ITEM: (state, action) => { state.items.push(action.payload); },
  },
});
```

### Leaving thunk enabled next to middleware that assumes plain objects
**Symptom.** A logging or analytics middleware throws on a dispatched function.
**Cause.** `getDefaultMiddleware()` includes thunk. Legacy middleware written for a saga-only codebase may
do `JSON.stringify(action)` or read `action.type` unguarded.
**Fix.** `getDefaultMiddleware({ thunk: false })` during the transition, and enable it deliberately once
the other middleware is audited. Guarding the legacy middleware is the better long-term fix.

### Big-bang migration
**Symptom.** Something regresses and there is no way to tell which of twenty-five changes caused it.
**Cause.** Converting the store, every reducer and the effect layer at once removes every intermediate
state where the test suite could have told you something.
**Fix.** Store setup first — a behaviour-preserving change the existing suite should pass unmodified —
then one slice at a time, then the effect layer last. Each step independently verified.

### Assuming a hand-written reducer must be converted before the store can be
**Symptom.** The migration stalls because "we can't use `configureStore` until the reducers are slices".
**Cause.** A misconception. `configureStore` calls `combineReducers`, which does not care how a reducer
function was produced.
**Fix.** Mix freely — `{ cart: legacyCartReducer, users: usersSlice.reducer }` is a perfectly ordinary
reducer map, and it is what makes incremental conversion possible at all.

### Mutating state in a reducer that Immer does not wrap
**Symptom.** A converted slice works; an unconverted neighbour, "tidied up" in the same spirit, corrupts
state silently.
**Cause.** Immer wraps `createSlice` reducer bodies. A hand-written reducer in the same store gets no
draft, so mutation there is real mutation.
**Fix.** Until a reducer is a slice, it keeps the spread-and-copy discipline. The dev-only immutability
check is what catches the slip — one more reason to migrate the store first, since that check arrives
with `configureStore`.

### Keeping `redux-thunk` as an explicit dependency after migrating
**Symptom.** Two copies of thunk, or a version conflict after an upgrade.
**Cause.** RTK bundles it; an explicit dependency left in `package.json` can resolve to a different
version.
**Fix.** Drop the direct dependency and let RTK provide it. If you do import it directly on 3.x, remember
it is `import { thunk } from 'redux-thunk'`.

### Migrating to RTK and keeping hand-rolled data fetching
**Symptom.** The store is modern, and 80% of it is still `pending`/`fulfilled`/`rejected` triples around
CRUD.
**Cause.** Treating the migration as a syntax exercise. `createSlice` removes boilerplate from reducers;
it removes none from server-state management.
**Fix.** Plan a second phase where CRUD moves to RTK Query. That is usually where the real reduction in
code lives, and it is a separate decision from the reducer conversion — worth scoping explicitly rather
than discovering halfway through.

## Interview questions

**★ Why can a classic Redux codebase migrate to RTK incrementally rather than all at once?**
Because RTK is not a different state model. The store, `dispatch`, `subscribe` and the reducer contract are
unchanged — RTK is code generation and ergonomics on top of the same primitives. `combineReducers` accepts
a `createSlice`-generated reducer and a hand-written switch statement side by side without knowing or
caring which is which, so a slice can be converted in isolation without touching its neighbours.

**★ What is the correct order of migration, and why that order?**
Store setup, then reducers one at a time, then the effect layer. `createStore` → `configureStore` is
behaviour-preserving, so the existing test suite passing unchanged is real evidence — and it brings the
dev-time immutability and serializability checks that make every later step safer. Reducers convert
independently. Sagas last, because replacing an effect layer is a genuine behaviour change and deserves to
be isolated from everything else.

**★ What is the most damaging mistake in a reducer conversion, and why?**
Renaming action types in the same change. `createSlice` generates `` `${name}/${key}` ``, so taking the
defaults silently rewrites every type string — and sagas, analytics middleware, persisted state and
replayable action logs are all coupled to those strings. The reducer change is mechanical and reviewable;
bundling a rename with it multiplies the blast radius and makes a regression impossible to bisect.

**Is `createStore` removed in Redux 5?**
No. It is marked deprecated and appears struck through in editors, but the docs say it "will continue to
work indefinitely, and will not ever be removed". The deprecation is a signpost toward `configureStore`.
`legacy_createStore` is the same function exported without the deprecation marking, for code that needs it
without the noise.

**Can `redux-saga` and RTK coexist?**
Yes, and during a migration they should. `configureStore`'s middleware callback takes arbitrary middleware
via `.concat()`, so the saga middleware runs alongside RTK's defaults unchanged. The judgement call is
whether to keep the sagas permanently: for complex sequential effects they remain reasonable, but new work
generally goes to `createAsyncThunk` or `listenerMiddleware`, and running two effect systems indefinitely
has its own cost.

**What does migrating to `createSlice` not fix?**
Server-state management. It removes reducer and action-creator boilerplate, but a codebase whose bulk is
fetch-and-cache logic still has all of it — the same lifecycle triple in every slice, plus hand-rolled
deduplication and invalidation. That is RTK Query's territory, and it is worth scoping as an explicit
second phase rather than being surprised by how little the first phase removed.

---

← [Testing thunks & RTK Query](../12-testing/01b-testing-thunks-and-rtk-query.md) · [Topic index](../README.md)
