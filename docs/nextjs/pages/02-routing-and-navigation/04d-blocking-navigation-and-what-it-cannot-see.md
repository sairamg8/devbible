---
title: "A navigation blocker built on onNavigate covers every in-app Link click and nothing else — Back, a typed URL, a tab close and your own router.push calls all walk straight past it, and each needs a different mechanism"
sidebar_label: "04d · Blocking navigation"
sidebar_position: 142
description: "The documented Context-based navigation blocker, the prop-spread ordering bug that silently disables it, the full table of departures it cannot see, and the beforeunload and call-site guards that cover the rest."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Link Component](https://nextjs.org/docs/app/api-reference/components/link) reference (`lastUpdated: 2026-08-25`), section "Blocking navigation", and [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) (`lastUpdated: 2026-07-01`).
> Target: **Next.js 16.3.4** · `onNavigate` introduced in **v15.3.0**. Documentation-verified — **no sandbox run**.

**The documented navigation blocker is a good pattern and an incomplete guarantee, and the gap is what gets shipped. `onNavigate` is a `<Link>` prop, so a guard built on it protects exactly the navigations that pass through a `<Link>` in this tab. Browser Back, a typed URL, a bookmark, a tab close, a plain `<a href>` your CMS rendered, and every `router.push` in your own code go straight past it. A guard that covers one of those four categories and is described in the standup as "we block navigation when the form is dirty" is worse than no guard, because everyone downstream now believes the data is safe.**

## The documented pattern

The blocking state lives in React Context so a link anywhere in the tree can consult a form it knows nothing about. Three files.

```tsx title="app/contexts/navigation-blocker.tsx"
'use client'

import { createContext, useState, useContext } from 'react'

interface NavigationBlockerContextType {
  isBlocked: boolean
  setIsBlocked: (isBlocked: boolean) => void
}

export const NavigationBlockerContext =
  createContext<NavigationBlockerContextType>({
    isBlocked: false,
    setIsBlocked: () => {},
  })

export function NavigationBlockerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isBlocked, setIsBlocked] = useState(false)
  return (
    <NavigationBlockerContext.Provider value={{ isBlocked, setIsBlocked }}>
      {children}
    </NavigationBlockerContext.Provider>
  )
}

export function useNavigationBlocker() {
  return useContext(NavigationBlockerContext)
}
```

```tsx title="app/components/form.tsx"
'use client'

import { useNavigationBlocker } from '../contexts/navigation-blocker'

export default function Form() {
  const { setIsBlocked } = useNavigationBlocker()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setIsBlocked(false)
      }}
      onChange={() => setIsBlocked(true)}
    >
      <input type="text" name="name" />
      <button type="submit">Save</button>
    </form>
  )
}
```

```tsx title="app/components/custom-link.tsx"
'use client'

import Link from 'next/link'
import { useNavigationBlocker } from '../contexts/navigation-blocker'

interface CustomLinkProps extends React.ComponentProps<typeof Link> {
  children: React.ReactNode
}

export function CustomLink({ children, ...props }: CustomLinkProps) {
  const { isBlocked } = useNavigationBlocker()

  return (
    <Link
      onNavigate={(e) => {
        if (
          isBlocked &&
          !window.confirm('You have unsaved changes. Leave anyway?')
        ) {
          e.preventDefault()
        }
      }}
      {...props}
    >
      {children}
    </Link>
  )
}
```

Wrap the tree in `NavigationBlockerProvider` in the root layout, and swap the nav's `<Link>` for `CustomLink`:

```tsx title="app/layout.tsx"
import { NavigationBlockerProvider } from './contexts/navigation-blocker'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <NavigationBlockerProvider>{children}</NavigationBlockerProvider>
      </body>
    </html>
  )
}
```

Note the ordering inside `CustomLink`: `onNavigate` is declared *before* `{...props}`. If a caller ever passes its own `onNavigate`, the spread wins and your guard is silently discarded — no error, no warning, and the form is unprotected on exactly the link somebody thought was special enough to customise.

## What this guard cannot see

| Departure | Caught by `onNavigate`? | What covers it |
| --- | --- | --- |
| Clicking an in-app `<Link>` | **yes** | the pattern above |
| `router.push` / `router.replace` from your own code | no | a guard at the call site |
| Browser Back / Forward | no | `beforeunload` does not fire for these either |
| Typing a URL, choosing a bookmark | no | `beforeunload` |
| Closing the tab or the window | no | `beforeunload` |
| A plain `<a href>` in your own markup or from a CMS | no | `beforeunload` |

`beforeunload` is the browser's own mechanism for the document-level departures, and it deliberately will not display your message — browsers show a fixed, generic confirmation so a page cannot trap a user with custom text:

```tsx title="app/ui/unload-guard.tsx"
'use client'

import { useEffect } from 'react'

export function UnloadGuard({ when }: { when: boolean }) {
  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])
  return null
}
```

For your own programmatic navigations there is no `<Link>` to hang a handler on, so the guard has to move to the call site. Wrap the router once and use the wrapper everywhere:

```tsx title="app/hooks/use-guarded-router.ts"
'use client'

import { useRouter } from 'next/navigation'
import { useNavigationBlocker } from '@/app/contexts/navigation-blocker'

export function useGuardedRouter() {
  const router = useRouter()
  const { isBlocked } = useNavigationBlocker()

  function allowed() {
    return (
      !isBlocked ||
      window.confirm('You have unsaved changes. Leave anyway?')
    )
  }

  return {
    push(href: string) {
      if (allowed()) router.push(href)
    },
    replace(href: string) {
      if (allowed()) router.replace(href)
    },
  }
}
```

## The honest framing

Three mechanisms, three scopes, and no single one of them is "blocking navigation":

- **`onNavigate`** — in-app `<Link>` clicks. Your dialog, your wording, cancellable.
- **`useGuardedRouter`** — your own `push`/`replace`. Your dialog, but only if every call site uses the wrapper.
- **`beforeunload`** — document-level departures. The browser's dialog, the browser's wording, and modern browsers require a prior user interaction with the page before they will show it at all.

Nothing covers browser Back within a single-page session, because that is a history traversal the router performs without unloading the document. If Back must not lose data, the answer is not a guard — it is to stop needing one: autosave to a draft on the server, or keep the form state in a store that survives the navigation. That is a design decision, and it is cheaper than the guard.

## Gotchas

**★ Symptom: the leave-guard works for in-app links and does nothing when the user presses Back or closes the tab.** Cause: `onNavigate` only sees same-origin client-side navigations initiated through a `<Link>`. Fix: add a `beforeunload` listener for document-level departures, and accept that the browser shows its own generic wording rather than your message.

```tsx
<UnloadGuard when={isBlocked} />
```

**★ Symptom: the guard works everywhere except one flow — and that flow is the redirect after saving.** Cause: that navigation is `router.push`, not a `<Link>`, so no `onNavigate` exists to intercept. Fix: check the flag at the call site.

```tsx
const router = useGuardedRouter()
// ...
router.push(`/invoices/${id}`)
```

**★ Symptom: a custom link component's guard stops firing after someone adds an `onNavigate` at a call site.** Cause: `{...props}` spread *after* your own `onNavigate` overwrites it. Fix: spread first, declare the handler after, and compose the caller's version explicitly.

```tsx
export function CustomLink({ children, onNavigate, ...props }: CustomLinkProps) {
  const { isBlocked } = useNavigationBlocker()
  return (
    <Link
      {...props}
      onNavigate={(e) => {
        if (isBlocked && !window.confirm('You have unsaved changes. Leave anyway?')) {
          e.preventDefault()
          return
        }
        onNavigate?.(e)
      }}
    >
      {children}
    </Link>
  )
}
```

**★ Symptom: `beforeunload` is registered and the confirmation never appears.** Cause: browsers require the user to have interacted with the page before they will honour it, and they will not show a custom string. Fix: nothing to fix in the handler — verify by interacting with the page first, and do not build UX that depends on your own wording appearing there.

**Symptom: the guard prompts on every navigation, including ones the user just saved through.** Cause: `setIsBlocked(false)` runs in `onSubmit`, but the form fires `onChange` again during the reset, or the submit is asynchronous and the flag is cleared before the write actually lands. Fix: clear the flag when the write resolves, not when the submit starts.

```tsx
async function save(data: FormData) {
  await persist(data)
  setIsBlocked(false) // after the write, not before
}
```

**Symptom: `isBlocked` is `false` inside the handler even though the form is dirty.** Cause: `CustomLink` is rendered outside `NavigationBlockerProvider`, so `useContext` returns the default value — `{ isBlocked: false, setIsBlocked: () => {} }` — and everything silently no-ops. Fix: provide from the root layout, and make the default throw in development so a missing provider is loud.

```tsx
export function useNavigationBlocker() {
  const ctx = useContext(NavigationBlockerContext)
  if (process.env.NODE_ENV !== 'production' && ctx.setIsBlocked.length === 0) {
    console.warn('useNavigationBlocker used outside NavigationBlockerProvider')
  }
  return ctx
}
```

**Symptom: links rendered from CMS content bypass the guard entirely.** Cause: they are plain `<a href>` strings in HTML, not `<Link>` components, so there is no prop to fire and the browser performs a full document load. Fix: post-process the rendered content into `<Link>` elements, or rely on `beforeunload` for that content and accept the browser's dialog.

**Symptom: navigating away and back restores a half-filled form the user thought they had abandoned, so the guard looks like it fired for nothing.** Cause: under `cacheComponents` the App Router preserves Client Component state across navigations. Fix: this is a state-lifetime question, not a guard question — see `router.bfcacheId` in [04e · `useRouter`](04e-userouter-programmatic-navigation-and-refresh.md).

## Interview questions

**★ Build an unsaved-changes guard. What does it cover and what does it miss?**
Share an `isBlocked` flag through React Context, set it from the form's `onChange`, clear it when the save resolves, and wrap `<Link>` in a component whose `onNavigate` calls `e.preventDefault()` when blocked and the user declines. It covers every in-app client-side navigation, including ones triggered from components that know nothing about the form. It misses the browser Back button, a typed URL, a bookmark, a tab close, any plain `<a href>`, and your own `router.push` calls. The first group needs `beforeunload`; the last needs a guard at the call site, because there is no link to attach one to.

**★ Why can't `onNavigate` intercept the browser's Back button?**
Because it is a prop on a component that was not involved. Back is a history traversal the browser initiates and the router services without unloading the document; no `<Link>` is clicked, so there is nothing to call the handler — and `beforeunload` does not fire either, because the document is not unloading. That combination is why a same-session Back is the one departure no guard covers, and why the real answer to "Back must not lose data" is autosave rather than a prompt.

**★ Name the failure mode of the documented `CustomLink` and explain why it is invisible.**
`onNavigate` is declared before `{...props}`, so a caller passing its own `onNavigate` overwrites the guard. There is no error, no warning and no type failure — the prop is legal, the spread is legal, and the component still renders. The guard simply stops running on the one link somebody customised, which is statistically likely to be an important one. Spreading first and composing the caller's handler inside yours removes the whole class.

**Your product manager writes "we block navigation when there are unsaved changes" in the release notes. What do you correct?**
The scope. Three mechanisms with three different reaches are involved: `onNavigate` for in-app links, a wrapped router for programmatic navigation, and `beforeunload` for closing the tab or typing a URL — with the browser's wording, not ours, and only after the user has interacted with the page. Same-session Back is not covered by any of them. The sentence that is true is "we warn before leaving via an in-app link, and the browser warns before closing the tab".

**Why does `beforeunload` refuse to show your message?**
Because a page that can put arbitrary text in a modal the user must dismiss to leave is a phishing and scareware primitive. Browsers converged on a fixed generic string, and several also require a prior user gesture on the page before the dialog appears at all. Design around it: the message is not yours, so do not put load-bearing instructions in it.

**A form's guard prompts even immediately after a successful save. Where is the bug?**
Almost always in *when* the flag is cleared. Clearing it at the top of an async submit means the flag is `false` while the request is in flight and `true` again the moment a controlled reset fires a change event; clearing it after the write resolves matches the invariant the flag is supposed to express, which is "there is state here that the server does not have".

---

← [04c · `onNavigate` vs `onClick`](04c-onnavigate-and-blocking-navigation.md) · [Chapter 2 overview](01-explanation.md) · Next → [04e · `useRouter`](04e-userouter-programmatic-navigation-and-refresh.md)
