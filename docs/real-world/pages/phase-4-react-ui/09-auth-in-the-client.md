---
title: "Auth in the client"
sidebar_label: "09 · Auth in the client"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against react.dev (context, effects) and the Phase 3
> auth contract. Concept home:
> [chapter 3·03](../phase-3-express-api/03-auth/README.md) is the server
> half; [token storage](../../../nodejs/pages/phase-8-security/03-token-storage.md)
> settled where credentials live.

## The problem

The client never touches a token — the `__Host-` cookie rides every
request invisibly ([3·03's design](../phase-3-express-api/03-auth/01-sessions.md)).
What the client *does* own: knowing who is logged in (for rendering),
gating account screens, reacting to the session dying mid-action — the
phase gate's hard case: **session expiry during checkout must not lose
the cart** — and the login/signup flows themselves. Auth state here is a
*belief about the server*, and every design choice follows from keeping
that belief cheap to correct.

## The implementation

```jsx
// src/auth/AuthProvider.jsx
import {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {api, onSessionExpired} from '../lib/api.js';
import {useCartReload} from '../cart/CartProvider.jsx';

const AuthContext = createContext(null);

export function AuthProvider({children}) {
  // status: 'unknown' | 'guest' | 'authenticated'
  const [state, setState] = useState({status: 'unknown', user: null});
  const reloadCart = useCartReload();

  useEffect(() => {                            // boot: ask, don't assume
    const c = new AbortController();
    api('/auth/me', {signal: c.signal}).then(
      (user) => setState({status: 'authenticated', user}),
      () => setState({status: 'guest', user: null}),
    );
    return () => c.abort();
  }, []);

  useEffect(() =>                              // the api layer's 401 broadcast
    onSessionExpired(() => {
      setState({status: 'guest', user: null}); // belief corrected — nothing else
    }), []);

  const login = useCallback(async (email, password) => {
    const {user} = await api('/auth/login', {method: 'POST',
      body: {email, password}});
    setState({status: 'authenticated', user});
    await reloadCart();                        // the server just merged (3·06)
    return user;
  }, [reloadCart]);

  const logout = useCallback(async () => {
    await api('/auth/logout', {method: 'POST'});
    setState({status: 'guest', user: null});
    localStorage.removeItem('cart-summary');   // ch. 05's mirror dies with the session
    await reloadCart();                        // back to the (empty) guest cart
  }, [reloadCart]);

  return (
    <AuthContext.Provider value={{...state, login, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

```jsx
// src/lib/api.js — the 401 seam ch. 01 reserved
const expiredListeners = new Set();
export const onSessionExpired = (fn) => {
  expiredListeners.add(fn);
  return () => expiredListeners.delete(fn);
};

// inside api(): after the !res.ok check —
//   if (res.status === 401) for (const fn of expiredListeners) fn();
// then throw ApiClientError as before: callers still see the 401.
```

```jsx
// gating — a wrapper, not a scattering of ifs
function RequireAuth({children}) {
  const {status} = useAuth();
  const location = useLocation();
  if (status === 'unknown') return <PageSkeleton />;     // don't flash the wall
  if (status === 'guest') {
    return <Navigate to="/login" state={{from: location}} replace />;
  }
  return children;
}
```

## The expiry-during-checkout walkthrough

The gate's scenario, step by step:

1. The user's session expires while they type an address. Nothing
   happens — expiry is discovered, not announced.
2. Submit fires; the API returns 401. The `api` layer broadcasts
   `sessionExpired`; the provider flips to `guest`. **The cart provider
   and the form keep their state** — nothing unmounts, because the
   checkout route gates on a *modal* login for this case, not a redirect.
3. The checkout screen, seeing `guest` while holding a dirty form, opens
   the login modal ([chapter 07's](07-modal-portal-focus.md)) over the
   form.
4. Login succeeds → the provider reloads the cart (the server-side
   session changed, and with it possibly the cart identity), the modal
   closes, the form — plain React state, never unmounted — submits again
   with the same [idempotency key](04-useform-and-checkout.md).

The design fact that makes this work: **losing auth does not tear down
UI**. `RequireAuth` redirects on *navigation*; in-place expiry is handled
where the work is, by overlaying re-auth. A guard that unmounted on the
401 would destroy the form state and the answer with it.

## The rules

- **`status: 'unknown'` is a real state.** Booting means one `/auth/me`
  round trip; rendering the login wall during it flashes wrongly for
  every logged-in user. Skeleton until known — the same discriminant
  discipline as [`useAsync`](01-useasync-and-the-api-client.md).
- **The client renders on belief, the server enforces on truth.** Hiding
  admin links for guests is UX; every admin *request* is gated
  server-side ([3·04](../phase-3-express-api/04-authorization.md)). The
  client's auth state can be wrong for minutes and nothing insecure
  happens — that is the property to preserve in every feature.
- **Login is the only place cart identity changes** — and the provider
  owns calling `reloadCart` so the
  [merge](../phase-3-express-api/06-cart-endpoints.md) is reflected
  exactly once, not by every screen that notices a user appeared.

## Gotchas

- **Symptom:** after logout in one tab, another tab still shows the
  account page until it makes a request. **Cause:** belief goes stale
  across tabs — no push channel. **Fix:** cheap and sufficient: the
  [storage-event hook](05-uselocalstorage-and-cart.md) — logout writes a
  `logout-at` key; other tabs' listeners flip to guest. (The cookie is
  already dead server-side; this is UX sync, not security.)
- **Symptom:** infinite loop — `/auth/me` 401s, the expired broadcast
  fires, something refetches `/auth/me`… **Cause:** the boot probe was
  wired into the expired listener's "correct the belief" path. **Fix:**
  the boot effect treats 401 as a *normal answer* (`guest`), not an
  expiry event; the broadcast exists for 401s on routes that *expected*
  auth. The api layer skips the broadcast for `/auth/me` — one
  explicit carve-out, commented.
- **Symptom:** the login modal appears on top of the login page.
  **Cause:** both mechanisms armed — the route guard redirected *and*
  the in-place modal opened. **Fix:** the split is by intent:
  navigation-time gating uses `RequireAuth`; expiry-during-work uses the
  modal; a screen never wires both. The checkout route is *not* wrapped
  in `RequireAuth` for exactly this reason — guests reach it and are
  upgraded in place ([the spec's flow](../../phase-0-the-app/01-the-storefront-spec.md)).

## Interview questions

1. **★ Why does the client have no token-refresh logic, interceptors, or
   Authorization headers?** Because the credential is an `HttpOnly`
   cookie the browser attaches itself — the design pushed all credential
   handling server-side ([3·03](../phase-3-express-api/03-auth/01-sessions.md)).
   The client's entire auth surface is: render on belief, correct belief
   on 401. Every interceptor you don't write is XSS surface you don't
   have.
2. **★ Why must in-place expiry re-auth without unmounting?** Because the
   user's unsaved work lives in component state, and unmount is
   destruction. Redirect-on-401 is correct only at navigation
   boundaries, where there is no work to lose. The general principle:
   auth failures are *interruptions*, and interruption UX must be
   resumable — which requires the interrupted context to survive.
3. **Why is a several-minute-stale auth belief harmless here?** Every
   privileged effect happens server-side against the real session:
   stale-authenticated renders account links that 401 on click; stale-
   guest renders a login prompt an authenticated user doesn't need. Both
   are cosmetic. The moment client belief *gates a capability* (feature
   flags by role, client-side price changes), staleness becomes a bug —
   so nothing in this app does that.

---

← Prev: [Upload with progress](08-upload-with-progress.md) ·
Next → **The admin data table** *(not written yet)*
