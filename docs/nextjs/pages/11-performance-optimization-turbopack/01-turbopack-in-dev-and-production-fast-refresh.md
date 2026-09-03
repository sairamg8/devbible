---
sidebar_position: 1
title: "Turbopack in dev and production: Fast Refresh, optimized builds, Rust React Compiler support."
sidebar_label: "Turbopack in dev and production: Fast Refresh, optimized builds, Rust React Compiler support."
description: "Turbopack in dev and production: Fast Refresh, optimized builds, Rust React Compiler support."
---

# ▲ Turbopack in dev and production: Fast Refresh, optimized builds, Rust React Compiler support.

> **Syllabus chapter:** 11. Performance Optimization & Turbopack  
> **Exact concept:** Turbopack in dev and production: Fast Refresh, optimized builds, Rust React Compiler support.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 3. Production-Grade Code Example

```typescript
// app/api/verify-session/route.ts — Edge runtime: fast, JWT-only, no database dependency
export const runtime = 'edge';

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return new Response('Unauthorized', { status: 401 });

  const isValid = await verifyJwtSignature(token); // uses Web Crypto (crypto.subtle) — Edge-compatible
  return Response.json({ valid: isValid });
}
```

```typescript
// app/api/orders/route.ts — Node.js runtime (default): full ORM/connection-pool access
// export const runtime = 'nodejs'; ← this is the DEFAULT, no need to declare it explicitly

import { db } from '../../../lib/db'; // an ORM relying on a persistent TCP connection pool

export async function GET() {
  const orders = await db.query.orders.findMany({ with: { items: true, customer: true } });
  return Response.json(orders);
}
```

```typescript
// next.config.js — verifying which runtime a given route resolved to, during a build
// (Next.js prints a per-route runtime summary in the build output — worth checking after
// adding `export const runtime = 'edge'` anywhere, to confirm it actually took effect)
```

---
