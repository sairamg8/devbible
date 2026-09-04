---
title: "dynamicParams decides what happens to the values generateStaticParams did not return, it disappears entirely under Cache Components, and its 404 is not a 404 when a catch-all is in play"
sidebar_label: "03g · dynamicParams and precedence"
sidebar_position: 18
description: "The two values of dynamicParams and what each does, why it is unavailable with Cache Components, the catch-all caveat in the 404 behaviour, and what the documentation does and does not say about a static segment competing with a dynamic one."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`dynamicParams`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/dynamicParams) (`lastUpdated: 2026-03-13`), [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated: 2026-08-25`), [Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) (`lastUpdated: 2025-06-16`) and [API Routes (Pages Router)](https://nextjs.org/docs/pages/building-your-application/routing/api-routes).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**. Continues [03d · generateStaticParams](03d-generatestaticparams-strategies.md).

**`generateStaticParams` answers "which values do we prerender". `dynamicParams` answers the harder question: "and what about the rest of the internet". Two values, one line of config, and it turns a route from an open set that grows on demand into a closed allowlist that 404s everything else. Three things about it are routinely missed — it is `true` by default, so most apps are running an open set without having decided to; it is **not available at all** under Cache Components; and its 404 behaviour has an explicit exception for catch-all routes that the one-line summary does not mention.**

## The two values

> *"The `dynamicParams` option allows you to control what happens when a dynamic segment is visited that was not generated with `generateStaticParams`."*

```tsx title="layout.tsx | page.tsx"
export const dynamicParams = true // true | false
```

> *"**`true`** (default): Dynamic route segments not included in `generateStaticParams` are generated at request time."*
>
> *"**`false`**: Dynamic route segments not included in `generateStaticParams` will return a 404."*

| | `dynamicParams = true` (default) | `dynamicParams = false` |
|---|---|---|
| Unlisted path | rendered at request time, then served | 404 |
| Route is | an open set | a closed allowlist |
| New content after a build | appears without a rebuild | needs a rebuild |
| Bad-input surface | anything a user types reaches your data layer | only your enumerated values do |

That last row is the underrated one. With the default, `/blog/<anything>` executes your page against an attacker-supplied slug; whether that matters depends entirely on what your loader does with it.

And two migration facts:

> *"This option replaces the `fallback: true | false | blocking` option of `getStaticPaths` in the `pages` directory."*
>
> *"`dynamicParams` is not available when Cache Components is enabled."*

🔴 **Read the second one twice.** If your project has Cache Components on, `export const dynamicParams = false` is not a way to close the set, and advice that reaches for it does not apply to you. Closing the set under Cache Components means validating the param in the page and calling `notFound()` yourself.

```tsx title="app/blog/[slug]/page.tsx"
import { notFound } from 'next/navigation'

const PUBLISHED = new Set(['hello-world', 'getting-started'])

export async function generateStaticParams() {
  return [...PUBLISHED].map((slug) => ({ slug }))
}

export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  if (!PUBLISHED.has(slug)) notFound()
  return <Post slug={slug} />
}
```

## The catch-all exception in the 404

The `generateStaticParams` reference states the closed-set behaviour with a parenthetical that changes it:

> *"To prevent unspecified paths from being prerendered at runtime, add the `export const dynamicParams = false` option in a route segment. When this config option is used, only paths provided by `generateStaticParams` will be served, and unspecified routes will 404 **or match (in the case of catch-all routes)**."*

So on `app/docs/[[...slug]]/page.tsx` with `dynamicParams = false`, an unlisted path does not necessarily disappear — a catch-all is still a matching route, and the request can land on it. If you rely on `dynamicParams = false` as an allowlist and the segment is a catch-all, verify the actual behaviour on your own routes rather than assuming the 404. ⚠️ The documentation states the exception but does not elaborate on it; I could not find a page that spells out precisely which route then serves the request, so treat the parenthetical as a warning to test rather than a specification.

## Where `dynamicParams` goes

It is a route segment config export, so it lives beside the component in `layout.tsx`, `page.tsx` or `route.js` and applies to that segment. The commonest real use is the "top N prerendered, nothing else exists" shape:

```tsx title="app/blog/[slug]/page.tsx"
// All posts besides the top 10 will be a 404
export const dynamicParams = false

