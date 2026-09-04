---
title: "redirect() works by throwing, so a try/catch around it swallows the redirect and the page renders on anyway — and the status code it produces is 307, 303 or none at all depending on where you called it and whether JavaScript is available"
sidebar_label: "04g · redirect"
sidebar_position: 145
description: "Why redirect throws NEXT_REDIRECT and must be called outside try/catch, where it is legal to call, redirect versus permanentRedirect and their 307/308/303 status codes, the push-versus-replace default that flips inside Server Actions, and the five redirect mechanisms compared."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [`redirect`](https://nextjs.org/docs/app/api-reference/functions/redirect) reference (`lastUpdated: 2026-07-28`), [`permanentRedirect`](https://nextjs.org/docs/app/api-reference/functions/permanentRedirect) (`lastUpdated: 2026-08-25`) and [How to handle redirects in Next.js](https://nextjs.org/docs/app/guides/redirecting) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · `redirect` since **v13.0.0**. Documentation-verified — **no sandbox run**.

**`redirect()` does not return — it throws. The reference states it twice on the same page, because the failure it prevents is the single most common one in App Router code: a `redirect()` inside a `try` block is caught by your own `catch`, treated as an application error, logged, and swallowed, after which the function keeps going and the page renders as though nothing happened. The second thing worth internalising is that "the status code" is not one number. In a Server Component you get 307, in a progressive-enhancement form submission 303, in a Server Action with JavaScript available no HTTP redirect at all — a client-side navigation instead. Testing a redirect with `curl` and testing it in a browser can legitimately produce different answers.**

## Where you may call it

> *"The `redirect` function allows you to redirect the user to another URL. `redirect` can be used while rendering in Server and Client Components, Route Handlers, and Server Functions."*

| Context | Legal? | Notes |
| --- | --- | --- |
| Server Component, during render | yes | the canonical case |
| Route Handler | yes | call it **outside** any `try` |
| Server Function / Server Action | yes | call it **outside** any `try` |
| Client Component, during render | yes | *"during the rendering process but not in event handlers"* |
| Client Component event handler | **no** | use `useRouter().push` — see [04e](04e-userouter-programmatic-navigation-and-refresh.md) |
| Before rendering starts | n/a | use `next.config.js` `redirects` or `proxy.ts` |

The Client Component rule has a rider worth knowing: *"When using `redirect` in a Client Component on initial page load during Server-Side Rendering (SSR), it will perform a server-side redirect."* So the same call is an HTTP redirect on first load and a client-side navigation afterwards.

```tsx title="components/client-redirect.tsx"
'use client'

import { redirect, usePathname } from 'next/navigation'

export function ClientRedirect() {
  const pathname = usePathname()

  if (pathname.startsWith('/admin') && !pathname.includes('/login')) {
    redirect('/admin/login')
  }

  return <div>Login Page</div>
}
```

## It throws, and that is the whole design

> *"Invoking the `redirect()` function throws a `NEXT_REDIRECT` error and terminates rendering of the route segment in which it was thrown."*

Throwing is what lets it work without a `return`:

> *"`redirect` does not require you to use `return redirect()` as it uses the TypeScript `never` type."*

and it is also what makes it fragile in the presence of a `catch`. The reference says so twice in the Behavior list:

> *"In Server Actions and Route Handlers, redirect should be called **outside** the `try` block when using `try/catch` statements."*
> *"`redirect` throws an error so it should be called **outside** the `try` block when using `try/catch` statements."*

```ts title="app/actions.ts"
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createPost(id: string) {
  try {
    // Call database
  } catch (error) {
    // Handle errors
  }

  revalidatePath('/posts') // Update cached posts
  redirect(`/post/${id}`) // Navigate to the new post page — OUTSIDE the try
}
```

If you genuinely need error handling around the same region of code, `unstable_rethrow` exists to let the framework's control-flow exceptions through your `catch` first — the `notFound` reference names it for the identical problem, and the two functions throw the same *kind* of thing.

## `redirect` versus `permanentRedirect`

They are the same function with a different status code and a different meaning.

| | `redirect` | `permanentRedirect` |
| --- | --- | --- |
| Default HTTP status | **307** Temporary | **308** Permanent |
| Progressive-enhancement form submission | **303** See Other | **303** See Other |
| Server Action with JavaScript available | client-side navigation, no HTTP redirect | client-side navigation, no HTTP redirect |
| Streaming context | a `meta` tag emitted to redirect on the client | a `meta` tag emitted to redirect on the client |
| Documented use | *"Redirect user after a mutation or event"* | *"a mutation or event that changes an entity's canonical URL"* |

> *"When used in a streaming context, this will insert a meta tag to emit the redirect on the client side. In a Server Action, `redirect` performs a client-side navigation when JavaScript is available. For progressive enhancement form submissions, it serves a 303 HTTP redirect response. Otherwise, it serves a 307 HTTP redirect response."*

The documented `permanentRedirect` example is the one that makes the distinction concrete — a username change moves a profile's canonical URL forever:

```ts title="app/actions.ts"
'use server'

import { permanentRedirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'

export async function updateUsername(username: string, formData: FormData) {
  try {
    // Call database
  } catch (error) {
    // Handle errors
  }

  revalidateTag('username', 'max') // Update all references to the username
  permanentRedirect(`/profile/${username}`) // Navigate to the new user profile
}
```

## Why 307 and 308, not 302 and 301

The reference answers this in its own FAQ, and the answer is about request methods rather than about caching:

> *"While traditionally a `302` was used for a temporary redirect, and a `301` for a permanent redirect, many browsers changed the request method of the redirect, from a `POST` to `GET` request when using a `302`, regardless of the origins request method."*

The worked example is the point: a `POST /users` that 302-redirects to `/people` arrives at `/people` as a `GET`, which *"doesn't make sense, as to create a new user, you should be making a `POST` request to `/people`"*.

> *"`302` - Temporary redirect, will change the request method from `POST` to `GET`"*
> *"`307` - Temporary redirect, will preserve the request method as `POST`"*

Server Action form submissions are the deliberate exception:

> *"Server Action form submissions are an exception: they use a `303` response so the browser follows the redirect with a `GET` request. When JavaScript is available, Server Actions perform a client-side navigation instead of an HTTP redirect."*

That is the correct behaviour for a form: after a successful `POST`, you want the browser to `GET` the result page, so a refresh does not resubmit.

⚠️ **What I could not confirm:** neither the Next.js references nor MDN's [308 page](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/308) states how long a browser caches a `permanentRedirect`. MDN describes 308 as indicating the resource *"has been permanently moved to the URL given by the `Location` header"* and that *"the request method and the body will not be modified by the client in the redirected request"* — it says nothing about cache lifetime. Treat a shipped `permanentRedirect` as hard to take back and verify the behaviour of your own clients rather than trusting a number you read somewhere.

## `push` versus `replace`, and the default that flips

Both functions take a second argument:

```ts
import { redirect, RedirectType } from 'next/navigation'

redirect('/redirect-to', RedirectType.replace)
// or
redirect('/redirect-to', RedirectType.push)
```

> *"By default, `redirect` will use `push` (adding a new entry to the browser history stack) in Server Actions and `replace` (replacing the current URL in the browser history stack) everywhere else."*

and the caveat that saves you from writing a line that does nothing:

> *"The `type` parameter has no effect when used in Server Components."*

The flip is deliberate. A Server Action redirect is the *result of something the user did*, so it deserves a history entry they can go back from. A Server Component redirect happened before the user ever saw the origin URL, so pushing an entry would put a page they never viewed into their Back button.

## The five mechanisms, side by side

| API | Purpose | Where | Status Code |
| --- | --- | --- | --- |
| `redirect` | Redirect user after a mutation or event | Server Components, Server Functions, Route Handlers | 307 (Temporary) or 303 (Server Action) |
| `permanentRedirect` | Redirect user after a mutation or event | Server Components, Server Functions, Route Handlers | 308 (Permanent) |
| `useRouter` | Perform a client-side navigation | Event Handlers in Client Components | N/A |
| `redirects` in `next.config.js` | Redirect an incoming request based on a path | `next.config.js` file | 307 (Temporary) or 308 (Permanent) |
| `NextResponse.redirect` | Redirect an incoming request based on a condition | Proxy | Any |

The last two run *before* rendering, which is the reason to choose them: *"If you'd like to redirect before the render process, use `next.config.js` or Proxy."* A known list of moved URLs belongs in `next.config.js`, where it supports path, header, cookie and query matching; a conditional redirect that depends on the request — auth, geography, an experiment bucket — belongs in `proxy.ts`, covered in [07](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md).

## Gotchas

**★ Symptom: your Server Action logs "Error: NEXT_REDIRECT" and the user stays on the page.** Cause: the `redirect()` call is inside a `try` block, so your own `catch` intercepts the control-flow exception the framework throws. Fix: move the call below the `try/catch`.

```ts
// 🚩 the catch eats the redirect and the function continues
export async function createPost(data: FormData) {
  try {
    const id = await db.post.create({ data })
    redirect(`/post/${id}`)
  } catch (error) {
    logger.error(error) // catches NEXT_REDIRECT
  }
}

// ✅
export async function createPost(data: FormData) {
  let id: string
  try {
    id = await db.post.create({ data })
  } catch (error) {
    logger.error(error)
    return { error: 'Could not create post' }
  }
  redirect(`/post/${id}`)
}
```

**★ Symptom: the redirect works but you cannot keep your error handling near the call.** Cause: any `catch` between the throw and the framework swallows it. Fix: rethrow the framework's control-flow errors first with `unstable_rethrow`, then handle your own.

```ts
import { unstable_rethrow } from 'next/navigation'

try {
  await doWork()
  redirect('/done')
} catch (error) {
  unstable_rethrow(error) // lets NEXT_REDIRECT through
  logger.error(error)
}
```

**★ Symptom: a redirect written in an `onClick` does nothing.** Cause: *"`redirect` can be called in Client Components during the rendering process but not in event handlers."* Fix: event handlers use the router.

```tsx
'use client'
import { useRouter } from 'next/navigation'

const router = useRouter()
<button onClick={() => router.push('/dashboard')}>Go</button>
```

**★ Symptom: `curl -I` shows a 303 where you expected 307, or no redirect header at all.** Cause: the status depends on context. A Server Action form submission without JavaScript serves 303; with JavaScript, a Server Action does a client-side navigation and emits no HTTP redirect; in a streaming context the redirect arrives as a `meta` tag. Fix: test the context you actually ship, and do not assert a status code that the docs make conditional.

**★ Symptom: `redirect('/x', RedirectType.push)` in a Server Component changes nothing.** Cause: *"The `type` parameter has no effect when used in Server Components."* Fix: delete the argument — it is a line that looks like a decision and encodes none. If you need a pushed entry, the redirect belongs in a Server Action.

**★ Symptom: a `permanentRedirect` you shipped by mistake keeps sending users to the wrong place after you remove it.** Cause: 308 tells clients the move is permanent. Neither the Next.js docs nor MDN's 308 page states a cache lifetime, so you cannot reason about how long from documentation alone. Fix: default to `redirect` (307), and reach for `permanentRedirect` only when the canonical URL of an entity really has changed forever — a username, a slug, a merged account.

**★ Symptom: TypeScript complains that a variable is possibly `undefined` after a `redirect()` guard.** Cause: the redirect is inside a `try`, so the compiler cannot see it as terminal. Fix: outside a `try`, the `never` return type narrows for you and no `return redirect()` is needed.

```tsx
const team = await fetchTeam(id)
if (!team) {
  redirect('/login')
}
// `team` is defined here — no `return` required
```

**Symptom: a redirect target built from a query parameter sends users to another site.** Cause: *"`redirect` also accepts absolute URLs and can be used to redirect to external links"* — which is a feature, and an open-redirect vector when the path is user-controlled. The references do not attach an XSS warning to `redirect` the way `useRouter` does, so this is a reasoned caution rather than a quoted rule. Fix: validate the shape before you redirect.

```ts
const target = /^\/(?!\/)/.test(returnTo) ? returnTo : '/'
redirect(target)
```

**Symptom: a list of moved URLs implemented as `redirect()` calls in page components adds a server render per hit.** Cause: `redirect()` runs during rendering, so the route is entered before it fires. Fix: a static list of moves belongs in `next.config.js` `redirects`, which runs before the render process and supports path, header, cookie and query matching.

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/about', destination: '/', permanent: true },
      { source: '/blog/:slug', destination: '/news/:slug', permanent: true },
    ]
  },
}

