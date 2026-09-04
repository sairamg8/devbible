---
title: "The document shell is where a migration stops being mechanical: `next/head` becomes a data export rather than a component, the global-CSS restriction is lifted rather than moved, and every provider that wrapped your whole tree needs a `'use client'` file it never had before"
sidebar_label: "02f · The shell, metadata and styles"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to migrate from Pages to the App Router](https://nextjs.org/docs/app/guides/migrating/app-router-migration) (`version: 16.3.4`, `lastUpdated: 2026-08-25`), Steps 2, 3 and 7 and the *Upgrading New Features* section on `next/script` and `next/font`.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified; **no sandbox run**.

**Two files that every Pages Router codebase has — `_app.tsx` and `_document.tsx` — collapse into one, and the collapse is not a merge. `next/head`, a component you rendered conditionally inside a tree, becomes `metadata`, a value you export from a module. Global stylesheets stop being restricted to one file, which sounds like a relaxation and is actually a new way to create load-order bugs. And every React Context provider that used to wrap `<Component />` in `_app.tsx` now needs a dedicated `'use client'` file, because the root layout is a Server Component. None of these are hard individually. Together they are why the first App Router route takes a week and the second takes an hour.**

## `_app.tsx` + `_document.tsx` → one root layout

> *"`pages/_app.js` and `pages/_document.js` have been replaced with a single `app/layout.js` root layout."*

> *"The `app` directory **must** include a root layout."* · *"The root layout must define `<html>`, and `<body>` tags since Next.js does not automatically create them"* · *"The root layout replaces the `pages/_app.tsx` and `pages/_document.tsx` files."*

🔴 **"Replaces" is about the destination, not the schedule.** The same guide is explicit that both files stay on disk for the whole migration:

> *"If you have an existing `_app` or `_document` file, you can copy the contents (e.g. global styles) to the root layout (`app/layout.tsx`). Styles in `app/layout.tsx` will *not* apply to `pages/*`. You should keep `_app`/`_document` while migrating to prevent your `pages/*` routes from breaking. Once fully migrated, you can then safely delete them."*

The sequencing consequence is covered in [02](02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md); what belongs here is *what actually moves out of `_document`*:

- **`<html>` and `<body>`** — previously supplied by `_document`, now written by hand in the root layout, which is why a first-attempt layout that omits `<body>` produces a page with no content wrapper.
- **`beforeInteractive` scripts** — *"Move any `beforeInteractive` scripts you previously included in `_document.js` to a [root layout], such as `app/layout.tsx` or `app/[locale]/layout.tsx`."*
- **`<head>` contents** — these do not move to the layout as markup at all; they become the Metadata API, below.

## `next/head` → the Metadata API

> *"In the `pages` directory, the `next/head` React component is used to manage `<head>` HTML elements such as `title` and `meta`. In the `app` directory, `next/head` is replaced with the new [built-in SEO support]."*

```tsx
// ❌ pages/index.tsx — a component, rendered inside the tree
import Head from 'next/head';

export default function Page() {
  return (
    <>
      <Head>
        <title>My page title</title>
      </Head>
    </>
  );
}
```

```tsx
// ✅ app/page.tsx — a value, exported from the module
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Page Title',
};

export default function Page() {
  return <main>Body content</main>;
}
```

**The change from component to export is the migration difficulty, not the syntax.** `next/head` was rendered, so anything in scope could feed it — a prop, state, a value computed halfway down the tree, a conditional. `metadata` is a module-level export evaluated before render, so it cannot see component state, cannot be conditional on anything the component computed, and cannot live in a child component. Every legacy `<Head>` that consumed a prop is a migration to `generateMetadata`, not to `metadata`, and every `<Head>` rendered from a deeply nested component has to move up to its route segment.

That is a genuine capability change worth stating plainly: **in `app/`, only a `layout` or a `page` can contribute metadata.** A shared component that rendered its own `<Head>` — a common pattern for widgets that set their own `og:image` — has no equivalent and its metadata has to be hoisted to every route that uses it.

## `next/script` and `next/font` — the parts that differ per router

`next/script` works in both directories, which makes its differences easy to miss:

> *"The experimental `worker` strategy does not yet work in `app` and scripts denoted with this strategy will either have to be removed or modified to use a different strategy (e.g. `lazyOnload`)."*

> *"`onLoad`, `onReady`, and `onError` handlers will not work in Server Components so make sure to move them to a [Client Component] or remove them altogether."*

```tsx
// ❌ this cannot work in a Server Component — the handler is a function prop
// <Script src="https://cdn.example.com/widget.js" onLoad={() => init()} />

// ✅ app/widget-loader.tsx — the handler forces a client boundary
'use client';
import Script from 'next/script';

export function WidgetLoader() {
  return (
    <Script
      src="https://cdn.example.com/widget.js"
      strategy="lazyOnload"
      onLoad={() => window.ExampleWidget?.init()}
      onError={(e) => console.error('widget failed', e)}
    />
  );
}
```

Fonts have a rule that is easy to read past because it names both routers in one sentence:

> *"While [inlining CSS] still works in `pages`, it does not work in `app`. You should use [`next/font`] instead."*

So a codebase serving fonts by inlined CSS keeps working on its unmigrated routes and silently loses that optimization on migrated ones. During the coexistence period both mechanisms are live, which means the same font can be loaded twice by two different mechanisms on two routes — visible as a flash on the cross-router hard navigation described in [02](02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md).

## Global CSS: a restriction lifted, not relocated

> *"In the `pages` directory, global stylesheets are restricted to only `pages/_app.js`. With the `app` directory, this restriction has been lifted. Global styles can be added to any layout, page, or component."*

**Read that as a warning rather than a feature.** The `_app.js` restriction was annoying and it was also a guarantee: exactly one file could import global CSS, so load order was trivially knowable and a conflicting global rule had exactly one place to come from. Lifting it means a global stylesheet imported by a leaf component now participates in ordering that depends on the component tree.

The migration-safe posture is to keep the old discipline voluntarily:

```tsx
// ✅ app/layout.tsx — keep global CSS in exactly one place, as if the rule still applied
import '../styles/globals.css';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Tailwind needs its content globs widened for the coexistence period, and the `pages` glob must stay:

```js
// tailwind.config.js — BOTH globs, for as long as both routers exist
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}', // <-- Add this line
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};
```

## Providers: the pattern that decides your client bundle

> *"If you are using any React Context providers, they will need to be moved to a [Client Component]."*

That sentence is one line in the guide and is the largest single architectural decision in the migration, because a provider wraps the whole tree by definition. Done naively, `'use client'` at the top of the root layout drags every route into the client bundle — see [ch3 · everything is a Server Component](../03-server-components-vs-client-components/01-default-architecture-everything-is-a-server-component-rsc.md).

```tsx
// ✅ app/providers.tsx — the boundary is here, and only here
'use client';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class">{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
```

```tsx
// ✅ app/layout.tsx — stays a Server Component; `children` never crosses the boundary
import '../styles/globals.css';
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

