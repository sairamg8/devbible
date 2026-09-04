---
title: "File-based metadata goes dynamic without any code of yours, `/_not-found` inherits your root layout's `generateMetadata` and must prerender with no page body for a marker to attach to, and the build flags that tell you which frame is at fault are not on by default"
sidebar_label: "01g · File metadata and the 404 route"
sidebar_position: 7
description: "The whole file-based metadata family and its priority over the config object, why an icon inside a dynamic segment is implicitly dynamic, the framework-synthesized /_not-found and /_global-error routes no dynamic marker can rescue, global-not-found as the escape, and debugging with --debug-prerender."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Metadata Files index](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)
> (page `lastUpdated: 2025-10-17`),
> [favicon / icon / apple-icon](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons) (`2026-03-03`),
> [`manifest.json`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest) (`2026-03-03`),
> [`not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) (`2026-07-10`),
> and the insight pages
> [`blocking-prerender-metadata-runtime`](https://nextjs.org/docs/messages/blocking-prerender-metadata-runtime)
> and [`blocking-prerender-metadata-dynamic`](https://nextjs.org/docs/messages/blocking-prerender-metadata-dynamic).
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, no build output reproduced.

**[01f](01f-metadata-under-cache-components.md) gives you three fixes for metadata that cannot be prerendered, and then names two consequences big enough to need their own page. This is that page. The first is that file-based metadata can go dynamic with no dynamic code in it at all — an `icon.tsx` inside a dynamic segment implicitly depends on `params`, which is enough. The second is worse: `/_not-found` and `/_global-error` are routes the framework synthesizes, they inherit your root layout's `generateMetadata`, they must be statically prerendered, and they have no page body — so the `<Suspense>`-wrapped dynamic marker, which is the escape hatch for every other route, has nothing to attach to.**

## The whole file-based family, and why it outranks your code

| File | Emits | Notes |
|---|---|---|
| `favicon.ico` | `<link rel="icon" href="/favicon.ico" sizes="any">` | 🔴 root of `app/` only |
| `icon.(ico\|jpg\|jpeg\|png\|svg)` | `<link rel="icon">` with generated `type` and `sizes` | any segment |
| `icon.(js\|ts\|tsx)` | the same, from a generated image | any segment |
| `apple-icon.(jpg\|jpeg\|png)` | `<link rel="apple-touch-icon">` | any segment |
| `apple-icon.(js\|ts\|tsx)` | the same, generated | any segment |
| `opengraph-image` / `twitter-image` | the OG and Twitter image tags | [02d](02d-the-opengraph-image-and-twitter-image-file-conventions.md) |
| `manifest.(json\|webmanifest\|js\|ts)` | `<link rel="manifest">` | root of `app/` |
| `sitemap.(xml\|js\|ts)` | not a head tag — a route | [03](03-sitemapts-and-robotsts-automation-localized-metadata-for-i18.md) |
| `robots.(txt\|js\|ts)` | not a head tag — a route | [03b](03b-robotsts-and-the-crawl-directives.md) |

**File-based metadata has higher priority than both `metadata` and `generateMetadata`.** That is the documented ordering, and it is the correct default for the reason the reference gives about icons and OG images alike: the file API generates the correct metadata *"rather than having to sync the config export with actual files."*

The icon rules that produce surprises:

> *"The `favicon` image can only be located in the top level of `app/`."*

> *"You can set multiple icons by adding a number suffix to the file name. For example, `icon1.png`, `icon2.png`, etc. Numbered files will sort lexically."*

🔴 Lexical sorting means `icon10.png` sorts **before** `icon2.png`. If order matters, zero-pad.

> *"`sizes="any"` is added to icons when the extension is `.svg` or the image size of the file is not determined."*

> *"You cannot generate a `favicon` icon. Use `icon` or a `favicon.ico` file instead."*

That last one is a hard stop with no workaround: `favicon.tsx` is not a thing. If you want a generated icon, it is `icon.tsx`, and browsers requesting `/favicon.ico` directly will get whatever your platform does with an unmatched path.

Also worth noting from the icon reference: generated **icons** take only `size` and `contentType` config exports — there is no `alt`, because an icon has no alt text. The generated OG images take all three.

## Why a file goes dynamic without any dynamic code

Every code-form metadata file is a Route Handler that is *"cached by default unless it uses a Request-time API or dynamic config option"*. The trap is that being inside a dynamic segment is enough:

```
app/
└── products/
    └── [slug]/
        ├── page.tsx
        └── opengraph-image.tsx     ← implicitly depends on params
```

The handler does not have to *read* `params` to be affected. It exists once per `slug`, so producing it at build requires knowing the set of slugs — which means `generateStaticParams`, or nothing gets prerendered.

```tsx
// app/products/[slug]/page.tsx — the same generateStaticParams covers
// the page, the opengraph-image and any icon in the segment
export async function generateStaticParams() {
  const products = await db.product.findMany({
    where: { listed: true },
    select: { slug: true },
    take: 500, // prerender the ones that matter; the rest render on demand
  })
  return products.map((p) => ({ slug: p.slug }))
}
```

The alternative, and often the better one, is to stop generating: a static `opengraph-image.png` in the *parent* segment covers every product with one file, one build artefact and no per-slug cost. Per-product branding on an OG image is worth real money on a hundred products and worth nothing on a hundred thousand.

## The routes no marker can rescue

`/_not-found` and `/_global-error` are **synthesized by the framework**. They are not files you wrote — they are routes that exist because every application needs them — and three facts about them combine badly:

1. They **inherit the root layout**, including its `generateMetadata`.
2. They **must be statically prerendered**.
3. They **have no page body of yours** in which to place a component.

Fact 3 is what removes the escape hatch. [01f](01f-metadata-under-cache-components.md)'s third fix is a dynamic marker — a component that `await connection()` and returns `null`, wrapped in `<Suspense>` — placed in the page. On a synthesized route there is no page to place it in. So a root layout whose `generateMetadata` reads `cookies()`, `headers()` or does an uncached fetch produces a blocking-prerender error for `/_not-found` that **cannot be fixed at the route level.**

```tsx
// app/layout.tsx — 🔴 this breaks /_not-found, and the error names a route you never wrote
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const host = h.get('host')
  return {
    title: { default: 'SprintDesk', template: '%s · SprintDesk' },
    metadataBase: new URL(`https://${host}`),
  }
}
```

Two fixes, and they are genuinely different.

**Fix A — static metadata in the root layout.** Almost always right. The root layout's metadata is site identity; there is very little about it that legitimately varies per request. `metadataBase` in particular should come from an environment variable, not from the `Host` header ([01d](01d-metadatabase-url-composition-and-the-parent-promise.md)).

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!),
  title: { default: 'SprintDesk', template: '%s · SprintDesk' },
  description: 'Sprint planning that stays out of the way.',
}
```

