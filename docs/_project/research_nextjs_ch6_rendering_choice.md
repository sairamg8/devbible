---
name: research-nextjs-ch6-rendering-choice
description: Banked primary-source research for the Next.js track chapter 6 (SSG/ISR/SSR strategy), specifically the "choosing a rendering pattern" decision page. Verbatim quotes with URLs for the Cache Components caching page (PPR default, bots and crawlers, runtime APIs, cache storage), the ISR guide (benefits, caveats, x-nextjs-cache), and generateMetadata (streaming metadata, HTML-limited bots). Fetched 2026-09-04 against Next.js 16.3.4. Do not re-derive.
metadata:
  type: reference
  track: nextjs
  gathered: 2026-09-04
---

# Banked research — choosing a rendering pattern (Next.js ch6)

**Target: Next.js 16.3.4.** All three pages fetched as `https://nextjs.org/docs/<path>.md`
and each carried `version: 16.3.4` frontmatter.

🔴 **`https://nextjs.org/docs/app/getting-started/partial-prerendering.md` is a 404**
("The URL `/docs/app/getting-started/partial-prerendering` does not exist"). PPR is
documented **inside** `/docs/app/getting-started/caching` under the *Prerendering*
heading. There is no standalone PPR page in 16.3.4 docs.

---

## 1 · Caching (Cache Components) — <https://nextjs.org/docs/app/getting-started/caching> (`lastUpdated: 2026-08-25`)

**PPR is the default under Cache Components:**

> *"This generates a static shell consisting of HTML for initial page loads and a serialized RSC Payload for client-side navigation, ensuring the browser receives fully rendered content instantly whether users navigate directly to the URL or transition from another page. This rendering approach is called **Partial Prerendering (PPR)**, the default behavior with Cache Components."*

> *"Every produced static shell can be served directly from a CDN, without going through to the upstream server. This makes direct navigations instant."*

**The runtime APIs (bulleted list):** `cookies` — *"User's cookie data"*; `headers` —
*"Request headers"*; `searchParams` — *"URL query parameters"*; `params` — *"Dynamic route
parameters."*

🔴 **The model change that decides the whole personalization axis:**

> *"Reading `cookies()` here doesn't opt-in the whole route into dynamic rendering, the way the previous rendering model did. The Suspense boundary provides fallback UI where the runtime access streams, while static and cached content still ship in the initial HTML."*

> *"`<Suspense>` provides a fallback UI while async work completes, but it does not itself opt a component into dynamic rendering. If a component only performs synchronous work, it will complete during prerendering regardless of whether it is wrapped in `<Suspense>`."*

**Maximizing the shell:**

> *"The deeper your async work sits in the tree, the more of the page can be prerendered."*

> *"If this param is dynamic (not provided by `generateStaticParams`), it is runtime data and the layout cannot be prerendered."*

**Prerendering rules (bulleted):** `use cache` result included in the shell *"as long as its
lifetime isn't too short"*; `<Suspense>` fallback in the shell while content streams;
predictable values (module imports, `fs.readFileSync`, pure computation) complete during
prerender; random/time values need `connection()` + `<Suspense>` or `use cache`.

> *"Next.js requires you to explicitly handle components that can't complete during prerendering. It surfaces a validation insight in the dev overlay and dev server console that names the route and points at fixes (cache the access, move it into a `<Suspense>` boundary, or opt the route out). This validation keeps every route producing a static shell, so direct navigations stay instant."*

**App Shell:**

> *"When a route's dynamic params are known, the shell contains that concrete content, and any remaining uncached or runtime data still streams behind its `<Suspense>` fallback. When the params aren't known, the reusable, URL-independent version is the **App Shell**: the same static shell with the param-specific parts left behind their fallbacks. Incremental Static Regeneration fills in the concrete versions after the first visit."*

> *"In a route with dynamic param segments, `generateStaticParams` prerenders the URLs you list at build time. Any other URL is served the App Shell instantly, then upgraded in the background with its now-known params and cached for the next visitor."*

🔴 **Bots and crawlers — the SEO fact almost nobody knows:**

