---
name: devbible-topic
description: Write, extend, or re-validate one devbible topic to the project's depth bar — in-depth explanation, exhaustive gotchas and pitfalls, runnable examples, interview Q&A — pulling in the surrounding libraries a fullstack build actually needs (jwt, bcrypt, multer). Verifies every claim against primary sources rather than assuming, and re-validates an existing topic on request. Use on "write/extend topic X", "explain X properly", "validate/check topic X", "is this topic still accurate".
---

# devbible-topic

**Any agent — Claude, Codex, Grok, Amp, Gemini, Cursor — runs this identically.**
The unit of work is **one topic**, always. Not a phase, not a track.

Its sibling is `devbible-currency`, which answers *"is the version right"* across the
whole corpus. This skill answers *"is the explanation right, and deep enough"* for one
topic. 🔴 **Never merge the two passes** — conflating them is how both stop happening.

## Read before writing anything

| File | Why |
|---|---|
| **`../../references/authoring-contract.md`** | 🔴 The depth bar and the 300-line cap. **Required.** |
| **`../../references/house-style.md`** | 🔴 Tier badges, `> Verified:` form, headings, `★` markers, footers. **Required.** |
| **`../../references/verification.md`** | 🔴 How to be accurate without a sandbox — the evidence ladder, the installed-version trap, banked research. **Required.** |
| `references/library-scope.md` | When a surrounding library earns a page, and the pin it must arrive with |
| `instructions.md` | The standing brief — tiers, granularity, scope (§2, §4–§6) |

---

## 🔴 Before you touch a page: check the lane

This checkout is shared and several sessions write to it at once. Open
**`/mnt/Storage/my-learning/claude/devbible/LOCKS.md`** and check whether another
session holds the language your topic belongs to.

**A locked lane is reported, not edited.** If the topic is in someone else's lane, say
so and stop. Editing another lane's pages mid-write is how two sessions collide in one
file.

---

## Job 1 — write or extend a topic

The bar is **the reference page you wish you had had at 2am with the thing broken in
production.** A page that reads like documentation summarised is a failed page.

**Order of work:**

1. **Research once, for the whole topic.** One pass over the primary sources, banked as
   `research_<track>_<topic>.md` in the memory store with every load-bearing sentence
   quoted verbatim and its URL. Every chunk is then written from the bank. A topic that
   re-fetches per chunk pays the research cost twenty times — see
   `../../references/verification.md`.
2. **Write it all, then split.** Never size a page to 300 lines.
3. **Exhaust the topic.** Every gotcha, pitfall, worked example and interview question
   it genuinely has. If it fails eleven ways, list eleven.
4. **Split on a concept boundary** past 300 lines, proving the split: record `wc -l` and
   `grep -c '^\*\*★'` before; **both totals must go UP** after.

🔴 **The tells you got the depth wrong, and they are checked:** pages clustering just
under 300 lines · near-identical gotcha counts across files (a template, not an
exhausted topic) · the page names the hard case and demonstrates the easy one · you
wrote *"the fix is X"* and never showed X.

Every content page carries `## Gotchas` (symptom → cause → fix, fix shown **in code**)
and `## Interview questions` (answers in prose, `★` on the frequently-asked). Both
headings are exact. See `../../references/house-style.md`.

## Job 2 — pull in the surrounding libraries

A fullstack topic often cannot be taught without a library that is not one of
`instructions.md` §2's named technologies — auth needs jwt and bcrypt, uploads need
multer.

**The test:** a library earns a page when **the reference implementation cannot be
built without it.** It stays parked when it is an *architectural layer* you would
choose instead of something already in scope — GraphQL against Express, tRPC,
Kubernetes above Docker.

🔴 **A library may only be pulled in if it gets a pin in `src/data/pins.js` in the same
change.** Otherwise you have taught something nothing watches. This is not
hypothetical: bcrypt (32 pages), helmet (23), multer (14) and passport (12) are already
taught across **81 page-mentions with zero pins** — exactly the gap this rule closes.

Full procedure, worked examples and the pin recipe: `references/library-scope.md`.

## Job 3 — verify, never assume

**Match each claim to the cheapest evidence that actually settles it**, per the ladder
in `../../references/verification.md`:

- **T0** a verbatim quote from the primary source — for any rule, guarantee or default.
- **T1** an inline probe of an **already-installed** package (`node -p
  "Object.keys(require('react'))"`) — for what *exists*: export lists, signatures.
  🔴 **Print the installed version and compare it to the pin first.** `express` is
  installed here at **4.22.2** while the corpus teaches **5.2.1**; probing it would
  evidence the wrong major, confidently.
