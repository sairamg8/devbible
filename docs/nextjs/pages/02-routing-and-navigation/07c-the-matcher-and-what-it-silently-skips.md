---
title: "Without a matcher proxy runs on every request including your CSS, and the matcher that fixes that is compiled at build time — which is why a value built from a variable is not rejected but silently ignored, leaving you back at matching everything"
sidebar_label: "07c · The matcher syntax"
sidebar_position: 40
description: "The default when there is no matcher and why it breaks your CSS, the four matcher shapes including the has/missing object form, the five path-to-regexp rules verbatim, why matcher values must be static literals, and negative lookaheads."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`proxy.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`), [Proxy — getting started](https://nextjs.org/docs/app/getting-started/proxy) (`lastUpdated: 2025-12-20`) and the [Authentication guide](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**.

**The matcher is the entire security surface of a proxy, and the two ways it goes wrong are opposites. Leave it out and proxy runs on your static assets, your optimised images and everything in `public/` — which is how an auth redirect ends up serving a login page instead of a stylesheet. Build one out of a variable and it is not rejected, not warned about, but *ignored* — which puts you straight back at matching everything, with a `config` block sitting in the file that makes it look as though you did not. This page is the syntax: the four shapes, the five path-to-regexp rules verbatim, and why the values have to be literals. What the matcher does not cover, even when you think it does, is [07d](07d-what-the-matcher-silently-skips.md).**

## No matcher means every request

> *"Without a `matcher`, Proxy runs on **every request**, including static files (`_next/static`), image optimizations (`_next/image`), and assets in the `public/` folder. Consider using a negative match pattern to exclude these paths, otherwise auth logic or redirects can unintentionally block CSS, JS, or images from loading."*

This is not a performance note. Combined with the pipeline position — proxy is step 3, filesystem routes are step 5 — a matcher-less proxy that redirects unauthenticated users will redirect the browser's request for `main.css` to `/login`, and the page renders unstyled with no error anywhere.

```ts
// proxy.ts — the shape almost every real app wants
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

## The four shapes a matcher takes

> *"For a single path: Directly use a string to define the path, like `'/about'`."*
> *"For multiple paths: Use an array to list multiple paths, such as `matcher: ['/about', '/contact']`, which applies the Proxy to both `/about` and `/contact`."*

```ts
export const config = { matcher: '/about/:path*' }
```

```ts
export const config = { matcher: ['/about/:path*', '/dashboard/:path*'] }
```

> *"Additionally, the `matcher` option supports complex path specifications using regular expressions."*

```ts
export const config = {
  matcher: [
    // Exclude API routes, static files, image optimizations, and .png files
    '/((?!api|_next/static|_next/image|.*\\.png$).*)',
  ],
}
```

And the object form, which is where conditional matching lives:

> *"The `matcher` option accepts an array of objects with the following keys:"*
> *"`source`: The path or pattern used to match the request paths. It can be a string for direct path matching or a pattern for more complex matching."*
> *"`locale` (optional): A boolean that, when set to `false`, ignores locale-based routing in path matching."*
> *"`has` (optional): Specifies conditions based on the presence of specific request elements such as headers, query parameters, or cookies."*
> *"`missing` (optional): Focuses on conditions where certain request elements are absent, like missing headers or cookies."*

```ts
export const config = {
  matcher: [
    {
      source: '/api/:path*',
      locale: false,
      has: [
        { type: 'header', key: 'Authorization', value: 'Bearer Token' },
        { type: 'query', key: 'userId', value: '123' },
      ],
      missing: [{ type: 'cookie', key: 'session', value: 'active' }],
    },
  ],
}
```

The `locale: false` key matters to anyone doing i18n: with locale routing on, `/api/x` and `/fr/api/x` are different paths, and `locale: false` makes the source pattern ignore the prefix. That interaction is taught alongside the rest of locale routing in [08 · Localized routing](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md).

## The five path-to-regexp rules, verbatim

> 1. *"MUST start with `/`"*
> 2. *"Can include named parameters: `/about/:path` matches `/about/a` and `/about/b` but not `/about/a/c`"*
> 3. *"Can have modifiers on named parameters (starting with `:`): `/about/:path*` matches `/about/a/b/c` because `*` is *zero or more*. `?` is *zero or one* and `+` *one or more*"*
> 4. *"Can use regular expression enclosed in parenthesis: `/about/(.*)` is the same as `/about/:path*`"*
> 5. *"Are anchored to the start of the path: `/about` matches `/about` and `/about/team` but not `/blog/about`"*

Rule 5 is the one people get backwards. `matcher: '/about'` is a **prefix** match, not an exact match — it covers `/about/team` too. If you want exactly one path and nothing beneath it, you need a pattern that says so.

Rule 2 versus rule 3 is the other frequent bug: `'/dashboard/:path'` matches `/dashboard/settings` but **not** `/dashboard/settings/billing`. One level, not a subtree. `'/dashboard/:path*'` is almost always what was meant.

## 🔴 Matcher values must be static constants

> *"The `matcher` values need to be constants so they can be statically analyzed at build-time. **Dynamic values such as variables will be ignored.**"*

Ignored — not rejected, not warned about. This is the failure mode that looks like proxy is broken:

```ts
// 🔴 WRONG — silently ignored, so proxy runs on EVERY request
const PROTECTED = process.env.PROTECTED_PREFIX ?? '/dashboard'
export const config = { matcher: [`${PROTECTED}/:path*`] }

// ✅ RIGHT — a literal the build can read
export const config = { matcher: ['/dashboard/:path*'] }
```

If you need the set of paths to vary, the variation belongs **inside the proxy function**, where it is ordinary runtime code, with a broad static matcher above it.

There is also a backward-compatibility quirk worth knowing before it surprises you:

> *"For backward compatibility, Next.js always considers `/public` as `/public/index`. Therefore, a matcher of `/public/:path` will match."*

## Negative matching

> *"The `matcher` config allows full regex so matching like negative lookaheads or character matching is supported."*

You can also combine `has` and `missing` to carve out prefetch requests specifically — a pattern whose motivation is in [07d](07d-what-the-matcher-silently-skips.md):

```ts
export const config = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
      has: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

## Gotchas

**★ Symptom: stylesheets and images 302 to `/login` and the page renders unstyled.** Cause: no matcher, so proxy ran on `_next/static` and `public/`. Verbatim: *"Without a `matcher`, Proxy runs on every request, including static files (`_next/static`), image optimizations (`_next/image`), and assets in the `public/` folder."* Fix: a negative lookahead excluding the asset prefixes.

```ts
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

**★ Symptom: the matcher built from an environment variable has no effect at all.** Cause: matcher values are read at build time. Verbatim: *"The `matcher` values need to be constants so they can be statically analyzed at build-time. Dynamic values such as variables will be ignored."* Fix: keep a literal in `config` and move the variability into the function body.

```ts
export const config = { matcher: ['/((?!api|_next/static|_next/image).*)'] }

export function proxy(request: NextRequest) {
  const prefixes = (process.env.PROTECTED_PREFIXES ?? '/dashboard').split(',')
  const { pathname } = request.nextUrl
  if (!prefixes.some((p) => pathname.startsWith(p))) return NextResponse.next()
  return guard(request)
}
```

**Symptom: `matcher: '/dashboard/:path'` misses `/dashboard/settings/billing`.** Cause: an unmodified named parameter matches exactly one segment. Verbatim: *"`/about/:path` matches `/about/a` and `/about/b` but not `/about/a/c`"* and *"`/about/:path*` matches `/about/a/b/c` because `*` is zero or more."* Fix: add the modifier.

```ts
export const config = { matcher: '/dashboard/:path*' }
```

**Symptom: `matcher: '/about'` unexpectedly covers `/about/team`.** Cause: sources are anchored at the start, not at both ends. Verbatim: *"Are anchored to the start of the path: `/about` matches `/about` and `/about/team` but not `/blog/about`."* Fix: if you truly want one path only, write a pattern that terminates.

```ts
export const config = { matcher: ['/about'] }        // prefix: also /about/team
export const config = { matcher: ['/((?!.*\\/).*)'] } // pseudo-code: illustrative only
```

⚠️ The second line above is illustrative rather than a recommendation — the reference documents anchoring at the start and points at `path-to-regexp` for everything else, and **I could not confirm a documented idiom for an exact-single-path matcher.** In practice the reliable approach is a broad matcher plus an exact `pathname === '/about'` test inside the function.

**Symptom: a matcher of `/public/:path` matches something you did not expect.** Cause: a compatibility rewrite. Verbatim: *"For backward compatibility, Next.js always considers `/public` as `/public/index`. Therefore, a matcher of `/public/:path` will match."* Fix: be aware of it if you happen to have a route literally named `/public`.

## Interview questions

**★ What happens if you omit the matcher?**
Proxy runs on every request in the project, and the docs enumerate what "every" includes: static files under `_next/static`, image optimisation requests under `_next/image`, and everything in `public/`. Because proxy is step 3 of the pipeline and filesystem routing is step 5, it sees those asset requests *before* they are served, so an auth redirect written without a matcher will redirect the browser's request for a stylesheet. The symptom is an unstyled page with no error, which is why the documentation goes out of its way to say *"auth logic or redirects can unintentionally block CSS, JS, or images from loading."*

**★ Why must matcher values be literals?**
Because they are consumed at build time, not at request time — the matcher is compiled into the routing manifest so the runtime can decide whether to invoke proxy at all without loading your module. That is also why the failure is silent: *"Dynamic values such as variables will be ignored."* An interpolated template string produces a matcher the build cannot read, so it is dropped, and dropping the matcher means proxy matches everything. The fix is a structural one — keep a broad literal in `config` and put the conditional logic inside the function, where it is ordinary code with access to the request.

**How do `has` and `missing` differ from putting the same condition inside the function?**
Placement in the pipeline, and therefore cost. A `has`/`missing` condition is evaluated as part of matching, so a request that fails it never invokes your proxy module at all. The same test written as an early `return NextResponse.next()` inside the function costs a module invocation per request. For something that fires on nearly every request — excluding prefetches, or requiring an `Authorization` header on an API prefix — that difference is worth having. The trade is readability: a matcher built from negative lookaheads plus `has` and `missing` arrays is genuinely hard to reason about, which is what `unstable_doesProxyMatch` exists to compensate for.

**`matcher: '/settings'` — does that match `/settings/profile`?**
Yes. Sources are *"anchored to the start of the path"*, so a bare path is a prefix match: `/about` covers `/about` and `/about/team` but not `/blog/about`. This is the opposite of what most people assume from `next.config` `redirects`-style thinking, and it usually works in your favour for auth guards and against you when you meant one page. The docs do not document an exact-match idiom; the dependable approach is a broad matcher and an explicit `pathname === '/settings'` comparison inside the function.


---

← [07b · Adopting proxy: rename, limits, platforms](07b-adopting-proxy-the-rename-the-limits-and-where-it-runs.md) · [Chapter 2 overview](01-explanation.md) · Next → [07d · What the matcher silently skips](07d-what-the-matcher-silently-skips.md)
