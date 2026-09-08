---
title: "The devtools panel is a live window onto the one QueryClient your app already uses — mount it in the wrong place and it truthfully shows you an empty cache"
sidebar_label: "01 · Mounting the devtools"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Devtools](https://tanstack.com/query/latest/docs/framework/react/devtools), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings, and no screenshots or transcripts of the panel**. Target: **@tanstack/react-query 5.102.8**; the panel ships separately as `@tanstack/react-query-devtools`.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**The devtools are not a debugger bolted onto TanStack Query — they are a renderer over the exact `QueryCache` your `useQuery` calls read from. Every row in the panel is a real cache entry, every state it shows is the state your components are reading this millisecond, and every button mutates that same cache for real. That is what makes the panel worth trusting at 2am: it cannot lie about the cache, because it has no separate copy of it. It can, however, be pointed at a *different* `QueryClient` from the one your app uses — and then it shows you a perfectly accurate view of a cache nothing renders from, which is the single most confusing failure mode in this whole topic.**

## The panel is a view over the cache, not a probe into it

A `QueryClient` owns a `QueryCache`. Each entry in that cache is keyed by the hashed query key and holds the data, the error, the timestamps, and the list of *observers* — the mounted hooks currently subscribed to it. `ReactQueryDevtools` subscribes to that same cache and re-renders when it changes.

This has three consequences that matter more than any feature of the UI:

1. **There is nothing to enable in your query code.** You do not pass a `debug: true`, you do not name your queries. Anything in the cache is in the panel, including queries created by a prefetch, by `setQueryData`, or by a library you did not write.
2. **What the panel shows is not "what the server sent" — it is what the cache holds.** A row showing stale data after a successful request means the write did not land on the key you are looking at, not that the network failed.
3. **Actions in the panel are real cache mutations.** Clicking through them is not a simulation. This is a feature during debugging and a trap during a demo.

The docs describe the purpose in one line:

> *"visualize all the inner workings of React Query"*

and note the scope widened in v5:

> *"Note that since version 5, the dev tools support observing mutations as well."*

That second sentence is load-bearing if you carry a v4 mental model: in v4 you watched queries and instrumented mutations by hand. In v5 an in-flight `useMutation` is visible in the same panel, so "did my mutation even fire" is answerable without a `console.log`.

## Install: it is a separate package, and that is on purpose

> *"npm i @tanstack/react-query-devtools"*

It is not re-exported from `@tanstack/react-query`. Keeping it separate is what lets the bundler drop it — see [01f · Keeping devtools out of production](./01f-keeping-devtools-out-of-production.md).

```bash
npm i -D @tanstack/react-query-devtools
```

⚠️ **Install it as a dev dependency only if you never lazy-load it in production.** The production lazy-load recipe in `01f` imports from the package at runtime in a production build, and a `devDependencies`-only install will be pruned by `npm ci --omit=dev` on your build machine. Pick one story and be consistent; a package that resolves locally and 404s in CI is the classic version of this mistake.

## Where it goes in the tree — the empty-panel bug

The devtools read the `QueryClient` from React context, so **they must render inside `QueryClientProvider`**. Both examples in the docs place the component as a child of the provider.

```tsx
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Dashboard } from './Dashboard'

const queryClient = new QueryClient()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

Render it as a *sibling* of the provider instead and it finds no client. In a monorepo or a micro-frontend where two copies of `@tanstack/react-query` are installed, you get the subtler version: the devtools resolve a context object from copy A while your hooks write to a client created from copy B. The panel renders, it is empty or nearly so, and nothing errors.

The escape hatch is the `client` option, which takes a `QueryClient` directly:

```tsx
// src/devtools.tsx — bypass context entirely when context is the thing you doubt
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './queryClient'   // the same module your app imports

export function Devtools() {
  return <ReactQueryDevtools client={queryClient} initialIsOpen />
}
```

If passing `client` explicitly fills the panel and context did not, you have proved a duplicate-package or provider-placement problem in one step — and that is a diagnosis, not a fix. The fix is to dedupe the dependency (`npm ls @tanstack/react-query` should print one version at one path) or to move the component inside the provider.

## Floating mode vs embedded mode

Two components, one panel.

| | Component | What it renders |
|---|---|---|
| **Floating mode** | `<ReactQueryDevtools />` | a fixed floating toggle button that opens the panel over your app |
| **Embedded mode** | `<ReactQueryDevtoolsPanel />` | the panel itself, as a fixed element inside your app, with no toggle |

```tsx
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
```

Embedded mode exists for the case floating mode cannot serve: you want the panel laid out *beside* your UI rather than over it, or you want your own toggle, your own keyboard shortcut, or the panel docked in an existing debug drawer. Because the panel has no button of its own, mounting/unmounting is entirely yours:

```tsx
// src/DebugDrawer.tsx — your own toggle, your own layout
import { useState } from 'react'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'

export function DebugDrawer() {
  const [open, setOpen] = useState(false)

  return (
    <aside className="debug-drawer">
      <button type="button" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide query cache' : 'Show query cache'}
      </button>
      {open && (
        <ReactQueryDevtoolsPanel
          onClose={() => setOpen(false)}
          style={{ height: '70vh' }}
        />
      )}
    </aside>
  )
}
```

`onClose` and `style` are the two options that exist **only** on the embedded panel. The documented default for `style` is `{ height: '500px' }` — a fixed pixel height, which is why an embedded panel dropped into a flex column often looks wrong until you override it.

## The option surface, as the docs list it

| Option | Type | Documented default |
|---|---|---|
| `initialIsOpen` | `boolean` | *not stated on the page* |
| `buttonPosition` | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right" \| "relative"` | `"bottom-right"` |
| `position` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` |
| `client` | `QueryClient` | the client from context |
| `errorTypes` | `{ name: string; initializer: (query: Query) => TError }[]` | — |
| `styleNonce` | `string` | — |
| `shadowDOMTarget` | `ShadowRoot` | — |
| `theme` | `"light" \| "dark" \| "system"` | `"system"` |
| `style` *(embedded only)* | `React.CSSProperties` | `{ height: '500px' }` |
| `onClose` *(embedded only)* | `() => void` | — |

Three of these carry doc sentences worth quoting exactly, because each one exists for a specific environment you will eventually hit:

> *"Use this to predefine some errors that can be triggered on your queries."* — `errorTypes`

> *"Use this to pass a nonce to the style tag that is added to the document head. This is useful if you are using a Content Security Policy (CSP) nonce to allow inline styles."* — `styleNonce`

> *"Use this to pass a shadow DOM target to the devtools so that the styles will be applied within the shadow DOM instead of within the head tag in the light DOM."* — `shadowDOMTarget`

`buttonPosition: "relative"` is the value people miss: it takes the floating button out of the viewport-fixed corner and places it wherever you rendered the component, which is how you put the toggle in your own header without switching to embedded mode.

⚠️ **`initialIsOpen` has no printed default in the option list.** Do not assert one; pass it explicitly. `initialIsOpen` (or `initialIsOpen={true}`) is what you want on a branch you are actively debugging, and passing `false` explicitly documents the intent for the next reader.

## What this page deliberately does not tell you

The devtools documentation describes **how to mount the panel and what options it takes**. It does *not* enumerate the panel's columns, its colour coding, its button labels, or any keyboard shortcut. Everything the rest of this topic says about *reading* the panel is therefore anchored in the cache concepts the panel renders — `status`, `fetchStatus`, stale vs fresh, active vs inactive, `gcTime` — every one of which **is** documented, and each of which is quoted where it is used.

That is not a limitation, it is the right way round. The UI wording can change in a minor release; `fetchStatus === 'paused'` cannot.

## Gotchas

**★ The panel opens and shows no queries at all, while the app is clearly loading data.** Cause: the devtools are not inside the `QueryClientProvider` subtree, or two copies of `@tanstack/react-query` are installed so the devtools read a different context object from the one your hooks write to. Fix: move the component inside the provider, and prove the diagnosis by bypassing context entirely — `<ReactQueryDevtools client={queryClient} />` with the client imported from the same module your app uses. If that fills the panel, run `npm ls @tanstack/react-query` and dedupe.

**★ You mounted `<ReactQueryDevtoolsPanel />` and nothing appears to open it.** Cause: that is embedded mode; it renders the panel, not a toggle. There is no built-in button. Fix: use `<ReactQueryDevtools />` for the floating toggle, or keep the panel and drive it from your own state, wiring `onClose` back to that state so the panel's own close affordance does not leave your boolean stuck at `true`.

**★ The embedded panel is 500 px tall and refuses to fill its container.** Cause: the documented default for the embedded `style` option is `{ height: '500px' }` — an absolute height, not a flex-friendly one. Fix: pass your own, e.g. `style={{ height: '70vh' }}`, or `{ height: '100%' }` inside a container that has a resolved height.

**★ In a Storybook / design-system app with shadow DOM, the panel renders unstyled.** Cause: the devtools inject a style tag into `document.head` by default, which shadow roots do not inherit. Fix: pass the root via `shadowDOMTarget` — the docs say the styles are then *"applied within the shadow DOM instead of within the head tag in the light DOM."*

**★ Your CSP kills the panel's styling and the console fills with style-src violations.** Cause: the injected style tag has no nonce. Fix: pass the same nonce your server emits via `styleNonce`, per the quoted sentence above. If your nonce is generated per request, thread it through the same mechanism you already use for React's inline scripts — a hard-coded nonce defeats the CSP.

**★ A teammate reports "the devtools broke my layout" after you added it.** Cause: floating mode's button is fixed to a viewport corner (`buttonPosition` defaults to `"bottom-right"`), which is exactly where a lot of apps put a chat widget or a snackbar. Fix: move it (`buttonPosition="top-left"`), or set `buttonPosition="relative"` and render the component where you want the button to live.

**★ You added devtools to a v4 codebase and expected to see mutations; the row you want is missing.** Cause: mutation observation arrived in v5 — *"since version 5, the dev tools support observing mutations as well."* Fix: this is not configurable; it is a version boundary. Confirm the installed major before concluding a mutation is not running.

**★ CI fails to resolve `@tanstack/react-query-devtools` even though it works locally.** Cause: it was installed into `devDependencies` and the build runs `npm ci --omit=dev`, while a production lazy-load path (see `01f`) still imports it at runtime. Fix: if you lazy-load in production, it belongs in `dependencies`; if you truly only ship it in development, remove the production import path as well. Half of each is the failure.

## Interview questions

**★ Why do the devtools ship as a separate npm package instead of as an export of `@tanstack/react-query`?**
Because the exclusion story depends on it. The documented behaviour is that the devtools are *"only included in bundles when `process.env.NODE_ENV === 'development'`"*, and a bundler can only make that call cleanly if the devtools code sits behind its own module specifier that the production branch never reaches. If the panel were an export of the core package, every consumer would pull the panel's module graph into the same chunk as `useQuery` and rely entirely on tree-shaking to remove it — which fails the moment anything in that graph has a side effect the bundler cannot prove away. Separate package, separate decision, and it also lets the panel version and release independently of the core.

**★ A colleague says the devtools "show a snapshot of the cache". Why is that wrong, and why does the distinction matter?**
The panel subscribes to the live `QueryCache` and re-renders on change; there is no copy. It matters because it changes what a reading *proves*. If the panel were a snapshot, a row showing `pending` might just be stale UI, and you would go looking for a refresh button. Because it is live, a row that stays `pending` really is a query that has not resolved — so the question becomes *why*, and the answer is in `status`/`fetchStatus` (see [01b](./01b-status-and-fetchstatus-matrix.md)). It also means the panel's actions are real cache writes and observably affect the running app, which is the whole reason invalidating from the panel is a legitimate diagnostic step.

**★ When would you reach for embedded mode over floating mode?**
When you want the panel to participate in your layout rather than float over it, or when you want to own the toggle. Concrete cases: a debug drawer that already exists in your admin shell and should hold the query cache alongside feature flags and the current user; a side-by-side view where you are watching the panel and the UI change together during a mutation; and any environment where a fixed corner button collides with existing chrome. The cost is that you own mount/unmount and sizing — the documented default height is `{ height: '500px' }`, and `onClose` must be wired back to your own state or the panel's close will desynchronise from it.

**★ You add `<ReactQueryDevtools />` and the panel is empty. Walk through the diagnosis in order.**
First, confirm the component is rendered *inside* `QueryClientProvider` — the devtools resolve the client from context, so a sibling placement finds nothing. Second, bypass context: pass `client={queryClient}` with the client imported from the module the app uses. If the panel now fills, context was the problem and the usual cause is two installed copies of `@tanstack/react-query`, which `npm ls @tanstack/react-query` will show; a monorepo with hoisting disabled, or a package that lists the library as a dependency rather than a peer dependency, is the usual culprit. Third, if it is empty even with an explicit client, the cache genuinely is empty — check that any query has actually mounted, because a query that has never been observed and never prefetched has no cache entry to display.

**★ What does the devtools documentation actually specify, and what would you refuse to assert from it?**
It specifies the package name, the two components, the placement inside the provider, the full option list with several defaults, the production-exclusion rule, the production lazy-load recipe, and the existence of browser extensions. It does **not** specify the panel's columns, colours, button labels or shortcuts. So I would happily assert "a query with no data that cannot fetch will read `pending` and `paused`", because `status` and `fetchStatus` are documented on the Queries and Network Mode guides — and I would refuse to assert "the panel colours paused queries purple", because nothing in the documentation says so and a UI string is exactly the kind of claim that quietly goes stale.

---

← [Fetch-on-render and streaming](../10-suspense-integration/01d-fetch-on-render-and-streaming.md) · [Topic index](../README.md) · Next → [status and fetchStatus](./01b-status-and-fetchstatus-matrix.md)
