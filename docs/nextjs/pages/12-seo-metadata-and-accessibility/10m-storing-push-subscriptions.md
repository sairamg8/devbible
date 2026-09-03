---
title: "The Next.js guide stores a push subscription in a module-level variable and tells you not to, and the schema you replace it with is keyed by endpoint rather than by user"
sidebar_label: "10m · Storing push subscriptions"
sidebar_position: 22
description: "Why module state fails on serverless, the endpoint-keyed upsert, one user with many devices, and why an unsubscribe Server Action must filter by the caller."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) (step 3, Server Actions)
> and MDN [`PushSubscription`](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription).
> Target: **Next.js 16.3.4**, App Router, **web-push 3.6.7**.
> Documentation-verified; **no sandbox run**.

**A push subscription is the only durable artefact in the whole feature. The keys are config,
the worker is code, the notification is transient — but the subscription is state you did not
create, cannot recreate, and cannot recover if you lose it, because it lives in the user's
browser profile and is only handed to you once.** That is why where you put it is a bigger
decision than any other part of push, and why the Next.js guide's deliberately minimal
in-memory example is the single most-copied mistake in this topic. This continues
[10l](10l-web-push-the-subscription-flow.md).

## Storing it: the guide's example is a demo, and says so

The PWA guide keeps the subscription in a module-level `let subscription` inside the actions
file and then tells you, in prose, that production wants a database — for persistence across
restarts and to handle more than one user. Take that seriously, because module state on a
serverless deployment is worse than merely non-durable: it is per-instance, so a subscription
written by one invocation is invisible to the next.

A subscription is naturally keyed by its **endpoint**, which is unique per browser-profile
per-origin, and a user can hold several — phone, laptop, work profile:

```ts title="app/actions/push.ts"
'use server'

import { db } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

export type StoredSubscription = {
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
}

export async function savePushSubscription(sub: StoredSubscription) {
  const userId = await getSessionUserId()
  if (!userId) throw new Error('Not signed in')

  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    // Re-subscribing on the same device must not create a second row, and must
    // re-point the row if the device now belongs to a different signed-in user.
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: {
      endpoint: sub.endpoint,
      userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  })
}

export async function removePushSubscription(endpoint: string) {
  const userId = await getSessionUserId()
  if (!userId) throw new Error('Not signed in')
  // Scope the delete to the caller: the endpoint alone is attacker-supplied input.
  await db.pushSubscription.deleteMany({ where: { endpoint, userId } })
}
```

The `deleteMany` with a `userId` filter is not defensive padding. A Server Action is a public
HTTP endpoint; an endpoint string arriving in its arguments is untrusted, and an unscoped delete
is an unsubscribe-anyone primitive. The general rule is in
[Server Actions for mutations](../10-forms-authentication-and-security-hardening/01-server-actions-for-mutations-with-useactionstate-and-useopti.md).


## A subscription can die without telling you

`PushSubscription.expirationTime` exists and is, in practice, `null` almost everywhere — it is
not the mechanism by which subscriptions end. They end because the push service decided to
expire one, because the user cleared site data, because the browser evicted the origin's
storage, or because the app was uninstalled. None of those events reaches your server.

You find out in exactly two places:

1. **At send time**, when the push service rejects the request for a subscription it no longer
   recognises. That is the reliable signal, and pruning on it is covered in
   [10n](10n-sending-push-from-the-server.md).
2. **In the worker**, via the `pushsubscriptionchange` event, which fires when a subscription is
   replaced by the browser. ⚠️ Support for it is uneven across engines and neither the Next.js
   guide nor MDN presents it as something you can depend on — treat it as an optimisation, not
   a mechanism, and never as your only path.

The consequence for the schema is that rows go stale silently, so give yourself a way to see it:

```ts title="app/actions/push.ts (excerpt)"
'use server'

import { db } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

// Called from the client whenever getSubscription() returns a live subscription,
// so a row that stops being touched is a row nobody is using any more.
export async function touchPushSubscription(endpoint: string) {
  const userId = await getSessionUserId()
  if (!userId) return
  await db.pushSubscription.updateMany({
    where: { endpoint, userId },
    data: { lastSeenAt: new Date() },
  })
}
```

A row not seen for a few months and never successfully delivered to is a row to delete. That is
housekeeping, not correctness — but an un-pruned table means every send fans out over endpoints
that will never respond, which costs you latency on every notification.


## Gotchas

