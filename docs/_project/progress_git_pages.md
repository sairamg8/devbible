---
name: devbible-git-pages
description: Live per-file progress for the Git explanation pages — the 2026-08-14 re-scope to 52 daily-driver topics, what is written, and what is next
metadata:
  type: progress
---

# Git pages — live progress

Updated **after every completed file and every completed phase**
([[devbible-memory-update-cadence]]). Syllabus and the measured version facts:
[[devbible-git-syllabus]].

## 🔴 LOCKED to session `45e775dc`, 2026-08-14

*"There was git course yet to complete the explanations can you pick it up ? and
lock it in ?"* — Git is now a **live lock** in `~/.claude/CLAUDE.md` rule 11
(§11d), alongside Express and JavaScript. `docs/git/` only, on `main` in the
shared checkout, no worktree. Claim row added to `docs/README.md` and mirrored in
`docs/git/pages/README.md`. Cadence tightened to **per file**. Full order:
[[devbible-git-only-20260814]].

## Standing instruction — do not wait for approval

Given repeatedly on **2026-08-13**, and re-confirmed when I paused to report:
*"Do not wait for me i am stepping outside finish git"*, *"Do not wait for me you
complete the whole"*, *"Continue i am stepping outside"*, and finally
*"Then do not wait … thats what i am told previously right?"*.

**For the Git corpus, the syllabus-then-approve gate does not apply.** Work
straight through phase after phase without stopping to ask, checkpointing memory
per file and per phase ([[devbible-memory-update-cadence]]). This is a
**Git-specific** override of [[devbible-incremental-scope]] — it was given for
this corpus, not as a general change to the working agreement.

Two things still narrow it:

1. **Focus is Git only.** *"Focus on git level content and build issues incase.
   Do not focus on other."* Other corpora's broken links and MDX errors are
   theirs to fix ([[devbible-parallel-sessions]]).
2. **The never-invent-output rule is not waived by it.** "Do not wait" means do
   not pause for approval; it does not mean write unmeasured console blocks. The
   `filter-repo`/`git-lfs` question below is still a real blocker for phases 5,
   7 and 11.

## State

| | |
|---|---|
| Syllabus | 🔴 **RE-SCOPED 2026-08-14 — 191 topics cut to 52.** See below |
| Topics written | ✅ **52 of 52 — COMPLETE** (70 files, 12,485 lines) |
| Current phase | ✅ **ALL FIVE IN-SCOPE PHASES COMPLETE** — 0, 1, 2, 4, 5 |
| Last commit | `8040378` — phase 5 complete, claim released |
| **Next unit** | — **nothing. The daily-driver scope is finished and the claim is released.** |
| Remaining | Only the **parked** phases: 3, 6, and 7–12. Reopening them needs a new instruction |

## 🔴 THE RE-SCOPE — read this before writing anything

Mid-session on **2026-08-14** the user cut the corpus:

> *"I just need to know about the git to work daily tasks not more than that"*

and, asked how far to cut, chose **the minimal option** from three offered, plus
**"practical depth, no interview sections"** for the depth question. The full
191-topic reference shape was explicitly declined, as was a middle ~92-topic option.

**In scope — 5 phases, 52 topics:**

| Phase | Topics | Note |
|---|---|---|
| 0 · How Git stores things | 14 | Already written; kept because it is why the daily commands make sense |
| 1 · The everyday loop | 12 | Was 16 |
| 2 · Branching, merging, rebasing | 10 | Was 17 |
| 4 · Remotes and syncing | 8 | Was 16 |
| 5 · Undo, recover and rewrite | 8 | Was 16 |

**Parked — do NOT write:** phase 3 (reading history in depth — bisect, blame,
pickaxe), phase 6 (team workflow and review), and Parts 3 and 4 entirely (7
fullstack repo, 8 hooks/CI, 9 speed and scale, 10 plumbing, 11 history surgery,
12 the error catalogue).

⚠️ **The parked rows were NOT deleted.** They are still in
`docs/git/syllabus/0{1..4}-*.md` under `:::warning` banners, and each in-scope
phase carries a `:::info In scope` box naming its exact kept topics in order.
**That box is the worklist** — read it, do not re-derive the subset.

**Depth format changed too.** Topics 01 and 02 were written before the re-scope
and carry Interview-questions sections; **topics 03 onward drop that block** and
keep thesis → mechanism → tables → Gotchas → Trade-off where it earns its place.
The existing two were deliberately **not** stripped — the content is already paid
for, and the phase README says which format each follows.

