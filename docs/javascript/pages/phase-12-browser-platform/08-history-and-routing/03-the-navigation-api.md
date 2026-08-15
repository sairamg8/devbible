---
title: "03 · What the Navigation API changes"
sidebar_label: "03 · The Navigation API"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API), [`Navigation`](https://developer.mozilla.org/en-US/docs/Web/API/Navigation), [`Navigation: navigate` event](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate_event), [`NavigateEvent.intercept()`](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/intercept), [`NavigationHistoryEntry`](https://developer.mozilla.org/en-US/docs/Web/API/NavigationHistoryEntry), [`Navigation.entries()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/entries). Documentation-validated; **no timings and no console output**. ⚠️ **Browser support is uneven and moving** — feature-detect and check MDN's compatibility table before shipping; this page does not claim a support matrix it cannot verify.

The History API tells you a navigation *happened*, after the fact, and only for the half you did
not cause. The Navigation API turns navigation into **one event you can intercept** — including
the Back button — and hands back the things every router had to reimplement badly.

## The shape

```js
navigation.addEventListener('navigate', (event) => {
  if (!event.canIntercept || event.hashChange || event.downloadRequest !== null) return;

  const url = new URL(event.destination.url);
  const found = match(url);
  if (!found) return;                        // let the browser navigate normally

  event.intercept({
    async handler() {
      const [module, data] = await Promise.all([
        found.route.view(),
        loadData(found, { signal: event.signal }),   // 🔴 the signal is provided
      ]);
      render(module, data, found.params);
    },
  });
});
```

🔴 **One listener replaces the entire click-interception block** from
[02 · Building a router](./02-building-a-router.md). Modified clicks, `target`, `download`,
cross-origin links, form submissions and programmatic navigations all arrive here — already
classified — and the guards become properties instead of hand-written checks.

| Instead of checking | The event tells you |
|---|---|
| modifier keys, `target`, `download`, origin | `event.canIntercept` |
| a fragment-only change | `event.hashChange` |
| a form submission | `event.formData` |
| push / replace / reload / **traverse** | `event.navigationType` |
| whether the user did it | `event.userInitiated` |
| a cancellation channel | `event.signal` — aborted if superseded |

## What it actually fixes

**1 · Back and Forward come through the same path.** `event.navigationType === 'traverse'` is a
traversal, handled by the same handler as a click. No separate `popstate` branch, no duplicated
render logic.

**2 · The navigation has a duration.** `intercept({ handler })` keeps the navigation "in progress"
until the handler's promise settles, so the browser knows when the new page is ready. That is
what lets it do focus and scroll for you:

```js
event.intercept({
  handler,
  focusReset: 'after-transition',   // default: focus the new content, as a real navigation does
  scroll: 'after-transition',       // default: restore or reset scroll at the right moment
});
```

🔴 **This is the accessibility fix.** The focus reset and scroll restoration that a hand-rolled
router has to implement — and usually does not — are the defaults here, and they happen *after*
the handler resolves rather than before the content exists. `'manual'` opts out, and
`event.scroll()` triggers it yourself.

**3 · A navigation can be cancelled — including a traversal.** `event.preventDefault()` on a
cancelable navigation is the first honest way to guard unsaved work against the Back button:

```js
navigation.addEventListener('navigate', (event) => {
  if (form.isDirty && event.cancelable && !confirm('Discard changes?')) event.preventDefault();
});
```

⚠️ **Not every navigation is cancelable** — a cross-document traversal in particular may not be.
Check `event.cancelable`, and keep `beforeunload` for leaving the document entirely.

**4 · You can finally ask "can I go back?"**

```js
navigation.canGoBack;      // ❗ what history.length could never tell you
navigation.canGoForward;
navigation.entries();      // YOUR same-origin entries, as objects
navigation.currentEntry;   // with .key, .id, .index, .url, .getState()
```

`history.length` counted other origins and never decreased; `entries()` is the list of *your*
entries, each with a stable `key` you can traverse to directly with `navigation.traverseTo(key)`.
That makes "return to the search results the user came from" a lookup rather than a guess.

## Navigating, and state

```js
navigation.navigate('/products/42', {
  state: { scroll: 0 },
  history: 'push',          // 'push' | 'replace' | 'auto'
  info: { from: 'search' }, // 🔴 transient — reaches the navigate event, not persisted
});

navigation.reload();
navigation.back();  navigation.forward();  navigation.traverseTo(key);
navigation.updateCurrentEntry({ state: { ...state, scroll: scrollY } });
```

**`state` is persisted per entry** and read with `entry.getState()` — the same structured-clone
rules and the same "keep it small" advice as the History API's state object
([01 · The History API](./01-the-history-api.md)).

**`info` is the genuinely new thing**: transient data that reaches the `navigate` event and is not
stored. It is how a router knows *how* a navigation was started — "this came from the search box",
"this is a prefetch commit", "animate this one" — without smuggling it into the URL or a module
variable.

**Every `navigate()` and `back()` returns two promises**: `{ committed, finished }`. `committed`
resolves when the URL and history entry are updated; `finished` when your handler has settled.
`await navigation.navigate(url).finished` is a real answer to "is the new page ready".

## The other events

| Event | Fires |
|---|---|
| `navigate` | before it happens — intercept or cancel here |
| `navigatesuccess` | the handler resolved |
| `navigateerror` | the handler rejected — the place for a global route-error UI |
| `currententrychange` | the current entry changed, including `updateCurrentEntry` |

`navigation.transition` describes an in-flight navigation (`navigationType`, `from`, `finished`),
which is what a progress bar or a view transition hooks into.

## Adopting it without betting on it

⚠️ **Support is not universal and you must check it yourself** — MDN's compatibility table is the
source, not this page. The practical approach is a small abstraction with two implementations:

```js
if ('navigation' in window) {
  navigation.addEventListener('navigate', handleNavigate);
} else {
  document.addEventListener('click', interceptLinks);     // the chunk-02 router
  addEventListener('popstate', handlePopstate);
}
```

**Both paths call the same `render()`**, and the fallback keeps its own focus/scroll handling
because it has to. That is more code than either alone, and it is why most teams take the API
through a framework's router rather than directly.

**It does not replace `history` for everything.** `location`, `document.referrer`, `beforeunload`
and cross-document navigation are unchanged; the Navigation API governs navigations *this*
document participates in.

## Gotchas

**Symptom: `navigation is not defined`.**
Cause — the engine does not implement it.
Fix — `'navigation' in window`, with the History-API router as the fallback path.

**Symptom: intercepting breaks downloads or external links.**
Cause — intercepting without checking `canIntercept` and `downloadRequest`.
Fix — return early when `canIntercept` is false, on `hashChange`, and on download requests.

**Symptom: focus and scroll behave oddly after adopting `intercept`.**
Cause — the router still does its own focus/scroll while the API is also doing it.
Fix — pick one: keep the defaults and delete the manual code, or pass `'manual'` for both.

**Symptom: `preventDefault()` does nothing for a Back press.**
Cause — that navigation was not cancelable.
Fix — check `event.cancelable`; some cross-document traversals cannot be blocked.

**Symptom: `info` is missing after a reload.**
Cause — it is deliberately transient and never persisted.
Fix — anything that must survive belongs in `state` or the URL.

**Symptom: a slow route leaves the UI with no feedback.**
Cause — the handler's promise is pending and nothing shows it.
Fix — render a pending state at the top of the handler, or drive a progress bar from
`navigation.transition`.

## Interview questions

**★ What does the Navigation API give you that `pushState` + `popstate` does not?**
One `navigate` event for every navigation — clicks, form submissions, programmatic calls and
**traversals** — with `intercept({handler})` so the navigation has a duration. That duration is
what lets the browser reset focus and restore scroll correctly, and it makes Back cancellable.

**★ How does it improve accessibility?**
`focusReset` and `scroll` default to doing what a real navigation does, after the handler
resolves. In a hand-rolled router those are manual steps, and focus management is the one most
often skipped.

**★ What is `info`, and why not use `state`?**
`info` is transient data delivered to the `navigate` event and never persisted — the origin of a
navigation, an animation hint. `state` is stored on the entry and survives reloads, so it is for
restoration data only.

**★ How do you answer "can the user go back within my app"?**
`navigation.canGoBack`, or by inspecting `navigation.entries()` — your own same-origin entries,
each with a stable `key` you can `traverseTo`. The History API could not answer it at all.

**★ Would you adopt it directly today?**
Behind a feature check, with the History-API router as the fallback — or through a framework
router that already does both. Support is uneven enough that a single-path implementation is a
bet, and MDN's compatibility table is the thing to read before making it.

**What are `committed` and `finished`?**
The two promises returned by a navigation: `committed` when the URL and entry are updated,
`finished` when the intercept handler settles.

---

← [02 · Building a router](./02-building-a-router.md) · [Topic index](./README.md)
