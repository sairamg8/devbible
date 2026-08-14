---
title: "useReducer"
sidebar_label: "03 · useReducer"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useReducer`](https://react.dev/reference/react/useReducer).
> No sandbox script backs this page; claims are cited, not measured.

**State transitions expressed as data. The component says *what happened*; a pure
function decides *what the state becomes*. That separation is the whole value —
and it is what makes complex state testable without rendering anything.**

## The shape

```jsx
const [state, dispatch] = useReducer(reducer, initialArg, init?);
```

> **`reducer`**: The reducer function that specifies how the state gets updated.
> **It must be pure**, should take the state and action as arguments, and should
> return the next state.

> **`initialArg`**: The value from which the initial state is calculated.

> **`init`** *(optional)*: The initializer function that should return the initial
> state. If it's not specified, the initial state is set to `initialArg`.
> Otherwise, the initial state is set to the result of calling `init(initialArg)`.

And what comes back:

> 1. The current state. During the first render, it's set to `init(initialArg)` or
>    `initialArg` (if there's no `init`).
> 2. The `dispatch` function that lets you update the state to a different value
>    and trigger a re-render.

The `init` argument is `useReducer`'s lazy initializer — the thing
[`useRef` does not have](01-useref.md) and `useState` does
([Phase 3 · 09](../phase-3-state/09-lazy-initial-state.md)). It also lets you
derive initial state from a prop without recomputing it every render.

## The reducer must be pure

> **The reducer function must be pure** — don't modify objects or arrays in state
> directly.

This is not advice; it is the contract that everything else rests on. A pure
reducer is:

- **testable without React** — call `reducer(state, action)` and assert on the
  result;
- **replayable** — the same sequence of actions from the same initial state always
  produces the same result, which is what makes time-travel debugging and undo
  possible;
- **safe to call twice**, which React does.

React enforces it the same way it enforces component purity:

> **In Strict Mode, React will call your reducer and initializer twice** in order
> to help you find accidental impurities. This is development-only behavior and
> does not affect production. … The result from one of the calls is ignored.

And the documented worked failure is the one everyone writes at least once:

```jsx
function reducer(state, action) {
  switch (action.type) {
    case 'added_todo': {
      // 🚩 Mistake: mutating state
      state.todos.push({ id: nextId++, text: action.text });
      return state;
    }
  }
}
```

> You'll see the todo was **added twice** in Strict Mode, revealing the mistake.

Two separate bugs in four lines. `push` mutates, so the reference is unchanged and
React may bail out ([Phase 3 · 11](../phase-3-state/11-bailing-out.md)); and
because the mutation is a side effect, calling the reducer twice applies it twice.
The correct form replaces rather than mutates:

```jsx
case 'added_todo': {
  // ✅ Correct: replacing with new state
  return {
    ...state,
    todos: [...state.todos, { id: nextId++, text: action.text }]
  };
}
```

## `dispatch` does not change `state`

The behaviour that generates the most confused bug reports:

> **Calling `dispatch` does not change state in the running code** — it requests a
> re-render with the new state value.

```jsx
function handleClick() {
  console.log(state.age);  // 42

  dispatch({ type: 'incremented_age' }); // Request a re-render with 43
  console.log(state.age);  // Still 42!

  setTimeout(() => {
    console.log(state.age); // Also 42!
  }, 5000);
}
```

> This is because states behave like a snapshot.

Identical to `useState` ([Phase 3 · 02](../phase-3-state/02-state-is-a-snapshot.md)):
`state` is a `const` bound to *this* render, and no dispatch can reach back and
rebind it — including five seconds later inside a `setTimeout`, because the closure
belongs to the render that created it.

If you genuinely need the next value in the same handler, the docs give the exact
move — **call the reducer yourself**, which is only possible *because* it is pure:

```jsx
const action = { type: 'incremented_age' };
dispatch(action);

