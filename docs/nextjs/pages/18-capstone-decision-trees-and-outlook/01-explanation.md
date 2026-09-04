---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 18 overview"
---

# ▲ Capstone, Decision Trees, and Outlook

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  



> **Source:** current project content kept under exact syllabus title

## 1. Under-The-Hood Mechanics

Next.js supports `app/` and `pages/` **coexisting in the same project** specifically to make this an incremental migration rather than a big-bang rewrite (see [file conventions](../02-routing-and-navigation/01-file-system-routing-pagetsx.md) and the [migration roadmap](../17-advanced-ecosystem-topics/02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md) for the coexistence caveats this recipe builds on). This means you can migrate one route, ship it, verify it, and move to the next — the rest of the app keeps working unmodified on `pages/` throughout.

🔴 **Do not rely on a precedence rule for a path defined in *both* directories.** The familiar sentence "the App Router takes priority over the Pages Router" is from the Next.js 13 documentation and is **not present in the 16.3.4 docs** — see [ch17 · the precedence rule](../17-advanced-ecosystem-topics/02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md), which checked at source and supplies a CI guard. This recipe never needs it: the commit that adds an `app/` route **deletes** the `pages/` route it replaces, so no path is ever defined twice. The documented caveat that does affect this recipe is different and real — **navigating between routes served by the two routers is a hard navigation, and `next/link` will not prefetch across them.**

The migration is really four separate, mostly-independent translations happening per route:

```text
pages/products/[id].js                          app/products/[id]/page.tsx
├── getStaticProps           ──translates to──►  Server Component body: `await fetch(...)` directly
├── getStaticPaths           ──translates to──►  generateStaticParams()
├── getServerSideProps       ──translates to──►  Server Component body (dynamic APIs make it dynamic automatically)
└── export default Page      ──translates to──►  export default async function Page(...)

pages/_app.js                ──translates to──►  app/layout.tsx (root layout)
pages/_document.js           ──translates to──►  app/layout.tsx's <html>/<body> + the Metadata API
```

### Why This Isn't a Mechanical Find-and-Replace
The App Router's data model is fundamentally different, not just renamed: Pages Router functions **return props to a separate component**; App Router Server Components **fetch inline and render in the same function**. A page that used `getServerSideProps` for auth-gating plus three parallel `Promise.all`-batched calls needs that logic re-expressed as plain `await`s inside the component — usually simpler, but not a search-and-replace.

---

## 2. Real-World Engineering Scenario

**Scenario**: An E-Commerce Site Migrating Its Highest-Traffic, Simplest Routes First.
Rather than attempting the whole site at once, the team picks a migration order by risk and value: static marketing pages (`/about`, `/pricing` — no data fetching, near-zero risk) first to validate the App Router build/deploy pipeline works in this project, then the product listing page (`getStaticProps` + ISR — moderate complexity, high traffic, big perf win from streaming), leaving the most complex page (a `getServerSideProps`-driven checkout flow with cookie-based auth and multiple sequential API calls) for last, once the team has migration experience on lower-stakes routes.

---

## 3. Production-Grade Migration Sequence

### Step 1 — Static page with ISR: `getStaticProps` + `getStaticPaths` → Server Component

```javascript
// BEFORE: pages/products/[id].js
export async function getStaticPaths() {
  const products = await fetch('https://api.acme.com/products/ids').then((r) => r.json());
  return {
    paths: products.map((p) => ({ params: { id: p.id } })),
    fallback: 'blocking', // params NOT pre-rendered are generated on-demand, then cached
  };
}

export async function getStaticProps({ params }) {
  const product = await fetch(`https://api.acme.com/products/${params.id}`).then((r) => r.json());
  if (!product) return { notFound: true };
  return { props: { product }, revalidate: 3600 };
}

export default function ProductPage({ product }) {
  return <ProductView product={product} />;
}
```

```tsx
// AFTER: app/products/[id]/page.tsx
import { notFound } from 'next/navigation';

// getStaticPaths' path list -> generateStaticParams()
export async function generateStaticParams() {
  const products = await fetch('https://api.acme.com/products/ids').then((r) => r.json());
  return products.map((p: { id: string }) => ({ id: p.id }));
}

// fallback: 'blocking' equivalent — params NOT returned above still render on-demand & cache,
// because dynamicParams defaults to true. Set `export const dynamicParams = false` for the
// fallback: false equivalent (unlisted params 404 instead of rendering on-demand).