### Phase 1's twelve, in order

01 `status` ✅ · 02 `add` ✅ · 03 `commit` ✅ · 04 `diff` ✅ · 05 `.gitignore` ✅ ·
06 ignoring-does-not-untrack ✅ · 07 `switch`/`restore` ✅ · 08 undo before you push ✅ ·
09 `log` everyday ✅ · 10 commit messages ✅ · 11 `stash` ✅ · 12 removing and moving ✅

**Phase 1 is COMPLETE: 12 topics, 19 files, 4,113 lines.** Phase 2's directory should
be `phase-2-branching-merging` — the slug is already declared in `src/data/progress.js`.

## Phase 1 — page by page

Directory is **`docs/git/pages/phase-1-everyday-loop/`** — matching the slug
already declared in `src/data/progress.js`, not the longer
`phase-1-the-everyday-loop` it was first created as. Check that file before
naming a phase directory; the slugs for all 13 phases were written in 2026-08-13
and phases 2–12 are pre-named there too.

| # | Topic | Files | Lines | Status |
|---|---|---|---|---|
| 01 | `git status` | `01-git-status/` — README + 4 chunks | 66 · 278 · 250 · 244 · 268 = **1,106** | ✅ written |
| 02 | `git add` | `02-git-add/` — README + 3 chunks | 51 · 243 · 235 · 258 = **787** | ✅ written |
| 03 | `git commit` | `03-git-commit.md` | **227** | ✅ written |
| 04 | `git diff` | `04-git-diff.md` | **225** | ✅ written |
| 05 | `.gitignore` | `05-gitignore.md` | **238** | ✅ written |
| 06 | Ignoring ≠ untracking | `06-ignoring-does-not-untrack.md` | **179** | ✅ written |
| 07 | switch and restore | `07-switch-and-restore.md` | **225** | ✅ written |
| 08 | Undo before you push | `08-undo-before-you-push.md` | **206** | ✅ written |
| 09 | `git log` | `09-git-log.md` | **191** | ✅ written |
| 10 | Commit messages | `10-commit-messages.md` | **224** | ✅ written |
| 11 | `git stash` | `11-git-stash.md` | **199** | ✅ written |
| 12 | `rm`, `mv`, `clean` | `12-removing-and-moving.md` | **213** | ✅ written |

**Topics 03 and 04 are single files, not directories** — the practical format
(no interview block) lands a Master topic at ~225 lines, comfortably inside the
cap. Only 01 and 02, written before the re-scope, needed chunking.

Topic 02's planned **fourth chunk was dropped by the re-scope** — `--renormalize`,
`--chmod`, `--sparse` and the `-i` menu are not daily work. `-i` is summarised
inside the patch-mode chunk instead.

**Sources that made topic 01 possible without a sandbox**, and that phases 2, 4
and 5 should reuse:

1. **`man git-<cmd>`** on 2.55.0 — far richer than the web docs for `status`:
   the OUTPUT section carries the full XY table, and **BACKGROUND REFRESH** and
   **UNTRACKED FILES AND PERFORMANCE** are whole sections most tutorials never
   mention (`status` writes the index by default, hence
   `git --no-optional-locks status`; the untracked cache lives *inside*
   `.git/index`).
2. 🔴 **`strings $(command -v git)`** — the exact message strings Git ships,
   pulled from the installed binary. This is how the hint lines, the three
   different `nothing to commit` messages and the eleven "You are currently…"
   in-progress states were quoted **without inventing any of them**. It is a real
   source, not a reconstruction, and it is the single most useful trick found so
   far for writing Git pages under the no-sandbox rule.

**Layout decisions made here, to keep the rest of the phase consistent:**

- A Master topic becomes a `NN-topic/` directory with `_category_.json`, a
  `README.md` index and `NN-chunk.md` parts. Topic 01 needed four chunks; the
  first draft of chunk 02 hit **350 lines** and was split at the human/machine
  boundary rather than trimmed.
- **Forward links to unwritten topics are written as plain text**, not links —
  `git add` (topic 02), not `[git add](../02-git-add/README.md)`. They become
  links when the target exists. This keeps the link check at zero.
- 🔴 **MDX cannot parse a bare `{a, b, c}` in prose** — acorn reads the braces as a
  JavaScript expression and the build fails with *"Could not parse expression with
  acorn"*. Hit on topic 08 writing "a subset of \{HEAD, index, working tree\}". Inside
  backticks is fine; in running prose, reword. `mdx-check.mjs` catches it in seconds,
  so run it before every commit.
