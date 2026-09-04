---
title: "Adding a proxy.ts changes the memory profile of every uploading route in your application, because the mere existence of the file makes Next.js clone and buffer request bodies in memory with a 10MB ceiling — and going over that ceiling truncates the body and logs a warning rather than rejecting the request"
sidebar_label: "07f · Flags, the body buffer, testing"
sidebar_position: 167
description: "skipTrailingSlashRedirect and skipProxyUrlNormalize with the worked examples the docs give, the request-body buffering that turns on the moment a proxy file exists, proxyClientMaxBodySize and its truncation semantics, and unit-testing the proxy function with isRewrite and getRewrittenUrl."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`proxy.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`) and [`proxyClientMaxBodySize`](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize) (`lastUpdated: 2025-10-20`).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**.

**Everything else about proxy is something you wrote. This page is about three things that happen to you. Two `next.config` flags change what your proxy function sees before it runs a line — one disables Next.js's own trailing-slash redirects so you can own that behaviour during a migration, the other stops URL normalisation so you see `/_next/data/build-id/hello.json` instead of `/hello`. The third is not a flag at all: the presence of a `proxy.ts` file switches on request-body buffering globally, at a 10MB default, so that both proxy and the route handler can read the body. Nothing in your code says so, the config option that tunes it is marked experimental, and the over-limit behaviour is a silent truncation.**

## The two advanced URL flags

Both were added in 13.1.

**`skipTrailingSlashRedirect`** — *"disables Next.js redirects for adding or removing trailing slashes. This allows custom handling inside proxy to maintain the trailing slash for some paths but not others, which can make incremental migrations easier."*

```js
// next.config.js
module.exports = { skipTrailingSlashRedirect: true }
```

```js
// proxy.js
const legacyPrefixes = ['/docs', '/blog']

export default async function proxy(req) {
  const { pathname } = req.nextUrl

  if (legacyPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // apply trailing slash handling
  if (
    !pathname.endsWith('/') &&
    !pathname.match(/((?!\.well-known(?:\/.*)?)(?:[^/]+\/)*[^/]+\.\w+)/)
  ) {
    return NextResponse.redirect(new URL(`${req.nextUrl.pathname}/`, req.nextUrl))
  }
}
```

**`skipProxyUrlNormalize`** — *"allows for disabling the URL normalization in Next.js to make handling direct visits and client-transitions the same. In some advanced cases, this option provides full control by using the original URL."*

```js
// proxy.js
export default async function proxy(req) {
  const { pathname } = req.nextUrl

  // GET /_next/data/build-id/hello.json

  console.log(pathname)
  // with the flag this now /_next/data/build-id/hello.json
  // without the flag this would be normalized to /hello
}
```

That comment is the whole point of the flag: **by default your proxy sees the normalised page path, not the data path.** Turning normalisation off is what lets a custom rewrite layer see what actually arrived.

## 🔴 The request body is buffered the moment proxy exists

This is documented on a config page most people never open, and it is a real operational fact:

> *"When proxy is used, Next.js automatically clones the request body and buffers it in memory to enable multiple reads — both in proxy and the underlying route handler. To prevent excessive memory usage, this configuration option sets a size limit on the buffered body."*

> *"By default, the maximum body size is **10MB**. If a request body exceeds this limit, the body will only be buffered up to the limit, and a warning will be logged indicating which route exceeded the limit."*

⚠️ The `proxyClientMaxBodySize` page carries the standard experimental banner: *"This feature is currently experimental and subject to change, it's not recommended for production."* That applies to the **config option**, not to the buffering — the buffering happens regardless; the option is how you change the ceiling.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: '1mb',
  },
}

export default nextConfig
```

> *"Supported units: `b`, `kb`, `mb`, `gb`"* — and a number is interpreted as bytes.

Two consequences worth internalising. First, **adding a proxy is not free for upload routes**: a route that previously streamed a large body now has 10MB of it cloned into memory per concurrent request. Second, **the over-limit case is a truncation with a log line, not a rejection** — the body is *"only buffered up to the limit"*, so a handler reading past that point sees a short body rather than an error.

## Unit-testing the function

> *"The entire proxy function can also be tested."*

```js
import { isRewrite, getRewrittenUrl } from 'next/experimental/testing/server'

