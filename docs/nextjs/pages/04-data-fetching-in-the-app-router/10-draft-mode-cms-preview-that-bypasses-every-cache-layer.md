---
sidebar_position: 10
title: "Draft Mode is a per-request cache bypass wearing a cookie: it turns off the fetch cache, 'use cache', unstable_cache and the ISR response cache for one editor while everyone else keeps the cached page"
sidebar_label: "Draft Mode"
description: "What Draft Mode actually disables, the CMS preview contract, securing the entry route with a shared secret without opening a redirect, reading isEnabled inside a cache scope, and why the exit link must not be a Link."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [How to preview content with Draft Mode in Next.js](https://nextjs.org/docs/app/guides/draft-mode) (docs `lastUpdated` 2026-06-02), [`draftMode`](https://nextjs.org/docs/app/api-reference/functions/draft-mode) (`lastUpdated` 2026-04-15), and [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route).
> Target: **Next.js 16.3.4** (16.3 = Active LTS). Node.js `>= 20.9`. `draftMode` became **async** in `v15.0.0-RC`; introduced in `v13.4.0`.

**Draft Mode looks like a preview feature and is really a caching feature. Setting one cookie turns off every cache layer between the request and your CMS — the fetch cache, `'use cache'` scopes, `unstable_cache`, and the ISR response cache — for that one browser, while every other visitor continues to be served the cached, published page. That framing matters because the two things people get wrong both follow from it: the entry route is an unauthenticated endpoint that hands out a cache-bypass token, and the exit route can be triggered by a prefetch before the editor ever clicks it.**

## What it actually turns off

The purpose Vercel gives it is narrow: let editors see how draft or in-progress content will render on the site, without waiting for revalidation. While an editor is in Draft Mode, cached and pre-rendered content is bypassed and the data is fetched from upstream sources directly. Everyone else keeps being served the cached or pre-rendered version of the same page. One browser gets a different rendering pipeline; the site does not change for anybody else.

The bypass is not one switch. It covers four distinct layers, and knowing all four is what lets you predict where stale content can still come from:

- **The fetch cache.** `fetch()` calls skip the Next.js fetch cache and hit the network directly.
- **`'use cache'` scopes.** Components and functions inside a caching directive re-execute on every request, and their results are not saved to the cache.
- **`unstable_cache`.** Its reads and its writes are bypassed in exactly the same way.
- **The ISR response cache.** The page is excluded from it and is served with `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.

The docs state that this holds however the page would otherwise have been produced — whether it is statically generated, served from cache, or revalidated through ISR, the effect is the same.

Note the fourth bullet in particular: the response carries `private, no-cache, no-store` so no CDN or intermediary caches the draft. Draft Mode is not merely "read fresh" — it is "read fresh and tell everyone downstream not to keep this".

And crucially, the docs promise that your data-fetching code does not have to change at all, provided your CMS serves draft and published content from the same URL. That is the design goal. The page does not know it is previewing. It fetches as it always does, and the framework declines to answer from any cache.

## The contract with the CMS

The guide sets out its assumptions before showing any code, and they are worth reading as a checklist against your own CMS.

It assumes your headless CMS supports configurable preview URLs, which most do. When an editor clicks "Preview", the CMS opens a URL shaped like `/api/draft?secret=XXX&slug=/posts/foo` in a new browser tab — `secret` being a token shared between the CMS and your app, and `slug` being the path to preview. Your Next.js app validates the secret, enables Draft Mode, and redirects the browser to the slug.

The guide is also unusually candid about the HTTP-method compromise built into that flow. `GET` is meant to be a safe, read-only method, and an operation that affects future requests — such as enabling Draft Mode by setting a cookie — properly belongs on `POST`. The entry handler uses `GET` regardless, because the whole CMS preview integration works by opening a URL in a new tab, and a browser tab issues a `GET`. The exit flow, shown in step 4 of the same guide, does use `POST`.

That is a documented deviation from correctness for an integration reason, and it is worth knowing you are making it.

## The entry route, done wrong then done right

The minimal version, which the guide immediately warns about:

```ts filename="app/api/draft/route.ts"
import { draftMode } from 'next/headers'

export async function GET(request: Request) {
  const draft = await draftMode()
  draft.enable()
  return new Response('Draft mode is enabled')
}
```

`draft.enable()` sets a cookie named `__prerender_bypass`. Every subsequent request that carries that cookie skips all four cache layers listed above. And as written, the handler is public: anyone at all who hits `/api/draft` enables Draft Mode for themselves, which is the reason the guide does not stop here.

An unauthenticated cache-bypass endpoint is a denial-of-service primitive: every request from that browser goes to origin and to your CMS, and every response is uncacheable.

The secured version:

```ts filename="app/api/draft/route.ts"
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const slug = searchParams.get('slug')

  // This secret should only be known to this Route Handler and the CMS
  if (secret !== 'MY_SECRET_TOKEN' || !slug) {
    return new Response('Invalid token', { status: 401 })
  }

  // Verify the slug exists in the CMS before enabling Draft Mode
  const post = await getPostBySlug(slug)
  if (!post) {
    return new Response('Invalid slug', { status: 401 })
  }

  const draft = await draftMode()
  draft.enable()

  // Redirect to the path from the fetched post, not from searchParams,
  // to avoid open redirect vulnerabilities
  redirect(post.slug)
}
```

Three defences, and the third is the one most implementations miss.

**The shared secret** gates the endpoint. It belongs in an environment variable, not inline as in the illustrative snippet.

**The slug must exist.** Verifying against the CMS before enabling means a scanner enumerating paths gets a 401, not a cache bypass.

**The redirect target comes from `post.slug`, not from `searchParams`.** The comment carried in the documented snippet says exactly why: taking the path from the fetched post rather than from the query string is what keeps this from being an open redirect. `redirect(slug)` with an attacker-supplied `slug` is an open redirect on an endpoint whose URL, including the secret, editors paste into chat.

## The page does not change

```tsx filename="app/posts/[slug]/page.tsx"
async function getPost(slug: string) {
  const res = await fetch(`https://cms.example.com/posts/${slug}`)
  return res.json()
}

