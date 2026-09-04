---
title: "Appendix A · part 3 — the A–Z, every term cross-referenced to the chapter that teaches it, plus the six this book uses that the official glossary does not carry"
sidebar_label: "03 · Glossary — the A–Z"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the [Next.js Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated: 2026-08-25`), with the terms it omits sourced from [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp), [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents), [Adapters](https://nextjs.org/docs/app/api-reference/adapters) and [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16).
> Target: **Next.js 16.3.4**. Documentation-verified; **no sandbox run, no timings**.

**This is the lookup half of Appendix A: every term in the official glossary, in one place, each pointing at the chapter of this book that actually teaches it — followed by six terms this book uses constantly that the official glossary does not carry at all. Definitions in `> *"…"*` are verbatim; everything after a dash is this book's annotation, and is marked as such. Parts [1](01-appendix-a-glossary-ppr.md) and [2](01b-appendix-a-glossary-turbopack-mcp-instant.md) do the teaching; this page does the retrieval.**

🔴 **Read the redirects as redirects.** Four entries in the official glossary are pointers, not definitions — `Static rendering` → Prerendering, `Runtime rendering` → Dynamic rendering, `Middleware` → Proxy, and `ISR` is noted as *"also known as Revalidation"*. Treating any of them as a distinct concept invents a distinction the framework does not have.

---

## A

**App Router** — *"The Next.js router introduced in version 13, built on top of React Server Components. It uses file-system based routing and supports layouts, nested routing, loading states, error handling, and more."* → [ch 1](../01-introduction-to-next-js/01-explanation.md), [ch 2](../02-routing-and-navigation/01-explanation.md).

**App Shell** — *"A per-route prerender containing the parts of a page that don't depend on URL data."* Cached content is included only when its `stale` is **≥ 5 minutes**. → the full treatment is in [part 1](01-appendix-a-glossary-ppr.md); the mechanics are [ch 5](../05-caching-ppr-and-cache-components/01-explanation.md).

## B

**Build time** — *"The stage when your application is being compiled. During build time, Next.js transforms your code into optimized files for production, generates static pages, and prepares assets for deployment."* → [ch 11](../11-performance-optimization-turbopack/01-explanation.md).

## C

**Cache Components** — *"A feature that enables component and function-level caching using the `"use cache"` directive."* → [part 1](01-appendix-a-glossary-ppr.md), [ch 5](../05-caching-ppr-and-cache-components/01-explanation.md).

**Catch-all Segments** — *"Dynamic route segments that can match multiple URL parts using the `[...folder]/page.js` syntax."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Client Bundles** — *"JavaScript bundles sent to the browser. Next.js splits these automatically based on the module graph to reduce initial payload size."* → [ch 11](../11-performance-optimization-turbopack/01-explanation.md).

**Client Cache** — *"An in-memory cache in the browser that stores RSC Payload for visited and prefetched routes."* 🔴 *"Pages are not cached by default but are reused during browser back/forward navigation. The client cache is cleared on page refresh."* Invalidated by `revalidateTag`, `revalidatePath`, `updateTag`, `router.refresh`, `cookies.set` or `cookies.delete`; configured with `staleTimes` globally, or *"per-route via the `stale` property in `cacheLife` (recommended)."* → [ch 5](../05-caching-ppr-and-cache-components/01-explanation.md).

**Client Component** — *"A React component that runs in the browser. In Next.js, Client Components can also be rendered on the server during initial page generation."* → [ch 3](../03-server-components-vs-client-components/01-explanation.md).

**Client-side navigation** — *"A navigation technique where the page content updates dynamically without a full page reload."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Code Splitting** — *"The process of dividing your application into smaller JavaScript chunks based on routes."* → [ch 11](../11-performance-optimization-turbopack/01-explanation.md).

## D

**Dynamic rendering** — *"When a component is rendered at request time rather than build time. A component becomes dynamic when it uses Request-time APIs."* → [ch 6](../06-ssg-isr-and-ssr-strategy/01-explanation.md).

**Dynamic route segments** — *"Route segments that are generated from data at request time. Created by wrapping a folder name in square brackets (e.g., `[slug]`)."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

## E

**Environment Variables** — *"Configuration values accessible at build time or request time. In Next.js, variables prefixed with `NEXT_PUBLIC_` are exposed to the browser, while others are only available server-side."* 🔴 In 16, `serverRuntimeConfig` and `publicRuntimeConfig` were **removed**; env vars are the replacement. → [ch 16](../16-deployment-scaling-and-observability/01-explanation.md), [Appendix D](04-appendix-d-production-readiness-checklist-security.md).

**Error Boundary** — *"A React component that catches JavaScript errors in its child component tree and displays a fallback UI. In Next.js, create an `error.js` file to automatically wrap a route segment in an error boundary."* → [ch 7](../07-error-handling-loading-states-and-resilience/01-explanation.md).

## F

**File-system caching** — *"A Turbopack feature that stores compiler artifacts on disk between runs."* → [part 2](01b-appendix-a-glossary-turbopack-mcp-instant.md).

**Font Optimization** — *"Automatic font optimization using `next/font`. Next.js self-hosts fonts, eliminates layout shift, and applies best practices for performance."* → [ch 9](../09-styling-and-ui/01-explanation.md).

## H

**Hydration** — *"React's process of attaching event handlers to the DOM to make server-rendered static HTML interactive. During hydration, React reconciles the server-rendered markup with the client-side JavaScript."* → [ch 3](../03-server-components-vs-client-components/01-explanation.md).

## I

**Image Optimization** — *"Automatic image optimization using the `<Image>` component."* 🔴 Six of its defaults changed in 16 — see [Appendix B](02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md). → [ch 9](../09-styling-and-ui/01-explanation.md).

**Import Aliases** — *"Custom path mappings that provide shorthand references for frequently used directories."* → [ch 13](../13-testing-and-developer-experience/01-explanation.md).

**Incremental Static Regeneration (ISR)** — *"A technique that allows you to update static content without rebuilding the entire site."* The glossary adds: *"In Next.js, ISR is also known as Revalidation."* → [ch 6](../06-ssg-isr-and-ssr-strategy/01-explanation.md).

**Intercepting Routes** — *"A routing pattern that allows loading a route from another part of your application within the current layout. Useful for displaying content (like modals) without the user switching context, while keeping the URL shareable."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

## L

**Layout** — *"UI that is shared between multiple pages. Layouts preserve state, remain interactive, and do not re-render on navigation."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Loading UI** — *"Fallback UI shown while a route segment is loading. Created by adding a `loading.js` file to a folder, which automatically wraps the page in a Suspense boundary."* → [ch 7](../07-error-handling-loading-states-and-resilience/01-explanation.md).

## M

**Memoization** — *"Caching the return value of a function so that calling the same function multiple times during a render pass (request) only executes it once."* 🔴 Explicitly *"not Route Handlers since they are not part of the React component tree."* → [part 1](01-appendix-a-glossary-ppr.md), [ch 4](../04-data-fetching-in-the-app-router/01-explanation.md).

**Metadata** — *"Information about a page used by browsers and search engines, such as title, description, and Open Graph images."* → [ch 12](../12-seo-metadata-and-accessibility/01-explanation.md).

**Middleware** — *"See Proxy."* A redirect, not a definition. → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Module Graph** — *"A graph of file dependencies in your app. Each file (module) is a node, and import/export relationships form the edges."* → [ch 11](../11-performance-optimization-turbopack/01-explanation.md).

## N

**Not Found** — *"A special component shown when a route doesn't exist or when the `notFound()` function is called."* → [ch 7](../07-error-handling-loading-states-and-resilience/01-explanation.md).

## P

**Page** — *"UI that is unique to a route. Defined by exporting a React component from a `page.js` file within the `app` directory."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Parallel Routes** — *"A pattern that allows simultaneously or conditionally rendering multiple pages within the same layout. Created using named slots with the `@folder` convention."* 🔴 In 16 every slot **requires** an explicit `default.js` or the build fails. → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Partial Prefetching** — *"A prefetching strategy for Cache Components routes where a `<Link>` prefetches a per-route App Shell by default instead of the full page."* → [part 2](01b-appendix-a-glossary-turbopack-mcp-instant.md).

**Partial Prerendering (PPR)** — *"A rendering optimization that combines prerendering and dynamic rendering in a single route."* → [part 1](01-appendix-a-glossary-ppr.md).

**Prefetching** — *"Loading a route in the background before the user navigates to it. Next.js automatically prefetches routes linked with the `<Link>` component when they enter the viewport."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Prerendering** — *"When a component is rendered at build time or in the background during revalidation. The result is HTML and RSC Payload, which can be cached and served from a CDN."* → [ch 6](../06-ssg-isr-and-ssr-strategy/01-explanation.md).

**Private Folders** — *"Folders prefixed with an underscore (e.g., `_components`) that are excluded from the routing system."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Proxy** — *"A file (`proxy.js`) that runs code on the server before request is completed. Used to implement server-side logic like logging, redirects, and rewrites. Formerly known as Middleware."* 🔴 Node.js runtime only, and *"it cannot be configured."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

## R

**Redirect** — *"Sending users from one URL to another."* Configurable in `next.config.js`, returnable from Proxy, or triggered with `redirect()`. → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Request-time APIs** — *"Functions that access request-specific data, causing a component to opt into dynamic rendering"*: `cookies()`, `headers()`, `searchParams`, `draftMode()`. → [part 1](01-appendix-a-glossary-ppr.md), [ch 4](../04-data-fetching-in-the-app-router/01-explanation.md).

**Revalidation** — *"The process of updating cached data. Can be time-based (using `cacheLife()`…) or on-demand (using `cacheTag()` to tag data, then `updateTag()` to invalidate)."* → [ch 5](../05-caching-ppr-and-cache-components/01-explanation.md).

**Rewrite** — *"Mapping an incoming request path to a different destination path without changing the URL in the browser."* → [ch 17](../17-advanced-ecosystem-topics/01-explanation.md).

**Route Groups** — *"A way to organize routes without affecting the URL structure. Created by wrapping a folder name in parentheses (e.g., `(marketing)`)."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

**Route Handler** — *"A function that handles HTTP requests for a specific route, defined in a `route.js` file. Route Handlers use the Web Request and Response APIs and can handle `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS` methods."* → [ch 15](../15-databases-apis-and-full-stack-patterns/01-explanation.md).

**Route Segment** — *"A part of the URL path (between two slashes) defined by a folder in the `app` directory."* → [ch 2](../02-routing-and-navigation/01-explanation.md).

**RSC Payload** — *"a compact binary representation of the rendered React Server Components tree. It contains the rendered result of Server Components, placeholders for Client Components, and props passed between them."* → [part 1](01-appendix-a-glossary-ppr.md), [ch 3](../03-server-components-vs-client-components/01-explanation.md).

**Runtime rendering** — *"See Dynamic rendering."* A redirect. → [ch 6](../06-ssg-isr-and-ssr-strategy/01-explanation.md).

## S

**Server Action** — *"A Server Function that is passed to a Client Component as a prop or bound to a form action."* → [ch 10](../10-forms-authentication-and-security-hardening/01-explanation.md).

**Server Component** — *"The default component type in the App Router."* → [ch 3](../03-server-components-vs-client-components/01-explanation.md).

**Server Function** — *"An asynchronous function that runs on the server, marked with the `"use server"` directive."* → [part 1](01-appendix-a-glossary-ppr.md), [ch 10](../10-forms-authentication-and-security-hardening/01-explanation.md).

**Static Assets** — *"Files such as images, fonts, videos, and other media that are served directly without processing. Static assets are typically stored in the `public` directory."* → [ch 16](../16-deployment-scaling-and-observability/01-explanation.md).

**Static Export** — *"A deployment mode that generates a fully static site with HTML, CSS, and JavaScript files. Enabled by setting `output: 'export'`… can be hosted on any static file server without a Node.js server."* → [ch 6](../06-ssg-isr-and-ssr-strategy/01-explanation.md).

**Static rendering** — *"See Prerendering."* A redirect. → [ch 6](../06-ssg-isr-and-ssr-strategy/01-explanation.md).

**Static Shell** — *"The prerendered HTML structure of a page that's served immediately to the browser."* Not the same as the App Shell — [part 1](01-appendix-a-glossary-ppr.md) has the table.

**Streaming** — *"A technique that allows the server to send parts of a page to the client as they become ready, rather than waiting for the entire page to render."* → [ch 7](../07-error-handling-loading-states-and-resilience/01-explanation.md).

**Suspense boundary** — *"In Next.js, Suspense boundaries define where the static shell ends and streaming begins, enabling Partial Prerendering."* → [ch 7](../07-error-handling-loading-states-and-resilience/01-explanation.md).

## T

**Tree Shaking** — *"The process of removing unused code from your JavaScript bundles during the build process."* → [ch 11](../11-performance-optimization-turbopack/01-explanation.md).

**Turbopack** — *"A fast, Rust-based bundler built for Next.js."* → [part 2](01b-appendix-a-glossary-turbopack-mcp-instant.md), [ch 11](../11-performance-optimization-turbopack/01-explanation.md).

## U

**URL data** — *"Data that identifies a specific URL, such as the pathname and query parameters… URL data varies per link, not per session, so it can't be part of a shared App Shell."* → [part 1](01-appendix-a-glossary-ppr.md).

**`"use cache"` Directive** — *"A directive that marks a component or function as cacheable."* → [ch 5](../05-caching-ppr-and-cache-components/01-explanation.md).

**`"use client"` Directive** — *"A special React directive that marks the boundary between server and client code. It must be placed at the top of a file, before any imports or other code."* → [ch 3](../03-server-components-vs-client-components/01-explanation.md).

**`"use server"` Directive** — *"A directive that marks a function as a Server Function that can be called from client-side code."* → [ch 10](../10-forms-authentication-and-security-hardening/01-explanation.md).

## V

**Version skew** — *"After a new version of your application is deployed, clients that are still active may reference JavaScript, CSS, or data from an older build… it can cause missing assets, Server Action errors, and navigation failures. Next.js uses `deploymentId` to detect and handle version skew."* → [part 2](01b-appendix-a-glossary-turbopack-mcp-instant.md), [ch 16](../16-deployment-scaling-and-observability/01-explanation.md).

---

## 🔴 Six terms this book uses that the official glossary does not carry

Each is a real, documented feature. The glossary simply has no entry, so these definitions are sourced from the guide or reference that owns the feature — and that provenance is stated, rather than dressed up as a glossary quote.

| Term | Source that owns it | What it is |
|---|---|---|
| **MCP** | [`/docs/app/guides/mcp`](https://nextjs.org/docs/app/guides/mcp) | The Model Context Protocol support built into `next dev` at `/_next/mcp`, plus the separate `next-devtools-mcp` package an agent runs to reach it. [part 2](01b-appendix-a-glossary-turbopack-mcp-instant.md) |
| **Instant Navigations** | 16.3 release material | Umbrella name for `cacheComponents` + `partialPrefetching` + instant navigation validation. [part 2](01b-appendix-a-glossary-turbopack-mcp-instant.md) |
| **`AGENTS.md`** | [`/docs/app/guides/ai-agents`](https://nextjs.org/docs/app/guides/ai-agents) | A root file, with a Next.js-managed block, that points coding agents at the version-matched docs bundled in `node_modules/next/dist/docs/`. [Appendix C](03-appendix-c-tooling.md) |
| **Adapter** | [`/docs/app/api-reference/adapters`](https://nextjs.org/docs/app/api-reference/adapters) | The build-time contract a deployment platform implements — a typed description of the build, stable across minors. [ch 16](../16-deployment-scaling-and-observability/10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md) |
| **Skill** | [`/docs/app/guides/ai-agents`](https://nextjs.org/docs/app/guides/ai-agents) | A packaged multi-step agent workflow (`next-dev-loop`, `next-cache-components-adoption`, …), installed with `npx skills add`. 🔴 **Not** a docs replacement. [Appendix C](03-appendix-c-tooling.md) |
| **`deploymentId`** | [`/docs/app/api-reference/config/next-config-js/deploymentId`](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId) | The build identifier Next.js uses to detect version skew. [ch 16](../16-deployment-scaling-and-observability/01-explanation.md) |

## Gotchas

**★ Symptom: you search the glossary for "SSR" or "SSG" and find nothing.** Cause: neither is a Next.js 16 term. The vocabulary is prerendering / dynamic rendering / PPR, and ISR is filed under Revalidation. Fix: translate before you search — "SSG" is Prerendering, "SSR" is Dynamic rendering, "ISR" is Revalidation.

**★ Symptom: you treat `Static rendering` and `Prerendering` as two strategies and try to choose between them.** Cause: the glossary entry for Static rendering is the single line *"See Prerendering."* Fix: there is one concept. The same holds for Runtime rendering and Dynamic rendering.

**★ Symptom: a bug report says "cleared the cache and it still shows old data."** Cause: "the cache" is at least four things — the Client Cache in the browser, the cached output of `"use cache"` scopes, request-scoped memoization, and Turbopack's filesystem compiler cache. A page refresh clears only the first. Fix: name which cache before acting; the invalidation tool differs for each, and Turbopack's cache has nothing to do with data at all.

```ts
// Data the user just changed — expire it and re-read in the same request.
'use server'
import { updateTag } from 'next/cache'

export async function renameProject(id: string, name: string) {
  await db.projects.update(id, { name })
  updateTag(`project-${id}`)
}
```

**★ Symptom: a Route Handler is called from a Server Component "to keep data access in one place" and every page gains a round trip.** Cause: the handler is an HTTP endpoint; the Server Component is already on the server. The production checklist says it directly — *"do not call Route Handlers from Server Components to avoid an additional server request."* Fix: extract the shared logic into a plain module and let both the Server Component and the Route Handler import it.

**★ Symptom: an `@folder` parallel-route slot that worked on 15 fails the 16 build.** Cause: every slot now requires an explicit `default.js`. Fix: add one that returns `null` or calls `notFound()`, depending on whether an unmatched slot should be blank or a 404.

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null
}
```

**★ Symptom: `getConfig()` returns undefined after the 16 upgrade.** Cause: `serverRuntimeConfig` and `publicRuntimeConfig` were removed. Fix: read `process.env` directly, and where the value must be read at request time rather than baked into the build, call `connection()` first.

```tsx
import { connection } from 'next/server'

export default async function Page() {
  await connection()
  const config = process.env.RUNTIME_CONFIG
  return <p>{config}</p>
}
```

**★ Symptom: you cite a definition to a colleague and they cannot find it in the docs.** Cause: it is one of the six terms above, which are documented in guides but absent from the glossary. Fix: cite the guide, not the glossary — and say which, because "the docs say" is not checkable and this appendix's whole method is that a definition names its source.

## Interview questions

**★ Where does the official Next.js glossary file "SSG", "SSR" and "ISR"?**
It does not file the first two at all — they are not 16 vocabulary. The equivalents are Prerendering (build-time or background rendering producing HTML plus RSC Payload) and Dynamic rendering (request-time rendering triggered by a Request-time API). ISR does have an entry, and the entry itself notes it is *"also known as Revalidation"*, which is where the 16-era APIs — `cacheLife`, `cacheTag`, `updateTag` — actually live.

**★ Someone says "clear the cache". What do you need to know before you can act?**
Which cache. There are at least four with unrelated lifetimes and unrelated tools. The Client Cache is in-memory in the browser, holds RSC Payload for visited and prefetched routes, and is cleared on page refresh — or invalidated by `revalidateTag`, `revalidatePath`, `updateTag`, `router.refresh`, or a cookie write. The `"use cache"` output cache is server-side, has a `cacheLife` and tags, and is invalidated by tag. Request memoization lasts one render pass and cannot be cleared because it never persists. And Turbopack's filesystem cache holds compiler artifacts, not data, so clearing it changes build time and nothing a user sees.

**★ Why does the glossary define both "Server Function" and "Server Action" when one is a subset of the other?**
Because the subset is where the security boundary lands. Marking a function `"use server"` makes it a Server Function. Handing that function to a Client Component as a prop, or binding it to a form action, makes it a Server Action — and at that moment it acquires an ID and a public HTTP entry point. Two names let the docs attach the authorization rules to the second without implying every server-side helper needs them.

**★ A term you need is not in the glossary. What do you conclude?**
Nothing about whether it exists. The glossary has no entry for MCP, for Instant Navigations, for `AGENTS.md`, for adapters, for Skills or for `deploymentId`, and all six are current documented features with their own guides or API references. The correct move is to check the sitemap at `/docs/sitemap.md` and read the guide that owns the feature — and, when writing it down, to cite that guide rather than implying the glossary said it.

**★ Why is `Middleware` still in the glossary at all if it is just a pointer to `Proxy`?**
Because the rename is recent and searchable text outlives it — every existing blog post, Stack Overflow answer and codebase says "middleware". The redirect entry exists to land those readers on the current concept. The substantive change hiding behind the redirect is the runtime: `proxy` runs on Node.js and cannot be configured otherwise, so anyone who genuinely needs the edge runtime has to stay on the deprecated `middleware` convention for now.

**★ How would you use this glossary to review a pull request?**
As a vocabulary check on the description more than the diff. If a PR says "made this page SSR", I would ask which of two things it means: dynamic rendering because it reads a Request-time API, or streaming because it added a Suspense boundary — those have different costs and different fixes. If it says "cached it", I would ask which cache and what invalidates it. Most review disagreements about rendering are two people using one word for two mechanisms, and the glossary's redirects show that the framework itself has been consolidating that vocabulary rather than adding to it.

---

← [Glossary, part 2 — Turbopack, MCP, Instant Navigations](01b-appendix-a-glossary-turbopack-mcp-instant.md) · [Chapter 19 overview](01-explanation.md) · Next → [Appendix B · The React upgrade blueprint](02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md)
