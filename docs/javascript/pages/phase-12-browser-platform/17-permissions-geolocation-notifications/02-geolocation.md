---
title: "02 · Geolocation"
sidebar_label: "02 · Geolocation"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [`Geolocation.getCurrentPosition()`](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [`Geolocation.watchPosition()`](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition), [`GeolocationCoordinates`](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates), [`GeolocationPositionError`](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError), [`Permissions-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy). Documentation-validated; **no timings and no console output**.

Geolocation is the oldest permission-gated API on the platform, and it still has the oldest shape:
**callbacks, not promises**, with a options object whose defaults are wrong for almost every use.

```js
navigator.geolocation.getCurrentPosition(
  (pos) => showNearby(pos.coords.latitude, pos.coords.longitude),
  (err) => explain(err),                                  // optional — but never omit it
  { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
);
```

## The options, and why the defaults bite

| Option | Default | What it really means |
|---|---|---|
| `enableHighAccuracy` | `false` | `true` asks for GPS where available — **more accurate, more battery, slower** |
| `timeout` | 🔴 **`Infinity`** | how long to wait before the error callback fires with `TIMEOUT` |
| `maximumAge` | `0` | how old a cached fix may be; `0` forces a fresh one |

🔴 **`timeout` defaults to `Infinity`.** Left alone, a device that cannot get a fix — indoors, a
desktop with no location provider, a user who never answers the prompt — leaves your spinner
running forever, with no error and nothing to log. **Always pass a timeout.** It is the single most
common geolocation bug and it never appears in development.

**`maximumAge` is the cheap win.** A shop-finder does not need a fresh satellite fix every time the
user opens the page; accepting a five-minute-old position is instant and costs nothing.

## What comes back, and how precise it is not

```js
const { latitude, longitude, accuracy, altitude, heading, speed } = pos.coords;
pos.timestamp;
```

🔴 **`accuracy` is a radius in metres, and it is part of the answer, not metadata.** A fix with
`accuracy: 3000` is a neighbourhood, not a street corner — rendering it as a precise pin is a lie
the user will believe. Show a circle, or degrade the copy from *"3 min away"* to *"nearby"*.

`altitude`, `altitudeAccuracy`, `heading` and `speed` are frequently `null` — they depend on
hardware and on movement. Treat every one of them as optional.

## `watchPosition`, and turning it off

```js
const id = navigator.geolocation.watchPosition(onMove, onError, { enableHighAccuracy: true });
// later — and this is not optional
navigator.geolocation.clearWatch(id);
```

A watch keeps a location provider alive; with `enableHighAccuracy` that can mean the GPS. Clear it
when the user leaves the map, and stop it when the page is hidden:

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopWatching();
  else startWatching();
});
```

⚠️ **Only start a watch for something that genuinely tracks movement** — turn-by-turn directions, a
live delivery map. "Where am I roughly" is one `getCurrentPosition` call.

## The three errors, and what each one deserves

| `err.code` | Name | What it means | What the UI should do |
|---|---|---|---|
| `1` | `PERMISSION_DENIED` | the user said no, or policy blocked it | 🔴 offer manual entry, and never re-prompt |
| `2` | `POSITION_UNAVAILABLE` | the device could not determine a position | a retry is reasonable; so is falling back |
| `3` | `TIMEOUT` | no fix inside `timeout` | retry with a longer timeout or lower accuracy |

**Distinguishing 1 from 2 and 3 is the whole point of the error callback.** A denial is a settled
decision that deserves a different screen; a timeout is a transient failure that deserves a retry
button.

## Wrapping it, because callbacks age badly

```js
const getPosition = (options) =>
  new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options),
  );

try {
  const pos = await getPosition({ timeout: 10_000, maximumAge: 300_000 });
} catch (err) {
  if (err.code === 1) offerManualEntry();
  else offerRetry();
}
```

This is the callback-to-promise bridge in its most useful form — and note that the rejection value
is a `GeolocationPositionError`, **not** an `Error`, so it has `code` and `message` but no stack.
Do not test it with `instanceof Error`.

## Before you ask at all

🔴 **Most "location" features do not need the Geolocation API.** A country and city good enough for
currency, shipping estimates or a default store can be derived server-side from the request, with
no prompt, no permission and no privacy exposure. Ask the device only when you need the *device's*
position — a map, directions, a nearest-branch search with a radius.

Then follow the permission rules from [01](./01-the-permission-model.md): check the state, ask on
the click that needs it, and ship a manual-entry path that works when the answer is no.

⚠️ **Two constraints worth knowing before designing around it:** the API is **secure-context only**,
so it is HTTPS or nothing; and in an iframe it needs the embedder's
`Permissions-Policy: geolocation=(self …)` or an `allow="geolocation"` attribute. MDN also notes
that the API may be unusable in some regions — it names **China**, where local providers are used
instead — so a global product needs a plan for "the API exists and never returns a position".

## Privacy: collect coarse, store less

- **Round before you send.** Three decimal places is around 100 m; five is a doorstep. Send the
  precision the feature needs and no more.
- **Do not persist a track you do not need.** A stored history of precise positions is one of the
  most sensitive datasets a web app can hold, and it is subject to law in most jurisdictions.
- **Say what you will do with it** before the prompt. That is what makes the pre-prompt work.

## Gotchas

**Symptom: the spinner runs forever and no error is logged.**
Cause — `timeout` defaults to `Infinity`.
Fix — always pass a timeout; treat `TIMEOUT` as a real, expected branch.

**Symptom: it works on the laptop and fails on a phone indoors.**
Cause — no GPS fix; `POSITION_UNAVAILABLE` or a timeout.
Fix — lower `enableHighAccuracy`, allow a cached position with `maximumAge`, offer manual entry.

**Symptom: battery complaints from users of the map screen.**
Cause — a high-accuracy `watchPosition` that is never cleared.
Fix — `clearWatch` on teardown and on `visibilitychange`.

**Symptom: the pin is confidently in the wrong street.**
Cause — `accuracy` was ignored.
Fix — render the uncertainty; degrade the wording when the radius is large.

**Symptom: `err instanceof Error` is false.**
Cause — the failure value is a `GeolocationPositionError`.
Fix — branch on `err.code`.

**Symptom: geolocation silently fails inside an embedded widget.**
Cause — permissions policy not delegated by the embedder.
Fix — the embedding page must `allow="geolocation"`; it cannot be fixed from inside.

## Interview questions

**★ What is the most dangerous default in the Geolocation API?**
`timeout: Infinity`. Without an explicit timeout the error callback may never fire and the UI waits
forever — a failure mode that does not reproduce on a developer machine.

**★ What does `coords.accuracy` mean, and why does it matter?**
It is the radius of uncertainty in metres. A large radius means the fix is a neighbourhood, so
drawing a precise pin misrepresents the data; the UI should show a circle or soften the copy.

**★ How do you distinguish "the user said no" from "we could not get a fix"?**
The error callback's `code`: `1` is `PERMISSION_DENIED`, `2` is `POSITION_UNAVAILABLE`, `3` is
`TIMEOUT`. Only the first is permanent, and only the first should change the screen for good.

**★ When would you use `watchPosition` over `getCurrentPosition`?**
Only when movement itself is the feature — navigation, live tracking. A watch holds a location
provider open, so it must be cleared on teardown and paused when the page is hidden.

**★ A product manager wants the user's city to set the currency. What do you build?**
Not this API. Derive a coarse location on the server from the request and let the user change it.
The prompt costs a permission you may need later, and the data is far more precise than the feature
requires.

---

← [01 · The permission model](./01-the-permission-model.md) · [Topic index](./README.md) · [03 · Notifications](./03-notifications.md) →
