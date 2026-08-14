---
title: "Reducer patterns"
sidebar_label: "10 · Reducer patterns"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useReducer`](https://react.dev/reference/react/useReducer) and
> [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer).
> Where a pattern is a community convention rather than documented API, this page
> says so. No sandbox script backs this page.

**The conventions around the documented API: how to shape an action, where the
lazy `init` earns its place, and the one guarantee — `dispatch` being stable — that
makes several other patterns possible.**

## Action shape

React documents **no required shape**. `useReducer`'s reference says only that the
reducer *"should take the state and action as arguments"* and that action *"can be
of any type"*. Everything below is convention, and it is worth knowing which is
which.

The near-universal convention is an object with a `type`:

```jsx
dispatch({ type: 'added_todo', text });
dispatch({ type: 'deleted_todo', id });
dispatch({ type: 'reset_form' });
```

It is what every react.dev example uses, and it is what makes the log-reading test
from [topic 09](09-usestate-vs-usereducer.md) work — a plain string or number would
carry no payload and a bare payload would carry no intent.

**Naming.** react.dev's own examples use past-tense, event-like names —
`added_todo`, `changed_todo`, `deleted_todo` — rather than imperative ones like
`ADD_TODO`. That follows directly from the documented rule that an action describes
**what happened**, not what to do about it. A reducer is the only thing that decides
what to do; an action that already says "add" has pre-empted it.

**One action per interaction**, even across several fields:

```jsx
// 🔴 five actions describing assignments
dispatch({ type: 'set_name', value: '' });
dispatch({ type: 'set_email', value: '' });
// ...

// ✅ one action describing the interaction
dispatch({ type: 'reset_form' });
```

## The `switch`, and the default case

```jsx
function reducer(state, action) {
  switch (action.type) {
    case 'added_todo': {
      return { ...state, todos: [...state.todos, newTodo(action.text)] };
    }
    case 'reset_form': {
      return initialState;
    }
    default: {
      throw Error('Unknown action: ' + action.type);
    }
  }
}
```

Two details that are convention rather than API, and both earn their place:

**Braces around each case.** `case` clauses share one block scope, so a `const`
declared in one is visible to the others and a second declaration is a syntax error.
Braces give each case its own scope.

**Throwing on an unknown action.** Returning `state` unchanged silently swallows a
typo'd `type` — the dispatch appears to work and nothing happens, which is
indistinguishable from a bail-out
([Phase 3 · 11](../phase-3-state/11-bailing-out.md)). Throwing turns a silent
no-op into an immediate, named failure.

## Discriminated unions in TypeScript

Where the `type` convention pays off structurally:

```ts
type Action =
  | { type: 'added_todo'; text: string }
  | { type: 'deleted_todo'; id: string }
  | { type: 'reset_form' };
```

Inside the `switch`, TypeScript narrows `action` per case, so `action.text` exists
in `added_todo` and is a type error in `deleted_todo`. The union also makes the
`default` case reachable only by an unhandled variant, which is what enables an
exhaustiveness check. This is a TypeScript language feature rather than a React one
— it is why the object-with-`type` convention became universal rather than merely
common.

## The lazy `init` argument

```jsx
const [state, dispatch] = useReducer(reducer, todosLength, createInitialState);
```

> If it's not specified, the initial state is set to `initialArg`. Otherwise, the
> initial state is set to the result of calling `init(initialArg)`.

Two things it buys:

**The computation runs once**, not on every render — the same problem `useState`'s
function form solves and [`useRef` has no answer for](01-useref.md).

**A reusable "reset" path.** Because `init` is a plain function, `case 'reset_form':
return createInitialState(todosLength)` reuses exactly the logic that produced the
first state. Without it, initial state exists in two places and they drift.

## 🔴 `dispatch` is stable — what that unlocks

> The `dispatch` function has a stable identity, so you will often see it omitted
> from Effect dependencies, but **including it will not cause the Effect to fire.**

Three patterns depend on this, and none of them needs a `useCallback`:

**Pass it down freely.** A `dispatch` prop never invalidates a `memo`'d child the
way an inline arrow does.

**Put it in its own context.** The dispatch context's value never changes, so its
consumers never re-render from it — [topic 05](05-context-re-render-problem.md) and
[topic 12](12-context-plus-reducer.md).

**Use it in effects without ceremony.** No dependency-array argument, no
`useEffectEvent`, no ref.

Contrast with `useState`: `setState` is also stable, but the *derived* handlers you
build around it usually are not, which is where `useCallback` comes in. A reducer
gives you one stable function that expresses every transition.

## Deriving instead of storing

A reducer makes it tempting to keep everything in one object, including values that
are functions of other values:

```jsx
// 🔴 filtered has to be maintained by every action
{ todos, filter, filtered }

