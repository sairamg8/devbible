---
title: "'use client' marks a boundary between two module graphs, not a file — everything it imports goes to the browser, and everything passed to it as children does not, which is the whole art of keeping a Next.js bundle small"
sidebar_label: "03 · Core philosophy: server-first"
sidebar_position: 3
description: "Server-first rendering as a default you opt out of: what the 'use client' boundary actually marks, the module-graph rule and the children exception, the RSC payload, and hybrid static/dynamic as a per-route decision."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (page header `version: 16.3.4`, `lastUpdated` 2026-08-25) and the [16.3 release post](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**Three ideas are usually presented as Next.js's philosophy — server-first rendering, zero client JavaScript where possible, hybrid static/dynamic architectures — and they sound like slogans until you know the one mechanism that implements all three. That mechanism is the `'use client'` boundary, and almost everyone misunderstands it in the same way: they think it marks a file. It marks a boundary between two module graphs, and the difference decides how much JavaScript your users download. This page is about getting that one thing exactly right; [03b](03b-hybrid-static-dynamic-and-the-cost-model.md) covers the hybrid static/dynamic half.**

## The default, stated plainly

Layouts and pages are **Server Components by default**. You write no directive to get that; it is what you get for doing nothing. A Server Component:

- can `await` — fetch from a database or API directly, close to the source;
- can read secrets — API keys and tokens, without exposing them to the browser;
- ships **no JavaScript of its own** to the client;
- improves First Contentful Paint and can stream progressively.

You opt *out* of that, per subtree, when you need what only the browser has. The docs name four reasons and they are the complete list worth memorising:

| Use a Client Component when you need | Examples |
|---|---|
| State and event handlers | `useState`, `onClick`, `onChange` |
| Lifecycle logic | `useEffect` |
| Browser-only APIs | `localStorage`, `window`, `navigator.geolocation` |
| Custom hooks | anything built on the above |

🔴 **If none of those four apply, the component should not be a Client Component.** That test is mechanical, and it is the one to apply before adding the directive out of habit.

## 🔴 The rule everyone gets wrong

Quoted directly, because the exact wording is the whole lesson:

> `"use client"` is used to declare a **boundary** between the Server and Client module graphs (trees).
>
> Once a file is marked with `"use client"`, **all of its imports and the components it directly renders are included in the client bundle**. This means you don't need to add the directive to every component that is intended for the client.

Read the second sentence as a warning rather than a convenience. **The directive is viral downward through imports.** Put it on a layout and every component that layout imports — and everything *those* import — is now in the client bundle, whether or not any of it is interactive.

```tsx
// app/layout.tsx
'use client'                        // 🔴 one line
import Logo from './logo'           // ships to browser
import Nav from './nav'             // ships to browser
import Footer from './footer'       // ships to browser, and everything they import
```

That is how a migrated application ends up with a *larger* bundle than the Pages Router version it replaced. Nobody decided to ship all of that; one directive at the top of a tree did it silently.

### And the exception that makes composition work

This is the other half, and it is what people miss when they conclude "so a client component can't contain server components":

> It does not apply to Server Components passed as **children or other props**. Those components are not imported into the Client Component's module graph. They are rendered on the server and passed to the Client Component as rendered output.

**Imports cross into the client bundle. Children do not.** A Client Component can render server-rendered content as long as that content arrives as a prop rather than an import.

```tsx
// app/ui/modal.tsx — client: it owns the open/closed state
'use client'
export default function Modal({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
```

```tsx
// app/page.tsx — server: Cart is a SERVER component, and stays one
import Modal from './ui/modal'
import Cart from './ui/cart'

export default function Page() {
  return (
    <Modal>
      <Cart />        {/* rendered on the server, passed in as output */}
    </Modal>
  )
}
```

`Cart` can query the database. It ships no JavaScript. It sits visually inside a component that manages client state. This "slot" pattern — a Client Component taking `children` — is the single most useful composition technique in the App Router, and it exists entirely because of the import/children distinction.

## Where to put the boundary

The instruction is to push it **down**, toward the leaves:

> To reduce the size of your client JavaScript bundles, add `'use client'` to specific interactive components instead of marking large parts of your UI as Client Components.

The canonical shape — a layout that is mostly static with one interactive control:

```tsx
// app/layout.tsx — Server Component, no directive
import Search from './search'   // this one is 'use client'
import Logo from './logo'       // stays on the server

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav><Logo /><Search /></nav>
      <main>{children}</main>
    </>
  )
}
```

Only `Search` and its imports reach the browser. `Logo`, the layout itself, and everything under `{children}` do not.

**The same rule applies to context providers, with an explicit note:**

> You should render providers as deep as possible in the tree – notice how `ThemeProvider` only wraps `{children}` instead of the entire `<html>` document. This makes it easier for Next.js to optimize the static parts of your Server Components.

React context is **not supported in Server Components** at all, so a provider must be a Client Component. But because it takes `children`, wrapping your whole app in one does *not* make the whole app client-side — the children still render on the server. The cost of hoisting it to the root is optimisation, not correctness.

## What actually crosses the wire

Worth knowing precisely, because it explains several errors that otherwise look arbitrary.

On the server, Server Components render into the **RSC Payload** — *"a compact, serialized representation of the rendered React Server Components tree"* containing three things:

1. the rendered result of Server Components;
2. placeholders for where Client Components go, plus references to their JavaScript files;
3. **any props passed from a Server Component to a Client Component**.

On first load the browser does three things in order: HTML gives an immediate non-interactive preview; the RSC Payload reconciles the client and server trees; JavaScript hydrates the Client Components. On subsequent navigations the RSC Payload is prefetched and cached, and Client Components render entirely on the client with no server-rendered HTML.

🔴 **Item 3 is why props must be serializable.** *"Props passed to Client Components need to be serializable by React."* A function has no serialized form, so passing a callback from a Server Component to a Client Component fails — and it fails for a structural reason, not an arbitrary restriction. The prop has to survive a trip through the payload.

```tsx
// ❌ a function cannot be serialized into the RSC payload
export default async function Page() {
  const onSave = async (v: string) => { /* ... */ }
  return <Editor onSave={onSave} />          // 🔴 not serializable
}

// ✅ a Server Action is a reference the runtime knows how to encode
export default async function Page() {
  async function onSave(v: string) { 'use server'; /* ... */ }
  return <Editor onSave={onSave} />
}
```

## Environment poisoning, and the failure that is worse than an error

Modules are shared between both graphs, so server-only code can be imported into the client by accident. Next.js has a partial defence and a documented gap:

> In Next.js, only environment variables prefixed with `NEXT_PUBLIC_` are included in the client bundle. If variables are not prefixed, Next.js replaces them with **an empty string**.

⚠️ **An empty string, not `undefined`.** So `process.env.API_KEY` in client-reachable code does not throw and does not read as missing — it reads as `""`. A truthiness check passes nothing, a header is sent empty, and the upstream returns 401. **The secret is safe; the diagnosis is what costs you the afternoon.**

The real fix is to make the mistake impossible at build time with the `server-only` package:

```ts
// lib/data.ts
import 'server-only'                    // build-time error if a Client Component imports this

export async function getData() {
  const res = await fetch('https://external-service.com/data', {
    headers: { authorization: process.env.API_KEY },
  })
  return res.json()
}
```

There is a matching `client-only` for modules that touch `window`. Both are **optional** in Next.js — it handles these imports internally to produce clearer errors, and *"the contents of these packages from NPM are not used by Next.js"* — but installing them keeps lint rules about extraneous dependencies quiet.

## Third-party components that predate the boundary

A package using `useState` without shipping a `'use client'` directive errors when imported directly into a Server Component, because Next.js cannot know it needs the client. Two options:

```tsx
// Option 1 — use it inside a component that is already 'use client'. Works as-is.

// Option 2 — app/carousel.tsx: a one-line wrapper that re-exports it across the boundary
'use client'
import { Carousel } from 'acme-carousel'
export default Carousel
```

**Library authors:** add the directive to entry points that rely on client-only features, so consumers need no wrapper. ⚠️ *"Some bundlers might strip out `"use client"` directives"* — if you ship a library, verify the directive survives your build rather than assuming it.

## Gotchas

**★ Symptom: you migrate to the App Router and the client bundle grows.** Cause: `'use client'` on a layout or page. The directive is viral downward through imports — everything that file imports, and everything those import, joins the client bundle. Fix: move it to the smallest interactive leaf. Search your tree for the directive on any file that also renders large static subtrees.

```tsx
// ❌ app/layout.tsx: 'use client' → Logo, Nav, Footer and their imports all ship
// ✅ app/layout.tsx: no directive; only ./search carries it
```

**★ Symptom: "a Client Component can't contain Server Components, so this whole subtree has to be client."** Cause: knowing the import half of the rule and not the children half. Server Components passed as `children` or props are *not* in the client module graph — they render on the server and arrive as output. Fix: use the slot pattern. Give the Client Component a `children` prop and pass the server subtree in from a server parent.

```tsx
// The Cart stays a Server Component and can still query the DB
<Modal><Cart /></Modal>
```

**★ Symptom: the render throws when a function is passed across the boundary.** The documented behaviour is blunt — *"Passing a function as a prop from a Server Component to a Client Component throws. An event handler like `onClick` cannot cross."* Cause: props are carried inside the RSC payload and must be serializable; a function has no serialized form. Fix: make it a Server Function with `'use server'` — *"A Server Function marked with `'use server'` crosses as a reference"* — which is not a workaround but the designed mechanism.

**★ Symptom: an API call from the browser gets a 401 and the key "looks fine" in the code.** Cause: an unprefixed env var reached client code, and Next.js replaced it with **an empty string** rather than leaving it undefined. Nothing throws; an empty `authorization` header is sent. Fix: `import 'server-only'` at the top of every module that touches a secret, turning the mistake into a build error instead of a runtime mystery.

**★ Symptom: the whole app is client-rendered because a context provider wraps it.** Cause: assuming the provider makes its subtree client. It does not — the provider is a Client Component, but `{children}` still renders on the server. Fix: keep the provider, but render it as deep as possible; hoisting to the root costs static optimisation, not correctness.

**★ Symptom: importing a third-party component into a page errors about client-only features.** Cause: the package uses `useState` and ships no `'use client'`, so Next.js cannot know it belongs on the client. Fix: a one-line wrapper module that adds the directive and re-exports it, then import your wrapper everywhere.

**★ Symptom: you ship a component library and consumers report the directive has no effect.** Cause: some bundlers strip `"use client"` during the library build. Fix: verify the directive survives in your published output, and configure the bundler to preserve it — this must be checked, not assumed.

**Symptom: a component works in dev and fails at build with a `window is not defined` error.** Cause: browser-only code in a Server Component; dev is more forgiving about when that code runs. Fix: either mark the component `'use client'` if it is genuinely interactive, or move the `window` access into an effect. `client-only` makes it a build error at the module level instead.

**Symptom: adding `'use client'` "fixed" a hook error, and now performance is worse.** Cause: the directive silences the symptom by moving the component to the browser — a correct-looking fix that quietly relocated the work. Fix: ask whether the component needs state, effects, browser APIs or custom hooks. If not, the hook was the mistake, not the missing directive.

**Symptom: a client component re-renders the entire page on navigation.** Cause: on subsequent navigations Client Components render entirely on the client with no server HTML, so a client boundary high in the tree owns more re-rendering than expected. Fix: the same push-down rule — a smaller boundary means less client work per navigation, not just a smaller bundle.

## Interview questions

**★ What does `'use client'` actually mark?**
A boundary between the server and client module graphs — not a file, which is the near-universal misreading. Once a file carries the directive, all of its imports and the components it directly renders are included in the client bundle, so it is viral downward through the import tree. That is why a single directive on a layout can ship an entire static component tree to the browser. The corollary is the placement rule: push it toward the leaves, on the specific interactive components, rather than marking large parts of the UI.

**★ Can a Client Component render a Server Component?**
Yes, and this is where the boundary rule has its important exception. It cannot *import* one — an import puts it in the client module graph. But Server Components passed as `children` or other props are not in that graph; they render on the server and arrive as rendered output. So the pattern is a Client Component with a `children` slot, with the server subtree passed in from a server parent — a `Modal` owning open/closed state wrapping a `Cart` that queries the database directly. That distinction between imports and props is the whole art of composition here.

**★ Why can't you pass a function from a Server Component to a Client Component?**
Because props passed across the boundary travel inside the RSC payload and must be serializable by React, and a function has no serialized form. The payload carries three things — rendered Server Component output, placeholders and references for Client Components, and the props passed between them — so the restriction falls out of the transport rather than being an arbitrary rule. The designed answer is a Server Action marked `'use server'`, which the runtime encodes as a reference the client can invoke rather than as a value.

**★ An API key ends up in client-reachable code. What happens, and why is it worse than an error?**
The secret does not leak — only `NEXT_PUBLIC_`-prefixed variables enter the client bundle, and Next.js replaces unprefixed ones with an empty string. The problem is that it is an empty string rather than `undefined`, so nothing throws: the code runs, sends an empty `authorization` header, and the upstream returns 401. You debug an auth failure instead of reading a clear error. The fix is `import 'server-only'` in any module touching secrets, which converts it into a build-time error. Worth noting the package is optional — Next.js handles the import internally for better messages and does not use the npm contents.

**Where should a context provider go, and does it make the app client-rendered?**
As deep in the tree as possible. It must be a Client Component because React context is not supported in Server Components at all — but it does not make its subtree client, because it receives `children`, and those still render on the server. So hoisting it to the root is not a correctness problem; the docs are explicit that keeping it deep makes it easier for Next.js to optimise the static parts of the Server Components around it. It is an optimisation argument, and people usually mistake it for a correctness one in both directions.

**Walk through what the browser receives on a first load versus a subsequent navigation.**
On first load, three things in order: HTML for an immediate non-interactive preview; the RSC payload, used to reconcile the client and server trees; then JavaScript to hydrate the Client Components and make them interactive. On subsequent navigations it is different — the RSC payload is prefetched and cached for instant navigation, and Client Components render entirely on the client with no server-rendered HTML. That second path is why a client boundary placed high in the tree costs you on every navigation, not just in initial bundle size.

**A third-party component uses `useState` but has no `'use client'`. What happens and what do you do?**
Importing it directly into a Server Component errors, because Next.js has no way to know it depends on client-only features. Two fixes: use it inside a component that is already a Client Component, where it works unchanged, or write a one-line wrapper module that adds the directive and re-exports it, then import your wrapper. If you are the library author the right fix is upstream — add the directive to entry points relying on client-only features, and verify it survives your bundler, since some strip it.

**Someone adds `'use client'` to fix a hook error. Is that the right fix?**
Usually not, and it is dangerous precisely because it works. The directive silences the error by moving the component to the browser, so the symptom disappears while the work quietly relocates and the bundle grows. The right question is whether the component genuinely needs one of the four things only the client offers: state and event handlers, lifecycle logic, browser-only APIs, or custom hooks built on those. If none apply, the hook was the mistake and the directive is papering over it.

---

← Prev [02 · Next.js vs the alternatives](02-nextjs-vs-alternatives-remix-react-router-v7-astro-tanstack.md) · [Index](01-explanation.md) · Next → [03b · Hybrid static/dynamic and the cost model](03b-hybrid-static-dynamic-and-the-cost-model.md)
