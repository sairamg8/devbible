---
title: "`ImageResponse` renders JSX with an engine that is not a browser — flexbox only, no grid, a 500 KB bundle ceiling and three font formats — so every layout instinct you have from CSS is a hypothesis you cannot test in a browser"
sidebar_label: "02e · ImageResponse and its limits"
sidebar_position: 109
description: "What next/og actually is (Satori plus Resvg), the CSS subset it supports, the 500KB bundle ceiling that counts fonts and images, the three legal font formats, loading local assets at module scope, and the options nobody reads — debug, emoji, status and headers."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js
> [`ImageResponse` reference](https://nextjs.org/docs/app/api-reference/functions/image-response)
> (page `lastUpdated: 2026-08-25`) and the
> [`opengraph-image` reference](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
> (`2026-07-09`), *Using Node.js runtime with local assets*.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, no rendered output, no byte counts of my own.

**`ImageResponse` looks like React and is not React rendering to a browser. It is a JSX-shaped description handed to Satori, which lays it out and produces SVG, which Resvg rasterises to PNG. Nothing in that pipeline is a browser, so the honest way to hold this API in your head is: **you are writing a layout for a renderer that implements a documented subset of CSS and silently ignores the rest**. Grid does not work. `position: fixed` is not a browser's `position: fixed`. Your font is 200 KB of a 500 KB budget. This page is that subset, that budget, and the failure modes each one produces.**

## What it actually is

> *"`ImageResponse` uses @vercel/og, Satori, and Resvg to convert HTML and CSS into PNG."*

Three pieces, and knowing which one is failing is most of the debugging:

| Layer | Job | What it means for you |
|---|---|---|
| `@vercel/og` | the wrapper — takes JSX and options, returns a `Response` | the part that is Next.js's API surface |
| **Satori** | HTML + CSS → SVG | the layout engine, and the source of every "why is this not centred" |
| **Resvg** | SVG → PNG | rasterisation; where fonts must already be embedded |

The signature, from the reference:

```jsx
import { ImageResponse } from 'next/og'

new ImageResponse(
  element: ReactElement,
  options: {
    width?: number = 1200
    height?: number = 630
    emoji?: 'twemoji' | 'blobmoji' | 'noto' | 'openmoji' = 'twemoji',
    fonts?: {
      name: string,
      data: ArrayBuffer,
      weight: number,
      style: 'normal' | 'italic'
    }[]
    debug?: boolean = false
    status?: number = 200
    statusText?: string
    headers?: Record<string, string>
  },
)
```

Two defaults there are quietly doing a lot of work. **`width: 1200, height: 630`** is the Open Graph convention, so an image with no options is already the right shape. And **`emoji: 'twemoji'`** means emoji in your text are replaced with fetched Twemoji assets rather than rendered from a system font — which is the only reason emoji work at all in an environment with no system fonts.

## The four hard limits

Each of these is a verbatim rule, and each produces a different symptom.

> *"Only flexbox and a subset of CSS properties are supported. Advanced layouts (e.g. `display: grid`) will not work."*

🔴 **This is the one that wastes the most time**, because `display: grid` does not error — the elements simply stack as though the property were absent. Every container in an `ImageResponse` needs an explicit `display: 'flex'`; Satori does not assume a default display the way a browser does. A `<div>` with two children and no `display` is a common cause of "only the first child appears".

> *"Maximum bundle size of `500KB`. The bundle size includes your JSX, CSS, fonts, images, and any other assets. If you exceed the limit, consider reducing the size of any assets or fetching at runtime."*

The word doing the work is **"any other assets"**. A base64-inlined logo counts. A font file counts, and a full-weight variable font will eat most of the budget on its own — which is why the documentation's examples all load a *single* static weight (`Inter-SemiBold.ttf`) rather than a family.

> *"Only `ttf`, `otf`, and `woff` font formats are supported. To maximize the font parsing speed, `ttf` or `otf` are preferred over `woff`."*

No `woff2`. This catches everyone, because `woff2` is what a font vendor gives you by default and what `next/font` uses on the web. The OG image needs its own copy in one of the three legal formats, which means your design system's font and your OG image's font are two separate files that you must keep at the same version.

And the fourth, which is not stated as a limit but behaves like one: **there are no system fonts.** If you supply no `fonts` array, you get whatever the runtime provides, and you should not build a design on that assumption. Supply the font.

## Loading local assets

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

const logoData = await readFile(join(process.cwd(), 'logo.png'), 'base64')
const logoSrc = `data:image/png;base64,${logoData}`

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={logoSrc} height="100" />
      </div>
    )
  )
}
```

Two rules in that snippet, both stated by the docs and both easy to get wrong:

> *"Place the local asset relative to the project root, not the example source file."*

`process.cwd()` is the project root, **not** the directory the file lives in. A path written as though it were relative to `app/blog/[slug]/` will resolve against the root and fail — at build, with an `ENOENT` naming a path that looks almost right.

> *"The asset doesn't depend on request data, so read it once at module scope."*

Reading inside the handler re-reads the file on every invocation and, more importantly, moves the read into the render path. At module scope it happens once per module instantiation. This is the same "predictable values" discipline the caching documentation applies everywhere else.

The `ArrayBuffer` variant needs an escape hatch:

> *"Passing an `ArrayBuffer` to the `src` attribute of an `<img>` element is not part of the HTML spec. The rendering engine used by `next/og` supports it, but because TypeScript definitions follow the spec, you need a `@ts-expect-error` directive or similar."*

```tsx
const logoData = await readFile(join(process.cwd(), 'logo.png'))
const logoSrc = Uint8Array.from(logoData).buffer

