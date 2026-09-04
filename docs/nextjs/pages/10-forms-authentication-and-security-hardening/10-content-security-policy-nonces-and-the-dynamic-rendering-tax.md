---
sidebar_position: 40
title: "A nonce-based CSP forces every page in your application to render dynamically — which is the same as saying it turns off PPR, ISR and CDN caching"
sidebar_label: "CSP: nonces and the dynamic-rendering tax"
description: "How Next.js injects CSP nonces during server-side rendering, why nonces require dynamic rendering, the proxy.ts implementation, reading the nonce in a Server Component, and the exact performance consequences the docs enumerate."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to set a Content Security Policy (CSP) for your Next.js application](https://nextjs.org/docs/app/guides/content-security-policy) (docs `lastUpdated` 2026-03-20), [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [`headers`](https://nextjs.org/docs/app/api-reference/functions/headers), and MDN's [CSP](https://developer.mozilla.org/docs/Web/HTTP/CSP) and [`nonce`](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/nonce) references.
> Target: **Next.js 16.3.4** (16.3 = Active LTS, 15.5 = Maintenance LTS). Node.js `>= 20.9`. Nonce handling has been recommended since `v13.4.20`.

**Content Security Policy and the App Router's rendering model pull in opposite directions, and the docs do not hide it. A nonce must be unpredictable and unique per request, which means it can only exist once a request exists, which means the page carrying it cannot have been prerendered. Next.js states the consequence in one sentence — *"you must use dynamic rendering to add nonces"* — and then spells out the bill: static optimization off, ISR off, CDN caching off, and Partial Prerendering explicitly incompatible. This is a real architectural decision, not a configuration detail, and the right first question is whether your application needs nonces at all.**

## What a nonce is and why it must change every time

A nonce is a unique, random string of characters created for one single use. Paired with CSP it acts as a selective exemption: specific inline scripts or styles are allowed to execute, bypassing directives that would otherwise be strict enough to block them.

The reason it is needed is that CSP is capable of blocking both inline and external scripts in order to prevent attacks, which is a blunt instrument. A nonce narrows the block to a whitelist of one — a script runs only if it carries the matching nonce value.

The docs then give the threat model in a sentence. An attacker who wants to load a script into your page has to guess the nonce, and it is exactly that requirement which forces the nonce to be unpredictable and unique on every single request.

The security property is entirely dependent on unpredictability. A nonce cached alongside a prerendered page and served to a thousand visitors is not a nonce — it is a public allowlist entry, and an attacker who can read one page's HTML can inject a script that passes the policy on every other page.

## Generating it in `proxy.ts`

Proxy is where this belongs because it can add headers and generate the nonce *before* the page renders. Every page view is supposed to get a freshly generated nonce, and the docs draw the conclusion for you in bold: adding nonces obliges you to use dynamic rendering.

```ts filename="proxy.ts"
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`
  // Replace newline characters and spaces
  const contentSecurityPolicyHeaderValue = cspHeader
    .replace(/\s{2,}/g, ' ')
    .trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  requestHeaders.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue
  )

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue
  )

  return response
}
```

The header is set **twice**, deliberately, and the two writes do different jobs. `NextResponse.next({ request: { headers } })` mutates the headers your *server* sees — that is the copy Next.js parses to find the nonce. `response.headers.set(...)` is the copy the *browser* receives and enforces. Set only the request copy and the browser has no policy; set only the response copy and Next.js never sees a nonce to inject.

`'strict-dynamic'` is what makes this policy tractable at all: a script that carries the nonce is trusted to load further scripts. Without it, every chunk Next.js loads dynamically would need its own allowlist entry.

## Scoping the proxy

Proxy runs on every request by default. A `matcher` narrows it to specific paths, and the docs' recommendation is to skip two categories in particular — prefetches coming from `next/link`, and static assets that have no use for a CSP header.

```ts filename="proxy.ts"
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

The `missing` block is the interesting half. Every prefetch triggered by a `Link` component would otherwise generate its own nonce and its own dynamic render — turning link hover into origin load. Excluding prefetches means the prefetched payload does not carry a policy, which is correct: it is not a document, so no browser will enforce a CSP against it.

