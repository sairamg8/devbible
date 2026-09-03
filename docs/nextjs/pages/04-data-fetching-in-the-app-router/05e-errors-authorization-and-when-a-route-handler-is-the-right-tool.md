---
title: "An action that returns its failures keeps the user on the form and an action that throws them replaces the page — and the third decision, which nobody frames as a decision, is that some of what you are writing as a Server Action was always supposed to be a Route Handler"
sidebar_label: "05e · Errors, authorization and choosing"
sidebar_position: 5.4
description: "A discriminated result union the UI can switch on, unauthorized() and forbidden() under authInterrupts, why redirect() must not sit inside a try/catch, authorization as a separate question from validation, pairing the tag you invalidate with the tag your loader sets, and the decision table for action versus handler."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (docs `lastUpdated` 2026-06-17) — the Security, Choosing a cache update and Deployment sections — and React's [`'use server'`](https://react.dev/reference/rsc/use-server) reference for the caveat on data fetching.
> Target: **Next.js 16.3.4**, React **19.2.8**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Three decisions finish a Server Action, and each of them is made by default if you do not make it deliberately. The first is the error channel: returning a failure keeps the user on the form with their typing intact, throwing one cancels every queued action and hands the page to the nearest Error Boundary ([05d](05d-the-action-hooks-in-depth.md)) — so an action that throws on a wrong password is technically correct and a bad product. The second is authorization, which is a different question from validation and cannot be answered by a schema: a perfectly valid `{ id, completed: true }` may name somebody else's row. The third is the one that never gets framed as a decision at all — whether this should be an action. React's own reference says Server Functions are for mutations and explicitly not recommended for data fetching, and Next.js dispatches them one at a time per client, so a polling read written as an action is a serialised, uncacheable POST. This page finishes all three.**

## A result union the UI can switch on

An action's return value is state that a component renders ([05d](05d-the-action-hooks-in-depth.md)), so give it a shape a `switch` can consume rather than a bag of optional fields:

```ts
// app/projects/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export type ActionResult<T = void> =
  | { status: 'ok'; data: T }
  | { status: 'invalid'; fields: Record<string, string[]>; values: Record<string, string> }
  | { status: 'conflict'; message: string }
  | { status: 'denied'; message: string }

export async function renameProject(
  _prev: ActionResult<{ name: string }>,
  formData: FormData,
): Promise<ActionResult<{ name: string }>> {
  const values = { name: String(formData.get('name') ?? '') }
  const projectId = String(formData.get('projectId') ?? '')

  const session = await auth()
  if (!session?.user) return { status: 'denied', message: 'Please sign in to rename a project.' }

  const parsed = RenameSchema.safeParse(values)
  if (!parsed.success) {
    return {
      status: 'invalid',
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      values,
    }
  }

  // 🔴 authorization is a lookup, not a schema check
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: session.user.id },
  })
  if (!project) return { status: 'denied', message: 'You cannot rename that project.' }

  try {
    await db.project.update({ where: { id: project.id }, data: { name: parsed.data.name } })
  } catch (cause) {
    if (isUniqueViolation(cause, 'name')) {
      return { status: 'conflict', message: 'A project with that name already exists.' }
    }
    throw cause          // genuinely unexpected — let the Error Boundary have it
  }

  updateTag('projects')  // read-your-own-writes: the re-render in THIS response sees it
  return { status: 'ok', data: { name: parsed.data.name } }
}
```

Four properties are deliberate. `denied` is returned rather than thrown, so the user stays on the form. The values are echoed on the `invalid` branch so the automatic form reset does not eat them ([05d](05d-the-action-hooks-in-depth.md)). The unique-constraint violation is translated into a domain outcome instead of reaching the boundary as a database error. And the genuinely unexpected exception is re-thrown, because that is the case the Error Boundary exists for.

## `unauthorized()`, `forbidden()` and `notFound()`

