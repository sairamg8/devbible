---
title: "An `opengraph-image` file outranks anything you compute in `generateMetadata`, and the moment it becomes a `.tsx` it stops being an image and becomes a cached Route Handler with route segment config, a promise-typed `params` and a size limit that fails the build"
sidebar_label: "02d · The OG image file conventions"
sidebar_position: 11
description: "opengraph-image and twitter-image as files and as code: the tags each form emits, the alt.txt companion, the 8MB/5MB build failure, the alt/size/contentType module exports, params as a promise since 16.0, generateImageMetadata, and what 'statically optimized by default' really costs."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`opengraph-image` and `twitter-image` reference](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
> (page `lastUpdated: 2026-07-09`),
> [`generateImageMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-image-metadata)
> (`2025-10-08`), and the
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
> (`2026-08-25`).
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, no output blocks.

**The file conventions are the recommended way to set social images, and the reason is worth stating plainly: a file on disk cannot drift out of sync with a config export, because there is no config export. That convenience comes with a change of category that surprises people. A `.png` in a route segment is a static asset. The same name with a `.tsx` extension is a **specialised Route Handler** — it is cached by default, it takes route segment config, its `params` is a promise, and it can go dynamic and take the rest of your route with it. This page is both forms, what each emits, and the six ways the code form fails.**

## Two forms, one filename

| File convention | Supported types | What it is |
|---|---|---|
| `opengraph-image.(jpg\|jpeg\|png\|gif)` | image | a static asset, read at build |
| `twitter-image.(jpg\|jpeg\|png\|gif)` | image | a static asset, read at build |
| `opengraph-image.alt.txt` | text | alt text for the static image beside it |
| `twitter-image.alt.txt` | text | alt text for the static image beside it |
| `opengraph-image.(js\|ts\|tsx)` | code | a cached Route Handler returning a `Response` |
| `twitter-image.(js\|ts\|tsx)` | code | a cached Route Handler returning a `Response` |

Both forms land in any route segment, and both **override** `metadata.openGraph.images` / `metadata.twitter.images` for that segment and everything below it. File-based metadata has higher priority than the config object; that is the documented ordering and it is the single most confusing thing about this area when you inherit a codebase.

## The static form, and the one build failure

A static `opengraph-image.png` in a segment emits four tags:

```html
<meta property="og:image" content="<generated>" />
<meta property="og:image:type" content="<generated>" />
<meta property="og:image:width" content="<generated>" />
<meta property="og:image:height" content="<generated>" />
```

`twitter-image` emits the same four under `name="twitter:image*"`. Width, height and type come from reading the file — you do not declare them, which is precisely the sync problem the file convention exists to remove.

Alt text is a sibling text file, not a field:

```
app/about/
├── opengraph-image.png
└── opengraph-image.alt.txt      contents: About Acme
```

which emits `<meta property="og:image:alt" content="About Acme" />`. 🔴 **There is no alt without that file.** No warning, no lint rule, and no automated accessibility tool will notice, because the image is not in your DOM.

The one hard limit, verbatim:

> *"The `twitter-image` file size must not exceed 5MB, and the `opengraph-image` file size must not exceed 8MB. If the image file size exceeds these limits, the build will fail."*

Note the asymmetry — 5 MB for Twitter, 8 MB for Open Graph — and note that it is a **build failure**, not a warning. A designer dropping a 12 MB PNG export into the repo breaks the deploy, and the error names a file rather than a route, which is the one mercy here.

## The code form is a Route Handler

```tsx
// app/about/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'About Acme'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const interSemiBold = await readFile(
  join(process.cwd(), 'assets/Inter-SemiBold.ttf')
)

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        About Acme
      </div>
    ),
    { ...size, fonts: [{ name: 'Inter', data: interSemiBold, style: 'normal', weight: 400 }] }
  )
}
```

**`alt`, `size` and `contentType` are module exports, not return values, and not options.** They exist so Next can emit the metadata tags without executing the image function — which is what lets the tags be known at build time even when the image itself is generated later. The mapping is exact:

| Export | Tag |
|---|---|
| `alt` | `og:image:alt` |
| `size` | `og:image:width` and `og:image:height` |
| `contentType` | `og:image:type` |

Everything else about the handler follows from its category:

> *"`opengraph-image` and `twitter-image` are specialized Route Handlers that can use the same route segment configuration options as Pages and Layouts."*

> *"`opengraph-image.js` and `twitter-image.js` are special Route Handlers that are cached by default unless it uses a Request-time API or dynamic config option."*

> *"By default, generated images are statically optimized (generated at build time and cached) unless they use Request-time APIs or uncached data."*

Read those three together and the model is clear: **it is a page, in every way that matters for caching.** If it does an uncached `fetch`, it is dynamic. If it reads `cookies()`, it is dynamic. If it sets `export const dynamic = 'force-dynamic'`, it is dynamic. And a dynamic OG image is a function invocation per scrape, per share, forever.

## `params`, and the 16.0 change

```tsx
// app/shop/[slug]/opengraph-image.tsx
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // ...
}
```

`params` is *"a promise that resolves to an object"* — **since v16.0.0**, per the reference's own version history. A codebase migrated from 15 will have destructured it synchronously, and the failure is not a type error at runtime, it is `undefined` where a slug should be, which produces an image that renders the word `undefined` in 128px type and ships.

The scope is *"from the root segment down to the segment `opengraph-image` or `twitter-image` is colocated in"*:

| Route file | URL | `params` |
|---|---|---|
| `app/shop/opengraph-image.js` | `/shop` | `undefined` |
| `app/shop/[slug]/opengraph-image.js` | `/shop/1` | `Promise<{ slug: '1' }>` |
| `app/shop/[tag]/[item]/opengraph-image.js` | `/shop/1/2` | `Promise<{ tag: '1', item: '2' }>` |

🔴 **On a static segment `params` is `undefined`, not an empty promise.** `await params` on `undefined` throws. If a component is shared between a root-level and a dynamic-segment image, guard it.

## `generateImageMetadata` — several images from one file

```tsx
// app/icon.tsx
import { ImageResponse } from 'next/og'

