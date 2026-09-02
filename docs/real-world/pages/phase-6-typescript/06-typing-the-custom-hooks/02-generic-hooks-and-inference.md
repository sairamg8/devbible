---
title: "A hook's type parameter must be inferred from one of its arguments, because an explicit type argument is an assertion with no more evidence behind it than a cast"
sidebar_label: "02 · Generic hooks and inference"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo (`useMemo`, `useCallback`, `DependencyList`), the TypeScript
> handbook on
> [generic functions and inference](https://www.typescriptlang.org/docs/handbook/2/generics.html),
> the TypeScript **5.4** release note introducing
> [`NoInfer`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html)
> (`type NoInfer<T> = intrinsic;` in `lib.es5.d.ts`, read from
> `typescript@6.0.3` — TypeScript is not installed in this checkout), and
> `json(): Promise<any>` in that same package's `lib.dom.d.ts`.
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**`useAsync<T>` has exactly one honest source for `T`: the return type of the
function it is handed.** Every other source — an explicit type argument, a
default, a cast inside the hook — is an assertion, and it is the same assertion
[chapter 03 spent a chunk on](../03-typing-raw-pg-results/01-the-generic-is-an-assertion.md)
for `pool.query<Row>()`. This chunk is where each of the app's hooks gets its
type parameter from, which of those sources are checked, and the one call
shape where writing the type argument yourself is the right answer.
[The next chunk](02b-the-dependency-array-the-compiler-cannot-check.md) takes
the half of the signature no type can help with: `deps`.

## Where `T` comes from

```ts
// apps/web/src/hooks/useAsync.ts
import type {DependencyList} from 'react';

export function useAsync<T>(
  fn: ((signal: AbortSignal) => Promise<T>) | null,
  deps: DependencyList,
): UseAsync<T> { … }
```

`T` appears in the parameter list, inside `Promise<T>`, in the return position
of a function type. That is the whole mechanism: infer `T` from the fetcher's
resolved type, and the call site writes no type argument at all.

```ts
const state = useAsync((s) => api.get('/products/:slug', {slug}, s), [slug]);
//    ^ UseAsync<Product>   — because api.get resolves to Product
```

📌 **A type parameter that appears only in the return type is not inference,
it is a request for an assertion.** `function useThing<T>(): AsyncState<T>`
compiles, and every call site picks `T` out of the air.
[Chapter 03·01](../03-typing-raw-pg-results/01-the-generic-is-an-assertion.md)
made this case for `pg`; the rule generalises: **if `T` cannot be recovered
from an argument, the function is casting on the caller's behalf.**

## The table for this app's hooks

| Hook | Where its type parameter comes from | Is it checked? |
|---|---|---|
| `useAsync<T>` | the fetcher's `Promise<T>` | Only as far as the client's return type is honest — [chapter 07](../07-the-typed-api-client/README.md) is what makes it honest |
| `useDebounce<T>` | the `value` argument | Yes, fully — `T` is whatever was passed in |
| `useLocalStorage<T>` | the `fallback` argument | **No** — the stored string is `JSON.parse`d, and the `T` is an assertion ([chunk 03](03-tuple-or-object-returns.md)) |
| `useForm<S extends z.ZodType>` | the schema, via `z.input<S>` and `z.output<S>` | Yes — the schema is a runtime value that validates |
| `useCart()` | not generic; the context's `T` is fixed at `createContext` | Yes ([chunk 07](07-context-without-undefined.md)) |
| `useReducer` | the reducer function's parameter and return types | Yes ([chunk 04](04-usereducer-and-the-action-union.md)) |

The two rows worth staring at are the two that say the inference is only as
good as its source. **Inference does not create truth; it propagates whatever
the argument claimed.**

## 🔴 The explicit type argument, and what it silently does

```ts
// the shape this takes in a real codebase
const state = useAsync<Product>(async (s) => {
  const res = await fetch(`/api/products/${slug}`, {signal: s});
  return res.json();          // Promise<any> — see chapter 07·01
}, [slug]);
```

`res.json()` is declared `json(): Promise<any>` in `lib.dom.d.ts`, so inference
would give `T = any`. Writing `<Product>` does not check anything: it replaces
an `any` with a `Product` and every downstream `state.data.price_cents` is
now a lie the compiler will defend. The hook is not at fault and cannot be
fixed from inside — **the fix is a parse at the boundary**, which is
[chapter 07·02](../07-the-typed-api-client/02-parsing-the-response.md):

```ts
const state = useAsync(async (s) => {
  const res = await fetch(`/api/products/${slug}`, {signal: s});
  return ProductSchema.parse(await res.json());   // T inferred: Product, and CHECKED
}, [slug]);
```

Same call site, one word different, and the difference is whether `T` is
evidence or decoration.

## `NoInfer` for the parameter that must not vote

Add a placeholder option to the hook and inference suddenly has two candidates:

```ts
export function useAsync<T>(
  fn: ((signal: AbortSignal) => Promise<T>) | null,
  deps: DependencyList,
  options?: {placeholder?: T},
): UseAsync<T>
```

Pass `{placeholder: []}` alongside a fetcher resolving to `Product[]` and `T`
is inferred from both sites; a mismatch produces an error blaming the wrong
argument, or a union nobody asked for. TypeScript 5.4's `NoInfer` removes the
second vote — the release note describes it exactly:

> *"Surrounding a type in `NoInfer<...>` gives a signal to TypeScript not to
> dig in and match against the inner types to find candidates for type
> inference."*

```ts
  options?: {placeholder?: NoInfer<T>},
```

Now `T` comes from the fetcher and the placeholder is *checked against* it.
The declaration itself is `type NoInfer<T> = intrinsic;` — a compiler
primitive, not a type-level trick you could have written yourself.

## Gotchas

**★ `useAsync(null, [])` infers `T = unknown`, and every consumer of that state
gets `unknown` data.** With no fetcher there is nothing to infer from. In the
search box the ternary saves you — `cond ? fetcher : null` has type
`((s: AbortSignal) => Promise<SearchResults>) | null` and inference finds
`SearchResults` in the union — but a component that starts idle and only ever
gets a fetcher later needs the type argument written out:

```ts
const state = useAsync<SearchResults>(enabled ? fetcher : null, [query]);
```

This is the one place an explicit type argument on `useAsync` is legitimate,
because there is no argument to infer from — and it is still an assertion, so
the fetcher assigned later is what has to be honest.

**★ 🔴 An explicit type argument is an assertion, and it looks exactly like
documentation.** `useAsync<Order>(fetcher, [id])` reads as "this fetches an
order" and *behaves* as "trust me". If the fetcher's return type is `any`,
`unknown`-widened, or simply wrong, nothing complains. Grep for `useAsync<` in
review: every hit is either the idle case above or a bug waiting for a schema
change.

**★ An `async` fetcher that can return `null` puts the null straight back into
`T`.** `async (s) => (res.status === 404 ? null : ProductSchema.parse(…))`
infers `T = Product | null`, and now `state.data` is nullable in the success
branch — the exact shape [chunk 01](01-asyncstate-as-a-union.md) removed. A 404
is not a successful fetch with no data; it is a failure with a code, and the
client returns a failure result for it
([chapter 07·04](../07-the-typed-api-client/04-errors-as-a-result.md)).

**★ Annotate an exported hook's return type; do not let it be inferred.**
Without `: UseAsync<T>` the return type is whatever the implementation happens
to produce — usually correct, occasionally a widened `{status: string; …}`
because one `setState` call passed an un-asserted literal, and always liable to
change silently when the body is refactored. The annotation makes the
implementation checked *against* the contract instead of *defining* it, which
is the same argument
[chapter 02·04](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md)
makes for mappers.

**★ `useMemo`'s explicit type argument is checked and `useAsync`'s is not, and
the difference is not stylistic.** `useMemo<T>(factory: () => T, deps)` puts
`T` in the factory's return position, so `useMemo<Product[]>(() =>
rows.map(toSummary), [rows])` fails to compile — there is something to compare
the annotation against. `useAsync<Product>(fetcherReturningAny, deps)` has an
`any` on the other side, and `any` is assignable to everything. The lesson is
not "explicit type arguments are bad" but **"an explicit type argument is only
as strong as what the compiler can compare it against."**

**★ `T` inferred from a fetcher that returns a `Response` is a common
mis-wiring.** `useAsync((s) => fetch(url, {signal: s}), [url])` infers
`T = Response`, compiles, and hands every consumer a `Response` where it
expected a product — because the fetcher forgot to `await res.json()`.
Inference protects you from mismatches, never from calling the wrong function.

**★ A default type parameter hides the same assertion behind a nicer face.**
`function useAsync<T = unknown>(…)` looks defensive and means every call that
fails to infer silently produces `unknown` instead of an error — which is
better than `any` and worse than a diagnostic. `<T = any>` is strictly worse
than both. Leave the parameter undefaulted so a call that cannot infer is a
call that does not compile.

## Interview questions

**★ Where does `T` come from in `useAsync<T>`, and why does that matter?**
From the fetcher's return type — `T` appears inside `Promise<T>` in the
parameter list, so it is recovered from the argument rather than supplied by
the caller. That matters because a type parameter that appears only in the
return type cannot be inferred, so every call site would have to write it, and
every written type argument is an unchecked assertion about data the hook never
inspects. Inference makes the type follow the data; an explicit argument makes
the data follow the type, which is the direction that produces run-time
surprises.

**★ Why is `useAsync<Product>(fetcher, deps)` dangerous when `fetcher` returns
`res.json()`?**
Because `Response.json()` is declared `Promise<any>`. Inference would give
`T = any`, which at least tells the truth; the explicit `<Product>` converts
that `any` into a `Product` with nothing checked, and the compiler will then
defend every field access against a value that may be a 404 error body. The
only fix is a runtime parse at the boundary, which is what the typed API client
exists to provide.

**★ Is there any call where writing the type argument yourself is correct?**
Yes — the permanently-or-initially idle call, `useAsync<SearchResults>(null,
deps)`. There is no fetcher, so there is nothing to infer from, and `unknown`
would propagate into every consumer. It remains an assertion; what makes it
acceptable is that the fetcher which eventually replaces the `null` is checked
against the same `T`, so the assertion is verified the moment the hook does
anything.

**★ What is `NoInfer<T>` for, in a hook signature?**
For a parameter that should be *checked against* `T` rather than *contribute
to* it. A `placeholder?: T` option votes in inference alongside the fetcher, so
a placeholder of the wrong type produces a confusing union or an error blaming
the wrong argument; `placeholder?: NoInfer<T>` makes the fetcher the only
source of `T` and turns the placeholder into an ordinary assignability check.
It is a compiler intrinsic — `type NoInfer<T> = intrinsic;` — introduced in
TypeScript 5.4.

**★ Why annotate an exported hook's return type instead of letting TypeScript
infer it?**
Because inference makes the implementation the contract. Any refactor of the
body silently changes the public type, and a single un-asserted object literal
inside a `setState` call can widen the discriminant to `string` and destroy
narrowing at every call site — with the error, if any, appearing in the
consumers rather than in the hook. With the annotation, the implementation is
checked against the declared union and the failure lands on the line that broke
it.

**★ Why not give `T` a default of `unknown`?**
Because the default converts "this call cannot infer its type" from a
compile error into a silently `unknown`-typed state that every consumer then
has to narrow or assert away. The diagnostic is the valuable thing: a call
site that cannot infer `T` is a call site whose fetcher is untyped, and you
want to be told about it at the hook, not three components later.

---

← Prev: [Narrowing `AsyncState` at the call site](01c-narrowing-asyncstate-at-the-call-site.md) ·
[Overview](README.md) ·
Next → [The dependency array the compiler cannot check](02b-the-dependency-array-the-compiler-cannot-check.md)
