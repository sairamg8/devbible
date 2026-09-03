---
sidebar_position: 2
title: "`'use client'`: when and why to opt in (interactivity, browser APIs, local state)."
sidebar_label: "`'use client'`: when and why to opt in (interactivity, browser APIs, local state)."
description: "`'use client'`: when and why to opt in (interactivity, browser APIs, local state)."
---

# ▲ `'use client'`: when and why to opt in (interactivity, browser APIs, local state).

> **Syllabus chapter:** 3. Server Components vs. Client Components  
> **Exact concept:** `'use client'`: when and why to opt in (interactivity, browser APIs, local state).  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
