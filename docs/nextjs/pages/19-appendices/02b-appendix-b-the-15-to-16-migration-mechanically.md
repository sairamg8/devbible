---
title: "Appendix B · part 2 — the 15 → 16 migration, the half the build catches: three codemods, the removed synchronous APIs, and every removal in one table"
sidebar_label: "05 · Appendix B — the migration the build catches"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`) and [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods).
> Target: **Next.js 16.3.4** · Node.js **20.9+** · TypeScript **5.1+** · Turbopack default. Documentation-verified; **no sandbox run, no timings**.

**[Part 1](02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md) explained why the React version is not yours to choose. The migration itself splits cleanly along one line — whether something fails your build or ships to users — and that line is worth more than any ordering by feature area, because it tells you where to spend review attention. This page is the half the build catches: the three codemods and the gap between them, the fully removed synchronous Request APIs, and the removals whose only symptom is a missing symbol. The half nothing catches is [part 3](02c-appendix-b-the-changes-nothing-catches.md), and it is the one to read twice.**

## The three commands, and the gap between them

```bash
# 1 · the mechanical upgrade
npx @next/codemod@canary upgrade latest

# 2 · only if you still use synchronous Request APIs from the 15 compatibility period
npx @next/codemod@canary next-async-request-api .

# 3 · only if you used `next lint`
npx @next/codemod@canary next-lint-to-eslint-cli .
```

🔴 **The second and third are not run by the first.** The guide says so directly:

> *"The `upgrade` codemod does not run every migration codemod. If your app still uses synchronous `params`, `searchParams`, `cookies()`, `headers()`, or `draftMode()` access from the Next.js 15 compatibility period, also run the async Request APIs codemod"*

What the `upgrade` codemod *does* cover, verbatim:

> * *"Update `next.config.js` to use the new `turbopack` configuration"*
> * *"Migrate from `next lint` to the ESLint CLI"*
> * *"Migrate from deprecated `middleware` convention to `proxy`"*
> * *"Remove `unstable_` prefix from stabilized APIs"*
> * *"Remove `experimental_ppr` Route Segment Config from pages and layouts"*

And the manual equivalent, if you prefer to see every change land yourself:

```bash
npm install next@latest react@latest react-dom@latest
npm install -D @types/react@latest @types/react-dom@latest
```

## Category 1 — the build stops you

These fail `next build` loudly. They are the cheap ones: you cannot ship them by accident.

**Synchronous Request APIs are gone.**

> *"Version 15 introduced Async Request APIs as a breaking change, with **temporary** synchronous compatibility. Starting with **Next.js 16**, synchronous access is fully removed."*

The full surface: `cookies`, `headers`, `draftMode`, `params` in `layout.js`/`page.js`/`route.js`/`default.js`/`opengraph-image`/`twitter-image`/`icon`/`apple-icon`, and `searchParams` in `page.js`.

```tsx
// app/blog/[slug]/page.tsx — after `npx next typegen`, the helper types exist globally.
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const query = await props.searchParams
  return <h1>Blog Post: {slug}</h1>
}
```

`npx next typegen` generates `PageProps`, `LayoutProps` and `RouteContext`. It is not new to 16 — *"`typegen` was introduced in Next.js 15.5"* — but it is what makes the async migration type-safe rather than a search-and-replace.

**Image-generation functions went async too, and asymmetrically.** In `opengraph-image`, `twitter-image`, `icon` and `apple-icon`, the image function now receives `params` *and* `id` as promises — but the metadata generator did not change:

> *"The `generateImageMetadata` function continues to receive synchronous `params`."*

```js
// app/shop/[slug]/opengraph-image.js
export async function generateImageMetadata({ params }) {
  const { slug } = params // still synchronous
  return [{ id: '1' }, { id: '2' }]
}

export default async function Image({ params, id }) {
  const { slug } = await params // now async
  const imageId = await id      // Promise<string> when using generateImageMetadata
  return new Response(/* … */)
}
```

The `sitemap` function's `id` went the same way, and the shape of the fix is the one people get wrong — the awaited value is a **string**, so arithmetic needs an explicit conversion:

```js
// app/product/sitemap.js
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
}

