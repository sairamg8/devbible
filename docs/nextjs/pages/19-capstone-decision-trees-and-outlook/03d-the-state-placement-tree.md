---
title: "State has four possible owners and filing a value under the wrong one does not produce vague slowness — it produces a specific, reproducible bug you can name in advance, which is what makes this tree usable at two in the morning"
sidebar_label: "03d · The state placement tree"
sidebar_position: 14
description: "The URL, the server, a scoped client store and an optimistic overlay: the questions that assign an owner, the named bug each mis-filing produces, and why putting state in the URL re-decides the rendering tree."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — every branch of this tree terminates in a page of this book that already argues it, verified there against the Next.js 16.3.4 documentation. This page introduces no new framework claims of its own.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**The reason a state-placement tree is worth writing down, when "just use the right tool" sounds like advice, is that the wrong answer here is not a performance regression — it is a bug with a shape you can predict before you write the code. A filter that cannot be shared. A drag that survives a navigation. A card that snaps back to its old column after a move the database accepted. A store that outlives one request and shows one user another user's board. Each of those is a specific row filed under the wrong owner, and once you know the mapping you can run it backwards: the bug report tells you which owner the value should have had. [Chapter 8's milestone](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md) builds all four owners for one board; this tree is the assignment rule, plus the constraint chapter 8 is not allowed to state — that choosing the URL re-decides the rendering answer for that route.**

Against [the four-things rule](03-architecture-decision-trees-rendering-strategy.md): this tree crosses into chapters 4, 5 and 6 through `searchParams`; the settling question is **"who else needs to be able to reconstruct this value, and from what?"** rather than the popular *"do I need a state library?"*; every branch has a named later cost; and it has one door that is one-way in the way that matters commercially — a URL shape you have published.

## The four owners

| Owner | Holds | Reconstructed from | Dies when |
|---|---|---|---|
| **The URL** | Anything a stranger should be able to receive by link | The query string, parsed and defaulted | Never — it is in history, bookmarks and shared messages |
| **The server** | Anything that is a fact about the product rather than about this session | The database, through a cached read | Never |
| **A scoped client store** | Per-tab UI: what is open, selected, hovered, being dragged | Nothing — it is genuinely ephemeral | The tab closes, or the provider unmounts |
| **An optimistic overlay** | The value the user believes is true while their mutation is in flight | The pending transition | The `await` resolves — it has no lifetime of its own |

## The state placement tree

```text
STATE PLACEMENT TREE — four owners, and the named bug each mis-filing produces

Q1. Must this value survive a full page refresh?
    |
    +- No; it dies with the interaction ------------------------------> Q4
    +- Yes -----------------------------------------------------------> Q2

Q2. Should a stranger be able to receive this exact state by being sent a link?
    (Also: should the back button restore it? Should a bug report be able to
     paste it? Those are the same question.)
    |
    +- Yes -> THE URL. searchParams, parsed by one module that defaults every
    |         field rather than throwing, because a query string is the only
    |         application state an attacker can type.
    |         🔴 Note what you just did: searchParams is a REQUEST-TIME API.
    |            This decision re-decides the RENDERING tree for this route,
    |            and WHERE you await it decides how much of the page still
    |            prerenders.
    +- No ----------------------------------------------------------> Q3

Q3. Does the server need this value in order to render the page?
    |
    +- Yes -> THE SERVER. It lives in the database and arrives as an argument
    |         to a cached read. Do not also keep a copy on the client.
    +- No, but it is a per-user preference that must persist across devices ->
    |         THE SERVER too, on the user record.
    +- No, and it only needs to persist on this device -> a cookie - which is
              also a request-time read, so this is a rendering decision as well.

Q4. Is it per-tab, or per-interaction?
    |
    +- Per-tab UI state: which panel is open, which card is selected, what is
    |  being dragged, whether the sidebar is collapsed ------> A SCOPED CLIENT STORE
    |     🔴 "Scoped" is load-bearing. The store is manufactured per mount by
    |        a provider. A store created at module scope is a module-level
    |        variable, and a module is instantiated once per server process
    |        and shared by every request that process handles.
    |
    +- Per-interaction, and only while a mutation is in flight -------> Q5

Q5. Must the UI show the new value BEFORE the server confirms it?
    |
    +- No --> nothing to place. Let the server render it and let the pending
    |         state be a spinner.
    +- Yes -> AN OPTIMISTIC OVERLAY. It borrows the transition's lifetime and
              has none of its own: the moment the await resolves, the element
              renders from props again.
              🔴 WHICH props it resolves onto is a SERVER decision, not a
                 client one. If the action did not ship fresh data back, the
                 optimistic value expires onto stale props and the user watches
                 their change undo itself.
```

