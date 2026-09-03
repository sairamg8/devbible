---
sidebar_position: 4
title: "Monorepos with Turborepo: shared packages, remote caching, CI pipelines."
sidebar_label: "Monorepos with Turborepo: shared packages, remote caching, CI pipelines."
description: "Monorepos with Turborepo: shared packages, remote caching, CI pipelines."
---

# ▲ Monorepos with Turborepo: shared packages, remote caching, CI pipelines.

> **Syllabus chapter:** 13. Testing and Developer Experience  
> **Exact concept:** Monorepos with Turborepo: shared packages, remote caching, CI pipelines.  
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

### Layers

| Layer | Tools | Targets |
| :--- | :--- | :--- |
| Unit | Vitest / Jest | pure DAL helpers, zod schemas |
| Component | RTL + jsdom limits | client components |
| Integration | Next test utils / request injection | route handlers, actions |
| E2E | Playwright | auth, board CRUD, streaming UX |

Server Components often tested via **integration** (invoke data functions) rather than full RSC render in jsdom.

### Type-safety as testing

- `strict` TS  
- typed routes (generated)  
- Zod contract tests for API payloads  

### Monorepos

Turborepo/Nx: build order, remote cache, `test` only for affected packages.