**Fix B — `global-not-found.js`, which bypasses the root layout entirely.**

> *"The `global-not-found.js` file lets you define a 404 page for your entire application. Unlike `not-found.js`, which works at the route level, this is used when a requested URL doesn't match any route at all. Next.js **skips rendering** and directly returns this global page."*

It is **experimental** and gated:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
  },
}

export default nextConfig
```

and it comes with a real cost, stated by the reference:

> *"The `global-not-found.js` file bypasses your app's normal rendering, which means you'll need to import any global styles, fonts, or other dependencies that your 404 page requires."*

> *"Unlike `not-found.js`, this file must return a full HTML document, including `<html>` and `<body>` tags."*

```tsx
// app/global-not-found.tsx
import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for does not exist.',
}

export default function GlobalNotFound() {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <h1>404 - Page Not Found</h1>
        <p>This page does not exist.</p>
      </body>
    </html>
  )
}
```

⚠️ Because it bypasses the layout, it bypasses your theme too. The reference notes that the default not-found UI follows the OS colour scheme via `prefers-color-scheme` and does not read an app-level theme, and that `global-not-found.js` must apply the theme itself. A dark-mode site with a stark white 404 is the visible symptom.

The reference also names when `global-not-found.js` is the *design* answer rather than a workaround: an app with **multiple root layouts**, so there is no single layout to compose a 404 from, or a root layout defined with top-level dynamic segments such as `app/[country]/layout.tsx`.

## Status codes on the not-found route

Worth restating here because it is where people look for it:

> *"Next.js will return a `200` HTTP status code for streamed responses, and `404` for non-streamed responses"*

The full mechanism, and where `notFound()` has to be called to keep a real 404, is [05](05-common-seo-pitfalls-in-rsc-streaming-setups-and-automated-au.md).

## Debugging the insight

The build-time errors in this area name a route and not a line. Two flags change that:

```bash
# Full user-frame stack traces for prerender errors
next build --debug-prerender

