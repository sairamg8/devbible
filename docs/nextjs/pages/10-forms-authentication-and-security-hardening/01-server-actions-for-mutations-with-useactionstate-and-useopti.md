---
title: "A Server Action is a POST endpoint with your database behind it, so the only authorization check that counts is the one inside the action — or inside the module the action delegates to"
sidebar_label: "01 · Server Actions: where the check lives"
sidebar_position: 1
description: "Why a page-level auth check does not extend to the actions defined on that page, why authentication is not authorization, why an ownership-scoped query beats fetch-then-compare, and what a Data Access Layer for mutations buys an audit."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [Server Actions and Mutations guide](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`), [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) (`lastUpdated: 2026-08-25`), and [`serverActions`](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) (`lastUpdated: 2026-06-25`).
> Target: **Next.js 16.3.4 · React 19.2.8**. Documentation-verified; **no sandbox run**.

**Chapter 08 taught the mutation as a user-experience problem: pending states, optimistic rows, queued dispatch. This chapter takes the same function and treats it as what it also is — a public HTTP endpoint that accepts a POST from anyone who can reach the page and then talks to your database. Every UI affordance you built to keep users out of it is decoration at that level. The framework says so in one sentence: a page-level authentication check does not extend to the Server Actions defined within it. This page is about where the check that does count actually has to live, and why "inside the action" is the answer only until you have more than three actions.**

## What chapter 07 already settled

Chapter 07 owns the HTTP-level premise and the deployment story, and this page does not repeat them:

- **[07 · An action is a public POST endpoint](../07-error-handling-loading-states-and-resilience/03c-an-action-is-a-public-post-endpoint.md)** — the four framework-level protections and their exact limits, why render-time gating is not a security boundary, and why schema validation cannot answer an ownership question.
- **[07 · Action IDs rotate](../07-error-handling-loading-states-and-resilience/03d-action-ids-rotate-and-what-that-does-to-an-open-tab.md)** — `Failed to find Server Action`, the 14-day ID cache, and the encryption key.
- **[07 · Auth interrupts: `forbidden()` and `unauthorized()`](../07-error-handling-loading-states-and-resilience/11-auth-interrupts-forbidden-and-unauthorized.md)** — the experimental `authInterrupts` flag and the UI segments it activates.

The one sentence worth carrying forward verbatim, because everything below is a consequence of it:

> *"Treat every action as an untrusted entry point."*

## The check that does not extend

The most common real-world hole is not a missing check. It is a check that exists in the wrong file. The data security guide states the rule without hedging:

> *"A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action"*

Its own example puts the two checks side by side deliberately — the page redirects, *and* the inline action re-authenticates:

```tsx filename="app/admin/page.tsx"
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'

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

The guide's own gloss on why the second check is not redundant:

> *"The page-level redirect on line 6 controls which UI is rendered, but the Server Action is a separate entry point and must verify the caller on its own."*

**Read that as a claim about compilation, not about diligence.** The `'use server'` directive splits that function out of the page's render path entirely: it becomes an addressable endpoint reachable by POST, and the surrounding component body is not on its call path. Deleting the page-level `redirect` would change what the browser shows; deleting the in-action `auth()` would change nothing visible and would hand `deleteMany()` to the internet.

## Authentication is not authorization

Once the caller is known, there is a second question the session alone cannot answer: *may this user act on this specific row?* The guide names the vulnerability class:

> *"Beyond authentication (is the user logged in?), remember to check **authorization** (does this user have permission to act on this specific resource?). This prevents [Insecure Direct Object Reference (IDOR)](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) vulnerabilities"*

And the boundary that schema validation cannot cross:

> *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object can still refer to a row the caller does not own."*

### Two documented shapes, and why one is better

The docs contain both. The data security guide fetches then compares:

```ts filename="app/actions.ts"
'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const post = await db.post.findUnique({ where: { id: postId } })

  // Check that the user owns this resource
  if (post.authorId !== session.user.id) {
    throw new Error('Forbidden')
  }

  await db.post.delete({ where: { id: postId } })
}
```

The Server Actions guide scopes the query by ownership instead:

```ts filename="app/items/actions.ts"
'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

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

Both are correct. **The second is structurally harder to get wrong**, for two reasons. First, the ownership predicate is inside the query, so there is no window in which a developer adds an early return, a cache read or a log line between the fetch and the comparison. Second, a row that exists but belongs to someone else and a row that does not exist produce *the same* result — an attacker probing IDs learns nothing about which IDs are real. The `findUnique`-then-compare form distinguishes them: a missing row throws on `post.authorId` (a `TypeError`), a foreign row throws `Forbidden`. Two different failures is one bit of information you did not mean to publish.

The rule the guide draws from this is about what the client is allowed to send at all:

> *"a client legitimately tells the server *which* item to act on, but it should not supply the row's contents or ownership. Send a reference (typically an ID) plus the user's change, and re-read the rest from a trusted source using the session."*

## Where the check lives once you have twenty actions

"Check inside every action" is correct and does not scale — it is a rule enforced by memory, and memory is the thing an audit cannot verify. The documented answer is to make the actions thin and put the checks in a module that cannot reach the client:

> *"Just as we recommend a Data Access Layer for reading data, you can apply the same pattern to mutations. This keeps authentication, authorization, and database logic in a dedicated `server-only` module, while `"use server"` actions stay thin."*

```ts filename="data/posts.ts"
import 'server-only'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const post = await db.post.findFirst({
    where: { id: postId, authorId: session.user.id },
  })
  if (!post) {
    throw new Error('Forbidden')
  }

  await db.post.delete({ where: { id: post.id } })
}
```

```ts filename="app/actions.ts"
'use server'

