---
title: "trust proxy"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**One application setting decides whether Express believes the `X-Forwarded-*`
headers. Set too narrow, every client shares the load balancer's identity; set
too wide, the client picks its own — and the rate limiter keeps reporting
success.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block in any chunk.**
> [Behind proxies](https://expressjs.com/en/guide/behind-proxies.html) and the
> [application settings table](https://expressjs.com/en/5x/api/application/):
> `trust proxy` defaults to **`false`**; `true` makes the client IP *"the
> left-most entry in the `X-Forwarded-For` header"*, with the documented condition
> that *"the last trusted reverse proxy removes/overwrites"* the `X-Forwarded-*`
> headers **to prevent client spoofing**. A number trusts the *n*th hop counted
> right to left; `loopback`, `linklocal` and `uniquelocal` are the named subnets;
> a predicate function is also accepted. `req.ip`, `req.ips`, `req.protocol`,
> `req.secure` and `req.hostname` all change with it
> ([request reference](https://expressjs.com/en/5x/api/request/)).
> **The topology, attack and verification guidance is this bible's.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The setting and the header](01-the-setting-and-the-header.md)** | What the switch decides, every value from narrowest to widest, which direction the number counts, and why the chain length must be consistent |
| 02 | **[When `true` is a bypass](02-when-true-is-a-bypass.md)** | `req.ip` becomes client-controlled, what that buys an attacker, why a bypassed limiter is worse than none, the five-minute verification, and what to key limits on instead |
| 03 | **[What else it changes](03-what-else-it-changes.md)** | `req.secure`, `req.protocol`, `req.hostname`, the silent secure-cookie failure and its debugging order, absolute URLs, platforms, and the deployment checklist |

**Split on concept boundaries at the 300-line mark.** 01 is the setting, 02 is
the attack, 03 is everything else it silently governs.

## Phase gate

You can say what `trust proxy` decides, which direction its number counts and what
happens on either side of a wrong count, explain in three sentences how `true`
becomes a rate-limit bypass and the exact condition that makes it safe, and name
the properties besides `req.ip` that change — including the one that makes secure
cookies vanish without an error.

## Where this connects

- **← [Phase 3 · 01](../../phase-3-requests/01-req-anatomy/README.md)** — the
  request properties this setting rewires.
- **← [Phase 10 · 01](../../phase-10-app-factory/01-create-app.md)** — where the
  setting belongs, driven by config and `false` in tests.
- **→ [02 · CORS](../02-cors.md)** — the other edge concern that fails in ways
  pointing somewhere else.
- **→ [04 · Rate limiting](../04-rate-limiting.md)** — the control this setting
  silently enables or destroys.
- **→ [Phase 8 · 05 · Cookies and sessions](../../phase-8-validation-authz/05-cookies-sessions-wireup.md)**
  — the `secure` flag that depends on `req.secure`.
- **→ [Phase 4 · 07 · Cookies out](../../phase-4-responses/07-cookies-out.md)** —
  setting the cookie that never arrives.

---

← Index: [Phase 9](../README.md) · Start → [The setting and the header](01-the-setting-and-the-header.md)
