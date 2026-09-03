---
sidebar_position: 5
title: "Cost engineering: function compute, bandwidth, and edge-cache hit-rate economics."
sidebar_label: "Cost engineering: function compute, bandwidth, and edge-cache hit-rate economics."
description: "Cost engineering: function compute, bandwidth, and edge-cache hit-rate economics."
---

# ▲ Cost engineering: function compute, bandwidth, and edge-cache hit-rate economics.

> **Syllabus chapter:** 16. Deployment, Scaling, and Observability  
> **Exact concept:** Cost engineering: function compute, bandwidth, and edge-cache hit-rate economics.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Returning Every Possible Param From `generateStaticParams()` Regardless of Scale
```typescript
// ❌ WRONG: for a catalog with hundreds of thousands of products, this makes `next build`
// itself extremely slow (and the resulting deploy artifact enormous) for the long tail of
// products that receive negligible traffic
export async function generateStaticParams() {
  const allProducts = await fetch('https://api.acme.com/products/all').then((r) => r.json());
  return allProducts.map((p) => ({ id: p.id })); // hundreds of thousands of entries
}

// ✅ CORRECT: pre-render only high-traffic paths explicitly; let the long tail generate on-demand
export async function generateStaticParams() {
  const topSellers = await fetch('https://api.acme.com/products/top-sellers').then((r) => r.json());
  return topSellers.map((p) => ({ id: p.id })); // a few hundred/thousand, not everything
}
```

### ⚠️ Pitfall 2: Assuming a Time-Based `revalidate` Update Is Instant
```typescript
// ❌ MISUNDERSTANDING: revalidate: 3600 does NOT mean "this page updates automatically every
// hour on a timer" — it means "the NEXT request after 3600s elapses triggers a background
// regeneration, and THAT SPECIFIC request still gets served the stale version while it computes"
next: { revalidate: 3600 }

// ✅ CORRECT understanding: for content that must update at a PRECISE moment (not "eventually,
// on next traffic"), use on-demand revalidation (revalidateTag/revalidatePath) triggered by
// the actual event that should cause the update, rather than relying on time-based revalidate alone
```

### ⚠️ Pitfall 3: Forgetting `output: 'standalone'` Still Requires `node_modules` Tracing Verification
The `standalone` output mode automatically traces and includes only the dependencies actually used at runtime — but native/binary dependencies (certain database drivers, image processing libraries with native bindings) occasionally aren't traced correctly by default, silently missing from the standalone bundle and only surfacing as a runtime "module not found" error in the deployed container, never at build time. Verify a `standalone` build's actual runtime behavior in a container matching the production environment, not just that `next build` completed without errors.
