---
title: "useEffectEvent is the first sanctioned way to read a value inside an Effect without that value re-triggering the Effect — which matters more in the App Router than anywhere else, because every previous workaround pushed the 'use client' boundary further up the tree"
sidebar_label: "04 · useEffectEvent"
sidebar_position: 4
description: "React 19.2's Effect Events: the stability evidence, reactive versus non-reactive values, the four caveats verbatim, the three workarounds it replaces, and why it is a boundary-size tool in the App Router."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the React reference — [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) and the [React 19.2 release post](https://react.dev/blog/2025/10/01/react-19-2) (published October 1st 2025). **Export surface probed** on the installed package: `react` **19.2.8** (`Object.keys(require('react'))`), which matches the corpus pin. Next.js behaviour from [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`version: 16.3.4`) and the App-Router-React rule banked in [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md).
> Target: **React 19.2.8 · Next.js 16.3.4**, App Router. Documentation-verified and export-probed; **no sandbox run**; **no benchmarks run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**An Effect's dependency array is a correctness contract: it says "re-run me when any of these change." The trouble is that Effects routinely need to *read* values they must not *react to* — the current theme when logging a connection, the current user id when reporting an event, a callback prop that changes identity every render. Before React 19.2 every escape from that bind was bad: lie to the linter and ship a stale-closure bug, or wrap the value in a ref and hand-maintain it, or hoist the state upward until the problem moves somewhere else. In the App Router the third option is the expensive one, because hoisting state upward means moving `'use client'` upward, and that is exactly the mistake [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md) spends its length warning about. `useEffectEvent` is the sanctioned escape, and it is a boundary-size tool as much as a correctness one.**

## 🔴 First: is it actually stable?

The filename says "React 19.2 primitives", and a version number is not evidence. Three independent checks, all pointing the same way:

| Check | Result |
|---|---|
| **T1 · export probe** — `Object.keys(require('react'))` on the installed `react` **19.2.8** | `useEffectEvent` is exported under that exact name. **No `experimental_` or `unstable_` prefix.** |
| **T2 · reference page** — [react.dev/reference/react/useEffectEvent](https://react.dev/reference/react/useEffectEvent) | No experimental, canary or under-construction banner. |
| **T2 · release notes** — the 19.2 post | Listed under *"New React Features"*, alongside `<Activity />` and `cacheSignal`. |

So: **stable in React 19.2, on the stable channel, under its final name.** Compare with a neighbour it is documented against — `ViewTransition` is referenced in the `<Activity>` caveats but is **not** in the export list of stable `react` 19.2.8. Absence from a probed export list is the cheapest possible evidence that an API is not on the stable channel, and it is worth running before writing a line of code against something you read about in a release post.

⚠️ **The version in your `package.json` is not necessarily the React the App Router renders with.** The Next.js docs are explicit:

> *"The `App Router` uses React canary releases built-in, which include all the stable React 19 changes, as well as newer features being validated in frameworks."*

Since a canary includes all the stable 19 changes, `useEffectEvent` is available to App Router code regardless. The consequence runs the other way: **you cannot pin your way out of a React-level regression in App Router code**, because the pin governs your tooling, not the renderer.

## Reactive and non-reactive: the distinction the whole API rests on

Inside an Effect, every value read from render is either something the Effect must **re-synchronize** to, or something it merely needs the **latest of**.

```tsx
'use client'
import { useEffect, useState } from 'react'
import { connect } from '@/lib/live-feed'
import { toast } from '@/lib/toast'

export function OrderFeed({ warehouseId, theme }: { warehouseId: string; theme: 'light' | 'dark' }) {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    const conn = connect(warehouseId)
    conn.on('open', () => toast('Connected', { theme }))
    conn.on('order', (o: Order) => setOrders((prev) => [o, ...prev]))
    conn.connect()
    return () => conn.disconnect()
  }, [warehouseId, theme])   // 🔴 flipping the theme tears down the socket
  // ...
}
```

`warehouseId` is **reactive**: change it and the Effect genuinely must disconnect and reconnect to a different warehouse. `theme` is **not**: the connection has no opinion about colours. But the linter is right that `theme` is read inside the Effect, and removing it from the array creates a closure that will forever toast in whatever theme was current when the socket opened.

Both available answers are bad. Keep `theme` in the array and toggling dark mode drops the live feed. Remove it and the toast is wrong.

## What `useEffectEvent` does

```tsx
const onEvent = useEffectEvent(callback)
```

It returns *"an Effect Event function with the same type signature as your `callback`."* The reference states the property that makes it work:

> *"Effect Events allow you to read the latest values from render (like props and state) without re-synchronizing your Effect, so they're excluded from Effect dependencies."*

The fix to the example above is one extraction:

```tsx
'use client'
import { useEffect, useEffectEvent, useState } from 'react'
import { connect } from '@/lib/live-feed'
import { toast } from '@/lib/toast'

export function OrderFeed({ warehouseId, theme }: { warehouseId: string; theme: 'light' | 'dark' }) {
  const [orders, setOrders] = useState<Order[]>([])

  const onConnected = useEffectEvent(() => {
    toast('Connected', { theme })         // always the current theme
  })

  useEffect(() => {
    const conn = connect(warehouseId)
    conn.on('open', () => onConnected())
    conn.on('order', (o: Order) => setOrders((prev) => [o, ...prev]))
    conn.connect()
    return () => conn.disconnect()
  }, [warehouseId])                       // ✅ complete: Effect Events are not dependencies

  return <OrderList orders={orders} />
}
```

The dependency array is now **honest and complete**. Nothing is suppressed, no lint rule is disabled, and toggling the theme no longer touches the socket. The release post states the rule in bold: **"Effect Events should _not_ be declared in the dependency array"**.

## The caveats, verbatim — all four

These are the entire contract. Quoted from the reference:

> *"`useEffectEvent` is a Hook, so you can only call it **at the top level of your component** or your own Hooks. You can't call it inside loops or conditions. If you need that, extract a new component and move the Effect Event into it."*

> *"Effect Events can only be called from inside Effects or other Effect Events. Do not call them during rendering or pass them to other components or Hooks. The `eslint-plugin-react-hooks` linter enforces this restriction."*

> *"Do not use `useEffectEvent` to avoid specifying dependencies in your Effect's dependency array. This hides bugs and makes your code harder to understand. Only use it for logic that is genuinely an event fired from Effects."*

> *"Effect Event functions do not have a stable identity. Their identity intentionally changes on every render."*

The fourth is the one people trip over, and it is deliberate rather than an implementation detail. **An unstable identity is what makes the other three rules enforceable.** If you could pass an Effect Event to a child or into `useCallback`, memoization would either break loudly or capture a stale version silently; React made the identity change every render so that any attempt to hold onto one is obviously wrong.

## The three things it replaces, and why each was worse

### 1 · The ref-latest pattern

```tsx
// ❌ the pre-19.2 workaround — correct, and four moving parts you must maintain
const themeRef = useRef(theme)
useEffect(() => { themeRef.current = theme }, [theme])

useEffect(() => {
  const conn = connect(warehouseId)
  conn.on('open', () => toast('Connected', { theme: themeRef.current }))
  conn.connect()
  return () => conn.disconnect()
}, [warehouseId])
```

It works. It also requires a second Effect whose only job is bookkeeping, it reads `.current` at a moment nobody has reasoned about, and every new reader of the file has to reconstruct why the ref exists. `useEffectEvent` expresses the same intent in one line and lets the linter check it.

### 2 · Suppressing the lint rule

```tsx
// ❌ the honest name for this is "a stale closure with a comment on it"
useEffect(() => {
  const conn = connect(warehouseId)
  conn.on('open', () => toast('Connected', { theme }))
  conn.connect()
  return () => conn.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [warehouseId])
```

The suppression is permanent and the bug it hides is conditional — it only shows up for a user who changes theme while connected. That is the shape of a defect that survives every code review and arrives as a support ticket.

### 3 · Hoisting state — and why this one is a Next.js problem

The third escape is to move `theme` out of this component so it stops being a dependency, usually into a parent. In a client-only React app that is merely a refactor. **In the App Router it changes what ships to the browser.** Whatever component now owns the state must be a Client Component, and per the module-graph rule everything it imports goes with it.

```tsx
// ❌ app/layout.tsx — solving an effect-dependency problem by widening the client graph
'use client'
import { useState } from 'react'
import Nav from './nav'          // now in the client bundle
import Footer from './footer'    // now in the client bundle
```

**So `useEffectEvent` is a bundle-size tool.** It removes the most common reason a developer reaches for "let me just lift this up", and lifting up is how a `'use client'` directive migrates toward the root one refactor at a time. That connection is invisible in the React docs, because the React docs are not about a framework where component placement decides download size.

## Where it belongs in an App Router codebase

It is a Hook, so it only exists inside a Client Component — a file carrying `'use client'`, or one imported by such a file. There is no server-side analogue and none is needed: Server Components have no Effects.

The realistic uses cluster in three places.

**Analytics that must not re-fire.** A page-view event should be sent once per route, using the current user and session, neither of which should cause a resend when they change:

```tsx
'use client'
import { useEffect, useEffectEvent } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics-client'

export function PageViewTracker({ userId, plan }: { userId: string; plan: string }) {
  const pathname = usePathname()

  const reportView = useEffectEvent((path: string) => {
    track('page_view', { path, userId, plan })
  })

  useEffect(() => {
    reportView(pathname)
  }, [pathname])         // ✅ one event per navigation, with current user and plan
}
```

Note the shape: the **reactive** value is passed *in* as an argument, and the non-reactive ones are read from render inside the Effect Event. That is the idiom worth memorising.

**Callback props from a parent.** A parent that passes `onChange` inline creates a new function every render; putting it in the dependency array re-runs the Effect on every parent render.

```tsx
'use client'
import { useEffect, useEffectEvent } from 'react'

export function PollingStatus({ jobId, onDone }: { jobId: string; onDone: (r: Result) => void }) {
  const handleDone = useEffectEvent((result: Result) => onDone(result))

  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch(`/api/jobs/${jobId}`)
      const job: Job = await res.json()
      if (job.state === 'done') {
        clearInterval(timer)
        handleDone(job.result)
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [jobId])            // ✅ the poll restarts only when the job changes
}
```

**Subscriptions whose handler needs current state.** A WebSocket handler that must decide based on the filter the user has selected *right now*, without the filter change reconnecting the socket.

## Gotchas

**★ Symptom: the linter errors that an Effect Event was called during render.** Cause: Effect Events can only be called from inside Effects or other Effect Events — calling one in the component body, in a `useMemo`, or in a JSX expression is a violation the `eslint-plugin-react-hooks` rule enforces. Fix: if it needs to run during render it is not an Effect Event; make it an ordinary function. If it needs to run on a click, make it an ordinary event handler.

```tsx
// ❌ const label = describeStatus()      // Effect Event, called in the body
// ✅ const label = describeStatus_plain() // a normal function, called anywhere
```

**★ Symptom: you pass an Effect Event to a child component and behaviour is inconsistent.** Cause: the reference forbids it, and the reason is the identity rule — *"Effect Event functions do not have a stable identity. Their identity intentionally changes on every render."* A child that memoizes on it re-renders every time; a child that captures it holds a version React does not guarantee. Fix: keep the Effect Event in the component that owns the Effect and pass a plain callback down instead.

```tsx
// ❌ <Child onPing={pingEvent} />
// ✅ <Child onPing={(x) => { /* plain function; call the event from the Effect */ }} />
```

**★ Symptom: adding an Effect Event to the dependency array causes an infinite Effect loop.** Cause: identity changes every render, so listing it means the Effect re-runs every render, which usually sets state, which renders again. Fix: leave it out — that is the designed behaviour, and the exhaustive-deps rule knows to exclude it, so a complete dependency array genuinely omits it.

```tsx
// ❌ }, [warehouseId, onConnected])
// ✅ }, [warehouseId])
```

**★ Symptom: an Effect stopped re-running when a value it should react to changes.** Cause: `useEffectEvent` was used to make the dependency array shorter rather than to express an event — the reference warns against exactly this: *"Do not use `useEffectEvent` to avoid specifying dependencies… This hides bugs."* Wrapping a genuinely reactive value in an Effect Event converts a lint warning into a silent synchronization bug. Fix: ask whether the Effect *should* re-run when this changes. If yes, it is a dependency; only genuinely event-like logic belongs in an Effect Event.

**★ Symptom: `useEffectEvent` is called inside a condition and React errors about hook order.** Cause: it is a Hook, subject to the top-level rule like every other. Fix: the documented remedy is structural — *"extract a new component and move the Effect Event into it"* — not a conditional call.

```tsx
// ❌ if (isLive) { const onTick = useEffectEvent(...) }
// ✅ {isLive && <LiveTicker />}   // the Effect Event lives at the top level of LiveTicker
```

**★ Symptom: the toast/analytics/log fires with a value from several minutes ago.** Cause: the classic stale closure — the value was omitted from the dependency array with a lint suppression, so the Effect's closure froze it at mount. Fix: delete the suppression, restore the honest dependency array, and move the read into an Effect Event, which reads the latest value from render by definition.

**★ Symptom: TypeScript cannot find `useEffectEvent` on the `react` import.** Cause: `@types/react` older than the 19.2 surface, or a React version below 19.2 in the lockfile — and in a Next.js App Router project the second is easy to miss, because the *runtime* may have it via the built-in canary while your *types* do not. Fix: align the declared versions; the API exists on `react` 19.2 and above, and the type packages must match.

**Symptom: an Effect Event wrapped around a value that changes identity every render did not stop the Effect re-running.** Cause: the unstable prop is still in the dependency array — wrapping the *call site* does nothing if the prop is also listed. Fix: the prop must be read only inside the Effect Event and must not appear in the array.

```tsx
// ❌ }, [jobId, onDone])
// ✅ }, [jobId])            // onDone is read inside handleDone only
```

**Symptom: a code review says "this could just be a `useCallback`".** Cause: the two look similar and solve opposite problems. `useCallback` gives you a **stable** identity so consumers can memoize; `useEffectEvent` gives you a **deliberately unstable** function that always sees the latest render. Fix: if the function is passed to a child, it is `useCallback`. If it is called from an Effect and must not re-trigger it, it is `useEffectEvent`. Neither substitutes for the other.

**Symptom: moving logic into an Effect Event made a race condition worse.** Cause: an Effect Event always reads the latest values, so a late-arriving async callback that used to see the values from its own run now sees whatever is current. Fix: pass the values that must be pinned to that run **as arguments** to the Effect Event, exactly as `reportView(pathname)` does above, and read only the genuinely-ambient ones from render.

**Symptom: an Effect Event is used inside a Server Component and nothing works.** Cause: it is a Hook; Server Components have no Effects and no hooks. Fix: the file needs `'use client'` — and per [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md) that should be the smallest leaf that needs it, not the page.

## Interview questions

**★ What problem does `useEffectEvent` solve that a dependency array cannot?**
An Effect frequently reads two categories of value: ones it must re-synchronize to, and ones it only needs the latest of. The dependency array has a single setting for both, so a value like the current theme, the current user or an inline callback prop forces a choice between re-running the Effect for no reason — tearing down a socket to change a colour — and lying about the dependencies, which freezes that value in a closure. `useEffectEvent` splits the two: logic inside an Effect Event reads the latest values from render and is excluded from dependencies, so the array becomes both complete and minimal. That is the first time those two properties have been simultaneously achievable without a ref.

**★ Why do Effect Events deliberately have an unstable identity?**
Because it makes the misuse impossible to write accidentally. The reference states the identity *"intentionally changes on every render"*, and every other rule follows from it: you cannot usefully add one to a dependency array, because the Effect would re-run every render; you cannot usefully pass one to a memoized child, because the memo would never hold. If the identity were stable, both mistakes would compile, run, and fail subtly — a child memoizing on a stale event, an Effect quietly not re-running. The unstable identity converts a class of silent bugs into an immediate, obvious one.

**★ Is `useEffectEvent` stable, and how would you check rather than assume?**
It is stable in React 19.2 — but the check matters more than the answer. Three cheap signals, in increasing cost: probe the installed package's exports and look for the bare name rather than an `experimental_` or `unstable_` prefix; open the react.dev reference page and look for a channel banner; read the release notes for which section it is listed under. On `react` 19.2.8 the export is `useEffectEvent` with no prefix, the reference carries no banner, and the 19.2 post lists it under new React features. The same probe applied to `ViewTransition` shows it absent from the stable export list, which is exactly how you catch a release-post feature that is not on your channel.

**★ How is this a bundle-size issue in the App Router specifically?**
Because one of the three pre-19.2 escapes was to hoist state to a parent so it stops being a dependency, and in the App Router state means `'use client'`, and `'use client'` is viral downward through imports. So a developer solving a lint warning about an Effect dependency ends up promoting a component to a Client Component, and everything that component imports joins the client bundle. `useEffectEvent` removes the reason to hoist, which keeps the boundary where it was. That link is invisible in the React documentation, because React is not the layer where component placement decides download size — but it is the reason this API belongs on a Server-versus-Client-Components page at all.

**★ When is `useEffectEvent` the wrong tool?**
Whenever the value genuinely is reactive. The reference is blunt that it must not be used to shorten a dependency array, because doing so hides a synchronization bug rather than fixing one — the Effect stops re-running when it should, and nothing errors. The test is a question about intent: should this Effect re-synchronize when this value changes? If yes, it is a dependency and no amount of wrapping makes that untrue. It is also the wrong tool for a plain DOM event handler, which needs no hook at all, and for anything passed to a child, which needs `useCallback`.

**How does it differ from `useCallback`, given both wrap a function?**
They are near-opposites. `useCallback` exists to give a function a *stable* identity so that memoized children and dependency arrays can rely on it. `useEffectEvent` exists to give a function a deliberately *unstable* identity that always closes over the current render, precisely so it cannot be relied on that way. `useCallback` is for things going down the tree; `useEffectEvent` is for things called from an Effect in the same component. A function that needs both properties is a design smell — usually the state should live somewhere else.

**Show the idiom for mixing reactive and non-reactive values in one Effect Event.**
Reactive values are passed as arguments; non-reactive values are read from render inside the body. A page-view tracker is the canonical case: the pathname is what should cause the event, so it stays in the dependency array and is handed to the Effect Event as a parameter, while the user id and plan are read directly inside because a plan upgrade should not re-fire a page view. Getting this backwards — reading the pathname from render inside the event — produces the subtle version of the bug, where a late-firing event reports the route the user has since navigated away from.

**What replaced the ref-latest pattern, and was that pattern actually wrong?**
It was not wrong, it was expensive to maintain. The pattern was a `useRef` holding the current value plus a second Effect whose entire job was to keep the ref in sync, and then reading `.current` inside the real Effect. It produced correct behaviour, but it introduced a mutable cell that any reader has to reason about, it read the value at a moment nobody had thought about explicitly, and the linter could not check any of it. `useEffectEvent` expresses the same intent declaratively in one call and gets lint enforcement for free, which is why the pattern should be migrated rather than kept alongside.

**A colleague suppresses `react-hooks/exhaustive-deps` and says the Effect works fine. What is your argument?**
That the suppression is unconditional and the bug it hides is conditional. The Effect works fine for every user who does not change the suppressed value while the Effect is alive, which is most of them, which is why it passed review and testing. The failure surfaces later as a report of a wrong colour, a wrong user id, or an event attributed to the wrong page — symptoms whose cause is several weeks upstream. Since 19.2 there is no longer a cost argument for the suppression either: the extraction into an Effect Event is one line, keeps the dependency array honest and leaves the rule enabled.

---

← Prev [03 · Composition patterns](03-composition-patterns-server-to-client-boundaries.md) · [Index](01-explanation.md) · Next → [04b · `<Activity>` and offscreen state](04b-activity-and-offscreen-state.md)
