---
title: "The state reducer pattern"
sidebar_label: "02 · The state reducer pattern"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useReducer`](https://react.dev/reference/react/useReducer),
> [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer)
> and [Keeping Components Pure](https://react.dev/learn/keeping-components-pure)
> for the purity requirement the composition below depends on.
> ⚠️ **The state reducer pattern is a community convention, not a React API.**
> React documents `useReducer`; it does not document this use of it, and the
> name comes from the Downshift/`react-table` lineage rather than from React.
> Judgements below are marked as judgements.
> No sandbox script backs this page; claims are cited, not measured.

**Your component is right for nine callers and wrong for the tenth. Instead of
adding a prop for the exception, let the caller intercept the state transition.**

## The problem

A `useSelect` you wrote closes the menu when an item is picked. Correct — for a
single-select dropdown, which is what you built.

Then a multi-select filter needs it. Picking an item should *not* close the menu,
because the user is about to pick three more.

The obvious answers all age badly:

| Answer | What goes wrong |
|---|---|
| `closeOnSelect={false}` | Fine once. Then `closeOnBlur`, `clearOnClose`, `resetHighlightOnOpen` — the [configuration trap](../phase-2-components/03-composition/01-the-configuration-trap.md), one exception at a time |
| Fork the component | Two implementations of the same keyboard handling, drifting apart from the day it is copied |
| Make everything controlled | The caller now owns `isOpen`, `highlightedIndex`, `inputValue` and must re-implement every transition — you handed them all the work, not just the exception |

Each answer fails the same way: the caller wants to change **one transition**,
and you have made them buy something much larger.

## The pattern

The component keeps a reducer that describes all its transitions. It then lets
the caller pass a **`stateReducer`** that sees every proposed change and returns
the change it actually wants.

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

useSelect.actions = actions;   // the action types are now public API
```

The multi-select caller changes exactly one transition and inherits everything
else:

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

Note the signature: **`(state, action, changes)`**. The caller gets the state
before, the action that fired, and the component's *proposed* next state. That
third argument is what makes the pattern usable — the caller amends a proposal
rather than reimplementing the transition, so `selectedItem` still gets set
without them writing that line.

## Why the third argument matters

Compare the two shapes the caller could have been given:

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

The version without `changes` leaks your implementation into every caller. Add a
field to the state next release and every caller's reducer is quietly out of
date. With `changes`, the caller wrote `{...changes, isOpen: true}` and the new
field flows through untouched.

**This is inversion of control done narrowly** — the caller takes over the one
decision they care about, and you keep the rest. That is the entire argument for
the pattern, and it is what separates it from just making everything controlled.

## Against controlled props

Both hand power to the caller. They are not interchangeable.

| | Controlled props | State reducer |
|---|---|---|
| The caller wants to **own** a value and drive it from outside | ✅ | ✗ |
| The caller wants to **adjust one transition** and keep the rest | ✗ (they now own everything) | ✅ |
| The caller needs to **read** state | either | either |
| The state stays inside your component | no | **yes** |

The rule of thumb: if the answer to *"where does this value live?"* changes, you
want [controlled](../phase-2-components/04-controlled-vs-uncontrolled/README.md).
If it does not change and only the *rule* differs, you want a state reducer.

## The price, stated plainly

**Your action types become public API.** The moment a caller writes
`action.type === 'select'`, renaming that string is a breaking change. Export
them as a frozen object — `useSelect.actions` above — and treat them with the
same care as any exported name. This is the pattern's real cost and it is
permanent.

**Your state shape becomes public API too**, for the same reason: callers spread
`changes` and read fields from it.

**It is undiscoverable.** Nobody guesses this exists. It only works if it is
documented, with a worked example, next to the component.

**It is the wrong size for most components.** *(Judgement, not documentation.)*
The pattern earns its keep in a widget with many transitions and many
consumers — a combobox, a table, a date picker. In an app component with three
callers, a prop is clearer and cheaper.

## Gotchas

**The caller's reducer must be pure.** It runs inside your `useReducer` reducer,
and react.dev requires reducers to be
[pure functions](https://react.dev/learn/keeping-components-pure) — same inputs,
same output, no side effects, no mutation of the state passed in. A caller who
fires a network request or calls `setState` from inside `stateReducer` has broken
that contract, and the failure will look like a React bug rather than theirs.
Say so in your documentation.

**Returning `state` instead of `changes` cancels the transition.** That is a
legitimate move — it is how you veto an action — but it is easy to do by
accident when a branch falls through. A `default: return changes` is the safe
shape.

**Mutating `changes` does not work.** `changes.isOpen = true; return changes;`
mutates an object your reducer just built. Return a new object —
`{ ...changes, isOpen: true }`.

**The default must be identity, not `undefined`.** If `stateReducer` is optional,
its default has to be `(state, action, changes) => changes`. Defaulting to
nothing and calling it anyway returns `undefined` and wipes your state on the
first dispatch.

**This is not a substitute for a reducer you needed anyway.** If your component
has one boolean, `useState` and a prop are the right answer.
[`useState` vs `useReducer`](../phase-5-refs-context-reducers/09-usestate-vs-usereducer.md)
is the page on that decision, and it comes first.

## Interview questions

**What is the state reducer pattern?**
A reusable component owns its state via a reducer and accepts a caller-supplied
`stateReducer(state, action, changes)` that sees every proposed transition and
returns the one to apply. The caller overrides individual transitions while
inheriting all the others.

**Why pass `changes` as a third argument?**
So the caller amends the component's proposal instead of reimplementing the
transition. Without it, every caller hard-codes your current state shape and
silently breaks when you add a field.

**How does it differ from controlled props?**
Controlled props move ownership of a value out of the component; the caller must
then drive it entirely. A state reducer leaves the state inside the component and
lets the caller adjust one rule. Use controlled when the value must live
outside, a state reducer when only the behaviour differs.

**What does it cost?**
Your action types and state shape become public API — renaming an action type is
a breaking change. It is also undiscoverable without documentation, and it is
overkill for components with few transitions or few consumers.

**What must the caller's reducer never do?**
Anything impure. It runs inside a `useReducer` reducer, which React requires to
be pure — no side effects, no mutation, no requests.

---

← Prev: [Headless components](01-headless-components.md) · Index: [React patterns](README.md) · Next → [03 · Polymorphic components](03-polymorphic-components.md)
