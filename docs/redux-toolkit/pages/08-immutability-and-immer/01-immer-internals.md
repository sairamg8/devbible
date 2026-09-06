---
title: "Immer Internals: Proxy Drafts & The Mutate-Or-Return Rule"
sidebar_label: "Immer Internals"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Immer documentation (Immer 10, bundled with
> **@reduxjs/toolkit 2.12.0**) —
> [returning new data](https://immerjs.github.io/immer/return),
> [complex objects](https://immerjs.github.io/immer/complex-objects),
> and [`createSlice`](https://redux-toolkit.js.org/api/createSlice).
> Documentation-validated; **no sandbox run**. ⚠️ Immer's docs mark the mutate-and-return pattern as
> disallowed but do **not** publish a verbatim error string, so none is quoted here.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

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

Doing both in the same function is a bug, and Immer rejects it at runtime rather than guessing which
answer you meant. The documentation marks the pattern plainly — *"NOT OK: modifying draft **and**
returning a new state"* — against exactly this shape:

```javascript
draft.userCount += 1
return {users: [...draft.users, action.payload]}
```

### Returning `undefined` on Purpose vs by Accident
Because "mutate and return nothing" is the normal case, a reducer that means to **replace** state
entirely — resetting to `initialState`, say — must explicitly `return initialState`. Returning
`undefined` from a branch that intended a full reset just means "no changes were made", and the old
state survives silently.

🔴 **This is a genuine limitation, not a convention.** The docs are explicit that *"it is not possible to
return `undefined` this way, as it is indistinguishable from **not** updating the draft"* — because
*"in JavaScript a function that doesn't return anything also returns `undefined`"*. When you genuinely
want the produced state to *be* `undefined`, Immer provides a token for it:

```typescript
import { nothing } from 'immer';

// produce(state, draft => nothing) produces the value `undefined`
sessionCleared: () => nothing as any,
```
In a Redux slice you will rarely want this — a reducer returning `undefined` state breaks the store's
contract — but it is the answer to "how do I express deliberate undefined", and knowing the token exists
explains why the `return initialState` rule is phrased the way it is.

### What Immer Will and Will Not Draft
The docs draw the line precisely: *"Plain objects (objects without a prototype), arrays, `Map`s and
`Set`s are always drafted by Immer."* Everything else — including every class instance —
*"must use the `immerable` symbol to mark itself as compatible with Immer"*:

```typescript
import { immerable } from 'immer';

class Money {
  [immerable] = true;      // option 1: a class field
  constructor(public cents: number) {}
}
```
An unmarked class instance is simply not drafted: Immer treats it as an opaque value, so "mutating" it
inside a reducer mutates the real object, outside the draft, with none of the structural sharing or
freezing the rest of the tree gets.

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

## Gotchas

### Mutating state outside an Immer-wrapped reducer
**Symptom.** State changes with no dispatch, subscribers do not fire, and DevTools shows nothing.
**Cause.** The Proxy exists only inside the reducer body. A reference obtained from `store.getState()`
is the real object.
**Fix.** Every write goes through a dispatch.
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
In practice you usually get an error rather than silent corruption, because Immer freezes produced
state — but relying on that is relying on a side effect of a different feature.

### Returning **and** mutating in the same branch
**Symptom.** A runtime error from Immer naming a producer that both returned a value and modified its
draft.
**Cause.** Two conflicting answers to "what is the next state".
**Fix.** Pick one mode per branch.
```typescript
// ❌ Immer rejects this at runtime
reducer: (state, action) => {
  state.columns.push(action.payload);
  return { ...state };
}

// ✅ Pick exactly one mode
reducer: (state, action) => { state.columns.push(action.payload); }
```

### A concise arrow body that returns the mutation's result
**Symptom.** The same error, from a reducer that appears to only mutate.
**Cause.** `state.items.push(x)` evaluates to the new `length`. A concise arrow returns it.
**Fix.** Keep the block braces — `(state, action) => { state.items.push(action.payload); }`.

### A class instance in the store
**Symptom.** Methods disappear after a round trip, mutations inside a reducer do not produce a new
reference, or the serializability check complains.
**Cause.** Immer drafts plain objects, arrays, `Map` and `Set`. A class instance without the `immerable`
symbol is not drafted at all.
**Fix.** Prefer plain serializable data in Redux state — it is also what DevTools time-travel and any
JSON persistence require. If a class genuinely must live in state, mark it with `[immerable] = true` and
accept that it will still trip the serializability check.

### Assuming a `Map` or `Set` in state is a good idea because Immer supports it
**Symptom.** Serializability warnings, and state that does not survive persistence or DevTools export.
**Cause.** Immer drafting and Redux serializability are different requirements. Immer drafts `Map` and
`Set` happily; the store still wants JSON-serializable values.
**Fix.** Use a plain object keyed by id — which is what `createEntityAdapter` produces anyway.

### Reading the draft expecting to see the finished state
**Symptom.** A `console.log(state)` inside a reducer prints Proxy internals, or logging a nested value
shows something unrecognisable.
**Cause.** You are looking at a draft, not a value.
**Fix.** Immer exports `current(draft)` for a plain snapshot of the draft as it stands, and
`original(draft)` for the value before any changes — both are for debugging inside a reducer:
```typescript
import { current, original } from 'immer';
console.log(current(state));    // a plain, finished copy of the draft right now
```

### Expecting structural sharing to survive a spread
**Symptom.** Every row in a list re-renders after changing one item, despite Immer.
**Cause.** A reducer that does `state.items = state.items.map(i => ({ ...i }))` rebuilds every element,
so every reference changes and `React.memo`/`useSelector` see everything as new.
**Fix.** Mutate the one element you mean — `state.items[i].done = true` — and let Immer give new
references to exactly that element and its ancestors. Structural sharing is a property of *what you
touched*, and a wholesale rebuild touches everything.

## Interview questions

**★ How does mutating syntax stay immutable?**
`createSlice` wraps every reducer body in Immer's `produce()`, which hands the reducer a **Proxy draft**
of the current state. Every read and write is intercepted, and Immer records the paths that were
touched. At the end it builds a new state tree using structural sharing: branches you modified get new
references, branches you did not keep the exact objects they had. Your code reads like mutation and the
result is a new immutable tree.

**★ What is structural sharing and why does React care?**
Untouched branches keep their original object references in the new state. That is what makes reference
equality a meaningful signal: `useSelector`'s `===` check and `React.memo` can conclude "this did not
change" from a pointer comparison instead of a deep walk. Without structural sharing, every dispatch
would produce an entirely fresh tree and every subscriber would re-render.

**★ What is Immer's mutate-or-return rule?**
Per call, a recipe may either mutate the draft and return nothing, or return a replacement value and
leave the draft alone — never both. Both in one branch is rejected at runtime, because Immer has two
conflicting answers for the next state. The subtle version is a concise arrow body: `state.items.push(x)`
returns the new length, so the "mutation only" reducer is actually doing both.

**★ Why must a reset reducer `return initialState` rather than just... reset?**
Because returning `undefined` cannot mean "replace with undefined". JavaScript gives `undefined` for any
function that returns nothing, so Immer cannot distinguish a deliberate `undefined` from a recipe that
only mutated — the docs say so explicitly. Returning the replacement value is the unambiguous form.
Immer's `nothing` token exists precisely to express deliberate `undefined`, though a Redux slice rarely
wants it.

**Which values does Immer draft, and what happens to the rest?**
Plain objects, arrays, `Map`s and `Set`s are always drafted. Anything else — every class instance
included — must carry the `immerable` symbol, or it is not drafted at all and is treated as an opaque
value. That is why "mutating" an unmarked class instance in a reducer mutates the real object rather
than a draft, with no new reference produced.

**You need to inspect state inside a reducer and the log is unreadable. What do you use?**
`current(draft)` for a plain snapshot of the draft as it currently stands, and `original(draft)` for the
state before this recipe touched anything. Logging the draft directly shows Proxy machinery, and — worse
— the draft is only valid during the recipe, so holding onto it for later inspection gives you something
revoked.

**One item changes and the whole list re-renders. Immer is in play. What went wrong?**
Almost certainly a reducer that rebuilt the collection rather than editing an element — a `.map` with a
spread, or reassigning `state.items` to a new array. Structural sharing only preserves references you did
not touch, and rebuilding touches everything. Mutating the single element gives new references to that
element and its ancestors only, which is what the memoisation downstream is relying on.

---

← [React-Redux hooks](../07-react-redux-integration/01-hooks-api.md) · [Topic index](../README.md) · Next → [TypeScript integration](../09-typescript-integration/01-type-inference-patterns.md)
