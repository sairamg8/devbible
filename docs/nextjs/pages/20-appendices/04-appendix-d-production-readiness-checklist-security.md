---
title: "Appendix D · part 1 — the official production checklist is six months behind the release it is stamped with, and here is the corrected rendering and caching half"
sidebar_label: "10 · Appendix D — what the official checklist gets wrong"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to optimize your Next.js application for production](https://nextjs.org/docs/app/guides/production-checklist) — 🔴 fetched as Markdown, frontmatter `version: 16.3.4` but **`lastUpdated: 2026-03-10`** — cross-checked against [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`), the [Next.js Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated: 2026-08-25`) and the [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**. Documentation-verified; **no sandbox run, no timings**.

**Vercel publishes a production checklist and it is the natural thing to hand a team before a launch. Do not hand them the current one unannotated. Fetched as Markdown on 2026-09-04 it reports `version: 16.3.4` in its frontmatter and `lastUpdated: 2026-03-10` in the same block — and the body matches the second date, not the first. It still describes Partial Prerendering as experimental, still sends you to a linting setup that 16 removed, and still links a bundle analyzer section anchored `for-webpack` in a release where Turbopack is the default bundler. Everything it says about *security* has aged perfectly; almost everything it says about *tooling* has not. This appendix is that checklist, corrected, with each correction traced to the document that supersedes it.**

## 🔴 The six places it is out of date

Each row is the checklist's own text against the 16 upgrade guide or the CLI reference.

| The checklist says | What is true at 16.3 | Source that supersedes it |
|---|---|---|
| *"Partial Prerendering (experimental) will allow parts of a route to be dynamic without opting the whole route into dynamic rendering"* — linking a Next.js **14** blog post | PPR is not experimental. The flag and the `experimental_ppr` segment config were **removed** in 16; PPR is the default behaviour under `cacheComponents` | [upgrade guide, PPR section](https://nextjs.org/docs/app/guides/upgrading/version-16) |
| *"Ensure requests that don't use `fetch` are cached"*, linking `unstable_cache` | The 16-era model is the `"use cache"` directive with `cacheLife` and `cacheTag`, both of which **lost their `unstable_` prefix** in 16 | upgrade guide, Caching APIs |
| *"Use the built-in `eslint-plugin-jsx-a11y` plugin to catch accessibility issues early"* | `next lint` was **removed** and *"`next build` no longer runs linting"* — nothing is built-in any more; you wire ESLint or Biome yourself, and the Next plugin now defaults to **flat config** | upgrade guide, Removals |
| *"Use the `@next/bundle-analyzer` plugin"*, anchored `package-bundling#nextbundle-analyzer-**for-webpack**` | Turbopack is the default bundler, and `next experimental-analyze` shipped in **16.1** as a first-party Turbopack-native analyzer | [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next) |
| silent on build metrics | 16.0 **removed** `size` and `First Load JS` from `next build` output as *"inaccurate in server-driven architectures using React Server Components"* | upgrade guide, Performance Improvements |
| silent on `proxy` | `middleware` is deprecated in favour of `proxy`, which is **Node.js runtime only and cannot be configured** | upgrade guide, `middleware` to `proxy` |

⚠️ **One correction this page deliberately does not make.** The checklist links `unstable_cache`, and the 16 upgrade guide **does not say `unstable_cache` was removed**. What it says is that `cacheLife` and `cacheTag` are stable now and that the caching model is `"use cache"`. So the honest statement is that the checklist's advice is *dated*, not that the API it names is gone — and this page says the former rather than inventing the latter.

### The lesson underneath the table

🔴 **A docs page's `version:` field is the docs build and is stamped identically on every page. Its `lastUpdated:` is the only freshness signal.** This one page is the proof, and it is why [Appendix C part 1](03-appendix-c-tooling.md) makes a point of the Markdown fetch form: `.md` on the URL, or `Accept: text/markdown`, returns the frontmatter that tells you which of the two numbers you are reading.

```bash
curl -sL https://nextjs.org/docs/app/guides/production-checklist.md | head -8
```

## What it gets right, and what that costs you nothing to keep

The **Automatic optimizations** section has not drifted at all, because it describes defaults rather than APIs:

> * *"**Server Components**: Next.js uses Server Components by default… they have no impact on the size of your client-side JavaScript bundles."*
> * *"**Code-splitting**: Server Components enable automatic code-splitting by route segments."*
> * *"**Prefetching**: When a link to a new route enters the user's viewport, Next.js prefetches the route in background."*
> * *"**Prerendering**: Next.js prerenders Server and Client Components on the server at build time and caches the rendered result."*
> * *"**Caching**: Next.js caches data requests, the rendered result of Server and Client Components, static assets, and more."*

Read the list for what it implies rather than what it says: **every one of these is something you can accidentally switch off.** A `"use client"` boundary too high defeats the first two. `prefetch={false}` defeats the third. A `cookies()` read in the root layout defeats the fourth for the entire application. The value of the section is as a list of things to check you have not lost, not a list of things to enable.

## Corrected · Routing and rendering

| Check | Status at 16.3 |
|---|---|
| Use `layout.js` to share UI and enable partial rendering on navigation | unchanged |
| Use `<Link>` for client-side navigation and prefetching | unchanged |
| Custom `error.js`, `not-found.js`, and `app/global-error.tsx` | unchanged |
| Check `"use client"` boundary placement to avoid inflating the client bundle | unchanged |
| Request-time APIs opt the route into dynamic rendering | unchanged, and still the highest-value item on the page |
| 🔴 "PPR is experimental" | **wrong** — enable `cacheComponents` and PPR is the default |
| 🔴 missing | every parallel-route slot needs `default.js` or the **build fails** |
| 🔴 missing | if you renamed `middleware` to `proxy`, confirm nothing relied on the edge runtime |

The Request-time API warning is quoted here in full because it is the single sentence on the official page most worth acting on:

> *"Be aware that Request-time APIs like `cookies` and the `searchParams` prop will opt the entire route into Dynamic Rendering (or your whole application if used in the Root Layout). Ensure Request-time API usage is intentional and wrap them in `<Suspense>` boundaries where appropriate."*

```tsx
// BAD — one cookie read in the root layout makes the entire app dynamic.
export default async function RootLayout({ children }) {
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return <html data-theme={theme}><body>{children}</body></html>
}
```

```tsx
// GOOD — the read moves down, below a boundary, and the shell still prerenders.
import { Suspense } from 'react'
import { cookies } from 'next/headers'

async function ThemedBody({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return <div data-theme={theme}>{children}</div>
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<div data-theme="light">{children}</div>}>
          <ThemedBody>{children}</ThemedBody>
        </Suspense>
      </body>
    </html>
  )
}
```

## Corrected · Data fetching and caching

The checklist's items, three of which stand and two of which need replacing:

**Stands, verbatim, and is the most-ignored line on the page:**

> *"**Route Handlers**: Use Route Handlers to access your backend resources from Client Components. But do not call Route Handlers from Server Components to avoid an additional server request."*

**Stands:** use Server Components for data fetching; use `loading.js` and `<Suspense>` to stream; fetch in parallel to avoid waterfalls; keep static assets in `public`.

🔴 **Needs replacing:** *"Verify whether your data requests are being cached or not"* is right, but the mechanism it points at is dated. Under Cache Components the question is not "is this cached" — nothing is, by default — but "have I marked what should be":

```ts
// app/lib/catalog.ts
import { cacheLife, cacheTag } from 'next/cache' // no unstable_ prefix in 16

export async function getCategories() {
  'use cache'
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 })
  cacheTag('categories')
  const res = await fetch('https://api.example.com/categories')
  return res.json()
}
```

🔴 **Missing entirely:** `revalidateTag` now takes a second argument, and there is a second invalidation API with different semantics. The production-readiness question is *which* you want:

```ts
'use server'
import { revalidateTag, updateTag } from 'next/cache'

// Background content, everyone else's data — stale-while-revalidate is fine.
export async function publishArticle(id: string) {
  await db.articles.publish(id)
  revalidateTag('articles', 'max')
}

// The user's own change — they must see it immediately.
export async function renameProject(id: string, name: string) {
  await db.projects.update(id, { name })
  updateTag(`project-${id}`)
}
```

🔴 **Also missing:** the `stale` floors. Content with `stale` under 30 seconds is excluded from prerenders entirely, and content under 5 minutes never enters the App Shell. A launch checklist that does not mention these ships apps whose prefetching silently does nothing — see [Appendix A part 1](01-appendix-a-glossary-ppr.md).

## Gotchas

**★ Symptom: you follow the official checklist and configure `experimental.ppr`, and the build rejects the key.** Cause: the checklist's PPR note predates 16 and links a Next.js 14 blog post; the flag was removed. Fix: `cacheComponents: true`, and expect the model change rather than a rename — it can fail builds on routes that previously passed.

**★ Symptom: the checklist told you accessibility linting was built in, and no a11y rule has ever fired.** Cause: `next lint` was removed and `next build` no longer lints, so a project that never added an explicit lint step has had none since the upgrade. Fix: add ESLint with flat config, or Biome, as an explicit CI step. This is covered in [part 3](04c-appendix-d-metadata-a11y-and-the-measurements.md).

**★ Symptom: a launch review passes on "requests are cached" and the app is dynamic everywhere.** Cause: the check was written for a model where `fetch` was cached by default. Under Cache Components nothing is cached until you mark it, so "is it cached" reads as a yes/no when it is really "did anyone opt in". Fix: invert the review question — walk the routes and ask which reads carry `"use cache"`, not whether caching is on.

**★ Symptom: prefetching appears to do nothing despite `<Link>` everywhere.** Cause: your cached content's `stale` is under the floors — under 30 seconds it is excluded from prerenders, under 5 minutes it never joins the App Shell. Fix: raise `stale` above the floor and get freshness from `updateTag` at the mutation instead of from a short TTL.

**★ Symptom: one `cookies()` call and the whole application went dynamic.** Cause: it was in the root layout, which the checklist itself warns opts in *"your whole application"*. Fix: push the read into the smallest component that needs it, inside `<Suspense>`, exactly as shown above. This is the highest-value single item on the official page and the one people skim.

**★ Symptom: a Server Component calls your own `/api/...` route "to keep data access in one place".** Cause: treating the Route Handler as a shared data layer. It is an HTTP endpoint; the Server Component is already on the server, so this buys a network round trip for nothing. Fix: extract a plain module and import it from both.

```ts
// app/lib/orders.ts — shared by the Server Component and the Route Handler.
export async function listOrders(userId: string) {
  return db.orders.findMany({ where: { userId } })
}
```

**★ Symptom: `revalidateTag('posts')` no longer compiles, and the checklist does not mention it.** Cause: 16 requires a second argument naming a `cacheLife` profile. Fix: supply one — and use the enforced walk past every call site to decide which of them should actually be `updateTag`.

**★ Symptom: a build fails on a parallel route and no checklist item predicted it.** Cause: the requirement for a `default.js` per slot arrived in 16, after this page was last reviewed. Fix: add one per slot, choosing `null` or `notFound()` deliberately.

**★ Symptom: you quote a docs page as authoritative because it carries the current version number.** Cause: `version:` is the build; `lastUpdated:` is the review. Fix: fetch with `.md` and read the second. This entire page exists because that distinction was worth six months.

## Interview questions

**★ You are handed the official Next.js production checklist before a launch. What do you do with it?**
Use it, and annotate it first. Fetched as Markdown it reports `version: 16.3.4` and `lastUpdated: 2026-03-10`, and the body follows the second date — so its security, data-fetching and metadata advice is sound while its tooling advice describes a release that no longer exists. Concretely: it calls PPR experimental when the flag was removed and PPR is now the default under `cacheComponents`; it tells you accessibility linting is built in when `next lint` was removed and `next build` no longer lints; and it points at a bundle analyzer section anchored for webpack when Turbopack is the default and `next experimental-analyze` shipped in 16.1.

**★ How do you tell whether any documentation page is current?**
Read its own `lastUpdated:`, not its `version:`. The version field is the documentation build number and is identical across every page in the set, so it tells you when the site was deployed and nothing about when the page was reviewed. Appending `.md` to any nextjs.org/docs URL, or sending `Accept: text/markdown`, returns the frontmatter with both. It is a thirty-second check that would have prevented every stale-advice incident I have seen with these docs.

**★ The checklist says to verify your data requests are being cached. Why is that the wrong question at 16.3?**
Because it was written for a model where `fetch` was cached by default and the risk was accidental caching. Under Cache Components the default inverted: data fetching is dynamic, and caching happens only where someone wrote `"use cache"`. So "is it cached" invites a yes/no about a global setting that no longer exists. The useful review question is per-read — which of these reads is marked cacheable, with what `cacheLife`, under what tag, and invalidated by what — and the second half of that question is the one teams have never had to answer before.

**★ Which single item on the official checklist would you enforce hardest, and why?**
The warning that Request-time APIs opt the entire route into dynamic rendering, and the whole application if used in the root layout. It is the only item where one line of code, written casually, silently removes the framework's central performance property from every page at once. Nothing fails, nothing warns, and the cost shows up later as a server bill and a slow site. Every other item on the page is recoverable locally; this one is architectural.

**★ Why is calling a Route Handler from a Server Component wrong, given both are your code?**
Because the Server Component is already running on the server with full access to your database and secrets, so routing through an HTTP endpoint adds a network hop, a serialization round trip and a second set of failure modes to reach code that was one import away. The checklist states it plainly. The legitimate use of a Route Handler is the one it names — giving *Client* Components a way to reach backend resources — and the right shape for shared logic is a plain module both import.

**★ `revalidateTag` and `updateTag` in a launch review: what are you actually checking?**
Whose data it is. `revalidateTag`, which now requires a `cacheLife` profile as its second argument, marks data stale and serves the stale copy while it refreshes — correct for content other people will see later. `updateTag` is Server-Actions-only and gives read-your-writes within the same request — correct when the person who triggered the mutation is about to look at the result. Getting this backwards produces the worst kind of bug report: "I saved it and it didn't save", from a user who is looking at a perfectly healthy cache.

---

← [Appendix C part 3 · the CLI surface](03c-appendix-c-the-cli-surface.md) · [Chapter 19 overview](01-explanation.md) · Next → [Appendix D part 2 · security](04b-appendix-d-security.md)
