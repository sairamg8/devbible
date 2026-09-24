---
name: devbible-realworld-split-3way
description: The Real World track's remaining 19 topics split three ways by phase — chunk A (TypeScript), B (CSS recipes), C (MongoDB mirror) — with paste-ready bootstrap prompts and the shared-file rules
metadata:
  type: project
---

# Real World — the remaining work, SPLIT THREE WAYS (2026-08-17)

🔴 **Set on the user's instruction**, given while session `ab508775` held the track:

> *"i want to split your task to different session make sure to they follow the 300 line
> limit never a content budger they split more than 300 lines into different files and
> use it"*

**60 of 79 topics are written. 19 remain, split by PHASE so no two sessions ever write in
the same directory or the same phase `README.md`.**

| Chunk | Phase | Left | Start at |
|---|---|---|---|
| **A** | **6 · TypeScript across the stack** | **7** (02–08) | **6·02 · zod schemas as the source of truth** |
| **B** | **7 · CSS recipes** | **6** (01–06) | **7·01 · The product grid** |
| **C** | **8 · The MongoDB mirror** | **6** (01–06) | **8·01 · Modeling the store as documents** |

**Done and off the board:** phases 0 (3), 1 (12), 2 (10), 3 (12), 4 (12), 5 (10) and
**6·01 · The shared types package** — all committed on `main`.

## 🔴 How the user starts a chunk

**"real world A" / "realworld chunk B" / "RW C" is the whole instruction.** Open this
file, take the chunk's row, claim it, and **start writing** — no plan, no confirmation,
no clarifying question. A phase number settles it too: 6 → A · 7 → B · 8 → C. Only ask if
they say "real world" with no letter and no phase.

---

## 🔴🔴 THE RULE THE USER NAMED, IN FULL — read before writing a line

**300 lines is a FILE-SIZE cap. It is NEVER a content budget.** This is
`~/.claude/CLAUDE.md` rule 1 plus rule 13, and the user restated both when ordering this
split.

1. **Write the explanation the topic deserves FIRST.** Every gotcha, every pitfall, every
   worked example, every interview question the topic actually has. **Do not look at the
   line count while doing this.**
2. **THEN split** on a **concept boundary** into `NN-topic/` chunks so **no file exceeds
   300 lines**.
3. **THEN wire the chunks in** — the topic `README.md` indexes them and the prose links
   to them where the reader needs them.

**Content is fixed; file count is the variable.** A topic with thirty gotchas is a topic
with more chunks, never a topic with the best six.

⛔ **Never trim, reword, drop a section, or shorten answers to fit 300.**
⛔ **Never give a section a quota** — not 2 gotchas, not 5 questions, not "five looked like
enough". Rule 13 calls Q&A out specifically as *"most important"*.

**The tells you got it wrong:** a run of pages all landing just under the cap; every page
having about the same number of gotchas and questions; two files at exactly 300. Real
topics vary. Phase 5 is the worked example of getting it right — its pages run 186–291
with gotchas 7–10 and Q&A 7–10, **not uniform**.

**Chunk layout** (the file becomes a directory, keeping its numeric prefix):

```
NN-topic/
├── _category_.json   {"label":"NN · Topic","position":N,"collapsed":true}
├── README.md         tier badge · Verified line · one-liner · chunk table ·
│                     three-sentences-to-keep · phase gate · where this connects
├── 01-first-chunk.md
└── 02-second-chunk.md
```

Every chunk repeats the tier badge and `> Verified:` line and carries **its own** Gotchas
and Interview questions. Chunks link `← Prev` / `Next →`.

---

## Conventions every chunk follows

- **Page contract:** problem → design choices with their costs → full implementation
  (complete, copyable, no elisions) → using it in the app → gotchas (symptom→cause→fix)
  → interview questions (★ marked). **No quotas on the last two.**
