---
title: "The Data Access Layer is not an abstraction for tidiness — it is the place where the session read, the authorization check and the field filter happen exactly once, and the only place process.env is allowed"
sidebar_label: "The Data Access Layer"
sidebar_position: 120
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) (docs `lastUpdated: 2026-08-25`) and [Data Security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), plus React's [`cache`](https://react.dev/reference/react/cache) and the [`server-only`](https://www.npmjs.com/package/server-only) package. Documentation-verified; no sandbox run.
> Target: **Next.js 16.3.4 · React 19.2.8**. Prior page: [Sessions: the cookie is the control](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md).

**A Next.js application has many entry points — pages, layouts, leaf components, Server Actions, Route Handlers — and every one of them can reach your database directly. A check written at any one of them protects that one. The Data Access Layer is the Next.js docs' answer: a `server-only` module that owns the session read, performs authorization, and returns a minimal DTO, so that the check is attached to the *data* rather than to a route. It is the pattern the docs recommend by name for new projects, and its three rules are short enough to audit.**

## Three rules, from the docs

> *"For new projects, we recommend creating a dedicated **Data Access Layer (DAL)**. This is an internal library that controls how and when data is fetched, and what gets passed to your render context."*

> *"A Data Access Layer should: Only run on the server. Perform authorization checks. Return safe, minimal **Data Transfer Objects (DTOs)**."*

And the rationale:

> *"This approach centralizes all data access logic, making it easier to enforce consistent data access and reduces the risk of authorization bugs. You also get the benefit of sharing an in-memory cache across different parts of a request."*

The last clause is the one people miss. `cache()` around the session read means twelve components can each ask "who is the user" and the cookie is decrypted once per request. That removes the performance argument for hoisting the session into a layout and prop-drilling it — which is the refactor that quietly creates a code path where the check is skipped.

## Rule 1 — only run on the server

```ts
// lib/dal.ts
import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { readSessionCookie } from '@/lib/session-cookie'
import { verifySession as decodeSession } from '@/lib/session'

export type Session = { userId: string; role: 'admin' | 'member' }

export const getSession = cache(async (): Promise<Session | null> => {
  const token = await readSessionCookie()
  if (!token) return null
  const payload = await decodeSession(token)
  if (!payload) return null
  return { userId: payload.userId, role: payload.role }
})

export const requireSession = cache(async (): Promise<Session> => {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
})
```

`import 'server-only'` is one line and it converts a class of silent credential leaks into build failures. Without it, a `'use client'` file that imports `lib/dal.ts` compiles, and your session secret, your database client and your decryption logic are bundled for the browser. With it, that import is a build error. The docs devote a whole section to it — *"Preventing client-side execution of server-only code"* — and it is the cheapest control in this chapter.

Note the two exports. `getSession()` returns `null` for an anonymous visitor, which is what a header that renders a "Sign in" link needs. `requireSession()` redirects, which is what a dashboard needs. Conflating them into one function that always redirects makes it impossible to render a public page with an optional user menu; conflating them into one that always returns `null` makes every caller responsible for remembering the redirect. Two functions, one session read, thanks to `cache()`.

## Rule 2 — perform authorization checks

Authentication answers *who*. Authorization answers *may they*. The DAL is where the second question gets asked, and it must be asked **per resource**, not per route:

```ts
// lib/dal/projects.ts
import 'server-only'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/dal'

export type ProjectDTO = {
  id: string
  name: string
  status: 'active' | 'archived'
}

export async function getProject(projectId: string): Promise<ProjectDTO> {
  const session = await requireSession()

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, status: true, ownerId: true, apiKey: true },
  })

  if (!project) throw new Error('NotFound')
  if (project.ownerId !== session.userId) throw new Error('Forbidden')

  return { id: project.id, name: project.name, status: project.status }
}
```

Two things are deliberate. The ownership comparison happens **after** the row is loaded and **before** anything is returned, because you cannot check ownership of a row you have not read. And the returned object is constructed by hand — `apiKey` and `ownerId` were selected because the check needed them, and neither leaves the function.

The docs give the same shape for mutations, and are explicit that the action should stay thin:

> *"Just as we recommend a Data Access Layer for reading data, you can apply the same pattern to mutations. This keeps authentication, authorization, and database logic in a dedicated `server-only` module, while `\"use server\"` actions stay thin."*

```ts
// lib/dal/projects.ts (continued)
export async function archiveProject(projectId: string) {
  const session = await requireSession()

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })

  if (!project) throw new Error('NotFound')
  if (project.ownerId !== session.userId) throw new Error('Forbidden')

  await db.project.update({ where: { id: projectId }, data: { status: 'archived' } })
}
```

```ts
// app/actions/projects.ts
'use server'

import { revalidatePath } from 'next/cache'
import { archiveProject } from '@/lib/dal/projects'

export async function archiveProjectAction(projectId: string) {
  await archiveProject(projectId) // auth + authz happen inside the DAL
  revalidatePath('/projects')
}
```

A useful note from the docs on where `server-only` may go:

> *"You can use `import 'server-only'` in both the Data Access Layer and the `\"use server\"` file itself. Both work when the action is imported into a Client Component (for example, to pass it to `useActionState`), because `\"use server\"` modules are resolved in a server-only webpack layer."*

## Rule 3 — return a DTO, not a row

> *"When retrieving data, it's recommended you return only the necessary data that will be used in your application, and not entire objects. For example, if you're fetching user data, you might only return the user's ID and name, rather than the entire user object which could contain passwords, phone numbers, etc."*

Where the visible fields depend on *who is looking*, the docs put the predicate in the DAL rather than in the component:

```ts
// lib/dal/profile.ts
import 'server-only'

import { db } from '@/lib/db'
import { getSession, type Session } from '@/lib/dal'

function canSeeEmail(viewer: Session | null, ownerId: string) {
  return viewer?.role === 'admin' || viewer?.userId === ownerId
}

export async function getProfileDTO(slug: string) {
  const [profile] = await db.user.findMany({
    where: { slug },
    select: { id: true, username: true, email: true },
  })
  if (!profile) return null

  const viewer = await getSession()

  return {
    username: profile.username,
    email: canSeeEmail(viewer, profile.id) ? profile.email : null,
  }
}
```

The docs' version carries a comment that is a design instruction rather than a note: *"Don't pass values, read back cached values, also solves context and easier to make it lazy."* The DTO function does not take the viewer as an argument. It reads it back from the cached `getSession()`. That is what makes it impossible for a caller to supply the wrong viewer.

There is a stronger variant the docs name for the current-user object specifically:

> *"Don't include secret tokens or private information as public fields. **Use classes to avoid accidentally passing the whole object to the client.**"*

A class instance is not serializable across the RSC boundary, so passing one to a Client Component is a build-time error rather than a silent leak. That turns "we reviewed it carefully" into "the compiler enforces it".

React's tainting APIs are the belt to that braces — `experimental_taintObjectReference` for objects and `experimental_taintUniqueValue` for values, behind `experimental.taint` in `next.config.js`. The docs are clear about their status: *"it's an additional layer of protection, you should still filter and sanitize the data in your DAL before passing it to React's render context."* They also note *"Functions and classes are already blocked from being passed to Client Components by default"* — which is exactly why the class recommendation works.

## The `process.env` rule

> *"Secret keys should be stored in environment variables, but only the Data Access Layer should access `process.env`. This keeps secrets from being exposed to other parts of the application."*

This reads like a style preference and is not. Once `process.env.SESSION_SECRET` is referenced in exactly one module, "which files can leak the secret" has a one-line answer, and `grep -rn 'process.env' app/ components/` is a complete audit. Scatter it across six modules and the audit becomes a judgement call about which of those six might ever end up in a client bundle.

The docs' own audit checklist puts it the same way:

> *"**Data Access Layer:** Is there an established practice for an isolated Data Access Layer? Verify that database packages and environment variables are not imported outside the Data Access Layer."*

## Where the DAL sits relative to everything else

The DAL is not a replacement for the coarse filter in `proxy.ts`, and the proxy is not a replacement for the DAL. The docs give the ordering plainly:

> *"While Proxy can be useful for initial checks, it should not be your only line of defense in protecting your data. The majority of security checks should be performed as close as possible to your data source."*

A proxy check runs once per navigation and knows only what is in the cookie. A DAL check runs once per *data access* and can consult the database. The mechanics of the proxy layer — matchers, what it can and cannot see, and why an optimistic redirect there is a UX affordance rather than a boundary — belong to **04 · Defence in depth: `proxy.ts` as a coarse filter** *(not written yet)*.

Under Cache Components the DAL still exists but the session read inside it acquires new rules; those are covered in [12 · Auth with Cache Components: the session read](12-authentication-with-cache-components-reading-the-session.md) and [13 · sharing, caching and mutating](13-authentication-with-cache-components-sharing-caching-and-mutating.md).

## Gotchas

**★ Symptom: a page renders correctly for its owner and also for anyone who guesses another owner's project id.** Cause: the DAL function checked `requireSession()` — authentication — and then queried by the id it was handed, without comparing the row's owner. Authentication was present; authorization was absent. Fix: compare the loaded row against the session before returning anything.

```ts
const project = await db.project.findUnique({ where: { id }, select: { ownerId: true, name: true } })
if (!project) throw new Error('NotFound')
if (project.ownerId !== session.userId) throw new Error('Forbidden')
```

**★ Symptom: `SESSION_SECRET` appears in a client bundle.** Cause: a module that reads `process.env` was imported, directly or transitively, from a `'use client'` file. Fix: `import 'server-only'` at the top of every module that touches secrets or the database. The import fails the build at the point of violation rather than shipping.

```ts
import 'server-only'
const secret = process.env.SESSION_SECRET
```

**★ Symptom: twelve database round-trips to the sessions table for one page render.** Cause: `verifySession()` was written without `cache()`, so every component that called it re-decrypted the cookie and re-queried. Fix: wrap it in React's `cache` — it memoizes for the duration of one render pass, which is exactly the scope you want.

```ts
import { cache } from 'react'
export const getSession = cache(async () => { /* read + verify once per request */ })
```

