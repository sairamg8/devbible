---
title: "Part 3 — Concurrent React and the server"
sidebar_label: "3 · Concurrent and server"
sidebar_position: 3
---

> Phases 8–11 · 68 topics · Suspense and transitions, Actions, Server Components,
> server rendering and hydration

This is modern React, and it is one continuous idea rather than four. Concurrent
rendering makes a render interruptible and discardable. Suspense turns "this
subtree is not ready" into a first-class state. Actions build on transitions.
Server Components exist because Suspense can stream. Take them out of order and
each one looks arbitrary.

**Tiering note:** Master is deliberately lighter here than in Parts 1–2 despite
this being the most consequential material. The model is worth mastering; the
plumbing still moves, and memorising an API that shifts every minor release is
the wrong investment.

---

## Phase 8 — Concurrent rendering, Suspense and transitions

*18 topics.* React can start rendering, stop, do something more urgent, and
throw the unfinished work away. Everything in this phase is a consequence.

| Topic | Tier |
|---|---|
| **`startTransition` and `useTransition`** — marking an update as non-urgent so typing stays responsive while an expensive screen renders; `isPending` and what it is really telling you | <span className="db-tier t-master">Master</span> |
| **`<Suspense>`** — the boundary and its `fallback`; what "suspending" means (a component threw a promise React knows about) and what the boundary does with the rest of the tree | <span className="db-tier t-master">Master</span> |
| **What can actually suspend** — `lazy()`, `use(promise)`, Server Component data, framework loaders. And what cannot: a plain `fetch` inside `useEffect`, no matter how many boundaries you wrap it in | <span className="db-tier t-master">Master</span> |
| **`use(promise)`** — reading a promise during render. The hard requirement that the promise is stable across renders (cached, from a framework, or from a Server Component) and never created inline | <span className="db-tier t-master">Master</span> |
| **Request waterfalls** — the default failure mode of nested Suspense: three boundaries, three sequential round trips. Hoisting the fetch, starting promises in parallel, and preloading on the route | <span className="db-tier t-master">Master</span> |
| **What concurrent rendering means** — interruptible render, update priority, a render that is thrown away and re-done. Why "purity" stopped being style advice and became a correctness requirement | <span className="db-tier t-understand">Understand</span> |
| **Urgent vs transition updates** — which interactions belong in which bucket; typing and clicking are urgent, filtering a 5,000-row table and navigating are not | <span className="db-tier t-understand">Understand</span> |
| **`useDeferredValue`** — letting an expensive subtree lag behind a fast input, the previous-value behaviour on first render, and choosing it over `useTransition` (value you receive vs update you control) | <span className="db-tier t-understand">Understand</span> |
| **Async transitions (React 19)** — passing an `async` function to `startTransition`; the pending state spanning the `await`; the rules about calling `setState` after it | <span className="db-tier t-understand">Understand</span> |
| **Suspense boundary placement** — granularity, avoiding a whole-page spinner, avoiding layout shift, and nesting boundaries so the shell arrives first | <span className="db-tier t-understand">Understand</span> |
| **Suspense inside a transition** — the fallback is deliberately *not* shown when the update is a transition; the existing UI stays and `isPending` is your only signal. The single most surprising behaviour in this phase | <span className="db-tier t-understand">Understand</span> |
| **`use(context)`** — reading context conditionally, after an early return, or inside a loop; the one legal exception to the Rules of Hooks | <span className="db-tier t-understand">Understand</span> |
| **`cache` and `cacheSignal`** — deduplicating an async function across one server render, and (19.2) aborting the work when React discards that render | <span className="db-tier t-understand">Understand</span> |
| **`<Activity>` (19.2)** — hiding a subtree while **keeping its state**, unmounting its effects, and pre-rendering the next screen at low priority. What it replaces (`display:none` plus manual state hoisting) | <span className="db-tier t-understand">Understand</span> |
| **Tearing** — two parts of one render reading different values from an external mutable store because the render was interrupted between them; why `useSyncExternalStore` is the only correct fix | <span className="db-tier t-understand">Understand</span> |
| **Error boundaries and Suspense together** — the loading/error pair around a single subtree, the order they must nest in, and what happens when the promise rejects | <span className="db-tier t-understand">Understand</span> |
| ⚠ **`<ViewTransition>`, `addTransitionType` and gesture transitions** — **experimental only; not in 19.2.8**. What they will give you, why `document.startViewTransition` plus `flushSync` is today's answer, and the risk of shipping the experimental build | <span className="db-tier t-know">Know</span> |
| ⚠ `SuspenseList` — still `unstable_` in the experimental channel; ordering how sibling boundaries reveal | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can explain why a filter typed into a search box
stays responsive with `useDeferredValue` but not with `useState` alone, and why
wrapping a navigation in `startTransition` makes the spinner disappear rather
than appear.

