---
title: "Almost every PWA technique works on iOS, but only after the user manually adds the app to the Home Screen, and that one condition invalidates most published advice"
sidebar_label: "10p · iOS and Safari limits"
sidebar_position: 46
description: "The 16.4 floor, no beforeinstallprompt, push only for Home Screen web apps, the separate storage container, the seven-day script-writable storage cap and its carve-out."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against WebKit's
> [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
> and [Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/),
> the Next.js [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps),
> and MDN [`beforeinstallprompt`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event).
> Target: **Next.js 16.3.4**; browser floor **Safari 16.4+**, Chrome/Edge/Firefox 111+.
> Documentation-verified; **no sandbox run**.

**iOS does not lack PWA support. It gates it behind a manual, un-promptable, un-detectable
user action — tapping Share and then "Add to Home Screen" — and everything interesting is on
the far side of that gate: push notifications, badging, a storage container that is not
subject to the seven-day eviction rule, and a window that is actually an app.** A web app on
iOS that has not been added to the Home Screen is a web page with a manifest. That single
condition is why so much PWA advice, written and tested on Chromium, quietly does nothing for
half of a consumer audience — and why the install instructions component in
[10d](10d-installability-and-the-install-prompt.md) is not a nicety.

## The version floor, and why it matches the framework's

Next.js 16 supports Safari **16.4+**. That is the same release in which WebKit shipped Web Push
for Home Screen web apps, so for this topic the framework's browser floor and the feature floor
coincide — anything running a supported Safari can, in principle, do everything on this page.
You do not have to write fallbacks for pre-16.4 Safari in a Next 16 app, because that Safari is
outside the framework's support matrix anyway. What you *do* have to write is the path for a
16.4+ user who simply has not installed the app, which is the overwhelming majority of them.

## What is different before the app is installed

| Capability | Safari tab on iOS | Home Screen web app on iOS |
|---|---|---|
| Service worker | ✅ | ✅ |
| Cache API, IndexedDB | ✅ | ✅ |
| Web Push | ❌ | ✅ (16.4+) |
| Badging API | ❌ | ✅ (16.4+) |
| `display: standalone` window | ❌ | ✅ |
| `beforeinstallprompt` | ❌ never | ❌ never |
| Seven-day script-writable storage cap | ✅ applies | carve-out — see below |
| Shares Safari's cookies and storage | ✅ | ❌ separate container |

Two rows deserve their own sections.

## Push requires installation, and a real tap

WebKit's position is unambiguous: Web Push on iOS and iPadOS 16.4+ applies to **Home Screen web
apps** — sites added to the Home Screen whose manifest sets `display` to `standalone` or
`fullscreen` — and the permission request must come in response to direct user interaction,
such as tapping a subscribe button. The Next.js guide's own support list says the same thing
from the other direction: *iOS 16.4+ for applications installed to the home screen*.

So the subscribe flow in [10l](10l-web-push-the-subscription-flow.md) needs a third state on
iOS, between "supported" and "not supported": **supported, but not until you install this**.

```tsx title="app/components/push-gate.tsx"
'use client'

import { useEffect, useState } from 'react'
import { PushSubscribe } from './push-subscribe'

type Gate = 'checking' | 'unsupported' | 'needs-install' | 'ready'

export function PushGate() {
  const [gate, setGate] = useState<Gate>('checking')

  useEffect(() => {
    const hasPush = 'serviceWorker' in navigator && 'PushManager' in window
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches

    if (hasPush && (!isIOS || isStandalone)) return setGate('ready')
    // On iOS the APIs may be present in a tab and still refuse to subscribe.
    if (isIOS && !isStandalone) return setGate('needs-install')
    setGate('unsupported')
  }, [])

  if (gate === 'checking') return null
  if (gate === 'ready') return <PushSubscribe />
  if (gate === 'needs-install') {
    return (
      <p>
        To get notifications on iPhone or iPad, tap Share and then{' '}
        <strong>Add to Home Screen</strong>. Notifications can be turned on from the installed
        app.
      </p>
    )
  }
  return <p>This browser does not support notifications.</p>
}
```

Feature detection alone is not sufficient here, which is the uncomfortable part: the presence
of `PushManager` in a Safari tab does not mean `subscribe()` will succeed. That is the one place
in this topic where a user-agent test is the honest tool, and it should be the only one in the
codebase.

WebKit also shipped the Badging API for Home Screen web apps in 16.4, so `navigator.setAppBadge()`
and `clearAppBadge()` are available under the same condition — installed, not in a tab.

## Icons: ship the Apple tags as well as the manifest

Next's `appleWebApp` metadata emits the iOS-specific tags — `apple-mobile-web-app-title`,
`apple-mobile-web-app-status-bar-style`, `apple-touch-startup-image`, and
`mobile-web-app-capable`:

```ts title="app/layout.tsx"
import type { Metadata } from 'next'

export const metadata: Metadata = {
  appleWebApp: {
    title: 'SprintDesk',
    statusBarStyle: 'black-translucent',
    startupImage: [
      '/apple/startup-1170x2532.png',
      {
        url: '/apple/startup-1536x2048.png',
        media: '(device-width: 768px) and (device-height: 1024px)',
      },
    ],
  },
}
```

Pair it with `app/apple-icon.png`, which the file convention turns into
`<link rel="apple-touch-icon">`.

⚠️ **Unconfirmed.** Whether iOS 16.4+ reads the manifest's `icons[]` for the Home Screen icon in
every case, or still prefers `apple-touch-icon`, is not something I could settle from a primary
source. Ship both; they cost one file each and the failure mode of getting it wrong is a
screenshot of your page rendered as an icon.

## Gotchas

### Feature-detecting `PushManager` and offering to subscribe in a Safari tab
**Symptom.** The subscribe button appears on iPhone, the user taps it, and nothing happens or
the promise rejects.
**Cause.** The API surface exists in a tab; the capability does not. WebKit restricts Web Push
to Home Screen web apps.
**Fix.** Gate on `display-mode: standalone` in addition to feature detection on iOS, as in
`PushGate` above, and render install instructions instead of a dead button.

### Requesting notification permission outside a tap
**Symptom.** Permission is never granted on iOS; on other platforms it is denied and stays
denied.
**Cause.** WebKit requires the request to follow direct user interaction, and the general
platform direction is the same.
**Fix.** The request lives in the `onClick` of a button the user chose to press. Never in an
effect, never behind a timer, never on scroll.

### Assuming installation is detectable or promptable
**Symptom.** An install button that does nothing on iOS, or analytics reporting zero installs.
**Cause.** Safari does not implement `beforeinstallprompt` on any platform, and there is no API
that reports "the user added this to the Home Screen". `getInstalledRelatedApps()` is Chromium
only.
**Fix.** Instructions, not a button — and infer installation from
`matchMedia('(display-mode: standalone)')` on subsequent visits, which is the only signal there
is. Instrument that instead of an install event.

### `display: 'browser'` and expecting an app window
**Symptom.** The app is added to the Home Screen and opens in Safari with full browser UI, and
push does not work.
**Cause.** WebKit's Web Push requirement names `display` values of `standalone` or `fullscreen`
specifically. `browser` is the manifest default when `display` is omitted.
**Fix.** Set `display: 'standalone'` explicitly in the manifest — see
[10b](10b-manifest-fields-that-change-behaviour.md). Omission is not neutral here.

### Testing iOS behaviour in Chrome's device emulation
**Symptom.** Everything passes; real devices fail.
**Cause.** Device emulation changes the viewport and the user-agent string. It does not change
the engine, and every constraint on this page is a WebKit engine behaviour.
**Fix.** Test on a real iPhone or iPad, installed and uninstalled, on the version you claim to
support. There is no substitute, and the failure modes here — a silent permission refusal, a
cache evicted a week later — are exactly the kind that emulation cannot reproduce.

### One user-agent test becoming ten
**Symptom.** A `isIOS` helper spreading through the codebase.
**Cause.** The legitimate exception on this page — you cannot feature-detect "push will work
here" — read as licence to sniff generally.
**Fix.** Keep exactly one detection, in one module, with a comment stating why feature detection
is insufficient:

```ts title="lib/platform.ts"
// The ONLY user-agent test in this codebase. Justification: on iOS, PushManager is
// present in a Safari tab but subscribe() is restricted to Home Screen web apps, so
// no feature check can distinguish the two states.
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}
```

## Interview questions

**★ Why does most PWA advice fail on iOS?**
Because it is written against Chromium, where the browser offers to install the app and most
capabilities work in a tab. On iOS the capabilities that matter — push, badging, a standalone
window, and storage that is not on a seven-day fuse — are all gated behind the user manually
choosing Share → Add to Home Screen, an action you cannot prompt, cannot trigger and cannot
directly observe.

**★ What exactly does iOS require before Web Push works?**
iOS or iPadOS 16.4 or later, the site added to the Home Screen, a manifest whose `display` is
`standalone` or `fullscreen`, and a permission request made in response to direct user
interaction. Miss any one and `subscribe()` does not succeed — and because `PushManager` is
present in a Safari tab regardless, feature detection alone will tell you it should have worked.

**How do you detect that iOS can do push, given feature detection is insufficient?**
Combine the feature check with `matchMedia('(display-mode: standalone)')`, and fall back to a
user-agent test for iOS specifically, so that an iOS user in a tab is shown install
instructions rather than a button that fails. It is the one place a UA test is the correct tool;
keep it in a single module with the justification written down, because that exception has a
habit of spreading.

**Can you show an install prompt on iOS, or detect that the user installed the app?**
No to the first — Safari does not implement `beforeinstallprompt` on any platform, and
`getInstalledRelatedApps()` is Chromium-only. Partly to the second: on a later visit inside the
installed window, `matchMedia('(display-mode: standalone)')` is true, so you can instrument
usage of an installed app even though you cannot observe the install event itself.

**Why does Next.js targeting Safari 16.4+ simplify this topic?**
Because 16.4 is also the release in which WebKit shipped Web Push and the Badging API for Home
Screen web apps. The framework's browser floor and the feature floor coincide, so there is no
pre-16.4 fallback to write in a Next 16 app. The branch you do have to write is not by version,
it is by installation state.

**Is emulating an iPhone in Chrome DevTools sufficient to test any of this?**
No. Emulation changes the viewport and the user-agent string; it does not change the rendering
engine, and every constraint here is WebKit engine behaviour. Worse, the failures are quiet — a
permission that is refused rather than errored, a cache evicted a week after your test — so the
emulator produces confident false passes. Test on hardware, both installed and in a tab.

**Which Apple-specific metadata still matters when the manifest exists?**
`appleWebApp` in Next's metadata, which emits `apple-mobile-web-app-title`,
`apple-mobile-web-app-status-bar-style`, `apple-touch-startup-image` and
`mobile-web-app-capable`, plus an `app/apple-icon.png` for `apple-touch-icon`. Whether iOS 16.4+
also reads the manifest's `icons[]` for the Home Screen icon in every case is not something the
primary sources settle, so ship both — they are one file each, and the failure mode is a
screenshot of your page used as the icon.

---

← [Push in the service worker](10o-push-in-the-service-worker.md) · [Chapter 12 overview](01-explanation.md) · Next → [iOS storage and app containers](10q-ios-storage-and-installed-app-containers.md)
