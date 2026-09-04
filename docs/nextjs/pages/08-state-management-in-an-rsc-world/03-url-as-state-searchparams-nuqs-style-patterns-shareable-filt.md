---
title: "Filters, sort and pagination are addresses, not component state — the URL is a store you already ship, and in Next.js 16 it arrives at the server as a promise of a plain object whose every value might be an array"
sidebar_label: "03 · URL as state — the store you already ship"
sidebar_position: 11
description: "Why filter and sort state belongs in the query string, what the searchParams promise actually resolves to, how repeated keys change the type, and the PageProps helper that types the route but not the query."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) (`lastUpdated: 2026-06-09`)
> and [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params) (`lastUpdated: 2026-07-14`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**Every board you have ever built has the same bug: a user filters to "assigned to me, blocked, sorted by age", sends the link to a colleague, and the colleague opens an unfiltered board. The state was in `useState`. Filters, sort, pagination, the open tab, the selected date range — these are *addresses*, not component state, and the address bar is a store you are already shipping: already serialised, already integrated with back/forward, already readable by the server before a single byte of JavaScript runs. This page establishes what that store actually gives you and what its values are actually shaped like, because the type `string | string[] | undefined` is not defensive pessimism — it is a promise the framework keeps.**

## What the URL buys that no client store can

Put a filter in `useState` and you get one thing: it is fast to write. Put it in the query string and you get six things, none of which you have to build:

| Property | Why it is free in the URL | What it costs in a client store |
|---|---|---|
| **Shareable** | Copy the address bar | A serialise-to-link feature you write yourself |
| **Back / forward** | The history stack already holds it | A history integration you write yourself |
| **Refresh-survivable** | The browser resends the URL | `sessionStorage` plus a rehydration effect |
| **Server-readable** | Arrives with the request, before hydration | Impossible — the server never sees it |
| **Prerenderable per-link** | `<Link prefetch={true}>` can resolve it ahead of the click | Impossible |
| **Bookmarkable / linkable from email** | It is a URL | Impossible |

The fourth row is the one that matters in an RSC app. A Server Component can render the *correct, filtered* list on the first paint because the filter travelled in the request. A client store cannot, because the store does not exist until the bundle has loaded — which means the server rendered the wrong list and the client has to correct it. That correction is the flash of unfiltered content that plagues client-state dashboards.

The fifth row is covered in [03b](03b-url-as-state-and-the-static-shell.md); it is the reason URL state can be *faster* than client state rather than merely more correct.

### What does not belong in the URL

The same properties that make the URL a good store make it a bad one for some things:

| State | In the URL? | Why |
|---|---|---|
| Filter, sort, page, tab, date range | ✅ | Shareable and server-readable is exactly what you want |
| A modal's open/closed flag | ✅ *if* the modal is a place — a task detail, a settings pane | Deep-linkable, back-button-closable |
| A tooltip's hover state | ❌ | Sixty history entries a minute |
| Draft text in an unsaved form | ❌ | Leaks into shared links and browser history in plaintext |
| Anything derived from a session | ❌ | It is already on the server; putting it in the URL makes it forgeable |
| A large selection set (500 ids) | ❌ | See the URL length limits in [03i](03i-url-as-state-encoding-and-parsing.md) |

The forgeability line is the one that gets skipped. A query string is user input with the same trust level as a request body — see the zod discipline in [03i](03i-url-as-state-encoding-and-parsing.md).

## `searchParams` is a promise, and that is not cosmetic

On a `page` file, `searchParams` arrives as a prop typed as a promise:

```tsx filename="app/[tenant]/board/page.tsx"
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { status = 'open', sort = 'age' } = await searchParams
  return <Board status={status} sort={sort} />
}
```

The docs are explicit:

> *"Since the `searchParams` prop is a promise. You must use `async/await` or React's `use` function to access the values."*
> — [`page.js`, `searchParams` (optional)](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional)

> *"`searchParams` is a **Request-time API** whose values cannot be known ahead of time. Using it will opt the page into **dynamic rendering** at request time."*
> — same section

That second sentence is the entire economics of URL state in Next.js 16, and [03b](03b-url-as-state-and-the-static-shell.md) is about paying it in the smallest possible place. What matters here is the third sentence in the same block, which people miss and then debug for an hour:

> *"`searchParams` is a plain JavaScript object, not a `URLSearchParams` instance."*

`searchParams.get('q')` is not a method on the server prop. It *is* a method on what `useSearchParams()` returns in a client component. The two APIs look alike and are not the same object.

### A client-component page reads it with `use()`

A page may be a Client Component, in which case it cannot be `async` and unwraps the promise with React's `use`:

```tsx filename="app/shop/page.tsx"
'use client'
import { use } from 'react'

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const filters = use(searchParams).filters
  return <Filters value={filters} />
}
```

This pattern is documented, and it suspends:

> *"You can also pass the Page `searchParams` prop directly to a Client Component and unwrap it with React's `use()`. Although this will suspend, so the Client Component should be wrapped with a `Suspense` boundary."*
> — [`useSearchParams`, Prerendering](https://nextjs.org/docs/app/api-reference/functions/use-search-params#prerendering)

## The shape of duplicated keys

| Example URL | `searchParams` resolves to |
|---|---|
| `/shop?a=1` | `Promise<{ a: '1' }>` |
| `/shop?a=1&b=2` | `Promise<{ a: '1', b: '2' }>` |
| `/shop?a=1&a=2` | `Promise<{ a: ['1', '2'] }>` |

— table reproduced from [`page.js`, `searchParams`](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional).

So the static type of every value is `string | string[] | undefined`, and code that writes `status.toUpperCase()` crashes the moment somebody hand-edits the URL to `?status=open&status=done`. **The union is not the framework being cautious — it is the framework telling you the exact shape of a real URL it will hand you.**

The client-side hook behaves differently on the same URL, which is a genuine asymmetry worth memorising:

| URL | `useSearchParams().get("a")` |
|---|---|
| `/dashboard?a=1` | `'1'` |
| `/dashboard?a=` | `''` |
| `/dashboard?b=3` | `null` |
| `/dashboard?a=1&a=2` | `'1'` — *use `getAll()` to get all values* |

— table reproduced from [`useSearchParams`, Returns](https://nextjs.org/docs/app/api-reference/functions/use-search-params#returns).

Three differences in four rows: an absent key is `undefined` on the server and `null` on the client; a repeated key is an array on the server and the *first value only* on the client; an empty value is `''` on both. Server and client can therefore disagree about the same URL if you write naive code on both sides.

## The typed way: `PageProps`

Next.js generates route-literal types during `next dev`, `next build` or `next typegen`, and exposes a global helper. No import needed:

```tsx filename="app/[tenant]/board/page.tsx"
export default async function BoardPage(props: PageProps<'/[tenant]/board'>) {
  const { tenant } = await props.params
  const query = await props.searchParams
  return <Board tenant={tenant} query={query} />
}
```

> *"Using a literal route (e.g. `'/blog/[slug]'`) enables autocomplete and strict keys for `params`."*
> — [`page.js`, Page Props Helper](https://nextjs.org/docs/app/api-reference/file-conventions/page#page-props-helper)

Note what it does **not** do. It gives you strict keys for `params`, not for `searchParams` — the framework has no idea what query keys your page accepts. Typing them is your job, and it is a *validation* job, not an `as` cast. [03i](03i-url-as-state-encoding-and-parsing.md) shows the zod schema that does it properly.

## Gotchas

**★ Symptom: `TypeError: searchParams.get is not a function` in a Server Component.** Cause: the page prop is a plain object; only the client hook returns a `URLSearchParams`-shaped object. Fix: destructure, or construct a real `URLSearchParams` if you need its methods.

```ts
const raw = await props.searchParams
const entries: [string, string][] = Object.entries(raw).flatMap(([k, v]) =>
  v === undefined ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]],
)
const params = new URLSearchParams(entries)
params.get('status') // now this works
```

**★ Symptom: `status.toUpperCase is not a function`, reported by one user in production and reproducible by nobody.** Cause: they had `?status=open&status=done` in a bookmarked URL, so `status` is `['open', 'done']`. Fix: normalise every read at the boundary.

```ts
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const status = one((await props.searchParams).status) ?? 'open'
```

**★ Symptom: the server renders "no filter" and the client instantly renders "filter applied" for `?tag=` (empty value).** Cause: on the server an empty value is `''` (falsy but present); on the client `useSearchParams().get('tag')` also returns `''`, but a naive `params.get('tag') ?? 'all'` keeps `''` while a server-side `tag || 'all'` promotes it to `'all'`. Fix: pick one coercion and share it.

```ts
// shared/query.ts — imported by both the page and the client component
export function readTag(value: string | null | undefined): string {
  return value ? value : 'all'   // '' and null and undefined all become 'all'
}
```

**★ Symptom: `PageProps<'/board'>` is not defined and TypeScript errors on a clean checkout or in CI.** Cause: the helper is *generated*, not shipped in `next-env.d.ts`. Fix: run type generation before typechecking.

```bash
npx next typegen
```

> *"Types are generated during `next dev`, `next build`, or with `next typegen`."*
> — [`page.js`, Page Props Helper](https://nextjs.org/docs/app/api-reference/file-conventions/page#page-props-helper)

**★ Symptom: `params` and `searchParams` read synchronously still "work", and a teammate insists the promise thing is optional.** Cause: Next.js 15 kept a backwards-compatible synchronous read. Fix: stop relying on it — the docs mark it for removal, and there is no migration path that is cheaper later than now.

> *"In version 14 and earlier, `searchParams` was a synchronous prop. To help with backwards compatibility, you can still access it synchronously in Next.js 15, but this behavior will be deprecated in the future."*
> — [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional)

**★ Symptom: a draft comment a user never posted turns up in the analytics referrer log.** Cause: someone bound a textarea to a query param, so every keystroke ended up in `document.location` and then in the `Referer` header of the next outbound request. Fix: keep unsaved text in component state and only put a *committed* value in the URL.

```tsx
const [draft, setDraft] = useState('')      // never in the URL
function commit() {
  router.replace(`?q=${encodeURIComponent(draft)}`)   // only on submit
}
```

**★ Symptom: a Client Component page renders `undefined` for every filter on first paint.** Cause: it destructured `props.searchParams` without `use()`, so it destructured the promise object rather than its result. Fix: unwrap it, and give it a boundary because `use()` suspends.

```tsx
'use client'
import { use } from 'react'

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { q } = use(searchParams)   // not: const { q } = searchParams
  return <Results q={q} />
}
```

## Interview questions

**★ What is the difference between the page's `searchParams` prop and `URLSearchParams`?**
`searchParams` on a page resolves to a plain JavaScript object whose values are `string | string[] | undefined` — repeated keys collapse into an array, a key present with no value is an empty string, and absent keys are simply missing from the object. `URLSearchParams` is a browser class with `get`, `getAll`, `has` and `entries`, where `get` on a repeated key returns only the first value and an absent key returns `null`. The page prop has no methods at all. The client hook `useSearchParams()` returns the read-only `URLSearchParams`-shaped object. Calling `.get()` on the page prop is a `TypeError`, and it is the most common first-week mistake with the App Router.

**★ What happens on `?status=open&status=done`, and why is the union type not paranoia?**
`searchParams.status` resolves to `['open', 'done']`. Nothing warns you at runtime; the type already said `string | string[] | undefined` and you probably cast it away. Any string operation on it throws — for one user, on a URL nobody else has, which makes it maximally expensive to reproduce. The union exists because a query string genuinely permits repeated keys and the framework refuses to lie about it. The defence is a normalising read at the boundary that takes the first value or rejects the request, never an `as string` cast, which silences the type system about precisely the case it was warning you about.

**★ Server-side and client-side reads of the same URL can disagree. Where?**
Three places. An absent key is `undefined` on the server prop and `null` from `useSearchParams().get()`. A repeated key is a full array on the server and the *first value only* from `.get()` on the client — you need `.getAll()` to match. And the server prop is a plain object while the client returns a read-only `URLSearchParams`, so the code shapes differ enough that people write two independent readers and coerce differently in each. The fix is a single shared parse module imported by both sides, which is exactly what a library like `nuqs` sells (see [03k](03k-nuqs-typed-search-params-as-a-library.md)).

**★ You need the current filter both to query the database on the server and to highlight the active chip in a client component. Do you read it twice?**
Yes, and that is correct rather than duplication. The server reads the page's `searchParams` prop to build the query; the client component reads `useSearchParams()` to style itself. They are two consumers of one source of truth — the URL — not two copies of state. Passing the parsed value from the page down as a prop also works and is preferable when the value needed parsing or validation, because then the parse happens once. What you must never do is copy the value into `useState` on mount: that creates a second source of truth which silently drifts on back/forward, since a history navigation changes the URL without remounting the component.

**★ Which state does *not* belong in the URL?**
Anything high-frequency (hover, drag position, scroll offset) because each write is a history operation and browsers rate-limit the History API; anything private or unsubmitted (draft text, a password field) because URLs leak into browser history, server logs, analytics and the `Referer` header; anything derivable from the session, because putting it in the URL makes it forgeable by the user; and anything large, because browsers and especially messaging platforms truncate long URLs. The test is whether the value is an *address* — something you would be happy for a colleague to receive by link — or a transient UI detail.

**★ Why does `PageProps` type `params` strictly but not `searchParams`?**
Because `params` is derivable from the filesystem and `searchParams` is not. The route literal `'/shop/[slug]'` tells the compiler exactly which dynamic segments exist and what they are named, so the generated type can give you strict keys and autocomplete. Query keys are invented at runtime by whoever constructs the URL — a link elsewhere in your app, a bookmark, a marketing campaign, a bot — so there is no filesystem fact the framework could read to constrain them. That gap is where your own schema goes: the framework guarantees the *shape* of the values and you guarantee their *meaning*.

---

← [02 · When RSC data flow is enough](02-when-rsc-data-flow-is-enough.md) · [Chapter 8 overview](01-explanation.md) · Next → [03b · URL state and the static shell](03b-url-as-state-and-the-static-shell.md)
