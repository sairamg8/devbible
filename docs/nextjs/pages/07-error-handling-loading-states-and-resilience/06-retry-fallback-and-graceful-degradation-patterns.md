---
sidebar_position: 6
title: "Retry, fallback, and graceful-degradation patterns; `notFound()` and `redirect()` inside error fl…"
sidebar_label: "Retry, fallback, and graceful-degradation patterns; `notFound()` and `redirect()` inside error fl…"
description: "Retry, fallback, and graceful-degradation patterns; `notFound()` and `redirect()` inside error flows."
---

# ▲ Retry, fallback, and graceful-degradation patterns; `notFound()` and `redirect()` inside error fl…

> **Syllabus chapter:** 7. Error Handling, Loading States, and Resilience  
> **Exact concept:** Retry, fallback, and graceful-degradation patterns; `notFound()` and `redirect()` inside error flows.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
