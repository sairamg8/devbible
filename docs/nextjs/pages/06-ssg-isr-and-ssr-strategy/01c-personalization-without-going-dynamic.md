---
title: "Personalization is the axis that actually forces the decision, and it forces it four different ways — knowing which rung of the ladder a page is on is worth more than any flag, because only the top rung genuinely needs a request-time document"
sidebar_label: "01c · Personalization"
sidebar_position: 3
description: "The personalization ladder from not-personalized to fully-personalized, where the shell/hole split applies, why force-static is a security decision wearing performance clothes, the geo APIs that were removed in v15, and how personalized cache keys blow up in cardinality."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching](https://nextjs.org/docs/app/getting-started/caching) (docs `version: 16.3.4`, `lastUpdated: 2026-08-25`) and [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) (quoted from research banked 2026-09-03). The `force-static` blanking behaviour and the v15.0.0 removal of `request.ip` / `request.geo` are corpus-established facts carried from [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md); not re-derived here.
> `next` is **not installed in this checkout** — no package probe was possible; `react` probes at **19.2.8**.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node >= 20.9**. Documentation-verified; **no sandbox run**.

**Of the four axes, personalization is the one that most often ends the argument, because it is the only one where the *document itself* differs per reader. But "this page is personalized" is four different situations wearing one word, and three of them do not require a request-time document at all. Get the rung wrong upward and you pay request-time rendering for every visitor to show a name in a corner; get it wrong downward and you serve one user's page to another, or — the specific failure this page exists to prevent — you serve the logged-out branch to everybody and never see an error, because `force-static` does not fail when you are wrong about it.**

## The ladder, rung by rung

**Rung 0 — not personalized at all.** Marketing pages, documentation, catalogue, blog, pricing. The overwhelming majority of public routes. If a signed-in user and an anonymous user would receive byte-identical HTML, there is no personalization axis and no reason to leave the prerendered default. The nav avatar does not count — see rung 2.

**Rung 1 — personalized, but derivable in the browser.** Timezone-local timestamps, "recently viewed" from `localStorage`, unit preferences, anything the client already knows. This is not a rendering decision; it is a Client Component. Cost: zero server work, at the price of a possible flash before hydration.

```tsx
'use client'

import { useEffect, useState } from 'react'

export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(iso)
  useEffect(() => {
    setText(new Date(iso).toLocaleString())
  }, [iso])
  return <time dateTime={iso}>{text}</time>
}
```

⚠️ **The flash is the reason rung 1 collapses into rung 2 for themes.** A cookie-driven dark mode rendered on the client repaints after hydration; the fix is a server read, which is rung 2, and this is a real trade-off, not a mistake.

**Rung 2 — a public document with a per-user fragment.** A product page whose header shows a cart count; an article with a "saved" state; a pricing page that shows the member discount. The document is public and cacheable; a hole in it is not. **This is the case PPR was invented for**, and under Cache Components the framework's own worked example is exactly this shape:

> *"Reading `cookies()` here doesn't opt-in the whole route into dynamic rendering, the way the previous rendering model did. The Suspense boundary provides fallback UI where the runtime access streams, while static and cached content still ship in the initial HTML."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

```tsx
// app/products/[id]/page.tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'

export default async function Page({ params }: PageProps<'/products/[id]'>) {
  const { id } = await params
  return (
    <main>
      <ProductDetail id={id} />
      <Suspense fallback={<CartBadgeSkeleton />}>
        <CartBadge />
      </Suspense>
    </main>
  )
}

async function ProductDetail({ id }: { id: string }) {
  'use cache'
  const product = await db.product.findUnique({ where: { id } })
  return <Detail product={product} />
}

async function CartBadge() {
  const sessionId = (await cookies()).get('sid')?.value
  if (!sessionId) return <CartBadgeEmpty />
  const count = await cart.countItems(sessionId)
  return <Badge count={count} />
}
```

The mechanics of the shell and the holes are [ch5 · Partial Pre-Rendering](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md); what matters *for the decision* is that rung 2 stopped being a route-level trade-off in 16 and became a boundary-placement exercise.

**Rung 3 — the whole document is a function of identity.** An inbox, a dashboard, an order history, an admin console. There is no meaningful public shell beyond chrome, no SEO axis (a crawler never sees it), and no shared cache entry worth having. This is where request-time rendering is simply the right answer, argued positively in [01d](01d-the-decision-procedure-and-when-ssr-is-right.md).

## Where you read the cookie decides how much of the page prerenders

This is the single highest-leverage habit on the personalization axis, and the docs state it as a general principle:

> *"The deeper your async work sits in the tree, the more of the page can be prerendered."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

A `cookies()` call hoisted into a root layout — for a theme class on `<html>`, typically — is the most expensive line of code most applications ever write, because everything below it inherits the consequence. Under the previous model, that is the entire application rendering per request. Push the read to the leaf that needs it:

```tsx
// app/layout.tsx — the read is NOT here
import { Suspense } from 'react'
import { cookies } from 'next/headers'

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        <header>
          <Nav />
          <Suspense fallback={<AvatarSkeleton />}>
            <Avatar />
          </Suspense>
        </header>
        {children}
      </body>
    </html>
  )
}

async function Avatar() {
  const session = (await cookies()).get('sid')?.value
  if (!session) return <SignInLink />
  const user = await getUser(session)
  return <img src={user.avatarUrl} alt={user.name} width={32} height={32} />
}
```

## 🔴 `force-static` is a security decision wearing performance clothes

If you decide "this page must be static" and reach for `export const dynamic = 'force-static'`, you have not made the page static — you have made every request-time read **return nothing**. `cookies()` and `headers()` do not throw under `force-static`; they come back empty. Every branch of the form below then takes the anonymous path, at build time, and that HTML is what every visitor receives:

```tsx
// 🔴 Under `export const dynamic = 'force-static'`, this ALWAYS renders <PublicView />.
export default async function Page() {
  const session = (await cookies()).get('sid')?.value
  if (!session) return <PublicView />
  return <MemberView />
}
```

Nothing errors. No log line. The auth check silently evaluated to "logged out" — which happens to be the safe direction here, but the same mechanism will also blank a `headers()`-based tenant discriminator, a locale, or an entitlement check where the safe direction is the other way. **If what you meant was "this route must remain prerenderable", the tool that says that is `dynamic = 'error'`**, which fails the build when a request-time read appears instead of quietly returning empty. Value-by-value semantics are in [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md).

## 🔴 Geo personalization: the APIs you are about to reach for are gone

`request.ip` and `request.geo` were **removed in v15.0.0**. Any design that says "we'll render a different hero per country from `request.geo`" collapses to a single bucket the moment it ships, and — because the fallback is usually `?? 'US'` — it collapses *silently* into serving one region's content to the world.

What remains is a header read, which the platform in front of you sets under a name the Next.js documentation does not standardise. Treat it as what it is: a runtime API read, therefore a hole, therefore inside a boundary.

```tsx
// The header name is platform-specific — confirm it against YOUR host's documentation.
import { headers } from 'next/headers'

async function RegionalOffer() {
  const country = (await headers()).get('x-vercel-ip-country') ?? undefined
  return <Offer country={country} />
}
```

⚠️ I could not confirm from the Next.js documentation that any geo header name is guaranteed by the framework rather than by the hosting platform — the caching page treats `headers()` purely as *"Request headers"* and says nothing about their provenance. Do not encode a header name in shared code without checking your platform's own reference, and do not let a missing header default to a real region.

## Personalized caching: what the cache key does to your hit rate

You can cache personalized output — the documented pattern is to extract the runtime value in an uncached component and pass it into a cached one, because *"Arguments and any values captured from parent scopes automatically become part of the cache key"*:

```tsx
async function ProfileContent() {
  const session = (await cookies()).get('session')?.value
  return <CachedContent sessionId={session} />
}

async function CachedContent({ sessionId }: { sessionId: string }) {
  'use cache'
  const data = await fetchUserData(sessionId)
  return <div>{data}</div>
}
```

🔴 **The cardinality question is the whole decision.** Keying by `sessionId` gives you one cache entry per session, which is not a cache — it is a per-user memo with the write cost of a cache and none of the sharing. Key by the **class** the content actually varies over — pricing tier, currency, locale, entitlement set, feature-flag bucket — and you get a handful of entries serving all your traffic. And note where a session-keyed entry actually lives:

> *"Because `<CachedContent />` is gated behind request data, it isn't added to the prerendered static shell. At runtime it's cached in-memory by default, which doesn't persist across serverless requests, so it may re-evaluate on each request."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

> *"An App Shell that reads `cookies()` or `headers()` is session-specific, cached per session on the client rather than in the shared server cache."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

## Gotchas

**★ Symptom: an authenticated page renders its logged-out state for everybody, and nothing is logged.** Cause: `dynamic = 'force-static'` blanks `cookies()` and `headers()` rather than erroring, so the auth branch was evaluated at build time with no session. Fix: use `dynamic = 'error'` when the intent is "must stay prerenderable", so a request-time read fails the build instead of returning empty; and put the identity read behind a boundary if it genuinely belongs on the page.

**★ Symptom: the entire application went dynamic in a release that touched no page.** Cause: a `cookies()` or `headers()` read was added to the root layout — a theme class, a locale, an experiment bucket. Under the previous model that ends prerendering for every route beneath it. Fix: move the read into the leaf component that renders the affected element and wrap it in `<Suspense>`, as shown above. The forensic procedure is [ch4 · diagnosing stale and unexpectedly dynamic routes](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md).

**★ Symptom: every visitor sees the United States hero.** Cause: `request.geo` was removed in v15.0.0 and the code fell through to its default. Fix: read the platform's geo header explicitly, and make the no-header case render a neutral variant rather than a real region so the failure is visible instead of plausible.

**★ Symptom: a personalized component is cached, the hit rate is near zero, and memory use climbs.** Cause: the cache key includes a per-user argument, so every user creates an entry, and on serverless it does not even survive to be reused. Fix: key by the class the content varies over:

```tsx
async function PriceBlock() {
  const tier = await getTierFromSession()   // 'free' | 'pro' | 'enterprise'
  return <CachedPrices tier={tier} />
}

async function CachedPrices({ tier }: { tier: 'free' | 'pro' | 'enterprise' }) {
  'use cache'
  const prices = await pricing.forTier(tier)
  return <PriceTable prices={prices} />
}
```

**★ Symptom: a cached function throws `next-request-in-use-cache` in production but the build passed.** Cause: a `use cache` function — or any helper it calls — read `cookies()`, `headers()` or `searchParams`; the restriction follows the call stack, and on a dynamically rendered route it only surfaces when the route runs. Fix: extract the runtime read into the caller and pass the value in as an argument, which is the same fix as the cardinality one above, done for a different reason.

**Symptom: the dark-mode theme flashes light for a moment on every load.** Cause: the theme lives in a cookie but is applied by a Client Component after hydration. Fix: this is the honest cost of keeping the read off the server; if the flash is unacceptable, the read moves server-side and that subtree becomes a hole. Choose deliberately rather than discovering it in a bug report.

**Symptom: two users report seeing each other's data on a public page.** Cause: personalized output was placed inside a shared cache entry — a `use cache` component that closed over a request-scoped value rather than receiving it as an argument, or a fetch response cached without the discriminator in the key. Fix: nothing personalized may be reachable from a cache entry whose key does not contain the discriminator. Treat this as the one rule on this page with no acceptable trade-off.

**Symptom: prefetching became expensive after adding per-link personalization.** Cause: per-link prefetch re-renders the destination tree with the URL resolved — the docs state it plainly: *"It costs a server invocation per prefetchable link."* A dense listing page therefore multiplies invocations by the number of visible links. Fix: use the default App Shell prefetch for dense lists and reserve `prefetch={true}` for the small number of links whose destination is expensive and predictable.

## Interview questions

**★ A page is public except for a cart badge in the header. What is the right rendering pattern?**
A prerendered document with the badge behind a `<Suspense>` boundary. Under Cache Components, reading `cookies()` inside that boundary does not opt the route into dynamic rendering — the shell and its cached sections still ship in the initial HTML while the badge streams. Under the previous model the same code makes the whole route render per request, and the pragmatic alternative is to render the badge in a Client Component that fetches after hydration. Knowing which of those two answers applies to your codebase is the actual question being asked.

**★ Why is `force-static` more dangerous than `force-dynamic`?**
Because it fails silently and in a security-shaped direction. `force-dynamic` costs you performance, visibly and measurably. `force-static` makes `cookies()` and `headers()` return empty instead of throwing, so authentication, tenancy, locale and entitlement checks evaluate against nothing during prerendering and the resulting HTML is served to everyone. There is no error, no log and no failing test unless the test asserts on a signed-in render of a prerendered route. When the intent is "this route must stay prerenderable", `dynamic = 'error'` expresses it without the trap.

**★ How do you cache something that differs per user without one entry per user?**
By keying on the class the content varies over rather than on identity. Read the session in an uncached component, derive the discriminator — tier, currency, locale, feature bucket — and pass only that into the cached function, because arguments and captured values form the cache key. A three-tier price table then has three entries no matter how many customers you have. Keying by user id produces one entry per user, which on serverless may not survive to be read even once.

**★ Someone proposes rendering a different homepage per country. What do you tell them?**
That the API they are picturing does not exist any more: `request.ip` and `request.geo` were removed in v15.0.0. The remaining mechanism is a platform-set request header read through `headers()`, whose name is not standardised by Next.js, and reading it is a runtime access — so the regional part becomes a hole in an otherwise prerendered page, not a reason to render the whole page per request. I would also insist the no-header case render a neutral variant, because a default of `'US'` turns a missing header into a silent content bug rather than a visible one.

**Where should a `cookies()` call live, and why does it matter more than which flag you set?**
In the leaf component that renders the thing the cookie affects. Everything from that call upward loses the ability to prerender, so hoisting it into a layout converts a personalized badge into a per-request application. The documentation states the general form — the deeper the async work sits, the more of the page can be prerendered — and it applies identically to `headers()`, `searchParams` and data fetches. No segment config value recovers what a badly-placed read costs you.

**What does PPR actually change about this decision, as opposed to how it renders?**
It changes the unit. Before, personalization was a property of a route, so one personalized element made the route dynamic and the decision was binary and political. With PPR as the default under Cache Components, personalization is a property of a subtree, so the question stops being "is this page static or dynamic" and becomes "what is in the shell and what is in the holes" — which is a question a team can answer per component, incrementally, without a meeting.

---

← [Data velocity](01b-data-velocity-and-the-staleness-budget.md) · [Chapter index](01-explanation.md) · Next → [The decision procedure](01d-the-decision-procedure-and-when-ssr-is-right.md)
