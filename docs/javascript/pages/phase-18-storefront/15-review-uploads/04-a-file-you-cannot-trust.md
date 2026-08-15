---
title: "04 · A file you cannot trust"
sidebar_label: "04 · A file you cannot trust"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File), [`Blob.slice()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice), [`Blob.arrayBuffer()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer), [`createImageBitmap()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [`HTMLImageElement.decode()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode), [`<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file), [SVG as an image](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_Image), [`X-Content-Type-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options), [`Content-Disposition`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition). Documentation-validated; **no timings and no console output**.

A review photo is a file **a stranger chose**, uploaded to your storefront, and then shown to every
other customer. It is the only place on the site where an untrusted party puts bytes into your
product page, which makes it the one feature where the trust boundary has to be stated out loud.

🔴 **The client validates for feedback. The server validates for safety. They are different checks
and you need both.** Everything the browser can test, the browser can also skip — the request can be
replayed from a terminal with any bytes and any headers at all.

## The ladder — four rungs, cheapest first

| Rung | Check | Costs | Catches |
|---|---|---|---|
| 1 | count, `file.size`, `file.type` | nothing | the honest mistake — 40 MB, twelve photos, a PDF |
| 2 | magic bytes (`file.slice(0, 12)`) | a few bytes read | a renamed file, a wrong extension |
| 3 | does it actually decode as an image? | a decode | truncated, corrupt or fake images |
| 4 | **the server** | a round trip | ✅ **everything, because it is the only check that counts** |

**Rungs 1–3 exist so the user finds out in a second instead of after a two-minute upload.** That is
a real feature and it is worth building. It is not security.

## Rung 1: the cheap checks, and what `accept` is not

```js
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 5;

function quickCheck(file, count) {
  if (count >= MAX_PHOTOS) return 'You can attach up to 5 photos.';
  if (file.size === 0)     return 'That file is empty.';
  if (file.size > MAX_BYTES) return 'Photos must be under 10 MB.';
  if (file.type && !file.type.startsWith('image/')) return 'Please choose an image.';
  return null;
}
```

⚠️ **`accept="image/*"` filters the picker's default view and nothing more.** The user can switch
it to *all files*, and drag-and-drop ignores it entirely.

🔴 **`file.type` is a guess, largely from the extension** — `payload.exe` renamed `photo.png`
reports `image/png` — and it is **empty** for types the OS does not recognise, which is why the
check above tests `file.type &&` first. Rejecting on an empty type alone turns a legitimate file
into a support ticket ([Phase 11 · 11 · 01](../../phase-11-network-storage/11-uploading-files/01-getting-the-file.md)).

**Check the count before the loop, not inside the upload.** A user can drop a folder of 5,000
images, and a `map` that fires 5,000 uploads takes your own page down before it reaches your server.

## Rung 2: magic bytes

```js
const SIGNATURES = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png',  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] },              // "GIF8"
];

async function sniff(file) {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());   // ✅ 12 bytes, not the file
  const hit = SIGNATURES.find((s) => s.bytes.every((b, i) => head[i] === b));
  if (hit) return hit.type;
  // WebP is a RIFF container: "RIFF" ???? "WEBP"
  const ascii = (i, n) => String.fromCharCode(...head.slice(i, i + n));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  return null;
}
```

**`file.slice(0, 12)` reads twelve bytes, not the file.** `slice` on a `Blob` costs nothing — it
returns a new handle to a range — so this check is cheap enough to run on every file as it is added
([Phase 11 · 12 · 01](../../phase-11-network-storage/12-blob-file-filereader/01-blob-and-file.md)).

⚠️ **A signature proves the first few bytes, not the file.** Appending arbitrary data to a valid
JPEG leaves the signature intact. That is why rung 3 exists, and why rung 4 is the one that matters.

## Rung 3: make the browser prove it decodes

```js
try {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  bitmap.close();
  if (width < 200 || height < 200) return 'That image is too small to be useful.';
} catch {
  return 'That file is not an image we can read.';   // truncated, corrupt, or not an image
}
```

🔴 **A decode is the strongest check available in the browser**, because it is not inspecting the
bytes — it is *using* them. `createImageBitmap` rejects when the data cannot be decoded, and
`HTMLImageElement.decode()` rejects with an `EncodingError` when *"the image's data is corrupted"*.

**It also gives you the dimensions**, which is the check nobody thinks of: a 40×40 photo of a sofa
is technically valid and useless in a review, and telling the user now beats publishing it.

⚠️ **A decode failure is not always the user's fault.** A HEIC photo from an iPhone is a real image
that many browsers cannot decode ([03 · Resizing before upload](./03-resizing-before-upload.md)) —
so treat a rejection as *"we cannot process this here"* and let the server decide, rather than
telling the user their photo is broken.

## 🔴 The re-encode is the strongest sanitisation the client can do

**And you already have it.** The canvas pipeline in
[03 · Resizing before upload](./03-resizing-before-upload.md) decodes the image to pixels and
encodes fresh bytes — so whatever was in the original file that was *not* pixels is simply not in
the output.

- 🔴 **EXIF goes, and that includes GPS coordinates.** A phone photo of a sofa in someone's living
  room can carry the latitude and longitude of their home, and a review photo is published to
  everyone. Stripping it is a **privacy feature**, not a size optimisation, and it is the strongest
  argument for resizing on the client at all.
- **Anything appended to the file goes with it** — trailing data after the image, a comment segment
  full of markup, a second file glued on the end.
- **The format is normalised.** What arrives at the server is a JPEG the browser just encoded, not
  whatever the camera, a messaging app and three re-saves produced.