export default async function sitemap({ id }) {
  const resolvedId = await id
  const start = Number(resolvedId) * 50000
  return [/* … */]
}
```

**Parallel-route slots need `default.js`.**

> *"All parallel route slots now require explicit `default.js` files. Builds will fail without them."*

**A `webpack()` config fails the build.** Covered in [Appendix A part 2](01b-appendix-a-glossary-turbopack-mcp-instant.md) — including the case where a plugin, not you, added it.

**`revalidateTag` needs a second argument.**

> *"`revalidateTag` now requires a second argument specifying a `cacheLife` profile. The single-argument form is deprecated and will produce a TypeScript error."*

```ts
// Before
revalidateTag('posts')
// After
revalidateTag('posts', 'max')
```

## Category 2 — removed, so the failure is a missing symbol

Loud, but the error message points at your call site rather than at the cause, so knowing the list saves the search.

| Removed in 16 | Replacement |
|---|---|
| AMP — `next/amp`, `useAmp`, `export const config = { amp: true }`, the `amp` config key | none; the feature is gone |
| **`next lint`**, and the `eslint` key in `next.config` | ESLint CLI (flat config) or Biome — 🔴 *"`next build` no longer runs linting"* |
| `serverRuntimeConfig`, `publicRuntimeConfig`, `getConfig()` | environment variables |
| `devIndicators.appIsrStatus` / `.buildActivity` / `.buildActivityPosition` | the indicator itself remains |
| `experimental.dynamicIO`, `experimental.useCache` | top-level `cacheComponents` |
| `unstable_rootParams` | `next/root-params` |
| `experimental.ppr`, `experimental_ppr` segment config | `cacheComponents` |

🔴 **The runtime-config removal has a subtlety worth the extra paragraph.** Moving to `process.env` is not a straight swap, because environment variables read at module scope are **baked into the build**. If the value must be read per request, the docs give the mechanism:

```tsx
import { connection } from 'next/server'

export default async function Page() {
  await connection()
  const config = process.env.RUNTIME_CONFIG
  return <p>{config}</p>
}
```

And for server-only values crossing into a Client Component, the guide points at the taint API rather than at discipline:

> *"Use the taint API to prevent accidentally passing sensitive server values to Client Components."*

## Gotchas

**★ Symptom: the upgrade codemod ran cleanly and the build still fails on `params`.** Cause: the `upgrade` codemod does not include the async Request API migration. Fix: run it explicitly — `npx @next/codemod@canary next-async-request-api .` — and then `npx next typegen` so the `PageProps`/`LayoutProps` helpers exist and the fix is type-checked rather than eyeballed.

**★ Symptom: `sitemap` produces overlapping URL ranges after the upgrade.** Cause: `id` is now a promise resolving to a **string**, so `id * 50000` becomes string arithmetic or `NaN`. Fix: await it and convert explicitly.

```js
const resolvedId = await id
const start = Number(resolvedId) * 50000
```

**★ Symptom: OG images break but only for the routes that use `generateImageMetadata`.** Cause: the asymmetry — the image function's `params` and `id` are promises, while `generateImageMetadata`'s `params` stayed synchronous. Fix: await in one and not the other, exactly as the docs show; awaiting in `generateImageMetadata` is as wrong as not awaiting in the image function.

**★ Symptom: lint stopped running and no one changed the CI config.** Cause: `next lint` was removed and *"`next build` no longer runs linting"*, so a pipeline that relied on the build to lint silently stopped. Fix: add an explicit lint step — ESLint with flat config, or Biome — and treat this as a separate change from the framework upgrade so its failures are legible.

**★ Symptom: `revalidateTag('posts')` compiled yesterday and is a type error today.** Cause: it now requires a second argument naming a `cacheLife` profile; the single-argument form is deprecated and *"will produce a TypeScript error."* Fix: name the profile, and take the moment to ask whether this call should be `updateTag` instead — the signature change walks you past every invalidation site in the codebase, which is the cheapest audit you will get.

```ts
// Before — no longer type-checks.
revalidateTag('posts')
// After — stale-while-revalidate against the `max` profile.
revalidateTag('posts', 'max')
```

**★ Symptom: the build fails on a parallel route that has worked for two years.** Cause: every `@folder` slot now requires an explicit `default.js`, and *"Builds will fail without them."* Fix: add one per slot, choosing deliberately between blank and 404 — they are different products, not different spellings.

```tsx
// app/@modal/default.tsx — nothing renders in this slot on a hard navigation.
export default function Default() {
  return null
}
```

```tsx
// app/@analytics/default.tsx — an unmatched slot is a real 404 instead.
import { notFound } from 'next/navigation'

