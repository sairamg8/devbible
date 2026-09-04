---
title: "error.tsx must carry 'use client' and cannot catch the layout beside it, because in the composition order the boundary is nested inside that layout — which is also why global-error.tsx has to render its own document"
sidebar_label: "01e · error.tsx"
sidebar_position: 103
description: "error.tsx and the mandatory 'use client', exactly which errors it catches and misses, global-error.tsx, the retry vs reset props, and what error.message and error.digest contain in production."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error) (`lastUpdated: 2026-07-10`) and [Project structure › Component hierarchy](https://nextjs.org/docs/app/getting-started/project-structure) (`2026-07-21`).
> Target: **Next.js 16.3.4** · `error` introduced v13.0.0; `global-error` v13.1.0; `global-error` shown in development since v15.2.0; the `retry` prop stable in **v16.3.0** (`unstable_retry` in v16.2.0). Documentation-verified — **no sandbox run**.

**`error.tsx` is a React error boundary that Next.js places for you, inside the segment's layout and outside the segment's page. That single placement fact answers the question people actually have: it catches everything below it and nothing above it, so the `layout.tsx` sitting in the same folder is out of reach — and the root layout is out of reach of every `error.tsx` in the application, which is why a separate `global-error.tsx` exists and why that file has to render `html` and `body` itself.**

## The shape

```tsx title="app/dashboard/error.tsx"
'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}
```

The `'use client'` directive is not optional. A React error boundary is a class component implementing `getDerivedStateFromError` / `componentDidCatch`; those lifecycles exist only in the client runtime.

> *"`error.js` wraps a route segment and its nested children in a React Error Boundary. When an error throws within the boundary, the `error` component shows as the fallback UI."*
> — [`error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error)

## What it does not catch

> *"In the component hierarchy, `error.js` wraps `loading.js`, `not-found.js`, `page.js`, and nested `layout.js` files in a React error boundary. It does **not** wrap the `layout.js` or `template.js` above it in the same segment. To handle errors in the root layout, use `global-error.js`."*

Read literally: `app/dashboard/error.tsx` catches everything thrown by `app/dashboard/page.tsx`, by `app/dashboard/reports/layout.tsx`, and by anything deeper. It does **not** catch `app/dashboard/layout.tsx` — that error travels up to `app/error.tsx`.

```
app/
├── error.tsx           ← catches app/dashboard/layout.tsx
├── layout.tsx          ← caught by NOTHING except global-error.tsx
└── dashboard/
    ├── layout.tsx      ← caught by app/error.tsx
    ├── error.tsx       ← catches everything below this line
    └── page.tsx        ← caught by app/dashboard/error.tsx
```

Two escape hatches the reference names in passing, both useful:

> *"If you want errors to bubble up to the parent error boundary, you can `throw` when rendering the `error` component."*
> *"For component-level error recovery that aren't tied to route segments like `error.js`, use the `catchError` function."*

The second is covered in [07/10 · Custom error boundaries with `catchError`](../07-error-handling-loading-states-and-resilience/10-custom-error-boundaries-with-catcherror.md).

## `global-error.tsx`

> *"While less common, you can handle errors in the root layout or template using `global-error.jsx`, located in the root app directory, even when leveraging internationalization. Global error UI must define its own `<html>` and `<body>` tags, global styles, fonts, or other dependencies that your error page requires. This file replaces the root layout or template when active."*

> *"Error boundaries must be Client Components, which means that `metadata` and `generateMetadata` exports are not supported in `global-error.jsx`. As an alternative, you can use the React `<title>` component."*

> *"`global-error` and the built-in 500 page render their own document and do **not** include your global styles, so an app-level theme toggle (a class or `data-theme` attribute) won't reach them. The default UI follows the OS color scheme; to match your app's theme, apply it inside your own `global-error` component."*

```tsx title="app/global-error.tsx"
'use client' // Error boundaries must be Client Components
import './globals.css'

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    // global-error must include html and body tags
    <html lang="en" data-theme="dark">
      <body>
        <title>Something went wrong</title>
        <h2>Something went wrong!</h2>
        <p>Reference: {error.digest ?? 'unknown'}</p>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  )
}
```

## `retry` versus `reset`

Since **16.3.0** the prop you want is `retry`, and the docs are unambiguous about which:

> *"An error component can use the `retry()` function to prompt the user to attempt to recover from the error. When executed, the function will try to re-fetch and re-render the error boundary's children. If successful, the fallback error component is replaced with the result of the re-render."*

> *"In most cases, you should use `retry()` instead. However, if you have a specific reason to clear the error state and re-render the error boundary's children without re-fetching the contents, you can use the `reset()` function."*
> — [`error.js` › Props](https://nextjs.org/docs/app/api-reference/file-conventions/error#reset)

`reset()` re-renders with the data it already has, which is almost never what a user pressing "Try again" wants. The dedicated chunk is [07/09 · `error.js` props: retry and reset](../07-error-handling-loading-states-and-resilience/09-errorjs-props-retry-and-reset.md).

## `error.message` and `error.digest`

> *"During development, the `Error` object forwarded to the client will be serialized and include the `message` of the original error for easier debugging. However, **this behavior is different in production** to avoid leaking potentially sensitive details included in the error to the client."*

> *"Errors forwarded from Client Components show the original `Error` message. Errors forwarded from Server Components show a generic message with an identifier. This is to prevent leaking sensitive details. You can use the identifier, under `errors.digest`, to match the corresponding server-side logs."*

> *"`error.digest`: An automatically generated hash of the error thrown. It can be used to match the corresponding error in server-side logs."*

Which is why every production `error.tsx` should surface the digest — it is the only thread back to the real stack trace:

```tsx
<p className="text-xs opacity-60">
  Reference: {error.digest ?? 'unknown'}
