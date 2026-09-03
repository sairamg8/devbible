---
title: "The two questions this chapter exists to answer at 2am — why is my page stale, and why is my page dynamic when I never asked for it — each traced from symptom to the one mechanism that produced it"
sidebar_label: "03c · Diagnosing stale and dynamic"
sidebar_position: 13
description: "An ordered diagnostic procedure for the two failure modes of App Router rendering: content that will not refresh, and routes that render per request. Every cause named, every fix in code, and a short list of things people blame that the documentation does not support."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Glossary](https://nextjs.org/docs/app/glossary) (docs `lastUpdated` 2026-08-25), [Building your application](https://nextjs.org/docs/app/guides/building) (`lastUpdated` 2026-07-21), [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (`lastUpdated` 2026-08-25) and [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Everything in [03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md) and [03b](03b-the-segment-config-surface.md) exists to make these two questions answerable in order rather than by guessing. Both have a long tail of causes and a short list of likely ones, and the fastest way through either is the same: establish what the build decided *before* you form a theory, because half of all stale-page investigations are conducted against a page that was never cached and half of all dynamic-page investigations start in `next dev`, which never prerenders anything. This page is the procedure, cause by cause, with the fix for each shown rather than named.**

## Start here, both times: what did the build decide?

Not what you configured — what it did. Rebuild just the route and read its symbol:

```bash
next build --debug-build-paths="app/(app)/board/page.tsx"
```

`○` fully prerendered · `◐` static shell with streamed content · `●` prerendered from `generateStaticParams` · `ƒ` nothing to prerender. If the symbol is `ƒ` and you are debugging staleness, stop: the page renders per request and the stale value is coming from somewhere else — a `use cache` function, a `force-cache` fetch, the client cache, or a CDN in front. If the symbol is `○` and you are debugging *dynamic* behaviour, you are looking at the wrong route; check the layout, not the page.

🔴 Do not run this investigation in `next dev`. The documentation states that in development, pages are always rendered on demand and are never cached. Every route is dynamic there and nothing is stale there, so dev can only confirm the bug is not in the browser.

## "Why is my page stale?"

### 1 · It prerendered at build and nothing revalidates it

The most common cause by a wide margin, and the least suspected because the code says nothing about caching. An unannotated `fetch` reachable before any Request-time API is fetched **once during `next build`** ([03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md)). It will keep serving that value until the next deploy.

```typescript
// lib/board.ts — before: a build-time snapshot with no way to refresh
export async function getColumns(teamId: string) {
  const res = await fetch(`${API}/teams/${teamId}/columns`)
  if (!res.ok) throw new Error(`columns ${teamId}: ${res.status}`)
  return res.json()
}

// after: state the lifetime and give it an invalidation handle
export async function getColumns(teamId: string) {
  const res = await fetch(`${API}/teams/${teamId}/columns`, {
    next: { revalidate: 300, tags: [`team-${teamId}-columns`] },
  })
  if (!res.ok) throw new Error(`columns ${teamId}: ${res.status}`)
  return res.json()
}
```

### 2 · The revalidation window elapsed and the *first* request still got old data

That is the design. Time-based revalidation serves the stale entry to the request that triggers regeneration and the fresh one to requests after it. A single reload after the window is expected to look unchanged. Reload twice before opening an investigation.

### 3 · The tag was never on the fetch, or the response was never cached

`revalidateTag` cannot invalidate what was never stored, and only `200` responses are stored. The full treatment is in the [chapter overview](01-explanation.md); the diagnostic short form is: read the *actual* call site, not the wrapper you remember writing, and assert `res.ok` before the caching semantics can matter.

### 4 · The data cache refreshed and the browser did not

This is the one that produces "it works in incognito". The client cache is an in-memory browser cache of RSC payloads for visited and prefetched routes.

> *"The client cache is cleared on page refresh."*

It is also invalidated programmatically by `revalidateTag`, `revalidatePath`, `updateTag`, `router.refresh`, `cookies.set` and `cookies.delete`, and its duration is configurable globally with `staleTimes` or per route through `cacheLife`'s `stale` property, which the docs recommend over the global setting. Note the asymmetry the glossary spells out: **pages are not cached by default, but they are reused during browser back/forward navigation.** So a user pressing Back sees the old page even when everything server-side is fresh.

```tsx
// A client component that must reflect a mutation performed elsewhere
'use client'
import { useRouter } from 'next/navigation'

export function RefreshButton() {
  const router = useRouter()
  return <button onClick={() => router.refresh()}>Refresh</button>
}
```

### 5 · The page is `force-static`, so it is not stale — it is anonymous

`dynamic = 'force-static'` prerenders by forcing `cookies`, `headers()` and `useSearchParams()` to return empty values ([03b](03b-the-segment-config-surface.md)). The content is not out of date; it is the logged-out rendering of the page, frozen. The tell is that it is wrong in the *same* way for every user, not merely old.

### 6 · You are looking at the dev server's HMR fetch cache

Next.js caches `fetch` responses in Server Components across Hot Module Replacement, including `no-store` calls, and clears it on navigation or a full reload rather than on HMR. Turn it off while debugging freshness — the mechanism and the `serverComponentsHmrCache` switch are covered in the [chapter overview](01-explanation.md).

### 7 · The path was never generated, so nothing revalidates it

`generateStaticParams` is **not** called again during revalidation. New rows produce paths the build never enumerated. With `dynamicParams` at its default they are generated on first visit; with `dynamicParams = false` they 404. Either way, no revalidation cycle will ever discover them — this needs a rebuild, usually wired to a publish webhook.

### 8 · A cached function's key did not change

Under Cache Components, a `use cache` function's arguments and captured values form its key. A loader that takes no arguments and reads its filter from module scope has one entry for all inputs, forever, and looks exactly like a stale page.

```tsx
// 🔴 one cache entry for every team
let currentTeam = 'acme'
async function getTasks() {
  'use cache'
  return db.task.findMany({ where: { team: currentTeam } })
}

// ✅ the argument is the key
async function getTasks(team: string) {
  'use cache'
  return db.task.findMany({ where: { team } })
}
```

### 9 · Something in front of Next.js is caching

A CDN, a reverse proxy, or a platform edge cache sits outside everything above and outside what the Next.js documentation specifies. The Next.js docs do not settle its behaviour for your deployment, so treat it as an explicit checkpoint rather than an assumption: confirm the response is what your origin produced before you continue debugging the framework.

## "Why is my page dynamic when I did not ask?"

The answer is always the same shape: something in the route read the request. The work is finding it, and the order below is by likelihood, not by severity.

### 1 · A Request-time API in a parent layout

A `cookies()` or `headers()` call in a layout ends the prerender prefix for every page beneath it, all at once. This is the cause in most "the whole section went dynamic and nothing changed" reports — the change was one file up the tree.

```tsx
// app/(app)/layout.tsx — 🔴 makes every child page request-time
import { headers } from 'next/headers'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const country = (await headers()).get('x-vercel-ip-country') ?? 'US'
  return <div data-country={country}>{children}</div>
}
```

```tsx
// app/(app)/layout.tsx — the read moved into a leaf behind a boundary
import { Suspense } from 'react'
import { headers } from 'next/headers'

async function CountryFlag() {
  const country = (await headers()).get('x-vercel-ip-country') ?? 'US'
  return <span data-country={country} />
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Suspense fallback={<span />}>
        <CountryFlag />
      </Suspense>
      {children}
    </div>
  )
}
```

### 2 · `searchParams` on the page

`searchParams` is a Request-time API. Reading it in a page is a request-time read, and the Building guide states that pages reading `cookies()`, `headers()` or `searchParams` stay `◐` — the shell prerenders and those parts stream. If you want the whole page prerendered, the filter belongs behind a boundary.

```tsx
// app/(app)/board/page.tsx
import { Suspense } from 'react'

export default function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  return (
    <>
      <BoardHeader />
      <Suspense fallback={<TaskListSkeleton />}>
        <FilteredTasks searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function FilteredTasks({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams
  const tasks = await getTasks({ status })
  return <TaskList tasks={tasks} />
}
```

Note the shape: the promise is passed **down** and awaited inside the boundary. Awaiting it at the top of the page would move the request-time read back above the shell.

### 3 · `draftMode()` — including in code you did not write

`draftMode()` is on the glossary's four-item Request-time API list. A preview toggle imported into a shared layout makes the whole tree request-time even when no one is previewing anything. See [10 · Draft Mode](10-draft-mode-cms-preview-that-bypasses-every-cache-layer.md) for the intended pattern.

### 4 · A `params` value the build does not know

`params` is runtime data unless the value came from `generateStaticParams`. A dynamic segment with no enumerated params prints a fallback row and renders per request.

### 5 · A config flag someone added upstream

`export const dynamic = 'force-dynamic'`, `export const revalidate = 0`, `fetchCache = 'force-no-store'` or `'default-no-store'` in any layout or page in the route. Segment `revalidate = 0` is the sneakiest of the four: it is documented as ensuring the segment is always dynamically rendered *even if no Request-time API or uncached fetch is discovered*, so it produces a dynamic route with no visible cause in the component code.

```bash
grep -rn "export const dynamic\|export const revalidate\|export const fetchCache" app/
```

### 6 · A `connection()` left behind

`connection()` exists to say "do not prerender past this point", and the build error identifies it as the one access `use cache` cannot fix. It is frequently added to unblock a build and never removed.

### 7 · An uncached read with no boundary — under Cache Components, this is a build failure

With `cacheComponents` on, an uncached `fetch` or database call that is neither inside `use cache` nor behind `<Suspense>` does not silently make the route dynamic; the build fails with `blocking-prerender-runtime` or `blocking-prerender-dynamic`. That is a feature: the previous model's failure mode was a silently slower app.

### 8 · Non-determinism

`new Date()`, `Math.random()` and friends. They are called out separately in the Building guide as things that can fail the build under Cache Components; without it they simply freeze into the prerendered HTML.

### 9 · It is not a page

Route Handlers are **not** cached by default in 16.x, and Proxy and dynamic metadata files (`icon`, `opengraph-image`) also report `ƒ`. A `ƒ` row is often a handler or a metadata route rather than the page you were investigating — see [01d](01d-route-handlers-and-their-caching-model.md).

## Things people blame that the documentation does not support

Naming these saves the hour spent proving them.

- **A `<Suspense>` boundary does not make its children dynamic.** It declares where the shell ends; a synchronous child still completes during prerendering.
- **A Server Action in the file does not make the page dynamic.** Actions run at request time by definition; that is orthogonal to how the page rendered.
- **The presence of `proxy.ts` making every page dynamic** is a claim I could not confirm from the documentation. The build output lists Proxy itself among things that show `ƒ` because they have nothing to prerender; that is a statement about the Proxy entry, not about your pages. Verify it in your own route table before designing around it.
- **`generateMetadata` reading request data** — the docs place `generateMetadata` in the same memoization scope as layouts, pages and Server Components, which strongly implies a request-time read there counts like any other. The documentation does not state it in those words, so confirm it against your build output rather than my inference.

## Gotchas

**★ Symptom: the page is stale, and every caching option you add changes nothing.** Cause: you are debugging the wrong layer. The route table says `ƒ`, so the page renders per request and the stale value is coming from a `use cache` function, a `force-cache` fetch, the client cache or a CDN. Fix: establish the route's symbol first, with `next build --debug-build-paths` scoped to the one route, before changing any code.

**★ Symptom: a mutation succeeds, the server has fresh data, and the user still sees the old page until they hit reload.** Cause: the client cache still holds the RSC payload for a route already visited, and it is cleared on page refresh. Fix: invalidate it from the action, or refresh from the client after the action resolves.

```tsx
// app/(app)/board/actions.ts
'use server'
import { revalidateTag } from 'next/cache'

export async function completeTask(teamId: string, taskId: string) {
  await db.task.update({ where: { id: taskId }, data: { done: true } })
  revalidateTag(`team-${teamId}-tasks`) // clears the server cache and the client cache
}
```

**★ Symptom: pressing the browser Back button shows data you know is stale.** Cause: pages are not cached by default *but are reused during browser back/forward navigation*, by design. Fix: this is intended behaviour for history navigation; if the data must never be reused, shorten the client cache — `cacheLife`'s `stale` property per route is the documented preference over the global `staleTimes` setting.

**★ Symptom: the whole authenticated section became dynamic in a release with no page changes.** Cause: a request-time read added to a shared layout — geo headers, a theme cookie, a preview toggle calling `draftMode()`. Fix: move the read into a leaf component and put a boundary above it, so the layout stays prerenderable. Shown in full in "§1" above.

**★ Symptom: a route is dynamic and nothing in any component reads the request.** Cause: `export const revalidate = 0` somewhere in the route — documented as forcing dynamic rendering even when no Request-time API and no uncached fetch is discovered. Fix: grep the whole `app/` tree for segment config exports before reading any component code.

```bash
grep -rn "export const dynamic\|export const revalidate\|export const fetchCache" app/
```

**★ Symptom: the fix works locally in `next dev` and the deployed build is unchanged.** Cause: development never prerenders and never caches pages, so it cannot reproduce either failure mode. Fix: reproduce against a production build of the single route, and only then compare.

```bash
next build --debug-build-paths="app/(app)/board/page.tsx" && next start
```

**Symptom: new records appear on the site eventually but never get prerendered.** Cause: `generateStaticParams` is not re-run during revalidation; ISR refreshes known paths only. Fix: trigger a rebuild on publish. A `revalidateTag` call will not do it, however correct the tag is.

**★ Symptom: a `use cache` function returns the same data for every team.** Cause: the cache key is the function's arguments and captured values; a loader reading its filter from module scope or a closure has one entry. Fix: pass the discriminator as an argument, as shown above.

**Symptom: after enabling Cache Components, a route that "was just a bit dynamic" now fails the build.** Cause: an uncached read outside both `use cache` and `<Suspense>`. The previous model made it dynamic silently; this one refuses. Fix: pick one of the three documented remedies — stream it with a boundary or `loading.tsx`, cache it with `use cache`, or opt the route out of validation with `instant = false` while understanding that the last one gives users a blank wait.

**Symptom: a page renders the signed-out view for authenticated users and nothing errors.** Cause: `dynamic = 'force-static'` blanking `cookies`, `headers()` and `useSearchParams()`. It is not staleness. Fix: `dynamic = 'error'` if the route must stay prerenderable, otherwise remove the flag and put the session read behind a boundary.

**Symptom: two people "fix" the same stale route in opposite directions and both are convinced they are right.** Cause: the route's revalidation frequency is the **lowest** value across every layout, page and fetch in it, so a change anywhere alters the whole route and neither person is looking at the same set of files. Fix: define the loader once in a shared module with its options attached, so there is exactly one place the answer lives.

## Interview questions

**★ A page is serving data from last Tuesday. Walk through your diagnosis in order.**
First establish what the build decided — rebuild that one route with `--debug-build-paths` and read its symbol; a `○` means it prerendered and nothing revalidates it, which is the single most common cause and needs no further investigation. If it revalidates, check whether the window merely elapsed: time-based revalidation serves the stale entry to the request that triggers regeneration, so one reload proves nothing. If the invalidation is on-demand, verify the tag is on the actual fetch and the response was a `200`, since only `200` responses are stored. Then check the browser: the client cache holds RSC payloads for visited routes and is cleared on page refresh, so "works in incognito" points here. Only then look outside Next.js at a CDN. Every step before the last is settled by documentation; the last one is not, which is why it goes last.

**★ Why is `next dev` useless for both of these investigations?**
Because development is documented as always rendering pages on demand and never caching them. That means every route is dynamic and no page is stale, so dev cannot reproduce either symptom — it can only rule out a browser-side cause. It also means the reverse mistake is common: seeing a page re-render on every keystroke in dev and concluding the production route is dynamic. The only authoritative signal is the production route table, and `--debug-build-paths` exists to make getting it for one route cheap enough to do routinely.

**★ Your whole `/app` section went dynamic in a release that touched no page. Where do you look first, and why there?**
The layouts. A Request-time API read ends the prerender prefix for everything below it, so one `headers()` call added to a shared layout converts every page in the subtree at once — which matches the symptom shape exactly: many routes, no page changes. Second place is a segment config export anywhere in the route, particularly `revalidate = 0`, which forces dynamic rendering even when no component reads the request. Both are found by grep, not by reading components.

**A teammate says a `<Suspense>` boundary made their component dynamic. Are they right?**
No, and the confusion is worth untangling because it leads people to remove boundaries that are load-bearing. A boundary declares where the static shell ends and streaming begins; it does not opt anything into request-time rendering. A synchronous child inside one still completes during prerendering. What is true is the converse: content that *must* render at request time is only legal — under Cache Components, only buildable — if there is a boundary above it whose fallback can ship in the prerendered HTML.

**Why does passing the `searchParams` promise down into a child change the outcome, when the same value is read either way?**
Because what matters is *where* the await happens, not that the value is used. Awaiting `searchParams` at the top of a page makes the page's own render request-time, so nothing above the first boundary can prerender. Passing the promise into a component inside a `<Suspense>` boundary and awaiting it there keeps everything outside the boundary in the static shell, and only the filtered list streams. The same rewrite applies to `params` in a layout, and it is the single highest-leverage structural change available in an App Router codebase.

**You are told "our CDN is caching it". How do you decide whether that is true before rewriting anything?**
By eliminating everything the documentation does settle first: the route's build symbol, the revalidation configuration, whether the tag was on the fetch, whether the response was a `200`, and whether the browser's client cache explains it. Those are all specified behaviours with named mechanisms. A CDN or platform edge cache sits outside what the Next.js documentation covers, so it is the residual explanation, not the opening hypothesis — and the way to test it is to confirm whether the bytes match what your origin produced, not to add cache headers speculatively.

**Under Cache Components, is a silently dynamic route still possible?**
Much less so, and that is the point of the change. An uncached read outside `use cache` and outside a boundary fails the build rather than downgrading the route. What remains possible is a route that is *legitimately* mostly dynamic — everything behind boundaries, streaming on every request — which builds cleanly and performs like the thing you were trying to avoid. The route table is still how you catch that: a `◐` on a route you expected to be `○` means the shell prerendered and something inside streams, and it does not tell you what, so you go back to `next dev` or `--debug-prerender` to find it.

---

← [03b · The segment config surface](03b-the-segment-config-surface.md) · [Chapter 4 overview](01-explanation.md) · Next → [04 · Route Handlers for RESTful APIs](04-route-handlers-routets-for-restful-apis.md)
