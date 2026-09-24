---
name: devbible-javascript-lane-a-history
description: Session-by-session history of the JavaScript lane A build — what each earlier session wrote and why; the live cursor is in devbible-javascript-build-progress
metadata:
  type: progress
---

**History only.** The live cursor, the standing rules and the trap list are in
[[devbible-javascript-build-progress]] — read that first. This file is what each earlier session
did, kept so a number or a decision can be traced back without bloating the cursor file
([[devbible-memory-file-cap]]).

## 🔴 Session `ec7d13f7` — 2026-08-14, lane A

Took lane A over from `016cfc46` on *"pick javascript line a"*; claim rewritten in
`docs/README.md` and `docs/javascript/pages/README.md`. Lane B is now held by `b4ffc223`.

✅ **Written: Phase 3 topic 17, complete — 5 chunks / 1,254 lines** (216 / 262 / 197 / 247 / 279 + a 53-line README). **Phase 3's Understand tier is now closed, 09–17.** Clean rebuild: **0 broken links under `docs/javascript/`** (13 react + 3 typescript belong to other locks).

**Topic 17's shape, and it is the reusable one for every Understand topic that overlaps a
Master topic.** The mechanism already exists in Master 02 (Parameters) and 06 (Closures), both
sandbox-proven. So topic 17 does **not** re-explain defaults or capture — it is the **field
guide**: where those two facts surface at boundaries you do not control.

- 01 — JSON has no `undefined`, so "absent" arrives as `null` and every default is skipped.
  `??` not `||`. Then the decision under it: collapsing `null` destroys the
  **absent-vs-explicitly-cleared** distinction a PATCH endpoint depends on, so the rule is
  per-boundary (`?? ` when rendering, `!== undefined` when writing).
- 02 — spread and `Object.assign` copy an explicit `undefined` **key** over a default;
  destructuring defaults do not. Pass-through parameters get **no** default. A fresh `[]` per
  call means identity is never stable (dead caches, always-changed dependency checks); hoist
  **and freeze** only when identity matters.
- 03 — the two failure shapes, and the one diagnostic that separates them: **wrong value is the
  LAST one → too few bindings; the FIRST one → too many.** Also the correction to "`let` fixes
  loops": per-iteration bindings come from the loop **body's block** or the `for` **head**, so a
  `let` outside a `while` behaves exactly like `var`.
- 04 — registration-time snapshots (`const url = config.url`, and destructuring is the same
  snapshot), the counter factory that proves closures are not the problem, and the **four fixes**
  with a table for choosing between them.

**Topic 18 · IIFE (Know tier) — the shape a Know topic should take.** Framed as a *reading*
skill, not a writing one: "you will not write an IIFE this year, and you will read one this week."
Load-bearing content: why the wrapping parens are required (declaration vs expression position) and
why minifiers use `!function`/`void function`; what the defensive leading `;` prevents when raw
files are concatenated; the revealing module pattern as a closure used once; then a table of what
modules replaced it with, whose deep point is that **`import`/`export` are static, which is the
precondition for tree-shaking** — an IIFE's dependencies are runtime values, so nothing can be
proven about them. 276 lines, single file, no chunking needed.

**Topic 19 · Function properties.** The framing that made it work: *you* rarely read `fn.name`,
but your dependency tree does. `length` overlaps Master 02.1, so the page carries the **concept
plus the consumers** (Express `=== 4`, Mocha `> 0`, curry) and links the measured table rather
than repeating it. Two facts worth keeping: all three properties are **non-writable but
configurable**, which is what makes `Object.defineProperty(wrapped, "length", …)` the legal repair
after a `(...args) =>` wrapper flattens arity to 0; and **minification is the real hazard** — a
registry keyed by `fn.name` works in dev and silently loses entries in prod, which is why
`displayName` and keep-names flags exist. 236 lines.

**Topic 20 · `new.target` (Know).** The two facts that carry the page: the `instanceof` guard
**infers** the answer from the prototype chain, so `Fn.call(obj)` passes it — `new.target` reports
the invocation itself; and the abstract-class idiom must test **`new.target === Base`**, not
truthiness, because during `super()` `new.target` is the *subclass*. Also: arrows inherit it,
`Reflect.construct`'s third argument sets it, and it is a **`SyntaxError`** outside a function
body. Recommendation is **throw, not auto-`new`** — a dual-mode factory acquires two permanent
call signatures. 244 lines.

