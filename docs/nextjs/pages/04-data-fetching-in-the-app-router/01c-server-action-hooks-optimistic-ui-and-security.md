---
title: "The React 19 action hooks give a form pending state, optimistic state and a returned result — and the one thing none of them give you is authorization, which has to be inside the action every single time"
sidebar_label: "01c · Action hooks and security"
sidebar_position: 0.2
description: "useActionState, useFormStatus and useOptimistic with the signatures as installed, a production add-to-cart that holds together, the Server Action security boundary, and the deployment failure mode nobody warns you about."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (docs `lastUpdated` 2026-06-17). Hook export surfaces and type signatures **probed** on the installed packages — `react` **19.2.8**, `react-dom` **19.2.8**, `@types/react` **19.2.18** (`Object.keys` on the package, declarations read from `index.d.ts`).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified and probe-verified; **no sandbox run**.

**Three hooks sit between a Server Action and the user, and each answers a different question: `useActionState` for "what did it return and is it running", `useFormStatus` for "is the form I am inside submitting", `useOptimistic` for "what should the screen say before the server replies". They are ordinary React 19 APIs, not Next.js ones, which is why the two most common bugs are import-shaped: `useFormStatus` comes from `react-dom`, and the dispatch function `useActionState` hands you returns `void`, so awaiting it awaits nothing. Beneath all three sits the fact none of them address — the action is a public POST endpoint, and every check that matters has to run inside it.**

## The hooks, with the signatures as installed

Probed on the packages in this checkout, so these are what the compiler will actually enforce.

**`useActionState`** lives in `react` and returns a **three**-element tuple:

```ts
const [state, dispatch, isPending] = useActionState(action, initialState, permalink?)
// action:   (state: Awaited<State>, payload: Payload) => State | Promise<State>
// dispatch: (payload: Payload) => void      ← returns void, NOT a promise
```

The third element is why a great many components do not need `useFormStatus` at all: if the component that owns the tuple is also the one that renders the pending affordance, `isPending` is already there.

**`useFormStatus`** is exported from **`react-dom`**, not `react` — probing `react` 19.2.8 lists `useActionState` and `useOptimistic` and does not list `useFormStatus`. It reads the enclosing `<form>`'s submission status, which is why it only works from a component rendered *inside* the form rather than from the component that renders it.

**`useOptimistic`** lives in `react` and has two overloads:

```ts
useOptimistic<State>(passthrough: State): [State, (action: State | ((pending: State) => State)) => void]
useOptimistic<State, Action>(passthrough: State, reducer: (state: State, action: Action) => State): [State, (action: Action) => void]
```

The one-argument form accepts either a replacement value or an updater function. The two-argument form takes a payload and folds it through your reducer — prefer it when the optimistic change is a delta the caller already has, because the merge rule then lives in exactly one place.

## A production shape that holds together

```tsx
// app/cart/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export type CartResult = { ok: boolean; error: string | null }

export async function addToCart(_prev: CartResult, formData: FormData): Promise<CartResult> {
  const session = await auth()
  if (!session?.user) return { ok: false, error: 'Please sign in.' }

  const productId = String(formData.get('productId') ?? '')
  const quantity = Number(formData.get('quantity'))
  if (!productId || !Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'Invalid quantity.' }
  }

  const stock = await db.inventory.findUnique({ where: { productId } })
  if (!stock || stock.quantity < quantity) return { ok: false, error: 'Out of stock.' }

  await db.cartItem.upsert({
    where: { userId_productId: { userId: session.user.id, productId } },
    create: { userId: session.user.id, productId, quantity },
    update: { quantity: { increment: quantity } },
  })

  updateTag('cart') // immediate: the re-render in this same response sees the new cart
  return { ok: true, error: null }
}
```

