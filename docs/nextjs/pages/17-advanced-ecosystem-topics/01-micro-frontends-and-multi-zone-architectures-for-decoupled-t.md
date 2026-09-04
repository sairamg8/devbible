---
title: "A Next.js multi-zone is several independent Next applications stitched behind one origin, composed at the URL and never at runtime — which is why a zone needs an assetPrefix and why basePath is not the same tool"
sidebar_label: "01 · Multi-zone architecture"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — the multi-zones guide
> ([nextjs.org/docs/app/guides/multi-zones](https://nextjs.org/docs/app/guides/multi-zones),
> served `lastUpdated` 2026-06-01), the `assetPrefix` reference
> ([nextjs.org](https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix),
> 2026-08-25) and the `basePath` reference
> ([nextjs.org](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath),
> 2025-06-16). All three pages returned `version: 16.3.4` in their own metadata.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified;
> **no sandbox run**.

**Multi-zones is the only micro-frontend architecture Next.js documents, and it composes at the URL, not at runtime.** Each zone is an ordinary, separately built, separately deployed Next.js application that owns a set of paths; one HTTP proxy — often just one of the zones — routes each incoming request to whichever application owns the path. Nothing is federated: no module is loaded across an application boundary at runtime, no React tree spans two zones, no client bundle is shared. That is the whole design, and it buys exactly one thing worth having — **two teams can ship on two cadences without coordinating a build** — in exchange for duplicated bundles, a full page load every time a user crosses a boundary, and version skew you manage by policy rather than by compiler. If your org chart does not actually have that second team in it, you are paying the cost for nothing; [01d](01d-when-zones-are-the-wrong-answer.md) makes that case in full.

## What the documentation actually claims, verbatim

The guide is titled *"How to build micro-frontends using multi-zones and Next.js"*, and it opens by defining the term rather than assuming it:

> *"Multi-Zones are an approach to micro-frontends that separate a large application on a domain into smaller Next.js applications that each serve a set of paths. This is useful when there are collections of pages unrelated to the other pages in the application. By moving those pages to a separate zone (i.e., a separate application), you can reduce the size of each application which improves build times and removes code that is only necessary for one of the zones. Since applications are decoupled, Multi-Zones also allows other applications on the domain to use their own choice of framework."*
> — [multi-zones guide](https://nextjs.org/docs/app/guides/multi-zones)

Read the three benefits that sentence actually names, because they are narrower than the ones people quote it for: **smaller applications**, **improved build times**, and **freedom of framework per application**. It does not claim faster navigation, better runtime performance, or independent failure domains — those you may or may not get, and the guide does not promise them.

The worked split it gives is deliberately mundane:

- `/blog/*` for all blog posts
- `/dashboard/*` for all pages when the user is logged-in to the dashboard
- `/*` for the rest of your website not covered by other zones

> *"With Multi-Zones support, you can create three applications that all are served on the same domain and look the same to the user, but you can develop and deploy each of the applications independently."*

**"Look the same to the user" is doing a lot of work in that sentence** and is only true of the URL bar. It is emphatically not true of navigation, which the same page addresses two paragraphs later and which is the subject of [01c · crossing a zone boundary](01c-crossing-zone-boundaries.md).

## Multi-zones is not Module Federation, and the distinction is architectural

There are two families of micro-frontend, and conflating them is the most common way this conversation goes wrong in a design review.

| | **Multi-zones (URL composition)** | **Runtime composition (Module Federation, single-spa, web components)** |
|---|---|---|
| Unit of composition | A **path prefix** | A **component or module** |
| When composition happens | At request time, in a proxy | At runtime, in the browser, inside one React tree |
| Boundary crossing costs | A full document load | A dynamic `import()` |
| Two fragments on one screen | Impossible — one zone renders the page | The entire point |
| Shared React instance | No | Required, and the hardest part to get right |
| Version skew blast radius | Contained per zone | Shared singletons must agree |
| Documented by Next.js | ✅ this guide | ❌ see below |

🔴 **State the limit of the evidence honestly.** I fetched four Next.js documentation pages for this topic — the multi-zones guide and the `assetPrefix`, `basePath` and `rewrites` references. **None of them mentions Module Federation, runtime module sharing, or composing two applications into one React tree.** The only micro-frontend approach documented across those pages is multi-zones. That is *not* the same as "Next.js cannot do Module Federation" — I did not search the whole documentation set and cannot rule out a page elsewhere, and third-party plugins have historically existed. What I can say with sources behind it: **if you build runtime composition on Next.js, you are outside the documented path and you own every integration problem it creates.** Treat that as the decisive fact in a design review, not as a claim about what is technically possible.

## The anatomy of a zone: an ordinary app plus one config line

> *"A zone is a normal Next.js application where you also configure an assetPrefix to avoid conflicts with pages and static files in other zones."*

That is the entire definition. A zone has no special mode, no plugin, no marker file, no `zone: true` key. It is a Next.js app you could run standalone.

```js
// apps/blog/next.config.js — the blog zone
/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: '/blog-static',
}

module.exports = nextConfig
```

The blog zone's routes genuinely live at `app/blog/page.tsx` and `app/blog/[slug]/page.tsx`. **The zone owns the `/blog` prefix by having its routes there**, not by any prefix-rewriting magic — which is why the guide's rewrite rules map `/blog` to `${process.env.BLOG_DOMAIN}/blog` and not to the zone's root. That routing layer is [01b](01b-routing-requests-to-a-zone.md).

## Why a zone needs `assetPrefix` at all — the failure it prevents

This is the part worth understanding mechanically rather than copying, because when it breaks the page renders and then does nothing, which is a confusing symptom to debug from a screenshot.

**Every Next.js build emits its client assets under `/_next/static/`.** Two independently built applications therefore both want to serve `/_next/static/chunks/…` — from one origin, where only one of them can win.

**The failing case, step by step.** Suppose you set up the rewrites but skip `assetPrefix` on the blog zone:

1. A user requests `https://example.com/blog/hello`.
2. The router zone's rewrite sends it to the blog zone. The blog zone renders correctly and returns HTML.
3. That HTML references its own client entry — a path under `/_next/static/chunks/`, carrying a hash from the **blog** build.
4. The browser resolves that against the origin it is on, `example.com`, and issues a second request for `/_next/static/chunks/…`.
5. The router zone has no rewrite matching `/_next/`, so **the default application answers** — from *its* `.next/static` directory, produced by a different build, which does not contain the blog build's chunk.
6. The document is on screen; the JavaScript that would hydrate it never arrives.

That is the collision the config line exists to prevent, and the documentation says so plainly:

> *"Next.js assets, such as JavaScript and CSS, will be prefixed with `assetPrefix` to make sure that they don't conflict with assets from other zones. These assets will be served under `/assetPrefix/_next/...` for each of the zones."*

With `assetPrefix: '/blog-static'`, the blog zone's HTML asks for `/blog-static/_next/static/chunks/…`, a path no other zone claims, which the router forwards to the blog zone. **The prefix is a namespace, not a CDN** — even though the same option's primary documented job is exactly a CDN:

> *"Next.js will automatically use your asset prefix for the JavaScript and CSS files it loads from the `/_next/` path (`.next/static/` folder)."*
> — [`assetPrefix`](https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix)

One asymmetry saves a config line and confuses everyone who inherits the setup:

> *"The default application handling all paths not routed to another more specific zone does not need an `assetPrefix`."*

The default app is the one already serving `/_next/`, so there is nothing to disambiguate it from. It is the zone whose config looks *wrong* and is correct.

## The other half of `assetPrefix`: it is primarily a CDN option

Worth knowing because it explains the option's shape, and because it is the constraint you hit if you try to use both jobs at once. The reference page's own description is *"Learn how to use the assetPrefix config option to configure your CDN"*, and the documented setup is an absolute URL rather than a path:

```js
// next.config.mjs — the CDN form, taken from the assetPrefix reference
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

The phase check matters: a CDN origin during local development points your dev server's asset requests at production. **The multi-zone form of the same option is a relative path (`/blog-static`) rather than an absolute URL**, which is what turns it from "fetch these from elsewhere" into "namespace these here".

Two operational rules come with the CDN job, and the second is a security statement:

> *"The only folder you need to host on your CDN is the contents of `.next/static/`, which should be uploaded as `_next/static/` as the above URL request indicates. **Do not upload the rest of your `.next/` folder**, as you should not expose your server code and other configuration to the public."*

> *"**Attention**: Deploying to Vercel automatically configures a global CDN for your Next.js project. You do not need to manually set up an Asset Prefix."*

⚠️ **The option holds one value, so a zone cannot express both jobs through this key.** The documentation describes each use independently and never describes combining them; I could not confirm a supported way to give one zone both a `/blog-static` namespace and a separate CDN origin. On Vercel the question does not arise. Elsewhere, settle it against your CDN's own path handling rather than guessing at `next.config.js`.

## `assetPrefix` and `basePath` solve different problems and are not interchangeable

Both options put a string in front of paths, which is why they get swapped. They are not alternatives.

| | `assetPrefix` | `basePath` |
|---|---|---|
| Prefixes | Client assets loaded from `/_next/` | The application's **routes** |
| Affects `<Link href="/about">` | No | Yes — becomes `/docs/about` automatically |
| Affects `next/image` `src` | No | 🔴 **No — you add it yourself** |
| Changeable without a rebuild | The docs do not say | 🔴 No, explicitly |
| Covers files in `public/` | No, explicitly | The docs do not say |
| Role in a multi-zone | The documented one — asset namespacing | Never mentioned by the multi-zones guide |

The `assetPrefix` page is unusually direct about which one you want for sub-path hosting:

> *"**Good to know**: Next.js 9.5+ added support for a customizable Base Path, which is better suited for hosting your application on a sub-path like `/docs`. We do not suggest you use a custom Asset Prefix for this use case."*

And `basePath` carries a constraint that matters enormously to a "deploy independently" story:

> *"**Good to know**: This value must be set at build time and cannot be changed without re-building as the value is inlined in the client-side bundles."*
> — [`basePath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath)

**Which means a zone's path prefix is a build-time artefact if you implement it with `basePath`.** You cannot move a zone from `/blog` to `/news` with an environment variable and a restart; you rebuild it. ⚠️ The multi-zones guide takes the other route entirely — its example zone has real routes under `/blog` and never sets `basePath` — so if you reach for `basePath` in a zone you are choosing an approach the guide does not describe, for the sake of not nesting your `app/` directory one level deep.

The link behaviour is worth quoting because it is both what makes `basePath` attractive and what makes it a partial answer:

> *"When linking to other pages using `next/link` and `next/router` the `basePath` will be automatically applied. For example, using `/about` will automatically become `/docs/about` when `basePath` is set to `/docs`."*

> *"When using the `next/image` component, you will need to add the `basePath` in front of `src`. For example, using `/docs/me.png` will properly serve your image when `basePath` is set to `/docs`."*

Links get it for free; image sources do not. That inconsistency is documented, deliberate, and a reliable source of broken images after someone adds a `basePath`.

## Gotchas

**★ Symptom: a zone's pages render but never become interactive, and asset requests are answered by the default zone.** Cause: the zone has no `assetPrefix`, so its HTML requests `/_next/static/…` from the shared origin, and the default application — which owns `/_next/` — answers with a build that has none of those chunk hashes. Fix: give every non-default zone an `assetPrefix` **and** rewrite that namespace to it. Both halves are required; the config line alone does nothing.

```js
// apps/blog/next.config.js
module.exports = { assetPrefix: '/blog-static' }
```

```js
// apps/www/next.config.js — the matching rewrite, which is the half people forget
module.exports = {
  async rewrites() {
    return [
      { source: '/blog', destination: `${process.env.BLOG_DOMAIN}/blog` },
      { source: '/blog/:path+', destination: `${process.env.BLOG_DOMAIN}/blog/:path+` },
      { source: '/blog-static/:path+', destination: `${process.env.BLOG_DOMAIN}/blog-static/:path+` },
    ]
  },
}
```

**★ Symptom: you copied a multi-zone setup from an older tutorial and it contains a `beforeFiles` rewrite mapping `/blog-static/_next/:path+` back to `/_next/:path+` inside the zone itself.** Cause: that rewrite was required before Next.js 15 and is now dead config that will quietly outlive everyone who understood it. The guide is explicit: *"In versions older than Next.js 15, you may also need an additional rewrite to handle the static assets. This is no longer necessary in Next.js 15."* Fix: delete it — on **Next.js 16.3.4** the `assetPrefix` line alone is sufficient inside the zone.

```js
// apps/blog/next.config.js — Next.js 15+ / 16.3.4: this is the whole zone config
module.exports = {
  assetPrefix: '/blog-static',
}
```

**Symptom: images 404 after you added `basePath` to a zone, while every link still works.** Cause: `basePath` is applied automatically to `next/link` but **not** to `next/image` — the docs say *"you will need to add the `basePath` in front of `src`"*. Fix: prefix the source, and centralise the constant so one edit governs.

```tsx
// apps/docs/app/page.tsx
import Image from 'next/image'

const BASE_PATH = '/docs' // must equal next.config.js basePath

export default function Page() {
  return (
    <Image
      src={`${BASE_PATH}/me.png`}
      alt="Picture of the author"
      width={500}
      height={500}
    />
  )
}
```

**Symptom: you try to move a zone from `/blog` to `/news` with an environment variable and it has no effect.** Cause: if the prefix came from `basePath`, it is *"set at build time and cannot be changed without re-building as the value is inlined in the client-side bundles."* Fix: change the rewrite `source` in the router zone **and** rebuild the zone with the new `basePath` — or, better, follow the guide and give the zone real routes under its prefix, so only the router's rewrite has to change and no rebuild is involved.

```js
// apps/news/next.config.js — rebuild required for this to take effect anywhere
module.exports = {
  basePath: '/news',
  assetPrefix: '/news-static',
}
```

**Symptom: files in the zone's `public/` folder are not served from the zone's asset namespace.** Cause: `assetPrefix` does not cover them — *"While `assetPrefix` covers requests to `_next/static`, it does not influence the following paths: Files in the public folder; if you want to serve those assets over a CDN, you'll have to introduce the prefix yourself."* Fix: put zone-owned public files in a zone-named subdirectory so their paths are unique across the origin, then rewrite that path to the zone exactly as you did for `/blog-static`.

```
apps/blog/public/blog-assets/og-default.png   →  served at /blog-assets/og-default.png
```

```js
// apps/www/next.config.js — and route that namespace too
{ source: '/blog-assets/:path+', destination: `${process.env.BLOG_DOMAIN}/blog-assets/:path+` }
```

⚠️ The fetched `assetPrefix` page truncated immediately after that first bullet, so **I cannot state the full list of paths `assetPrefix` does not influence** — only that `public/` is one of them. If you depend on another path being covered, read the live page rather than trusting this one.

**Symptom: a shared CDN configuration and a zone `assetPrefix` fight each other.** Cause: `assetPrefix` is one option with two jobs — CDN origin and zone namespace — and it holds a single value, so a zone cannot have both a `/blog-static` namespace and a `https://cdn.example.com` origin expressed through this key. ⚠️ The documentation does not describe combining them, and I could not confirm a supported way to do so. Fix: on Vercel this does not arise, because — quoting the docs — *"Deploying to Vercel automatically configures a global CDN for your Next.js project. You do not need to manually set up an Asset Prefix."* Elsewhere, treat it as an open question to settle against your CDN's own path-rewriting features rather than through `next.config.js`. Do not guess.

**Symptom: someone added `assetPrefix` to the default zone "for consistency" and broke it.** Cause: the default zone serves `/_next/` for the whole origin; prefixing it moves those assets to a path nothing routes, unless you also add a rewrite that did not previously need to exist. Fix: revert it. The guide's asymmetry is deliberate — *"The default application handling all paths not routed to another more specific zone does not need an `assetPrefix`."*

## Interview questions

**★ What is a Next.js multi-zone, in one sentence, and what exactly does it compose?**
Several independently built and deployed Next.js applications, each owning a set of URL paths, stitched behind a single origin by rewrites in an HTTP proxy — which may be one of the applications. It composes at the **URL**: a request is routed to exactly one zone, which renders the whole page. Nothing is composed at runtime; there is no shared React tree and no cross-application module loading, which is the fact that determines every other property of the architecture.

**★ Why does a zone need `assetPrefix`, when the rewrites already send its pages to it?**
Because rewrites route the *document* request, but the browser then issues follow-up requests for the assets that document references — and every Next.js build emits those under `/_next/static/`. Two applications behind one origin both claim that path, and only one can hold it. `assetPrefix` moves a zone's assets into a namespace nobody else claims: the docs say the assets *"will be served under `/assetPrefix/_next/...` for each of the zones."* Without it the HTML arrives and the JavaScript does not, so the page renders and never hydrates — which reads as a blank interactive surface, not as a 404.

**Why does the default zone not need an `assetPrefix`?**
It is the one already serving `/_next/`, and there is nothing to disambiguate it from. The guide states it directly: *"The default application handling all paths not routed to another more specific zone does not need an `assetPrefix`."* Adding one to the default zone is not merely pointless — it breaks asset serving unless you also add a rewrite that would otherwise not exist.

**★ `basePath` or `assetPrefix` for a zone — which, and why?**
They solve different problems, and the question is slightly a trap. `assetPrefix` namespaces the zone's client assets and is the mechanism the multi-zones guide actually uses. `basePath` prefixes the application's *routes* and is what the `assetPrefix` page recommends for sub-path hosting — *"we do not suggest you use a custom Asset Prefix for this use case."* The guide's zone gets its path prefix by having real routes under `/blog` rather than by setting `basePath`. So: `assetPrefix` always; `basePath` only if you want the zone's `app/` directory to stay unprefixed — and then accept that the prefix is inlined into client bundles at build time and cannot be changed without rebuilding.

**Is multi-zones the same thing as Module Federation?**
No, and the difference is the unit of composition. Module Federation composes **modules** at runtime inside one browser page and one React tree, which implies a shared React instance, shared singletons and a version-compatibility contract between fragments. Multi-zones composes **paths** at request time; each zone renders a complete page by itself and the boundary between them is a document load. Across the four documentation pages I checked for this topic, Module Federation is never mentioned — multi-zones is the approach Next.js documents. Building runtime composition on Next.js is possible in principle but puts you outside the documented path, and that is usually the decisive argument in a design review.

**What does the guide actually promise you get from splitting into zones?**
Three specific things, and precision matters here because people over-claim: *"you can reduce the size of each application which improves build times and removes code that is only necessary for one of the zones"*, and *"Multi-Zones also allows other applications on the domain to use their own choice of framework."* Smaller apps, faster builds, framework freedom per zone. It does not promise faster page loads, better runtime performance, or fault isolation — and because every boundary crossing is a hard navigation, the user-facing performance story is usually worse, not better.

**A colleague says "we'll use multi-zones so the checkout widget and the product page can be owned by different teams on the same screen." What is wrong with that sentence?**
Two zones cannot appear on one screen. A request resolves to exactly one zone, and that zone renders the entire document; there is no mechanism in this architecture for one zone to embed a fragment of another. What they are describing is runtime composition, which is a different architecture with a different cost profile. Under multi-zones, a shared checkout widget is a shared **package**, versioned and installed into both zones — which is what the guide's "sharing code" section points at with monorepos and NPM packages.

**A zone is "a normal Next.js application" — so what actually makes it a zone?**
Only two things, and neither is in the zone's own code: an `assetPrefix` that namespaces its assets, and a rewrite somewhere else that sends a path range to it. There is no zone mode, no marker file and no framework awareness of the arrangement. That is genuinely useful to know operationally — a zone can be run, tested and deployed standalone on its own domain, which is what makes the "independent deploy" claim real rather than aspirational.

---

← [Chapter index](01-explanation.md) · Next → [Routing requests to a zone](01b-routing-requests-to-a-zone.md)
