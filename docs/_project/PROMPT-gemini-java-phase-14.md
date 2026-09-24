---
name: prompt-gemini-java-phase-14
description: The hardened paste-in prompt for running Gemini on devbible Java phase 14 (Microservice architecture). Written 2026-09-04 with the disk state measured that day. Designed against Gemini's two observed failure modes on this corpus — trimming/stubbing to look finished, and asserting stale or invented Spring Cloud facts.
metadata:
  type: project
---

# Prompt — Gemini · devbible Java phase 14 · Microservice architecture

**Written 2026-09-04 by session `77cb65cf`.** Every number in the "current state" table
was measured off disk that day, so Gemini cannot argue with it or discover a different
reality and improvise.

**Design notes (for us, not for Gemini):** the two failure modes this is built against are
(a) producing something that *looks* complete — stubs, elisions, trimmed sections, a README
over three chunks — and (b) confident staleness, because almost every Spring Cloud sample
online predates the Oakwood train. The countermeasures are the machine-checkable Definition
of Done, the self-audit it must paste before claiming a file is finished, the explicit
anti-pattern list, and the requirement to *name the change* rather than silently write the
new form. Everything below the line is the prompt.

---

# 🔴 STANDING ORDER — devbible · Java · Phase 14 · Microservice architecture

You are authoring reference documentation into an existing, live corpus. This is not a
greenfield writing task and it is not a summarisation task. The corpus has hard rules that
are mechanically enforced, and a page that violates them is rejected and rewritten, so
reading the rules first is strictly cheaper than not.

## 0 · Before anything else, read these five files in full

They live in the repo, they are agent-neutral, and they are the contract. Do not start
writing while you have only skimmed them.

| Path (relative to the repo root) | What it governs |
|---|---|
| `.agents/skills/devbible-topic/SKILL.md` | The job itself — depth bar, research procedure, verification |
| `.agents/references/authoring-contract.md` | 🔴 The 300-line cap, chunking mechanics, what every page must contain |
| `.agents/references/house-style.md` | Tier badges, the `> Verified:` line, headings, `★` markers, footers |
| `.agents/references/verification.md` | 🔴 How to be accurate with **no sandbox** — the evidence ladder |
| `docs/java/pages/phase-14-microservice-architecture/_PHASE-NOTES.md` | 🔴 **Binding for this phase.** The version spine and the eight facts that make most published samples wrong |

**Repo root:** `/mnt/Storage/Backup/Knowledge/devbible`
**Your directory, and the only one you may write in:**
`docs/java/pages/phase-14-microservice-architecture/`

## 1 · The current state of the phase — measured off disk 2026-09-04

Do not re-derive this and do not contradict it without running the measurement yourself
and showing the output.

| # | Topic | State | Chunks | Lines | ★ | Next `sidebar_position` |
|---|---|---|---:|---:|---:|---|
| 01 | Monolith first — honestly | ⚠️ partial, **no index** | 39 | 9,166 | 437 | 40 |
| 02 | Service boundaries from bounded contexts | ⚠️ partial, **no index** | 33 | 8,285 | 373 | 34 |
| 03 | Database-per-service | 📋 `_plan.md` only | 0 | — | — | 1 |
| 04 | Sync vs async as the coupling decision | ⚠️ partial, **no index** | 34 | 7,933 | 385 | 35 |
| 05 | Inter-service REST that survives change | 📋 `_plan.md` only | 0 | — | — | 1 |
| 06 | gRPC | 📋 `_plan.md` only | 0 | — | — | 1 |
| 07 | API gateway with Spring Cloud Gateway | 📋 `_plan.md` only | 0 | — | — | 1 |
| 08 | Service discovery | 📋 `_plan.md` only | 0 | — | — | 1 |
| 09 | Centralized configuration | 📋 `_plan.md` only | 0 | — | — | 1 |
| 10 | Correlation across services | 📋 `_plan.md` only | 0 | — | — | 1 |
| 11 | Consumer-driven contract testing | 📋 `_plan.md` only | 0 | — | — | 1 |
| 12 | The distributed monolith | 📋 `_plan.md` only | 0 | — | — | 1 |

**Phase total: 0 of 12 topics closed.** A topic is closed when it has its chunks **and** a
`README.md` index. Three topics have substantial content and no index; nine have a
`_plan.md` and nothing else.