- **T2** one fetch of the primary doc — for behaviour, rationale, deprecations.
- **T3** running code, containers, timings — 🔴 **banned.** A new script triples the
  cost of a page.

**When nothing settles a claim:** one fetch attempt, then **write it as explicitly
uncertain or leave it out.** *"The documentation does not state whether X"* is a
legitimate sentence. A confident invention is the only unacceptable outcome.

**Never add a ` ```console ` block.** That is program output and there is nothing here
to produce it. Quote it inline from the docs and say so, relabel the fence `text` and
call it illustrative, or explain the mechanism instead — usually the best option.

**If the user supplies a file to verify against** — a doc, PDF, spec extract — validate
every load-bearing claim against it, cite it by name on the `> Verified:` line, and
where it contradicts the page **the supplied source wins**; say so explicitly rather
than quietly reconciling.

## Job 4 — re-validate an existing topic

Runs **only on a topic or chapter the user names.** A bare *"check for update"* means
the version sweep (`devbible-currency`), not this.

1. Read the topic's `> Verified:` lines — what was claimed, against what, when.
2. Re-check the **load-bearing** claims only, at the lowest sufficient tier. Not every
   sentence; the claims the topic is built on.
3. Classify each defect **S1–S5** and act per the ladder in
   `../../references/verification.md`. 🔴 **S5 is ledger-only** — a validation pass that
   rewrites prose stops being a validation pass.
4. Stamp each file, directly under its `> Verified:` line, leaving that line intact:

   ```markdown
   > Validated: <date> · claims + output provenance · session <id>
   ```

   `grep -c '^> Validated:'` per track **is** the progress bar. Every chunk gets its
   own stamp, the topic `README.md` included.

---

## Commit cadence

**Per file, not per topic.** One file finished → commit it. A topic here can run 30+
chunks and 8,000 lines; a per-topic cadence loses all of it when a session dies.

```bash
git add docs/<exact>/<paths>.md
git commit -m "<track> <topic>: <what closed> (<n> chunks, <n> lines)"
```

🔴 **Never `git add -A`** — several sessions share this checkout. Always name paths.

Then repoint the track's resume cursor in the memory store, and update
`src/data/progress.js` **only if you own the track's lane** (several sessions collide
there).

## Before reporting

```bash
wc -l <topic dir>/*.md                                    # nothing over 300
grep -c '^\*\*★' <topic dir>/*.md                         # vs the BEFORE count
grep -L '^<span className="db-tier' <topic dir>/*.md      # every page badged
grep -L '^> Verified:' <topic dir>/*.md                   # every page sourced
grep -rln '^{/\* FOOTER \*/}$' <topic dir>               # 🔴 EMPTY at topic close
grep -h '^sidebar_position:' <topic dir>/*.md | sort -n | uniq -d   # no duplicates
python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py --no-rawtag <topic dir>
```

🔴 **A topic is not closed while a `{/* FOOTER */}` remains in it.** The marker is what a
fork leaves for the coordinator; it is a valid MDX comment with no link to resolve, so
the cap, MDX and link checks all pass a page with **no navigation at all**. 1,241 pages
across 48 topics shipped that way — see `project_footer_cleanup_scope.md` in the store.

Plus: every link resolves to a file that **exists right now** (`ls` it — a dangling
link breaks the build for every other session), and `sidebar_position` is unique and
gap-free.

**Report per file:** path, line count, gotcha count, interview-question count · every
claim you could **not** confirm and what you wrote instead · every library you pulled
in and the pin you added for it · anything wrong outside your topic, **found not
fixed.**

## Scope — what this never does

- It never edits outside the topic directory it was given.
- It never runs a full `yarn build` per page — once at the end of a campaign.
- It never spawns subagents unless explicitly asked.
- It never deletes a page, section or review. Deprecated material gets `⚠ Deprecated`
  and a pointer to its successor; `docs/*/reviews/` are historical records.

## Entry points

| Agent | How it loads this |
|---|---|
| **Claude Code** | `.claude/skills/devbible-topic/SKILL.md` → points here |
| **Codex · Amp · Gemini · Cursor · Grok** | `AGENTS.md` § Writing a topic → points here |

The body lives **only in this file and its references**. Adapters stay pointers — a
duplicated procedure drifts, and then two agents write the same topic two different
ways.
