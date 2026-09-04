---
title: "A proxy.ts check runs before the route and knows nothing about what the route will read, so the documentation calls it optimistic and says outright that it must not be your only line of defence"
sidebar_label: "04 · `proxy.ts` as a coarse filter"
sidebar_position: 4
description: "What proxy.ts can and cannot see, the optimistic-redirect pattern the docs endorse for UX and explicitly refuse to endorse as a control, why Server Functions are not routes in the matcher chain, the allowlist that rots, and the Edge-runtime argument that is now history."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [`proxy.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`), [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`) and [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`). CVE identifiers are taken from [14 · the 2026 CVE record](14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md), not from memory.
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**.

**`proxy.ts` is a fast negative filter and nothing more. It runs before any route renders, it is handed a URL, some headers and some cookies, and it is explicitly documented as something that may be deployed away from your application entirely — onto a CDN. That set of inputs is enough to answer *"is there plausibly a session here?"* and structurally incapable of answering *"may this person read row 42?"*, because row 42 is not in the request. The Next.js authentication guide says the quiet part out loud: the proxy check is **optimistic**, it must read the cookie and nothing else, and it *"should not be your only line of defense in protecting your data."* This page is about what the layer can actually enforce, [04b](04b-proxy-configuration-matchers-runtime-and-what-the-rename-meant.md) about the configuration surface that decides where it runs, and [04c](04c-defence-in-depth-the-innermost-layer-that-can-see-the-fact.md) about where the real gate goes.**

## What proxy can see, and the exact shape of what it cannot

Three sentences from the file-convention reference fix the layer's position, and every design decision follows from them.

> *"Proxy executes before routes are rendered."*

> *"Proxy will be invoked for **every route in your project**."*

> *"Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN for fast redirect/rewrite handling, you should not attempt relying on shared modules or globals."*

Read the third one as an architectural statement rather than a performance tip. The proxy is not a function your route calls; it is a box that may sit in a different process, in a different region, on different hardware. It therefore has exactly one channel to your application:

> *"To pass information from Proxy to your application, use [headers](#setting-headers), [cookies](#using-cookies), [rewrites](/docs/app/api-reference/functions/next-response#rewrite), [redirects](/docs/app/api-reference/functions/next-response#redirect), or the URL."*

So the proxy sees: the request method, the path, the query, the headers, the cookies. It does **not** see which Server Component the route will render, which database query that component will run, which row that query will return, or whether the session it just decrypted has since been revoked — the guide tells you not to look that last one up here. Everything it learns must be re-encoded as a string on a header before the route can use it, and a header your proxy sets is a header your route has to *trust*, which is a new problem rather than a solved one.

There is a fourth constraint that catches people building a "protect only the document request" scheme:

> *"During RSC requests, Next.js strips internal Flight headers from the `request` instance in Proxy. For example, headers like `rsc`, `next-router-state-tree`, and `next-router-prefetch` are not exposed through `request.headers`. This is to prevent accidentally handling an RSC request differently than the HTML request as both need to align."*

You cannot branch on "is this the RSC navigation or the initial HTML" inside proxy. The framework removed that information deliberately, because a check that fires on one and not the other is a hole.

## The optimistic pattern the docs endorse — and what they endorse it for

The authentication guide gives the pattern a name and a scope. Both halves matter:

> *"**Optimistic**: Checks if the user is authorized to access a route or perform an action using the session data stored in the cookie. These checks are useful for quick operations, such as showing/hiding UI elements or redirecting users based on permissions or roles."*

> *"However, since Proxy runs on every route, including [prefetched](/docs/app/getting-started/linking-and-navigating#prefetching) routes, it's important to only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues."*

And then, unambiguously:

> *"While Proxy can be useful for initial checks, it should not be your only line of defense in protecting your data. The majority of security checks should be performed as close as possible to your data source."*

The documented shape, with one correction the docs' own snippet needs (see the first gotcha):

