---
sidebar_position: 12
title: "With Cache Components on, a session read cannot be prerendered — so authenticated UI stops being part of the page and becomes something that streams into it"
sidebar_label: "Auth with Cache Components: the session read"
description: "Why 'use cache' cannot read cookies, what 'use cache: private' is actually for, how to stream authenticated UI behind Suspense without holding the layout, and the instant=false migration valve."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to implement authentication with Cache Components](https://nextjs.org/docs/app/guides/authentication-with-cache-components) (docs `lastUpdated` 2026-08-25), [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private), [Authentication](https://nextjs.org/docs/app/guides/authentication), [Data Security](https://nextjs.org/docs/app/guides/data-security), and the [`with-iron-session-cache-components` example](https://github.com/vercel/next.js/tree/canary/examples/with-iron-session-cache-components).
> Target: **Next.js 16.3.4** (16.3 = Active LTS). Node.js `>= 20.9`. Requires `cacheComponents: true`.

**Cache Components draws a line that authentication sits exactly on top of. A cached scope cannot read the request, and a session lives in the request. The framework's answer is not a workaround but a third directive: `'use cache: private'` reads `cookies()`, `headers()` and `searchParams`, gives the result a cache lifetime so navigations can be prefetched, and never stores a byte of it on the server. Understanding *why* the server-side directives cannot do this job — and it is not simply "cookies are dynamic" — is what makes the rest of the pattern obvious.**

## The premise

> *"With Cache Components enabled, a session read happens at request time, so it can't be prerendered into the static shell. Authenticated UI streams in behind a `<Suspense>` boundary instead, and data derived from the session can still be cached."*

Enable the flag first:

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

The directives themselves — plain `'use cache'`, `'use cache: remote'` and `'use cache: private'` — are covered in depth in **chapter 5, the cache directives** *(not written yet)*. What matters here is the one rule that shapes every auth decision: `'use cache'` **forbids** `cookies()`, `headers()` and `searchParams`; `'use cache: private'` **allows** all three but never persists server-side; and `connection()` is prohibited in **both**.

## Why the server-side directives genuinely cannot do this

The guide does not stop at "it throws". It gives two reasons that survive every clever workaround:

> *"neither a plain `use cache` nor `use cache: remote` can call `cookies()`, and you can't extract the value and pass it in either, because:"*

> *"A session helper reads the cookie deep inside its own code, so there's nothing to lift out."*

> *"Validating it compares a token's expiry against the current time (iron-session's `unsealData` rejects an expired seal), so the read is request- and time-dependent."*

The first kills the obvious refactor: you cannot hoist the cookie read out of `getSession()` because your auth library owns that code. The second kills the clever one: even if you *could* pass the raw cookie in as an argument, validation compares a token's expiry against the current time, so the same input produces different answers at different moments — which is the definition of an uncacheable function.

> *"That's what `use cache: private` is for: it reads `cookies()` and `headers()` directly, keeping the result in the browser only, never on the server."*

And the boundary of what the private cache stores:

> *"The `'use cache: private'` directive allows functions to access runtime request APIs like `cookies()`, `headers()`, and `searchParams` within a cached scope. However, results are **never stored on the server**, they're cached only in the browser's memory and do not persist across page reloads."*

Browser memory, gone on reload. That is not a weaker cache — it is a different one, and it is the correct storage tier for "who is this person" precisely because it is not shared and not durable.

## Step 1 — the session read

```tsx filename="lib/session.ts"
import 'server-only'
import { cookies } from 'next/headers'
import { sealData, unsealData } from 'iron-session'

export type SessionData = {
  userId?: string
}

const COOKIE_NAME = 'app_session'
const password = process.env.SESSION_PASSWORD!

export async function getSession(): Promise<SessionData> {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value
  if (!cookie) {
    return {}
  }
  return unsealData<SessionData>(cookie, { password })
}
```

```tsx filename="lib/auth.ts"
import 'server-only'
import { redirect } from 'next/navigation'
import { getSession } from './session'
import { findUserById } from './data'

export type User = {
  id: string
  name: string
}

export async function getCurrentUser(): Promise<User> {
  'use cache: private'

  const { userId } = await getSession()
  if (!userId) {
    redirect('/login')
  }

  const user = await findUserById(userId)
  if (!user) {
    redirect('/login')
  }

  return { id: user.id, name: user.name }
}
```

The detail that makes this safe:

> *"The `redirect()` calls throw to interrupt rendering rather than return a value, so they aren't cached. Only a resolved user is."*

A `redirect()` inside a cached scope is not a cached "no". It throws, the scope produces no value, and the next request re-evaluates. A logged-out state is never memoised as a result.

`import 'server-only'` on both files is not decoration. It makes an accidental import from a Client Component a build error rather than a bundle that leaks `SESSION_PASSWORD` to the browser.

## Step 2 — stream it, do not block on it

> *"A component that reads the session must sit behind a `<Suspense>` boundary. With Cache Components, reading `cookies()` outside a boundary is a build error. The boundary is also what keeps the rest of the page fast. Anything outside it prerenders into the static shell and loads instantly, as long as it's static or wrapped in `use cache` and doesn't read runtime data of its own. Only the section behind the boundary waits for the request."*

```tsx filename="app/page.tsx"
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { getAnnouncements } from '@/lib/data'

export default function Page() {
  return (
    <main>
      {/* Cached, so it prerenders into the static shell */}
      <Announcements />

      {/* Reads the session, so it streams in behind the boundary */}
      <Suspense fallback={<p>Loading your dashboard…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  )
}

async function Announcements() {
  'use cache'
  const announcements = await getAnnouncements()
  return (
    <ul>
      {announcements.map((announcement) => (
        <li key={announcement}>{announcement}</li>
      ))}
    </ul>
  )
}

async function Dashboard() {
  const user = await getCurrentUser()
  return <h1>Welcome, {user.name}</h1>
}
```

And the placement rule that decides whether any of this helps:

> *"Keep the session read out of a layout's top level, too. A top-level `await` on the session in a layout holds the whole segment, including `{children}`, behind that request, so push it into a component inside a boundary."*

This is the single highest-leverage sentence in the guide. A layout that awaits the session at its top level converts every page under it into a fully blocked render. The static shell disappears, not because any page did something wrong, but because their shared parent did.

## Migrating an existing application

> *"With Cache Components enabled, instant navigation validation flags every route that reads the session, because a request read can't be prerendered into the static shell. You don't have to resolve them all before shipping. Set `export const instant = false` on the page or layout to let it keep blocking on the server, then adopt the patterns below one route at a time."*

```tsx
export const instant = false
```

That is the migration valve. The validator's job is to tell you which routes are blocking; `instant = false` acknowledges a route and defers it, so a large application can adopt the flag without a big-bang rewrite.

## Gotchas

**★ Awaiting the session at the top of a layout and losing the static shell for every page beneath it.**
A top-level `await getCurrentUser()` in a layout holds the whole segment — `{children}` included — behind the request. Every page under that layout becomes fully blocking, and no individual page's code shows why. Push the read into a component inside a `Suspense` boundary:

```tsx
export default function Layout({ children }) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <UserHeader />
      </Suspense>
      {children}
    </>
  )
}
```

**★ Trying to make a plain `'use cache'` function cacheable by passing the cookie in as an argument.**
It does not work, for two independent reasons the guide names: the cookie read lives deep inside your auth library so there is nothing to lift out, and validation compares the token's expiry against the current time, so the same argument yields different results at different moments. `'use cache: private'` exists for exactly this.

**★ Expecting `'use cache: private'` results to survive a page reload.**
They are held in browser memory only and *"do not persist across page reloads"*. Treat it as a per-navigation memo, not as storage. Anything that must survive a reload has to be re-derived — which is fine, because the session cookie is still there.

**★ Calling `connection()` inside either cache directive.**
It is prohibited in both plain `'use cache'` and `'use cache: private'`, because connection-specific information cannot be safely cached under any policy. If a page needs `connection()` — as a nonce-bearing CSP page does — that render is not cacheable at all, and the two features cannot be combined on the same component.

**★ Reading `cookies()` outside a Suspense boundary with Cache Components enabled.**
It is a **build error**, not a runtime one — which is the good outcome, because it surfaces during CI rather than in production. The fix is always the same: move the read into a component and wrap that component in `Suspense`.

**★ Omitting `import 'server-only'` from the session and auth modules.**
Without it, an accidental import from a Client Component compiles, and the bundle now contains your session password and your database access code. With it, the same mistake is a build error. It costs one line per file.

**★ Assuming a cached `redirect('/login')` will cache the logged-out state.**
It will not, and that is deliberate: `redirect()` throws to interrupt rendering rather than returning a value, so the private cache stores nothing. Only a resolved user is cached. This is why the guard can live *inside* the cached function rather than needing to wrap it.

**★ Treating instant-navigation validation errors as a blocker for adopting Cache Components.**
Every route that reads the session will be flagged, because a request read cannot be prerendered. `export const instant = false` on the page or layout defers a route while you migrate the rest, which is how the guide explicitly recommends approaching an existing application.

## Interview questions

**★ Why can't a plain `'use cache'` function read the session, and why isn't "pass the cookie in as an argument" a fix?**
Because `cookies()`, `headers()` and `searchParams` are forbidden inside a plain `'use cache'` scope — the result would be shared server-side across users. Passing the cookie in fails for two further reasons the guide states: the cookie read happens deep inside the auth library's own code, so there is nothing to hoist out; and validation compares the token's expiry to the current time, making the function time-dependent as well as request-dependent. A function whose output varies with the clock is not cacheable on any key.

**★ What exactly is `'use cache: private'`, and where does its result live?**
A cache scope that may read `cookies()`, `headers()` and `searchParams`, whose results are *"never stored on the server"* and are held only in the browser's memory, not surviving a page reload. It exists so that a request-dependent read can still have a cache lifetime — which is what lets a route's authenticated App Shell be prefetched — without any per-user data being written to shared server storage. `connection()` remains prohibited.

**★ Why must authenticated UI sit behind Suspense, and what is the cost of getting the boundary placement wrong?**
Because a session read happens at request time and cannot be prerendered into the static shell, so with Cache Components enabled reading `cookies()` outside a boundary is a build error. Placement matters because everything outside the boundary prerenders and loads instantly. A session read at the top level of a layout holds the entire segment including `{children}`, so every page under it loses its static shell — and nothing in those pages' own code explains why.

**★ A `redirect('/login')` sits inside a `'use cache: private'` function. Is the redirect cached?**
No. `redirect()` throws to interrupt rendering rather than returning a value, so the scope produces no cacheable result and only a resolved user is ever stored. That is what makes it safe to put the authorization guard inside the cached function instead of wrapping it.

**★ How do you adopt Cache Components in an application whose every route reads the session?**
Incrementally. Instant-navigation validation will flag all of them, which is information rather than a blocker. Set `export const instant = false` on a page or layout to let it keep blocking on the server, then convert routes one at a time to the Suspense-plus-private-cache pattern. The guide explicitly says *"You don't have to resolve them all before shipping."*

**★ What does `import 'server-only'` protect against in the session module?**
An accidental import from a Client Component. Without it, importing `lib/session.ts` from a `'use client'` file compiles successfully and ships `SESSION_PASSWORD` and the session-unsealing logic into the browser bundle. With it, that import is a build error. It is one line and it converts a silent credential leak into a failed CI run.

{/* FOOTER */}
