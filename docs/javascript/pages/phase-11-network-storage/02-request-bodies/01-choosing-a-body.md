---
title: "02.1 · Choosing a body"
sidebar_label: "01 · Choosing a body"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using FormData Objects](https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects), [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), [`Request.body`](https://developer.mozilla.org/en-US/docs/Web/API/Request/body). Documentation-validated.

**The body type decides the `Content-Type`, and for two of them the browser decides it for
you.** Getting that wrong is the most common cause of a request that looks correct and is
rejected by the server.

## The four you will use

| Body | `Content-Type` | Set it yourself? |
|---|---|---|
| `JSON.stringify(obj)` | `application/json` | **yes** — nothing infers it |
| `FormData` | `multipart/form-data; boundary=…` | 🔴 **no — never** |
| `URLSearchParams` | `application/x-www-form-urlencoded` | set by the browser |
| `Blob` / `File` | the blob's own `type` | usually no |

## JSON — the one you must label

```js
await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email }),
});
```

**A string body gets no automatic `Content-Type`**, so without the header the server sees
`text/plain` and most JSON parsers reject or ignore it. This is the "works in Postman"
failure: Postman sets the header for you.

Note `JSON.stringify` silently drops `undefined`, functions and symbols
([Phase 5 · 09](../../phase-5-built-in-library/09-json/README.md)) — so a field you meant to
send as "unset" simply will not appear. Send `null` if the server needs to see it.

## `FormData` — never set the header

MDN's warning, which is unusually direct:

> "**Warning:** When using `FormData` to submit POST requests using `XMLHttpRequest` or the
> Fetch API with the `multipart/form-data` content type (e.g., when uploading files and blobs
> to the server), ***do not* explicitly set the `Content-Type` header on the request**. Doing
> so will prevent the browser from being able to set the `Content-Type` header **with the
> boundary expression** it will use to delimit form fields in the request body."

```js
const fd = new FormData(formElement);
await fetch(url, { method: "POST", body: fd });         // ✅ browser sets everything

await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "multipart/form-data" },   // ⚠️ breaks the request
  body: fd,
});
```

🔴 **The boundary is the point.** `multipart/form-data` bodies are delimited by a random
boundary string that must appear in the header; only the browser knows the one it generated.
Setting the header by hand supplies a boundary-less value, and the server cannot parse the
body — usually reporting an empty or malformed form rather than a header problem, which sends
you looking in the wrong place.

**This is the single most common `FormData` bug**, and it is especially likely when a shared
`fetch` wrapper sets `Content-Type: application/json` for every request. A wrapper must skip
the header when the body is a `FormData` — covered in
[03 · A `fetch` wrapper worth reusing](../README.md).

Building one from a form is the whole point of the type:

```js
const fd = new FormData(document.querySelector("form"));  // every named field
fd.append("extra", "value");
fd.append("avatar", fileInput.files[0], "avatar.png");    // files, with a filename
```

Only controls with a `name` are included, and disabled controls are excluded — the same rules
as a native form submission, which is why `FormData` is the right choice when a server already
accepts form posts.

## `URLSearchParams` — form-encoded without files

```js
await fetch(url, {
  method: "POST",
  body: new URLSearchParams({ q: "hello world", page: "2" }),
});
```

The browser sets `application/x-www-form-urlencoded`, and every value is percent-encoded
correctly — including spaces, `&` and `=`, which is exactly what hand-built strings get wrong.

**Use it for simple key/value posts with no files.** For files you need `FormData`; the
url-encoded format cannot carry binary.

The same object also builds query strings, which is
[04 · `URL` and `URLSearchParams`](../README.md).

## `Blob` and `File`

```js
await fetch(url, { method: "PUT", body: file });   // Content-Type from file.type
```

A `Blob` carries its own `type`, and the browser uses it. Useful for direct uploads to object
storage, where a multipart wrapper is not wanted. `File` extends `Blob`, so a file input's
entry works directly.

## Two constraints on any body

**`GET` and `HEAD` cannot have one.** Passing `body` with `method: "GET"` throws a `TypeError`.
Query parameters are the only way to send data with a `GET` — again
[04](../README.md).

**A `Request`'s body is read-once**, exactly like a response's
([01 · 01](../01-fetch/01-the-critical-surprise.md)). Reusing one `Request` object for a retry
fails; construct a new one, or `clone()` before the first send. A retry helper that stores a
`Request` and replays it is a real bug for this reason.

## Gotchas

**Symptom:** The server sees no JSON, or rejects the body
**Cause:** No `Content-Type: application/json`. A string body is not labelled automatically.
**Fix:** Set the header. This is the "works in Postman" case — Postman sets it for you.

**Symptom:** A `FormData` upload arrives empty or unparseable
**Cause:** `Content-Type` was set manually, so the **boundary** is missing. MDN: *"do not
explicitly set the `Content-Type` header."*
**Fix:** Omit it entirely, including in any shared wrapper.

**Symptom:** Uploads break only when going through the app's `fetch` wrapper
**Cause:** The wrapper adds `Content-Type: application/json` unconditionally.
**Fix:** Skip the header when the body is a `FormData`.

**Symptom:** A field is missing from a JSON body
**Cause:** Its value was `undefined`, which `JSON.stringify` drops.
**Fix:** Send `null` if the server must see the field.

**Symptom:** Special characters are mangled in a form-encoded post
**Cause:** The body was hand-built by string concatenation.
**Fix:** `URLSearchParams`, which encodes correctly.

**Symptom:** `TypeError` when sending a body with `GET`
**Cause:** `GET` and `HEAD` cannot have bodies.
**Fix:** Use query parameters, or change the method.

**Symptom:** A retry of the same `Request` sends an empty body
**Cause:** A request body is read-once, like a response body.
**Fix:** Build a new `Request`, or `clone()` before the first send.

## Interview questions

**★ Which body types set their own `Content-Type`?**
`FormData` (`multipart/form-data` **with a boundary**), `URLSearchParams`
(`application/x-www-form-urlencoded`) and `Blob`/`File` (the blob's `type`). A **string** does
not — JSON must be labelled by hand.

**★ Why must you never set `Content-Type` for a `FormData` body?**
MDN: doing so *"will prevent the browser from being able to set the `Content-Type` header with
the **boundary expression** it will use to delimit form fields"*. Without the boundary the
server cannot parse the body, and it usually reports an empty form rather than a header
problem.

**★ Why do uploads break only through the shared `fetch` wrapper?**
Because the wrapper sets `Content-Type: application/json` for every request, which destroys
the `FormData` boundary. A wrapper must skip the header for `FormData` bodies.

**★ When would you choose `URLSearchParams` over `FormData`?**
Simple key/value posts with **no files**. It is form-encoded, correctly percent-encoded, and
smaller. `FormData` is needed for binary and for `<input type="file">`.

**★ Why does a retried `Request` send an empty body?**
A request body is a **read-once stream**, like a response body. Construct a new `Request` per
attempt, or clone before the first send.

**Why does a JSON field go missing?**
`JSON.stringify` drops `undefined` values. Send `null` when the server needs to see the field
explicitly.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
