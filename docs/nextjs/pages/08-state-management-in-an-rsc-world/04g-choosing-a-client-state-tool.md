---
title: "Choose by asking who owns the value and how often it changes, not by comparing libraries — because for most state in an RSC app the correct answer is none of them, and the ones that survive that filter are decided in about two questions"
sidebar_label: "04g · Choosing, and when it is none of them"
sidebar_position: 136
description: "A decision procedure for client state in the App Router: the four questions that eliminate most candidates before any library is named, an honest Context vs hand-rolled store vs Zustand vs Jotai comparison, and the escalation ladder from useState upward."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the React reference — [`useContext`](https://react.dev/reference/react/useContext),
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) — and
> [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`).
> Library versions confirmed from the npm registry: **`zustand` 5.0.15**, **`jotai` 2.20.3**, **`nuqs` 2.10.1**.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**The library comparison is the last question, not the first, and by the time you reach it most of the state you were worried about has gone somewhere else. In an RSC app the default owner of a value is the server; the second-choice owner is the URL; the third is a single component's `useState`. A client store earns its place only for state that is genuinely shared between components, genuinely client-owned, and genuinely too fine-grained for Context. That is a much smaller set than the average codebase's `store/` directory suggests, and this page is the procedure for finding it.**

## The four questions, in order

Ask them in this order and stop at the first that answers.

### 1 · Can the server own it?

If the value is derived from data the server already has, it is not client state. Render it in a Server Component and pass it down.

```tsx filename="app/[tenant]/board/page.tsx"
// The column layout, the card list, the permissions summary — all server-owned.
const board = await getBoard(tenant)
return <Columns columns={board.columns} canEdit={board.canEdit} />
```

This covers far more than people expect, and [02](02-when-rsc-data-flow-is-enough.md) is the full argument. If the value changes because of a *mutation*, the answer is a Server Action plus an invalidation — [10](10-refresh.md) and [10b](10b-refresh-against-the-alternatives.md) — not a store that mirrors the server.

### 2 · Should it be shareable, bookmarkable or back-buttonable?

Then it is URL state, and it stops being a client-store problem entirely. Filters, sort, pagination, the open tab, a selected date range, a detail pane that is really a place. Topic [03](03-url-as-state-searchparams-nuqs-style-patterns-shareable-filt.md) is the whole treatment.

The test that decides it: **would you be happy for a colleague to receive this by link?** If yes, it belongs in the address bar; a store is strictly worse because it cannot be shared, cannot be prefetched, and does not survive a refresh.

### 3 · Is it read by exactly one component, or one component and its direct children?

Then it is `useState` or `useReducer`, and a store is over-engineering with a coordination cost.

```tsx
const [isOpen, setIsOpen] = useState(false)   // a disclosure, a menu, a hover card
```

Prop-drilling two levels is cheaper than a store; prop-drilling five is the signal for question 4.

### 4 · Is it a pending mutation, or optimistic UI?

Then React already has it. `useOptimistic` and `useActionState` cover the "show it before the server confirms" case without any store, and they integrate with Server Actions and error handling in a way a store does not — see **`useOptimistic` and `useActionState` as framework-native alternatives** *(not written yet)*.

Building an optimistic layer in a client store means rebuilding rollback-on-error, pending state and concurrent-update reconciliation, all of which the React APIs already have.

**Only state that survives all four questions is a client-store problem.** In practice: drag layers, canvas viewports, multi-step wizard state, selection sets that must not be shareable, an audio player, a notification tray.

## Then, and only then: which tool?

| | Context | Hand-rolled store ([04c](04c-usesyncexternalstore-the-escape-hatch.md)) | Zustand **5.0.15** | Jotai **2.20.3** |
|---|---|---|---|---|
| Subscription granularity | whole value | per selector | per selector | per atom |
| Selector API | ❌ none | write it | ✅ built in | ✅ implicit |
| Object-selector trap | n/a | manual | `useShallow` | n/a — atoms are already granular |
| Derived state | `useMemo` per consumer | manual | selector or computed store | ✅ derived atoms |
| Per-request safety on a server | ✅ by construction | ✅ via provider | ⚠️ **only** via a factory + provider | ⚠️ **only** via `Provider` |
| Default is safe on a server | ✅ | ✅ | ❌ `create()` is module state | ❌ provider-less is a global store |
| Server-seeded initial state | props | props | `initState` prop | `useHydrateAtoms` |
| Devtools / persistence / immer | ❌ | ❌ | ✅ middleware | ✅ utils |
| Bundle cost | 0 | ~0 | small | small |
| Code a new hire has seen before | ✅ | ❌ | ✅ | ⚠️ less common |

**The two rows in bold type are the ones that matter in an RSC app**, and they are the same row twice: both libraries' *documented defaults* are unsafe on a server, and both fix it with a provider. Zustand's `create()` is module state — *"the store should be created per request and should not be shared across requests"*. Jotai's provider-less mode uses one implicit global store — *"kept alive and is shared between multiple requests, which can lead to bugs and security risks"*. Neither is a flaw in the library; both are browser-shaped defaults meeting a server.

### Choosing between the two

They are close enough that team familiarity is a legitimate tiebreaker. Where they genuinely differ:

- **Zustand suits state that is naturally one object with actions on it** — a board's drag layer, a wizard, a player. One store, one file, actions colocated with the data, and the mental model transfers from Redux without the ceremony.
- **Jotai suits state that decomposes into many independent, interrelated values** — a form builder, a canvas with per-node state, anything where derived values outnumber base values. Derived atoms are the feature: a computed value recomputes when its dependencies change and nothing else subscribes to the recomputation.
- **Zustand's failure mode is a bad selector** — an object literal that re-renders everything. It is easy to spot in review and `useShallow` fixes it.
- **Jotai's failure mode is atom identity** — an atom created in the wrong scope, or hydrated once when you expected it to track a prop. Harder to spot, because the code looks right.

### Choosing Context or a hand-rolled store instead

Context wins outright when the value changes rarely and is read widely — theme, locale, a display identity — and when it holds a *stable handle* rather than data. A hand-rolled `useSyncExternalStore` wins when the store is small, private to one feature and unlikely to grow: it has no dependency, no upgrade path and no vocabulary to learn, and writing it once is the cheapest way to understand what the libraries do.

## When the answer is "none of them", concretely

| Symptom in a codebase | What it should have been |
|---|---|
| A store holding a copy of rows fetched from the API | Server Component props, cached with `use cache` ([03c](03c-caching-query-driven-routes.md)) |
| A store holding the current filter, sort and page | URL state ([03](03-url-as-state-searchparams-nuqs-style-patterns-shareable-filt.md)) |
| A store holding `isSubmitting` and `error` for a form | `useActionState` — **framework-native mutation state** *(not written yet)* |
| A store applying an optimistic update then reconciling | `useOptimistic` — **framework-native mutation state** *(not written yet)* |
| A store holding one modal's open flag | `useState` in the component that owns the modal |
| A store holding the logged-in user | A Server Component read of the session, passed as props |
| A store holding polling / websocket data | A client cache — [05](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md) |
| A store holding "the current theme" only for CSS | A cookie read on the server, or a `data-` attribute set before hydration |

That last row is worth dwelling on: a theme in a client store is a theme that flashes, because the store does not exist until hydration. A theme in a cookie is rendered correctly by the server on the first byte.

## The escalation ladder

Start at the top. Move down one rung only when the current one has a named, observed problem.

1. **`useState` in the owning component.** Prop-drill up to two levels.
2. **Lift the state** to the nearest common ancestor. Still no library.
3. **Context with one value.** The consumers are few and the value changes rarely.
4. **Context split into state and dispatch.** Ten lines; removes the largest single class of re-render.
5. **Context split by change frequency.** Up to three or four contexts.
6. **A store handle in Context + `useSyncExternalStore`.** Sixty lines; per-selector subscriptions.
7. **An installed store** — Zustand or Jotai — behind a provider, with a factory or a `Provider`.

🔴 **Rungs 6 and 7 are where per-request safety becomes your problem**, so the moment you take one, the provider is part of the change and not a follow-up ticket. Everything above rung 6 is per-request safe by construction, because React tree state has always been per-render.

The ladder is also a useful review tool: a pull request that introduces rung 7 should be able to say which problem at rung 5 it observed.

## Gotchas

**★ Symptom: the `store/` directory has fourteen files and half of them mirror API responses.** Cause: state was classified by "is it shared" rather than "who owns it", so server data ended up in client stores. Fix: apply question 1 — anything derived from server data becomes a Server Component prop, and mutations become Server Actions plus invalidation.

```tsx
// ❌ useEffect(() => { fetch('/api/board').then(r => r.json()).then(setBoard) }, [])
const board = await getBoard(tenant)          // ✅ server render, cacheable, prefetchable
return <Columns columns={board.columns} />
```

**★ Symptom: users complain they cannot share a filtered view, and the fix is estimated at two weeks.** Cause: filter state lives in a client store, so there is nothing to put in a link and no way to restore one. Fix: move it to the URL, where sharing, refresh and back/forward all come free.

```tsx
<Link href="?status=blocked" scroll={false}>Blocked</Link>
```

**★ Symptom: a store was added to hold `isSubmitting`, and now every form has its own slice.** Cause: pending state was treated as application state. Fix: `useActionState` owns the pending flag, the returned state and the error for a Server Action, with no store at all.

**★ Symptom: a "global" theme store causes a flash of the wrong theme on every cold load.** Cause: the store does not exist until hydration, so the server rendered the default. Fix: read the preference where the server can see it — a cookie — and render the correct value in the first byte.

```tsx
const theme = (await cookies()).get('theme')?.value ?? 'light'
return <html data-theme={theme}>{children}</html>
```

**★ Symptom: the team adopted Zustand, and a code review keeps finding `create()` at module scope.** Cause: every tutorial and the library's own quick start shows the browser-shaped default. Fix: make the factory the only exported constructor, so a singleton is not reachable.

```ts
// board-store.ts exports a factory, never a bound hook
export const createBoardStore = (init: BoardState) => createStore<BoardStore>()(/* … */)
```

**★ Symptom: two libraries in one app — Zustand for some features, Jotai for others.** Cause: two teams chose independently and neither migration finished. Fix: this is a real cost (two mental models, two provider strategies, two sets of devtools) and it is worth paying down deliberately; pick the one that fits the majority of the remaining state and port the minority, rather than adding a third.

**★ Symptom: a component reads from a store *and* from `searchParams`, and they disagree after a back navigation.** Cause: the URL value was copied into the store on mount, so a history navigation changed the URL without remounting. Fix: one source of truth — read the URL directly and delete the mirrored store field.

```tsx
const status = useSearchParams().get('status') ?? 'open'   // ✅ no copy in the store
```

**★ Symptom: nobody can say why the app uses a store, and removing it is considered too risky.** Cause: the store predates the App Router migration and now holds a mixture of server data, URL state and genuine client state. Fix: split it by the four questions before trying to remove it — each category has a different destination, and attempting them together is what makes it feel risky.

## Interview questions

**★ How do you decide whether a value belongs in a client store?**
By asking who owns it, in order. Can the server own it — is it derived from data the server already has? Then it is a Server Component prop and a Server Action, not state. Should it be shareable, bookmarkable or back-buttonable? Then it is URL state. Is it read by one component and its direct children? Then it is `useState`. Is it a pending mutation or an optimistic update? Then `useActionState` and `useOptimistic` already have it. Only what survives all four is a store problem — typically drag layers, canvas viewports, wizard state, non-shareable selection. Naming the library first is what produces a `store/` directory that mirrors the API.

**★ Zustand or Jotai?**
Close enough that team familiarity is a legitimate tiebreaker, but the shapes differ. Zustand fits state that is naturally one object with actions on it — a board's drag layer, a media player — and its mental model transfers from Redux without the ceremony; its characteristic bug is an object selector that re-renders everything, which `useShallow` fixes and a reviewer can spot. Jotai fits state that decomposes into many interrelated values, especially where derived values outnumber base ones, because derived atoms are first-class and granularity is the default rather than a discipline; its characteristic bug is atom identity — an atom created in the wrong scope, or hydrated once when you expected it to track a prop — which is harder to see because the code looks correct.

**★ What is the single most important thing to get right with either library in Next.js?**
Per-request isolation, because both libraries' documented defaults are unsafe on a server and both are safe with a provider. Zustand's `create()` produces module state, and module scope on a Node process is shared by every request it handles; Jotai's provider-less mode uses one implicit global store, which its own documentation says can lead to bugs and security risks. The failure is intermittent, cross-user and effectively impossible to reproduce, which makes it both a correctness issue and a security one. The provider also gives you the reset semantics client-side routing needs, so it is not a tax — it is the thing that makes the store behave correctly on navigation as well.

**★ Why is Context still worth reaching for when better tools exist?**
Because it is the right tool for two jobs neither library does better. First, low-frequency values read widely — theme, locale, a display identity — where the fan-out never fires often enough to matter and the zero-dependency, zero-vocabulary cost wins. Second, and more importantly, injecting a *stable handle*: the context value is a store instance that never changes, so consumers of the context are never re-rendered by it, and subscription happens through the store. That second use is not a workaround; it is how Zustand and Jotai both work internally, which is a fair sign it is the correct division of labour.

**★ Walk through the escalation ladder and say what triggers each step.**
`useState` in the owning component, prop-drilled up to two levels. Lift to a common ancestor when a sibling needs it. Context when drilling passes three or four levels and the value changes rarely. Split state from dispatch when a write-only component re-renders on every state change — ten lines, and the single biggest win. Split by change frequency when components reading a slow-changing slice re-render because a fast-changing one moved. Move to a store handle plus `useSyncExternalStore` when you are on your fourth context and adding a field means touching four files. Install a library when you want shallow selector comparison, devtools, persistence or immer, or when a new hire should recognise the pattern. Each step should be justified by an observed problem at the previous one, and rungs six and seven are where per-request safety becomes your responsibility.

**★ A codebase has one store holding server data, filter state and drag state. How do you unpick it?**
By category, not all at once, because each part has a different destination and mixing the migrations is what makes it feel risky. The server data goes first: it becomes Server Component props with a cache lifetime, and its mutations become Server Actions plus invalidation, which usually deletes the largest slice of the store and most of its effects. The filter state goes to the URL next, which is user-visible improvement — shareable links, working back button — and therefore easy to justify. What remains is the drag state, which is genuine client state, and it is now small enough to keep in a properly provided store or even a hand-rolled one. Attempting the three together produces a change nobody can review.

**★ Why is a theme in a client store worse than a theme in a cookie?**
Because a client store does not exist until hydration, so the server has nothing to render with and must emit a default — which means every cold load flashes the wrong theme before correcting itself. A cookie is sent with the request, so a Server Component can read it and render the correct value in the first byte, with no flash and no client JavaScript involved in the decision at all. It is the same principle as URL state: a value the server can see is a value the first paint can be correct about. Reach for a client store only for values the server genuinely cannot know.

---

← [04f · Jotai under SSR](04f-jotai-under-ssr.md) · [Chapter 8 overview](01-explanation.md) · Next → [05 · TanStack Query and RTK Query in the App Router](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md)