### Storing the subscription in module state
**Symptom.** Push works in development and stops after any deploy, or works for exactly one
user.
**Cause.** The guide's `let subscription = null` is a single slot in one process. On a
serverless platform it is also per-instance, so the invocation that reads it is usually not the
one that wrote it.
**Fix.** Persist by endpoint, as above. The guide says this in prose; it is easy to copy the
code and miss the sentence.

### Keying subscriptions by user instead of by endpoint
**Symptom.** Turning notifications on for a laptop silently turns them off for a phone.
**Cause.** A one-row-per-user schema. One user legitimately has many subscriptions, and the
endpoint is the identity.
**Fix.** Unique index on `endpoint`, foreign key to the user — as in the `upsert` above. Fan out
over all of a user's rows when sending.

### An unscoped delete in the unsubscribe action
**Symptom.** A security finding: anyone can unsubscribe anyone.
**Cause.** A Server Action is a public endpoint, and the endpoint string in its arguments is
attacker-controlled input, not a capability.
**Fix.** Filter the delete by the authenticated user, as shown. Every Server Action re-checks
authorisation; being called from your own component proves nothing.


### A shared device changes hands and the old user keeps getting notifications
**Symptom.** Someone signs out, a colleague signs in on the same browser, and notifications for
the first account keep arriving.
**Cause.** The endpoint belongs to the *browser profile*, not the account. If sign-in does not
re-run the subscribe path, the existing row still carries the previous `userId`.
**Fix.** Re-point the row on every subscribe — that is what the `update: { userId, ... }` branch
of the upsert is for — and unsubscribe on sign-out rather than only on an explicit toggle:

```ts title="app/actions/auth.ts (excerpt)"
export async function signOut(endpoint?: string) {
  if (endpoint) await removePushSubscription(endpoint)
  await destroySession()
}
```

### Treating `expirationTime` as the expiry mechanism
**Symptom.** A cleanup job keyed on `expirationTime` deletes nothing, and the table fills with
dead endpoints.
**Cause.** `expirationTime` is `null` in practice; subscriptions end through events your server
never observes.
**Fix.** Prune on delivery failure at send time, and on a `lastSeenAt` staleness window as
above. Do not build the cleanup around a field that is always null.

## Interview questions

**What is wrong with the way the Next.js guide stores the subscription?**
Nothing, for a guide — and it says so in prose: production wants a database, for persistence
across restarts and for more than one user. The module-level `let` is a single slot in one
process, and on a serverless platform it is per-instance, so the invocation that reads it is
usually not the one that wrote it.

**How should the subscription table be keyed?**
By endpoint, with a foreign key to the user. The endpoint is unique per browser profile per
origin, and one user legitimately holds several — phone, laptop, a second browser. A
one-row-per-user schema means enabling notifications on a new device silently disables them on
the old one.

**Why does the unsubscribe Server Action filter by user ID when it already has the endpoint?**
Because a Server Action is a public HTTP endpoint and its arguments are untrusted. An unscoped
`delete where endpoint = ?` is an unsubscribe-anyone primitive for anyone who can guess or
observe an endpoint string. Authorisation is re-checked inside the action; being called from
your own component is not evidence of anything.

**★ How do you find out that a push subscription is dead?**
Not from `expirationTime`, which is `null` almost everywhere. The reliable signal is the push
service rejecting a send for an endpoint it no longer recognises, which is the moment to delete
the row. The worker's `pushsubscriptionchange` event covers the replacement case, but its
support across engines is uneven and neither the Next.js guide nor MDN presents it as
dependable — treat it as an optimisation on top of failure-driven pruning.

**Why does a stale subscriptions table cost you anything?**
Because a send fans out over every row for the user, and each dead endpoint is a request that
has to fail before the live ones are done. It is latency on every notification and, at scale,
a meaningful share of your outbound requests. Prune on delivery failure, and back that up with
a `lastSeenAt` timestamp the client refreshes whenever `getSubscription()` returns a live
subscription.

**A shared laptop changes hands and the previous user keeps getting notifications. What is
wrong?**
The subscription endpoint belongs to the browser profile, not the account, so the row still
carries the old `userId`. Two fixes together: re-point the row on every subscribe, which the
`update` branch of an endpoint-keyed upsert does for free, and unsubscribe as part of sign-out
rather than only when the user toggles notifications off.

---

← [10l · Web Push: the subscription flow](10l-web-push-the-subscription-flow.md) · [Chapter 12 overview](01-explanation.md) · Next → [10n · Sending push from the server](10n-sending-push-from-the-server.md)
