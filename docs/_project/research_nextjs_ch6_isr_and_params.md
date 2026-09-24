---
name: research-nextjs-ch6-isr-and-params
description: Banked primary-source research for the Next.js track chapter 6 (SSG/ISR/SSR strategy) — generateStaticParams at scale, ISR revalidate tuning, stale-while-revalidate semantics, the stampede question (UNSETTLED), multi-instance cache handlers, cacheLife stale/revalidate/expire, and ISR under Cache Components. Fetched 2026-09-04 against Next.js 16.3.4. Do not re-fetch for chapter 6.
metadata:
  type: reference
  track: nextjs
  gathered: 2026-09-04
---

# Next.js chapter 6 — banked research, 2026-09-04

**Target: Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor.** Every doc below carried
`version: 16.3.4` in its `.md` frontmatter. Fetch trick (from the ch15 bank): append `.md`
to any `nextjs.org/docs/...` path to get clean Markdown with `version:` and `lastUpdated:`.

**All five URLs below resolved.** `next` is NOT installed in the devbible checkout —
`require('next/package.json')` throws `MODULE_NOT_FOUND`, so no T1 probe of the package is
possible. `react` probes at 19.2.8. Everything here is T2 (doc read) or T0 (verbatim quote).

---

## 1 · `generateStaticParams` — <https://nextjs.org/docs/app/api-reference/functions/generate-static-params> (`lastUpdated: 2026-08-25`)

Usable in `page`, `layout` **and** `route` (Route Handlers). Introduced `v13.0.0`; the
version-history table has exactly one row.

**The five Good-to-knows, verbatim:**

> *"During `next dev`, `generateStaticParams` will be called when you navigate to a route."*
> *"During `next build`, `generateStaticParams` runs before the corresponding Layouts or Pages are generated."*
> *"During revalidation (ISR), `generateStaticParams` will not be called again."*
> *"`generateStaticParams` replaces the `getStaticPaths` function in the Pages Router."*
> *"You must return an empty array from `generateStaticParams` or utilize `export const dynamic = 'force-static'` in order to revalidate (ISR) paths at runtime."*

**Return shapes (table):** `/product/[id]` → `{ id: string }[]` · `/products/[category]/[product]` → `{ category: string, product: string }[]` · `/products/[...slug]` → `{ slug: string[] }[]`.

**Partial enumeration — the load-bearing sentence for a scale page:**

> *"To statically render a subset of paths at build time, and the rest the first time they're visited at runtime, return a partial list of paths"*

Doc's own example is `posts.slice(0, 10)` with the comment `// Render the first 10 posts at build time`, and a second variant adding `export const dynamicParams = false` under the comment `// All posts besides the top 10 will be a 404`.

**All paths at runtime:**

> *"You must always return an array from `generateStaticParams`, even if it's empty. Otherwise, the route will be dynamically rendered."*

**Cache Components:**

> *"When using Cache Components with dynamic routes, `generateStaticParams` must return at least one param. Empty arrays cause a build error. This allows Cache Components to validate your route doesn't incorrectly access `cookies()`, `headers()`, or `searchParams` at runtime."*

> *"If you don't know the actual param values at build time, you can return a placeholder param (e.g., `[{ slug: '__placeholder__' }]`) for validation, then handle it in your page with `notFound()`. However, this prevents build time validation from working effectively and may cause runtime errors."*

Error page referenced: `/docs/messages/empty-generate-static-params`.

**`dynamicParams = false`:**

> *"To prevent unspecified paths from being prerendered at runtime, add the `export const dynamicParams = false` option in a route segment. When this config option is used, only paths provided by `generateStaticParams` will be served, and unspecified routes will 404 or match (in the case of catch-all routes)."*

**Nested segments — the combinatorics rules:**

> *"You can generate params for dynamic segments above the current layout or page, but **not below**."*

