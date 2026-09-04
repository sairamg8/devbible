---
title: "12 · `Blob`, `File`, `FileReader` and object URLs"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob), [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File), [`FileReader`](https://developer.mozilla.org/en-US/docs/Web/API/FileReader), [`URL.createObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static), [`URL.revokeObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static), [`Blob.text()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text), [`Blob.arrayBuffer()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer), [`Blob.stream()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream). Documentation-validated; **no timings**.

**A `Blob` is a handle to a lump of bytes that the browser holds and your JavaScript does
not.** That sentence is the whole topic. The bytes may be on disk, in memory, or streaming
from the network; the object you hold is a reference with a `size` and a `type`, and
reading it is an explicit, asynchronous act you should usually avoid.

🔴 **The recurring mistake is reading when you did not need to.** Previewing an image,
uploading a file, saving a download, storing something in IndexedDB — none of these require
the bytes to pass through JavaScript, and doing it anyway turns a free operation into a
main-thread stall and a memory spike.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`Blob` and `File`](./01-blob-and-file.md)** | What a `Blob` is and how one is made; `size` and `type`, and that `type` is a label rather than a fact; 🔴 **`slice()` costing nothing**; `File` as a `Blob` with a name; the four modern read methods and when each is right; and `FileReader`, why it still exists and why you almost never need it |
| 2 | **[Object URLs, and reading without reading](./02-object-urls.md)** | `createObjectURL` for previews, downloads and workers; 🔴 **`revokeObjectURL` and the leak that never shows up in testing**; object URL versus data URL versus a read; generating a file for download; and where a `Blob` should go instead of into a string |

## The one rule

```js
const url = URL.createObjectURL(blob);   // ✅ a reference — nothing is read or copied
img.src = url;
// … when the image is no longer needed:
URL.revokeObjectURL(url);                // ✅ mandatory, and easy to forget
```

**Prefer handing the `Blob` to whatever consumes it** — an `<img>`, `fetch`, IndexedDB, a
worker — over reading it into a string or an `ArrayBuffer`. Read only when your code
genuinely has to look at the bytes.

## Phase gate

You are done with this topic when you can say **why `blob.slice()` is cheap regardless of
the file's size**, and **what leaks when you forget `revokeObjectURL`**.

## Where this connects

- [11 · Uploading files](../11-uploading-files/README.md) — where the `File` came from, and why it is sent without reading
- [11 · 03 · Scale, and what the server must do](../11-uploading-files/03-scale-and-the-server.md) — `slice` in its chunked-upload role
- [07 · Reading responses](../07-reading-responses/README.md) — `Response` has the same read methods, for the same reason
- [Phase 5 · 25 · Typed arrays](../../phase-5-built-in-library/25-typed-arrays/README.md) — what `arrayBuffer()` gives you
- [Phase 5 · 26 · Text encoding](../../phase-5-built-in-library/26-text-encoding/README.md) — what `text()` does under the hood, and its encoding assumption
- **16 · IndexedDB** *(later in this phase)* — stores `Blob`s directly, so no encoding is needed

---

Start → [1 · `Blob` and `File`](./01-blob-and-file.md)
