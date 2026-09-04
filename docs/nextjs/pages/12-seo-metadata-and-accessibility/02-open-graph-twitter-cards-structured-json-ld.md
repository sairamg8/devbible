---
title: "Open Graph is a flat vocabulary of namespaced meta tags and the Metadata API models it as a nested object — every rule for flattening that object back out is a place a social preview silently loses a field"
sidebar_label: "02 · The Open Graph block"
sidebar_position: 8
description: "The openGraph block as the Metadata API actually models it: which keys emit which tags, which keys emit several, how type changes the legal field set, the shallow-merge trap that costs a leaf page its site name, and the four properties the protocol requires that Next.js will never make you supply."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
> sections *`openGraph`* and *Merging*
> (page `lastUpdated: 2026-08-25`), and the
> [Open Graph protocol](https://ogp.me/) specification.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, no output blocks.

**A social preview is not a feature of your application; it is a contract with a scraper that fetched your HTML once, kept what it found, and will not come back. The Open Graph protocol is a flat list of `<meta property="og:*">` tags. The Metadata API models that flat list as a nested JavaScript object, and the whole of this page is the translation layer between the two: which key produces which tag, which keys produce *several* tags, which keys are only legal once you have set `type`, The protocol declares four properties required. Next.js enforces none of them, and neither does your build.**

## What the protocol requires, and what the framework checks

The Open Graph protocol is explicit about its floor:

> *"The four required properties for every page are:"* `og:title`, `og:type`, `og:image`, `og:url`

Nothing in Next.js checks for those four. A page can export `metadata` with a `description` and nothing else, build clean, deploy, and unfurl as a bare link with a hostname. There is exactly one build-time check in this whole area and it is about URLs, not completeness — a relative image URL with no `metadataBase` fails the build
([01d](01d-metadatabase-url-composition-and-the-parent-promise.md)). Completeness is your problem.

That asymmetry is worth internalising, because it decides where your safety net goes. The framework will catch *"this URL cannot be made absolute"*. It will never catch *"this page has no `og:image`"*. If that matters — and on a marketing page it is the whole point — the check belongs in a test that reads the rendered `<head>`, which is [05c](05c-auditing-seo-in-ci.md).

## The `openGraph` block, key by key

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  openGraph: {
    title: 'Next.js',
    description: 'The React Framework for the Web',
    url: 'https://nextjs.org',
    siteName: 'Next.js',
    images: [
      {
        url: 'https://nextjs.org/og.png',
        width: 800,
        height: 600,
      },
      {
        url: 'https://nextjs.org/og-alt.png',
        width: 1800,
        height: 1600,
        alt: 'My custom alt',
      },
    ],
    videos: [{ url: 'https://nextjs.org/video.mp4', width: 800, height: 600 }],
    audio: [{ url: 'https://nextjs.org/audio.mp3' }],
    locale: 'en_US',
    type: 'website',
  },
}
```

The reference's own `<head>` output for that object, which is the mapping you should memorise:

```html
<meta property="og:title" content="Next.js" />
<meta property="og:description" content="The React Framework for the Web" />
<meta property="og:url" content="https://nextjs.org/" />
<meta property="og:site_name" content="Next.js" />
<meta property="og:locale" content="en_US" />
<meta property="og:image" content="https://nextjs.org/og.png" />
<meta property="og:image:width" content="800" />
<meta property="og:image:height" content="600" />
<meta property="og:image" content="https://nextjs.org/og-alt.png" />
<meta property="og:image:width" content="1800" />
<meta property="og:image:height" content="1600" />
<meta property="og:image:alt" content="My custom alt" />
<meta property="og:video" content="https://nextjs.org/video.mp4" />
<meta property="og:video:width" content="800" />
<meta property="og:video:height" content="600" />
<meta property="og:audio" content="https://nextjs.org/audio.mp3" />
<meta property="og:type" content="website" />
```

Five things in that output are not obvious from the input:

| Observation | Why it matters |
|---|---|
| `siteName` → `og:site_name` | The only key in the block whose tag name is not a lowercase copy of the key. |
| One `images` entry → up to **four** tags | `og:image`, `:width`, `:height`, `:alt` in the reference's own output. An array member is a *group*, and groups are positional — a scraper attaches `og:image:width` to the most recent `og:image`. (`og:image:type` is emitted by the **file** convention, from the file itself.) |
| `url: 'https://nextjs.org'` → `content="https://nextjs.org/"` | The value went through URL normalisation and gained a trailing slash. Your `og:url` and your `canonical` must agree, so pick one form and use it in both. |
| `alt` on the second image only | Alt is per-image, not per-block. The first image ships with no `og:image:alt` and nothing warns you. |
| `og:type` emitted last | The emission order does not follow the object's key order. If you are asserting on tags, assert by name — never by position. |

The protocol has an opinion about that fourth row that the Next.js docs do not repeat:

> *"og:image:alt - A description of what is in the image (not a caption). If the page specifies an og:image it should specify og:image:alt."*

An `og:image` with no `og:image:alt` is the single most common accessibility hole in an otherwise-audited site, because the image is not in your DOM and no automated a11y tool will look at it — see [04g](04g-auditing-accessibility-and-what-no-tool-can-reach.md) for what tooling does and does not reach.

## `type` decides which other keys are legal

`openGraph.type` is a discriminant, not a label. Setting it to `'article'` unlocks a set of article fields, and those fields flatten into the `article:` namespace rather than `og:`:

```tsx
export const metadata: Metadata = {
  openGraph: {
    title: 'Next.js',
    description: 'The React Framework for the Web',
    type: 'article',
    publishedTime: '2023-01-01T00:00:00.000Z',
    authors: ['Seb', 'Josh'],
  },
}
```

```html
<meta property="og:title" content="Next.js" />
<meta property="og:description" content="The React Framework for the Web" />
<meta property="og:type" content="article" />
<meta property="article:published_time" content="2023-01-01T00:00:00.000Z" />
<meta property="article:author" content="Seb" />
<meta property="article:author" content="Josh" />
```

Two mechanics here generalise to the whole API. **An array field emits one repeated tag per element** — `authors: ['Seb', 'Josh']` becomes two `article:author` tags, not a comma-joined one. And **the key is camelCase in TypeScript and snake_case in the output** — `publishedTime` becomes `article:published_time`. If you are grepping your own built HTML for a tag you believe you set, grep for the snake_case form.

The type union is enforced by the `Metadata` type, which is the actual reason to write `import type { Metadata } from 'next'` even when the TypeScript plugin would infer it. Set `publishedTime` without `type: 'article'` and the type error is what tells you; there is no runtime warning.

## The Twitter namespace and the companion blocks

`twitter`, `alternates`, `facebook`, `pinterest` and `robots` are separate vocabularies that
the same object carries, and the `twitter` one is where the `property=` versus `name=` split
lives. They are [02b](02b-twitter-cards-and-the-companion-blocks.md).

## The merge trap, applied to `openGraph` specifically

This is the same shallow-merge rule as [01](01-static-and-dynamic-metadata-metadata-objects-generatemetadat.md), but Open Graph is where it bites hardest, because `openGraph` is the object people most often set partially in a leaf.

```tsx
// app/layout.tsx — the site defaults
export const metadata: Metadata = {
  openGraph: {
    siteName: 'SprintDesk',
    locale: 'en_US',
    type: 'website',
    images: ['/og-default.png'],
  },
}

