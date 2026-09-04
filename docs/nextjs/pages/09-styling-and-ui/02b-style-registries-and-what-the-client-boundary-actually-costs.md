---
title: "The style registry is a Client Component at the top of your tree, and the bill for it is not the wrapper — it is that every component which touches the styling API becomes a Client Component too"
sidebar_label: "02b · Registries and their cost"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js) (page self-reports `version: 16.3.4`, `lastUpdated: 2026-03-24`); all registry code below is reproduced from that page. React **19.2.8** probed on the installed package. 🔴 `next` is **not installed in this checkout** (`MODULE_NOT_FOUND`), so nothing here is probed. Node floor **20.9**. **No sandbox run** — no build output, no bundle measurements, no error transcripts.

**Everyone reads "wrap your app in a `'use client'` provider" and concludes that the whole application has just become a client application. It has not — children passed through a Client Component as the `children` prop keep rendering on the server, which is exactly why the documented registry takes `children` and does nothing else with them. The real cost is somewhere less obvious and much larger: a runtime CSS-in-JS library can only be *called* from a Client Component, so every component in your design system that uses `styled` carries `'use client'`, ships to the browser, and can never fetch data on the server. The provider is cheap. The styling API is what converts your component library into a client bundle.**

## The documented pattern, and what each line is for

> *"Configuring CSS-in-JS is a three-step opt-in process that involves:
> 1. A **style registry** to collect all CSS rules in a render.
> 2. The new `useServerInsertedHTML` hook to inject rules before any content that might use them.
> 3. A Client Component that wraps your app with the style registry during initial server-side rendering."*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

### `styled-jsx`

The documentation notes a version floor: *"Using `styled-jsx` in Client Components requires using `v5.1.0`."*

```tsx
// app/registry.tsx
'use client'

import React, { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { StyleRegistry, createStyleRegistry } from 'styled-jsx'

export default function StyledJsxRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  // Only create stylesheet once with lazy initial state
  // x-ref: https://reactjs.org/docs/hooks-reference.html#lazy-initial-state
  const [jsxStyleRegistry] = useState(() => createStyleRegistry())

  useServerInsertedHTML(() => {
    const styles = jsxStyleRegistry.styles()
    jsxStyleRegistry.flush()
    return <>{styles}</>
  })

  return <StyleRegistry registry={jsxStyleRegistry}>{children}</StyleRegistry>
}
```

```tsx
// app/layout.tsx
import StyledJsxRegistry from './registry'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <body>
        <StyledJsxRegistry>{children}</StyledJsxRegistry>
      </body>
    </html>
  )
}
```

### `styled-components`

First the compiler flag, which is not optional:

```js
// next.config.js
module.exports = {
  compiler: {
    styledComponents: true,
  },
}
```

Then the registry:

```tsx
// lib/registry.tsx
'use client'

import React, { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { ServerStyleSheet, StyleSheetManager } from 'styled-components'

export default function StyledComponentsRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  // Only create stylesheet once with lazy initial state
  // x-ref: https://reactjs.org/docs/hooks-reference.html#lazy-initial-state
  const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet())

  useServerInsertedHTML(() => {
    const styles = styledComponentsStyleSheet.getStyleElement()
    styledComponentsStyleSheet.instance.clearTag()
    return <>{styles}</>
  })

  if (typeof window !== 'undefined') return <>{children}</>

  return (
    <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>
      {children}
    </StyleSheetManager>
  )
}
```

```tsx
// app/layout.tsx
import StyledComponentsRegistry from './lib/registry'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <body>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  )
}
```

**Four details worth reading rather than copying:**

- **The lazy `useState` initialiser** — `useState(() => new ServerStyleSheet())`, not `useState(new ServerStyleSheet())`. The second form constructs a fresh sheet on **every render** and throws it away; the state only keeps the first. The docs annotate this in the code itself, which tells you how often it is got wrong.
- **The flush inside `useServerInsertedHTML`** — `flush()` for styled-jsx, `instance.clearTag()` for styled-components. Without it, every insertion point re-emits every rule collected so far, so the same CSS is duplicated once per streamed chunk.
- **The client early return** — `if (typeof window !== 'undefined')` returns the children unwrapped. Server-side extraction is finished by then, and the library takes over injection itself: *"After client-side hydration is complete, `styled-components` will take over as usual and inject any further dynamic styles."*
- **The registry sits inside `<body>`, wrapping `children`** — not around `<html>`. Its output goes elsewhere; the wrapper only needs to be an ancestor of the components that generate styles.

## Where the styles go, and where the documentation stops

> *"During server rendering, styles will be extracted to a global registry and flushed to the `<head>` of your HTML. This ensures the style rules are placed before any content that might use them. In the future, we may use an upcoming React feature to determine where to inject the styles."*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

