---
title: "The problem and the shape"
sidebar_label: "01 · The problem and the shape"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useReducer`](https://react.dev/reference/react/useReducer),
> [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer),
> [Keeping Components Pure](https://react.dev/learn/keeping-components-pure).
> ⚠️ Community convention, not a React API — see the topic
> [index](README.md). Judgements marked as judgements.
> No sandbox script backs this page; claims are cited, not measured.

**A prop per exception is a debt you pay forever. This is the alternative.**

## The problem

A `useSelect` you wrote closes the menu when an item is picked. Correct — for a
single-select dropdown, which is what you built.

Then a multi-select filter needs it. Picking an item should *not* close the menu,
because the user is about to pick three more.

Four answers, all of which age badly:

| Answer | What goes wrong |
|---|---|
| `closeOnSelect={false}` | Fine once. Then `closeOnBlur`, `clearOnClose`, `resetHighlightOnOpen` — the [configuration trap](../../phase-2-components/03-composition/01-the-configuration-trap.md), one exception at a time |
| Fork the component | Two implementations of the same keyboard handling, drifting from the day it is copied |
| Make everything controlled | The caller now owns `isOpen`, `highlightedIndex`, `inputValue` and must reimplement every transition — you handed them all the work, not just the exception |
| An `onSelect` that returns `false` to cancel | Works for *veto*, and only veto. It cannot express "select, but stay open" |

Each fails the same way: the caller wants to change **one transition**, and you
have made them buy something much larger.

## The shape

The component keeps a reducer describing all its transitions, and accepts a
caller-supplied reducer that sees every proposed change.

```jsx
import { useReducer, useCallback } from 'react';

const actions = {
  open:   'open',
  close:  'close',
  select: 'select',
};

// The component's own transitions — its default behaviour.
function selectReducer(state, action) {
  switch (action.type) {
    case actions.open:
      return { ...state, isOpen: true };
    case actions.close:
      return { ...state, isOpen: false };
    case actions.select:
      return { ...state, selectedItem: action.item, isOpen: false };
    default:
      return state;
  }
}

// The default stateReducer is identity: take the change as proposed.
function useSelect({ stateReducer = (state, action, changes) => changes } = {}) {
  const [state, dispatch] = useReducer(
    (state, action) => {
      const changes = selectReducer(state, action);   // what we would do
      return stateReducer(state, action, changes);    // what the caller allows
    },
    { isOpen: false, selectedItem: null },
  );

  return {
    ...state,
    open:   useCallback(() => dispatch({ type: actions.open }), []),
    close:  useCallback(() => dispatch({ type: actions.close }), []),
    select: useCallback((item) => dispatch({ type: actions.select, item }), []),
  };
}

