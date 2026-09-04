---
title: "`retry` did not replace `reset` — they are two props that recover from an error in two different ways"
sidebar_label: "09 · `error.js` props: `retry` and `reset`"
sidebar_position: 9
description: "retry() re-fetches and re-renders, reset() only re-renders; the version history that dates both; and what error.message and error.digest actually carry in production."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`error.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
> — page metadata `version: 16.3.4`, `lastUpdated: 2026-07-10`; its `retry`, `reset`,
> `error.message` and `error.digest` prop sections and its Version History table are quoted
> verbatim below. Target: **Next.js 16.3.4**, App Router. Documentation-validated;
> **no sandbox run**.

**The single most misread part of the 16.3 error API is that `retry` replaced `reset`. It did
not. `retry` was added — `unstable_retry` in v16.2.0, stable in v16.3.0 — alongside a `reset`
that dates to v13.0.0 and is still a documented prop of the same component.** The two do
different amounts of work, and the difference is a network round-trip: `retry()` re-fetches
*and* re-renders, `reset()` only re-renders. Getting this backwards produces one of two bugs —
a recovery button that never actually re-fetches the data that failed, or one that re-fetches
on every click when the data was never the problem.

## The two recovery functions

| Prop | What it does | Since |
|---|---|---|
| **`retry()`** | **Re-fetches *and* re-renders** the boundary's children, re-running the Server Components inside them | `unstable_retry` v16.2.0, stable **v16.3.0** |
| `reset()` | Clears the error state and re-renders the children **without** re-fetching | v13.0.0 |

On `retry`, the reference is precise about the mechanism and about what happens on success:

> *"An error component can use the `retry()` function to prompt the user to attempt to recover
> from the error. When executed, the function will try to re-fetch and re-render the error
> boundary's children. If successful, the fallback error component is replaced with the result
> of the re-render."*

And it states the default choice and its one exception in a single sentence:

> *"In most cases, you should use `retry()` instead. However, if you have a specific reason to
> clear the error state and re-render the error boundary's children without re-fetching the
> contents, you can use the `reset()` function."*

So `reset` is the narrower tool, not the obsolete one. Reach for it when the failure was **not**
in the data — a client render that threw on state you have since corrected, where a re-fetch
would be wasted work and a visible delay. Everywhere else, `retry()`:

```tsx filename="app/dashboard/error.tsx"
'use client' // Error boundaries must be Client Components

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}
```

## The version history, which is what dates a claim about this API

| Version | Change |
|---|---|
| `v16.3.0` | `retry` prop became stable |
| `v16.2.0` | `unstable_retry` prop added |
| `v15.2.0` | Also display `global-error` in development |
| `v13.1.0` | `global-error` introduced |
| `v13.0.0` | `error` introduced |

Two things fall out of that table. `retry` is **three minor versions old at most** — any
material written before 16.2 predates it entirely, which is why so much of what a search
surfaces destructures only `reset`. And `reset` has been there since the convention was
introduced, which is why it was never removed: doing so would have broken every error boundary
written in the preceding three years.

## What actually reaches the client: `message` and `digest`

The `error` prop is an `Error` instance, but **what it contains differs between development and
production**, and that difference is deliberate:

> *"During development, the `Error` object forwarded to the client will be serialized and
> include the `message` of the original error for easier debugging. However, **this behavior is
> different in production** to avoid leaking potentially sensitive details included in the error
> to the client."*

In production the split is by where the error was thrown. Errors forwarded from **Client
Components** show the original `Error` message; errors forwarded from **Server Components** show
a generic message with an identifier instead, to prevent leaking details. That identifier is
`error.digest`:

> *"An automatically generated hash of the error thrown. It can be used to match the
> corresponding error in server-side logs."*

Which makes `digest` the only thing worth putting in front of a user on a server-side failure —
it is the string a support engineer greps the logs for:

```tsx filename="app/dashboard/error.tsx"
'use client'

import { useEffect } from 'react'

