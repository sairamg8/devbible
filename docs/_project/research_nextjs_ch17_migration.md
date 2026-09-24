---
name: research-nextjs-ch17-migration
description: Banked primary-source research for devbible Next.js chapter 17 concept 02 (Pages Router to App Router migration roadmaps) — every load-bearing sentence quoted verbatim from the 16.3.4 migration guide and codemods reference, plus the three URLs that 404 and the precedence rule that the current docs do NOT state. Fetched 2026-09-04; do not re-fetch for chapter 17.
metadata:
  type: reference
---

# Next.js chapter 17 · Pages → App migration — banked research, 2026-09-04

**Fetched once. Do not re-fetch for any chapter-17 migration page.** Version spine:
**Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. No sandbox; `next` is NOT installed in
the devbible checkout (`node_modules/next` absent), so no T1 probe was available.

## Sources — what resolved and what did not

| URL | Result |
|---|---|
| `https://nextjs.org/docs/app/guides/migrating/app-router-migration` | ✅ resolved · `version: 16.3.4`, `lastUpdated: 2026-08-25` |
| `https://nextjs.org/docs/app/guides/upgrading/codemods` | ✅ resolved · `version: 16.3.4`, `lastUpdated: 2026-08-25` |
| `https://nextjs.org/docs/app/getting-started/project-structure` | ✅ resolved · `version: 16.3.4`, `lastUpdated: 2026-07-21` |
| `https://nextjs.org/docs/messages/conflicting-app-page-error` | ❌ 404 — "The URL `/docs/messages/conflicting-app-page-error` does not exist." |
| `https://nextjs.org/docs/pages` | ❌ 404 |
| `https://nextjs.org/docs/13/app/building-your-application/routing` | ❌ 404 (archived v13 tree not reachable) |

## 🔴 The precedence rule — NOT confirmed in the 16.3.4 documentation

The sentence *"The App Router takes priority over the Pages Router. Routes across
directories should not resolve to the same URL path and will cause a build-time error to
prevent a conflict"* is widely attributed to the **archived Next.js 13** routing page. Two
independent web searches surfaced it, both pointing at
`nextjs.org/docs/13/app/building-your-application/routing`, **which 404s on direct fetch**.
It is therefore a search-engine summary, not a primary read, and **must not be quoted as
verbatim documentation**.

Checked and it is absent from:
- the 16.3.4 migration guide (which covers coexistence at length and never mentions precedence)
- `project-structure` 16.3.4 (the `app` / `pages` top-level table has no precedence note)

**What the 16.3.4 docs DO say about coexistence, verbatim:**

> *"The new Router is available in the `app` directory and co-exists with the `pages` directory."*

> *"We recommend reducing the combined complexity of these updates by breaking down your
> migration into smaller steps. The `app` directory is intentionally designed to work
> simultaneously with the `pages` directory to allow for incremental page-by-page migration."*

> *"Upgrading to Next.js 13 does **not** require using the App Router."*

🔴 **The load-bearing coexistence caveat, and it IS documented:**

> *"When navigating between routes served by the different Next.js routers, there will be a
> hard navigation. Automatic link prefetching with `next/link` will not prefetch across
> routers."*

Guidance written into the page: treat a path defined in both directories as **unspecified by
the 16.3.4 documentation**, and never let it arise — delete or move the `pages/` route in the
same commit that adds the `app/` route.

## The documented step order (migration guide, "Migrating from `pages` to `app`")

Step 1 create `app/` · Step 2 root layout · Step 3 `next/head` → Metadata · Step 4 pages ·
Step 5 routing hooks · Step 6 data fetching · Step 7 styling.

Stale in the "Upgrading" preamble — it is still written for the 12→13 jump:
*"The minimum Node.js version is now **v18.17**."* and *"Update to the latest Next.js version
(requires 13.4 or greater)"*. The 16.3.4 floor is **Node 20.9** (banked in
`research_nextjs_ch1_foundations.md`).

## Replacement table, verbatim bullets

