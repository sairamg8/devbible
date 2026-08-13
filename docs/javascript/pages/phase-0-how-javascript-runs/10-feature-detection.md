---
title: "10 · Feature detection"
sidebar_label: "10 · Feature detection"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p0/ex4-hosts.mjs`
> for the `navigator` result.

**Test for the capability you need. Never for the browser, and never for the
environment.** Every user-agent check ever written eventually misidentifies
something, because the string is a fiction maintained for compatibility.

## The measured reason this matters right now

```
browser-only:
  window=false document=false localStorage=false navigator=true ...
```

`navigator` is **`true` in Node 24**. Node 21 added a minimal `navigator`
object, and every codebase that used it as "am I in a browser?" silently
inverted its meaning on the server:

```js
// BROKEN — true on Node 21+, so this runs during SSR
if (typeof navigator !== 'undefined') {
  hydrateCart();
}

// Correct — name the capability
if (typeof document !== 'undefined') {
  hydrateCart();
}
```

The old check was never testing for a browser. It was testing for a name, and
the name moved.

## The four detection shapes

**1. Does the global exist?**

```js
const canObserve = typeof IntersectionObserver !== 'undefined';
```

Use `typeof`, not a bare reference — a bare `IntersectionObserver` throws
`ReferenceError` where it does not exist, and `typeof` is the one operator that
tolerates that ([02 · Parse, compile, execute](./02-parse-compile-execute.md)).

**2. Does the method exist?**

```js
const hasGroupBy = typeof Object.groupBy === 'function';
const hasAt      = typeof Array.prototype.at === 'function';
```

**3. Does the option get read?** — for APIs extended with an options bag:

```js
let supportsPassive = false;
try {
  const opts = Object.defineProperty({}, 'passive', {
    get() { supportsPassive = true; return false; },
  });
  window.addEventListener('probe', null, opts);
  window.removeEventListener('probe', null, opts);
} catch { /* older browser: leave false */ }
```

The getter only fires if the browser actually inspects `passive`. There is no
other way to ask.

**4. Does it work?** — when presence is not the same as function:

```js
const canPersist = (() => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem('__probe', '1');   // Safari private mode throws HERE
    localStorage.removeItem('__probe');
    return true;
  } catch {
    return false;
  }
})();
```

**This is the one people get wrong.** Safari in private browsing *defines*
`localStorage` and then throws `QuotaExceededError` on every write. An existence
check passes and the cart save still fails. Probe with a real write.

## Detect once, at module load

```js
// lib/capabilities.js
export const CAPS = Object.freeze({
  dom:        typeof document !== 'undefined',
  storage:    canPersist,
  observer:   typeof IntersectionObserver !== 'undefined',
  clipboard:  typeof navigator !== 'undefined' && !!navigator.clipboard,
  webShare:   typeof navigator !== 'undefined' && typeof navigator.share === 'function',
});
```

Computing a probe on every call is wasted work, and a `try`/`catch` in a hot path
is easy to get wrong. Compute once, freeze, import everywhere.

## Progressive enhancement, concretely

The point of detection is not to print a warning — it is to keep the feature
working in a reduced form.

```js
// Infinite scroll where supported; a real button where not
export function attachPagination(container, loadMore) {
  if (CAPS.observer) {
    const sentinel = document.createElement('div');
    container.append(sentinel);
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }).observe(sentinel);
    return;
  }

  const button = document.createElement('button');
  button.textContent = 'Load more products';
  button.addEventListener('click', loadMore);
  container.append(button);
}
```

Both paths load more products. Neither path is broken. **A "Load more" button is
a worse experience than infinite scroll and an infinitely better one than a dead
page.**

The same logic runs the other way for storage: if `CAPS.storage` is false, the
cart lives in memory for the session instead of crashing on save. The user loses
persistence across reloads, not the ability to shop.

## When user-agent sniffing is defensible

Rarely, and always narrowly:

- Working around a **specific, identified engine bug** — with a link to the bug
  report and a removal condition in the comment.
- Offering the right **app-store link** on iOS versus Android.
- **Analytics**, where you are reporting the string rather than branching on it.

Even then prefer `navigator.userAgentData` where available, and treat the result
as advisory. Never gate a *capability* on it.

## Gotchas

**Symptom:** SSR renders a browser-only branch and crashes.
**Cause:** `typeof navigator !== 'undefined'` used as a browser check; it is true
on Node 21+.
**Fix:** test `typeof document !== 'undefined'`, or the specific capability.

**Symptom:** `ReferenceError: IntersectionObserver is not defined` from the
detection line itself.
**Cause:** a bare reference instead of `typeof`.
**Fix:** `typeof IntersectionObserver !== 'undefined'`. Only `typeof` tolerates
an undeclared name.

**Symptom:** storage detection passes, writes still throw.
**Cause:** Safari private mode defines the API and rejects writes.
**Fix:** probe with a real `setItem` inside `try`/`catch`.

**Symptom:** a feature check passes in a browser that renders it broken.
**Cause:** the API exists but is a no-op or partially implemented — vendor
prefixes and half-shipped proposals both do this.
**Fix:** probe the behaviour, not just the name, when correctness matters.

**Symptom:** a UA-based workaround still runs years after the bug was fixed.
**Cause:** nobody recorded a removal condition.
**Fix:** every UA branch carries a comment with the bug link and what makes it
removable. Otherwise it is permanent.

## Interview questions

**★ Why is feature detection preferred over user-agent sniffing?**
The UA string is a compatibility fiction — browsers deliberately impersonate each
other, and it is user-editable. It also tells you a browser, when what you needed
was a capability. Detection asks the exact question and keeps working when a
browser ships the feature later, with no code change.

**★ What is wrong with `typeof navigator !== 'undefined'` as a browser check?**
It is true on Node 21+ — measured true on Node 24.19.0 — so the "browser-only"
branch runs during SSR. It was always testing for a name rather than a
capability. Use `typeof document !== 'undefined'` or probe the specific API.

**★ Why check `localStorage` with a write instead of `typeof`?**
Because Safari private browsing defines `localStorage` and throws
`QuotaExceededError` on every write. Existence and usability are different
questions, and only a real `setItem` inside `try`/`catch` answers the second.

**What is progressive enhancement in practice?**
Ship a version that works everywhere, then add capability-gated improvements on
top. Infinite scroll where `IntersectionObserver` exists and a "Load more" button
where it does not — both load products, and no user gets a dead page.

**Is user-agent sniffing ever acceptable?**
Narrowly: a documented engine-specific bug workaround with a removal condition,
platform-specific store links, and analytics where you report the string rather
than branch on it. Never for gating a capability.

---

← [09 · Transpilation and polyfills](./09-transpilation-polyfills.md) · [Phase index](./) · Next: [11 · The JIT in one page](./11-the-jit.md) →
