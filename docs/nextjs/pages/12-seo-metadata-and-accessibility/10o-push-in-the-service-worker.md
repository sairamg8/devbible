---
title: "The service worker is the only place a push message can become something a user sees, and both of its handlers have a default that is wrong for an installed app"
sidebar_label: "10o · Push in the service worker"
sidebar_position: 21
description: "The push handler and the userVisibleOnly promise, icon versus badge, tag as a collapse key, focusing an existing client on notificationclick, and testing over HTTPS."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) (steps 5 and 7) and the
> [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**.

**Delivery ends at the service worker. The push service hands it an encrypted payload, wakes it
for a `push` event, and everything after that is code you wrote in a file the framework knows
nothing about — including the part where the browser holds you to the promise you made at
subscribe time.** Both handlers in the Next.js guide are correct as a demonstration and wrong
as a default: the `push` handler assumes a payload it can parse, and the `notificationclick`
handler opens a new window every time. This follows
[10n](10n-sending-push-from-the-server.md), which covers the send.

## The worker: `push`

The `push` event wakes the worker. Because `userVisibleOnly: true` was a promise, the handler
must always end in a notification:

```js title="public/sw.js (excerpt)"
self.addEventListener('push', (event) => {
  // Defensive: a push with no payload is legal, and some services send one.
  let payload = { title: 'SprintDesk', body: 'You have an update.', url: '/' }
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch {
      payload = { ...payload, body: event.data.text() }
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      // Replaces an existing notification with the same tag instead of stacking.
      tag: payload.url,
      renotify: false,
      data: { url: payload.url },
    })
  )
})
```

`icon` is the image shown in the notification; `badge` is the monochrome glyph some platforms
put in the status bar, and it is a separate asset — supplying only `icon` gives you a generic
dot. `tag` is the collapse key: without it, ten updates to the same ticket are ten
notifications.

## The worker: `notificationclick`

The Next.js guide's handler calls `clients.openWindow(...)` unconditionally. That is the right
shape for a guide and the wrong shape for an installed app, because it opens a *second* window
next to the one the user already had. Focus first, open only as a fallback:

```js title="public/sw.js (excerpt)"
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin)

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        // Required to see windows this worker is not currently controlling.
        includeUncontrolled: true,
      })

      for (const client of clientList) {
        if (new URL(client.url).origin !== target.origin) continue
        await client.focus()
        // Navigate the focused window rather than opening a new one.
        if ('navigate' in client) await client.navigate(target.href)
        return
      }

      await self.clients.openWindow(target.href)
    })()
  )
})
```

`includeUncontrolled: true` is the line people omit. Without it `matchAll` only returns clients
this worker controls — which, right after an update or on a force-refreshed tab, may be none —
and every click opens a new window.

## Testing it locally

Push requires a secure context, and so does the service worker that receives it. The Next.js
guide's instruction is to run the dev server over TLS:

```bash title="Terminal"
next dev --experimental-https
```

The CLI reference is explicit that this creates a locally trusted certificate with `mkcert` and
is intended for development only; production uses properly issued certificates. Beyond the
certificate, the guide's checklist is worth following literally: accept the permission prompt,
confirm notifications are not disabled globally at the OS or browser level, and try a second
browser before concluding your code is wrong. There is no way to observe a push failing to be
displayed — the browser simply does not show it — so eliminating the environment first saves
hours.


## Gotchas

### A `push` handler that does not show a notification
**Symptom.** In Chrome, a "This site has been updated in the background" notification the
browser generated itself.
**Cause.** You promised `userVisibleOnly: true` and then handled a push without calling
`showNotification` — because the payload failed to parse, or a code path returned early.
**Fix.** Always end in a `showNotification`, with a defensible default payload, as in the
handler above. Never let a parse failure become a silent return.

### Missing `event.waitUntil` around `showNotification`
**Symptom.** Notifications appear intermittently, more often on slow devices.
**Cause.** The worker may be terminated as soon as the handler returns; `showNotification`
returns a promise.
**Fix.** Wrap it in `event.waitUntil(...)`. The same rule applies to the whole
`notificationclick` body.

### `notificationclick` opens a new window every time
**Symptom.** Five clicks, five windows of your app.
**Cause.** `clients.openWindow()` called unconditionally, or `matchAll` used without
`includeUncontrolled: true` so no existing client was ever found.
**Fix.** Enumerate clients with `includeUncontrolled: true`, focus and navigate an existing
one, and fall back to `openWindow` only when there genuinely is none.

### `badge` omitted
**Symptom.** A generic dot in the Android status bar instead of your mark.
**Cause.** `icon` and `badge` are different assets — the badge is a small monochrome glyph with
transparency.
**Fix.** Ship a dedicated badge PNG and reference it, as above. It is the cheapest polish
available in this feature.


## Interview questions

**★ Why must the `push` handler always call `showNotification()`?**
Because `userVisibleOnly: true` was a commitment made at subscribe time — Chrome and Edge
require it, and it says every message will be visible. If your handler returns without showing
anything, Chrome shows its own "This site has been updated in the background" notification
instead, which is worse than either alternative. Give the handler a default payload so a parse
failure still results in something sensible.

**★ Why does clicking a notification open a second window, and how do you fix it?**
Because `clients.openWindow()` was called unconditionally, or because `matchAll()` was called
without `includeUncontrolled: true` and therefore did not see the window that already existed —
a worker only sees clients it controls by default, and after an update it may control none. The
fix is to enumerate with `includeUncontrolled: true`, `focus()` the first same-origin client and
`navigate()` it, falling back to `openWindow` only when the list is empty.

**What is the difference between `icon` and `badge` on a notification?**
`icon` is the full-colour image shown in the notification body. `badge` is a small monochrome
glyph some platforms — Android most visibly — put in the status bar, and it needs to be its own
asset with transparency. Supplying only `icon` leaves you with the platform's generic mark.

**Why do you need `--experimental-https` in development?**
Service workers and Push both require a secure context, and `localhost` over plain HTTP will not
get you a realistic environment for the certificate-sensitive parts. The CLI generates a locally
trusted `mkcert` certificate and serves at `https://localhost:3000`; the docs state clearly that
this is development-only and production needs properly issued certificates.

---

← [10n · Sending push from the server](10n-sending-push-from-the-server.md) · [Chapter 12 overview](01-explanation.md) · Next → [10p · iOS and Safari limits](10p-ios-and-safari-limits.md)
