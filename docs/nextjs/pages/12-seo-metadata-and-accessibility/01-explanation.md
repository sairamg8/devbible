---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 12 overview"
---

# ▲ SEO, Metadata, and Accessibility

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  



> **Source:** current project content kept under exact syllabus title

## 1. Under-The-Hood Mechanics

Next.js generates `<head>` tags (title, description, Open Graph, Twitter cards) from either a static exported object or an async function, per route segment — merged with parent segments' metadata rather than each page needing to redeclare everything from scratch.

```
app/layout.tsx        exports metadata: { title: 'Acme', description: '...' }
        │
        ▼  merged with, and overridden field-by-field by:
app/blog/[slug]/page.tsx   exports generateMetadata() ──► { title: post.title, ... }
        │
        ▼
Final <head> for /blog/my-post: title = post.title (overridden), description = 'Acme's default (inherited, not overridden)
```

### Static `metadata` vs `generateMetadata()`
A plain exported `metadata` object works when the values are known without any data fetching. `generateMetadata()` — an async function receiving `params` and a `parent` (a Promise resolving to the parent segment's already-resolved metadata) — is required whenever metadata depends on fetched data (a blog post's actual title, a product's actual name), and importantly, its own `fetch()` calls benefit from the same Request Memoization as the page's own data fetching (see [data fetching](../04-data-fetching-in-the-app-router/01-fetch-in-server-components-automatic-request-deduplication.md)) — calling `getPost(slug)` in both `generateMetadata()` and the page component itself doesn't double the network requests.

### File-Convention-Based Generation
`sitemap.ts` and `robots.ts` are executable TypeScript files (not static XML/text) that programmatically generate their respective crawler files — letting a sitemap be built from a live database query rather than a hand-maintained static file. `opengraph-image.tsx`/`icon.tsx` use the same convention for **dynamically rendered images** — a React-JSX-like description of an image, rendered to an actual PNG at request or build time via the ImageResponse API, letting a page's social-share preview image be personalized (e.g. containing the actual product name/price) without a design tool.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Blog Needing Per-Post, Data-Driven Social Share Images and SEO Metadata.
A content site's blog posts need unique, correct `<title>`/`description`/Open Graph tags matching each post's actual content (for search snippets and social share previews), plus a distinct share-preview image per post (showing the post's actual title text, not a single generic site-wide banner image). `generateMetadata()` fetches the post once (deduplicated against the page component's own identical fetch) to build accurate per-post `<head>` tags, while `opengraph-image.tsx` in the same route segment generates a dynamic PNG per post using the post's title, entirely via code — no manual image design work per post required.

---

## 3. Production-Grade Code Example

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from 'next';

async function getPost(slug: string) {
  const res = await fetch(`https://api.acme.com/posts/${slug}`);
  return res.json();
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug); // deduplicated against the page component's own identical fetch below

  const previousImages = (await parent).openGraph?.images || [];

  return {
    title: post.title, // overrides the parent layout's default title
    description: post.excerpt,
    openGraph: {
      title: post.title,
      images: [`/blog/${slug}/opengraph-image`, ...previousImages], // points at the file below
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug); // SAME call as above — deduplicated, not a second network request
  return <Article post={post} />;
}
```

```tsx
// app/blog/[slug]/opengraph-image.tsx — dynamically generated per-post share image
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const post = await fetch(`https://api.acme.com/posts/${params.slug}`).then((r) => r.json());

  return new ImageResponse(
    (
      <div style={{ fontSize: 64, background: '#0f172a', color: 'white', width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: 80 }}>
        {post.title}
      </div>
    ),
    { ...size }
  );
}
```

```typescript
// app/sitemap.ts — programmatically generated from a live data source
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await fetch('https://api.acme.com/posts').then((r) => r.json());
  return [
    { url: 'https://acme.com', lastModified: new Date() },
    ...posts.map((post: { slug: string; updatedAt: string }) => ({
      url: `https://acme.com/blog/${post.slug}`,
      lastModified: post.updatedAt,
    })),
  ];
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming Child Metadata Fully Replaces Parent Metadata
```tsx
// Parent layout: { title: 'Acme', openGraph: { siteName: 'Acme' } }
// Child page:    { title: 'My Post' }   ← only `title` is specified

// ❌ MISUNDERSTANDING: the FINAL result is NOT just { title: 'My Post' } — openGraph.siteName
// from the parent is still MERGED IN, since Next.js merges metadata objects field-by-field,
// not replaces wholesale. Assuming a full replace can lead to "missing" fields that were
// actually always going to be inherited, or surprise inherited fields nobody expected

// ✅ CORRECT: explicitly override every field that must NOT be inherited from a parent,
// rather than assuming child metadata fully replaces the parent's object
```

### ⚠️ Pitfall 2: Fetching Data Differently in `generateMetadata()` vs the Page Component
```typescript
// ❌ WRONG: slightly different fetch options between the two defeats Request Memoization —
// this doubles the actual network requests for what should be the same underlying data
// generateMetadata(): fetch(`/posts/${slug}`, { cache: 'no-store' })
// page component:      fetch(`/posts/${slug}`)  ← different options, NOT deduplicated

// ✅ CORRECT: keep the fetch call signature byte-for-byte identical in both places,
// ideally via one shared getPost() function imported into both
```

### ⚠️ Pitfall 3: Generating `opengraph-image` Synchronously Fetching Large Data on Every Request
An `opengraph-image.tsx` without its own caching/revalidation re-fetches and re-renders the image on **every single crawl/share-preview request** by default for dynamic routes — for a high-traffic post, this can mean regenerating the same PNG unnecessarily often. Applying the same `fetch()` caching options (`revalidate`/`tags`) used elsewhere in the route to the image generation function's own data fetch avoids redundant regeneration work.
