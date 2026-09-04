---
title: "`onLoad`, `onReady` and `onError` are the only way to know a third-party script arrived — and all three require a Client Component, which puts the one strategy that most needs a handler out of reach of the one place it is allowed to live"
sidebar_label: "05b · Script handlers"
sidebar_position: 10
description: "The three next/script event handlers at 16.3.4 — exact semantics, the Client Component requirement stated four times in the docs, why onReady is not onLoad, and the beforeInteractive contradiction the documentation never reconciles."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [`<Script>` API reference](https://nextjs.org/docs/app/api-reference/components/script) (doc `version: 16.3.4`, `lastUpdated: 2026-08-25`) and [Optimizing third-party scripts](https://nextjs.org/docs/app/guides/scripts) (`lastUpdated: 2026-06-01`).
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout** — no package probe was possible, so every claim below is a documentation quotation and the one place the documentation contradicts itself is labelled rather than resolved. **No sandbox run.**

**A third-party script is asynchronous, remote, and frequently blocked — by an ad blocker, a corporate proxy, a CSP you wrote yourself, or an outage at a vendor you have no relationship with. `onLoad`, `onReady` and `onError` are the entire mechanism `next/script` gives you for reacting to any of that, and there is a single sentence that governs all three: they only work inside a Client Component. That sentence is repeated four times across two documentation pages, which is unusual enough to be a signal. It is also the source of the one genuine contradiction in this API: `onLoad` is forbidden with `beforeInteractive`, the docs suggest `onReady` in its place, and `beforeInteractive` scripts are required to live in a root layout — a file nobody sane marks `'use client'`. The documentation never reconciles those two rules, and this page will not pretend that it does.**

## The three handlers, and what each actually promises

The guide states the semantics in one place:

> *"* `onLoad`: *Execute code after the script has finished loading.*
> * `onReady`: *Execute code after the script has finished loading and every time the component is mounted.*
> * `onError`: *Execute code if the script fails to load."*

Read `onReady` twice. It is not a synonym for `onLoad` with a better name — it fires on load **and again on every mount**. The reference explains the case it exists for:

> *"Some third-party scripts require users to run JavaScript code after the script has finished loading and every time the component is mounted (after a route navigation for example)."*

That is the whole distinction, and it maps directly onto a real class of vendor SDKs: the library loads once, but its `init()` has to be called again whenever the element it decorates is remounted. A payment field, a map, an embedded video player, a widget that scans the DOM for its own mount points.

| Handler | Fires on first load | Fires on remount | Fires on failure |
|---|---|---|---|
| `onLoad` | ✓ | ✗ | ✗ |
| `onReady` | ✓ | ✓ | ✗ |
| `onError` | ✗ | ✗ | ✓ |

## The Client Component rule

The reference states it three times — once per handler — and the guide states it once for all three. Verbatim, because the repetition is the point:

> *"**Warning:** `onLoad` does not yet work with Server Components and can only be used in Client Components. Further, `onLoad` can't be used with `beforeInteractive` – consider using `onReady` instead."*

> *"**Warning:** `onReady` does not yet work with Server Components and can only be used in Client Components."*

> *"**Warning:** `onError` does not yet work with Server Components and can only be used in Client Components. `onError` cannot be used with the `beforeInteractive` loading strategy."*

And the guide's consolidated form, which is the one to memorise:

> *"These handlers will only work when `next/script` is imported and used inside of a Client Component where `\"use client\"` is defined as the first line of code."*

This is not an arbitrary framework restriction; it is the RSC serialization boundary doing exactly what [chapter 3](../03-server-components-vs-client-components/03-composition-patterns-server-to-client-boundaries.md) says it does. A handler is a function, functions do not survive the trip from a Server Component to the client, and a `<Script>` rendered by a Server Component has nowhere to put one.

⚠️ **What the docs do not say is what the failure looks like.** *"Does not yet work"* covers a spectrum from a hard React error about non-serializable props to a handler that is quietly dropped. Do not design around one of those outcomes; design so the situation cannot arise.

### The shape that works

Isolate the script and its handlers in the smallest possible Client Component, and let the Server Component tree render that:

```tsx
// app/components/maps-loader.tsx
'use client'

import Script from 'next/script'
import { useState } from 'react'

export function MapsLoader({ apiKey }: { apiKey: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  return (
    <>
      <Script
        id="example-maps"
        src={`https://cdn.example-maps.com/sdk.js?key=${apiKey}`}
        strategy="lazyOnload"
        onReady={() => {
          window.ExampleMaps?.init({ container: '#board-map' })
          setStatus('ready')
        }}
        onError={() => setStatus('failed')}
      />
      {status === 'failed' && (
        <p role="status">Map unavailable — the location is listed below instead.</p>
      )}
    </>
  )
}
```

```tsx
// app/teams/[team]/board/page.tsx — still a Server Component
import { MapsLoader } from '@/app/components/maps-loader'

