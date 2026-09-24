---
name: devbible-feedback-answer-simply
description: The user wants SHORT, simplified answers every time — asked twice on 2026-09-04 ("simplify", then "every time you respond i need simplified answre"). Lead with the direct answer; keep depth for the docs pages, not the chat.
metadata:
  type: feedback
---

# 🔴 Answer the user briefly. Every time.

**Said twice on 2026-09-04**, session `cb25d15f`:

> *"Whats the status with next js ? simplify"*

> *"I want every time you respond i need simplified answre"*

**Why:** the second ask came after several long status write-ups with tables, headed sections
and multi-paragraph findings. The user asked a two-part question — *which chapter, how much
pending* — and did not want a report. The standing instruction is **every time**, not
per-question.

## How to apply

- **Lead with the answer.** Which chapter. How many pages. Then stop.
- **A number beats a table** for a status question. Tables are for when they ask for a
  breakdown.
- **Findings go in the page and the memory store, not the chat.** The depth bar governs
  `docs/`; it does not govern replies. A commit message is the right place for the detail —
  it is already being written and it is where the next session looks.
- **Still report faithfully** — brief is not the same as omitting a failure, a blocked item,
  or something got wrong. Say it in one line instead of a section.

⚠️ **This does not lower the bar for the corpus.** Pages stay exhaustive; the 300-line cap is
still a file-size rule and never a content budget. Only the conversation gets shorter.

## 🔴 RECURRED 2026-09-06, session `4bb50618` — third time

Angular topic 03. Every reply that session ran to tables, headed sections and multi-paragraph
findings: a six-row table to say three files were over the cap, a seven-row table plus a
"## What chunk 10 is about" essay when the user had asked one short question, and a full
status block appended to answers that did not ask for status. The user's pull-up was
*"i do not need sooo much explanation did you read any hard rule to simplify ?"*

**The answer to that question was no.** This file existed, said exactly this, and was not
opened. The session read `LOCKS.md` and `CURSOR-ANGULAR.md` — the resume path — and skipped
the feedback memories entirely.

🔴 **The rationalisation to watch for, because it is what happened:** the authoring contract
says *exhaust the topic, 300 lines is a cap and never a content budget*, and that framing
bleeds into the chat. It governs `docs/` ONLY. Being deep in a corpus that rewards
exhaustiveness is exactly when this rule gets dropped.

**So: a devbible session must open the feedback memories, not just the cursor.** The resume
path answers *what to write next*; it says nothing about *how to talk*. `INDEX.md` lists both.

Related: [[devbible-locks]] · [[feedback-answer-the-question-asked]]
