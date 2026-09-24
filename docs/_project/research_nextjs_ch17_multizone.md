---
name: research-nextjs-ch17-multizone
description: Verbatim primary-source quotes for Next.js multi-zones, assetPrefix, basePath and rewrites — the evidence base for devbible nextjs chapter 17 concept 01 (micro-frontends and multi-zone architectures). Do not re-derive.
metadata:
  type: reference
  track: nextjs
  chapter: 17
  topic: micro-frontends and multi-zone architectures
  spine: "Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor"
  fetched: 2026-09-04
  status: do-not-re-derive
---

# Research bank — Next.js multi-zones (chapter 17, concept 01)

**Four fetches, all resolved.** Every page returned frontmatter carrying
`version: 16.3.4`, which is the docs build the quotes below came from. No sandbox,
no probes — this topic is entirely T0/T2 (verbatim documentation quotes).

| URL | Resolved | `version` | `lastUpdated` |
|---|---|---|---|
| `https://nextjs.org/docs/app/guides/multi-zones` | ✅ | 16.3.4 | 2026-06-01 |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix` | ✅ | 16.3.4 | 2026-08-25 |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath` | ✅ | 16.3.4 | 2025-06-16 |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites` | ✅ | 16.3.4 | 2026-06-30 |

---

## 1 · Multi-zones guide — `https://nextjs.org/docs/app/guides/multi-zones`

Page title as served: **"How to build micro-frontends using multi-zones and Next.js"**.
Description: *"Learn how to build micro-frontends using Next.js Multi-Zones to deploy
multiple Next.js apps under a single domain."* Linked example:
`https://github.com/vercel/next.js/tree/canary/examples/with-zones`.

### Definition

> *"Multi-Zones are an approach to micro-frontends that separate a large application on
> a domain into smaller Next.js applications that each serve a set of paths. This is
> useful when there are collections of pages unrelated to the other pages in the
> application. By moving those pages to a separate zone (i.e., a separate application),
> you can reduce the size of each application which improves build times and removes
> code that is only necessary for one of the zones. Since applications are decoupled,
> Multi-Zones also allows other applications on the domain to use their own choice of
> framework."*

Worked split given in the docs:

* `/blog/*` for all blog posts
* `/dashboard/*` for all pages when the user is logged-in to the dashboard
* `/*` for the rest of your website not covered by other zones

> *"With Multi-Zones support, you can create three applications that all are served on
> the same domain and look the same to the user, but you can develop and deploy each of
> the applications independently."*

### Navigation — soft vs hard (the load-bearing paragraph)

> *"Navigating between pages in the same zone will perform soft navigations, a
> navigation that does not require reloading the page. For example, in this diagram,
> navigating from `/` to `/products` will be a soft navigation."*

> *"Navigating from a page in one zone to a page in another zone, such as from `/` to
> `/dashboard`, will perform a hard navigation, unloading the resources of the current
> page and loading the resources of the new page. Pages that are frequently visited
> together should live in the same zone to avoid hard navigations."*

### Linking between zones

> *"Links to paths in a different zone should use an `a` tag instead of the Next.js
> `<Link>` component. This is because Next.js will try to prefetch and soft navigate to
> any relative path in `<Link>` component, which will not work across zones."*

### How to define a zone

> *"A zone is a normal Next.js application where you also configure an assetPrefix to
> avoid conflicts with pages and static files in other zones."*

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: '/blog-static',
}
```

> *"Next.js assets, such as JavaScript and CSS, will be prefixed with `assetPrefix` to
> make sure that they don't conflict with assets from other zones. These assets will be
> served under `/assetPrefix/_next/...` for each of the zones."*

> *"The default application handling all paths not routed to another more specific zone
> does not need an `assetPrefix`."*

> *"In versions older than Next.js 15, you may also need an additional rewrite to handle
> the static assets. This is no longer necessary in Next.js 15."*

The legacy (pre-15) form, quoted from the docs:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: '/blog-static',
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/blog-static/_next/:path+',
          destination: '/_next/:path+',
        },
      ],
    }
  },
}
```

### Routing requests to the right zone

