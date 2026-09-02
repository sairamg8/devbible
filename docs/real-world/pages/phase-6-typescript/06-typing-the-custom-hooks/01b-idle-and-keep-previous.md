---
title: "The idle member removes a null from every search consumer and keep-previous is a second type rather than a nullable field, because the states a hook leaves out are the ones its callers fake"
sidebar_label: "01b · idle and keep-previous"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the TypeScript handbook's
> [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html),
> the React reference for
> [`useEffect`](https://react.dev/reference/react/useEffect) (an effect runs
> after every commit whose dependencies changed), and the phase-4 JavaScript
> originals in
> [4·02](../../phase-4-react-ui/02-usedebounce-and-search.md) and
> [4·10](../../phase-4-react-ui/10-the-admin-data-table.md).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**,
> `@types/react` **19.2.18**.
> Documentation-validated; **no console blocks, no timings**.

**A four-member union with `idle` missing does not eliminate the idle state —
it pushes it into every caller as a fake.** Phase 4's search box faked it with
`Promise.resolve(null)`, and the admin table faked "still showing last page"
by leaving `data` populated during a reload. Both fakes cost the same thing: a
`null` that has to be threaded through `T` and checked at every render site.
This chunk adds the two members that make the fakes unnecessary, and states
plainly where each one is the wrong choice.

## `idle` is not decoration — it is the state the JavaScript faked

```jsx
// phase 4·02 — the fake, in JavaScript
const {status, data} = useAsync(
  (signal) => query.length >= 2
    ? api(`/products/search?q=${encodeURIComponent(query)}`, {signal})
    : Promise.resolve(null),          // ← "success" with no data
  [query],
);
```

Under [the union](01-asyncstate-as-a-union.md) that line is a type error unless
`T` is widened to `SearchResults | null` — which puts the null back on the
success branch and undoes the previous chunk. The type forces the honest shape:
**let the hook be told there is nothing to fetch.**

```ts
// apps/web/src/hooks/useAsync.ts — a null fetcher means idle
export function useAsync<T>(
  fn: ((signal: AbortSignal) => Promise<T>) | null,
  deps: DependencyList,
): UseAsync<T> { … }
```

```tsx
// apps/web/src/components/SearchBox.tsx
const state = useAsync(
  query.length >= 2
    ? (signal) => api.get('/products/search', {q: query}, signal)
    : null,                              // ← idle, and the type says so
  [query],
);
```

Now `status === 'idle'` renders the empty-state prompt, `success` always has
results, and no screen ever asks "is this a real empty response or the
short-query placeholder?".

📌 **`null` rather than an `enabled: boolean` option.** The boolean form —
`useAsync(fetcher, deps, {enabled: query.length >= 2})` — leaves the fetcher
present and typed while the hook ignores it, so nothing stops the fetcher
closing over a `query` it must not read. With the union parameter the fetcher
*does not exist* in the disabled case, which is the same argument the previous
chunk made about `data`, one level up.

## Keep-previous is a different type, not a nullable field

Phase 4·01 deliberately kept `data` across a refetch so the infinite list and
the admin table could render stale rows while loading, and listed the "flash of
old product" it causes as a gotcha. Do **not** express that by putting `data`
back on the loading member under the same name — a render site that reads
`state.data` then genuinely cannot tell fresh from stale. Give it a different
name, in a different type:

```ts
export type AsyncStateKeepingPrevious<T> =
  | {status: 'idle'}
  | {status: 'loading'; previous: T | null}
  | {status: 'error';   error: ApiFailure; previous: T | null}
  | {status: 'success'; data: T};
```

```tsx
// the admin table renders stale rows KNOWINGLY — the identifier says so
switch (state.status) {
  case 'idle':    return <TableSkeleton />;
  case 'loading': return state.previous
                    ? <DataTable rows={state.previous} dimmed />
                    : <TableSkeleton />;
  case 'error':   return state.previous
                    ? <DataTable rows={state.previous} banner={state.error} />
                    : <ErrorPanel error={state.error} onRetry={state.retry} />;
  case 'success': return <DataTable rows={state.data} />;
}
```

