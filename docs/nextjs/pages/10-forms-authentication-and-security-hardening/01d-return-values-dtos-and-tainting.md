---
title: "Whatever a Server Action returns is serialized and shipped to the browser whether or not the UI renders it, which makes the return type a disclosure decision and the DTO the only real control"
sidebar_label: "01d · Return values, DTOs and tainting"
sidebar_position: 4
description: "Why returning an ORM record leaks columns nobody added yet, the viewer-shaped DTO, the class trick that turns a leak into a build error, React's serializable set, and why tainting is a tripwire rather than a boundary."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), the React reference for [`experimental_taintObjectReference`](https://react.dev/reference/react/experimental_taintObjectReference) and [`'use client'`](https://react.dev/reference/rsc/use-client), and [Environment Variables](https://nextjs.org/docs/app/guides/environment-variables).
> Target: **Next.js 16.3.4 · React 19.2.8**. Documentation-verified; **no sandbox run**.

**[01c](01c-what-crosses-the-wire-modules-and-closures.md) covered what reaches the action. This is what leaves it. The asymmetry is that inbound data is obviously untrusted and everyone validates it, while outbound data feels like *our* data and gets no scrutiny at all — so the leak is almost never a secret someone forgot to hide, it is a column somebody added to a table two sprints after the action was written.**

## Return values are a client payload

> *"Server Action return values are serialized and sent to the client. Only return what the UI needs, not raw database records."*

```tsx filename="app/actions.ts"
'use server'

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

The `BAD` version is not hypothetical harm. An ORM's `update()` resolves to the whole row, so `passwordHash`, `stripeCustomerId`, `internalNotes`, `isFlaggedForReview` and every column added later travel to the browser. Nothing renders them; the payload contains them anyway, visible in the network tab and readable by any script on the page. **"Nothing renders them" is not a property anyone maintains** — it is an accident that holds until the schema changes, and the schema change is in a different pull request reviewed by a different person.

The same argument applies to the negative space in `useActionState`. If the action returns `{ ok: false, item }` on a validation failure so the form can re-populate, `item` is now on the wire too. Return the fields the form needs to redisplay, not the object you happened to have.

## The DTO is shaped by the viewer, not by the table

The Data Access Layer's job is to answer *what may this viewer see*, once, in a place an auditor can find:

```tsx filename="data/user-dto.tsx"
import 'server-only'
import { getCurrentUser } from './auth'

function canSeeUsername(viewer: User) {
  // Public info for now, but can change
  return true
}

function canSeePhoneNumber(viewer: User, team: string) {
  // Privacy rules
  return viewer.isAdmin || team === viewer.team
}

export async function getProfileDTO(slug: string) {
  // use a database API that supports safe templating of queries
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const userData = rows[0]

  const currentUser = await getCurrentUser()

  // only return the data relevant for this query and not everything
  return {
    username: canSeeUsername(currentUser) ? userData.username : null,
    phonenumber: canSeePhoneNumber(currentUser, userData.team)
      ? userData.phonenumber
      : null,
  }
}
```

Two details in that example are load-bearing and easy to skim past. The visibility predicates are named functions rather than inline conditions, so the privacy policy is greppable. And the current user is *read back* inside the DTO rather than passed in — the guide's own comment says this *"solves context and easier to make it lazy"*, and it also removes the shape where a caller passes the wrong viewer.

The pattern generalises to actions: an action's return type should be a hand-written literal type, never `Awaited<ReturnType<typeof db.user.update>>`. A hand-written type stops compiling when the UI needs a new field, which is the moment you want the decision made.

## The class trick

The guide's session helper carries a comment that reads like a style note and is actually a control:

> *"Use classes to avoid accidentally passing the whole object to the client."*

It works because of a React rule stated in the same guide:

> *"Functions and classes are already blocked from being passed to Client Components by default."*

```ts filename="data/auth.ts"
import { cache } from 'react'
import { cookies } from 'next/headers'

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const decodedToken = await decryptAndValidate(token)
  // Don't include secret tokens or private information as public fields.
  // Use classes to avoid accidentally passing the whole object to the client.
  return new User(decodedToken.id)
})
```

Because `User` is a class instance it cannot cross the boundary, so `<Profile user={currentUser} />` fails instead of leaking. The serializable set is enumerated in React's [`'use client'` reference](https://react.dev/reference/rsc/use-client): primitives, plain objects, arrays, `Map`, `Set`, typed arrays, `Date`, JSX elements, Promises and Server Functions cross; *"Classes"*, class instances, null-prototype objects, non-global symbols and non-exported functions do not.

Note the `cache()` wrapper as well. The guide's reasoning is worth quoting because it is about leakage, not performance:

> *"Cached helper methods makes it easy to get the same value in many places without manually passing it around. This discourages passing it from Server Component to Server Component which minimizes risk of passing it to a Client Component."*

Per-request memoisation is being used here to remove prop-drilling, because prop-drilling a privileged object is how it eventually lands on a `'use client'` boundary.

## Tainting is a tripwire, and its own docs say so

```js filename="next.config.js"
module.exports = {
  experimental: {
    taint: true,
  },
}
```

```ts filename="data/raw-user.ts"
import 'server-only'
import { experimental_taintObjectReference } from 'react'
import { db } from '@/lib/db'

