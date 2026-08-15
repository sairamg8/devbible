---
title: "3 · Scale, and what the server must do"
sidebar_label: "3 · Scale and the server"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Blob.slice()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice), [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [`Content-Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type), [`X-Content-Type-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options), [XSS](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController). Documentation-validated; **no timings**.

[Chunk 2](./02-sending-it.md) sent one file in one request. **This chunk is what changes
when the file is large, the connection is unreliable, or the upload is hostile.**

## Chunked and resumable uploads

**`Blob.slice` is the whole mechanism** — it returns a new `Blob` over a byte range without
reading anything:

```js
const CHUNK = 5 * 1024 * 1024;

async function uploadInChunks(file, uploadId, signal) {
  const total = Math.ceil(file.size / CHUNK);
  for (let i = 0; i < total; i++) {
    const chunk = file.slice(i * CHUNK, (i + 1) * CHUNK);   // ✅ no read, no copy
    await fetch(`/upload/${uploadId}/part/${i}`, {
      method: "PUT",
      body: chunk,
      signal,
    });
    onProgress((i + 1) / total);                            // ✅ progress, without XHR
  }
  await fetch(`/upload/${uploadId}/complete`, { method: "POST" });
}
```

**What chunking buys, in order of how much it matters:**

1. **Resumability.** A dropped connection costs one chunk, not the whole file. Ask the
   server which parts it already has and skip them.
2. **Progress** without XHR.
3. **Getting past request size limits** on proxies, gateways and serverless platforms.
4. **Parallelism**, if the server supports out-of-order parts — with a concurrency limit,
   not `Promise.all` over every chunk.

⚠️ **It is not free.** The server must track parts, reassemble them, and expire abandoned
uploads; every chunk is a round trip; and ordering and retries are now your problem. **For
files under a few megabytes it is pure complexity** — send the whole thing.

## Uploading straight to storage

**The pattern that removes your server from the data path entirely:**

1. The client asks your API for a **presigned URL**.
2. Your API authorises the user, decides the key and constraints, and returns the URL.
3. The client `PUT`s the file straight to the storage service.
4. The client tells your API it finished — or storage notifies it.

✅ **Your server never handles the bytes**, so it does not need the bandwidth, the memory
or the request-size limit raised. This is the default for anything large.

⚠️ **Two things to get right:** the storage bucket needs **CORS** configured for your
origin or the browser will block the `PUT`
([05 · CORS from the client side](../05-cors-client-side/README.md)), and the presigned URL
must be **short-lived and constrained** — key, content type, maximum size — because
anything it permits, it permits to whoever holds it.

## What the client cannot enforce

🔴 **Every check in [chunk 1](./01-getting-the-file.md) is advisory.** The request can be
replayed from a terminal with any body at all. **The server must independently:**

- **Enforce the size limit**, and stop reading past it rather than buffering the whole
  body first.
- **Determine the real content type** from the bytes, not from the filename or the
  client's `Content-Type`.
- **Choose the stored name.** Never use the client's filename as a path — it can contain
  `../`, and it can collide.
- **Decide authorisation** — that this user may upload, here, now, this many times.
- **Serve it back safely.** An uploaded file served from your origin with a
  guessed content type is stored XSS. Serve user content from a separate origin, with
  `Content-Type` set explicitly and `X-Content-Type-Options: nosniff`.

⚠️ **That last one is the one teams miss**, because the upload works and the bug only
appears when someone uploads an HTML file and sends the link to a colleague.

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
**Fix:** XHR, or chunk the upload and count chunks.

**Symptom:** A cancelled upload still appeared on the server
**Cause:** Abort stops the client; the bytes may already have arrived.
**Fix:** A client-generated upload id, so a retry replaces rather than duplicates.

**Symptom:** Large uploads failed at a proxy or gateway
**Cause:** A request size limit upstream of your application.
**Fix:** Chunk, or upload directly to storage with a presigned URL.

**Symptom:** A direct-to-storage `PUT` was blocked by the browser
**Cause:** The bucket has no CORS configuration for your origin.
**Fix:** Configure CORS on the bucket; it is not something the page can fix.

**Symptom:** Uploading many files at once froze the page
**Cause:** One request per file, all started together.
**Fix:** A concurrency limit — a handful in flight, the rest queued.

**Symptom:** An uploaded HTML file executed on your domain
**Cause:** User content served from your origin with a sniffable content type.
**Fix:** A separate origin, an explicit `Content-Type`, and `nosniff`.

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

**★ What does chunking buy, and what does it cost?**
It buys resumability — a dropped connection costs one chunk — plus progress without XHR,
a way past upstream request size limits, and optional parallelism. It costs a server that
must track, reassemble and expire parts, a round trip per chunk, and ordering and retry
logic. Below a few megabytes it is complexity for nothing.

**★ What is a presigned upload, and what must you check?**
The client asks your API for a short-lived URL, then `PUT`s the file straight to storage, so
your server never touches the bytes. Two things must be right: CORS on the bucket for your
origin, or the browser blocks the request; and a tightly constrained, short-lived URL —
key, content type, maximum size — since it authorises whoever holds it.

**What must the server do that the client cannot?**
Everything that matters. Enforce the size limit while reading rather than after, determine
the real type from the bytes, choose the stored name rather than trusting the client's,
authorise the upload, and serve the file back safely — a separate origin, an explicit
content type and `nosniff`, or an uploaded HTML file becomes stored XSS.

---

← [1 · Getting the file](./01-getting-the-file.md) · [Topic index](./README.md) · [Phase index](../README.md) →
