---
title: "A Server Action is a POST endpoint that anyone who can reach the page can call, so every check the form performs has to be repeated inside the action"
sidebar_label: "03c · An action is a public POST endpoint"
sidebar_position: 11
description: "The four framework-level protections and their exact limits, why render-time gating is not a security boundary, why schema validation cannot answer an ownership question, and when a check should fail loudly rather than silently."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Server Actions and Mutations guide](https://nextjs.org/docs/app/guides/server-actions)
> — page metadata `version: 16.3.4`, `lastUpdated: 2026-06-17`; its Security section, including
> the unsafe/safe example pair, is quoted verbatim below.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**The single most useful sentence about Server Actions is a security sentence, and it reframes
every error-handling decision on the page.** An action looks like a function call in your
component. It is not one. At build time the compiler replaces the body in the client bundle with
a reference — an action ID and a dispatcher — and what ships to the browser is the address of a
POST endpoint. Anyone who can load the page can send that POST, with any arguments, in any order,
at any time, without ever rendering your form. Every guard the UI appears to provide — a button
only shown to admins, a field with `maxlength`, a select with three options — is decoration on
the client side of a boundary the attacker is already past.

## What the framework guarantees, and what it does not

> *"A Server Action runs as a POST request against the page that invokes it. At build time, the
> `'use server'` directive tells the compiler to swap the function's implementation in client
> bundles for a reference (an action ID plus a dispatcher) that POSTs back to the server. The
> implementation stays on the server, but the route is reachable to anyone who can send the same
> POST. Treat every action as an untrusted entry point."*

Four framework-level protections, each with a specific scope:

| Protection | What it does | What it does **not** do |
|---|---|---|
| **CSRF check** | Compares the request's `Origin` to the `Host` (or `X-Forwarded-Host`) and rejects mismatches. Configure `serverActions.allowedOrigins` for proxy or CDN domains | Stop a request sent from your own origin, or from a tool that sets `Origin` correctly |
| **Body size limit** | Caps action requests at **1MB** by default; `serverActions.bodySizeLimit` raises it | Validate what is inside the body |
| **Encrypted action IDs + dead code elimination** | Encrypts action references at build time and strips unused Server Functions from client bundles so *"they have no public endpoint"* | Protect an action that **is** used — that one has an endpoint by design |
| **Closure variable encryption** | Encrypts variables captured by an inline action before they go to the client. Needs `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable across instances | Make a captured secret safe to capture; it still leaves the server |

And then the sentence that puts them in their place:

> *"Framework protections are not a substitute for application-level checks."*

The three checks the guide requires inside every action:

- **Authenticate and authorize.** 🔴 *"Render-time gating (only rendering a form on an
  authenticated page) is not a security boundary, because requests can be sent without going
  through the UI."*
- **Validate inputs.** *"Treat `FormData`, query parameters, and headers as untrusted."*
- **Constrain return values.** *"Action returns are serialized to the client. Shape them to what
  the UI renders, not raw database records."*

## Why schema validation is not authorisation

This is the distinction that survives a code review and fails in production:

> *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item`
> object can still refer to a row the caller does not own."*

The guide's own pair, verbatim in intent and structure:

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

The rule underneath it, stated generally: *"a client legitimately tells the server which item to
act on, but it should not supply the row's contents or ownership. Send a reference (typically an
ID) plus the user's change, and re-read the rest from a trusted source using the session."*

🔴 **Note the shape of the ownership check.** It is a `findFirst` filtered by *both* the id and
the owner, not a fetch followed by an `if (item.ownerId !== session.user.id)`. The two are
equivalent when written correctly and only one of them stays correct when someone later adds a
`select` or refactors the comparison away.

## Where the error handling comes back in

An unauthorised call is not an expected error to be rendered politely — see
[01 · The unified error model](01-the-unified-error-model-errortsx-boundaries.md) for the
categories. The guide's own examples `throw new Error('Unauthorized')`, and add:

> *"Destructive operations like deletes may warrant stronger handling, such as elevated session
> checks or re-authentication, and a loud failure when those checks miss."*

⚠️ **But notice the safe example above returns silently rather than throwing.** Both appear in
the same document, and the difference is deliberate: `completeItem` returns early so a probing
caller cannot distinguish "this item does not exist" from "this item is not yours" — a
distinction that is itself an information leak. Throwing loudly is right when you are protecting
an operation; returning uniformly is right when you are avoiding an enumeration oracle. Decide
which problem you have.

## Gotchas

### The admin-only action that is not admin-only
**Symptom.** A penetration test moves a record between accounts using an action that only appears
on a page behind an admin check.
**Cause.** The check lives in the page that renders the form. The action is a POST endpoint and
never sees that page.
**Fix.** Check inside the action, every time, with no reliance on how it was reached.

