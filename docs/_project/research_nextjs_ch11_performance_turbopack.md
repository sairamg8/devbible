---
name: research-nextjs-ch11-performance-turbopack
description: 🔴 do not re-derive — banked primary-source research for Next.js chapter 11 (Turbopack, React Compiler, bundle analysis, Node vs Edge runtime, Core Web Vitals, instrumentation). Every load-bearing sentence quoted verbatim with its URL and lastUpdated date.
metadata:
  type: reference
---

# 🔴 do not re-derive — Next.js ch11 research bank

**Banked 2026-09-04.** Five fetches for the whole chapter. Every chunk of ch11 is written
from this file. Docs build `version: 16.3.4` on every page — **`lastUpdated:` is the real
review date and is recorded per source below.**

Reused without re-fetching: [[research-nextjs-ch5-cache-model-ppr-turbopack]] §5 (Turbopack
FileSystem cache, memory eviction, CI caching) and [[research-nextjs-ch16-deployment]] §6–§9
(`instrumentation`, `instrumentation-client`, OpenTelemetry, `logging`).

---

## 🔴 THE HEADLINE CORRECTION — `runtime = 'edge'` IS DEPRECATED

The ch11 stub `04` ("Node.js runtime vs. Edge runtime … choosing per route") and the chapter
overview `01-explanation.md` both teach `export const runtime = 'edge'` as a **live per-route
architectural choice.** It is deprecated in 16.3.

**Source 1 — Route Segment Config index**
`https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config.md`
`version: 16.3.4` · `lastUpdated: 2026-04-30`

The options table, verbatim:

| Option | Type | Default |
|---|---|---|
| `runtime` | `'nodejs' \| 'edge' (deprecated)` | `'nodejs'` |
| `preferredRegion` | `'auto' \| 'global' \| 'home' \| string \| string[] (deprecated)` | `'auto'` |
| `dynamicParams` | `boolean` | `true` |
| `maxDuration` | `number` | Set by deployment platform |

🔴 **Only the `'edge'` VALUE is deprecated, not the `runtime` option itself.** The option
still exists and still defaults to `'nodejs'`. Do not write "the `runtime` export is
deprecated" — that is wrong and the table above is the proof.

Version history, verbatim:

> *"`v16.0.0` — `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` removed when Cache Components is enabled."*
> *"`v16.0.0` — `export const experimental_ppr = true` removed. A codemod is available."*
> *"`v15.0.0-RC` — `export const runtime = \"experimental-edge\"` deprecated. A codemod is available."*

**Source 2 — the `runtime` sub-page**
`https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime.md`
`version: 16.3.4` · `lastUpdated: 2026-04-30`

> *"The `runtime` option allows you to select the JavaScript runtime used for rendering your route."*
> *"**`'nodejs'`** (default)"*
> *"**`'edge'`** (deprecated)"*
> *"The Edge Runtime is deprecated. Remove the `runtime` export from your route files. See Edge Runtime Deprecated."*
> *"This option cannot be used in Proxy."*

🔴 **The migration instruction is "remove the export", not "switch to nodejs"** — because
`'nodejs'` is already the default. Deprecation page: `/docs/messages/edge-runtime-deprecated`
(✅ **fetched 2026-09-04 — see Source 3 below; it publishes no rationale, so do not fetch it
again hoping for one**).

⚠️ **The whole page is four sentences and a two-item list.** It does **not** state cold-start
figures, memory limits, or an Edge API allow-list. Any such claim in ch11 must come from
somewhere else or be dropped. **Do not reconstruct the old Edge API surface from memory.**

Cross-check already in the corpus (ch5 lane, sourced):
> *"Cache Components requires the Node.js runtime. Migrate any routes that set the deprecated `runtime = 'edge'` export, and note that other server-side JavaScript runtimes are not guaranteed to work."*

And from [[research-nextjs-ch16-deployment]] §10 (`preferredRegion`, `lastUpdated: 2026-04-30`):
> *"If deploying Next.js on Vercel, regions were previously only supported with `export const runtime = 'edge'`, which is now deprecated."*