> *"Browsers receive the static shell instantly. Bots and crawlers are detected by their user agent and handled differently: because they need a complete document, Next.js skips the shell and renders the entire page dynamically at request time, then sends the finished HTML once the render completes."*

> *"Because the shell is re-rendered instead of reused, work that completed during prerendering now runs at request time for a bot. If part of your shell depends on inputs that only exist while prerendering, such as build-time data or values that are not reachable in the request-time environment, a page that loads for a person can fail to render for a crawler. Make sure the data your shell relies on is also available at request time."*

**Where cached content is stored (cost axis):**

> *"By default the result stays in a per-instance, in-memory store that is ephemeral on serverless. `use cache: remote` moves it to a durable cache handler shared across instances, a network roundtrip that pays off only at a **high hit rate**."*

> *"An App Shell that reads `cookies()` or `headers()` is session-specific, cached per session on the client rather than in the shared server cache."*

> *"All of these stores are scoped to a single deployment. A new deploy starts fresh, new prerenders are built, and `use cache` entries don't carry over, even durable `remote` ones, because the cache key includes the build id."*

**Prefetching cost:**

> *"This per-link prefetch includes cached content that resolves after the destination URL is known. It costs a server invocation per prefetchable link."*

> *"With Partial Prefetching enabled, the router prefetches each route's App Shell by default. The App Shell includes static content and session data derived from `cookies()` and `headers()`."*

**Route Handlers:** *"When Cache Components is enabled, `GET` Route Handlers follow the same
prerendering model as pages."*

**Predictable values:** *"`performance.now()` is meant for telemetry, so Next.js doesn't treat
it as a value to guard."*

---

## 2 · ISR guide — <https://nextjs.org/docs/app/guides/incremental-static-regeneration> (`lastUpdated: 2026-06-23`)

> *"**Good to know**: This guide covers ISR without Cache Components. If you are using `cacheComponents`, see ISR with Cache Components instead."*
(that page: `/docs/app/guides/incremental-static-regeneration-cache-components` — **not fetched**)

**Benefits list, verbatim:** *"Update static content without rebuilding the entire site"* ·
*"Reduce server load by serving prerendered, static pages for most requests"* · *"Ensure
proper `cache-control` headers are automatically added to pages"* · *"Handle large amounts
of content pages without long `next build` times"*.

**The serve-stale sequence (numbered, verbatim):** *"After 60 seconds has passed, the next
request will still return the cached (now stale) page"* → *"The cache is invalidated and a
new version of the page begins generating in the background"* → *"Once generated
successfully, the next request will return the updated page and cache it for subsequent
requests"* → *"If `/blog/26` is requested, and it exists, the page will be generated
on-demand. ... However, if the post does not exist, then 404 is returned."*

🔴 **The staleness recommendation — the data-velocity axis in the docs' own words:**

> *"We recommend setting a high revalidation time. For instance, 1 hour instead of 1 second. If you need more precision, consider using on-demand revalidation. If you need real-time data, consider switching to dynamic rendering."*

> *"If an error is thrown while attempting to revalidate data, the last successfully generated data will continue to be served from the cache. On the next subsequent request, Next.js will retry revalidating the data."*

> *"`revalidatePath` invalidates the cache entries but regeneration happens on the next request."*

**Caveats (verbatim, complete):**

> *"ISR is only supported when using the Node.js runtime (default)."*
> *"ISR is not supported when creating a Static Export."*
> *"If you have multiple `fetch` requests in a prerendered route, and each has a different `revalidate` frequency, the lowest time will be used for ISR."*
> *"If any of the `fetch` requests used on a route have a `revalidate` time of `0`, or an explicit `no-store`, the route will be dynamically rendered."*
> *"Proxy won't be executed for on-demand ISR requests, meaning any path rewrites or logic in Proxy will not be applied. Ensure you are revalidating the exact path."*
> *"When running multiple instances, the default file-system cache is per-instance. On-demand revalidation only invalidates the instance that receives the call. Use a shared custom cache handler to coordinate across instances."*
> *"Background regeneration (stale-while-revalidate) runs on the instance that receives the triggering request. On platforms with per-request billing, this background work counts as additional compute."*
> *"You can use the `x-nextjs-cache` response header to observe cache behavior. Values are `HIT` (served from cache), `STALE` (served from cache, revalidating in background), `MISS` (not in cache, rendered fresh), or `REVALIDATED` (regenerated via on-demand revalidation)."*

