---
title: "How to prove the SprintDesk scaffold actually works — eight acceptance criteria you can check yourself, the deduplication step the scaffold is still missing, and the same milestone rebuilt with Cache Components on"
sidebar_label: "06c · Acceptance criteria and Cache Components"
sidebar_position: 27
description: "Part three of the chapter 4 milestone: React cache for non-fetch deduplication, eight checkable acceptance criteria, the phase gate, and the diff that converts the whole scaffold to use cache, cacheTag and updateTag."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (docs `lastUpdated` 2026-08-25), [Building your application](https://nextjs.org/docs/app/guides/building) (`lastUpdated` 2026-07-21), [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated` 2026-08-25) and [Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**A milestone that cannot be checked is a tutorial you followed. This page closes the scaffold from [06](06-project-milestone-scaffold-sprintdesk.md) and [06b](06b-the-routes-the-action-and-the-route-handler.md) with one refinement it still needs, eight acceptance criteria a reader can run against their own machine, a phase gate stated as a capability rather than a feeling, and the diff that converts the whole thing to Cache Components. The criteria are deliberately written as discriminating tests — each one fails in a specific way that tells you which mechanism is wrong — rather than as a list of things that should look fine.**

## Step 6 — the deduplication the scaffold is still missing

`getTeam` is now called from `generateStaticParams`, from the layout, from the Server Action and from the Route Handler. `fetch` memoization does not help: it is documented as applying to `fetch` `GET` requests, and this data layer never calls `fetch`. The documented remedy for non-`fetch` access is React's `cache`, which deduplicates within a single render pass — the full treatment is in [01g](01g-react-cache-connection-and-non-fetch-memoization.md).

```typescript
// lib/data/teams.ts — revised
import 'server-only'
import { cache } from 'react'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type Team = { slug: string; name: string }

const TEAMS_FILE = path.join(process.cwd(), 'data', 'teams.json')

export const listTeams = cache(async (): Promise<Team[]> => {
  return JSON.parse(await readFile(TEAMS_FILE, 'utf8')) as Team[]
})

export const getTeam = cache(async (slug: string): Promise<Team | null> => {
  const teams = await listTeams()
  return teams.find((t) => t.slug === slug) ?? null
})
```

Note what this is **not**. `cache` deduplicates within one render pass; it is not a persistent cache and it does not survive to the next request. That is why the task list still needs `unstable_cache` and a tag, and why the two mechanisms coexist in the same data layer without either replacing the other. It also does not reach the Route Handler, which is not part of the React component tree — there, one call per request is all there is anyway.

## Acceptance criteria

Each row states what to do and what its failure tells you. Run them against a production build unless the row says otherwise, because development never prerenders and never caches pages.

**1 · The task list is server-rendered.** Load `/teams/acme/board` with JavaScript disabled in the browser. The task titles must be present in the HTML the server sent — view source, not the inspector, which shows the hydrated DOM. *Failure means* the list is being fetched from a client component, and the whole chapter's model does not apply to it.

**2 · The form works before hydration.** Still with JavaScript disabled, submit a task. It must be created and visible after the browser's native navigation. *Failure means* the action is not bound as the `action` prop, or the form is rendered in a way that prevents native submission.

**3 · A new task appears without a manual reload.** With JavaScript enabled, submit a task and do not touch the browser. *Failure means* `revalidateTag` was not called, or the tag written and the tag read are different strings.

**4 · Validation rejects a short title and writes nothing.** Submit a two-character title. The error must render from `useActionState`, and `.data/tasks.json` must be unchanged. *Failure with a written row* means the check runs after the write.

**5 · An unknown team 404s.** Load `/teams/nope/board`. *Failure means* `notFound()` is unreachable — usually because the layout returned before the lookup.

**6 · The API and the page agree.** Fetch `/api/teams/acme/tasks` and compare with the board. Create a task, then re-fetch. *Failure means* the handler is not reading through `listTasks`, so it sits outside the tag.

**7 · Neither board route is dynamic.** Build the route and read its symbol:

```bash
next build --debug-build-paths="app/teams/[team]/board/page.tsx"
```

The board rows must **not** be `ƒ`. Which prerendered symbol you get depends on your configuration — `●` (SSG) in the previous model, `○` or `◐` under Cache Components — and the criterion is only that the route had something to prerender. *A `ƒ` means* something in the route read the request; work through [03c](03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md).

**8 · Both teams appear as rows.** The same build output must list a row per enumerated slug under the `/teams/[team]/board` pattern. *A single fallback row and no per-slug rows means* `generateStaticParams` returned nothing — check that every code path returns an array, since returning nothing makes the route dynamically rendered.

## Phase gate

**You are done with this milestone when you can, without opening documentation:**

- Say for any given route in your app whether it prerenders, and name the specific line that decides it.
- Point at the one read in the codebase that is cached, name its tag, and name the line that invalidates that tag.
- Explain why `unstable_cache`, React `cache` and `fetch` memoization all exist in the same data layer and why removing any one of them breaks something different.
- Add a second Server Action — mark a task done — without looking at `createTaskAction`, including where its validation goes and which tag it fires.
- Move a `<Suspense>` boundary and predict, before rebuilding, how the route table row will change.

If any of those needs a lookup, the missing piece is in [03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md) or [03b](03b-the-segment-config-surface.md) rather than in more building.

## The same milestone with Cache Components on

Turning the flag on is not a tuning change; it is a different model with different vocabulary ([03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md)). Four edits convert the scaffold.

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

**The cached read loses its wrapper.** `unstable_cache` becomes a directive, and the lifetime and tag become calls:

```typescript
// lib/data/tasks.ts — the Cache Components form
import { cacheLife, cacheTag } from 'next/cache'

export function tasksTag(teamSlug: string): string {
  return `team-${teamSlug}-tasks`
}

export async function listTasks(teamSlug: string): Promise<Task[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(tasksTag(teamSlug))
  return listTasksUncached(teamSlug)
}
```

The argument is the cache key now, which is why `teamSlug` must be a parameter and not something read from module scope.

**The write switches function.** `revalidateTag` still exists, but `updateTag` is the Cache Components call for invalidating immediately after a mutation in the same request — the distinction, and when each is correct, is set out in [01b](01b-server-actions-and-mutations.md).

**The layout's uncached read has to be resolved.** `getTeam` is real I/O, so under Cache Components it must be inside a `use cache` function or behind a boundary; left as it is, the build fails rather than silently going dynamic. Since teams are seed data, caching is the right answer:

```typescript
// lib/data/teams.ts
import { cacheLife } from 'next/cache'

export async function getTeam(slug: string): Promise<Team | null> {
  'use cache'
  cacheLife('days')
  const teams = await listTeams()
  return teams.find((t) => t.slug === slug) ?? null
}
```

**`generateStaticParams` must not return an empty array.**

> *"`generateStaticParams` must return at least one param."*

The scaffold ships two teams in `data/teams.json`, so it already satisfies this. An app that enumerated nothing at build gets the `empty-generate-static-params` build error, and the documented placeholder workaround explicitly weakens the validation you turned the flag on for.

What changes in the output is that the board rows can become `◐` — a prerendered shell with the task list streaming — rather than a single fully static row, and the route gains `Revalidate` and `Expire` columns reporting the shortest lifetime across every cache inside it.

## Gotchas

**★ Symptom: acceptance criterion 1 passes in the inspector and fails in view-source.** Cause: the inspector shows the hydrated DOM, so client-fetched content looks server-rendered there. Fix: check the transferred HTML, or simply disable JavaScript — the two criteria that matter most in this milestone are both only meaningful with JavaScript off.

**★ Symptom: every criterion passes in `next dev` and criterion 7 fails in a production build.** Cause: development never prerenders and never caches pages, so it cannot distinguish a static route from a dynamic one. Fix: run criteria 7 and 8 against a build, scoped with `--debug-build-paths` so the loop is fast enough to actually do.

**★ Symptom: enabling `cacheComponents` breaks the build on a route that worked yesterday.** Cause: that is the feature. An uncached read that is neither inside `use cache` nor behind `<Suspense>` is a build failure in this model, where the previous one made the route dynamic silently. Fix: decide per read — cache it if it can be shared, wrap it in a boundary if it must be per-request.

**★ Symptom: after migrating to `use cache`, every team sees the same tasks again.** Cause: the arguments and captured values form the cache key, and a directive placed on a function that reads its filter from module scope has exactly one entry. Fix: the discriminator must be a parameter.

```typescript
export async function listTasks(teamSlug: string) {
  'use cache'
  cacheTag(tasksTag(teamSlug))
  return listTasksUncached(teamSlug)
}
```

**Symptom: `unstable_cache` and `use cache` are both in the codebase after a partial migration and invalidation works for some reads.** Cause: two caching mechanisms with two invalidation calls, and a `revalidateTag` that only reaches one of them in the way you expect. Fix: migrate a whole data module at a time, never a single function, and keep the tag helper as the one shared point between the two.

**Symptom: React `cache` was added and the read still happens twice.** Cause: `cache` deduplicates within a single render pass only. A Route Handler is not part of the React component tree, and a second HTTP request is a second pass by definition. Fix: this is expected. If the value must persist between requests, that is `unstable_cache` or `use cache`, which is a different decision with a different lifetime.

**Symptom: criterion 3 passes locally and fails on a deployed preview.** Cause: something outside the framework — a CDN or platform cache — is serving the previous response. The Next.js documentation does not specify that layer for your deployment. Fix: confirm the bytes came from your origin before changing any caching code; this is the residual explanation, not the first one.

**Symptom: the phase gate feels passed but adding the "mark task done" action takes an hour.** Cause: the scaffold's structure was followed rather than understood — most often the validation-then-write ordering and the tag choice. Fix: write the second action before moving to chapter 5; it is the cheapest possible test of whether the first one taught you anything.

## Interview questions

**★ Why does this codebase need React `cache`, `unstable_cache` and `fetch` memoization all at once?**
Because they solve three different problems at three different scopes. `fetch` memoization deduplicates identical `GET` fetches inside one render pass, automatically, and only for `fetch`. React `cache` provides the same per-render deduplication for everything that is not `fetch` — an ORM query, a filesystem read. `unstable_cache` (or `use cache`) is the persistent layer that survives across requests and can be invalidated by tag. Removing memoization costs duplicate work in one render; removing the persistent cache costs an origin hit per user. Teams that conflate them usually discover it when they move off REST and every cache in the app quietly stops existing.

**★ Acceptance criterion 7 says "not `ƒ`" rather than naming an expected symbol. Why is that the better test?**
Because the exact symbol depends on configuration and on whether the route's data is cached — `●` in the previous model, `○` or `◐` under Cache Components, and a listed param can legitimately be `◐` when its params are known but its data is not cached. Asserting a specific symbol produces a criterion that fails for reasons that are not defects. Asserting *not* `ƒ` tests the thing the milestone actually claims: the route had something to prerender. A good acceptance criterion discriminates the failure you care about and stays silent about everything else.

**Under Cache Components, why must the team slug be a parameter rather than a closed-over value?**
Because the cache key is formed from the function's arguments and captured values, and a directive on a zero-argument function that reads its filter from module scope produces a single entry serving every input. The symptom is the most alarming one in a multi-tenant app: one team's data rendered for another. The rule generalises — anything that discriminates the result must be visible to the key, which is the same reason the `unstable_cache` version put the slug in its key-parts array.

**★ What is the phase gate really testing?**
Whether you can predict behaviour rather than recall configuration. Naming the line that decides whether a route prerenders is a different skill from knowing that `force-dynamic` exists, and predicting how a route table row changes when a boundary moves is the only reliable evidence that the shell/streaming model is internalised. It is written as five capabilities because a milestone completed by copying passes any checklist about files existing, and fails all five of these.

**Someone proposes skipping the Cache Components migration because "the current model still works". What is the argument against?**
That the previous model is now labelled as previous by the documentation itself, and that `dynamic`, `revalidate` and `fetchCache` no longer appear in the Route Segment Config reference — they live in a guide named for a model you are choosing to stay on. The stronger argument is about failure modes rather than currency: in the previous model an uncached read with no boundary makes a route silently dynamic and you find out from a latency graph, whereas under Cache Components it fails the build. Deferring the migration is a choice to keep discovering that class of mistake in production.

---

← [06b · Routes, action and handler](06b-the-routes-the-action-and-the-route-handler.md) · [Chapter 4 overview](01-explanation.md) · Next → [10 · Draft Mode](10-draft-mode-cms-preview-that-bypasses-every-cache-layer.md)
