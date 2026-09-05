---
title: "A use cache scope is shared by every user of your deployment, so any tenant-dependent value whose tenant is not in the cache key is a cross-tenant data leak waiting for your second customer"
sidebar_label: "10d · Tenancy and caching"
sidebar_position: 66
description: "What a cache key actually contains, the three ways a tenant fails to enter it, why the framework only catches one of them, and the two patterns that are safe by construction."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache),
> [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote),
> [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private) and
> [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params).
> Target: **Next.js 16.3.4**, App Router, `cacheComponents: true`.

**`use cache` and `use cache: remote` store one entry per cache key and serve it to whoever asks next, with no notion of who that is. The cache key is built from the build ID, a hash of the function's identity, its serializable arguments, the variables it captures from enclosing scopes, and the root params it reads — and from nothing else. Not the hostname. Not the session. Not the tenant, unless the tenant is one of those things. In a single-tenant app that is a performance feature. In SprintDesk it means a cached function that renders Acme's board and does not have `acme` in its key will hand that render to Beta Corp, and the first person to notice will be a customer.**

## What is in the key, precisely

The documented inputs to a `use cache` entry's key are:

1. **Build ID** — unique per build, so every deploy starts cold. `deploymentId`, if configured, replaces it.
2. **Function ID** — a hash of the function's location and signature in the codebase.
3. **Serializable arguments** — a function's arguments, a component's props.
4. **Closure captures** — variables referenced from an enclosing scope are bound as arguments and join the key.
5. **Root params the function actually reads** — and only those.
6. In development only, an HMR refresh hash.

Read that list again as a security control rather than a performance note. Anything not on it cannot distinguish two tenants' entries. Cookies are not on it. Headers are not on it. `Host` is not on it. The user is not on it.

## The three ways the tenant fails to arrive

### 1 · The cached scope has no tenant input at all

The clean example, and the reason [10](10-multi-tenant-applications.md) argues so hard for putting the tenant in the pathname:

```tsx filename="app/board/page.tsx — header-based tenancy"
// The URL is /board for every tenant. Proxy set x-tenant-id.
// This page has no params, no props, and no root params.
export default async function BoardPage() {
  'use cache'                    // ← one entry. For everyone.
  const projects = await listProjectsForCurrentTenant()
  return <Board projects={projects} />
}
```

The key is build ID plus function ID. There is exactly one entry for this page across the entire deployment. Whichever tenant renders it first fills it; every other tenant is served that render until it expires.

If `listProjectsForCurrentTenant()` reaches for `headers()` you get saved: the read throws `next-request-in-use-cache`, and the restriction follows the call stack, so a helper five frames down fails the same way. But note *when*: on a dynamically rendered route the error surfaces when the route runs, so this can pass `next build` and fail under `next start`. And if the tenant arrives by any means that is not a request API — a module-scoped variable, a client injected at import time, a value someone threaded in through a global — nothing throws at all.

### 2 · The tenant is resolved, and then not passed in

The subtler and far more common version. The tenant is correct everywhere except across the one boundary that matters:

```tsx filename="app/[tenant]/board/page.tsx"
import { getTenantContext } from '@/data/tenant-context'

// WRONG: ctx is resolved per request, but `summary` doesn't take it.
async function summary() {
  'use cache'
  return renderExpensiveSummary(await listAllProjects())
}

export default async function BoardPage(props: PageProps<'/[tenant]/board'>) {
  const { tenant } = await props.params
  const ctx = await getTenantContext(tenant)   // correct, and irrelevant
  return <>{await summary()}</>
}
```

`summary` takes no arguments, captures nothing, reads no root params. One entry, all tenants. Every isolation control in [10c](10c-tenant-isolation-in-the-data-access-layer.md) is intact and the data still crosses, because the leak is downstream of the query.

### 3 · The tenant is smuggled through a channel the cache cannot see

`React.cache` looks like the obvious way to make the tenant context ambient. It is not, and the failure is specific: `React.cache` runs in an isolated scope inside a `use cache` boundary, so a value stored outside is not visible inside. The cached function re-runs the factory, which reads the session, which reads `cookies()`, and throws. Loud, and correct.

The genuinely dangerous version of the same idea is a module-level mutable holder — `let currentTenant` set at the top of a request. That is a cross-request bug with or without caching, but caching makes it permanent instead of transient: the wrong value gets written into an entry that outlives the request that produced it.

## The two safe patterns

### Root param read inside the scope

If `[tenant]` is a root segment ([10b](10b-tenant-routing-with-proxy-and-root-params.md)), this is safe by construction and needs no discipline from the caller:

```tsx filename="app/[tenant]/board/summary.tsx"
import { tenant } from 'next/root-params'

export async function Summary() {
  'use cache'
  const slug = await tenant()          // ← joins this function's cache key
  return renderExpensiveSummary(await listProjectsBySlug(slug))
}
```

