---
name: research-nextjs-ch5-cache-model-ppr-turbopack
description: Banked primary-source research for Next.js track chapter 5 (Caching, PPR, Cache Components) — the cacheComponents flag and what it removes, the full Migrating to Cache Components segment-config table, Partial Prerendering in full (the only PPR source that exists), custom cacheLife profiles in next.config, Turbopack FileSystem cache + memory eviction, instant-navigation validation, and CI build caching. Fetched 2026-09-04 against Next.js 16.3.4. Do not re-fetch for chapter 5.
metadata:
  type: reference
  track: nextjs
  gathered: 2026-09-04
---

# Next.js chapter 5 — banked research, 2026-09-04

**Target: Next.js 16.3.4 · React 19.2.8 · Node.js runtime required.** Every page below was
fetched as `https://nextjs.org/docs/<path>.md` and carried `version: 16.3.4` frontmatter.
`next` is **NOT installed** in the devbible checkout (`MODULE_NOT_FOUND`) — no T1 probe of the
package is possible. Everything here is T0 (verbatim quote) or T2 (doc read).

**Six sources fetched this pass.** All resolved:

| # | URL | `lastUpdated` |
|---|---|---|
| 1 | `/docs/app/getting-started/caching` | 2026-08-25 |
| 2 | `/docs/app/api-reference/config/next-config-js/cacheComponents` | 2026-06-22 |
| 3 | `/docs/app/guides/migrating-to-cache-components` | 2026-08-25 |
| 4 | `/docs/app/api-reference/config/next-config-js/cacheLife` | 2026-08-25 |
| 5 | `/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache` | 2026-08-03 |
| 5b | `/docs/app/api-reference/config/next-config-js/turbopackMemoryEviction` | 2026-07-07 |
| 6 | `/docs/app/guides/instant-navigation` | 2026-08-25 |
| 6b | `/docs/app/guides/ci-build-caching` | 2025-04-22 |

🔴 **`/docs/app/getting-started/partial-prerendering.md` is a 404 in 16.3.4.** There is no
standalone PPR page. PPR is documented **inside** source 1 under the *Prerendering* heading,
and glossed at `/docs/app/glossary#partial-prerendering-ppr`. Source 1 is therefore the only
PPR source that exists, and everything the corpus teaches about PPR must come from it.

---

## 1 · `cacheComponents` — the flag itself (source 2)

**The thesis sentence, verbatim:**

> *"Cache Components enables component and function-level caching using the `use cache` directive. Data fetching is dynamic by default, and you choose what to cache at the page, component, or function level. Next.js prerenders a static HTML shell that is served immediately while dynamic content streams in when ready, letting you mix static and dynamic content within a single route."*

🔴 **The runtime constraint:**

> *"Cache Components requires the Node.js runtime. Migrate any routes that set the deprecated `runtime = 'edge'` export, and note that other server-side JavaScript runtimes are not guaranteed to work."*

**What the flag turns on** (bulleted): the `use cache` directive · the `cacheLife` function
with `use cache` · the `cacheTag` function.

🔴 **PPR becomes the default and the old flags are GONE:**

> *"Additionally, `cacheComponents` implements **Partial Prerendering (PPR)** as the default behavior in the App Router. This means the `experimental.ppr` configuration flag and the `experimental_ppr` route segment configuration are no longer necessary and have been removed."*

**Version history — one row only:**

| Version | Change |
|---|---|
| `16.0.0` | *"`cacheComponents` introduced. This flag controls the `ppr`, `useCache`, and `dynamicIO` flags as a single, unified configuration."* |

### 🔴 Navigation with Activity — the behaviour change almost nobody expects

> *"When `cacheComponents` is enabled, Next.js uses React's `<Activity>` component to preserve component state during client-side navigation."*

> *"Rather than unmounting the previous route when you navigate away, Next.js sets the Activity mode to `\"hidden\"`."*

Three consequences, verbatim: *"Component state is preserved when navigating between
routes"* · *"When you navigate back, the previous route reappears with its state intact"* ·
*"Effects are cleaned up when a route is hidden, and recreated when it becomes visible
again."*

