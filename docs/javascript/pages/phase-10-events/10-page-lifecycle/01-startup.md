---
title: "01 · Startup"
sidebar_label: "01 · Startup"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`DOMContentLoaded` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event), [`load` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/load_event), [`Document.readyState`](https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState), [`readystatechange` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/readystatechange_event), [`<script>` `defer` and `async`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script). Documentation-validated; **no timings**.

A page has two useful "ready" moments and they are further apart than people assume. Choosing the
wrong one is the difference between a script that runs before its elements exist and one that waits
for a hero image nobody is looking at.

## The two events

| Event | Fires when |
|---|---|
| `DOMContentLoaded` | the HTML is **parsed** and the DOM is built — deferred scripts have run; stylesheets, images and subframes may still be loading |
| `load` (on `window`) | **everything** has finished — images, stylesheets, iframes, fonts requested by the initial parse |

```js
document.addEventListener('DOMContentLoaded', () => init());   // the usual one
window.addEventListener('load', () => measureImages());        // rarely what you want
```

🔴 **Default to `DOMContentLoaded`.** `load` waits for the slowest image on the page, which on a
poor connection can be seconds after the page is usable — and it is why "the app takes ages to
become interactive" bugs so often trace back to initialisation hung off `load`.

Use `load` only when you genuinely need the loaded resources: measuring an image's natural size,
laying out around content whose dimensions are not declared, or capturing a full-page screenshot.

## `readyState`, and the race you did not know you had

If your script runs **after** `DOMContentLoaded` has already fired — a dynamically injected script,
a lazily imported module — the listener never fires, because the event is gone.

```js
document.readyState;    // 'loading' | 'interactive' | 'complete'

function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();                                  // already past it — just run
  }
}
```

| `readyState` | Meaning |
|---|---|
| `'loading'` | still parsing — `DOMContentLoaded` has not fired |
| `'interactive'` | parsing done — corresponds to `DOMContentLoaded` |
| `'complete'` | everything loaded — corresponds to `load` |

📌 This is the whole implementation of the jQuery `$(document).ready()` everyone remembers, and it
is six lines. `readystatechange` also exists as an event, but the `readyState` check plus
`DOMContentLoaded` is clearer.

## `defer` and `async` usually remove the need

The reason most modern code needs no ready handler at all:

| Script | Downloaded | Executed |
|---|---|---|
| plain `<script>` | blocks the parser | immediately, **before** the DOM below it exists |
| `<script defer>` | in parallel | **after parsing, in document order**, just before `DOMContentLoaded` |
| `<script async>` | in parallel | **as soon as it arrives** — order not guaranteed |
| `<script type="module">` | in parallel | deferred by default |

🔴 **`defer` (and `type="module"`) means the DOM is already there when your code runs.** A
`DOMContentLoaded` listener inside a deferred script is redundant — correct, but a no-op wrapper.

⚠️ **`async` is the one to be careful with:** it runs whenever it arrives, possibly before the
element it needs. It suits independent, self-contained scripts (analytics) and nothing that depends
on page structure or on another script.

**The trade-off:** a classic blocking script guarantees ordering at the cost of delaying the
parser; `defer` keeps ordering *and* parses in parallel, and is the right default. `async` buys the
earliest possible execution and gives up both ordering and any assumption about the DOM.

## What to do at startup, and what not to

**Do:** wire delegated listeners ([04 · Event delegation](../04-event-delegation/README.md)), read
saved state, register observers.

**Do not:** measure geometry before styles and fonts have settled — a `getBoundingClientRect()` at
`DOMContentLoaded` can be measured against an unstyled or unfonted layout
([Phase 9 · 13](../../phase-9-dom/13-measuring-elements/README.md)). If you need real geometry,
either wait for `load`, or observe with `ResizeObserver` so you get the corrected value when it
changes.

**Do not do everything at once.** Startup is a single long task if you let it be — the >50 ms
definition from
[Phase 9 · 11 · 02](../../phase-9-dom/11-batching-dom-work/02-not-freezing-the-page.md). Register
what must exist immediately, and defer the rest to an idle callback or the first interaction.

## Restored from the bfcache: `pageshow`

A page can also "start" without any of this, by coming back from the back/forward cache with its
DOM and JavaScript state intact.

```js
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // restored from bfcache — no reload happened, state is already here
    refreshStaleData();
  }
});
```

🔴 **`DOMContentLoaded` and `load` do not fire on a bfcache restore.** Anything you initialise there
will not re-run — which is correct for setup, and wrong for anything time-sensitive like a countdown
or a stale price. That is why `pageshow` with `event.persisted` exists, and it is the mirror of the
`pagehide` half in [02 · Shutdown](./02-shutdown.md).

## Gotchas

**Symptom: the script cannot find an element that is clearly in the HTML.**
Cause — a classic `<script>` in `<head>` runs before the parser has reached the element.
Fix — `defer`, `type="module"`, or move the tag to the end of `<body>`.

**Symptom: a `DOMContentLoaded` listener never fires.**
Cause — the script was loaded after the event had already fired.
Fix — check `document.readyState` first and run immediately when it is past `'loading'`.

**Symptom: the app takes seconds to become interactive on a slow connection.**
Cause — initialisation hung off `window.load`, which waits for every image.
Fix — `DOMContentLoaded`, and load-dependent work separately.

**Symptom: measurements taken at startup are wrong, then right after a moment.**
Cause — measured before fonts or stylesheets settled.
Fix — measure on `load`, or react to the corrected value with a `ResizeObserver`.

**Symptom: two `async` scripts break each other intermittently.**
Cause — `async` execution order is not guaranteed.
Fix — `defer` for anything with a dependency.

**Symptom: a countdown shows a stale value after the user presses Back.**
Cause — the page came from the bfcache, so no startup event fired.
Fix — `pageshow` with `event.persisted`.

## Interview questions

**★ What is the difference between `DOMContentLoaded` and `load`?**
`DOMContentLoaded` fires when the HTML is parsed and the DOM is built; `load` waits for every
subresource — images, stylesheets, iframes. Initialisation belongs on the first; only work that
genuinely needs loaded resources belongs on the second.

**★ How do you run code "on ready" from a script that might load late?**
Check `document.readyState`: attach a `DOMContentLoaded` listener when it is `'loading'`, otherwise
run immediately. A bare listener misses an event that has already fired.

**★ What do `defer` and `async` do, and when is each right?**
Both download in parallel. `defer` executes after parsing, in document order, just before
`DOMContentLoaded` — the sensible default, and it makes ready handlers redundant. `async` executes
as soon as it arrives, in no guaranteed order — suitable only for independent scripts.

**★ Which startup events fire when a page is restored from the bfcache?**
None of them. Use `pageshow` and check `event.persisted`; the DOM and JavaScript state come back
intact, so only time-sensitive data needs refreshing.

**Why is measuring at `DOMContentLoaded` unreliable?**
Stylesheets, fonts and images may not have settled, so geometry can be measured against a layout
that is about to change. Measure at `load`, or observe the element.

---

[Topic index](./README.md) · [02 · Shutdown](./02-shutdown.md) →
