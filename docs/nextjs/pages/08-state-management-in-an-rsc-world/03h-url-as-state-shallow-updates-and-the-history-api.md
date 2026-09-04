---
title: "The App Router has no shallow option because it refuses to conflate two decisions — window.history.pushState changes the URL and notifies the client hooks while no Server Component re-renders, and that is the whole feature"
sidebar_label: "03h · Shallow updates and the History API"
sidebar_position: 18
description: "Why router.push has no shallow flag, what window.history.pushState and replaceState integrate with, when a shallow URL update is the right answer and when it silently freezes your list, and how back/forward behaves across the two kinds of write."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) (`lastUpdated: 2026-08-25`),
> [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) (`lastUpdated: 2026-07-01`) and
> [nuqs — Options](https://nuqs.dev/docs/options) (`nuqs` **2.10.1**).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**Every Pages Router codebase has a `router.push(url, undefined, { shallow: true })` somewhere, and porting it is where a migration quietly loses a behaviour. The App Router has no `shallow` option — `router.push` and `router.replace` take `{ scroll, transitionTypes }` and nothing else. What replaces it is a documented integration with the native History API: `window.history.pushState` and `replaceState` change the URL, `usePathname` and `useSearchParams` observe the change, and **no Server Component re-renders**. That is not a smaller version of navigation; it is a different decision, and the framework separated it on purpose.**

## The two decisions the Pages Router combined

A URL write is really two questions, and `shallow: true` answered both with one flag:

| Question | `<Link>` / `router.push` | `window.history.pushState` |
|---|---|---|
| Should the address bar change? | ✅ | ✅ |
| Should `usePathname` / `useSearchParams` see it? | ✅ | ✅ |
| Should the server re-render this route? | ✅ | ❌ |
| Is there a network round trip? | ✅ (unless prefetched) | ❌ |
| Is the new state in the history stack? | ✅ | ✅ |

In an RSC app those questions genuinely come apart, because the *data* is on the server. A sort order applied to rows the browser already holds needs no server. A filter that changes which rows exist needs one. Under one flag you would have to guess which case a call site was; under two APIs the call site says which it is.

> *"Next.js allows you to use the native `window.history.pushState` and `window.history.replaceState` methods to update the browser's history stack without reloading the page."*
> *"`pushState` and `replaceState` calls integrate into the Next.js Router, allowing you to sync with `usePathname` and `useSearchParams`."*
> — [Linking and Navigating, Native History API](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api)

The word *integrate* is doing real work there. A raw `history.pushState` in a non-Next app changes the URL and nothing in React notices. Here, the router patches into it so the client hooks stay consistent with the address bar — which is exactly the part you would otherwise have to build.

## `pushState` — a shallow change the user can undo

> *"Use it to add a new entry to the browser's history stack. The user can navigate back to the previous state. For example, to sort a list of products"*
> — [Linking and Navigating, `window.history.pushState`](https://nextjs.org/docs/app/getting-started/linking-and-navigating#windowhistorypushstate)

```tsx filename="app/[tenant]/board/sort-products.tsx"
'use client'

import { useSearchParams } from 'next/navigation'

export function SortProducts() {
  const searchParams = useSearchParams()

  function updateSorting(sortOrder: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sortOrder)
    window.history.pushState(null, '', `?${params.toString()}`)
  }

  return (
    <>
      <button onClick={() => updateSorting('asc')}>Sort Ascending</button>
      <button onClick={() => updateSorting('desc')}>Sort Descending</button>
    </>
  )
}
```

— adapted from the same section. The rows are already in the browser; the component sorts them locally and records the choice in the URL so a refresh or a shared link reproduces it.

## `replaceState` — a shallow change with no history entry

> *"Use it to replace the current entry on the browser's history stack. The user is not able to navigate back to the previous state. For example, to switch the application's locale"*
> — [Linking and Navigating, `window.history.replaceState`](https://nextjs.org/docs/app/getting-started/linking-and-navigating#windowhistoryreplacestate)

```tsx filename="app/ui/viewport-sync.tsx"
'use client'

import { usePathname } from 'next/navigation'

export function useViewportSync() {
  const pathname = usePathname()

  // A map pan/zoom fires continuously; every entry would poison the Back button.
  return function syncViewport(zoom: number, lat: number, lng: number) {
    const params = new URLSearchParams({
      zoom: String(zoom),
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
    })
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
  }
}
```

The choice between the two is the same one as `push` vs `replace` on the router: does the user expect Back to undo this? A sort click, yes. A map pan, emphatically not.

## The decision, as a rule

**Use a shallow update when the client already has everything it needs to render the new view.** Use a router navigation when the server computes the answer.

| Interaction | Data source | Write with |
|---|---|---|
| Sort a table of already-loaded rows | client | `history.pushState` |
| Change a filter that changes which rows exist | server | `<Link>` or `router.replace` |
| Pan/zoom a map, remembering the viewport | client | `history.replaceState` |
| Open a tab whose content is a Server Component | server | `<Link>` |
| Toggle a "compact rows" display density | client | `history.replaceState` |
| Change page in a server-paginated list | server | `<Link>` |
| Record which accordion sections are open | client | `history.replaceState` |

The failure mode of getting it wrong in one direction is invisible in development and obvious in production: **the URL changes and the list does not**, because you asked for a shallow update on data only the server can produce. The failure mode in the other direction is merely wasteful — a round trip to recompute something the client already had.

`nuqs` makes the same distinction its central option, which is a useful cross-check that the split is real and not a Next.js quirk:

> *"By default, query state updates are done in a *client-first* manner: there are no network calls to the server. This is equivalent to the `shallow` option of the Next.js router set to `true`. To opt-in to notifying the server on query updates, you can set `shallow` to `false`."*
> — [nuqs, Shallow](https://nuqs.dev/docs/options#shallow)

> *"Note that the shallow option only makes sense if your page can be server-side rendered. Therefore, it has no effect in React SPA."*
> — same section

Note the default there: **client-first**. A library whose whole job is URL state chose "do not tell the server" as the default, because most URL state genuinely is display state. See [03k](03k-nuqs-typed-search-params-as-a-library.md).

## What a shallow update does *not* do

- **It does not re-run a `page.tsx`.** The `searchParams` prop your Server Component received is the one it received; nothing recomputes.
- **It does not invalidate any cache.** Nothing in `next/cache` is involved.
- **It does not trigger `loading.tsx`, an error boundary, or a `Suspense` fallback.** There is no render to suspend.
- **It is not prefetchable**, because there is nothing to prefetch — the transition is already free.
- **It does not participate in `useLinkStatus` or a transition's pending flag.** There is no pending state; the URL simply changed.

If you find yourself wanting one of those, you wanted a navigation.

## Gotchas

**★ Symptom: you switched to `window.history.pushState` for speed and the list stopped updating.** Cause: the History API integration deliberately does *not* re-render Server Components; only `usePathname` and `useSearchParams` observe the change. Fix: use it only when the client already holds the data, and use the router when the server computes the result.

```tsx
// ✅ the client has all rows; sorting is local
window.history.pushState(null, '', `?sort=${order}`)

// ✅ the server computes the filtered page
router.replace(`${pathname}?status=${next}`, { scroll: false })
```

**★ Symptom: an old `shallow: true` from the Pages Router does nothing after migration, and nothing warned you.** Cause: the App Router's `router.push` takes `{ scroll, transitionTypes }` — there is no `shallow` option, and an extra property on an options object passed through a variable is not always flagged by the compiler. Fix: decide which of the two behaviours the call site wanted and write that.

```tsx
// ❌ router.push('/board?status=open', { shallow: true })  — not an App Router option
window.history.pushState(null, '', '?status=open')          // ✅ if the client has the data
router.replace('/board?status=open', { scroll: false })      // ✅ if the server does
```

**★ Symptom: `history.pushState` changes the URL but a client component reading `useSearchParams()` does not update.** Cause: the third argument was a full URL on a different origin, or the call was made before hydration completed, so the router's integration never saw it. Fix: always pass a same-origin relative URL, and only call it from an event handler or effect on a mounted client component.

```tsx
window.history.pushState(null, '', `?${params.toString()}`)         // ✅ relative
// ❌ window.history.pushState(null, '', 'https://other.example/?x=1')
```

**★ Symptom: the Back button after a shallow update returns to the previous URL but the UI shows the new state.** Cause: the component derived its state once from the URL into `useState` instead of reading the URL on every render, so a history navigation changed the address without remounting anything. Fix: derive from `useSearchParams()` on every render.

```tsx
// ❌ const [sort] = useState(searchParams.get('sort') ?? 'asc')
const sort = searchParams.get('sort') ?? 'asc'   // ✅ recomputed on every render
```

**★ Symptom: a map that syncs its viewport to the URL destroys the Back button — twenty presses to leave the page.** Cause: `pushState` on a continuous interaction. Fix: `replaceState` for anything the user would not think of as a discrete action.

```tsx
window.history.replaceState(null, '', `?zoom=${zoom}&lat=${lat}&lng=${lng}`)
```

**★ Symptom: a shallow update is applied and then immediately reverted the next time any link is clicked.** Cause: the shallow value only exists in the URL, and the server-rendered component that owns the display was still rendering from the `searchParams` it was given at its last real navigation. Fix: make the client component the sole owner of that display concern, or promote the parameter to a real navigation so the server sees it.

**★ Symptom: `loading.tsx` never appears for a filter you expected to be slow.** Cause: a shallow update produces no render on the server, so there is no suspense to fall back from. Fix: if you want a loading state, you want a navigation — the shallow path is fast precisely because nothing happens.

## Interview questions

**★ Does the App Router have shallow routing?**
Not as a router option. The Pages Router's `shallow: true` has no App Router equivalent on `router.push` or `router.replace`, whose documented options are `scroll` and `transitionTypes`. What exists instead is a documented integration with the native History API: `window.history.pushState` and `replaceState` update the URL and are picked up by `usePathname` and `useSearchParams`, but no Server Component re-renders. That is deliberate — the framework wants "the URL changed" and "the server should recompute" to be two separate decisions, because in an RSC app they usually are, and a single flag would conflate them.

**★ How do you decide between a shallow update and a navigation?**
Ask where the data for the new view comes from. If the browser already has everything it needs — sorting rows it has loaded, remembering a map viewport, recording which accordion panels are open, toggling display density — a shallow update gives you a shareable, refresh-survivable URL for free with no round trip. If the answer requires the server — a filter that changes which rows exist, a page in a server-paginated list, a tab whose content is a Server Component — you need a navigation, and a shallow update will change the address bar while leaving the content stale. The second failure is the dangerous one because it looks like it worked.

**★ What does "integrate into the Next.js Router" mean for `pushState`?**
That the framework patches the History API so its own hooks stay consistent with the address bar. In a plain React app a `history.pushState` changes the URL and no component re-renders, because nothing is subscribed to it; you would have to build a `popstate` listener and a store. Here, `usePathname` and `useSearchParams` observe the change and the components reading them re-render. What is explicitly *not* integrated is the server: no RSC payload is requested, no `page.tsx` runs again, no cache is touched.

**★ When would you use `replaceState` rather than `pushState` for a shallow update?**
By the same test as `router.replace` versus `router.push`: whether a user would expect the Back button to undo the change. A sort-order click is a discrete action they might reasonably want to reverse, so `pushState`. A map pan, a slider drag, a scroll-linked value or an accordion toggle fires continuously or trivially, and every entry poisons the history stack — twenty Back presses to leave the page — so `replaceState`. The shareable-URL benefit is identical either way; only the history semantics differ.

**★ `nuqs` defaults to client-first updates. What does that tell you about URL state in practice?**
That most of it is display state rather than query state. A library whose entire purpose is putting React state in the URL chose "do not notify the server" as its default, with `shallow: false` as the explicit opt-in for the cases where an RSC tree or a loader has to re-run. That matches what applications actually do: the majority of things worth putting in a URL — sort, tab, density, expanded rows, viewport — are derivable on the client from data it already has. The minority that genuinely change the server's answer are the ones worth a round trip, and marking them explicitly at the call site is cheaper than discovering later which of your fifty URL params were secretly making requests.

**★ Why does a shallow update never show `loading.tsx` or a `Suspense` fallback?**
Because no render happens on the server. A fallback exists to fill the gap while something is being computed elsewhere; a shallow update computes nothing elsewhere. That is also a useful diagnostic: if you expected a loading state on a filter change and did not get one, you almost certainly wrote a shallow update where you meant a navigation, and the content on screen is stale rather than fast.

---

← [03g · Writing the URL programmatically](03g-url-as-state-writing-programmatically.md) · [Chapter 8 overview](01-explanation.md) · Next → [03i · Encoding and parsing query state](03i-url-as-state-encoding-and-parsing.md)
