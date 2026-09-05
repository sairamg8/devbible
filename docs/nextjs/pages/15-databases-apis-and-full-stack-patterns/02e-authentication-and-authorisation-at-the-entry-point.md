---
title: "Render-time gating is not a security boundary and a zod schema cannot tell you whether the caller owns the row — every entry point re-authenticates, re-authorises, and lets the database enforce ownership"
sidebar_label: "02e · Authn and authz per entry point"
sidebar_position: 203
description: "Why a page-level redirect does not protect the action inside it, the IDOR that survives schema validation, why credentials must come from cookies rather than parameters, loud failure on destructive operations, and the documented audit questions."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Validating client input*, § *Authentication and authorization*, § *Auditing*), [Next.js · Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (§ *Security*) and [Next.js · `use server`](https://nextjs.org/docs/app/api-reference/directives/use-server) (§ *Security considerations*) — all `version: 16.3.4`.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**Everything the framework does for a Server Action is about the transport ([02d](02d-what-the-framework-gives-an-action.md)). Everything that has ever caused a breach is about the caller, and none of that is done for you. The documentation draws the line in one sentence — *"Framework protections are not a substitute for application-level checks"* — and the two checks it names first are the ones that fail most silently: the page looks guarded and is not, and the input validates cleanly while referring to a row belonging to somebody else.**

## The obligations, verbatim

> *"Framework protections are not a substitute for application-level checks. Inside every action:"*

> *"**Authenticate and authorize.** Render-time gating (only rendering a form on an authenticated page) is not a security boundary, because requests can be sent without going through the UI."*

> *"**Validate inputs.** Treat `FormData`, query parameters, and headers as untrusted."*

Both apply identically to a Route Handler, which starts from *"Route Handlers are public HTTP endpoints. Any client can access them."*

## Render-time gating is not a boundary

The mistake survives code review because the guarded version and the unguarded version look almost identical:

```tsx
// app/admin/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    redirect('/login')
  }

  return (
    <form
      action={async () => {
        'use server'
        const session = await auth()
        if (!session?.user?.isAdmin) {
          throw new Error('Unauthorized')
        }
        await db.record.deleteMany()
      }}
    >
      <button>Delete Records</button>
    </form>
  )
}
```

> *"The highlighted `auth()` check inside the action is critical. The page-level redirect on line 6 controls which UI is rendered, but the Server Action is a separate entry point and must verify the caller on its own."*

> *"A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action"*

Delete the inner `auth()` and the page still behaves correctly for every user who arrives through a browser. The attacker does not arrive through a browser — they POST the action ID, which exists in the build because the form referenced it, and `deleteMany()` runs. The redirect never executed because the page was never rendered.

The same reasoning limits `proxy.ts`: it can require a session across a route subtree, but an action and its page share a path ([02b](02b-what-a-server-action-compiles-into.md)), so a proxy rule cannot express "this user may delete *this* record". See [10 · The three places the gate cannot hold](../10-forms-authentication-and-security-hardening/04d-the-three-places-the-gate-cannot-hold.md).

## Authorisation is a different question, and a schema cannot answer it

> *"Beyond authentication (is the user logged in?), remember to check **authorization** (does this user have permission to act on this specific resource?). This prevents [Insecure Direct Object Reference (IDOR)](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) vulnerabilities"*

> *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object can still refer to a row the caller does not own."*

The fix has a shape worth memorising, because it recurs everywhere: **take the reference and the intended change from the client, take the identity from the session, and make the database enforce the join.**

```ts
// app/items/actions.ts
'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// Unsafe: no auth, no ownership check. The whole item, including its id, comes
// from the client, so anyone who can POST here can mark any item complete.
export async function completeItemUnsafe(item: Item) {
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}

// Safe: take only the change, derive identity from the session, look up by ownership.
export async function completeItem(itemId: string) {
  const session = await auth()
  if (!session?.user) return

  const item = await db.item.findFirst({
    where: { id: itemId, ownerId: session.user.id },
  })
  if (!item) return

  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}
```

Note what the safe version refuses to do. It does not accept `item.ownerId` from the payload. It does not accept field values wholesale — only `completed`, which is the change the UI offers. And ownership is a `where` predicate, not a JavaScript comparison, so there is no check-then-act window.

The general rule, in the docs' own words:

> *"a client legitimately tells the server *which* item to act on, but it should not supply the row's contents or ownership. Send a reference (typically an ID) plus the user's change, and re-read the rest from a trusted source using the session."*

Putting zod in front of `completeItemUnsafe` validates that `item` is a well-formed `Item` and changes nothing about the vulnerability. Validation and authorisation are orthogonal, and validating first can *increase* misplaced confidence.

## Credentials come from the envelope, not the parameters

> *"Always authenticate and authorize users before performing sensitive server-side operations. Read authentication from cookies or headers rather than accepting tokens as function parameters."*

An action parameter is client-controlled by definition. Verifying a token passed as a parameter proves the caller can *produce* a valid token, not that the token is theirs.

```ts
'use server'
import { cookies } from 'next/headers'

// BAD — the caller supplies the credential they will be judged by
export async function meBad(authToken: string) {
  return decodeAndVerify(authToken)
}

// GOOD — the credential comes from the request envelope
export async function meGood() {
  const token = (await cookies()).get('AUTH_TOKEN')?.value
  return token ? decodeAndVerify(token) : null
}
```

The identical argument applies to `searchParams` in a Server Component and to bracketed route segments:

```tsx
// BAD: Trusting searchParams directly
export default async function Page({ searchParams }) {
  const isAdmin = (await searchParams).isAdmin
  if (isAdmin === 'true') {
    // Vulnerable: relies on untrusted client data
    return <AdminPanel />
  }
}

// GOOD: Re-verify every time
import { cookies } from 'next/headers'
import { verifyAdmin } from './auth'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const isAdmin = await verifyAdmin(token)

  if (isAdmin) {
    return <AdminPanel />
  }
}
```

## The audit questions, verbatim — run them on your own pull requests

> *"**`"use server"` files:** Are the Action arguments validated in the action or inside the Data Access Layer? Is the user re-authorized inside the action? Does the action check ownership of the resource (authorization, not just authentication)? Are return values filtered to only what the client needs? Is database access delegated to a `server-only` Data Access Layer?"*

> *"**`proxy.ts` and `route.ts`:** Have a lot of power. Spend extra time auditing these using traditional techniques."*

> *"**`/[param]/.`** Folders with brackets are user input. Are params validated?"*

> *"**Data Access Layer:** Is there an established practice for an isolated Data Access Layer? Verify that database packages and environment variables are not imported outside the Data Access Layer."*

That last question is the one this whole topic converges on — [02m](02m-the-data-access-layer.md).

## Gotchas

**★ Symptom: an admin-only form is protected by a page-level `redirect('/login')`, and an audit finds the mutation is callable by anyone.** Cause: the redirect gates rendering, not the POST endpoint. Fix: re-verify inside the action — better, inside the DAL function the action calls, so it cannot be forgotten twice.

```ts
// data/records.ts
import 'server-only'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function purgeRecords() {
  const session = await auth()
  if (!session?.user?.isAdmin) throw new Error('Unauthorized')
  await db.record.deleteMany()
}
```

```ts
// app/admin/actions.ts
'use server'
import { purgeRecords } from '@/data/records'
export async function purgeRecordsAction() { await purgeRecords() }
```

**★ Symptom: zod validation passes and a user still edits someone else's row.** Cause: the schema checked shape; the id came from the client and was trusted. Fix: keep the schema, and put ownership in the `where` clause so the database enforces it and a mismatch produces zero affected rows.

```ts
'use server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const Input = z.object({ itemId: z.string().uuid(), title: z.string().min(1).max(200) })

export async function renameItem(raw: unknown) {
  const { itemId, title } = Input.parse(raw)         // shape
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const { count } = await db.item.updateMany({
    where: { id: itemId, ownerId: session.user.id },  // ownership, in the WHERE
    data: { title },
  })
  if (count === 0) throw new Error('Forbidden')       // loud failure
}
```

**★ Symptom: an action takes an `authToken` or a `userId` parameter and trusts it.** Cause: parameters are client-controlled. Fix: read identity from `cookies()` or `headers()` inside the action; never accept it as an argument.

```ts
'use server'
import { cookies } from 'next/headers'

export async function deleteMyAccount() {
  const token = (await cookies()).get('AUTH_TOKEN')?.value
  const user = token ? await decodeAndVerify(token) : null
  if (!user) throw new Error('Unauthorized')
  await db.user.delete({ where: { id: user.id } })   // id from the session, not the caller
}
```

**★ Symptom: the same mutation exists as both an action and a `DELETE` handler, and only one of them checks ownership.** Cause: two entry points grew two copies of the rule and one was fixed during an incident. Fix: neither entry point owns the rule.

```ts
// data/posts.ts — the single site of the rule
import 'server-only'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const { count } = await db.post.deleteMany({
    where: { id: postId, authorId: session.user.id },
  })
  if (count === 0) throw new Error('Forbidden')
}
```

```ts
// app/posts/actions.ts
'use server'
import { deletePost } from '@/data/posts'
export async function deletePostAction(id: string) { await deletePost(id) }
```

```ts
// app/api/posts/[id]/route.ts
import { deletePost } from '@/data/posts'

export async function DELETE(_req: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params
  await deletePost(id)
  return new Response(null, { status: 204 })
}
```

**Symptom: `searchParams.isAdmin === 'true'` renders the admin panel.** Cause: query parameters are user input, and so is a bracketed route segment. Fix: re-verify from the session on every read, as the BAD/GOOD pair above shows.

## Interview questions

**★ A reviewer says "the page redirects unauthenticated users, so the action inside it is safe." Where is the flaw?**
The redirect governs rendering. The action is a separate HTTP entry point identified by an action ID that exists in the build regardless of whether any given visitor was shown the form, and the documentation states plainly that *"a page-level authentication check does not extend to the Server Actions defined within it."* An attacker never loads the page — they POST the action ID directly, so the redirect never runs. The correct structure re-verifies inside the action, and ideally inside a `server-only` function the action delegates to, so the check exists once and every entry point inherits it.

**★ Why does adding zod to an action not fix an IDOR?**
Because a schema answers "is this input well formed?" and an IDOR asks "may *this caller* act on *this row*?". The docs are explicit: *"A well-formed `Item` object can still refer to a row the caller does not own."* The concerns are orthogonal, and validating first can raise confidence without raising safety. The fix has two halves: accept only a reference plus the intended change, and express ownership as a database predicate — `where: { id, ownerId: session.user.id }` — so there is no window between deciding and acting, and a mismatch produces zero affected rows rather than a successful write on someone else's data.

**★ Why are credentials-as-parameters wrong even when the parameter is validated?**
Because validation proves the token is well formed and correctly signed, which proves the caller *possesses* a valid token — not that it is theirs. Any token the caller can obtain (their own, a leaked one, one from a different tenant) passes. Reading from `cookies()` or `headers()` ties identity to the request envelope, which the browser manages under the same-origin policy and the caller cannot select arbitrarily. The docs say it directly: *"Read authentication from cookies or headers rather than accepting tokens as function parameters."*

**Both entry points need the same checks. What is the failure mode of writing them per entry point?**
Drift. The checks get written twice, then one receives a fix — an ownership predicate added during an incident, a new role condition, a tightened validation — and the other does not, because nothing links them. Worse, the drifted copy is usually the less-used one and therefore the less-reviewed one. Collapsing the checks into a single `server-only` module makes the number of places the rule lives independent of the number of doors onto it, which is why the audit checklist asks whether database access is *"delegated to a `server-only` Data Access Layer"* rather than asking whether each action is individually correct.

**Where does `proxy.ts` fit if it cannot authorise an action?**
As a coarse first filter: it can require the presence of a session across a route subtree and short-circuit obviously unauthenticated traffic before it costs you a render. What it cannot do is resource-level authorisation, because an action shares the page's path so no matcher can select one mutation, and because the proxy generally does not have the domain context to know who owns a row. The documentation's own framing for the BFF case is *"Do not rely on proxy alone for authentication and authorization"* — the proxy reduces load and adds a layer, the entry point and the DAL make the decision.

---

← [02d · What the framework gives you](02d-what-the-framework-gives-an-action.md) · Next → [02f · Return values and rate limiting](02f-return-values-and-rate-limiting.md)
