---
name: progress-nextjs-session-20260905
description: Session record for devbible Next.js 2026-09-05 (session 989fb824) — ch08 closed at 57/57 with four parallel forks, five library pins landed, ch10 claimed and live. Read with CURSOR-NEXTJS.md, which is the position.
metadata:
  type: project
---

# Next.js session `989fb824` — 2026-09-05

**User order:** *"complete current chapter only, deploy maximum agents, and once complete then
only pick next."* Followed literally: ch08 closed first, nothing else touched, then ch10 claimed.

🔴 **The cursor is `CURSOR-NEXTJS.md`. This file is history; that file is the position.**

## Done — chapter 08 CLOSED

**`1d8259a0` + `331e9349`. 57 files · 13,373 lines · 704 ★ · positions 0–56 gap-free**, from
**2 written pages + 7 stubs + 1 generated index** in a single session. Full record with the
findings: [[progress-nextjs-ch8]]. Bank: [[research-nextjs-ch8-state-management]].

**Twelve commits**, per topic and per board:

| commit | what |
|---|---|
| `03cac2cb` | topic 01 · the server/client/URL split — 5pp, 1,254L, 60 ★ |
| `ddb06f81` | topic 02 · when RSC data flow is enough — 5pp, 1,070L, 53 ★ |
| `ae45f1d7` | topic 03 · URL as state — 12pp, 2,995L, 158 ★ |
| `04101078` | topic 04 · client state tools compared — 7pp, 1,718L, 99 ★ |
| `b7d212d9` | topic 05 · TanStack / RTK Query — 6pp, 1,479L, 51 ★ |
| `aa0eb250` | topic 06 · useOptimistic / useActionState — 7pp, 1,587L, 68 ★ |
| `22dad3df` | topic 07 · SprintDesk milestone — 12pp, 2,744L, 179 ★ |
| `48af5b60` `6ec6f08d` `1707ee7e` | the five pins |
| `1d8259a0` | the close: index, 17 placeholders repointed, renumber, two half-footers |
| `331e9349` | `progress.js` n:8 → `topics: 57, pages: 57` |

## Now live — chapter 10, claimed at pick-up

`docs/nextjs/pages/10-forms-authentication-and-security-hardening/` — **6 written and verified
(10–15), 6 stubs, 1 generated index.** Four forks dispatched: A = topics 01–02 (100–119),
B = topic 03 auth (120–139), C = topics 04–05 (140–159), D = topic 06 milestone (160–179).
The measured table and every boundary handed to the forks are in the LIVE CLAIM block of
`CURSOR-NEXTJS.md`.

🔴 **Claimed BEFORE dispatching**, not at wind-down — the ch7 three-session collision
([[progress-nextjs-ch7-retry-reset-collision]]) happened because a lane reads free in the window
between one session closing and the next remembering to write.

## Three things this session establishes

🔴 **Four parallel forks is a working scale, not two.** Both chapters ran coordinator + 4 on
disjoint files with disjoint `sidebar_position` ranges. Zero collisions in either. The ceiling
that matters is not agent count but whether every fork has (a) its own filenames, (b) its own
position range, and (c) an explicit list of what neighbouring chapters already own.

🔴 **Brief the footer rule and the marker disappears.** Every fork was told a bare
`{/* FOOTER */}` is not an acceptable hand-off. **Zero markers across 54 new pages** — the first
chapter in this track where the coordinator had none to resolve, against a corpus backlog of
1,241 pages with no navigation at all ([[project-footer-cleanup-scope]]).
**But the seams still broke**: `02e` and `07` each had a one-directional footer, because the
neighbouring fork's files did not exist at write time. Detector in [[progress-nextjs-ch8]].

🔴 **The pin gap is real and this is how it gets closed.** Five pins landed with ch08 —
three libraries had **no pin at all** while being taught across the chapter. ch10 is the worst
case in the corpus (bcrypt 32 pages, helmet 23, multer 14, passport 12, all unpinned), so every
ch10 fork was told to report an exact version and URL for anything it teaches.

## State at the time of writing

Working tree **clean** in `docs/` and `src/`. ⚠️ **`main` is 130 commits ahead of `origin/main`
and has not been pushed** — the previous cursor already carried this. Not pushed here either;
the user has not asked, and a push is worth doing deliberately rather than as a side effect.