> *"If multiple dynamic segments in a route use `generateStaticParams`, the child `generateStaticParams` function is executed once for each set of `params` the parent generates."*

> *"A child route segment's `generateStaticParams` function is executed once for each segment a parent `generateStaticParams` generates."*

> *"Notice that the params argument can be accessed synchronously and includes only parent segment params."*

Two documented approaches: **bottom up** (child returns both `category` and `product`, one
query) and **top down** (parent layout returns `category`, child is invoked per category and
receives `{ params: { category } }`).

**Memoization across generate functions:**

> *"`fetch` requests are automatically memoized for the same data across all `generate`-prefixed functions, Layouts, Pages, and Server Components. React `cache` can be used if `fetch` is unavailable."*

Type helper documented: `params: Awaited<LayoutProps<'/products/[category]'>['params']>`.

Root params: *"When a parent dynamic segment is a root parameter, you can also read it inside a nested `generateStaticParams` by calling its getter from the `next/root-params` module."*

---

## 2 · ISR guide — <https://nextjs.org/docs/app/guides/incremental-static-regeneration> (`lastUpdated: 2026-06-23`)

Scoped: *"This guide covers ISR without Cache Components. If you are using `cacheComponents`, see ISR with Cache Components instead."*

**The four bullets ISR enables (verbatim list) — the last one is the whole scale argument:**

> *"Update static content without rebuilding the entire site"*
> *"Reduce server load by serving prerendered, static pages for most requests"*
> *"Ensure proper `cache-control` headers are automatically added to pages"*
> *"Handle large amounts of content pages without long `next build` times"*

**The seven-step walkthrough, verbatim (steps 4–7 are the tuning spine):**

> *"4. After 60 seconds has passed, the next request will still return the cached (now stale) page"*
> *"5. The cache is invalidated and a new version of the page begins generating in the background"*
> *"6. Once generated successfully, the next request will return the updated page and cache it for subsequent requests"*
> *"7. If `/blog/26` is requested, and it exists, the page will be generated on-demand. This behavior can be changed by using a different `dynamicParams` value. However, if the post does not exist, then 404 is returned."*

**🔴 The framework's own tuning recommendation:**

> *"We recommend setting a high revalidation time. For instance, 1 hour instead of 1 second. If you need more precision, consider using on-demand revalidation. If you need real-time data, consider switching to dynamic rendering."*

**Time-based SWR prose:**

> *"After an hour has passed, the next visitor will still receive the cached (stale) version of the page immediately for a fast response. Simultaneously, Next.js triggers regeneration of a fresh version in the background. Once the new version is successfully generated, it replaces the cached version, and subsequent visitors will receive the updated content."*

**On-demand is lazy, not eager:**

> *"`revalidatePath` invalidates the cache entries but regeneration happens on the next request. If you want to eagerly regenerate the cache entry immediately instead of waiting for the next request, you can use the Pages router `res.revalidate` method. We're working on adding new methods to provide eager regeneration capabilities for the App Router."*

**Failure during regeneration:**

> *"If an error is thrown while attempting to revalidate data, the last successfully generated data will continue to be served from the cache. On the next subsequent request, Next.js will retry revalidating the data."*

**Caveats — all seven, verbatim, and every one is load-bearing at enterprise scale:**

> *"ISR is only supported when using the Node.js runtime (default)."*
> *"ISR is not supported when creating a Static Export."*
> *"If you have multiple `fetch` requests in a prerendered route, and each has a different `revalidate` frequency, the lowest time will be used for ISR. However, those revalidate frequencies will still be respected by the cache."*
> *"If any of the `fetch` requests used on a route have a `revalidate` time of `0`, or an explicit `no-store`, the route will be dynamically rendered."*
> *"Proxy won't be executed for on-demand ISR requests, meaning any path rewrites or logic in Proxy will not be applied. Ensure you are revalidating the exact path. For example, `/post/1` instead of a rewritten `/post-1`."*
> *"When running multiple instances, the default file-system cache is per-instance. On-demand revalidation only invalidates the instance that receives the call. Use a shared custom cache handler to coordinate across instances."*
> *"Background regeneration (stale-while-revalidate) runs on the instance that receives the triggering request. On platforms with per-request billing, this background work counts as additional compute."*

