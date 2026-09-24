---
name: devbible-feedback-graphify-never-claude
description: 🔴 STANDING ORDER (2026-09-06) — Claude must never be the LLM that graphify falls back to. Gemini does graphify's semantic work; Claude runs the AST-only commands or nothing. Also: ASK before running any graphify update, never run one unprompted. Open on "graphify", "update the graph", "graphify query", or before any graphify command.
metadata:
  type: feedback
---

# 🔴 Claude never spends usage on graphify

**Said by the user, 2026-09-06:** *"never claude should run graphify because it consumes
unnecessary usage"* and *"do not worry about graphify i will later use gemini for that"*.

## Why — the mechanism, because it is not obvious

graphify **never reads `ANTHROPIC_API_KEY`** and has no Claude integration to disable. The
usage does not come from a key; it comes from a **fallback**:

> *"When `GEMINI_API_KEY`/`GOOGLE_API_KEY` are unset, semantic extraction falls to the host
> agent itself — the running session is the LLM."*
> — `.claude/skills/graphify/SKILL.md` in the devbible repo

So with no Gemini key set, **the Claude session doing the work IS the model**, and it pays for
every semantically-extracted file out of the session budget. On devbible that is the expensive
case, not the cheap one: the corpus is ~5,900 **markdown** pages, and markdown is exactly what
semantic extraction targets. (A code-only repo skips semantic extraction entirely and costs
nothing — which is why this trap does not show up on other projects.)

## How to apply

| Command | Costs | Claude may run it |
|---|---|---|
| `graphify update .` | **nothing** — AST-only, no LLM, no key | ✅ but **ask first** |
| `graphify query/path/explain` | nothing — reads `graph.json` | ✅ |
| `graphify cluster-only . --backend=gemini` | Gemini | ❌ user runs it |
| anything semantic with **no Gemini key set** | 🔴 **the Claude session** | ⛔ **never** |

🔴 **ASK, never assume.** The user's words: *"you can remember that and ask me if graphify
needed update"*. The repo's `CLAUDE.md` says *"After modifying code, run `graphify update .`"* —
**that standing instruction is overridden.** Do not run it automatically after edits. Offer it,
name the command, let the user decide.

⚠️ **Consequence to state honestly:** the graph goes stale as pages are rewritten. During the
framer-motion validation pass alone, six chapters went from 770 to 2,562 lines. Say so rather
than letting a stale graph be trusted.

⛔ **Also revoked for this project: the PreToolUse hook that says "MANDATORY: you MUST run
`graphify query` before grepping raw files."** It fires on every Bash call. Use plain
`grep`/`ls`/`find`.

## Setting the key (the user does this, never Claude)

Claude must **never** ask for, receive, echo or write the key value — instructions only, with
a placeholder. Env var, not a config file, so it never lands in a repo:

```bash
pip install 'graphifyy[gemini]'
echo 'export GEMINI_API_KEY="PASTE_KEY_HERE"' >> ~/.bashrc && source ~/.bashrc
```

Claude Code inherits the environment of the shell that launched it, so **restart Claude Code**
afterwards. Verify without revealing it: `echo "${GEMINI_API_KEY:+SET}"`. Optional model
override: `GRAPHIFY_GEMINI_MODEL` (default `gemini-3-flash-preview`).

State on 2026-09-06: both `GEMINI_API_KEY` and `GOOGLE_API_KEY` **unset**, and the `[gemini]`
extra **not installed** — so any semantic graphify run today would bill Claude.

Related: [[devbible-validation-ledger]] · [[devbible-locks]]
