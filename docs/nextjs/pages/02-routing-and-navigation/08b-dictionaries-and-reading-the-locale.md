---
title: "Dictionaries stay on the server for free because layouts and pages are Server Components, and next/root-params is what stops the locale being drilled through every layer of the tree that needs it"
sidebar_label: "08b · Dictionaries and the locale"
sidebar_position: 126
description: "Per-locale dynamic imports, why hasLocale is a type predicate rather than a cast, why translation files do not reach the client bundle, and how root params let getDictionary take no arguments at all."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Internationalization (App Router)](https://nextjs.org/docs/app/guides/internationalization) (`lastUpdated: 2026-06-10`) and [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params) (`lastUpdated: 2026-06-24`).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**. Continues [08 · Localized routing](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md).

**Two problems sit between a `[lang]` segment and a translated page, and the App Router answers both without a library. Loading strings is a dynamic `import()` per locale in a server-only module, which means the client bundle never sees a translation file — the docs say so explicitly, and the reason is simply that layouts and pages are Server Components by default. Getting the locale *to* that module is the harder one, and it is what `next/root-params` exists for: because `[lang]` sits above the root layout, its getter is importable from any Server Component, and `getDictionary` stops taking an argument at all.**

## Dictionaries, and why they cost nothing on the client

Localization itself is not a Next.js concern:

> *"Changing displayed content based on the user's preferred locale, or localization, is not something specific to Next.js. The patterns described below would work the same with any web application."*

```json title="dictionaries/en.json"
{
  "products": {
    "cart": "Add to Cart"
  }
}
```

```json title="dictionaries/nl.json"
{
  "products": {
    "cart": "Toevoegen aan Winkelwagen"
  }
}
```

```ts title="app/[lang]/dictionaries.ts"
import 'server-only'

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  nl: () => import('./dictionaries/nl.json').then((module) => module.default),
}

export type Locale = keyof typeof dictionaries

export const hasLocale = (locale: string): locale is Locale =>
  locale in dictionaries

export const getDictionary = async (locale: Locale) => dictionaries[locale]()
```

Two things are doing real work there. The dynamic `import()` per locale means only the requested dictionary is loaded. And `hasLocale` is a type predicate, which the guide explains precisely:

> *"Since `lang` is typed as `string`, using `hasLocale` narrows the type to your supported locales. It also ensures a 404 is returned if a translation is missing, rather than a runtime error."*

```tsx title="app/[lang]/page.tsx"
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from './dictionaries'

export default async function Page({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params

  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  return <button>{dict.products.cart}</button> // Add to Cart
}
```

And the bundle-size answer, which is the usual first objection:

> *"Because all layouts and pages in the `app/` directory default to Server Components, we do not need to worry about the size of the translation files affecting our client-side JavaScript bundle size. This code will **only run on the server**, and only the resulting HTML will be sent to the browser."*

## 🔴 Root params are the answer to locale prop-drilling

Because every route lives under `app/[lang]`, `lang` is a dynamic segment *above the root layout* — which makes it a root parameter with an importable getter. The i18n guide leads with the problem:

> *"The locale is often needed beyond the page that receives it, such as in shared data-fetching utilities or deeply nested components. Instead of prop drilling `lang` through each layer, we can read it directly with `next/root-params`."*
>
> *"`next/root-params` exports a getter for each dynamic segment above the root layout. Since every route is nested under `app/[lang]`, `lang` is a root parameter, and any Server Component or server-side utility can call its getter."*

The payoff is that `getDictionary` stops taking an argument at all:

```ts title="app/[lang]/dictionaries.ts"
import { lang } from 'next/root-params'
import { notFound } from 'next/navigation'

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  nl: () => import('./dictionaries/nl.json').then((module) => module.default),
}

export type Locale = keyof typeof dictionaries

export const hasLocale = (locale: string): locale is Locale =>
  locale in dictionaries

export const getDictionary = async () => {
  const locale = await lang()
  if (!hasLocale(locale)) notFound()
  return dictionaries[locale]()
}
```

```tsx title="app/[lang]/page.tsx"
import { getDictionary } from './dictionaries'

export default async function Page() {
  const dict = await getDictionary()
  return <button>{dict.products.cart}</button> // Add to Cart
}
```

Two `Good to know` notes come attached, and both matter:

> *"Files that import from `next/root-params` do not need `import 'server-only'`. The import already fails at build time if used in a Client Component."*
>
> *"Root parameter getters run in Server Components and server-side utilities, but not in Client Components, Server Actions, or Route Handlers."*

🔴 **Do not re-derive any of this here.** The getter API, the caching behaviour, the naming rules and the four restrictions are [11 · Root params](11-root-params.md) and [11b · Root params: restrictions and typing](11b-root-params-restrictions-and-typing.md). The restriction that bites hardest in an i18n build is the Route Handler one — which is exactly why `sitemap.ts`, `robots.ts` and `opengraph-image.ts` cannot read the locale, covered in [12 · 03d · Localized metadata](../12-seo-metadata-and-accessibility/03d-localized-metadata-for-i18n-routes.md).

## Getting strings into a Client Component

A Client Component cannot call `getDictionary()` — it is a server-only module, and the root param getter refuses to run there anyway. The pattern that works is the same one that works for any server data: resolve on the server, pass the slice down as props.

```tsx title="app/[lang]/products/page.tsx"
import { getDictionary } from '../dictionaries'
import { AddToCart } from './add-to-cart'

export default async function Page() {
  const dict = await getDictionary()
  return <AddToCart label={dict.products.cart} />
}
```

```tsx title="app/[lang]/products/add-to-cart.tsx"
'use client'

export function AddToCart({ label }: { label: string }) {
  return <button onClick={() => {}}>{label}</button>
}
```

Passing the *strings* rather than the whole dictionary is the difference between shipping one label and shipping the file. If a client subtree genuinely needs many strings, pass an object containing exactly those — it is serialized into the payload either way, so its size is a decision you are making whether or not you notice.

## Adding a locale is a two-place change

The dictionary map is the source of truth for the `Locale` type — `export type Locale = keyof typeof dictionaries` — so adding a language means adding both the JSON file and the map entry. Adding it to your supported-locales list in the redirect layer without adding it here produces prefixed URLs that immediately `notFound()`:

```ts title="app/[lang]/dictionaries.ts"
const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  nl: () => import('./dictionaries/nl.json').then((module) => module.default),
  fr: () => import('./dictionaries/fr.json').then((module) => module.default),
}
```

A useful side effect of typing the dictionaries this way, with `resolveJsonModule` enabled: `getDictionary` returns a union of the per-locale JSON module shapes, so a key that exists in `en.json` but not in `fr.json` fails to type-check at the call site rather than rendering `undefined`. That is a property of the shape rather than something Next.js guarantees — but it is a good reason to keep the map literal instead of typing it as a broad index signature.

## Gotchas

**★ Symptom: a translation key returns `undefined` and the page renders an empty button.** Cause: an unsupported locale reached the dictionary loader and indexed an object that has no such key. Fix: narrow with a type predicate and 404 — the guide's own reason for `hasLocale` is that *"it ensures a 404 is returned if a translation is missing, rather than a runtime error."*

```tsx
if (!hasLocale(lang)) notFound()
const dict = await getDictionary(lang)
```

**★ Symptom: the client bundle grows by the size of every translation file.** Cause: the dictionary module was imported into a Client Component, so the bundler followed it. Fix: keep the loader server-only. `import 'server-only'` turns the mistake into a build error; if the file also imports `next/root-params`, that import already does the same job — *"Files that import from `next/root-params` do not need `import 'server-only'`. The import already fails at build time if used in a Client Component."*

```ts title="app/[lang]/dictionaries.ts"
import 'server-only'
```

**★ Symptom: `lang` is threaded through eight components to reach a currency formatter.** Cause: treating a root parameter as an ordinary prop. Fix: import the getter; the whole point of `next/root-params` is that a segment above the root layout does not need drilling.

```ts title="app/[lang]/lib/format.ts"
import { lang } from 'next/root-params'

export async function formatPrice(cents: number) {
  const locale = await lang()
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
```

**★ Symptom: a Server Action needs the locale and the root param getter throws.** Cause: getters *"run in Server Components and server-side utilities, but not in Client Components, Server Actions, or Route Handlers."* Fix: bind the locale into the action from the component that has it, rather than trying to re-read it. The four restrictions and their individual workarounds are in [11b](11b-root-params-restrictions-and-typing.md).

**★ Symptom: a newly added locale gives prefixed URLs that all 404.** Cause: the locale was added to the supported list used by the redirect but not to the dictionary map, so `hasLocale` rejects it and the page calls `notFound()`. Fix: the two lists have to agree; deriving one from the other removes the class of bug entirely.

```ts title="app/[lang]/dictionaries.ts"
export const locales = Object.keys(dictionaries) as Locale[]
```

**★ Symptom: `getDictionary()` is called in the layout and again in three components, and the JSON is parsed four times per render.** Cause: nothing memoizes a plain async function. Fix: wrap it in React's `cache`, which deduplicates for the duration of a render.

```ts title="app/[lang]/dictionaries.ts"
import { cache } from 'react'
import { lang } from 'next/root-params'
import { notFound } from 'next/navigation'

export const getDictionary = cache(async () => {
  const locale = await lang()
  if (!hasLocale(locale)) notFound()
  return dictionaries[locale]()
})
```

**★ Symptom: a Client Component receives the whole dictionary as a prop and the RSC payload balloons.** Cause: everything passed across the server/client boundary is serialized into the response. The Server Component default protects the *bundle*, not the payload. Fix: pass the strings the component actually renders.

```tsx
const dict = await getDictionary()
return <AddToCart label={dict.products.cart} />   // not dict
```

## Interview questions

**★ How do you avoid drilling `lang` into every utility?**
Import its getter from `next/root-params`. Because `lang` is a dynamic segment above the root layout, `next/root-params` exports an async `lang()` that any Server Component or server-side utility can call. The documented refactor moves the lookup inside `getDictionary`, so callers invoke `getDictionary()` with no arguments. The getters do not work in Client Components, Server Actions or Route Handlers, so those three still need the value passed in.

**★ Do translation files bloat the client bundle?**
Not if the dictionary loader stays on the server, which it does by default — layouts and pages in `app/` are Server Components, so the docs note that the code *"will only run on the server, and only the resulting HTML will be sent to the browser."* The failure mode is importing the dictionary module into a Client Component; `import 'server-only'` converts that into a build error, and a module importing `next/root-params` already fails the same way.

**★ Why does the documented dictionary use a type predicate rather than a cast?**
Because `lang` is typed `string` — a route param can be anything a user types — and a cast would assert a narrow type without checking it, so an unsupported locale would reach the dictionary object and produce `undefined` deep in a component. `hasLocale` narrows *and* gives you the branch in which to call `notFound()`, which the guide describes as ensuring a 404 rather than a runtime error.

**★ Which parts of an i18n build cannot read the locale from `next/root-params`, and what do you do about them?**
Client Components, Server Actions and Route Handlers. The last one is the painful category for internationalization, because `sitemap.ts`, `robots.ts` and the metadata image conventions are Route Handlers — so per-locale sitemaps and OG images have to obtain the locale another way. That is why localized metadata is handled separately rather than by dropping a getter into those files.

**★ A Client Component needs three translated strings. How do they get there?**
The server resolves them and passes them down as props. `getDictionary` is a server-only module and the root param getter does not run in Client Components, so there is no way to read them on the client — which is the correct outcome, because it forces you to decide which strings cross the boundary. Passing the entire dictionary "just in case" works and puts every string into the serialized payload, so the size of the client's translation payload is always an explicit choice.

**★ What breaks when you add a fourth locale?**
Whatever list is not derived from the dictionary map. The `Locale` type is `keyof typeof dictionaries`, so the map is the natural source of truth; a locale added to the redirect layer's supported list but not to the map produces URLs that pass the redirect and then `notFound()` in the page. Exporting `Object.keys(dictionaries)` as the supported list makes the two impossible to disagree.

---

← [08 · Localized routing](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md) · [Chapter 2 overview](01-explanation.md) · Next → [08c · Negotiating a locale and redirecting](08c-negotiating-a-locale-and-redirecting.md)
