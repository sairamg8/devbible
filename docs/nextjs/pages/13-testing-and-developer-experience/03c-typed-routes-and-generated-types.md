---
title: "typedRoutes makes your route tree into a union type, but that union is a generated build artefact — so every failure mode of typed routes is really a failure to regenerate"
sidebar_label: "3c · Typed routes and generated types"
sidebar_position: 103
description: "Enabling typedRoutes, exactly what it types in each router, the Route<T> generic for wrapper components, the .next/types artefact and the tsconfig include it needs, next typegen in CI and monorepos, the PageProps/LayoutProps/RouteContext helpers, and typedEnv's production blind spot."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [TypeScript configuration](https://nextjs.org/docs/app/api-reference/config/typescript) (lastUpdated 2026-08-25), [`typedRoutes`](https://nextjs.org/docs/app/api-reference/config/next-config-js/typedRoutes) (2025-08-19), [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) (2026-06-09) and [`next` CLI](https://nextjs.org/docs/app/api-reference/cli/next) (2026-08-25). Continues [3b · Module syntax and where types stop](03b-module-syntax-and-where-types-stop.md). Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · TypeScript **7.0.2** · Node.js 24.20.0.

**A broken internal link is a class of bug that a test suite catches badly and a type checker catches perfectly: there is a finite set of valid routes, it is derivable from the file system, and every `href` in the codebase can be checked against it for free. `typedRoutes` does exactly that. What makes it feel unreliable in practice is that the check depends on a file Next.js writes into `.next/types` during `next dev`, `next build` or `next typegen` — so a clean checkout, a CI job that runs `tsc` before it runs anything Next.js, or a monorepo that type-checks from the wrong directory all produce the same symptom: the types are wrong or absent, and nobody suspects the artefact.**

## Turning it on

`typedRoutes` is a top-level config key. It was `experimental.typedRoutes` and is now stable:

> *"This option has been marked as stable, so you should use `typedRoutes` instead of `experimental.typedRoutes`."*

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
}

export default nextConfig
```

It requires TypeScript. And it produces a generated file:

> *"Next.js will generate a link definition in `.next/types` that contains information about all existing routes in your application, which TypeScript can then use to provide feedback in your editor about invalid links."*

🔴 If your project was not scaffolded by `create-next-app`, that file is not in the compilation. The `include` array must name it:

```json
{
  "include": [
    "next-env.d.ts",
    ".next/types/**/*.ts",
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": ["node_modules"]
}
```

Missing that line is a silent failure: `typedRoutes` is on, generation happens, nothing is checked, and every `href` is `string` again.

## What it types, precisely

> *"Works in both the Pages and App Router for the `href` prop in `next/link`. In the App Router, it also types `next/navigation` methods like `push`, `replace`, and `prefetch`. It does not type `next/router` methods in Pages Router."*

So in an App Router codebase the covered surface is `<Link href>`, `router.push`, `router.replace` and `router.prefetch`. Not covered, and worth saying out loud: `redirect()` and `permanentRedirect()` from `next/navigation`, `NextResponse.redirect`, `fetch` URLs, and anything you build as a string and hand to `window.location`.

## Literal and non-literal `href`

The rule is about the *syntax* of the expression, not its value:

> *"Literal `href` strings are validated, while non-literal `href`s may require a cast with `as Route`."*

```tsx
'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function BoardNav({ teamId }: { teamId: string }) {
  const router = useRouter()

  return (
    <>
      {/* literal — checked */}
      <Link href="/teams" />

      {/* template literal over a dynamic segment — checked */}
      <Link href={`/teams/${teamId}/board`} />

      {/* concatenation — not a literal, needs the cast */}
      <Link href={('/teams/' + teamId + '/board') as Route} />

      {/* a typo fails the build */}
      <Link href="/tems" />

      <button onClick={() => router.push(`/teams/${teamId}/settings`)}>
        Settings
      </button>
    </>
  )
}
```

Template literals with interpolated dynamic segments are validated; string concatenation is not. That is not arbitrary — a template literal has a type-level shape TypeScript can match against the route union, and `a + b` collapses to `string`.

**A destination that is not a file-system route needs the cast by definition.** A path served by `proxy.ts` has no `page.tsx` behind it, so it is absent from the generated union:

```tsx
import type { Route } from 'next'
import Link from 'next/link'

export default function Page() {
  return <Link href={'/proxy-redirect' as Route}>Link Text</Link>
}
```

Every `as Route` in your codebase is therefore a claim that a route exists outside the file system. That is a small, greppable set, and it is worth reviewing it periodically — a stale `as Route` is exactly the broken link the feature was supposed to prevent.

## Wrapper components: the `Route<T>` generic

The moment you wrap `next/link` in a design-system component, a naive `href: string` prop throws the checking away. The documented pattern keeps it:

```tsx
import type { Route } from 'next'
import Link from 'next/link'

