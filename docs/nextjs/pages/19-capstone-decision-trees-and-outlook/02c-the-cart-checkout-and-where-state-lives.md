---
title: "Run the storefront's state through SprintDesk's four ownership questions and every answer lands somewhere different — the facets go in the URL for one extra reason, the cart has no clean owner at all, and checkout is the one flow you should stop trying to make static"
sidebar_label: "02c · Cart, checkout and state"
sidebar_position: 22
description: "The four state owners applied to a storefront: shareable and indexable facet URLs, anonymous cart identity, why the cart badge is the single most common destroyer of a prerender, what use cache: private actually forfeits, and why checkout and the order confirmation are correctly dynamic end to end."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 5, 6, 8, 10 and 15 of this book against the Next.js 16.3.4 documentation. It introduces no new framework claims of its own; the storefront is a worked contrast case, not a product.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**SprintDesk's state milestone gives you four owners — the URL, the server cache, a scoped client store, and an optimistic overlay — and four ordered questions that assign each piece of state to one of them. The questions transfer to a storefront without a single edit. The answers do not. Filters land in the URL for the same reason SprintDesk's do plus one the SaaS has no equivalent of; the catalogue rows land in the server cache with a far longer lifetime and a shared audience; the cart lands in the awkward gap between owners because its identity belongs to a person who has not identified themselves; and checkout has no cacheable surface at all, which is a correct answer rather than a failure. This chunk runs the exercise and marks each place the answer diverges.**

## The four questions, unchanged

Straight from [ch8 · 07](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md), asked in order, first `yes` wins:

1. Must it survive a full page reload **and** appear in a link the user pastes to someone else? → **URL**
2. Is it derived from the database, and would two users expect the same value? → **server cache**
3. Is it meaningless outside this mount? → **client store**
4. Does the user need to see the result before the server confirms it? → **optimistic overlay**

## The storefront's state, assigned

| # | State | Owner | Diverges from SprintDesk? |
|---|---|---|---|
| 1 | Facet selections (`?brand=acme&size=42`) | **URL** | same answer, stronger reasons |
| 2 | Sort order | **URL** | same |
| 3 | Page number | **URL** | same |
| 4 | Search query | **URL** | same |
| 5 | Catalogue rows, facet counts | **server cache** | same owner, much longer lifetime, shared readers |
| 6 | Price, stock | **server cache**, short or uncached | SprintDesk has no equivalent |
| 7 | **Cart contents** | **server**, keyed by a cookie the server issues | 🔴 no SprintDesk equivalent |
| 8 | Cart badge count | derived from 7, rendered in a hole | 🔴 the prerender-destroying row |
| 9 | Recently viewed | **client** (`localStorage`) | SprintDesk would put it on the server |
| 10 | Quick-view modal open | **URL** if deep-linkable, else client store | same reasoning as the open card |
| 11 | Filter panel expanded on mobile | **client store** | same |
| 12 | An add-to-cart that has not been confirmed | **optimistic overlay** | same |
| 13 | Checkout form values | **client**, then the server on submit | 🔴 never the URL — see below |

Eleven of thirteen rows are decided by exactly the same reasoning SprintDesk used. Two — rows 7 and 8 — have no SaaS counterpart, and they are the two that decide whether the storefront's architecture works.

## The URL wins for one extra reason here

SprintDesk's argument for putting filters in the URL is reload-safety, back/forward and shareability into Slack. All three hold for a storefront, and then a fourth appears that a login-gated app cannot have: **a facet URL is a public asset**. It is a landing page a search engine can index, a destination an ad can point at, a link a customer sends to a friend, and a row in an analytics report. `?brand=acme&size=42` is not merely convenient state; it is inventory.

That changes what you do when the URL is ugly. On SprintDesk an unreadable query string is a cosmetic complaint. Here it is a decision about what gets indexed and what a canonical tag should point at — the origin constant from [ch12 · 06](../12-seo-metadata-and-accessibility/06-project-milestone-sprintdesk-public-pages-fully-indexed.md) suddenly has far more riding on it, because it feeds `metadataBase`, the canonical, the sitemap and every absolute URL in a JSON-LD payload, and a facet page with a wrong canonical is a page competing with itself.

