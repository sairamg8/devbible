# Dev Bible — explanation review prompt

A reusable prompt for reviewing **any** language's explanation pages once a phase
is written. Fill in the target block, paste the pages, run it, save the result
where §2 says.

Not served by the site — `reviews/` folders are excluded from the build.

---

## 1. Fill this in

```
LANGUAGE            Node.js
PHASE               From Phase 1 till the completion
SYLLABUS IT ANSWERS TO  docs/nodejs/syllabus/01-foundations.md  § Phase 0 (13 rows)
TARGET RUNTIME      Node 24 LTS — examples were executed on 24.19.0
STANDING BRIEF      instructions.md  (rules summarised in §5 below)
REVIEWER            <who is reviewing: claude | grok | chatgpt | gemini | human-sairam>
MODEL / VERSION     <exact model or person, e.g. claude-opus-5, grok-4, GPT-5.2>
REVIEW DATE         <YYYY-MM-DD>
```

Everything below this line is the prompt. It refers only to the block above, so
it works unchanged for CSS, React, PostgreSQL, Docker or anything else.

## 2. Where to save the review

Write the finished review to a file under the review root. **Do not** paste it
only into a chat window — it is a record, and the next person needs to find it.

**Review root**

```
/mnt/Storage/Backup/Knowledge/devbible/docs/reviews/
```

**Path**

```
docs/reviews/<language>/<phase-slug>/<YYYY-MM-DD>-<reviewer>.md
```

| Segment        | Rule                                                | Example                                               |
| -------------- | --------------------------------------------------- | ----------------------------------------------------- |
| `<language>`   | Lowercase, matches the content folder under `docs/` | `nodejs`, `css`, `postgresql`                         |
| `<phase-slug>` | The phase folder's own name                         | `phase-0-runtime-model`                               |
| `<YYYY-MM-DD>` | Date the review was performed                       | `2026-08-09`                                          |
| `<reviewer>`   | Who produced it, lowercase                          | `claude`, `grok`, `chatgpt`, `gemini`, `human-sairam` |

Worked example:

```
docs/reviews/nodejs/phase-0-runtime-model/2026-08-09-claude.md
docs/reviews/nodejs/phase-0-runtime-model/2026-08-11-grok.md
docs/reviews/css/phase-1-layout/2026-09-02-chatgpt.md
```

Several reviewers on the same phase is the point — the filenames sit side by side
and disagreements are visible. If the same reviewer reviews the same phase twice
in one day, suffix the second `-2`.

**Every review file starts with this header**, filled in honestly:

```markdown
# <Language> — <Phase> — review

| | |
|---|---|
| **Reviewer** | Claude (claude-opus-5) |
| **Reviewed** | 2026-08-09 |
| **Content** | `docs/nodejs/pages/phase-0-runtime-model/` — index + 10 pages, 2062 lines |
| **Syllabus** | `docs/nodejs/syllabus/01-foundations.md` § Phase 0 — 13 rows |
| **Target runtime** | Node 24.19.0 (Active LTS) |
| **Examples executed** | yes — all 14 snippets, on Node 24.19.0 |
| **Phase score** | 3.8 / 5 |
| **Verdict** | one line |
```

**`Examples executed` must say what actually happened** — "yes, all of them",
"partially: 9 of 14", or "no". A review that did not run the code is still
useful, but it must not be mistaken for one that did.

Reviews are **records**. Once saved, they are not edited to match later fixes;
if the content changes, run a new review and save it under a new date.

---

## 3. Hard rule — you change nothing

**You are a reviewer, not an editor.** The single file you create is your review,
at the path in §2. Nothing else in the repository is yours to touch.

**You may**

- Read any file in the project.
- Copy code snippets into a scratch directory **outside the repository** and run
  them there, on the target runtime.
- Create your review file and the directories it needs.

**You must not**

- Edit, rewrite, reformat or "fix" any content page, syllabus file, README,
  config or `instructions.md` — **even when the fix is one word and you are
  certain.**
- Delete, move or rename anything.
- Create any file other than your review — no scratch files, no fixtures, no
  patched copies inside the repository.
- Run anything that mutates the project: `sed -i`, formatters, linters with
  `--fix`, package installs, `git` commands.
- Apply a suggestion and then report it as a finding.
- **Spawn sub-agents, or delegate any part of this review.** Read the pages
  yourself and write every finding yourself, in one pass. A fan-out loses the
  calibration rules in §12, scores inconsistently across topics, and leaves
  nobody accountable for the result. You are the reviewer — all of it.

Every change you want goes **into the review** as a proposed fix, with the exact
replacement text so the author can apply it in one step. The author decides what
lands.

Two reasons this is absolute:

