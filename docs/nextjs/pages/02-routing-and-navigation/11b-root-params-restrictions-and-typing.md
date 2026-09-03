---
sidebar_position: 12
title: "Root param getters are Server-Component-only by design, and the four places they refuse to run each need a different workaround"
sidebar_label: "11b · Root params: restrictions and typing"
description: "Why root params throw in Client Components, Server Actions and unstable_cache, why Route Handler support is the one restriction that is temporary, and how the return types change under multiple root layouts and catch-all segments."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params), [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) and the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4** · continues [11 · Root params](11-root-params.md).

**The getters in `next/root-params` look like ordinary imports, which makes their refusal to run in four specific places feel arbitrary. It is not. Three of the four are permanent consequences of what a root param *is* — a value that only exists inside a Server Component render of a route beneath that root layout — and the docs say so. The fourth, Route Handlers, is the only one described as temporary. On top of that, the return types are not always `string`: multiple root layouts and catch-all segments both widen them, and the widening is silent unless you have generated the types.**

## The four restrictions

🔴 **Most of these are permanent constraints** of how root parameters work, not a roadmap.
The single exception is Route Handlers, which are unsupported today but planned for a future
release.

### Server Components only

```tsx
// This will cause a build error
'use client'

import { lang } from 'next/root-params' // Error: Cannot import in Client Component
```

This is a *build* error, not a runtime one, which is why the docs say you never need `import 'server-only'` in a file that uses the module — the import already fails at build time if a Client Component reaches it.

**Workaround.** Read the value in a Server Component and pass it down as a prop. That is prop-drilling again, but only across the one boundary where it is unavoidable: nothing about the client render knows which route it came from.

### Not available in Server Actions

```tsx
import { lang } from 'next/root-params'

async function submitForm() {
  'use server'
  const language = await lang() // Error: Not supported in Server Actions
}
```

**Workaround.** Bind the value at the call site, in the Server Component that *can* read it:

```tsx title="app/[lang]/settings/form.tsx"
import { lang } from 'next/root-params'
import { saveSettings } from './actions'

export default async function SettingsForm() {
  const language = await lang()
  const action = saveSettings.bind(null, language)

  return (
    <form action={action}>
      {/* fields */}
    </form>
  )
}
```

A Server Action is invoked by a POST from the client, not by rendering a route, so there is no root-layout render in scope for a getter to read from. Binding the argument makes the dependency explicit — which is also what you want for a mutation whose behaviour depends on locale.

### Not available in `unstable_cache`

```tsx
import { lang } from 'next/root-params'
import { unstable_cache } from 'next/cache'

const getCachedData = unstable_cache(async () => {
  const language = await lang() // Error: Not supported inside unstable_cache
  return fetch(`https://api.example.com/data?lang=${language}`)
})
```

This one throws at **runtime**, not at build time, so it survives a green build and fails in production if the path is not exercised in development. The documented fix is not a workaround at all — it is the replacement API:

the documented alternative is `"use cache"`.

`'use cache'` is the directive that can see which root params a cached function reads and fold only those into its key. `unstable_cache` predates that machinery and has no way to express the dependency.

### Not supported in Route Handlers — yet

`next/root-params` works in **Server Components**. It does not work in Client Components,
Server Actions or Route Handlers — and only the last of those three is planned to change.

**Workaround.** A Route Handler already receives every dynamic segment in *its own* path through the route context. If the handler lives under the root segment — `app/[lang]/api/posts/route.ts` — then `lang` is simply one of its params:

```ts title="app/[lang]/api/posts/route.ts"
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/[lang]/api/posts'>
) {
  const { lang } = await ctx.params
  return Response.json(await getPosts(lang))
}
```

The docs describe `context.params` as *"a promise that resolves to an object containing the dynamic route parameters for the current route"*, so this is ordinary documented behaviour rather than a trick. The catch is that a handler at `app/api/posts/route.ts` — outside the `[lang]` segment — has no locale in its path and no getter to fall back on; it has to take one from the query string, a header, or a cookie.

## The return types are not all `string`

| Segment type | Example | Return type |
| --- | --- | --- |
| Dynamic | `[id]` | `string` |
| Catch-all | `[...path]` | `string[]` |
| Optional catch-all | `[[...path]]` | `string[] \| undefined` |

Catch-all root segments work, and the array shape is the thing to remember:

```tsx title="app/docs/[...path]/layout.tsx"
import { path } from 'next/root-params'

export default async function DocsLayout(
  props: LayoutProps<'/docs/[...path]'>
) {
  const segments = await path() // string[] | undefined
  return (
    <div>
      <nav>Path: {segments?.join(' / ')}</nav>
      {props.children}
    </div>
  )
}
```

## Multiple root layouts widen every type

Where an application has **multiple root layouts with different parameters**, the getters are
typed for use across every possible route. A parameter that does not exist in *every* root
layout is therefore typed `string | undefined` — the type is telling you the truth about a
route you may not have had in mind.

Given `app/dashboard/[id]/layout.tsx` (a root layout with `id`) and `app/marketing/layout.tsx` (a root layout without it):

```tsx title="app/dashboard/[id]/page.tsx"
import { id } from 'next/root-params'

