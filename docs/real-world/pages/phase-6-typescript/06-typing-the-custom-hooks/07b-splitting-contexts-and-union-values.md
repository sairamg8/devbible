---
title: "Two contexts instead of one is a typing decision before it is a performance one, a context value that is a discriminated union removes an entire class of wrong call, and a module-scope generic context does not exist"
sidebar_label: "07b · Splitting contexts, union values"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — `function createContext<T>(defaultValue: T): Context<T>;`,
> `interface Context<T> extends Provider<T>`,
> `function useContext<T>(context: Context<T>): T;`,
> `export type Usable<T> = ReactPromise<T> | Context<T> |
> RendererUsable<T>[keyof RendererUsable<T>];` and
> `export function use<T>(usable: Usable<T>): T;` — and the React reference for
> [`use`](https://react.dev/reference/react/use) and
> [`useContext`](https://react.dev/reference/react/useContext).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**Once [the factory](07-context-without-undefined.md) exists, the interesting
decisions are about what goes into `T`.** Splitting one context into a state
half and an actions half is usually sold as a re-render optimisation, and it is
a *typing* improvement first: it forces you to say which half of the API is
stable. A context value that is a discriminated union deletes a class of wrong
call that no amount of null-checking would have caught. And a genuinely generic
context — `DataTableContext<Row>` — is a thing TypeScript will not let you
declare at module scope, which is worth knowing before you spend an afternoon
on it.

## Splitting the context so a dispatcher does not re-render

```ts
const [CartStateContext, useCartState] = createStrictContext<CartState>('CartState');
const [CartApiContext,   useCartApi]   = createStrictContext<CartActions>('CartApi');
```

```ts
// apps/web/src/cart/types.ts — the split, at the type level
export interface CartState   { items: CartItem[]; pending: number }
export interface CartActions {
  setQuantity: (product: Product, quantity: number) => Promise<void>;
  clear: () => Promise<void>;
}
```

A component that only calls `setQuantity` reads `CartApiContext`, whose value
is memoised with an empty dependency list and therefore never changes identity;
it does not re-render when an item's quantity does. **The type consequence is
two interfaces where there was one, and that is the part worth having even if
the app were fast enough without it** — `CartActions` is now, by construction,
the set of things that do not change when the cart does.

```tsx
export function CartProvider({children}: {children: React.ReactNode}) {
  const [state, dispatch] = useReducer(cartReducer, {items: [], pending: 0});
  const stateRef = useRef(state);
  stateRef.current = state;

  const actions = useMemo<CartActions>(() => ({
    setQuantity: async (product, quantity) => { … },   // reads stateRef, not state
    clear: async () => { … },
  }), []);                                             // ← empty: never re-allocated

  return (
    <CartApiContext value={actions}>
      <CartStateContext value={state}>{children}</CartStateContext>
    </CartApiContext>
  );
}
```

⚠️ **The empty dependency array is what makes the split pay, and it forces the
actions to read state through a ref** — which is the render-body ref write
[chunk 05](05-useref-and-its-three-overloads.md) flags. There is no free
version of this: either the actions close over live state and change identity,
or they read a ref and you accept the caveat.

## A context whose value is a discriminated union

The auth context has no "empty" state to fake, and its value is genuinely two
shapes:

```ts
// apps/web/src/auth/types.ts
export type Session =
  | {status: 'anonymous';     signIn: (creds: Credentials) => Promise<void>}
  | {status: 'authenticated'; user: User; signOut: () => Promise<void>};

const [SessionContext, useSession] = createStrictContext<Session>('Session');
```

```tsx
const session = useSession();
if (session.status === 'anonymous') return <SignInPanel onSubmit={session.signIn} />;
return <AccountMenu user={session.user} onSignOut={session.signOut} />;
```

`signIn` exists only when anonymous and `signOut` only when authenticated, so
neither can be called in the wrong state. This is
[chapter 04's pattern](../04-discriminated-unions/README.md) applied to a
context value, and it fits better here than anywhere else in the client: **the
"not signed in" state is not an absence of data, it is a different set of
available actions.**

📌 **Two nullables, two different meanings.** `Session | null` from the raw
context means *"no provider"*; `status: 'anonymous'` means *"provider present,
nobody signed in"*. Collapsing them into one `User | null` — the shape most
apps start with — is what produces `if (!user) return <SignIn/>` in forty
components and a sign-in panel rendered when the provider is simply missing.

## `use(Context)` and what it does and does not change

React 19 adds a second way to read a context:

```ts
export type Usable<T> = ReactPromise<T> | Context<T> | RendererUsable<T>[keyof RendererUsable<T>];
export function use<T>(usable: Usable<T>): T;
```

`use(SessionContext)` returns the same `T` as `useContext(SessionContext)` —
the type is identical. What differs is that `use` may be called conditionally,
inside a branch or a loop, where the rules of hooks forbid `useContext`. That
is occasionally useful and it changes nothing about the design in these two
chunks: `T` is still `Session | null` unless a guard removes the `null`, and
the guard is still the only place the check belongs.

## The generic context TypeScript will not let you write

```ts
// ✗ does not exist — a module-level const has no type parameters
const DataTableContext = createContext<DataTableApi<Row> | null>(null);
//                                                    ^^^ Row is unbound
```

There is no way to declare one context that is generic over its row type,
because a `const` declaration cannot introduce a type parameter. The two
workarounds are both real and both have costs:

```ts
// A — one factory call per concrete row type. Types are exact; you write N of them.
const [OrderTableContext, useOrderTable] = createStrictContext<DataTableApi<OrderRow>>('OrderTable');
const [ProductTableContext, useProductTable] = createStrictContext<DataTableApi<ProductRow>>('ProductTable');

// B — one context over `unknown`, and each consumer parses. One declaration; a parse per read.
const [TableContext, useTableRaw] = createStrictContext<DataTableApi<unknown>>('Table');
export function useTable<S extends z.ZodType>(schema: S): DataTableApi<z.output<S>> { … }
```

This app takes **A**: two admin tables, two contexts, and no parse in a hot
render path. B is the right answer when the number of row types is open-ended,
and its cost is exactly the cost
[chapter 03](../03-typing-raw-pg-results/README.md) prices for every other
boundary — the parse is real work.

## Gotchas

**★ `value={{state, setQuantity}}` allocates a new object every render, and
every consumer re-renders.** The types are identical either way; object
identity is not in them. Memoise the value with `useMemo`, and remember that
`useMemo`'s dependency array has the same blindness
[chunk 02b](02b-the-dependency-array-the-compiler-cannot-check.md) described.

**★ Splitting the contexts without memoising each value achieves nothing.**
Two providers whose values are both fresh object literals re-render exactly as
many consumers as one did. The split is the *precondition* for the
optimisation; `useMemo` with the right dependencies is the optimisation. No
type distinguishes the working version from the decorative one.

**★ A context cannot be generic at module scope.** `const C =
createContext<T>(null)` with a free `T` does not exist — `T` has to be bound
somewhere, and a module-level `const` has no type parameters. The factory
function is the workaround: `createStrictContext<CartApi>('Cart')` binds `T` at
the call. A genuinely generic context needs one factory call per concrete type,
or a context typed over `unknown` with a parse at the consumer.

**★ Nested providers of the same context are legal, identically typed, and the
nearest one wins.** A test that wraps a component in its own `CartProvider`
inside an app that already has one gets the inner value with no warning, and
the types cannot express "there must be exactly one of these". If a duplicate
provider would be a bug rather than a feature, the check is a runtime one — a
module-level flag, or a marker in the value — not a type.

**★ Two nullables in one design confuse everyone.** `Session | null` (no
provider) alongside `user: User | null` (nobody signed in) means every consumer
has two checks and no idea which is which. Keep exactly one nullable — the
context's — and make "signed out" a member of the union.

**★ Splitting state from actions puts the state read through a ref.** Actions
memoised with `[]` cannot close over live state, so they read `stateRef.current`
— which is a render-body ref write, flagged in
[chunk 05](05-useref-and-its-three-overloads.md). The alternative, memoising on
`[state]`, re-allocates the actions on every state change and undoes the split.
Pick one deliberately; both are defensible and only one of them is fast.

**★ `use(Context)` is not a way around the guard.** It returns the same `T`,
including the `null`, so reading a strict context with `use` and skipping the
throw reintroduces exactly the nullable every consumer was supposed to be
spared. Its advantage is that it may be called conditionally; that is a
rules-of-hooks difference, not a typing one.

**★ A union context value still needs the guard hook.** `Session | null` has
three states from the consumer's perspective — no provider, anonymous,
authenticated — and only two of them are the union's. The guard removes the
first so the switch in the consumer has exactly the members the union declares,
and the `assertNever` after it stays meaningful.

## Interview questions

**★ How do you avoid re-rendering every consumer when one cart item changes?**
Split the context in two — one for the state, one for the stable action API —
and memoise each value, the actions with an empty dependency array. A component
that only dispatches subscribes to the action context, whose value never
changes identity, so a quantity change does not touch it. Nothing about this is
enforced by types; what the types contribute is the honest separation of
`CartState` from `CartActions`, which documents which half is stable and makes
the empty dependency array reviewable.

**★ What does the split cost?**
The actions can no longer close over live state, because closing over it would
change their identity on every state change and undo the memo. They read a ref
instead, which means a ref write in the render body — a documented React
caveat — or an `useEffectEvent` per action. There is no arrangement where the
actions are both stable and directly closed over current state; choosing is the
work.

**★ When should a context value be a discriminated union?**
When the states offer different *operations*, not just different data. The
session context is the clean case: anonymous exposes `signIn` and no user,
authenticated exposes `user` and `signOut`, and typing it as one object with
optional fields would let a component call `signOut` while signed out. The
union makes the wrong call a compile error and the switch in the consumer the
only way to reach either branch.

**★ Why is `Session | null` plus `status: 'anonymous'` better than
`user: User | null`?**
Because they mean different things and the second design conflates them. `null`
from the context means the provider is missing — a programmer error, handled
once in the guard hook by throwing. `status: 'anonymous'` means the provider is
present and nobody is signed in — an ordinary application state, handled in
every consumer by narrowing. With a single `User | null` both conditions look
identical at every call site, so a missing provider renders a sign-in panel and
nobody ever finds out.

**★ Can you write one context that is generic over a row type?**
Not at module scope: a `const` declaration cannot introduce a type parameter,
so `createContext<DataTableApi<Row> | null>(null)` has nowhere to bind `Row`.
Either call a factory once per concrete row type — exact types, N declarations,
which is what this app does for its two admin tables — or declare one context
over `unknown` and parse at each consumer, which is one declaration and a real
runtime cost on every read.

**★ What does React 19's `use(Context)` change for typing?**
Nothing. It is declared `use<T>(usable: Usable<T>): T` with `Context<T>` as one
member of `Usable<T>`, so it returns exactly what `useContext` returns,
`null` included. Its difference is a rules-of-hooks one: it may be called
conditionally. Using it to read a strict context without the guard puts the
nullable straight back into the consumer.

---

← Prev: [Context with no `undefined` to consume](07-context-without-undefined.md) ·
[Overview](README.md) ·
Next → [`useState` initialisers](08-usestate-initialisers.md)
