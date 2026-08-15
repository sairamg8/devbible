---
title: "02 · Building a router"
sidebar_label: "02 · Building a router"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Working with the History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API), [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern), [`HTMLAnchorElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`Element.focus()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus), [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions), [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion). Documentation-validated; **no timings and no console output**.

A router is four things: **intercept the link**, **match the URL**, **render**, and **put the user
where they should be**. Frameworks give you the first three. The fourth is the one that is
usually missing, and it is the one users notice.

## Intercepting links, correctly

```js
document.addEventListener('click', (event) => {
  const a = event.target.closest('a');
  if (!a) return;

  if (event.defaultPrevented) return;                        // someone else handled it
  if (event.button !== 0) return;                            // not a primary click
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;  // 🔴 new tab, download, etc.
  if (a.target && a.target !== '_self') return;              // opens elsewhere
  if (a.hasAttribute('download') || a.getAttribute('rel')?.includes('external')) return;

  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;                // leaving the app
  if (url.pathname === location.pathname && url.hash) return; // in-page anchor: let it be

  event.preventDefault();
  navigate(url);
});
```

🔴 **Every one of those guards is a bug report waiting to happen if you skip it.** Cmd-click and
middle-click opening a blank tab, downloads that navigate instead, `mailto:` swallowed, an anchor
link that stops scrolling — all are the same missing check. Delegation from `document` is what
makes this work for links rendered later ([Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md)).

⚠️ **Form submissions navigate too.** A `<form method="get">` is a navigation the router must
either intercept the same way or leave alone deliberately.

## Matching

```js
const routes = [
  { pattern: new URLPattern({ pathname: '/products/:id' }), view: () => import('./views/product.js') },
  { pattern: new URLPattern({ pathname: '/products' }),     view: () => import('./views/list.js') },
  { pattern: new URLPattern({ pathname: '/*' }),            view: () => import('./views/not-found.js') },
];

function match(url) {
  for (const route of routes) {
    const result = route.pattern.exec(url);
    if (result) return { route, params: result.pathname.groups };
  }
}
```

`URLPattern` is the platform's own matcher, with named groups and wildcards. **Feature-detect it**
— support is not universal — and fall back to a small regex table where it is missing:

```js
const hasPatterns = typeof URLPattern !== 'undefined';
```

**Order matters, and specific comes first.** The catch-all is last, and it is a *view*, not a
crash: an unmatched URL should render a 404 page inside the app.

**`view: () => import(…)` is the code-splitting seam.** Each route loads its own bundle on
demand, which is the main performance argument for a route table at all
(**Phase 8 · 05 · Dynamic `import()`** *(not written yet)*).

## Rendering, and the race you will hit

Two navigations in flight is normal — a user clicks, waits, clicks something else. Without
cancellation, the slower first response arrives last and renders the wrong page.

```js
let current;   // AbortController for the in-flight navigation

async function navigate(url, { replace = false } = {}) {
  current?.abort();
  const controller = (current = new AbortController());
  const { signal } = controller;

  const found = match(url);
  history[replace ? 'replaceState' : 'pushState']({ key: crypto.randomUUID() }, '', url);

  try {
    const [module, data] = await Promise.all([
      found.route.view(),
      loadData(found, { signal }),
    ]);
    if (signal.aborted) return;              // 🔴 a later navigation won
    render(module, data, found.params);
    afterNavigate(url, found);
  } catch (err) {
    if (err.name !== 'AbortError') renderError(err);
  }
}
```

🔴 **Check `signal.aborted` after every `await`, not only at the start.** An abort that happens
while the fetch is resolving does not unwind your function — the code after the `await` still
runs unless you check. This is the same latest-wins problem as any async UI
([Phase 7 · 11 · Anti-patterns](../../phase-7-async/11-anti-patterns/README.md)).

**Update the URL before or after the data?** Before, if you want the address bar to reflect intent
immediately and a slow route to be shareable mid-load. After, if a failed load should not leave the
user on a URL that shows nothing. Both are defensible; **pick one and be consistent**, because
users press Reload.

## `afterNavigate`: the part that is usually missing

A real navigation resets four things that a client-side one does not. Doing them yourself is the
difference between a router and a broken page.

```js
function afterNavigate(url, found) {
  document.title = found.route.title(found.params);     // 1 · the accessible page name
  announcer.textContent = `${document.title} loaded`;   // 2 · tell assistive tech
  const target = document.querySelector('h1') ?? document.querySelector('main');
  target.setAttribute('tabindex', '-1');                // 3 · move focus into the new view
  target.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
```

| What a real navigation does | What you must do |
|---|---|
| Sets the document title | `document.title = …` |
| Moves focus to the top of the document | focus the new `<h1>` or `<main>`, `tabindex="-1"` |
| Announces the new page to a screen reader | an `aria-live="polite"` region with the new title |
| Resets the scroll position | `scrollTo(0, 0)` forward, restore on back |
| Cancels in-flight requests | your `AbortController` |

