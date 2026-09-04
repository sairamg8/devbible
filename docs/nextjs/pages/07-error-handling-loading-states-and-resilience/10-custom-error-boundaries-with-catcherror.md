---
title: "`catchError` gives you an error boundary that can retry a failed Server Component"
sidebar_label: "10 · Custom error boundaries with `catchError`"
sidebar_position: 10
description: "catchError builds an error boundary that is a component rather than a route segment, with a retry() that re-runs the Server Components inside it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`catchError` reference](https://nextjs.org/docs/app/api-reference/functions/catchError),
> the [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling),
> the [`error.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-07-10`) and the
> [Next.js 16.3 release post](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**Before 16.3, a React error boundary in a Next.js app had two problems that had nothing to do
with your code: it interfered with application code calling `notFound()` or `redirect()`, and
its reset function could only clear client state — there was no way to retry a Server Component
that failed during rendering.** `catchError`, from `next/error`, fixes both. It produces a
boundary you can wrap around any part of the tree, at any granularity, and the fallback it
renders receives a **`retry()` that refetches the boundary's children** — including re-running
the Server Components inside it. That last capability is the one that changes designs: a
transient upstream failure inside a server-rendered section stops being a dead page.

## Where this sits relative to `error.js`

`error.js` is the coarse-grained mechanism and is still the right default: one boundary per
route segment, errors bubbling to the nearest one. Its reach and its props are the subject of
the two preceding pages — [08 · Boundary scope and `global-error`](08-errorjs-boundary-scope-and-global-error.md)
for what a segment boundary does and does not wrap, and
[09 · `error.js` props](09-errorjs-props-retry-and-reset.md) for `retry()` versus `reset()`.

`catchError` answers the question those leave open: **what do you do when the granularity you
need does not correspond to a route segment at all?**

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

### A `catchError` fallback without `'use client'`

**Symptom.** A build or runtime error when the boundary renders.

**Cause.** **Error boundaries must be Client Components**, and a `catchError` fallback is no
exception — the module that calls `catchError` needs the directive just as `error.js` does.

**Fix.** Add `'use client'` at the top of the file that defines the fallback.

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

**★ Where can `catchError` boundaries be placed, versus `error.js`?**
`error.js` sits at a route segment. A `catchError` boundary is a component and can wrap any
part of the tree, at any granularity.

**★ Where does an error go if several boundaries are in scope?**
To the **nearest** parent boundary. That is what makes placement a design decision rather than
a formality.

---

← [09 · `error.js` props](09-errorjs-props-retry-and-reset.md) · Next → [10b · What error boundaries do not catch](10b-what-boundaries-do-not-catch.md)
