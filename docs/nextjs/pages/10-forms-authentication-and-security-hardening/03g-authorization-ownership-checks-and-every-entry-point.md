---
title: "Authentication is the part everybody implements; authorization is the part that gets breached — because a session proves who is calling and says nothing about whether that row is theirs"
sidebar_label: "Authorization: ownership checks"
sidebar_position: 125
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Data Security in Next.js](https://nextjs.org/docs/app/guides/data-security) (docs `lastUpdated: 2026-08-25`), [Server Actions](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`), and [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`). Documentation-verified; no sandbox run.
> Target: **Next.js 16.3.4 · React 19.2.8 · zod 4.4.3**.

**Every page before this one was about establishing identity. None of it stops a signed-in user from passing someone else's record id to your delete action. That class of bug — Insecure Direct Object Reference — is the one that actually appears in incident reports, and it survives every auth library because no library knows which rows belong to whom. The Next.js documentation states the rule in one sentence, and it is the sentence this page exists to expand: *"Render-time gating (only rendering a form on an authenticated page) is not a security boundary, because requests can be sent without going through the UI."***

## Every Server Action is a public POST endpoint

The Server Actions guide is unusually blunt about what the `'use server'` directive produces:

> *"A Server Action runs as a POST request against the page that invokes it. At build time, the `'use server'` directive tells the compiler to swap the function's implementation in client bundles for a reference (an action ID plus a dispatcher) that POSTs back to the server. The implementation stays on the server, but the route is reachable to anyone who can send the same POST. **Treat every action as an untrusted entry point.**"*

The Data Security guide says the same thing from the other direction:

> *"By default, when a Server Action is created and exported, it is reachable via a direct POST request, not just through your application's UI. This means, even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally."*

Next.js does ship framework-level mitigations, and it is worth knowing exactly what they cover so you do not over-rely on them:

- **Encrypted, non-deterministic action IDs** — *"Next.js creates encrypted, non-deterministic IDs to allow the client to reference and call the Server Action. These IDs are periodically recalculated between builds."* But: *"The IDs are created during compilation and are cached for a maximum of 14 days. They will be regenerated when a new build is initiated or when the build cache is invalidated."* An ID an attacker captured is good for up to two weeks.
- **Dead-code elimination** — an action never referenced from the UI is stripped and gets no public endpoint. That protects the actions you forgot about, not the ones you use.
- **CSRF check** — *"The request's `Origin` is compared to the `Host` (or `X-Forwarded-Host`). Mismatches are rejected."*
- **Body size limit** — *"Action requests are capped at 1MB by default."*
- **Closure variable encryption** — variables captured by an inline action are encrypted before being sent to the client, and multi-instance deployments must pin `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` so every instance shares a key.

And the framing the docs put immediately after that list:

> *"This security improvement reduces the risk in cases where an authentication layer is missing. However, you should still treat Server Actions as reachable via direct POST requests and verify authentication and authorization inside each one."*

> *"Framework protections are not a substitute for application-level checks."*

## Validation is not authorization, and this is the sentence to memorise

> *"For example, a client legitimately tells the server *which* item to act on, but it should not supply the row's contents or ownership. Send a reference (typically an ID) plus the user's change, and re-read the rest from a trusted source using the session. Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object can still refer to a row the caller does not own."*

A Zod schema is a type check with better errors. `z.object({ id: z.uuid(), completed: z.boolean() })` proves the id is a UUID. It does not prove it is *your* UUID. Teams that adopt schema validation early often believe the input problem is solved, and the shape of the resulting bug is always the same: perfectly validated input, correctly parsed, operating on another tenant's row.

The docs' unsafe example, quoted as published:

```ts
// Unsafe: no auth, no ownership check. The whole item, including its id, comes
// from the client, so anyone who can POST here can mark any item complete.
export async function completeItemUnsafe(item: Item) {
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}
```

## The ownership check, in full

```ts
// lib/dal/items.ts
import 'server-only'

import { z } from 'zod'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/dal'

const CompleteItem = z.object({
  itemId: z.uuid(),
  completed: z.boolean(),
})

export async function completeItem(input: unknown) {
  const session = await requireSession()          // 1. who is calling
  const parsed = CompleteItem.safeParse(input)    // 2. is the input well-formed
  if (!parsed.success) throw new Error('BadRequest')

  const item = await db.item.findUnique({         // 3. load, do not trust
    where: { id: parsed.data.itemId },
    select: { id: true, ownerId: true },
  })
  if (!item) throw new Error('NotFound')

  if (item.ownerId !== session.userId) {          // 4. is it theirs
    throw new Error('Forbidden')
  }

  await db.item.update({                          // 5. only now
    where: { id: item.id },
    data: { completed: parsed.data.completed },
  })
}
```

Five steps, in that order, every time. Step 3 exists because you cannot check ownership of a row you have not read, and step 5 is scoped by `item.id` — the value you loaded — rather than by anything the client sent.

There is a shortcut that is often better, because it cannot be forgotten: **make ownership part of the `WHERE` clause.**

```ts
const { count } = await db.item.updateMany({
  where: { id: parsed.data.itemId, ownerId: session.userId },
  data: { completed: parsed.data.completed },
})
if (count === 0) throw new Error('NotFoundOrForbidden')
```

One round-trip, no window between the check and the write, and an ownership predicate the query planner enforces. The combined error is a feature: it does not tell the caller whether the row exists.

The Next.js docs' own version of the explicit form, for reference:

```ts
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

## The entry points, enumerated

The reason to put the check in the Data Access Layer rather than "in the route" is that there is no single route. Each of these reaches your data independently:

**Pages.** A check here gates one page. Fine as UX, not as the boundary.

**Layouts.** Two documented caveats, and both matter:

> *"Due to Partial Rendering, be cautious when doing checks in Layouts as these don't re-render on navigation, meaning the user session won't be checked on every route change."*

> *"A layout also does not control whether the rest of the route renders. Route segments and parallel route slots are rendered by the router, so a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload."*

That second sentence rules out the most common SPA habit outright, and the docs say so:

> *"A common pattern in SPAs is to `return null` in a layout or a top-level component if a user is not authorized. This pattern is **not recommended** since Next.js applications have multiple entry points, which will not prevent nested route segments and Server Actions from being accessed."*

**Leaf components.** Useful, and explicitly for *rendering* decisions:

> *"Auth check in Server Components are useful for role-based access."*

> *"Ensure that any Server Actions called from these components also perform their own authorization checks, as client-side UI restrictions alone are not sufficient for security."*

**Server Actions.** Re-verify inside, always:

> *"A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action."*

**Route Handlers.** Same treatment as a public API, with two tiers:

```ts
// app/api/route.ts
import { verifySession } from '@/app/lib/dal'

export async function GET() {
  const session = await verifySession()

  if (!session) {
    return new Response(null, { status: 401 })
  }

  if (session.user.role !== 'admin') {
    return new Response(null, { status: 403 })
  }

  // Continue for authorized users
}
```

> *"The example above demonstrates a Route Handler with a two-tier security check. It first checks for an active session, and then verifies if the logged-in user is an 'admin'."*

**Statically rendered routes.** These fetched their data at build time, when there was no request and therefore no session — so a DAL check never ran. The docs: *"for static routes that share data between users, data will be fetched at build time and not at request time. Use Proxy to protect static routes."* That is the one case where the proxy layer is doing real work rather than optimistic filtering; the mechanics belong to **04 · Defence in depth: `proxy.ts` as a coarse filter** *(not written yet)*.

The other half of the boundary — what a Server Action may accept, what it may return, the CSRF origin check, and the audit checklist the docs publish — is [03h · The trust boundary around a Server Action](03h-the-trust-boundary-around-a-server-action.md).

## Gotchas

**★ Symptom: a signed-in user deletes another user's record by changing an id in the request.** Cause: the action authenticated (there is a session) but never authorized (whose row is this). Fix: bind ownership into the query so it cannot be skipped.

```ts
const { count } = await db.post.deleteMany({ where: { id: postId, authorId: session.userId } })
if (count === 0) throw new Error('NotFoundOrForbidden')
```

**★ Symptom: the admin button is hidden, and the admin action still runs for non-admins.** Cause: the check gated the render, not the action — *"render-time gating … is not a security boundary."* Fix: the action's first two lines are the session read and the role assertion.

```ts
'use server'
export async function deleteAllRecords() {
  const session = await requireSession()
  if (session.role !== 'admin') throw new Error('Forbidden')
  await db.record.deleteMany()
}
```

**★ Symptom: a Zod schema passes and the wrong tenant's data is modified.** Cause: shape validation was mistaken for authorization — *"a well-formed `Item` object can still refer to a row the caller does not own."* Fix: accept an id and the user's change only, then re-read ownership from the database using the session.

**★ Symptom: an auth check in the root layout stops firing after a client-side navigation.** Cause: *"Layouts … don't re-render on navigation, meaning the user session won't be checked on every route change."* Fix: move the check to the DAL function each segment's data comes from, so it runs per data access rather than per layout mount.

**★ Symptom: a layout returns `null` for unauthorized users and the nested page's data still appears in the RSC payload.** Cause: *"a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload."* Fix: gate the data, not the UI — and if you want a redirect, do it from the DAL accessor the segment calls.

**★ Symptom: an action removed from the UI months ago is still callable.** Cause: it is still exported and still referenced somewhere, so dead-code elimination did not strip it, and its ID remains valid for up to 14 days after each build. Fix: delete unused exported actions; do not rely on obscurity for ones you keep.

**★ Symptom: a static marketing route serves one customer's dashboard data.** Cause: the route was prerendered at build time, so no session existed and the DAL check never ran. Fix: make the route dynamic by reading the session, or gate it at the proxy layer, which the docs name as the tool for static routes specifically.

**★ Symptom: an enumeration attack maps every valid record id by timing the difference between `NotFound` and `Forbidden`.** Cause: distinct errors for "does not exist" and "not yours" confirm existence. Fix: return one indistinguishable failure — which is what the `updateMany`/`deleteMany` form gives you for free.

## Interview questions

**★ Why is "the form is only rendered on an authenticated page" not a security control?**
Because the form is not what invokes the action. A Server Action compiles down to an action ID plus a POST endpoint on the route, and the docs say plainly that *"the route is reachable to anyone who can send the same POST."* An attacker with a captured action ID does not need your UI, your JavaScript or a session in a browser — just `curl`. Render-time gating decides what a cooperative client sees; it decides nothing about what an uncooperative one can call.

**★ You have Zod validating every Server Action input. What class of bug does that not touch?**
Every authorization bug. Zod checks shape, type and range: this is a UUID, this is a boolean, this string is under 200 characters. It has no knowledge of who is calling or which rows they own, so a perfectly valid `{ itemId: <someone else's uuid>, completed: true }` passes cleanly. The docs put it exactly: *"Schema validation (zod or similar) only checks the shape of the input. A well-formed `Item` object can still refer to a row the caller does not own."*

**★ Why prefer `updateMany({ where: { id, ownerId } })` over loading the row and comparing?**
Three reasons. It is one round-trip instead of two. It closes the window between the check and the write, where a concurrent transfer of ownership could land. And it makes forgetting structurally harder: the ownership predicate is part of the statement that performs the mutation, so it cannot be deleted by someone tidying up a "redundant" query. The affected-row count becomes your check, and returning a single combined error for zero rows also avoids confirming whether the record exists.

**★ What do Next.js's encrypted action IDs actually protect against, and for how long?**
They stop an attacker from *guessing* an endpoint: IDs are encrypted and non-deterministic rather than derived from the function name, and unused actions are stripped from client bundles entirely so they have no endpoint at all. What they do not do is stop replay by someone who has an ID, and the docs bound that window: IDs *"are created during compilation and are cached for a maximum of 14 days"*, regenerating on a new build or a cache invalidation. So it is obscurity with a stated expiry — useful defence in depth, never the check.

**★ Why does the Next.js documentation call out `return null` in a layout as an anti-pattern?**
Because layouts do not control whether their children render. Route segments and parallel route slots are rendered by the router, so a layout returning `null` hides its own output while the nested segments still execute and still appear in the RSC payload. On top of that, layouts do not re-render on navigation under partial rendering, so the check does not even fire on every route change. It is a pattern imported from SPAs where the component tree *is* the router; in the App Router it is neither a gate nor a reliable check.

**★ Where exactly do you put an authorization check, and why not in middleware?**
Next to the data, in a `server-only` Data Access Layer function, so that every caller — page, layout, leaf component, Server Action, Route Handler, and code not yet written — inherits it. A proxy or middleware check runs before route rendering, sees only what is in the cookie, does not run on paths its matcher excludes, and is not in the path of a direct POST to a Server Action. The docs give the ordering directly: it *"should not be your only line of defense … The majority of security checks should be performed as close as possible to your data source."*

**★ What is the difference between the two errors `Unauthorized` and `Forbidden`, and when should you collapse them?**
`Unauthorized` (401) means "I do not know who you are"; `Forbidden` (403) means "I know who you are and the answer is no". Distinguishing them is good API design and good telemetry. Collapse them into a single indistinguishable response when the distinction would confirm the existence of a resource the caller is not entitled to know about — which is exactly why Clerk's `auth.protect()` returns 404 rather than 403 for an authenticated-but-unauthorized request.

---

← [Clerk and Supabase](03f-clerk-and-supabase-the-hosted-identity-trade.md) · [Chapter 10 overview](01-explanation.md) · Next → [The trust boundary around a Server Action](03h-the-trust-boundary-around-a-server-action.md)