```ts
'use server'

import { auth } from '@/lib/auth'

export async function reassignRecord(recordId: string, toUserId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (session.user.role !== 'admin') throw new Error('Forbidden')

  await db.record.update({ where: { id: recordId }, data: { ownerId: toUserId } })
}
```

### Passing the whole entity from the client and validating it with zod
**Symptom.** Every input is schema-validated, the code review passed, and a user can still modify
another tenant's row.
**Cause.** The schema proves the object is well-formed. It says nothing about whether this caller
may act on that id.
**Fix.** Accept the identifier and the change only, and re-read the record filtered by ownership.

```ts
'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'

const RenameInput = z.object({ id: z.string().uuid(), title: z.string().min(1).max(200) })

export async function renameItem(raw: unknown) {
  const parsed = RenameInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }

  const session = await auth()
  if (!session?.user) return { ok: false as const, error: 'Not signed in' }

  // shape is validated AND ownership is enforced by the query itself
  const updated = await db.item.updateMany({
    where: { id: parsed.data.id, ownerId: session.user.id },
    data: { title: parsed.data.title },
  })

  if (updated.count === 0) return { ok: false as const, error: 'Item not found' }
  return { ok: true as const, data: null }
}
```

### An action that captures a secret in its closure
**Symptom.** A security scan finds an encrypted blob in the page payload that decrypts to an API
key on a machine with the encryption key.
**Cause.** An inline Server Action closes over a variable from the enclosing Server Component.
Closure variables are encrypted before being sent to the client — encrypted, but still sent.
**Fix.** Read secrets inside the action body from the environment, so nothing crosses the wire at
all.

```ts
'use server'

export async function sendInvite(email: string) {
  const apiKey = process.env.MAIL_API_KEY // read here, not captured from outside
  await mail.send({ apiKey, to: email })
}
```

### Returning the ORM entity so the client can "use the rest later"
**Symptom.** Internal columns — soft-delete flags, internal notes, another user's id — are
visible in the network tab of a form submit.
**Cause.** Return values are serialized to the client in full.
**Fix.** Project to what the UI renders. If a later screen needs more, that is another read with
its own authorisation, not a wider return here.

### Raising `bodySizeLimit` to make an upload work
**Symptom.** A file upload through an action starts failing at 1MB, and the limit is raised to
`50mb` to fix it.
**Cause.** The default cap is 1MB. Raising it is supported — but it also raises the cost of every
abusive POST to that endpoint, which is public.
**Fix.** Raise it deliberately and only as far as needed, and prefer a dedicated upload path
(a Route Handler with a signed URL, or direct-to-storage) for genuinely large payloads.

```js
// next.config.js
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
      bodySizeLimit: '2mb',
    },
  },
}
```

## Interview questions

**★ What is a Server Action, at the HTTP level?**
A POST endpoint. The `'use server'` directive tells the compiler to replace the function body in
client bundles with a reference — an action ID plus a dispatcher — that POSTs back to the server.
The implementation never ships, but the endpoint is reachable by anyone who can send the same
POST, which is why the guide says to treat every action as an untrusted entry point.

**★ The form is only rendered on an authenticated page. Is the action protected?**
No. The guide is explicit: render-time gating is not a security boundary, because requests can be
sent without going through the UI. The authentication and authorisation checks have to be inside
the action.

**★ You validate every input with zod. What class of attack does that not address?**
Authorisation. Schema validation checks the shape of the input, and a well-formed object can
still refer to a row the caller does not own. The fix is structural: accept an identifier plus
the change, derive identity from the session, and re-read the record filtered by ownership rather
than trusting fields the client supplied.

**★ Name the framework-level protections and one thing each does not cover.**
A CSRF check comparing `Origin` to `Host`/`X-Forwarded-Host` — which does not stop a
correctly-originated request. A 1MB body limit — which says nothing about the body's contents.
Encrypted action IDs plus dead-code elimination, so unused Server Functions have no public
endpoint — which does not help an action that is in use. And closure variable encryption — which
protects captured values in transit but does not make capturing a secret a good idea.

**★ Why does one documented example throw `Unauthorized` and another return silently?**
Different threats. Throwing loudly is right for a destructive operation where a missed check
should be conspicuous — the guide calls for a loud failure there. Returning uniformly is right
when distinguishing "not found" from "not yours" would let an attacker enumerate ids. The choice
is between making failure visible to you and making it uninformative to an attacker.

**★ An action returns the created record so the UI can render it. Any objection?**
Only to returning it whole. Return values are serialized to the client, so the object is fully
readable in the network tab regardless of what the UI chooses to display. Project it to the
fields being rendered; anything else is a read that should carry its own authorisation.

---
---

← [03b · Sequential dispatch](03b-sequential-dispatch-and-what-it-does-to-error-ui.md) · **Next → [03d · Action IDs rotate](03d-action-ids-rotate-and-what-that-does-to-an-open-tab.md)**
