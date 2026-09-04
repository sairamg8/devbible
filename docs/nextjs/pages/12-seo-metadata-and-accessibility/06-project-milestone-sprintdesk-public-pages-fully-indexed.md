---
title: "Make SprintDesk's public pages indexable on purpose rather than by accident — one metadata module, one origin constant, generated OG images where they earn their cost, and an authenticated area that is `noindex` by inheritance"
sidebar_label: "06 · Milestone: public pages indexed"
sidebar_position: 28
description: "The chapter 12 milestone, part one — scope and file shape, the single origin constant five different consumers need, why the root layout's metadata must be static, and the metadata module every leaf composes through."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) (`lastUpdated: 2026-08-25`),
> [`sitemap.xml`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) (`2026-08-25`),
> [`robots.txt`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots) (`2026-05-01`),
> [`opengraph-image`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) (`2026-07-09`)
> and [JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld) (`2026-03-02`) references, all of
> which are quoted in the chunks this milestone assembles.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, no build output, no scores.

**Everything in this chapter so far has been a mechanism in isolation: how the merge works, what a scraper caches, which switch deindexes and which one only stops a crawl. This milestone is where they stop being separate, and the interesting part is not any one of them — it is that four of them share a single constant. The origin feeds `metadataBase`, the canonical, the sitemap's URLs, `robots.ts`'s `sitemap` field and every absolute URL in a JSON-LD payload. Get that one value wrong per environment and a preview deployment advertises production, caches a wrong image against a URL a scraper will remember, and puts itself in the index. This page is the scope and the shared foundation — the origin constant, the root layout and the metadata module; [06b](06b-the-per-route-work.md) is the per-route work and [06c](06c-the-a11y-pass-and-the-acceptance-criteria.md) is the accessibility pass and the acceptance criteria.**

## What this milestone adds, and what it does not

SprintDesk after [chapter 6](../06-ssg-isr-and-ssr-strategy/06-project-milestone-static-marketing-pages-isrd-public-team-pa.md) has static marketing pages and ISR'd public team pages that render correctly and are invisible to every consumer that is not a browser.

| In scope | Out of scope, and where it lands |
|---|---|
| One metadata module every route composes from | — |
| Per-post and per-team OG images | — |
| JSON-LD on the pages that can earn a rich result | — |
| `sitemap.ts` driven by the same query the pages use | — |
| `robots.ts` that behaves differently per environment | — |
| An accessibility pass over the board | [06c](06c-the-a11y-pass-and-the-acceptance-criteria.md) |
| The CI assertions that keep all of it true | [05c](05c-auditing-seo-in-ci.md) |
| Making the authenticated dashboard fast | [chapter 11 · performance audit](../11-performance-optimization-turbopack/07-project-milestone-sprintdesk-performance-audit.md) |
| Who can see a public team page at all | [chapter 10 · auth milestone](../10-forms-authentication-and-security-hardening/06-project-milestone-sprintdesk-auth-authjs.md) |
| The E2E suite these assertions live in | [chapter 13 · test suite](../13-testing-and-developer-experience/05-project-milestone-sprintdesk-test-suite.md) |

## The file shape

```
lib/
├── site.ts                     🔴 the origin constant. One file, imported by five others
└── metadata.ts                 the shared openGraph/twitter base and helpers
app/
├── layout.tsx                  static root metadata — 🔴 no headers(), no cookies()
├── opengraph-image.png         the site-wide fallback preview
├── opengraph-image.alt.txt     its alt text, which nothing else will ever check
├── icon.svg
├── sitemap.ts                  public routes, from the same predicate the pages use
├── robots.ts                   environment-driven
├── (marketing)/
│   ├── page.tsx                canonical + Organization JSON-LD
│   └── pricing/page.tsx
├── blog/
│   └── [slug]/
│       ├── page.tsx            generateMetadata + Article JSON-LD
│       └── opengraph-image.tsx generated per post
├── teams/
│   └── [slug]/page.tsx         public team page
└── dashboard/
    └── layout.tsx              🔴 robots: { index: false } — inherited by everything below
```

Eleven files, and four of them exist because of a rule in this chapter rather than a feature.

