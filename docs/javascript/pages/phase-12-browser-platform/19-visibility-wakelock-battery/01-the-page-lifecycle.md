---
title: "01 · The page lifecycle"
sidebar_label: "01 · The page lifecycle"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [`Document.visibilityState`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState), [`Document: visibilitychange` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event), [`Window: pagehide` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event), [`Window: pageshow` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event), [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon). Documentation-validated; **no timings and no console output**.

A page is not just "open" or "closed". It can be visible, hidden behind another tab, minimised,
frozen in the back/forward cache, or discarded entirely — and the syllabus row names the
consequence: *the background-tab behaviours that break timers and polling.*

## The state you can actually read

```js
document.visibilityState;              // 'visible' | 'hidden'
document.hidden;                       // the boolean shorthand

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  else resume();
});
```

`hidden` covers all of it: **a background tab, a minimised window, and the device screen turned
off.** That single event is the hook for almost every "stop wasting the user's resources" decision:

| While hidden, stop | Why |
|---|---|
| polling and refresh timers | throttled anyway ([03 · Timers and frames](../03-timers-and-frames/README.md)), and nobody is reading the result |
| animations and `requestAnimationFrame` loops | rAF is already paused; anything driving it should be too |
| video, audio, WebRTC, camera streams | the user did not choose to keep them running |
| high-frequency work — a live map, a stopwatch redraw | resume on return, do not "catch up" a thousand frames |

🔴 **On return, revalidate rather than replay.** A tab that was hidden for an hour should re-read
the current state — not process an hour's backlog of queued updates. That is the same "late joiner"
rule as [15 · Cross-tab coordination](../15-cross-tab-coordination/README.md), and
`visibilitychange` is where it belongs.

## 🔴 `hidden` is your last reliable moment

The instinct is to save on `unload` or `beforeunload`. Both are wrong now, for two separate
reasons:

1. **They are unreliable.** MDN says plainly that even `pagehide` is *not reliably fired on
   mobile* — a user who switches apps and later kills the browser from the app manager never
   generates one. `visibilitychange` to `hidden` is described as the more reliable option.
2. **They cost you the back/forward cache.** Adding an `unload` or `beforeunload` listener prevents
   the page from being eligible for bfcache; a `pagehide` listener does **not**.

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveDraft();                                        // synchronous, local
    navigator.sendBeacon('/analytics', payload);        // 🔴 survives the page going away
  }
});
```

⚠️ **`fetch()` in a hidden handler may not complete** — the page can be frozen or discarded
moments later. `sendBeacon` (or `fetch(..., { keepalive: true })`) is what hands the request to the
browser to deliver independently of the page.

⚠️ **Make the save idempotent.** `visibilitychange` can fire many times in a session — every
tab switch — so "save on hidden" must be cheap and repeatable, not a one-shot flush.

**`beforeunload` keeps exactly one legitimate use:** warning about genuinely unsaved work. Register
it only while such work exists and remove it as soon as it is saved, so the page stays
bfcache-eligible the rest of the time.

## The back/forward cache changes what "a new page load" means

```js
window.addEventListener('pageshow', (e) => {
  if (e.persisted) revalidate();      // 🔴 restored from bfcache — no script re-ran
});

window.addEventListener('pagehide', (e) => {
  if (e.persisted) pauseEverything(); // frozen, may come back
  else releaseEverything();           // being discarded
});
```

When a page is restored from the back/forward cache, **your module-level code does not run again**.
No `DOMContentLoaded`, no re-fetch, no re-render — the page comes back exactly as it was, with a
clock that is now wrong, a cart that is stale, and a session that may have expired. `pageshow` with
`persisted: true` is the only signal that this happened.

`persisted` on `pagehide` tells you which kind of goodbye it is: frozen and reusable, or gone.

## What actually keeps working in the background

Not much, and that is deliberate. Timers are clamped, `requestAnimationFrame` is paused, and
throttling gets more aggressive the longer a tab stays hidden
([03 · Timers and frames](../03-timers-and-frames/README.md)). Two consequences worth carrying:

- **A background tab is a bad leader.** If one tab must own polling or a WebSocket, prefer the
  visible one — see the leader-election caveat in
  [15 · 03 · The patterns](../15-cross-tab-coordination/03-the-patterns.md).
- **Anything that must happen while hidden belongs elsewhere:** a service worker
  ([07 · Web Workers](../07-web-workers/README.md) for the worker world), the server, or a
  scheduled job. A hidden page is not a background process.

## Gotchas

**Symptom: analytics or drafts are lost when users close the tab.**
Cause — saving on `unload`/`beforeunload`, which may never fire.
Fix — save on `visibilitychange` to `hidden`, with `sendBeacon`.

**Symptom: adding an unload handler tanked the back/forward navigation performance.**
Cause — `unload`/`beforeunload` listeners make the page ineligible for bfcache.
Fix — use `pagehide`/`visibilitychange`; keep `beforeunload` only while unsaved work exists.

**Symptom: pressing Back shows stale data and no request is made.**
Cause — the page was restored from bfcache; no script re-ran.
Fix — revalidate in a `pageshow` handler when `e.persisted` is true.

**Symptom: returning to a tab triggers a flood of queued updates.**
Cause — the app replayed the backlog instead of re-reading state.
Fix — on becoming visible, fetch the current state once.

**Symptom: a countdown is wrong after the tab was in the background.**
Cause — it counted ticks instead of time, and the ticks were throttled.
Fix — compute from timestamps, and recompute on `visibilitychange`.

**Symptom: audio keeps playing over another tab's video.**
Cause — no visibility handling.
Fix — pause on `hidden`, and restore only what was playing before.

## Interview questions

**★ Where do you save state now that `unload` is unreliable?**
On `visibilitychange` when the document becomes hidden — MDN's recommended replacement — using
`sendBeacon` so the request survives the page going away. `pagehide` is the second choice; `unload`
and `beforeunload` are not.

**★ Why does adding a `beforeunload` listener hurt performance?**
It makes the page ineligible for the back/forward cache, so returning to it becomes a full reload.
Register it only while there is genuinely unsaved work.

**★ What is `pageshow.persisted`?**
It is `true` when the page was restored from the back/forward cache, which means no script re-ran
and everything in memory is as stale as the time away. It is the moment to revalidate.

**★ What does `document.hidden` actually cover?**
A background tab, a minimised window, and the device screen being off — everything that means the
user is not looking at your page.

**★ A tab has been hidden for an hour. What should happen when the user comes back?**
Re-read the current state once, rather than replaying an hour of queued updates — and recompute
anything time-based from timestamps rather than from tick counts.

---

[Topic index](./README.md) · [02 · Wake Lock and Battery](./02-wake-lock-and-battery.md) →