## The mis-filing table — the bug each wrong answer produces

This is the half of the tree you actually use during an incident. Read it right-to-left.

| The symptom in the bug report | What was mis-filed | Where it should have gone |
|---|---|---|
| "I can't send my teammate this filtered view" · the back button does nothing · a refresh resets the filters | Filters in a client store | [The URL](../08-state-management-in-an-rsc-world/07b-milestone-filters-on-the-server.md) |
| Every filter change is a full server round trip and the UI feels heavy for state nobody shares | Ephemeral UI state in the URL | [A scoped store](../08-state-management-in-an-rsc-world/07e-milestone-the-scoped-zustand-store.md) |
| A card is still marked "being dragged" after navigating away and back · history is full of junk entries | Interaction state in the URL | A scoped store |
| The card snaps back to its old column after a move the database accepted | An optimistic value treated as if it owned the truth, plus an invalidation that did not ship a re-render | [The action and what invalidates what](../08-state-management-in-an-rsc-world/07k-milestone-the-action-and-what-invalidates-what.md) |
| 🔴 One user sees another user's board, intermittently, only in production | A store created at module scope on the server | [The scoped store](../08-state-management-in-an-rsc-world/07e-milestone-the-scoped-zustand-store.md) |
| The list is correct after a hard refresh and wrong after a client navigation | Server data copied into a client store, which no invalidation reaches | The server |
| The first client paint disagrees with the server's HTML | Persisted store state rehydrating over server-rendered markup | [Selectors, resets and hydration](../08-state-management-in-an-rsc-world/07f-milestone-selectors-resets-and-hydration.md) |
| Dragging one card re-renders the whole board | A selector returning a new reference every render, or a `Set` mutated in place | [Selectors, resets and hydration](../08-state-management-in-an-rsc-world/07f-milestone-selectors-resets-and-hydration.md) |
| The page lost its static shell and nobody changed the rendering config | `await searchParams` moved up into the page component | [Reading filters in the page](../08-state-management-in-an-rsc-world/07c-milestone-reading-filters-in-the-page.md) |
| The cached board read has a hit rate near zero | The filters were passed into the cache key instead of used in the render | [Reading filters in the page](../08-state-management-in-an-rsc-world/07c-milestone-reading-filters-in-the-page.md) |

## 🔴 Choosing the URL is a rendering decision

This is the constraint chapter 8 cannot state and chapter 6 cannot either, because it belongs to both.

Putting a value in the URL means reading it back through `searchParams`, and `searchParams` is a request-time API. So the moment a filter moves out of a store and into the query string, [the rendering tree's](03-architecture-decision-trees-rendering-strategy.md) Q1 is answered *yes* for whatever scope performs the `await` — and the scope that encloses that await becomes request-time rendering. Awaiting in the page component and awaiting in a child under a `<Suspense>` boundary are the difference between a page with a static shell and a page without one, **with no visible symptom in development**.

The second half is the cache key. The filters belong in the render, not in the key: a cached board read keyed on an arbitrary filter combination produces entries that are created once and read once. Both halves are argued in [07c](../08-state-management-in-an-rsc-world/07c-milestone-reading-filters-in-the-page.md), and both are decisions made in a state-management pull request that reviewers will read as a state-management change.

## The other cross-tree link: the overlay resolves onto server props

An optimistic value stops being held the instant the action's `await` resolves, and the element renders from props again. Whether those props are fresh is decided on the server, by [the caching tree's](03b-the-caching-tree.md) Q2: `updateTag` inside a Server Action ships a re-render in the action's own response, so the optimistic value expires onto fresh data; `revalidateTag` under a stale-while-revalidate profile deliberately does not, so it expires onto the old data and the user watches their card jump back. The client half can be entirely correct and still produce that bug. [07j](../08-state-management-in-an-rsc-world/07j-milestone-the-drop-the-action-and-reconciliation.md) builds the client half; [07k](../08-state-management-in-an-rsc-world/07k-milestone-the-action-and-what-invalidates-what.md) is the one line on the server that decides whether it works.

