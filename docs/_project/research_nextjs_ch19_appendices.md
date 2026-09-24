---
name: research-nextjs-ch19-appendices
description: Verbatim primary-source bank for Next.js chapter 19 (appendices A-E) — the official glossary, the MCP/agent tooling guides, the version-16 upgrade guide and the production checklist. do not re-derive.
metadata:
  type: project
---

# Research bank — Next.js chapter 19 (Appendices)

🔴 **do not re-derive.** Fetched 2026-09-04, session for ch19. Every source below was fetched
once, as **Markdown** (`nextjs.org/docs` serves Markdown when you append `.md` to the URL, or
send `Accept: text/markdown`). Each carries the site's own `version:` and `lastUpdated:`
frontmatter, quoted here — that is what makes staleness visible.

## The fetch trick worth keeping

- `https://nextjs.org/docs/sitemap.md` — semantic index of every docs path. **Use it before
  guessing a URL.** A wrong guess returns a *"Page Not Found"* body that reads like content.
- `/docs/llms.txt` (index) and `/docs/llms-full.txt` (single-file export) follow the
  [llms.txt convention](https://llmstxt.org/).
- Per-error pages live under `/docs/messages/<slug>` and are **not** bundled into the package.

## Paths confirmed to exist (2026-09-04)

`/docs/app/glossary` · `/docs/app/guides/mcp` · `/docs/app/guides/ai-agents` ·
`/docs/app/guides/upgrading` · `/docs/app/guides/upgrading/codemods` ·
`/docs/app/guides/upgrading/version-16` · `/docs/app/guides/production-checklist` ·
`/docs/app/guides/self-hosting` · `/docs/app/guides/deploying-to-platforms` ·
`/docs/app/guides/instrumentation` · `/docs/app/guides/open-telemetry` ·
`/docs/app/api-reference/cli/next` · `/docs/app/api-reference/cli/create-next-app`

🔴 **Confirmed NOT to exist:** `/docs/app/guides/mcp-server` (it is `/docs/app/guides/mcp`),
and **no accessibility page** appears in the sitemap under that name — a11y guidance lives at
`/docs/architecture/accessibility`, referenced from the production checklist.

---

## 1 · The official glossary — `/docs/app/glossary`
`version: 16.3.4` · `lastUpdated: 2026-08-25`

🔴 **It defines ~60 terms and has NO entry for `MCP` or for `Instant Navigations`** — both of
which this book's own syllabus names in Appendix A. That gap is the appendix's reason to exist.

Verbatim definitions (load-bearing ones only; the rest are in the fetched page):

- **App Shell** — *"A per-route prerender containing the parts of a page that don't depend on
  URL data. Cached content is included when its `stale` time is at least 5 minutes, since the
  shell is reused for longer than shorter-lived content stays fresh. Routes that read
  `cookies()` or `headers()` produce one that also includes session data, cached per session on
  the client. Used as the default prefetch payload during client navigations, the loading state
  when a per-link prefetch is not ready, and the fallback for ISR with Cache Components."*
- **Static Shell** — *"The prerendered HTML structure of a page that's served immediately to the
  browser. With Partial Prerendering, the static shell includes all statically renderable
  content plus Suspense boundary fallbacks for dynamic content that streams in later."*
  🔴 **These are two different things and the docs define them separately.**
- **Cache Components** — *"A feature that enables component and function-level caching using the
  `"use cache"` directive. Cache Components allows you to mix static, cached, and dynamic
  content within a single route by prerendering a static HTML shell that's served immediately,
  while dynamic content streams in when ready."*
- **Partial Prerendering (PPR)** — *"A rendering optimization that combines prerendering and
  dynamic rendering in a single route. The static shell is served immediately while dynamic
  content streams in when ready, providing the best of both rendering strategies."*
- **Partial Prefetching** — *"A prefetching strategy for Cache Components routes where a
  `<Link>` prefetches a per-route App Shell by default instead of the full page. Enable it with
  `partialPrefetching: true` in `next.config.ts`."*
- **Prerendering** — *"When a component is rendered at build time or in the background during
  revalidation. The result is HTML and RSC Payload, which can be cached and served from a CDN.
  Prerendering is the default for components that don't use Request-time APIs."*
- **Static rendering** — *"See Prerendering."* **Runtime rendering** — *"See Dynamic rendering."*
- **Dynamic rendering** — *"When a component is rendered at request time rather than build time.
  A component becomes dynamic when it uses Request-time APIs."*
- **Request-time APIs** — *"Functions that access request-specific data, causing a component to
  opt into dynamic rendering. These include:"* `cookies()`, `headers()`, `searchParams`,
  `draftMode()`.
- **Middleware** — *"See Proxy."* **Proxy** — *"A file (`proxy.js`) that runs code on the server
  before request is completed… Formerly known as Middleware."*
- **Client Cache** — *"An in-memory cache in the browser that stores RSC Payload for visited and
  prefetched routes… Pages are not cached by default but are reused during browser
  back/forward navigation. The client cache is cleared on page refresh."* Invalidated by
  `revalidateTag`, `revalidatePath`, `updateTag`, `router.refresh`, `cookies.set`,
  `cookies.delete`. Configure with `staleTimes` globally *"or per-route via the `stale`
  property in `cacheLife` (recommended)."*
- **Memoization** — *"Caching the return value of a function so that calling the same function
  multiple times during a render pass (request) only executes it once. In Next.js, `fetch`
  `GET` requests with the same URL and options are automatically memoized across Server
  Components, layouts, pages, and `generateMetadata`/`generateStaticParams` (but not Route
  Handlers since they are not part of the React component tree)."*
- **Revalidation** — *"The process of updating cached data. Can be time-based (using
  `cacheLife()`…) or on-demand (using `cacheTag()` to tag data, then `updateTag()` to
  invalidate)."* ISR *"is also known as Revalidation."*
