---
title: "Tenant isolation is one predicate that must be impossible to forget, which means it belongs in a Data Access Layer and in the database, never in a page"
sidebar_label: "10c · Isolation in the data access layer"
sidebar_position: 65
description: "Deriving the tenant from the session rather than the URL, a DAL that cannot issue an unscoped query, row-level security on a pooled connection, and the three contexts where root params are unavailable."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [Data Security](https://nextjs.org/docs/app/guides/data-security),
> the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions),
> [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params) and
> [PostgreSQL `SET`](https://www.postgresql.org/docs/current/sql-set.html).
> Target: **Next.js 16.3.4**, App Router; PostgreSQL 16+ for the RLS section.

**In a shared-schema multi-tenant application, the entire isolation guarantee is one `WHERE tenant_id = $1` clause. It has to appear on every query against every tenant-scoped table, forever, including the query a contractor writes at 5pm on a Friday. Any design where that clause is a thing a developer remembers to add is a design that will leak. The job is to make an unscoped query hard to write and impossible to ship: a Data Access Layer that will not hand you a database handle without a tenant context, and row-level security underneath in case it does anyway.**

## The URL says which tenant. The session says whether you may.

The single most common multi-tenant vulnerability is treating the tenant slug in the path as an authorization decision. It is not. It is a *request parameter that a user typed*. `sprintdesk.com/beta-corp/board` is a URL anyone can construct.

So every tenant-scoped request resolves two things and reconciles them:

```ts filename="data/tenant-context.ts"
import 'server-only'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export type TenantContext = {
  tenantId: string
  slug: string
  userId: string
  role: 'owner' | 'admin' | 'member'
}

/**
 * Resolve and authorize the tenant for the current request.
 * Deduplicated per request by React.cache, so calling it in ten
 * components costs one session read and one membership query.
 */
export const getTenantContext = cache(
  async (slug: string): Promise<TenantContext> => {
    const session = await getSession()
    if (!session) redirect('/login')

    const membership = await db.membership.findFirst({
      where: { user: { id: session.userId }, tenant: { slug } },
      select: { role: true, tenantId: true },
    })

    // Not a member — and not told whether the tenant exists.
    if (!membership) notFound()

    return {
      tenantId: membership.tenantId,
      slug,
      userId: session.userId,
      role: membership.role,
    }
  }
)
```

Two deliberate choices in there:

- **`notFound()` for a non-member, not `forbidden()`.** A 403 confirms that `beta-corp` exists. For a product where tenant names are commercially sensitive — and they usually are, because they are your customer list — a 404 is the right answer to "you may not see this".
- **`import 'server-only'`.** This file reads sessions and issues queries. If it is ever pulled into a client bundle by an errant import, the build should fail rather than ship it.

## A DAL you cannot use wrongly

Centralising is not enough on its own; the DAL still has to make the wrong call inconvenient. The shape that works is: **the tenant context is a parameter of every accessor, and the raw database client is never exported.**

```ts filename="data/projects.ts"
import 'server-only'
import { db } from '@/lib/db'
import type { TenantContext } from './tenant-context'

export type ProjectDTO = {
  id: string
  name: string
  taskCount: number
}

export async function listProjects(ctx: TenantContext): Promise<ProjectDTO[]> {
  const rows = await db.project.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true, _count: { select: { tasks: true } } },
  })
  return rows.map((r) => ({ id: r.id, name: r.name, taskCount: r._count.tasks }))
}

export async function getProject(
  ctx: TenantContext,
  projectId: string
): Promise<ProjectDTO | null> {
  // The tenant predicate and the id predicate go in the SAME query.
  const row = await db.project.findFirst({
    where: { id: projectId, tenantId: ctx.tenantId },
    select: { id: true, name: true, _count: { select: { tasks: true } } },
  })
  return row && { id: row.id, name: row.name, taskCount: row._count.tasks }
}
```

`getProject` is the pattern worth internalising. The wrong version — fetch by ID, then compare `row.tenantId` to `ctx.tenantId` and throw — is *also* correct, but it is correct only as long as nobody deletes the check. Putting both predicates in one query means the database returns nothing rather than something you have to remember to reject.

And returning a **DTO** rather than the row matters as much here as anywhere: a Prisma `Project` row carries `tenantId`, and possibly `billingAccountId` or internal flags. Whatever a Server Component receives can be serialised into the RSC payload and end up in the browser.

## Row-level security as the second layer

Application-level scoping is the layer you rely on. RLS is the layer that saves you when the application layer has a bug — a raw SQL escape hatch, a reporting query, an analytics job.

```sql
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
ALTER TABLE project FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON project
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

`FORCE` matters: without it, the table owner bypasses its own policies, and your application user is very often the table owner.

The setting has to be established per request, and here is where pooled connections and serverless drivers do damage. From the PostgreSQL manual, a plain `SET` persists **until the end of the session**, while `SET LOCAL` lasts only until the end of the current transaction, committed or not. A connection pool hands the same session to the next request. So:

```ts
// WRONG on a pooled connection: app.tenant_id outlives this request
// and applies to whoever gets this connection next.
await db.$executeRaw`SET app.tenant_id = ${ctx.tenantId}`
const rows = await db.$queryRaw`SELECT * FROM project`
```

```ts
// RIGHT: the setting and the queries share one transaction.
await db.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`
  return tx.$queryRaw`SELECT * FROM project`
})
```

`set_config(name, value, true)` is the function form of `SET LOCAL` — the third argument is `is_local`. It is easier to parameterise safely than `SET`, which does not take bind parameters.

Two deployment caveats you should verify against your own stack rather than assume: transaction-mode poolers (PgBouncer in `transaction` mode, and the pooled endpoints most serverless Postgres products expose) only preserve session state within a transaction, which is exactly why the transaction form is mandatory; and HTTP-based serverless drivers may execute each statement as its own implicit transaction, in which case a separate `set_config` statement is useless and you must use the driver's explicit transaction API. Check your driver's documentation before shipping RLS on top of it.

## The three places the tenant is not simply available

`next/root-params` is the clean way to read `[tenant]` — in Server Components. It does not work everywhere, and the gaps line up almost exactly with the places that write data.

### Server Actions

Root param getters throw inside `'use server'`. This is a permanent constraint, not a pending feature. Three viable ways to give an action its tenant, in descending order of preference:

**Bind it into the action's closure.** Captured variables in an inline Server Action are encrypted before being sent to the client, so this is tamper-resistant — but it needs `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable across instances, and it still is not authorization.

```tsx filename="app/[tenant]/board/new-project-form.tsx"
import { tenant } from 'next/root-params'
import { createProject } from './actions'

export default async function NewProjectForm() {
  const slug = await tenant()
  const action = createProject.bind(null, slug)
  return (
    <form action={action}>
      <input name="name" required />
      <button type="submit">Create</button>
    </form>
  )
}
```

**Re-derive and re-authorize inside the action.** This is the part that is not optional:

```ts filename="app/[tenant]/board/actions.ts"
'use server'

import { getTenantContext } from '@/data/tenant-context'
import { createProjectFor } from '@/data/projects'

export async function createProject(slug: string, formData: FormData) {
  // `slug` arrived from the client. It says which tenant; it proves nothing.
  const ctx = await getTenantContext(slug)          // session + membership
  if (ctx.role === 'member') throw new Error('Forbidden')

  await createProjectFor(ctx, String(formData.get('name')))
}
```

**Do not** read the slug out of a `Referer` header or reconstruct it from `headers().get('host')` as your only source. Both are attacker-controlled in exactly the same way the bound argument is; the difference is that the bound argument is at least honest about it.

### Route Handlers

Root params are not supported here either, though this one is documented as planned. Today, parse the tenant from the URL or the host, then run the same `getTenantContext` reconciliation. A Route Handler is a public HTTP endpoint — it gets no protection from being inside `app/[tenant]/`.

```ts filename="app/[tenant]/api/tasks/route.ts"
import { getTenantContext } from '@/data/tenant-context'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params
  const ctx = await getTenantContext(tenant)
  return Response.json(await listTasks(ctx))
}
```

### Background jobs, webhooks and cron

There is no session and no request URL to derive from, so the tenant must be explicit in the payload — and the caller must be authenticated by something other than a cookie (a shared secret header, a signed webhook body, mTLS). The DAL contract does not change: build a `TenantContext` from the verified payload and pass it in. See
[04 · Background jobs and message queues](04-background-jobs-and-message-queues-for-async-workloads.md) and
[03 · Real-time](03-real-time-server-sent-events-and-websockets-in-a-serverless.md) for the transport side.

## `React.cache` deduplicates the context — but not into a cache scope

Wrapping `getTenantContext` in `React.cache` means the session read and membership query happen once per request no matter how many components ask. That is the intended pattern from the Data Security guide.

One boundary to know: `React.cache` operates in an **isolated scope** inside `use cache` boundaries. A value stored via `React.cache` outside a cached function is not visible inside it. So you cannot use it to smuggle the tenant context into a `'use cache'` function — the call inside would re-execute, hit `getSession()`, hit `cookies()`, and throw `next-request-in-use-cache`. That failure is loud and it is the correct one. The pattern that works is in [10d](10d-tenancy-and-caching.md).

## Gotchas

**★ Fetching by ID and then comparing `tenantId` is one deleted line away from a cross-tenant read.** Put both predicates in the same query so the database returns zero rows instead of a row you must remember to reject.

**★ Returning a 403 for a tenant you are not a member of confirms the tenant exists.** In a B2B SaaS, the set of tenant slugs is your customer list. `notFound()` is usually the right response to a non-member.

**★ A plain `SET` of the RLS variable on a pooled connection leaks to the next request on that connection.** PostgreSQL keeps `SET` for the rest of the *session*, and a pool's session is not your request. Use `set_config(..., true)` or `SET LOCAL`, inside the same transaction as the queries.

**★ `FORCE ROW LEVEL SECURITY` is a separate statement from `ENABLE`.** Without it the table owner is exempt from its own policies — and in most deployments the application connects as the owner, so RLS silently does nothing.

**★ Root params throw in Server Actions, and the failure surfaces at runtime.** A build that type-checks proves nothing about a `await tenant()` sitting inside a `'use server'` function. The same is true of `unstable_cache`.

**★ Passing a whole ORM row to a Server Component publishes it.** Anything a Server Component renders can be serialised into the RSC payload. `tenantId`, internal billing flags and soft-delete columns all travel unless you map to a DTO.

**★ An admin or support impersonation path is a second identification mechanism, and it is usually the one with no tests.** "Staff can view any tenant" means your DAL has a bypass. Make it an explicit, audited, separately-typed context — not an `if (user.isStaff) skip the predicate` branch inside the normal path.

**★ Aggregate and reporting queries are where the predicate goes missing.** They are written once, by someone in a hurry, against raw SQL, and they are the query most likely to be run across all tenants deliberately. RLS is the thing that catches these; application-level scoping is not.

**★ Soft deletes plus tenancy is two predicates, and people remember one.** `WHERE tenant_id = $1 AND deleted_at IS NULL`. A DAL that composes both into a base filter beats a convention.

**★ A `TenantContext` cached with `React.cache` is per request, not per tenant.** That is correct and intended, but it means it must never be hoisted to a module-level variable "for performance". A module-level tenant is shared by every concurrent request on that instance.

**★ Unique constraints need the tenant in them.** `UNIQUE (slug)` on `project` makes tenant A's project name block tenant B's. It has to be `UNIQUE (tenant_id, slug)`. This is the isolation bug that shows up as a support ticket rather than a breach.

**★ Foreign keys do not enforce tenancy.** `task.project_id → project.id` says the project exists, not that it belongs to the same tenant. Either carry `tenant_id` on the child and use a composite foreign key `(tenant_id, project_id)`, or accept that a mis-scoped write can attach one tenant's task to another's project.

## Interview questions

**★ The tenant slug is in the URL. Why is that not sufficient for authorization?**
Because the URL is user input. `/beta-corp/board` is a string anyone can type. The slug tells you which tenant the request is *asking* for; membership of that tenant, read from the authenticated session, tells you whether the request may have it. Every tenant-scoped request has to reconcile those two facts, and the reconciliation belongs in one function that every entry point calls.

**★ Why put the tenant predicate and the ID predicate in the same query instead of checking after the fetch?**
Because the post-fetch check is a line of code that can be deleted, refactored away, or skipped on an early-return path, and when it is, the query has already returned another tenant's row into a variable. Putting both in the `WHERE` clause makes the absence of authorization produce zero rows. It also means the mistake is visible in the query, not in the control flow around it.

**★ You enable Postgres RLS and set `app.tenant_id` at the start of each request. Under load, users start seeing other tenants' data intermittently. What happened?**
A plain `SET` persists for the life of the database *session*, and a pooled connection's session outlives your HTTP request. Request A sets the variable, the connection returns to the pool, request B for a different tenant checks out the same connection and — if it fails to set the variable, or sets it after issuing a query — runs under A's tenant. The fix is `SET LOCAL` / `set_config(name, value, true)` issued inside the same transaction as the queries, so the setting cannot outlive it.

**★ Your Server Action needs to know the tenant, and `await tenant()` throws. What are the options and which do you pick?**
Bind the slug into the action's closure from a Server Component that can read the root param, or pass it as a form field or an argument. Both mean the value reaches the client and comes back, so both are untrusted on arrival — closure variables are encrypted, which makes them tamper-resistant but not authoritative. Either way, the action calls the same `getTenantContext(slug)` that a page would, which re-reads the session and re-checks membership. The choice of transport barely matters; skipping the re-check is what matters.

**★ Why can't you use `React.cache` to pass the tenant context into a `'use cache'` function?**
Because `React.cache` is isolated inside a `use cache` boundary: values stored outside are not visible inside. The cached function would re-run the factory, which reads the session, which reads `cookies()` — and request APIs are banned inside a cache scope, so it throws `next-request-in-use-cache`. Data enters a cache scope only as arguments, or as root params the function reads directly.

**★ What does `FORCE ROW LEVEL SECURITY` do that `ENABLE` does not?**
`ENABLE` turns policies on for ordinary users but leaves the table owner exempt. `FORCE` applies them to the owner too. Since most applications connect with the role that owns the schema, `ENABLE` alone frequently produces an RLS setup that is switched on, passes review, and filters nothing.

**★ A support engineer needs to view any tenant's workspace to debug a ticket. How do you build that without a hole?**
As a distinct, explicitly typed context — not a boolean that skips the tenant predicate. The impersonation path constructs a `TenantContext` for the target tenant only after checking a staff role and a specific grant, records who impersonated whom and when, is time-limited, and is ideally read-only. The important property is that the normal DAL path has no branch in it at all; there is a second, audited way to obtain a context, not a way to obtain data without one.

**★ Why does `UNIQUE (slug)` on a tenant-scoped table cause a support ticket rather than a breach?**
Because it makes one tenant's data affect another's writes without exposing anything: once Acme creates a project called `website`, Beta Corp cannot. Nothing leaked, but the tenants are observably not isolated — Beta can infer that the name is taken somewhere. Every unique constraint on a tenant-scoped table needs `tenant_id` as its first column.

---

← [10b · Tenant routing: proxy + root params](10b-tenant-routing-with-proxy-and-root-params.md) · [Chapter 15 overview](01-explanation.md) · Next → [10d · Tenancy and caching](10d-tenancy-and-caching.md)