## What each owner costs you later

| Owner | The bill |
|---|---|
| **The URL** | A published URL shape is a compatibility surface. Renaming `?status=` to `?state=` breaks every bookmark, every shared link and every dashboard someone built on top of it — this is the closest thing to a one-way door on this tree, and it is commercial rather than technical. It also permanently couples that route to request-time rendering for the scope that reads it. |
| **The server** | Every read of it is a network hop and a cache decision, so the value acquires a lifetime and an invalidation path it did not have on the client. |
| **A scoped client store** | It is client-only code: a provider, a factory, selectors, a reset. [The bill](../08-state-management-in-an-rsc-world/07l-milestone-what-it-costs-and-where-it-generalises.md) is real and worth paying only when you can name what the owner buys. |
| **An optimistic overlay** | It couples a client component to a server invalidation decision made in another file, so the two must be changed together forever — and the failure mode is visual, not an exception. |

## Gotchas

**★ Symptom: one user intermittently sees another user's board, and only in production.** Cause: a Zustand store created at module scope. On the server a module is instantiated once per process and shared by every request it serves, so anything one user's render writes into it is visible to the next user's render — and locally, with one user, nothing ever collides. Fix: manufacture the store per mount in a provider and read it through context:

```tsx
'use client'
import { createContext, useContext, useRef } from 'react'
import { createStore, useStore } from 'zustand'

const BoardStoreContext = createContext<ReturnType<typeof createBoardStore> | null>(null)

export function BoardStoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<ReturnType<typeof createBoardStore>>(null)
  if (!storeRef.current) storeRef.current = createBoardStore()
  return <BoardStoreContext.Provider value={storeRef.current}>{children}</BoardStoreContext.Provider>
}

export function useBoardUi<T>(selector: (s: BoardUiState) => T): T {
  const store = useContext(BoardStoreContext)
  if (!store) throw new Error('useBoardUi must be used inside BoardStoreProvider')
  return useStore(store, selector)
}
```

**★ Symptom: a user cannot share a filtered view, and the back button does nothing.** Cause: the filters were filed under a client store because a store was already there. Fix: move them to the query string behind one parsing module that defaults every field rather than throwing — the same module is used by the filter bar that writes URLs, the page that reads them and the optimistic reducer that decides whether a moved card still matches, so there is exactly one definition of what a filter means.

**★ Symptom: the board page lost its static shell and no rendering configuration changed.** Cause: `await props.searchParams` moved up into the page component during a refactor, and the scope that encloses the await becomes request-time. Fix: await it in the smallest component that needs it, under a `<Suspense>` boundary, and keep the rest of the page prerenderable — then re-run [the rendering tree](03-architecture-decision-trees-rendering-strategy.md), because this was a rendering change disguised as a state change.

**★ Symptom: the cached board read never hits twice.** Cause: the filters were passed into the cache key. An arbitrary filter combination is close to unique per user per session, so each entry is created once and read once. Fix: cache the board on a low-cardinality dimension — the board id, the workspace — and apply the filters in the render, where they cost nothing.

**★ Symptom: a card visibly returns to its old column after a move the server accepted.** Cause: the optimistic value expired onto stale props, because the Server Action invalidated under a stale-while-revalidate profile and shipped no re-render with its own response. Fix: this is a server-side one-line change, not a client fix:

```ts
'use server'
import { updateTag } from 'next/cache'

export async function moveCard(cardId: string, toColumn: string) {
  await db.card.move(cardId, toColumn)
  updateTag(`board-${boardId}`)   // the action's response carries fresh data
}
```

**★ Symptom: the optimistic value never appears, or appears and immediately vanishes.** Cause: the setter was called outside the transition, so there was no pending Action for the value to borrow a lifetime from. Fix: call it inside `startTransition`, in the same transition as the action — an optimistic value has no lifetime of its own and holds only while an Action is pending.

**★ Symptom: the first client paint disagrees with the server's HTML.** Cause: persisted store state rehydrating on top of server-rendered markup that knew nothing about it. Fix: do not persist state the server also renders; persist only genuinely client-owned preferences, and gate the read so the first paint matches what the server sent.

