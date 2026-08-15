---
title: "10 · Page lifecycle"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`DOMContentLoaded` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event), [`load` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/load_event), [`Document.readyState`](https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState), [`beforeunload` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event), [`pagehide` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event), [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon). Documentation-validated; **no timings**.

The syllabus row is *`DOMContentLoaded`, `load`, `pagehide`, `visibilitychange`, `beforeunload`, and
which one to save state in* — and that last clause has a specific answer that most code gets wrong.

🔴 **Start on `DOMContentLoaded`. Save on `visibilitychange` → `hidden`.** `load` waits for every
image; `beforeunload` may never fire and costs you the bfcache.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Startup](./01-startup.md)** | `DOMContentLoaded` versus `load`, the `readyState` guard for late scripts, what `defer` / `async` / `type="module"` change, what not to do at startup, and `pageshow` for bfcache restores |
| 02 | **[Shutdown](./02-shutdown.md)** | The four shutdown events ranked by reliability, what `beforeunload` really costs, `pagehide`/`pageshow` and the bfcache, `sendBeacon` and `keepalive`, and the save pattern that covers every case |

## Three facts worth carrying out of this topic

- **A page can be discarded with no unload event at all.** `hidden` may be the last signal you get,
  which is why it is the save point.
- **`beforeunload` disqualifies the page from the bfcache**, turning every Back into a reload.
  Register it only while there are unsaved changes.
- **`DOMContentLoaded` and `load` do not fire on a bfcache restore.** `pageshow` with
  `event.persisted` is the hook.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [09 · Scroll, resize and visibility](../09-scroll-resize-visibility/02-visibility-and-lifecycle.md)
  — the visibility half in full, including what the browser throttles in a hidden tab
- [Phase 9 · 14 · Scrolling](../../phase-9-dom/14-scrolling/04-watching-and-restoring.md) —
  `history.scrollRestoration` and restoring position, the other half of "coming back to a page"
- [04 · Event delegation](../04-event-delegation/README.md) — what startup should actually wire up
- [Phase 9 · 11 · Batching DOM work](../../phase-9-dom/11-batching-dom-work/02-not-freezing-the-page.md)
  — why startup should not be one long task

---

Start → [01 · Startup](./01-startup.md)