**What this means for page 04.** The page is no longer "choose a runtime per route." It is
**"the per-route runtime choice has been withdrawn, here is what replaced it and what to do
with the routes that still declare it."** ⚠️ **An earlier draft of this bank said "Proxy is the
one place an Edge-like constraint still bites" — that is WRONG and Source 4 below disproves it.**
Proxy has defaulted to Node.js since v16.0. What genuinely survives the withdrawal is
`instrumentation` still branching on `process.env.NEXT_RUNTIME`, and Proxy's *deployment*
constraint (it may run outside the app's main runtime, so globals are unreliable there).

---

### Source 3 — the deprecation message page (FETCHED 2026-09-04 by fork B)
`https://nextjs.org/docs/messages/edge-runtime-deprecated` — **no `lastUpdated` on the page.**

> *"One or more routes in your application use `export const runtime = 'edge'`, which is deprecated."*
> *"Remove the `runtime` export from your route files:"*
> *"The Node.js runtime is the default, so no replacement is needed."*
> *"This applies to all route files that support the `runtime` segment config: `page.ts`, `layout.ts`, `route.ts`, and API routes."*

Diff body: `- export const runtime = 'edge'`

🔴 **TWO FINDINGS THAT CHANGE HOW THIS IS TAUGHT.** The section heading is
**"Why This Warning Occurred"** — it is a *warning*, so **no build fails and nothing forces the
migration**; a codebase can sit on the deprecated value indefinitely. And **the page still gives
no rationale** for the deprecation. That question stays UNSETTLED — see §6.

### Source 4 — `proxy.md` (FETCHED 2026-09-04 by fork B)
`https://nextjs.org/docs/app/api-reference/file-conventions/proxy.md`
`version: 16.3.4` · `lastUpdated: 2026-08-25`

🔴🔴 **THIS CORRECTS AN EARLIER FRAMING IN THIS VERY BANK.** The ch11 dispatch called Proxy
"where an Edge-like constraint still genuinely bites." **It is not.**

> *"Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."*

Version history, verbatim:

| Version | Change |
|---|---|
| `v16.0.0` | *"Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime"* |
| `v15.5.0` | *"Middleware can now use the Node.js runtime (stable)"* |
| `v15.2.0` | *"…(experimental)"* |

**So the API-surface constraint is gone.** Setting `runtime` there throws **even for `'nodejs'`**.
What actually survives is a **deployment** constraint, and it is sharper:

> *"Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN for fast redirect/rewrite handling, you should not attempt relying on shared modules or globals."*
> *"It can run outside of your application's main runtime and handle requests before they reach your app."*

🔴 **That is a dev/production divergence with no error**: module-level globals work locally,
where proxy and render share a process, and silently do nothing in production where they may not.

> *"Server Functions are not separate routes in this chain. They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on that path."*

Platform support: Node.js server **Yes** · Docker **Yes** · Static export **No** · Adapters
**Platform-specific**.

⚠️ **The old corpus line "Middleware always runs on the Edge runtime (there's no opt-out)" is now
FLATLY WRONG** — it survives in ch11's generated `01-explanation.md` (line 41) and must go.

---

## 1 · Turbopack — the API reference (page 01)

`https://nextjs.org/docs/app/api-reference/turbopack.md`
`version: 16.3.4` · **`lastUpdated: 2026-08-03`**

> *"Turbopack is an **incremental bundler** optimized for JavaScript and TypeScript, written in Rust, and built into **Next.js**."*
> *"Turbopack is now the **default bundler** in Next.js. No configuration is needed to use Turbopack"*

**The four design claims, verbatim:**

> *"**Unified Graph:** Next.js supports multiple output environments (e.g., client and server). Managing multiple compilers and stitching bundles together can be tedious. Turbopack uses a **single, unified graph** for all environments."*
> *"**Bundling vs Native ESM:** Some tools skip bundling in development and rely on the browser's native ESM. This works well for small apps but can slow down large apps due to excessive network requests. Turbopack **bundles** in dev, but in an optimized way to keep large apps fast."*
> *"**Incremental Computation:** Turbopack parallelizes work across cores and **caches** results down to the function level. Once a piece of work is done, Turbopack won't repeat it. Results persist to disk between runs."*
> *"**Lazy Bundling:** Turbopack only bundles what is actually requested by the dev server. This lazy approach can reduce initial compile times and memory usage."*

**Version changes, verbatim:**

| Version | Changes |
|---|---|
| `v16.0.0` | *"Turbopack becomes the default bundler for Next.js. Automatic support for Babel when a configuration file is found."* |
| `v15.5.0` | *"Turbopack support for `build` beta"* |
| `v15.3.0` | *"Experimental support for `build`"* |
| `v15.0.0` | *"Turbopack for `dev` stable"* |

**Platforms — the escape hatch nobody documents downstream:**

Supported native bindings: macOS (Darwin) x64/ARM64 · Windows x64/ARM64 · Linux glibc
x64/ARM64 · Linux musl x64/ARM64.

> *"On platforms without native bindings (e.g. FreeBSD, OpenBSD), Next.js falls back to WebAssembly (WASM) bindings. WASM bindings support core SWC features like compilation and minification, but **do not support Turbopack**. On these platforms, use the `--webpack` flag"*

```bash
next dev --webpack
next build --webpack
```

**Fast Refresh, verbatim:**
> *"**Fast Refresh** — Supported. Updates JavaScript, TypeScript, and CSS without a full refresh."*
> *"**Incremental Bundling** — Supported. Turbopack lazily builds only what's requested by the dev server, speeding up large apps."*
> *"**FileSystem Cache** — Supported. Persists compiler artifacts to disk between runs."*

**Type-checking is NOT Turbopack's job:**
> *"Uses SWC under the hood. Type-checking is not done by Turbopack (run `tsc --watch` or rely on your IDE for type checks)."*

**Babel in 16 — the reversal:**
> *"Starting in Next.js 16, Turbopack uses Babel automatically if it detects a configuration file. Unlike in webpack, SWC is always used for Next.js's internal transforms and downleveling to older ECMAScript revisions. Next.js with webpack disables SWC if a Babel configuration file is present. Files in `node_modules` are excluded, unless you manually configure `babel-loader`."*

**Root layout:**
> *"**Root layout creation** — Unsupported. Automatic creation of a root layout in App Router is not supported. Turbopack will instruct you to create it manually."*

### 🔴 Known gaps with webpack — the migration gotchas, all verbatim

**Filesystem root:**
> *"Turbopack uses the root directory to resolve modules. Files outside of the project root are not resolved."*
> *"when linking dependencies outside the project root (via `npm link`, `yarn link`, `pnpm link`, etc.), those linked files will not be resolved by default. To resolve these files, you must configure the root option to the parent directory of both the project and the linked dependencies."*

**CSS Module ordering:**
> *"Turbopack will follow JS import order to order CSS modules which are not otherwise ordered."*
> *"Webpack generally does this as well, but there are cases where it will ignore JS inferred ordering, for example if it infers the JS file is side-effect-free."*
> *"This can lead to subtle rendering changes when adopting Turbopack, if applications have come to rely on an arbitrary ordering."*

**Sass tilde:**
> *"Turbopack supports importing `node_modules` Sass files out of the box. Webpack supports a legacy tilde `~` syntax for this, which is not supported by Turbopack."*

Fix, verbatim: `@import '~bootstrap/…'` → `@import 'bootstrap/…'`, or:
```js
module.exports = { turbopack: { resolveAlias: { '~*': '*' } } }
```

**🔴 Decimal precision — a real rendering difference:**
> *"Lightning CSS uses 5 digits of decimal precision for numeric CSS values, while webpack uses 10 digits. This applies to both plain CSS and Sass/SCSS output."*
> *"**Webpack:** `line-height: 1.4705882353` (10 digits)"* · *"**Turbopack:** `line-height: 1.47059` (5 digits)"*
> *"This can lead to subtle rendering differences when migrating from webpack to Turbopack, especially for properties like `line-height`, `letter-spacing`, or other calculated values where high precision matters."*

**Webpack plugins:**
> *"Turbopack does not support webpack plugins. This affects third-party tools that rely on webpack's plugin system for integration. We do support webpack loaders. If you depend on webpack plugins, you'll need to find Turbopack-compatible alternatives or continue using webpack until equivalent functionality is available."*

**Unsupported / unplanned, verbatim list:** standalone `:local`/`:global` pseudo-classes
(*"only the function variant `:global(...)` is supported"*) · the `@value` rule (*"superseded
by CSS variables"*) · `:import` and `:export` ICSS rules · `composes` in `.module.css`
composing a `.css` file · `@import` in CSS Modules importing `.css` as a CSS Module ·
`sassOptions.functions` (*"Turbopack's Rust-based architecture cannot directly execute
JavaScript functions"*) · **`webpack()` configuration** (*"Turbopack replaces webpack, so
`webpack()` configs are not recognized"*) · Yarn PnP (*"Not planned"*) ·
`experimental.urlImports` (*"Not planned"*) · `experimental.esmExternals` (*"Not planned"*) ·
`experimental.nextScriptWorkers` and `experimental.fallbackNodePolyfills` (*"We plan to
implement these in the future"*).

For `composes` and `@import` both: > *"In webpack this would treat the `.css` file as a CSS Module, with Turbopack the `.css` file will always be global."*

### The experimental `turbopack*` flag table — verbatim, with BOTH defaults

| Option | Default (dev) | Default (build) |
|---|---|---|
| `turbopackFileSystemCacheForDev` | `true` | N/A |
| `turbopackFileSystemCacheForBuild` | N/A | `true` ¹ |
| `turbopackMinify` | `false` | `true` |
| `turbopackSourceMaps` | `true` | `productionBrowserSourceMaps` |
| `turbopackInputSourceMaps` | `true` | `true` |
| `turbopackModuleFragments` | `false` | `false` |
| `turbopackRemoveUnusedImports` | `false` | `true` |
| `turbopackRemoveUnusedExports` | `false` | `true` |
| `turbopackInferModuleSideEffects` | `true` | `true` |
| `turbopackScopeHoisting` | `false` | `true` |
| `turbopackClientSideNestedAsyncChunking` | `false` | `true` |
| `turbopackServerSideNestedAsyncChunking` | `false` | `false` |
| `turbopackImportTypeBytes` | `false` | `false` |
| `turbopackUseBuiltinBabel` | `true` | `true` |
| `turbopackUseBuiltinSass` | `true` | `true` |
| `turbopackModuleIds` | `'named'` | `'deterministic'` |
| `turbopackLocalPostcssConfig` | `false` | `false` |
| `turbopackWorkerAssetPrefix` | `undefined` | `undefined` |

¹ verbatim note: *"Enabled by default. Set the option to `false` when the build environment
does not preserve the `.next/cache` directory between builds."*

Notes worth quoting: `turbopackModuleFragments` — *"Currently in active development. This
splits modules into fragments and chunks only import the used fragments of the modules."* ·
`turbopackRemoveUnusedImports` — *"Requires `turbopackRemoveUnusedExports`."* ·
`turbopackScopeHoisting` — *"Always disabled in dev mode."* · `turbopackWorkerAssetPrefix` —
*"Mirrors webpack's `output.workerPublicPath`."*

**Stable config keys** under the top-level `turbopack` key: `rules` (webpack loaders),
`resolveAlias`, `resolveExtensions`, `ignoreIssue`, `root`.

**Trace files:**
> *"If you encounter performance or memory issues and want to help the Next.js team diagnose them, you can generate a trace file by adding the `--internal-trace` flag"* — produces
`.next-profiles/trace-turbopack.bin`.

**`import.meta.env`** (Turbopack-only): `DEV`, `PROD`, `MODE`, `BASE_URL`, `SSR`.
> *"These values are statically analyzed, so Turbopack can remove unreachable branches"*
> *"`import.meta.env` requires Turbopack. Custom `VITE_*` variables, Vite custom modes, `envPrefix`, and `envDir` are not supported."*
> *"`SSR` — `true` in server bundles and `false` in browser and client bundles"*

⚠️ **`import.meta.glob` is already written up at ch11 position 10** — that page owns it.
Cross-link, do not re-teach.

---

## 2 · React Compiler (page 02)

`https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler.md`
`version: 16.3.4` · **`lastUpdated: 2026-02-11`**

> *"Next.js includes support for the React Compiler, a tool designed to improve performance by automatically optimizing component rendering. This reduces the need for manual memoization using `useMemo` and `useCallback`."*

**🔴 The SWC pre-filter — the mechanism most write-ups miss:**
> *"Next.js includes a custom performance optimization written in SWC that makes the React Compiler more efficient. Instead of running the compiler on every file, Next.js analyzes your project and only applies the React Compiler to relevant files. This avoids unnecessary work and leads to faster builds compared to using the Babel plugin on its own."*
> *"The React Compiler runs through a Babel plugin. To keep builds fast, Next.js uses a custom SWC optimization that only applies the React Compiler to relevant files—like those with JSX or React Hooks."*
> *"This avoids compiling everything and keeps the performance cost minimal. You may still see slightly slower builds compared to the default Rust-based compiler, but the impact is small and localized."*

Install + enable:
```bash
npm install -D babel-plugin-react-compiler
```
```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { reactCompiler: true }
export default nextConfig
```

**Opt-in mode, verbatim:**
> *"You can configure the compiler to run in \"opt-in\" mode as follows"*
```ts
const nextConfig: NextConfig = { reactCompiler: { compilationMode: 'annotation' } }
```
> *"Then, you can annotate specific components or hooks with the `\"use memo\"` directive from React to opt-in"*
> *"You can also use the `\"use no memo\"` directive from React for the opposite effect, to opt-out a component or hook."*

### ⚠️ TWO DOC STATEMENTS ABOUT COMPILE COST, DIFFERENT DATES — do not reconcile silently

| Where | Says |
|---|---|
| Already banked in the corpus (older) | *"Expect compile times in development and during builds to be higher when enabling this option as the React Compiler relies on Babel."* |
| Current `reactCompiler` page, `lastUpdated: 2026-02-11` | *"the impact is small and localized"* — because of the SWC pre-filter above |

🔴🔴 **THIS BANK GOT THE DATING BACKWARDS AND IT IS NOW CORRECTED (verified 2026-09-04).** An
earlier draft said *"the blunt warning predates the SWC pre-filter."* **False.** Confirmed by
direct fetch:

| Statement | Page | `lastUpdated` |
|---|---|---|
| *"the impact is small and localized"* | `reactCompiler` reference | **2026-02-11** |
| *"Expect compile times in development and during builds to be higher when enabling this option as the React Compiler relies on Babel."* | **version 16 upgrade guide** | **2026-08-25** |

**The harsher statement is on the page reviewed SIX MONTHS LATER.** So the reassuring line is the
older one. **Write both, dated, and do not claim either supersedes the other** — the docs
disagree with themselves and that is the honest thing to teach. Neither page gives a number.

⚠️ **The lesson generalises: "which statement is newer" is a fact to CHECK, not to infer from
which one sounds more like current engineering.** A tidy narrative ("they fixed it, so the old
warning is stale") is exactly what produced the wrong claim here.

**Also already banked in the corpus (release notes, sourced):**
> *"Built-in support for the React Compiler is now stable in **Next.js 16** following the React Compiler's 1.0 release. The React Compiler automatically memoizes components, reducing unnecessary re-renders with zero manual code changes."*
> *"The `reactCompiler` configuration option has been promoted from `experimental` to stable. It is not enabled by default as we continue gathering build performance data across different application types."*

🔴 **`reactCompiler` is a TOP-LEVEL key, not under `experimental`.** Stable since 16, **not on
by default.**

### 🔴 The Rust port is a DIFFERENT, EXPERIMENTAL feature — already verified 2026-09-03

Carried forward from the existing stub `01`, which recorded this correction:

| | Flag | Status |
|---|---|---|
| **React Compiler** | `reactCompiler: true` | **Stable.** Retires manual `useMemo`/`useCallback`. |
| **Rust port of it** | `experimental.turbopackRustReactCompiler` | 🔴 **Experimental.** Runs inside Turbopack instead of Babel-in-Node. |

Recorded gain, **conditional**: on a large app (v0) it cut time-to-ready-page by **34% cold /
46% warm**, *but those figures assume Babel is fully out of the pipeline.* Keep Babel for other
transforms and the gain shrinks, because you still pay to generate and reparse code. **Preserve
this block — it is the chapter's cleanest measure-before-adopting example.**

---

## 3 · Bundle analysis and lazy loading (page 03)

### 3a · `next experimental-analyze` — the first-party tool
`https://nextjs.org/docs/app/guides/package-bundling.md`
`version: 16.3.4` · **`lastUpdated: 2026-06-01`**

> *"Bundling is the process of combining your application code and its dependencies into optimized output files for the client and server. Smaller bundles load faster, reduce JavaScript execution time, improve Core Web Vitals, and lower server cold start times."*
> *"Next.js automatically optimizes bundles by code splitting, tree-shaking, and other techniques. However, there are some cases where you may need to optimize your bundles manually."*

🔴 **There are TWO tools and the page names them by bundler:**
> *"Next.js Bundle Analyzer for Turbopack (experimental)"* and *"`@next/bundle-analyzer` plugin for Webpack"*

> *"Available in v16.1 and later."*
> *"The Next.js Bundle Analyzer is integrated with Turbopack's module graph. You can inspect server and client modules with precise import tracing, making it easier to find large dependencies."*

```bash
npx next experimental-analyze
npx next experimental-analyze --output
```
> *"Within the UI, you can filter by route, environment (client or server), and type (JavaScript, CSS, JSON), or search by file"*
> *"The treemap shows each module as a rectangle. Where the size of the module is represented by the area of the rectangle."*
> *"Click a module to see its size, inspect its full import chain and see exactly where it's used in your application"*
> *"If you want to share the analysis with teammates or compare bundle sizes before/after optimizations, you can skip the interactive view and save the analysis as a static file with the `--output` flag"*
> *"This command writes the output to `.next/diagnostics/analyze`. You can copy this directory elsewhere to compare results"*

```bash
cp -r .next/diagnostics/analyze ./analyze-before-refactor
```

🔴 **The heading is literally *"`@next/bundle-analyzer` for Webpack"*** — since Turbopack is
the default since 16.0, the classic `ANALYZE=true next build` recipe now describes the
**non-default** path. Setup, verbatim:
```js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
module.exports = withBundleAnalyzer(nextConfig)
```
> *"The report will open three new tabs in your browser, which you can inspect."*

⚠️ **Carried from the track (already verified, do not re-fetch): 16.0 removed `size` and
`First Load JS` from `next build` output** as *"inaccurate in server-driven architectures"* —
so **any CI gate parsing build output for a size budget now passes vacuously.** That is the
strongest gotcha on page 03.

### 3b · Fixing what the analyzer finds — verbatim

**Packages with many exports:**
> *"If you're using a package that exports hundreds of modules (such as icon and utility libraries), you can optimize how those imports are resolved using the `optimizePackageImports` option … This option will only load the modules you actually use, while still giving you the convenience of writing import statements with many named exports."*
> *"Next.js also optimizes some libraries automatically, thus they do not need to be included in the `optimizePackageImports` list."*
```js
const nextConfig = { experimental: { optimizePackageImports: ['icon-library'] } }
```

**🔴 Heavy client workloads — the best worked example on the page:**
> *"A common cause of large client bundles is doing expensive rendering work in Client Components. This often happens with libraries that exist only to transform data into UI, such as syntax highlighting, chart rendering, or markdown parsing."*
> *"If that work does not require browser APIs or user interaction, it can be run in a Server Component."*
> *"Even though the final output is just a `<code>` block, the entire highlighting library is bundled into the client JavaScript bundle"*
> *"This increases bundle size because the client must download and execute the highlighting library, even though the result is static HTML."*
> *"Instead, move the highlighting logic to a Server Component and render the final HTML on the server. The client will only receive the rendered markup."*

Before: `'use client'` + `prism-react-renderer`. After: Server Component + `codeToHtml` from
`shiki`, comment verbatim: *"The Shiki package runs on the server and is never bundled for the
client."*

**Opting out of server bundling:**
> *"Packages imported inside Server Components and Route Handlers are automatically bundled by Next.js."*
> *"You can opt specific packages out of bundling using the `serverExternalPackages` option"*

### 3c · Lazy loading
`https://nextjs.org/docs/app/guides/lazy-loading.md`
`version: 16.3.4` · **`lastUpdated: 2026-03-10`**

> *"Lazy loading in Next.js helps improve the initial loading performance of an application by decreasing the amount of JavaScript needed to render a route."*
> *"It allows you to defer loading of **Client Components** and imported libraries, and only include them in the client bundle when they're needed."*
> *"By default, Server Components are automatically code split, and you can use streaming to progressively send pieces of UI from the server to the client. **Lazy loading applies to Client Components.**"*
> *"`next/dynamic` is a composite of `React.lazy()` and Suspense. It behaves the same way in the `app` and `pages` directories to allow for incremental migration."*

**🔴 The four traps, all verbatim:**
> *"When a Server Component dynamically imports a Client Component, automatic code splitting is currently **not** supported."*
> *"`ssr: false` option will only work for Client Components, move it into Client Components ensure the client code-splitting working properly."*
> *"`ssr: false` option is not supported in Server Components. You will see an error if you try to use it in Server Components."*
> *"`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component."*
> *"If you dynamically import a Server Component, only the Client Components that are children of the Server Component will be lazy-loaded - not the Server Component itself."*
> *"When using `React.lazy()` and Suspense, Client Components will be prerendered (SSR) by default."*

Named exports, verbatim shape:
```jsx
const ClientComponent = dynamic(() =>
  import('../components/hello').then((mod) => mod.Hello)
)
```
Custom loading: `dynamic(() => import('…'), { loading: () => <p>Loading...</p> })`
External library on demand: `const Fuse = (await import('fuse.js')).default`

**Magic comments** (also in the Turbopack reference):
> *"Magic comments do not work with static `import` statements (`import x from 'y'`). They only work with dynamic expressions."*
> *"`turbopackOptional` … suppress build errors when a module might not exist. The import will still throw at runtime if the module is missing"*
> *"`webpackOptional` is not supported. Use `turbopackOptional` instead when using Turbopack."*

---

## 4 · Core Web Vitals (page 05)

`https://nextjs.org/docs/app/guides/analytics.md`
`version: 16.3.4` · ⚠️ **`lastUpdated: 2025-05-13` — the oldest page in this bank, ~16 months
stale. It still lists FID, which the web-vitals project retired in favour of INP.** Say so on
the page rather than repeating the list uncritically.

> *"Next.js has built-in support for measuring and reporting performance metrics."*

The listed vitals, verbatim: TTFB · FCP · LCP · **FID** · CLS · **INP**.
> *"You can handle all the results of these metrics using the `name` property."*

```jsx
'use client'
import { useReportWebVitals } from 'next/web-vitals'
export function WebVitals() {
  useReportWebVitals((metric) => { console.log(metric) })
}
```

🔴 **The boundary-confinement rule — quote it:**
> *"Since the `useReportWebVitals` hook requires the `'use client'` directive, the most performant approach is to create a separate component that the root layout imports. This confines the client boundary exclusively to the `WebVitals` component."*

**Shipping the metric, verbatim:**
```js
useReportWebVitals((metric) => {
  const body = JSON.stringify(metric)
  const url = 'https://example.com/analytics'
  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
  if (navigator.sendBeacon) { navigator.sendBeacon(url, body) }
  else { fetch(url, { body, method: 'POST', keepalive: true }) }
})
```
> *"If you use Google Analytics, using the `id` value can allow you to construct metric distributions manually (to calculate percentiles, etc.)"*
> *"`value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value)` // values must be integers"*
> *"`event_label: metric.id`, // id unique to current page load"*
> *"`non_interaction: true`, // avoids affecting bounce rate."*

⚠️ **The page does NOT give threshold numbers** (the 2.5s / 200ms / 0.1 "good" boundaries are
web.dev's, not Next.js's). Attribute them to web.dev or leave them out — **do not present them
as Next.js documentation.**

**Client instrumentation, from the same page:**
> *"Next.js provides a `instrumentation-client.js|ts` file that runs before your application's frontend code starts executing. This is ideal for setting up global analytics, error tracking, or performance monitoring tools."*

Already banked in [[research-nextjs-ch16-deployment]] §7 and load-bearing here:
> *"Only synchronous, top-level code is guaranteed to complete before hydration. Asynchronous work started here (a `Promise`, `import()`, or top-level `await`) is not awaited and may resolve after hydration has begun, so treat it as fire-and-forget."*
> *"Next.js monitors initialization time in development and will log warnings if it takes longer than 16ms, which could impact smooth page loading."*

Also already in the corpus, for the LCP section:
> *"The image is the Largest Contentful Paint (LCP) element. The image is above the fold, typically the hero image. You want to begin loading the image in the `<head>`, before its discovered later in the `<body>`."*

---

## 5 · Page 06 — the ch16 collision, and how to resolve it

🔴 **Chapter 16 already owns telemetry** in two closed pages:
`16-deployment-scaling-and-observability/04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md`
and `…/04b-opentelemetry-the-span-catalogue-and-trace-volume.md`.

**ch16 owns:** `register()` blocking readiness · `onRequestError` and the `digest` trap ·
`instrumentation-client` · the full span catalogue · `NEXT_OTEL_VERBOSE`.

**ch11's page 06 keeps the PERFORMANCE angle only** — instrumentation's own cost — and hands
everything else across. The facts that belong to a cost page, from
[[research-nextjs-ch16-deployment]] §6/§8:

> *"The file exports a `register` function that is called **once** when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests."*
> *"Next.js traces more spans than are emitted by default. To see more spans, you must set `NEXT_OTEL_VERBOSE=1`."*
> *"This span can be turned off by setting `NEXT_OTEL_FETCH_DISABLED=1` in your environment. This is useful when you want to use a custom fetch instrumentation library."* (on the `fetch` span)
> *"Unlike `@vercel/otel`, `NodeSDK` is not compatible with edge runtime, so you need to make sure that you are importing them only when `process.env.NEXT_RUNTIME === 'nodejs'`."*
> *"We recommend importing the file from within the `register` function, rather than at the top of the file."*
> *"`start response` … This zero-length span represents the time when the first byte has been sent in the response."*

And `logging` (§9) is **development-only** — a page about production monitoring must not
present it as a production tool:
> *"Configure logging behavior in the terminal when running Next.js in **development mode**"*

---

## 5b · The version 16 upgrade guide (FETCHED 2026-09-04 — three findings)
`https://nextjs.org/docs/app/guides/upgrading/version-16.md`
`version: 16.3.4` · **`lastUpdated: 2026-08-25`**

**(a) 🔴 There IS a reader for the Turbopack trace file.** The Turbopack reference only says to
attach the `.bin` to a GitHub issue, which reads as "unreadable". The upgrade guide documents the
command:

```bash
npx next internal trace .next-profiles/trace-turbopack.bin
```

⚠️ **An earlier ch11 draft asserted "the documentation describes no local reader for it" — WRONG,
and it was corrected in `01c` on 2026-09-04.** Note also: *"`next dev` and `next build` now use
separate output directories, enabling concurrent execution. The `next dev` command outputs to
`.next/dev`."* and *"a lockfile mechanism prevents multiple `next dev` or `next build` instances
on the same project."*

**(b) 🔴 The edge runtime's migration path is NAMED here, and nowhere else we have found:**

> *"The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured. **If you want to continue using the `edge` runtime, keep using `middleware`.** We will follow up on a minor release with further `edge` runtime instructions."*

This is the closest thing to a rationale/roadmap the docs give: `middleware` is deprecated-and-renamed
but is explicitly the fallback for anyone who still needs `edge`, and further instructions are
promised in a minor. **Still no reason for the deprecation itself.**

Also verbatim: *"The `middleware` filename is deprecated, and has been renamed to `proxy` to
clarify network boundary and routing focus."*

**(c) The webpack-config build failure is confirmed, with its rationale:**

> *"If your project has a custom `webpack` configuration and you run `next build` (which now uses Turbopack by default), the build will **fail** to prevent misconfiguration issues."*
> *"**Good to know**: If you see failing builds because a `webpack` configuration was found, but you don't define one yourself, it is likely that a plugin is adding a `webpack` option"*

Three documented ways out: `next build --turbopack` (ignore the webpack config), migrate it, or
`--webpack`. Also confirms `experimental.turbopack` → **top-level `turbopack`** in 16, and the
`resolveAlias` fallback shape for Node builtins:
`turbopack: { resolveAlias: { fs: { browser: './empty.ts' } } }`.

**And the `size` / `First Load JS` removal, in full:**

> *"**Next.js 16** removes the `size` and `First Load JS` metrics from the `next build` output. We found these to be inaccurate in server-driven architectures using React Server Components. Both our Turbopack and Webpack implementations had issues, and disagreed on how to account for Client Components payload."*
> *"The most effective way to measure actual route performance is through tools such as Chrome Lighthouse or Vercel Analytics, which focus on Core Web Vitals and downloaded resource sizes."*

🔴 **That second sentence is the docs endorsing the replacement CI gate** ch11 page 03 recommends.

---

## 5c · `serverExternalPackages` (FETCHED 2026-09-04 by fork A)
`https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages.md`
`version: 16.3.4` · `lastUpdated: 2025-12-05` — **was not in this bank before**

> *"Dependencies used inside Server Components and Route Handlers will automatically be bundled by Next.js."*
> *"If a dependency is using Node.js specific features, you can choose to opt-out specific dependencies from the Server Components bundling and use native Node.js `require`."*
> *"Next.js includes a short list of popular packages that currently are working on compatibility and automatically opt-ed out"*
> *"`v15.0.0` — Moved from experimental to stable. Renamed from `serverComponentsExternalPackages` to `serverExternalPackages`"*

**Top-level key**, not under `experimental`. The auto-opt-out list includes **`shiki`**,
`@prisma/client`, `prisma`, `pg`, `mongodb`, `mongoose`, `bcrypt`, `@node-rs/bcrypt`, `argon2`,
`sharp`, `canvas`, `better-sqlite3`, `pino`, `puppeteer`, `playwright`, `jsdom`, `express`,
`typescript`.

🔴 **`shiki` being on that list closes a loop with the package-bundling guide**, whose recommended
fix for a heavy client workload is to move highlighting to a Server Component using `shiki`.

---

## 5d · react.dev, for the compiler's own semantics (FETCHED 2026-09-04 by fork A)

`https://react.dev/learn/react-compiler/introduction`
> *"For new code, we recommend relying on the compiler for memoization and using `useMemo`/`useCallback` where needed to achieve precise control. For existing code, we recommend either leaving existing memoization in place (removing it can change compilation output) or carefully testing before removing the memoization."*
> *"React Compiler's automatic memoization is primarily focused on **improving update performance** (re-rendering existing components)"*

`https://react.dev/reference/react-compiler/directives`
> *"Place directives at the beginning of a function to control its compilation"* · *"Place directives at the top of a file to affect all functions in that module."* — function-level overrides module-level
> `annotation` — *"Only functions with `\"use memo\"` are compiled"* · `infer` — *"Compiler decides what to compile, directives override decisions"* · `all` — *"Everything is compiled, `\"use no memo\"` can exclude specific functions"*
> *"Opt-out directives should be temporary"*

⚠️ **Next.js documents only `compilationMode: 'annotation'`; react.dev documents three modes.**
Whether Next.js passes `'infer'`/`'all'` through is **NOT settled** — do not assert it.

---

## 6 · What these sources do NOT settle — write as uncertain or leave out

1. **Edge cold-start figures, memory ceilings, and the Edge API allow-list.** The `runtime`
   page is four sentences. Nothing here supports a numbers table. The old
   "V8 isolate vs full Node process" prose in the ch11 stubs is **unsourced** — do not carry
   it forward as fact.
2. **Why the Edge runtime was deprecated.** ✅ **NOW CHECKED — and still unsettled.**
   `/docs/messages/edge-runtime-deprecated` was fetched 2026-09-04 and **gives no rationale**.
   🔴 **Do not fetch it again hoping for one.** State that the docs instruct removal, that it is
   a *warning* rather than a build failure, and that no reason is published.
3. **Core Web Vitals thresholds.** Not in the Next.js docs. web.dev owns them.
4. **Any Turbopack speed multiplier.** 🔴 The syllabus's *"5.5× faster CI builds"* and *"90%
   less dev RAM"* **appear nowhere in the API references** — this was already caught in the ch5
   bank. The Turbopack page gives **no numbers at all**. Do not assert one.
5. **React Compiler build-cost numbers.** Neither doc quantifies it.
6. **Whether `turbopackRustReactCompiler` has shipped past experimental.** The flag table in
   the Turbopack reference does not list it; the stub's 2026-09-03 note calls it experimental.
   Treat as experimental and say where that came from.

---

## Version spine for every ch11 page

**Next.js 16.3.4** (docs build) · Turbopack default since **16.0** · React Compiler stable
since **16**, top-level `reactCompiler`, not default · `next experimental-analyze` since
**16.1** · `runtime = 'edge'` **deprecated** · React **19.2.8** · Node **24.20.0**.
🔴 `next` is **not installed in this checkout — no T1 probe of it is possible.**
