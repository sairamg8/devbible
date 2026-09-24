---
name: dispatch-anti-stall
description: 🔴 The one line every devbible authoring-agent dispatch MUST carry. Six agents were killed by the 600s stall watchdog on 2026-09-08 for want of it; every agent given it finished. Read before writing any Agent prompt for this corpus.
metadata:
  type: feedback
---

# 🔴 Every authoring-agent dispatch carries this line, or the agent dies

**Put this in the brief, near the top, in bold:**

> **Write each chunk to disk COMPLETELY, as soon as you have finished thinking about it, before
> you start the next one. Never hold the topic in your head to write at the end.**

## Why — measured, 2026-09-08, session `d0684ffb`

Eight agents were dispatched across tanstack topics 11, 14, 15 and 16.

| Brief said | Agents | Outcome |
|---|---:|---|
| *"Write it ALL first, THEN split"* | 4 | 🔴 **4 of 4 killed** by the 600s stall watchdog |
| *"write each chunk to disk before starting the next"* | 4 | 2 finished clean; 2 stalled **only after writing 4 chunks each** |

The four originals died at `no progress for 600s (stream watchdog did not recover)`. Two of them
had written nothing at all. The same failure is already in this project's history from the Next.js
chapter forks — *"three chapter-scoped forks stalled at 600s having written NOTHING and the retry
with that one line succeeded completely"* — so this is the **second** time it has been rediscovered
at full cost.

## 🔴 The trap, and it is subtle

`.agents/references/authoring-contract.md` Rule 1 genuinely says **"Write it ALL first, then
split."** That rule is about **not sizing content to the 300-line cap** — it is an instruction about
*content budgeting*, not about *when bytes hit the disk*. Quoting it into an agent brief converts it
into "research everything, then write at the end", which is precisely the pattern that dies.

**Both are satisfiable at once, and this is the wording to use:** each chunk is written complete and
exhaustive at a concept boundary, saved, and only then is the next one considered. Nothing is sized
to the cap; nothing is held in context.

## The other three lines that were bought expensively

3. **"You may NOT delete a `**★ ` block. To shed lines you MOVE it to a named destination file and
   say which."** — an agent once ran `replace(block, "")` and four ★ blocks were lost outright.
4. **"Report the TOPIC's before/after `wc -l` AND `grep -c '^\*\*★'` totals, not per-file."** — a
   per-file count cannot distinguish a split from a trim.
5. **"List every file you leave in the session scratchpad."**
6. 🔴 **Cap the fetches explicitly — "at most ONE fetch, and only if the bank does not settle it.
   Do not fetch blog posts. Do not stage research files in the scratchpad."** Topic 14's first
   agent spent its entire budget pulling a long third-party article into the scratchpad and died
   having written nothing. Its replacement, told zero-fetches-unless-needed, finished.

## 🔴 7. THE CAP LINE — added 2026-09-08 after it bit twice in one session

> **"If you exceed 300 lines, SPLIT into a second file at a concept boundary and tell me the new
> filename. Do NOT shrink, compact, reflow or de-duplicate anything to fit. Trimming to fit is a
> contract violation; a second file is always the correct answer."**

**Why:** a brief saying *"aim for ≤ 285"* **and** *"you may not create a second file"* leaves an
agent that overshoots **no legal move except trimming.** Both topic-16 agents did exactly that —
`01h` came down 318 → 299 and `01n` 325 → 293, and `01n` explicitly *"dropped repeated
loader/component boilerplate"*. No `★` block or section was lost either time, so every gate passed
and neither trim was visible in a file listing. That is precisely the failure the global rule's
"prove a split is a split" clause exists to catch.

⚠️ **The "one file only" clause is still right** — it is what stops an agent sprawling across a
topic. It just has to be *"one file, unless you exceed the cap, and then tell me"*.

## 🔴 8. A SPLIT TASK IS NOT A WRITE TASK — do splits by hand (2026-09-08)

**Dispatching an agent to split an existing file stalls far more often than dispatching one to write
a new file**, because a split forces the agent to read and hold the whole source before it may
legally write anything — which is exactly the "research everything, write at the end" shape that
rule 1 exists to prevent. You cannot fix this with wording; the task itself has that shape.

Measured 2026-09-08, session `bc194850` — 3 of 6 agents died:

| Task shape | Agents | Outcome |
|---|---:|---|
| Write a NEW file from a brief | 2 | ✅ 2 of 2 finished |
| SPLIT an existing file | 2 | 🔴 1 of 2 died having written nothing |
| EXTEND a topic (read one file, write several) | 2 | 🔴 **2 of 2 died mid-topic** |

🔴 **Do splits in-session, by hand.** They are mechanical, they are fast for the session that already
has the file in context, and the failure mode when an agent dies mid-split is the worst one in the
corpus — see §9.

## 🔴 9. AN INTERRUPTED MOVE DESTROYS `★` BLOCKS, AND THE TOTALS CHECK DOES NOT SEE IT

A topic-02 agent died on the line *"Now moving the five `★` blocks out of `01` (they will be pasted
verbatim into `01b` and `01f`)"*. It had deleted them from the source; `01f` was never created. Two
blocks existed nowhere on disk.

