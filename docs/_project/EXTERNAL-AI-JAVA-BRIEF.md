---
name: external-ai-java-brief
description: The standing brief to hand a NON-Claude agentic coding tool (Cursor, Codex, Gemini CLI, Copilot) that will author devbible Java reference pages backed by compilable code. Paste it whole; it assumes file tools and repo access.
metadata:
  type: project
---

# Brief for an external agent — devbible Java pages with compilable examples

> **How to use this file.** Paste everything below the line into the agent, or point the
> agent at this path. It assumes the agent can read and write files and run shell commands
> in the repo. Fill in the four `<<< >>>` placeholders at the top of the ASSIGNMENT section
> before sending. Nothing else needs editing.
>
> ⚠️ **This brief deliberately departs from devbible's rule 3** (`NO sandbox, NO console
> blocks`). It authorises **one** verification module whose sole purpose is proving the
> page's code compiles and passes. Read *§4 Evidence* — the ban on **fabricated** output is
> absolute and unchanged; what is relaxed is the ban on *having a place to compile*. If you
> do not want that, delete §3 and change §4's rule 3 to "no code is executed at all", and
> the rest of the brief still stands.

---

You are authoring reference documentation for **devbible**, a Docusaurus knowledge base at
`/mnt/Storage/Backup/Knowledge/devbible`. Your output is Markdown pages under `docs/java/`
plus a small Java module that proves the pages' code is real.

Your reader is a working backend engineer preparing for senior interviews and for
production work. They are not a beginner. Do not explain what a class is. Do explain what
actually happens, why it surprises people, and what breaks in production when it is
half-known.

## 1 · The one rule that governs everything

**300 lines is a FILE-SIZE cap. It is NEVER a content budget.**

This is the rule external tools get wrong most often, so it is first.

- A topic may total 1,000+ lines across several files. That is normal and expected.
- **Exhaust the topic.** Every gotcha, every pitfall, every worked example, every interview
  question the topic actually has. Not two. Not three. Not "five, because five felt like
  enough". If the topic has nineteen gotchas, write nineteen.
- **Write it ALL first, then split.** Never plan a page to land under 300. Never trim,
  reword, merge or drop a section, an example or a question to make something fit.
- Over 300 lines → split **on a concept boundary** into lettered siblings:
  `04-topic.md` becomes `04-topic.md` + `04b-next-concept.md`. Each half gets its own
  frontmatter, tier badge, `> Verified:` line, Gotchas section and Interview questions
  section, and the existing gotchas and questions are **redistributed** to whichever half
  each one is actually about.
- If a single topic grows past a handful of files, promote it to a directory `NN-slug/`
  (**same slug**, so inbound links keep resolving) containing `_category_.json`, a
  `README.md` carrying a chunk table, and the numbered chunks.

🔴 **A split must never lose content.** Before splitting, record the file's line count and
its number of gotchas and interview questions. After splitting, the combined totals must be
**equal or greater**. State both numbers in your report. This is not paranoia: a trim
passes every automated check — the cap, the linter, the link resolver — and is
indistinguishable from a legitimate split in a file listing. Line and count deltas are the
only thing that catches it.

**The tell that you got this rule wrong:** a run of pages with near-identical lengths, or
clustering just under 300. Real topics vary enormously. A page at 140 lines and a page at
290 in the same topic is healthy.

## 2 · Page shape

Copy this exactly. Do not go and read an existing page to infer the shape.

```markdown
---
title: "A full sentence stating the page's claim, not a noun phrase"
sidebar_label: "3 · Short label"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against <real doc title and full URL>, <second source>.
> Target: **<exact runtime and version, e.g. Java 25, Spring Boot 4.1>**.

**Bold thesis paragraph. Three to six sentences saying what is TRUE and why it MATTERS.
Never a table of contents — never "this page will cover". State the claim.**

## Body sections

Prose plus code. As many sections as the topic actually has.

## Gotchas

