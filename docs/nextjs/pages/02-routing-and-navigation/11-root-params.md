---
sidebar_position: 11
title: "next/root-params turns the dynamic segments above your root layout into importable async getters, which ends prop-drilling for locale and makes those params usable inside a use cache scope"
sidebar_label: "11 · Root params"
description: "How next/root-params generates a getter per root segment, why only segments above the root layout qualify, how root params interact with generateStaticParams, and why calling a getter inside a cached function keeps the cache key narrow."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params), the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3) and the [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).
> Target: **Next.js 16.3.4** · `next/root-params` introduced in v16.3.0; replaces the removed `unstable_rootParams`.

**A `[lang]` segment above your root layout is effectively a global: every route in the application has one, and every shared utility, layout and deeply nested component is likely to want it. Until 16.3 the only way to read it was to drill it down as props from the page. `next/root-params` exports one async getter per such segment — `import { lang } from 'next/root-params'` — callable from any Server Component or server-side utility. The subtle payoff is not ergonomics but caching: because the getters are imported functions, Next.js can see which ones a `'use cache'` function actually uses and key the entry on those alone.**

## The API

The module exports one async function per root segment, named after the folder:

The export names are generated from your dynamic segment folder names — a root layout inside
`app/[locale]` gives you a `locale` import from `next/root-params`.

```tsx title="app/[lang]/layout.tsx"
import { lang } from 'next/root-params'

export default async function RootLayout(props: LayoutProps<'/[lang]'>) {
  return (
    <html lang={await lang()}>
      <body>{props.children}</body>
    </html>
  )
}
```

Each getter returns a promise. There is no argument and no context object to thread through.

## What counts as a root param

Root parameters are the dynamic segments appearing **before** the root layout. Unlike the
ordinary `params` prop, their getters can be called from any Server Component in the
application without prop-drilling.

Given `app/[lang]/layout.tsx` and `app/[lang]/posts/[slug]/page.tsx`, only `lang` is a root param. `slug` is an ordinary route param and still arrives through `props.params`:

```tsx title="app/[lang]/posts/[slug]/page.tsx"
import { lang } from 'next/root-params'

export default async function PostPage(
  props: PageProps<'/[lang]/posts/[slug]'>
) {
  const { slug } = await props.params
  const language = await lang()

  return (
    <article>
      <p>Language: {language}</p>
      <p>Post: {slug}</p>
    </article>
  )
}
```

## Why the line is drawn at the root layout

This is the part worth understanding rather than memorising, because it explains why the API cannot simply be extended to all params:

The reason that is safe is structural. The root layout is the top-level rendering boundary, so
route parameters sitting before it are **shared by every route beneath it** — which is what
makes them readable from anywhere in that tree. Parameters deeper in the route vary depending
on which child page is rendering, and cannot offer the same guarantee.

```txt
app/
  [lang]/              ← root parameter (shared by all routes below)
    layout.tsx         ← root layout
    page.tsx           ← has no slug, doesn't know about blog or store
    blog/
      [slug]/          ← route parameter
        page.tsx
    store/
      [...slug]/       ← catch-all route parameter with the same name
        page.tsx
```

`lang` exists for every route under that layout. `slug` does not exist at all for `page.tsx`, and where it does exist it has two different shapes — `string` under `blog`, `string[]` under `store`. A global getter for `slug` could not be given a coherent type or a coherent value, which is exactly why deeper params stay on the `params` prop.

## Shared utilities stop taking a `lang` argument

The getters are module imports, so any server-side helper can call them:

```ts title="lib/get-translations.ts"
import { lang } from 'next/root-params'

export async function getTranslations() {
  const language = await lang()
  // Load translations based on the root language parameter
  return import(`@/locales/${language}.json`)
}
```

There is no need to add `import 'server-only'` to a file using `next/root-params` — the import
already fails at build time if it reaches a Client Component.

## The caching payoff

This is the reason to prefer a root param getter over the `params` prop even where both would work:

Because the getters are **imported functions**, Next.js can track which ones a cached function
actually calls. Only those root parameters join the cache key, so entries are not fragmented
across parameter values the function never read.

