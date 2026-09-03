---
sidebar_position: 6
title: "**Project Milestone:** SprintDesk public pages fully indexed"
sidebar_label: "**Project Milestone:** SprintDesk public pages fully indexed"
description: "**Project Milestone:** SprintDesk public pages fully indexed — dynamic OG images, JSON-LD, sitemap, a11y audit of the board."
---

# ▲ **Project Milestone:** SprintDesk public pages fully indexed

> **Syllabus chapter:** 12. SEO, Metadata, and Accessibility  
> **Exact concept:** **Project Milestone:** SprintDesk public pages fully indexed — dynamic OG images, JSON-LD, sitemap, a11y audit of the board.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