## What Next.js does with the nonce

Using a nonce requires the page to be **dynamically rendered**, and the docs give the causal chain rather than just the rule. Next.js applies nonces during **server-side rendering**, working from the CSP header present on the incoming request. A static page is generated at build time, at a moment when no request headers and no response headers exist — so there is nothing for the framework to read and no nonce it could inject.

The mechanism runs in three steps.

**Proxy generates a nonce.** Your proxy creates a unique nonce for the request, puts it into the `Content-Security-Policy` header, and additionally sets it in a custom `x-nonce` header.

**Next.js extracts the nonce.** During rendering, the framework parses the `Content-Security-Policy` header and pulls the value out using the `'nonce-{value}'` pattern.

**The nonce is applied automatically.** Next.js attaches it to framework scripts (React and the Next.js runtime), to page-specific JavaScript bundles, to inline styles and scripts that Next.js itself generated, and to any `<Script>` component that was given the `nonce` prop.

Because all of that happens for you, the docs note that there is no need to add a nonce to each tag by hand.

Note step 2 precisely: Next.js parses the **`Content-Security-Policy` request header**, not `x-nonce`. `x-nonce` exists purely so *your* code can read the value with `headers()`. If you set `x-nonce` and forget to set the CSP header on the request, the framework's own scripts go unsigned and the page dies at hydration with everything blocked.

## Forcing the render to be dynamic

The docs warn that with nonces in play you may have to opt pages into dynamic rendering explicitly rather than relying on a route becoming dynamic by accident:

```tsx filename="app/page.tsx"
import { connection } from 'next/server'

export default async function Page() {
  // wait for an incoming request to render this page
  await connection()
  // Your page content
}
```

`connection()` is the honest way to say "this page cannot exist before a request does". It is also, notably, the one runtime API prohibited inside **both** `'use cache'` and `'use cache: private'` scopes — which is the clearest possible signal that a nonce-bearing render and a cached render are mutually exclusive by construction.

## Reading the nonce in your own code

```tsx filename="app/page.tsx"
import { headers } from 'next/headers'
import Script from 'next/script'

export default async function Page() {
  const nonce = (await headers()).get('x-nonce')

  return (
    <Script
      src="https://www.googletagmanager.com/gtag/js"
      strategy="afterInteractive"
      nonce={nonce}
    />
  )
}
```

`headers()` is itself a dynamic API, so reading the nonce is a second, independent reason the route cannot be prerendered.

## The bill

The docs list the consequences without softening them:

Using nonces in your CSP means **all pages must be dynamically rendered**, and the docs enumerate what follows from that. Pages will still build successfully, but may hit runtime errors if they were not properly configured for dynamic rendering. Each request generates a fresh page carrying a new nonce. Static optimization and Incremental Static Regeneration are disabled. Pages cannot be cached by CDNs without additional configuration. And **Partial Prerendering is incompatible** with nonce-based CSP, on the stated grounds that static shell scripts will not have access to the nonce.

The performance consequences are listed just as plainly. Initial page loads are slower, because every page has to be generated on each request. Server load increases, because every request now requires server-side rendering. There is no CDN caching, because dynamic pages are not cached at the edge by default. And hosting costs rise, because dynamic rendering needs more server resources.

The PPR incompatibility deserves a moment. PPR's whole premise is that a *static shell* — including its script tags — is emitted at build time and served from a CDN. A nonce is per-request. A build-time shell cannot contain a per-request value. There is no configuration that reconciles these; they are contradictory by definition.

The first consequence in that list is the operational trap: **pages will build successfully**. A nonce-based CSP is not a build-time error. It is a runtime error, on the routes that happened to prerender, in production.

## When nonces are actually the right call

The docs give four situations that justify the cost: strict security requirements that prohibit `'unsafe-inline'`; an application that handles sensitive data; a need to allow *specific* inline scripts while blocking others; or compliance requirements that mandate a strict CSP.