```tsx
// components/AddToCartForm.tsx
'use client'

import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom' // 🔴 react-dom, not react
import { addToCart, type CartResult } from '@/app/cart/actions'

function SubmitButton() {
  const { pending } = useFormStatus() // reads the ENCLOSING form — must be a child of it
  return <button disabled={pending}>{pending ? 'Adding…' : 'Add to Cart'}</button>
}

export function AddToCartForm({ productId, cartCount }: { productId: string; cartCount: number }) {
  const [state, formAction, isPending] = useActionState<CartResult, FormData>(addToCart, {
    ok: false,
    error: null,
  })
  const [optimisticCount, addOptimistic] = useOptimistic(
    cartCount,
    (current: number, delta: number) => current + delta,
  )

  return (
    <form
      action={(formData: FormData) => {
        addOptimistic(Number(formData.get('quantity') ?? 1))
        formAction(formData) // dispatch returns void — there is nothing to await here
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="number" name="quantity" defaultValue={1} min={1} />
      <span aria-live="polite">Cart: {optimisticCount}</span>
      <SubmitButton />
      {state.error && <p role="alert">{state.error}</p>}
      {isPending && <span className="sr-only">Saving…</span>}
    </form>
  )
}
```

Note what the error path does: `useOptimistic` reverts the number on its own, but a silently reverting number is a worse experience than no optimism at all. The visible `role="alert"` paragraph carries the *reason*, and it comes from the action's return value, not from the optimistic layer.

Calling an action outside a form goes through a transition:

```tsx
'use client'
import { startTransition } from 'react'
import { addToCart } from '@/app/cart/actions'

export function QuickAddButton({ productId }: { productId: string }) {
  return (
    <button
      onClick={() => {
        const formData = new FormData()
        formData.set('productId', productId)
        formData.set('quantity', '1')
        startTransition(() => {
          addToCart({ ok: false, error: null }, formData)
        })
      }}
    >
      Quick Add
    </button>
  )
}
```

## The security boundary

An action runs as a POST request against the page that invokes it. **Treat every action as an untrusted entry point.** The framework provides three protections, and they are not a substitute for your own:

- **CSRF check** — the request's `Origin` is compared to the `Host` (or `X-Forwarded-Host`), and mismatches are rejected. Behind a proxy or CDN domain, configure `serverActions.allowedOrigins`.
- **Body size limit** — action requests are capped at **1MB** by default; raise it with `serverActions.bodySizeLimit`.
- **Encrypted action IDs and dead-code elimination** — references are encrypted at build time and unused Server Functions are stripped from client bundles, so they have no public endpoint.

```js
// next.config.js — as the documentation shows it, nested under `experimental`
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
      bodySizeLimit: '2mb',
    },
  },
}
```

Inside every action: **authenticate and authorize** — rendering the form only on an authenticated page is not a boundary, because requests can be sent without going through the UI. **Validate inputs** — `FormData`, query parameters and headers are untrusted. **Constrain return values** — returns are serialized to the client, so shape them to what the UI renders, not raw database records.

The *shape* of the argument matters as much as its validation. A client legitimately tells the server **which** item to act on; it should not supply the row's contents or its ownership:

```ts
'use server'
// Unsafe: no auth, no ownership check. The whole item, including its id, comes
// from the client, so anyone who can POST here can mark any item complete.
export async function completeItemUnsafe(item: Item) {
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}

// Safe: take only the change, derive identity from the session, look up by ownership.
export async function completeItem(itemId: string) {
  const session = await auth()
  if (!session?.user) return
  const item = await db.item.findFirst({ where: { id: itemId, ownerId: session.user.id } })
  if (!item) return
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}
```

Destructive operations may warrant stronger handling — an elevated session check or re-authentication, and a loud failure when those checks miss. With the experimental `authInterrupts` flag enabled you can throw `unauthorized()` and `forbidden()` from `next/navigation` instead of a bare `Error`, and Next.js renders the matching `unauthorized.tsx` / `forbidden.tsx` segment.

## Deployment: action IDs are build artifacts

Each Server Action is identified by an action ID baked into the build. New deployments typically generate new IDs — Next.js rotates them at most every 14 days even when the source is unchanged — so a client still running the previous build can POST an ID that no longer exists. The error surfaces as **"Failed to find Server Action"**.

