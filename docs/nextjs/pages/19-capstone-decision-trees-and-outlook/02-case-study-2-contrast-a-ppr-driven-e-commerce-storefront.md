---
sidebar_position: 2
title: "**Case Study 2 (contrast):** a PPR-driven e-commerce storefront"
sidebar_label: "**Case Study 2 (contrast):** a PPR-driven e-commerce storefront"
description: "**Case Study 2 (contrast):** a PPR-driven e-commerce storefront — different rendering, caching, and state decisions, and why."
---

# ▲ **Case Study 2 (contrast):** a PPR-driven e-commerce storefront

> **Syllabus chapter:** 19. Capstone, Decision Trees, and Outlook  
> **Exact concept:** **Case Study 2 (contrast):** a PPR-driven e-commerce storefront — different rendering, caching, and state decisions, and why.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
