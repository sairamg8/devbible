---
title: "Feature flags with a local override"
sidebar_label: "08 · Feature flags"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against MDN —
> [`Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
> and [the `storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event).
> Concept homes: **configuration and why `NODE_ENV` is not a flag** is
> [Node 11·01](../../../nodejs/pages/phase-11-deployment/01-twelve-factor-config.md);
> **the storage hook** is [chapter 4·05](../phase-4-react-ui/05-uselocalstorage-and-cart.md);
> **server-side enforcement** is [chapter 3·04](../phase-3-express-api/04-authorization.md).

## The problem

A flag answers *"is this feature on for this request?"* — and the storefront
needs to ask it in two places that disagree by default: the server, while it
renders, and the browser, after it hydrates. Add a developer who needs to turn
a flag on for themselves without a deploy, and there are three sources of truth
for one boolean.

Getting the precedence wrong produces the two failures that make teams distrust
flags: **a hydration mismatch on every flagged component**, and **a flag that
was "off" still letting the request through**.

## Flags are resolved on the server, like locale

This is the same rule as [money and dates](06-money-and-dates/README.md), for
the same reason: anything the render depends on must be identical on both
sides, so it is resolved once per request and shipped with the page.

```js
// server, per request — evaluated where the user and the config both are
const flags = evaluateFlags({
  user, cohort: user?.cohort, env: process.env.APP_ENV,
});
// -> serialised into the page alongside the i18n context
```

⚠️ **Do not fetch flags from the client on mount.** The component renders once
with the default, the fetch lands, and it renders again with the real value —
which is a flash of the wrong UI on every page load, and a mismatch warning if
the server rendered the other branch. Flags arriving *with* the page is what
avoids both.

## The catalogue is closed

