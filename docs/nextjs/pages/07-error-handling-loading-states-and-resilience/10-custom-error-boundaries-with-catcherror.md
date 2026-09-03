---
title: "`catchError` gives you an error boundary that can retry a failed Server Component"
sidebar_label: "10 · Custom error boundaries with `catchError`"
sidebar_position: 10
description: "The 16.3 error boundary API: component-level placement, a retry() that re-runs server rendering, and the prop rename from reset to retry."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling),
> the [`catchError` reference](https://nextjs.org/docs/app/api-reference/functions/catchError)
> and the [Next.js 16.3 release post](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4**, App Router.

**Before 16.3, a React error boundary in a Next.js app had two problems that had nothing to do
with your code: it interfered with application code calling `notFound()` or `redirect()`, and
its reset function could only clear client state — there was no way to retry a Server Component
that failed during rendering.** `catchError`, from `next/error`, fixes both. It produces a
boundary you can wrap around any part of the tree, at any granularity, and the fallback it
renders receives a **`retry()` that refetches the boundary's children** — including re-running
the Server Components inside it. That last capability is the one that changes designs: a
transient upstream failure inside a server-rendered section stops being a dead page.

## The file-convention boundary, and what changed

`error.js` inside a route segment is still the coarse-grained mechanism, and errors bubble up
to the nearest parent boundary — so placing `error.tsx` files at different levels of the route
hierarchy gives you granular handling for free:

```tsx filename="app/dashboard/error.tsx"
'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
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

🔴 **The second prop is `retry`, not `reset`.** Material written against earlier versions —
including a great deal of what a search will surface — destructures `reset`. Destructuring
`reset` today gives you `undefined`, and the failure is a button that does nothing rather than
an error.

`global-error.js` handles failures in the root layout, and works even with internationalized
routing. Because it replaces the root layout or template when active, **it must define its own
`<html>` and `<body>` tags**:

```tsx filename="app/global-error.tsx"
'use client'

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  )
}
```

## `catchError`: boundaries that are not tied to a route segment

`error.js` can only sit at a segment. `catchError` builds a boundary component you can place
anywhere:

```tsx filename="app/custom-error-boundary.tsx"
'use client'

import { catchError, type ErrorInfo } from 'next/error'

function ErrorFallback(props: { title: string }, { error, retry }: ErrorInfo) {
  return (
    <div>
      <h2>{props.title}</h2>
      <p>{error.message}</p>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}

export default catchError(ErrorFallback)
```

Then use it as an ordinary wrapper:

```tsx filename="app/some-component.tsx"
import ErrorBoundary from './custom-error-boundary'

export default function Component({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary title="Dashboard Error">{children}</ErrorBoundary>
}
```

**Note the fallback's signature.** It is not an ordinary component. It takes **two**
arguments: your own props first, then an `ErrorInfo` object carrying `error` and `retry`. That
shape is what lets the boundary be configured at each usage site — `title="Dashboard Error"`
here, something else elsewhere — while the framework supplies the error state.

## Why `retry()` is the interesting part

A stock React boundary's reset clears client state and re-renders. It cannot re-run work that
happened on the server, because that work is not the client's to redo.

`catchError`'s `retry()` **refetches the boundary's children**, and those children can include
Server Components. So a section that failed because an upstream call timed out can genuinely be
attempted again, in place, without a full navigation or reload.

This makes fine-grained boundaries worth placing. A dashboard with six independently-fetched
panels can give each panel its own boundary, and a single flaky panel offers its own retry
while the other five stay live — which is a materially different product than one failed panel
replacing the whole page with an apology.

## Gotchas

### Destructuring `reset` instead of `retry`

**Symptom.** The "Try again" button renders and does nothing. No error in the console.

**Cause.** The prop is `retry`. `reset` is `undefined`, and `onClick={() => reset()}` fails
only when clicked.

**Fix.** Destructure `retry`, and audit any error boundary copied from pre-16.3 material — this
is the single most likely thing to be stale in an existing codebase.

### Expecting a plain React boundary to retry server work

**Symptom.** A user clicks "Try again", the client re-renders, and the same failed server
output reappears.

**Cause.** A stock boundary resets client state only. The Server Component's failed render is
not re-run, because re-running it is not something the client can do.

**Fix.** Use `catchError`, whose `retry()` refetches the boundary's children, Server
Components included.

### Writing the `catchError` fallback as a normal one-argument component

**Symptom.** `error` and `retry` are undefined; TypeScript may or may not catch it depending on
how the fallback is typed.

**Cause.** The fallback takes **two** arguments: your props, then `ErrorInfo`.

**Fix.**

```tsx
// BAD — single props object
function ErrorFallback({ error, retry, title }) { /* all undefined */ }

// GOOD — props first, ErrorInfo second
function ErrorFallback(props: { title: string }, { error, retry }: ErrorInfo) { }
export default catchError(ErrorFallback)
```

### Forgetting `<html>` and `<body>` in `global-error.js`

**Symptom.** The global error page renders broken or blank.

**Cause.** `global-error` replaces the root layout or template when active, so nothing else is
emitting those tags.

**Fix.** Include them in the component, as in the example above.

### Omitting `'use client'` from the boundary

**Symptom.** A build or runtime error when the boundary renders.

**Cause.** **Error boundaries must be Client Components.** This applies to `error.js`,
`global-error.js`, and any `catchError` fallback.

**Fix.** Add the directive at the top of the file.

### One boundary at the top of the app

**Symptom.** Any failure anywhere replaces the entire page, and `retry()` re-runs far more work
than the thing that actually broke.

**Cause.** Boundary placement was treated as a formality rather than a design decision. Errors
bubble to the *nearest* boundary, so a single high one catches everything.

**Fix.** Place boundaries at the granularity at which failure is independent — per panel, per
widget — using `catchError` where no route segment corresponds to that granularity.

## Interview questions

**★ What two problems does `catchError` solve?**
Stock React boundaries interfered with `notFound()` and `redirect()`, and could only reset
client state — there was no way to retry a Server Component that failed during rendering.

**★ What does `retry()` do that a React reset does not?**
It refetches the boundary's children, which can include re-rendering Server Components.

**★ What is the `catchError` fallback's signature?**
Two arguments: your own props first, then an `ErrorInfo` object with `error` and `retry`. It is
not a normal one-argument component.

**★ What is the second prop of an `error.js` component?**
`retry`. Not `reset` — that is the older name and is `undefined` today.

**★ Where can `catchError` boundaries be placed, versus `error.js`?**
`error.js` sits at a route segment. A `catchError` boundary is a component and can wrap any
part of the tree, at any granularity.

**★ Why must `global-error.js` include `<html>` and `<body>`?**
Because it replaces the root layout or template when active, so nothing else emits those tags.

**★ Must an error boundary be a Client Component?**
Yes — `error.js`, `global-error.js` and `catchError` fallbacks all require `'use client'`.

**★ Where does an error go if several boundaries are in scope?**
To the **nearest** parent boundary. That is what makes placement a design decision rather than
a formality.

---

**Next:** [10b · What error boundaries do not catch](10b-what-boundaries-do-not-catch.md)