⚠️ **The corollary is the checkout row.** Never put checkout form values in the URL. They are personal, they end up in logs, referrers and analytics, and every reason the facet URL is an asset is a reason the checkout URL is a liability. Row 13 is the one place the answer to question 1 is "yes it should survive a reload" and the owner is still not the URL — because the second half of question 1, *appear in a link the user pastes*, is a hard no.

## The cart has no clean owner

The cart fails question 1 (nobody shares a cart link), passes question 2 only halfway (it is derived from a database, but two users must emphatically *not* see the same value), and fails question 3 (it must survive a reload and a new tab and a week away). It is server state whose owner is a person who has not logged in.

The identity has to come from a cookie the server issues:

```ts
// lib/cart-identity.ts
import 'server-only'
import { cookies } from 'next/headers'

const CART_COOKIE = 'cart_id'

// Reads only. Called from render paths, which may not write cookies.
export async function readCartId(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null
}

// Writes. Called only from a Server Action or a Route Handler.
export async function ensureCartId(): Promise<string> {
  const jar = await cookies()
  const existing = jar.get(CART_COOKIE)?.value
  if (existing) return existing

  const id = crypto.randomUUID()
  jar.set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return id
}
```

Three properties of that code are load-bearing, and each maps to a rule the book has already argued:

- **The id is generated server-side and the cookie is `httpOnly`.** A cart id the client can send is a cart id the client can guess, and reading another cart is reading someone's shopping and, at checkout, their address. This is the same entry-point rule as SprintDesk's Server Actions: the action re-derives identity rather than trusting a parameter.
- **Reads and writes are separate functions.** Issuing the cookie belongs to a mutation path, not to a render — which is why "add to cart" calls `ensureCartId` and the badge calls `readCartId`.
- **The badge tolerates `null`.** An anonymous visitor with no cart cookie is the *common* case, not an error, and the badge renders `0` rather than triggering a write.

## The cart badge is the most common destroyer of a prerender

This is the single most valuable paragraph in the topic for anyone building this shape. The badge is a number in the header. The header is in the root layout. The badge reads a cookie. Under the previous rendering model, that made every route in the application render at request time — one runtime API call anywhere in the tree and the whole route was dynamic. [ch5 · 03](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md) is the page that ends that rule, and the sentence worth internalising is that reading `cookies()` no longer costs you the page — **it costs you the subtree you put behind a boundary.**

```tsx
// app/layout.tsx — the header is shell, the badge is a hole
import { Suspense } from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Logo />
          <CategoryNav />
          <Suspense fallback={<CartBadgeSkeleton />}>
            <CartBadge />
          </Suspense>
        </header>
        {children}
      </body>
    </html>
  )
}
```

```tsx
// components/cart-badge.tsx — the only thing in the header that reads the request
import 'server-only'
import { readCartId } from '@/lib/cart-identity'

export async function CartBadge() {
  const cartId = await readCartId()
  const count = cartId ? await getCartItemCount(cartId) : 0
  return <span aria-live="polite">{count}</span>
}
```

🔴 **The failure mode is silent and it is a refactor, not a design.** Someone moves the cookie read up into the layout to "avoid prop drilling", or makes the layout `async` to fetch the nav, and the entire catalogue quietly leaves the shell. Nothing errors. The site still works. The hosting bill and the cache hit rate move, and the commit that did it looks like a tidy-up.

## `use cache: private` is not the free fix it appears to be

When the badge is slow, the directive that reads cookies looks like the answer. It is documented for two situations only — you cannot refactor the runtime read out of the cached scope, or a compliance rule forbids the data resting on a server — and [ch5 · 10 · 04](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/04-use-cache-private.md) records what it costs:

> *"Because it reads runtime data, the function executes on every server render and is excluded from static shell generation."*

