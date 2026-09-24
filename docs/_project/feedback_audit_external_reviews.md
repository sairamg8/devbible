---
name: devbible-audit-external-reviews
description: External reviews of the Dev Bible get audited against instructions.md before anything is applied — they have been confidently wrong
metadata:
  type: feedback
---

The user gets the [[devbible-brief]] syllabi reviewed elsewhere (ChatGPT so far) and
brings the results back — sometimes pasted into chat, sometimes written to
**`reviews/<tech>/syllabus-review.md`** in the project. That folder is the convention;
`reviews/nodejs/syllabus-review.md` was the first, on 2026-08-09.

**Treat a review as a proposal to audit, not a task list to execute.** Check every
claim against `instructions.md` and the syllabus files before agreeing with any of it,
and say plainly which parts are wrong.

Two failure modes seen on 2026-08-09, both in reviews the user was inclined to trust:

- **A praise claim that was simply false.** One review congratulated the Node syllabus
  for hitting the brief's tier target. The brief caps Master at ~25–30%; the syllabus
  was at 35%. Praise sections get checked as carefully as suggestions — that one item
  mattered more than all four of its proposed additions.
- **Suggestions already covered.** It proposed `mock.module()` as missing when the
  mocking row already said "module mocking", and framed it as a solved native feature
  when it is still Stability **1.0 — Early development**.

**Why:** These reviews read as authoritative and arrive pre-formatted as
recommendations, so applying them wholesale is the path of least resistance. The user
asks "do you agree?" because they want an independent judgment, not a summary of what
the review said.

**How to apply:** Read the syllabus files first, then the review. Answer per item —
agree / already covered / wrong — with a file:line for each. Verify every
version-sensitive claim against live docs rather than memory; the brief requires it and
these reviews get versions wrong. Then ask which parts to apply, because "add topics"
and "rebalance tiers" are materially different work.