## The one constant

```ts
// lib/site.ts
const url = process.env.NEXT_PUBLIC_SITE_URL

if (!url) {
  // Fail the build rather than silently shipping localhost canonicals
  throw new Error('NEXT_PUBLIC_SITE_URL is required')
}

export const SITE = {
  origin: url, // e.g. https://sprintdesk.app
  name: 'SprintDesk',
  isProduction: process.env.NEXT_PUBLIC_ENV === 'production',
} as const

export function absolute(path: string): string {
  return new URL(path, SITE.origin).toString()
}
```

🔴 **The throw is the point.** A missing environment variable that falls back to `http://localhost:3000` produces a build that succeeds and a deployment that advertises localhost in every canonical, every `og:url` and every sitemap entry. Failing the build is the cheapest possible detection.

Five consumers, one value: `metadataBase` in the root layout, `alternates.canonical` in every leaf, `sitemap.ts`, `robots.ts`, and every URL inside a JSON-LD payload — the last of which is the one people forget, because `metadataBase` does not reach into it ([02c](02c-json-ld-and-structured-data.md)).

## The root layout, deliberately static

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: 'SprintDesk — sprint planning that stays out of the way',
    template: '%s · SprintDesk',
  },
  description: 'Plan sprints, track work, ship on Friday.',
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@sprintdesk',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <main id="main" tabIndex={-1}>{children}</main>
      </body>
    </html>
  )
}
```

Four decisions in that file, each with a page behind it:

- **Static, not `generateMetadata`.** A root layout that reads `headers()` breaks the synthesized `/_not-found` route, which cannot be fixed with a dynamic marker ([01g](01g-file-metadata-the-404-route-and-debugging-the-insight.md)).
- **`title.template` in the layout, `title.default` beside it.** A template without a default breaks every route that sets no title ([01b](01b-the-title-algebra-and-the-viewport-export.md)).
- **`openGraph` here carries only what is true of every page.** Leaves will *replace* this object, not merge into it ([02](02-open-graph-twitter-cards-structured-json-ld.md)) — which is why the helper below exists.
- **`twitter` is a delta**, just `card` and `creator` ([02b](02b-twitter-cards-and-the-companion-blocks.md)).

## The metadata module

```ts
// lib/metadata.ts
import type { Metadata } from 'next'
import { SITE, absolute } from '@/lib/site'

type OG = NonNullable<Metadata['openGraph']>

const base: OG = {
  type: 'website',
  siteName: SITE.name,
  locale: 'en_US',
}

/** Compose a leaf's openGraph without dropping the site-wide fields. */
export function openGraph(overrides: OG): OG {
  return { ...base, ...overrides }
}

/** Everything a public leaf route needs, in one call. */
export function publicPage({
  title,
  description,
  path,
  image,
  imageAlt,
}: {
  title: string
  description: string
  path: string
  image?: string
  imageAlt?: string
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: absolute(path) },
    openGraph: openGraph({
      title,
      description,
      url: absolute(path),
      ...(image
        ? { images: [{ url: absolute(image), width: 1200, height: 630, alt: imageAlt ?? title }] }
        : {}),
    }),
  }
}
```

🔴 **`imageAlt` defaults to the title rather than to nothing.** Optional alt text is alt text that will be omitted, and it is the one accessibility field in this chapter that no automated tool will ever flag ([04b](04b-links-buttons-forms-and-the-alt-decision.md)).

## The per-route work is the next chunk

The leaf's `generateMetadata`, its JSON-LD, the generated OG image, `sitemap.ts`, `robots.ts` and
the `noindex` on the authenticated area are [06b](06b-the-per-route-work.md). The accessibility
pass over the board and the acceptance criteria for the whole milestone are
[06c](06c-the-a11y-pass-and-the-acceptance-criteria.md).

## Gotchas

**★ `NEXT_PUBLIC_SITE_URL` is unset and the build succeeds.** A fallback to `http://localhost:3000` produces canonicals, `og:url`s and sitemap entries pointing at localhost, on a deployment that looks healthy. Fix: throw in `lib/site.ts` at module scope, so the build fails instead of the site.