> *"Next.js uses heuristics to keep a few recently visited routes `\"hidden\"`, while older routes are removed from the DOM to prevent excessive growth."*

From source 3, the same fact stated as a migration hazard:

> *"Effects clean up and re-run normally, but `useState` values, form inputs, and scroll position are no longer reset when navigating away and back."*

Three named patterns that break (source 3, verbatim): **Dropdowns and popovers** *"stay open
when navigating back. Close them in a `useLayoutEffect` cleanup function."* · **Dialogs with
initialization logic** — *"Effects that depend on dialog state (like focusing an input) won't
re-fire if the state was preserved. Derive dialog state from the URL instead."* · **Forms
after submission** — *"input values and `useActionState` results (success/error messages)
persist when returning. Reset in the submit handler or user action when possible, otherwise
use a cleanup effect."*

---

## 2 · Migrating to Cache Components — the removal table (source 3)

**The framing sentence:**

> *"When Cache Components is enabled, route segment configs like `dynamic`, `revalidate`, and `fetchCache` are replaced by `use cache` and `cacheLife`."*

> *"After enabling the flag, route segments that still export `dynamic`, `revalidate`, or `fetchCache` will error."*

> *"The migration is driven by **instant navigation validation**. With Cache Components enabled, Next.js validates in development whether navigating into each route renders instantly, and surfaces the code that would block it as an error or insight."*

| Old surface | Verdict, verbatim | Replacement |
|---|---|---|
| `dynamic = 'force-dynamic'` | *"**Not needed.** All pages are dynamic by default."* | delete it |
| `dynamic = 'force-static'` | *"Start by removing it."* | `use cache` + `cacheLife('max')` as close to the data access as possible |
| `revalidate` | *"**Replace with `cacheLife`.**"* | `cacheLife('hours')` inside `use cache` |
| `fetchCache` | *"**Not needed.** With `use cache`, all data fetching within a cached scope is automatically cached, making `fetchCache` unnecessary."* | `use cache` |
| `fetch` `cache`/`next` options | *"**Move `cache` and `next` options to `use cache`.**"* | `cacheLife` + `cacheTag` |
| `unstable_cache` | *"**Replace with `use cache`.**"* | key-parts array no longer needed; args derive the key |
| `unstable_noStore` / `noStore()` | *"**Not needed.** ... With Cache Components, nothing is cached unless you add `use cache`, so you can remove it."* | delete; use `connection()` + `<Suspense>` if it must run at request time |
| `dynamicParams` | 🔴 *"**Delete the export.**"* — **not supported** | `notFound()` in the page |
| `runtime = 'edge'` | *"**Not supported.** Cache Components requires the Node.js runtime."* | Node runtime, or Proxy for edge behaviour |
| `experimental_ppr` | *"**Removed. Enable `cacheComponents` instead.**"* | nothing — PPR is the default |

🔴 **The `dynamicParams` build error, verbatim from the doc:**

> *"Route segment config \"dynamicParams\" is not compatible with `nextConfig.cacheComponents`."*

> *"Params not returned by `generateStaticParams` are rendered on request. If you used `dynamicParams: false` to reject them, call `notFound()` in the page when the param doesn't resolve to real data."*

🔴 **The persistence regression nobody reads — `use cache` is WEAKER than what it replaces:**

> *"Note the persistence difference. The `fetch` Data Cache persists cached responses across deployments and across serverless instances."*

> *"`use cache` defaults to in-memory storage, so its entries are discarded when the serverless instance is destroyed and are scoped to a single deployment. Use `use cache: remote` or a cache handler for storage that survives instance teardown. Even with durable storage, expect cached values to recompute after a new deployment."*

> *"Like the `fetch` Data Cache, `unstable_cache` persists cached values across deployments and serverless instances, while `use cache` does not."*

⚠️ **Both layers coexist during migration:** *"Your existing `fetch` and `unstable_cache`
caching keeps working as a separate layer, so let the insights and errors guide what to
change."*

### `instant = false` — the opt-out, and its two hard limits