Read that against what the storefront is trying to buy. You want the badge cheap *and* the page prerendered. `private` gives you a browser-memory cache — nothing stored server-side, gone on reload, no custom cache handler — and takes the scope out of shell generation. It also has two thresholds that quietly decide whether it does anything at all: `stale` must be at least 30 seconds for per-link prefetching to work, and at least 5 minutes for the content to be included in the route's App Shell. A cart badge with a 5-minute `stale` is a cart badge that shows the wrong number after someone adds something.

**So `private` is the right call for a recommendation strip and the wrong call for a cart count**, and the distinction is whether being minutes-stale is acceptable. Recommendations can be; a cart cannot, because the user just changed it themselves. The mechanism for "the user must see their own write" is the optimistic overlay in row 12 plus a server invalidation, not a longer-lived private cache.

## Checkout is dynamic end to end, and that is correct

Run [ch6 · 01d](../06-ssg-isr-and-ssr-strategy/01d-the-decision-procedure-and-when-ssr-is-right.md)'s questions over `/checkout` and it stops at question 1: the route decides access to something, and the whole document differs per reader. There is nothing to prerender, no shell worth building, no crawler that should ever see it. **Stop optimising it and go back to the category page.** That is not resignation; it is the positive case that page makes for request-time rendering, and checkout is the textbook instance.

What checkout does need is the thing SprintDesk needed for its digest email, in a harsher form. Placing an order calls a payment provider, and [ch15 · 04ea](../15-databases-apis-and-full-stack-patterns/04ea-external-effects-and-provider-idempotency.md) is unambiguous about what that means:

> *"There is no ordering of a database transaction and an external call that is safe"*

and about the specific reasoning that loses money:

> *"A timeout and a connection reset are not failures; they are the absence of information."*

The provider's idempotency key is the only mechanism that closes the window, and the property that catches people is that the saved result includes failures — retrying with the same key after a `500` returns the same `500` forever, so a genuine retry of a genuinely failed request needs a *new* key. The full treatment, including the reconciliation fallback for providers with no key, is on that page and this one does not repeat it. The storefront-specific point is only that **checkout is where the SaaS's queue-and-idempotency chapter becomes a revenue control rather than an email deduplication concern.**

## The order confirmation page is the one page you must not cache or prefetch

`/order/[id]` is read once, by one person, ever. It contains an address, a payment summary and a line-item list. Every instinct the rest of this topic has trained — prerender it, tag it, prefetch the link — is wrong here, for two separate reasons.

**Caching it is a cross-customer leak waiting for a mistake.** A shared cache entry keyed by an order id is correct only while the authorization check that gated it stays outside the cached scope. The rule from [ch6 · 01d](../06-ssg-isr-and-ssr-strategy/01d-the-decision-procedure-and-when-ssr-is-right.md) question 1 is categorical: an access check runs at request time and may never live inside a shared cache entry.

**Prefetching it is a side effect, not a preload.** [ch5 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md) records that *"a prefetch counts as that first visit"*, and per-link prefetching costs a server invocation per prefetchable link. A confirmation link that renders order data speculatively — for an order the user may not have finished paying for — is work you did not intend, on data you would not have chosen to touch.

```tsx
// Order history: never prefetch a per-order document.
{orders.map((order) => (
  <Link key={order.id} href={`/order/${order.id}`} prefetch={false}>
    {order.reference}
  </Link>
))}
```

## Gotchas

**★ Symptom: the whole site went from CDN-served to request-time-rendered and no page changed.** Cause: a cookie read moved above a `<Suspense>` boundary in the root layout — usually the cart badge, hoisted during a refactor or absorbed into an `async` layout. Fix: the runtime read goes in a leaf component behind its own boundary, exactly as `CartBadge` is written above; nothing above the boundary may await runtime data.

**★ Symptom: one user sees another user's cart, intermittently, and it is not reproducible.** Cause: cart identity came from something the client supplied — a query parameter, a body field, a non-`httpOnly` cookie — or was cached in a scope shared between requests. Fix: the server issues the id, stores it `httpOnly`, and every read re-derives it from the cookie jar rather than accepting a parameter, as `readCartId` does.

