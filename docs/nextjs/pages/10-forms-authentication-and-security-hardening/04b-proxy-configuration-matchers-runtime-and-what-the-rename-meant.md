---
title: "The matcher is a hand-maintained allowlist that cannot be computed, which is why it rots — and the Edge-runtime argument everyone still uses to justify moving auth out of the proxy has been four versions out of date since 16.0"
sidebar_label: "04b · Matchers, runtime and the rename"
sidebar_position: 21
description: "Why a proxy without a matcher redirects your stylesheets, why matcher values must be build-time literals, the one path Next.js runs proxy on even when you exclude it, the Node.js runtime default since v16.0.0, and what the middleware-to-proxy rename was actually saying."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [`proxy.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`) — matcher rules, execution order, runtime section, version history and the *Migration to Proxy* section are quoted verbatim below — and [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**. Prior page: [04 · `proxy.ts` as a coarse filter](04-defense-in-depth-proxyts-as-a-coarse-filter.md).

**Two pieces of proxy configuration decide whether the layer runs at all, and both are more treacherous than they look. The `matcher` is a build-time literal — it cannot be derived from your route manifest, so it is a hand-maintained list, and a hand-maintained list of *protected* paths silently fails open the day someone adds a route. The `runtime` export does not exist here at all: proxy has defaulted to Node.js since `v16.0.0` and setting the option throws, which retires the single most repeated argument for moving auth out of middleware. The argument's conclusion was right; its reason has been stale for four versions, and someone who believes the stale reason will "fix" the problem by putting a database lookup in a component that runs on every prefetch.**

## Without a matcher, proxy runs on your CSS

> *"Without a `matcher`, Proxy runs on **every request**, including static files (`_next/static`), image optimizations (`_next/image`), and assets in the `public/` folder. Consider using a [negative match pattern](#negative-matching) to exclude these paths, otherwise auth logic or redirects can unintentionally block CSS, JS, or images from loading."*

That is the visible cost, and it is unmistakable in a browser: an unmatched proxy sends every stylesheet and every optimized image through your session decryption, and a redirect rule that fires on `/logo.png` yields a login page where an image should be.

The invisible cost is where the "exclude the assets" reflex sends people next. Two shapes are available and they fail in opposite directions:

| Shape | Example | What a *new route* gets |
|---|---|---|
| **Inclusion** (allowlist of protected paths) | `matcher: ['/dashboard/:path*', '/admin/:path*']` | No proxy. **Fails open.** |
| **Exclusion** (negative lookahead over assets) | `matcher: ['/((?!api\|_next/static\|_next/image\|favicon.ico).*)']` | Proxy. Fails closed — at worst an unnecessary hit on a new asset directory. |

The asymmetry is the whole argument, and it is why the authentication guide's tip reads the way it does:

> *"You can use the `matcher` property in the Proxy to specify which routes Proxy should run on. Although, for auth, it's recommended Proxy runs on all routes."*

## 🔴 The matcher cannot be computed

> *"The `matcher` values need to be constants so they can be statically analyzed at build-time. Dynamic values such as variables will be ignored."*

This is the sentence that makes the allowlist rot inevitable rather than merely likely. You cannot generate the protected set from the filesystem, from a route manifest, from a config module, or from anything at all — it must be a literal in the `config` export, analysed by the compiler. There is no escape hatch and no runtime API that returns "the set of routes I actually cover."

Note the failure mode: a variable is **ignored**, not rejected. The build does not fail. You get a proxy with an empty or default match set and no signal that your intent was discarded.

```ts filename="proxy.ts"
import { NextResponse, type NextRequest } from 'next/server'

// Handler-side list — an ordinary variable, read at request time. Fine.
const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/admin']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
  if (!isProtected) return NextResponse.next()
  // ... cookie-only session check
  return NextResponse.next()
}

// Matcher — must be a literal here. `matcher: PROTECTED_PREFIXES` is ignored.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

The split above is the pattern worth internalising: run proxy broadly through an exclusion matcher, and keep the *semantic* list in ordinary code where it is testable and where adding to it does not require getting a regex right.

Two further matcher details worth knowing before you write one:

- Patterns are **anchored to the start of the path**: *"`/about` matches `/about` and `/about/team` but not `/blog/about`."* A `source` string is therefore a prefix match. A `protectedRoutes.includes(path)` check in the handler body is **not** — that trap is the first gotcha on [04](04-defense-in-depth-proxyts-as-a-coarse-filter.md).
- *"For backward compatibility, Next.js always considers `/public` as `/public/index`. Therefore, a matcher of `/public/:path` will match."*

The `matcher` array also accepts objects with `source`, `locale`, `has` and `missing`, which lets you exclude prefetch requests by header — the documented example keys off `next-router-prefetch` and `purpose: prefetch`. ⚠️ Reach for that as a performance tool, never as a security one: a header the client sends is a header the client controls, so *"skip the check when it looks like a prefetch"* is a bypass with extra steps.

## The one path Next.js protects over your objection

> *"Even when `_next/data` is excluded in a negative matcher pattern, proxy will still be invoked for `_next/data` routes. This is intentional behavior to prevent accidental security issues where you might protect a page but forget to protect the corresponding data route."*

Read that as an admission rather than a footnote. Next.js overrides your explicit configuration on one path because a specific failure — protecting the HTML while the JSON serves the same content unauthenticated — was common enough to be worth breaking least-surprise for.

The reasoning generalises to your own allowlist. It just does not come with a rescue: nothing hard-codes coverage for the `app/admin/exports/page.tsx` somebody adds next sprint.

## Where proxy sits in the request pipeline

The reference gives the full ordering, and two entries in it matter for security reasoning:

1. `headers` from `next.config.js`
2. `redirects` from `next.config.js`
3. Proxy (`rewrites`, `redirects`, etc.)
4. `beforeFiles` (`rewrites`) from `next.config.js`
5. Filesystem routes (`public/`, `_next/static/`, `pages/`, `app/`, etc.)
6. `afterFiles` (`rewrites`) from `next.config.js`
7. Dynamic Routes (`/blog/[slug]`)
8. `fallback` (`rewrites`) from `next.config.js`

Static `redirects` in `next.config.js` run **before** proxy, so a config-level redirect can move a request out from under a proxy rule you thought was first. And filesystem routes resolve *after* proxy, which is the mechanical reason proxy cannot know which page will handle the request — at the moment it runs, that has not been decided.

🔴 The good-to-know attached to this list is the one that decides the whole layering argument, and it is quoted and unpacked on [04](04-defense-in-depth-proxyts-as-a-coarse-filter.md): Server Functions are not entries in this chain at all.

## The Edge-runtime argument is history — say so, then stop using it

There is a stale argument still in wide circulation: *"middleware runs on the Edge runtime, so it has no Node APIs, so you cannot do real auth there, so do it in the route."* The conclusion is right. The reason has been wrong since 16.0.

> *"Proxy defaults to using the Node.js runtime. The [`runtime`](/docs/app/api-reference/file-conventions/route-segment-config/runtime) config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."*

The version history dates it precisely:

| Version | Change (verbatim) |
|---|---|
| `v16.0.0` | *"Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime"* |
| `v15.5.0` | *"Middleware can now use the Node.js runtime (stable)"* |
| `v15.2.0` | *"Middleware can now use the Node.js runtime (experimental)"* |

The `runtime = 'edge'` **route segment value** is separately deprecated in 16.x — [ch05 · 01b](../05-caching-ppr-and-cache-components/01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md) quotes the Cache Components requirement (*"Migrate any routes that set the deprecated `runtime = 'edge'` export"*) and [ch16 · 03](../16-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md) quotes the region reference saying the same thing from the other side. So neither half of the old story survives: proxy is Node, and edge *rendering* is on the way out.

⚠️ **This changes the reason, not the recommendation.** Do not now conclude "proxy runs on Node, so I can do a database session lookup there." You still should not — because it runs on every prefetched route, and because it is documented as something that may be deployed to a CDN away from your database. The auth guide's practical version:

> *"Proxy uses the Node.js runtime, check if your Auth library and session management library are compatible."*

The deployment constraint that *replaced* the runtime constraint — module-level state that works in `next dev` and silently does nothing in production — is worked through in [ch02 · 07](../02-routing-and-navigation/07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md).

## What the rename was actually saying

The `middleware` → `proxy` rename was not cosmetic, and the reference states the intent plainly:

> *"The reason behind the renaming of `middleware` is that the term 'middleware' can often be confused with Express.js middleware, leading to a misinterpretation of its purpose. Also, Middleware is highly capable, so it may encourage the usage; however, this feature is recommended to be used as a last resort."*

> *"The name Proxy clarifies what Middleware is capable of. The term 'proxy' implies a network boundary in front of the app, which is how this feature behaves. It can run outside of your application's main runtime and handle requests before they reach your app."*

> *"We recommend users avoid relying on Middleware unless no other options exist. Our goal is to give them APIs with better ergonomics so they can achieve their goals without Middleware."*

That is a framework telling you, in its own API reference, that its most powerful request hook is a last resort. The Express association is precisely the misreading that produces a proxy-as-gate design: in Express, middleware *is* the authorization chain, because it runs in the same process, with access to the same objects, immediately before the handler. Here it may not run in the same process at all.

The codemod that performs the migration does exactly one thing:

```bash
npx @next/codemod@canary middleware-to-proxy .
```

> *"The codemod will rename the file and the function name from `middleware` to `proxy`."*

## Gotchas

**★ Symptom: after adding a proxy, the site renders unstyled and images 302 to `/login`.**
Cause: no `matcher`, so proxy ran on `_next/static`, `_next/image` and `public/` and applied the redirect rule to them.
Fix: the documented negative lookahead.

```ts filename="proxy.ts"
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

**★ Symptom: the matcher array you imported or built with `.map()` has no effect and the build is green.**
Cause: matcher values must be *"constants so they can be statically analyzed at build-time"*; dynamic values *"will be ignored"* — ignored, not rejected, so nothing tells you.
Fix: inline the literal in `config` and keep the semantic list as a separate runtime variable, as in the code above.

**★ Symptom: a route added three sprints ago has never had a proxy check and nobody noticed.**
Cause: an inclusion-style matcher. `matcher: ['/dashboard/:path*', '/admin/:path*']` covers what existed the day it was written and nothing since.
Fix: invert to an exclusion matcher so new routes are covered by default, and move the "which paths are protected" decision into the handler body where a unit test can reach it.

```ts filename="proxy.ts"
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

Next.js ships `unstable_doesProxyMatch` in `next/experimental/testing/server` for asserting coverage; the reference introduces it as of 15.1 and labels it experimental. Treat the name as unstable, and the test as worth having anyway.

**★ Symptom: someone excludes prefetch requests from the proxy using the `has` header condition and calls it a performance fix.**
Cause: it *is* a performance fix, and it is also a bypass if the proxy is carrying a control — the `next-router-prefetch` and `purpose: prefetch` headers come from the client.
Fix: use the exclusion for expensive optional work only, and keep any check that matters unconditional.

```ts filename="proxy.ts"
export const config = {
  matcher: [
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

⚠️ Note what this snippet now does *not* run on: prefetches. If the proxy is your only gate, you have just excluded a request class from it based on a client-supplied header. That is fine when the proxy is a filter and fatal when it is a gate.

**★ Symptom: `export const runtime = 'nodejs'` in `proxy.ts` throws at build.**
Cause: *"The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."* It throws even for the value that is already the default.
Fix: delete the export. Node.js has been the proxy default since `v16.0.0`.

**★ Symptom: the codemod ran clean and someone records "middleware migrated to proxy" as a security improvement.**
Cause: the codemod renames a file and a function. Nothing about what the layer can enforce moved.
Fix: treat it as a rename, and audit authorization as separate work. The rename exists because the *name* encouraged an Express-style gate, not because the capability changed.

**★ Symptom: a `next.config.js` redirect fires before your proxy rule and the proxy never sees the request.**
Cause: the execution order puts `headers` and `redirects` from `next.config.js` at steps 1 and 2, ahead of proxy at step 3.
Fix: if the ordering matters, express the rule in one place. Reading the eight-step list before debugging "my proxy did not run" saves an afternoon.

## Interview questions

**★ Why can a `matcher` never be generated from your route list, and what does that imply for a security design?**
Because matcher values *"need to be constants so they can be statically analyzed at build-time"* and *"dynamic values such as variables will be ignored"* — the compiler reads them, so they must be literals. The implication is that the proxy's coverage is a hand-maintained artifact that no tooling keeps in sync with your routes. An allowlist of protected paths therefore fails open on every new route, silently. An exclusion matcher over static assets fails closed. If the proxy is carrying anything you would call a control, the exclusion shape is the only defensible one — and even then the control should not be there.

**★ Why does Next.js run proxy on `/_next/data` even when your matcher explicitly excludes it?**
Because the failure it prevents was common enough to be worth overriding user configuration for: protecting the page and forgetting the corresponding data route, so the HTML redirects to login while the JSON serves the same content unauthenticated. The reference calls the override *"intentional behavior to prevent accidental security issues."* The useful reading is second-order — the framework hard-coded a rescue for the one instance of allowlist rot it could name, which tells you what it thinks of allowlist rot in general, and there is no equivalent rescue for your routes.

**★ Someone argues "middleware can't use Node APIs, so auth has to happen in the route." Is that right?**
The conclusion is right and the reason is four versions out of date. Proxy has defaulted to the Node.js runtime since `v16.0.0`, Middleware could use it as a stable option from `v15.5.0`, and setting the `runtime` option in a proxy file now throws — even for `'nodejs'`. The real reasons to put auth at the data layer are visibility and cost: proxy runs on every route including prefetched ones, may be deployed separately from your application, and cannot see the row the route is about to read. Getting the reason right matters, because someone holding the stale version will "fix" it by adding a database session lookup now that Node is available, which makes both the performance and the deployment problems worse.

**★ Why did Vercel rename `middleware` to `proxy`, and what does the rename tell you about intended usage?**
The stated reason is that *"the term 'middleware' can often be confused with Express.js middleware, leading to a misinterpretation of its purpose"*, and that *"Middleware is highly capable, so it may encourage the usage; however, this feature is recommended to be used as a last resort."* "Proxy" was chosen because it *"implies a network boundary in front of the app."* The rename is a documentation-level attempt to stop people building an Express-style authorization chain in a component that may not run in the same process as the application. The Express analogy is exactly the thing that breaks: there, middleware runs immediately before the handler with the same objects in scope; here it does not.

**★ Where does proxy sit in the request pipeline, and which two neighbours change how you debug it?**
Third of eight: after `headers` and `redirects` from `next.config.js`, before `beforeFiles` rewrites and filesystem route resolution. The two that matter are the neighbour above — a config-level redirect fires first, so "my proxy did not run" is often a `next.config.js` rule — and the neighbour below: filesystem routes resolve *after* proxy, which is the mechanical reason proxy cannot know which page will handle the request. At the moment it executes, that has not been decided yet.

---

← [04 · `proxy.ts` as a coarse filter](04-defense-in-depth-proxyts-as-a-coarse-filter.md) · [Chapter 10 overview](01-explanation.md) · Next → [04c · The innermost layer that can see the fact](04c-defence-in-depth-the-innermost-layer-that-can-see-the-fact.md)
