---
title: "Cache tags are global strings, so an un-namespaced tag makes every tenant's write invalidate every other tenant's cache — correctness survives, your database does not"
sidebar_label: "10e · Tenant-scoped invalidation"
sidebar_position: 14
description: "Namespacing cacheTag per tenant, the 128/256 limits, choosing between updateTag, revalidateTag and revalidatePath in a multi-tenant app, revalidatePath under a proxy rewrite, and prerendering tenant shells."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag),
> [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag),
> [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag),
> [`revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) and
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache).
> Target: **Next.js 16.3.4**, App Router, `cacheComponents: true`.

**[10d](10d-tenancy-and-caching.md) is about a correctness bug: the wrong tenant's data being served. This chunk is about the cheaper-looking mistake that is far more common — tags and paths that are correct but not tenant-scoped. `cacheTag('projects')` is a global string. When Acme adds a project and the action calls `updateTag('projects')`, every entry tagged `projects` for every tenant on the deployment is expired, and the next visitor of every tenant pays a cold render. Nobody sees the wrong data. Everybody sees the slow page, and your database sees a thundering herd proportional to your customer count.**

## Tags are a flat global namespace

There is no tenant dimension in the tag system. A tag is a string, up to 256 characters, and `updateTag`/`revalidateTag` match it exactly and case-sensitively across the whole cache. So the tenant has to be in the string:

```tsx filename="data/projects-cached.ts"
import { cacheTag } from 'next/cache'
import { tenant } from 'next/root-params'

export async function getProjects() {
  'use cache'
  const slug = await tenant()
  cacheTag(`t:${slug}:projects`)
  return listProjectsBySlug(slug)
}

export async function getProject(projectId: string) {
  'use cache'
  const slug = await tenant()
  cacheTag(`t:${slug}:projects`, `t:${slug}:project:${projectId}`)
  return getProjectBySlug(slug, projectId)
}
```

A convention worth adopting wholesale: **every tag in a tenant-scoped tree starts with the tenant prefix**, and the only tags without a prefix are genuinely global ones (a pricing page, a status banner). That makes the audit a grep rather than a reading exercise.

Prefer the **tenant ID** over the slug if slugs are renameable. A rename does not rewrite existing tags, so entries tagged with the old slug become unaddressable — they will expire on their `cacheLife`, and until then nothing you call can invalidate them.

### The limits are real and they fail quietly

A single `cacheTag()` call accepts up to **128 tags**, each at most **256 characters**. Tags over 256 characters are skipped; tags past the 128th in one call are dropped. Both log a console warning. And `revalidateTag` says the corresponding thing from the other side: a tag that exceeds the limit was never assigned to any entry, so revalidating it does nothing at all.

The multi-tenant relevance is direct. Prefixes make tags longer, and a tag built as `` `tenant:${slug}:workspace:${workspaceSlug}:board:${boardSlug}:column:${columnId}` `` with user-supplied slugs is not obviously under 256 characters. Build tags from IDs, not from names, and keep the prefix short.

## Which invalidation call, in a multi-tenant app

Three functions, three different blast radii and three different latency contracts.

| Call | Where it may run | What the caller gets | Tenant blast radius |
|---|---|---|---|
| `updateTag(tag)` | **Server Actions only** | Next read waits for fresh data — read-your-own-writes | Exactly the tags you name. Safe if prefixed. |
| `revalidateTag(tag, profile)` | Server Functions and Route Handlers | Stale served while revalidation runs in the background | Exactly the tags you name. Safe if prefixed. |
| `revalidatePath(path, type?)` | Server Functions and Route Handlers | Path invalidated | Depends entirely on the path — see below. |

`revalidateTag` takes a **required second argument** in 16.3.4. It says how long stale content may still be served: `'max'` is the recommended stale-while-revalidate window; `{ expire: 0 }` means no stale content, so the next request blocks on a fresh render. The single-argument form is deprecated and behaves like `{ expire: 0 }`. Full treatment in
[../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md).

For SprintDesk that maps cleanly:

```ts filename="app/[tenant]/board/actions.ts"
'use server'

import { updateTag } from 'next/cache'
import { getTenantContext } from '@/data/tenant-context'
import { createProjectFor } from '@/data/projects'

export async function createProject(slug: string, formData: FormData) {
  const ctx = await getTenantContext(slug)
  const project = await createProjectFor(ctx, String(formData.get('name')))

  // Read-your-own-writes: the user who just clicked Create must see it.
  updateTag(`t:${ctx.tenantId}:projects`)
  updateTag(`t:${ctx.tenantId}:project:${project.id}`)
}
```

```ts filename="app/api/webhooks/billing/route.ts"
import { revalidateTag } from 'next/cache'

export async function POST(request: Request) {
  const event = await verifyWebhook(request)   // signature check, not a session
  const tenantId = event.data.metadata.tenantId

  // No Server Action here, so updateTag is unavailable.
  // A plan change should not be served stale — expire it outright.
  revalidateTag(`t:${tenantId}:billing`, { expire: 0 })
  return Response.json({ ok: true })
}
```

The distinction that matters operationally: `updateTag` and `revalidatePath` cause the action's response to carry a freshly rendered RSC payload for the current route, so the user sees the change in the same round trip. `revalidateTag` with a stale-while-revalidate profile deliberately does not — it marks the tag and returns, and the change appears on a later read. Choosing `revalidateTag(tag, 'max')` in a form action is the reason a user clicks Create and sees the old list.

## `revalidatePath` and the URL your customer sees

`revalidatePath` operates on the **route file structure**, not on the URL in the address bar. The documented consequence is for `next.config` rewrites: if `/blog` is rewritten to `/news`, you must call `revalidatePath('/news')`, because cache entries are tagged by which route file rendered them.

Subdomain tenancy is exactly that situation. The browser shows `acme.sprintdesk.com/board`; the route file that rendered it is `app/[tenant]/board/page.tsx` at the path `/acme/board`. So:

```ts
revalidatePath('/acme/board')          // the destination path
revalidatePath('/board')               // matches nothing
revalidatePath('/[tenant]/board', 'page')  // ⚠ every tenant's board
```

The middle line is the one that ships: it looks right against the URL bar, invalidates nothing, and produces a bug report of "the cache never clears". The third line is worse — a route pattern plus `type` invalidates **all** matching pages, which in a `[tenant]` tree means every tenant.

One caveat I could not settle from the documentation: the rewrite rule above is stated for `rewrites` in `next.config.js`. The mechanism given — entries are tagged by route file, not by public URL — applies identically to a `NextResponse.rewrite` from proxy, and that is the behaviour I would expect and design for, but the docs do not state it for proxy rewrites explicitly. Verify it against your own deployment before relying on it in an incident.

Two more `revalidatePath` facts with tenant-sized consequences:

- **`revalidatePath('/', 'layout')` purges the client cache and invalidates all cached data.** In a multi-tenant deployment that is every tenant, at once, from one tenant's action. It is the cache equivalent of `TRUNCATE`.
- Called from a Server Function, `revalidatePath` currently also causes previously visited pages to refresh when navigated to again. The docs describe this as temporary and intended to narrow to the specific path. Do not build a design that depends on the wide behaviour.

## Prerendering tenant shells

Under Cache Components, prerendering fills cache entries and the output contributes to the route's static shell. For a `[tenant]` root param that means the shell can be per tenant — a per-customer navigation, logo and colour scheme rendered at build time — but only for the tenants you enumerate.

```tsx filename="app/[tenant]/layout.tsx"
export async function generateStaticParams() {
  const tenants = await db.tenant.findMany({
    where: { plan: { in: ['enterprise', 'business'] } },
    select: { slug: true },
  })
  return tenants.map(({ slug }) => ({ tenant: slug }))
}
```

Three consequences to plan for:

1. **The list is frozen at build time.** `generateStaticParams` is not called again during revalidation, so a tenant that signs up after the deploy is served dynamically until the next build. That is fine — `dynamicParams` defaults to `true` — as long as nobody sets it to `false`.
2. **A cache life too short to store safely leaves a hole that resolves at request time instead.** A tenant shell whose data has a very short `cacheLife` will not make it into the shell, and the "prerendered per tenant" plan quietly degrades to per-request rendering. Give shell-level data a long lifetime and invalidate it by tag.
3. **Enumerating everything is a build-time cost multiplied by your customer count.** Prerender the tenants where the shell is worth the build minutes.

## Every deploy is a fleet-wide cold cache

The build ID is part of every cache key, so no `use cache` or `use cache: remote` entry carries over to a new deploy. In a single-tenant app that is one cold path. In a multi-tenant app it is one cold path *per tenant*, all at once, on your first traffic after a deploy — which is precisely when you also have new code and no warm connection pool.

Mitigations worth knowing about rather than reinventing: configure `deploymentId` if you need cache identity to be something other than "this build"; give shell-level data a generous `cacheLife` so the herd is spread rather than simultaneous; and for data that genuinely must persist across deploys, the documented escape hatches are `unstable_cache` for non-`fetch` work and the `fetch` cache — neither of which is keyed on the build.

## Deleting a tenant

Offboarding is where tag hygiene pays back. If every tag for a tenant starts with `t:{tenantId}:`, you still cannot wildcard-purge — the API matches exact strings — so the practical approach is to keep the tag set enumerable: a small, known list of tag *kinds* per tenant (`:projects`, `:members`, `:billing`, `:settings`) that a deletion routine can iterate and expire with `revalidateTag(tag, { expire: 0 })`. Tags built from per-row IDs cannot be enumerated after the rows are gone, which is another reason to attach row-level tags *in addition to* a collection tag rather than instead of one.

## Gotchas

**★ `cacheTag('projects')` in a tenant-scoped function makes every tenant's write invalidate every tenant's cache.** No data leaks; the entire cache does. The symptom is a database load spike correlated with total write volume across all customers rather than with any one customer's activity.

**★ Tags built from renameable slugs become unaddressable when the slug changes.** Existing entries keep the old tag, nothing you call matches it, and they sit until `cacheLife` expires them. Tag on the immutable tenant ID.

**★ A tag over 256 characters is silently skipped, and revalidating it does nothing.** It logs a console warning at tagging time, which is easy to miss, and produces a "cache never clears" bug at invalidation time, which is not easy to trace back. Compose tags from IDs.

**★ More than 128 tags in one `cacheTag()` call drops the overflow.** Tempting when you tag an entry with every row it contains. Tag the collection plus the specific rows the entry is *about*, not every row it touched.

**★ `revalidateTag(tag)` with no profile is deprecated and behaves like `{ expire: 0 }`.** It still runs while TypeScript errors are suppressed, which is how it survives in a codebase. Inside a Server Action the replacement is usually `updateTag`, not `revalidateTag(tag, 'max')`.

**★ `revalidateTag(tag, 'max')` in a form action is why the user does not see their own write.** With a stale-while-revalidate profile the action's response deliberately carries no re-render, so the submitting user gets the old list. `updateTag` is the read-your-own-writes path.

**★ `revalidatePath('/board')` under subdomain tenancy matches nothing.** The route file lives at `/[tenant]/board`, and `revalidatePath` addresses route files, not the URL the customer sees. Pass `/acme/board`.

**★ `revalidatePath('/[tenant]/board', 'page')` invalidates every tenant.** A route pattern plus a `type` is a wildcard across all matching pages. That is occasionally what you want after a schema change; it is never what you want in a per-tenant mutation.

**★ `revalidatePath('/', 'layout')` is a fleet-wide purge triggered by one customer's action.** It clears the client cache and invalidates all cached data. Reserve it for deploy-time or admin tooling.

**★ `dynamicParams = false` plus `generateStaticParams` over "current tenants" 404s every tenant created since the last build.** `generateStaticParams` is not re-run during revalidation, so the list only refreshes on deploy.

**★ Every deploy invalidates every tenant's cache simultaneously.** The build ID is in the key. Post-deploy load is proportional to the number of tenants receiving traffic, not to one cold page.

**★ A per-row tag with no collection tag makes tenant deletion impossible to complete.** Once the rows are gone you cannot enumerate the tags that referenced them. Always tag the collection as well.

**★ `cacheTag` needs `cacheComponents: true`.** Without the flag the whole vocabulary — `cacheTag`, `cacheLife`, the three directives — is not available, and the tenant-scoping strategy in this chunk has nothing to attach to.

## Interview questions

**★ Acme adds a project. Which invalidation function do you call, and why not the other two?**
`updateTag` with tenant-prefixed tags, from the Server Action. `updateTag` is Server-Actions-only and expires the tag immediately, so the re-render that ships in the action's response — and every subsequent read — waits for fresh data; the user who clicked Create sees their project. `revalidateTag(tag, 'max')` would mark it stale and skip the immediate re-render, so the submitter sees the old list. `revalidatePath` would work for the one route but leaves every other page that shows projects stale, because it addresses a path rather than the data.

**★ Why is `cacheTag('projects')` a problem when there is no data leak?**
Because tags are a flat global namespace matched by exact string. Every tenant's cached project data carries the same tag, so any tenant's write expires all of it. Correctness is preserved and cost is not: the invalidation rate becomes the sum of all tenants' write rates, and each invalidation forces a cold render for every tenant, so the database load scales with the product of your customer count and their combined write volume.

**★ Your subdomain-based app calls `revalidatePath('/board')` after a mutation and nothing ever refreshes. Why?**
`revalidatePath` operates on the route file structure, not the browser URL. The page was rendered by `app/[tenant]/board/page.tsx`, and its cache entries are tagged by that route file at the path `/acme/board`. `/board` matches no route file, so the call is a no-op. This is the same rule the docs state for `next.config` rewrites: pass the destination path, not the source.

**★ What is wrong with `revalidatePath('/[tenant]/board', 'page')` in a per-tenant mutation?**
A route pattern with a `type` invalidates every page matching that file, which is every tenant's board. One customer renaming a column would cold-start the boards of your entire customer base. Per-tenant mutations must address a literal path or a tenant-prefixed tag.

**★ Why tag on the tenant ID rather than the tenant slug?**
Because slugs are renameable and tags are immutable once written. After a rename, existing entries still carry `t:old-slug:projects`, nothing you call matches that string, and the stale entries persist until their `cacheLife` expires. The ID does not change, so the tag stays addressable for the life of the entry.

**★ A webhook from your billing provider needs to invalidate a tenant's plan data. What do you call?**
`revalidateTag` from the Route Handler — `updateTag` is Server-Actions-only and throws anywhere else. Pass `{ expire: 0 }` rather than `'max'`, because a downgraded plan should not keep being served stale while a background revalidation runs. And authenticate the webhook by signature, since there is no session: the tenant ID comes from the verified payload, not from a header you trust.

**★ You have 40,000 tenants. Should `generateStaticParams` return all of them?**
No. It would multiply build time by your customer count for shells most of those tenants will not request before the next deploy. Return the tenants where a prerendered shell is worth the build minutes, and rely on `dynamicParams` for the rest. Remember the list is frozen at build — `generateStaticParams` is not re-run during revalidation — so new signups are dynamic until you deploy again.

**★ What happens to your caches on deploy, and why does multi-tenancy make it worse?**
The build ID is part of every `use cache` key, so no entry survives a new build. Single-tenant, that is one set of cold paths. Multi-tenant, it is a cold path per tenant, all triggered by the first traffic after the deploy, against a fleet with cold connection pools. Long shell lifetimes, `deploymentId` where cache identity should outlive a build, and staggered rollout all reduce the peak; nothing removes it.

---

← [10d · Tenancy and caching](10d-tenancy-and-caching.md) · [Chapter 15 overview](01-explanation.md)