**★ Symptom: adding to cart works and the badge does not change until a hard reload.** Cause: the badge's data was cached in a scope the mutation did not invalidate, or the action returned without invalidating anything. Fix: tag the cart read per cart id and invalidate it in the action, and give the button an optimistic overlay so the number moves before the round trip completes — row 12 exists for exactly this.

**★ Symptom: the badge shows the correct number for the wrong person after a deploy or a scale-up.** Cause: a per-user value ended up in a cache shared across requests or instances. Fix: per-user reads never go in `use cache` or `use cache: remote`; they are a hole, or — if they must be cached — `use cache: private`, which stores nothing server-side at all.

**★ Symptom: `use cache: private` was added to the cart badge and the numbers are now sometimes minutes out of date.** Cause: `private` only participates in prefetching and shell inclusion above documented `stale` thresholds — 30 seconds and 5 minutes respectively — so making it useful requires a staleness a cart cannot tolerate. Fix: leave the badge as an uncached hole. Reserve `private` for values where minutes-stale is fine, such as a recommendation strip.

**★ Symptom: a facet page and the unfiltered category page compete in search results.** Cause: every facet combination is a distinct indexable URL and nothing said which one is canonical. Fix: this is the origin-constant discipline from [ch12 · 06](../12-seo-metadata-and-accessibility/06-project-milestone-sprintdesk-public-pages-fully-indexed.md) applied per route — one canonical per logical page, built from the same constant that feeds `metadataBase` and the sitemap.

**★ Symptom: a customer's postcode appears in an analytics report.** Cause: checkout form state was put in the URL because the team applied "state goes in the URL" as a rule rather than as the answer to a question. Fix: re-ask question 1 in full. The second half — *appears in a link the user pastes to someone else* — is a hard no for anything personal, and query strings travel into logs, referrers and third-party analytics.

**★ Symptom: a customer is charged twice after a network blip at checkout.** Cause: the retry treated a timeout as a failure and re-sent the charge without an idempotency key. Fix: a timeout is an unknown outcome, not a failed one — retry with the *same* provider idempotency key, and reconcile if the provider has none. The full decision table is at [ch15 · 04ea](../15-databases-apis-and-full-stack-patterns/04ea-external-effects-and-provider-idempotency.md).

**★ Symptom: a charge retried with the same idempotency key keeps returning the same error forever.** Cause: the provider saves the result of the first request under that key regardless of whether it succeeded, so a stored `500` is replayed to every subsequent request with that key. Fix: distinguish "retry the unknown outcome" — same key — from "attempt the operation again after a known failure" — new key. Conflating them is why a payment path needs an explicit key lifecycle rather than a generic retry wrapper.

**★ Symptom: server invocations spike on the account page.** Cause: an order-history list of `<Link>` elements pointing at per-order documents, each prefetching, each counting as a first visit. Fix: `prefetch={false}` on per-order links, as shown above; a confirmation or history detail page is read at most once and speculating on it is pure cost.

**★ Symptom: an order confirmation URL opened by a colleague shows the order.** Cause: the page's authorization lives outside the render — a middleware check, or an assumption that the id is unguessable — while the document itself is cacheable. Fix: the ownership check runs at request time, in the component or the data access layer, and may not sit inside a cached scope. An unguessable id is not an authorization mechanism.

**★ Symptom: "recently viewed" causes a flash of wrong content on every product page.** Cause: it was implemented on the server from a cookie, so it is a hole that streams in after the shell — or worse, it was hoisted and took the shell with it. Fix: this is the one row that is genuinely better on the client than SprintDesk's equivalent would be; `localStorage` plus a Client Component costs zero server work, and the flash is confined to a strip nobody is waiting for.

**★ Symptom: the team cannot agree whether the quick-view modal belongs in the URL.** Cause: it is the storefront's version of SprintDesk's open-card argument, and it is settled by the same question rather than by preference. Fix: if a shared link should open the modal — a marketing link to a product preview — it is URL state; if it is a hover-scale convenience destroyed in a second, it is client state. Same shape, different answer, and question 1 says which.

## Interview questions

