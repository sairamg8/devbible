---
title: "Two files make an App Router application, the root layout is required and must own the `html` and `body` tags — and if you forget it, `next dev` writes one for you, which is why a clean build can fail on a machine where development worked"
sidebar_label: "06 · Hello World with app/"
sidebar_position: 7
description: "The minimal App Router application: the two required files, why the root layout is special, what the browser actually receives on first load versus a navigation, and the auto-creation behaviour that makes dev and build disagree."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against the [installation docs](https://nextjs.org/docs/app/getting-started/installation) (page header `version: 16.3.4`, `lastUpdated` 2026-07-21) and [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**A Hello World is usually a formality. This one is worth reading slowly, because the smallest possible App Router application already demonstrates three things that surprise people later: a page that ships no JavaScript at all, a layout the framework will silently generate on your behalf if you omit it, and a first response that is HTML rather than an empty div waiting for a bundle. Getting the mental model right here saves a lot of confusion in chapters 2 through 7.**

## The whole application

Two files. No router configuration, no build config, no server entry point.

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// app/page.tsx
export default function Page() {
  return <h1>Hello, Next.js!</h1>
}
```

```bash
npm run dev     # http://localhost:3000
```

Both files render when a user visits `/`. That is the entire contract: a folder under `app/` is a route segment, `page.tsx` makes it publicly routable, and `layout.tsx` wraps whatever is beneath it.

## Why the root layout is not just another layout

> This file is the **root layout**. It's **required** and must contain the `html` and `body` tags.

Two obligations in one sentence, and the second is the unusual one. **In an App Router application you write the `html` and `body` elements yourself**, in a React component. There is no `index.html`, and nothing else will emit those tags — which is why omitting them produces a broken document rather than a helpful error.

This is also where the Pages Router's `_document.jsx` went. Anything you would have put there — `lang`, a class on `body`, a font variable, a theme attribute — lives here now.

### 🔴 The auto-creation behaviour, and why it bites

> If you forget to create the root layout, Next.js will **automatically create this file** when running the development server with `next dev`.

Read that as a hazard rather than a courtesy. **`next dev` writes a file into your source tree.** If it is not committed — a `.gitignore` pattern, a partial `git add`, a fresh clone in CI — then development works on the machine where the file was generated and the build behaves differently everywhere else. The symptom is the worst kind: *"it works on my machine"*, with a real, invisible cause.

**Check it is committed.** It costs one command and it is the sort of thing nobody thinks to verify:

```bash
git ls-files --error-unmatch app/layout.tsx
```

## What the browser actually receives

Worth walking once, because it explains behaviour in later chapters that otherwise looks like magic.

**On first load, three things in order:**

1. **HTML** — *"used to immediately show a fast non-interactive preview of the route"*. The user sees content before any JavaScript runs.
2. **The RSC Payload** — *"a compact, serialized representation of the rendered React Server Components tree"*, used to reconcile the client and server trees.
3. **JavaScript** — hydrates Client Components, *"attaching event handlers to the DOM, to make the static HTML interactive"*.

**On subsequent navigations it is a different path:** the RSC payload is prefetched and cached for instant navigation, and Client Components render entirely on the client with no server-rendered HTML.

🔴 **For this Hello World, step 3 has nothing to do.** `Page` is a Server Component with no interactivity, so it contributes **no JavaScript to the bundle**. Not "a little" — none for its own sake. Add a `useState` and a click handler and you have created the first client bundle in the application. That is the cost model from [03](03-core-philosophy-server-first-rendering.md) made concrete in two files.

## Adding the next few pieces

**A second route** — a folder is a segment, `page.tsx` makes it routable:

```text
app/
  layout.tsx        →  wraps everything
  page.tsx          →  /
  about/page.tsx    →  /about
```

**Static assets** — an optional `public/` folder at the project root, referenced from the base URL:

```tsx
import Image from 'next/image'

export default function Page() {
  return <Image src="/profile.png" alt="Profile" width={100} height={100} />
}
```

`public/profile.png` is served at `/profile.png`. The path is **not** relative to the file importing it, which is the usual first mistake.

**Interactivity** — the moment a bundle appears:

```tsx
// app/counter.tsx
'use client'
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

Import that into `app/page.tsx` and the page stays a Server Component; only `Counter` and its imports ship. Put `'use client'` at the top of `page.tsx` instead and the boundary moves up — same rendered output, different bundle. See [03](03-core-philosophy-server-first-rendering.md) for why that distinction is the whole game.

## An optional `src/` folder

> You can optionally use a `src` folder in the root of your project to separate your application's code from configuration files.

Then it is `src/app/layout.tsx`. ⚠️ Decide this at scaffold time — it changes `baseUrl` and every `paths` entry in `tsconfig.json`, as [05](05-project-setup-create-next-app-turbopack-defaults-typescript.md) covers.

## Gotchas

**★ Symptom: the app runs locally and the CI build fails, or renders a broken document.** Cause: `app/layout.tsx` was auto-created by `next dev` and never committed. Development works wherever the file was generated; a fresh clone has no root layout. Fix: verify it is tracked — `git ls-files --error-unmatch app/layout.tsx` — and treat "works on my machine" here as a concrete, findable cause rather than a mystery.

**★ Symptom: styles apply nowhere, or the page renders without a document shell.** Cause: the root layout is missing its `html` or `body` tags. It is *required* to contain both, and nothing else emits them in an App Router app. Fix: put them back. This is also where `_document.jsx` content belongs after a Pages Router migration — the `lang` attribute, body classes, font variables.

**★ Symptom: an image gives a 404 with a path that looks correct.** Cause: `public/` paths are resolved from the base URL, not relative to the importing file. `public/profile.png` is `/profile.png` from anywhere. Fix: always lead with `/`, and remember the folder name never appears in the URL.

**★ Symptom: a trivial page ships a surprisingly large bundle.** Cause: `'use client'` on `page.tsx` rather than on the interactive leaf. The rendered output is identical, so nothing looks wrong. Fix: move the directive to the smallest component that needs state or event handlers, and import that into the server page.

**★ Symptom: you add a `page.tsx` and the route 404s.** Cause: usually the file is named something else — `index.tsx`, or `Page.tsx` on a case-sensitive filesystem — or it sits in a folder that is not under `app/`. Fix: a route exists when a segment folder contains `page.tsx` exactly. A folder with only a `layout.tsx` is not routable, which is intended.

**Symptom: `useState` in `app/page.tsx` throws.** Cause: it is a Server Component by default, and hooks require the client. Fix: extract the interactive part into its own `'use client'` component rather than marking the page — see the previous gotcha for why that distinction matters even though both "work".

**Symptom: the first paint shows content, then everything flashes.** Cause: normal hydration — HTML arrives first, then JavaScript attaches handlers. A visible flash usually means a client component renders different markup than the server produced. Fix: look for values that differ between server and client, such as `Date.now()` or `window` checks during render.

**Symptom: a fresh project has no `public/` folder and imports fail.** Cause: `public/` is optional and not always scaffolded. Fix: create it at the project root; there is no configuration to add.

## Interview questions

**★ What is the minimum for an App Router application, and what is unusual about it?**
Two files: `app/layout.tsx` and `app/page.tsx`. The unusual part is the root layout — it is required, and it must contain the `html` and `body` tags, which you write yourself as JSX. There is no `index.html` and nothing else emits those tags, so omitting them produces a broken document rather than an error. It is also where `_document.jsx` content goes after a Pages Router migration: the `lang` attribute, body classes, font variables.

**★ What happens if you forget the root layout?**
`next dev` silently creates one for you. That sounds helpful and is a real hazard, because it writes a file into your source tree — so if it never gets committed, development works on the machine where it was generated and a fresh clone in CI behaves differently. It is a genuine "works on my machine" with a concrete cause. Worth explicitly checking the file is tracked, since nobody thinks to verify a file they did not knowingly create.

**★ How much JavaScript does a Hello World page ship?**
None for its own sake. `page.tsx` is a Server Component by default, so with no interactivity it contributes nothing to the client bundle — the browser gets HTML for an immediate non-interactive preview, the RSC payload to reconcile the trees, and then JavaScript only to hydrate Client Components, of which there are none here. The first bundle appears the moment you add state or an event handler, and where you put that directive decides how much ships.

**Walk through what the browser receives on first load versus a later navigation.**
First load is three things in order: HTML for a fast non-interactive preview, then the RSC payload — a compact serialized representation of the rendered Server Component tree — to reconcile client and server trees, then JavaScript to hydrate Client Components and attach event handlers. Subsequent navigations take a different path: the RSC payload is prefetched and cached for instant navigation, and Client Components render entirely on the client with no server-rendered HTML. That second path is why a client boundary high in the tree costs you on every navigation, not just at startup.

**How does a folder become a route?**
A folder under `app/` is a route segment, and it becomes publicly routable when it contains a `page.tsx`. So `app/about/page.tsx` serves `/about`. A folder with only a `layout.tsx` is a segment but not a route, which is intentional — it lets you group and wrap without exposing a URL. The common 404 causes are naming the file `index.tsx` out of habit, or a case mismatch that works on macOS and fails on a case-sensitive filesystem.

**Where do static assets go and how are they referenced?**
An optional `public/` folder at the project root, referenced from the base URL — `public/profile.png` is `/profile.png`. The mistake people make is treating the path as relative to the importing file, or including `public` in the URL. Neither works: the folder name never appears in the path, and the leading slash is not optional.

---

← Prev [05 · Project setup](05-project-setup-create-next-app-turbopack-defaults-typescript.md) · [Index](01-explanation.md) · Next → [07 · Key framework shifts](07-key-framework-shifts-stable-react-compiler-support.md)
