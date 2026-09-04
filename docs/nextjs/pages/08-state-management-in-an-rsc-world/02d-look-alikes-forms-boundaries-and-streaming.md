---
title: "The other three look-alikes are a form's own result, a client ancestor that owns behaviour while the server keeps the data, and a promise handed across the boundary instead of a fetch after mount"
sidebar_label: "02d · Look-alikes: forms, boundaries, streaming"
sidebar_position: 9
description: "useActionState for a result that is a message rather than state, lifting the client boundary so client leaves stay leaves without their data entering the bundle, and streaming a pending promise into Suspense instead of fetching on the client."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) (`lastUpdated: 2026-08-25`), [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`), React's [`'use client'`](https://react.dev/reference/rsc/use-client) reference and the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2 · `zod` 4.4.3. Documentation-verified; **no sandbox run**.

**[02c](02c-look-alikes-url-cookies-and-optimistic.md) covered the three containers that already exist — the address bar, the cookie jar and an in-flight Action. The three below are structural rather than container-shaped, and the middle one is the highest-leverage pattern in this chapter and the one people most often do not know they have. A Client Component can wrap server-rendered content without importing it, because a rendered element is serializable data — which means "these two client leaves need a common owner" almost never requires a store, and never requires the data to leave the server.**

## 4 · `useActionState` — a form's result is not global state

An action's return value is a message, not state: it is delivered once, has no authority and nothing re-derives it. `useActionState` gives it exactly the lifetime it deserves — the form's.

```tsx filename="app/board/new-task-form.tsx"
'use client'

import { useActionState } from 'react'
import { createTask, type CreateTaskState } from './actions'

const initial: CreateTaskState = { ok: false, errors: {} }

export function NewTaskForm() {
  const [state, formAction, pending] = useActionState(createTask, initial)

  return (
    <form action={formAction}>
      <input name="title" aria-label="Title" aria-invalid={!!state.errors.title} />
      {state.errors.title && <p role="alert">{state.errors.title}</p>}
      <button type="submit" disabled={pending}>Create</button>
    </form>
  )
}
```

```ts filename="app/board/actions.ts"
'use server'

import { z } from 'zod'
import { updateTag } from 'next/cache'

const schema = z.object({ title: z.string().min(1, 'Title is required').max(200) })

export type CreateTaskState = { ok: boolean; errors: { title?: string } }

export async function createTask(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const parsed = schema.safeParse({ title: formData.get('title') })
  if (!parsed.success) {
    return { ok: false, errors: { title: z.treeifyError(parsed.error).properties?.title?.errors[0] } }
  }
  await db.task.create({ data: parsed.data })
  updateTag('board')
  return { ok: true, errors: {} }
}
```

If a validation error needs to be visible somewhere other than the form, the thing you actually want is usually a redirect or a re-render, not a store holding an error string.

## 5 · Lifting the boundary so client leaves stay leaves

This is the highest-leverage pattern in the chapter and the one people do not know they have. A Client Component can wrap server-rendered content without importing it, because a rendered element is serializable data:

> *"A rendered React element can cross the boundary because it is serializable data. Passing rendered output as `children` lets a Server Component nest inside a Client Component without importing the Server Component's code into the client graph."*

So when two client leaves need to share state, you do not need a store — you need a client ancestor that is not also a data-fetching ancestor.

```tsx filename="app/board/page.tsx"
import { SelectionProvider } from './selection-provider' // 'use client'
import { BulkBar } from './bulk-bar'                     // 'use client'
import { TaskCard } from './task-card'                   // Server Component

export default async function Page() {
  const tasks = await listTasks()
  return (
    <SelectionProvider>
      <BulkBar />
      <ul>
        {tasks.map((t) => (
          <li key={t.id}>
            <TaskCard task={t} />
          </li>
        ))}
      </ul>
    </SelectionProvider>
  )
}
```

`BulkBar` and the selection checkbox inside `TaskCard` now share a client ancestor, so `useState` or a Context in `SelectionProvider` is sufficient — and `TaskCard`, with all its server data access, never enters the client bundle. The docs' owner/parent explanation is the mechanism: *"Because `Cart`'s owner is a Server Component, `Cart` renders on the server. `Modal` is only the parent, so `Modal` receives `Cart`'s output to place but not its code to run."*

⚠️ The checkbox itself must still be a Client Component, and it must be *rendered by* `TaskCard` — which is a Server Component, so it can render a client child, but cannot pass it a handler. The handler comes from the Context, read inside the checkbox.

```tsx filename="app/board/select-checkbox.tsx"
'use client'

import { useSelection } from './selection-provider'

export function SelectCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useSelection() // handler comes from context, not props
  return (
    <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} aria-label="Select task" />
  )
}
```

## 6 · A streamed promise instead of a client fetch

The last look-alike is "this data is slow, so it has to be fetched on the client with a loading state". A promise is on React's serializable list, so the request starts on the server and the loading state is a `<Suspense>` fallback.

```tsx filename="app/board/page.tsx"
import { Suspense } from 'react'
import { getSlowInsights } from '@/data/insights'
import { InsightsPanel } from './insights-panel'

