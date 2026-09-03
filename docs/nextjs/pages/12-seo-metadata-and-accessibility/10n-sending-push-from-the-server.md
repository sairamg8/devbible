---
title: "Sending a push message is a signed request to a URL you do not own, and a 404 from it is not an error to log but a row to delete"
sidebar_label: "10n · Sending push from the server"
sidebar_position: 20
description: "web-push, setVapidDetails, fanning out with allSettled, statusCode-driven pruning, and which failures must never delete a subscription."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps),
> the [web-push README](https://github.com/web-push-libs/web-push),
> [RFC 8030 §7.3](https://www.rfc-editor.org/rfc/rfc8030.txt), and the
> [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next).
> Target: **Next.js 16.3.4**, App Router, **web-push 3.6.7** (registry.npmjs.org, 2026-09-03).
> Documentation-verified; **no sandbox run**.

**Once a subscription is stored, sending is a `POST` to a URL on someone else's infrastructure,
signed with your VAPID private key and encrypted to keys that came with the subscription. You
do not get delivery confirmation, you do not get read receipts, and the most important response
you will ever handle is the one that tells you a subscription is gone.** RFC 8030 makes that
response normative:

> *"A push service MUST return a 404 (Not Found) status code"*

— when an application server sends to an expired subscription. Treating that as a logged error
rather than a delete is how a subscriptions table becomes 90% dead rows. This continues
[10m](10m-storing-push-subscriptions.md); the display half — what the service worker does with a
delivered message — is [10o](10o-push-in-the-service-worker.md).

## Sending, with `web-push`

`web-push` handles the two things you should not hand-roll: the VAPID JWT and the aes128gcm
payload encryption. Configure it once, at module scope in a server-only module:

```ts title="lib/push.ts"
import 'server-only'
import webpush from 'web-push'

webpush.setVapidDetails(
  // A mailto: or https: URL the push service can use to contact you about abuse.
  'mailto:ops@sprintdesk.example',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export { webpush }
```

Then a send that treats a dead endpoint as data, not as a failure:

```ts title="app/actions/notify.ts"
'use server'

import { webpush } from '@/lib/push'
import { db } from '@/lib/db'

type Payload = { title: string; body: string; url: string }

export async function notifyUser(userId: string, payload: Payload) {
  const subscriptions = await db.pushSubscription.findMany({ where: { userId } })

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify(payload)
      )
    )
  )

  const gone: string[] = []
  results.forEach((result, index) => {
    if (result.status !== 'rejected') return
    // The README documents statusCode/headers/body on both resolve and reject.
    const status = (result.reason as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) gone.push(subscriptions[index].endpoint)
  })

  if (gone.length > 0) {
    await db.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } })
  }

  return { sent: results.length - gone.length, pruned: gone.length }
}
```

Three decisions worth naming. `Promise.allSettled` rather than `Promise.all`, because one dead
device must not prevent delivery to a live one. `statusCode` read off the rejection, which the
web-push README documents as being present alongside `headers` and `body` on both the resolve
and reject paths. And **404 and 410 both pruned** — RFC 8030 makes 404 the normative answer for
an expired subscription on the application-server send path, and 410 appears in the same family
of "this endpoint is finished" responses; deleting on either is safe, because a subscription you
delete in error will be recreated the next time the user's browser subscribes.

⚠️ Every other status is *not* a signal to delete. A 429 is rate limiting, a 5xx is the push
service having a bad day, and a 400 usually means your payload or headers are wrong — deleting
the row on any of those destroys a working subscription because of a bug on your side.

## Gotchas

### Deleting the subscription on any send failure
**Symptom.** Notifications stop working for a cohort of users after a push service outage.
**Cause.** A `catch` that treats every rejection as "endpoint is gone". A 429 or a 503 is the
push service, not the subscription.
**Fix.** Branch on `statusCode` and prune only on 404 and 410, as in `notifyUser` above.
Everything else is retried or logged, never deleted.

### `Promise.all` over a user's subscriptions
**Symptom.** A user with an old, dead device stops receiving notifications on their current
one.
**Cause.** `Promise.all` rejects on the first failure and abandons the rest.
**Fix.** `Promise.allSettled`, and index back into the subscription array to attribute each
result — as above.

### `setVapidDetails` called per request
**Symptom.** Nothing visible; wasted work on every send, and a scattering of places where the
contact address can drift.
**Cause.** The call was put inside the action rather than at module scope.
**Fix.** Configure once in a `server-only` module and import it, as in `lib/push.ts`.

### Payload size assumed unlimited
**Symptom.** Sends fail for messages containing a long body or embedded data.
**Cause.** Push payloads are encrypted and size-limited by the push service. The exact limit is
service-specific and is not something the Next.js docs state.
**Fix.** Send an identifier and a short human-readable string; have the worker fetch details
when the notification is clicked, or when the app is focused. Keep the payload to a title, a
body and a URL — the shape used above — and you never meet the limit.

## Interview questions

**★ What do you do when a push send returns 404?**
Delete the subscription. RFC 8030 makes it normative that a push service returns 404 when an
application server sends to an expired subscription, so it is not a transient error — the
endpoint will never work again. 410 is treated the same way. Deleting is safe even if you are
wrong, because the browser recreates a subscription the next time the user opts in.

**Which send failures must you *not* prune on?**
Everything else: 429 (rate limiting), 5xx (the push service is unhealthy), 400 (your request is
malformed). Pruning on those deletes working subscriptions because of a problem on your side or
a temporary one on theirs, and the user has no way to notice or recover except by toggling
notifications off and on.

**Why `Promise.allSettled` rather than `Promise.all` when fanning out?**
Because a user's subscriptions are independent devices. `Promise.all` rejects on the first
failure and abandons the remaining sends, so one stale endpoint from a phone the user replaced
silences their current laptop. `allSettled` also gives you the per-index results you need to
attribute a 404 back to the right row.

**How large can a push payload be?**
Smaller than you want, and service-specific — the limit is not something the Next.js docs state,
so do not design against a number. Send an identifier, a title and a short body, and fetch the
rest when the user acts on the notification. That also keeps sensitive content off a third
party's infrastructure, since the payload transits the push service even though it is encrypted
to the subscription's keys.

---

← [10m · Storing push subscriptions](10m-storing-push-subscriptions.md) · [Chapter 12 overview](01-explanation.md) · Next → [10o · Push in the service worker](10o-push-in-the-service-worker.md)
