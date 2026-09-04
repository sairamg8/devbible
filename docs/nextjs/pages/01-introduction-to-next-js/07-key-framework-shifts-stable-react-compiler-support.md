---
title: "The React Compiler and its Rust port are two different features with two different flags and two different stability levels — and the Rust port's headline speedup is conditional on Babel being gone entirely"
sidebar_label: "07 · Key framework shifts"
sidebar_position: 8
description: "The shifts to internalise before chapter 2: the React Compiler versus its experimental Rust port, async params and searchParams, the Node 20.9 floor, and the 16.3 changes that arrive without any code change."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against the [16.3 release post](https://nextjs.org/blog/next-16-3) (`publishedAt` August 3rd 2026) and the [installation docs](https://nextjs.org/docs/app/getting-started/installation) (page header `version: 16.3.4`, `lastUpdated` 2026-07-21).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**; **no benchmarks run** — every performance figure below is Vercel's, measured on their applications, and is quoted as evidence a feature is real rather than as a prediction for yours.

**This page is the set of changes that will trip you up in the next seventeen chapters if you learned React or Next.js more than a year ago. One of them is routinely written up incorrectly even in otherwise careful material — the React Compiler and its Rust port get treated as one feature, when they have different flags, different stability guarantees, and a performance claim that only holds under a condition most projects do not meet.**

## 🔴 The React Compiler is two features, and only one is stable

| | Flag | Status |
|---|---|---|
| **React Compiler** | `reactCompiler: true` | **Stable.** This is the one that retires manual `useMemo` / `useCallback` |
| **Rust port of it** | `experimental.turbopackRustReactCompiler: true` | 🔴 **Experimental.** Runs inside Turbopack instead of Babel-in-Node |

They are not alternatives to each other — the Rust flag is *additional*, and the compiler flag stays on:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,                                  // stable: the actual optimisation
  experimental: { turbopackRustReactCompiler: true },   // experimental: where it runs
}

export default nextConfig
```

**What the compiler does** is optimise components at build time so you do not hand-tune memoization. That is a change in how you write React, and it is the reason this belongs in an introduction chapter rather than a performance one.

**What the Rust port does** is change *where the compiler runs* — inside Turbopack rather than through Babel in Node — *"avoiding the extra work of generating and reparsing code."* It changes build time, not output behaviour.

### The conditional that makes the headline number honest

On v0, a large application, the Rust path cut time from `next dev` to a ready page by **34% cold and 46% warm**. Then the sentence that matters, quoted:

> These gains assume you've moved off Babel entirely. If you still run Babel for other transforms, the Rust compiler helps, but the gain is smaller.

🔴 **The flag alone does not deliver the number — the *absence of Babel* does.** If you keep Babel for any other transform, you are still paying to generate and reparse code, and the saving shrinks by an amount nobody has published. This is a clean worked example of the general rule: a performance flag's advertised figure usually encodes assumptions about the rest of your pipeline. Measure your own build before and after; do not budget against someone else's 46%.

⚠️ **Note also that `create-next-app`'s recommended defaults leave `reactCompiler` off entirely** — the prompt exists only on the customise path. See [05 · Project setup](05-project-setup-create-next-app-turbopack-defaults-typescript.md).

## Async `params` and `searchParams`

Dynamic route params and search params are **Promises** and must be awaited:

```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)
  return <h1>{post.title}</h1>
}
```

This is the single most common compile error when following older material, because every tutorial written before the change destructures `params` directly. The type is the giveaway: `Promise<{ id: string }>`, not `{ id: string }`.

**16.3 adds a way to skip the prop-drilling for params defined above the root layout.** Those are effectively global — a `[lang]` segment, for instance — and passing them down by hand through every component was the previous cost:

```tsx
import { lang } from 'next/root-params'

