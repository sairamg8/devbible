---
title: "There are three ways to invoke a Server Action and only two of them wrap the call in a Transition for you — and the progressive enhancement everyone advertises survives exactly as long as the form's action prop is a server-function reference and not an arrow you wrote inside a Client Component"
sidebar_label: "05b · Invoking an action"
sidebar_position: 21
description: "form action, button formAction with several submit buttons on one form, event handlers and startTransition, why a call outside a transition logs an error, passing extra arguments with hidden inputs and closures, the permalink parameter, and the automatic form reset."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (docs `lastUpdated` 2026-06-17), React's [`'use server'`](https://react.dev/reference/rsc/use-server) reference and [`useActionState`](https://react.dev/reference/react/useActionState) (the `permalink` parameter and the transition requirement).
> Target: **Next.js 16.3.4**, React **19.2.8**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**A Server Action is invoked through React's action mechanisms: a form's `action` prop, a button's `formAction`, or a client-side transition. The first two matter more than they look, because React wraps them in a Transition automatically and a raw event-handler call does not — a Server Function called outside a transition is not treated as part of one and logs an error in development. The second thing worth knowing before writing any of this is that progressive enhancement is not a property of Server Actions; it is a property of one specific shape. A `<form>` whose `action` **is** the server-function reference has a real POST target the browser can submit before React hydrates. A `<form>` whose `action` is an inline `async (formData) => {…}` arrow written in a Client Component — the shape almost every optimistic-UI tutorial shows — is ordinary client code, and before hydration there is nothing in the page able to run it. React offers exactly one documented mitigation for that, `useActionState`'s `permalink`, and it is narrower than people expect. The directive itself is [05](05-server-actions-mutations-form-submissions-progressive-enhanc.md); the hooks are [05d](05d-the-action-hooks-in-depth.md).**

## The three surfaces

```tsx
// (1) form action — a Server Component; no 'use client' in this file
import { createProject } from './actions'

export default function NewProjectPage() {
  return (
    <form action={createProject}>
      <input name="name" required maxLength={120} />
      <textarea name="description" maxLength={2000} />
      <button type="submit">Create</button>
    </form>
  )
}
```

```tsx
// (2) button formAction — several outcomes, one form, one set of fields
import { saveDraft, publish, discard } from './actions'

export default function EditorForm({ postId }: { postId: string }) {
  return (
    <form action={saveDraft}>
      <input type="hidden" name="postId" value={postId} />
      <input name="title" defaultValue="" />
      <textarea name="body" />
      <button type="submit">Save draft</button>
      <button type="submit" formAction={publish}>Publish</button>
      <button type="submit" formAction={discard} formNoValidate>Discard</button>
    </form>
  )
}
```

```tsx
// (3) a transition — an event handler, or a useEffect
'use client'
import { startTransition, useState } from 'react'
import { archiveProject } from '@/app/projects/actions'

export function ArchiveButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false)

  return (
    <button
      disabled={busy}
      onClick={() => {
        setBusy(true)
        startTransition(async () => {
          await archiveProject(projectId)
          setBusy(false)
        })
      }}
    >
      Archive
    </button>
  )
}
```

The distinction that decides correctness: **`action` and `formAction` call the function inside a Transition automatically**; an event handler does not. React's reference is explicit that Server Functions should be called in a Transition, and that calls outside that scope are not treated as part of the transition and log an error in development mode. So form (3) always needs the `startTransition` wrapper — it is not optional politeness, it is what makes the pending state, the queuing and the router integration work.

`formAction` on a submit button is the underused one. Three outcomes that share one set of inputs need one form, not three, and not a hidden `intent` field that the action then branches on — the browser already has a mechanism for "which button submitted this", and it is this.

## Passing extra data the form does not contain

Two documented mechanisms, and they are not equivalent.

**A hidden input** puts the value in `FormData`, which means the client sends it — so it is attacker-controlled and must be treated that way:

```tsx
<form action={updateProject}>
  <input type="hidden" name="projectId" value={project.id} />
  <input name="name" defaultValue={project.name} />
  <button type="submit">Save</button>
</form>
```

