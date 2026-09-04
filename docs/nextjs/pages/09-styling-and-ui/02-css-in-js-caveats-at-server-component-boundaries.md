---
title: "Runtime CSS-in-JS does not fail in Server Components because someone forgot to add support — it fails because the library's job is to produce styles during a browser render and a Server Component's output is serialized HTML with no render to hook"
sidebar_label: "02 · Why runtime CSS-in-JS breaks"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js) (page self-reports `version: 16.3.4`, `lastUpdated: 2026-03-24`) and [React client hook in Server Component](https://nextjs.org/docs/messages/react-client-hook-in-server-component). React **19.2.8** probed on the installed package (`require('./node_modules/react/package.json').version`). 🔴 `next` is **not installed in this checkout** — `require('next/package.json')` throws `MODULE_NOT_FOUND` — so no claim here is probed from the Next.js package. Node floor **20.9**. **No sandbox run**: no build output, no error transcript, no reconstructed stack trace.

**A runtime CSS-in-JS library works by executing during render, computing a class name from your props, and inserting a rule into a live stylesheet in the document. Every clause in that sentence assumes a browser and a mutable document. A Server Component runs once, on the server, produces a serialized payload, and is never re-rendered on the client — there is no document to insert into, no client render to hook, no component instance to hold a stylesheet, and the hooks the library uses to manage all of it are client-only by definition. This is not a gap in the library's Next.js support. It is the two designs being incompatible at the level of what a render *is*. Understanding that is what lets you predict, rather than discover, which libraries work and which do not.**

## What the documentation actually says — and, precisely, what it does not

The guide's framing sentence scopes support and stops:

> *"The following libraries are supported in Client Components in the `app` directory (alphabetical)"*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

The list: `ant-design`, `chakra-ui`, `@fluentui/react-components`, `kuma-ui`, `@mui/material`, `@mui/joy`, `pandacss`, `styled-jsx`, `styled-components`, `stylex`, `tamagui`, `tss-react`, `vanilla-extract`. And:

> *"The following are currently working on support:"* — `emotion`
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

Plus the standing warning:

> *"**Warning:** Using CSS-in-JS with newer React features like Server Components and Streaming requires library authors to support the latest version of React, including [concurrent rendering](https://react.dev/blog/2022/03/29/react-v18#what-is-concurrent-react)."*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

🔴 **What the page does not contain, and I checked:** there is no sentence saying "CSS-in-JS is not supported in Server Components", no error message, and no description of the symptom. It scopes support to Client Components and leaves the mechanism to you. So the rest of this page separates two things carefully — what is quoted, and what is derived. Where it is derived, it says so.

## The mechanism: three separate walls, in the order you hit them

### Wall 1 — the library's API is built out of client-only React

A styled component is not a plain function that returns a string. In a runtime library it is a React component that reads a theme from context, holds or consults a stylesheet across renders, and inserts rules before the browser paints. That is `useContext`, `useState` and insertion-effect machinery — every one of which is a client hook. A Server Component may not call them, and Next.js has a documented error class for exactly this, whatever the calling library happens to be:

> *"## Why This Error Occurred
> You are using a React client hook in a Server Component.
> ## Possible Ways to Fix It
> Mark the component using the hook as a Client Component by adding `'use client'` at the top of the file."*
> — [React client hook in Server Component](https://nextjs.org/docs/messages/react-client-hook-in-server-component)

⚠️ That page states the cause and the fix but **does not print the full runtime error string**. Any exact wording you have seen quoted for this — the familiar *"You're importing a component that needs …"* phrasing — is not on that page and I will not reproduce it from memory. Search for the error's title, *"React client hook in Server Component"*, which is quotable.

### Wall 2 — there is nowhere to put the rule

Suppose a library avoided hooks entirely. It still has to get a CSS rule into the response. On the client that is trivial: append to a stylesheet in the document. On the server there is no document — there is a stream of HTML being produced, and by the time the component that generated a rule has been serialized, the `<head>` may already have been flushed to the browser.

This is not speculation; it is precisely the problem the documented setup exists to solve:

> *"Configuring CSS-in-JS is a three-step opt-in process that involves:
> 1. A **style registry** to collect all CSS rules in a render.
> 2. The new `useServerInsertedHTML` hook to inject rules before any content that might use them.
> 3. A Client Component that wraps your app with the style registry during initial server-side rendering."*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

Read step 3 again. **The registry is a Client Component.** The framework's own answer to "how do I use runtime CSS-in-JS on the server" begins by putting a client boundary at the top of the tree. There is no server-side version of this pattern, and that is the whole caveat this chapter is named after. What that boundary costs is [02b](02b-style-registries-and-what-the-client-boundary-actually-costs.md).

### Wall 3 — nothing about the library survives serialization

A Server Component's output crosses to the client as a serialized payload. Functions do not serialize. So even patterns that look like they should work — computing a style object on the server and passing it down, or passing an interpolation function as a prop into a client-side styled component — fail at the boundary, because the thing you are passing is a function. That constraint is the general one from [ch3 · composition patterns](../03-server-components-vs-client-components/03-composition-patterns-server-to-client-boundaries.md); it just bites CSS-in-JS particularly hard, because interpolation functions are the library's central idiom.

```tsx
// app/page.tsx — a Server Component
import { Card } from './card'   // a 'use client' styled component

export default function Page() {
  return (
    // 🔴 Not serializable: the value of `tone` is a function, and functions
    // cannot cross the server/client boundary as props.
    <Card tone={(props: { active: boolean }) => (props.active ? 'red' : 'blue')}>
      Hello
    </Card>
  )
}
```

```tsx
// app/page.tsx — the same intent, expressed with serializable data
import { Card } from './card'

export default function Page() {
  return (
    <Card active={true}>
      Hello
    </Card>
  )
}
```

## What the failure actually looks like — derived, and labelled as such

⚠️ **The Next.js documentation does not state the symptom.** What follows is derived from the three walls above; treat it as a prediction to check against your own build, not as a quoted rule.

**If the library's component is imported directly into a Server Component**, you hit Wall 1 first and the failure is an **error**, not silent breakage — the documented "React client hook in a Server Component" class. This is the good outcome: it is loud, it names the file, and the fix is a `'use client'` directive.

**If everything is correctly marked `'use client'` but no style registry is installed**, you hit Wall 2 and the failure is *not* an error. The server renders the markup — including whatever class names the library generated — but the rules never reach the response, because nothing collected and flushed them. The browser therefore receives HTML referencing classes that no stylesheet defines, and the styles appear only once the library's client runtime boots and injects them. Observationally that is a **flash of unstyled content**: correct layout after hydration, wrong before it. This is exactly what the registry's stated purpose implies:

> *"During server rendering, styles will be extracted to a global registry and flushed to the `<head>` of your HTML. This ensures the style rules are placed before any content that might use them."*
> — [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js)

**Whether you additionally get a hydration mismatch is not something I can settle from the documentation, and I am not going to assert it.** It depends on whether the library's server-generated class names match the ones it computes on the client — a per-library property. If you see a hydration warning alongside unstyled content, suspect a class-name-hashing difference between server and client and check that library's own documentation; do not assume it is a Next.js issue.

## Runtime versus compile-time is the distinction that predicts everything

The supported list mixes two fundamentally different architectures, and the documentation does not separate them. ⚠️ **The classification below is mine, by how each library is designed to work — the Next.js page lists all of them together without classifying anything. Confirm any individual library against its own documentation before relying on this.**

**Runtime CSS-in-JS** generates CSS while React renders. The style is a function of props, evaluated per render, inserted into a live stylesheet. `styled-components` and `styled-jsx` are documented here with exactly the registry apparatus that a runtime architecture requires, which is the tell.

**Zero-runtime / compile-time extraction** does the generation at build time. Your source uses a styling API, a build step evaluates it and emits a static `.css` file, and what ships is a stylesheet plus class-name constants. `vanilla-extract`, `stylex` and `pandacss` are on the list; a build-time extractor's output is, at runtime, indistinguishable from a CSS Module — a stylesheet and a string.

**The test that tells you which you have, without reading any marketing:** *does a class name for a value that only exists at runtime require the library to be present in the browser?* If styling by `color={user.themeColor}` produces a new CSS rule, the library must run in the browser and it is runtime. If the API forces you to enumerate variants ahead of time so the build can emit them all, it is compile-time.

The consequence is the whole point of this page: **a compile-time library's output is a stylesheet, and a Server Component can reference a class name from a stylesheet perfectly well** — it is a string in the serialized HTML. So compile-time extraction is compatible with Server Components in a way that a runtime library structurally is not.

## The decision that follows

Three roads, and choosing between them deliberately is **02c** *(not written yet)*: adopt a zero-runtime library, keep the runtime library behind a client boundary and pay for it, or move to CSS Modules and Tailwind, which is what the Next.js CSS documentation recommends by default ([01c](01c-tailwind-v4-css-first-config-and-coexisting-with-css-modules.md)).

## Gotchas

**★ Symptom: importing a styled component into a page produces a "React client hook in Server Component" error.** Cause: the library's component calls a client hook — context, state, insertion effects — and a Server Component may not. Fix: add `'use client'` to the file that defines the styled component, not to the page. Marking the page client would drag the entire route into the client bundle to solve a problem that belongs one file lower.

```tsx
// app/ui/card.tsx
'use client'

import styled from 'styled-components'

export const Card = styled.div`
  border-radius: 8px;
  padding: 16px;
  background: var(--color-surface);
`
```

**★ Symptom: the page renders unstyled for a moment and then snaps into place.** Cause: no style registry, so nothing collected the server-rendered rules and flushed them into `<head>`; the styles arrive only when the library's client runtime boots. Fix: install the registry described in [02b](02b-style-registries-and-what-the-client-boundary-actually-costs.md). ⚠️ Derived symptom — the documentation states the registry's purpose but not the failure appearance.

**★ Symptom: "functions cannot be passed directly to Client Components" when styling by prop.** Cause: an interpolation function passed across the server/client boundary. Props crossing that boundary must be serializable, and a function is not. Fix: pass the *data* and keep the function on the client side of the boundary — the corrected example above.

**Symptom: a library on the supported list still does not work.** Cause: the list is scoped — *"supported in Client Components in the `app` directory"* — so being listed says nothing about Server Component usage. Fix: read the list as "this library can be made to work behind a client boundary", which is what it says.

**Symptom: `emotion` behaves differently from every other library you tried.** Cause: at the time of this page's sources, emotion is documented under *"The following are currently working on support"*, not under the supported list. Fix: check the linked upstream issue for the current state before adopting it; do not infer from a blog post that the situation has changed.

**Symptom: `styled-jsx` fails in a way none of the examples cover.** Cause: the documentation pins a minimum — *"Using `styled-jsx` in Client Components requires using `v5.1.0`"*. Fix: check the installed version against that floor before debugging anything else.

**Symptom: a library "works" in development and produces unstyled HTML in production.** Cause: development renders and hydrates aggressively enough that a missing server-side extraction path can be invisible; the production HTML response is where the absence of flushed rules shows. Fix: judge server-rendered styling by viewing source on a production build, not by looking at the hydrated DOM in dev.

**Symptom: you "fixed" the error by putting `'use client'` at the top of the route's page.** Cause: it does remove the error, because now nothing in that file is a Server Component. Fix: it is not a fix — it converts the whole route to client rendering and forfeits everything Server Components were there for. Move the directive to the leaf that needs it; see [ch3 · `'use client'`: when and why](../03-server-components-vs-client-components/02-use-client-when-and-why-to-opt-in-interactivity-browser-apis.md).

## Interview questions

**★ Why can't a Server Component use `styled-components`?**
Because the two designs disagree about what a render is. A runtime CSS-in-JS component computes a class name from props during render and inserts the corresponding rule into a live stylesheet — which requires a browser document, a component instance that persists across renders, and React client hooks (context for the theme, state for the sheet, insertion effects for the injection). A Server Component runs once on the server and produces a serialized payload; it has no document to inject into, is never re-rendered on the client, and may not call client hooks at all. The immediate error you get is the documented "React client hook in Server Component" class, but the reason underneath is architectural, not a missing feature.

**★ Which CSS-in-JS libraries work with Server Components, and how do you tell without a compatibility table?**
Ask whether the library generates CSS at build time or at render time. A compile-time extractor emits a real `.css` file during the build and leaves your components holding nothing but class-name strings — and a string is exactly what a Server Component can put in serialized HTML, so it works with no client boundary at all. A runtime library must be present and executing in the browser to produce a rule for a value it only learns at render time, so it needs a Client Component. The practical test: if styling by an arbitrary runtime value creates a new rule, it is runtime. The Next.js docs list both kinds together without distinguishing them, so this is a judgement you make from the library's own design.

**★ What does the failure look like, exactly?**
It depends which wall you hit. Importing the styled component into a Server Component fails loudly with the documented client-hook error, naming the file — the best case. If everything is correctly marked `'use client'` but no style registry is installed, there is no error at all: the server-rendered HTML carries class names that no stylesheet defines, and the styles appear only when the library's client runtime boots, so the user sees a flash of unstyled content. I want to be explicit that the Next.js documentation does not describe either symptom — it states the registry's purpose, which is that styles are *"flushed to the `<head>` of your HTML"* so they arrive *"before any content that might use them"*, and the symptom follows from that. Whether you also get a hydration mismatch depends on whether that library hashes class names identically on server and client, which the docs do not settle.

**Why is a style registry a Client Component, when its entire purpose is server-side extraction?**
Because the extraction has to be coordinated with React's client-side handover. The registry collects rules during the server render and flushes them through `useServerInsertedHTML`, but the same library instance then has to take over in the browser and keep injecting dynamic styles after hydration — so the object holding the sheet has to exist on both sides of the boundary, and only a Client Component does. The documentation also gives an efficiency reason: putting it at the top of the tree *"avoids re-generating styles on subsequent server renders, and prevents them from being sent in the Server Component payload."*

**Why does passing a styling interpolation function from a Server Component to a Client Component fail?**
Because props crossing that boundary are serialized, and functions do not serialize. This is a general Server Component rule rather than anything to do with CSS, but it collides with CSS-in-JS especially hard because prop-interpolation functions are the idiom the whole library is built around. The fix is always the same shape: send the data across the boundary and keep the function on the client side of it.

**The docs list `vanilla-extract` next to `styled-components`. Are they interchangeable choices?**
No, and the shared list is misleading if you read it as a menu. `styled-components` is documented on that page with an entire registry apparatus — a `ServerStyleSheet`, a `StyleSheetManager`, a `useServerInsertedHTML` flush and a compiler flag — because it must run to produce styles. A build-time extractor emits a stylesheet during the build, so at runtime it is closer to a CSS Module than to `styled-components`. They occupy the same list because both can be made to work; they impose entirely different costs on your component tree.

**What does the warning about "concurrent rendering" at the top of the guide really mean for your library choice?**
That compatibility is a property of the library's maintenance, not of your configuration. The documented warning is that using CSS-in-JS with Server Components and Streaming *"requires library authors to support the latest version of React"*. Under streaming, a component's markup can be flushed to the browser before later components have even rendered, so a library that assumes it can collect every rule and inject them once at the end is wrong by construction. That is why the list has a "currently working on support" section at all, and why a library's React-version support policy is a legitimate selection criterion.

---

← [01c · Tailwind v4 and coexistence](01c-tailwind-v4-css-first-config-and-coexisting-with-css-modules.md) · [Chapter index](01-explanation.md) · Next → [02b · Style registries and the client boundary](02b-style-registries-and-what-the-client-boundary-actually-costs.md)
