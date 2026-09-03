---
sidebar_position: 3
title: "Type-safety as testing: strict TS config, typed routes, Zod contract tests."
sidebar_label: "Type-safety as testing: strict TS config, typed routes, Zod contract tests."
description: "Type-safety as testing: strict TS config, typed routes, Zod contract tests."
---

# ▲ Type-safety as testing: strict TS config, typed routes, Zod contract tests.

> **Syllabus chapter:** 13. Testing and Developer Experience  
> **Exact concept:** Type-safety as testing: strict TS config, typed routes, Zod contract tests.  
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
