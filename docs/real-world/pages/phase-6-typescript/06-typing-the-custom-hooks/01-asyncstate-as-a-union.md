---
title: "AsyncState is a union whose success branch is the only one carrying data, so the component narrows once instead of null-checking three times"
sidebar_label: "01 · AsyncState as a union"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the TypeScript handbook's
> [narrowing / discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
> and
> [distributive conditional types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html);
> the React reference for
> [`useState`](https://react.dev/reference/react/useState).
> Target: **TypeScript 7.0.2** (phase spine; TypeScript is not installed in
> this checkout), React **19.2.8**, `@types/react` **19.2.18**.
> Documentation-validated; **no console blocks, no timings**.

**[Chapter 04 named this type and left it unbuilt](../04-discriminated-unions/README.md);
this is it.** The JavaScript `useAsync` in
[phase 4·01](../../phase-4-react-ui/01-useasync-and-the-api-client.md) holds
`{status, data, error}` — three fields that are all present all the time and
two of which are `null` in every state but one. Typed literally that is a
four-field object describing eight combinations of which four are impossible,
and every render site pays for it with a null check the compiler cannot verify.
Typed as a union it is four members, `data` appears on exactly one of them, and
the component that reads `data` without asking `status` first does not compile.

## The literal translation, and why it is the bug

```ts
// what a mechanical port of the JavaScript produces
export interface AsyncState<T> {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: T | null;
  error: ApiFailure | null;
}
```

Everything about that type is *true* and none of it is *useful*. It admits
`{status: 'success', data: null, error: someError}`. It forces
`if (data !== null)` inside a branch the developer already knows is the success
branch. And the null check is not even a real check — it is a check for a
condition the hook's contract already excludes, so it is dead code the reviewer
has to reason about anyway. This is
[chapter 04·01's impossible-states argument](../04-discriminated-unions/01-impossible-states-and-the-schema.md)
in the client: **a field that is null in three of four states is a field that
belongs to the fourth state.**

## The union

```ts
// apps/web/src/hooks/useAsync.ts
import type {ApiFailure} from '@storefront/shared';   // chapter 07's error type

export type AsyncState<T> =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'error';   error: ApiFailure}
  | {status: 'success'; data: T};
```

Four members, one discriminant, and no member declares a field it does not
own. `data` is not optional on the other three — it is **absent**, which is
what makes `state.data` outside a `status === 'success'` branch a compile
error rather than a value that might be `null`.

The hook also returns `retry`, and the naive way to add it is
`AsyncState<T> & {retry: () => void}`. Write the distribution explicitly
instead, so the union structure is visible in the declaration rather than
resting on how the checker normalises an intersection over a union:

```ts
type WithRetry<S> = S extends unknown ? S & {retry: () => void} : never;
export type UseAsync<T> = WithRetry<AsyncState<T>>;
//  { status:'idle';    retry(): void }
// | { status:'loading'; retry(): void }
// | { status:'error';   error: ApiFailure; retry(): void }
// | { status:'success'; data: T;           retry(): void }
```

`S extends unknown ? … : never` is a **distributive conditional type**, and
the handbook states the rule the trick relies on:

> *"When conditional types act on a generic type, they become distributive
> when given a union type."*

Every member is `unknown`-assignable, so nothing is filtered; the only effect
is that the conditional distributes over the union and the intersection lands
on each member individually.
[Chapter 08·05](../08-utility-types-in-app-code/05-exclude-extract-and-distributivity.md)
owns this mechanism in full, including how to switch it *off*.

## The component narrows, and cannot forget

```tsx
// apps/web/src/routes/ProductPage.tsx
import {assertNever} from '@storefront/shared';

export function ProductPage({slug}: {slug: string}) {
  const state = useAsync((signal) => api.get('/products/:slug', {slug}, signal), [slug]);

  switch (state.status) {
    case 'idle':
    case 'loading': return <ProductSkeleton />;
    case 'error':   return <ErrorPanel error={state.error} onRetry={state.retry} />;
    case 'success': return <ProductDetail product={state.data} />;
  }
  return assertNever(state, 'ProductPage');
}
```

`state.error` is reachable only in the `error` case, `state.data` only in
`success`, and — as
[chapter 04·03](../04-discriminated-unions/03-exhaustiveness-in-the-ui-and-on-the-wire.md)
argues at length — there is **no `default:` clause**, so adding a
`'refetching'` member to `AsyncState` makes `assertNever` fail to compile here
and at every other consumer. That is the whole payoff, and one `default:`
deletes it.

Two chunks follow this one on the same type:
[01b](01b-idle-and-keep-previous.md) builds the two members teams leave out —
`idle`, and the keep-previous variant — and
[01c](01c-narrowing-asyncstate-at-the-call-site.md) is the narrowing itself,
where it holds, where it is lost, and the destructuring that does not compile.

## Gotchas

**★ `useState({status: 'loading', data: null, error: null})` infers
`status: string`, and the union is gone before it starts.** Object literals
widen: the property type is `string`, not `'loading'`, so every later
`setState({status: 'succes', …})` typos its way through. The initial state
must be annotated at the `useState` call, which is where the union enters the
hook:

```ts
const [state, setState] = useState<AsyncState<T>>({status: 'idle'});
```

**★ A `default:` clause in the render switch silently deletes the phase
gate.** Same mechanism as
[chapter 04·03](../04-discriminated-unions/03-exhaustiveness-in-the-ui-and-on-the-wire.md):
inside `default:` the state is already `never`, `assertNever` still compiles,
and a new member renders whatever the default returns. The hook's union has
four members and every screen switches on it, so this one is copied into
dozens of files by whoever adds the default "for safety".

**★ `retry` on the `idle` member is a button that refetches nothing.** The
distribution puts `retry` on all four states, which is convenient and slightly
wrong — `retry` in the idle state bumps the effect's nonce and the effect still
sees a `null` fetcher. It is harmless, and the alternative (only `error` and
`success` carry `retry`) makes `const {retry} = state` fail everywhere. Keep
it on all four and know that idle-retry is a no-op.

**★ `error: ApiFailure` and not `error: Error`.** A `catch` binding is
`unknown` (the API client's job to classify —
[chapter 07·04](../07-the-typed-api-client/04-errors-as-a-result.md)), and
typing the member as `Error` is a claim the hook cannot back: `throw 'nope'`
from a transform, or a rejected promise carrying a string, both defeat it.
Declare the member as the classified failure type the client produces and make
the classification the client's problem, where the `unknown` actually arrives.
[Chunk 06](06-effects-cleanup-and-abort.md) shows the narrowing at the catch.

**★ `status` must be a literal type on every member or the union is not
discriminated.** `{status: string; data: T}` as one member turns the whole
thing into a union TypeScript cannot narrow by `status`, and the failure is
quiet — the switch still compiles, the cases just never narrow. If a member's
discriminant comes from a variable it needs `as const` or an annotation; the
mechanism is
[chapter 02·05's](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md)
`const` type parameter argument in a different costume.

**★ Two members with the same discriminant value are legal and merge into
nonsense.** Nothing stops `{status: 'error'; error: ApiFailure}` and
`{status: 'error'; message: string}` both appearing in the union; narrowing to
`'error'` then yields the union of *those two*, and neither `error` nor
`message` is accessible without a further check. If two failures genuinely
differ, they need two discriminant values — `'error'` and `'timeout'` — not two
shapes under one label.

## Interview questions

**★ Why is a discriminated union better here than `{status, data: T | null,
error: Error | null}`?**
Because the second type says four states exist and eight combinations are
representable, and the type system then requires a null check in every branch —
including the branches where the check can never fail. The union puts each
field on the state that owns it: `data` exists only under `status: 'success'`,
so the check *is* the narrowing, the compiler proves the access is safe, and
adding a state breaks every consumer that has not handled it. The nullable
version adds a state and breaks nothing until run time.

**★ Why `WithRetry<S> = S extends unknown ? S & {…} : never` rather than
`AsyncState<T> & {retry: () => void}`?**
Because the distributive conditional says out loud what the intersection would
only imply: the result is a union of four members, each with `retry`, and
`status` remains a discriminant of that union. It is self-documenting for the
next reader, and it makes the declaration independent of how the checker
normalises intersections whose operand is a union. The cost is one extra type
alias.

**★ The hook returns `retry` on all four members including `idle`. Is that a
type error waiting to happen?**
No — it is a deliberate ergonomic. `retry` in the idle state bumps the effect's
nonce and the effect sees a `null` fetcher, so nothing happens. Restricting
`retry` to the `error` and `success` members would be more precise and would
break `const {retry} = state` at every call site, which is the line every
consumer writes. Precision that costs every consumer a narrowing is precision
in the wrong place.

**★ What actually breaks if a union member declares `status: string`?**
Discrimination. TypeScript narrows a union by comparing a discriminant
property whose type is a literal (or a union of literals) in each member; a
member typed `string` overlaps every case, so no `case` can eliminate it and
the narrowed type in each branch still includes it. The switch compiles, the
property accesses inside it fail, and the diagnosis is confusing because the
union *looks* right. It usually enters through an un-asserted object literal or
a value read from `JSON.parse`.

---

← [Overview](README.md) ·
Next → [`idle` and keep-previous: the two members teams leave out](01b-idle-and-keep-previous.md)