export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((res) => res.json())
  const topPosts = posts.slice(0, 10)

  return topPosts.map((post: { slug: string }) => ({
    slug: post.slug,
  }))
}
```

Note how badly that combination reads if you skim: a *subset* returned from `generateStaticParams` normally means "prerender these, render the rest on demand". Adding `dynamicParams = false` silently converts the same code into "these ten posts are the entire blog".

## Route-matching precedence — what the docs actually say

The situation: `app/post/create/page.tsx` and `app/post/[pid]/page.tsx` both exist, and a request arrives for `/post/create`. Which wins?

🔴 **The App Router documentation does not state a precedence rule.** I could not find it in the Dynamic Route Segments reference, the Route Groups reference, the layouts-and-pages guide, or the routing adapter reference. What the docs *do* state, in the **Pages Router** API Routes documentation, is:

> *"Predefined API routes take precedence over dynamic API routes, and dynamic API routes over catch all API routes. Take a look at the following examples:"*
>
> *"`pages/api/post/create.js` - Will match `/api/post/create`"*
> *"`pages/api/post/[pid].js` - Will match `/api/post/1`, `/api/post/abc`, etc. But not `/api/post/create`"*
> *"`pages/api/post/[...slug].js` - Will match `/api/post/1/2`, `/api/post/a/b/c`, etc. But not `/api/post/create`, `/api/post/abc`"*

That is **static → dynamic → catch-all**, most specific first, and it is the behaviour every file-system router in this family implements. It is stated for Pages Router API routes and nowhere restated for the App Router. Treat it as the strong expectation and **not** as a documented guarantee for `app/`: if a route's correctness depends on it, encode the intent explicitly rather than relying on the ordering.

The App Router *does* document one conflict as an outright error, and it is the neighbouring case:

> *"**Conflicting paths**: Routes in different groups should not resolve to the same URL path. For example, `(marketing)/about/page.js` and `(shop)/about/page.js` would both resolve to `/about` and cause an error."*

Two route groups colliding on one URL is an error, not a precedence question. That is worth knowing precisely because route groups are invisible in the URL, so the collision is invisible in the folder tree too.

### Writing it so precedence does not matter

The robust shape is to make the literal path a real sibling folder — which is both the clearest intent and what the ordering would give you anyway — and to reject reserved values inside the dynamic segment so the two can never disagree:

```tsx title="app/post/[pid]/page.tsx"
import { notFound } from 'next/navigation'

const RESERVED = new Set(['create', 'draft', 'search'])

export default async function Page(props: PageProps<'/post/[pid]'>) {
  const { pid } = await props.params
  if (RESERVED.has(pid)) notFound()
  return <Post id={pid} />
}
```

```text
app/post/create/page.tsx     ← the literal route
app/post/[pid]/page.tsx      ← everything else, with 'create' explicitly excluded
```

If the dynamic page ever *does* receive `create`, you now get a 404 instead of a wrong page, and the guard documents the coupling for the next reader.

## Gotchas

**★ Symptom: a URL that should not exist renders a page built from garbage input.** Cause: `dynamicParams` defaults to `true`, so any value at all is rendered on demand — most teams have never made this decision, they inherited it. Fix: either close the set with `dynamicParams = false`, or validate inside the page and call `notFound()`. The second works under Cache Components; the first does not.

```tsx
import { notFound } from 'next/navigation'

export default async function Page(props: PageProps<'/product/[id]'>) {
  const { id } = await props.params
  if (!/^[0-9]+$/.test(id)) notFound()
  return <Product id={Number(id)} />
}
```

**★ Symptom: `export const dynamicParams = false` has no effect after enabling Cache Components.** Cause: *"`dynamicParams` is not available when Cache Components is enabled."* Fix: move the allowlist into the page and enforce it with `notFound()`.

```tsx
const PUBLISHED = new Set(['hello-world', 'getting-started'])

export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  if (!PUBLISHED.has(slug)) notFound()
  return <Post slug={slug} />
}
```

**★ Symptom: `dynamicParams = false` on a catch-all route does not 404 the way you expected.** Cause: the documented behaviour has an exception — unspecified routes *"will 404 or match (in the case of catch-all routes)"*. Fix: do not rely on the config for allowlisting a catch-all; validate the joined path in the page.

```tsx title="app/docs/[[...slug]]/page.tsx"
import { notFound } from 'next/navigation'

const PAGES = new Set(['index', 'routing/dynamic', 'routing/groups'])

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const { slug } = await props.params
  const path = slug?.join('/') ?? 'index'
  if (!PAGES.has(path)) notFound()
  return <Doc path={path} />
}
```

**★ Symptom: the blog silently stops accepting new posts after a config change nobody flagged in review.** Cause: `dynamicParams = false` combined with a `slice(0, 10)` in `generateStaticParams` — individually both look reasonable, together they make ten posts the entire site. Fix: if the intent is "prerender the hot ten, serve the rest on demand", the config must stay at its default; put a comment next to whichever line encodes the real intent.

```tsx
// Intent: prerender the ten most-read posts; the long tail renders on first visit.
export const dynamicParams = true
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts?sort=views').then((r) => r.json())
  return posts.slice(0, 10).map((p: { slug: string }) => ({ slug: p.slug }))
}
```

**★ Symptom: `/post/create` renders the dynamic post page with `pid === 'create'`.** Cause: whatever the ordering, your dynamic segment accepted a value that means something else in your URL space. Fix: keep the literal folder *and* reject the reserved value in the dynamic page, so a mistake produces a 404 rather than a plausible-looking wrong page.

```tsx title="app/post/[pid]/page.tsx"
const RESERVED = new Set(['create', 'draft', 'search'])