**Phase 4 started · topic 02 · Property access (Understand, 266 lines).** Built on one stated
rule — *every property key is a string or a symbol; anything else is stringified first* — and every
section is that rule applied somewhere. The load-bearing case is **two different objects both
stringifying to `"[object Object]"`**, so an object-keyed plain object holds one entry and each
write overwrites the last; `Map` is the fix. Also: dot-vs-bracket is really **literal vs computed**;
`arr[-1]` and `arr[1.5]` are ordinary properties that `length` ignores; `a?.b.c` still throws when
`a` exists and `b` does not; and a dynamic key reaching `Object.prototype` is indistinguishable
from a hit, which is why `Object.create(null)` / `Map` exist.

**Topic 09 · `extends` and `super` (2 chunks, 521).** The framing that unlocked it: **`super` is
two operators sharing a keyword** — `super(...)` is a call that *creates* `this` in a derived
class, `super.x` is a lookup through the method's **home object**. Facts worth not re-deriving:
`extends` wires **two** links (instance chain *and* static chain, which is why statics inherit and
`new this()` builds the subclass); derived fields initialise **after** `super()` returns, so a base
constructor calling an overridable method sees them as `undefined` (`TypeError` for `#private`);
the implicit constructor forwards `...args`, so hand-writing one is a silent breaking change; and
**`super` is a `SyntaxError` in `greet: function () {}`** because there is no home object — which
makes that "equivalent" rewrite break the build, while arrows inherit `super` like `this`.

**Topic 10 · Getters and setters (284).** Two sections carry it, and both are the kind of thing
that is wrong in most write-ups. **(1) Spread, `Object.assign`, `JSON.stringify` and devtools all
INVOKE getters**, and spread copies the *result* as a plain data property — so the copy silently
stops recomputing and its setter is gone; preserving accessors needs
`Object.getOwnPropertyDescriptors` + `Object.create`. **(2) A class getter is on the prototype**,
so `JSON.stringify` (own enumerable only) drops it, while an object-literal getter serialises
fine — **the two behave oppositely**, and `toJSON()` is the fix. Also: the `#` backing field beats
`_name` because `_name` is an ordinary property a subclass can silently share; getter-only
assignment is silent in sloppy mode and a `TypeError` in modules; `defineProperty` defaults every
flag to `false`.

⚠️ **`docs/javascript/` broken links keep appearing and disappearing in `phase-9-dom`** — that is
lane B mid-write, seen twice on 2026-08-14 (`forms/`, then `measuring-elements/`). **Tally by
phase before reacting**, not just by language.

⚠️ **Phase 4's README carried a stale plan** — "Master-first … the next unit of work is Phase 5,
not topic 02". Rewritten to the live Understand-tier status. **Expect the same stale block in
phases 5, 6, 7 and 8** when each is picked up.

🔴 **Phase 3 is closed. `pagesPlanned` was DROPPED from its `progress.js` row** — that is what
makes `phaseStatus()` report complete rather than 'writing'. Do not leave it in on a finished
phase.

⚠️ **Lane B is mid-write in `phase-9-dom`, and its broken links show up in a whole-site build**
(2 on 2026-08-14, from `forms/`). **They are not mine.** Tally by phase, not just by language,
before reacting.

🔴 **The cap-clustering tell fired again and was acted on.** First draft was two files of
**338 and 307** — over the cap *and* in the band rule 1 names as evidence of writing to fit.
Re-split on concept boundaries into **four**; total went **up**, nothing trimmed. That is the
second recorded sighting (phase 11 topic 03 was the first) — **if a draft lands at 290–340,
the split is wrong, not the content.**

🔴 **NOT ONE of my commits landed — other sessions committed all of it, twice.** Lane B's
`6a72c26` swept up chunks 1–4 plus my claim edits; a broad `57b26ca` "Progress on Aug 14"
from another session then swept up chunk 5, the board updates and `progress.js` — and
**pushed**, taking the checkout from 153-ahead to up-to-date. Both of my `git commit`
calls answered *"nothing added to commit"* because the work was already in HEAD.

**Nothing was lost and nothing needs fixing.** But the lessons are concrete:
- `git add` and `git commit` share **one index** across every session in this checkout, so
  a staged change belongs to whoever commits next. **Do not assume it will be yours.**
- **Verify by path, not by your own commit:** `git log --oneline -1 -- <file>`. A commit
  that reports "nothing added" is usually *success by someone else*, not a failure.
- Consequence for the per-file cadence: the cadence still holds, but *committing* is not
  the thing that makes work durable here — **writing the file is**. Keep the memory write
  as the real checkpoint.

⚠️ **The Bash sandbox discards `cd` and some writes between calls.** A `cd … && rm …` silently
did nothing, and a `mkdir -p docs/javascript/…` run from a stale cwd created an empty
`docs/javascript/pages/phase-3-functions/docs/` tree (removed). **Use absolute paths and
`git -C <root>`** for everything.