With the experimental `authInterrupts` flag enabled you can throw `unauthorized()` or `forbidden()` from `next/navigation` instead of a bare `Error`, and Next.js renders the matching `unauthorized.tsx` or `forbidden.tsx` segment. That is the right tool when the correct outcome is *leaving this page*, not annotating the form:

```ts
'use server'
import { forbidden, unauthorized } from 'next/navigation'

export async function deleteWorkspace(workspaceId: string) {
  const session = await auth()
  if (!session?.user) unauthorized()                       // renders unauthorized.tsx
  if (!(await isOwner(session.user, workspaceId))) forbidden()   // renders forbidden.tsx
  await db.workspace.delete({ where: { id: workspaceId } })
  redirect('/workspaces')
}
```

The distinction to hold: **an inline field error and a whole-page interrupt are different products.** "Please sign in" beside a comment box keeps the user's draft; `unauthorized()` navigates them away from it. Choose per action, and be consistent within a feature so the experience is predictable.

## 🔴 `redirect()` throws, so it must not sit inside a `try`

`redirect` signals by throwing a control-flow exception. Two consequences, and the second one is the quiet one:

```ts
'use server'
export async function publishPost(id: string) {
  await db.post.update({ where: { id }, data: { published: true } })
  updateTag('posts')            // must come BEFORE — nothing after redirect runs
  redirect(`/posts/${id}`)
}

// 🔴 the shape that silently breaks
export async function publishPostBroken(id: string) {
  try {
    await db.post.update({ where: { id }, data: { published: true } })
    updateTag('posts')
    redirect(`/posts/${id}`)    // throws — and the catch below swallows it
  } catch {
    return { status: 'error' }  // the user stays put and sees a generic failure
  }
}
```

The first is documented and well known ([01b](01b-server-actions-and-mutations.md)): put revalidation before the redirect. The second is the same class of bug the Route Handler wrapper on [04c](04c-error-responses-a-client-can-branch-on.md) guards against — a defensive `try/catch` converting a working navigation into a failure. Keep `redirect()` outside the `try`, or re-throw control-flow exceptions before any other branch.

## Authorization is not validation, and it is not the page

Three statements from the documentation, each of which is a rule people violate for the same reason — the action *looks* like a local function call:

- **Render-time gating is not a security boundary.** Rendering the form only on an authenticated page proves nothing, because a request does not have to come from your UI.
- **Arguments are untrusted input**, always. `FormData`, query parameters, headers — all of it.
- **Schema validation checks shape, not authority.** A well-formed `Item` can still name a row the caller does not own.

The shape that satisfies all three is a **reference plus the change**: the client says *which* record and *what* to do, the server derives *who* from the session, and the lookup is by ownership rather than by id alone.

```ts
// ❌ the whole item, including its id and its ownership, comes from the client
export async function completeItemUnsafe(item: Item) {
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}

// ✅ reference + change; identity from the session; lookup by ownership
export async function completeItem(itemId: string) {
  const session = await auth()
  if (!session?.user) return
  const item = await db.item.findFirst({ where: { id: itemId, ownerId: session.user.id } })
  if (!item) return
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}
```

The version of this that scales past a handful of actions is a data access layer: one module that owns "fetch this thing *for this session*", so authorization is a property of the query rather than a check every caller must remember. Then the actions read `await projectsFor(session).requireOwned(id)` and there is one place to audit. Destructive operations may warrant more — an elevated session check or re-authentication — and a loud failure when those checks miss ([01c](01c-server-action-hooks-optimistic-ui-and-security.md) has the deployment and CSRF layers).

## Pairing the invalidation with the read

[01b](01b-server-actions-and-mutations.md) settles which API to call: `updateTag` for read-your-own-writes, `revalidateTag` for stale-while-revalidate fan-out, `revalidatePath` for one route, `refresh()` for state that was never cached. What that table cannot tell you is the mistake underneath most "I called the right one and nothing happened" reports: **tags are attached at the read and invalidated at the write, and those two live in different files.**

