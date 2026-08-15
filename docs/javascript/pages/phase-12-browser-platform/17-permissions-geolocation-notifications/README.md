---
title: "17 · Permissions, Geolocation and Notifications"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Permissions API](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API), [`PermissionStatus`](https://developer.mozilla.org/en-US/docs/Web/API/PermissionStatus), [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [`GeolocationPositionError`](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError), [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API), [`ServiceWorkerRegistration.showNotification()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification). Documentation-validated; **no timings and no console output**.

The syllabus row is *the permission model, and asking at the right moment* — and the second half is
the one that decides whether the feature works. The APIs here are small; the design around them is
not.

🔴 **A refusal is permanent from your side.** `Permissions.revoke()` was removed from browsers, a
denied prompt cannot be re-raised from script, and only the user can undo it in site settings. So
the moment you choose to ask is the whole game: ask in context, ask once, and always ship the path
that works when the answer is no.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The permission model](./01-the-permission-model.md)** | `granted` / `denied` / `prompt`, and why **`query()` never prompts**; permission as **state to watch** via the `change` event; the queryable-name list and why it needs a `try`; the pre-prompt pattern that protects your one shot; one prompt at a time, ask for the least, always ship the refused path; activation, secure contexts and iframe delegation |
| 02 | **[Geolocation](./02-geolocation.md)** | The callback API and its defaults — 🔴 **`timeout: Infinity`**, `maximumAge: 0`, `enableHighAccuracy` and battery; `accuracy` as a **radius, not metadata**; `watchPosition`/`clearWatch` and pausing when hidden; the three error codes and what each deserves; the promise wrapper; when a server-side coarse location is the right answer instead; collecting coarse and storing less |
| 03 | **[Notifications](./03-notifications.md)** | `'default'` means denied; requesting only from a gesture; 🔴 **`new Notification()` throws a `TypeError` on most mobile browsers** — persistent notifications via the service worker are the architecture; `tag`, `renotify`, `requireInteraction`, `data`; a correct `notificationclick` handler (close, `waitUntil`, focus an existing client); where Push fits; deciding whether to notify at all |

## Three facts worth carrying out of this topic

- **`query()` reports; the API prompts.** That separation is what lets you check the state first
  and ask at a moment the user will say yes to.
- **`timeout` defaults to `Infinity`** in Geolocation — the bug that never reproduces in
  development.
- **Notifications are a service worker feature**, because the page-level constructor throws on most
  mobile browsers.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [12 · Feature detection and progressive enhancement](../12-feature-detection/README.md) — a
  permission-gated feature is an enhancement by definition; the refused path is the real path
- [16 · Clipboard, Web Share and File System Access](../16-clipboard-share-files/README.md) — the
  same gesture-is-the-permission rule, with no prompt attached
- [13 · What belongs on the server instead](../13-what-belongs-on-the-server/README.md) — the
  `Permissions-Policy` header, and why a coarse location often belongs there
- [07 · Web Workers](../07-web-workers/README.md) — the worker world the service worker lives in

---

Start → [01 · The permission model](./01-the-permission-model.md)
