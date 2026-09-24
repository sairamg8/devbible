---
name: prompt-antigravity-syllabus-and-concepts
description: Antigravity prompt — devbible syllabus & concept authoring (language-agnostic)
metadata:
  type: reference
---

# Antigravity prompt — devbible syllabus & concept authoring (language-agnostic)

Paste the block below into Antigravity (or any agent) for **any** technology in devbible.
Replace only the `<<< >>>` placeholders. Nothing else is language-specific.

---

You are authoring reference documentation in the **devbible** Docusaurus repo at
`/mnt/Storage/Backup/Knowledge/devbible`. Work on **`docs/<<<TECH>>>/` only** — never touch
another technology's files, even to fix an obvious defect there; other sessions own them.

## Task

<<<ONE OF:
  (A) Modify the syllabus at docs/<<<TECH>>>/syllabus/ — <<<what to change>>>
  (B) Write new concept page(s) — phase <<<N>>>, topic(s) <<<NN..NN>>>
  (C) Update existing concept(s) — <<<paths>>> — <<<what is wrong or missing>>>
>>>

## Non-negotiable rules

**1. The 300-line cap is a FILE-SIZE rule, never a content budget.**
No file exceeds 300 lines — 301 gets split. But a *topic* may run 1000+ lines in total.
Write the explanation the topic deserves **first**, then split on a **concept boundary**.
Never trim a section, drop a gotcha, shorten an answer, or reword to fit the number.
*Tell you got it wrong:* a run of pages all landing 200–290 lines. Real topics vary wildly.

**2. Depth is never capped by a SECTION COUNT.**
Gotchas, pitfalls, worked examples and **interview Q&A** get **as many entries as the topic
actually has** — not two, not three, not five because five looked like enough. If a pattern
has eleven failure modes, list eleven. Q&A is the most important section, not a closing
ritual.
*Tells you got it wrong:* every page in a run has ~the same number of gotchas and questions;
the page argues about the hard case and demonstrates the easy one; "the correct fix is X"
with no X shown.

**3. Never invent output.** No console block, timing, byte count, error string or benchmark
unless it came from a run that actually happened in this repo's `sandbox/`. **Sandboxing is
closed — do not write new scripts.** Everything is validated against **official
documentation**, with the source named. No run means **no output block at all** — write the
explanation without it. A claim the docs cannot settle is stated as uncertain or left out.
Command *syntax* is fine to show; server/tool *output* is not.

**4. Every link ends in `.md` and keeps every numeric prefix.**
- directory index → `../01-inner-join/README.md`
- file inside it → `../01-inner-join/02-fan-out.md`
Never link the directory slug and never drop the prefix — `.md` links resolve file-relative,
survive `trailingSlash`/`slug:`/`baseUrl`, and fail loudly at build time.
⚠️ `instructions.md` §6 still says "routes drop the numeric prefix" — **that is stale and
wrong**; it broke 188 links once. This rule wins.
Never bulk-`sed` links; resolve each target against the filesystem.
A target that does not exist yet is written as **bold plain text with *(not written yet)***,
never as a link — a dangling link breaks the build.

**5. Tiers.** Every topic gets exactly one, written as
`<span className="db-tier t-master">Master</span>` (classes: `t-master`, `t-understand`,
`t-know`, `t-when`). Assign for **fullstack application development**, and keep
**Master at 25–30% of topics** — if everything is Master the labels carry no information.
A topic a reader *builds from* is Master, and Master topics get their depth by chunking.
**Count the badges before publishing any distribution table** (command below) — never
estimate them.

## Page contract — every concept page carries all of it

- frontmatter (`title`, `sidebar_label`, `sidebar_position`)
- the **tier badge** and a **`> Verified: <date> against <named doc pages/URLs>`** line —
  repeated in *every* chunk, so a chunk opened directly still states its provenance
- a one-line "what this is and why it exists"
- **runnable, complete code** — realistic names, no `...` elisions; anything not runnable is
  labelled `// pseudo-code`
- **Gotchas / pitfalls**, written **symptom → cause → fix**, leading with the symptom
  (that is what someone searches for when stuck) — as many as the topic has
- **Interview questions with answers** — "why" and "what happens if" over "what is"; mark
  frequently-asked ones with `★` — as many as the topic supports
