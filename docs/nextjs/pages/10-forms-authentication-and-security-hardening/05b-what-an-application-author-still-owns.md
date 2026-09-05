---
title: "The decoder was patched upstream; the encoder is yours — a hand-written DTO projection is the only outward serialization control in this stack you can actually certify, and tainting is a development backstop that is not even present in stable React"
sidebar_label: "05b · Projection at the boundary"
sidebar_position: 25
description: "Projection at the boundary, why the docs tell you to use classes, narrowing Client Component prop types so a wide call does not compile, constraining Server Function return values, and the measured state of the React taint APIs on the pinned version."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`) — its DAL, tainting, closures-and-encryption, return-value and auditing sections are quoted verbatim below — [`use server`](https://nextjs.org/docs/app/api-reference/directives/use-server) (`lastUpdated: 2026-08-25`) and [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`).
> Export surface **probed** on the installed package: `react` **19.2.8** (matches the corpus pin), `Object.keys(require('react'))` → **no `experimental_taint*` export**. Target: **Next.js 16.3.4 · React 19.2.8**. Documentation-verified plus one T1 probe; **no sandbox run**. Prior page: [05 · RSC serialization: the mechanism](05-rsc-serialization-hardening-lessons-from-react2shell-cve-202.md).

**[05](05-rsc-serialization-hardening-lessons-from-react2shell-cve-202.md) ended on the one consequence of React2Shell that no upstream patch can close: everything you put in a prop is still serialized onto the wire, and the framework has no way to know which of your fields are secret. This page is the **outward** half of that problem — everything your application encodes and sends. There are four controls, and their strength differs enormously. A hand-written DTO projection is the only one you can certify by reading the code. A narrow prop type makes the wide call a compile error. Returning class instances converts an accidental leak into a throw. And tainting — the API most often named as the answer — requires an experimental flag, is absent from the stable React package this corpus pins, and behaves differently depending on which router imports it. The **inward** half, where a Server Function's own closures and export list become serialization surface, is [05c](05c-the-server-functions-own-serialization-surface.md).**

## Projection at the boundary is the control you can certify

The data-security guide's DTO example carries two comments that are more instructive than the code:

> *"// only return the data relevant for this query and not everything"*

> *"// Don't pass values, read back cached values, also solves context and easier to make it lazy"*

```ts filename="data/user-dto.ts"
import 'server-only'
import { getCurrentUser } from './auth'
import { sql } from './db'

function canSeeUsername(viewer: User) {
  return true
}

function canSeePhoneNumber(viewer: User, team: string) {
  return viewer.isAdmin || team === viewer.team
}

export async function getProfileDTO(slug: string) {
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const userData = rows[0]

  // Read the viewer back from the cached session — do not accept it as a
  // parameter, because a parameter is forgeable by the caller.
  const currentUser = await getCurrentUser()

  return {
    username: canSeeUsername(currentUser) ? userData.username : null,
    phonenumber: canSeePhoneNumber(currentUser, userData.team)
      ? userData.phonenumber
      : null,
  }
}
```

Why this is *certifiable* and the alternatives are not: the returned object is an **explicit allowlist written by hand**. A reviewer can read the `return` statement and enumerate every field that can reach a browser, in constant time, without knowing anything about the schema. Add a column to the `user` table tomorrow and this function's output is unchanged — which is the property you want, and the exact property a `select *` plus a spread does not have.

Contrast the failure the guide demonstrates, where a page passes an ORM row straight through:

> *"// EXPOSED: This exposes all the fields in userData to the client because we are passing the data from the Server Component to the Client."*

> *"// BAD: This is a bad props interface because it accepts way more data than the Client Component needs and it encourages server components to pass all that data down. A better solution would be to accept a limited object with just the fields necessary for rendering the profile."*

The second comment is about the **prop type**, and it is the durable version of the advice. A Client Component typed `{ user: User }` invites every caller to hand over the whole entity; one typed `{ user: { name: string } }` makes the wide call a type error. The type signature is where this is enforced cheaply, which is why the guide's audit checklist asks of `"use client"` files: *"Are the Component props expecting private data? Are the type signatures overly broad?"*

