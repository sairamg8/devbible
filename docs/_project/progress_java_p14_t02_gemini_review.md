---
name: progress-java-p14-t02-gemini-review
description: Line-by-line audit of the Gemini-authored Java phase-14 topic 02 (Service boundaries, commit 5c2dc1b0). Mechanically clean, but the last 27 chunks are a shallower templated band and carry FOUR fabricated verbatim quotations from Evans. Read before trusting or extending that topic, and before handing another topic to an external agent.
metadata:
  type: project
---

# Java p14 t02 · Service boundaries — audit of the Gemini run

**Audited 2026-09-04.** Subject: `docs/java/pages/phase-14-microservice-architecture/02-service-boundaries/`
— 60 chunks + README, 12,509 lines, written by Gemini under `PROMPT-gemini-java-phase-14.md`,
committed as `5c2dc1b0` after a first-pass review that caught 145 numbering defects.

## What is genuinely fine — every mechanical check passes

`sidebar_position` 0–60 contiguous, no duplicates · 0 files over the 300-line cap (max 298) ·
tier badge + `> Verified:` on all 61 · `## Gotchas` / `## Interview questions` on all 60 chunks ·
0 surviving `{/* FOOTER */}` markers · footers match corpus form · 0 MDX hazards ·
348 links, 0 broken · 0 `:::` admonitions · 0 stubs/TODOs · ArchUnit and Spring Modulith APIs
correct. **This is why the defects below survived the first review: no automated check sees any
of them.**

## 🔴 Finding 1 — FOUR fabricated verbatim quotations (the serious one)

Four `> *"…"*` blocks are presented as verbatim Evans and are **rewrites**. Checked against the
ddd-crew *Context Mapping Guide* — **a source two of these same files name in their own
`> Verified:` line**, so the source was cited but not read.

| File | Printed as Evans | Actual canonical text |
|---|---|---|
| `35-partnership-and-separate-ways.md:34` | *"Where development failure for either team means development failure for both, they must cooperate on an equal footing. They must synchronize their release cadences and interface development."* | *"Where development failure in either of two contexts would result in delivery failure for both, forge a partnership between the teams in charge of the two contexts. Institute a process for coordinated planning of development and joint management of integration…"* |
| `35-…:50` | *"Declare that the contexts have nothing to do with each other and allow developers to find simple, specialized solutions in their small scope."* | *"Declare a bounded context to have no connection to the others at all, allowing developers to find simple, specialized solutions within this small scope."* |
| `32-conformist.md:27` | *"When a downstream context has to use an upstream system, and the upstream team has no motivation to collaborate… the downstream team can eliminate translation by taking the upstream model whole."* | *"Eliminate the complexity of translation between bounded contexts by slavishly adhering to the model of the upstream team…"* |
| `33-shared-kernel.md:30` | *"The shared kernel cannot be changed as freely as other parts of the system. A change requires consultation with the other team, and both teams' test suites must run on every build."* | Reference text is *"Designate with an explicit boundary some subset of the domain model…"*; the printed sentence is close to the 2003 book's wording but altered ("system" for "design") |

**Plus a misattribution:** all four cite *Domain-Driven Design* (Addison-Wesley) **Chapter 14**.
**Partnership is not in the 2003 book at all** — it first appears in Evans' *DDD Reference*
(2015). The pattern text quoted throughout that band is DDD-Reference text, not Ch. 14 text.

`29b-where-the-acl-lives.md:20` also uses the `> *"…"*` T0 form for **invented dialogue**
("someone inevitably proposes…"). Honest as illustration, wrong in the form the house style
reserves for verbatim sources. Low severity, but it teaches the eye to trust the wrong marker.

## 🔴 Finding 2 — the corpus's own "template tell" fires, exactly as anti-pattern #6 predicts

| Band | Files | Total lines | Avg | Gotchas / Q |
|---|---:|---:|---:|---|
| chunks 01–23 | 33 | 8,239 | 249 | varies 5–7 / 4–5 |
| chunks 24–45 | 27 | 4,071 | **150** | **22 CONSECUTIVE files at exactly 4/4** |

