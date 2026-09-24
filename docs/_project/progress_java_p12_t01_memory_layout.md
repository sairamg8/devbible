---
name: progress-java-p12-t01-memory-layout
description: Java phase 12 (JVM in production) setup and topic 01 Memory layout — the phase notes, all 15 chunk plans, the verified JDK 25 facts, and what the coordinator's band established. Open when resuming phase 12 or authoring any of its topics.
metadata:
  type: project
---

# Java · Phase 12 · The JVM in production — session `4248352b`, 2026-08-31

Claimed on the user's instruction: *"pick java phase 12 and your sole task is to complete it
and you work on it and deploy another 2 agents"*, then reinforced mid-session with
*"Make sure your following hard rules especially file size limited to 300 lines but never a
content budget also deploy 2 more agents split the existing task with them"*.

Run with **three agents, the playbook's ceiling** — the coordinator plus two `devbible-author`
forks, all inside `01-memory-layout/` on disjoint `sidebar_position` bands (1–30, 31–60, 61–90).

## ✅ What landed before authoring — playbook steps 1 and 2, both done

- **`phase-12-jvm-production/_PHASE-NOTES.md`** — binding. The JDK 25 version spine, the five
  facts that make most online material wrong on this phase, the JDK 25-specific features
  (JEP 519 / 514 / 515 / 509 / 518 / 520), the fixed topic boundaries for all 15 topics, and
  the phase's own hard rules. **Read it before authoring any phase-12 topic.**
- **All 15 `_plan.md` files written**, one per topic directory. Every phase-12 topic moved from
  `⬜ open` to `📋 planned` and is now handable to a cold session. Each carries a boundary
  paragraph, a chunk table and a **"Verify, do not assume"** list naming the specific things
  that must be checked against JDK 25 rather than recalled.

## 🔴 VERIFIED JDK 25 FACTS — banked, do not re-derive

All quoted verbatim from the **JDK 25 `java` tool reference**
(`docs.oracle.com/en/java/javase/25/docs/specs/man/java.html`) unless noted.

| Fact | Source wording |
|---|---|
| Compressed oops range | *"By default this range is 32 GB."* Also: enabling them *"will automatically limit the maximum ergonomically determined Java heap size"* |
| `ObjectAlignmentInBytes` | Range 8–256, power of two. **`The heap size limit in bytes is calculated as: 4GB * ObjectAlignmentInBytes`** — plus its own note that *"you may not realize any benefits"* |
| Compact object headers (JEP 519) | Product in 25 but *"By default, this option is disabled"*; *"reduces memory footprint in the Java heap by 4 bytes per object (on average)"*; *"eventually will be the only mode of operation"* |
| Available collectors | Serial, Parallel, G1, ZGC. GC tuning guide: *"G1 is selected by default on most hardware and operating system configurations"* |
| NMT overhead | Troubleshooting guide: **5–10% JVM performance drop**, plus **two machine words added to every malloc** |
| NMT scope | *"It does not track memory allocations by non-JVM code"* — this sentence is what makes the RSS-minus-committed gap a **finding**, not a discrepancy |
| NMT subcommands | `summary`, `detail`, `baseline`, `summary.diff`, `detail.diff`; full category list captured in `11-native-memory-tracking.md` |

🔴 **The JEP 519 number and the tool reference's number disagree and both are right.** The JEP
says the header goes 96–128 bits → 64 (4–8 bytes); the tool reference says *"4 bytes per object
(on average)"*. The gap is **object alignment rounding the saving back up**. Write both and
explain the gap — this is exactly the kind of thing a reader gets wrong.

⚠️ `openjdk.org` returns **HTTP 403 to WebFetch**. Reach JEP text via search results or mirrors.

## 🔴 BOTH FORKS REPORTED — their research is in TWO SEPARATE FILES, read them

- [[research-java-p12-t01-jvm-memory-internals]] — band B: stacks, direct/mapped buffers, the
  mark word, compact object headers, virtual-thread pinning, `@Contended`.
