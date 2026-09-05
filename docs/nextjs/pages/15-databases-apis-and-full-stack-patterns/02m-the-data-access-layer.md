---
title: "The Data Access Layer is the answer to 'how do I not get this wrong' — one server-only module that authenticates, authorises and returns DTOs, so that adding a second entry point cannot add a second, weaker copy of the rules"
sidebar_label: "02m · The Data Access Layer"
sidebar_position: 27
description: "The three documented data-fetching approaches, what a DAL must do, React.cache for per-request identity, why only the DAL reads process.env, what import 'server-only' actually enforces, classes as an accidental-serialisation guard, and thin actions and handlers over one shared rule."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Data Access Layer*, § *Preventing client-side execution of server-only code*, § *Using a Data Access Layer for mutations*, § *Auditing*) and [Next.js · `use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) — both `version: 16.3.4`.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**Everything in this topic has pointed at one structural fact: a Server Action and a Route Handler are two doors onto the same room, and every security obligation applies identically to both. Writing the checks per door guarantees drift — one copy gets an ownership predicate during an incident and the other does not. A Data Access Layer removes the arithmetic: the number of places a rule lives becomes independent of the number of doors, because the doors are thin and the rule is in a `server-only` module both must pass through. That is not a pattern preference; it is the documented recommendation for new projects, and it is the thing the official audit checklist looks for first.**

## What it is, and who it is for

> *"There are three main approaches we recommend for fetching data in Next.js, depending on the size and age of your project:"*
> *"* HTTP APIs: for existing large applications and organizations.
> * Data Access Layer: for new projects.
> * Component-Level Data Access: for prototypes and learning."*

> *"For new projects, we recommend creating a dedicated **Data Access Layer (DAL)**. This is an internal library that controls how and when data is fetched, and what gets passed to your render context."*

Three obligations define it:

> *"A Data Access Layer should:"*
> *"* Only run on the server.
> * Perform authorization checks.
> * Return safe, minimal **Data Transfer Objects (DTOs)**."*

And the payoff, in the docs' own words:

> *"This approach centralizes all data access logic, making it easier to enforce consistent data access and reduces the risk of authorization bugs. You also get the benefit of sharing an in-memory cache across different parts of a request."*

## The documented shape

```ts
// data/auth.ts
import { cache } from 'react'
import { cookies } from 'next/headers'

// Cached helper methods makes it easy to get the same value in many places
// without manually passing it around. This discourages passing it from Server
// Component to Server Component which minimizes risk of passing it to a Client
// Component.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const decodedToken = await decryptAndValidate(token)
  // Don't include secret tokens or private information as public fields.
  // Use classes to avoid accidentally passing the whole object to the client.
  return new User(decodedToken.id)
})
```

Three deliberate decisions are packed into that eleven-line function.

**`cache()` from React makes identity a per-request singleton.** Any number of call sites get the same `User` without threading it through props, so nobody is tempted to pass the session from Server Component to Server Component — and therefore nobody accidentally passes it into a Client Component.

**The token is read from `cookies()`, not accepted as an argument.** The credential comes from the request envelope ([02e](02e-authentication-and-authorisation-at-the-entry-point.md)).

**The return is a class instance.** That is the comment's stated reason and it has teeth: *"Functions and classes are already blocked from being passed to Client Components by default."* A `User` instance physically cannot cross the RSC boundary, so leaking it is a build-time impossibility rather than a review item.

```tsx
// data/user-dto.tsx
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
  // Don't pass values, read back cached values, also solves context and easier to make it lazy

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

```tsx
// app/page.tsx
import { getProfileDTO } from '../../data/user-dto'

export default async function Page({ params }) {
  const { slug } = await params
  // This page can now safely pass around this profile knowing
  // that it shouldn't contain anything sensitive.
  const profile = await getProfileDTO(slug)
}
```

Note the comment *"Don't pass values, read back cached values"* — `getProfileDTO` does not take a viewer parameter. It re-derives the viewer from `getCurrentUser()`, which the `cache()` wrapper makes free. A viewer passed in as an argument is a viewer the caller chose.

The field-level predicates are the part most homegrown DALs skip. Authorisation is not only "may you see this row" but "which of its columns may you see", and expressing that as `canSeeX(viewer)` functions beside the DTO keeps the rule next to the data it governs.

## Only the DAL reads `process.env`

🔴 > *"**Good to know:** Secret keys should be stored in environment variables, but only the Data Access Layer should access `process.env`. This keeps secrets from being exposed to other parts of the application."*

This is stricter than it first sounds, and it is a genuinely useful invariant because it is greppable. Once `process.env` appears only under `data/`, a review question becomes a command, and the audit checklist asks exactly this:

> *"**Data Access Layer:** Is there an established practice for an isolated Data Access Layer? Verify that database packages and environment variables are not imported outside the Data Access Layer."*

⚠️ One exception the framework itself creates: *"Next.js exposes any environment variable prefixed with `NEXT_PUBLIC_` to the client."* Those are not secrets and the rule does not apply to them — but a `NEXT_PUBLIC_` prefix on something that *is* a secret is a leak with no error message, which is why the invariant is worth enforcing at the boundary rather than per-variable.

The same logic puts the database client itself in the DAL. Where the Prisma or `pg` instance is constructed, and why it must be a `server-only` module, is [01ga · Where the Prisma instance lives](01ga-where-the-prisma-instance-lives.md).

## What `import 'server-only'` actually enforces

> *"To prevent server-only code from being executed on the client, you can mark a module with the `server-only` package"*

```ts
// lib/data.ts
import 'server-only'
```

> *"This ensures that proprietary code or internal business logic stays on the server by causing a build error if the module is imported in the client environment."*

