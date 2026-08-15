---
title: "18 · Media from JavaScript"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`HTMLMediaElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement), [`HTMLMediaElement.play()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play), [`MediaDevices.getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [`MediaStreamTrack`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack), [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API), [Allowing cross-origin use of images and canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image). Documentation-validated; **no timings and no console output**.

The syllabus row is *controlling `<video>`/`<audio>`, `getUserMedia`, and Canvas 2D basics* — three
APIs that meet in one sentence: **a stream goes into an element, a frame comes out into a canvas.**

🔴 **The theme is that none of these are under your control.** Playback can be refused by the
autoplay policy, the camera can be refused by the user or held by another app, and a canvas can
refuse to give its own pixels back because of where an image came from. Every one of them is an
async operation with a failure branch that must be designed, not caught and logged.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Controlling media elements](./01-controlling-media-elements.md)** | `play()` as a promise and its `NotAllowedError`/`NotSupportedError`; the muted-autoplay rule; **rendering from events, never from your own state**; the event table; `duration` being `NaN` before `loadedmetadata`; `buffered` as `TimeRanges`; `preload` and what a video costs the network; captions, custom controls and the Media Session API |
| 02 | **[Capture](./02-capture.md)** | Constraints as required / forbidden / preferred and why `min` produces `OverconstrainedError`; the seven-row failure table including 🔴 **`NotReadableError` = another app has the camera**; `navigator.mediaDevices` being undefined on HTTP; 🔴 **the promise that never settles** when the prompt is ignored; stopping **every track** because the indicator stays on; why device labels are empty until permission; screen sharing and recording |
| 03 | **[Canvas 2D](./03-canvas-2d.md)** | Bitmap size vs CSS size and the `devicePixelRatio` fix; assigning `width` **clears and resets** the context; `getContext` options and `willReadFrequently` forcing software rendering; grabbing a video frame; `toBlob` over `toDataURL`; 🔴 **tainting and `SecurityError`**; `requestAnimationFrame`, `save`/`restore`, `OffscreenCanvas`; and why canvas has **no accessibility** |

## Three facts worth carrying out of this topic

- **`play()` can be refused.** Update the button from the `play`/`pause` events, not from the
  click that requested playback.
- **Stopping the camera means stopping every track.** Hiding the video element leaves the
  recording indicator on.
- **A canvas that has drawn a cross-origin image will not export.** `crossOrigin = 'anonymous'`
  *and* the server's CORS header, or `SecurityError`.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [17 · Permissions, Geolocation and Notifications](../17-permissions-geolocation-notifications/README.md)
  — the camera and microphone are the highest-stakes permission on the platform
- [04 · `IntersectionObserver`](../04-intersectionobserver/README.md) — playing only what is on
  screen, and the network cost of a feed of clips
- [03 · Timers and frames](../03-timers-and-frames/README.md) — why drawing and scrubbing belong in
  `requestAnimationFrame`
- [07 · Web Workers](../07-web-workers/README.md) — `OffscreenCanvas`, and keeping pixel work off
  the main thread
- [Phase 11 · 11 · Uploading files](../../phase-11-network-storage/11-uploading-files/README.md) —
  what to do with the `Blob` a canvas produces

---

Start → [01 · Controlling media elements](./01-controlling-media-elements.md)
