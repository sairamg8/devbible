---
title: "`getServerSideProps` becomes an async Server Component body in five minutes — the migration cost is everything else the `context` object carried, because the App Router's request accessors are read-only and there is no `res`"
sidebar_label: "02b · Translating request-time data"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to migrate from Pages to the App Router](https://nextjs.org/docs/app/guides/migrating/app-router-migration) (`version: 16.3.4`, `lastUpdated: 2026-08-25`) and [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods) (`lastUpdated: 2026-08-25`), whose published `next-async-request-api` transform output is the source for the `Promise`-typed `params` / `searchParams` signatures below.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified; **no sandbox run**.

**The translation everyone budgets for — `getServerSideProps` into an `async` Server Component — is the cheapest part of the migration. The expensive part is that `getServerSideProps` was handed a `context` object holding the live `req` and `res`, and a Server Component is handed nothing of the kind. The App Router's request accessors are, in the documentation's own word, *read-only*. So every line of a legacy page that reached into `context.res`, returned `redirect` or `notFound` from props, or branched on `context.locale` is not a translation, it is a redesign — and the count of those lines, not the count of routes, is what predicts the schedule. Build-time data fetching is in [02c](02c-translating-build-time-data.md); the two APIs with no clean successor are in [02d](02d-the-two-apis-with-no-clean-successor.md).**

## The whole replacement table, so you can see both chunks at once

> *"Data fetching functions like `getServerSideProps` and `getStaticProps` have been replaced with [a new API] inside `app`. `getStaticPaths` has been replaced with [`generateStaticParams`]."*

> *"`pages/_error.js` has been replaced with more granular `error.js` special files."* · *"`pages/404.js` has been replaced with the [`not-found.js`] file."*

| `pages/` | `app/` | What does not survive | Covered in |
|---|---|---|---|
| `getServerSideProps` | `async` Server Component body | `context.req`, `context.res`, `redirect`/`notFound` as return values, `context.locale` | this page |
| `getStaticProps` | the same body, with a cache decision | `revalidate` as a page-level return value | [02c](02c-translating-build-time-data.md) |
| `getStaticProps` + `revalidate` | `fetch(url, { next: { revalidate: n } })` | nothing material | [02c](02c-translating-build-time-data.md) |
| `getStaticPaths` | `generateStaticParams` | the nested `{ params: { … } }` return shape | [02c](02c-translating-build-time-data.md) |
| `fallback: true \| false \| 'blocking'` | `export const dynamicParams` | `'blocking'` as a distinct mode | [02c](02c-translating-build-time-data.md) |
| `getInitialProps` | **no documented recipe** | everything | [02d](02d-the-two-apis-with-no-clean-successor.md) |
| `pages/api/*` | `app/api/*/route.ts` | `req`/`res` Node handles, `res.status().json()` | [02d](02d-the-two-apis-with-no-clean-successor.md) |
| `pages/_error.js` | `error.tsx` per segment | one global error page | this page |
| `pages/404.js` | `not-found.tsx` | one global 404 | this page |

## `getServerSideProps` → an `async` Server Component

```jsx
// ❌ pages/dashboard.js
export async function getServerSideProps() {
  const res = await fetch(`https://api.example.com/projects`);
  const projects = await res.json();

  return { props: { projects } };
}

