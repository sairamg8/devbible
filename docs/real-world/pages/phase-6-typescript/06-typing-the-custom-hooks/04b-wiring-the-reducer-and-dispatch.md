---
title: "Annotate the reducer and the initial state becomes a checked value rather than the thing defining the state type, which is the difference between a clear error and a wall of never"
sidebar_label: "04b · Wiring the reducer and dispatch"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — the two `useReducer` overloads, `type Dispatch<A> = (value: A)
> => void;`, `type ActionDispatch<ActionArg extends AnyActionArg> =
> (...args: ActionArg) => void;` — and the React reference for
> [`useReducer`](https://react.dev/reference/react/useReducer), which documents
> the stability of `dispatch`.
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**The `useReducer` call site should have no type arguments on it at all.**
Everything it needs is inferable from the reducer written in
[the previous chunk](04-usereducer-and-the-action-union.md) — provided the
reducer carries annotations, which is the whole trick. Get the direction
backwards and the state type is inferred from an empty array literal, every
branch of the reducer fails against `never`, and the error messages name a type
nobody wrote. This chunk is the call, the lazy-initialiser overload, and
`dispatch` crossing a context boundary into the components that use it.

## Annotate the reducer, not the hook

```tsx
// apps/web/src/cart/CartProvider.tsx
const [state, dispatch] = useReducer(cartReducer, {items: [], pending: 0});
//     ^ CartState        ^ ActionDispatch<[CartAction]>
```

No type arguments. `S` and `A` come from `cartReducer`'s annotated signature,
and the initial state is *checked against* the inferred `S` — a missing
`pending` is an error on this line, naming this line. That is the direction you
want: **the reducer is the declaration and the hook call is a use.**

## The lazy-initialiser overload

The second overload adds `I`, and the initial argument stops having to be the
state:

```ts
const [state, dispatch] = useReducer(
  cartReducer,
  mirror,                                     // I = CartMirror, from localStorage
  (m): CartState => ({items: [], pending: 0, hint: m.count}),
);
```

The `: CartState` on the init function is not decoration. `S` now has two
inference sites — the reducer's parameters and the init function's return — and
annotating the init's return makes the two agree explicitly instead of leaving
the compiler to reconcile them and report the disagreement somewhere else.

## `dispatch` through context

```ts
// apps/web/src/cart/types.ts
import type {Dispatch} from 'react';

export interface CartApi {
  state: CartState;
  dispatch: Dispatch<CartAction>;             // (value: CartAction) => void
  setQuantity: (product: Product, quantity: number) => Promise<void>;
}
```

`Dispatch<CartAction>` and `ActionDispatch<[CartAction]>` describe the same
function. `Dispatch<A>` reads better in a hand-written interface;
`ActionDispatch<A>` is what inference produces at the hook. Pick one for
hand-written declarations and stay with it —
[chunk 07](07-context-without-undefined.md) is where this interface reaches
consumers without an `undefined` in front of it.

📌 **Most components should not see `dispatch` at all.** The cart's consumers
call `setQuantity(product, n)`, which does the optimistic dispatch, the network
call and the rollback in one place. Exporting `dispatch` on the context makes
every component a potential writer of raw actions, and the choreography phase 4
documented — optimistic, confirm, settle, rollback — stops being enforceable.
The type that expresses that is the one that omits it:

```ts
export interface CartApi {
  state: CartState;
  setQuantity: (product: Product, quantity: number) => Promise<void>;
  clear: () => Promise<void>;
}
```

## Gotchas

**★ Leave the reducer's parameters unannotated and `S` comes from the initial
state, which is usually `never[]`.** `useReducer((s, a) => …, {items: [],
pending: 0})` infers `items: never[]`, so the first `return {items:
action.items}` fails with a message about `CartItem` not being assignable to
`never`. The annotation on the reducer is what makes the initial state the
*checked* value rather than the *defining* one — the same relationship as
`useState<AsyncState<T>>({status: 'idle'})` in
[chunk 01](01-asyncstate-as-a-union.md), and the same relationship as
annotating a hook's return type in
[chunk 02](02-generic-hooks-and-inference.md). Three different hooks, one rule:
**write the type on the declaration, and let the literal be checked.**

**★ An inline arrow reducer cannot be annotated conveniently, so people skip
it.** `useReducer((state, action) => {…}, initial)` has nowhere natural to put
`CartState` and `CartAction` without cluttering the call. That is a reason to
hoist the reducer to a named function, not a reason to go without the
annotation — and a hoisted reducer is testable without React, which is the
larger win.

**★ `dispatch` is stable across renders and nothing in its type says so.**
React documents the dispatch identity as stable, which is why it is safe to
omit from dependency arrays. `ActionDispatch<[CartAction]>` is just a function
type; a reviewer reading the type alone cannot tell whether omitting it from a
deps array is correct. It is documented behaviour, not a type-level guarantee,
and the lint rule knows about it only for React's own `useReducer`.

**★ Rolling back to a value captured in a closure is a stale-value bug the
union cannot see.** Phase 4's `setQuantity` reads `serverItems.current` into
`before` and dispatches `{type: 'rollback', items: before}` on failure. The
types are perfect and the value can be two mutations old if the ref was not
updated on the last settle. The ref
([chunk 05](05-useref-and-its-three-overloads.md)) is what makes it current;
the action union carries whatever it is handed, correctly typed and wrong.

**★ The state read inside an async function is the state from that render.**
`async function setQuantity(...) { … dispatch({type:'rollback', items:
state.items}) }` closes over the render's `state`, which is stale by the time
the network call fails. Roll back from the ref that holds confirmed server
truth, or dispatch an action that lets the reducer compute the rollback from
`prevState`. TypeScript sees a correctly-typed `CartState` in both cases.

**★ Putting `state` and `dispatch` in the same context object re-renders every
consumer on every state change.** A component that only dispatches still
subscribes to the state. The usual fix is two contexts — one for the value, one
for the stable API — and the type consequence is two `createContext` calls and
two guard hooks, which
[chunk 07](07-context-without-undefined.md) shows generated from one factory.

**★ Exporting `dispatch` on the context makes the optimistic-update
choreography unenforceable.** Any component can then dispatch `optimistic`
without ever dispatching `settle`, and `pending` never returns to zero, so the
drawer shows a permanent syncing hint. Nothing in the types prevents it; the
prevention is to leave `dispatch` off the exported interface and expose the
verbs — `setQuantity`, `clear` — that always run the full sequence.

## Interview questions

**★ You annotate the reducer, so what is the initial state's type doing?**
Being checked. With the reducer annotated, `S` is inferred from it and the
initial state must be assignable to `CartState`; a missing `pending` field is
an error at the `useReducer` call. Without the annotation the inference runs
the other way, `S` comes from the initial state, `{items: []}` gives
`items: never[]`, and every branch of the reducer that returns real items
fails with an error that names `never` and explains nothing about the cause.

**★ What does the third argument to `useReducer` change about the types?**
It selects the second overload, which introduces `I` for the initial argument
and takes `init: (i: I) => S`. The initial argument no longer has to be the
state — it can be a localStorage mirror, a prop, a URL parameter — and `S` now
has two inference sites, the reducer's parameters and the init function's
return. Annotating the init function's return type makes those two agree
explicitly rather than leaving the compiler to reconcile them and report the
mismatch at a distance.

**★ `Dispatch<CartAction>` or `ActionDispatch<[CartAction]>` — which do you
write?**
They describe the same function. `Dispatch<A>` is the readable one for a
hand-written interface, `ActionDispatch<A>` is what inference produces from the
hook because it is derived from the reducer's parameter tuple. Use `Dispatch`
where you declare, expect `ActionDispatch` where you hover, and do not mix them
in the same file.

**★ Should `dispatch` be on the cart context at all?**
Usually not. The cart's invariant is a sequence — optimistic, confirm, settle
or rollback — and exposing raw `dispatch` lets any component start that
sequence without finishing it, leaving `pending` permanently above zero. Expose
the verbs (`setQuantity`, `clear`) and keep `dispatch` inside the provider; the
type that enforces it is simply the interface that omits the field, which is
the cheapest enforcement mechanism in this chapter.

**★ Why is a hoisted, named reducer better than an inline arrow, beyond
style?**
Because the annotation has somewhere to live. An inline `(state, action) => …`
gets its types from the initial state, which is the wrong direction and
produces `never` errors; annotating it inline clutters the call badly enough
that people skip it. A named reducer carries `CartState` and `CartAction` on
its own signature, is unit-testable without rendering anything, and gives the
`useReducer` call a clean, argument-free inference.

---

← Prev: [`useReducer` and the action union](04-usereducer-and-the-action-union.md) ·
[Overview](README.md) ·
Next → [`useRef` and its three overloads](05-useref-and-its-three-overloads.md)