**🔴 Observability — the header, verbatim:**

> *"You can use the `x-nextjs-cache` response header to observe cache behavior. Values are `HIT` (served from cache), `STALE` (served from cache, revalidating in background), `MISS` (not in cache, rendered fresh), or `REVALIDATED` (regenerated via on-demand revalidation)."*

**Local debugging:** `NEXT_PRIVATE_DEBUG_CACHE=1` — *"This will make the Next.js server console log ISR cache hits and misses."* Plus `logging: { fetches: { fullUrl: true } }` in `next.config.js`.

**Platform support table:** Node.js server Yes · Docker container Yes · Static export **No** · Adapters platform-specific.

**Version history:** `v14.1.0` custom `cacheHandler` stable · `v13.0.0` App Router · `v12.2.0` Pages Router on-demand ISR stable · `v12.0.0` bot-aware ISR fallback · `v9.5.0` stable ISR introduced.

---

## 3 · How revalidation works — <https://nextjs.org/docs/app/guides/how-revalidation-works> (`lastUpdated: 2026-06-01`)

**The two kinds, verbatim:**

> *"Time-based revalidation uses a stale-while-revalidate pattern. The cached content is served immediately, and a background regeneration is triggered when the content's age exceeds the `cacheLife` or `revalidate` duration. The stale content continues to be served until the fresh content is ready."*

> *"On-demand revalidation explicitly invalidates cached content by calling `revalidateTag()` or `revalidatePath()`. The next request to that content triggers a fresh render."*

**🔴 `cacheHandler` singular vs `cacheHandlers` plural:**

> *"Pages Router on-demand ISR APIs (for example `res.revalidate()` and the `x-prerender-revalidate` flow) are still supported and use the server cache handler (`cacheHandler`, singular). The `cacheHandlers` option (plural) is for `'use cache'` directives."*

**Both artifacts:**

> *"When a route is revalidated, Next.js regenerates **both** the HTML response and the RSC payload ... from the same React component tree. Both artifacts are stored together in the same cache entry."*
> *"If a platform's cache serves HTML from one render and an RSC payload from a different render, users may see stale or mismatched content during client-side navigation."*
> *"Do not cache HTML and RSC payload responses separately with different TTLs."*

**Soft tags:** auto-generated, prefixed `_N_T_`. `/blog/hello` → `_N_T_/layout`, `_N_T_/blog/layout`, `_N_T_/blog/hello/layout`, `_N_T_/blog/hello`. This is how `revalidatePath` rides the tag system.

**Multi-instance, verbatim:**

> *"When running multiple Next.js instances behind a load balancer, revalidation events are local by default. Calling `revalidateTag()` on instance A only invalidates the cache on that instance. Other instances continue serving the stale content until they learn about the invalidation."*

> *"`updateTags()` is called when `revalidateTag()` is invoked. Your handler should write the invalidation event to shared storage (for example, Redis or a database) so other instances can discover it."*

> *"`refreshTags()` is called periodically, but always before starting a new request. Your handler should check shared storage for recent invalidation events and update its local tag state accordingly."*

> *"Your handler must catch errors in `refreshTags()`: if it throws, the exception propagates as a request failure. Catching the error allows requests to continue with the last known local tag state, serving potentially stale content until connectivity is restored."*

> *"Without coordination, each instance independently serves content and handles revalidation using only its local cache. Different users may see different content depending on which instance serves their request, and on-demand revalidation only takes effect on the instance that received the call."*

**Graceful degradation, verbatim:**

