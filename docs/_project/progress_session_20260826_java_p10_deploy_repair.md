---
name: devbible-session-20260826-java-p10-deploy-repair
description: Session 69f1de49 — recovered Java phase 10 batch 6 from an API-limit kill, found and fixed the MDX class that had failed every GitHub Pages deploy for three days, cut ~/.claude/CLAUDE.md to rules-only, and made the 300-line cap mechanical.
metadata:
  type: project
---

# devbible · session `69f1de49` · 2026-08-26 · Java phase 10 + deploy repair

Started from *"pick up where you left off with java and it was abruptly exited due to api
limit"*. Ended up doing four things.

## 1 · Recovered batch 6 — nothing was lost

Six forks writing phase 10 topics 09–14 had been killed mid-run by an API limit, leaving
**24 files on disk and uncommitted**. QC passed on all 24 (0 over cap, 0 dangling links, 0
console blocks, frontmatter and `> Verified:` on every one) and they were committed as a
salvage. Their **research passes had survived in the store**, which is why the resume cost
nothing in re-fetching — that is the single most valuable habit here.

A second set of six resume forks took the batch to **53 files**, then the user killed them
on a usage concern. Three agents (two topics each) replaced them. **The per-file commit
rule is what made both kills survivable**; the first batch predated it and needed a salvage.

## 2 · 🔴 The MDX class that failed every deploy for three days

**Every GitHub Pages deploy failed from 2026-08-23 to 2026-08-26.** Last green was
2026-08-19. The cause was **one character class**, and it was devbible's own scaffolding:

> Docusaurus v3 parses `.md` as **MDX**, which has **no HTML comments**. A bare
> `<!-- ... -->` in prose aborts the client bundle with
> *"Unexpected character `!` (U+0021) before name"*.

`<!--CHUNKS-->` sat in seven topic READMEs and `<!--FOOTER-->` at the end of every new
chunk. **The MDX form is `{/* ... */}`.** Inside a fenced code block a comment is fine — an
XML example is not parsed.

Two more of the same family, both fixed: an inline code span left **open** at end of line
whose continuation starts with `{`, which MDX reads as a JSX expression before the span
closes (`07-relationships-fetch/14b`, `01-jdbc/19d`). A third form is a bare `<Something` in
prose — `List<String>`, `RedisTemplate<K, V>`, `<clinit>`. **Always backtick generics.**

🔴 **`shared/scripts/mdxcheck.py` now catches all three.** It existed, it was run, and it
could see only the code-span one — which is exactly why this shipped. Run it before every
push: `python3 shared/scripts/mdxcheck.py --no-rawtag docs`.

⚠️ **Three traps found while chasing this:**
- `cmd > log 2>&1; echo $?` reports the **echo's** status, not the build's. Read the log for
  `compiled with errors`. This made a failed build look green.
- `{}` alone **is** valid MDX (an empty expression), so the code-span check has a known
  false positive on `docs/storybook/.../03-providers-in-decorators.md`. It has always built.
- **A `workflow_dispatch` run can wedge before it is scheduled** — `queued` for 20 minutes
  with **zero jobs**. Cancelling returns 409 *"Cannot cancel a workflow run that has not
  been queued yet"*. Just dispatch a second run. Also: the push-triggered run never fired
  at all, so do not assume a push started a build — check.

## 3 · `~/.claude/CLAUDE.md` cut to rules-only: 1,261 → 482 lines

On the user's instruction, as a **standing constraint**: *"~/.claude claude.md contain only
hard rules and path to main memory thats all"* · *"not just now for every session"*.

- 673 lines of per-language lock state → **`devbible/LOCKS.md`**
- incident narrative, verbatim instruction history, tool troubleshooting →
  **`shared/reference_global_claude_md_history.md`**
- `MEMORY.md`'s rule 10 (an 81-line, partly stale mirror of the same locks) → a pointer

🔴 **Verified line by line that no rule was lost — 0 lines removed from rule 1, 0 from rule
13.** All 15 rules remain. The file now states the constraint at the top so it cannot drift
back, and `settings.json` is backed up beside it for the reinstall path.

**Why it mattered:** the file was ~19k tokens paid by every session **and every subagent**.
A six-agent batch paid ~114k for it. Measured contributors to an agent's ~70k floor:
CLAUDE.md 19k, MEMORY.md 4.4k, skills listing ~6k, hook context ~3.7k, harness+tools
~25–30k — **the task prompt was 2%**. Biggest remaining levers: reuse an agent by
`SendMessage` (resuming costs **zero** new floor) and prune the plugin skill surface.

## 4 · 🔴 The 300-line cap is now MECHANICAL

`~/.claude/settings.json` → `PostToolUse` on `Write|Edit` runs
`shared/scripts/hook-300-line-cap.sh` after every `.md`/`.mdx` write under a `docs/` path.
Over 300 it reports the exact overage and restates the remedy — **split on a concept
boundary, distribute the gotchas and questions, trim nothing**. Fires in every session on
this machine, subagents included. It reports; it does not block.

It caught its first case the same night: a chunk landed at 318 and was split into 164 + 192
with its 11 gotchas and 10 questions distributed to the half each belonged to. An agent's
own commit message later read *"315-line draft split on concept boundary"*.

## 5 · Phase-10 QC — and two false alarms worth not repeating

**Java tree: 0 files over the cap.** Topics 08–14 show healthy variation (gotchas 3–14,
questions 4–12) — no uniform-count tell.

⚠️ **False alarm 1:** counting lines with `len(text.split('\n'))` is **one more** than
`wc -l` because of the trailing newline. Six files reported "over cap" were exactly 300.

⚠️ **False alarm 2:** topics 05, 06 and 07 appeared to have **zero gotchas**. They use plain
`**bold.**` items; topics 01–04 and 08+ use `**⚠️ …**`. A style inconsistency across the
phase, not missing content — do not "fix" it by rewriting 100+ committed files.

⚠️ **Six files sit at exactly 300 lines**, which is the documented "reworded down to fit"
tell. Checked: all six are **at or above their topic's median** for both gotchas and
questions. They are dense pages split *at* the cap — rule 1 done right, not violated.

## Tooling added this session (all in the store, all reusable)

| Script | What it does |
|---|---|
| `shared/scripts/mdxcheck.py` | extended — catches bare HTML comments, open code spans before `{`, and raw JSX-like tags |
| `shared/scripts/hook-300-line-cap.sh` | the PostToolUse cap gate |
| `shared/scripts/wire-topic.py` | builds a chunked topic's README index and wires every ← Prev / Index / Next → footer from `sidebar_position` order on disk; refuses a gap or reuse in the sequence; idempotent |
| `devbible/java_p10_topic_meta.txt` | titles, one-liners and `:::tip` summaries for topics 09–14, input to `wire-topic.py` |

**The chunk convention this phase now uses:** every page ends with the literal line
`{/* FOOTER */}`; the coordinator replaces it at topic close. Topic `README.md` files are
the coordinator's job too — chunk authors never write them.