> *"With the Multi Zones set-up, you need to route the paths to the correct zone since
> they are served by different applications. You can use any HTTP proxy to do this, but
> one of the Next.js applications can also be used to route requests for the entire
> domain."*

> *"To route to the correct zone using a Next.js application, you can use `rewrites`.
> For each path served by a different zone, you would add a rewrite rule to send that
> path to the domain of the other zone, and you also need to rewrite the requests for
> the static assets."*

```js
// next.config.js
async rewrites() {
    return [
        {
            source: '/blog',
            destination: `${process.env.BLOG_DOMAIN}/blog`,
        },
        {
            source: '/blog/:path+',
            destination: `${process.env.BLOG_DOMAIN}/blog/:path+`,
        },
        {
            source: '/blog-static/:path+',
            destination: `${process.env.BLOG_DOMAIN}/blog-static/:path+`,
        }
    ];
}
```

> *"`destination` should be a URL that is served by the zone, including scheme and
> domain. This should point to the zone's production domain, but it can also be used to
> route requests to `localhost` in local development."*

> *"**Good to know**: URL paths should be unique to a zone. For example, two zones
> trying to serve `/blog` would create a routing conflict."*

### Routing requests using proxy

> *"Routing requests through `rewrites` is recommended to minimize latency overhead for
> the requests, but proxy can also be used when there is a need for a dynamic decision
> when routing. For example, if you are using a feature flag to decide where a path
> should be routed such as during a migration, you can use proxy."*

```js
// proxy.js
export async function proxy(request) {
  const { pathname, search } = request.nextUrl
  if (pathname === '/your-path' && myFeatureFlag.isEnabled()) {
    return NextResponse.rewrite(`${rewriteDomain}${pathname}${search}`)
  }
}
```

### Sharing code

> *"The Next.js applications that make up the different zones can live in any
> repository. However, it is often convenient to put these zones in a monorepo to more
> easily share code. For zones that live in different repositories, code can also be
> shared using public or private NPM packages."*

> *"Since the pages in different zones may be released at different times, feature flags
> can be useful for enabling or disabling features in unison across the different
> zones."*

### Server Actions

> *"When using Server Actions with Multi-Zones, you must explicitly allow the
> user-facing origin since your user facing domain may serve multiple applications. In
> your `next.config.js` file, add the following lines:"*

```js
// next.config.js
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['your-production-domain.com'],
    },
  },
}
```

⚠️ **Note for the page:** the guide places `serverActions.allowedOrigins` under
`experimental` in this example. I did **not** fetch
`/docs/app/api-reference/config/next-config-js/serverActions`, so whether the key is
still nested under `experimental` in 16.3.4 or has been promoted to top level is
**unconfirmed**. Reproduce the docs' shape and say so.

---

## 2 · `assetPrefix` — `https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix`

> *"**Attention**: Deploying to Vercel automatically configures a global CDN for your
> Next.js project. You do not need to manually set up an Asset Prefix."*

> *"**Good to know**: Next.js 9.5+ added support for a customizable Base Path, which is
> better suited for hosting your application on a sub-path like `/docs`. We do not
> suggest you use a custom Asset Prefix for this use case."*

> *"Next.js will automatically use your asset prefix for the JavaScript and CSS files it
> loads from the `/_next/` path (`.next/static/` folder)."*

Example given: a request for
`/_next/static/chunks/4b9b41aaa062cbbfeff4add70f256968c51ece5d.4d708494b3aed70c04f0.js`
becomes
`https://cdn.mydomain.com/_next/static/chunks/4b9b41aaa062cbbfeff4add70f256968c51ece5d.4d708494b3aed70c04f0.js`.

> *"The only folder you need to host on your CDN is the contents of `.next/static/`,
> which should be uploaded as `_next/static/` as the above URL request indicates. **Do
> not upload the rest of your `.next/` folder**, as you should not expose your server
> code and other configuration to the public."*

> *"While `assetPrefix` covers requests to `_next/static`, it does not influence the
> following paths:"*
>
> * *"Files in the public folder; if you want to serve those assets over a CDN, you'll
>   have to introduce the prefix yourself"*