const nextState = reducer(state, action);
console.log(state);     // { age: 42 }
console.log(nextState); // { age: 43 }
```

## 🔴 `dispatch` is stable

> **The `dispatch` function has a stable identity**, so you will often see it
> omitted from Effect dependencies, but including it will not cause the Effect to
> fire. If the linter lets you omit a dependency without errors, it is safe to do.

Practically the most useful line in the reference. `dispatch` can be passed down
through props or context without ever changing identity, so:

- it never re-triggers an effect that depends on it
  ([Phase 4 · 03](../phase-4-effects/03-the-dependency-array.md));
- it never invalidates a `memo`'d child the way an inline callback would;
- a **dispatch context** can be read by components that must never re-render when
  the state changes — which is the whole basis of [topic 12](12-context-plus-reducer.md).

Note the careful wording: *including it will not cause the Effect to fire*. You do
not have to fight the linter about it either way.

## Hook rules

> `useReducer` is a Hook, so you can only call it **at the top level of your
> component** or your own Hooks. You can't call it inside loops or conditions.

The same rule as every other hook, and the same reason —
[Phase 3 · 01](../phase-3-state/01-usestate.md)'s call-order slots.

## Why "transitions as data" matters

The reducer receives an **action**, not a new value. That indirection buys three
things a bare setter cannot:

**One place to change.** Every transition lives in the reducer, so "what can happen
to this state?" is answered by reading one function instead of grepping for
setters.

**Actions describe intent.** `{type: 'added_todo'}` says what the user did;
`setTodos([...todos, t])` says what the array became. The first survives a change
in data shape; the second has to be rewritten everywhere.

**Impossible states become preventable.** A reducer sees the whole state at once,
so it can refuse a transition — you cannot end up with `isLoading: true` and
`error: set` if no action produces that pair. Separate `useState` calls have no
such choke point
([Phase 3 · 10](../phase-3-state/10-structuring-state.md)).

The cost is indirection, and [topic 09](09-usestate-vs-usereducer.md) is the honest
decision rule for when it is worth paying.

## Gotchas

**Symptom:** logging `state` right after `dispatch` shows the old value.
**Cause:** dispatch requests a re-render; it does not rebind the `state` variable
in the running code. Snapshot behaviour.
**Fix:** if you need the next value now, call `reducer(state, action)` yourself —
which is safe precisely because the reducer is pure.

**Symptom:** an item is added twice in development.
**Cause:** the reducer mutates and `StrictMode` calls it twice, applying the side
effect twice.
**Fix:** return new state instead of mutating. The doubling is the diagnostic, not
the bug.

**Symptom:** dispatching changes nothing and no re-render happens.
**Cause:** the reducer mutated and returned the same object, so `Object.is` reports
no change.
**Fix:** return a new object. This is the silent-failure mode from
[Phase 3 · 11](../phase-3-state/11-bailing-out.md).

**Symptom:** an expensive computation runs on every render to build initial state.
**Cause:** it was passed as `initialArg` instead of via `init`.
**Fix:** pass `init` — the third argument is the lazy initializer.

**Symptom:** an effect that depends on `dispatch` is suspected of re-firing.
**Cause:** it is not. `dispatch` has a stable identity, and including it in the
array does not cause the effect to fire.
**Fix:** nothing. Include it or omit it as the linter prefers.

**Symptom:** the reducer reads something outside its arguments — a prop, `Date.now()`,
a random value.
**Cause:** that is impurity, and `StrictMode`'s double call will expose it.
**Fix:** pass it in on the action. A reducer's output must depend only on `(state,
action)`.

## Interview questions

**★ What is the reducer contract, and why does it matter?**
It must be pure, take the current state and an action, and return the next state.
Purity is what makes it testable without rendering, replayable for undo or
time-travel, and safe for React to call twice — which `StrictMode` does in
development specifically to expose accidental impurity. A reducer that mutates
state fails all three at once.

**★ Why does logging state immediately after `dispatch` show the old value?**
Because dispatch requests a re-render with the new value; it does not change the
`state` variable in the code that is already running. `state` is bound to the
current render, so it stays the old value for the rest of that handler — and
inside any closure created there, including a `setTimeout` five seconds later. If
you need the next value now, call the reducer yourself with the same action.

**★ Why is `dispatch` being stable useful?**
Because it can be passed down or put in context without ever changing identity, so
it never re-triggers an effect that depends on it and never invalidates a memoized
child. That is what makes a separate dispatch context work: components that only
need to *cause* changes can read it and never re-render when the state changes.
The docs also note that including it in a dependency array will not cause the
effect to fire, so there is nothing to argue with the linter about.

**Your reducer adds an item twice in development. What is wrong?**
It is mutating rather than replacing — usually `state.todos.push(...)` followed by
`return state`. `StrictMode` calls the reducer twice, so the mutation is applied
twice and the doubling becomes visible. There is a second bug hiding in the same
line: returning the same object means `Object.is` sees no change, so React may not
re-render at all. Returning new state fixes both.

**What is the third argument to `useReducer` for?**
It is the lazy initializer. Initial state becomes `init(initialArg)` rather than
`initialArg`, so an expensive computation runs once instead of on every render, and
initial state can be derived from a prop cleanly. It is the equivalent of passing a
function to `useState` — and note that `useRef` has no such option.

**What does expressing transitions as actions buy you over calling setters?**
Every transition lives in one function, so the set of things that can happen to
this state is readable in one place. Actions describe intent rather than the
resulting value, so they survive changes in data shape. And because the reducer
sees the whole state at once, it can refuse to produce impossible combinations —
which separate `useState` calls have no place to enforce.

---

← Prev: [DOM refs](02-dom-refs/README.md) · Index: [Phase 5](README.md) · Next → [`createContext` and `useContext`](04-createcontext-usecontext.md)
