---
title: "SprintDesk gets identity: the milestone is not 'add a login page', it is one decision about revocation and one module that becomes the only thing in the app allowed to know who is asking"
sidebar_label: "06 · Milestone: the two decisions"
sidebar_position: 6
description: "Chapter 10's capstone, act one: what identity actually adds to the board built in chapter 8, the version reality of adopting Auth.js in 2026, and the JWT-versus-database session decision argued from 'can we revoke this session right now' rather than from convenience."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [Authentication guide](https://nextjs.org/docs/app/guides/authentication)
> (`lastUpdated: 2026-08-25`), the [Data Security guide](https://nextjs.org/docs/app/guides/data-security)
> (`lastUpdated: 2026-08-25`), Auth.js [JWT vs Database session strategies](https://authjs.dev/concepts/session-strategies),
> [Auth.js installation](https://authjs.dev/getting-started/installation) and the npm registry
> (`next-auth` dist-tags `latest` and `beta`, `@auth/core`, `@auth/prisma-adapter`, `@prisma/client`, read 2026-09-05).
> Target: **Next.js 16.3.4** App Router · **`next-auth` 5.0.0-beta.32** (`@auth/core` 0.41.3) ·
> React 19.2.8 · `@auth/prisma-adapter` 2.11.3 · `@prisma/client` 7.10.0 · zod 4.4.3 · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run** — no console transcripts, timings or install logs appear anywhere in this milestone.

**Chapter 8 left SprintDesk with a working board and no idea who is looking at it. Adding identity is two decisions and one module, and everything else in this milestone is a consequence of them.** The first decision is which session strategy the product can live with, and the only question that settles it is *"a contractor left this morning — can we end their session right now, from the admin screen, or do we wait until their token expires?"* The second is that exactly one `server-only` module reads the session and touches `process.env`, and it hands out a projection rather than a database row. Get those two right and the eleven places SprintDesk could leak another team's board collapse into one place you can audit. Get either wrong and you get a codebase where the answer to *"is this endpoint protected?"* is *"probably, let me grep."*

## What SprintDesk is when this milestone starts

The board from [chapter 8's milestone](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md) lives at `app/(dashboard)/boards/[boardId]/page.tsx`. It renders columns of cards, filters them from the URL, drags them between columns with `useOptimistic`, and writes through a Server Action that already calls `updateTag('board:…')`. Its data functions are cached and tagged. Its store is scoped per board.

It also has three holes that no amount of state-management correctness closes:

1. `readBoard(boardId)` returns a board to anyone who can guess a board id.
2. `moveCard` re-reads ownership from a `session` object that chapter 8 imported from `@/lib/auth` and never defined — the import was a promise that this chapter would keep.
3. Nothing in the app can say *"you are Priya, you are on three boards, and this is not one of them."*

This milestone writes `@/lib/auth`, writes the Data Access Layer that chapter 8's action was already calling into, and closes all three. The board's rendering code barely changes. That is the point: **authorization that requires you to edit components is authorization you will forget to edit.**

## The version reality you are adopting, stated plainly

You cannot write this milestone honestly without saying what `npm install next-auth@beta` actually installs in 2026.

| Package | Version read from the registry, 2026-09-05 | Notes |
|---|---|---|
| `next-auth` (`latest` tag) | **4.24.15** | The v4 line. Not this milestone. |
| `next-auth` (`beta` tag) | **5.0.0-beta.32** | Auth.js v5, the App Router line. This is what the docs describe. |
| `@auth/core` | **0.41.3** | Pinned exactly (not a range) by `next-auth@5.0.0-beta.32`. |
| `@auth/prisma-adapter` | **2.11.3** | Peer: `@prisma/client` `">=2.26.0 \|\| >=3 \|\| >=4 \|\| >=5 \|\| >=6"`. |
| `@prisma/client` (`latest`) | **7.10.0** | |

Three things follow, and each of them is a real decision rather than trivia.

**The install command in the official docs installs a beta.** The Auth.js installation page's Next.js command is `npm install next-auth@beta`, and the page says so directly — it notes this is currently in beta status. There is no v5 stable at the time of writing. A `^5.0.0-beta.32` range in your `package.json` is a range over *prereleases*, which npm treats as ordered but which the project has never promised is non-breaking. **Pin it exactly.** `"next-auth": "5.0.0-beta.32"`, no caret, and upgrade it deliberately with the release notes open.

**The project's ownership changed.** The banner on `authjs.dev` reads:

> *"The Auth.js project is now part of Better Auth."*
> — [authjs.dev](https://authjs.dev/), read 2026-09-05

That sentence is not a deprecation notice and I am not going to over-read it: the documentation is live, the package publishes, and the Next.js integration is the one the framework's own guide links to. But it is the kind of fact that decides whether you write your auth calls behind your own module boundary or scatter `import { auth } from 'next-auth'` through 40 components. This milestone does the former, and the reason is one line long: **if the library under your DAL is replaced, you want the diff to be one file.**

**The Prisma adapter's peer range is open-ended, which is not the same as tested.** Read the range again: `">=2.26.0 || >=3 || ..."`. The first clause alone is unbounded, so `@prisma/client` 7.10.0 satisfies it and npm will install the pair without a single warning. The range's *shape* — a ladder of majors ending at 6 — says what the maintainers had in mind; its *semantics* say "anything from 2.26 upwards". Do not read a silent install as a compatibility statement. If you are on Prisma 7, exercise sign-in, sign-out, session refresh and account linking against a scratch database before you believe it.

## Decision 1 — the session strategy, and the only question that settles it

Auth.js offers two, and the documentation states the mechanism of each precisely. The cookie-level view of what a session *is* — and why its attributes rather than your code are the control — is [03 · Sessions: the cookie is the control](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md); this page picks one for SprintDesk.

**JWT.** When a user signs in, a JWT is created in an `HttpOnly` cookie and the token itself is encrypted with a secret key only known to the server. The session data travels with the request; nothing is written server-side.

**Database.** Instead of saving the JWT with user data after signing in, Auth.js creates a session in your database, and a session ID is then saved in an `HttpOnly` cookie. The cookie holds an obscure value pointing to the session row rather than the user data itself.

And the default:

> *"This is the default session strategy for Auth.js unless a database provider is configured."*
> — [Auth.js, JWT vs Database session strategies](https://authjs.dev/concepts/session-strategies)

That sentence catches people twice. It means JWT is the default; it also means **configuring an adapter flips the default to database sessions without you writing `strategy` anywhere.** If you add `@auth/prisma-adapter` for account linking and expect JWTs, you now have database sessions and a session-table read on every request you did not plan for.

### The question

Not "which is faster". Not "do I want a database". This one:

> A contractor's laptop was stolen at 09:12. It is now 09:20 and you are logged into the admin screen. **Can you end that session before you finish the sentence?**

Auth.js answers it for you, and the answer for JWT is no:

> *"Expiring a JSON Web Token before its encoded expiry is not possible"* — without maintaining a server-side blocklist of invalidated tokens.
> — [Auth.js, JWT vs Database session strategies](https://authjs.dev/concepts/session-strategies)

Auth.js will destroy the cookie on the browser it can reach. The token itself stays valid everywhere else until its encoded expiry. The default `maxAge` is 30 days.

For the database strategy the same page states the opposite: when a user signs out, the session is deleted from the database and the session ID is deleted from the cookies. Revocation is a `DELETE`.

### What SprintDesk chooses, and what it costs

**Database sessions.** SprintDesk is a team tool: boards contain unreleased plans, people leave teams mid-sprint, and "sign this person out of everything, now" is a feature an admin will ask for in the first month. A product where session revocation is a *feature request* rather than a *primitive* has already lost that argument.

The cost is not hypothetical and you should state it to whoever is paying for the database:

| Consequence | Detail |
|---|---|
| A database read per authenticated request | The cookie is an opaque id; resolving it to a user is a query. |
| A session table to migrate, index and prune | Expired rows accumulate; nothing deletes them for you. |
| The DAL becomes latency-critical | Every page that shows a name now depends on your primary database being up. |
| Multi-region gets harder | A stateless token replicates for free; a session row does not. |

Two of those four are already mitigated by things this chapter has taught. `getCurrentUser()` is wrapped in React's `cache()`, so a render pass that reads the session in nine components performs **one** query, not nine. And with Cache Components enabled, the session read lives in a `'use cache: private'` scope whose result is held in browser memory — see [12 · Auth with Cache Components: the session read](12-authentication-with-cache-components-reading-the-session.md) for exactly what that stores and for how long. Neither trick removes the query; both stop it from multiplying.

### When JWT is the right answer instead

Say it out loud so the choice stays a choice:

- **A short-lived token whose expiry you actually control.** A 10-minute JWT with a refresh flow gives you a 10-minute revocation window, which is a defensible number. A 30-day one is not.
- **You have no database on the read path** and adding one for auth is the biggest architectural change in the design.
- **Read-mostly, low-stakes content** where the worst case of a stale session is that someone reads a blog post they should not have.

The failure mode is choosing JWT for the reason people actually choose it — "the default worked" — and discovering the revocation gap during an incident, which is the one moment you cannot fix it.

## The build order

Each row is one chunk. They are in the order you would type them, and each depends only on the rows above it.

| # | Chunk | What it lands |
|---|---|---|
| 1 | [06b · Wiring Auth.js into the App Router](06b-milestone-wiring-authjs-into-the-app-router.md) | `lib/auth.ts`, the four tables the Prisma adapter needs, and the catch-all Route Handler |
| 2 | [06c · The environment, and the single reader of `process.env`](06c-milestone-the-environment.md) | `AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, and where each lives per deployment |
| 3 | [06d · The Data Access Layer](06d-milestone-the-data-access-layer.md) | 🔴 The spine. One `server-only` module, `getCurrentUser()` returning a **DTO**, and nothing else reading a cookie |
| 4 | [06e · The layout is not a boundary](06e-milestone-the-layout-is-not-a-boundary.md) | Why the check cannot live where everyone first puts it |
| 5 | [06f · Authorization on reads](06f-milestone-authorization-on-the-board.md) | `requireBoardAccess`, membership in the `WHERE` clause, and the unexported cached read |
| 6 | [06g · Hide, do not forbid](06g-milestone-hide-do-not-forbid.md) | Why a non-member gets `notFound()`, and the one screen where `forbidden()` is right |
| 7 | [06h · Authorization on writes](06h-milestone-authorization-on-writes.md) | The action as a public POST endpoint, thin actions over a mutating DAL, and the CSRF you get free |
| 8 | [06i · Sign-in as a form](06i-milestone-sign-in-as-a-form.md) | The Server Action, zod field errors, and why a `try/catch` breaks sign-in |
| 9 | [06j · What a sign-in endpoint gives away](06j-milestone-what-a-sign-in-endpoint-gives-away.md) | Open redirects, account enumeration, and rate-limiting the thing that sends email |
| 10 | [06k · Sign-out and what it costs the caches](06k-milestone-sign-out-and-the-caches.md) | Why sign-out is a POST, "sign out everywhere", and what survives it |
| 11 | [06l · `proxy.ts` as UX, not as the control](06l-milestone-proxy-as-ux-not-control.md) | The coarse filter, and the documented hole that proves it is not the control |
| 12 | [06m · What this costs and where it generalises](06m-milestone-what-it-costs-and-generalises.md) | The eighteen deviations a reader will be tempted into, and what each one breaks |

## Gotchas

**★ Symptom: you configured an adapter for OAuth account linking and now every page hits the database twice.** Cause: adding an adapter silently changes the session strategy — JWT is the default *unless a database provider is configured*, and you configured one. You did not opt into database sessions; you opted into an adapter and got them. Fix: state the strategy explicitly, whichever one you want, so the file says what it does:

```ts filename="lib/auth.ts"
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database' }, // explicit, even though it is now the default
})
```

**★ Symptom: `npm install next-auth` gives you a library whose API does not match any documentation you can find.** Cause: the `latest` dist-tag on `next-auth` is **4.24.15**, the v4 line, which has no `auth()` helper and a completely different config shape. Every current App Router guide describes v5, which publishes under `beta`. Fix: install by exact version, not by tag:

```json
{
  "dependencies": {
    "next-auth": "5.0.0-beta.32"
  }
}
```

**★ Symptom: a patch-level bump of `next-auth` breaks the build.** Cause: `"^5.0.0-beta.32"` is a caret range over prerelease versions. Semver's compatibility promise is about released majors; a project publishing `-beta.N` has made no such promise between `N` and `N+1`. Fix: drop the caret entirely (above), and add the upgrade to a review rather than to a bot's auto-merge list.

**★ Symptom: `npm install` is silent about `@auth/prisma-adapter` with Prisma 7, so you assume it is supported.** Cause: the adapter's peer range begins with the unbounded clause `>=2.26.0`, which every future major satisfies. The ladder of `||` clauses looks like an allow-list and behaves like an open door. Fix: treat the adapter/ORM pairing as untested until you have exercised it, and pin both:

```json
{
  "dependencies": {
    "@auth/prisma-adapter": "2.11.3",
    "@prisma/client": "7.10.0"
  }
}
```

**★ Symptom: "we can't log that person out" arrives as a support ticket, and there is no code change that fixes it this week.** Cause: JWT sessions with a 30-day `maxAge`. The documentation is explicit that expiring a JWT before its encoded expiry is not possible without a server-side blocklist — and a blocklist is a database read per request, which is the cost you chose JWT to avoid. Fix: switch to database sessions, which is a config change plus a migration, not a rewrite:

```ts filename="lib/auth.ts"
session: { strategy: 'database', maxAge: 60 * 60 * 24 * 30 },
```

**★ Symptom: the team argues about JWT vs database for a week and the argument never converges.** Cause: it is being argued on performance, which has no decidable answer without traffic numbers nobody has yet. Fix: re-frame it as the revocation question — *can an admin end a session right now* — which is a product requirement with a yes/no answer, and the performance consequence follows from the answer rather than driving it.

**★ Symptom: you moved to database sessions and the "signed in as" name in the header now blocks the whole page.** Cause: the session read is a request-time read, and it was placed at the top level of a layout, so it holds `{children}`. This is not a session-strategy problem. Fix: push the read into a component behind `<Suspense>` — the mechanism, the build error it becomes under Cache Components, and the placement rule are all in [12 · Auth with Cache Components: the session read](12-authentication-with-cache-components-reading-the-session.md).

## Interview questions

**★ Which session strategy would you pick for a team collaboration product, and what is the question you would ask to decide?**
Database sessions, and the question is *"can an administrator end an active session right now?"* Auth.js documents that expiring a JWT before its encoded expiry is not possible without maintaining a server-side blocklist — signing out destroys the cookie in the browser you can reach and nothing else. For a product where people leave teams, lose laptops and get offboarded mid-sprint, revocation has to be a primitive, and with database sessions it is a row deletion. The cost is a database read per authenticated request, which you mitigate by memoising the read per render pass with React's `cache()` and, under Cache Components, by putting it in a `'use cache: private'` scope — but you do not pretend the cost is zero.

**★ You add a Prisma adapter to an app that was using JWT sessions and make no other change. What changed?**
The session strategy. Auth.js's default is JWT *unless a database provider is configured*, so configuring an adapter flips the default. You now write a session row per sign-in, read it per request, and — usefully — gain real revocation. The failure mode is not the behaviour, it is that nothing in your code says it happened: someone reading `lib/auth.ts` a month later sees an adapter and no `session` key and has to know this rule to predict the behaviour. Always write the strategy explicitly.

**★ Why is "the library is in beta" a design input rather than just a risk to note?**
Because it decides how much of your codebase touches the library's API surface. `next-auth`'s current App Router line publishes under the `beta` dist-tag at 5.0.0-beta.32, and the project has since become part of Better Auth. Neither fact means "do not use it" — the framework's own guide points at it. Both facts mean that if you import `auth()` directly in 40 components, a migration is a 40-file diff written under time pressure. If every component instead calls `getCurrentUser()` from your own DAL, the migration is one file. The beta status is the reason the indirection pays for itself, rather than being architecture for its own sake.

**★ What is wrong with `"next-auth": "^5.0.0-beta.32"`?**
The caret is a compatibility claim, and nobody made it. Semver's "patch and minor are safe" contract covers released versions; a prerelease sequence is explicitly the period during which breaking changes are expected. `^5.0.0-beta.32` will happily resolve to `5.0.0-beta.40`, which may have renamed the thing your DAL calls. Pin the exact version and upgrade on purpose, with the changelog open — auth is the last dependency in the tree you want a bot bumping unattended.

**★ An `npm install` completes with no peer-dependency warning. What has that told you about compatibility?**
Almost nothing. `@auth/prisma-adapter@2.11.3` declares its peer as `">=2.26.0 || >=3 || >=4 || >=5 || >=6"`; the first clause is unbounded, so `@prisma/client@7.10.0` satisfies the range and installs silently even though the ladder of clauses clearly stops at 6. A satisfied range means the maintainer's *declaration* permits the version, not that anyone ran the pair. For an adapter that owns your user and session tables, that difference is worth an afternoon of exercising sign-in, sign-out, session expiry and account linking against a scratch database.

**★ Chapter 8's `moveCard` action already checked ownership. Why is there still an authentication milestone to write?**
Because that check read a `session` object from a module that did not exist — the check was correct in shape and unimplemented in substance. More importantly, a per-action check written by hand is only as good as the developer who remembers to write it in the next action. The milestone's job is not to add one check; it is to make the check unavoidable by putting it inside the only function that can reach the data, so that a new action written by someone who has never read this page is still authorized.

---

← [05 · RSC serialization: the mechanism](05-rsc-serialization-hardening-lessons-from-react2shell-cve-202.md) · [Chapter 10 overview](01-explanation.md) · Next → [06b · Wiring Auth.js into the App Router](06b-milestone-wiring-authjs-into-the-app-router.md)