// app/blog/[slug]/page.tsx — 🔴 WRONG: this drops siteName, locale, type AND images
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost((await params).slug)
  return { openGraph: { title: post.title } }
}
```

The leaf's `openGraph` **replaces** the layout's `openGraph` object entirely. The page now emits one `og:title` and nothing else. The fix is to restate every field the page still wants, or to build the object from a shared helper:

```tsx
// lib/og.ts
import type { Metadata } from 'next'

const base = {
  siteName: 'SprintDesk',
  locale: 'en_US',
  images: ['/og-default.png'],
} satisfies Metadata['openGraph']

export function openGraph(
  overrides: NonNullable<Metadata['openGraph']>
): Metadata['openGraph'] {
  return { ...base, ...overrides }
}

// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost((await params).slug)
  return {
    openGraph: openGraph({
      title: post.title,
      type: 'article',
      publishedTime: post.publishedAt.toISOString(),
      authors: post.authors.map((a) => a.name),
    }),
  }
}
```

A helper is better than `await parent` here for the reason [01d](01d-metadatabase-url-composition-and-the-parent-promise.md) gives: taking the `parent` promise serialises the leaf behind every ancestor's metadata resolution, and you are only trying to avoid retyping four literals.

## Gotchas

**★ A page sets `openGraph.title` and loses its image, site name and locale.** The merge is one level deep and `openGraph` is one key. Setting it replaces the parent's whole object. Fix: spread a shared base object as above, or set only leaf-specific keys through a helper that owns the defaults.

**★ `authors: 'Seb, Josh'` produces one author, not two.** Array fields emit one repeated tag per element; a comma string is a single value that happens to contain a comma. Fix: pass a real array — `authors: post.authors.map((a) => a.name)`.

**★ `publishedTime` set without `type: 'article'` silently emits nothing.** The article fields only exist on the article variant of the union. There is no runtime warning. Fix: annotate the export as `Metadata` so the type error appears at build time, and set `type: 'article'` in the same object.

**★ Your `og:url` and your `alternates.canonical` disagree by a trailing slash.** The reference's own output shows `'https://nextjs.org'` emitted as `https://nextjs.org/`. If you write the canonical by hand and the `og:url` through the same string, one of them normalises and the other does not. Fix: derive both from one `URL` instance, or set only `alternates.canonical` and let `og:url` follow the same source.