> *"Next.js handles `server-only` imports internally. The contents of these packages from NPM are not used. However, if your linting rules flag extraneous dependencies, you may install them to avoid issues."*

Two things to take from that. It is a **build-time** guarantee — a compile error, not a runtime check — which is why it is the strongest tool in this whole area. And the npm package is a formality: Next.js resolves the import itself, so installing it is only to satisfy a linter.

The same reasoning puts the database client itself under `data/`. Where a Prisma or `pg` instance is constructed, and why exactly one module may construct it, is [01ga · Where the Prisma instance lives](01ga-where-the-prisma-instance-lives.md).

Mutations get the same treatment, and both entry points sit on top of it — [02n](02n-thin-entry-points-over-one-rule.md).

## Gotchas

**★ Symptom: a database driver or a secret ends up in a client bundle.** Cause: a module holding the client was imported — directly or three levels down — from a Client Component, and nothing objected. Fix: `import 'server-only'` at the top of every DAL module, which turns that import into a build error rather than a shipped bundle.

**★ Symptom: `process.env.STRIPE_SECRET` appears in a component file and nobody noticed for months.** Cause: no invariant to violate. Fix: adopt the documented rule — *"only the Data Access Layer should access `process.env`"* — and enforce it mechanically.

**★ Symptom: a DAL function takes `userId` as a parameter, and the IDOR you removed from the action reappears one layer down.** Cause: moving the code without moving the *trust* decision. Fix: the DAL derives identity itself — the docs' own comment is *"Don't pass values, read back cached values"*.

**★ Symptom: an action returns a DAL value and React refuses to serialise it.** Cause: the DAL returned a class instance, and *"functions and classes are already blocked from being passed to Client Components by default."* Fix: that block is the feature working — keep classes for internal identity and construct a plain DTO at the boundary.

**★ Symptom: a `cache()`-wrapped DAL function runs twice in one request.** Cause: one call site sits inside a `use cache` scope and one outside — *"[`React.cache`] operates in an isolated scope inside `use cache` boundaries. Values stored via `React.cache` outside a `use cache` function are not visible inside it."* Fix: choose a side. Read the value outside and pass it into the cached function as an argument, where it also becomes part of the cache key ([02i](02i-route-handler-caching.md)).

**★ Symptom: the DTO returns every column because "the UI might need it later".** Cause: a DAL that is a query wrapper rather than an authorisation boundary. Fix: return the fields this view needs, with field-level predicates where visibility varies by viewer, exactly as `getProfileDTO` does with `canSeeUsername` and `canSeePhoneNumber`.

**Symptom: the linter flags `server-only` as an extraneous dependency.** Cause: Next.js resolves the import internally and *"the contents of these packages from NPM are not used"*, so it is not in your `package.json`. Fix: install it — the docs explicitly sanction doing so *"to avoid issues"* with lint rules.

## Interview questions

**★ What makes a module a Data Access Layer rather than a folder of query helpers?**
Three properties, and all three have to hold. It runs only on the server, enforced at build time with `import 'server-only'` rather than by convention. It performs the authorisation check itself, deriving identity from the request envelope instead of accepting it as a parameter. And it returns minimal DTOs shaped for the caller, not database rows. A folder of query helpers has none of those: it can be imported from a Client Component, it trusts whatever id it is given, and it returns whatever the ORM returned. The distinction matters because only the first version makes the number of places a rule lives independent of the number of entry points.

**★ Why does the documented DAL wrap `getCurrentUser` in React's `cache()`?**
For identity, not for speed — though it gives you both. The comment in the docs says it *"makes it easy to get the same value in many places without manually passing it around. This discourages passing it from Server Component to Server Component which minimizes risk of passing it to a Client Component."* That is the security argument: a session threaded through props is a session one careless prop away from the browser, whereas a cached read is free to repeat, so nobody has a reason to thread it. The performance benefit — *"sharing an in-memory cache across different parts of a request"* — is why calling it in every DAL function costs nothing.

**★ Why should only the Data Access Layer read `process.env`?**
Because it converts a judgement into a grep. The docs state it as a rule — *"only the Data Access Layer should access `process.env`. This keeps secrets from being exposed to other parts of the application"* — and the value is that "is a secret being read somewhere it might leak?" becomes a mechanical check over a directory rather than a review of every file. It also removes the most common accident, which is a secret read in a module that later gets imported by a Client Component, where the only thing standing between you and shipping it is whether `NEXT_PUBLIC_` happens to be absent from the name.

**★ What does `import 'server-only'` actually do, and why is it stronger than a naming convention?**
It causes a **build error** if the module ends up in a client bundle — *"by causing a build error if the module is imported in the client environment."* That is a compile-time guarantee about the transitive import graph, so it catches the case nobody reviews: a `lib/` helper imported by another helper imported by a Client Component four levels down. A naming convention catches only what a reviewer looks at. Worth knowing that the npm package is a formality — Next.js handles the import internally and *"the contents of these packages from NPM are not used"* — but installing it keeps linters quiet about extraneous dependencies.

**★ Why does the documented DAL return a class instance for the current user?**
Because classes cannot cross the RSC boundary: *"functions and classes are already blocked from being passed to Client Components by default."* Modelling the session as `new User(id)` therefore makes leaking the whole session object a build failure rather than something a reviewer must notice — the docs' own comment says *"Use classes to avoid accidentally passing the whole object to the client."* The trade is that the class cannot be an action's return value either, so you construct a plain DTO at the boundary. That is the right shape anyway, and the refusal is the guard rail firing rather than an inconvenience.

---

← [02l · The decision rule](02l-the-decision-rule.md) · Next → [02n · Thin entry points over one rule](02n-thin-entry-points-over-one-rule.md)
