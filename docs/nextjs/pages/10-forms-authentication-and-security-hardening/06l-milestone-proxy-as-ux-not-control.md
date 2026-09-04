---
title: "The proxy exists so a signed-out user does not watch a dashboard skeleton before being sent to the sign-in page — it is a UX optimisation with a documented hole in it, and the documentation is the one telling you not to rely on it"
sidebar_label: "06l · Milestone: proxy as UX, not control"
sidebar_position: 38
description: "Chapter 10's capstone, step eleven: SprintDesk's proxy.ts, the matcher that excludes the auth routes, why the check must read only the cookie and never the database, the Server Function hole the docs name explicitly, the runtime facts that make the old Edge argument stale, and the one job the proxy really is the right tool for."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [`proxy.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
> (`lastUpdated: 2026-08-25`), the [Authentication guide](https://nextjs.org/docs/app/guides/authentication)
> (`lastUpdated: 2026-08-25`) — section *Optimistic checks with Proxy (Optional)* — and the
> [Data Security guide](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** — Proxy defaults to the **Node.js runtime** since v16.0, and the
> `runtime` config option is not available in Proxy files. Documentation-verified; **no sandbox run**.

**Every argument on this page comes from the framework's own documentation, and the documentation's position is unusually blunt: the proxy is useful and it is not your control.** It says so in the authentication guide, it says so again in the reference under a heading about Server Functions, and the reference's migration section goes further and calls the whole feature a last resort. So SprintDesk ships a proxy, deliberately, for exactly one job — redirecting the obviously-signed-out fast, so nobody watches a dashboard skeleton resolve into a login page — and the real check stays where [06d](06d-milestone-the-data-access-layer.md) put it. What makes this worth a page rather than a sentence is the specific, documented way a proxy-based control fails, because it is not the way people expect. The general argument is [04 · `proxy.ts` as a coarse filter](04-defense-in-depth-proxyts-as-a-coarse-filter.md); what follows is SprintDesk's file.

## What the docs say the proxy is for

> *"There are some cases where you may want to use Proxy and redirect users based on permissions:*
> *— To perform optimistic checks. Since Proxy runs on every route, it's a good way to centralize redirect logic and pre-filter unauthorized users.*
> *— To protect static routes that share data between users (e.g. content behind a paywall)."*
> — [Authentication, Optimistic checks with Proxy (Optional)](https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional) (`lastUpdated: 2026-08-25`)

Note the word in the heading: **Optional**. And then the sentence that ends the section:

> *"While Proxy can be useful for initial checks, it should not be your only line of defense in protecting your data. The majority of security checks should be performed as close as possible to your data source"*

The second bullet above is the one exception worth remembering, and it is narrow: a *static* route whose data is shared between users is rendered at build time, so there is no request in which a DAL could run. The guide is explicit about that asymmetry — a DAL protects data fetched at request time, but for static routes that share data between users the data is fetched at build time, so use Proxy to protect those. SprintDesk has no such route; every authenticated page reads something per-request. If yours does, that route is the one place the proxy genuinely is the control.

## SprintDesk's proxy

```ts filename="proxy.ts"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * A UX optimisation, NOT an access control.
 * It looks for the presence of a session cookie and nothing else.
 * It never validates it, never decrypts it, and never touches the database.
 * The real check is in lib/dal/*, on every read and every write.
 */
const PUBLIC_PREFIXES = ['/sign-in', '/legal', '/pricing']

const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
]

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const hasCookie = SESSION_COOKIE_NAMES.some((name) =>
    request.cookies.has(name),
  )
  if (hasCookie) {
    return NextResponse.next()
  }

  const signIn = new URL('/sign-in', request.url)
  signIn.searchParams.set('next', pathname + search)
  return NextResponse.redirect(signIn)
}

