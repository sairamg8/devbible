---
title: "An action's return value is a public API and its invocation rate is unbounded — shape what comes back into a DTO, fail loudly on destructive paths, and build the rate limit yourself because there is no 429 to return"
sidebar_label: "02f · Return values and limits"
sidebar_position: 20
description: "Why returning an ORM row leaks columns, React's taint APIs as a second layer, error messages that expose internals, loud failure on destructive operations and authInterrupts, and rate limiting an entry point that cannot set a status code."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Controlling return values*, § *Tainting*, § *Rate limiting*), [Next.js · Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (§ *Security*) and [Next.js · Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (§ *Public Endpoints*, § *Rate limiting*) — all `version: 16.3.4`.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**The two obligations on the outbound side of an entry point are easy to skip because neither produces a failing test. What an action returns is serialised straight to the browser, so an ORM row returned by reflex publishes every column the schema has grown; and no framework limits how often anyone may invoke it, so an action that sends an email is an email cannon until you make it not one. Both cost one line to get wrong and both are invisible in the happy path.**

## Return values are a client-visible surface

> *"Server Action return values are serialized and sent to the client. Only return what the UI needs, not raw database records."*

> *"**Constrain return values.** Action returns are serialized to the client. Shape them to what the UI renders, not raw database records."*

```tsx
'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// BAD: Returns the full database record, which may include
// internal fields the client should not see.
export async function updateUser(data: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return db.user.update({
    where: { id: session.user.id },
    data: { name: data.get('name') as string },
  })
}

// GOOD: Returns only what the client needs.
export async function updateUserSafe(data: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  await db.user.update({
    where: { id: session.user.id },
    data: { name: data.get('name') as string },
  })
  return { success: true }
}
```

The distance between the two is one keyword: `return db.user.update(...)` versus `await db.user.update(...)`. The difference is whether `passwordHash`, `stripeCustomerId`, `internalNotes`, `deletedAt` and every column added next quarter arrive in the browser. Nothing warns you — the types are a faithful description of the row, the tests assert on the fields the UI reads, and the leak is visible only in a network trace.

The same rule governs the *inbound* end of the render pipeline, which is why a Data Access Layer returns DTOs rather than rows:

> *"A Data Access Layer should: Only run on the server. Perform authorization checks. Return safe, minimal **Data Transfer Objects (DTOs)**."*

## Tainting is a net, not the floor

```js
// next.config.js
module.exports = {
  experimental: {
    taint: true,
  },
}
```

> *"To prevent accidental exposure of private data to the client, you can use React Taint APIs: `experimental_taintObjectReference` for data objects. `experimental_taintUniqueValue` for specific values."*

> *"This prevents the tainted objects or values from being passed to the client. However, it's an additional layer of protection, you should still filter and sanitize the data in your [DAL](#data-access-layer) before passing it to React's render context."*

```ts
// data/users.ts
import 'server-only'
import { experimental_taintObjectReference as taintObjectReference } from 'react'
import { db } from '@/lib/db'

async function getUserRow(id: string) {
  const row = await db.user.findUniqueOrThrow({ where: { id } })
  taintObjectReference(
    'Do not pass the full user row to the client. Use getUserDTO instead.',
    row
  )
  return row
}

export async function getUserDTO(id: string) {
  const row = await getUserRow(id)
  return { id: row.id, name: row.name, avatarKey: row.avatarKey }
}
```

Two adjacent facts worth knowing, both from the same note:

> *"By default, environment variables are only available on the Server. Next.js exposes any environment variable prefixed with `NEXT_PUBLIC_` to the client."*

> *"Functions and classes are already blocked from being passed to Client Components by default."*

The second is why the docs' DAL example says *"Use classes to avoid accidentally passing the whole object to the client"* — a class instance cannot cross the boundary at all, so modelling the current user as a `User` instance makes the leak a build-time impossibility rather than a review item.

## Error messages leak too

> *"Avoid exposing sensitive information in error messages sent to the client."*

An action that throws sends *something* to the client, and a `PrismaClientKnownRequestError` message can carry table names, column names and constraint names. A handler that echoes `reason.message` into a 500 body does the same:

```ts
// app/api/submit/route.ts
import { submit } from '@/lib/submit'

// The documented shape — note it returns the message, which is fine only when
// the messages are yours.
export async function POST(request: Request) {
  try {
    await submit(request)
    return new Response(null, { status: 204 })
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error'

    return new Response(message, { status: 500 })
  }
}
```

```ts
// safer for anything that touches a driver: map, log, and return a code
import { submit } from '@/lib/submit'

class PublicError extends Error {}

export async function POST(request: Request) {
  try {
    await submit(request)
    return new Response(null, { status: 204 })
  } catch (reason) {
    if (reason instanceof PublicError) {
      return Response.json({ error: reason.message }, { status: 400 })
    }
    console.error('submit failed', reason)          // full detail server-side only
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

## Destructive operations, and the value of failing loudly

> *"Destructive operations like deletes may warrant stronger handling, such as elevated session checks or re-authentication, and a loud failure when those checks miss."*

> *"If you've enabled the experimental `authInterrupts` flag, you can throw `unauthorized()` and `forbidden()` from `next/navigation` instead, so Next.js renders the corresponding `unauthorized.tsx` / `forbidden.tsx` UI segment automatically."*

"Loud failure" is the part people skip. A check that returns `null` on failure and a check that throws are indistinguishable in the happy path, and behave very differently the day the condition is inverted — one renders an empty state nobody investigates, the other pages someone.

## Rate limiting, and the fact that an action cannot return a 429

A handler answers with a status code. The documented shape:

```ts
// app/resource/route.ts
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const { rateLimited } = await checkRateLimit(request)

  if (rateLimited) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  return new Response(null, { status: 204 })
}
```

An action returns a serialised value, not a `Response`, so it has no status code to set. The equivalent is a failure state the form renders, or a throw:

```ts
// app/contact/actions.ts
'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { consumeToken } from '@/lib/rate-limit'
import { deliverMessage } from '@/data/messages'

export async function sendMessageAction(_prev: unknown, formData: FormData) {
  const session = await auth()
  const key = session?.user?.id ?? (await headers()).get('x-forwarded-for') ?? 'anon'

  if (!(await consumeToken(`contact:${key}`, { limit: 5, windowSeconds: 60 }))) {
    return { error: 'Too many messages. Try again in a minute.' }
  }

  await deliverMessage(String(formData.get('body')))
  return { error: null }
}
```

⚠️ Keying on `x-forwarded-for` is meaningful only if a proxy you control sets it and strips client-supplied copies; otherwise the attacker chooses their own bucket. The documentation recommends both layers:

> *"You can implement rate limiting in your Next.js backend. In addition to code-based checks, enable any rate limiting features provided by your host."*

The host-level limit is the one that matters for cost, because it rejects the request before your function is invoked at all — on a serverless platform, a limit inside the function has already paid for the cold start.

⚠️ One structural mitigation is free and often overlooked: actions are dispatched **one at a time per client** ([02g](02g-sequential-dispatch-and-the-single-response.md)), so a single browser tab cannot flood you with concurrent action invocations. That is a property of the client dispatcher, not of the endpoint — a script bypassing the dispatcher has no such constraint, and neither does a second tab.

## Gotchas

**★ Symptom: a network trace shows `passwordHash` and `stripeCustomerId` arriving in the browser after a profile save.** Cause: the action returned the ORM's updated row. Fix: return a deliberately-constructed DTO and never `return` an ORM call directly.

```ts
'use server'
import { updateProfileInDal } from '@/data/users'

export async function updateProfile(formData: FormData) {
  const user = await updateProfileInDal(formData)   // full row, stays server-side
  return { id: user.id, name: user.name }           // DTO crosses the wire
}
```

**★ Symptom: a database error message showing a constraint name appears in the browser's error overlay or a 500 body.** Cause: the raw `Error.message` from a driver was passed through. Fix: classify errors — return your own messages for expected failures, log the rest and return a generic code.

**★ Symptom: an authorisation failure returns `null`, the UI renders an empty state, and nobody notices for six months that the condition is inverted.** Cause: silent failure on a security path. Fix: throw — or with `authInterrupts` enabled, throw `forbidden()` so a dedicated segment renders and the event is distinguishable from "no data".

```ts
'use server'
import { forbidden } from 'next/navigation'   // requires experimental.authInterrupts

export async function archiveProject(projectId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (!(await canArchive(session.user, projectId))) forbidden()
  await db.project.update({ where: { id: projectId }, data: { archived: true } })
}
```

**★ Symptom: a "send invitation email" action is used to send thousands of emails from one account.** Cause: no rate limit, and the framework provides none. Fix: a limiter keyed on the session, checked before the expensive work, plus a host-level limit in front of the function.

```ts
'use server'
import { auth } from '@/lib/auth'
import { consumeToken } from '@/lib/rate-limit'
import { sendInvite } from '@/data/invites'

export async function inviteAction(_prev: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  if (!(await consumeToken(`invite:${session.user.id}`, { limit: 20, windowSeconds: 3600 }))) {
    return { error: 'Invitation limit reached for this hour.' }
  }

  await sendInvite(session.user.id, String(formData.get('email')))
  return { error: null }
}
```

**★ Symptom: the rate limiter is trivially bypassed by changing a header.** Cause: the key was `x-forwarded-for`, which is client-supplied unless a trusted proxy overwrites it. Fix: prefer the session id; fall back to the forwarded address only where your own proxy sets it, and treat anonymous traffic as a case for a host-level limit rather than an application one.

**Symptom: a delete succeeds, then a support ticket says the wrong record vanished, and the logs cannot say who asked.** Cause: the authorisation decision was made and discarded. Fix: have destructive DAL functions return what they acted on and log the session id alongside it — a `deleteMany` with an ownership predicate yields `count`, which distinguishes "denied" from "already gone".

**Symptom: tainting is enabled and a value still reaches the client.** Cause: taint is applied to a *reference*, so a copy — a spread, a `JSON.parse(JSON.stringify(row))`, a field plucked into a new object — is untainted. Fix: taint the unique value as well as the object where the value itself is the secret, and keep constructing DTOs regardless; the docs call taint *"an additional layer of protection"*, not the mechanism.

## Interview questions

**★ Why is `return db.user.update(...)` from an action a security bug rather than a style issue?**
Because action return values are serialised and sent to the client, so the ORM's return shape becomes a public API. `update` returns the whole row, including every column the schema has grown: password hashes, billing identifiers, internal flags, soft-delete markers. Nothing warns you — the types are accurate, the tests assert on the fields the UI uses, and the leak appears only in a network trace. The rule is to return a constructed DTO, and the documented audit question is exactly *"Are return values filtered to only what the client needs?"*

**★ How do you rate-limit a Server Action, given it cannot return a 429?**
An action returns a serialised value, not a `Response`, so there is no status code to set — you either throw or return a failure state the form renders through `useActionState`. The harder half is the key: a session user id is trustworthy, a proxy-set `x-forwarded-for` is trustworthy only if the proxy is yours and strips client copies, and anonymous traffic may not be identifiable at the application layer at all. The docs recommend both layers — code-based checks plus *"any rate limiting features provided by your host"* — because a host-level limit rejects the request before the function is invoked, which is the only place a limit saves you the cost of invoking it.

**★ What does React's taint API buy you, and why is it not the fix?**
`experimental_taintObjectReference` and `experimental_taintUniqueValue`, enabled via `experimental.taint`, mark objects and values so React refuses to serialise them across the server/client boundary. That is a real net for the prop or return value you forgot. It is not the fix because it is a *last* line and it works on references — the docs say it is *"an additional layer of protection, you should still filter and sanitize the data in your DAL before passing it to React's render context."* Constructing a DTO means there was never a full row in render scope to forget in the first place; taint catches the case where there was.

**Does the sequential dispatch of Server Actions count as rate limiting?**
Only against the honest case. The client dispatcher sends one action at a time per client, so a single tab cannot issue concurrent invocations — which does bound accidental floods from a UI with an over-eager `onChange`. It is not a security control: the docs describe it as *"a property of the client dispatcher, not of Server Functions in general"*, and an attacker POSTing action IDs directly never touches the dispatcher. It also does nothing about a second tab, a second browser, or a botnet. Treat it as an ergonomic property with a pleasant side effect, and put a real limiter on anything expensive.

**What is the difference between a "loud failure" and a thrown error, and why does it matter more for deletes?**
A loud failure is one that is *observable and distinguishable* — a thrown error, a `forbidden()` interrupt, a logged event with the session id and the affected count. A quiet `return` renders an empty state and is indistinguishable from "there was nothing to show". It matters more for destructive operations because the failure modes are asymmetric: a read that wrongly denies is a support ticket, a delete that wrongly permits is unrecoverable, and a delete that wrongly denies looks exactly like "the record was already gone". Returning `count` from a `deleteMany` guarded by an ownership predicate is the cheapest way to get that distinction into your logs.

**What is wrong with echoing `reason.message` into a 500 response, given the Next.js docs show exactly that?**
Nothing, *if the messages are yours*. The BFF guide's `try/catch` example is illustrating error handling, and it pairs it with the instruction to *"avoid exposing sensitive information in error messages sent to the client."* The problem arises when the thrown error came from a layer you did not write: driver errors carry table, column and constraint names, connection errors can carry hostnames, and a validation library can echo the input back. The robust shape is a `PublicError` class you throw deliberately, returned to the client verbatim, with everything else logged server-side and answered with a generic code.

---

← [02e · Authn and authz per entry point](02e-authentication-and-authorisation-at-the-entry-point.md) · Next → [02g · Sequential dispatch and the single response](02g-sequential-dispatch-and-the-single-response.md)