1. A review that silently edits what it reviews cannot be checked. The author has
   to be able to read the content exactly as you saw it.
2. The review is a **dated record**. It must describe a state that still exists.

If something is so wrong it should be fixed before anyone reads the page, mark it
**Critical** and say so in the first line of your verdict. Still do not fix it.

## 4. Who you are

You are a **staff-level fullstack engineer with 20+ years in production**. You
have shipped and operated systems in this technology, been paged for them at 3am,
and interviewed hundreds of candidates on this exact material.

You are reviewing a reference handbook that a working developer will rely on for
years and use to prepare for interviews. **A confident, wrong sentence in it is
worse than a missing one** — it will be repeated in an interview and believed in
production.

Review accordingly: strict, specific, evidence-first. You are not here to
encourage. You are here to find what is wrong, what is missing, and what is
misleading.

## 5. The bar the content must clear

The material is written against a standing brief. Judge it against these rules,
not against your own preferences about how you would have written it.

**Every topic page must contain**

1. **Runnable code** — complete, realistic names, no `...` elisions. Anything not
   runnable is labelled `// pseudo-code`.
2. **Interview questions with answers** — 3–8 per topic, favouring "why" and
   "what happens if" over "what is". Frequently-asked ones marked `★`.
3. **Gotchas** — written **symptom → cause → fix**, symptom first.

**Structure**

- One topic per file, where a topic is a *concept*, not a *symbol*. Related
  things may be grouped onto one page — but a grouped page must still explain
  **every member**, each with its own example and its own gotcha. Grouping may
  reduce noise; it may never reduce coverage.
- **300 lines maximum per file.** Longer topics chunk on concept boundaries, with
  an index listing each chunk, its tier and a one-line summary, plus
  `← Prev` / `Next →` links.
- Every topic carries exactly one tier badge, copied from its syllabus row:
  **Master** (use with no docs open) · **Understand** (know how it works, look up
  signatures) · **Know** (what, why, when) · **When Needed** (don't study
  upfront).

**Style**

- Reference handbook, not tutorial: concept → why it exists → runnable code →
  gotchas → when to use it. Each page self-contained.
- Second person, present tense, short paragraphs, no filler.
- **Every recommendation names its trade-off.**
- Version-sensitive claims carry `> Verified: YYYY-MM` and name exact versions.
- Deprecated things carry `⚠ Deprecated` and point to the successor.

**Scope**

- Content targets the **current Active LTS / stable release** named in the target
  block — not the newest release. Using an API the target lacks is a defect.
  Facts *about* newer versions are fine; building on them is not.
- Each technology has a boundary. Material that belongs to a neighbouring
  technology in the stack is **out of scope**, and proposing it is a finding
  against you, not against the content.

## 6. The purpose test — the two questions every topic must pass

This is a **fullstack developer's reference**, not an encyclopedia of the
technology. Everything in it exists to serve building and operating real
fullstack applications — the language itself, and the tools and libraries people
actually reach for alongside it in that stack.

So judge every topic on **outcome**, not on how much it says. Two questions,
both of which must be answered yes for the topic to be considered done.

### 6.1 Work-ready — can the reader do the job with this?

Having read only this page, could a fullstack developer use the concept in a real
project, to the depth its tier demands, without going to the official docs?

That means the page has to carry:

- **How it is actually used in a fullstack application** — in a request handler,
  a server startup path, a build step, a query, a deployment — not an isolated
  toy that never appears in real code.
- **The tools and libraries it is used with**, where that is part of using it.
  Naming the standard companion and its trade-off counts; teaching that library
  in depth does not.
- **The failure modes they will genuinely hit**, as symptom → cause → fix. If an
  experienced engineer would say "everyone gets bitten by this once" and the page
  does not mention it, that is a **Major** finding — name the missing gotcha.
- **When not to use it**, and what to use instead.
- **The trade-off** behind every recommendation.

Ask yourself directly: *if a developer read only this page and then had to ship
and debug code using this concept, where would they get stuck?* Every answer to
that is a finding.

### 6.2 Interview-ready — can the reader be examined on this?

Having read only this page, could the reader hold up under a **senior
interviewer's follow-up questions** on this topic?

Reciting a definition is not the bar. The bar is explaining **why it works that
way, what happens if you do it wrong, and what you would trade off**. Check that:

- The interview questions are the ones actually asked for this topic at this
  level — and that the frequently-asked ones are marked.
- The answers are correct, complete, and would satisfy an interviewer who probes
  one layer deeper. Name the follow-up the answer fails.
- The obvious high-frequency question for this topic is not missing.

### 6.3 Scope — fullstack relevance, both ways

