---
title: "There are exactly four reasons to write `'use client'`, and 'a hook threw an error' is not one of them — the directive silences that error by moving your component to the browser, which is why bundles grow during migrations nobody thinks changed anything"
sidebar_label: "02 · 'use client': when to opt in"
sidebar_position: 2
description: "The decision procedure for opting into the client: the four documented reasons, the tests that distinguish a real need from a reflex, where to place the directive, and the third-party and library-author cases."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (page header `version: 16.3.4`, `lastUpdated` 2026-08-25), via research banked for this track on 2026-09-04.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.
> ⚠️ What the directive *does* to the module graph is established in [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md). This page is the decision procedure for *when* to write it.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**The directive is one line and it is almost always added for the wrong reason. Someone hits the compiler error about a hook that only works in a Client Component, adds `'use client'`, the error goes away, and the work quietly relocates to the browser along with everything that file imports. Nothing looks wrong — the page renders identically. This page is the test to apply before writing it, and the placement rule that limits the damage when the answer is genuinely yes.**

## The four reasons, and they are the whole list

Use a Client Component when you need:

| Need | Examples |
|---|---|
| **State and event handlers** | `useState`, `onClick`, `onChange` |
| **Lifecycle logic** | `useEffect` |
| **Browser-only APIs** | `localStorage`, `window`, `navigator.geolocation` |
| **Custom hooks** | anything built on the three above |

🔴 **If none of the four applies, the component should not carry the directive.** That is a mechanical test and it settles the overwhelming majority of cases in a few seconds. The remaining judgement is about placement, not permission.

Note what is *not* on the list: fetching data, reading secrets, formatting dates, rendering markdown, mapping over an array, or "it's a component with props". All of those are better on the server, where they cost nothing to ship.

## The test that catches the reflex

When an error prompts you to add the directive, ask **which of the four this component needs** — and answer with the specific API, not with "it's interactive".

If you cannot name one, the error is pointing at something else:

| What failed | What is usually true | The real fix |
|---|---|---|
| A hook that needs the client, used in a Server Component | A parent is trying to hold state that belongs in a leaf | Extract the interactive leaf; leave the parent on the server |
| A browser global is undefined during render | Browser code runs during render | Move it into an effect — or the component genuinely is client |
| A hook from a library fails | The **library** is client-only, not your component | Wrap the library import, not your page |
| Context is not available | Context is unsupported in Server Components entirely | The provider is client; consumers of it are too — but not their children |

**The pattern across all four: the directive silences the symptom by changing where the code runs.** That is a real fix in exactly one of the rows and a relocation in the other three.

## Placement: the directive is not local to the file

Because everything a `'use client'` file imports joins the client bundle, *where* you write it decides how much ships. The rule is to put it on the smallest component that needs one of the four things.

```tsx
// ❌ app/dashboard/page.tsx — one line, and every import below ships
'use client'
import { Chart } from './chart'       // heavy
import { Table } from './table'       // heavy
import { FilterInput } from './filter' // the only thing that needs state
```

```tsx
// ✅ app/dashboard/page.tsx — no directive; a Server Component
import { Chart } from './chart'        // stays server
import { Table } from './table'        // stays server
import { FilterInput } from './filter' // only this file is 'use client'

export default async function Page() {
  const rows = await db.metric.findMany()
  return <><FilterInput /><Chart data={rows} /><Table rows={rows} /></>
}
```

Identical output. Substantially different bundle. **This is the single highest-leverage habit in App Router work**, and it is why the directive on a `page.tsx` or `layout.tsx` deserves a second look in review — those files sit above everything else.

### The corollary people miss

A Client Component's children are **not** affected. Only its *imports* are. So a client boundary high in the tree is bad because of what it imports, not because of what it wraps — which is why a root-level context provider is fine and a root-level `'use client'` page is not. The patterns are in [03 · Composition patterns](03-composition-patterns-server-to-client-boundaries.md).

## Third-party components

A package that uses `useState` but ships no directive errors when imported into a Server Component, because Next.js has no way to know it needs the browser. Two options:

```tsx
// Option 1 — use it inside a file that is already 'use client'. Works unchanged.

// Option 2 — app/carousel.tsx: a wrapper that adds the directive and re-exports
'use client'
import { Carousel } from 'acme-carousel'
export default Carousel
```

Option 2 is the one to reach for when the component is used from several server pages: one wrapper, imported everywhere, instead of a client boundary at each call site.

