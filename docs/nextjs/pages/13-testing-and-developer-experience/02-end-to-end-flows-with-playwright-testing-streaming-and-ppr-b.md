---
sidebar_position: 2
title: "End-to-end flows with Playwright; testing streaming and PPR behavior."
sidebar_label: "End-to-end flows with Playwright; testing streaming and PPR behavior."
description: "End-to-end flows with Playwright; testing streaming and PPR behavior."
---

# ▲ End-to-end flows with Playwright; testing streaming and PPR behavior.

> **Syllabus chapter:** 13. Testing and Developer Experience  
> **Exact concept:** End-to-end flows with Playwright; testing streaming and PPR behavior.  
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
