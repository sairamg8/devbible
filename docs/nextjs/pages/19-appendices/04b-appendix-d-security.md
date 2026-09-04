---
title: "Appendix D · part 2 — security is the half of the checklist that has not aged, and every item on it assumes a mental model most teams do not have"
sidebar_label: "11 · Appendix D — security"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to optimize your Next.js application for production](https://nextjs.org/docs/app/guides/production-checklist) (`lastUpdated: 2026-03-10`), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`) and the [Next.js Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**. Documentation-verified; **no sandbox run, no timings**.

**[Part 1](04-appendix-d-production-readiness-checklist-security.md) showed that the official checklist's tooling advice is six months behind. Its security advice is the opposite: every item still holds, and every item is denser than it looks. Four short bullets encode the entire threat model of a React Server Components application — that props crossing the server/client boundary are on the wire, that a Server Action is a public HTTP endpoint regardless of where you call it from, that an environment variable's prefix decides whether it reaches a browser, and that the framework will not stop you doing any of it. This page expands each into the mechanism it assumes, plus the two 16-era additions the checklist has not caught up with.**

## 1 · Server Actions — the item that carries the most weight

> *"**Server Actions**: Verify authentication and authorization inside each action. Do not rely on Proxy or layout or page level checks alone. Move database access to a `server-only` Data Access Layer and consider rate limiting for expensive operations."*

Four instructions in one bullet. Take them one at a time.

### "Inside each action"

Because a Server Action is a public endpoint. The glossary's definition is what makes this concrete:

> **Server Action** — *"A Server Function that is passed to a Client Component as a prop or bound to a form action."*

The moment a `"use server"` function crosses that boundary it acquires an ID and an HTTP entry point. Anyone can call it, in any order, with any arguments, without ever loading the page it lives on.

```ts
// BAD — the check is in the page; the action is reachable without it.
// app/projects/[id]/page.tsx
export default async function Page({ params }: PageProps<'/projects/[id]'>) {
  const session = await auth()
  if (!session) redirect('/login')
  return <DeleteButton projectId={(await params).id} />
}
```

```ts
// GOOD — the check is where the entry point is.
'use server'
import { auth } from '@/app/lib/auth'

export async function deleteProject(projectId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  if (!(await session.canDelete(projectId))) throw new Error('Forbidden')
  await db.projects.delete(projectId)
}
```

🔴 **Note what the "GOOD" version checks twice.** Authentication — *who is this* — and authorization — *may they do this to this object*. A session check alone gives you a horizontal privilege escalation: any logged-in user can delete any project by passing a different ID.

### "Do not rely on Proxy… alone"

The checklist names Proxy first, and the reason is stronger in 16 than when the sentence was written. `proxy` runs before the request completes and is a routing concern; it does not run when a Server Action is invoked from an already-loaded page. A `proxy.ts` that gates `/admin/*` protects the *page*, not the actions the page happens to contain.

### "Move database access to a `server-only` Data Access Layer"

`server-only` is the enforcement, not the convention. Importing it into a module makes that module a build error if it ever ends up in a client bundle:

```ts
// app/lib/dal.ts
import 'server-only'
import { auth } from '@/app/lib/auth'

export async function getProjectForUser(projectId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  return db.projects.findFirst({
    where: { id: projectId, members: { some: { userId: session.userId } } },
  })
}
```

The authorization lives in the query's `where` clause, which is the strongest form available: a user who is not a member does not get a "Forbidden" — they get nothing, because the row was never selected. Rules that live in the query cannot be forgotten at a call site.

### "Consider rate limiting for expensive operations"

Because the action is an endpoint, it can be called in a loop. Anything that sends an email, runs a report, calls a paid API or writes a large row needs a limit that is enforced server-side inside the action, not by a disabled button.

## 2 · Tainting — the API that exists because props are on the wire

> *"**Tainting**: Prevent sensitive data from being exposed to the client by tainting data objects and/or specific values."*

The mechanism this defends is the one from [Appendix A part 1](01-appendix-a-glossary-ppr.md): props crossing into a Client Component are serialized into the RSC Payload, and the browser receives the whole object — every column, not just the fields your JSX renders.

The 16 upgrade guide points at the same API for a second reason, which is worth knowing because it is a *newer* hazard:

> *"Use the taint API to prevent accidentally passing sensitive server values to Client Components."*

That sentence appears in the section on the **removal of `serverRuntimeConfig`**. Teams migrating off runtime config move secrets into `process.env` reads, and a `process.env` read is a plain string that will serialize into a prop without complaint. Tainting turns that into a build-time failure instead of a disclosure.

```ts
// app/lib/user.ts
import { experimental_taintObjectReference as taintObjectReference } from 'react'
import 'server-only'

export async function getUser(id: string) {
  const user = await db.users.findById(id)
  taintObjectReference(
    'Do not pass the whole user object to the client — project the fields you need',
    user,
  )
  return user
}
```

⚠️ **Tainting is a safety net, not the design.** The design is projection at the boundary:

```tsx
// The object never leaves the server; three fields do.
const { id, displayName, avatarUrl } = await getUser(userId)
return <ProfileCard user={{ id, displayName, avatarUrl }} />
```

## 3 · Environment variables — one prefix, two entirely different threat models

> *"**Environment Variables**: Ensure your `.env.*` files are added to `.gitignore` and only public variables are prefixed with `NEXT_PUBLIC_`."*

Read the second clause carefully: **only public variables are prefixed**, not *all public variables must be prefixed*. The prefix is a publication decision. `NEXT_PUBLIC_` means "inline this value into the client bundle", and once a build has shipped, that value is public forever — rotating it is the only remediation.

Two 16-era additions the checklist has not caught up with:

**`serverRuntimeConfig` and `publicRuntimeConfig` were removed.** Environment variables are the replacement, and the substitution is not one-for-one: a `process.env` read at module scope is **baked in at build time**, while runtime config was read per request. Where the value must be read at request time:

```tsx
import { connection } from 'next/server'

export default async function Page() {
  await connection()
  const config = process.env.RUNTIME_CONFIG
  return <p>{config}</p>
}
```

🔴 **The failure mode here is silent and environment-specific.** On a developer's machine, build-time and runtime values are usually identical, so a naive migration works locally and freezes a staging value into a production build.

**Docker build arguments are the same trap wearing different clothes.** Anything referenced during `next build` is in the image; anything read at runtime is not. [Chapter 16](../16-deployment-scaling-and-observability/01-explanation.md) covers the containerization side.

## 4 · Content Security Policy

> *"**Content Security Policy**: Consider adding a Content Security Policy to protect your application against various security threats such as cross-site scripting, clickjacking, and other code injection attacks."*

The Next.js-specific difficulty is that a strict CSP and a framework that inlines scripts are in tension, so the workable approach is a per-request nonce generated in `proxy.ts` and threaded through — which is exactly why the `middleware` → `proxy` rename matters to this item. If you renamed the file, your CSP header logic moved with it, and the runtime it now runs on is Node.js and not configurable.

The related header surface is `headers()` in `next.config`, which is where the non-CSP headers belong — `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

## Gotchas

**★ Symptom: an authorization bug where any logged-in user can act on any record.** Cause: the action checks authentication and not authorization — a session exists, so the call proceeds, whatever ID was passed. Fix: check the *relationship*, ideally in the query itself so it cannot be skipped.

```ts
return db.projects.findFirst({
  where: { id: projectId, members: { some: { userId: session.userId } } },
})
```

**★ Symptom: `proxy.ts` gates `/admin/*`, and an attacker mutates admin data anyway.** Cause: Proxy runs on requests for pages; a Server Action invoked from an already-loaded page is a different entry point. Fix: check inside the action. The checklist says this in as many words — *"Do not rely on Proxy or layout or page level checks alone."*

**★ Symptom: a database helper compiles into a client bundle and nobody notices until a secret is in the browser.** Cause: nothing marks the module as server-only, so an innocent import from a Client Component pulls it across. Fix: `import 'server-only'` at the top of the module, which turns that import into a build error.

**★ Symptom: a Client Component renders a user's name and their password hash is in the page source.** Cause: the whole row was passed as a prop, and props are serialized into the RSC Payload in full. Fix: project at the boundary, and add `taintObjectReference` on the source object so the next person cannot repeat it.

**★ Symptom: a secret ends up in the client bundle and rotating it is the only fix.** Cause: it was given a `NEXT_PUBLIC_` prefix, which does not mean "make available" — it means "inline into the bundle." Fix: rotate it, then remove the prefix. There is no way to unpublish a value that has already shipped in a build.

**★ Symptom: a config value is correct in staging and frozen at the staging value in production.** Cause: `process.env` read at module scope is evaluated at build time, and the migration off `publicRuntimeConfig` was done as a straight substitution. Fix: `await connection()` before the read when the value must be per-request.

**★ Symptom: a Server Action that sends email is called 10,000 times in an hour.** Cause: the button was disabled in the UI and the endpoint was not limited. Fix: rate limit inside the action, keyed on the authenticated user, before any expensive work.

```ts
'use server'
export async function requestPasswordReset(email: string) {
  const session = await auth()
  if (!(await rateLimit(`reset:${session?.userId ?? email}`, { max: 3, windowSec: 3600 }))) {
    throw new Error('Too many requests')
  }
  await sendResetEmail(email)
}
```

**★ Symptom: after renaming `middleware.ts` to `proxy.ts`, CSP nonces stop matching.** Cause: the codemod moved the file; it did not verify that the header logic still runs where you assumed, and `proxy` is Node.js-only with no configurable runtime. Fix: re-verify the nonce is generated per request and reaches every inline script, and read the rename as a behaviour change rather than a refactor.

**★ Symptom: `.env.local` is in the repository.** Cause: `.gitignore` covers `.env` but not the `.env.*` family. Fix: ignore the family, and treat any value that was ever committed as compromised — rotate rather than delete.

**★ Symptom: a Server Action validates its input in the client form and nowhere else.** Cause: treating the form as the boundary. The action accepts whatever arguments a caller sends, including types your form could never produce. Fix: validate inside the action, as its first step, on the assumption that no form was involved.

## Interview questions

**★ Why must authorization live inside a Server Action rather than in the page that renders the form?**
Because they are different entry points. A Server Action passed to a Client Component gets an ID and a public HTTP endpoint; anyone can invoke it directly, with arbitrary arguments, without ever requesting the page. The page's check runs on the page request and simply does not execute on the action invocation. The checklist's phrasing is unusually direct about this — verify inside each action, and do not rely on Proxy, layout or page-level checks alone.

**★ What does `import 'server-only'` actually do, and why is it better than a naming convention?**
It makes the module a build error if it is ever reachable from a client bundle. A convention like `*.server.ts` documents an intention and enforces nothing; `server-only` converts the mistake from a runtime disclosure into a failed build, which means it is caught by the person who made it rather than by an incident. It is the enforcement half of the checklist's Data Access Layer advice, and the DAL is only meaningful with it.

**★ Why is the taint API framed around "accidentally", and what is the accident?**
The accident is that props crossing into a Client Component are serialized into the RSC Payload in full and delivered to the browser — not just the fields the component renders. So passing a database row to render a display name ships every column of that row, including ones you would never print. Nothing warns, because it is a perfectly ordinary prop. Tainting marks an object or value so that passing it across the boundary fails; the actual design is to project the two or three fields you need before the boundary, with tainting as the net.

**★ `NEXT_PUBLIC_` — what is the exact semantics and why is it irreversible?**
It means the value is inlined into the client bundle at build time. Not "readable from the client if requested" — physically present in shipped JavaScript. Once a build carrying it has been served, the value is public and the only remediation is rotation; removing the prefix in a later build does nothing about the builds already in browsers and caches. That is why the checklist's phrasing is *only* public variables are prefixed: the prefix is a publication decision, not an accessibility one.

**★ What is the trap in replacing `publicRuntimeConfig` with environment variables?**
Timing. Runtime config was read per request; a `process.env` read at module scope is evaluated at build time and baked into the output. The straight substitution therefore turns a runtime value into a build-time constant, and it fails silently anywhere the two values coincide — which includes almost every developer machine. The documented fix is to call `connection()` before reading `process.env` when the value must be per-request, and the review question on any such migration is "which environment's value is in this artifact".

**★ How does the `middleware` → `proxy` rename intersect with security?**
Two ways. First, anything security-shaped that lived in `middleware.ts` moved with the file — CSP nonce generation, header injection, auth redirects — and a codemod that renames does not verify the logic still runs where you believe. Second, `proxy` runs on the Node.js runtime and that cannot be configured, so any assumption the old file made about the edge runtime is now false. And underneath both: the rename does not change the fact that Proxy protects page requests and not Server Action invocations, which is the item people most often get wrong.

**★ Rate limiting appears on a checklist as "consider". When is it not optional?**
Whenever the action does something whose cost is borne outside the request — sending email or SMS, calling a metered third-party API, generating a report, writing a large row, or anything that can be used to enumerate. Those are not performance concerns; an unlimited endpoint that sends email is an abuse vector and a bill. The enforcement has to be inside the action and keyed on the authenticated identity, because the disabled button in the UI is not on the path an attacker takes.

**★ A Server Action's arguments came from your own form. Do you still validate them?**
Yes, and on the assumption that no form was involved. The action accepts whatever a caller serializes to it: wrong types, missing fields, IDs belonging to other users, values your form's `select` could never produce. Client-side validation is a user-experience feature. The action's first statement should be a schema parse, and its second should be the authorization check against the parsed values.

---

← [Appendix D part 1 · what the official checklist gets wrong](04-appendix-d-production-readiness-checklist-security.md) · [Chapter 19 overview](01-explanation.md) · Next → [Appendix D part 3 · metadata, a11y and the measurements](04c-appendix-d-metadata-a11y-and-the-measurements.md)