**★ The first entry in `images` has no alt text and no tool tells you.** Alt is a per-entry property. An OG image is not in the DOM, so axe, Lighthouse and jsx-a11y all ignore it. Fix: make `alt` non-optional in your own helper's type, so omitting it is a TypeScript error rather than a silent gap.

**★ `og:image` and the file convention are both present, and the file wins.** File-based metadata has higher priority than the config object. An `opengraph-image.png` you forgot about overrides your carefully-computed `openGraph.images` with no warning. Fix: pick one mechanism per segment; the file convention is the one the docs recommend, and it is [02d](02d-the-opengraph-image-and-twitter-image-file-conventions.md).

**★ You set every tag correctly and the preview is still the old one.** Nothing in your application is wrong. The scraper cached the previous fetch, and Meta's documentation is explicit that images are cached by URL. That failure has its own page: [02f](02f-what-the-unfurlers-actually-fetch.md).

## Interview questions

**★ Open Graph declares four required properties. What happens in a Next.js build if you supply none of them?**
Nothing. The build succeeds and the page ships. Next.js has exactly one build-time check in this area — a relative URL in a URL-valued metadata field with no `metadataBase` set — and it is about resolvability, not completeness. Everything else is a silent hole: no `og:image` means the unfurler falls back to its own heuristics, which for most scrapers means the first large image on the page or nothing at all. If completeness matters, it has to be asserted in a test against the rendered head, because no part of the framework will do it for you.

**★ A colleague adds `openGraph: { title: post.title }` to a blog post page and the site name vanishes from every post preview. Explain the mechanism, then the fix.**
Metadata is evaluated root to leaf and merged **one level deep**: duplicate keys are replaced, not merged recursively. `openGraph` is a single key. The leaf setting it replaces the root layout's entire `openGraph` object, taking `siteName`, `locale`, `type` and `images` with it. The fix is to spread a shared base — a `lib/og.ts` helper that owns the defaults and takes overrides — rather than to `await parent`, because taking the parent promise makes the leaf's metadata wait for every ancestor's `generateMetadata` to resolve, which is a real serialisation cost for a problem that is really about not retyping four literals.

**★ What does `authors: ['Seb', 'Josh']` emit, and what would `authors: 'Seb, Josh'` emit?**
The array emits two separate `<meta property="article:author">` tags, one per element — that is the documented behaviour and it is how the Open Graph protocol expresses multi-valued properties. The string emits one tag whose content is the literal `Seb, Josh`, which a consumer will read as a single author with a comma in their name. The same rule governs `facebook.admins` and `other`: an array is a repeated tag, a string is one tag.

**★ Which is authoritative when a segment has both `opengraph-image.png` and `metadata.openGraph.images`?**
The file. File-based metadata has higher priority than both the `metadata` object and `generateMetadata`. This is the intended design — the docs recommend the file convention precisely so you do not have to keep a config export in sync with files on disk — but it produces a genuinely confusing debugging session when someone dropped an `opengraph-image.png` into a segment months ago and your computed images are being discarded. The check is a file listing of the segment and its ancestors, not a read of the metadata code.

---

← [File metadata, the 404 route and the insight](01g-file-metadata-the-404-route-and-debugging-the-insight.md) · [Chapter 12 overview](01-explanation.md) · Next → [Twitter cards and the companion blocks](02b-twitter-cards-and-the-companion-blocks.md)
