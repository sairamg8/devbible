---
name: research-nextjs-multitenant-and-refresh
description: Banked primary-source research for the Next.js track's multi-tenant topic (ch15) and refresh() topic (ch8). Verbatim load-bearing sentences with URLs, gathered 2026-09-03 against Next.js 16.3.4 docs. Read this instead of re-fetching nextjs.org for tenancy, proxy, root params, cache keys, cacheTag, revalidateTag/updateTag/revalidatePath or refresh.
metadata:
  type: project
  track: nextjs
  gathered: 2026-09-03
---

# Banked research — Next.js multi-tenancy + `refresh()`

**Target: Next.js 16.3.4** (every `.md` doc fetched carried `version: 16.3.4` frontmatter).
Fetch trick: `https://nextjs.org/docs/<path>.md` serves clean Markdown with `version:` and
`lastUpdated:` frontmatter — far cheaper than the HTML page.

⚠️ **`/docs/app/api-reference/functions/root-params.md` is a 404.** The real path is
**`/docs/app/api-reference/functions/next-root-params`**.

⚠️ **The official multi-tenant guide is almost empty.** `/docs/app/guides/multi-tenant.md`
(`lastUpdated: 2025-04-15`) is 18 lines and its entire body points at the Vercel
platforms-starter-kit template. There is **no upstream prose** on tenant identification,
isolation or tenancy-and-caching. The devbible pages were assembled from proxy, root-params,
use-cache, cacheTag, revalidate* and data-security docs plus PostgreSQL's `SET` manual.

---

## 1 · `next/root-params` — <https://nextjs.org/docs/app/api-reference/functions/next-root-params> (`lastUpdated: 2026-06-24`)

Introduced in **v16.3.0** (version-history table).

> *"`next/root-params` can be used in Server Components. It cannot be used in Client Components, Server Actions, or Route Handlers. Support for Route Handlers is planned for a future release."*

> *"Most of these are permanent constraints of how root parameters work. The exception is Route Handlers, which are not supported yet but are planned for a future release."*

> *"Root parameter names must be valid JavaScript function identifiers. Kebab-cased segment names (e.g. `[post-slug]`) are not supported and will cause an error at dev time or during build."*

> *"A `generateStaticParams` function is only required with Cache Components, where each root parameter must have at least one value or the build fails."*

> *"Because root parameter getters are imported functions, Next.js can track which ones a cached function uses. Only those root parameters become part of the cache key, so cache entries are not split across unrelated parameter values."*

> *"Calling a root parameter getter inside `unstable_cache` will throw a runtime error. Use `"use cache"` instead."*

> *"When an application has multiple root layouts with different parameters, getter functions are typed to account for usage in any of all possible routes. A parameter that does not exist in every root layout has the type `string | undefined`."*

Return types: dynamic `[id]` → `string`; catch-all `[...path]` → `string[]`; optional
catch-all `[[...path]]` → `string[] | undefined`.

> *"You do not need to add `import 'server-only'` to files that use `next/root-params`. The import already fails at build time if used in a Client Component."*

Types are generated during `next dev`, `next build` or `next typegen`.

---

## 2 · `proxy.js` — <https://nextjs.org/docs/app/api-reference/file-conventions/proxy> (`lastUpdated: 2026-08-25`)

> *"The `middleware` file convention is deprecated and has been renamed to `proxy`."*

**Matcher** — the fact that costs you your CSS:

> *"Without a `matcher`, Proxy runs on **every request**, including static files (`_next/static`), image optimizations (`_next/image`), and assets in the `public/` folder."*

Recommended negative pattern from the docs:
`'/((?!api|_next/static|_next/image|.*\\.png$).*)'`

**Execution order** (numbered list in the doc):
1 `headers` from `next.config.js` · 2 `redirects` from `next.config.js` · 3 **Proxy** ·
4 `beforeFiles` rewrites · 5 filesystem routes · 6 `afterFiles` rewrites ·
7 dynamic routes · 8 `fallback` rewrites.

🔴 **The Server Function coverage gotcha:**

