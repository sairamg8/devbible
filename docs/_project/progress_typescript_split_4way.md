---
name: devbible-typescript-split-4way
description: THE cursor for TypeScript's four-way split — A, B, C, D. Open this on "typescript a/b/c/d", read the START HERE table, and begin writing. Supersedes the A/B and Part-C memos
metadata:
  type: progress
---

# TypeScript — the FOUR-WAY split · A · B · C · D

🔴🔴 **AUTHORITATIVE from 2026-08-17.** Supersedes
[[devbible-typescript-split-parts-ab]] (the original A/B memo) and
[[devbible-typescript-split-part-c]] (which gave Part C the *whole* of phase 6).
**Phase 6 is now split between C and D.**

:::danger THERE ARE NO WORKTREES — work on `main`
`/mnt/Storage/Backup/Knowledge/devbible`, branch `main`. Every devbible worktree
was merged and deleted on 2026-08-15. **Never `git add -A`** — stage explicit
paths; three or four sessions share this checkout.
:::

## 🏁 TYPESCRIPT IS COMPLETE — 136/136, 2026-08-17 — but the build is RED

All four lanes report **0 remaining**: A → phase 5 at 16/16 · B → phases 10 and 12 · C →
phase 6 topics 01–06 · D → phase 6 topics 07–16. Summed from `progress.js`, not from these
tables.

🔴 **Three committed pages still fail MDX and break the WHOLE-SITE build for every language:**
`phase-10-strictness/10-the-error-codes/06-the-name-is-wrong.md` (unfenced `<User>`) ·
`phase-10-strictness/11-typescript-eslint/05-strict-boolean-expressions.md` (stray closing
slash) · `phase-6-modules-build/11-publishing-a-typed-package/05-export-equals-vs-default.md`
(bare `{…}` parsed as a JSX expression). **Lanes B and D owned them and both are closed**, so
there is nobody to defer to — the next session on TypeScript should fix them. Detail:
[[devbible-typescript-build-progress]].

## 🔴 START HERE — the user types "typescript" plus a letter, and that is the whole instruction

🏁🏁🏁 **ALL FOUR LANES ARE CLOSED. TYPESCRIPT IS COMPLETE — 136 of 136 in-scope
topics, every phase at 100%, verified from `src/data/progress.js` on 2026-08-17
(no phase carries `pagesPlanned` any more).** Lane D was the last one open and
closed the same day.

**So if the user says "typescript" with any letter — a, b, c or d — the answer is
that the lane and the language are finished.** Do not invent work in any phase.
The remaining TypeScript work, if the user wants more, is a **new instruction**:
reopening a dropped phase (8, 9, 11 — nothing was ever written in them), or a
review/depth pass over what exists.

*"pick typescript a"* · *"typescript c"* · *"TS d"* · *"take b"* — all mean the
same thing. **No plan, no confirmation, no clarifying question.** Read your row,
claim it in the two boards, start writing at the topic named.

| Lane | Scope — directories you may touch | Left | **START AT** | Held by |
|---|---|---|---|---|
| **A** | `phase-5-type-level/` | ✅ **0 — PHASE 5 COMPLETE 16/16** (65 files, 14,031 lines, 0 over cap, 2026-08-17) | — nothing queued; if the user says *"typescript a"*, say the lane is finished and let them pick | session `65de22b3` |
| **B** | `phase-10-strictness/` **and** `phase-12-tooling/` | 🏁 **0** | 🏁🏁 **LANE B IS COMPLETE** — phase 10 at 13/13 **and** phase 12 at 15/15. Nothing queued; if the user says *"typescript b"*, say it is done and let them choose | closed by session `c01e37bb`, 2026-08-17 |
| **C** | `phase-6-modules-build/` — topics **01–06** only | ✅ **0 — COMPLETE 6/6** | — nothing queued; if the user says "typescript c", say it is done and let them pick | session `f4392a13`, 2026-08-17 (finished it; took over from `5ff47a9c`) |
| **D** | `phase-6-modules-build/` — topics **07–16** only | 🏁 **0** | 🏁🏁 **LANE D IS COMPLETE — 10/10**, which closes **phase 6 at 16/16**. Nothing queued; if the user says *"typescript d"*, say it is done and let them choose. Detail: [[devbible-typescript-part-d]] | closed by session `e28ddf99`, 2026-08-17 (took over from `8dcc0095`) |

