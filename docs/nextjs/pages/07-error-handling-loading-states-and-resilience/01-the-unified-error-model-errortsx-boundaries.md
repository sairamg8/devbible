---
title: "Every failure in an App Router app is either an expected error or an uncaught exception, and the whole error model is a consequence of that one split"
sidebar_label: "01 · The unified error model"
sidebar_position: 1
description: "The two categories the documentation defines, why an expected error must never be thrown, why an uncaught exception must never be returned, and the decision procedure that picks a mechanism for a failure."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-06-10`) and the
> [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`). Target: **Next.js 16.3.4**, App Router.
> Documentation-validated; **no sandbox run**.

**The App Router does not have one error mechanism, it has two, and picking the wrong one is
the single most common structural mistake in this chapter.** The documentation opens by
splitting failures into *expected errors* and *uncaught exceptions*, and every file convention,
every prop and every piece of advice downstream follows from which side of that line a failure
sits on. An expected error is data — a validation message, a 404, a declined payment — and it
travels as a **return value**. An uncaught exception is a bug, and it travels as a **throw**,
caught by the nearest boundary. Code that throws a validation failure gets a full-page error
screen for a typo in an email field; code that returns a database outage as `{ ok: false }`
buries a production incident behind a polite inline message nobody pages on. This page is the
decision procedure; the rest of the chapter is the mechanics.

## The split, in the documentation's own words

> *"Errors can be divided into two categories: expected errors and uncaught exceptions."*

**Expected errors:**

> *"Expected errors are those that can occur during the normal operation of the application,
> such as those from server-side form validation or failed requests. These errors should be
> handled explicitly and returned to the client."*

**Uncaught exceptions:**

> *"Uncaught exceptions are unexpected errors that indicate bugs or issues that should not occur
> during the normal flow of your application. These should be handled by throwing errors, which
> will then be caught by error boundaries."*

Read those two definitions as a **test on the failure, not on the code**. The question is never
"is this in a Server Action or a Server Component" — it is *"if this happens ten thousand times
today, is the system healthy?"* An empty title field ten thousand times a day is a healthy
system with users being users. A `ECONNREFUSED` to Postgres ten thousand times a day is an
outage. The first is a return value. The second is a throw.

## The decision procedure

| The failure | Healthy at scale? | Mechanism | Where it surfaces |
|---|---|---|---|
| Form field is empty or malformed | yes | **return value** from the Server Function | the form, via `useActionState` |
| Credentials are wrong | yes | **return value** | the form |
| The requested row does not exist | yes | `notFound()` | `not-found.js` |
| The user is signed out | yes | `unauthorized()` | `unauthorized.js` |
| The user is signed in but not allowed | yes | `forbidden()` | `forbidden.js` |
| A third-party API returned 503 | borderline | **return value**, and log it | inline, with a retry affordance |
| The database connection failed | **no** | **throw** | nearest `error.js` |
| A null dereference in a render path | **no** | **throw** (it throws itself) | nearest `error.js` |
| The root layout itself threw | **no** | **throw** | `global-error.js` |

🔴 **The "borderline" row is where judgement actually lives.** A dependency being down is
expected in the statistical sense and unacceptable in the product sense. The rule that has held
up: **if the user can do something about it, return it; if only you can do something about it,
throw it.** A 503 from a payments provider is a throw if the checkout cannot proceed and a
return value if the page can render with a "pricing unavailable" placeholder. Both are correct
designs; what is never correct is deciding by accident.

## Uncaught exceptions are throws, and they bubble

> *"Errors will bubble up to the nearest parent error boundary."*

An `error.js` file in a segment becomes a boundary for that segment's subtree; a throw anywhere
below it renders that file instead of the crashed subtree. That is the entire mechanism, and
its consequences — which segment's boundary catches what, and what `error.js` pointedly does
**not** wrap — are detailed in
[10c · Where boundaries sit in the hierarchy](10c-where-boundaries-sit-in-the-hierarchy.md) and
[10d · `global-error` and what it does not inherit](10d-global-error-and-what-it-does-not-inherit.md).