```tsx title="app/[lang]/components/cached-nav.tsx"
import { lang } from 'next/root-params'

// The cache key for this function only includes `lang`,
// not every dynamic segment in the route.
async function getNavigation() {
  'use cache'
  const language = await lang()
  const res = await fetch(`https://api.example.com/nav?lang=${language}`)
  return res.json()
}

export default async function CachedNav() {
  const nav = await getNavigation()
  return <nav>{/* render nav items */}</nav>
}
```

Contrast the `params` prop, which cannot be read inside a cached function at all — you must await it outside and pass the value in:

```tsx title="app/[lang]/page.tsx"
import { lang } from 'next/root-params'

// With root params: call directly inside the cached function
async function getDataWithRootParams() {
  'use cache'
  const language = await lang()
  return fetch(`https://api.example.com/data?lang=${language}`)
}

// Without root params: await params outside, pass as argument
async function getDataWithParams(language: string) {
  'use cache'
  return fetch(`https://api.example.com/data?lang=${language}`)
}

export default async function Page(props: PageProps<'/[lang]'>) {
  const { lang: language } = await props.params
  const data = await getDataWithParams(language)
  // ...
}
```

Both work. The first keeps the read colocated with the use and lets the framework derive the key; the second makes the key an explicit argument you have to remember to pass everywhere.

## Root params and `generateStaticParams`

Root parameters work as soon as the routes defining them exist. `generateStaticParams` is
required **only** with Cache Components — and there each root parameter must have at least one
value or the build fails.

```tsx title="app/[lang]/layout.tsx"
import { lang } from 'next/root-params'

export default async function RootLayout(props: LayoutProps<'/[lang]'>) {
  return (
    <html lang={await lang()}>
      <body>{props.children}</body>
    </html>
  )
}

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'fr' }]
}
```

With multiple root params, return a value for each:

```tsx title="app/[lang]/[locale]/layout.tsx"
export async function generateStaticParams() {
  return [
    { lang: 'en', locale: 'us' },
    { lang: 'en', locale: 'uk' },
  ]
}
```

And inside a *nested* segment's `generateStaticParams`, the getter works directly — you do not have to destructure the parent value out of the argument:

```tsx title="app/[lang]/posts/[slug]/page.tsx"
import { lang } from 'next/root-params'

