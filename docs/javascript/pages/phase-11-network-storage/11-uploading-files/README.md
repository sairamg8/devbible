---
title: "11 · Uploading files"
sidebar_label: "Overview"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file), [`FileList`](https://developer.mozilla.org/en-US/docs/Web/API/FileList), [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File), [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API), [`DataTransfer`](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer), [`XMLHttpRequest.upload`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload), [`Blob.slice()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice). Documentation-validated; **no timings**.

**An upload is three separate problems, and mixing them up is why upload code is usually
worse than it needs to be:** getting a `File` from the user, sending its bytes, and telling
the user what is happening while it takes a while.

🔴 **Two facts shape everything here.** A `File` is just a `Blob` with a name, so the
browser never needs to read it into memory to send it — and **`fetch` has no upload
progress**, which is the single reason `XMLHttpRequest` is still in production code in
2026.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Getting the file](./01-getting-the-file.md)** | `<input type="file">`, the array-like `FileList`, and 🔴 **why selecting the same file twice fires nothing**; `accept`, `multiple` and `capture` as hints rather than rules; drag-and-drop and the two `preventDefault` calls without which the browser navigates away; paste; and client-side validation — what it is for, and why `file.type` must never be trusted |
| 2 | **[Sending it](./02-sending-it.md)** | `FormData` and 🔴 **the `Content-Type` header you must not set**, and the fetch wrapper that causes it; raw-body uploads, and why base64-in-JSON is the wrong default; upload progress, why `fetch` cannot give it, and the `xhr.upload` target people listen on wrongly; and cancelling, including what abort does not undo |
| 3 | **[Scale, and what the server must do](./03-scale-and-the-server.md)** | Chunked and resumable uploads with `Blob.slice`, what chunking buys and what it costs; uploading straight to storage with a presigned URL, and the two things that must be right; and 🔴 **the five server-side rules a client cannot enforce** — including serving user content back without turning an upload into stored XSS |

## The shape

```js
const file = input.files[0];               // a File — which is a Blob with a name
const body = new FormData();
body.append("file", file);                 // no reading, no encoding

await fetch("/upload", { method: "POST", body });   // ✅ do NOT set Content-Type
```

**Four lines is the whole happy path.** Everything else in this topic is progress,
cancellation, size, and not trusting the client.

## Phase gate

You are done with this topic when you can say **why setting `Content-Type` on a `FormData`
request breaks it**, and **why an upload progress bar cannot be built on `fetch` alone**.

## Where this connects

- [02 · Request bodies](../02-request-bodies/README.md) — every body type `fetch` accepts, including `FormData` and `Blob`
- [08 · Aborting and timing out](../08-aborting-and-timing-out/README.md) — cancelling an upload mid-flight
- **12 · `Blob`, `File` and `FileReader`** *(next in this phase)* — the objects themselves, previews and object URLs
- **21 · `XMLHttpRequest`** *(later in this phase)* — the API that still owns upload progress
- [Phase 5 · 25 · Typed arrays](../../phase-5-built-in-library/25-typed-arrays/README.md) — what a file's bytes are once you read them
- [Phase 5 · 26 · 02 · Base64](../../phase-5-built-in-library/26-text-encoding/02-base64.md) — why base64-encoding an upload costs a third of it for nothing

---

Start → [1 · Getting the file](./01-getting-the-file.md)