```tsx
// app/dashboard/error.tsx
'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button
        onClick={
          // Attempt to recover by re-fetching and re-rendering the segment
          () => retry()
        }
      >
        Try again
      </button>
    </div>
  )
}
```

`'use client'` is not stylistic — a boundary renders a button with an `onClick`, so it must be a
Client Component, and the framework says so in the comment on its own example. The props
`error` and `retry` (and the still-live `reset`, which does something different) are the
subject of [09 · `error.js` props](09-errorjs-props-retry-and-reset.md); what the boundary
cannot see at all is the subject of
[10b · What boundaries do not catch](10b-what-boundaries-do-not-catch.md).

## Gotchas

### Deciding the category per call site instead of per failure
**Symptom.** The same failure — say, "email already registered" — is a returned message on the
signup form and a thrown error in the admin import script, and the two disagree about whether
it is worth paging someone.
**Cause.** The category was decided by whichever file the code was written in.
**Fix.** Classify at the source, once, and let every caller inherit the decision. A typed error
class for expected failures and a plain `throw` for everything else is enough structure.

```ts
// lib/errors.ts
export class ExpectedError extends Error {
  constructor(
    message: string,
    readonly field?: string
  ) {
    super(message)
    this.name = 'ExpectedError'
  }
}

// lib/users.ts
export async function registerUser(email: string) {
  if (await db.user.findUnique({ where: { email } })) {
    throw new ExpectedError('That email is already registered', 'email')
  }
  return db.user.create({ data: { email } })
}
```

```ts
// app/signup/actions.ts — the one place that translates a class into a contract
'use server'

import { ExpectedError } from '@/lib/errors'
import { registerUser } from '@/lib/users'

export async function signUp(prevState: unknown, formData: FormData) {
  try {
    await registerUser(String(formData.get('email')))
    return { ok: true as const }
  } catch (cause) {
    if (cause instanceof ExpectedError) {
      return { ok: false as const, error: cause.message, field: cause.field }
    }
    throw cause
  }
}
```

### Assuming `error.tsx` is a general `try`/`catch` for the segment
**Symptom.** A failing `onClick` handler produces an unhandled rejection in the console and no
error UI at all.
**Cause.** Boundaries catch errors *during rendering*; handlers run after it.
**Fix.** Catch and store it yourself — the mechanism, the `startTransition` exception, and the
full list of what escapes a boundary are in
[10b · What boundaries do not catch](10b-what-boundaries-do-not-catch.md).

## Interview questions

**★ What are the two categories of error in the App Router, and what is the test for which one
you have?**
Expected errors and uncaught exceptions. Expected errors *"can occur during the normal
operation of the application"* — validation failures, failed requests — and the documentation
says they *"should be handled explicitly and returned to the client."* Uncaught exceptions
*"indicate bugs or issues that should not occur during the normal flow"* and should be thrown so
an error boundary catches them. The practical test is whether the system is healthy when the
failure happens at volume: user error at volume is healthy, a database refusing connections at
volume is not.

**★ What happens to an error thrown deep in a component tree with several `error.tsx` files
above it?**
It bubbles to the *nearest* parent boundary, which renders in place of the subtree it wraps.
Everything above that boundary — the layout, navigation, sibling segments — stays mounted and
interactive. That is why boundary placement is a design decision rather than a formality: put
one at the root and a failing widget blanks the app, put one around the widget and the rest of
the page survives.

**★ Why must `error.tsx` be a Client Component?**
It renders recovery UI — a button wired to `retry()` — and that needs an event handler, which
only a Client Component can have. The framework's own example carries the comment *"Error
boundaries must be Client Components"* on the `'use client'` line.

**★ Where does the "borderline" case — an upstream dependency being down — belong?**
Wherever the product answer puts it, and it should be decided deliberately. If the user can act
(retry, come back later, proceed without that data), return it and render an affordance. If the
page has no meaningful output without it, throw and let the boundary handle it. What is never
right is letting the choice fall out of whichever file the call happened to sit in.

---
---

← [Chapter index](01-explanation.md) · **Next → [01b · Expected errors are return values](01b-expected-errors-are-return-values.md)**