export default async function DashboardPage() {
  const dashboardId = await id() // string | undefined
  return <div>Dashboard: {dashboardId}</div>
}
```

`await id()` returns `undefined` when called from a marketing route. Note what this means for a shared utility: a helper called from both trees cannot assume the value exists, and TypeScript will tell you so — but only once the types have been generated.

## Gotchas

**★ Three of the four restrictions are permanent; only Route Handlers are described as temporary.**
The docs frame it explicitly: *"Most of these are permanent constraints of how root parameters work. The exception is Route Handlers."* So there is no point architecting around a future release for Client Components, Server Actions or `unstable_cache` — those need the workarounds above, indefinitely.

**★ The `unstable_cache` failure is a runtime error, so a green build proves nothing.**
Unlike the Client Component case, which fails at build time, a root param getter inside `unstable_cache` throws when the code path runs. A rarely-exercised handler can ship this. Migrate the function to `'use cache'`, which is the documented replacement and the only caching primitive that can track which root params the function reads.

**★ A Server Action cannot read the locale, and the fix is to bind it, not to re-read it from headers.**
Actions are invoked by a POST, not by rendering a route, so no root-layout render is in scope. Bind the value from the Server Component that renders the form — `action.bind(null, language)` — which also makes the locale dependency visible in the action's signature. Reaching for a `Referer` header instead is guesswork about the client's URL.

**★ A Route Handler *outside* the root segment has no path to the locale at all.**
The route-context workaround only works because the handler's own path contains `[lang]`. A handler at `app/api/...` is not under the root layout, so it has neither a getter nor a param. Either move the handler under the segment or make the locale an explicit part of its contract — a query parameter, a header or a cookie.

**★ Multiple root layouts silently turn `string` into `string | undefined` everywhere.**
Adding a second root layout that lacks a parameter re-types that parameter's getter across the whole application, because the getter must account for every route it could be called from. Existing call sites that did `(await id()).toUpperCase()` become type errors — which is the good outcome. The bad outcome is not noticing, because the types are generated and a stale generation hides it.

**★ Optional catch-all root params return `string[] | undefined`, and `.join()` on that throws.**
The table above is easy to skim past. `[[...path]]` can legitimately resolve to nothing, so guard with optional chaining (`segments?.join(' / ')`) rather than assuming an array.

**★ Root param types exist only after `next dev`, `next build` or `next typegen`.**
Same generation step as `PageProps`, `LayoutProps` and `RouteContext`. A CI job that type-checks before any of those has run will fail to resolve the module's exports, and — worse — a *stale* generation will happily type-check against a shape the app no longer has. Run `next typegen` immediately before `tsc` in CI.

**★ Passing a root param into a Client Component is the intended pattern, not a defeat.**
There is no client-side equivalent and there is not going to be one; the value is a property of the server render of a route. Read it in the enclosing Server Component and pass it as a prop. The whole point of the API is that this boundary is now the *only* place you drill it, instead of every level in between.

## Interview questions

**★ Name the four places a root param getter will not run, and say which one is temporary.**
Client Components (build error), Server Actions (runtime error), `unstable_cache` (runtime error), and Route Handlers (unsupported). The docs describe the first three as permanent constraints of how root parameters work, and Route Handler support as planned for a future release.

**★ Why is `unstable_cache` incompatible with root params when `'use cache'` is not?**
Because `'use cache'` can track which root param getters the cached function calls and fold exactly those into its cache key, so entries are not split across unrelated parameter values. `unstable_cache` has no mechanism to express that dependency, so calling a getter inside it throws at runtime. The documented remedy is to migrate the function to `'use cache'`.

**★ Your Server Action needs the current locale. What do you do?**
Read it in the Server Component that renders the form, where the getter works, and bind it into the action — `saveSettings.bind(null, language)`. An action runs in response to a POST rather than a route render, so there is no root-layout render in scope; binding makes the dependency explicit in the action's signature rather than inferring it from a header.

**★ How would you get the locale in a Route Handler today?**
If the handler lives under the root segment, take it from its own route context params — a handler at `app/[lang]/api/posts/route.ts` receives `lang` in `ctx.params` like any other dynamic segment, and `RouteContext<'/[lang]/api/posts'>` types it. If the handler sits outside that segment it has no path-based locale at all, and the value has to come from a query parameter, header or cookie by explicit contract.

**★ You add a second root layout to the app and CI suddenly reports type errors at a dozen call sites. What happened?**
A parameter that does not exist in every root layout is typed `string | undefined`, because the getters must account for use in any possible route. Adding a root layout without that parameter therefore re-types the getter application-wide, and every call site that assumed a `string` becomes an error. It is a correct error: those call sites can now genuinely receive `undefined`.

**★ What return types can a root param getter produce?**
`string` for a dynamic segment, `string[]` for a catch-all, and `string[] | undefined` for an optional catch-all — plus `undefined` added to any of these when the parameter is absent from one of several root layouts. Everything is wrapped in a promise, so every call is awaited.

**★ Why does a file using `next/root-params` not need `import 'server-only'`?**
Because the import already fails at build time if it is reached from a Client Component. The `server-only` package exists to convert a would-be runtime leak into a build error, and this module already has that property.

{/* FOOTER */}