export const config = {
  matcher: [
    // Everything except the auth endpoints, other API routes, static assets
    // and metadata files.
    '/((?!api/auth|api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

### Every line defended

**`api/auth` is first in the negative lookahead.** Without it, a signed-out user hitting `/api/auth/signin` is redirected to `/sign-in`, which links back to the auth endpoint, which redirects again — an infinite loop that presents as a broken cookie. Auth.js's own routes validate their own state; they do not need your filter.

**It checks `has`, not the value.** Deliberately. The guide's warning about this is about cost, and it is specific:

> *"since Proxy runs on every route, including prefetched routes, it's important to only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues."*
> — [Authentication, Optimistic checks with Proxy (Optional)](https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional)

**Including prefetched routes.** A page with a sidebar of twenty `<Link>` elements fires twenty prefetches, each of which is a request, each of which runs the proxy. Put a session-table lookup in there and you have multiplied your database load by however many links are on screen — for navigations the user has not made and may never make.

Since SprintDesk uses database sessions, the cookie holds an opaque session id and the proxy has nothing to validate anyway. It can answer *"is there a cookie"* and no more. That is precisely the right amount of knowledge for a component that is not the control.

**`next` carries the destination.** The proxy is where the `?next=` parameter is created, and [06j](06j-milestone-what-a-sign-in-endpoint-gives-away.md) is where it is made safe. The proxy sets it from `request.nextUrl.pathname`, which is same-origin by construction; the sign-in page and the sign-in action validate it anyway, because between those two points it is an attacker-controlled query string like any other.

**The matcher exists at all.** Without one, the reference states that Proxy runs on **every request**, including static files, image optimisations and assets in `public/` — and warns that auth logic can then unintentionally block CSS, JS or images from loading. A blank page whose stylesheet 302'd to `/sign-in` is a genuinely confusing morning.

## 🔴 The hole, named by the documentation

This is the paragraph to quote when someone proposes proxy-based authorization:

> *"[Server Functions](https://nextjs.org/docs/app/api-reference/directives/use-server) are not separate routes in this chain. They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on that path.*
>
> *A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."*
> — [`proxy.js`, Execution order](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#execution-order) (`lastUpdated: 2026-08-25`)

Read the failure mode carefully, because it is not "someone bypasses the proxy". It is worse than that: **moving a component to a different route can silently un-protect its actions.** No error, no warning, no diff in the action's own file. Somebody reorganises a folder, a Server Function's host route now matches an excluded pattern, and a mutation that was covered yesterday is not covered today. There is no test that fails.

The second documented weakness is architectural rather than accidental:

> *"Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN for fast redirect/rewrite handling, you should not attempt relying on shared modules or globals."*
> — [`proxy.js`, Good to know](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

A component that may be running at your CDN, told not to share modules with your application, is not where your authorization policy should live.

And the reference's own summary of the feature's role:

> *"We recommend users avoid relying on Middleware unless no other options exist."*
> — [`proxy.js`, How to Migrate](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#how-to-migrate)

## Two runtime facts that make the old argument stale

The received wisdom used to be "you cannot do real auth in middleware because it runs on the Edge runtime and your database driver will not work there". That argument is dead, and repeating it in 2026 marks a page as un-updated.

> *"Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."*
> — [`proxy.js`, Runtime](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#runtime)

The version history dates it: `v16.0.0` — *Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime.* Node.js APIs are available; the Authentication guide's own note is simply to check that your auth and session libraries are compatible.

**So the reason not to hit the database in the proxy is no longer "you can't". It is "it runs on every request including prefetches, and it is not the control anyway."** That is a better reason, and it survives the next runtime change.

## One more documented behaviour worth knowing

> *"Even when `_next/data` is excluded in a negative matcher pattern, proxy will still be invoked for `_next/data` routes. This is intentional behavior to prevent accidental security issues where you might protect a page but forget to protect the corresponding data route."*
> — [`proxy.js`, Negative matching](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#negative-matching)

The framework overrides your matcher here, in your favour. It is a good instinct to know about — and it is also the shape of the general problem: page routes and data routes are different URLs, and a filter that only knows about one of them protects only one of them. The DAL does not have this problem, because it sits underneath both.

## Gotchas

**★ Symptom: an infinite redirect between `/sign-in` and `/api/auth/signin`.** Cause: the matcher covers `/api/auth`, so the proxy's "no cookie → go to sign-in" rule fires on the endpoint that creates the cookie. Fix: exclude the auth routes first in the negative lookahead.

```ts
export const config = {
  matcher: ['/((?!api/auth|api|_next/static|_next/image|favicon.ico).*)'],
}
```

**★ Symptom: the app renders unstyled, or images fail to load, for signed-out users.** Cause: no matcher, so the proxy ran on every request including `_next/static`, `_next/image` and `public/` assets and redirected them to the sign-in page. The reference warns about exactly this. Fix: the negative-lookahead matcher above.

**★ Symptom: database load scales with the number of links on the page rather than with the number of navigations.** Cause: a session lookup inside the proxy. The proxy runs on every route *including prefetched routes*, so a sidebar of twenty links produces twenty proxy invocations before the user clicks anything. Fix: check only for the presence of the cookie, and leave validation to the DAL.

```ts
const hasCookie = request.cookies.has('authjs.session-token')
if (hasCookie) return NextResponse.next()
```

**★ Symptom: someone reorganises routes and a Server Action becomes callable without a session, with no test failing.** Cause: proxy-based protection plus the documented behaviour that Server Functions are POSTs to the route that uses them, so a matcher that excludes a path also skips the Server Function calls on it. Fix: the action's authorization has to be inside the action's own data path — which is [06h](06h-milestone-authorization-on-writes.md), and is why that page exists at all.

**★ Symptom: the proxy validates and decrypts the session token, and it works, and a security review still objects.** Cause: it is doing real work in the wrong place — on every prefetch, possibly at a CDN edge, in a component the docs say should not rely on shared modules or globals. Fix: keep the proxy's knowledge at "a cookie is present", and move anything that needs to be *true* rather than *likely* into the DAL. The proxy being fast and dumb is the design, not a limitation.

**★ Symptom: the sign-in page loads but always lands the user on `/boards` afterwards.** Cause: the proxy redirected without carrying the original destination. Fix: attach it, and let the sign-in page and action validate it.

```ts
const signIn = new URL('/sign-in', request.url)
signIn.searchParams.set('next', pathname + search)
return NextResponse.redirect(signIn)
```

**★ Symptom: `export const runtime = 'nodejs'` is added to `proxy.ts` to "make sure" it runs on Node, and the app throws.** Cause: the reference states the `runtime` config option is not available in Proxy files and that setting it will throw. Fix: delete the line. Proxy has defaulted to Node.js since v16.0; there is nothing to opt into.

**★ Symptom: a page is protected and its data route is not.** Cause: a matcher that excluded `_next/data`. Fix: nothing — the framework already overrides this, invoking the proxy for `_next/data` routes even when excluded, precisely to prevent that mistake. It is worth knowing because it is the exception to "the matcher decides", and because the general version of the problem (one resource, several URLs) is not something a matcher can solve in general.

**★ Symptom: two people disagree about whether the proxy is "part of the security model" and the argument recurs every quarter.** Cause: the answer is written in the documentation and nobody has pasted it into the codebase. Fix: put it in the file, verbatim, as the comment block at the top of `proxy.ts` above does. A control's status should be readable from the control.

**★ Symptom: a paywalled marketing page is statically generated and the DAL never runs for it.** Cause: static routes are rendered at build time, so there is no request-time check to perform — the guide notes that a DAL protects data fetched at request time and points at Proxy for static routes that share data between users. Fix: this is the one case where the proxy really is the control, and it should carry a comment saying so, because it contradicts every other rule on this page.

## Interview questions

**★ Is `proxy.ts` part of your security model?**
Not as the control. The framework's own documentation says the proxy should not be the only line of defence and that the majority of security checks should be performed as close as possible to the data source. SprintDesk uses it for one thing — redirecting a request with no session cookie before the dashboard starts rendering, so nobody watches a skeleton turn into a login page — and it checks only for the cookie's presence. There is one documented exception: a static route whose data is shared between users has no request in which a DAL could run, so for that route the proxy genuinely is the control.

**★ Describe the specific way a proxy-based authorization scheme fails.**
Not by being bypassed — by being silently removed. The `proxy.js` reference states that Server Functions are not separate routes: they are POSTs to the route where they are used, so a matcher excluding a path also skips the Server Function calls on that path. It then names the consequence directly: a matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. So a folder reorganisation, with no change to the action's own code and no failing test, can un-protect a mutation. That is the argument for putting the check inside the function that touches the data.

**★ Why must the proxy not query the database, given it now runs on Node.js?**
Because it runs on every route *including prefetched routes*, which the guide names as the reason to keep the check optimistic and cookie-only. A page with twenty links fires twenty prefetches; a session lookup in the proxy turns those into twenty database round trips for navigations that may never happen. The old reason — the Edge runtime cannot run your driver — is stale: Proxy has defaulted to Node.js since v16.0 and the `runtime` option is not even available there. The current reason is cost, plus the fact that the proxy is not the control, so the expensive validation would be buying you nothing you do not already have.

**★ What does a missing `matcher` do?**
It runs the proxy on every request, including `_next/static`, `_next/image` and everything in `public/` — and the reference explicitly warns that auth logic or redirects can then unintentionally block CSS, JS or images from loading. The visible symptom is an unstyled page or missing images for signed-out users, which almost nobody diagnoses as a proxy problem on the first try. The correct matcher is a negative lookahead that excludes the static prefixes *and* `api/auth`, since the auth endpoints must remain reachable to someone who is not yet signed in.

**★ Why is `api/auth` excluded, and does that not leave an unprotected endpoint?**
It is excluded because those endpoints are how a signed-out user becomes a signed-in one; filtering them means the sign-in page bounces to the auth route and the auth route bounces back, forever. It does not leave anything unprotected, because the proxy was never protecting them: `/api/auth/*` is Auth.js's catch-all Route Handler, which validates its own state, callbacks and CSRF tokens. The general principle is that an authentication endpoint is by definition reachable by the unauthenticated, so a filter that says "must be authenticated" cannot apply to it.

**★ Is the "you can't do auth in middleware because of the Edge runtime" argument still valid?**
No, and repeating it dates a codebase. The reference states that Proxy defaults to the Node.js runtime and that the `runtime` config option is not available in Proxy files — setting it throws — with the version history attributing both to v16.0.0. Node APIs and database drivers are available. The reasons to keep the proxy dumb are now entirely about placement and cost: it runs on every prefetch, it may be deployed to a CDN and is documented as something that should not rely on shared modules or globals, and it has a documented gap around Server Functions. Those reasons are better than the runtime one because they do not expire.

**★ The proxy sets `?next=`. Whose responsibility is it to make that safe?**
The sign-in page's and the sign-in action's, not the proxy's. The proxy builds it from `request.nextUrl.pathname`, which is same-origin by construction, so at the moment of creation it is trustworthy. But it then makes a round trip through the user's browser as a query string, so by the time anything reads it back it is attacker-controlled input like any other — the same value can be typed by hand. The rule is that trust does not survive a trip through the client, no matter who wrote the value originally.

---

← [06k · Sign-out and the caches](06k-milestone-sign-out-and-the-caches.md) · [Chapter 10 overview](01-explanation.md) · Next → [06m · What this costs and where it generalises](06m-milestone-what-it-costs-and-generalises.md)