## 🔴 SESSION `ec7d13f7` — full stop-and-save, 2026-08-14

**Stopped on the user's instruction** (*"Stop and can you save all the session progress to
memory"*), not at a problem. **Everything is committed and the working tree is clean for lane A.**
The only dirty JavaScript paths are `phase-9-dom/` — lane B's, mid-write, and not to be touched.

### What this session wrote — 7 topics, 13 files, ~3,100 lines

| Phase | Topic | Tier | Files / lines | Commit |
|---|---|---|---|---|
| 3 | **17 · Closure and default-parameter gotchas** | Understand | 5 chunks + README / 1,254 | swept into `6a72c26`, `57b26ca` |
| 3 | **18 · IIFE and the module pattern** | Know | 1 / 276 | `1256acb1` |
| 3 | **19 · Function properties** | Know | 1 / 236 | `29408309` |
| 3 | **20 · `new.target` and constructor guards** | Know | 1 / 244 | `65778dfa` |
| 4 | **02 · Property access** | Understand | 1 / 266 | `50a10999` |
| 4 | **09 · `extends` and `super`** | Understand | 2 chunks + README / 521 | `cf439b56` |
| 4 | **10 · Getters and setters** | Understand | 1 / 284 | `e344528f` |
| 4 | **11 · Property descriptors** | Understand | 1 / 246 | `088ea644` |

🎉 **PHASE 3 IS COMPLETE — 20 of 20, every tier** (Master 8/8 · Understand 9/9 · Know 3/3), and
`pagesPlanned` was dropped from its `progress.js` row, which is what makes it read as complete.

**Corpus moved 137 → 145 of 316 in scope (46%).** Lane A left: **62** — phase 4: 9 · phase 5: 18 ·
phase 6: 10 · phase 7: 11 · phase 8: 14.

**Every topic:** clean rebuild (`rm -rf .docusaurus build node_modules/.cache && yarn build`),
**0 broken links under `docs/javascript/`** at every checkpoint, **0 files over 300 lines**, boards
updated (phase README + `progress.js` + both claim notices), commit, memory.

### Standing traps confirmed or added this session

1. 🔴 **The cap-clustering tell fired and was acted on** — topic 17's first draft was two files of
   **338 and 307**, over the cap *and* in the band rule 1 names as evidence of writing to fit.
   Re-split on concept boundaries into **four**; total went **up**. Second recorded sighting.
   **If a draft lands at 290–340, the split is wrong, not the content.**
2. 🔴 **Other sessions commit your staged files.** Two of my commits reported *"nothing added to
   commit"* because `6a72c26` (lane B) and `57b26ca` had already swept the work into HEAD from the
   shared index — and pushed. **Verify by path (`git log --oneline -1 -- <file>`), never by your
   own commit.**
3. ⚠️ **The Bash sandbox discards `cd` between calls**, and a `mkdir -p docs/…` from a stale cwd
   created an empty nested `docs/` tree inside `phase-3-functions` (removed). **Absolute paths and
   `git -C <root>` for everything.**
4. ⚠️ **Phase READMEs carry a stale "Master-first, the rest is deferred" block.** Phase 4's said
   *"the next unit of work is Phase 5, not topic 02"*. Rewritten. **Expect the same in phases 5, 6,
   7 and 8.**
5. ⚠️ **`phase-9-dom` broken links come and go in a whole-site build** — lane B mid-write, seen
   twice. **Tally by phase, not just by language, before reacting.**

### The shape that is working, and should continue

**An Understand topic that overlaps a Master one is a FIELD GUIDE, never a second
implementation.** Topic 17 is the fullest worked example: Master 02 and 06 own the mechanism, so 17
covers only where those facts surface at boundaries you do not control. Topic 02's overlap with
Master 01, and 09's with Master 06, were handled the same way.

**Know topics are framed as a reading skill.** Topic 18: *"you will not write an IIFE this year,
and you will read one this week."*

## 🔴 Session `016cfc46` — 2026-08-14

Took the JavaScript lock over from `c5329658`. Three things, in order:

1. **Locked the standing order into `~/.claude/CLAUDE.md`.** The JavaScript-only order had
   existed *only* in this store — the auto-loading rule 11 still said **React only, in a
   worktree**, so any fresh session read the wrong language. Rewritten as **§11b · JavaScript,
   `main`, no worktree**. Store commit `1399d04`.
   🔴 **The lesson is rule-shaped: a standing order that lives only in the store is not a
   standing order.** When the user names a new language, rewrite rule 11 in the same turn.
