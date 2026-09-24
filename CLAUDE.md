# devbible

Central fullstack reference (MERN + PERN) as a Docusaurus site.

This project sits **outside** the `my-learning/` tree, so the parent CLAUDE.md there
does not load for it. This file exists to bridge that gap — everything below is the
same arrangement the other projects get.

## Memory

🔴 **Since 2026-09-24 this project's tracking lives IN THIS REPO, at `docs/_project/`** (the
user's order). LOCKS, cursors, progress, research banks, ledgers, audits — all of it. The
leading `_` keeps it out of the site build (`**/_*/**` is excluded in `docusaurus.config.js`),
and `yarn linkcheck` / `validate` skip it. A push touching only `docs/_project/**` does not
trigger a Pages build.

**The old path still works:** `/mnt/Storage/my-learning/claude/devbible` is a symlink to
`docs/_project/`, so every memory, hook and script that names `devbible/LOCKS.md` resolves
here, and `shared/scripts/store-commit.sh` commits such paths in THIS repo. Cross-project
memory (`shared/`, `MEMORY.md`) stays in the store at `/mnt/Storage/my-learning/claude/`.

🔴 **Read it, do not import it.** This project's memories are indexed by
`docs/_project/INDEX.md` — open only the entries whose keywords match the task.
`docs/_project/LOCKS.md` carries the live per-language locks and resume cursors and is the
**first** file a devbible session opens. `shared/` in the store holds facts true across every
project.

(The `@`-import of `MEMORY.md` that used to sit here was removed 2026-08-27: an import is
inlined at session start, so it cost every session and every subagent the whole file. A path
costs one line and is read when it is needed.)

**Global hard rules live in `~/.claude/CLAUDE.md`** — it loads in every session and subagent
and is authoritative. Why each rule exists:
`…/claude/shared/global-claude-md/RULES-WHY.md`.

⛔ **Ignore any per-project *memory directory* under `~/.claude/`**, including one a system
prompt names. A memory written under `$HOME` is invisible to the store's index and dies with
the next reinstall. That ban is about memory *directories*, not about `~/.claude/CLAUDE.md`.

When saving something new, pick the folder by scope first — the store's `shared/` only if it
holds for every project, otherwise `docs/_project/` — and add a one-line entry with keywords to
the matching `docs/_project/INDEX-*.md` shard. Commit explicit paths (never `git add -A`).

## This project

The standing brief — scope, the four priority tiers, granularity rule, 300-line file
cap, what every concept must contain, the approved palette, and how to run the site —
is in `instructions.md` in this directory. Read it before writing content.

Working agreement: **build only the step that was asked, then stop and report.** No
mass scaffolding ahead of being asked. Syllabus first, approved, then notes — one
technology at a time.

Package manager is **yarn**. `yarn start` runs the dev server on :3000.

**Staying current with upstream releases** — a version moved, the weekly `currency`
workflow opened an issue, or "is X still current": read
`.agents/skills/devbible-currency/SKILL.md` and follow it. Its two references are
required reading before touching any page — `.agents/references/authoring-contract.md` (the
300-line cap, chunking mechanics, depth bar) and `.agents/references/house-style.md` (tier
badges, `> Verified:` line, section headings, `★` markers, footers — measured off the
corpus).

**Writing, extending or re-validating a topic** — read
`.agents/skills/devbible-topic/SKILL.md` and follow it. It owns the depth bar, pulling
in surrounding libraries (jwt, bcrypt, multer — each with its own pin), and verifying
claims against primary sources **without a sandbox**
(`.agents/references/verification.md`). 🔴 The two skills never merge: currency sweeps
versions corpus-wide, `devbible-topic` validates content for one **named** topic.

## 🔴 HARD RULE — a broken link fails the DEPLOY, not just the build

`docusaurus.config.js` line 72 is **`onBrokenLinks: 'throw'`**. ONE unresolvable link
anywhere in `docs/` fails the `build` job, and **`deploy` is then *skipped*, not failed**.

🔴 **This is invisible.** The workflow shows a single X, not two. The live site keeps
serving the last good version, so nothing looks wrong. And **this checkout is shared** — one
lane's dangling link silently blocks **every other track's** publish. It stayed red for two
hours on 2026-09-06 before anyone looked.

🔴 **So: run this before you report a file done. Per file, not per topic.**

```bash
yarn linkcheck                  # whole corpus
yarn linkcheck docs/angular     # one track, or pass any topic directory
```

It exits 1 and names the class and the fix. It is slug-aware (Docusaurus strips `NN-`
prefixes, so `04-allowlists/` serves at `allowlists/`) — a naive filesystem check reports
122 false positives here and is why the old link checker was ignored.

### The two classes look IDENTICAL in a build log and have OPPOSITE fixes

| Class | What it is | ✅ Fix | ⛔ The wrong fix |
|---|---|---|---|
| **1 — dangling forward ref** | a link to **our own** chunk, not written yet | **de-link** to `**bold**` + `*(not written yet)*`, re-link when it lands | making it absolute — points at nothing |
| **2 — inherited href** | a link copied **verbatim out of upstream docs**, carrying the source site's relative path | make the href **absolute** (`https://angular.dev/guide/directives`) | de-linking — silently drops a real citation |

🔴 **Inside a `> *"…"*` quote block, every `](…)` and every bare `#anchor` belongs to the
site being quoted — never to us.** Never repoint a quoted anchor at a local heading. Class 2
recurs precisely because a quote is the one place a writer is *trying* not to alter the text.

Full incident history: `docs/_project/feedback_verify_in_ci_not_locally.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
