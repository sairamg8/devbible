---
title: "Multi-tenancy in Next.js is decided by how a request declares its tenant, because only a route segment can be prerendered, cached and read without a request"
sidebar_label: "10 · Multi-tenant applications"
sidebar_position: 63
description: "The three isolation models, the four ways a request can identify its tenant, why the App Router pushes you hard towards a tenant route segment, and what subdomain cookies do to your session."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js guide [How to build multi-tenant apps](https://nextjs.org/docs/app/guides/multi-tenant),
> [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params),
> [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy),
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) and
> [Data Security](https://nextjs.org/docs/app/guides/data-security); cookie scoping against
> [MDN `Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie),
> TLS wildcard matching against [RFC 6125 §6.4.3](https://www.rfc-editor.org/rfc/rfc6125#section-6.4.3).
> Target: **Next.js 16.3.4**, App Router, Cache Components, Node.js ≥ 20.9.

**SprintDesk is a multi-tenant SaaS: Acme's board and Beta Corp's board are the same code, the same deployment and — usually — the same database, separated only by a predicate. Almost every hard question in that sentence is not about the database. It is about how an incoming HTTP request tells the server which tenant it belongs to, because in the App Router that single choice decides whether your pages can be prerendered, whether `use cache` can safely hold tenant data, whether root params are available, and whether a Server Action can work out who it is acting for. Get the identification mechanism right and isolation is a predicate you enforce in one place. Get it wrong and you spend the rest of the project fighting the framework, and eventually you serve Acme's sprint board to Beta Corp.**

## Two independent decisions

People conflate these constantly. They are orthogonal, and you must answer both.

1. **Identification** — how does a request say *"I am Acme"*? Path segment, subdomain, custom domain, or a header/cookie carried by the session.
2. **Isolation** — where does Acme's data physically live relative to Beta Corp's? One row set in a shared table, one schema, or one database.

You can pair any identification with any isolation. What you cannot do is defer the identification decision, because it is baked into your URL structure and your URLs are your cache keys.

## Isolation: the three models

| Model | Shape | Cost in a serverless Next app |
|---|---|---|
| **Shared schema** (pooled) | One table, `tenant_id` column on every row, every query filtered | Cheapest and the default. One connection pool. One migration. Every isolation failure is a missing `WHERE` clause. |
| **Schema per tenant** | `acme.projects`, `beta.projects`, one database | Same pool, but `search_path` becomes request state — and request state on a pooled connection is the hazard in [10c](10c-tenant-isolation-in-the-data-access-layer.md). Migrations run N times. |
| **Database per tenant** | One database (or cluster) per tenant | Strongest isolation, and the one that breaks serverless hardest: a connection pool per tenant per function instance. Fine at ten tenants, unusable at ten thousand. |

For anything that looks like SprintDesk, start with **shared schema plus a mandatory `tenant_id` predicate**, and add Postgres row-level security underneath as a second line of defence. See
[01 · Database integrations](01-database-integrations-serverless-postgres-neon-prisma-drizzl.md) for the pooling constraints that make per-tenant databases painful, and
[06 · SprintDesk on Drizzle + Neon](06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) for the concrete pool.

The rest of this topic assumes shared schema. Everything about routing and caching applies unchanged to the other two.

## Identification: four mechanisms, ranked by what the framework can do with them

### 1 · Path segment — `sprintdesk.com/acme/board`

The tenant is a dynamic route segment. `app/[tenant]/board/page.tsx`.

This is the only mechanism where the tenant is **part of the route**, and that is worth more in the App Router than it looks:

- `generateStaticParams` can enumerate tenants and prerender per-tenant shells.
- Placed above the root layout, `[tenant]` becomes a **root param**, readable from any Server Component without prop drilling — and, crucially, it joins the cache key of any `'use cache'` function that reads it.
- `revalidatePath('/acme/board')` addresses exactly one tenant's page.
- Prefetching, `Link`, and the client router all work with no special handling.

Cost: the URL is ugly for a customer-facing product, and moving to subdomains later is a URL migration.

### 2 · Subdomain — `acme.sprintdesk.com/board`

The tenant is in the `Host` header. The App Router has **no** routing primitive for hostnames — the file system routes on pathname only. So subdomain tenancy is always implemented as *identification in proxy, rewrite to a path segment*:

```ts filename="proxy.ts"
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const sub = host.split('.')[0]
  const url = request.nextUrl.clone()
  url.pathname = `/${sub}${url.pathname}`
  return NextResponse.rewrite(url)
}
```

Which means: **subdomain tenancy is path-segment tenancy with a hostname front end.** You get all the benefits of mechanism 1, plus a clean per-customer URL, plus real cookie isolation — at the cost of a proxy on every request and a wildcard DNS record and certificate. Full treatment in [10b](10b-tenant-routing-with-proxy-and-root-params.md).

### 3 · Custom domain — `tasks.acme.com`

Same as subdomains, except the hostname carries no tenant information at all. You have to look it up: hostname → tenant slug → rewrite. That lookup runs in proxy, on the critical path of every request, and it cannot use the Next.js fetch cache — the docs are explicit that `cache`, `next.revalidate` and `next.tags` on a `fetch` have **no effect** inside proxy. You need an edge KV store, an in-region cache with its own TTL, or a signed hostname mapping. Budget for it before you promise vanity domains.

### 4 · Header or session only — `sprintdesk.com/board` plus `x-tenant` or a cookie

The URL is tenant-free; the tenant lives in the session or an injected request header. This is the one that feels simplest and is the worst fit for the App Router, and it is worth being precise about why rather than hand-waving:

- `cookies()`, `headers()` and `searchParams` **cannot be read inside a `use cache` or `use cache: remote` scope**. The read throws [`next-request-in-use-cache`](https://nextjs.org/docs/messages/next-request-in-use-cache), and the restriction follows the call stack into helpers.
- So the tenant can never enter a shared cache key by that route. Either you hoist the read to an uncached parent and thread it down as an argument everywhere, or you do not cache tenant data at all.
- Every route becomes dynamic. There is no static shell, no per-tenant prerender, and no meaningful PPR boundary.
- There is no URL to share, bookmark or link between tenants for a user who belongs to two.
- And the failure mode when someone *does* add `'use cache'` to such a page is a cross-tenant data leak, not an error — see [10d](10d-tenancy-and-caching.md).

Use a header only as a **transport** between proxy and the render, alongside a URL segment that already identifies the tenant. Never as the sole identifier.

## The rule this all collapses to

**Put the tenant in the pathname, whatever the browser's address bar says.** Subdomain and custom-domain products rewrite to a `[tenant]` segment in proxy; path-segment products already have one. Everything downstream — root params, cache keys, `revalidatePath`, `generateStaticParams`, prefetching — is built to key on route segments, and nothing in the framework is built to key on `Host`.

## Cookies do not respect your tenancy model

If you move to subdomains, the cookie layer changes underneath you and it is easy to get a security-relevant surprise.

A cookie set without a `Domain` attribute is **host-only**: `Set-Cookie` from `acme.sprintdesk.com` is returned only to `acme.sprintdesk.com`. Add `Domain=sprintdesk.com` and it is sent to *every* subdomain — including `beta.sprintdesk.com` and, importantly, including any subdomain an attacker gets to control.

That gives you two designs:

| Cookie scope | Effect | When it is right |
|---|---|---|
| Host-only, per subdomain | Separate session per tenant. Signing into Acme does not sign you into Beta. | Strong separation; users who belong to one tenant. |
| `Domain=.sprintdesk.com` | One session across all tenants. | SSO across tenants a user already belongs to — **and then authorization must be re-checked per tenant on every request**, because the cookie proves identity, not membership. |

The `__Host-` cookie name prefix is worth knowing here: a cookie with that prefix is only accepted if it is `Secure`, has `Path=/`, and has **no** `Domain` attribute. It is therefore structurally incapable of being shared across subdomains. If you want cross-tenant SSO you cannot use it; if you want hard per-subdomain isolation, it is exactly the guarantee you want.

## Unknown, suspended and deleted tenants

Three distinct outcomes, and shipping only the first is the common bug:

```tsx filename="app/[tenant]/layout.tsx"
import { notFound } from 'next/navigation'
import { tenant } from 'next/root-params'
import { getTenantBySlug } from '@/data/tenants'

export default async function TenantLayout(props: LayoutProps<'/[tenant]'>) {
  const slug = await tenant()
  const record = await getTenantBySlug(slug)

  if (!record) notFound()                       // never existed, or was deleted
  if (record.status === 'suspended') {
    return <SuspendedNotice tenant={record} />  // exists, is not billed, must not render data
  }

  return <TenantShell tenant={record}>{props.children}</TenantShell>
}
```

A suspended tenant that falls through to `notFound()` tells a paying customer their workspace was deleted. A deleted tenant that renders the shell tells an attacker which slugs exist. Decide both deliberately.

## Gotchas

**★ You cannot route on hostname with the file system, and no amount of folder structure will change that.** App Router segments map to pathname only. Every hostname-based tenancy scheme is a proxy rewrite into a pathname-based one. If your design document says "route by subdomain", what you are actually building is [10b](10b-tenant-routing-with-proxy-and-root-params.md).

**★ Header-only tenancy and `use cache` are mutually exclusive, and the framework only tells you half the time.** Reading `headers()` inside the cache scope throws. Reading it *outside* and forgetting to pass it in does not throw — it silently produces one cache entry shared by every tenant. The error you get is the good case.

**★ `Domain=sprintdesk.com` on your session cookie makes every subdomain a session-read primitive.** Including a customer subdomain you let a tenant choose, and including any subdomain takeover on the parent domain. If tenants pick their own subdomain slug, validate it against a reserved list (`www`, `api`, `admin`, `app`, `mail`, …) at signup, not at render.

**★ Sequential integer primary keys turn a missing predicate into an enumeration attack.** With shared-schema isolation, `/acme/projects/1041` and `/beta/projects/1042` are neighbours in the same table. The predicate is the only thing between them, so a single query written without it is a full cross-tenant read. Prefer opaque IDs so that a leak is at least not walkable, and treat that as defence in depth, not as the fix — the fix is in [10c](10c-tenant-isolation-in-the-data-access-layer.md).

**★ Database-per-tenant plus serverless equals connection exhaustion.** Each function instance that touches N tenants holds N pools. This is the one isolation decision that is genuinely hard to reverse, because it is baked into every migration you have ever run.

**★ Schema-per-tenant makes `search_path` request state.** On a pooled connection, session-level state outlives the request that set it. That is the same failure described for RLS variables in [10c](10c-tenant-isolation-in-the-data-access-layer.md), and it has the same fix: set it inside the transaction, or not at all.

**★ "We'll add tenancy later" is a URL migration, a cache-key migration and a schema migration at once.** The `tenant_id` column is the easy third. Retrofitting a `[tenant]` segment invalidates every prerendered path, every `revalidatePath` call and every bookmark your customers have.

**★ A tenant slug is user-controlled input that ends up in a pathname.** Constrain it to `[a-z0-9-]`, reject leading/trailing hyphens, and reject anything that collides with a top-level route in your app (`/api`, `/login`, `/_next`). A tenant called `api` is a routing outage.

**★ A wildcard certificate covers one label, not two.** `*.sprintdesk.com` matches `acme.sprintdesk.com` and nothing deeper — `eu.acme.sprintdesk.com` is not covered, because the wildcard stands for a single left-most label (RFC 6125 §6.4.3, and every mainstream TLS client implements it that way). A "region plus tenant" hostname scheme quietly needs a certificate per region, or a nested wildcard your CA may not issue.

**★ One `NEXT_PUBLIC_SITE_URL` is wrong the moment tenants have their own hostnames.** Every absolute URL you emit — password-reset emails, OG image URLs, canonical tags, webhook callback URLs — has to be built from *this request's* tenant host. A single build-time constant sends Acme's users to Beta Corp's login page, and the link works, which is the worst version of the bug.

**★ OAuth redirect URIs are registered per host, and providers rarely accept wildcards.** With a wildcard-subdomain product, the callback usually has to land on one fixed host (`auth.sprintdesk.com`) which then hands the session back to the tenant host. That handoff is a security-relevant piece of code, and it is easy to write it so that any host can request a session for any tenant.

**★ Local development has no wildcard DNS.** Subdomain tenancy that works in production may be untestable on a developer machine without extra hosts-file entries or a local resolver. The usual mitigation is to make the tenant-resolution function environment-aware — hostname in production, path prefix in development — which means the code path you test is not the code path you ship. Prefer resolving to the same `[tenant]` segment in both, so only the resolver differs.

## Interview questions

**★ Why does the choice between subdomain and path-segment tenancy barely matter in Next.js, while the choice between "tenant in the URL" and "tenant in a header" matters enormously?**
Because subdomain tenancy is implemented as a proxy rewrite into a path segment, so both end up as the same thing from the router's point of view — a `[tenant]` dynamic segment. Header tenancy does not, and the difference is what the framework can key on. Route segments participate in `generateStaticParams`, root params, `revalidatePath` and the `use cache` cache key. Request headers participate in none of those, and cannot even be read inside a cache scope. So header tenancy gives up prerendering, per-tenant static shells and safe shared caching in one move.

**★ Your product manager wants `acme.sprintdesk.com` instead of `sprintdesk.com/acme`. What actually changes in the codebase?**
The `app/[tenant]/` tree does not change at all. You add a `proxy.ts` that reads `Host`, extracts the subdomain, and rewrites the pathname to prefix it. You add a wildcard DNS record and a wildcard certificate. You revisit cookies, because sessions become host-only by default and either need a parent-domain cookie or a per-subdomain sign-in. You revisit Server Actions' `allowedOrigins` if a CDN or proxy sits in front. And you remember that `revalidatePath` still takes the *destination* path, `/acme/board`, not the path the browser shows.

**★ What breaks if you set `Domain=sprintdesk.com` on the session cookie?**
Nothing breaks; something widens. The cookie is now sent to every subdomain of `sprintdesk.com`. That is the mechanism you want for cross-tenant SSO, and it means the cookie can no longer be treated as evidence of *which* tenant the user is acting in. Authorization has to check membership of the tenant named in the URL on every request. It also means any subdomain you do not fully control — a customer-chosen slug, a legacy host, a takeover — can read the session cookie.

**★ When would you actually choose database-per-tenant?**
When a contract or a regulator requires physical separation, when tenants differ by orders of magnitude in size so that noisy-neighbour effects on one table are unacceptable, or when you need per-tenant point-in-time restore. Not for "it feels safer". In a serverless deployment the connection topology is the thing that kills you: pools do not amortise across tenants, and the pool count scales with instances times tenants.

**★ A tenant signs up with the slug `admin`. What happens?**
With path-segment tenancy, `/admin` now has two meanings and whichever route wins is a bug — your internal admin area becomes a customer workspace or vice versa. With subdomain tenancy, `admin.sprintdesk.com` is a phishing-grade impersonation surface and, if your session cookie is domain-scoped, a session-reading one. Slugs need a reserved-word denylist and a character class enforced at creation.

**★ Where should "which tenant am I?" be resolved, and how many times per request?**
Once, as early as possible, in one place: proxy resolves hostname to slug and puts the slug in the pathname; the tenant layout resolves slug to record and authorizes it; everything below reads it from the root param or from the request-scoped DAL helper. The anti-pattern is re-deriving it — from cookies here, from `params` there, from a header somewhere else — because then the checks disagree and the weakest one wins.


**★ A user belongs to two tenants and wants both open in adjacent browser tabs. What does that require of your identification mechanism?**
It requires the tenant to be in the URL. With a header or session-only design there is exactly one "current tenant" per browser session, so opening the second workspace switches the first tab out from under the user. Path segments or subdomains give each tab its own tenant, and the remaining question is the session: a host-only cookie means signing in twice, a parent-domain cookie means one session whose membership is checked per tenant per request.

**★ A customer demands that their data stay in the EU. Which isolation model delivers that, and what does it do to your routing?**
Only database-per-tenant, or at minimum a separate database per region, can put rows in a specific jurisdiction — a shared table cannot be half in one region. The routing consequence is that tenant resolution now selects a *data region* as well as a tenant, so the hostname or the mapping has to carry it, and the render should run near that data rather than wherever the request landed. It also breaks the wildcard-certificate assumption above if you express the region as an extra hostname label.

---

← [06 · SprintDesk on Drizzle + Neon](06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) · [Chapter 15 overview](01-explanation.md) · Next → [10b · Tenant routing: proxy + root params](10b-tenant-routing-with-proxy-and-root-params.md)
