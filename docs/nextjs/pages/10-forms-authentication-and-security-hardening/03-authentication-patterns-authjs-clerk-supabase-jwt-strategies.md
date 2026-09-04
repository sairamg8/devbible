---
sidebar_position: 3
title: "Before you pick a library, understand what you are actually shipping: a bearer credential in a cookie whose attributes — not your code — are the security control"
sidebar_label: "Sessions: the cookie is the control"
description: "What a session is in a Next.js application, every Set-Cookie attribute as the control it actually is, the __Host- prefix, why SameSite=Strict breaks an OAuth callback, and why cookies() cannot be set during a Server Component render."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) (docs `lastUpdated: 2026-08-25`), [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`lastUpdated: 2026-06-09`), and MDN [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie). Documentation-verified; no sandbox run.
> Target: **Next.js 16.3.4 · React 19.2.8**.

**Every authentication library you will read about in the next six pages ends in the same place: a string in a cookie that the browser replays on every request, and which the server treats as proof of identity. Auth.js, Clerk and Supabase differ in who mints that string and what is inside it; they do not differ in the fact that whoever holds it *is* the user. That makes the `Set-Cookie` attributes — not your route guards, not your `if (!session) redirect()` — the primary security control. This page is the primitive. Everything after it is a choice about who manages it.**

## A session is a bearer credential, and bearer means what it says

The docs frame session management as one of three separate concepts, and the separation is worth taking literally:

> *"**Authentication**: Verifies if the user is who they say they are. … **Session Management**: Tracks the user's auth state across requests. … **Authorization**: Decides what routes and data the user can access."*

Authentication happens once, at sign-in. Everything afterwards is the session doing the work. The cookie is a **bearer** credential: the server does not check who is presenting it, only that it validates. Copy the cookie value out of one browser's devtools and paste it into another, and the second browser is that user. Nothing in HTTP prevents this. The attributes below are the entire set of levers you have to make stealing it harder, and each one closes a specific attack.

## The attributes, as controls rather than as a table

Next.js accepts these on `cookieStore.set()`. The reference lists the full option set — `name`, `value`, `expires`, `maxAge`, `domain`, `path`, `secure`, `httpOnly`, `sameSite`, `priority`, `partitioned` — and notes one thing worth remembering:

> *"The only option with a default value is `path`."*

So `httpOnly`, `secure` and `sameSite` are **off unless you write them**. There is no safe default.

### `HttpOnly` — closes the XSS exfiltration path

Restricts the cookie to HTTP requests, preventing client-side access. Without it, one successful XSS payload reads `document.cookie` and posts your session token to an attacker's endpoint; the user never notices, and the session survives their next password change unless you also revoke server-side. With it, a script that runs on your page can still *make requests as the user* — the browser attaches the cookie — but it cannot **take the credential away** with it. That distinction is the whole value: XSS becomes a session-duration problem instead of a permanent account compromise.

`HttpOnly` is also why the "just read the JWT in a Client Component" pattern is wrong at the root and not merely inelegant. If your client code can read the session, so can an injected script.

### `Secure` — refuses to travel in cleartext

Sends the cookie only over HTTPS. MDN attaches a caveat worth quoting because it is the one people over-read:

> *"Do not assume that `Secure` prevents all access to sensitive information in cookies (session keys, login details, etc.). Cookies with this attribute can still be read/modified either with access to the client's hard disk or from JavaScript if the `HttpOnly` cookie attribute is not set."*

Also: *"Insecure sites (`http:`) cannot set cookies with the `Secure` attribute. The `https:` requirements are ignored when the `Secure` attribute is set by `localhost`."* That last clause is why `secure: true` unconditionally is correct — local development is exempted by the browser, so the common `secure: process.env.NODE_ENV === 'production'` conditional buys nothing and creates a config path where production can be wrong.

### `SameSite` — the CSRF control, and the one that breaks OAuth

MDN's definitions, verbatim:

> *"`Strict` — Send the cookie only for requests originating from the same site that set the cookie."*

> *"`Lax` — Send the cookie only for requests originating from the same site that set the cookie, and for cross-site requests that meet both of the following criteria: The request is a top-level navigation … The request uses a safe method: in particular, this excludes `POST`, `PUT`, and `DELETE`."*

