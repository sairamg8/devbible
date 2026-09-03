# Prompt — devbible, next pending Java task

You are working in the **devbible** repo at `/mnt/Storage/Backup/Knowledge/devbible` — a
Docusaurus reference corpus. Your lock this session is **Java, and nothing else**: do not edit
anything outside the one topic directory named below, not even to fix a broken link elsewhere.

## Read these first, in this order, and follow them

This project has an agent-neutral skill that owns *how* to do this work. It is written for you
specifically — Claude, Codex, Grok, Amp, Gemini and Cursor all run it identically.

1. **`AGENTS.md`** § *Writing a topic* — your entry point.
2. **`.agents/skills/devbible-topic/SKILL.md`** — the procedure. Follow it.
3. Its three required references, which the skill will tell you to read:
   - `.agents/references/authoring-contract.md` — the depth bar and the 300-line cap
   - `.agents/references/house-style.md` — tier badges, `> Verified:`, `★` markers, footers
   - `.agents/references/verification.md` — 🔴 how to be accurate **without a sandbox**
4. `instructions.md` — the standing brief (tiers, granularity, scope).

**Everything below is only the task-specific brief the skill cannot know.** Where this file and
the skill disagree, **the skill wins** — tell me about the disagreement rather than picking one
silently.

---

## The task

Take **phase 12 · topic 09 · Distributed tracing** to close.

**Directory:** `docs/java/pages/phase-12-jvm-production/09-distributed-tracing/`
**Start with exactly:** `03c-tracestate-and-baggage.md`, `sidebar_position: 7`
**Tier:** `Know` → `<span className="db-tier t-know">Know</span>`

Six chunks exist at positions 1–6. Read them before writing so you continue the argument rather
than restart it:

| pos | file | covers |
|---|---|---|
| 1 | `01-the-request-that-vanished.md` | six services, one slow call, logs that cannot be joined |
| 2 | `02-traces-spans-and-context.md` | the vocabulary: trace, span, parent, attributes, events |
| 3 | `02b-span-kind-and-the-shape-of-a-trace.md` | span kind and what it does to trace shape |
| 4 | `03-context-propagation.md` | how context crosses a process boundary |
| 5 | `03b-the-traceparent-header.md` | the W3C `traceparent` header, field by field |
| 6 | `03b2-traceparent-mutations-and-processing.md` | mutation and processing rules |

## 🔴🔴 The filename trap — this will cost you an hour if you miss it

**`_plan.md` in that directory has WRONG filenames. Do not follow them.** It names
`03b-propagation-that-breaks.md`, but disk already has `03b-the-traceparent-header.md` and
`03b2-…`. The earlier author's prose already links these **eight exact names**, and those links
are the contract:

```
03c-tracestate-and-baggage.md          05b-custom-spans-and-annotations.md
03d-b3-and-the-other-formats.md        06-sampling.md
03e-propagation-that-breaks.md         06b-the-trace-you-needed-was-not-sampled.md
05-wiring-it-in-spring-boot.md         08-cost-and-overhead.md
```

Use `_plan.md` for **arguments only**, never for filenames. Then add a `README.md` index
(`sidebar_position: 0`) to close the topic. Positions stay contiguous from 7 upward.

## 🔴 Two things to resolve as you go, per chunk

**1. The 25 dangling markers.** The six existing chunks carry 25 placeholders of the form
`**03e** *(not written yet)*`, left because those chunks did not exist. **The moment you create a
chunk, convert every marker pointing at it into a real link:**

```
**03e** *(not written yet)*   →   [03e](03e-propagation-that-breaks.md)
```

Per chunk, not at the end. This is what keeps the deployed build at zero broken links.

**2. The footer marker.** Every page in this topic currently ends in a bare `{/* FOOTER */}`.
Per `house-style.md`, that is a placeholder a fork leaves behind, and **a topic is not closed
while one remains** — it is a valid MDX comment with no link, so every other check passes a page
that has no navigation at all. Replace it with the real footer:

```markdown
---

← [Topic index](README.md) · Next → [03d · B3 and the other formats](03d-b3-and-the-other-formats.md)
```

Only link files that exist **right now** (`ls` first); anything unwritten stays bold text plus
`*(not written yet)*`. Resolve the footers on the six existing chunks too, once their successors
exist. `grep -rln '^{/\* FOOTER \*/}$' <dir>` must be **empty** before you call the topic closed.

⚠️ Note for context: this is a corpus-wide backlog, not a defect local to this topic — about
1,318 pages repo-wide still carry bare markers. Fix them **inside your topic directory only**.

## Version spine — do not re-derive, do not drift

**JDK 25 (LTS)** · **Spring Boot 4.1.0 / Spring Framework 7.0.8** · **Micrometer 1.17.0**.
`../_PHASE-NOTES.md` is binding — read it.

## Verify before you assert — the open questions for this topic

Per `verification.md`'s evidence ladder, at the cheapest sufficient tier:

- The **W3C Trace Context** specification: `tracestate` format, list-member limits, mutation
  rules, and how **baggage** differs from `tracestate`. From the spec itself, quoted.
- The **Micrometer Tracing** bridge artifact names on **Boot 4.1**, and which bridges are still
  supported (Brave vs OpenTelemetry). Quote the reference.
- Whether the **OpenTelemetry Java agent** supports **JDK 25**.
- ⚠️ **No fabricated trace waterfalls, span timings or overhead percentages.** There is no
  sandbox. *"The documentation does not state whether X"* is a legitimate sentence; a confident
  invention is the only unacceptable outcome.

## Boundaries — link, do not re-teach

- `../07-logging-done-right/README.md` owns the log — one event, one reader at 03:00.
- `../08-metrics-with-micrometer/README.md` owns aggregates; its `09b-exemplars.md` is the wire
  between an aggregate and one traced request.
- `../12-graceful-shutdown/README.md` owns stopping.
- Phase 14 / 15 own the architecture that makes tracing necessary.

## Cadence and scope

- **Commit per file, by explicit path.** 🔴 **Never `git add -A`** — several sessions write to
  this checkout simultaneously, and the Next.js session is active right now. Do not touch
  `docs/nextjs/`, `docs/python/`, or any track that is not Java.
- **Do not run `yarn build`.** If you need a full build check, read the last deployed build's log:
  `gh run list --limit 5`, then `gh run view --job=<job-id> --log`.
- The deployed build is currently at **zero broken links and zero warnings**. Keep it there.

## Report when you finish each file

Per the skill: path, line count, gotcha count, interview-question count · every claim you could
**not** confirm and what you wrote instead · anything wrong outside your topic, **found not
fixed**.

## After topic 09

Phase 12 has two rows left, both `_plan.md` only and both free to claim on
`/mnt/Storage/my-learning/claude/devbible/JAVA-BOARD.md`:

- **11 · GraalVM native image** (`Know`) — instant startup vs closed-world limits
- **13 · JVM flags that matter in 2026** (`Know`). 🔴 On JDK 25 an unrecognised `-XX:` flag
  **fails the launch** unless `-XX:+IgnoreUnrecognizedVMOptions` is set; CMS and PermGen flags are
  gone; ZGC is generational and `-XX:-ZGenerational` was removed in JDK 24 (JEP 490).

Closing 09, 11 and 13 takes phase 12 to 15/15.

---

**Begin: read `AGENTS.md` § Writing a topic, then the skill and its references, then start on
`03c-tracestate-and-baggage.md`. Fetch the W3C Trace Context specification before you write.**
