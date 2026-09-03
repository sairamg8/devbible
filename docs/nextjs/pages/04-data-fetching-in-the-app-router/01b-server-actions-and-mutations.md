---
title: "A Server Action is a public POST endpoint wearing a function call, and the API you choose to invalidate with is what decides whether the user sees their own write in the same response"
sidebar_label: "01b · Server Actions: the model"
sidebar_position: 0.1
description: "How 'use server' compiles to an endpoint, why a form's action prop is where progressive enhancement stops, why one response carries both the return value and re-rendered UI, updateTag versus revalidateTag, and the client's sequential dispatch."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (docs `lastUpdated` 2026-06-17) and [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**A Server Action is a React Server Function invoked through React's action mechanisms — a form's `action` prop, a button's `formAction`, or a client-side transition. The `'use server'` directive tells the compiler to replace the function's body in client bundles with a reference: an action ID plus a dispatcher that POSTs back to the server. Everything on this page follows from that one fact. It reads like a function call and behaves like a route: reachable by anyone who can send the same POST, dispatched one at a time per client, and returning a response that carries both your return value and a freshly rendered RSC payload for the current page — but only if you called the right invalidation API. Calling `revalidateTag` where you needed `updateTag` is the most common reason a mutation "succeeds" and the screen does not change. The hooks, the worked example and the security boundary are on [01c](01c-server-action-hooks-optimistic-ui-and-security.md).**

## What the directive compiles to

```ts
// app/cart/actions.ts
'use server'

export async function addToCart(productId: string, quantity: number) {
  // this body never reaches the browser
}
```

At build time the directive makes the compiler swap the implementation in client bundles for a reference. The implementation stays on the server; the route to reach it does not. Two framework behaviours follow directly:

- **Action references are encrypted** at build time, and unused Server Functions are stripped from client bundles so they have no public endpoint at all.
- **Variables captured by an inline action are encrypted** before being sent to the client. For multi-instance and self-hosted deployments you must set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable key shared across every instance, or one instance cannot decrypt a reference minted by another.

## The `action` prop, and where progressive enhancement stops

Passing a Server Function directly as a form's `action` is the canonical shape: the mutation has a real POST target, so the form is meaningful before React has hydrated.

```tsx
// app/cart/page.tsx — a Server Component; no 'use client' anywhere in this file
import { addToCartFromForm } from './actions'

export default function CartPage() {
  return (
    <form action={addToCartFromForm}>
      <input type="hidden" name="productId" value="sku-42" />
      <input type="number" name="quantity" defaultValue={1} min={1} />
      <button type="submit">Add to Cart</button>
    </form>
  )
}
```

⚠️ **The pages verified for this chunk do not state the progressive-enhancement guarantee in those words**, so treat what follows as reasoning from the compilation model rather than a quoted rule: what can be submitted without JavaScript is a form whose `action` **is** a server-function reference. An inline `async (formData) => { … }` arrow declared inside a Client Component is ordinary client code — before hydration there is nothing in the page able to run it. If a no-JS path matters to you, that form's `action` must be the action itself, and the optimistic layer has to be built around it rather than in front of it.

## One response carries both the data and the UI

This is the mechanism most Server Action write-ups skip, and it explains nearly all "do I need to refetch after a mutation?" confusion. When an action triggers an immediate revalidation, Next.js does the work in **one** HTTP request: it runs the action, then re-renders the current route server-side, and the response contains both pieces in the same Flight stream — the action's return value (consumed by `useActionState`, or the awaited promise) and a newly rendered RSC payload for the current route, which the client commits as a seeded navigation.

A re-render is included in that same response when the action does any of these:

- calls `updateTag` or `revalidatePath`;
- calls `refresh` to refetch the current route's RSC payload;
- mutates cookies through `cookies()` — setting or deleting one automatically re-renders the current page so the UI reflects the new value;
- calls `redirect`, in which case the response navigates the router and streams the destination's payload.

An action that does none of these carries only its return value, and the current route is **not** re-rendered. That is the entire answer to "why is my list stale after a successful create".

## 🔴 Choosing a cache update — `updateTag` is usually the one you meant

This is a correction to essentially every pre-16 write-up, including the one this page replaces. `revalidateTag` and `updateTag` are not synonyms, and the difference is visible to the user.

| API | What it does | Re-render in the action's response? |
|---|---|---|
| `updateTag(tag)` | Immediate expiration of a tag; the next read waits for fresh data. **Server Actions only.** | ✅ yes |
| `revalidateTag(tag)` | Stale-while-revalidate refresh against a cache-life profile; subsequent reads get the stale value while a fresh fetch runs in the background | ❌ no, by design |
| `revalidatePath(path)` | Invalidate by URL path — one route affected, tagging overkill | ✅ yes |
| `refresh()` | Refetch the current route's RSC payload **without** invalidating cached data | ✅ yes |

`updateTag` is what **read-your-own-writes** requires: the user must immediately see their own change. `revalidateTag` with a stale-while-revalidate profile deliberately skips the immediate re-render, so the page reflects the change on a *later* read. Both are correct APIs; only one of them makes the cart badge update on click.

`refresh()` covers the case nothing else does — the view depends on state outside the cache that the action just changed: a row read without a cache directive, a cookie-derived value, an external system's status.

None of these four throw, so an action can call one and still return a value to its caller. `redirect` is the exception: it throws a control-flow exception, so **code after it does not run**. Put revalidation *before* the redirect if the destination needs the fresh data.

```ts
'use server'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function publishPost(id: string) {
  await db.post.update({ where: { id }, data: { published: true } })
  updateTag('posts')          // must come first
  redirect(`/posts/${id}`)    // throws; nothing below this line runs
}
```

## Sequential dispatch, and what it forbids

> *"Next.js dispatches Server Actions one at a time per client."*

Three actions triggered in quick succession queue: the second waits for the first, the third for the second. This keeps the re-rendered server tree consistent with the action result that produced it. A rule follows:

**Do not use `Promise.all` to parallelise Server Actions from the client.** If you need parallel work, do it inside a single Server Action, fetch in parallel from a Server Component ([01](01-explanation.md)), or use a Route Handler for non-mutation requests ([01d](01d-route-handlers-and-their-caching-model.md)). This is a property of the client dispatcher, not of Server Functions in general — server-side, an action runs in its own request and can do anything an async function can do, `Promise.all` included.

```ts
'use server'
export async function saveProfileAndAvatar(fd: FormData) {
  await Promise.all([saveProfile(fd), uploadAvatar(fd)]) // parallel HERE, not on the client
  updateTag('profile')
}
```

## Gotchas

**★ Symptom: the mutation writes to the database, the action returns `{ ok: true }`, and the list on screen does not change.** Cause: the action called nothing that triggers a re-render, so the response carried only the return value. Fix: call the invalidation that matches what changed — and for read-your-own-writes that is `updateTag`, not `revalidateTag`.

```ts
updateTag('cart')        // immediate expiry; the re-render in this response waits for fresh data
// revalidateTag('cart') // stale-while-revalidate; deliberately no re-render in this response
```

**★ Symptom: `revalidateTag` in an action "works, but one interaction late".** Cause: that is exactly its contract with a stale-while-revalidate profile — subsequent reads get the stale value while a fresh fetch happens in the background, and the action's own re-render does not wait for it. Fix: `updateTag` when the user must see their own write immediately; keep `revalidateTag` for fan-out invalidation whose latency nobody notices.

**★ Symptom: the form works perfectly in your browser and does nothing with JavaScript disabled — on the page whose whole point was progressive enhancement.** Cause: the `action` prop is an inline arrow defined in a Client Component, which is client code with no pre-hydration equivalent. Fix: pass the Server Function itself as `action` and move the optimistic work into a child or into `useActionState`'s dispatch.

```tsx
<form action={addToCartFromForm}>{/* posts before hydration */}</form>
// not: <form action={async (fd) => { setOptimistic(); await addToCart(fd) }}>
```

**★ Symptom: `revalidatePath` runs after `redirect` and nothing is invalidated.** Cause: `redirect` throws a control-flow exception, so code after it never executes. Fix: revalidate first, redirect last — as in the `publishPost` example above.

**★ Symptom: three quick clicks feel serialised and the third takes three times as long.** Cause: they *are* serialised — Next.js dispatches Server Actions one at a time per client. Fix: this is by design and not something to defeat. Disable the control while the action is pending, batch the work into a single action, or move a non-mutating request to a Route Handler.

**Symptom: `Promise.all([actionA(), actionB()])` from a Client Component is no faster than awaiting them in sequence.** Cause: same dispatcher, same queue. Fix: one action that does both pieces of work server-side, where `Promise.all` genuinely overlaps.

**Symptom: after mutating a cookie you also called `refresh()`, and the page rendered twice.** Cause: mutating cookies through `cookies()` already re-renders the current page automatically. Fix: drop the explicit call; reach for `refresh()` only when the changed state is *outside* both the cache and the cookie jar.

**Symptom: you reach for `refresh()` after a write and the data is still stale.** Cause: `refresh()` refetches the current route's RSC payload but invalidates **nothing** — a value served from the cache is recomputed from the same cache entry. Fix: if the stale value is cached, invalidate it (`updateTag` / `revalidatePath`); `refresh()` is for state that was never cached.

**Symptom: an action calls `revalidateTag` for a tag no `fetch` in the app ever set.** Cause: tags are attached at the read, not at the write, and the two are usually in different files that drifted apart. Fix: define the tag string once, next to the loader that applies it, and import it into the action — see the tag limits in [01](01-explanation.md).

## Interview questions

**★ Why is `updateTag` and not `revalidateTag` the right call after a mutation the user should see immediately?**
Because of what each does to the action's response. `updateTag` expires the tag immediately, so the route re-render that ships in the same response waits for fresh data — read-your-own-writes. `revalidateTag` with a stale-while-revalidate profile marks the tag for background refresh and deliberately does **not** include a re-render, so the change appears on a later read. If your cart badge updates one click late, you almost certainly chose the second. `updateTag` is also documented as Server-Actions-only, which is itself a hint about its intended use.

**★ Explain what one HTTP request does when a form action calls `updateTag` and then returns a value.**
One roundtrip does four things. The action executes server-side. `updateTag` expires the tag. Next.js re-renders the current route server-side against the now-fresh data. The response carries both the action's return value — consumed by `useActionState` — and a newly rendered RSC payload for the route, which the client commits as a seeded navigation. Your code does not need a follow-up fetch to see the updated UI on the current page. That is why "call the action, then refetch" is a pattern to unlearn.

**★ Why can you not parallelise Server Actions with `Promise.all` from a Client Component?**
Because the client dispatcher sends them one at a time per client: the second waits for the first, the third for the second. The reason is consistency — each action's response carries a re-rendered tree, and overlapping actions would let a stale tree commit after a fresh one. The workaround is to move the parallelism to where it is safe: inside one action, in a Server Component's reads, or into a Route Handler if the request is not a mutation.

**★ Where exactly does progressive enhancement stop?**
At the point where the `action` prop stops being a server-function reference. A form whose action is the Server Function has a real POST target the browser can submit before React hydrates. A form whose action is an inline arrow defined in a Client Component — the shape most optimistic-UI tutorials show — is client code, and before hydration nothing in the page can run it. If the no-JS path matters, the action must be the function, and optimistic behaviour has to be layered around it. Note this follows from the compilation model; the Next.js pages checked for this chunk do not spell it out.

**What is the difference between `refresh()` and `revalidatePath()`?**
`revalidatePath` invalidates cached data for a URL path; the next render of that path recomputes. `refresh()` invalidates nothing — it refetches the current route's RSC payload. You want `refresh()` when the thing that changed was never in the cache to begin with: a value read without a cache directive, an external system's status, a session detail. Reaching for `revalidatePath` there does extra work and may still not pick the change up.

**Why does `redirect` need to come last in an action, when `updateTag` does not?**
`redirect` throws a control-flow exception to unwind the action and hand the router a destination, so nothing after it runs. The other four cache APIs return normally, which is precisely why an action can invalidate *and* return a value to `useActionState`. In practice this means a create-then-navigate action has a fixed shape: write, invalidate, redirect.

**A Server Action is just a function you import. What is the mental model that stops you writing insecure ones?**
That it is a route with a nicer calling convention. The import gives you the illusion of a local call; what actually ships to the browser is an action ID and a dispatcher that POSTs. Anyone who can send that POST reaches the function, without going through your UI, with arguments of their choosing. Once you hold that model, every rule on [01c](01c-server-action-hooks-optimistic-ui-and-security.md) — authorize inside, validate inputs, constrain returns — reads as obvious rather than as ceremony.

---

← [Chapter 4 overview](01-explanation.md) · Next → [01c · Action hooks, optimistic UI and security](01c-server-action-hooks-optimistic-ui-and-security.md)
