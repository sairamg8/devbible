---
title: "The three-row table has no row for the session and no row for the DOM — which is why theme flickers, cookie writes that never reach the server, and lost input text keep being filed as state-management problems"
sidebar_label: "01b · The categories the table omits"
sidebar_position: 2
description: "Cookie and session state as request input with four documented rules of its own, the platform-owned state React never holds, and a five-question decision procedure you can run against a real value on a real screen."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`lastUpdated: 2026-06-09`), [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) (`lastUpdated: 2026-08-25`), [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`), [Data Security](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`) and the [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) directive reference.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2. Documentation-verified; **no sandbox run**.

**[01](01-the-fundamental-split-server-state-data-on-the-server-cached.md) replaced *where a value lives* with *who is authoritative for it* and *what may destroy it*. Run those two questions across a real application and two whole categories fall out that the server/client/URL table has no row for. The first is the session: a cookie is written by the server, stored by the browser, and read by the server as **request input**, which makes it neither server state nor client state and gives it four documented rules that belong to neither. The second is the state React never holds at all — scroll offset, disclosure, focus, an uncontrolled input's text — owned by the DOM, unserialisable, and routinely reimplemented in a store by people who did not know it was already there. This page closes both gaps and then gives you the decision procedure the whole chapter runs on.**

## The fourth category: cookie and session state

The three-row table has no row for the value that decides what most of your app renders — the session. It is neither server state nor client state, and forcing it into either row produces a specific class of bug.

**It is request input.** The browser stores it, the server writes it, and the server reads it as part of the request:

> *"`cookies` is an **async** function that allows you to read the HTTP incoming request cookies in Server Components, and read/write outgoing request cookies in Server Functions or Route Handlers."*
> — [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies)

Four documented rules make this its own category rather than a variant of the other two:

**1 · The server can read it during render but cannot write it during render.**

> *"Setting cookies is not supported during Server Component rendering. To modify cookies, invoke a Server Function from the client or use a Route Handler."*

> *"HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler."*

**2 · Writing one re-renders the route without unmounting your client tree.**

> *"After you set or delete a cookie in a Server Function, Next.js can return both the updated UI and new data in a single server roundtrip when the function is used as a Server Action (e.g., passed to a form's `action` prop)."*

> *"The UI is not unmounted, but effects that depend on data coming from the server will re-run."*

That is the whole reason a theme toggle or a locale switcher does not need a store: the cookie write *is* the state update, and the re-render rides the action's own response. No `refresh()` call is needed after it.

**3 · It cannot be read inside a cached scope.** From the `use cache` reference:

> *"Cached functions and components **cannot** access runtime APIs like `cookies()`, `headers()`, or `searchParams`, and the restriction follows the call stack: a helper the cached function calls that reads one of these fails the same way, with the `next-request-in-use-cache` error. On a dynamically rendered route this surfaces when the route runs, so it can pass `next build` and fail under `next start`."*

**4 · Anything derived from it is cached per session, in the browser, not in the shared server cache.**

> *"An App Shell that reads `cookies()` or `headers()` is session-specific, cached per session on the client rather than in the shared server cache."*

