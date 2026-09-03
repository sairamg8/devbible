---
sidebar_position: 12
title: "The outputs object is the honest inventory of a Next.js build: seven arrays, and a prerender classification that finally says out loud which responses need compute"
sidebar_label: "Adapter output types"
description: "Every build output type an adapter receives — pages, pagesApi, appPages, appRoutes, prerenders, staticFiles, middleware — plus the routeType/response/compute prerender classification and the fields that matter when packaging functions."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Adapters · Output Types](https://nextjs.org/docs/app/api-reference/adapters/output-types), [Adapters · API Reference](https://nextjs.org/docs/app/api-reference/adapters/api-reference), [Adapters · Supporting Immutable Static Assets](https://nextjs.org/docs/app/api-reference/adapters/immutable-static-assets), and the [Edge Runtime deprecation notice](https://nextjs.org/docs/messages/edge-runtime-deprecated).
> Target: **Next.js 16.3.4**. Adapter API stable since 16.2. Prior page: [11 · The two adapter hooks in detail](11-modifyconfig-and-onbuildcomplete-the-two-hooks-in-detail.md).

**`outputs` is where the adapter contract earns its keep. It is a complete inventory of what `next build` produced, sorted by the only distinction a hosting platform cares about — what needs a process, what needs bytes on a CDN, and what needs both. The prerender classification added alongside it (`routeType`, `response`, `compute`) is the first time Next.js has stated in machine-readable form whether a given URL can be served with zero server compute, needs a blocking render, or needs a resume. If you have ever argued with a platform about why a "static" page still hit the origin, this triple is the answer.**

## The seven arrays

```typescript
export interface AdapterOutputs {
  pages: Array<AdapterOutput['PAGES']>
  middleware?: AdapterOutput['MIDDLEWARE']
  appPages: Array<AdapterOutput['APP_PAGE']>
  pagesApi: Array<AdapterOutput['PAGES_API']>
  appRoutes: Array<AdapterOutput['APP_ROUTE']>
  prerenders: Array<AdapterOutput['PRERENDER']>
  staticFiles: Array<AdapterOutput['STATIC_FILE']>
}
```

What each one holds, as the reference defines them:

| Array | Contents |
| --- | --- |
| `outputs.pages` | React pages from the `pages/` directory |
| `outputs.pagesApi` | API routes from `pages/api/` |
| `outputs.appPages` | React pages from the `app/` directory |
| `outputs.appRoutes` | API **and metadata** routes from `app/` |
| `outputs.prerenders` | ISR-enabled routes and static prerenders |
| `outputs.staticFiles` | Static assets **and auto-statically optimized pages** |
| `outputs.middleware` | The middleware function, if the project has one |

Note that `appRoutes` covers metadata routes too — `sitemap.xml`, `opengraph-image`, `robots.txt`, `manifest.json` are all `APP_ROUTE` outputs, not static files, because they can be dynamic.

And the export escape hatch, which changes the shape of everything: when `config.output` is set to `'export'`, only `outputs.staticFiles` is populated. Every other array — `pages`, `appPages`, `pagesApi`, `appRoutes` and `prerenders` — is empty, because the entire application has been exported as static files and there is nothing left that needs a process.

## The function-shaped outputs share one shape

`PAGES`, `PAGES_API`, `APP_PAGE`, `APP_ROUTE` and `MIDDLEWARE` are the same object modulo `type`:

```typescript
{
  type: 'APP_PAGE'
  id: string           // Route identifier
  filePath: string     // Path to the built file
  pathname: string     // URL pathname. Includes .rsc suffix for RSC routes
  sourcePage: string   // Original relative source file path
  runtime: 'nodejs' | 'edge'
  assets: Record<string, string>        // key: relative path from repo root, value: absolute path
  assetsHashes: Record<string, string>  // content hash of each assets entry
  wasmAssets?: Record<string, string>   // bundled wasm files
  edgeRuntime?: {
    modulePath: string
    entryKey: string
    handlerExport: string
  }
  config: {
    maxDuration?: number
    preferredRegion?: string | string[]  // deprecated
    env?: Record<string, string>         // edge runtime only
  }
}
```

Four fields deserve attention.

**`pathname` includes `.rsc`.** The reference is explicit about it on `APP_PAGE`: the field is the URL pathname, and it carries an `.rsc` suffix for RSC routes. An adapter that builds a routing table by deduplicating on `pathname` will collapse the HTML and RSC variants of the same route into one entry and then serve the wrong body for client navigations. Treat `/dashboard` and `/dashboard.rsc` as distinct destinations.

**`assets` plus `assetsHashes` is a content-addressed upload plan.** `assets` maps repo-root-relative keys to absolute paths; `assetsHashes` uses the very same keys as `assets` and gives the content hash of each entry as the value. Between two builds, the intersection of unchanged hashes is exactly the set of files you can skip uploading. This is the mechanism behind fast incremental deploys, and it is handed to you rather than derived.

**`config.preferredRegion` is deprecated.** It still appears on every function-shaped output for compatibility, and the reference annotates it as deprecated where it lists it. An adapter should read it if present but must not treat it as the supported way to express data locality; a multi-region strategy now lives in where you place the origin and the cache, not in a route segment export. See [03 · Multi-region strategies and data-locality patterns](03-multi-region-strategies-and-data-locality-patterns.md).

**`runtime: 'edge'` is a legacy path.** The output-types page carries the warning inline next to the field — *"Note that the Edge Runtime is deprecated"* — and it is the only stability statement attached to this type. New adapters should implement the Node.js entrypoint path first and treat edge as compatibility surface.

## `MIDDLEWARE` — one output, and it is not always middleware

```typescript
{
  type: 'MIDDLEWARE'
  id: string
  filePath: string
  pathname: string      // Always '/_middleware'
  sourcePage: string    // Always 'middleware'
  runtime: 'nodejs' | 'edge'
  // ...assets, assetsHashes, wasmAssets, edgeRuntime as above
  config: {
    matchers?: Array<{
      source: string
      sourceRegex: string
      has: RouteHas[] | undefined
      missing: RouteHas[] | undefined
    }>
  }
}
```

The docs define the source of this output as either a `middleware` file or a `proxy` file — `middleware.ts` or `middleware.js`, `proxy.ts` or `proxy.js` — and only when one is present. Next.js renamed the file convention to `proxy`, but the output type kept its name and its synthetic `pathname` of `/_middleware`. Both file names produce the same `MIDDLEWARE` output — do not key on `sourcePage` expecting to distinguish them, because it is always the literal string `'middleware'`.

`config.matchers` is the pre-compiled invocation predicate. A platform that runs middleware at the edge evaluates these against the incoming path *before* deciding whether to invoke the function at all — which is the whole point of shipping matchers as regex rather than as source patterns.

## `STATIC_FILE` — the smallest type, and the one with a trapdoor

```typescript
{
  type: 'STATIC_FILE'
  id: string                        // Unique identifier for this static file output
  filePath: string                  // Absolute filesystem path to the built file
  pathname: string                  // The routable URL pathname for this static file
  immutableHash: string | undefined // Content hash when the filename contains a hash
}
```

`immutableHash` is the only field here that changes behaviour rather than describing it. The reference defines it as the content hash, present when the filename itself contains a hash, and says what that presence signifies: the file is immutable. A `STATIC_FILE` with an `immutableHash` must be servable **without** the `?dpl` query parameter and must never be deleted while any deployment still references it; a `STATIC_FILE` without one is deployment-scoped and requested with `?dpl`. That distinction has its own page in this chapter.

Note also that this array is documented as holding static assets *and auto-statically optimized pages* — a fully static Pages Router route lands here as HTML, not in `outputs.pages`.

## `PRERENDER` — the richest type, and the one worth reading twice

```typescript
{
  type: 'PRERENDER'
  id: string
  pathname: string
  parentOutputId: string  // ID of the source page/route
  groupId: number         // prerenders with same groupId revalidate together
  route: string           // e.g. /blog/[slug] for the prerendered path /blog/first
  routeType?: 'route' | 'fallback' | 'shell' | 'page'
  response?: 'empty' | 'initial' | 'complete'
  compute?: 'blocking' | 'resuming' | 'static'
  htmlSize?: number
  pprChain?: { headers: Record<string, string> }   // e.g. { 'next-resume': '1' }
  parentFallbackMode?: false | null | string
  fallback?: {
    filePath: string | undefined
    initialStatus?: number
    initialHeaders?: Record<string, string | string[]>
    initialExpiration?: number
    initialRevalidate?: number | false
    postponedState: string | undefined
  }
  config: {
    allowQuery?: string[]
    allowHeader?: string[]
    bypassFor?: RouteHas[]
    renderingMode?: 'STATIC' | 'PARTIALLY_STATIC'
    partialFallback?: boolean
    bypassToken?: string
  }
}
```

### `groupId` is a revalidation unit, not a cosmetic grouping

The reference calls it the revalidation group identifier and states the rule it encodes: prerenders that share a `groupId` revalidate together. An HTML prerender, its RSC payload, and its segment outputs share a group. A platform cache that expires them independently will serve an HTML shell from one generation with an RSC payload from another — the exact hydration-mismatch class of bug that is nearly impossible to reproduce. Expire by group.

### `config.allowQuery` is the cache key, and its absence is not "no query params"

The reference defines `allowQuery` as the allowed query parameters that are considered for the cache key. This is the field that stops `?utm_source=` from fragmenting your prerender cache into thousands of identical entries. Two sibling fields carry the escape hatches: `config.bypassFor` holds the cache bypass conditions, and `config.bypassToken` is a generated token whose presence signals that the prerender cache should be bypassed. Draft mode and preview, expressed as data rather than as a runtime special case.

### The classification triple

This is the most valuable addition to the output contract, and it is emitted only where it means something. The three fields — `routeType`, `response` and `compute` — are emitted **together**, and only on the primary response in a prerender group. The related RSC, data and segment outputs in that group omit all three. So do Pages Router templates configured with `fallback: false`, and the docs give the reason: those templates are never served for unmatched URLs, so there is no canonical response to classify.

`routeType` identifies the kind of canonical response:

- `route` — a non-UI route, such as a Route Handler.
- `page` — a page whose URL has no missing prerenderable parameters.
- `shell` — the most specific reusable page shell for its class of URLs.
- `fallback` — a reusable page response that can be specialized by filling in more prerenderable parameters.

`response` describes how complete the response is before any request-time work happens:

- `empty` — no initial page response can be served at all.
- `initial` — an initial response can be served, but it is not the completed page UI. In practice this only applies to UI routes that are partially prerenderable.
- `complete` — the response is complete. Note that this includes a zero-byte response body, such as a `204` from a Route Handler.

`compute` describes the request-time compute needed to serve the completed response:

- `blocking` — no initial response can be sent before request-time compute starts; once it has started, the response can stream while compute continues.
- `resuming` — an initial response is served while postponed work resumes on the server.
- `static` — no server compute is required per request.

Read as a routing decision table, this is enormously practical. `compute: 'static'` means the CDN can answer alone. `compute: 'resuming'` means send the shell from cache and start a resume against the origin. `compute: 'blocking'` means go to the origin first and stream from there. Before this triple existed, a platform inferred all three from the presence of a `postponedState` file and the `renderingMode` string.

`htmlSize` is scoped narrowly and it is easy to over-read. The reference says it is included only on the primary App Router HTML output, and that a value of `0` means the HTML shell is empty. Pages Router prerenders, Route Handlers and related RSC/data/segment outputs omit it entirely — `undefined` means "not applicable", `0` means "genuinely empty shell". Those are different facts.

## Gotchas

**★ Deduplicating the routing table on `pathname` and merging the RSC variant into the HTML one.**
App Router pages emit RSC destinations whose `pathname` carries a `.rsc` suffix. An adapter that builds `Map<pathname, output>` after stripping suffixes collapses them, and the platform then answers a client-side navigation with an HTML body. Key the routing table on `id`, and keep `.rsc` pathnames as first-class destinations.

**★ Expiring an HTML prerender independently of its RSC payload.**
They share a `groupId` precisely because they must revalidate together. A platform cache with per-object TTLs will drift them apart, producing a page whose server-rendered HTML and client-navigation payload disagree. Group cache entries by `groupId` and invalidate the group.

**★ Ignoring `config.allowQuery` and letting tracking parameters shard the cache.**
`?utm_source=newsletter` produces a distinct cache key unless the platform restricts the key to the allowed set. The symptom is a prerender cache with a near-zero hit rate on exactly the URLs that get shared. Build the cache key from `allowQuery` only:

```js
const key = new URL(request.url)
const allowed = new Set(prerender.config.allowQuery ?? [])
for (const param of [...key.searchParams.keys()]) {
  if (!allowed.has(param)) key.searchParams.delete(param)
}
```

**★ Reading `routeType`/`response`/`compute` off every prerender output and finding them missing.**
They are emitted *only* on the primary response in a group; RSC, data and segment outputs omit them, as do Pages Router templates with `fallback: false`. An adapter that requires them on every entry will crash on perfectly valid builds. Treat absence as "this is not the canonical response for its group" and fall back to the group's primary.

**★ Confusing `htmlSize: 0` with `htmlSize: undefined`.**
`0` is a real measurement — an empty HTML shell, which is meaningful for a PPR route whose entire body is postponed. `undefined` means the field does not apply to this output type at all. A `htmlSize || fallbackValue` expression conflates them and will silently substitute a default for a genuinely empty shell.

**★ Treating `sourcePage` as a way to tell `middleware.ts` from `proxy.ts`.**
The reference documents `sourcePage` on this output as always being the string `'middleware'`, and `pathname` as always being `/_middleware`. Both file conventions produce the same output with the same synthetic identity. If you need to know which file the user wrote, look at the project, not at the output.

**★ Packaging edge outputs by guessing the registry key from the filename.**
The `edgeRuntime` object exists so you do not have to: it carries `modulePath`, `entryKey` and `handlerExport`. The invoking-entrypoints reference gives this as a direct instruction — use `edgeRuntime` rather than deriving registry keys or handler names from filenames. Derived keys break the moment chunking changes — and the Edge Runtime is deprecated anyway, so this is a bug you would be introducing on a legacy path.

**★ Uploading every asset on every deploy when `assetsHashes` already told you which changed.**
Every function-shaped output carries `assetsHashes` keyed identically to `assets`. Comparing against the previous deployment's manifest turns a full upload into a delta. Platforms that skip this pay for it in build minutes on every single deploy, forever.

**★ Assuming a fully static Pages Router route appears in `outputs.pages`.**
The reference defines `staticFiles` as holding static assets *and* auto-statically optimized pages — and an auto-statically-optimized page is HTML on disk, so that is where it lands. An adapter that counts `outputs.pages` to decide "does this app need a server at all?" will overcount.

## Interview questions

**★ Why does the App Router emit two outputs for what looks like one route?**
Because a route is served two ways: as HTML for a document request, and as an RSC payload for a client-side navigation or prefetch. The `APP_PAGE` output's `pathname` carries a `.rsc` suffix for the RSC destination. A platform must route both, and must keep them consistent — which is why the prerendered versions of both share a `groupId`.

**★ What do `routeType`, `response` and `compute` let a platform do that it could not do before?**
Decide, from build data alone, whether a URL can be answered entirely by the CDN (`compute: 'static'`), needs the cached shell plus a resume against the origin (`compute: 'resuming'`), or must go to the origin first (`compute: 'blocking'`). Previously a platform inferred this from the presence of a `postponedState` file and the `renderingMode` string, which was a heuristic. The triple makes it a stated fact, and `response` separately tells you whether anything can be sent before that compute starts.

**★ What is `groupId` for, and what breaks without it?**
It marks the set of prerenders that revalidate together — typically an HTML shell, its RSC payload and its segment outputs. Without honouring it, a platform cache expires them independently and eventually serves an HTML document from one generation alongside an RSC payload from another. The failure surfaces as a hydration mismatch or a stale fragment appearing after navigation, and it is close to unreproducible on demand.

**★ Which output array is populated for `output: 'export'`, and why does it matter to an adapter?**
Only `staticFiles`. Every other array is empty because the whole application is static files. It matters because an adapter's sanity checks — "at least one app page exists", "middleware is present" — all fail on a valid export build unless the adapter branches on `config.output` first.

**★ How does an adapter make deploys incremental without inventing its own hashing?**
By using `assetsHashes`, which mirrors the keys of `assets` and gives the content hash of each traced dependency, and `immutableHash` on `STATIC_FILE` outputs. Comparing the current hashes with the previous deployment's manifest yields exactly the set of objects that must be uploaded. For immutable static assets the docs go further and describe verifying rather than re-uploading, because the same content hash is guaranteed to be the same bytes.

**★ What does `config.allowQuery` express, and what is the consequence of ignoring it?**
It is the allowlist of query parameters that participate in the prerender cache key. Ignoring it means every distinct query string — every `utm_` campaign parameter, every click identifier — creates a separate cache entry for an identical response, collapsing the hit rate on precisely the URLs that get shared widely. It is one of the most common causes of "our ISR cache never hits in production".

**★ `outputs.middleware` is a single value rather than an array. Why?**
Because Next.js allows exactly one middleware/proxy file per project. The output carries the compiled `config.matchers` so a platform can decide whether to invoke it for a given request without loading the function, and its `pathname` is the synthetic `/_middleware` rather than any real URL.

**★ An output has `runtime: 'edge'`. What should a new adapter do?**
Support it if it must, but not build for it. The output-types reference annotates the field with a note that the Edge Runtime is deprecated, and the invoking-entrypoints page repeats the same guidance from the other direction: new routes should use the Node.js runtime. The Node.js entrypoint interface — `handler(req, res, ctx)` over `IncomingMessage`/`ServerResponse` — is the path that will still be there in two majors.

{/* FOOTER */}