export async function getRawUser(id: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id } })
  experimental_taintObjectReference(
    'Do not pass the raw user record to a Client Component; use getProfileDTO instead.',
    user,
  )
  return user
}
```

Next.js frames it as belt-and-braces:

> *"This prevents the tainted objects or values from being passed to the client. However, it's an additional layer of protection, you should still filter and sanitize the data in your DAL before passing it to React's render context."*

React's own reference is blunter about the hole:

> *"Do not rely on just tainting for security. Tainting an object doesn't prevent leaking of every possible derived value. For example, the clone of a tainted object will create a new untainted object. Using data from a tainted object (e.g. `{secret: taintedObj.secret}`) will create a new value or object that is not tainted. Tainting is a layer of protection; a secure app will have multiple layers of protection, well designed APIs, and isolation patterns."*

So `{...user}` defeats it, `JSON.parse(JSON.stringify(user))` defeats it, and `user.apiKey` was never covered by it — that is what `experimental_taintUniqueValue` is for, and it registers *one value*, not a policy. The honest description: tainting catches the specific accident of handing a whole privileged object across the boundary, with an error message you wrote. It catches nothing that has been through a transformation.

## Gotchas

**★ Symptom: an ORM record returned by an action shows a `passwordHash` field in the network tab.** Cause: the action returned the result of `update()` or `findUnique()` directly, and return values are serialized to the client whether or not the UI reads them. Fix: return a literal, and type it by hand so a new column cannot join it silently.

```ts
type UpdateNameResult = { ok: true; name: string } | { ok: false; code: 'NAME_TAKEN' }

