---
title: "The install prompt is a Chromium-only event you may capture but must never depend on, and the only cross-browser install signal is a CSS media query"
sidebar_label: "10d · Installability and the install prompt"
sidebar_position: 10
description: "beforeinstallprompt, appinstalled, display-mode: standalone detection, getInstalledRelatedApps, and a progressive install component that degrades to real instructions."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against MDN's
> [`beforeinstallprompt`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event)
> and [`Navigator.getInstalledRelatedApps()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getInstalledRelatedApps),
> and the Next.js [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
> Target: **Next.js 16.3.4**, App Router, browsers Chrome/Edge/Firefox 111+ and Safari 16.4+.

**Every "add to home screen" button you have ever seen on the web is built on an event that
exists in exactly one browser engine, is specified in an incubation draft rather than a
standard, and fires on a schedule nobody controls.** The correct shape is therefore not "wire
up `beforeinstallprompt`" — it is "offer a real button when the platform hands you one, and
honest instructions when it does not, and nothing at all once the app is installed." Getting
that third state right is what separates a component that works from one that nags installed
users forever. This follows the manifest pages
([10](10-progressive-web-apps.md), [10b](10b-manifest-fields-that-change-behaviour.md),
[10c](10c-secondary-manifest-members-and-typing.md)); nothing here works without a valid
manifest first.

## What the platform actually gives you

Three signals, with three very different levels of support.

| Signal | What it tells you | Where it works |
|---|---|---|
| `beforeinstallprompt` event | "I would install this if you asked" | Chromium only; WICG Manifest Incubations draft, MDN availability *limited* |
| `appinstalled` event | "The user just installed it" | Chromium, same family |
| `matchMedia('(display-mode: standalone)')` | "You are running inside an installed window right now" | Everywhere that supports installed windows |

The third row is the important one. It is not an API, it is a CSS media query, and it is the
only install-state signal you can rely on across engines. Build the component around it and
treat the two events as enhancements.

## The install prompt: capture it, never depend on it

`beforeinstallprompt` is a Chromium event defined in the WICG **Manifest Incubations** draft,
not a web standard, and MDN labels its availability *limited*. Safari does not fire it on any
platform. The Next.js guide's position is unambiguous:

> *"we do not recommend this as it is not cross browser and platform"*

That is advice about **depending** on it, not about using it. The right shape is a component
that offers a real button when the event arrives and honest platform instructions when it does
not — never a button that does nothing:

```tsx title="app/components/install-button.tsx"
'use client'

import { useEffect, useState } from 'react'

// Chromium-only, not in the DOM lib; see WICG Manifest Incubations.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(true) // assume installed until proven otherwise

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches)

    const onPrompt = (event: Event) => {
      event.preventDefault() // suppress Chromium's own mini-infobar
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  if (!deferred) {
    // Safari, Firefox, or Chromium that has not decided we are installable yet.
    return <InstallInstructions />
  }

  return (
    <button
      onClick={async () => {
        await deferred.prompt()
        await deferred.userChoice
        setDeferred(null) // the event is single-use
      }}
    >
      Install SprintDesk
    </button>
  )
}
```

Three details in that snippet earn their place. `preventDefault()` suppresses Chromium's own
install UI so yours is the only one on screen — skip it and the user sees two prompts.
`display-mode: standalone` is how you detect "already installed" without any API; it is a CSS
media query and it is the only cross-browser signal there is. And the deferred event is
**single-use** — calling `prompt()` twice on the same object does nothing, which is why it is
cleared after the choice resolves.

The initial `useState(true)` is deliberate. `matchMedia` cannot run on the server, so the
first client render must not assume "not installed" or the button flashes on for installed
users. Same-shaped problem as every other hydration-safe branch — see
[accessibility and safe hydration](04-accessibility-semantic-html-aria-safe-hydration-keyboard-fir.md).


## The fallback the snippet referenced

`InstallInstructions` is where most implementations quietly give up and render nothing. Don't.
The set of platforms that will never fire `beforeinstallprompt` includes every iOS browser and
Firefox, and on those the install path exists — it is just manual.

```tsx title="app/components/install-instructions.tsx"
'use client'

import { useEffect, useState } from 'react'

type Platform = 'ios' | 'firefox' | 'chromium-pending' | 'unknown'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iOS Safari and every other iOS browser share the same WebKit install path.
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Firefox\//.test(ua)) return 'firefox'
  if ('onbeforeinstallprompt' in window) return 'chromium-pending'
  return 'unknown'
}

