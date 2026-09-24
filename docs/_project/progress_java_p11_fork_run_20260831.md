---
name: progress-java-p11-fork-run-20260831
description: Phase 11 four-fork run of 2026-08-31 — what each fork wrote before being stopped, and the EXACT 26 dangling forward links that must be resolved before the site builds. Open this before touching phase-11 topics 10, 11 or 12.
metadata:
  type: project
---

# Java · Phase 11 — the four-fork run, 2026-08-31 (session `01cb3b13`)

⏸ **STOPPED BY THE USER MID-RUN** (*"At the moment please stop"*). All four forks were stopped
cleanly with `TaskStop`; every complete file they had written was preserved and committed by the
coordinator, and their scratch files were deleted. **`docs/java` working tree is clean.**

## What the user authorised

> *"You can deploy agents make sure to adhere instructions and especially hard rules and finish
> the current picked phase just split the work"* — then, later, *"Once done current phase please
> hold untill my further notice"*, and finally *"At the moment please stop"*.

**The split was one topic per agent**, except topic 12 (Master, 13 planned chunks) which was split
across two forks on disjoint `sidebar_position` bands 1–29 / 30–59.

## State at stop

| Topic | Chunks | Lines | ★ | Over cap | Index |
|---|---|---|---|---|---|
| **09 · JaCoCo** (coordinator) | 22 | 5,306 | 304 | 0 | ✅ **CLOSED** |
| 10 · Property-based (fork A) | 13 | 2,884 | 115 | 0 | ❌ none |
| 11 · Mutation testing (fork B) | 10 | 2,585 | 105 | 0 | ❌ none |
| 12 · Real-world scenarios (forks C+D) | 17 | 4,140 | 206 | 0 | ❌ none |

**0 files over the 300-line cap anywhere.** Only topic 09 is closed; 10, 11 and 12 are
`⚠️ partial` — chunks on disk, no `README.md`.

## 🔴🔴 THE BLOCKER — 26 DANGLING FORWARD LINKS. THE SITE WILL NOT BUILD CLEAN.

The forks wrote forward links to chunks they had not reached when stopped. **Every one must
either be written or demoted to plain bold prose** (the phase-13 link-clean precedent, commit
`39ad34bc`). This is the single most important fact in this file.

**`10-property-based/`** (7): `04-finding-properties.md` · `05-generators.md` ·
`05b-constraining-generation.md` · `06-shrinking.md` · `07-reproducibility.md` ·
`08-edge-cases-exhaustive-and-data.md` · `09-statistics.md`

**`11-mutation-testing/`** (8): `03c-the-returns-mutators.md` · `03d-optional-mutators.md` ·
`04-reading-a-report.md` · `04b-equivalent-mutants.md` · `05-wiring-it-up.md` · `05b-gradle.md` ·
`05c-scoping-and-incremental.md` · `06-the-cost.md`
⚠️ Topic 11's plan also owes `07-what-this-phase-taught.md` — **the closing argument for the
whole phase**. Not yet linked, so still renameable.

**`12-real-world-scenarios/`** (11): `02d-vendor-clients-and-private-methods.md` ·
`02e-the-agent-tax-and-the-decision-table.md` · `03-mocking-an-outbound-http-api.md` ·
`03b-wiremock-and-mockwebserver.md` · `03c-the-error-paths-nobody-writes.md` ·
`03d-asserting-what-you-sent.md` · `07-async-scheduled-and-eventual.md` ·
`08-a-message-consumer.md` · `08b-the-container-poison-messages-and-redelivery.md` ·
`09-caching-and-idempotency.md` · `09b-idempotency-and-the-double-charge.md`
⚠️ Topic 12 also still owes `10-json-contracts-and-approval-tests.md`, `11-the-legacy-class-with-no-seams.md`
and `12-the-checklist.md` from its plan. **Note chunk 03 — the most-asked scenario, mocking an
outbound HTTP API — was never written at all.**

**Re-run the audit that produced this list:**

```bash
cd /mnt/Storage/Backup/Knowledge/devbible/docs/java/pages/phase-11-testing
for t in 10-property-based 11-mutation-testing 12-real-world-scenarios; do
  grep -oh '](0[0-9][a-z0-9]*-[a-z0-9-]*\.md)' $t/*.md | sed 's/.*](//;s/)//' | sort -u \
    | while read x; do [ -f "$t/$x" ] || echo "$t -> DANGLING $x"; done
done
```

## 🔴 What the COORDINATOR still owes topic 12 — forks were told NOT to do it

1. **Renumber `12-real-world-scenarios/` contiguously.** Forks C and D used disjoint bands
   (1–29 and 30–59) by design, so positions are gappy. Collapse to 1..N **without renaming any
   file** — inbound links point at exact filenames (the topic-04 precedent: a 17-line diff, all
   of them `sidebar_position`).
2. **Write its `README.md` index.** Both forks were explicitly instructed not to.

Topics 10 and 11 each own their whole directory, so they need no renumber — only an index.

## Verified findings the forks banked (do NOT re-derive)

- **Topic 10's load-bearing fact is a version collision**, and the fork gave it four chunks
  (`02b-the-version-collision`, `02b2-what-the-evidence-shows`, `02c-what-to-do-about-it`,
  `02c2-jqwik-without-its-engine`). jqwik is a **separate JUnit Platform engine**, not a Jupiter
  extension, and the stack pins JUnit Jupiter 6.0.3 via Boot 4.1.0. **Read those four chunks
  before writing anything else in topic 10** — the fork did the primary-source work.
- **Topic 11** banked the mutation mechanism and its blind spots across `02`–`02c` and the
  mutator inventory across `03`–`03b2`, including `avoidCallsTo` and logging.
- **Topic 12** banked the JS/React→Java map (`01b`) and its four breaks (`01c`) — the chunk the
  user specifically asked for — plus the SDK arc `04`–`04d` and security `06`–`06c`.

## Environment

⚠️ Several sessions share this checkout. **Never `git add -A`.** The coordinator hit
`index.lock` contention with a fork twice and used a retry-with-backoff loop; that pattern is
worth reusing when forks are live.

See [[java-board]] for claim state, [[progress-java-p11-t09-jacoco]] for the closed topic,
[[cursor-java]] for the standing order.
