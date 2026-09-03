---
sidebar_position: 3
title: "`sitemap.ts` and `robots.ts` automation; localized metadata for i18n routes."
sidebar_label: "`sitemap.ts` and `robots.ts` automation; localized metadata for i18n routes."
description: "`sitemap.ts` and `robots.ts` automation; localized metadata for i18n routes."
---

# ▲ `sitemap.ts` and `robots.ts` automation; localized metadata for i18n routes.

> **Syllabus chapter:** 12. SEO, Metadata, and Accessibility  
> **Exact concept:** `sitemap.ts` and `robots.ts` automation; localized metadata for i18n routes.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
