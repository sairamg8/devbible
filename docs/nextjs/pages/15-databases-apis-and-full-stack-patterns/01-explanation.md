---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 15 overview"
---

# ▲ Databases, APIs, and Full-Stack Patterns

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> **Source:** authored for exact devbible syllabus Chapter 15

Full-stack Next is **where React meets data**: serverless Postgres, ORMs/query builders, Route Handlers vs Server Actions, and realtime. Connection pooling and authorization matter more than which ORM logo you pick.

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

## 2. Real-World Engineering Scenario

SprintDesk on Vercel + Neon hit `too many connections` during a traffic spike because each serverless instance opened a direct DB connection. Switching to the **pooled connection string** and moving digest emails to a **background job** stabilized latency and error rates.

## 3. Production-Grade Code Example

```ts
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const raw = await req.text()
  // verify signature...
  // enqueue job — do not do heavy work inline
  return NextResponse.json({ received: true })
}
```

```ts
// Server Action for UI
'use server'
export async function createTask(input: { title: string; teamId: string }) {
  await assertMember(input.teamId)
  await db.insert(tasks).values(input)
  revalidateTag('tasks')
}
```

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: ORM in Edge runtime without compatible driver

Edge has limited Node APIs — pick runtimes per route.

### ⚠️ Pitfall 2: Business logic only in Route Handlers when UI uses Actions

Duplicate rules drift. Share DAL functions.

### ⚠️ Pitfall 3: Long requests for emails/PDF

Use queues; return 202/background.

### ⚠️ Pitfall 4: N+1 queries in RSC trees

Parallel `fetch`/queries; dataloader patterns; check logs under load.