```tsx
export const instant = false
```

> *"`instant = false` marks a segment as *allowed to block*. It does not force the route to be dynamic, so a genuinely prerenderable route still ships a static shell. It also does not clear synchronous IO build errors: calls like `new Date()`, `Math.random()`, and `crypto.randomUUID()` still fail the prerender."*

🔴 **Synchronous IO cannot be deferred, verbatim:**

> *"**Fix synchronous IO. It can't be deferred.** Calls like `new Date()`, `Date.now()`, `Math.random()`, and `crypto.randomUUID()` during prerender throw a build error that `instant = false` does not clear, so a route that uses them won't build until you address it, opt-out or not."*

**The whole-app codemod:**

```bash
npx @next/codemod@canary cache-components-instant-false ./app
```

> *"Pass `./src/app` in a `src/` project. A wrong path reports `0 ok` instead of failing, so check the file count."*

⚠️ **Insights are invisible to HTTP:**

> *"Insights don't show up in the HTTP response. An offending route still returns `200` with rendered HTML in dev. The insight only appears in the dev overlay, the dev-server log, or the MCP `get_errors` tool."*

### The client hooks that suspend under Cache Components

> *"When the route's pathname is fully known, they resolve during prerendering and need no boundary. When it depends on dynamic params not yet known, they suspend, wherever the component sits. A nav or breadcrumb in a shared layout, for instance, suspends while Next.js generates the static shell for any route below it that has dynamic params. Wrap the component that reads the hook in `<Suspense>` ... or the build fails"*

Named: `usePathname` · `useParams` · `useSelectedLayoutSegment` · `useSelectedLayoutSegments`.
And separately: *"The `useSearchParams` hook always needs a `<Suspense>` boundary, since search
params are only known at request time."* Error page: `/docs/messages/blocking-prerender-client-hook`.

### `GET` Route Handlers

> *"With Cache Components, `GET` handlers follow the same model as pages: they prerender when they don't access uncached or runtime data ... The directive can't be applied to the `GET` export itself, so the handler calls a cached helper."*

🔴 *"Reading uncached or runtime data in a `GET` handler bails out of prerendering by
**throwing**. A `try/catch` you already have around other operations will catch that bail-out.
If the `catch` block logs the error, it adds noise to the build output. Set
`experimental.hideLogsAfterAbort: true` to hide logs emitted after a bail-out."*

### The root-layout `<html>` attribute case, verbatim

> *"When a cookie or header value drives an attribute on the `<html>` element in the root layout (`lang`, `dir`, `data-theme`, etc.), reading it on the server makes the whole subtree request-bound, so there's no child to wrap in `<Suspense>`. An inline `<script>` in `<head>` that sets the attribute before paint keeps the shell static"*

---

## 3 · Partial Prerendering, in full (source 1) — the ONLY PPR source

**The four prerendering rules, verbatim as a list:**

> *"`use cache`: the result is cached and included in the static shell, as long as its lifetime isn't too short"*
> *"`<Suspense>`: fallback UI is included in the static shell while the content streams at request time"*
> *"Predictable values: module imports, `fs.readFileSync`, and pure computations complete during prerender and are included in the static shell automatically"*
> *"Random values and timestamps: use `connection()` + `<Suspense>` to get a unique value per request, or `use cache` to share one across users"*

**The definition:**

> *"This generates a static shell consisting of HTML for initial page loads and a serialized RSC Payload for client-side navigation, ensuring the browser receives fully rendered content instantly whether users navigate directly to the URL or transition from another page. This rendering approach is called **Partial Prerendering (PPR)**, the default behavior with Cache Components."*

> *"Every produced static shell can be served directly from a CDN, without going through to the upstream server. This makes direct navigations instant."*

**Static shell vs App Shell — the distinction the corpus needs:**

> *"What ends up in a route's static shell depends on what's known at build time. When a route's dynamic params are known, the shell contains that concrete content, and any remaining uncached or runtime data still streams behind its `<Suspense>` fallback. When the params aren't known, the reusable, URL-independent version is the **App Shell**: the same static shell with the param-specific parts left behind their fallbacks. Incremental Static Regeneration fills in the concrete versions after the first visit."*

