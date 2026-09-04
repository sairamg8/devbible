---
title: "React Context is dependency injection, not a state manager — and in an RSC app it carries a second constraint nobody mentions: a provider is a client component, so where you mount it decides how much of your tree stops being server-rendered"
sidebar_label: "04 · Context is not a state manager"
sidebar_position: 23
description: "What Context actually does and does not do, why 'Context is a state manager' is wrong, the RSC rule that a provider must be a Client Component, and the children slot that keeps the tree below it server-rendered."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`)
> and the React reference — [`useContext`](https://react.dev/reference/react/useContext), [`createContext`](https://react.dev/reference/react/createContext).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**"Context is a state manager" is the most expensive sentence in front-end architecture, because it is half true in a way that survives review. Context does not hold state — `useState` holds state, and Context transports it past the components in between. That is dependency injection, and it is genuinely good at it. What it is bad at is the thing people reach for it for: many consumers reading fine-grained slices of a frequently-changing value, where every consumer re-renders on every change regardless of which slice it reads. In an RSC app there is a second constraint on top: a provider calls `createContext`, so it is a Client Component, and mounting one is a decision about how much of your tree stops being server-rendered.**

## What Context is for

A short and honest list:

| Good fit | Why |
|---|---|
| Theme, locale, text direction | Changes once a session, read everywhere |
| The current user's display identity | Set once per page load, read in many leaves |
| A routing or form primitive's internal wiring | The library owns both ends; consumers are few |
| **A handle to a store** | The value never changes; only the store's contents do |
| Dependency injection for tests | Swap an implementation without prop-drilling |

That fourth row is how every serious client-state library uses Context, and it is the shape the rest of this topic keeps returning to: the *context value* is a stable store handle, and subscriptions to the store's contents happen outside React's context machinery. That is not a workaround — it is the correct division of labour, and the reason Zustand ([04d](04d-zustand-in-an-rsc-app.md)) and Jotai ([04e](04e-jotai-in-an-rsc-app.md)) both use a provider without inheriting Context's re-render behaviour.

## What Context is not for

> *"React automatically re-renders all the children that use a particular context starting from the provider that receives a different `value`. The previous and the next values are compared with the [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) comparison."*
> — [`useContext`](https://react.dev/reference/react/useContext)

Two words in that sentence do the damage. **All** the children that use the context re-render — not the ones whose slice changed, all of them. And the comparison is `Object.is`, so an object literal built during render is a new value on every render even when its contents are identical.

A drag-and-drop board holding `{ draggedId, hoverColumn, selection, columns }` in one context re-renders every consumer on every pointer move. That is the failure this reputation is built on, and [04b](04b-context-re-renders-and-how-to-contain-them.md) is entirely about containing it.

The rule of thumb worth memorising: **Context's cost is proportional to how often the value changes times how many components consume it.** Theme is `1 × many`. Drag state is `many × many`.

## 🔴 The RSC constraint: a provider is a Client Component

> *"React context is commonly used to share global state like the current theme. However, React context is not supported in Server Components."*
> — [Server and Client Components, Context providers](https://nextjs.org/docs/app/getting-started/server-and-client-components#context-providers)

> *"To use context, create a Client Component that accepts `children`"*
> — same section

```tsx filename="app/theme-provider.tsx"
'use client'

import { createContext } from 'react'

export const ThemeContext = createContext({})

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
```

```tsx filename="app/layout.tsx"
import ThemeProvider from './theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

> *"Your Server Component will now be able to directly render your provider, and all other Client Components throughout your app will be able to consume this context."*
> — same section

## The `children` slot is the whole trick

This is the part that decides whether adding a provider costs you the server-rendered tree.