Thirteen consecutive files at exactly 7/5 precede it. The prompt names this verbatim: *"a run of
near-identical gotcha counts across files. Real topics vary; a template does not."* The tail band
is 40% shorter per page with a fixed section skeleton.

**Corroborating: sourcing collapses in the same band.** 48 of 61 files cite a fetchable URL;
**all 13 that cite no URL at all are in the tail** (27, 31, 32, 37, 39, 40, 42, 43, 44, 44b, 44c,
45, README) — book chapters only, nothing checkable. The head band cites URLs, licences and
section names (e.g. `11-reasons-to-break-the-rule.md` cites dddcommunity.org + CC BY-ND 3.0) and
its quotes hold up.

## Finding 3 — invented figures, which §5 and anti-pattern #8 ban outright

- `42-…:62` **"Sprint velocity typically drops by 30% to 50%"** — attributable to neither cited source
- `42-…:78` "Multi-repo PRs required for 80% of sprint tasks"
- `37-…:45` "a 5ms in-memory method into a 400ms HTTP cascade"
- `38-merging-two-services.md:70` "5 microseconds instead of 40ms over HTTP"
- `36-…:81` "80% of their pull requests"; `39-…:18` "95% of its interactions"

## Finding 4 — `37-the-tells-of-a-wrong-boundary.md:46` ships LaTeX the site cannot render

`$0.99^5 \approx 95.1\%$`. **No KaTeX/remark-math in `docusaurus.config.js`, and no other file in
the 6,000-file corpus uses math delimiters** — it renders as literal dollar-sign source. The
arithmetic is right; the notation is unrenderable.

## Finding 5 — code that does not compile as written

Eleven blocks declare 2–5 **public top-level types in one compilation unit** with no file-boundary
comment: `02b`(3), `24`(5), `25b`(2), `28`(4), `28b`(2), `29`(3), `31`(2), `32`(2), `34`(2),
`39`(5), `43`(2). The topic *does* know the right form — `04-…:166` and `15-…:124` use
`// src/main/java/…/package-info.java` markers. Also `12-splitting-by-layer.md:134` carries a
`/* ... */` elision, banned by anti-pattern #2.

## Finding 6 — the README index is a truncation, not an index

`README.md` `## Chunks`: **42 of 60 "Covers" cells are the page `title:` mechanically clipped
mid-word with `...`**. §8 requires *"the real findings in it, 🔴 marking the load-bearing one. Not
a restatement of the title."* There is **no Tier column and not one 🔴** — compare
`phase-13-oauth2-oidc/07-openid-connect/README.md`, which is the corpus form.

## 🔴 The lesson for the next external-agent hand-off

**Gemini complied with every rule a script can check and drifted on every rule only a reader can
check.** The prompt's §9 Definition of Done is entirely mechanical, so a mechanically-perfect,
substantively thinner artefact passes it — and the fabricated quotes passed *because* the file
carried a correctly-formatted `> Verified:` line naming a real source.

**Add to the next external brief:** (1) a quote is pasted from a page you fetched in this session
or it is not a quote — cite the URL on the `> Verified:` line or write it as prose; (2) no book
chapter as a sole source; (3) report gotcha/question counts per file in the run report, because an
identical run is the tell; (4) no percentage, latency or velocity figure that is not quoted from a
named source. See [[feedback-verify-your-own-measurements]] and [[progress-java-p14-run-20260901]].

---

# 🔴 ALL SIX FINDINGS REPAIRED — commit `c364141d`, 2026-09-04

22 files, **12,509 → 12,624 lines, ★ unchanged at 581** — nothing trimmed. Every fix below was
made in place; no chunk was rewritten and no gotcha or question was removed.

