---
title: "01 · Controlling media elements"
sidebar_label: "01 · Controlling media elements"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`HTMLMediaElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement), [`HTMLMediaElement.play()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play), [Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [`TimeRanges`](https://developer.mozilla.org/en-US/docs/Web/API/TimeRanges), [`MediaError`](https://developer.mozilla.org/en-US/docs/Web/API/MediaError), [`<track>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track), [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API). Documentation-validated; **no timings and no console output**.

`<video>` and `<audio>` are the rare case where the element *is* the API. There is no separate
media object to construct: the DOM node carries the state, the methods and the events, and your
JavaScript's job is to drive it and — more importantly — to **follow** it.

## `play()` is a promise, and it can say no

```js
async function start() {
  try {
    await video.play();
    setButton('pause');
  } catch (err) {
    setButton('play');                 // 🔴 the UI follows the outcome, not the intent
    if (err.name === 'NotAllowedError') showTapToPlay();
  }
}
```

| Rejection | Cause |
|---|---|
| `NotAllowedError` | 🔴 the autoplay policy, a missing user activation, or a permissions-policy block |
| `NotSupportedError` | the source is not a format the browser can play |

MDN's warning is worth quoting in spirit: the autoplay policy applies to **script-initiated
playback**, not just the `autoplay` attribute. Calling `play()` from your own code is exactly what
gets blocked, so never set the button to "Pause" before the promise resolves.

**What is allowed to autoplay, in practice:** muted playback, and playback after the user has
interacted with the page. That is the whole basis of the muted-hero-video pattern — `muted` +
`playsinline`, with an unmute control that runs inside a click.

## Follow the element, do not track it yourself

The user can pause your video from the keyboard, the OS media keys, picture-in-picture, a Bluetooth
headset or the notification shade. **Any state you keep in a variable will be wrong.** Render from
events instead:

| Event | Fires when | Use it for |
|---|---|---|
| `loadedmetadata` | duration and dimensions are known | sizing, showing total time |
| `canplay` / `canplaythrough` | enough is buffered to start | hiding the spinner |
| `play` / `pause` | playback state changed **by anyone** | the play/pause button |
| `timeupdate` | the position moved | the scrubber's position |
| `waiting` / `playing` | stalled for data / resumed | the buffering spinner |
| `ended` | finished | next-in-queue, replay |
| `error` | it failed | the failure UI — read `el.error`, a `MediaError` |
| `volumechange` | volume or `muted` changed | the volume UI |
| `ratechange` | `playbackRate` changed | the speed indicator |

⚠️ **`timeupdate` is not a frame clock.** It fires at the browser's own cadence, which is far
coarser than the display refresh rate. Drive a smooth progress bar from
`requestAnimationFrame` reading `currentTime`
([03 · Timers and frames](../03-timers-and-frames/README.md)), and keep `timeupdate` for
bookkeeping like "save the resume position".

## The properties worth knowing

```js
video.currentTime = 30;          // seek — in SECONDS, fractional
video.playbackRate = 1.5;
video.volume = 0.5;              // 0–1, and NOT how mobile OSs let you set system volume
video.muted = true;
video.paused;                    // read-only truth about state
video.duration;                  // NaN until metadata loads; Infinity for a live stream
```

🔴 **`duration` is `NaN` before `loadedmetadata`.** Any progress calculation that runs earlier
produces `NaN` widths — the empty scrubber bug that only appears on a slow connection.

**Buffering is a set of ranges, not a number:**

```js
for (let i = 0; i < video.buffered.length; i++) {
  drawRange(video.buffered.start(i), video.buffered.end(i));
}
```

`buffered` and `seekable` are `TimeRanges` objects with a `length` and indexed `start(i)`/`end(i)`
— because seeking around leaves several disjoint buffered islands. Treating `buffered.end(0)` as
"how much is loaded" is right only until the user scrubs.

## Loading behaviour and the bytes you did not mean to spend

| Attribute | Effect |
|---|---|
| `preload="none"` | fetch nothing until play — best default for a page with many clips |
| `preload="metadata"` | duration and dimensions only |
| `preload="auto"` | a hint that the browser may fetch the media; it is a hint, not an order |
| `poster` | the still frame shown before playback; cheaper than any preload |

⚠️ **A `<video>` on the page is a network decision.** Ten muted autoplaying clips in a feed are ten
downloads competing with everything else; pair them with
[`IntersectionObserver`](../04-intersectionobserver/README.md) so only what is on screen plays.

⚠️ **Adaptive streaming is not built in.** Native support for HLS and DASH varies by browser, and
the general path is Media Source Extensions plus a library. Check what your target browsers support
rather than assuming a `<source>` will just work.

## Accessibility is part of the feature, not an extra

- **Captions are content.** `<track kind="captions" srclang="en" src="…" default>` — and the
  `TextTrack` API lets you read cues, so a transcript, a search index or a "jump to this line"
  feature is a few lines on top.
- **Custom controls are a keyboard commitment.** Replacing native controls means re-implementing
  focus order, `Space`/`k` to toggle, arrow-key seeking, labels that state the current state, and a
  visible focus ring. Native controls do all of that already.
- **Never autoplay with sound**, and respect `prefers-reduced-motion` for decorative video
  ([11 · Accessibility from JavaScript](../11-accessibility-from-javascript/README.md)).

**The Media Session API** is the small extra that makes a media page feel native: it gives the OS
your title, artwork and album, and lets it route the hardware play/pause/next keys to your handlers.
Feature-detect `navigator.mediaSession` and set the metadata and action handlers when it exists.

## Gotchas

**Symptom: an unhandled promise rejection on every page load.**
Cause — calling `play()` without catching the autoplay `NotAllowedError`.
Fix — always `catch`, and show a tap-to-play affordance.

**Symptom: the button says "Pause" but nothing is playing.**
Cause — the UI was updated on intent rather than on the `play` event or the resolved promise.
Fix — render from `play` / `pause` events; they also cover OS and keyboard control.

**Symptom: the progress bar is `NaN%` wide at first.**
Cause — `duration` is `NaN` until `loadedmetadata`.
Fix — guard, and render the bar from that event onward.

**Symptom: the buffered indicator is wrong after seeking.**
Cause — `buffered` holds several ranges; only the first was read.
Fix — iterate `buffered.length` with `start(i)`/`end(i)`.

**Symptom: the scrubber moves in visible steps.**
Cause — driving it from `timeupdate`.
Fix — `requestAnimationFrame` reading `currentTime` while playing.

**Symptom: a feed page uses far more data than expected.**
Cause — every clip preloading, or all of them autoplaying.
Fix — `preload="none"` with a poster, and play only what is intersecting the viewport.

**Symptom: playback fails silently on one browser.**
Cause — an unsupported codec or container; `play()` rejected with `NotSupportedError`.
Fix — offer multiple `<source>` formats and handle the `error` event by reading `el.error`.

## Interview questions

**★ Why does `play()` return a promise?**
Because starting playback can fail — the autoplay policy may block it (`NotAllowedError`) or the
source may be unplayable (`NotSupportedError`). The UI must follow the outcome, not the call.

**★ How do you build a play/pause button that never goes out of sync?**
Render it from the element's `play` and `pause` events rather than from your own click handler,
because the user can also control playback from the OS, the keyboard or picture-in-picture.

**★ What is the trick that makes hero videos autoplay?**
`muted` (plus `playsinline` on mobile). Muted playback is permitted by autoplay policies; sound
requires a user gesture.

**★ Why is `buffered` a `TimeRanges` object rather than a number?**
Because seeking produces several disjoint buffered regions. You iterate `length` and read
`start(i)`/`end(i)`; a single number cannot describe it.

**★ What breaks when you replace the native controls?**
Keyboard support and screen-reader semantics, unless you rebuild them: focus management, `Space`
and arrow keys, and labels that announce the current state. Captions via `<track>` are content and
should never be dropped.

---

[Topic index](./README.md) · [02 · Capture](./02-capture.md) →