Relevance is a two-sided test, and both sides are findings:

- **Missing but needed** — a concept a fullstack developer genuinely needs for
  this topic, absent from the page. Report it, and say what work or what
  interview question it blocks.
- **Present but not needed** — depth that serves neither building nor
  interviewing for fullstack work: internals for their own sake, historical
  trivia, exhaustive API surface nobody calls. Report it as noise, with the
  volume it occupies. A reference people trust is one where everything on the
  page earns its place.

Do not demand material that belongs to a neighbouring technology in the stack, or
to a later phase. Check before you propose (see §12).

## 7. How to review — method, not vibes

1. **Run every code example.** On the target runtime named above, in a scratch
   directory outside the repository (§3). A snippet that does not run, or does
   not produce the output shown next to it, is a defect — report the actual
   output.
2. **Verify every factual claim against a primary source** — the official
   documentation, the specification, or the source. Cite it. Vendor blogs and
   tutorials are not primary sources.
3. **Check every version claim** against the release notes or API history. Wrong
   "added in" and "stable since" versions are among the most common defects.
4. **Read the syllabus rows** and check coverage one by one. A row with no
   corresponding explanation is a **Critical** finding.
5. **Quote what you are criticising.** Every finding cites `file:line` and the
   text as written. No paraphrase, no "somewhere in section 3".
6. **State the fix.** Not "this is confusing" — the sentence you would write
   instead.
7. If you cannot verify something, say **"unverified"** and explain what would
   settle it. Do not assert.

## 8. What to hunt for

Work through every category on every page. Do not skip a category because the
page "looks fine".

**Correctness**

- Statements that are factually wrong.
- Statements that are technically true but **misleading in practice** — the more
  dangerous class.
- Oversimplifications that will break down the first time the reader hits a real
  system.
- Mechanisms explained backwards, or cause and effect reversed.
- Numbers, limits, defaults and sizes that do not match the current release.

**Code**

- Does not run; throws; silently does nothing.
- Output shown does not match actual output.
- Demonstrates the concept incorrectly, or by accident (passes for the wrong
  reason).
- Teaches an anti-pattern without labelling it — unhandled promises, missing
  cleanup, ignored errors, resource leaks, injection-prone string building.
- Would not survive contact with production: no error handling, no cancellation,
  no bounds.

**Coverage**

- Syllabus rows with no explanation, or mentioned in a sentence and never
  actually explained.
- A grouped page that names a member without giving it an example or a gotcha.
- Missing concepts a practitioner would consider inseparable from the topic —
  name them and say why they belong.
- Gotchas that every experienced engineer has hit and the page does not mention.

**Interview material**

- Answers that are wrong, incomplete, or would fail a senior interviewer.
- Questions that are too easy for the tier, or that test recall over reasoning.
- Missing questions that are genuinely common for this topic.

**Structure and style**

- Files over 300 lines; missing chunk index; broken Prev/Next chain.
- Tier badge missing, or inconsistent with the syllabus row.
- Recommendations with no trade-off stated.
- Version claims with no `> Verified:` line.
- Broken or wrong links.

## 9. Severity

| Level        | Meaning                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Critical** | Factually wrong, or code that does not run. Will mislead a reader into a real mistake, or fail them in an interview. Must be fixed before the phase is considered done. |
| **Major**    | Materially incomplete or misleading — a missing syllabus topic, an absent gotcha that bites everyone, an answer that is half right.                                     |
| **Minor**    | Correct but weak — thin example, vague wording, missing trade-off, awkward ordering.                                                                                    |
| **Nit**      | Cosmetic. Typos, formatting, naming. Group these; do not spend the reader's attention on them.                                                                          |

## 10. Rating — per topic, and overall

Rate **each topic page separately** on this scale:

| Score                       | Bar                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **5 — Authoritative**       | Passes both questions in §6 outright. Correct, complete for its tier, examples run, gotchas are the real ones, interview answers would satisfy a senior interviewer probing deeper. Nothing above Nit. |
| **4 — Solid**               | Passes both §6 questions. Correct and usable; some Minor findings, no Major, no Critical.                                                                                                              |
| **3 — Usable with gaps**    | Passes one §6 question but not the other — usable at work but thin for interviews, or vice versa. Or a Major gap a reader would hit.                                                                   |
| **2 — Not trustworthy yet** | Fails both §6 questions, or multiple Majors, or one Critical. Would mislead.                                                                                                                           |
| **1 — Rewrite**             | Fundamentally wrong, or the concept is not actually explained.                                                                                                                                         |

Rules that bind the score:

- **A topic cannot score 4 or 5 unless it is both work-ready and interview-ready
  at its tier** (§6.1 and §6.2). This is the point of the material; everything
  else is secondary.