// inside the JSX:
// {/* @ts-expect-error Satori accepts ArrayBuffer/typed arrays for <img src> at runtime */}
// <img src={logoSrc} height="100" />
```

Base64 is simpler and costs ~33% size against a 500 KB budget; the `ArrayBuffer` form avoids that inflation. Pick by how close to the ceiling you are.

## The options nobody reads

**`debug: true`** draws layout boundaries into the produced image. It is the closest thing to devtools this pipeline has, and since you cannot inspect a PNG, it is the first thing to reach for when a layout is wrong rather than the last.

**`status`, `statusText` and `headers`** exist because the return value is a real `Response`. That makes it possible to set your own `Cache-Control` on a generated image — which matters, because a dynamic OG image with default caching is re-rendered per request, and an unfurler that re-fetches gets a fresh render every time.

**`emoji`** picks the emoji asset set. If your brand mark is an emoji (it should not be), this is why it looks different from the design.

## Using it outside the file conventions

`ImageResponse` is not tied to `opengraph-image.tsx`. It is a `Response`, so a Route Handler can return one:

```ts
// app/api/og/route.tsx
import { ImageResponse } from 'next/og'

export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get('title') ?? 'SprintDesk'

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0d12',
          color: '#f5f7fa',
          fontSize: 64,
          padding: 64,
        }}
      >
        {title}
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
```

⚠️ **That route takes user input and renders it into an image, which makes it an unauthenticated render endpoint on your origin.** Anyone can request arbitrary text. Bound the input length, and consider signing the parameters, before this ships anywhere with a compute bill. The file convention does not have this problem because its inputs are your own route params.

## Gotchas

**★ `display: grid` produces a stacked, unstyled-looking image with no error.** Satori supports flexbox and a subset of CSS; grid is explicitly named as unsupported. Fix: rewrite the layout in flexbox — `flexDirection`, `gap`, `alignItems`, `justifyContent` cover essentially everything an OG image needs.

**★ A `div` with two children renders only the first.** Satori does not infer a display value the way a browser does. Fix: put `display: 'flex'` on every container, including ones you would never bother with in CSS.

**★ The build fails on a font you use everywhere else.** `woff2` is not one of the three supported formats. Fix: ship a `.ttf` or `.otf` copy of the same face specifically for OG images, and pin both to the same version so the brand does not drift.

**★ The image renders in a default serif face.** No `fonts` array was supplied and there are no system fonts to fall back to in a meaningful sense. Fix: always pass `fonts`, even for a single weight.

**★ Build fails with a bundle-size error after adding a background photo.** The 500 KB ceiling counts JSX, CSS, fonts, images and every other asset together, and base64 inflates a binary by roughly a third. Fix: shrink the asset, use the `ArrayBuffer` form instead of base64, or fetch the image at runtime — which the docs offer as the sanctioned escape.

**★ `readFile('./logo.png')` throws `ENOENT` with a path that looks correct.** Asset paths resolve from `process.cwd()`, the project root, not from the source file. Fix: `join(process.cwd(), 'assets/logo.png')`, and keep OG assets in one root-level directory so nobody has to think about it again.

**★ TypeScript rejects `<img src={arrayBuffer}>`.** The DOM types follow the HTML spec, which has no such thing; Satori supports it anyway. Fix: the `@ts-expect-error` the documentation itself prescribes — and keep the comment explaining why, because a bare suppression will be deleted by the next reader.

**★ The asset read happens on every request.** `readFile` was called inside the default export instead of at module scope. Fix: hoist it. Top-level `await` is legal in these modules and the docs' own examples use it.

**★ A generated image looks right locally and wrong in production.** The most common cause is a font that resolved from your development machine and does not exist on the server. Fix: this is the same "always pass `fonts`" rule; if the image ever looked right without an explicit font, that was luck.

**★ Your `/api/og` endpoint is being hammered.** It renders arbitrary text from a query string for anyone who asks. Fix: cap the input length, reject unknown parameters, set a long `Cache-Control` via the `headers` option, and prefer the file convention wherever the input is a route param you control.

**★ You cannot work out why a layout is wrong and there is nothing to inspect.** A PNG has no DOM. Fix: `debug: true` in the options, which draws the layout boxes into the image itself.

## Interview questions

**★ Why does `display: grid` not work in an `ImageResponse`, and what is the general rule it illustrates?**
Because the renderer is Satori, not a browser. Satori implements flexbox and a documented subset of CSS properties, and the reference names grid explicitly as not working. The general rule is that anything you know about CSS is a *hypothesis* in this environment — unsupported properties are ignored rather than erroring, so the failure mode is always "the image looks wrong", never "the build told me". That is also why `debug: true` exists and why the whole layout should be flexbox even where flexbox is not the natural choice.

**★ What counts toward the 500 KB limit, and what is the standard way over it?**
JSX, CSS, fonts, images and any other asset — the reference lists all of them together, so it is not a code-size budget, it is an everything budget. A single font weight and one inlined logo can approach it. The two sanctioned ways over it are to shrink assets (a subset font, a smaller image, `ArrayBuffer` instead of base64 to avoid the ~33% inflation) or to fetch the heavy asset at runtime, which trades the bundle for a network call in the render path. The third option, and often the right one, is to stop generating that image and ship a static file.

**★ Why must local assets be read at module scope, and what breaks if they are not?**
Two reasons. Mechanically, the read then happens once per module instantiation rather than once per invocation, keeping I/O out of the render path. More importantly, an asset read inside the handler is indistinguishable to the framework from work that could depend on the request, and the whole caching story for these handlers rests on being able to treat them as static by default. The docs frame it as "the asset doesn't depend on request data, so read it once at module scope" — it is the same predictable-values discipline that governs cached functions elsewhere.

**★ You need per-product OG images for 40,000 products. What do you actually do?**
Not generate 40,000 images at build. Either pair `opengraph-image.tsx` with `generateStaticParams` for the subset that matters — the products with traffic — and let the rest fall back to a static segment-level image, or accept a dynamic handler with a long `Cache-Control` set through the `headers` option so the CDN absorbs repeat scrapes. The thing to avoid is the default middle case: a dynamic image with no cache headers, re-rendered on every scrape of every product for the life of the site.

**★ What is the risk in exposing an `/api/og?title=` route?**
It is an unauthenticated compute endpoint that renders attacker-supplied text into an image on your origin. The obvious cost is the bill; the less obvious one is that the rendered text appears on a URL under your domain, which makes it a small content-injection surface for anyone who can get someone to click a link. The mitigations are bounding the input, signing the parameters so only URLs your application generated are honoured, and caching hard. Where the input is a route parameter you already control, the file convention avoids the question entirely.

{/* FOOTER */}