export function InstallInstructions() {
  const [platform, setPlatform] = useState<Platform>('unknown')
  useEffect(() => setPlatform(detectPlatform()), [])

  switch (platform) {
    case 'ios':
      return (
        <p>
          Tap the Share button in Safari, then <strong>Add to Home Screen</strong>.
        </p>
      )
    case 'firefox':
      return (
        <p>
          Open the browser menu, then <strong>Install</strong> (Android) or add a bookmark to
          your home screen.
        </p>
      )
    case 'chromium-pending':
      return (
        <p>
          Use the install icon in the address bar, or the browser menu →{' '}
          <strong>Install app</strong>.
        </p>
      )
    default:
      return null
  }
}
```

Two notes on that. `'onbeforeinstallprompt' in window` is a *capability* check, not a UA
sniff — it tells you the engine has the event even when it has not fired yet, which is the
common case on a first visit before Chromium has decided you are install-worthy. And the iOS
branch is deliberately the only user-agent test in the file, because there is genuinely no
feature to detect there; the constraints behind it are in
[10p](10p-ios-and-safari-limits.md).

## Gotchas

### `matchMedia` in a Server Component
**Symptom.** `ReferenceError` at build, or a hydration mismatch on the install button.
**Cause.** Install detection is browser-only state. Every part of this — `beforeinstallprompt`,
`display-mode`, `appinstalled` — exists only on `window`.
**Fix.** `'use client'` plus reading it inside `useEffect`, never during render, as in the
component above. Cross-reference [server vs client components](../03-server-components-vs-client-components/01-explanation.md).

### The install button flashes on for users who already installed
**Symptom.** A one-frame "Install" button in the installed app itself.
**Cause.** `useState(false)` for "installed" plus an effect that corrects it. The first client
render happens before the effect, so the wrong branch paints.
**Fix.** Initialise to the conservative value — `useState(true)` for *installed* — and let the
effect reveal the button. A button that appears a frame late is invisible; one that disappears
a frame late is a bug report.

### Two install prompts on screen
**Symptom.** Your button and Chromium's own mini-infobar, simultaneously.
**Cause.** You handled `beforeinstallprompt` but did not call `preventDefault()` on it.
**Fix.** `event.preventDefault()` first thing in the handler, before you stash the event.

### The deferred event is used twice and does nothing the second time
**Symptom.** The user dismisses the prompt, clicks Install again, nothing happens.
**Cause.** The prompt object is single-use. `prompt()` on an already-consumed event resolves
without showing UI.
**Fix.** Clear the stored event after `userChoice` settles, as in the component. If you want a
second chance, you must wait for the browser to fire `beforeinstallprompt` again — you cannot
force it.

### `beforeinstallprompt` never fires and the manifest looks fine
**Symptom.** Chromium, HTTPS, valid manifest, no event.
**Cause.** A missed installability criterion, most often no suitable icon, or —
the one that catches people — `prefer_related_applications: true` in the manifest, which MDN
states must be `false` or omitted for a Chromium install to be offered. See
[10c](10c-secondary-manifest-members-and-typing.md).
**Fix.** Audit the manifest first, not the JavaScript. The event is a *consequence* of
installability; nothing you write in the handler can create it.

### Testing install on `http://localhost` and concluding it works
**Symptom.** Everything installs locally and nothing installs on the staging URL.
**Cause.** `localhost` is a potentially trustworthy origin, so it is exempt from the HTTPS
requirement. A staging host on plain HTTP is not.
**Fix.** Test over TLS. `next dev --experimental-https` generates a locally trusted
certificate with `mkcert` and serves the dev server at `https://localhost:3000`; the docs are
explicit that this is a development-only mechanism and production needs properly issued
certificates.

## Interview questions

**Why is `beforeinstallprompt` unreliable, and what do you do instead?**
It is a Chromium-only event from the WICG Manifest Incubations draft — MDN marks its
availability as limited, and Safari never fires it, which is why the Next.js guide recommends
against depending on it. The workable pattern is progressive: capture the event and show a
real install button if it arrives, and otherwise render platform-appropriate instructions.
Detect the already-installed case with `matchMedia('(display-mode: standalone)')`, which works
everywhere.

**Your install button appears for users who already installed the app. Why?**
Either you never checked `display-mode: standalone`, or you initialised that state to
"not installed" and the first render leaked before the effect ran. Initialise to the
conservative value and let the effect correct it — the reverse produces a flash of a button
that should never have been offered.

**Why call `preventDefault()` on `beforeinstallprompt` if you are going to prompt anyway?**
Because the default action is Chromium showing its own install UI. Without the call the user
gets two competing prompts. Calling it does not cancel installability; it defers control of
the timing to you, which is the entire point of stashing the event.

**Can you show the install prompt twice?**
Not from the same event object — it is single-use, and a second `prompt()` resolves without
showing anything. You have to wait for the browser to fire `beforeinstallprompt` again, on its
own schedule, which you cannot trigger. Design the UI so the one chance you get is offered at
a moment the user is likely to accept.

**Everything installs on localhost and nothing installs on staging. First thing you check?**
The scheme. `localhost` is treated as a potentially trustworthy origin and is exempt from the
HTTPS requirement; a staging host served over plain HTTP is not, and installability is off.
`next dev --experimental-https` gives you a locally trusted certificate so local testing
matches, and it is explicitly a development-only tool.

**Chromium, HTTPS, valid-looking manifest, and `beforeinstallprompt` still never fires. Where
do you look?**
At the manifest, not the JavaScript. The event is emitted as a consequence of the browser
deciding the app is installable — no handler can conjure it. The usual causes are a missing or
unsuitable icon and `prefer_related_applications: true`, which MDN says must be `false` or
omitted for Chromium to offer an install.

---

← [10c · Secondary manifest members and typing](10c-secondary-manifest-members-and-typing.md) · [Chapter 12 overview](01-explanation.md) · Next → [10e · Detecting install state](10e-detecting-install-state.md)
