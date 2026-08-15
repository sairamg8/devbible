---
title: "14 · Same-origin and `postMessage`"
sidebar_label: "Overview"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), [`Window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), [`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent), [`MessageChannel`](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel). Documentation-validated; **no timings**.

**The same-origin policy decides what one document may read from another. `postMessage` is
the sanctioned hole in it** — an explicit, opt-in channel between two origins that otherwise
cannot see each other at all.

🔴 **The hole is only as safe as the two checks you write.** MDN's warning is unusually
blunt: "Failure to check the `origin` and possibly `source` properties enables cross-site
scripting attacks." Almost every `postMessage` bug is one of those two checks missing.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What an origin is](./01-what-an-origin-is.md)** | The scheme/host/port tuple and the port rule; opaque origins (`file:`, `data:`, sandboxed frames); what the policy really restricts — **writes and embedding are allowed, reads are not**; the tiny cross-origin `Window`/`Location` allow-list; why `document.domain` is dead; and controlling who may frame *you* |
| 2 | **`postMessage`** *(next)* | The three argument forms and 🔴 **why `targetOrigin: "*"` is a data leak**; the receive-side checklist (`origin`, `source`, shape); what the structured clone algorithm carries and refuses; transferables; `MessageChannel` ports; and the worker, iframe and popup cases |

## The shape in ten lines

```js
// sender — always name the target origin
frame.contentWindow.postMessage({ type: "ping" }, "https://widget.example.com");

// receiver — three checks, none optional
addEventListener("message", (e) => {
  if (e.origin !== "https://app.example.com") return;   // 1 · who sent it
  if (e.source !== expectedWindow) return;              // 2 · which window
  if (e.data?.type !== "ping") return;                  // 3 · what shape
  respond(e.source, e.origin);
});
```

## Phase gate

You are done with this topic when you can say **why `targetOrigin` must not be `"*"`**, and
**what an attacker can do if a `message` listener does not check `event.origin`**.

## Where this connects

- [05 · CORS from the client side](../05-cors-client-side/README.md) — the other half of the origin model: how reads get re-opened
- [09 · Cookies](../09-cookies/README.md) — cookies are scoped by *site*, this is scoped by *origin*
- [10 · `localStorage` and `sessionStorage`](../10-web-storage/README.md) — origin-scoped storage, and the cross-tab channel this is not
- [13 · WebSocket](../13-websocket/README.md) — the one network API that is **not** subject to CORS
- [Phase 5 · 21 · `structuredClone`](../../phase-5-built-in-library/21-structuredclone.md) — the same serialisation algorithm `postMessage` uses

---

Start → [1 · What an origin is](./01-what-an-origin-is.md)
