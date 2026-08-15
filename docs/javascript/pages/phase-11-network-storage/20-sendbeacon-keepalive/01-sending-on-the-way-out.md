---
title: "1 · Sending on the way out"
sidebar_label: "1 · Sending on the way out"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), [`RequestInit.keepalive`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit), [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [`Window: pagehide` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event), [Back/forward cache](https://developer.mozilla.org/en-US/docs/Glossary/bfcache). Documentation-validated; **no timings**.

**The problem: a normal request dies with the page that started it.** Navigate away, close
the tab, or switch apps on a phone, and an in-flight `fetch` is cancelled — which is why
analytics, session-end events and "how far did they read" telemetry are lost exactly when
they matter.

**Two APIs solve it, and they are close relatives.**

## `navigator.sendBeacon()`

```js
navigator.sendBeacon("/log", data);   // → true if QUEUED, false otherwise
```

**It "asynchronously sends an HTTP POST request containing a small amount of data to a web
server"**, and the browser takes responsibility for delivering it after the page is gone.

| | |
|---|---|
| Method | **always `POST`** |
| Data | `ArrayBuffer`, `TypedArray`, `DataView`, `Blob`, string, `FormData`, `URLSearchParams` |
| Size | 🔴 **"limited to 64 KiB (65,536 bytes)"**, counted across queued data |
| Returns | **`true` if the user agent successfully *queued* the data**, `false` otherwise |
| Response | ❌ none — you cannot read it |

🔴 **`true` means queued, not delivered.** There is no callback, no promise, no status code.
A beacon is fire-and-forget by design; if you need to know the server got it, this is the
wrong tool.

**Why it exists at all** is worth quoting, because the alternatives are still in old code:
synchronous `XMLHttpRequest` "delays unload", an `<img>` ping does too, and busy-loops block
the next navigation. With `sendBeacon`, "data is transmitted asynchronously without delaying
unload or next navigation".

## `fetch(url, { keepalive: true })`

```js
fetch("/log", { method: "POST", body, keepalive: true });
```

**"When set to `true`, the browser will not abort the associated request if the page that
initiated it is unloaded before the request is complete."** Same guarantee, better ergonomics
— MDN lists the advantages plainly:

- **any HTTP method**, not just `POST`
- **full request customisation** — headers, credentials, mode
- **you can read the response**, through the normal promise
- **available in service workers**

⚠️ **The same 64 KiB limit applies:** "The body size for `keepalive` requests is limited to 64
kibibytes." It is a shared budget, not a per-request allowance, so a page firing several
beacons at once can exceed it and have one silently fail.

**Choose between them on one question — do you need anything back?**

| | `sendBeacon` | `fetch` + `keepalive` |
|---|---|---|
| Fire-and-forget analytics | ✅ simplest | ✅ |
| Custom headers (auth, tracing) | ❌ | ✅ |
| Method other than `POST` | ❌ | ✅ |
| Read the response | ❌ | ✅ |
| In a service worker | ❌ | ✅ |

## 🔴 The event you fire it from matters more than the API

```js
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") navigator.sendBeacon("/log", data);
});
```

**MDN recommends `visibilitychange` over `unload` and `beforeunload`, and the reasons are
concrete:** unload handlers "are unreliable (especially on mobile)", are "incompatible with
back/forward cache (bfcache)", and registering one can **exclude the page from bfcache**
entirely — turning an instant back-navigation into a full reload. `pagehide` is the fallback
"for browsers not supporting `visibilitychange`".

⚠️ **`visibilitychange` → `hidden` fires far more often than once**, every time the user
switches tabs or apps. So the handler must be **idempotent or de-duplicated** — send a
session delta and clear it, rather than the whole session each time.

⚠️ **On mobile, `hidden` is frequently the last thing that happens.** A backgrounded tab may
be discarded without any further event, which is exactly why "send at unload" never worked
there and why this is the only reliable moment.

**And this is the same rule as `13 · 01`'s advice to `close()` a WebSocket on `pagehide`
([13 · 01](../13-websocket/01-connecting.md))** — the page-lifecycle events, not the unload
ones, are where end-of-session work belongs
([Phase 10 · 10 · Page lifecycle](../../phase-10-events/10-page-lifecycle/README.md)).

## Gotchas

**Symptom → cause → fix.**

- **Analytics from the last page view are missing** → a plain `fetch` was cancelled with the
  page → `sendBeacon`, or `keepalive: true`.
- **`sendBeacon` returns `false`** → the 64 KiB queue is full, or the payload is too large →
  send less; batching more into one beacon does not help, the limit is on the total.
- **The beacon "succeeded" but nothing reached the server** → `true` means queued, not
  delivered → treat delivery as best-effort; there is no status to check.
- **Auth headers cannot be attached** → `sendBeacon` sends no custom headers → use
  `fetch` with `keepalive: true`, or a cookie.
- **The back button became slow after adding telemetry** → an `unload`/`beforeunload` handler
  disqualified the page from bfcache → move to `visibilitychange`/`pagehide`.
- **Duplicate session events** → `visibilitychange` fires on every tab switch → make the
  handler idempotent, or send deltas.
- **It works on desktop and loses data on mobile** → the app was backgrounded and discarded
  with no unload event → send when `hidden`, not at unload.

## Interview questions

**Why can't you just `fetch` in a page-unload handler?** Because the request is aborted when
the page goes away. `sendBeacon` and `keepalive: true` both tell the browser to complete the
request independently of the page.

**What does `sendBeacon` return?** `true` if the data was *queued* for transfer, `false`
otherwise — never a delivery confirmation, and there is no response to read.

**When would you use `fetch` with `keepalive` instead?** When you need a method other than
`POST`, custom headers, or the response — or when you are in a service worker, where
`sendBeacon` is not available. The 64 KiB limit is the same.

**Which event should end-of-session data be sent from, and why?** `visibilitychange` when the
state becomes `hidden`, with `pagehide` as a fallback. `unload`/`beforeunload` are unreliable
on mobile and can disqualify the page from the back/forward cache.

**What is the catch with `visibilitychange`?** It fires every time the tab is backgrounded,
not once at the end — so the handler must be idempotent or send only what has changed since
the last send.

---

← [Overview](./README.md) · [Phase 11](../README.md)