```ts filename="proxy.ts"
import { NextResponse, type NextRequest } from 'next/server'
import { decrypt } from '@/app/lib/session'

// Prefixes, not exact paths — a nested route must inherit its parent's gate.
const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/admin']
const PUBLIC_PATHS = ['/', '/login', '/signup']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
  const isPublic = PUBLIC_PATHS.includes(path)

  // Cookie only. No database, no network call: this runs on every prefetch.
  const cookie = req.cookies.get('session')?.value
  const session = await decrypt(cookie)

  if (isProtected && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isPublic && session?.userId && !path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

Everything that code establishes is *"a cookie decrypted to something with a `userId` in it."* It has not established that the user exists, that the session was not revoked ten minutes ago, that the account is not suspended, or that this user has anything to do with the resource the URL names. It is a bouncer checking that you have *a* wristband, not *the* wristband, and it is worth having for exactly that reason: it turns a wasted render into a cheap redirect and it centralises the login bounce in one file.

## 🔴 Server Functions are not routes in the matcher chain

This is the single most important paragraph in the proxy reference and it is buried in a *Good to know* under the execution order:

> *"[Server Functions](/docs/app/api-reference/directives/use-server) are not separate routes in this chain. They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on that path."*

> *"A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone. See the [Data Security guide](/docs/app/guides/data-security#authentication-and-authorization) for recommended patterns."*

Three consequences, in order of how badly each one bites.

**Your action's proxy coverage is a property of the file the action is *used* in**, not of where it is defined. Move `<DeleteProjectButton>` from `/dashboard/projects/[id]` into a shared `/components` tree rendered from a public marketing page, and the action now arrives as a POST to a path your matcher never protected. Nothing in the diff says "authorization changed."

**Excluding `/api` from the matcher does not exclude your mutations**, because Server Actions are not under `/api`. People write the negative lookahead assuming it carves out "the backend"; it carves out Route Handlers only.

**The reverse is worse.** A negative-lookahead matcher that excludes a path for performance reasons — a high-traffic public page, say — removes the proxy check from every Server Function invoked on that page in the same stroke, with no error and no warning.

There is no fix at this layer. The fix is that the check does not live at this layer:

```ts filename="app/lib/actions.ts"
'use server'

import { verifySession } from '@/app/lib/dal'
import { db } from '@/app/lib/db'

export async function deleteProject(projectId: string) {
  // Runs whether or not proxy ran, whether or not a form rendered,
  // and whether or not this action is reachable from any UI at all.
  const session = await verifySession()

  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('Not found')
  if (project.ownerId !== session.userId) throw new Error('Forbidden')

  await db.project.delete({ where: { id: projectId } })
}
```

The full treatment of an action as an untrusted entry point is [01 · Server Actions: where the check lives](01-server-actions-for-mutations-with-useactionstate-and-useopti.md). The related mechanism, that an action is a public POST endpoint regardless of which page rendered it, is already written up in [ch07 · 03c](../07-error-handling-loading-states-and-resilience/03c-an-action-is-a-public-post-endpoint.md).

## The empirical proof: a proxy bypass shipped as a CVE

The argument above is a design argument. 2026 supplied the evidence. Per [14 · the 2026 CVE record](14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md), **CVE-2026-64642** — App Router, built with Turbopack, with a single entry in `config.i18n.locales` — was a proxy/middleware bypass, and the consequence recorded there is that any authentication or security checks the middleware or proxy performed were bypassed. Turbopack is the default bundler in 16.x, and a one-entry `i18n.locales` array is a configuration teams add as a formality.

An application whose proxy was a *filter* lost a redirect on that build. An application whose proxy was the *gate* lost the gate. Same bug, two entirely different incident reports.

The same record carries **CVE-2026-64643**, unauthenticated disclosure of internal Server Function endpoint IDs — reconnaissance that makes direct invocation of your mutations practical. Both entries carry their severities and affected version ranges on page 14, which is where this chapter keeps the record.

## Gotchas

**★ Symptom: `/dashboard` redirects to login correctly but `/dashboard/billing` renders for anonymous users.**
Cause: the authentication guide's optimistic snippet uses `protectedRoutes.includes(path)`, which is exact string equality. `'/dashboard/billing'` is not in `['/dashboard']`. The matcher regex ran; the handler's own check did not fire.
Fix: match on prefix, not equality.

```ts filename="proxy.ts"
const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/admin']

const isProtected = PROTECTED_PREFIXES.some(
  (prefix) => path === prefix || path.startsWith(`${prefix}/`)
)
```

**★ Symptom: a Server Action runs for a signed-out caller even though proxy protects that page.**
Cause: Server Functions are *"handled as POST requests to the route where they are used"*, and matcher changes or a component move can *"silently remove Proxy coverage"*. Also, proxy protects the render; nothing stops a direct POST to a page path whose matcher you later narrowed.
Fix: verify inside the function, every time — the version shown under [Server Functions are not routes](#-server-functions-are-not-routes-in-the-matcher-chain) above. The proxy check stays as UX.

**★ Symptom: the route cannot read the `x-user-id` the proxy set, but the browser can.**
Cause: `NextResponse.next({ headers })` sets *response* headers, which go to the client. Request headers need the nested `request` key. The reference calls this out explicitly: use `NextResponse.next({ request: { headers: requestHeaders } })`, **not** `NextResponse.next({ headers: requestHeaders })`, *"which makes `requestHeaders` available to clients."*
Fix:

```ts filename="proxy.ts"
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-user-id', session.userId)