```ts
'use server'
export async function updateProject(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const projectId = String(formData.get('projectId') ?? '')
  // 🔴 the client chose this id — look up by ownership, do not trust it
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: session.user.id },
  })
  if (!project) throw new Error('Forbidden')
  await db.project.update({
    where: { id: project.id },
    data: { name: String(formData.get('name') ?? '') },
  })
}
```

**A closure** over an inline action captures the value on the server. Variables captured this way are encrypted before being sent to the client, so the browser cannot read or alter them — and the action never has to ask the client which record it is acting on:

```tsx
// app/projects/[id]/page.tsx — a Server Component
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await requireOwnedProject(id)      // authorized once, here

  async function save(formData: FormData) {
    'use server'
    await db.project.update({
      where: { id: project.id },                     // captured, not submitted
      data: { name: String(formData.get('name') ?? '') },
    })
  }

  return (
    <form action={save}>
      <input name="name" defaultValue={project.name} />
      <button type="submit">Save</button>
    </form>
  )
}
```

⚠️ Binding an extra argument with `Function.prototype.bind` is a widely used third pattern, and the pages verified here **do not document it**. The two forms above are documented and cover the cases; if you use `.bind`, verify its behaviour against the current React reference rather than against a blog post, because how a bound argument is encoded and whether it is encrypted is exactly the sort of detail that decides whether an id is client-controlled.

🔴 The closure being encrypted does **not** make the action safe on its own. The encrypted reference still travels to the browser and can be replayed, and your server will decrypt it. What the closure buys is that the client cannot *choose* the record — a different and narrower guarantee than "authorized". Authorization still belongs inside the function ([05e](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md)).

## Progressive enhancement, stated honestly

[01b](01b-server-actions-and-mutations.md) makes the argument; this is the operational version of it.

**What works without JavaScript:** a `<form>` whose `action` prop is a Server Function reference. The browser has a real POST target and submits it natively.

**What does not:** a `<form>` whose `action` is an inline arrow defined in a Client Component. That arrow is client code. Before hydration there is nothing in the page able to run it, so the form does nothing at all — not "degrades", *nothing*.

```tsx
// ✅ submits before hydration
<form action={createProject}>…</form>

// ❌ requires hydration; there is no pre-hydration equivalent
'use client'
<form action={async (fd) => { addOptimistic(fd); await createProject(fd) }}>…</form>
```

The trap is that the second shape is what almost every optimistic-UI example shows, so a codebase can be full of forms that "use Server Actions" and have no no-JS path whatsoever. If progressive enhancement is a requirement, it is a per-form property you have to check, not a framework guarantee you inherit.

⚠️ The Next.js pages verified here do not state the progressive-enhancement guarantee in those words; the above follows from the compilation model and from React's own description of what `permalink` is for.

### `permalink`, the one documented mitigation

`useActionState` takes an optional third parameter, `permalink`: a string containing the unique page URL that the form modifies. React documents it for pages with Server Components and progressive enhancement — **if the action is a Server Function and the form is submitted before the JavaScript bundle loads, the browser navigates to the permalink URL rather than the current page's URL.**