```ts
// lib/tags.ts — the single source of the string
export const TAG = {
  projects: 'projects',
  project: (id: string) => `project:${id}`,
} as const

// lib/queries.ts — the READ attaches the tag
export async function getProjects(ownerId: string) {
  const res = await fetch(`${API}/projects?owner=${ownerId}`, {
    next: { tags: [TAG.projects] },
  })
  return res.json()
}

// app/projects/actions.ts — the WRITE invalidates the same constant
'use server'
import { updateTag } from 'next/cache'
import { TAG } from '@/lib/tags'

export async function archiveProject(id: string) {
  await db.project.update({ where: { id }, data: { archived: true } })
  updateTag(TAG.projects)
  updateTag(TAG.project(id))
}
```

A string literal in the action and a different string literal in the loader is a bug that produces no error at all — the invalidation succeeds against a tag nothing uses, and the page stays stale. One constants module removes the whole category. Tag limits are on [01](01-explanation.md).

## When it should have been a Route Handler

> *"Server Functions are designed for mutations that update server-side state; they are not recommended for data fetching."*

React's reference adds the reason: frameworks implementing Server Functions typically process one action at a time and have no way to cache the return value. Next.js does exactly that — one at a time per client ([01b](01b-server-actions-and-mutations.md)). So an action used as a read is a serialised, uncacheable POST with none of HTTP's caching machinery available to it.

| The requirement | Server Action | Route Handler |
|---|---|---|
| A form mutation from your own UI | ✅ | overkill |
| The user must see their own write immediately | ✅ `updateTag` re-renders in the same response | ❌ needs a client refetch |
| Progressive enhancement without JavaScript | ✅ with `action={fn}` ([05b](05b-invoking-an-action-and-what-progressive-enhancement-really-buys.md)) | ❌ unless you write a plain HTML form posting to it |
| Browser polling or client-side revalidation | ❌ serialised, uncacheable | ✅ ([04](04-route-handlers-routets-for-restful-apis.md)) |
| A third-party webhook | ❌ no stable public URL contract | ✅ ([12](12-bff-proxying-webhooks-and-callback-routes.md)) |
| A mobile or native client | ❌ the endpoint is a build artifact | ✅ a URL you version |
| A file download, an RSS feed, a signed upload URL | ❌ | ✅ ([04b](04b-constructing-the-response-status-codes-and-streaming.md)) |
| Several concurrent requests from one client | ❌ they queue | ✅ |
| `GET` semantics, `ETag`, `Cache-Control`, `304` | ❌ | ✅ ([04b](04b-constructing-the-response-status-codes-and-streaming.md)) |
| A caller outside your React tree, ever | ❌ | ✅ |

The decisive argument for the "mobile client" row is the deployment one ([01c](01c-server-action-hooks-optimistic-ui-and-security.md)): an action's identity is a build artifact, and new deployments mint new IDs — rotated at most every 14 days even for unchanged source. A client you do not deploy in lockstep with the server cannot depend on that. A Route Handler's URL is a contract you choose and version.

⚠️ What Next.js sends to the client for an **unhandled** throw inside an action in production — whether the message is redacted — is not stated on the pages verified here. Do not design around an assumption either way: return your failures, and treat a throw as "the user sees an error boundary", not as "the user sees my message".

## Gotchas

**★ Symptom: a wrong password replaces the login page with an error screen.** Cause: the action threw, and a thrown action cancels all queued actions and shows the nearest Error Boundary. Fix: return the failure as a discriminated result and render it beside the field.

```ts
if (!user) return { status: 'denied', message: 'Email or password is incorrect.' }
```

**★ Symptom: `redirect()` in an action returns a generic error and the user stays put.** Cause: `redirect` throws a control-flow exception and the defensive `try/catch` around the mutation caught it. Fix: call `redirect` outside the `try`, or re-throw control-flow exceptions before any other branch in the `catch`.

**★ Symptom: `revalidatePath` after `redirect` invalidates nothing.** Cause: nothing after `redirect` runs. Fix: revalidate first, redirect last — the fixed shape for a create-then-navigate action is write, invalidate, redirect.