Notice what is absent from that list: "you want a good security score". A nonce-based CSP is the correct answer when a compliance regime or a genuine inline-script requirement demands it. It is the wrong answer when a static header on a statically-rendered site would have satisfied the actual threat model — and that alternative has its own page.

## Development needs `'unsafe-eval'`, production does not

In development `'unsafe-eval'` is required, and for a concrete reason: React uses `eval` there to provide enhanced debugging information — reconstructing server-side error stacks in the browser is the example the docs give. Production does not need it. Neither React nor Next.js uses `eval` in production by default.

The docs' development variant also relaxes styles, because the dev-time style injection is not nonce-carrying:

```ts filename="proxy.ts"
const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ''};
    style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`};
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`
```

The environment branch must be evaluated per-build, not per-request-in-production. `process.env.NODE_ENV` is inlined at build time, so this is safe — but a variant that reads a runtime flag and can be flipped in production has handed an attacker `'unsafe-eval'`.

## Gotchas

**★ Setting the CSP on the response but not on the request, so the framework's own scripts go unsigned.**
Next.js extracts the nonce by parsing the `Content-Security-Policy` header **on the request**, not from `x-nonce`. Set only `response.headers`, and the browser enforces a policy the framework's scripts do not satisfy — the page renders and then dies at hydration with everything blocked. Set both, exactly as the documented proxy does:

```ts
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-nonce', nonce)
requestHeaders.set('Content-Security-Policy', value)
const response = NextResponse.next({ request: { headers: requestHeaders } })
response.headers.set('Content-Security-Policy', value)
```

**★ Adding nonces to an application that uses PPR and expecting a config to reconcile them.**
There is none. PPR emits a static shell at build time; a nonce exists only once a request does. The docs state the incompatibility as a fact rather than a limitation: PPR is incompatible with nonce-based CSP, because static shell scripts will not have access to the nonce. Choose one.

**★ Shipping a nonce CSP and discovering the failure only in production.**
The docs are explicit that pages build successfully and only then encounter runtime errors, if they were not properly configured for dynamic rendering. Statically-rendered routes get no nonce injected, so their scripts violate the policy — and only at runtime, on the routes that happened to prerender. Add `await connection()` to every route that must carry a nonce, and treat CSP adoption as requiring a route-by-route audit.

**★ Letting the proxy run on prefetches and turning link hover into origin load.**
Without the `missing` conditions on `next-router-prefetch` and `purpose: prefetch`, every prefetch generates a nonce and forces a dynamic render. A page with twenty links can trigger twenty origin renders before the user clicks anything. Use the documented matcher.

**★ Running the proxy on `/_next/static` and `/_next/image`.**
Hashed assets and optimized images do not need a document CSP, and putting the proxy in front of them adds a function invocation to every asset request. The documented matcher excludes `api`, `_next/static`, `_next/image` and `favicon.ico` for exactly this reason.

**★ Generating the nonce from something guessable.**
The whole property is unpredictability. `Date.now()`, a request counter, a hash of the path, or a value cached per-deployment all reduce the nonce to a public allowlist entry an attacker can read off any page. `crypto.randomUUID()` base64-encoded, per request, is the documented form.

**★ Reading the nonce with `headers()` in a component you intended to cache.**
`headers()` is a dynamic API, so a component that reads `x-nonce` can never be inside a plain `'use cache'` scope. If you need a nonce in a widely-shared component, the containing route is dynamic — accept that, or move the third-party script to a route that already is.

**★ Making `'unsafe-eval'` conditional on a runtime flag.**
`process.env.NODE_ENV` is inlined at build time, so the documented branch is compiled away in production. A variant reading a runtime environment variable or a feature flag means an operator — or an attacker with config access — can enable `'unsafe-eval'` in production without a deploy.

**★ Assuming a nonce protects a page that also allows `'unsafe-inline'`.**
Browsers ignore `'unsafe-inline'` in a directive that also specifies a nonce or a hash. That is usually what you want, but it means a policy written as a "safe fallback" for old browsers silently changes behaviour depending on which directives are present — and a policy that specifies `'unsafe-inline'` in `style-src` while nonce-ing `script-src` protects only half of what you think it does.

