---
title: "Auth.js gives you one config object, one route handler and one auth() call — and the thing worth learning is which of its callbacks run in which session strategy, because they are not the same function"
sidebar_label: "Auth.js (NextAuth) in App Router"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against Auth.js — [Installation](https://authjs.dev/getting-started/installation), [Session strategies](https://authjs.dev/concepts/session-strategies), [Protecting resources](https://authjs.dev/getting-started/session-management/protecting), [Extending the session](https://authjs.dev/guides/extending-the-session) — the npm registry `dist-tags` for `next-auth`, and the [`bcrypt` README](https://github.com/kelektiv/node.bcrypt.js). Documentation-verified; no sandbox run.
> Target: **Next.js 16.3.4** · **next-auth 5.0.0-beta.32** (`beta` tag, published 2026-07-20; `latest` is still **4.24.15**) · **@auth/core 0.41.3** · **bcrypt 6.0.0**.

**Auth.js is the library the Next.js documentation lists first among self-hosted options, and the one this chapter's reference implementation uses. Its App Router shape is small: an `auth.ts` that exports four things, a catch-all Route Handler that re-exports two of them, and an `auth()` you call anywhere on the server. What is not small — and what determines whether your application can revoke a session — is the `session.strategy` setting and the fact that the `jwt` and `session` callbacks behave differently under each. Two version facts have to be said before any of it, because both change what you should write.**

## Two version facts, stated plainly

**Auth.js v5 for Next.js is still published under the `beta` tag.** The installation page's own command is:

> *"`npm install next-auth@beta`"*

The npm registry's `dist-tags` for `next-auth`, read on 2026-09-05, confirm this: `latest` is **4.24.15** and `beta` is **5.0.0-beta.32**, both published 2026-07-20. Everything on this page — `auth()`, the `handlers` export, the App Router integration — is v5. Installing `next-auth` without `@beta` gets you v4, whose API is different (`getServerSession`, `NextAuth(req, res, options)`) and whose docs are elsewhere. I could not find a statement from the project giving a date for a stable v5; treat the beta tag as the current reality rather than as a warning to avoid it, since it is the version the official installation instructions install.

**Auth.js is now part of Better Auth.** Every page of `authjs.dev` carries the banner *"The Auth.js project is now part of Better Auth"*, the site footer reads *"Auth.js © Better Auth Inc. - 2026"*, and the documentation sidebar has a top-level **"Migrate to Better Auth"** entry. What that means for long-term maintenance of `next-auth` is not something the documentation states in terms I can quote, so I will not characterise it. It is a fact you should know before choosing the library for a five-year system, and it is a fact you should verify freshly rather than take from this page.

You do not install `@auth/core` yourself:

> *"Installing `@auth/core` is not necessary, as a user you should never have to interact with `@auth/core`."*

## The four exports

> *"We recommend all frameworks to create an `auth.ts` file in the project. In this file we'll pass in all the options to the framework specific initialization function and then export the route handler(s), signin and signout methods, and more."*

```ts
// auth.ts
import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
})
```

- **`handlers`** — a `{ GET, POST }` pair for the catch-all route.
- **`signIn` / `signOut`** — server-side functions you call from a Server Action.
- **`auth`** — the universal accessor. It reads the session in a Server Component, and it also *wraps* a Route Handler or the proxy.

The only mandatory environment variable is the secret:

> *"The only environment variable that is mandatory is the `AUTH_SECRET`. This is a random value used by the library to encrypt tokens and email verification hashes."*

> *"`npx auth secret`"* — *"This will also add it to your `.env` file, respecting the framework conventions (eg.: Next.js' `.env.local`)."*

Note the verb: **encrypt**. Auth.js's JWT session is encrypted, not merely signed — *"the JWT is encrypted with a secret key only known to the server. So, even if an attacker were to steal the JWT from the cookie, they could not decrypt it."* That is a stronger guarantee than the hand-rolled `SignJWT` in [03d](03d-verifying-a-token-alg-none-and-algorithm-confusion.md), and it is why you cannot inspect an Auth.js session cookie on jwt.io.

## The Route Handler

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth' // Referring to the auth.ts we just created

export const { GET, POST } = handlers
```

> *"This file must be an App Router Route Handler, however, the rest of your app can stay under `page/` if you'd like."*

This one file is the entire OAuth surface: the sign-in redirect, the provider callback, the CSRF token endpoint, the session endpoint and sign-out all live under `/api/auth/*`. It is also why the `SameSite` discussion in [03](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md) matters — the callback that lands here is a cross-site navigation.

## The proxy re-export

Auth.js documents the Next.js 16 rename directly:

> *"As of Next.js 16, `middleware.ts` has been renamed to `proxy.ts`. If you are using an older version of Next.js, use `middleware.ts` with `export { auth as middleware }` instead."*

```ts
// proxy.ts
export { auth as proxy } from '@/auth'
```

and states what it is for:

> *"Add optional Proxy to keep the session alive, this will update the session expiry every time its called."*

🔴 Read that purpose carefully. The documented reason for this line is **session refresh**, not access control. A proxy runs on prefetches, does not run on paths excluded by a matcher, and is not the boundary that protects a Server Action. The coarse-filter role and its mechanics belong to [04 · Defence in depth: `proxy.ts` as a coarse filter](04-defense-in-depth-proxyts-as-a-coarse-filter.md); the authorization that actually protects data belongs to the Data Access Layer, covered in [03b](03b-the-data-access-layer-server-only-and-the-dto.md) and [03g](03g-authorization-ownership-checks-and-every-entry-point.md).

## Reading the session

In a Server Component:

```tsx
// app/server/page.tsx
import { auth } from '@/auth'

export default async function Page() {
  const session = await auth()
  if (!session) return <div>Not authenticated</div>

  return (
    <div>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </div>
  )
}
```

In a Route Handler, `auth` is a wrapper and the request gains an `auth` property:

```ts
// app/api/admin/route.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export const GET = auth(function GET(req) {
  if (req.auth) return NextResponse.json(req.auth)
  return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
})
```

> *"Protecting routes can be done generally by checking for the session and taking an action if an active session is not found, like redirecting the user to the login page or simply returning a `401: Unauthenticated` response."*

In practice you wrap `auth()` in your own DAL accessor so that the ownership checks and the DTO shaping live in one place, and application code never touches the raw session object.

## The two strategies, and the callbacks that differ

> *"You can configure the session strategy using the `session.strategy` option in the main Auth.js config file."*

> *"[JWT] is the default session strategy for Auth.js unless a database provider is configured."*

That sentence contains the trap: **adding an adapter silently changes your session model.** Configure a Prisma adapter for user records and you have also switched from stateless to database sessions, with a database round-trip per session read you did not ask for — or, depending on your intent, a revocation capability you did want and did not know you had. Set `session.strategy` explicitly either way, so the property is stated rather than inferred.

By default the session is deliberately thin:

> *"Auth.js libraries only expose a subset of the user's information by default in a session to not accidentally expose sensitive user information. This is `name`, `email`, and `image`."*

Adding the user id is the canonical extension, and it is written **differently per strategy**.

**JWT strategy** — two callbacks, because the value has to survive a round-trip through the token:

```ts
// auth.ts
callbacks: {
  jwt({ token, user }) {
    if (user) { // User is available during sign-in
      token.id = user.id
    }
    return token
  },
  session({ session, token }) {
    session.user.id = token.id
    return session
  },
},
```

> *"During sign-in, the `jwt` callback exposes the user's profile information coming from the provider. You can leverage this to add the user's id to the JWT token. Then, on subsequent calls of this API you will have access to the user's id via `token.id`. Then, to expose the user's id in the actual session, you can access `token.id` in the `session` callback and save it on `session.user.id`."*

The `if (user)` guard is load-bearing: `user` is populated **only on the sign-in call**. On every subsequent request the `jwt` callback receives the existing token and no `user`, so anything you want to persist must already be on `token`.

**Database strategy** — one callback, and a different argument:

```ts
// auth.ts
callbacks: {
  session({ session, user }) {
    session.user.id = user.id
    return session
  },
},
```

> *"Notice that in this case, we are getting the id from the `user` object, not the `token`. With the database session strategy, the `user` object is the user from the database, and there is no `token`."*

⚠️ And a caveat that surprises people who expect the session table to be a scratchpad:

> *"The session object is not persisted server-side, even when using database sessions - only data such as the session token (id), the user, and the expiry time is stored in the session table. If you need to persist session data server-side, you must save it elsewhere. You can connect to the database in the `session()` callback to retrieve this information."*

So "put the team id in the session" under the database strategy means *querying for it in the `session` callback on every read* — which is fine, and which you should do knowingly, because it is a query per session access.

The consequence for role changes is direct. Under the JWT strategy a role written into the token at sign-in stays there until the token is reissued; under the database strategy a `session` callback that reads the user row picks up the new role on the next request. Auth.js's own comparison of the two strategies is quoted at length in [03c](03c-stateless-vs-stateful-sessions-the-revocation-question.md); this is the same argument seen from the config file.

## Credentials, and the password hash

The `Credentials` provider takes an `authorize` function that returns a user object or null. This is where password hashing enters, and it is the only library this page pulls in that is not Auth.js itself: **bcrypt 6.0.0**. The Next.js authentication guide uses it in its own sign-up example (`await bcrypt.hash(password, 10)`).

```ts
// auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { db } from '@/lib/db'

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'database' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '')
        const password = String(credentials?.password ?? '')

        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, passwordHash: true },
        })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
})
```

Returning `null` — not throwing — is how `authorize` signals a failed login. And bcrypt has one property that is a genuine security bug if you do not know it, stated verbatim in its README:

> *"Per bcrypt implementation, only the first 72 bytes of a string are used. Any extra bytes are ignored when matching passwords. Note that this is not the first 72 *characters*. It is possible for a string to contain less than 72 characters, while taking up more than 72 bytes (e.g. a UTF-8 encoded string containing emojis). If a string is provided, it will be encoded using UTF-8."*

The README also records a version floor:

> *"Versions `< 5.0.0` suffer from bcrypt wrap-around bug and *will truncate passwords >= 255 characters leading to severely weakened passwords*. Please upgrade at earliest."*

## Gotchas

**★ Symptom: `npm install next-auth` produces a package with no `auth()` export.** Cause: you installed the `latest` tag, which is v4 (**4.24.15**); the App Router API is v5, published only under `beta`. Fix: install the tag the docs install.

```bash
npm install next-auth@beta
```

**★ Symptom: adding a database adapter changed session behaviour and added a query per request.** Cause: *"[JWT] is the default session strategy for Auth.js unless a database provider is configured"* — the adapter flipped you to database sessions implicitly. Fix: state the strategy so it is a decision rather than a side effect.

```ts
export const { handlers, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database' }, // or 'jwt' — say which
  providers: [GitHub],
})
```

**★ Symptom: `session.user.id` is `undefined` even though the `jwt` callback sets `token.id`.** Cause: under the JWT strategy both callbacks are needed — `jwt` puts it on the token, `session` copies it onto the session. Only one was written. Fix: write both, exactly as the guide shows.

**★ Symptom: a value written in the `jwt` callback disappears after the first request.** Cause: the write was not guarded, or was placed where `user` is expected on every call. `user` is populated only during sign-in; on later calls the callback gets the existing token. Fix: guard the write and let the token carry it forward.

```ts
jwt({ token, user }) {
  if (user) token.id = user.id  // sign-in only
  return token
}
```

**★ Symptom: the `session` callback copies from `token` and everything is undefined.** Cause: the app is on the database strategy, where *"there is no `token`"* and the second argument is `user`. Fix: destructure `{ session, user }` and read `user.id`.

**★ Symptom: users' passwords longer than 72 bytes all authenticate against the same hash.** Cause: bcrypt silently truncates at 72 **bytes** — not characters. Two passwords sharing a 72-byte prefix are the same password to bcrypt. Fix: reject over-long passwords before hashing, or pre-hash to a fixed-length digest. Rejecting is simpler and honest to the user.

```ts
const bytes = new TextEncoder().encode(password).length
if (bytes > 72) return { error: 'Password is too long (max 72 bytes).' }
```

**★ Symptom: `authorize` throws on a bad password and the user sees a 500.** Cause: `authorize` signals failure by returning `null`; a throw is an error, not a rejected login. Fix: `return null` for every credential failure and reserve throwing for genuine faults.

**★ Symptom: sign-in works in development and fails in production with a decryption error.** Cause: `AUTH_SECRET` differs between build and runtime, or between instances. Auth.js encrypts the session token with it, so a mismatched secret makes every existing cookie undecryptable. Fix: one secret per environment, injected at runtime; generate with `npx auth secret`.

**★ Symptom: a `proxy.ts` re-export of `auth` is treated as the app's access control, and a Server Action is reachable without a session.** Cause: the documented purpose of that line is keeping the session alive, and proxies do not run in front of every entry point. Fix: authorize in the DAL; see [03g](03g-authorization-ownership-checks-and-every-entry-point.md).

**★ Symptom: `middleware.ts` no longer runs after upgrading to Next.js 16.** Cause: the file was renamed. Auth.js records it: *"As of Next.js 16, `middleware.ts` has been renamed to `proxy.ts`."* Fix: rename the file and export `auth as proxy`.

**★ Symptom: an admin demoted in the database keeps admin UI until they sign out.** Cause: JWT strategy with the role baked into the token at sign-in. Fix: either read the role per request in the DAL rather than from the session, or move to the database strategy and read the user row in the `session` callback.

## Interview questions

**★ What does `session.strategy` change, and why is leaving it unset risky?**
It selects stateless (encrypted JWT in a cookie) versus database sessions. Leaving it unset makes it *derived*: Auth.js defaults to JWT unless a database adapter is configured, so adding an adapter for user storage silently switches your session model, adds a per-request query, and changes whether you can revoke a session. None of that shows up in a diff that only adds an adapter. Setting it explicitly turns an inference into a stated property that a reviewer can check.

**★ Why does the JWT strategy need two callbacks to expose a user id, and the database strategy only one?**
Because in the JWT strategy the session is reconstructed from the token on every request, so anything not written into the token during sign-in does not exist later — `jwt` persists it, `session` projects it. In the database strategy the session read already loads the user row, so the `session` callback receives a real `user` object and can copy from it directly; there is no token in the middle to persist through.

**★ In the `jwt` callback, why is `if (user)` there?**
Because `user` is populated only on the sign-in call. On every subsequent invocation the callback receives the existing token and no `user`, so an unguarded `token.id = user.id` throws or overwrites with `undefined` on the second request. The guard encodes the callback's actual lifecycle: enrich on sign-in, pass through afterwards.

**★ Auth.js says its JWT session is "encrypted with a secret key only known to the server". Why does that matter, and what does it not buy you?**
It means the session cookie is a JWE, so the claims are confidential as well as tamper-evident — you cannot paste it into a decoder and read the user's email, which a plain signed JWT permits. What it does not buy you is revocation. An encrypted token is still a bearer credential valid until its expiry, and Auth.js is explicit that signing out destroys the cookie, not the token.

**★ The Auth.js docs tell you to add `export { auth as proxy }` — is that your authorization layer?**
No, and the documentation does not claim it is. The stated purpose is *"to keep the session alive"* by updating the session expiry. A proxy is a coarse filter: it runs on navigations including prefetches, it does not run on paths a matcher excludes, and it sits in front of route rendering rather than in front of data access. Server Actions and Route Handlers are independently reachable. Authorization belongs next to the data, in the DAL.

**★ Why is bcrypt's 72-byte limit a security issue rather than a curiosity?**
Because it is a silent collapse of the password space. Anything past 72 bytes is discarded, so a passphrase manager generating 100-character passwords is producing credentials whose last 28 characters are decorative — and two distinct passwords sharing a 72-byte prefix authenticate against the same hash. It is bytes rather than characters, so a shorter string containing multi-byte characters can also cross the line. The fix is to reject over-long input explicitly, so the user learns about the limit rather than being quietly given a weaker credential than they chose.

**★ What is the significance of Auth.js being "part of Better Auth"?**
It is a project-governance fact that appears on every page of `authjs.dev`, alongside a first-class "Migrate to Better Auth" documentation entry — and the v5 line for Next.js is still on a `beta` tag. I would not overstate what that implies about maintenance, because the documentation does not say. What it *does* mean for a decision today is that "which library will still be maintained in three years" is a question you should answer from the project's current statements rather than from a page like this one, and that the migration path is documented, which is more than most libraries offer.

---

← [Verifying a token, correctly](03d-verifying-a-token-alg-none-and-algorithm-confusion.md) · [Chapter 10 overview](01-explanation.md) · Next → [Clerk and Supabase: the hosted-identity trade](03f-clerk-and-supabase-the-hosted-identity-trade.md)