The DAL that hosts these functions — its three rules, `server-only`, `cache()` and the `process.env` restriction — belongs to [03b · The Data Access Layer](03b-the-data-access-layer-server-only-and-the-dto.md). What is specific to serialization is the shape of the `return`.

⚠️ **Where this is also covered.** [01d · Return values, DTOs and tainting](01d-return-values-dtos-and-tainting.md) reaches the same three controls from the *Server Action's* point of view — what an action returns. This page reaches them from the RSC Payload: what a *render* encodes into props. The controls are identical because the wire format is; read one for the action surface and the other for the render surface, and do not treat either as the whole picture.

## "Use classes to avoid accidentally passing the whole object to the client"

That instruction, from the guide's own DAL example, looks like a style note and is actually a runtime enforcement trick:

> *"// Don't include secret tokens or private information as public fields.*
> *// Use classes to avoid accidentally passing the whole object to the client."*

The mechanism is one line elsewhere in the same guide:

> *"Functions and classes are already blocked from being passed to Client Components by default."*

So a class instance **cannot** be serialized into the RSC Payload. Passing one to a Client Component throws at render time rather than quietly shipping its fields. That converts a silent disclosure into a loud, local, immediate failure — the single most valuable transformation available in security engineering.

```ts filename="data/auth.ts"
import { cache } from 'react'
import { cookies } from 'next/headers'

export class User {
  constructor(
    readonly id: string,
    private readonly token: string,
    private readonly email: string
  ) {}

  // Deliberate, explicit projection. The only way out of the object.
  toPublicDTO() {
    return { id: this.id }
  }
}

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const decodedToken = await decryptAndValidate(token)
  return new User(decodedToken.id, decodedToken.token, decodedToken.email)
})
```

`<Profile user={user} />` now throws. `<Profile user={user.toPublicDTO()} />` works. The escape route is a method you had to type.

⚠️ **This protects the objects you construct, not the ones your ORM returns.** A Prisma or Drizzle row is a plain object and serializes without complaint. The trick is a boundary discipline for your own domain types, not a blanket defence — and it is worth knowing that the "blocked by default" guarantee is also what makes `class` instances awkward to pass around deliberately, which is the cost of the trade.

## Constrain return values

The return path is serialization too, and it is the one people forget because it feels like "my own data coming back."

> *"Server Action return values are serialized and sent to the client. Only return what the UI needs, not raw database records."*

```ts filename="app/lib/actions.ts"
'use server'

// GOOD: returns only what the client needs.
export async function updateUserSafe(data: FormData) {
  const session = await verifySession()
  await db.user.update({
    where: { id: session.userId },
    data: { name: data.get('name') as string },
  })
  return { success: true as const }
}
```

The guide's BAD counterpart returns `db.user.update(...)` directly, which resolves to the full record — *"which may include internal fields the client should not see."* The habit worth building is that an action returns a **result**, not a **row**: `{ success: true }`, or a narrow DTO when the UI genuinely needs to re-render from the response.

⚠️ Note the asymmetry with the request direction: per the Server Actions guide (`lastUpdated: 2026-06-17`), *"Action requests are capped at 1MB by default."* That is a bound on what a caller can send you, not on what you send back — there is no equivalent cap protecting you from returning a 5MB row set into the client, and no warning when you do.

## 🔴 Tainting is a development backstop, and its surface is not where you think

The taint APIs are the answer everyone reaches for, and there is more to know before relying on them than the documentation states in one place.

**What the docs say.** Two React APIs, `experimental_taintObjectReference` for data objects and `experimental_taintUniqueValue` for specific values, gated behind a Next.js config flag:

```js filename="next.config.js"
module.exports = {
  experimental: {
    taint: true,
  },
}
```

> *"This prevents the tainted objects or values from being passed to the client. However, it's an additional layer of protection, you should still filter and sanitize the data in your [DAL](https://nextjs.org/docs/app/guides/data-security#data-access-layer) before passing it to React's render context."*

