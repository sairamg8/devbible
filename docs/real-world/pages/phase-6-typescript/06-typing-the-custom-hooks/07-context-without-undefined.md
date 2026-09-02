---
title: "createContext demands a default value, so the only design where consumers never see a fake one is a nullable context plus a guard hook whose throw is what narrows the type"
sidebar_label: "07 · Context without undefined"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — `function createContext<T>(defaultValue: T): Context<T>;` with
> its comment *"If you thought this should be optional, see …"*,
> `interface Context<T> extends Provider<T> { Provider: Provider<T>; Consumer:
> Consumer<T>; displayName?: string | undefined; }`,
> `interface ProviderProps<T> { value: T; children?: ReactNode | undefined; }`
> and `function useContext<T>(context: Context<T>): T;` — and the React
> reference pages for
> [`createContext`](https://react.dev/reference/react/createContext) and
> [`useContext`](https://react.dev/reference/react/useContext).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**`createContext<T>(defaultValue: T)` has no overload without an argument, and
that single fact drives the entire design of every typed context in this app.**
You must supply a value that will be handed to any component rendered outside a
provider — and for a cart API, an auth session or a toast queue, there is no
honest such value. The three common escapes (`{} as CartApi`, `null as any`,
`T | undefined`) each move the lie somewhere else. The arrangement that does
not lie is a context typed `T | null` whose only exported consumer is a hook
that throws, because a `throw` is what lets the hook's declared return type
drop the `null`.

## The declaration, and the comment that anticipates your question

```ts
function createContext<T>(
    // If you thought this should be optional, see
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/24509#issuecomment-382213106
    defaultValue: T,
): Context<T>;

interface ProviderProps<T> {
    value: T;
    children?: ReactNode | undefined;
}

function useContext<T>(context: Context<T>): T;
```

`useContext` returns exactly `T`. Whatever you put in `T` is what every
consumer sees — including the `null` or `undefined` you added to make the
default expressible. **The type parameter is the contract; the default value
just has to satisfy it.**

## Three escapes, and what each one costs

```ts
// ✗ 1 — the empty cast. Consumers get a perfect type over an empty object.
const CartContext = createContext<CartApi>({} as CartApi);

// ✗ 2 — the any cast. Same as 1, with a lint suppression on top.
const CartContext = createContext<CartApi>(null as any);

// ~ 3 — honest, and it taxes every consumer.
const CartContext = createContext<CartApi | undefined>(undefined);
```

1 and 2 are the same bug: a component rendered outside the provider gets a
fully-typed value that is empty at run time, and the failure is
`setQuantity is not a function` several components deep, with no mention of a
missing provider anywhere. 3 tells the truth and makes every consumer write
`if (!cart) return null;` — a check for a condition that is always a programmer
error, repeated at every call site, and usually handled by returning something
plausible instead of shouting.

## The arrangement that does not lie

```tsx
// apps/web/src/cart/CartProvider.tsx
import {createContext, useContext, useMemo, useReducer} from 'react';
import type {CartApi} from './types.js';

const CartContext = createContext<CartApi | null>(null);   // ← null lives HERE

export function CartProvider({children}: {children: React.ReactNode}) {
  const [state, dispatch] = useReducer(cartReducer, {items: [], pending: 0});

  const api = useMemo<CartApi>(() => ({
    state,
    setQuantity: async (product, quantity) => { … },
    clear: async () => { … },
  }), [state]);

  return <CartContext value={api}>{children}</CartContext>;
}

export function useCart(): CartApi {          // ← and NOT here
  const ctx = useContext(CartContext);
  if (ctx === null) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
```

Two things make this work, and both are type-level:

- **The `throw` narrows.** After `if (ctx === null) throw …`, the remaining
  type is `CartApi`, so `return ctx` satisfies the declared `: CartApi` with no
  assertion. The runtime check and the type narrowing are the same line.
- **The annotation on `useCart` is the contract.** Written without it the
  return type would still infer as `CartApi`; written with it, a refactor that
  removes the throw fails *here* instead of handing `CartApi | null` to fifty
  components.

🔴 **Export `useCart`, not `CartContext`.** The guard is only a guarantee if
there is no way around it. A module that exports both invites
`useContext(CartContext)` at some call site that "just needs to check whether
the provider exists", and that call site is the one that ships `null` into a
render.

📌 **`<CartContext value={api}>` with no `.Provider` is React 19.** The
declaration is `interface Context<T> extends Provider<T>`, so the context
object is itself a valid component with a `value` prop. `.Provider` is still on
the interface and still works; new code does not need it.

## The reusable factory

Four contexts in this app follow the identical pattern — cart, auth, toasts,
the admin table's filter state. Write it once:

```ts
// apps/web/src/lib/strict-context.ts
import {createContext, useContext} from 'react';
import type {Provider} from 'react';

export function createStrictContext<T>(name: string) {
  const Context = createContext<T | null>(null);

  function useValue(): T {
    const ctx = useContext(Context);
    if (ctx === null) throw new Error(`use${name} must be used inside <${name}Provider>`);
    return ctx;
  }

  return [Context as Provider<T | null>, useValue] as const;
  //                                                ^^^^^^^^ chunk 03's rule
}
```

```ts
const [CartContextProvider, useCart] = createStrictContext<CartApi>('Cart');
```

`as const` is doing the same job it did in
[chunk 03](03-tuple-or-object-returns.md): without it the return is an array of
the union of a context and a hook, and both destructured bindings are useless.
`T` is inferred from the explicit type argument at the call — the one place in
this chapter where writing the argument is unavoidable, because `T` appears
nowhere in the parameter list.

[07b](07b-splitting-contexts-and-union-values.md) takes what you do with the
factory once you have it: two contexts instead of one, a context value that is
a discriminated union, and the generic context TypeScript will not let you
write.

## Gotchas

**★ `createContext<CartApi>({} as CartApi)` produces a perfect type over an
empty object.** Every consumer type-checks; a consumer rendered outside the
provider throws `setQuantity is not a function` from inside a click handler,
and nothing in the message mentions the provider. The cast is the bug and the
`as` is the tell.

**★ The default value is not initial state.** React uses it *only* when no
matching provider is above the component. Putting a plausible-looking cart in
it — `createContext<CartApi>(emptyCart)` — means a mis-mounted subtree renders
a working, permanently empty cart instead of failing, which is strictly harder
to diagnose than a thrown error.

**★ `createContext<CartApi | undefined>(undefined)` is honest and pushes the
check to every consumer.** It is not wrong, and it is worse than the guard
hook: the check is repeated everywhere, it is a check for a programmer error
rather than a runtime condition, and every consumer must decide what to render
in a state that cannot legitimately occur. Centralise it in the hook and throw.

**★ Exporting the context alongside the hook defeats the guard.** Nothing
prevents `useContext(CartContext)` at a call site that wants to "check
whether there is a provider". If a component genuinely needs to behave
differently outside a provider — a design smell, but it happens — export a
second hook `useCartOrNull(): CartApi | null` so that the nullable path is a
named, greppable API rather than a bypass.

**★ The guard hook's `throw` is what narrows; a body that returns
`{} as CartApi` instead does not.** Any escape that returns a value instead of throwing
puts the fake object back and re-introduces the first gotcha, with the extra
insult that the code now looks like it handled the case. The only two correct
bodies are `throw` and `return ctx` — nothing else.

**★ `ctx === null` and `!ctx` are not the same check.** If `T` can itself be
falsy — a context holding a `number` or a `boolean` — `!ctx` throws for a
perfectly valid `0` or `false`. Compare against `null` explicitly. The factory
above does, which is why it is safe to reuse for value contexts and not only
for API objects.

**★ `displayName` is optional and worth setting.** `Context.displayName =
'Cart'` is declared on the interface (`displayName?: string | undefined`) and
shows up in React DevTools, where an unnamed context is rendered as a generic
label. It costs one line and makes a provider-tree screenshot readable.

## Interview questions

**★ `createContext` requires a default value. Why is that a design problem for
a cart or an auth context, and what do you do about it?**
Because there is no honest default: a component outside the provider has no
cart and no session, and any value you invent will be rendered rather than
reported. The arrangement that does not lie is to type the context `T | null`,
give it `null`, and export only a hook that reads it, throws when it is `null`,
and is annotated to return `T`. The throw both fails loudly at run time and
narrows the type, so consumers get `T` with no check of their own.

**★ Why does the guard hook's return type not need an assertion?**
Because control-flow narrowing does the work: after `if (ctx === null) throw
…`, the only remaining type on the following line is `T`, so `return ctx`
satisfies the declared return type. That is the whole reason the check must
*throw* rather than return a fallback — a fallback leaves the union intact and
puts the assertion back.

**★ What is wrong with `createContext<CartApi>({} as CartApi)`?**
Everything downstream type-checks against a value that has none of the
declared members. A subtree mounted outside the provider renders happily until
someone calls a method, at which point it fails with a message about a function
not existing, several components away from the missing provider. The cast
converts a clear structural error into an obscure runtime one, and the `as` is
the visible tell in review.

**★ Why export the hook and not the context object?**
Because the guarantee is only as strong as the narrowest way in. If the context
is exported, `useContext(CartContext)` is available to anyone, returns
`CartApi | null`, and the first person who wants to "just check" will use it
and then handle the `null` by rendering something plausible. Exporting only the
hook makes the throw unavoidable; if a nullable read is genuinely needed, give
it its own named hook so it is greppable.

---

← Prev: [Abort and the `unknown` rejection](06b-abort-and-the-unknown-rejection.md) ·
[Overview](README.md) ·
Next → [Splitting contexts, and union context values](07b-splitting-contexts-and-union-values.md)
