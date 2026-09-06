---
title: "`createAction` & Action Matchers: Standalone Actions Outside Slices"
sidebar_label: "`createAction` & Action Matchers"
sidebar_position: 3
---

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

### Matcher Utilities: `isAnyOf` / `isAllOf`
RTK ships composable action matchers for handling groups of actions with one handler:

- `isAnyOf(actionA, actionB, ...)` — true if the action matches **any** of the given creators or type guards.
- `isAllOf(matcherA, matcherB, ...)` — true only if **all** predicates pass (used to combine a matcher with a custom type guard).

These plug into `builder.addMatcher()` in `extraReducers`, and into RTK Query cache lifecycle logic and `listenerMiddleware.startListening({ matcher })`.

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Colliding Action Type Strings
`createAction('session/ended')` and a slice named `session` with a reducer key `ended` produce **the exact same type string** (`'session/ended'`), and both will fire whenever either is dispatched. This is occasionally exploited intentionally (see the cross-slice scenario above) but is a silent, confusing bug when accidental — namespace standalone actions distinctly from slice names.

### ⚠️ Pitfall 2: Using `action.type === 'string literal'` Instead of `.match()`
```typescript
// ❌ FRAGILE: breaks silently if the slice/action name is ever refactored
if (action.type === 'cart/addItem') { ... }

// ✅ CORRECT: refactor-safe, and narrows the payload type in TypeScript
if (addItem.match(action)) { ... }
```

### ⚠️ Pitfall 3: `isAllOf` Misused Where `isAnyOf` Was Intended
`isAllOf` requires **every** predicate to pass on the same single action — it is not for "match one of these action types," which is `isAnyOf`. A common mistake is reaching for `isAllOf(actionA, actionB)` expecting an OR, which will never match since one action can't equal two different types at once.
