---
name: research-nextjs-ch16-deployment
description: Banked verbatim primary-source quotes for devbible Next.js chapter 16 (Deployment, Scaling and Observability) — self-hosting, output standalone, Docker, instrumentation.ts, OpenTelemetry, logging, preferredRegion deprecation, Vercel deployments/environments/skew protection/deployment protection/regions/pricing. DO NOT RE-DERIVE.
metadata:
  type: research
  track: nextjs
  topic: ch16-deployment-scaling-observability
  gathered: 2026-09-04
---

# 🔴 do not re-derive — Next.js ch16 research bank

**Gathered 2026-09-04 in one pass.** Every quote below is verbatim from the URL named.
`next` is **not installed** in the devbible checkout, so **no T1 probe was possible**; this
is T0/T2 documentation evidence only. **No sandbox run, no timings, no output blocks.**

Version spine: **Next.js 16.3.4** (the docs' own `version:` frontmatter on every
nextjs.org page fetched below) · Node `>= 20.9` · Turbopack default bundler since 16.0.

---

## 1 · Deploying — https://nextjs.org/docs/app/getting-started/deploying
`version: 16.3.4` · `lastUpdated: 2026-08-25`

> "Next.js can be deployed as a Node.js server, Docker container, static export, or adapted to run on different platforms."

Feature-support table, verbatim:

| Deployment Option | Feature Support |
|---|---|
| Node.js server | All |
| Docker container | All |
| Static export | Limited |
| Adapters | Varies (verified adapters run the test suite) |

> "Next.js can be deployed to any provider that supports Node.js."
> "Docker deployments support all Next.js features."
> "Running as a static export **does not** support Next.js features that require a server."

Verified adapters listed: **Vercel** and **Bun**. "Cloudflare and Netlify are working on
verified adapters built on the Adapter API."

---

## 2 · Self-hosting — https://nextjs.org/docs/app/guides/self-hosting
`version: 16.3.4` · `lastUpdated: 2026-08-25`

**Reverse proxy**
> "When self-hosting, it's recommended to use a reverse proxy (like nginx) in front of your Next.js server rather than exposing it directly to the internet."
> "This allows the server to dedicate its resources to rendering rather than request validation."

**Image optimization**
> "Image Optimization through `next/image` works self-hosted with zero configuration when deploying using `next start`."
> "On glibc-based Linux systems, Image Optimization may require additional configuration to prevent excessive memory usage." (links to `sharp.pixelplumbing.com/install#linux-memory-allocator`)
> "Note that images are optimized at runtime, not during the build."

**Proxy**
> "Proxy works self-hosted with zero configuration when deploying using `next start`. Since it requires access to the incoming request, it is not supported when using a static export."

**Environment variables**
> "Next.js can support both build time and runtime environment variables."
> "**By default, environment variables are only available on the server**. To expose an environment variable to the browser, it must be prefixed with `NEXT_PUBLIC_`. However, these public environment variables will be inlined into the JavaScript bundle during `next build`."
> "This allows you to use a singular Docker image that can be promoted through multiple environments with different values."

Documented runtime-read pattern:
```tsx
import { connection } from 'next/server'

export default async function Component() {
  await connection()
  const value = process.env.MY_VALUE
}
```

**Caching and ISR**
> "Caching and revalidating pages (with Incremental Static Regeneration) use the **same Next.js server cache**. By default, this cache is stored on the local filesystem (on disk) of each Next.js server instance."
> "This works automatically for a single self-hosted `next start` instance with persistent local disk."

**Automatic caching headers**
> "Next.js sets the `Cache-Control` header of `public, max-age=31536000, immutable` to truly immutable assets. It cannot be overridden."
> "Dynamically rendered pages set a `Cache-Control` header of `private, no-cache, no-store, max-age=0, must-revalidate` to prevent user-specific data from being cached."

**Configuring caching**
> "By default, generated cache assets will be stored in memory (defaults to 50mb) and on disk."
> "If you are hosting Next.js using a container orchestration platform like Kubernetes, each pod will have a copy of the cache. To prevent stale data from being shown since the cache is not shared between pods by default, you can configure the Next.js cache to provide a cache handler and disable in-memory caching."

```jsx filename="next.config.js"
module.exports = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // disable default in-memory caching
}
```

Documented `cache-handler.js` skeleton (verbatim): class with `constructor(options)`,
`async get(key)`, `async set(key, data, ctx)` storing `{ value, lastModified, tags: ctx.tags }`,
`async revalidateTag(tags)` iterating the map, and `resetRequestCache() {}`.

> "For production deployments, use this as a starting point and extend it with durable storage, eviction policies, error handling, and distributed tag coordination."
> "If you are configuring backends for `'use cache'` directives, use `cacheHandlers`."
> "`revalidatePath` is a convenience layer on top of cache tags. Calling `revalidatePath` will call the `revalidateTag` function with a special default tag for the provided page."