- Every page's `> Verified:` line says **documentation-validated** or
  **sandbox-proven**, and `docs/git/pages/README.md` now explains the two.

### 🔴 The `ex3` plan below is DEAD — do not write it

This section used to say Phase 1 *"needs a new
`sandbox/git-p0/ex3-everyday-loop.sh` **before** any page is written"*.
[[devbible-no-new-sandbox-scripts]] landed after that and **closed sandboxing**.
The list is kept only as the **coverage checklist for Phase 1**, now validated
against `git help <cmd>` and git-scm.com instead of measured:

status (long and `--short` two-column codes) · `add` paths/`-A`/`-u`/`-p` ·
`commit` and `--amend` (the hash changes) · the three `diff` pairings ·
`.gitignore` pattern precedence, negation limits and `check-ignore -v` ·
ignoring-does-not-untrack + `rm --cached` · `switch`/`restore` versus old
`checkout` · the `restore`/`reset --soft|--mixed|--hard` effect table across the
three trees · `log --oneline --graph --decorate` · `stash` save/apply/pop/`-u`
and a pop conflict · the tracked/untracked/ignored state machine · `rm`, `mv`
and rename detection (delete+add until similarity finds it) · `clean -n` before
`-fd`, and `-x` removing ignored files.

**What Phase 1 may still show as measured output:** only what the recorded
`ex2-output.txt` already contains — §3 and §4 cover the `??` / `A ` / `AM`
short-status codes and the `git diff` vs `git diff --staged` pairing. Everything
else is a command shown as a command, with the behaviour in prose.
| Sandbox | `sandbox/git-p0/` — `ex1-version-facts.sh`, `ex2-object-model.sh` (+ `.txt` outputs) |

## Phase 0 — page by page

| # | File | Lines | Script | Status |
|---|---|---|---|---|
| 01 | `01-what-git-is.md` | 191 | ex1, ex2 §1,2,7,8 | ✅ written |
| 02 | `02-commit-is-a-snapshot.md` | 182 | ex2 §5,11 | ✅ written |
| 03 | `03-object-types.md` | 195 | ex2 §5,6 | ✅ written |
| 04 | `04-three-trees.md` | 166 | ex2 §3,4 | ✅ written |
| 05 | `05-the-index.md` | 166 | ex2 §3,4,10 | ✅ written |
| 06 | `06-refs-and-head.md` | 177 | ex2 §7,8 + ex1 §5 | ✅ written |
| 07 | `07-commit-graph.md` | 161 | ex2 §9 | ✅ written |
| 08 | `08-config-layers.md` | 155 | ex2 §12 + ex1 §7 | ✅ written |
| 09 | `09-git-directory-tour.md` | 151 | ex2 §10 | ✅ written |
| 10 | `10-identity-setup.md` | 184 | ex1 §4,7,10 | ✅ written |
| 11 | `11-loose-objects-and-packfiles.md` | 174 | ex2 §11 | ✅ written |
| 12 | `12-what-git-is-not.md` | ~180 | ex2 §11 + ex1 §10 | ✅ written |
| 13 | `13-object-format.md` | ~150 | ex1 §6 | ✅ written |
| 14 | `14-plumbing-vs-porcelain.md` | ~170 | ex1 §2, ex2 §13 | ✅ written |
| — | `README.md` (phase index) | 76 | — | ✅ written |
| — | `docs/git/pages/README.md` | 60 | — | ✅ written |

**All 14 under the 300-line cap** (range 151–195, median ~174 — genuinely varied,
not clustered at the cap). `src/data/progress.js` git phase 0 set to `pages: 14`;
`docs/README.md` Git row updated to "in progress (phase 0 done)".

## Build state — BLOCKED BY ANOTHER SESSION, not by Git

**Four** clean rebuilds on 2026-08-13 after phase 0 landed **failed with
`exit=1`**, every time on the same file (retried over ~20 minutes):

```
Error: MDX compilation failed for file
"…/docs/react/pages/phase-0-how-react-runs/02-the-element.md"
Cause: Could not parse expression with acorn
```

That is the **React** session's in-progress page, plus knock-on
`Cannot find module '@site/.docusaurus/…react-pages…/…typescript-…'` errors.
**Nothing Git-related appears in either log** — `grep -i "docs/git"` over the
warnings is empty — but the build aborts before emitting HTML, so the Git routes
could not be re-verified on those runs.