- **Where this connects** — links to neighbouring topics and other technologies
- version pin: name the version each behaviour was confirmed on

## Chunked-topic layout (when a topic passes 300 lines)

The file becomes a directory, keeping its numeric prefix:

```
NN-topic/
├── _category_.json   {"label":"NN · Topic","position":N,"collapsed":true}
├── README.md         index: tier badge, > Verified, one-liner, chunk table,
│                     phase gate, "Where this connects"
├── 01-first-chunk.md
└── 02-second-chunk.md
```

Chunks link `← Prev` / `Next →`; the first links back to the topic index, the last forward
to the next topic. A **phase** directory takes no `_category_.json` (README frontmatter +
autogeneration); only a *chunk* directory gets one. When converting a file to a directory,
fix inbound links in the phase README and neighbouring footers — and grep for the old
`NN-topic.md` path, because a resolver that maps it onto `NN-topic/` will report 0 errors on
a dangling link.

## Syllabus file shape (mode A)

`docs/<<<TECH>>>/syllabus/0N-part-name.md`, one file per part:

```markdown
---
title: "Part N — <name>"
sidebar_label: "N · <short name>"
sidebar_position: N
---

> Phases NN–NN · <the through-line in one line>

<2–4 sentences: the mental model this part installs, not a list of features.>

---

## Phase NN — <name>

<one or two lines on what this phase decides>

| Topic | Tier |
|---|---|
| **<bolded = the load-bearing ones>** — <what it covers, concretely, incl. the API names> | <span className="db-tier t-master">Master</span> |

**Gate — move on when:** <a behaviour the reader can perform, not a topic list.>

---

## Where this connects
- **Part N+1**: <why>
- **<other tech> (`docs/<tech>/pages/<phase>/`)**: <the overlap, in one line>
```

`syllabus/_category_.json` → `{"label":"Syllabus","position":1,"collapsed":true}`.
Topic rows name real APIs, flags and error strings — a row a writer cannot turn into a page
without re-researching the scope is not specific enough.

## When you finish each FILE — cadence, not at phase end

1. **Update all four boards** (a topic is not done until they agree):
   - `src/data/progress.js` — your technology's row only. Mid-phase needs **both**
     `pages: N` **and** `pagesPlanned: <total>` (without `pagesPlanned` the phase reads as
     complete). `pages` counts **topics done, not files**.
   - that phase's `README.md` — count, topic row + link, coverage block
   - `docs/<<<TECH>>>/pages/README.md` — the phase table row
   - `docs/README.md` — the claims row and the technology row
2. **Never `git add -A`** — several sessions write in this checkout. Stage explicit paths.
   Expect other technologies' rows in your diff and leave them alone.
3. Commit, then write progress (done / next / traps found) to the memory store at
   `/mnt/Storage/my-learning/claude/devbible/`.

## QC before you call anything done

```bash
cd /mnt/Storage/Backup/Knowledge/devbible

# 1. no file over the cap
find docs/<<<TECH>>> -name '*.md' -exec wc -l {} + | awk '$1>300 && $2!="total"'

# 2. real tier counts — never estimate a distribution table
for t in master understand know when; do
  printf "%-11s %s\n" "$t" "$(grep -rho "t-$t" docs/<<<TECH>>> | wc -l)"
done

# 3. every link target exists (resolve, do not guess)
python3 /mnt/Storage/my-learning/claude/shared/scripts/fixlinks.py   # dry-run by default

# 4. contract coverage
find docs/<<<TECH>>> -name '*.md' | wc -l
grep -rl '^> Verified' docs/<<<TECH>>> --include='*.md' | wc -l
grep -rl 'db-tier'     docs/<<<TECH>>> --include='*.md' | wc -l
```

⚠️ **Do not run `yarn build` or `yarn start`** without first claiming a row in
`/mnt/Storage/my-learning/claude/shared/session_build_devserver_registry.md` — several
sessions share this machine and each build holds a large Node heap. Clear your row the
moment it finishes. If you did not build, say plainly that pages were **link-checked against
the filesystem, not built**.

## Report honestly

Say what you wrote, what you could not verify, and what you deliberately left out. A status
banner (`:::caution not yet validated`) is removed only when the thing it warns about is
actually fixed — never because the page now looks finished. Never state a count you did not
count.