> *"Server Functions are not separate routes in this chain. They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on that path."*

> *"A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."*

**Runtime:**

> *"Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."*

**Headers — the two-option distinction:**

> *"`NextResponse.next({ request: { headers: requestHeaders } })` to make `requestHeaders` available upstream / **NOT** `NextResponse.next({ headers: requestHeaders })` which makes `requestHeaders` available to clients"*

> *"Avoid setting large headers as it might cause 431 Request Header Fields Too Large error depending on your backend web server configuration."*

**RSC requests:**

> *"During RSC requests, Next.js strips internal Flight headers from the `request` instance in Proxy. For example, headers like `rsc`, `next-router-state-tree`, and `next-router-prefetch` are not exposed through `request.headers`."*
> *"When you use `NextResponse.rewrite()`, Next.js automatically propagates the required RSC rewrite headers upstream."*

**Isolation guidance:**

> *"Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN for fast redirect/rewrite handling, you should not attempt relying on shared modules or globals."*

Only **one** `proxy.ts` per project is supported. Advanced flags: `skipProxyUrlNormalize`,
`skipTrailingSlashRedirect` (both since v13.1, renamed from the `Middleware` spellings).

From the getting-started page — <https://nextjs.org/docs/app/getting-started/proxy>:

> *"Using fetch with `options.cache`, `options.next.revalidate`, or `options.next.tags`, has no effect in Proxy."*

> *"Proxy is *not* intended for slow data fetching. While Proxy can be helpful for optimistic checks such as permission-based redirects, it should not be used as a full session management or authorization solution."*

---

## 3 · `use cache` — <https://nextjs.org/docs/app/api-reference/directives/use-cache>

**Cache key inputs (numbered list):** 1 Build ID (overridden by `deploymentId` if configured)
· 2 Function ID (secure hash of location + signature) · 3 Serializable arguments
(props/arguments) · 4 HMR refresh hash (development only).

> *"When a cached function references variables from outer scopes, those variables are automatically captured and bound as arguments, making them part of the cache key."*

> *"When a cached function reads root parameters, only the ones it actually reads become part of its cache key."*

**Request-time API ban:**

> *"Cached functions and components **cannot** access runtime APIs like `cookies()`, `headers()`, or `searchParams`, and the restriction follows the call stack: a helper the cached function calls that reads one of these fails the same way, with the `next-request-in-use-cache` error. On a dynamically rendered route this surfaces when the route runs, so it can pass `next build` and fail under `next start`."*

**Runtime storage table:**
- Serverless: *"Cache entries typically don't persist across requests (each request can be a different instance), or during revalidation. Build-time caching works normally."*
- Self-hosted: *"Cache entries persist across requests."* (size via `cacheMaxMemorySize`)

> *"Neither caching directive carries over to a new deploy, because the cache key includes the build (or `deploymentId`) ID."*

**`React.cache` isolation:**

> *"React.cache operates in an isolated scope inside `use cache` boundaries. Values stored via `React.cache` outside a `use cache` function are not visible inside it."*

**Draft Mode:** all cached functions re-execute per request and results are not saved.
`draftMode().isEnabled` is readable inside a cache scope; `cookies()`/`headers()` still are not.

**Client:** *"The client router enforces a **minimum 30-second stale time**, regardless of
configuration."* Communicated via `x-nextjs-stale-time`.

---

## 4 · `cacheTag` — <https://nextjs.org/docs/app/api-reference/functions/cacheTag>

> *"A single `cacheTag()` call accepts up to 128 tags, each with a maximum length of 256 characters. Tags longer than 256 characters are skipped, and any tags past the 128th in one call are dropped. Both cases log a console warning."*

Idempotent; multiple tags per call: `cacheTag('tag-one', 'tag-two')`. Requires
`cacheComponents: true`.

---

## 5 · `revalidateTag(tag, profile)` — <https://nextjs.org/docs/app/api-reference/functions/revalidateTag>

Signature: `revalidateTag(tag: string, profile: string | { expire?: number }): void`