export default async function Page(props: PageProps<'/post/[pid]'>) {
  const { pid } = await props.params
  if (RESERVED.has(pid)) notFound()
  return <Post id={pid} />
}
```

**★ Symptom: a build fails with a routing conflict and the two files are in folders whose names are not in the URL.** Cause: route groups are stripped from the path, so `(marketing)/about/page.js` and `(shop)/about/page.js` both resolve to `/about` — *"and cause an error"*. Fix: one owner per resolved path. Move the loser under a distinct segment; the group name cannot disambiguate it, because it does not exist in the URL.

**★ Symptom: you rely on "static beats dynamic" and a reviewer asks for the doc link.** Cause: the rule is stated for Pages Router API routes and not restated for the App Router, so there is no App Router citation to give. Fix: do not argue from precedence at all — write the guard, which is correct under any ordering and readable without knowing the rule.

**★ Symptom: an unlisted path returns a 404 in production but rendered fine in `next dev`.** Cause: `generateStaticParams` is called on navigation in dev, so a path you visited was enumerated for that session; with `dynamicParams = false` the production build only serves what the build-time enumeration returned. Fix: verify closed-set behaviour against a real build, never against the dev server.

## Interview questions

**★ What does `dynamicParams` control, and what is its default?**
It controls what happens when a dynamic segment is visited with a value that `generateStaticParams` did not return. At the default `true`, the path is generated at request time; at `false`, it returns a 404. The default matters more than the option: most applications are serving an open set of URLs — every value a user can type reaches the page — without anyone having chosen that.

**★ You want a route to serve exactly ten posts and nothing else. How do you do it, and what changes under Cache Components?**
Without Cache Components: return the ten from `generateStaticParams` and set `export const dynamicParams = false`. With Cache Components: that config is unavailable — *"`dynamicParams` is not available when Cache Components is enabled"* — so you enforce the allowlist inside the page, comparing the awaited param against your set and calling `notFound()` on a miss. The second approach works in both worlds, which is an argument for reaching for it by default.

**★ Is `dynamicParams = false` a reliable allowlist on a catch-all route?**
No, and the documentation says so in a parenthetical that is easy to miss: unspecified routes *"will 404 or match (in the case of catch-all routes)"*. A catch-all is a matching route by construction, so the request can still land somewhere. If you need an allowlist on a catch-all, join the segments and check them in the page.

**★ `app/post/create/page.tsx` and `app/post/[pid]/page.tsx` both exist. Which serves `/post/create`?**
The expected answer is the static one — most specific first, static before dynamic before catch-all — and that is exactly what the Pages Router API-routes documentation states: *"Predefined API routes take precedence over dynamic API routes, and dynamic API routes over catch all API routes."* The honest addition is that the App Router reference does not restate it, so I would not build a security or correctness property on it. I would write the literal folder anyway, and reject `create` inside the dynamic page, so the behaviour is the same under any ordering.

**★ How is a route-group collision different from a precedence question?**
It is not a competition the router resolves, it is an error. Two groups that resolve to the same URL — `(marketing)/about` and `(shop)/about` — cause a build error, because the group name is stripped and there is nothing left to distinguish them. Precedence only applies where the paths genuinely differ in specificity.

**★ What did `dynamicParams` replace, and where does the analogy break?**
It replaced `getStaticPaths`'s `fallback: true | false | blocking` from the Pages Router — the reference says so explicitly. The analogy breaks because `fallback` had three values encoding both "does an unlisted path work" and "does the user see a loading state while it is generated", whereas `dynamicParams` is a boolean answering only the first. The second question is answered by the rendering model — Suspense boundaries and the static shell — rather than by this config.

**★ A closed-set route behaves differently in `next dev` than in production. What is the most likely cause?**
`generateStaticParams` is called on navigation during `next dev`, so whatever you visited became part of the enumerated set for that session. A production build enumerates once, up front, and with `dynamicParams = false` serves nothing else. Any conclusion about closed-set behaviour has to be drawn from a build, not from the dev server.

---

← [03f · Nested dynamic segments](03f-nested-dynamic-segments-and-route-handlers.md) · [Chapter 2 overview](01-explanation.md) · Next → [04 · Navigation mechanics](04-navigation-mechanics-link-userouter-redirect-notfound.md)
