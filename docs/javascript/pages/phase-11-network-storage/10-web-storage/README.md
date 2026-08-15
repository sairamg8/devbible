---
title: "10 · `localStorage` and `sessionStorage`"
sidebar_label: "Overview"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), [`Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [`Window.sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [`Storage`](https://developer.mozilla.org/en-US/docs/Web/API/Storage), [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event), [`StorageManager.estimate()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). Documentation-validated; **no timings**.

**Web storage is a synchronous string-to-string map, per origin, with no expiry.** That
one sentence contains every strength and every limitation: it is the simplest storage on
the platform, and the four words *synchronous*, *string*, *per origin* and *no expiry* each
cause a specific class of bug.

🔴 **Its API is deceptively small, and the two things it hides are the ones that hurt.**
`setItem` can throw — in a case you will not hit while developing — and every call is
synchronous, which means every call blocks the main thread including the rendering of the
frame you are in.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The API, and what it costs](./01-the-api-and-what-it-costs.md)** | The seven members and the `key`/`length` pair worth knowing; strings only, and the JSON round trip with everything it silently loses; 🔴 **`setItem` throwing on quota**, in private mode and on iOS; why synchronous matters and where it shows up; `sessionStorage` versus `localStorage` and what "session" actually means; and the origin rule, including the port |
| 2 | **[The `storage` event, and choosing storage](./02-the-storage-event-and-choosing.md)** | Cross-tab synchronisation, 🔴 **the event that does not fire in the tab that made the change**, and what it does on `clear()`; using it as a cross-tab message bus and where that breaks; then the decision — cookie, web storage, IndexedDB, `Cache`, in-memory or the server — and the things that must never go in web storage |

## The API, in full

```js
localStorage.setItem("theme", "dark");
localStorage.getItem("theme");      // "dark", or null if absent
localStorage.removeItem("theme");
localStorage.clear();
localStorage.length;
localStorage.key(0);                // the name at that index
```

**That is all of it.** `sessionStorage` has the identical shape and differs only in
lifetime.

⚠️ **There is also a property form** — `localStorage.theme = "dark"` — and it mostly works.
Avoid it: a key named `length`, `clear` or `key` collides with the API, and the intent
reads worse.

## Phase gate

You are done with this topic when you can say **why `setItem` needs a `try`/`catch`**, and
**why the `storage` event does not fire in the tab that wrote the value**.

## Where this connects

- [09 · Cookies](../09-cookies/README.md) — the other client-side store, and the token argument
- [09 · 02 · Tokens and `SameSite`](../09-cookies/02-tokens-and-samesite.md) — why "put the token here" is a decision, not a default
- [Phase 5 · 09 · `JSON`](../../phase-5-built-in-library/09-json/README.md) — what the round trip through storage drops
- **16 · IndexedDB** *(later in this phase)* — the asynchronous, structured alternative
- **Phase 12 · 15 · Cross-tab coordination** *(another chunk's topic)* — `BroadcastChannel`, the purpose-built version of the `storage`-event trick

---

Start → [1 · The API, and what it costs](./01-the-api-and-what-it-costs.md)
