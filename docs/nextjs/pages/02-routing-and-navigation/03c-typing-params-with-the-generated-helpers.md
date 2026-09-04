---
title: "PageProps, LayoutProps and RouteContext are generated from your route tree rather than exported by the next package, which is why they catch a renamed folder at compile time and why a clean CI checkout cannot resolve them at all"
sidebar_label: "03c · Typing params"
sidebar_position: 14
description: "The three literal-keyed typegen helpers, what next typegen actually produces, how to type a nested generateStaticParams against its parent, and how to narrow a string param to a known set without casting."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) and [`layout.js`](https://nextjs.org/docs/app/api-reference/file-conventions/layout) (both `lastUpdated: 2026-08-25`), [Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) (`lastUpdated: 2026-06-09`), [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated: 2026-08-25`) and [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**. Continues [03b · Reading params](03b-reading-params.md).

**`PageProps<'/blog/[slug]'>` is not a type exported from `next`. It is *generated* from the routes that exist on disk, which buys two things a hand-written prop type can never give you: renaming a folder becomes a compile error at every call site instead of a runtime 404, and the route literal itself gets autocompleted. It costs one thing, and teams discover it on the first CI run of a fresh clone — nothing generated exists yet, so `tsc` cannot find the name at all.**

## The three helpers

`next typegen` produces three globally-available helpers, each keyed on a route literal.

```tsx title="app/blog/[slug]/page.tsx"
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const query = await props.searchParams
  return <h1>Blog Post: {slug}</h1>
}
```

```tsx title="app/dashboard/layout.tsx"
export default function Layout(props: LayoutProps<'/dashboard'>) {
  return (
    <section>
      {props.children}
      {/* If you have app/dashboard/@analytics, it appears as a typed slot */}
    </section>
  )
}
```

```ts title="app/api/posts/[id]/route.ts"
export async function GET(
  request: Request,
  { params }: RouteContext<'/api/posts/[id]'>
) {
  const { id } = await params
  return Response.json({ id })
}
```

| Helper | Convention it types | What it infers |
|---|---|---|
| `PageProps<'/route'>` | `page.tsx` | `params` and `searchParams` |
| `LayoutProps<'/route'>` | `layout.tsx` | `params`, `children`, and named parallel-route slots |
| `RouteContext<'/route'>` | `route.ts` | `params` |

## What the docs guarantee about them

Four sentences, and every one of them is load-bearing:

> *"Using a literal route (e.g. `'/blog/[slug]'`) enables autocomplete and strict keys for `params`."*
> *"Static routes resolve `params` to `{}`."*
> *"Types are generated during `next dev`, `next build`, or with `next typegen`."*
> *"After type generation, the `PageProps` helper is globally available. It doesn't need to be imported."*

`LayoutProps` adds slot inference on top — *"strongly typed `params` and named slots inferred from your directory structure"* — so `app/dashboard/@analytics/page.tsx` becomes a typed `analytics` prop you never declared.

The upgrade guide positions all three as the migration aid for async params specifically:

> *"To help migrate to async `params` and `searchParams`, you can run `npx next typegen` to automatically generate these globally available types helpers"*
>
> *"**Good to know**: `typegen` was introduced in Next.js 15.5"*

## Typing a nested `generateStaticParams` against its parent

`generateStaticParams` receives the parent's params **synchronously** ([03b](03b-reading-params.md)), so its argument type is the *awaited* form of the parent's props. The docs give the exact incantation:

```ts title="app/products/[category]/[product]/page.tsx"
export async function generateStaticParams({
  params: { category },
}: {
  params: Awaited<LayoutProps<'/products/[category]'>['params']>
}) {
  const products = await fetch(
    `https://.../products?category=${category}`
  ).then((res) => res.json())

  return products.map((product: { id: string }) => ({ product: product.id }))
}
```

> *"For type completion, you can make use of the TypeScript `Awaited` helper in combination with either `Page Props helper` or `Layout Props helper`"*

Note the literal is the **parent's** route (`'/products/[category]'`), not the page's own — because that is the only thing this function is handed.

## Narrowing a param that has a known set of values

Route params are `string`, `string[]` or `undefined` by construction, because a user can type anything into the address bar. When a segment has a small legal domain — a locale, a plan tier, a status — the honest move is to assert at the boundary and let a bad URL become a 404:

```tsx title="app/[locale]/page.tsx"
import { notFound } from 'next/navigation'
import type { Locale } from '@i18n/types'
import { isValidLocale } from '@i18n/utils'

