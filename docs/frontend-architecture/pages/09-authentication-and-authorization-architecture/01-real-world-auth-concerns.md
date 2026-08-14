---
title: "Authentication & Authorization: Token Storage, Refresh Flows & UI Gating"
sidebar_label: "Authentication & Authorization"
sidebar_position: 1
---

# 🏛️ Authentication & Authorization: Token Storage, Refresh Flows & UI Gating

## 1. The Decision Framework

Auth architecture decisions carry genuine security tradeoffs — the "right" answer depends on an actual threat model assessment, not a universal default.

```
Token storage — the CORE tradeoff:
  httpOnly cookies                          localStorage / memory (JS-accessible)
    ── JS CANNOT read the token              ── JS CAN read/use the token directly
       (XSS-SAFE for the token itself)          (XSS-PRONE: a successful XSS attack
    ── browser AUTOMATICALLY sends it            can exfiltrate the token directly)
       cross-origin ──► CSRF-PRONE            ── NO automatic cross-origin sending
       (needs CSRF token defense)                ──► NO CSRF risk for this mechanism

  ── CHOOSE based on actual threat model: an app with strong CSRF defenses (SameSite
     cookies, CSRF tokens) reasonably prefers httpOnly; an app with strict CSP and low
     third-party-script surface reasonably prefers memory/localStorage
```

### Refresh Token Flow: Handling Concurrency Correctly
A silent token refresh (exchanging a refresh token for a new access token before the current one expires) needs careful handling of **concurrent requests** — if 5 API calls fire simultaneously right as the access token expires, naively refreshing independently per-request produces 5 separate refresh attempts (wasteful, and some refresh-token rotation schemes invalidate the OLD refresh token on first use, meaning 4 of those 5 concurrent refresh attempts would fail outright). The correct pattern: the FIRST expired-token failure triggers a SINGLE refresh; the other 4 requests wait for that one refresh to complete, then retry using the newly-obtained token.

### Role/Permission UI Gating: Never Trust the Client Alone
Hiding a button, disabling an action, or client-side-redirecting away from a 403 page are all legitimate UX improvements — but **none** of them are actual authorization enforcement. A determined user can always call the underlying API directly, bypassing any client-side gating entirely — every permission check must be enforced server-side regardless of what the client UI shows; client-side gating is purely about not showing unauthorized actions to users who have no intention of bypassing anything, not a security boundary.

### SSR-Aware Session Handling: Avoiding Hydration Mismatches
In an SSR app, the server reads auth state from a cookie; the client (after hydration) might read it differently (e.g. from a different storage mechanism, or before the cookie has propagated) — if server and client disagree about auth state during the initial render, React's hydration will detect a mismatch, either erroring or silently producing an incorrect initial UI state until corrected client-side.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Refresh Token Race Condition Causing Random Logouts Under Concurrent API Load.
An app's token-refresh logic ran independently per failed request — during a page that fired several parallel API calls on mount, all 5 hit their expired access token nearly simultaneously, each independently attempting a refresh. Because the backend's refresh tokens were single-use (rotating on every refresh), only the FIRST refresh attempt succeeded — the other 4 tried to use the now-already-invalidated refresh token and failed, incorrectly logging the user out entirely, despite their session genuinely still being valid. Implementing a shared, de-duplicated refresh promise (the first failing request initiates ONE refresh; all other concurrently-failing requests await that SAME promise rather than each starting their own) fixed the issue — exactly one refresh occurred regardless of how many requests happened to fail simultaneously.

---

## 3. Reference Implementation

```typescript
// A de-duplicated refresh token flow, handling concurrent requests correctly
let refreshPromise: Promise<string> | null = null;

async function getValidAccessToken(): Promise<string> {
  if (isTokenExpired(currentAccessToken)) {
    // Only the FIRST caller actually triggers a refresh; concurrent callers AWAIT the SAME promise
    refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  return currentAccessToken;
}

async function apiCall(path: string) {
  const token = await getValidAccessToken(); // safe under concurrent calls — de-duplicated internally
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } });
}
```

```typescript
// Server-side enforcement — the ACTUAL authorization boundary, regardless of client UI state
// (backend route handler)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession(request);
  if (!session.user.permissions.includes('delete:orders')) {
    return new Response('Forbidden', { status: 403 }); // enforced HERE, not just hidden client-side
  }
  await deleteOrder(params.id);
}
```

```tsx
// Client-side gating — a UX improvement, NOT the actual security boundary
function OrderActions({ order, userPermissions }: OrderActionsProps) {
  const canDelete = userPermissions.includes('delete:orders');
  return canDelete ? <DeleteButton orderId={order.id} /> : null;
  // hiding this button is a nicety — the server STILL enforces the check independently, always
}
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Trusting Client-Side Permission Checks as the Actual Security Boundary
As covered above, ANY client-side gating (hidden buttons, disabled actions, redirect-on-403) is purely cosmetic from a security standpoint — assuming it provides genuine protection (and skipping the corresponding server-side check "since the client already handles it") is a real, exploitable vulnerability, not just a defense-in-depth gap.

### ⚠️ Anti-Pattern 2: Independent, Non-Deduplicated Refresh Attempts Per Failed Request
As the scenario illustrates, this is a subtle bug that only manifests under concurrent load (multiple simultaneous API calls) — easy to miss in casual testing (which rarely fires many parallel requests at the exact moment a token expires) and a common source of confusing, hard-to-reproduce "randomly logged out" bug reports in production.

### ⚠️ Anti-Pattern 3: Choosing Token Storage Based on Convention Rather Than an Actual Threat Model
Defaulting to localStorage "because it's simpler to implement" (or httpOnly cookies "because it's the security-conscious default") without actually assessing the app's real threat surface (third-party script exposure for XSS risk, existing CSRF defenses) means the choice may not actually match the risks that matter for THIS specific app — the tradeoff table above should inform a deliberate choice, not be skipped in favor of habit.