> *"Cache write failure: the response is still served to the user because writes are asynchronous. The cache entry is lost, and the next request triggers a fresh render."*
> *"Cache read failure: your handler should catch internal errors and return `undefined` (the cache miss signal). ... A thrown error is not treated as a cache miss; it propagates as a render error, so always return `undefined` to signal a miss."*
> *"Cache failures result in degraded performance (stale content, extra renders), not broken applications."*
> *"The revalidation system prioritizes availability over strict consistency."*

**Cross-deployment skew:** `deploymentId` — *"when the client detects a different deployment ID from the server, it triggers a hard navigation to fetch consistent content."*

---

## 4 · 🔴🔴 THE STAMPEDE QUESTION — NOT SETTLED BY THE DOCS

**Searched:** the ISR guide, `how-revalidation-works` (explicitly written "for platform
engineers ... who need to understand the system to implement custom cache handlers"), and
`cacheLife`. **None of the three states whether concurrent requests to one stale entry
trigger one background regeneration or N.** No mention of a lock, single-flight,
coalescing, deduplication, in-flight tracking or a thundering herd anywhere in the three
pages.

**What the docs DO settle, and it is most of what matters:**

1. On the **stale** path nobody blocks — *"The stale content continues to be served until the
   fresh content is ready."* So the classic form of the stampede (N concurrent **blocking**
   renders) cannot occur while a stale copy exists.
2. The blocking paths are named and are where a herd is genuinely possible:
   - `expire` elapsed with no traffic — *"the server regenerates content synchronously on the
     next request"* (`cacheLife` doc).
   - `updateTag` — *"The next request will wait to fetch fresh data rather than serving stale
     content from the cache."* (ch15 bank §6.)
   - `revalidateTag(tag, { expire: 0 })` — *"stale never served; next request is a blocking
     revalidate/cache miss."* (ch15 bank §5.)
   - A cold cache: a new deploy, since *"Neither caching directive carries over to a new
     deploy, because the cache key includes the build (or `deploymentId`) ID."* (ch15 bank §3.)
3. `revalidateTag(tag, 'max')` is the documented stampede-safe lever — *"requests always
   served stale while revalidating."*
4. Per-instance amplification is documented — *"Background regeneration ... runs on the
   instance that receives the triggering request."*

**🔴 The pages must say the dedup question is unsettled rather than assert a lock.**

---

## 5 · ISR with Cache Components — <https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components> (`lastUpdated: 2026-08-03`)

Needs **both** `cacheComponents: true` and `partialPrefetching: true`.

**The split, verbatim:**

> *"During build, Partial Prerendering splits each render into two parts: The **App Shell**: the generic, reusable part of the page that doesn't depend on URL data; and the rest of the statically renderable content: the param-specific prerenders for the URLs you list in `generateStaticParams`."*

> *"For a visit to a URL whose params were included in `generateStaticParams`, Next.js serves the fully prerendered page from the cache. For a visit to a URL whose params weren't, Next.js serves the App Shell instantly, then upgrades it in the background with the now-known params. Subsequent visits to that URL get the upgraded result from the cache, skipping the App Shell entirely."*

> *"If you have used ISR or `fallback: true` in the Pages Router, this is the Cache Components equivalent."*

**🔴 The await-below-the-boundary rule:**

> *"Notice that `CategoryLayout` does not `await props.params` itself. Instead, it passes the `params` promise to `CategoryHeader` inside `<Suspense>`. The `await` happens inside the boundary, so for unknown categories Next.js can still generate the App Shell. Keep the read inside the boundary even for the categories `generateStaticParams` covers. A statically known param still belongs to one URL, so awaiting it above the Suspense boundary would tie this layout's App Shell to that URL."*

**What the upgrade produces:**

> *"If every data access is cached and all params are resolved, the upgrade produces a **fully static page**."*
> *"If all params are resolved but the render still hits uncached data or runtime APIs (`cookies`, `headers`) wrapped in `<Suspense>` boundaries, the upgrade produces a **cached page with those fallbacks**."*
> *"Params are resolved in route order. A param value not returned by `generateStaticParams` stays unresolved and prevents any deeper params from upgrading."*

