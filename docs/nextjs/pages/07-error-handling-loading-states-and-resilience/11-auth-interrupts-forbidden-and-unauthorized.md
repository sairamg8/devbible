---
title: "`unauthorized()` and `forbidden()` are the 401 and 403 halves of the error model, and where you check decides the status code"
sidebar_label: "11 · Auth interrupts: 401 and 403"
sidebar_position: 31
description: "The experimental authInterrupts flag, unauthorized.js and forbidden.js, and the streaming trade-off between a visible shell and a real status code."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js API references for
> [`unauthorized`](https://nextjs.org/docs/app/api-reference/functions/unauthorized) and
> [`forbidden`](https://nextjs.org/docs/app/api-reference/functions/forbidden).
> Target: **Next.js 16.3.4**, App Router.
> 🔴 **Both functions are experimental and explicitly not recommended for production.**

**`notFound()` has had a file convention since the App Router shipped; the two access-control
cases did not, and people improvised them with redirects.** `unauthorized()` renders a 401 for
a request that is not signed in, `forbidden()` renders a 403 for one that is signed in but
lacks the role. Both terminate rendering of their route segment, both inject
`<meta name="robots" content="noindex" />`, and both pair with a file convention —
`unauthorized.js` and `forbidden.js`. They also share a trap that has nothing to do with auth:
**where you put the check decides whether the user sees a page shell or whether the response
carries a real status code, and you cannot have both.**

## Enabling them

Both sit behind one experimental flag:

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
}

export default nextConfig
```

Both can be invoked in **Server Components, Server Functions, and Route Handlers**.

## The two cases

| | Meaning | Throws | Renders |
|---|---|---|---|
| `unauthorized()` | Not signed in | `NEXT_HTTP_ERROR_FALLBACK;401` | `unauthorized.js` |
| `forbidden()` | Signed in, wrong role | `NEXT_HTTP_ERROR_FALLBACK;403` | `forbidden.js` |

```tsx filename="app/dashboard/page.tsx"
import { verifySession } from '@/app/lib/dal'
import { unauthorized } from 'next/navigation'

export default async function DashboardPage() {
  const session = await verifySession()
  if (!session) {
    unauthorized()
  }
  return (
    <main>
      <h1>Welcome to the Dashboard</h1>
      <p>Hi, {session.user.name}.</p>
    </main>
  )
}
```

```tsx filename="app/admin/page.tsx"
import { verifySession } from '@/app/lib/dal'
import { forbidden } from 'next/navigation'

export default async function AdminPage() {
  const session = await verifySession()
  if (session.role !== 'admin') {
    forbidden()
  }
  return <main><h1>Admin Dashboard</h1></main>
}
```

The `unauthorized.js` page is a natural place to put the login form, so an unauthenticated
visitor gets a way forward rather than a dead end:

```tsx filename="app/unauthorized.tsx"
import Login from '@/app/components/Login'

export default function UnauthorizedPage() {
  return (
    <main>
      <h1>401 - Unauthorized</h1>
      <p>Please log in to access this page.</p>
      <Login />
    </main>
  )
}
```

Both also work in Server Actions and Route Handlers, which is where they earn their keep — the
same helper that guards the page guards the mutation and the endpoint:

```ts filename="app/actions/update-profile.ts"
'use server'
import { verifySession } from '@/app/lib/dal'
import { unauthorized } from 'next/navigation'

export async function updateProfile(data: FormData) {
  const session = await verifySession()
  if (!session) {
    unauthorized()
  }
  // proceed with mutation
}
```

## The streaming trade-off — the part that is actually a decision

To keep the shell and loading UI visible while the session is checked, put the check in the
**Data Access Layer** function that loads the data, and render that inside `<Suspense>`:

```tsx filename="app/account/page.tsx"
import { Suspense } from 'react'
import { verifySession } from '@/app/lib/dal'
import { unauthorized } from 'next/navigation'

async function getAccount() {
  const session = await verifySession()
  if (!session) {
    unauthorized()
  }
  return db.accounts.findByUserId(session.userId)
}

async function AccountDetails() {
  const account = await getAccount()
  return <p>Signed in as {account.email}</p>
}

export default function AccountPage() {
  return (
    <main>
      <h1>Account</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <AccountDetails />
      </Suspense>
    </main>
  )
}
```

The exception propagates to the nearest `unauthorized` boundary, which renders in place of the
streamed-in content **even though the shell has already been sent**.

🔴 **And that is the cost.** Because the check ran inside the Suspense boundary, the response
already began streaming as a **`200`**, and **the status cannot change once streaming has
started**. The user sees the right UI; a machine reading the status code sees success.

| Where the check runs | Shell visible | Real status code |
|---|---|---|
| Inside `<Suspense>` (in the DAL) | ✅ | ❌ — already committed to `200` |
| In `proxy` (before the response streams) | ❌ | ✅ `401` / `403` |

For a page rendered to a human, the first is usually fine. **To return a real status code the
check has to run before the response streams — which means `proxy`.** And note what Cache
Components does to this: **every dynamic route streams a static shell first**, so under Cache
Components the "already streaming" case is the normal one, not the exception.

## Version history

| Version | Change |
|---|---|
| `v15.1.0` | `unauthorized` and `forbidden` introduced |

## Gotchas

### Shipping them to production

**Symptom.** A behaviour change on a framework upgrade, in the auth path.

**Cause.** Both are **experimental and subject to change**, and the docs say plainly they are
not recommended for production.

**Fix.** Treat them as a preview. If you adopt them, isolate the calls behind your own DAL
helpers so a rename or signature change is one file, not fifty.

### Expecting a real 401 from a check inside `<Suspense>`

**Symptom.** The 401 page renders correctly and monitoring reports a healthy `200`.

**Cause.** The response began streaming before the check ran, and the status cannot change
after that.

**Fix.** Decide which you need. Human-facing page → keep the check in the DAL and accept the
`200`. Machine-readable status → run the check in `proxy`, before streaming begins.

### Assuming this is an edge case under Cache Components

**Symptom.** Status codes silently become `200` across the app after enabling
`cacheComponents`.

**Cause.** With Cache Components, **every dynamic route streams a static shell first**, so
almost every check now runs after streaming has started.

**Fix.** If status codes matter, move the checks to `proxy` as part of adopting Cache
Components — not after someone notices.

### Using `forbidden()` for an unauthenticated request

**Symptom.** Signed-out users get a 403 dead end instead of a login prompt.

**Cause.** The two cases were collapsed. 401 means *we do not know who you are*; 403 means *we
know, and no*.

**Fix.** `unauthorized()` when there is no session, `forbidden()` when there is one and the
role is insufficient. Only the first has a useful next action for the user.

### Guarding the page but not the action

**Symptom.** The UI is unreachable, and the mutation behind it is not.

**Cause.** The check was treated as a rendering concern. A Server Action is a separate entry
point and is callable without ever rendering the page.

**Fix.** Call the same guard in the Server Action and the Route Handler, as in
`updateProfile` above. Authorization belongs in the data access layer, which every entry point
goes through.

## Interview questions

**★ What do `unauthorized()` and `forbidden()` do?**
Throw `NEXT_HTTP_ERROR_FALLBACK;401` / `;403`, terminate rendering of the route segment, inject
`<meta name="robots" content="noindex" />`, and render `unauthorized.js` / `forbidden.js`.

**★ What is their stability status?**
**Experimental**, behind `experimental.authInterrupts`, and explicitly not recommended for
production.

**★ When did they arrive?**
`v15.1.0`.

**★ Where can they be called?**
Server Components, Server Functions, and Route Handlers.

**★ Why might a 401 page be served with a 200 status?**
Because the check ran inside a `<Suspense>` boundary, after the response began streaming. The
status cannot change once streaming has started.

**★ How do you get a real 401 or 403 status?**
Run the check before the response streams — in `proxy`.

**★ What does Cache Components do to this trade-off?**
It makes the streaming case the default: every dynamic route streams a static shell first, so
checks in the render path will almost always be too late for the status code.

**★ When is 403 the right code rather than 401?**
When the request **is** authenticated but lacks the required role. 401 is for requests that are
not signed in — and it is the one with a useful next action, so `unauthorized.js` is where a
login form belongs.

**★ Is guarding the page enough?**
No. A Server Action is a separate entry point, callable without rendering the page. Put the
guard in the DAL so every entry point passes through it.

---

**Previous:** [10d · `global-error` and what it does not inherit](10d-global-error-and-what-it-does-not-inherit.md) · **Next:** [11b · They work by throwing, and that breaks four things](11b-auth-interrupts-throw.md)