**★ Forgetting `frame-ancestors` and treating CSP as an XSS-only control.**
The documented policy includes `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` and `form-action 'self'`. Those four cover clickjacking, legacy plugin injection, `base` tag hijacking and form exfiltration — none of which are XSS, and all of which a script-only policy leaves open.

## Interview questions

**★ Why does a nonce force dynamic rendering?**
Because a nonce must be unpredictable and unique per request, and Next.js injects it during server-side rendering by parsing the CSP header *on that request*. A statically generated page is produced at build time, at a moment when no request or response headers exist, so there is no nonce for the framework to inject. A cached page carrying a fixed nonce would not be a nonce at all: an attacker reading one response would learn the value that passes on every other.

**★ Enumerate exactly what you give up by adopting a nonce-based CSP.**
Static optimization and ISR are disabled; pages cannot be cached by CDNs without additional configuration; Partial Prerendering is incompatible; every request pays a full server render, raising latency, server load and hosting cost. And critically, none of this fails the build — pages build successfully and surface the problem as a runtime error afterwards.

**★ Why is the CSP header set on both the request and the response in the documented proxy?**
The request copy is what Next.js parses during rendering to extract the nonce and attach it to framework scripts, page bundles, generated inline styles and `Script` components. The response copy is what the browser enforces. Omit the request copy and the framework's own scripts are unsigned; omit the response copy and there is no policy at all.

**★ What is `x-nonce` for, given Next.js does not read it?**
It is for your application code. Next.js extracts the nonce from the `Content-Security-Policy` header using the `'nonce-{value}'` pattern; `x-nonce` is a convenience header so a Server Component can retrieve the same value with `headers()` and pass it to a `Script` component or a third-party integration such as `GoogleTagManager`.

**★ Why is PPR fundamentally incompatible with nonce-based CSP?**
PPR's value is that a static shell — including its script tags — is generated at build time and can be served from a CDN before any server work happens. A nonce is a per-request secret. A build-time artefact cannot contain a per-request value, so the shell's scripts would carry either no nonce or a shared one, and neither is acceptable. It is a contradiction in the model, not a missing feature.

**★ Why do the recommended matcher conditions exclude prefetches?**
Because `Link` prefetches are requests, and each one would generate a nonce and force a dynamic render of the target route. On a page with many links that converts hover into origin traffic. Prefetch payloads are not documents, so no browser enforces a CSP against them — excluding them costs nothing and saves a great deal.

**★ Why is `'unsafe-eval'` needed in development but not production?**
React uses `eval` in development to provide enhanced debugging information, including reconstructing server-side error stacks in the browser so you can see where an error originated on the server. The docs are explicit that neither React nor Next.js uses `eval` in production by default. The branch must be compiled in at build time via `process.env.NODE_ENV`, never toggled at runtime.

**★ What does `'strict-dynamic'` buy you, and what does it cost?**
It propagates trust: a script that satisfies the policy through its nonce is allowed to load further scripts, which is essential when the framework loads chunks dynamically and you cannot enumerate them in advance. The cost is that host-based allowlist entries in `script-src` are ignored by browsers that honour `'strict-dynamic'` — so a policy mixing `'strict-dynamic'` with a list of trusted domains behaves differently from how it reads.

**★ You inherit an app with a nonce CSP, no ISR, and a rising bill. What is the first question?**
Whether the nonce is required. The docs list the legitimate triggers — a prohibition on `'unsafe-inline'`, sensitive data, specific inline scripts that must be allowed while others are blocked, or a compliance mandate. If none applies, a static CSP set through `next.config.js` headers, or the experimental SRI hash approach, restores static generation and CDN caching without weakening the actual threat model.

---

← [**Project Milestone:** SprintDesk auth (Auth.js), team-scoped authorization in the data layer, ha…](06-project-milestone-sprintdesk-auth-authjs.md) · [Chapter 10 overview](01-explanation.md) · Next → [CSP without nonces: SRI and static headers](11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md)
