---
title: "Migrating From Classic Redux to RTK"
sidebar_label: "Migrating From Classic Redux to RTK"
sidebar_position: 1
---

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Migrating Reducers and Rewriting Action Type Strings in the Same PR
Renaming `'cart/ADD_ITEM'` to RTK's default-generated `'cart/addItem'` in the same change that also converts the reducer breaks any existing `redux-saga` `take('cart/ADD_ITEM')` calls, any analytics middleware pattern-matching on the old string, and any persisted/replayed action logs — bundling a naming convention change with a mechanical reducer migration multiplies the blast radius of a single PR. Keep the old type strings during the reducer migration; rename in a clearly separate, later change.

### ⚠️ Pitfall 2: Assuming `getDefaultMiddleware()` Composes Safely With an Existing Thunk-Incompatible Saga Setup
`getDefaultMiddleware()` includes `redux-thunk` by default. If the existing codebase relies on `redux-saga` exclusively and never expects a function to be dispatched, leaving thunk enabled is usually harmless — but if the app has custom middleware that assumes **every** dispatched action is a plain object (e.g. a logging middleware doing `JSON.stringify(action)`), an accidentally-dispatched thunk function will crash that middleware. Explicitly pass `{ thunk: false }` if thunk isn't wanted yet, and enable it deliberately once other middleware is audited.

### ⚠️ Pitfall 3: Big-Bang Migrating All Reducers Before Verifying Store-Level Equivalence
Skipping the store-setup-only migration step (Step 1 above) and attempting to convert `createStore` *and* all 25 reducers *and* rip out sagas in one pass removes the ability to isolate which specific change introduced a regression if something breaks. Migrate in the order: store setup → one slice at a time → middleware/saga replacement last, each step independently verified by the existing test suite before moving to the next.
