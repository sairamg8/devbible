---
title: "Sign-out deletes a row and a cookie, and neither of those touches a single cache — so the question the button raises is not 'is the session gone' but 'what is still sitting in memory that was rendered for the person who just left'"
sidebar_label: "06k · Milestone: sign-out and the caches"
sidebar_position: 37
description: "Chapter 10's capstone, step ten: sign-out as a POST because a cookie cannot be deleted during render, why the database session strategy makes revocation a DELETE, the 'sign out everywhere' feature it unlocks, what survives sign-out on the server and in the browser, and which of it you actually have to invalidate."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies)
> reference (`lastUpdated: 2026-06-09`), the [Data Security guide](https://nextjs.org/docs/app/guides/data-security)
> (`lastUpdated: 2026-08-25`), [Auth.js JWT vs Database session strategies](https://authjs.dev/concepts/session-strategies),
> [Auth.js sign-in and sign-out](https://authjs.dev/getting-started/session-management/login), and this chapter's
> [12](12-authentication-with-cache-components-reading-the-session.md) and
> [13](13-authentication-with-cache-components-sharing-caching-and-mutating.md) for the Cache Components rules.
> Target: **Next.js 16.3.4** · **`next-auth` 5.0.0-beta.32**. Documentation-verified; **no sandbox run**.

**Sign-out is the shortest action in the application and the one with the most surface area behind it.** Deleting the cookie takes a line; deleting the session row takes another; and then there is everything that was *rendered* while the session was alive and has not gone anywhere — a per-user cache entry on the server, a private cache in the browser's memory, an RSC payload for a route that was prefetched three clicks ago. None of it is automatically discarded, and most of it does not need to be. Knowing which parts do is the difference between a sign-out that works and a sign-out that works except on the shared machine in the meeting room.

## Sign-out is a POST, for the same reason sign-in is

> *"HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler."*
> — [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`lastUpdated: 2026-06-09`)

Deleting a cookie is setting a cookie. So `<Link href="/sign-out">` cannot sign anyone out, and a Server Component that clears the session when it renders cannot either. The Data Security guide's version of the rule is a design principle rather than a mechanism:

> *"Mutations (e.g. logging out users, updating databases, invalidating caches) should never be a side-effect, either in Server or Client Components."*
> — [Data Security, Avoiding side-effects during rendering](https://nextjs.org/docs/app/guides/data-security#avoiding-side-effects-during-rendering)

Note that the guide's own first example of a mutation is *logging out users*. There is also a security reason a GET sign-out is bad independent of the framework: a `<img src="/sign-out">` on any page on the internet logs your users out, which is a nuisance-grade CSRF that is nonetheless entirely avoidable.

```tsx filename="app/(dashboard)/sign-out-button.tsx"
import { signOutEverywhereOnThisDevice } from './actions'

export function SignOutButton() {
  return (
    <form action={signOutEverywhereOnThisDevice}>
      <button type="submit">Sign out</button>
    </form>
  )
}
```

```ts filename="app/(dashboard)/actions.ts"
'use server'

import { updateTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { signOut } from '@/lib/auth'
import { readSession } from '@/lib/dal/session'

export async function signOutEverywhereOnThisDevice() {
  // Read the id BEFORE the session is destroyed — afterwards there is no id.
  const session = await readSession()

  if (session) {
    // Expire anything cached under this user's id. See "what survives" below.
    updateTag(`user:${session.userId}`)
  }

  try {
    await signOut({ redirectTo: '/' })
  } catch (error) {
    // signOut() completes by redirecting, and redirect() throws.
    unstable_rethrow(error)
    throw error
  }
}
```

🔴 **The ordering is the whole point.** `signOut()` finishes by redirecting, and `redirect()` throws — so anything written after it never runs. The `updateTag` has to come first, and the user id has to be read before the session is destroyed. This is the same rule chapter 8 states for every action: invalidate before you redirect.

## What the database strategy buys, spent

The strategy chosen in [06](06-project-milestone-sprintdesk-auth-authjs.md) pays off here. Auth.js's documentation describes database sign-out as deleting the session from the database and deleting the session ID from the cookies — so revocation is a row deletion rather than a wish. Which means the feature nobody can build on JWTs is nine lines:

```ts filename="lib/dal/session-admin.ts"
import 'server-only'

import { db } from '@/lib/db'
import { requireUser } from './user'

/** Ends every session for the current user, on every device, immediately. */
export async function signOutAllDevices(): Promise<number> {
  const user = await requireUser()
  const { count } = await db.session.deleteMany({ where: { userId: user.id } })
  return count
}
```

```ts filename="app/(dashboard)/settings/actions.ts"
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { readSession } from '@/lib/dal/session'
import { signOutAllDevices } from '@/lib/dal/session-admin'

export async function endAllSessions() {
  const session = await readSession()
  if (!session) redirect('/sign-in')

  await signOutAllDevices()
  updateTag(`user:${session.userId}`)
  redirect('/')
}
```

That `deleteMany` is why the `@@index([userId])` on the `Session` model in [06b](06b-milestone-wiring-authjs-into-the-app-router.md) is not decoration. On the JWT strategy the equivalent function cannot be written — the documentation states that expiring a JSON Web Token before its encoded expiry is not possible without a server-side blocklist, and a blocklist is a database read on every request, which was the cost JWT was chosen to avoid.

## What survives sign-out, in three tiers

Sign-out clears exactly two things: a cookie and a row. Everything else has to be reasoned about.

| What | Survives sign-out? | Does it matter? |
|---|---|---|
| Session cookie | No — deleted | — |
| `Session` row | No — deleted | — |
| Server-side `'use cache'` entry keyed on `userId` | **Yes** | Usually no. It is keyed, so no other user can address it. |
| Server-side `'use cache'` entry tagged on a *board* | **Yes** | No. It contains board data, and the next reader is authorized independently. |
| `'use cache: private'` result | Browser memory only; **not across a page reload** | Only on a shared device. |
| Client Router Cache (prefetched RSC payloads) | ⚠️ Not settled by the docs I checked | On a shared device, yes. |

**The keyed server entry is the one people panic about and should not.** A `'use cache'` function whose argument is the user id produces an entry addressed by that id. Another user's request produces a different key. Nothing is leaked by the entry outliving the session; the entry is simply warm the next time that person signs in, which is a feature.

**The entry you *do* expire is the one that would be wrong to serve them again.** SprintDesk tags per-user reads `user:${userId}` and expires that tag in the sign-out action — not because of a leak, but because "sign me out" is the strongest signal a user gives that they are leaving a machine, and re-serving their assignment list from cache to whoever sits down next is a bad look even where it is technically their own re-authenticated session.

**The private cache is browser memory and dies on reload.** [12](12-authentication-with-cache-components-reading-the-session.md) establishes this from the docs: a `'use cache: private'` result is never stored on the server and does not persist across page reloads. So the moment the browser performs a document load, it is gone.

⚠️ **What I could not settle: the client Router Cache after a sign-out redirect.** A redirect issued from a Server Action is handled as a client-side transition, and I did not find documentation stating what happens to RSC payloads for authenticated routes that were prefetched before sign-out. I am not going to guess: treat it as **unspecified**. If your product runs on shared machines — a hospital, a warehouse, a school — do not build a security argument on cache eviction you cannot cite. Build it on the DAL instead, which re-checks the session on every request, and accept that a stale rendered payload may sit in one browser tab until it is navigated away from or reloaded.

## Which invalidation function, and why not the others

`updateTag`, because the person who pressed the button must see the result in the response to that button. `revalidateTag` on a stale-while-revalidate profile ships no re-render in the action's response, so the user sees their old, signed-in-looking UI for one more paint. `revalidatePath('/')` would work and throws away every cached entry on that path for every user, which is an enormous amount of collateral for one person leaving. `refresh()` invalidates nothing at all, so a cached scope would replay its old entry and the sign-out would appear not to have worked.

The full comparison of all five — what each invalidates, where each may be called, and who pays the round trip — is [chapter 8's `10b`](../08-state-management-in-an-rsc-world/10b-refresh-against-the-alternatives.md), and it is worth reading before choosing one by habit.

## Gotchas

**★ Symptom: a `<Link href="/sign-out">` does nothing, or signs the user out only sometimes.** Cause: signing out means deleting a cookie, and a cookie cannot be set — or deleted — during Server Component rendering; the docs require `.set` in a Server Function or Route Handler. Fix: a real form posting to a Server Action.

```tsx
<form action={signOutEverywhereOnThisDevice}>
  <button type="submit">Sign out</button>
</form>
```

**★ Symptom: an image or a link preview on a third-party site logs your users out.** Cause: sign-out was reachable by GET, so any `<img src>` triggers it. Fix: the same form POST above. Server Actions are POST-only and Next.js compares `Origin` to `Host`, so the attack disappears rather than being mitigated.

**★ Symptom: the sign-out action runs, the user is signed out, and the `updateTag` never happened.** Cause: it was written after `signOut()`, which completes by throwing a redirect, so the line is unreachable. Fix: invalidate first, redirect last.

```ts
const session = await readSession()
if (session) updateTag(`user:${session.userId}`)
await signOut({ redirectTo: '/' })   // ← throws; nothing below this runs
```

**★ Symptom: `updateTag` is called with `undefined` in the tag string, producing the tag `user:undefined`.** Cause: the session was read *after* `signOut()` destroyed it, or the code assumed a non-null session. Fix: read the id into a local before anything destroys it, and guard the call — as the action above does. A tag built from `undefined` is not an error; it is a real tag that nothing will ever match, so the bug is silent.

**★ Symptom: a `try/catch` around `signOut()` leaves the user on the page, still apparently signed in.** Cause: the catch swallowed the redirect. Fix: `unstable_rethrow(error)` as the first statement of the catch — the same rule as every other action in this milestone.

**★ Symptom: "sign out of all devices" is requested and cannot be built.** Cause: JWT session strategy. The documentation is explicit that expiring a token before its encoded expiry is not possible without a server-side blocklist. Fix: the database strategy, after which the feature is `db.session.deleteMany({ where: { userId } })` — shown above — and the migration is the hard part, not the code.

**★ Symptom: "sign out of all devices" takes seconds on a large deployment.** Cause: no index on `Session.userId`, so the delete scans the table. Fix: `@@index([userId])` on the model in [06b](06b-milestone-wiring-authjs-into-the-app-router.md), then migrate.

**★ Symptom: after signing out and back in, the user's data appears instantly and someone reports it as a security bug.** Cause: a server-side `'use cache'` entry keyed on their user id survived, and they are the same user. Fix: usually none — this is correct behaviour and the key is doing its job. If your product genuinely requires cold data after every sign-in (a kiosk, a regulated terminal), expire the user tag on sign-out as the action above does, and say in a comment that the reason is policy rather than safety.

**★ Symptom: on a shared machine, pressing Back after sign-out shows the previous user's board for a moment.** Cause: a rendered payload still in the browser. The private cache is documented as browser-memory-only and gone on reload, but I could not confirm what a sign-out redirect does to previously prefetched Router Cache entries. Fix: do not rely on cache eviction for this. Every *new* request goes through the DAL and gets redirected, so no fresh data is exposed; if the flash of stale UI is unacceptable for your setting, the honest mitigation is operational — a kiosk mode that closes the browser session — not a framework flag I can point you at.

**★ Symptom: sign-out was made to "clear everything" with `revalidatePath('/', 'layout')`.** Cause: reaching for the biggest hammer available. Fix: `updateTag` on the user's own tag. A path-wide revalidation throws away cached data belonging to every other user of that route because one person left, and the next request from each of them pays a cold render.

**★ Symptom: expired session rows accumulate for months.** Cause: nothing prunes them — sign-out deletes a row, but a user who simply closes the tab leaves theirs behind until it expires, and expiry does not delete. Fix: a scheduled delete of rows whose `expires` is in the past. It is one line in a cron job and it is the difference between a session table that stays small and one that becomes the largest in the database.

## Interview questions

**★ Why can sign-out not be a link?**
Because it is a cookie deletion, and deleting a cookie is setting a cookie — which the `cookies` reference says must happen in a Server Function or Route Handler, since HTTP does not permit it once streaming has started. The Data Security guide reaches the same conclusion from the design side, naming logging out as its first example of a mutation that must never be a rendering side effect. There is a security bonus: a GET sign-out is triggerable by any third-party page with an `<img>` tag, and making it a POST-only Server Action removes that entirely because Next.js also checks `Origin` against `Host`.

**★ What actually happens to your caches when a user signs out?**
Nothing, and that is mostly correct. Sign-out deletes a cookie and a session row. Server-side `'use cache'` entries keyed on the user id survive, but they are addressed by that id so no one else can reach them; entries tagged on a board survive, and the next reader is authorized independently. The `'use cache: private'` results live in browser memory and are documented as not persisting across a page reload. The only deliberate invalidation SprintDesk performs is `updateTag` on the user's own tag, and the reason is policy — "I am leaving this machine" — rather than a leak.

**★ Why must the invalidation come before `signOut()` rather than after?**
Because `signOut()` finishes by redirecting and `redirect()` throws a control-flow exception, so every statement after it is dead code. The same trap catches people with `revalidateTag` after `redirect` in ordinary actions. There is a second ordering constraint specific to sign-out: the tag is built from the user id, and after the session is destroyed there is no id to read — so the session has to be read into a local variable at the top of the action, before anything touches it.

**★ Which of the invalidation functions do you call at sign-out, and what is wrong with each of the others?**
`updateTag`, because the user who pressed the button has to see the signed-out UI in the response to that button. `revalidateTag` on a stale-while-revalidate profile ships no re-render in the action's response, so they would see one more paint of the signed-in chrome. `revalidatePath('/')` works and discards every cached entry on that path for every user, which is a global cost for one person's logout. `refresh()` invalidates nothing, so any cached scope would replay its previous entry and the sign-out would look broken.

**★ How would you implement "sign me out of all my devices", and what does the answer reveal about a decision made much earlier?**
With database sessions it is `db.session.deleteMany({ where: { userId } })` behind a `requireUser()` check, followed by a tag expiry and a redirect — under ten lines. With JWT sessions it cannot be implemented at all without adding a server-side blocklist, because the documentation states that expiring a token before its encoded expiry is not possible; and a blocklist means a database read per request, which is the exact cost the JWT strategy was chosen to avoid. So a feature request that arrives in month six is decided by a config line written in week one, which is why the strategy decision is argued from revocation rather than from convenience.

**★ A shared-device customer asks you to guarantee that nothing of the previous user remains after sign-out. What do you tell them?**
That the server side is guaranteed and the browser side is not, and I would rather say so than point at a cache setting. Server-side: the session row is deleted, so every subsequent request is unauthenticated and the DAL redirects it; per-user cached entries are keyed by user id and unreachable by anyone else. Browser-side: the private cache is documented as memory-only and gone on reload, but I could not find documentation settling what happens to previously prefetched Router Cache payloads after a sign-out redirect, so I will not claim it. For that customer the honest answer is an operational one — a kiosk mode that terminates the browser session — plus the fact that no *new* data can be fetched by the departed session.

**★ Why does the sign-out action read the session before doing anything else?**
Because it needs the user id for the tag, and by the time `signOut()` has run there is no session to read it from. It is a small thing that produces a specific silent bug: read it afterwards and you get `undefined`, `updateTag('user:undefined')` is a perfectly valid call that matches nothing, no error is raised, and the invalidation you thought you had simply never happens. Anything derived from a session must be captured before the session is destroyed.

---

← [06j · What a sign-in endpoint gives away](06j-milestone-what-a-sign-in-endpoint-gives-away.md) · [Chapter 10 overview](01-explanation.md) · Next → [06l · `proxy.ts` as UX, not as the control](06l-milestone-proxy-as-ux-not-control.md)