> *"During streaming, styles from each chunk will be collected and appended to existing styles. After client-side hydration is complete, `styled-components` will take over as usual and inject any further dynamic styles."*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

⚠️ **The second quote says styles from each streamed chunk are *appended to existing styles*; it does not say where in the document that append lands.** A page streamed in several chunks generates style output more than once, and I could not settle from this documentation whether later batches are still placed in `<head>`. Do not build a CSP or a CSS-ordering assumption on the answer without checking it yourself — and note the docs' own hedge that the injection point may change in future.

## 🔴 What the wrapper does *not* cost

The most common misreading of this pattern is that wrapping the root layout in a `'use client'` provider converts the application to client rendering. It does not, and the reason is the `children` prop.

`'use client'` marks a **module boundary in the import graph**, not a region of the rendered tree. Everything the registry module imports becomes client code. But `children` is not imported by the registry — it is passed in, already rendered, by a Server Component. The registry only forwards it. The page and its subtree therefore keep rendering on the server, and the registry never sees their source. This is the standard composition pattern, and it is worth reading in its own right: [ch3 · composition patterns](../03-server-components-vs-client-components/03-composition-patterns-server-to-client-boundaries.md).

The documentation gives an independent reason to put the registry at the very top:

> *"We specifically use a Client Component at the top level of the tree for the style registry because it's more efficient to extract CSS rules this way. It avoids re-generating styles on subsequent server renders, and prevents them from being sent in the Server Component payload."*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

## What it actually costs

**1 · Every component that calls the styling API is a Client Component.** This is the cost, and it is structural. `styled.div` cannot be invoked in a Server Component, so a design system built on it is `'use client'` from top to bottom — including the components with no interactivity at all, the ones that exist purely to draw a border. Those all ship to the browser. The bundle consequences are [ch3 · bundle size and Core Web Vitals](../03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md) and [ch11 · bundle analysis](../11-performance-optimization-turbopack/03-bundle-analysis-dynamic-imports-lazy-loading.md).

**2 · The library itself ships and runs in the browser.** A runtime library is not a build tool you can leave behind; it is a dependency of the client bundle that executes on every render to compute class names.

**3 · Those components cannot fetch data on the server.** A Client Component cannot be an `async` server component, so a card that wanted to `await` from the database now takes props from a server parent, or fetches over the network from an effect. This is usually a bigger architectural cost than the bytes.

**4 · You get styling that is invisible to server-side reasoning.** A Server Component cannot ask what class a styled component will produce, because the answer is computed in a render it does not participate in.

**5 · Strict CSP.** A runtime library injects rules through inline `<style>` output, which a strict `style-src` policy blocks unless you nonce or hash it, and the nonce path pulls the route into dynamic rendering. That trade — and the nonce mechanics — belongs to [ch10 · CSP nonces and the dynamic rendering tax](../10-forms-authentication-and-security-hardening/10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md), which owns the subject; this page only draws the arrow.

A stylesheet — from CSS Modules, Tailwind, or a compile-time extractor — has none of these five properties. That asymmetry is what drives the choice between adopting a zero-runtime library, paying for the client boundary, and moving to CSS Modules or Tailwind.

## Gotchas

**★ Symptom: the same CSS rules appear repeatedly in the HTML response.** Cause: the registry's insertion callback returns the accumulated styles without clearing them, so each streamed insertion point re-emits everything collected so far. Fix: flush inside the callback — `jsxStyleRegistry.flush()` for styled-jsx, `styledComponentsStyleSheet.instance.clearTag()` for styled-components — exactly as the documented registries do.

**★ Symptom: styles are missing or intermittently wrong, and the registry looks correct.** Cause: `useState(new ServerStyleSheet())` instead of `useState(() => new ServerStyleSheet())`. The eager form builds a new sheet on every render; React keeps the first, so rules collected into the discarded sheets are lost. Fix: use the lazy initialiser, which is why the documented code carries that comment.

**★ Symptom: `styled-components` renders unstyled server HTML even with the registry installed.** Cause: `compiler.styledComponents` was never enabled in `next.config.js`. The documentation shows the flag as the first step, before the registry. Fix:

```js
// next.config.js
module.exports = {
  compiler: {
    styledComponents: true,
  },
}
```

**★ Symptom: adding the provider turned the whole app into a client app, or so a reviewer claims.** Cause: a misreading of `'use client'` as a subtree marker. It is an import-graph boundary; `children` handed in by a Server Component were rendered before the registry ever saw them and stay server-rendered. Fix: nothing to fix — but verify by checking that a server-only API still works inside a page rendered through the registry, rather than arguing about it.

**Symptom: server-only code inside a design-system component fails to compile.** Cause: the component is `'use client'` because it calls the styling API, and a Client Component cannot be `async` or read server-only modules. Fix: lift the data access to a Server Component parent and pass serializable props down.

