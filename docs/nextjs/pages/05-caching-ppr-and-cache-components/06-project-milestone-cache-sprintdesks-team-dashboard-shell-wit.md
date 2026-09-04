---
title: "Milestone: give SprintDesk's board a static shell that survives a cold serverless instance, and make creating a task update it without anyone waiting for the whole page"
sidebar_label: "06 · Milestone: cache the board shell"
sidebar_position: 12
description: "The chapter 5 project milestone — turning the scaffold's board route into a PPR shell with cached columns, a per-user hole, tag-based invalidation on mutation, and eight acceptance criteria that each fail in a diagnostic way."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching](https://nextjs.org/docs/app/getting-started/caching) (docs `lastUpdated` 2026-08-25), [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) (`lastUpdated` 2026-08-25), [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) (`lastUpdated` 2026-08-25) and the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions).
> Target: **Next.js 16.3.4**, App Router, Cache Components, Node >= 20.9. Documentation-verified; **no sandbox run**.

**The scaffold from [ch4 · 06](../04-data-fetching-in-the-app-router/06-project-milestone-scaffold-sprintdesk.md) renders a board and creates a task, and every byte of it waits for the server. This milestone converts it to the chapter's model: a static shell that a CDN can serve before your database is consulted, cached team data that every member of a team shares, one deliberate per-user hole, and a mutation that invalidates exactly the tag it should. The point of doing it carefully is that each step is *checkable* — the acceptance criteria below are written so that each one fails in a distinct way that tells you which mechanism is wrong, rather than as a list of things that should look fine.**

## What this milestone assumes and excludes

**Assumes:** the scaffold from [ch4 · 06](../04-data-fetching-in-the-app-router/06-project-milestone-scaffold-sprintdesk.md) and [06b](../04-data-fetching-in-the-app-router/06b-the-routes-the-action-and-the-route-handler.md), plus the `cacheComponents: true` conversion sketched at [06c](../04-data-fetching-in-the-app-router/06c-acceptance-criteria-and-the-cache-components-variant.md). If you have not done that conversion, do it first — this milestone starts where it stops.

**Excludes**, each landing later with its own milestone:

| Not yet | Where it lands |
|---|---|
| Real auth and a session-derived user | [ch10 · Auth.js and DAL authorization](../10-forms-authentication-and-security-hardening/06-project-milestone-sprintdesk-auth-authjs.md) |
| A real database and connection pooling | [ch15 · Drizzle + Neon](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) |
| Marketing pages and ISR'd public team pages | [ch6 · milestone](../06-ssg-isr-and-ssr-strategy/06-project-milestone-static-marketing-pages-isrd-public-team-pa.md) |
| `error.tsx` placement and retry affordances | [ch7](../07-error-handling-loading-states-and-resilience/01-explanation.md) |
| Tenant-scoped cache keys under a real tenancy model | [ch15 · 10e](../15-databases-apis-and-full-stack-patterns/10e-tenant-scoped-invalidation-and-prerendering.md) |

The session read here is deliberately a raw cookie, exactly as the scaffold has it. Replacing it with a real session is chapter 10's job, and the *shape* of the caching does not change when it happens — which is the point of doing it now.

## The target

```
app/teams/[team]/
├── layout.tsx          ← NOT async. Passes params down. This is the whole trick.
└── board/
    ├── page.tsx        ← static chrome + two boundaries
    ├── board-columns.tsx    cached, shared per team → in the shell
    ├── task-list.tsx        cached, shared per team → in the shell
    ├── notification-bell.tsx  reads cookies() → a hole
    ├── new-task-form.tsx    'use client'
    └── actions.ts           'use server' — createTask + updateTag
lib/data/
├── teams.ts
└── tasks.ts            ← owns the tag vocabulary
```

## Step 1 — one place that owns the tag names

Before caching anything, decide where tags come from. A tag written as a string literal in two files is a bug waiting for a typo, and [04](04-revalidation-time-based-isr.md) covers why a mismatched tag fails silently rather than loudly.

```typescript
// lib/data/tags.ts
import 'server-only'

export const teamTasksTag = (teamSlug: string) => `team-${teamSlug}-tasks`
export const teamColumnsTag = (teamSlug: string) => `team-${teamSlug}-columns`
export const teamTag = (teamSlug: string) => `team-${teamSlug}`
```

⚠️ Keep these short. Tags are capped at 256 characters and an over-long tag is **dropped at write time**, so the `revalidateTag` naming it silently does nothing forever. A slug-based tag is safe; a tag composed of several ids is where this bites, and [04](04-revalidation-time-based-isr.md) shows the hashing fix.

## Step 2 — cache what the whole team shares

Two reads qualify: the team record and the board's columns. Both are the same for every member, and both change rarely.

```typescript
// lib/data/teams.ts
import 'server-only'
import { readFile } from 'node:fs/promises'
import { cacheLife, cacheTag } from 'next/cache'
import path from 'node:path'
import { teamTag } from './tags'

export type Team = { slug: string; name: string }

const TEAMS_FILE = path.join(process.cwd(), 'data', 'teams.json')

export async function getTeam(slug: string): Promise<Team | null> {
  'use cache'
  cacheLife('days')
  cacheTag(teamTag(slug))

  const teams = JSON.parse(await readFile(TEAMS_FILE, 'utf8')) as Team[]
  return teams.find((t) => t.slug === slug) ?? null
}
```

```typescript
// lib/data/tasks.ts — the cached read
import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { teamTasksTag } from './tags'
import { readAllTasks } from './tasks-store'

export async function listTasks(teamSlug: string): Promise<Task[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(teamTasksTag(teamSlug))

  const all = await readAllTasks()
  return all.filter((task) => task.teamSlug === teamSlug)
}
```

Two decisions worth stating rather than absorbing:

- **`teamSlug` is a parameter, not a module-scope read.** Arguments become the cache key, so a per-team value must arrive as an argument or every team shares one entry.
- **`cacheLife('minutes')` clears the prerendering thresholds** — `stale` 5 minutes, `expire` 1 hour. `cacheLife('seconds')` would *not*: its 1-minute `expire` excludes it from prerenders entirely, and the board would silently stop being in the shell. That threshold table is [02](02-the-use-cache-directive-and-custom-cachelife-profiles.md), and this is the single easiest way to do this milestone wrong.

## Step 3 — the layout that does not await

This is the step that decides how much of the page is static, and it is one keyword:

```tsx
// app/teams/[team]/layout.tsx
import { Suspense } from 'react'

// NOT async. It never awaits params, so it prerenders for every team —
// including teams that generateStaticParams did not enumerate.
export default function TeamLayout({
  children,
  params,
}: LayoutProps<'/teams/[team]'>) {
  return (
    <div className="team-shell">
      <SprintDeskLogo />
      <PrimaryNav />
      <Suspense fallback={<TeamNameSkeleton />}>
        <TeamName params={params} />
      </Suspense>
      {children}
    </div>
  )
}

async function TeamName({ params }: Pick<LayoutProps<'/teams/[team]'>, 'params'>) {
  const { team } = await params
  const record = await getTeam(team)
  return <h1>{record?.name ?? 'Unknown team'}</h1>
}
```

🔴 **Do this even though `generateStaticParams` enumerates both seed teams.** Awaiting a known param still ties the layout's shell to one URL and forfeits the reusable App Shell for every team added later. The scaffold ships two teams; the moment a third exists, the version that awaits at the top is slow for it and nobody will connect the two events. The reasoning is [03b](03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md).

## Step 4 — the page: chrome, cached, and one hole

```tsx
// app/teams/[team]/board/page.tsx
import { Suspense } from 'react'

export async function generateStaticParams() {
  const teams = JSON.parse(
    await readFile(path.join(process.cwd(), 'data', 'teams.json'), 'utf8')
  ) as { slug: string }[]
  // Must return at least one param under Cache Components.
  return teams.map((team) => ({ team: team.slug }))
}

export default function BoardPage({ params }: PageProps<'/teams/[team]/board'>) {
  return (
    <main>
      {/* Static — no I/O. Ships in the shell. */}
      <header className="board-header">
        <h2>Sprint board</h2>
        <BoardLegend />
      </header>

      {/* Cached per team — ships in the shell. */}
      <Suspense fallback={<ColumnsSkeleton />}>
        <BoardColumns params={params} />
      </Suspense>
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskList params={params} />
      </Suspense>

      {/* Per user — a genuine hole. */}
      <Suspense fallback={<BellSkeleton />}>
        <NotificationBell />
      </Suspense>

      {/* Client component, no server data. Ships in the shell. */}
      <NewTaskForm />
    </main>
  )
}
```

```tsx
// app/teams/[team]/board/notification-bell.tsx
import { cookies } from 'next/headers'

export async function NotificationBell() {
  const session = (await cookies()).get('session')?.value
  if (!session) return null
  const count = await countUnread(session)
  return <Bell count={count} />
}
```

**Note what this costs and what it does not.** The `cookies()` read costs the bell — nothing else. Under the previous model that one call would have made the entire board dynamic: header, legend, columns, task list and form all rendered per request, behind the database. That difference is the whole reason the chapter exists, and it is worth looking at the two shells side by side in the Navigation Inspector once, because the change is more dramatic than the diff suggests.

## Step 5 — the mutation invalidates one tag

```typescript
// app/teams/[team]/board/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { teamTasksTag } from '@/lib/data/tags'
import { createTask } from '@/lib/data/tasks-store'

export async function createTaskAction(teamSlug: string, formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'Title is required' }

  await createTask({ teamSlug, title })

  // updateTag, not revalidateTag: the person who just created the task must
  // see it in this same round trip.
  updateTag(teamTasksTag(teamSlug))

  return { ok: true }
}
```

🔴 **`updateTag` rather than `revalidateTag` is the whole decision, and it is not a style preference.** `revalidateTag` with a stale-while-revalidate profile *intentionally skips* the immediate re-render, so the author of the task would submit the form and not see their own task — the canonical read-your-own-writes failure. `updateTag` expires the tag so the next read, including the re-render shipped with the action's response, waits for fresh data.

⚠️ **`updateTag` can only be called from a Server Action.** The Route Handler the scaffold also exposes cannot use it; a webhook or handler that needs to invalidate uses `revalidateTag(tag, 'max')` instead. The full comparison is [10 · 05b](10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md).

Note also what is *not* here: no `refresh()`, and no `router.refresh()` in the form component. Both re-render without invalidating, so adding either would produce a re-render that reads the same cached task list straight back — a fix that changes nothing, catalogued at [04](04-revalidation-time-based-isr.md).

## Acceptance criteria

Each of these fails in a specific way. That is deliberate — a criterion you cannot fail informatively is decoration.

1. **`next build` completes with no validation insights for the board route.** If it does not, the insight names the component; work it rather than guessing.
2. **The board's static chrome appears before any data.** Open the Navigation Inspector, enable *Pause on navigations*, refresh. You should see the logo, nav, header and legend, plus skeletons where data goes. If the whole page is a skeleton, a boundary is too high — [03c](03c-instant-navigation-validation-devtools-and-proving-it-in-ci.md).
3. **The team name is in the shell for an enumerated team, and the App Shell fallback appears for one that is not.** Add a third team to `data/teams.json` *without* rebuilding, visit it, and confirm the page appears instantly with the name streaming in. If the whole page waits, the layout is awaiting `params` at the top.
4. **The second visit to that third team shows the name immediately.** This is the background upgrade completing. If it never improves, the upgrade is not being cached.
5. **The notification bell is the only thing that re-renders per request.** With a `session` cookie set and then cleared, only the bell should change; the columns and task list should be identical.
6. **Creating a task shows it immediately, in the same round trip.** If it appears only after a manual refresh, `revalidateTag` was used where `updateTag` belongs — or the tag string differs between the write and the read.
7. **Creating a task in team A does not invalidate team B.** Load both, create in one, and confirm the other's task list is unchanged. Failure means the tag is not parameterised by team.
8. **A restart of `next dev` does not lose the board's cached columns, but a config change to the profile does re-derive them.** This distinguishes a working cache from a coincidence.

⚠️ **Criterion 6 has a documented false pass on serverless.** In-memory entries frequently do not survive between requests there, so a page can look correct because *nothing* was cached rather than because invalidation worked. Test it where entries persist — `next dev`, or a self-hosted build — before believing it.

## Phase gate

You are done when you can take any route in the application, say which of its components are in the static shell and which are holes, name the reason for each, and change one from one category to the other on purpose.

## Gotchas

**★ Symptom: the board renders correctly but the whole page waits on the database.** Cause: something above every boundary performs uncached I/O — most often the layout awaiting `params` and calling `getTeam` at the top level. Fix: make the layout non-async and move the read into a `<Suspense>`-wrapped child, as in step 3.

**★ Symptom: a task created in one team appears to invalidate every team's board.** Cause: the tag is a constant rather than a function of the slug — `cacheTag('tasks')` instead of `cacheTag(teamTasksTag(teamSlug))`. Fix: parameterise the tag, and keep the vocabulary in one module so the write and the read cannot drift.

**★ Symptom: the author of a new task does not see it until they refresh.** Cause: `revalidateTag` with a stale-while-revalidate profile deliberately skips the immediate re-render. Fix: `updateTag` in the Server Action, which expires the tag so the re-render bundled with the action's response waits for fresh data.

**★ Symptom: you switch `cacheLife('minutes')` to `cacheLife('seconds')` for fresher data and the board stops being in the shell.** Cause: `seconds` has a 1-minute `expire`, under the 5-minute threshold, so it is excluded from prerenders entirely — it is the one preset that is. Fix: keep `minutes` and lower `revalidate` if you need faster refresh; `revalidate` is not gated by any threshold.

**★ Symptom: every team shares one cached task list.** Cause: `teamSlug` was read from module scope or a closure rather than passed as an argument, so it is not part of the cache key. Fix: take it as a parameter of the cached function.

**★ Symptom: adding a third team to `data/teams.json` 404s or renders an empty board.** Cause: `generateStaticParams` runs at build and is *"not called again"* during revalidation, so the new team is an un-enumerated param served the App Shell. That is correct behaviour, but the page must handle a team the data layer does not know. Fix: `notFound()` when `getTeam` returns null — the framework no longer rejects unknown params for you, since `dynamicParams` is unsupported ([01c](01c-flipping-the-flag-on-an-existing-app.md)).

**★ Symptom: the milestone works locally and the cache appears to do nothing on a deployed preview.** Cause: the default `use cache` store is per-instance in-memory, and on serverless entries typically do not persist across requests. Fix: nothing is broken. If these entries must be shared across instances, that is what `use cache: remote` is for — and note it still will not survive a deploy ([01b](01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md)).

**★ Symptom: `updateTag` throws in the Route Handler the scaffold exposes.** Cause: it can only be called from a Server Action. Fix: use `revalidateTag(tag, 'max')` there, which works in Route Handlers and serves stale while refreshing.

**★ Symptom: you add `router.refresh()` to the form to "make sure" the list updates, and nothing changes.** Cause: it clears the client's copy for the current route and explicitly does not invalidate the server-side cache, so the server answers from the same entry. Fix: remove it. The server-side `updateTag` is what does the work.

## Interview questions

**★ On this board, which components are in the static shell and why?**
The logo, primary nav, board header and legend, because they perform no I/O at all and complete during the prerender. The team name, board columns and task list, because they are `use cache` scopes with lifetimes above the prerendering thresholds — their results are cached and included in the shell. Both skeleton fallbacks, because a `<Suspense>` fallback ships in the shell while its content streams. And the new-task form, which is a client component with no server data. The only thing that is *not* in the shell is the notification bell, because it reads `cookies()`. That is the entire per-request surface of the page, and it is one component.

**★ Why does the layout not use `async`, and why does that matter even though both teams are enumerated?**
Because awaiting `params` at the top of a layout makes the param runtime data for any route below it whose value was not enumerated, and the layout then cannot prerender at all. Making the layout non-async and passing the `params` promise into a `<Suspense>`-wrapped child moves the await below the boundary, so the logo, nav and children stay in the shell. It matters even for enumerated teams because a statically known param still belongs to one URL — awaiting it above the boundary ties that layout's shell to that URL and forfeits the reusable App Shell. The scaffold has two teams and works either way; the third team added six months later is slow only in the version that awaits at the top, and nobody will connect that regression to a layout nobody edited.

**★ Why `updateTag` and not `revalidateTag` in the create-task action?**
Because the person calling the action must see the result of their own write. `revalidateTag` with a stale-while-revalidate profile intentionally skips the immediate re-render — that is the point of the profile, since stale content continues to be served while a refresh happens in the background. So the action would return, the route would re-render from the still-cached list, and the new task would be missing until something else invalidated it. `updateTag` immediately expires the tag, and the next read — including the re-render that ships in the action's response — waits for fresh data. The constraint that follows is that `updateTag` only works in a Server Action, so the equivalent invalidation from the Route Handler has to be `revalidateTag(tag, 'max')`.

**★ What breaks if you change `cacheLife('minutes')` to `cacheLife('seconds')` on the task list?**
The board leaves the static shell. `seconds` is the one built-in preset that falls under a prerendering threshold — its `expire` of one minute is below five minutes, which excludes the value from prerenders and makes it a dynamic hole resolved at request time. Nothing errors and the page still works; it is just slower, and the cause is three characters in an unrelated-looking call. If the intent was fresher data, `revalidate` is the number to lower, because it is not gated by any threshold — the two gated numbers are `stale` and `expire`, which are the two nobody thinks of as rendering settings.

**★ Criterion 6 says a created task must appear in the same round trip. Why can that pass for the wrong reason?**
Because on serverless the default `use cache` store is per-instance and in-memory, and entries typically do not persist across requests. If nothing was cached in the first place, every request re-reads the data source and the new task naturally appears — so the criterion passes while proving nothing about invalidation. The test only means something where entries actually persist between requests, which is `next dev` or a self-hosted build. This is a general hazard when validating caching behaviour on serverless: an absent cache and a correctly-invalidated cache look identical from the outside, and only the one you did not build is reliable.

**How would you extend this milestone for a genuinely authenticated user?**
The shape does not change, which is the point of building it now. The bell currently reads a raw cookie and stays behind its boundary; with real auth it reads a session and stays behind the same boundary. What becomes available is a choice the raw cookie does not justify: if the per-user data has a meaningful lifetime, `use cache: private` can give it one so that the App Shell carries it ahead of the click rather than streaming it — subject to a `stale` of at least five minutes. What must not change is the instinct to hoist the session read up the tree to "read it once": that converts the whole subtree to request-bound and undoes the milestone. The correct move stays what it is here — read runtime data at the leaf that needs it.

**Why does adding a team to the JSON file not 404 any more, and what do you owe as a result?**
Because `dynamicParams` is not supported under Cache Components, so params not returned by `generateStaticParams` are rendered on request rather than rejected. `generateStaticParams` also is not called again during revalidation, so a team added after the build is permanently un-enumerated — it is served the App Shell and upgraded in the background. What you owe is the rejection the framework used to do for you: the page must call `notFound()` when the param does not resolve to real data. Without it, an arbitrary slug renders a board rather than a 404, which is a correctness problem in the scaffold and a security-relevant one once teams are private.

---

← [05 · Turbopack build caches](05-turbopack-build-caches-persistent-build-cache-and-memory-evi.md) · [Chapter index](01-explanation.md) · Next → [ch6 · SSG, ISR and SSR strategy](../06-ssg-isr-and-ssr-strategy/01-explanation.md)
