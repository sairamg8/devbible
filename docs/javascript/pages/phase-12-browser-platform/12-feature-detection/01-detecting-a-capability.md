---
title: "01 · Detecting a capability, correctly"
sidebar_label: "01 · Detecting a capability"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`CSS.supports()`](https://developer.mozilla.org/en-US/docs/Web/API/CSS/supports_static), [`PerformanceObserver.supportedEntryTypes`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/supportedEntryTypes_static), [`Navigator.canShare()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare), [`HTMLMediaElement.canPlayType()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canPlayType), [`Intl.supportedValuesOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf), [Browser detection using the user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent), [`isSecureContext`](https://developer.mozilla.org/en-US/docs/Web/API/isSecureContext). Documentation-validated; **no timings and no console output**.

⚠️ **The principle is [Phase 0 · 10 · Feature detection](../../phase-0-how-javascript-runs/10-feature-detection.md)** —
test for the thing you need, not for a browser. **This page is the platform-API version of that
skill**, where the check is harder than `if (thing)` and the failure modes are specific.

## The four shapes of a check

```js
'IntersectionObserver' in window                     // 1 · a global exists
'scrollBehavior' in document.documentElement.style   // 2 · a property on a prototype/style
typeof navigator.share === 'function'                // 3 · a method exists
CSS.supports('display', 'grid')                      // 4 · ask the platform's own registry
```

🔴 **Prefer shape 4 whenever it exists.** Several APIs ship a *registry* — a way to ask the
browser directly instead of inferring from the presence of an object:

| Question | The registry |
|---|---|
| Is this CSS supported? | `CSS.supports(prop, value)` — and `@supports` in the stylesheet |
| Is this performance entry recorded? | `PerformanceObserver.supportedEntryTypes` |
| Can this actually be shared? | `navigator.canShare(data)` — the **data** matters, not just the API |
| Can this media play? | `mediaEl.canPlayType(type)` — returns `''`, `'maybe'` or `'probably'` |
| Does `Intl` know this timezone/currency? | `Intl.supportedValuesOf('timeZone')` |
| Is this codec configuration usable? | `VideoDecoder.isConfigSupported(config)` and friends |

**Why they exist: presence is not capability.** `navigator.share` can exist while the specific
payload is unshareable; `PerformanceObserver` can exist without the entry type you want. A
registry answers the question you actually have.

## The failure modes that make naive checks wrong

**1 · Present but non-functional.** An API can be exposed and throw, or be a stub. The classic is
storage:

```js
// ❌ 'localStorage' in window is true in private mode and in blocked third-party contexts
function storageWorks() {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
  catch { return false; }                 // 🔴 the only honest check is a write
}
```

**2 · Present but gated by secure context.** `crypto.subtle`, the Clipboard API, `mediaDevices`,
service workers and `randomUUID` are simply absent over plain HTTP — so the check passes on
localhost and fails on the staging box
([09 · 02 · navigator and screen](../09-window-document-navigator/02-navigator-and-screen.md)).

**3 · Present but permission-gated.** Notifications, geolocation and clipboard *read* exist
regardless of whether the user will allow them. Detection tells you the API is callable; only
calling it — or `navigator.permissions.query()` — tells you it will work.

**4 · Present but the option you pass is not.** Adding an option to an existing call is invisible
to a presence check. The documented trick is a getter that records whether the option was read:

```js
let supportsPassive = false;
try {
  addEventListener('t', null, Object.defineProperty({}, 'passive', {
    get() { supportsPassive = true; return false; },
  }));
} catch {}
```

**5 · Present in the page, absent in a worker or on the server.** `window` and `document` do not
exist in a worker; nothing DOM exists during server-side rendering. A check written as
`window.X` throws before it can be false.

```js
const canObserve = typeof IntersectionObserver !== 'undefined';   // 🔴 typeof never throws
```

## Detect once, at the boundary

```js
export const supports = Object.freeze({
  observers:  typeof IntersectionObserver !== 'undefined',
  webShare:   typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  loafEntries: typeof PerformanceObserver !== 'undefined'
    && PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'),
});
```

**One module, computed once, imported everywhere.** Scattering `if ('x' in window)` through the
codebase makes the fallback path untestable, because nothing can flip it. A single frozen object
can be stubbed in a test, which is the difference between a fallback that is checked in CI and one
nobody has ever run.

⚠️ **Do not cache a check whose answer can change.** Preferences (`prefers-reduced-motion`),
connectivity (`onLine`), permissions and `devicePixelRatio` are *state*, not capability — those are
watched, not detected ([11 · 02 · Preferences and testing](../11-accessibility-from-javascript/02-preferences-and-testing.md)).

## What not to detect on

| ❌ | Why |
|---|---|
| `navigator.userAgent` | designed to mislead, frozen, and wrong for the browser that ships next |
| Screen size as a proxy for touch | desktops have touchscreens; phones are plugged into keyboards |
| `'ontouchstart' in window` as "is mobile" | it means the *browser build* supports touch events, nothing about the device in use |
| The presence of one feature as proof of another | shipping is per-feature; "has A therefore has B" breaks every year |

**For input, ask about the input:** `matchMedia('(pointer: coarse)')` and `(hover: hover)` describe
how the user is actually pointing at things, and they update when a tablet is docked.

## Gotchas

**Symptom: `ReferenceError: X is not defined` in a worker or during SSR.**
Cause — `window.X` or a bare `X` evaluated where the global does not exist.
Fix — `typeof X !== 'undefined'`, which never throws.

**Symptom: the feature check passes and the API throws on use.**
Cause — private mode, a blocked context, or a stub.
Fix — for storage, attempt a write inside `try`; generally, treat the first real call as the check.

**Symptom: works on localhost, missing in staging.**
Cause — secure-context gating.
Fix — HTTPS, and surface `isSecureContext` in diagnostics.

**Symptom: `navigator.share` exists but sharing fails.**
Cause — the payload is not shareable, or there was no user gesture.
Fix — `navigator.canShare(data)`, and call it from a click handler.

**Symptom: an added option is silently ignored.**
Cause — presence checks cannot see options.
Fix — the getter probe, or a documented registry if the API has one.

**Symptom: the fallback path breaks the first time it is used in production.**
Cause — nothing exercised it; the checks were inline and unstubabble.
Fix — one capability module, stubbed in tests, both branches covered.

## Interview questions

**★ Why detect features rather than browsers?**
Because the UA string is deliberately misleading and being frozen, and because a browser list
encodes today's world into your code — it is wrong for the browser released next month. A feature
check asks the only question that matters.

**★ Give a case where "the API exists" is not enough.**
`localStorage` in private mode: the object is present and `setItem` throws. Or `navigator.share`,
which exists while the specific payload cannot be shared. Presence is not capability; write a real
probe, or use the API's own registry.

**★ How do you check whether an *option* is supported?**
With a getter probe — pass an options object whose property getter records that it was read. That
is how `{ passive: true }` support was detected before it was universal.

**★ Why `typeof X !== 'undefined'` rather than `window.X`?**
Because `window` does not exist in a worker or during server-side rendering, so the check itself
throws. `typeof` on an undeclared identifier is always safe.

**★ Which "detections" are actually state, and how do they differ?**
Preferences, connectivity, permissions and `devicePixelRatio`. They change while the page is open,
so they are watched with listeners rather than sampled once and cached.

**How would you structure the checks in an application?**
One module exporting a frozen capability object, computed once at load and imported everywhere —
so the fallback branch can be stubbed and tested rather than discovered in production.

---

[Topic index](./README.md) · [02 · Progressive enhancement](./02-progressive-enhancement.md) →
