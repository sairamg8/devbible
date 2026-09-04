---
title: "The client sends Server Actions one at a time, so a queued action and a failed action look identical to a user and identical to most telemetry"
sidebar_label: "03b · Sequential dispatch"
sidebar_position: 10
description: "Why Promise.all cannot parallelise actions from the client, what a slow action does to every click behind it, and why disabling a pending control is a correctness measure rather than polish."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Server Actions and Mutations guide](https://nextjs.org/docs/app/guides/server-actions)
> — page metadata `version: 16.3.4`, `lastUpdated: 2026-06-17`; its "Sequential dispatch on the
> client" section, including the "Good to know" note, is quoted verbatim below.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**This is a scheduling rule with error-handling consequences, which is why it sits in this
chapter rather than in the data chapter.** Nothing about it is visible in a single action's code:
the function is an ordinary async function, it runs in its own request, and server-side it can do
whatever it likes. The constraint is in the client dispatcher, and it turns a fast action behind
a slow one into something that is indistinguishable, from the outside, from an action that broke.


## Sequential dispatch, and why it changes your error UI

> *"Next.js dispatches Server Actions one at a time per client. If a user triggers three actions
> in quick succession, the second waits for the first to finish, then the third waits for the
> second. This keeps the re-rendered server tree consistent with the action result that produced
> it."*

The consequence the guide draws out:

> *"do not rely on `Promise.all` to parallelize Server Actions from the client. If you need
> parallel work, do it inside a single Server Action, fetch in parallel from a Server Component,
> or use a Route Handler for non-mutation requests."*

> **Good to know** *(quoted)*: *"This is a property of the client dispatcher, not of Server
> Functions in general. Server-side, an action runs in its own request and can do anything an
> async function can do."*

For error design this means three things:

1. **A queued action has not failed, it has not started.** A UI that shows "no response" after
   two seconds may be showing a queue, not a fault. Distinguish *pending* from *failed*.
2. **A slow action blocks every later one.** One thirty-second export queues every subsequent
   click behind it. Long work belongs in a Route Handler or a background job, not in an action
   the UI dispatches.
3. **Retry storms serialise.** A user clicking a failed button five times does not send five
   parallel requests; it sends five sequential ones, so the perceived failure gets five times
   longer. Disabling the control while pending is a correctness measure here, not just polish.

```ts
// ❌ These do not run in parallel — the client dispatcher serialises them
await Promise.all([archiveTask(a), archiveTask(b), archiveTask(c)])

// ✅ One action, parallel work inside it, one round trip, one error to report
'use server'
export async function archiveTasks(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => db.task.archive(id)))
  const failed = results.filter((r) => r.status === 'rejected').length
  return failed === 0
    ? { ok: true as const, data: { archived: ids.length } }
    : { ok: false as const, error: `${failed} of ${ids.length} could not be archived` }
}
```

## Gotchas

### `Promise.all` over several actions to speed a bulk operation up
**Symptom.** Selecting fifty rows and clicking "archive" takes fifty sequential round trips and
the UI appears frozen.
**Cause.** The client dispatcher runs actions one at a time per client; `Promise.all` changes
nothing about that.
**Fix.** One action that takes the whole set and parallelises server-side, as in the
`archiveTasks` example above. One request, one result to render, one error path.

### A long-running action that blocks every later click
**Symptom.** After starting a report export, nothing else in the app responds until it finishes,
and each queued click eventually fires all at once.
**Cause.** Sequential dispatch. The export is holding the queue.
**Fix.** Move long work out of the action-dispatch path — a Route Handler that returns a job id,
polled or streamed — and keep actions short enough that queueing is invisible.

### Reporting a queued action as a timeout
**Symptom.** Error telemetry is full of client-side "action timed out" events that correspond to
no server error at all.
**Cause.** A client timeout measured from click, applied to an action that spent most of that
time waiting behind another one.
**Fix.** Disable the control while `pending` so a second dispatch cannot queue, and measure
timeouts on the server where the action actually ran.

### A "retry" button that makes the wait longer each time
**Symptom.** A user whose action failed clicks retry four times; the fourth attempt takes four
times as long to report anything as the first.
**Cause.** The retries do not race — they queue. Each one waits for the previous to complete
before it is even sent.
**Fix.** Disable the control for the duration and let the pending flag own it, so a second
dispatch cannot be queued at all.

```tsx
'use client'

import { useActionState } from 'react'
import { retryImport } from './actions'

export function RetryButton() {
  const [state, formAction, pending] = useActionState(retryImport, null)

  return (
    <form action={formAction}>
      <button disabled={pending}>{pending ? 'Retrying…' : 'Retry'}</button>
      {state?.ok === false && <p aria-live="polite">{state.error}</p>}
    </form>
  )
}
```
## Interview questions

**★ Why does `Promise.all` not parallelise Server Actions from the client?**
Because Next.js dispatches them one at a time per client, so the re-rendered server tree stays
consistent with the action result that produced it. `Promise.all` starts three promises, but the
dispatcher still sends them sequentially. Parallel work belongs inside one action, in a Server
Component, or in a Route Handler.

**★ Is sequential dispatch a property of Server Functions?**
No — it is a property of the client dispatcher. Server-side, an action runs in its own request
and can do anything an async function can do, including running work in parallel.

**★ How does sequential dispatch change how you show errors?**
It makes *pending* and *failed* genuinely different states that look the same to a user. An
action queued behind a slow one has not failed and will still run; a client-side timeout measured
from the click will report it as a failure. It also means a user retrying a failing button
serialises their retries, so each one takes longer than the last to surface — which is why
disabling the control while pending is a correctness measure rather than polish.

**★ Why does the framework serialise actions at all?**
To keep the re-rendered server tree consistent with the action result that produced it. Each
action's response can carry a freshly rendered payload for the current route; if two actions
were in flight at once, two payloads rendered from two different intermediate states could
commit in either order, and the UI would reflect neither reliably.

**★ Where should long-running work go instead?**
Out of the action-dispatch path entirely. A Route Handler that starts the work and returns a job
identifier — polled, or streamed with the Web Streams API — leaves the action queue free. The
guide points at Route Handlers explicitly for non-mutation requests, and the same reasoning
applies to a mutation whose duration would block the queue.

**★ Does this rule apply per user, per tab, or per application?**
Per client. It is the client-side dispatcher that serialises, so two browser tabs are two
dispatchers and two independent queues, and two different users never interact at all. That also
means the constraint disappears in a server-to-server context: an action invoked from another
Server Function is just an async call.
---

← [03 · Server Action error contracts](03-server-action-error-contracts-returning-typed-errors-vs.md) · **Next → [03c · An action is a public POST endpoint](03c-an-action-is-a-public-post-endpoint.md)**
