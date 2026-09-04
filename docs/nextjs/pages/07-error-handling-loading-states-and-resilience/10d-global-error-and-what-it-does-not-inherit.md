---
title: "`global-error` renders its own document, so it inherits none of your app — including the theme"
sidebar_label: "10d · `global-error` and what it does not inherit"
sidebar_position: 30
description: "The root layout's only boundary: why global-error gets no global styles, fonts or theme, why metadata exports do not work there, and the version history that explains why it often ships unlooked-at."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`error.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
> (page metadata: version 16.3.4, lastUpdated 2026-07-10) — the Global Error example, both
> *Good to know* notes and the Version History table **quoted verbatim**, no sandbox run.
> Target: **Next.js 16.3.4**, App Router.

**The root layout has no parent segment, so no `error.tsx` can wrap it —
[10c](10c-where-boundaries-sit-in-the-hierarchy.md) ends there, and `global-error.js` is what
picks it up.** The part that surprises people is not that it exists but what it costs:
`global-error` *replaces* the root layout, so it inherits nothing the root layout provided —
not your stylesheet, not your fonts, and not the theme class the layout was setting. A crash
page that renders blinding white to a user who has been in dark mode all day reads as a second
bug on top of the first, and this is why.

## What it is, verbatim

> *"While less common, you can handle errors in the root layout or template using
> `global-error.jsx`, located in the root app directory, even when leveraging
> internationalization. Global error UI must define its own `<html>` and `<body>` tags, global
> styles, fonts, or other dependencies that your error page requires. This file replaces the
> root layout or template when active."*

The `<html>`/`<body>` requirement and the `'use client'` requirement are covered with a worked
example in [10 · Custom error boundaries](10-custom-error-boundaries-with-catcherror.md). Note
what else that sentence lists, which is the part usually skipped: **global styles, fonts, or
other dependencies**. It is not only the document tags that are missing.

## The isolation, and what it does to your theme

> *"`global-error` and the built-in 500 page render their own document and do **not** include
> your global styles, so an app-level theme toggle (a class or `data-theme` attribute) won't
> reach them. The default UI follows the OS color scheme; to match your app's theme, apply it
> inside your own `global-error` component."*

Two things worth separating there. **The built-in 500 page is included in the rule** — so even
an app with no `global-error.js` at all has a crash path that ignores its theme. And **the
default UI follows the OS color scheme**, not your app's, so a user whose OS is light and whose
app is dark sees the mismatch precisely when something has already gone wrong.

```tsx filename="app/global-error.tsx"
'use client'

