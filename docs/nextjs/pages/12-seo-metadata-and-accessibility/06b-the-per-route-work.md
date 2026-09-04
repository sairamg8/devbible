---
title: "The per-route half of the milestone: a leaf that composes its metadata, calls `notFound()` before anything can suspend, emits escaped JSON-LD, and generates an OG image only where per-route branding is worth a render"
sidebar_label: "06b · The per-route work"
sidebar_position: 29
description: "The blog leaf's generateMetadata and Article JSON-LD, why getPost is called twice on purpose, the generated OG image and the scoping decision behind it, sitemap and robots driven by the app's own queries, and the noindex the dashboard inherits."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) (`lastUpdated: 2026-08-25`),
> [`opengraph-image`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) (`2026-07-09`),
> [`ImageResponse`](https://nextjs.org/docs/app/api-reference/functions/image-response) (`2026-08-25`),
> [`sitemap.xml`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) (`2026-08-25`),
> [`robots.txt`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots) (`2026-05-01`)
> and the [JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld) (`2026-03-02`).
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, no build output.

**[06](06-project-milestone-sprintdesk-public-pages-fully-indexed.md) built the shared foundation: one origin constant, static root metadata, one composition helper. This page spends it. Every file here is short, and every one of them contains at least one line that exists because of a failure mode rather than a feature — the `notFound()` placed before the first boundary, the `.replace` on the serialised JSON-LD, the font read at module scope, the sitemap importing the same query function the page imports.**

## A public leaf

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { Article, WithContext } from 'schema-dts'
import { absolute } from '@/lib/site'
import { publicPage } from '@/lib/metadata'
import { getPost } from '@/lib/posts'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Not found', robots: { index: false } }

  return {
    ...publicPage({
      title: post.title,
      description: post.excerpt,
      path: `/blog/${post.slug}`,
    }),
    openGraph: {
      type: 'article',
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: post.authors.map((a) => a.name),
      title: post.title,
      description: post.excerpt,
      url: absolute(`/blog/${post.slug}`),
    },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // 🔴 Before any Suspense boundary, so the server can still send a real 404
  const post = await getPost(slug)
  if (!post) notFound()

  const jsonLd: WithContext<Article> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': absolute(`/blog/${post.slug}#article`),
    headline: post.title,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: post.authors.map((a) => ({ '@type': 'Person' as const, name: a.name })),
    image: absolute(`/blog/${post.slug}/opengraph-image`),
  }

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <h1>{post.title}</h1>
      {/* … */}
    </article>
  )
}
```

Note that `getPost` is called in both `generateMetadata` and the page. That is deliberate and free if `getPost` is memoized — `fetch` is deduplicated automatically, and a database call needs React `cache` ([01](01-static-and-dynamic-metadata-metadata-objects-generatemetadat.md)).

## The generated OG image, scoped honestly

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPost } from '@/lib/posts'

export const alt = 'SprintDesk blog post'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Module scope: read once, not per request. ttf, not woff2.
const inter = await readFile(join(process.cwd(), 'assets/Inter-SemiBold.ttf'))

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex', // 🔴 Satori infers no default display
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 64,
          background: '#0b0d12',
          color: '#f5f7fa',
          fontFamily: 'Inter',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, opacity: 0.7 }}>SprintDesk</div>
        <div style={{ display: 'flex', fontSize: 64, lineHeight: 1.1 }}>
          {post?.title ?? 'SprintDesk'}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Inter', data: inter, style: 'normal', weight: 600 }] }
  )
}
```

**Blog posts get generated images; team pages get one static file.** There are tens of posts and potentially tens of thousands of teams, and per-team branding on a preview earns nothing against a build-time render per team ([02d](02d-the-opengraph-image-and-twitter-image-file-conventions.md)). Scope the expensive mechanism to where it pays.