**What a probe of the installed package says.** On this checkout, `react` resolves to **19.2.8** — the version this corpus pins — and `Object.keys(require('react'))` contains **no `experimental_taint*` export at all**. Stable React does not ship these APIs. In an App Router application the import resolves through the React canary that Next.js bundles for the server graph; a Pages Router import of the same specifier gets `undefined`.

🔴 **The practical consequence is a shared module that behaves differently depending on who imports it.** A `lib/user.ts` that calls `taintObjectReference` protects the object when the App Router pulls it in and silently does nothing — or throws on a call to `undefined`, depending on how you wrote the import — when the Pages Router does. In a half-migrated codebase, which the [CVE record](14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md) shows is a state with its own hazards, that is a control whose coverage you cannot state.

So the honest ranking is:

| Control | Enforced by | Can you certify it by reading the code? |
|---|---|---|
| DTO projection in the DAL | your `return` statement | **Yes** — enumerate the fields |
| Narrow Client Component prop types | TypeScript | Yes, at the call sites it covers |
| Class instances | React, by default | Yes — it throws |
| Taint APIs | an experimental flag, a canary build, per-router | No |
| Closure encryption ([05c](05c-the-server-functions-own-serialization-surface.md)) | Next.js, per build | The docs tell you not to |

Tainting belongs in the development loop, where turning a future refactor into a loud failure is exactly what you want; [ch20 · Appendix D](../20-appendices/04b-appendix-d-security.md) shows the `taintObjectReference` call in place and [01d](01d-return-values-dtos-and-tainting.md) covers it from the action side. It does not belong in the sentence you write to an auditor. That sentence is about the projection.

## Gotchas

**★ Symptom: a Client Component receives `passwordHash`, and the `select` in the query looked fine.**
Cause: `select` was written for the *query* — it included fields the ownership check needed — and the whole selected object was returned onward. Query shape is not response shape.
Fix: two shapes, explicitly. Select what the function needs; return what the client needs.

```ts filename="app/lib/dal.ts"
const row = await db.user.findUnique({
  where: { id },
  select: { id: true, name: true, teamId: true, passwordHash: true },
})
if (!row || row.teamId !== session.teamId) return null
return { id: row.id, name: row.name } // never `return row`
```

**★ Symptom: adding a column to a table changes what a page sends to the browser.**
Cause: a `SELECT *` plus a spread into props. The response shape is derived from the schema, so schema changes are silently response changes.
Fix: an explicit `return` object. This is the property that makes the projection certifiable — its output does not move when the schema does.

**★ Symptom: a code review approves passing a whole entity because "the client component only reads `.name`."**
Cause: conflating rendering with transmission. Props are serialized whether or not they are read, and on first load the payload ships with the HTML.
Fix: narrow the prop type so the wide call does not compile.

```tsx filename="app/ui/profile.tsx"
'use client'

// The type is the boundary. `{ user: User }` invites the whole entity.
export default function Profile({ user }: { user: { name: string } }) {
  return <h1>{user.name}</h1>
}
```

**★ Symptom: an action returns the updated record so the UI can "use the rest later", and internal fields ship with it.**
Cause: return values are serialized and sent to the client; returning `db.user.update(...)` returns the full record.
Fix: return a result or a narrow DTO. If the UI needs fresh data, revalidate and let the server re-render it rather than shipping the row back through the action's response.

**★ Symptom: `experimental_taintObjectReference` is imported and nothing is ever blocked.**
Cause: the `experimental.taint` flag is not set — or the module is being imported from the Pages Router, where the export is not available.
Fix: set the flag, and keep the taint calls inside modules only the App Router imports. Then treat the result as a development backstop, not the control.

```js filename="next.config.js"
module.exports = { experimental: { taint: true } }
```