So session-derived values have an authority (the cookie jar, which the browser owns), a lifetime (the cookie's `maxAge`/`expires`, or a logout), and a caching story that is different from both server state and client state. That is a fourth category, not a footnote.

⚠️ One deliberate trap the docs call out: a cookie is *client-supplied input*, so its presence proves nothing about authorisation. The Data Security guide's own bad example trusts `searchParams`; the same reasoning applies to a raw cookie value. Re-verify inside every Server Action.

## The fifth category: state nobody in React owns

Scroll offset. The open/closed state of a `<details>` element. The value in an uncontrolled `<input>` before hydration. Video playback position. Text selection. Focus.

React does not hold these; the DOM does. They are documented as legitimate interactivity that needs no Client Component at all:

> *"Built-in browser and HTML behavior can provide interactivity without a Client Component. For example: A `<details>` element opens and closes. A `<form>` can submit through a Server Function passed to its `action` prop. A `<video controls>` element plays and pauses."*
> — [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)

Two things follow. First, a surprising amount of "state" disappears if you let the platform hold it — a disclosure panel and a search form both work with zero JavaScript. Second, this state has a lifetime you do not control and cannot serialise: it survives `router.refresh()` (scroll is named explicitly in the quote above) but not a route change, and React will happily blow it away when it reconciles a subtree.

And the corresponding hard rule:

> *"Mutating Server Component DOM nodes directly can put the DOM out of sync with React's component tree."*

## The decision procedure

Run these in order against a value in front of you. The first one that answers, wins.

| # | Question | If yes |
| :--- | :--- | :--- |
| 1 | Can the value be recomputed from the database, the URL and the session, at any time, without the browser's help? | **Server state.** Do not copy it into a store. Read it in a Server Component; invalidate on mutation. |
| 2 | Should the value survive a reload, and should a shared link reproduce it? | **URL state.** `searchParams`, read on the server. |
| 3 | Does it identify or configure *the user* rather than *the view* — session, theme, locale, tenant, consent? | **Cookie/session state.** Write it from a Server Action; read it with `cookies()`. |
| 4 | Does the browser or the DOM already hold it correctly — scroll, focus, disclosure, media position? | **Platform state.** Do nothing. |
| 5 | Is the browser genuinely authoritative, and can the value be destroyed by a reload without anyone caring? | **Client state.** Now — and only now — choose between `useState`, Context and a store. |

If you reached 5, the follow-up question is [how many components need to agree** — that is what selects between `useState`, lifting the boundary, Context, and a real store, and it is the subject of **04 · Client state tools compared](04-client-state-tools-compared-react-context-zustand-jotai.md).

### The procedure applied to one screen

A task board at `/board?status=open&q=login`:

```tsx filename="app/board/page.tsx"
import { listTasks } from '@/data/tasks'
import { getViewerPreferences } from '@/data/preferences'
import { BoardShell } from './board-shell'
import { TaskCard } from './task-card'

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status = 'open', q = '' } = await searchParams

  // Q1 → server state. Derived from the URL, re-derived on every navigation.
  const tasks = await listTasks({ status, q })

  // Q3 → cookie/session state. Read, never written, during render.
  const prefs = await getViewerPreferences()

  return (
    <BoardShell density={prefs.density}>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </BoardShell>
  )
}
```

`BoardShell` is the only Client Component on the page. It owns exactly one thing — which cards are selected for a bulk action — because that is the only value on the screen for which question 5 is the first `yes`.

```tsx filename="app/board/board-shell.tsx"
'use client'

import { useState, type ReactNode } from 'react'

export function BoardShell({
  density,
  children,
}: {
  density: 'compact' | 'comfortable'
  children: ReactNode
}) {
  // Q5 → client state. Destroyed by a reload; nobody cares.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  return (
    <div data-density={density} data-selected={selected.size}>
      {children}
    </div>
  )
}
```

The `tasks` array never enters the client module graph. `TaskCard` stays a Server Component, rendered on the server and handed to `BoardShell` as already-rendered output — the mechanism for which is [01b](01c-the-rsc-payload-is-the-transport.md).

## Gotchas

**★ Symptom: the theme flickers to the wrong value for one frame on every page load.** The theme was treated as client state and read from `localStorage` in an effect, so the server rendered the default and the browser corrected it after hydration. Cause: question 3 was skipped — a theme is session state, and the server can read it. Fix: move it into a cookie so the very first HTML byte is already correct.

```ts filename="app/actions/preferences.ts"
'use server'

import { cookies } from 'next/headers'

export async function setTheme(theme: 'light' | 'dark') {
  const store = await cookies()
  store.set('theme', theme, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  // No refresh() needed: the cookie write re-renders the route in this response.
}
```

```tsx filename="app/layout.tsx"
import { cookies } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('theme')?.value === 'dark' ? 'dark' : 'light'
  return (
    <html data-theme={theme}>
      <body>{children}</body>
    </html>
  )
}
```

**★ Symptom: `cookies()` inside a `use cache` function throws `next-request-in-use-cache`, and only after deploy.** Cause: the restriction follows the call stack, so a shared helper that reads the session poisons every cached function that calls it — and on a dynamically rendered route it surfaces at request time, so `next build` passes. Fix: read the session *outside* the cached scope and pass the derived, non-identifying part in as an argument, which also makes it part of the cache key.

```ts filename="data/tasks.ts"
import 'server-only'
import { cookies } from 'next/headers'

async function tasksForTeam(teamId: string) {
  'use cache'
  // No cookies() in here. teamId is captured and becomes part of the cache key.
  return db.task.findMany({ where: { teamId } })
}

export async function listTasksForViewer() {
  const teamId = (await cookies()).get('team')?.value ?? 'default'
  return tasksForTeam(teamId)
}
```

[★ Symptom: filters work, but a shared link opens the unfiltered board.** The filter was `useState`, so it existed only in the tab that set it. Cause: question 2 was skipped. Fix: put it in the URL and let the server read it — the full pattern is **03 · URL as state](03-url-as-state-searchparams-nuqs-style-patterns-shareable-filt.md), but the minimum is a `<form>` with `method="get"`, which needs no JavaScript at all.

```tsx filename="app/board/filters.tsx"
export function Filters({ status, q }: { status: string; q: string }) {
  return (
    <form method="get">
      <input name="q" defaultValue={q} aria-label="Search tasks" />
      <select name="status" defaultValue={status}>
        <option value="open">Open</option>
        <option value="done">Done</option>
      </select>
      <button type="submit">Apply</button>
    </form>
  )
}
```

**★ Symptom: an uncontrolled input loses what the user typed when an unrelated part of the page updates.** Cause: platform state lives in the DOM node, and React discarded that node when it reconciled the subtree — usually because a `key` changed or a conditional swapped the element's position. Fix: give the element a stable identity, or promote the value to real client state if it must survive reconciliation.

```tsx
'use client'

// 🔴 key changes on every server revalidation → the node is replaced, text is lost
// <input key={task.updatedAt} defaultValue={task.title} />

// ✅ stable identity across re-renders
export function TitleField({ task }: { task: TaskDTO }) {
  return <input key={task.id} name="title" defaultValue={task.title} />
}
```

**★ Symptom: `document.cookie` is set on the client and the next server render still sees the old value.** Cause: the browser did update the jar, but nothing asked the server to render again — a client-side cookie write is not a request. Fix: write it in a Server Action, which both sets the cookie and returns the re-rendered route in the same response.

```tsx
'use client'

import { setTheme } from '@/app/actions/preferences'

export function ThemeToggle({ current }: { current: 'light' | 'dark' }) {
  return (
    <form action={setTheme.bind(null, current === 'dark' ? 'light' : 'dark')}>
      <button type="submit">Switch theme</button>
    </form>
  )
}
```

**★ Symptom: a session-derived greeting is shared between two different users in production but never in development.** Cause: the value was cached in a scope that is not keyed by the session, and in development each request effectively gets a fresh worker. Fix: never let a session value into a shared cache key-less scope; derive it per request, and if it must be cached, use the browser-only profile.

```ts filename="data/greeting.ts"
import 'server-only'
import { cookies } from 'next/headers'

export async function greeting() {
  'use cache: private' // "The result is cached in the browser only, not on the server."
  const name = (await cookies()).get('display_name')?.value ?? 'there'
  return `Welcome back, ${name}`
}
```

⚠️ `use cache: private` is documented as browser-only and therefore *"can't be part of the static shell"* — it buys you a per-session cache, not a shared one.

**★ Symptom: `createContext` used directly in a layout fails.** Cause: *"React context is not supported in Server Components."* Fix: put the provider in its own Client Component that accepts `children`, and render it as deep in the tree as it can go — the docs' advice is explicit that wrapping the whole document costs you static optimisation.

```tsx filename="app/board/theme-provider.tsx"
'use client'

import { createContext, type ReactNode } from 'react'

export const DensityContext = createContext<'compact' | 'comfortable'>('comfortable')

export function DensityProvider({
  value,
  children,
}: {
  value: 'compact' | 'comfortable'
  children: ReactNode
}) {
  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
}
```

## Interview questions

**★ Why is "the theme" a bad example of client state?**
Because it has to be right in the first byte of HTML. If the browser is authoritative and you read it from `localStorage` in an effect, the server necessarily renders a default and the user sees a flash of the wrong theme on every cold load. A cookie makes the server authoritative for rendering while the browser remains the store, which is exactly the fourth category — request input. It also means the theme is available inside layouts and Server Components without a provider.

**★ A teammate proposes a Context provider holding the current user, wrapped around the entire app. What is wrong with it?**
Three things, in increasing severity. It creates a second authority for a value the server can already read from the session on every render. It pushes a client boundary to the root of the tree, which the docs specifically advise against — *"You should render providers as deep as possible in the tree"* — costing you static optimisation of everything below it. And it serialises the user object across the boundary, so whatever fields that object carries are now in the payload and visible to the user, which is the exact failure the Data Security guide's DTO advice exists to prevent.

**★ How do you decide between the URL and a cookie for a value like "compact view"?**
Ask whether the value describes the *view* or the *viewer*. If a shared link should reproduce it, it is view state and belongs in the URL. If it should follow the person across every route and every link they open, it is viewer state and belongs in a cookie. Density and theme are viewer state; a filter and a sort order are view state. Getting this backwards produces either links that do not reproduce what the sender saw, or preferences that reset every time the user navigates.

**★ Where should a Context provider live, and why not at the root?**
As deep in the tree as the consumers allow. The provider must be a Client Component, and everything it *renders directly* joins the client module graph — so a provider wrapped around `<html>` pulls the whole document's directly-rendered tree with it and forfeits static optimisation of everything inside. The documented advice is to render providers *"as deep as possible in the tree"*, and the escape hatch when you truly need one high up is to have it accept `children`, so the subtree is passed in as already-rendered output rather than imported.

**★ Why does forcing the session into the "server state" row cause bugs?**
Because server state is defined by being re-derivable and cacheable, and a session value is neither. It is an input to the render, not an output of it — it arrives on the request, and a cached scope is explicitly forbidden from reading it: a `use cache` function that calls `cookies()`, directly or through a helper, fails with `next-request-in-use-cache`. Treating the session as server state leads people to wrap session-dependent data access in `use cache` for performance and then discover the failure only under `next start`, because on a dynamically rendered route the error surfaces when the route runs rather than at build.

**★ Can you set a cookie while a Server Component renders? Why is the answer structural rather than a policy?**
No, and the reason is HTTP, not Next.js taste: *"HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler."* Rendering a streamed response means headers are already on the wire by the time your component runs. The docs put it plainly — *"Setting cookies is not supported during Server Component rendering"* — and pair it with the general rule that mutations must not be render side effects at all. The correct shape is a `<form action={…}>` posting to a Server Action, which sets the cookie and returns the re-rendered route in the same response.

**★ Which pieces of interactivity should you delete a Client Component for?**
Anything the platform already implements to spec: a `<details>` disclosure, a `<video controls>` player, a `<dialog>`, an anchor, and above all a `<form>` — including one with `method="get"` for filters, which puts the value in the URL for free and works with JavaScript disabled. The documentation lists these as interactivity that *"can provide interactivity without a Client Component"*. The win is not only bundle size: platform state needs no hydration, so it is correct before your JavaScript loads, which is exactly when a flicker or a lost keystroke would otherwise happen.

**★ Run the decision procedure on "which tab of a detail panel is open". It is genuinely ambiguous — what decides it?**
Question 2 does, and the answer depends on the product. If a colleague pasting the link should land on the same tab — a bug report where "Activity" and "Attachments" are meaningfully different views — it is URL state, and the server can render only the selected tab, which also removes the cost of rendering the others. If the tab is a local convenience and a shared link should open the default, it is client state and `useState` is correct. The tell that you chose wrong is the back button: URL tabs make Back close the tab instead of leaving the page, which users either want or find infuriating, and that is a product decision rather than an engineering one.

---

← [01 · The fundamental split](01-the-fundamental-split-server-state-data-on-the-server-cached.md) · [Chapter 8 overview](01-explanation.md) · Next → [01c · The RSC payload is the transport](01c-the-rsc-payload-is-the-transport.md)