- **Server Function** — *"An asynchronous function that runs on the server, marked with the
  `"use server"` directive."* **Server Action** — *"A Server Function that is passed to a Client
  Component as a prop or bound to a form action."* 🔴 **Every Server Action is a Server
  Function; the reverse is not true.**
- **RSC Payload** — *"a compact binary representation of the rendered React Server Components
  tree. It contains the rendered result of Server Components, placeholders for Client
  Components, and props passed between them."*
- **URL data** — *"Data that identifies a specific URL, such as the pathname and query
  parameters… URL data varies per link, not per session, so it can't be part of a shared App
  Shell."*
- **Version skew** — *"After a new version of your application is deployed, clients that are
  still active may reference JavaScript, CSS, or data from an older build. This mismatch
  between client and server versions is called version skew, and it can cause missing assets,
  Server Action errors, and navigation failures. Next.js uses `deploymentId` to detect and
  handle version skew."*
- **Turbopack** — *"A fast, Rust-based bundler built for Next.js. Turbopack is the default
  bundler for `next dev` and available for `next build`."*
- **File-system caching** — *"A Turbopack feature that stores compiler artifacts on disk between
  runs, reducing work across `next dev` or `next build` commands."*
- **Static Export** — *"Enabled by setting `output: 'export'`… can be hosted on any static file
  server without a Node.js server."*
- **Suspense boundary** — *"In Next.js, Suspense boundaries define where the static shell ends
  and streaming begins, enabling Partial Prerendering."*

---

## 2 · MCP — `/docs/app/guides/mcp`
`version: 16.3.4` · `lastUpdated: 2026-07-08` · title *"Enabling Next.js MCP Server for Coding Agents"*

- *"Next.js 16+ includes MCP support that enables coding agents to access your application's
  internals in real-time. To use this functionality, install the `next-devtools-mcp` package."*
- **Requirements:** *"Next.js 16 or above"*
- Config, verbatim, in `.mcp.json` at the project root:
  `{"mcpServers":{"next-devtools":{"command":"npx","args":["-y","next-devtools-mcp@latest"]}}}`
- *"When you start your development server, `next-devtools-mcp` will automatically discover and
  connect to your running Next.js instance."*
- **How it works:** *"Next.js 16+ includes a built-in MCP endpoint at `/_next/mcp` that runs
  within your development server. The `next-devtools-mcp` package automatically discovers and
  communicates with these endpoints"* — it can *"Connect to multiple Next.js instances running
  on different ports"* and *"Forward tool calls to the appropriate Next.js dev server."*
