---
title: "Rate limiting"
sidebar_label: "10 · Rate limiting"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against RFC 6585 (429), the `Retry-After` semantics of
> RFC 9110, and the Express 5 docs. Concept home:
> [Node — rate limiting](../../../nodejs/pages/phase-8-security/21-rate-limiting.md)
> and [Express — hardening](../../../expressjs/pages/phase-9-hardening/README.md).

## The problem

Two endpoints invite abuse by their nature: **login** (credential stuffing —
each attempt tests a stolen password) and **checkout** (card testing — each
attempt validates a stolen card). Search invites a third, cheaper kind:
resource burn. The limits differ per surface because the *attacks* differ;
one global limit is either too loose for login or breaks the catalog for
everyone behind one office NAT.

## The design choices

**Token buckets, in-process, per instance.** The
[concept page](../../../nodejs/pages/phase-8-security/21-rate-limiting.md)
owns the algorithm comparison; the bucket wins here for burst-friendliness
(a real user's page load fires six catalog calls at once). In-process means
two instances each allow the full rate — the honest statement is that
limits are *per instance* and the real ceiling is `rate × instances`. That
imprecision is acceptable for these thresholds; when it isn't (a paid API
with hard quotas), the counter moves to Redis behind the same middleware
interface — the seam this chapter leaves.

**Keys are chosen per surface, and login gets two.**

| Surface | Key(s) | Limit | Why this key |
|---|---|---|---|
| `login` | IP **and** email | 10/min per IP · 5/15 min per email | IP alone dies to botnets; email alone lets one attacker lock anyone out — *both* must pass |
| `checkout` | user id | 5/min | authenticated by definition; IP is the wrong identity behind NAT |
| `search` | IP | 30/min | anonymous, cheap-ish, burns CPU |
| everything else | none | — | limits nobody hits are pure false-positive risk |

**429 plus `Retry-After`, through the error contract.** The refusal is an
`ApiError` like any other — one wire shape
([chapter 09](09-the-error-contract.md)), plus the one header that lets
well-behaved clients back off correctly.

## The implementation

```js
// src/middleware/rate-limit.js
import {ApiError} from './errors.js';

function bucketStore({capacity, refillPerSec, max = 50_000}) {
  const buckets = new Map();                 // key -> {tokens, at}
  return {
    take(key) {
      const now = Date.now();
      let b = buckets.get(key);
      if (!b) {
        b = {tokens: capacity, at: now};
        buckets.set(key, b);
        if (buckets.size > max) {            // bounded, like every map (2·08)
          buckets.delete(buckets.keys().next().value);
        }
      }
      b.tokens = Math.min(capacity,
        b.tokens + ((now - b.at) / 1000) * refillPerSec);
      b.at = now;
      if (b.tokens < 1) {
        return {ok: false, retryAfterS: Math.ceil((1 - b.tokens) / refillPerSec)};
      }
      b.tokens -= 1;
      return {ok: true};
    },
  };
}

const TIERS = {
  login_ip:    bucketStore({capacity: 10, refillPerSec: 10 / 60}),
  login_email: bucketStore({capacity: 5,  refillPerSec: 5 / 900}),
  checkout:    bucketStore({capacity: 5,  refillPerSec: 5 / 60}),
  search:      bucketStore({capacity: 30, refillPerSec: 30 / 60}),
};

export function rateLimit(tier, keyFn) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;   // req.ip is real: trust proxy = 1
    const result = TIERS[tier].take(String(key));
    if (!result.ok) {
      res.set('retry-after', String(result.retryAfterS));
      return next(new ApiError(429, 'RATE_LIMITED', 'too many requests'));
    }
    next();
  };
}
```

```js
// wiring (excerpts)
router.post('/auth/login',
  rateLimit('login_ip'),
  rateLimit('login_email', (req) => req.body?.email?.toLowerCase() ?? req.ip),
  validate({body: LoginBody}), loginHandler);

router.post('/checkout', requireAuth,
  rateLimit('checkout', (req) => req.user.id),
  validate({body: CheckoutBody, headers: IdemHeader}),
  checkoutHandler);                            // ch. 07's handler
```

## What to notice

- **The email key is taken *before* validation** — a deliberately raw read
  (`req.body?.email`), because the limiter must run before any work an
  attacker can spend, and a malformed body should still consume the IP
  bucket. The lowercasing matches
  [`citext`'s equality](../phase-1-database/01-the-schema/01-conventions-identity-catalog.md)
  so `Ana@` and `ana@` share one bucket.
- **The per-email bucket rate-limits the *victim's identifier*, not the
  attacker** — that is its point (stuffing one account from many IPs) and
  its risk: an attacker can lock a victim's login attempts. 5-per-15-min
  keeps the legitimate user's own retries viable, and the account-lockout
  escalation (notify + require reset after sustained abuse) is named as
  the product-level follow-up, not silently implied.
- **The store is a bounded map** — the same
  [unbounded-cache reasoning](../phase-2-node-services/08-the-cache-layer.md)
  applies to any per-key structure fed by attacker-chosen keys.
- **Health endpoints and static images are unlimited** — limiting `/livez`
  turns the limiter into an outage amplifier the moment an orchestrator
  probes aggressively.

## Gotchas

- **Symptom:** the whole office gets 429s on search. **Cause:** one NAT'd
  IP, thirty people. **Fix:** the trade was named — for anonymous surfaces
  IP is the only key there is; raise the search rate before inventing
  device fingerprinting. Login is unaffected (the office shares the IP
  bucket only for *failed* volume; 10/min of logins is a lot of people
  logging in).
- **Symptom:** limits reset on every deploy. **Cause:** in-process state
  dies with the process. **Fix:** accepted by design at these thresholds —
  an attacker gains one burst per deploy. If that ever matters, it is the
  same Redis seam, not a new design.
- **Symptom:** `req.ip` is `10.0.0.2` for everyone and the limiter throttles
  the site as one client. **Cause:** `trust proxy` unset (or the Nginx hop
  count changed). **Fix:** [the structure chapter's](01-project-structure.md)
  `trust proxy, 1` — and the limiter is *why* that setting is
  load-bearing, not cosmetic.

## Interview questions

1. **★ Why does login need both an IP key and an email key?** They defend
   against different attacks. Per-IP stops one machine hammering many
   accounts — defeated by botnets. Per-email stops many machines hammering
   one account — but alone it lets an attacker deny a victim's login.
   Requiring both to pass means an attacker needs *both* many IPs and many
   target accounts, and a legitimate user fails only their own bucket.
2. **★ Why is the token bucket the right shape for user-facing limits?**
   Real usage is bursty: page loads fan out, humans double-click. A fixed
   window rejects legitimate bursts at the boundary and admits 2× at the
   seam; the bucket admits a burst up to capacity and enforces the
   *average* rate over time — matching the actual abuse model, which is
   sustained volume, not bursts.
3. **What changes when the limiter moves to Redis, and what must not?**
   The store (`take` becomes a Lua script or `INCR`-with-TTL against shared
   state, limits become fleet-wide truths). What must not change: the
   middleware interface, the per-surface tiers, the 429 + `Retry-After`
   contract — callers cannot tell the difference, which is the definition
   of the seam being in the right place.
4. **Why refuse with 429 before validation rather than after?** Everything
   after the limiter costs you something an attacker controls — scrypt on
   login is *deliberately* expensive, and validation itself parses
   attacker bytes. The limiter's entire value is bounding attacker-driven
   spend; running it late converts it into accounting.

---

← Prev: [The error contract](09-the-error-contract.md) ·
Next → **Inbound webhooks** *(not written yet)*
