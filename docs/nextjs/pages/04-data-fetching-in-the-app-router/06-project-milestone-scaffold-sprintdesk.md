---
title: "Build the SprintDesk scaffold, starting with a data layer that performs real asynchronous I/O — because an in-memory constant makes every claim in this chapter vacuously true and teaches you nothing"
sidebar_label: "06 · Milestone: scaffold SprintDesk"
sidebar_position: 25
description: "The chapter 4 project milestone, part one: what is in scope and what is deliberately deferred, the route shape, the file-backed data layer, and the cached read with unstable_cache, a tag and a revalidation floor."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (docs `lastUpdated` 2026-08-25), [Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated` 2026-08-25) and [Building your application](https://nextjs.org/docs/app/guides/building) (`lastUpdated` 2026-07-21).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**SprintDesk is the sprint-planning app this corpus builds across every chapter, and this is the milestone where it stops being a heading and starts being a running application. The scope is deliberately narrow: team-scoped routes, a first server-rendered task list, and one Server Action that creates a task. What makes it worth doing carefully is that every mechanism chapter 4 argued about becomes something you can check rather than something you believe — but only if the data layer performs real asynchronous I/O. This page is the scope, the route shape and the data layer. [06b](06b-the-routes-the-action-and-the-route-handler.md) builds the routes, the Server Action and the Route Handler; [06c](06c-acceptance-criteria-and-the-cache-components-variant.md) is the acceptance checklist, the phase gate and the same milestone with Cache Components on.**

## What this milestone deliberately does not include

Every one of these arrives in a later chapter with its own milestone, and pulling it forward is how a scaffold turns into a three-week detour:

| Not yet | Where it lands |
|---|---|
| Authentication and sessions | [chapter 10 · Auth.js and DAL authorization](../10-forms-authentication-and-security-hardening/06-project-milestone-sprintdesk-auth-authjs.md) |
| A real database, pooling, migrations | [chapter 15 · Drizzle + Neon](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) |
| Board filters in the URL, drag-and-drop, optimistic UI | [chapter 8 · state in an RSC world](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md) |
| `error.tsx` placement and retry affordances | [chapter 7 · error handling](../07-error-handling-loading-states-and-resilience/01-explanation.md) |
| PPR shell caching and tag-based revalidation at scale | [chapter 5 · caching and Cache Components](../05-caching-ppr-and-cache-components/01-explanation.md) |
| Subdomain multi-tenancy (`[tenant]` as a root param) | [chapter 15 · tenant routing](../15-databases-apis-and-full-stack-patterns/10b-tenant-routing-with-proxy-and-root-params.md) |

One consequence of that last row is worth stating now so you build the right thing: SprintDesk's final route shape is `app/[tenant]/board/`, reached by a proxy rewrite from `acme.sprintdesk.dev`. The scaffold uses `app/teams/[team]/board/` because a bare root-level dynamic segment would swallow the marketing routes chapter 6 adds. The migration is mechanical — delete the `teams/` folder level, rename the segment — and every file below moves unchanged.

## The shape you are building

```
app/
├── layout.tsx
├── page.tsx                                  landing page, prerendered
├── teams/
│   └── [team]/
│       ├── layout.tsx                        team chrome + generateStaticParams
│       └── board/
│           ├── page.tsx                      the board, with a Suspense boundary
│           ├── loading.tsx                   segment-level fallback
│           ├── task-list.tsx                 the async server component that streams
│           ├── new-task-form.tsx             'use client' — the form
│           └── actions.ts                    'use server' — createTaskAction
└── api/
    └── teams/
        └── [team]/
            └── tasks/
                └── route.ts                  GET, JSON, not cached by default
lib/
└── data/
    ├── teams.ts
    └── tasks.ts
data/
└── teams.json                                seed data, committed
```

Everything under `app/` is built in [06b](06b-the-routes-the-action-and-the-route-handler.md). This page builds `lib/data/` and `data/`.

## Step 1 — a data layer that actually performs I/O

Two modules, both `server-only`, both asynchronous. The `.data/` directory is the throwaway store chapter 15 replaces with Neon; add it to `.gitignore`.

```typescript
// lib/data/teams.ts
import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type Team = { slug: string; name: string }

const TEAMS_FILE = path.join(process.cwd(), 'data', 'teams.json')

export async function listTeams(): Promise<Team[]> {
  return JSON.parse(await readFile(TEAMS_FILE, 'utf8')) as Team[]
}

export async function getTeam(slug: string): Promise<Team | null> {
  const teams = await listTeams()
  return teams.find((t) => t.slug === slug) ?? null
}
```

```json
[
  { "slug": "acme", "name": "Acme Platform" },
  { "slug": "orbit", "name": "Orbit Mobile" }
]
```

That is `data/teams.json`, committed to the repository — the scaffold's teams are fixed, which is what lets `generateStaticParams` enumerate them in [06b](06b-the-routes-the-action-and-the-route-handler.md).

```typescript
// lib/data/tasks.ts
import 'server-only'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

export type TaskStatus = 'todo' | 'doing' | 'done'

export type Task = {
  id: string
  teamSlug: string
  title: string
  status: TaskStatus
  createdAt: string
}

const DATA_DIR = path.join(process.cwd(), '.data')
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json')

async function readAll(): Promise<Task[]> {
  try {
    return JSON.parse(await readFile(TASKS_FILE, 'utf8')) as Task[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeAll(tasks: Task[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8')
}

export async function listTasksUncached(teamSlug: string): Promise<Task[]> {
  const tasks = await readAll()
  return tasks
    .filter((t) => t.teamSlug === teamSlug)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function insertTask(teamSlug: string, title: string): Promise<Task> {
  const tasks = await readAll()
  const task: Task = {
    id: randomUUID(),
    teamSlug,
    title,
    status: 'todo',
    createdAt: new Date().toISOString(),
  }
  await writeAll([...tasks, task])
  return task
}
```

🔴 A single JSON file behind a write is not concurrency-safe and does not survive a serverless filesystem. That is fine here and only here: the point of the scaffold is the rendering and caching behaviour, and chapter 15 replaces both functions with Drizzle queries without touching a single component.

### Why the store is not an in-memory constant

Because the Building guide is explicit about what happens when it is: a synchronous in-memory value is treated as static and prerenders each param in full, where real uncached I/O produces a streamed row instead. Swap the file read for a `const TASKS = [...]` and the build output stops distinguishing a cached read from an uncached one, no boundary ever renders its fallback, and the entire milestone becomes a set of claims you cannot falsify. The slow read is the feature.

## Step 2 — the cached read, and why `fetch` options cannot do this job

Chapter 4 spent most of its length on the extended `fetch()` ([overview](01-explanation.md)). None of it applies here, because this data layer never calls `fetch`. The documented tool for caching a non-`fetch` async function in the current model is `unstable_cache`, which takes the function, a key-parts array, and an options object carrying `tags` and `revalidate`.

```typescript
// lib/data/tasks.ts — appended
import { unstable_cache } from 'next/cache'

export function tasksTag(teamSlug: string): string {
  return `team-${teamSlug}-tasks`
}

export function listTasks(teamSlug: string): Promise<Task[]> {
  return unstable_cache(() => listTasksUncached(teamSlug), ['tasks', teamSlug], {
    tags: [tasksTag(teamSlug)],
    revalidate: 60,
  })()
}
```

Three decisions in there, each of which you will be asked about:

- **The team slug is in the key-parts array**, not only captured by the closure. Putting the discriminator in the key makes the cache key explicit rather than relying on how the framework derives one from a closure.
- **The tag is produced by a function**, so the reader and the writer cannot drift apart. Tags are capped at **256 characters and 128 items per request** ([overview](01-explanation.md)); `team-acme-tasks` is nowhere near either, and a scheme that interpolated a user's email would eventually not be.
- **`revalidate: 60` is a floor, not a promise.** The task list is also invalidated on demand by the action in [06b](06b-the-routes-the-action-and-the-route-handler.md); the sixty seconds only covers writes that happened outside this app.

⚠️ `unstable_cache` carries the `unstable_` prefix for a reason and is the previous model's API. Under Cache Components the whole function collapses into a `use cache` directive and a `cacheTag` call — that variant is in [06c](06c-acceptance-criteria-and-the-cache-components-variant.md).

## Gotchas

**★ Symptom: the board shows an empty list and never updates, however many tasks you add.** Cause: the read happened once during prerendering and nothing invalidates it — the build-time snapshot from [03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md). Fix: the read must carry a tag *and* the write must fire it. Both halves are required; a tag with no matching `revalidateTag` is decoration.

```typescript
// read — lib/data/tasks.ts
unstable_cache(() => listTasksUncached(slug), ['tasks', slug], { tags: [tasksTag(slug)], revalidate: 60 })
// write — app/teams/[team]/board/actions.ts
revalidateTag(tasksTag(slug))
```

**★ Symptom: every team shows the same task list.** Cause: the discriminator never reached the cache key — the classic version is a cached function that takes no arguments and reads the slug from module scope or an outer closure. Fix: put the slug in the key-parts array, which is what the `['tasks', teamSlug]` above is doing, and never cache a function whose result depends on state the key cannot see.

```typescript
// 🔴 one entry for every team
let currentTeam = 'acme'
const bad = unstable_cache(() => listTasksUncached(currentTeam), ['tasks'], { revalidate: 60 })

// ✅ the slug is part of the key
const good = (slug: string) =>
  unstable_cache(() => listTasksUncached(slug), ['tasks', slug], { revalidate: 60 })()
```

**★ Symptom: the first task creation throws `ENOENT`.** Cause: `.data/` does not exist until something creates it, and a `writeFile` to a missing directory fails. Fix: `mkdir` with `recursive: true` on every write path, as `writeAll` does — do not rely on a `postinstall` script a teammate's clone will not run.

```typescript
async function writeAll(tasks: Task[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8')
}
```

**Symptom: two rapid submissions and one task disappears.** Cause: read-modify-write over a whole JSON file has no locking, so the second write serialises a snapshot taken before the first landed. Fix: none here, deliberately. This is the known cost of the throwaway store and chapter 15's database is the real answer — but know the limit exists before you build a load test that "proves" the framework loses writes.

**Symptom: `.data/tasks.json` gets committed and every developer's board shows someone else's tasks.** Cause: the store lives inside the repository. Fix: add it to `.gitignore` in the same commit that creates it, not later.

```
# .gitignore
.data/
```

**Symptom: importing `lib/data/tasks.ts` from a client component fails the build with a confusing module error.** Cause: `server-only` is doing its job — the file reads the filesystem and must never be bundled for the browser. Fix: that is the correct outcome; move the data access into a Server Component or a Server Action and pass the *result* across the boundary, never the module.

**Symptom: the tag stops matching after someone renames a team slug.** Cause: the tag encodes a mutable, human-editable identifier. Fix: for the scaffold, slugs are fixed seed data and this is acceptable; from chapter 15, tag by the immutable primary key and keep the slug for routing only — the same reasoning behind tagging by opaque ID rather than by content.

## Interview questions

**★ Why does this scaffold use `unstable_cache` rather than `fetch` options for its cached read?**
Because the data layer does not call `fetch`. The extended `fetch()` and all of its `cache`, `revalidate` and `tags` options only reach requests made through `fetch`; a filesystem read or an ORM query is invisible to them. The documented previous-model tool for a non-`fetch` async function is `unstable_cache`, taking the function, a key-parts array, and an options object with `tags` and `revalidate`. It is worth internalising early, because a team migrating from a REST API to an ORM routinely loses all of its caching in one refactor without touching a line of caching code.

**★ What would break first if the seed data were an in-memory constant instead of a file read?**
Every claim the milestone makes. The Building guide notes that a synchronous in-memory value is treated as static and prerenders in full, where real uncached I/O produces a partially prerendered row. With no genuine I/O there is nothing to cache, nothing to stream, no boundary that ever shows a fallback, and no observable difference between a cached and an uncached read. The app would build and look identical while teaching nothing — a far worse outcome than a slow file read.

**Why put the team slug in the key-parts array when the closure already captures it?**
Because the cache key is the contract, and a key derived implicitly is one you cannot reason about when it goes wrong. An explicit key-parts array makes "one entry per team" a property you can read off the call site, and it makes the failure mode — a cached function whose result depends on something the key does not include — impossible to write by accident. It is the same discipline as passing a discriminator as an argument to a `use cache` function rather than closing over it.

**The tag is `team-${slug}-tasks`. What would make that a bad scheme at scale?**
Two documented limits and one design smell. A custom tag is capped at 256 characters and a request may carry at most 128 tag items, so any scheme that interpolates unbounded user input — an email, a title, a path — eventually exceeds the first, and any fan-out scheme emitting one tag per row hits the second as soon as a list grows. The design smell is tagging by a mutable identifier: a slug rename silently orphans every existing entry. Tag by an immutable ID and treat the slug as routing.

**`revalidate: 60` and an on-demand `revalidateTag` are both configured. Is that redundant?**
No, they cover different failure modes. The tag handles writes this application performs and knows about, and it invalidates immediately. The sixty-second floor handles everything else — a row changed by a migration, an admin tool, a background job, or another service sharing the store. Relying on the tag alone assumes your app is the only writer, which is true exactly until the day it is not; relying on the interval alone means every mutation the user just performed takes up to a minute to appear.

---

← [05e · Errors, authorization and when a Route Handler is right](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md) · [Chapter 4 overview](01-explanation.md) · Next → [06b · The routes, the action and the handler](06b-the-routes-the-action-and-the-route-handler.md)