export async function updateName(name: string): Promise<UpdateNameResult> {
  await db.user.update({ where: { id: session.user.id }, data: { name } })
  return { ok: true, name }
}
```

**★ Symptom: `experimental_taintObjectReference` is enabled and a secret still reaches the client.** Cause: tainting registers a *reference*; a clone, a spread or a field read produces a new, untainted value. Fix: keep tainting as the tripwire and let the DTO be the control.

```ts
// Tainting will not stop this — the object is new
const safeLooking = { ...user }
// The DTO is what actually stops it
return { username: user.username }
```

**★ Symptom: a secret is readable in the browser bundle and no action was involved at all.** Cause: it is prefixed `NEXT_PUBLIC_`. *"By default, environment variables are only available on the Server. Next.js exposes any environment variable prefixed with `NEXT_PUBLIC_` to the client."* Fix: rename the variable, redeploy — and **rotate the secret**, because it was published in every build that shipped with the old name.

**Symptom: passing a value to a Client Component throws about something not being serializable.** Cause: you handed it a class instance, a non-exported function or a null-prototype object — none of which are in React's serializable set. Fix: map to a plain object at the boundary. This error is the DAL's class trick working as designed, not an obstacle to route around with a spread.

```ts
// Do not do this — it defeats the control on purpose
<Profile user={{ ...currentUser }} />
// Do this
<Profile user={{ id: currentUser.id, displayName: currentUser.displayName }} />
```

**Symptom: an action returns the submitted values on failure so the form can redisplay them, and one of those values was a password.** Cause: the re-population object was built from the whole parsed payload. Fix: whitelist the fields the form actually re-renders.

```ts
const { password, ...redisplayable } = raw
return { ok: false, errors, values: redisplayable }
```

**Symptom: a value read from the database is `null` in the DTO for admins and non-admins alike.** Cause: the visibility predicate is evaluated against a viewer object that was passed in rather than read back, and the caller passed the profile owner instead of the current user. Fix: read the viewer inside the DTO with the request-cached helper, so there is only one way to obtain it.

**Symptom: a `Date` survives the boundary but a `Decimal`, `ObjectId` or `Buffer` from the driver does not.** Cause: `Date` is in React's serializable set; ORM-specific value objects are class instances and are not. Fix: normalise in the DAL — `.toString()`, `.toNumber()`, or a base64 string — rather than at each call site, so the conversion is not something each new caller has to remember.

**Symptom: the return type of an action is inferred, and a schema change silently widened it.** Cause: `Promise<Awaited<ReturnType<typeof db.post.create>>>` tracks the table. Fix: annotate the action's return type explicitly; the compile error at the moment of the schema change is the whole point.

## Interview questions

**★ Why is returning a database record from an action a problem when the component only renders one field?**
Because the entire return value is serialized and sent to the client. What the component renders is irrelevant — the payload is on the wire and in the browser's memory, visible in the network tab and to any script running on the page. It is also a bug that grows on its own: the day someone adds an `internalRiskScore` column, it starts shipping to browsers with no code change and no review. Returning a hand-typed literal makes the payload an explicit decision that has to be re-made when the shape changes.

**★ What is tainting for, given that it does not stop a spread?**
It is a tripwire for accidents, not a boundary. It catches the specific mistake of handing a whole privileged object to a Client Component — passing `process.env`, passing the raw user record — and turns it into an error carrying a message you wrote. It cannot catch derived values, and React's own documentation says so: the clone of a tainted object is untainted, and `{secret: taintedObj.secret}` is untainted. So it belongs on top of a DAL that already returns DTOs, as the thing that fails loudly when someone bypasses the DAL — never as the reason a raw record is safe to pass around.

**★ Why does the data security guide recommend returning a class instance from the session helper?**
Because class instances are not serializable across the server/client boundary, and React blocks functions and classes from being passed to Client Components by default. Making the current-user object a class turns "someone passed the whole user to a Client Component" from a silent leak into a failure at the boundary. It is a way to make the dangerous thing impossible rather than merely discouraged, and it costs one `class` keyword.

**★ Why wrap the current-user read in `cache()` when the point is security rather than speed?**
Because the alternative to reading it back is passing it around, and a privileged object that is prop-drilled through five Server Components eventually meets a `'use client'` boundary. The guide says exactly that — request-scoped caching *"discourages passing it from Server Component to Server Component which minimizes risk of passing it to a Client Component."* The performance benefit is real but incidental; the design benefit is that there is one way to obtain the viewer and it is cheap enough that nobody invents a second.

**What is the difference between `experimental_taintObjectReference` and `experimental_taintUniqueValue`?**
The first registers an object *reference* as not-for-the-client — the raw user record, `process.env` — and the second registers a specific *value*, such as a key, hash or token, so that the string itself cannot cross even if it was extracted from an untainted object. They cover different failure modes: passing the container versus passing the field. Neither survives a transformation of the data, and both require `experimental.taint` in `next.config.js`.

**How do you keep an action's return type from drifting as the schema evolves?**
Annotate it. An inferred return type follows the ORM, so a new column widens the payload with no diff at the call site and no reviewer prompt. A declared union — success shape, plus a closed set of failure codes — makes the addition of a field a deliberate edit in a file whose name contains the word `actions`, which is where a reviewer is already paying attention.

---

← [01c · What crosses the wire](01c-what-crosses-the-wire-modules-and-closures.md) · [Chapter 10 overview](01-explanation.md) · Next → [01e · The request envelope](01e-the-request-envelope-csrf-size-rate-limits-and-idempotency.md)