**Build cache / build ID**
> "Next.js generates an ID during `next build` to identify which version of your application is being served. The same build should be used and boot up multiple containers."
> "If you are rebuilding for each stage of your environment, you will need to generate a consistent build ID to use between containers."
```jsx
module.exports = { generateBuildId: async () => process.env.GIT_HASH }
```
> "When `deploymentId` is set, Next.js uses a constant build ID and `generateBuildId` has no effect. Version skew is detected from the deployment ID instead."

**Multi-server deployments**
> "Next.js encrypts Server Function closure variables before sending them to the client. By default, a unique encryption key is generated for each build."
> "When running multiple server instances, all instances must use the same encryption key. Otherwise, a Server Function encrypted by one instance cannot be decrypted by another, causing \"Failed to find Server Action\" errors."
> "The key must be a base64-encoded value with a valid AES key length (16, 24, or 32 bytes). Next.js generates 32-byte keys by default."
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=your-generated-key next build`

**Version skew (self-hosted)**
> "Missing assets: The client requests JavaScript or CSS files that no longer exist on the server"
> "Server Function mismatches: The client invokes a Server Function using an ID from a previous build that the server no longer recognizes"
> "Navigation failures: Prefetched page data from an old deployment is incompatible with the new server"
> "Static assets include a `?dpl=<deploymentId>` query parameter"
> "Client-side navigation requests include an `x-deployment-id` header"
> "If a mismatch is detected, Next.js triggers a hard navigation (full page reload) instead of a client-side navigation."
> "When the application is reloaded, there may be a loss of application state if it's not designed to persist between page navigations."

**Streaming**
> "If you are using nginx or a similar proxy, you will need to configure it to disable buffering to enable streaming."
Documented fix: a `headers()` entry setting `X-Accel-Buffering: no` on `source: '/:path*{/}?'`.
> "**Load balancers** must support chunked transfer encoding or HTTP/2 streaming. Some cloud load balancers (for example, AWS ALB with Lambda integration) may buffer responses by default."
> "If using Partial Prerendering, streaming support is required. Without it, the static shell and dynamic content are delivered together after the full render completes, eliminating PPR's time-to-first-byte advantage."

**Multi-instance cache coordination**
> "By default, calling `revalidateTag()` on one instance only invalidates the cache on that instance. Other instances continue serving stale content until they independently discover the invalidation."
> "To coordinate tag invalidation across instances, implement the `refreshTags()` method in your custom cache handler. This method is called before each request and should sync tag state from shared storage (like Redis) so all instances learn about invalidations promptly."

**Cache Components**
> "Cache Components works by default with Next.js and is not a CDN-only feature. This includes deployment as a Node.js server (through `next start`) and when used with a Docker container."

**CDNs**
> "When using a CDN in front of your Next.js application, the page will include `Cache-Control: private` response header when dynamic APIs are accessed."
> "If the page is fully prerendered to static, it will include `Cache-Control: public` to allow the page to be cached on the CDN."

**`after`**
> "`after` is fully supported when self-hosting with `next start`."
> "When stopping the server, ensure a graceful shutdown by sending `SIGINT` or `SIGTERM` signals and waiting. The Next.js server will finish in-flight requests and execute any pending `after()` callbacks before exiting. Platforms should allow a configurable drain period (10-30 seconds is recommended)."

**`assetPrefix`**
> "Separating your assets to a different domain does come with the downside of extra time spent on DNS and TLS resolution."

---

## 3 · `output` — https://nextjs.org/docs/app/api-reference/config/next-config-js/output
`version: 16.3.4` · `lastUpdated: 2025-10-08`

> "During `next build`, Next.js will use `@vercel/nft` to statically analyze `import`, `require`, and `fs` usage to determine all files that a page might load."
> "Next.js can automatically create a `standalone` folder that copies only the necessary files for a production deployment including select files in `node_modules`."
> "This will create a folder at `.next/standalone` which can then be deployed on its own without installing `node_modules`."
> "Additionally, a minimal `server.js` file is also output which can be used instead of `next start`. This minimal server does not copy the `public` or `.next/static` folders by default as these should ideally be handled by a CDN instead, although these folders can be copied to the `standalone/public` and `standalone/.next/static` folders manually, after which `server.js` file will serve these automatically."

```bash
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
node .next/standalone/server.js
```

> "If your project needs to listen to a specific port or hostname, you can define `PORT` or `HOSTNAME` environment variables before running `server.js`. For example, run `PORT=8080 HOSTNAME=0.0.0.0 node server.js` to start the server on `http://0.0.0.0:8080`."

**Caveats**
> "While tracing in monorepo setups, the project directory is used for tracing by default."
> "There are some cases in which Next.js might fail to include required files, or might incorrectly include unused files. In those cases, you can leverage `outputFileTracingExcludes` and `outputFileTracingIncludes`."
> Keys are "route globs (matched with picomatch against the route path, e.g. `/api/hello`)"; values are "glob patterns resolved from the project root".
> "These options are applied to server traces and do not affect routes that do not produce a server trace file: Edge Runtime routes are not affected. Fully static pages are not affected."
> "Keep patterns as narrow as possible to avoid oversized traces (avoid `**/*` at the repo root)."