export function generateImageMetadata() {
  return [
    { contentType: 'image/png', size: { width: 48, height: 48 }, id: 'small' },
    { contentType: 'image/png', size: { width: 72, height: 72 }, id: 'medium' },
  ]
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const iconId = await id
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 88,
          background: '#000',
          color: '#fafafa',
        }}
      >
        Icon {iconId}
      </div>
    )
  )
}
```

> *"each item **must** include an `id` value which will be passed as a promise to the props of the image generating function."*

Two asymmetries in this API that will cost you an afternoon if you have not met them:

1. **`id` reaches the image function as a promise; it is a plain `string` in the object you returned.** You write `id: 'small'` and receive `Promise<string>`.
2. **`generateImageMetadata`'s own `params` is a plain object, not a promise** — the reference's signature is `{ params }: { params: { slug: string } }` — while the image function's `params` *is* a promise. Two functions in the same file, two different shapes. This is what the reference documents at the versions cited; do not assume symmetry.

When `generateImageMetadata` is present, `alt`, `size` and `contentType` come from each returned item rather than from module exports. Exporting both is how you end up debugging why every generated variant is 1200×630.

## Choosing between the three ways to set an OG image

| Approach | Use when | Cost |
|---|---|---|
| `metadata.openGraph.images` with a URL | the image is produced elsewhere — a CMS, a design tool, an existing CDN | you must keep the config and the asset in sync yourself |
| static `opengraph-image.png` | the image is the same for every route under a segment | one more file; no per-route variation |
| `opengraph-image.tsx` | the image must contain per-route data | a build-time render per route, or a function invocation per scrape if it goes dynamic |

The third row is where teams over-reach. Generating a per-post image is genuinely valuable; generating one per *comment thread* is a build-time explosion or a permanent runtime cost, for a preview almost nobody will see. Prefer a static image per **section** and a generated image only where the route's identity is the point.

## Gotchas

**★ Your carefully computed `openGraph.images` is being ignored.** A file convention exists somewhere in the segment's ancestry and file-based metadata outranks the config object. Fix: `find app -name 'opengraph-image.*'` before reading a single line of metadata code — it is a two-second check that resolves an hour-long confusion.

**★ The build fails with no code change, after a design handoff.** Someone committed an OG image over 8 MB (or a Twitter image over 5 MB). The limits are documented and enforced at build. Fix: compress the asset, or generate it in code where the output size is a function of your JSX rather than of a designer's export settings.

**★ Your static OG image has no alt text and you thought it did.** Alt for a static image comes only from a sibling `opengraph-image.alt.txt`; setting `openGraph.images[0].alt` in metadata does not apply, because the file overrode the whole field. Fix: add the `.alt.txt` file.

**★ Migrating from 15: the generated image says `undefined`.** `params` became a promise in 16.0. Destructuring it synchronously yields `undefined` for every key and the value renders into the image. Fix: `const { slug } = await params`, and type the prop as `Promise<{ slug: string }>` so the compiler catches the next one.

**★ `await params` throws in a root-level image.** `params` is `undefined`, not an empty promise, for a segment with no dynamic parameters above it. Fix: only await it in files that actually sit under a dynamic segment, and give a shared component the resolved values as plain props.

**★ Every generated variant comes out the same size.** `generateImageMetadata` supplies `size` per item; a module-level `export const size` does not merge with it, it competes. Fix: when using `generateImageMetadata`, delete the module-level `alt`, `size` and `contentType` exports and put them in the returned objects.

**★ The OG image is a function invocation on every share.** The handler did an uncached `fetch` or read a request-time API, so it opted out of static optimisation exactly like a page would. Fix: fetch through a cached path, or pair the route with `generateStaticParams` so the image is rendered at build. If it genuinely must be per-request, know that you are paying for a render per scrape.

**★ The image is dynamic and you did not write any dynamic code.** A file-based image inside a dynamic segment implicitly depends on `params`, which is enough to make it dynamic under Cache Components. Fix: `generateStaticParams` on the segment, or a static `opengraph-image.png` instead. The full mechanism is [01f](01f-metadata-under-cache-components.md) and [01g](01g-file-metadata-the-404-route-and-debugging-the-insight.md).

**★ `size` says 1200×630 and the actual image is 600×315.** The module export sets the *tags*; the `ImageResponse` options set the *pixels*. Nothing cross-checks them. Fix: spread one into the other — `new ImageResponse(element, { ...size })` — which is exactly why every example in the documentation does that.

**★ A GIF works as a static OG image but nothing animates.** `.gif` is an accepted file type for the convention; whether a given unfurler animates it is the unfurler's business and is not documented here. Fix: treat it as a still image and pick the frame you want to be seen.

## Interview questions

**★ Why do the docs recommend the file convention over `metadata.openGraph.images`?**
Because it removes an entire class of drift. With the config export you are asserting a URL, a width, a height and a MIME type, and nothing checks that any of them still match the asset — a designer replaces a 1200×630 image with a 1600×900 one and your tags now lie, which is worse than having no tags because consumers size their layout from them. The file convention derives all four from the file itself. The trade is priority: the file *wins* over the config object, so it is also the thing that silently overrides your computed images when you forget it exists.

**★ What actually changes when `opengraph-image.png` becomes `opengraph-image.tsx`?**
Its category. The `.png` is a static asset read at build. The `.tsx` is a specialised Route Handler: it participates in caching exactly like a page, accepts route segment config, receives `params` as a promise, and is statically optimised *by default* only until it touches a request-time API or uncached data. The practical consequence is that a mistake in the image handler is now a caching mistake — an uncached `fetch` for a product title turns a build-time asset into a per-scrape function invocation, and nothing about the filename tells you that happened.

**★ How does Next.js emit `og:image:width` before the image has been generated?**
From the `size` module export, which is read without executing the default export. That separation is the whole reason `alt`, `size` and `contentType` are exports rather than options passed to `ImageResponse`: the tags must be resolvable while rendering the page's head, and the image itself may not be produced until something requests it. The corollary is that the two can disagree — the export decides the tag, the `ImageResponse` options decide the pixels — which is why the documented pattern spreads one into the other.

**★ You need three icon sizes from one file. What does the API look like, and what is the shape trap?**
Export `generateImageMetadata` returning an array in which every item has a required `id`, plus optional `alt`, `size` and `contentType`; the default export then receives `{ id }`. The trap is that `id` arrives as a **promise** even though you wrote a plain string, so it must be awaited — and, in the same file, `generateImageMetadata`'s own `params` argument is documented as a plain object while the image function's `params` is a promise. Two functions, two conventions, no symmetry to fall back on.

**★ A route's OG image renders the word `undefined`. Walk through the diagnosis.**
Almost always `params`. It became a promise in 16.0, so code migrated from 15 that destructures `{ slug }` directly gets `undefined` and happily renders it — there is no runtime error because `undefined` is a legal React child once interpolated into a string. The second candidate is the opposite mistake: awaiting `params` in a segment that has no dynamic parameters, where it is `undefined` rather than a promise and the `await` throws instead. Both are visible in one line of the file; neither is visible in the built HTML, because the tag only says the image exists.

---

← [JSON-LD and structured data](02c-json-ld-and-structured-data.md) · [Chapter 12 overview](01-explanation.md) · Next → [`ImageResponse` and its hard limits](02e-imageresponse-and-its-hard-limits.md)