**★ Symptom: a `class` instance is passed deliberately to a Client Component and the render throws.**
Cause: classes are blocked from crossing by default — the same rule the guide recommends exploiting.
Fix: this is the feature working. Add an explicit `toPublicDTO()` and call it at the boundary; the throw is telling you the projection is missing, not that the framework is in the way.

## Interview questions

**★ Why is a hand-written DTO projection stronger than tainting, given tainting is the API the docs point at?**
Because it is the only one of the two you can certify by reading the code. A `return { id, name }` is an explicit allowlist: a reviewer can enumerate every field that can reach a browser without knowing the schema, and adding a column tomorrow does not change the output. Tainting depends on an experimental config flag, is absent from the stable `react` package this corpus pins (19.2.8 exports no `experimental_taint*`), reaches the App Router only through Next's bundled canary, and is unavailable to the Pages Router — so a shared module's coverage differs by importer. The guide itself ranks them this way: tainting is *"an additional layer of protection"* and *"you should still filter and sanitize the data in your DAL."*

**★ The docs say to "use classes to avoid accidentally passing the whole object to the client." What is the mechanism, and what are its limits?**
The mechanism is that *"functions and classes are already blocked from being passed to Client Components by default"*, so a class instance cannot serialize into the RSC Payload — passing one throws at render time instead of silently shipping its fields. That turns a silent disclosure into a loud, local failure, and forces an explicit projection method as the only way out of the object. The limit is that it protects only the types you construct; a Prisma or Drizzle row is a plain object and serializes without complaint, so this is a discipline for your own domain types rather than a general defence.

**★ An action returns the record it just updated so the UI can use it. What is wrong with that?**
Return values are serialized and sent to the client, so returning `db.user.update(...)` ships the full record including *"internal fields the client should not see."* The habit to build is that an action returns a result — `{ success: true }` — or a narrow DTO where the UI genuinely needs to re-render from the response, and that fresh data usually arrives better through a revalidation than through the action's return. Note the asymmetry: the request direction has a documented 1MB cap, and the response direction has nothing stopping you.

**★ The audit checklist asks whether `"use client"` prop type signatures are "overly broad." Why is a type a security control here?**
Because the type is the only place the narrowing is enforced at zero runtime cost and at every call site simultaneously. A Client Component typed `{ user: User }` accepts the whole entity, so every caller is invited to hand one over and the compiler agrees; typed `{ user: { name: string } }`, the wide call is a compile error and the projection has to happen before the boundary. It does not stop someone constructing a wide object literal deliberately, so it is not a guarantee — but it converts the most common accidental version of the mistake, passing the row you already have, into a build failure. That is why the guide asks the question of `"use client"` files specifically rather than of the components' bodies.

**★ A DAL function's `select` clause and its `return` statement list different fields. Is that a smell?**
No — it is the correct shape, and the two being identical is the smell. The `select` is written for the *query*: it must include whatever the authorization check needs, so an ownership check on `ownerId` requires selecting `ownerId`. The `return` is written for the *response*: `ownerId` has done its job and has no business on the wire. Collapsing them into one list means either the check is missing fields it needs or the response is carrying fields it should not, and in practice it is the second. `return row` is the single most common way an internal field reaches a browser.

**★ You are asked to write one sentence for an auditor describing how sensitive fields are prevented from reaching the browser. What do you write, and what do you deliberately not write?**
You write that every value crossing into a Client Component is produced by an explicit projection in a `server-only` Data Access Layer whose return statements enumerate the exposed fields, and that Client Component prop types are narrowed so a wide call does not compile. You deliberately do not write that tainting prevents it, because tainting is behind an experimental flag, is not in the stable React package, and covers the App Router only — an auditor who checks would find a control whose scope you cannot state. Nor do you cite closure encryption, because the documentation explicitly declines to recommend relying on it.

---

← [05 · RSC serialization: the mechanism](05-rsc-serialization-hardening-lessons-from-react2shell-cve-202.md) · [Chapter 10 overview](01-explanation.md) · Next → [05c · The Server Function's own serialization surface](05c-the-server-functions-own-serialization-surface.md)
