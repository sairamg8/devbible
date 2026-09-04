---
title: "Inside the proxy function the signature is two arguments and the response API has exactly one distinction worth memorising: NextResponse.next({ request: { headers } }) sends a header upstream into your app, and NextResponse.next({ headers }) sends the same header to the browser instead"
sidebar_label: "07e · Inside the proxy function"
sidebar_position: 166
description: "The request and event parameters and the NextProxy shorthand, waitUntil for background work, NextResponse rewrite/redirect/next/json and returning a response directly, the cookies API and its asymmetry, the request-versus-response header distinction, and RSC Flight-header stripping with custom fetch rewrites."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`proxy.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**.

**The proxy function is a small API with one very large trap in it: a single level of nesting in an options object decides whether a header travels upstream into your application or downstream to the browser. `NextResponse.next({ request: { headers } })` is the one your Server Components can read; `NextResponse.next({ headers })` is the one that puts your tenant ID on the wire to the client. The docs spell that pair out explicitly, which is a reliable signal of how often it goes wrong. The second thing this page covers is subtler still — Next.js strips RSC Flight headers from the request object you receive, and propagates them for you only if you rewrite through the official API. The configuration flags and the request-body buffer are [07f](07f-proxy-flags-the-body-buffer-and-testing.md).**

## The signature

> *"Next.js calls the Proxy function with two arguments, `request` and `event`, in that order. Declare only the ones you use."*

> *"The first parameter is an instance of `NextRequest`, which represents the incoming HTTP request."*

> *"The second parameter is an instance of `NextFetchEvent`. It exposes a single method, `waitUntil(promise)`, which keeps the Proxy invocation alive until the promise settles, so background work like logging or analytics can finish after the response is sent."*

```ts
// proxy.ts
import type { NextFetchEvent, NextRequest } from 'next/server'

export function proxy(request: NextRequest, event: NextFetchEvent) {
  event.waitUntil(
    fetch('https://example.com/log', {
      method: 'POST',
      body: JSON.stringify({ pathname: request.nextUrl.pathname }),
    })
  )
}
```

There is a shorthand type that infers both:

> *"If you prefer a shorthand, you can use the `NextProxy` type. It infers the parameter types for both `request` (`NextRequest`) and `event` (`NextFetchEvent`) automatically"*

```ts
import type { NextProxy } from 'next/server'

export const proxy: NextProxy = (request, event) => {
  event.waitUntil(Promise.resolve())
  return Response.json({ pathname: request.nextUrl.pathname })
}
```

> *"`NextRequest` is a type that represents incoming HTTP requests in Next.js Proxy, whereas `NextResponse` is a class used to manipulate and send back HTTP responses."*

### `waitUntil` and what it is for

> *"The `waitUntil()` method takes a promise as an argument, and extends the lifetime of the Proxy until the promise settles. This is useful for performing work in the background."*

```ts
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

export function proxy(req: NextRequest, event: NextFetchEvent) {
  event.waitUntil(
    fetch('https://my-analytics-platform.com', {
      method: 'POST',
      body: JSON.stringify({ pathname: req.nextUrl.pathname }),
    })
  )

  return NextResponse.next()
}
```

The response is not held for the promise — the *invocation* is. That is the difference between analytics that fire and analytics that get cut off mid-flight when the platform reclaims the process.

## What `NextResponse` can do

> *"The `NextResponse` API allows you to:"*
> *"`redirect` the incoming request to a different URL"*
> *"`rewrite` the response by displaying a given URL"*
> *"Set request headers for API Routes, `getServerSideProps`, and `rewrite` destinations"*
> *"Set response cookies"*
> *"Set response headers"*

Two ways to produce a response:

> *"1. `rewrite` to a route (Page or Route Handler) that produces a response"*
> *"2. return a `NextResponse` directly."*

> *"For redirects, you can also use `Response.redirect` instead of `NextResponse.redirect`."*

Returning a response directly has been supported since 13.1:

```ts
// proxy.ts
import type { NextRequest } from 'next/server'
import { isAuthenticated } from '@lib/auth'

export const config = {
  matcher: '/api/:function*',
}

export function proxy(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return Response.json(
      { success: false, message: 'authentication failed' },
      { status: 401 }
    )
  }
}
```

Note the implicit fall-through: returning nothing lets the request continue. You do not have to write `NextResponse.next()` for the pass case, though it is usually clearer to.

Conditional rewriting, the documented shape:

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/about')) {
    return NextResponse.rewrite(new URL('/about-2', request.url))
  }

  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.rewrite(new URL('/dashboard/user', request.url))
  }
}
```

