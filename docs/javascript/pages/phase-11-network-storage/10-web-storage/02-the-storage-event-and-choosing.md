---
title: "2 · The `storage` event, and choosing storage"
sidebar_label: "2 · The storage event and choosing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event), [`StorageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/StorageEvent), [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [`Cache`](https://developer.mozilla.org/en-US/docs/Web/API/Cache), [`Storage.clear()`](https://developer.mozilla.org/en-US/docs/Web/API/Storage/clear), [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies). Documentation-validated; **no timings**.

## The `storage` event

```js
window.addEventListener("storage", (e) => {
  e.key;         // which key changed — null on clear()
  e.oldValue;    // before
  e.newValue;    // after — null if removed
  e.storageArea; // localStorage or sessionStorage
  e.url;         // the page that made the change
});
```

**It fires when another browsing context on the same origin changes storage** — which
makes it the simplest cross-tab synchronisation the platform offers. Log out in one tab and
every other tab can notice.

🔴 **It does not fire in the tab that made the change.** This is the single most confusing
thing about it, and it is deliberate: the tab that wrote the value already knows. The
consequence is that your own update path and your cross-tab update path are **different
code**, and testing in one tab tells you nothing.

```js
function setTheme(theme) {
  localStorage.setItem("theme", theme);
  applyTheme(theme);          // ✅ required — no event will fire here
}
window.addEventListener("storage", (e) => {
  if (e.key === "theme") applyTheme(e.newValue);   // ✅ the other tabs
});
```

⚠️ **Two more behaviours worth knowing:**

- **`clear()` fires one event with `key`, `oldValue` and `newValue` all `null`.** A handler
  that does `if (e.key === "theme")` silently ignores a wipe, which is usually wrong —
  handle the `key === null` case explicitly.
- **Setting a key to the value it already holds may not fire at all**, since nothing
  changed. Do not use a repeated write as a ping.

## Using it as a message bus — and where that ends

**The trick is well known: write a key nobody reads, purely to notify other tabs.**

```js
localStorage.setItem("broadcast", JSON.stringify({ type: "logout", at: Date.now() }));
```

⚠️ **It works, and it is the wrong tool now.** The problems are real: the message
persists in storage after delivery, you have to include a nonce or timestamp so two
identical messages both fire, it is synchronous, and it only reaches tabs — not workers.

✅ **`BroadcastChannel` is the purpose-built version**, and it is what to reach for:

```js
const channel = new BroadcastChannel("app");
channel.postMessage({ type: "logout" });
channel.onmessage = (e) => { … };
```

