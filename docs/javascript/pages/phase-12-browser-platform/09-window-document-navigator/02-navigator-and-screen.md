---
title: "02 · navigator and screen"
sidebar_label: "02 · navigator and screen"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Navigator`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator), [`Navigator.userAgent`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent), [`NavigatorUAData`](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData), [`Navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine), [`Navigator.hardwareConcurrency`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency), [`StorageManager.estimate()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate), [`Screen`](https://developer.mozilla.org/en-US/docs/Web/API/Screen), [`ScreenOrientation`](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation), [Browser detection using the user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent). Documentation-validated; **no timings and no console output**.

`navigator` is where the browser describes itself and hands out the capabilities that need a
gatekeeper. Half of it is genuinely useful, and the other half is a museum of things that were
once true.

## 🔴 `userAgent` lies, and it always has

```js
navigator.userAgent;   // a string every browser has spent decades faking
```

The string was designed for content negotiation and immediately became an arms race — every
browser claims to be several others so that badly-written sniffing lets it through. Chrome
**freezes and reduces** what it reports, and MDN's own guidance is to treat browser detection as a
last resort.

**Detect the feature, not the browser:**

```js
// ❌ wrong tomorrow, and wrong today for browsers you did not think of
if (/Safari/.test(navigator.userAgent)) useFallback();

// ✅ asks the question you actually have
if (!('showPicker' in HTMLInputElement.prototype)) useFallback();
```

The full argument is [Phase 0 · 10 · Feature detection](../../phase-0-how-javascript-runs/10-feature-detection.md)
and **12 · Feature detection and progressive enhancement** *(not written yet)*.

**`navigator.userAgentData`** is the structured replacement where it exists — `brands`, `mobile`,
`platform`, plus `getHighEntropyValues()` for details behind a promise. It is not universally
implemented, so it is a nicer *fallback* for the last resort, not a reason to start sniffing
again.

⚠️ **The one legitimate use is telemetry.** Recording which browsers hit an error is fine.
Branching behaviour on it is what causes the "works in every browser except the new one" bug.

## The capability surface

| Property / method | What it gives | Watch out |
|---|---|---|
| `language`, `languages` | the user's preferred locales | use with `Intl`, not with a hand-rolled table |
| `onLine` | connected to **a** network | ⚠️ says nothing about the internet being reachable |
| `hardwareConcurrency` | logical cores | a hint for pool sizing, not a budget ([07 · 03](../07-web-workers/03-deciding-and-patterns.md)) |
| `deviceMemory` | approximate RAM in GiB, coarsened | not everywhere; a hint only |
| `storage.estimate()` | `{ usage, quota }` for this origin | approximate on purpose |
| `storage.persist()` | ask for storage that is not evicted | requires permission/engagement |
| `sendBeacon()` | fire-and-forget report on unload | the metrics path ([06 · 03](../06-performanceobserver/03-the-metrics.md)) |
| `clipboard`, `share`, `mediaDevices`, `geolocation`, `credentials`, `serviceWorker`, `wakeLock` | permissioned capabilities | secure context, and mostly a user gesture |
| `permissions.query()` | the state of a permission without asking | not every permission is queryable |
| `cookieEnabled` | whether cookies are allowed | true does not mean third-party cookies work |
| `vibrate()` | mobile haptics | ignored on desktop, requires engagement |

🔴 **Almost everything interesting requires a secure context.** `isSecureContext` gates the
Clipboard API, `mediaDevices`, geolocation, service workers, `crypto.subtle` and more — which is
why "it works on localhost and not on the staging box" is nearly always plain HTTP.

### `onLine` is not a connectivity check

```js
addEventListener('offline', () => showBanner());
addEventListener('online', () => retryQueue());
```

`false` reliably means "no network". **`true` means almost nothing** — a captive portal, a dead
uplink or a broken DNS all report `true`. Use it to react quickly to the obvious case, and treat a
failed request as the real signal.

### `connection` — a hint, not a contract

`navigator.connection` (Network Information) exposes `effectiveType` (`'4g'`, `'3g'`, …),
`downlink`, `rtt` and `saveData`. Support is limited and the values are coarse and mutable.

**`saveData` is the one worth honouring** — the user has explicitly asked for less. Skip
prefetching, drop to smaller images, do not autoplay ([08 · 02 · Building a router](../08-history-and-routing/02-building-a-router.md)).

## `screen`, and what "the screen" even means

| Property | Meaning |
|---|---|
| `screen.width` / `height` | the whole screen, in CSS pixels |
| `screen.availWidth` / `availHeight` | minus OS chrome — taskbars, docks |
| `screen.colorDepth` / `pixelDepth` | bits per pixel; effectively always 24 |
| `screen.orientation.type` / `angle` | `'portrait-primary'`, `'landscape-primary'`, … |
| `window.screenX` / `screenY` | where the *window* sits on the screen |

⚠️ **`screen` is almost never the number you want.** Layout decisions belong to the **viewport**
(`matchMedia`, container queries) — a maximised window on a 4K monitor and a small window on the
same monitor report the same `screen.width` and need different layouts.

```js
screen.orientation.addEventListener('change', () => relayout(screen.orientation.type));
```

`screen.orientation.lock()` requires fullscreen and is mobile-only; treat a rejection as normal
rather than as an error worth reporting.

## The legacy shelf

| Legacy | Status |
|---|---|
| `navigator.appName`, `appVersion`, `platform`, `product`, `vendor` | frozen strings kept for compatibility; meaningless |
| `navigator.plugins`, `mimeTypes` | frozen or empty since NPAPI died |
| `navigator.doNotTrack` | effectively dead; Global Privacy Control is the successor idea |
| `navigator.javaEnabled()` | returns `false`, always |
| `navigator.battery` | removed; `getBattery()` is restricted and being wound back |

🔴 **Reading any of these is a fingerprinting signal**, and browsers are actively reducing what
they return. A pile of "harmless" reads — fonts, screen size, core count, timezone — identifies a
user better than a cookie does. Ask for what you need, when you need it, and nothing else.

## Gotchas

**Symptom: the app breaks in a browser released after it shipped.**
Cause — user-agent sniffing.
Fix — feature detection; keep the UA string for telemetry only.

**Symptom: `navigator.onLine` is `true` but every request fails.**
Cause — connected to a network, not to the internet — a captive portal is the classic case.
Fix — treat request failure as the truth; use `onLine`/`offline` for fast feedback only.

**Symptom: `navigator.clipboard` is `undefined` on the staging server.**
Cause — not a secure context; the page is plain HTTP.
Fix — HTTPS (localhost is treated as secure); check `isSecureContext` in diagnostics.

**Symptom: a worker pool sized from `hardwareConcurrency` makes phones slower.**
Cause — it reports logical cores and says nothing about current load or thermal state.
Fix — cap the pool; measure.

**Symptom: layout decisions based on `screen.width` are wrong in a small window.**
Cause — `screen` is the display, not the viewport.
Fix — `matchMedia`, `innerWidth`, or container queries.

**Symptom: `storage.estimate()` numbers do not match what was written.**
Cause — they are deliberately approximate and padded.
Fix — use them for "am I near the limit", never for accounting.

**Symptom: `screen.orientation.lock()` rejects.**
Cause — not fullscreen, or a desktop browser.
Fix — expect the rejection; design for both orientations rather than locking.

## Interview questions

**★ Why is user-agent sniffing discouraged?**
The string has been deliberately misleading for decades — every browser claims to be several
others — and it is now being frozen and reduced. Sniffing encodes today's browser list into your
code, so it fails for the browser that ships next. Detect the feature instead.

**★ What is `navigator.userAgentData`?**
A structured replacement for the UA string: `brands`, `mobile` and `platform`, with the detailed
values behind an async `getHighEntropyValues()` call. It is not universal, so it improves the
last-resort path rather than replacing feature detection.

**★ Can you trust `navigator.onLine`?**
Only when it is `false`. `true` merely means a network interface is up — a captive portal or a
dead uplink still reports `true`. The reliable signal is a request that failed.

**★ Which `navigator` APIs need a secure context?**
Effectively all the powerful ones — clipboard, media devices, geolocation, service workers,
`crypto.subtle`, storage persistence. It is the usual explanation for "works on localhost, not on
staging".

**★ When would you use `screen` instead of the viewport?**
Rarely — for genuinely display-level questions such as orientation, or positioning a popup window.
Layout is a viewport question, and `screen` does not change when the user resizes the window.

**What is the privacy angle on all of this?**
Every read is a fingerprinting bit. Screen size, core count, memory, language and installed
features combine into a stable identifier, which is why browsers freeze, coarsen and remove these
values — and why you should read only what a feature actually needs.

---

← [01 · window and document](./01-window-and-document.md) · [Topic index](./README.md)
