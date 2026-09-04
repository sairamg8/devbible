---
title: "useRouter is the escape hatch for navigations with no element to click, and its refresh() is narrower than its name — it clears the client cache and preserves your React state, and leaves the server cache untouched"
sidebar_label: "04e · useRouter"
sidebar_position: 143
description: "The whole App Router useRouter surface, what refresh() does and does not invalidate, bfcacheId and state across navigations, the next/router migration including the router.events replacement, and the javascript: URL warning."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) reference (`lastUpdated: 2026-07-01`), [How to handle redirects](https://nextjs.org/docs/app/guides/redirecting) (`lastUpdated: 2026-08-25`) and the [Prefetching guide](https://nextjs.org/docs/app/guides/prefetching) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · `useRouter` from `next/navigation` since **v13.0.0**, `onInvalidate` since **v15.4.0**. Documentation-verified — **no sandbox run**.

**`useRouter` is not the general-purpose navigation API; it is the one you use when there is no element for the user to click. After a mutation resolves, on a keyboard shortcut, on a poll that finds a job finished — those have no anchor, so they get the hook. Everything else gets [`<Link>`](04-navigation-mechanics-link-userouter-redirect-notfound.md). Two members of the surface then carry more surprise than the rest: `refresh()`, which clears the *client* cache and deliberately preserves your React state while leaving the *server* cache alone, and `bfcacheId`, which exists to reset state on a fresh navigation while still restoring it on Back — and which the documentation immediately talks you out of using.**

## The surface

Imported from `next/navigation`, **not** `next/router`. It is a Client Component hook.

```tsx title="app/example-client-component.tsx"
'use client'

import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  return (
    <button type="button" onClick={() => router.push('/dashboard')}>
      Dashboard
    </button>
  )
}
```

| Member | What it does |
| --- | --- |
| `push(href, { scroll, transitionTypes })` | Client-side navigation, **adds** a history entry |
| `replace(href, { scroll, transitionTypes })` | Client-side navigation, **no** new history entry |
| `refresh()` | Re-request the current route from the server and merge the new payload |
| `prefetch(href, { onInvalidate })` | Warm a route by hand — [04f](04f-prefetching-by-hand-and-ejecting-from-link.md) |
| `back()` | One step back in the browser's history stack |
| `forward()` | One step forward |
| `bfcacheId` | An opaque per-segment identity string |

`scroll: false` on `push`/`replace` opts out of managed scrolling — see [04b](04b-scroll-behaviour-and-the-navigation-lifecycle.md). `transitionTypes` on both is passed to `React.addTransitionType` inside the navigation Transition, which is how a view transition knows whether this navigation was "forward" or "back"; see [05b · The native View Transitions API](05b-the-native-view-transitions-api.md).

The three genuine reasons to reach for the hook, from the redirects guide's own framing (*"If you need to redirect inside an event handler in a Client Component"*): a navigation after a mutation completes; a command palette or keyboard shortcut, where there is no anchor under the cursor; and a navigation driven by a timer or a poll. In all three there is no element the browser could treat as a link, so nothing is lost by not using one.

## `refresh()` is narrower than it sounds

> *"`router.refresh()`: Refresh the current route. Making a new request to the server, re-fetching data requests, and re-rendering Server Components. The client will merge the updated React Server Component payload without losing unaffected client-side React (e.g. `useState`) or browser state (e.g. scroll position). This clears the Client Cache for the current route, but does **not** invalidate the server-side cache. Use `revalidatePath` or `revalidateTag` to invalidate server-side cached data."*

Three separable facts sit in that paragraph, and mixing them up produces two different bugs.

1. **It preserves client state.** Your `useState`, your scroll position and your uncontrolled inputs survive by design. If you called `refresh()` expecting a reset, you got the opposite of what you asked for.
2. **It clears the Client Cache for this route only.** The in-memory RSC payload cache for the current route. Sibling routes keep theirs.
3. **It does not touch the server cache.** The reference adds the consequence directly: *"`refresh()` could re-produce the same result if fetch requests are cached. Other Request-time APIs like `cookies` and `headers` could also change the response."*

So a `refresh()` over a cached `fetch` legitimately re-runs the render, gets identical data, and changes nothing on screen. That is not a broken refresh; it is a cache doing its job one layer further down.

`revalidatePath` / `revalidateTag` are the server-side half. `refresh()` is the client-side half. A mutation that must show new data usually wants the server-side one, invoked from a Server Action:

```ts title="app/actions.ts"
'use server'

import { revalidateTag } from 'next/cache'

export async function markInvoicePaid(id: string) {
  await db.invoice.update({ where: { id }, data: { paid: true } })
  revalidateTag(`invoice-${id}`) // server cache — this is the half that matters
}
```

## `bfcacheId`

> *"`router.bfcacheId`: An opaque string identifier scoped to the current route segment. It changes when the surrounding segment is freshly created by a push or replace navigation, and stays the same for back/forward navigations, `router.refresh()`, and search-param- or hash-only navigations."*

Under `cacheComponents` the App Router preserves Client Component state across navigations using React's `<Activity>`. Keying a component on `bfcacheId` resets it on a *fresh* navigation while still restoring it on Back:

```tsx title="app/example/page.tsx"
'use client'

import { useRouter } from 'next/navigation'

export default function Page() {
  const { bfcacheId } = useRouter()
  return <form key={bfcacheId}>{/* fields */}</form>
}
```

The docs then talk you out of it:

> *"Instead of `bfcacheId`, prefer resetting state explicitly in an event handler (for example, `onSubmit`) or deriving a key from your data (for example, a draft id from the server). Use `bfcacheId` only as a last resort, like when migrating an existing codebase."*

## Migrating from `next/router`

Four separate changes, and the first one is the only one that produces a clear error:

- the hook is imported from `next/navigation`, not `next/router`;
- *"The `pathname` string has been removed and is replaced by `usePathname()`"*;
- *"The `query` object has been removed and is replaced by `useSearchParams()`"*;
- `router.events` is gone — you compose `usePathname` and `useSearchParams` in an effect instead.

The documented replacement for `router.events`:

```jsx title="app/components/navigation-events.js"
'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavigationEvents() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const url = `${pathname}?${searchParams}`
    console.log(url)
  }, [pathname, searchParams])

  return '...'
}
```

and it must be mounted inside a `Suspense` boundary, because `useSearchParams` *"causes client-side rendering up to the closest `Suspense` boundary during prerendering"*. That whole subject is [04j · `usePathname` and `useSearchParams`](04j-usepathname-and-usesearchparams.md).

## The `javascript:` URL warning

> *"You must not send untrusted or unsanitized URLs to `router.push` or `router.replace`, as this can open your site to cross-site scripting (XSS) vulnerabilities. For example, `javascript:` URLs sent to `router.push` or `router.replace` will be executed in the context of your page."*

This is a real, named vulnerability class, not a style note. A `?returnTo=` parameter that reaches `push` unvalidated is stored XSS with an extra step.

## Gotchas

**★ Symptom: `router.refresh()` runs and the screen shows the same stale numbers.** Cause: `refresh()` clears the Client Cache and re-renders on the server, but *"does not invalidate the server-side cache"* — the `fetch` behind the page is still serving its cached response. Fix: invalidate on the server from a Server Action, and let the action's response update the tree.

```ts title="app/actions.ts"
'use server'

import { revalidateTag } from 'next/cache'

export async function publish(id: string) {
  await db.post.update({ where: { id }, data: { published: true } })
  revalidateTag(`post-${id}`)
}
```

**★ Symptom: `router.refresh()` was supposed to clear the form and it kept every field.** Cause: the reference is explicit that the merge happens *"without losing unaffected client-side React (e.g. `useState`) or browser state (e.g. scroll position)"*. Fix: reset the state yourself — which is also what the `bfcacheId` note recommends over keying on the router.

```tsx
async function onSubmit(data: FormData) {
  await save(data)
  formRef.current?.reset() // explicit, not a side effect of refresh()
  router.refresh()
}
```

**★ Symptom: a `javascript:` URL in your data executes script when a user clicks through.** Cause: `push` accepts any URL string, including a scheme, and the reference warns that `javascript:` URLs will execute in the context of your page. Fix: allow-list the shape before you navigate.

```ts
function safeInternalPath(candidate: string): string {
  // same-origin absolute paths only — never a scheme, never protocol-relative
  return /^\/(?!\/)/.test(candidate) ? candidate : '/'
}

router.push(safeInternalPath(returnTo))
```

**★ Symptom: `useRouter is not a function`, or `router.pathname` is `undefined` after an App Router migration.** Cause: the import came from `next/router`. Fix: the hook moves to `next/navigation`, and `pathname` / `query` / `events` move to separate hooks.

```tsx
'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
```

**★ Symptom: navigating away and back restores a half-filled form the user thought they had abandoned.** Cause: with `cacheComponents`, Client Component state is preserved across navigations via `<Activity>`. Fix: key the component on `router.bfcacheId` so a fresh push resets it while Back still restores it — after reading the caveat, because the docs call this a last resort behind an explicit reset or a data-derived key.

```tsx
const { bfcacheId } = useRouter()
return <form key={bfcacheId}>{/* fields */}</form>
```

**Symptom: `router.back()` leaves the user outside your app.** Cause: `back()` is a history stack operation, not a "go up one level" operation — if the user arrived from a search engine, one step back is the search engine. Fix: navigate to a known parent route instead, and use `back()` only where you put the previous entry there yourself.

```tsx
// 🚩 leaves the app when this was the entry page
<button onClick={() => router.back()}>Back</button>

// ✅ deterministic
<Link href={`/projects/${projectId}`}>Back to project</Link>
```

**Symptom: `useRouter()` throws or returns nothing in a component that renders on the server.** Cause: it is a Client Component hook. Fix: add `'use client'` to the file that calls it, and keep that file as small as possible so the boundary does not swallow the rest of the tree.

**Symptom: a redirect written as `router.push` inside a Server Component's render does nothing.** Cause: `useRouter` does not exist there at all. Fix: the server-side equivalent is `redirect()` — see [04g · `redirect` and `permanentRedirect`](04g-redirect-and-permanentredirect.md).

## Interview questions

**★ Give three concrete navigations where `useRouter` is genuinely the right tool.**
After a mutation completes in a Client Component and you want to move the user on; a keyboard shortcut or a command palette, where there is no anchor under the cursor; and a navigation driven by a timer or a poll, such as sending someone to a job's result page once its status flips. In all three there is no element for the browser to treat as a link, so nothing is lost — which is exactly the test the `<Link>` recommendation implies.

**★ Exactly what does `router.refresh()` invalidate?**
The Client Cache for the current route, and nothing else. It makes a fresh server request, re-renders Server Components, and merges the new RSC payload into the existing tree while preserving unaffected client React state and browser state such as scroll position. It does **not** invalidate the server-side cache — the reference points you at `revalidatePath` or `revalidateTag` for that, and warns that `refresh()` can re-produce the same result when fetch requests are cached.

**★ A user reports that pressing Back after submitting a form restores their old draft. How do you reason about it?**
With `cacheComponents`, the App Router preserves Client Component state across navigations using React's `<Activity>`, so Back genuinely restores the old tree — that is the feature working. If a *fresh* navigation should start clean while Back still restores, key the component on `router.bfcacheId`, which changes on push and replace and holds steady for back/forward, `refresh()` and search-param- or hash-only navigations. The docs prefer you reset explicitly in `onSubmit`, or key off a server-supplied draft id, and treat `bfcacheId` as a migration aid.

**★ Why is passing user-supplied input straight to `router.push` a security bug and not just untidy?**
Because `push` accepts any URL string, including a scheme. The reference states plainly that `javascript:` URLs sent to `router.push` or `router.replace` execute in the context of your page — so a `?returnTo=` parameter that reaches `push` unvalidated is stored XSS with an extra step. Validate that the value is a same-origin absolute path (leading `/`, not `//`) before navigating, and send everything else to a known-safe default.

**What replaced `router.events` in the App Router, and why is the replacement wrapped in `Suspense`?**
A Client Component that reads `usePathname` and `useSearchParams` and runs an effect keyed on both. It needs a `Suspense` boundary because `useSearchParams` causes client-side rendering up to the nearest boundary during prerendering — without one, a static route that mounts the component fails the production build. The documented example mounts it inside `<Suspense fallback={null}>` in the layout for exactly that reason.

---

← [04d · Blocking navigation](04d-blocking-navigation-and-what-it-cannot-see.md) · [Chapter 2 overview](01-explanation.md) · Next → [04f · Prefetching by hand](04f-prefetching-by-hand-and-ejecting-from-link.md)
