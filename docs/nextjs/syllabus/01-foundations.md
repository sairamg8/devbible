---
title: "Part 1 · Foundations"
sidebar_label: "1 · Foundations"
sidebar_position: 1
---

> Verified: 2026-09-03 against the [Next.js 16.3 release post](https://nextjs.org/blog/next-16-3)
> and the [installation docs](https://nextjs.org/docs/app/getting-started/installation).
> ⚠️ **The concept list below is the imported syllabus verbatim, authored against 16.2.**
> Where a bullet is now factually wrong, the drift is flagged inline — the bullet itself is
> left as written, because this track was imported to be copied, not rewritten.

**Target stack as written:** Next.js 16.2 + React 19.2+, App Router, Turbopack, Cache
Components, PPR.
⚠️ **Upstream on 2026-09-03: Next.js 16.3.4** — 16.3 went stable 2026-08-03. Node.js floor
is **20.9**; the App Router bundles **React canary**.

**Running project:** SprintDesk, a multi-tenant SaaS task dashboard.

## 1 · Introduction to Next.js

- Evolution from Pages Router to App Router; why App Router is the standard.
- Next.js vs. alternatives (Remix/React Router v7, Astro, TanStack Start) — strengths in full-stack, SEO, and performance.
- Core philosophy: server-first rendering, zero client JS where possible, hybrid static/dynamic architectures.
- Versioning and LTS model: what "stable," "canary," and "preview" mean; how to read the release channel before adopting a feature. *(Callout: current stable is 16.2.x; 16.3 is in preview.)*
  - ⚠️ **Stale.** Stable is **16.3.4**. The real model also names **Active LTS (16.3)** and **Maintenance LTS (15.5)**, which this bullet does not.
- Project setup: `create-next-app`, Turbopack defaults, TypeScript, ESLint, Tailwind.
  - ⚠️ **Incomplete.** `create-next-app` now also scaffolds **`AGENTS.md`** (plus a referencing `CLAUDE.md`) by default, and offers **Biome** as a linter alongside ESLint. `next lint` was **removed in 16** — `next build` no longer lints.
- Hello World with the `app/` directory.
- Key framework shifts: stable React Compiler support, async `params`/`searchParams`, Node.js 20+ requirement.
  - ⚠️ **Imprecise.** `reactCompiler: true` is stable; the **Rust port is experimental** (`experimental.turbopackRustReactCompiler`). Node floor is **20.9**.

## 2 · Routing and Navigation

- File-system routing: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`.
- Nested layouts, parallel routes (`@slot`), intercepting routes, route groups.
- Dynamic routes (`[slug]`), catch-all, optional catch-all.
- Navigation mechanics: `<Link>`, `useRouter`, `redirect()`, `notFound()`.
- Prefetching fundamentals and the native View Transitions API via `<Link>`.
- **[16.3 Preview]** Instant Navigations (Stream / Cache / Block) and Partial Prefetching — client-cached route shells.
  - ⚠️ **Shipped, and renamed.** GA in 16.3, opt-in behind `cacheComponents: true` + `partialPrefetching: true`. The real feature set: **Instant Insights**, **Partial Prefetching**, **Navigation Inspector**, better ISR, and the `instant()` Playwright helper. Vercel states these become the **default in a future major**.
- The `proxy.ts` layer (successor to `middleware.ts`): request interception, rewrites, and its security limits (never as the sole auth gate).
- **Localized routing (i18n):** locale-prefixed routes, locale detection in `proxy.ts`, and dictionary loading patterns.
  - ➕ **Missing:** **root params** (`next/root-params`) — read `[lang]` from any Server Component with no prop-drilling, and inside `use cache` scopes. Also **`prefetchInlining`** and **`useLinkStatus`**.

## 3 · Server Components vs. Client Components

- Default architecture: everything is a Server Component (RSC) — zero client JS, direct data access, secure execution environment.
- `'use client'`: when and why to opt in (interactivity, browser APIs, local state).
- Composition patterns: server-to-client boundaries, serializable props, children-as-slots to keep client trees small.
- React 19.2 primitives: `useEffectEvent` for non-reactive side-effects, `<Activity>` for offscreen state preservation.
- Enforcing boundaries with `server-only` / `client-only` packages.
- Bundle-size implications and Core Web Vitals impact.
