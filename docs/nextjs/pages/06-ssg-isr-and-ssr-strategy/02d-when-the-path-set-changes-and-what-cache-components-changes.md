---
title: "Cache Components deletes `dynamicParams` and replaces the enumerate-everything-or-404 choice with an App Shell, which means the scale question stops being *how many paths do I prerender* and becomes *how much of the page is param-free*"
sidebar_label: "02d · What Cache Components changes"
sidebar_position: 14
description: "generateStaticParams under Cache Components: the removed dynamicParams flag, App Shells for unlisted params, why an empty array is now a build error, the await-below-the-Suspense-boundary rule, and how prefetch counts as the first visit."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Incremental Static Regeneration with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components) (docs `lastUpdated` 2026-08-03) and [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, React 19.2.8, Node >= 20.9. Documentation-verified; **no sandbox run** — `next` is not installed in this checkout.

**🔴 The previous three chunks tune an API that `v16.0.0` removes under one flag. With `cacheComponents: true`, `dynamicParams` — along with `dynamic`, `revalidate` and `fetchCache` — is gone, so the "enumerate the head and 404 the tail" lever that [02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) built its decision table around does not exist. That is not a loss, because the choice it forced was a bad one: complete enumeration or a slow first visit or a 404, pick one. Cache Components replaces it with a third outcome. The build prerenders two things — the param-specific pages you listed, and an *App Shell* that is the part of the page not derived from URL data — and a visit to an unlisted URL gets the shell instantly, then a background upgrade. `generateStaticParams` survives, with the same signature and the same execution rules, but its job changes: it no longer decides which URLs work, only which ones are fully ready. The scale question moves with it, from "how many paths can I afford to prerender" to "how much of this page can I render without knowing the params".**

## The mechanism, in the docs' words

Enable both flags. One produces the shell, the other upgrades it:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
```

> *"During build, Partial Prerendering splits each render into two parts: The **App Shell**: the generic, reusable part of the page that doesn't depend on URL data; and the rest of the statically renderable content: the param-specific prerenders for the URLs you list in `generateStaticParams`."*

> *"For a visit to a URL whose params were included in `generateStaticParams`, Next.js serves the fully prerendered page from the cache. For a visit to a URL whose params weren't, Next.js serves the App Shell instantly, then upgrades it in the background with the now-known params. Subsequent visits to that URL get the upgraded result from the cache, skipping the App Shell entirely."*

> *"If you have used ISR or `fallback: true` in the Pages Router, this is the Cache Components equivalent."*
> — [ISR with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components)

⚠️ **Version boundary:** *"The App Shell for unlisted params is served from Next.js 16.3. Earlier versions wait for a full server render before sending the response."* On 16.2 and below with Cache Components on, an unlisted URL is a full blocking render — which is the old on-demand behaviour, not the shell. The mechanics of the caching model itself belong to [ch5 · the three cache directives](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/README.md), and specifically to [ch5 · choosing a directive](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md), which treats the choice as a data-placement decision rather than a syntax one.

## The decision table from [02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md), rewritten

| Enumeration | Previous model, `dynamicParams` | Cache Components |
|---|---|---|
| Complete | Any value; no unlisted URLs exist | Fully prerendered pages; the shell is built but rarely used |
| Partial | `true` — unlisted URL renders on first request, visitor waits | Unlisted URL gets the **App Shell instantly**, content streams, background upgrade |
| Partial | `false` — unlisted URL **404s** | 🔴 **No equivalent.** The flag is removed |

The row that disappears is the one that was most often set by accident. If you genuinely need a closed param set — locales, plan tiers, a fixed report list — Cache Components does not give you a flag for it, so you enforce it in the page, which is where the check arguably always belonged:

```tsx
// app/[locale]/page.tsx — the closed-set guarantee, in code rather than in config
import { notFound } from 'next/navigation'

const LOCALES = ['en', 'de', 'fr', 'ja'] as const
type Locale = (typeof LOCALES)[number]

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default async function Page({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  if (!LOCALES.includes(locale as Locale)) notFound()
  return <Home locale={locale as Locale} />
}
```

This is strictly better than the flag in one respect and worse in another. Better: the rule is in the file you read when you ask "what values are valid", it is testable, and it survives a config change. Worse: it is a runtime check, so an unlisted URL still costs a shell render before it 404s, where `dynamicParams = false` refused at the routing layer.

## An empty array is now a build error

> *"When using Cache Components with dynamic routes, `generateStaticParams` must return **at least one param**. Empty arrays cause a build error. This allows Cache Components to validate your route doesn't incorrectly access `cookies()`, `headers()`, or `searchParams` at runtime."*

The reason is worth reading twice: **the build needs one real param so it can attempt a prerender and discover whether your route illegally reads request-time state.** With an empty array there is nothing to prerender, so nothing is validated, and the failure moves to production. That makes the `[]` idiom from the previous model — "prerender nothing, let everything arrive on demand" — an error rather than a strategy, and it makes the defensive `catch { return [] }` from [02b](02b-enumerating-from-a-database-at-build-time.md) a build-breaker instead of a graceful degradation.

The documented escape hatch comes with its own warning attached:

> *"If you don't know the actual param values at build time, you can return a placeholder param (e.g., `[{ slug: '__placeholder__' }]`) for validation, then handle it in your page with `notFound()`. However, this prevents build time validation from working effectively and may cause runtime errors."*

```ts
// A CMS outage must not break the deploy — but say what you gave up.
export async function generateStaticParams() {
  try {
    const slugs = await hotPostSlugs()
    if (slugs.length > 0) return slugs.map((slug) => ({ slug }))
  } catch (err) {
    console.error('[generateStaticParams] enumeration failed', err)
  }
  // Placeholder keeps the build alive. It also disables the prerender-time
  // validation that would have caught an illegal cookies()/headers() read,
  // so this path must be alerted on, not tolerated.
  return [{ slug: '__placeholder__' }]
}
```

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

export default async function Page({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params
  if (slug === '__placeholder__') notFound()
  return <Post slug={slug} />
}
```

🔴 **Do not leave that as the normal path.** It converts a build-time guarantee into a runtime hope, exactly as the doc warns. It is an incident mitigation with an alert attached, not a design.

## The rule that decides whether a shell exists at all

This is the sentence that determines whether any of the above works, and it is easy to violate without noticing:

> *"Notice that `CategoryLayout` does not `await props.params` itself. Instead, it passes the `params` promise to `CategoryHeader` inside `<Suspense>`. The `await` happens inside the boundary, so for unknown categories Next.js can still generate the App Shell. Keep the read inside the boundary even for the categories `generateStaticParams` covers. A statically known param still belongs to one URL, so awaiting it above the Suspense boundary would tie this layout's App Shell to that URL."*

**Awaiting `params` above a Suspense boundary destroys the shell for that segment.** The shell is by definition the part of the render that does not depend on URL data; the moment the component tree above the boundary reads a param, it does, and there is nothing generic left to prerender.

```tsx
// app/[category]/layout.tsx — 🔴 kills the App Shell for every unlisted category
export default async function CategoryLayout({ params, children }: LayoutProps<'/[category]'>) {
  const { category } = await params        // ← the await is above every boundary
  const data = await getCategory(category)
  return (
    <div>
      <h1>{data?.name ?? 'Category'}</h1>
      {children}
    </div>
  )
}
```

```tsx
// app/[category]/layout.tsx — the documented shape: the await lives inside <Suspense>
import { Suspense } from 'react'
import Link from 'next/link'
import { getCategory } from '../lib/data'

async function CategoryHeader({ params }: Pick<LayoutProps<'/[category]'>, 'params'>) {
  const { category } = await params
  const data = await getCategory(category)
  return (
    <div>
      <Link href="/">&larr; All categories</Link>
      <h1>{data?.name ?? 'Category'}</h1>
      {data?.description && <p>{data.description}</p>}
    </div>
  )
}

export default function CategoryLayout(props: LayoutProps<'/[category]'>) {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <CategoryHeader params={props.params} />
      </Suspense>
      {props.children}
    </div>
  )
}
```

Note the passing of the *promise*, unawaited, across the boundary. That is the whole technique. And note the docs' instruction to do it **even for params you did enumerate** — the shell is per-route, not per-URL, so one component awaiting above the boundary removes it for the unlisted URLs too.

The same rule applies to request-time reads: *"If your components access runtime APIs like `cookies` or `headers`, wrap them in `<Suspense>`. Their fallback UI is included in the static shell instead."*

## What the build produces, and what the upgrade produces

For `app/[category]/[product]` with two categories and one product each, the documented build output is five artifacts:

- `/tops/tee`, `/shorts/joggers` — fully static, both params known
- `/tops/[product]`, `/shorts/[product]` — category header rendered, product shows the fallback
- `/[category]/[product]` — both show the fallback

That middle row is the interesting one. **The shell is not a single generic page; it is one per level of resolved params**, so enumerating the parent still buys you a better shell for the children even when you enumerate none of the children. This is the Cache Components answer to the per-parent budgeting problem [02c](02c-nested-segments-and-the-combinatorial-explosion.md) solved with N+1 queries: enumerate 40 categories and zero products, and every product URL in those categories renders with its category header already there.

After the first visit the background upgrade runs, and its outcome depends on your code, not on your enumeration:

> *"If every data access is cached and all params are resolved, the upgrade produces a **fully static page**."*
> *"If all params are resolved but the render still hits uncached data or runtime APIs (`cookies`, `headers`) wrapped in `<Suspense>` boundaries, the upgrade produces a **cached page with those fallbacks**."*
> *"Params are resolved in route order. A param value not returned by `generateStaticParams` stays unresolved and prevents any deeper params from upgrading."*

🔴 **The third sentence is a real constraint on nested routes:** an unresolved parent blocks the child. Enumerating products under a category you did not enumerate gains you nothing, which reverses the usual instinct to optimise the leaf.

## Prefetch counts as the first visit

> *"A prefetch counts as that first visit. When a `<Link>` to an unlisted URL enters the viewport, or you call `router.prefetch`, Next.js starts the background upgrade before the click, so navigation lands on the upgraded result."*

This is the sentence that changes how you think about the hot set. A category page listing 40 products triggers 40 upgrades as those links scroll into view — so **the navigation graph does the enumeration for you, lazily, driven by real attention rather than by a ranking query.** The head of your traffic distribution warms itself.

It also means an unlisted URL's upgrade cost is paid at prefetch time by a user who may never click, and on a platform with per-request billing that is compute you are paying for. It is the same trade as prerendering, moved from build time to runtime and targeted by actual browsing. Usually a much better trade; not a free one.

## Gotchas

**★ Symptom: after enabling Cache Components, unlisted URLs still block on a full render instead of showing a shell.** Cause: one of three things. `partialPrefetching` is not enabled — both flags are required, one produces the shell and the other upgrades it. Or you are below **16.3**, where *"Earlier versions wait for a full server render before sending the response."* Or a component above every Suspense boundary awaits `params`. Fix: check the config first, the version second, and then hunt the `await params` that sits above the boundary.

**★ Symptom: the build fails with `empty-generate-static-params`.** Cause: an empty array, which was the documented idiom in the previous model and is a build error under Cache Components, because the framework needs at least one param to attempt a prerender and validate that the route does not illegally read `cookies()`, `headers()` or `searchParams`. Fix: enumerate at least one real param. Use the `'__placeholder__'` escape hatch only as an incident mitigation with an alert, because the docs are explicit that it *"prevents build time validation from working effectively and may cause runtime errors."*

**★ Symptom: `export const dynamicParams = false` has stopped having any effect.** Cause: `v16.0.0` removes `dynamicParams` — along with `dynamic`, `revalidate` and `fetchCache` — when `cacheComponents` is enabled. It is not deprecated with a warning; the model it belonged to is gone. Fix: enforce the closed set inside the page with an explicit membership check and `notFound()`, as shown above. Accept that this is a runtime refusal rather than a routing-layer one.

**★ Symptom: the App Shell renders but is nearly empty, so the "instant" first visit shows a skeleton and nothing else.** Cause: everything worth rendering is below a Suspense boundary because everything depends on params, directly or through a helper. Fix: this is a page-design problem, not a config problem — move the param-free chrome (navigation, category header when the category *is* enumerated, footer, layout scaffolding) above the boundaries, and give the boundaries real skeletons rather than the word "Loading". Enumerating the parent level is the cheapest single improvement, because it upgrades `/[category]/[product]` to `/tops/[product]` with the header already rendered.

**★ Symptom: you enumerated products but they never upgrade to fully static.** Cause: *"A param value not returned by `generateStaticParams` stays unresolved and prevents any deeper params from upgrading."* If the parent category was not enumerated, the child cannot resolve. Fix: enumerate top-down — parents first. In nested routes the parent level is where enumeration pays, which is the opposite of the previous model's instinct to enumerate the leaf.

**Symptom: a `catch { return [] }` that used to protect deploys now breaks them.** Cause: the same change — `[]` is a build error under Cache Components. Fix: return a placeholder handled with `notFound()`, and alert on the code path so the degraded validation is visible rather than permanent.

**Symptom: compute cost went up after enabling `partialPrefetching`, with no traffic increase.** Cause: a prefetch counts as the first visit and starts the background upgrade, so links entering the viewport do render work for clicks that may never happen. Fix: this is usually the right trade — it warms exactly the URLs users are looking at — but if it is not, reduce the number of unlisted URLs on high-density listing pages by enumerating them, or control prefetching at the `<Link>` level.

**Symptom: a helper deep in the tree reads `cookies()` and the whole shell collapses.** Cause: the restriction follows the call stack — a component above a boundary that calls a helper that reads request-time state has read request-time state. Fix: wrap that subtree in `<Suspense>`, since *"Their fallback UI is included in the static shell instead"*, and put the read inside the boundary rather than trying to hoist the value.

## Interview questions

**★ Cache Components removes `dynamicParams`. What replaces the guarantee it gave you?**
Nothing at the routing layer, and that is the honest answer. `dynamicParams = false` refused unlisted URLs before any of your code ran. Under Cache Components there is no such flag, so a closed param set is enforced in the page: check membership against the list and call `notFound()`. The check is more visible and more testable — it lives next to the list of valid values instead of in a config export — but it is a runtime refusal, so an unlisted URL still costs a shell render before it 404s. What you gain in exchange is the row of the table that mattered more: partial enumeration no longer means either a 404 or a slow first visit, because unlisted URLs get an App Shell immediately and a background upgrade after.

**★ Why is an empty `generateStaticParams` an error under Cache Components when it was an idiom before?**
Because the empty array leaves nothing to prerender, and prerendering is how the framework validates the route. The documented reason is that at least one param *"allows Cache Components to validate your route doesn't incorrectly access `cookies()`, `headers()`, or `searchParams` at runtime."* With no param, no prerender is attempted, no validation happens, and an illegal request-time read that would have failed the build fails in production instead. That is also why the documented placeholder escape hatch carries a warning: it satisfies the count but defeats the purpose, so it belongs in an incident path with an alert, not in normal operation.

**★ What does "await the params inside the Suspense boundary" actually buy you?**
The App Shell. The shell is defined as the part of the render that does not depend on URL data, so any component above every boundary that reads `params` ties the render to one specific URL and there is no generic output left to cache. The technique in the docs is to pass the unawaited `params` promise down into a component inside `<Suspense>` and await it there. The instruction that surprises people is that you should do this *even for params you did enumerate*, because the shell is per-route rather than per-URL — one hoisted `await` removes the shell for every unlisted URL on that route, including ones you never thought about.

**★ How does the scale question change under Cache Components?**
It stops being about the size of the array. In the previous model the only lever was how many paths you could afford to prerender, with a bad tail on either side of the choice. Under Cache Components, an unlisted URL is fast anyway — shell instantly, content streams, upgrade in the background, cached for the next visitor — so the marginal value of prerendering one more path drops sharply. The lever that replaces it is structural: how much of the page can render without knowing the params. A page whose chrome, navigation and category header are all above the boundaries has a useful shell and barely needs enumeration; a page where everything depends on the param has a shell that is a skeleton, and no amount of enumeration fixes the URLs you did not list. The second lever is which *level* you enumerate, because an unresolved parent blocks its children from upgrading — so enumeration pays at the top of a nested route, not at the leaf.

**How does prefetching interact with all this?**
A prefetch counts as the first visit: when a `<Link>` to an unlisted URL enters the viewport, or you call `router.prefetch`, the background upgrade starts before the click, so the navigation lands on the upgraded result rather than the shell. Practically, the navigation graph performs enumeration for you, lazily and driven by where users are actually looking — the head of the traffic distribution warms itself without a ranking query. The cost is that the upgrade is paid for links that may never be clicked, which on per-request billing is real compute. It is the same trade as prerendering, relocated from build time to runtime and aimed by attention instead of by a `LIMIT`.

**When would you still enumerate a large number of paths under Cache Components?**
When the first visit genuinely cannot be a shell. Pages where the crawlable content *is* the param-specific content and you need it in the initial HTML for a search engine rather than streamed; pages under an SLA that names time-to-content rather than time-to-first-byte; and content that is expensive enough to render that you would rather pay for it once in CI than at unpredictable moments in production. Outside those, the Cache Components guide's position holds — routes never visited before the next deploy were prerendered for nobody, and every one of them increased build work and produced output that had to be stored and deployed.

---

← [02c · Nested segments and combinatorics](02c-nested-segments-and-the-combinatorial-explosion.md) · [Chapter index](01-explanation.md) · Next → [03 · ISR at enterprise level](03-isr-at-enterprise-level-stale-while-revalidate-tuning.md)
