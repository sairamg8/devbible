---
title: "useState infers its state from the initial value, so an empty literal gives you never[] — and when the state is itself a function the lazy-initialiser union is genuinely ambiguous"
sidebar_label: "08 · useState initialisers"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — `function useState<S>(initialState: S | (() => S)): [S,
> Dispatch<SetStateAction<S>>];`,
> `function useState<S = undefined>(): [S | undefined,
> Dispatch<SetStateAction<S | undefined>>];`,
> `type SetStateAction<S> = S | ((prevState: S) => S);`,
> `type Dispatch<A> = (value: A) => void;` — and the React reference for
> [`useState`](https://react.dev/reference/react/useState).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**`useState([])` inferring `never[]` is the single most-reported "TypeScript is
being difficult" moment in a React codebase, and it is inference working
exactly as designed on a literal with no element type.** The fix is one
annotation in a place that is easy to name. The harder case in this chunk is
the one where the types genuinely cannot help: when `S` is itself a function
type, `S | (() => S)` is ambiguous, React resolves it at run time by calling
the function, and both the correct and the incorrect spelling type-check.

## Both overloads, and the three calls that surprise people

```ts
function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
// convenience overload when first argument is omitted
function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];

type SetStateAction<S> = S | ((prevState: S) => S);
type Dispatch<A> = (value: A) => void;
```

```ts
const [product, setProduct] = useState();               // S defaults to undefined
//     ^ undefined — setProduct accepts nothing else
const [product, setProduct] = useState<Product>();      // Product | undefined  ✓
const [items, setItems] = useState([]);                 // never[] — setItems([x]) fails
const [items, setItems] = useState<CartItem[]>([]);     // CartItem[]  ✓
const [error, setError] = useState(null);               // null, forever
const [error, setError] = useState<ApiFailure | null>(null);   // ✓
```

**`useState<AsyncState<T>>({status: 'idle'})` from
[chunk 01](01-asyncstate-as-a-union.md) is the same rule.** The annotation goes
on the *hook call*, because the initial value is a literal and literals either
widen (`'loading'` to `string`) or collapse (`[]` to `never[]`); the annotation
makes the literal a checked value instead of the definition. Three hooks in
this chapter now share that rule — `useState`, `useReducer` via its reducer,
and an exported hook's return type — and it is the same sentence each time:
**write the type on the declaration and let the literal be checked.**

## 🔴 The lazy initialiser eats a function-valued state

```ts
const [handler, setHandler] = useState<() => void>(onCancel);
```

`initialState` is `S | (() => S)`. With `S = () => void`, both members of that
union are satisfied by `onCancel`, and React resolves the ambiguity at *run
time* by calling any function it is given. So `handler` ends up as whatever
`onCancel` returned — `undefined` — and no type error was ever going to
appear.

```ts
// ✓ wrap it: the arrow is the initialiser, the function is the value
const [handler, setHandler] = useState<() => void>(() => onCancel);

// ✓ and the setter has exactly the same ambiguity
setHandler(() => nextHandler);       // stores nextHandler
setHandler(nextHandler);             // ✗ calls it as an updater
```

`SetStateAction<S> = S | ((prevState: S) => S)` has the identical shape, so the
setter is ambiguous in the same way. **This is the one place in the chapter
where the correct code and the incorrect code have the same type**, and the
only real defence is to not put functions in state — a reducer action, a ref,
or a `useEffectEvent` all express "a callback that changes" without the
ambiguity.

## Gotchas

**★ `useState([])` gives `never[]` and the error appears at the first
`setItems([item])`.** The empty array literal has no element type to infer, so
`S` is `never[]` and the message names `never`, which explains nothing about
the cause. Same for `useState({})`, which gives `{}` and rejects every
property, and `useState(null)`, which gives `null`. Annotate the hook call.

**★ `useState()` with no argument does not give you `T | undefined` — it gives
`undefined`.** The zero-argument overload defaults `S` to `undefined`, so the
return is `[undefined, Dispatch<SetStateAction<undefined>>]` and the setter
accepts only `undefined`. `useState<Product>()` is the call you meant, and it
produces `Product | undefined`.

**★ 🔴 `useState(fn)` calls `fn`, and the types cannot see it.** `S | (() => S)`
is ambiguous whenever `S` is a function type, React resolves it at run time by
invoking, and both spellings type-check identically. Wrap:
`useState<() => void>(() => onCancel)`. Better, do not store functions in
state.

**★ `setState(fn)` has the same ambiguity through `SetStateAction<S>`.** The
updater form and the value form are the same union, so storing a new callback
requires `setHandler(() => next)`. A bug here presents as "my callback state is
`undefined`", which sends people looking at the provider that supplied the
callback rather than at the setter that swallowed it.

**★ An expensive initialiser passed as a value runs on every render, and the
type is identical.** `useState(buildIndex(items))` calls `buildIndex` on every
render and throws the result away after the first; `useState(() =>
buildIndex(items))` calls it once. Both type-check as `S` versus `() => S`,
both produce the same state type, and only one of them is fast. This is the
*benign* half of the same ambiguity that makes function-valued state
dangerous.

**★ Widening bites the literal union just as hard as it bites the empty
array.** `useState('newest')` infers `string`, so `setSort('pirce_asc')`
compiles. The sort control's state needs
`useState<'newest' | 'price_asc' | 'price_desc'>('newest')`, or better, the
`SortKey` type derived from the same `as const` tuple the query module uses —
[chapter 08·06](../08-utility-types-in-app-code/06-satisfies-versus-annotation.md).

**★ Deriving state you could compute is a type that outlives its purpose.**
`const [total, setTotal] = useState(0)` alongside `items` gives you two sources
of truth and a `useEffect` to keep them in sync, all perfectly typed. `const
total = items.reduce(…)` has no state, no effect and no way to drift. The type
system will happily support the wrong design; it never suggests the right one.

## Interview questions

**★ What is wrong with `useState([])`?**
`S` is inferred from an empty array literal, which has no element type, so the
state is `never[]` and the first attempt to set a real array fails with a
message about `never`. The same happens with `useState(null)`, giving state
typed `null` and a setter that accepts nothing else, and with `useState({})`.
The annotation belongs on the hook call — `useState<CartItem[]>([])` — where
the literal becomes a checked value rather than the definition of the state
type.

**★ `useState()` with no argument — what type is the state?**
`undefined`, not `T | undefined`. The zero-argument overload is declared
`useState<S = undefined>()` returning `[S | undefined, …]`, so with the default
in place both halves collapse to `undefined` and the setter takes nothing else.
Supply the type argument — `useState<Product>()` — and the same declaration
gives you `Product | undefined`.

**★ Someone stores a callback in state and it comes back `undefined`. What
happened?**
`useState`'s parameter is `S | (() => S)`, and React treats any function it
receives as a lazy initialiser, so it called the callback and stored the
result. Both readings type-check because `S` is itself a function type, so
there is no diagnostic anywhere. The fix is `useState<() => void>(() =>
onCancel)`, and the same ambiguity exists in `SetStateAction<S>`, so updating
requires `setHandler(() => next)`. The better fix is to not keep functions in
state at all.

**★ When should the initial value be a function, and why does the type not
tell you?**
When computing it is expensive, because the value form runs on every render and
the function form runs once. Both satisfy `S | (() => S)` and both produce
identical state types, so the distinction is purely a performance one that the
compiler has no opinion about. It is the same union that causes the
function-valued-state bug — benign here, dangerous there, and identical in the
declaration.

**★ Why is the annotation on the hook call rather than on the destructured
variable?**
Because `const [items, setItems]: [CartItem[], Dispatch<SetStateAction<CartItem[]>>]
= useState([])` annotates the *result* while the inference has already happened
— the initial literal still produced `never[]`, and now you have an
assignability error instead of a useful state type. Annotating the call fixes
the inference at its source, and the initial literal is checked against it.

---

← Prev: [Splitting contexts, and union context values](07b-splitting-contexts-and-union-values.md) ·
[Overview](README.md) ·
Next → [Event handlers and contextual typing](08b-events-and-contextual-typing.md)