- **The nine tools, verbatim names + descriptions:**
  - `get_errors` — *"Retrieve current build errors, runtime errors, and type errors from your dev server"*
  - `get_logs` — *"Get the path to the development log file containing browser console logs and server output"*
  - `get_page_metadata` — *"Get metadata about specific pages including routes, components, and rendering information"*
  - `get_project_metadata` — *"Retrieve project structure, configuration, and dev server URL"*
  - `get_routes` — *"Get all routes that will become entry points by scanning the filesystem. Returns routes grouped by router type (appRouter, pagesRouter). Dynamic segments appear as `[param]` or `[...slug]` patterns"*
  - `get_server_action_by_id` — *"Look up Server Actions by their ID to find the source file and function name"*
  - `get_compilation_issues` — *"Retrieve compilation warnings and errors for the whole project from the bundler. **Turbopack only.**"*
  - `compile_route` — *"Trigger on-demand compilation of a specific route without making an HTTP request to it. Accepts either a `routeSpecifier` (e.g. `/blog/[slug]`…) or a `path`… **Turbopack only.**"*
  - (Documentation Gateway + Playwright MCP integration are listed as capabilities, not as named tools.)
- **Documentation Gateway** — *"Points your agent at the version-accurate docs bundled with your
  installed Next.js (in `node_modules/next/dist/docs/`), so explanations and generated code
  match the version you are running"*
- Troubleshooting, verbatim: ensure v16+, verify `.mcp.json`, start `npm run dev`, *"Restart
  your development server if it was already running"*, check the agent loaded the config.

---

## 3 · AI agents — `/docs/app/guides/ai-agents`
`version: 16.3.4` · `lastUpdated: 2026-08-25`

- *"Next.js ships version-matched documentation inside the `next` package… An `AGENTS.md` file
  at the root of your project directs agents to these bundled docs instead of their training
  data."*
- Bundled layout: `node_modules/next/dist/docs/` → `01-app/{01-getting-started,02-guides,03-api-reference}/`,
  `02-pages/`, `03-architecture/`, `index.mdx`.
- *"Agents always have access to docs that match your installed version, with no network request
  or external lookup required."* *"Most AI coding agents, including Claude Code, Codex, Cursor,
  and GitHub Copilot, automatically read `AGENTS.md` when they start a session."*
- **New projects:** *"`create-next-app` generates `AGENTS.md` and `CLAUDE.md` automatically."*
  Opt out with `--no-agents-md`.
- **Existing projects:** *"On Next.js 16.3 or later, run `next dev`. When an AI coding agent is
  detected in the environment and no managed block is present, Next.js auto-generates
  `AGENTS.md` and `CLAUDE.md` at the project root. Existing `AGENTS.md` or `CLAUDE.md` files are
  upserted, so content outside the managed block is preserved"*
