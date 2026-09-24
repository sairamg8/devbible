---
name: progress-nextjs-ch16
description: Next.js chapter 16 (Deployment, scaling, observability) CLOSED 2026-09-04 — authored by a parallel subagent; the coordinator/author split that worked, and the four claims left explicitly uncertain.
metadata:
  type: project
---

# Next.js ch16 · Deployment, scaling and observability — CLOSED 2026-09-04

Session `10aadd98`, commit `65c2f3dc`. **9/16 → 20/20 verified.** Directory went
**2,554 → 4,623 lines** and **146 → 289 ★**.

## 🔴 The pattern that made this work — one agent per chapter directory

The user asked to *"deploy one agent, split work both of you"*. What worked:

- **The subagent (`devbible-author`) owned exactly one directory** and was told so explicitly,
  plus what it must not touch: the coordinator's chapter, `src/data/progress.js`, any board, and
  `git`. **It never commits.** The coordinator QCs and commits its output.
- **The coordinator briefed it with the version spine up front** — 16.3.4, Turbopack default,
  `next` not installed so no T1 probe is possible — so it did not re-derive them.
- **Mid-flight `SendMessage` is high-value.** Two messages saved it several fetches: the
  `.md`/`Accept: text/markdown` trick plus the exact sitemap-verified doc paths (it had otherwise
  been about to guess), and three CLI facts the coordinator had just verified
  (`--keepAliveTimeout`, `next experimental-analyze`, `PORT` not readable from `.env`). All three
  landed as sections and gotchas in its pages.
- **Told it which topic the coordinator was covering** (the production checklist, in Appendix D)
  so it linked rather than duplicated.

⚠️ **The one thing to brief better next time: allocate more interstitial `sidebar_position`
slots than you think.** Three were allocated; a fourth chunk was needed, and the author correctly
refused to renumber or duplicate, parking it at position 19 and escalating the decision. The
coordinator then renumbered the whole chapter 0–19 in reading order.

## Claims left explicitly uncertain, not invented

1. **No framework-level successor to `preferredRegion`.** `/docs/messages/preferred-region-deprecated`
   says only to remove the export and names nothing. Written as *"the documentation names no
   framework-level successor"*; placement is now platform config (`vercel.json` `regions`).
2. **No published per-unit rate for Edge Requests, Fast Data Transfer, or ISR reads/writes.**
   Metered but not in the pricing table, and `vercel.com/docs/incremental-static-regeneration/usage-and-pricing`
   **404s**. Page 05 carries a `## ⚠️ What I could not confirm` section quoting no price.
3. **Multi-region latency** is a labelled arithmetic model (`total ≈ u + (k × d)`), marked
   *"model, not measured"* in the fence and on the `> Verified:` line. No sandbox.
4. **Whether `output: 'standalone'` is harmful on Vercel** — docs silent; the milestone's config
   makes it conditional on `DEPLOY_TARGET` rather than asserting either way.

No ` ```console ` blocks, no timings, no invoices reproduced.

## Quotes banked for later chunks

- *"Functions should be executed in the same region as your database, or as close to it as
  possible, for the lowest latency."* — vercel.com/docs/regions
- *"Vercel bills Active CPU only while your code is actually running. If the request is waiting on
  I/O, CPU billing pauses but memory billing continues"* — vercel.com/docs/functions/usage-and-pricing
- *"This minimal server does not copy the `public` or `.next/static` folders by default as these
  should ideally be handled by a CDN instead"* — `next.config.js/output`
- *"Image transformations are billed for every cache MISS and STALE."* — vercel image limits
- *"Vercel automatically adjusts the maximum age to 60 days for requests from Googlebot and
  Bingbot"* — vercel.com/docs/skew-protection

Full bank: [[research-nextjs-ch16-deployment]], marked do not re-derive.

## Found, not fixed

`11-performance-optimization-turbopack/06-instrumentationts-…md` is a 58-line stub duplicating
this chapter's `04`/`04b`. Decide merge vs cross-link when ch11 comes up.