⚠️ Note the word **"explicit"** in the `no-store` caveat: it is the doc sentence that keeps
"a `fetch` with no options leaves the route static and stale" and "an explicit `no-store`
makes it dynamic" from contradicting each other.

**Debugging:** `NEXT_PRIVATE_DEBUG_CACHE=1` *"will make the Next.js server console log ISR
cache hits and misses"*; `logging.fetches.fullUrl` in `next.config.js`.

**Platform support table:** Node.js server Yes · Docker Yes · Static export **No** ·
Adapters platform-specific.

---

## 3 · `generateMetadata` — <https://nextjs.org/docs/app/api-reference/functions/generate-metadata> (`lastUpdated: 2026-08-25`)

> *"Resolving `generateMetadata` is part of rendering the page. If the page can be prerendered and `generateMetadata` doesn't introduce dynamic behavior, the resulting metadata is included in the page's initial HTML."*

**Streaming metadata (added `v15.2.0` per the version-history table):**

> *"Streaming metadata allows Next.js to render and send the initial UI to the browser, without waiting for `generateMetadata` to complete."*

> *"When `generateMetadata` resolves, the resulting metadata tags are appended to the `<body>` tag. We have verified that metadata is interpreted correctly by bots that execute JavaScript and inspect the full DOM (e.g. `Googlebot`)."*

> *"For **HTML-limited bots** that can't execute JavaScript (e.g. `facebookexternalhit`), metadata continues to block page rendering. The resulting metadata will be available in the `<head>` tag."*

> *"Next.js automatically detects **HTML-limited bots** by looking at the User Agent header. You can use the `htmlLimitedBots` option in your Next.js config file to override the default User Agent list."*

Disable streaming metadata entirely: `htmlLimitedBots: /.*/` in `next.config.ts`.

> *"Streaming metadata improves perceived performance by reducing TTFB and can help lowering LCP time."*
> *"Overriding `htmlLimitedBots` could lead to longer response times. Streaming metadata is an advanced feature, and the default should be sufficient for most cases."*

**With Cache Components:**

> *"When Cache Components is enabled, `generateMetadata` follows the same rules as other components. If metadata accesses runtime data (`cookies()`, `headers()`, `params`, `searchParams`) or performs uncached data fetching, it defers to request time."*

> *"**If the page or layout is otherwise fully prerenderable**: Next.js requires an explicit choice: cache the data if possible, or signal that deferred rendering is intentional."*

> *"Streaming metadata at runtime while the rest of the page is fully prerenderable is not common. To ensure this behavior is intentional, an error is raised indicating which page or layout needs to be handled."*

Two documented fixes: `'use cache'` inside `generateMetadata` for external-but-not-runtime
data, or a `DynamicMarker` component (`await connection()`) wrapped in `<Suspense>`. Error
identifiers named by the doc: `blocking-prerender-metadata-runtime` and
`blocking-prerender-metadata-dynamic`.

---

## 4 · Not confirmed / deliberately left uncertain

1. **PPR's own page** does not exist in 16.3.4 docs (404, see header). Everything PPR on the
   ch6 pages is sourced from the Caching page's *Prerendering* section.
2. **ISR with Cache Components** (`/docs/app/guides/incremental-static-regeneration-cache-components`)
   was **not fetched** — the ch6 pages name it and link it but quote nothing from it.
3. The docs give **no numeric guidance** on build duration, cost per invocation, or how many
   params are "too many" for `generateStaticParams`. The pages state the trade-off
   qualitatively and say the documentation gives no threshold.
4. The migration guide's self-contradiction on the `fetch` default (banked separately in
   `research_nextjs_multitenant_and_refresh.md` context) was **not re-opened**; the ch6 pages
   rely on the ISR caveat's word *"explicit"* instead.
