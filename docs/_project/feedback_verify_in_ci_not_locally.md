---
name: devbible-feedback-verify-in-ci-not-locally
description: Do NOT run a full `yarn build` locally to verify devbible work — commit, push, and read the result from GitHub Actions. Not because local cannot build (the OOM was Node's auto-sized default heap, not total RAM) but because debugging the same thing twice is waste. 🔴 UPDATED 2026-09-05 — onBrokenLinks is now 'throw', so CI DOES fail on link rot.
metadata:
  type: feedback
---

# 🔴 Verify devbible in GitHub Actions, not with a local full build

## 🔴 2026-09-06, session `11a770dc` — `throw` CLAIMED ITS FIRST VICTIM, and nobody noticed for two hours

**The Pages deploy was RED for two hours and nothing in the repo looked wrong.**

Runs [`34008305214`](https://github.com/sairamg8/devbible/actions/runs/34008305214) and
[`34008410251`](https://github.com/sairamg8/devbible/actions/runs/34008410251) — both Angular
Phase 0 commits — failed in **Build**. Cause: Angular topic `03-the-provider-array` chunks 01-04
carried **14 in-prose links to sibling chunks 05, 06, 10, 11, 12, 13, 15 and 17 that were never
written.** Under `'warn'` those were 14 lines of log nobody read. Under `'throw'` they are a
hard build failure.

### 🔴 The part worth remembering: a red devbible build is INVISIBLE

- The failing job is **`build`**. `deploy` is then **`skipped`, not failed** — so the workflow
  shows one X, not two, and no deployment is attempted.
- Because no deployment is attempted, **https://sairamg8.github.io/devbible/ keeps serving the
  last good version.** The site looks fine. It is simply frozen.
- Nothing in `git status`, `wc -l`, `mdxcheck.py` or a link scan of *your own topic* reports it.
  The three cheap checks all passed for Lane C — its links pointed at files it fully intended to
  write.
- ⚠️ **And this checkout is shared.** One lane's dangling link blocks the publish of **every
  other lane's** finished work, silently, until someone thinks to look at Actions.

**So: a devbible session that pushes must look at the run.** Not "assume green because the cheap
checks passed" — the cheap checks are per-directory and the build is global.

### What the breach actually was

The authoring contract already says it, in bold, twice: *"Anything you intend to write later is
**bold text plus *(not written yet)*** — and that includes your own later chunks, which is the
single most common thing a session gets wrong."* Lanes A and B obeyed it; Lane C did not. So this
is not a missing rule — it is a rule that needs a **check**, because the author is exactly the
person who believes the file is about to exist.

🔴 **The check, and it is cheap — run it in the topic directory before reporting:**

```bash
for f in *.md; do
  grep -o '](\([0-9][^)]*\.md\|\.\./[^)]*\.md\))' "$f" | sed 's/^](//; s/)$//' | sort -u |
  while read -r L; do [ -e "$L" ] || echo "DANGLING: $f -> $L"; done
done
```

It is now in `CURSOR-ANGULAR.md` too, per this file's own 2026-09-05 conclusion that a standing
order only works if it lives where a session already looks. Fixed in `70928c81`; all 14 demoted,
zero dangling links under `docs/angular/pages`, and they get promoted back in the coordinator pass.

**Design consequence, adopted the same day:** the Angular Phase 0 workflows make every parallel
chunk-writer emit a *placeholder* footer and give a dedicated **Wire** stage the job of building
the real chain from what is **on disk**. A writer is never allowed to link a sibling, because a
writer cannot know. See [[angular-phase-0-workflow-scripts]].


## 🔴 `throw` CLAIMED ITS SECOND VICTIM THE SAME DAY, 2026-09-06 06:12 — a DIFFERENT class

Run [`34015877866`](https://github.com/sairamg8/devbible/actions/runs/34015877866) went red three
hours after `70928c81` fixed the first one. **Not a regression — a second, unrelated defect class
that the class-1 check above cannot see.**

Angular topic `02-standalone-by-default`, chunks `06c` and `06e`, quoted angular.dev prose
**verbatim** — and the quote carried **the source page's own relative hrefs**:

```
- Broken link on source page path = .../02-standalone-by-default/06c-the-five-causes:
   -> linking to guide/directives
      (resolved as: /devbible/docs/angular/pages/.../standalone-by-default/guide/directives)
   -> linking to guide/templates/pipes
- Broken link on source page path = .../06e-the-commonmodule-anti-fix:
   -> linking to guide/templates/control-flow
```

On angular.dev `guide/directives` resolves against angular.dev. Pasted into our page, Docusaurus
resolves it against **our** URL and gets a path that has never existed. Fixed in `aa0284e3` by
making every href absolute: `https://angular.dev/guide/directives`.

### 🔴 The two classes look IDENTICAL in a build log and have OPPOSITE fixes

| Class | What it is | Fix | ⛔ The wrong fix |
|---|---|---|---|
| **1 — forward ref** | a link to **our own** chunk, not written yet | **de-link** to bold + *(not written yet)*, re-link when it lands | making it absolute — points at nothing |
| **2 — quoted href** | a link belonging to the **upstream docs** we quoted | make the href **absolute** to the upstream origin | de-linking — silently drops a real citation |

🔴 **Never repoint a quoted anchor at a local heading.** Inside a `> *"…"*` block, every
`](…)` and every bare `#anchor` belongs to the site being quoted — not to us. They log as two
different warnings (broken link, broken anchor) and are ONE defect with ONE fix.

### 🔴 THE PREFLIGHT — `yarn linkcheck`, per file, before you report it done

🔴 **2026-09-06 — the two ad-hoc greps are SUPERSEDED by a script in the repo.**
Both classes are now gated by one slug-aware checker, `scripts/linkcheck.mjs`:

```bash
yarn linkcheck                  # whole corpus
yarn linkcheck docs/angular     # one track, or any topic directory
```

It exits 1, names the class and prints the correct fix for that class. Run it **per file**,
before reporting the file done — the same cadence as the cap and MDX checks.

🔴 **Why a naive filesystem check does NOT work, and why the old one was ignored.**
Docusaurus strips a leading `NN-` ordering prefix from every path segment, so `04-allowlists/`
is served at `allowlists/`. A plain `fs.existsSync()` reports **122 false positives** on this
corpus — this is the recorded reason `devbible-linkcheck.py` "disagreed with" the build log.
`linkcheck.mjs` matches on the stripped name, and returns **0** corpus-wide (6,880 files),
which is what a green CI run means.

**Regression-tested against both real failures**: re-injecting `b5c66106`'s `06e` and
`70928c81^`'s provider-array chunk 01 makes it flag `guide/templates/control-flow` as CLASS-2
and `17-the-server-config-merge.md`, `13-order-dependence.md`, `06-…`, `12-…`, `15-…` as
CLASS-1.

## 🔴 BROKEN AGAIN 2026-09-05, session `d2e9b9fe` — and here is why this file did not stop me

**Four local builds in one session.** Stale-cache failure → `yarn clear` → OOM at the default
heap → `--max-old-space-size=8192` (grew to **9.8 GB RSS with 2.7 GB free**, killed to protect the
machine) → `4096` (ran 32 minutes, **7 GB of swap**, CPU frozen at 5:00 while thrashing, killed).
**Zero information gained.** The cheap checks had already reported 949 links resolving, 0 MDX
hazards, 0 cap violations and 0 position collisions — which is everything the build would have
told me, since `onBrokenLinks` was `'warn'` **on that date**. ⚠️ **It is `'throw'` now** — the
cheap checks no longer cover the build, which is why `yarn linkcheck` exists.

⚠️ **The 2026-09-04 entry below predicted this exact sequence — OOM, then retry with a bigger
heap — and I still did it.** So the interesting question is not what the rule is; it is why the
file did not reach me.

🔴 **Because I never opened it.** The devbible SessionStart hook names `LOCKS.md`, the cursor and
the two skills. It does not name any `feedback_*.md`, and `INDEX.md` was opened only to *add* a
row. A session can therefore do everything the hook asks — read the lock, read the cursor, load
the skill, read all three references — and never encounter a standing user instruction that lives
in a feedback file.

**The fix that would actually work:** the standing order belongs where a session already looks.
🔴 **`CURSOR-NEXTJS.md` and `LOCKS.md` should carry a one-line "no local `yarn build` — push and
watch Actions" next to the cadence line**, because those two files ARE read, every session, by
instruction. A feedback file that only the diligent find is a feedback file that gets broken.

**The tell I ignored, in my own reasoning:** I noticed `memory_build_memory_tuning.md` existed and
read it *for knobs to make the local build succeed* — treating the memory as build tuning rather
than asking whether the build should run locally at all. **A memory about how to do X is not
permission to do X.**

## ⚠️ Reinforced 2026-09-04 — and I had just broken it

Said again, unprompted, in session `cb25d15f`:

> *"remember all the time commit everything and deploy monitor build in github it would
> save much ram"*

**"All the time" is the operative phrase — this is not a per-incident preference, it is the
default.** It was given because I had just done exactly what this file forbids: a local
`yarn build` OOM'd (exit 129, `Reached heap limit`, before any page compiled), and I started
a **second** local build with `--max-old-space-size=8192` rather than pushing. That second
build passed and told me nothing the cheap checks and CI would not have.

🔴 **The user's stated reason is RAM pressure on this machine**, which the ladder above
explains mechanically: Node sizes its heap from memory free *at process start*, and this
checkout has several Claude sessions live at once, so a local build both fails
unpredictably and starves the sessions that are writing. Pushing costs nothing local.

**The order of operations, every time, with no local full build in it:**
cheap local checks → `git add <explicit paths>` → commit → push → watch the Actions run.


**Said by the user 2026-09-03**, after a local `yarn build` died on an out-of-memory error
and a session started a second local build with a bigger heap:

> *"Rather than running full run build in local commit everything and push monitor changes
> in github actions there plenty available and doing debug same as local and git hub actions
> for this"*

**The standing order: commit → push → watch the Actions run.** Do not spend local wall-clock
on a full site build, and do not debug the same failure in two places.

## Why

🔴 **Not because a local build is impossible — because debugging it twice is waste.**
That distinction was got wrong on the first write of this memory and corrected the same day
when the user pushed back (*"So your saying github actions also have 14gb and it was same as
local ?"*). The numbers, checked rather than assumed:

| | RAM | Disk |
|---|---|---|
| `ubuntu-latest`, **public** repo (devbible is public) | **16 GB**, 4 CPU | 14 GB SSD |
| This machine | 15.3 GB total, **10.9 GB available** (4.3 GB already held) | — |

⚠️ **The "14 GB" in GitHub's runner spec is the SSD, not the RAM** — and it collides with
this laptop's ~15 GB of RAM, which is exactly how the two got conflated.

**The OOM was not about total RAM.** Node sizes its default old-space heap from memory
available *at process start*:

```bash
node -e "console.log(require('v8').getHeapStatistics().heap_size_limit/1048576)"
# 2240   ← on node v24.20.0, with 4.3 GB already in use
```

**2.2 GB is the ceiling the build hit**, not 10.9 GB. Part of that 4.3 GB is the other Claude
sessions in this shared checkout, so the local heap ceiling varies with how many sessions are
live. On a fresh 16 GB runner Node computes a far larger default.

So `NODE_OPTIONS=--max-old-space-size=9216 yarn build` would very likely succeed locally.
**The instruction is not "local cannot build" — it is "do not spend local wall-clock and a
second debugging pass on a check CI already runs free on every push."** ~5–10 minutes of
local build, twice, to learn what a push tells you in ~4–7 minutes while you keep working.

**CI is already wired for it.** `.github/workflows/deploy.yml` fires on any push to `main`,
runs `yarn build` on `ubuntu-latest`, and deploys to Pages — **the merge is the deploy**.

## How to do it

```bash
git add <explicit paths>        # 🔴 never `git add -A`, sessions share this checkout
git commit -m "..."
git push origin main
gh run list --limit 3           # grab the run id
```

Then **arm a watch instead of polling** — `Monitor` with a poll loop that emits each
completed job and exits on the terminal status, so the result arrives as a notification while
you keep working:

```bash
gh run view <id> --json status,conclusion,jobs
```

Read failures with `gh run view <id> --log-failed`.

## What the workflow actually checks — 🔴 CHANGED 2026-09-05

✅ **`onBrokenLinks` is now `'throw'`** (`243aa45f`, on the user's instruction *"flip
onBrokenLinks to throw"*). **A broken link now FAILS the build — and since the merge is the
deploy, it blocks the deploy.** Proven green on run `33961285016`, build and deploy both success.

**Why it could be flipped:** run `33960724317` was the first build to report **zero** broken
links, which is what `deploy.yml`'s comment had been waiting for. ⚠️ **That comment is now moot**
— delete it next time you are in that file.

⚠️ **The *Report broken links* step is now a DIAGNOSTIC, not a gate.** With `throw` the build
aborts on the first broken link, so `build.log` will not contain a full list. The step still runs
(`if: always()`) and still summarises whatever reached the log.

⚠️ **`onBrokenMarkdownLinks` is still `'warn'`** — deliberately left, because it is a different
check (markdown link resolution, not route links) and should be flipped on its own evidence.

**Still keep the local filesystem link check.** It is cheap, it catches the problem *before* a red
CI run rather than after, and it is the only thing that works while you are mid-chapter with
forward references not yet written.

### The historical reason this mattered

The 17 unresolved warnings fixed on 2026-09-05 all sat inside verbatim `> *"…"*` quotes of
nextjs.org **carrying the SOURCE page's relative hrefs**, so they resolved against devbible and
404'd. **Invisible to every local check, and at `'warn'`, invisible in CI too** — which is how they
survived for weeks. That class is exactly what `throw` catches.

## What still belongs locally

The cheap, targeted checks — they cost seconds and CI will not do them for you:

- `wc -l` against the 300-line cap, and the before/after proof on a split
- MDX hazard scan (strip fences, inline code and frontmatter; then look for bare JSX tags
  and brace expressions)
- relative-link resolution against the filesystem
- `sidebar_position` collision check within each directory
- `node -e "import('./src/data/progress.js')…"` to prove the board still parses

**Only the full `yarn build` moves to CI.** Everything above stays where it is.

## The incident

Next.js import, session `211cedce`, 2026-09-03. The import was verified locally by the cheap
checks (0 MDX hazards, 18/18 links, 0 position collisions, `progress.js` parsing) and
committed. A full local build was then started "for belt and braces", OOM'd after several
minutes, and a second local build with `--max-old-space-size=9216` was started before the
user cut it off and gave the instruction above. **The local build never produced information
the cheap checks had not already given** — it died in webpack compilation, before any page
rendering, so it never reached the link report either way.

Related: [[progress-nextjs-import]] · [[devbible-locks]]
