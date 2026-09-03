---
sidebar_position: 4
title: "Node.js runtime vs. Edge runtime: capabilities, cold starts, choosing per route."
sidebar_label: "Node.js runtime vs. Edge runtime: capabilities, cold starts, choosing per route."
description: "Node.js runtime vs. Edge runtime: capabilities, cold starts, choosing per route."
---

# ▲ Node.js runtime vs. Edge runtime: capabilities, cold starts, choosing per route.

> **Syllabus chapter:** 11. Performance Optimization & Turbopack  
> **Exact concept:** Node.js runtime vs. Edge runtime: capabilities, cold starts, choosing per route.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

:::warning `preferredRegion` is deprecated — verified 2026-09-03

The **`preferredRegion`** route segment config is **marked deprecated** in the current API
reference. Any region-pinning or data-locality strategy built on it needs re-checking against
current guidance before you rely on it.

This matters more than a normal deprecation because `preferredRegion` was the usual way to
express "run this route near its data." Removing it does not remove the problem, so treat the
placement decision as live rather than settled, and check the
[route segment config reference](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
for what replaces it.

**Related, from the same release:** App Router SSR moved from web streams to **native Node.js
streams**, handling up to **22% more requests under load** with no application changes —
which shifts the capacity arithmetic behind any multi-region sizing done on older numbers.
:::

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Declaring `runtime = 'edge'` on a Route That Uses Node-Only APIs
```typescript
// ❌ WRONG: this THROWS at runtime (or fails to build, depending on the specific API) —
// the ORM's underlying driver uses raw Node `net` sockets, unavailable in the Edge runtime
export const runtime = 'edge';
import { db } from '../../../lib/db'; // Node-only database driver
export async function GET() { return Response.json(await db.query.orders.findMany()); }

// ✅ CORRECT: verify every dependency in an Edge-targeted route is genuinely Edge-compatible
// BEFORE declaring the runtime — check the specific database driver's own Edge support docs
```

### ⚠️ Pitfall 2: Assuming Edge Is Always Faster in Absolute Terms
Edge's advantage is specifically **reduced network latency** (physically closer to the user) and **faster cold starts** — it does not make CPU-bound computation itself faster, and a V8 isolate's available memory/CPU budget is typically more constrained than a full Node.js server instance. A CPU-heavy operation (image processing, complex synchronous computation) may perform *worse* at the Edge under its tighter resource constraints, even though the network latency portion improved.

### ⚠️ Pitfall 3: Forgetting Middleware's Edge Constraint Applies Even to Imported Utility Code
```typescript
// ❌ WRONG: middleware.ts itself doesn't use fs directly, but it imports a shared "utils" module
// that DOES (perhaps used elsewhere in a Node-runtime API route) — the shared import still
// gets bundled into middleware's Edge execution context and fails there
import { readConfigFile } from '../lib/shared-utils'; // shared-utils.ts uses fs internally
export function middleware() { readConfigFile(); }

// ✅ CORRECT: keep utility modules imported by middleware free of Node-only APIs, or split
// Edge-safe and Node-only utilities into clearly separate files
```
