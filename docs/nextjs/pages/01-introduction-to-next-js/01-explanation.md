---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 1 overview"
---

# ▲ Introduction to Next.js

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> **Source:** authored for exact devbible syllabus Chapter 1

Next.js is a **React meta-framework** optimized for server-first rendering, file-system routing, and production hosting. The App Router (mature standard) makes **Server Components the default**, ships less client JS by default, and integrates caching, routing, and data fetching as framework concerns rather than ad-hoc libraries.

## 1. Under-The-Hood Mechanics

### Why App Router replaced Pages as the default story

| Pages Router | App Router |
| :--- | :--- |
| Client components by default mental model | Server Components by default |
| `getServerSideProps` / `getStaticProps` | `async` server components + `fetch` / caches |
| `_app` / `_document` | nested `layout.tsx` |
| Limited streaming | Streaming + Suspense first-class |

### Core philosophy

1. **Server-first** — compute and data close to the source; ship HTML/RSC payload, not unnecessary JS  
2. **Zero client JS where possible** — interactivity is opt-in (`'use client'`)  
3. **Hybrid static/dynamic** — per-route and per-fetch caching, not one global mode  

### Compared to alternatives (honest, short)

- **Remix / React Router frameworks** — deep web fundamentals, loaders/actions  
- **Astro** — content-heavy multi-framework islands  
- **TanStack Start** — type-safe router-centric full stack  

Next’s bet: integrated full-stack React (Vercel or self-host) with strong defaults for SEO and performance.

### Version channels

- **stable** — production  
- **canary** — integration previews  
- **preview** (e.g. 16.3 features) — teach concepts as durable; treat APIs as callouts  

Read release notes before adopting preview flags (PPR, Instant Navigations, agent tooling).

### Hello App Router

```bash
npx create-next-app@latest sprint-desk --ts --eslint --tailwind --app
```

```tsx
// app/page.tsx — Server Component by default
export default function Home() {
  return <h1>SprintDesk</h1>
}
```

Key shifts to internalize early: Turbopack defaults, async `params` / `searchParams`, Node 20+ engines, React 19.x features.

## 2. Real-World Engineering Scenario

A marketing site on Pages Router + client-side data fetching scored poorly on LCP. Moving landing routes to App Router Server Components with static generation cut JS by hundreds of KB and made TTFB + LCP predictable — without rewriting the authenticated dashboard on day one (incremental adoption).

## 3. Production-Grade Code Example

```tsx
// app/layout.tsx
import type { ReactNode } from 'react'

export const metadata = {
  title: 'SprintDesk',
  description: 'Multi-tenant tasks',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Treating Next as “just webpack for React”

Routing, caching, and server/client boundaries are the product — ignore them and you reimplement a worse framework.

### ⚠️ Pitfall 2: Adopting preview flags in production without an exit plan

Pin versions; feature-flag experimental caching/PPR; verify against the stable channel.

### ⚠️ Pitfall 3: Starting every file with `'use client'`

You recreate the Pages-era client bundle. Default server; push client leaves down.

### ⚠️ Pitfall 4: Skipping the runtime matrix

Edge vs Node capabilities differ (native modules, long CPU). Choose per route consciously (later chapter).
