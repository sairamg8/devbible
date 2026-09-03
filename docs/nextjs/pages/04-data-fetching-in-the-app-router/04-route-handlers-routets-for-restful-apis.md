---
sidebar_position: 4
title: "Route Handlers (`route.ts`) for RESTful APIs."
sidebar_label: "Route Handlers (`route.ts`) for RESTful APIs."
description: "Route Handlers (`route.ts`) for RESTful APIs."
---

# ▲ Route Handlers (`route.ts`) for RESTful APIs.

> **Syllabus chapter:** 4. Data Fetching in the App Router  
> **Exact concept:** Route Handlers (`route.ts`) for RESTful APIs.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 1. Under-The-Hood Mechanics

A `route.ts` file exports functions named after HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`), each receiving a web-standard `NextRequest` and returning a web-standard `Response` (or `NextResponse`) — the App Router's direct replacement for Pages Router API routes, built on Web Fetch API primitives rather than Node's `req`/`res`.

```
app/api/products/route.ts
        │
        ├── export async function GET(request: NextRequest)   ──► handles GET /api/products
        ├── export async function POST(request: NextRequest)    ──► handles POST /api/products
        └── (PUT/DELETE/PATCH similarly — only define the verbs actually needed)

app/api/products/[id]/route.ts
        └── export async function GET(request, { params })    ──► params: Promise<{ id: string }>
```

### Static vs Dynamic Route Handler Caching
A `GET` Route Handler with **no** dynamic APIs used (no `request.nextUrl.searchParams` read, no `cookies()`/`headers()`) and no non-GET-verb siblings can be **statically evaluated at build time** and cached, just like a page — genuinely serving a fixed JSON response from cache rather than re-executing the function per request. The moment it reads a dynamic input (a search param, a cookie) or the segment also exports a `POST`/`PUT`/etc., it becomes dynamic — evaluated fresh, per request.

---
