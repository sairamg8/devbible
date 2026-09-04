---
title: "Appendix A · part 1 — the rendering vocabulary: PPR, RSC and Cache Components, each defined against the term it is mistaken for"
sidebar_label: "01 · Glossary — PPR, RSC, Cache Components"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the [Next.js Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated: 2026-08-25`), [Cache Components](https://nextjs.org/docs/app/getting-started/caching), [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) and [How to optimize your Next.js application for production](https://nextjs.org/docs/app/guides/production-checklist).
> Target: **Next.js 16.3.4** · React **canary** (ships 19.2 features) · Node.js **20.9+**. Documentation-verified; **no sandbox run, no timings**.

**A glossary earns its place only where the vocabulary actively misleads, and Next.js 16's does. `Prerendering` and `Static rendering` are literally the same glossary entry. `Static Shell` and `App Shell` are two different things one letter of intuition apart. `Middleware` now resolves to a one-line redirect. This page takes the three *rendering* terms in this appendix's title — PPR, RSC, Cache Components — defines each against the primary source, and then names the thing it is routinely confused with and shows what the confusion costs. The build-and-tooling half (Turbopack, MCP, Instant Navigations) is [part 2](01b-appendix-a-glossary-turbopack-mcp-instant.md); the plain A–Z is [part 3](01c-appendix-a-glossary-the-a-to-z.md).**

## How to read the definitions

Every definition below is quoted verbatim from the source that owns it, in `> *"…"*` form, and then explained. Where the official glossary has no entry, the page says so rather than inventing one — an appendix that quietly fills a gap in the docs is how a reader ends up confidently wrong in an interview.

🔴 **One structural warning first.** The official glossary carries `version: 16.3.4` in its frontmatter. That is the **docs build number, not a review date.** Individual pages carry their own `lastUpdated:`, and they differ by months. The glossary's is `2026-08-25` and is current; the [production checklist's is `2026-03-10`](04-appendix-d-production-readiness-checklist-security.md) and is not. Read the per-page date, never the build version.

---

## 1 · Partial Prerendering (PPR)

> *"A rendering optimization that combines prerendering and dynamic rendering in a single route. The static shell is served immediately while dynamic content streams in when ready, providing the best of both rendering strategies."*

PPR is a **rendering strategy**, not a flag and not a directive. In Next.js 16 you no longer turn PPR on; you turn `cacheComponents` on and PPR is what you get:

> *"Additionally, `cacheComponents` implements **Partial Prerendering (PPR)** as the default behavior in the App Router. This means the `experimental.ppr` configuration flag and the `experimental_ppr` route segment configuration are no longer necessary and have been removed."*

```ts
// next.config.ts — Next.js 16. There is no `ppr` key any more.
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

### Mistaken for: **Streaming**

Streaming is the transport; PPR is the split. Streaming sends a page in pieces as they become ready and needs nothing but a `<Suspense>` boundary or a `loading.js`. PPR decides *which* pieces are computed at build time and cached, and which are computed per request — and then uses streaming to deliver the second group. You can stream without PPR. You cannot do PPR without streaming, because the dynamic holes have to arrive somehow.

The practical difference is money: a streamed page still costs a server render of the whole page on every request. A PPR page serves the shell from cache and renders only the holes.

### The migration trap the docs state outright

> *"PPR in **Next.js 16** works differently than in **Next.js 15** canaries. If you are using PPR today, stay in the current Next.js 15 canary you are using."*

And enabling the successor is not a rename:

> *"Enabling `cacheComponents` is not a rename-only change: it can surface build errors for uncached data outside of `<Suspense>` and requires adopting the Cache Components model."*

Chapter 5 works the whole model through: [05 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/README.md).

---

## 2 · RSC — React Server Components, and the RSC Payload

The glossary defines the component and the wire format separately, and the second is the one people cannot describe under questioning.

> **Server Component** — *"The default component type in the App Router. Server Components render on the server, can fetch data directly, and don't add to the client JavaScript bundle. They cannot use state or browser APIs."*

> **RSC Payload** — *"The React Server Component Payload is a compact binary representation of the rendered React Server Components tree. It contains the rendered result of Server Components, placeholders for Client Components, and props passed between them."*

Three things follow from that one sentence, and they are the whole model:

1. **The payload is not HTML.** It is a serialized tree. HTML is produced *from* it for the first paint; every subsequent client navigation transfers the payload alone, which is why navigations do not re-download the document.
2. **Client Components appear in it as placeholders**, not as code. The code arrives from the client bundle. That is why a `"use client"` boundary drawn too high inflates the bundle without changing what the server rendered.
3. **Props crossing the boundary are in the payload**, so they must be serializable — and whatever you put in them is on the wire, readable by the user.

### Mistaken for: **SSR**

Server-side rendering answers *"where did this HTML come from?"* — the server. RSC answers *"which components are allowed to exist only on the server?"* They are orthogonal. A Client Component is **still server-rendered** on the first request:

> *"In Next.js, Client Components can also be rendered on the server during initial page generation."*

So *"I made it a Client Component so it renders on the client"* is wrong on the first load and right on every navigation after. The name `"use client"` marks a **boundary**, not a location.

### Mistaken for: **Server Actions**

A Server Action is not an RSC. The glossary is precise about the containment:

> **Server Function** — *"An asynchronous function that runs on the server, marked with the `"use server"` directive."*
> **Server Action** — *"A Server Function that is passed to a Client Component as a prop or bound to a form action."*

🔴 **Every Server Action is a Server Function; not every Server Function is a Server Action.** A `"use server"` function called from another server module is a Server Function and nothing more. The distinction matters because the security advice attaches to the *Action* — the moment a function is reachable from a Client Component it is a public HTTP endpoint:

> *"Verify authentication and authorization inside each action. Do not rely on Proxy or layout or page level checks alone."*

---

## 3 · Cache Components

> *"A feature that enables component and function-level caching using the `"use cache"` directive. Cache Components allows you to mix static, cached, and dynamic content within a single route by prerendering a static HTML shell that's served immediately, while dynamic content streams in when ready. Configure cache duration with `cacheLife()`, tag cached data with `cacheTag()`, and invalidate on-demand with `updateTag()`."*

Three separate things share this name in conversation and must not in your head:

| Thing | What it is | Where it lives |
|---|---|---|
| `cacheComponents: true` | the **config flag** | `next.config.ts` |
| Cache Components | the **model** the flag switches you into | your mental model |
| `"use cache"` | the **directive** that marks one scope cacheable | top of a file, function or component |

> `"use cache"` — *"A directive that marks a component or function as cacheable. It can be placed at the top of a file to indicate that all exports in the file are cacheable, or inline at the top of a function or component to mark that specific scope as cacheable."*

### Mistaken for: **the old default-caching behaviour, renamed**

It is the inversion of it. Under Cache Components, **data fetching is dynamic by default and you opt each piece into caching** — the reverse of the Next.js 13/14 model where `fetch` was cached unless you said otherwise. Reading it as a rename is what produces the *"Next.js encountered uncached data during prerendering"* build error on day one of an upgrade.

### Mistaken for: **something you can enable on the edge runtime**

> *"Cache Components requires the Node.js runtime. Migrate any routes that set the deprecated `runtime = 'edge'` export, and note that other server-side JavaScript runtimes are not guaranteed to work."*

### Mistaken for: **Memoization**

They are both "the same call does not run twice", and they are not the same mechanism.

> **Memoization** — *"Caching the return value of a function so that calling the same function multiple times during a render pass (request) only executes it once. In Next.js, `fetch` `GET` requests with the same URL and options are automatically memoized across Server Components, layouts, pages, and `generateMetadata`/`generateStaticParams` (but not Route Handlers since they are not part of the React component tree)."*

Memoization is **request-scoped and free**: it deduplicates within one render pass and evaporates. Caching under `"use cache"` is **cross-request and configured**: it has a lifetime, a tag, and an invalidation story. The parenthetical is the part that catches people — Route Handlers are not in the React component tree, so `fetch` calls there are not memoized at all.

---

## The two shells — the confusion that costs the most

Both are real glossary entries. They are not the same thing, and almost everyone assumes they are.

> **Static Shell** — *"The prerendered HTML structure of a page that's served immediately to the browser. With Partial Prerendering, the static shell includes all statically renderable content plus Suspense boundary fallbacks for dynamic content that streams in later."*

> **App Shell** — *"A per-route prerender containing the parts of a page that don't depend on URL data. Cached content is included when its `stale` time is at least 5 minutes… Used as the default prefetch payload during client navigations, the loading state when a per-link prefetch is not ready, and the fallback for ISR with Cache Components."*

| | Static Shell | App Shell |
|---|---|---|
| Scope | one **URL** | one **route** (all its URLs) |
| Contains URL data (`params`) | yes | 🔴 **no** |
| Primary job | first paint of a direct visit | prefetch payload for client navigation |
| Inclusion rule for cached content | statically renderable | `stale` **≥ 5 minutes** |

The reason the App Shell excludes params is stated directly:

> **URL data** — *"URL data varies per link, not per session, so it can't be part of a shared App Shell."*

And the 5-minute rule has a sibling floor you will hit sooner:

> *"**Minimum of 30 seconds is enforced** to ensure prefetched links remain usable."*
> *"`stale` under 30 seconds: excluded from prerenders, because a prefetch would expire before the user could click."*

## The rendering aliases, in one table

Four of the glossary's rendering entries are aliases or near-aliases of each other. Memorising the table is cheaper than re-deriving it in an interview.

| Term | Glossary says |
|---|---|
| **Prerendering** | *"When a component is rendered at build time or in the background during revalidation. The result is HTML and RSC Payload"* |
| **Static rendering** | *"See Prerendering."* — the same thing |
| **Dynamic rendering** | *"When a component is rendered at request time rather than build time. A component becomes dynamic when it uses Request-time APIs."* |
| **Runtime rendering** | *"See Dynamic rendering."* — the same thing |

And the trigger list is closed and short:

> **Request-time APIs** — `cookies()`, `headers()`, `searchParams`, `draftMode()`.

🔴 **Reading that list as "four functions to avoid" is the wrong lesson.** The right one is *where* you call them: they opt the enclosing route into dynamic rendering — *"or your whole application if used in the Root Layout."*

## Gotchas

**★ Symptom: you set `cacheLife` with `stale: 10` and the route stops being prefetchable at all.** Cause: 30 seconds is an enforced floor, and content below it is excluded from prerenders entirely — a prefetch would expire before a user could act on it. Fix: raise the floor, and if you genuinely need sub-30-second freshness, get it from an on-demand invalidation instead of a short TTL.

```ts
'use cache'
import { cacheLife } from 'next/cache'

// BAD — silently excluded from prerenders.
cacheLife({ stale: 10, revalidate: 30, expire: 300 })

// GOOD — clears the 30s floor; freshness comes from updateTag in the mutation.
cacheLife({ stale: 60, revalidate: 60, expire: 300 })
```

**★ Symptom: content appears in the Static Shell but never in the App Shell.** Cause: its `stale` is under 5 minutes, which is the documented inclusion rule for the App Shell specifically. Fix: if the value must be in the prefetch payload, give it a `stale` of at least 5 minutes; if it cannot tolerate that, move it below a `<Suspense>` boundary and let it stream — trying to have both is the contradiction.

**★ Symptom: a Client Component throws on `window` during `next build`.** Cause: reading `"use client"` as *"runs only in the browser"*. Client Components are rendered on the server for the initial paint. Fix: guard the browser access in an effect, which by definition does not run on the server.

```tsx
'use client'
import { useEffect, useState } from 'react'

export function ViewportWidth() {
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    setWidth(window.innerWidth)
  }, [])
  return <span>{width === null ? 'measuring…' : `${width}px`}</span>
}
```

**★ Symptom: you enabled `cacheComponents` expecting no behaviour change and the build now fails on routes that built fine yesterday.** Cause: it is not a rename of `dynamicIO`/`useCache`; it inverts the caching default and starts rejecting uncached data read outside a `<Suspense>` boundary during prerender. Fix: take the labelled fix the error offers — `[stream]` wrap it, `[cache]` mark it `"use cache"`, or `[block]` set `export const instant = false` — deliberately, per route.

```tsx
// app/products/[slug]/page.tsx — the [stream] fix, shown rather than described.
import { Suspense } from 'react'

async function LivePrice({ slug }: { slug: string }) {
  const res = await fetch(`https://api.example.com/price/${slug}`)
  const { amount } = await res.json()
  return <strong>{amount}</strong>
}