import { deletePost } from '@/data/posts'
import { revalidatePath } from 'next/cache'

export async function deletePostAction(postId: string) {
  await deletePost(postId) // Auth + authz happen inside the DAL
  revalidatePath('/posts')
}
```

The `'use server'` file is now a transport adapter: it parses, delegates, invalidates. Nothing in it decides anything. That is what makes the audit tractable — the guide's own audit checklist asks, of every `"use server"` file, *"Is database access delegated to a `server-only` Data Access Layer?"*

One implementation detail that trips people who assume `server-only` and `'use server'` conflict:

> *"You can use `import 'server-only'` in both the Data Access Layer and the `"use server"` file itself. Both work when the action is imported into a Client Component (for example, to pass it to `useActionState`), because `"use server"` modules are resolved in a server-only webpack layer."*

The DAL also has a documented rule about secrets that most projects violate on day one:

> *"Secret keys should be stored in environment variables, but only the Data Access Layer should access `process.env`."*

## Where this is also covered

This page owns the **action surface**: what an action is as an endpoint, and what that forces on the code that defines it. Three neighbouring pages reach the same ground from other directions, and each owns its angle in full:

- [03b · The Data Access Layer, `server-only` and the DTO](03b-the-data-access-layer-server-only-and-the-dto.md) — the DAL as the single place the check lives, from the **authorization** angle.
- [03h · The trust boundary around a Server Action](03h-the-trust-boundary-around-a-server-action.md) — the same boundary, drawn around **who the caller is** rather than around what crosses it.
- [05c · The Server Function's own serialization surface](05c-the-server-functions-own-serialization-surface.md) — what the **render** exposes, rather than what the action accepts.

## Gotchas

**★ Symptom: a user deletes a row belonging to another team, and the request logs show a clean success.** Cause: the action authenticated the caller and then keyed the write by the ID the caller supplied — `where: { id }` with no ownership predicate. Authentication answered "who", nobody asked "whose". Fix: put ownership in the query, so a foreign row simply is not found.

```ts
// Before — authenticated, unauthorized
await db.task.update({ where: { id: taskId }, data: { done: true } })

// After — the predicate carries the tenant
const { count } = await db.task.updateMany({
  where: { id: taskId, workspace: { members: { some: { userId: session.user.id } } } },
  data: { done: true },
})
if (count === 0) throw new Error('Forbidden')
```

**Symptom: an inline action reads a `session` variable from the enclosing component and the check passes for a user who was signed out ten minutes ago.** Cause: the closed-over `session` is a snapshot of *render* time, serialized with the action reference; it does not re-evaluate when the POST arrives. Fix: never close over the session — call `auth()` inside the action body.

```tsx
// Before: the check runs against a value captured at render
export default async function Page() {
  const session = await auth()
  async function archive(id: string) {
    'use server'
    if (!session?.user) throw new Error('Unauthorized') // stale by construction
    await db.item.update({ where: { id }, data: { archived: true } })
  }
  return <ArchiveButton action={archive} />
}

