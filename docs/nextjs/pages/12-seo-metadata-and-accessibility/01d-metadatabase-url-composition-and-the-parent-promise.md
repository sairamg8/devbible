---
title: "Every URL in metadata must be absolute by the time it reaches the head, and `metadataBase` is the one setting whose absence is a build error rather than a bad preview"
sidebar_label: "01d · metadataBase and the parent promise"
sidebar_position: 102
description: "Why og:image must be absolute, what metadataBase composes and what it ignores, the URL-composition table where ../ does not traverse, the environment problem of picking a base URL per deployment, and the ResolvingMetadata parent promise."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
> sections *`metadataBase`*, *URL Composition* and *Parameters* (page
> `lastUpdated: 2026-08-25`), and the
> [`use cache` directive reference](https://nextjs.org/docs/app/api-reference/directives/use-cache).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified — **no sandbox run**.

**A social crawler does not have your page's URL as a base to resolve against — it reads
`og:image` out of the HTML and fetches it directly, so a relative value is simply broken. Next
solves this with `metadataBase`, a per-subtree origin that relative metadata URLs compose
against, and it is strict about it: a relative URL in a URL-valued field with no `metadataBase`
configured is a **build error**, not a warning. The interesting parts are what composition
actually does — it is deliberately not URL resolution — and the fact that the value has to be
correct per deployment environment, which is where preview builds go wrong.**

## Which fields are URL fields

`openGraph.images`, `openGraph.url`, `openGraph.videos`, `openGraph.audio`, `twitter.images`,
`alternates.canonical`, `alternates.languages`, `alternates.media`, `alternates.types`,
`icons`, `manifest`, `archives`, `assets`, `bookmarks`, `pagination.previous` and
`pagination.next`. All of them accept a relative path **only** if a `metadataBase` is in scope.

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://sprintdesk.app'),
  alternates: {
    canonical: '/',
    languages: { 'en-US': '/en-US', 'de-DE': '/de-DE' },
  },
  openGraph: { images: '/og-default.png' },
}
```

That resolves to `https://sprintdesk.app` for the canonical, `https://sprintdesk.app/en-US` and
`/de-DE` for the alternates, and `https://sprintdesk.app/og-default.png` for the image.

Scope is **the segment it is declared in and everything below it**, which is why it belongs in
the root layout in almost every application. An absolute URL in a field always wins and
`metadataBase` is ignored for that field.

## Composition is not URL resolution

This is the part that surprises people who reason from `new URL(path, base)`. The reference is
explicit that composition *favours developer intent over default directory-traversal
semantics*. Given `metadataBase: new URL('https://acme.com')`:

| Field value | Resolves to |
|---|---|
| `/` | `https://acme.com` |
| `./` | `https://acme.com` |
| `payments` | `https://acme.com/payments` |
| `/payments` | `https://acme.com/payments` |
| `./payments` | `https://acme.com/payments` |
| **`../payments`** | **`https://acme.com/payments`** |
| `https://beta.acme.com/payments` | `https://beta.acme.com/payments` |

`../payments` does **not** traverse above the base. Every relative form lands in the same place.
Duplicate slashes between a base ending in `/` and a field starting with `/` are normalised to
one. In practice this means you cannot express "one level up from the base path" at all — and
if your `metadataBase` includes a base path (`https://acme.com/start/from/here`, which the docs
say is permitted), a leading `/` in the field is treated as relative to that base path, not to
the origin. That is the single most surprising line in the table.

## Getting the value right per environment

Hard-coding the production origin means every preview deployment advertises production images
and a production canonical — which, if the preview is ever indexed, is a duplicate-content
problem pointing at the wrong host. Derive it once:

```ts
// app/lib/site.ts
function baseUrl(): string {
  // An explicit value always wins — set it in production and in CI.
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  // Vercel exposes the deployment host, without a scheme.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export const SITE_URL = baseUrl()
```

```tsx
// app/layout.tsx
import { SITE_URL } from '@/app/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
}
```

Two failure modes this avoids and one it does not:

- **Avoided:** absolute-URL fields on a preview build pointing at production assets that do not
  yet exist for that branch.
- **Avoided:** the build error on a machine where nobody set the env var, because the localhost
  fallback is still a valid absolute URL.
- 🔴 **Not avoided:** a preview deployment being crawled at all. `metadataBase` fixes the URLs;
  keeping the preview out of the index is `robots.ts` reading the environment, which is
  **03b · `robots.ts` and the crawl directives** *(not written yet)*.

### `metadataBase` and `use cache` do not mix directly

If `generateMetadata` carries `'use cache'`, its return value must be serializable — and the
docs state plainly that `URL` instances are not supported by Cache Functions. A `metadataBase`
returned from a cached metadata function has to be a string:

```tsx
export async function generateMetadata(): Promise<Metadata> {
  'use cache'
  const site = await cms.getSiteSettings()
  return {
    metadataBase: new URL(site.origin).toString() as unknown as Metadata['metadataBase'],
    title: site.title,
  }
}
```

The cast is ugly, and it is a signal: `metadataBase` almost never belongs in a cached dynamic
function. Put it in the static `metadata` object of the root layout, where it is evaluated once
and never serialized through a cache boundary.

## The `parent` promise

`generateMetadata` takes a second argument — a `ResolvingMetadata`, which is a promise of the
metadata already resolved by every ancestor segment. Awaiting it is how you **extend** rather
than replace an inherited value, which matters precisely because
[the merge is shallow](01-static-and-dynamic-metadata-metadata-objects-generatemetadat.md).