🔴 **Focus is the accessibility bug in every hand-rolled router.** Without it, a keyboard or
screen-reader user stays focused on a link that no longer exists, and the next Tab starts from
nowhere. `preventScroll: true` matters because focusing an element scrolls it into view, which
fights your own scroll restoration
([Phase 9 · 15 · 02 · Managing focus](../../phase-9-dom/15-focus-and-accessibility/02-managing-focus.md),
[Phase 9 · 15 · 04 · Live regions](../../phase-9-dom/15-focus-and-accessibility/04-live-regions.md)).

**The live region must already be in the DOM** before you write to it — inserting a region and its
text together is frequently not announced.

## Scroll: forward to the top, back to where they were

Combine with `history.scrollRestoration = 'manual'` from
[01](./01-the-history-api.md#scroll-restoration):

```js
addEventListener('popstate', async (e) => {
  await navigateFromPopstate(e.state);
  requestAnimationFrame(() => scrollTo(0, e.state?.scroll ?? 0));
});
```

Save the offset onto the current entry *before* leaving it — `replaceState` with the current
state plus `scroll: scrollY` — because after `pushState` you can no longer reach the old entry.

## The server half, which is not optional

A client-side route like `/products/42` is a **real URL**. Someone will paste it, bookmark it, or
reload on it, and the server must answer.

| Setup | Requirement |
|---|---|
| SPA fallback | every unmatched path serves `index.html` — Express `app.get('*', …)`, nginx `try_files $uri /index.html` |
| Real 404s | the fallback returns 200 for genuinely missing pages; if that matters, list known routes or render 404 with a proper status from the server |
| Deep-link assets | the fallback must not swallow `/assets/*`, or a missing script silently returns HTML |

⚠️ **"It works in dev and 404s in production" is nearly always this.** The dev server has the
fallback built in and the production one does not.

**A hash router (`/#/products/42`) needs none of that**, which is its only real advantage — the
server never sees the fragment. The costs are ugly URLs, no server-side rendering and worse SEO.
It is the right answer for a static host you do not control, and the wrong one otherwise.

## Prefetching, cheaply

```js
new IntersectionObserver((entries, obs) => {
  for (const e of entries) if (e.isIntersecting) { obs.unobserve(e.target); routeFor(e.target.href)?.view(); }
}).observe(link);
```

Kicking off the route's dynamic import when its link scrolls into view — or on `pointerenter` —
turns most navigations into a render with no wait
([04 · `IntersectionObserver`](../04-intersectionobserver/README.md)). Do it for links, not for
everything, and respect `navigator.connection?.saveData` where it is available.

## Gotchas

**Symptom: Cmd-click opens an empty tab.**
Cause — the click handler intercepted a modified click.
Fix — bail on `metaKey`/`ctrlKey`/`shiftKey`/`altKey`, `button !== 0`, and any `target`.

**Symptom: a download link navigates instead of downloading.**
Cause — the `download` attribute was not checked.
Fix — bail on `download`, `rel="external"` and cross-origin hrefs.

**Symptom: the wrong page renders after clicking twice.**
Cause — the first navigation's data arrived last.
Fix — abort the previous navigation and check `signal.aborted` after every `await`.

**Symptom: screen-reader users are not told the page changed.**
Cause — no title update, no focus move, no live region.
Fix — all three in `afterNavigate`; the live region must pre-exist.

**Symptom: reloading a deep link 404s in production.**
Cause — no SPA fallback on the server.
Fix — serve `index.html` for unmatched paths, while keeping asset paths intact.

**Symptom: back returns to the right page but the wrong scroll position.**
Cause — the offset was stored in a module variable, or restored before render.
Fix — store it on the history entry; restore in a frame callback after rendering.

**Symptom: focusing the new heading jumps the page.**
Cause — `focus()` scrolls the element into view.
Fix — `focus({ preventScroll: true })`, then scroll deliberately.

## Interview questions

**★ What must a click handler check before intercepting a link?**
Primary button, no modifier keys, no `target`, no `download`, same origin, not already
default-prevented, and not a pure in-page fragment. Skipping any of them breaks a behaviour users
rely on.

**★ How do you avoid rendering a stale page when navigations overlap?**
One `AbortController` per navigation: abort the previous, pass the signal into every fetch, and
check `signal.aborted` after each `await` before touching the DOM.

**★ What does a client-side router have to do that the browser does for free?**
Set the title, move focus into the new view, announce the change to assistive technology, reset or
restore scroll, and cancel in-flight work. Focus is the one most often missed and the most damaging.

**★ Why does a deep link 404 in production but not in development?**
The dev server rewrites unmatched paths to `index.html`; production does not until you configure
it. Client-side routes are real URLs the server must answer.

**★ What does `URLPattern` give you over a regex?**
Named groups, wildcards and matching against the whole URL rather than a hand-rolled string. It
needs feature detection, so keep a regex table as the fallback.

**Why prefetch on intersection or hover?**
Because the route's module is a dynamic import; starting it before the click removes the wait
entirely, at the cost of a request that may not be used.

---

← [01 · The History API](./01-the-history-api.md) · [03 · What the Navigation API changes](./03-the-navigation-api.md) →