`previous` is `T | null` and that null is real — the first load has no
previous. The nullable field survives here precisely because the state it
belongs to genuinely has two cases, which is
[chapter 04·04's test](../04-discriminated-unions/04-where-a-union-does-not-pay.md)
for when a nullable field is the right answer.

**Two hooks, not one hook with a flag.** `useAsync` returns `AsyncState<T>` and
`useAsyncKeepingPrevious` returns `AsyncStateKeepingPrevious<T>`; a
`{keepPrevious: true}` option would have to return a union of the two return
types and every consumer would narrow twice. The screens that want stale rows
are the admin table and the infinite list — two call sites, one extra hook.

## Where keep-previous is the wrong answer

🔴 **Anything the user is about to act on.** Showing the previous product's
price under the new product's name is a stale-price bug wearing a loading
state, and the checkout total is worse. The rule that survives review: **keep
previous for lists you scroll, never for values you transact on.** The type
does not enforce that — `previous` is available in the loading branch of every
consumer — so it is a review rule, and it belongs in the same paragraph as the
type so that nobody reads the type as permission.

## The mutation state is a fourth shape, not `AsyncState<void>`

```ts
export type MutationState =
  | {status: 'idle'}
  | {status: 'running'}
  | {status: 'error'; error: ApiFailure}
  | {status: 'done'};
```

`POST /cart/items` and `PATCH /admin/orders/:id/status` have no response body
worth keeping. `AsyncState<void>` gives a `success` member with `data: void` —
legal, meaningless, and an invitation to make `T` optional so one type covers
both cases. That change puts a nullable `data` back on every read hook in the
app to serve the write hooks.

## Gotchas

**★ An idle hook still runs its effect, and its cleanup still runs.** Passing
`null` does not skip the effect — React has no way to skip one — so the effect
body must return early *and* the cleanup must be safe to call when nothing was
started. The typed body:

```ts
useEffect(() => {
  if (fn === null) { setState({status: 'idle'}); return; }
  const controller = new AbortController();
  …
  return () => controller.abort();
}, [...deps, nonce]);
```

The `return;` with no value is the branch people forget; without it the effect
falls through to `return () => controller.abort()` referencing a controller
that was never created, which is a `ReferenceError` in the temporal dead zone,
not a type error.

**★ Going back to idle must clear `previous`, and the type will not remind
you.** In the keep-previous hook, a filter change that empties the query
transitions to `{status: 'idle'}` — a member with no `previous` field — so the
stale rows vanish, which is correct. But a transition to
`{status: 'loading', previous: state.previous}` written inside the effect
captures the `previous` from the render the effect was created in, so a rapid
filter change can resurrect rows from two filters ago. Read `previous` from
the updater's argument, never from the closure:

```ts
setState((prev) => ({
  status: 'loading',
  previous: prev.status === 'success' ? prev.data
          : 'previous' in prev ? prev.previous
          : null,
}));
```

`'previous' in prev` is an `in` narrowing over the union, which the handbook
lists as a narrowing form precisely for unions whose members differ in which
properties they declare.

**★ `previous: T | null` on the error member is what makes an inline error
banner possible, and it is the member people omit.** Dropping it means a failed
refresh of the admin table blanks the table and shows a full-page error —
losing rows the user was reading because a background poll 500'd. The three
members that carry `previous` are `loading`, `error`, and nothing else;
`success` carries `data`, and `idle` carries nothing.

**★ One hook is one request.** The union describes the state of a single
in-flight fetch. A screen that loads a product *and* its reviews has two hooks
and two states, and combining them into one union member per combination turns
a four-member union into sixteen. Two `useAsync` calls, two switches, or one
derived boolean —
[01c](01c-narrowing-asyncstate-at-the-call-site.md) shows the derived-boolean
form and exactly what narrows through it.

**★ `useAsync(cond ? fetcher : null, deps)` puts a new function identity in the
argument on every render, and that is fine here and fatal one line away.** The
hook stores the fetcher in a ref and re-runs on `deps`, not on the fetcher's
identity ([chunk 02](02-generic-hooks-and-inference.md)), so a fresh arrow each
render costs nothing. Pass that same inline arrow to a `useEffect` dependency
array instead and it re-runs forever. The difference is entirely in which hook
receives it, and no type distinguishes the two.

## Interview questions

**★ What does the `idle` member buy that `loading` does not?**
It distinguishes "no request has been made" from "a request is in flight",
which the search box needs on every keystroke below the two-character
threshold. Without it the hook has to fabricate a resolved promise carrying
`null`, which forces `T` to include `null`, which puts the nullable field back
on the success branch. One extra member removes a null from every consumer of
the search hook.

**★ Why is "disabled" expressed as a `null` fetcher rather than an `enabled`
flag?**
Because a `null` fetcher makes the disabled case structurally different: there
is no function, so there is nothing to accidentally invoke and nothing closing
over state that must not be read yet. An `enabled: false` flag leaves a live,
fully-typed fetcher sitting in the argument list that the hook has promised not
to call — the same "field present but meaningless" shape the union exists to
eliminate, moved from the state to the parameters.

**★ How do you keep showing the previous page of results while the next one
loads, without weakening the union?**
With a second type whose loading and error members carry `previous: T | null` —
a *different property name* from `data`. Reusing `data` on the loading branch
would make every render site unable to tell fresh from stale, which is the
"flash of old product" bug phase 4 documented. The nullable is legitimate on
`previous` because the first load genuinely has none.

**★ When is keep-previous actively wrong?**
When the stale value is something the user acts on. A dimmed table of last
page's rows is a good loading state; last product's price under this product's
name is a mispriced purchase, and a stale checkout total is worse. The type
cannot express "safe to show stale" — `previous` is available in every loading
branch — so this is a review rule that ships next to the type, not a
constraint the compiler enforces.

**★ A mutation hook has no response body. How do you type its state?**
As its own union with no `data` member — `idle | running | error | done`. The
tempting alternative, `AsyncState<void>`, gives a `success` member with `data:
void`, which is legal, meaningless and invites someone to make `T` optional so
that `AsyncState` covers both cases. That change puts a nullable `data` back on
every read hook in the app to serve the write hooks, which is the trade the
previous chunk argues against.

**★ Why two hooks rather than one hook with a `keepPrevious` option?**
Because an option that changes the *shape* of the return value has to be typed
as an overload or a conditional return type, and either way every consumer of
the plain hook now narrows a union that includes the keep-previous members.
Two exported functions, two return types, two call sites in the whole app —
the option would cost more type machinery than the duplication it removes.

---

← Prev: [`AsyncState` as a union](01-asyncstate-as-a-union.md) ·
[Overview](README.md) ·
Next → [Narrowing `AsyncState` at the call site](01c-narrowing-asyncstate-at-the-call-site.md)