**Why this works and the naive version does not:** `children` is passed as a prop from a Server Component, so it is rendered on the server and handed to `Providers` already-rendered. `Providers` being a Client Component makes *itself* client code, not everything it wraps. A `'use client'` on `layout.tsx` instead would make the layout's whole import graph client code.

⚠️ **The library that cannot do this is the one to identify before you commit to a date.** A provider that must run on the client *and* whose children need to call its hooks forces every consumer across the boundary, one component at a time. That is not a translation, it is an adoption decision about the library, and it is the most common reason a migration stalls on a specific section.

## Gotchas

**★ Symptom: every unmigrated `pages/*` route loses its styling the day the first App Router route ships.** Cause: the global CSS import was *moved* from `_app.tsx` to `app/layout.tsx` rather than copied, and *"Styles in `app/layout.tsx` will not apply to `pages/*`."* Fix: both files import it, for the whole migration.

```tsx
// pages/_app.tsx — the import stays until the last pages/ route is deleted
import '../styles/globals.css';
```

**★ Symptom: a page title set from a prop disappears after migration.** Cause: `<Head>` was rendered inside the component and could see props; `metadata` is a module-level export evaluated before render and cannot. Fix: use `generateMetadata`, which receives the route's params.

```tsx
// app/posts/[id]/page.tsx
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await fetch(`https://api.example.com/posts/${id}`).then((r) => r.json());
  return { title: post.title };
}