function Card<T extends string>({ href }: { href: Route<T> | URL }) {
  return (
    <Link href={href}>
      <div>My Card</div>
    </Link>
  )
}
```

The generic is what preserves the literal at the call site. `href: Route` alone would accept any member of the union but lose the caller's specific string; `Route<T>` with `T` inferred from the argument validates the caller's literal against the union.

The same trick types a data structure, which is how a navigation config stops drifting from the route tree:

```ts
// components/nav-items.ts
import type { Route } from 'next'

type NavItem<T extends string = string> = {
  href: T
  label: string
}

export const navItems: NavItem<Route>[] = [
  { href: '/', label: 'Home' },
  { href: '/teams', label: 'Teams' },
  { href: '/settings', label: 'Settings' },
]
```

Delete `app/settings/page.tsx` and this file fails to compile. That is a regression test with no test file.

## The route-aware helpers

Three global types are generated alongside the route union:

> *"Next.js generates global helpers for App Router route types. These are available without imports and are generated during `next dev`, `next build`, or via `next typegen`"* — `PageProps`, `LayoutProps`, `RouteContext`.

```tsx
// app/teams/[teamId]/board/page.tsx
export default async function BoardPage(props: PageProps<'/teams/[teamId]/board'>) {
  const { teamId } = await props.params
  const query = await props.searchParams
  return <Board teamId={teamId} filter={query.status} />
}
```

Three facts about them that decide how much they are worth:

- > *"Using a literal route (e.g. `'/blog/[slug]'`) enables autocomplete and strict keys for `params`."* — so `props.params.teamID` is a compile error, which hand-written `params: Promise<{ teamId: string }>` never gave you.
- > *"Static routes resolve `params` to `{}`."*
- > *"After type generation, the `PageProps` helper is globally available. It doesn't need to be imported."*

🔴 What they emphatically do **not** do is validate the values. `params` is typed `Promise<{ teamId: string }>`; `teamId` is whatever was in the URL, including `'../../etc/passwd'`. And `searchParams` remains `Promise<{ [key: string]: string | string[] | undefined }>` — the helper types the route, not the query. Both are parse sites; see [3d](03d-zod-contract-tests-at-the-boundaries.md).

## Generation is a build step, and CI is where it goes missing

`next typegen` exists precisely so type-checking does not require a build:

> *"generates TypeScript definitions for your application's routes without performing a full build."*

> *"It is often undesirable to run these [`next dev` / `next build`] just to type-check, for example in CI/CD environments."*

So the correct type-check command in CI is two commands:

```bash
next typegen && tsc --noEmit
```

Details that matter:

- Output goes to `<distDir>/types` — `.next/dev/types` in development, `.next/types` in a production build. Both are inside `.next`, which is gitignored, which is why a clean CI checkout has neither.
- `next typegen` also regenerates `next-env.d.ts`. That file *"is managed by Next.js. Its contents are an implementation detail… Add it to `.gitignore`"*, and it must be in the `include` array.
- It loads your Next.js config **using the production build phase**, so any environment variable your `next.config.ts` requires must be present in the CI job that runs it — a typegen step can fail for a missing secret that has nothing to do with types.
- In a monorepo it takes a directory: `next typegen ./apps/web`. Run it from the repo root without the argument and it will not find the app.

Never put custom declarations in `next-env.d.ts`; it is regenerated. Add a new `.d.ts` to `include` instead.

## `typedEnv`, and the blind spot it ships with

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    typedEnv: true,
  },
}

export default nextConfig
```

This generates IntelliSense for the environment variables Next.js loaded, into `.next/types`. The caveat is load-bearing:

> *"Types are generated based on the environment variables loaded at development runtime, which excludes variables from `.env.production*` files by default. To include production-specific variables, run `next dev` with `NODE_ENV=production`."*

Read that as: `typedEnv` is an editor convenience derived from *your machine's* environment. It is not a contract, it does not run in CI in any meaningful sense, and it will happily autocomplete a variable that does not exist in production. It is not a substitute for parsing the environment.

## Gotchas

**★ Symptom: `typedRoutes: true` is set and every `href` still accepts any string.** Cause: `.next/types/**/*.ts` is missing from the `tsconfig.json` `include` array. `create-next-app` adds it; a hand-rolled or migrated project usually does not. Fix: add it, exactly as shown above, alongside `next-env.d.ts`.

**★ Symptom: CI fails with "Cannot find name 'PageProps'" on a clean checkout.** Cause: the helpers are generated into `.next`, `.next` is gitignored, and the job ran `tsc --noEmit` without ever running Next.js. Fix: `next typegen && tsc --noEmit` as the type-check script — not `next build`, which is slower and does more.

**★ Symptom: `next typegen` fails in CI with a config error about a missing environment variable.** Cause: typegen loads `next.config.ts` under the production build phase, so config code that reads `process.env` at module scope runs. Fix: provide the variable to the typegen job, or move the read out of module scope in the config. It is not a type problem and no amount of tsconfig work will fix it.