# Iterate on just the routes that are failing
next build --debug-build-paths /dashboard /settings
```

And two opt-outs, for when you have decided a route is legitimately dynamic:

```tsx
// Per segment
export const instant = false
```

```ts
// next.config.ts — app-wide, downgrade the insight to a warning
const nextConfig = {
  experimental: {
    instantInsights: { validationLevel: 'manual-warning' },
  },
}
```

🔴 **Reach for `--debug-prerender` before the opt-out, not after.** The opt-out silences an insight that is usually correct; the flag tells you which frame of your own code caused it. Opting out of `/_not-found` in particular is opting out of the signal that your root layout does something per-request, which will keep costing you elsewhere.

## Gotchas

**★ An `icon.tsx` in a dynamic segment makes the route dynamic and you wrote no dynamic code.** Being inside a dynamic segment is an implicit dependency on `params`. Fix: `generateStaticParams` on the segment, or move to a static `icon.png` in the parent.

**★ `icon10.png` appears before `icon2.png`.** Numbered icon files sort lexically, per the reference. Fix: zero-pad — `icon02.png`, `icon10.png`.

**★ `favicon.tsx` does nothing.** You cannot generate a favicon; the reference says so explicitly. Fix: `icon.tsx` for a generated icon, or a real `favicon.ico` at the root of `app/`.

**★ `favicon.ico` in a nested segment is ignored.** It is root-only. Fix: use `icon` for per-section icons.

**★ A build error names `/_not-found`, a route you never created.** The framework synthesizes it and it inherits your root layout's `generateMetadata`. Fix: make the root layout's metadata static, which is almost always what it should have been.

**★ You added a `<Suspense>`-wrapped dynamic marker and `/_not-found` still fails.** There is no page body on a synthesized route to put a marker in. Fix: static root metadata, or `global-not-found.js`, which bypasses the root layout.

**★ `metadataBase` is built from the `Host` header and everything downstream is dynamic.** Reading `headers()` in the root layout's metadata poisons every route that inherits it, including the synthesized ones. Fix: an environment variable per deployment.

**★ `global-not-found.js` renders unstyled.** It bypasses the root layout, so global styles, fonts and your theme attribute are not applied. Fix: import them in the file — the reference says to, and suggests a smaller stylesheet and a simpler font for the page's own performance.

**★ `global-not-found.js` renders without `<html>` and `<body>`.** Unlike `not-found.js`, it must return a full document. Fix: include both tags, with `lang` set.

**★ The 404 page ignores your dark theme.** The default not-found UI follows `prefers-color-scheme` and does not read an app-level class or `data-theme`. Fix: provide your own `not-found.js`, or add a higher-specificity rule pair scoped to your theme selector.

**★ You set `instant = false` to make the error go away.** You silenced the report that your root layout is per-request; the cost stays and reappears as dynamic rendering elsewhere. Fix: `--debug-prerender` first, find the frame, and only opt out once you have decided the dynamism is intentional.

**★ A metadata file and a config export both exist and the file wins.** File-based metadata outranks `metadata` and `generateMetadata`. Fix: `find app -name 'icon.*' -o -name 'opengraph-image.*'` before debugging the code.

## Interview questions

**★ Why can a `/_not-found` prerender error not be fixed with the dynamic-marker pattern?**
Because the marker has to live somewhere. The pattern is a component that awaits `connection()` and returns `null`, wrapped in a `<Suspense>` boundary, placed inside the page — the boundary is what stops the dynamism propagating to the whole route. `/_not-found` is synthesized by the framework: it inherits your root layout but has no page body of yours, so there is no place to put the component and no boundary to contain it. That leaves two real fixes: make the root layout's metadata static, or use `global-not-found.js`, which bypasses the root layout entirely and therefore never inherits the offending `generateMetadata`.

**★ An `opengraph-image.tsx` in `app/products/[slug]/` contains no request-time API. Why is it dynamic?**
Because it lives inside a dynamic segment, so it implicitly depends on `params` — there is one image per slug, and producing them at build requires knowing the slugs. The framework cannot enumerate them for you, so without `generateStaticParams` on the segment there is nothing to prerender and the handler becomes per-request. The fix is either to supply `generateStaticParams` (which the page probably wants anyway) or to decide that per-product images are not worth the cost and put one static image in the parent segment.

**★ When is `global-not-found.js` the right design rather than a workaround?**
The reference names two cases and both are structural. First, an app with multiple root layouts — `app/(admin)/layout.tsx` and `app/(shop)/layout.tsx` — where there is no single layout from which to compose a 404, so any `not-found.js` you write belongs to one of them arbitrarily. Second, a root layout defined with top-level dynamic segments such as `app/[country]/layout.tsx`, where a consistent 404 is hard to compose because the layout itself needs a param the unmatched URL does not supply. In both, "skip rendering and return this document" is a simpler contract than trying to make the layout tree cover an unmatched path.

**★ What does `global-not-found.js` cost you?**
Everything the root layout was doing. Global styles, fonts, providers, the theme attribute on `<html>` — none of it runs, so all of it has to be imported and applied in the file, and the reference says exactly that. It must also return a complete HTML document including `<html>` and `<body>`, unlike `not-found.js`. And it is still experimental, gated behind `experimental.globalNotFound`, so it carries the usual risk that its shape changes. The reference's own advice is to keep it light — a smaller stylesheet and a simpler font — which is good advice generally for a page nobody wants to be on.

**★ How do you find which line caused a blocking-prerender insight?**
`next build --debug-prerender`, which produces full user-frame stack traces rather than naming a route, and `next build --debug-build-paths /a /b` to iterate on just the failing routes instead of rebuilding everything. The important discipline is the order: the opt-outs — `export const instant = false` per segment, or `experimental.instantInsights.validationLevel: 'manual-warning'` app-wide — exist for routes you have decided are legitimately dynamic, and using them before you know which frame is responsible converts a build error into a runtime cost you will not notice until it appears on an invoice.

**★ File-based metadata outranks `generateMetadata`. Is that the right precedence?**
Yes, and the reference gives the reason: the file API generates the correct metadata rather than requiring you to keep a config export in sync with actual files. A width, a height and a MIME type declared in code can silently stop matching the asset; derived from the file they cannot. The cost of that precedence is a specific and quite confusing debugging session — a computed `openGraph.images` being discarded by an `opengraph-image.png` someone added months ago — and the reason the first diagnostic step in this area is a file listing rather than a code read.

---

← [Metadata under Cache Components](01f-metadata-under-cache-components.md) · [Chapter 12 overview](01-explanation.md) · Next → [Open Graph](02-open-graph-twitter-cards-structured-json-ld.md)