Documented "common include patterns for native/runtime assets":
```js
outputFileTracingIncludes: {
  '/*': ['node_modules/sharp/**/*', 'node_modules/aws-crt/dist/bin/**/*'],
}
```

---

## 4 · Official `with-docker` Dockerfile
https://github.com/vercel/next.js/tree/canary/examples/with-docker (raw fetched 2026-09-04)

Three stages: `dependencies`, `builder`, `runner`, `ARG NODE_VERSION=24.13.0-slim`.
Load-bearing runner lines, verbatim:
```
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir .next
RUN chown node:node .next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```
Comment verbatim from the builder stage:
> "If you want to speed up Docker rebuilds, you can cache the build artifacts by adding: `--mount=type=cache,target=/app/.next/cache`. This caches the `.next/cache` directory across builds, but it also prevents `.next/cache/fetch-cache` from being included in the final image, meaning cached fetch responses from the build won't be available at runtime."
Comment verbatim from the runner stage:
> "If you want to persist the fetch cache generated during the build so that cached responses are available immediately on startup, uncomment this line: `COPY --from=builder --chown=node:node /app/.next/cache ./.next/cache`"
And: `# Set the correct permission for prerender cache`.

---

## 5 · Deploying to platforms — https://nextjs.org/docs/app/guides/deploying-to-platforms
`version: 16.3.4` · `lastUpdated: 2026-03-30`

> "To run Next.js, your platform needs **a Node.js server**. That's it."
> "A single `next start` process handles every Next.js feature correctly: Server Components, ISR, PPR, Cache Components, Server Actions, Proxy, and `after()`."
> "The only additional dependency is the `sharp` package, which is required for Image Optimization."
> "**Functional fidelity** means every Next.js feature works correctly. The adapter test suite is the contract."
> "**Performance fidelity** means features achieve their optimal performance characteristics."
> "Without shared cache, each instance maintains its own cache independently — features still work correctly on each instance, but revalidation events don't propagate across instances."
> "`cacheHandler` (singular) covers server cache paths like ISR, route handlers, patched `fetch`/`unstable_cache`, and image optimization. `cacheHandlers` (plural) configures `'use cache'` directive backends."

Feature matrix (Streaming / Shared Cache / Edge Stitching): Server Components
Required/No/No · ISR time-based No/Recommended/No · ISR on-demand No/Recommended/No ·
PPR Required/Recommended/Optional · Cache Components Required/Recommended/No ·
Proxy No/No/No · Server Actions Required/No/No · `after()` No/No/No.

---

## 6 · `instrumentation.js` — https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
`version: 16.3.4` · `lastUpdated: 2026-06-09`

> "The `instrumentation.js|ts` file is used to integrate observability tools into your application, allowing you to track the performance and behavior, and to debug issues in production."
> "To use it, place the file in the **root** of your application or inside a `src` folder if using one."
> "The file exports a `register` function that is called **once** when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests. `register` can be an async function."
> "You can optionally export an `onRequestError` function to track **server** errors to any custom observability provider."
> "If you're running any async tasks in `onRequestError`, make sure they're awaited."
> "The `error` instance might not be the original error instance thrown, as it may be processed by React if encountered during Server Components rendering. If this happens, you can use `digest` property on an error to identify the actual error type."

Full documented type signature:
```ts
export function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: { [key: string]: string | string[] } },
  context: {
    routerKind: 'Pages Router' | 'App Router'
    routePath: string
    routeType: 'render' | 'route' | 'action' | 'proxy'
    renderSource: 'react-server-components' | 'react-server-components-payload' | 'server-rendering'
    revalidateReason: 'on-demand' | 'stale' | undefined
    renderType: 'dynamic' | 'dynamic-resume'
  }
): void | Promise<void>
```
> "`error`: The caught value is typed as `unknown`. Narrow it before reading properties like `message` or `digest`."
> "`revalidateReason: 'on-demand' | 'stale' | undefined // undefined is a normal request without revalidation`"
> "`renderType: 'dynamic' | 'dynamic-resume' // 'dynamic-resume' for PPR`"
> "The `instrumentation.js` file works in both the Node.js and Edge runtime, however, you can use `process.env.NEXT_RUNTIME` to target a specific runtime."

Version history: `v15.0.0` — "`onRequestError` introduced, `instrumentation` stable";
`v14.0.4` Turbopack support; `v13.2.0` introduced experimental.

