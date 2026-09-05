---
title: "A zone only exists because something upstream rewrites a path range to it, so the routing layer is the architecture — and the eight-step order in which Next.js checks routes is what decides every zone bug you will actually have"
sidebar_label: "01b · Routing requests to a zone"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — the `rewrites` reference
> ([nextjs.org](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites),
> served `lastUpdated` 2026-06-30) and the multi-zones guide
> ([nextjs.org/docs/app/guides/multi-zones](https://nextjs.org/docs/app/guides/multi-zones),
> 2026-06-01), both returning `version: 16.3.4` in their own metadata.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified;
> **no sandbox run**.

**Nothing in a zone's own code makes it a zone — a rewrite somewhere upstream does.** Which means the routing layer is not a detail of the architecture, it *is* the architecture, and the failure modes you will spend real time on are all routing-order failures rather than rendering failures. Next.js publishes the exact order in which it checks routes, and the single most consequential fact in it is that a plain array of rewrites is evaluated **after** the filesystem is checked: any stale page or `public/` file in the router zone silently beats the rewrite that was supposed to hand the path to another team's application. This chunk covers how a request is dispatched to a zone, when to use `proxy.ts` instead, and what sharing one origin between several applications implies for Server Actions.

## The documented default — `rewrites` in the router zone

> *"With the Multi Zones set-up, you need to route the paths to the correct zone since they are served by different applications. You can use any HTTP proxy to do this, but one of the Next.js applications can also be used to route requests for the entire domain."*
> — [multi-zones guide](https://nextjs.org/docs/app/guides/multi-zones)

The second option is the interesting one, because it means you can build a multi-zone with no infrastructure you do not already have. The default zone becomes the router.

```js
// apps/www/next.config.js — the default zone, which also routes the whole domain
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // The blog zone owns /blog
      {
        source: '/blog',
        destination: `${process.env.BLOG_DOMAIN}/blog`,
      },
      {
        source: '/blog/:path+',
        destination: `${process.env.BLOG_DOMAIN}/blog/:path+`,
      },
      // ...and its assets, under the namespace assetPrefix created
      {
        source: '/blog-static/:path+',
        destination: `${process.env.BLOG_DOMAIN}/blog-static/:path+`,
      },
      // The dashboard zone owns /dashboard
      {
        source: '/dashboard',
        destination: `${process.env.DASHBOARD_DOMAIN}/dashboard`,
      },
      {
        source: '/dashboard/:path+',
        destination: `${process.env.DASHBOARD_DOMAIN}/dashboard/:path+`,
      },
      {
        source: '/dashboard-static/:path+',
        destination: `${process.env.DASHBOARD_DOMAIN}/dashboard-static/:path+`,
      },
    ]
  },
}

module.exports = nextConfig
```

**Three rules per zone, not one**, and the guide is explicit about why:

> *"For each path served by a different zone, you would add a rewrite rule to send that path to the domain of the other zone, and you also need to rewrite the requests for the static assets."*

The bare `/blog` rule and the `/blog/:path+` rule are separate because of how the matcher works:

> *"You can use modifiers on parameters: `*` (zero or more), `+` (one or more), `?` (zero or one). For example, `/blog/:slug*` matches `/blog`, `/blog/a`, and `/blog/a/b/c`."*
> — [`rewrites`](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)

`:path+` requires **one or more** segments, so it does not match the bare `/blog`. The guide writes both rules rather than collapsing them to `:path*`; either works, but collapse them knowingly, not accidentally.

Two further matcher properties decide whether your zone rules are as tight as you think:

> *"The pattern `/blog/:slug` matches `/blog/first-post` and `/blog/post-1` but not `/blog/a/b` (no nested paths). Patterns are anchored to the start: `/blog/:slug` will not match `/archive/blog/first-post`."*

Anchoring is what makes a path-prefix taxonomy safe: `/blog/:path+` cannot accidentally capture `/archive/blog/x`. Non-nesting is what makes `:slug` the wrong modifier for a zone, which owns an arbitrarily deep tree.

## The destination is a full URL, and that has consequences

> *"`destination` should be a URL that is served by the zone, including scheme and domain. This should point to the zone's production domain, but it can also be used to route requests to `localhost` in local development."*

That is why the destinations above are environment variables. In development `BLOG_DOMAIN` is `http://localhost:3001`; in production it is the zone's real deployment URL. The zone's *public* face stays `example.com/blog`, because a rewrite masks its destination:

> *"Rewrites act as a URL proxy and mask the destination path, making it appear the user hasn't changed their location on the site. In contrast, redirects will reroute to a new page and show the URL changes."*

🔴 **The zone's own deployment domain stays publicly reachable unless you close it.** A rewrite is a server-side fetch, not an access control; the zone's deployment URL still answers for `/blog/hello` unless you put something in front of it. The documentation does not raise this — it is a deployment concern, not a framework one — but it is the difference between one canonical origin and two, with everything that implies for search indexing, cookie scope and CSP.

And the constraint that determines your path taxonomy before anyone writes a line of code:

> *"**Good to know**: URL paths should be unique to a zone. For example, two zones trying to serve `/blog` would create a routing conflict."*

## The alternative — `proxy.ts`, for decisions a static config cannot make

> *"Routing requests through `rewrites` is recommended to minimize latency overhead for the requests, but proxy can also be used when there is a need for a dynamic decision when routing. For example, if you are using a feature flag to decide where a path should be routed such as during a migration, you can use proxy."*

```ts
// apps/www/proxy.ts — dynamic zone selection during a migration
import { NextResponse, type NextRequest } from 'next/server'
import { isEnabled } from '@acme/flags'

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/pricing') && (await isEnabled('pricing-v2-zone'))) {
    return NextResponse.rewrite(
      `${process.env.PRICING_ZONE_DOMAIN}${pathname}${search}`
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/pricing/:path*'],
}
```

The guide's own snippet is a `proxy.js` exporting `async function proxy(request)` and calling `NextResponse.rewrite` with `${rewriteDomain}${pathname}${search}` — the file convention that replaced `middleware.ts`, covered in [chapter 2 · the proxy.ts layer](../02-routing-and-navigation/07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md). Note the trade the guide names explicitly: **latency**. A `rewrites` entry is matched by the routing layer; a proxy runs your code on every matched request. Use it when the routing decision is genuinely dynamic — a flag, a cohort, a cutover — and delete it when the migration ends. A permanent proxy that always returns the same answer is a static rewrite paying a runtime tax.

## Where a zone rewrite sits in the request pipeline

You cannot debug a zone routing problem without this list. Quoted exactly as the `rewrites` reference numbers it:

> 1. *"headers are checked/applied"*
> 2. *"redirects are checked/applied"*
> 3. *"proxy"*
> 4. *"`beforeFiles` rewrites: for each entry, if `source`, `has`, and `missing` matches the request, it's rewritten to `destination`."*
> 5. *"static files from the public directory, `_next/static` files, and non-dynamic pages are checked/served"*
> 6. *"`afterFiles` rewrites are tried in order. If a `source`, `has`, and `missing` matches the request, it's rewritten to `destination`; the first rewrite that resolves to a static file, page, or dynamic route is served."*
> 7. *"dynamic routes (e.g., `app/blog/[slug]/page.tsx`) are matched against the current path"*
> 8. *"`fallback` rewrites are checked/applied, these are applied before rendering the 404 page and after dynamic routes/all static assets have been checked. If you use `fallback: true/'blocking'` in `getStaticPaths`, those dynamic routes take priority over the fallback `rewrites` defined in your `next.config.js`."*

**Step 5 is the one that decides zone bugs.** A plain array of rewrites — which is what the guide's routing example returns — lands in `afterFiles`:

> *"When the `rewrites` function returns an array, rewrites are applied after checking the filesystem (pages and `/public` files) and before dynamic routes. When the `rewrites` function returns an object of arrays with a specific shape, this behavior can be changed and more finely controlled, as of `v10.1` of Next.js"*

So if the router zone happens to have a real route or a `public/` file at a path a zone claims, **the router zone wins and the rewrite never runs.** The docs describe `beforeFiles` as the phase that *"allows overriding page files"*, which is precisely the tool for that:

```js
// apps/www/next.config.js — force the zone to win over anything local
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/blog/:path*',
          destination: `${process.env.BLOG_DOMAIN}/blog/:path*`,
        },
        {
          source: '/blog-static/:path+',
          destination: `${process.env.BLOG_DOMAIN}/blog-static/:path+`,
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

module.exports = nextConfig
```

⚠️ One behavioural difference comes with that phase:

> *"**Good to know**: rewrites in `beforeFiles` do not check the filesystem/dynamic routes immediately after matching a source, they continue until all `beforeFiles` have been checked."*

**Which phase should a zone rewrite live in?** The guide's example uses a plain array, so `afterFiles` is the documented default and is correct when path ownership is genuinely exclusive. Choose `beforeFiles` when you are migrating a path range that still has a live implementation in the router zone and you want the zone to take precedence during cutover — that is the case where the filesystem check at step 5 is your enemy rather than your safety net.

**The third phase, `fallback`, has one job worth knowing about here and is covered where it belongs** — it runs at step 8, after dynamic routes, which makes it the strangler-fig tool for replacing a legacy origin rather than for dispatching to a sibling zone. See [01d · migrating into and out of zones](01d-when-zones-are-the-wrong-answer.md).

**What a shared origin implies for Server Actions, cookies and sessions** is the other half of the routing story, and it lives with the rest of the boundary discussion in [01c](01c-crossing-zone-boundaries.md).

## Gotchas

**★ Symptom: `/blog` 404s but `/blog/hello` works.** Cause: you wrote only `source: '/blog/:path+'`, and `+` means one or more segments — the bare `/blog` matches nothing at all. Fix: add the bare rule as the guide does, or change the modifier to `*`, which matches zero or more.

```js
// Either write both rules, as the documentation does...
{ source: '/blog', destination: `${process.env.BLOG_DOMAIN}/blog` },
{ source: '/blog/:path+', destination: `${process.env.BLOG_DOMAIN}/blog/:path+` },
// ...or use * (zero or more), which subsumes the bare path in one rule
{ source: '/blog/:path*', destination: `${process.env.BLOG_DOMAIN}/blog/:path*` },
```

**★ Symptom: the rewrite is configured correctly and the router zone still serves its own page for a zone path.** Cause: a plain array of rewrites is `afterFiles`, which runs at step 6 — *after* the filesystem check at step 5. A leftover `app/blog/page.tsx` or `public/blog/index.html` in the router zone shadows the entire zone, and nothing warns you. Fix: delete the stale route (usually correct — two things claiming one path is the deeper bug), or move the rule into `beforeFiles`, checked at step 4.

```js
// apps/www/next.config.js
module.exports = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/blog/:path*', destination: `${process.env.BLOG_DOMAIN}/blog/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}
```

**★ Symptom: two zones both claim a path and routing appears nondeterministic across deploys.** Cause: the uniqueness rule was violated — *"URL paths should be unique to a zone. For example, two zones trying to serve `/blog` would create a routing conflict."* Fix: this is not a config bug, it is a taxonomy bug, and no `next.config.js` edit repairs it. Write the path map down as an owned artefact and treat a new top-level prefix as a change requiring both teams' sign-off.

```js
// apps/www/zone-map.js — one file, reviewed by both teams, imported by next.config.js
module.exports = {
  '/blog': process.env.BLOG_DOMAIN,
  '/blog-static': process.env.BLOG_DOMAIN,
  '/dashboard': process.env.DASHBOARD_DOMAIN,
  '/dashboard-static': process.env.DASHBOARD_DOMAIN,
}
```

**Symptom: external rewrites break after enabling `trailingSlash`.** Cause: the `source` no longer matches the incoming shape. Fix, quoted from the docs — *"If you're using `trailingSlash: true`, you also need to insert a trailing slash in the `source` parameter. If the destination server is also expecting a trailing slash it should be included in the `destination` parameter as well."*

```js
// apps/www/next.config.js
module.exports = {
  trailingSlash: true,
  async rewrites() {
    return [
      { source: '/blog/', destination: `${process.env.BLOG_DOMAIN}/blog/` },
      { source: '/blog/:path*/', destination: `${process.env.BLOG_DOMAIN}/blog/:path*/` },
    ]
  },
}
```

**Symptom: a rewrite loses its query parameters, or gains ones you did not expect.** Cause: parameter forwarding depends on whether the parameter is used in the destination — *"When using parameters in a rewrite the parameters will be passed in the query by default when none of the parameters are used in the `destination`"*, and *"If a parameter is used in the destination none of the parameters will be automatically passed in the query."* Fix: name them explicitly in the destination when you need both.

```js
// apps/www/next.config.js
{
  source: '/:first/:second',
  destination: '/:first?second=:second',
}
```

**Symptom: a zone path containing a literal regex character never matches.** Cause: *"The following characters `(`, `)`, `{`, `}`, `[`, `]`, `|`, `\`, `^`, `.`, `:`, `*`, `+`, `-`, `?`, `$` are used for regex path matching, so when used in the `source` as non-special values they must be escaped by adding `\\` before them."* Fix: escape them, using the docs' own example shape.

```js
// apps/www/next.config.js
{
  source: '/english\\(default\\)/:slug',
  destination: '/en-us/:slug',
}
```

**Symptom: a `basePath: false` rewrite fails when its destination is an internal path.** Cause: the option exists only for external rewrites — the docs' own inline comment reads *"this cannot be used for internal rewrites e.g. `destination: '/another'`"*, and the field description says it *"can be used for external rewrites only."* Fix: use it only where the destination is a full external URL, which in a multi-zone is exactly the zone-routing case.

```js
// apps/docs/next.config.js
module.exports = {
  basePath: '/docs',
  async rewrites() {
    return [
      { source: '/with-basePath', destination: '/another' }, // both get /docs
      { source: '/without-basePath', destination: 'https://example.com', basePath: false },
    ]
  },
}
```

## Interview questions

**★ A zone rewrite is configured correctly but the router zone keeps serving its own page. What is happening, and what is the real fix?**
A rewrites function returning a plain array runs in the `afterFiles` phase, which the documented order places *after* static files, `public/` files and non-dynamic pages are checked and served. Any real route in the router zone at that path wins before the rewrite is ever consulted. You can move the rule into `beforeFiles`, which runs at step 4 and, in the docs' words, *"allows overriding page files"* — but the better answer is usually to delete the stale route, because two applications claiming one path is the underlying bug and `beforeFiles` only hides it.

**★ Why does a zone need three rewrite rules rather than one?**
One for the bare path, one for everything under it, and one for the zone's asset namespace. The bare and nested cases are separate because `:path+` requires one or more segments, so it does not match `/blog` itself. The asset rule is separate because `assetPrefix` puts the zone's client assets on a *different* top-level path (`/blog-static`), and the guide is explicit that *"you also need to rewrite the requests for the static assets"* — without it the document routes correctly and never hydrates.

**When would you route zones with `proxy.ts` instead of `rewrites`?**
When the routing decision cannot be expressed statically — a feature flag, a percentage rollout, a per-cohort migration cutover. The docs recommend `rewrites` by default explicitly *"to minimize latency overhead for the requests"*, because a rewrite is matched by the routing layer while a proxy executes your code on every matched request. The right pattern is a proxy for the duration of a migration, collapsed back to a static rewrite when the cutover completes.

**What is the difference between a rewrite and a redirect here, and why does a zone need the rewrite?**
*"Rewrites act as a URL proxy and mask the destination path, making it appear the user hasn't changed their location on the site. In contrast, redirects will reroute to a new page and show the URL changes."* A zone architecture depends entirely on the masking: the whole point is that `example.com/blog` and `example.com/dashboard` look like one site. A redirect would expose the zone's real deployment domain in the address bar, break the single-origin story, and take cookies scoped to the public domain out of scope for the zone.

**How do you run a multi-zone setup locally?**
Point each zone's destination at a different localhost port through an environment variable, which the docs sanction directly: `destination` *"should point to the zone's production domain, but it can also be used to route requests to `localhost` in local development."* In practice the router zone runs on 3000 and each other zone on its own port, with `BLOG_DOMAIN=http://localhost:3001` in the router's local env. The consequence worth naming in an interview: **every developer on either team now runs both applications locally**, which is a real tax on the "independent teams" promise the architecture was bought for.

**Two zones want to serve `/settings`. How do you resolve it?**
You do not resolve it in configuration; the docs say plainly that *"URL paths should be unique to a zone"* and that two zones claiming one path *"would create a routing conflict."* Either one zone owns `/settings` and exposes what the other needs through an API or a shared package, or the paths are renamed to `/account/settings` and `/workspace/settings` so ownership is unambiguous. The valuable observation is that the URL taxonomy becomes an organisational contract in this architecture — it is the interface between two teams, and it should be reviewed like one.

---

← [Multi-zone architecture](01-micro-frontends-and-multi-zone-architectures-for-decoupled-t.md) · [Chapter index](01-explanation.md) · Next → [Crossing a zone boundary](01c-crossing-zone-boundaries.md)
