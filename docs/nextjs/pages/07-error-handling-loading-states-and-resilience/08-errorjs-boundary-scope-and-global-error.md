---
title: "`error.js` wraps nested layouts but never its own, and `global-error` renders a document of its own"
sidebar_label: "08 · Boundary scope and `global-error`"
sidebar_position: 8
description: "What error.js does and does not wrap, why a throw in the same segment's layout escapes it, how to bubble deliberately, and why global-error never receives your global styles."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`error.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
> — page metadata `version: 16.3.4`, `lastUpdated: 2026-07-10`; its component-hierarchy
> sentence, its Global Error section and its Version History table are quoted verbatim below.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**Two facts about boundary placement are stated plainly in the reference and taught almost
nowhere. An `error.tsx` does not wrap the layout sitting in its own folder — only nested ones —
so the throw closest to the boundary is often the one it cannot catch. And `global-error`
replaces the root layout, which means it renders its own document and receives none of your
global styles, theme attribute included.** Both produce bugs that read as framework faults: a
boundary that ignores the failure right next to it, and an error page that ignores dark mode.

## The file convention

An `error.tsx` in a route segment wraps that segment and its children in a React error
boundary. It must be a Client Component, because error boundaries are a client-runtime feature:

```tsx filename="app/dashboard/error.tsx"
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

The props that component receives — `retry`, `reset`, `error.message` and `error.digest` — are
the subject of [09 · `error.js` props](09-errorjs-props-retry-and-reset.md). This page is about
where the boundary's reach begins and ends.

## What `error.js` actually wraps

Placement is usually taught as *errors bubble to the nearest boundary*. True, and it leaves out
the part that catches people:

> *"In the component hierarchy, `error.js` wraps `loading.js`, `not-found.js`, `page.js`, and
> nested `layout.js` files in a React error boundary. It does **not** wrap the `layout.js` or
> `template.js` above it in the same segment."*

The word doing the work is **nested**. Layouts *below* this segment are inside the boundary; the
layout sitting in the **same folder** as the `error.tsx`, and the template beside it, are
outside it:

```
app/
  layout.tsx            # root layout — only global-error.tsx catches this
  dashboard/
    layout.tsx          # NOT caught by dashboard/error.tsx — bubbles to the parent
    error.tsx           # catches page.tsx, loading.tsx, not-found.tsx, settings/layout.tsx
    page.tsx            # caught
    loading.tsx         # caught
    settings/
      layout.tsx        # caught — it is NESTED below the boundary
      page.tsx          # caught
```

A throw in `app/dashboard/layout.tsx` therefore bubbles to the parent segment's boundary, and a
throw in the *root* layout has no parent segment left to bubble to. That is the job
`global-error.js` exists to do.

The practical consequence for design: **a boundary protects the things a segment renders, not
the segment's own frame.** If the layout does data work that can fail — reading a session,
resolving a tenant, fetching navigation — the boundary beside it will never see that failure.
Move the boundary up one segment, or move the fallible work down into the page.

Sending an error further up deliberately is supported, and it is done by throwing rather than
through any API:

> *"If you want errors to bubble up to the parent error boundary, you can `throw` when rendering
> the `error` component."*

## `global-error.js`, and why it looks unstyled

`global-error.js` handles failures in the root layout or template, works with internationalized
routing, and — because it **replaces** the root layout when active — must define its own
`<html>` and `<body>` tags:

```tsx filename="app/global-error.tsx"
'use client' // Error boundaries must be Client Components

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    // global-error must include html and body tags
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  )
}
```

⚠️ **Your global styles do not reach it.** Replacing the root layout means losing everything
that layout was providing — the stylesheet import included:

> *"`global-error` and the built-in 500 page render their own document and do **not** include
> your global styles, so an app-level theme toggle (a class or `data-theme` attribute) won't
> reach them. The default UI follows the OS color scheme; to match your app's theme, apply it
> inside your own `global-error` component."*

This is why a global error page so often appears as an unstyled browser default inside a
carefully dark-themed app: the `data-theme` attribute the app sets on `<html>` is written by a
layout that is no longer rendering. Note the reach of that sentence — it covers **the built-in
500 page too**, which you did not write and cannot style at all. If the error page has to match
the app, the component applies the theme itself, on the `<html>` element it is already obliged
to render.

One further consequence of the Client Component requirement: **`metadata` and
`generateMetadata` exports are not supported in `global-error.jsx`.** React's `<title>`
component is the documented alternative.

Since **v15.2.0**, `global-error` is displayed in development as well as production. Before
that, development showed the error overlay instead, so the page you had written went untested
until it shipped — which is why so many of them shipped broken.

## Gotchas

### An `error.tsx` sitting beside the layout that actually throws

**Symptom.** A throw in `app/dashboard/layout.tsx` sails past `app/dashboard/error.tsx` and
takes out the parent segment instead — or the entire app, when that layout was the root.