**★ The root layout's `generateMetadata` reads `headers()` to build `metadataBase`.** It breaks the framework-synthesized `/_not-found`, which inherits the root layout, must prerender, and has no page body for a dynamic marker. Fix: the environment constant, and static `metadata` in the root layout ([01g](01g-file-metadata-the-404-route-and-debugging-the-insight.md)).

**★ A leaf sets `openGraph: { title }` and loses `siteName`, `locale` and `type`.** The merge is one level deep, so `openGraph` is replaced wholesale. Fix: compose through `openGraph()` in `lib/metadata.ts`; never write a bare `openGraph` object in a leaf.

**★ `title.template` is in the layout with no `title.default`.** Every route that sets no title of its own ends up with nothing. Fix: declare both together, always ([01b](01b-the-title-algebra-and-the-viewport-export.md)).

**★ `imageAlt` is optional in your helper and every page omits it.** An optional accessibility field is an omitted one, and no automated tool inspects an OG image. Fix: default it to the title, as above — or make it required and take the compile errors.

**★ Two origin constants appear — one in `lib/site.ts` and one inlined in `sitemap.ts`.** They will drift, and the drift shows up as a preview deployment advertising production. Fix: one exported constant, imported by all five consumers.

**★ The `twitter` block duplicates the whole `openGraph` block.** Every title change now has to happen twice. Fix: `card` and `creator` only; let the rest fall back.

**★ `metadataBase` is set in a leaf as well as the root layout.** Harmless until they disagree, then baffling. Fix: exactly one declaration, in the root layout.

## Interview questions

**★ Why does one constant deserve its own module in this milestone?**
Because five independent consumers need the same origin and none of them can validate it: `metadataBase` in the root layout, `alternates.canonical` in every leaf, the absolute URLs in `sitemap.ts`, the `sitemap` and `host` fields in `robots.ts`, and every `url`, `image` and `@id` inside a JSON-LD payload — which `metadataBase` explicitly does not reach. Two copies of that value drift on the day someone adds a staging environment, and the symptom is not an error but a preview deployment that advertises production URLs, caches a wrong OG image against a URL a scraper will remember, and quietly competes with production in the index.

**★ Why is the root layout's metadata static rather than a `generateMetadata`?**
Because the root layout is inherited by routes you did not write. `/_not-found` and `/_global-error` are synthesized by the framework, they inherit the root layout's metadata function, they must be statically prerendered, and they have no page body — so the `<Suspense>`-wrapped dynamic marker that rescues every other route has nothing to attach to. A root layout that reads `headers()` or `cookies()` therefore produces a build error naming a route nobody created, with no route-level fix. Beyond the mechanics, almost nothing about site identity legitimately varies per request; wanting `generateMetadata` at the root is usually a sign that a value belongs in an environment variable.

**★ A junior engineer adds `openGraph: { title: post.title }` to the pricing page. What breaks, and what does the helper do about it?**
The pricing page loses `siteName`, `locale` and `type`, because metadata merging is one level deep and `openGraph` is a single key — setting it replaces the root layout's whole object. Nothing errors, and the only symptom is a slightly worse preview that nobody will notice for months. The helper closes the hole by making the *composed* object the path of least resistance: `publicPage()` takes a title, description and path and returns a complete `Metadata`, so a leaf never has a reason to write a bare `openGraph` object. That is the general pattern for this class of bug — you cannot lint the merge, so you remove the opportunity.

**★ What would you check first if the site's previews all showed the wrong image after a deploy?**
Whether the image URL changed. Meta's documentation states that images are cached by URL and are not updated unless the URL changes, so a redeploy that replaces the file at the same path produces exactly this. The diagnosis order matters: `curl` with a crawler User-Agent first to confirm what the HTML actually says, *then* the platform debugger — because the debugger triggers a re-scrape and will fix the symptom before you have learned anything ([02f](02f-what-the-unfurlers-actually-fetch.md)).

---

← [Auditing SEO in CI](05c-auditing-seo-in-ci.md) · [Chapter 12 overview](01-explanation.md) · Next → [The per-route work](06b-the-per-route-work.md)