⚠️ **The fetched body was truncated at that bullet.** The list may continue with
further exclusions. Only the `public` folder bullet is quotable with confidence.

Phase-based example from the page:

```js
// next.config.mjs
// @ts-check
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

export default (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER
  /**
   * @type {import('next').NextConfig}
   */
  const nextConfig = {
    assetPrefix: isDev ? undefined : 'https://cdn.mydomain.com',
  }
  return nextConfig
}
```

---

## 3 · `basePath` — `https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath`

> *"To deploy a Next.js application under a sub-path of a domain you can use the
> `basePath` config option."*

> *"`basePath` allows you to set a path prefix for the application. For example, to use
> `/docs` instead of `''` (an empty string, the default), open `next.config.js` and add
> the `basePath` config"*

> *"**Good to know**: This value must be set at build time and cannot be changed without
> re-building as the value is inlined in the client-side bundles."*

> *"When linking to other pages using `next/link` and `next/router` the `basePath` will
> be automatically applied."*

> *"For example, using `/about` will automatically become `/docs/about` when `basePath`
> is set to `/docs`."*

> *"This makes sure that you don't have to change all links in your application when
> changing the `basePath` value."*

> *"When using the `next/image` component, you will need to add the `basePath` in front
> of `src`."*

> *"For example, using `/docs/me.png` will properly serve your image when `basePath` is
> set to `/docs`."*

🔴 **The multi-zones guide never mentions `basePath`.** Its worked example gives the
blog zone routes that genuinely live at `/blog` and an `assetPrefix` of `/blog-static`.
Do not present `basePath` as the documented multi-zone mechanism; present it as the
documented mechanism for sub-path hosting, which is a related but distinct problem the
`assetPrefix` page explicitly redirects you to.

---

## 4 · `rewrites` — `https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites`

> *"Rewrites allow you to map an incoming request path to a different destination
> path."*

> *"Rewrites act as a URL proxy and mask the destination path, making it appear the user
> hasn't changed their location on the site. In contrast, redirects will reroute to a
> new page and show the URL changes."*

> *"Rewrites are applied to client-side routing. In the example above, navigating to
> `<Link href="/about">` will serve content from `/` while keeping the URL as
> `/about`."*

Rewrite object fields, verbatim:

* *"`source`: `String` - is the incoming request path pattern."*
* *"`destination`: `String` is the path you want to route to."*
* *"`basePath`: `false` or `undefined` - if false the basePath won't be included when
  matching, can be used for external rewrites only."*
* *"`locale`: `false` or `undefined` - whether the locale should not be included when
  matching."*
* *"`has` is an array of has objects with the `type`, `key` and `value` properties."*
* *"`missing` is an array of missing objects with the `type`, `key` and `value`
  properties."*

> *"When the `rewrites` function returns an array, rewrites are applied after checking
> the filesystem (pages and `/public` files) and before dynamic routes. When the
> `rewrites` function returns an object of arrays with a specific shape, this behavior
> can be changed and more finely controlled, as of `v10.1` of Next.js"*

> *"**Good to know**: rewrites in `beforeFiles` do not check the filesystem/dynamic
> routes immediately after matching a source, they continue until all `beforeFiles` have
> been checked."*

### The route-checking order (verbatim, numbered as the docs number it)

> 1. *"headers are checked/applied"*
> 2. *"redirects are checked/applied"*
> 3. *"proxy"*
> 4. *"`beforeFiles` rewrites: for each entry, if `source`, `has`, and `missing` matches
>    the request, it's rewritten to `destination`."*
> 5. *"static files from the public directory, `_next/static` files, and non-dynamic
>    pages are checked/served"*
> 6. *"`afterFiles` rewrites are tried in order. If a `source`, `has`, and `missing`
>    matches the request, it's rewritten to `destination`; the first rewrite that
>    resolves to a static file, page, or dynamic route is served."*
> 7. *"dynamic routes (e.g., `app/blog/[slug]/page.tsx`) are matched against the current
>    path"*
> 8. *"`fallback` rewrites are checked/applied, these are applied before rendering the
>    404 page and after dynamic routes/all static assets have been checked. If you use
>    `fallback: true/'blocking'` in `getStaticPaths`, those dynamic routes take priority
>    over the fallback `rewrites` defined in your `next.config.js`."*

