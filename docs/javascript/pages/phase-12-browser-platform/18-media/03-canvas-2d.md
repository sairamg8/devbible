---
title: "03 · Canvas 2D"
sidebar_label: "03 · Canvas 2D"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API), [`HTMLCanvasElement.getContext()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext), [`CanvasRenderingContext2D.drawImage()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage), [`HTMLCanvasElement.toBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), [Allowing cross-origin use of images and canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image), [`OffscreenCanvas`](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), [`Window.devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio). Documentation-validated; **no timings and no console output**.

Canvas is the platform's escape hatch: a rectangle of pixels with an imperative drawing API and no
DOM inside it. That last part is both why it is fast and why it is the wrong choice for anything
that could be elements.

## The two sizes, and the bug that comes from confusing them

```js
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = devicePixelRatio;                 // 🔴 the whole fix, in one line
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width  = Math.round(width  * dpr);     // the BITMAP, in device pixels
  canvas.height = Math.round(height * dpr);
  ctx.scale(dpr, dpr);                          // now draw in CSS pixels
}
```

🔴 **A canvas has a bitmap size (`width`/`height` attributes) and a display size (CSS), and they
are independent.** Set only the CSS size and the browser stretches a small bitmap — the blurry
canvas everyone has shipped once. Set only the attributes and the layout is wrong. On a 2× or 3×
screen the bitmap must be `dpr` times the CSS size, or every line is soft.

⚠️ **Setting `canvas.width` or `canvas.height` clears the canvas and resets the context state** —
transforms, styles, the lot. That is why `resize()` re-applies `scale()`, and why resizing on every
`resize` event without redrawing produces a blank canvas.

And `devicePixelRatio` changes when the window moves to another monitor or the user zooms — there is
no event for it, so re-check it on a `matchMedia('(resolution: Xdppx)')` listener
([09 · `window`, `document`, `navigator`, `screen`](../09-window-document-navigator/README.md)).

## Context options that matter

```js
const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
```

| Option | Effect |
|---|---|
| `alpha: false` | opaque canvas — the browser can skip compositing transparency |
| `willReadFrequently: true` | 🔴 optimises for repeated `getImageData()` — MDN notes it **forces software rendering**, so use it only when you really are reading pixels back constantly |
| `desynchronized: true` | reduced latency, for drawing/inking surfaces |
| `colorSpace` | `'srgb'` (default) or `'display-p3'` |

`getContext()` returns **`null`** if the type is unsupported or the canvas was already put into a
different context mode — and repeated calls with the same type return the *same* context object.
There is no second 2D context for a canvas.

## Grabbing a frame from a video

```js
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
canvas.toBlob((blob) => upload(blob), 'image/webp', 0.85);
```

`drawImage` accepts a `<video>`, an `<img>`, another canvas, an `ImageBitmap` — which makes the
canvas the bridge between [02 · Capture](./02-capture.md) and an upload: take a photo from a camera
stream, generate a poster frame, build a thumbnail.

🔴 **`toBlob()` beats `toDataURL()` almost always.** `toDataURL` is synchronous and returns base64,
which is roughly a third larger than the bytes and has to be decoded again to upload;
`toBlob` is asynchronous and hands you the bytes ready for `FormData`
([Phase 11 · 11 · Uploading files](../../phase-11-network-storage/11-uploading-files/README.md)).
Both take a MIME type and a quality argument for lossy formats.

## Tainting — the security rule you will meet by surprise

Drawing cross-origin content **without CORS approval taints the canvas**, and a tainted canvas
refuses to give the pixels back:

| Call | On a tainted canvas |
|---|---|
| `ctx.getImageData()` | throws **`SecurityError`** |
| `canvas.toBlob()` | throws `SecurityError` |
| `canvas.toDataURL()` | throws `SecurityError` |
| `canvas.captureStream()` | throws `SecurityError` |

```js
const img = new Image();
img.crossOrigin = 'anonymous';        // 🔴 request CORS…
img.src = 'https://cdn.example.com/photo.jpg';
```

⚠️ **The attribute alone is not enough** — the server must actually send
`Access-Control-Allow-Origin`. Without the header the draw still taints the canvas. This is the
reason a thumbnailer works in development against local images and throws `SecurityError` in
production against the CDN.