Read those two criteria against an OAuth flow and the failure mode falls out. The provider (`accounts.google.com`) redirects the browser back to `https://yourapp.com/api/auth/callback/google`. That is a **cross-site top-level navigation**. Under `Lax` your cookies ride along, so the `state` and PKCE-verifier cookies your library set before the redirect arrive and the callback validates. Under `Strict`, they do not — the request originates from a different site — and the callback fails with a state-mismatch error that looks like a provider misconfiguration and is not.

It gets subtler. Some OAuth and SAML providers use the `form_post` response mode: the callback arrives as a cross-site **POST**, not a GET. `Lax` explicitly excludes POST. MDN records the escape hatch browsers built for exactly this:

> *"When `Lax` is applied as a default, a more permissive version is used. In this more permissive version, cookies are also included in `POST` requests, as long as they were set no more than two minutes before the request was made."*

🔴 That permissive window applies to the browser's **implicit default**, not to a cookie you explicitly labelled `SameSite=Lax`. So a flow cookie you set `Lax` yourself is *not* covered by it, and a cross-site POST callback will not carry it. The available options for that case are `SameSite=None; Secure` on the short-lived flow cookies, or avoiding `form_post` entirely. I have not verified which of these any particular auth library chooses — check its source or its cookie configuration rather than assuming. The session cookie itself stays `Lax` either way.

`None` requires `Secure`. A cookie sent on every cross-site subresource request is a CSRF liability, which is why it is reserved for the handful of short-lived flow cookies that genuinely need it.

### `Path` — scope, and a weak one

Limits the cookie to a URL prefix; defaults to `/`. Treat it as tidiness rather than security: a same-origin script can set a cookie on any path, and path scoping has never been a boundary between parts of one origin. Set `path: '/'` and use it consistently — the `__Host-` prefix below *requires* it anyway.

### `Domain` — omit it

> *"Setting the domain makes the cookie available to that domain and all its subdomains. If omitted, the cookie is returned only to the host that sent it (i.e., it becomes a 'host-only cookie'). This is more restrictive than setting the host name, as the cookie is not made available to subdomains of the host."*

The counter-intuitive part is that **specifying `Domain=example.com` widens scope**, and specifying nothing narrows it. If you host anything untrusted on a subdomain — a status page, a customer-controlled CNAME, a preview deployment — a domain-scoped session cookie is readable and *settable* from there. Omit `Domain` unless you have a concrete cross-subdomain requirement.

### `Max-Age` vs `Expires` — pick `Expires` if you have a server-side expiry to mirror

`Max-Age` is a lifespan in seconds; `Expires` is an absolute HTTP-date. Both delete the cookie client-side; neither invalidates the token server-side. MDN notes the clock problem and its mitigation:

> *"The `Expires` attribute is set by the server with a value relative to its own internal clock, which may differ from that of the client browser. Firefox and Chromium-based browsers internally use an expiry (max-age) value that is adjusted to compensate for clock difference, storing and expiring cookies based on the time intended by the server."*

The Next.js guide's own example uses `expires` and computes it from the same `expiresAt` used to sign the token, which keeps cookie lifetime and token lifetime in one variable. That is the pattern to copy: **one expiry value, used twice.** Where they drift, you get a cookie the browser still sends and the server always rejects — an infinite redirect loop to `/login`.

Omitting both makes it a session cookie, removed when the client shuts down — except that MDN warns *"many web browsers have a session restore feature … Session cookies will also be restored, as if the browser was never closed."* "It expires when they close the tab" is not a property you can rely on.

### `__Host-` — the strongest thing on the list, and it costs one string

> *"Cookies with names starting with `__Host-` must be set with the `Secure` attribute by a secure page (HTTPS). In addition, they must not have a `Domain` attribute specified, and the `Path` attribute must be set to `/`. This guarantees that such cookies are only sent to the host that set them, and not to any other host on the domain. It also guarantees that they are set host-wide and cannot be overridden on any path on that host. This combination yields a cookie that is as close as can be to treating the origin as a security boundary."*

The prefix moves enforcement into the browser. A compromised subdomain cannot overwrite a `__Host-` cookie, because a `Set-Cookie` from `evil.example.com` naming `__Host-session` with a `Domain` attribute is *rejected by the browser*, not merely ignored by you. That closes session fixation via subdomain, which no amount of server-side code can close on its own.