**Symptom: a strict Content Security Policy blocks the injected styles.** Cause: the library emits inline `<style>` content, which `style-src 'self'` refuses. Fix: the nonce mechanics and their cost are [ch10 · CSP nonces and the dynamic rendering tax](../10-forms-authentication-and-security-hardening/10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md); the cheaper structural fix is a styling approach that emits a real stylesheet instead of inline rules.

**Symptom: two registries, or a registry that also wraps a nested layout.** Cause: someone added the provider again lower in the tree. Two sheets collect two disjoint halves of the rules and each flushes independently. Fix: exactly one registry, in the root layout, wrapping `children`.

**Symptom: the registry works locally and produces unstyled HTML in production.** Cause: in development the page may hydrate fast enough that missing server extraction is invisible in the DOM; the server response is where the absence shows. Fix: judge it from the HTML source of a production build, not the inspected DOM.

**Symptom: styles from a streamed part of the page arrive late or out of order.** Cause: streaming collects and appends styles per chunk rather than emitting everything once. Fix: verify against your own build — ⚠️ the documentation states the append behaviour but not the resulting DOM position, and explicitly says the injection point may change, so this is not something to design around.

## Interview questions

**★ Does wrapping the root layout in a `'use client'` style registry make the whole application client-rendered?**
No, and understanding why is the crux of Server Component composition. `'use client'` marks a boundary in the **import graph**: modules the registry imports become client modules. `children` is not imported — it is passed in as an already-rendered prop by a Server Component, and the registry only forwards it. So the page and its whole subtree still render on the server. The documented registries take exactly one prop, `children`, and that is precisely why.

**★ Then where does the cost actually land?**
On the components that *call* the styling API. `styled.div` needs client React, so every component built with it carries `'use client'` — including purely presentational ones — and they all ship to the browser along with the library's runtime. Worse than the bytes: those components can no longer be `async` server components, so any data they wanted to fetch has to be lifted to a server parent and threaded down as serializable props. The provider is one small client module; the design system is the bundle.

**★ Why is the sheet created with a lazy `useState` initialiser rather than constructed directly?**
Because a component function body runs on every render. `useState(new ServerStyleSheet())` constructs a new sheet each time and discards all but the first — with rules potentially collected into sheets React then throws away. `useState(() => new ServerStyleSheet())` calls the initialiser only on the first render, so exactly one sheet exists per request. The Next.js documentation ships this with an inline comment pointing at React's lazy-initial-state docs, which is a strong hint about how commonly it is got wrong.

**★ Why must the registry flush inside `useServerInsertedHTML`?**
Because the hook can be invoked more than once while the response streams, and the sheet is cumulative. If the callback returns the full contents each time without clearing, every insertion point re-emits every rule collected so far, and the response carries the same CSS several times over. `flush()` and `clearTag()` exist so each insertion emits only what is new — which is the documented streaming behaviour: styles from each chunk are collected and appended to what is already there.

**Why does the styled-components registry return children unwrapped when `window` is defined?**
Because the `StyleSheetManager` with a server sheet is only needed for the server-side extraction pass. Once the code is running in the browser, the library manages its own injection directly — the docs put it as, after hydration completes, styled-components *"will take over as usual and inject any further dynamic styles."* Keeping the manager mounted on the client would add a wrapper doing nothing useful.

**Why does the documentation put the registry at the very top of the tree rather than around the subtree that needs it?**
For extraction efficiency, in its own words: it is *"more efficient to extract CSS rules this way. It avoids re-generating styles on subsequent server renders, and prevents them from being sent in the Server Component payload."* One registry per request collects everything once. A registry per subtree would fragment collection, duplicate work across server renders, and push style data into the payload where it costs bytes without helping.

**How does runtime CSS-in-JS interact with a strict Content Security Policy?**
Badly, and predictably: the library's output is inline style content, which a strict `style-src` blocks outright. Making it work means nonce-ing or hashing that inline content, and taking on the rendering consequences that come with per-request nonces — which is its own topic, [ch10 · CSP nonces and the dynamic rendering tax](../10-forms-authentication-and-security-hardening/10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md). If a strict CSP is a hard requirement, this is a reason to prefer a styling approach whose output is a static stylesheet, because a stylesheet needs no exception at all.

**What would you check first if a page rendered by the registry still ships unstyled HTML?**
The production HTML source, not the hydrated DOM — the DOM will look right either way once the client runtime boots. Then, in order: whether `compiler.styledComponents` is enabled, whether the registry is actually an ancestor of the styled components rather than a sibling, whether the sheet is created lazily, and whether a second registry exists lower in the tree splitting the collection in two.

---

← [02 · Why runtime CSS-in-JS breaks](02-css-in-js-caveats-at-server-component-boundaries.md) · [Chapter index](01-explanation.md) · Next → [03 · Font optimization with `next/font`](03-font-optimization-with-next-font-zero-layout-shift.md)