The compiler can see which root params the function reads, so only those join the key — you get per-tenant entries without splitting the cache on every other dynamic segment in the route.

### Explicit argument, hoisted at the boundary

Where root params are unavailable — inside a Server Action's call graph, in a Route Handler, in code shared with a non-tenant tree — hoist the resolution out and pass the identifier in:

```tsx filename="app/[tenant]/board/page.tsx"
async function summaryFor(tenantId: string) {
  'use cache'
  return renderExpensiveSummary(await listProjectsByTenantId(tenantId))
}

export default async function BoardPage(props: PageProps<'/[tenant]/board'>) {
  const { tenant } = await props.params
  const ctx = await getTenantContext(tenant)
  return <>{await summaryFor(ctx.tenantId)}</>
}
```

Pass the **stable tenant ID**, not the whole `TenantContext`. A context object carries `userId` and `role`, and every field of an argument joins the key — a three-role, thousand-user tenant would get three thousand entries where one would do. Pass the narrowest value that determines the output.

The same rule cuts the other way for closure capture, which is where cache cardinality quietly explodes:

```tsx
async function Component({ userId, tenantId }: Props) {
  const getData = async (filter: string) => {
    'use cache'
    // Key includes filter (argument) AND userId AND tenantId (captured).
    return fetch(`/api/${tenantId}/data?filter=${filter}`).then((r) => r.json())
  }
  return getData('active')
}
```

Capturing `userId` there is not a leak — it is the opposite, an entry per user per tenant per filter, which is a cache that never hits and a memory cost that scales with your user table. Move the cached function out of the component so it can only see what it is given.

## `use cache: private` is for per-user, not for per-tenant

`use cache: private` relaxes the request-API ban — `cookies()`, `headers()` and `searchParams` are allowed — because it never writes to a server at all. The entry lives in one browser's memory and dies with the tab, and the scope is excluded from static shell generation.

That makes it the right tool for **per-user** state that must not rest on a server: a personalised greeting, a compliance-restricted profile panel. It is the wrong tool for per-tenant data, because a tenant has thousands of users and you would be paying a full re-render per user for a value that is identical across all of them. The correct answer for tenant data is a shared cache keyed on the tenant.

It is also not the fix for `next-request-in-use-cache`. Switching a scope from `use cache` to `use cache: private` silences that error by forfeiting server caching and prerendering entirely. See
[../05-caching-ppr-and-cache-components/10-the-three-cache-directives/04-use-cache-private.md](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/04-use-cache-private.md).

## `remote` turns an intermittent leak into a permanent one

Three storage behaviours, three different bug reports for the same mistake:

| Directive | Where the entry lives | How a missing tenant key presents |
|---|---|---|
| `use cache` on serverless | In-memory, per instance, often not reused across requests | Intermittent and unreproducible. "Sometimes I see the wrong logo." |
| `use cache` self-hosted | In-memory, persists across requests on that instance | Consistent per instance, inconsistent across the fleet. |
| `use cache: remote` | Shared durable store every instance reads | Deterministic, fleet-wide, and it survives until the entry expires or you purge it. |

Note the ordering: `remote` is the directive you reach for because your upstream is expensive, and it is also the one that turns a key mistake into a durable cross-tenant serve. Any scope you promote to `remote` deserves a second look at what is in its key. Directive selection is covered in
[../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md);
the key mechanics are in
[../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01c-slots-and-cache-keys.md](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01c-slots-and-cache-keys.md).

## The review rule

For every `'use cache'`, `'use cache: remote'` scope in a tenant-scoped tree, answer one question: **which of the six key inputs distinguishes Acme from Beta Corp?** If the answer is "an argument", check that every caller passes it. If it is "a root param", check that the function reads it rather than receiving it. If the answer is "none, because the data is not tenant-specific" — say so in a comment, because the next person to edit that function will add a tenant-specific field to it.

## Gotchas

**★ A `'use cache'` page under header-based tenancy has one entry for the whole deployment.** No params, no props, no root params means build ID plus function ID is the entire key. This is the leak, in its purest form, and it produces no error.

**★ The `next-request-in-use-cache` guard fires only if you read the request API *inside* the scope.** Resolving the tenant correctly outside and then failing to pass it in is silent. The framework protects you from the mistake you would have noticed anyway.

**★ That error can pass `next build` and fail under `next start`.** On a dynamically rendered route it surfaces when the route runs. A green build is not evidence that no cached scope reads `cookies()`.

**★ In development you have one tenant, so you cannot see this class of bug.** Cross-tenant cache leaks are invisible until two tenants render the same scope on the same instance within one cache lifetime. Test with at least two seeded tenants and hit them in the same process.

**★ On serverless, the leak is intermittent, which gets it closed as "cannot reproduce".** Instances are ephemeral and entries frequently are not reused between requests, so the wrong-tenant render appears occasionally. Intermittency is a symptom of the storage model, not evidence that the key is fine.

