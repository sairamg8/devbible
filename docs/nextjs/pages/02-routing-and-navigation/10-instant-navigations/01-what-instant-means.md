---
sidebar_position: 1
title: "\"Instant\" is a precise, testable property of a navigation — not a feeling — and Next.js 16.3 turns it on with exactly two config flags"
sidebar_label: "1 · What \"instant\" means"
description: "The definition of an instant navigation, why a direct visit and a client navigation produce different UI, and the two flags — cacheComponents and partialPrefetching — that switch the whole system on."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation), [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3), [`partialPrefetching`](https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching) and [`instant` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant).
> Target: **Next.js 16.3.4** (16.3 GA 2026-08-03, Active LTS) · Node.js **>= 20.9** · TypeScript floor **5.1** · App Router on bundled React canary · Turbopack default.

**Server Components made Next.js apps good at fetching data and terrible at feeling responsive: every click waited for a server round trip unless you had remembered to drop a `loading.tsx` next to the route. Next.js 16.3 replaces that with a definition you can validate and test. A navigation is instant when the browser can paint the destination *at click time* from content it already holds, and the server streams the rest into fallbacks you declared. Two flags — `cacheComponents` and `partialPrefetching` — switch on the machinery, and Vercel has said these behaviours become the default in a future major version, so this is the model you are migrating to whether or not you opt in today.**

## The definition, verbatim

The guide does not leave "instant" to taste:

A navigation is **instant** when the browser can begin rendering the new page the moment the
user clicks — static, cached and fallback content appearing right away — while the server
streams the remaining content into those fallbacks.

And immediately qualifies it:

That definition assumes **warm caches**. A cold cache still requires the server to compute the
cached result once, so the very first navigation to a route may still wait.

Both halves matter. The first says *instant* is about what is already on the client at the moment of the click, not about total load time. The second says a "not instant" report from a real user on a cold cache is not necessarily a structural bug — but a *structurally* non-instant route is never instant, warm cache or not.

## Two flags, and one of them is not optional

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
```

`cacheComponents` is the Cache Components / Partial Prerendering model — the `'use cache'` directive, the static shell, the validation. `partialPrefetching` changes what a `<Link>` downloads. The dependency is hard, not advisory:

`partialPrefetching` **requires** `cacheComponents`. Without it, both `next dev` and
`next build` throw at config validation — this is not a silent no-op.

There is no "just try partial prefetching" path. Enabling `cacheComponents` on an existing app is itself a migration — it surfaces build errors for uncached data outside `<Suspense>` — which is why Vercel ships a codemod that opts every route out first (`cache-components-instant-false`) so you can re-enter route by route.

## Two shells, and they are not the same thing

The single most expensive misunderstanding in this whole area is treating "the shell" as one object. There are two.

**The static shell** is what a *direct visit* gets: HTML from the document response, typically off a CDN. The whole tree renders from the document root, so every `<Suspense>` boundary in the tree — including one in the root layout — is available to catch a suspending component.

**The App Shell** is what a *client navigation* gets: a per-route artifact containing the route's rendered output minus anything that depends on that link's URL. Partial Prefetching builds one App Shell per route and reuses it for every link pointing at that route.

A direct visit and a client navigation to the **same route** can produce different initial UI:

- **Direct visits** receive the **static shell** as HTML, typically served from a CDN.
- **Client navigations** re-render only *below* the layout the current and destination routes
  share — so fallback UI defined by a `<Suspense>` boundary above that shared point simply
  cannot be used during the transition.

Concretely: navigating `/store/shoes` → `/store/hats`, the `/store` layout is already mounted. Only the page below it re-renders. A `<Suspense>` in `app/layout.tsx` covers the page load and covers *nothing* on that navigation. This is why a route can pass "is the first paint good?" by hand and still block on every in-app click.

The same asymmetry bites client hooks:

`useSearchParams()` suspends during server rendering, because search params are not available
at build time. On a client navigation, though, the router already holds the params from the URL
and the hook resolves **synchronously**. The consequence is worth stating plainly: the very
same component can render immediately on a client navigation and sit behind a fallback on a
page load.

So the asymmetry runs both ways. Neither direction of test substitutes for the other, which is why the `instant()` Playwright helper takes both a `page.goto()` case and a click case — see [10 · Testing that a navigation stays instant](../../13-testing-and-developer-experience/10-the-instant-playwright-helper.md).

## The two levers you actually pull

Every fix in this system is one of two moves.

**Cache it** — a caching directive assigns a lifetime to an async function's result, which is what makes it eligible for the shell:

```tsx title="app/store/[slug]/page.tsx"
async function getProduct(slug: string) {
  'use cache'
  return db.products.findBySlug(slug)
}
```

**Push it down behind a boundary** — extract the I/O into a child and wrap that child in `<Suspense>`, so the parent stays static and its static siblings lift into the shell:

```tsx title="app/store/[slug]/page.tsx"
import { Suspense } from 'react'
import { db } from '@/lib/db'