**The validation guarantee:**

> *"Next.js requires you to explicitly handle components that can't complete during prerendering. It surfaces a validation insight in the dev overlay and dev server console that names the route and points at fixes (cache the access, move it into a `<Suspense>` boundary, or opt the route out). This validation keeps every route producing a static shell, so direct navigations stay instant."*

🔴 **Suspense does NOT make a component dynamic:**

> *"`<Suspense>` provides a fallback UI while async work completes, but it does not itself opt a component into dynamic rendering. If a component only performs synchronous work, it will complete during prerendering regardless of whether it is wrapped in `<Suspense>`."*

🔴 **The model inversion, verbatim:**

> *"Reading `cookies()` here doesn't opt-in the whole route into dynamic rendering, the way the previous rendering model did. The Suspense boundary provides fallback UI where the runtime access streams, while static and cached content still ship in the initial HTML."*

### Maximizing the static shell

> *"The deeper your async work sits in the tree, the more of the page can be prerendered. This is the structural pattern Cache Components rewards"*

> *"If this param is dynamic (not provided by `generateStaticParams`), it is runtime data and the layout cannot be prerendered."*

The documented fix is a **non-async layout** that passes the `params` promise into a
`<Suspense>` and resolves it with `params.then(...)` inside — so `<Sidebar />`, `{children}`
and the fallback all stay in the shell.

### 🔴 Bots and crawlers — the SEO trap

> *"Browsers receive the static shell instantly. Bots and crawlers are detected by their user agent and handled differently: because they need a complete document, Next.js skips the shell and renders the entire page dynamically at request time, then sends the finished HTML once the render completes."*

> *"Because the shell is re-rendered instead of reused, work that completed during prerendering now runs at request time for a bot. If part of your shell depends on inputs that only exist while prerendering, such as build-time data or values that are not reachable in the request-time environment, a page that loads for a person can fail to render for a crawler. Make sure the data your shell relies on is also available at request time."*

### Where cached content is stored — three copies of one RSC payload

> *"A cached function's output is serialized into an **RSC payload**, at build time or at runtime. This payload is what everything else works from."*

- **Prerendered HTML** — *"stored on disk when self-hosting, or in your platform's durable storage behind a CDN. That HTML is the static shell at build time and the concrete page after an ISR upgrade, with `revalidate` and `expire` controlling when it's rebuilt."*
- **Shared store** — *"By default the result stays in a per-instance, in-memory store that is ephemeral on serverless. `use cache: remote` moves it to a durable cache handler shared across instances, a network roundtrip that pays off only at a **high hit rate**."*
- **Browser** — *"The payload is included in the RSC sent for a client navigation or prefetch, where the browser keeps it fresh for its `stale` window. `use cache: private` results live only here."*

> *"An App Shell that reads `cookies()` or `headers()` is session-specific, cached per session on the client rather than in the shared server cache."*

> *"All of these stores are scoped to a single deployment. A new deploy starts fresh, new prerenders are built, and `use cache` entries don't carry over, even durable `remote` ones, because the cache key includes the build id."*

### Prefetching

> *"With Partial Prefetching enabled, the router prefetches each route's App Shell by default. The App Shell includes static content and session data derived from `cookies()` and `headers()`. To also prefetch cached content that depends on a link's **URL data**, such as `searchParams` or dynamic `params`, set `prefetch={true}` on that link."*

> *"This per-link prefetch includes cached content that resolves after the destination URL is known. It costs a server invocation per prefetchable link."*

### Random / predictable values

Dev-overlay insight identifiers, named by the doc: **`blocking-prerender-random`**,
**`blocking-prerender-current-time`**, **`blocking-prerender-crypto`**. For runtime APIs
without a boundary: **`blocking-prerender-runtime`**. For an uncached read:
**`blocking-route`**.

> *"`performance.now()` is meant for telemetry, so Next.js doesn't treat it as a value to guard."*

