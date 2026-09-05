---
title: "A Pages-to-App migration is a sequencing problem, not a rewrite: the two routers are designed to run side by side, the seam between them is a hard navigation, and the precedence rule everyone quotes is not in the 16.3.4 documentation"
sidebar_label: "02 · Pages → App migration"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to migrate from Pages to the App Router](https://nextjs.org/docs/app/guides/migrating/app-router-migration) (docs header `version: 16.3.4`, `lastUpdated: 2026-08-25`) and [Project structure and organization](https://nextjs.org/docs/app/getting-started/project-structure) (`lastUpdated: 2026-07-21`). Three candidate sources **404'd** and are named below rather than cited. `next` is not installed in this checkout, so **no probe** was possible.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified; **no sandbox run**.

**The business will not pause for your migration, and it does not have to: the App Router was built to run inside a Pages Router codebase, one route at a time, for as long as you need. What kills these projects is not the translation of any individual API — those are mechanical and this topic gives every one of them — it is sequencing. Migrate a shared layout before its leaves and you rewrite it twice. Migrate the highest-traffic route first and you learn RSC on the route that cannot afford a rollback. Leave `_app.tsx` behind on day one and every unmigrated page loses its global styles. This chunk settles what coexistence actually guarantees, what the documentation genuinely says about a path defined in both routers (less than you have been told), and the order to move in. The translations themselves are the six chunks that follow: request-time data in [02b](02b-translating-the-data-fetching-contracts.md), build-time data in [02c](02c-translating-build-time-data.md), the two APIs with no clean successor in [02d](02d-the-two-apis-with-no-clean-successor.md), the routers and hooks in [02e](02e-the-two-routers-and-the-client-side-hooks.md), the shell and styles in [02f](02f-the-document-shell-metadata-and-styles.md), and codemods, cross-router traps and when to stop in [02g](02g-codemods-cross-router-traps-and-when-to-stop.md).**

## Coexistence is a designed property, and it is what makes incremental migration possible

This is not a tolerated hack. The guide states it twice, in two different registers:

> *"The new Router is available in the `app` directory and co-exists with the `pages` directory."*

> *"We recommend reducing the combined complexity of these updates by breaking down your migration into smaller steps. The `app` directory is intentionally designed to work simultaneously with the `pages` directory to allow for incremental page-by-page migration."*

And the corollary that removes the deadline pressure:

> *"Upgrading to Next.js 13 does **not** require using the App Router."*

— [app-router-migration](https://nextjs.org/docs/app/guides/migrating/app-router-migration), 16.3.4.

So the target state of *"every route on the App Router"* is a choice, not an obligation. A codebase can sit at 70% migrated indefinitely and be fully supported. [02g](02g-codemods-cross-router-traps-and-when-to-stop.md) argues when that is the right answer.

## 🔴 The precedence rule — what I can and cannot confirm at 16.3.4

You will be told, by StackOverflow, by an LLM, and by colleagues who read the Next.js 13 docs, that **the App Router takes priority over the Pages Router** and that conflicting routes across the two directories produce a build-time error. That sentence really did exist in the Next.js 13 routing documentation.

⚠️ **I could not confirm it in the Next.js 16.3.4 documentation, and I am not going to quote it as though I had.** Specifically:

- It is **absent** from the 16.3.4 migration guide, which discusses coexistence at length across seven steps and a dedicated *"Using App Router together with Pages Router"* section, and never once mentions precedence or a conflict error.
- It is **absent** from `project-structure` at 16.3.4, whose top-level folder table lists `app` → *"App Router"* and `pages` → *"Pages Router"* with no note attached to either.
- `https://nextjs.org/docs/messages/conflicting-app-page-error` returns *"The URL `/docs/messages/conflicting-app-page-error` does not exist."*
- `https://nextjs.org/docs/pages` and the archived `https://nextjs.org/docs/13/app/building-your-application/routing` both 404.

**What that means for you, operationally, is stronger than the rule you were looking for.** If the documentation for the version you ship does not specify what happens when `pages/about.tsx` and `app/about/page.tsx` both exist, then the outcome is *unspecified for your deployment*, and an unspecified routing outcome is not something to design a migration around. The rule to encode in review instead:

🔴 **A path is never defined in both directories, not even for one commit.** The `app/` route and the deletion of the `pages/` route are the same commit. Not the same PR — the same commit, so that a revert restores a consistent tree.

```bash
# A pre-commit / CI guard. Emits every path defined by both routers.
# Compares `pages/foo/bar.tsx` -> /foo/bar against `app/foo/bar/page.tsx` -> /foo/bar
set -euo pipefail

pages_routes=$(find pages -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.jsx' -o -name '*.js' \) \
  ! -path 'pages/api/*' ! -name '_*' \
  | sed -e 's#^pages##' -e 's#\.\(tsx\|ts\|jsx\|js\)$##' -e 's#/index$##' \
  | sed -e 's#^$#/#' | sort -u)

app_routes=$(find app -type f -name 'page.*' \
  | sed -e 's#^app##' -e 's#/page\.\(tsx\|ts\|jsx\|js\)$##' \
  | sed -e 's#^$#/#' | sort -u)

conflicts=$(comm -12 <(echo "$pages_routes") <(echo "$app_routes"))

if [ -n "$conflicts" ]; then
  echo "Route defined by BOTH routers:"
  echo "$conflicts"
  exit 1
fi
```

That script is worth more than the precedence rule would have been, because it fails in CI on the commit that introduced the ambiguity rather than at whatever runtime the ambiguity happens to resolve to.

⚠️ **Note for anyone citing this page** — including [ch19 · decision trees](../19-capstone-decision-trees-and-outlook/01-explanation.md), which links here for exactly this rule: cite it as *"unspecified in the 16.3.4 docs; enforced by convention"*, not as *"app wins"*. If a later docs revision states the rule, this section is where it lands.

## The seam that is documented, and it is the one that hurts

Precedence is not the coexistence caveat that shows up in your metrics. This is:

> *"When navigating between routes served by the different Next.js routers, there will be a hard navigation. Automatic link prefetching with `next/link` will not prefetch across routers."*

— [app-router-migration](https://nextjs.org/docs/app/guides/migrating/app-router-migration), 16.3.4.

Read both halves. **A hard navigation** means a full document request: the client-side router does not handle it, the JavaScript context is torn down, client state is lost, and the user pays a fresh HTML round trip. **No prefetch across routers** means the usual `next/link` viewport prefetch that hides latency does not fire on those links, so the hard navigation is also an *unwarmed* one.

Two consequences that decide your migration order:

1. **Every cross-router link is a latency cliff, and the number of them is a function of how you cut.** Migrating a leaf route out of a section leaves one seam. Migrating a route in the *middle* of a user journey puts two seams in one funnel.
2. **Client state does not survive the seam.** A partially-filled form, an open cart drawer, a client-side auth token held only in memory — all gone. If any of those exist, the seam must not fall inside that flow.

**So you cut along seams that already exist.** The boundary between `/marketing/*` and `/app/*` is a place users already accept a full page load. The boundary between step 2 and step 3 of a checkout is not.

## The order that works, and why each rule is in that order

The guide gives seven numbered steps — create `app/`, root layout, `next/head`, pages, routing hooks, data fetching, styling — and they are correct for a tutorial project. For a legacy codebase they are underspecified in one crucial way: they say *how* to migrate a page and not *which page*. That is the whole problem.

**1 · Leaf routes before layouts.** A `layout.tsx` is a contract that every route beneath it must satisfy. Write it before you have migrated anything beneath it and you are guessing at the contract; you will discover the third route needs a different data shape and rewrite the layout. Migrate three or four leaves first, notice what they actually share, *then* hoist. Nested layouts are the App Router's headline feature and they are the last thing you should reach for.

**2 · Low-traffic before high-traffic.** The first route you migrate is where you learn that pages are Server Components by default, that `useRouter` moved modules, and that your analytics provider needs a `'use client'` wrapper. Learn that on `/settings/notifications`, not on `/`.

**3 · Static before dynamic before authenticated.** A marketing page has no session, no personalization and no cache correctness question. An authenticated dashboard has all three plus the caching model, which is the part of the App Router that most often ships a bug. Order the routes by how many novel mechanisms each one forces you to get right at once.

**4 · One route per PR, shipped and observed before the next.** Not one *section*. The failure mode of batching is that you deploy eight migrated routes, error rates move, and you cannot attribute it. Ship one, watch it for a real traffic cycle, then take the next.

**5 · Read-only routes before anything that writes.** A migrated GET page that renders wrong is a visual bug. A migrated mutation that writes wrong is a data incident. Server Actions are a second new mechanism stacked on the first; do not learn both on the same route.

**6 · The root layout goes in first and stays thin.** It is required — *"The `app` directory **must** include a root layout"* — so it is unavoidably step 2. But everything you put in it applies to every future App Router route and cannot be reconsidered cheaply. Global stylesheet, `<html>` and `<body>` tags, providers. Nothing else.

## The root layout does not replace `_app.tsx` until the last route is gone

This is the single most common way a migration breaks production on day one, and the guide is unambiguous about it:

> *"If you have an existing `_app` or `_document` file, you can copy the contents (e.g. global styles) to the root layout (`app/layout.tsx`). Styles in `app/layout.tsx` will *not* apply to `pages/*`. You should keep `_app`/`_document` while migrating to prevent your `pages/*` routes from breaking. Once fully migrated, you can then safely delete them."*

**"Copy", not "move".** For the entire duration of the migration you maintain two shells and they must be kept in agreement:

```tsx
// ❌ pages/_app.tsx — KEEP THIS FILE. It still serves every unmigrated route.
import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { ThemeProvider } from '../components/ThemeProvider';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
```

```tsx
// ✅ app/layout.tsx — the same globals, declared again for app/ routes.
import type { ReactNode } from 'react';
import '../styles/globals.css';
import { ThemeProvider } from '../components/ThemeProvider'; // must be 'use client'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

Note what the guide says about the tags, because it differs from the Pages Router where `_document.tsx` supplied them:

> *"The root layout must define `<html>`, and `<body>` tags since Next.js does not automatically create them"*

And the provider constraint, which [02e](02e-the-two-routers-and-the-client-side-hooks.md) develops:

> *"If you are using any React Context providers, they will need to be moved to a [Client Component]."*

## The guide's own preamble is stale, and you should not follow it

The *"Upgrading"* section at the top of the migration guide is still written for the Next.js 12 → 13 jump. It says:

> *"The minimum Node.js version is now **v18.17**."*

> *"Update to the latest Next.js version (requires 13.4 or greater)"*

⚠️ **Neither is your floor.** The 16.3.4 installation documentation puts the minimum at **Node.js 20.9** and TypeScript **5.1.0** — see [ch1 · versioning and support policy](../01-introduction-to-next-js/01-evolution-from-pages-router-to-app-router-why-app-router-is.md) for the LTS tiers. Take the *steps* from the migration guide and the *floors* from the installation page; the guide's preamble is a historical artifact that survived the docs restructure.

## Gotchas

**★ Symptom: unmigrated `pages/*` routes lose all styling the moment the first App Router route ships.** Cause: `_app.tsx` was deleted (or its `import '../styles/globals.css'` removed) on the assumption that `app/layout.tsx` replaced it. It does not, and the docs say so: *"Styles in `app/layout.tsx` will not apply to `pages/*`."* Fix: restore the import in both shells and treat the duplication as intentional for the duration.

```tsx
// pages/_app.tsx — the import stays until the last pages/ route is deleted
import '../styles/globals.css';
```

**★ Symptom: a user loses their half-filled form when they click a link in the nav.** Cause: that nav link crosses the router seam, and *"there will be a hard navigation."* The JavaScript context is destroyed. Fix: do not let the seam fall inside a stateful flow. Either migrate the whole flow in one PR, or persist the state somewhere that survives a document load.

```tsx
// components/DraftForm.tsx — 'use client'
// Survive a hard navigation across the router seam.
'use client';
import { useEffect, useState } from 'react';

export function DraftForm({ draftKey }: { draftKey: string }) {
  const [body, setBody] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(draftKey);
    if (saved) setBody(saved);
  }, [draftKey]);

  useEffect(() => {
    sessionStorage.setItem(draftKey, body);
  }, [draftKey, body]);

  return <textarea value={body} onChange={(e) => setBody(e.target.value)} />;
}
```

**★ Symptom: navigation between two specific pages feels slow, and only those two.** Cause: they are on different routers, so *"Automatic link prefetching with `next/link` will not prefetch across routers."* The link is unwarmed and the navigation is a full document request. Fix: there is no prefetch flag that crosses the seam — the fix is to move the pair onto the same router, which means promoting that route up your migration queue. Measure the seams before you pick the order.

**Symptom: a revert of the migration PR leaves the route 404ing or serving stale content.** Cause: the `app/` route was added in one commit and the `pages/` route deleted in another, so a partial revert produces a tree that never existed in review. Fix: one commit contains both halves.

```bash
git add app/settings/notifications/page.tsx
git rm pages/settings/notifications.tsx
git commit -m "migrate /settings/notifications to app router"
```

**Symptom: the migration stalls after the root layout because every route now "needs" the shared layout redesigned first.** Cause: rule 1 was inverted — a layout was treated as the prerequisite for its leaves rather than the distillation of them. Fix: migrate leaves with their chrome duplicated inline, accept the duplication for a few PRs, and hoist to `app/<section>/layout.tsx` once three routes agree on what is shared.

**Symptom: the first migrated route is the homepage, and the team spends two weeks on it.** Cause: `/` is usually the most-linked, most-cached, most-instrumented and most-personalized route in the codebase — every novel mechanism at once, with the highest rollback cost. Fix: pick a route with no session, no personalization and low traffic. The homepage is one of the last routes to move, not the first.

**Symptom: `app/layout.tsx` grows into a second `_app.tsx` and now every App Router route is a Client Component.** Cause: providers were added to the root layout without thinking about the boundary, and a `'use client'` at the top of a provider file pulls its whole subtree in the moment it wraps `children` — see [ch3 · everything is a Server Component](../03-server-components-vs-client-components/01-default-architecture-everything-is-a-server-component-rsc.md). Fix: the provider is a Client Component, but it receives `children` as a prop rather than importing them, so its children stay on the server.

```tsx
// app/providers.tsx
'use client';
import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider attribute="class">{children}</ThemeProvider>;
}
```

```tsx
// app/layout.tsx — Providers is a Client Component, but `children` is not.
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Symptom: someone quotes "the App Router takes priority" in a design doc and the reviewer cannot find it.** Cause: the sentence is from the Next.js 13 documentation and is not present in the 16.3.4 pages checked above. Fix: cite the coexistence sentences, which are current, and enforce non-overlap with the CI guard rather than relying on a resolution rule your version does not document.

## Interview questions

**★ Why can the App Router and the Pages Router run in the same application at all, and what is the cost?**
Because they are two separate routers over two separate directories, resolved by the same server, and the `app` directory was *"intentionally designed to work simultaneously with the `pages` directory."* Each route belongs to exactly one of them and is rendered by that router's pipeline. The cost is the seam: a navigation between routes served by different routers is a hard navigation — a full document request, client state discarded — and `next/link` will not prefetch across it, so it is also unwarmed. A second, quieter cost is bundle duplication while both routers are live, which [02g](02g-codemods-cross-router-traps-and-when-to-stop.md) covers.

**★ What happens if the same URL path is defined in both `pages/` and `app/`?**
The honest answer, and the one that shows you checked: the Next.js 16.3.4 documentation I could reach does not specify it. The migration guide covers coexistence extensively without mentioning precedence, `project-structure` does not attach a note to either directory, and `/docs/messages/conflicting-app-page-error` does not exist. The "App Router takes priority, conflicts are a build-time error" formulation comes from the Next.js 13 docs. So the engineering answer is that you never allow it — the commit that adds the `app/` route deletes the `pages/` route, and CI fails on any overlap. If an interviewer wants "app wins", say that it was the documented v13 behaviour and that you would not build a migration plan on an unverified resolution rule.

**★ You have 200 routes and one quarter. What is your sequencing?**
Order by novelty and blast radius, not by directory. First pass: every route with no session, no personalization and no writes — usually marketing, docs, legal. Those teach the team RSC with a trivial rollback. Second pass: authenticated read-only routes, which introduce `cookies()`/`headers()` and the caching model. Third: routes with mutations, which add Server Actions. Within each pass, leaves before layouts, and hoist a `layout.tsx` only once three routes have independently demonstrated what they share. One route per PR, observed through a full traffic cycle. And explicitly plan to *not finish* — see [02g](02g-codemods-cross-router-traps-and-when-to-stop.md).

**★ Why is migrating a shared layout early a trap?**
Because a layout is a contract inferred from its children, and at the moment you write it you have no migrated children to infer from. You will encode the assumptions of whichever page you had in mind, then discover route three needs different data or different chrome, and rewrite it — except now three routes depend on it, so the rewrite is a multi-route change rather than a single-file one. Duplicating chrome across three leaf routes for a fortnight is cheap; rewriting a layout that three routes already trust is not.

**★ Your team wants to delete `_app.tsx` in the first migration PR "to avoid two sources of truth". What do you say?**
That the two sources of truth are load-bearing until the last `pages/` route is gone, and that the docs instruct exactly this: *"You should keep `_app`/`_document` while migrating to prevent your `pages/*` routes from breaking."* Global styles imported in `app/layout.tsx` do not reach `pages/*`. Deleting `_app.tsx` on day one unstyles every route you have not migrated yet, which is most of them. The drift risk is real and the mitigation is a lint rule or a review checklist that both shells import the same globals — not deletion.

**★ Why does the migration guide's "minimum Node.js version is now v18.17" not apply to you?**
Because that sentence is in the guide's *Upgrading* preamble, which is still written for the Next.js 12 → 13 upgrade and survived the docs restructure unchanged. The floor for the version you are actually installing comes from the 16.3.4 installation page: Node **20.9** and TypeScript **5.1.0**. It is a good instance of a general habit — take procedure from a guide, take version facts from the reference page for the version you ship.

**Why is "one route per PR" stricter than "one section per PR", given the review overhead?**
Because the value of the cadence is attribution, not review size. If eight routes ship together and your error rate or LCP moves, you have eight candidate causes and a revert that undoes seven working migrations to investigate one. With one route you compare that route's metrics before and after against unchanged siblings, and a revert costs one route. The overhead is real; it buys you a signal that batching destroys.

---

← [Micro-frontends and multi-zone architectures](01-micro-frontends-and-multi-zone-architectures-for-decoupled-t.md) · [Chapter index](01-explanation.md) · Next → [Translating request-time data](02b-translating-the-data-fetching-contracts.md)
