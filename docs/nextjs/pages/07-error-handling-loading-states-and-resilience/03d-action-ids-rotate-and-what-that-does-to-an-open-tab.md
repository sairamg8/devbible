---
title: "Action IDs are build artifacts that rotate at least every fortnight, so an open tab can hold a reference to an action the server no longer has"
sidebar_label: "03d · Action IDs rotate"
sidebar_position: 112
description: "Why \"Failed to find Server Action\" appears after a deploy through no fault of the code, the encryption key that makes it intermittent instead of universal, and why the documented fix is a UI decision rather than an ops one."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js
> [Server Actions and Mutations guide](https://nextjs.org/docs/app/guides/server-actions)
> — page metadata `version: 16.3.4`, `lastUpdated: 2026-06-17`; its "Deployment considerations"
> section and the `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` guidance are quoted verbatim below.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**This is the only failure in the chapter that is caused by deploying, and it lands on users who
did nothing but leave a tab open.** It is worth knowing before it happens, because every instinct
it triggers is wrong: the code did not change, the action exists in the source, the endpoint
works for everyone who loaded the page after the deploy, and the error message names a Server
Action that is plainly right there in the repository. Nothing is broken. The client is holding a
reference minted by a build that is no longer running.


## The deployment failure that looks like a bug in your code

> *"Each Server Action is identified by the action ID that is part of its build artifacts. New
> deployments typically generate new IDs (Next.js rotates them at most every 14 days, even when
> the source is unchanged), so a client still running the previous build may invoke an action ID
> that no longer exists."*

The error surfaces as **"Failed to find Server Action"**. The mitigations are named:

- *"Prefer rolling deployments over abrupt cutovers when active users are likely to be
  mid-mutation."*
- *"Keep `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable across instances so action references remain
  decryptable everywhere."*
- 🔴 *"Surface the error as a retry path in the UI rather than a hard failure, so a refresh
  recovers the user."*

That last one is an error-handling instruction, not an ops one: the correct recovery is for the
user to reload and get the new build, so the boundary that catches this should offer exactly
that.

## Gotchas

### `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` left unset on a multi-instance deployment
**Symptom.** Actions fail intermittently, and the failures correlate with which instance served
the request.
**Cause.** Each instance generated its own key, so an action reference encrypted by one cannot be
decrypted by another.
**Fix.** Set the variable to one stable value shared by every instance, as the guide instructs
for multi-instance and self-hosted deployments.

### "Failed to find Server Action" after a deploy
**Symptom.** Users with the page already open get an error on their next submit; a hard refresh
fixes it.
**Cause.** The deployment rotated action IDs and their tab is running the previous build.
**Fix.** Catch it as a recoverable case and tell the user what actually works, rather than
rendering a generic failure.

```tsx
// app/error.tsx
'use client'

export default function AppError({ error, retry }: { error: Error; retry: () => void }) {
  const isStaleBuild = /Failed to find Server Action/i.test(error.message)

  return (
    <div role="alert">
      <h2>{isStaleBuild ? 'This page is out of date' : 'Something went wrong'}</h2>
      {isStaleBuild ? (
        <button onClick={() => window.location.reload()}>Reload to continue</button>
      ) : (
        <button onClick={() => retry()}>Try again</button>
      )}
    </div>
  )
}
```

### Treating it as an error to suppress
**Symptom.** The message is filtered out of error reporting because it is "just a deploy thing",
and nobody notices when it starts firing outside deploy windows.
**Cause.** It was classified as noise rather than as a signal about deployment shape.
**Fix.** Keep reporting it, and treat a sustained rate as evidence of something real — an abrupt
cutover where a rolling deploy was expected, or an unstable encryption key across instances. The
rate, not the presence, is the signal.

### An automatic reload that discards the user's work
**Symptom.** The "out of date" recovery reloads the page immediately, and a half-written form is
gone.
**Cause.** The recovery treated a recoverable error as a reason to reset the application.
**Fix.** Offer the reload, do not perform it. The user's unsent input is the one thing a reload
destroys and the one thing they cannot get back.

```tsx
'use client'

export function StaleBuildNotice() {
  return (
    <div role="alert">
      <p>This page was updated. Reload to continue — your unsent changes will be lost.</p>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  )
}
```
## Interview questions

**★ What is "Failed to find Server Action" and whose fault is it?**
Nobody's. Action IDs are build artifacts, and Next.js rotates them at most every 14 days even
when the source has not changed, so a browser tab running the previous build can invoke an ID
that no longer exists. It is a deployment characteristic to design for: rolling deploys, a stable
encryption key, and a UI that offers a reload rather than a dead end.

**★ Why must `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` be stable across instances?**
Because action references and closure variables are encrypted with it. If each instance generates
its own, a reference produced by one instance cannot be decrypted by another, and failures track
which instance happened to serve the request — intermittent, load-balancer-shaped, and very hard
to reproduce locally.

**★ Why do action IDs change when the source did not?**
Because they are part of the build artifacts, and Next.js rotates them at most every 14 days
regardless of whether the source changed. Rotation limits how long a given public endpoint
identifier stays valid; the consequence is that "we did not touch that code" is not a reason to
expect the ID to be stable.

**★ Why is a rolling deployment the recommended mitigation rather than a fix?**
Because there is no fix — the old build's IDs are gone. A rolling deployment keeps the previous
version serving while clients still hold its references, which shrinks the window during which an
open tab can submit into a version that no longer exists. The guide recommends it specifically
*"when active users are likely to be mid-mutation."*

**★ Why is "surface it as a retry path" an error-handling instruction rather than an operations
one?**
Because the recovery is entirely in the UI. Nothing on the server can resolve a reference to a
build that is gone; the only action that works is for the browser to fetch the current build.
That makes the boundary's copy and its button the whole remedy — a generic "something went wrong"
leaves the user stuck in a state a single reload would clear.
---

← [03c · An action is a public POST endpoint](03c-an-action-is-a-public-post-endpoint.md) · **Next → [04 · Route Handler error responses](04-route-handler-error-responses-and-consistent-api-error-envel.md)**
