---
title: "The Pages Router's data API was per-page and ran before rendering; the App Router's is per-component and runs during it — every other difference between the two follows from that one change"
sidebar_label: "01 · Evolution to the App Router"
sidebar_position: 1
description: "Why the Pages Router existed and what it structurally could not do, how getServerSideProps and getStaticProps constrained the component tree, what the App Router changed, and what 'App Router is the standard' means for a codebase that still contains both."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against the [installation docs](https://nextjs.org/docs/app/getting-started/installation) (`version: 16.3.4`, `lastUpdated` 2026-07-21) and the [16.3 release post](https://nextjs.org/blog/next-16-3). Router-behaviour claims are cross-checked against this book's own version-history findings, recorded in the chapter 4 pages.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**Most explanations of this migration present a table of renamed APIs, which makes it look like a matter of taste. It was not. The Pages Router had one structural limitation that could not be fixed without changing where data fetching lives, and everything the App Router does — nested layouts, streaming, Server Components, per-fetch caching — is downstream of fixing it. If you understand the limitation, you can predict most of the App Router's design without being told it.**

## The limitation, stated precisely

In the Pages Router, data fetching was **per-page and ran to completion before rendering began**:

```jsx
// pages/dashboard.jsx — the Pages Router model
export async function getServerSideProps(context) {
  const user = await fetchUser(context.req)
  const tasks = await fetchTasks(user.id)
  const billing = await fetchBilling(user.orgId)   // slow, and nobody is waiting for it
  return { props: { user, tasks, billing } }
}

export default function Dashboard({ user, tasks, billing }) { /* ... */ }
```

Three properties fall out of that shape, and each one is a problem:

1. **Only the page could fetch.** A deeply nested component needing data had two options: prop-drill it from the page, or fetch on the client after mount. There was no third option, because `getServerSideProps` existed only at the route's top level.
2. **The slowest fetch set the time to first byte.** The function returns one props object. `billing` being slow delayed `user` and `tasks`, even though the header could have rendered immediately.
3. **The data shape and the component tree had to be kept in sync by hand.** Move a component to a different page and its data requirement moved with it — into a different `getServerSideProps` you also had to edit.

🔴 **Note what is *not* on that list: nothing about it was slow, or badly implemented, or unfashionable.** The Pages Router was fast and predictable. The limitation is architectural — the fetch boundary was the route, and components are not routes.

## What the App Router changed

One change, from which the rest follows: **components themselves can be `async` and fetch their own data, on the server, during rendering.**

```tsx
// app/dashboard/page.tsx — the App Router model
export default async function Dashboard() {
  const user = await fetchUser()           // this component's own data
  return (
    <>
      <Header user={user} />
      <Suspense fallback={<TasksSkeleton />}>
        <Tasks userId={user.id} />         {/* fetches its own */}
      </Suspense>
      <Suspense fallback={<BillingSkeleton />}>
        <Billing orgId={user.orgId} />     {/* slow, and no longer blocks anything */}
      </Suspense>
    </>
  )
}
```

Now walk back through the three problems:

1. **Any component can fetch**, so data lives with the component that needs it. Prop-drilling becomes a choice rather than a requirement.
2. **The slow fetch no longer sets TTFB.** `Billing` is behind a Suspense boundary, so the shell streams immediately and billing arrives when ready.
3. **Moving a component moves its data with it**, because the fetch is inside the component. There is no separate function to keep in sync.

Everything else people list as an App Router feature is a consequence. Nested `layout.tsx` files exist because components fetch their own data, so a layout can fetch too and persist across navigations. Streaming exists because rendering is no longer gated on one props object. Server Components exist because a component that fetches on the server has no reason to ship to the browser.

## The comparison table, read correctly

| Pages Router | App Router | The reason |
|---|---|---|
| Client components by default | **Server Components by default** | A component that fetches server-side need not ship |
| `getServerSideProps` / `getStaticProps` | `async` components + extended `fetch()` | Fetching moved from the route to the component |
| `_app` / `_document` | Nested `layout.tsx` | Layouts can now fetch and persist per segment |
| Limited streaming | Streaming + Suspense first-class | Rendering is no longer gated on one props object |
| Per-page static/dynamic choice | Per-route **and per-fetch** | Caching became a property of each call |

⚠️ **Read that table left-to-right as *causes*, not as a rename map.** Teams that treat it as a rename map produce App Router code with a `page.tsx` that fetches everything and passes it down — Pages Router semantics in App Router syntax, with the migration cost paid and no benefit received.

## "The App Router is the standard" — what that actually means

It is a statement about defaults and investment, not a deprecation notice. Three separate facts, often collapsed:

- **`create-next-app` recommends and defaults to the App Router.** The prompt reads `Would you like to use App Router? (recommended)`.
- **New features land in the App Router.** Cache Components, Instant Navigations, root params, `catchError` — none of it is coming to the Pages Router.
- **The Pages Router is still supported and still shipped.** It is not deprecated, and a working Pages Router application is not a bug.

🔴 **One genuinely load-bearing difference between them, which surprises people mid-migration: they resolve React differently.** The App Router *"uses React canary releases built-in"*; the Pages Router *"uses the React version from your `package.json`"*. In a codebase containing both, the same `react` pin governs one half of your application and not the other. A React-level bug fixed by pinning in the Pages Router will not be fixed the same way in the App Router.

## Migrating: the part worth knowing before you start

**The two routers coexist in one application.** `app/` and `pages/` can both be present, routed per path. That makes incremental migration real rather than aspirational — the usual approach is to move marketing and read-heavy routes first, where server rendering pays immediately, and leave an authenticated dashboard on the Pages Router until later.

Conflicts to know about:

- **Do not define the same path in both.** The migration guide states only that the directories coexist — *"The `app` directory is intentionally designed to work simultaneously with the `pages` directory to allow for incremental page-by-page migration"* — and **does not document a precedence rule for a path present in both**. Next.js reports an overlap rather than silently picking a winner, but because the resolution is unspecified in the docs, do not build on it: delete one side.
- **`_app.jsx` and `_document.jsx` do not apply to `app/`.** Global styling and providers must be re-established in the root layout. This is the step most often missed, and the symptom — styles missing on new routes only — looks like a CSS problem.
- **Route Handlers replace API routes**, with different caching semantics. `pages/api/*` handlers and `app/api/*/route.ts` are not interchangeable.

## A version-history trap that predates most tutorials

Material written across the App Router's four majors is all still online and reads as current. Three findings from this book's own verification work, each of which silently changes behaviour:

- **`request.ip` and `request.geo` were removed in Next.js 15** — *"The `geo` and `ip` properties on `NextRequest` have been removed as these values are provided by your hosting provider"*, with a codemod to automate the migration. The docs state the removal, not the runtime symptom; reading a property that no longer exists yields `undefined` in JavaScript, so a rate limiter keyed on it collapses every caller into one bucket and fails open. TypeScript users get a compile error instead and never see this.
- **`GET` Route Handlers are not cached by default**, changed in Next.js 15: *"`GET` functions in Route Handlers are no longer cached by default. To opt `GET` methods into caching, you can use a route config option such as `export const dynamic = 'force-static'` in your Route Handler file."* Guides still teach the old pitfall ("your handler only logs at build time"), which is now exactly backwards. Only `GET` was ever cached, so the inversion never applied to `POST` and friends.
- **v16.0.0 removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache`** when Cache Components is enabled.

The defence is structural rather than vigilance-based: prefer the docs bundled at `node_modules/next/dist/docs/`, which match your installed version by construction.

## Gotchas

**★ Symptom: you migrate a route and TTFB gets *worse*.** Cause: the page `await`s everything at the top before returning JSX, which is `getServerSideProps` semantics rewritten in the new syntax — with no Suspense boundary, there is nothing to stream. Fix: await only what the shell genuinely needs, and put each independent slow read behind its own boundary.

```tsx
// ❌ one await chain gates the entire page
const [user, tasks, billing] = await Promise.all([fetchUser(), fetchTasks(), fetchBilling()])

// ✅ shell renders now; each slow part arrives when ready
const user = await fetchUser()
return <><Header user={user} />
  <Suspense fallback={<S/>}><Billing orgId={user.orgId} /></Suspense></>
```

**★ Symptom: global styles and context providers vanish on migrated routes only.** Cause: `_app.jsx` and `_document.jsx` have no effect on `app/`. Routes still served by `pages/` look fine, which makes it read as a routing or CSS bug rather than a missing root layout. Fix: re-establish global imports and providers in `app/layout.tsx`, and check a migrated route specifically rather than the app's home page.

**★ Symptom: a rate limiter lets everyone through after an upgrade, with no error in the logs.** Cause: `request.ip` and `request.geo` were removed in Next.js 15, so in plain JavaScript every request keys to `undefined` — the same bucket. It fails open and silently. Fix: take the value from wherever your host provides it — the docs' own instruction is that these *"values are provided by your hosting provider"*, and on Vercel that is `ipAddress()` and `geolocation()` from `@vercel/functions`. Otherwise read the forwarded header your platform sets, and assert the value exists rather than trusting it.

```ts
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
if (!ip) throw new Error('no client address — rate limiting cannot be trusted here')
```

**★ Symptom: a guide's advice about Route Handler caching produces the opposite of what it promises.** Cause: `GET` Route Handlers were cached by default before Next.js 15 and are not now. The widely-repeated pitfall about a handler "only logging at build time" describes behaviour that no longer exists. Fix: check any caching claim against your installed version's bundled docs; this specific one inverted.

**★ Symptom: `app/about/page.tsx` is added and the route that worked yesterday now fails or serves the wrong file.** Cause: `pages/about.tsx` still exists. The routers are documented as coexisting per path, but **which one wins for a path defined in both is not specified in the documentation**, so this is not a behaviour to reason about — it is a state to avoid. Fix: delete the Pages version in the same commit that adds the App version, and treat any overlap as a mistake rather than a configuration.

**★ Symptom: pinning React fixes a bug on some routes and not others in one codebase.** Cause: the App Router uses bundled React canary releases; the Pages Router uses the React version from `package.json`. Mid-migration, one pin governs half the app. Fix: track the Next.js version for App Router behaviour, and stop expecting the two halves to answer version questions the same way.

**Symptom: a component is moved between routes and its data breaks.** Cause: Pages-era habits — the data came from that route's `getServerSideProps`, which did not move with it. Fix: this is precisely the problem the App Router removes; let the component fetch its own data and it becomes portable.

**Symptom: the team argues about whether the Pages Router is deprecated.** Cause: "the App Router is the standard" is heard as a deprecation. It is not one. Fix: separate the three claims — it is the `create-next-app` default, it is where new features land, and the Pages Router remains supported. Only the second one forces a migration timeline, and only if you want those features.

## Interview questions

**★ Why did the App Router exist at all? Give the structural reason, not the feature list.**
Because in the Pages Router the data-fetching boundary was the route, and components are not routes. `getServerSideProps` and `getStaticProps` existed only at a page's top level and ran to completion before rendering, which forced three things: only the page could fetch, so nested components either prop-drilled or fetched on the client; the slowest fetch set time to first byte, because everything returned in one props object; and a component's data requirement lived in a different function from the component, so moving one meant editing the other. The App Router's single change is that components can be `async` and fetch during rendering. Nested layouts, streaming and Server Components are all consequences of that.

**★ A team migrates a route and time to first byte gets worse. What did they most likely do?**
Awaited everything at the top of the page component before returning any JSX — `getServerSideProps` semantics in App Router syntax. With no Suspense boundary there is nothing for the framework to stream, so they kept the old blocking behaviour and added the migration's overhead. The fix is to await only what the shell needs and put each independent slow read behind its own boundary, which is the whole point of moving fetching into components.

**★ What does "the App Router is the standard" actually mean? Is the Pages Router deprecated?**
It means three separable things, and only some of them force action. `create-next-app` defaults to and recommends the App Router. New features land there exclusively — Cache Components, Instant Navigations, root params, `catchError`. And the Pages Router remains supported and shipped; it is not deprecated and a working Pages Router app is not a defect. So there is no deadline, but there is an opportunity cost, and it grows with every release.

**Both routers are in one codebase. Name a difference that will bite someone who assumes they behave the same.**
React version resolution. The App Router uses React canary releases built-in, while the Pages Router uses the React version from `package.json`. So a single `react` pin governs one half of the application and not the other, and a React-level bug you fix by pinning in the Pages Router stays broken in the App Router. Beyond that: `_app`/`_document` have no effect on `app/`, so global styles and providers must be re-established in the root layout, and a path present in both routers is a build-time conflict rather than a precedence rule.

**Why is so much App Router advice on the internet actively harmful rather than merely dated?**
Because several changes inverted behaviour rather than adding to it, so old advice is not incomplete — it is backwards. `GET` Route Handlers were cached by default before Next.js 15 and are not now, which makes the popular "your handler only logs at build time" pitfall exactly wrong. `request.ip` and `request.geo` were removed in Next.js 15 because, in the docs' words, *"these values are provided by your hosting provider"* — so a rate limiter built on a 2024 tutorial reads `undefined` and fails open silently rather than erroring. And v16.0.0 removes several route segment config options under Cache Components. The structural defence is reading the docs bundled in your own `node_modules`, which match the installed version by construction.

**How would you sequence an incremental migration?**
The routers coexist, routed per path, so this is genuinely incremental. Move read-heavy and marketing routes first — server rendering pays immediately there and the risk is lowest. Re-establish global styles and providers in the root layout early, since that omission produces confusing symptoms on migrated routes only. Leave authenticated, interaction-heavy areas like a dashboard until the team is fluent, because that is where the `'use client'` boundary decisions are hardest. Convert `pages/api` handlers to Route Handlers deliberately rather than mechanically, since their caching semantics differ.

**What is the strongest argument that the Pages Router was a good design?**
That its limitation was architectural rather than a defect. It was fast, predictable, and its data flow was extremely easy to reason about — one function, one props object, no question about where a fetch happens. What it could not do was let a nested component own its data, and that constraint only becomes expensive as applications grow deep rather than wide. Recognising that keeps the migration honest: you are trading a simpler model for a more capable one, and on a small site the trade may not pay.

---

← Prev [01 · Overview: what Next.js is](01-explanation.md) · [Index](01-explanation.md) · Next → [02 · Next.js vs the alternatives](02-nextjs-vs-alternatives-remix-react-router-v7-astro-tanstack.md)
