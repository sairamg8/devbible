---
title: "Next.js routes every mutation over POST and compares Origin against Host — which is a real CSRF defence right up until a reverse proxy, a wildcard in allowedOrigins, or a mutation that happens during rendering undoes it"
sidebar_label: "CSRF, origins and the audit"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Data Security in Next.js](https://nextjs.org/docs/app/guides/data-security) (docs `lastUpdated: 2026-08-25`) and [Server Actions](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`). Documentation-verified; no sandbox run.
> Target: **Next.js 16.3.4 · React 19.2.8**. Prior page: [The trust boundary around an action](03h-the-trust-boundary-around-a-server-action.md).

**Cross-site request forgery is the attack where the victim's own browser makes the request, so every credential is present and correct. Next.js's defence has three parts that only work together: mutations go over POST and never GET, the request's `Origin` is compared against `Host`, and the session cookie's `SameSite` default keeps the cookie off cross-site subresource requests. Each part has a way to be switched off by accident — a mutation performed during rendering, a wildcard added to `allowedOrigins` to unblock staging, a cookie relaxed to `SameSite=None` for an integration. This page closes the chapter's authorization arc with those three, and with the audit checklist the documentation publishes.**

## Mutations must not happen during rendering

> *"Mutations (e.g. logging out users, updating databases, invalidating caches) should never be a side-effect, either in Server or Client Components. Next.js explicitly prevents setting cookies or triggering cache revalidation within render methods to avoid unintended side effects."*

```tsx
// BAD: Triggering a mutation during rendering
export default async function Page({ searchParams }) {
  if ((await searchParams).logout) {
    const cookieStore = await cookies()
    cookieStore.delete('AUTH_TOKEN')
  }

  return <UserProfile />
}
```

```tsx
// GOOD: Using Server Actions to handle mutations
import { logout } from './actions'

export default function Page() {
  return (
    <>
      <UserProfile />
      <form action={logout}>
        <button type="submit">Logout</button>
      </form>
    </>
  )
}
```

> *"**Good to know:** Next.js uses `POST` requests to handle mutations. This prevents accidental side-effects from GET requests, reducing Cross-Site Request Forgery (CSRF) risks."*

The security argument is the one to keep: a mutation reachable by GET is a mutation reachable by an `<img src>` on someone else's site, or by a link in an email, or by a URL preview bot. `?logout=1` is the harmless-looking version of that bug; `?deleteAccount=1` is the same bug with a worse ending. It is also why the framework's refusal to let you set a cookie during rendering — which reads as an inconvenience when you first hit it, per [03](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md) — is doing double duty: it is a protocol constraint *and* a CSRF control.

⚠️ Prefetching makes this sharper than it looks. A `<Link>` that the router prefetches issues a GET before the user has decided to click. A mutation on that GET runs on hover.

## The `Origin` check

> *"Since Server Actions can be invoked in a `<form>` element, this opens them up to CSRF attacks."*

> *"Behind the scenes, Server Actions use the `POST` method, and only this HTTP method is allowed to invoke them. This prevents most CSRF vulnerabilities in modern browsers, particularly with SameSite cookies being the default."*

> *"As an additional protection, Server Actions in Next.js also compare the `Origin` header to the `Host` header (or `X-Forwarded-Host`). If these don't match, the request will be aborted. In other words, Server Actions can only be invoked on the same host as the page that hosts it."*

The envelope around a Server Action — this origin check in full, the 1MB body cap, rate limiting and idempotency — is [01e · The request envelope](01e-the-request-envelope-csrf-size-rate-limits-and-idempotency.md). This page takes the same check from the authorization side: what silently switches it off.

Two mechanisms, layered. `SameSite` decides whether the browser attaches your session cookie to a cross-site POST at all; the `Origin` comparison decides whether the server accepts the request even if it did. The second matters because `SameSite` is a browser behaviour and browsers vary, and because the first can be weakened by a decision made elsewhere in the codebase — a session cookie set `SameSite=None` for an embedded integration has lowered this defence for every action in the application, not only for the integration. That is the connection back to [03](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md), and it is why the cookie attributes were the first page of this arc rather than an appendix.

## `allowedOrigins`, and the wildcard that undoes it

> *"For large applications that use reverse proxies or multi-layered backend architectures (where the server API differs from the production domain), it's recommended to use the configuration option `serverActions.allowedOrigins` option to specify a list of safe origins. The option accepts an array of strings."*

```js
// next.config.js
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
    },
  },
}
```

The failure mode is procedural rather than technical. Actions break in a staging environment behind a proxy, the fastest thing that makes them work is a broad pattern, and that value ships. A wildcard here means any host matching it can host a page that POSTs to your actions with the user's cookies attached.

Keep the list literal where you can, and treat every entry as a security review item: **what would happen if someone else controlled this hostname?** For `*.my-proxy.com`, the answer depends on whether subdomains of that host can be claimed — which is exactly the question the `__Host-` cookie prefix in [03](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md) exists to make irrelevant for cookies, and which has no equivalent answer here.

## Route Handlers are not covered by any of this

The `Origin`/`Host` comparison is a Server Actions feature. A Route Handler is a route you wrote, and it gets whatever method and whatever CSRF posture you give it. Two consequences:

- **A `GET` Route Handler that mutates is a CSRF hole**, with none of the framework's protection in front of it. Use `POST`/`PUT`/`DELETE` for mutations and let the method carry meaning.
- **A `POST` Route Handler is not automatically origin-checked.** If it is cookie-authenticated and state-changing, you need `SameSite` on the session cookie doing the work, and an explicit origin check if you want the second layer.

```ts
// app/api/projects/[id]/archive/route.ts
import { headers } from 'next/headers'
import { archiveProject } from '@/lib/dal/projects'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headerList = await headers()
  const origin = headerList.get('origin')
  const host = headerList.get('host')

  // Explicit: Route Handlers do not inherit the Server Actions origin check.
  if (!origin || new URL(origin).host !== host) {
    return new Response(null, { status: 403 })
  }

  const { id } = await params
  await archiveProject(id) // auth + authz + ownership live in the DAL
  return Response.json({ ok: true })
}
```

## The audit, in the docs' own words

> *"**Data Access Layer:** Is there an established practice for an isolated Data Access Layer? Verify that database packages and environment variables are not imported outside the Data Access Layer."*

> *"**`\"use server\"` files:** Are the Action arguments validated in the action or inside the Data Access Layer? Is the user re-authorized inside the action? Does the action check ownership of the resource (authorization, not just authentication)? Are return values filtered to only what the client needs? Is database access delegated to a `server-only` Data Access Layer?"*

Five questions per action. Run them over every `'use server'` file in the codebase and you will find the real defects faster than any amount of reading UI code.

Two greps make the first item mechanical:

```bash
# Database clients must not be imported outside the DAL.
grep -rn "from '@/lib/db'" app components --include='*.ts' --include='*.tsx'

# Environment variables must not be read outside the DAL.
grep -rn 'process\.env' app components --include='*.ts' --include='*.tsx'
```

Both should return nothing. When they return something, you have found either a defect or a module that belongs in the DAL — and either way the answer is the same move.

## Where this chapter's authorization arc lands

Six pages, one rule: **the session tells you who, the data tells you whose, and the check belongs next to the data.** Cookie attributes ([03](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md)) protect the credential. The Data Access Layer ([03b](03b-the-data-access-layer-server-only-and-the-dto.md)) makes the check unforgettable. Session strategy ([03c](03c-stateless-vs-stateful-sessions-the-revocation-question.md)) decides whether you can revoke. Verification ([03d](03d-verifying-a-token-alg-none-and-algorithm-confusion.md)) decides whether the credential means anything. The library ([03e](03e-authjs-nextauth-in-the-app-router.md), [03f](03f-clerk-and-supabase-the-hosted-identity-trade.md)) decides who operates it. And ownership checks ([03g](03g-authorization-ownership-checks-and-every-entry-point.md)) plus the boundary rules ([03h](03h-the-trust-boundary-around-a-server-action.md)) and this page decide whether any of it holds.

The coarse filter that sits in front of all of it — and which is deliberately *not* the boundary — is [04 · Defence in depth: `proxy.ts` as a coarse filter](04-defense-in-depth-proxyts-as-a-coarse-filter.md).

## Gotchas

**★ Symptom: hitting a URL with `?logout=1` in an `<img>` tag on another site signs your users out.** Cause: a mutation performed during rendering, reachable by GET. Fix: move it into a Server Action behind a `<form>`; Next.js routes actions over POST specifically to prevent this.

```tsx
import { logout } from './actions'

export default function Page() {
  return (
    <form action={logout}>
      <button type="submit">Logout</button>
    </form>
  )
}
```

**★ Symptom: a mutation fires on hover, before the user clicks.** Cause: it lives on a GET route that the router prefetches. Fix: same as above — mutations belong in actions, which are POST-only and therefore never prefetched.

**★ Symptom: Server Actions break after moving behind a CDN or reverse proxy, with requests aborted.** Cause: the `Origin`/`Host` comparison fails because the proxy's host differs from the origin the page was served from. Fix: list the specific proxy hosts in `serverActions.allowedOrigins`; do not disable the check.

```js
module.exports = {
  experimental: { serverActions: { allowedOrigins: ['my-proxy.com'] } },
}
```

**★ Symptom: `allowedOrigins` contains a broad wildcard nobody can explain.** Cause: it was added to unblock a staging environment and never narrowed. Fix: replace it with the literal hostnames that actually need it, and treat each one as a reviewed security decision.

**★ Symptom: CSRF protection appears to weaken across the whole application after an unrelated integration ships.** Cause: the session cookie was relaxed to `SameSite=None` so it would be sent inside a third-party iframe. That lowers the browser-side half of the defence for every action, not only the integration's. Fix: keep the session cookie `Lax` and give the integration its own short-lived, narrowly scoped cookie.

**★ Symptom: a `GET` Route Handler that "just toggles a flag" is triggered by a link preview bot.** Cause: Route Handlers get no framework CSRF protection and GET carries no protection of its own. Fix: make it a `POST` and check the origin explicitly, since Route Handlers do not inherit the Server Actions check.

```ts
const headerList = await headers()
if (new URL(headerList.get('origin') ?? 'http://invalid').host !== headerList.get('host')) {
  return new Response(null, { status: 403 })
}
```

**★ Symptom: `new URL(origin)` throws inside a Route Handler and returns a 500 instead of a 403.** Cause: `origin` can be absent — same-origin GET navigations frequently omit it. Fix: treat a missing `Origin` as a failure for state-changing requests rather than parsing it optimistically, as the guard above does with its fallback.

**★ Symptom: the audit greps come back clean and an authorization bug is found anyway.** Cause: the greps check *where* data access lives, not whether the ownership comparison inside the DAL is correct. Fix: pair them with the five per-action questions, of which "does the action check ownership of the resource (authorization, not just authentication)" is the one that finds this class.

## Interview questions

**★ Why does Next.js refuse to let you set a cookie or revalidate during rendering?**
Because a render is not a request the user consented to perform. Renders happen on navigation, on prefetch, on retry, and can be triggered by a third party embedding a URL. A mutation in a render is therefore a mutation reachable by GET, which is the classic CSRF shape — an `<img src="https://yourapp.com/?logout=1">` on another site. Routing mutations through Server Actions forces them onto POST, where the `Origin`/`Host` check and `SameSite` cookies apply. The docs make the intent explicit: POST *"prevents accidental side-effects from GET requests, reducing Cross-Site Request Forgery (CSRF) risks."*

**★ Your Server Actions stopped working after the app moved behind a reverse proxy. Why, and what is the correct fix?**
Next.js compares the request's `Origin` header to `Host` (or `X-Forwarded-Host`) and aborts on a mismatch, as a CSRF defence. A proxy that presents a different host trips it. The fix is `serverActions.allowedOrigins` with the specific proxy hostnames listed. The wrong fix — and the tempting one — is a broad wildcard, because that list is one of the few things standing between your actions and a cross-origin POST.

**★ Next.js already does an `Origin`/`Host` comparison. Why does `SameSite` on the cookie still matter?**
Because they fail independently and cover different steps. `SameSite` stops the browser from attaching the session cookie to a cross-site request in the first place, so a forged POST arrives unauthenticated. The `Origin` check stops the server accepting the request even if a cookie did arrive. Relying on either alone is fragile: `SameSite` is browser behaviour and can be undermined by a cookie someone relaxed to `None`; the origin check is bypassed the moment a hostname you do not fully control ends up in `allowedOrigins`. The docs describe the second as *"an additional protection"*, which is precisely the right framing.

**★ Do Route Handlers get the same CSRF protection as Server Actions?**
No. The `Origin`/`Host` comparison, the POST-only constraint and the encrypted action IDs are Server Actions machinery. A Route Handler is a route you defined, with whatever methods you exported and whatever checks you wrote. So a cookie-authenticated, state-changing Route Handler needs `SameSite` doing real work and, if you want a second layer, an explicit origin comparison you implement yourself. The most common defect is a `GET` handler that mutates, which has no protection at all.

**★ How would you audit an existing Next.js codebase for authorization defects in an afternoon?**
Take the documentation's own checklist and run it mechanically. First, grep for database-client imports and `process.env` outside the DAL — both should be empty. Then, for every `'use server'` file, answer five questions: are the arguments validated, is the user re-authorized inside the action, does it check *ownership* of the specific resource rather than merely that someone is logged in, are return values filtered to what the client needs, and is database access delegated to a `server-only` module. That finds far more than reading components, because it is looking at the entry points rather than at the UI in front of them.

**★ What is the argument for putting the CSRF discussion in the same chapter as cookie attributes rather than in a general security chapter?**
Because the two are one mechanism. The framework's CSRF defence explicitly leans on `SameSite` cookie defaults, so a decision made about the session cookie — relaxing it to `None` for an embed, widening `Domain` for a subdomain — changes the CSRF posture of every Server Action in the application. Separating them produces exactly the failure where an integration ticket weakens an unrelated control and nobody connects the two.

---

← [The trust boundary around an action](03h-the-trust-boundary-around-a-server-action.md) · [Chapter 10 overview](01-explanation.md) · Next → [Defence in depth: `proxy.ts` as a coarse filter](04-defense-in-depth-proxyts-as-a-coarse-filter.md)