Two facts about the existing 106 chunks that you must handle and not be surprised by:

- 🔴 **Every one of those 106 chunks ends with the literal marker line `{/* FOOTER */}`
  instead of real navigation.** That marker is correct *while a topic is being written* and
  is a defect the moment the topic closes. It is a valid MDX comment with no link in it, so
  **every automated check passes a page that has no navigation at all** — 1,241 pages
  across this corpus shipped that way before anyone noticed. When you close a topic you
  replace every marker in it with a real footer line.
- 🔴 **There are 201 `*(not written yet)*` markers** across topics 01 (79), 02 (44) and 04
  (65). They are plain bold prose naming a chunk that does not exist yet — that is the
  correct form, not a defect. **As each chunk lands, re-link the markers that named it.**
  A closed topic should have none left pointing inside itself.

The phase currently has **371 links, 0 broken**. Do not break that. Verify with the link
checker named in §7.

## 1b · 🔴 FIRST COMMAND: find out who else is in this directory

**This checkout is shared and several agents write to it simultaneously.** At the time this
prompt was written, a live session was actively writing **topic 02 · Service boundaries** —
it had grown from 33 to 35 chunks and had four uncommitted files touched within the previous
thirty minutes. That session may still be running when you start.

Before you claim a topic, run both of these and read them:

```bash
cd /mnt/Storage/Backup/Knowledge/devbible

# Uncommitted work by someone else, and how recently it was touched:
git status --porcelain docs/java/pages/phase-14-microservice-architecture/
find docs/java/pages/phase-14-microservice-architecture -name '*.md' -mmin -30
```

🔴 **A file with an mtime inside the last ten minutes belongs to a live session. It is not
yours.** Do not open it, do not "fix" it, do not renumber around it. Pick a topic directory
with **no** recent mtimes and no uncommitted changes, and work only there.

If every remaining topic is claimed, say so and stop rather than picking one anyway. Two
agents in one topic directory is how content gets silently overwritten here — it has
happened, and the overwrite passed every automated check.

## 2 · The order of work, and the cadence

**One topic at a time, to close.** Do not open a second topic while a first is unfinished,
and do not spread thin work across all twelve.

Suggested order — but **§1b overrides this list**: skip anything a live session is holding.

1. **04 · Sync vs async** (34 chunks) — furthest along and, at the time of writing, unheld
2. **01 · Monolith first** (39 chunks)
3. **02 · Service boundaries** — ⚠️ **was live when this prompt was written. Verify it is
   free before touching it.**
4. Then the nine planned topics in numeric order: 03, 05, 06, 07, 08, 09, 10, 11, 12

For each topic: read its `_plan.md`, do **one** research pass for the whole topic, then
write chunk by chunk, then write the `README.md` index, then replace the `{/* FOOTER */}`
markers with real navigation, then re-link the `*(not written yet)*` markers that now
resolve.

🔴 **Cadence is per file, not per topic.** Finish a file completely — including its
Gotchas and its Interview questions — before starting the next one. A topic here can run
to forty chunks and ten thousand lines; a per-topic cadence loses all of it if the session
dies.

## 3 · 🔴 The rule that is broken most often, and what breaking it costs

**300 lines is a FILE-SIZE cap. It is NEVER a content budget.**

A topic may run **1,000+ lines in total across its chunks** — that is normal and expected,
not an overrun. Topic 01 is 9,166 lines and is not finished. A topic that runs to twice as
many chunks as its `_plan.md` listed is a **correctly-exhausted topic**, not a mistake.

**Write the page in full first. Then, if it is over 300 lines, split it.**

- Split on a **concept boundary**, never on line count. The test: *would you ever want to
  read one part without the other?* If no, one page.
- A split creates a **lettered sibling** — `04-x.md` becomes `04-x.md` + `04b-y.md`. Never
  renumber; renumbering breaks every inbound link in the corpus.
- Each half gets its **own** frontmatter, tier badge, `> Verified:` line, `## Gotchas` and
  `## Interview questions`.
- **Redistribute** the existing gotchas and questions to whichever half each is actually
  about. Do not leave them all in the first file.

### 🔴 Prove every split. This is not optional and it is checked.

Before splitting, record:

```bash
wc -l <the file>
grep -c '^\*\*★' <the file>
```

After splitting, both totals **must be higher**. A split redistributes content and adds
per-chunk scaffolding, so it never nets out lower.

**Why this exists:** a trim passes the cap check, the MDX check and the link check, and is
**indistinguishable from a split in a file listing.** Trimming disguised as splitting has
silently destroyed content in this corpus **four separate times**. If either total fell,
you trimmed — restore the original and split it again.

**Put the before/after numbers in your report for every split you perform.**

## 4 · 🔴 The anti-patterns — each of these is a failed page, not a rough draft

Read this list twice. Every item on it has actually happened here.

1. ❌ **Trimming, rewording, merging or dropping anything to fit the cap.** See §3.
2. ❌ **`...` elisions in code.** Every example is runnable and complete, with realistic
   names. Anything genuinely not runnable is labelled `// pseudo-code`.
3. ❌ **Writing "the fix is X" without showing X in code.** A gotcha's fix is *shown*.
4. ❌ **A stub, a placeholder, a "TODO", or a section header with nothing under it.**
5. ❌ **Five gotchas because five looked like enough.** Exhaust the topic. If it fails
   eleven ways, list eleven. If it has twenty interview questions, write twenty.
6. ❌ **Pages clustering just under 300 lines**, or a run of near-identical gotcha counts
   across files. Real topics vary; a template does not. This is a checked tell.