> *"This includes queries to embedded databases with synchronous APIs, such as `better-sqlite3` or Node.js's built-in `node:sqlite`. If you need per-request data from a synchronous source, call `connection()` before the query."*

Module-scope reads are the documented answer for request-independent files: *"Calling
`await readFile()` inside the component would be treated as uncached data that must be either
accessed within `use cache` or behind a `<Suspense>` boundary."*

---

## 4 · Custom `cacheLife` profiles — the CONFIG page (source 4)

🔴 **This is a DIFFERENT page from `functions/cacheLife`.** The function page (banked in
[[research-nextjs-ch6-isr-and-params]] §6) owns the presets and nesting; **this** page owns
defining your own.

> *"The `cacheLife` option allows you to define **custom cache profiles** when using the `cacheLife` function inside components or functions, and within the scope of the `use cache` directive."*

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    blog: {
      stale: 3600,     // 1 hour
      revalidate: 900, // 15 minutes
      expire: 86400,   // 1 day
    },
  },
}

export default nextConfig
```

Used as `cacheLife('blog')`. **Values are seconds.**

> *"You can also override a built-in profile by defining one with the same name (`default`, `seconds`, `minutes`, `hours`, `days`, `weeks`, or `max`)."*

**The reference table, verbatim:**

| Property | Value | Description | Requirement |
|---|---|---|---|
| `stale` | `number` | *"Duration the client should cache a value without checking the server."* | Optional |
| `revalidate` | `number` | *"Frequency at which the cache should refresh on the server; stale values may be served while revalidating."* | Optional |
| `expire` | `number` | *"Maximum duration for which a value can remain stale before switching to dynamic."* | Optional — *"Must be longer than `revalidate`"* |

⚠️ Note `expire`'s description here — *"before switching to dynamic"* — is a stronger
statement than the function page's *"the next one waits for fresh content"*. Both are quoted;
the pages should use the function page's wording for the runtime behaviour and this one for
the config contract.

From source 3, the pointer that makes this page load-bearing:

> *"If your `revalidate` value doesn't match a built-in `cacheLife` profile ... pick the closest one or define a custom profile to match your conventions. You can also redefine a built-in profile, including `default`, when its timings don't match your application's caching needs."*

---

## 5 · Turbopack build caches (sources 5 and 5b)

🔴🔴 **THE SYLLABUS IS WRONG ABOUT THE FLAG NAMES AND THE DEFAULTS.** The devbible syllabus
(`docs/nextjs/syllabus/02-data-rendering-resilience.md`) says *"Now named flags, both on by
default: `turbopackFileSystemCache` ... and `turbopackMemoryEviction`"* with figures **"up to
5.5× faster CI builds"** and **"up to 90% less dev RAM"**. Against the API reference:

- There is **no `turbopackFileSystemCache` config key.** That is the doc page's *title*. The
  keys are two, and both live under **`experimental`**.
- **`turbopackMemoryEviction` does not default to `true`.** It is a **tri-state** defaulting
  to `'auto'`.
- 🔴 **Neither figure (5.5×, 90%) appears anywhere in either API reference page.** They must
  not be asserted as documented. State that the reference gives no numbers.

### FileSystem caching (source 5)

> *"Turbopack FileSystem Cache enables Turbopack to reduce work across `next dev` or `next build` commands. When enabled, Turbopack will save and restore data under the `.next` directory between runs, which can greatly speed up subsequent builds and dev sessions."*

> *"Two options control the cache, one for `next dev` and one for `next build`. Both are enabled by default"*

```ts
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: true,
  },
}
```

- **`turbopackFileSystemCacheForDev`** (default `true`): *"caches Turbopack's work for `next dev` in `.next/dev/cache/turbopack`. Restarting the dev server reuses the previous compilation."*
- **`turbopackFileSystemCacheForBuild`** (default `true`): *"caches Turbopack's work for `next build` in `.next/cache/turbopack`. Subsequent builds start warm."*

🔴 **The build-environment caveat — the whole reason a CI build is not faster:**

> *"The build cache lives in `.next/cache`. Builds only get faster when that directory is restored before each build."*

> *"**Self-hosted builds**: reuse the same working directory between builds. Containerized builds start from a clean layer and do not carry `.next/cache` over unless you cache or mount it explicitly."*

> *"If your build environment never preserves `.next/cache`, set `turbopackFileSystemCacheForBuild: false` to skip writing a cache that will not be read."*

**Version history, verbatim:**

| Version | Change |
|---|---|
| `v16.3.0` | *"FileSystem caching is enabled by default for builds"* |
| `v16.1.0` | *"FileSystem caching is enabled by default for development"* |
| `v16.0.0` | *"Beta release with separate flags for build and dev"* |
| `v15.5.0` | *"Persistent caching released as experimental on canary releases"* |

### Memory eviction (source 5b)

> *"`turbopackMemoryEviction` controls whether Turbopack reclaims memory while the persistent (FileSystem) cache is enabled. After Turbopack writes a snapshot of its cache to disk, it can 'evict' the in-memory copies of that data and reload them from disk on demand."*

**The three options, verbatim:**

> *"`false`: never evict. Cached data stays in memory for the lifetime of the process."*
> *"`'auto'` (default): evict after a snapshot only once enough memory has been allocated since the last eviction to make it worthwhile. Leverages thresholds and memory pressure feedback from the operating system."*
> *"`'full'`: evict all possible data from memory every time we save to disk."*

🔴 **The scope limit:**

> *"This option only has an effect in `next dev` sessions when the FileSystem Cache is enabled, since eviction relies on data already being persisted to disk. It is experimental and under active development."*

**Version history:** `v16.3.0` — *"`turbopackMemoryEviction` released as experimental."*

### CI build caching (source 6b, `lastUpdated` 2025-04-22 — the oldest page in this bank)

> *"To improve build performance, Next.js saves a cache to `.next/cache` that is shared between builds."*

> *"If your CI is not configured to persist `.next/cache` between builds, you may see a No Cache Detected error."*

**Vercel:** *"Next.js caching is automatically configured for you. There's no action required on your part."*

GitHub Actions (verbatim, `actions/cache@v4`):

```yaml
uses: actions/cache@v4
with:
  path: |
    ~/.npm
    ${{ github.workspace }}/.next/cache
  key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}
  restore-keys: |
    ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-