export default async function BoardPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params
  return (
    <main>
      <h1>{team}</h1>
      <div id="board-map" />
      <MapsLoader apiKey={process.env.NEXT_PUBLIC_MAPS_KEY!} />
    </main>
  )
}
```

The Client Component here is roughly twenty lines and ships almost nothing. That is the correct trade: the handler requirement pulls a leaf into the client bundle, not a page.

## `onError` is the only one that models the world honestly

Every other part of this API assumes the script arrives. `onError` is where you write down what your product does when it does not — and for a meaningful share of your users, it does not. Ad blockers remove analytics and chat vendors by hostname. A CSP that forgot a domain blocks the request. Vendors have outages.

```tsx
'use client'

import Script from 'next/script'
import { useState } from 'react'

export function SupportChat() {
  const [blocked, setBlocked] = useState(false)

  if (blocked) {
    return <a href="mailto:support@sprintdesk.dev">Email support</a>
  }

  return (
    <Script
      src="https://cdn.example-chat.com/widget.js"
      strategy="lazyOnload"
      onError={() => setBlocked(true)}
    />
  )
}
```

The fallback is four lines and it is the difference between "support is unavailable" and "support is a mailto". A `<Script>` with no `onError` is a silent single point of failure in your support funnel.

⚠️ `onError` is documented as firing *"if the script fails to load"*. It says nothing about a script that loads successfully and then throws while executing — that is a runtime error inside a third-party file, and it will not reach this handler.

## The `beforeInteractive` contradiction, stated rather than resolved

Assemble three separately-documented rules:

1. `beforeInteractive` scripts *"must be placed inside a root layout, such as `app/layout.tsx`"*.
2. `onLoad` *"can't be used with `beforeInteractive` – consider using `onReady` instead"*.
3. `onReady` *"does not yet work with Server Components and can only be used in Client Components"*.

Rule 2 sends you to `onReady`. Rule 3 says `onReady` needs `'use client'`. Rule 1 says the tag has to be in the root layout — and marking a root layout `'use client'` converts the whole application's shell into a client boundary, which is a decision far larger than one script handler.

🔴 **The documentation does not address this.** The three sentences live on the same page and never meet. What is *not* stated anywhere:

- whether a `<Script strategy="beforeInteractive">` rendered from a Client Component that the root layout imports still satisfies rule 1;
- what happens if `onReady` is attached to a `beforeInteractive` script anyway;
- why `onError` is explicitly forbidden with `beforeInteractive` while `onReady` is explicitly recommended for it.

Rather than guess, use the pattern that depends on none of it: put the `beforeInteractive` tag in the root layout with no handlers at all, and have a separate small Client Component wait for the global the script defines.

```tsx
// app/components/consent-gate.tsx
'use client'

import { useEffect, useState } from 'react'

export function ConsentGate({ children }: { children: React.ReactNode }) {
  const [decided, setDecided] = useState(false)

  useEffect(() => {
    // The CMP is loaded by a beforeInteractive <Script> in the root layout,
    // which carries no handlers. This is the substitute for onReady.
    const cmp = window.ExampleCMP
    if (!cmp) return
    cmp.onDecision(() => setDecided(true))
  }, [])

  if (!decided) return null
  return <>{children}</>
}
```

This is more code than `onReady={...}` and it is worth it, because it is built only on things the documentation actually states: the script is in the root layout, it runs once per document, and it defines a global by the time your effects run.

## Gotchas

**★ Symptom: `onLoad` never fires and there is no error to search for.** Cause: the `<Script>` is rendered by a Server Component, and all three handlers *"only work when `next/script` is imported and used inside of a Client Component"*. Fix: extract the tag into a `'use client'` leaf and render that from the server tree:

```tsx
'use client'
import Script from 'next/script'