Three mitigations, all partial: prefer rolling deployments over abrupt cutovers when users are likely to be mid-mutation; keep `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable across instances so action references stay decryptable everywhere; and surface the error in the UI as a retry path rather than a hard failure, so a refresh recovers the user.

## Gotchas

**★ Symptom: `useFormStatus is not a function`, or `pending` is always `false`.** Cause: two different mistakes with the same feel. It is exported from `react-dom`, not `react` — probing the installed 19.2.8 packages, `react` exports `useActionState` and `useOptimistic` but **not** `useFormStatus`. And it reads the *enclosing* form, so calling it in the component that renders `<form>` gives you nothing. Fix: import from `react-dom`, and call it from a child.

```tsx
import { useFormStatus } from 'react-dom'
function SubmitButton() { const { pending } = useFormStatus(); return <button disabled={pending} /> }
```

**★ Symptom: `await formAction(formData)` resolves instantly and the optimistic value snaps back before the server has replied.** Cause: the dispatch returned by `useActionState` is typed `(payload) => void`. Awaiting it awaits `undefined`, so the inline action's transition — the one that owns the optimistic value — ends immediately. Fix: do not await the dispatch. Either drive both from a single inline action that awaits the **server function**, or let `useActionState` own the lifecycle and read `isPending` from its third tuple element. ⚠️ The exact scoping rule for how long an optimistic value survives is React's, and the Next.js pages verified here do not state it; what is certain from the installed type declarations is that there is no promise to await.

```tsx
// If you want to await the result, await the action, not the dispatch:
<form action={async (fd) => { addOptimistic(1); const r = await addToCart(prev, fd); setError(r.error) }}>
```

**★ Symptom: you wired up `useFormStatus` and it duplicated state you already had.** Cause: `useActionState` returns `isPending` as its third element, and half the codebases that reach for `useFormStatus` never destructured it. Fix: use `isPending` when the pending affordance lives in the same component as the tuple; reserve `useFormStatus` for a shared child that has no access to it.

**★ Symptom: an action that is only reachable from an admin-only page turns out to be callable by anyone.** Cause: render-time gating is not a security boundary. The endpoint exists as soon as the function is retained in a client bundle, and a POST does not have to come from your UI. Fix: authenticate and authorize *inside* the action, every time, including for actions you believe nobody can see.

```ts
'use server'
export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (!(await canDelete(session.user, postId))) throw new Error('Forbidden')
  await db.post.delete({ where: { id: postId } })
}
```

**★ Symptom: users hit "Failed to find Server Action" for a few minutes after every deploy.** Cause: action IDs are build artifacts and new deployments generally mint new ones — rotated at most every 14 days even for unchanged source — so a browser on the previous build POSTs an ID the new server cannot resolve. Fix: roll deployments rather than cutting over, keep the encryption key stable across instances, and treat the error in the UI as "retry" rather than "your data was lost".

**★ Symptom: a returned object leaks fields the UI never renders.** Cause: action returns are serialized to the client wholesale; returning a database row ships every column, including ones added to the schema after you wrote the query. Fix: project explicitly at the boundary.

```ts
return { id: post.id, title: post.title }  // not: return post
```

**Symptom: a file upload action fails above roughly a megabyte with no useful message.** Cause: action requests are capped at 1MB by default. Fix: raise `serverActions.bodySizeLimit` for a genuinely larger payload — or, for real uploads, hand the browser a signed URL from a Route Handler ([01d](01d-route-handlers-and-their-caching-model.md)) and keep the action for the metadata write.

**Symptom: passing a class instance, a function or a DOM node to an action fails in a way that reads like a bundler error.** Cause: arguments and return values cross a serialization boundary — the same one RSC props cross. Fix: pass IDs and plain data, and reconstruct on the server.

**Symptom: closure encryption works in development and fails intermittently in production.** Cause: variables captured by an inline action are encrypted, and a multi-instance deployment without a shared `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` cannot decrypt a reference minted by a different instance. Fix: set the key in the deployment environment, identically on every instance.

**Symptom: "we validate with zod, so the action is safe" — and someone completes another user's item.** Cause: schema validation checks shape, not authority. A well-formed `Item` can still name a row the caller does not own. Fix: accept a reference plus the change, derive identity from the session, look up by ownership — the `completeItem` form above.

**Symptom: CSRF rejections in staging behind a proxy, none locally.** Cause: the framework compares `Origin` against `Host` or `X-Forwarded-Host`, and a proxy or CDN domain that does not match is rejected. Fix: list the real origins in `serverActions.allowedOrigins`, wildcards included where a subdomain fans out.

**Symptom: an optimistic value flickers to the new state and back before settling on the new state again.** Cause: the optimistic update and the server's re-rendered payload are two separate commits, and the optimistic scope ended before the payload arrived. Fix: keep the optimistic update and the awaited work inside the same action, so the optimistic value is still owned when the real value lands.

## Interview questions

**★ A Server Action is defined in a file the client never imports. Is its endpoint reachable?**
Only if the function survives into a client bundle. Unused Server Functions are stripped by dead-code elimination and then have no public endpoint. But that is a build-time optimisation, not an access-control mechanism — the moment anything client-side references it, the ID exists and the POST route is live. The correct mental model is that every retained action is a public endpoint and its authorization has to be inside it.

**★ Why does `useFormStatus` live in `react-dom` rather than `react`, and what does that imply about where you can call it?**
It reports the status of a DOM `<form>` submission, which is a DOM-renderer concern rather than a core-React one — probing the installed 19.2.8 packages, `react` exports `useActionState` and `useOptimistic` while `react-dom` exports `useFormStatus`. The practical implication is the one that trips people: it reads the *enclosing* form through context, so it returns nothing useful in the component that renders the form. It has to be a child. That constraint is the feature — it is what lets a shared `SubmitButton` know about whichever form it happens to be inside, with no prop drilling.

**★ A reviewer says "we validate with zod, so the action is safe". What is the counter-argument?**
Schema validation checks shape, not authority. A perfectly valid `{ id: "abc123", completed: true }` may name a row belonging to somebody else. The rule is to accept a reference plus the user's change, derive identity from the session, and look the row up by ownership — `findFirst({ where: { id, ownerId: session.user.id } })`. Validation and authorization answer different questions and you need both.

**★ Your action returns a `User` straight from the ORM. What is wrong with that?**
Return values are serialized to the client, so every column on that row is now in the RSC payload — password hashes, internal flags, soft-delete markers, whatever the schema grew since you wrote the query. The documented rule is to constrain return values to what the UI renders. Projecting the fields explicitly at the boundary also means that adding a column to the table never silently widens what ships to browsers.

**★ Why do deploys cause "Failed to find Server Action" errors, and what do you do about it?**
Each action's identity is a build artifact. A new deployment generally mints new IDs — rotated at most every 14 days even for unchanged source — so a browser still running the previous build POSTs an ID the new server cannot resolve. You cannot eliminate it, only manage it: roll deployments rather than cutting over, keep `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable so references stay decryptable across instances, and make the client treat the error as "retry" rather than "your data was lost".