| Finding | What was done |
|---|---|
| 1 · fabricated quotes | The four rewrites replaced with the canonical *DDD Reference* (2015) text as reproduced in the ddd-crew guide (32 Conformist, 33 Shared Kernel, 35 Partnership + Separate Ways). `> Verified:` lines on 32/33/35 now cite the Reference **plus the ddd-crew URL**, so every quote on them is checkable. `29b`'s invented dialogue no longer wears the `> *"…"*` marker. |
| 1b · misattribution | Partnership corrected to *DDD Reference* (2015). Page 35 now **says so in the body**, listing what Ch. 14 of the 2003 book actually contains — the misattribution is common enough to be worth teaching. |
| 2 · templated tail | ⏸ **NOT fixed — deliberately deferred.** Depth is an authoring pass, not a repair; see below. |
| 3 · invented figures | `42` velocity 30–50% replaced with the honest "no credible number exists"; `37` 5ms→400ms; `38` 5µs vs 40ms; `42` 80% of sprint tasks; `36`/`39`/`44c`/`27`/`33`/`29b`/`35` percentages softened to qualitative claims. |
| 4 · LaTeX | `35` `$n(n-1)/2$` and `37` `$0.99^5 \approx 95.1\%$` → prose + inline code. **Confirmed: no KaTeX in `docusaurus.config.js` and no other file in the corpus uses math delimiters.** |
| 5 · code | 29 `// src/main/java/…` file-path markers across 10 blocks, using the convention the topic already had at `04:166` / `15:124`; `02b` given real `package` declarations; `12`'s `/* ... */` elision replaced with real arguments. |
| 6 · README | Rewritten to corpus form — Tier column, real "what it argues" cells, **7 load-bearing chunks marked 🔴**, a `> Verified:` line citing the fetchable sources with URLs, a capability-shaped phase gate, and a new **"What this topic stands on"** section stating plainly that chunks 1–33 rest on fetchable sources and 34–60 on unfetchable book chapters. |

**QC after repair:** 0 over cap (max 298) · positions 0–60 contiguous, no duplicates · tier badge
and `> Verified:` on all 61 · 0 `{/* FOOTER */}` · 0 MDX hazards · **348 links, 0 broken** ·
0 math delimiters.

## 🔴 What is still open, and why it was left

**Finding 2 — the templated tail band (chunks 34–60) — was not repaired.** It is not a defect you
can edit out: 22 consecutive files at exactly 4 gotchas / 4 questions and ~150 lines against the
head band's ~249 is *missing content*, and adding it is an authoring pass against fetched sources,
not a repair pass. Doing it badly would mean padding, which is worse than the shortfall.

The README's **"What this topic stands on"** section now discloses this to the reader, so the topic
is honest about its own unevenness while the extension is pending. **Whoever takes that pass:**
target chunks 34–60, source them the way chunks 1–33 are sourced (fetchable URLs, quoted verbatim),
and expect the gotcha and question counts to stop being identical — that is the acceptance test.

---

# Depth pass on chunks 34–60 — IN PROGRESS, started 2026-09-04

The finding-2 authoring pass the audit deferred. Research banked first at
[[research-java-p14-t02-depth-pass]] (**do not re-fetch**).

**Method per chunk:** deepen from the bank → if the file passes 300 lines, split on a concept
boundary into a lettered sibling and **prove both totals up** → `renumber.py` recomputes every
`sidebar_position` from filename order (the scratchpad script; filenames and `sidebar_label`
numbers never change, so no inbound link or prose reference moves) → mdxcheck + linkcheck →
commit explicit paths.

| Chunk | Before | After | Commit |
|---|---|---|---|
| 24 · Package structure | 219 / 8★ | **24** 295/12★ + **24b** 149/8★ (NEW) | `4a6417b1` |
| 25 · Verifying the boundary | 142 / 8★ | **25** 277/14★ + **25c** 229/11★ (NEW) | `a45bc76f` |
| 25b · Named interfaces | 161 / 8★ | 273 / 13★ | `24918dfb` |
| 26 · ArchUnit rules | 161 / 8★ | **26** 270/11★ + **26b** 127/5★ (NEW) | `24918dfb` |
| 27 · Build modules and JPMS | 148 / 8★ | 289 / 14★ | `68fe985d` |
| 28 · Published language | 168 / 8★ | **28** 216/10★ + **28c** 155/5★ (NEW) | `5cc82e11` |

