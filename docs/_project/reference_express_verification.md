---
name: devbible-express-verification
description: Express pages — the phase-by-phase quality cliff, the verification harness, the 4 measured errors, and the three-pass completion plan
metadata:
  type: reference
---

Child of [[devbible-progress]]. Everything measured on **express 5.2.1 / Node 24.19.0**,
2026-08-11. Review of record: `docs/expressjs/reviews/verification-claude-pages.md`.

## How the pages got here

**Another session (Grok — it follows `AGENTS.md`, not `CLAUDE.md`) owns Express and
took it from 7 pages to 78 between 07:10 and 07:40 on 2026-08-11.** Every phase now
has pages and a README; the site builds and routes them.

Pages per phase: **0:7 · 1:7 · 2:7 · 3:8 · 4:8 · 5:6 · 6:9 · 7:6 · 8:8 · 9:6 · 10:6 = 78.**

`progress.js` matches exactly, and the six rows my review recommended were added —
topics now **114**, not the 108 that was reviewed. No `pagesPlanned` anywhere, so
the UI reads all 11 as *written* even though most phases have fewer pages than topics.

**Pages VERIFIED 2026-08-11** — `docs/expressjs/reviews/verification-claude-pages.md`
(293 lines). Sandbox `sandbox/express-verify/` on **express 5.2.1**: hand probes
`v1`–`v10`, plus `extract.mjs` + `run-all.mjs`, which pull every ```js block out of all
78 pages and execute it against its claimed ```console output. **Reuse that harness for
any language** — it is the cheapest real verification in this project.

**The headline finding is a CLIFF, not a spread.** Quality degrades monotonically by
phase, breaking sharply after Phase 3 — the co-session wrote all 78 pages in **30
minutes** (07:10–07:40) and the curve is a budget curve spent in phase order:

| phase | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| median lines | 126 | 110 | 92 | 82 | 56 | 45 | 37 | 30 | **25** | 29 | 30 |
| gotchas % | 100 | 100 | 100 | 100 | 62 | 16 | 44 | **0** | **0** | **0** | **0** |
| median interview Qs | 4 | 4 | 3 | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

**Phases 0–3 (29 pages) fully meet the brief** — bold claim, runnable code with real
output, named trade-off, 3 gotchas, 3–5 interview Qs. They need only a `Verified:`
line. **Phases 6–10 (35 pages) are accurate outlines**, not explanations —
`7/01-controller-service-repository` is Master tier, 31 lines, zero code.
**I first called this "bimodal" from an 8-page sample and was wrong**; the full read
changed the recommendation, and the review file records that revision openly.

**24 of 24 hand-checked claims were correct** (413 `entity.too.large`; query simple
`{a:['1','2'],'a[b]':'1'}`; `express.raw` len 13; double-send keeps `first`) — but
**running all 39 extractable examples then found 4 real errors** in the *good* phases:

1. **`1/07`: `router.mountpath` does not exist.** The page claimed `/admin` after mount;
   measured `undefined` before *and* after. `mountpath` is an **app** property — a
   mounted sub-app gives `/reports`. Use `req.baseUrl` inside a request. **FIXED.**
2. **`0/05`: `strict routing` and `case sensitive routing` are `undefined`**, not
   `false` as the page prints. *(unfixed)*
3. **`3/01` and `3/02`: `body: undefined` in the shown output** — the key is actually
   **absent**, because `res.json`/JSON drops undefined values. *(unfixed)*

All four are hand-written console output that was never executed — exactly what
`drafts/GROK-PROMPT.md` exists to prevent.

Two technical gaps also stand: (1) `6/07-etag-and-cache` shows `If-Match → 412` as if
Express does it — **it does not**, stale `If-Match` returned 200 on PUT and GET;
(2) `trust proxy: true` makes `req.ip` **client-controlled** (leftmost XFF), a
rate-limit bypass, and no page connects it to Phase 9.

**Trap worth keeping: you cannot verify a 304 with `fetch`** — it returned 200+body;
`node:http` returned 304 empty. Express was right both times.

**User instructed 2026-08-11: "improve and complete express js fully", "go topic by
topic", then "Wait".** So Express edits ARE authorised for me now despite `AGENTS.md`
reserving them to the co-session. Work is **paused after one page** (`1/07`). The plan,
which is three different jobs, not one pass:

- **Phases 0–3 (29):** run each example, add `> Verified:`. Cheap — the harness already
  ran them all.
- **Phases 4–5 (14):** top up gotchas, trade-offs, interview questions; code exists.
- **Phases 6–10 (35):** write them fully against a correct skeleton. Order: **Phase 8
  first** (ownership + multi-tenant isolation are the highest-consequence topics and the
  thinnest pages, 22–25 lines), then Phase 6, then 7/9/10.

My review is a written record at `docs/expressjs/reviews/verdict-claude.md` (2026-08-11,
214 lines): approve the structure, counts verified (108 rows, Master 28 = 26%), six
recommended row additions, one tier change, no blocking issues.