7. ❌ **Naming the hard case and then demonstrating the easy one.**
8. ❌ **A ` ```console ` block, a timing, a byte count, a latency figure, a stack trace or
   any other program output.** There is no sandbox. You cannot run anything. See §5.
9. ❌ **Linking a file that does not exist yet** — including your own later chunks. See §6.
10. ❌ **Docusaurus `:::note` admonitions.** Only 110 exist across 6,079 files; adding one
    makes the page look imported rather than authored. Highlight with bold lead-ins, 🔴,
    ⚠️ and blockquotes.
11. ❌ **Summarising the documentation.** The bar is *the reference page you wish you had
    had at 2am with the thing broken in production*. A page that reads like documentation
    summarised is a failed page.
12. ❌ **Writing the new form of a changed API without saying it changed.** See §5.

## 5 · 🔴 Accuracy — no sandbox, and the Oakwood train invalidates most of the internet

### You cannot run anything

No containers, no builds, no benchmarks, no measurement runs, no new scripts. This is a
standing instruction, not a limitation to work around.

**Match each claim to the cheapest evidence that actually settles it:**

- **T0** — a **verbatim quote** from the primary source, for any rule, guarantee or
  default. Quote it in `> *"…"*` form. Paraphrasing a rule is where errors enter.
- **T2** — one fetch of the primary doc, release notes or spec, for behaviour and
  rationale.
- **T3** — running code. 🔴 **Banned.**

The primary source is the official documentation, the spec, or the release notes. **A
vendor blog is a pointer to a source, never the source.**

### When nothing settles a claim

1. Try **one** source. Not three.
2. Still unsettled → **write the sentence as explicitly uncertain, or leave the claim
   out.** *"The Spring Cloud Gateway reference does not state whether X; treat it as
   unspecified"* is a legitimate, useful sentence that has shipped on these pages.
3. 🔴 **Never fabricate.** No output, timings, byte counts, error strings or stack traces
   reconstructed from memory.

**A confident invention is the only unacceptable outcome.** "I could not confirm this" is
fine. Silence is fine. Making it up is not.

### The version spine — pinned, verified, do not re-derive

| | Pinned for this phase |
|---|---|
| JDK | **25** |
| Spring Boot / Framework | **4.1.0** / **7.0.8** |
| **Spring Cloud release train** | 🔴 **2025.1.x — codename `Oakwood`** |
| Every Spring Cloud component | 🔴 **5.0.x** |
| Spring gRPC | **1.0.3** |
| Spring Modulith | **2.1.1** |

🔴 **The train is named by YEAR, the components by SEMVER.** "Spring Cloud Gateway 2025.1"
is wrong and so is "Spring Cloud 5.0". Say **train 2025.1.x, Gateway 5.0.x**.

⚠️ **Boot 4.1 compatibility arrived in 2025.1.2, not 2025.1.0.** If a page pins a BOM
version in a `pom.xml`, pin **2025.1.2 or later** — never `2025.1.0` beside Boot 4.1.

### 🔴 Read `_PHASE-NOTES.md` for the eight facts. Three of them, as a taste of the risk:

- **`spring-cloud-starter-gateway` does not resolve.** The old Gateway artifacts were
  **removed** in 2025.1.0, not deprecated. They are now split by style and web stack
  (`spring-cloud-starter-gateway-server-webflux` / `-webmvc`, and the `proxyexchange`
  variants), **and the configuration property prefixes moved to match.** Topic 07 owns
  this and must verify the exact current prefixes against the Gateway reference before
  writing a single YAML block.
- **`spring-cloud-starter-parent` no longer exists.** Import the BOM under
  `<dependencyManagement>`. Any sample showing it as a `<parent>` is pre-Oakwood.
- **REST Assured support was removed from Spring Cloud Contract 5.0.** Topic 11's whole
  generated-test story changed. Do not reproduce the classic `RestAssuredMockMvc`
  generated test from an older train's docs.

🔴 **`_PHASE-NOTES.md` fact 5 is a worked example of this prompt's point.** A previous
author wrote that `RestTemplate` support was removed from Spring Cloud Netflix 5.0. That
overstated a real change: the removal concerns the **Eureka client's own HTTP transport**,
and `@LoadBalanced RestTemplate` still works — Spring Cloud LoadBalancer 5.0.x still lists
`RestTemplate` among its load-balanced clients. The note was corrected, and the correction
is recorded *as the lesson*. **Precision about the scope of a change is the job.**

### 🔴 A quote is something you fetched in this session, or it is not a quote

**Added 2026-09-04 after auditing this prompt's first output (topic 02).** That run produced
**four `> *"…"*` blocks presented as verbatim Eric Evans and every one was a rewrite** — close in
meaning, wrong in words, and attributed to a book chapter that cannot be fetched. Two of those
pages named a freely available source in their own `> Verified:` line that contains the real text
and disagrees with what they printed: the source was **cited but not read**. One pattern was
attributed to *Domain-Driven Design* (2003) Chapter 14 when it is not in that book at all.

Therefore, three hard rules:

1. 🔴 **Every `> *"…"*` block must come from a page you fetched in this session, and its
   `> Verified:` line must carry that page's URL.** If you cannot fetch it, you cannot quote it.
2. 🔴 **A book cited by chapter is not a source.** It may appear as further reading. It may not be
   the sole citation on a page, and nothing may be quoted from it. Where a canonical text has a
   fetchable reproduction — the ddd-crew *Context Mapping Guide* reproduces the *DDD Reference*
   pattern definitions verbatim, for one — quote and cite **that**.
3. 🔴 **The `> *"…"*` form is reserved for source quotations.** Illustrative dialogue, a strawman
   proposal or a composite of "what people say" is written in bold with an explicit disclaimer,
   never in quote form.

**Reconstructing a sentence from memory and printing it in quotation marks is the single worst
outcome available to you here** — worse than omitting the point, because the formatting asserts
provenance the sentence does not have, and it passes every automated check this project runs.

### 🔴 No figure you did not read somewhere

No percentage, latency, velocity, throughput or cost number unless it is quoted from a named,
fetched source. The first run wrote *"sprint velocity typically drops by 30% to 50%"*, *"a 5ms
in-memory method into a 400ms HTTP cascade"* and *"5 microseconds instead of 40ms over HTTP"* —
all invented, all plausible, all unsupportable. **"Nobody can give you a credible number for this,
because it depends on X"** is a better sentence than a made-up one, and it has shipped on these
pages.

### 🔴 Only the markup this site can render

Docusaurus here has **no KaTeX and no remark-math**, and not one file in the 6,000-file corpus uses
math delimiters. `$0.99^5 \approx 95.1\%$` renders as literal dollar-sign source. Write the
arithmetic as prose with inline code. Before using any markup you have not seen elsewhere in the
corpus, `grep` for it — if the corpus does not use it, neither do you.

### 🔴 One compilation unit per code block, or say so

A `java` block with two `public` top-level types in it does not compile. If a block genuinely shows
several files, mark each one with the convention this corpus already uses:
`// src/main/java/com/retailer/order/PlaceOrderCommand.java`.