MDN documents three further prefixes — `__Secure-`, `__Http-` and `__Host-Http-`. The last is the strongest available:

> *"Cookies with names starting with `__Host-Http-` must be set with the `Secure` flag by a secure page (HTTPS) and must have the `HttpOnly` attribute set to prove that they were set via the `Set-Cookie` header. In addition, they also have the same restrictions as `__Host-`-prefixed cookies."*

⚠️ The caveat is real: *"You cannot count on these additional assurances on browsers that don't support cookie prefixes; in such cases, prefixed cookies will always be accepted."* A prefix is defence in depth on top of correct attributes, never a replacement for them.

## `cookies()` in Next.js: async, readable everywhere, writable in two places

```ts
// lib/session-cookie.ts
import 'server-only'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = '__Host-session'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function readSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value
}

export async function writeSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS)
}
```

Note there is no `domain` key: omitting it is what makes `__Host-` legal, and it is also what you wanted.

The reference is explicit that the read is asynchronous:

> *"`cookies` is an **asynchronous** function that returns a promise. You must use `async/await` or React's `use` function to access cookies."*

and that it is a request-time API:

> *"`cookies` is a Request-time API whose returned values cannot be known ahead of time. Using it in a layout or page will opt a route into dynamic rendering."*

## Why you cannot set a cookie while rendering

This is the constraint that shapes every sign-in flow in the App Router, and it is not a framework limitation:

> *"**Setting cookies** is not supported during Server Component rendering. To modify cookies, invoke a Server Function from the client or use a Route Handler."*

> *"HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler."*

The mechanism, in the docs' own words:

> *"The server can only send instructions (via `Set-Cookie` headers) to tell the browser to store cookies - the actual storage happens on the client side. This is why cookie operations that modify state (`.set`, `.delete`) must be performed in a Server Function or Route Handler where the response headers can be properly set."*

`Set-Cookie` is a **header**. Headers are flushed before the body. A Server Component renders *into* the body, and with streaming that body has already started travelling. There is no place left to put the header. So "log the user in" and "render the logged-in page" cannot be the same operation — the first is a Server Function or Route Handler that sets the header, the second is a render that reads it.

`.delete` carries an extra constraint most people meet as a bug:

> *"The `.delete` method can only be called: In a Server Function or Route Handler. If it belongs to the same domain from which `.set` is called. For wildcard domains, the specific subdomain must be an exact match. Additionally, the code must be executed on the same protocol (HTTP or HTTPS) as the cookie you want to delete."*

## The payoff: one roundtrip, not two

The awkward constraint buys something concrete:

> *"After you set or delete a cookie in a Server Function, Next.js can return both the updated UI and new data in a single server roundtrip when the function is used as a Server Action (e.g., passed to a form's `action` prop)."*

> *"The UI is not unmounted, but effects that depend on data coming from the server will re-run."*

So a sign-in action that sets the cookie and returns can hand back re-rendered, authenticated UI in the same response — no `router.refresh()`, no second fetch. To refresh cached data alongside it the docs say to call `revalidatePath` or `revalidateTag` **inside the function**.

```ts
// app/actions/auth.ts
'use server'

import { redirect } from 'next/navigation'
import { writeSessionCookie, sessionExpiry, clearSessionCookie } from '@/lib/session-cookie'
import { signSession } from '@/lib/session'
import { findUserByEmail, verifyPassword } from '@/lib/users'

export async function login(_state: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const user = await findUserByEmail(email)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    // One message for both branches: a distinct "no such user" leaks account existence.
    return { error: 'Invalid email or password.' }
  }

  const expiresAt = sessionExpiry()
  await writeSessionCookie(await signSession({ userId: user.id, expiresAt }), expiresAt)
  redirect('/dashboard')
}

export async function logout() {
  await clearSessionCookie()
  redirect('/login')
}
```

`useActionState` binds this to a form; its mechanics belong to chapter 8 — see [`useOptimistic` and `useActionState`](../08-state-management-in-an-rsc-world/06-useoptimistic-and-useactionstate-as-framework-native-alterna.md).

## Gotchas