**If you publish a library**, add the directive to entry points that rely on client-only features so your consumers need no wrapper. ⚠️ Some bundlers strip `"use client"` during a library build — verify it survives in your published output rather than assuming, because the failure appears only in consumers' projects.

## Gotchas

**★ Symptom: a migration adds `'use client'` to fix errors and the bundle grows substantially.** Cause: the directive was added wherever an error appeared, which is usually a page or layout — and everything those import joins the client bundle. Fix: for each directive, name which of the four reasons the file needs. Where you cannot, move it down to the leaf that can.

**★ Symptom: `'use client'` "fixed" a hook error and now a server-only import in the same file fails.** Cause: the file moved to the client, so its server-only code moved with it. The second error is the first error's real message. Fix: extract the interactive part into its own file rather than converting the whole module.

**★ Symptom: a component works in dev and throws `window is not defined` at build.** Cause: browser API access during render. Fix: decide which of two things it is — genuinely interactive, so mark it client; or incidental, so move the access into an effect. Adding the directive because the error mentions the browser is the reflex this page is about.

**★ Symptom: a library's hook fails and the whole page gets marked client to fix it.** Cause: attributing the client requirement to your code rather than the dependency. Fix: wrap the library import in a one-line `'use client'` module and re-export it, leaving your page on the server.

**★ Symptom: you publish a component library and consumers report the directive has no effect.** Cause: some bundlers strip `"use client"` during the build. Fix: check the published output, not the source. This must be verified, because it fails only in other people's projects.

**Symptom: a reviewer cannot tell why a file is a Client Component.** Cause: the directive carries no reason with it. Fix: if the reason is not obvious in the first few lines — a `useState`, a handler — it probably does not belong there. That legibility is itself a useful test.

**Symptom: `'use client'` on a file with no hooks or handlers at all.** Cause: it was added to a barrel or index file, so the directive is nowhere near the thing that needed it, and the entire barrel's exports now ship. Fix: never put the directive on a re-export barrel; put it on the implementation file.

## Interview questions

**★ When should you write `'use client'`?**
When the component needs one of exactly four things: state and event handlers, lifecycle logic, browser-only APIs, or custom hooks built on those. That list is the whole test, and applying it mechanically settles most cases immediately. What is *not* on it matters as much: fetching data, reading secrets, formatting, mapping over arrays — all cheaper on the server. If you cannot name which of the four a component needs, it should not carry the directive.

**★ Someone adds `'use client'` because a hook threw an error. Why is that a problem even though the error goes away?**
Because the directive does not fix the error, it relocates the code. The component and everything it imports move to the browser, so the symptom disappears while the bundle grows and server-only work quietly becomes client work. It is dangerous precisely because the page renders identically — nothing signals the cost. The right response is to ask which of the four reasons applies; usually the answer is that a parent is holding state belonging in a leaf, and extracting the leaf is the real fix.

**★ Where should the directive go, and why does placement matter more than the decision to use it?**
On the smallest component that needs it. Everything a `'use client'` file imports joins the client bundle, so the same directive on a page versus on a leaf produces identical output and very different bundles. That makes placement the higher-leverage decision — being right that a component needs the client, but marking the page instead of the leaf, ships the whole subtree. It is also why a directive on `page.tsx` or `layout.tsx` deserves scrutiny in review: those sit above everything.

**Does a Client Component make its children client too?**
No — only its imports. Children arrive as props, so they are not in its module graph and still render on the server. That is why a root-level context provider is harmless while a root-level `'use client'` page is not: the provider wraps children, the page imports its subtree. Confusing the two leads people to either avoid providers unnecessarily or accept a client page they should have split.

**How do you handle a third-party component that needs the client but ships no directive?**
Either use it inside a file that is already a Client Component, where it works unchanged, or — better when several server pages need it — write a one-line wrapper module that adds `'use client'` and re-exports it, then import the wrapper. The key judgement is not marking your own page client to accommodate someone else's dependency. If you are the library author, add the directive to entry points relying on client-only features, and verify it survives your bundler, since some strip it and the failure only shows up downstream.

**What is wrong with putting `'use client'` on a barrel file?**
The directive lands nowhere near the component that needed it, and every export in the barrel becomes client code. So one component's need for `useState` ships the entire module's worth of exports and their imports. It also destroys legibility — a reviewer opening the barrel sees a directive with no hook or handler anywhere near it. Put it on the implementation file.

---

← Prev [01 · Default architecture: everything is a Server Component](01-default-architecture-everything-is-a-server-component-rsc.md) · [Index](01-explanation.md) · Next → [03 · Composition patterns](03-composition-patterns-server-to-client-boundaries.md)
