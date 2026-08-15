---
title: "01 · The body readers"
sidebar_label: "01 · The body readers"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Response.json()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json), [`Response.text()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/text), [`Response.blob()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/blob), [`Response.arrayBuffer()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/arrayBuffer), [`Response.formData()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/formData), [`URL.createObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static). Documentation-validated; **no timings**.

Six methods turn a response body into something usable. Choosing correctly is mostly about what you
are going to do with it — and about not turning a 50 MB download into a 50 MB string.

| Method | Returns | For |
|---|---|---|
| `json()` | the parsed value | APIs |
| `text()` | a string | HTML, CSV, plain text, **and anything you must parse defensively** |
| `blob()` | a `Blob` | images, files, anything you will display or download |
| `arrayBuffer()` | an `ArrayBuffer` | binary you will inspect byte by byte |
| `bytes()` | a `Uint8Array` | the same, without wrapping it yourself |
| `formData()` | a `FormData` | multipart or urlencoded bodies — mostly server-side |

All six are promises, and all six **consume the body** — see
[06 · The three objects](../06-request-response-headers/01-the-three-objects.md).

## `json()`, and why wrappers use `text()` instead

```js
const res = await fetch(url);
if (!res.ok) throw new HttpError(res.status, res.statusText);
const data = await res.json();
```

That is correct until the body is empty. 🔴 **`json()` on an empty body rejects** — a 204 No
Content, a 500 that returned nothing, or a proxy that truncated the response — with a parse error
that names JSON rather than the real problem.

The defensive shape, which is what belongs in a wrapper:

```js
const raw = await res.text();          // one read, always safe
const data = raw ? JSON.parse(raw) : null;
```

It also gives you the raw text for the error message when parsing fails, which is how you discover
the API returned an HTML error page with `Content-Type: application/json`.

📌 `json()` **does not check the `Content-Type`.** It parses whatever the body is, so a
`text/html` error page produces "Unexpected token `<`" — the most familiar wrong-thing-returned
message in front-end work.

## `blob()` — files and images

```js
const res = await fetch('/invoice.pdf');
const blob = await res.blob();

const url = URL.createObjectURL(blob);
iframe.src = url;
// …when finished with it:
URL.revokeObjectURL(url);
```

🔴 **Every `createObjectURL` needs a `revokeObjectURL`.** The URL holds the blob alive for the
document's lifetime otherwise — a leak that grows with every preview the user opens
([Phase 9 · 10 · 02](../../phase-9-dom/10-removing-and-replacing/02-cleanup.md)).

A `Blob` knows its `size` and `type`, can be sliced (`blob.slice(start, end)`) for chunked uploads,
and can be read as text (`await blob.text()`) — so `blob()` is not a dead end when you change your
mind.

## `arrayBuffer()` and `bytes()` — binary

```js
const buffer = await res.arrayBuffer();      // ArrayBuffer
const view = new DataView(buffer);
const magic = view.getUint32(0);             // read a file signature

const bytes = await res.bytes();             // Uint8Array directly
```

Use these when you are parsing a format — a PNG header, a protobuf frame, a WASM module. For
anything you are only going to hand to the DOM or upload again, `blob()` is cheaper to reason
about because it stays opaque.

## `formData()`

Parses a `multipart/form-data` or `application/x-www-form-urlencoded` **body** into a `FormData`.
On the client this is rare — you send those, you rarely receive them — but it is exactly what a
service worker needs when it intercepts a form submission
([Phase 9 · 09 · Forms](../../phase-9-dom/09-forms/01-formdata.md)).

## Choosing, in one rule

**Ask what the data is going to be, not what it looks like.** A CSV you will parse is `text()`. A
CSV the user will download is `blob()`. The same bytes; different destination, different method.

⚠️ **Do not read a large download with `text()` or `json()`.** Both materialise the whole body in
memory at once. For anything big, stream it
([02 · Streaming a body](./02-streaming-a-body.md)) or keep it as a `Blob`, which the browser can
back with disk.

## Errors these methods throw

| Situation | What you see |
|---|---|
| body already read | `TypeError: body stream already read` |
| empty body with `json()` | a JSON parse error |
| HTML error page with `json()` | `Unexpected token '<'` |
| the connection drops mid-body | the reader's promise **rejects** — `res.ok` was already `true` |

🔴 **That last row is the one people miss.** `fetch` resolves as soon as the **headers** arrive, so
`res.ok` is true before the body has been transferred. A truncated download fails at
`await res.json()`, not at the fetch — which is why the parse call belongs inside the same
`try`/`catch`.

## Gotchas

**Symptom: `Unexpected token '<' … is not valid JSON`.**
Cause — the server returned an HTML error page; `json()` does not check `Content-Type`.
Fix — read `text()`, and include the first part of it in the thrown error so the real response is
visible.

**Symptom: a 204 breaks the wrapper.**
Cause — `json()` on an empty body rejects.
Fix — `text()` then conditional `JSON.parse`.

**Symptom: memory climbs as the user previews images.**
Cause — object URLs never revoked.
Fix — `URL.revokeObjectURL(url)` when the preview is replaced or removed.

**Symptom: a large file download uses enormous memory.**
Cause — `text()` or `json()` buffers the whole body.
Fix — `blob()`, or stream it.

**Symptom: the request "succeeded" but the data is incomplete.**
Cause — `fetch` resolved on headers; the connection dropped during the body.
Fix — treat the body read as part of the request: wrap it in the same `try`, and validate what you
parsed.

**Symptom: `res.formData()` throws on a JSON response.**
Cause — the body is not multipart or urlencoded.
Fix — use the reader that matches what the server actually sent.

## Interview questions

**★ Why do experienced wrappers call `text()` and parse, instead of `json()`?**
Because `json()` rejects on an empty body (204, empty error responses) and gives a parse error that
hides the real cause when the server returns HTML. Reading text once keeps the raw body available
for the error message.

**★ When would you use `blob()` over `arrayBuffer()`?**
When you are going to display, download or re-upload the data rather than inspect it. A `Blob` stays
opaque and can be backed by disk; an `ArrayBuffer` is bytes in memory, for when you are parsing a
format.

**★ What must accompany every `URL.createObjectURL()`?**
A `revokeObjectURL()`. Otherwise the blob is kept alive for the document's lifetime — a leak that
grows with every preview.

**★ Does `fetch` resolving mean the whole response arrived?**
No — it resolves when the headers arrive. A connection that drops mid-body fails at the body-reading
call, so the parse belongs in the same `try` as the fetch.

**★ Why might `json()` fail even though the server "sent JSON"?**
Because `json()` ignores `Content-Type` and parses whatever the body is. An HTML error page mislabelled
as JSON produces `Unexpected token '<'`.

**What is `formData()` for on the client?**
Rarely used directly — mainly service workers intercepting a form submission, where the request body
is multipart or urlencoded and needs parsing.

---

[Topic index](./README.md) · [02 · Streaming a body](./02-streaming-a-body.md) →
