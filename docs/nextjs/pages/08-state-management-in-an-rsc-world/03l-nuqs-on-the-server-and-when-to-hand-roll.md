---
title: "One parser declaration imported by both a Server Component loader and a client hook is the reason to adopt nuqs at all — and it still does not validate, does not authorise, and is not worth a dependency for three parameters read in one place"
sidebar_label: "03l · nuqs on the server, and when to hand-roll"
sidebar_position: 130
description: "createLoader and createSearchParamsCache, the nuqs/server import rule, strict mode, and an honest account of what the library costs and the four cases where hand-rolling is still the right answer."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against the nuqs documentation — [Server-Side usage](https://nuqs.dev/docs/server-side),
> [Built-in parsers](https://nuqs.dev/docs/parsers/built-in), [Options](https://nuqs.dev/docs/options) and
> [Adapters](https://nuqs.dev/docs/adapters). Version confirmed from the npm registry: **`nuqs` 2.10.1** (MIT).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **zod 4.4.3**.
> Documentation-verified; **no sandbox run**.

**A library that only replaced `useSearchParams` with a nicer hook would not be worth a dependency. What makes `nuqs` worth considering in an App Router codebase is the server half: the same parser object that drives a client component's `useQueryStates` also drives a Server Component's loader, so the URL format has exactly one definition and cannot drift between the page that queries the database and the component that renders the filter. This page is that half, plus the part most write-ups skip — what it costs, and the four situations where the honest answer is still thirty lines of your own code.**

## The server side: one declaration, both runtimes

```ts filename="app/[tenant]/board/search-params.ts"
// import from 'nuqs/server' — no 'use client' directive
import {
  createLoader,
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
} from 'nuqs/server'

export const boardParsers = {
  q: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
}

export const loadBoardParams = createLoader(boardParsers)
export const boardParamsCache = createSearchParamsCache(boardParsers)
```

```tsx filename="app/[tenant]/board/page.tsx"
import type { SearchParams } from 'nuqs/server'
import { loadBoardParams } from './search-params'

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, page } = await loadBoardParams(searchParams)
  return <Board q={q} page={page} />
}
```

```tsx filename="app/[tenant]/board/board-filters.tsx"
'use client'

import { useQueryStates } from 'nuqs'
import { boardParsers } from './search-params'   // the same object

export function BoardFilters() {
  const [{ q, page }, setBoard] = useQueryStates(boardParsers)
  return <FilterUI q={q} page={page} onChange={setBoard} />
}
```

> *"To parse search params server-side, you can use a *loader* function. You create one using the `createLoader` function, by passing it your search params descriptor object"*
> — [nuqs, Loaders](https://nuqs.dev/docs/server-side#loaders)

> *"Here, `loadSearchParams` is a function that parses search params and returns state variables to be consumed server-side (the same state type that `useQueryStates` returns)."*
> — same section

A loader accepts a wide range of inputs, which is why the same declaration also works in a Route Handler or a `middleware`-adjacent utility: a full URL string, a bare `?foo=bar` string, a `URL`, a `URLSearchParams`, a `Request`, a plain record, *"or a `Promise` of any of the above, in which case it also returns a Promise"*.

### It composes with the static-shell rule

The docs' own note on the App Router example is the same advice [03b](03b-url-as-state-and-the-static-shell.md) argued for from first principles:

> *"Pro tip: you don't *have* to await the result. Pass the Promise object to children components wrapped in `<Suspense>` to benefit from PPR / dynamicIO and serve a static outer shell immediately, while streaming in the dynamic parts that depend on the search params when they become available."*
> — [nuqs, Next.js (app router)](https://nuqs.dev/docs/server-side#nextjs-app-router)

```tsx filename="app/[tenant]/board/page.tsx"
import { Suspense } from 'react'
import { loadBoardParams } from './search-params'

export default function Page(props: { searchParams: Promise<SearchParams> }) {
  const params = loadBoardParams(props.searchParams)   // a promise, not awaited
  return (
    <>
      <BoardHeader />
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskList params={params} />
      </Suspense>
    </>
  )
}
```

## `createSearchParamsCache` — Context for the RSC tree

This solves the prop-drilling problem a deep Server Component tree creates: a component five levels down needs the query and every ancestor would otherwise have to forward it.

```ts filename="app/[tenant]/board/search-params.ts"
export const boardParamsCache = createSearchParamsCache(boardParsers)
```

```tsx filename="app/[tenant]/board/page.tsx"
import { Suspense } from 'react'
import { boardParamsCache } from './search-params'

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // ⚠️ Don't forget to call `parse` here.
  await boardParamsCache.parse(searchParams)
  return (
    <>
      <ServerSummary />
      <Suspense><ClientFilters /></Suspense>
    </>
  )
}
```

```tsx filename="app/[tenant]/board/server-summary.tsx"
import { boardParamsCache } from './search-params'

export function ServerSummary() {
  const { q, page } = boardParamsCache.all()      // no props, no drilling
  return <p>Showing page {page} for “{q}”</p>
}
```

> *"If you wish to access the searchParams in a deeply nested Server Component (ie: not in the Page component), you can use `createSearchParamsCache` to do so in a type-safe manner. Think of it as a loader combined with a way to propagate the parsed values down the RSC tree, like Context would on the client."*
> — [nuqs, Cache](https://nuqs.dev/docs/server-side#cache)

> *"The cache will only be valid for the current page render (see React's `cache` function)."*
> — same section

Three constraints, all stated by the docs and all easy to trip over:

- **App Router only.** *"Available since `nuqs@1.13.0`. Supported only in Next.js (app router)."*
- **Server Components only.** *"the cache only works for **server components**, but you may share your parser declaration with `useQueryStates` for type-safety in client components"*.
- **The page must `parse` first**, before any descendant calls `.get()` or `.all()`.

The request scoping is what makes it safe: it is built on React's `cache`, so it is per-render, and it cannot leak one user's query into another's request. That is the same property the [04d](04d-zustand-in-an-rsc-app.md) discussion of module-level stores is about, arrived at from the opposite direction.

## 🔴 The import rule

> *"For shared code that may be imported in the Next.js app router, you should import parsers from `nuqs/server` to use them in both server & client code, as it doesn't include the `'use client'` directive."*
> *"Importing from `nuqs` will only work in client code, and will throw bundling errors when using functions (like `.withDefault` & `.withOptions`) across shared code."*
> — [nuqs, Using parsers server-side](https://nuqs.dev/docs/parsers/built-in#using-parsers-server-side)

The shared `search-params.ts` module is by definition shared code, so it always imports from `nuqs/server`. The client component then imports `useQueryStates` from `nuqs` and the *parsers* from the shared module.

## Strict mode: when a bad value should be loud

```ts
const loadSearchParams = createLoader({ count: parseAsInteger.withDefault(0) })

loadSearchParams('?count=banana')                   // -> { count: 0 }
loadSearchParams('?count=banana', { strict: true }) // throws
```

> *"If a search param contains an invalid value for the associated parser (eg: `?count=banana` for `parseAsInteger`), the default behaviour is to return the default value if specified, or `null` otherwise. You can turn on **strict mode** to instead throw an error on invalid values when running the loader"*
> — [nuqs, Strict mode](https://nuqs.dev/docs/server-side#strict-mode) *(available since `nuqs@2.5.0`)*

Strict mode inverts the repair/reject rule from [03j](03j-url-as-state-validating-and-canonical-urls.md), so use it where a bad value means a bug rather than a mis-click: an internal report link, a machine-generated URL, a webhook callback. On a user-facing filter, silent defaulting is the better behaviour.

## What it costs

An honest list, because "add the library" is not free:

- **A dependency on the critical rendering path** of every filtered page, plus a provider at the root of the app.
- **A second vocabulary layered over the router's.** `history`, `shallow` and `scroll` are nuqs concepts that *map onto* — but are not — `router.replace`, `pushState` and `{ scroll: false }`. A team debugging a navigation now has two models to hold.
- **A precedence rule to remember:** *"The order of precedence is: call-level options > parser options > global options."* Three places an option can be set is three places to look when one is wrong.
- **No validation.** Parsers coerce and fall back; they do not bound a string's length, do not enforce a range beyond what a parser implies, and do not authorise anything. [03j](03j-url-as-state-validating-and-canonical-urls.md) applies in full, unchanged.
- **Version-sensitive behaviour.** `clearOnDefault` flipped default between v1 and v2, and `startTransition` stopped implying `shallow: false` in v2. An upgrade changes runtime behaviour silently.

## When hand-rolling is still right

- **Two or three parameters, read in one place.** The zod module in [03j](03j-url-as-state-validating-and-canonical-urls.md) is already the single shared definition the library would sell you, and it is thirty lines.
- **Every write is a `<Link>` or a `next/form`.** Declarative writers need no hook at all, and they are what most filter bars should be for prefetching and progressive-enhancement reasons ([03f](03f-url-as-state-writing-declaratively.md)).
- **The parameters are consumed on the server only.** A `page.tsx` awaiting `searchParams` plus a schema is the whole feature; there is no client state to synchronise.
- **You cannot take the dependency** — and the throttle policy is documented well enough to reimplement, which it is: 50 ms generally, 120 ms for Safari, 320 ms for older Safari.

**Reach for it when:** several client components write the same parameters; a control is continuous (text input, slider, date-range drag) so throttling and batching stop being optional; the same parameters must be parsed identically on both runtimes; or you have already written the parse twice and they have drifted once.

## Gotchas

**★ Symptom: `Module not found` or a bundling error in a file imported by both a page and a client component.** Cause: parsers imported from `nuqs`, which carries the `'use client'` directive. Fix: import from `nuqs/server` in any shared module.

```ts
import { parseAsString, createLoader } from 'nuqs/server'   // ✅ shared code
```

**★ Symptom: a nested Server Component's `cache.get()` returns the default for everything.** Cause: the page never called `.parse(searchParams)`, so the request-scoped cache was never filled. Fix: parse in the page, before rendering descendants.

```tsx
await boardParamsCache.parse(searchParams)
return <><ServerSummary /><Suspense><ClientFilters /></Suspense></>
```

**★ Symptom: `?count=banana` silently becomes `0` on an internal report link and nobody notices the URL was wrong.** Cause: the documented default is to return the default value on an invalid parse. Fix: strict mode for machine-generated URLs.

```ts
loadSearchParams(searchParams, { strict: true })
```

**★ Symptom: `boardParamsCache.get()` throws or returns stale data in a Client Component.** Cause: the cache is Server-Component-only and request-scoped; there is nothing for it to read on the client. Fix: share the *parsers*, not the cache.

```tsx
'use client'
import { useQueryStates } from 'nuqs'
import { boardParsers } from './search-params'   // ✅ the declaration, not the cache
const [{ q, page }] = useQueryStates(boardParsers)
```

**★ Symptom: awaiting the loader at the top of the page collapsed the static shell.** Cause: the loader returns a promise for a promise input, and awaiting it in the page component suspends the page — the same mechanism as awaiting `searchParams` directly ([03b](03b-url-as-state-and-the-static-shell.md)). Fix: pass the un-awaited promise into a child behind `Suspense`.

```tsx
const params = loadBoardParams(props.searchParams)   // not awaited
<Suspense fallback={<Skeleton />}><TaskList params={params} /></Suspense>
```

**★ Symptom: an option set on the parser is ignored at one call site.** Cause: precedence — a call-level option overrides the parser's, which overrides the adapter's global default. Fix: read all three places before concluding the library is wrong, and prefer setting an option in exactly one of them per parameter.

```ts
setCoordinates({ lat: 42 }, { shallow: false })   // call-level wins over the parser
```

**★ Symptom: the whole app became a client bundle after adding the adapter.** Cause: the provider was given an imported component tree rather than `{children}`, so everything it renders joined the client module graph. Fix: the `children` slot.

```tsx
<body><NuqsAdapter>{children}</NuqsAdapter></body>
```

**★ Symptom: a shared parsers module works in the App Router and breaks in a Route Handler.** Cause: nothing to do with nuqs — the handler was passing `request.nextUrl.searchParams` where a loader expected something else. Fix: loaders accept a `Request` directly.

```ts
export async function GET(request: Request) {
  const { q, page } = loadBoardParams(request)
  return Response.json(await search(q, page))
}
```

## Interview questions

**★ What does `nuqs` give an App Router codebase that a client-only URL-state hook does not?**
One declaration for two runtimes. The parser object is imported by the client component's `useQueryStates` and by the server's `createLoader` or `createSearchParamsCache`, so the coercion, the defaults, the array encoding and the inferred type are literally the same code on both sides. That is the drift this chapter keeps warning about — the server destructures a repeated key into an array while the client's `.get()` takes the first value, the page defaults `status` to `open` while the filter bar defaults it to `all` — reduced to a single definition. Everything else the library does is convenience; this is the architectural argument.

**★ Does `nuqs` remove the need to validate search params?**
No, and its own documentation says so: loaders do not validate, and if you expect positive integers or a particular object shape you must feed the result into a schema library. What the parsers do is *coerce and fall back* — an invalid value yields the default, which is the right ergonomics but is not a bound, not a range check and certainly not an authorisation. A 40 kB free-text `q` parses perfectly as a string. The parser layer replaces the normalising helpers, not the schema, and nothing in any library replaces checking a tenant id against the session.

**★ What is `createSearchParamsCache` for, and what is its lifetime?**
It solves prop-drilling for Server Components: a deeply nested server component needs the parsed query without every intermediate component forwarding a promise. The page calls `.parse(searchParams)` once, and descendants call `.get(key)` or `.all()`. The lifetime is a single page render — it is built on React's `cache`, so it is request-scoped and cannot leak between requests, which is the property that makes a shared read safe on a server handling concurrent users. Two limits: it is App Router only, and Server Components only, so a client component in the same tree uses `useQueryStates` with the shared parser object instead.

**★ Why must shared parser modules import from `nuqs/server`?**
Because the main `nuqs` entry point carries the `'use client'` directive, which makes any module importing it part of the client module graph. A `search-params.ts` shared by a Server Component page and a client filter bar would therefore drag the page into the client boundary, or fail to bundle when the builder-pattern functions like `.withDefault` and `.withOptions` are called across the boundary. `nuqs/server` exports the same parsers without the directive. The rule is mechanical: the shared declaration module imports from `nuqs/server`; the client component imports its hook from `nuqs` and its parsers from the shared module.

**★ When would you not use it?**
When the filter bar is `<Link>` chips and a `next/form` search box — declarative writers need no hook, and they are what most filter UIs should be for prefetching and progressive-enhancement reasons anyway. When there are two or three parameters read in one place, where a thirty-line zod module is already the single shared definition. When the parameters are consumed only on the server. The library earns its cost when several client components write the same parameters, when a control is continuous enough that throttling and batching stop being optional, or when the parse already exists twice and has drifted once. "We might need it later" is not one of those cases.

**★ When would you turn on strict mode?**
When an invalid value means a bug rather than a mis-click. A user-facing filter should degrade — a mangled `page` falls back to 1 and the board still renders — because the URL may have been hand-edited, truncated by a chat client or produced by an older deploy. A machine-generated URL is different: an internal report link, a scheduled export, a webhook callback. There, silently defaulting hides the fault and produces a plausible but wrong artefact, so throwing is the behaviour you want. It is the same repair-versus-reject judgement as hand-written validation, exposed as a flag.

---

← [03k · nuqs — search params as a library](03k-nuqs-typed-search-params-as-a-library.md) · [Chapter 8 overview](01-explanation.md) · Next → [04 · Client state tools compared](04-client-state-tools-compared-react-context-zustand-jotai.md)
