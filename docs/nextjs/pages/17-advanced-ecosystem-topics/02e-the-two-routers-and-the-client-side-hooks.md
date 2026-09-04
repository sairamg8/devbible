---
title: "`next/router` and `next/navigation` are two different modules exporting two different `useRouter` hooks, and importing the wrong one is the single most common error in a Pages-to-App migration because the import line still looks correct"
sidebar_label: "02e · The two routers and the hooks"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to migrate from Pages to the App Router](https://nextjs.org/docs/app/guides/migrating/app-router-migration) (`version: 16.3.4`, `lastUpdated: 2026-08-25`), Step 5 *Migrating Routing Hooks* and its `next/compat/router` note.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified; **no sandbox run**.
> ⚠️ `sidebar_position: 20` is deliberately out of range — see the note at the foot of this page.

**There are two `useRouter` hooks. One is exported by `next/router` and one by `next/navigation`, they have different APIs, and the only thing distinguishing them at a call site is a string in an import statement that a code reviewer's eye slides straight over. The guide's own wording is that the new hook *"has different behavior"* — not a superset, not a rename. Six properties you relied on are gone outright, `router.query` has split into two separate props, and all three new hooks are Client-Component-only. This is the chunk that decides whether your shared `components/` directory survives the migration, and the escape hatch for that — `next/compat/router` — is the least-known useful thing in the guide.**

## The rule, in the documentation's own words

> *"A new router has been added to support the new behavior in the `app` directory."*

> *"In `app`, you should use the three new hooks imported from `next/navigation`: [`useRouter()`], [`usePathname()`], and [`useSearchParams()`]."*

🔴 *"The new `useRouter` hook is imported from `next/navigation` and **has different behavior** to the `useRouter` hook in `pages` which is imported from `next/router`."*

> *"The [`useRouter` hook imported from `next/router`] is not supported in the `app` directory but can continue to be used in the `pages` directory."*

> *"These new hooks are only supported in Client Components. They cannot be used in Server Components."*

```tsx
// ❌ pages/ — still correct for every unmigrated route, and wrong in app/
import { useRouter } from 'next/router';

export default function Breadcrumb() {
  const router = useRouter();
  return <span>{router.pathname} · {router.query.tab}</span>;
}
```

```tsx
// ✅ app/ — three hooks where there was one, and 'use client' is mandatory
'use client';
import { useRouter, usePathname, useSearchParams, useParams } from 'next/navigation';

export function Breadcrumb() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();

  return (
    <button onClick={() => router.push('/')}>
      {pathname} · {searchParams.get('tab')} · {String(params.slug)}
    </button>
  );
}
```

**Why this is the error that recurs rather than the error you make once:** the two module names are visually similar, both compile, both type-check, and editors autocomplete whichever you used most recently. In a codebase where `pages/` files legitimately import `next/router`, an autocompleted `next/router` inside an `app/` file is not a typo the linter can assume is wrong — it is the correct import one directory over.

## What `useRouter` no longer returns, verbatim

| Removed | The guide's reason | What to use instead |
|---|---|---|
| `pathname` | *"The new `useRouter` does not return the `pathname` string."* | `usePathname` |
| `query` | *"The new `useRouter` does not return the `query` object."* | `useSearchParams` and `useParams` |
| `isFallback` | *"`isFallback` has been removed because `fallback` has [been replaced]."* | `loading.tsx` / Suspense |
| `locale`, `locales`, `defaultLocales`, `domainLocales` | *"…removed because built-in i18n Next.js features are no longer necessary in the `app` directory."* | a `[locale]` route segment |
| `basePath` | *"`basePath` has been removed. The alternative will not be part of `useRouter`. **It has not yet been implemented.**"* | ⚠️ nothing — see below |
| `asPath` | *"`asPath` has been removed because the concept of `as` has been removed from the new router."* | `usePathname` + `useSearchParams` |
| `isReady` | *"`isReady` has been removed because it is no longer necessary. During [prerendering], any component that uses the [`useSearchParams()`] hook will skip the prerendering step and instead be rendered on the client at runtime."* | nothing needed |
| `route` | *"`route` has been removed. `usePathname` or `useSelectedLayoutSegments()` provide an alternative."* | `usePathname` / `useSelectedLayoutSegments` |

🔴 **`basePath` is the one with no answer.** The guide does not say "use X instead"; it says the alternative *"has not yet been implemented."* If your legacy app reads `router.basePath` — common in white-label deployments and in apps served under a path prefix — there is no documented client-side replacement at 16.3.4. Plan to thread it through from configuration yourself rather than expecting a hook. **The documentation does not state when or whether an equivalent will land.**

⚠️ **`isReady` deserves a second read**, because its removal changes rendering, not just API surface. The stated reason is that *"any component that uses the `useSearchParams()` hook will skip the prerendering step and instead be rendered on the client at runtime."* So a component that reads search params is not prerendered. A legacy component that used `isReady` to guard against empty query params on the first render does not need the guard — but the component it lives in has also just changed how it renders, which is a performance consequence you inherit silently.

## `router.query` splits in two, and the split is not arbitrary

> *"The new `useRouter` does not return the `query` object. Search parameters and dynamic route parameters are now separate. Use the `useSearchParams` and `useParams` hooks instead."*

In `pages/`, `/posts/[id]?tab=comments` produced one object: `{ id: '5', tab: 'comments' }`. There was no way to tell which key came from the route and which from the query string.

```tsx
// ❌ pages/posts/[id].js — one bag, two sources
import { useRouter } from 'next/router';

export default function Post() {
  const { query } = useRouter();
  return <span>{query.id} · {query.tab}</span>;
}
```

```tsx
// ✅ app/posts/[id]/page.tsx — server-side, no hooks needed at all
export default async function Post({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <span>{id} · {tab}</span>;
}
```

```tsx
// ✅ app/posts/[id]/tab-switcher.tsx — client-side, when you genuinely need a hook
'use client';
import { useParams, useSearchParams } from 'next/navigation';

export function TabSwitcher() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  return <span>{params.id} · {searchParams.get('tab')}</span>;
}
```

**The migration decision hiding in that split is whether you need a hook at all.** In `pages/`, reading the URL meant `useRouter`, which meant the component was a client component by construction. In `app/`, a page receives both as props on the server. A large share of `useRouter` call sites in a legacy codebase exist only to read the URL, and those become props rather than hooks — which is how a migration actually reduces client JavaScript rather than merely relocating it.

**Router events have no direct successor either.** The guide's replacement is compositional:

> *"You can use `useSearchParams` and `usePathname` together to listen to page changes. See the [Router Events] section for more details."*

```tsx
// ✅ app/analytics.tsx — the pattern the guide points at
'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = searchParams.size ? `${pathname}?${searchParams}` : pathname;
    window.analytics?.page(url);
  }, [pathname, searchParams]);

  return null;
}
```

That is an effect on change, not a `routeChangeStart` / `routeChangeComplete` pair, so anything that depended on firing *before* a navigation — a confirmation prompt, a cleanup, an abort — is not expressible this way and needs redesigning around the interaction that triggers the navigation instead.

## `next/compat/router` — the escape hatch for shared components

This is the least-known genuinely useful thing in the migration guide, and it exists for exactly the problem a real migration has: a `components/` directory imported by both routers.

> *"To keep components compatible between the `pages` and `app` routers, refer to the [`useRouter` hook from `next/compat/router`]. This is the `useRouter` hook from the `pages` directory, but intended to be used while sharing components between routers. Once you are ready to use it only on the `app` router, update to the new [`useRouter` from `next/navigation`]."*

```tsx
// ✅ components/back-button.tsx — imported by BOTH routers during the migration
'use client';
import { useRouter as useCompatRouter } from 'next/compat/router';
import { useRouter as useAppRouter } from 'next/navigation';

export function BackButton() {
  const compatRouter = useCompatRouter(); // null when rendered under app/
  const appRouter = useAppRouter();

  const goBack = () => {
    if (compatRouter) compatRouter.back();
    else appRouter.back();
  };

  return <button onClick={goBack}>Back</button>;
}
```

⚠️ **The exact null/undefined semantics of the compat hook under the App Router are not spelled out in the migration guide**, which describes its purpose but not its return value in each router. Treat the guard above as the shape to verify against the `next/compat/router` reference for the version you ship, not as a quoted guarantee. What *is* quoted, and is the point: it exists so a shared component can be imported by both routers, and it is a transitional API — *"Once you are ready to use it only on the `app` router, update to the new `useRouter` from `next/navigation`."*

## Gotchas

**★ Symptom: a migrated component throws at runtime, or a route renders nothing, and the only clue is a message about `useRouter` outside a Pages Router context.** Cause: the file imports `useRouter` from `next/router` while living in `app/`. The import compiles, type-checks and autocompletes. Fix: change the module, add `'use client'`, and split the old `router.pathname` / `router.query` reads across the three new hooks.

```tsx
// ❌ app/nav.tsx
// import { useRouter } from 'next/router';

// ✅ app/nav.tsx
'use client';
import { useRouter, usePathname } from 'next/navigation';
```

**★ Symptom: nothing catches the wrong import in review, and it happens again next sprint.** Cause: `next/router` is a legitimate import one directory over, so it cannot be banned repo-wide. Fix: ban it *by path* with an ESLint override scoped to `app/`, so `pages/` keeps working.

```js
// eslint.config.mjs — scoped restriction, not a global ban
export default [
  {
    files: ['app/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'next/router',
          message: 'Use next/navigation in app/. next/router is Pages Router only.',
        }],
      }],
    },
  },
];
```

**★ Symptom: `router.query.id` is `undefined` in a migrated component and no error is thrown.** Cause: `useRouter` from `next/navigation` does not return `query` at all, so `router.query` is `undefined` and `undefined?.id` quietly yields `undefined`. Fix: split the read — route segments come from `useParams`, query string from `useSearchParams`.

```tsx
'use client';
import { useParams, useSearchParams } from 'next/navigation';

export function Header() {
  const { id } = useParams<{ id: string }>();
  const tab = useSearchParams().get('tab');
  return <h2>{id} · {tab}</h2>;
}
```

**★ Symptom: a component that reads `router.basePath` cannot be migrated and no replacement exists in the docs.** Cause: it was removed and, in the guide's words, the alternative *"has not yet been implemented."* Fix: stop treating it as framework state and thread it from configuration, which also makes it testable.

```tsx
// lib/base-path.ts — one source of truth you control
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// usage
import { BASE_PATH } from '@/lib/base-path';
const href = `${BASE_PATH}/settings`;
```

**★ Symptom: a shared component in `components/` breaks whichever router you did not test.** Cause: it imports one router's hook directly, so it is only valid under that router — and during a migration both routers import it. Fix: use `next/compat/router` for the transition period, and delete the compat branch when the last `pages/` consumer is gone.

**Symptom: page-view analytics stopped firing after migration, or fires twice.** Cause: `router.events` has no successor; the replacement is an effect keyed on `usePathname` and `useSearchParams`. A stale `routeChangeComplete` subscription silently never fires, and a naively written effect fires on both mount and change. Fix: the effect pattern shown above, with both values in the dependency array and no manual subscription.

**Symptom: a navigation guard — "you have unsaved changes, are you sure?" — cannot be reimplemented.** Cause: it depended on `routeChangeStart`, which fired *before* navigation and could cancel it. The `usePathname` effect fires *after*. There is no documented before-navigation hook in `next/navigation`. Fix: move the guard to the interaction that starts the navigation rather than to the router, and say plainly in review that global unsaved-changes interception is a capability the migration removes.

```tsx
'use client';
import { useRouter } from 'next/navigation';

export function GuardedLink({ href, dirty }: { href: string; dirty: boolean }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (dirty && !window.confirm('Discard unsaved changes?')) return;
        router.push(href);
      }}
    >
      Continue
    </button>
  );
}
```

**Symptom: a route that used to prerender now renders on the client, and Core Web Vitals regress.** Cause: a component in it calls `useSearchParams`, and the guide states that *"any component that uses the `useSearchParams()` hook will skip the prerendering step and instead be rendered on the client at runtime."* In `pages/` the same component was part of a single prerendered page. Fix: read search params as a prop on the server where possible, and where a client read is genuinely needed, isolate it in the smallest component so the rest of the route still prerenders.

**Symptom: `router.push` with an `as` argument no longer does what it did.** Cause: *"`asPath` has been removed because the concept of `as` has been removed from the new router."* The masking behaviour `as` provided is gone, not renamed. Fix: express the intent with the route structure instead — intercepting routes are the App Router feature for showing one route's content at another's URL — and treat any `as` usage in the legacy code as a design question rather than a parameter to port.

## Interview questions

**★ Why is importing `useRouter` from the wrong module the most common migration error, when it is such a small mistake?**
Because nothing in the normal feedback loop catches it. Both modules exist, both export a hook with the same name, both type-check, and the editor autocompletes whichever you used last — and in a mid-migration codebase, `next/router` is genuinely correct in the `pages/` files sitting next to the one you are writing. So it is not a typo that a linter can flag globally; it is a correct import in the wrong directory. It also fails late: the file compiles and only misbehaves when that component actually renders under the App Router. The durable fix is a path-scoped `no-restricted-imports` rule that bans `next/router` inside `app/` only.

**★ `router.query` gave you one object. Why did the App Router split it into `params` and `searchParams`?**
Because they are different things that happened to share a bag. `params` comes from the route's own dynamic segments and is known to the router at build time; `searchParams` comes from the query string, is arbitrary user input, and cannot be enumerated. Merging them meant a page could not tell whether `?id=5` or `/posts/5` produced `query.id`, and it forced any page reading the query string to be treated as request-time. Splitting them lets a route prerender on its `params` while still accepting `searchParams` at request time. The migration cost is real: every legacy `router.query` destructure has to be sorted into two buckets by hand, and nothing errors if you sort one wrong.

**★ Which removed `useRouter` property has no replacement, and what do you do about it?**
`basePath`. The guide removes it and says the alternative *"will not be part of `useRouter`"* and *"has not yet been implemented"* — so unlike `pathname`, `query`, `asPath` and `route`, there is no hook to move to. In practice you stop treating it as framework state and thread it from your own configuration, typically a public environment variable exported from one module. That is arguably better than the original since it is testable and explicit, but it is a code change in every consumer, and it should be identified during estimation rather than discovered mid-sprint.

**★ How do you keep a shared `components/` directory working while half your routes are on each router?**
`next/compat/router`, which the guide describes as *"the `useRouter` hook from the `pages` directory, but intended to be used while sharing components between routers."* A shared component can branch on it and fall back to `next/navigation` under the App Router, so one file serves both. It is explicitly transitional — the guide says to move to `next/navigation` once the component is App-Router-only — so the compat branch is technical debt with a scheduled deletion date, which is exactly the right shape for a migration artifact. The alternative, forking every shared component, doubles the surface you have to keep in agreement for the whole migration.

**★ A team says "we'll port `router.events` to an effect and be done". What is wrong with that?**
It works for anything that reacts *after* a navigation — analytics, scroll restoration, closing a menu — because the guide's own replacement is an effect keyed on `usePathname` and `useSearchParams`. It does not work for anything that needed to run *before* a navigation and possibly cancel it, which is what `routeChangeStart` allowed: unsaved-changes prompts, aborting in-flight requests, blocking navigation during a wizard. There is no documented before-navigation hook in `next/navigation`, so those have to move to the interaction that initiates the navigation. That is a capability reduction, and the honest thing is to name it in the migration plan rather than discover it when a product manager asks why the "unsaved changes" dialog stopped appearing.

**What does the removal of `isReady` tell you about how the App Router renders?**
More than it looks like. The stated reason is that *"any component that uses the `useSearchParams()` hook will skip the prerendering step and instead be rendered on the client at runtime."* So `isReady` is unnecessary not because the timing problem was solved but because the component is no longer prerendered at all — the framework opted it out. That is a rendering-strategy consequence hiding inside an API removal: a component that reads search params costs you prerendering for itself. It is a strong argument for reading search params as a server prop wherever possible and confining the hook to the smallest possible client component.

---

⚠️ **Position note for the coordinator:** this chunk and its sibling carry `sidebar_position: 20`/`21`/`22` because positions 9–12 in this directory were already taken by `03`, `03b`, `04` and `04b` when they were written. They belong immediately after `02d`. Renumbering them — and cascading `03` onward — requires editing files this session does not own.

---

← [The two APIs with no clean successor](02d-the-two-apis-with-no-clean-successor.md) · [Chapter index](01-explanation.md) · Next → [The document shell, metadata and styles](02f-the-document-shell-metadata-and-styles.md)