// Upstream to the route — not down to the browser.
return NextResponse.next({ request: { headers: requestHeaders } })
```

⚠️ And having done that, do not let the route treat `x-user-id` as authoritative. Anything a proxy can set, a client can send if a deployment ever exposes the origin directly. Strip it on the way in or re-derive identity from the cookie in the Data Access Layer.

**★ Symptom: proxy caches a permission lookup in a module-level `Map` and it works perfectly in `next dev`, then behaves as if the cache is always empty in production.**
Cause: *"Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN … you should not attempt relying on shared modules or globals."* In development, proxy and your render share a process. In production they may not.
Fix: hold no state in proxy. If a value must survive, put it in a cookie or a header, or look it up in the Data Access Layer where a request-scoped `cache()` is real. Full treatment in [ch02 · 07](../02-routing-and-navigation/07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md).

**★ Symptom: a database session-revocation check in proxy makes every hover slow and hammers the session table.**
Cause: proxy runs on every route *"including prefetched routes"* — hovering a `Link` is a request.
Fix: read the cookie in proxy and nothing else; do the revocation check in `verifySession()` where React's `cache()` deduplicates it per render pass. Sessions and the revocation question are [03 · Sessions: the cookie is the control](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md).

**★ Symptom: you try to run the auth check only on the initial HTML request and skip it for client-side navigations, and the branch never fires.**
Cause: Next.js strips `rsc`, `next-router-state-tree` and `next-router-prefetch` from `request.headers` in proxy, *"to prevent accidentally handling an RSC request differently than the HTML request as both need to align."*
Fix: there is nothing to fix at this layer — the design is deliberate and correct. Do not try to reconstruct the distinction from `Accept` or `Sec-Fetch-*`; put the check where both paths necessarily pass through it, which is the data read.

**★ Symptom: proxy starts returning 431 after you add role information to a request header.**
Cause: *"Avoid setting large headers as it might cause [431 Request Header Fields Too Large](https://developer.mozilla.org/docs/Web/HTTP/Status/431) error depending on your backend web server configuration."* A serialised permission set is a large header.
Fix: pass an opaque identifier and resolve the permissions server-side.

```ts filename="proxy.ts"
// Not the whole permission set — just the subject.
requestHeaders.set('x-session-subject', session.userId)
```

## Interview questions

**★ Why is a check in `proxy.ts` structurally unable to answer an authorization question, no matter how much code you put in it?**
Because authorization is a question about a *fact*, and the fact is usually not in the request. `/projects/42` plus a session cookie tells you a path and an identity claim; it does not tell you whether user 7 is a member of project 42, because membership is a row in a table. The proxy would have to fetch that row to know, and the documentation forbids it — the layer runs on every route including prefetches, and it may be deployed to a CDN away from your data. So the layer can enforce facts that are *in* the request (there is a cookie, it decrypts, it has a `userId`) and nothing else. Anything that depends on a row belongs where the row is read.

**★ What does the phrase "optimistic check" mean in the Next.js authentication guide, and what is the pessimistic counterpart?**
Optimistic means the check uses only the session data in the cookie, and is used for *"showing/hiding UI elements or redirecting users based on permissions or roles"* — user experience, plus a cheap pre-filter. The counterpart the guide calls **secure**: a check against session data in the database, used *"for operations that require access to sensitive data or actions."* The two are not alternatives; the optimistic one saves a render, the secure one is the control. Both are recommended, in the Data Access Layer.

**★ A teammate excludes `/api` from the proxy matcher for performance. Which mutations lose their proxy check?**
None of the Server Actions, and all of the Route Handlers under `/api`. Server Functions are not routes in the matcher chain — they are POST requests to the route where they are used — so excluding `/api` touches Route Handlers only. The trap runs the other way: excluding a *page* path, say a high-traffic marketing route, removes proxy coverage from every Server Function invoked on that page. The docs say a matcher change *"can silently remove Proxy coverage"*, which is why the same paragraph ends with "always verify inside each Server Function."

**★ How did CVE-2026-64642 test the difference between a proxy-as-filter and a proxy-as-gate design?**
It was a proxy/middleware bypass affecting App Router applications built with Turbopack — the default bundler in 16.x — with a single entry in `config.i18n.locales`. Per the chapter's CVE record, the consequence was that any authentication or security checks the proxy performed were bypassed. In a filter design that costs you a redirect: the request reaches the route, the Data Access Layer refuses it, and a signed-out visitor sees a login page one hop later than intended. In a gate design it is an authentication bypass. The bug was identical; the blast radius was a design decision made months earlier.

**★ You need to protect a statically generated page whose content is shared between users — a paywalled article. Where does that check go?**
That is the one case where proxy is the right layer rather than the fallback, and the authentication guide says so directly: use proxy *"to protect static routes that share data between users (e.g. content behind a paywall)"*, and it notes that a Data Access Layer protects data fetched at request time, whereas static-route data is fetched at build time and so has no request-time read to attach a check to. [04c](04c-defence-in-depth-the-innermost-layer-that-can-see-the-fact.md) works through why that is a consequence of the layering rule rather than an exception to it.

---

← [Authentication patterns](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md) · [Chapter 10 overview](01-explanation.md) · Next → [04b · Matchers, runtime and the rename](04b-proxy-configuration-matchers-runtime-and-what-the-rename-meant.md)