// ✅ derive during render
const filtered = todos.filter(matches(filter));
```

Every stored derivation is a thing each action must remember to update —
[Phase 3 · 06](../phase-3-state/06-derived-state.md)'s argument, and it bites harder
here because the reducer looks like the natural place to "keep things in sync".

## Immer, and mutating style

The recap names it:

> Use **Immer** if you want to write reducers in a mutating style.

A third-party option (`use-immer`) that lets a reducer body read as `draft.todos.push(...)`
while still producing a new state. Worth knowing it is the sanctioned answer to
"nested spreads are unreadable"
([Phase 3 · 05](../phase-3-state/05-immutable-updates/README.md)) — and that it does
not relax the purity requirement, only the syntax.

## Gotchas

**Symptom:** a dispatch appears to do nothing.
**Cause:** a typo in `action.type` and a `default` case that returns `state`.
**Fix:** throw on unknown actions.

**Symptom:** `SyntaxError` or a surprising `const` collision inside the `switch`.
**Cause:** `case` clauses share one block scope.
**Fix:** braces around each case body.

**Symptom:** an initial-state shape and a reset action drift apart.
**Cause:** initial state written twice — once as `initialArg`, once in the reset
case.
**Fix:** an `init` function, reused by the reset case.

**Symptom:** every action has to remember to recompute a derived field.
**Cause:** the derivation was stored in state.
**Fix:** derive it during render.

**Symptom:** `useCallback` wrapped around `dispatch` before passing it down.
**Cause:** assuming it needs stabilising.
**Fix:** it is already stable. Remove it.

**Symptom:** the action log is unreadable during debugging.
**Cause:** actions named after fields — `set_name`, `set_email`.
**Fix:** one action per interaction, named for what happened.

## Interview questions

**★ What shape should an action have, and is that a React requirement?**
An object with a `type` string plus any payload — and no, React requires nothing:
the reference says an action can be of any type. The convention exists because it
carries both intent and data, it makes the action log readable, and in TypeScript it
forms a discriminated union that narrows inside the `switch`. Names should be
past-tense and describe what happened, since deciding what to *do* is the reducer's
job.

**★ Why throw in the reducer's `default` case?**
Because returning `state` unchanged makes a typo'd action type indistinguishable
from a legitimate no-op — the dispatch appears to work, nothing happens, and there
is nothing to find. Throwing converts a silent failure into an immediate named
error. It also gives TypeScript's exhaustiveness checking somewhere to land.

**★ What does `dispatch` being stable let you do?**
Pass it down without invalidating memoized children, put it in its own context whose
value never changes so consumers never re-render from it, and use it in effects
without any dependency-array ceremony. The docs also note that including it in a
dependency array will not cause the effect to fire, so there is no argument to have
with the linter either way. It needs no `useCallback`.

**When is the third argument to `useReducer` worth using?**
When initial state is expensive to compute, since `init` runs once rather than every
render; and when a reset action should return to that same initial state, because
`init` is a plain function the reset case can call. Without it the initial shape
tends to exist in two places and drift.

**How do you keep a reducer from becoming a place where derived data rots?**
Do not store derived values. A reducer looks like the natural home for "keeping
things in sync", which is exactly the trap — every stored derivation becomes
something each action must remember to update. Compute it during render instead and
the reducer only holds what genuinely cannot be derived.

---

← Prev: [`useState` vs `useReducer`](09-usestate-vs-usereducer.md) · Index: [Phase 5](README.md) · Next → [What context is and is not](11-what-context-is-and-is-not.md)