## Cookies

> *"Cookies are regular headers. On a `Request`, they are stored in the `Cookie` header. On a `Response` they are in the `Set-Cookie` header. Next.js provides a convenient way to access and manipulate these cookies through the `cookies` extension on `NextRequest` and `NextResponse`."*

> *"For incoming requests, `cookies` comes with the following methods: `get`, `getAll`, `set`, and `delete` cookies. You can check for the existence of a cookie with `has` or remove all cookies with `clear`."*
> *"For outgoing responses, `cookies` have the following methods `get`, `getAll`, `set`, and `delete`."*

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // Reading from the incoming request
  const cookie = request.cookies.get('nextjs')
  const allCookies = request.cookies.getAll()
  request.cookies.has('nextjs')
  request.cookies.delete('nextjs')

  // Writing to the outgoing response
  const response = NextResponse.next()
  response.cookies.set('vercel', 'fast')
  response.cookies.set({
    name: 'vercel',
    value: 'fast',
    path: '/',
  })

  return response
}
```

The asymmetry is worth noting: the request side has `has` and `clear`, the response side does not.

## 🔴 Request headers versus response headers

Setting *request* headers has been possible since 13.0, and the two forms differ by one nesting level:

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-hello-from-proxy1', 'hello')

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.headers.set('x-hello-from-proxy2', 'hello')
  return response
}
```

> *"`NextResponse.next({ request: { headers: requestHeaders } })` to make `requestHeaders` available upstream"*
> *"**NOT** `NextResponse.next({ headers: requestHeaders })` which makes `requestHeaders` available to clients"*

And a size warning that bites in tenant and session-heavy setups:

> *"Avoid setting large headers as it might cause 431 Request Header Fields Too Large error depending on your backend web server configuration."*

## RSC requests, stripped headers, and custom rewrites

> *"During RSC requests, Next.js strips internal Flight headers from the `request` instance in Proxy. For example, headers like `rsc`, `next-router-state-tree`, and `next-router-prefetch` are not exposed through `request.headers`. This is to prevent accidentally handling an RSC request differently than the HTML request as both need to align."*

> *"When you use `NextResponse.rewrite()`, Next.js automatically propagates the required RSC rewrite headers upstream."*

> *"If you implement custom rewrite logic with `fetch()` instead of `NextResponse.rewrite()`, you can run into missing RSC headers unless you forward them manually."*

🔴 Read those three together: **`NextResponse.rewrite()` handles Flight headers for you and a hand-rolled `fetch()` does not.** The symptom is a rewrite that works for the initial HTML load and breaks on client navigation, because the RSC variant of the request loses headers it needed. The documented escape hatch:

> *"For custom `fetch` rewrite setups, you can also enable `skipProxyUrlNormalize` in `next.config.js` so your rewrite logic can receive the necessary URL shape and RSC headers from the provided request object"*

```js
// next.config.js
module.exports = {
  skipProxyUrlNormalize: true,
}
```

⚠️ Note the tension with the matcher, where a `has`/`missing` condition on `next-router-prefetch` and `purpose: prefetch` *is* documented and does work. Matching happens before your function runs; the stripping happens on the `request` instance your function receives. **The docs do not explicitly reconcile those two facts**, so treat matcher-level prefetch conditions as supported and function-level `request.headers.get('next-router-prefetch')` as unavailable.

## Gotchas

**★ Symptom: the header you set in proxy appears in the browser's network tab but `headers()` in your Server Component returns `null`.** Cause: you used the flat options object. Verbatim: the nested form *"make[s] `requestHeaders` available upstream"*, while `NextResponse.next({ headers: requestHeaders })` *"makes `requestHeaders` available to clients."* Fix: nest it under `request`.

```ts
// leaks downstream, invisible to your render
return NextResponse.next({ headers: requestHeaders })

// reaches your app
return NextResponse.next({ request: { headers: requestHeaders } })
```

**★ Symptom: a rewrite works on a full page load and breaks on client navigation.** Cause: you rewrote with `fetch()` rather than `NextResponse.rewrite()`, so the RSC headers were not propagated. Verbatim: *"When you use `NextResponse.rewrite()`, Next.js automatically propagates the required RSC rewrite headers upstream. If you implement custom rewrite logic with `fetch()` instead of `NextResponse.rewrite()`, you can run into missing RSC headers unless you forward them manually."* Fix: use `NextResponse.rewrite()`; if you genuinely cannot, enable `skipProxyUrlNormalize` so the request object carries what you need.