export default async function Page({ params }: PageProps<'/posts/[slug]'>) {
  const { slug } = await params
  const post = await getPost(slug)

  return (
    <main>
      <h1>{post.title}</h1>
      <article>{post.content}</article>
    </main>
  )
}
```

That component has no idea Draft Mode exists, and that is the point. When the Draft Mode cookie is present on the request, the `fetch` above skips the Next.js fetch cache and goes to your CMS for the current draft. When the cookie is absent, the identical request can be served from cache as usual. Same source, two behaviours, decided entirely by a cookie the component never reads.

## The banner, and the exit that must not be a link

```tsx filename="app/preview-banner.tsx"
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

async function exitPreview() {
  'use server'
  const draft = await draftMode()
  draft.disable()
  redirect('/')
}

export async function PreviewBanner() {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return null

  return (
    <aside role="status">
      Preview mode is on.{' '}
      <form action={exitPreview}>
        <button type="submit">Exit preview</button>
      </form>
    </aside>
  )
}
```

The rule that catches everyone concerns how that exit is triggered. If you implement the exit as a `GET` Route Handler rather than the Server Action above, the guide tells you to invoke it from a `<form method="GET">` and not from a `<Link>`. The reason is that Next.js prefetches `<Link>` components by default, so the browser would clear the cookie before the editor ever clicked. Forms are never prefetched — and that is true regardless of the method the form uses.

The `draftMode` reference states the same rule from the other side: if you do call the route from a `<Link>` component, you must pass `prefetch={false}` to stop the cookie being deleted accidentally on prefetch.

Think about the symptom this produces. The editor loads a preview page, sees the banner, and Draft Mode silently switches off the moment the browser prefetches the exit link — before any click. The page they are looking at was rendered in draft mode; the next navigation is not. It reads as "preview randomly stops working".

## Draft Mode inside a cache scope

`isEnabled` is the one runtime read permitted inside a caching directive scope. The reference is precise about the boundary: reading `isEnabled` there is allowed, while other runtime APIs such as `cookies()` and `headers()` remain forbidden inside caching directive scopes even while Draft Mode is active. The exception exists so a cached component can render a preview indicator, not to relax the rules generally.

```tsx filename="app/posts/[slug]/page.tsx"
import { draftMode } from 'next/headers'

