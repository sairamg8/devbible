# The validation pipeline — how an unchecked page becomes a checked one

**Any agent — Claude, Codex, Grok, Amp, Gemini — runs this identically.**

The corpus has **5,984 pages and 47 validated stamps**. Two plans have been written for
this problem — the V1–V7 lanes (2026-08-16) and the F0–F3 toolchain passes (2026-08-31) —
and between them they produced **zero validated pages outside Next.js**. This file is not a
third plan. It is the loop that was missing from both.

🔴 **Why the plans produced nothing, stated plainly, because it will happen again:**

| What went wrong | What this pipeline does instead |
|---|---|
| A plan in prose has no cursor. Every session re-derived where to start — an evening's work each time. | `yarn validate --queue` computes the next unit from disk. Deterministic; two sessions get the same answer. |
| A 31-agent fan-out died on the usage limit and **both synthesis agents with it**. 17 of 31 agents produced nothing that survived. | There is no synthesis stage. Each unit banks its own row. Ten finished units are ten banked rows, not a pending report. |
| Findings lived in `/tmp/claude-<uid>/…` and were **gone by morning**. | The ledger is in the memory store, on the Storage partition. `/tmp` is wiped between sessions and `$HOME` has been wiped three times. |
| Progress was a number in a document that nobody updated. | Progress **is** `grep -c '^> Validated:'`. Nothing to keep in sync, nothing to forget. |

---

## The division of labour — and yes, the checking itself is the AI's job

The script cannot tell you whether a page is *true*. Only an agent reading the page against
its primary source can. So the two halves split cleanly, and neither should do the other's
work:

| | The script (`yarn validate`) | The agent |
|---|---|---|
| Does | finds the next unit · counts the marks · records what was banked · catches a pass that rewrote instead of checked | reads the pages · re-checks the load-bearing claims against primary sources · classifies S1–S5 · fixes and stamps |
| Costs | milliseconds | the session |
| Is | deterministic, repeatable, crash-proof | expensive, non-deterministic, **and the thing that must be banked** |

🔴 **The script exists to make the agent's work survivable, not to replace it.** Everything
mechanical was pushed into the script precisely so the agent's whole budget goes on the one
thing only it can do: deciding whether a sentence is still true.

---

## One unit, start to finish

A **unit** is one topic directory — the deepest directory holding pages. That is
`devbible-topic`'s unit of work, and it is sized to finish and bank inside one session.

### 1 · Take the top of the queue

```bash
yarn validate --queue --limit 5
yarn validate --unit docs/framer-motion/pages/01-core-concepts
```

`--unit` prints every file, its marks (`B` tier badge · `V` sourced · `✓` checked), what is
missing, and the ledger row to fill in. **Check `LOCKS.md` before touching it** — a unit in
another session's language lane is reported, not edited.

### 2 · Research once, for the whole unit

Not once per page. One pass over the primary sources for the topic, banked as
`research_<track>_<topic>.md` in the memory store with every load-bearing sentence quoted
verbatim and its URL. A 20-chunk topic that fetches per chunk pays the research cost twenty
times for the same document — that, not the writing, is where the budget goes. Full rule:
[`verification.md`](verification.md).

### 3 · Re-check the load-bearing claims only

Not every sentence — the claims the topic is built on. Use the **lowest tier that settles
the claim**: **T0** a verbatim quote · **T1** a probe of an already-installed package
(print the installed version and compare it to the pin first) · **T2** one fetch of the
primary doc · **T3** running code is banned. The ladder, the installed-version trap and
what to do when nothing settles a claim are all in [`verification.md`](verification.md).

### 4 · Classify every defect S1–S5, and act only on S1–S4

The ladder lives in [`verification.md`](verification.md). The one line worth repeating here:

🔴 **S5 — wording, ordering, heading style — is LEDGER-ONLY.** A validation pass that starts
rewriting prose stops being a validation pass and becomes an unreviewed rewrite of pages
that were fine. **It has already happened to this exact corpus once.** If the page reads
badly but is true, that is a note in the ledger and nothing else.

### 5 · Stamp each file, leaving `> Verified:` intact

