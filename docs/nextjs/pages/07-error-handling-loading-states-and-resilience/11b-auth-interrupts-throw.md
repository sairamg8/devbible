---
title: "The auth interrupts work by throwing, and every way of losing that throw is a silent authorization bypass"
sidebar_label: "11b · They work by throwing"
sidebar_position: 15
description: "never return types, try/catch suppression, the un-awaited promise that renders the page anyway, and why neither function works in the root layout."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API references for
> [`unauthorized`](https://nextjs.org/docs/app/api-reference/functions/unauthorized),
> [`forbidden`](https://nextjs.org/docs/app/api-reference/functions/forbidden) and
> [`unstable_rethrow`](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow).
> Target: **Next.js 16.3.4**, App Router.

**`unauthorized()` and `forbidden()` do not return a value that you check — they throw, and the
throw *is* the mechanism.** That single implementation detail explains every way they fail.
Wrap the call in a `try/catch` and the interrupt is suppressed. Leave it in a promise nobody
awaits and it throws where nothing is listening. Put it in the root layout and it does not work
at all. What makes this worth its own page rather than a footnote is the failure mode they
share: **the page renders anyway.** There is no error screen, no 500, no blank. Rendering
continues as though the check had passed, which means the ordinary consequence of getting this
wrong is serving protected content to someone who should not see it.

## Consequence 1 — do not write `return unauthorized()`

Both have a TypeScript [`never`](https://www.typescriptlang.org/docs/handbook/2/functions.html#never)
return type. They throw, so execution stops on its own.

```tsx
// Unnecessary — and it confuses inference downstream
if (!session) return unauthorized()

// Correct
if (!session) unauthorized()
```

## Consequence 2 — `try/catch` suppresses the interrupt

A catch block around the call swallows the throw, and **no 401 or 403 UI renders**. Let it
through with `unstable_rethrow`:

```tsx
import { unstable_rethrow } from 'next/navigation'

try {
  const session = await verifySession()
  if (!session) unauthorized()
  return <Account session={session} />
} catch (e) {
  unstable_rethrow(e)          // let framework interrupts out
  return <p>Something went wrong</p>   // only real errors reach here
}
```

This is the same hazard that catches `notFound()` and `redirect()`, and it has the same fix —
those three plus the two auth interrupts are all framework sentinels travelling as exceptions.
A `catch (e) {}` written to handle a database timeout will happily eat all five.

## Consequence 3 — it must be called in the render path

Call it in **a component, or a function a component `await`s**. A call left in an un-awaited
promise throws where nothing catches it, and no UI renders.

```tsx
// BAD — the promise is never awaited; the throw goes nowhere
async function Account() {
  getAccount()                    // may call unauthorized()
  return <p>Account</p>           // renders anyway
}

// GOOD
async function Account() {
  const account = await getAccount()
  return <p>{account.email}</p>
}
```

In development the server logs:

`⨯ unhandledRejection: NEXT_HTTP_ERROR_FALLBACK;401`

That line is the only signal you get, and it appears in the server log rather than the browser
— which is exactly where nobody is looking during UI work.

## Consequence 4 — neither works in the root layout

Both are documented as uncallable there. Push the check down to the route segment, or into the
DAL function that segment awaits — which is where it belongs anyway, since that is the path
every entry point shares.

## Why this is a security concern and not a correctness one

Group the four together and the pattern is that **the failure is always silent and always
open**:

| Mistake | What the user gets |
|---|---|
| `try/catch` around the call | The catch block's fallback — protected content may still render around it |
| Un-awaited promise | **The protected page, fully rendered** |
| Called in root layout | No interrupt |
| `return unauthorized()` | Works, but signals the author expects a return value |

None of these produce an error page. A reviewer skimming for "does this check the session"
sees a session check and moves on. The bug is not the missing check; it is the check whose
throw went nowhere.

**The structural defence is to put authorization in the Data Access Layer** rather than in
components, so there is one place to audit and every entry point — page, Server Action, Route
Handler — passes through it.

## Gotchas

### Wrapping the call in `try/catch`

**Symptom.** No 401/403 UI ever appears; the generic error branch renders instead.

**Cause.** The interrupt is an exception, and your catch swallows it.

**Fix.** `unstable_rethrow(e)` as the first statement in the catch.

### Leaving the call in an un-awaited promise

**Symptom.** No UI renders, the page continues as if authorized, and in development the log
shows `⨯ unhandledRejection: NEXT_HTTP_ERROR_FALLBACK;401`.

**Cause.** It threw somewhere nothing was catching. **This is the security-relevant failure
mode** — the interrupt did not happen and rendering carried on.

**Fix.** Always `await` the function that may call it. Treat a floating promise in an auth path
as a defect regardless of whether anything has gone wrong yet.

### Writing `return unauthorized()`

**Symptom.** Nothing breaks, but type inference downstream gets confused.

**Cause.** It returns `never` — the `return` is meaningless.

**Fix.** Call it as a statement.

### Calling one in the root layout

**Symptom.** It does not work, and there is no obvious error explaining why.

**Cause.** Documented restriction for both functions.

**Fix.** Move the check to the route segment, or into the DAL function that segment awaits.

### A generic `catch` that eats all five sentinels

**Symptom.** Redirects, 404s and auth interrupts all degrade to a generic error message, and
each is debugged separately.

**Cause.** `notFound()`, `redirect()`, `permanentRedirect()`, `unauthorized()` and
`forbidden()` are all implemented as throws. One broad catch intercepts every one.

**Fix.** `unstable_rethrow` in any catch that sits on a render path — or narrow the catch to
the error you actually expect.

### Auditing for the presence of a check rather than its reachability

**Symptom.** A review passes, and the endpoint is still open.

**Cause.** The check exists and reads correctly; its throw is suppressed or unawaited.

**Fix.** Review the call *path*, not the call. Concentrating authorization in the DAL makes
that path short enough to actually verify.

## Interview questions

**★ Why does a `try/catch` break `unauthorized()` and `forbidden()`?**
They work by throwing a framework sentinel. A catch intercepts it like any other exception, so
the interrupt is suppressed and no 401/403 UI renders.

**★ What is the fix?**
`unstable_rethrow(e)` at the top of the catch, so framework interrupts pass through while real
errors are still handled.

**★ Which other framework functions share this hazard?**
`notFound()`, `redirect()` and `permanentRedirect()` — all implemented as throws.

**★ What happens if the call sits in an un-awaited promise?**
It throws where nothing catches it, no UI renders, and rendering continues — so the protected
page is served. Development logs `⨯ unhandledRejection: NEXT_HTTP_ERROR_FALLBACK;401`.

**★ Why is that specifically a security problem rather than a bug?**
Because the failure is silent and fails *open*. There is no error page to notice; the protected
content simply renders.

**★ Should you write `return unauthorized()`?**
No. Its return type is `never`; it throws and execution stops.

**★ Can either be called in the root layout?**
No, for both.

**★ Where should the authorization check actually live?**
In the Data Access Layer, so there is one place to audit and every entry point — page, Server
Action, Route Handler — passes through it.

**★ A reviewer sees a session check on the page and approves it. What might they have missed?**
Whether the interrupt's throw can actually reach the framework — a surrounding `try/catch`, or
a promise that is never awaited.

---

**Previous:** [11 · Auth interrupts: 401 and 403](11-auth-interrupts-forbidden-and-unauthorized.md)