export default function Error({
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
    <div role="alert">
      <h2>Something went wrong!</h2>
      {error.digest ? <p>Reference: {error.digest}</p> : null}
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}
```

Note `digest` is typed optional — `digest?: string` — because a client-thrown error has no
server log entry to match against and carries none. Rendering it unconditionally puts the word
"Reference:" followed by nothing on the page.

## Gotchas

### Assuming `reset` was renamed to `retry`

**Symptom.** A codebase audit "modernises" every boundary by swapping `reset` for `retry`, and a
boundary that deliberately avoided a network round-trip now re-fetches on every click.

**Cause.** `retry` was **added**, not renamed. Both props are passed to the same component.
`reset()` re-renders without re-fetching; `retry()` re-fetches and re-renders.

**Fix.** Default to `retry()` — the documented recommendation — and keep `reset()` only where
re-fetching is genuinely the wrong behaviour:

```tsx
// The common case: the data failed, so go and get it again.
<button onClick={() => retry()}>Try again</button>

// The narrow case: the data is fine, a client render threw on state you have since fixed.
<button onClick={() => reset()}>Dismiss</button>
```

### Using `reset()` for a failure that was in the data

**Symptom.** The user clicks "Try again", the fallback disappears and immediately comes back —
every time, forever.

**Cause.** `reset()` re-renders the children **without re-fetching**. If the children failed
because a fetch failed, re-rendering them replays the same failed result.

**Fix.** `retry()`. It re-fetches first, which is the only thing that can change the outcome.

### Expecting `retry` to be there on 16.1 or earlier

**Symptom.** The "Try again" button does nothing — and only in the older of two deployed
environments.

**Cause.** `retry` is stable from **v16.3.0** and existed as `unstable_retry` from **v16.2.0**.
Before that the prop is simply not passed, so `onClick={() => retry()}` fails at click time
rather than at build time.

**Fix.** Pin the framework version the boundary assumes; if one component must serve both, fall
back explicitly with `onClick={() => (retry ?? reset)()}`.

### Copying a boundary from pre-16.2 material

**Symptom.** The recovery button works, but never re-fetches — a server-side failure is
permanent until the user reloads.

**Cause.** The example predates `retry` entirely and destructures only `reset`, which cannot
re-run the server work that failed.

**Fix.** Check the version the material targets before copying it. Anything written for 16.1 or
earlier cannot mention `retry`, because it did not exist.

### Showing `error.message` to the user and getting nothing useful

**Symptom.** In development the error page is informative; in production it shows a generic
string for every server-side failure, and support cannot reproduce anything.

**Cause.** Errors forwarded from Server Components are stripped in production deliberately, to
avoid leaking sensitive details. The message is generic **by design** — this is not a
misconfiguration.

**Fix.** Render `error.digest` and log the full error server-side. The digest is what matches
the two together.

### Rendering `error.digest` unconditionally

**Symptom.** The error page shows a "Reference:" label with nothing after it.

**Cause.** `digest` is optional — a client-thrown error has no corresponding server log entry
and carries no hash.

**Fix.** Guard it: `{error.digest ? <p>Reference: {error.digest}</p> : null}`.

### Debugging a production error report with no digest in it

**Symptom.** A user reports a generic error message; nothing in the logs can be tied to it.

**Cause.** The boundary rendered the message but not the digest, discarding the only identifier
that links the client occurrence to a server log line.

**Fix.** Always surface the digest on the error UI, and log the full `error` object from a
`useEffect` in the boundary so the client side is recorded too.

## Interview questions

**★ An `error.js` component receives `error` and — what else?**
Both `retry` and `reset`. `retry()` re-fetches *and* re-renders the boundary's children;
`reset()` clears the error state and re-renders them **without** re-fetching. The docs say to
use `retry()` in most cases, but `reset()` is neither removed nor deprecated — it is the tool
for the case where the data was never the problem.

**★ Then when would you ever choose `reset()`?**
When re-fetching would be wasted work: the data is fine and a client-side render threw on state
you have since corrected. The documentation's own framing is *"a specific reason to clear the
error state and re-render … without re-fetching the contents"* — the burden of proof is on
choosing `reset`.

**★ When did `retry` become stable, and what shipped before it?**
Stable in **v16.3.0**, after landing as `unstable_retry` in **v16.2.0**. For the surrounding
history: `error` arrived in v13.0.0, `global-error` in v13.1.0, and v15.2.0 started displaying
`global-error` in development as well as production.

**★ Why is so much published material wrong about this?**
Because `retry` is at most three minor versions old and `reset` is three years old. Anything
written before 16.2 correctly showed only `reset`; it became misleading when `retry` shipped,
not when it was written.

**★ A user clicks "Try again" and the same error returns instantly, every time. What is the
most likely cause?**
The boundary calls `reset()` on a failure that was in the data. `reset()` re-renders without
re-fetching, so it replays the same failed result. `retry()` is the fix.

**★ Why does `error.message` say something useful in development and nothing useful in
production?**
Deliberate. In development the original message is serialized to the client for debugging; in
production that is suppressed to avoid leaking sensitive details. Client Component errors keep
their original message either way; Server Component errors are replaced with a generic message
plus an identifier.

**★ What is `error.digest` for, and why is it optional?**
It is an automatically generated hash of the thrown error, used to match the client-side
occurrence against the corresponding server-side log entry. It is optional because an error
thrown on the client has no server log entry to match and carries no hash.

**★ What is the minimum a production error boundary should render and do?**
Render the digest when present, so support can find the log line; log the full error from a
`useEffect` so the client-side occurrence is recorded; and offer `retry()` rather than
`reset()`, so the button can actually change the outcome.

---

← [08 · Boundary scope and `global-error`](08-errorjs-boundary-scope-and-global-error.md) · Next → [10 · Custom error boundaries with `catchError`](10-custom-error-boundaries-with-catcherror.md)
