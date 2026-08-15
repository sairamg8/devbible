---
title: "19 · Page Visibility, Wake Lock and Battery"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [`Window: pagehide` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event), [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API), [Battery Status API](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API). Documentation-validated; **no timings and no console output**.

The syllabus row is *the background-tab behaviours that break timers and polling* — and the fix is
one event. `visibilitychange` is the smallest API in this phase with the largest reach: it is where
polling stops, where drafts are saved, where media pauses, and where a wake lock has to be
re-acquired.

🔴 **A hidden page is not a background process.** Timers are clamped, frames stop, and the page may
be frozen or discarded without warning. Anything that must keep happening belongs in a service
worker or on the server.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The page lifecycle](./01-the-page-lifecycle.md)** | `visibilityState` and what `hidden` really covers; the stop-doing-this table; 🔴 **`hidden` is the last reliable moment** — MDN's own reasoning against `unload`/`beforeunload`, `sendBeacon`, and idempotent saves; how `unload` listeners **cost you the back/forward cache**; `pageshow.persisted` and the restored page whose scripts never re-ran; revalidate rather than replay |
| 02 | **[Wake Lock and Battery](./02-wake-lock-and-battery.md)** | The `WakeLockSentinel`, the automatic releases you do not control, and 🔴 why **re-acquiring on `visibilitychange`** is part of every implementation; what a wake lock is and is not for; permissions-policy delegation; the Battery Status API's four properties — and the honest case for **not** using it (limited availability, fingerprinting, wrong question) with `saveData`, `prefers-reduced-motion` and an explicit setting as the alternatives |

## Three facts worth carrying out of this topic

- **Save on `hidden`, with `sendBeacon`.** `unload` may never fire, and listening for it makes the
  page ineligible for the back/forward cache.
- **`pageshow.persisted === true` means nothing re-ran.** The page came back from bfcache with all
  its stale state intact.
- **A wake lock is state, not a setting.** The browser releases it when the page hides or the
  battery runs low, and you must re-acquire it deliberately.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [03 · Timers and frames](../03-timers-and-frames/README.md) — the throttling this topic works
  around, and why a countdown must be computed from timestamps
- [15 · Cross-tab coordination](../15-cross-tab-coordination/README.md) — revalidating on return,
  and why a hidden tab makes a poor leader
- [18 · Media from JavaScript](../18-media/README.md) — pausing playback and releasing camera
  tracks when the page is hidden
- [14 · Yielding to the main thread](../14-yielding-to-the-main-thread.md) — the other half of
  "do less work", while the page is visible

---

Start → [01 · The page lifecycle](./01-the-page-lifecycle.md)
