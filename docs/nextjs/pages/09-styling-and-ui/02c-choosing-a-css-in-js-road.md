---
title: "There are exactly three roads out of runtime CSS-in-JS on the App Router, the choice is a bundle-architecture decision rather than a styling-taste decision, and the one thing that is not on the menu is calling a runtime styling API from a Server Component"
sidebar_label: "02c · Choosing a road"
sidebar_position: 6
description: "The three exits from runtime CSS-in-JS in the App Router — compile-time extraction, a fenced client boundary, or CSS Modules and Tailwind — what each costs, which library sits where, the migration order, and how to decide without rewriting anything first."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against **Next.js 16.3.4** — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js) (page self-reports `version: 16.3.4`, `lastUpdated: 2026-03-24`) and [CSS](https://nextjs.org/docs/app/getting-started/css) (`version: 16.3.4`, `lastUpdated: 2026-08-25`). React **19.2.8**. Documentation-verified; **no sandbox run**, no bundle measurements, no timings.

**[02](02-css-in-js-caveats-at-server-component-boundaries.md) established the mechanism and [02b](02b-style-registries-and-what-the-client-boundary-actually-costs.md) established the bill: a runtime CSS-in-JS library can only be called from a Client Component, so the styling API — not the registry provider — is what converts a design system into a client bundle. This page is the decision that follows, and it is not a matter of taste. Every option is a statement about where CSS is generated: at build time, in the browser, or by a compiler that never runs at either. Pick the wrong one and you do not get ugly styles, you get a component library that structurally cannot fetch data on the server. The three roads are compile-time extraction, a deliberately fenced runtime boundary, and the stylesheet-based default the Next.js documentation itself recommends — and the honest answer for most existing codebases is a mixture with a direction of travel, not a single road taken all at once.**

## The road you are on, stated precisely

Before choosing, name the current state in one sentence, because the three roads have different starting costs from different starting points.

| You are here | The cost that dominates your choice |
|---|---|
| Greenfield, nothing written | Nothing sunk. Choose on architecture alone. |
| An existing app, runtime library, few components | The migration is small; the road you pick is the road you get. |
| An existing app, a large `styled`-based design system | 🔴 The API surface is the cost, not the CSS. Every call site changes. |
| A design system published as an npm package other teams consume | Your choice is *their* choice too, and they may not be on the App Router. |

## Road 1 — compile-time extraction

Replace the runtime library with one that emits a real stylesheet at build time. The documentation's supported list includes three that are built this way:

> *"The following libraries are supported in Client Components in the `app` directory (alphabetical): … `pandacss` … `stylex` … `vanilla-extract`"*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

⚠️ **The list itself does not classify them.** The Next.js page presents every library in one alphabetical list under one heading — *"supported in Client Components"* — and says nothing about runtime versus compile-time. The classification is the one argued in [02](02-css-in-js-caveats-at-server-component-boundaries.md), by how each library is designed to work; confirm any individual library against its own documentation before relying on it.

**What you get.** A build step evaluates your styling calls and emits `.css`. What ships to the browser is a stylesheet plus class-name constants — strings. A Server Component can hold a string, so the styled component stops needing `'use client'` for styling reasons.

```tsx
// app/ui/card.tsx — no 'use client' needed for styling
import { card, cardEmphasis } from './card.css'   // vanilla-extract emits a real .css file

export function Card({ emphasis, children }: { emphasis?: boolean; children: React.ReactNode }) {
  return <div className={emphasis ? cardEmphasis : card}>{children}</div>
}
```

**What it costs.** Dynamic values must be enumerated ahead of time. The test from [02](02-css-in-js-caveats-at-server-component-boundaries.md) applies in reverse: if your codebase styles by `color={user.themeColor}`, a compiler cannot emit that rule because the value does not exist at build time. The mechanical escape is a CSS custom property set inline, which is a style *value* rather than a generated rule:

```tsx
// The variant is enumerated at build time; the raw value rides in a CSS variable.
<div className={card} style={{ '--card-accent': user.themeColor } as React.CSSProperties}>
```

🔴 **This is the road with the sharpest failure mode when it is chosen carelessly, because it changes what is expressible.** A runtime library lets any prop become a rule. A compiler does not. If a large fraction of your call sites interpolate a value that only exists at request time, migrating is not a find-and-replace — it is a redesign of the styling API into variants plus custom properties, and that redesign is the actual project.

## Road 2 — keep the runtime library, fence it

Accept the runtime library and pay for it deliberately rather than accidentally. This is the documented three-step setup in [02b](02b-style-registries-and-what-the-client-boundary-actually-costs.md), plus one discipline the documentation does not state: **the styled primitives live in leaf components, and the components that fetch data are not among them.**

```tsx
// app/ui/badge.tsx — a leaf. It renders props; it fetches nothing.
'use client'
import styled from 'styled-components'

export const Badge = styled.span<{ $tone: 'ok' | 'warn' }>`
  padding: 2px 8px;
  border-radius: 999px;
  background: ${(p) => (p.$tone === 'ok' ? 'var(--ok)' : 'var(--warn)')};
`
```

```tsx
// app/boards/[boardId]/page.tsx — a Server Component. It fetches, and it composes a client leaf.
import { Badge } from '@/app/ui/badge'
import { listBoardCards } from '@/lib/dal/cards'

export default async function Page({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const cards = await listBoardCards(boardId)
  return (
    <ul>
      {cards.map((c) => (
        <li key={c.id}>
          {c.title} <Badge $tone={c.status === 'done' ? 'ok' : 'warn'}>{c.status}</Badge>
        </li>
      ))}
    </ul>
  )
}
```

**What it costs.** The runtime and every styled component ship to the browser, and the boundary has to be maintained by review rather than by the compiler. **What it buys.** Nothing changes at the call sites, which for a large existing design system is the entire argument.

⚠️ **This road has a live compatibility floor that is not about Next.js.** The guide opens with a warning that outranks any individual library page:

> *"Using CSS-in-JS with newer React features like Server Components and Streaming requires library authors to support the latest version of React, including concurrent rendering."*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

🔴 **`emotion` is not on the supported list.** The documentation places it under a separate heading — *"The following are currently working on support:"* — with a link to an open issue in the `emotion-js/emotion` repository. That is a materially different status from the thirteen libraries listed above it, and it is the single most common surprise on this road, because emotion is a transitive dependency of several component libraries rather than something a team chose. Check your lockfile, not your imports.

## Road 3 — stylesheets: CSS Modules and Tailwind

Leave CSS-in-JS entirely. This is what the Next.js documentation recommends when it states a preference, and it states one twice:

> *"We recommend using global styles for *truly* global CSS (like Tailwind's base styles), Tailwind CSS for component styling, and CSS Modules for custom scoped CSS when needed."*
> — [CSS](https://nextjs.org/docs/app/getting-started/css)

> *"**Use Tailwind CSS** for most styling needs as it covers common design patterns with utility classes."* · *"Use CSS Modules for component-specific styles when Tailwind utilities aren't sufficient."*
> — [CSS](https://nextjs.org/docs/app/getting-started/css), Recommendations

**What you get.** A class name is a string in the RSC payload and a Server Component may produce it, so the styling question disappears from the boundary question entirely. The setup is [01c](01c-tailwind-v4-css-first-config-and-coexisting-with-css-modules.md), and the ordering consequences — which are real and are the thing people underestimate on this road — are [01b](01b-css-import-order-chunking-and-what-css-costs.md).

**What it costs.** Co-location of style and logic in one file, which is the ergonomic property people actually like about CSS-in-JS. Dynamic values take the same custom-property escape as road 1.

## The decision, as criteria rather than preference

Answer these in order and stop at the first one that decides it.

| # | Question | If yes |
|---|---|---|
| 1 | Is the library on the supported list at all? | If it is only *"currently working on support"*, roads 1 or 3 — road 2 is a bet on someone else's issue tracker |
| 2 | Do your styled components need to fetch data or read request state? | Road 1 or 3. Road 2 makes this structurally impossible, per [02b](02b-style-registries-and-what-the-client-boundary-actually-costs.md) |
| 3 | Does a meaningful share of call sites interpolate a request-time value into a *rule*? | Road 2, or road 1 with a custom-property redesign budgeted |
| 4 | Is the design system consumed by teams you do not control? | Road 1 — its output is a stylesheet, which every consumer can use, App Router or not |
| 5 | Greenfield? | Road 3. It is the documented recommendation and it has no boundary story to maintain |

🔴 **The question that is *not* on this list is "which has the nicest API".** All three are pleasant to write. Only one of them determines whether your component library is allowed to be a Server Component, and that is the property you cannot change later without touching every call site.

## Mixing roads is normal; drifting between them is not

Nothing forces one road for the whole application, and the realistic end state for a migrating codebase is a mixture: Tailwind for layout and new work, a fenced `'use client'` island for the legacy design system, and a compile-time library only if someone actually adopted one. **What makes a mixture healthy rather than an accident is that it has a direction and a boundary you can grep for.**

```bash
# The two greps that tell you whether the boundary is real, run in CI rather than by memory.
grep -rl "from 'styled-components'" app components | xargs grep -L "'use client'"   # must be empty
grep -rl "from 'styled-components'" app/\(dashboard\)                              # must be empty if that route is server-first
```

⚠️ **A mixture doubles the ordering problem.** Two systems now insert CSS, and their relative order is not something either one controls — the registry flushes into `<head>` during the server render, and your stylesheets are ordered by import order. The interaction is genuinely un-obvious and the mitigation is not specificity wars but layers: keep the runtime library's output confined to components whose styles nothing else targets. The ordering rules themselves are [01b](01b-css-import-order-chunking-and-what-css-costs.md).

## What I could not confirm

- **The relative bundle cost of each road.** The documentation makes no size claims about any listed library, and there is no sandbox here to measure one. Any number in this area should come from your own build output, not from a page.
- **Whether a given library on the supported list is runtime or compile-time**, other than by its own design. The Next.js page lists all thirteen together under one heading and classifies none of them. The classification in [02](02-css-in-js-caveats-at-server-component-boundaries.md) is reasoned, not quoted.
- **When `emotion` support lands.** The documentation links an open issue and states no version or date. Treat *"currently working on support"* as its current status and re-check the guide rather than assuming.

## Gotchas

**★ Symptom: the team agrees to migrate to a zero-runtime library and the migration stalls at about 60%.** Cause: the remaining 40% are the components that interpolate a runtime value into a rule, which is exactly the set a compiler cannot express — so the easy call sites went first and the hard ones are all that is left. Fix: do the redesign *first* on the hardest component, not last. Convert one runtime interpolation into an enumerated variant plus a custom property, and only then decide whether the road is affordable.

```tsx
// Before — a rule per distinct value; a compiler cannot emit these.
const Bar = styled.div<{ $pct: number }>`width: ${(p) => p.$pct}%;`

// After — one rule, the value carried as a custom property.
<div className={bar} style={{ '--bar-pct': `${pct}%` } as React.CSSProperties} />
```

**★ Symptom: `'use client'` was added to the page to fix a styling error and the route's data fetching moved to the browser.** Cause: the directive was applied at the wrong level. Fix: mark the file that defines the styled component, never the page — the same fix as in [02](02-css-in-js-caveats-at-server-component-boundaries.md), and the reason it belongs on this page too is that "just add `'use client'` higher up" is how road 2 silently becomes a client-rendered application.

**★ Symptom: the app uses no CSS-in-JS library, and a runtime one is in the bundle anyway.** Cause: a component library brought it in transitively — `emotion` in particular, which is *not* on the supported list. Fix: check the lockfile rather than the imports, and decide deliberately whether that dependency is on road 2.

```bash
yarn why @emotion/react
```

**★ Symptom: a compile-time library is adopted and the styles for one variant are missing in production but present in development.** Cause: the variant is only reachable through a code path the build's static evaluation never sees, so no rule was emitted; in development the evaluation is more forgiving. Fix: enumerate variants in a form the compiler can see — a literal map — rather than computing the style key. This is a per-library property, so read that library's own extraction rules before assuming which forms it can follow.

**Symptom: the registry is set up, road 2 is chosen, and Server Components still cannot use the design system.** Cause: this is not a bug and no configuration fixes it — the registry solves style *delivery*, not the ability to call the styling API from the server. Fix: recognise it as the boundary being what it is, and choose road 1 or 3 if server-side composition is the requirement.

**Symptom: Tailwind and a runtime library are both in use and specificity fights break out after every refactor.** Cause: two insertion mechanisms with no defined relative order. Fix: confine the runtime library to components nothing else styles, rather than escalating specificity; and read [01b](01b-css-import-order-chunking-and-what-css-costs.md) before assuming import order is the whole story.

**Symptom: the road was chosen by measuring a hello-world bundle.** Cause: a benchmark of the runtime, when the cost that matters is the *fan-out of `'use client'`* across the component library. Fix: measure the real thing — count the components that would need the directive under road 2, because that count, not the library's own size, is what ships.

```bash
grep -rl "styled\." app components | wc -l    # the number of files that become Client Components
```

## Interview questions

**★ Why is choosing a CSS-in-JS library on the App Router a bundle-architecture decision rather than a styling decision?**
Because the choice determines *where* CSS is generated, and that determines which components are allowed to be Server Components. A runtime library generates rules while React renders, which requires the library to be present wherever rendering happens, which forces `'use client'` on every component that calls the styling API. Those components then ship to the browser and can never `await` a query. A compile-time library or a stylesheet produces a class name — a string — and a Server Component can produce a string. The styling API you pick therefore decides the shape of your component tree, and that is not something you can revisit cheaply, because it is expressed at every call site.

**★ The Next.js guide lists thirteen libraries as supported. Does that mean they are equivalent for App Router purposes?**
No, and the list's own heading is the qualifier: they are supported *"in Client Components in the `app` directory"*. That sentence is satisfied by a runtime library behind a registry and by a build-time extractor whose output is a plain stylesheet, and those two have opposite consequences for your tree. The page does not separate them, so the classification has to come from each library's own design. The practical test is whether styling by a value that only exists at runtime produces a new CSS rule; if it does, the library must run in the browser.

**★ What is the actual status of `emotion`, and why does it matter more than its position in a list?**
The documentation places it under *"The following are currently working on support:"*, separate from the thirteen supported libraries, with a link to an open issue. That is a statement about React compatibility — the guide's opening warning says using CSS-in-JS with Server Components and Streaming *"requires library authors to support the latest version of React, including concurrent rendering"*. It matters disproportionately because emotion frequently arrives as a transitive dependency of a component library rather than as a deliberate choice, so a team can be on road 2 without having decided to be. The check is the lockfile.

**★ You have a large `styled-components` design system and a mandate to make the dashboard server-rendered. What do you actually do first?**
Not a migration. First, separate the two questions: which components *need* to be on the server (the ones that fetch or read request state) and which are leaves that only render props. Almost always the styled components are leaves, and the fix is to stop marking pages `'use client'` and start marking the leaf files — which costs nothing and recovers server rendering for the data path. Only then is the migration question real, and it is narrower: it is about the components that both fetch and style, which is usually a small set worth converting to CSS Modules individually rather than rewriting the design system.

**★ Under compile-time extraction, how do you style by a value that only exists at request time?**
With a CSS custom property, because the value becomes a style *value* rather than a generated rule. The class comes from the build; the property comes from the render. This is not a workaround so much as the correct decomposition — a per-user accent colour was never a distinct rule, it was one rule with a parameter — and codebases that adopt it tend to shrink their emitted CSS, because a thousand generated rules collapse into one. The cases that resist it are the ones where the *structure* of the rule varies, not just a value, and those are the components that genuinely argue for road 2.

**Why does mixing roads make CSS ordering harder rather than just more varied?**
Because the two systems insert styles by different mechanisms with no relationship between them. The registry flushes collected rules into `<head>` during the server render; imported stylesheets are ordered by import order and then chunked by the build. Neither is aware of the other, so the final cascade is a property of the interaction rather than of either configuration. The stable answer is to make the question not arise — keep the runtime library's output on components nothing else targets — rather than to win it with specificity, which is a fix that decays with every refactor.

**A colleague argues the registry provider makes the whole app a client application, so the road is already lost. What is the correction?**
That children passed through a Client Component as the `children` prop keep rendering on the server, which is precisely why the documented registry accepts `children` and does nothing else with them. The provider is genuinely cheap. The expensive part is one level down and easy to miss: every component that *calls* the styling API needs the directive itself. So the argument is right about the conclusion for a large design system and wrong about the mechanism — and the distinction matters, because the fix follows the mechanism.

---

← [02b · Registries and their cost](02b-style-registries-and-what-the-client-boundary-actually-costs.md) · [Chapter index](01-explanation.md) · Next → [03 · Font optimization with `next/font`](03-font-optimization-with-next-font-zero-layout-shift.md)
