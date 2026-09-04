---
title: "useState ignores its argument after the first render and router.refresh() deliberately preserves client state — put those two documented behaviours together and a mirror of server data freezes forever, silently"
sidebar_label: "01e · Stale mirrors and drift"
sidebar_position: 103
description: "The three remaining ways the split goes wrong: a useState initialised from a server prop that never updates, a client store seeded from server data that drifts in four distinct ways, and 'use client' at the root layout — each with the fix shown in code and the trade-off named."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [`useState`](https://react.dev/reference/react/useState), [`useOptimistic`](https://react.dev/reference/react/useOptimistic), [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router), the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions) and [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2. Documentation-verified; **no sandbox run**.

**[01d](01d-request-scope-versus-process-scope.md) covered the failure that leaks data between users. These three leak *time* instead: they make the UI show a value that was true once. A `useState` initialised from a prop keeps its mount-time value for the life of the component, because React ignores the initial argument after the first render and the App Router's refresh path is explicitly designed *not* to unmount your client tree. A store seeded from server data drifts in four separate ways, only one of which an effect dependency array can catch. And `'use client'` at the top of a root layout is not a bug at all — it is an architecture change that quietly converts the app into an SPA. Each one below with the mechanism, the fix in code, and where the fix costs you something.**

## Failure 2 — `useState` initialised from server data, frozen forever

```tsx filename="app/board/task-title-editor.tsx"
'use client'

import { useState } from 'react'

export function TaskTitleEditor({ task }: { task: TaskDTO }) {
  // 🔴 The argument is read once, on mount, and never again.
  const [title, setTitle] = useState(task.title)
  return <input value={title} onChange={(e) => setTitle(e.target.value)} />
}
```

React documents the mechanism in one sentence:

> *"This argument is ignored after the initial render."*
> — [`useState`](https://react.dev/reference/react/useState)

Now add the App Router half. When a Server Action revalidates and the route re-renders, the new payload is merged into the existing tree:

> *"The client will merge the updated React Server Component payload without losing unaffected client-side React (e.g. `useState`) or browser state (e.g. scroll position)."*

So the component does not unmount, `useState` is not re-initialised, and `task.title` arrives updated while `title` stays at whatever it was on mount. Two people editing the same task now see different titles and neither is warned. This is not a race condition — it is deterministic and permanent for the life of the mounted component.

**Fix A, the one you want most of the time: delete the state.** React's own guidance:

> *"If the value you need can be computed entirely from the current props or other state, remove that redundant state altogether."*

An uncontrolled input with a Server Action needs no mirror at all:

```tsx filename="app/board/task-title-editor.tsx"
import { renameTask } from './actions'

// Not a Client Component at all. The DOM holds the draft; the action holds the truth.
export function TaskTitleEditor({ task }: { task: TaskDTO }) {
  return (
    <form action={renameTask.bind(null, task.id)}>
      <input name="title" defaultValue={task.title} aria-label="Task title" />
      <button type="submit">Rename</button>
    </form>
  )
}
```

**Fix B, when you genuinely need a controlled input:** make the identity of the component depend on the server value, so a change from the server remounts it and re-runs the initialiser.

> *"You can **reset a component's state by passing a different `key` to a component.**"*

```tsx filename="app/board/task-card.tsx"
import { TaskTitleEditor } from './task-title-editor'

export function TaskCard({ task }: { task: TaskDTO }) {
  // A new server value ⇒ a new key ⇒ a fresh component ⇒ a fresh initial state.
  return <TaskTitleEditor key={`${task.id}:${task.updatedAt}`} task={task} />
}
```

⚠️ Fix B is a trade, not a free win: remounting discards *everything* in that subtree, including an in-progress edit and the cursor position. Use it where the server value winning is the desired behaviour — a settings panel, a form that reflects an admin change — and not where the user is mid-sentence. If both must hold, the correct shape is an explicit conflict: keep the draft, show the incoming server value beside it, and let the user choose.

```tsx filename="app/board/task-title-editor.tsx"
'use client'

import { useState } from 'react'

export function TaskTitleEditor({ task }: { task: TaskDTO }) {
  const [draft, setDraft] = useState<string | null>(null) // null ⇒ no local edit in progress
  const conflicted = draft !== null && draft !== task.title

  return (
    <div>
      <input
        value={draft ?? task.title}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Task title"
      />
      {conflicted && (
        <button type="button" onClick={() => setDraft(null)}>
          Discard my edit and use “{task.title}”
        </button>
      )}
    </div>
  )
}
```

## Failure 3 — a client store duplicating server state, and the drift

```tsx filename="app/board/board-client.tsx"
'use client'

import { useEffect } from 'react'
import { useBoardStore } from './board-store-provider'

// 🔴 Seeding a store from props. Two authorities, one of which never hears about changes.
export function BoardClient({ tasks }: { tasks: TaskDTO[] }) {
  const setTasks = useBoardStore((s) => s.setTasks)
  useEffect(() => {
    setTasks(tasks)
  }, [tasks, setTasks])

  const stored = useBoardStore((s) => s.tasks)
  return <ul>{stored.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
}
```

This looks defensible — the effect even lists `tasks` as a dependency. It drifts anyway, in at least four ways:

1. **A revalidation with a stale-while-revalidate profile ships no new data in the action's response.** The documented behaviour: *"`revalidateTag`: stale-while-revalidate refresh of a tag with a cache-life profile. Subsequent reads get the stale value while a fresh fetch happens in the background, so the action's own re-render does **not** wait for the new data."* The store is re-seeded with the *stale* rows, and nothing seeds it again when the background fetch lands.
2. **A second component mutates the store optimistically** and there is no reconciliation step, so the store's version of a row survives the next re-seed only if the effect happens to run.
3. **The `stale` timer** keeps the browser from asking the server at all, so `tasks` does not change and the effect does not fire.
4. **Two subtrees mount the same store at different times** and seed it with payloads from different renders.

**Fix: the store holds only what the server cannot know.** Server data goes down as props and is rendered directly; the store holds selection, drag position, panel open-ness — values for which question 5 in the [decision procedure](01b-the-categories-the-table-omits.md#the-decision-procedure) is the first `yes`.

```tsx filename="app/board/board-client.tsx"
'use client'

import { useBoardStore } from './board-store-provider'

export function BoardClient({ tasks }: { tasks: TaskDTO[] }) {
  const selected = useBoardStore((s) => s.selected)
  const toggle = useBoardStore((s) => s.toggle)

  // `tasks` is read straight from props: one authority, always current.
  return (
    <ul>
      {tasks.map((t) => (
        <li key={t.id} data-selected={selected.has(t.id)}>
          <button type="button" onClick={() => toggle(t.id)}>{t.title}</button>
        </li>
      ))}
    </ul>
  )
}
```

If the ids in the store can go stale — a selected task gets deleted server-side — derive rather than synchronise:

```tsx
const liveSelection = tasks.filter((t) => selected.has(t.id))
```

A store of ids intersected with the current server list is self-healing. A store of rows is not.

## Failure 4 — `'use client'` at the top of the root layout

Not a crash; a silent architecture change. Every module the root layout imports and every component it renders directly joins the client module graph, so the tree below it loses the ability to be a Server Component tree, and the app becomes an SPA that happens to be served by Next.js. It usually starts as "the provider needs to be at the root".

**Fix: keep the layout a Server Component and let the provider take `children`.**

```tsx filename="app/layout.tsx"
import { DensityProvider } from './board/theme-provider'
import { cookies } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const density = (await cookies()).get('density')?.value === 'compact' ? 'compact' : 'comfortable'
  return (
    <html>
      <body>
        <DensityProvider value={density}>{children}</DensityProvider>
      </body>
    </html>
  )
}
```

`children` arrives as already-rendered output, so nothing below the provider is pulled into the client bundle — the mechanism from [01b](01c-the-rsc-payload-is-the-transport.md).

## Gotchas

**★ Symptom: a controlled input shows the pre-mutation value after a Server Action completes, and refreshing the page fixes it.** Cause: `useState(task.title)` ignores its argument after the first render, and the router merges a new payload without unmounting the component. Fix: remove the mirror, or key the component on the server value.

```tsx
// ✅ no mirror
<input name="title" defaultValue={task.title} />

// ✅ or force a fresh instance when the server value changes
<TaskTitleEditor key={`${task.id}:${task.updatedAt}`} task={task} />
```

**★ Symptom: after a mutation the list updates for a second and then reverts.** Cause: an optimistic write into a long-lived store, followed by a re-seed from a payload that was rendered before the mutation landed — commonly because the invalidation used a stale-while-revalidate profile and the action's own re-render did not wait for fresh data. Fix: for an in-flight mutation use `useOptimistic`, whose state is scoped to the Action and released automatically; see **06 · useOptimistic and useActionState** *(not written yet)*, and pick the invalidation function deliberately using [10b](10b-refresh-against-the-alternatives.md).

```tsx
'use client'
import { useOptimistic } from 'react'

const [shown, addOptimistic] = useOptimistic(tasks)
// "Optimistic state only renders while an Action is in progress, otherwise value is rendered."
```

**★ Symptom: a `useEffect` that syncs props into a store runs on every navigation and re-seeds stale data.** Cause: the effect's dependency is a prop that is reconstructed each render, and the effect has no way to know whether the payload it came from is newer than what the store holds. Fix: stop syncing. Render from props and keep only non-server values in the store.

```tsx
// 🔴 useEffect(() => setTasks(tasks), [tasks, setTasks])
// ✅ render props directly; store holds ids only
const selected = useBoardStore((s) => s.selected)
return <ul>{tasks.map((t) => <Row key={t.id} task={t} selected={selected.has(t.id)} />)}</ul>
```

**★ Symptom: selecting a row, then deleting it in another tab, leaves a "1 selected" badge that no longer corresponds to anything.** Cause: the store's ids outlived the server rows they referred to, and nothing prunes them. Fix: derive the live selection by intersecting with the current server list instead of trusting the stored set.

```tsx
const liveSelection = tasks.filter((t) => selected.has(t.id))
const badge = liveSelection.length // self-healing; no cleanup code, no effect
```

**★ Symptom: adding `'use client'` to the root layout to make a provider work, and the whole app's bundle triples.** Cause: the directive pulls every import and every directly rendered component of that file into the client graph. Fix: keep the layout on the server and give the provider a `children` prop, so the subtree crosses as rendered output.

```tsx filename="app/layout.tsx"
// no directive here
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body><Providers>{children}</Providers></body></html>
}
```

**★ Symptom: a hydration mismatch warning on a component that reads a preference.** Cause: the value was read from `localStorage` or `window` during render, so the server render and the browser render disagree — a Client Component renders in *both* places. Fix: make the server able to read the value, which for a preference means a cookie, not browser storage.

```tsx filename="app/layout.tsx"
import { cookies } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const density = (await cookies()).get('density')?.value ?? 'comfortable'
  return <html data-density={density}><body>{children}</body></html>
}
```

## Interview questions

**★ A `useState` initialised from a prop shows stale data after a Server Action. Walk through why, precisely.**
Two documented behaviours compose. React's: the initial argument to `useState` *"is ignored after the initial render"*. The router's: a server-driven refresh merges the new RSC payload *"without losing unaffected client-side React (e.g. `useState`)"*. So the component does not unmount, the initialiser does not run again, and the state keeps its mount-time value while the prop beside it updates. Nothing errors and nothing warns. The remedy is to remove the redundant state where the prop can be rendered directly, and to key the component on the server value where a controlled input is genuinely required — accepting that keying discards in-progress edits.

**★ When is it correct to seed a client store from server data?**
When the store's contents stop being a function of server data the moment it is seeded — a multi-step wizard pre-filled from the user's profile, a diagram editor loaded from a saved document, an offline draft. In each case the browser becomes authoritative on first interaction and the server copy is history, not truth. It is wrong whenever the server remains authoritative, because then you have two authorities and no invalidation protocol, and the drift will be silent. The distinguishing question is not "does the data come from the server" but "after seeding, whose copy wins".

**★ Why does storing ids in a client store survive server changes better than storing rows?**
Because an id is a reference and a row is a copy. Rendering a row from a store means rendering a value nothing refreshes; rendering it from props means rendering the current payload. Ids let you intersect with the live list at render time — `tasks.filter(t => selected.has(t.id))` — so a deleted row simply drops out of the selection with no cleanup code, no effect, and no chance of showing a stale title. This is the same reason normalised caches keep entities separate from the lists that reference them.

**★ You inherit a codebase with `'use client'` at the top of `app/layout.tsx`. What does that actually cost, and how do you unwind it?**
It costs the Server Component model for the directly-rendered tree beneath it: every module the layout imports and every component it renders directly is compiled into the client bundle, so data fetching moves back to the browser, secrets can no longer be read during render, and the static shell shrinks to whatever the layout itself emits. You unwind it by removing the directive and moving each client-only concern into its own component — usually one provider that accepts `children`. Because `children` crosses as already-rendered output rather than an import, everything below it returns to the server graph without being touched.

**★ How do you tell a legitimate optimistic update from a store that is about to drift?**
By its lifetime. `useOptimistic` state exists only while an Action is in progress — *"Optimistic state only renders while an Action is in progress, otherwise `value` is rendered"* — so it cannot outlive the round trip, and when the action resolves the component renders whatever the server actually produced. A hand-rolled optimistic write into a long-lived store has no such boundary: nothing releases it, so it persists until some later code path happens to overwrite it, and if the invalidation used a stale-while-revalidate profile that overwrite may carry pre-mutation data.

---

← [01d · Request vs process scope](01d-request-scope-versus-process-scope.md) · [Chapter 8 overview](01-explanation.md) · Next → [02 · When RSC data flow is enough](02-when-rsc-data-flow-is-enough.md)