**★ Symptom: a route was deleted and no link errored.** Cause: the editor is using a stale `.next/dev/types` from before the deletion, or the dev server was not running when the file was removed. Fix: rerun `next typegen`, and restart the TypeScript server in the editor. In CI this cannot happen, because typegen runs fresh — which is an argument for treating the CI type-check, not the editor, as the source of truth.

**★ Symptom: `as Route` is scattered through the codebase and a broken link shipped anyway.** Cause: every `as Route` is an unchecked assertion; a path that was valid when the cast was written stops being valid when the route moves. Fix: minimise them. Prefer template literals over concatenation (template literals *are* checked), and keep the genuine exceptions — proxy destinations, externally-owned paths — in one module so `grep 'as Route'` returns a reviewable list.

**★ Symptom: a design-system `Link` wrapper compiles with any string.** Cause: the wrapper's prop is `href: string`, or `href: Route` without the generic, which erases the caller's literal. Fix: the documented generic form, `function Card<T extends string>({ href }: { href: Route<T> | URL })`.

**★ Symptom: `router.push` is checked but `redirect()` is not.** Cause: `typedRoutes` covers `next/link` and the `next/navigation` router methods `push`, `replace` and `prefetch`. `redirect` and `permanentRedirect` are not in that list, and neither is `NextResponse.redirect`. Fix: pass a `Route`-typed value into them — build the destination as a typed constant and hand it to `redirect(dest)` — so the check happens where the string is created.

**★ Symptom: `params.teamId` is typed `string`, the value is garbage, and the query throws.** Cause: route types describe the *shape* of the params object, not the validity of its contents. A dynamic segment matches almost anything. Fix: parse the segment before it reaches the data layer — a UUID or slug schema is three lines — and let a failed parse produce `notFound()`.

**★ Symptom: `typedEnv` autocompletes a variable that is undefined in production.** Cause: the types were generated from development-runtime environment loading, which excludes `.env.production*`. Fix: do not treat `typedEnv` as validation. Parse the environment through a schema at startup and derive the type from that; run `next dev` with `NODE_ENV=production` only if you want production keys in editor IntelliSense as well.

**★ Symptom: custom global types vanish after every `next dev`.** Cause: they were added to `next-env.d.ts`, which Next.js regenerates on `next dev`, `next build` and `next typegen`. Fix: create a separate `.d.ts` and add it to `include`; leave `next-env.d.ts` alone and gitignored.

## Interview questions

**★ Why does `typedRoutes` need a build step at all — why can't TypeScript see the routes?**
Because the route table is a fact about the file system, not about any type in your source. Nothing in `app/teams/[teamId]/board/page.tsx` declares the string `'/teams/[teamId]/board'`; that string is produced by Next.js's route discovery. So the union has to be *computed* by a tool that walks the directory and then written into a `.d.ts` that the compiler includes. That is why the failure modes are all artefact failures — stale file, missing `include` entry, or never generated at all.

**★ Which is checked: `` href={`/teams/${id}`} `` or `href={'/teams/' + id}`?**
The template literal. TypeScript infers a template-literal type for the first, which it can match against the route union's dynamic-segment patterns; the concatenation infers plain `string`, which cannot be matched and needs `as Route`. This is a good thing to know because it changes how you write links: prefer interpolation, and treat the need for `as Route` as a signal that the destination may not be a real route.

**★ What is the difference between `href: Route` and `href: Route<T>` on a wrapper component?**
`Route` accepts any member of the route union, but the parameter's type becomes that union, so the caller's specific literal is discarded and nothing further downstream knows which route was passed. `Route<T>` with `T extends string` infers `T` from the argument, so the literal survives and is validated against the union at the call site. In practice the non-generic form still catches typos; the generic form is what lets the wrapper's other props depend on which route was chosen.

**★ Your CI type-check passes locally and fails in CI with missing global types. What is the difference?**
Locally, `next dev` has been running and has populated `.next/dev/types`, so the globals exist on disk. CI clones fresh, `.next` is gitignored, and `tsc` runs against a project whose `include` names a directory that does not exist. The fix is to make generation part of the check — `next typegen && tsc --noEmit` — rather than to commit generated types, which would go stale on the first route change.

**★ Does `typedRoutes` prevent a 404?**
It prevents one cause of a 404: a link to a path with no matching route file. It does not prevent a link to a valid dynamic route with an invalid parameter (`/teams/nope/board` type-checks perfectly), it does not cover `redirect()` or server-side redirects, and it does not know about routes served by a proxy or a rewrite. So it converts a whole class of typo bugs into compile errors and leaves the value-validity class entirely to runtime.

**★ Is `experimental.typedEnv` a replacement for validating environment variables?**
No, and treating it as one is the trap. It generates editor types from the variables that happened to be loaded at development runtime, explicitly excluding `.env.production*` files. So it can autocomplete a variable that does not exist in the environment you deploy to, which is precisely the failure it looks like it prevents. It is an IntelliSense feature. Validation means parsing `process.env` once, at startup, with a schema that fails loudly.

{/* FOOTER */}