export default async function Page({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params
  return (
    <main>
      <h1>{slug}</h1>
      <Suspense fallback={<span>Loading price…</span>}>
        <LivePrice slug={slug} />
      </Suspense>
    </main>
  )
}
```

**★ Symptom: a route reads `cookies()` in the root layout and now every page in the app is dynamic.** Cause: Request-time APIs opt the enclosing route into dynamic rendering, and the docs call out the root layout specifically as opting in *"your whole application"*. Fix: push the read down to the component that needs it, inside a `<Suspense>` boundary, so the rest of the tree still prerenders.

**★ Symptom: a `fetch` inside a Route Handler runs twice for one request and you expected memoization.** Cause: memoization is scoped to the React component tree, and Route Handlers are not part of it. Fix: deduplicate explicitly with React's `cache`, or restructure so the read happens in a Server Component.

```ts
// app/lib/get-user.ts
import { cache } from 'react'

export const getUser = cache(async (id: string) => {
  const res = await fetch(`https://api.example.com/users/${id}`)
  return res.json()
})
```

**★ Symptom: a Client Component receives a whole database row as a prop and a reviewer flags a data leak.** Cause: props crossing the boundary are serialized into the RSC Payload, which the browser receives in full — including the columns your JSX never renders. Fix: project to exactly the fields the component needs, at the server, before the boundary.

```tsx
// BAD — password_hash, internal_notes and every other column ship to the browser.
const user = await db.users.findById(id)
return <ProfileCard user={user} />

// GOOD — only what the component renders crosses the boundary.
const { id: userId, displayName, avatarUrl } = await db.users.findById(id)
return <ProfileCard user={{ id: userId, displayName, avatarUrl }} />
```

**★ Symptom: authorization works when you load the page but an attacker can still invoke the mutation.** Cause: the check lives in the layout or the page, and a Server Action is a separate HTTP entry point that never runs them. Fix: check inside the action itself.

```ts
'use server'
import { auth } from '@/app/lib/auth'

export async function deleteProject(projectId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  if (!(await session.canDelete(projectId))) throw new Error('Forbidden')
  await db.projects.delete(projectId)
}
```

**★ Symptom: you cannot find `middleware.ts` behaviour documented anywhere.** Cause: the glossary entry for **Middleware** is now a one-line redirect — *"See Proxy"* — because the file convention was renamed. Fix: read the Proxy docs, and know the consequence the rename carries: *"The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured. If you want to continue using the `edge` runtime, keep using `middleware`."*

## Interview questions

**★ What is the difference between the Static Shell and the App Shell?**
The Static Shell is per-URL: the prerendered HTML for one page, including everything statically renderable plus Suspense fallbacks for what streams. The App Shell is per-route: the part of the page that does not depend on URL data at all, shared across every URL the route matches. The Static Shell exists to make a direct visit paint fast; the App Shell exists to be the prefetch payload for client navigations, the loading state when a per-link prefetch has not arrived, and the fallback for ISR under Cache Components. The reason the App Shell cannot contain `params` is that URL data varies per link rather than per session, so a shared payload cannot carry it. They also have different inclusion rules for cached content: the App Shell only admits content whose `stale` is at least five minutes, because it is reused for longer than shorter-lived content stays fresh.

**★ Why did Next.js 16 remove the `experimental_ppr` segment config rather than stabilizing it?**
Because PPR stopped being a thing you opt a route into. Under Cache Components, PPR is the default rendering behaviour of the App Router, so a per-route opt-in has nothing left to express. The docs are explicit that the flag and the segment config *"are no longer necessary and have been removed."* The important follow-on is that this is not a pure removal: PPR in 16 behaves differently from PPR in the 15 canaries, and the documented advice for anyone already running it is to stay on their current 15 canary until they migrate deliberately.

**★ Is a Client Component rendered on the client?**
On the first load, no — or not only. Client Components are rendered on the server during initial page generation and then hydrated in the browser; on subsequent client navigations they render in the browser. `"use client"` marks a boundary in the module graph, not a runtime location. Everything imported past that boundary joins the client bundle, which is why the boundary's *placement* is a bundle-size decision as much as an interactivity one.

**★ What exactly is in the RSC Payload, and why does it matter that Client Components are placeholders in it?**
It is a compact binary serialization of the rendered Server Component tree: the output of Server Components, placeholders where Client Components go, and the props passed across the boundary. It matters because it separates two costs. The Server Component output is already rendered and costs no client JavaScript. The Client Component placeholder costs a bundle download. And the props are on the wire in serialized form — which is why passing a database row into a Client Component leaks every column of it to the browser, and why the tainting API exists.

**★ Every Server Action is a Server Function. What is a Server Function that is not a Server Action, and why does the distinction matter?**
A `"use server"` function that is only ever called from other server code — never passed to a Client Component as a prop and never bound to a form action — is a Server Function and not a Server Action. It matters because becoming an Action is what makes a function externally reachable: it gets an ID and an HTTP entry point that anyone can call. All the authorization advice attaches at that moment. The docs are blunt that you verify authentication and authorization *inside each action*, and specifically that you do not rely on Proxy, layout, or page-level checks alone — those run on the page request, not on the action invocation.

**★ Memoization and caching both stop a function running twice. Distinguish them.**
Memoization is request-scoped, automatic and free: within a single render pass, `fetch` `GET` calls with the same URL and options execute once, deduplicated across Server Components, layouts, pages and the `generate`-prefixed functions. It leaves nothing behind when the request ends. Caching under `"use cache"` is cross-request and deliberate: it has a lifetime you set with `cacheLife`, a tag you set with `cacheTag`, and an invalidation path through `updateTag` or `revalidateTag`. The trap sits in the exclusion: Route Handlers are not part of the React component tree, so nothing there is memoized, and a handler that fetches the same URL three times makes three requests.

**★ What are the Request-time APIs, and what is the real lesson of that list?**
`cookies()`, `headers()`, `searchParams` and `draftMode()`. The wrong lesson is "avoid them". The right one is that they opt the *enclosing route* into dynamic rendering — and used in the root layout, they opt the entire application in. So the skill is placement: read them in the smallest component that needs them, below a `<Suspense>` boundary, so everything above still prerenders.

**★ A colleague says "we run PPR, so we're already on Cache Components." What do you ask?**
Which major they are on. If they are on a 15 canary with `experimental.ppr`, they are running the *old* PPR, which behaves differently, and the documented advice is to stay on that canary rather than half-migrate. If they are on 16, `experimental.ppr` no longer exists, so whatever they have is either `cacheComponents` or nothing.

**★ "Prerendering", "static rendering", "dynamic rendering", "runtime rendering" — how many distinct concepts is that?**
Two. Prerendering and static rendering are the same entry in the glossary — rendering at build time or in the background during revalidation, producing HTML plus an RSC Payload that can sit on a CDN. Dynamic rendering and runtime rendering are likewise one thing: rendering at request time, triggered by a Request-time API. The four-word vocabulary is historical, not conceptual, and treating it as four ideas is how people invent distinctions that do not exist.

**★ Why can a Server Component fetch data directly while a Client Component cannot?**
Because a Server Component runs only on the server, so it can hold credentials, open a database connection and await a query without any of that reaching the browser — and it contributes zero bytes to the client bundle. A Client Component is code that must exist in the browser, so anything it can reach, the user can reach. The pattern that follows is to fetch in the Server Component and pass the narrowed result across the boundary as props, or, when the read genuinely has to happen from the browser, put it behind a Route Handler — while remembering the docs' own warning not to call Route Handlers *from* Server Components, since that spends a second server request to reach code already on the server.

---

← [Chapter 19 overview](01-explanation.md) · Next → [Glossary, part 2 — Turbopack, MCP, Instant Navigations](01b-appendix-a-glossary-turbopack-mcp-instant.md)