export default function ProductPage(props: PageProps<'/store/[slug]'>) {
  return (
    <div>
      <Suspense fallback={<p>Loading product...</p>}>
        <ProductInfo params={props.params} />
      </Suspense>
      <Suspense fallback={<p>Checking availability...</p>}>
        <Inventory params={props.params} />
      </Suspense>
    </div>
  )
}

type Params = PageProps<'/store/[slug]'>['params']

async function ProductInfo({ params }: { params: Params }) {
  const { slug } = await params
  const product = await getProduct(slug)
  return (
    <>
      <h1>{product.name}</h1>
      <p>${product.price}</p>
    </>
  )
}

async function Inventory({ params }: { params: Params }) {
  const { slug } = await params
  const item = await db.inventory.findBySlug(slug)
  return <p>{item.count} in stock</p>
}
```

Note what the page component does **not** do: it never writes `await props.params`. It passes the promise down. That single discipline — await the params promise *inside* the boundary, never above it — is what keeps the App Shell reusable across every URL of the route, and it is the subject of [2 · Partial Prefetching and the App Shell](02-partial-prefetching-and-the-app-shell.md).

The release notes put the mechanism plainly:

The fix was to let a component rendering dynamic UI do one of two things: define an inline
loading state with Suspense, or mark part of its UI prerenderable with `'use cache'`. Either
way Next.js can extract that UI and load it into the client **ahead of** a navigation, which is
what makes the app feel as responsive as an SPA once a user starts clicking around.

## The one caching variant that cannot help the static shell

`'use cache: private'` caches a function that reads `cookies()` or `headers()` directly. It is genuinely useful — it is how you cache per-session lookups — but the guide is explicit about its limit:

The result is cached **in the browser only**, never on the server — and it therefore **cannot
be part of the static shell**.

It *can* land in the App Shell for a client navigation (the shell is cached per session on the client), which is exactly the split people get wrong: a route that looks instant when you click around and blocks on a hard refresh.

## Fallbacks are components, and they can suspend too

A fallback is not inert markup. It renders.

A fallback is allowed to read `cookies()`, `headers()` or the full URL. The cost is that at
build time the **fallback itself suspends**, so a `<Suspense>` boundary further up the tree
becomes necessary.

Cached values — a timestamp, a cached fetch — can sit directly in a fallback. A `cookies()` read in a fallback pushes the problem one level up.

## The five parts, and where each one lives

Instant Navigations is a suite, not a feature:

| Part | What it is | Where |
| --- | --- | --- |
| **Instant Insights** | DevTools panel surfacing navigations that are not instant, each with a prompt that teaches an agent the fix | [chunk 4](04-instant-insights-and-validation.md) |
| **Partial Prefetching** | One reusable App Shell per route; `<Link prefetch={true}>` adds URL data | [chunk 2](02-partial-prefetching-and-the-app-shell.md), [chunk 3](03-per-link-prefetching-and-incremental-adoption.md) |
| **Better ISR** | Unlisted params serve an App Shell instantly, then upgrade in the background | [chunk 6](06-better-isr-with-cache-components.md) |
| **Navigation Inspector** | Freeze a page load or client navigation at its shell to see the real loading state | [chunk 5](05-the-navigation-inspector-and-the-fix-loop.md) |
| **`instant()` Playwright helper** | Assert what is visible without waiting for the network | [ch. 13 · 10](../../13-testing-and-developer-experience/10-the-instant-playwright-helper.md) |

And the sentence that should decide whether you treat this as optional:

These behaviours **become the default in a future major version**. Vercel frames them as part
of a year's work simplifying Next.js back to its roots — dynamic by default, with no hidden or
implicit caching — which is the reason to treat adoption as a migration you schedule rather
than an experiment you defer.

## A Client Component page is instant, and that is not always the answer

A page whose top-level file starts with `'use client'` soft-navigates like an SPA: no server render at navigation time, so it is instant by construction. The dev overlay deliberately does not offer this as a fix card:

The dev overlay deliberately leaves this out of its fix cards, because it carries bigger
implications than the recommended approaches — those keep the page inside the server-component
model. Reach for `"use client"` only when the page is fully interactive and genuinely must be a
Client Component.

And it buys you nothing on the direct-visit path:

`"use client"` does **not** exempt a page from static-shell validation. Hooks such as
`useSearchParams()` still need a `<Suspense>` boundary around them.

## Gotchas

**★ `partialPrefetching: true` on its own is a hard config error, not a no-op.**
Partial Prefetching is built on the Cache Components render split; without `cacheComponents` there is no static/dynamic boundary to prefetch half of, so the validator rejects the combination — *"Without it, `next dev` and `next build` throw at config validation."* Set both flags. If enabling `cacheComponents` on an existing app floods you with errors for uncached data outside `<Suspense>`, opt every route out first and re-enter one at a time with `npx @next/codemod@canary cache-components-instant-false ./app`, which adds `export const instant = false` to every `page`, `layout` and `default` file that does not already export it, skipping Client Components.

**★ Your dev server will never feel instant, and that tells you nothing about production.**
Next.js disables prefetching in development — that is the stated reason the Navigation Inspector exists: *"Because Next.js disables prefetching in development, it can be hard to understand exactly what a user will see during a particular navigation's loading sequence."* The `instant` reference repeats it: *"Validation reflects what will happen during `next start`, where prefetching is enabled."* Judge structure from validation insights and the Inspector; judge behaviour from a production build or from `instant()` tests. Never from the feel of `next dev`.

**★ The first visitor still waits on a cold cache, and that is not a regression.**
The definition assumes warm caches; a cold `'use cache'` entry has to be computed once. The cost is paid per cache entry, not per visitor. Where the first hit matters, prerender the hot params with `generateStaticParams` — see [6 · Better ISR](06-better-isr-with-cache-components.md).

**★ A `<Suspense>` boundary in the root layout covers the page load and nothing else.**
Client navigations re-render only below the layout the two routes share, so a boundary above that point is already mounted and cannot re-enter its fallback. A hard refresh looks fine and every in-app click blocks. Move the boundary down to the component that does the I/O — the `ProductInfo` / `Inventory` split above. If you genuinely cannot, say so with `export const instant = false` rather than leaving a boundary that only appears to help.

**★ `useSearchParams()` is fast on the path you did not test.**
It suspends during server rendering because search params are not known at build time, and resolves synchronously on a client navigation because the router already holds the URL. So the same component can be behind a fallback on refresh and instant on click. Give it a boundary for the page-load path, and write both an initial-load test and a client-navigation test rather than assuming one covers the other.

**★ `'use cache: private'` will never put content in the static shell.**
Its results are cached in the browser only, so a server prerender has nothing to include: *"**It can't be part of the static shell.**"* The symptom is session UI that appears instantly when clicking around and sits behind a fallback on every direct visit. If the value must be in the static shell it cannot depend on `cookies()`; read the cookie outside a plain `'use cache'` function and pass it in, so the entry is keyed on the value and shared by every session with that value:

```tsx title="app/dashboard/user-nav.tsx"
import { cookies } from 'next/headers'

