---
title: "01 · The History API"
sidebar_label: "01 · The History API"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History), [`History.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState), [`History.replaceState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState), [`Window: popstate` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event), [`History.scrollRestoration`](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration), [`Window: hashchange` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event), [Working with the History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API). Documentation-validated; **no timings and no console output**.

The History API lets a page **change the URL without a navigation**. That is all it does — no
fetching, no rendering, no route matching. Everything a router does around it is yours to write,
and the parts people get wrong are the browser's contract: the back button, the state object and
the scroll position.

## The four calls

```js
history.pushState(state, '', '/products/42');      // add an entry
history.replaceState(state, '', '/products/42');   // rewrite the current entry
history.back();  history.forward();  history.go(-2);
history.length;  history.state;
```

**The second argument is the title, and it is ignored.** Every browser ignores it; pass an empty
string. Set `document.title` yourself — a router that does not is a router that reads out the
wrong page name to a screen reader.

| Call | Use it for |
|---|---|
| `pushState` | a navigation the user should be able to go **back** from |
| `replaceState` | a URL correction the user should **not** have to go back through — a filter change, a redirect, a canonicalised path |

🔴 **The distinction is a UX decision, not a technical one.** Every keystroke in a search box
pushed as an entry means twenty presses of Back to leave the page. Debounce and `replaceState`
for the intermediate states; `pushState` when the user commits.

⚠️ **The URL must be same-origin.** A cross-origin argument throws a `SecurityError` — the API
changes the address bar, so allowing otherwise would be a phishing primitive. Relative paths
resolve against the current URL, and building the target with `new URL()` avoids a whole class of
mistakes ([Phase 11 · 04 · 01 · The URL object](../../phase-11-network-storage/04-url-and-searchparams/01-the-url-object.md)).

**Browsers rate-limit rapid calls.** Pushing on every `mousemove` or every keystroke will, in
some browsers, start being ignored or logged as an error. Another reason to debounce.

## `popstate`: what it does and does not fire for

```js
window.addEventListener('popstate', (event) => {
  render(event.state ?? readStateFromUrl(location));
});
```

🔴 **`popstate` does not fire when you call `pushState` or `replaceState`.** It fires when the
user moves through history — Back, Forward, a gesture, `history.go()`. This trips everyone once:
your own navigation must call the render function directly, and `popstate` handles only the
browser's.

```js
function navigate(url, state) {
  history.pushState(state, '', url);
  render(state);                        // 🔴 you must do this; no event will
}
```

**`event.state` is whatever you pushed**, structured-cloned. It is `null` for an entry created by
a normal page load, so always have a path that derives the view from the URL alone.

⚠️ **A fragment-only change fires `hashchange`, not `popstate`** — and `pushState` with a
different hash does neither. If a router supports in-page anchors it needs both listeners, or it
needs to stop using the hash for state.

## The state object: small, cloneable, and persisted

The state goes through the **structured clone algorithm**, so the rules from
[07 · 02 · The message boundary](../07-web-workers/02-the-message-boundary.md) apply exactly:
functions and DOM nodes throw, class instances arrive as plain objects, `Map` and `Date` survive.

🔴 **Keep it small — hundreds of bytes, not megabytes.** The browser writes it to disk for
session restore, and engines impose their own size limits (Firefox documents one; others degrade
quietly). The state object is for **restoring a view**, not for caching data:

| ✅ Belongs in state | ❌ Does not |
|---|---|
| a scroll position, an id, a tab index | the fetched product list |
| "this entry was a modal over the list" | a rendered HTML string |
| a form's dirty values, if small | anything you can re-fetch or recompute |

**The URL is the real state.** Anything a user might paste, bookmark or share must be in the URL,
because the state object does not survive being copied out of the address bar.
`URLSearchParams` is the tool ([Phase 11 · 04 · 02](../../phase-11-network-storage/04-url-and-searchparams/02-urlsearchparams.md)).

## Scroll restoration

Browsers restore the scroll position on a history traversal automatically. For a client-side
router that restores content asynchronously, that automatic behaviour lands **before** the content
exists, so the page ends up at the top — or worse, halfway.

```js
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
```

Then you own it, and the shape is: record the position before leaving, restore it after the new
view has rendered.