**★ Symptom: `SameSite=Strict` on the session cookie, and every OAuth sign-in fails with a state mismatch.** Cause: the provider's redirect back to your callback is a cross-site top-level navigation, so `Strict` withholds the `state` and PKCE cookies your library needs to complete the exchange. The callback sees no state, assumes forgery, and errors. Fix: `sameSite: 'lax'` on the session cookie, and let the auth library manage its own short-lived flow cookies.

```ts
cookieStore.set(SESSION_COOKIE, token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax', // NOT 'strict' — the OAuth callback is a cross-site navigation
  path: '/',
  expires: expiresAt,
})
```

**★ Symptom: sign-in works locally, and in production the cookie is silently not stored.** Cause: you named the cookie `__Host-session` and also passed `domain`, or `path` was not `/`. The browser rejects the whole `Set-Cookie` — no error, no warning in the response, just no cookie. Fix: with a `__Host-` name, set `path: '/'` and pass **no** `domain` key at all.

```ts
cookieStore.set('__Host-session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',            // required by the prefix
  expires: expiresAt,   // and no `domain:` key — its presence voids the cookie
})
```

**★ Symptom: `Error: Cookies can only be modified in a Server Action or Route Handler` from a page that "just logs the user in on load".** Cause: `cookieStore.set()` ran during Server Component rendering, where the response headers are already gone. Fix: move the write into a Route Handler and redirect into it, or into a Server Function invoked from the client.

```ts
// app/api/session/route.ts
import { NextResponse } from 'next/server'
import { writeSessionCookie, sessionExpiry } from '@/lib/session-cookie'
import { signSession } from '@/lib/session'

export async function POST(request: Request) {
  const { userId } = await request.json()
  const expiresAt = sessionExpiry()
  await writeSessionCookie(await signSession({ userId, expiresAt }), expiresAt)
  return NextResponse.json({ ok: true })
}
```

**★ Symptom: logout appears to work, then the user is still signed in on the next page.** Cause: `.delete(name)` only clears a cookie whose domain and protocol match the one used to set it — the docs list both conditions. A cookie set with `domain: '.example.com'` is not deleted by a bare `.delete()` from `app.example.com`. Fix: stop setting `domain` in the first place; if you must, overwrite explicitly with a zero lifetime, which the reference documents as immediate expiry.

```ts
const cookieStore = await cookies()
cookieStore.set(SESSION_COOKIE, '', { maxAge: 0, path: '/', domain: '.example.com' })
```

**★ Symptom: the session cookie is gone every morning even though `Max-Age` says seven days.** Cause: you set neither `expires` nor `maxAge` on one of the code paths — a second `set()` for a "session refresh" that forgot the options — so that write turned it into a session cookie. Every `set()` replaces the cookie wholesale; options are not merged. Fix: funnel every write through one helper that always passes the full option set, as `writeSessionCookie` above does.

**★ Symptom: an XSS on a marketing subdomain results in full account takeover on the app.** Cause: the session cookie carried `Domain=example.com`, making it readable and writable from every subdomain. Fix: drop `domain`, adopt the `__Host-` prefix, and the browser enforces host-only for you.

**★ Symptom: sign-in works, and the very next navigation shows the logged-out shell.** Cause: the action set the cookie but the page it redirected to was served from a cache populated before the login. Fix: call `revalidatePath` inside the same Server Function, before the redirect — the reference states this explicitly as the way to refresh cached data alongside the cookie write.

**★ Symptom: `cookies()` used inside a layout, and the whole route tree stops prerendering.** Cause: it is a request-time API, so *"using it in a layout or page will opt a route into dynamic rendering"*. Fix: read the session in the smallest component that needs it and wrap that component in `<Suspense>`. With Cache Components on, this becomes a hard rule rather than a performance note — see [12 · Auth with Cache Components: the session read](12-authentication-with-cache-components-reading-the-session.md).

**★ Symptom: `TypeError: cookieStore.get is not a function`.** Cause: `cookies()` returns a promise in Next.js 15 and later and you did not await it. Fix: `const cookieStore = await cookies()`. The reference notes synchronous access still works in 15 for backwards compatibility but *"this behavior will be deprecated in the future"* — do not build on it.

## Interview questions

