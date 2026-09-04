---
title: "21 · `XMLHttpRequest`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`XMLHttpRequest`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest), [`XMLHttpRequest.upload`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload), [`ProgressEvent`](https://developer.mozilla.org/en-US/docs/Web/API/ProgressEvent). Documentation-validated; **no timings**.

**The previous generation of the same job.** MDN recommends `fetch` for new work, and this
page exists for the two reasons XHR is still worth knowing: **you will read it in existing
code**, and **`xhr.upload` reports upload progress, which `fetch` cannot**.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What it still does](./01-what-it-still-does.md)** | The `open`/`setRequestHeader`/`send` shape and the event set; the `readyState` table and ⚠️ **why `4` does not mean success**; `responseType` and the `responseText` trap; 🔴 **`xhr.upload` progress and `lengthComputable`**; a full mapping onto `fetch`; and why **synchronous XHR** is deprecated |

## The one thing to remember

```js
xhr.upload.addEventListener("progress", (e) => {   // ✅ upload — no fetch equivalent
  if (e.lengthComputable) setPercent((e.loaded / e.total) * 100);
});

xhr.addEventListener("progress", …);               // ❌ this is DOWNLOAD progress
```

## Phase gate

You are done with this topic when you can say **the one capability XHR has that `fetch` does
not**, and **why synchronous XHR is deprecated**.

## Where this connects

- [01 · `fetch`](../01-fetch/README.md) — what replaced it, and what every XHR concept maps onto
- [08 · Aborting and timing out](../08-aborting-and-timing-out/README.md) — `AbortController` in place of `abort()` and `timeout`
- [11 · 02 · Sending the file](../11-uploading-files/02-sending-it.md) — where `xhr.upload` is actually used
- [20 · `sendBeacon` and keepalive](../20-sendbeacon-keepalive/README.md) — what replaced synchronous XHR at unload

---

Start → [1 · What it still does](./01-what-it-still-does.md)
