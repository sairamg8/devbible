---
title: "router.replace inside a transition, with the input's value in local state, is the whole recipe for a filter that does not lock up — and the throttle you did not write is the reason it breaks on Safari"
sidebar_label: "03g · Writing the URL programmatically"
sidebar_position: 17
description: "useRouter().push and replace, why the input's value must be local state, wrapping the navigation in a transition, debouncing the navigation rather than the field, the browser History API rate limits, and the XSS warning the router reference states outright."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) (`lastUpdated: 2026-07-01`),
> [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) (`lastUpdated: 2026-08-25`),
> [`Link`](https://nextjs.org/docs/app/api-reference/components/link) (`lastUpdated: 2026-08-25`) and
> [nuqs — Options](https://nuqs.dev/docs/options) (`nuqs` **2.10.1**).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**Some controls are not links: a slider, a multi-select, a date-range picker, a text input that filters as you type. For those you call the router directly, and three decisions decide whether the result feels like a native app or like a form from 2004 — `replace` rather than `push` so Back does not unwind twenty keystrokes, the input's value in local state so the field never waits on the server, and the navigation inside a transition so the current results stay on screen while the new ones are computed. Every mechanism on this page asks the server to re-render; the one that does not is the History API, which gets its own page in [03h](03h-url-as-state-shallow-updates-and-the-history-api.md).**

## The router surface

```ts
router.push(href: string, { scroll: boolean, transitionTypes: string[] })
router.replace(href: string, { scroll: boolean, transitionTypes: string[] })
```

> *"`router.push(href, ...)`: Perform a client-side navigation to the provided route. Adds a new entry into the browser's history stack."*
> *"`router.replace(href, ...)`: Perform a client-side navigation to the provided route without adding a new entry into the browser's history stack."*
> — [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router)

Note the option list: `scroll` and `transitionTypes`. **There is no `shallow`.** And note what the docs say before any of it:

> *"**Recommendation:** Use the `<Link>` component for navigation unless you have a specific requirement for using `useRouter`."*
> — same page

"A specific requirement" means a control that is genuinely not a link. A filter chip is a link; see [03f](03f-url-as-state-writing-declaratively.md).

## The recipe

```tsx filename="app/[tenant]/board/search-input.tsx"
'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function SearchInput() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [text, setText] = useState(searchParams.get('q') ?? '')

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('q', next)
    else params.delete('q')

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <input
      value={text}
      aria-busy={isPending}
      onChange={(e) => {
        setText(e.target.value)   // local state updates immediately
        commit(e.target.value)    // navigation runs inside a transition
      }}
    />
  )
}
```

Four deliberate choices:

1. **`replace`, not `push`.** Every keystroke as a history entry means Back walks the user backwards through their own typing one character at a time. `push` belongs on a *tab* or a *modal* — something a user would expect Back to close.
2. **`scroll: false`.** The router methods take the same option as `<Link>`: *"you can pass `scroll={false}` to the `<Link>` component, or `scroll: false` to `router.push()` or `router.replace()`"* — [`Link`, Disable scrolling to the top of the page](https://nextjs.org/docs/app/api-reference/components/link#disable-scrolling-to-the-top-of-the-page).
3. **The input's value comes from local state, not from the URL.** If it read `searchParams.get('q')` directly it could only update once the server round trip completed. That is what "the input locks up while typing" actually is.
4. **`URLSearchParams` is copied, not mutated.** What `useSearchParams()` returns is read-only; `toString()` then a fresh instance is the documented shape of an update.

### What the transition is and is not documented to do

⚠️ **Stated as uncertain, deliberately.** The `useRouter` reference documents the option bag as `{ scroll, transitionTypes }` and says nothing about calling `router.push`/`replace` inside `startTransition`, nor about what a pending flag covers for a navigation. What *is* documented is the equivalent in `nuqs` (**2.10.1**), which drives the same router:

> *"When combined with `shallow: false`, you can use React's `useTransition` hook to get loading states while the server is re-rendering server components with the updated URL."*
> *"`isLoading` will be true while the server is re-rendering and streaming RSC payloads, when the query is updated via `setQuery`."*
> — [nuqs, Transitions](https://nuqs.dev/docs/options#transitions)

Treat the pattern as well-supported by the ecosystem rather than as a Next.js guarantee. The documented *Next.js* pending signal is `useLinkStatus`, and it only covers `<Link>` navigations — see [03d](03d-prefetching-query-driven-routes-and-opting-out.md). A `router.replace` has no enclosing link, so `useLinkStatus` will report `pending: false` for it.

## Debouncing against a server round trip

If the URL write triggers a server re-render, every keystroke is a request. Two rules:

- **Debounce the *navigation*, never the input.** Local state updates on every keystroke so the field stays responsive; the router call is delayed.
- **Fire immediately on clear and on Enter.** A user who empties the box or presses Enter wants the result now, and debouncing those is pure latency.

```tsx filename="app/[tenant]/board/debounced-search.tsx"
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function DebouncedSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [text, setText] = useState(searchParams.get('q') ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function navigate(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('q', next)
    else params.delete('q')
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function schedule(next: string, delayMs: number) {
    if (timer.current) clearTimeout(timer.current)
    if (delayMs === 0) {
      navigate(next)
      return
    }
    timer.current = setTimeout(() => navigate(next), delayMs)
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        schedule(e.target.value, e.target.value === '' ? 0 : 400)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') schedule((e.target as HTMLInputElement).value, 0)
      }}
    />
  )
}
```

Forty lines to express one policy — and this version still does not address the **browser History API rate limits**, which are a hard constraint rather than a nicety:

> *"Because of browsers rate-limiting the History API, updates **to the URL** are queued and throttled to a default of 50ms, which seems to satisfy most browsers even when sending high-frequency query updates, like binding to a text input or a slider."*
> *"Safari's rate limits are much stricter and use a default throttle of 120ms (320ms for older versions of Safari)."*
> — [nuqs, Rate-limiting URL updates](https://nuqs.dev/docs/options#rate-limiting-url-updates)

A slider bound directly to `router.replace` writes the history stack faster than Safari permits. [03k](03k-nuqs-typed-search-params-as-a-library.md) is the same behaviour as one option, with the throttling handled.

## The XSS warning, stated outright

> *"You must not send untrusted or unsanitized URLs to `router.push` or `router.replace`, as this can open your site to cross-site scripting (XSS) vulnerabilities. For example, `javascript:` URLs sent to `router.push` or `router.replace` will be executed in the context of your page."*
> — [`useRouter`, Good to know](https://nextjs.org/docs/app/api-reference/functions/use-router)

This is not theoretical for a chapter about URL state. "Restore this saved view", "open the link a teammate shared", "reapply my last filter from `localStorage`" all take a URL out of storage or user input and hand it to the router.

```tsx filename="app/[tenant]/board/restore-view.tsx"
'use client'

const ALLOWED_STATUSES = ['open', 'blocked', 'done', 'archived'] as const

export function restoreView(
  saved: string,
  pathname: string,
  router: { replace: (href: string, o?: { scroll?: boolean }) => void },
) {
  // ❌ router.replace(saved)   — `saved` may be `javascript:...`
  const incoming = new URLSearchParams(saved.startsWith('?') ? saved.slice(1) : saved)
  const params = new URLSearchParams()
  const status = incoming.get('status')
  if (status && (ALLOWED_STATUSES as readonly string[]).includes(status)) {
    params.set('status', status)
  }
  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
}
```

## Gotchas

**★ Symptom: the Back button walks backwards one character at a time through a search box.** Cause: the update used `push`, so every keystroke is a history entry. Fix: `replace` for continuous inputs, `push` only for discrete, navigation-like changes.

```tsx
router.replace(`${pathname}?${params}`, { scroll: false })   // ✅ search text
router.push(`${pathname}?tab=activity`, { scroll: false })   // ✅ a tab is a place
```

**★ Symptom: typing in the filter input feels laggy — characters appear a beat late.** Cause: the input's `value` is read from `useSearchParams()`, so the field cannot update until the server round trip lands. Fix: local state owns the field; the URL is written behind it.

```tsx
const [text, setText] = useState(searchParams.get('q') ?? '')
<input value={text} onChange={(e) => { setText(e.target.value); commit(e.target.value) }} />
```

**★ Symptom: `searchParams.set is not a function`.** Cause: `useSearchParams()` returns a **read-only** view; the mutators are absent by design. Fix: copy before mutating.

```tsx
const params = new URLSearchParams(searchParams.toString())
params.set('status', 'blocked')
```

**★ Symptom: a filter that worked yesterday now sends a request per keystroke and the upstream API rate-limits you.** Cause: the URL write triggers a server re-render and nothing debounces it. Fix: debounce the navigation while leaving the input immediate, firing immediately on clear and on Enter — the `DebouncedSearch` component above.

**★ Symptom: a range slider bound to the URL stutters or drops updates, and much worse in Safari.** Cause: browsers rate-limit the History API — around 50 ms generally, 120 ms in Safari and 320 ms in older versions. Fix: throttle the URL write to at least those intervals while the slider's own value stays in local state.

```tsx
const last = useRef(0)
function onSlide(v: number) {
  setValue(v)                                   // immediate
  const now = Date.now()
  if (now - last.current < 150) return          // ≥ Safari's 120ms
  last.current = now
  startTransition(() => router.replace(`${pathname}?zoom=${v}`, { scroll: false }))
}
```

**★ Symptom: a "restore this saved view" button opens `javascript:alert(1)` for a user who was sent a crafted link.** Cause: an untrusted string was passed straight to `router.push`. Fix: never pass an href through; rebuild the URL from validated parts — the `restoreView` function above.

**★ Symptom: `useLinkStatus` returns `pending: false` for a filter change driven by `router.replace`.** Cause: the hook reports the status of an enclosing `<Link>`, and there is no link in that interaction. Fix: take the pending flag from the transition that wraps the navigation.

```tsx
const [isPending, startTransition] = useTransition()
startTransition(() => router.replace(href, { scroll: false }))
<div aria-busy={isPending}>{/* results */}</div>
```

**★ Symptom: a debounced navigation fires after the user has left the page, throwing in the console.** Cause: the timer was never cleared on unmount. Fix: clear it in a cleanup effect — the `useEffect` return in `DebouncedSearch`.

## Interview questions

**★ Why should a search input's value come from local state rather than from `useSearchParams()`?**
Because the URL is only updated after the write is committed, and if the write triggers a server round trip the URL lags the user's typing by a whole request. An input whose `value` is read from the URL therefore appears to drop or delay characters. The correct arrangement is optimistic: local state owns the field so it updates on every keystroke, and the URL is written behind it — immediately, throttled or debounced depending on what the write costs. The URL stays the source of truth for the *result*; the input is just a control.

**★ When do you use `push` and when `replace`?**
`push` when the change is navigation-like and a user would expect Back to undo it: switching tabs, opening a detail pane, moving to page 2. `replace` when the change is a refinement of the current view and back-stepping through it would be noise: typing in a search box, dragging a slider, toggling one facet on a long filter bar. Getting it wrong in the `push` direction is the more visible bug — a user presses Back once to leave the page and instead unwinds twenty keystrokes.

**★ How do you debounce a URL-driven filter without making the input feel slow?**
Debounce the navigation, never the input. The field's value lives in local state and updates synchronously on every keystroke; a timer schedules the `router.replace`. Two cases bypass the timer: clearing the field, because the user wants the unfiltered view immediately, and pressing Enter, because that is an explicit commit. Wrapping the navigation in a transition additionally keeps the current results on screen and interactive while the new ones are computed, instead of blanking them behind a fallback. And the timer must be cleared on unmount, or a navigation fires into a component that no longer exists.

**★ Why is throttling a URL write not optional?**
Because browsers rate-limit the History API, and a control bound to continuous input — a text field, a slider — can exceed that limit trivially. The commonly used floor is about 50 ms, and Safari is materially stricter at 120 ms, with older versions needing 320 ms. Exceeding it does not merely waste work: the browser can refuse or queue the updates, so the URL and the UI diverge. This is one of the strongest practical arguments for a library rather than a hand-rolled hook — the throttle is per-browser knowledge that has to be maintained, and it is invisible until a user on Safari reports something you cannot reproduce.

**★ Why does `useLinkStatus` not help a router-driven filter?**
Because it reports the pending state of the `<Link>` that encloses it, and a `router.replace` has no enclosing link. For programmatic navigation the pending signal has to come from elsewhere: wrap the call in `startTransition` and use the transition's own flag. Note that this pattern is not documented in the Next.js `useRouter` reference — it is standard in the ecosystem, and `nuqs` documents the identical behaviour for its own updates — so it is worth treating as a well-supported convention rather than an API guarantee.

**★ What is the security concern with `router.push`?**
The reference states it directly: an untrusted or unsanitised URL passed to `router.push` or `router.replace` is an XSS vector, because a `javascript:` URL will execute in the context of your page. This is a live risk for exactly the feature this chapter is about — "restore this saved view" or "open the link a colleague shared" features that take a URL out of user data and hand it to the router. The defence is never to pass an href through: parse the input, validate the parts against an allow-list, and rebuild the URL from a fresh `URLSearchParams`.

---

← [03f · Writing the URL declaratively](03f-url-as-state-writing-declaratively.md) · [Chapter 8 overview](01-explanation.md) · Next → [03h · Shallow updates and the History API](03h-url-as-state-shallow-updates-and-the-history-api.md)
