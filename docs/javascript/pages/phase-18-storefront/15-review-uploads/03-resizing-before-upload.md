---
title: "03 · Resizing before upload"
sidebar_label: "03 · Resizing before upload"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`createImageBitmap()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [`ImageBitmap`](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap), [`HTMLCanvasElement.toBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), [`OffscreenCanvas`](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), [`OffscreenCanvas.convertToBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob), [`CanvasRenderingContext2D.drawImage()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage), [`imageSmoothingQuality`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingQuality), [`<canvas>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas), [CSS `image-orientation`](https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation). Documentation-validated; **no timings and no console output**.

A phone camera produces a photo of several megabytes and several thousand pixels on a side. A review
thumbnail is displayed at a few hundred. **Sending the original is sending roughly twenty times the
pixels the site will ever show** — over the user's mobile data, on the connection least able to
afford it.

🔴 **Resizing in the browser is the one piece of image work that genuinely belongs on the client**,
because the win happens *before* the bytes are sent. Everything else — thumbnails, formats, CDN
variants — is the server's job and is better done there.

## The pipeline

```js
async function resize(file, maxEdge = 1600, quality = 0.82) {
  // 1. decode — from the Blob directly, honouring EXIF orientation
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  // 2. work out the target box, never scaling up
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  // 3. draw
  const canvas = document.createElement('canvas');
  canvas.width = w;                       // 🔴 the bitmap size — NOT a CSS size
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();                         // ✅ release the decoded pixels now

  // 4. encode
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not encode the image');   // ⚠️ toBlob can hand back null
  return blob;
}
```

**Four steps — decode, measure, draw, encode — and each one has a trap.**

## Decode: `createImageBitmap`, not `<img>`

**`createImageBitmap` takes a `Blob` directly**, so there is no object URL to create and revoke, no
`load` event to wire up, and no `error` handler to forget. It returns a promise, and it accepts an
options object that does two jobs no `<img>` can.

🔴 **`imageOrientation` defaults to `"from-image"`** — MDN: *"Image oriented according to EXIF
orientation metadata, if present (default)."* Passing `"none"` means *"oriented according to image
encoding, ignoring any metadata about the orientation"*.

⚠️ **This is where sideways photos come from, and the reason it is confusing is worth stating
plainly.** The CSS `image-orientation` property has an initial value of `from-image`, so an `<img>`
preview of a portrait phone photo appears upright *automatically*. Draw that same image to a canvas
and the rotation may be gone — MDN's own `drawImage()` page warns: *"In some older browser versions,
`drawImage()` will ignore all EXIF metadata in images, including the Orientation. This behavior is
especially troublesome on iOS devices."* The user sees a correct preview, uploads it, and the
published photo is on its side.

✅ **`createImageBitmap(file)` with the default orientation is the fix**, and it is the whole reason
to prefer it over the `<img>` + `drawImage` route.

**The other two options that matter:**

```js
await createImageBitmap(file, {
  resizeWidth: 1600,          // let the browser do the scaling
  resizeQuality: 'high',      // 'pixelated' | 'low' | 'medium' | 'high' — default is 'low'
});
```

⚠️ **`resizeQuality` defaults to `"low"`.** If you use `resizeWidth`/`resizeHeight` and leave the
quality alone, a big downscale can come out visibly rough — which looks like a bad camera to the
user, not like a missing option.

**`bitmap.close()` releases the decoded pixels.** A 12-megapixel photo decoded to RGBA is tens of
megabytes of memory, and five of them at once on a phone is how the tab gets killed. `close()` is
not optional housekeeping here; it is the difference between the form working and the browser
reloading the page under the user.

## Measure: never scale up, and mind the canvas ceiling

```js
const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
```

**`Math.min(1, …)` is the whole rule.** Upscaling a small image makes the file larger and the
picture no better, and a review form gets plenty of small images — screenshots, saved thumbnails,
photos that were already resized by a messaging app.

⚠️ **A canvas has a maximum size, and exceeding it fails quietly.** MDN: *"in most cases the maximum
dimensions exceed 10,000 x 10,000 pixels, notably iOS devices limit the canvas size to only 4,096 x
4,096 pixels"*, and *"Exceeding the maximum dimensions or area renders the canvas unusable — drawing
commands will not work."* Since the resize *target* is small this rarely bites the output canvas —
but it is exactly why you should not "fix" orientation by drawing the full-size original first.

🔴 **Set `canvas.width`/`canvas.height`, not the CSS width and height.** The attributes are the
bitmap's real pixel dimensions; the CSS properties only stretch whatever bitmap exists. Setting the
CSS size and drawing produces a 300×150 image — the default canvas size — scaled up on screen and
uploaded at 300×150.

## Encode: format, quality, and the `null` nobody handles

```js
canvas.toBlob(callback, type, quality)
```

- **The default type is `image/png`** — *"that type is also used if the given type isn't supported"*.
  🔴 **Photographs must not go out as PNG.** PNG is lossless, so a photo re-encoded to it is often
  *larger* than the JPEG that came in, and the whole exercise backfires. Always pass the type.
- **`quality` is a number between 0 and 1** and applies *"when creating images using file formats
  that support lossy compression (such as `image/jpeg` or `image/webp`)"*. Outside that range, or
  omitted, the browser uses its own default. It does nothing at all for PNG.
- ⚠️ **The callback can be handed `null`** — *"`null` may be passed if the image cannot be created
  for any reason."* A promise wrapper that resolves with `null` and an `append` that never checks
  produces an upload of nothing, reported as success.

**Choosing the format:**

| Source | Send as | Why |
|---|---|---|
| A photo | `image/jpeg` (or `image/webp`) | Lossy, small, universally accepted by image pipelines |
| A screenshot with text or flat colour | `image/png` | JPEG puts ringing artefacts around sharp edges |
| Anything with transparency | `image/png` or `image/webp` | 🔴 **JPEG has no alpha** — see below |

🔴 **Transparency becomes black.** A canvas starts fully transparent, and JPEG cannot store an alpha
channel, so transparent pixels are encoded as black in most implementations. If the input might be a
transparent PNG, fill the canvas first:

```js
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, w, h);        // ✅ white behind the photo, before drawImage
```

⚠️ **`image/webp` is not universally encodable.** `toBlob` silently falls back to PNG for an
unsupported type, so a WebP request can quietly become a large PNG. Check the returned
`blob.type` before trusting it.

## Then pass the filename, or the whole thing arrives as `blob`

```js
const resized = await resize(record.file);
body.append('photo', resized, record.file.name.replace(/\.\w+$/, '.jpg'));
```

🔴 **The output of `toBlob` is a `Blob`, not a `File`** — so `FormData.append()` names it `"blob"`
by default, for every photo, on every review
([02 · Uploading and submitting](./02-uploading-and-submitting.md)). And the extension should now
match what you actually encoded: shipping JPEG bytes under a `.png` name misleads every tool
downstream.

✅ **Keep both blobs on the record** — the original `File` and the resized `Blob` — so a retry
re-sends rather than re-encodes.

## Do it in a worker

Decoding and re-encoding a large photo is real CPU work on the main thread, and the visible symptom
is a form that stops responding to typing while five photos are processed.

```js
// worker.js
onmessage = async ({ data: { file, maxEdge, quality } }) => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale),
                                     Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  postMessage(blob);                       // ✅ a Blob is structured-cloneable
};
```

**Everything this needs exists in a worker.** `createImageBitmap` and `OffscreenCanvas` are both
available there, and `convertToBlob({ type, quality })` is the promise-returning equivalent of
`toBlob` — same `image/png` default, same 0–1 quality for lossy formats, and it rejects with a
`DOMException` (`EncodingError`, `IndexSizeError` on a zero-sized canvas, `SecurityError` on a
non-origin-clean bitmap) rather than handing back `null`.

⚠️ **`File` and `Blob` cross the worker boundary by structured clone**, so you can post the file in
and the resized blob back out without reading it into an `ArrayBuffer`
([Phase 12 · 07 · Web Workers](../../phase-12-browser-platform/07-web-workers/README.md)).

## When not to resize

**Client-side resize is a bandwidth optimisation with a real cost**, and it is not always the right
call:

- 🔴 **It is lossy and irreversible.** The server never sees the original, so a later decision —
  bigger thumbnails, a zoom view, a different crop — has nothing to go back to.
- **It hands quality control to whatever device the user has.** Encoders differ; a phone from 2016
  and a desktop produce visibly different output from the same source.
- **It costs CPU and battery on a phone**, which is the device that most needs the bandwidth saved.
  It is usually a good trade, and it is a trade.
- ⚠️ **The browser may not be able to decode the file at all.** iPhones can produce **HEIC**, and
  support for decoding it is not universal — `createImageBitmap` rejects, and the fallback must be
  *upload the original untouched*, never *fail the photo*.

✅ **A sensible default:** cap the longest edge somewhere around 1600–2000 px, encode JPEG at
roughly 0.8, and **skip the resize entirely when the file is already small** — under a megabyte and
inside the pixel cap, re-encoding only loses quality.

**Do it for the upload, not for the preview.** The preview should use the object URL of the original
([01 · The photo list](./01-the-photo-list.md)); waiting for a resize before anything appears makes
the form feel broken.

## Gotchas

**Symptom: uploaded photos are rotated sideways, but the preview looked fine.**
Cause — the preview was an `<img>` (CSS `image-orientation: from-image` by default) while the canvas
path ignored EXIF.
Fix — `createImageBitmap(file, { imageOrientation: 'from-image' })`, the default.

**Symptom: the uploaded image is 300×150.**
Cause — the CSS width/height were set instead of the canvas `width`/`height` attributes, so the
bitmap stayed at its default size.
Fix — set the attributes.

**Symptom: the "resized" file is bigger than the original.**
Cause — `toBlob` was called with no type, so a photo was re-encoded as lossless PNG.
Fix — pass `'image/jpeg'` and a quality.

**Symptom: transparent areas came out black.**
Cause — JPEG has no alpha channel.
Fix — fill the canvas with a background colour before drawing, or keep PNG/WebP.

**Symptom: an upload succeeded but the stored file is empty or invalid.**
Cause — `toBlob` passed `null` and nothing checked.
Fix — reject when the blob is falsy.

**Symptom: downscaled photos look rough and blocky.**
Cause — `resizeQuality` left at its `"low"` default, or smoothing disabled.
Fix — `resizeQuality: 'high'`, and `ctx.imageSmoothingQuality = 'high'`.

**Symptom: the form freezes while photos are processed.**
Cause — decode and encode running on the main thread.
Fix — `OffscreenCanvas` + `createImageBitmap` in a worker.

**Symptom: the tab reloads itself on a phone after a few photos.**
Cause — several decoded bitmaps held at once; the memory is the *pixels*, not the file size.
Fix — `bitmap.close()` as soon as the draw is done, and process serially.

**Symptom: iPhone photos fail with no useful error.**
Cause — a HEIC file the browser cannot decode; `createImageBitmap` rejects.
Fix — catch it and upload the original bytes untouched.

**Symptom: a requested WebP came back as a much larger file.**
Cause — the browser does not encode WebP and `toBlob` fell back to PNG.
Fix — check `blob.type` on the result.

## Interview questions

**★ Why resize an image in the browser at all?**
Because the saving happens before the bytes are sent. A phone photo is many times the pixels the
site will display, and the user pays for every one of them on the slowest connection they own.
Server-side resizing cannot avoid the upload.

**★ Why `createImageBitmap` rather than an `<img>` and `drawImage`?**
It decodes a `Blob` directly with no object URL and no load event, it runs in workers, it can scale
during decode with `resizeWidth`/`resizeQuality`, and it applies EXIF orientation by default — which
is exactly the thing the `<img>` + canvas route gets wrong.

**★ A user uploads a portrait phone photo and it appears sideways. What happened?**
The orientation lived in EXIF. CSS shows `<img>` upright by default, so the preview looked right,
but the canvas path dropped the metadata. Decode with `imageOrientation: 'from-image'`.

**★ What does `toBlob` do if you call it with no type?**
It encodes PNG — the default, also used when the requested type is unsupported. For a photograph
that is lossless and often larger than the original JPEG, so the resize can make the upload worse.

**★ Why does the canvas resize need `bitmap.close()`?**
Because an `ImageBitmap` holds *decoded* pixels — a 12-megapixel photo is tens of megabytes of RGBA
regardless of how small the JPEG was. Holding several at once is what kills the tab on a phone.

**★ When would you skip client-side resizing?**
When the file is already small, when the original must be preserved for later derivatives, or when
the browser cannot decode the format at all — HEIC being the common case, where the right fallback
is to upload the original untouched.

---

← [02 · Uploading and submitting](./02-uploading-and-submitting.md) · [Topic index](./README.md) · [04 · A file you cannot trust](./04-a-file-you-cannot-trust.md) →
