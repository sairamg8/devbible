---
sidebar_position: 3
title: "Core philosophy: server-first rendering, zero client JS where possible, hybrid static/dynamic arc…"
sidebar_label: "Core philosophy: server-first rendering, zero client JS where possible, hybrid static/dynamic arc…"
description: "Core philosophy: server-first rendering, zero client JS where possible, hybrid static/dynamic architectures."
---

# ▲ Core philosophy: server-first rendering, zero client JS where possible, hybrid static/dynamic arc…

> **Syllabus chapter:** 1. Introduction to Next.js  
> **Exact concept:** Core philosophy: server-first rendering, zero client JS where possible, hybrid static/dynamic architectures.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