- The managed block is delimited `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END:nextjs-agent-rules -->`
  and its body opens *"# This is NOT the Next.js you know"*. It states:
  *"This block is written and re-added by `next dev` — verify at
  `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only
  re-creates the uncommitted change; committing it with your work keeps the tree clean."*
  `CLAUDE.md` is generated as the single line `@AGENTS.md`.
- **Opt out:** `agentRules: false` in `next.config.ts`. *"We believe leaving auto-generation on
  is a good default. Benchmark results on nextjs.org/evals show agents do better when they read
  the bundled docs."*
- **Version floors:** *"On version 16.2, the docs are bundled but `AGENTS.md` is not
  auto-generated."* *"On version 16.1 and earlier, the docs are not bundled either. Use the
  legacy `agents-md` command, which downloads a version-matched copy to `.next-docs/`"* —
  `npx @next/codemod@canary agents-md`.
- **Docs over the network:** *"Append `.md` to any page URL on nextjs.org/docs for a plain
  Markdown version, and clients that send an `Accept: text/markdown` header get Markdown too.
  This includes the per-error pages under `/docs/messages`, which are not bundled."*
- **Runtime visibility:** `next dev` *"forwards browser console errors and warnings to the
  terminal (the `logging.browserToTerminal` config)"*. *"`next dev` also writes its PID, port,
  and URL to `.next/dev/lock`. A second `next dev` in the same project prints the running
  server's URL and the PID to kill, so an agent connects to the existing server instead of
  starting a duplicate."*
- **`agent-browser`** (github.com/vercel-labs/agent-browser) — *"a CLI that exposes the DOM,
  console, network, and Web Vitals as structured text."* With `--enable react-devtools` on
  `agent-browser open` *"it also reports the component tree and which Suspense boundaries are
  still pending."*
- **Copy prompt:** with Cache Components on, *"a blocking error presents labeled fixes, each
  making a different trade-off. The dev overlay adds a **Copy prompt** button"*. The same menu
  prints in the `next dev` terminal and in `next build` output. Its three labels are
  `[stream]`, `[cache]`, `[block]`, and the `[block]` one is
  *"Set `export const instant = false` to allow a blocking route"*.
- *"A production build minifies server code, so when the build error alone isn't enough,
  `next build --debug-prerender` turns on server source maps and continues past the first
  failure."*
- 🔴 **SKILLS ARE NOT WITHDRAWN.** *"Framework knowledge comes from the bundled docs, not from
  Skills. Benchmark results show that always-available context outperforms on-demand retrieval.
  Skills cover the tasks that are workflows rather than lookups."* Installed with
  `npx skills add vercel/next.js --skill <name>`; browsable at skills.sh/vercel/next.js and in
  the repo under `skills/`. Three workflow types: *"Runtime foundations"*, *"Interactive
  workflows"*, *"Unattended loops"*. Named Skills: `next-dev-loop`,
  `next-cache-components-adoption`, `next-cache-components-optimizer`,
  `next-partial-prefetching-adoption`.
  🔴 **This CONTRADICTS the pre-existing line in `docs/nextjs/pages/19-appendices/05-appendix-e-version-watchlist.md`**
  which said *"Withdrawn — the earlier first-party Skills, superseded by version-matched bundled
  docs."* The correct statement is narrower: Skills were **repositioned** — they no longer carry
  framework knowledge (the bundled docs do), but they ship today as workflow packages.
  **Fixed in Appendix E on 2026-09-04.**

---

## 4 · Upgrade to 16 — `/docs/app/guides/upgrading/version-16`
`version: 16.3.4` · `lastUpdated: 2026-08-25`

- **Codemod:** `npx @next/codemod@canary upgrade latest`. It can: *"Update `next.config.js` to
  use the new `turbopack` configuration · Migrate from `next lint` to the ESLint CLI · Migrate
  from deprecated `middleware` convention to `proxy` · Remove `unstable_` prefix from
  stabilized APIs · Remove `experimental_ppr` Route Segment Config from pages and layouts"*.
  *"The `upgrade` codemod does not run every migration codemod."* Also
  `npx @next/codemod@canary next-async-request-api .` and
  `npx @next/codemod@canary next-lint-to-eslint-cli .`
- **Floors:** *"Node.js 20.9+ | Minimum version now `20.9.0` (LTS); Node.js 18 no longer
  supported"* · *"TypeScript 5+ | Minimum version now `5.1.0`"* · Browsers
  *"Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+"*.
- 🔴 **React:** *"The App Router in **Next.js 16** uses the latest React Canary release, which
  includes the newly released React 19.2 features and other features being incrementally
  stabilized."* Highlights named: View Transitions, `useEffectEvent`, `Activity`.
  Manual install is `next@latest react@latest react-dom@latest`, plus `@types/react` and
  `@types/react-dom`.
  Corroborating quote already banked in this repo's corpus: *"The `App Router` uses React canary
  releases built-in, which include all the stable React 19 changes, as well as newer features
  being validated in frameworks, but you should still declare react and react-dom in
  package.json for tooling and ecosystem compatibility."*
- **Turbopack:** *"Starting with **Next.js 16**, Turbopack is stable and used by default with
  `next dev` and `next build`."* 🔴 *"If your project has a custom `webpack` configuration and
  you run `next build` (which now uses Turbopack by default), the build will **fail** to prevent
  misconfiguration issues."* Escapes: `next build --turbopack`, migrate the config, or
  `--webpack`. *"If you see failing builds because a `webpack` configuration was found, but you
  don't define one yourself, it is likely that a plugin is adding a `webpack` option"*.
  `experimental.turbopack` → top-level `turbopack`. `resolveAlias` replaces
  `resolve.fallback`. Sass: *"Turbopack fully supports importing Sass files from
  `node_modules`… while Webpack allowed the legacy tilde (`~`) prefix, Turbopack does not
  support this syntax."* FS caching on by default for dev and build via
  `experimental.turbopackFileSystemCacheForDev` / `…ForBuild`.
- **Async Request APIs:** *"Starting with **Next.js 16**, synchronous access is fully removed."*
  Covers `cookies`, `headers`, `draftMode`, `params` (layout/page/route/default/opengraph-image/
  twitter-image/icon/apple-icon) and `searchParams` in `page.js`. `npx next typegen` generates
  `PageProps`, `LayoutProps`, `RouteContext` (*"`typegen` was introduced in Next.js 15.5"*).
- **Also async in 16:** `params` **and** `id` for `opengraph-image`/`twitter-image`/`icon`/
  `apple-icon` image functions (but *"`generateImageMetadata` function continues to receive
  synchronous `params`"*), and `id` for the `sitemap` function.
- **PPR:** *"**Next.js 16** removes the experimental **Partial Prerendering (PPR)** flag and
  configuration options, including the route level segment `experimental_ppr`."* Opt in via
  `cacheComponents: true`. 🔴 *"PPR in **Next.js 16** works differently than in **Next.js 15**
  canaries. If you are using PPR today, stay in the current Next.js 15 canary you are using."*
- **`middleware` → `proxy`:** *"The `edge` runtime is **NOT** supported in `proxy`. The `proxy`
  runtime is `nodejs`, and it cannot be configured. If you want to continue using the `edge`
  runtime, keep using `middleware`."* `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`.
- **Caching APIs:** `revalidateTag` *"now requires a second argument specifying a `cacheLife`
  profile. The single-argument form is deprecated and will produce a TypeScript error."*
  `updateTag` is *"a new Server Actions-only API that provides **read-your-writes** semantics"*.
  `refresh` *"allows you to refresh the client router from within a Server Action."*
  `cacheLife`/`cacheTag` are stable — drop the `unstable_` prefix.
- **`next/image` breaking changes:** local images with query strings now need
  `images.localPatterns.search`; `minimumCacheTTL` default `60s` → **4 hours (14400)**;
  `16` removed from default `imageSizes`; `qualities` default → `[75]` only (*"a `quality` prop
  of 80, is coerced to 75"*); local-IP optimization blocked unless
  `images.dangerouslyAllowLocalIP`; `maximumRedirects` default unlimited → **3**.
  Deprecated: `next/legacy/image`, `images.domains` (use `remotePatterns`).
- **Removals:** AMP (`next/amp`, `useAmp`, `amp` config) · **`next lint`** (*"`next build` no
  longer runs linting"*; the `eslint` config option is removed too) · `serverRuntimeConfig` and
  `publicRuntimeConfig` (use env vars; *"use the `connection()` function before reading from
  `process.env`"* to read at runtime) · `devIndicators.appIsrStatus`/`buildActivity`/
  `buildActivityPosition` · `experimental.dynamicIO` and `experimental.useCache` ·
  `unstable_rootParams` (→ `next/root-params`).
  🔴 *"Enabling `cacheComponents` is not a rename-only change: it can surface build errors for
  uncached data outside of `<Suspense>` and requires adopting the Cache Components model."*
- **Other:** parallel-route slots *"now require explicit `default.js` files. Builds will fail
  without them."* · `@next/eslint-plugin-next` defaults to **ESLint Flat Config** · Next.js no
  longer overrides `scroll-behavior` unless `<html data-scroll-behavior="smooth">` ·
  `next dev` and `next build` use separate output dirs (`next dev` → `.next/dev`) and a lockfile
  prevents duplicates · 🔴 *"**Next.js 16** removes the `size` and `First Load JS` metrics from
  the `next build` output. We found these to be inaccurate in server-driven architectures using
  React Server Components."* · `next dev` no longer loads the config twice, so
  `process.argv.includes('dev')` in `next.config` is now `false` (`typegen` and `build` still
  visible) · React Compiler stable via top-level `reactCompiler: true` (not default; needs
  `babel-plugin-react-compiler`; *"Expect compile times… to be higher"*) · `sass-loader` v16.

---

## 5 · Production checklist — `/docs/app/guides/production-checklist`
`version: 16.3.4` · 🔴 `lastUpdated: **2026-03-10**`

🔴 **This page is the stalest thing in the docs set and Appendix D exists to correct it.**
Measured drift against 16.3, all confirmed from §4 above:

| The checklist says | Actually true at 16.3 |
|---|---|
| *"Partial Prerendering (experimental) will allow parts of a route to be dynamic"* + links `/blog/next-14` | PPR is **not experimental**; the flag was removed in 16 and PPR is the default under `cacheComponents` |
| *"Ensure requests that don't use `fetch` are cached"* → links `unstable_cache` | The 16 model is `"use cache"` + `cacheLife`/`cacheTag`; `cacheLife`/`cacheTag` lost the `unstable_` prefix |
| *"Use the built-in `eslint-plugin-jsx-a11y` plugin"* linking `/docs/architecture/accessibility#linting` | `next lint` was **removed in 16** and `next build` no longer lints — you run ESLint (flat config) or Biome yourself |
| *"Use the `@next/bundle-analyzer` plugin"* → link anchor is `package-bundling#nextbundle-analyzer-**for-webpack**` | Turbopack is the default bundler in 16 |
| Silent on `size` / `First Load JS` | 16 **removed** both metrics from `next build` output as *"inaccurate in server-driven architectures"* |
| Silent on `proxy` | `middleware` is deprecated in favour of `proxy` |