async function Post({ slug }: { slug: string }) {
  'use cache'

  const post = await fetch(`https://cms.example.com/posts/${slug}`).then((r) =>
    r.json()
  )
  const { isEnabled } = await draftMode()

  return (
    <article>
      {isEnabled && <p role="status">Draft preview</p>}
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

That works because Draft Mode suspends the cache entirely for the request rather than merely bypassing a lookup. With Draft Mode enabled, every function and component under a caching directive scope re-executes on each request and none of their results are written back to the cache — the docs give the reason as ensuring draft content is always fresh. The directive is effectively inert for that one request.

The toggles, however, are not permitted there. `draftMode().enable()` and `draftMode().disable()` cannot be called inside a caching directive scope; the documented instruction is to toggle Draft Mode from a Route Handler or a Server Action instead. Calling either one inside a caching directive scope throws an error.

## When the CMS has a separate draft endpoint

```tsx filename="app/posts/[slug]/page.tsx"
import { draftMode } from 'next/headers'

async function getPost(slug: string) {
  const { isEnabled } = await draftMode()
  const baseUrl = isEnabled
    ? 'https://cms.example.com/preview'
    : 'https://cms.example.com/published'

  const res = await fetch(`${baseUrl}/posts/${slug}`)
  return res.json()
}
```

The cache bypass still applies to both branches of that ternary; the fork only chooses which upstream to read from. You are not trading the bypass away by branching — you get it either way, and the conditional is purely about the URL.

## The cookie's lifecycle

| Fact | Where it comes from |
| --- | --- |
| The cookie is named `__prerender_bypass` | the `enable()` reference |
| A new bypass cookie value is generated on every `next build`, so that the value cannot be guessed | the `enable()` reference |
| By default the Draft Mode session ends when the browser is closed | the `draftMode` reference |
| Testing Draft Mode locally over HTTP requires the browser to allow third-party cookies and local storage access | the `draftMode` reference |

The rotation on every build is a genuine security property and an operational surprise: **a deployment silently ends every editor's preview session**, because the cookie they hold no longer matches the current build's bypass value.

## Gotchas

**★ Shipping the unsecured entry route from step 1 of the guide.**
`/api/draft` with no secret check hands anyone a cache-bypass cookie. Every subsequent request from that browser goes to origin and to your CMS with `no-store`, which is a cheap denial-of-service primitive against your CMS's rate limits. Gate on a secret and verify the slug exists before calling `enable()`.

**★ Redirecting to the `slug` search parameter instead of the fetched post's path.**
`redirect(slug)` with an attacker-supplied value is an open redirect on a URL editors routinely paste into chat and tickets. The documented code redirects to `post.slug` — the value that came back from the CMS — precisely for this reason.

**★ Putting the exit route behind a `Link`.**
`Link` prefetches by default, so the browser fetches the disable endpoint while the editor is still reading the page. Draft Mode turns off before any click and the preview appears to randomly stop working. Use a form, which is never prefetched whatever method it declares, or — if a link is unavoidable — pass `prefetch={false}`.

**★ Hard-coding the secret in the route file.**
The documented snippet uses a literal `'MY_SECRET_TOKEN'` as an illustration. In a real handler it belongs in an environment variable, and comparing it with `!==` is a timing-sensitive comparison on a shared token — use a constant-time comparison if the token is long-lived and the endpoint is publicly reachable.

**★ Assuming preview sessions survive a deployment.**
A new bypass cookie value is generated each time you run `next build`. Editors mid-review lose Draft Mode on every deploy and have to re-enter through the CMS. That is correct behaviour — the cookie must be unguessable — but it will be reported as a bug unless the team knows.

**★ Calling `draftMode().enable()` from inside a cached component.**
It throws. Only `isEnabled` is readable inside a caching directive scope; the toggles must live in a Route Handler or a Server Action.

**★ Reading `cookies()` inside a cached component because Draft Mode is active.**
Draft Mode does not relax the cache directive's rules. Runtime APIs like `cookies()` and `headers()` stay prohibited inside caching directive scopes even when Draft Mode is on. Only `isEnabled` is special-cased.

**★ Treating `draftMode()` as synchronous.**
It has been an async function since `v15.0.0-RC` and returns a promise. Destructuring `const { isEnabled } = draftMode()` without `await` yields `undefined`, and the banner silently never renders. A codemod exists for the 15 upgrade.

**★ Assuming Draft Mode's cache bypass extends to your own data layer.**
It bypasses the *Next.js* caches — the fetch cache, `'use cache'`, `unstable_cache`, and the ISR response cache. A Redis read in your own code, an ORM query cache, or a CDN in front of your CMS is untouched. If the stale content is coming from one of those, Draft Mode will not help.

**★ Debugging Draft Mode locally over plain HTTP and blaming the code.**
The reference notes it requires the browser to allow third-party cookies and local storage access for local HTTP testing. A browser with strict cookie settings will silently drop `__prerender_bypass` and the feature will appear not to work at all.

## Interview questions

**★ What does Draft Mode disable, exactly?**
Four layers, for the request carrying the cookie: `fetch()` skips the Next.js fetch cache and hits the network; components and functions inside `'use cache'` re-execute and their results are not saved; `unstable_cache` reads and writes are bypassed; and the page is excluded from the ISR response cache and served with `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. It applies whether the page was statically generated, served from cache, or revalidated through ISR.

**★ Why does the recommended entry route verify the slug against the CMS *before* enabling Draft Mode?**
Two reasons. It stops an attacker who has guessed or obtained the secret from enumerating paths to discover what exists — a bad slug returns 401, not a bypass. And it supplies the redirect target: the handler redirects to `post.slug`, the value that came back from the CMS, rather than to the caller-supplied search parameter, which would be an open redirect.

**★ Why must the exit control be a form rather than a link?**
Because `Link` prefetches by default, and a prefetch of the disable endpoint clears the Draft Mode cookie before the editor clicks anything. The docs are explicit that forms are not prefetched no matter which method they use, which is why the guide routes the exit through a form. If a link is unavoidable, it needs `prefetch={false}`.

**★ Which runtime API can you read inside a `'use cache'` scope when Draft Mode is on, and which still cannot you?**
Only `draftMode().isEnabled` is readable. `cookies()` and `headers()` remain prohibited inside caching directive scopes *even when Draft Mode is active*, and calling `enable()` or `disable()` inside such a scope throws. The exception exists so a cached component can render a preview indicator; it is not a general relaxation.

**★ How does a cached component render fresh draft content at all, if it is cached?**
Because Draft Mode suspends the caching rather than just the reads: every function and component under a caching directive scope re-executes on each request and nothing is saved back to the cache. The `'use cache'` directive is effectively inert for that request, which is why the same component code serves both audiences correctly.

**★ Your editors report that preview stops working after every release. Is that a bug?**
No. A new `__prerender_bypass` cookie value is generated on every `next build`, deliberately, so the bypass token cannot be guessed. Existing cookies no longer match the current build, so editors must re-enter preview through the CMS. It is worth documenting for the content team so it is not filed as an incident.

**★ What is the security argument against the naive `/api/draft` handler?**
It is an unauthenticated endpoint that grants a cache bypass. Any caller can obtain the cookie, after which every one of their requests skips the fetch cache, `'use cache'`, `unstable_cache` and the ISR cache, reaching your origin and your CMS directly with a `no-store` response. That is a low-effort denial-of-service against whichever of those has the tightest rate limit.

**★ The CMS serves drafts from a different URL than published content. What changes?**
Only where you read from. Branch the base URL on `isEnabled` inside your data function; everything else stays the same, because the cache bypass applies on both branches of the fork — the conditional decides the upstream, not whether caching is skipped. The page component still does not need to know it is previewing.

---

← [**Project Milestone:** scaffold SprintDesk](06-project-milestone-scaffold-sprintdesk.md) · [Chapter 4 overview](01-explanation.md) · Next → [Backend for Frontend: the API layer](11-backend-for-frontend-route-handlers-as-a-public-api-layer.md)