```js
// leaving: stash against the entry you are about to leave
history.replaceState({ ...history.state, scroll: window.scrollY }, '');

// arriving via popstate: restore after render, in a frame callback
window.addEventListener('popstate', async (e) => {
  await render(e.state);
  requestAnimationFrame(() => window.scrollTo(0, e.state?.scroll ?? 0));
});
```

⚠️ **Restore after the content is laid out, not before** — scrolling to 2000 px on an empty page
scrolls to the bottom of nothing ([03 · Timers and frames](../03-timers-and-frames/02-frames.md)).
And `'manual'` is a per-document setting: it applies to the whole session on that document, so set
it once at startup rather than toggling it.

**Forward navigations should go to the top; back navigations should return to where the user
was.** That asymmetry is the entire feature, and it is why the position is stored on the entry
rather than in a module variable — a module variable does not survive a reload, and history does.

## `history.length` and the traps around it

`history.length` counts the entries in the current session, **including entries from other
origins**, and it never goes down. It cannot tell you whether "back" will leave your app.

🔴 **There is no reliable "can I go back within my app" check.** The common workarounds:

- Push a sentinel value into your own states and check `history.state?.appEntry`.
- Compare `document.referrer` at load, which tells you where the *document* came from.
- Give the user a real "Back to products" link, which always works, instead of guessing.

**`history.back()` is not cancellable.** There is no event that lets you stop a traversal in the
classic API — `beforeunload` only fires for real navigations away from the document. Guarding an
unsaved form against the Back button is exactly the gap the Navigation API closes
([03 · What the Navigation API changes](./03-the-navigation-api.md)).

## Gotchas

**Symptom: the view does not update after `pushState`.**
Cause — `popstate` does not fire for your own calls.
Fix — call the render function directly in your `navigate()`; `popstate` is only for the browser's
traversals.

**Symptom: Back has to be pressed twenty times to leave the page.**
Cause — an entry pushed per keystroke or per filter toggle.
Fix — `replaceState` for intermediate states, `pushState` only when the user commits.

**Symptom: a `SecurityError` on `pushState`.**
Cause — a cross-origin URL.
Fix — same-origin only; use a real navigation (`location.assign`) to leave the origin.

**Symptom: the state object is empty after a reload.**
Cause — a normal load creates an entry with `state === null`.
Fix — always be able to derive the view from the URL; treat state as an optimisation.

**Symptom: back returns to the top of a long list instead of the item.**
Cause — the browser restored scroll before the async content rendered.
Fix — `history.scrollRestoration = 'manual'`, store the position on the entry, restore in a frame
callback after render.

**Symptom: `pushState` silently stops working.**
Cause — the browser is rate-limiting rapid calls.
Fix — debounce; do not push on pointer or input events.

**Symptom: `history.length` says 1 but Back leaves the site.**
Cause — it counts cross-origin entries too and cannot be used for that decision.
Fix — mark your own entries in their state, or ship an explicit in-app back link.

## Interview questions

**★ When does `popstate` fire?**
On a history traversal — Back, Forward, a gesture, `history.go()`. **Not** on your own `pushState`
or `replaceState` calls, which is why a router must call its render function itself.

**★ `pushState` versus `replaceState`?**
`pushState` adds an entry the user can come back from; `replaceState` rewrites the current one.
Use replace for intermediate or corrected URLs — filters, debounced search — so the Back button
stays useful.

**★ What can go in the state object, and how much?**
Anything structured-cloneable, and as little as possible. It is persisted for session restore and
engines cap its size. Put restoration hints there — scroll offset, selected id — and put anything
shareable in the URL.

**★ Why do client-side routers set `scrollRestoration = 'manual'`?**
Because the automatic restoration happens before asynchronously-rendered content exists, so it
lands in the wrong place. Manual mode lets the router store the offset on the history entry and
restore it after the view has laid out.

**★ How do you know whether Back will stay inside your app?**
You cannot, reliably — `history.length` includes other origins and never decreases. Mark your own
entries in their state, or provide an explicit in-app link instead of a synthetic Back.

**Can you prevent the user from navigating back?**
Not with the classic API — a traversal is not cancellable and `beforeunload` does not cover it.
The Navigation API's `navigate` event is the first mechanism that can intercept it.

---

[Topic index](./README.md) · [02 · Building a router](./02-building-a-router.md) →
