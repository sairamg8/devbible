---
title: "A shared zod schema is not a way to avoid writing validation twice — it is one contract with two consumers, and only the server-side consumer is a control"
sidebar_label: "02 · The schema as a trust boundary"
sidebar_position: 2
description: "Why the client copy of a schema is a convenience and the server copy is the gate, the honest table of where each class of check belongs, where the schema module may live without dragging server code into the browser, and what a schema can never decide."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) (`lastUpdated: 2026-08-25`), [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`), and the [Zod](https://zod.dev/api) reference. Zod surface **probed on the installed package** (`zod` **4.4.3**, matching the corpus pin).
> Target: **Next.js 16.3.4 · React 19.2.8 · zod 4.4.3**. Documentation-verified; **no sandbox run**.

**Sharing a schema between the browser and the server is usually sold as not repeating yourself. That framing is what makes people delete the server-side call once the client-side one is working. The accurate framing is that a schema is a contract at a trust boundary and it is being consumed twice for two unrelated reasons: on the client to make the form pleasant, and on the server to decide whether a request is allowed to touch the database. Delete the first and you have a worse form. Delete the second and you have no validation at all, because [the action is a POST endpoint](01-server-actions-for-mutations-with-useactionstate-and-useopti.md) and the browser is not on the request path.**

## The client copy validates nothing

The framework's position is stated as a bare rule:

> *"You should always validate input from client, as they can be easily modified. For example, form data, URL parameters, headers, and searchParams"*

with an example that has nothing to do with forms, which is the point — the same untrusted-input rule covers everything the client can influence:

```tsx filename="app/page.tsx"
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

The forms guide splits validation the same way, and it is worth noticing that the *client* half it describes is HTML attributes, not a schema:

> *"For **client-side validation**, you can use the HTML attributes like `required` and `type="email"` for basic validation."*
> *"For **server-side validation**, you can use a schema validation library like [Zod](https://zod.dev/) or [Valibot](https://valibot.dev/) to validate the form fields."*

So the shared-schema pattern is an addition on top of the documented baseline: you run the schema on the client too, purely so the user finds out about a bad value before a round trip. **The mental model that keeps you safe is that the client copy is a rendering concern.** It is in the same category as a loading spinner. Nothing downstream may assume it ran.

## Where each check belongs

Every project eventually has five overlapping layers, and confusion about which one is load-bearing is the source of most of the arguments. This is what each one is actually good for:

| Check | Where it runs | What it is for | What it guarantees to the server |
|---|---|---|---|
| HTML attributes — `required`, `type`, `min`, `maxlength`, `pattern` | Browser, before JS loads | Immediate feedback with zero code; works during progressive enhancement | **Nothing.** Removable in dev tools, absent from a direct POST |
| The schema, on the client | Browser, after hydration | Field-level messages without a round trip; identical wording to the server | **Nothing.** Same reason |
| The schema, in the action or DAL | Server | Shape, type, range, format, cross-field rules | The parsed value has the declared type and satisfies the declared constraints |
| Authorization — session, ownership, role | Server, in the DAL | Whether *this caller* may act on *this row* | The only layer that answers it; see [01](01-server-actions-for-mutations-with-useactionstate-and-useopti.md) |
| Database constraints — `UNIQUE`, `NOT NULL`, foreign keys, `CHECK` | Database | Invariants under concurrency, and the last line when a code path is missed | Holds even when two requests race, which no application check does |

Two rows deserve emphasis. **The schema row on the server does not include authorization** — chapter 07 and [01](01-server-actions-for-mutations-with-useactionstate-and-useopti.md) quote the reason: *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object can still refer to a row the caller does not own."* And **the database row is not redundant with the schema row**: a `safeParse` that checks "this email is not already taken" is a read, and between that read and the insert another request can win. Only the unique index is an invariant.

## One module, two importers

The schema module must be importable from a Client Component *and* from a `'use server'` module, which constrains what it may contain:

```ts filename="lib/schemas/task.ts"
import { z } from 'zod'

export const TaskPriority = z.enum(['low', 'normal', 'high'])

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, { error: 'Give the task a title.' }).max(200),
  priority: TaskPriority,
  dueAt: z.iso.date().optional(),
})

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
```

Three rules about that file, all of which are about what it must *not* do:

**No `import 'server-only'`.** The point of the module is that both sides import it. Guard the DAL, not the schema.

**No imports of anything server-only, transitively.** A schema that reaches for a config module that reads `process.env`, or a constants file that also exports a database enum generated by your ORM, drags that code into the client bundle — *"Once a file is marked with `"use client"`, all of its imports and the components it directly renders are included in the client bundle."* The failure is silent until someone reads the bundle. Keep the schema file's imports to `zod` and other schema files.

**No `'use server'` in it.** A schema file is not an action module; adding the directive would make every export an endpoint, per [01c](01c-what-crosses-the-wire-modules-and-closures.md).

The server side then consumes it as the gate, and the shape below is the one the rest of this sub-chapter builds on:

```ts filename="data/tasks.ts"
import 'server-only'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { CreateTaskSchema } from '@/lib/schemas/task'

export async function createTask(raw: unknown) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // The gate. Not a formality: `raw` arrived over HTTP.
  const parsed = CreateTaskSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, issues: parsed.error.issues }
  }

  const task = await db.task.create({
    data: { ...parsed.data, ownerId: session.user.id },
  })
  return { ok: true as const, id: task.id }
}
```

Note the order: **authorize, then validate.** Reversing it means an unauthenticated caller can use your parse errors as a probe of the schema, and it means expensive validation runs for callers who were never going to be allowed through. Where the two interact — a field whose allowed values depend on the caller's role — the schema cannot express it and the DAL must, which is the next rule.

## What a schema cannot decide

A schema is a pure function of the payload. That makes four questions permanently out of scope, and each of them has to live in the DAL:

- **Ownership.** `z.uuid()` proves the id is a UUID, never that it is yours.
- **Existence.** A valid foreign key string is not a row.
- **Authority over a value.** `status: z.enum(['open', 'closed', 'archived'])` passes for a user whom policy allows only `open` and `closed`. The permissible subset depends on the session, so the check does.
- **Concurrency.** "Not already taken", "still in stock", "under the plan limit" are all true-at-read-time and false-at-write-time.

The honest pattern for the third is to validate the shape with the schema and then narrow with policy:

```ts filename="data/tasks.ts"
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  member: ['open', 'closed'],
  admin: ['open', 'closed', 'archived'],
}

export async function setTaskStatus(raw: unknown) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const parsed = SetStatusSchema.safeParse(raw) // shape only
  if (!parsed.success) return { ok: false as const, issues: parsed.error.issues }

  const allowed = ALLOWED_TRANSITIONS[session.user.role] ?? []
  if (!allowed.includes(parsed.data.status)) {
    return { ok: false as const, issues: [], code: 'FORBIDDEN_STATUS' as const }
  }

  const { count } = await db.task.updateMany({
    where: { id: parsed.data.id, ownerId: session.user.id },
    data: { status: parsed.data.status },
  })
  if (count === 0) return { ok: false as const, issues: [], code: 'FORBIDDEN' as const }
  return { ok: true as const }
}
```

## Gotchas

**★ Symptom: validation is thorough, the form is polished, and a `curl` POST writes a row with a 4,000-character title.** Cause: the schema runs in the Client Component and the action parses nothing — the shared-schema pattern was adopted for the ergonomics and the server-side call was never added, or was removed as duplication. Fix: parse in the DAL and treat the client parse as UI.

```ts
// In the action's data layer — this is the check that exists
const parsed = CreateTaskSchema.safeParse(raw)
if (!parsed.success) return { ok: false, issues: parsed.error.issues }
```

**★ Symptom: the client bundle grew by hundreds of kilobytes after the schema was "shared".** Cause: the schema module transitively imports server code — a config module reading `process.env`, an ORM-generated enum, a date library used only by the API. Once a Client Component imports it, all of that is in the bundle. Fix: keep the schema module's import list to `zod` and sibling schema files, and duplicate the two constants it needed.

**★ Symptom: two accounts exist with the same email despite a `refine` that checked for duplicates.** Cause: the check is a read and the insert is a later write; two concurrent signups both read "available". Fix: keep the friendly check for the message, and add the constraint that is actually atomic.

```sql
CREATE UNIQUE INDEX users_email_key ON users (lower(email));
```

```ts
try {
  await db.user.create({ data: { email, passwordHash } })
} catch (error) {
  if (isUniqueViolation(error, 'users_email_key')) {
    return { ok: false, fieldErrors: { email: ['That email is already registered.'] } }
  }
  throw error
}
```

**Symptom: a user with the `member` role sets a status only admins should be able to set, and the schema said it was fine.** Cause: the enum is a property of the field, not of the caller. Fix: narrow by role after parsing, as in `setTaskStatus` above.

**Symptom: unauthenticated requests to an action produce detailed field errors that map out the schema.** Cause: `safeParse` runs before the session check. Fix: authorize first; a caller who may not act does not need to know what a valid payload looks like.

**Symptom: `import 'server-only'` was added to the schema file "for safety" and the client build broke.** Cause: that guard exists to make a client import a build error, and a shared schema is imported by the client on purpose. Fix: remove it from the schema, and put it on the DAL module that consumes the schema — which is where the secrets actually are.

**Symptom: a field is validated on the client and silently dropped on the server.** Cause: `z.object` strips unknown keys, so a field the client sends and the server schema does not declare disappears without an error. Fix: if a missing declaration should be loud, use `z.strictObject` — but read [02b](02b-formdata-is-all-strings-coercion-at-the-boundary.md) first, because strict mode interacts badly with the metadata React adds to `FormData`.

**Symptom: two schemas drift — the client says 200 characters and the server says 100.** Cause: the "shared" schema was copied rather than imported, usually because of the bundle problem above. Fix: import one module; if a bundle constraint forces a split, derive both from one shared constants file so the numbers cannot diverge.

## Interview questions

**★ If the same zod schema runs on the client and the server, why is only one of them a security control?**
Because the client's copy runs on hardware the attacker owns. It can be skipped by disabling JavaScript, edited in dev tools, or bypassed entirely by POSTing the action directly — the browser is not on the request path in that case. So the client copy is a UX feature with the same status as an inline hint, and the server copy is the one that decides whether the payload reaches the database. The value of sharing is that the messages and rules are guaranteed identical, not that the check happens once.

**★ Where do zod's guarantees stop, and what has to pick up from there?**
At the shape and content of the payload. A schema will tell you a value is a UUID, an ISO date, a string of at most 200 characters or a member of an enum. It cannot tell you the id belongs to the caller, that a row with that id exists, that this particular user is permitted this particular enum member, or that a uniqueness claim will still hold at write time. Ownership and authority belong to the Data Access Layer alongside the session; uniqueness and referential integrity belong to database constraints, because only they are atomic with the write.

**★ Should the action authorize first or validate first, and does it matter?**
Authorize first. Validation errors are informative by design — they describe the accepted shape field by field — so running them for a caller who has no business calling the action hands out a free description of your API. Ordering the checks the other way also spends CPU on payloads that were never going to be accepted, which matters for an endpoint anyone can POST to. The exception is when validation is needed to identify the resource being authorized; then parse just the identifier, authorize, then parse the rest.

**★ Why is a `refine` that checks uniqueness not enough?**
Because it is a read followed by a write with a gap in between, and two concurrent requests can both pass the read. Under normal load the gap is small enough that the bug appears once a month and gets closed as unreproducible. The unique index is the only check that participates in the same transaction as the insert. Keep the `refine` — it produces a good message on the common path — and treat the constraint violation as the real outcome to handle.

**★ What can go wrong when a schema module is imported by a Client Component?**
Everything it imports comes with it. That is a bundle-size problem when the transitive imports are large and a security problem when they are not meant to be public — a constants file that also holds an internal endpoint list, a config module that reads environment variables, an ORM's generated types with the whole schema encoded in them. The rule that keeps it safe is that a shared schema file imports `zod` and other schema files, nothing else, and that `server-only` guards the layer that consumes it rather than the schema itself.

**Why does the Next.js forms guide describe client-side validation as HTML attributes rather than as a schema?**
Because HTML attributes are the only client-side validation that works before hydration, which matters for a form that posts to a Server Action with JavaScript still loading. `required` and `type="email"` are enforced by the browser itself. A schema-based client check needs the bundle to have arrived, so it is strictly an enhancement layered on top — useful, but not the baseline the guide documents.

---

← [01e · The request envelope](01e-the-request-envelope-csrf-size-rate-limits-and-idempotency.md) · [Chapter 10 overview](01-explanation.md) · Next → [02b · `FormData` is all strings](02b-formdata-is-all-strings-coercion-at-the-boundary.md)