2. **Audited the syllabus** (below) and corrected two wrong board figures.
3. 🔴 **Tier lock** (*"lock in understand know tier"*) → **Understand and Know only**, then
   wrote **phase 3 topic 12 · Composition** under it. Store `b5bbeb4`, project `5e52b3a`,
   `c408b08`.

**Topic 12 shape, for the ones that follow it:** compose and pipe are the same function with
the argument list reversed; the unary constraint is what makes currying and composition one
subject rather than two; the honest cost is the stack trace, not performance. 276 lines,
single file, no chunking needed. That is the Understand-tier target shape — one file, ~250–280
lines, unless the topic genuinely splits.

⚠️ **`docs/README.md` and `src/data/progress.js` are shared boards.** Commit `5e52b3a`
incidentally carried session `45e775dc`'s in-flight Git rows because the file was dirty when
staged. Not harmful, but check `git diff` on those two before staging and say so in the message.

## 🔴 Session handoff — 2026-08-14, session `01ECVvH5`

**Stopped at a usage limit, not at a problem.** Everything is committed and pushed; there is
no dirty state and no half-written topic.

**What this session did:** Master tiers completed for **phases 7, 8, 9 and 10**, and phase 11
started. 20 topics written, from 123 → 154 pages.

| Phase | Master tier |
|---|---|
| 7 · Async | ✅ all 11 (04–11 written this session) |
| 8 · Modules, errors, memory | ✅ all 4 |
| 9 · The DOM | ✅ all 6 |
| 10 · Events | ✅ all 4 |
| **11 · Network and storage** | 🔨 **2 of 5 — resume at topic 03** |

**To resume:** read this file's Cursor table, then
[[devbible-javascript-concepts-phase11]] for what topics 01–02 already cover, then write
**topic 03 · A `fetch` wrapper worth reusing**. The two forward references already made to it
are: it must **skip `Content-Type` for `FormData` bodies**, and it must **clone the response
before logging** on failure.

**Remaining scope, measured:** ~8 min per 3-chunk Master topic. Master tiers left for phases
11 (3 topics), 12–18 (~45 topics) ≈ **7 hours**. Understand/Know across all phases ≈ 196
topics ≈ **10–14 hours**. The full 337-topic corpus is **20–25 hours** of continuous work —
told to the user 2026-08-14 so scope could be a decision rather than a surprise.

## Remaining scope — measured 2026-08-14

**132 of 337 topics written (39%).** 🔴 **The entire Master tier — all 99 topics — is done.** Master tier is the priority and is nearly done:

| | Count |
|---|---|
| **Master topics left** | 🔴 **ZERO — all 99 are written** |
| Understand / Know left | 205 |
| Total left | 205 |

Phases 0–2 are complete at every tier; **every phase 3–18 has its Master tier complete**. The
one-liner that reproduces these numbers is in [[devbible-overall-snapshot]].

## 🔴 Session `c5329658` — what this session did (2026-08-14)

**Paused on the user's instruction at ~90% usage. Everything is committed in both repos; there is
no dirty state and no half-written file.**

Started at **105 of 337 topics** with Master tiers complete through phase 10.
Finished at **132 of 337 (39%)**, having closed **eight phase Master tiers** and then begun the
Understand tier:

| Phase | Master tier closed this session |
|---|---|
| 11 · Network, storage, data transfer | fetch, request bodies, the fetch wrapper (6 chunks), URL/URLSearchParams, CORS |
| 12 · The browser platform | DevTools, client-side security |
| 13 · Complexity and real costs | Big-O, the complexity classes, choosing a structure |
| 14 · Core data structures | dynamic arrays, hash maps/sets, frequency and grouping, stack, queue/deque |
| 15 · Algorithmic patterns | two pointers, sliding window, binary search, hash-map patterns, BFS |
| 16 · Dynamic programming | what DP is, memoization, the problem-solving method |
| 17 · Machine coding | array methods, call/apply/bind, debounce/throttle, Promise combinators |
| 18 · Applied storefront | product grid, search, API client, cart, money, optimistic updates, idempotency |

🔴 **The whole Master tier — all 99 topics across all 19 phases — is now written**, verified
with a script that compares the syllabus's `t-master` badges against `progress.js`
(`MASTER TOPICS STILL UNWRITTEN: 0`). Understand tier then begun at phase 3 (topics 09, 10, 11).

**Also fixed this session:** `progress.js` carried 3 topics for phase 12 and 6 for phase 14 against
a syllabus of 21 and 17 — **that 29-topic gap was the whole 308-vs-337 mismatch** recorded in
[[devbible-overall-snapshot]], and the JavaScript rows now sum to 337.

**Every build was clean under `docs/javascript/`** (0 broken links); the TypeScript and Express
links reported by the build belong to other sessions and were left alone on the user's instruction.