**Prefetch counts as the first visit:**

> *"A prefetch counts as that first visit. When a `<Link>` to an unlisted URL enters the viewport, or you call `router.prefetch`, Next.js starts the background upgrade before the click, so navigation lands on the upgraded result."*

> *"The App Shell for unlisted params is served from Next.js 16.3. Earlier versions wait for a full server render before sending the response."*

**🔴 "Choosing what to prerender" — the whole scale thesis, verbatim:**

> *"Not every route needs to be prerendered. Every page you prerender increases build work and produces output that has to be stored and deployed. Many routes may never be visited before your next deployment, making that work unnecessary."*

> *"Instead, use `generateStaticParams` to prerender the routes that benefit most from being ready ahead of time, such as popular pages or predictable content. Less frequently visited routes are generated on demand and upgraded after their first visit, so you don't spend build time and storage on pages that may never be requested."*

**Pages Router mapping:** `fallback: true` → the default with `cacheComponents` ·
`router.isFallback` not needed · `getStaticProps` + `revalidate` → `'use cache'` + `cacheLife`
· `getStaticPaths` → `generateStaticParams`.

Self-hosting note: keep an existing ISR `cacheHandler` **alongside** `cacheHandlers` for
`'use cache'`.

---

## 6 · `cacheLife` — <https://nextjs.org/docs/app/api-reference/functions/cacheLife> (`lastUpdated: 2026-08-25`)

**The three properties, verbatim:**

> *"`stale`: How long the client can use cached data without checking the server"*
> *"`revalidate`: After this time, the next request will trigger a background refresh"*
> *"`expire`: After this time with no requests, the next one waits for fresh content"*

`expire` detail: *"After this period with no traffic, the server regenerates content synchronously on the next request"* and *"When you set both `revalidate` and `expire`, `expire` must be longer than `revalidate`. Next.js validates this and raises an error for invalid configurations."*

**Preset table (exact):**

| Profile | Use case | `stale` | `revalidate` | `expire` |
|---|---|---|---|---|
| `default` | Standard content | 5 minutes | 15 minutes | never |
| `seconds` | Real-time data | 30 seconds | 1 second | 1 minute |
| `minutes` | Frequently updated content | 5 minutes | 1 minute | 1 hour |
| `hours` | Content updated multiple times per day | 5 minutes | 1 hour | 1 day |
| `days` | Content updated daily | 5 minutes | 1 day | 1 week |
| `weeks` | Content updated weekly | 5 minutes | 1 week | 30 days |
| `max` | Stable content that rarely changes | 5 minutes | 30 days | 1 year |

**Client cache:** *"The `stale` property controls the Client Cache, not the `Cache-Control` header"*; sent via `x-nextjs-stale-time`; *"**Minimum of 30 seconds is enforced** to ensure prefetched links remain usable"*; *"This 30-second minimum prevents prefetched data from expiring before users can click on links. It only applies to time-based expiration."* Calling `revalidateTag`/`revalidatePath`/`updateTag`/`refresh` from a Server Action *"immediately cleared"* the entire client cache, bypassing stale time.

**🔴 Prerendering thresholds, verbatim:**

> *"`revalidate` of `0`, or `expire` under 5 minutes: excluded from prerenders, becoming a 'dynamic hole' resolved at request time."*
> *"`stale` under 30 seconds: excluded from prerenders, because a prefetch would expire before the user could click."*
> *"`stale` of at least 30 seconds but under 5 minutes: included in prerenders, but excluded from the route's App Shell."*
> *"Of the presets, only `seconds` falls under any of these thresholds: its `expire` of 1 minute excludes it from prerenders."*

**Nesting:**

