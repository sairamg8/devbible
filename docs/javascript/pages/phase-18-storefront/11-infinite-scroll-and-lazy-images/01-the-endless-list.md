---
title: "01 · The endless list"
sidebar_label: "01 · The endless list"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [`IntersectionObserver.rootMargin`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/rootMargin), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`History.scrollRestoration`](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration), [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions), [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams). Documentation-validated; **no timings and no console output**.

A product listing that loads more as you scroll is four lines of `IntersectionObserver` and a
surprising amount of everything else. The observer mechanics live in
[Phase 12 · 04 · `IntersectionObserver`](../../phase-12-browser-platform/04-intersectionobserver/README.md);
this page is the storefront application of them, and the failure modes that come with it.

## The sentinel

```js
const sentinel = document.querySelector('#sentinel');   // an empty element AFTER the list

const io = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) loadNextPage();
}, { rootMargin: '400px 0px' });                        // 🔴 start early, not at the edge

io.observe(sentinel);
```

**Why a sentinel rather than a scroll handler:** the observer fires off the main thread's critical
path, needs no `getBoundingClientRect()` per scroll event, and keeps working when the list is inside
a scrolling container. `rootMargin` is what turns "load when the user hits the bottom" into "load
just before they get there".

⚠️ **Keep the sentinel outside the item list** — if it is the last item, removing or replacing that
item silently unobserves it and the list stops loading with no error.

## The state machine that stops it going wrong

An endless list has exactly four states, and skipping any of them produces a known bug:

```js
let state = 'idle';        // 'idle' | 'loading' | 'error' | 'done'
let cursor = null;
let controller = null;

async function loadNextPage() {
  if (state !== 'idle') return;                 // 🔴 the in-flight guard: the #1 bug
  state = 'loading';
  render();                                     // show the skeleton NOW

  controller?.abort();
  controller = new AbortController();

  try {
    const page = await api.products({ cursor }, { signal: controller.signal });
    append(page.items);
    cursor = page.nextCursor;
    state = cursor ? 'idle' : 'done';           // no cursor = the end
    if (state === 'done') io.unobserve(sentinel);
  } catch (err) {
    if (err.name === 'AbortError') return;      // navigated away — not an error
    state = 'error';                            // 🔴 a retry button, never a silent stop
  }
  render();
}
```

🔴 **Without the in-flight guard the observer fires several times before the first response lands**
— the sentinel is still on screen while the request is running — and you get duplicated pages and
three simultaneous requests. This is the single most common infinite-scroll bug.

🔴 **Paginate by cursor, not by offset.** `?page=3` re-queries by position, so an item inserted or
deleted while the user scrolls shifts everything: rows appear twice or vanish. A cursor
(`?after=<id>`) is stable against inserts, and it is also what makes "load more" idempotent
([07 · Idempotency from the client](../07-idempotency/README.md)).

**The error state is not optional.** A failed page with no visible retry looks exactly like the end
of the catalogue, and the user never knows there is more.

## Infinite scroll is an accessibility and UX decision

🔴 **A "Load more" button is the better default, and infinite scroll is the exception.** Three
concrete reasons, not preferences:

- **The footer becomes unreachable.** Contact details, shipping policy, links — content the user
  cannot get to by scrolling because the list keeps growing.
- **Keyboard and screen-reader users get no signal.** New rows appear with no announcement and no
  place for focus to go.
- **There is nothing to share.** Item 300 has no URL, so a user cannot send it to anyone or come
  back to it.

If it is the right call anyway, these are the mitigations:

```html
<div id="status" role="status" aria-live="polite" class="visually-hidden"></div>
<button id="more">Load more products</button>   <!-- 🔴 the sentinel triggers it; this is the fallback -->
```

- **Announce the outcome** — `status.textContent = '24 more products loaded'` — through a live
  region that was already in the DOM ([Phase 12 · 11 · Accessibility from JavaScript](../../phase-12-browser-platform/11-accessibility-from-javascript/README.md)).
