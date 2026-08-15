---
title: "02 · Capture"
sidebar_label: "02 · Capture"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`MediaDevices.getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [`MediaDevices.enumerateDevices()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices), [`MediaStream`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream), [`MediaStreamTrack`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack), [`OverconstrainedError`](https://developer.mozilla.org/en-US/docs/Web/API/OverconstrainedError), [`MediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [`Permissions-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy). Documentation-validated; **no timings and no console output**.

`getUserMedia()` is the most consequential permission on the web platform: the page asks for the
camera and the microphone of the machine it is running on. Everything about the API's design —
where it works, how it fails, how you stop it — follows from that.

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: { facingMode: 'user', width: { ideal: 1280 } },
});
video.srcObject = stream;                 // 🔴 srcObject, never src
```

## Constraints: required, forbidden, or preferred

The constraints object is more expressive than it looks, and the difference decides whether the
call succeeds at all:

| Written as | Meaning |
|---|---|
| `video: true` | video is **required** — reject if unavailable |
| `video: false` | video is **forbidden** — reject if it would be present |
| `video: { width: 1280 }` | a **preference**; the browser gets as close as it can |
| `video: { width: { min: 1280 } }` | a **requirement** — no device that fits, no stream |
| `video: { width: { min: 640, ideal: 1280, max: 1920 } }` | a range with a target |

🔴 **`min` and `max` are hard constraints and `ideal` is not.** A `min` that no camera satisfies
rejects with **`OverconstrainedError`**, whose `constraint` property names the offender. Prefer
`ideal` and adapt to what you get; reserve `min` for a genuine floor below which your feature
cannot work.

## The failure table — every one of these is a different screen

| Exception | Cause |
|---|---|
| `NotAllowedError` | the user refused, the context is insecure, or permissions policy blocked it |
| `NotFoundError` | 🔴 **no device matching the constraints exists** — a laptop with no camera |
| `NotReadableError` | permission granted but the hardware failed — usually **another app has the camera** |
| `OverconstrainedError` | the constraints are unsatisfiable; read `err.constraint` |
| `AbortError` | the device could not be used despite access being granted |
| `SecurityError` | user media is disabled on the document |
| `TypeError` | empty constraints, everything `false`, or an insecure context |

⚠️ **On an insecure origin `navigator.mediaDevices` is `undefined`** — so the first sign of an
HTTP page is a `TypeError` on a property read, not a permission failure. Feature-detect
`navigator.mediaDevices?.getUserMedia` before calling.

🔴 **The promise may never settle.** MDN states plainly that if the user ignores the permission
prompt and makes no choice, the returned promise **neither resolves nor rejects**. A UI that shows
a spinner until the promise settles can therefore hang forever. Show the "we are asking for your
camera" state immediately and let the user cancel out of it.

## Stopping is your job, and it is the part people get wrong

```js
function stop(stream) {
  stream.getTracks().forEach((track) => track.stop());   // 🔴 every track, individually
  video.srcObject = null;
}
```

⚠️ **Pausing the `<video>`, hiding it, or navigating within an SPA does not release the camera.**
The stream holds the device until every track is stopped, and browsers are required to show an
in-use indicator the whole time — so a leaked stream is not a subtle bug, it is a recording light
the user is staring at. Stop tracks in teardown, on route change, and on `pagehide`.

A `MediaStream` is a container of `MediaStreamTrack`s, which is why the plural matters: stopping
only `getVideoTracks()[0]` leaves the microphone live.

## Devices, labels, and the fingerprinting rule

```js
const devices = await navigator.mediaDevices.enumerateDevices();
// device.label is EMPTY until permission has been granted for that kind of device
```

🔴 **You cannot build a camera picker before asking for a camera.** Labels are withheld until the
user has granted permission for that device type, so the honest flow is: request with sensible
constraints (`facingMode: 'user'`), *then* enumerate to offer a switcher. MDN also flags that
`OverconstrainedError` can be raised **before** the permission prompt, which is a fingerprinting
surface — another reason not to probe for hardware.

`navigator.mediaDevices.addEventListener('devicechange', …)` tells you a camera or microphone was
plugged in or removed, which is what keeps a device picker honest mid-call.

## Screen sharing and recording, briefly

- **`getDisplayMedia()`** asks for a screen, window or tab instead of a camera. It always shows the
  browser's own picker, cannot be pre-selected by the page, and needs a user gesture. The user can
  stop sharing from browser UI, so listen for the track's `ended` event rather than assuming your
  stop button is the only exit.
- **`MediaRecorder`** turns a stream into encoded chunks (`dataavailable` events). Container and
  codec support varies between browsers — check support for the type you intend to record instead
  of hard-coding one, and expect to transcode server-side if you need one canonical format.

## Privacy, in the code and in the copy

- **Ask on the action**, never on load — this is [17 · The permission model](../17-permissions-geolocation-notifications/01-the-permission-model.md)
  in its highest-stakes form, and a refused camera cannot be re-prompted.
- **Ask for the minimum.** `{ audio: true }` for a voice note; do not request video "in case".
- **Stop the moment you are done**, and say so in the UI. An indicator that stays on after the user
  thinks they finished is the fastest way to lose their trust.
- **In an iframe, the embedder decides** — `Permissions-Policy: camera=(self)` or
  `allow="camera; microphone"`; a sandboxed frame additionally needs `allow-same-origin`.

## Gotchas

**Symptom: `navigator.mediaDevices` is undefined.**
Cause — an insecure origin (plain `http://` on a LAN address).
Fix — HTTPS or `localhost`; feature-detect before calling.

