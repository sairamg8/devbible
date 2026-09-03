---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 13 overview"
---

# ▲ Testing and Developer Experience

> **Page priority:** 🟡 `[O]` **Occasional / Must Learn**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> **Source:** authored for exact devbible syllabus Chapter 13

Testing Next means covering **Server Components, Server Actions, streaming UI, and E2E journeys** — not only client React trees. DX is monorepo tooling, typed routes, and CI that mirrors production.

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

## 2. Real-World Engineering Scenario

SprintDesk’s only tests were Playwright against production-like compose. PRs waited 30+ minutes. Extracting Zod + DAL unit tests and a short Playwright smoke (`login → create task → see card`) cut median feedback to ~4 minutes while increasing catch-rate on validation bugs.

## 3. Production-Grade Code Example

```ts
import { describe, it, expect } from 'vitest'
import { CreateTaskSchema } from './schema'

describe('CreateTaskSchema', () => {
  it('rejects empty title', () => {
    expect(CreateTaskSchema.safeParse({ title: '' }).success).toBe(false)
  })
})
```

```ts
// Playwright
test('create task', async ({ page }) => {
  await page.goto('/login')
  // ...auth...
  await page.getByLabel('Title').fill('Ship syllabus')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Ship syllabus')).toBeVisible()
})
```

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: jsdom for Server Components

Prefer testing pure server functions; use Playwright for RSC integration.

### ⚠️ Pitfall 2: No test DB isolation

Use transactions or testcontainers; never share dev DB.

### ⚠️ Pitfall 3: Flaky E2E without `getByRole`

Prefer accessible selectors; avoid brittle CSS chains.

### ⚠️ Pitfall 4: Skipping action tests

Actions are your write path — unit-test validation + authorize branches.
