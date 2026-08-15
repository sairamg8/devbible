---
title: "02 · Wake Lock and Battery"
sidebar_label: "02 · Wake Lock and Battery"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API), [`WakeLock.request()`](https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request), [`WakeLockSentinel`](https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel), [Battery Status API](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API), [`BatteryManager`](https://developer.mozilla.org/en-US/docs/Web/API/BatteryManager), [`NetworkInformation.saveData`](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData). Documentation-validated; **no timings and no console output**. ⚠️ MDN marks the Battery Status API **limited availability — not Baseline**, and the Wake Lock API needs a secure context; feature-detect both.

Two APIs about the same resource from opposite ends: one asks the device to *spend* battery, the
other asks how much is left. One is genuinely useful; the other is mostly a lesson in why the
platform stopped adding APIs like it.

## Screen Wake Lock: keeping the screen on

```js
let sentinel = null;

async function keepAwake() {
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch (err) {
    // NotAllowedError — power save, low battery, or the page is not active/visible
  }
}

async function letItSleep() {
  await sentinel?.release();
  sentinel = null;
}
```

The request resolves with a **`WakeLockSentinel`** — the object that *is* the lock. Release it and
the screen may dim again. Two properties of the design decide how you use it:

🔴 **The browser releases it for you, in situations you do not control.** MDN lists the document
becoming inactive or hidden, the battery running low, and system power-save mode. So the lock is
not a setting you apply once — **it is state that can disappear**, and the `release` event is how
you learn it did.

🔴 **Because "hidden" releases it, you must re-acquire on `visibilitychange`:**

```js
document.addEventListener('visibilitychange', async () => {
  if (wanted && document.visibilityState === 'visible') await keepAwake();
});
```

Note the `wanted` flag: re-acquire only if the *user's* intent is still active. Blindly
re-requesting turns a released lock into one the user cannot switch off by leaving the tab.

**What it is for**, and the list is short: a recipe or workout on screen while the user's hands are
busy, a QR code or boarding pass being scanned, a presentation, a navigation view, a live dashboard
on a wall. **What it is not for:** keeping a download or an upload alive — the screen has nothing
to do with that, and MDN's own guidance is to release immediately when the lock is no longer
needed and to use background mechanisms for long-running work.

⚠️ **Secure context, and iframes need delegation** — the `screen-wake-lock` permissions-policy
directive defaults to `self`, so an embedded frame needs `allow="screen-wake-lock"`. Feature-detect
with `'wakeLock' in navigator` and treat the whole feature as an enhancement.

## Battery Status: the API to know about and mostly not use

```js
if ('getBattery' in navigator) {
  const battery = await navigator.getBattery();
  battery.level;            // 0.0 – 1.0
  battery.charging;         // boolean
  battery.chargingTime;     // seconds until full
  battery.dischargingTime;  // seconds until empty
  battery.addEventListener('levelchange', update);
}
```

Four properties, four `*change` events, one promise. And three reasons it is not the tool most
uses of it want:

- ⚠️ **MDN marks it limited availability — not Baseline.** It does not work in some widely used
  browsers, so anything built on it needs a full path without it. It is also **not exposed in Web
  Workers**.
- **It is a fingerprinting surface**, which is precisely why support narrowed: a battery level
  plus a discharge time is a distinctive, slowly-changing identifier.
- **Battery level is rarely the right input.** "Am I on a phone that is nearly dead" is a proxy for
  questions the platform answers better — and users hate silent behaviour changes they did not ask
  for.

**Prefer the signals designed for the job:**

| The question | Better answer |
|---|---|
| Should I download less? | `navigator.connection?.saveData` — the user's own Data Saver choice |
| Should I animate less? | `prefers-reduced-motion` ([11 · Accessibility](../11-accessibility-from-javascript/README.md)) |
| Should I do less work right now? | `visibilitychange`, `requestIdleCallback`, `scheduler` ([14 · Yielding](../14-yielding-to-the-main-thread.md)) |
| Should the screen stay on? | Screen Wake Lock — with the user's intent behind it |

🔴 **If a battery-saving behaviour matters, make it a setting.** A visible "Low data mode" toggle is
honest, testable, works in every browser, and does not depend on an API that may not be there.

## The honest summary

The pattern across this whole topic: **the platform gives you the user's context, and the correct
response is almost always to do less, or to ask.** Pause when hidden. Hold the screen awake only
while the user is looking at something that needs it, and let go the moment they are not. Do not
infer intent from a battery percentage.

## Gotchas

**Symptom: the screen dims halfway through the recipe.**
Cause — the lock was released automatically (the tab was hidden, or power-save kicked in).
Fix — listen for `release` and re-acquire on `visibilitychange` while the user's intent is active.

**Symptom: `NotAllowedError` on a device that clearly supports it.**
Cause — the page was not active or visible, the battery is low, or power-save is on.
Fix — request only from a visible page and treat failure as normal; never block the UI on it.

**Symptom: the screen stays on after the user navigated away in an SPA.**
Cause — the sentinel was never released on route change.
Fix — `release()` in teardown; a lock outlives a component that forgets it.

**Symptom: the wake lock does nothing inside an embedded widget.**
Cause — the `screen-wake-lock` policy defaults to `self`.
Fix — the embedder must `allow="screen-wake-lock"`.

**Symptom: `navigator.getBattery` is not a function.**
Cause — limited availability; it is absent in some browsers and in workers.
Fix — feature-detect, and build the feature so it works without any battery information.

**Symptom: a "low battery" mode makes the app behave differently for no visible reason.**
Cause — inferring intent from a hardware reading.
Fix — a user-visible setting, or `saveData` — signals the user actually chose.

## Interview questions

**★ What does a screen wake lock do, and what does it not do?**
It asks the device to keep the *screen* on. It does not keep a tab alive, does not stop throttling,
and does not keep work running in the background — the browser also releases it automatically when
the page is hidden or the battery is low.

**★ Why is re-acquiring on `visibilitychange` part of every wake-lock implementation?**
Because hiding the page releases the lock. Returning to a visible page with the user's intent still
active means requesting a new sentinel — the old one is gone.

**★ What is the `release` event for?**
Learning that the browser released the lock without you — power-save, low battery, or the page
becoming hidden. Without it your code believes a lock is held when it is not.

**★ Why is the Battery Status API rarely the right answer?**
Limited availability, no worker exposure, and it is a fingerprinting surface. The questions people
ask it are better answered by `saveData`, `prefers-reduced-motion`, visibility, or an explicit user
setting.

**★ When should an app change its behaviour based on device conditions?**
When the user has expressed the preference — Data Saver, reduced motion, a setting in your own UI —
or when the platform tells you the page is hidden. Inferred, silent changes from hardware readings
are the ones users report as bugs.

---

← [01 · The page lifecycle](./01-the-page-lifecycle.md) · [Topic index](./README.md)