**★ Symptom: `updateTag` is called, the write succeeded, and the list is still stale.** Cause: the tag string in the action and the tag string in the loader are different literals that drifted apart, so the invalidation succeeded against a tag nothing reads. Fix: one constants module, imported by both.

```ts
import { TAG } from '@/lib/tags'
updateTag(TAG.projects)        // and next: { tags: [TAG.projects] } at the read
```

**★ Symptom: the mutation lands, the action returns `{ ok: true }`, and the screen does not change.** Cause: the action called nothing that triggers a re-render, so the response carried only the return value ([01b](01b-server-actions-and-mutations.md)). Fix: `updateTag` for read-your-own-writes; `revalidateTag` deliberately skips the immediate re-render and will look like this exact symptom, one interaction late.

**★ Symptom: a schema-validated action lets one user complete another user's item.** Cause: validation checks shape, not authority — a well-formed payload can name a row the caller does not own. Fix: reference plus change, identity from the session, lookup by ownership.

**★ Symptom: an action reachable only from an admin page is invoked by a non-admin.** Cause: render-time gating is not a security boundary; a POST need not come from your UI. Fix: authenticate and authorize inside the function, including for actions you believe nobody can see.

**★ Symptom: a `unique constraint` error reaches the user as a generic failure and support cannot explain it.** Cause: the database exception was allowed to propagate to the boundary instead of being translated at the point where its meaning is known. Fix: catch the specific violation in the action and return a `conflict` result naming the field; re-throw everything else.

**★ Symptom: polling an action every ten seconds gets slower under load and never hits a cache.** Cause: Server Functions are documented as designed for mutations, not recommended for data fetching, processed one at a time, with no way to cache the return value. Fix: read in a Server Component, or expose a Route Handler with `ETag` and a conditional `GET` ([04b](04b-constructing-the-response-status-codes-and-streaming.md)).

**★ Symptom: a mobile app calling a Server Action breaks after every web deploy.** Cause: an action's ID is a build artifact and new deployments generally mint new ones — rotated at most every 14 days even for unchanged source. Fix: this is not a bug to work around; it is the wrong integration. Give the app a Route Handler at a URL you version and control.

**Symptom: `unauthorized()` throws an ordinary error instead of rendering `unauthorized.tsx`.** Cause: the segment file is missing, or the experimental `authInterrupts` flag is not enabled. Fix: enable the flag and add `unauthorized.tsx` / `forbidden.tsx` for the segment — and decide first whether a whole-page interrupt is the right product for that action, or whether an inline `denied` result is.

**Symptom: two actions in the same feature handle "not signed in" differently — one returns, one interrupts — and QA files it as inconsistent.** Cause: the choice was made per action, by whoever wrote it. Fix: decide per *feature* whether an unauthenticated user is annotated or navigated, and apply it uniformly; both are correct, and mixing them is what looks broken.

**Symptom: an action returns a database row and someone later adds a column containing internal flags.** Cause: return values are serialized to the client wholesale ([05c](05c-what-crosses-the-wire.md)). Fix: project explicitly and put an explicit return type on the action, so widening the table cannot widen the payload.

## Interview questions

**★ Return an error or throw one — how do you decide?**
By where you want the user to end up. A returned error keeps them on the form, with their typing intact if the state carries it, and a message beside the offending field. A thrown error cancels every queued action and hands the page to the nearest Error Boundary, so their context is gone. That makes validation failures, conflicts, permission refusals and "please sign in" all *returned*, and throwing the reserve for a failure where continuing is meaningless. There is also a third channel worth knowing: with `authInterrupts` enabled, `unauthorized()` and `forbidden()` render dedicated segments, which is the right shape when leaving the page *is* the correct outcome.

**★ Why must `redirect()` never sit inside a `try` block in an action?**
Because it signals by throwing a control-flow exception, so a `catch` around it will treat a successful navigation as a failure and return your generic error instead — the user stays where they were and sees something that looks like a bug in the mutation that actually succeeded. The related rule is ordering: nothing after `redirect` runs, so any revalidation the destination needs has to happen before it. A create-then-navigate action therefore has a fixed shape — write, invalidate, redirect — with the redirect outside any defensive `catch`.

