---
title: "DependencyList is readonly unknown[] and nothing more, so the relationship between a dependency array and the closure it describes is the one thing in this chapter no type can express"
sidebar_label: "02b · The dependency array"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — `type DependencyList = readonly unknown[];`,
> `function useCallback<T extends Function>(callback: T, deps: DependencyList): T;`,
> `function useMemo<T>(factory: () => T, deps: DependencyList): T;`,
> `export function useEffectEvent<T extends Function>(callback: T): T;`
> (tagged `@version 19.2.0`) — the
> [`eslint-plugin-react-hooks` README](https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md),
> and the React reference for
> [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**Half of `useAsync`'s signature is inferred, checked and safe; the other half
is an array of `unknown` that the compiler will never connect to anything.**
The dependency array's correctness is a statement about the free variables of a
function body, which is not a fact about any value's type — so it is a lint
concern, a review concern, and a runtime concern, and never a compile error.
This chunk states exactly what the declaration gives you, what the lint rule
gives you once you configure it for your own hooks, and the two typed patterns
(`fnRef` and `useEffectEvent`) that reduce how much the array has to say.

## The declaration, in full

Verbatim from `@types/react` 19.2.18:

```ts
type DependencyList = readonly unknown[];
```

That is the entire type. Three consequences, all of which bite:

1. **Nothing relates the array to the closure.** The compiler cannot see that
   `fn` reads `slug` and the array does not list it. That is not a weakness of
   the declaration — the relationship is between a *value* and the *free
   variables of a function body*, which types do not describe.
2. **Every element is accepted.** `[{slug}]` type-checks and produces a new
   object identity on every render, so the effect re-runs forever. Phase 4
   listed this as a runtime gotcha; the types will never catch it.
3. **The length is not checked either.** `useAsync(fn, cond ? [a] : [a, b])`
   compiles, and React errors at run time when the array's size changes between
   renders.

`readonly` is the one thing the declaration *does* buy: the array you pass is
not mutated by React, and passing a `readonly string[]` or an `as const` tuple
works without a copy.

## The lint rule is the only checker, and it does not know your hook

```js
// eslint.config.js
'react-hooks/exhaustive-deps': ['warn', {additionalHooks: '(useAsync|useAsyncKeepingPrevious)'}],
```

From the plugin's README:

> *"`exhaustive-deps` can be configured to validate dependencies of custom
> Hooks with the `additionalHooks` option. This option accepts a regex to
> match the names of custom Hooks that have dependencies."*

⚠️ And the same README argues against the design in the first place:

> *"We suggest to use this option very sparingly, if at all. Generally saying,
> we recommend most custom Hooks to not use the dependencies argument, and
> instead provide a higher-level API that is more focused around a specific use
> case."*

That is a real criticism of `useAsync(fn, deps)` and this app accepts it
knowingly: the deps array is the escape hatch that lets one hook serve the
catalog, the product page, the cart and the admin table. The alternative — a
purpose-built hook per resource, with no deps parameter at all — is what
[chapter 07's route map](../07-the-typed-api-client/03-the-route-map.md) makes
cheap enough to reconsider, because the route map is what makes
`useProduct(slug)` a three-line generated wrapper instead of a hand-written
hook per endpoint.

## `fnRef`: the typed version of "latest function, stable identity"

Phase 4's hook keeps the fetcher in a ref so that the effect depends on the
*data* identity (`[slug]`) and not on the function identity, which changes
every render. Typed, the ref is the interesting part:

```ts
type Fetcher<T> = (signal: AbortSignal) => Promise<T>;

export function useAsync<T>(fn: Fetcher<T> | null, deps: DependencyList): UseAsync<T> {
  const fnRef = useRef<Fetcher<T> | null>(fn);
  fnRef.current = fn;                       // every render, before the effect runs
  …
}
```

The explicit type argument on `useRef` is redundant here — `fn`'s declared type
is already `Fetcher<T> | null`, so plain `useRef(fn)` infers the same thing —
and it is written out anyway because the ref's type is a contract about every
value that will ever be assigned to `.current`, not about the initial one.
[Chunk 05](05-useref-and-its-three-overloads.md) is where that distinction has
teeth, and where `fnRef.current = fn` in the render body gets the caveat it
deserves.

## `useEffectEvent`: the same idea, with a declaration

React 19.2 ships a hook for exactly this pattern. Its type, verbatim from
`@types/react` 19.2.18:

```ts
export function useEffectEvent<T extends Function>(callback: T): T;
```

The React reference describes it as a hook that *"lets you separate events from
Effects"* — the returned function always sees the latest render's values and is
excluded from dependency arrays. Typed, it has the same defect as
`useCallback`: the constraint is `T extends Function`, which supplies **no
contextual type to the callback's parameters**, so an unannotated parameter is
an implicit `any`.

```ts
const onSettled = useEffectEvent((cart: Cart) => {
  //                              ^^^^^^^^^^^ annotate, or it is implicitly any
  setCartMirror({count: cart.items.length});
});
```

📌 **Reaching for `useEffectEvent` does not delete the deps array.** It removes
*non-reactive* reads from it — the callback that should not re-trigger the
effect. The values the effect genuinely synchronises on still belong in the
array, and the compiler still cannot tell you which those are.

## Gotchas

**★ `deps` accepts anything, including values that are new on every render.**
`[{slug}]`, `[items.map(f)]`, `[() => x]` all type-check and all re-run the
effect forever. There is no type that says "stable identity". The review rule
is that dependency arrays contain primitives, and anything structured is either
memoised or reduced to a primitive key:

```ts
const key = items.map((i) => i.id).join(',');
const state = useAsync((s) => api.get('/cart/price', {key}, s), [key]);
```

**★ A dependency array whose length changes between renders is a runtime error
the types cannot see.** `useAsync(fn, admin ? [id, role] : [id])` compiles.
React requires a stable array size across renders of the same component. If a
dependency is conditional, put the condition *in* the value —
`[id, admin ? role : null]` — so the length is constant.

**★ The hook's own `[...deps, nonce]` spread inherits the caller's mistakes.**
`useAsync` re-runs on `[...deps, nonce]`, so a caller passing an unstable array
makes the hook's internal effect unstable, and the stack trace points inside
the hook. Nothing in the signature can prevent it; what helps is that the
`nonce` is appended, never prepended, so the caller's indices stay stable in
the React DevTools view.

**★ `useCallback` gives its callback's parameters no contextual type.** The
declaration is `function useCallback<T extends Function>(callback: T, deps:
DependencyList): T`, and `Function` carries no parameter information, so
`useCallback((e) => setQuery(e.target.value), [])` makes `e` an implicit `any`
— an error under `noImplicitAny` and a silent hole without it. Annotate:

```ts
const onChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
  [],
);
```

[Chunk 08b](08b-events-and-contextual-typing.md) covers why the same arrow
written inline in JSX needs no annotation, which is the reason this trips
people: moving a working handler into a `useCallback` breaks it.

**★ `useEffectEvent` has the identical `T extends Function` hole.** Same
declaration shape, same missing contextual type, same fix. It is worth knowing
before you refactor a handler into one and wonder why the parameter went
`any`.

**★ A hook that returns a fresh object every render makes every consumer's
`useMemo` useless.** `return {...state, retry}` allocates a new object per
render, so `useMemo(() => f(state), [state])` in a consumer recomputes every
time. The types say nothing — object identity is not in them. Either memoise
the returned object inside the hook, or document that consumers should depend
on `state.status` and `state.data` rather than on `state`.

**★ Depending on a value the effect does not read is invisible, and it is the
more common bug.** `exhaustive-deps` warns about *missing* dependencies, not
about extra ones, and an extra dependency means an extra fetch per change. The
admin table's `[filters, sort, page, pageSize, refreshToken]` grows one entry
per feature, and half of them end up unread by the fetcher. Read the fetcher,
not the array, when a screen refetches too often.

**★ `readonly unknown[]` means an `as const` tuple is a legal dependency
array, and that is occasionally useful.** `useAsync(fetcher, [slug, page] as
const)` type-checks — the `readonly` in the declaration is what allows it. It
buys nothing at run time and it does stop a stray `deps.push(...)` in a
wrapper hook from compiling.

## Interview questions

**★ `DependencyList` is `readonly unknown[]`. What does that mean the compiler
will never do for you?**
It will never relate the array to the closure. Whether the effect reads a
variable the array does not list is a fact about the function body's free
variables, not about any value's type, so no signature can express it. It also
means every element type-checks — including freshly-allocated objects that
change identity every render — and that the array's length is unchecked even
though React requires it to be stable across renders. All of that is the lint
rule's job, and the lint rule ignores custom hooks unless `additionalHooks`
names them.

**★ The React team recommends against custom hooks that take a dependency
array. Why does this app have one anyway?**
Because one `useAsync` serves every screen, and the alternative the README
prescribes — a higher-level API focused on a specific use case — means a hook
per resource. This app accepts the trade and pays the price the README warns
about: the deps array is configured into `exhaustive-deps` via
`additionalHooks`, and it is the single most common source of stale-closure
bugs in the client. Once the typed route map exists, per-resource hooks get
cheap enough that the trade is worth revisiting.

**★ Why does the hook keep the fetcher in a ref instead of listing it in
`deps`?**
Because the fetcher is a fresh arrow on every render, so listing it re-runs the
effect on every render — a fetch loop. The ref keeps the *latest* function
without giving it an identity the effect depends on, so the effect re-runs on
the data identity (`[slug]`) alone. Typed, the ref is declared
`useRef<Fetcher<T> | null>(fn)`; inference from `fn` gives the same type, and
writing it out states the contract for every value that will later be assigned
to `.current` rather than for the one it happened to start with.

**★ What does `useEffectEvent` change about dependency arrays, and what does
it not?**
It gives you a function that always sees the latest render's values and is
excluded from dependency arrays, so non-reactive reads — a callback, a
telemetry ping, a mirror update — stop forcing re-synchronisation. It does not
remove the reactive dependencies: the values the effect genuinely synchronises
on still belong in the array, and the compiler still cannot say which those
are. Its type, `<T extends Function>(callback: T) => T`, also gives the
callback's parameters no contextual type, so they must be annotated.

**★ A screen refetches far more often than it should. Where do you look, given
the types cannot help?**
At the fetcher body against the dependency array, in that order. The lint rule
only reports *missing* dependencies, so the usual cause is an *extra* one —
something in the array that the fetcher never reads, changing on an unrelated
render — or a structured value with a fresh identity each render. The fix is a
primitive key derived from the data, or memoising the structured value, and
neither is something a type will ever suggest.

---

← Prev: [Generic hooks and where inference comes from](02-generic-hooks-and-inference.md) ·
[Overview](README.md) ·
Next → [Tuple or object: the return shape](03-tuple-or-object-returns.md)