> *"Data fetching functions like `getServerSideProps` and `getStaticProps` have been replaced
> with [a new API] inside `app`. `getStaticPaths` has been replaced with
> [`generateStaticParams`]."*

> *"`pages/_app.js` and `pages/_document.js` have been replaced with a single `app/layout.js`
> root layout."*

> *"`pages/_error.js` has been replaced with more granular `error.js` special files."*

> *"`pages/404.js` has been replaced with the [`not-found.js`] file."*

> *"`pages/api/*` API Routes have been replaced with the [`route.js`] (Route Handler) special file."*

## Root layout, `_app`, `_document`

> *"The `app` directory **must** include a root layout."*
> *"The root layout must define `<html>`, and `<body>` tags since Next.js does not automatically create them"*
> *"The root layout replaces the `pages/_app.tsx` and `pages/_document.tsx` files."*

🔴 The one people skip:

> *"If you have an existing `_app` or `_document` file, you can copy the contents (e.g. global
> styles) to the root layout (`app/layout.tsx`). Styles in `app/layout.tsx` will *not* apply to
> `pages/*`. You should keep `_app`/`_document` while migrating to prevent your `pages/*`
> routes from breaking. Once fully migrated, you can then safely delete them."*

> *"If you are using any React Context providers, they will need to be moved to a [Client Component]."*

⚠️ Note against the ch1 bank: ch1 quotes *"If you forget to create the root layout, Next.js
will automatically create this file when running the development server with `next dev`."*
Not a contradiction — dev scaffolds the missing **file**; the guide's sentence is about the
**tags** not being auto-inserted into a layout you wrote.

## Pages are Server Components now

> *"Pages in the [`app` directory] are [Server Components] by default. This is different from
> the `pages` directory where pages are [Client Components]."*

The two-step recommended page migration:

> *"We recommend breaking down the migration of a page into two main steps: Step 1: Move the
> default exported Page Component into a new Client Component. Step 2: Import the new Client
> Component into a new `page.js` file inside the `app` directory."*
> *"**Good to know**: This is the easiest migration path because it has the most comparable
> behavior to the `pages` directory."*

## Routing hooks (Step 5)

> *"The new `useRouter` hook is imported from `next/navigation` and has different behavior to
> the `useRouter` hook in `pages` which is imported from `next/router`."*

> *"The [`useRouter` hook imported from `next/router`] is not supported in the `app` directory
> but can continue to be used in the `pages` directory."*

> *"The new `useRouter` does not return the `pathname` string. Use the separate `usePathname`
> hook instead."*

> *"The new `useRouter` does not return the `query` object. Search parameters and dynamic route
> parameters are now separate. Use the `useSearchParams` and `useParams` hooks instead."*

> *"These new hooks are only supported in Client Components. They cannot be used in Server
> Components."*

Removed from the new `useRouter`, verbatim:
- *"`isFallback` has been removed because `fallback` has [been replaced]."*
- *"The `locale`, `locales`, `defaultLocales`, `domainLocales` values have been removed because built-in i18n Next.js features are no longer necessary in the `app` directory."*
- *"`basePath` has been removed. The alternative will not be part of `useRouter`. It has not yet been implemented."*
- *"`asPath` has been removed because the concept of `as` has been removed from the new router."*
- *"`isReady` has been removed because it is no longer necessary. During [prerendering], any component that uses the [`useSearchParams()`] hook will skip the prerendering step and instead be rendered on the client at runtime."*
- *"`route` has been removed. `usePathname` or `useSelectedLayoutSegments()` provide an alternative."*

🔴 The shared-component escape hatch:

> *"To keep components compatible between the `pages` and `app` routers, refer to the
> [`useRouter` hook from `next/compat/router`]. This is the `useRouter` hook from the `pages`
> directory, but intended to be used while sharing components between routers. Once you are
> ready to use it only on the `app` router, update to the new [`useRouter` from
> `next/navigation`]."*

## Data fetching (Step 6)

