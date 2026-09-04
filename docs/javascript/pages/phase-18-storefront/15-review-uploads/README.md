---
title: "15 · Review uploads"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [`FormData.append()`](https://developer.mozilla.org/en-US/docs/Web/API/FormData/append), [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File), [`URL.createObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static), [`XMLHttpRequest.upload`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload), [`Request.duplex`](https://developer.mozilla.org/en-US/docs/Web/API/Request/duplex), [`createImageBitmap()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [`HTMLCanvasElement.toBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), [`OffscreenCanvas.convertToBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob), [CSS `image-orientation`](https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation), [SVG as an image](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_Image), [`X-Content-Type-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options). Documentation-validated; **no timings and no console output**.

The syllabus row is *`FormData`, upload progress, client-side image resize through Canvas, and
validating a file you cannot trust* — the review form where a customer attaches photos of what
actually arrived.

🔴 **This is the only feature on the storefront where a stranger puts bytes into your product
page.** That fact drives the whole topic: how the photos are held, when they are sent, what is done
to them before they leave, and why none of it counts as security.

**The mechanics live in [Phase 11 · 11 · Uploading files](../../phase-11-network-storage/11-uploading-files/README.md)**
— the input, `FileList`, drag-and-drop, `FormData`, `xhr.upload`, chunking, presigned URLs. This
topic is the *feature* built on them, and it restates a mechanic only in the one line needed to use
it.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The photo list](./01-the-photo-list.md)** | Why the state is **records, not a `FileList`**; append-never-replace and 🔴 **`input.value = ''`**; deduplicating by name+size+lastModified; one entry point for picker, drop and paste; object-URL previews and 🔴 **the revoke**; remove = **drop + abort + revoke**; rendering from the records without blanking thumbnails |
| 02 | **[Uploading and submitting](./02-uploading-and-submitting.md)** | 🔴 **One request per photo**, with the table of why; the two `FormData` traps — **never set `Content-Type`**, and the **filename argument that defaults a `Blob` to `"blob"`**; `postWithProgress` on `xhr.upload` and why `fetch` cannot do it; cancel, retry and the single-use `AbortSignal`; 🔴 **the submit that sends ids, not bytes**; `beforeunload`, draft persistence and the four accessibility points |
| 03 | **[Resizing before upload](./03-resizing-before-upload.md)** | The four-step canvas pipeline; 🔴 **`createImageBitmap` and `imageOrientation: 'from-image'`** — why the preview looks upright and the upload does not; `resizeQuality` defaulting to `"low"`; `bitmap.close()`; the canvas ceiling and **iOS's 4096×4096**; `toBlob`'s **PNG default**, its **`null`**, and JPEG having no alpha; `OffscreenCanvas.convertToBlob` in a worker; 🔴 **when not to resize**, including HEIC |
| 04 | **[A file you cannot trust](./04-a-file-you-cannot-trust.md)** | The four-rung ladder — size/type → **magic bytes** → **a real decode** → the server; why `accept` and `file.type` enforce nothing; 🔴 **the re-encode as the strongest client-side sanitisation**, and **EXIF GPS as a privacy problem**; why **SVG is never a review photo**; and the server-side list a client cannot substitute for |

## Four facts worth carrying out of this topic

- **Upload on selection, submit ids.** The review POST is a small retryable JSON body, and a failed
  photo can never destroy a paragraph the user typed.
- **A resized photo is a `Blob`, so it uploads as `blob`.** `FormData.append()` takes a filename as
  its third argument, and forgetting it is silent.
- **`createImageBitmap` honours EXIF orientation by default; the `<img>` + `drawImage` route may
  not.** That mismatch is where sideways uploads come from — the preview was never wrong.
- **Re-encoding through the canvas strips EXIF, and EXIF holds GPS.** The privacy win is a better
  argument for client-side resizing than the bytes saved.

## The phase gate

You are done with this topic when you can explain **why the photos are uploaded before the review is
submitted**, **why an upload progress bar still needs `XMLHttpRequest`**, and **which of your file
checks would survive a client that ignores your JavaScript** — the answer being none of them.

## Where this connects

- [Phase 11 · 11 · Uploading files](../../phase-11-network-storage/11-uploading-files/README.md) — the input, `FormData`, progress, chunking and the server's rules
- [Phase 11 · 12 · `Blob`, `File` and `FileReader`](../../phase-11-network-storage/12-blob-file-filereader/README.md) — the objects themselves, `slice`, object URLs and revoking
- [Phase 11 · 21 · `XMLHttpRequest`](../../phase-11-network-storage/21-xmlhttprequest/README.md) — the API that still owns upload progress
- [Phase 12 · 07 · Web Workers](../../phase-12-browser-platform/07-web-workers/README.md) — where the resize belongs
- [Phase 12 · 02 · Client-side security](../../phase-12-browser-platform/02-client-side-security/README.md) — the trust boundary this topic sits on
- [Phase 7 · 16 · Concurrency limiting](../../phase-7-async/16-concurrency-limiting/README.md) — the pool that keeps five uploads from crawling
- [03 · A resilient API client](../03-resilient-api-client/README.md) — the wrapper that must not set `Content-Type` for `FormData`
- [07 · Idempotency from the client](../07-idempotency/README.md) — the `requestId` that stops a retried submit becoming two reviews

---

Start → [01 · The photo list](./01-the-photo-list.md)