**★ Why is `HttpOnly` a meaningful control if an XSS payload can still make authenticated requests?**
Because it changes the *duration* of the compromise. Without `HttpOnly`, the payload reads `document.cookie` and exfiltrates the token; the attacker then has a credential they can replay from their own machine, on their own schedule, for as long as it is valid — and the user has no signal. With `HttpOnly`, the attacker can only act while their script is executing in the victim's page. They can still do damage in that window, but they cannot walk away with the credential. It converts "account taken over" into "some requests were made", which is a very different incident.

**★ A team sets `SameSite=Strict` on the session cookie because it is "more secure". What breaks, and why is the answer not to relax it globally?**
OAuth callbacks break, because the redirect from the identity provider back to your callback URL is a cross-site top-level navigation and `Strict` withholds cookies on those. So does any inbound deep link from an email or another site — the user arrives logged out, then appears logged in after one internal navigation, which is a bewildering bug report. The correct answer is `Lax` for the session cookie, which permits cross-site top-level navigations with safe methods, plus explicit CSRF protection for state-changing requests. Relaxing to `None` globally is the wrong direction: it sends the cookie on every cross-site subresource request.

**★ Why does a cookie named `__Host-session` sometimes vanish without any error?**
Because the prefix is enforced by the browser as a validation rule on the whole `Set-Cookie` header, and a failed validation is a silent rejection rather than an error response. The three conditions are `Secure`, no `Domain` attribute, and `Path=/`. Violate any one and the browser discards the header. The usual culprit is a `domain` option copied from an older config, or a `path` scoped to `/api`.

**★ Explain, mechanically, why `cookies().set()` cannot run in a Server Component.**
`Set-Cookie` is an HTTP response header, and headers precede the body on the wire. A Server Component produces body content, and with streaming the response has already begun — the docs put it as *"HTTP does not allow setting cookies after streaming starts."* There is no protocol-level way to add a header to a response whose body is already in flight. Server Functions and Route Handlers run before the response body is committed, which is why they are the two permitted places.

**★ What do you actually gain by setting the cookie inside a Server Action rather than a Route Handler?**
A roundtrip. The reference states that after a Server Function sets or deletes a cookie, Next.js *"can return both the updated UI and new data in a single server roundtrip"* when the function is used as a Server Action. A Route Handler gives you the header but not the re-render, so the client has to navigate or refetch afterwards. The Route Handler is still the right tool when the cookie write is not tied to a form submission — an OAuth callback, for example.

**★ `Max-Age` or `Expires` for a session cookie?**
Either works; what matters is that the value is derived from the *same* variable as the token's own expiry. The failure mode is drift: a cookie that outlives the token gives you a browser cheerfully sending a credential the server always rejects, which reads to the user as a redirect loop. `Expires` is slightly easier to keep in sync when your token library also takes an absolute date, and modern browsers already compensate for client/server clock difference when storing it. Omitting both silently produces a session cookie, which browser session-restore then keeps alive anyway — so "no expiry" is not a security decision, it is an undefined one.

**★ Why is omitting `Domain` more restrictive than setting it to your own hostname?**
Because a cookie with no `Domain` attribute is *host-only*: it goes back only to the exact host that set it. A cookie with `Domain=app.example.com` is sent to `app.example.com` **and all of its subdomains**. MDN puts it plainly — *"if a domain is specified, then subdomains are always included."* Since subdomains are the usual place untrusted or lower-trust things get hosted, widening the scope is exactly what you do not want.

**★ Someone proposes storing the session token in `localStorage` "so the client can read the user". What do you say?**
That the tradeoff is one-directional and bad. `localStorage` is readable by any script on the origin, so you have given up `HttpOnly` entirely — the single control that stops an XSS from stealing the credential outright. You also have to attach the token to every request by hand, which loses the browser's automatic `SameSite` protection and means server-rendered requests carry no credential at all. And the thing it buys you — reading the user client-side — is available anyway by rendering the user in a Server Component and passing a minimal DTO down.

---

← [Boundary validation with Zod](02-boundary-validation-react-hook-form-zod-schemas-shared-acros.md) · [Chapter 10 overview](01-explanation.md) · Next → [The Data Access Layer](03b-the-data-access-layer-server-only-and-the-dto.md)
