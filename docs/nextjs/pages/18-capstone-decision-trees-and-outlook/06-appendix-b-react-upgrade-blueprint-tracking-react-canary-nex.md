---
sidebar_position: 6
title: "**Appendix B:** React upgrade blueprint (tracking React canary → Next.js stable)."
sidebar_label: "**Appendix B:** React upgrade blueprint (tracking React canary → Next.js stable)."
description: "**Appendix B:** React upgrade blueprint (tracking React canary → Next.js stable)."
---

# ▲ **Appendix B:** React upgrade blueprint (tracking React canary → Next.js stable).

> **Syllabus chapter:** 18. Capstone, Decision Trees, and Outlook  
> **Exact concept:** **Appendix B:** React upgrade blueprint (tracking React canary → Next.js stable).  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
