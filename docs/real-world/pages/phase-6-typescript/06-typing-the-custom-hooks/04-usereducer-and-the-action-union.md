---
title: "React 19 infers useReducer's state and dispatch from the reducer function itself, so annotating the reducer is the whole job — and the JavaScript's default clause is the line that has to go"
sidebar_label: "04 · useReducer and the action union"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — the two `useReducer` overloads, `type AnyActionArg = [] | [any];`,
> `type ActionDispatch<ActionArg extends AnyActionArg> = (...args: ActionArg)
> => void;`, `type Reducer<S, A> = (prevState: S, action: A) => S;` — the React
> reference for [`useReducer`](https://react.dev/reference/react/useReducer),
> and the TypeScript handbook's
> [narrowing / exhaustiveness](https://www.typescriptlang.org/docs/handbook/2/narrowing.html).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**Typing a reducer is not "pass `Reducer<S, A>` to `useReducer`" — React 19's
declaration has no slot for that type.** It takes the reducer as a function
with a rest parameter and infers both the state and the dispatch signature from
it, which means the reducer function's own annotation is the only place types
enter. Getting that annotation right converts
[phase 4·06's cart reducer](../../phase-4-react-ui/06-cart-state.md) from a
`switch` with a `default: throw` into a `switch` the compiler completes for
you — and deleting that `default` is the single most valuable line of this
chunk. [04b](04b-wiring-the-reducer-and-dispatch.md) takes the call site.

## The declarations, verbatim

```ts
function useReducer<S, A extends AnyActionArg>(
    reducer: (prevState: S, ...args: A) => S,
    initialState: S,
): [S, ActionDispatch<A>];

function useReducer<S, I, A extends AnyActionArg>(
    reducer: (prevState: S, ...args: A) => S,
    initialArg: I,
    init: (i: I) => S,
): [S, ActionDispatch<A>];

// Limit the reducer to accept only 0 or 1 action arguments
type AnyActionArg = [] | [any];
// Get the dispatch type from the reducer arguments (captures optional action argument correctly)
type ActionDispatch<ActionArg extends AnyActionArg> = (...args: ActionArg) => void;
```

Three things follow directly from that text, and the comments are the React
types' own:

1. **`A` is a tuple of the reducer's action parameters**, not the action type.
   For the cart, `A` is `[CartAction]` and `ActionDispatch<[CartAction]>` is
   `(action: CartAction) => void`.
2. **A reducer may take zero or one action argument and no more** —
   `AnyActionArg` is `[] | [any]`. A reducer written
   `(state, action, meta) => …` does not fit the declaration, and the error
   points at the whole call.
3. **`Reducer<S, A>` still exists and is no longer how you type this.** It is
   `(prevState: S, action: A) => S` and remains useful as a standalone
   annotation; it is not a parameter of `useReducer` in React 19's types.

## The cart's action union

```ts
// apps/web/src/cart/types.ts
import type {CartItem} from '@storefront/shared';

export interface CartState {
  items: CartItem[];
  pending: number;
}

export type CartAction =
  | {type: 'server';     items: CartItem[]}
  | {type: 'optimistic'; item: CartItem}
  | {type: 'settle'}
  | {type: 'rollback';   items: CartItem[]};
```

Same discipline as `AsyncState`: each member declares only what it carries.
`settle` has no payload, `optimistic` has one item, the two that replace the
list carry the list.

## The reducer, annotated — and the `default` clause deleted

```ts
// apps/web/src/cart/reducer.ts
import {assertNever} from '@storefront/shared';

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'server':
      return {items: action.items, pending: state.pending};

    case 'optimistic': {
      const exists = state.items.some((i) => i.product_id === action.item.product_id);
      const items = exists
        ? state.items.map((i) =>
            i.product_id === action.item.product_id ? {...i, quantity: action.item.quantity} : i)
        : [...state.items, action.item];
      return {
        items: action.item.quantity === 0
          ? items.filter((i) => i.product_id !== action.item.product_id)
          : items,
        pending: state.pending + 1,
      };
    }

    case 'settle':
      return {...state, pending: state.pending - 1};

    case 'rollback':
      return {items: action.items, pending: state.pending - 1};
  }
  return assertNever(action, 'cartReducer');
}
```

🔴 **The JavaScript ended with a `default:` clause that threw
`` `unknown action ${action.type}` `` and that line must not survive the
port.** Inside a `default:` clause the action is already `never`, so reading
`action.type` fails to compile — and the usual fix people apply is
`(action as CartAction).type`, which silences it and permanently disables
exhaustiveness. A fifth action then compiles everywhere and throws at run time
in exactly the code path that was supposed to catch it. Drop the `default`,
put `assertNever` after the switch, and adding `{type: 'clear'}` to the union
fails to compile here first.

## Gotchas

**★ 🔴 `default:` in a reducer is worse than in a component.** In a render
switch a `default` returns a fallback; in a reducer the conventional default
*throws*, so the code looks maximally defensive while being the reason the
compiler stopped checking. The throw fires at run time for the case the type
system would have caught at build time — and only on the code path that
triggers the new action.

**★ A reducer with more than one action parameter does not fit the
declaration.** `AnyActionArg` is `[] | [any]`, with the React types' own
comment saying so: *"Limit the reducer to accept only 0 or 1 action
arguments"*. `(state, action, meta) => …` produces an inference failure at the
`useReducer` call rather than at the reducer, which reads as a mysterious error
about the hook. Put the metadata in the action.

**★ Whether an object literal may carry a payload belonging to a different
action is not something the documentation settles.** `dispatch({type:
'settle', items: []})` involves excess-property checking against a *union*
target, and the handbook's excess-property material does not cover the union
case — **I could not confirm the behaviour from the TypeScript documentation
and am not going to assert it.** If you want the extra key rejected for
certain, say so in the type:

```ts
  | {type: 'settle'; items?: never; item?: never}
```

That is the same `?: never` device
[chunk 01c](01c-narrowing-asyncstate-at-the-call-site.md) discussed, used for
rejection rather than for destructuring, and it is worth the noise only on
unions where a mis-typed payload would be silently ignored at run time.

**★ A missing payload *is* caught, and that is the property you actually rely
on.** `dispatch({type: 'rollback'})` fails — the `rollback` member requires
`items` — so the common bug (forgetting the payload) is a compile error even
though the uncommon one (an extra payload) may not be.

**★ The reducer must be pure and the type system will not help.** Nothing in
`(prevState: S, ...args: A) => S` prevents a `fetch`, a `Date.now()`, or a
mutation of `state.items`. `Readonly<CartState>` on the parameter stops the
most obvious mutation:

```ts
export function cartReducer(state: Readonly<CartState>, action: CartAction): CartState
```

…and it is shallow — `state.items.push(x)` still compiles, because
`Readonly<T>` maps only the top level. `readonly CartItem[]` on the field is
what stops that one, and
**chapter 08·02** *(not written yet)*
prices how far down that rabbit hole is worth going.

**★ Two actions that differ only in payload shape want two `type` values, not
one.** `{type: 'server'; items: CartItem[]}` and `{type: 'server'; cart:
Cart}` in the same union make `case 'server'` narrow to the union of both, so
neither `items` nor `cart` is reachable without a second check. The
discriminant is the identity of the action; if the payload differs, the action
differs.

**★ An action union with a payload typed `any` poisons the branch that uses
it.** `{type: 'server'; items: any}` compiles and makes `action.items.mpa(…)`
compile too. This enters through a mapper that returns `any`, usually because
something upstream called `res.json()` — the same hole
**chapter 07·01** *(not written yet)* exists to
close. The reducer is a good place to notice it, because a reducer's inputs
are the app's own values and should never be `any`.

## Interview questions

**★ How do you type `useReducer` in React 19, and why is `Reducer<S, A>` not
the answer?**
You annotate the reducer function — `function cartReducer(state: CartState,
action: CartAction): CartState` — and call `useReducer(cartReducer, initial)`
with no type arguments. React 19's declaration takes
`(prevState: S, ...args: A) => S` and infers `S` and `A` from it, then produces
`ActionDispatch<A>`; there is no parameter for a `Reducer<S, A>` type. The type
alias still exists and is fine as a standalone annotation, but passing it to
the hook is a React 17-era habit that no longer describes the declaration.

**★ What does `AnyActionArg = [] | [any]` prevent?**
A reducer taking more than one action argument. The action parameters are
captured as a tuple `A`, constrained to zero or one element, so
`(state, action, meta) => …` cannot be inferred and the error appears at the
`useReducer` call. It also enables the zero-argument form: a reducer with no
action parameter yields `dispatch: () => void`, and one with an optional action
parameter yields a dispatch that accepts zero or one argument.

**★ Why must the `default:` clause go, and what replaces it?**
Because inside `default:` the action has already been narrowed to `never`, so
the conventional throw that interpolates `action.type` does not compile, and
the reflexive fix — casting the action back — permanently disables
exhaustiveness checking for that reducer. Replace it with `assertNever(action,
'cartReducer')` after the switch: the parameter typed `never` accepts the value
only when every member has been handled, so adding an action to the union
breaks the build at the reducer instead of throwing in production.

**★ Does the action union stop you dispatching a payload that belongs to a
different action?**
The missing-payload case is definitely caught: `{type: 'rollback'}` without
`items` does not compile. The extra-payload case — `{type: 'settle', items:
[]}` — depends on how excess-property checking treats a union target, which the
TypeScript documentation does not settle, so do not build a design on it. If
rejection matters, declare the absent keys as `?: never` on the members that
lack them and the check becomes an ordinary assignability failure.

**★ What is `Readonly<CartState>` on the reducer's parameter worth?**
It stops `state.items = []` and `state.pending++`, which are the mutations
people write by accident, and it stops nothing below the first level —
`Readonly<T>` is a shallow mapped type, so `state.items.push(item)` still
compiles. Declaring the field as `readonly CartItem[]` closes that one. It is
worth doing at the top level for one line of annotation; going deeper means
every construction site inside the reducer gets more awkward, and the payoff
falls off quickly.

---

← Prev: [Tuple or object: the return shape](03-tuple-or-object-returns.md) ·
[Overview](README.md) ·
Next → [Wiring the reducer, and dispatch through context](04b-wiring-the-reducer-and-dispatch.md)
