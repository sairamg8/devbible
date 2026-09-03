---
sidebar_position: 13
title: "Once you have the user, everything else is a key: pass the promise not the value, cache on the id not the cookie, and never put anything secret in a cache key or tag"
sidebar_label: "Auth with Cache Components: sharing and caching"
description: "Sharing one user promise across Server and Client Components with use(), caching session-derived data by user id, invalidating it with updateTag, keeping authenticated navigations instant, and why cache keys and tags are stored in plain text."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to implement authentication with Cache Components](https://nextjs.org/docs/app/guides/authentication-with-cache-components) (docs `lastUpdated` 2026-08-25), [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private), [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife), [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), [Data Security](https://nextjs.org/docs/app/guides/data-security), and React's [`taintUniqueValue`](https://react.dev/reference/react/experimental_taintUniqueValue).
> Target: **Next.js 16.3.4**. Requires `cacheComponents: true`. Prior page: [12 · Auth with Cache Components: the session read](12-authentication-with-cache-components-reading-the-session.md).

**Reading the session was the hard part; everything after it is a question of identity. Share the user by passing an unawaited promise rather than an awaited value, so only the components that need it suspend. Cache the data derived from that user by passing the *id* into a plain `'use cache'` function, because an id is a stable key and a cookie is not. And take seriously the one warning in this guide that is printed in bold: cache keys and tags are stored **in plain text**, on the default cache and on a remote one alike. That sentence is the difference between a cache and a data leak.**

## Share the user, do not re-read it

> *"You don't have to read the session again in every component that needs the user. Read it once, then hand it to as many Server and Client Components as you like from inside the same boundary."*

Server Components call `getCurrentUser()` directly. Reaching Client Components without prop drilling uses context carrying a **promise**:

```tsx filename="app/user-provider.tsx"
'use client'

import { createContext, use } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@/lib/auth'

const UserContext = createContext<Promise<User> | null>(null)

export function UserProvider({
  userPromise,
  children,
}: {
  userPromise: Promise<User>
  children: ReactNode
}) {
  return <UserContext value={userPromise}>{children}</UserContext>
}

export function useUser() {
  const userPromise = use(UserContext)
  if (!userPromise) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return use(userPromise)
}
```

The Server Component creates the promise and passes it **without awaiting**:

```tsx filename="app/page.tsx"
function Dashboard() {
  const userPromise = getCurrentUser()

  return (
    <UserProvider userPromise={userPromise}>
      <Suspense fallback={<span>Loading…</span>}>
        <UserBadge />
      </Suspense>
    </UserProvider>
  )
}
```

```tsx filename="app/user-badge.tsx"
'use client'

import { useUser } from './user-provider'

export function UserBadge() {
  const user = useUser()
  return <span>Signed in as {user.name}</span>
}
```

> *"The Server Component behind the boundary creates the promise and hands it to the provider without awaiting it. Each consumer then resolves it behind its own boundary, so the shared chrome renders without waiting on the session."*

> *"Because `getCurrentUser` reads the request, create its promise inside the Suspense boundary, not at the top of a layout."*

Note the two `use()` calls in `useUser()`. The first reads the context; the second unwraps the promise and suspends. That is why every consumer needs its own boundary, and why the provider itself renders instantly.

## Narrow what crosses the boundary

> *"Expose only what the client needs. The `getCurrentUser` helper returns a narrow `{ id, name }` rather than the raw session. To keep sensitive fields from reaching the client, see `taintUniqueValue`."*

Whatever the promise resolves to is serialized into the RSC payload and is readable in the browser. Returning the raw session object because "it is only used on the server today" is how a refresh token ends up in a page's HTML two refactors later. `taintUniqueValue` turns that future mistake into an error at the moment of serialization.

## Cache what the user's session *implies*, not the session itself

> *"Now that you have the user, you can cache the data you fetch for them in one of two ways. Passing the user id into a plain `use cache` function keeps the result on the server, keyed by the id (it becomes part of the cache key), where a `cacheTag` can invalidate it later. Reading it inside a `use cache: private` scope keeps it in the browser only, never on the server, which matters when requirements forbid storing certain data server-side, even ephemerally."*

```tsx filename="lib/data.ts"
import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { getCurrentUser } from './auth'

export async function getNotes() {
  const user = await getCurrentUser()
  return getNotesByUserId(user.id)
}

async function getNotesByUserId(userId: string) {
  'use cache'
  cacheTag(`notes:${userId}`)
  cacheLife('minutes')

  return db.query.notes.findMany({
    where: (notes, { eq }) => eq(notes.userId, userId),
  })
}
```

The structure is a security control, not a style choice:

> *"Keep `getNotesByUserId` unexported so a caller can't request another user's notes by passing a different id. Resolving the user inside the exported getter is what makes that safe."*

The exported function takes no arguments. The only way to reach the cached function is through the getter that resolves the session first. An exported `getNotesByUserId(userId)` would be an authorization bypass with a cache in front of it.

Calling it costs nothing extra:

> *"There's no user id to pass, and the `getCurrentUser()` call inside the getter hits the private cache, so the session isn't read again."*

```tsx filename="app/page.tsx"
async function Notes() {
  const notes = await getNotes()
  // ...
}
```

## The plain-text warning

> *"**Good to know: cache keys and tags are stored in plain text.** A cached function's arguments and captured variables are serialized into its cache key, and `cacheTag` values are stored as written. Neither is hashed: the default cache holds them as plain-text map keys and tag lists, and a remote cache receives them the same way. Key and tag on a stable identifier like the user id, and keep secrets and sensitive personal data (tokens, passwords, raw emails) out of arguments and tags."*

Two things follow that are easy to miss.

**Captured variables count.** Not just arguments — anything the cached function closes over is serialized into the key. A helper that closes over a session token to build an authorization header has put that token into the cache key.

**A remote cache receives them the same way.** So the plain text is not only in process memory; it is in whatever shared store you configured, with whatever retention and access controls that store has, readable by anyone who can list keys.

## Durability: `'use cache'` is best-effort

> *"On the server, plain `use cache` keeps the entry in memory as a best effort: it's evicted under pressure and, in serverless, doesn't persist across instances. If that data must survive across instances and requests, opt into `use cache: remote` for durable, shared storage, where the cache key you choose drives your hit rate."*

Three tiers, three storage models, and the choice is a data-classification question:

| Directive | Reads request APIs | Stored where | Survives |
| --- | --- | --- | --- |
| `'use cache'` | No | Server memory, best effort | Evicted under pressure; not across instances |
| `'use cache: remote'` | No | Durable shared storage | Across instances and requests |
| `'use cache: private'` | `cookies()`, `headers()`, `searchParams` | Browser memory only | Not across page reloads |

`connection()` is prohibited in all cached scopes.

## Mutations: `updateTag` and re-authorizing inside the action

> *"When a Server Action changes a user's data, call `updateTag` with the same tag to refresh the cached entry. Re-read the session inside the action so it authorizes itself rather than trusting the client."*

```ts filename="app/actions.ts"
'use server'
import { redirect } from 'next/navigation'
import { updateTag } from 'next/cache'
import { getSession } from '@/lib/session'
import { saveNote } from '@/lib/data'

export async function addNote(formData: FormData) {
  const { userId } = await getSession()
  if (!userId) {
    redirect('/login')
  }

  const note = String(formData.get('note') ?? '').trim()
  if (note) {
    await saveNote(userId, note)
    updateTag(`notes:${userId}`)
  }
}
```

The `userId` is read from the session inside the action, never taken from `formData`. A Server Action is a public HTTP endpoint; anything the client sends is attacker-controlled. The tag is then built from the server-derived id, which means a caller cannot invalidate — or, worse, address — another user's cache entry.

## Keeping authenticated navigations instant

> *"Cached reads already have a lifetime, so this mostly happens on its own. A `use cache: private` scope uses the `default` profile (a five-minute `stale`) unless you set one, and a route that reads the session produces a per-session App Shell with the authenticated content, prefetched and cached per session. Navigations to it are already instant."*

Two things keep it that way:

> *"If you tune the lifetime with `cacheLife`, keep `stale` at 30 seconds or more. Below that, the scope drops out of prefetching."*

> *"A route that *also* depends on the URL (a `params` or `searchParams` value) needs `<Link prefetch={true}>` on the links pointing at it. That opts into per-link prefetching, which resolves the per-link data ahead of the click."*

```tsx filename="app/page.tsx"
<Link href={`/notes/${note.id}`} prefetch={true}>
  {note.text}
</Link>
```

And the cost, stated plainly:

> *"The destination needs Partial Prefetching for this, so enable the `partialPrefetching` flag or set `prefetch = 'partial'` on the segment. Add the prop where the wait is worth it: that prefetch costs one server invocation per link, so a sidebar of `/chat/[id]` links pays that cost per item."*

A sidebar with fifty conversation links and `prefetch={true}` on each is fifty server invocations to render one page. That is a deliberate trade for a handful of high-intent links, and a self-inflicted denial of service for a list.

## The guide's own pitfall list

> *"**Reading `cookies()` or `headers()` inside a plain `use cache` function.** This throws. Read the request outside and pass the value in, or use `use cache: private`."*

> *"**Putting secrets or personal data in cache keys or tags.** Arguments and `cacheTag` values are stored in plain text. Key and tag on a stable identifier, not on sensitive input."*

> *"**Trusting the client for authorization.** UI checks hide elements, but they don't protect data. Re-verify the session in every Server Action and Route Handler, close to the data."*

## Gotchas

**★ Awaiting the user promise in the Server Component that creates it.**
`const user = await getCurrentUser()` followed by passing a resolved value blocks the provider and everything around it, defeating the whole pattern. Create the promise, pass it unawaited, and let each consumer suspend on its own `use()` behind its own boundary:

```tsx
const userPromise = getCurrentUser()   // no await
return <UserProvider userPromise={userPromise}>{children}</UserProvider>
```

**★ Returning the raw session object from the Data Access Layer.**
Whatever the promise resolves to is serialized into the RSC payload and readable in the browser. Return a narrow shape — `{ id, name }` in the guide's example — and consider `taintUniqueValue` on fields that must never cross, so a future refactor that widens the return type fails loudly instead of shipping a token to every page.

**★ Exporting the cached, id-taking function.**
`getNotesByUserId(userId)` with `'use cache'` and no session check is an authorization bypass: any caller supplies any id and gets a cached answer. Keep it unexported and reach it only through the exported getter that resolves the user first. The guide is explicit that *"Resolving the user inside the exported getter is what makes that safe."*

**★ Putting an email, a token or a tenant secret into a `cacheTag` or a cached function's arguments.**
Neither is hashed. The default cache holds them as plain-text map keys and tag lists, and a remote cache receives them the same way — into shared storage with whatever access controls and retention that store has. Tag on an opaque stable identifier: `notes:${userId}`, never `notes:${email}`.

**★ Forgetting that *captured variables* also enter the cache key.**
The warning covers *"a cached function's arguments and captured variables"*. A cached helper that closes over a bearer token to build a request header has serialized that token into the key. Pass only what the function needs, and construct credentials inside the function rather than closing over them.

**★ Reading `userId` from `formData` in a Server Action.**
A Server Action is a public HTTP endpoint; the client controls every field it posts. Reading the id from the request lets anyone write to — and invalidate the cache of — any account. Re-read the session inside the action, exactly as the documented example does, and build the tag from the server-derived id.

**★ Setting `cacheLife` with a `stale` under 30 seconds and silently losing prefetching.**
Below that threshold the scope drops out of prefetching entirely, and the authenticated navigation that used to be instant starts waiting on the server. Nothing errors; the page simply gets slower after a "tuning" commit. Keep `stale` at 30 seconds or more on anything you want prefetched.

**★ Putting `prefetch={true}` on every link in a list.**
Per-link prefetching costs one server invocation per link. A sidebar of fifty `/chat/[id]` links renders fifty extra server renders on page load. Use it on the small number of links a user is genuinely likely to click next, not as a global setting.

**★ Expecting a plain `'use cache'` entry to be there on the next request in serverless.**
It is best-effort in-memory storage: *"evicted under pressure and, in serverless, doesn't persist across instances."* A cache profile of `max` does not make it durable. If the data must survive across instances, that is what `'use cache: remote'` is for — and there the key you choose is what determines the hit rate.

**★ Treating a UI-level role check as authorization.**
Hiding a button hides a button. The action behind it is still an addressable endpoint, and so is every Route Handler. The guide's pitfall list says it directly: *"UI checks hide elements, but they don't protect data. Re-verify the session in every Server Action and Route Handler, close to the data."*

**★ Calling `updateTag` with a tag no cached read ever set.**
`updateTag` refreshes entries carrying a matching `cacheTag`. If the read was never wrapped in a cached scope, or the tag string drifted between the read and the write, the call succeeds and does nothing — and the stale value keeps being served. Define the tag once in a shared helper so the read and the write cannot disagree.

## Interview questions

**★ Why is the user promise passed to context without being awaited?**
Because awaiting it in the creating component blocks that component and its whole subtree. React serializes an unawaited promise into the RSC payload; each consumer calls `use()` on it and suspends individually behind its own boundary. The result is that the provider and the shared chrome render immediately while only the components that actually display user data wait.

**★ Why does the exported data function take no arguments?**
So that the session is the only source of identity. `getNotes()` resolves the user internally and calls an unexported `getNotesByUserId(user.id)`. If the id-taking function were exported, any caller could pass any id and receive cached data for another user — an authorization bypass with a cache accelerating it.

**★ Cache keys and tags are stored in plain text. What are the two consequences most people miss?**
First, it is not only arguments: *"a cached function's arguments and captured variables are serialized into its cache key"*, so a closed-over token is in the key too. Second, a remote cache receives them the same way — so the plain text lives in shared external storage under that store's access controls and retention, readable by anyone who can enumerate keys.

**★ Compare the three cache directives as storage tiers.**
Plain `'use cache'` stores on the server in memory, best-effort: evicted under pressure and not shared across serverless instances, so it is a hot-path accelerator rather than a store. `'use cache: remote'` stores durably in shared storage across instances and requests, and there the cache key drives the hit rate. `'use cache: private'` stores only in browser memory, does not survive a reload, and is the only one that may read `cookies()`, `headers()` and `searchParams`. `connection()` is prohibited in all of them.

**★ Why re-read the session inside a Server Action rather than trusting what the form posted?**
Because a Server Action is a public HTTP endpoint and every field the client sends is attacker-controlled. Reading `userId` from `formData` lets anyone write to any account and invalidate any user's cache tags. The action must authorize itself against the session, and the cache tag must be built from the server-derived id.

**★ What is the Data Access Layer pattern, and what does it buy you here?**
One function reads the session, validates it and returns a narrow user; every other component calls that function rather than reading the session itself. It buys a single auditable location for authorization and a single place where the shape crossing the server/client boundary is decided. Reviewing authorization becomes reading one file rather than auditing every component that renders user data.

**★ Authenticated navigations became slow after a performance-tuning commit that only changed `cacheLife`. What happened?**
The `stale` value was lowered below 30 seconds, and below that threshold the scope drops out of prefetching. The per-session App Shell that used to be prefetched and cached is no longer being fetched ahead of the click, so every navigation waits on the server. Nothing errors — it is a threshold, not a validation.

**★ When is `<Link prefetch={true}>` worth it, and what does it cost?**
It is for routes that depend on the URL — a `params` or `searchParams` value — where the per-session App Shell alone is not enough, and it needs Partial Prefetching enabled on the destination. It costs one server invocation per link, so it belongs on a small number of high-intent links. On a list of fifty items it turns one page render into fifty-one.

**★ Why does `updateTag` sometimes appear to do nothing?**
Because it only refreshes cache entries carrying a matching `cacheTag`, and there are two ways to have none: the read was never inside a cached scope (an uncached read has no tag to update), or the tag string differs between the read and the write. Defining the tag once in a shared module — the same helper used by `cacheTag` and by `updateTag` — removes the second failure entirely.

{/* FOOTER */}