- **`> Verified: 2026-08`** naming the docs consulted **and** the concept pages composed.
- 🔴 **NO DUPLICATION — this is the track's founding rule.** Chapters **compose existing
  concept pages and LINK to them**. If a chapter re-teaches a concept that has a home
  elsewhere in the repo, that is a bug. State the CONCEPT and the CHOICE, then link to
  the implementation.
- **No sandbox, no console blocks, no timings** (rule 8). Validate against official
  documentation and name the source. No run means no output block — never reconstruct one.
- **Links always end `.md` and keep every numeric prefix.** Directory index →
  `../01-topic/README.md`. Cross-section → `../../../typescript/pages/...`.
- ⛔ **A target another chunk owns, or that is unwritten, is BOLD PLAIN TEXT with
  *(not written yet)*** — never a link. A link to a non-existent file breaks the build.
- **Per-file cadence:** write file → update the four boards → commit (explicit paths,
  **never `git add -A`**) → update the memory.

### The four boards, every time

1. `src/data/progress.js` — the `realworld` row, **your phase only**. Mid-phase needs
   **both** `pages: N` **and** `pagesPlanned: <total>`; drop `pagesPlanned` only at phase
   close. ⚠️ One shared row — re-read before editing and keep other phases' numbers.
2. Your phase's `docs/real-world/pages/phase-N-*/README.md` — the topic row and link.
3. `docs/real-world/pages/README.md` — your phase's row only.
4. `docs/README.md` — the Real World claims row and the technology row.

---

## 🔴 Verification — three checks, and none subsumes the others

**Do NOT run `yarn build` or `yarn start`** without claiming
`shared/session_build_devserver_registry.md` (rule 12). It has been held all day. The
three checks below need **no claim** — they are per-file parses, not bundles.

**1. Links resolve** — walk every `](...md)` against the filesystem.

