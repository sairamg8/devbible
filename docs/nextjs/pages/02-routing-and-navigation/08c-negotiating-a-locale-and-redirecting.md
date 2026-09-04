---
title: "Locale detection is a matching problem you now solve yourself in proxy.ts — and every piece of advice that says to do it in middleware.ts on the edge is wrong twice, because the convention was renamed and the runtime is Node"
sidebar_label: "08c · Negotiating and redirecting"
sidebar_position: 46
description: "Reading Accept-Language with Negotiator and @formatjs/intl-localematcher, the NEXT_LOCALE cookie you now have to read yourself, the proxy redirect and its matcher, and generateStaticParams for a fixed set of locales."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Internationalization (App Router)](https://nextjs.org/docs/app/guides/internationalization) (`lastUpdated: 2026-06-10`), [How to implement internationalization in Next.js (Pages Router)](https://nextjs.org/docs/pages/guides/internationalization) (`lastUpdated: 2026-03-03`), [Proxy — getting started](https://nextjs.org/docs/app/getting-started/proxy) (`lastUpdated: 2025-12-20`) and [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**. Continues [08 · Localized routing](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md).

**A request for `/products` carries a preference — `Accept-Language: en-US,en;q=0.5` — and possibly a cookie, and has to end up at `/en-US/products`. In the Pages Router the framework did that. In the App Router you write it, in one file, and there are three separate ways for the advice you find online to be out of date: the file is called `proxy.ts` and not `middleware.ts` since v16, it runs on Node.js rather than the Edge runtime, and `NEXT_LOCALE` is a Pages Router built-in that nothing reads for you here. What remains true is the algorithm, and the docs still name the two libraries that implement it.**

## Matching a locale from `Accept-Language`

> *"It's recommended to use the user's language preferences in the browser to select which locale to use. Changing your preferred language will modify the incoming `Accept-Language` header to your application."*
>
> *"For example, using the following libraries, you can look at an incoming `Request` to determine which locale to select, based on the `Headers`, locales you plan to support, and the default locale."*

```js title="proxy.js"
import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'

let headers = { 'accept-language': 'en-US,en;q=0.5' }
let languages = new Negotiator({ headers }).languages()
let locales = ['en-US', 'nl-NL', 'nl']
let defaultLocale = 'en-US'

match(languages, locales, defaultLocale) // -> 'en-US'
```

Two libraries, two jobs. `Negotiator` parses the header into an ordered list of preferences, honouring the `q` weights. `@formatjs/intl-localematcher` performs the actual *lookup* — given the ordered preferences, your supported set and a default, it returns one supported locale. Neither is bundled with Next.js; both are named by the guide as the way to do this.

🔴 **Matching is not string equality.** A browser asking for `nl-BE` matches `nl` if `nl` is in your supported list, and matches nothing if only `nl-NL` is. This is why the Pages Router guide's advice about fallbacks survives the loss of its mechanism:

> *"If user locale is `nl-BE` and it is not listed in your configuration, they will be redirected to `nl` if available, or to the default locale otherwise. If you don't plan to support all regions of a country, it is therefore a good practice to include country locales that will act as fallbacks."*

## The `NEXT_LOCALE` cookie is not built in here

The cookie has a documented meaning — **in the Pages Router**:

> *"Next.js allows setting a `NEXT_LOCALE=the-locale` cookie, which takes priority over the accept-language header. This cookie can be set using a language switcher and then when a user comes back to the site it will leverage the locale specified in the cookie when redirecting from `/` to the correct locale location."*
>
> *"For example, if a user prefers the locale `fr` in their accept-language header but a `NEXT_LOCALE=en` cookie is set the `en` locale when visiting `/` the user will be redirected to the `en` locale location until the cookie is removed or expired."*

⚠️ **That description is in the Pages Router guide, and the App Router guide never mentions a cookie at all.** So in the App Router `NEXT_LOCALE` is a *name*, not a feature: nothing reads it, nothing gives it priority. If you want an explicit user choice to beat the header — and you almost always do, because a language switcher that loses its effect on the next visit is a bug — you implement the precedence yourself. The name is still worth keeping for the sake of anyone migrating.

```ts title="proxy.ts"
import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'
import type { NextRequest } from 'next/server'

const locales = ['en-US', 'nl-NL', 'nl']
const defaultLocale = 'en-US'

export function getLocale(request: NextRequest): string {
  const cookie = request.cookies.get('NEXT_LOCALE')?.value
  if (cookie && locales.includes(cookie)) return cookie

  const negotiatorHeaders: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    negotiatorHeaders[key] = value
  })

  const languages = new Negotiator({ headers: negotiatorHeaders }).languages()
  return match(languages, locales, defaultLocale)
}
```

The cookie is checked first and validated against the supported list before it is trusted — it is user-controlled input that is about to become a URL segment.

## The redirect

> *"Routing can be internationalized by either the sub-path (`/fr/products`) or domain (`my-site.fr/products`). With this information, you can now redirect the user based on the locale inside Proxy."*

```js title="proxy.js"
import { NextResponse } from "next/server";

let locales = ['en-US', 'nl-NL', 'nl']

// Get the preferred locale, similar to the above or using a library
function getLocale(request) { ... }

export function proxy(request) {
  // Check if there is any supported locale in the pathname
  const { pathname } = request.nextUrl
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return

  // Redirect if there is no locale
  const locale = getLocale(request)
  request.nextUrl.pathname = `/${locale}${pathname}`
  // e.g. incoming request is /products
  // The new URL is now /en-US/products
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    '/((?!_next).*)',
    // Optional: only run on root (/) URL
    // '/'
  ],
}
```

⚠️ That block is quoted verbatim from the guide, including its `function getLocale(request) { ... }` placeholder — it is the one elision in it, and the implementation above fills it.

Three details in it are load-bearing:

1. **The early return does nothing on purpose.** Returning `undefined` from `proxy` lets the request continue untouched; only a path *without* a locale is rewritten.
2. **The prefix test checks two shapes.** `pathname.startsWith('/nl/')` misses `/nl` exactly, which is why the equality check is there. Without it, `/nl` gets redirected to `/en-US/nl`.
3. **The matcher excludes `_next`.** Without the exclusion, every static asset and RSC payload request goes through the redirect and gets a locale prefix, which breaks them.

## 🔴 Two things every older i18n tutorial gets wrong

**The file is `proxy.ts`, not `middleware.ts`.**

> *"The `middleware` filename is deprecated, and has been renamed to `proxy` to clarify network boundary and routing focus."*
>
> *"The named export `middleware` is also deprecated. Rename your function to `proxy`."*

**And it does not run on the edge.**

> *"The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured. If you want to continue using the `edge` runtime, keep using `middleware`. We will follow up on a minor release with further `edge` runtime instructions."*

So "detect the locale at the edge, before the request reaches your server" is a sentence about a previous version. The consequences for what you may put in this file — including the module-level-state trap, which matters if you were thinking of caching a matcher instance — are [07 · `proxy.ts`: the deployment boundary](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md). Read it before writing anything stateful here.

The getting-started page also gives the shape of the file and a boundary worth respecting for locale work specifically:

> *"Proxy is *not* intended for slow data fetching."*

Locale negotiation is header parsing and a set lookup. If yours has grown a database call, it is in the wrong place.

## Prerendering the locale set

Once the redirect guarantees a prefix, the set of locales is finite and known, so it can be prerendered:

```tsx title="app/[lang]/layout.tsx"
export async function generateStaticParams() {
  return [{ lang: 'en-US' }, { lang: 'de' }]
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  return (
    <html lang={(await params).lang}>
      <body>{children}</body>
    </html>
  )
}
```

> *"To generate static routes for a given set of locales, we can use `generateStaticParams` with any page or layout. This can be global, for example, in the root layout."*

Under Cache Components this stops being optional for a root parameter — each root param needs at least one value or the build fails. The rules and the interaction with nested `generateStaticParams` are in [11 · Root params](11-root-params.md) and [03e · gSP under Cache Components](03e-generatestaticparams-under-cache-components.md).

## Gotchas

**★ Symptom: every locale has a prefix and the marketing team wants `/products` to serve English.** Cause: the Pages Router served the default locale without a prefix — *"The default locale does not have a prefix"* — and the App Router pattern redirects everything. Fix: this is a deliberate design decision, not a bug to patch. Serving the same content at both `/products` and `/en-US/products` needs a canonical URL or you have created duplicate content for every page; the redirect-everything approach avoids that by construction. If you do want prefix-free defaults, you own the rewrite *and* the canonicals — see [12 · 05b · Canonicals and redirect hygiene](../12-seo-metadata-and-accessibility/05b-canonicals-duplicate-urls-and-redirect-hygiene.md).

**★ Symptom: `/nl-BE` 404s even though Dutch is supported as `nl`.** Cause: the Pages Router redirected an unlisted regional locale to its bare language and then to the default; nothing does that in the App Router. Fix: let the matcher do it, and include the bare-language codes in your supported list so there is something to fall back *to* — *"it is therefore a good practice to include country locales that will act as fallbacks."*

```ts
const locales = ['en-US', 'nl-NL', 'nl']   // 'nl' is the fallback for nl-BE
```

**★ Symptom: `middleware.ts` still works but a deprecation warning appears, or a tutorial's `export function middleware` does nothing.** Cause: v16 renamed both the file and the named export — *"The `middleware` filename is deprecated, and has been renamed to `proxy`"* and *"The named export `middleware` is also deprecated. Rename your function to `proxy`."* Fix: rename both.

```bash
mv middleware.ts proxy.ts
```

```ts title="proxy.ts"
export function proxy(request: Request) {}
```

**★ Symptom: static assets 404 and the app loads without CSS after adding the locale redirect.** Cause: the matcher is missing, so `_next/static/*` requests are redirected to `/en-US/_next/static/*`. Fix: exclude internal paths, as the documented matcher does.

```js
export const config = {
  matcher: ['/((?!_next).*)'],
}
```

**★ Symptom: `/nl` redirects to `/en-US/nl`.** Cause: the prefix test used only `pathname.startsWith('/nl/')`, which does not match the bare locale path. Fix: test both shapes, exactly as the guide's example does.

```js
const pathnameHasLocale = locales.some(
  (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
)
```

**★ Symptom: a user picks a language, and the next visit puts them back on the browser's language.** Cause: `NEXT_LOCALE` has no built-in meaning in the App Router — its priority over `Accept-Language` is a *Pages Router* behaviour. Fix: read the cookie yourself, before the header, and validate it against the supported list.

```ts
const cookie = request.cookies.get('NEXT_LOCALE')?.value
if (cookie && locales.includes(cookie)) return cookie
```

**★ Symptom: a crafted cookie value ends up in the URL and in `html lang`.** Cause: the cookie was trusted without validation and interpolated straight into a redirect path. Fix: membership-test it against your supported set — the same check that makes the fallback correct also makes it safe.

**★ Symptom: the locale redirect works locally and behaves inconsistently in production.** Cause: state kept in a module-level variable in `proxy.ts` — a cached matcher, a memoized supported-locale set built at first request. Proxy may be deployed separately from the app, so that state is shared in `next dev` and not necessarily in production. Fix: keep `proxy.ts` stateless; build the locale list from a constant, not from anything computed at runtime. The full mechanism is in [07 · `proxy.ts`: the deployment boundary](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md).

**★ Symptom: the negotiation grew a database lookup — "which locale did this user pick last time" — and every navigation is slow.** Cause: proxy runs on every matched request and the docs are explicit that it *"is not intended for slow data fetching."* Fix: put the persisted preference in the cookie at the moment the user chooses it, and read the cookie here. The header and the cookie are both already on the request; nothing else needs to be.

**★ Symptom: `next build` fails with an empty-root-param error after enabling Cache Components.** Cause: a root parameter must have at least one value at build time, and `[lang]` is a root parameter. Fix: add `generateStaticParams` to the root layout returning your locale list.

```tsx title="app/[lang]/layout.tsx"
export async function generateStaticParams() {
  return [{ lang: 'en-US' }, { lang: 'de' }]
}
```

## Interview questions

**★ Walk through what happens to a request for `/products` from a browser sending `Accept-Language: nl-BE,nl;q=0.9,en;q=0.5`.**
`proxy.ts` runs first, because the matcher does not exclude the path. It checks whether the pathname already starts with a supported locale; it does not. It then negotiates: if a valid `NEXT_LOCALE` cookie is present that wins, otherwise `Negotiator` parses the header into an ordered preference list and `@formatjs/intl-localematcher` matches it against the supported set with a default. `nl-BE` is not supported, `nl` is, so the result is `nl`. The proxy sets `nextUrl.pathname` to `/nl/products` and returns a redirect. The browser follows it, `app/[lang]/…` renders with `lang === 'nl'`, and the dictionary loader picks the Dutch strings.

**★ Why do you need two libraries for locale detection?**
They do different jobs. `Negotiator` parses `Accept-Language` — a weighted, ordered list with `q` values — into a plain ordered array of language tags. `@formatjs/intl-localematcher` then performs the lookup against *your* supported set with a default, which is a real algorithm rather than an array search: `nl-BE` has to resolve to `nl`, and something has to decide what happens when nothing matches. Doing either by hand is where the subtle bugs live.

**★ Someone's blog post says to detect the locale in `middleware.ts` at the edge, before the request hits your server. What is wrong with that in Next.js 16?**
Two things independently. The convention was renamed: *"The `middleware` filename is deprecated, and has been renamed to `proxy`"*, and the named export was renamed with it. And the runtime changed: *"The `edge` runtime is NOT supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured."* So the file name is stale and the performance model the advice assumes no longer holds. The algorithm in the post is still fine; the deployment story is not.

**★ Does `NEXT_LOCALE` work in the App Router?**
Only if you make it. Its documented behaviour — taking priority over `Accept-Language`, surviving between visits — appears in the Pages Router guide and describes the built-in i18n routing. The App Router guide does not mention a cookie at all. So in an App Router app the name is a convention and the precedence is code you write in the proxy, ahead of the header check. Keeping the name is still worth it for anyone reading the app after migrating.

**★ Why does the documented matcher exclude `_next`?**
Because the proxy would otherwise rewrite every internal request — static chunks, RSC payloads, images — to a locale-prefixed path that does not exist. The result is an app that renders without CSS and fails to hydrate, with no error pointing at the redirect. Any matcher for a locale redirect has to exclude internal paths, and in practice also the file-extension requests in `public/`.

**★ Why does the prefix test compare both `startsWith('/nl/')` and `=== '/nl'`?**
Because a bare locale path has no trailing slash. With only the `startsWith` check, `/nl` looks unprefixed and gets redirected to `/en-US/nl`, which then 404s or renders a page whose slug is a language code. It is a one-character bug that only manifests on the locale landing pages — the ones you are least likely to click during development.

**★ The user changes language with a switcher. Where does that decision live?**
In a cookie, written when they choose, and read in the proxy ahead of the header. It cannot live in the URL alone, because the whole point is that it survives a visit to a URL with no prefix; and it should not live in a database lookup performed by the proxy, which the docs warn is not for slow data fetching. The cookie also has to be validated against the supported list before it is used, since it is user-controlled and is about to become a path segment.

**★ Why can you prerender every locale, and when does that become mandatory?**
Because after the redirect the locale set is finite and known — the same list the matcher uses — so `generateStaticParams` on the root layout enumerates it exhaustively. It becomes mandatory under Cache Components, where a root parameter with no values fails the build: `[lang]` is a root parameter, so the root layout has to supply at least one.

---

← [08b · Dictionaries and the locale](08b-dictionaries-and-reading-the-locale.md) · [Chapter 2 overview](01-explanation.md) · Next → [11 · Root params](11-root-params.md)
