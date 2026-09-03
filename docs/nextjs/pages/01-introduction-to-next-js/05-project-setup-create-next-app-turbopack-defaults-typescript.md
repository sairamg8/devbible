---
sidebar_position: 5
title: "Project setup: `create-next-app`, Turbopack defaults, TypeScript, ESLint, Tailwind."
sidebar_label: "Project setup: `create-next-app`, Turbopack defaults, TypeScript, ESLint, Tailwind."
description: "Project setup: `create-next-app`, Turbopack defaults, TypeScript, ESLint, Tailwind."
---

# ▲ Project setup: `create-next-app`, Turbopack defaults, TypeScript, ESLint, Tailwind.

> **Syllabus chapter:** 1. Introduction to Next.js  
> **Exact concept:** Project setup: `create-next-app`, Turbopack defaults, TypeScript, ESLint, Tailwind.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> ⚠️ **Tooling has moved — verified 2026-09-03**
>
> Three changes this page predates.
>
> **1 · `next lint` was removed in Next.js 16.** `next build` **no longer runs the linter**.
> Run linters from npm scripts instead. Projects on the old flow migrate with a codemod:
>
> ```bash
> npx @next/codemod@canary next-lint-to-eslint-cli .
> ```
>
> **2 · Biome is now a first-class choice.** `create-next-app` prompts for **ESLint / Biome /
> None** — ESLint for rule coverage, Biome for speed and formatting in one tool.
>
> **3 · `create-next-app` scaffolds `AGENTS.md` by default**, plus a `CLAUDE.md` that
> references it, so coding agents read version-matched guidance. The recommended-defaults path
> is TypeScript, ESLint, Tailwind, App Router, Turbopack and `AGENTS.md`, with import alias
> `@/*`. See chapter 14.
>
> **Also worth knowing:** Turbopack is the **default bundler** — `next dev --webpack` /
> `next build --webpack` opts out — and `next build` can type-check with **TypeScript 7** (a
> 10× native port). ⚠️ **`experimental.useTypeScriptCli` is an opt-OUT, not the switch that
> turns TS 7 on** — `next build` already runs your project-local `tsc` by default; adopting TS 7
> is just installing it. Setting the flag to `false` makes the build **exit** on TS 7. The
> TypeScript floor is still 5.1.

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
