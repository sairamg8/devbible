---
title: "An offline Server Action resolves later instead of rejecting now, which leaves a button that looks frozen"
sidebar_label: "12b · Offline actions and testing"
sidebar_position: 15
description: "Retrying Server Actions with no client code, the queued-navigation surprise, and why offline behaviour must be tested against a production build."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [Handling connectivity drops guide](https://nextjs.org/docs/app/guides/offline-support).
> Target: **Next.js 16.3.4**, App Router.
> 🔴 **`experimental.useOffline` is experimental and not recommended for production.**

**Without the flag, a Server Action called with no network rejects, and your form has to catch
the rejection and decide what to do — show an error, retry, or queue it somewhere. With the
flag, that failure never reaches your code at all.** The call stays pending until the
connection returns, the request runs again, and the awaited promise resolves with the server's
response. The code you delete is a try/catch, a retry loop and a reconnection handler. What
you gain in exchange is a new UI problem: a submit button that is disabled and pending for an
indefinite period, with nothing on screen explaining why.

## The action retries itself

```ts filename="app/ping/actions.ts"
'use server'

export async function ping(): Promise<string> {
  return new Date().toISOString()
}
```

```tsx filename="app/ping/ping-form.tsx"
'use client'

import { useState, useTransition } from 'react'
import { useOffline } from 'next/offline'
import { ping } from './actions'

export function PingForm() {
  const [pongs, setPongs] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const isOffline = useOffline()

  function handleSubmit() {
    startTransition(async () => {
      const pong = await ping()
      setPongs((prev) => [pong, ...prev])
    })
  }

  const label = pending
    ? isOffline ? 'Pinging (offline, will retry)...' : 'Pinging...'
    : 'Ping'

  return (
    <form action={handleSubmit}>
      <button type="submit" disabled={pending}>{label}</button>
      <ul>{pongs.map((t) => <li key={t}>{t}</li>)}</ul>
    </form>
  )
}
```

Click **Ping** while offline: the button disables and reads "Pinging (offline, will retry)…".
Restore connectivity and the awaited `ping()` resolves, the timestamp appends, and the label
reverts. **No second click, no client-side retry code.**

The pattern is `useTransition` for *whether* something is in flight and `useOffline` for *why
it is taking so long*. Neither answers the other's question.

## The queued-navigation surprise

⚠️ **While offline, clicking a link during a pending Server Action may appear to do nothing.**
The link's navigation also needs the network and queues behind the same connectivity signal as
the action. Both resolve when the connection returns.

Mechanically this is correct — nothing is lost, and both complete. Experientially it is the
worst case the feature produces: the user has pressed a button, then pressed a link, and the
application has responded to neither. This is the strongest argument for the root-layout
banner from [chunk 12](12-network-resilience-and-useoffline.md): it is the only element on
screen that explains why two unrelated interactions both went quiet.

## Testing

🔴 **Test with `next build && next start`. Dev mode is not a reliable reference for offline
behaviour.**

The reason is specific rather than general flakiness: **Next.js disables prefetching in
development**, and the prefetched App Shell is the thing that renders while offline. In dev
there is no shell to render, so the feature looks broken.

| How | Where |
|---|---|
| Chrome | DevTools → Network → **Offline** |
| Firefox | Network Monitor → throttling menu |
| Real-world | Airplane mode, disconnect WiFi, unplug the cable |

The real-world test is worth doing at least once. A DevTools offline toggle is a clean binary;
an actual flaky connection produces partial failures and reconnections that the toggle never
generates.

## Gotchas

### A frozen-looking link during a pending action

**Symptom.** The user clicks a link while an action is pending offline and nothing happens.

**Cause.** The navigation queues behind the same connectivity signal as the action.

**Fix.** Nothing to fix mechanically — both resolve on reconnect. Communicate it: this is the
case the app-wide banner exists for.

### Testing offline behaviour in dev mode

**Symptom.** Offline navigation looks completely broken locally and works in production.

**Cause.** Prefetching is disabled in development, so there is no App Shell to render offline.

**Fix.** `next build && next start`. Treat any offline finding from `next dev` as unreliable.

### Keeping the try/catch around the action

**Symptom.** Dead code that never runs, and a false sense that failures are handled.

**Cause.** With the flag enabled the rejection never happens, so the catch block is
unreachable for network failures.

**Fix.** Remove the network-failure branch — but keep handling for errors the *server* returns,
which are unaffected by this flag and still need modelling as return values.

### A pending button with no explanation

**Symptom.** Users double-click, navigate away, or report the app as broken.

**Cause.** `pending` alone cannot distinguish a slow server from no network, so the label says
the same thing in both cases.

**Fix.** Branch the label on `useOffline()`, as above.

### Assuming the action is queued durably

**Symptom.** A closed tab or a reloaded page loses the pending mutation.

**Cause.** The pending call lives in the page's runtime. This is in-memory retry across a
connectivity gap, not a durable outbox.

**Fix.** If a mutation must survive a reload or a closed tab, that needs real queueing —
persist the intent yourself, or use a background job. Do not read this feature as offline-first
write support.

### Shipping it to production

**Symptom.** Behaviour changes on a framework upgrade.

**Cause.** `experimental.useOffline` is experimental and explicitly not recommended for
production.

**Fix.** Treat it as a preview. The transferable part today is the *pattern* — an offline-aware
fallback plus a banner — which you can build against your own detection if you need it now.

## Interview questions

**★ What happens to a Server Action called with no network, with the flag enabled?**
It does not reject. The call stays pending, retries when the connection returns, and the
awaited promise resolves with the server's response.

**★ What code does that let you delete?**
The try/catch around the network failure, the retry loop, and any reconnection handler in the
component.

**★ What UI problem does it create?**
A disabled, pending button for an indefinite period with nothing explaining why.

**★ How do you solve that?**
`useTransition` for whether something is in flight, `useOffline()` for why it is slow, and
branch the label on both.

**★ What happens if the user clicks a link while an action is pending offline?**
The navigation queues behind the same connectivity signal; both resolve on reconnect. It looks
like a frozen UI, which is why an app-wide banner is recommended.

**★ Why must offline behaviour be tested against a production build?**
Prefetching is disabled in development, and the prefetched App Shell is what renders offline.
In dev there is no shell, so the feature appears broken.

**★ How do you simulate offline?**
Chrome DevTools → Network → Offline, Firefox's Network Monitor throttling, or genuinely toggle
airplane mode. The real-world test surfaces partial failures a clean toggle never produces.

**★ Is a pending action durable across a page reload?**
No. It lives in the page's runtime. Anything that must survive a reload or a closed tab needs
real queueing — this is not offline-first write support.

**★ Does the flag change how server-returned errors are handled?**
No. It covers network failures. Errors the server returns still need modelling as return
values, typically through `useActionState`.

---

**Previous:** [12 · Network resilience and `useOffline`](12-network-resilience-and-useoffline.md)