Flags are declared in one file, with a default and an owner, exactly like the
[event bus's event catalogue](04-the-event-bus.md):

```js
// src/lib/flags.js
export const FLAGS = {
  newCheckout:      {default: false, owner: 'checkout',  expires: '2026-11-01'},
  reviewPhotos:     {default: true,  owner: 'catalog',   expires: '2026-09-15'},
  recommendations:  {default: false, owner: 'discovery', expires: '2026-12-01'},
};
```

A string that is not a key is a bug, not a silently-false flag:

```js
export function isOn(flags, name) {
  if (!(name in FLAGS)) throw new Error(`Unknown flag: ${name}`);
  return flags[name] ?? FLAGS[name].default;
}
```

🔴 **`??`, not `||`.** A flag explicitly set to `false` by the server must stay
`false`; `||` would fall through to a `true` default and turn the feature back
on for exactly the users it was disabled for.

**`expires` is the part teams skip and then regret.** A flag with no expiry
becomes permanent branching: two code paths, one of them untested, forever.
The date is not enforced by the runtime — it is there so a lint rule or a CI
check can fail the build when a flag outlives it, which is the only mechanism
that actually removes flags.

## The local override

The override exists so a developer or a QA engineer can see a feature without a
deploy. It is deliberately small, and deliberately fenced:

```js
// src/lib/flags.js
const OVERRIDE_KEY = 'devbible:flag-overrides';
const overridable = () => import.meta.env.MODE !== 'production';

function readOverrides() {
  if (!overridable()) return {};
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? '{}');
  } catch {
    return {};                       // corrupt JSON must not break the app
  }
}

/** Precedence: local override > server value > declared default. */
export function resolveFlags(serverFlags) {
  const overrides = readOverrides();
  return Object.fromEntries(
    Object.keys(FLAGS).map((k) => [
      k, overrides[k] ?? serverFlags[k] ?? FLAGS[k].default,
    ]),
  );
}
```

⚠️ **The `try`/`catch` is not defensive padding.** `localStorage` throws on
access in some privacy modes and can hold anything a previous version wrote, so
a parse failure has to degrade to "no overrides" rather than take the page down
with it. The same argument [chapter 4·05](../phase-4-react-ui/05-uselocalstorage-and-cart.md)
makes about the persisted cart.

🔴 **An override changes the client's answer only.** The server already
rendered with its own value, so the first paint uses the server's and the
override applies after hydration — a deliberate flicker. That is acceptable for
a developer tool and unacceptable for users, which is one more reason the
override is off in production.

## The flag hides the button. It does not protect the endpoint.

The most expensive mistake in this whole chapter: treating a client flag as
access control. It is not, and it cannot be — `localStorage` is editable by
anyone with devtools, and the serialised server flags are sitting in the page
source.

**A flag decides what the UI offers. The server decides what the request is
allowed to do**, in [authorization](../phase-3-express-api/04-authorization.md),
independently, every time. If the new checkout is off and someone posts to its
endpoint anyway, the endpoint rejects it on its own authority — not because the
button was hidden.

The practical consequence: **a flag being off is never a reason to skip a
server-side check**, and a feature is not "safe to ship dark" because its
entry point is hidden.

## Gotchas

**Symptom:** Every flagged component logs a hydration mismatch
**Cause:** Flags fetched on the client instead of shipped with the page
**Fix:** Evaluate server-side per request and serialise, as with locale

**Symptom:** A flag turned off for a cohort is on for them anyway
**Cause:** `||` instead of `??` — an explicit `false` fell through to the default
**Fix:** `??`, which only falls through on `null`/`undefined`

**Symptom:** A typo'd flag name silently disables a feature
**Cause:** Reading an unknown key returns `undefined`, which is falsy
**Fix:** The `in FLAGS` check that throws — an unknown flag is a bug

**Symptom:** The app is blank in a privacy-mode browser
**Cause:** `localStorage` access threw and nothing caught it
**Fix:** The `try`/`catch` returning `{}`; overrides are optional by design

**Symptom:** A user reports a feature they should not have
**Cause:** Overrides were readable in production
**Fix:** The `overridable()` gate. Client flags are not a security boundary in
any case — check the server enforcement too

**Symptom:** Two tabs disagree about a flag
**Cause:** `localStorage` is shared, but a change in one tab does not re-render
the other
**Fix:** Listen for the `storage` event if this matters for the dev tool; for
users it cannot happen, because overrides are off

**Symptom:** A flag has been "temporarily" on for eight months
**Cause:** No expiry, so nothing ever surfaced it
**Fix:** `expires` plus a CI check that fails on an outlived flag. Nothing else
removes flags

**Symptom:** Removing a flag breaks a page that still reads it
**Cause:** The key was deleted from the catalogue before its call sites
**Fix:** Remove the branches first, the key last — the throwing lookup turns
the leftover call site into an immediate, obvious failure rather than a silent
`false`

## Interview questions

1. **★ Why must feature flags be resolved on the server rather than fetched by
   the client?** Because the render depends on them, and the server and client
   must take identical inputs or the markup differs. A client fetch renders the
   default first, then the real value, giving a flash of the wrong UI on every
   load and a hydration mismatch where the server chose the other branch.
2. **★ Why is a client-side flag not access control?** Because everything it
   depends on is under the user's control — `localStorage` is editable and the
   serialised flags are in the page source. A flag decides what the interface
   offers; the server decides what a request may do, and it has to make that
   decision independently on every request.
3. **★ What is wrong with `flags[name] || FLAGS[name].default`?** An explicit
   `false` from the server is falsy, so it falls through to the default. If the
   default is `true`, the feature turns back on for precisely the users it was
   switched off for. `??` only falls through on `null` or `undefined`.
4. **Why throw on an unknown flag name instead of returning `false`?** Because
   a typo would otherwise disable a feature silently and look like the flag
   working correctly. Throwing turns a misspelling into an immediate failure,
   and it makes deleting a flag key surface every call site still reading it.
5. **What is `expires` for, given nothing enforces it at runtime?** It gives CI
   something to check. Flags accumulate into permanent untested branching
   unless something forces their removal, and a date in the catalogue is what a
   lint rule or build step can fail on.
6. **Why is the override disabled in production if the flags are visible in the
   page source anyway?** Visibility and mutability are different risks. Reading
   the flags tells someone what exists; a production override lets them flip the
   UI into states that were never QA'd against their account, generating support
   load and confusing bug reports. Neither is a security control — the server
   check is.
7. **The override applies after hydration, causing a flicker. Why accept it?**
   Because the alternative is having the server trust a client-supplied value
   when rendering, which is both a security problem and a caching problem. For
   a developer tool a flicker is a fine price; for users it never happens,
   because the override is off.
8. **In what order do you remove a flag?** Delete the branches at the call
   sites first, then the catalogue key. Reversed, the throwing lookup takes down
   pages that still reference it — which is the correct behaviour, but at the
   wrong time.

---

← Prev: [Slug and search normalization](07-slug-and-search-normalization.md) ·
Next → **Optimistic-update helpers** *(not written yet)*