> *"`revalidateTag` cannot be called in Client Components or Proxy, as it only works in server environments."*

Revalidation behaviour list:
- `profile="max"` (recommended): one-year window, requests always served stale while revalidating.
- `{ expire: 0 }`: stale never served; next request is a blocking revalidate/cache miss.
- **No second argument (deprecated)**: behaves like `{ expire: 0 }`.

> *"The single-argument form `revalidateTag(tag)` is deprecated. It currently works if TypeScript errors are suppressed, but this behavior may be removed in a future version."*

> *"A tag that exceeds the limit is never assigned to cached data, so revalidating it does nothing."*

> *"A revalidation is triggered by a request, not by the `revalidateTag` call, so pages using the tag revalidate as they are visited rather than all at once."*

---

## 6 · `updateTag(tag)` — <https://nextjs.org/docs/app/api-reference/functions/updateTag>

> *"`updateTag` can **only** be called from within Server Actions. It cannot be used in Route Handlers, Client Components, or any other context."*

> *"`updateTag` immediately expires the cached data for the specified tag. The next request will wait to fetch fresh data rather than serving stale content from the cache."*

Tag limit: 256 characters, case-sensitive.
Doc's own error-case comment: `// Error: updateTag can only be called from within a Server Action`.

---

## 7 · `revalidatePath(path, type?)` — <https://nextjs.org/docs/app/api-reference/functions/revalidatePath>

`path` max 1024 chars, case-sensitive. `type` is `'page' | 'layout'`, **required** when the
path contains a dynamic segment.

> *"Server Functions: Updates the UI immediately (if viewing the affected path). Currently, it also causes all previously visited pages to refresh when navigated to again. This behavior is temporary and will be updated in the future to apply only to the specific path."*

> *"Route Handlers: Marks the path for revalidation. The revalidation is done on the next visit to the specified path."*

🔴 **Rewrites:**

> *"When using rewrites, you must pass the **destination** path (the actual route file location), not the source path that appears in the browser's address bar."*
> *"This is because `revalidatePath` operates on the route file structure, not the URL visible to users. Cache entries are tagged based on which route file renders them."*

⚠️ **Not settled by the docs:** this rule is stated for `rewrites` in `next.config.js`. The
docs do **not** state it explicitly for a `NextResponse.rewrite()` from proxy. The mechanism
given (entries tagged by route file) implies the same behaviour; the pages say so and mark
it as unconfirmed.

`revalidatePath('/', 'layout')`: *"will purge the Client Cache, and invalidate all cached
data for revalidation on the next page visit."*

Layout invalidation cascades: *"Invalidates the layout ... all nested layouts beneath it,
and all pages beneath them."*

---

## 8 · `refresh()` — <https://nextjs.org/docs/app/api-reference/functions/refresh> (`lastUpdated: 2026-06-25`)

Signature `refresh(): void`, no return value, imported from `next/cache`.

> *"`refresh` allows you to refresh the client router from within a Server Action."*

> *"`refresh` can **only** be called from within Server Actions. It cannot be used in Route Handlers, Client Components, or any other context."*

The doc's only other content is a `createPost` example calling `refresh()` after a DB write,
and a Route Handler counter-example annotated `// This will throw an error`.

**The page is thin — the semantics live in the Server Actions guide (below).**

---

## 9 · Server Actions guide — <https://nextjs.org/docs/app/guides/server-actions>

**Single-response model.** A re-render is included in the same response when the action:
calls `updateTag` or `revalidatePath`; calls `refresh`; mutates cookies via `cookies()`;
or calls `redirect`.

> *"When `updateTag`, `revalidatePath`, or `refresh` runs, Next.js re-renders the current route server-side and includes a newly rendered RSC Payload in the action's response, so the page reflects the change in the same roundtrip. `revalidateTag` with a stale-while-revalidate profile intentionally skips that immediate re-render."*

**Choosing a cache update** (the four-way list):

> *"`refresh`: refetch the current route's RSC Payload without invalidating cached data. Use when the view depends on state outside the cache that the action just changed."*