---

## Phase 9 — Forms, Actions and optimistic UI

*14 topics.* React 19 turned "submit a form" from a pile of `useState` into a
first-class primitive. Actions are transitions wearing a form.

| Topic | Tier |
|---|---|
| **Controlled inputs, all of them** — text, number, checkbox, radio groups, `<select>` single and multiple, `<textarea>`, and file inputs, which are **always** uncontrolled and why | <span className="db-tier t-master">Master</span> |
| **Actions** — a function passed to `<form action={…}>`. React calls it with `FormData`, wraps it in a transition, tracks pending state, and resets the form on success | <span className="db-tier t-master">Master</span> |
| **`useActionState`** — `[state, formAction, isPending]` from `(previousState, formData) => nextState`. The hook that replaces the four `useState` calls every form used to need | <span className="db-tier t-master">Master</span> |
| **Validation** — client-side for feedback, server-side for truth; returning field-level errors through the action's return value; and the accessibility of showing them | <span className="db-tier t-master">Master</span> |
| **Uncontrolled forms and `FormData`** — reading the whole form on submit instead of a `useState` per field; `name` attributes as the contract; when this beats controlled inputs outright | <span className="db-tier t-understand">Understand</span> |
| **`useFormStatus`** — a submit button reading its parent form's pending state without prop drilling; the constraint that it must be *inside* the `<form>`, in a child component | <span className="db-tier t-understand">Understand</span> |
| **`useOptimistic`** — rendering the expected result before the server confirms it, and the automatic revert when the action finishes or fails | <span className="db-tier t-understand">Understand</span> |
| **Multiple actions in one form** — `<button formAction={…}>` for save-vs-delete, and how it interacts with `useActionState` | <span className="db-tier t-understand">Understand</span> |
| **Form reset semantics** — what React resets automatically after an action, when that is wrong, and `requestFormReset` from `react-dom` | <span className="db-tier t-understand">Understand</span> |
| **Errors in actions** — thrown errors reach the nearest error boundary; returned errors reach `useActionState`. Choosing deliberately, because the two produce completely different UX | <span className="db-tier t-understand">Understand</span> |
| **Progressive enhancement** — a form that submits before JavaScript has hydrated; what it requires (a server action or a real endpoint), and what it buys on a slow connection | <span className="db-tier t-understand">Understand</span> |
| **Accessible forms** — `<label>` and `useId`, grouping with `<fieldset>`, `aria-invalid` and `aria-describedby` for errors, announcing submission results, and moving focus to the first error | <span className="db-tier t-understand">Understand</span> |
| ⚠ **`useFormState`** — the old name, still exported from `react-dom` in 19.2.8 and **deprecated**. Renamed to `useActionState` and moved to `react`; the codemod and how to spot it in old tutorials | <span className="db-tier t-know">Know</span> |
| Form libraries — React Hook Form and TanStack Form; what they still add over Actions (schema validation, field arrays, dirty tracking) and when the built-ins are genuinely enough | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a comment form that disables its button while pending,
shows the new comment optimistically, restores the typed text and shows a
field-level error when the server rejects it, and still submits with JavaScript
disabled.

---

## Phase 10 — Server Components and Server Functions

*19 topics.* The largest change to React since hooks, and the one most often
described wrongly. Two directives, two module graphs, one serialization
boundary — get those three right and the rest follows.