**A phase number settles it too:** 5 → A · 10 or 12 → B · 6 → **C or D, by topic
number** (01–06 = C, 07–16 = D). Only ask if the user says "TypeScript" with **no
letter and no phase**.

⛔ **Phases 0–4 and 7 are COMPLETE. Phases 8, 9 and 11 are DROPPED** (2026-08-15,
nothing was written). Do not open them.

## Why the split is where it is

**44 topics remain and they are not equal.** Topic counts hide a 5× difference,
so the lanes were balanced by **projected lines**, using per-tier averages
measured from work already written in this corpus — Master ≈1,100 · Understand
≈600 · Know ≈350 · When Needed ≈250.

| Lane | Topics | Tier mix | Projected lines |
|---|---|---|---|
| A | 9 | ~3U · ~6K | ~3,900 |
| **B** | 19 | 1M · 11U · 5K · 2W | **~9,950** |
| C | 6 | **3M** · 3U | ~5,100 |
| D | 10 | 7U · 3K | ~5,250 |

⚠️ **B is deliberately the largest** — it is the session that has been running
continuously, and the user chose this arrangement knowing it (2026-08-17). **If a
fifth session is ever wanted, phase 12 splits cleanly out of B** — its directory
does not exist yet, so it shares no file with phase 10.

🔴 **Phase 6 was the real imbalance, not B.** At 16 topics with **three Master
rows up front** it projected to ~10,350 lines — 43% of everything left, in one
unclaimed lane. Cutting after topic 06 gives 5,100 / 5,250, a delta of 150 lines,
and lands on a genuine concept boundary:

- **C = the module system and how the compiler sees files** (topics 01–06)
- **D = declarations, packaging and the build** (topics 07–16)

## ⚠️ C and D share one phase directory — the ownership rule

This is the **only** intra-phase split in devbible, accepted deliberately because
phase 6 was too heavy for one lane. The collision rules are therefore stricter
than usual:

| File | Rule |
|---|---|
| `phase-6-modules-build/README.md` | 🔴 **Whoever arrives first scaffolds it with the FULL 16-row table** (all rows, unwritten ones as plain text). After that, **each lane edits only its own rows** — C rows 01–06, D rows 07–16. Re-read the file immediately before every edit |
| `phase-6-modules-build/NN-topic*` | Your own topic numbers only. Never create or edit the other lane's |
| Phase directory `_category_.json` | **Do not create one.** Phases 0–5 use README frontmatter plus autogeneration. Only a *chunk* directory inside a topic gets one |

⛔ **Cross-lane links break the build.** Where your page needs a topic the other
lane owns, write it as **bold plain text with *(not written yet)*** — never a
link. Repoint it later only if you are the lane that owns the target.

## Shared board files — all four lanes

| File | Rule |
|---|---|
| `src/data/progress.js` | Your phase's row only, anchored on its **`slug:`**. Assert the match count is 1 before writing — a numeric pattern has matched two languages' rows before. ⚠️ **C and D share the `phase-6-modules-build` row** — re-read and take the higher number if it moved |
| `docs/typescript/pages/README.md` | Your phase's row, plus your own row in the claim notice |
| `docs/README.md` | ⚠️ **One shared TypeScript technology row that four sessions increment.** Re-read every single time; **merge onto the other lanes' edit, never overwrite it** |

**Never `git add -A`.** Expect other lanes' edits in `git status` and leave them.

## The rules every lane inherits

🔴 **300 lines is a FILE-SIZE cap and NEVER a content budget.** Write everything
the topic has — every gotcha, every pitfall, every worked example, every
interview question, with **no quota on any section** — without looking at the line
count. **Then** split on concept boundaries into `NN-topic/` chunks so no file
passes 300, and index the chunks from the topic `README.md`. A topic may run
1,000+ lines; that is normal for a Master row. **Never trim, reword or drop a
section to fit.** The tell you got it wrong: a run of files clustering just under
300, or every topic having about the same number of gotchas.

