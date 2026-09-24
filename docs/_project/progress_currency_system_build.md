---
name: devbible-currency-system-build
description: BUILT 2026-08-31 — pins.js, currency.mjs and the weekly workflow are on main and running. What the first real run found, and the four bugs the live run exposed. Open before touching the currency tooling.
metadata:
  type: progress
---

# Currency system — built and running · commit `1ae8f47e`

Plan: [[devbible-currency-system]]. Steps 1–3 of its order are **done**.

| file | what |
|---|---|
| `src/data/pins.js` | **42 pins**, 28 tracks. Companion to `progress.js` — hand-maintained, one generated JSON |
| `scripts/currency.mjs` | resolves each pin against `npm:` / `eol:` / `gh:`, scans `> Verified:` lines, writes `static/currency.json` |
| `.github/workflows/currency.yml` | weekly Monday 06:00 UTC, commits the JSON, opens **one** labelled issue when a human is needed |
| `package.json` | `yarn currency` · `--check` · `--scan` · `--offline` |

## What the first real run found — 2026-08-31

**18 current · 5 patch · 4 minor · 2 major · 12 unanchored · 6 pin/page mismatches**

- 🔴 **Firefox 153.0.3 → 154.0.1**, and **48 pages** measured computed styles in it. The
  biggest finding, and one nobody was looking for — CSS and React claims are only as current
  as the browser they were measured in.
- 🔴 **Flyway 12 → 13.4.0** (major) · **JUnit 6.0.3 → 6.1.3** across **97 pages** ·
  **MongoDB 8.0 → 8.3.8** · **Zod 4.4.3 → 4.5.4** · **Node 24.19.0 → 24.20.0** (317 pages)
- 📅 **Node 26 becomes LTS 2026-10-28 — 58 days.** The event fires from endoflife.date
  automatically; nothing had to be remembered.
- ✅ Clean: React 19.2.8 · TypeScript 7.0.2 · Express 5.2.1 · Spring Boot 4.1.1 ·
  Spring Framework 7.0.9 · Testcontainers 2.0.5 · jOOQ 3.21
- ❔ **12 unanchored** — the imported frontend tracks name no version anywhere, so no page
  can be checked. `pin: null` is deliberate and reported, not skipped.

## 🔴 Four bugs the LIVE run exposed that no amount of design would have

1. **42 concurrent fetches to a dozen hosts → `UND_ERR_CONNECT_TIMEOUT` on every npm pin.**
   Fixed with a `pool()` at **CONCURRENCY = 6** plus one retry. 42 concurrent to the *same*
   host is fine — it is the host spread that breaks. CI runners are no friendlier.
2. **Drift classification cannot be plain semver.** Comparing `3.14` to `3.14.7` reported
   drift on every line-level pin. Fix: **compare only as many components as the pin
   declares**, then classify by which index differs. PostgreSQL ships patches in the
   *second* component (18.4 → 18.6 is a patch), so it carries `patchIndex: 1`.
3. **GitHub tags are not uniform** — `v2.55.0`, `r6.0.3`, `version-3.21.7`, `flyway-13.4.0`.
   A bare-semver filter reported "no stable tags" for JUnit, jOOQ and Flyway. Fix: take the
   first dotted number in the tag name, after dropping rc/alpha/beta/M-builds.
4. **"Inconsistent pins" was mostly false.** A `> Verified:` line legitimately cites version
   history (*"TypeScript 4.9 introduced `satisfies`"*), and every citation counted as a
   competing pin — 12 flags, most of them noise. Fix: report the **modal** version per pin
   and flag only when it disagrees with `pins.js`; the rest is context. **12 → 6, and the
   6 are real.**

## Not done, deliberately

**No `docs/` file was edited.** Fixing the drift means touching pages across java, css,
react, mongodb, nodejs and postgresql — six locked lanes belonging to other sessions
(rule 11). The tool reports; the owning session fixes.

Also still open: the `reviewMonth` calendar and the dashboard badge (both "later, if it
earns its place" in the plan), and whether GitHub API rate limits need a token — **Podman
and Flyway both hit transient unauthenticated timeouts** in the first run and resolved on
re-run. `--check` treats unreachable as needing a human, which is correct.

Related: [[devbible-currency-system]] · [[devbible-frontend-toolchain-currency-plan]] ·
[[progress-status-config]] · [[devbible-locks]]