| Topic | Tier |
|---|---|
| **What a Server Component is** — a component that runs only on the server and whose code never reaches the browser. No state, no effects, no event handlers, no browser APIs — and it can be `async` | <span className="db-tier t-master">Master</span> |
| **The two module graphs** — server and client are separate builds with a boundary between them. Every confusing RSC error is really a question about which graph a file is in | <span className="db-tier t-master">Master</span> |
| **`'use client'`** — marks an **entry point into the client graph**, not "this file is a component". Everything it imports goes to the browser too, which is why one careless directive doubles a bundle | <span className="db-tier t-master">Master</span> |
| **`'use server'`** — marks a **Server Function**, and has nothing to do with Server Components. The most confused pair of directives in React; the mistake of putting it at the top of a component file | <span className="db-tier t-master">Master</span> |
| **What crosses the boundary** — only serializable values: primitives, plain objects, arrays, `Date`, `Map`, `Set`, promises, JSX elements, and Server Function references. Not functions, not class instances, not `Symbol`. The exact error each violation produces | <span className="db-tier t-master">Master</span> |
| **Server Function security** — every Server Function is a public HTTP endpoint that anyone can call with any arguments. Authorization and validation inside the function, never in the caller; and the encrypted-closure caveat for bound arguments | <span className="db-tier t-master">Master</span> |
| **Passing Server Components as `children`** — the composition pattern that lets a Client Component wrap server-rendered content without pulling it into the client graph. The single most useful RSC technique | <span className="db-tier t-understand">Understand</span> |
| **Async components** — `await` your database or API directly in the component, with a Suspense boundary above it; why this removes the loading-state boilerplate rather than hiding it | <span className="db-tier t-understand">Understand</span> |
| **Calling Server Functions from the client** — as a form `action`, inside `startTransition`, or from an event handler. They are RPC over the network, so every call has latency and can fail | <span className="db-tier t-understand">Understand</span> |
| **Composition rules** — a Server Component can render a Client Component; a Client Component cannot import a Server Component, only receive one as a prop. Server Functions are the one exception that crosses inward | <span className="db-tier t-understand">Understand</span> |
| **Where interactivity goes** — pushing `'use client'` down to the leaves that genuinely need state, and measuring the bundle difference when you do | <span className="db-tier t-understand">Understand</span> |
| **The December 2025 advisories** — the **critical** RSC vulnerability (3 Dec 2025) and the **denial-of-service / source-code exposure** issue (11 Dec 2025); which versions are patched and why an RSC app must not float its React version | <span className="db-tier t-understand">Understand</span> |
| **The RSC payload** — the Flight wire format: a stream of rows describing the tree, not HTML and not JSON. Reading one in the network tab, and why it can be streamed and resumed | <span className="db-tier t-understand">Understand</span> |
| **`react-server-dom-webpack` / `-turbopack` / `-parcel`** — the renderer packages, the `react-server` export condition, and what a bundler has to implement to support RSC at all | <span className="db-tier t-understand">Understand</span> |
| **Data fetching in RSC** — no client waterfall, `cache()` to deduplicate a query across one request, `cacheSignal()` to abort it when the render is discarded, and parallelizing sibling awaits | <span className="db-tier t-understand">Understand</span> |
| **Next.js App Router vs React Router 7/8** — the two mainstream RSC implementations, what each adds on top of React, and which parts of your knowledge transfer between them | <span className="db-tier t-understand">Understand</span> |
| **When RSC is the wrong choice** — a dashboard that is 95 % interactive, an app shipped to a static host, an existing SPA with a working API. Saying no is a valid outcome | <span className="db-tier t-understand">Understand</span> |
| Server Components without a framework — what you would have to build yourself (bundler integration, the Flight endpoint, routing, the client entry) and why every practical setup uses a framework | <span className="db-tier t-know">Know</span> |
| Taint APIs — `experimental_taintObjectReference` and `experimental_taintUniqueValue` to make passing a secret to the client a runtime error instead of a leak | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can look at any file in an RSC app and say which
graph it is in, what would happen if you added `'use client'` to it, and why a
`onClick` prop passed from a Server Component throws — and you can write a
Server Function that is safe against a caller who ignores your UI entirely.

---

## Phase 11 — Server rendering, hydration and the DOM APIs

*17 topics.* Everything `react-dom` does outside the browser, plus the DOM-level
features React 19 absorbed. This is where SSR stops being a checkbox and starts
being a set of trade-offs you choose between.

