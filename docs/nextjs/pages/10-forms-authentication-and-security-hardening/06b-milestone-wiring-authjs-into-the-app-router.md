---
title: "Auth.js is one config module, one two-line Route Handler and four database tables — and every one of the four tables encodes a decision you will otherwise discover from a support ticket"
sidebar_label: "06b · Milestone: wiring Auth.js"
sidebar_position: 160
description: "Chapter 10's capstone, step one: lib/auth.ts with the session strategy written out, the GitHub and Resend providers, the four tables the Prisma adapter requires and the two schema details that cost an afternoon each, and the catch-all Route Handler that mounts a public endpoint you did not write."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Auth.js installation](https://authjs.dev/getting-started/installation),
> [Auth.js deployment / environment variables](https://authjs.dev/getting-started/deployment),
> [Auth.js Email provider](https://authjs.dev/getting-started/authentication/email),
> [Auth.js JWT vs Database session strategies](https://authjs.dev/concepts/session-strategies),
> the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`)
> and the npm registry (read 2026-09-05).
> Target: **Next.js 16.3.4** · **`next-auth` 5.0.0-beta.32** (`@auth/core` 0.41.3) ·
> `@auth/prisma-adapter` 2.11.3 · `@prisma/client` 7.10.0.
> Documentation-verified; **no sandbox run**.

**Wiring Auth.js is genuinely short — a config module, a catch-all Route Handler, four database tables — and almost every line of it is a decision rather than boilerplate.** Whether `session.strategy` appears in the file at all changes what a later refactor does to your ability to revoke a session. Whether the `Session` model carries a cascade and an index decides whether "sign this person out of everything" is a query or an outage. And the Route Handler is two lines that mount a public HTTP surface written by someone else, which is the whole argument for keeping the library behind your own module boundary. This page lands the three files, in the order you would type them; [06c](06c-milestone-the-environment.md) lands the environment they read.

## The config module

Everything Auth.js gives you comes out of one call. Put it at `lib/auth.ts` rather than at the project root — SprintDesk keeps every server-only concern under `lib/`, and the path is what every other chunk imports.

```ts filename="lib/auth.ts"
import 'server-only'

import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Resend from 'next-auth/providers/resend'
import { PrismaAdapter } from '@auth/prisma-adapter'

import { db } from '@/lib/db'
import { env } from '@/lib/dal/env'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),

  // Explicit, even though an adapter already makes this the default.
  session: {
    strategy: 'database',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, //  refresh the row at most once a day
  },

  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }),
    Resend({
      apiKey: env.AUTH_RESEND_KEY,
      from: env.AUTH_EMAIL_FROM,
    }),
  ],

  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
    verifyRequest: '/sign-in/check-your-email',
  },

  trustHost: env.AUTH_TRUST_HOST,
})
```

Four decisions in that file are worth defending.

**`import 'server-only'` on the first line.** The Data Security guide's rule is that marking a module this way *causes a build error if the module is imported in the client environment*. `lib/auth.ts` holds an OAuth client secret and an API key. Without that line, a `'use client'` file importing `signIn` from here compiles and ships them. With it, the same mistake fails CI.

**`session.strategy` is written even though it is redundant.** Auth.js's default is JWT *unless a database provider is configured*, and `PrismaAdapter` is a database provider. The behaviour is right either way; the line exists so that the next person to read the file does not have to know that rule to predict it.

**Two providers, one of them passwordless.** GitHub OAuth is what most SprintDesk users will click. The Resend email provider is what gives the sign-in page a real form field to validate in [06i](06i-milestone-sign-in-as-a-form.md), and it needs no extra npm package — Auth.js's docs list Resend, Sendgrid, Postmark, Loops, Mailgun and Forward Email as providers configured through environment variables alone, in contrast to Nodemailer, which the same page says requires `npm install nodemailer` because Auth.js does not ship it as a dependency.

**`pages` overrides three routes, not one.** Overriding `signIn` alone is the common half-configuration: Auth.js then renders your sign-in page for sign-in and its own built-in page for errors and for "check your email", which look nothing like your app and leak the fact that you are using Auth.js. Name all three.

⚠️ **`Resend` here is Auth.js's built-in email provider, not the `resend` npm package.** I did not verify by installation that this provider makes no network call through an npm dependency; the claim I am relying on is the documented one — that these providers are configured with environment variables and do not require an additional package. If your build complains about a missing module, that documented claim is the thing to re-check first.

## The one required database requirement, and it is not optional

The email provider decides this for you:

> *"A database is required for passwordless login to work as verification tokens need to be stored."*
>
> *"An Email Provider can be used with both JSON Web Tokens and database session, whichever you choose, you must still configure a database."*
> — [Auth.js, Email provider](https://authjs.dev/getting-started/authentication/email)

Read the second sentence carefully: it closes the escape hatch. "I will use JWT sessions so I do not need a database" does not work the moment a magic link is in the product, because the verification token has to be stored somewhere the link can be checked against.

SprintDesk already has a database. The adapter needs four tables added to it.

```prisma filename="prisma/schema.prisma"
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?

  accounts    Account[]
  sessions    Session[]
  memberships BoardMember[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model BoardMember {
  boardId String
  userId  String
  role    String @default("member") // "member" | "admin"

  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([boardId, userId])
  @@index([userId])
}
```

`BoardMember` is SprintDesk's, not Auth.js's, and it is the join that every authorization check in [06f](06f-milestone-authorization-on-the-board.md) goes through. The `@@index([userId])` on it is not decoration: "which boards is this person on" runs on every dashboard load.

Two details on the Auth.js tables that cost people an afternoon each:

- **`onDelete: Cascade` on `Session.user`.** Deleting a user must delete their sessions. Without the cascade, a deleted user's session row survives, the adapter resolves the cookie to a `userId` with no row behind it, and your DAL sees a session that is valid and a user that is `null` — a state your code probably does not handle.
- **`@@index([userId])` on `Session`.** "Sign this person out of every device" is a `deleteMany({ where: { userId } })`. Without the index that is a table scan on the hottest table in the schema.

## The Route Handler

Auth.js's Next.js integration is a catch-all Route Handler, and the documentation is specific that it must be one:

```ts filename="app/api/auth/[...nextauth]/route.ts"
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

That is the whole file. It is also, structurally, a **public HTTP endpoint that you did not write and cannot see the code of** — which is exactly why [06l](06l-milestone-proxy-as-ux-not-control.md) shows the `proxy.ts` matcher excluding `/api/auth` rather than protecting it. A proxy that redirects unauthenticated requests away from `/api/auth/signin` prevents anyone from ever signing in, and the symptom is an infinite redirect loop that looks like a cookie bug.

## Gotchas

**★ Symptom: `/api/auth/signin` redirects to `/sign-in`, which redirects to `/api/auth/signin`, forever.** Cause: the `proxy.ts` matcher covers `/api/auth`, so the proxy's "not signed in → go to sign-in" rule fires on the very endpoint that performs sign-in. Fix: exclude the auth routes in the matcher.

```ts filename="proxy.ts"
export const config = {
  matcher: ['/((?!api/auth|api|_next/static|_next/image|favicon.ico).*)'],
}
```

**★ Symptom: deleting a user leaves ghost sessions that resolve to a `null` user.** Cause: no `onDelete: Cascade` on the `Session.user` relation, so the session row outlives the user row and the adapter hands your DAL a valid-looking session id for a user that does not exist. Fix — in the schema, then migrate:

```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

**★ Symptom: "sign out of all devices" times out on a large user table.** Cause: `Session` has no index on `userId`, so `deleteMany({ where: { userId } })` scans. Fix: `@@index([userId])` on the `Session` model, shown in the schema above, then migrate.

**★ Symptom: a client bundle contains your GitHub client secret.** Cause: a Client Component imported `lib/auth.ts` — usually to get `signIn` or `signOut` for a button — and the module's provider secrets came with it. Fix: the first line of the module.

```ts filename="lib/auth.ts"
import 'server-only'
```

That converts the import into a build error rather than a shipped secret. The button then gets its behaviour from a Server Action instead, which is what [06i](06i-milestone-sign-in-as-a-form.md) builds.

**★ Symptom: everything works until you enable the email provider, then magic links fail with a token error.** Cause: the `VerificationToken` table is missing or was not migrated. The docs state a database is required for passwordless login because verification tokens need to be stored — and that this is true whichever session strategy you chose. Fix: add the model shown above and run the migration. There is no JWT-only shortcut.

**★ Symptom: sign-in works but the error page and the "check your email" page look like a different product.** Cause: `pages.signIn` was overridden and `pages.error` and `pages.verifyRequest` were not, so Auth.js serves its own built-in pages for those two states. Fix: name all three, as in the config module above.

**★ Symptom: a user who signed in with GitHub last month signs in with the same email by magic link and gets a second, empty account.** Cause: account linking is a policy decision, not a default — the `Account` table keys on `[provider, providerAccountId]`, and two providers for one human are two rows that only get joined to one `User` if something joins them. Fix: decide the policy explicitly and write it down in the config rather than discovering it from a support ticket. The safe default for a team tool is to require the email to be verified before linking, which is what the email provider gives you for free and OAuth gives you only if the provider asserts it.

**★ Symptom: `PrismaAdapter(db)` type-errors after a Prisma major upgrade.** Cause: the adapter is written against a generated client's shape, and its declared peer range accepts every future major because its first clause is unbounded — so the install succeeded and the types did not. Fix: pin both packages to the versions you exercised (`@auth/prisma-adapter` 2.11.3, `@prisma/client` 7.10.0) and treat an adapter upgrade as a change that needs sign-in, sign-out, session expiry and account linking run against a scratch database.

## Interview questions

**★ Why is `import 'server-only'` on the auth config module worth a line, when the file is obviously server code?**
Because "obviously server code" is a property of the file as it exists today, and imports are added by people in a hurry. A Client Component that wants a sign-out button naturally reaches for `import { signOut } from '@/lib/auth'` — that compiles, and it drags the module's OAuth client secret and API key into the browser bundle. The Data Security guide's framing is exact: marking the module causes a build error if it is imported in the client environment. It converts a silent credential leak into a red CI run, for one line and zero runtime cost.

**★ You are told the app must use JWT sessions "so we do not need a database for auth". The product also has magic-link sign-in. What do you say?**
That the two requirements are incompatible as stated. Auth.js documents that a database is required for passwordless login because verification tokens need to be stored, and explicitly that this holds whichever session strategy you pick. So the database is already in the picture; the only remaining question is whether you also store sessions in it, which is now a much cheaper decision — and one that buys real revocation. The JWT choice was being made to avoid a cost that the email provider had already committed you to.

**★ Why does the `proxy.ts` matcher have to exclude `/api/auth`?**
Because the proxy's job is "no session cookie, go to the sign-in page", and `/api/auth/*` is the set of endpoints that *creates* the session cookie. Applying the rule there means a signed-out user is redirected away from the only route that could sign them in, and since the sign-in page itself then bounces them back to the auth endpoint, you get an infinite redirect. The excluded prefix is not a security hole: those routes belong to Auth.js and validate their own state, and [06l](06l-milestone-proxy-as-ux-not-control.md) argues at length that the proxy was never the control anyway.

**★ The whole Auth.js Route Handler is two lines. What is the security consequence of that?**
That a public HTTP surface you did not write and cannot read is now mounted at `/api/auth/*`, and it is as reachable as any other route. Everything that follows from that is a dependency-hygiene argument rather than a code one: pin the version exactly, read the release notes on upgrade, and keep the module behind your own boundary so replacing it is a one-file diff. It is also why the sign-in *page* is yours and the sign-in *endpoint* is theirs — you control the form, the validation and the error text, and delegate only the protocol.

**★ Why write `session: { strategy: 'database' }` when configuring an adapter already makes it the default?**
Because the file is read far more often than it is written, and the default is conditional on something three lines above it. Auth.js's documented rule is that JWT is the strategy *unless a database provider is configured*, so the behaviour of `lib/auth.ts` depends on whether `adapter:` is present — which means removing an adapter during a refactor silently converts every session in the product from revocable to non-revocable. Writing the strategy explicitly does not change behaviour; it makes that refactor a visible contradiction instead of an invisible one.

---

← [06 · Milestone: the two decisions](06-project-milestone-sprintdesk-auth-authjs.md) · [Chapter 10 overview](01-explanation.md) · Next → [06c · The environment, and the single reader of `process.env`](06c-milestone-the-environment.md)
