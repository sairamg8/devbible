---
title: "`next/dynamic` is a composite of `React.lazy()` and Suspense, and every one of its sharp edges comes from the same place — lazy loading is a Client Component feature being invoked from files that may or may not be Client Components"
sidebar_label: "03e · next/dynamic and lazy loading"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [lazy loading guide](https://nextjs.org/docs/app/guides/lazy-loading)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-03-10`) and the Next.js
> [package bundling guide](https://nextjs.org/docs/app/guides/package-bundling) (`version: 16.3.4`,
> `lastUpdated: 2026-06-01`).
> Documentation-verified; **no sandbox run, no bundle measured**.
> Target: **Next.js 16.3.4 · Turbopack default since 16.0**.

**Every confusing thing about `next/dynamic` in the App Router follows from one sentence in the
documentation: lazy loading applies to Client Components.** Server Components are already code-split and
already stream; there is nothing for `next/dynamic` to defer about them. Hold that sentence and the API is
small: a lazy import, a Suspense fallback, and a way to say "do not render this on the server". This page
covers what `next/dynamic` is in terms of the React primitives it wraps, named exports, the `loading` option,
and deferring a whole library with a bare `import()`. The four documented `ssr: false` and code-splitting rules
— all consequences of the same sentence — are [03f](03f-the-ssr-false-and-code-splitting-rules.md), and the
magic comments, one of which webpack supports and Turbopack deliberately does not, are
[03g](03g-magic-comments-and-optional-imports.md).

## What it is, exactly

> *"Lazy loading in Next.js helps improve the initial loading performance of an application by decreasing the
> amount of JavaScript needed to render a route."*
> *"It allows you to defer loading of **Client Components** and imported libraries, and only include them in the
> client bundle when they're needed."*
> *"By default, Server Components are automatically code split, and you can use streaming to progressively send
> pieces of UI from the server to the client. **Lazy loading applies to Client Components.**"*
> *"`next/dynamic` is a composite of `React.lazy()` and Suspense. It behaves the same way in the `app` and
> `pages` directories to allow for incremental migration."*

🔴 **"A composite of `React.lazy()` and Suspense" is the whole mental model.** It is not a Next.js invention
with its own semantics; it is those two React primitives pre-wired, plus a `loading` option that becomes the
Suspense fallback and an `ssr` option React itself does not have. Anything you know about `React.lazy` — that
the import must resolve to a module with a default export unless you map it, that the boundary needs a
fallback, that it suspends — applies unchanged.

```tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const CommentEditor = dynamic(() => import('@/components/comment-editor'))

export function Thread({ postId }: { postId: string }) {
  const [replying, setReplying] = useState(false)
  return (
    <section>
      <button onClick={() => setReplying(true)}>Reply</button>
      {replying && <CommentEditor postId={postId} />}
    </section>
  )
}
```

The editor's chunk is not requested until `replying` becomes true. That is the entire value proposition, and it
is worth being blunt about when it pays: **deferring something every visitor opens immediately just moves the
download later and adds a round trip.** The candidates are the panels most people never open — an editor, a
chart drawer, a settings modal, an emoji picker, a map.

## Named exports

`React.lazy` expects a module whose default export is the component. When the component is a named export, map
it in the promise chain — the documented shape:

```jsx
const ClientComponent = dynamic(() =>
  import('../components/hello').then((mod) => mod.Hello)
)
```

## The `loading` option

The Suspense fallback, supplied inline:

```jsx
const WithCustomLoading = dynamic(
  () => import('../components/WithCustomLoading'),
  {
    loading: () => <p>Loading...</p>,
  }
)
```

Use it for anything whose chunk is large enough to be perceptible, and prefer a fallback with the same
dimensions as the real component — a lazy chunk that swaps a one-line placeholder for a 400-pixel panel is a
layout-shift generator, which is a Core Web Vitals problem you traded a bundle problem for.

## Deferring an external library

The same idea without a component: a bare dynamic `import()` inside the handler that needs it.

```jsx
const Fuse = (await import('fuse.js')).default
```

In context — the search library is not in the initial chunk, and is fetched the first time somebody types:

```tsx
'use client'

import { useState } from 'react'

export function SearchBox({ items }: { items: Item[] }) {
  const [results, setResults] = useState<Item[]>([])

  async function handleSearch(query: string) {
    const Fuse = (await import('fuse.js')).default
    const fuse = new Fuse(items, { keys: ['title', 'body'] })
    setResults(fuse.search(query).map((r) => r.item))
  }

  return <input onChange={(e) => handleSearch(e.target.value)} />
}
```

⚠️ **Do the import once, not per keystroke.** The module is cached after the first load, so a repeated
`await import()` is cheap but not free — it is still a promise tick before every search. Hoist it into a
module-level promise if the handler is hot.

```tsx
let fusePromise: Promise<typeof import('fuse.js')> | null = null
function loadFuse() {
  fusePromise ??= import('fuse.js')
  return fusePromise
}
```

## Gotchas

**★ Symptom: `dynamic(() => import('./thing'))` renders nothing, or TypeScript complains the module has no
default export.** Cause: `next/dynamic` is *"a composite of `React.lazy()` and Suspense"*, and `React.lazy`
resolves the module's default export. Your component is a named export. Fix: map it in the promise.

```jsx
const ClientComponent = dynamic(() =>
  import('../components/hello').then((mod) => mod.Hello)
)
```

**★ Symptom: the page jumps when a lazily-loaded panel appears.** Cause: the `loading` fallback occupies less
space than the real component, so the chunk arriving reflows everything under it. Fix: give the fallback the
component's dimensions — you traded bundle size for layout shift otherwise.

```tsx
const Chart = dynamic(() => import('@/components/chart'), {
  loading: () => <div className="h-80 w-full animate-pulse rounded bg-slate-100" />,
})
```

**Symptom: a component was made dynamic and the app got slower for most users.** Cause: it is rendered
immediately on load, so the deferral bought nothing and added a chunk request to the critical path. Fix: defer
only what is behind an interaction. The test is whether a typical session ever renders it — if it always does,
inline it.

**Symptom: a lazily imported library is re-imported on every keystroke or every render.** Cause: the
`await import()` sits inside a handler or a render body. The module cache makes subsequent loads cheap, but the
promise still has to resolve before your code runs. Fix: hoist the promise to module scope and reuse it.

```tsx
let fusePromise: Promise<typeof import('fuse.js')> | null = null
const loadFuse = () => (fusePromise ??= import('fuse.js'))
```

## Interview questions

**★ What is `next/dynamic`, in terms of things that already exist in React?**
It is *"a composite of `React.lazy()` and Suspense"* — the documentation's own phrasing. You get the lazy import
and the Suspense boundary pre-wired, a `loading` option that becomes the fallback, and an `ssr` option that
React does not have. That framing answers most questions about it before they are asked: the imported module
must resolve to a component in the default export unless you map it, the component suspends while its chunk
loads, and it is a client-side concept because `React.lazy` is a client-side concept.

**★ When is `next/dynamic` the wrong tool even though the component is large?**
When every visitor renders it. Deferring something that appears on load does not remove the download — it moves
it later and inserts a request into the critical path, usually with a fallback flash. Lazy loading pays when a
meaningful fraction of sessions never reach the code: an editor behind a "Reply" button, a chart in a drawer, a
settings modal, an emoji picker. It also pays as an escape hatch for a library that cannot render on the server
at all. If the answer to "does a typical session render this?" is yes, the honest fix is somewhere else — a
smaller dependency, or moving the work to a Server Component
([03c](03c-fixing-what-the-analyzer-finds.md)).

**How would you defer a library rather than a component?**
With a bare dynamic `import()` at the point of use — `const Fuse = (await import('fuse.js')).default` — inside
the handler that needs it, in a Client Component. That keeps the library out of the initial chunk entirely and
fetches it on first use. The refinement worth mentioning is hoisting the promise to module scope so a hot
handler awaits an already-resolved promise instead of paying a tick per call, and being clear that the module
cache means the network cost is paid once regardless.

---

← [03d · Package imports and server externals](03d-package-imports-and-server-externals.md) · [Chapter index](01-explanation.md) · Next → [03f · The `ssr: false` rules](03f-the-ssr-false-and-code-splitting-rules.md)