### Name of the gotcha, as a symptom the reader would search for
**Symptom.** What the reader sees — the error, the wrong number, the silent pass.
**Cause.** The mechanism, precisely. Name the class and method.
**Fix.** Shown in code. Never write "the fix is to use X" without showing X.

## Interview questions

Exhaustive. Each question followed by its actual answer, not a hint.

**Q: The question as an interviewer would ask it.**
The answer, in full, in prose.

---

← Prev: [Title](path.md) · Index: [Title](README.md) · Next → [Title](path.md)
```

Tier badge is exactly one of `t-master`, `t-understand`, `t-know`, `t-when`, with the
matching word — `Master`, `Understand`, `Know`, `When Needed` — as the span's text.

## 3 · The verification module — where code is allowed to run

Create **one** Maven module for the topic, at:

```
sandbox/java/<topic-slug>/
  pom.xml
  src/main/java/dev/devbible/<topicpkg>/...
  src/test/java/dev/devbible/<topicpkg>/...
```

Rules for it:

- **Every non-trivial code block in your pages must come from a file in this module.** Do
  not hand-write a snippet in the page and hope it compiles. Write it in the module, verify
  it, then copy it into the page.
- The module must build clean: `mvn -q -f sandbox/java/<topic-slug>/pom.xml test`.
- Tests are how you prove behavioural claims. If the page says "this throws
  `IllegalStateException`", there is a test asserting exactly that.
- Pin exact versions in the `pom.xml`. Never a version range, never `LATEST`.
- Illustrative fragments that deliberately do not compile — a two-line "this is what people
  write" counter-example — are fine, but **mark them**: `// does not compile — see below`.
- Keep the module inside `sandbox/`. Never scatter `.java` files into the `docs/` tree.
- The module is a deliverable. Report its path and its test count.

## 4 · Evidence — the rules that do not bend

1. **Validate every claim against official documentation** and name the real URL on the
   `> Verified:` line. For Java that is the JDK javadoc, the JLS, the JEPs; for Spring, the
   Framework and Boot reference docs and the class javadocs — the class javadocs are often
   the only place the real behaviour is written down, so go there when the reference is
   vague.
2. **A claim the documentation cannot settle is stated as uncertain, or left out.** Write
   "I could not confirm this against the 4.1 reference" in the page. That is a *good* page.
   A confident invention is a defect that outlives you.
3. 🔴 **NEVER invent output.** No console block, stack trace, timing, byte count, version
   string or error message that did not come from a run that actually happened in your
   module. This is the single most common failure in AI-authored technical docs, and it is
   worse than an omission because it reads as authoritative.
   - Output you genuinely produced: quote it verbatim, and say which command produced it.
   - Output you did not produce: do not write it. Not "approximately", not "something
     like", not a plausible reconstruction from memory.
   - An error string from the docs or the library source may be quoted **inline as a
     backticked phrase**, with its source named. Never expanded into a fenced traceback
     with an invented file path, line number and frame stack.
4. **Never present a benchmark you did not run**, and if you did run one, state the
   hardware, the JDK build and the fact that it is one machine. A microbenchmark without
   JMH is not a benchmark; say so rather than publishing a number from `System.nanoTime()`.
5. **Where a page compares to another ecosystem** (Java vs Go, Spring vs Node), quote the
   other side's *own published claim* with attribution. Never assert a comparative number
   as if you measured it.

## 5 · Links

- Every link ends in `.md` and keeps its numeric prefix: `../09-caching.md`, `README.md`,
  `../08-transactions/README.md`. **Never a bare directory slug.**
- **Never link a file you have not written.** If you reference a concept whose page does
  not exist yet, write it as plain bold text with a marker —
  `**Connection pooling** *(not written yet)*` — never as a link to nothing.