```tsx
'use client'
import { useActionState } from 'react'
import { addComment, type CommentResult } from './actions'

export function CommentForm({ postSlug }: { postSlug: string }) {
  const [state, formAction] = useActionState<CommentResult, FormData>(
    addComment,
    { ok: false, error: null },
    `/posts/${postSlug}#comments`,        // ← the permalink
  )

  return (
    <form action={formAction}>
      <input type="hidden" name="postSlug" value={postSlug} />
      <textarea name="body" required />
      <button type="submit">Comment</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
```

Two caveats travel with it, both documented and both easy to miss. **The same form component must be rendered on the destination page** — the same action, the same permalink — so React knows how to pass the state through. And **once the page is interactive the parameter has no effect**, so it is untestable by clicking around in a hydrated browser: the only way to exercise it is to submit before the bundle loads.

## Sequential dispatch, and the automatic form reset

Two behaviours that surprise people on first contact, both by design.

**Actions dispatch one at a time per client** ([01b](01b-server-actions-and-mutations.md)). Three rapid clicks queue; `Promise.all` from a Client Component buys nothing. Parallelism belongs inside a single action, or in a Route Handler if the request is not a mutation ([05e](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md)).

**A `<form>` with an `action` prop resets automatically after submission.** That is convenient on success and a defect on failure: the user's typing is gone along with everything else, and they get to enter it again to see whether the second attempt is rejected for the same reason. The fix is to return the submitted values in the action's result and use them as the inputs' `defaultValue`, so a rejected submission refills the form it just cleared — [05d](05d-the-action-hooks-in-depth.md) has the full shape.

## Gotchas

**★ Symptom: an action called from an `onClick` logs an error in development about being called outside a transition.** Cause: Server Functions should be called in a Transition, and only `action` and `formAction` do that for you. Fix: wrap the call.

```tsx
onClick={() => startTransition(async () => { await archiveProject(projectId) })}
```

**★ Symptom: a form "using Server Actions" does nothing with JavaScript disabled.** Cause: its `action` is an inline arrow defined in a Client Component, which has no pre-hydration equivalent. Fix: make the `action` the Server Function itself and move the optimistic work into a child or into `useActionState`'s dispatch.

```tsx
<form action={createProject}>{/* posts before hydration */}</form>
// not: <form action={async (fd) => { setOptimistic(); await createProject(fd) }}>
```

**★ Symptom: a validation failure clears the form the user just filled in.** Cause: a `<form>` with an `action` prop resets automatically after submission, success or failure. Fix: return the submitted values from the action and feed them back as `defaultValue`, so the second attempt starts from the first.

```tsx
<input name="name" defaultValue={state.values?.name ?? ''} />
```

**★ Symptom: three quick submissions feel serialised, and the third takes three times as long.** Cause: they are — Next.js dispatches Server Actions one at a time per client. Fix: this is by design; disable the control while pending, or batch the work into one action. Do not reach for `Promise.all`, which shares the same queue.

**★ Symptom: a hidden `intent` field and a `switch` inside the action, growing a branch per button.** Cause: reimplementing something the platform already has. Fix: give each submit button its own `formAction`, so each outcome is its own function with its own signature and its own authorization.

**★ Symptom: an id sent in a hidden input lets one user act on another user's record.** Cause: a hidden input is client-supplied data; "hidden" is a rendering hint, not a trust boundary. Fix: derive identity from the session and look the row up by ownership — or capture the id in an inline action's closure so the client never supplies it at all.

**★ Symptom: `permalink` is set and nothing observable changes.** Cause: it only takes effect when the form is submitted **before the JavaScript bundle loads**, and it has no effect once the page is interactive. Fix: nothing is broken — but understand that clicking around a hydrated page can never exercise it, so a test that does is testing nothing.

**★ Symptom: `permalink` navigates but the state does not survive.** Cause: the destination page must render the same form component, with the same action and the same permalink, so React can pass the state through. Fix: render it there, or accept that the state is lost on that path.

**★ Symptom: a `formNoValidate` button is added to "Discard" and someone removes it as noise.** Cause: without it, the browser's constraint validation blocks the submission because a required field elsewhere in the form is empty — so "Discard" only works on a form you already filled in correctly. Fix: keep `formNoValidate` on any submit button whose action does not need the form's contents.

**Symptom: an action is invoked from a `useEffect` on mount to load data, and the page feels slow and refetches oddly.** Cause: Server Functions are designed for mutations, are processed one at a time, and have no way to cache their return value. Fix: fetch in a Server Component, or through a Route Handler if the browser genuinely needs to request it ([05e](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md)).

**Symptom: `.bind` is used to attach an id to an action and a reviewer cannot say whether the id is client-controlled.** Cause: the encoding of bound arguments is not documented on the pages verified here. Fix: prefer the two documented mechanisms — a hidden input (client-supplied, validate it) or a closure (server-captured, encrypted) — so the trust question has a written answer.

**Symptom: a `<form action>` submits successfully and the page does not change.** Cause: the action returned without calling anything that triggers a re-render, so the response carried only the return value. Fix: call the invalidation that matches what changed — `updateTag` for read-your-own-writes, `revalidatePath` for one route ([01b](01b-server-actions-and-mutations.md), [05e](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md)).

## Interview questions

**★ What are the three ways to invoke a Server Action, and which of them handle the Transition for you?**
A form's `action` prop, a button's `formAction`, and a client-side transition — an event handler or a `useEffect` wrapped in `startTransition`. The first two wrap the call in a Transition automatically; the third is the one you have to wrap yourself, and React logs an error in development if you do not, because a call outside that scope is not treated as part of the transition. That matters beyond tidiness: the transition is what makes pending state, queuing and the router's commit of the re-rendered payload behave.

**★ You have one form and three outcomes — save draft, publish, discard. How do you wire it?**
One `<form>` with `action={saveDraft}` and two extra submit buttons carrying `formAction={publish}` and `formAction={discard}`. Each outcome is its own Server Function with its own signature and its own authorization check, rather than one action with a hidden `intent` field and a `switch` that grows a branch every quarter. The discard button also wants `formNoValidate`, otherwise the browser's own required-field validation blocks a submission that does not need the fields.

**★ Where exactly does progressive enhancement stop?**
At the point where the `action` prop stops being a server-function reference. A form whose action *is* the Server Function has a real POST target the browser can submit before React hydrates. A form whose action is an inline arrow defined in a Client Component — the shape most optimistic-UI examples show — is client code, and before hydration nothing in the page can run it, so the form does nothing at all. If a no-JS path matters, it is a per-form property to verify, not a framework guarantee to inherit. Note this follows from the compilation model; the Next.js pages checked here do not state it in those words.

**★ What is `useActionState`'s `permalink` parameter for, and what are its two constraints?**
It is the documented mitigation for the pre-hydration case: if the action is a Server Function and the form is submitted before the JavaScript bundle loads, the browser navigates to the permalink URL rather than the current page's URL. The constraints are that the destination page must render the same form component — same action, same permalink — so React can pass the state through, and that the parameter has no effect once the page is interactive. The second constraint is why it is so often set and never verified: you cannot exercise it by clicking in a hydrated browser.

**★ Two ways to give an action a record id. Which is safer, and why is "safer" not "safe"?**
A hidden input sends the id from the client, so it is attacker-controlled and the action must look the record up by ownership derived from the session. A closure over an inline action captures the id on the server, and captured variables are encrypted before being sent to the client, so the client cannot choose which record. The closure is safer because it removes the choice — but not safe, because the encrypted reference still travels to the browser, can be replayed, and will be decrypted by your own server. Authorization inside the function is required in both cases; only the attack surface differs.

**★ Why does a form using an `action` prop clear itself even when the submission failed, and what do you do about it?**
Because a `<form>` with an `action` prop resets automatically after submission — React does not distinguish success from a returned error, since a returned error is a normal return value. The consequence is that a validation failure wipes the user's typing, so the retry begins from an empty form and they have to re-enter everything to discover whether the rule is the same. The fix is to return the submitted values as part of the action's result and use them as `defaultValue`, which makes the form refill itself on the failure path.

**★ Why can you not parallelise Server Actions with `Promise.all` from a Client Component?**
Because the client dispatcher sends them one at a time per client — the second waits for the first, the third for the second — and wrapping them changes nothing about that queue. The reason for the queue is consistency: each action's response can carry a re-rendered tree, and overlapping actions would let a stale tree commit after a fresh one. The workaround is to move the parallelism to where it is safe: inside one action, in a Server Component's reads, or into a Route Handler if the request is not a mutation.

**Someone invokes an action from a `useEffect` on mount to load data. What do you tell them?**
That Server Functions are documented as designed for mutations that update server-side state, explicitly not recommended for data fetching, and that frameworks implementing them typically process one action at a time with no way to cache the return value. So it works, and it is a serialised, uncacheable fetch with a POST. Read in a Server Component, or through a Route Handler if the browser genuinely needs to make the request itself.

---

← [05 · The 'use server' directive](05-server-actions-mutations-form-submissions-progressive-enhanc.md) · [Chapter 4 overview](01-explanation.md) · Next → [05c · What crosses the wire](05c-what-crosses-the-wire.md)
