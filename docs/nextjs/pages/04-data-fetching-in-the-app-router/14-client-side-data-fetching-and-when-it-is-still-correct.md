---
sidebar_position: 32
title: "Most Client Components do not need a data-fetching library — pass a promise and unwrap it with use(); reach for SWR or TanStack Query when you need a shared browser cache"
sidebar_label: "Client-side data fetching: choosing"
description: "When client-side fetching is still correct in the App Router, the three loading patterns each library supports, the three cache layers that appear when Cache Components is on, and how to coordinate mutations across them."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Client-side data fetching](https://nextjs.org/docs/app/guides/client-side-data-fetching) (docs `lastUpdated` 2026-08-25), [How to use Next.js as a backend for your frontend](https://nextjs.org/docs/app/guides/backend-for-frontend), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), and [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife).
> Target: **Next.js 16.3.4** (16.3 = Active LTS). Node.js `>= 20.9`. The App Router bundles React canary.

**The App Router did not make client-side data fetching obsolete; it made most of it unnecessary, which is a different claim. The guide's opening position is that many applications need no client data library at all: if a Client Component reads server data once, pass it a promise and unwrap it with React's `use()`. A library earns its place when Client Components need a **shared browser cache** — focus revalidation, interval polling, request deduplication across components, optimistic updates. That is a real requirement and it is narrower than the reflex to install one. This page is the decision; the two that follow are SWR and TanStack Query in practice.**

## The default is no library

The guide opens by asserting that many applications deliver responsive interactions with no client data-fetching library at all. Its rule of thumb: if a Client Component only needs to read server data once, hand it a Promise and unwrap that with React's `use()`. The justification is stated just as directly — doing it this way avoids pulling in a library to manage data that is never going to revalidate on the client in the first place.

For interaction patterns — pending states, optimistic UI, transitions — the pointer is to Server Functions rather than to a fetching library. A library is not the answer to "this button needs to feel fast".

## When a library is the answer

The trigger the docs give for reaching for SWR, TanStack Query or Apollo Client is a single condition: Client Components need a **shared browser cache**. What such a library then buys you is a specific list — revalidation on window focus, polling at an interval, deduplication of identical in-flight requests, and optimistic updates that are visible across components rather than inside one.

The operative words are *shared browser cache*. Every capability listed depends on more than one component agreeing on an identity for the same data. One component reading one value once does not need that.

The Backend-for-Frontend guide adds the orthogonal reason — data the server simply cannot produce. Its position is that Server Components cover most data-fetching needs, with two exceptions. Data that depends on Web APIs which exist only on the client — it names the Geo-location API, the Storage API, the Audio API and the File API — and data that is frequently polled.

## The three patterns

The first decision the guide asks you to make is not which library but which of two things is true: does the initial view need data from the server, or can it wait for a browser request issued after hydration? Everything below follows from that answer.

| Pattern | SWR | TanStack Query | When data becomes available |
| --- | --- | --- | --- |
| Inline loading states | `useSWR` | `useQuery` | Browser request after hydration |
| Suspense loading states | `useSWR` with `suspense: true` | `useSuspenseQuery` | Browser request after hydration |
| Provided by the server | `<SWRConfig fallback>` | `<HydrationBoundary>` | Initial render or streamed from server |

Inline loading states are the right choice when each component should render its own loading UI. Suspense is the right choice when you want the loading UI defined at a boundary, so you can coordinate which parts of the interface reveal together and which reveal progressively.

The sentence that matters most, though, is the one drawing the line between the two responsibilities: Suspense coordinates *rendering*, while the data library and your component structure determine *when requests start*.

That last sentence separates two things people conflate. Suspense decides *what the user sees while waiting*; it does not decide *when the request goes out*. Putting two reads behind one boundary does not make them parallel — component structure does.

For browser-driven interactions — autocomplete is the docs' example — either of the two client-only patterns works. The first result does have to wait for hydration and then a browser request, and the guide's judgement is that this is often the right tradeoff precisely because the data is not needed until the user interacts.

And the third pattern, which is the interesting one:

Provide the initial data from a Server Component whenever the server already knows what the initial render needs. That value can either be included in the initial render or streamed in through Suspense. Either way, the library receives it inside the React Server Component payload and carries on managing it in the browser from there.

The server hands over a value; the library takes ownership from there. That handoff is where all the subtlety lives, and it is what the next two pages are about.

## Three caches, once Cache Components is on

Providing initial data and caching that data on the server are two separate decisions, and the docs are careful to keep them apart. You add Cache Components when the server read, or the rendered view it produced, is something that ought to be reused — not merely because a Client Component wanted a head start.

| Layer | What it stores | Freshness control |
| --- | --- | --- |
| Next.js server cache | Cached data and Server Component output | `cacheLife` `revalidate` and `expire` |
| Next.js client cache | React Server Component payloads for visited and prefetched routes | `cacheLife` `stale` |
| Client data-fetching library | Browser data stored under an SWR key or TanStack query key | The library's revalidation options and mutations |

That middle layer fills itself: Next.js prefetching can put a route's React Server Component payload into the client cache before the user has navigated anywhere.

And the rule that governs all three is that the layers keep independent freshness policies and are not required to have matching durations — but cache *identities*, and the invalidation a mutation performs, must stay coordinated across all of them.

Read that twice, because it is counter-intuitive in a useful way. **Durations do not need to match** — a server cache measured in hours and a browser `staleTime` measured in seconds are a perfectly coherent pair. **Identities do.** If the server tags data as `product:42` and the browser keys it as `/api/products/42`, a mutation has to know both, and the two strings have to be derivable from the same source of truth or they will drift.

The cache directives themselves — plain `'use cache'`, `'use cache: remote'` and `'use cache: private'` — are covered in **chapter 5, the cache directives** *(not written yet)*.

## Coordinating mutations

The docs divide the responsibility three ways. **Server Components** supply the initial data, scoped to the route segment that owns it. **The data-fetching library** holds the browser's copy under a shared cache identity. **Mutations** do two things at once — update the browser cache immediately, and invalidate the cached server data so that the next render reads a fresh value.

Two conditions attach to that. An optimistic update must be able to restore the previous browser value if the write fails. And if the server read was not cached in the first place, there is simply no server tag there to invalidate.

That last clause is the one that saves an afternoon. `updateTag` on a read that was never wrapped in a cached scope does nothing at all — successfully, silently.

### Choosing an invalidation call

| Method | Use when | Next server read |
| --- | --- | --- |
| `updateTag(tag)` | A Server Action must make its update visible immediately | Waits for fresh data |
| `revalidateTag(tag, 'max')` | The update is passive or stale data is acceptable | Serves stale data while revalidating |
| `revalidateTag(tag, { expire: 0 })` | A webhook or external system requires immediate expiration | Waits for fresh data |

The distinction is who is waiting. `updateTag` is for the user who just clicked — they must not see their own write missing. `revalidateTag(tag, 'max')` is for everyone else, who would rather have an instant stale page than a slow fresh one. `revalidateTag(tag, { expire: 0 })` is the webhook case: no user is waiting, and correctness beats latency.

## A decision procedure

1. **Does a Client Component read this once and never revalidate?** Pass a promise from the Server Component and `use()` it. Stop.
2. **Is this an interaction — a pending state, an optimistic edit, a transition?** Server Functions and React's own primitives. Stop.
3. **Do several components need the same data, kept in sync, in the browser?** Now a library earns its place.
4. **Does the *initial render* need that data?** Provide it from a Server Component — `<SWRConfig fallback>` or `<HydrationBoundary>` — rather than waiting for hydration plus a round trip.
5. **Should the server read be reused across users or requests?** Wrap it in a cache directive and tag it.
6. **Do writes have to be visible immediately?** `updateTag` in the Server Action, plus an optimistic update in the browser cache. Both, not either.

## Gotchas

**★ Installing a data library for a value that is read once and never revalidated.**
The guide's default is explicit: pass the promise and unwrap it with `use()`. A library adds a provider, a cache, a key namespace and a revalidation policy to solve a problem you do not have — and every one of those becomes something the next person must reason about.

**★ Reaching for a fetching library to make an interaction feel fast.**
Pending feedback, optimistic UI and transitions are React and Server Function concerns. A client cache does not make a mutation feel faster; `useOptimistic` and a transition do. Installing SWR to fix a sluggish button is solving the wrong layer.

**★ Assuming Suspense makes two reads parallel.**
Suspense coordinates rendering; the data library and your component structure are what determine when requests start. Two sequential reads inside one component are still sequential behind a boundary. Parallelism comes from putting independent reads in sibling components.

**★ Trying to make the three cache layers agree on durations.**
They are independent by design, and the docs say so — the layers keep their own freshness policies and are not expected to have matching durations. Matching a browser `staleTime` to a server `cacheLife` is effort spent producing a constraint nobody needed. What must agree is identity.

**★ Letting the server tag and the browser key drift apart.**
The server invalidates `product:42`; the browser caches under `/api/products/42`. Nothing enforces a relationship between those two strings, so a rename on one side silently breaks invalidation on the other. Derive both from one shared module — the pattern both library guides converge on.

**★ Calling `updateTag` on data that was never cached.**
If the server read is not cached, there is no server tag for the call to invalidate. The call succeeds and changes nothing, so the next render reads the same uncached value it would have read anyway — which is fine — while you believe you have wired up invalidation, which is not.

**★ Using `revalidateTag(tag, 'max')` for the writer's own update.**
It serves stale data while revalidating, so the user who just clicked sees their change missing on the next render. That is the correct behaviour for passive updates and the wrong behaviour for the person who made the change. `updateTag` makes the next read wait for fresh data.

**★ Firing an optimistic update with no rollback path.**
The docs make restoring the previous browser value on a failed write part of what an optimistic update *is*. Without rollback, a failed write leaves the browser cache asserting something the server never accepted, and the divergence survives until something else revalidates that key — potentially never.

**★ Fetching from your own Route Handler inside a Server Component to feed the library.**
A Server Component must read from the source directly; fetching its own handler fails a prerendered build and costs a round trip when dynamic. Provide initial data by calling the same function the handler calls. The handler stays for the browser, which genuinely needs a URL.

**★ Adding a library for polling without asking whether the server can push.**
"Frequently polled data" is a legitimate reason in the docs, and it is also the case where a poll interval is a proxy for a push you did not build. Polling every two seconds from a thousand browsers is a load profile; decide it deliberately rather than by default.

## Interview questions

**★ What is the default answer for getting server data into a Client Component, and when does it stop being enough?**
Pass a promise from the Server Component and unwrap it with React's `use()`. It stops being enough when several Client Components need the same data kept in sync in the browser — when you need a shared browser cache with focus revalidation, interval polling, request deduplication, or optimistic updates across components. That is the guide's stated trigger for adding SWR, TanStack Query or Apollo.

**★ Name the three client fetching patterns and what distinguishes them.**
Inline loading states (`useSWR` / `useQuery`), where each component renders its own loading UI and the request goes out after hydration. Suspense loading states (`useSWR` with `suspense: true` / `useSuspenseQuery`), where a boundary defines the loading UI and coordinates what reveals together, still after hydration. And server-provided data (`<SWRConfig fallback>` / `<HydrationBoundary>`), where the value is available at the initial render or streamed through Suspense, arriving in the RSC payload.

**★ With Cache Components enabled, what are the three cache layers and what controls each?**
The Next.js server cache, holding cached data and Server Component output, controlled by `cacheLife`'s `revalidate` and `expire`. The Next.js client cache, holding RSC payloads for visited and prefetched routes, controlled by `cacheLife`'s `stale`. And the data library's own browser cache, keyed by an SWR key or a TanStack query key, controlled by that library's revalidation options and mutations.

**★ Must those layers share freshness durations?**
No, and trying to make them is wasted effort — the docs state that the layers hold independent freshness policies and do not need matching durations. What must be coordinated is *identity* — the server tag and the browser key — and mutation invalidation, so that a write updates every layer that holds the affected value.

**★ Compare `updateTag`, `revalidateTag(tag, 'max')` and `revalidateTag(tag, { expire: 0 })`.**
`updateTag` is for a Server Action whose change must be visible immediately; the next server read waits for fresh data. `revalidateTag(tag, 'max')` is for passive updates where stale data is acceptable; the next read serves stale while revalidating in the background. `revalidateTag(tag, { expire: 0 })` is for a webhook or external system that requires immediate expiration; the next read waits. The choice is really "is someone waiting for this specific change".

**★ You call `updateTag` after a mutation and nothing refreshes. What are the two causes?**
Either the server read was never inside a cached scope, so there is no tag to update — the docs say plainly that an uncached server read leaves no server tag to invalidate — or the tag string used at write time differs from the one used at read time. Both fail silently, which is why both guides recommend defining the key and the tag once in a shared contract module.

**★ Does Suspense make independent reads run in parallel?**
No. Suspense coordinates what the user sees while waiting; it does not change when requests start. Component structure does: independent reads in sibling components start in parallel, while multiple reads inside a single component run sequentially. Both library guides repeat this warning about their own Suspense hooks.

**★ Why should a Server Component providing initial data not fetch it from your own Route Handler?**
Because a server-side `fetch` is a real HTTP round trip to an absolute URL. At build time nothing is listening, so a prerendered component fails the build; at runtime it costs a trip out through your public domain to reach code in the same process. Call the same function the Route Handler calls. The handler still exists — the browser needs a URL for revalidation and polling — but the server does not use it.

---

← [BFF: security and caveats](13-bff-security-and-the-caveats-that-decide-when-not-to-use-one.md) · [Chapter 4 overview](01-explanation.md) · Next → [SWR: fetching and the server handoff](15-swr-in-the-app-router-fallbacks-keys-and-mutations.md)
