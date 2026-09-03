---
sidebar_position: 1
title: "Unit and component testing: Jest / Vitest + React Testing Library; testing Server Components and …"
sidebar_label: "Unit and component testing: Jest / Vitest + React Testing Library; testing Server Components and …"
description: "Unit and component testing: Jest / Vitest + React Testing Library; testing Server Components and Server Actions."
---

# ▲ Unit and component testing: Jest / Vitest + React Testing Library; testing Server Components and …

> **Syllabus chapter:** 13. Testing and Developer Experience  
> **Exact concept:** Unit and component testing: Jest / Vitest + React Testing Library; testing Server Components and Server Actions.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
