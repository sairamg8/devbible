---
title: "1 · The API, and what it costs"
sidebar_label: "1 · The API and what it costs"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), [`Storage.setItem()`](https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem), [`Storage.getItem()`](https://developer.mozilla.org/en-US/docs/Web/API/Storage/getItem), [`Window.sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [`Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException), [`StorageManager.estimate()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate), [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Documentation-validated; **no timings**.

## Strings only — and the round trip that loses things

```js
localStorage.setItem("count", 42);
localStorage.getItem("count");        // 🔴 "42" — a string
localStorage.getItem("count") + 1;    // 🔴 "421"
```

🔴 **Every value is coerced to a string on the way in**, so numbers come back as strings,
`true` comes back as `"true"`, and an object comes back as the notoriously useless
`"[object Object]"`.

```js
localStorage.setItem("user", { name: "ada" });
localStorage.getItem("user");         // 🔴 "[object Object]"
```

✅ **So everything non-trivial goes through JSON:**

```js
localStorage.setItem("user", JSON.stringify(user));
const user = JSON.parse(localStorage.getItem("user") ?? "null");
```

⚠️ **And the JSON round trip drops exactly what it always drops** — `Date` becomes a
string, `undefined`, functions and symbol keys vanish, `Map` and `Set` become `{}`, and a
cycle throws ([Phase 5 · 09 · `JSON`](../../phase-5-built-in-library/09-json/README.md)).
A `Date` written to storage and read back is a string that no longer has `getTime`, and the
failure appears far from the write.

🔴 **`getItem` returns `null` for a missing key, not `undefined`** — and `JSON.parse(null)`
gives `null` while `JSON.parse(undefined)` throws. That is why the `?? "null"` above is
there, and why a bare `JSON.parse(localStorage.getItem(k))` is a latent crash.

**Wrap it once and stop thinking about it:**

```js
const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;      // ✅ corrupt or hand-edited data does not crash the app
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;         // ✅ see the quota section
    }
  },
};
```

⚠️ **The `catch` on read is not paranoia.** Storage persists across deploys, so yesterday's
format, a half-written value, or something a user edited in devtools is all still there
when today's code reads it. **Treat stored data as untrusted input**, with the same
suspicion as a network response.

## 🔴 `setItem` throws

```js
localStorage.setItem(key, hugeValue);   // 🔴 QuotaExceededError — a DOMException
```

**Storage is quota-limited per origin**, and exceeding it throws rather than returning
`false`. **The reason this bites in production and not in development** is that the quota
is generous and your test data is small.

⚠️ **Three situations where it throws unexpectedly:**

- **The quota is genuinely full** — usually one runaway key, often a cache someone added.
- **Private or incognito browsing**, where some browsers historically gave a zero or tiny
  quota. Reading works, writing throws.
- **Blocked storage** — a browser setting, an embedded third-party context, or a
  privacy mode can make even *accessing* `localStorage` throw a `SecurityError`, before you
  call a method on it.

🔴 **That last one means the feature test itself must be in a `try`:**

```js
const hasStorage = (() => {
  try {
    const k = "__t";
    localStorage.setItem(k, k);
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;   // ✅ blocked, full, or absent — treat storage as optional
  }
})();
```

✅ **Design so the app works without it.** Web storage is a cache and a convenience;
anything that must survive belongs on the server. `navigator.storage.estimate()` gives a
rough usage and quota where available, which is useful for diagnostics rather than control
flow.

## Synchronous — and what that costs

**Every call is blocking.** `getItem` does not return a promise; it stops the main thread
until the value is read from disk.

🔴 **Two places this actually shows up:**

- **A large value.** Parsing a megabyte of JSON out of storage on startup is main-thread
  work in the critical path, before anything renders.
- **A loop.** Reading fifty keys is fifty synchronous disk touches, and it is a common
  shape in "restore my state" code.

✅ **The practical rules:** read what you need at startup **once**, keep the parsed value in
memory, and write back on change rather than reading through storage on every access. If
the data is big or structured, it belongs in **IndexedDB** *(topic 16, later in this
phase)*, which is asynchronous and stores real values rather than strings.

⚠️ **And this is why web storage is unavailable in a Web Worker.** A synchronous,
main-thread-only API cannot be offered to a thread whose whole purpose is not blocking the
main one — another reason IndexedDB exists.

## `localStorage` versus `sessionStorage`

| | `localStorage` | `sessionStorage` |
|---|---|---|
| Lifetime | until explicitly removed | until the **tab** is closed |
| Shared between tabs | ✅ same origin, all tabs | ❌ **per tab** |
| Survives reload | ✅ | ✅ |
| Survives a duplicated tab | ✅ | ⚠️ the copy inherits a snapshot |
| `storage` event | ✅ across tabs | limited to that tab's context |

🔴 **"Session" does not mean your login session.** It means the browsing context — the tab.
Two tabs on the same site have two entirely separate `sessionStorage` stores, which is
precisely why it is right for per-tab state such as a wizard's progress or a scroll
position, and wrong for anything the user expects to follow them.

⚠️ **Neither is cleared by logging out**, because neither knows what logging out is. Your
logout code has to remove what it wrote — and `clear()` removes *everything* on the origin,
including keys other parts of the app or a third-party script own.

## Per origin, and the port counts

**Storage is keyed by origin — scheme, host and port**, so all three must match:

```
https://example.com          ← one store
http://example.com           ← different: scheme
https://example.com:8443     ← different: port
https://sub.example.com      ← different: host
```

🔴 **This is stricter than cookies**, which can be shared across subdomains with the
`Domain` attribute ([09 · Cookies](../09-cookies/README.md)). There is no equivalent for
web storage: subdomains cannot share it, and no attribute will change that.

⚠️ **`localhost:3000` and `localhost:5173` are different origins**, which is why switching
dev servers looks like your data vanished.

**Namespace your keys**, because the store is flat and shared with every script on the
origin:

```js
localStorage.setItem("myapp:v1:prefs", JSON.stringify(prefs));   // ✅
```

**The `v1` matters too** — it gives you a way to change the shape later without having to
migrate or crash on old data.

## Gotchas

**Symptom:** A stored number behaved like a string
**Cause:** Every value is coerced to a string.
**Fix:** `JSON.stringify` on write, `JSON.parse` on read.

**Symptom:** `"[object Object]"` came back
**Cause:** An object was passed to `setItem` without serialising.
**Fix:** `JSON.stringify`.

**Symptom:** `JSON.parse` threw at startup
**Cause:** The key is missing — `getItem` returns `null` and `JSON.parse(null)` is `null`,
but a corrupt or old-format value throws.
**Fix:** A `try`/`catch` around the read with a fallback; treat stored data as untrusted.

**Symptom:** A `Date` read back had no methods
**Cause:** JSON has no date type.
**Fix:** Store an ISO string and revive it deliberately.

**Symptom:** `QuotaExceededError` in production only
**Cause:** Quota is generous and dev data is small; a runaway key fills it later.
**Fix:** `try`/`catch` every write, and cap what you store.

**Symptom:** Accessing `localStorage` threw before any method was called
**Cause:** Storage can be blocked entirely — privacy settings, embedded contexts.
**Fix:** Feature-test inside a `try`, and make the app work without it.

**Symptom:** Startup was slow
**Cause:** Synchronous reads of large values, or many of them, on the main thread.
**Fix:** Read once, keep it in memory, and move big or structured data to IndexedDB.

**Symptom:** `localStorage is not defined` in a worker
**Cause:** Web storage is main-thread only.
**Fix:** IndexedDB, or message the main thread.

**Symptom:** Data vanished after changing the dev server port
**Cause:** Origin includes the port.
**Fix:** Nothing — expected. Do not rely on it across origins.

**Symptom:** `clear()` broke an unrelated feature
**Cause:** It wipes every key on the origin, including other code's.
**Fix:** Remove your own namespaced keys.

## Interview questions

**★ What can web storage hold?**
Strings, and only strings — everything else is coerced, so an object becomes
`"[object Object]"`. Anything structured goes through `JSON.stringify`/`JSON.parse`, which
means it also inherits JSON's losses: `Date` becomes a string, `undefined` and functions
vanish, `Map` and `Set` become `{}`, and cycles throw.

**★ Why does `setItem` need a `try`/`catch`?**
Because it throws rather than failing softly. `QuotaExceededError` when the origin's quota
is full, and in private-browsing or blocked-storage contexts writes — or even accessing
`localStorage` at all — can throw. The quota is generous enough that this appears in
production and not in development, so the app should be designed to work without storage.

**★ What is the difference between `localStorage` and `sessionStorage`?**
Lifetime and scope. `sessionStorage` is per **tab** and dies when that tab closes; two tabs
on the same site have separate stores. `localStorage` is shared across all tabs of the
origin and persists until removed. "Session" means the browsing context, not the login
session — and neither is cleared by logging out.

**★ Why is web storage unavailable in a Web Worker?**
Because it is synchronous and main-thread only. Offering a blocking disk API to a thread
whose purpose is not blocking the main one would defeat the point. IndexedDB is the
asynchronous, worker-accessible alternative, and it stores structured values rather than
strings.

**★ How is storage scoped?**
By origin — scheme, host **and port**. It is stricter than cookies, which can be shared
across subdomains via the `Domain` attribute; there is no equivalent here. `localhost:3000`
and `localhost:5173` are different stores, which is why switching dev servers looks like
data loss.

**Why treat stored values as untrusted?**
Because storage outlives your code. Yesterday's schema, a partially written value, or
something a user edited in devtools is still there when today's build reads it. Parse
defensively with a fallback, and namespace and version your keys so a shape change does not
mean a crash.

**What is the cost of a synchronous read?**
It blocks the main thread. One large parse at startup sits in the critical rendering path,
and a loop over many keys multiplies it. Read once into memory, write on change, and move
anything large or structured to IndexedDB.

---

[Topic index](./README.md) · Next: [2 · The `storage` event, and choosing storage](./02-the-storage-event-and-choosing.md) →