`getServerSideProps`:
> *"By setting the `cache` option to `no-store`, we can indicate that the fetched data should
> [never be cached]. This is similar to `getServerSideProps` in the `pages` directory."*

Code comment on the same page: *"// Opt out of caching for this request. // Next.js fetches
this from the data source on every request. // **This is the default fetch behavior.** //
Similar to `getServerSideProps`."*

🔴 **The same page contradicts itself two sections later:**
> *"In the `app` directory, data fetching with [`fetch()`] will default to `cache:
> 'force-cache'`, which will cache the request data until manually invalidated. This is similar
> to `getStaticProps` in the `pages` directory."*

Do **not** resolve this from memory. The corpus settles the real behaviour in
`docs/nextjs/pages/04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md`
and `.../01d-route-handlers-and-their-caching-model.md`. Link out; do not re-derive.

Request object:
> *"The `app` directory exposes new **read-only** functions to retrieve request data"* —
> `headers` *"Based on the Web Headers API"*, `cookies` *"Based on the Web Cookies API"*.

`getStaticPaths` → `generateStaticParams`:
> *"[`generateStaticParams`] behaves similarly to `getStaticPaths`, but has a simplified API for
> returning route parameters and can be used inside [layouts]. The return shape of
> `generateStaticParams` is an array of segments instead of an array of nested `param` objects
> or a string of resolved paths."*

> *"Using the name `generateStaticParams` is more appropriate than `getStaticPaths` for the new
> model in the `app` directory. The `get` prefix is replaced with a more descriptive
> `generate`, which sits better alone now that `getStaticProps` and `getServerSideProps` are no
> longer necessary. The `Paths` suffix is replaced by `Params`, which is more appropriate for
> nested routing with multiple dynamic segments."*

`fallback` → `dynamicParams`:
> *"**`true`**: (default) Dynamic segments not included in `generateStaticParams` are generated
> on demand."* · *"**`false`**: Dynamic segments not included in `generateStaticParams` will
> return a 404."*
> *"This replaces the `fallback: true | false | 'blocking'` option of `getStaticPaths` in the
> `pages` directory. The `fallback: 'blocking'` option is not included in `dynamicParams`
> because the difference between `'blocking'` and `true` is negligible with streaming."*
> *"With [`dynamicParams`] set to `true` (the default), when a route segment is requested that
> hasn't been generated, it will be server-rendered and cached."*

API Routes:
> *"API Routes continue to work in the `pages/api` directory without any changes. However, they
> have been replaced by [Route Handlers] in the `app` directory."*
> *"**Good to know**: If you previously used API routes to call an external API from the client,
> you can now use [Server Components] instead to securely fetch data."*

🔴 **`getInitialProps` is named ONCE and never given a recipe:**
> *"[Data fetching] has changed in `app`. `getServerSideProps`, `getStaticProps` and
> `getInitialProps` have been replaced with a simpler API."*
There is no `getInitialProps` section on the guide, unlike the other two. State that as a
documented silence, not as "it has no successor" asserted from memory.

## Styling (Step 7)

> *"In the `pages` directory, global stylesheets are restricted to only `pages/_app.js`. With
> the `app` directory, this restriction has been lifted. Global styles can be added to any
> layout, page, or component."*

Tailwind: add `'./app/**/*.{js,ts,jsx,tsx,mdx}'` to `content` alongside the existing
`./pages/**` and `./components/**` globs.

## `next/head` → Metadata (Step 3)

> *"In the `pages` directory, the `next/head` React component is used to manage `<head>` HTML
> elements such as `title` and `meta`. In the `app` directory, `next/head` is replaced with the
> new [built-in SEO support]."*

## `next/script` and fonts (both-router features)

> *"Move any `beforeInteractive` scripts you previously included in `_document.js` to a [root layout]"*
> *"The experimental `worker` strategy does not yet work in `app` and scripts denoted with this
> strategy will either have to be removed or modified to use a different strategy (e.g. `lazyOnload`)."*
> *"`onLoad`, `onReady`, and `onError` handlers will not work in Server Components so make sure
> to move them to a [Client Component] or remove them altogether."*
> *"While [inlining CSS] still works in `pages`, it does not work in `app`. You should use
> [`next/font`] instead."*

## Codemods — the complete 16.3.4 list, and what is missing from it

> *"Codemods are transformations that run on your codebase programmatically. This allows a large
> number of changes to be programmatically applied without having to manually go through every file."*
> *"Next.js provides Codemod transformations to help upgrade your Next.js codebase when an API is
> updated or deprecated."*

`npx @next/codemod <transform> <path>` · `--dry` *"Do a dry-run, no code will be edited"* ·
`--print` *"Prints the changed output for comparison"*.
`npx @next/codemod upgrade [revision]` — *"Upgrades your Next.js application, automatically
running codemods and updating Next.js, React, and React DOM."*

🔴 `-y, --yes`: *"Skip every interactive prompt and accept its default (upgrade React past 18,
enable Turbopack, apply all recommended codemods, run the React 19 codemods). **Also
auto-enabled when stdin is not a TTY (CI, an AI coding agent, or any non-interactive shell)**,
so you usually don't need to pass it explicitly."*

Complete list as published at 16.3.4:
16.3 — `cache-components-instant-false`, `remove-partial-prefetch`.
16.0 — `remove-experimental-ppr`, `remove-unstable-prefix`, `middleware-to-proxy`, `next-lint-to-eslint-cli`.
15.0 — `app-dir-runtime-config-experimental-edge`, `next-async-request-api`, `next-request-geo-ip`.
14.0 — `next-og-import`, `metadata-to-viewport-export`.
13.2 — `built-in-next-font`. 13.0 — `next-image-to-legacy-image`, `next-image-experimental`, `new-link`.
11 — `cra-to-next`. 10 — `add-missing-react-import`. 9 — `name-default-component`.
8 — `withamp-to-config` (*"Built-in AMP support and this codemod have been removed in Next.js 16."*).
6 — `url-to-withrouter`.

🔴 **Not one of them moves a route from `pages/` to `app/`, converts `getServerSideProps`,
rewrites `next/router` imports, or turns `pages/api` into a Route Handler.** That is an
enumeration of the published list, not an inference.

`next-async-request-api` note: *"Your build will error until these comments are explicitly
removed."* Comments are prefixed `@next/codemod`, typecasts prefixed `UnsafeUnwrapped`.

`cra-to-next`, still published at 16.3.4: *"Migrates a Create React App project to Next.js;
**creating a Pages Router** and necessary config to match behavior."*

## Cross-router library trap already proven in this corpus — do not re-derive

Stable `react` **19.2.8** exports no `experimental_taint*` at all, so a shared `lib/` module
reaching for them gets the working API under the App Router (Next's bundled React canary) and
`undefined` under the Pages Router (your `package.json` React). Settled in
`docs/nextjs/pages/17-advanced-ecosystem-topics/03-enterprise-compliance-owasp-mapping-token-leakage-prevention.md`.
Underlying rule banked in `research_nextjs_ch1_foundations.md`:
*"The `App Router` uses React canary releases built-in… The `Pages Router` uses the React
version from your `package.json`."*

## Where this was written to (2026-09-04)

`docs/nextjs/pages/17-advanced-ecosystem-topics/`, seven chunks:
`02` (coexistence/precedence/sequencing, pos 5) · `02b` (request-time data, 6) ·
`02c` (build-time data, 7) · `02d` (getInitialProps + pages/api, 8) ·
`02e` (the two routers and the hooks, **20**) · `02f` (shell, metadata, styles, **21**) ·
`02g` (codemods, cross-router traps, when to stop, **22**).

🔴 `02e`/`02f`/`02g` carry positions 20/21/22 because 9–14 were already claimed by
`03`, `03b`, `04`, `04b`, `04c`, `04d` while this was being written. They belong immediately
after `02d` and need renumbering to 9/10/11 with a cascade — an edit to files this session
did not own.