**★ Promoting a scope to `use cache: remote` makes a key mistake durable and fleet-wide.** The shared store is the point of the directive and the amplifier of the bug.

**★ Passing the whole `TenantContext` into a cached function multiplies entries by users and roles.** Every field of an argument is part of the key. Pass `ctx.tenantId`.

**★ Closure capture is invisible cardinality.** A cached function defined *inside* a component captures that component's props. A one-parameter function can have an entry per user per tenant. Hoist cached functions to module scope so their inputs are the ones you can see in the signature.

**★ `React.cache` cannot carry the tenant into a cache scope.** Values stored outside a `use cache` boundary are not visible inside it; the cached function re-runs the factory and, if it reads the session, throws. Arguments and root params are the only doors.

**★ A module-level `let currentTenant` is a cross-request bug that caching makes permanent.** Without a cache the wrong value affects one request; with one, it is written into an entry that other requests read.

**★ `use cache: private` is not a tenancy tool.** It is per-browser, stores nothing on the server, and is excluded from the static shell. Using it for tenant data means every user of a tenant re-renders the same thing.

**★ Draft Mode re-executes every cached scope and stores nothing.** Preview traffic therefore never exhibits the leak, which makes a preview environment the worst place to test tenant caching.

**★ Two tenants with identical data still need separate entries.** It is tempting to key on the data rather than the tenant. Do not: the moment one tenant edits, the shared entry is wrong for the other, and you have no tag that addresses one of them.

## Interview questions

**★ Exactly what is in a `use cache` cache key, and why is that list a security concern in a multi-tenant app?**
Build ID (or `deploymentId`), a hash of the function's identity, its serializable arguments, variables captured from enclosing scopes, the root params it reads, and in development an HMR hash. It is a security concern because the list is exhaustive: the hostname, the session, the cookies and the tenant are not in it unless one of those first five carries them. A cached function that renders tenant-specific output without any of those inputs has a single entry that is served to every tenant.

**★ Your app identifies tenants by an `x-tenant-id` header set in proxy. Why can you not simply read that header inside a cached component?**
Because request APIs are banned inside `use cache` and `use cache: remote` scopes — `headers()` throws `next-request-in-use-cache`, and the ban follows the call stack into helpers. The ban exists precisely because a value read from the request cannot enter the cache key, so allowing it would produce entries that silently depend on inputs the key does not record. The documented pattern is to read the value outside and pass it in, which puts it in the key as an argument.

**★ Why is reading a root param inside a cached function better than passing the same value as a prop?**
Both work. The root param version is safe by construction — the function's correctness does not depend on every caller remembering to pass the value, and there is no path where a refactor drops the argument and leaves the function compiling. It also keys narrowly: only the root params the function actually reads join its key, so an unrelated segment in the route does not fragment the cache.

**★ A support ticket says a user occasionally sees another company's project names, and QA cannot reproduce it. Where do you look first?**
At every cached scope in the tenant tree, asking which key input distinguishes tenants. The intermittency is the clue, not a reason to doubt the report: on serverless, in-memory entries are per instance and often not reused, so a keyless entry only leaks when two tenants happen to hit the same warm instance inside one cache lifetime. QA with one tenant, or with a fresh instance per test, will never see it.

**★ Would switching the offending scope to `use cache: private` fix it?**
It would stop the cross-tenant serve, because nothing is stored on a server at all — and that is not a fix, it is a retreat. You lose server caching, prerendering and static-shell participation for that scope, and you now pay a full render per user rather than per tenant. The fix is to put the tenant in the key, by reading the root param or accepting the tenant ID as an argument.

**★ You are asked to move an expensive cross-tenant dashboard query to `use cache: remote`. What do you check first?**
That the tenant is in the key. `remote` writes to a shared durable store read by every instance, so a missing key input stops being an occasional wrong render and becomes a deterministic one that persists until the entry expires. Second, that the key has few enough distinct values to be worth a network round trip — a remote cache keyed per tenant per user is a permanent miss with extra latency.

**★ Why should a cached helper live at module scope rather than inside the component that uses it?**
Because a function defined inside a component captures the component's variables, and captured variables are bound as arguments and join the cache key. That is invisible in the signature: a helper that appears to take one `filter` argument can have an entry per user, per tenant, per filter. At module scope its inputs are exactly its parameters.

**★ Two tenants happen to have identical dashboard data. Is one shared cache entry acceptable?**
No. The entry has to be addressable per tenant for invalidation — when one tenant writes, you need a tag that expires their entry and not the other's — and "identical today" is a property of the data, not of the code. The moment it stops being true you have a wrong render with no mechanism to correct it.

---

← [10c · Isolation in the data access layer](10c-tenant-isolation-in-the-data-access-layer.md) · [Chapter 15 overview](01-explanation.md) · Next → [10e · Tenant-scoped invalidation](10e-tenant-scoped-invalidation-and-prerendering.md)
