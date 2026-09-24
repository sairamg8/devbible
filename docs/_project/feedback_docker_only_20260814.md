---
name: devbible-docker-only-20260814
description: The standing instruction that locked session 40090c06 to Docker & Podman — full Node-style syllabus, own worktree, no sandboxing, run to completion overnight
metadata:
  type: feedback
---

# STANDING INSTRUCTION — Docker & Podman, LOCKED (2026-08-14)

A live lock, rule 11 §11e. Session `40090c06`. Resume point:
[[devbible-docker-podman-progress]].

## How it started

The user was asking what was available to work on — which prompts exist, which
languages are defined, what is parked. On being told Docker & Podman was **listed
as technology 9 in `instructions.md` §2, in scope, with zero pages**:

> *"There was docker and podman can were there can you work on those ?"*

## The instructions, in the order they were given

Each of these arrived mid-turn while work was already moving, and each one
narrowed or corrected the plan. They are recorded verbatim because two of them
**reversed** an answer the user had already given.

1. **Scope — asked, answered, then overridden.** Offered daily-driver (~50),
   working reference (~95) or full (~170), the user first picked
   **daily-driver**, then said:
   > *"good night i am trusting that you would pick a **full syllabus just like how
   > node js is structured and writing style** and you will work on this session
   > till completes"*

   🔴 **The full scope wins.** The syllabus is 192 topics in the Node.js shape —
   4 parts, 13 phases, tier badges, phase gates, a version-facts table, a tier
   distribution counted from the badges.

2. **No sandboxing**, said three times and each time more plainly:
   > *"you need to follow instructions and there is sandboxing will verify against
   > documentation and using online"* · *"remember there is sandboxing and mainly
   > did you read those hard rule instructions ?"* · **"there is no sandboxing"**

   The first phrasing is ambiguous read alone; the third settles it. **No `ex*`
   script, no harness, nothing run.** Documentation- and web-validated, source
   named. ⚠️ **Podman 5.8.4 is installed on this machine and that changes
   nothing** — having the tool is not permission to run it.

3. **Hard rules**, asked about twice — *"did you read those hard rule
   instructions ?"* and then simply *"And hard rules ?"*. Asking twice is the
   signal that a restatement was wanted, not a yes. The reply listed them by
   number: the 300-line file-size cap, never invent output, green build proves
   nothing, scope of changes, no new sandboxes, per-file memory cadence, claim
   before writing, one technology per session, `.md` links, never `git add -A`.

4. **Own worktree**, said three times:
   > *"Please create your own tree"* · *"work there"* · *"Work on your own
   > worktree"* / *"complete it in there"*

   → `/run/media/sairam/Storage/Backup/Knowledge/devbible-docker`, branch
   **`docker-podman`**, `node_modules` symlinked. Same move both JavaScript lanes
   and React Part B made the same night.

5. **Run to completion, do not wait:**
   > *"good night do not wait for take recomended action to match the goal"*

   The user is asleep. Write a page → update the four boards → clean build →
   commit → memory → **start the next topic in the same turn**. A turn ends
   because it runs out, not because a topic finished.

## What this lock does NOT do

- It does not touch any other technology. React, JavaScript lanes A and B,
  TypeScript Parts A and B, Redis and the frontend toolchain are live in other
  sessions; **their build warnings are theirs** (113 at baseline, 0 of them
  Docker). This overrides rule 9's "pick up the next idle language".
- It does not go near `docs/nginx/` — a `devbible-nginx` worktree already exists.
- It does not edit `instructions.md`. Docker & Podman was **already** technology 9
  in the in-scope table, so unlike Git there was nothing to move out of park.

## The judgement call that was flagged and kept

The syllabus teaches **both engines together** rather than splitting them, because
`instructions.md` §2 says "Both" and because in practice you meet Docker's
ecosystem and your distribution's Podman on the same week. The ~5% that genuinely
differs is called out per topic, and **Phase 11 · Podman in depth** collects
rootless internals, pods, Quadlet and the divergences in one place so the other
twelve phases stay engine-neutral.
