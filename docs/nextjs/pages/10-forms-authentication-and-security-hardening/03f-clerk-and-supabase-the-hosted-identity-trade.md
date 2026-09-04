---
title: "Clerk and Supabase are not two flavours of the same product — one moves your authorization model into a dashboard, the other moves it into Postgres, and that is the decision you are actually making"
sidebar_label: "Clerk and Supabase"
sidebar_position: 124
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against Clerk — [Next.js quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart.md), [`auth()`](https://clerk.com/docs/reference/nextjs/auth.md), [Session tokens](https://clerk.com/docs/guides/sessions/session-tokens.md) — and Supabase — [Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client.md), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security.md). Documentation-verified; no sandbox run.
> Target: **Next.js 16.3.4** · **@clerk/nextjs 7.9.1** · **@supabase/supabase-js 2.115.0** · **@supabase/ssr 0.12.6**.

**Both of these are "hosted auth", and treating them as interchangeable is how teams end up with a data model that fights their identity provider. Clerk's session token carries organizations, roles, permissions, plans and features as claims — so your authorization model lives in Clerk's dashboard and arrives in a JWT. Supabase's answer is Row Level Security: authorization is a `WHERE` clause the database appends to every query, expressed in SQL. Those are different architectures, not different pricing tiers. This page is the trade, the one architecture-changing feature of each, and the specific footgun each one has in Next.js.**

## What moves off your infrastructure, in both cases

The user table, the password hashes, the OAuth client secrets, the email delivery for verification and reset, the MFA enrolment flows, the account-recovery support burden, and the responsibility for keeping all of it patched. That is a real amount of work, and the security-relevant portion of it is work most teams do worse than a vendor does.

What you give up is symmetric and just as real:

- **The user record is not in your database.** Every join between a user and your own data crosses a network boundary or relies on a mirrored copy you must keep in sync.
- **Sign-in availability is theirs.** Your uptime is now bounded by theirs, and there is no degraded mode.
- **Migration is a data-export project**, not a config change — and for password-based accounts it is frequently a forced-reset project, because hashes may not be exportable.
- **Cost scales with users**, on a curve you do not control.
- **Session semantics are theirs.** Lifetimes, refresh behaviour, revocation latency and claim contents are product decisions made elsewhere.

Neither vendor hides these. They are the price, and the price is often worth paying.

## Clerk: the identity model arrives as claims

Setup is now CLI-driven: *"`npx -y clerk@latest init`"*, and *"`clerk init` writes `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`."* The quickstart's "Critical rules" section is unusually direct and worth quoting because three of the five are things people get wrong:

> *"Name the middleware file by the `next` version in `package.json`: `proxy.ts` on Next.js 16+, `middleware.ts` on 15 and below. The contents are identical."*

> *"`auth()` from `@clerk/nextjs/server` is async. Always `await auth()`."*

> *"`ClerkProvider` goes inside `<body>`, not wrapping `<html>`."*

> *"Never expose `CLERK_SECRET_KEY` in client code."*

> *"Use `@clerk/nextjs`, not `@clerk/clerk-react`."*

`auth()` has three stated constraints:

> *"Only available for App Router. Only works on the server-side, such as in Server Components, Route Handlers, and Server Actions. Requires `clerkMiddleware()` to be configured."*

That third one is structural: on Clerk, the proxy is not optional garnish, it is what populates the request context `auth()` reads from.

```tsx
// app/page.tsx
import { auth } from '@clerk/nextjs/server'

export default async function Page() {
  const { isAuthenticated, redirectToSignIn, userId } = await auth()

  if (!isAuthenticated) return redirectToSignIn()

  return <h1>Hello, {userId}</h1>
}
```

### `auth.protect()` and the 404

`protect()` is the piece worth knowing precisely, because its failure behaviour is deliberate and surprising. The documented matrix:

| Authenticated | Authorized | `auth.protect()` will |
|---|---|---|
| Yes | Yes | Return the `Auth` object. |
| Yes | No | Return a **`404`** error. |
| No | No | Redirect the user to the sign-in page. |

> *"For non-document requests, such as API requests, `auth.protect()` returns: A `401` error for unauthenticated Server Action requests. A `404` error for other unauthenticated requests with session token type. A `401` error for unauthenticated requests with machine token types."*

A `404` for "authenticated but not authorized" is a design choice: a `403` confirms the resource exists, which leaks the existence of other tenants' records. If your API contract promises `403`, you will need to catch and remap.

### The one thing that changes your architecture

Clerk's session token is a short-lived JWT whose **version 2 default claims** include the authorization model, not just identity: `sub` (user), `sid` (session), `org` (`o`) with `id`, `slg` (slug), `rol` (role) and `per` (permissions), plus `pla` (plan) and `fea` (features). The docs note the encoding is deliberately terse — *"The Organization claims above are intentionally designed to be as compact as possible to keep JWT tokens small"* — and that you should *"use one of our SDKs that support API version 2025-04-10 to handle decoding reliably"* rather than parse `o.fpm` by hand.

That is the architecture change. **Roles, permissions, organizations, plans and features become things you define in Clerk and receive as claims**, rather than rows you own and query. It is genuinely powerful — multi-tenant B2B authorization is most of the hard part of an application, and having it arrive pre-decided removes a lot of code. It is also a coupling: your permission model now has a schema you do not control, and moving off Clerk means reimplementing it.

Two operational claims are worth knowing:

- **`nbf`** — *"The time before which the token is considered invalid … Determined using the **Allowed Clock Skew** JWT template setting in the Clerk Dashboard."* Clock skew is a dashboard setting, which is the honest acknowledgement that fleets drift.
- **`fva`** (factor verification age) — *"Each item represents the minutes that have passed since the last time a first factor or second factor, respectively, was verified."* This is what step-up authentication is built on: "require MFA re-verification within the last five minutes before allowing a destructive action" is a claim comparison rather than a flow you write.

For calling your own or third-party APIs, *"use the `getToken()` method"*, which *"retrieves the current user's session token or a custom JWT template"*.

## Supabase: authorization is a `WHERE` clause

Supabase's Next.js integration is two clients and a proxy. The reason for the proxy is stated as a Next.js constraint:

> *"Since Next.js Server Components can't write cookies, you need a Proxy to refresh expired Auth tokens and store them."*

> *"The Proxy is responsible for: Refreshing the Auth token by calling `supabase.auth.getClaims()`. Passing the refreshed Auth token to Server Components, so they don't attempt to refresh the same token themselves. This is accomplished with `request.cookies.set`. Passing the refreshed Auth token to the browser, so it replaces the old token. This is accomplished with `response.cookies.set`."*

This is the same constraint as [03](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md) — headers precede the body — expressed as a product requirement.

### The three read methods, and the one you must not trust

This is the highest-value paragraph in the Supabase docs and it is easy to skim past:

> *"Use `getClaims` to protect pages and user data. It reads the access token from storage and verifies it. Locally via the WebCrypto API and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup."*

> *"`getUser` makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call."*

> *"`getSession` … The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers)."*

And the warning, marked *Danger* in the source:

> *"Be careful when protecting pages. The server gets the user session from the cookies, which can be spoofed by anyone. Always use `supabase.auth.getClaims()` to protect pages and user data. **Never** trust `supabase.auth.getSession()` inside server code such as Proxy. It isn't guaranteed to revalidate the Auth token. It's safe to trust `getClaims()` because it validates the JWT signature against the project's published public keys every time."*

`getSession()` returns a plausible-looking user object without verifying anything. It is the `jwt.decode` of this SDK — see [03d](03d-verifying-a-token-alg-none-and-algorithm-confusion.md) for why that shape of API keeps producing the same bug.

### The `setAll` cache headers

The cookie adapter has a second argument most tutorials drop:

> *"`setAll` is called whenever the library needs to write cookies, for example after a token refresh. It receives two arguments: the array of cookies to set, and a `headers` object containing cache headers (`Cache-Control`, `Expires`, `Pragma`) that must be applied to the HTTP response to prevent CDNs from caching the response and leaking the session to other users. In the Proxy, apply these headers to the response. In Server Components, the headers cannot be set, which is why the `setAll` call is wrapped in a try/catch and the error is ignored. The Proxy handles writing cookies and headers on every request."*

And the failure it prevents, stated outright:

> *"If your app uses ISR (Incremental Static Regeneration) or is deployed behind a CDN, caching of HTTP responses can cause users to receive another user's session. When a session is refreshed, the new token is written to the response via `Set-Cookie`. If that response is cached and served to a different user, that user will be signed in as the wrong person."*

🔴 **A cached `Set-Cookie` is a session handover.** Dropping the `headers` argument because TypeScript did not force you to use it is how that happens.

Also useful: *"The cookie is named `sb-<project_ref>-auth-token` by default"*, and on client reuse — *"Yes! Creating a Supabase client is lightweight. On the server, it basically configures a `fetch` call. You need to reconfigure the fetch call anew for every request to your server, because you need the cookies from the request."*

### The one thing that changes your architecture

Row Level Security. Supabase's own framing:

> *"Postgres Row Level Security (RLS) gives you granular authorization rules that run inside the database."*

> *"Think of a policy as adding a `WHERE` clause to every query."*

```sql
create policy "Individuals can view their own todos."
on todos for select
to authenticated
using ( (select auth.uid()) = user_id );
```

> *"That policy translates to this whenever a user selects from the todos table: `select * from todos where auth.uid() = todos.user_id;` — Policy is implicitly added."*

This is why the Supabase client can be used from the browser at all: the publishable key is public, and the database refuses to return rows the caller's JWT does not entitle them to. It moves authorization from application code into SQL, which is a real gain — the check cannot be forgotten by a new endpoint, because there is no endpoint.

The corresponding hazard is stated as *Danger* in the RLS guide:

> *"A table in an exposed schema without RLS is readable and writable by any role with a grant on it. Enable RLS on every table in an exposed schema. On projects that still grant `anon` and `authenticated` by default, revoke those grants. Adding policies doesn't remove them."*

Read the last sentence twice. **Adding a policy does not remove a grant.** A table with a thoughtful policy and a lingering grant, but RLS not enabled, is wide open.

## Choosing

- **B2B with organizations, roles and per-plan features → Clerk** removes the largest chunk of work, at the cost of owning that model in their dashboard.
- **You are already on Postgres and want authorization expressed once, near the data → Supabase**, and take RLS seriously enough to test it.
- **You need the user record joinable in your own database, or the authorization model is genuinely bespoke → self-host with Auth.js**, covered in [03e](03e-authjs-nextauth-in-the-app-router.md), and put the checks in the Data Access Layer.

Whichever you pick, the authorization rules in [03g](03g-authorization-ownership-checks-and-every-entry-point.md) still apply. A hosted provider tells you *who*; it does not tell you whether this user may edit *that* row unless you have modelled that in its dashboard or in RLS.

## Gotchas

**★ Symptom: `auth()` returns nothing useful on Clerk and no error explains why.** Cause: `clerkMiddleware()` is not configured, which the reference lists as a hard requirement for `auth()`. On Next.js 16 the likely cause is the filename — Clerk's rule is `proxy.ts` on 16+, `middleware.ts` on 15 and below. Fix: rename the file; the contents are unchanged.

**★ Symptom: Clerk's `auth()` returns a promise-shaped object and destructuring yields `undefined`.** Cause: it is async. Fix: `const { userId } = await auth()`.

**★ Symptom: hydration errors after adding `<ClerkProvider>`.** Cause: it was wrapped around `<html>`. Clerk's rule: *"`ClerkProvider` goes inside `<body>`, not wrapping `<html>`."* Fix: move it inside `<body>`.

**★ Symptom: an API returns `404` where the team expected `403`.** Cause: `auth.protect()` returns `404` for authenticated-but-unauthorized on purpose, to avoid confirming the resource exists. Fix: if your contract requires `403`, do the check yourself and choose the status deliberately — but understand you are trading an information leak for API tidiness.

**★ Symptom: on Supabase, a user occasionally loads a page signed in as someone else.** Cause: a response carrying a refreshed `Set-Cookie` was cached by a CDN or by ISR, because the `headers` from `setAll` were never applied. Fix: apply them in the proxy.

```ts
setAll(cookiesToSet, headers) {
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
}
```

**★ Symptom: a Supabase-protected page lets anyone in who forges a cookie.** Cause: the check used `getSession()`, which loads from storage without re-validating. Fix: `getClaims()`, which *"validates the JWT signature against the project's published public keys every time"*.

```ts
const { data } = await supabase.auth.getClaims()
if (!data?.claims) redirect('/login')
```

**★ Symptom: `setAll` throws inside a Server Component.** Cause: Server Components cannot write cookies or headers. The docs' own pattern is to swallow it, because the proxy has already written them. Fix: wrap and ignore, with a comment saying why — an unexplained empty catch will be "fixed" by someone later.

```ts
try {
  cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
} catch {
  // Called from a Server Component, which cannot set cookies. The Proxy writes them instead.
}
```

**★ Symptom: an RLS policy exists on a table and it is still world-readable.** Cause: RLS was never enabled, or a legacy `anon`/`authenticated` grant survived. The guide: *"Adding policies doesn't remove them."* Fix: enable RLS and revoke the grant.

```sql
alter table todos enable row level security;
revoke all on table todos from anon, authenticated;
```

**★ Symptom: one Supabase client is created at module scope and shared.** Cause: on the server the client is *"basically … a `fetch` call"* configured with the current request's cookies, so sharing one across requests shares one user's credentials. Fix: create it per request — the docs answer their own FAQ with *"Yes!"* — and rely on `createBrowserClient`'s singleton on the client side only.

**★ Symptom: a Clerk permission change does not take effect until the user signs in again.** Cause: roles and permissions are session-token claims, and the token is short-lived but not instantaneous. Fix: understand the propagation delay as a property of the model; where a decision must be immediate, check it server-side against Clerk's API rather than against the token.

## Interview questions

**★ Clerk and Supabase both "handle auth". What is the actual architectural difference?**
Where authorization lives. Clerk encodes it in the session token — organizations, roles, permissions, plans and features arrive as claims defined in Clerk's dashboard — so your application reads decisions someone else's system made. Supabase pushes it into Postgres as Row Level Security, so the rule is a policy the database appends to every query as a `WHERE` clause. The first means your permission model has a schema you do not own; the second means it is SQL you do own, evaluated where the data is. That difference outlives any comparison of sign-in UI quality.

**★ Why does Supabase need a proxy in Next.js when other frameworks in its docs do not?**
Because Server Components cannot write cookies — headers precede the body, and rendering has begun. Supabase's session refresh needs to write a new token, so it needs a place in the request lifecycle where response headers are still open. The proxy is that place, and it does three jobs: refresh via `getClaims()`, hand the new token forward to Server Components with `request.cookies.set`, and hand it to the browser with `response.cookies.set`. Supabase's own docs contrast this with TanStack Start, where the server client writes the cookie directly and no proxy layer is needed.

**★ What is wrong with `getSession()` on the server?**
It does not verify. It reads the session out of storage — cookies, on the server — and returns the embedded user object without re-validating the token against the Auth server or its signature. Since the storage in question is a cookie the client controls, that object is user input. Supabase marks this *Danger* and says never to trust it in server code. `getClaims()` is the correct call because it validates the JWT signature against the project's published public keys on every call.

**★ Why does Clerk return `404` rather than `403` for an authorized-but-forbidden request?**
Because `403` confirms the resource exists. In a multi-tenant application, being able to distinguish "this record is not yours" from "this record does not exist" lets an attacker enumerate other tenants' identifiers. Returning `404` collapses both cases into one indistinguishable response. The cost is that legitimate clients cannot tell a permissions problem from a typo, which is a support burden you accept in exchange for not leaking the tenant graph.

**★ What is the biggest non-obvious risk when adopting Supabase RLS?**
That policies and grants are independent, and only one of them is visible in the code review. The guide is explicit: a table in an exposed schema without RLS enabled *"is readable and writable by any role with a grant on it"*, and *"adding policies doesn't remove them."* So a table can have a carefully written policy, pass review, and still be fully open because RLS was never enabled or a default `anon` grant was never revoked. The mitigation is procedural — every table in an exposed schema goes through the same three steps (grants, policies, tests), and the tests are the part that catches it.

**★ What do you actually lose by moving identity off your infrastructure?**
The user record leaves your database, so every join to it becomes a network call or a mirrored copy you keep in sync. Sign-in availability becomes theirs with no degraded mode. Session semantics — lifetime, refresh, revocation latency, claim contents — become product decisions made elsewhere. Cost scales with users on a curve you do not control. And migration away is a data-export project that, for password accounts, is often a forced-reset project because hashes may not be portable. None of that makes the trade wrong; it makes it a trade rather than a free win.

**★ Clerk's token includes an `fva` claim. What is it for?**
Factor verification age — *"each item represents the minutes that have passed since the last time a first factor or second factor, respectively, was verified."* It is the primitive for step-up authentication: rather than tracking "did they do MFA in this session", you compare a number in the token against a threshold at the point of a sensitive action, and require re-verification if it is too old. Encoding it as a claim means the check is a comparison rather than a stateful flow you have to implement and get right.

---

← [Auth.js in the App Router](03e-authjs-nextauth-in-the-app-router.md) · [Chapter 10 overview](01-explanation.md) · Next → [Authorization: the half that gets breached](03g-authorization-ownership-checks-and-every-entry-point.md)