Inline comments on the docs' own `beforeFiles` / `afterFiles` / `fallback` example:

* `beforeFiles` — *"These rewrites are checked after headers/redirects and before all
  files including `_next/public` files which allows overriding page files"*
* `afterFiles` — *"These rewrites are checked after pages/public files are checked but
  before dynamic routes"*
* `fallback` — *"These rewrites are checked after both pages/public files and dynamic
  routes are checked"*

### Path matching

> *"The pattern `/blog/:slug` matches `/blog/first-post` and `/blog/post-1` but not
> `/blog/a/b` (no nested paths). Patterns are anchored to the start: `/blog/:slug` will
> not match `/archive/blog/first-post`."*

> *"You can use modifiers on parameters: `*` (zero or more), `+` (one or more), `?`
> (zero or one). For example, `/blog/:slug*` matches `/blog`, `/blog/a`, and
> `/blog/a/b/c`."*

> *"When using parameters in a rewrite the parameters will be passed in the query by
> default when none of the parameters are used in the `destination`."*

> *"If a parameter is used in the destination none of the parameters will be
> automatically passed in the query."*

### Rewriting to an external URL

Linked example: *"Using Multiple Zones"* —
`https://github.com/vercel/next.js/tree/canary/examples/with-zones`.

> *"Rewrites allow you to rewrite to an external URL. This is especially useful for
> incrementally adopting Next.js."*

> *"If you're using `trailingSlash: true`, you also need to insert a trailing slash in
> the `source` parameter. If the destination server is also expecting a trailing slash
> it should be included in the `destination` parameter as well."*

> *"You can also have Next.js fall back to proxying to an existing website after
> checking all Next.js routes. This way you don't have to change the rewrites
> configuration when migrating more pages to Next.js"*

### Rewrites with basePath support

> *"When leveraging `basePath` support with rewrites each `source` and `destination` is
> automatically prefixed with the `basePath` unless you add `basePath: false` to the
> rewrite"*

Docs' own inline comment on the `basePath: false` entry:
*"Note: this cannot be used for internal rewrites e.g. `destination: '/another'`"*

### Version history table (verbatim)

| Version | Changes |
|---|---|
| `v13.3.0` | `missing` added. |
| `v10.2.0` | `has` added. |
| `v9.5.0` | Headers added. |

---

## What these four pages do NOT settle

Record these so a later session does not silently invent them.

1. **Module Federation.** Nothing in the four pages fetched mentions Webpack/Rspack
   Module Federation or runtime component composition. The multi-zones guide is the
   only micro-frontend approach these pages document. **Absence of a mention in four
   pages is not proof Next.js has no support anywhere** — write the claim as "the
   documented approach is multi-zones; I found no Module Federation page under
   `/docs/app/guides/`", not as "Next.js does not support Module Federation."
2. **Cookies, sessions and auth across zones.** The multi-zones guide is silent. The
   only adjacent documented fact is the Server Actions `allowedOrigins` requirement,
   whose stated reason is *"your user facing domain may serve multiple applications"* —
   which confirms the browser sees one origin, but the guide does not spell out cookie
   scoping. Do not cite these docs for cookie behaviour.
3. **Whether `serverActions.allowedOrigins` is still under `experimental` in 16.3.4.**
   The guide's example nests it there; the dedicated config page was not fetched.
4. **Two zones on two different Next.js majors.** The guide says decoupled apps *"use
   their own choice of framework"* — which covers non-Next frameworks and by extension
   different versions, but the guide never says "different Next.js majors" in those
   words. Quote what it does say.
5. **The full `assetPrefix` exclusion list.** The fetched body truncated after the
   `public` folder bullet.
6. **Router cache / React context across zones.** Not stated directly. The guide's hard
   navigation sentence — *"unloading the resources of the current page and loading the
   resources of the new page"* — is the supporting evidence; derive from that and say
   you derived it.