export function AnalyticsScript() {
  return <Script src="https://cdn.example-analytics.com/tag.js" onLoad={() => window.exampleQ?.push(['ready'])} />
}
```

**★ Symptom: a vendor widget renders on first load and is blank after a client-side navigation back to the page.** Cause: `onLoad` was used, and it fires once when the script loads — not when the component remounts. The SDK is still in memory; its `init()` never ran again. Fix: this is precisely the case `onReady` exists for, since it runs *"every time the component is mounted (after a route navigation for example)"*:

```tsx
<Script
  id="example-widget"
  src="https://cdn.example-widget.com/sdk.js"
  onReady={() => window.ExampleWidget.mount('#widget-root')}
/>
```

**★ Symptom: `onReady` runs before the element it needs exists.** Cause: it fires on mount of the `<Script>` component, which is not a promise about the rest of your tree — sibling order and conditional rendering both change what is in the DOM at that moment. Fix: mount the target in the same Client Component and drive the call from a ref, so the ordering is yours rather than incidental:

```tsx
'use client'
import Script from 'next/script'
import { useRef } from 'react'

export function Widget() {
  const host = useRef<HTMLDivElement>(null)
  return (
    <>
      <div ref={host} />
      <Script
        id="example-widget"
        src="https://cdn.example-widget.com/sdk.js"
        onReady={() => host.current && window.ExampleWidget.mount(host.current)}
      />
    </>
  )
}
```

**★ Symptom: an ad blocker removes the chat vendor and the page shows a permanently empty support panel.** Cause: no `onError`, so failure is indistinguishable from "still loading". Fix: give every non-essential third-party script a fallback branch, as in the `SupportChat` example above. The handler exists exactly for the case where the vendor's hostname is on somebody's blocklist.

**★ Symptom: `onError` was added to a `beforeInteractive` script and the failure path never runs.** Cause: the reference forbids the combination — *"`onError` cannot be used with the `beforeInteractive` loading strategy"*. Fix: if you need to detect failure, the script cannot be `beforeInteractive`. Drop it to the default strategy and take the handler, or keep the strategy and detect the failure from a Client Component by checking for the global the script should have defined:

```tsx
'use client'
import { useEffect } from 'react'

export function CmpHealthCheck() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (!window.ExampleCMP) console.warn('CMP did not load')
    }, 5000)
    return () => clearTimeout(t)
  }, [])
  return null
}
```

**Symptom: adding a handler to a `<Script>` made a page's client bundle noticeably larger.** Cause: the handler forced `'use client'` onto whichever file the tag lived in, and everything that file imports came with it. Fix: the boundary belongs around the `<Script>`, not around the page. A dedicated fifteen-line loader component costs almost nothing; a page marked `'use client'` for one callback costs the whole page.

**Symptom: the handler closes over a prop and keeps seeing the first value.** Cause: this is ordinary React closure behaviour, not a `next/script` rule — the function passed on the render where the script loaded is the one that ran. Fix: read the current value through a ref rather than the closure:

```tsx
'use client'
import Script from 'next/script'
import { useRef } from 'react'