import './globals.css' // not inherited — import it here explicitly

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
        <h2>Something went wrong</h2>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  )
}
```

⚠️ Reading the theme back from `localStorage` in this component is a client-side read after
hydration, so it cannot prevent the first paint being wrong. A crash page is the one place
where hard-coding a readable palette is more defensible than matching the app exactly.

## No `metadata` export here

> *"Error boundaries must be Client Components, which means that `metadata` and
> `generateMetadata` exports are not supported in `global-error.jsx`. As an alternative, you
> can use the React `<title>` component."*

So the browser tab title comes from rendering `<title>` inside the returned tree, not from an
export:

```tsx filename="app/global-error.tsx"
'use client'

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong</title>
        <h2>Something went wrong</h2>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  )
}
```

## Version history

Quoted from the reference's Version History table:

| Version | Change |
|---|---|
| `v16.3.0` | `retry` prop became stable |
| `v16.2.0` | `unstable_retry` prop added |
| `v15.2.0` | Also display `global-error` in development |
| `v13.1.0` | `global-error` introduced |
| `v13.0.0` | `error` introduced |

🔴 **`v15.2.0` is the row to know.** Before it, `global-error` was displayed in production
only — so a developer triggering a root-layout crash locally saw the development error overlay
and never their own global error UI, and shipped it having never once looked at it. On
**16.3.4** it renders in development too, which makes "throw deliberately in the root layout
and look at the result" a reasonable thing to ask of a code review.

## Gotchas

### A root layout error with no `global-error.js`

**Symptom.** A crash in the root layout produces the built-in 500 page, with none of the app's
branding, and no `error.tsx` anywhere helps.

**Cause.** Nothing wraps the root layout except `global-error.js`.

**Fix.** Add `app/global-error.tsx` with its own `<html>` and `<body>`, per
[10](10-custom-error-boundaries-with-catcherror.md).

### Never seeing your own `global-error` while developing

**Symptom.** The global error UI looks fine in review and wrong the first time it fires in
production.

**Cause.** Before **v15.2.0**, `global-error` was not displayed in development at all.

**Fix.** On 16.3.4 it does render in development — trigger a root-layout throw deliberately and
look at it. On an older pinned version, verify it in a preview deployment instead.

### Dark-mode users getting a white crash screen

**Symptom.** The app is in dark mode; the crash page is blinding white.

**Cause.** `global-error` renders its own document and does not include your global styles, so
the class or `data-theme` attribute your root layout sets is gone.

**Fix.** Import the stylesheet and set the theme inside the component itself:

```tsx filename="app/global-error.tsx"
'use client'
import './globals.css'

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <h2>Something went wrong</h2>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  )
}
```

### Theming `global-error` and forgetting the built-in 500

**Symptom.** The custom global error page is themed correctly, but some crashes still show an
unthemed page.

**Cause.** The rule names *"`global-error` and the built-in 500 page"*. The built-in page is
not yours to style at all.

**Fix.** Accept it, and reduce how often it is reached — a `global-error.js` that itself cannot
throw. Keep it free of data fetching, context, and anything imported from the app's providers.

### Assuming `global-error` inherits fonts

**Symptom.** The crash page renders in a system serif nothing else in the app uses.

**Cause.** The same isolation — fonts are a root-layout concern, and the root layout is
replaced.

**Fix.** The reference is explicit that global error UI must define *"global styles, fonts, or
other dependencies that your error page requires"*. Declare them in the component.

### Exporting `metadata` from `global-error.tsx`

**Symptom.** The title does not change, or the build complains about the export.

**Cause.** The file is a Client Component, and `metadata`/`generateMetadata` are not supported
in it.

**Fix.** Render React's `<title>` inside the returned tree instead.

### Reaching for `global-error` as the app's normal error UI

**Symptom.** Every failure produces a full-document replacement with no navigation, no shell
and no way back except the browser's own controls.

**Cause.** `global-error` was treated as "the error page" rather than the last resort for a
root-layout failure. The documentation opens the section with *"While less common"*.

**Fix.** Put a segment-level `error.tsx` where the failure actually is, so the shell survives;
keep `global-error` for the case where the shell itself is what broke.

## Interview questions

**★ What does `global-error.js` replace when it is active?**
The root layout or template. That is why it must define its own `<html>` and `<body>` tags —
nothing else is emitting them.

**★ Why does a themed app show an unthemed crash page?**
`global-error` and the built-in 500 page render their own document and do not include your
global styles, so an app-level theme toggle — a class or `data-theme` attribute set by the root
layout — never reaches them. The default UI follows the OS color scheme.

**★ What else does it fail to inherit, besides styles?**
Fonts and any other dependency the root layout provided. The reference lists *"global styles,
fonts, or other dependencies"* as things the global error UI must define itself.

**★ Why might a `global-error` page ship having never been looked at?**
Before v15.2.0 it was not displayed in development, so local testing showed the dev overlay
instead. It renders in development from 15.2.0 onward.

**★ Can you export `metadata` from `global-error.tsx`?**
No — error boundaries must be Client Components, and `metadata`/`generateMetadata` are not
supported there. Use React's `<title>` component inside the tree.

**★ When was `global-error` introduced?**
v13.1.0, one minor after `error` itself in v13.0.0.

**Is `global-error` the right place for your standard error UI?**
No. The docs introduce it with *"While less common"* — it is the root layout's boundary. A
segment-level `error.tsx` keeps the application shell alive, which a full-document replacement
cannot.

**What is the one thing a `global-error` component must never do?**
Throw. It is the last boundary; a failure inside it falls through to the built-in 500 page, so
keep it free of data fetching and app providers.

---

**Previous:** [10c · Where boundaries sit in the hierarchy](10c-where-boundaries-sit-in-the-hierarchy.md) · **Next:** [11 · Auth interrupts: 401 and 403](11-auth-interrupts-forbidden-and-unauthorized.md)