**Do not fix it** (user instruction, [[devbible-parallel-sessions]]). One
mid-write `grep` made it look fixed — the log was still being written, and the
same failure was there at the end. **Check the tail, not a grep count, on a log
that is still growing.** Re-run later:

```bash
rm -rf .docusaurus build node_modules/.cache && yarn build 2>&1 | tee /tmp/b.log
grep -iE 'warning|broken' /tmp/b.log | grep -i "docs/git"   # empty = git clean
find build/docs/git -name '*.html' | wc -l                  # expect 20
```

Expected Git routes: 1 overview + 4 syllabus parts + 1 pages README + 1 phase
README + 14 pages = **20 HTML pages**. The **syllabus-only build earlier the same
day succeeded** (737 HTML pages, all 5 Git routes present, zero Git warnings), so
the wiring itself is known good.

### The workaround — verify the Git corpus without a full build

`sandbox/git-p0/mdx-check.mjs` compiles every `docs/git/**/*.md` with the site's
own `@mdx-js/mdx`, so the Git pages can be validated while another corpus blocks
`yarn build`:

```console
$ node sandbox/git-p0/mdx-check.mjs
checked 21 git files, 0 failed
```

21 files = 1 syllabus overview + 4 parts + `pages/README.md` + the phase README +
14 pages. **This proves MDX-parse validity only** — it does not check links, so a
real clean rebuild is still owed once the React file is fixed.

## Measured facts the pages are built on

Beyond the version facts in [[devbible-git-syllabus]], `ex2` established:

- **The object name is `sha1("blob 6\0hello\n")` = `ce013625…`** — reproduced with
  plain `sha1sum`, no Git involved. Filename is not part of the hash, so two
  identical files are one object.
- `hash-object` **without `-w` writes nothing** — `cat-file` then fails with
  `fatal: git cat-file: could not get object info`.
- **A branch is 41 bytes** (`wc -c .git/refs/heads/feature/pricing`) and creates
  **zero objects** — the object count stayed at 8.
- **`AM` in `git status --short`**: editing a file after `git add` leaves the old
  content staged and the new content unstaged, simultaneously.
- Object-type census via `cat-file --batch-all-objects`: 3 blob / 2 tree /
  1 commit, and **an annotated tag adds a 4th type** while a lightweight one does
  not.
- **A commit dated 2030 is still a child of its 2026 parent** — `log --reverse`
  prints ancestry order, proving dates do not define ordering.
- **51 loose objects → 2 packfiles** after `git gc`; `.git/objects` 204K → 36K;
  `count-objects -vH` reports `in-pack: 51, packs: 2` (the second is the cruft
  pack, it has a `.mtimes` file).
- A commit built entirely with plumbing (`hash-object`/`mktree`/`commit-tree`)
  is a real commit reachable from no branch.

## Verifying the Git corpus without a full build

`node sandbox/git-p0/mdx-check.mjs` still works and now reports **27 git files,
0 failed**. Links are checked with a throwaway one-liner rather than a committed
script (no new sandbox artifacts):

```bash
python3 - <<'EOF'
import re, pathlib
root = pathlib.Path('docs/git'); bad = 0
for f in root.rglob('*.md'):
    for m in re.finditer(r'\]\((?!https?:|#)([^)]+)\)', f.read_text()):
        t = m.group(1).split('#')[0]
        if not t: continue
        if not (f.parent / t).resolve().exists():
            print("BROKEN", f, "->", t); bad += 1
print("broken:", bad)
EOF
```

**0 broken as of `fc1cf04`.**

## Traps hit

- **`cd` in the sandbox persisted across Bash calls** — a `mkdir -p docs/git/pages`
  created `sandbox/git-p0/docs/...`. Removed. Use absolute paths, or `cd` to the
  project root in the same command.

Related: [[devbible-git-syllabus]] · [[devbible-memory-update-cadence]] ·
[[devbible-parallel-sessions]]


## Phase 2 — complete

`docs/git/pages/phase-2-branching-merging/`, **10 topics / 11 files / 1,953
lines**, all single files (152–227). Order written: branch-as-pointer,
fast-forward vs merge, three-way merge, resolving conflicts, rebase, rebase vs
merge, interactive rebase, the golden rule, reflog, aborting cleanly.

