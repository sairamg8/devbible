---
sidebar_position: 5
title: "Edge Functions and custom cache structures for global compute."
sidebar_label: "Edge Functions and custom cache structures for global compute."
description: "Edge Functions and custom cache structures for global compute."
---

# ▲ Edge Functions and custom cache structures for global compute.

> **Syllabus chapter:** 15. Databases, APIs, and Full-Stack Patterns  
> **Exact concept:** Edge Functions and custom cache structures for global compute.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 1. Under-The-Hood Mechanics

### Data stack choices

| Layer | Options | Notes |
| :--- | :--- | :--- |
| DB | Neon/serverless Postgres, etc. | Pooling required on serverless |
| Access | `pg` / Prisma / Drizzle / Kysely | Drizzle/Kysely = SQL-near; Prisma = higher level |
| Mutations | Server Actions | Forms + progressive enhancement |
| HTTP API | `route.ts` | Webhooks, public REST, mobile clients |
| Realtime | SSE / WebSockets | SSE simpler for server→client streams |
| Jobs | queues / cron | Don’t block requests on heavy work |

### Route Handlers vs Server Actions

- **Actions** — first-party UI mutations, colocated with app, cookie session natural  
- **Route Handlers** — non-UI clients, webhooks, versioned HTTP APIs  

### Pooling

Serverless functions open many short connections. Use provider poolers (Neon pooler, PgBouncer) and avoid global `new Client()` per request without pooling.

```ts
// sketch — Drizzle + pool
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool)
```

### Realtime

```ts
// SSE route handler sketch
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const iv = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(`data: ${Date.now()}\n\n`))
      }, 1000)
      // cleanup on cancel...
    },
  })
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
  })
}
```