- 🔴 **Do not trust a link resolver on this repo.** The project's `fixlinks.py` resolves
  `NN-topic.md` against a *directory* named `NN-topic/` and reports it clean, so a genuinely
  dead link passes. After any rename or file→directory conversion, resolve every link
  yourself:

  ```bash
  python3 - <<'PY'
  import re, pathlib
  for f in pathlib.Path('docs/java/pages/<your-phase>').rglob('*.md'):
      for m in re.finditer(r'\]\((?!https?:|#)([^)#]+)\)', f.read_text()):
          if not (f.parent / m.group(1)).resolve().is_file():
              print("DANGLING:", f, "->", m.group(1))
  PY
  ```

- 🔴 **Never rename a file after you have linked to it.** This is the most common defect in
  this repo's history — a chunk gets renamed during a split and every inbound link rots
  silently. Decide filenames first, then write.

## 6 · MDX — three things that pass a local read and abort the production build

The pages are compiled as MDX. These three are silent locally and fatal in CI:

1. A bare HTML comment `<!-- ... -->` in prose. Use `{/* ... */}` instead.
2. An inline code span left **open** at end of line, when the next line starts with `{`.
   Reflow the sentence.
3. A bare `<Something` in prose — `List<String>`, `<clinit>`, `<init>`, a generic in a
   sentence. **Backtick it.**

Check with:

```bash
python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py --no-rawtag docs/java/pages/<your-phase>
```

## 7 · Scope — what you must not touch

- **Your assigned topic directory only**, plus your `sandbox/java/<topic-slug>/` module.
- **Never** edit a phase `README.md`, `src/data/progress.js`, another topic, another
  language under `docs/`, or anything else outside those two paths. Several sessions write
  to this checkout at once.
- **Never `git add -A`.** In fact: **never commit at all.** Report; a human or the
  coordinating session commits.
- **Never run the site build** (`yarn build`, `yarn start`). It compiles every language and
  is heavy, and another session may be mid-write. Your verification is `wc -l`, the MDX
  checker, the link script above, and your module's `mvn test`.
- **Never spawn sub-agents.**

## 8 · Before you report

Run these and paste the real output:

```bash
wc -l docs/java/pages/<your-phase>/<your-topic>/*.md          # nothing over 300
python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py --no-rawtag docs/java/pages/<your-phase>
mvn -q -f sandbox/java/<topic-slug>/pom.xml test              # must be green
# plus the link-resolution snippet from §5
```

## 9 · Report format — exactly this

1. **Files written**, each with its `wc -l`, its gotcha count and its interview-question
   count.
2. **Split audit**: for every file you split, the before and after line counts and
   gotcha/question counts, proving the totals did not shrink.
3. **The module**: path, number of test classes, number of tests, and the `mvn test` result.
4. **Dangling links you created** — any link pointing at a file you did not write. Name
   each one precisely. If there are none, say "none".
5. **What the documentation could not settle** — every claim you left uncertain or omitted,
   and why. This section being empty is a warning sign, not a success.
6. **Anything you disagree with in this brief.** If the brief asserts something about Java
   or Spring that the documentation contradicts, **say so and follow the documentation.**
   Do not comply with a factual error just because it came from the instructions.

---

## ASSIGNMENT

> Fill these in before sending.

- **Topic:** `<<< e.g. Phase 11 · Testing, topic 06 · MockMvc >>>`
- **Write to:** `<<< docs/java/pages/phase-11-testing/06-mockmvc/ >>>`
- **Tier:** `<<< Master | Understand | Know | When Needed >>>`
- **Version target:** `<<< e.g. Java 25, Spring Boot 4.1, JUnit 6 >>>`
- **Footer neighbours:** Prev `<<< path.md >>>` · Index `<<< README.md >>>` · Next
  `<<< path.md >>>`
- **Cover, at minimum:** `<<< the bullet list of subtopics — but treat it as a FLOOR, not a
  ceiling; if the topic has more, write more >>>`

---

See also [[devbible-author-brief]] — the equivalent brief for in-house Claude forks, which
is shorter because those agents already load the project's hard rules from
`~/.claude/CLAUDE.md`. An external tool loads nothing, which is why this file spells
everything out.