**★ The four state-ownership questions transfer to a storefront unchanged. Why do the answers not?**
Because the questions ask about the *properties* of a piece of state — shareability, derivation from the database, lifetime relative to a mount, whether the user must see a result before confirmation — and those properties are set by the product, not the framework. On a board, "should a teammate see what you see when you paste this link" is about collaboration inside one tenant. On a storefront the same question is about an indexable, ad-targetable, publicly reachable URL, so it comes back yes more strongly and for a reason the SaaS has no version of. And two rows on a storefront — cart contents and the badge derived from them — have no board equivalent at all, because they are per-visitor server state belonging to someone who never logged in.

**★ Why is the cart badge described as the single most common destroyer of a prerender?**
Because it is the smallest component on the page and it sits in the root layout, so its blast radius is the entire site. It has to read a cookie to know whose cart to count, and a runtime read anywhere above a boundary takes everything below it out of the shell. Under the pre-Cache-Components model that meant every route rendered per request outright; under PPR it means the same thing if the read is not isolated behind its own `<Suspense>` boundary. The reason it happens repeatedly is that the change which causes it never looks dangerous — hoisting a cookie read to avoid prop drilling, or making a layout `async` for an unrelated fetch.

**★ Someone proposes `use cache: private` for the cart badge. What are you actually agreeing to?**
To a cache that stores nothing on your server, lives in one browser's memory, does not survive a reload, cannot be backed by a custom handler, and — the part that matters here — executes on every server render and is excluded from static shell generation. On top of that, it only participates in per-link prefetching if `stale` is at least 30 seconds and only reaches the App Shell if `stale` is at least 5 minutes, so to make it do anything you must accept a staleness a cart cannot survive. It is documented as a last resort for cases where the runtime read cannot be refactored out or compliance forbids server storage. A cart badge is neither. The correct shape is an uncached hole plus an optimistic overlay on the add action.

**★ Why should you deliberately stop trying to optimise checkout?**
Because every property that would make optimisation pay is absent. The document differs per reader, so nothing is shareable; the route decides access to something, so a check must run at request time regardless; no crawler should ever see it; and the traffic share is a small fraction of the site. Time spent making it faster is time not spent on the category and product pages, which carry the traffic, the indexing and the acquisition. Recognising a route as correctly dynamic is a decision, not a concession — it frees the effort budget for the routes where rendering strategy actually moves a number.

**★ What makes the order confirmation page a special case even among dynamic pages?**
Two things that pull in different directions from everything else on the site. It must never be cached, because a shared cache entry for a per-customer document is only safe while the authorization check stays outside the cached scope, and the rule is that access checks run at request time and may not live inside a shared entry. And it must never be prefetched, because a prefetch counts as a first visit and per-link prefetching costs a server invocation per link — so a list of order links speculatively renders private documents nobody asked for. It is the one page where the correct answer to "can we make this faster" is "no, and do not touch it".

**★ Why is a timeout on a payment call not a failure, and what does that change in the code?**
Because a timeout is the absence of information rather than evidence of an outcome: the request may have been received, executed and answered with only the answer lost. Code that catches an error and retries has silently converted "I don't know" into "it didn't happen", which is correct for a rate-limit response and catastrophic for a charge. What it changes is that the retry must carry the provider's idempotency key so the second attempt is recognised as the same operation, and that the key lifecycle needs to be explicit — the provider stores the first result under that key including failures, so replaying an unknown outcome uses the same key while genuinely re-attempting a known failure needs a new one.

**★ A storefront and a SaaS both need "the user must see their own write". Is it the same problem?**
Structurally yes, and the mechanisms are the same: an optimistic overlay for the duration of the transition, plus a server-side invalidation that makes the next read authoritative. The difference is what happens if you get it wrong. On a board, a card that snaps back is a confusing moment for one member of one workspace. In a cart, a number that does not move is the reason someone adds the item twice or leaves. Same problem, same fix, very different cost of the failure — which is why the storefront pays for the overlay on the add-to-cart button and can reasonably skip it on, say, a wishlist toggle.

---

← [02b · Rendering and caching](02b-the-storefronts-rendering-and-caching-decisions.md) · Next → [02d · The two applications side by side](02d-the-two-applications-side-by-side.md)