**★ Symptom: a Client Component receives an object containing `passwordHash`.** Cause: a DAL function returned the Prisma row. `select` was written for the *query*, not for the *response*, so fields needed by the ownership check travelled onward. Fix: construct the returned object explicitly; never `return row`.

```ts
return { id: project.id, name: project.name, status: project.status }
```

**★ Symptom: the auth check exists in the layout, and a nested route segment renders unauthenticated data anyway.** Cause: a layout does not gate its children. The docs are explicit — *"A layout also does not control whether the rest of the route renders. Route segments and parallel route slots are rendered by the router, so a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload."* Fix: move the check into the DAL function the segment's data comes from, so it fires wherever that data is requested.

**★ Symptom: the session was verified on page load, and a Server Action defined in that page runs for an unauthenticated caller.** Cause: the page-level check gates the render, not the action. The docs: *"A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action."* Fix: the action's first line is a DAL call; see [03g · Authorization](03g-authorization-ownership-checks-and-every-entry-point.md).

**★ Symptom: the DTO function takes `viewer` as an argument, and one call site passes the profile owner instead of the current user, exposing private fields.** Cause: making the viewer a parameter makes it forgeable by a caller. Fix: read it back from the cached session inside the function, which is precisely what the docs' comment *"Don't pass values, read back cached values"* is telling you to do.

**★ Symptom: a static route serves one user's data to another.** Cause: the DAL protects data fetched at request time, but a statically rendered route fetched its data at build time — there was no request and therefore no session. The docs flag this directly: *"for static routes that share data between users, data will be fetched at build time and not at request time. Use Proxy to protect static routes."* Fix: make the route dynamic by reading the session in it, or gate it at the proxy layer if it must stay static.

**★ Symptom: `experimental_taintUniqueValue` is imported and nothing is blocked.** Cause: tainting requires the config flag. Fix: enable it, and treat it as secondary regardless.

```js
// next.config.js
module.exports = { experimental: { taint: true } }
```

## Interview questions

**★ Why does a Data Access Layer reduce authorization bugs more than a middleware guard does?**
Because it binds the check to the data rather than to a path. A middleware guard protects the routes whose patterns you remembered to list; a DAL function protects the data no matter which of the many entry points asked for it — a page, a leaf component, a Server Action, a Route Handler, or a function you have not written yet. New code that reaches for the data gets the check for free, and the failure mode of forgetting becomes "no data" rather than "unchecked data".

**★ What exactly does `import 'server-only'` do, and what does it not do?**
It is a package whose browser entry point throws at build time, so any module graph that reaches it from a client bundle fails to compile. That makes it a compile-time guarantee that the module never ships to the browser. What it does *not* do is authorize anything, prevent the module from being called by an unauthenticated request, or stop you returning a secret from a Server Action's return value. It answers exactly one question — "can this code end up in the browser" — and answers it completely.

**★ Why wrap the session read in React's `cache()` rather than a module-level variable?**
Because a module-level variable is shared across concurrent requests on the same server instance, which is a cross-user data leak waiting to happen. `cache()` memoizes per render pass, so the scope is exactly one request. It gives the deduplication you wanted with none of the sharing you did not.

**★ The docs say to "use classes to avoid accidentally passing the whole object to the client". What is the mechanism?**
Class instances are not serializable across the RSC boundary — the docs note that *"functions and classes are already blocked from being passed to Client Components by default"*. So if your current-user object is a class instance rather than a plain object, an attempt to hand it to a Client Component is a build-time error instead of a silent serialization of every field, including ones added later by someone who did not know the object crossed that boundary.

**★ Why should only the DAL read `process.env`?**
Because it makes the blast radius auditable. With the rule in place, "which modules could leak a secret" is answered by listing the DAL's files, and a grep for `process.env` outside that directory is a hard failure rather than a discussion. Without it, every module that reads an environment variable is one careless client import away from bundling a secret, and no review can reliably catch that at scale. The docs' own audit checklist asks for exactly this property.

**★ Your DAL returns `null` when the user is not authenticated. A colleague changes it to `redirect('/login')` so callers cannot forget. What breaks?**
Every page that legitimately renders for anonymous visitors — a marketing page with an optional user menu, a public profile, the login page itself. A single always-redirecting accessor makes optional authentication impossible to express. The fix is two functions over one cached read: `getSession()` returning `Session | null`, and `requireSession()` redirecting. The cost is nothing, because `cache()` means both hit the same decrypt.

**★ How do you audit an existing codebase against this pattern?**
Follow the docs' own checklist. Grep for direct database client imports outside the DAL directory and for `process.env` outside it; both should be empty. Then, for every `'use server'` file: are the arguments validated, is the user re-authorized inside the action, does it check *ownership* of the specific resource rather than merely that someone is logged in, and are return values filtered to what the client needs. Those five questions find most real authorization defects, and none of them require reading the UI.

---

← [Sessions: the cookie is the control](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md) · [Chapter 10 overview](01-explanation.md) · Next → [Stateless vs stateful sessions](03c-stateless-vs-stateful-sessions-the-revocation-question.md)