// After: the check runs against the request that is actually happening
export default function Page() {
  return <ArchiveButton action={archiveAction} />
}
```

**Symptom: the DAL is immaculate and one action still queries the database directly.** Cause: nothing enforces the layering; it is a convention held by review. Fix: make the import a lint error, so the next person's shortcut fails CI.

```js filename="eslint.config.mjs"
export default [
  {
    files: ['app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@/lib/db', message: 'Query through data/* (the DAL), never from app/*.' },
        ],
      }],
    },
  },
]
```

**Symptom: an admin-only action still succeeds for a user whose admin role was revoked minutes ago.** Cause: the role was read from a signed token, which records what was true when the token was issued; revocation is a database fact and the token never learns about it. Fix: for privileged operations, resolve the role from the store rather than the claim — and cache that read per request with `cache()` so the extra query costs one round trip, not twenty. [Chapter 10 · Reading the session with Cache Components](12-authentication-with-cache-components-reading-the-session.md) covers where that read is allowed to live.

**Symptom: the audit finds an action nobody can point to a caller for, and nobody dares delete it.** Cause: `'use server'` files export endpoints, not helpers — an exported async function in such a file is reachable whether or not your UI calls it. Fix: treat every export in a `'use server'` module as public API and check it; the mechanism is in [01c · What crosses the wire](01c-what-crosses-the-wire-modules-and-closures.md).

## Interview questions

**★ The form is rendered only inside an admin layout that redirects unauthenticated users. Why must the Server Action check again?**
Because the layout controls rendering and the action is a separate entry point. Compiling `'use server'` turns the function into an addressable POST endpoint; the component body that rendered the form is not on its call path, so nothing in the render tree runs when the request arrives. The documentation states it directly — a page-level authentication check does not extend to the Server Actions defined within it. Anyone able to observe one legitimate submission can replay the POST without ever loading the page.

**★ What is the difference between authenticating and authorizing inside an action, and which failure is more common?**
Authentication establishes who is calling; authorization establishes whether that caller may act on this particular resource. Missing authorization is far more common because authentication has an obvious symptom — logged-out users see errors — while a missing ownership check produces no symptom at all for legitimate users. It is the IDOR class: a well-formed payload naming a row the caller does not own. Schema validation cannot catch it, because the payload's *shape* is perfect.

**★ Why is scoping the query by owner better than fetching the row and comparing the owner afterwards?**
Two reasons. It removes the window between fetch and comparison in which future edits can insert an early return or a cache read, and it collapses "does not exist" and "not yours" into a single indistinguishable outcome, so an attacker enumerating identifiers learns nothing. The fetch-then-compare form leaks the difference: a missing row and a foreign row fail differently.

**★ What does moving authorization into a Data Access Layer buy you that a check in each action does not?**
Auditability and a single place to change policy. The check-per-action rule is enforced by memory, and an auditor has to read every action to confirm it. With a `server-only` DAL, actions become thin adapters — parse, delegate, revalidate — and the security review is a review of one module. It also gives you a natural home for the rule that only the DAL touches `process.env`, which keeps secrets out of files that sit near the client boundary.

**Why can `import 'server-only'` sit in a `'use server'` file that a Client Component imports?**
Because `"use server"` modules are resolved in a server-only webpack layer — the Client Component receives an action reference, not the module. The import that would normally trip `server-only` never happens on the client side of the graph. This means you can defend both the DAL and the action module with the same one-line guard.

**What would you look for first in a security review of an App Router codebase?**
The audit checklist in the data security guide is a good order: whether an isolated Data Access Layer exists and whether database packages and environment variables are imported anywhere outside it; whether `"use client"` props expect private data or have overly broad types; for each `"use server"` file, whether arguments are validated, the user re-authorized, ownership checked and return values filtered; whether bracketed route params are validated as user input; and `proxy.ts` plus `route.ts`, which the guide singles out as having *"a lot of power"* and deserving traditional penetration testing.

---

← [Chapter 10 overview](01-explanation.md) · Next → [01b · Mutation shape and failure posture](01b-mutation-shape-and-failure-posture.md)
