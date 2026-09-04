---
title: "The filter bar is the hardest client component in the milestone because it owns nothing — it renders the URL, writes the URL, and the only local state it is allowed is the one React refuses to let a transition control"
sidebar_label: "07d · Milestone: the filter bar"
sidebar_position: 46
description: "Chapter 8's capstone, step three: writing filters back with router.replace inside a transition, why a controlled text input cannot live in a transition and needs a second state variable, replace versus push and what each does to the back button, debouncing on top of a transition, and re-syncing the input after a back navigation."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against React's [`useTransition`](https://react.dev/reference/react/useTransition)
> (Caveats and Troubleshooting), the Next.js [`useSearchParams` reference](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
> (`lastUpdated: 2026-07-14`) and the [`useRouter` reference](https://nextjs.org/docs/app/api-reference/functions/use-router)
> (`lastUpdated: 2026-07-01`). Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**A filter bar that stores its own filters is broken in four ways at once, and a filter bar that stores none of them freezes while you type.** The resolution is not a compromise: the URL is the single source of truth for what is filtered, and the one piece of local state that exists — the raw text in the search box — exists because React will not let a transition drive a controlled input, and says so in as many words. This page builds the component, explains why every line of it is the way it is, and handles the case everybody's first version gets wrong: pressing the back button.

## The rule that shapes the whole component

> *"Transition updates can't be used to control text inputs."*
> — [`useTransition`, Caveats](https://react.dev/reference/react/useTransition#caveats)

And the reason, from the same page:

> *"This is because Transitions are non-blocking, but updating an input in response to the change event should happen synchronously. If you want to run a Transition in response to typing, you have two options: You can declare two separate state variables: one for the input state (which always updates synchronously), and one that you will update in a Transition."*
> — [`useTransition`, Troubleshooting: *Updating an input in a Transition doesn't work*](https://react.dev/reference/react/useTransition#updating-an-input-in-a-transition-doesnt-work)

In this milestone the "second state variable" is not a variable at all — it is the URL. The synchronous one is a plain `useState` holding exactly what is in the box. That is the entire architecture of the component, and everything else is bookkeeping around it.

## The component

```tsx filename="app/(dashboard)/boards/[boardId]/filter-bar.tsx"
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  STATUSES,
  parseFilters,
  toSearchParams,
  type Status,
} from '@/lib/board/filters'

const DEBOUNCE_MS = 300

export function FilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // The URL is the source of truth for what is filtered.
  const filters = parseFilters(Object.fromEntries(collect(searchParams)))

  // The one piece of local state: the raw text in the box, updated synchronously.
  const [text, setText] = useState(filters.q)

  // What we last wrote to the URL ourselves, so we can tell our own write
  // apart from a back/forward navigation.
  const lastWritten = useRef(filters.q)

  // Back/forward changed `q` to something we did not type: adopt it.
  useEffect(() => {
    if (filters.q !== lastWritten.current) {
      lastWritten.current = filters.q
      setText(filters.q)
    }
  }, [filters.q])

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  function write(next: Parameters<typeof toSearchParams>[0], mode: 'push' | 'replace') {
    const qs = toSearchParams(next).toString()
    const href = qs ? `${pathname}?${qs}` : pathname
    startTransition(() => {
      router[mode](href, { scroll: false })
    })
  }

  function onText(value: string) {
    setText(value) // synchronous — the input is never behind the user
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      lastWritten.current = value
      write({ ...filters, q: value }, 'replace')
    }, DEBOUNCE_MS)
  }

  function toggleStatus(s: Status) {
    const next = filters.status.includes(s)
      ? filters.status.filter((x) => x !== s)
      : [...filters.status, s]
    write({ ...filters, status: next }, 'push')
  }

  function clearAll() {
    clearTimeout(timer.current)
    lastWritten.current = ''
    setText('')
    write({ status: [], assignee: undefined, q: '' }, 'push')
  }

  return (
    <div className="filter-bar" data-pending={isPending || undefined}>
      <input
        type="search"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            clearTimeout(timer.current)
            lastWritten.current = text
            write({ ...filters, q: text }, 'replace')
          }
        }}
        placeholder="Search cards"
        aria-label="Search cards"
      />

      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={filters.status.includes(s)}
          onClick={() => toggleStatus(s)}
        >
          {s}
        </button>
      ))}

      <button type="button" onClick={clearAll}>
        Clear
      </button>
    </div>
  )
}

/** useSearchParams returns a read-only URLSearchParams; flatten repeats to arrays. */
function collect(sp: URLSearchParams): [string, string | string[]][] {
  const out = new Map<string, string | string[]>()
  for (const key of new Set(sp.keys())) {
    const all = sp.getAll(key)
    out.set(key, all.length > 1 ? all : all[0])
  }
  return [...out]
}
```

## Why `replace` for typing and `push` for a chip

The two methods differ on exactly one thing, and the reference states it plainly:

> *"`router.replace(href, { scroll: boolean, transitionTypes: string[] })`: Perform a client-side navigation to the provided route **without adding a new entry into the browser's history stack**."*
> — [`useRouter()`](https://nextjs.org/docs/app/api-reference/functions/use-router#userouter)

Typing "flaky test" is one intention expressed over ten keystrokes. Debounced, that is still three or four URL writes, and with `push` the back button walks the user through `flak`, `flaky t`, `flaky tes` before it does anything they would recognise as "go back". `replace` collapses them: the address bar is always current, the history stack holds one entry for "I searched".

Toggling a status chip is one intention, once. `push` makes the back button undo it, which is what a user pressing Back after clicking a filter is asking for. Mixing the two is not a hack — it is the correct model, because the history stack should record *decisions*, and a keystroke is not one.

`{ scroll: false }` is not optional here. Navigation scrolls to the top by default, and a board that jumps to the top on every debounced keystroke is unusable when the user has scrolled to a column halfway down.

## Debounce and transition are not alternatives

They solve different problems and the component needs both.

- **Debounce** controls *how many navigations happen*. Without it, four hundred keystrokes are four hundred renders on the server.
- **The transition** controls *what the UI does while one is happening*. `isPending` is scoped to this update, so the board can dim while the new results resolve instead of either freezing or flashing a skeleton.

Dropping the debounce gives you a correct but expensive component. Dropping the transition gives you a cheap component with no way to say "working". And note the interruption rule, which is why fast typing does not queue up stale renders:

> *"A state update marked as a Transition will be interrupted by other state updates."*
> — [`useTransition`, Caveats](https://react.dev/reference/react/useTransition#caveats)

## The back button, and the `lastWritten` ref

This is the part everybody's first version gets wrong. The input has local state; the URL is the source of truth; a back navigation changes the URL without going through `onText`. Without the effect, the address bar says `?q=flaky` and the box says `flaky test`, and the user is now looking at two contradictory claims about what they searched for.

Naively syncing with `useEffect(() => setText(filters.q), [filters.q])` fights the user: every self-write also changes `filters.q`, so the effect fires mid-typing and can clobber characters typed during the navigation. The `lastWritten` ref is what distinguishes "the URL changed because I changed it" from "the URL changed because the browser did", and only the second one adopts the new value.

If you would rather not own that reconciliation at all, the alternative is an uncontrolled input plus `defaultValue={filters.q}` and a `key={filters.q}` so a back navigation remounts it. That is fewer lines and it forfeits the ability to render anything derived from the in-progress text, such as a live result count.

## Gotchas

**★ Symptom: the search box lags behind the keyboard — characters appear late or out of order.** Cause: the input's value is driven by state updated inside `startTransition`, which React explicitly does not support for controlled inputs because a transition is non-blocking and a change event must be handled synchronously. Fix: two values, the synchronous one on the input and the transitioned one everywhere else:

```tsx
// 🚩 the input is now at the mercy of a non-blocking update
onChange={(e) => startTransition(() => setText(e.target.value))}
// ✅ synchronous for the input, transition only for the navigation
onChange={(e) => { setText(e.target.value); scheduleUrlWrite(e.target.value) }}
```

**★ Symptom: pressing Back after searching walks backwards one character at a time.** Cause: `router.push` on every debounced write, each of which adds a history entry. Fix: `router.replace` for continuous input, `router.push` only for discrete decisions — the `mode` parameter on `write()` above exists solely to make that choice explicit at every call site.

**★ Symptom: the board scrolls to the top on every keystroke.** Cause: navigation scrolls by default. Fix: `router.replace(href, { scroll: false })` — and note it must be passed on the chip path too, or clicking a filter halfway down the board throws the user back to the header.

**★ Symptom: after a back navigation the URL and the search box disagree.** Cause: local input state has no idea a navigation happened. Fix: the `lastWritten` ref plus the guarded effect shown above; adopt the URL's value only when it differs from what this component last wrote.

**★ Symptom: `searchParams.set(...)` throws or silently does nothing.** Cause: the hook hands back an immutable view — *"`useSearchParams` returns a **read-only** version of the `URLSearchParams` interface"* — so the mutating methods are not there to call. Fix: build a new one. `toSearchParams(filters)` does that from the parsed object; if you need to preserve unknown keys, copy first:

```ts
const next = new URLSearchParams(searchParams.toString())
next.set('q', value)
```

**★ Symptom: the URL accumulates empty parameters — `?status=&assignee=&q=`.** Cause: writing every field unconditionally. It is not merely ugly: two URLs that mean the same thing now differ as strings, which breaks link deduplication, analytics grouping and any test that asserts on the href. Fix: omit empties at the single serialisation point, which is what `toSearchParams` does with `if (f.q) sp.set('q', f.q)`, and drop the `?` entirely when nothing is set — the `href` expression above does exactly that.

**★ Symptom: a navigation fires after the user has already left the board.** Cause: a pending debounce timer surviving unmount. Fix: clear it in a cleanup, which is the one-line effect `useEffect(() => () => clearTimeout(timer.current), [])`. Without it, the timer resolves against a router from a page that no longer exists.

**★ Symptom: pressing Enter in the search box does nothing for 300ms, or submits a form.** Cause: the debounce owns the write and Enter is not wired to bypass it; if the input sits inside a `<form>`, Enter also triggers a native submit and a full navigation. Fix: handle `Enter` by clearing the timer and writing immediately — the `onKeyDown` branch above — and either keep the bar out of a `form` or call `preventDefault` on its submit.

**★ Symptom: a filter click during a slow search leaves the board showing results for neither.** Cause: two transitions in flight and an assumption that the first one's result will land first. Fix: nothing to write — this is why the URL is the source of truth. Each navigation renders from the URL it navigated to, and React interrupts the superseded transition rather than committing it. The bug appears only if you *also* keep a copy of the filters in local state, at which point the local copy and the URL can disagree about which navigation won.

**★ Symptom: a security review flags `router.replace` as an XSS sink.** Cause: an href assembled from user input. The reference is explicit: *"You must not send untrusted or unsanitized URLs to `router.push` or `router.replace`, as this can open your site to cross-site scripting (XSS) vulnerabilities. For example, `javascript:` URLs sent to `router.push` or `router.replace` will be executed in the context of your page."* Fix: never let user text become the *path*. The component above builds `href` from `usePathname()` — framework-supplied — plus a `URLSearchParams` that percent-encodes everything the user typed. A "saved view" feature that stores a whole href and replays it is where this rule actually gets broken.

**★ Symptom: the initial HTML for the header is empty and the filter bar pops in.** Cause: `useSearchParams` with no `Suspense` boundary between it and the top of the client tree, which client-renders that entire tree. Fix: the boundary in [07c](07c-milestone-reading-filters-in-the-page.md)'s page, wrapped as tightly around `FilterBar` as possible.

**★ Symptom: `isPending` never becomes true, so the dim state never appears.** Cause: `router.replace` was called outside `startTransition` — a navigation is already transitioned internally, but your `useTransition` instance only tracks work started inside *its own* `startTransition`. Fix: keep the call inside, as `write()` does. If you also want the pending state for `Link` navigations you did not initiate, that is a different mechanism and not this hook.

## Interview questions

**★ Why can't a controlled text input be driven by state updated inside a transition?**
Because a transition is explicitly non-blocking — React is allowed to defer, interrupt and restart it — while a controlled input's value must be updated synchronously in response to the change event, or the DOM node and React's idea of its value diverge and characters appear late or in the wrong order. React documents both halves: the caveat that transition updates can't control text inputs, and the reason that updating an input in response to change "should happen synchronously". The prescribed shape is two state variables, one synchronous for the input and one transitioned for everything downstream. In this component the downstream one is the URL.

**★ You have both a 300ms debounce and a transition. Isn't one of them redundant?**
No, they are orthogonal. The debounce decides *how many* server renders happen — without it, every keystroke is a navigation. The transition decides *what the UI does during one* — it gives you an `isPending` flag scoped to this update so the results can dim rather than freeze or flash a skeleton, and it lets React interrupt a superseded render instead of committing it. Remove the debounce and you have a correct but wasteful component; remove the transition and you have a cheap component that cannot tell the user anything is happening.

**★ When is `push` right and when is `replace` right for a URL-state update?**
Ask whether the change is a decision the user would want to undo with the back button. Toggling a filter is a decision: `push`, so Back removes it. A keystroke inside a search term is not a decision, it is a fragment of one: `replace`, so the history stack records "they searched" once rather than once per debounce window. The general rule holds beyond filters — a tab change is usually `push`, a scroll-position or sort-direction sync is usually `replace`, and an autosaving field is always `replace`.

**★ In a Client Component, should you read the query string with `useSearchParams` or take the `searchParams` prop?**
Prefer the prop when the value is already available from the page, and the Next.js docs recommend exactly that — fetch based on the page's `searchParams` prop and pass it down, because the hook is client-only and reading it forces client-side rendering up to the nearest Suspense boundary. Use the hook when the component is not a descendant of the page in a way that makes prop-passing practical, or when it needs to *write* the URL and therefore needs the current value at the moment of the click rather than at the moment of the last render. The filter bar is the second case: it lives in the header, several layers away, and it is a writer.

**★ The board is filtered by the URL. Why does the component keep any local state at all?**
Exactly one piece: the literal characters in the search box, which must update synchronously per keystroke and which the URL is deliberately behind by a debounce window. Every other value the bar renders — which chips are active, which assignee is selected, whether anything is filtered — is derived from `useSearchParams` on every render and stored nowhere. That asymmetry is the design: the only local state is the one React's own rules force you to have.

**★ What is the `lastWritten` ref actually protecting against, and could you delete it?**
It distinguishes a URL change this component caused from a URL change the browser caused. Without it, the sync effect fires after every self-write too, so a character typed during the in-flight navigation can be overwritten by the value that navigation carried — a rare, timing-dependent dropped keystroke that is miserable to reproduce. You can delete it if you make the input uncontrolled with `defaultValue` and remount it with `key={filters.q}` on a back navigation, which trades the ref for a remount and gives up rendering anything derived from the in-progress text.

---

← [07c · Filters in the page](07c-milestone-reading-filters-in-the-page.md) · [Chapter 8 overview](01-explanation.md) · Next → [07e · The scoped Zustand store](07e-milestone-the-scoped-zustand-store.md)
