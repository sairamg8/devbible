---
title: "Three of the six cases that get filed as \"we need a state library\" are already solved by the address bar, the cookie jar and one React hook — and each answer removes a store rather than shrinking one"
sidebar_label: "02c · Look-alikes: URL, cookies, optimistic"
sidebar_position: 105
description: "searchParams as the state container you already have, cookies as the preference container, and useOptimistic as pending UI with a guaranteed end — with the failure modes of each shown in code."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`lastUpdated: 2026-06-09`), [`useOptimistic`](https://react.dev/reference/react/useOptimistic), the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag) and [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2 · `zod` 4.4.3. Documentation-verified; **no sandbox run**.

**Most of the cases that get filed as "we need a state library" are one of six patterns that have a framework-native answer, and each answer removes a store rather than replacing it with a smaller one. This page is those six in code: the URL as the state container, the cookie as the preference container, `useOptimistic` for pending UI, `useActionState` for form results, lifting the client boundary so client leaves stay leaves, and a streamed promise instead of a client-side fetch. If your case is on this list, adding a store is a net loss — you pay the duplication, the payload, the bundle and the invalidation protocol enumerated in [02e](02e-the-cost-of-getting-it-wrong.md) for something the framework already does.**

## 1 · `searchParams` — the state container you already have

Filters, sort, page, tab, selected entity, date range. Anything a colleague should be able to reproduce by pasting a link is URL state, and URL state is read on the server, which means the value and the data derived from it arrive in the same render.

```tsx filename="app/board/page.tsx"
import { listTasks } from '@/data/tasks'
import { Filters } from './filters'

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status = 'open', q = '' } = await searchParams
  const tasks = await listTasks({ status, q })

  return (
    <>
      <Filters status={status} q={q} />
      <ul>{tasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
    </>
  )
}
```

The update mechanism can be zero JavaScript:

```tsx filename="app/board/filters.tsx"
export function Filters({ status, q }: { status: string; q: string }) {
  return (
    <form method="get">
      <input name="q" defaultValue={q} aria-label="Search tasks" />
      <select name="status" defaultValue={status}>
        <option value="open">Open</option>
        <option value="done">Done</option>
      </select>
      <button type="submit">Apply</button>
    </form>
  )
}
```

What you get for free that a store never gives you: the back button, a reloadable page, a shareable link, a bookmarkable view, and a server render that already knows the answer. What it costs: the value is public, capped by URL length, and every change is a navigation. Ergonomics — typed params, batching several updates into one navigation — belong to **03 · URL as state** *(not written yet)*.

## 2 · Cookies — the preference container you already have

Theme, density, locale, sidebar collapsed, "don't show this again", accepted terms. Anything that describes the *viewer* rather than the *view*, and must be right in the first byte of HTML.

```ts filename="app/actions/preferences.ts"
'use server'

import { cookies } from 'next/headers'

export async function setDensity(density: 'compact' | 'comfortable') {
  const store = await cookies()
  store.set('density', density, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  // No invalidation call: the cookie write itself returns the re-rendered route.
}
```

```tsx filename="app/board/density-toggle.tsx"
import { setDensity } from '@/app/actions/preferences'

export function DensityToggle({ current }: { current: 'compact' | 'comfortable' }) {
  const next = current === 'compact' ? 'comfortable' : 'compact'
  return (
    <form action={setDensity.bind(null, next)}>
      <button type="submit">Switch to {next}</button>
    </form>
  )
}
```

Not a Client Component anywhere in that flow. The read side is `cookies()` in a layout; the write side is a Server Action; the re-render rides the action's own response, and *"The UI is not unmounted"*, so anything genuinely client-side on the page keeps its state.

## 3 · `useOptimistic` — pending UI without a cache

The single most common reason people reach for a client data library is "we need the row to appear before the server confirms". React ships that, and its scope is exactly right:

> *"When the setter is called inside an Action, `useOptimistic` will trigger a re-render to show that state while the Action is in progress. Otherwise, the `value` passed to `useOptimistic` is returned."*
> — [`useOptimistic`](https://react.dev/reference/react/useOptimistic)

> *"Optimistic state only renders while an Action is in progress, otherwise `value` is rendered."*

```tsx filename="app/board/task-list.tsx"
'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleTask } from './actions'

type Task = { id: string; title: string; done: boolean }

export function TaskList({ tasks }: { tasks: Task[] }) {
  const [shown, showOptimistic] = useOptimistic(tasks)
  const [, startTransition] = useTransition()

  function toggle(id: string) {
    startTransition(async () => {
      showOptimistic((current) =>
        current.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      )
      await toggleTask(id) // Server Action; invalidates and re-renders
    })
  }

  return (
    <ul>
      {shown.map((t) => (
        <li key={t.id}>
          <button type="button" onClick={() => toggle(t.id)}>
            {t.done ? '✓' : '○'} {t.title}
          </button>
        </li>
      ))}
    </ul>
  )
}
```

Three properties make this strictly better than a hand-rolled optimistic write into a store. The optimistic value **cannot outlive the action**, so there is no cleanup path to forget. On failure the component falls back to whatever the parent last passed — documented as: if the Action throws, React renders with whatever `value` currently is, and since the parent only updates `value` on success, the UI shows what it showed before. And the setter is only legal inside an Action: *"The `set` function must be called inside an Action. If you call the setter outside an Action, React will show a warning and the optimistic state will briefly render."* Depth on this belongs to **06 · useOptimistic and useActionState** *(not written yet)*.

## Gotchas

**★ Symptom: a `<form method="get">` filter works, and the resulting URL has a stray `?` or drops a param that was already there.** Cause: a GET form replaces the whole query string with its own fields; anything not represented as an input is gone. Fix: carry the params you want to preserve as hidden inputs.

```tsx filename="app/board/filters.tsx"
export function Filters({ status, q, sort }: { status: string; q: string; sort: string }) {
  return (
    <form method="get">
      <input type="hidden" name="sort" value={sort} />
      <input name="q" defaultValue={q} aria-label="Search tasks" />
      <select name="status" defaultValue={status}>
        <option value="open">Open</option>
        <option value="done">Done</option>
      </select>
      <button type="submit">Apply</button>
    </form>
  )
}
```

**★ Symptom: an optimistic update flashes and then reverts, even though the mutation succeeded.** Cause: the optimistic state is released when the Action ends, and what renders next is whatever the parent passes — if the invalidation used a stale-while-revalidate profile, that is pre-mutation data. Fix: pair `useOptimistic` with an invalidation that makes the action's own re-render wait.

```ts filename="app/board/actions.ts"
'use server'

import { updateTag } from 'next/cache'

export async function toggleTask(id: string) {
  await db.task.update({ where: { id }, data: { done: { set: true } } })
  updateTag(`board`) // "The next request will wait to fetch fresh data"
}
```

**★ Symptom: `useOptimistic`'s setter warns and the optimistic value appears for a frame and vanishes.** Cause: the setter was called outside an Action — a bare `onClick` handler is not one. Fix: wrap the work in `startTransition`, or call the setter from inside a `<form action={…}>` submission.

```tsx
'use client'

import { useOptimistic, useTransition } from 'react'

const [shown, showOptimistic] = useOptimistic(tasks)
const [, startTransition] = useTransition()

// 🔴 onClick={() => showOptimistic(next)}
// ✅
startTransition(async () => {
  showOptimistic(next)
  await toggleTask(id)
})
```

**★ Symptom: a cookie preference is written by a Server Action and the page below still renders the old value.** Cause: the cookie is set on the *outgoing* response, so a component that already rendered in this pass cannot see it — the new value applies to the re-render that the action's response carries. Fix: nothing in the action; make sure the reader is a Server Component in the re-rendered scope rather than a client component holding a mirror.

```tsx filename="app/layout.tsx"
import { cookies } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const density = (await cookies()).get('density')?.value ?? 'comfortable'
  return <html data-density={density}><body>{children}</body></html>
}
```

## Interview questions

**★ Why is the URL a better state container than a store for a filter, beyond "it is shareable"?**
Because it moves the value to the side of the boundary that needs it. A filter in a store is known only after hydration, so the server renders a default and the browser corrects it; a filter in the URL is an input to the server render, so the first HTML is already filtered. You also inherit four behaviours you would otherwise implement: back and forward, reload, bookmark, and a link a colleague can paste. And it removes a synchronisation problem entirely — there is one copy of the value, held by the browser's address bar, which every render reads fresh.

**★ What exactly does `useOptimistic` give you that a `useState` optimistic update does not?**
A guaranteed end. The optimistic value only renders while an Action is in progress; when the Action settles, React renders whatever `value` currently is, so success shows server truth and failure shows the pre-action UI with no rollback code. A `useState` optimistic write has no such boundary: nothing releases it, so you write the rollback yourself in a `catch`, and you write it again for every code path that can fail. The setter also refuses to work outside an Action, which turns "we forgot to wrap this in a transition" from a subtle bug into a warning.

**★ Why does setting a cookie in a Server Action need no invalidation call, when updating a database row does?**
Because the cookie *is* the request input the next render reads, and the framework knows the response changed it. The documented behaviour is that after a set or delete in a Server Function, Next.js *"can return both the updated UI and new data in a single server roundtrip"*, and the UI is not unmounted while doing so. A database row is different: the render reads it through a data function that may be inside a cached scope, and the framework has no way to know which cache entries your write invalidated. That is exactly what the tag is for. The asymmetry is not inconsistency — it is the difference between changing an input to the render and changing something the render happens to have cached.

**★ A product manager wants a filter that is remembered per user across sessions but not shareable. URL or cookie?**
Cookie, and the giveaway is "per user, across sessions": that is a property of the viewer, and it must be right in the first byte of HTML on a cold load or the list will visibly re-sort after hydration. The URL is the wrong container because the requirement explicitly excludes shareability, and a URL that is rewritten on load to match a remembered preference breaks the back button and makes shared links behave differently for different people. The pattern is a cookie holding the default and `searchParams` overriding it when present — the server reads both and the URL wins, so a shared link still does what the sender saw.

---

← [02b · The symptom that lies](02b-the-symptom-that-lies.md) · [Chapter 8 overview](01-explanation.md) · Next → [02d · Look-alikes: forms, boundaries, streaming](02d-look-alikes-forms-boundaries-and-streaming.md)
