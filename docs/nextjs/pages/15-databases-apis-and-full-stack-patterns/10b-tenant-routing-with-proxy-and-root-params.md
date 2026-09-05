---
title: "Tenant routing is a proxy rewrite into a [tenant] root segment, and every subtlety lives in the matcher, the header plumbing and the fact that Server Actions cannot read root params"
sidebar_label: "10b · Tenant routing: proxy + root params"
sidebar_position: 64
description: "Resolving the tenant in proxy.ts, rewriting to a path segment, matcher coverage for Server Functions, passing values downstream without leaking them to the browser, and making [tenant] a root param."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy),
> [Proxy (getting started)](https://nextjs.org/docs/app/getting-started/proxy),
> [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params),
> [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) and the
> [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions).
> Target: **Next.js 16.3.4** · `proxy.ts` replaced `middleware.ts` in v16 · `next/root-params` added in v16.3.0.

**The whole of hostname-based tenancy is one function: read `Host`, turn it into a tenant slug, rewrite the pathname so the slug becomes the first route segment. Everything hard about it is downstream of that one line — which requests the proxy actually sees, how the resolved tenant reaches the render without also reaching the browser, and the fact that the elegant way to read the tenant on the server (`next/root-params`) is unavailable in exactly the two places that mutate data.**

## The rewrite

```ts filename="proxy.ts"
import { NextResponse, type NextRequest } from 'next/server'

const ROOT_DOMAIN = process.env.ROOT_DOMAIN! // 'sprintdesk.com'
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'assets'])

export async function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0]
  const url = request.nextUrl.clone()

  // Apex and reserved hosts render the marketing / control-plane tree unchanged.
  if (host === ROOT_DOMAIN || !host.endsWith(`.${ROOT_DOMAIN}`)) {
    return NextResponse.next()
  }

  const sub = host.slice(0, -(ROOT_DOMAIN.length + 1))
  if (RESERVED.has(sub)) return NextResponse.next()

  url.pathname = `/${sub}${url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
}
```

Three things in there are load-bearing.

**`rewrite`, not `redirect`.** A rewrite keeps the browser's URL as `acme.sprintdesk.com/board` while the server renders `app/[tenant]/board/page.tsx` with `tenant = 'acme'`. A redirect would put the slug in the address bar and defeat the point.

**`request.nextUrl.clone()`.** Mutating `nextUrl` in place is the classic way to produce a rewrite loop; clone, mutate the clone, pass it to `rewrite`.

**The matcher.** Without a `matcher`, proxy runs on **every** request, including `_next/static`, `_next/image` and everything in `public/`. Your rewrite would then prefix static asset paths with a tenant slug and your CSS would 404. The negative pattern above is the shape the docs recommend; adapt it, do not omit it.

## The matcher gotcha that costs you a Server Action

Server Functions are not separate routes. They are dispatched as POST requests **to the route that uses them**. So a matcher that excludes a path also excludes the Server Actions invoked from that path — and the Next.js docs call this out directly, because a matcher edit or a refactor that moves an action to another route can silently remove proxy coverage.

For tenancy that means: if proxy is the thing that establishes "this request is Acme", and proxy does not run for the action's POST, the action runs with no tenant. If your action reads the tenant from an injected header, that header is absent. If it reads it from the rewritten pathname, the pathname was not rewritten.

> *"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."*
> — [proxy.js, Execution order](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#execution-order)

Treat proxy as routing, never as the security boundary. The check that matters is the one in the Data Access Layer ([10c](10c-tenant-isolation-in-the-data-access-layer.md)).

## Custom domains: the lookup you cannot cache the usual way

Vanity domains (`tasks.acme.com`) need a hostname → tenant lookup. Two constraints make this awkward:

- `fetch` cache options do nothing here. Setting `cache`, `next.revalidate` or `next.tags` on a fetch inside proxy has no effect, so you cannot lean on the framework's cache to amortise the lookup.
- Proxy is documented as being deployed in optimized cases to the CDN, which is why the docs tell you not to rely on shared modules or globals. A module-level `Map` you populate on first request is not a cache you can reason about.

Workable answers, in order of preference: an edge KV / Redis with its own TTL; a signed, short-lived mapping baked into a cookie after the first resolution; or accepting the lookup cost and keeping it in-region. What does not work is `fetch('/api/tenant-by-host', { next: { revalidate: 3600 } })`.

## Passing the resolved tenant downstream — and the header that leaks

If proxy resolves more than the slug (a tenant ID, a plan tier), you may want to hand it to the render. `NextResponse.next()` takes a `request` option for that:

```ts filename="proxy.ts"
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-tenant-id', record.id)

return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
```

The distinction that bites people: `NextResponse.next({ request: { headers } })` makes the headers visible **upstream, to your server code**. `NextResponse.next({ headers })` sets them on the **response**, which means the browser sees them. Putting an internal tenant UUID or a plan flag in a response header is a small but real information disclosure, and it will sit in every CDN log you own.

Also: keep these headers small. Oversized headers can trip a `431 Request Header Fields Too Large` at whatever web server sits in front of you.

One more, easy to hit while debugging: during RSC requests Next.js strips internal Flight headers (`rsc`, `next-router-state-tree`, `next-router-prefetch`) from the `request` object in proxy, deliberately, so that an RSC navigation and an HTML load cannot be handled differently. If you are hand-rolling rewrites with `fetch` instead of `NextResponse.rewrite`, you must forward those yourself; `NextResponse.rewrite` propagates them for you.

## Proxy runs before routing, and it runs in Node

Two facts that reorder your mental model:

- Proxy sits at step 3 of the request pipeline: `next.config` `headers`, then `redirects`, then **proxy**, then `beforeFiles` rewrites, then filesystem routes, then `afterFiles`, then dynamic routes, then `fallback`. So a `redirects` entry in `next.config.js` wins over your proxy, and your proxy wins over every route.
- Proxy defaults to the Node.js runtime in Next.js 16, and the `runtime` route-segment config option is not available in a proxy file — setting it throws. Node APIs are on the table; do not paste in the old `export const runtime = 'edge'` line from a v13 middleware.

## Making `[tenant]` a root param

Place the dynamic segment **above the root layout** and it stops being a prop you drill and becomes an import:

```
app/
  [tenant]/
    layout.tsx      ← root layout: has <html> and <body>
    board/page.tsx
    settings/page.tsx
```

```tsx filename="app/[tenant]/layout.tsx"
import { tenant } from 'next/root-params'

export default async function RootLayout(props: LayoutProps<'/[tenant]'>) {
  const slug = await tenant()
  return (
    <html lang="en" data-tenant={slug}>
      <body>{props.children}</body>
    </html>
  )
}
```

Any Server Component or server-side utility anywhere below can now `import { tenant } from 'next/root-params'` and await it. The mechanics, the typing and the four restrictions are covered in
[../02-routing-and-navigation/11-root-params.md](../02-routing-and-navigation/11-root-params.md) and
[../02-routing-and-navigation/11b-root-params-restrictions-and-typing.md](../02-routing-and-navigation/11b-root-params-restrictions-and-typing.md). What matters *here* is the tenancy-specific consequences.

**The cache-key consequence is the big one.** Because the getters are imported functions, Next.js can see which root params a cached function actually reads, and only those join its cache key. So this is tenant-safe by construction:

```tsx filename="app/[tenant]/board/columns.tsx"
import { tenant } from 'next/root-params'
import { cacheTag } from 'next/cache'

async function getColumns() {
  'use cache'
  const slug = await tenant()      // ← joins the cache key
  cacheTag(`columns:${slug}`)      // ← and the invalidation tag
  return db.column.findMany({ where: { tenantSlug: slug } })
}
```

That is the whole argument of [10d](10d-tenancy-and-caching.md) in seven lines.

**Server Actions cannot read it.** `await tenant()` inside a `'use server'` function throws — permanently, not as a temporary gap. Route Handlers cannot read it either, though that one is documented as planned support. Both need the tenant supplied another way; see [10c](10c-tenant-isolation-in-the-data-access-layer.md).

**Under Cache Components, `generateStaticParams` is mandatory.** A root param with no `generateStaticParams` value fails the build — each root param must have at least one value.

```tsx filename="app/[tenant]/layout.tsx"
export async function generateStaticParams() {
  // Prerender the shells that are worth prerendering, not all 40,000 tenants.
  const top = await db.tenant.findMany({
    where: { plan: 'enterprise' },
    select: { slug: true },
    take: 200,
  })
  return top.map(({ slug }) => ({ tenant: slug }))
}
```

Everything not listed is still served — `dynamicParams` defaults to `true`, so unlisted tenants render on demand. Set `export const dynamicParams = false` only if your tenant set is genuinely closed, because with it an unlisted slug 404s, and a tenant that signed up after your last deploy is an unlisted slug.

**Two root layouts widen the type.** A real product has a marketing tree and a tenant tree:

```
app/
  (marketing)/layout.tsx     ← root layout, no [tenant]
  [tenant]/layout.tsx        ← root layout, has [tenant]
```

With more than one root layout, a param that does not exist in every one of them is typed `string | undefined`, and `await tenant()` genuinely returns `undefined` on marketing routes. Handle it; do not `!` it away.

**Kebab-case is a hard error.** `app/[tenant-slug]/` fails at dev time or build time, because the export name has to be a valid JavaScript identifier. Use `[tenant]` or `[tenantSlug]`.

## Tenant-aware metadata

`generateMetadata` is a Server Component context, so the getter works there — no prop drilling to get a per-tenant title:

```tsx filename="app/[tenant]/board/page.tsx"
import { tenant } from 'next/root-params'
import { getTenantBySlug } from '@/data/tenants'

export async function generateMetadata() {
  const record = await getTenantBySlug(await tenant())
  return {
    title: `${record?.name ?? 'SprintDesk'} · Board`,
    robots: { index: false }, // tenant workspaces are not public content
  }
}
```

That `robots` line is not decoration. Every tenant workspace under a wildcard domain is a crawlable URL unless you say otherwise.

## Gotchas

**★ No matcher means proxy rewrites your static assets.** A rewrite that blindly prefixes the pathname will turn `/_next/static/chunks/main.js` into `/acme/_next/static/chunks/main.js`. The page loads, unstyled, with no JavaScript, and the network tab is a wall of 404s. Always exclude `_next/static`, `_next/image` and file-extension paths.

**★ A matcher that excludes a path also excludes the Server Actions on that path.** Actions POST to their own route. If proxy is where the tenant header is set, that action sees no tenant header. This is documented behaviour, not a bug, and the mitigation is to authorize inside the action rather than to widen the matcher.

**★ Mutating `request.nextUrl` instead of a clone produces a rewrite loop.** The rewritten request comes back through proxy, gets prefixed again, and you get `/acme/acme/acme/board`. Clone first; or guard with `if (url.pathname.startsWith('/' + sub)) return NextResponse.next()`.

**★ `NextResponse.next({ headers })` is not `NextResponse.next({ request: { headers } })`.** The first sets response headers the browser can read. The second sets request headers your server code can read. Confusing them either leaks internal IDs to the client or silently fails to deliver them to the render.

**★ `fetch` cache options are inert inside proxy.** `next.revalidate` and `next.tags` do nothing there. A custom-domain lookup written as a cached fetch is an uncached database round trip on every single request, including asset requests if your matcher is loose.

**★ `export const runtime = 'edge'` in `proxy.ts` throws.** The `runtime` segment config is not available in proxy files at all, and the default is Node.js since v16. This is one of the most common leftovers from a `middleware.ts` migration.

**★ Root params are unavailable in Server Actions and `unstable_cache`, permanently.** Not "not yet". Only Route Handler support is described as planned. An action that needs the tenant must receive it or re-derive it from the session — and must re-authorize it either way.

**★ Under Cache Components, forgetting `generateStaticParams` on `[tenant]` fails the build, not the request.** Every root param needs at least one value. The fix is not to enumerate every tenant; return the handful worth prerendering and let `dynamicParams` cover the rest.

**★ `dynamicParams = false` locks out every tenant created since the last deploy.** It is the right setting for a closed set of tenants and a production incident for an open one.

**★ Two root layouts turn `await tenant()` into `string | undefined` everywhere, including files that only ever run under `[tenant]`.** The type is computed across all root layouts, not per route. Narrow once in a helper rather than at forty call sites.

**★ A wildcard subdomain product needs `serverActions.allowedOrigins` if a CDN or proxy rewrites the host.** Next.js compares the request's `Origin` against `Host` (or `X-Forwarded-Host`) and rejects mismatches. `allowedOrigins` accepts wildcard entries such as `'*.my-proxy.com'`.

**★ Multi-instance deployments need a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.** Variables captured by an inline Server Action are encrypted before being sent to the client. If you bind a tenant ID into an inline action's closure — a reasonable pattern — a key that differs per instance makes the action fail to decrypt on the instance that handles the POST.

**★ Tenant workspace pages are indexable by default.** A wildcard certificate plus a public route means Googlebot can reach `acme.sprintdesk.com` the moment someone links it. Set `robots: { index: false }` on the tenant tree unless public workspaces are a feature you sell.

## Interview questions

**★ Why is `NextResponse.rewrite` used for subdomain tenancy rather than `NextResponse.redirect`?**
Because the tenant needs to be a route segment for the router, and a hostname for the user, simultaneously. A rewrite changes only the path the server routes on; the browser keeps `acme.sprintdesk.com/board`. A redirect changes the address bar, which exposes the internal path shape, breaks the branding you built subdomains for, and doubles the round trips.

**★ Proxy sets an `x-tenant-id` request header and your Server Action reads it. Why is that fragile?**
Two reasons. First, Server Functions POST to the route they are used on, so the proxy matcher decides whether the action's request is seen at all — and a matcher edit or moving the action to another route silently removes that coverage. Second, even when it works, a header is not an authorization decision. The action still has to check that the authenticated session is a member of that tenant, because the header only says which tenant was asked for.

**★ Why does reading the tenant through `next/root-params` inside a `'use cache'` function produce a correct cache key, when reading it from `headers()` cannot?**
Root param getters are imported functions, so the compiler can see which ones a cached function reads and add exactly those to the cache key. Request APIs like `headers()` are not permitted inside a cache scope at all — the read throws `next-request-in-use-cache`, and the ban follows the call stack into helpers. So the only way headers can influence a cached value is if you read them outside and pass the value in, which puts it in the key as an argument. The root-param path gets you the same key contribution without the plumbing.

**★ You have 40,000 tenants and Cache Components enabled. What do you return from `generateStaticParams` for `[tenant]`?**
Not 40,000 entries. Return the subset worth prerendering — the largest or most-trafficked tenants — and rely on `dynamicParams` (default `true`) to render everything else on demand. The build requires at least one value for each root param; it does not require completeness. Setting `dynamicParams = false` here would 404 every tenant created since the last deploy.

**★ Where in the request pipeline does proxy run, and what does that mean for a `redirects` entry in `next.config.js`?**
Proxy is third: `headers`, then `redirects`, then proxy, then `beforeFiles` rewrites, then filesystem routes, then `afterFiles`, then dynamic routes, then `fallback`. So a `next.config` redirect fires before your tenant rewrite ever runs. If a legacy redirect matches a tenant path, the user is redirected away before tenancy is resolved.

**★ Your marketing site and your tenant app both need a root layout. What does that do to `await tenant()`?**
It makes the return type `string | undefined`, everywhere, because root param getter types are computed across all root layouts and `tenant` does not exist in the marketing one. At runtime it really is `undefined` on marketing routes. The right move is a single narrowing helper — `requireTenant()` that throws or calls `notFound()` — rather than a non-null assertion at every call site.

**★ How would you support customer-owned domains like `tasks.acme.com`?**
Proxy reads `Host`, looks the hostname up in a mapping, and rewrites to `/{slug}/…`. The lookup is the hard part: fetch cache options are inert inside proxy, so it needs its own store — an edge KV or Redis with a TTL — or the mapping has to be encoded somewhere the request already carries. Operationally you also need per-domain certificate issuance and a verification flow (a DNS TXT record or a well-known path) so a customer cannot claim a domain they do not own.

**★ What is the difference between the two `headers` options on `NextResponse.next()`, and why does it matter for tenancy?**
`NextResponse.next({ request: { headers } })` rewrites the headers your application sees; `NextResponse.next({ headers })` sets headers on the response the browser receives. Tenancy plumbing wants the first. Using the second publishes your internal tenant identifiers to the client and to every intermediary log.

---

← [10 · Multi-tenant applications](10-multi-tenant-applications.md) · [Chapter 15 overview](01-explanation.md) · Next → [10c · Isolation in the data access layer](10c-tenant-isolation-in-the-data-access-layer.md)