async function getProduct(id: string) {
  const res = await fetch(`https://api.acme.com/products/${id}`, {
    next: { revalidate: 3600 }, // getStaticProps' `revalidate` -> next.revalidate on the fetch itself
  });
  if (res.status === 404) return null;
  return res.json();
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound(); // getStaticProps' `{ notFound: true }` -> calling notFound()

  return <ProductView product={product} />;
}
```

### Step 2 — Dynamic, auth-gated page: `getServerSideProps` → Server Component

```javascript
// BEFORE: pages/dashboard.js
export async function getServerSideProps({ req, res }) {
  const token = req.cookies.session_token;
  if (!token) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  const dashboardData = await fetch('https://api.acme.com/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  return { props: { dashboardData } };
}

export default function Dashboard({ dashboardData }) {
  return <DashboardView data={dashboardData} />;
}
```

```tsx
// AFTER: app/dashboard/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const token = (await cookies()).get('session_token')?.value;
  if (!token) {
    redirect('/login'); // getServerSideProps' `{ redirect: {...} }` -> calling redirect()
  }

  // Calling cookies() above already forces this route to render dynamically — no separate
  // "always per-request" declaration needed, unlike getServerSideProps' explicit contract
  const dashboardData = await fetch('https://api.acme.com/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());

  return <DashboardView data={dashboardData} />;
}
```

### Step 3 — Global wrapper: `_app.js` + `_document.js` → root `layout.tsx`

```javascript
// BEFORE: pages/_app.js
import '../styles/globals.css';
export default function MyApp({ Component, pageProps }) {
  return (
    <GlobalThemeProvider>
      <Component {...pageProps} />
    </GlobalThemeProvider>
  );
}

// BEFORE: pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document';
export default function Document() {
  return (
    <Html lang="en">
      <Head><link rel="preload" href="/fonts/acme-sans.woff2" as="font" crossOrigin="" /></Head>
      <body><Main /><NextScript /></body>
    </Html>
  );
}
```

```tsx
// AFTER: app/layout.tsx — merges BOTH _app.js and _document.js into one file
import '../styles/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"> {/* _document.js's <Html lang> */}
      <head>
        <link rel="preload" href="/fonts/acme-sans.woff2" as="font" crossOrigin="" /> {/* _document.js's preload */}
      </head>
      <body>
        <GlobalThemeProvider>{children}</GlobalThemeProvider> {/* _app.js's wrapper */}
      </body>
    </html>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: A Migrated Route Silently Not Taking Effect
```text
❌ Both exist for the same conceptual route during migration:
pages/products/[id].js
app/products/[id]/page.tsx

Next.js serves the app/ version with ZERO warning that pages/products/[id].js is now dead code —
a teammate editing the old file wonders why their changes never show up
```
**Fix**: delete the `pages/` file in the **same PR** that adds its `app/` replacement — never leave both alive "just in case."

### ⚠️ Pitfall 2: The `getLayout` Per-Page Pattern Has No Direct Equivalent
A common Pages Router pattern attaches a layout function per page (`Page.getLayout = (page) => <Shell>{page}</Shell>`, read by a custom `_app.js`). The App Router has **no per-page-opt-in layout mechanism** — layouts are structural, driven by folder nesting. The migration path is to restructure routes that need different shells into different route groups (`(marketing)/`, `(dashboard)/`), each with its own `layout.tsx`, rather than looking for a prop-based equivalent that doesn't exist.

### ⚠️ Pitfall 3: Assuming Every Page Component Still Needs `'use client'`
Pages Router components could always use hooks/browser APIs directly — there was no server/client distinction. A naive migration wraps every migrated page in `'use client'` just to "make the errors go away," which defeats the entire point of the App Router (zero client JS for content that doesn't need interactivity). Migrate the data-fetching shell as a Server Component first, and push `'use client'` down to only the specific interactive leaf components (a button, a form) that actually need it — not the whole page.

### ⚠️ Pitfall 4: Losing a Redirect's Status Code Semantics
```javascript
// Pages Router distinguished these explicitly:
return { redirect: { destination: '/login', permanent: false } }; // temporary
return { redirect: { destination: '/new-url', permanent: true } };  // permanent
```
```tsx
// App Router's redirect() (next/navigation) is a TEMPORARY redirect — for a genuinely
// PERMANENT redirect (the old getServerSideProps `permanent: true` case), use
// permanentRedirect() instead. Silently using redirect() everywhere loses that distinction,
// which matters for search engines updating their index to the new URL rather than
// re-checking the old one on every crawl.
import { permanentRedirect } from 'next/navigation';
permanentRedirect('/new-url');
```
