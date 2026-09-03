---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 7 overview"
---

# ▲ Error Handling, Loading States, and Resilience

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> **Source:** authored for exact devbible syllabus Chapter 7

Resilience in the App Router is a **file-convention system**: `error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx`, plus how failures interact with **streaming** and **Server Actions**. Treat errors as part of the product UX, not only logs.

## 1. Under-The-Hood Mechanics

### Error boundaries as files

```
app/
  error.tsx          # client boundary for this segment + children
  global-error.tsx   # root; must include html/body
  not-found.tsx
  loading.tsx        # Suspense fallback for the segment
```

```tsx
// app/dashboard/error.tsx
'use client'
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <p>Something went wrong.</p>
      <button type="button" onClick={reset}>
        Retry
      </button>
    </div>
  )
}
```

`error.tsx` must be a Client Component (event handlers / reset).

### Streaming failures

A throw inside a Suspense-bound async Server Component fails that **slot**, not necessarily the whole document — place boundaries so one widget can fail while the shell remains.

### Server Actions: throw vs typed result

```ts
'use server'
export async function createTask(formData: FormData) {
  const title = String(formData.get('title') ?? '')
  if (!title) return { ok: false as const, error: 'Title required' }
  await db.task.create({ data: { title } })
  return { ok: true as const }
}
```

Pair with `useActionState` for field errors without relying only on thrown exceptions.

### `loading.tsx` vs inline `<Suspense>`

- `loading.tsx` — automatic boundary for the whole segment (easy skeletons)  
- inline `<Suspense>` — finer granularity (page chrome vs table only)  

Avoid layout shift: reserve skeleton dimensions matching final UI.

## 2. Real-World Engineering Scenario

SprintDesk board: column fetch failed and blanked the entire `/app` layout because `error.tsx` sat too high. Moving the boundary under `board/error.tsx` kept navigation chrome alive; column used a retry affordance. Action validation returned typed errors so the form stayed filled-in.

## 3. Production-Grade Code Example

```tsx
// app/board/loading.tsx
export default function Loading() {
  return <div className="skeleton h-64 w-full" aria-busy="true" />
}
```

```ts
// action error contract
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
```

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: `error.tsx` without `'use client'`

Build/runtime failure — reset needs client interactivity.

### ⚠️ Pitfall 2: Swallowing Server Action errors

Always surface user-visible messages; log `digest` for support.

### ⚠️ Pitfall 3: Skeleton CLS

Skeletons shorter than content shift layout — match min-heights.

### ⚠️ Pitfall 4: Using `redirect` / `notFound` incorrectly inside try/catch

In some versions special errors must rethrow — don’t catch-all and silence navigation errors.
