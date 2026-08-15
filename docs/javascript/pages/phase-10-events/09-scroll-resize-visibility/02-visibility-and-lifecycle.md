---
title: "02 · Visibility and background throttling"
sidebar_label: "02 · Visibility and throttling"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [`Document.visibilityState`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState), [`visibilitychange` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event), [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [`Window.requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). Documentation-validated; **no timings**.

"Is anyone looking at this page" is a different question from "is this element on screen", and the
answers come from different APIs. Getting them confused is why a background tab keeps polling and
why an off-screen carousel keeps animating.

## The Page Visibility API

```js
document.visibilityState;   // 'visible' | 'hidden'
document.hidden;            // boolean — the same answer, shorter

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  else resume();
});
```

**`'hidden'`** covers a background tab, a minimised window **and a device screen that has turned
off** — which is the case people forget, and the reason a phone left on a table stops being a
viewer.

⚠️ **`visibilityState` is not "on screen".** A fully visible tab with your element scrolled far out
of view is still `'visible'`. Element-level visibility is `IntersectionObserver`
([01](./01-the-high-frequency-events.md)). Use both: the observer decides whether the element
matters, visibility decides whether the tab does.

## What the browser does to a hidden page

MDN documents the throttling policies, and they are the reason background work quietly stops
being reliable:

- **`requestAnimationFrame` callbacks stop entirely** in background tabs. An animation loop does
  not slow down — it **pauses**, and resumes when the tab returns. Code that measures elapsed time
  by counting frames is wrong the moment a user switches tabs.
- **Timers are throttled**, with a budget-based policy after roughly 30 seconds (10 in Chrome).
  Firefox's documented budget runs from +50 ms to −150 ms per window, with execution time
  subtracted and the budget regenerating at about 10 ms per second.
- **Exempt from throttling:** tabs playing audio, tabs with WebSocket or WebRTC connections, and
  IndexedDB processes.

🔴 **The practical consequence: never drive anything important from a `setInterval` and assume the
interval.** A polling loop in a background tab runs on the browser's schedule, not yours. Compute
elapsed time from `Date.now()` rather than from tick counts, and re-synchronise when the page
becomes visible again.

```js
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshNow();      // catch up on whatever was missed
});
```

## What to do on `hidden`

**Stop work nobody can see:**

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(pollTimer);
    videoPreview.pause();
    stopAnimationLoop();
  } else {
    startPolling();
    resumeAnimationLoop();
  }
});
```

**Save state.** `hidden` is the last moment you are reliably given — a mobile user switching apps
may never generate another event, and the tab can be discarded from memory without warning. The
full comparison against `pagehide`, `beforeunload` and the bfcache belongs to
**10 · Page lifecycle** *(not written yet)*; the rule of thumb here is: **save on `hidden`, not on
unload.**

**Do not** use it to detect cheating in a quiz or to pause a video the user deliberately left
playing in the background. It reports a state, not an intent.

## Visibility, `IntersectionObserver` and `scrollend` together

A realistic "only work when it matters" loop uses all three:

```js
let onScreen = false;

new IntersectionObserver(([entry]) => {
  onScreen = entry.isIntersecting;
  sync();
}, { threshold: 0 }).observe(widget);

document.addEventListener('visibilitychange', sync);

function sync() {
  const shouldRun = onScreen && !document.hidden;
  shouldRun ? start() : stop();
}
```

Each answers a different question — **on screen** and **tab in front** — and the work runs only
when both are true. The alternative, a `scroll` listener plus a polling timer, costs more and gets
the answer less reliably.

## Gotchas

**Symptom: a background tab's animation "catches up" in a burst when refocused.**
Cause — an animation driven by counted frames or by timers, paused and then resumed with a large
computed delta.
Fix — drive animation from timestamps (`requestAnimationFrame`'s argument, or `Date.now()`), and
clamp the delta when the page becomes visible.

**Symptom: polling stops or becomes erratic in a background tab.**
Cause — documented timer throttling.
Fix — expect it. Re-synchronise on `visibilitychange`, and use a server-driven channel (WebSocket,
SSE) when updates genuinely must continue.

**Symptom: state is lost when a mobile user switches apps.**
Cause — the page was hidden and later discarded; no unload event arrived.
Fix — save on `visibilitychange` → `hidden`.

**Symptom: an off-screen carousel keeps animating.**
Cause — the tab is visible, so `visibilityState` says nothing about the element.
Fix — `IntersectionObserver`; combine it with visibility.

**Symptom: `visibilitychange` fires when the user just clicked another window.**
Cause — it tracks visibility, not focus. A visible but unfocused window stays `'visible'`.
Fix — use `focus`/`blur` on `window` if focus is what you meant.

**Symptom: an audio player pauses itself in the background.**
Cause — a blanket "pause everything when hidden" rule.
Fix — exempt deliberate background media; MDN notes audio-playing tabs are exempt from throttling
precisely because that use case is legitimate.

## Interview questions

**★ What does `document.visibilityState === 'hidden'` cover?**
A background tab, a minimised window, and a device whose screen has turned off. It says nothing
about whether a particular element is on screen — that is `IntersectionObserver`.

**★ What does the browser do to a hidden page?**
Stops delivering `requestAnimationFrame` callbacks entirely and throttles timers on a budget after
about 30 seconds (10 in Chrome). Tabs playing audio, or holding WebSocket/WebRTC connections, and
IndexedDB work are exempt.

**★ Why is `visibilitychange` the right place to save state?**
Because `hidden` is the last event you are reliably given — a mobile user switching apps may never
produce another, and the tab can be discarded without warning.

**★ How do you run work only when it is actually being watched?**
Combine `IntersectionObserver` (is the element on screen) with `visibilityState` (is the tab in
front) and run only when both are true.

**★ Why should an animation not count frames?**
Because `requestAnimationFrame` stops in a background tab, so frame counts drift from wall-clock
time. Use the timestamp the callback receives.

**Is `visibilitychange` the same as window focus?**
No. A visible but unfocused window is still `'visible'`. Use `focus`/`blur` when focus is what you
mean.

---

← [01 · The high-frequency events](./01-the-high-frequency-events.md) · [Topic index](./README.md) ·
**10 · Page lifecycle** *(not written yet)* →
