---
sidebar_position: 4
title: "Versioning and LTS model: what \"stable,\" \"canary,\" and \"preview\" mean; how to read the…"
sidebar_label: "Versioning and LTS model: what \"stable,\" \"canary,\" and \"preview\" mean; how to read the…"
description: "Versioning and LTS model: what 'stable,' 'canary,' and 'preview' mean; how to read the release channel before adopting a feature. *(Callout: current stable is 1"
---

# ▲ Versioning and LTS model: what "stable," "canary," and "preview" mean; how to read the…

> **Syllabus chapter:** 1. Introduction to Next.js  
> **Exact concept:** Versioning and LTS model: what "stable," "canary," and "preview" mean; how to read the release channel before adopting a feature. *(Callout: current stable is 16.2.x; 16.3 is in preview.)*  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

:::warning Version corrected — verified 2026-09-03

This page was written when **16.2** was current and 16.3 was in preview. That is no longer true.

| | This page says | Upstream, 2026-09-03 |
|---|---|---|
| Current stable | 16.2.x | **16.3.4** |
| 16.3 | "in preview" | **stable since 2026-08-03** |
| Node.js floor | 20+ | **20.9** |
| React | 19.2+ | the App Router **bundles React canary** built-in; declare `react`/`react-dom` anyway for tooling |

**The release model has a name this page does not use.** Alongside stable / canary / preview,
Next.js publishes **Active LTS** (currently **16.3**) and **Maintenance LTS** (currently
**15.5**). Security releases patch both lines — the August 2026 release shipped as 16.3.3 and
15.5.24 — so "which LTS line am I on" is the question that decides how cheap patching is.

Every **`[16.3 Preview]`** tag elsewhere in this book is stale for the same reason. See
**Appendix E**, which is now a shipped/withdrawn record rather than a watchlist.
:::

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