> *"The outer cache uses its own lifetime, regardless of inner cache lifetimes. ... An explicit `cacheLife` always takes precedence, whether it's longer or shorter than inner lifetimes."*
> *"If you don't call `cacheLife` in the outer cache, it uses the `default` profile (15 min revalidate). Inner caches with shorter lifetimes can reduce the outer cache's `default` lifetime. Inner caches with longer lifetimes cannot extend it beyond the default."*
> *"When a short-lived cache is nested inside another `use cache` without an explicit `cacheLife`, the outer cache's lifetime would silently become short too via propagation. To prevent this accidental misconfiguration, Next.js throws an error during prerendering."*
> *"Note that the nested cache may not be obvious — it could be in an imported module or even a third-party dependency"*

**Other rules:** `cacheLife` cannot be called at module scope (throws). Only one call may
execute per invocation, though it may sit in different branches. Omitted properties in a
custom or inline profile inherit from `default`. Built-in profile names may be redefined in
`next.config.ts`, including `default` and `max`; the type signature is regenerated by
`next dev` / `next build` / `next typegen`. `staleTimes.static` also updates `default`'s
`stale`.

Documented conditional pattern: call `cacheLife('minutes')` on the not-found branch and
`cacheLife('days')` on the published branch; and a data-driven inline profile
`cacheLife({ revalidate: post.revalidateSeconds ?? 3600 })`.

---

## 7 · What these five sources do NOT settle

1. **🔴 Concurrent-request deduplication of a background regeneration** (§4). Unsettled. Write
   as uncertain; never assert a lock.
2. **How build time scales with the number of enumerated params.** No doc states a rate, a
   parallelism factor, or a per-page cost. The only supporting sentence is *"Handle large
   amounts of content pages without long `next build` times"* — which establishes the axis
   exists, not its slope. **No numbers may be invented.**
3. **Whether the deleted-slug case serves a stale prerender or 404s.** The docs cover a slug
   that never existed (404 at step 7) and one added after the build (generated on demand),
   but not one prerendered at build time and then deleted from the source of truth. State
   as unconfirmed.
4. **Any storage-size figure for the prerender output.** The Cache Components guide says
   prerendering *"produces output that has to be stored and deployed"* and nothing more.
5. **Whether revalidation windows across many paths align in practice.** Entries revalidate
   on request, so eligibility is traffic-shaped; the docs make no claim about alignment. The
   pages present the alignment argument as reasoning from the documented mechanism and label
   it as such.

Related: [[research-nextjs-multitenant-and-refresh]] (revalidateTag/updateTag/revalidatePath,
`use cache` cache key, the deploy-invalidates-everything rule), [[research-nextjs-ch1-foundations]].

---

## 8 · Corpus note, 2026-09-04 — where the ch5 cache mechanics actually live

⚠️ **`docs/nextjs/pages/05-caching-ppr-and-cache-components/`'s six top-level concept pages
are generated stubs** (`04-revalidation-time-based-isr.md` is 38 lines with no `> Verified:`
line; `02-the-use-cache-directive-and-custom-cachelife-profiles.md` and `06-project-milestone-…`
have empty bodies). **Do not defer readers to them.**

The authored, `> Verified:`-carrying cache material is in
**`05-caching-ppr-and-cache-components/10-the-three-cache-directives/`** (9 files, ~2,267 lines):
`01-choosing-a-directive.md`, `01b-composing-the-three.md`, `01c-slots-and-cache-keys.md`,
`02-use-cache-at-runtime.md`, `03-use-cache-remote.md`, `04-use-cache-private.md`,
`05-revalidation-and-lifetimes.md`, `05b-revalidatetag-and-updatetag.md`, `README.md`.
`05-revalidation-and-lifetimes.md` owns `cacheLife`; `05b-revalidatetag-and-updatetag.md` owns
`revalidateTag`/`updateTag`. Chapter 6's pages 02/02b/02c/02d and 03/03b/03c/03d link there.
