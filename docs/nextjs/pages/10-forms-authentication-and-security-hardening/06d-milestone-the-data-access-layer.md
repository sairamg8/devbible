---
title: "One module reads the session and every other file in SprintDesk asks it a question — the Data Access Layer is not a folder convention, it is the decision that there is exactly one place where 'who is asking' can be answered"
sidebar_label: "06d · Milestone: the Data Access Layer"
sidebar_position: 162
description: "Chapter 10's capstone, step three: the server-only DAL, getCurrentUser() memoised with React's cache(), why it returns a DTO class rather than a database row, the difference between the nullable and the throwing variant, and why no component in the app is allowed to read a cookie."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security)
> (`lastUpdated: 2026-08-25`), the [Authentication guide](https://nextjs.org/docs/app/guides/authentication)
> (`lastUpdated: 2026-08-25`), React's [`cache`](https://react.dev/reference/react/cache) and
> [`experimental_taintUniqueValue`](https://react.dev/reference/react/experimental_taintUniqueValue).
> Target: **Next.js 16.3.4** · React 19.2.8 · **`next-auth` 5.0.0-beta.32** · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**This is the page the rest of the milestone is built on, and its whole content is one architectural commitment: `auth()` is called in exactly one module, and everything else in SprintDesk calls `getCurrentUser()`.** Not because indirection is virtuous, but because the alternative — every component reaching for the session itself — makes "is this path authorized?" a question you answer by reading the whole codebase. The Data Security guide states the shape in three bullets, and each of them is load-bearing: the layer only runs on the server, it performs authorization checks, and it returns safe, minimal Data Transfer Objects. The third one is the one people skip, and skipping it is how a password hash ends up in an RSC payload.

## The three rules, quoted

> *"For new projects, we recommend creating a dedicated **Data Access Layer (DAL)**. This is an internal library that controls how and when data is fetched, and what gets passed to your render context."*
>
> *"A Data Access Layer should:*
> *— Only run on the server.*
> *— Perform authorization checks.*
> *— Return safe, minimal **Data Transfer Objects (DTOs)**."*
> — [Data Security, Data Access Layer](https://nextjs.org/docs/app/guides/data-security#data-access-layer) (`lastUpdated: 2026-08-25`)

And the reason the *centralising* matters more than any individual check:

> *"This guarantees that wherever `getUser()` is called within your application, the auth check is performed, and prevents developers from forgetting to check that the user is authorized to access the data."*
> — [Authentication, Layouts and auth checks](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks) (`lastUpdated: 2026-08-25`)

Read that as a claim about *people*, not about code. The DAL is not more secure per line than a check written inline. It is more secure because the next developer, writing the next action, at speed, cannot reach the data without going through it.

## Step 1 — the session read, wrapped once

`auth()` comes from `lib/auth.ts`. It is called here and nowhere else in the application.

```ts filename="lib/dal/session.ts"
import 'server-only'

import { cache } from 'react'
import { auth } from '@/lib/auth'

/** The narrowest thing the rest of the app is allowed to know from the cookie. */
export type SessionInfo = {
  userId: string
}

/**
 * The ONLY call site of `auth()` in SprintDesk.
 * Returns null for a signed-out visitor — deciding what to do about that is
 * the caller's job, and the two callers that exist are below.
 */
export const readSession = cache(async (): Promise<SessionInfo | null> => {
  const session = await auth()
  const userId = session?.user?.id
  return userId ? { userId } : null
})
```

Three things about that file.

**It returns a `userId` and nothing else.** Auth.js's session object carries a `user` with `name`, `email` and `image` on it, and it is tempting to pass that straight through. Do not: the session object's shape is the library's, and this module exists so that replacing the library is a one-file diff. The `SessionInfo` type is SprintDesk's contract with itself.

**`cache()` wraps it.** React's `cache` memoises the return value for the duration of a render pass, which is why nine components can each ask who the user is and the database sees one session lookup. The Authentication guide names exactly this use — using React's cache API to memoize the return value of the function during a React render pass.

⚠️ **What `cache()` does outside a render is not something I found stated.** The guide tells you to invoke the DAL function in *"your data requests, Server Actions, Route Handlers"*, so calling it there is endorsed; whether the memoisation deduplicates two calls inside one Server Action invocation is not something the documentation settles. Treat `cache()` as an optimisation during render and never as a correctness guarantee anywhere — the code above is correct if it runs twice.

**`import 'server-only'`.** The guide's rule for it is unambiguous: it *"ensures that proprietary code or internal business logic stays on the server by causing a build error if the module is imported in the client environment."*

## Step 2 — `getCurrentUser()`, which returns a DTO and not a row

Here is where the projection happens, and it is the difference between a leak and a page.

```ts filename="lib/dal/user.ts"
import 'server-only'

import { cache } from 'react'
import { db } from '@/lib/db'
import { readSession } from './session'

/**
 * A class, not an object literal — deliberately. Classes cannot be serialized
 * into the RSC payload, so an accidental `<Client user={user} />` is a build-time
 * failure rather than a page that ships whatever this object happens to hold.
 */
export class CurrentUser {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly avatarUrl: string | null,
  ) {}

  /** The explicit, auditable projection that IS allowed to cross to the client. */
  toClient(): { id: string; name: string; avatarUrl: string | null } {
    return { id: this.id, name: this.name, avatarUrl: this.avatarUrl }
  }
}

/** null for a signed-out visitor. Use this when signed-out is a legitimate state. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession()
  if (!session) return null

  const row = await db.user.findUnique({
    where: { id: session.userId },
    // Name the columns. Never `select: undefined`, never a bare findUnique.
    select: { id: true, name: true, image: true },
  })
  if (!row) return null

  return new CurrentUser(row.id, row.name ?? 'Unnamed', row.image)
})
```

### Why `select` is written out

`db.user.findUnique({ where })` with no `select` returns every column, and the `User` table gained columns you did not choose: `email`, `emailVerified`, and whatever the next feature adds — a billing customer id, a locale, an internal risk flag. The Authentication guide's instruction is to explicitly return the columns you need rather than the whole user object, and the Data Security guide's version is blunter: *"When retrieving data, it's recommended you return only the necessary data that will be used in your application, and not entire objects."*

The failure this prevents is not exotic. Someone adds a `stripeCustomerId` column in March; in April a Server Component passes `user` to a Client Component that renders the name; the customer id is now in the HTML of every authenticated page. Nothing broke, nothing warned, and the column was added by a different team.

### Why a class

The guide gives the reason in a code comment, and it is the most actionable sentence in the whole page:

> *"Don't include secret tokens or private information as public fields. Use classes to avoid accidentally passing the whole object to the client."*
> — [Data Security, Data Access Layer](https://nextjs.org/docs/app/guides/data-security#data-access-layer)

The mechanism behind it is stated separately:

> *"Functions and classes are already blocked from being passed to Client Components by default."*
> — [Data Security, Tainting](https://nextjs.org/docs/app/guides/data-security#tainting)

So `<UserMenu user={user} />` where `UserMenu` is a Client Component and `user` is a `CurrentUser` **fails**, rather than serializing. To cross the boundary you have to write `user.toClient()`, which is a line a reviewer can see and an auditor can grep for. The projection stops being implicit.

That is a far stronger guarantee than a naming convention, and it costs one class.

### The nullable variant and the throwing variant

Two callers, two needs. A marketing page wants to show "Sign in" or a name; a board page has nothing to render for a signed-out visitor. Both exist:

```ts filename="lib/dal/user.ts"
import { redirect } from 'next/navigation'

/**
 * For every path where signed-out is not a renderable state.
 * Throws by redirecting, so callers get a non-null user and no `!` assertions.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/sign-in')
  }
  return user
}
```

`redirect()` interrupts by throwing, so `requireUser()` either returns a user or does not return. That is why its signature has no `| null` in it and why no caller ever writes `user!`. A non-null return type that is honest is worth more than a runtime check, because the type checker then enforces the guard at every future call site for free.

🔴 **`requireUser()` redirects; it does not "return unauthorized".** If you are in a Route Handler, a redirect is the wrong response and you want a `401`. Use `getCurrentUser()` there and construct the response yourself — the Authentication guide's Route Handler example returns `new Response(null, { status: 401 })` for no session and `403` for the wrong role, and those two codes mean different things to a client that is not a browser.

## Step 3 — nothing else reads a cookie

This is the rule that makes the previous two pages worth anything, and it is enforceable rather than aspirational:

```bash
# Should return exactly the DAL. Anything else is a finding.
grep -rn "from 'next/headers'" app/ lib/ --include='*.ts' --include='*.tsx'
grep -rn "from '@/lib/auth'" app/ lib/ --include='*.ts' --include='*.tsx'
```

The second grep should match `lib/dal/session.ts` and `app/api/auth/[...nextauth]/route.ts` and nothing else. When it matches a component, you have a second source of truth about identity, and the two will disagree eventually — usually the day someone adds a role.

The guide draws the same boundary from the client's side:

> *"Client Components can't import the DAL. Run `verifySession()`, `getUser()`, or similar in a parent Server Component, then pass data to client children as props or through a context provider."*
> — [Authentication, Auth and streaming](https://nextjs.org/docs/app/guides/authentication#auth-and-streaming) (`lastUpdated: 2026-08-25`)

The provider pattern that does this without prop drilling — passing the *unawaited promise* into context so only the consumers suspend — is built in [13 · Auth with Cache Components: sharing and caching](13-authentication-with-cache-components-sharing-caching-and-mutating.md). SprintDesk uses it verbatim for the header avatar.

## Gotchas

**★ Symptom: a Client Component renders the user's name and the page source also contains their email.** Cause: `db.user.findUnique({ where })` without a `select`, so the DTO carried every column, and the whole object was passed as a prop. Fix — the projection is the `select`, and it is not optional:

```ts
const row = await db.user.findUnique({
  where: { id: session.userId },
  select: { id: true, name: true, image: true },
})
```

**★ Symptom: a column added by another team six months later appears in your page's HTML.** Cause: the same missing `select`, discovered late. This is why the fix above is written as an allow-list rather than as an exclusion — `select` names what is included, so a new column is invisible by default. An `omit`-style exclusion list would have needed editing by the team that added the column, which is to say it would not have been edited.

**★ Symptom: `<UserMenu user={user} />` throws a serialization error when `UserMenu` becomes a Client Component.** Cause: `CurrentUser` is a class, and functions and classes are blocked from being passed to Client Components by default. Fix: this is the feature working. Cross the boundary explicitly.

```tsx
<UserMenu user={user.toClient()} />
```

**★ Symptom: nine components each show the signed-in user's name and the database shows nine session lookups per page.** Cause: the DAL function was not wrapped in React's `cache`. Fix — one wrapper, and the guide names this exact use:

```ts
export const getCurrentUser = cache(async () => { /* ... */ })
```

**★ Symptom: a Route Handler redirects an API client to `/sign-in` and the client parses an HTML login page as JSON.** Cause: `requireUser()` was used in a Route Handler, and it redirects. Fix: use the nullable variant and answer in the protocol the caller speaks.

```ts filename="app/api/boards/route.ts"
import { getCurrentUser } from '@/lib/dal/user'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new Response(null, { status: 401 })
  // ...
}
```

**★ Symptom: `auth()` is imported in a component "just for this one check" and six months later there are eleven call sites with three different notions of what counts as signed in.** Cause: the DAL's boundary was a convention rather than a check. Fix: make it a grep in CI. `grep -rn "from '@/lib/auth'" app/ lib/` must match only `lib/dal/session.ts` and the Auth.js Route Handler; anything else fails the job. A rule nothing enforces is a comment.

**★ Symptom: `getCurrentUser()` returns null for a user who is definitely signed in, immediately after you deleted their account row in a test.** Cause: the session row survived the user row, so the cookie resolves to a `userId` with nothing behind it — `readSession()` succeeds and the `findUnique` returns nothing. Fix: the schema-level cascade in [06b](06b-milestone-wiring-authjs-into-the-app-router.md), plus the `if (!row) return null` in `getCurrentUser` above, which is why that line exists rather than being an impossible branch.

**★ Symptom: TypeScript is satisfied because every call site writes `user!`.** Cause: only the nullable variant exists, so every caller asserts. Fix: `requireUser()`, whose return type is `Promise<CurrentUser>` with no null in it because `redirect()` throws. The non-null assertion operator in an auth path is a code smell precisely because it is the place where a null actually happens.

**★ Symptom: the DAL is correct, the DTO is minimal, and a user still loads someone else's board.** Cause: identity was resolved safely and then never used in the query. A perfect `getCurrentUser()` says who is asking; it does not say what they may have. Fix: put the user in the `WHERE` clause of every read, which is [06f](06f-milestone-authorization-on-the-board.md) in full.

**★ Symptom: `readSession()` is fine in development and returns null in production for users who just signed in.** Cause: something upstream is not preserving the session cookie — most often a reverse proxy stripping `Set-Cookie`, or `AUTH_TRUST_HOST` unset so the cookie was written for the wrong host. Fix: this is an environment defect, not a DAL defect, and [06c](06c-milestone-the-environment.md) has both. Resist the temptation to "fix" it by loosening `sameSite` or dropping `secure` on the cookie: that converts a configuration bug into a CSRF surface.

## Interview questions

**★ Why does the DAL return a DTO rather than the database row, when the row is right there and the extra type is more code?**
Because the row's shape is owned by the schema, and the schema changes without your page's knowledge. A `select`-less query returns whatever columns exist today, so passing "the user" to a component is passing an open-ended promise that no future column will be sensitive. The Data Security guide's instruction is to return only the necessary data and not entire objects, and the DTO is what makes that instruction enforceable rather than a habit: the projection is written once, in one file, and adding a field to it is a diff someone reviews.

**★ What does making the DTO a class actually buy you over an object literal with the same fields?**
A compile-and-run-time boundary instead of a convention. The docs state that functions and classes are already blocked from being passed to Client Components by default, so a class instance cannot be serialized into the RSC payload — an accidental `<Client user={user} />` fails instead of shipping. With an object literal, the same mistake succeeds silently, and its blast radius is whatever fields the object happens to hold at that moment. The class forces an explicit `toClient()` at the boundary, which is a reviewable line and a greppable one.

**★ Why wrap the session read in React's `cache()`, and what does that not give you?**
It memoises the result for the duration of a render pass, so a page whose header, sidebar and body all ask who the user is performs one lookup rather than three — which matters a great deal once you have chosen database sessions and the lookup is a query. What it does not give you is a guarantee outside render. The guide endorses calling DAL functions from Server Actions and Route Handlers, but does not state what the memoisation does there, so the code has to be correct if it runs twice. Treat it as an optimisation, never as a lock or a once-only.

**★ Two functions, `getCurrentUser()` and `requireUser()`. Why not one?**
Because "signed out" is a renderable state in some places and an impossible state in others, and collapsing them produces one of two bugs. If the only function redirects, a marketing page that wants to show a "Sign in" link cannot use it without redirecting the visitor it was trying to greet — and a Route Handler ends up returning an HTML login page to a JSON client. If the only function is nullable, every caller writes `user!` and the type system stops helping. Two functions with honest signatures push the decision to the call site, where the context to make it actually exists.

**★ How would you prove, at review time, that nothing outside the DAL reads the session?**
With a grep in CI, not with a code-review guideline. `grep -rn "from 'next/headers'" app/ lib/` and `grep -rn "from '@/lib/auth'" app/ lib/` should each match a known, tiny allow-list — `lib/dal/session.ts` and the Auth.js catch-all Route Handler. The check is cheap, it fails loudly on the pull request that introduces the second source of truth, and it is the only version of this rule that survives a busy sprint. The Data Security guide's audit section asks the same question in prose; turning it into a command is what makes it hold.

**★ Where does the DAL boundary stop being enough on its own?**
At the point where the DTO is correct and the *query* is not. `getCurrentUser()` returning a safe projection says nothing about whether the board you just loaded belongs to that user — a well-formed identity plus an unfiltered query is still an IDOR. That is why every read in SprintDesk takes the user from the DAL and puts them in the `WHERE` clause rather than checking afterwards, which is the whole of [06f](06f-milestone-authorization-on-the-board.md).

**★ Auth.js already gives you `auth()`, which is one function call. Why add `readSession()` and `getCurrentUser()` on top of it?**
Because `auth()` returns the library's shape, and every file that destructures it takes a dependency on that shape. `next-auth` currently publishes its App Router line under a `beta` tag and the project has become part of Better Auth — so the probability of that shape changing is not zero, and the cost of the change is proportional to how many files know about it. Wrapping it also lets you narrow: `auth()` hands back a `user` object with name, email and image on it, and SprintDesk's `SessionInfo` deliberately carries only a `userId`, so a component cannot accidentally render an email it was never supposed to have.

---

← [06c · The environment, and the single reader of `process.env`](06c-milestone-the-environment.md) · [Chapter 10 overview](01-explanation.md) · Next → [06e · The layout is not a boundary](06e-milestone-the-layout-is-not-a-boundary.md)
