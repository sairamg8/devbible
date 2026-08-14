---
title: "res methods"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Pick one terminal method. Mixing `json` then `send` is how headers-already-sent
starts.**

> Verified: 2026-08-14 on **Express 5.2.1**. Every method here is read from
> `express@5.2.1`'s `lib/response.js` in `sandbox/express-verify/node_modules/`,
> quoted per chunk by function — `res.send`, `res.json`, `res.sendStatus`,
> `res.redirect`, `res.location`, `res.set`, `res.type`, `res.append`.
> Cross-checked against the
> [response reference](https://expressjs.com/en/5x/api/response.html). **Reading
> source is not a run.** The single console block (chunk 01) is re-used unchanged
> from the earlier authorised `sandbox/express-verify` run and is
> **sandbox-measured**; nothing was executed for this rewrite.

`response.js` is 1,053 lines — **38% of Express**
([Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)).
Response helpers are the framework's actual product, and this topic is the core
of them.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What `res.send` does](01-what-res-send-does.md)** | The `typeof` dispatch that makes a string `text/html`, the ETag, the silent 304 downgrade, the 204 stripping, and the HEAD body drop — all of which `res.json` inherits |
| 02 | **[The method map](02-the-method-map.md)** | Which of the twenty-two are terminal, which three skip `res.send` entirely, `res.redirect`'s negotiated body and its open-redirect surface, and `set` vs `append` |
| 03 | **[Choosing and shaping](03-choosing-and-shaping.md)** | `json` over `send` and why; the three JSON settings and what they cost; never returning a row; and where `undefined` goes |

**Split on concept boundaries at the 300-line mark.** 01 is the machine, 02 is
the surface, 03 is the judgement.

## Phase gate

You can say what `res.send('hello')` sets as its content type and why, name the
terminal methods that bypass `res.send`, and explain where a 304 you did not
write comes from.

## Where this connects

- **← [Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)**
  — why `response.js` is the biggest file in Express.
- **← [Phase 3 · 01 · chunk 02](../../phase-3-requests/01-req-anatomy/02-the-twelve-getters.md)**
  — `req.fresh`, the getter `res.send` consults before downgrading to 304.
- **→ [02 · Status and headers](../02-status-and-headers/README.md)** — the ordering rule
  and what happens after `headersSent`.
- **→ [03 · Response shapes](../03-response-shapes.md)** — the envelope decision, in
  full.
- **→ [04 · Headers already sent](../04-headers-already-sent.md)** — the failure
  mode chunk 03's streaming section ends on.
- **→ [08 · Streaming and downloads](../08-streaming-and-downloads.md)** —
  `sendFile` and `download`, the two terminals that do their own caching.
- **→ [09 · Content negotiation](../09-content-negotiation.md)** — `res.format`, and
  the `Vary` that `res.append` exists for.
- **→ [Phase 6 · 07 · ETag and cache](../../phase-6-rest-surface/07-etag-and-cache.md)**
  — what the weak ETag `res.send` generates can and cannot be used for.
- **→ [Phase 9 · 05 · CSRF and injection](../../phase-9-hardening/05-csrf-and-injection.md)**
  — the open redirect `res.location` does not protect against.

---

← Index: [Phase 4](../README.md) · Start → [What `res.send` does](01-what-res-send-does.md)
