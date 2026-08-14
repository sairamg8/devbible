---
title: "02 · Shutdown"
sidebar_label: "02 · Shutdown"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`beforeunload` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event), [`pagehide` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event), [`unload` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event), [`visibilitychange` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event), [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon). Documentation-validated; **no timings**.

The syllabus row asks *which one to save state in*, and the answer is not the one most code uses.

🔴 **Save on `visibilitychange` → `hidden`.** MDN recommends it directly as "a more reliable signal
for automatic app state saving". Everything below explains why the alternatives are worse.

## The events, in the order they can happen

| Event | Fires | Reliable? |
|---|---|---|
| `visibilitychange` (→ `hidden`) | tab backgrounded, window minimised, screen off, app switched | 🔴 **the most reliable** |
| `pagehide` | navigating away **or** entering the bfcache (`event.persisted`) | good |
| `beforeunload` | just before unloading — can prompt | ⚠️ unreliable, and costly |
| `unload` | during unload | ⛔ do not use |

**A page can be discarded with no unload event at all** — a mobile user switching apps and the
system reclaiming memory, a tab the browser drops under pressure. `hidden` may genuinely be the
last thing you ever see.

## `beforeunload`: only for unsaved changes

```js
const warn = (event) => {
  event.preventDefault();      // the modern trigger
  event.returnValue = true;    // legacy browsers
};

function setDirty(isDirty) {
  if (isDirty) window.addEventListener('beforeunload', warn);
  else window.removeEventListener('beforeunload', warn);   // ← the half people skip
}
```

What MDN documents about it:

- **You cannot choose the message.** Browsers show their own generic string; a custom one is
  ignored.
- **Sticky activation is required** — the user must have interacted with the page, or no dialog
  appears. So you cannot test it by loading a page and immediately navigating away.
- 🔴 **It blocks the bfcache.** MDN: "In Firefox, `beforeunload` is not compatible with the
  back/forward cache … Firefox will not place pages in the bfcache if they have `beforeunload`
  listeners, and this is bad for performance." A permanently registered listener makes every Back
  navigation a full reload.
- **It is unreliable on mobile** — switching apps or closing from the app manager may not fire it.

MDN's own recommendation is to **add the listener only while there are unsaved changes and remove
it again**, which is exactly the `setDirty` shape above.

⛔ **`unload` is worse in every respect** — it is unreliable, it disqualifies the page from the
bfcache, and it should not be used at all.

## `pagehide` and `pageshow` — the bfcache pair

```js
window.addEventListener('pagehide', (event) => {
  save();                         // always
  if (event.persisted) {
    // going into the bfcache: the page may come back alive
    pauseTimers();
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) resumeAndRefresh();     // came back from the bfcache
});
```

The **back/forward cache** keeps a whole page — DOM, JavaScript heap, scroll position — so Back
restores it instantly instead of reloading. Two consequences to design for:

- **State survives that you may not want to survive.** A "processing…" spinner, a disabled submit
  button, a stale price. Refresh those in `pageshow` when `event.persisted`.
- **`beforeunload` and `unload` listeners disqualify the page.** Which is the strongest practical
  reason to avoid them.

`pagehide` fires in both cases — real navigation and bfcache entry — so it is a safe place to save,
with `event.persisted` distinguishing them.

## Sending data at the end

A `fetch()` started as the page goes away is usually cancelled. Two supported ways to finish:

```js
navigator.sendBeacon('/analytics', JSON.stringify(payload));

fetch('/analytics', { method: 'POST', body, keepalive: true });
```

`sendBeacon` queues the request and returns immediately; the browser delivers it after the page is
gone. `fetch` with `keepalive: true` does the same for cases where you need headers or a method the
beacon API does not give you. Both are **small-payload** mechanisms — they are subject to size
limits, and neither is a route for uploading real data.

📌 Fire these from `visibilitychange` → `hidden` rather than `unload`, for the same reliability
reason.

## The pattern that covers everything

```js
let dirty = false;

document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveState();          // ← the primary save
});

window.addEventListener('pagehide', () => saveState());   // belt and braces

function saveState() {
  sessionStorage.setItem('draft', JSON.stringify(model));
  if (pendingMetrics.length) {
    navigator.sendBeacon('/metrics', JSON.stringify(pendingMetrics));
    pendingMetrics.length = 0;
  }
}
```

Make `saveState()` **idempotent and cheap** — it can run several times (hidden, shown, hidden
again), and it runs at a moment when the browser is trying to leave.

## Gotchas

**Symptom: state is lost when a mobile user switches apps.**
Cause — saving on `beforeunload` or `unload`, neither of which reliably fires there.
Fix — save on `visibilitychange` → `hidden`.

**Symptom: pressing Back reloads the page instead of restoring it instantly.**
Cause — a `beforeunload` or `unload` listener disqualifies the page from the bfcache.
Fix — register `beforeunload` only while there are unsaved changes, and remove it after. Never use
`unload`.

**Symptom: the custom "you have unsaved changes" message never appears.**
Cause — browsers show their own generic text and ignore yours.
Fix — accept the generic dialog; put the detail in the page's own UI.

**Symptom: `beforeunload` does nothing during testing.**
Cause — sticky activation: the user must have interacted with the page first.
Fix — click something before navigating away when testing.

**Symptom: after Back, a submit button is still disabled and a spinner is still spinning.**
Cause — the bfcache restored the exact DOM and JavaScript state.
Fix — reset transient UI in `pageshow` when `event.persisted` is true.

**Symptom: the final analytics request never arrives.**
Cause — a normal `fetch` started as the page unloads is cancelled.
Fix — `navigator.sendBeacon()` or `fetch(..., { keepalive: true })`, sent from `hidden`.

## Interview questions

**★ Where should you save application state, and why not `beforeunload`?**
On `visibilitychange` when the page becomes `hidden` — MDN recommends it as the more reliable
signal. `beforeunload` may never fire when a mobile user switches apps or closes the browser from
the app manager, and it disqualifies the page from the bfcache.

**★ What exactly does `beforeunload` cost?**
The bfcache: a page with a `beforeunload` listener is not eligible in Firefox, so every Back
navigation becomes a reload. Register it only while there are unsaved changes and remove it
afterwards.

**★ Can you customise the `beforeunload` message?**
No. Browsers show a generic string. It also requires sticky activation — the user must have
interacted with the page for the dialog to appear at all.

**★ What is the difference between `pagehide` and `unload`?**
`pagehide` fires both on real navigation and when the page enters the bfcache, and
`event.persisted` distinguishes them; it does not disqualify the page. `unload` is unreliable,
disqualifies the page from the bfcache, and should not be used.

**★ How do you send a last request as the page goes away?**
`navigator.sendBeacon()`, or `fetch()` with `keepalive: true`, dispatched from
`visibilitychange` → `hidden`. Both are for small payloads; a plain `fetch` at unload time is
cancelled.

**Why does the bfcache sometimes make the UI look wrong after Back?**
Because it restores the exact DOM and JavaScript state — spinners, disabled buttons and stale data
included. Reset transient UI in `pageshow` when `event.persisted`.

---

← [01 · Startup](./01-startup.md) · [Topic index](./README.md) ·
**11 · Default actions you should not block** *(not written yet)* →