**Six defects corrected while deepening, beyond the audit's list:**
1. `beRecords()` — an **unsourced ArchUnit predicate in a copyable example**. The user guide
   documents none; replaced with prohibition rules and the absence stated on the page.
2. `resideInAPackage("com.retailer.(*).api..")` — slice-capture syntax in a package matcher.
3. Two more invented figures in chunk 26 ("over a minute", "typically 1 to 3 seconds").
4. "microsecond execution times" in chunk 27.
5. 🔴 Chunk 27 asserted JPMS runtime encapsulation without the launch-mode caveat: **a Spring Boot
   fat JAR launches from the classpath, so modules are unnamed and `opens` gates nothing.** The
   compile-time guarantee survives in full; the reflective one does not.
6. Chunk 24 taught "keep the package flat" without saying that **Spring Modulith inverts the rule** —
   under Modulith a sub-package is the one place a type can be public and still module-private.

# 🔴 DEPTH PASS COMPLETE — 2026-09-04

**All 27 chunks of the band deepened. Topic 02 is 60 → 67 chunks, 12,624 → 15,906 lines,
581 → 732 ★.** Index rebuilt (`0daa9adc`).

| | Before pass | After |
|---|---:|---:|
| Chunks + index | 60 + 1 | **67 + 1** |
| Lines | 12,624 | **15,906** |
| ★ | 581 | **732** |
| Tail band avg lines | ~150 | ~215 |
| 🔴 Identical-count run in the tail | **22 files at 4/4** | **gone** — longest tail run is 3 |

**Seven new lettered siblings**, each from a split proven up on both totals: `24b` When one flat
package is not enough · `25c` Can the module boot alone? · `26b` Making the rules stick ·
`28c` Changing a published contract · `28d` The event has a longer half-life · `29c` Mapper or
barrier · `40b` Ready to extract.

## 🔴 Defects found and fixed *while* deepening — none were in the audit

1. `beRecords()` — an **unsourced ArchUnit predicate in a copyable example**. The guide documents
   none; replaced, and the absence is now stated on the page.
2. `resideInAPackage("com.retailer.(*).api..")` — slice-capture syntax in a package matcher.
3. Three more invented figures (chunk 26 ×2, chunk 27 ×1).
4. Chunk 27 asserted **JPMS runtime encapsulation with no launch-mode caveat**. A Spring Boot fat JAR
   launches from the classpath, so modules are unnamed and `opens` gates nothing; the compile-time
   guarantee survives in full, the reflective one does not.
5. Chunk 24 taught "keep the package flat" without saying **Spring Modulith inverts the rule**.
6. Chunk 29b stated a blanket "never share an ACL", which has a real exception and so was ignored;
   the line actually falls between the **client** and the **translation**.

## 🔴 Three places a source does not say what pages attribute to it

Recorded on the pages themselves and in [[research-java-p14-t02-depth-pass]]:
Fowler's *StranglerFigApplication* discusses **no** event interception or asset capture; the
microservices.io strangler page specifies **no** routing, glue-code or data-replication mechanics;
the ArchUnit guide documents **no** `beRecords()`.

## What is still open

⚠️ **Chunks 12–23 are thirteen files at exactly 7 gotchas / 5 questions** — the same template tell,
in the *head* band, predating this pass. It was outside the band the user named. The topic's README
records it in the open, and it is the obvious next depth pass.

**Final QC:** 67 chunks + index · 15,906 lines · 732 ★ · max file **299** · positions 0–67 contiguous,
no duplicates · badge and `> Verified:` on all 68 · 0 `{/* FOOTER */}` · 0 MDX hazards · **448 links,
0 broken** · 0 console blocks · 0 admonitions · 0 math delimiters · 0 elisions · 0
`sidebar_label`/filename mismatches.