const request = new NextRequest('https://nextjs.org/docs')
const response = await proxy(request)
expect(isRewrite(response)).toEqual(true)
expect(getRewrittenUrl(response)).toEqual('https://other-domain.com/docs')
// getRedirectUrl could also be used if the response were a redirect
```

Combined with `unstable_doesProxyMatch` from [07d](07d-what-the-matcher-silently-skips.md), that gives you both halves — *does it run here* and *what does it do* — without a server, a build or a browser.

## Gotchas

**★ Symptom: memory usage climbs after adding a `proxy.ts` that only logs.** Cause: the existence of a proxy turns on request-body buffering for everything. Verbatim: *"When proxy is used, Next.js automatically clones the request body and buffers it in memory to enable multiple reads."* Fix: lower the ceiling if your app has no large uploads, or exclude upload paths from the matcher entirely.

```ts
const nextConfig: NextConfig = {
  experimental: { proxyClientMaxBodySize: '1mb' },
}
```

**★ Symptom: a large upload arrives at the route handler truncated, with no exception.** Cause: the body exceeded the buffer limit. Verbatim: *"If a request body exceeds this limit, the body will only be buffered up to the limit, and a warning will be logged indicating which route exceeded the limit."* Fix: raise the limit for that deployment, or keep upload routes out of the matcher so the buffer is never engaged for them.

```ts
export const config = {
  matcher: ['/((?!api/upload|_next/static|_next/image).*)'],
}
```

**Symptom: trailing-slash behaviour is inconsistent after a migration and proxy seems not to be involved.** Cause: Next.js applies its own trailing-slash redirect unless you turn it off. Fix: `skipTrailingSlashRedirect: true` and handle it explicitly, which is the documented reason the flag exists — *"This allows custom handling inside proxy to maintain the trailing slash for some paths but not others, which can make incremental migrations easier."*

**Symptom: `req.nextUrl.pathname` shows `/hello` when the request was for `/_next/data/build-id/hello.json`.** Cause: URL normalisation, which is on by default. Verbatim: *"`skipProxyUrlNormalize` allows for disabling the URL normalization in Next.js to make handling direct visits and client-transitions the same."* Fix: enable the flag if your logic genuinely needs the original shape — and be aware you are now responsible for handling both shapes.

## Interview questions

**★ What does adding a `proxy.ts` cost an application that uploads files?**
Memory, per concurrent request, whether or not the proxy touches the body. Verbatim: *"When proxy is used, Next.js automatically clones the request body and buffers it in memory to enable multiple reads — both in proxy and the underlying route handler."* The default ceiling is 10MB. Two things follow. First, a proxy that only logs a pathname still turns this on globally, so the cost is not proportional to what your proxy does. Second, the over-limit behaviour is truncation with a logged warning rather than a rejection — the body is *"only buffered up to the limit"* — so an upload handler can receive a short body and treat it as valid data. The mitigations are to lower `experimental.proxyClientMaxBodySize` if you have no large uploads, or to keep upload routes out of the matcher.

**What is `skipProxyUrlNormalize` actually for?**
Making proxy see the URL that arrived rather than the page path Next.js derived from it. By default a request for `/_next/data/build-id/hello.json` reaches your function with `pathname` normalised to `/hello`, which is convenient when you want direct visits and client transitions to behave identically and useless when you are building a rewrite layer that has to distinguish them. The docs frame it as *"full control by using the original URL"*, and it is also the recommended companion to a custom `fetch`-based rewrite, because the un-normalised request object carries the RSC headers such a rewrite needs. Turning it on transfers responsibility for both URL shapes to you.

**How do you test a proxy without starting a server?**
Two experimental helpers from `next/experimental/testing/server`, and they answer different questions. `unstable_doesProxyMatch({ config, nextConfig, url })` asserts whether proxy runs at all for a given URL, headers and cookies — that is the matcher question, and given that the matcher determines Server Function coverage it is close to a security test. `isRewrite(response)`, `getRewrittenUrl(response)` and `getRedirectUrl(response)` assert what the function did, by calling it with a `NextRequest` you construct yourself. Both are marked experimental and both arrived in 15.1; together they cover the two failure modes that are otherwise only observable in production.

---

← [07e · Inside the proxy function](07e-inside-the-proxy-function.md) · [Chapter 2 overview](01-explanation.md) · Next → [08 · Localized routing](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md)
