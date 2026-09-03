---
sidebar_position: 3
title: "Composition patterns: server-to-client boundaries, serializable props, children-as-slots to keep …"
sidebar_label: "Composition patterns: server-to-client boundaries, serializable props, children-as-slots to keep …"
description: "Composition patterns: server-to-client boundaries, serializable props, children-as-slots to keep client trees small."
---

# ▲ Composition patterns: server-to-client boundaries, serializable props, children-as-slots to keep …

> **Syllabus chapter:** 3. Server Components vs. Client Components  
> **Exact concept:** Composition patterns: server-to-client boundaries, serializable props, children-as-slots to keep client trees small.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## Composition: keeping client boundaries small

`'use client'` marks a **boundary**, not an isolated island — everything imported into that file also becomes part of the client bundle. The pattern that keeps bundles small is passing Server Components *into* Client Components as `children`, rather than importing a Server Component from inside a Client Component (which isn't even allowed):

```tsx
'use client'
// Interactive.tsx — only the tab-switching logic is client code
export function Tabs({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(0)
  return <div>{/* tab buttons */}{children}</div>
}
```

```tsx
// page.tsx — a Server Component, passed as children into the client Tabs
import { Tabs } from './Interactive'
import { ExpensiveServerRenderedReport } from './Report' // stays server-only

export default function Page() {
  return (
    <Tabs>
      <ExpensiveServerRenderedReport /> {/* never bundled for the client */}
    </Tabs>
  )
}
```

This "children-as-slots" pattern is the core composition technique of the App Router: `Tabs` only needs to *render* its children, not know what they are, so the heavy Server Component work never gets pulled across the boundary.

### Serializable props across the boundary

Props passed from a Server Component into a Client Component cross a real network-like boundary (even in the same request) and must be serializable — plain objects, arrays, strings, numbers; not functions, class instances, or `Date` objects passed directly without conversion. This is a frequent source of confusing errors when a Server Component tries to pass a callback down to a Client Component (not possible — event handlers must be defined *inside* the Client Component itself).