> *"Once a file is marked with `"use client"`, **all of its imports and the components it directly renders are included in the client bundle**."*
> — [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

> *"This behavior applies to components that are part of the Client Component's module graph, which includes the modules it imports and the components it renders directly. **It does not apply to Server Components passed as children or other props.** Those components are not imported into the Client Component's module graph. They are rendered on the server and passed to the Client Component as rendered output."*
> — same section

So the two shapes below are not stylistic variants; they produce completely different builds:

```tsx filename="app/theme-provider.tsx"
'use client'
// ❌ The provider imports the tree. Dashboard, and everything Dashboard
//    imports, is now in the client module graph.
import { createContext } from 'react'
import Dashboard from './dashboard'

export const ThemeContext = createContext('dark')

export default function ThemeProvider() {
  return (
    <ThemeContext.Provider value="dark">
      <Dashboard />
    </ThemeContext.Provider>
  )
}
```

```tsx filename="app/theme-provider.tsx"
'use client'
// ✅ The provider accepts a slot. Whatever is passed in was rendered on the
//    server and arrives as rendered output.
import { createContext } from 'react'

export const ThemeContext = createContext('dark')

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
```

> *"A common pattern is to use `children` to create a *slot* in a `<ClientComponent>`. For example, a `<Cart>` component that fetches data on the server, inside a `<Modal>` component that uses client state to toggle visibility."*
> — [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

The mental model: **a Client Component may not *import* a Server Component, but it may *hold a hole* for one.** `children` is that hole. `props` other than `children` work identically.

## Render providers as deep as you can

> *"**Good to know**: You should render providers as deep as possible in the tree – notice how `ThemeProvider` only wraps `{children}` instead of the entire `<html>` document. This makes it easier for Next.js to optimize the static parts of your Server Components."*
> — [Server and Client Components, Context providers](https://nextjs.org/docs/app/getting-started/server-and-client-components#context-providers)

This is the same argument as [03b](03b-url-as-state-and-the-static-shell.md) made about `searchParams`, applied to a different mechanism: the higher a client boundary sits, the less of the route can be optimised. A board-drag provider belongs around the board, not around the document.

```tsx filename="app/[tenant]/board/page.tsx"
import { BoardDragProvider } from './board-drag-provider'
import { BoardHeader } from '@/components/board-header'
import { Columns } from './columns'

export default function BoardPage() {
  return (
    <main>
      <BoardHeader />              {/* stays a Server Component */}
      <BoardDragProvider>
        <Columns />                {/* server-rendered, passed as children */}
      </BoardDragProvider>
    </main>
  )
}
```

Six providers stacked at the root of `layout.tsx` — theme, toast, modal, analytics, feature flags, a query client — is the standard shape of a migrated Pages Router app, and it is why "we moved to the App Router and the bundle did not shrink" is such a common report. Each one is a client boundary; only `children` escapes it.

## Passing server data into Context

Context cannot be *created* on the server, but the value can come from there — the provider is a client component whose props are server-rendered data:

```tsx filename="app/[tenant]/layout.tsx"
import { getWorkspace } from '@/data/workspace'
import { WorkspaceProvider } from './workspace-provider'

export default async function TenantLayout({
  children,
  params,
}: LayoutProps<'/[tenant]'>) {
  const { tenant } = await params
  const workspace = await getWorkspace(tenant)   // server-side fetch

  return (
    <WorkspaceProvider workspace={workspace}>
      {children}
    </WorkspaceProvider>
  )
}
```

```tsx filename="app/[tenant]/workspace-provider.tsx"
'use client'

import { createContext, useContext } from 'react'
import type { Workspace } from '@/data/workspace'

const WorkspaceContext = createContext<Workspace | null>(null)

export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: Workspace
  children: React.ReactNode
}) {
  // `workspace` is a prop, so its identity is stable for a given server render.
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return value
}
```

🔴 **Everything passed this way is serialised into the RSC payload and shipped to the browser.** A `workspace` object carrying an API key, a billing record or another user's email is now in the page source. Pass the fields the UI renders, not the row you fetched.

There is a documented pattern for streaming a promise through a provider and unwrapping it with `use()`:

> *"To pass server-fetched data through context and read it in Client Components with `use()`, see [Using React's `use` within a Context Provider](https://nextjs.org/docs/app/guides/single-page-applications#using-reacts-use-within-a-context-provider)."*
> — [Server and Client Components, Context providers](https://nextjs.org/docs/app/getting-started/server-and-client-components#context-providers)

## Gotchas

**★ Symptom: adding one provider to `layout.tsx` turned the whole app into a client bundle.** Cause: the provider *imported and rendered* the page tree instead of accepting it as `children`, so everything joined its module graph. Fix: the slot.

```tsx
// ❌ export default function Providers() { return <Ctx.Provider><App /></Ctx.Provider> }
export default function Providers({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>   // ✅
}
```

**★ Symptom: `createContext is not a function`, or `Attempted to call createContext() from the server`.** Cause: the module defining the context has no `'use client'`, so a Server Component imported it. Fix: the directive goes on the file that calls `createContext`.

```tsx filename="app/theme-provider.tsx"
'use client'
import { createContext } from 'react'
export const ThemeContext = createContext('dark')
```

**★ Symptom: a Server Component tries `useContext` and fails.** Cause: Context is not supported in Server Components at all — there is no per-request React tree state for it to live in. Fix: read the value where it is available and pass it down as a prop, or move the consumer to the client.

```tsx
// ❌ a Server Component calling useContext(ThemeContext)
export async function Panel({ theme }: { theme: string }) {   // ✅ prop
  return <section data-theme={theme}>{/* … */}</section>
}
```

**★ Symptom: an API key appears in the page source after adding a workspace provider.** Cause: the whole fetched row was passed as a prop, and props to a Client Component are serialised into the RSC payload. Fix: project the fields the UI actually needs.

```tsx
const workspace = await getWorkspace(tenant)
<WorkspaceProvider workspace={{ id: workspace.id, name: workspace.name, plan: workspace.plan }}>
  {children}
</WorkspaceProvider>
```

**★ Symptom: `useWorkspace()` returns `null` in a component that is clearly inside the layout.** Cause: the component is rendered through a *parallel route* or `template.tsx` slot that does not sit under the provider, or it is in a portal mounted outside the provider's subtree. Fix: throw a named error rather than returning `null` so the boundary problem is visible immediately.

```tsx
export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return value
}
```

**★ Symptom: six providers at the root and the "static" marketing page ships 200 kB of JavaScript.** Cause: every provider is a client boundary at the top of the tree, and the marketing page is inside all of them. Fix: move each provider down to the subtree that needs it.

```tsx
// app/layout.tsx: only what is genuinely global
<ThemeProvider>{children}</ThemeProvider>
// app/(app)/[tenant]/board/page.tsx: the board's own concerns
<BoardDragProvider><Columns /></BoardDragProvider>
```

**★ Symptom: a modal provider at the root makes every route's first paint late.** Cause: hydration of a client boundary blocks interactivity for everything inside it, and the root boundary contains everything. Fix: mount the modal provider in the route group that opens modals, not in the root layout.

**★ Symptom: a context default value silently masks a missing provider in production.** Cause: `createContext({})` gives every consumer a plausible-looking empty object when the provider is absent, so the failure is a wrong render rather than an error. Fix: default to `null` and throw in the hook, as above — the default value should be a value you would never want.

## Interview questions

**★ Why is "Context is a state manager" wrong?**
Because Context does not hold state; it transports it. The state lives in whatever `useState` or `useReducer` sits above the provider, and Context is the delivery mechanism that lets a deep consumer read it without every intermediate component forwarding a prop. That is dependency injection. The distinction matters because it predicts the failure: a real state manager can tell you *which part* of the state changed and notify only the components that read that part, whereas Context's contract is "the value changed, everything that reads it re-renders". Calling it a state manager leads people to put frequently-changing, finely-sliced state in it, which is the one thing its contract cannot make efficient.

**★ Why must a Context provider be a Client Component in the App Router?**
Because `createContext` and `useContext` are client-side React features and are not supported in Server Components — the documentation states that directly. Server Components render once, on the server, with no state, no hooks and no per-instance React tree that a context value could live in. So the file that calls `createContext` carries `'use client'`, and the provider it exports is a Client Component. A Server Component can still *render* that provider, which is why the pattern works at all: the server emits the provider element and its children as rendered output, and the client hydrates the provider.

**★ What does `children` do that an import does not?**
It creates a hole rather than a dependency. Marking a file `'use client'` puts everything it imports and everything it directly renders into the client module graph — but explicitly not components passed to it as `children` or other props, which are rendered on the server and handed over as rendered output. So a provider that imports the page tree drags that whole tree into the client bundle, while a provider that accepts `children` leaves it on the server. The two versions look almost identical in the editor and produce completely different builds, which is why "we adopted the App Router and the bundle did not shrink" almost always traces back to this shape.

**★ Why does the documentation say to render providers as deep as possible?**
Because a provider is a client boundary, and everything above a client boundary that Next.js can prerender is optimisation you get for free. Mounting a provider at the root of `layout.tsx` puts the boundary above every route, so the framework has less freedom to keep static parts static — the same argument the `searchParams` chapter makes about where you `await`. A board-drag provider concerns one route; mounting it around `<html>` imposes its cost on the marketing page. The discipline is to ask which subtree genuinely needs the value and mount the provider exactly there.

**★ How do you get server-fetched data into Context?**
Fetch it in a Server Component — a layout or a page — and pass it as a prop to the client provider, which puts it into the context value. The provider is a Client Component so it can hold context; its props come from the server so the data does not require a client fetch. The critical caveat is that props to a Client Component are serialised into the RSC payload and are therefore visible in the page source, so you project the fields the UI renders rather than passing the row you fetched. For data that should stream rather than block, there is a documented pattern for passing a promise through the provider and unwrapping it with `use()` in the consumer.

**★ What should a context's default value be?**
Something you would never accept as real, and usually `null` with a hook that throws. `createContext({})` or `createContext('light')` gives a consumer rendered outside the provider a plausible value, so a missing provider becomes a subtly wrong render instead of an error — and the component that broke is often nowhere near the component that was mis-mounted. A `null` default plus a `useX()` wrapper that throws a named error converts that class of bug into an immediate, localised failure. It also documents the invariant in code rather than in a comment.

**★ When is Context genuinely the right tool in an RSC app?**
When the value changes rarely and is read widely — theme, locale, the current user's display name, a feature-flag snapshot — or when the value is a *stable handle* to something else, such as a store instance, in which case it never changes at all and the re-render fan-out never fires. The second case is how Zustand and Jotai both use it, and it is worth recognising as a pattern rather than a trick: Context is excellent at injecting a dependency into a subtree, and poor at broadcasting fine-grained updates. Choose it for the first job and it never disappoints.

---

← [03l · nuqs on the server, and when to hand-roll](03l-nuqs-on-the-server-and-when-to-hand-roll.md) · [Chapter 8 overview](01-explanation.md) · Next → [04b · Context re-renders, and how to contain them](04b-context-re-renders-and-how-to-contain-them.md)