async function getTopics(team: string | undefined) {
  'use cache'
  return db.topics.forTeam(team)
}

export async function UserNav() {
  const team = (await cookies()).get('team')?.value
  return <TopicList topics={await getTopics(team)} />
}
```

**★ A fallback that reads `cookies()` moves the problem up one level rather than solving it.**
A fallback is a component and it renders: *"At build time, the fallback itself suspends, and a `<Suspense>` boundary further up the tree is needed."* Keep fallbacks made of static markup and cached values — a cached timestamp or a cached fetch can sit directly inside one. If a fallback genuinely needs URL data, a link with `prefetch={true}` resolves that data before navigation and the fallback can become part of the prefetched UI — but that is a per-link opt-in, not a property of the route.

**★ Making the page a Client Component is a real fix with real costs.**
A soft navigation into a `'use client'` page needs no server render, so it is instant by construction, and the dev overlay omits it from its fix cards precisely because *"it has bigger implications than the recommended approaches."* Reach for it when the page is fully interactive and must be a client component. As a blanket remedy it trades a streaming server render for a client bundle and re-creates the waterfall Server Components existed to remove — and it does not exempt you from static-shell validation, because `useSearchParams()` still needs a boundary.

**★ "Validation passes" and "the loading states are good" are different claims.**
A single `<Suspense>` wrapping the whole page satisfies validation and replaces the entire page with one skeleton on every navigation. The guide is blunt: *"Validation passing means the navigation is instant. It does not mean the loading states are good."* Push boundaries down until only the data actually in flight is behind a fallback.

## Interview questions

**★ What, exactly, makes a navigation "instant" in Next.js 16.3?**
That the browser can start rendering the destination at the moment of the click, from static, cached and fallback content it already has, while the server streams the rest into declared fallbacks. It is a statement about what is on the client before the click, not about total load time. The definition explicitly assumes warm caches; a cold cache entry still has to be computed once, so the first navigation to a route may wait.

**★ Which two flags enable it, and what happens if you set only one?**
`cacheComponents: true` and `partialPrefetching: true` in `next.config.ts`. `partialPrefetching` without `cacheComponents` is a config-validation error: both `next dev` and `next build` throw. The reverse — `cacheComponents` alone — is legal and useful; you get the static shell, validation insights and the Navigation Inspector, just not the per-route App Shell prefetch.

**★ Explain why the same route can be instant on a link click and slow on a refresh, or the reverse.**
Because the two paths produce different initial UI. A direct visit renders the whole tree from the document root, so every `<Suspense>` boundary in the tree can catch a suspending component and the user gets the static shell as HTML. A client navigation re-renders only below the layout the current and destination routes share, so a boundary above that point is already mounted and unusable; the user gets the destination's App Shell. Client hooks add a second asymmetry in the opposite direction: `useSearchParams()` suspends during server rendering but resolves synchronously on a client navigation because the router already has the URL.

**★ What are the only two things you can do to a component to make a route instant?**
Give its async work a cache lifetime with a caching directive so the result can be prerendered into the shell, or push the work down into a child wrapped in `<Suspense>` so the parent stays static and its static siblings lift into the shell. Every fix card the dev overlay offers is one of these two, plus the opt-out.

**★ Why is `'use cache: private'` not a general substitute for `'use cache'`?**
Because its results are cached in the browser only, never on the server, so they cannot be part of the static shell a direct visit receives. It caches functions that read runtime APIs like `cookies()` directly, which plain `'use cache'` cannot do at all, and it can carry session content into the App Shell for client navigations. So it fixes the navigation path and not the direct-visit path.

**★ Your dev server feels slow after the migration. What does that tell you?**
Essentially nothing about production. Next.js does not prefetch in development, and the docs say validation reflects what will happen under `next start`. Use the dev overlay's insights for structure, the Navigation Inspector to freeze and inspect the actual shell, and a production build or an `instant()` Playwright test for behaviour.

**★ Is adding `'use client'` to a page a legitimate way to make its navigation instant?**
Yes, mechanically — a soft navigation into a Client Component page does no server render. The dev overlay deliberately omits it from its fix cards because it has larger implications than the recommended fixes, which keep the page in the server-component model. It is the right call when the page is fully interactive and must be a client component; it is the wrong call as a blanket remedy, and it does not exempt the page from static-shell validation.

**★ Should a team that is not adopting Cache Components care about any of this?**
Yes. Vercel states the behaviours behind Instant Navigations become the default in a future major version. The structural discipline the model demands — never awaiting `params` above a `<Suspense>` boundary, giving every async read either a cache lifetime or a boundary — is work you will do eventually, and doing it under dev-only warnings today is cheaper than doing it under a major-version upgrade later.

**★ What is the difference between the static shell and the App Shell, and who receives each?**
The static shell is the prerendered HTML a direct visit receives from the document response, usually via a CDN; it is produced by Cache Components prerendering the tree until it hits uncached data or runtime APIs. The App Shell is a per-route artifact containing the route's rendered output minus anything that depends on a link's URL; Partial Prefetching builds one per route, shares it across every link to that route, and the client uses it during a soft navigation. They can contain different things — `'use cache: private'` content reaches the App Shell but never the static shell.

---

[Topic index](README.md) · Next → [2 · Partial Prefetching and the App Shell](02-partial-prefetching-and-the-app-shell.md)