Guide (https://nextjs.org/docs/app/guides/instrumentation, `lastUpdated: 2026-08-25`):
> "The `instrumentation` file should be in the root of your project and not inside the `app` or `pages` directory."
> "If you use the `pageExtensions` config option to add a suffix, you will also need to update the `instrumentation` filename to match."
> "We recommend importing the file from within the `register` function, rather than at the top of the file."
> "Next.js calls `register` in all environments, so it's important to conditionally import any code that doesn't support specific runtimes."

---

## 7 · `instrumentation-client.js` — https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
`version: 16.3.4` · `lastUpdated: 2026-07-28`

> "The `instrumentation-client.js|ts` file allows you to add monitoring, analytics code, and other side-effects that run before your application becomes interactive."
> "Unlike server-side instrumentation, you do not need to export any specific functions."
Execution timing, verbatim: "1. **After** the HTML document is loaded 2. **Before** React hydration begins 3. **Before** user interactions are possible"
> "Only synchronous, top-level code is guaranteed to complete before hydration. Asynchronous work started here (a `Promise`, `import()`, or top-level `await`) is not awaited and may resolve after hydration has begun, so treat it as fire-and-forget."
> "Next.js monitors initialization time in development and will log warnings if it takes longer than 16ms, which could impact smooth page loading."
> "You can export `onRouterTransitionStart` to observe the start of App Router navigations."
Signature: `onRouterTransitionStart(url: string, navigationType: 'push' | 'replace' | 'traverse')`.
> "Hook errors are isolated and do not affect navigation or other hooks."
> "`next.config.js` plugins (for example, wrappers like `withSentry`) can register their own client instrumentation module via the `instrumentationClientInject` option. Injected modules run before this file, in array order."
Version history: `v16.3.0` experimental router transition start event; `v15.3` introduced.

---

## 8 · OpenTelemetry — https://nextjs.org/docs/app/guides/open-telemetry
`version: 16.3.4` · `lastUpdated: 2026-08-25`

> "Next.js supports OpenTelemetry instrumentation out of the box, which means that we already instrumented Next.js itself."
Install: `@vercel/otel @opentelemetry/sdk-logs @opentelemetry/api-logs @opentelemetry/instrumentation`
```ts
import { registerOTel } from '@vercel/otel'
export function register() { registerOTel({ serviceName: 'next-app' }) }
```
> "Unlike `@vercel/otel`, `NodeSDK` is not compatible with edge runtime, so you need to make sure that you are importing them only when `process.env.NEXT_RUNTIME === 'nodejs'`."
> "If edge runtime support is necessary, you will have to use `@vercel/otel`."
> "If everything works well you should be able to see the root server span labeled as `GET /requested/pathname`."
> "Next.js traces more spans than are emitted by default. To see more spans, you must set `NEXT_OTEL_VERBOSE=1`."

Custom `next` attributes:
> "`next.span_name` - duplicates span name"
> "`next.span_type` - each span type has a unique identifier"
> "`next.route` - The route pattern of the request (e.g., `/[param]/user`)."
> "`next.rsc` (true/false) - Whether the request is an RSC request, such as prefetch."
> "`next.page` … It can be used as a unique identifier only when paired with `next.route` because `/layout` can be used to identify both `/(groupA)/layout.ts` and `/(groupB)/layout.ts`"

Default spans (name → `next.span_type`):
- `[http.method] [next.route]` → `BaseServer.handleRequest` — "the root span for each incoming request"
- `render route (app) [next.route]` → `AppRender.getBodyResult`
- `fetch [http.method] [http.url]` → `AppRender.fetch` — "This span can be turned off by setting `NEXT_OTEL_FETCH_DISABLED=1` in your environment. This is useful when you want to use a custom fetch instrumentation library."
- `executing api route (app) [next.route]` → `AppRouteRouteHandlers.runHandler`
- `getServerSideProps [next.route]` → `Render.getServerSideProps`
- `getStaticProps [next.route]` → `Render.getStaticProps`
- `render route (pages) [next.route]` → `Render.renderDocument`
- `generateMetadata [next.page]` → `ResolveMetadata.generateMetadata` — "a single route can have multiple of these spans"
- `resolve page components` → `NextNodeServer.findPageComponents`
- `resolve segment modules` → `NextNodeServer.getLayoutOrPageModule` (attribute `next.segment`)
- `start response` → `NextNodeServer.startResponse` — "This zero-length span represents the time when the first byte has been sent in the response."

Custom span example uses `trace.getTracer('nextjs-example').startActiveSpan(...)` from
`@opentelemetry/api` with `span.end()` in a `finally`.

---

## 9 · `logging` — https://nextjs.org/docs/app/api-reference/config/next-config-js/logging
`version: 16.3.4` · `lastUpdated: 2026-02-12`

🔴 **Development only.** Page title/description: "Configure logging behavior in the terminal
when running Next.js in **development mode**".
> "You can configure the logging level and whether the full URL is logged to the console when running Next.js in development mode."
> "Any `fetch` requests that are restored from the Server Components HMR cache are not logged by default. However, this can be enabled by setting `logging.fetches.hmrRefreshes` to `true`."
> "Server Function invocations are logged by default during development. You can disable this by setting `logging.serverFunctions` to `false`."
> "By default all the incoming requests will be logged in the console during development. You can use the `incomingRequests` option to decide which requests to ignore. Since this is only logged in development, this option doesn't affect production builds."
> "You can forward browser console logs (such as `console.log`, `console.warn`, `console.error`) to the terminal during development."
`browserToTerminal` values: `'warn'` (default when forwarding), `'error'`, `true`, `false`.
> "In addition, you can disable the development logging by setting `logging` to `false`."
Version history: `v16.2.0` `browserToTerminal` added (moved from
`experimental.browserDebugInfoInTerminal`) · `v15.4.0` experimental introduced ·
`v15.2.0` `incomingRequests` · `v15.0.0` `logging: false`, `fetches.hmrRefreshes` ·
`v14.0.0` `logging.fetches` stable.

---

## 10 · `preferredRegion` — DEPRECATED
https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/preferredRegion
`version: 16.3.4` · `lastUpdated: 2026-04-30` · page title is literally "preferredRegion (deprecated)"

> "**Deprecated:** The `preferredRegion` route segment config is deprecated. Remove the `preferredRegion` export from your route files."
> "The `preferredRegion` option allows you to specify the preferred deployment region for a route segment. This value is passed to your deployment platform."
> "`string[]`: Deploy the route to multiple specific regions. The route is deployed to **all** listed regions, not a single one chosen from the list."
> "If a `preferredRegion` is not specified, it will inherit the option of the nearest parent layout. The root layout defaults to `'auto'`."
> "A child segment's value overrides the parent, values are not merged."
> "Next.js passes the region values through to the deployment platform. The exact behavior and available region codes are platform-specific."
> "If deploying Next.js on Vercel, regions were previously only supported with `export const runtime = 'edge'`, which is now deprecated."

Deprecation message page (https://nextjs.org/docs/messages/preferred-region-deprecated) —
🔴 **names no framework-level successor.** Its entire migration section is:
> "Remove the `preferredRegion` export from your route files:"
> "```diff\n- export const preferredRegion = 'home'\n```"
> "This applies to all route files that support the `preferredRegion` segment config: `page.ts`, `layout.ts`, and `route.ts`."

⚠️ **Unsettled:** the Next.js docs do **not** name a replacement route-segment API. Region
placement is therefore a *platform* configuration concern (on Vercel: `vercel.json`
`regions` / `functions`). Write it that way; do not invent a framework successor.

Route Segment Config index table also marks `runtime: 'edge'` **(deprecated)**, and
`v16.0.0` "removed `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` when Cache
Components is enabled".

---

## 11 · Vercel — deployments & environments
https://vercel.com/docs/deployments (`last_updated: 2026-09-03`) ·
https://vercel.com/docs/deployments/environments (`last_updated: 2026-08-14`)

> "A **deployment** on Vercel is the result of a successful build of your project. Each time you deploy, Vercel generates a unique URL so you and your team can preview changes in a live environment."
> "The most common way to create a deployment is by pushing code to a connected Git repository. When you import a Git repository to Vercel, each commit or pull request (on supported Git providers) automatically triggers a new deployment."
> "Vercel provides three default environments—**Local**, **Preview**, and **Production**"
> "By default, Vercel creates a preview deployment when you: Push a commit to a branch that is **not** your production branch (commonly `main`); Create a pull request (PR) on GitHub, GitLab, or Bitbucket; Deploy using the CLI without the `--prod` flag, for example just `vercel`"
> "There are two types of preview URLs: **Branch-specific URL** – Always points to the latest changes on that branch; **Commit-specific URL** – Points to the exact deployment of that commit"
> 🔴 "The first deployment of a new project is always a **production** deployment. This happens even when you: Import a Git repository in the dashboard; Run `vercel` or `vercel deploy` from the CLI without `--prod`; Deploy from a branch that is not your production branch"
> "When a production deployment succeeds, Vercel updates your production domains to point to the new deployment"
> "For advanced workflows, you can disable the auto-promotion of deployments and manually control promotion."
> "Pro and Enterprise teams can create **Custom Environments** for more specialized workflows (e.g., `staging`, `QA`). Every environment can define its own unique environment variables"
> Custom environment limits: "**Pro**: 1 custom environment per project — **Enterprise**: 12 custom environments per project"
CLI: `vercel link`, `vercel env pull` → "This will populate the `.env.local` file in your application directory."
`vercel deploy --target=staging`, `vercel pull --environment=staging`.
Dashboard deployment actions: "**Redeploy**", "**Inspect**", "**Assign a Custom Domain**",
"**Promote to Production**: Convert a preview deployment to production (if needed)."

---

## 12 · Vercel — Deployment Protection
https://vercel.com/docs/deployment-protection (`last_updated: 2026-08-28`)

> "Deployment Protection lets you control who can access your preview and production URLs. You configure it at the project level, choosing both a **protection method** (how you protect) and a **protection scope** (what you protect)."
> "Deployment Protection requires authentication for all requests, including those to Routing Middleware."
> "On the Hobby plan, Vercel Authentication with Standard Protection is available. This protects your preview deployments and deployment URLs, but your production domain remains publicly accessible."
Methods: Vercel Authentication (all plans) · Passport (Enterprise) · Password Protection
(Enterprise, or paid add-on for Pro) · Trusted IPs (Enterprise).
Scopes: "**Standard Protection**: Protects all deployments **except** production domains.
**Available on all plans**" · "**All Deployments**: Protects **all** URLs, including
production domains. **Available on Pro and Enterprise plans**".
🔴 The migration trap, verbatim:
> "When you enable Standard Protection, the production generated deployment URL becomes restricted. Update any fetch requests that use `VERCEL_URL` or `VERCEL_BRANCH_URL` from System Environment Variables to target the same domain the user requested, since those variables will no longer be publicly accessible."
> "For client-side requests, use relative paths in the fetch call to target the current domain. This automatically includes the user's authentication cookie for protected URLs."
> "The Framework Environment Variable `VERCEL_URL` is prefixed with the name of the framework. For example, `VERCEL_URL` for Next.js is `NEXT_PUBLIC_VERCEL_URL`."
> "Protected Source Maps gates `.map` file requests behind Vercel Authentication, so you can ship browser source maps to production without exposing source code."
Advanced Deployment Protection add-on: "$150 per month" for Pro; "You must have used the
feature for **a minimum of 30 days** before you can disable it."

---

## 13 · Vercel — Skew Protection
https://vercel.com/docs/skew-protection (`last_updated: 2026-08-28`)

> "Version skew occurs when different versions of your application run on client and server, causing application errors and other unexpected behavior."
> "Vercel's Skew Protection resolves this problem at the platform and framework layer by using version locking, which ensures client and server use the exact same version."
> "the framework automatically includes the deployment ID in **framework-managed requests** from the client. These include: **Static assets** … **Client-side navigations**: Route transition data fetches and Server Actions … **Prefetches**"
> "The framework attaches the deployment ID as a `?dpl=` query parameter or `x-deployment-id` header"
> 🔴 "The framework doesn't automatically pin custom `fetch()` calls you make from client components."
> 🔴 "**The framework doesn't pin full-page navigations by default.** When the browser makes a top-level document request, such as a hard refresh, entering a URL in the address bar, or opening a link in a new tab, Vercel serves the latest production deployment. If a new deployment went live since the user's last page load, the client detects the version mismatch and triggers a full page reload"
> "Projects created after November 19th 2024 using one of the supported frameworks already have Skew Protection enabled by default."
> "Ensure your project has the Enable access to System Environment Variables setting enabled"
> "If a client requests a deployment that no longer exists or is older than the configured maximum age (via the `?dpl=` query parameter, `x-deployment-id` header, or `__vdpl` cookie), the request returns a 404."
> "The default maximum age is one day from deployment creation."
> "You can configure a maximum age up to your project's Deployment Retention limit."
> "Vercel automatically adjusts the maximum age to 60 days for requests from Googlebot and Bingbot in order to handle any delay between document crawl and render."
> "Deployments that have been deleted either manually or automatically using a retention policy will not be accessible through Skew Protection."
> "By default, Skew Protection ignores the deployment ID on cross-origin requests."
> "You can add up to 12 domains." — wildcard "only match one level of subdomain".
> "If you are using Next.js 14.1.4 or newer and building on Vercel, there is no additional configuration needed to enable Skew Protection."
> "If you're building outside of Vercel using `vercel build` and then deploying with `vercel deploy --prebuilt`, Skew Protection requires a custom deployment ID so the build-time ID matches the one Vercel assigns at deploy time."
> "When Vercel receives a request with the `__vdpl` cookie set, it routes that request to the deployment ID stored in the cookie, including document navigations."
> "Skew Protection is available for all deployment environments for Pro and Enterprise teams."
Monitoring: filter `skew_protection = 'active'` / `'inactive'` on the `requests` event.
Manual protocol for other frameworks: check `VERCEL_SKEW_PROTECTION_ENABLED === '1'`,
append `VERCEL_DEPLOYMENT_ID`.

---

## 14 · Vercel — regions and the global network
https://vercel.com/docs/regions (`last_updated: 2026-08-11`)

> "**Points of Presence (PoPs)**: We operate over 126 PoPs distributed across the globe."
> "**Vercel Regions**: Behind these PoPs, we maintain 20 compute-capable regions where your code can run close to your data."
> "**Private Network**: Traffic flows from PoPs to the nearest region through private, low-latency connections"
> "By maintaining fewer, dense regions, we increase cache hit probability."
> "PoPs terminate TCP and route requests over a private network to the nearest Vercel region with single-digit millisecond latency."
> "The Vercel region the request is routed to handles TLS encryption and decryption."
> 🔴 "Functions should be executed in the same region as your database, or as close to it as possible, for the lowest latency."
> "Vercel Functions default to running in the `iad1` (Washington, D.C., USA) region."
> "In the event of regional downtime, application traffic is automatically rerouted to the next closest region."
Region codes include `iad1` us-east-1 Washington DC · `cle1` us-east-2 Cleveland ·
`sfo1` us-west-1 San Francisco · `pdx1` us-west-2 Portland · `dub1` eu-west-1 Dublin ·
`lhr1` eu-west-2 London · `cdg1` eu-west-3 Paris · `fra1` eu-central-1 Frankfurt ·
`arn1` eu-north-1 Stockholm · `bom1` ap-south-1 Mumbai · `sin1` ap-southeast-1 Singapore ·
`syd1` ap-southeast-2 Sydney · `hnd1` ap-northeast-1 Tokyo · `icn1` ap-northeast-2 Seoul ·
`kix1` ap-northeast-3 Osaka · `hkg1` ap-east-1 Hong Kong · `gru1` sa-east-1 São Paulo ·
`yul1` ca-central-1 Montréal · `cpt1` af-south-1 Cape Town · `dxb1` me-central-1 Dubai.
Local dev region code is `dev1`.

## 14b · Vercel — configuring function regions
https://vercel.com/docs/functions/configuring-functions/region (`last_updated: 2026-08-11`)

> "In a globally distributed application, the physical distance between your function and its data source can impact latency and response times. Therefore, Vercel allows you to specify the region in which your functions execute, ideally close to your data source (such as your database)."
> "By default, Vercel Functions execute in *Washington, D.C., USA* (`iad1`) **for all new projects** to ensure they are located close to most external data sources, which are hosted on the East Coast of the USA."
```json filename="vercel.json"
{ "$schema": "https://openapi.vercel.sh/vercel.json", "regions": ["sfo1"] }
```
Per-function override documented example uses `"functions": { "api/eu-data.js": { "regions": ["cdg1"], "functionFailoverRegions": ["lhr1"] } }`.
> "Per-function `functionFailoverRegions` is Enterprise only and accepts up to 4 region identifiers. When set on a function, these values completely override the corresponding project-level setting for that function."
Plan limits: "Hobby | Single region · Pro | 5 regions · Enterprise | All regions"
> "Deploying to more regions than your plan allows causes the deployment to fail before the build step."
> "Vercel deploys Routing Middleware to all regions by default, regardless of your region settings. On the Hobby plan, Routing Middleware runs in fewer regions."
> 🔴 "If your functions communicate with external services, choosing regions far from those services increases latency. Select only regions close to your external services."
> "The region(s) set in the `functionFailoverRegions` property **must be different** from the default region(s) specified in the `regions` property."

---

## 15 · Vercel — pricing / cost model
https://vercel.com/docs/pricing (`last_updated: 2026-09-03`) ·
https://vercel.com/docs/functions/usage-and-pricing (`last_updated: 2026-06-16`) ·
https://vercel.com/docs/pricing/how-does-vercel-calculate-usage-of-resources (`last_updated: 2026-08-11`) ·
https://vercel.com/docs/image-optimization/limits-and-pricing (`last_updated: 2026-08-11`)

**Fluid compute — the three function meters**
> "**Active CPU** — This is the CPU time your code actively consumes in milliseconds. You are only billed during actual code execution and not during I/O operations (database queries, like AI model calls, etc.). Billed per CPU-hour. Pauses billing when your code is waiting for external services."
> "For example: If your function takes 100ms to process data but spends 400ms waiting for a database query, you're only billed for the 100ms of active CPU time."
> "**Provisioned Memory** — Memory allocated to your function instances (in GB). Billed for the entire instance lifetime in GB-hours. Continues billing while handling requests, even during I/O operations. … Memory is reserved for your function even when it's waiting for I/O. Billing continues until the last in-flight request completes."
> "**Invocations** — Counts each request to your function. Billed per incoming request. … Counts regardless of request success or failure."
> 🔴 "**Vercel bills Active CPU only while your code is actually running. If the request is waiting on I/O, CPU billing pauses but memory billing continues**."
> "After all requests complete, the instance is paused, and no CPU or memory charges apply until the next invocation. This means, you pay for memory whenever work is in progress, never for idle CPU, and nothing at all between requests."
Hobby included: Active CPU 4 hours · Provisioned Memory 360 GB-hrs · Invocations 1 million.
Regional Active CPU per hour: `iad1`/`cle1`/`pdx1` $0.128 · `fra1` $0.184 · `gru1` $0.221 ·
`kix1`/`hnd1` $0.202 · `cpt1` $0.200 (memory per GB-hr $0.0106 → $0.0183 across the same span).
Documented worked example: 4 GB function in `gru1`, 4 s active CPU, 10 s instance lifetime →
CPU $0.0002456 + memory $0.0002033 = $0.0004489 per invocation.

**What a request consumes**
> "Since it's static and cached on our global CDN, this only involves Edge Requests (the network requests required to get the content of the page) and Fast Data Transfer (the amount of content sent back to the browser)."
Edge Requests: "Charged per network request to the CDN"; Fast Data Transfer: "Charged based
on data moved to the user from the CDN".

**Image Optimization**
> "Image transformations are billed for every cache MISS and STALE."
> "**Image cache reads** — The total amount of Read Units used to access the cached image from the global cache, measured in 8KB units. It is *not* billed for every cache HIT, only when the image needs to be retrieved from the shared global cache. An image that has been accessed recently (several hours ago) in the same region will be cached in region and does *not* incur this cost."
> "**Image cache writes** — … measured in 8KB units. It is billed for every cache MISS and STALE."
> "Additionally, charges apply for Fast Data Transfer and Edge Requests when transformed images are delivered from Vercel's CDN to clients."
Hobby included: 5K transformations/month · 300K cache reads · 100K cache writes.
On-demand: transformations $0.05–$0.0812 per 1K · cache reads $0.40–$0.64 per 1M ·
cache writes $4.00–$6.40 per 1M.
> "The maximum size for an transformed image is **10 MB**"
> "Each source image has a maximum width and height of 8192 pixels"
> "A source image must be one of the following formats to be optimized: `image/jpeg`, `image/png`, `image/webp`, `image/avif`. Other formats will be served as-is"
Hobby overage behaviour: "New images will fail to optimize and instead return a runtime
error response with 402 status code. This will trigger the `onError` callback and show the
`alt` text instead of the image" and "Previously optimized images have already been cached
and will continue to work as expected, without error".

**Builds**
> "Basic build machines are included with Hobby. For paid teams, Basic is priced at $0.007 per build minute, based on 2 vCPUs at $0.0035 per CPU minute."
> "The duration of the build is rounded up to the nearest minute and then multiplied by the number of CPUs on the machine type. For example, if a build took 2 minutes and 34 seconds and used the Enhanced machine type, it will be priced at $0.084 (3 minutes x 8 CPUs x $0.0035)."

⚠️ **Unsettled / not written as fact:** the pricing page as fetched does **not** publish a
single per-unit rate for Edge Requests, Fast Data Transfer, or ISR reads/writes, and
`https://vercel.com/docs/incremental-static-regeneration/usage-and-pricing` returned
**404**. Chapter pages therefore name these as *metered resources* and describe what moves
them, and do **not** quote a price. Prices also move; the pages say to read the live page.

---

## 16 · Already-banked quotes reused from the corpus
(`grep -rh '^> \*"' docs/nextjs/pages` — already source-verified by earlier sessions)

> *"Background regeneration (stale-while-revalidate) runs on the instance that receives the triggering request. On platforms with per-request billing, this background work counts as additional compute."*
> *"By default the result stays in a per-instance, in-memory store that is ephemeral on serverless. `use cache: remote` moves it to a durable cache handler shared across instances, a network roundtrip that pays off only at a **high hit rate**."*
> *"All of these stores are scoped to a single deployment. A new deploy starts fresh, new prerenders are built, and `use cache` entries don't carry over, even durable `remote` ones, because the cache key includes the build id."*
> *"Every produced static shell can be served directly from a CDN, without going through to the upstream server. This makes direct navigations instant."*
> *"This per-link prefetch includes cached content that resolves after the destination URL is known. It costs a server invocation per prefetchable link."*
> *"You can use the `x-nextjs-cache` response header to observe cache behavior. Values are `HIT` (served from cache), `STALE` (served from cache, revalidating in background), `MISS` (not in cache, rendered fresh), or `REVALIDATED` (regenerated via on-demand revalidation)."*
> *"The only folder you need to host on your CDN is the contents of `.next/static/`, which should be uploaded as `_next/static/` … **Do not upload the rest of your `.next/` folder**"*
> *"**Self-hosted builds**: reuse the same working directory between builds. Containerized builds start from a clean layer and do not carry `.next/cache` over unless you cache or mount it explicitly."*
> *"not changed (even after a new deployment) or deleted (for as long as there are active deployments using them)"* — immutable static assets obligation

---

## 17 · Facts handed down the dispatch chain (do not re-derive)

- Next.js **16.3.4**; 16.3 GA 2026-08-03; 16.3 Active LTS, 15.5 Maintenance LTS.
- Node `>= 20.9`.
- Turbopack is the default bundler since 16.0 — a `webpack()` function in `next.config`
  is **silently not read**.
- `next lint` **removed** in 16.
- `priority` on `next/image` deprecated in 16 in favour of `preload`.
- Crawlers are served a full dynamic render, retiring most "SSR for SEO" reasoning.
- `next` is **not installed** in the devbible checkout — **no T1 probe possible.**