```ts
return NextResponse.rewrite(new URL('/tenants/acme/dashboard', request.url))
```

**★ Symptom: `request.headers.get('rsc')` is always `null`, so your prefetch branch never fires.** Cause: Flight headers are deliberately stripped from the request instance. Verbatim: *"headers like `rsc`, `next-router-state-tree`, and `next-router-prefetch` are not exposed through `request.headers`."* Fix: branch at the matcher level with `has`/`missing`, not inside the function.

```ts
export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image).*)',
      missing: [{ type: 'header', key: 'purpose', value: 'prefetch' }],
    },
  ],
}
```

**Symptom: a `fetch()` for analytics in proxy sometimes does not arrive.** Cause: the invocation ended before the promise settled. Verbatim: `waitUntil` *"keeps the Proxy invocation alive until the promise settles, so background work like logging or analytics can finish after the response is sent."* Fix: wrap it.

```ts
export function proxy(request: NextRequest, event: NextFetchEvent) {
  event.waitUntil(fetch(LOG_URL, { method: 'POST', body: '…' }))
  return NextResponse.next()
}
```

**Symptom: a backend returns 431 after you started injecting tenant or session data as headers.** Cause: header size. Verbatim: *"Avoid setting large headers as it might cause 431 Request Header Fields Too Large error depending on your backend web server configuration."* Fix: pass an identifier, not a payload — put the tenant slug in the header and look the record up server-side.

```ts
requestHeaders.set('x-tenant-id', tenant.id)     // fine
requestHeaders.set('x-tenant', JSON.stringify(tenant))  // 🔴 grows without bound
```

**Symptom: two proxy functions exported from the same file, and behaviour is inconsistent.** Cause: unsupported. Verbatim: *"The file must export a single function, either as a default export or named `proxy`. Note that multiple proxy from the same file are not supported."* Fix: one export; compose the rest as imported helpers.

## Interview questions

**★ What is the difference between `NextResponse.next({ request: { headers } })` and `NextResponse.next({ headers })`?**
Direction. The nested form rewrites the headers on the request as it continues *upstream* into your application, so `headers()` in a Server Component or Route Handler can read them — that is the supported channel for passing a value from proxy into a render. The flat form sets headers on the *response* travelling back to the browser. Using the wrong one has two failure modes at once: your render never sees the value, and whatever you put there — a tenant ID, a decoded session claim, an internal user ID — is now on the wire to the client. The docs call the pair out explicitly, which is unusual and a good sign of how often it is confused.

**★ Why does a rewrite implemented with `fetch()` break client navigation while the same rewrite with `NextResponse.rewrite()` works?**
Because RSC requests need Flight headers that Next.js propagates for you only through the official API. The docs say `NextResponse.rewrite()` *"automatically propagates the required RSC rewrite headers upstream"*, and that a hand-rolled `fetch()` *"can run into missing RSC headers unless you forward them manually."* An initial page load is an HTML request and survives; a client navigation is an RSC request and does not. The framework also strips Flight headers from the `request` object you can see — deliberately, *"to prevent accidentally handling an RSC request differently than the HTML request as both need to align"* — so you cannot easily copy them across by hand either. The documented workaround if you must keep the custom `fetch` is `skipProxyUrlNormalize`.

**★ How would you fire an analytics event from proxy without delaying the response?**
`event.waitUntil(promise)`, using the second parameter. The docs describe it as extending *"the lifetime of the Proxy until the promise settles"*, which is the distinction that matters — it does not hold the response, it holds the *invocation*, so the user is not waiting but your `fetch` is not killed either. Without it, a fire-and-forget `fetch` in proxy is at the mercy of whatever reclaims the process after the response is written, which is why analytics from proxy is unreliable until someone adds this one call.

**Why can you not detect a prefetch inside the proxy function by reading `next-router-prefetch`?**
Because Next.js removes it before you see it. Flight headers including `rsc`, `next-router-state-tree` and `next-router-prefetch` *"are not exposed through `request.headers`"*, and the reason given is alignment — they do not want you branching so that an RSC request renders differently from the HTML request for the same URL. If you genuinely need to treat prefetches differently, do it at the matcher, where `has` and `missing` conditions on `next-router-prefetch` and `purpose: prefetch` are documented and evaluated before your function is invoked. That is also cheaper, since a non-matching request never loads the module.


---

← [07d · What the matcher skips](07d-what-the-matcher-silently-skips.md) · [Chapter 2 overview](01-explanation.md) · Next → [07f · Flags, the body buffer and testing](07f-proxy-flags-the-body-buffer-and-testing.md)