⚠️ **Orientation is the one thing you must not lose in the process.** Decoding with
`imageOrientation: 'from-image'` bakes the rotation into the pixels, so dropping the EXIF is
harmless. Ignore the metadata during decode and strip it afterwards, and the photo is sideways
forever.

⚠️ **None of this makes the upload trusted.** The bytes still arrive from a client that may not have
run any of it.

## Two things that are never a review photo

🔴 **SVG.** MDN is explicit that the sandbox applies *only* when SVG is used as an image — in
`<img>`, a CSS `background-image`, or `drawImage`, where *"JavaScript is disabled"* and *"external
resources cannot be loaded"*. Those restrictions **do not apply** when the file is *"viewed
directly"* or embedded via `<iframe>`, `<object>` or `<embed>`. A user-uploaded SVG served from your
own origin and opened in a tab is a script running as your site. **Reject `image/svg+xml`
outright** — it is not a camera format and a review has no use for it.

🔴 **Anything that is not on your allowlist.** Decide what you accept — JPEG, PNG, WebP — and refuse
everything else. A denylist of "dangerous" types is a list you will always be one entry behind on.

## What only the server can do

**Every check above is advisory.** The request is a plain HTTP POST; anything the client enforces,
a client that skips your JavaScript does not
([Phase 12 · 02 · The trust boundary](../../phase-12-browser-platform/02-client-side-security/01-the-trust-boundary.md)).

- **Re-check the type from the bytes, and re-encode server-side.** The client's resize is a
  bandwidth optimisation; the server's re-encode is the sanitisation.
- **Enforce size and count again**, at the proxy as well as in the application. The client's 10 MB
  limit is a suggestion.
- **Generate the stored name.** `file.name` is attacker-controlled text that may contain `../`,
  control characters, or a name chosen to overwrite something. Keep it as a display label only.
- **Serve user content from a separate origin**, with `X-Content-Type-Options: nosniff` — which MDN
  says *"prevents XSS-attacks where user-uploaded content is executed as an HTML document"* — and
  `Content-Disposition: attachment` for anything not rendered inline. A photo served from your own
  origin is same-origin with your session ([Phase 11 · 15 · CSP](../../phase-11-network-storage/15-csp/README.md)).
- **Rate-limit and quota per account**, and expire the orphaned media of drafts that are never
  submitted.
- **Moderate.** Nothing technical stops a user uploading a photo that is perfectly valid and must
  not be published.

The full server-side list is [Phase 11 · 11 · 03](../../phase-11-network-storage/11-uploading-files/03-scale-and-the-server.md);
this page is what the storefront's client owes it.

## Gotchas

**Symptom: a renamed executable passed the image check.**
Cause — `file.type` is derived from the extension.
Fix — magic bytes and a decode on the client; the real check on the server.

**Symptom: a legitimate photo was rejected as "not an image".**
Cause — `file.type` was empty, or the format was one the browser cannot decode, such as HEIC.
Fix — do not reject on an empty type alone; treat a decode failure as "we cannot process this
here", and let the server try.

**Symptom: a published review photo revealed the reviewer's home address.**
Cause — EXIF GPS carried through untouched.
Fix — re-encode through the canvas, and strip metadata server-side as well.

**Symptom: photos come out sideways after metadata stripping.**
Cause — orientation was dropped without being baked into the pixels.
Fix — decode with `imageOrientation: 'from-image'` before re-encoding.

**Symptom: an uploaded SVG ran script when opened.**
Cause — the sandbox applies to SVG *as an image*, not to direct navigation, and it was served from
your own origin.
Fix — reject SVG; serve user content from a separate origin with `nosniff`.

**Symptom: the page froze when a user dropped a folder.**
Cause — thousands of files, each starting a validation and an upload.
Fix — check the count before doing any per-file work.

**Symptom: uploads succeed but two files overwrite each other in storage.**
Cause — `file.name` used as the storage key.
Fix — a server-generated identifier; the original name is a label.

**Symptom: validation passes in the app and garbage still reaches storage.**
Cause — the client's checks were treated as the enforcement point.
Fix — re-validate server-side; assume every client-side rule was skipped.

## Interview questions

**★ What is client-side file validation for?**
Feedback. Telling someone immediately that their file is too big, too small or the wrong kind beats
making them wait through a doomed upload. It has no security value, because anything the client
checks the client can skip.

**★ Can you trust `file.type` or `file.name`?**
Neither. `type` is the browser's guess, mostly from the extension, and it is empty for unrecognised
formats. `name` is attacker-controlled text that may contain path segments — a display label, never
a path or a key.

**★ How do you check that a file really is an image, in the browser?**
Read the first few bytes with `file.slice()` and compare the signature, then try to decode it —
`createImageBitmap` rejects on data it cannot read. The decode is stronger because it uses the
bytes rather than inspecting them, and it hands you the dimensions as well.

**★ What does re-encoding an image through a canvas actually remove?**
Everything that was not pixels: EXIF including GPS location, appended data, and any format
peculiarity. It is the strongest sanitisation the client can perform — and the privacy win, not the
file size, is its best justification.

**★ Why should a storefront never accept an SVG as a review photo?**
Because the "SVG as an image" sandbox — no scripting, no external resources — applies only when it
is rendered as an image. Viewed directly or framed, an SVG is a document, so one served from your
origin is script running as your site.

**★ Which of these checks belongs on the server?**
All of them. The client repeats the cheap ones for speed of feedback; the server does the ones that
decide whether the bytes are stored and published — type from content, re-encode, size, quota, a
generated filename, and serving the result from an origin that cannot touch your session.

---

← [03 · Resizing before upload](./03-resizing-before-upload.md) · [Topic index](./README.md)