## Sitemap and robots

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'
import { absolute } from '@/lib/site'
import { listPublishedPosts, listPublicTeams } from '@/lib/queries'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, teams] = await Promise.all([listPublishedPosts(), listPublicTeams()])

  return [
    { url: absolute('/'), lastModified: new Date('2026-08-02') },
    { url: absolute('/pricing'), lastModified: new Date('2026-08-02') },
    ...posts.map((p) => ({ url: absolute(`/blog/${p.slug}`), lastModified: p.updatedAt })),
    ...teams.map((t) => ({ url: absolute(`/teams/${t.slug}`), lastModified: t.updatedAt })),
  ]
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'
import { SITE, absolute } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  if (!SITE.isProduction) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/api/'] },
    sitemap: absolute('/sitemap.xml'),
    host: SITE.origin,
  }
}
```

🔴 **`listPublishedPosts` is the same function the blog index page calls.** That is the whole discipline: the sitemap is a view over the same predicate, not a second implementation, so a URL cannot be advertised that the site will 404 ([03](03-sitemapts-and-robotsts-automation-localized-metadata-for-i18.md)).

## The authenticated area

```tsx
// app/dashboard/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>
}
```

One declaration, inherited by every route beneath it, so a new dashboard page is `noindex` by default rather than by remembering. Note that the `Disallow: /dashboard/` in `robots.ts` and this `noindex` are doing different jobs — the disallow is about crawl cost, the `noindex` is about listing — and that the disallow will prevent the `noindex` from being read on any URL a crawler discovers from an external link ([03b](03b-robotsts-and-the-crawl-directives.md)). For an authenticated area behind a real auth check this is acceptable; for a public-but-unlisted page it would not be.

## Gotchas

**★ `notFound()` is called inside a Suspense boundary and every 404 returns 200.** Headers are sent as soon as anything suspends, and the status cannot change afterwards. Fix: the existence check is the first thing the page component does, before any boundary and before any `await` that can suspend ([05](05-common-seo-pitfalls-in-rsc-streaming-setups-and-automated-au.md)).

**★ `getPost` is called in both `generateMetadata` and the page and you assume that is two queries.** It is one if the function is memoized — `fetch` is deduplicated automatically, and a database call needs React `cache`. Fix: wrap the query in `cache()` once, in `lib/posts.ts`, and stop worrying about it at every call site.

**★ The JSON-LD `image` is relative and validates locally.** `metadataBase` does not reach inside a JSON-LD payload; nothing rewrites it and nothing errors. Fix: `absolute()` on every `url`, `image` and `@id` — which is why the helper exists in `lib/site.ts` rather than being inlined.

**★ The `.replace(/</g, '\\u003c')` is dropped in review as noise.** It is the only thing standing between a post title containing `</script>` and stored XSS delivered by the SEO layer. Fix: move the serialisation into a shared `JsonLd` component so there is no per-call-site decision to make ([02c](02c-json-ld-and-structured-data.md)).

**★ The OG image renders in a fallback font in production.** The font was `woff2`, which `ImageResponse` does not support, or no `fonts` array was passed at all. Fix: a `.ttf` or `.otf` copy of the same face, read at module scope, passed in `fonts`.

**★ Nothing renders in the generated image except the first child.** A container is missing `display: 'flex'`; Satori infers no default display. Fix: put it on every container, including ones that would never need it in CSS.

**★ Team pages get generated OG images and the build time triples.** Per-team branding on a preview earns nothing at tens of thousands of teams. Fix: a static `opengraph-image.png` in the `teams/` segment; scope the expensive mechanism to where it pays ([02d](02d-the-opengraph-image-and-twitter-image-file-conventions.md)).

**★ The sitemap has its own copy of the "published" predicate.** It will drift from the listing page's, and the symptom is a console reporting a few hundred 404s months later. Fix: one exported query function, imported by both.

**★ The sitemap is stale after every publish.** `revalidate = 3600` bounds it at an hour, which may not be good enough. Fix: `'use cache'` with `cacheTag('posts')`, so the invalidation the publish flow already performs covers the sitemap too ([03](03-sitemapts-and-robotsts-automation-localized-metadata-for-i18.md)).

**★ Production `robots.txt` disallows everything.** `NEXT_PUBLIC_ENV` was not set on the production deploy, so `isProduction` was false and the preview branch ran. Fix: assert against the deployed `robots.txt` in CI ([05c](05c-auditing-seo-in-ci.md)) — this is the single fastest way to take a site out of the index.

**★ `robots: { index: false }` is set on each dashboard page instead of the layout.** A new page added next month is indexable by default. Fix: one declaration in `app/dashboard/layout.tsx` and let inheritance do the work.

**★ `lastModified` on the hand-listed marketing routes is `new Date()`.** It claims every page changed at build time, which is verifiably false and is exactly the case Google's guidance excludes from consideration. Fix: a real hard-coded date, updated when the page is edited.

## Interview questions

**★ Why is `notFound()` the first statement in the page component rather than wherever the data is needed?**
Because the HTTP status is decided by whether the response body has started streaming, and streaming starts as soon as a Suspense fallback renders or a Server Component suspends under a boundary. Once the headers are out, the status cannot be changed, so a `notFound()` after that point produces a 200 carrying the not-found UI — protected from indexation by the `noindex` Next.js inserts, but still a 200 to analytics, monitoring and anything else counting status codes. Putting the existence check first is free and preserves the option; if the check itself is too slow to lead, the documented alternative is to do it in `proxy`, before rendering.

**★ The same `getPost(slug)` runs in `generateMetadata` and in the page. Is that a problem?**
Not if it is memoized, and memoization is the reason the pattern is idiomatic rather than wasteful. `fetch` calls with identical options are deduplicated across `generateMetadata`, `generateStaticParams`, layouts and pages automatically; a non-`fetch` data source — Prisma, Drizzle, a raw driver — is not, and needs React `cache` around the query function. The failure people actually hit is subtler than "two queries": passing *different* `fetch` options in the two places defeats the deduplication silently, so the two calls are no longer identical and both run.

**★ Blog posts get generated OG images and team pages get a static one. Justify the asymmetry.**
By what the image earns against what it costs. A generated image is a Satori render per route, produced at build if the route is statically parameterised and per-request otherwise; per-post branding on a few dozen posts is a real gain in share click-through for a trivial build cost. Tens of thousands of team pages is a different calculation entirely: the build cost is linear in team count, the images are near-identical, and most of those pages will never be shared. One static file in the parent segment covers all of them correctly, and the segment-level file automatically applies to every route beneath it.

**★ Why does `robots.ts` read an environment variable at module scope rather than checking the request?**
Two reasons. Mechanically, `robots.ts` is a Route Handler that is cached by default unless it touches a request-time API, so reading `headers()` to determine the host would make it a per-request function invocation triggered by every crawler that asks. Semantically, "is this deployment production" is a property of the *deployment*, not of the request — a build-time variable expresses that exactly, and it is the same variable the origin constant uses, so `robots.ts` and `metadataBase` cannot disagree about which environment they are in.

**★ The dashboard is both `Disallow`ed in `robots.ts` and `noindex`ed in its layout. Is that redundant, harmful, or correct?**
It is correct here and would be harmful elsewhere, and knowing which is the point of the question. The two switches do different jobs: `Disallow` stops the crawl, saving crawl budget on an area no crawler should be spending it in; `noindex` stops the listing. The interaction is that a disallowed URL is never fetched, so its `noindex` is never read — which means for any dashboard URL a crawler learns about from an external link, only the disallow is in effect, and Google's documentation is explicit that a blocked URL can still be listed. For an authenticated area sitting behind a real auth check that is acceptable, because the crawler cannot see content either way. For a public-but-unlisted page it would be exactly wrong, and the `Disallow` would have to go.

---

← [Milestone: SprintDesk fully indexed](06-project-milestone-sprintdesk-public-pages-fully-indexed.md) · [Chapter 12 overview](01-explanation.md) · Next → [The a11y pass and the acceptance criteria](06c-the-a11y-pass-and-the-acceptance-criteria.md)
