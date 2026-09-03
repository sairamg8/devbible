---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 3 overview"
---

# ▲ Server Components vs. Client Components

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  



> **Source:** devbible pilot `server-vs-client-components.md` (authoritative for this syllabus chapter)

The single biggest mental shift moving into the App Router is that a component is *not* client-side JavaScript by default anymore — it's a Server Component unless you explicitly say otherwise. Getting this model right is mostly about knowing what each kind of component can and can't do, and drawing the boundary between them as late as possible.

## The default: everything is a Server Component

A **Server Component (RSC)** renders entirely on the server (or at build time) and ships **zero JavaScript** to the browser for that component — the client receives already-rendered output, not the code that produced it.

```tsx
// app/products/page.tsx — a Server Component by default, no directive needed
async function ProductsPage() {
  const products = await db.product.findMany() // direct data access, no API route needed
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}

export default ProductsPage
```

Two things stand out here that are impossible in a traditional React app: the component is `async` and awaits a database call directly, and none of that database code — or its credentials, its query logic, its dependencies — is ever sent to the browser. This is a **secure execution environment** by construction: secrets and privileged logic simply never cross the server/client boundary, because the component that touches them never ships as client code at all.

## `'use client'`: opting in, not opting out

Interactivity — state, effects, event handlers, browser-only APIs — requires actual JavaScript running in the browser. The `'use client'` directive at the top of a file marks that file (and everything it imports) as a **Client Component**, compiled and shipped to the browser like a traditional React component:

```tsx
'use client'

import { useState } from 'react'

export function LikeButton({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount) // requires client JS
  return <button onClick={() => setCount((c) => c + 1)}>♥ {count}</button>
}
```

Reach for `'use client'` specifically when a component needs:
- **State or effects** (`useState`, `useEffect`, `useReducer`)
- **Event handlers** (`onClick`, `onChange`, anything requiring interactivity)
- **Browser-only APIs** (`localStorage`, `window`, `IntersectionObserver`)
- **React context** that a Server Component needs to read (context requires a client provider)

Everything else should stay a Server Component by default — not as a micro-optimization, but because it's strictly less capable to make something client-side than to leave it server-side, so the burden of proof is on the client boundary, not on staying server-rendered.

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

## React 19.2 primitives for the RSC world

Two additions specifically address friction that showed up once components started living on both sides of the boundary:

- **`useEffectEvent`** — extracts non-reactive logic out of an effect (e.g. reading the latest value of a prop inside an event handler defined in the effect) without that logic becoming a reactive dependency that re-triggers the effect. Useful for keeping effect dependency arrays honest instead of suppressing lint warnings.
- **`<Activity>`** — preserves a subtree's state and DOM while it's visually hidden ("offscreen"), instead of unmounting it — e.g. keeping a background tab's scroll position and form state intact instead of losing it every time the user switches away and back.

## Enforcing the boundary: `server-only` and `client-only`

Nothing stops a Server-Component-only utility (e.g. one that reads an API secret from `process.env`) from accidentally being imported into a file that later gets marked `'use client'` — the import would still compile, and the secret would leak into the client bundle. The `server-only` package makes that a build-time error instead of a silent leak:

```ts
// db.ts
import 'server-only' // throws a build error if this file is ever imported client-side

export async function getSecretConfig() {
  return process.env.INTERNAL_API_KEY
}
```

`client-only` is the mirror image — for code that depends on browser globals and should error loudly if accidentally imported into server code, rather than crashing at runtime with a cryptic `window is not defined`.

## Why this affects bundle size and Core Web Vitals directly

Every component kept as a Server Component is JavaScript the browser never has to download, parse, or execute — directly reducing Total Blocking Time and Time to Interactive. The App Router's default-server model is, in effect, a forcing function toward smaller client bundles: the "lazy" choice (not adding `'use client'`) is also the performance-correct one, which inverts the old default in the Pages Router, where every component shipped as client JavaScript unless you went out of your way to avoid it.

**The practical workflow:** build the page as Server Components first, run it, and only add `'use client'` to the smallest possible leaf components once you hit something that genuinely needs interactivity — not to an entire page, and not preemptively "just in case."