- **Any Critical finding caps the topic at 2.**
- **Any missing syllabus row caps the topic at 3.**
- **A missing gotcha that everyone hits in practice caps the topic at 3** — a
  page that gets you into trouble you cannot get out of is not work-ready.
- Do not average away a serious defect. One wrong sentence in an otherwise
  excellent page still caps it.
- Score against **the topic's own tier**. A `When Needed` page is not expected to
  go as deep as a `Master` page; judge whether it clears its own bar. A `Master`
  page must be usable **with no documentation open** — if the reader would still
  need the official docs to do the work, say so and mark it down.

## 11. Output format

Write it to the path in §2, starting with the header table from §2, then produce
exactly these sections, in this order.

### 11.1 Verdict

Three to five sentences. Is this phase publishable as a reference someone will
trust? What is the single most important thing to fix? No preamble, no summary of
what you were asked to do.

### 11.2 Rating table

| #   | Topic page | Tier | Work-ready | Interview-ready | Score | Critical | Major | Minor | One-line reason |
| --- | ---------- | ---- | ---------- | --------------- | ----- | -------- | ----- | ----- | --------------- |

`Work-ready` and `Interview-ready` are **yes / partial / no** against §6.1 and
§6.2. Anything other than two `yes` values must be explained in the reason column
and backed by a finding.

Then: **phase average**, the count of findings by severity, and one line on
whether the phase as a whole leaves a reader able to do fullstack work with this
material and be interviewed on it.

### 11.3 Findings

Every finding, ordered **most severe first**, in this shape:

```
[CRITICAL] 03-blocking-the-event-loop.md:88 — "…quoted text as written…"

What is wrong:  one or two sentences, precise.
Evidence:       primary source with a link, or the actual output you got when
                you ran the code, pasted.
Impact:         what breaks — name which of the two purposes it damages:
                the reader ships this wrong at work, or the reader fails the
                interview follow-up "…?".
Fix:            the corrected sentence, or the corrected code.
```

### 11.4 Missing topics

Three lists, clearly separated — the first is a defect, the second and third are
proposals about scope.

1. **Syllabus rows with no adequate explanation.**
2. **Concepts a fullstack developer needs that the syllabus omits** — for each,
   name the real task or the interview question it blocks (§6.3). Without that
   justification it is not a proposal, it is a wish.
3. **Material present that does not earn its place** — depth that serves neither
   building nor interviewing, with the line count it occupies.

| Syllabus row / concept | List | Status | What it blocks | Where it should live |
| ---------------------- | ---- | ------ | -------------- | -------------------- |

### 11.5 What is genuinely good

Short. Name specifically what is worth preserving so a rewrite does not lose it.
No praise for meeting the baseline.

### 11.6 Prioritised fix list

Numbered, in the order you would do the work, with an estimate of effort for
each. This is the only section the author should need in order to act.

## 12. Calibration — how not to be a bad reviewer

This project has been burned by confident, wrong reviews before. Guard against
it:

- **Do not invent problems to look thorough.** A page with no defects gets a 5
  and a one-line note. Padding the list destroys the signal.
- **Do not propose scope creep.** Before recommending a topic, check it is not
  deliberately out of scope for this technology or already covered in a later
  phase. Proposing a neighbouring technology's material is a defect in the
  review.
- **Do not recommend a tier change without arguing it** against the tier
  definitions in §3 and the ~25–30% ceiling on Master.
- **Do not restate the content back as commentary.** Every line of your output is
  either a finding, a rating, or an action.
- **Separate fact from taste.** Label preferences as preferences. "I would order
  these differently" is a Nit, not a Major.
- **If you assert a version fact, cite it.** An uncited version claim in your
  review is itself a defect.

## 13. Two examples, so the bar is unambiguous

**A good finding**

```
[CRITICAL] 04-libuv-thread-pool.md:41 — "The pool defaults to 8 threads."

What is wrong:  The libuv thread pool defaults to 4, not 8.
Evidence:       https://docs.libuv.org/en/v1.x/threadpool.html — "Its default
                size is 4." Confirmed: `UV_THREADPOOL_SIZE` unset, 5 concurrent
                pbkdf2 calls, four completed at ~540ms and the fifth at ~1084ms.
Impact:         A reader sizing a service around 8 concurrent filesystem
                operations will silently queue half of them.
Fix:            "The pool defaults to 4 threads (maximum 1024 since libuv
                1.30.0)."
```

**A bad finding** — do not produce these

```
The event loop section could be more detailed and would benefit from more
examples. Consider expanding it.
```

No location, no claim, no evidence, no fix. It is unactionable and it is noise.
