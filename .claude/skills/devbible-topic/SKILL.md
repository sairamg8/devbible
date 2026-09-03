---
name: devbible-topic
description: "Write, extend, or re-validate one devbible topic to the project's depth bar — in-depth explanation, exhaustive gotchas and pitfalls, runnable examples, interview Q&A — pulling in the surrounding libraries a fullstack build actually needs (jwt, bcrypt, multer). Verifies every claim against primary sources rather than assuming. Use on \"write topic X\", \"explain X properly\", \"extend topic X\", \"validate topic X\", \"is this topic still accurate\", \"check this chapter against the docs\"."
---

# devbible-topic

🔴 **Read `.agents/skills/devbible-topic/SKILL.md` and follow it.** That file is the
procedure; this one is only the door Claude Code comes through.

Its three required references, all under `.agents/references/`:

- **`authoring-contract.md`** — the depth bar and the 300-line cap (a file-size cap,
  **never** a content budget), chunking mechanics, the split-not-a-trim proof.
- **`house-style.md`** — tier badges, `> Verified:` form, the canonical
  `## Gotchas` / `## Interview questions` headings, `**★ ` markers, footers.
- **`verification.md`** — how to be accurate without a sandbox: the evidence ladder,
  banked per-topic research, the installed-version trap.

Plus `.agents/skills/devbible-topic/references/library-scope.md` for when a
surrounding library (jwt, bcrypt, multer) earns a page and the pin it must arrive with.

**Sibling skill:** `devbible-currency` answers *"is the version right"* across the whole
corpus. This one answers *"is the explanation right, and deep enough"* for one topic.
Never merge the two passes.

Do not restate or summarise these files here. The body lives in one place on purpose.
