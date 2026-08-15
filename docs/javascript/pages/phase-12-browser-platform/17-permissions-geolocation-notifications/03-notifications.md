---
title: "03 · Notifications"
sidebar_label: "03 · Notifications"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API), [`Notification.requestPermission()`](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static), [`Notification`](https://developer.mozilla.org/en-US/docs/Web/API/Notification), [`ServiceWorkerRegistration.showNotification()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification), [`Clients.matchAll()`](https://developer.mozilla.org/en-US/docs/Web/API/Clients/matchAll), [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API). Documentation-validated; **no timings and no console output**. ⚠️ MDN marks the Notifications API **limited availability — not Baseline** — feature-detect and read the compatibility table.

A notification is the only thing in this phase that can interrupt someone who is not looking at your
site. That is what makes it valuable and what makes it the permission users refuse most.

## The permission, and the one rule

```js
if (!('Notification' in window)) return;              // 🔴 feature-detect first

enableBtn.addEventListener('click', async () => {     // 🔴 and always from a gesture
  const permission = await Notification.requestPermission();
  if (permission === 'granted') subscribe();
  else keepUsingTheInbox();
});
```

`Notification.permission` is `'granted'`, `'denied'` or **`'default'`** — and `'default'` means
undecided, which MDN says is **treated as denied**. `requestPermission()` returns a promise, is
secure-context only, and MDN is explicit that *"browser security policies prevent permission
requests on page load"*: it must come from user interaction.

Everything in [01 · The permission model](./01-the-permission-model.md) applies here more than
anywhere else, because notification prompts are the ones users have been trained to reject on
sight. Ask when the user has just said *"tell me when this ships"*, never on arrival.

## 🔴 Two kinds of notification, and one of them breaks on mobile

| | Non-persistent | Persistent |
|---|---|---|
| Created with | `new Notification(title, options)` | `registration.showNotification(title, options)` |
| Lifetime | tied to the page | outlives the page |
| Events on | the `Notification` instance (`click`, `close`, `show`, `error`) | the service worker (`notificationclick`, `notificationclose`) |
| Mobile | ⛔ **throws `TypeError` on most mobile browsers** | ✅ the one that works |

🔴 **MDN's own note is unambiguous: if your code needs to run on mobile devices you must use
persistent notifications**, because the `Notification()` constructor throws a `TypeError` on most
mobile browsers. This is the single fact that decides the architecture — a notification feature is
a **service worker** feature, not a page feature.

```js
const registration = await navigator.serviceWorker.ready;
await registration.showNotification('Order shipped', {
  body: 'Arriving Thursday',
  icon: '/icons/parcel.png',
  tag: 'order-1234',          // 🔴 replaces the previous one with this tag
  data: { url: '/orders/1234' },
});
```

## The options that change behaviour

| Option | Effect |
|---|---|
| `tag` | a notification with the same tag **replaces** the earlier one — the cure for five stacked "new message" popups |
| `renotify` | re-alerts when a tagged notification is replaced; without it the replacement is silent |
| `requireInteraction` | stays on screen until the user acts — use sparingly, it is an interruption that will not go away |
| `silent` | shown without sound |
| `data` | arbitrary structured data that comes back in the click handler — this is where the target URL belongs |
| `body`, `icon` | the content |

⚠️ **The presentation is the operating system's, not yours.** Length, position, grouping, whether it
appears at all — all decided outside the page. Write the title so it works truncated, and never
depend on the notification actually being seen.

## Handling the click properly

```js
// in the service worker
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = all.find((c) => c.url.includes('/orders/'));
    if (existing) return existing.focus();               // 🔴 focus, do not open a duplicate
    return clients.openWindow(event.notification.data.url);
  })());
});
```

Three things this gets right, and each is a common bug when missed: **closing the notification**
(it does not close itself), **`event.waitUntil`** (without it the worker may be stopped before the
async work finishes), and **focusing an existing tab** instead of opening the user's fourth copy of
your app.

## Where Push fits

Notifications and Push are two halves of one feature and are constantly confused:

- **Notifications** display something. The page or the service worker can do it locally — a timer
  finishing, a long export completing.
- **Push** delivers a message from your server to the service worker when the site is not open.
  `registration.pushManager.subscribe()` produces a subscription your server stores and pushes to;
  the worker's `push` event handler then calls `showNotification`.

⚠️ **Push subscriptions are per browser, per device, and they expire or get revoked.** The server
needs to handle a dead subscription by deleting it, and the client needs to re-subscribe rather than
assuming an old subscription still works.

## Deciding whether to notify at all

```
Is the user looking at the page right now?  (document.visibilityState === 'visible')
├─ yes → 🔴 update the UI. A system notification for something on screen is noise.
└─ no  → is this worth interrupting them for, at this hour, on their phone?
         ├─ no  → an in-app inbox, a badge, an email
         └─ yes → one notification, tagged, with a useful click target
```

🔴 **The permission is the cheap part; the trust is not.** Every notification that was not worth the
interruption raises the odds of the user turning them off for good — and unlike a `denied`
permission, that decision is invisible to you. Send fewer than you are allowed to.

## Gotchas

**Symptom: `TypeError` from `new Notification()` on a phone.**
Cause — non-persistent notifications are not supported on most mobile browsers.
Fix — `registration.showNotification()` via the service worker.

**Symptom: the prompt never appears.**
Cause — requested on page load rather than from a gesture; browsers block that.
Fix — request inside a click, in context.

**Symptom: five notifications stack up for the same conversation.**
Cause — no `tag`.
Fix — tag by subject so each new one replaces the last.

**Symptom: clicking the notification opens a new tab every time.**
Cause — `clients.openWindow` without checking for an existing client.
Fix — `clients.matchAll` first, then `focus()`.

**Symptom: the click handler's async work never finishes.**
Cause — no `event.waitUntil`; the service worker was allowed to stop.
Fix — wrap the promise in `waitUntil`.

**Symptom: notifications fire while the user is staring at the page.**
Cause — no visibility check.
Fix — branch on `document.visibilityState` and update the UI instead.

**Symptom: pushes stop arriving for some users and no error is seen.**
Cause — expired or revoked subscriptions.
Fix — handle subscription changes, prune dead subscriptions server-side, re-subscribe on the client.

## Interview questions

**★ Why must a notification feature be built on a service worker?**
Because the `Notification()` constructor throws a `TypeError` on most mobile browsers — persistent
notifications via `ServiceWorkerRegistration.showNotification()` are the only ones that work there,
and they are also the only ones that outlive the page.

**★ What does `Notification.permission === 'default'` mean?**
Undecided — and it is treated as denied. Nothing will show until the user grants permission, which
you may request only from a user gesture.

**★ What does `tag` do?**
Replaces an existing notification carrying the same tag, so repeated updates about one thing collapse
into one. `renotify` decides whether the replacement alerts again.

**★ What are the two mistakes in a naive `notificationclick` handler?**
Not closing the notification, and opening a new window without checking `clients.matchAll()` for a
tab that is already open. A third is omitting `event.waitUntil`, which lets the worker stop
mid-handler.

**★ How do Notifications and Push differ?**
Notifications display; Push delivers. Push wakes the service worker with a message from your server,
and the worker then shows a notification. You can notify without Push, but not push without a
service worker.

---

← [02 · Geolocation](./02-geolocation.md) · [Topic index](./README.md)
