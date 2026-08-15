---
title: "20 · `sendBeacon` and keepalive"
sidebar_label: "Overview"
sidebar_position: 20
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), [`RequestInit.keepalive`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit), [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API). Documentation-validated; **no timings**.

**A request dies with the page that started it.** These two APIs are the exception: they ask
the browser to finish the request even after the page is gone, which is how end-of-session
data actually arrives.

🔴 **Know-tier: two APIs, one shared 64 KiB limit, and one rule about *when* to fire them** —
`visibilitychange` → `hidden`, never `unload`.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Sending on the way out](./01-sending-on-the-way-out.md)** | `sendBeacon`'s POST-only, response-less contract and what its `true` really means; `fetch(url, { keepalive: true })` and everything it adds; the shared **64 KiB** budget; and 🔴 **why the event you fire from matters more than the API** — bfcache, mobile, and the idempotency the repeated `hidden` event forces |

## The shape in five lines

```js
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  navigator.sendBeacon("/log", sessionDelta());          // queued, not delivered
  // or: fetch("/log", { method: "POST", body, keepalive: true, headers });
});
```

## Phase gate

You are done with this topic when you can say **what `sendBeacon`'s return value means**, and
**why end-of-session data is sent on `visibilitychange` rather than `unload`**.

## Where this connects

- [01 · `fetch`](../01-fetch/README.md) — the request this is a special case of
- [Phase 10 · 10 · Page lifecycle](../../phase-10-events/10-page-lifecycle/README.md) — the events these hang off, and bfcache
- [13 · 01 · WebSocket connecting](../13-websocket/01-connecting.md) — the same `pagehide` rule, for closing a socket
- [15 · Content Security Policy](../15-csp/README.md) — `connect-src` governs `sendBeacon` too

---

Start → [1 · Sending on the way out](./01-sending-on-the-way-out.md)
