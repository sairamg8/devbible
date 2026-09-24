---
name: cursor-vite
description: 🔴 START HERE for the vite lane — position, the next unit by exact name, the Vite 8 facts a cold session must not re-derive, and the user's queued toolchain-landscape deliverable. Opened 2026-09-07 session 84f95c0c.
metadata:
  type: project
---

# 🔴 START HERE — the vite lane

## 🟢 THE VITE TRACK IS COMPLETE AGAIN — 18 / 18 topics, 188 pages (2026-09-08, session `6d8f8a23`)

🔓 **Lock RELEASED. Nothing owed. Tree clean for the vite lane.**

**Topic 18, microservices architecture, is CLOSED.** Commits `2a6c73c7a` (wave 1) and
**`fb0b51370`** (wave 2 + wiring + boards). 🔴 **NOT PUSHED — the user pushes.**

| | |
|---|---|
| ✅ Topic 18 | **24 chunks · 5,385 lines · 126 ★** |
| ✅ Track | **18 / 18 topics · 188 pages** |
| ✅ Gates | `yarn mdxcheck docs/vite` 189 files / **0 problems** · `yarn linkcheck` **7,455 files / 0 problems corpus-wide** · nothing over cap · every page badged + `> Verified:` + `> Validated:` · **zero `{/* FOOTER */}` markers** · positions unique and gap-free 1–24 |
| ✅ Boards | `docs/vite/README.md` · `docs/vite/pages/README.md` · `src/data/progress.js` vite row 18 · `page-counts --check` current · `status --check` current |
| ✅ Wiring | topic 17's `03-the-adjacent-toolchain.md` repointed at `18/01`; its **"end of the Vite track"** clause removed |

🔴 **A session told *"continue with vite"* and nothing else should say the track is complete and
ask what to pick up.** As before — and as before, that is **not** a veto on the user naming a new
topic.

### 🔴🔴 THE RESULT WORTH CARRYING TO EVERY FUTURE DISPATCH

**Rule 7 scored 12 / 12.** Twelve chunks overshot the 300-line cap across two waves and **all
twelve split; none trimmed.** Combined with the tanstack measurement (0 of 4 with the rule, 2 of 2
without), the line is now proven across 16 overshoots. See [[dispatch-anti-stall]] §7.

| wave | dispatched | before | after | sibling | total |
|---|---|---:|---:|---|---:|
| 1 | `02` | 352 | 221 | `02b` 222 | 443 |
| 1 | `02a` | 321 | 217 | `02a2` 168 | 385 |
| 1 | `03` | 472 | 288 | `03b` 266 | 554 |
| 1 | `04` | 367 | 235 | `04b` 207 | 442 |
| 1 | `05` | 375 | 215 | `05b` 189 | 404 |
| 1 | `05a` | 307 | 236 | `05a2` 144 | 380 |
| 2 | `05c` | 429 | 255 | `05d` 218 | 473 |
| 2 | `06` | 387 | 256 | `06b` 162 | 418 |
| 2 | `07` | 551 | 294 | `07b` 298 | 592 |
| 2 | `08` | 361 | 263 | `08b` 143 | 406 |
| 2 | `09` | 335 | 187 | `09b` 177 | 364 |

✅ **Eight fresh-write agents, ZERO stalls.** Consistent with §8 of [[dispatch-anti-stall]]:
fresh writes are reliable, splits and extends are not. Every split here was done **by the
authoring agent on its own file**, which is a fresh-write shape, not the read-an-existing-file
shape that kills agents.

### 🔴 THREE NEW PROCESS FACTS, bought here

1. **Concurrent agents CANNOT allocate `sidebar_position`.** Eight of them picked against a
   moving target and collided on **6, 7, 8, 20 and 21**. Every one of them *reported* the
   collision instead of renumbering someone else's file — exactly right, and why nothing had to
   be reconstructed. ➜ **Assign positions in the dispatch, then renumber the whole directory in
   ONE coordinator pass at close.** Never ask agents to coordinate numbering.
2. 🔴 **A forward reference written as *(not written yet)* goes STALE the moment the target
   lands, and NO gate catches it.** It is not a broken link — it is bold text — so `linkcheck`,
   `mdxcheck` and the cap check all pass it forever. Ten of them existed here; chunk `01` alone
   carried eight, because a topic-map page written first names everything that does not exist
   yet. ➜ **`grep -rn 'not written yet' <topic dir>` is a MANDATORY step at topic close**, and
   it belongs beside the `{/* FOOTER */}` grep for the same reason: both are invisible defects.
3. **A split sibling can steal the next chunk's planned name.** `05b` was planned for wave 2 and
   taken by a wave-1 split, so version-skew became `05c`. ➜ Plan letters with gaps, or accept the
   rename and repoint the plan the moment it happens.

### The 24 chunks, in reading order

`01` what microservices mean to a build · `01a` the BFF and browser fan-out · `02` the dev proxy
across services · `02a` CORS, cookies and websockets · `02a2` websocket origin checks and the
preview recipe · `02b` websockets, `configure` and the dev-only scope · `03` service URLs are
baked in · `03b` runtime configuration · `04` one repo, many Vite apps · `04b` shared packages
and the deploy decision · `05` Module Federation on Vite · `05a` shared deps and singletons ·
`05a2` shared dependency versioning · `05b` worked example and version spine · `05c` version
skew and the manifest · `05d` `exposes`, SRI and observability · `06` import maps and the
alternatives · `06b` composition alternatives · `07` `base` and asset URLs · `07b`
`server.origin`, manifest and router basename · `08` the Environment API · `08b` many
deployables is not microservices · `09` when not to split · `09b` the decision framework.

---


---

> 🗄️ **319 lines of superseded history moved to [CURSOR-VITE-HISTORY.md](CURSOR-VITE-HISTORY.md) on 2026-09-08**, verbatim —
> earlier session blocks, the wind-downs they came from, and the reasoning behind decisions
> already applied above. Nothing was dropped. Reach for it when you need *why*, or when
> something here refers to a session you have no record of:
> ```bash
> grep -n -i '<term>' devbible/CURSOR-VITE-HISTORY.md
> shared/scripts/recall.sh --cold <terms>
> ```