function assertValidLocale(value: string): asserts value is Locale {
  if (!isValidLocale(value)) notFound()
}

export default async function Page(props: PageProps<'/[locale]'>) {
  const { locale } = await props.params // locale is typed as string
  assertValidLocale(locale)
  // locale is now typed as Locale
}
```

The internationalization guide uses the predicate form of the same idea, and states the payoff plainly:

> *"Since `lang` is typed as `string`, using `hasLocale` narrows the type to your supported locales. It also ensures a 404 is returned if a translation is missing, rather than a runtime error."*

```ts title="app/[lang]/dictionaries.ts"
const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  nl: () => import('./dictionaries/nl.json').then((module) => module.default),
}

export type Locale = keyof typeof dictionaries

export const hasLocale = (locale: string): locale is Locale =>
  locale in dictionaries
```

The whole locale application of this is [08 · Localized routing](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md).

🔴 **`as Locale` is not the same thing.** A cast gives you the narrow type and zero safety: the value is still whatever the URL said, and the failure surfaces later, deeper, and with a worse message.

## Gotchas

**★ Symptom: CI fails with `Cannot find name 'PageProps'` on a clean checkout that builds fine locally.** Cause: the helpers are generated into the Next.js type output, not shipped by the `next` package — *"Types are generated during `next dev`, `next build`, or with `next typegen`."* A fresh clone that runs `tsc` before any Next.js command has nothing to resolve. Locally it works because you have already run `next dev`. Fix: generate in the same step.

```bash
npx next typegen && npx tsc --noEmit
```

**★ Symptom: `PageProps<'/about'>` gives a `params` with no keys and autocomplete offers nothing.** Cause: correct behaviour — *"Static routes resolve `params` to `{}`."* Fix: nothing, unless you expected keys, in which case the literal you passed is not the dynamic route. It must include the brackets exactly as the folder does.

```tsx
// wrong — '/blog' is the static parent
export default async function Page(props: PageProps<'/blog'>) {}

// right
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
}
```

**★ Symptom: renaming `[id]` to `[postId]` compiles clean, then 404s in production.** Cause: it does *not* compile clean once types are regenerated — but a stale `.next/types` from before the rename still satisfies the old literal. Fix: regenerate, then type-check; that converts a runtime 404 into a build failure, which is the entire reason the helpers are keyed on a literal.

```bash
rm -rf .next/types && npx next typegen && npx tsc --noEmit
```

**★ Symptom: typing a nested `generateStaticParams` with `PageProps<'/products/[category]/[product]'>['params']` produces keys that are never populated.** Cause: the function only receives the *parent's* params, so the page's own literal over-promises. Fix: key the `Awaited` on the parent route.

```ts
export async function generateStaticParams({
  params: { category },
}: {
  params: Awaited<LayoutProps<'/products/[category]'>['params']>
}) {
  return (await getProducts(category)).map((p) => ({ product: p.id }))
}
```

**★ Symptom: `Awaited<...>` is omitted and TypeScript complains that `category` does not exist on `Promise<...>`.** Cause: `LayoutProps['params']` is the promise type; `generateStaticParams` receives the resolved value. Fix: wrap it — `Awaited<LayoutProps<'/products/[category]'>['params']>`. That mismatch is the type system correctly reporting the sync/async asymmetry described in [03b](03b-reading-params.md).

**★ Symptom: a param is cast with `as Locale` and an unknown locale reaches the dictionary loader, producing `Cannot read properties of undefined`.** Cause: a cast is a compile-time assertion with no runtime check, so the invalid string survives. Fix: use a type predicate or an assertion function that actually inspects the value and calls `notFound()`.

```tsx
import { notFound } from 'next/navigation'

