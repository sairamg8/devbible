---
name: feedback-workflow-cannot-drain
description: 2026-09-21 — a running Workflow cannot be told "finish the current agents, launch no more"; TaskStop aborts everything in flight. Bound every Workflow to the batch the user approved, so "let them finish" means simply not launching the next one.
metadata:
  type: feedback
---

# A running Workflow cannot be drained — only aborted

**2026-09-21, ~45 minutes into the python run, the user said:**

> *"Once current agents complete do not deploy new ones and enough please save session progress"*

I had launched ONE Workflow holding an 11-topic rolling queue (13 jobs, 3 slots). The script is
plain JavaScript with no filesystem access, so nothing outside it can change its queue, and the
worker loop takes the next job **the instant a slot frees**. There was no way to honour both halves.

**Measured:** `TaskStop` on the workflow aborted the three in-flight authors — their transcripts
stopped growing in the same second (a 45 s re-check confirmed it). Nothing was lost that mattered:
the per-file committer had already committed 12 chunks of topic 08, both defect jobs had finished and
committed, and the banks were on disk. But the user had asked for the agents to be **allowed to finish**,
and I could not give them that.

Bounds the honest options I had: (a) let it run and break "do not deploy new ones", (b) abort now and
break "let them complete". I chose (b) because the standing worry is usage (see
[[feedback-one-workflow-at-a-time]]), and said so.

## How to apply

- **One Workflow = one bounded batch — at most 3 topics, one per slot — and then the script ENDS.** The
  next batch is a new Workflow, launched only after reading the previous result. Then "let the current
  agents finish" is simply *do not launch the next Workflow*, and it costs nothing.
- If a rolling queue is truly needed, put a stop gate in the job loop: before each dispatch, a tiny
  agent reads a stop file in the store (`devbible/STOP`). One cheap call per job buys a real drain.
- **Never promise "I'll stop once the current agents complete" for a running Workflow.** Say what
  `TaskStop` does before using it.
- Keep the per-file committer running for the whole run (`shared/scripts/py-autocommit.sh`). It is the
  reason an abort costs ≤ 1 file per agent. Do not edit that script while it runs — the running bash
  reads it by offset and exits with status 2.

Related: [[feedback-one-workflow-at-a-time]] · [[cursor-python-phase7]] · [[progress-python-pages]]
