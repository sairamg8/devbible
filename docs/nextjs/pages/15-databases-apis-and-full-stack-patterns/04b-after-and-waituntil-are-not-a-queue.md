---
title: "after() decouples work from the response, not from the invocation — it has no durable record, no retry, no scheduling and no way to answer 'did it run', which makes it excellent for logging and catastrophic for anything a customer paid for"
sidebar_label: "04b · after() is not a queue"
sidebar_position: 43
description: "What after() guarantees, the waitUntil primitive underneath it, the Request-API rules that differ between Route Handlers and Server Components, graceful shutdown drain, and the four properties it does not have."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js
> [`after`](https://nextjs.org/docs/app/api-reference/functions/after) reference,
> [Self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting) §`after`,
> [`maxDuration`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration),
> and the Vercel
> [`@vercel/functions` reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)
> (`waitUntil`, `getDeadline`, `attachDatabasePool`).
> Documentation-verified, **no sandbox run**.
> Target: **Next.js 16.3.4** · Node 24.20.0.

**`after()` is the most useful and most misused API in this topic. It is genuinely good: it lets you flush analytics, write an audit row, or warm a cache without adding a single millisecond to the user's time-to-byte, and it works in Server Components, Server Functions, Route Handlers and Proxy. But it buys exactly one property — the work no longer blocks the response — and people reach for it expecting four more that it does not have. This page is what the documentation actually promises, the `waitUntil` primitive it is built on, the request-API rules that differ by call site, and the precise boundary past which you must stop and write a job row instead.**

## What `after()` is

> *"`after` allows you to schedule work to be executed after a response (or prerender) is finished. This is useful for tasks and other side effects that should not block the response, such as logging and analytics."*
> — [Next.js · `after`](https://nextjs.org/docs/app/api-reference/functions/after)

Note the examples the documentation itself chose: **logging and analytics**. That is not an accident of drafting. Those are the two workloads where losing an occasional item costs you nothing you cannot reconstruct.

It is available in more places than people expect:

> *"It can be used in Server Components (including `generateMetadata`), Server Functions, Route Handlers, and Proxy."*

```ts
// app/api/posts/[id]/route.ts
import { after } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const post = await getPost(id)

  after(async () => {
    // Runs after the response is flushed. The reader never waits for it.
    await recordPageView({ postId: id, at: Date.now() })
  })

  return Response.json(post)
}
```

`after` became stable in **v15.1.0**; it existed as `unstable_after` from **v15.0.0-rc**. If you are reading a codebase with `unstable_after`, that is the only change needed.

## The primitive underneath: `waitUntil`

The mechanism is worth knowing because it explains every limitation on this page.

> *"Using `after` in a serverless context requires waiting for asynchronous tasks to finish after the response has been sent. In Next.js and Vercel, this is achieved using a primitive called `waitUntil(promise)`, which extends the lifetime of a serverless invocation until all promises passed to `waitUntil` have settled."*
> — [Next.js · `after`](https://nextjs.org/docs/app/api-reference/functions/after)

And the discovery mechanism, quoted verbatim because it is how you reason about a platform that does not support it:

> *"When `after` is called, Next.js will access `waitUntil` like this: `const RequestContext = globalThis[Symbol.for('@next/request-context')]`"*

So `after()` is a thin, portable wrapper over a platform primitive. On Vercel, that primitive is `waitUntil` from `@vercel/functions`, and Vercel's own guidance is to stop calling it directly:

> *"If you're using **Next.js 15.1 or above**, we recommend using the built-in `after()` function from `next/server` **instead** of `waitUntil()`."*
> — [Vercel · `@vercel/functions`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)

🔴 And the sentence that decides whether `after()` is appropriate for your workload:

> *"Promises passed to `waitUntil()` will have the same timeout as the function itself. If the function times out, the promises will be cancelled."*

The Next.js reference says the same thing in its own words:

> *"`after` will run for the platform's default or configured max duration of your route. If your platform supports it, you can configure the timeout limit using the `maxDuration` route segment config."*

**`after()` extends the invocation's life past the response. It does not extend it past the deadline.** Your callback shares one budget with the request that scheduled it.

## The four properties it does not have

| Property | `after()` | Why |
|---|---|---|
| **Durability** | ❌ | The work is a closure on the heap. Process gone, work gone, no trace. |
| **Retry** | ❌ | Nothing records that it failed, so nothing can decide to try again. |
| **Scheduling** | ❌ | It runs now-ish. There is no "in four hours", no rate limit, no priority. |
| **Observability** | ❌ | No id, no row, no status. "Did the receipt send?" is unanswerable after the fact. |

Every one of those is downstream of the same fact: **there is no artifact**. A queue's first act is to write a row; `after()`'s first act is to push a promise onto a list.

## What it *does* guarantee, including on failure

Two guarantees are stronger than people assume and worth using deliberately.

> *"`after` will be executed even if the response didn't complete successfully. Including when an error is thrown or when `notFound` or `redirect` is called."*

That makes it a legitimate place for "record what happened to this request" telemetry, because the unhappy paths are exactly the ones you want recorded and they are covered.

> *"`after` is not a Request-time API and calling it does not cause a route to become dynamic. If it's used within a static page, the callback will execute at build time, or whenever a page is revalidated."*

🔴 Read that twice. On a static page, `after()` runs **at build time**. A view counter written that way increments once per build, not once per view, and the bug is invisible in `next dev`.

Composition rules, both verbatim:

> *"You can use React `cache` to deduplicate functions called inside `after`."*
> *"`after` can be nested inside other `after` calls"*

## Request APIs inside the callback — the rule differs by call site

This is the sharpest edge on the API, and the documentation is explicit about both halves.

Allowed:

> *"You can call `cookies` and `headers` directly inside the `after` callback when used in Route Handlers and Server Functions."*

Not allowed:

> *"Server Components (including pages, layouts, and `generateMetadata`) **cannot** use `cookies`, `headers`, or other Request-time APIs inside `after`. This is because Next.js needs to know which part of the component tree accesses request data to support Partial Prerendering and Cache Components, but `after` runs after React's rendering lifecycle."*
> *"Calling `cookies()` or `headers()` inside the `after` callback in a Server Component will throw a runtime error."*

The fix is mechanical — read the value *outside* the callback and close over it:

```tsx
// app/dashboard/page.tsx — Server Component
import { after } from 'next/server'
import { cookies } from 'next/headers'

export default async function Page() {
  // ✅ Read request data during render...
  const session = (await cookies()).get('session')?.value ?? null

  after(async () => {
    // ...and close over the plain value here.
    // ❌ `await cookies()` inside this callback throws at runtime.
    await logDashboardVisit({ session })
  })

  return <Dashboard />
}
```

## Platform support, and what "self-hosted" changes

The reference's support table: **Node.js server — yes · Docker — yes · Static export — no ·** adapters, platform-specific.

Static export has no server, so there is nothing to extend; that entry is a statement about the deployment target, not a bug.

On a long-lived Node server there is no invocation to extend, so the constraint becomes process shutdown instead:

> *"When stopping the server, ensure a graceful shutdown by sending `SIGINT` or `SIGTERM` signals and waiting. The Next.js server will finish in-flight requests and execute any pending `after()` callbacks before exiting. Platforms should allow a configurable drain period (10-30 seconds is recommended) to ensure all background work completes."*
> — [Next.js · Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)

🔴 In Kubernetes and most container schedulers the default grace period is not tuned for this. If your `terminationGracePeriodSeconds` is shorter than your drain, every rolling deploy silently drops in-flight `after()` callbacks — a slow leak of exactly the telemetry you deploy to fix things with.

## `getDeadline` — the escape hatch when you *must* do work inline

If you are doing bounded background work and want to stop before the platform stops you:

> *"Returns the shared invocation deadline for the current function invocation as a `Date` object. The deadline is the time when Vercel will terminate the invocation if it has not completed, based on the function's configured `maxDuration`. This includes request processing and asynchronous `waitUntil` tasks."*
> *"Returns `undefined` when the deadline is not available"*

```ts
import { after } from 'next/server'
import { getDeadline } from '@vercel/functions'

const SAFETY_MARGIN_MS = 5_000

export async function POST(request: Request) {
  const ids = await request.json() as string[]
  const response = Response.json({ accepted: ids.length })

  after(async () => {
    const deadline = getDeadline()
    for (const id of ids) {
      // `undefined` means "no deadline available" — do not treat it as "infinite time".
      if (deadline && Date.now() > deadline.getTime() - SAFETY_MARGIN_MS) {
        // Out of budget. Hand the remainder to something durable.
        await enqueueRemaining(ids.slice(ids.indexOf(id)))
        return
      }
      await handle(id)
    }
  })

  return response
}
```

That pattern — work until the deadline is near, then persist the remainder — is the documented use of `getDeadline`, and it is the only responsible way to run a loop inside `after()`. Note that the durable half is still a queue. `getDeadline` does not remove the need for one; it tells you when to start using it.

## Database pools and suspended functions

One more `@vercel/functions` export matters here, because a background callback often opens a connection:

> *"Call this function right after creating a database pool to ensure proper connection management in Fluid Compute. This function ensures that idle pool clients are properly released before functions suspend."*
> — on `attachDatabasePool`

A function that suspends while holding a checked-out client is a client the pool believes is alive and the database may believe is gone. See [01f · WebSockets, Pool and the lifecycle rule](01f-websockets-pool-and-the-lifecycle-rule.md) for the general form of this problem.

## Gotchas

**★ Symptom: an `after()` callback throws and nothing appears anywhere.** Cause: the response is already sent; there is no request context left to attach an error to, and an unhandled rejection in a background callback is not a failed request. Fix: the callback owns its own error handling, always — `after()` never gets a bare `await` chain:

```ts
after(async () => {
  try {
    await recordPageView({ postId: id })
  } catch (error) {
    // Whatever your telemetry sink is. The point is that it is INSIDE.
    console.error('after: recordPageView failed', { postId: id, error })
  }
})
```

**★ Symptom: the view counter on a marketing page increments once a day.** Cause: the page is static, and *"if it's used within a static page, the callback will execute at build time, or whenever a page is revalidated."* You built a build-time counter. Fix: either move the counter to a genuinely dynamic surface, or opt the route out of prerendering explicitly with `connection()` before the work — and accept that you have made the page dynamic, which is a real cost, not a formality.

**★ Symptom: a Server Component's `after()` callback throws `cookies()` errors in production but seemed fine locally.** Cause: request-time APIs are unavailable inside `after` in Server Components by design — Next.js needs to know at render time which part of the tree touched request data, and `after` runs past that point. Fix: hoist the read out of the callback as shown above. There is no configuration that makes the inside-the-callback version work; it is a lifecycle constraint, not a permission.

**★ Symptom: a long `after()` job completes in dev and is cancelled in production.** Cause: dev is a long-lived process with no invocation deadline; production is an invocation with one, and *"if the function times out, the promises will be cancelled."* Fix: any callback whose duration scales with input size does not belong in `after()`. Bound it with `getDeadline` and spill the remainder to a job table, per the loop above.

**Symptom: rolling deploys lose the last few seconds of analytics every time.** Cause: the container is killed before the drain finishes; the docs ask for a *"configurable drain period (10-30 seconds is recommended)"* and the orchestrator's default is usually shorter. Fix: raise the grace period to match, and make sure your process actually waits on `SIGTERM` rather than exiting immediately:

```yaml
# kubernetes deployment fragment
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
```

**Symptom: `after()` does nothing at all on your platform.** Cause: `after` looks for `globalThis[Symbol.for('@next/request-context')]` to find a `waitUntil` implementation; an adapter that does not install one has nothing to extend the invocation with. Fix: check the adapter's support matrix before relying on it, and treat "we deploy on a platform without `waitUntil`" as a reason to use a job table for *everything*, including analytics.

**Symptom: two `after()` callbacks in one request both fetch the same user row.** Cause: they are independent closures with no shared memoisation. Fix: the docs' own answer — *"You can use React `cache` to deduplicate functions called inside `after`."* Wrap the loader in `cache()` once and both callbacks hit one fetch.

**Symptom: you moved a slow email send into `after()` and p95 response time improved, then the support queue filled with "no confirmation email".** Cause: you optimised the *symptom* the user could see and kept the *failure* they could not. Response latency was never the problem; durability was. Fix: the send belongs in a job row — [04d](04d-postgres-as-a-queue-skip-locked.md). `after()` may still be used, to *notify* the worker that a job is waiting, which is a hint and not a promise.

## Interview questions

**★ `after()` runs after the response. So why is it still bounded by `maxDuration`?**
Because `maxDuration` bounds the *invocation*, not the response. The response finishing is a milestone inside the invocation's life, not the end of it. `after()` works by calling the platform's `waitUntil`, which — in Vercel's words — *"extends the lifetime of a serverless invocation until all promises passed to `waitUntil` have settled"*; extending a lifetime is not the same as removing the ceiling on it. The mental model that keeps you out of trouble is: one invocation, one budget, and the response is just the point at which the client stops waiting for it.

**★ Name the failure mode of using `after()` to send a transactional email.**
The invocation hits its deadline, or the instance is recycled, and the promise is cancelled. The HTTP response already said `200`, so the client believes the operation succeeded; your database believes the order exists; and there is no record anywhere that an email was ever supposed to be sent, because the intent lived only as a closure. Nothing retries, nothing alerts, and the first signal is a customer asking where their receipt is — days later, with no way to identify which orders were affected. The fix is that the *intent* must be durable before the response, even if the *execution* is not.

**★ When is `after()` exactly the right tool?**
When the work is (a) short, (b) idempotent-or-irrelevant, and (c) cheap to lose. Analytics events, access log rows, cache warming, updating a "last seen" timestamp, flushing a trace span. In all of those, an occasional loss is statistically invisible and the alternative — a durable job row per page view — costs far more than the data is worth. The documentation's own examples, *"logging and analytics"*, are the honest boundary of the API.

**★ Why can a Server Component not call `cookies()` inside `after()` when a Route Handler can?**
Because Next.js tracks which parts of the component tree read request data in order to decide what can be prerendered — that is what makes Partial Prerendering and Cache Components possible. `after` runs *past React's rendering lifecycle*, so a `cookies()` call from inside it arrives after the tracking window has closed and Next.js can no longer attribute it to a subtree. A Route Handler has no component tree and no prerender boundary to protect, so the same call is unambiguous and permitted. It is a constraint of the rendering model, not a security rule.

**What does `after()` do on a statically exported site, and why is that the right behaviour?**
Nothing, and it is right because there is no server. A static export produces files; there is no invocation to extend and no runtime to run a callback in. The related and more dangerous case is a *statically rendered page on a running server*, where `after()` does execute — at build time or on revalidation — which is easy to misread as "it works". The general lesson is that `after` inherits the timing of whatever produced the response, and if the response was produced at build time, so was your side effect.

**Your platform has no `waitUntil`. What changes?**
Everything that relied on work continuing past the response. `after` resolves its implementation from `globalThis[Symbol.for('@next/request-context')]`; with nothing there, you either block the response on the work or you drop it. Practically this means moving all background work — including the analytics you would normally be relaxed about — into a durable queue with an external worker, because the platform is telling you it will not hold an invocation open on your behalf. It is a good reason to prefer the job table by default: it is the only design that behaves the same on every deployment target.

**How would you decide whether a piece of work goes in `after()` or a queue, in a code review, in one question?**
Ask: *"if this silently never runs, who finds out and how?"* If the answer is "a dashboard is slightly wrong and nobody notices", `after()` is fine. If the answer names a person outside the engineering team — a customer, finance, a compliance auditor — it needs a row, an attempt counter and a dead-letter path. The question works because it targets the only property that actually differs between the two, which is what happens on loss.

---

← [04 · Background jobs and queues](04-background-jobs-and-message-queues-for-async-workloads.md) · Next → [04c · The anatomy of a job](04c-the-anatomy-of-a-job.md)