Its structure, verbatim headings: **Automatic optimizations** (Server Components ·
Code-splitting · Prefetching · Prerendering · Caching) → **During development** (Routing and
rendering · Data fetching and caching · UI and accessibility · Security · Metadata and SEO ·
Type safety) → **Before going to production** (Core Web Vitals · Analyzing bundles).

Load-bearing items worth quoting as still-correct:
- Route Handlers: *"do not call Route Handlers from Server Components to avoid an additional
  server request."*
- Server Actions: *"Verify authentication and authorization inside each action. Do not rely on
  Proxy or layout or page level checks alone. Move database access to a `server-only` Data
  Access Layer and consider rate limiting for expensive operations."*
- Request-time APIs *"will opt the entire route into Dynamic Rendering (or your whole
  application if used in the Root Layout)."*
- Env vars: *"Ensure your `.env.*` files are added to `.gitignore` and only public variables are
  prefixed with `NEXT_PUBLIC_`."*
- Tainting: *"Prevent sensitive data from being exposed to the client by tainting data objects
  and/or specific values."*
- a11y file conventions: `app/global-error.tsx` for *"consistent, accessible fallback UI"*,
  `app/global-not-found.tsx` to *"serve an accessible 404 for unmatched routes"*.
- CWV: *"Run lighthouse in incognito… This is a simulated test and should be paired with looking
  at field data"*; `useReportWebVitals` to ship Core Web Vitals to analytics.