export default function Dashboard({ projects }) {
  return (
    <ul>
      {projects.map((project) => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  );
}
```

```tsx
// ✅ app/dashboard/page.tsx
type Project = { id: string; name: string };

// This function can be named anything.
async function getProjects(): Promise<Project[]> {
  const res = await fetch(`https://api.example.com/projects`, { cache: 'no-store' });
  return res.json();
}

export default async function Dashboard() {
  const projects = await getProjects();

  return (
    <ul>
      {projects.map((project) => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  );
}
```

The guide is explicit that `no-store` is the piece carrying the `getServerSideProps` semantics:

> *"By setting the `cache` option to `no-store`, we can indicate that the fetched data should [never be cached]. This is similar to `getServerSideProps` in the `pages` directory."*

🔴 **Write `cache:` explicitly on every fetch you migrate, even where you believe the default is what you want.** The 16.3.4 migration guide contradicts *itself* on that default: a code comment in the Step 6 example reads *"Opt out of caching for this request. Next.js fetches this from the data source on every request. **This is the default fetch behavior.**"*, while the `getStaticProps` section states *"In the `app` directory, data fetching with [`fetch()`] will default to `cache: 'force-cache'`, which will cache the request data until manually invalidated."* Both sentences sit on the same page at the same `lastUpdated`. **Do not resolve that from memory** — this corpus has already shipped the claim backwards once. It is settled, with a diagnostic procedure, in [ch4 · diagnosing stale and unexpectedly dynamic routes](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md).

## What `context` gave you and a Server Component does not

`getServerSideProps({ req, res, params, query, locale, resolvedUrl, preview })` was one object holding the whole request. The App Router replaces the *readable* half with two imports and drops the rest:

> *"The `app` directory exposes new **read-only** functions to retrieve request data"* — `headers`, *"Based on the Web Headers API"*; `cookies`, *"Based on the Web Cookies API"*.

```jsx
// ❌ pages/index.js
export async function getServerSideProps({ req, query }) {
  const authHeader = req.getHeaders()['authorization'];
  const theme = req.cookies['theme'];

  return { props: { authHeader, theme, sort: query.sort ?? 'recent' } };
}

export default function Page({ theme, sort }) {
  return <main data-theme={theme}>{sort}</main>;
}
```

```tsx
// ✅ app/page.tsx
import { cookies, headers } from 'next/headers';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const authHeader = (await headers()).get('authorization');
  const theme = (await cookies()).get('theme')?.value;
  const { sort = 'recent' } = await searchParams;

  return <main data-theme={theme}>{typeof sort === 'string' ? sort : sort[0]}</main>;
}
```

| `context` member | App Router equivalent | Note |
|---|---|---|
| `req.headers` | `await headers()` | read-only, `async` |
| `req.cookies` | `await cookies()` | read-only, `async` |
| `params` | the `params` prop | a `Promise` in this major |
| `query` | the `searchParams` prop | a `Promise`; separate from `params` |
| `res` | **none documented** | see below |
| `locale` | **none** — built-in i18n is gone from `app` | the guide removes `locale` from `useRouter` because *"built-in i18n Next.js features are no longer necessary in the `app` directory"* |
| `resolvedUrl` | no direct equivalent | rebuild from `usePathname` / `searchParams` |

Three of those are worth their own paragraph:

1. **`cookies()` and `headers()` are `async`** and must be awaited. That is what the `next-async-request-api` codemod exists to fix — see [02g · codemods, cross-router traps and when to stop](02g-codemods-cross-router-traps-and-when-to-stop.md).
2. **`params` and `searchParams` are promises too.** The published `next-async-request-api` transform output types them `params: Promise<{ slug: string }>` and `searchParams: Promise<{ [key: string]: string | string[] | undefined }>` and awaits them. That is the signature to write by hand.
3. ⚠️ **There is no `res`.** The guide calls the replacements *read-only* and documents no write path from a page render. That is a deduction from the documentation rather than a sentence in it, and it should be read as one: **the 16.3.4 migration guide does not describe any way to set a response header, status or cookie from a Server Component page render.** Legacy code doing `res.setHeader('Set-Cookie', …)` inside `getServerSideProps` has no line-for-line translation; the write moves to a Server Action or a Route Handler. Exactly where writes are permitted lies outside this page's verified sources — check the `cookies` reference for the version you ship rather than guessing.

## Redirects and 404s stop being return values

```jsx
// ❌ pages/orders/[id].js — control flow expressed as props
export async function getServerSideProps({ params, req }) {
  if (!req.cookies['session']) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  const order = await findOrder(params.id);
  if (!order) return { notFound: true };
  return { props: { order } };
}
```

There is no props contract to express that in, so the same decisions become functions that throw. The mechanics of `redirect()` and `notFound()` — which is catchable, where each may be called — are covered in [ch2 · navigation mechanics](../02-routing-and-navigation/04-navigation-mechanics-link-userouter-redirect-notfound.md); this page's sources do not settle their semantics, so read that before relying on the shape below.

```tsx
// ✅ app/orders/[id]/page.tsx
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { findOrder } from '@/lib/orders';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await cookies()).get('session');
  if (!session) redirect('/login');

  const { id } = await params;
  const order = await findOrder(id);
  if (!order) notFound();

  return <article>{order.reference}</article>;
}
```

**`pages/404.js` and `pages/_error.js` go with them, and they get more granular rather than fewer.** One global 404 becomes a `not-found.tsx` per segment, and one global error page becomes an `error.tsx` per segment — *"`pages/_error.js` has been replaced with more granular `error.js` special files."* During a migration that is a decision you now have to make per route rather than once: a segment with no `not-found.tsx` inherits the nearest ancestor's, so the root pair carries everything until you start specialising.

```tsx
// app/not-found.tsx — the root fallback, ported from pages/404.js
export default function NotFound() {
  return <h1>404 — that page does not exist.</h1>;
}
```

## Gotchas

**★ Symptom: a migrated page serves build-time data and never refreshes, or hits the origin on every request when you wanted it cached.** Cause: you relied on the `fetch` default, and the 16.3.4 migration guide states that default *both ways* on the same page. Fix: never rely on it mid-migration — write the option at every call site you touch, then diagnose the route with [ch4 · 03c](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md).

```tsx
// Explicit at every migrated call site — the route's behaviour is readable locally.
const live = await fetch(url, { cache: 'no-store' });         // was getServerSideProps
const built = await fetch(url, { cache: 'force-cache' });      // was getStaticProps
const isr = await fetch(url, { next: { revalidate: 60 } });    // was revalidate: 60
```

**★ Symptom: a type error or a runtime error on `params.id` in a migrated dynamic route.** Cause: `params` and `searchParams` are promises in this major; the legacy signature destructured them synchronously. Fix: type them as promises and await.

```tsx
// ❌ the Pages-era shape
export default function Post({ params }: { params: { id: string } }) {
  return <span>{params.id}</span>;
}

// ✅ 16.3.4
export default async function Post({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <span>{id}</span>;
}
```

**★ Symptom: `res.setHeader(…)` from the old `getServerSideProps` has nowhere to go.** Cause: the App Router's request accessors are described as *read-only*, and the migration guide documents no write path from a page render. Fix: move the write out of the render — into a Route Handler or a Server Action — and confirm against the `cookies` reference for your version where writes are actually permitted.

```ts
// app/api/preferences/route.ts — the write lives here, not in a page render
export async function POST(request: Request) {
  const { theme } = await request.json();
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', `theme=${theme}; Path=/; HttpOnly; SameSite=Lax`);
  return response;
}
```

**★ Symptom: a route that returned `notFound: true` now renders an empty page instead of a 404.** Cause: the object return value was dropped in translation and nothing replaced it, so the component ran with `undefined` data. Fix: call `notFound()` — it is control flow, not a return value.

```tsx
const order = await findOrder(id);
if (!order) notFound();
return <article>{order.reference}</article>;
```

**Symptom: a page that read `context.locale` renders the wrong language after migration and nothing errors.** Cause: built-in i18n does not exist in `app` — the guide removes `locale`, `locales`, `defaultLocales` and `domainLocales` from `useRouter` because *"built-in i18n Next.js features are no longer necessary in the `app` directory"* — so the variable is simply `undefined` and your `?? 'en'` default silently wins. Fix: make the locale a route segment so it cannot be absent.

```tsx
// app/[locale]/page.tsx — the locale is now part of the URL, not framework state
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <main lang={locale}>{locale}</main>;
}
```

**Symptom: a redirect that used to be a 307 is now something else, or a permanent redirect became temporary.** Cause: `getServerSideProps` expressed the distinction with `permanent: true | false`; `redirect()` does not take that flag, and the choice is made by which function you call. Fix: do not translate `permanent` into an argument that does not exist — read [ch2 · navigation mechanics](../02-routing-and-navigation/04-navigation-mechanics-link-userouter-redirect-notfound.md) and pick the function whose documented status code matches what your old page returned. Getting this wrong is an SEO incident, not a bug.

**Symptom: the migrated page compiles but every request is dynamic when you expected some caching.** Cause: reading `cookies()` or `headers()` is a request-time operation, and a page that reads either is no longer prerenderable — which is correct, and is exactly what `getServerSideProps` did too, but is now a *consequence of a line you wrote* rather than of the function's name. Fix: if the read is incidental (a theme cookie used for one element), push it into a smaller component so the rest of the page can still be prerendered, rather than reading it at the top of `page.tsx`.

## Interview questions

**★ Translate `getServerSideProps` to the App Router, and then tell me what you lost.**
The body becomes an `async` Server Component — you await your data directly in the component and drop the props plumbing, marking request-time fetches `cache: 'no-store'`. What you lose is the `context` object. `params` and `query` come back as the `params` and `searchParams` props, now promises. `req` becomes the read-only `cookies()` and `headers()` functions. `res` has no documented replacement for a page render, so anything that set a header, a status or a cookie moves to a Route Handler or Server Action. And `redirect` / `notFound` stop being return values and become functions you call. The translation is five minutes; the `res` audit is the actual work.

**★ Why is losing `context.res` a bigger problem than losing `context.req`?**
Because `req` was only ever read, and reading has a documented replacement: `cookies()` and `headers()`. `res` was written, and writing from a render has none — the guide's word for the new accessors is *read-only*. So `req` usage is a mechanical rewrite while `res` usage is an architectural one: setting a cookie, a cache header or a status code has to move out of the page and into a handler or an action, which usually changes the page's control flow rather than its syntax. When estimating a migration, grep for `context.res` and `res.setHeader` first — that count predicts the schedule far better than the number of routes.

**★ What is the strongest argument for writing `cache:` explicitly on every fetch you migrate, even where the default is what you want?**
That mid-migration the reader of the code is not you, and their question is "is this route request-time or build-time?". An explicit option answers it at the call site. An omitted one sends them to documentation that, at 16.3.4, gives two different answers on the same page — one code comment saying uncached is the default, one prose sentence saying `force-cache` is. Explicitness costs nine characters and removes a whole class of review argument; once the migration is done the team can decide whether to lean on defaults again.

**Why are `params` and `searchParams` separate props when `context.query` merged them?**
Because they are different things that happened to share a bag. `params` comes from the route's own dynamic segments and is known to the router; `searchParams` comes from the query string and is arbitrary user input that cannot be enumerated at build time. Merging them meant a page could not tell whether `?id=5` or `/posts/5` produced `query.id`, and it forced any page reading the query string to be treated as request-time. Splitting them lets a route prerender on its `params` while still accepting `searchParams` at request time. The migration cost is that any legacy code destructuring `router.query` has to be sorted into two buckets by hand.

**A page reads a theme cookie for one `<div>` and is otherwise static content. What is the migration trap?**
That reading `cookies()` at the top of `page.tsx` makes the whole route request-time, and you will have converted a cacheable marketing page into a dynamically rendered one without noticing, because nothing errors. In `pages/` the same thing happened the moment you added `getServerSideProps`, but the function name made it obvious. Now it is a consequence of one import. The fix is to isolate the request-time read into the smallest component that needs it so the rest of the route keeps its rendering strategy, and to verify what the build decided rather than what you assumed.

---

← [Pages → App migration](02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md) · [Chapter index](01-explanation.md) · Next → [Translating build-time data](02c-translating-build-time-data.md)
