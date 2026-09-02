---
title: "An array returned from a hook infers as an array of the union of its elements, so a tuple return is a decision you have to write down — and useLocalStorage shows what a type parameter cannot promise"
sidebar_label: "03 · Tuple or object returns"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — `function useState<S>(initialState: S | (() => S)):
> [S, Dispatch<SetStateAction<S>>];` — the TypeScript handbook on
> [`const` assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#const-assertions)
> and the
> [4.9 `satisfies` release note](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html);
> `JSON.parse(text: string): any` in `lib.es5.d.ts` and
> `getItem(key: string): string | null` in `lib.dom.d.ts`, both read from
> `typescript@6.0.3`; **zod 4.4.3** in this repo.
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**React's own hooks return tuples, and a custom hook that copies the shape
without copying the type annotation gets an array of a union instead.**
`useState` is declared to return `[S, Dispatch<SetStateAction<S>>]` — a tuple
type, written out. Return `[value, setValue]` from your own hook with an
inferred return type and TypeScript produces `(T | ((v: T) => void))[]`, which
destructures into two variables that are each *both* things. This chunk is that
mechanism, the two ways to fix it, the rule for choosing tuple versus object at
all, and `useLocalStorage` — the hook in this app whose type parameter is a
promise it cannot keep.

## What an un-annotated array return actually infers

```ts
// apps/web/src/hooks/useLocalStorage.ts — the version with the bug
export function useLocalStorage<T>(key: string, fallback: T) {
  const value: T = …;
  const set = (next: T | undefined) => { … };
  return [value, set];
  //     ^ inferred: (T | ((next: T | undefined) => void))[]
}
```

```ts
const [cart, setCart] = useLocalStorage('cart-summary', {count: 0});
setCart({count: 3});
// ^ 'setCart' is possibly a {count: number}, and calling it is an error
```

The array literal's inferred type is an array whose element type is the union
of the element types, and its **length is not part of the type** — so
`useLocalStorage(…)[7]` also type-checks. Destructuring recovers position but
not type: both bindings get the union.

## Two fixes, and they are not equivalent

**`as const` at the return statement:**

```ts
  return [value, set] as const;
  //     ^ readonly [T, (next: T | undefined) => void]
```

**An explicit tuple return type on the function:**

```ts
export function useLocalStorage<T>(
  key: string,
  fallback: T,
): readonly [T, (next: T | undefined) => void] {
  …
  return [value, set];
}
```

The second is better for an exported hook and for the same reason
[chunk 02](02-generic-hooks-and-inference.md) gave: the annotation makes the
body checked against the contract instead of defining it. `as const` is the
right tool inside a function, for a table or a literal whose exact types must
survive — which is
[chapter 08·06's](../08-utility-types-in-app-code/06-satisfies-versus-annotation.md)
subject.

⚠️ **`as const` produces a `readonly` tuple, and `readonly` propagates.** A
consumer that passes the pair to a function expecting `[T, (v: T) => void]` —
mutable — gets an assignability error, because a `readonly` array is not
assignable to a mutable one. Destructuring is unaffected, which is why this
usually surfaces only when someone writes a wrapper.

## When a tuple, and when an object

| Return | Use when | Because |
|---|---|---|
| **Tuple** — `useState`, `useLocalStorage`, `useDebounce`-with-setter | Two elements, both always consumed, and the caller wants to **name them** | `const [cart, setCart]` and `const [query, setQuery]` in one component would collide as objects; positional naming is the whole point |
| **Object** — `useAsync`, `useForm`, `useCart` | Three or more members, or members consumed selectively, or the shape is a **discriminated union** | `const {field, handleSubmit, errors} = useForm(…)` documents itself, and a union of states cannot be a tuple at all |

🔴 **Three-element tuples are where this goes wrong.** `const [value, set,
clear] = useThing()` forces every call site to remember an order, and the third
element is the one people skip with a hole — `const [value, , clear]`. At three
members, return an object.

📌 **`AsyncState` could not be a tuple even if you wanted one.** A discriminated
union's whole mechanism is a property with a literal type; positions carry no
discriminant. That is why the async hook returns an object and the storage hook
returns a pair, and it is not a stylistic split.

## `useLocalStorage<T>`: the type parameter that is an assertion

Phase 4's implementation reads a string out of `localStorage` and parses it.
Both halves of that are typed against you:

```ts
// lib.dom.d.ts        getItem(key: string): string | null
// lib.es5.d.ts        JSON.parse(text: string, reviver?: …): any
```

So the naive typed port produces a `T` from an `any` with no check at all:

```ts
function safeParse<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw); } catch { return fallback; }
  //           ^^^^^^^^^^^^^^^ any → T, silently
}
```

**Every browser this app has ever run in is a writer to that store.** A cart
mirror written by last month's build, a user editing `localStorage` by hand, a
key collision with another app on the same origin — all of them produce a value
whose shape `T` describes and the data does not. This is
[chapter 03·04's "rows that lie"](../03-typing-raw-pg-results/04-rows-that-lie.md)
with a different storage engine, and the fix is the same one: **parse it.**

```ts
// apps/web/src/hooks/useLocalStorage.ts — the version that keeps its promise
import {z} from 'zod';

export function useLocalStorage<S extends z.ZodType>(
  key: string,
  schema: S,
  fallback: z.output<S>,
): readonly [z.output<S>, (next: z.output<S> | undefined) => void] {
  const raw = useSyncExternalStore(getSnapshot, getSnapshot, () => null);

  const value = useMemo(() => {
    if (raw === null) return fallback;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return fallback; }
    const result = schema.safeParse(parsed);
    return result.success ? result.data : fallback;   // stale mirror → fallback
  }, [raw, schema, fallback]);

  …
}
```

```ts
// packages/shared/src/mirror.ts
export const CartMirror = z.object({count: z.number().int().min(0)});

// the badge
const [mirror, setMirror] = useLocalStorage('cart-summary', CartMirror, {count: 0});
//     ^ {count: number}, and it is true
```

Now `T` is `z.output<S>` — derived from a runtime value that validates — and
the schema change that renames `count` makes a stale mirror fall back to
`{count: 0}` rather than render `undefined`. The type parameter went from an
assertion to a consequence.

## `useDebounce<T>`: the trivial case, stated for contrast

```ts
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
```

`T` is inferred from `value`, the returned value is the same `T`, and nothing
crosses a boundary — no parse, no assertion, no hole. **This is what a fully
honest generic hook looks like**, and it is honest because the value never
leaves the program.

## Gotchas

**★ `return [value, set]` without an annotation gives every consumer a union.**
The inferred type is `(T | Setter)[]`, both destructured bindings have that
union, and the first thing anyone tries — calling the setter — fails with a
message about `T` not being callable. Annotate the return as a tuple.

**★ `as const` makes the tuple `readonly`, and `readonly` is contagious.**
`const pair = useLocalStorage(…)` then `passToHelper(pair)` fails if the helper
declares `[T, (v: T) => void]`. Either declare helpers with `readonly` tuple
parameters, or annotate the hook's return type as a mutable tuple. Do not
"fix" it with a spread copy — that allocates on every render for a type-system
complaint.

**★ `as const` is compile-time only.** It does not freeze the array, and
nothing stops a consumer from mutating it at run time if they get a mutable
alias. If immutability actually matters, `Object.freeze` is the runtime tool
and the type is separate.

**★ A three-element tuple invites the hole.** `const [value, , clear] =
useThing()` compiles, reads badly, and breaks the day someone reorders the
return. Objects have no order to get wrong, and adding a member to an object
return is backwards compatible in a way that inserting a tuple element is not.

**★ `JSON.parse` returns `any`, so it launders any type you like.**
`const value: Cart = JSON.parse(raw)` has exactly the same evidence behind it
as `const value = JSON.parse(raw) as Cart`. Typing the intermediate as
`unknown` — `const parsed: unknown = JSON.parse(raw)` — is what forces the
parse to happen, and it costs one word.

**★ `localStorage.getItem` returns `string | null`, and `null` is a value
`JSON.parse` accepts as `'null'` but not as `null`.** `JSON.parse(null as any)`
coerces to the string `'null'` and yields `null` — so a missing key and a key
holding the literal text `null` become indistinguishable if the null check is
skipped. Check `raw === null` before parsing, as the code above does.

**★ Passing a schema as a hook argument puts it in the dependency array.**
`useMemo(..., [raw, schema, fallback])` re-runs whenever `schema` changes
identity, so the schema must be a module-level constant — not
`z.object({...})` written inline at the call site, which allocates a new schema
every render. The same applies to `fallback` if it is an object literal:
hoist both, or key the memo on `raw` alone and accept the staleness.

**★ Wrapping `useState` and returning its result directly is already correctly
typed; re-building the pair is what loses it.** `return useState<T>(initial)`
keeps `[S, Dispatch<SetStateAction<S>>]`. `const [v, s] = useState<T>(initial);
return [v, s];` throws it away and re-infers the union. If a wrapper adds
nothing, return the call.

**★ `Dispatch<SetStateAction<S>>` is not `(v: S) => void`, and a hook that
narrows it breaks the updater form.** `SetStateAction<S>` is declared
`S | ((prevState: S) => S)`, so a custom setter typed `(next: T) => void`
silently forbids `setCart((c) => ({count: c.count + 1}))` — the form every
consumer eventually reaches for. If your setter really only accepts values,
say so in the name (`replaceCart`); if it should accept both, declare it
`Dispatch<SetStateAction<T>>` and handle the function case.

## Interview questions

**★ Why does `return [value, setValue]` from a custom hook behave differently
from `useState`?**
Because `useState` has a declared tuple return type — `[S,
Dispatch<SetStateAction<S>>]` — and your hook, with an inferred return type,
gets an array whose element type is the union of the two elements. Positions
are not preserved by inference for array literals, so both destructured
bindings receive the union and calling the setter fails. The fix is to write
the tuple type down, either as a return-type annotation on the hook or with
`as const` at the return statement.

**★ Which of `as const` and a return-type annotation should an exported hook
use?**
The annotation. It makes the implementation checked against the declared
contract, so a refactor that returns the pair in the wrong order fails inside
the hook rather than in every consumer. `as const` infers the contract from
whatever the body currently does, which is exactly the property you do not want
in a public signature. `as const` earns its place inside functions, on tables
and literals whose exact types must survive.

**★ When do you return a tuple and when an object?**
Tuple for two elements the caller will always destructure and want to rename —
`[value, setValue]` — because renaming is the entire benefit and two positions
are memorable. Object for three or more members, for members consumed
selectively, and always for a discriminated union, which cannot be a tuple
because discrimination requires a property with a literal type. Three-element
tuples are the shape to avoid: they force an order on every call site and
invite the elision hole.

**★ `useLocalStorage<T>(key, fallback)` — what does the `T` actually
guarantee?**
Nothing about the stored data. The value comes out of `getItem` as `string |
null` and through `JSON.parse`, which is declared to return `any`, so `T` is an
assertion identical in strength to a cast. Any build that ever wrote that key,
any other app on the origin, and the user with devtools open are all writers to
that store. Passing a zod schema and returning `z.output<S>` converts the
assertion into a derived type with a runtime check behind it, and a stale or
corrupt mirror falls back instead of poisoning the render.

**★ Why does the schema have to be a module-level constant?**
Because it participates in a dependency array. A schema constructed inline at
the call site is a new object on every render, so the memo that parses the
stored value recomputes every render and — if the parsed value feeds another
dependency array — cascades. This is the same identity problem as any
structured dependency; the schema just looks like a type, so people forget it
is a value.

---

← Prev: [The dependency array the compiler cannot check](02b-the-dependency-array-the-compiler-cannot-check.md) ·
[Overview](README.md) ·
Next → [`useReducer` and the action union](04-usereducer-and-the-action-union.md)