🔴 **No sandbox, no console blocks.** Validate against the TypeScript handbook,
the `tsconfig` reference and the release notes, and **name the source in each
page's `> Verified:` line**. Never reconstruct compiler output from memory.

🔴 **Read the compiler's own tables instead of recalling diagnostics** — the
technique that has produced every non-obvious find in this corpus:

```bash
# option record — settles a flag's default AND whether `strict` enables it
grep -n -A14 'name: "<option>"' sandbox/ts-p0/node_modules/typescript5/lib/typescript.js
# code -> message text
grep -o '_2578", "[^"]*"' sandbox/ts-p0/node_modules/typescript5/lib/typescript.js
# cross-check against the 7.0.2 Go binary — NOTE the bounded -oE form
timeout 110 strings -n 20 sandbox/ts-p0/node_modules/@typescript/typescript-linux-x64/lib/tsc \
  | grep -oE ".{0,60}<needle>.{0,190}" | sort -u
```

⚠️ `grep -F` on the 7.0.2 binary returns one ~125 KB line (its string table has no
newlines) and a `[^"]\{0,180\}` pattern exceeds ugrep's complexity limit. The
bounded `-oE` form above is what works.

🔴 **Cadence: per file.** Write a file → update the four boards → commit → update
the memory. **Run to completion; do not stop to ask between topics.**

⚠️ **`git commit` needs `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars** — there is
no readable `user.*` config. Use `git commit -F - -- <your paths>` with a quoted
heredoc; backticks in `-m` get command-substituted.

## Verify without a build

⚠️ **Rule 12 applies — do not run `yarn build` without claiming the registry**
(`shared/session_build_devserver_registry.md`). This needs no claim and is what
every lane has been using:

```bash
cd /mnt/Storage/Backup/Knowledge/devbible && python3 - <<'EOF'
import os,re,glob
bad=0; tot=0
for p in glob.glob('docs/typescript/**/*.md', recursive=True):
    d=os.path.dirname(p)
    for m in re.finditer(r'\]\(([^)]+\.md)\)', open(p,encoding='utf-8').read()):
        t=m.group(1)
        if t.startswith(('http','#')): continue
        tot+=1
        if not os.path.isfile(os.path.normpath(os.path.join(d,t.split('#')[0]))):
            print('BROKEN',p,'->',t); bad+=1