export default nextConfig
```

## Interview questions

**★ Why must `redirect()` be called outside a `try` block?**
Because it works by throwing. Invoking it throws a `NEXT_REDIRECT` error that terminates rendering of the segment and is caught further up by the framework, which turns it into an actual redirect. A `catch` of your own between the two intercepts that control-flow exception, treats it as an application error, and the function then continues past the point where it should have stopped — so the redirect silently does not happen and an error is logged instead. If error handling must wrap the same code, `unstable_rethrow` lets the framework's exceptions through the `catch` first.

**★ What status code does `redirect()` produce?**
It depends on where it ran. In a Server Component or Route Handler, 307 — temporary, and chosen over 302 specifically because 307 preserves the request method where many browsers downgrade a 302 `POST` to a `GET`. In a Server Action form submission without JavaScript, 303, so the browser follows with a `GET` and a refresh does not resubmit. In a Server Action with JavaScript available, no HTTP redirect at all — a client-side navigation. And in a streaming context, a `meta` tag emitted to the client. "307" is only the answer to a question that names its context.

**★ When is `permanentRedirect` the right call, and what makes it risky?**
When an entity's canonical URL has genuinely changed forever — a username, a slug, a merged record — which is the documented example. It is risky because 308 tells clients the move is permanent, and neither the Next.js reference nor MDN's 308 page states a cache lifetime, so you cannot predict from documentation how long a mistake will keep redirecting users after you delete the code. The safe default is `redirect`.

**★ Why does the `push`/`replace` default flip between Server Actions and everywhere else?**
Because the two situations mean different things to the user's history. A Server Action redirect is the outcome of something the user did — submitting a form — so a history entry they can go back from is correct, and `push` is the default there. A Server Component redirect fires before the user ever saw the origin URL; pushing would put a page they never viewed into their Back button, so `replace` is the default. The reference also notes that the `type` parameter has no effect at all in Server Components, which is consistent: there is no meaningful choice to make.

**★ You need to send every request for `/old-docs/*` to `/docs/*`. Where does that go, and why not `redirect()`?**
In `next.config.js` `redirects`, because it runs before the render process — the request never enters a route, so there is no server render to pay for, and it supports path, header, cookie and query matching. `redirect()` inside a page component would require entering the route and rendering far enough to reach the call, once per request. Use `proxy.ts` with `NextResponse.redirect` instead when the decision depends on the request — auth state, geography, an experiment bucket.

**Why does `redirect()` not need a `return` in front of it, and when does that stop being true?**
Because its declared return type is `never`, so TypeScript knows control does not continue past the call and narrows types accordingly — a value checked for `undefined` before the call stays narrowed after it. That stops working the moment the call sits inside a `try`, because the compiler can no longer treat it as terminal for the surrounding block, which is a small extra signal that the call is in the wrong place.

**A teammate tests a redirect with `curl`, sees a 303, and files a bug that the docs say 307. What is going on?**
They tested a Server Action form submission path, which is the documented exception: those serve 303 so the browser follows with a `GET`. The 307 applies to redirects from Server Components and Route Handlers. And if they had tested through a browser with JavaScript enabled, they might have seen no redirect status at all, because Server Actions perform a client-side navigation in that case. The bug is in the test's assumption about context, not in the framework.

---

← [04f · Prefetching by hand](04f-prefetching-by-hand-and-ejecting-from-link.md) · [Chapter 2 overview](01-explanation.md) · Next → [04h · `notFound()`](04h-notfound-and-the-not-found-boundary.md)
