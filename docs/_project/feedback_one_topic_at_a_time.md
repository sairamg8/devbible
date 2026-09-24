---
name: devbible-feedback-one-topic-at-a-time
description: Standing order 2026-08-30 — finish and CLOSE the current topic before opening another, and distribute parallel work inside that one topic rather than across topics. Applies to every devbible language, not just Java.
metadata:
  type: feedback
---

# One topic at a time — close it, then move

**The user, 2026-08-30, mid-session while three agents were live on Java phase 11:**

> *"Work on per chapter at once and do not start new one unless current chapter complete even
> work distribution should be with in the same pending chapter"*

Said in the same breath as the agent ceiling being restated:

> *"You can deploy max sub agenets 3 including you make sure they follow hard rules and they
> should explain java in such way like complete indepth explanation about a topic and with
> gotchas and pitfalls if applicable there is no limit for important q and a for that concept"*

## The rule

1. **A topic is the unit of work.** It is not done when the chunks exist — it is done when the
   chunks exist **and** it has a `README.md` index **and** the four UI boards are wired.
2. **Do not open topic N+1 while topic N is open.** Not to "make progress somewhere", not
   because a fork finished early and looks idle.
3. **Parallelism goes *inside* the topic.** Three agents live means three agents in the same
   topic directory on disjoint files, with reserved `sidebar_position` bands — not one agent
   per topic.

## Why — this is not a style preference

The user has been burned by exactly one failure mode, repeatedly: **a session ends and leaves
several topics each partly written, and the next session cannot tell finished from unfinished.**
The same reasoning is behind the 3-agent ceiling, in the user's own earlier words:

> *"if you deploy more than 3 agents (including you) once we hit the limit it will be messy to
> check what was completed and what was done"*

The cost is **accounting, not tokens.** One closed topic plus one untouched topic is a legible
state. Two topics at 60% is not, and no amount of progress-file prose fixes it — the reader has
to open every file and judge. Three topics at 60% is worse than one topic at 100% even when the
raw line count is higher.

⚠️ **This supersedes the older "dispatch one `devbible-author` fork per open topic" pattern**
written into `_PHASE-NOTES.md` "How to run a session" step 1. That step predates this order.
When they conflict, this file wins.

## 🔴 IT RECURRED — 2026-09-06, and in a lane that felt exempt

**What was done wrong.** Working audit item A2 (validate the imported toolchain tracks), the
session deployed **four agents across four different tracks** — babel, vite, playwright and
tanstack-query — one agent per track. The user's correction, immediate and correct:

> *"You picked multiple languages you supposed to pick one language deploy the agents it
> needs so it was easy to complete this way rather than picking 3 to 4"*

**Two breaches in one move, both already written above:**

1. **Four tracks open at once**, when the rule is one — and "parallelism goes *inside* the
   unit" applies exactly as written. Four tracks each at 6 pages of 17 is the two-topics-at-60%
   state the rule exists to prevent, multiplied by four.
2. **Four subagents**, against the ceiling of *"max sub agents 3 including you"*.

**Why it did not feel like a violation, which is the part worth recording.** The tracks were
tiny (one page per topic directory), the work was *validation* rather than authoring, and the
validation pipeline's own text says fan-out is allowed and *"ten units is a batch"*. None of
that is an exemption. The pipeline is about how many **units** run at once; this rule is about
how many **tracks** are left half-done when the session ends. A pipeline sentence about batch
size does not override a standing order about accounting.

🔴 **The shape it should have had:** pick **one** track — babel, say — and give its agents
disjoint slices of *that* track: agent 1 units 01–06, agent 2 units 07–12, agent 3 units
13–18. Track closed, stamped, ledger row banked, and the next track untouched and legible.
The same total number of pages, in a state a cold session can read.

Operative copy for Java lives in [[cursor-java]] as standing-order item 2, so a session that
reads only the cursor still gets it. Related: [[devbible-locks]].