```tsx
// app/products/[id]/page.tsx
import type { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params
  const product = await getProduct(id)

  const previousImages = (await parent).openGraph?.images || []

  return {
    title: product.name,
    openGraph: {
      images: [`/products/${id}/opengraph-image`, ...previousImages],
    },
  }
}
```

Three things to know about it:

- **Awaiting `parent` orders your function after every ancestor's metadata resolution.** If a
  parent layout's `generateMetadata` is slow, awaiting `parent` in a leaf inherits that latency
  — the leaf can no longer resolve in parallel with it. Only await it when you need the value.
- **You are reading the *resolved* parent, not the parent's source object.** Templates have
  been applied and merges have happened. `(await parent).title` gives you a resolved title
  object, not the raw string a layout wrote.
- **The array-spread pattern is the documented idiom** and the reason is worth stating: the
  first entry in `openGraph.images` is the one most consumers preview, so putting the specific
  image first and the inherited defaults after gives you a per-page preview with a site-wide
  fallback in the same tag.

For anything other than images, the spread-a-shared-module approach from
[01](01-static-and-dynamic-metadata-metadata-objects-generatemetadat.md) is simpler and does not
serialize your metadata resolution.

## Gotchas

**★ A relative `og:image` with no `metadataBase` fails the build.** This is documented and
deliberate — it is the one metadata mistake Next refuses to ship. The error appears at build
time, so a `metadataBase` in a layout that is not an ancestor of the failing route will not
help; check the scope, not just the presence.

**★ `../` in a metadata URL does not go up a level.** Composition is intentionally not
directory traversal — `../payments`, `./payments`, `payments` and `/payments` all resolve to
the same place. If you assumed traversal semantics you get a URL one level lower than intended,
silently, and only a crawler notices.

**★ A `metadataBase` with a base path makes a leading `/` relative to the path, not the
origin.** `new URL('https://acme.com/docs')` plus `canonical: '/pricing'` does not give you
`https://acme.com/pricing`. If you need origin-relative URLs, keep the base at the origin.

**★ Hard-coding the production origin makes every preview advertise production.** Canonicals,
OG images and `hreflang` alternates on the preview all point at prod. Derive the base from the
environment, and separately keep previews out of the index with `robots.ts`.

**★ `metadataBase` returned from a `'use cache'` function breaks serialization.** `URL`
instances are not supported by Cache Functions. Return a string, or better, move
`metadataBase` into the root layout's static object where it never crosses a cache boundary.

**★ Awaiting `parent` when you do not need it serializes metadata resolution.** The leaf now
waits for every ancestor's `generateMetadata` before it can return. Only take the second
argument when you are actually extending an inherited value.

**★ `metadataBase` does not apply to URLs inside JSON-LD.** Structured data is a `<script>`
block you build yourself; nothing composes its URLs. Every `@id`, `url` and `image` in a
JSON-LD payload must be written absolute — see
**02c · JSON-LD and structured data** *(not written yet)*.

**★ `metadataBase` does not apply to `sitemap.ts` or `robots.ts` either.** Those are Route
Handlers returning their own data structures, not metadata fields. Their URLs must be absolute
and you must build them yourself — [03](03-sitemapts-and-robotsts-automation-localized-metadata-for-i18.md).

## Interview questions

**★ Why must `og:image` be an absolute URL when `src` on an `<img>` can be relative?**
Because the consumer is different. A browser resolves `src` against the document URL it already
has. A social crawler, a link unfurler or a preview bot reads the meta tag out of the HTML and
issues a fresh request for that value, often from a different service with no notion of your
page's URL. `metadataBase` exists to let you *write* relative paths while still *emitting*
absolute ones.

**★ What is the difference between what `metadataBase` does and what `new URL(path, base)`
does?**
`new URL` implements the URL standard's resolution rules, including `..` traversal and treating
a leading `/` as origin-relative. Metadata composition deliberately does neither: `../payments`
resolves the same as `payments`, and a leading `/` is relative to the whole base including any
base path. The documented reasoning is that it favours developer intent over traversal
semantics — you almost never mean "go up from my own site's base".

**★ A relative `openGraph.images` value fails the build. Is that a bug?**
No, it is the documented behaviour and it is the right call. The alternative — emitting a
relative `og:image` — produces a tag that is syntactically fine, passes every HTML check, and
is broken for exactly the consumers the tag exists for. Failing at build time is the only point
where a human is looking.

**★ How should `metadataBase` differ between production, preview and local development?**
It should be the origin the deployment is actually served from in each. Derive it: an explicit
env var first, the platform's deployment host second, `http://localhost:3000` last. Hard-coding
production means preview builds emit production canonicals and production OG images, which is
both wrong for the preview and a duplicate-content risk if the preview is ever crawled.

**★ When is the `parent` argument to `generateMetadata` worth taking?**
When you are extending an inherited value rather than replacing it — overwhelmingly, appending
a page-specific OG image ahead of inherited ones. It has a real cost: awaiting it orders your
function after every ancestor's metadata resolution, so a slow parent layout becomes a slow
leaf. For sharing plain constants, a module you spread into both objects is cheaper and
clearer.

**★ Does `metadataBase` affect the URLs in your sitemap?**
No. `sitemap.ts` and `robots.ts` are Route Handlers that return their own data structures, not
metadata fields, so nothing composes their URLs — they must be absolute and you construct them.
The same is true of JSON-LD, which is a script block you render yourself. `metadataBase` is
scoped strictly to the URL-valued fields of the metadata object.

{/* FOOTER */}
