---
name: progress-nodejs-completeness-audit
description: Node.js completeness audit — 2026-08-14 (session 8679dc8c)
metadata:
  type: progress
---

# Node.js completeness audit — 2026-08-14 (session `8679dc8c`)

**Node.js in devbible is COMPLETE and audited.** Express is claimed next by the same
session. Do not re-audit Node; read this instead.

## What was checked, and how

| Check | Result | How it was checked |
|---|---|---|
| Syllabus topics covered | **248 of 248** | Parsed the topic tables in `docs/nodejs/syllabus/0{1..4}-*.md` and compared per phase against `src/data/progress.js` |
| Phases written | **13 of 13** | Every `docs/nodejs/pages/phase-*/` has pages, none at 0 |
| Pages | **231** topic pages / **232** files | Phase 3 topic 13 is a chunk directory (`13-transform-streams/`), so files = topics + 1 |
| `> Verified:` line | **232 of 232** | Was 227/232 before this audit — see below |
| Tier badge / Gotchas / Interview questions | 232 of 232 | grep for `db-tier`, `## Gotcha`, `## Interview` |
| Files over the 300-line cap | **0** | `wc -l` over all of `docs/nodejs` |
| Broken links | **0** | Clean `yarn build`; all 37 warnings in the log belonged to react/typescript/javascript |

## The trap: pages < topics does NOT mean incomplete

`progress.js` shows Node phases 0–5 with fewer `pages` than `topics` (e.g. phase 0 is
10 pages / 13 topics). **That is intentional merging, not a gap.** Six phases fold pairs
of syllabus rows onto one page where you would never read one without the other:

- Phase 0 — 3 merges (13 → 10) · Phase 1 — 2 (16 → 14) · Phase 2 — 4 (26 → 22)
- Phase 3 — 2 (21 → 19) · Phase 4 — 2 (16 → 14) · Phase 5 — 4 (30 → 26)

Each of those six phase READMEs carries a **Coverage table** naming every syllabus row
and the page it landed on. Phases 0 and 1 list all rows; phases 2–5 list only the merges.
Verify against those tables, not against a page count.

## What this audit actually changed

1. **Added the 5 missing `> Verified:` lines** — `phase-0-runtime-model/` pages 01, 02,
   03, 05, 10. Every claim was re-checked against a primary source first:
   - `process.versions` in page 01 **re-run** on this machine, output matched the page
     exactly (node 24.19.0, v8 13.6.233.17-node.51, uv 1.52.1, openssl 3.5.7)
   - [Don't block the event loop](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
     — network I/O never touches the thread pool; `fs` (except `FSWatcher`/`Sync`),
     `dns.lookup`, `crypto.pbkdf2`/`scrypt`/`randomBytes`, async `zlib` do
   - [libuv design overview](https://docs.libuv.org/en/v1.x/design.html) — epoll/kqueue/
     event ports/IOCP; pool handles fs, getaddrinfo/getnameinfo, `uv_queue_work()`
   - [perf_hooks](https://nodejs.org/api/perf_hooks.html) — histogram values *are* in
     nanoseconds; `resolution` is the sampling rate in ms
   - [V8 Maglev](https://v8.dev/blog/maglev) — Ignition → Sparkplug → Maglev → TurboFan,
     Maglev shipped Chrome M117
   - [Node globals](https://nodejs.org/api/globals.html) — no `window`; `setTimeout`
     returns a `Timeout`, not a number
   - **Page 03's two console blocks could not be traced to a sandbox** (there is no
     node phase-0 sandbox dir). Its `> Verified:` line says so in as many words rather
     than claiming a run that cannot be shown. Do not "upgrade" that wording.
2. **Homepage pill** — `src/pages/index.js` gained `done: true` on the Node.js card, so
   the Backend section reads **Complete**, not "In progress". New `.pillDone` style in
   `index.module.css` (accent outline, so solid accent stays the signal for active work).
   Set by hand, **not** derived from `percent === 100` — Express also computes 100% and
   is still a draft. Another session applied the same flag to PostgreSQL.
3. **Page count reconciled** — `docs/README.md` said 232, the homepage says 231. The
   coverage row now says 231 to match the UI, which is the single source of truth.
4. **Claim rows added** to `docs/README.md` for Node (complete) and Express (active),
   mirrored in `docs/expressjs/pages/README.md`.

## Next

Express: 78 pages across 11 phases already exist but are **outlines**. The work is
depth per topic, not scaffolding. `sandbox/express5-check`, `express-phase0` and
`express-verify` already exist — reuse them, do not build new ones (no-new-sandboxes).
See [[reference_express_verification]].

Related: [[progress_site_and_node_syllabus]] · [[feedback_ui_progress_and_build_cadence]]
· [[feedback_parallel_sessions]] · [[feedback_no_new_sandbox_scripts]]
