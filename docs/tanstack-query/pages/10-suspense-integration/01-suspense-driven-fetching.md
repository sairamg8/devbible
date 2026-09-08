---
title: "Suspense Integration: `useSuspenseQuery` Trades Three Flags for Two Boundaries — and `data` Is Typed Defined"
sidebar_label: "01 · Suspense-driven fetching"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense), [Parallel Queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching) — and the React reference for [`<Suspense>`](https://react.dev/reference/react/Suspense). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

# 🔄 Suspense-Driven Fetching: What `useSuspenseQuery` Actually Removes

**Suspense mode is not a nicer `useQuery`. It is a different contract.** The hook stops returning
a loading state and starts *suspending* — and in exchange TypeScript narrows `data` to defined,
because the lines after the hook call only ever run on success. The docs put it plainly:
*"When using suspense mode, `status` states and `error` objects are not needed and are then
replaced by usage of the `React.Suspense` component."* The cost is paid elsewhere and it is real:
you lose `enabled`, you lose `placeholderData`, side-by-side calls stop being parallel, and error
propagation follows a **default predicate**, not a blanket "throw everything". This chunk covers
the mechanics and the guarantee; [01b](./01b-what-suspense-mode-removes.md) covers what the option
surface loses, [01c](./01c-errors-boundaries-and-reset.md) covers errors and resets, and
[01d](./01d-fetch-on-render-and-streaming.md) covers when the fetch actually starts.

## 1. Under-The-Hood Mechanics

There are **three** suspense hooks, not one — the guide names `useSuspenseQuery`,
`useSuspenseInfiniteQuery` and `useSuspenseQueries`. They are separate hooks rather than an option
on `useQuery`, which is the v5 shape: the v4-era `suspense: true` flag is gone, and with it the
ability to flip one query into suspense mode at runtime.

```
useQuery (regular)                          useSuspenseQuery
        │                                            │
        ▼                                            ▼
Returns { data, isLoading, isError, ... }     SUSPENDS while there is no data — React
  — the component MUST check these              unwinds to the nearest <Suspense> and
  flags before touching `data`, and              renders that boundary's fallback
  `data` is typed `T | undefined`
                                              THROWS the error — but only when the default
                                                predicate says so (see 01c); caught by the
                                                nearest Error Boundary
                                              `data` is typed `T`, not `T | undefined`
```

### The guarantee is a *type* guarantee produced by control flow

`data` is not "usually there". The lines below the hook call are **unreachable** during the
pending state, because the hook never returns during it — React unwinds the render. So the
narrowing is sound rather than optimistic, and it removes an entire class of `data?.field`
defensiveness that regular `useQuery` forces on every consumer.

The practical consequence is that a component tree using suspense hooks has **no per-component
loading UI at all**. Loading is a property of a boundary, not of a component.

### `throwOnError`: the same propagation, opted into per query

For a codebase that has not adopted the suspense hooks, `throwOnError` on a regular `useQuery`
opts that **specific** query into throwing its error to the nearest Error Boundary instead of
returning `isError`/`error`. It takes `true` or a predicate `(error, query) => boolean`, so a
codebase can send 5xx to a boundary and keep 4xx inline. 🔴 **The same option exists on the
suspense hooks and already has a non-`true` default there** — that is [01c](./01c-errors-boundaries-and-reset.md),
and it is the single most misunderstood thing on this page.

---

## 2. Real-World Engineering Scenario

**Scenario: a four-level widget tree where every level re-implemented the same three states.**
A dashboard page rendered a widget, which rendered a sub-widget, which rendered a chart — each one
calling `useQuery` and each one opening with `if (isLoading) return <Spinner/>; if (isError) return
<Error/>;`. Four spinners could be on screen at once, at four sizes, appearing in four different
orders depending on which endpoint was slowest, and every code review argued about which level
"owned" the error message.

Moving the four hooks to `useSuspenseQuery` and putting **one** `Suspense` boundary and **one**
error boundary around the page deleted twelve lines of state handling and made the loading
experience a single decision made in one file. What it did *not* do is make the page faster — the
four fetches went from parallel to sequential the moment they suspended, which is
[01b](./01b-what-suspense-mode-removes.md)'s subject and the reason this migration is usually
paired with `useSuspenseQueries` or route-level prefetching.

---

## 3. Production-Grade Code Example

The guide's own minimal form:

```tsx
import { useSuspenseQuery } from '@tanstack/react-query'

const { data } = useSuspenseQuery({ queryKey, queryFn })
```

Written out against a real endpoint, before and after:

```tsx
// BEFORE — regular useQuery: three states handled here, and `data` is Product | undefined
function ProductWidget({ productId }: { productId: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId),
  });
  if (isPending) return <Spinner />;
  if (isError) return <ErrorMessage />;
  return <ProductPricing product={data} />;
}
```

```tsx
// AFTER — useSuspenseQuery: `data` is Product. No isPending, no isError, no optional chaining.
function ProductWidget({ productId }: { productId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId),
  });
  return <ProductPricing product={data} />;
}
```

```tsx
// The boundaries the components no longer carry — declared ONCE, above the tree.
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

function ProductPage({ productId }: { productId: string }) {
  return (
    <ErrorBoundary fallbackRender={() => <ErrorPage />}>
      <Suspense fallback={<ProductPageSkeleton />}>
        <ProductWidget productId={productId} />
        <RelatedProductsWidget productId={productId} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

Partial adoption — `throwOnError` on a regular `useQuery`, so only unexpected failures leave the
component:

```tsx
function useCheckoutSummary() {
  return useQuery({
    queryKey: ['checkout', 'summary'],
    queryFn: fetchCheckoutSummary,
    // (error, query) => boolean. 5xx is a bug and belongs at a boundary;
    // "your cart is empty" is a 4xx and belongs inline, next to the cart.
    throwOnError: (error) => error instanceof HttpError && error.status >= 500,
  });
}
```

---

## Gotchas

**★ 🔴 Symptom: the page renders one spinner where you expected four, and the whole thing appears
at once.** Cause: `Suspense` shows its fallback until **every** suspended child below it has
resolved — the boundary is the unit, not the component. Fix: choose the boundary granularity
deliberately, and put a boundary around content that is genuinely allowed to arrive late rather
than around each widget reflexively:

```tsx
// The critical path settles together; the "customers also bought" rail is allowed to trail.
<Suspense fallback={<ProductSkeleton />}>
  <ProductWidget productId={id} />
  <PriceAndStock productId={id} />
</Suspense>
<Suspense fallback={<RailSkeleton />}>
  <RelatedProductsWidget productId={id} />
</Suspense>
```

**★ Symptom: a boundary per widget produces a staggered "popcorn" page that feels slower than one
spinner did.** Cause: each boundary resolves independently, so content lands at four different
moments and the layout reflows under the reader's cursor. Fix: group widgets that should appear
together under one boundary — the fix above, applied in the other direction. There is no rule that
says finer is better; the question is only *which pieces are allowed to be late*.

**★ 🔴 Symptom: you converted one component to `useSuspenseQuery` and TypeScript now complains
about the `isLoading` check you left behind.** Cause: the suspense hooks do not return the
pending-state flags, because *"`status` states and `error` objects are not needed and are then
replaced by usage of the `React.Suspense` component"*. Fix: delete the checks — they are not
merely redundant, the fields are not in the result type. A codebase that keeps them compiles only
because someone widened the type back to `any`.

**★ Symptom: the same query key is `useSuspenseQuery` in one component and `useQuery` in another,
and reviewers keep re-litigating which is right.** Cause: both work — they share one cache entry
and one in-flight request — so nothing breaks and nothing forces consistency. The real cost is
that the data's loading contract now depends on which component you happen to be reading. Fix:
pick per feature area, not per component, and encode it in a shared query-options factory so the
choice is made once:

```ts
// queries/product.ts — one definition, one contract, both call sites agree
export const productQuery = (id: string) => ({
  queryKey: ['product', id] as const,
  queryFn: () => fetchProduct(id),
});
// callers: useSuspenseQuery(productQuery(id))  — everywhere in this feature
```

**★ 🔴 Symptom: an error in a suspended component blanks the entire page rather than one widget.**
Cause: the error unwinds to the nearest **error** boundary, which is usually higher than the
nearest `Suspense` boundary, because people add `Suspense` locally and the error boundary once at
the root. Fix: pair them at the same level. `Suspense` catches suspensions only; it has never
caught errors, and an error boundary placed above three `Suspense` boundaries will replace all
three:

```tsx
<ErrorBoundary fallbackRender={() => <RailError />}>
  <Suspense fallback={<RailSkeleton />}>
    <RelatedProductsWidget productId={id} />
  </Suspense>
</ErrorBoundary>
```

**★ Symptom: `useSuspenseQuery` inside a component that is itself inside no boundary crashes the
app rather than showing a fallback.** Cause: a suspension with no `Suspense` above it is an error
in React, exactly as a thrown error with no error boundary is. Fix: the boundary is not optional
scaffolding — a component using a suspense hook is only usable inside one, so put the boundary in
the same file that owns the route, where it is hard to forget.

**★ Symptom: migrating to `useSuspenseQuery` made a page measurably slower.** Cause: the four
requests that used to overlap now run one after another — the first hook suspends before the
second one is ever called. Fix: `useSuspenseQueries`, or prefetch on the route. Fully covered in
[01b](./01b-what-suspense-mode-removes.md) and
[Parallel queries and `useQueries`](../08-dependent-and-parallel-queries/01b-parallel-queries-and-usequeries.md);
it is the most common regression this migration produces.

---

## Interview questions

**★ Why is `data` typed as defined under `useSuspenseQuery` when the network can obviously fail?**
Because the narrowing is a claim about control flow, not about the network. The hook does not
return a value during the pending state — it suspends, and React discards the partial render. The
statements after the hook call are therefore only ever reached in the success case, so typing
`data` as `T` is accurate rather than optimistic. The failure cases have not disappeared; they
have moved to the boundaries, which is exactly the trade the mode is making.

**★ What does `Suspense` catch, and what does it not?**
It handles suspensions and nothing else. Errors go to an error boundary, which is a separate
component with separate placement. This is why the docs' suspense examples always show
`react-error-boundary` alongside `Suspense` rather than instead of it, and why an app that adds
only `Suspense` turns a failed fetch into a blank screen.

**★ You have one `Suspense` boundary around six widgets. A stakeholder asks why the page takes as
long as the slowest widget. What are your options?**
Three, and they are different trade-offs. Split the boundary so fast content paints first — this
changes the *layout* contract, since the page now reflows. Prefetch on the route so the requests
start before render and the boundary resolves sooner — this changes *where* the fetch is
initiated, covered in [01d](./01d-fetch-on-render-and-streaming.md). Or move to
`useSuspenseQueries` so the six requests are at least concurrent rather than serial — this is the
one to check first, because under suspense they are probably not concurrent today.

**★ Is `throwOnError: true` on a regular `useQuery` the same thing as using `useSuspenseQuery`?**
No, and conflating them is the usual mistake. `throwOnError` moves *error* handling to a boundary
and leaves loading exactly where it was — the component still returns `isPending` and still owns
its spinner. `useSuspenseQuery` moves *both*. `throwOnError` is the honest halfway house for a
codebase that wants centralised error UI without rewriting every loading state, and it composes
with the suspense hooks rather than competing with them.

**★ Why are there three suspense hooks instead of a `suspense: true` option?**
Because the return type differs. `suspense: true` as an option could not narrow `data` — the
option's value is not visible to the type system as a discriminant at every call site, so the hook
would still have to return `T | undefined`. Separate hooks give separate signatures, and the
guaranteed-defined `data` that is the mode's main benefit falls out of that. It is also why the
mode cannot be toggled at runtime, which is what makes the missing `enabled` option in
[01b](./01b-what-suspense-mode-removes.md) unavoidable rather than an oversight.

---

← [Prefetching & SSR](../09-prefetching-and-ssr/01-server-rendered-data-flow.md) · [Topic index](../README.md) · Next → [What suspense mode removes](./01b-what-suspense-mode-removes.md)
