---
sidebar_position: 12
title: "The other half of a BFF is everything that forwards: proxy handlers, the one-file proxy, webhooks that must authenticate themselves, and callbacks that must not become open redirects"
sidebar_label: "BFF: proxying, webhooks, callbacks"
description: "Proxying to an upstream backend without creating an SSRF, the NextRequest and NextResponse extensions, revalidation webhooks and OAuth callback routes, the single project-level proxy file, and what the automatic OPTIONS handler does not give you."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to use Next.js as a backend for your frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (docs `lastUpdated` 2026-06-25), [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [`NextRequest`](https://nextjs.org/docs/app/api-reference/functions/next-request), [`NextResponse`](https://nextjs.org/docs/app/api-reference/functions/next-response), and the [July 2026 Security Release](https://nextjs.org/blog/july-2026-security-release) for CVE-2026-64645.
> Target: **Next.js 16.3.4**. Prior page: [11 · Backend for Frontend: the API layer](11-backend-for-frontend-route-handlers-as-a-public-api-layer.md).

**Every interesting Backend-for-Frontend endpoint eventually forwards a request somewhere else — to an upstream service, to a cache invalidation, to an identity provider's callback. That is also where the July 2026 security release found four of its nine vulnerabilities. Forwarding code takes attacker-influenced input and turns it into an outbound request or a redirect, and the two failure modes are always the same: an origin derived from request data becomes server-side request forgery, and a redirect target taken from a search parameter becomes an open redirect. This page is the forwarding half of a BFF, written around those two traps.**

## Proxying to a backend

```ts filename="/app/api/[...slug]/route.ts"
import { isValidRequest } from '@/lib/utils'

export async function POST(request: Request, { params }) {
  const clonedRequest = request.clone()
  const isValid = await isValidRequest(clonedRequest)

  if (!isValid) {
    return new Response(null, { status: 400, statusText: 'Bad Request' })
  }

  const { slug } = await params
  const pathname = slug.join('/')
  const proxyURL = new URL(pathname, 'https://nextjs.org')
  const proxyRequest = new Request(proxyURL, request)

  try {
    return fetch(proxyRequest)
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected exception'

    return new Response(message, { status: 500 })
  }
}
```

Note the clone: the validator consumes one copy of the body, the forwarded request keeps the other. Note also that `new URL(pathname, 'https://nextjs.org')` uses a **hard-coded origin**. Building that origin from request input is precisely the SSRF shape disclosed as CVE-2026-64645 in July 2026 — see [the 2026 CVE record](../10-forms-authentication-and-security-hardening/14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md) for the advisory text.

The alternatives, for cases that need no logic: `proxy` rewrites, or `rewrites()` in `next.config.js`.

## `NextRequest` and `NextResponse`

> *"Next.js extends the `Request` and `Response` Web APIs with methods that simplify common operations. These extensions are available in both Route Handlers and Proxy."*

> *"`NextRequest` includes the `nextUrl` property, which exposes parsed values from the incoming request […] `NextResponse` provides helpers like `next()`, `json()`, `redirect()`, and `rewrite()`."*

> *"You can pass `NextRequest` to any function expecting `Request`. Likewise, you can return `NextResponse` where a `Response` is expected."*

```ts filename="/app/echo-pathname/route.ts"
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const nextUrl = request.nextUrl

  if (nextUrl.searchParams.get('redirect')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (nextUrl.searchParams.get('rewrite')) {
    return NextResponse.rewrite(new URL('/', request.url))
  }

  return NextResponse.json({ pathname: nextUrl.pathname })
}
```

## Webhooks and callback URLs

```ts filename="/app/webhook/route.ts"
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (token !== process.env.REVALIDATE_SECRET_TOKEN) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const tag = request.nextUrl.searchParams.get('tag')

  if (!tag) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  revalidateTag(tag, 'max')

  return NextResponse.json({ success: true })
}
```

The callback pattern, with the open-redirect guard the docs build in:

```ts filename="/app/auth/callback/route.ts"
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('session_token')
  const redirectUrl = request.nextUrl.searchParams.get('redirect_url')

  const destination = new URL(redirectUrl ?? '/', request.url)
  // Prevent open redirects: only allow same-origin destinations
  if (destination.origin !== request.nextUrl.origin) {
    return new Response('Invalid redirect', { status: 400 })
  }

  const response = NextResponse.redirect(destination)

  response.cookies.set({
    value: token,
    name: '_token',
    path: '/',
    secure: true,
    httpOnly: true,
    expires: undefined, // session cookie
  })

  return response
}
```

Every attribute on that cookie is doing work: `secure` keeps it off plaintext connections, `httpOnly` keeps it away from `document.cookie` and therefore away from an XSS payload, and `expires: undefined` makes it a session cookie that dies with the browser.

## Proxy, and its one-file limit

> *"Only one `proxy` file is allowed per project. Use `config.matcher` to target specific paths."*

```ts filename="proxy.ts"
import { isAuthenticated } from '@lib/auth'

export const config = {
  matcher: '/api/:function*',
}

export function proxy(request: Request) {
  if (!isAuthenticated(request)) {
    return Response.json(
      { success: false, message: 'authentication failed' },
      { status: 401 }
    )
  }
}
```

Proxy can also rewrite to an external origin, or redirect:

```ts filename="proxy.ts"
import { NextResponse } from 'next/server'

export function proxy(request: Request) {
  if (request.nextUrl.pathname === '/proxy-this-path') {
    const rewriteUrl = new URL('https://nextjs.org')
    return NextResponse.rewrite(rewriteUrl)
  }
}
```

## Preflight

> *"Preflight requests use the `OPTIONS` method to ask the server if a request is allowed based on origin, method, and headers. If `OPTIONS` is not defined, Next.js adds it automatically and sets the `Allow` header based on the other defined methods."*

The automatic `OPTIONS` handles the `Allow` header. It does **not** supply CORS headers — those are yours to set.
## Gotchas

**★ Building a proxy destination origin from request input.**
The documented example hard-codes `https://nextjs.org` as the base. Deriving that origin from a header or a search parameter is server-side request forgery, and it is the exact shape of CVE-2026-64645 from the July 2026 security release. Validate against an allowlist of exact hosts — a suffix check is not sufficient.

**★ Expecting the automatic `OPTIONS` handler to give you CORS.**
It sets the `Allow` header from your defined methods. It does not emit `Access-Control-Allow-Origin` or any other CORS header. A cross-origin client will still be blocked until you set them yourself.

**★ Writing a second `proxy` file.**
Only one is allowed per project. A team that adds `app/api/proxy.ts` expecting per-directory middleware gets a file that is never invoked, with no error to explain why. Scope the single proxy with `config.matcher` instead.

**★ Trusting a webhook because it came from the right-looking URL.**
The documented revalidation webhook compares a token from the query string against `process.env.REVALIDATE_SECRET_TOKEN` before doing anything. An unauthenticated revalidation endpoint lets anyone dump your cache on demand. Where the provider supports it, prefer a signature over a shared token.

**★ Setting a session cookie without `httpOnly` and `secure`.**
The callback example sets both, plus `expires: undefined` for a session-lifetime cookie. Without `httpOnly` any XSS reads the token; without `secure` a plaintext request leaks it. These are two words, and they are the difference between an XSS being an annoyance and an account takeover.

**★ Comparing a redirect target as a string instead of resolving it first.**
`if (redirectUrl.startsWith('/'))` looks like a same-origin check and is not: `//evil.example.com` starts with `/` and is a protocol-relative absolute URL. The documented guard resolves the value against `request.url` and then compares `destination.origin` with `request.nextUrl.origin`, which normalises the input before the decision is made.

**★ Returning a `fetch()` result from a proxy handler and forwarding hop-by-hop headers with it.**
`new Request(proxyURL, request)` carries the original headers, including `Host`, `Cookie` and any `Authorization` the browser sent. Forwarding a session cookie to a third-party origin is a credential leak; forwarding `Host` is what makes some upstreams route incorrectly. Build the outbound request's headers explicitly rather than inheriting them wholesale.

**★ Using `proxy` for authentication and stopping there.**
The documented proxy returns 401 for unauthenticated `/api/*` requests, and the guide's own security section is blunt about the limit: *"Do not rely on proxy alone for authentication and authorization."* Two of the July 2026 CVEs sit on exactly this seam — a Turbopack single-locale proxy bypass, and endpoint-ID disclosure that lets a Server Function be invoked directly. Re-verify next to the data.

## Interview questions

**★ What makes the documented proxy handler safe against SSRF, and what would break it?**
The destination origin is hard-coded: `new URL(pathname, 'https://nextjs.org')`. Only the path comes from the request. Deriving the origin from request input — a header, a query parameter, a rewrite rule built from user data — is the SSRF shape disclosed as CVE-2026-64645, where a rule could be pointed at an arbitrary hostname *"regardless of the rule's hostname suffix"*. Validate against exact hosts, never suffixes.

**★ How does the callback-URL example prevent an open redirect?**
It resolves the caller-supplied `redirect_url` against the request URL and then compares origins: `if (destination.origin !== request.nextUrl.origin) return 400`. Resolving first is what makes the check correct — it normalises protocol-relative and relative inputs before the comparison, so `//evil.example.com` cannot slip past a naive string test.

**★ If you do not export an `OPTIONS` handler, what does Next.js do, and what does it not do?**
It adds one automatically and sets the `Allow` header based on the other methods you defined. It does not add any CORS headers, so a cross-origin browser request will still fail preflight until you emit `Access-Control-Allow-Origin` and friends yourself.

**★ Why can there be only one `proxy` file, and how do you scope it?**
It is a single project-level interception point, which is what makes its ordering relative to routing well-defined. Scope it with `config.matcher`, which supports path patterns plus `has` and `missing` conditions on headers and cookies — so one file can behave differently per route without becoming per-directory middleware.

**★ What is the difference between `NextResponse.next({ request: { headers } })` and setting headers on the response?**
The first modifies the headers your *server* receives for the remainder of the request; the client never sees them. The second sends them to the browser. The guide's security section draws the distinction precisely because people conflate them: *"If sensitive values were appended to these headers, they will be visible to clients."* Internal correlation IDs, resolved tenant identifiers and decoded claims belong on the request; only what the browser needs belongs on the response.

**★ A webhook endpoint calls `revalidateTag`. What must it check first, and what is better than a shared token?**
It must authenticate the caller — the documented handler compares a query-string token against `process.env.REVALIDATE_SECRET_TOKEN` and returns 401 otherwise, then requires a `tag` parameter and returns 400 without one. Better than a shared token is a provider-issued signature over the request body, verified with a constant-time comparison, because a token in a query string is logged by every hop it passes through and cannot be scoped to a payload.

**★ Why is `proxy` alone insufficient as an authorization layer?**
Because it is one filter in front of many entry points, and anything that bypasses it or routes around it reaches the data unguarded. The guide says so directly — *"Do not rely on proxy alone for authentication and authorization"* — and the 2026 record supplies two concrete instances: a middleware/proxy bypass triggered by Turbopack plus a single `i18n.locales` entry, and global disclosure of Server Function endpoint IDs that lets an action be invoked without going through any page. Authorization has to be re-verified in the Route Handler or Server Action, next to the data.

{/* FOOTER */}