- **Keep a real button** that does the same thing. It is the keyboard path, the no-JS path, and the
  retry affordance.
- **Move the footer content** somewhere reachable, or stop after a few automatic pages and require
  a click for the rest.
- **Update the URL** as the user passes each page boundary (`replaceState` with the cursor), so
  reloading lands somewhere close ([Phase 12 · 08 · The History API](../../phase-12-browser-platform/08-history-and-routing/README.md)).

## Coming back: the scroll restoration problem

The user scrolls to item 200, opens a product, presses Back — and lands at the top of a list that
has one page in it. That is the defining frustration of infinite scroll, and it takes deliberate
work:

- **Persist the loaded cursor and scroll position** when leaving (on `visibilitychange` to hidden,
  per [Phase 12 · 19 · The page lifecycle](../../phase-12-browser-platform/19-visibility-wakelock-battery/01-the-page-lifecycle.md)),
  keyed by the list's query.
- **On return, restore in one step** — render the same number of items *before* scrolling, or the
  browser scrolls to a position the document does not have yet.
- **`history.scrollRestoration = 'manual'`** hands you control; restore after the render, in a frame
  callback.
- **The back/forward cache does this for free** when it applies — `pageshow` with `persisted: true`
  means the DOM and scroll position came back intact, and you should revalidate rather than rebuild.

## Cleaning up

```js
io.disconnect();          // on teardown, route change, or when the list is replaced
controller?.abort();
```

Long lists also cost memory and layout: every appended row stays in the DOM forever. Two ways out —
CSS `content-visibility: auto` to let the browser skip rendering off-screen rows, or genuine
windowing when the list gets very long (**12 · Long lists without freezing**, next in this phase).

## Gotchas

**Symptom: three identical pages load at once.**
Cause — no in-flight guard; the sentinel stays intersecting while the request runs.
Fix — a `loading` state checked at the top of the loader.

**Symptom: items appear twice or disappear as the user scrolls.**
Cause — offset pagination against a changing dataset.
Fix — cursor pagination.

**Symptom: the list stops loading silently partway down.**
Cause — the sentinel was inside the list and got replaced, or a failed request left no error state.
Fix — keep the sentinel outside the list; render an error state with a retry.

**Symptom: users cannot reach the footer.**
Cause — infinite scroll with no stopping point.
Fix — stop after N automatic pages and require a click, or relocate the footer content.

**Symptom: Back returns to the top of a one-page list.**
Cause — no scroll or cursor restoration.
Fix — persist both, restore before scrolling, and use `scrollRestoration = 'manual'`.

**Symptom: it loads endlessly on a fast connection without the user scrolling.**
Cause — a `rootMargin` so large that the next sentinel is already inside it after each append.
Fix — a smaller margin, and re-check state after each append.

**Symptom: requests keep firing after navigating away in an SPA.**
Cause — the observer was never disconnected.
Fix — `disconnect()` and `abort()` in teardown.

## Interview questions

**★ How do you implement infinite scroll without a scroll handler?**
Observe a sentinel element after the list with an `IntersectionObserver` and a `rootMargin` that
starts the fetch before the user reaches the bottom.

**★ What is the most common bug in an infinite list?**
Firing several loads at once, because the sentinel is still intersecting while the first request is
in flight. A `loading` state guard at the top of the loader fixes it.

**★ Why cursor pagination rather than page numbers?**
Because offsets shift when the underlying data changes, so rows duplicate or vanish while the user
scrolls. A cursor is stable against inserts and deletions.

**★ What does infinite scroll cost users?**
The footer, a shareable URL for a deep item, and any signal for keyboard or screen-reader users
unless you add a live region and a real "Load more" button.

**★ Why does Back land at the top of the list, and how do you fix it?**
Because only the first page is re-rendered, so the scroll position does not exist. Persist the
cursor and offset, restore the items before scrolling, and take manual control with
`history.scrollRestoration`.

---

[Topic index](./README.md) · [02 · Images that do not shift](./02-images-that-do-not-shift.md) →