export default async function PostPage(props: PageProps<'/[lang]/posts/[slug]'>) {
  const { slug } = await props.params
  const language = await lang()
  return <article>{language} / {slug}</article>
}
```

Root params also work inside `use cache` scopes. They are **currently supported in Server Components only**, with route handlers and Server Actions planned for a future release — so this is not yet a universal replacement for passing params.

## The Node.js floor is 20.9

Not "20+". The patch component is load-bearing: a CI image pinned to a `20.x` older than 20.9 satisfies a naive check and fails the real requirement. TypeScript's floor is **5.1.0**, and browsers are Chrome/Edge/Firefox **111+** and Safari **16.4+** with zero configuration.

## What 16.3 gave you without any code change

Upgrading is the entire adoption for these. Figures are Vercel's:

| Change | Effect |
|---|---|
| **Dev memory** | Turbopack uses *"up to 90% less memory"* — disk caching plus memory eviction, both now default |
| **Build speed** | The disk cache now covers `next build`; up to **5.5×** faster repeat builds on CI in Vercel's projects |
| **SSR throughput** | Web streams replaced with native Node.js streams in the App Router rendering layer — *"up to 22% more requests under load"* |
| **Prefetching** | Prefetches below a size threshold are bundled together, reducing request count |
| **Static assets** | Immutable assets can be reused across deployments |

## The opt-in shifts worth knowing exist

Two flags turn on **Instant Navigations**:

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}
```

That brings Instant Insights (a devtool surfacing slow navigations), Partial Prefetching, better ISR for pages not prerendered at build time, the Navigation Inspector, and an `instant()` Playwright helper for asserting what is visible without waiting on the network.

🔴 **These behaviours are stated to become the default in a future major version.** Enabling `cacheComponents` also **removes** `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` as of v16.0.0 — the new model replaces the old controls rather than extending them. Chapters 5 and 6 cover both.

**`catchError`** gives a custom error boundary that does not interfere with `notFound` or `redirect`, and supplies a `retry()` that can re-run failed Server Components:

```tsx
'use client'
import { catchError, type ErrorInfo } from 'next/error'

function ErrorFallback(props: { title: string }, { error, retry }: ErrorInfo) {
  return <div><p>{error.message}</p><button onClick={() => retry()}>Try again</button></div>
}

export default catchError(ErrorFallback)
```

**`import.meta.glob`** — the Vite-compatible API — now works in Turbopack, bringing HMR to Server Components that read local files. **`experimental.useOffline`** keeps a navigation, fetch or Server Action pending across a network drop and retries on reconnect, with a `useOffline` hook from `next/offline` for showing the user what is happening.

## Gotchas

**★ Symptom: `reactCompiler: true` is set and the build is no faster.** Cause: conflating two features. The compiler optimises your components; the **Rust port** is what changes build speed, and it is a separate experimental flag. Fix: if build time is the goal, add `experimental.turbopackRustReactCompiler` — and read the next gotcha before budgeting on it.

**★ Symptom: the Rust React Compiler is enabled and nowhere near the advertised 34%/46% appears.** Cause: the figures *"assume you've moved off Babel entirely"*. Keeping Babel for any other transform means still generating and reparsing code, and the remaining gain is unpublished. Fix: audit for a `babel.config.js` or `.babelrc` first — removing Babel is the change that delivers the number, not the flag.

**★ Symptom: `params.id` is `undefined`, or TypeScript complains that `id` does not exist.** Cause: `params` and `searchParams` are Promises now, and every pre-change tutorial destructures them directly. Fix: `const { id } = await params`, and type it `Promise<{ id: string }>`. The type annotation is the fastest way to spot this in a diff.

**★ Symptom: CI fails on Node with a green local run.** Cause: the floor is **20.9** specifically. A CI image on an older `20.x` passes a "Node 20+" check and fails the real requirement. Fix: pin CI at or above 20.9, and treat "20+" anywhere — including older pages of this book — as imprecise.

**★ Symptom: after enabling `cacheComponents`, the build errors on `export const revalidate`.** Cause: v16.0.0 removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under Cache Components. Fix: not a bug to work around — migrate the intent to `'use cache'`. Re-enabling the old flags is fighting a deliberate replacement.

**★ Symptom: an error boundary swallows `notFound()` or `redirect()` and shows an error page.** Cause: ordinary React error boundaries interfere with both, since those are implemented as thrown control flow. Fix: `catchError` from `next/error` is built not to, and gives you `retry()` to re-run failed Server Components — which a plain boundary cannot do, as it can only reset client state.

