---
sidebar_position: 1
title: "Default architecture: everything is a Server Component (RSC)"
sidebar_label: "Default architecture: everything is a Server Component (RSC)"
description: "Default architecture: everything is a Server Component (RSC) — zero client JS, direct data access, secure execution environment."
---

# ▲ Default architecture: everything is a Server Component (RSC)

> **Syllabus chapter:** 3. Server Components vs. Client Components  
> **Exact concept:** Default architecture: everything is a Server Component (RSC) — zero client JS, direct data access, secure execution environment.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## The default: everything is a Server Component

A **Server Component (RSC)** renders entirely on the server (or at build time) and ships **zero JavaScript** to the browser for that component — the client receives already-rendered output, not the code that produced it.

```tsx
// app/products/page.tsx — a Server Component by default, no directive needed
async function ProductsPage() {
  const products = await db.product.findMany() // direct data access, no API route needed
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}

export default ProductsPage
```

Two things stand out here that are impossible in a traditional React app: the component is `async` and awaits a database call directly, and none of that database code — or its credentials, its query logic, its dependencies — is ever sent to the browser. This is a **secure execution environment** by construction: secrets and privileged logic simply never cross the server/client boundary, because the component that touches them never ships as client code at all.