**2. MDX compiles** — catches parse errors. Run from the **project root** (bare
specifiers resolve from the script's location, not cwd):

```bash
node --input-type=module -e "
import {compile} from '@mdx-js/mdx'; import fs from 'node:fs'; import path from 'node:path';
const files=[]; (function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
 if(e.name==='reviews')continue; const p=path.join(d,e.name);
 if(e.isDirectory())w(p); else if(e.name.endsWith('.md'))files.push(p);}})('docs');
const strip=(s)=>s.startsWith('---\n')?s.slice(s.indexOf('\n---',4)+4).replace(/^[^\n]*\n/,''):s;
const bad=[]; for(const p of files){ try{ await compile(strip(fs.readFileSync(p,'utf8'))); }
 catch(e){ bad.push([p,String(e.message).split('\n')[0]]); } }
console.log(bad.length?bad:'ALL CLEAN');"
```

⚠️ **`await` the compile** — rejections are async and escape a bare `try`/`catch`, giving
a GREEN report while pages are broken. ⚠️ **Strip YAML frontmatter** — otherwise `---`
parses as a setext heading and a JSX-looking tag in a *title* (`<script>`, `<Suspense>`)
flags as an unclosed element.

**3. 🔴 AST scan for render bombs — the one that a compile CANNOT catch.**
`{kind}` is *valid MDX*, so `compile()` passes and the page only explodes at static
render with `ReferenceError: kind is not defined`. **This broke the Pages deploy on
2026-08-17 while two independent full-corpus compiles reported green.** Walk the tree for
`mdxTextExpression` / `mdxFlowExpression` nodes whose value is a bare identifier:

```bash
node --input-type=module -e "
import {createProcessor} from '@mdx-js/mdx'; import fs from 'node:fs'; import path from 'node:path';
const proc=createProcessor(); const hits=[];
const strip=(s)=>s.startsWith('---\n')?s.slice(s.indexOf('\n---',4)+4).replace(/^[^\n]*\n/,''):s;
function visit(n,f){ if(!n||typeof n!=='object')return;
 if(n.type==='mdxTextExpression'||n.type==='mdxFlowExpression'){ const v=(n.value||'').trim();
  if(/^[A-Za-z_\$][\w\$]*(\.[\w\$]+)*\$/.test(v)) hits.push([f,n.position?.start?.line,v]); }
 for(const k of ['children','attributes','value']) if(Array.isArray(n[k])) n[k].forEach(c=>visit(c,f)); }
(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
 if(e.name==='reviews')continue; const p=path.join(d,e.name);
 if(e.isDirectory())w(p); else if(e.name.endsWith('.md')) visit(proc.parse(strip(fs.readFileSync(p,'utf8'))),p);}})('docs');
console.log(hits.length?hits:'NO RENDER BOMBS');"
```

🔴 **The cause to avoid while writing:** a template literal inside an inline code span
written with backslash-escaped backticks. **Backslashes do not escape inside a code
span**, so the span closes early and `${x}` lands in prose as live MDX. Use
**double-backtick delimiters** instead: `` `` || `${kind}-${id}` `` ``.

---

## Shared-file collision rules

Several sessions write to this checkout at once. **Never `git add -A`** — stage explicit
paths. Expect other chunks' rows in your diff and leave them. Treat a build failure you
did not cause as another session's to fix; route it to them rather than editing their
files.

---

# The three prompts — paste one per session

## Chunk A — Phase 6 · TypeScript across the stack (7 topics)

> Pick up the **Real World track, chunk A** in `/mnt/Storage/Backup/Knowledge/devbible`
> on `main`. Read `devbible/project_realworld_split_3way.md` in the memory store first —
> it carries the rules, the conventions and the three verification checks — then
> `devbible/progress_realworld_build.md` for the track's state.
>
> **Your scope is `docs/real-world/pages/phase-6-typescript/` and nothing else.**
> **6·01 · The shared types package is already written** (2 chunks). Start at **6·02** and
> write straight through to 6·08 without stopping to ask:
>
> 02 zod schemas as the source of truth — `z.infer` end to end (Master) ·
> 03 Typing raw `pg` results — interfaces per query module, no ORM (Master) ·
> 04 Discriminated unions — the order-status state machine that will not compile an
> invalid transition (Master) · 05 Typed Express handlers and middleware — `Request`
> generics without the cast parade (Understand) · 06 Typing the custom hooks — generics
> that infer, overloads where they pay (Understand) · 07 The typed API client
> (Understand) · 08 Utility types in app code — `Pick`, `Omit`, `satisfies` (Know)
>
> **Compose, never re-teach:** the language itself lives in `docs/typescript/` — link to
> phase-1 (vocabulary), phase-2 (narrowing, incl. `05-discriminated-unions.md`,
> `06-exhaustiveness.md`, `10-satisfies/`), phase-3 (generics), phase-7-server
> (`05-typed-express-handlers/`). ⚠️ **TypeScript phases 5, 6 and 12 have NO pages** —
> never link there.
>
> 🔴 **The 300-line cap is a FILE-SIZE rule, never a content budget.** Write the topic in
> full, then split on concept boundaries into `NN-topic/` chunks. The four Master topics
> here will need chunking. Gotchas and Q&A get as many entries as the topic has.
>
> Per-file cadence: write → four boards → commit explicit paths → memory. Run the three
> checks. **Do not wait for me; run to completion.**

## Chunk B — Phase 7 · CSS recipes (6 topics)

> Pick up the **Real World track, chunk B** in `/mnt/Storage/Backup/Knowledge/devbible`
> on `main`. Read `devbible/project_realworld_split_3way.md` in the memory store first,
> then `devbible/progress_realworld_build.md`.
>
> **Your scope is `docs/real-world/pages/phase-7-css-recipes/` and nothing else.** The
> directory does not exist yet — create it with `_category_.json`
> (`{"label":"Phase 7 · CSS recipes","position":7,"collapsed":true}`) and a phase
> `README.md`, then write all six in syllabus order:
>
> 01 **The product grid** — Grid + container queries, phone to wide desktop (Master) ·
> 02 The header and navigation — responsive without a breakpoint pile-up (Understand) ·
> 03 **The checkout form** — layout, focus states, inline validation styling (Master) ·
> 04 Skeleton loaders and spinners — perceived speed while the hooks fetch (Understand) ·
> 05 Dark mode — the token layer, honouring the three viewer states (Understand) ·
> 06 The overlay layer — toasts and modals that never fight the stacking context
> (Understand)
>
> **Compose, never re-teach:** `docs/css/` is complete (74 topics) — link to
> phase-5-grid, phase-6-container-queries, phase-7-positioning (stacking contexts),
> phase-8-color-theming (tokens). The React side is
> `../phase-4-react-ui/07-modal-portal-focus.md` and `04-useform-and-checkout.md`.
>
> 🔴 **The 300-line cap is a FILE-SIZE rule, never a content budget.** Write it in full,
> then split. ⚠️ **Dark mode must cover all THREE viewer states** — explicit light,
> explicit dark, and system default with nothing stamped.
>
> Per-file cadence and the three checks. **Do not wait for me; run to completion.**

## Chunk C — Phase 8 · The MongoDB mirror (6 topics)

> Pick up the **Real World track, chunk C** in `/mnt/Storage/Backup/Knowledge/devbible`
> on `main`. Read `devbible/project_realworld_split_3way.md` in the memory store first,
> then `devbible/progress_realworld_build.md`.
>
> **Your scope is `docs/real-world/pages/phase-8-mongodb-mirror/` and nothing else.** The
> directory does not exist yet — create it with `_category_.json`
> (`{"label":"Phase 8 · The MongoDB mirror","position":8,"collapsed":true}`) and a phase
> `README.md`, then write all six:
>
> 01 **Modeling the store as documents** — embed vs reference, and where each of the
> eleven tables lands (Master) · 02 The catalog on MongoDB — filters, sort, pagination
> **behind the same API contract** (Understand) · 03 **Checkout with transactions** — the
> stock decrement, sessions, and the write-concern question (Master) · 04 The dashboard
> on the aggregation pipeline (Understand) · 05 Indexes for this app's queries, and
> reading `explain()` (Understand) · 06 Change streams where `LISTEN`/`NOTIFY` was (Know)
>
> **This phase is the whole track's payoff: the SAME app, the SAME API contract, a
> different database.** Every chapter's job is the comparison — what the document model
> makes easy, what it makes hard, and what the PERN chapter did instead. Link the PERN
> counterpart in every chapter: the eleven tables are
> `../phase-0-the-app/02-architecture-and-data-model.md`, the schema is
> `../phase-1-database/01-the-schema/README.md`, checkout is
> `../phase-1-database/06-the-checkout-transaction/README.md`, dashboards
> `09-dashboard-queries.md`, indexes `10-indexes.md`, `LISTEN`/`NOTIFY` `12-listen-notify.md`.
>
> **Compose, never re-teach:** `docs/mongodb/` phases 0–5 are written (34 topics) — link
> to phase-3-schema-design, phase-4-crud, phase-5-query-operators. ⚠️ **MongoDB phases
> 6–14 have NO pages** — never link there, so aggregation and index *concepts* must be
> stated here or cited from the Manual, not linked internally. ⚠️ **There is no MongoDB
> server on this machine** — validate against the MongoDB Manual v8.0, no console blocks.
>
> 🔴 **The 300-line cap is a FILE-SIZE rule, never a content budget.** Write it in full,
> then split. Per-file cadence and the three checks. **Do not wait for me; run to
> completion.**

---

## When a chunk finishes

Update `docs/README.md`, then **say the chunk is complete and stop** — do not pick up
another chunk or another language. The Real World track is done when all three land, at
**79/79**.
