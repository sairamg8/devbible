---
title: "A mutation may never be a render side-effect, a destructive one needs more than a valid session, and the error a failed action returns is itself a disclosure decision"
sidebar_label: "01b · Mutation shape and failure posture"
sidebar_position: 100
description: "Why Next.js forbids cookie writes and revalidation during render, what elevated checks and a loud failure mean for a delete, and how to decide what a failed action tells the user versus what it tells the log."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`), [`error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error) (`lastUpdated: 2026-07-10`), [Error Handling](https://nextjs.org/docs/app/getting-started/error-handling) (`lastUpdated: 2026-06-10`), [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`lastUpdated: 2026-06-09`), and the React [`<form>`](https://react.dev/reference/react-dom/components/form) reference.
> Target: **Next.js 16.3.4 · React 19.2.8**. Documentation-verified; **no sandbox run**.

**[01](01-server-actions-for-mutations-with-useactionstate-and-useopti.md) put the authorization check in the right file. This page is about the two things that survive a correct check: a mutation triggered from somewhere nobody authorized — rendering — and a mutation that failed and now has to say something. Both are security decisions wearing ordinary clothes. Next.js forbids the first outright, and says nothing at all about the second, which is why the second is where most applications quietly leak.**

## A mutation is never a render side-effect

The data security guide is categorical:

> *"Mutations (e.g. logging out users, updating databases, invalidating caches) should never be a side-effect, either in Server or Client Components. Next.js explicitly prevents setting cookies or triggering cache revalidation within render methods to avoid unintended side effects."*

The failing shape is a mutation driven by a query parameter — which any link prefetcher, corporate mail scanner, browser preload or crawler can trigger with no user present:

```tsx filename="app/page.tsx"
// BAD: Triggering a mutation during rendering
export default async function Page({ searchParams }) {
  if ((await searchParams).logout) {
    const cookieStore = await cookies()
    cookieStore.delete('AUTH_TOKEN')
  }

  return <UserProfile />
}
```

```tsx filename="app/page.tsx"
// GOOD: Using Server Actions to handle mutations
import { logout } from './actions'

export default function Page() {
  return (
    <>
      <UserProfile />
      <form action={logout}>
        <button type="submit">Logout</button>
      </form>
    </>
  )
}
```

**Why render specifically.** A render is not a user decision. It can happen because someone hovered a link, because a retry re-ran a segment, because a prerender pass is warming a shell, or twice for the same page view. A mutation placed there is a mutation nobody asked for at a moment nobody chose. The framework closes the class rather than documenting it — the cookie write throws, and revalidation from render is rejected.

The method is not left to you either:

> *"Next.js uses `POST` requests to handle mutations. This prevents accidental side-effects from GET requests, reducing Cross-Site Request Forgery (CSRF) risks."*

React makes the matching guarantee at the element level — from the `<form>` reference: *"When a function is passed to `action` or `formAction` the HTTP method will be POST regardless of value of the `method` prop."* You cannot accidentally construct a GET mutation out of a Server Action, even by setting `method="get"`.

## What a destructive operation is owed

The Server Actions guide singles out deletes:

> *"Destructive operations like deletes may warrant stronger handling, such as elevated session checks or re-authentication, and a loud failure when those checks miss."*

"Elevated session check" is an application-level idea, not a Next.js API — **the framework provides no step-up primitive**, and nothing in the documentation implies one. The shape that works is a freshness assertion on the session: the Data Access Layer refuses the call unless the caller presented credentials recently.

```ts filename="data/workspace.ts"
import 'server-only'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const REAUTH_WINDOW_MS = 5 * 60 * 1000

export class ReauthRequired extends Error {
  constructor() {
    super('REAUTH_REQUIRED')
  }
}

export async function deleteWorkspace(workspaceId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // `authenticatedAt` is when credentials were last presented, not when the session
  // cookie was last refreshed. Your auth library treats those as different timestamps.
  const authenticatedAt = session.user.authenticatedAt?.getTime() ?? 0
  if (Date.now() - authenticatedAt > REAUTH_WINDOW_MS) {
    throw new ReauthRequired()
  }

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, ownerId: session.user.id },
  })
  if (!workspace) throw new Error('Forbidden')

  await db.workspace.delete({ where: { id: workspace.id } })
}
```

The second half of the quoted sentence is the part people skip — *"a loud failure when those checks miss."* Chapter 07's `completeItem` example returns silently when ownership fails, and that is right for a checkbox nobody should have been able to click: there is nothing useful to say and an error would be noise. It is wrong for a delete. A silent return on a destructive path is indistinguishable from success to the caller and produces no signal for whoever reads the logs, which means a probe against your delete endpoint looks exactly like normal traffic.

## What the failure is allowed to say

Chapter 07 owns the *mechanics* of action error contracts — [expected errors are return values](../07-error-handling-loading-states-and-resilience/01b-expected-errors-are-return-values.md) and [the typed action result](../07-error-handling-loading-states-and-resilience/01c-the-typed-action-result-and-reading-it-back.md). What that chapter deliberately did not ask is the security question: *given that you are returning something, what is it allowed to contain?*

Start from the framework's own split, from the Error Handling guide:

> *"Errors can be divided into two categories: expected errors and uncaught exceptions."*

Expected errors are *"those that can occur during the normal operation of the application, such as those from server-side form validation or failed requests. These errors should be handled explicitly and returned to the client."* Uncaught exceptions are *"unexpected errors that indicate bugs or issues that should not occur during the normal flow of your application."*

**That split is also the disclosure boundary.** An expected error is one you authored, so you know exactly what it reveals. An uncaught exception carries whatever the underlying library decided to put in `message` — a driver's constraint name, a table name, a fragment of SQL, a filesystem path, a URL with a token in the query string. Returning `error.message` to the client turns your dependency's debug output into a public API.

Next.js redacts on the boundary path, and the rule is precise:

> *"Errors forwarded from Client Components show the original `Error` message."*
> *"Errors forwarded from Server Components show a generic message with an identifier. This is to prevent leaking sensitive details. You can use the identifier, under `errors.digest`, to match the corresponding server-side logs."*

⚠️ That is documented for errors that reach an `error.tsx` boundary. **I could not find documentation stating that a Server Action's thrown message is redacted the same way when it is surfaced through your own `catch` and returned as state** — and it obviously is not, because at that point *you* are the one choosing the string. Do not treat redaction as a safety net for a value you return yourself.

The shape that is safe by construction: the DAL throws typed errors, the action maps a known set to user-facing copy, and everything else becomes one opaque message plus a logged cause.

```ts filename="app/workspace/actions.ts"
'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { deleteWorkspace, ReauthRequired } from '@/data/workspace'

export type ActionResult =
  | { ok: true }
  | { ok: false; code: 'REAUTH_REQUIRED' | 'FORBIDDEN' | 'UNEXPECTED'; message: string; ref?: string }

export async function deleteWorkspaceAction(workspaceId: string): Promise<ActionResult> {
  try {
    await deleteWorkspace(workspaceId)
    revalidatePath('/workspaces')
    return { ok: true }
  } catch (error) {
    unstable_rethrow(error)

    if (error instanceof ReauthRequired) {
      return { ok: false, code: 'REAUTH_REQUIRED', message: 'Please confirm your password to continue.' }
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return { ok: false, code: 'FORBIDDEN', message: 'That workspace is not available.' }
    }

    // Everything else: one sentence out, the whole truth into the log.
    const ref = randomUUID()
    console.error('[deleteWorkspaceAction]', { ref, workspaceId, error })
    return { ok: false, code: 'UNEXPECTED', message: `Something went wrong. Reference ${ref}.`, ref }
  }
}
```

Three properties are doing the work. The user-facing string is a constant chosen by you, never a value from a dependency. The `code` is a closed union, so the client can branch on it without parsing prose. And the correlation reference is generated per failure, so support can find the log line without the user ever seeing what it contains — the same trick `error.digest` plays for boundary errors, done by hand because you took the error out of the boundary path.

Note `'That workspace is not available.'` for the forbidden case: it deliberately does not distinguish *does not exist* from *not yours*, matching the ownership-scoped query in [01](01-server-actions-for-mutations-with-useactionstate-and-useopti.md). A message that distinguishes them un-does the query's work.

## Gotchas

**★ Symptom: users are randomly logged out, and it correlates with link hovers or a security scanner sweeping the site.** Cause: a logout implemented as a GET route or a `searchParams` branch, so anything that fetches the URL performs the mutation. Fix: a POST-only path — a `<form action={logout}>` as shown above. The same applies to "unsubscribe", "mark read" and "archive" links.

**★ Symptom: the form shows a database error such as a unique-constraint violation, complete with the index name.** Cause: the catch block returns `error.message` straight through, and the driver wrote that string. Fix: translate known failures, and never forward the raw message.

```ts
// Before
catch (error) {
  return { ok: false, message: (error as Error).message }
}

// After
catch (error) {
  unstable_rethrow(error)
  if (isUniqueViolation(error, 'workspace_slug_key')) {
    return { ok: false, code: 'SLUG_TAKEN', message: 'That URL is already in use.' }
  }
  const ref = randomUUID()
  console.error('[createWorkspace]', { ref, error })
  return { ok: false, code: 'UNEXPECTED', message: `Something went wrong. Reference ${ref}.` }
}
```

**★ Symptom: `redirect('/login')` inside an action's `catch` never redirects; you get a caught error instead.** Cause: `redirect` works by throwing a control-flow exception — *"Because `redirect` throws a control-flow exception, any code after it does not run"* — and your `catch` swallows it. Fix: rethrow framework control-flow errors, or call `redirect` outside the `try`.

```ts
import { redirect, unstable_rethrow } from 'next/navigation'

try {
  await deletePost(postId)
} catch (error) {
  unstable_rethrow(error) // lets redirect/notFound/NEXT_* pass through
  return { ok: false, message: 'Could not delete the post.' }
}
redirect('/posts')
```

See [07 · Control-flow throws and what a catch swallows](../07-error-handling-loading-states-and-resilience/01d-control-flow-throws-and-what-a-catch-swallows.md).

**★ Symptom: a login form reports "no account with that email" for unknown addresses and "incorrect password" for known ones.** Cause: two distinct expected errors mapped to two distinct messages. Together they are an account-enumeration oracle: anyone can test an email list against your login endpoint and learn who has an account. Fix: one message for both, and one code path that costs the same either way.

```ts
const user = await db.user.findUnique({ where: { email } })
// Hash even when the user is absent, so the two paths take comparable work.
const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
if (!user || !ok) {
  return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }
}
```

**Symptom: `cookies().set()` throws inside a Server Component.** Cause: *"Setting cookies is not supported during Server Component rendering."* — and *"HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler."* Fix: move the write into the action.

```ts
'use server'
import { cookies } from 'next/headers'

export async function acceptTerms() {
  const jar = await cookies()
  jar.set('terms', 'v3', { httpOnly: true, sameSite: 'lax', secure: true })
}
```

**Symptom: an action throws for an authorization failure, the whole segment is replaced by the error UI, and the user's typed form input is gone.** Cause: an uncaught throw inside an action propagates to the nearest error boundary, which unmounts the form. Fix: model authorization failures the user can act on as returned state, and reserve throwing for the cases where losing the form is the correct outcome (a revoked session, a deleted resource). Chapter 08's [queuing and errors](../08-state-management-in-an-rsc-world/06b-queuing-and-errors.md) covers what a throw does to a queued `useActionState` dispatch.

**Symptom: the "loud failure" on a destructive path is a `console.error` and nobody has ever seen one.** Cause: in a serverless or containerised deployment `console.error` goes to a stream that is sampled, rotated or simply unread; loudness is a property of the destination, not the call. Fix: route security-relevant failures to something that pages a human or at least aggregates, and give them a stable, greppable event name.

```ts
logger.warn({ event: 'authz.denied', action: 'deleteWorkspace', userId: session?.user?.id, workspaceId })
```

**Symptom: a failed action's message reveals whether a record exists.** Cause: `'Workspace not found'` and `'You do not own this workspace'` are two different strings for two different states. Fix: collapse them, exactly as the ownership-scoped query collapses them in the database.

## Interview questions

**★ Why does Next.js refuse to let you set a cookie or revalidate a cache during render?**
Because rendering is not a user decision. It can be triggered by a prefetch, a retry, a prerender pass, or run more than once for a single page view, so a mutation placed there executes at a moment nobody chose and with nobody's authorization. The framework closes the whole class by forbidding it and routing mutations through POST-only Server Actions, which also removes the accidental-GET CSRF shape — a link that logs users out is the canonical version of this bug.

**★ An action returns silently when the ownership check fails. Is that right?**
It depends entirely on the operation. For an idempotent, low-stakes toggle the documented example does exactly that — return without acting — because the UI has nothing useful to say and an error would be noise. For a destructive operation the documentation asks for the opposite: elevated checks and *a loud failure when those checks miss*, because a silent return on a delete is indistinguishable from success and leaves no trace for whoever is watching.

**★ A caught error in a Server Action: what may the returned message contain?**
Only strings you wrote. An uncaught exception's `message` belongs to whatever library produced it, and that text routinely contains index names, table names, file paths and URLs with credentials in them. The safe shape is a closed union of error codes, a constant user-facing sentence per code, a single opaque message for everything else, and a generated reference logged alongside the real error so support can correlate. Next.js redacts Server Component errors that reach an `error.tsx` boundary — a generic message plus a digest — but that protection does not cover a string you chose to return yourself.

**★ Why is "no such user" versus "wrong password" a security bug rather than good UX?**
Because the pair is an oracle. Anyone can POST an email list at the login endpoint and separate registered from unregistered addresses, which is a valuable list on its own and the first step of a credential-stuffing campaign. The fix is one message for both outcomes and, ideally, comparable work on both paths so that response time does not leak the same fact the message no longer does.

**Where does `error.digest` fit, and why does an action need its own version of it?**
`digest` is the automatically generated hash Next.js attaches to a Server Component error that reaches an error boundary, so the generic message shown to the user can be matched to a full server-side log entry. An action that catches its own errors has left that path — nothing generates a digest for a value you return — so you generate the correlation reference yourself, put it in the log line and in the user-facing sentence, and get the same property back.

**Why can a delete justify a re-authentication prompt when a normal edit does not?**
Because the cost of a stolen or borrowed session is not uniform across operations. A session that is minutes old and one that is a week old are equally valid to the auth layer, but only one of them is good evidence that the person at the keyboard is the account owner. Requiring recent credentials for irreversible actions bounds the damage of an unattended laptop or a leaked cookie without adding friction to everything else. The framework has no primitive for this; it is a freshness check you implement in the Data Access Layer.

---

← [01 · Where the check lives](01-server-actions-for-mutations-with-useactionstate-and-useopti.md) · [Chapter 10 overview](01-explanation.md) · Next → [01c · What crosses the wire](01c-what-crosses-the-wire-modules-and-closures.md)