export default async function Post({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <article>{id}</article>;
}
```

**★ Symptom: a shared widget that set its own `og:image` via `next/head` no longer sets anything, silently.** Cause: only a `layout` or `page` can contribute metadata in `app/`; a `<Head>` in a nested component has no equivalent. Fix: hoist the metadata to every route segment that renders the widget — and if that is many routes, export a shared metadata object rather than duplicating the literal.

```tsx
// lib/widget-metadata.ts
import type { Metadata } from 'next';
export const widgetMetadata: Metadata = {
  openGraph: { images: ['https://cdn.example.com/widget-og.png'] },
};

// app/pricing/page.tsx
export { widgetMetadata as metadata } from '@/lib/widget-metadata';
```

**★ Symptom: `'use client'` on the root layout, and now every route ships the whole app to the browser.** Cause: providers were added to the layout directly instead of to a dedicated client file. Fix: the provider is the Client Component and `children` is a prop, so the boundary stops at the provider — the two-file pattern above.

**★ Symptom: a `<Script>` with `onLoad` throws or silently never fires after migration.** Cause: *"`onLoad`, `onReady`, and `onError` handlers will not work in Server Components."* A function prop cannot cross the boundary. Fix: wrap the script in a `'use client'` component, as shown above, or drop the handler if it only existed for logging.

**Symptom: a script with `strategy="worker"` stops working in `app/` and there is no error explaining why.** Cause: *"The experimental `worker` strategy does not yet work in `app`."* Fix: change the strategy — the guide names `lazyOnload` — and record that the worker offload is a capability the migration removes for that script.

```tsx
<Script src="https://cdn.example.com/heavy.js" strategy="lazyOnload" />
```

**Symptom: Tailwind classes used only in `app/` are missing from the built CSS.** Cause: `tailwind.config.js` still scans only `./pages/**` and `./components/**`. The build succeeds; the page is unstyled. Fix: add the `./app/**` glob and keep the `./pages/**` one for the coexistence period.

**Symptom: a font flashes or re-downloads when a user crosses the router seam.** Cause: `pages/` routes still use inlined font CSS, which *"does not work in `app`"*, so migrated routes load the same family through `next/font` instead. Both mechanisms are live during coexistence and neither knows about the other. Fix: migrate the font loading to `next/font` on **both** routers early — `next/font` is supported in `pages` too — so the seam does not change font delivery.

**Symptom: a global CSS rule that behaved predictably in `pages/` now applies inconsistently across `app/` routes.** Cause: the one-file restriction was lifted, and someone imported a global stylesheet from a component, so its position in the cascade now depends on where that component sits in the tree. Fix: keep the discipline the framework no longer enforces — global CSS is imported in `app/layout.tsx` and nowhere else; everything component-scoped uses CSS Modules.

## Interview questions

**★ Why does `next/head` becoming `metadata` change more than the syntax?**
Because it changes what can produce it. `next/head` was a component rendered inside the tree, so any value in scope could feed it — props, state, a computation halfway down, a conditional branch. `metadata` is a module-level export evaluated before render, so it sees none of that. Anything derived from route data moves to `generateMetadata`, which receives the params; anything derived from component state has nowhere to go at all. And only a `layout` or a `page` can contribute metadata, so a shared component that set its own `<Head>` has no equivalent and its tags must be hoisted into every route that renders it. That last case is the one that ships silently broken, because nothing errors — the tags simply are not there.

**★ The docs say the global-CSS restriction has been "lifted". Why might you not want to use that freedom during a migration?**
Because the restriction was also a guarantee. With exactly one file permitted to import global CSS, load order was knowable and any conflicting global rule had one possible origin. Lifting it means a stylesheet imported by a leaf component participates in an ordering that depends on the component tree, and during a migration the tree is changing weekly. The cheap discipline is to behave as though the rule still applied — global CSS in `app/layout.tsx` only, everything else in CSS Modules — and revisit it once the tree is stable. You lose nothing you were using in `pages/` anyway.

**★ Walk me through migrating a `_app.tsx` that wraps everything in three context providers.**
The providers cannot go in the root layout directly, because the layout is a Server Component and *"React Context providers … will need to be moved to a Client Component."* So I create one `app/providers.tsx` marked `'use client'` that nests all three and takes `children` as a prop, and the root layout renders `<Providers>{children}</Providers>`. The critical detail is that `children` is passed *as a prop from the server*, so it is rendered on the server and handed over already-rendered — the client boundary stops at `Providers` rather than swallowing every route. Putting `'use client'` on `layout.tsx` instead would look equivalent and would push the entire application into the client bundle. And `_app.tsx` stays on disk with its own copy of the providers until the last `pages/` route is gone.

**★ What is the font trap during the coexistence period?**
That the two routers load fonts by different mechanisms and neither is aware of the other. Inlined font CSS *"still works in `pages`"* but *"does not work in `app`"*, so unmigrated routes keep the old delivery while migrated routes need `next/font`. A user crossing the router seam — already a hard navigation with no prefetch — also changes font delivery mechanism, which is visible as a flash. Since `next/font` is supported in both directories, the fix is to migrate font loading on both routers early, decoupling it from the route migration entirely.

**Which of the shell changes is most likely to ship a silent regression, and why?**
Metadata from nested components. The CSS problems are visible immediately, the provider mistake shows up as a bundle-size or interactivity change someone notices, and the `<Script>` handler failures throw or are obviously inert. But a `<Head>` that lived in a shared component and set `og:image` or a canonical URL simply produces nothing after migration, with no error, no type failure and no visual difference in the browser — you find out when a link preview breaks or when search traffic moves. That is why an inventory of every `next/head` usage, grouped by whether it sat in a page or in a component, is worth doing before the first route is migrated rather than after.

---

← [The two routers and the hooks](02e-the-two-routers-and-the-client-side-hooks.md) · [Chapter index](01-explanation.md) · Next → [Codemods, cross-router traps and when to stop](02g-codemods-cross-router-traps-and-when-to-stop.md)
