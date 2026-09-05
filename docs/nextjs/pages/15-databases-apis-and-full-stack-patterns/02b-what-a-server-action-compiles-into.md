---
title: "A Server Action is not a function call — it is a compile-time swap that leaves an encrypted ID in the browser and a POST endpoint on your origin, and every design decision downstream follows from that"
sidebar_label: "02b · What an action compiles into"
sidebar_position: 16
description: "The two placements of 'use server', the compile-time swap that replaces the implementation with an action ID plus a dispatcher, why the directive publishes rather than hides, and the three ways React invokes the result."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions), [Next.js · `use server`](https://nextjs.org/docs/app/api-reference/directives/use-server) and [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) — all three fetched carrying `version: 16.3.4` in their frontmatter — plus [React · Server Functions](https://react.dev/reference/rsc/server-functions) for the pre-hydration replay and permalink guarantees.
> Documentation-verified; **no sandbox run**. Load-bearing sentences quoted verbatim.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**Reading an action's source teaches you almost nothing about its runtime shape, because what you wrote is not what ships. At build time the compiler removes the body from every client bundle and leaves behind a reference — an encrypted action ID plus a dispatcher that POSTs it back. The consequence is that your action has an address on the public internet whether or not you ever render the button that calls it, and everything about how you secure it, deploy it and version it follows from the fact that the browser is holding a pointer, not a promise.**

## The directive has two placements, and they are not interchangeable

> *"The `use server` directive designates a function or file to be executed on the **server side**. It can be used at the top of a file to indicate that all functions in the file are server-side, or inline at the top of a function to mark the function as a [Server Function](https://19.react.dev/reference/rsc/server-functions). This is a React feature."*

**File-level.** One directive, every exported function in the module becomes an action:

```ts
// app/posts/actions.ts
'use server'

import { createPost, deletePost } from '@/data/posts'
import { revalidatePath } from 'next/cache'

export async function createPostAction(formData: FormData) {
  await createPost({ title: String(formData.get('title')) })
  revalidatePath('/posts')
}

export async function deletePostAction(postId: string) {
  await deletePost(postId)
  revalidatePath('/posts')
}
```

**Inline.** The directive sits at the top of a function defined inside a Server Component, which is what makes closure capture possible ([02c](02c-closures-action-ids-and-deploys.md)):

```tsx
// app/posts/[id]/page.tsx
import { EditPost } from './edit-post'
import { revalidatePath } from 'next/cache'

export default async function PostPage({ params }: PageProps<'/posts/[id]'>) {
  const { id } = await params
  const post = await getPost(id)

  async function updatePost(formData: FormData) {
    'use server'
    // Verify auth before saving (e.g. inside savePost)
    await savePost(id, formData)
    revalidatePath(`/posts/${id}`)
  }

  return <EditPost post={post} updatePost={updatePost} />
}
```

The rule that catches people is on the client side of the boundary:

> *"To use Server Functions in Client Components you need to create your Server Functions in a dedicated file using the `use server` directive at the top of the file. These Server Functions can then be imported into Client and Server Components and executed."*

A Client Component cannot declare an inline action. It can only import one from a file-level `'use server'` module, or receive one as a prop from a Server Component.

## The swap: what the compiler actually does

This is the sentence the whole topic rests on:

> *"A Server Action runs as a POST request against the page that invokes it. At build time, the `'use server'` directive tells the compiler to swap the function's implementation in client bundles for a reference (an action ID plus a dispatcher) that POSTs back to the server. The implementation stays on the server, but the route is reachable to anyone who can send the same POST. Treat every action as an untrusted entry point."*

Three separate facts are bundled in there, and each has consequences:

| Fact | Consequence |
|---|---|
| The POST targets **the page that invokes it**, not a distinct URL | There is no `/api/...` path to firewall, rate-limit at the edge, or exclude from a route matcher by path |
| The client holds **an ID plus a dispatcher**, not the code | The implementation never leaks — but neither does the ID stay private, because it is in a bundle any visitor downloads |
| The route is reachable **to anyone who can send the same POST** | The UI is not the gate. A `curl` with the right headers is a first-class caller |

`'use server'` is a **server-exposure directive, not a server-only directive.** It is the opposite of what the name suggests on first reading: it does not hide the function, it *publishes* it. Nothing was hidden before — a plain imported module already stayed on the server. What the directive adds is a client-invocable handle to it.

The directive that hides a module is `import 'server-only'`, and it belongs on your Data Access Layer:

> *"`import 'server-only'` … ensures that proprietary code or internal business logic stays on the server by causing a build error if the module is imported in the client environment."*

See [02m](02m-the-data-access-layer.md) for where that module sits relative to both entry points.

## There is no route file, and that changes your operational toolkit

A Route Handler occupies a path you named: `app/api/posts/route.ts` serves `/api/posts`, and every proxy, WAF rule, CDN cache rule, log filter and load-test script in your organisation can address it by that path. An action has no such path — it POSTs to whatever page rendered it, so the same URL serves a `GET` that returns HTML and a `POST` that mutates your database.

Practical consequences, none of them obvious from the source:

- **Path-based edge rules do not distinguish actions from page loads.** A rule on `/dashboard` sees both. A rate limit expressed as "10 requests per minute to `/dashboard`" throttles reading, not just writing.
- **Access logs need the method to be readable at all.** `POST /posts/42` is your action; `GET /posts/42` is the page. Without the method column you cannot tell a mutation from a pageview.
- **`proxy.ts` matchers match the page path**, because that *is* the action's path. Coarse filtering there is possible but it cannot select "only the delete action" — see [10 · Defence in depth](../10-forms-authentication-and-security-hardening/04-defense-in-depth-proxyts-as-a-coarse-filter.md).
- **You cannot hand an action to a third party.** There is no stable, documented URL contract to give them, and the ID rotates ([02c](02c-closures-action-ids-and-deploys.md)).

That last point is the single sharpest line between the two entry points, and [02l](02l-the-decision-rule.md) builds the decision rule on it.

## Invocation: the three doors React opens

> *"A **Server Action** is a [React Server Function](https://react.dev/reference/rsc/server-functions) invoked through React's action mechanisms, such as `<form action>`, `<button formAction>`, or a client-side transition."*

```tsx
// app/posts/new-post-form.tsx
'use client'

import { useActionState, startTransition } from 'react'
import { createPostAction, deletePostAction } from './actions'

export function NewPostForm() {
  const [state, formAction, pending] = useActionState(createPostAction, null)

  return (
    <>
      {/* door 1 — the form's action prop, works without JS */}
      <form action={formAction}>
        <input name="title" />
        <button disabled={pending}>Create</button>
      </form>

      {/* door 2 — a different action on one button of the same form */}
      <form action={formAction}>
        <input name="title" />
        <button formAction={deletePostAction}>Delete instead</button>
      </form>

      {/* door 3 — an event handler inside a transition */}
      <button
        onClick={() => {
          startTransition(() => deletePostAction('post_123'))
        }}
      >
        Delete
      </button>
    </>
  )
}
```

Door 1 is the only one that degrades, and the mechanism is worth stating precisely because it is usually described too loosely. React's Server Functions reference gives two separate guarantees.

The first is **replay**:

> *"When using `useActionState` with Server Functions, React will also automatically replay form submissions entered before hydration finishes. This means users can interact with your app even before the app has hydrated."*

So a click during that window is not lost — it is queued and dispatched once hydration completes. That covers the slow-connection case, not the no-JavaScript case.

The second, for genuinely no-JavaScript operation, is the `useActionState` **permalink**:

> *"Server Functions also support progressive enhancement with the third argument of `useActionState`."*

> *"When the permalink is provided to `useActionState`, React will redirect to the provided URL if the form is submitted before the JavaScript bundle loads."*

```tsx
'use client'
import { useActionState } from 'react'
import { createPostAction } from './actions'

export function NewPost() {
  // third argument: where a pre-bundle submission lands
  const [state, formAction] = useActionState(createPostAction, null, '/posts/new')
  return (
    <form action={formAction}>
      <input name="title" />
      <button>Create</button>
    </form>
  )
}
```

Doors 2 and 3 have neither property: `formAction` on a button and a `startTransition` call both require the dispatcher, which requires the bundle. If working before hydration is a requirement, that difference decides the shape of your UI, not your preference about hooks.

## Why a mutation belongs here rather than in render

The framework does not merely prefer this; it enforces part of it.

> *"Mutations (e.g. logging out users, updating databases, invalidating caches) should never be a side-effect, either in Server or Client Components. Next.js explicitly prevents setting cookies or triggering cache revalidation within render methods to avoid unintended side effects."*

> *"**Good to know:** Next.js uses `POST` requests to handle mutations. This prevents accidental side-effects from GET requests, reducing Cross-Site Request Forgery (CSRF) risks."*

```tsx
// BAD: Triggering a mutation during rendering
export default async function Page({ searchParams }) {
  if ((await searchParams).logout) {
    const cookieStore = await cookies()
    cookieStore.delete('AUTH_TOKEN')
  }

  return <UserProfile />
}
```

```tsx
// GOOD: Using Server Actions to handle mutations
import { logout } from './actions'

export default function Page() {
  return (
    <>
      <UserProfile />
      <form action={logout}>
        <button type="submit">Logout</button>
      </form>
    </>
  )
}
```

The same argument applies to a Route Handler: a `GET` handler that mutates is a `GET` handler a prefetcher, a link scanner or a corporate proxy will fire on your users' behalf.

## Gotchas

**★ Symptom: `'use server'` inside a Client Component fails to compile.** Cause: the directive must be at the top of a *file* for anything a Client Component imports; an inline action is only legal inside a Server Component. Fix: move it to a dedicated module and import it.

```tsx
// app/posts/actions.ts  — a dedicated file-level 'use server' module
'use server'
export async function deletePostAction(postId: string) { /* ... */ }
```

```tsx
// app/posts/delete-button.tsx
'use client'
import { deletePostAction } from './actions'   // legal — imported, not declared

export function DeleteButton({ id }: { id: string }) {
  return <button onClick={() => deletePostAction(id)}>Delete</button>
}
```

**★ Symptom: a helper you never intended to expose is callable over HTTP.** Cause: in a file-level `'use server'` module, *every export* is an action. A `formatSlug` or `sendEmail` helper exported "just for the tests" gets its own action ID the moment anything references it. Fix: keep the actions file to actions only — do not export anything else from it, and put helpers in a `server-only` module the tests import directly.

```ts
// app/posts/actions.ts
'use server'
import { slugify } from '@/lib/slug'   // imported, not re-exported → no endpoint
export async function createPostAction(fd: FormData) { /* ... */ }
```

```ts
// lib/slug.ts
import 'server-only'
export function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, '-') }
```

**★ Symptom: calling an action from an event handler does nothing, or React warns about an update outside a transition.** Cause: outside a form, the dispatcher expects a transition. Fix: wrap the call in `startTransition`, or route it through `useActionState`'s returned dispatcher.

```tsx
'use client'
import { startTransition } from 'react'
import { deletePostAction } from './actions'

export function DeleteButton({ id }: { id: string }) {
  return (
    <button onClick={() => startTransition(() => deletePostAction(id))}>
      Delete
    </button>
  )
}
```

**Symptom: a form works in dev and does nothing when clicked on a slow production connection before hydration.** Cause: the mutation is wired through `onClick` (door 3) rather than the form's `action` prop (door 1), so it depends on a dispatcher that has not arrived, and there is nothing to replay. Fix: put the action on the form and drive it through `useActionState`, which *"will also automatically replay form submissions entered before hydration finishes."*

```tsx
// depends on hydration
<button onClick={() => startTransition(() => createPostAction(fd))}>Create</button>

// submits as a plain HTML POST before hydration, then upgrades
<form action={createPostAction}>
  <input name="title" />
  <button>Create</button>
</form>
```

**Symptom: a `?logout=1` link logs the user out when a link prefetcher or antivirus proxy touches it.** Cause: the mutation lives in render, driven by `searchParams`. Fix: move it into an action behind a POST, as the documented BAD/GOOD pair above shows.

## Interview questions

**★ Why is `'use server'` better described as "publish this function" than "run this on the server"?**
Because running on the server is not what the directive achieves — a Server Component already runs on the server, and a plain imported module already stays there. What `'use server'` does is create a *client-invocable reference* to a server function: the compiler strips the body from client bundles and replaces it with an action ID and a dispatcher that POSTs to the page's own URL. That reference is what makes the function reachable from the browser, and the docs say the route is reachable *"to anyone who can send the same POST."* So the directive widens the attack surface rather than narrowing it. The directive that narrows it is `import 'server-only'`, which turns a client import of the module into a build error.

**★ If action implementations never reach the browser, what stops an attacker from calling one?**
Nothing structural. The implementation stays server-side, but the *address* — the encrypted action ID — is in a bundle every visitor downloads, and the dispatcher shows exactly how to shape the POST. Encryption and ID rotation make the reference opaque and short-lived, not private. That is why the documentation instructs you to *"still treat Server Actions as reachable via direct POST requests and verify authentication and authorization inside each one."* The checks in [02e](02e-authentication-and-authorisation-at-the-entry-point.md) are the actual gate.

**★ An action has no URL of its own. Name three operational consequences.**
First, edge rules are path-based and an action's path is the page's path, so a WAF or CDN rule cannot distinguish "load the dashboard" from "delete a record on the dashboard" without inspecting the method and the body. Second, `proxy.ts` matchers select pages, not actions, so proxy-level filtering is inherently coarse — it can require a session for a whole route subtree but cannot gate one specific mutation. Third, you cannot publish an action to a third party: there is no stable documented URL, and the action ID is a build artefact that rotates. Anything an external caller must reach needs a Route Handler.

**Which of the three invocation doors works before hydration, and what exactly does React guarantee?**
Only door 1 — the form's `action` prop — and it is two distinct guarantees rather than one. With `useActionState`, React *"will also automatically replay form submissions entered before hydration finishes"*, so a submission during the loading window is queued and dispatched once the bundle arrives; that solves the slow-connection case. For genuine no-JavaScript operation you additionally supply the third argument to `useActionState`, the permalink: *"React will redirect to the provided URL if the form is submitted before the JavaScript bundle loads."* `formAction` on a button and a `startTransition` call from an event handler have neither property, because both need the dispatcher. If your product has to work on a first paint over a bad connection — a checkout, a login, a "mark as read" on a news site — that pushes you to form-shaped mutations, and it is a design constraint, not a style preference.

**Why does Next.js refuse to let you set a cookie or revalidate during render?**
Because render is not guaranteed to happen exactly once per user intent — it can be re-run, prefetched, streamed, or resumed — so a mutation placed there fires at times nobody asked for. The documentation states the framework *"explicitly prevents setting cookies or triggering cache revalidation within render methods to avoid unintended side effects."* Pushing mutations into actions also forces them onto `POST`, which the docs note *"prevents accidental side-effects from GET requests, reducing Cross-Site Request Forgery (CSRF) risks."* The same reasoning applies to Route Handlers you write by hand: a mutating `GET` will eventually be fired by something that was only trying to look.

---

← [02 · Hybrid API design](02-hybrid-api-design-route-handlers-and-server-actions-side-by.md) · Next → [02c · Closures, action IDs and deploys](02c-closures-action-ids-and-deploys.md)