```

Also documented, all caching `.next/cache`: CircleCI (`save_cache` paths), Travis
(`cache.directories`), GitLab (`cache.paths`), AWS CodeBuild (`.next/cache/**/*`), Bitbucket
(`definitions.caches.nextcache`), Heroku (`cacheDirectories` in `package.json`), Azure
Pipelines (`Cache@2`), Jenkins (Job Cacher `arbitraryFileCache`), Netlify
(`@netlify/plugin-nextjs`).

---

## 6 · Instant-navigation validation (source 6)

**The definition:**

> *"A navigation is **instant** when the browser can start rendering the new page the moment the user clicks, with static, cached, and fallback content showing up right away, while the server streams the remaining content into its fallbacks."*

> *"This definition assumes caches are warm. Cold caches still require the server to compute the cached result once, so the first navigation to a route may still wait."*

🔴 **Direct visit and client navigation are DIFFERENT renders — the fact that makes PPR hard:**

> *"**Direct visits** get the **static shell** as HTML, typically from a CDN. **Client navigations** only re-render below the layout the current and destination routes share, so the fallback UI defined by a `<Suspense>` boundary above that point can't be used during the transition."*

> *"A `<Suspense>` boundary in the root layout covers everything on a page load, but on this navigation, it sits above the re-render scope and does not trigger."*

> *"`useSearchParams()` suspends during server rendering because search params are not available at build time. But on a client navigation, the router already has the params from the URL and the hook resolves synchronously. The same component can render immediately on a client navigation but sit behind a fallback on a page load."*

**Validation defaults:**

> *"By **default** (`validationLevel: 'warning'`), Cache Components apps validate every Page and Default segment in development."*

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    instantInsights: { validationLevel: 'manual-warning' },
  },
}
```

> *"Validation runs on every page load using the real request from your browser, so dynamic params like `[slug]` are checked against actual values as you navigate."*