| Topic | Tier |
|---|---|
| **CSR vs SSR vs SSG vs streaming SSR vs RSC** — five distinct things that are constantly conflated, what each costs, what each buys, and which combinations are real | <span className="db-tier t-master">Master</span> |
| **Hydration mismatches** — the error text, and the causes in order of frequency: `Date`/`Math.random`, `window` or `localStorage` read during render, locale and timezone formatting, invalid HTML nesting, and browser extensions. The fix for each | <span className="db-tier t-master">Master</span> |
| **`renderToString` vs `renderToPipeableStream` vs `renderToReadableStream`** — the Node-streams and Web-streams split, and the fact that `renderToString` cannot stream Suspense so its fallbacks never resolve | <span className="db-tier t-understand">Understand</span> |
| **`hydrateRoot`** — attaching React to server HTML: what it reuses, what it re-creates, and why hydration costs roughly a full render's worth of JavaScript | <span className="db-tier t-understand">Understand</span> |
| **`suppressHydrationWarning`** and the deliberate two-pass render — the two escapes for genuinely client-only content, and when each is honest rather than a cover-up | <span className="db-tier t-understand">Understand</span> |
| **Streaming SSR with Suspense** — the shell flushes first, boundaries arrive as their data resolves, and inline scripts patch them into place; `onShellReady` vs `onAllReady` and which one a crawler needs | <span className="db-tier t-understand">Understand</span> |
| **Selective hydration** — React prioritising the boundary the user just clicked, and why streaming plus Suspense improves interactivity and not only paint | <span className="db-tier t-understand">Understand</span> |
| **Prerendering — `prerender` and `prerenderToNodeStream`** (`react-dom/static`) — static generation that waits for all data, and how it differs from `renderToString` | <span className="db-tier t-understand">Understand</span> |
| **Partial Pre-rendering (19.2)** — `resume`, `resumeToPipeableStream`, `resumeAndPrerender`: prerender a static shell at build time, resume it per request to fill the dynamic holes. The postponed-state model | <span className="db-tier t-understand">Understand</span> |
| **Document metadata (19)** — `<title>`, `<meta>` and `<link>` rendered anywhere in the tree and hoisted into `<head>`, on both server and client; what this replaces and its limits | <span className="db-tier t-understand">Understand</span> |
| **Resource preloading** — `preload`, `preinit`, `preloadModule`, `preinitModule`, `preconnect`, `prefetchDNS` from `react-dom`; what each emits and when it actually helps | <span className="db-tier t-understand">Understand</span> |
| **`flushSync`** — forcing a synchronous commit; the legitimate cases (measure immediately after a state change, `document.startViewTransition`, some third-party integrations) and the cost of every other use | <span className="db-tier t-understand">Understand</span> |
| **Root error options (19)** — `onCaughtError`, `onUncaughtError`, `onRecoverableError` on `createRoot`/`hydrateRoot`, `onError` on the server renderers, and wiring them into error reporting | <span className="db-tier t-understand">Understand</span> |
| `renderToStaticMarkup` — no hydration markers, for HTML email and genuinely static pages; the trap of hydrating its output | <span className="db-tier t-know">Know</span> |
| Stylesheet support and `precedence` (19) — `<link rel="stylesheet" precedence>`, Suspense-aware style loading, deduplication, and how it interacts with a CSS-in-JS library | <span className="db-tier t-know">Know</span> |
| `<script async>` support (19) — rendered anywhere, hoisted and deduplicated; loading a third-party script from the component that needs it | <span className="db-tier t-know">Know</span> |
| Portals and SSR — portals do not render on the server; the mount-guard pattern and why a modal is the usual victim | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** an Express-served page that streams a shell immediately,
fills two independent Suspense boundaries as their data arrives, hydrates without
a single mismatch warning, and reports a thrown render error through
`onUncaughtError`.

---

## Where this connects

- **Phase 8 → Phase 6** — `useDeferredValue` and `<Activity>` are performance
  tools; they are here because they only make sense with concurrency explained.
- **Phase 9 → Phase 10** — Actions and Server Functions are designed as one
  feature. A `'use server'` function passed to `<form action>` is the whole point.
- **Phase 10 → Express** — a Server Function is an endpoint. Authorization,
  validation, status codes and error contracts are **Express** material; React
  owns only the calling convention.
- **Phase 10 → PostgreSQL** — `await db.query(…)` inside a Server Component is
  the join between these two syllabi. Query design stays on the PG side.
- **Phase 11 → Nginx** — caching headers, compression and the SPA fallback for
  server-rendered React are **Nginx** topics; Phase 14 names the handoff.
- **Deliberately not here:** framework-specific routing, caching directives and
  build configuration. Next.js and React Router are covered as *choices* in
  **Phase 10 · 16**, not taught as their own syllabi. (Phase 13 would have gone
  further; it was **dropped on 2026-08-14**.)

---

← Prev: [Part 2 — Hooks, completely](02-hooks.md) · Next → [Part 4 — Building a real app](04-building-an-app.md)
