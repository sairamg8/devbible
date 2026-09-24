---
name: research-nextjs-ch6-export-and-walkthroughs
description: Banked primary-source research for the Next.js track's chapter 6 pages on static export vs serverful edge distribution, architecture decision walkthroughs and the SprintDesk three-strategy milestone. Verbatim load-bearing sentences with URLs, gathered 2026-09-04 against Next.js 16.3.4 docs. Read this instead of re-fetching nextjs.org for output:'export', the unsupported-features list, deployment feature fidelity, the CDN capability matrix or the rendering-philosophy spectrum argument.
metadata:
  type: reference
  track: nextjs
  gathered: 2026-09-04
---

# Banked research — Next.js static export, deployment fidelity, rendering philosophy

**Target: Next.js 16.3.4.** Every `.md` doc fetched carried `version: 16.3.4` frontmatter.
Fetch trick (confirmed again 2026-09-04): `https://nextjs.org/docs/<path>.md` serves clean
Markdown with `version:` and `lastUpdated:` frontmatter. All five URLs below returned **200**.

🔴 **Do not re-derive.** Chapter 6 pages 04/04b/04c, 05/05b/05c and 06/06b/06c were written
from this file.

---

## 1 · Static exports guide — <https://nextjs.org/docs/app/guides/static-exports> (`lastUpdated: 2026-08-25`)

Doc title: *"How to create a static export of your Next.js application"*.

> *"Next.js enables starting as a static site or Single-Page Application (SPA), then later optionally upgrading to use features that require a server."*

> *"When running `next build`, Next.js generates an HTML file per route. By breaking a strict SPA into individual HTML files, Next.js can avoid loading unnecessary JavaScript code on the client-side, reducing the bundle size and enabling faster page loads."*

> *"Since Next.js supports this static export, it can be deployed and hosted on any web server that can serve HTML/CSS/JS static assets."*

> *"After running `next build`, Next.js will create an `out` folder with the HTML/CSS/JS assets for your application."*

Config block from the doc, with its own commented options:
`output: 'export'`, optional `trailingSlash: true`, optional `skipTrailingSlashRedirect: true`,
optional `distDir: 'dist'`.

### Supported

> *"When you run `next build` to generate a static export, Server Components consumed inside the `app` directory will run during the build, similar to traditional static-site generation."*

> *"The resulting component will be rendered into static HTML for the initial page load and a static payload for client navigation between routes. No changes are required for your Server Components when using the static export, unless they consume dynamic server functions."*

> *"Since route transitions happen client-side, this behaves like a traditional SPA."*

Image Optimization **is** available via a custom loader:

> *"Image Optimization through `next/image` can be used with a static export by defining a custom image loader in `next.config.js`."*
(`images: { loader: 'custom', loaderFile: './my-loader.ts' }`; doc's example is a Cloudinary loader.)

Route Handlers, partially:

> *"Route Handlers will render a static response when running `next build`. Only the `GET` HTTP verb is supported. This can be used to generate static HTML, JSON, TXT, or other files from cached or uncached data. To ensure Route Handlers are prerendered, you must explicitly mark the handler as static by adding `export const dynamic = 'force-static'` when a static export is enabled."*

> *"The above file `app/data.json/route.ts` will render to a static file during `next build`, producing `data.json` containing `{ name: 'Lee' }`."*

> *"If you need to read dynamic values from the incoming request, you cannot use a static export."*

Browser APIs:

> *"Client Components are prerendered to HTML during `next build`. Because Web APIs like `window`, `localStorage`, and `navigator` are not available on the server, you need to safely access these APIs only when running in the browser."*

### 🔴 Unsupported Features — the list, verbatim and complete

> *"Features that require a Node.js server, or dynamic logic that cannot be computed during the build process, are **not** supported:"*

1. *"Dynamic Routes with `dynamicParams: true`"*
2. *"Dynamic Routes without `generateStaticParams()`"*
3. *"Route Handlers that rely on Request"*
4. *"Cookies"* — links to `/docs/app/api-reference/functions/cookies`
5. *"Rewrites"* — links to the `next.config.js` `rewrites` option
6. *"Redirects"* — links to the `next.config.js` `redirects` option
7. *"Headers"* — 🔴 **links to `/docs/app/api-reference/config/next-config-js/headers`, i.e. the config option, NOT the `headers()` request function**
8. *"Proxy"* — links to `/docs/app/api-reference/file-conventions/proxy`
9. *"Incremental Static Regeneration"*
10. *"Image Optimization with the default `loader`"*
11. *"Draft Mode"*
12. *"Server Actions"*
13. *"Intercepting Routes"*

> *"Attempting to use any of these features with `next dev` will result in an error, similar to setting the `dynamic` option to `error` in the root layout."*

⚠️ **Not settled by the docs:** the `headers()` *function* is not enumerated in that list.
It is covered only implicitly, by the Server Components sentence *"unless they consume dynamic
server functions"* (which anchor-links to `#unsupported-features`) and by *"If you need to read
dynamic values from the incoming request, you cannot use a static export."* Pages state the
config option as verified and the function as implied-but-not-enumerated.

⚠️ **Not settled by the docs:** the interaction between the export guide's error behaviour
(*"similar to setting the `dynamic` option to `error`"*) and an explicit
`export const dynamic = 'force-static'` on a **page** segment, which is documented elsewhere to
blank `cookies`/`headers()`/`useSearchParams()` instead of erroring. The guide only prescribes
`force-static` for Route Handlers. Pages state this as unresolved and recommend `'error'` on
page segments.

### Deploying / output shape

Example routes `/` and `/blog/[id]` produce: `/out/index.html`, `/out/404.html`,
`/out/blog/post-1.html`, `/out/blog/post-2.html`.

Nginx snippet from the doc uses `try_files $uri $uri.html $uri/ =404;` plus a
`location /blog/ { rewrite ^/blog/(.*)$ /blog/$1.html break; }` — *"This is necessary when
`trailingSlash: false`."*

GitHub Pages template: <https://github.com/nextjs/deploy-github-pages>.

### Version history table

| Version | Change |
|---|---|
| `v14.0.0` | *"`next export` has been removed in favor of `\"output\": \"export\"`"* |
| `v13.4.0` | *"App Router (Stable) adds enhanced static export support, including using React Server Components and Route Handlers."* |
| `v13.3.0` | *"`next export` is deprecated and replaced with `\"output\": \"export\"`"* |

---

## 2 · `output` config reference — <https://nextjs.org/docs/app/api-reference/config/next-config-js/output> (`lastUpdated: 2025-10-08`)

🔴 **This page does NOT document `output: 'export'` at all.** It is entirely about output file
tracing and `output: 'standalone'`. A reader who goes to the config reference for `'export'`
finds nothing; the guide in §1 is the only reference for it.

> *"During a build, Next.js will automatically trace each page and its dependencies to determine all of the files that are needed for deploying a production version of your application."*

> *"During `next build`, Next.js will use `@vercel/nft` to statically analyze `import`, `require`, and `fs` usage to determine all files that a page might load."*

> *"Next.js can automatically create a `standalone` folder that copies only the necessary files for a production deployment including select files in `node_modules`."*

> *"This minimal server does not copy the `public` or `.next/static` folders by default as these should ideally be handled by a CDN instead, although these folders can be copied to the `standalone/public` and `standalone/.next/static` folders manually, after which `server.js` file will serve these automatically."*

> *"There are some cases in which Next.js might fail to include required files, or might incorrectly include unused files. In those cases, you can leverage `outputFileTracingExcludes` and `outputFileTracingIncludes` respectively in `next.config.js`."*

Trace options do not affect: *"Edge Runtime routes are not affected. Fully static pages are not affected."*
Monorepo tracing root: `outputFileTracingRoot`.

---

## 3 · Deploying — <https://nextjs.org/docs/app/getting-started/deploying> (`lastUpdated: 2026-08-25`)

> *"Next.js can be deployed as a Node.js server, Docker container, static export, or adapted to run on different platforms."*

The feature-support table, verbatim:

| Deployment Option | Feature Support |
|---|---|
| Node.js server | All |
| Docker container | All |
| Static export | **Limited** |
| Adapters | Varies (verified adapters run the test suite) |

> *"Node.js deployments support all Next.js features."*
> *"Docker deployments support all Next.js features."*
> *"Running as a static export **does not** support Next.js features that require a server."*

Verified adapters listed: **Vercel**, **Bun**. *"Cloudflare and Netlify are working on verified adapters built on the Adapter API."*

---

## 4 · Deploying to platforms — <https://nextjs.org/docs/app/guides/deploying-to-platforms> (`lastUpdated: 2026-03-30`)

🔴 The single most useful sentence for the "what does a server actually buy you" argument:

> *"To run Next.js, your platform needs **a Node.js server**. That's it."*

> *"A single `next start` process handles every Next.js feature correctly: Server Components, ISR, PPR, Cache Components, Server Actions, Proxy, and `after()`."*

> *"Streaming support is needed for features like PPR and Server Components to deliver content progressively (without it, responses are buffered and sent as a whole, which still works but loses the streaming performance benefit)."*

> *"Additional infrastructure (CDN caching, edge compute, shared cache) primarily improves performance and multi-instance consistency."*

> *"The only additional dependency is the `sharp` package, which is required for Image Optimization."*

### Functional vs performance fidelity

> *"**Functional fidelity** means every Next.js feature works correctly. The adapter test suite is the contract: if a platform's adapter passes the tests, it supports Next.js. This is binary: it passes or it doesn't."*

> *"**Performance fidelity** means features achieve their optimal performance characteristics. Examples include PPR's static shell served at CDN latency rather than origin latency, or ISR serving stale content instantly with sub-second revalidation propagation."*

> *"A platform that achieves functional fidelity is a fully supported deployment target for Next.js. Performance fidelity is how platforms differentiate, and it improves incrementally over time."*

### Feature Support Matrix (verbatim table)

> *"The 'Edge Stitching' column is a **performance optimization**, not a correctness requirement. All features work correctly from a single origin server."*

| Feature | Streaming | Shared Cache | Edge Stitching | Notes |
|---|---|---|---|---|
| Server Components | Required | No | No | Basic streaming support |
| ISR (time-based) | No | Recommended | No | Works per-instance without shared cache |
| ISR (on-demand) | No | Recommended | No | Tag propagation needs shared cache for multi-instance |
| Partial Prerendering | Required | Recommended | Optional | — |
| Cache Components (`use cache`) | Required | Recommended | No | Shared cache enables cross-instance consistency |
| Proxy / Middleware | No | No | No | Runs at edge or origin |
| Server Actions | Required | No | No | POST requests with streaming response |
| `after()` | No | No | No | Requires graceful shutdown support |

> *"**Streaming Required** means the platform must support chunked transfer encoding or HTTP/2 streaming and must not buffer the response before sending it to the client."*

> *"Without shared cache, each instance maintains its own cache independently — features still work correctly on each instance, but revalidation events don't propagate across instances."*

Cache handler split: `cacheHandler` (singular) *"covers server cache paths like ISR, route handlers, patched `fetch`/`unstable_cache`, and image optimization"*; `cacheHandlers` (plural) *"configures `'use cache'` directive backends."*

### CDN Infrastructure Compatibility (verbatim table)

> *"These are available building blocks, not finished integrations."*

| CDN | Edge Compute | Key-Value / Tags | Blob Storage | PPR Resuming |
|---|---|---|---|---|
| Cloudflare | Workers | KV | R2 | Yes (worker) |
| Akamai | EdgeWorkers | EdgeKV | Object Storage | Yes (worker) |
| Amazon CloudFront | Lambda@Edge | KeyValueStore | S3 | Yes (Lambda) |
| Fastly | Compute | KV Store | Object Storage | Yes (WASM) |
| Azure | Functions | Managed Redis | Blob Storage | Yes (server) |
| Google Cloud | Cloud Run | Various KV | Cloud Storage | Yes (server) |

> *"Most community adapters today deploy Next.js as a Docker container or Node.js server without leveraging CDN-specific primitives like edge KV or PPR resuming."*

> *"Next.js's rendering model places the static/dynamic boundary at the component level rather than the route level. Finer-grained boundaries provide more flexibility for developers at the cost of broader requirements for hosting platforms. This is a deliberate trade-off."*

---

## 5 · Rendering philosophy — <https://nextjs.org/docs/app/guides/rendering-philosophy> (`lastUpdated: 2026-03-30`)

> *"Most web frameworks draw a hard line between static and dynamic at the route level. A page is either prerendered at build time or server-rendered at request time. This model is simple to understand and simple to deploy: you upload static files to a CDN and point dynamic routes at a server."*

> *"Next.js takes a different approach: **the boundary between static and dynamic is at the component level, not the route level.**"*

The three-model taxonomy, which is the spine of the decision walkthroughs:

- **Build-time prerendering** — > *"Every page is generated at build time. The output is static files that can be served from any CDN or file server with zero runtime infrastructure. Dynamic content, if any, requires client-side fetching after the page loads. This is the simplest model to deploy, but every content change requires a rebuild and redeploy."*
- **Route-level boundaries** — > *"Each route chooses whether it is static or dynamic. … This is straightforward to reason about but the choice is all-or-nothing per route. A mostly-static page with one dynamic element (a user greeting, a live price) must either be fully dynamic or fetch that element on the client after load."*
- **Component-level boundaries** — > *"This is the approach Next.js takes. Static and dynamic content coexist within a single streaming response."*

> *"The trade-off is infrastructure complexity. A finer-grained rendering boundary transfers complexity from application code into the hosting platform."*

What the model enables:

> *"**Granular caching.** Cache a function with `use cache`, not a route. Revalidate a tag, not a deployment. This means an expensive database query can be cached independently of the rest of the page."*

> *"**Incremental caching.** Developers can add caching and revalidation incrementally, without deciding upfront at build time whether a route is static or dynamic."*

Infrastructure implications: streaming required (single response carries both); cache
coordination required across instances; cache consistency because *"revalidation regenerates
both the HTML response and the RSC payload … If these get out of sync, users may see
inconsistent data during navigation"*; PPR shell at CDN latency needs extra integration.

---

## 6 · Facts reused from the existing corpus (already paid for — do not re-derive)

- `force-static` **blanks** `cookies`, `headers()` and `useSearchParams()` rather than erroring —
  verbatim *"forcing `cookies`, `headers()` and `useSearchParams()` to return empty values"*,
  from <https://nextjs.org/docs/app/guides/caching-without-cache-components>.
- `dynamic = 'error'` *"causes an error if any component uses Request-time APIs or uncached data"*.
- `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` **when
  `cacheComponents` is enabled**; the Route Segment Config reference in 16.3.4 no longer
  documents them.
- Route Handlers are **not** cached by default since `v15.0.0-RC`.
- `fetch()`'s default leaves a route **static and stale**, not dynamic.
- `request.ip` / `request.geo` were removed in `v15.0.0`.
- `generateStaticParams` is **not** called again during ISR revalidation;
  `dynamicParams = false` makes unlisted paths 404.

## 7 · Environment facts at time of writing

- **`next` is NOT installed in this checkout** — `require('next/package.json')` throws
  `MODULE_NOT_FOUND`, so **no T1 probe of the Next.js package is possible.** All Next.js claims
  in chapter 6 are T2 (documentation) only.
- `react` probes at **19.2.8**, which matches the corpus pin.
