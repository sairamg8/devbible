---
name: devbible-agent-dispatch-and-boards
description: Cross-track — the measured dispatch rules for authoring agents, the QC check to run on every agent's output, and the FIVE board surfaces a finished topic must update (not four)
metadata:
  type: reference
---

# Dispatching agents · QC · the five boards

**Hoisted out of [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md) on 2026-09-08.** All of it
was learned on the toolchain track and none of it is toolchain-specific — it applies to every
track that dispatches an authoring agent or closes a topic. In a per-track cursor it was
invisible to every session not working that track, which is how the same defects kept being
re-learned. Related: [DISPATCH-ANTI-STALL.md](DISPATCH-ANTI-STALL.md).

---

# 🔴🔴 DISPATCH RULES — measured, not guessed

Full detail in [DISPATCH-ANTI-STALL.md](DISPATCH-ANTI-STALL.md). The two that changed outcomes
most, both measured on 2026-09-08 across ten dispatches:

## 1. Every brief carries the write-early line AND the split line

> **"Write each chunk to disk COMPLETELY, as soon as you have finished thinking about it, before
> you start the next one. Never hold the topic in your head to write at the end."**

> **"If you exceed 300 lines, SPLIT into a second file at a concept boundary and tell me the new
> filename. Do NOT shrink, compact, reflow or de-duplicate anything to fit."**

| Wave | Brief | Trimmed to fit | Split correctly |
|---|---|---:|---:|
| morning | *"aim ≤285"* + *"one file only"* | 🔴 **2 of 2** | 0 |
| afternoon | the same **plus the split line** | ✅ **0 of 4** | **4 of 4** |

🔴 **The split line is not advice — it removes a trap.** *"Aim ≤285"* plus *"one file only"* leaves
an overshooting agent **no legal move except to trim**, and a trim passes every gate.

## 2. 🔴 Dispatch agents for FRESH WRITES ONLY

| Task shape | Died at the 600s watchdog |
|---|---|
| Write a NEW file from a brief | **0 of 6** |
| SPLIT an existing file | 1 of 2 |
| EXTEND a topic (read one file, write many) | **2 of 2** |

**Do splits and extends in-session, by hand.** Both force the agent to hold an existing file before
it may write anything — the exact shape that stalls.

## 3. The other lines, each bought at cost
- *"You may NOT delete a `**★ ` block. To shed lines you MOVE it to a named destination file and
  say which."*
- *"Report the TOPIC's before/after `wc -l` AND `grep -c '^\*\*★'` totals, not per-file."*
- *"List every file you leave in the session scratchpad."*
- *"At most ONE fetch, and only if the bank does not settle it. Do not fetch blog posts. Do not
  stage research files in the scratchpad."*
- ⛔ Agents never `git add`, never commit, never `yarn build`, never touch a board.
- **Give each agent its ONE directory and the exact prev/next filenames for its footers**, warning
  that siblings are being written concurrently so it must **link only filenames that exist today**
  — plus any pre-agreed sibling you guarantee will land.

---

# 🔴🔴 THE QC CHECK THAT MATTERS MOST — run it on every agent's topic output

**An interrupted MOVE destroys `★` blocks, and the totals check cannot see it.** On 2026-09-08 an
agent died on the line *"Now moving the five `★` blocks out of `01`…"* — it had deleted them and the
destination file was never created. **The topic's totals went 19 → 65 ★ (UP, hugely) while two
blocks were gone.** Both were recovered verbatim from `HEAD`.

```bash
cd <topic dir>
git show HEAD:./01-<entry>.md | grep '^\*\*★' | sed 's/\*\*★ //; s/\*\*.*//' > /tmp/orig.txt
cat *.md                      | grep '^\*\*★' | sed 's/\*\*★ //; s/\*\*.*//' > /tmp/now.txt
while IFS= read -r l; do grep -Fqx "$l" /tmp/now.txt || echo "🔴 LOST: $l"; done < /tmp/orig.txt
```

🔴 **"Both totals went up" proves only that nothing was wholesale-trimmed.** It cannot detect a move
that dies between the delete and the paste. Only the per-block diff can. This is the fourth such
incident in this corpus and the first caught before the commit.

---

# 🔴 THE BOARDS — there are FIVE surfaces, not four

1. `src/data/progress.js` — the per-topic `pages` / `verified` row
2. `src/data/page-counts.json` — regenerate: `node scripts/page-counts.mjs`
3. `static/status.json` — regenerate: `node scripts/status.mjs`
4. 🔴 **`docs/<track>/pages/README.md`** — **TWO tables**: the topic table (tier + validated) *and*
   the continuation-chunks table. **Every tanstack wave since topic 08 had missed both.**
   **Assume the same of every other imported track a wave has touched.** Measure off disk:
   `grep -l '^> Validated:' <topic>/*.md` for topic rows, `sidebar_label` for chunk rows.
5. `docs/README.md` — the track row, for a new track only

🔴 **TWO tracks carry a topic slugged `16-migration-recipes` in `progress.js`** (lines 524 and 759).
A slug-only regex matches both and silently rewrites another lane's row. **Scope every
`progress.js` edit to the track block.** Caught on an assertion, not in a diff.

---