- [[research-java-p12-metaspace-codecache-tlabs]] — band A: metaspace, the code cache, TLABs,
  generational aging, the `OutOfMemoryError` list, the heap-dump flags, and **how to reach the
  sources** (`raw.githubusercontent.com/openjdk/jdk/jdk-25+36/...` works; `curl -A "Mozilla/5.0"`
  defeats openjdk.org's 403).

🔴 **Nine facts already shipped in this topic were WRONG or incomplete and were corrected on
2026-08-31** — `UseCompressedClassPointers` deprecated in 25/obsolete in 26; `CompressedClassSpaceSize`
= 1 GB; JEP 534 makes compact headers the default in **Release 27**; `MaxDirectMemorySize` = `-Xmx`;
**nothing** bounds mapped files; the OOME list is **seven** documented, not eight;
`HeapDumpOnOutOfMemoryError` covers **heap exhaustion only**; `-XX:InitialTLABSize` **does not
exist**; and the NMT-`Other`-for-direct-buffers claim is unconfirmed and now hedged.

⚠️ **The two forks disagreed once, and the disagreement is instructive.** Band A refused to assert
`MaxDirectMemorySize == -Xmx` because the man page does not say it. Band B found `VM.java` and
proved it. **Both behaved correctly** — "the man page does not say" is a reason to read the source,
not a reason to hedge forever.

## 🔴 CORRECTION the plan asked for and the source settled

`01-memory-layout/_plan.md` asked whether `-XX:+UseStringDeduplication` is still G1-only on
JDK 25. **It is NOT.** It shipped G1-only in 8u20 (JEP 192, titled *"String Deduplication in
G1"*); the infrastructure was generalised and **Serial, Parallel and ZGC gained support as of
JDK 18**. Any article asserting the G1 restriction is pre-18 and is likely stale elsewhere too.
Recorded in `10c-string-deduplication.md`.

⚠️ **`StringTableSize` defaults are reported inconsistently by secondary sources** and are
deliberately NOT asserted on any page. Readers are told to use `-XX:+PrintFlagsFinal`.

## 🔴 WHERE THIS SESSION STOPPED — counted off disk 2026-08-31, session ended at the usage ceiling

**Topic 01 · Memory layout: 34 chunks, 8186 lines, 503 ★, 0 partial files, 0 over the cap,
working tree clean, everything committed.** The session was **wound down, not killed** — both
forks were told to finish the file they were on and stop, per the standing order.

### 🔴 THE SIX FILES STILL OWED — exact names, subjects already fixed in `_plan.md`

`03b-the-weak-generational-hypothesis.md` · `03c-tlabs-and-allocation.md` · `04-metaspace.md` ·
`05-the-code-cache.md` · `08b-compact-object-headers.md` · `08c-alignment-and-padding.md`

⚠️ **Four of the six are DANGLING LINK TARGETS.** Committed chunks link to `04-metaspace.md`,
`05-the-code-cache.md`, `08b-compact-object-headers.md` and `08c-alignment-and-padding.md`
**by exactly those names**. Writing them resolves the links; renaming them breaks eight files.

### ⚠️ `sidebar_position` is deliberately NOT contiguous

Three agents wrote into reserved bands so they could not collide: **1–30 / 31–60 / 61–90**. The
topic currently occupies **1–12, 31–41, 61–71**. **The coordinator renumbers to 1..N at close**,
after the six chunks land. Do not renumber before then, and do not "fix" a gap mid-run.

### To close topic 01
1. Write the six chunks above.
2. Renumber `sidebar_position` contiguously 1..N.
3. Write `README.md` — `sidebar_position: 0`, `sidebar_label: "Overview"`, full chunk table with
   tier badges. Copy `../../phase-11-testing/02-assertj/README.md`'s shape **exactly**.
4. Wire the four UI boards, then flip the board row to `✅ done`.

## Topic 01 · Memory layout — the coordinator's band (61–90), COMPLETE

Eleven files, **2,766 lines, 180 ★, 0 over cap**, all committed. **This band is FINISHED** — every chunk in the plan's 61–90 lane exists and is complete:

`08d-measuring-an-object` (JOL) · `09-compressed-oops` · `09b-alignment-and-class-pointers` ·
`09c-verifying-what-the-jvm-chose` · `10-strings` · `10b-the-pool-and-interning` ·
`10c-string-deduplication` · `11-native-memory-tracking` · `11b-the-nmt-baseline-workflow` ·
`11c-the-footprint-that-is-not-in-any-region` · `12-the-checklist`

### Splits, all proven — `wc -l` and `grep -c '^\*\*★'` before and after, both UP

| Split | Before | After | Boundary |
|---|---|---|---|
| 09 → 09 + 09b | 349 / 19 | 619 / 35 | mechanism · levers |
| 09b → 09b + 09c | 339 / 18 | 534 / 32 | levers · verification |
| 10 → 10 + 10b | 394 / 23 | 605 / 37 | representation · identity-and-sharing |
| 10b → 10b + 10c | 364 / 22 | 461 / 32 | pool+intern · deduplication |
| 11 → 11 + 11b | 317 / 21 | 402 / 30 | mechanics · technique |

Renumbering: the NMT split took `11b`, so the plan's *"footprint that is not in any region"*
chunk became **`11c`**. Inbound links in `09`, `09c`, `11` and `_plan.md` were updated; 0 dangling.

## Method notes for whoever runs the next phase-12 topic

- 🔴 **Every one of my chunks needed splitting.** Writing to exhaustion on a JVM-internals topic
  reliably produces 320–400 lines. **Plan for the split, do not plan the page to fit** — and
  record the before/after numbers in the commit message, which is the only thing that makes a
  trim impossible to pass off as a split.
- 🔴 **`index.lock` races are live in this checkout.** A sibling session was committing phase 13
  concurrently and one commit failed outright. **Wrap `git add`/`git commit` in a retry loop with
  a short sleep**, and `git status --porcelain` after.
- ⚠️ **Line-wrapped inline code spans** (`` `jcmd <pid>\nVM.flags` ``) are valid markdown but
  fragile in MDX because the `<pid>` looks like a tag to a naive check. Keep spans on one line.
- **No sandbox held throughout**: no fabricated GC log, NMT report, JOL dump, `pmap` output,
  byte count or timing appears on any page. Where output shape was needed it is quoted from
  documentation or explicitly labelled a schematic.

## Other sessions active in this checkout, 2026-08-31

- `5bd19f1e` — phase 11 topic 08 (test data patterns), writing live. **Left alone**; several of
  its files tripped the cap hook during this session and they are its to split, not mine.
- An unnamed session committing **phase 13** (OAuth2/OIDC) topic 02 and topic 06.

Related: [[cursor-java]] · [[java-board]] · [[java-playbook]]
