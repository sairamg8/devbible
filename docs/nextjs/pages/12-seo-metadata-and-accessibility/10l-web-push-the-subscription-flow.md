---
title: "A push subscription is a URL the browser's push service hands you, and everything that goes wrong with push goes wrong while you are obtaining or storing that URL"
sidebar_label: "10l · Web Push: the subscription flow"
sidebar_position: 42
description: "VAPID keys and which half is public, the user-gesture rule, userVisibleOnly, why the subscription has to be JSON round-tripped before a Server Action sees it, and storing it properly."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), MDN
> [`PushManager.subscribe()`](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe),
> and the [web-push](https://github.com/web-push-libs/web-push) README.
> Target: **Next.js 16.3.4**, App Router, **web-push 3.6.7** (registry.npmjs.org, 2026-09-03).
> Documentation-verified; **no sandbox run**.

**Web Push has three parties and you only control two of them. The browser vendor runs a push
service; your server is an "application server" that authenticates to it with a VAPID keypair;
and the service worker is the only thing that can turn a delivered message into something the
user sees.** The subscription is the join between them — an endpoint URL on the vendor's push
service plus two encryption keys — and almost every push bug is really a subscription bug: the
wrong half of the VAPID pair shipped to the browser, a `subscribe()` call that was not a user
gesture, a subscription object that could not cross the Server Action boundary, or one stored
in a place that does not survive a deploy. This page is obtaining it in the browser; storing it
safely is [10m](10m-storing-push-subscriptions.md), and sending is
[10n](10n-sending-push-from-the-server.md).

## VAPID: which key goes where

VAPID is how the push service knows a message came from you. It is an **ECDSA P-256 keypair**:
the public key is handed to the browser at subscribe time, and the private key signs the
request your server later makes to the endpoint. MDN is blunt about the thing people get wrong
— the application server key is *not* the key used to encrypt the payload; that is a separate
ECDH key derived from the subscription itself and handled for you by the library.

Generate the pair once, per environment, with the CLI the Next.js guide names:

```bash title="Terminal"
npx web-push generate-vapid-keys
```

```bash title=".env.local"
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the public key>
VAPID_PRIVATE_KEY=<the private key>
```

🔴 The `NEXT_PUBLIC_` prefix is not cosmetic. It is the instruction that inlines a value into
the client bundle. The public key belongs there because the browser needs it; the private key
must never carry that prefix, and a single character of carelessness here publishes your
application server identity to every visitor. Treat rotating VAPID keys as invalidating every
existing subscription — the browser bound each one to the public key it was given.

## Subscribing, and the two rules that make it reject

```tsx title="app/components/push-subscribe.tsx"
'use client'

import { useEffect, useState } from 'react'
import { savePushSubscription, removePushSubscription } from '../actions/push'

// The applicationServerKey is a base64url string; PushManager wants the raw bytes.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function PushSubscribe() {
  const [supported, setSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)
    navigator.serviceWorker.ready.then(async (registration) => {
      setSubscription(await registration.pushManager.getSubscription())
    })
  }, [])

  if (!supported) return <p>Push notifications are not supported in this browser.</p>

  async function subscribe() {
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    })
    setSubscription(sub)
    // A PushSubscription is not a plain object; Server Action arguments must be
    // serialisable, so round-trip it through its own toJSON().
    await savePushSubscription(JSON.parse(JSON.stringify(sub)))
  }

  async function unsubscribe() {
    if (!subscription) return
    await removePushSubscription(subscription.endpoint)
    await subscription.unsubscribe()
    setSubscription(null)
  }

  return subscription ? (
    <button onClick={unsubscribe}>Turn off notifications</button>
  ) : (
    // 🔴 This must be a real click. Permission requested outside a gesture is refused.
    <button onClick={subscribe}>Turn on notifications</button>
  )
}
```

Three details are load-bearing.

**`userVisibleOnly: true`.** MDN states plainly that Chrome and Edge reject the promise if it is
not set to `true`. It is a promise that every push you send results in something the user can
see; there is no silent push on the open web.

**The user gesture.** MDN's guidance is that subscribing should happen in response to a user
action, and that browsers are moving to explicitly disallow notification permission requests
that are not. A `subscribe()` in a `useEffect` on page load is the single most common reason
push "does not work" — the browser refused before your code got a chance to be wrong.

**`JSON.parse(JSON.stringify(sub))`.** A `PushSubscription` is a host object with getters and a
`toJSON()`; it is not something React can serialise across the Server Action boundary. The
round trip produces the plain `{ endpoint, expirationTime, keys: { p256dh, auth } }` shape,
which is also exactly what the sending library wants later. The Next.js guide does the same
thing for the same reason.

## Gotchas

### `VAPID_PRIVATE_KEY` renamed to `NEXT_PUBLIC_VAPID_PRIVATE_KEY`
**Symptom.** Nothing — it works perfectly, and your application server identity is in every
JavaScript bundle you ship.
**Cause.** `NEXT_PUBLIC_` is the opt-in that inlines an environment variable into the client
build. Someone hit an "undefined env var" error in a Client Component and fixed it by adding the
prefix.
**Fix.** The private key is only ever read in server code. If a Client Component seems to need
it, the design is wrong — move the operation into a Server Action:

```ts
// server-only module: importing this from a Client Component is a build error
import 'server-only'

export const vapid = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  privateKey: process.env.VAPID_PRIVATE_KEY!,
}
```

### `subscribe()` called from a `useEffect` on mount
**Symptom.** The permission prompt never appears, or appears once and is permanently denied.
**Cause.** No user gesture. MDN's guidance is explicit that permission requests should follow a
user action and that browsers are tightening this. A denial is sticky — the user has to go into
site settings to undo it, which they will not.
**Fix.** Subscribe from a click handler on a button the user chose to press, as in the component
above. Ask at a moment where the value is obvious, not on first paint.

### `userVisibleOnly` omitted
**Symptom.** `subscribe()` rejects in Chrome and Edge.
**Cause.** MDN documents that those browsers require it to be `true`. There is no silent push.
**Fix.** Pass `userVisibleOnly: true`, and make sure the worker really does show a notification
for every message — see [10o](10o-push-in-the-service-worker.md).

### Passing the `PushSubscription` object straight to a Server Action
**Symptom.** A serialisation error, or a stored row whose `keys` are empty.
**Cause.** `PushSubscription` is a host object with accessors, not a plain object. What survives
a naive structured clone is not what you needed.
**Fix.** `JSON.parse(JSON.stringify(sub))` — its `toJSON()` produces exactly the
`{ endpoint, keys: { p256dh, auth } }` shape the sending library expects.

### Rotating VAPID keys and expecting existing subscriptions to keep working
**Symptom.** Every send starts failing after a key rotation.
**Cause.** The browser bound each subscription to the application server key it was given at
`subscribe()` time. A new keypair does not match.
**Fix.** Treat rotation as a re-subscribe event: keep the old private key long enough to drain,
and have the client compare the current public key with the one its existing subscription was
made with, unsubscribing and re-subscribing on a mismatch.

```ts
const existing = await registration.pushManager.getSubscription()
const currentKey = urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
const existingKey = existing?.options.applicationServerKey
if (existing && !bytesEqual(existingKey, currentKey)) {
  await removePushSubscription(existing.endpoint)
  await existing.unsubscribe()
}
```

## Interview questions

**★ What is a VAPID keypair, and which half goes to the browser?**
An ECDSA P-256 keypair identifying your application server to the push service. The **public**
key is passed as `applicationServerKey` at `subscribe()` time and is therefore public by
design; the **private** key stays on the server and signs the requests you later make to the
subscription endpoint. MDN flags the confusion that matters: it is not the key used to encrypt
the payload — that is a separate ECDH key derived from the subscription.

**★ Why must `subscribe()` run inside a click handler?**
Because permission is granted per user intent. MDN's guidance is that the request should follow
a user action, and that browsers are moving to disallow requests that are not. Worse, a denial
is sticky — recovering requires the user to change site settings — so an automatic prompt on
page load does not merely fail, it burns the only chance you had.

**Why is `userVisibleOnly: true` required?**
Chrome and Edge reject the subscription without it, per MDN. It is a commitment that every push
message results in a visible notification. Silent push — waking a worker to do background work
without telling the user — is not available on the open web, and the corollary is that your
`push` handler must always call `showNotification`.

**★ Why does the subscription need `JSON.parse(JSON.stringify(sub))` before a Server Action?**
`PushSubscription` is a host object with getters, not a plain object, so it does not survive the
Server Action serialisation boundary intact. Its `toJSON()` yields
`{ endpoint, expirationTime, keys: { p256dh, auth } }` — which is both serialisable and exactly
the shape the sending library needs, so the round trip is doing two jobs.

**★ What happens to existing subscriptions when you rotate VAPID keys?**
They stop working. Each subscription was created against the public key the browser was given
at the time, and the push service will not accept a signature from a different keypair. Rotation
is therefore a re-subscribe event: have the client compare its existing
`options.applicationServerKey` against the current one and re-subscribe on a mismatch, and keep
the old private key alive long enough to drain in-flight sends.

---

← [Cache budget and eviction](10k-service-worker-cache-budget-and-eviction.md) · [Chapter 12 overview](01-explanation.md) · Next → [Storing push subscriptions](10m-storing-push-subscriptions.md)