### 🔴 Name the change; do not silently write the new form

When Oakwood changed something, say on the page that it changed and what it was before.
The reader arrives holding a tutorial that disagrees with you. If you write only the
current form, they conclude the page is wrong. **Every one of the eight facts silently
invalidates the top Google result** — that is exactly why the page has to name it.

## 6 · Links, and the rule that breaks the build for everyone else

- Every link ends in **`.md`** and **keeps its numeric prefix**.
- 🔴 **Link only to a file that exists on disk right now.** `ls` it first.
- Anything not yet written — **including your own later chunks** — is **bold text plus
  `*(not written yet)*`**, never a link. This is the single most common thing an author
  gets wrong here.
- 🔴 **Never link to a `_plan.md`.** Docusaurus excludes `_*.md` from routing, so the link
  points at a real file on disk and is **still broken in the build**.
- Never link a directory slug — it resolves one level too high from a README and ships a
  404. Link `../08-service-discovery/README.md`, not `../08-service-discovery/`.

A dangling relative link breaks the production build for **every other session working in
this shared checkout**, not just for you.

## 7 · MDX hazards that abort the production build

Docusaurus v3 parses `.md` as MDX. These broke the deploy for three days:

1. A bare `<!-- ... -->` in prose → use `{/* ... */}`.
2. A bare `<Something` in prose — `List<String>`, `<clinit>`, `<stdin>` → **always backtick
   generics and angle-bracket tokens**.
3. 🔴 **A literal `{` or `}` in prose** → escape as `\{` and `\}`. **`mdxcheck.py` does not
   catch this pattern.** It killed the build outright on 2026-09-01 and again killed
   server-side rendering on a second page the same day.

## 8 · The page shape

```markdown
---
title: "A full sentence stating the page's claim, not a label"
sidebar_label: "07 · Short label"
sidebar_position: <unique and gap-free within the directory>
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against <real doc title and URL>, <second source>.
> Version spine: **JDK 25 · Spring Boot 4.1.0 · Spring Cloud 2025.1.x (Gateway 5.0.x)**.
> Documentation-validated; **no sandbox run**.

**Bold thesis paragraph — three to six sentences saying what is true and why it matters,
not what the page will cover.**

## <Body sections named after what they argue, not "Overview" and "Details">

## Gotchas

**★ Symptom: <what the reader actually sees>.** Cause: <the mechanism, precisely>.
Fix: <shown in code>.

## Interview questions

**★ <A "why" or "what happens if" question, not "what is">?**
<The answer in prose, as long as it needs to be.>

{/* FOOTER */}
```

- **Tier badge** is the first line after the frontmatter, before the `> Verified:` line.
  Classes and their exact labels: `t-master`/`Master`, `t-understand`/`Understand`,
  `t-know`/`Know`, `t-when`/`When Needed`. **Take the tier from the topic's `_plan.md`** —
  do not invent one.
- **`sidebar_label` separator is a middle dot `·` with spaces.** Never a hyphen or a colon.
- **`sidebar_position`** is unique and gap-free within the directory. The `README.md` index
  always takes `sidebar_position: 0` and `sidebar_label: "Overview"`.
- 🔴 **Bold the version you are pinning** on the `> Verified:` line. A currency scanner
  reads bold as the page's own pin and plain text as a historical citation, so bolding the
  wrong number changes what the tooling believes the page claims.
- `## Gotchas` and `## Interview questions` are **required on every content page and their
  names are exact** — plural, sentence case.
- `★` marks the frequently-asked / load-bearing entries, **not every entry**.
- Pick one gotcha form per page — the `**★ Symptom: …**` paragraph form above, or the
  `### name` + `**Symptom.** / **Cause.** / **Fix.**` form — and stay consistent within
  that page.
- End each file with the literal line `{/* FOOTER */}` while its neighbours do not exist
  yet; replace it with a real footer when the topic closes:

```markdown
---

← Prev: [Service boundaries](../02-service-boundaries/README.md) · [Topic index](README.md) · Next → [gRPC](../06-grpc/README.md)
```

### The topic `README.md` index

Tier badge, `> Verified:` line, bold thesis, then:

- `## Chunks` — a table, one dense line per chunk naming the **real findings** in it, 🔴
  marking the load-bearing one. Not a restatement of the title.