- Bundle sizing tools named: Import Cost, Package Phobia, Bundle Phobia, bundlejs.

---

## 6 · Facts spent from the existing corpus, not re-fetched

`grep -rh '^> \*"' --include='*.md' docs/nextjs/pages` returns **484** already-sourced verbatim
quotes. Ones used in ch19:

- *"Additionally, `cacheComponents` implements **Partial Prerendering (PPR)** as the default
  behavior in the App Router. This means the `experimental.ppr` configuration flag and the
  `experimental_ppr` route segment configuration are no longer necessary and have been removed."*
- *"A single `next start` process handles every Next.js feature correctly: Server Components,
  ISR, PPR, Cache Components, Server Actions, Proxy, and `after()`."*
- *"Browsers receive the static shell instantly. Bots and crawlers are detected by their user
  agent and handled differently: because they need a complete document, Next.js skips the shell
  and renders the entire page dynamically at request time"*
- *"**Minimum of 30 seconds is enforced** to ensure prefetched links remain usable."* /
  *"`stale` under 30 seconds: excluded from prerenders, because a prefetch would expire before
  the user could click."*
- *"Insights don't show up in the HTTP response. An offending route still returns `200` with
  rendered HTML in dev. The insight only appears in the dev overlay, the dev-server log, or the
  MCP `get_errors` tool."*
- *"Turbopack does not support webpack plugins… We do support webpack loaders."*
- *"On platforms without native bindings (e.g. FreeBSD, OpenBSD), Next.js falls back to
  WebAssembly (WASM) bindings… **do not support Turbopack**. On these platforms, use the
  `--webpack` flag"*
- *"Codemods are transformations that run on your codebase programmatically."*

## 7 · Open / unsettled — written as uncertain on the page, never invented

- The docs do **not** state a version-support policy for `next-devtools-mcp` itself (it is
  installed `@latest` and versioned separately from `next`). Appendix C says so explicitly.
- The docs do **not** define `MCP` or `Instant Navigations` in the official glossary. Appendix A
  says so and sources both from the guides instead.
- `/docs/app/guides/production-checklist` carries `version: 16.3.4` in frontmatter while its
  body is dated `2026-03-10`. **The frontmatter version is the docs build, not a re-review of
  the body** — do not read it as "checked for 16.3".