**Cause.** `error.js` does not wrap the `layout.js` or `template.js` **above it in the same
segment**. It wraps `page.js`, `loading.js`, `not-found.js` and *nested* layouts.

**Fix.** To catch a segment's own layout, place the boundary in the **parent** segment:

```
app/
  dashboard/
    error.tsx        # add this to catch app/dashboard/(main)/layout.tsx
    (main)/
      layout.tsx     # the fallible layout, now one level below a boundary
      page.tsx
```

The root layout has no parent, which is precisely what `global-error.js` is for.

### Fallible data work in a layout

**Symptom.** Session lookup or tenant resolution fails, and no boundary anywhere in the segment
catches it.

**Cause.** The layout is outside its own segment's boundary by design, so the work it does is
too.

**Fix.** Either move the boundary up a segment, or move the fetch down into the page or a
nested component that *is* inside the boundary. The second is usually better — it keeps the
failure local to the thing that needed the data.

### A dark-themed app with a stark white `global-error`

**Symptom.** Every page honours the theme toggle; the global error page renders in OS colours
and ignores it.

**Cause.** `global-error` renders its own document and does not include your global styles, so
the class or `data-theme` attribute your root layout applies is never emitted — that layout has
been replaced.

**Fix.** Apply the theme inside the `global-error` component itself, on the `<html>` element it
is already required to render. The built-in 500 page cannot be styled this way at all, so do not
plan a design that depends on it matching.

### Forgetting `<html>` and `<body>` in `global-error.js`

**Symptom.** The global error page renders broken or blank.

**Cause.** `global-error` replaces the root layout or template when active, so nothing else is
emitting those tags.

**Fix.** Include them in the component, as in the example above.

### Exporting `metadata` from `global-error.jsx`

**Symptom.** The title never applies, and the export appears to be ignored.

**Cause.** Error boundaries must be Client Components, and `metadata` / `generateMetadata`
exports are not supported in one.

**Fix.** Render React's `<title>` component inside the returned document instead.

### Omitting `'use client'` from the boundary

**Symptom.** A build or runtime error when the boundary renders.

**Cause.** **Error boundaries must be Client Components.** This applies to `error.js`,
`global-error.js`, and any `catchError` fallback.

**Fix.** Add the directive at the top of the file.

### Never exercising the error state

**Symptom.** The boundary is written but first runs during a real incident.

**Cause.** Nothing in the app throws on demand, and before v15.2.0 the global path could not be
seen in development at all.

**Fix.** The React DevTools let you toggle error boundaries to test error states directly, and
since v15.2.0 `global-error` renders in development too — so the global path is testable without
a production deploy.

## Interview questions

**★ Does `error.tsx` catch an error thrown by the layout in its own folder?**
No. It wraps `page.js`, `loading.js`, `not-found.js` and **nested** layouts — not the
`layout.js` or `template.js` above it in the same segment. That throw goes to the parent
segment's boundary; for the root layout, to `global-error.js`.

**★ Given that, where do you put the boundary for a layout that fetches?**
In the parent segment, so the layout is nested below it — or move the fetch out of the layout
and into something the existing boundary already covers. The second keeps the blast radius at
the component that needed the data.

**★ How do you deliberately send an error to the parent boundary instead?**
`throw` when rendering the `error` component. There is no API for it — re-throwing during the
fallback's own render is the documented mechanism.

**★ Why must `global-error.js` include `<html>` and `<body>`?**
Because it replaces the root layout or template when active, so nothing else emits those tags.

**★ Why does a `global-error` page so often ignore the app's dark theme?**
Because it renders its own document and does not include your global styles. The `data-theme`
attribute the app relies on is applied by a root layout that `global-error` has replaced, so it
never reaches the page. The component has to apply the theme itself.

**★ Which other page has that same problem, and what can you do about it?**
The built-in 500 page — same sentence in the docs covers it. Nothing: you did not write it and
cannot style it, so a design that assumes every error surface matches the app theme is wrong on
that one.

**★ Why can't `global-error.jsx` export `generateMetadata`?**
Error boundaries must be Client Components, and `metadata` / `generateMetadata` exports are not
supported in one. React's `<title>` component is the alternative.

**★ Must an error boundary be a Client Component?**
Yes — `error.js`, `global-error.js` and `catchError` fallbacks all require `'use client'`.
Error boundaries rely on client-runtime lifecycle behaviour that has no server equivalent.

**★ What changed in v15.2.0, and why does it matter for testing?**
`global-error` is displayed in development as well as production. Before that, development
showed the error overlay, so the global error page you had written was never exercised until it
reached production.

---

← [07 · SprintDesk gets full error boundary coverage](07-project-milestone-sprintdesk-gets-full-error-boundary-covera.md) · Next → [09 · `error.js` props](09-errorjs-props-retry-and-reset.md)