</p>
```

## Gotchas

**★ Symptom: `error.tsx` sits right next to the failing `layout.tsx` and never renders; you get the parent's error UI or a blank screen.** Cause: the error boundary is composed *inside* its own segment's layout, so the layout is its ancestor. Fix — put the boundary one level up, or (better) move the failing work out of the layout:

```
app/error.tsx              ✓ catches app/dashboard/layout.tsx
app/dashboard/error.tsx    ✗ never catches app/dashboard/layout.tsx
app/global-error.tsx       ✓ the only thing that catches app/layout.tsx
```

**★ Symptom: build fails on `error.tsx` with a message about hooks or class components in a Server Component.** Cause: the missing `'use client'`. Fix — it is the first line of the file, always:

```tsx
'use client'

export default function Error({ error, retry }: { error: Error; retry: () => void }) {
  return <button onClick={() => retry()}>Try again</button>
}
```

**Symptom: production `error.message` reads like a generic placeholder and you cannot reproduce it.** Cause: errors from Server Components are deliberately stripped in production so internals cannot leak into the browser; only the digest crosses the boundary. Fix — render `error.digest` in the UI and grep your server logs for it.

**★ Symptom: `retry()` shows the same error immediately.** Cause: you called `reset()` — or you are on a release older than 16.3 where the prop was `unstable_retry`. `reset()` re-renders without re-fetching, so a data failure comes straight back. Fix — use `retry()`, which re-fetches and re-renders:

```tsx
'use client'
export default function Error({ retry }: { retry: () => void }) {
  return <button onClick={() => retry()}>Try again</button>
}
```

**Symptom: `global-error.tsx` renders without your fonts, theme or CSS.** Cause: it *replaces* the root layout, so nothing the root layout imported is present. Documented, not a bug. Fix — import what it needs inside the file and set the theme there, as in the example above.

**Symptom: `export const metadata` in `global-error.tsx` has no effect.** Cause: error boundaries are Client Components, and `metadata` / `generateMetadata` are unsupported there. Fix — render React's `<title>` element inside the component instead.

**Symptom: a segment-level `error.tsx` swallows an error you wanted the parent to handle — for example a whole-app "session expired" screen.** Cause: the nearest boundary wins. Fix — rethrow from the error component so it bubbles:

```tsx title="app/dashboard/error.tsx"
'use client'

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  if (error.message === 'SESSION_EXPIRED') throw error // let app/error.tsx take it
  return <button onClick={() => retry()}>Try again</button>
}
```

**Symptom: an error inside an event handler or a `useEffect` never reaches `error.tsx`.** Cause: React error boundaries only catch errors thrown *during rendering* of their descendants, not errors from asynchronous callbacks. Fix — handle it in the handler and render the failure as state, or use `catchError` for component-level recovery not tied to a route segment.

## Interview questions

**★ Why must `error.tsx` carry `'use client'`?**
Because it becomes a React error boundary, and an error boundary is a class component implementing `getDerivedStateFromError` and `componentDidCatch`. Those lifecycle methods exist only in the client runtime — the server renderer has no equivalent. Next.js therefore requires the file to be a Client Component; without the directive the build fails. It is the one special file where `'use client'` is mandatory rather than a choice.

**★ Which errors does `app/dashboard/error.tsx` catch, and which does it miss?**
It catches anything thrown while rendering `app/dashboard/page.tsx`, `app/dashboard/loading.tsx`, `app/dashboard/not-found.tsx`, and every nested layout and page below `dashboard/`. It misses `app/dashboard/layout.tsx` and `app/dashboard/template.tsx`, because in the composition order the error boundary is nested inside both, and a boundary cannot catch its own ancestors. Those errors bubble to `app/error.tsx`. And nothing under `app/` can catch `app/layout.tsx` — that is what `global-error.tsx` is for.

**★ Why does `global-error.tsx` have to render `html` and `body` when no other component may?**
Because it replaces the root layout while it is active. The root layout is the component that normally renders the document, and the whole reason `global-error.tsx` exists is that the root layout is the thing that failed — so it cannot be relied on to produce the shell. The same reasoning explains why your global styles, fonts and theme attribute are absent: they were imports of a layout that is not rendering. Anything the error page needs, it must import itself.

**★ What is `error.digest` for?**
It is an automatically generated hash of the thrown error, and in production it is the only identifying information that crosses to the client. Server Component errors are replaced with a generic message so internal details — connection strings, file paths, row contents — cannot leak into the browser. The digest appears both in the client-side `error` object and in the server log line, so surfacing it in the error UI lets a user quote a reference number that maps directly to the real stack trace.

**What is the difference between `retry()` and `reset()`, and why is `retry()` the default advice?**
`retry()` re-fetches and re-renders the boundary's children; `reset()` only clears the error state and re-renders with what is already there. Almost every error that reaches an `error.tsx` in a server-rendered app is a data failure — a timed-out query, a 503 from an upstream API — and re-rendering the same failed data reproduces the same error immediately. `retry()` became the stable prop in 16.3.0; `reset()` is kept for the narrow case where you know the data is fine and only the render failed.

**An error boundary is a Client Component. How does it show an error that happened on the server?**
The server serialises a minimal error object and sends it across the RSC boundary as part of the payload for the failed segment; the client boundary then renders the fallback. That serialisation step is why production messages are generic — the framework deliberately drops the original message and keeps only a digest. It is also why the boundary can offer `retry()`: the client can ask the server to render that segment again without a full page load.

**Why doesn't `error.tsx` catch an exception thrown from a click handler?**
React error boundaries catch errors thrown during rendering, in lifecycle methods, and in constructors of the tree below them. An event handler runs outside that window — by the time it fires, rendering has already completed — so the exception escapes to the window's error handler instead. Handle it locally and store the failure in state, or use `catchError` for component-level recovery that is not tied to a route segment.

---

← [01d · loading.tsx](01d-loading-tsx-and-the-suspense-boundary.md) · [Chapter 2 overview](01-explanation.md) · Next → [01f · not-found.tsx and notFound()](01f-not-found-and-the-notfound-function.md)