export default function Default() {
  notFound()
}
```

**★ Symptom: `import { useAmp } from 'next/amp'` cannot resolve.** Cause: AMP support was removed entirely in 16 — the hook, the `export const config = { amp: true }` page flag and the `amp` config key. Fix: there is no replacement and none is coming. The guide's own framing is that *"Most performance benefits can now be achieved through Next.js's built-in optimizations and modern web standards"*, so this is a delete-and-retest, not a migration.

**★ Symptom: `unstable_rootParams` is undefined.** Cause: removed. Fix: import from `next/root-params` instead — this is one of the renames the `upgrade` codemod's *"Remove `unstable_` prefix from stabilized APIs"* pass is meant to catch, so if you hit it by hand, the codemod did not run over that file.

**★ Symptom: `devIndicators: { appIsrStatus: false }` is rejected.** Cause: `appIsrStatus`, `buildActivity` and `buildActivityPosition` were all removed. Fix: delete the keys. The indicator itself still exists; only those three knobs went.

**★ Symptom: you rename `experimental.useCache` to `cacheComponents` and the build now fails on pages that were fine.** Cause: it is not a rename. The docs say it outright — enabling `cacheComponents` *"can surface build errors for uncached data outside of `<Suspense>` and requires adopting the Cache Components model."* Fix: if you were not actively adopting Cache Components, **remove the old flags rather than translating them**, and schedule the adoption as its own piece of work.

**★ Symptom: ESLint stops finding your config after the upgrade.** Cause: `@next/eslint-plugin-next` now defaults to **flat config**, aligning with ESLint v10 dropping legacy support. Fix: migrate `.eslintrc` to `eslint.config.js`. This lands on top of `next lint` being removed, so a project can lose linting twice in one upgrade for two unrelated reasons — check both.

**★ Symptom: your Turbopack tracing command produces nothing.** Cause: `next dev` and `next build` now write to separate output directories and the profile path moved. Fix: use the documented path.

```bash
npx next internal trace .next-profiles/trace-turbopack.bin
```

## Interview questions

**★ You ran the `upgrade` codemod. What is definitely still left to do?**
Whatever the codemod's own list excludes. It handles the `turbopack` config move, `next lint` → ESLint CLI, `middleware` → `proxy`, dropping `unstable_` prefixes and removing `experimental_ppr`. It does *not* handle the async Request APIs if you were still on 15's synchronous compatibility, which is its own codemod. And no codemod handles category three — the silent behaviour changes in image defaults, scroll behaviour and `process.argv` — because there is no wrong code to transform, only different results.

**★ What is the trap in migrating `publicRuntimeConfig` to environment variables?**
That an environment variable read at module scope is baked in at build time, while `publicRuntimeConfig` was read at runtime. A naive swap turns a runtime value into a build-time constant, and the failure is invisible in any environment where the two happen to match — which includes the developer's machine. The documented fix is to call `connection()` before reading `process.env` when the value must be per-request, and to use `NEXT_PUBLIC_` only for values you are content to have in the client bundle.

**★ How would you sequence this upgrade across a team?**
Separate the things that fail independently. First, the Node floor to 20.9 as its own change, so a runner failure is not tangled with a framework failure. Second, the async Request API codemod, which can land on 15 before the major. Third, agree the browser matrix against analytics, because that is the only requirement that fails in front of users. Then the major itself — `next`, `react`, `react-dom` and both `@types` packages together — followed by a deliberate pass over the silent list: image defaults, scroll behaviour, any `next.config` side effect keyed on `process.argv`, and any CI gate that parsed `First Load JS`.

**★ Why does a `webpack()` config fail the build outright instead of warning?**
Because a warning would be ignored and the result would be a production build silently missing everything that config was there to do. The docs say the failure exists *"to prevent misconfiguration issues"* — it is a forcing function. It also gives you three explicit, documented answers rather than one: build with Turbopack and ignore the config, port the config to `turbopack` options, or opt out with `--webpack`. The one thing it refuses to do is guess which of those you meant.

**★ What does `npx next typegen` give you, and why does it matter for this migration specifically?**
It generates `PageProps`, `LayoutProps` and `RouteContext` as globally available type helpers keyed by route — so `PageProps<'/blog/[slug]'>` types both `params` and `searchParams` for that exact route. It matters here because the async Request API migration is otherwise a mechanical edit with no safety net: you are adding `await` in hundreds of places and nothing checks you added it in the right ones. With the generated types, a missed `await` is a compile error rather than a runtime surprise. It is not new to 16 — it arrived in 15.5 — which means you can run it *before* the major and migrate under type checking.

**★ Two of the removals in 16 are about linting. What are they and why does that combination bite?**
`next lint` was removed as a command, and separately `next build` no longer runs linting at all — so a pipeline whose only lint step was implicit in the build now has none. On top of that, `@next/eslint-plugin-next` switched its default to flat config, so even teams that add an explicit ESLint step can find their existing `.eslintrc` ignored. The combination bites because both failures are silent: nothing errors, lint simply stops happening, and the first evidence is a review catching something a rule used to catch.

**★ You inherit a project mid-upgrade. How do you tell whether the codemod ran?**
Look for its five specific outputs: a top-level `turbopack` key rather than `experimental.turbopack`; no `next lint` in `package.json` scripts; `proxy.ts` rather than `middleware.ts` and `skipProxyUrlNormalize` rather than `skipMiddlewareUrlNormalize`; no `unstable_` aliased imports from `next/cache`; and no `experimental_ppr` segment exports. If some are done and some are not, the likely story is a hand migration rather than a partial codemod run — the codemod does all five or none.

---

← [Appendix B part 1 · the React canary model](02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md) · [Chapter 19 overview](01-explanation.md) · Next → [Appendix B part 3 · the changes nothing catches](02c-appendix-b-the-changes-nothing-catches.md)
