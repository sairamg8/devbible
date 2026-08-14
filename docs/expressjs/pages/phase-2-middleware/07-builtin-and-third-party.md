---
title: "Built-in and third-party middleware"
sidebar_label: "07 · Built-in · third-party"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

**Express ships a small set of built-ins. Everything else is a package. Evaluate
third-party middleware like production dependencies — not like demo glue.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The [express reference](https://expressjs.com/en/5x/api/express/) lists exactly the
> built-ins in the table below — `express.json`, `express.urlencoded`, `express.raw`,
> `express.text`, `express.static`, `express.Router` — and names their origins:
> the four body parsers are *"based on body-parser"* (reintroduced into core), and
> `express.static` is *"based on serve-static"*. Everything else, including
> `compression`, `cookie-parser`, `cors`, `morgan` and `multer`, is listed under
> [Resources → Middleware](https://expressjs.com/en/resources/middleware/) as a package
> you install — which is the split this page is about.

## Built-ins you will actually use

| Middleware | Role |
|---|---|
| `express.json` | Parse JSON bodies |
| `express.urlencoded` | Form bodies |
| `express.static` | Static files |
| `express.raw` / `express.text` | Non-JSON bodies (webhooks, …) |
| `express.Router` | Modular stacks |

Details: Phases 3–4. Application settings are not middleware — Phase 0.

## Third-party checklist

Before `npm install`ing a middleware package:

1. **Does it support Express 5?** (path / async assumptions)
2. **Is it maintained?** Last release, open critical issues, archive notice
   (`csurf` is archived — Phase 9)
3. **Is middleware the right shape?** Sometimes a plain function in your repo is
   better than a dependency
4. **What does it mutate?** `req`, headers, prototype
5. **Error behaviour** — does it call `next(err)` or throw?

## Prefer thin wrappers

Helmet, CORS, rate-limit libraries are normal in Phase 9. Still configure them
explicitly — defaults are not a security review.

## Trade-off

A battle-tested package saves time and hides CVEs you never researched. Every
dependency is supply-chain surface (Node Phase 8). Prefer fewer, better mounts.

## Gotchas

**Symptom:** Middleware works in a Gist, fails on Express 5  
**Cause:** Unmaintained Connect-era package  
**Fix:** Check peer deps and issues; replace

**Symptom:** Order-sensitive packages fight each other  
**Cause:** Cookie parser after session, CORS after routes, etc.  
**Fix:** Read each package’s mount-order notes; keep a single skeleton

**Symptom:** “Use this one middleware for auth, validation, and ORM”  
**Cause:** Framework-of-frameworks packages  
**Fix:** Compose small pieces you understand

## Interview questions

**★ Name three built-in Express middleware functions.**  
`express.json`, `express.static`, `express.urlencoded` (and Router).

**How do you evaluate a third-party middleware package?**  
Maintenance, Express 5 support, surface area, and whether you need it at all.

**Why not install every popular security package by default?**  
Overlap, misconfiguration, and dependency risk — deliberate mounts beat kitchen
sinks.

---

← Prev: [Mutating req and res](06-mutating-req-res.md) · Index: [Phase 2](README.md)
