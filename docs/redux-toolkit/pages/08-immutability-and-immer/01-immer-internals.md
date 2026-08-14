---
title: "Immer Internals: Proxy Drafts & The Mutate-Or-Return Rule"
sidebar_label: "Immer Internals"
sidebar_position: 1
---

# 📦 Immer Internals: Proxy Drafts & The Mutate-Or-Return Rule

## 1. Under-The-Hood Mechanics

Every reducer function passed to `createSlice` is automatically wrapped in `Immer.produce()`. This is the single mechanism that makes "mutating" syntax (`state.count += 1`) safe and immutable under the hood.

```
produce(baseState, recipe)
        │
        ├── Immer wraps baseState in a Proxy ──► "draft"
        │
        ├── recipe(draft) runs — your reducer body
        │       │
        │       └── every property read/write on `draft` is intercepted by the Proxy traps
        │
        ├── Immer records which paths were touched
        │
        └── produces a new object: unchanged branches keep their ORIGINAL references (structural sharing),
            only the touched branches get fresh references
```

### Structural Sharing
If a reducer mutates `state.cart.items[2].quantity`, Immer produces a new root object, a new `cart` object, and a new `items` array — but `state.cart.items[0]` and `state.cart.items[1]` (untouched) are the **exact same object references** as before. This is why `React.memo`/`useSelector` reference-equality checks work efficiently against Immer-produced state: untouched branches never trigger a re-render, because their reference genuinely didn't change.

### The Golden Rule: Mutate the Draft, OR Return a New Value — Never Both
Immer's `produce` has exactly two valid modes per call:
- **Mutate** the `draft` parameter, return `undefined` (implicitly, by not returning anything).
- **Return** a brand new value from the recipe, and don't touch `draft` at all.

Doing both in the same function is a bug: Immer detects the mix and throws `[Immer] An immer producer returned a new value *and* modified its draft`.

### Returning `undefined` on Purpose vs by Accident
Because "mutate and return nothing" is the normal case, a reducer that means to **replace** state entirely (e.g. resetting to `initialState`) must explicitly `return initialState;` — returning `undefined` from a branch that intended a full reset instead just means "no changes were made," silently keeping the old state.

---

## 2. Real-World Engineering Scenario

**Scenario**: Deeply Nested Kanban Board State (Columns → Cards → Checklist Items).
A Kanban board's state is naturally deeply nested: `board.columns[i].cards[j].checklist[k].done`. Hand-written immutable updates to a 4-level-deep field require ugly nested spreads (`{...board, columns: board.columns.map((c, i) => i === colIdx ? {...c, cards: ...} : c)}`). Immer lets the reducer write `state.columns[colIdx].cards[cardIdx].checklist[itemIdx].done = true` directly — readable, and still fully immutable and structurally-shared under the hood.

---

## 3. Production-Grade Code Example

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ChecklistItem { id: string; text: string; done: boolean; }
interface Card { id: string; title: string; checklist: ChecklistItem[]; }
interface Column { id: string; title: string; cards: Card[]; }
interface BoardState { columns: Column[]; }

const initialState: BoardState = { columns: [] };

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    checklistItemToggled: (
      state,
      action: PayloadAction<{ columnId: string; cardId: string; itemId: string }>
    ) => {
      const column = state.columns.find((c) => c.id === action.payload.columnId);
      const card = column?.cards.find((c) => c.id === action.payload.cardId);
      const item = card?.checklist.find((i) => i.id === action.payload.itemId);
      if (item) {
        item.done = !item.done; // 4 levels deep — Immer's Proxy traps this write safely
      }
      // Nothing returned: this is the "mutate the draft" mode. Correct.
    },

    boardReset: (state) => {
      // Explicit RETURN mode — replaces the entire state tree. Also correct, but a DIFFERENT mode
      // than the mutation above; the two are never combined in a single reducer.
      return initialState;
    },
  },
});

export const { checklistItemToggled, boardReset } = boardSlice.actions;
export const boardReducer = boardSlice.reducer;
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Mutating State Outside an Immer-Wrapped Reducer
```typescript
// ❌ WRONG: this mutation happens inside a plain async callback, NOT inside the Immer-wrapped
// reducer function body — there is no draft Proxy here, so this silently mutates the real object
// in place, corrupting the store outside of any dispatch and bypassing all subscribers.
someAsyncUtility(async () => {
  const card = selectCardById(store.getState(), cardId);
  card.title = 'Renamed'; // NOT SAFE — this is real state, not an Immer draft!
});

// ✅ CORRECT: all state changes go through dispatch → a reducer, which IS Immer-wrapped
dispatch(cardRenamed({ cardId, title: 'Renamed' }));
```

### ⚠️ Pitfall 2: Returning AND Mutating in the Same Reducer Branch
```typescript
// ❌ THROWS at runtime: "[Immer] An immer producer returned a new value *and* modified its draft"
reducer: (state, action) => {
  state.columns.push(action.payload);
  return { ...state };
}

// ✅ Pick exactly one mode
reducer: (state, action) => { state.columns.push(action.payload); }
```

### ⚠️ Pitfall 3: Assuming Immer Drafts Work With Class Instances or Non-Plain Objects
Immer's Proxy trapping is designed for plain objects, arrays, `Map`, and `Set`. Storing a class instance (with private fields or methods) in Redux state and mutating it inside a reducer can produce surprising results, since Immer's draft handling for class instances doesn't preserve prototype methods the way plain-object drafts preserve plain-object shape. Keep Redux state as plain serializable data — this is also required for the `serializableStateInvariantMiddleware` check and DevTools time-travel to work correctly.