**Symptom: root params are imported into a Route Handler and do not work.** Cause: they are currently supported in **Server Components** only; route handlers and Server Actions are planned for a future release. Fix: keep passing those explicitly for now, and write the limitation down — it is the kind of thing that reads as a bug six months later.

**Symptom: a colleague's dev server uses far more memory on the same app.** Cause: 16.3 turned on Turbopack disk caching and memory eviction by default, reported at up to 90% less. Fix: check whether they are on an older minor or opting out with `--webpack`.

**Symptom: performance work is planned against numbers from a release blog.** Cause: those figures are Vercel's, measured on Vercel's applications — vercel.com, nextjs.org, v0 — under their build and traffic shapes. Fix: treat them as evidence the feature is real and measure your own. This page quotes them for exactly that reason and no other.

## Interview questions

**★ Explain the difference between the React Compiler and the Rust React Compiler.**
They are two features, not two names for one. `reactCompiler: true` is stable and optimises components at build time so you stop hand-writing `useMemo` and `useCallback` — it changes how you write React. `experimental.turbopackRustReactCompiler` is experimental and changes *where that compiler runs*: inside Turbopack rather than through Babel in Node, avoiding the work of generating and reparsing code. It affects build time, not output behaviour, and it is additive — you keep `reactCompiler: true` and add it. Treating them as one feature is the most common error in write-ups of this.

**★ The Rust React Compiler is advertised at 34% cold and 46% warm. What is missing from that claim?**
The condition attached to it: those gains assume you have moved off Babel entirely. If Babel still runs for any other transform, you are still paying to generate and reparse code, and the documented statement is only that the gain is *smaller* — no number is given. So the flag alone does not deliver the figure; removing Babel does. It is a good general lesson: a performance flag's headline number usually encodes assumptions about the rest of the pipeline, and those assumptions are where your project differs.

**★ Why does `params.id` come back undefined in code copied from a tutorial?**
Because `params` and `searchParams` are Promises and must be awaited — `const { id } = await params`, typed `Promise<{ id: string }>`. Every tutorial written before that change destructures directly, and there are years of them still indexed. In 16.3 there is also a related improvement worth knowing: root params defined above the root layout, like a `[lang]` segment, can be read from any Server Component via `next/root-params` instead of prop-drilled — though only in Server Components so far, with route handlers and Server Actions planned.

**Why is "Node 20+" not a safe way to state the requirement?**
Because the floor is 20.9, and the patch component is load-bearing. A CI image pinned to an earlier `20.x` satisfies "Node 20+" by any naive check and still fails the real requirement, producing a CI failure after a green local run. It is worth pinning CI explicitly at or above 20.9 and treating the loose phrasing as imprecise wherever it appears — including in older pages of this book.

**What did 16.3 give you for free, and how should you treat the numbers?**
Several things needing no code change: Turbopack using up to 90% less dev memory via disk caching and memory eviction, the disk cache extending to `next build` with up to 5.5× faster repeat CI builds, and native Node.js streams replacing web streams in App Router rendering for up to 22% more requests under load. All of those figures are Vercel's, measured on their own applications. They are good evidence the features are real and useless as predictions for your app — the honest use is to measure your own before and after.

**What does enabling `cacheComponents` cost you, and why is that not a bug?**
It removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` as of v16.0.0, so a build with those exported will error. That is deliberate: those are the previous implicit-caching model's controls, and `'use cache'` replaces rather than extends them. The right response is migrating the intent, not looking for a way to keep both. It also fits the framework's stated direction — dynamic by default, with no hidden or implicit caching — and these behaviours are said to become the default in a future major, so the migration is a question of when.

**What problem does `catchError` solve that a React error boundary does not?**
Two. Ordinary error boundaries in Next.js interfered with `notFound()` and `redirect()`, because those are implemented as thrown control flow and a boundary catches them as errors — so a boundary meant for real failures would swallow an intended redirect. And a plain boundary can only reset client state, giving no way to retry a Server Component that failed during rendering. `catchError` from `next/error` avoids the first and supplies a `retry()` for the second, which can refetch the boundary's children including re-rendering Server Components.

---

← Prev [06 · Hello World with the app directory](06-hello-world-with-the-app-directory.md) · [Index](01-explanation.md) · Next → [Chapter 2 · Routing and navigation](../02-routing-and-navigation/01-explanation.md)
