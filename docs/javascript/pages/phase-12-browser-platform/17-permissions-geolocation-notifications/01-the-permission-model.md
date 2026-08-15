---
title: "01 · The permission model"
sidebar_label: "01 · The permission model"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Permissions API](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API), [`Permissions.query()`](https://developer.mozilla.org/en-US/docs/Web/API/Permissions/query), [`PermissionStatus`](https://developer.mozilla.org/en-US/docs/Web/API/PermissionStatus), [`Permissions-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy), [Transient activation](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation). Documentation-validated; **no timings and no console output**.

Every powerful API in this phase ends at the same gate: the user has to say yes. The APIs differ,
the gate does not — and **the single most consequential thing your code does with a permission is
decide when to ask for it.**

## Three states, and only one of them is yours to change

```js
const status = await navigator.permissions.query({ name: 'geolocation' });
status.state;    // 'granted' | 'denied' | 'prompt'
```

| State | Meaning | What you can do |
|---|---|---|
| `'granted'` | already allowed | use the API |
| `'prompt'` | not decided yet | 🔴 **this is your one shot** — ask at a moment that makes sense |
| `'denied'` | refused, or blocked by policy | build the page as if the feature does not exist |

🔴 **`query()` never prompts.** It reports; the prompt is raised by calling the real API —
`getCurrentPosition()`, `Notification.requestPermission()`, `getUserMedia()`. That separation is
what makes a well-behaved permission flow possible: you can *look* before you leap.

⚠️ **`denied` is effectively permanent from your side.** The proposed `Permissions.revoke()` was
removed from browsers, and a denial is not re-promptable — only the user can undo it in site
settings. A refused permission is a state you design a page for, not a decision to re-litigate.

⚠️ **A `Permissions-Policy` restriction reports `denied` too**, so "denied" does not always mean the
user said no — it can mean the embedding page never allowed the feature into the frame at all
([13 · What belongs on the server](../13-what-belongs-on-the-server/README.md) owns the header side).

## Permission is state — watch it, never cache it

```js
const status = await navigator.permissions.query({ name: 'geolocation' });
render(status.state);
status.addEventListener('change', () => render(status.state));   // 🔴 users change their minds
```

A user can revoke a permission in site settings without reloading your page. The `change` event on
the `PermissionStatus` is how the UI keeps up — the same "watched, never sampled" rule as
`prefers-reduced-motion` and `navigator.onLine`
([12 · Feature detection](../12-feature-detection/README.md)).

⚠️ **Keep a reference to the `PermissionStatus`.** The listener lives on that object; drop it on the
floor and there is nothing to fire.

## Not every name is queryable everywhere

`navigator.permissions.query()` accepts a growing list — `geolocation`, `camera`, `microphone`,
`notifications`, `push`, `midi`, `bluetooth`, `clipboard-read`, `clipboard-write`,
`persistent-storage`, `storage-access`, `screen-wake-lock`, `display-capture`, `local-fonts`,
`window-management` and more — but **support for individual names varies**, and an unsupported name
is not a safe call. Wrap it:

```js
async function permissionState(name) {
  try {
    return (await navigator.permissions?.query({ name }))?.state ?? 'unknown';
  } catch {
    return 'unknown';                    // 🔴 unsupported name, or no Permissions API
  }
}
```

`'unknown'` is a perfectly good fourth state: it means *ask the feature itself*. A capability
module that returns it keeps every caller from repeating this `try`.

## Asking at the right moment

This is the part that is design, not API. The rule that covers almost every case:

🔴 **Ask when the user has just asked you for the thing the permission is for.** Not on load, not
in a `useEffect`, not "while we're here". A prompt with no context is refused, and a refusal is
forever.

```js
// ⛔ on page load — the classic, and the reason browsers now suppress these
Notification.requestPermission();

// ✅ attached to the intent
notifyMeBtn.addEventListener('click', async () => {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') subscribeToUpdates();
  else showInPageAlternative();
});
```

**The pre-prompt (or "priming") pattern** protects the one shot you get:

1. The user clicks *"Notify me when this ships"*.
2. Your own UI explains what you will send and offers **Not now** / **Enable**.
3. Only **Enable** triggers the real browser prompt.

*Not now* costs you nothing — the state stays `'prompt'` and you can ask again next week. The real
prompt refused costs you the feature permanently. That asymmetry is the entire argument for the
extra step.

Three more rules that follow from it:

- **One prompt at a time.** Location *and* notifications *and* the camera on first load is the
  pattern browsers built prompt-suppression heuristics to fight.
- **Ask for the least.** Every permission you do not need is a prompt you do not have to survive.
- **Always ship the refused path.** Manual location entry, an in-page inbox, an upload button. If
  the feature simply breaks when denied, the feature was never optional — which means it should not
  have been a permission-gated enhancement in the first place.

## Activation, secure contexts and iframes

Every API in this topic is **secure-context only**, and the ones that prompt want **transient
activation** — a real, recent gesture. Two consequences worth internalising:

- A permission request in a `setTimeout`, a `fetch().then()`, or on `DOMContentLoaded` is either
  rejected or silently suppressed.
- In an iframe, the **embedder** decides: without the right `allow` attribute or
  `Permissions-Policy`, the feature is `denied` before the user is ever asked.

## Gotchas

**Symptom: `query()` returns `granted` but the API still fails.**
Cause — a permission is necessary, not sufficient: no hardware, an OS-level block, or an insecure
context.
Fix — handle the API's own errors as well as the permission state.

**Symptom: the prompt never appears.**
Cause — asked without a user gesture, or the browser suppressed it after earlier dismissals.
Fix — request from a click, once, in context.

**Symptom: users complain the feature is broken, and the state is `denied`.**
Cause — a denial cannot be re-prompted from script; `revoke()` no longer exists.
Fix — explain how to re-enable it in site settings, and keep the non-permission path working.

**Symptom: the permission changes in settings and the UI keeps showing the old state.**
Cause — the state was read once and cached.
Fix — hold the `PermissionStatus` and listen for `change`.

**Symptom: `query()` throws for a name that works in another browser.**
Cause — the queryable names differ.
Fix — wrap it and fall back to feature-testing the API itself.

**Symptom: everything is `denied` inside a third-party iframe.**
Cause — permissions policy; the embedder never delegated the feature.
Fix — the embedding page must `allow` it; this cannot be fixed from inside the frame.

## Interview questions

**★ What are the three permission states, and which is the important one?**
`granted`, `denied`, `prompt`. `prompt` is the one that matters — it is the only moment your
decision about *when* to ask still counts, because a denial cannot be re-prompted.

**★ Does `navigator.permissions.query()` show a prompt?**
No. It reports the current state without prompting; the real API call is what prompts. That is
exactly what lets you check first and ask at a sensible moment.

**★ Why is asking on page load a bug rather than a style choice?**
Because a refusal is permanent from the page's side, and a prompt with no context gets refused.
Browsers also suppress unprompted requests, so the request may never be shown at all.

**★ What is a pre-prompt, and why use one?**
Your own explanatory UI with a *Not now* option before triggering the browser prompt. *Not now*
leaves the state at `prompt` so you can ask later; a denied browser prompt is unrecoverable.

**★ Why keep a reference to the `PermissionStatus` object?**
Because its `change` event is how you learn the user revoked or granted the permission from site
settings mid-session. Permission is state to watch, not a value to cache.

---

[Topic index](./README.md) · [02 · Geolocation](./02-geolocation.md) →
