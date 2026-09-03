---
title: "The SprintDesk routes, the createTask Server Action and the JSON Route Handler — where the two Suspense boundaries go, and why a hidden form field is re-validated on the server before anything is written"
sidebar_label: "06b · Routes, action and handler"
sidebar_position: 26
description: "Part two of the chapter 4 milestone: generateStaticParams for team slugs, a board page with two deliberate Suspense boundaries, a Server Action that revalidates by tag, the progressive-enhancement form, and a Route Handler that shares the cached read."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Glossary](https://nextjs.org/docs/app/glossary) (docs `lastUpdated` 2026-08-25), [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated` 2026-08-25) and [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**[06](06-project-milestone-scaffold-sprintdesk.md) built `lib/data/` — a real asynchronous store and a cached, tagged read. This page builds everything under `app/`: the team segment with its enumerated params, the board page and the two boundaries that decide how much of it prerenders, the Server Action that writes a task and invalidates the tag, and one Route Handler that reads through the same cache the page does. Two details in here are corrections rather than choices, and both are places tutorials written before Next 15 are still wrong: a Route Handler's `params` is a promise, and a `GET` handler is not cached by default.**

## The team segment: enumerate the params so it prerenders

`generateStaticParams` runs before the layouts and pages it feeds, and its data calls are memoized across the `generate`-prefixed functions, layouts and pages of the same render — so listing the teams here and reading a team below does not double the work.

```tsx
// app/teams/[team]/layout.tsx
import { notFound } from 'next/navigation'
import { getTeam, listTeams } from '@/lib/data/teams'

export async function generateStaticParams() {
  const teams = await listTeams()
  return teams.map((team) => ({ team: team.slug }))
}

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ team: string }>
}) {
  const { team } = await params
  const record = await getTeam(team)
  if (!record) notFound()

  return (
    <section>
      <header>
        <h1>{record.name}</h1>
        <nav>
          <a href={`/teams/${team}/board`}>Board</a>
        </nav>
      </header>
      {children}
    </section>
  )
}
```

Awaiting `params` at the top of a layout is normally the structural mistake that stops a whole route prerendering. It is safe *here*, and only here, because every slug is enumerated: those params are build-time values. The moment teams come from a database with rows appearing between builds, this exact code becomes the bug — see the gotcha below for the rewrite.

## The board page and two boundaries that are not redundant

> *"Suspense boundaries define where the static shell ends and streaming begins"*

```tsx
// app/teams/[team]/board/page.tsx
import { Suspense } from 'react'
import { NewTaskForm } from './new-task-form'
import { TaskList } from './task-list'

export default async function BoardPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params
  return (
    <main>
      <NewTaskForm teamSlug={team} />
      <Suspense fallback={<p aria-live="polite">Loading tasks…</p>}>
        <TaskList teamSlug={team} />
      </Suspense>
    </main>
  )
}
```

```tsx
// app/teams/[team]/board/task-list.tsx
import { listTasks } from '@/lib/data/tasks'

export async function TaskList({ teamSlug }: { teamSlug: string }) {
  const tasks = await listTasks(teamSlug)
  if (tasks.length === 0) return <p>No tasks yet. Add the first one.</p>

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id} data-status={task.status}>
          {task.title}
        </li>
      ))}
    </ul>
  )
}
```

```tsx
// app/teams/[team]/board/loading.tsx
export default function Loading() {
  return <p aria-live="polite">Loading board…</p>
}
```

`loading.tsx` wraps the whole segment, covering the params resolution and the team lookup, and gives the route a prerenderable shell. The inner `<Suspense>` wraps only the task list, so the new-task form is present and interactive before a single task has resolved. Deleting either one costs something specific: without `loading.tsx` the segment has no shell; without the inner boundary the form waits on data it does not need.

## The Server Action, and the invalidation that makes it visible

```tsx
// app/teams/[team]/board/actions.ts
'use server'

import { revalidateTag } from 'next/cache'
import { insertTask, tasksTag } from '@/lib/data/tasks'
import { getTeam } from '@/lib/data/teams'

export type CreateTaskState = { error: string | null }

export async function createTaskAction(
  _prev: CreateTaskState,
  formData: FormData
): Promise<CreateTaskState> {
  const teamSlug = String(formData.get('teamSlug') ?? '')
  const title = String(formData.get('title') ?? '').trim()

  // A Server Action is a public endpoint. Validate the arguments where they land.
  if (!(await getTeam(teamSlug))) return { error: 'Unknown team.' }
  if (title.length < 3) return { error: 'A task needs at least three characters.' }
  if (title.length > 120) return { error: 'Keep the title under 120 characters.' }

  await insertTask(teamSlug, title)
  revalidateTag(tasksTag(teamSlug))
  return { error: null }
}
```

`revalidateTag` is doing two jobs at once, and the second is the one people forget: it invalidates the server-side cache entry *and* the browser's client cache, which the glossary lists it among the invalidators of. Without it the server would have fresh data and the user would keep seeing the tree they already navigated to.

The action mechanics themselves — the single-response model, and when `updateTag` is the better call — are in [01b](01b-server-actions-and-mutations.md); the hooks below and the fact that an action is a public endpoint are covered in depth in [01c](01c-server-action-hooks-optimistic-ui-and-security.md).

## The form, which works before it hydrates

```tsx
// app/teams/[team]/board/new-task-form.tsx
'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createTaskAction, type CreateTaskState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Adding…' : 'Add task'}
    </button>
  )
}

const initialState: CreateTaskState = { error: null }

export function NewTaskForm({ teamSlug }: { teamSlug: string }) {
  const [state, formAction] = useActionState(createTaskAction, initialState)

  return (
    <form action={formAction}>
      <input type="hidden" name="teamSlug" value={teamSlug} />
      <label htmlFor="title">New task</label>
      <input id="title" name="title" required minLength={3} maxLength={120} />
      <SubmitButton />
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  )
}
```

`SubmitButton` is a separate component because `useFormStatus` reads the status of its **parent** form; a hook call in `NewTaskForm` itself would be reading the status of a form it renders rather than one it is inside.

The `teamSlug` travels in a hidden field, which is precisely why the action re-validates it against `getTeam` before writing. Chapter 10 replaces that existence check with `assertTeamMember(userId, teamId)` in the data layer — the same idea, with an identity behind it.

## One Route Handler, which is not cached and should not be

```typescript
// app/api/teams/[team]/tasks/route.ts
import { listTasks } from '@/lib/data/tasks'
import { getTeam } from '@/lib/data/teams'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/teams/[team]/tasks'>
) {
  const { team } = await ctx.params
  if (!(await getTeam(team))) {
    return Response.json({ error: 'Unknown team' }, { status: 404 })
  }
  return Response.json({ tasks: await listTasks(team) })
}
```

Both surprises here are settled in [01d](01d-route-handlers-and-their-caching-model.md): `ctx.params` is a **promise** you must await, changed in `v15.0.0-RC`, and this handler is **not cached**, because `GET` handlers stopped being static by default in the same release. `RouteContext` is generated by `next dev`, `next build` or `next typegen`, so a clean checkout that has run none of the three does not have the type yet.

The handler calls `listTasks`, the same cached function the page uses. That is the entire reason the data layer is a module rather than two copies of a query: one cache entry, one tag, one place to change the lifetime.

## Gotchas

**★ Symptom: the task is written but appears only after a manual refresh.** Cause: the client cache still holds the RSC payload for the route you are already on. `revalidateTag` invalidates it, so the usual reality is that the call was skipped, or the string tagged and the string invalidated are not the same string. Fix: derive both from one function so they cannot drift.

```typescript
// lib/data/tasks.ts
export function tasksTag(teamSlug: string) { return `team-${teamSlug}-tasks` }
// read: tags: [tasksTag(slug)]     write: revalidateTag(tasksTag(slug))
```

**★ Symptom: after moving teams into a database, nothing on the route prerenders any more.** Cause: `await params` at the top of `TeamLayout`. For a param not produced by `generateStaticParams` that is runtime data, and awaiting it in a layout takes the entire subtree out of the static shell. Fix: keep the layout synchronous, pass the promise down, and await it inside a boundary.

```tsx
import { Suspense } from 'react'

export default function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ team: string }>
}) {
  return (
    <section>
      <Suspense fallback={<h1>Loading team…</h1>}>
        <TeamHeading params={params} />
      </Suspense>
      {children}
    </section>
  )
}

async function TeamHeading({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params
  const record = await getTeam(team)
  if (!record) notFound()
  return <h1>{record.name}</h1>
}
```

**★ Symptom: `RouteContext` is not defined and TypeScript will not compile the handler.** Cause: the helper is generated during `next dev`, `next build` or `next typegen`; a fresh clone that has run none of them has no generated types, which is why this reliably breaks CI before it breaks a laptop. Fix: run `next typegen` in CI before type-checking, or type the context by hand.

```typescript
export async function GET(_request: Request, { params }: { params: Promise<{ team: string }> }) {
  const { team } = await params
  return Response.json({ tasks: await listTasks(team) })
}
```

**★ Symptom: the action writes a task for a team the user never opened, or for a team that does not exist.** Cause: `teamSlug` came from a hidden input, and a Server Action is an HTTP endpoint reachable without the form that renders it. Fix: re-validate every identifier inside the action. The `getTeam` check is the minimum; the moment sessions exist it becomes an authorization check in the data layer, which is the version that survives a proxy matcher regression.

**★ Symptom: `useFormStatus` always reports `pending: false`.** Cause: it reads the status of the **parent** `<form>`, so calling it in the component that *renders* the form gives you nothing. Fix: extract the button into its own component rendered inside the form, as `SubmitButton` above.

**Symptom: submitting reloads the whole page.** Cause: usually not a bug. A form bound to a Server Action posts natively before hydration, which is the progressive-enhancement guarantee. Fix: verify with JavaScript disabled that it still creates a task. If it full-reloads *with* JavaScript enabled, the form is not inside a client boundary or the action is not passed as the `action` prop.

**Symptom: `notFound()` in the layout returns a 404 for a slug you know exists.** Cause: the seed file and the enumerated params disagree — `generateStaticParams` read `data/teams.json` at build, and you edited it afterwards without rebuilding. Fix: restart the dev server after editing seed data; in dev, `generateStaticParams` is called when you navigate to a route, so a stale module graph produces exactly this.

**Symptom: the API route returns tasks the page does not show, or the reverse.** Cause: the two paths are not reading through the same function, so only one is behind the tag. Fix: both must import `listTasks`; if a handler needs a different shape, transform the cached result rather than adding a second query.

**Symptom: the inner `<Suspense>` fallback never appears in development.** Cause: a local filesystem read resolves faster than the fallback is worth rendering, and development renders on demand regardless. Fix: do not place boundaries by observed dev timings. Place them by what must be present in the shell — here, the form — and confirm the shape from the production route table.

**Symptom: `revalidateTag` in the action does nothing because the read is not cached at all.** Cause: the page calls `listTasksUncached` directly, usually after a debugging session. Fix: the cached wrapper is the only export components should reach for; keeping the raw function's name explicit (`listTasksUncached`) is what makes this visible in review.

## Interview questions

**★ The board route has two Suspense boundaries. Why is that not redundant?**
They cover different things. `loading.tsx` wraps the whole segment, so it covers the params resolution and the team lookup and gives the route a prerenderable shell. The inner boundary wraps only the task list, so the new-task form renders and accepts input while tasks are still resolving. Collapsing them makes the form wait on data it does not need; deleting the inner one means the first paint of the board cannot accept input. Boundaries are placed by which parts of the page are honest without the data, never by how many feel tidy.

**★ Why is the team slug re-validated inside the Server Action when the form already put it in a hidden field?**
Because a hidden field is client-supplied data and the action is a network endpoint that exists independently of the form. Anything callable with attacker-chosen arguments must validate those arguments where it executes. In the scaffold that is a `getTeam` existence check; from chapter 10 onward it becomes a membership assertion inside the data layer — which is the version that still holds when a proxy matcher stops covering the action's POST, a documented failure mode rather than a hypothetical one.

**Why does the Route Handler share `listTasks` with the page instead of querying the store directly?**
So both read through the same cache and are invalidated by the same tag. A handler with its own query would keep serving stale JSON after a `revalidateTag` refreshed the page, and the divergence would only surface under a client-side poll — a bug that reproduces on a schedule rather than on demand. It also keeps the cache key, tag and lifetime decisions in one file, which is the same argument for defining a `fetch` loader once instead of copying its options to two call sites.

**★ Awaiting `params` at the top of a layout is described elsewhere as a mistake. Why is it acceptable here?**
Because every param is enumerated by `generateStaticParams`, so the values are build-time data rather than runtime data. The rule is not "never await params in a layout"; it is "params for a value the build does not know is runtime data, and awaiting runtime data at the top of a layout makes the whole subtree unprerenderable". The scaffold satisfies the precondition. The honest way to write it is to know why it is safe, because the day teams move to a database the same line silently becomes the most expensive line in the app.

**What does `revalidateTag` actually invalidate after this action runs?**
The server-side cache entry the tag is attached to, and the browser's client cache — the glossary lists `revalidateTag` among the things that invalidate it, alongside `revalidatePath`, `updateTag`, `router.refresh`, `cookies.set` and `cookies.delete`. That second half is what makes the new task appear without a reload. It does not reach a CDN or any cache in front of your deployment, which is why "it works locally and not in production" after a mutation is usually a layer question rather than a tag question.

**Why does `SubmitButton` exist as a separate component at all?**
Because `useFormStatus` reads the submission status of the parent `<form>` — a component can only observe a form it is rendered inside, not one it renders. Extracting the button is what lets a reusable submit control know whether *its* form is submitting without the form passing state down. It is also why the pattern generalises: the same `SubmitButton` works in every form in the app with no props.

---

← [06 · Milestone: scaffold SprintDesk](06-project-milestone-scaffold-sprintdesk.md) · [Chapter 4 overview](01-explanation.md) · Next → [06c · Acceptance criteria and the Cache Components variant](06c-acceptance-criteria-and-the-cache-components-variant.md)