**Symptom: the camera light stays on after the user closes the modal.**
Cause — the stream's tracks were never stopped.
Fix — `stream.getTracks().forEach(t => t.stop())` in teardown.

**Symptom: `NotReadableError` on a machine with a working camera.**
Cause — another application holds the device.
Fix — tell the user exactly that; it is not something the page can resolve.

**Symptom: the device picker shows blank labels.**
Cause — labels are hidden until permission has been granted for that device kind.
Fix — request the stream first, then enumerate.

**Symptom: `OverconstrainedError` on some phones only.**
Cause — a `min`/`max` constraint no camera on that device satisfies.
Fix — use `ideal`, and read `err.constraint` to see which one failed.

**Symptom: the request hangs and nothing happens.**
Cause — the user ignored the prompt; the promise never settles.
Fix — do not gate the UI on the promise alone; provide a cancel path.

**Symptom: screen sharing keeps "running" after the user stopped it in browser UI.**
Cause — only your own stop button was wired up.
Fix — listen for `ended` on the track and clean up there too.

## Interview questions

**★ What is the difference between `video: {width: 1280}` and `video: {width: {min: 1280}}`?**
The first is a preference the browser approximates; the second is a hard requirement that rejects
with `OverconstrainedError` when no device satisfies it.

**★ How do you release the camera?**
Stop every track: `stream.getTracks().forEach(t => t.stop())`. Pausing or removing the `<video>`
element does not release the device, and the in-use indicator stays on until you do.

**★ Why are device labels empty?**
They are withheld until the user has granted permission for that device type, to prevent
fingerprinting. Request a stream first, then enumerate to build a switcher.

**★ What happens if the user ignores the permission prompt?**
The promise neither resolves nor rejects. Any UI that waits on it alone will hang, so the "asking"
state needs its own cancel path.

**★ Which error means "another app has the camera"?**
`NotReadableError` — permission was granted but the hardware could not be read. It is worth its own
message, because the user has to fix it outside the browser.

---

← [01 · Controlling media elements](./01-controlling-media-elements.md) · [Topic index](./README.md) · [03 · Canvas 2D](./03-canvas-2d.md) →
