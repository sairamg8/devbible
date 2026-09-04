---
title: "nuqs turns the seven decisions the previous chunks made by hand into named options on a typed parser object, and its defaults — replace, no scroll, client-first, browser-aware throttle — are exactly what a filter input wants"
sidebar_label: "03k · nuqs — search params as a library"
sidebar_position: 21
description: "The client half of nuqs 2.10.1: the adapter, useQueryState and useQueryStates, the built-in parsers, the seven options mapped onto the decisions the previous chunks made by hand, browser-aware throttling and per-call debounce, transitions, and batching."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against the nuqs documentation — [Adapters](https://nuqs.dev/docs/adapters),
> [Basic usage](https://nuqs.dev/docs/basic-usage), [Built-in parsers](https://nuqs.dev/docs/parsers/built-in),
> [Options](https://nuqs.dev/docs/options) and [useQueryStates](https://nuqs.dev/docs/batching).
> Version confirmed from the npm registry: **`nuqs` 2.10.1** (MIT).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **zod 4.4.3**.
> Documentation-verified; **no sandbox run**.

**Everything the previous chunks built by hand — the normalising read, the serialiser, the debounce, the throttle Safari forces on you, the transition, the shared type — is roughly two hundred lines of code that has to stay consistent across a page, a link builder and three client components. `nuqs` is the library that packages it, and its self-description is accurate: *"Type-safe search params state management for React. Like useState, but stored in the URL query string."* This page is its client half: the adapter, the hooks, the parsers and the seven options that name the decisions the previous chunks made by hand. The server half — one parser declaration feeding both runtimes — and the honest cost accounting are in [03l](03l-nuqs-on-the-server-and-when-to-hand-roll.md).**

## Setup: one adapter at the root

```tsx filename="app/layout.tsx"
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { type ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  )
}
```

> *"Since version 2, you can now use nuqs in the following React frameworks, by wrapping it with a `NuqsAdapter` context provider"*
> — [nuqs, Adapters](https://nuqs.dev/docs/adapters)

The adapter is a client component provider, so the rule from [04](04-client-state-tools-compared-react-context-zustand-jotai.md) applies: it wraps `{children}` rather than importing the tree, so everything below it stays a Server Component unless it says otherwise.

## The hook, and why the parser is the point

```tsx filename="app/[tenant]/board/status-filter.tsx"
'use client'

import { useQueryState, parseAsStringLiteral } from 'nuqs'

const STATUSES = ['open', 'blocked', 'done', 'archived'] as const

export function StatusFilter() {
  const [status, setStatus] = useQueryState(
    'status',
    parseAsStringLiteral(STATUSES).withDefault('open').withOptions({ shallow: false }),
  )

  return (
    <select value={status} onChange={(e) => setStatus(e.target.value as typeof STATUSES[number])}>
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}
```

> *"`useQueryState` takes one required argument: the key to use in the query string. Like `React.useState`, it returns an array with the value present in the query string as a string (or `null` if none was found), and a state updater function."*
> — [nuqs, Basic usage](https://nuqs.dev/docs/basic-usage)

> *"Setting `null` as a value will remove the key from the query string."*
> — same page

`.withDefault()` changes the type from `T | null` to `T`, which removes the `?? 'open'` from every read. And a detail that matters for the validation discipline of [03j](03j-url-as-state-validating-and-canonical-urls.md): *"The default value is also returned if the value is *invalid* for the parser."* That is per-field `.catch()` behaviour, built in.

The built-in parsers cover the encodings [03i](03i-url-as-state-encoding-and-parsing.md) argued about: `parseAsString`, `parseAsInteger`, `parseAsFloat`, `parseAsHex`, `parseAsIndex` (*"adds a `+1` offset to the serialized querystring (and `-1` when parsing). Useful for pagination indexes"*), `parseAsBoolean`, `parseAsStringLiteral`, `parseAsNumberLiteral`, `parseAsStringEnum`, `parseAsIsoDateTime`, `parseAsIsoDate`, `parseAsTimestamp`, `parseAsArrayOf` (comma-separated by default, custom separator optional), `parseAsNativeArrayOf` (repeated keys) and `parseAsJson`.

`parseAsJson` takes a Standard Schema, so your zod schema plugs straight in:

```ts
import { parseAsJson } from 'nuqs'
import { z } from 'zod'

const viewSchema = z.object({ columns: z.array(z.string()), density: z.enum(['cosy', 'compact']) })
const [view, setView] = useQueryState('view', parseAsJson(viewSchema))
```

> *"Pass it a Standard Schema (eg: a Zod schema) to validate and infer the type of the parsed data"*
> — [nuqs, JSON](https://nuqs.dev/docs/parsers/built-in#json)

## The options are the eight decisions, named

| Option | Default | The hand-rolled equivalent |
|---|---|---|
| `history` | `'replace'` | `router.replace` vs `router.push` ([03g](03g-url-as-state-writing-programmatically.md)) |
| `shallow` | `true` | `history.pushState` vs `router.replace` ([03h](03h-url-as-state-shallow-updates-and-the-history-api.md)) |
| `scroll` | `false` | `{ scroll: false }` on every call ([03f](03f-url-as-state-writing-declaratively.md)) |
| `limitUrlUpdates` | throttle, browser-adapted | the throttle you did not write |
| `clearOnDefault` | `true` | omit-defaults canonicalisation ([03j](03j-url-as-state-validating-and-canonical-urls.md)) |
| `startTransition` | none | `useTransition` around the navigation |
| `urlKeys` | none | short URL keys with long variable names |

> *"By default, `nuqs` will update search params: 1. On the client only (not sending requests to the server), 2. by replacing the current history entry, 3. without scrolling to the top of the page. 4. with a throttle rate adapted to your browser"*
> — [nuqs, Options](https://nuqs.dev/docs/options)

Read those four defaults against the previous chunks: they are exactly the four choices a filter input wants, and exactly the four a hand-rolled version gets wrong on the first attempt. `history: 'push'` carries the same warning this chapter gave:

> *"Breaking the Back button can lead to a bad user experience. Make sure to use this option only if the search params to update contribute to a navigation-like experience (eg: tabs, modals)."*
> — [nuqs, History](https://nuqs.dev/docs/options#history)

### The throttle is the strongest argument for the library

> *"Because of browsers rate-limiting the History API, updates **to the URL** are queued and throttled to a default of 50ms, which seems to satisfy most browsers even when sending high-frequency query updates, like binding to a text input or a slider."*
> *"Safari's rate limits are much stricter and use a default throttle of 120ms (320ms for older versions of Safari)."*
> — [nuqs, Rate-limiting URL updates](https://nuqs.dev/docs/options#rate-limiting-url-updates)

> *"the state returned by the hook is always updated **instantly**, to keep UI responsive. Only changes to the URL, and server requests when using `shallow: false`, are throttled or debounced."*
> — same section

That is the local-state-owns-the-input rule from [03g](03g-url-as-state-writing-programmatically.md), implemented once. And per-browser rate limits are exactly the kind of knowledge that rots in a hand-rolled helper.

Debounce is available per *call*, which is the shape the search-box policy actually needs:

```tsx filename="app/[tenant]/board/search.tsx"
'use client'

import { useQueryState, parseAsString, debounce } from 'nuqs'

export function Search() {
  const [search, setSearch] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ shallow: false }),
  )

  return (
    <input
      value={search}
      onChange={(e) =>
        setSearch(e.target.value, {
          // immediate update when clearing, otherwise debounce at 500ms
          limitUrlUpdates: e.target.value === '' ? undefined : debounce(500),
        })
      }
      onKeyPress={(e) => {
        if (e.key === 'Enter') setSearch((e.target as HTMLInputElement).value)
      }}
    />
  )
}
```

— structure from [nuqs, Debounce](https://nuqs.dev/docs/options#debounce). The docs are precise about when debounce is the right tool: *"Debounce only makes sense for **server-side data fetching** (RSCs & loaders, when combined with `shallow: false`), to control when requests are made to the server."*

### Transitions

```tsx
const [isLoading, startTransition] = React.useTransition()
const [query, setQuery] = useQueryState(
  'query',
  parseAsString.withOptions({ startTransition, shallow: false }),
)
```

> *"When combined with `shallow: false`, you can use React's `useTransition` hook to get loading states while the server is re-rendering server components with the updated URL."*
> *"`isLoading` will be true while the server is re-rendering and streaming RSC payloads, when the query is updated via `setQuery`."*
> — [nuqs, Transitions](https://nuqs.dev/docs/options#transitions)

⚠️ A version trap: *"In `nuqs@1.x.x`, passing `startTransition` as an option automatically sets `shallow: false`. This is no longer the case in `nuqs@>=2.0.0`: you'll need to set it explicitly."* A v1 codebase that upgrades silently stops hitting the server.

## Batching: several params, one URL write

```ts
import { useQueryStates, parseAsInteger, parseAsStringLiteral } from 'nuqs'

const [{ page, status }, setBoard] = useQueryStates(
  {
    page: parseAsInteger.withDefault(1),
    status: parseAsStringLiteral(['open', 'blocked'] as const).withDefault('open'),
  },
  { shallow: false },
)

// resetting the filter and the page together, in one navigation
setBoard({ status: 'blocked', page: 1 })
```

> *"You can call as many state update functions as needed in a single event loop tick, and they will be applied to the URL asynchronously"*
> *"The returned Promise is cached until the next flush to the URL occurs, so all calls to a setState (of any hook) in the same event loop tick will return the same Promise reference."*
> — [nuqs, useQueryStates](https://nuqs.dev/docs/batching)

Batching is the thing hand-rolled code gets wrong most often: two `router.replace` calls in one handler produce two navigations, the second built from a stale `searchParams` snapshot, so the first change is lost.

`useQueryStates` also gives the "short keys, readable variables" trick:

```ts
const [{ latitude, longitude }, setCoordinates] = useQueryStates(
  { latitude: parseAsFloat.withDefault(45.18), longitude: parseAsFloat.withDefault(5.72) },
  { urlKeys: { latitude: 'lat', longitude: 'lng' } },
)
```

And `setCoordinates(null)` *"will clear `lat` & `lng`, and leave other search params untouched"* — the merge semantics [03f](03f-url-as-state-writing-declaratively.md) had to build by hand.

## Gotchas

**★ Symptom: every `useQueryState` throws about a missing adapter.** Cause: `NuqsAdapter` is not mounted, or is mounted below the component. Fix: wrap `{children}` in the root layout — and wrap `{children}`, not an imported tree, so the rest stays server-rendered.

```tsx
<body><NuqsAdapter>{children}</NuqsAdapter></body>
```

**★ Symptom: the URL updates but the Server Component never re-renders.** Cause: the default is `shallow: true` — client-only, no server request. Fix: opt in per parser or per call.

```ts
parseAsString.withDefault('').withOptions({ shallow: false })
```

**★ Symptom: after upgrading from nuqs 1.x, filters stopped hitting the server.** Cause: in v1 passing `startTransition` implied `shallow: false`; from v2 it does not. Fix: set it explicitly.

```ts
parseAsString.withOptions({ startTransition, shallow: false })
```

**★ Symptom: two `setX` calls in one handler and only the last survives in the URL.** Cause: this is the documented batching behaviour — updates in one tick merge and flush once — but the *state* reflects both. Fix: if the two keys always move together, declare them in one `useQueryStates` so the intent is explicit.

```ts
const [, setBoard] = useQueryStates({ page: parseAsInteger, status: parseAsStringLiteral(STATUSES) })
setBoard({ page: 1, status: 'blocked' })
```

**★ Symptom: a `Date` state never clears when set back to its default.** Cause: `clearOnDefault` compares with `===` reference equality, which no two `Date` objects satisfy. Fix: give the custom parser an `eq`.

```ts
const dateParser = createParser({
  parse: (value: string) => new Date(value.slice(0, 10)),
  serialize: (date: Date) => date.toISOString().slice(0, 10),
  eq: (a: Date, b: Date) => a.getTime() === b.getTime(),
})
```

**★ Symptom: setting `history: 'push'` globally destroyed the Back button across the app.** Cause: the global `defaultOptions` applies to every hook. Fix: opt into `push` per hook or per call, where the parameter is genuinely navigation-like.

```tsx
useQueryState('tab', parseAsString.withOptions({ history: 'push' }))
```

## Interview questions

**★ What does `nuqs` actually give you that a `useSearchParams` + `router.replace` helper does not?**
Five things, in rough order of value. A single typed parser declaration that becomes the client hook, the server-side loader and the TypeScript type, so the URL format cannot drift between the page, the link builder and the components. Batching, so several parameter updates in one event-loop tick produce one URL write rather than two navigations where the second is built from a stale snapshot. A browser-aware throttle, which matters because the History API is rate-limited and Safari's limit is materially stricter than everyone else's. Per-call debounce, which is the shape a search box actually needs — immediate on clear and Enter, delayed while typing. And correct defaults for filter state: replace rather than push, no scroll, client-first.

**★ Why is `shallow: true` the default, and when must you change it?**
Because most URL state is display state: sort order, active tab, expanded rows, viewport, density. The client already has what it needs, so notifying the server is pure latency. The default matches that majority. You set `shallow: false` when the parameter changes what the *server* computes — a filter that changes which rows exist, a page in a server-paginated list, a search that queries the database — because only then does a re-render produce a different answer. Getting it wrong in that direction is the quiet bug: the URL changes, the list does not, and it looks like a caching problem.

**★ What does `useQueryStates` solve that repeated `useQueryState` calls do not?**
Two things. It declares that a group of parameters move together, which is the honest shape for a filter plus its page number, and it gives the whole group one options object, one `urlKeys` remapping and one clear-all setter — `set(null)` wipes exactly those keys and leaves the rest of the query string untouched. It also makes batching explicit rather than incidental: several `setX` calls in one tick already merge into a single URL write, but reading that from three separate hooks is guesswork, whereas one `setBoard({ status, page })` says what was intended. The failure it prevents is the hand-rolled equivalent — two `router.replace` calls in one handler, where the second is built from a stale `searchParams` snapshot and silently discards the first change.

**★ What is `clearOnDefault`, and why did the library change its default between majors?**
It controls whether a parameter is written to the URL when it equals its default value. With it on — the v2 default — the URL stays short and canonical, so two views that mean the same thing produce the same address, which matters for cache keys, analytics and indexing. With it off — the v1 default — the value is always explicit, so a bookmark records what was actually chosen and cannot change meaning when you later change the default. Both are defensible, which is why the library flipped, and the practical rule is to clear on default for cosmetic parameters and keep the value explicit for anything whose meaning must be frozen at the moment the link was created.

**★ Which upgrade traps does nuqs 2.x carry from 1.x?**
Two that change runtime behaviour without a type error. `clearOnDefault` flipped from `false` to `true`, so URLs that previously carried an explicit default value now omit it — harmless for display parameters, and a semantic change for anything a user bookmarked. And passing `startTransition` no longer implies `shallow: false`, so a codebase that relied on the v1 coupling silently stops notifying the server: the URL updates, the loading state works, and the Server Component never re-renders. That second one presents as a caching bug and is worth grepping for by hand at upgrade time, because nothing in the type system will point at it.

**★ Why does throttling URL writes matter enough to be a library feature?**
Because browsers rate-limit the History API, and a control bound to continuous input can exceed the limit trivially. The generally safe floor is around 50 ms; Safari needs about 120 ms and older versions 320 ms. Exceeding it does not merely waste work — the browser may queue or refuse updates, so the URL and the UI diverge, and the bug only reproduces on one browser. That is exactly the sort of per-browser knowledge that decays in a hand-written helper, and it is why "we only need forty lines of this" tends to be wrong by the second quarter.

---

← [03j · Validating query state, and canonical URLs](03j-url-as-state-validating-and-canonical-urls.md) · [Chapter 8 overview](01-explanation.md) · Next → [03l · nuqs on the server, and when to hand-roll](03l-nuqs-on-the-server-and-when-to-hand-roll.md)
