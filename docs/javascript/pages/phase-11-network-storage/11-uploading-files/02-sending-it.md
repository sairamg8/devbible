---
title: "2 · Sending it"
sidebar_label: "2 · Sending it"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [`FormData.append()`](https://developer.mozilla.org/en-US/docs/Web/API/FormData/append), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`Content-Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type), [`XMLHttpRequest.upload`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload), [`ProgressEvent`](https://developer.mozilla.org/en-US/docs/Web/API/ProgressEvent), [`Blob.slice()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`RequestInit.duplex`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit), [CORS preflight](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#preflighted_requests). Documentation-validated; **no timings**.

## `FormData` — and the header you must not set

```js
const body = new FormData();
body.append("file", file);                 // ✅ the File itself; nothing is read
body.append("file", file2, "renamed.png"); // ✅ optional filename override
body.append("albumId", "42");              // ✅ ordinary fields alongside

await fetch("/upload", { method: "POST", body });
```

🔴 **Do not set `Content-Type`.**

```js
await fetch("/upload", {
  method: "POST",
  body,
  headers: { "Content-Type": "multipart/form-data" },   // 🔴 breaks the request
});
```

**A multipart body is split by a random boundary string, and the header must name it** —
`multipart/form-data; boundary=----WebKitFormBoundaryXyZ`. The browser generates that
boundary and writes the header itself. Setting the header by hand replaces it with one that
has **no boundary**, so the server cannot parse the body and you get a 400 with a message
about a missing boundary or an empty request.

⚠️ **This is the most common upload bug there is**, and it is usually introduced by a
`fetch` wrapper that sets JSON headers for every request
([03 · A `fetch` wrapper worth reusing](../03-fetch-wrapper/README.md)). **The wrapper must
skip `Content-Type` when the body is `FormData`:**

```js
const headers = body instanceof FormData ? {} : { "Content-Type": "application/json" };
```

**`FormData` also takes a form element wholesale**, which is the least code for a plain
form:

```js
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  await fetch(form.action, { method: "POST", body: new FormData(form) });
});
```

## The other body shapes

```js
// raw — one file, nothing else. The server reads the whole body as the file.
await fetch("/upload", {
  method: "PUT",
  headers: { "Content-Type": file.type || "application/octet-stream" },
  body: file,                     // ✅ a File is a Blob; fetch streams it
});
```

**Raw is right when there is exactly one file and no metadata** — a presigned storage
upload is nearly always this shape. Metadata goes in the URL, the headers, or a separate
request.

🔴 **What is not right is base64 inside JSON:**

```js
body: JSON.stringify({ file: await toBase64(file) })   // 🔴
```

**It costs about a third more bytes, reads the entire file into memory as a string, and
blocks the main thread doing it** — for a format the server has to decode again
([Phase 5 · 26 · 02 · Base64](../../phase-5-built-in-library/26-text-encoding/02-base64.md)).
`FormData` sends the same bytes with none of that. The only defensible reason is an API you
do not control that accepts nothing else.

## 🔴 Progress — and why `fetch` cannot give it

**`fetch` has no upload progress event.** The promise settles when the response arrives;
there is nothing in between. For a download you can read `response.body` as a stream
([07 · Reading responses](../07-reading-responses/README.md)), but that is the wrong
direction.

✅ **`XMLHttpRequest` still owns this**, and that is the honest reason it is not dead:

```js
function upload(file, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);   // ✅ 0…1
    });

    xhr.addEventListener("load", () => (xhr.status < 400 ? resolve(xhr.response) : reject(xhr)));
    xhr.addEventListener("error", reject);
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });

    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}
```

⚠️ **Note `xhr.upload`, not `xhr`.** Listening on the request object gives you *download*
progress; the upload has its own `XMLHttpRequestUpload` target, and using the wrong one is
why a progress bar sometimes jumps straight to 100%.

⚠️ **And `lengthComputable` can be `false`**, in which case `e.total` is meaningless and
the honest UI is an indeterminate spinner, not a fake percentage. The full XHR treatment is
**21 · `XMLHttpRequest`** *(later in this phase)*.

**There is a `fetch` path** — a `ReadableStream` request body with `duplex: "half"` — that
lets you count bytes as they are enqueued. ⚠️ **It is not broadly available and it needs
HTTP/2**; treat it as a progressive enhancement, not the plan.

✅ **The other honest option is chunking** ([chunk 3](./03-scale-and-the-server.md)): with
ten chunks you have ten progress points without XHR at all.

## Cancelling

```js
const controller = new AbortController();
fetch("/upload", { method: "POST", body, signal: controller.signal });
controller.abort();
```

**Uploads are the case where cancellation matters most** — they are the longest-running
requests a page makes.

🔴 **But abort does not un-send what already left**
([08 · 02](../08-aborting-and-timing-out/02-cancellation-as-a-lifecycle.md)). A cancelled
upload may have delivered a complete file, and the server may have stored it. **Give every
upload a client-generated id** so a retry replaces rather than duplicates, and so the
server can clean up what was abandoned.

## Gotchas

**Symptom:** The server saw an empty body or complained about a missing boundary
**Cause:** `Content-Type` was set manually with `FormData`, replacing the browser's header
that carries the boundary.
**Fix:** Do not set it. Make your fetch wrapper skip it for `FormData` bodies.

**Symptom:** A progress bar jumped straight to 100%
**Cause:** The listener is on `xhr` rather than `xhr.upload`, so it is reporting the
download.
**Fix:** `xhr.upload.addEventListener("progress", …)`.

**Symptom:** Progress percentages were nonsense
**Cause:** `lengthComputable` is `false`, so `e.total` is meaningless.
**Fix:** Check the flag and show an indeterminate state instead.

**Symptom:** No progress at all with `fetch`
**Cause:** `fetch` has no upload progress.
**Fix:** XHR, or chunk the upload and count chunks ([chunk 3](./03-scale-and-the-server.md)).

**Symptom:** A cancelled upload still appeared on the server
**Cause:** Abort stops the client; the bytes may already have arrived.
**Fix:** A client-generated upload id, so a retry replaces rather than duplicates.

**Symptom:** Uploading many files at once froze the page
**Cause:** One request per file, all started together.
**Fix:** A concurrency limit — a handful in flight, the rest queued.

**Symptom:** Memory spiked while uploading a large file
**Cause:** The file was read into a string or an `ArrayBuffer` first.
**Fix:** Pass the `File` itself; the browser streams it without reading it.

## Interview questions

**★ Why must you not set `Content-Type` when sending `FormData`?**
Because a multipart body is delimited by a random boundary string that must be named in the
header. The browser generates the boundary and writes the header; setting it by hand
produces `multipart/form-data` with no boundary, so the server cannot parse the body. It is
usually introduced by a fetch wrapper that adds JSON headers to everything, and the fix is
to skip the header for `FormData`.

**★ How do you show upload progress?**
Not with `fetch` — it has no upload progress event. `XMLHttpRequest` does, via
`xhr.upload`'s `progress` event, and listening on `xhr` itself gives download progress
instead, which is why bars sometimes jump to 100%. Check `lengthComputable` before computing
a percentage. The alternative without XHR is chunking, where each completed chunk is a
progress point.

**★ Why is base64-in-JSON the wrong way to upload a file?**
It inflates the payload by about a third, reads the entire file into memory as a string,
and blocks the main thread doing so — all for something the server must decode again.
`FormData` or a raw `Blob` body sends the same bytes with no encoding step, because a `File`
is a `Blob` the browser streams.

**★ What does aborting an upload actually guarantee?**
Only that your page stops listening and stops sending. Bytes already delivered are already
delivered, and the server may have a complete file. Give every upload a client-generated id
so a retry replaces rather than duplicates, and so abandoned uploads can be cleaned up.

**When is a raw body better than `FormData`?**
When there is exactly one file and no metadata — a presigned storage `PUT` is almost always
this shape. `FormData` earns its overhead when fields travel with the file.

---

← [1 · Getting the file](./01-getting-the-file.md) · [Topic index](./README.md) · Next: [3 · Scale, and what the server must do](./03-scale-and-the-server.md) →
