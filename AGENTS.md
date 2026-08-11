# Grok project rules — devbible

Central fullstack reference (MERN + PERN) as a Docusaurus site.

## Memory (Grok)

**Store:** `/mnt/Storage/my-learning/grok/`  
Read `MEMORY.md` → `shared/INDEX.md` (and preferences) → `devbible/INDEX.md`.
Open only keyword matches. **300 words max** per memory file.

Ignore `~/.grok/memory/` for curated facts. (Claude agents use
`my-learning/claude/` instead — do not mix.)

## This project

Standing brief: `instructions.md` in this directory — read before writing
content. Tiers, 300-line content cap, palette, process all live there.

Working agreement: **build only the step that was asked, then stop and report.**
Syllabus first, approved, then notes — one technology at a time.

**Subagents:** do not spawn unless the user **explicitly** asks. Default is single-agent.

**Never delete** docs, pages, reviews, or prior work — additive edits only. Ask
if removal seems required.

Memory chunks: INDEX/parent must carry a **short summary** per file so unmatched
memories are never opened.

Package manager: **yarn**. `yarn start` → :3000.

**Explanation cadence:** each topic page must be visible in the UI as written
(dev server + `src/data/progress.js` bump). After a **complete phase**, run
`yarn build` once and fix all errors in that pass — not a full build after every
single page by default.