**★ A reviewer says "we validate with zod, so the action is safe". What is the counter-argument?**
That schema validation checks shape, not authority. `{ itemId: "abc123", completed: true }` is a perfectly valid payload that may name a row belonging to somebody else, and a schema will pass it every time. The rule is to accept a reference plus the user's change, derive identity from the session, and look the row up by ownership — `findFirst({ where: { id, ownerId: session.user.id } })`. Validation and authorization answer different questions and both are required, and neither is satisfied by the fact that the form is only rendered on an authenticated page.

**★ You called `updateTag` after a successful write and the list is still stale. What are the two candidate causes?**
Either the tag strings do not match, or you called the wrong API. The first is the common one and produces no error: the loader attaches `'projects'` and the action invalidates `'project-list'`, so the invalidation succeeds against a tag nothing reads — which is why the tag belongs in one constants module imported by both. The second is `revalidateTag` where you needed `updateTag`: with a stale-while-revalidate profile it deliberately skips the re-render that ships in the action's response, so the change appears on a later read and the symptom looks exactly like staleness.

**★ When is a Route Handler the right tool instead of a Server Action?**
Whenever the caller is not your React tree, or the request is a read. React's reference states that Server Functions are designed for mutations and are explicitly not recommended for data fetching, and that frameworks implementing them process one action at a time with no way to cache the return value — Next.js does exactly that, one at a time per client. So browser polling, third-party webhooks, mobile clients, file downloads, feeds, signed upload URLs and anything wanting `GET` semantics with `ETag` and `304` all belong in a handler. Actions are for a form mutation from your own UI, where the payoff is the re-rendered payload arriving in the same response.

**★ Why can a mobile app not depend on a Server Action?**
Because an action's identity is a build artifact. New deployments generally mint new action IDs — rotated at most every 14 days even when the source has not changed — so a client that is not redeployed in lockstep with the server will POST an ID the server cannot resolve, and the failure surfaces as "Failed to find Server Action". For the web that is a transient problem you manage with rolling deploys and a retry path; for a client on an app store review queue it is unmanageable. A Route Handler's URL is a contract you choose, version and deprecate on your own schedule.

**★ What does a data access layer buy you over checking authorization in each action?**
It moves authorization from something every caller must remember into a property of the query itself. One module owns "fetch this thing for this session", so an action reads `requireOwnedProject(id)` and cannot accidentally reach the unscoped query — and there is one place to audit rather than forty. It also survives growth in a way per-action checks do not: the fortieth action is written by someone who has not read the first, and the thing that protects them is not documentation, it is that the unscoped query is not exported.

**Why translate a unique-constraint violation inside the action rather than letting it reach the boundary?**
Because the action is the only place that knows what the constraint *means*. At the boundary it is an opaque database error with a driver-specific message that must not be shown to the user ([04c](04c-error-responses-a-client-can-branch-on.md)); inside the action it is "a project with that name already exists", a conflict outcome, and a message attached to the `name` field. Everything else is re-thrown, because the Error Boundary is for the failures you did not anticipate — which is precisely the set that shrinks every time you translate one you did.

**Two actions in a feature handle "not signed in" differently. Does it matter?**
Yes, and not for the reason people expect — both behaviours are correct in isolation. Returning `denied` annotates the form and preserves the draft; `unauthorized()` navigates to a dedicated segment. Mixing them within one feature means the same condition produces two different experiences depending on which control the user touched, which reads as a bug even though every individual action is defensible. Decide per feature, write it down, and let the inline form be the default because it loses less of the user's work.

---

← [05d · The action hooks in depth](05d-the-action-hooks-in-depth.md) · [Chapter 4 overview](01-explanation.md) · Next → [06 · Project milestone: scaffold SprintDesk](06-project-milestone-scaffold-sprintdesk.md)