**It carries structured data rather than strings** — the `structuredClone` algorithm again
([Phase 5 · 21](../../phase-5-built-in-library/21-structuredclone.md)) — leaves nothing
behind, and reaches workers too. The `storage` event stays useful for one thing:
**noticing that stored state changed**, which is a different question from sending a
message. Cross-tab coordination in full is **Phase 12 · 15 · Cross-tab coordination**
*(another chunk's topic)*.

## Choosing where data goes

| Store | Holds | Lifetime | Sync? | Reach it from | Use for |
|---|---|---|---|---|---|
| **memory** | anything | the page | — | the page | everything not needed after a reload |
| **`sessionStorage`** | strings | the tab | 🔴 sync | main thread | per-tab UI state — wizard step, scroll position |
| **`localStorage`** | strings | until removed | 🔴 sync | main thread | small preferences, a feature flag, a last-used value |
| **cookie** | a small string | attribute-controlled | sync | main thread + **the server** | anything the server must see on every request |
| **IndexedDB** | structured values, `Blob`s | until removed | ✅ async | main thread **and workers** | large or structured data, offline records |
| **`Cache`** | `Request`/`Response` pairs | until removed | ✅ async | main thread + service worker | offline assets and API responses |
| **the server** | anything | authoritative | — | anywhere | anything that must be true across devices |

**The decision, in order:**

1. **Does it need to survive a reload?** No → keep it in memory. This eliminates most
   candidates, and "I put it in `localStorage` so components could share it" is a state
   management problem wearing a storage costume.
2. **Does the server need it on every request?** Yes → a cookie, and only an identifier
   ([09 · Cookies](../09-cookies/README.md)).
3. **Is it small, flat and string-ish?** Yes → web storage.
4. **Is it large, structured, binary, or needed from a worker?** → **IndexedDB**
   *(topic 16)*. This is the line most often crossed too late.
5. **Must it be right across devices, or must the user not be able to change it?** → the
   server. Nothing on this page is authoritative; all of it is user-editable in devtools.

## What must never go in web storage

🔴 **Anything whose disclosure matters**, because any script on the origin can read it and
so can the user. Concretely:

- **Long-lived tokens.** The trade-off is
  [09 · 02](../09-cookies/02-tokens-and-samesite.md); the part that is not a trade-off is
  *lifetime*. A refresh token readable by JavaScript is the worst version of the argument.
- **Anything you will trust later without checking.** A stored `role: "admin"`, a price, a
  quota, an entitlement — the user can edit it, so the server must re-check it. Store it if
  it is useful for rendering; never let it be the authority.
- **Personal data you do not need there.** It survives logout unless you remove it, and it
  is readable by every script the page loads, including third-party ones.

⚠️ **And on logout, remove your own keys explicitly.** Neither store knows what a session
is, and `clear()` is a blunt instrument that also wipes keys owned by other code on the
origin.

## Gotchas

**Symptom:** The `storage` event never fired while testing
**Cause:** It does not fire in the tab that made the change — and testing was in one tab.
**Fix:** Two tabs. And update your own UI directly at the write site.

**Symptom:** A logout in one tab left another tab logged in
**Cause:** No `storage` listener, or the handler only matched a specific key while the code
called `clear()`.
**Fix:** Listen, and handle `e.key === null` as "everything changed".

**Symptom:** A cross-tab message was delivered twice, or never
**Cause:** The `storage`-event-as-bus trick — identical values do not fire, and the message
lingers in storage.
**Fix:** `BroadcastChannel`.

**Symptom:** Storage state and UI drifted apart
**Cause:** Two update paths — the direct write and the event — and only one applied the
change.
**Fix:** One function that applies the change, called from both.

**Symptom:** A user granted themselves a paid feature
**Cause:** An entitlement was read from `localStorage` and trusted.
**Fix:** The server decides; storage may cache the answer, never own it.

**Symptom:** Personal data was still present after logout
**Cause:** Web storage has no expiry and no concept of a session.
**Fix:** Remove your namespaced keys on logout.

**Symptom:** `clear()` broke a third-party widget
**Cause:** It wipes the whole origin's store.
**Fix:** Remove only your own keys.

## Interview questions

**★ Why does the `storage` event not fire in the tab that wrote the value?**
Because that tab already knows — it made the change. The practical consequence is that the
write path and the cross-tab path are separate code, so the writing tab must apply the
change itself, and testing in a single tab will never exercise the listener. Route both
through one apply function.

**★ How do you synchronise state across tabs?**
`BroadcastChannel` for messages — structured data, nothing left behind, and it reaches
workers. The `storage` event still works for *noticing that stored state changed*, but the
old trick of writing a key purely to signal other tabs has real problems: identical values
may not fire, the message persists, and it is synchronous and tab-only.

**★ When should data go to IndexedDB instead of `localStorage`?**
When it is large, structured, binary, or needed from a worker. Web storage is a synchronous
main-thread string map, so a big value blocks rendering and a `Blob` cannot be stored at
all. IndexedDB is asynchronous, holds structured values, and is available to workers.

**★ What must never live in web storage?**
Anything whose disclosure matters, and anything you will later trust without re-checking.
Every script on the origin can read it and the user can edit it, so a stored role, price or
entitlement must be re-validated server-side. Long-lived tokens are the sharpest case — the
lifetime, not the bucket, is what makes them dangerous.

**How do you handle `clear()` in a `storage` listener?**
It fires a single event with `key`, `oldValue` and `newValue` all `null`. A handler that
only compares `e.key` to specific names will ignore a wipe entirely, so treat `key === null`
as "reload everything".

**Why is `localStorage` a poor answer to "share state between components"?**
Because that is a state-management question, not a persistence one. Storage is synchronous,
string-only, and updates do not notify the tab that made them — so you end up hand-rolling
change propagation that a store or context gives you correctly. Persist only what must
survive a reload.

---

← [1 · The API, and what it costs](./01-the-api-and-what-it-costs.md) · [Topic index](./README.md) · [Phase index](../README.md) →
