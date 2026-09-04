---
sidebar_position: 5
title: "Prefetching fundamentals and the native View Transitions API via `<Link>`."
sidebar_label: "Prefetching fundamentals and the native View Transitions API via `<Link>`."
description: "Prefetching fundamentals and the native View Transitions API via `<Link>`."
---

# ▲ Prefetching fundamentals and the native View Transitions API via `<Link>`.

> **Syllabus chapter:** 2. Routing and Navigation  
> **Exact concept:** Prefetching fundamentals and the native View Transitions API via `<Link>`.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 3. Production-Grade Code Example

```tsx
// app/dashboard/layout.tsx — persists sidebar state across dashboard navigations
'use client';
import { useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true); // survives navigating between dashboard pages
  return (
    <div className="flex">
      <Sidebar expanded={sidebarExpanded} onToggle={() => setSidebarExpanded((v) => !v)} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

```tsx
// app/dashboard/loading.tsx — automatic Suspense fallback while page.tsx's async data resolves
export default function DashboardLoading() {
  return <div className="animate-pulse p-6">Loading dashboard…</div>;
}
```

```tsx
// app/dashboard/error.tsx — automatic error boundary; MUST be a Client Component
'use client';

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="p-6 text-rose-400">
      <p>Something went wrong loading the dashboard.</p>
      <button onClick={() => retry()} className="mt-2 px-3 py-1 bg-slate-800 rounded text-xs">
        Try again
      </button>
    </div>
  );
}
```

```tsx
// app/dashboard/page.tsx — the actual routed UI; async Server Component
async function getDashboardData() {
  const res = await fetch('https://api.acme.com/dashboard');
  if (!res.ok) throw new Error('Failed to load dashboard'); // caught by error.tsx above
  return res.json();
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardView data={data} />;
}
```

```typescript
// app/dashboard/route.ts — would CONFLICT if placed alongside page.tsx above in the same segment
// (shown here as if in a DIFFERENT segment, e.g. app/api/dashboard/route.ts)
export async function GET() {
  return Response.json({ status: 'ok' });
}
```

---