useSelect.actions = actions;    // now public API — chunk 02 is about this
```

The multi-select caller changes exactly one transition:

```jsx
const select = useSelect({
  stateReducer(state, action, changes) {
    if (action.type === useSelect.actions.select) {
      return { ...changes, isOpen: true };    // keep it open, take the rest
    }
    return changes;                            // everything else unchanged
  },
});
```

## Why the third argument is the whole pattern

The signature is **`(state, action, changes)`** — the state before, the action
that fired, and the component's *proposed* next state.

Compare what the caller writes without `changes`:

```jsx
// Without `changes` — the caller must reimplement the whole transition
stateReducer(state, action) {
  if (action.type === 'select') {
    return { ...state, selectedItem: action.item, isOpen: true };
    //                 ^^^^^^^^^^^^^^^^^^^^^^^^ they had to know to do this
  }
  return state;
}
```

That version leaks your implementation into every caller. Add a
`lastInteractionAt` field next release and every caller's reducer is quietly out
of date — silently, because nothing errors; the field just stops being set for
that one action.

With `changes`, the caller wrote `{ ...changes, isOpen: true }` and the new field
flows through untouched.

**This is inversion of control done narrowly.** The caller takes over the one
decision they care about and you keep the rest — which is exactly what separates
it from making everything controlled.

## The three things a caller can do

Every `stateReducer` return falls into one of three cases, and it is worth
knowing all three exist:

```jsx
stateReducer(state, action, changes) {
  if (action.type === 'close')  return state;                      // 1. VETO
  if (action.type === 'select') return { ...changes, isOpen: true }; // 2. AMEND
  if (action.type === 'open')   return { ...changes, query: '' };    // 3. EXTEND
  return changes;
}
```

1. **Veto** — return `state` unchanged and the transition does not happen. This
   is how you make a menu that cannot be closed while a request is in flight.
2. **Amend** — take the proposal and override a field.
3. **Extend** — take the proposal and set a field the component's own reducer
   never touches for that action.

Case 3 is the one people miss, and it is where the pattern earns most: the caller
can attach their own state to your transitions without you knowing the field
exists.

## Against controlled props

Both hand power to the caller. They are not interchangeable.

| | Controlled props | State reducer |
|---|---|---|
| Caller wants to **own** a value and drive it from outside | ✅ | ✗ |
| Caller wants to **adjust one transition**, keep the rest | ✗ — they now own everything | ✅ |
| Caller needs to **read** the state | either | either |
| Caller needs to set the value **without a user action** | ✅ | ✗ — there is no action to intercept |
| State stays inside your component | no | **yes** |
| Number of props added | one per controlled value, plus a handler each | **one, ever** |

The rule of thumb: **if the answer to "where does this value live?" changes, you
want [controlled](../../phase-2-components/04-controlled-vs-uncontrolled/README.md).
If it does not change and only the *rule* differs, you want a state reducer.**

They also compose — a component can be controlled for `value` and still expose a
`stateReducer` for everything else. Downshift-style libraries do exactly that.

## Gotchas

**The caller's reducer must be pure.** It runs inside your `useReducer` reducer,
and react.dev requires reducers to be
[pure functions](https://react.dev/learn/keeping-components-pure) — same inputs,
same output, no side effects, no mutation of the state passed in. A caller who
fires a request or calls `setState` inside `stateReducer` has broken that
contract, and the failure looks like a React bug rather than theirs. Say so in
your documentation, in those words.

**Returning `state` cancels the transition — including by accident.** It is a
legitimate veto, and it is also what a `switch` with a fall-through gives you.
`default: return changes` is the safe shape; `default: return state` freezes the
widget.

**Mutating `changes` does nothing useful.** `changes.isOpen = true; return
changes;` mutates an object your reducer just built, which happens to work here
and violates the purity contract. Return a new object.

**The default must be identity, not `undefined`.** If `stateReducer` is optional,
its default has to be `(state, action, changes) => changes`. Defaulting to
nothing and calling it anyway returns `undefined` and wipes the state on the
first dispatch.

**A caller who returns a partial object destroys the rest of the state.** `return
{ isOpen: true }` — without spreading `changes` — leaves `selectedItem`
undefined. This is the single most common caller error, and it is worth a runtime
warning in development.

**It cannot express "set this from outside".** A state reducer only ever runs in
response to an action the component dispatched. If the caller needs to open the
menu programmatically, you need an imperative method or a controlled prop.

**Multiple dispatches in one event each run the reducer separately.** There is no
"batch" the caller can intercept; they see three transitions, not one. If two
actions must be atomic from the caller's point of view, that is one action.

**This is not a substitute for a reducer you needed anyway.** If your component
has one boolean, `useState` plus a prop is the right answer —
[`useState` vs `useReducer`](../../phase-5-refs-context-reducers/09-usestate-vs-usereducer.md)
comes first.

**Do not reach for it with three consumers.** *(Judgement.)* The pattern pays in a
widget with many transitions and many callers — a combobox, a table, a date
picker. In an app component, a prop is clearer and cheaper.

## Interview questions

**What is the state reducer pattern?**
A reusable component owns its state via a reducer and accepts a caller-supplied
`stateReducer(state, action, changes)` that sees every proposed transition and
returns the one to apply. The caller overrides individual transitions and
inherits the others.

**Why pass `changes` as a third argument?**
So the caller amends the component's proposal instead of reimplementing the
transition. Without it, every caller hard-codes your current state shape and
silently stops setting new fields when you add them.

**What are the three things a caller can do with a transition?**
Veto it by returning `state`; amend it by spreading `changes` and overriding a
field; or extend it by spreading `changes` and adding a field your reducer never
sets.

**How does it differ from controlled props?**
Controlled props move ownership of a value out of the component, so the caller
must drive it entirely. A state reducer leaves the state inside and lets the
caller adjust one rule. Use controlled when the value must live outside; a state
reducer when only the behaviour differs.

**Can you use both?**
Yes, and mature libraries do — controlled for the one or two values the
application genuinely owns, plus a `stateReducer` for the behaviour around them.

**What can a state reducer *not* do?**
Change state without a user action. It only runs in response to an action the
component dispatched, so programmatic control needs an imperative handle or a
controlled prop.

**What must the caller's reducer never do?**
Anything impure — no side effects, no mutation, no requests. It runs inside a
`useReducer` reducer, which React requires to be pure.

**What is the most common caller mistake?**
Returning a partial object instead of spreading `changes`, which silently drops
every other field of the state.

**Why is `default: return changes` important?**
Because `default: return state` vetoes every action you did not explicitly
handle, which freezes the widget in a way that looks like the component is
broken.

---

Index: [The state reducer pattern](README.md) · Next → [02 · Designing the action surface](02-designing-the-action-surface.md)