const { locale } = await props.params
if (!hasLocale(locale)) notFound()   // narrows AND 404s
const dict = await getDictionary(locale)
```

**★ Symptom: ESLint reports `PageProps is not defined`.** Cause: the helpers are ambient globals produced by typegen, and a lint config that enforces `no-undef` on TypeScript files does not read the generated declaration. Fix: the standard advice for TypeScript projects applies — `no-undef` should be off for `.ts`/`.tsx`, because the compiler already performs that check and the rule cannot see ambient declarations. (The Next.js docs do not discuss this rule; this is a general TypeScript-ESLint interaction, not a documented Next.js behaviour.)

**★ Symptom: `LayoutProps<'/dashboard'>` has no `analytics` prop even though `app/dashboard/@analytics/` exists.** Cause: slots are inferred *from the directory structure* at generation time, so a slot folder added after the last typegen is invisible. Fix: regenerate. If it still does not appear, the slot folder is not where you think it is — a slot must be a direct child of the segment whose layout you are typing.

## Interview questions

**★ What is `PageProps<'/blog/[slug]'>`, and why can it break CI while working perfectly on your machine?**
It is a globally available TypeScript helper, generated by `next typegen` (which `next dev` and `next build` also run), that types `params` and `searchParams` from the route literal. Because it is generated rather than exported by the `next` package, a CI job that runs `tsc --noEmit` before any Next.js command has no declaration to resolve and fails with `Cannot find name 'PageProps'`. Locally it works because you have already run `next dev` at some point. The fix is to run typegen in the same CI step.

**★ What does `LayoutProps` give you that a hand-written prop type does not?**
Two things: strict `params` keys derived from the route literal, and the named parallel-route slots inferred from the directory structure — so an `@analytics` folder becomes a typed `analytics` prop with no manual declaration. Hand-written types drift the moment somebody renames a folder or adds a slot; the generated ones fail the build instead. That is the whole argument for a generated type over a declared one.

**★ Why is the helper keyed on a string literal rather than being a plain generic over an object type?**
Because the literal is what ties the type back to the filesystem. `PageProps<'/blog/[slug]'>` is only satisfiable if a route with that exact shape exists in the generated map, so a folder rename invalidates every call site that still names the old path. A plain `{ params: Promise<{ slug: string }> }` is satisfiable forever, including after the route it described stopped existing.

**★ A `[locale]` param types as `string`, but only four values are legal. How do you get a narrow type without lying to the compiler?**
Assert at the boundary with a function that actually inspects the value — either a type predicate (`(v: string): v is Locale`) used in an `if` that calls `notFound()`, or an assertion function (`(v: string): asserts v is Locale`) that calls `notFound()` internally. After the call, TypeScript narrows for the rest of the scope and an invalid URL produces a 404 rather than a crash. `as Locale` gives you the narrow type and none of the safety.

**★ Why does typing a nested `generateStaticParams` need `Awaited<...>`?**
Because `LayoutProps<'/products/[category]'>['params']` is the promise type used by the rendering conventions, while `generateStaticParams` receives the already-resolved parent params synchronously. `Awaited` unwraps the promise so the two agree. The need for that unwrap is a direct consequence of the sync/async split: everything that renders in response to a URL gets a promise, everything that enumerates routes does not.

**★ You add a parallel-route slot and the type does not appear. What is the first thing to check?**
Whether typegen has run since you created the folder — slots are inferred from the directory structure at generation time. The second thing is the folder's position: a slot has to be a direct child of the segment whose layout you are typing, so `app/dashboard/@analytics/` types `LayoutProps<'/dashboard'>` and nothing else.

---

← [03b · Reading params](03b-reading-params.md) · [Chapter 2 overview](01-explanation.md) · Next → [03d · generateStaticParams](03d-generatestaticparams-strategies.md)
