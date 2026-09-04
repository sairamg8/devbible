---
title: "server-only guards exactly one edge — a module specifier entering the client graph — and every real leak this project has to defend against crosses a different one, because values, not modules, are what reach the browser"
sidebar_label: "05b · What it does not protect"
sidebar_position: 7
description: "The five leaks a poison pill is structurally incapable of catching: props riding the RSC payload, the module nobody poisoned, an over-returning Server Action, an unauthorized action call, and every tool that is not the Next.js compiler."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`version: 16.3.4`, `lastUpdated` 2026-08-25) — the RSC payload contents, prop serializability and the `NEXT_PUBLIC_` empty-string substitution are quoted in [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md) — and against the specifier lists and error strings in [`react_server_components.rs`](https://github.com/vercel/next.js/blob/canary/crates/next-custom-transforms/src/transforms/react_server_components.rs) (`canary`, read 2026-09-04).
> Target: **Next.js 16.3.4**, App Router. Documentation- and source-verified; **no sandbox run**; **no penetration testing performed** — the leaks below are derived from the documented transport, not observed.

**[05](05-enforcing-boundaries-with-server-only-client-only-packages.md) established what the poison pill is: a specifier the compiler refuses inside the client module graph. Read that sentence adversarially and the limit is obvious — it constrains which *modules* are compiled for the browser, and a secret is not a module. Every leak that actually happens in an App Router codebase crosses a different edge: a value serialized into the RSC payload, a module nobody thought to poison, a Server Action returning more than it was asked for, an action invoked by someone who should not have been able to, or a build step that is not `next build`. `server-only` catches none of the five. It is a lint for module topology that people file mentally under security, and that misfiling is how the leak gets through.**

## The one edge it guards, drawn precisely

| Edge | Guarded by `server-only`? | What guards it |
|---|---|---|
| A module compiled into the client bundle | ✅ build error | the compiler's specifier list |
| A value serialized into the RSC payload as a prop | ❌ | selecting fields at the boundary |
| A module that reads secrets but has no pill | ❌ | one env module, poisoned, that throws on missing |
| A Server Action's return value | ❌ | an explicit projection, never `select *` |
| Who may invoke a Server Action | ❌ | an authorization check inside the action |
| The same code under Vitest/Jest/ESLint | ❌ | `next build` in CI |

Everything below is one row of that table.

## 1 · A secret passed as a prop

The pill is on the *module*. The *value* is free to travel, and props travel by definition — the RSC payload carries *"any props passed from a Server Component to a Client Component"*, and the payload goes to the browser.

```tsx
// app/settings/page.tsx — a Server Component. No error anywhere in this file.
import 'server-only'
import { getIntegration } from '@/lib/integrations'
import { IntegrationPanel } from './integration-panel'   // 'use client'

export default async function Page() {
  const integration = await getIntegration()
  // 🔴 the whole row, apiSecret included, is serialized into the RSC payload
  return <IntegrationPanel integration={integration} />
}
```

`server-only` is satisfied: `lib/integrations` never entered the client graph. The secret left anyway, in the response body, readable in DevTools by anyone who opens the network tab. **Project down to the fields the component actually renders, at the boundary.**

```tsx
export default async function Page() {
  const { id, provider, connectedAt } = await getIntegration()
  return <IntegrationPanel integration={{ id, provider, connectedAt }} />
}
```

⚠️ **This is not a "view source" leak you can dismiss as low severity.** The payload is fetched again on client-side navigation, cached, and visible to any browser extension with host permissions.

## 2 · A module that nobody poisoned

Coverage is opt-in per module, and the module you forgot is exactly the one that leaks. A `lib/pricing.ts` that reads `process.env.STRIPE_SECRET_KEY` and carries no pill is unprotected — and per [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md) the failure is silent, because Next.js substitutes **an empty string** for an unprefixed environment variable in client code rather than leaving it `undefined`. Nothing throws; a request goes out with an empty `authorization` header and comes back 401.

The countermeasure is architectural rather than per-file. **Have exactly one module that reads `process.env` for secrets**, poison that one, and make everything else reach the secret through it.

```ts
// lib/env.ts — the single door
import 'server-only'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const serverEnv = {
  databaseUrl: required('DATABASE_URL'),
  stripeSecretKey: required('STRIPE_SECRET_KEY'),
  webhookSigningSecret: required('STRIPE_WEBHOOK_SECRET'),
}
```

The `required()` throw is doing independent work from the pill: it converts the empty-string substitution into a loud failure in the cases the compiler never sees, and it fires at module evaluation rather than at the moment the empty header is rejected upstream — a difference of one stack frame versus one afternoon.

Once this module exists, the rule that keeps it working is a grep, not a habit: **`process.env` for anything unprefixed appears in `lib/env.ts` and nowhere else.**

## 3 · A Server Action that returns too much

`'use server'` functions are **callable from the browser by design** — that is what they are for. A Server Action can live in a module that legitimately imports `server-only` and still hand a full database row back to the client component that called it. The pill has no opinion about return values.

```ts
'use server'
import 'server-only'
import { pool } from '@/lib/db'

// 🔴 satisfies every boundary rule and returns password_hash to the browser
export async function loadProfile(id: string) {
  const { rows } = await pool.query('select * from users where id = $1', [id])
  return rows[0]
}
```

```ts
'use server'
import 'server-only'
import { pool } from '@/lib/db'

export async function loadProfile(id: string) {
  const { rows } = await pool.query(
    'select id, display_name, avatar_url from users where id = $1',
    [id],
  )
  return rows[0]
}
```

`select *` at a boundary is the bug. The same applies to an ORM: a bare `findUnique` returns the whole model, and adding a column to the table later widens the response of every action that returned it — a leak introduced by a migration, in a file nobody edited.

## 4 · Who is allowed to call the action

This is the row people are most surprised by, and it is the one with the worst consequences. A Server Action is a **network endpoint**. The client holds a reference to it; the runtime encodes that reference into the payload; invoking it is an HTTP request. Being unable to *import* the module tells you nothing about being unable to *call* the function.

```ts
'use server'
import 'server-only'
import { serverEnv } from '@/lib/env'
import { pool } from '@/lib/db'

// 🔴 any authenticated user can delete any project by calling this with any id
export async function deleteProject(projectId: string) {
  await pool.query('delete from projects where id = $1', [projectId])
}
```

```ts
'use server'
import 'server-only'
import { pool } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function deleteProject(projectId: string) {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  // authorization is part of the statement, so there is no window between check and act
  const { rowCount } = await pool.query(
    'delete from projects where id = $1 and owner_id = $2',
    [projectId, session.userId],
  )
  if (rowCount === 0) throw new Error('Not found')
}
```

**Every Server Action re-authenticates and re-authorizes.** The fact that the UI only renders the delete button for owners is not a control; it is a hint. Hiding a button changes what is rendered, not what is reachable. See [chapter 10](../10-forms-authentication-and-security-hardening/01-explanation.md) for the full treatment.

## 5 · Anything that is not the Next.js compiler

The check runs in the SWC transform during `next dev` and `next build`, and nowhere else. Three consequences:

- **Your test suite does not enforce it.** A Vitest or Jest run importing your modules directly into jsdom applies no such transform, so a poisoned module imports perfectly happily in a test. A green test suite is not evidence that the boundary holds.
- **Your editor does not enforce it.** `tsc` type-checks the import; it has no concept of a client graph. The red squiggle you are used to trusting will not appear.
- **`next lint` does not enforce it.** This is a compiler diagnostic, not an ESLint rule, so a lint-only CI job passes a build that would fail.

**Therefore: `next build` is the only step in your pipeline that verifies the server/client split.** If it is a deploy-time step rather than a required check on the pull request, you find out about boundary regressions after review, from a failed deploy.

## Gotchas

**★ Symptom: a secret is visible in the network response even though every server module is poisoned.** Cause: the value was passed as a prop and rode the RSC payload to the browser. `server-only` constrains modules, not values. Fix: project the object down to the fields the client component actually needs, at the boundary.

```tsx
// ❌ <IntegrationPanel integration={row} />
// ✅ <IntegrationPanel integration={{ id: row.id, provider: row.provider }} />
```

**★ Symptom: a field that was never exposed becomes visible after an unrelated database migration.** Cause: an action or loader returns the whole row (`select *`, or a bare ORM model read), so adding a column widens every response that carries it. Nobody edited the file the leak is in. Fix: enumerate columns at every boundary, and treat "returns the model" as a code-review failure.

```ts
// ❌ const { rows } = await pool.query('select * from users where id = $1', [id])
// ✅ const { rows } = await pool.query('select id, display_name from users where id = $1', [id])
```

**★ Symptom: a user deletes a resource they do not own, and the audit log shows a legitimate session.** Cause: the Server Action trusted its arguments because the button that calls it is only rendered for owners. The action is an HTTP endpoint; rendering is not a control. Fix: re-check authorization inside the action, and put the ownership predicate in the statement rather than in a separate read.

```ts
await pool.query('delete from projects where id = $1 and owner_id = $2', [projectId, session.userId])
```

**★ Symptom: a secret reaches the browser and no build error was raised anywhere.** Cause: the module that read it never imported `server-only` — coverage is opt-in per module, so the gap is exactly where nobody was thinking about it. Fix: centralise secret reads in one poisoned `lib/env.ts` that throws on a missing variable, and make "`process.env` appears only here" a greppable rule.

**★ Symptom: the poison pill is in place, the tests pass, and production leaked anyway.** Cause: the check lives in the Next.js compiler, and Vitest, `tsc` and `next lint` all bypass it. Fix: make `next build` a required CI check on the pull request, not a step that first runs at deploy time.

**Symptom: a client component receives a `Date` or a class instance and arrives as something else.** Cause: props cross the payload and must be serializable; the reconstruction is not necessarily the same object you sent. Fix: send a primitive and rebuild on the client — an ISO string, a number of cents, a plain object — rather than relying on the transport to preserve a type.

```tsx
// ❌ <Row placedAt={order.placed_at} />
// ✅ <Row placedAtISO={order.placed_at.toISOString()} />
```

**Symptom: `NEXT_PUBLIC_` was added to a variable to "make it work" and the secret is now in the bundle.** Cause: the prefix is a deliberate opt-in to inclusion in the client bundle; adding it does exactly what it says. `server-only` cannot help, because the variable is being consumed by code that is legitimately in the client graph. Fix: revert the prefix and move the consumer to the server; a value that needed the prefix to work was being read in the wrong place.

**Symptom: an internal-only API host or S3 bucket name shows up in the payload and nobody classified it as a secret.** Cause: field projection was applied to obvious credentials only. Infrastructure identifiers are reconnaissance even when they are not credentials. Fix: apply the same projection rule to every object that crosses the boundary, and default to naming the fields you send rather than the fields you strip.

**Symptom: an error thrown in a Server Action shows a generic message in production but a full stack in development, and someone "fixes" the inconsistency.** Cause: the two environments deliberately differ; the production redaction is a security behaviour, not a bug. Fix: leave it, and surface a stable error code you control from inside the action instead of re-exposing the underlying error.

```ts
if (rowCount === 0) throw new Error('Not found')   // your string, not the driver's
```

## Interview questions

**★ You have `import 'server-only'` at the top of every data-access module and a secret still showed up in the browser. How?**
Almost certainly as a prop. The pill protects the *module* from crossing into the client graph; it says nothing about *values*, and props passed from a Server Component to a Client Component are part of the RSC payload, which is sent to the browser and refetched on navigation. The other routes are a Server Action returning a `select *` result to its caller, and a module that reads a secret but was never poisoned — where the failure is silent because Next.js substitutes an empty string for an unprefixed environment variable rather than leaving it undefined. The fix in all three cases is the same discipline: project down to the fields the client needs, at the boundary.

**★ Is `server-only` a security control?**
It is better described as a topology lint that has security consequences. It enforces one property — this module specifier does not appear in the client graph — and that property is genuinely useful, because the most common accidental leak is a data-access module drifting into a client subtree. But it is a compile-time check on names, it is opt-in per module, it does not run outside the Next.js compiler, and it has no visibility into values. Calling it a security control invites the conclusion that a poisoned codebase is a safe one, which is exactly the reasoning that lets a `select *` in a Server Action through code review.

**★ Why does hiding a button not protect a Server Action?**
Because the action is an HTTP endpoint and the client holds a reference to it. The runtime encodes that reference into the payload so the browser can invoke it; whether a button rendered is a fact about the DOM, not about reachability. Anyone who can open DevTools can issue the same request with different arguments. So every action re-authenticates and re-authorizes, and the strongest form is to make the authorization part of the statement — `delete … where id = $1 and owner_id = $2` — so there is no window between checking and acting and no second query to forget.

**★ Your CI runs unit tests and type checks but not `next build`. What have you lost?**
The boundary enforcement entirely. The check lives in the SWC transform that Next.js applies during `next dev` and `next build`, so a Vitest run importing modules into jsdom sees nothing, `tsc` type-checks the import without any concept of a client graph, and `next lint` does not carry the rule either because it is a compiler diagnostic rather than an ESLint rule. That makes `next build` the only step in the pipeline that actually verifies the server/client split, which is a strong argument for it being a required pull-request check rather than a deploy-time step.

**A migration added a column and a field leaked. Which control failed?**
Field projection at the boundary, and it failed silently because no code changed. Anything that returns a whole row or a whole ORM model widens automatically as the schema grows, so the leak is introduced by a migration in a file no reviewer opened. The durable fix is that boundaries enumerate the fields they emit — a select list, a mapper, or a schema applied on the way out — so that a new column is invisible until someone deliberately adds it. `server-only` is silent on all of this because no module moved.

**Someone adds `NEXT_PUBLIC_` to an environment variable to stop it reading as empty. What did they just do?**
Opted the value into the client bundle, which is precisely what the prefix means. The empty string they were fighting was the framework telling them the variable was being read by code that ships to the browser; the prefix does not fix the read, it authorises the leak. The correct response is to move the consumer to the server side — usually by fetching in a Server Component and passing a derived, non-secret value down — and `server-only` on the module that reads the variable would have turned the original symptom into a build error before anyone reached for the prefix.

**What is the difference between "the module cannot reach the client" and "the data cannot reach the client"?**
The first is a statement about the build graph and is what `server-only` gives you: no code path compiles that module into the browser bundle. The second is a statement about the response and is what actually matters to a user's data. They are connected but not equivalent, because the server is allowed to send whatever it likes over the payload — that is the entire point of Server Components. Keeping them separate in your head is what stops you from treating a boundary error as the last check that needed to happen.

---

← Prev [05 · server-only / client-only](05-enforcing-boundaries-with-server-only-client-only-packages.md) · [Index](01-explanation.md) · Next → [06 · Bundle size and Core Web Vitals](06-bundle-size-implications-and-core-web-vitals-impact.md)