Seven original phase-2 rows are parked and folded rather than dropped silently —
cherry-pick, merge strategies/`-X`, detached HEAD, long-lived branch maintenance,
`rerere`, `rebase.updateRefs`, `git replay`. `rerere` and `updateRefs` are
introduced inside topics 04 and 05; detached HEAD inside topic 01. The phase
README says so explicitly.

**The phase argues for four config settings** and they are worth reusing as a
through-line in phases 4 and 5: `merge.conflictStyle=zdiff3`,
`rerere.enabled=true`, `pull.ff=only`, `rebase.autosquash=true`.


## Phase 4 — complete

`docs/git/pages/phase-4-remotes/`, **8 topics / 9 files / 1,428 lines**. Eight
original rows parked: refspecs in full, fork-and-upstream flow, shallow clone,
partial clone, signing, bare/mirror repos, `git bundle`; pruning folded into
topic 03, the fork settings into topic 04.

🔴 **The through-line worth reusing in phase 5:** every number Git prints about a
remote is computed from a **local cache** refreshed only by `fetch`. `status`,
`log`, `diff` and the ahead/behind counts never touch the network, and there is no
staleness indicator.

**Config the phase argues for:** `pull.ff=only`, `fetch.prune=true`,
`push.autoSetupRemote=true`, `push.default=simple`, and an alias for
`push --force-with-lease --force-if-includes` (there is no config that makes
`--force` safe).


## Phase 5 — COMPLETE (8 topics, 9 files, 1,344 lines)

`docs/git/pages/phase-5-undo-recover/`: 01 the undo decision table · 02 `reset` in
depth · 03 `revert` · 04 reflog recovery and the expiry clock · 05 rewriting your
own commits · 06 recovering a deleted branch · 07 undoing a merge. 08 undoing something already pushed. ✅ All written.

🔴 **The two claims this phase is built on**, both worth reusing:

1. **The recoverability ladder** — committed ✅ (reflog) > stashed ✅ > staged ⚠️
   (`fsck --lost-found` finds the blob) > **working tree only ❌ nothing has a
   copy**. "Git never loses anything" protects the wrong noun; what people lose is
   uncommitted.
2. **The clock is real and short.** `gc.reflogExpire` 90 days, `gc.reflogExpireUnreachable`
   **30 days**, `gc.pruneExpire` **two weeks** for loose objects — and `gc.auto`
   fires during ordinary work. An orphaned commit is reliably recoverable for
   roughly two weeks to a month, not forever. ⚠️ `git gc --prune=now` and
   `git reflog expire --expire=now --all` destroy exactly that window and both
   appear in "clean up your repo" advice online.

⚠️ **Cadence slip, recorded 2026-08-14:** seven phase-5 files were written before
this memory update — the rhythm had drifted to per-phase instead of per-2–3-files,
and the user caught it. `~/.claude/CLAUDE.md` rule 9 now carries the drift note.


## ✅ FINISHED — final state, 2026-08-14

**52 of 52 in-scope topics. 70 files. 12,485 lines. 0 files over 300. 0 broken
links. MDX clean (70/70). Isolated build succeeds with 69 git HTML routes and
zero git warnings.**

| Phase | Topics | Files | Lines |
|---|---|---|---|
| 0 · How Git stores things | 14 | 16 | ~2,400 (sandbox-proven) |
| 1 · The everyday loop | 12 | 19 | 4,113 |
| 2 · Branching, merging, rebasing | 10 | 11 | 1,953 |
| 4 · Remotes and syncing | 8 | 9 | 1,428 |
| 5 · Undo, recover and rewrite | 8 | 9 | 1,344 |

**Claim released** in `docs/README.md` — Git is free for any session to pick up.
Reopening the parked phases (3 reading history, 6 team workflow, 7–12 repo
design / hooks / speed / plumbing / surgery / errors) needs a **new instruction**;
their syllabus rows are still there under `:::warning` banners.

### ⚠️ Build trap found at the very end

A first isolated build reported **one** git broken link —
`phase-4-remotes/02-fetch-vs-pull.md → 03-remote-tracking-branches.md` — for a
file that demonstrably existed and that the filesystem link checker passed. A
clean rebuild reported **zero**. The first build had been started while phase-5
files were still being written into the same tree, so Docusaurus read a partial
state. **Do not chase a single broken link from a build that overlapped a write —
rebuild first.** Related to, but distinct from, the parallel-sessions rule: this
was my own writes racing my own build.
