---
name: progress-stack-coverage-map-20260901
description: MERN/PERN coverage map of the whole devbible corpus as of 2026-09-01 — what a fullstack learner can actually walk today, where the MERN half is blocked, and the measurement trap in progress.js that makes the site's percentages untrustworthy. Open this when asked "what does devbible cover", "where do I start", or anything MERN-vs-PERN.
metadata:
  type: project
---

# devbible · the MERN/PERN coverage map — 2026-09-01

Written for the user's question *"I want to learn and use PERN and MERN stack based
fullstack application existing languages and their sylllabus real world cases would help
me?"* — a **read-only orientation question**, not a write instruction. No language was
named, so **no lock was claimed in that session** and nothing was authored.

## The answer in one line

**PERN is walkable end to end today. MERN stops at the data layer.**

## Coverage, by role in the stack

Measured 2026-09-01 from `src/data/progress.js`, not from memory.

| Role | Track | Planned topics | State |
|---|---|---|---|
| Language | JavaScript | 269 | ✅ complete (DSA phases 13–15 parked, 16 dropped — deliberate) |
| Language | TypeScript | 136 | ✅ complete |
| Runtime | Node.js | 248 | 93% |
| Framework | Express | 115 | ✅ complete |
| UI | React | 217 | 99% |
| Styling | CSS | 74 | ✅ complete |
| **DB — the P in PERN** | **PostgreSQL** | **233** | ✅ **complete**, incl. a whole part on Node + raw `pg` |
| **DB — the M in MERN** | **MongoDB** | **82** | 🔴 **41%** — the gap |

**Tooling, all complete:** Vite, Webpack, Babel, ESLint/Oxlint, Jest+RTL, Playwright,
Redux Toolkit, TanStack Query, Framer Motion, Git, Docker, frontend-architecture,
web-vitals-performance. **Thin:** Nginx 22%, Storybook 40%, Redis 1%, Angular 0%,
Python 9%, Java 75%.

## 🔴 Why MERN specifically is blocked

MongoDB has phases 0–5 written (document model, BSON, mongosh, schema design, CRUD,
query operators) and **phases 6–14 at zero**: aggregation, indexes and the planner, the
Node driver, Mongoose, transactions, replication/sharding, performance, security, and
the storefront data layer.

Everything a MERN app does *past a plain find()* is unwritten. That is the whole gap —
the language, runtime, framework and UI halves are already shared with PERN and done.

## The real-world track is the "real world cases" answer

`docs/real-world/` — **one storefront app across the whole stack**, chapters LINK to the
concept pages rather than re-teaching them. **PERN-first by design: raw SQL through `pg`,
no ORM.** 62 of 77 chapters written.

| Phase | | |
|---|---|---|
| 0 · The app spec | 3/3 | ✅ |
| 1 · The database, raw SQL + `pg` | 12/12 | ✅ |
| 2 · Node services | 10/10 | ✅ |
| 3 · The Express API | 12/12 | ✅ |
| 4 · The React UI and its hooks | 12/12 | ✅ |
| 5 · JavaScript custom functions | 10/10 | ✅ |
| 6 · TypeScript across the stack | 1/8 | 🚧 |
| 7 · CSS recipes | 2/4 | 🚧 |
| 8 · **The MongoDB mirror — the MERN variant** | 0/6 | ⬜ |

**Phase 8 is the MERN story and it does not exist.** It also cannot be written first:
it mirrors phase 1's data layer onto Mongo, so it depends on MongoDB phases 6–10.

**The reading route to hand a learner:** real-world phase 0 for the spec, then walk
1 → 5. Dip into a language syllabus only where a chapter points.

**Ordering if the user asks what to build next for MERN:** MongoDB phases 6–10 first,
then real-world phase 8. Not the other way round.

## 🔴 The measurement trap — `progress.js` percentages are NOT trustworthy

`pages` in `src/data/progress.js` is **hand-maintained per language, and different
sessions have given it different meanings.** Measured, not inferred:

- **PostgreSQL reads 298 pages against 233 topics — 128%.** JavaScript reads 105%.
  Those sessions counted **chunk files** after splits.
- **Python reads 16 pages against 180 topics — 9%** — while `docs/python/` holds **234
  `.md` files on disk.** That session counted **closed topics**. `LOCKS.md` says so
  outright.

So a percentage above 100 means "complete and chunked", and a low percentage may mean
"a phase's worth of chunks exist but the topic is not closed". **Never quote these
numbers as page counts.** Fits the standing rule in [[feedback-verify-your-own-measurements]].

Regenerate the table rather than trusting a remembered one:

```bash
node --input-type=module -e "
import {LANGUAGES} from '/mnt/Storage/Backup/Knowledge/devbible/src/data/progress.js';
for(const v of Object.values(LANGUAGES)){
  let t=0,p=0; for(const ph of v.phases){ if(!ph.parked) t+=ph.topics; p+=ph.pages; }
  console.log(v.label.padEnd(24), String(t).padStart(4), String(p).padStart(4), Math.round(100*p/(t||1))+'%');
}"
```

The user has **twice** asked for per-concept live progress in the UI. Deriving it from
the filesystem would fix exactly this inconsistency, but it is a **cross-language**
change and every session here is single-language locked — so it keeps not happening.
It needs to be offered as its own standalone piece of work.

## Salvage committed this session — `a6f155bf`

Arrived to 9 uncommitted files from an earlier Python session's abrupt close:
`docs/python/pages/phase-1-language-core/02-numbers/` — the topic index plus 8
cross-references, flipping the topic from 🚧 in-flight to **✅ complete, 69 chunks**.

QC'd before committing, per the split-proof rule: all 69 linked chunks **exist on
disk** (70 files incl. README, 17,166 lines), **0 over the 300-line cap**, **0 dangling
links**, and the single duplicate `sidebar_position` is the README-vs-chunk collision
the index itself documents as expected.

⚠️ **The Python lock was LIVE and mid-write during that session** — three board files
(`docs/README.md`, `docs/python/pages/README.md`,
`phase-1-language-core/README.md`) appeared modified *after* the salvage commit. They
were left alone deliberately. **`progress_python_pages.md` and the `LOCKS.md` Python row
were also left un-repointed for the same reason** — both still name
`02-numbers/11-fraction.md` as START HERE, which is stale (11 and 12 are written and the
topic is closed), but repointing another session's live cursor mid-flight is worse than
leaving it. Phase 1 on disk at that moment: `01-syntax` 8 files, `02-numbers` 70,
`03-strings` 10, `04-bytes-and-encoding` 5.

See [[devbible-locks]], [[progress-python-pages]], [[progress-realworld-build]],
[[progress-mongodb-pages]], [[progress-full-corpus-audit-20260817]].