## Drawing without wrecking the frame budget

- **`clearRect` then redraw** is the normal loop; there is no retained scene graph to update.
- **`save()` / `restore()`** bracket transform and style changes. Unbalanced calls are the classic
  "everything is suddenly rotated" bug.
- **Draw inside `requestAnimationFrame`**, never on scroll or `timeupdate`
  ([03 · Timers and frames](../03-timers-and-frames/README.md)).
- **`getImageData` is a read-back and it is expensive** — it stalls the pipeline. Batch it, or
  enable `willReadFrequently` if it is genuinely per-frame.
- **`OffscreenCanvas`** moves rendering into a worker
  ([07 · Web Workers](../07-web-workers/README.md)), which is what keeps heavy generative or
  image-processing work off the main thread — `transferControlToOffscreen()` hands the canvas over.

## What canvas costs you

🔴 **Canvas has no accessibility.** There is no DOM inside it: nothing for a screen reader, nothing
to select, nothing to find with `Ctrl+F`, nothing to translate, no keyboard focus. A chart drawn in
canvas is, to an assistive technology, an image with no alt text unless you provide one.

So the decision is: **SVG or elements for anything semantic and interactive** — a chart with
tooltips, a diagram with labels, a form; **canvas for pixels** — video frames, image processing,
particle effects, thousands of points. When you do choose canvas, put a real text alternative in
the fallback content and mirror interactive state in the DOM.

## Gotchas

**Symptom: the canvas is blurry on a laptop screen.**
Cause — the bitmap size does not account for `devicePixelRatio`.
Fix — `canvas.width = cssWidth * dpr`, then `ctx.scale(dpr, dpr)`.

**Symptom: the canvas goes blank when the window resizes.**
Cause — assigning `width`/`height` clears it and resets the context state.
Fix — redraw and re-apply transforms after every resize.

**Symptom: `SecurityError` from `toBlob()` in production only.**
Cause — a cross-origin image tainted the canvas.
Fix — `crossOrigin = 'anonymous'` **and** a CORS header from the image host.

**Symptom: everything drawn after one function is rotated or the wrong colour.**
Cause — unbalanced `save()`/`restore()`.
Fix — pair them, and treat context state as global mutable state.

**Symptom: the frame rate collapses when a filter is enabled.**
Cause — per-frame `getImageData`.
Fix — `willReadFrequently: true`, fewer read-backs, or move the work to `OffscreenCanvas` in a
worker.

**Symptom: screen readers ignore the chart entirely.**
Cause — canvas has no DOM.
Fix — SVG or elements for semantic graphics; otherwise provide a table or text equivalent.

**Symptom: `getContext('webgl')` returns `null` after `getContext('2d')`.**
Cause — a canvas has one context mode for its lifetime.
Fix — use a separate canvas element.

## Interview questions

**★ Why is a canvas blurry on a high-DPI screen, and what is the fix?**
Because the bitmap size and the CSS size are independent: the bitmap must be `devicePixelRatio`
times the CSS size, with `ctx.scale(dpr, dpr)` so drawing code can stay in CSS pixels.

**★ What is a tainted canvas?**
One that has had cross-origin content drawn into it without CORS approval. `getImageData`,
`toBlob`, `toDataURL` and `captureStream` then throw `SecurityError` — the pixels cannot be read
back.

**★ `toBlob` or `toDataURL`?**
`toBlob`, nearly always: it is asynchronous and yields bytes ready to upload, whereas `toDataURL` is
synchronous and produces base64 that is about a third larger and has to be decoded again.

**★ When is canvas the wrong tool?**
Whenever the content is semantic or interactive. Canvas has no DOM, so there is no accessibility,
no text selection, no find-in-page and no keyboard focus. SVG or real elements handle those; canvas
is for pixels.

**★ What does `willReadFrequently` do, and why not always set it?**
It optimises the context for repeated `getImageData()` calls, and MDN notes it forces software
rendering — so it helps a pixel-reading workload and hurts an ordinary drawing one.

---

← [02 · Capture](./02-capture.md) · [Topic index](./README.md)