> *"`updateTag`: immediate expiration of a tag. The next read (including the route re-render that ships with the action's response) waits for fresh data."*

> *"`revalidateTag`: stale-while-revalidate refresh of a tag with a cache-life profile. Subsequent reads get the stale value while a fresh fetch happens in the background, so the action's own re-render does **not** wait for the new data."*

**Sequential dispatch:**

> *"Next.js dispatches Server Actions one at a time per client."*
> *"do not rely on `Promise.all` to parallelize Server Actions from the client."*

**Security:** CSRF via `Origin` vs `Host`/`X-Forwarded-Host`; 1MB default body limit
(`serverActions.bodySizeLimit`); encrypted action IDs, rotated *"at most every 14 days"*;
closure variables encrypted, needing a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across
instances. `serverActions.allowedOrigins` accepts wildcards, e.g. `'*.my-proxy.com'`.

> *"Unlike `redirect`, none of these throw, so an action can call them and still return a value to the caller."*

---

## 10 · `useRouter().refresh()` — <https://nextjs.org/docs/app/api-reference/functions/use-router>

> *"`router.refresh()`: Refresh the current route. Making a new request to the server, re-fetching data requests, and re-rendering Server Components. The client will merge the updated React Server Component payload without losing unaffected client-side React (e.g. `useState`) or browser state (e.g. scroll position). This clears the Client Cache for the current route, but does **not** invalidate the server-side cache."*

> *"`refresh()` could re-produce the same result if fetch requests are cached. Other Request-time APIs like `cookies` and `headers` could also change the response."*

> *"`router.bfcacheId` ... changes when the surrounding segment is freshly created by a push or replace navigation, and stays the same for back/forward navigations, `router.refresh()`, and search-param- or hash-only navigations."*

---

## 11 · Data Security — <https://nextjs.org/docs/app/guides/data-security>

DAL requirements (bulleted): *"Only run on the server. Perform authorization checks. Return
safe, minimal Data Transfer Objects (DTOs)."*

> *"Secret keys should be stored in environment variables, but only the Data Access Layer should access `process.env`."*

Uses `React.cache` around `getCurrentUser()` so the same value is reachable everywhere
without prop drilling.

---

## 12 · `generateStaticParams` — <https://nextjs.org/docs/app/api-reference/functions/generate-static-params>

> *"During revalidation (ISR), `generateStaticParams` will not be called again."*

> *"To prevent unspecified paths from being prerendered at runtime, add the `export const dynamicParams = false` option in a route segment. When this config option is used, only paths provided by `generateStaticParams` will be served, and unspecified routes will 404."*

> *"When a parent dynamic segment is a root parameter, you can also read it inside a nested `generateStaticParams` by calling its getter from the `next/root-params` module."*

---

## 13 · PostgreSQL `SET` — <https://www.postgresql.org/docs/current/sql-set.html>

> *"SET only affects the value used by the current session."*
> *"Once the surrounding transaction is committed, the effects will persist until the end of the session, unless overridden by another SET."*
> *"The effects of SET LOCAL last only till the end of the current transaction, whether committed or not."*

This is the mechanism behind the pooled-connection RLS leak: a plain `SET app.tenant_id`
outlives the HTTP request because the pool's session does. `set_config(name, value, true)`
is the function form of `SET LOCAL` (third argument = `is_local`) and takes bind parameters,
which `SET` does not.

⚠️ **Not verified against primary sources:** PgBouncer transaction-mode behaviour and the
per-statement implicit-transaction behaviour of HTTP serverless Postgres drivers. The pages
state these as "verify against your own driver" rather than asserting them.

---

## 14 · Facts the pages state as explicitly uncertain

1. Whether the `revalidatePath` "pass the destination path" rule applies to a
   `NextResponse.rewrite()` from proxy as it does to `next.config` rewrites (§7).
2. Whether transaction-mode poolers and HTTP serverless drivers preserve `SET LOCAL` state
   the way the transaction pattern assumes (§13).
3. The docs do not describe the effect of calling `refresh()` more than once in one action;
   the pages say nothing about it rather than guessing.