```markdown
> Validated: 2026-09-06 · claims + output provenance · session <id>
```

Directly under the existing `> Verified:` line, **never replacing it**. They record two
different facts: how the page was *written*, and that it was later *checked*. Every chunk
gets its own stamp, the topic `README.md` included.

### 6 · Bank the row BEFORE starting the next unit

```bash
$EDITOR "$DEVBIBLE_MEMORY/VALIDATION-LEDGER.md"     # default: /mnt/Storage/my-learning/claude/devbible/
git add docs/<exact>/<paths>.md && git commit -m "validate <unit>: <n> pages, S1×<n> S2×<n>"
```

🔴 **Per unit, never per campaign.** The rule was written after a night's work vanished:
*a finding is not banked until it is in the store.* Never `git add -A` — several sessions
share this checkout.

### 7 · Prove the pass was a check, not a rewrite

```bash
yarn validate --guard HEAD~1
```

Flags any newly-stamped file with rewrite-shaped churn, and 🔴 **any that got SHORTER** — a
validation pass has no business deleting content, and a file shrinking under one is a trim,
which is the exact move the 300-line rule forbids. Content is split on a concept boundary,
never cut to fit.

---

## Ordering — why the queue puts what it puts first

The score is computed from marks alone, with **no per-track special cases**; a hardcoded
list of "known bad tracks" goes stale the moment a track is converted.

| Signal | Weight | Why |
|---|---|---|
| no `> Verified:` line at all | 40 | Nobody ever sourced it. Certain, structural, and it is live on the site. |
| no tier badge | 25 | Reader gets no signal the page is unchecked. |
| `> Verified:` older than 180 days | 15 | True once; the upstream has moved. |
| a ` ```console ` block with no provenance | 12 | ⚠️ **A flag, not a verdict.** Reproduces the known 636-file risk set exactly — but spot checks find pages whose `> Verified:` line names the container and port they were run in and simply predate the `sandbox-proven` marker. Weighted low on purpose: scored as a defect it buried the raw imports, which have **proven** errors, thirteen places down. |
| missing `## Interview questions` / `## Gotchas` | 10 each | House-style breach, cheap to close. |
| over the 300-line cap | 8 | Structural; fix by splitting when next in the file. |

Units are ranked on **risk per file, not summed risk** — summed risk is really a size
measure, and it put a 71-file Java topic above every raw-import chapter purely for being
large.

This ordering reproduces the 2026-09-06 audit's own priorities without being told them: the
ten never-sourced toolchain tracks lead at 83/page, Storybook follows at 42, and Git's 36
pages missing `## Interview questions` surface on their own.

---

## Running several at once

Fan-out is allowed and useful — the per-unit agents are cheap. Two rules, both bought
expensively:

1. 🔴 **Keep the batch small enough that every agent finishes.** A 31-agent run lost 17
   agents to the usage limit. Ten units is a batch; thirty is a gamble.
2. 🔴 **Each agent banks its own row as it finishes.** Never "collect and synthesise at the
   end" — the end is exactly where the budget runs out, and a synthesis stage is the one
   part that cannot be reconstructed by hand.

There is no coordinator to lose. Ten agents that each stamped their files and appended their
row have finished ten units, whatever happens to the eleventh.

---

## Scope — what this pipeline never does

- It never writes new topics. A missing page is a **gap**, logged in the ledger, and belongs
  to `devbible-topic` Job 1 in that track's lane.
- It never authors a syllabus. Ten of the imported tracks have no `syllabus/` at all — that
  is authoring, a different job, and confusing the two is how F1 became a rewrite last time.
- It never sweeps versions. That is `devbible-currency`, corpus-wide, and 🔴 **the two never
  merge** — wiring content validation into the weekly version run mutes the weekly run.

Related: [`verification.md`](verification.md) (the ladders) ·
[`authoring-contract.md`](authoring-contract.md) (the cap, chunking) ·
[`house-style.md`](house-style.md) (the marks) ·
[`../skills/devbible-topic/SKILL.md`](../skills/devbible-topic/SKILL.md) (Job 4).