print(tot,'links,',bad,'broken')
EOF
find docs/typescript/pages -name '*.md' | xargs wc -l | awk '$2!="total" && $1>300'
```

⚠️ **Attribute a break before investigating it.** Another lane mid-write produces
breaks that are not yours; check the path prefix against your scope.

## Per-lane detail

- **A** — [[devbible-typescript-build-progress]] (conventions, traps, phase 5
  cursor)
- **B** — [[devbible-typescript-part-b]] (phase 10 at 9/13, the phase-10 concept
  record, and the debts topics 10–13 owe)
- **C** — [[devbible-typescript-part-c]] (cursor, the compiler-source finds, what is already fetched)
- **D** — worklist below; conventions from
  [[devbible-typescript-build-progress]]

### Phase 6 worklist — the full 16, with tiers and the C/D line

| # | Topic | Tier | Lane |
|---|---|---|---|
| 01 | `module` and `moduleResolution` | **Master** | **C** |
| 02 | `import type` / `export type` and `verbatimModuleSyntax` | **Master** | **C** |
| 03 | Path aliases — `paths` | **Master** | **C** |
| 04 | `lib`, `target` and the ambient environment | Understand | **C** |
| 05 | `isolatedModules` | Understand | **C** |
| 06 | File extensions — `.ts`/`.mts`/`.cts`/`.d.ts` | Understand | **C** |
| 07 | Authoring `.d.ts` files | Understand | **D** |
| 08 | Typing an untyped dependency | Understand | **D** |
| 09 | `esModuleInterop` and default imports | Understand | **D** |
| 10 | `skipLibCheck` | Understand | **D** |
| 11 | Publishing a typed package | Understand | **D** |
| 12 | Sharing types across a monorepo | Understand | **D** |
| 13 | Project references and `tsc -b` | Know | **D** |
| 14 | Incremental builds | Know | **D** |
| 15 | `isolatedDeclarations` | Understand | **D** |
| 16 | Typing non-code imports | Know | **D** |

The worklist source is the phase-6 table in
`docs/typescript/syllabus/02-types-at-scale.md`, in row order.

### 🔴 Material phase 6 inherits from work already written

**Do not re-derive these. Link to them, or use them.**

1. **`isolatedDeclarations` (topic 15, lane D)** — the mixin factory pattern is
   **unbuildable** under the flag, with two diagnostics aimed at it:
   `TS9021` *"Extends clause can't contain an expression with
   `--isolatedDeclarations`."* and `TS9022` *"Inference from class expressions is
   not supported with `--isolatedDeclarations`."* Both are already quoted in
   `phase-4-classes-declarations/14-mixins/05-the-cost-in-the-build.md`, which
   **forward-links to phase 6 as bold plain text**. 🔴 **D repoints that link when
   topic 15 lands.**
2. **`skipLibCheck` (topic 10, lane D)** — phase 7 owns the *correctness* trade
   (`phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md`)
   and **phase 12 (lane B) owns the *performance* framing**. Topic 10 is the
   general rule; link both, restate neither. ⚠️ Also settled already in
   `phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md`:
   **`skipLibCheck` is NOT a suppression mechanism** — it skips checking *inside*
   `.d.ts` files and cannot affect assignability at your call sites, though it
   keeps being proposed as a fix for errors it cannot touch.
3. **`module: nodenext`, `verbatimModuleSyntax`, `allowImportingTsExtensions`,
   `rewriteRelativeImportExtensions` and the `TS5096` 5.9→7.0 wording change**
   are all argued on a real server in
   `phase-7-server/01-tsconfig-for-a-node-service/` chunks 01, 02 and 05. **C's
   topics 01 and 02 own the general rule; that page owns the applied case.**
4. **Sweep the forward references at every topic close:**

```bash
grep -rn "not written yet" docs/typescript/pages/ | grep -iE "phase 6|module|isolatedDeclarations|\.d\.ts"
```

- 🔴 **D** — [[devbible-typescript-part-d]]: the topic-07 record, every
  diagnostic banked, which handbook pages are already fetched, and the traps

## Board state — refreshed 2026-08-17, disk-measured

| Phase | Topics | Written | Lane |
|---|---|---|---|
| 0–4 | 71 | 🏁 ✅ 71 | — complete |
| 5 · Type-level programming | 16 | 🏁 **16** (65 files, 14,031 lines) | **A** — closed |
| 6 · Modules, declarations and the build | 16 | 🏁 **16** — C 6/6 (49 files, 10,040 lines) + D 10/10 (67 files, 14,872 lines) = **116 files, 24,912 lines** | **C + D** — both closed |
| 7 · TypeScript on the server | 5 | 🏁 ✅ 5 | — complete (cut to Master rows) |
| 10 · Strictness and correctness | 13 | 🏁 **13** | **B** — closed |
| 12 · Tooling, performance and testing | 15 | 🏁 **15** | **B** — closed |

🏁 **136 of 136 in-scope topics written (100%). 0 left.**

✅ **All four directories now exist and every phase is closed.** Corpus-wide at
the close: **0 files over the 300-line cap**, **0 broken links of 3,240**.
⚠️ Verified by filesystem link-check and `wc -l`, **not by a build** — rule 12,
no registry claim was taken.

Related: [[devbible-typescript-part-b]] · [[devbible-typescript-build-progress]] ·
[[devbible-typescript-syllabus]] · [[devbible-typescript-concepts-phase10]] ·
[[devbible-never-compress-to-fit-cap]]
