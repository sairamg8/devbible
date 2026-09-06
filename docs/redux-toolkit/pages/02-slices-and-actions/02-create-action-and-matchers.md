---
title: "`createAction` & Action Matchers: Standalone Actions Outside Slices"
sidebar_label: "`createAction` & Action Matchers"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`createAction`](https://redux-toolkit.js.org/api/createAction),
> [matching utilities](https://redux-toolkit.js.org/api/matching-utilities).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 `createAction` & Action Matchers: Standalone Actions Outside Slices

## 1. Under-The-Hood Mechanics

`createAction(type)` produces exactly what `createSlice` generates internally for each reducer key, but standalone — useful for actions that don't belong to any single slice's reducer map (cross-cutting events like `'app/resetAll'`, or actions consumed only via `extraReducers`/middleware).

```typescript
const resetAll = createAction('app/resetAll');
resetAll();            // { type: 'app/resetAll' }
resetAll.type;          // 'app/resetAll' — usable as a plain string for comparison
resetAll.match(action);   // type-narrowing predicate: returns true iff action.type === 'app/resetAll'
```

Every action creator produced by RTK (whether via `createSlice` or `createAction`) carries a `.match()` predicate and a `.type` string property — this is what makes `extraReducers.addCase(someAction, ...)` type-safe: TypeScript narrows the `action` parameter's payload type based on which creator was passed.

### The full set of matcher utilities

RTK exports seven matchers, and most codebases only ever discover the first two. All of them are
composable predicates that plug into `builder.addMatcher()`, `listenerMiddleware.startListening({ matcher })`
and any plain `if` in middleware:

| Matcher | True when |
|---|---|
| `isAnyOf(a, b, …)` | **at least one** of the given creators or type guards matches the action |
| `isAllOf(a, b, …)` | **all** of the given predicates match the same single action |
| `isPending(…thunks)` | the action is a `pending` action from `createAsyncThunk` |
| `isFulfilled(…thunks)` | the action is a `fulfilled` action |
| `isRejected(…thunks)` | the action is a `rejected` action — from a throw **or** from `rejectWithValue` |
| `isRejectedWithValue(…thunks)` | the action is a `rejected` action created **specifically** by `rejectWithValue` |
| `isAsyncThunkAction(…thunks)` | the action is any of the three lifecycle actions of the given thunks |

Called with **no arguments** the lifecycle matchers are wildcards: `isPending()` matches the `pending`
action of *every* thunk in the app. Called **with** thunks they narrow to those, and — the part that
earns them their keep — they narrow the TypeScript type of `action` accordingly, so
`action.payload` is typed inside the handler.

```typescript
// One global loading counter, without naming a single thunk
builder
  .addMatcher(isPending(), (state) => { state.inFlight += 1; })
  .addMatcher(isAnyOf(isFulfilled(), isRejected()), (state) => { state.inFlight -= 1; });

// One toast handler for every *expected* failure, ignoring genuine crashes
builder.addMatcher(isRejectedWithValue(), (state, action) => {
  state.toast = String(action.payload);   // typed: this is the rejectWithValue payload
});
```

🔴 **`isRejected` and `isRejectedWithValue` are not interchangeable.** `isRejected` fires for both an
uncaught throw inside the payload creator and a deliberate `rejectWithValue(...)`. Only the latter puts
a structured value on `action.payload` — which is exactly why a handler written against `isRejected`
that reads `action.payload` gets `undefined` for the crash case.

`isAllOf` exists to intersect a matcher with a hand-written type guard, not to express "one of these":

```typescript
const isRecoverable = (action: unknown): action is { payload: { retryable: true } } =>
  typeof action === 'object' && (action as any)?.payload?.retryable === true;

builder.addMatcher(isAllOf(isRejectedWithValue(), isRecoverable), (state) => {
  state.showRetryButton = true;
});
```

---

## 2. Real-World Engineering Scenario

**Scenario**: Cross-Slice "Session Ended" Event.
When a session expires — whether from an explicit logout, a 401 from any RTK Query endpoint, or an idle-timeout — a dozen different slices (cart, notifications, drafts, recently-viewed) all need to clear sensitive state. Rather than each slice importing and listening to three separate action creators, a single standalone `sessionEnded = createAction('session/ended')` is dispatched from one place, and every slice's `extraReducers` uses `isAnyOf(sessionEnded)` to react uniformly.

---

## 3. Production-Grade Code Example

```typescript
import { createAction, createSlice, isAnyOf, PayloadAction } from '@reduxjs/toolkit';
import { apiSlice } from '../api/apiSlice';

// Standalone action — no owning slice
export const sessionEnded = createAction<{ reason: 'logout' | 'expired' | '401' }>('session/ended');

interface DraftsState {
  unsavedDrafts: Record<string, string>;
}

const draftsSlice = createSlice({
  name: 'drafts',
  initialState: { unsavedDrafts: {} } as DraftsState,
  reducers: {
    saveDraft: (state, action: PayloadAction<{ id: string; text: string }>) => {
      state.unsavedDrafts[action.payload.id] = action.payload.text;
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      // React to session ending OR any RTK Query 401 mutation error, whichever fires first
      isAnyOf(sessionEnded, apiSlice.endpoints.getProfile.matchRejected),
      (state, action) => {
        state.unsavedDrafts = {};
      }
    );
  },
});

export const { saveDraft } = draftsSlice.actions;
export const draftsReducer = draftsSlice.reducer;

// Dispatched from an axios/fetch interceptor or an RTK Query baseQuery wrapper
// store.dispatch(sessionEnded({ reason: '401' }));
```

---

## Gotchas

### A standalone action colliding with a slice's generated type
**Symptom.** Dispatching one action mutates a slice you never wired it to.
**Cause.** Types are plain strings. `createAction('session/ended')` and a slice named `session` with a
reducer key `ended` both produce `'session/ended'`, and **every** reducer listening for that string
runs. The cross-slice scenario above exploits this deliberately; accidentally it is a silent bug that
looks like state corruption.
**Fix.** Namespace standalone actions away from every slice `name` — a convention like `app/` or
`session-event/` for cross-cutting actions, reserved and never used as a slice name.

### Comparing `action.type` to a string literal
**Symptom.** A condition that silently stops matching after someone renames a slice or a reducer key.
**Cause.** The literal is a copy of a value that is generated. Nothing links them, so nothing breaks
at build time when they diverge.
**Fix.** Use the generated predicate, which is also what narrows the payload type.
```typescript
// ❌ FRAGILE: breaks silently if the slice/action name is ever refactored
if (action.type === 'cart/addItem') { ... }

// ✅ CORRECT: refactor-safe, and narrows the payload type in TypeScript
if (addItem.match(action)) { ... }
```

### `isAllOf` where `isAnyOf` was meant
**Symptom.** A matcher that never fires, with no error.
**Cause.** `isAllOf` requires **every** predicate to pass on the same single action.
`isAllOf(actionA, actionB)` asks for one action whose type is simultaneously two different strings —
never true.
**Fix.** `isAnyOf` for "one of these types"; keep `isAllOf` for intersecting a matcher with a type
guard, as in the `isRecoverable` example above.

### Reading `action.payload` in an `isRejected` handler
**Symptom.** A toast reading "undefined" whenever a request fails for an unanticipated reason, while
the handled failures render fine.
**Cause.** `isRejected` covers both rejection routes. A thrown error populates `action.error`, not
`action.payload`; only `rejectWithValue` populates `payload`.
**Fix.** Match on the narrower predicate when you need the value, and fall back explicitly.
```typescript
builder
  .addMatcher(isRejectedWithValue(), (state, action) => { state.toast = String(action.payload); })
  .addMatcher(isRejected(), (state, action) => { state.toast = action.error.message ?? 'Unknown error'; });
```
🔴 Order matters: cases run first, then matchers **in the order added**, and *all* matching matchers
run. Put the narrow one first so the broad one's write is the fallback, not the winner.

### A bare `isPending()` matcher in an app that also uses RTK Query
**Symptom.** A global loading spinner that never turns off, or a counter that drifts below zero.
**Cause.** RTK Query's internal endpoints are themselves thunks, so a wildcard `isPending()` matches
their lifecycle actions too — including ones whose `fulfilled`/`rejected` you did not pair.
**Fix.** Name the thunks you mean — `isPending(fetchUser, submitOrder)` — or pair every increment with
matchers over the identical thunk list, never a wildcard on one side and a list on the other.

### Expecting `createAction`'s creator to carry a payload type it was never given
**Symptom.** `action.payload` is `any` at every call site.
**Cause.** `createAction('session/ended')` with no generic produces a creator taking no argument. The
payload type comes from the generic, or from a `prepare` callback's return.
**Fix.** `createAction<{ reason: 'logout' | 'expired' | '401' }>('session/ended')` — as in the example
above — or supply a `prepare` function and let RTK infer from it.

## Interview questions

**★ When would you use `createAction` instead of just adding a reducer to a slice?**
When the action does not belong to any one slice. A session-ended event that a dozen slices react to
has no natural owner: putting it in `authSlice` forces every other slice to import `authSlice`, which
inverts the dependency direction you want. A standalone action is owned by nobody, dispatched from one
place, and consumed through `extraReducers` — so the slices stay independent of each other.

**★ What is `.match()` and why is it better than comparing `action.type`?**
Every RTK action creator carries a `.match(action)` predicate and a `.type` string. `.match` is a
TypeScript **type guard**, so inside the `if` the compiler knows the action's payload type — a string
comparison gives you `unknown`. It is also refactor-safe: renaming the slice changes the generated type
and every `.match` call follows, while a hand-written string literal silently stops matching.

**★ What is the difference between `isRejected` and `isRejectedWithValue`?**
`isRejected` matches every rejection, whether the payload creator threw or called `rejectWithValue`.
`isRejectedWithValue` matches only the deliberate route. The distinction is load-bearing because only
`rejectWithValue` populates `action.payload` — a thrown error populates `action.error` instead. A
handler that reads `payload` under `isRejected` renders `undefined` for real crashes.

**How do you implement a single global "requests in flight" counter without listing every thunk?**
Wildcard lifecycle matchers: `addMatcher(isPending(), inc)` and
`addMatcher(isAnyOf(isFulfilled(), isRejected()), dec)`. The caveat worth raising unprompted is that in
an app using RTK Query the wildcards also match its internal endpoint thunks, so the pairing must be
symmetric — a wildcard increment against a named-thunk decrement is how the counter drifts.

**What does `isAllOf` actually do, and what is it not for?**
It requires every predicate to pass on the *same* action, so it is for intersecting a matcher with a
custom type guard — "a rejected-with-value action whose payload is retryable". It is not an OR; asking
for an action that is simultaneously two different types matches nothing and fails silently, which is
the most common misuse.

**Two different things dispatch `'session/ended'` and both reducers run. Bug or feature?**
Both, depending on intent. Action types are strings, so a standalone `createAction('session/ended')` and
a `session` slice with an `ended` reducer key generate the identical type, and everything listening runs.
Deliberately, that is a clean fan-out. Accidentally, it presents as state changing for no visible reason.
The defence is a naming convention that keeps standalone action namespaces disjoint from slice names.

---

← [`createSlice` · selectors & creators](./01b-slice-selectors-and-creator-callback.md) · [Topic index](../README.md) · Next → [`createAsyncThunk`](../03-async-thunks/01-create-async-thunk.md)