- `## Phase gate` — the concrete capability the reader now has. Not "understand X".
- `## Where this connects` — links to the neighbouring topics that exist.

And a sibling `_category_.json`, one line:

```json
{"label":"07 · API gateway","position":7,"collapsed":true}
```

## 9 · 🔴 The Definition of Done — run these, paste the output, then claim the file is finished

**Do not tell me a file or a topic is complete without this output.** "I have completed
topic 07" with no command output is not a report and will be sent back.

```bash
cd /mnt/Storage/Backup/Knowledge/devbible/docs/java/pages/phase-14-microservice-architecture/<topic dir>

wc -l *.md                                          # nothing over 300
grep -c '^\*\*★' *.md                               # compare against your BEFORE counts
grep -L '^<span className="db-tier' *.md            # must print nothing
grep -L '^> Verified:' *.md                         # must print nothing
grep -h '^sidebar_position:' *.md | sort -n | uniq -d   # must print nothing
grep -rln '^{/\* FOOTER \*/}$' .                    # 🔴 MUST BE EMPTY at topic close
grep -rn '[^\\]{[a-zA-Z]' *.md                      # brace-in-prose hunt; inspect every hit

python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py .
python3 /mnt/Storage/my-learning/claude/shared/scripts/devbible-linkcheck.py .
```

### 🔴 The depth self-check — a mechanical pass is not a pass

Run this and **paste the table**, because §9 above is entirely mechanical and a thin topic sails
through all of it:

```bash
for f in *.md; do printf "%-46s %5s %4s %4s\n" "$f" "$(wc -l <$f)" \
  "$(awk '/^## Gotchas/,/^## Interview questions/' $f | grep -c '^\*\*★')" \
  "$(awk '/^## Interview questions/,0' $f | grep -c '^\*\*★')"; done
```

🔴 **If the gotcha and question counts repeat identically down a run of files, you templated the
topic rather than exhausting it, and the topic is not finished.** The first run of this prompt
produced **22 consecutive files at exactly 4 gotchas and 4 questions**, averaging 150 lines against
249 in the chunks it wrote first. Real topics vary, because real topics fail a different number of
ways each. Watch for the same collapse in your own line counts and in your sourcing: the thin band
was also the band that stopped citing URLs.

`mdxcheck.py` printing `0 MDX hazard(s) in 0 file(s)` is a **genuine pass** — it means zero
hazards across zero files-with-hits. `devbible-linkcheck.py` must report **0 broken**;
`os.path.exists()` is not sufficient on its own, which is why the script exists.

A topic is **closed** when: every chunk is written, `README.md` exists at position 0,
`_category_.json` exists, no file is over 300 lines, no `{/* FOOTER */}` marker survives,
no `sidebar_position` is duplicated, every page has a tier badge and a `> Verified:` line,
and the link checker reports 0 broken.

## 10 · Boundaries — what you must not touch

- 🔴 **Write only inside
  `docs/java/pages/phase-14-microservice-architecture/`.** Not another phase, not
  `docs/README.md`, not `src/data/progress.js`, not a neighbouring phase's footers.
- 🔴 **Run no `git` commands at all** — no `add`, `commit`, `stash`, `checkout`, `pull`,
  `reset`. **Several agents share this checkout simultaneously.** A `git add -A` here
  stages other people's unfinished work into your commit; it has happened and it cost a
  session.
- Anything wrong you find **outside** your directory is **reported, not fixed** — name the
  file, the line and the defect in your report.

## 11 · What to report

Per file: path, line count, gotcha count, interview-question count.

Then, and these are the parts that matter:

- **Every split**, with its before/after line and ★ counts. Both must have gone up.
- **Every claim you could not confirm**, and **exactly what you wrote instead**. This is
  not a confession, it is the most valuable line in the report — it tells the next session
  where the page is standing on one leg.
- **Every place the current documentation contradicted this prompt, the `_plan.md`, or the
  phase notes.** 🔴 On this corpus, when an author who actually checked the source
  disagreed with their brief, **the author has been right every time.** Say so; do not
  quietly comply, and do not quietly reconcile the two.
- The full Definition-of-Done command output for each closed topic.
- Anything wrong outside your directory — found, not fixed.