export async function generateStaticParams() {
  const language = await lang()
  const posts = await fetch(
    `https://api.example.com/posts?lang=${language}`
  ).then((res) => res.json())
  return posts.map((post) => ({ slug: post.slug }))
}
```

## Gotchas

**★ A kebab-cased segment name is a hard error, not a silent skip.**
Names must be **valid JavaScript function identifiers**, which follows from the getters being
imports. Kebab-cased segment names such as `[post-slug]` are unsupported and error at dev time
or during the build.

The export name is generated from the folder name, and `post-slug` is not a legal identifier. This bites hardest on an existing app being upgraded, where a directory named years ago suddenly has to be renamed — and renaming a segment changes URLs, so it is a redirect exercise, not a rename.

**★ Under Cache Components, a root param with no `generateStaticParams` value fails the build.**
Root params are the one place where `generateStaticParams` becomes mandatory: *"each root parameter must have at least one value or the build fails."* This is different from deeper segments, where omitting it just means nothing is prerendered. A team enabling `cacheComponents` on an i18n app will hit this immediately, and the fix is to list at least one locale even if you intend the rest to be generated on demand.

**★ Only segments *above* the root layout qualify, and "above" means above the file, not above in your head.**
If your root layout is `app/layout.tsx` and the locale segment is `app/[lang]/layout.tsx`, then `lang` is **not** a root param — the root layout is the one containing `<html>` and `<body>`, and it must sit *inside* `app/[lang]/` for `lang` to be root. Getting this wrong produces a module that does not export the name you expect.

**★ The types do not exist until something generates them.**
Types for the `next/root-params` exports are generated during `next dev`, `next build` or
`next typegen` — the same pipeline that produces `PageProps` and `LayoutProps`.

A fresh clone that runs `tsc` before ever running `next dev` will not find the module's exports. Add `next typegen` ahead of type checking in CI, the same way you would for the route-aware helpers.

**★ `unstable_rootParams` was removed in Next.js 16, not deprecated.**
The upgrade guide lists it under Removals: *"The `unstable_rootParams` function has been removed. Use `next/root-params` instead."* There is no compatibility window and no codemod listed for it, so the migration is a hand edit — and the shape changed from one function returning an object to one named getter per segment.

**★ Calling a getter inside a cached function widens that function's cache key, deliberately.**
The narrow-key behaviour is a benefit, but it is symmetric: a helper that calls `lang()` gets `lang` in its key, so a "global" cached function suddenly has one entry per locale. That is correct — the output depends on the locale — but it does change your cache entry count, and calling a getter you do not actually need is a real cost.

**★ The restrictions are not a footnote.** Getters run in Server Components only: a Client Component import is a build error, and Server Actions, `unstable_cache` and Route Handlers each fail their own way. Only Route Handler support is described as planned. The four cases and their workarounds are in [11b · Restrictions and typing](11b-root-params-restrictions-and-typing.md).

**★ There is no getter for `slug`, and there never will be.**
The docs frame the restriction as permanent for everything except Route Handlers. Deeper params vary per page, can differ in type between siblings (`[slug]` vs `[...slug]`), and may not exist at all on the page directly under the layout — so no global getter could have a coherent type. Reach for the `params` prop, and if the prop-drilling is painful, that is a signal the value probably belongs above the root layout.

## Interview questions

**★ What problem does `next/root-params` solve that the `params` prop did not?**
Prop-drilling for params defined above the root layout. Those params are shared by every route in the tree, so every shared utility, layout and deeply nested component is likely to want them, and the only previous way to get one was to pass it down from the page. The module exports one async getter per such segment, importable anywhere on the server.

**★ Which segments get a getter, and why is the boundary drawn there?**
Only dynamic segments appearing before the root layout. The root layout is the top-level rendering boundary, so params before it are shared by every route beneath it and are therefore safe to read from anywhere in that tree. Params deeper in the route vary per page: the same name can have different types, different meanings, or not exist at all depending on which page renders, so no coherent global getter is possible.

**★ Why does using a root param getter inside a `'use cache'` function produce a better cache key than passing the value in as an argument?**
It does not produce a *better* key so much as an automatic and minimal one. Because the getters are imported functions, Next.js can track which ones a cached function actually calls, and only those root params enter the key — so entries are not split across unrelated parameter values. With the `params` prop you cannot read it inside the cached function at all; you must await it outside and pass it as an argument, which makes the key an explicit contract you have to maintain by hand at every call site.

**★ When does `generateStaticParams` become mandatory for a root param?**
With Cache Components enabled. In that mode each root parameter must have at least one value or the build fails. Without Cache Components, root parameters are available as soon as the routes that define them exist, and `generateStaticParams` is optional as usual.

**★ You want to prerender post slugs per language. How do you read the language inside the nested `generateStaticParams`?**
Call the getter directly. Inside a nested segment's `generateStaticParams` you can `await lang()` instead of destructuring the parent value out of the argument, then fetch and return the slugs for that language.

**★ Your app has an `app/[post-slug]/` segment above the root layout. What happens?**
An error at dev time or during the build, because the export name is derived from the folder name and `post-slug` is not a valid JavaScript identifier. The only fix is to rename the segment — which changes the URL shape, so it is a redirect exercise rather than a rename.

**★ A clean CI checkout runs `tsc` and cannot resolve `lang` from `next/root-params`. Why?**
Because those types are generated, not shipped — they are produced by `next dev`, `next build` or `next typegen`, the same as `PageProps` and `LayoutProps`. Run `next typegen` before the type-check step.

---

← [**Localized routing (i18n):** locale-prefixed routes, locale detection in `proxy.ts`, and diction…](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md) · [Chapter 2 overview](01-explanation.md) · Next → [11b · Root params: restrictions and typing](11b-root-params-restrictions-and-typing.md)
