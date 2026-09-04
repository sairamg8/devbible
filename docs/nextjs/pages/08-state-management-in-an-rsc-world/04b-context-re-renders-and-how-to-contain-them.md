---
title: "Context has no selectors: every consumer re-renders when the value changes by Object.is, memoising the value fixes only the spurious half, and React.memo does not help at all — which leaves splitting by change rate as the only cure inside Context"
sidebar_label: "04b · Context re-renders, and containing them"
sidebar_position: 24
description: "Why an object literal as a context value re-renders everything, what memoising the value does and does not fix, why React.memo does not stop a context re-render, and the two splits — state from dispatch, and by change frequency — that actually contain the fan-out."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the React reference — [`useContext`](https://react.dev/reference/react/useContext),
> [`useMemo`](https://react.dev/reference/react/useMemo), [`memo`](https://react.dev/reference/react/memo).
> Target: **React 19.2.8** · **Next.js 16.3.4** App Router.
> Documentation-verified; **no sandbox run**.

**Context's performance contract has exactly one clause, and it is the whole story: when the provider receives a value that is not `Object.is`-equal to the previous one, *every* consumer of that context re-renders. Not the ones whose slice changed — all of them. There is no selector API, and `React.memo` on a consumer does not help, because reading a context is not the same as receiving a prop. So containing the fan-out is a structural exercise with exactly three moves: stabilise the value so it changes less often, split the context so fewer components consume each part, or stop using Context for the subscription altogether. This page is the first two moves — the ones you can make without leaving Context. The third, `useSyncExternalStore`, is [04c](04c-usesyncexternalstore-the-escape-hatch.md).**

## The contract

> *"React automatically re-renders all the children that use a particular context starting from the provider that receives a different `value`. The previous and the next values are compared with the [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) comparison."*
> — [`useContext`](https://react.dev/reference/react/useContext)

Two independent problems live inside that sentence.

**Problem 1 — the value changes more often than the data does.** An object literal built during render is a fresh object every time, so `Object.is` is `false` even when every field is identical.

```tsx
// ❌ A new object on every render of Provider, so every consumer re-renders
//    whenever Provider re-renders — for any reason at all.
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  function login(response) {
    storeCredentials(response.credentials)
    setCurrentUser(response.user)
  }
  return <AuthContext.Provider value={{ currentUser, login }}>{children}</AuthContext.Provider>
}
```

**Problem 2 — every consumer re-renders even when the data genuinely did change**, including the ones that read a field which did not. This one has no fix inside Context. It is why [04c](04c-usesyncexternalstore-the-escape-hatch.md) exists.

## Move 1 — stabilise the value

> *"However, there is no need to re-render them if the underlying data, like `currentUser`, has not changed. To help React take advantage of that fact, you may wrap the `login` function with [`useCallback`](https://react.dev/reference/react/useCallback) and wrap the object creation into [`useMemo`](https://react.dev/reference/react/useMemo). This is a performance optimization"*
> — [`useContext`, Optimizing re-renders when passing objects and functions](https://react.dev/reference/react/useContext)

```tsx filename="app/auth-provider.tsx"
'use client'

import { createContext, useCallback, useMemo, useState } from 'react'

export const AuthContext = createContext(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState(null)

  const login = useCallback((response) => {
    storeCredentials(response.credentials)
    setCurrentUser(response.user)
  }, [])

  const contextValue = useMemo(() => ({ currentUser, login }), [currentUser, login])

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
```

> *"As a result of this change, even if `MyApp` needs to re-render, the components calling `useContext(AuthContext)` won't need to re-render unless `currentUser` has changed."*
> — same section

Read the guarantee precisely: it removes the *spurious* re-renders caused by the provider re-rendering for unrelated reasons. It does nothing about Problem 2 — when `currentUser` does change, every consumer still re-renders.

## Move 2 — split the context

Two splits, and they solve different things.

### Split state from dispatch

Actions are stable for the lifetime of the provider; state is not. Putting them in one value means every action-only consumer re-renders on every state change.

```tsx filename="app/[tenant]/board/board-drag-provider.tsx"
'use client'

import { createContext, useContext, useMemo, useReducer } from 'react'

const DragStateContext = createContext<DragState | null>(null)
const DragDispatchContext = createContext<React.Dispatch<DragAction> | null>(null)

export function BoardDragProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dragReducer, initialDragState)

  // `dispatch` from useReducer is stable, so this provider never invalidates.
  return (
    <DragDispatchContext.Provider value={dispatch}>
      <DragStateContext.Provider value={state}>{children}</DragStateContext.Provider>
    </DragDispatchContext.Provider>
  )
}

export function useDragState() {
  const v = useContext(DragStateContext)
  if (!v) throw new Error('useDragState must be used within BoardDragProvider')
  return v
}

export function useDragDispatch() {
  const v = useContext(DragDispatchContext)
  if (!v) throw new Error('useDragDispatch must be used within BoardDragProvider')
  return v
}
```

A drag handle that only ever calls `useDragDispatch()` now never re-renders from a drag. On a board with 200 cards, that is 200 components removed from the hot path with no library.

### Split by change frequency

```tsx
// ❌ one context, one value, four change rates
const BoardContext = createContext({ columns, selection, draggedId, hoverColumn })

// ✅ four contexts, each with its own consumers
const ColumnsContext   = createContext(columns)      // changes on mutation
const SelectionContext = createContext(selection)    // changes on click
const DraggedContext   = createContext(draggedId)    // changes on drag start/end
const HoverContext     = createContext(hoverColumn)  // changes on pointer move
```

The rule: **one context per independent change rate.** A component reading columns should not re-render because a pointer moved.

The cost is real and worth naming: four providers, four hooks, four `useMemo` calls, and a growing pyramid in the tree. Past three or four splits you have hand-built a store with worse ergonomics than an off-the-shelf one, which is the point at which [04d](04d-zustand-in-an-rsc-app.md) or [04e](04e-jotai-in-an-rsc-app.md) stops being over-engineering.

## Why `React.memo` does not save you

`memo` compares *props*. A context read is not a prop — it is a subscription established inside the component, and React re-renders context consumers regardless of whether their props changed.

```tsx
// ❌ Card is memoised, but it reads the context, so it re-renders anyway.
const Card = memo(function Card({ id }: { id: string }) {
  const { draggedId } = useDragState()
  return <li data-dragging={draggedId === id}>{id}</li>
})
```

`memo` only helps *between* the provider and the consumer: it stops a re-render propagating down through components that do **not** read the context. So it is a useful complement to splitting, and never a substitute for it.

```tsx
// ✅ Column does not read the drag context, so memo stops the cascade there;
//    only the leaf that reads it re-renders.
const Column = memo(function Column({ cards }: { cards: Card[] }) {
  return <ul>{cards.map((c) => <CardDropTarget key={c.id} id={c.id} />)}</ul>
})
```

## Gotchas

**★ Symptom: every consumer re-renders on every provider render, even when nothing changed.** Cause: the context value is an object literal, so `Object.is` is false every time. Fix: memoise the value and the callbacks in it.

```tsx
const login = useCallback((r) => setCurrentUser(r.user), [])
const contextValue = useMemo(() => ({ currentUser, login }), [currentUser, login])
return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
```

**★ Symptom: you memoised the value and 200 cards still re-render on every pointer move.** Cause: that fixes the *spurious* re-renders only; when the data really changes, every consumer re-renders because Context has no selectors. Fix: split by change rate, or move the subscription to an external store ([04c](04c-usesyncexternalstore-the-escape-hatch.md)).

```tsx
// ✅ four contexts instead of one, so a pointer move touches only the drag consumers
<ColumnsContext.Provider value={columns}>
  <SelectionContext.Provider value={selection}>
    <DraggedContext.Provider value={draggedId}>{children}</DraggedContext.Provider>
  </SelectionContext.Provider>
</ColumnsContext.Provider>
```

**★ Symptom: `React.memo` on the consumer changes nothing.** Cause: `memo` compares props, and a context read is not a prop. Fix: use `memo` on components *between* the provider and the consumer to stop the cascade, and put the context read in the smallest leaf.

```tsx
const Column = memo(function Column({ cards }) {          // ✅ does not read context
  return <ul>{cards.map((c) => <Card key={c.id} id={c.id} />)}</ul>
})
```

**★ Symptom: a toolbar button that only dispatches re-renders on every keystroke in a form.** Cause: state and dispatch share one context value. Fix: two contexts; `dispatch` from `useReducer` is stable, so its provider never invalidates.

```tsx
<DragDispatchContext.Provider value={dispatch}>
  <DragStateContext.Provider value={state}>{children}</DragStateContext.Provider>
</DragDispatchContext.Provider>
```

**★ Symptom: after splitting into five contexts, the provider file is unreadable and a new field has to be threaded through four places.** Cause: you have hand-built a store using the wrong primitive. Fix: this is the moment to take the dependency — the split has stopped being an optimisation and become a maintenance tax.

**★ Symptom: a context value memoised with `useMemo` still changes every render.** Cause: one of its dependencies is itself unstable — an inline arrow function, an object built in the parent, or a value from another unmemoised context. Fix: stabilise the dependencies first; `useMemo` cannot rescue an unstable input.

```tsx
const onSelect = useCallback((id: string) => dispatch({ type: 'select', id }), [dispatch])
const value = useMemo(() => ({ selection, onSelect }), [selection, onSelect])
```

## Interview questions

**★ Why does memoising a context value not solve the Context performance problem?**
Because it solves only half of it. Memoising with `useMemo` and `useCallback` stops the provider handing out a fresh object when nothing actually changed, which removes re-renders caused by the provider re-rendering for unrelated reasons. It does nothing about the other half: when the data genuinely changes, *every* consumer of that context re-renders, including those that read a field which did not change. Context compares one value with `Object.is` and has no notion of which part of it a given consumer read. That second problem has no fix inside Context — only splitting or leaving Context for the subscription.

**★ Why doesn't `React.memo` stop a context-driven re-render?**
Because `memo` compares props, and reading a context is not receiving a prop. It is a subscription registered inside the component, and React re-renders every subscriber when the provider's value changes, whatever their props are. Where `memo` does help is *between* the provider and the consumer: a memoised component that does not itself read the context blocks the ordinary parent-to-child re-render cascade, so only the leaf that actually subscribes re-renders. That makes it a useful complement to pushing the context read down into the smallest possible leaf, and never a substitute for splitting the context.

**★ How do you split a context, and what is the criterion?**
Two ways, and both have the same criterion — independent change rate. First, split state from dispatch: actions are stable for the provider's lifetime while state is not, so a component that only dispatches should not subscribe to state. `dispatch` from `useReducer` is referentially stable, so that provider never invalidates. Second, split state by how often each part changes: columns change on mutation, selection on click, drag position on every pointer move. One context per change rate means a component reading columns does not re-render because a pointer moved. The cost is a provider pyramid, and past three or four splits you have hand-built a store with worse ergonomics than one you could install.

**★ At what point should a team stop splitting contexts and take a dependency?**
When the split stops being a one-time optimisation and starts being a tax on every change. Two contexts — state and dispatch — is almost always worth writing by hand; it is ten lines and it removes the largest single class of re-render. Three or four is defensible when the change rates really are independent. Past that, adding a field means touching a provider, a context, a hook and a memo, the provider file becomes a pyramid, and every new developer has to learn a bespoke store with no documentation. At that point an installed store gives you selectors, shallow comparison, devtools and persistence for the same conceptual budget — and the sixty-line `useSyncExternalStore` version in [04c](04c-usesyncexternalstore-the-escape-hatch.md) is a good way to prove to yourself that it is not magic before you install it.

---

← [04 · Context is not a state manager](04-client-state-tools-compared-react-context-zustand-jotai.md) · [Chapter 8 overview](01-explanation.md) · Next → [04c · useSyncExternalStore, the escape hatch](04c-usesyncexternalstore-the-escape-hatch.md)