**When would you use the two-argument form of `useOptimistic` over the one-argument form?**
When the optimistic change is described by a payload rather than by a whole new state. The one-argument overload takes a value or an updater function; the two-argument overload takes a reducer `(state, action) => state` and lets callers pass just the delta. With a reducer the merge rule is written once and every call site becomes `addOptimistic(quantity)` — shorter, and harder to get wrong than repeating an updater closure at three call sites.

**`useOptimistic` reverts automatically on failure. Why is that not enough?**
Because a value that silently returns to its old number tells the user nothing. They saw "Cart: 3", they now see "Cart: 2", and no part of the UI says why. The rollback is a state-consistency mechanism, not an error-reporting one. The action's return value is where the reason lives, so the component needs its own visible error path — a `role="alert"` region fed from `useActionState`'s `state` — in addition to whatever the optimistic layer undoes.

**Three hooks, three questions. Which one do you actually need most often?**
`useActionState`, and often only that. It gives the returned result, the dispatch to bind to `action`, and `isPending` — which covers the pending affordance for any component that owns the form. `useFormStatus` earns its place only when a shared child needs the status of whatever form it lands in. `useOptimistic` earns its place only when a round trip is long enough that the delay is felt and the outcome is predictable enough that guessing is honest. Reaching for all three by default is how a twelve-line form becomes a sixty-line one.

**Your action needs to do three independent writes. Where does the parallelism go?**
Inside the action. The client dispatcher serialises actions, so three dispatches from the browser queue behind one another regardless of how you wrap them. One action that does `await Promise.all([a(), b(), c()])` server-side gets the overlap, does one roundtrip, and produces one consistent re-render — which is also the answer to why the serialisation exists in the first place.

---

← [01b · Server Actions: the model](01b-server-actions-and-mutations.md) · [Chapter 4 overview](01-explanation.md) · Next → [01d · Route Handlers](01d-route-handlers-and-their-caching-model.md)