export default function Page() {
  const insights = getSlowInsights() // started during the server render, not awaited
  return (
    <>
      <h1>Board</h1>
      <Suspense fallback={<p>Crunching numbers…</p>}>
        <InsightsPanel insights={insights} />
      </Suspense>
    </>
  )
}
```

> *"Because the request starts before the client runs, the Client Component does not need to fetch the same data after mount. You may still need to start a fetch in the browser when the requested data depends on client-only state or user interaction."*

That last sentence is the honest boundary: client-side fetching is correct when the *inputs* only exist on the client.

## Gotchas

**★ Symptom: the selection Context provider was added to `page.tsx` and every navigation clears the selection.** Cause: a page unmounts on navigation; a layout does not. Fix: put the provider in the layout shared by the routes the selection must survive.

```tsx filename="app/board/layout.tsx"
import { SelectionProvider } from './selection-provider'

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <SelectionProvider>{children}</SelectionProvider>
}
```

**★ Symptom: a Server Component tries to hand `onSelect` to a client child and the build or the request throws.** Cause: *"Passing a function as a prop from a Server Component to a Client Component throws."* Fix: do not pass the handler — let the client child read it from a Context supplied by a client ancestor, which is exactly what pattern 5 is for.

```tsx filename="app/board/task-card.tsx"
import { SelectCheckbox } from './select-checkbox'

// Server Component: renders a client child, passes only serializable data.
export function TaskCard({ task }: { task: TaskDTO }) {
  return (
    <article>
      <SelectCheckbox id={task.id} />
      <h3>{task.title}</h3>
    </article>
  )
}
```

**★ Symptom: `useActionState` state resets when the surrounding server data revalidates.** Cause: the form component was keyed on something derived from the server data, so a new key remounted it and discarded the action result along with everything else. Fix: key the form on a stable identity.

```tsx
// 🔴 <NewTaskForm key={board.updatedAt} />
// ✅
<NewTaskForm key={board.id} />
```

**★ Symptom: passing a promise to a Client Component produces an unhandled rejection that crashes the route instead of hitting an error boundary.** Cause: the promise was created in the server render and rejected before any consumer awaited it. Fix: make sure the promise is consumed inside a boundary that can catch it — a `<Suspense>` for the pending state, and an `error.tsx` in the same segment for the rejection.

```tsx filename="app/board/error.tsx"
'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert">
      <p>Insights failed to load.</p>
      <button type="button" onClick={reset}>Retry</button>
    </div>
  )
}
```

## Interview questions

**★ Two client components need to share selection state and their common ancestor is a Server Component. Why is a Context provider not "just a store with extra steps"?**
Because of where it sits and what it holds. The provider is a Client Component that takes `children`, so the server-rendered subtree crosses as rendered output and never enters the client bundle — the data stays on the server while the *interaction* state moves to the client. A store, by contrast, is usually introduced together with the data it coordinates, which is how the duplication starts. The provider also has a lifetime you can point at: it dies when its tree unmounts, so putting it in a layout versus a page is an explicit decision about how long the selection lives, rather than an accident.

**★ When is client-side fetching genuinely correct in the App Router?**
When the inputs to the request do not exist on the server. The documentation draws the line in one sentence: the client does not need to fetch after mount because the request started before it ran, *"You may still need to start a fetch in the browser when the requested data depends on client-only state or user interaction."* Typeahead driven by keystrokes you are not putting in the URL, a map query derived from the viewport, anything keyed on `IntersectionObserver` or device state. Everything else — including "it is slow" — is better served by starting the request during the server render and streaming it into a `<Suspense>` boundary.

**★ A Server Component cannot pass a handler to a client child. So how does a server-rendered card get a working checkbox?**
By rendering the client child and letting the child obtain its handler from somewhere on the client. A Server Component may render a Client Component and pass it serializable props — an id, a label, a boolean — it simply cannot pass the function. The function comes from a Context that a client ancestor established. This is why "lift the boundary" and "use a Context" are the same move seen from two angles: you are creating a client ancestor whose only job is to own behaviour, while all the data fetching stays above it on the server.

**★ Why does the docs' advice to render providers "as deep as possible" conflict with putting a provider in a layout, and how do you resolve it?**
It does not conflict, because "deep" means *deep in the module graph*, not *low in the route tree*. A provider in `app/board/layout.tsx` is high in the route tree — which is what gives the selection a lifetime spanning `/board` and `/board/task/123` — but it is still shallow in what it drags into the client bundle, because it accepts `children` and imports nothing else. The thing to avoid is a provider that also imports the data components it wraps, since those get pulled across the boundary with it. Choose the route position by required lifetime and the import surface by bundle cost; they are independent decisions.

---

← [02c · Look-alikes: URL, cookies, optimistic](02c-look-alikes-url-cookies-and-optimistic.md) · [Chapter 8 overview](01-explanation.md) · Next → [02e · The cost of getting it wrong](02e-the-cost-of-getting-it-wrong.md)