**The quick-start pair:** `cacheComponents: true` **and** `partialPrefetching: true`.

**Opting out at segment scope:**

> *"With `false` on `/dashboard/layout.tsx`, validation no longer flags navigations into `/dashboard` from outside; navigations between `/dashboard/a` and `/dashboard/b` are still checked."*

> *"For opted-out segments, the navigation blocks on the server. If the content depends on cookies or headers but has a known cache lifetime, caching it with `use cache: private` lets the App Shell carry it ahead of the click instead of opting out, as long as its `stale` time is at least 5 minutes."*

**`use cache: private` and the shell:**

> *"The result is cached in the browser only, not on the server. **It can't be part of the static shell.**"*

**Fallbacks can themselves suspend:**

> *"A fallback may access `cookies()`, `headers()`, or the full URL. At build time, the fallback itself suspends, and a `<Suspense>` boundary further up the tree is needed. ... Cached values like timestamps or data fetches can sit directly inside the fallback."*

**Client Component pages:**

> *"A soft navigation into a page with `\"use client\"` at the top behaves like a single-page app transition, with no server render at navigation time, which makes it instant."*
> *"`\"use client\"` doesn't skip validation for the static shell. Hooks like `useSearchParams()` still need a `<Suspense>` boundary."*

**Testing — `@next/playwright`:**

```typescript
import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'
```

`instant(page, callback, { baseURL })`. *"Pass Playwright's `baseURL` to `instant()` when
`page.goto()` is the first navigation. The helper needs the origin before requesting the
document."* · *"For client navigations, wait for the destination URL before asserting on its
UI. Otherwise, a shared selector can match the source page before the destination commits."*
· *"The start of the `instant()` scope is the same as turning on **Pause on navigations** in
the Navigation Inspector, and the end of the scope releases the pause the way **Resume**
does."*

Production-build testing needs `experimental: { exposeTestingApiInProductionBuild: true }`.

**The Navigation Inspector** freezes the page at its initial loading state; labels are
**Page load** (target URL only) and **Client nav** (source and target URLs).

🔴 **Validation passing is not the goal, verbatim:**

> *"Validation passing means the navigation is instant. It does not mean the loading states are good. A `<Suspense>` boundary placed high in the tree (say, wrapping the whole page) might satisfy validation, but it replaces most of the page with a single fallback on every navigation."*

> *"The best loading states keep as much real, cached content visible as possible and only show fallbacks where data is actually in flight."*

---

## 7 · What these sources do NOT settle

1. 🔴 **The "5.5× faster CI builds" and "90% less dev RAM" figures** in the devbible syllabus
   appear in **neither** Turbopack API reference page. Do not assert them as documented.
2. **Concurrent-request deduplication of a background regeneration** — still unsettled, as
   recorded in [[research-nextjs-ch6-isr-and-params]] §4. Nothing in this pass changes it.
3. **How much memory `'full'` eviction actually reclaims versus `'auto'`, or what the `'auto'`
   thresholds are.** The doc says *"thresholds and memory pressure feedback from the operating
   system"* and gives no numbers.
4. **Whether `turbopackFileSystemCacheForBuild` has any effect on `next dev`** (or the
   converse). The doc scopes each to one command and does not discuss interaction.
5. **How many routes `<Activity>` keeps `"hidden"`.** *"Next.js uses heuristics to keep a few
   recently visited routes"* — "a few" is the only quantity given.
6. **Whether `instant = false` affects production behaviour at all.** The doc describes it as
   opting out of *validation feedback* and says the segment *"may still navigate instantly if
   its structure supports it"*, but never states a production effect.

Related banks — read, do not re-fetch: [[research-nextjs-ch6-isr-and-params]] (ISR, cacheLife
presets and nesting, generateStaticParams, the stampede question),
[[research-nextjs-ch6-rendering-choice]] (PPR quotes, ISR caveats, generateMetadata),
[[research-nextjs-multitenant-and-refresh]] (use cache keys, cacheTag, revalidateTag/updateTag/
revalidatePath, refresh, Server Actions).