🔴 **The topic totals were 19 → 65 `★` — UP, hugely — while two blocks were gone.** The global rule's
"both totals must have gone UP" catches a wholesale trim. It does **not** catch a move that dies
between the delete and the paste. Only a per-block diff does:

```bash
cd <topic dir>
git show HEAD:./01-<entry>.md | grep '^\*\*★' | sed 's/\*\*★ //; s/\*\*.*//' > /tmp/orig.txt
cat *.md                      | grep '^\*\*★' | sed 's/\*\*★ //; s/\*\*.*//' > /tmp/now.txt
while IFS= read -r l; do grep -Fqx "$l" /tmp/now.txt || echo "🔴 LOST: $l"; done < /tmp/orig.txt
```

**Run it before every commit of an agent's topic output.** It recovered both blocks verbatim from
`HEAD` this time — the first of four such incidents in this corpus to be caught before the commit.

## ✅ 10. RULE 7 MEASURED — 0 of 4 trimmed, against 2 of 2 the same day

Same corpus, same day, same model, one line different in the brief:

| Wave | Brief | Trimmed to fit | Split correctly |
|---|---|---:|---:|
| morning | *"aim ≤285"* + *"you may not create a second file"* | 🔴 **2 of 2** | 0 |
| afternoon | the same **plus rule 7** | ✅ **0 of 4** | **4 of 4** |

🔴 **Rule 7 is not advice, it is the removal of a trap.** *"Aim ≤285"* combined with *"one file
only"* leaves an overshooting agent no legal move except to trim, and a trim passes every gate.
Carry rule 7 in every dispatch, always.

Also confirmed by the afternoon wave: **fresh-write agents are reliable** (0 of 6 died) while
**split and extend agents are not** (3 of 4 died) — see §8.

## ✅ 11. RULE 7 RE-MEASURED AT SCALE — 12 / 12, devbible vite topic 18 (2026-09-08)

Two waves, eight fresh-write agents, 13 dispatched chunks. **Twelve chunks overshot the 300-line
cap and all twelve SPLIT. None trimmed.** Every dispatch carried rule 7 verbatim.

Combined with the tanstack measurement (0 of 4 trimmed **with** the rule, 2 of 2 **without**),
the line is now proven across **16 overshoots**. It is not advice. Carry it always.

✅ **Confirms §8 from the other direction, too: 8 fresh-write agents, ZERO stalls.** Note *why*
this held even though twelve of them performed a split: each agent split **its own file, which
it had just written and still held in context** — a fresh-write shape. §8's killer is being sent
to split a file you must first go and read. Same word, different task.

## 🔴 12. CONCURRENT AGENTS CANNOT ALLOCATE `sidebar_position` — assign, then renumber once

Eight agents writing one topic directory collided on positions **6, 7, 8, 20 and 21**. Each
picked "the next free number" against a directory that was changing under it; two split siblings
independently chose the same slot minutes apart.

✅ **What went right, and it is the reusable part:** every agent **reported** the collision and
refused to renumber another agent's file. Nothing had to be reconstructed. The brief's
"report defects outside your lane, found not fixed" line is what bought that.

➜ **The dispatch pattern:** assign each agent its positions explicitly, tell split siblings to
take a number above everything assigned, and then **renumber the whole directory in ONE
coordinator pass at close.** Never ask agents to coordinate numbering with each other.

⚠️ A duplicate `sidebar_position` is a **silent reordering, not an error** — every gate passes it
and the sidebar just renders wrong. `grep -h '^sidebar_position:' *.md | sort -n | uniq -d`.

## 🔴 13. THE CLOSE-STEP GREP EVERYONE FORGETS — `*(not written yet)*`

Agents are told, correctly, to write an unwritten chunk as **bold text + `*(not written yet)*`**
rather than a link, because a dangling link fails the build and skips the deploy. **That marker
then goes stale the instant the target lands, and no gate catches it** — it is bold text, not a
link, so `linkcheck`, `mdxcheck` and the cap check all pass it forever.

Ten of them at vite topic 18's close; **eight were in a single file** — the topic's map page,
which by construction names every chunk in the topic at a moment when none of them exist.

```bash
grep -rn 'not written yet' <topic dir>     # must be EMPTY at topic close
```

Run it **beside** the `{/* FOOTER */}` grep. They are the same class of defect: correct during
writing, wrong at close, invisible to everything. Full write-up:
[[gap-stale-not-written-yet-markers]].

## And one that is not about the agent

⚠️ **A monitor that warns on "no write for N minutes" must carry a grace window**, or a
just-dispatched agent reports itself stalled before it has had a chance to write. Also: a
file-count monitor is blind to a **rewrite in place** — topic 14's first deliverable was a rewrite
of an existing file, so it looked silent while working. Watch mtime, not file count.

Related: [[cursor-a2-toolchain]] · [[devbible-locks]] · [[devbible-validation-ledger]] ·
[[gap-stale-not-written-yet-markers]] · [[cursor-vite]]