export function Tracker({ userId }: { userId: string }) {
  const latest = useRef(userId)
  latest.current = userId
  return <Script src="https://cdn.example-analytics.com/tag.js" onLoad={() => window.exampleQ?.push(['identify', latest.current])} />
}
```

**Symptom: TypeScript rejects `window.ExampleWidget` inside a handler.** Cause: the vendor global is not in the ambient types, which is correct — nothing has declared it. Fix: declare it once, in a `.d.ts` beside the loader, so the assertion lives in one place rather than as `as any` at every call site:

```ts
// types/example-widget.d.ts
declare global {
  interface Window {
    ExampleWidget?: { mount(el: string | HTMLElement): void }
  }
}
export {}
```

**Symptom: the script loads, the handler runs, and the vendor still reports nothing.** Cause: `onLoad` and `onReady` promise the *file* arrived and executed; they promise nothing about the vendor's own initialisation, queueing or consent state. Fix: use the vendor's own ready callback from inside the handler rather than treating `onLoad` as the vendor's readiness signal — the two are different events and only the second is the one you care about.

## Interview questions

**★ Why do all three `next/script` handlers require a Client Component?**
Because they are functions, and a function prop cannot cross the Server Component boundary — the RSC payload is serialized data, and there is no representation for a closure in it. The docs state the rule four separate times without stating the mechanism, but the mechanism is the ordinary one from chapter 3. The consequence for design is that the handler requirement is a *boundary* requirement: the moment you need to know whether a script loaded, some component becomes a client component, and your job is to make that component as small as possible.

**★ What is the difference between `onLoad` and `onReady`, and when does it bite?**
`onLoad` fires when the script has finished loading. `onReady` fires then *and* on every subsequent mount of the component. It bites on client-side navigation: the user leaves a page and comes back, the script is already in memory so there is nothing to load, `onLoad` has no reason to fire again — and the widget that needed `init()` on the newly-mounted DOM node never gets it. The symptom is "works on hard refresh, blank on in-app navigation", which is one of the most commonly misdiagnosed bugs in this area.

**★ Explain the `beforeInteractive` handler contradiction.**
`onLoad` is documented as unusable with `beforeInteractive`, with `onReady` suggested instead. But `onReady` requires a Client Component, and `beforeInteractive` scripts are required to sit in a root layout — and a root layout marked `'use client'` makes the entire application shell a client boundary. The documentation states both rules and never reconciles them; it also does not say whether rendering the tag from a Client Component *imported by* the root layout still satisfies the placement requirement. The safe answer in an interview is the honest one: do not attach handlers to `beforeInteractive` scripts at all, and detect readiness from a separate Client Component that waits for the global the script defines.

**★ A vendor script is blocked for 15% of your users. Where does that show up in your code?**
In `onError`, and nowhere else. Without it, a blocked script is indistinguishable from a slow one, so the UI stays in its loading state forever and the failure never reaches your error tracking. With it, you can render a fallback — a `mailto:` instead of a chat widget, a static address instead of a map — and you can count the failures. Treating "the third party arrives" as guaranteed is the single most common omission in this API.

**Does `onError` catch an exception thrown by the script after it loads?**
No. It is documented as firing *"if the script fails to load"* — a network or blocking failure. A script that downloads and executes successfully and then throws has already succeeded as far as this handler is concerned; that error surfaces as an ordinary uncaught window error and belongs to whatever error reporting you have installed, not to `next/script`.

**You need vendor B to initialise only after vendor A has loaded. How?**
Chain them through the handler rather than hoping the strategies order themselves. Load A with its own `<Script>` and set state in `onLoad`; render B's `<Script>` only when that state is set. Ordering is only guaranteed by the framework for `beforeInteractive` scripts, and those are the ones that cannot take handlers — so for the ordinary case the chain has to be explicit in your component.

**Why should the `'use client'` boundary go around the `<Script>` rather than the page that uses it?**
Because `'use client'` is inherited by everything the file imports, so marking a page converts its whole import graph into client code — the exact bundle-size failure chapter 3 measures. A loader component that renders one `<Script>` and holds one piece of state has a trivial import graph, and it can be dropped anywhere in a server-rendered tree. The rule generalises: when a framework requirement forces a boundary, push the boundary down to the smallest thing that actually needs it.

**The handler needs a value that changes on every render. What is the trap?**
That the function which ran is the one from the render where the script happened to load, with the props of that moment captured in its closure — so an identifier that updates later is never seen. The fix is a ref updated on each render and read inside the handler, which converts the closed-over snapshot into a live read. This is ordinary React semantics, but it is easy to miss here because the callback fires once, asynchronously, at a time you did not choose.

---

← [05 · next/script strategies](05-next-script-loading-strategies-for-third-party-scripts.md) · [Chapter index](01-explanation.md) · Next → [05c · Inline scripts and attribute forwarding](05c-inline-scripts-attribute-forwarding-and-where-the-tag-belongs.md)