**★ Symptom: dragging one card re-renders the entire board.** Cause: a selector returning a new object or array every render, or a `Set` mutated in place so the reference never changes and change detection sees nothing until something else forces a render. Fix: select primitives, or memoise the derived value; replace the `Set` rather than mutating it.

**★ Symptom: a list is correct after a hard refresh and wrong after a client navigation.** Cause: server data was copied into a client store, which is now a second source of truth that no server invalidation can reach. Fix: delete the copy. If the client genuinely needs to derive something from it, derive it at render time from the props the server sent.

**Symptom: the store is still full of the previous board's state after navigating between boards.** Cause: the provider did not unmount, so the per-mount store survived a navigation that logically reset it. Fix: key the provider on the board id so a different board mounts a different store, and give the store an explicit reset for the cases where remounting is not appropriate.

**Symptom: a query parameter arrives with a value nobody anticipated and the page throws.** Cause: the query string is the only part of your application state a stranger can type, and it was parsed with something that throws on an unexpected shape. Fix: every field falls back to a default rather than throwing; the parser is a pure module so this rule is enforced in one place and testable without a request.

## Interview questions

**★ How do you decide where a piece of state lives?**
Four questions in order. Must it survive a refresh — if not, it is client-only. Should a stranger be able to receive it by link, and should the back button restore it — if so, it is the URL. Does the server need it to render — if so, it is the database. And if it only exists while a mutation is in flight and the UI must be correct before the server confirms, it is an optimistic overlay, which has no lifetime of its own. The reason to run them in that order is that each one eliminates owners, and the first two are product questions I am not entitled to answer alone.

**★ Why is a mis-filed piece of state a better bug than a mis-tuned cache?**
Because it is deterministic and it has a name. Filters in a store means "I cannot share this view" — reproducible every time, in one click. A store at module scope means "one user sees another user's data", which is reproducible under concurrency and terrifying but still specific. That predictability runs in both directions: given the bug report, I can usually name the owner the value should have had before I open the code.

**★ What is the cross-chapter consequence of putting a filter in the URL?**
It re-decides the rendering strategy for that route. `searchParams` is a request-time API, so the scope that awaits it renders at request time, and awaiting it in the page component instead of in a small child under `<Suspense>` costs the page its static shell — with no error and no visible difference in development. A state-management pull request can therefore change a rendering decision that a different team documented, which is exactly the kind of coupling a chapter is not able to warn you about.

**★ A card snaps back to its old column after a successful move. The optimistic code is correct. What is wrong?**
The server. An optimistic value is held only while the Action is pending and then the element renders from props again, so the question is what those props contain when it expires. If the action called `revalidateTag` under a stale-while-revalidate profile, its own response carries no fresh render and the value expires onto the pre-move data — database right, cache scheduled, user watching their change undo itself. `updateTag` inside the Server Action ships the re-render in the action's own response, which is what makes the drop stick.

**★ Why is "scoped" the load-bearing word in "a scoped client store"?**
Because the alternative is a module-level variable, and on the server a module is instantiated once per process and shared by every request it handles. `export const useBoardUi = create(...)` is not a store per user; it is a store per server process. Anything one request writes is visible to the next, so the failure is cross-user data exposure that never reproduces locally. The fix is not a library feature — it is a factory called inside a hook, one instance per mount, handed down through context.

**★ When is duplicating server data into a client store defensible?**
Almost never as a cache, sometimes as a staging area. Copying server data into a store creates a second source of truth that no server invalidation reaches, so the copy silently diverges after any mutation — correct on a hard refresh, wrong after a client navigation. The defensible version holds something the server does not own at all: an in-progress form the user has not submitted, or a multi-step selection that becomes one request at the end.

**★ You have four owners and one screen. Is that over-engineering?**
It is a real bill and it is worth paying only when you can name what each owner buys. The board's four owners each answer a question the others cannot: the URL makes the view shareable and the back button meaningful, the database makes the data true for everyone, the scoped store keeps drag state out of history and off the server, and the overlay makes the interaction feel immediate. Drop any one and there is a specific defect, not a vague degradation — which is a much better test of necessity than counting files.

---

← [03c · The cache directive tree](03c-the-cache-directive-tree.md) · Next → [03e · The runtime and deployment-target tree](03e-the-runtime-and-deployment-target-tree.md)
